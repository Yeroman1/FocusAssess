'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { fetchWithAuth } from '@/lib/api';
import { MonitoredEventType } from '@pyassess/shared';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Dynamically import Monaco Editor to avoid SSR window errors
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type QuestionKind =
  | 'TRUE_FALSE'
  | 'MCQ_SINGLE'
  | 'MCQ_MULTI'
  | 'SHORT_ANSWER'
  | 'ROBOT_SIMULATION'
  | 'CODE';

function detectQuestionKind(q: any): QuestionKind {
  const constraints = (q?.constraints || '').toLowerCase();
  const title = (q?.title || '').toLowerCase();
  const statement = (q?.statement || '').toLowerCase();

  if (
    constraints.includes('true / false') ||
    constraints.includes('true/false') ||
    title.includes('[true/false]')
  ) {
    return 'TRUE_FALSE';
  }
  if (constraints.includes('single choice') || title.startsWith('[mcq]')) {
    return 'MCQ_SINGLE';
  }
  if (
    constraints.includes('multiple choice') ||
    title.startsWith('[multi-select]') ||
    title.startsWith('[mcq_multi]')
  ) {
    return 'MCQ_MULTI';
  }
  if (
    constraints.includes('standard output match') ||
    title.startsWith('[output prediction]') ||
    title.startsWith('[short answer]')
  ) {
    return 'SHORT_ANSWER';
  }
  if (
    constraints.includes('cs1robots') ||
    title.includes('robot') ||
    statement.includes('cs1robots')
  ) {
    return 'ROBOT_SIMULATION';
  }
  return 'CODE';
}

interface McqOption {
  letter: string;
  text: string;
}

function parseMcq(statement: string): { prompt: string; options: McqOption[] } {
  if (!statement) return { prompt: '', options: [] };
  const parts = statement.split(/\*\*Options(?:[^\*]*)\*\*|\bOptions(?:\s*\([^)]*\))?:/i);
  let prompt = parts[0]?.trim() || '';
  const optionsText = parts[1] || '';

  const options: McqOption[] = [];
  if (optionsText) {
    const lines = optionsText.split('\n');
    for (const line of lines) {
      const match = line.trim().match(/^([A-Z])[\.\)]\s*(.*)$/);
      if (match) {
        options.push({ letter: match[1], text: match[2].trim() });
      }
    }
  }

  // Fallback: search line-by-line if no explicit **Options** header
  if (options.length === 0) {
    const lines = statement.split('\n');
    const promptLines: string[] = [];
    for (const line of lines) {
      const match = line.trim().match(/^([A-Z])[\.\)]\s+(.+)$/);
      if (match) {
        options.push({ letter: match[1], text: match[2].trim() });
      } else if (options.length === 0) {
        promptLines.push(line);
      }
    }
    if (options.length > 0) {
      prompt = promptLines.join('\n').trim();
    }
  }

  return { prompt: prompt || statement, options };
}

function isQuestionCompleted(q: any, answerValue: string | undefined): boolean {
  if (!answerValue) return false;
  const trimmed = answerValue.trim();
  if (!trimmed) return false;

  const kind = detectQuestionKind(q);
  if (kind === 'CODE' || kind === 'ROBOT_SIMULATION') {
    const starter = getDefaultStarterCode(q.title).trim();
    return trimmed.length > 0 && trimmed !== starter;
  }

  return trimmed.length > 0;
}

export default function ActiveExamWorkspacePage() {
  return (
    <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
      <ActiveExamWorkspaceContent />
    </ProtectedRoute>
  );
}

function ActiveExamWorkspaceContent() {
  const router = useRouter();
  const params = useParams();
  const attemptId = params.attemptId as string;

  // Active exam state
  const [attemptData, setAttemptData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [seenQuestions, setSeenQuestions] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'both' | 'statement' | 'editor'>('both');

  // Timers and telemetry
  const [remainingSeconds, setRemainingSeconds] = useState<number>(5400); // 90 mins default
  const [trustScore, setTrustScore] = useState<number>(100);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Saved just now');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close image modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedImageModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Fetch initial attempt state & questions
  useEffect(() => {
    fetchWithAuth(`/attempts/${attemptId}`)
      .then((data) => {
        setAttemptData(data.attempt);
        setTrustScore(data.attempt.trustScore ?? 100);

        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setSeenQuestions({ [data.questions[0].id]: true });
          const initialAnswers: Record<string, string> = {};
          data.questions.forEach((q: any) => {
            const kind = detectQuestionKind(q);
            if (q.savedSourceCode) {
              initialAnswers[q.id] = q.savedSourceCode;
            } else if (kind === 'CODE' || kind === 'ROBOT_SIMULATION') {
              initialAnswers[q.id] = getDefaultStarterCode(q.title);
            } else {
              // Non-code questions (True/False, MCQ, Short Answer) start blank
              initialAnswers[q.id] = '';
            }
          });
          setCodeAnswers(initialAnswers);
        }

        // Calculate initial remaining seconds from server authoritative deadline
        if (data.attempt.deadlineAt) {
          const deadlineMs = new Date(data.attempt.deadlineAt).getTime();
          const serverNowMs = data.serverTime ? new Date(data.serverTime).getTime() : Date.now();
          const diffSec = Math.max(0, Math.floor((deadlineMs - serverNowMs) / 1000));
          setRemainingSeconds(diffSec);
        }
      })
      .catch((err) => {
        console.error('Failed to load examination attempt:', err);
        setLoadError(
          err.message || 'Unable to load examination session. The session may be invalid or unauthorized.'
        );
      });
  }, [attemptId]);

  // 2. Countdown timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 3. Track seen questions whenever activeQuestion changes
  useEffect(() => {
    if (questions[activeQuestionIdx]?.id) {
      const qId = questions[activeQuestionIdx].id;
      setSeenQuestions((prev) => {
        if (prev[qId]) return prev;
        return { ...prev, [qId]: true };
      });
    }
  }, [activeQuestionIdx, questions]);

  // 4. Anti-Cheating Telemetry Event Dispatcher
  const reportEvent = useCallback(
    async (eventType: MonitoredEventType, metadata?: Record<string, any>) => {
      try {
        const idempotencyKey = `evt-${attemptId}-${eventType}-${Math.floor(Date.now() / 3000)}`;

        const data = await fetchWithAuth(`/attempts/${attemptId}/events`, {
          method: 'POST',
          body: JSON.stringify({
            eventType,
            occurredAt: new Date().toISOString(),
            idempotencyKey,
            metadata,
          }),
        });

        if (data.trustScore !== undefined) {
          setTrustScore(data.trustScore);
        }

        // STRICT MANDATORY TERMINATION CHECK (< 70%)
        if (data.isTerminated || data.status === 'terminated_suspicious') {
          router.push(`/student/attempts/${attemptId}/terminated`);
        }
      } catch (err) {
        console.warn('Telemetry event sync:', err);
      }
    },
    [attemptId, router]
  );

  // 4. Attach Browser Anti-Cheating Event Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportEvent('VISIBILITY_HIDDEN', { reason: 'Page hidden or tab switched' });
      }
    };

    const handleWindowBlur = () => {
      reportEvent('WINDOW_BLUR', { reason: 'OS window lost focus' });
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportEvent('FULLSCREEN_EXIT', { reason: 'Candidate exited fullscreen mode' });
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportEvent('CLIPBOARD_COPY', { reason: 'Copy command suppressed' });
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportEvent('CLIPBOARD_PASTE', { reason: 'Paste command suppressed' });
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportEvent('CONTEXT_MENU', { reason: 'Right click context menu suppressed' });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [reportEvent]);

  // 5. Debounced Autosave (800ms delay)
  const handleAnswerChange = (newAnswer: string | undefined) => {
    const answer = newAnswer ?? '';
    const activeQ = questions[activeQuestionIdx];
    if (!activeQ) return;

    setCodeAnswers((prev) => ({ ...prev, [activeQ.id]: answer }));
    setAutosaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await fetchWithAuth(`/attempts/${attemptId}/answers/${activeQ.id}`, {
          method: 'PUT',
          body: JSON.stringify({ sourceCode: answer }),
        });
        setAutosaveStatus('saved');
        setLastSavedTime('Saved just now');
      } catch (err) {
        setAutosaveStatus('error');
        setLastSavedTime('Save failed');
      }
    }, 800);
  };

  // 6. Submit Exam
  const handleSubmitExam = async () => {
    setIsSubmitting(true);
    setShowSubmitConfirm(false);

    try {
      await fetchWithAuth(`/attempts/${attemptId}/submit`, {
        method: 'POST',
      });
      router.push(`/student/attempts/${attemptId}/results`);
    } catch (err: any) {
      alert(`Submission error: ${err.message || 'Please retry submission'}`);
      setIsSubmitting(false);
    }
  };

  const activeQuestion = questions[activeQuestionIdx] || {
    id: 'loading',
    title: 'Loading problem...',
    statement: 'Retrieving secure problem statement...',
    maxMarks: 25,
    publicExamples: [],
  };

  const activeKind = useMemo(() => detectQuestionKind(activeQuestion), [activeQuestion]);
  const currentAnswer = codeAnswers[activeQuestion.id] || '';

  // Parse MCQ options for MCQ questions
  const mcqParsed = useMemo(() => {
    if (activeKind === 'MCQ_SINGLE' || activeKind === 'MCQ_MULTI') {
      return parseMcq(activeQuestion.statement);
    }
    return { prompt: activeQuestion.statement, options: [] };
  }, [activeKind, activeQuestion.statement]);

  // Format timer
  const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');

  // Count questions by 3-state board indicators: Completed, Seen, Unseen
  const completedCount = questions.filter((q) => isQuestionCompleted(q, codeAnswers[q.id])).length;
  const seenCount = questions.filter(
    (q) => seenQuestions[q.id] && !isQuestionCompleted(q, codeAnswers[q.id])
  ).length;
  const unseenCount = Math.max(0, questions.length - completedCount - seenCount);

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-error-container text-error flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-on-surface">Unable to Access Examination</h1>
            <p className="text-xs text-on-surface-variant mt-1">{loadError}</p>
          </div>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="w-full h-10 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Return to Student Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans select-none w-full max-w-full overflow-x-hidden overflow-x-clip">
      {/* Pinned Exam Meta Sub-Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surface-container-high px-3 sm:px-4 md:px-8 py-2 sm:py-2.5 shadow-sm w-full max-w-full overflow-x-hidden overflow-x-clip">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Brand & Autosave Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="font-bold text-sm sm:text-base text-on-surface">FocusAssess</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high text-xs font-mono text-on-surface">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autosaveStatus === 'saving'
                    ? 'bg-amber-500 animate-spin'
                    : 'bg-on-tertiary-container animate-pulse'
                }`}
              />
              <span>{autosaveStatus === 'saving' ? 'Autosaving...' : 'Live Sync'}</span>
            </span>
            <span className="text-xs font-mono text-on-surface-variant hidden md:inline">
              {lastSavedTime}
            </span>
          </div>

          {/* Trust Score & Authoritative Timer */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold ${
                trustScore >= 70 ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-error'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span>Trust {trustScore}%</span>
            </div>

            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold tracking-wider ${
                remainingSeconds < 300
                  ? 'bg-error text-white animate-pulse'
                  : 'bg-primary-container text-primary-fixed'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] sm:text-[15px]">timer</span>
              <span>
                {hours}:{mins}:{secs}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full max-w-full px-3 sm:px-4 md:px-8 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4 min-w-0 overflow-x-hidden overflow-x-clip">
        {/* Top Question Number Board with 3-State Color Indicators (Completed, Seen, Unseen) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-sm flex flex-col space-y-3 w-full max-w-full min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider font-bold text-on-surface">
                Question Board
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/25">
                {completedCount} of {questions.length} Completed
              </span>
            </div>
            <div className="text-xs font-mono text-on-surface-variant flex items-center gap-1.5">
              <span>Viewing:</span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-primary font-bold">
                Problem {activeQuestionIdx + 1} of {questions.length}
              </span>
              <span className="text-secondary font-semibold">({activeQuestion?.maxMarks || 0} pts)</span>
            </div>
          </div>

          {/* Question Grid / Buttons */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 w-full">
            {questions.map((q, idx) => {
              const answer = codeAnswers[q.id];
              const isCompleted = isQuestionCompleted(q, answer);
              const isSeen = Boolean(seenQuestions[q.id]);
              const isActive = idx === activeQuestionIdx;
              const isFlagged = Boolean(flaggedQuestions[q.id]);

              // 3 Distinct Color States:
              // 1. Completed: Solid Emerald Green (bg-emerald-600)
              // 2. Seen / In Progress: Solid Amber / Orange (bg-amber-500)
              // 3. Unseen: Neutral Slate Gray (bg-surface-container-low)
              let buttonStyle = '';
              let badgeText = '';

              if (isCompleted) {
                buttonStyle = 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm';
                badgeText = 'Completed';
              } else if (isSeen) {
                buttonStyle = 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm';
                badgeText = 'Seen';
              } else {
                buttonStyle = 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant border-surface-container-high';
                badgeText = 'Unseen';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={`relative flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border font-mono text-xs transition-all active:scale-[0.98] select-none ${buttonStyle} ${
                    isActive
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-[1.05] z-10 shadow-md font-bold'
                      : 'opacity-95'
                  }`}
                  title={`Question ${idx + 1} (${badgeText}) - Click to jump`}
                >
                  {/* Flagged Bookmark Badge */}
                  {isFlagged && (
                    <span
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border border-white dark:border-slate-900 shadow-xs flex items-center justify-center text-[9px] text-white leading-none"
                      title="Flagged for review"
                    >
                      ★
                    </span>
                  )}

                  <div className="flex items-center gap-1 font-bold">
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : isSeen ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    ) : null}
                    <span>Q{idx + 1}</span>
                  </div>

                  <span
                    className={`text-[10px] font-normal leading-tight mt-0.5 ${
                      isCompleted || isSeen ? 'text-white/85' : 'text-on-surface-variant/70'
                    }`}
                  >
                    {q.maxMarks} pts
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3-State Color Legend Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/80 text-[11px] font-mono text-on-surface-variant flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-600 border border-emerald-700 inline-block shadow-xs" />
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Completed ({completedCount})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 border border-amber-600 inline-block shadow-xs" />
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  Seen / In Progress ({seenCount})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-surface-container-low border border-surface-container-highest inline-block shadow-xs" />
                <span className="font-normal text-on-surface-variant">
                  Unseen ({unseenCount})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                <span>★ Flagged</span>
              </span>
              <span className="text-surface-container-highest">|</span>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">touch_app</span>
                <span>Click to jump</span>
              </span>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Segmented View Switcher */}
        <div className="flex lg:hidden items-center p-1 rounded-xl bg-surface-container border border-surface-container-high w-full">
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'statement'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span>Problem</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'editor'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {activeKind === 'CODE' || activeKind === 'ROBOT_SIMULATION' ? 'code' : 'fact_check'}
            </span>
            <span>{activeKind === 'CODE' || activeKind === 'ROBOT_SIMULATION' ? 'Code Editor' : 'Answer'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'both'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">splitscreen</span>
            <span>Stacked</span>
          </button>
        </div>

        {/* 2-Column Split: Problem Statement (Left) + Specialized Answering Interface (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 w-full max-w-full min-w-0">
          {/* Left Column: Problem Statement & Question Media (5 cols) */}
          <div
            className={`lg:col-span-5 w-full max-w-full min-w-0 bg-surface-container-lowest p-3 sm:p-5 rounded-2xl border border-surface-container-high/80 shadow-sm flex-col space-y-4 overflow-y-auto max-h-[550px] lg:max-h-[750px] ${
              activeTab === 'editor' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Header info */}
            <div className="flex items-start justify-between gap-2 border-b border-surface-container-high pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-container text-secondary">
                    Problem {activeQuestionIdx + 1}
                  </span>
                  {activeKind === 'TRUE_FALSE' && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-mono text-[11px] font-bold border border-purple-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      True / False
                    </span>
                  )}
                  {activeKind === 'MCQ_SINGLE' && (
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-bold border border-blue-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">radio_button_checked</span>
                      Single Choice
                    </span>
                  )}
                  {activeKind === 'MCQ_MULTI' && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">checklist</span>
                      Multi-Select
                    </span>
                  )}
                  {activeKind === 'SHORT_ANSWER' && (
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-[11px] font-bold border border-teal-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">edit_note</span>
                      Direct Output
                    </span>
                  )}
                  {activeKind === 'ROBOT_SIMULATION' && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono text-[11px] font-bold flex items-center gap-1 border border-purple-500/30">
                      <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                      cs1robots Simulation
                    </span>
                  )}
                  {activeKind === 'CODE' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">code</span>
                      Python Algorithm
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold text-on-surface mt-1.5">
                  {activeQuestion.title?.replace(/^\[(MCQ|Multi-Select|Robot Simulation|Output Prediction)\]\s*/i, '')}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface font-mono text-xs font-bold flex-shrink-0">
                {activeQuestion.maxMarks} Marks
              </span>
            </div>

            {/* Question Attached Photo / Diagram (Visual Problem Reference - Crucial Component) */}
            {activeQuestion.imageUrl && (
              <div className="rounded-2xl overflow-hidden border-2 border-primary/25 bg-surface-container-low shadow-sm p-3 flex flex-col items-center space-y-2.5">
                <div className="w-full pb-2 border-b border-surface-container-high/80 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <span className="material-symbols-outlined text-[18px]">image</span>
                    <span>
                      {activeKind === 'ROBOT_SIMULATION'
                        ? 'Target Goal World State (Part of Question)'
                        : 'Attached Question Diagram / Photo (Part of Question)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedImageModal(activeQuestion.imageUrl)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">fullscreen</span>
                    <span>Click to Zoom</span>
                  </button>
                </div>

                <div
                  onClick={() => setSelectedImageModal(activeQuestion.imageUrl)}
                  className="w-full flex items-center justify-center p-1.5 rounded-xl cursor-zoom-in group relative overflow-hidden bg-white dark:bg-slate-900 border border-surface-container-high/60"
                  title="Click to view full size diagram in fullscreen"
                >
                  <img
                    src={activeQuestion.imageUrl}
                    alt={activeQuestion.title ? `${activeQuestion.title} diagram` : 'Question diagram'}
                    className="max-h-80 sm:max-h-96 w-auto max-w-full object-contain rounded-lg transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center pointer-events-none">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3.5 py-1.5 rounded-full bg-black/80 text-white text-xs font-mono font-medium flex items-center gap-1.5 shadow-xl">
                      <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                      <span>Click for Fullscreen View</span>
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-on-surface-variant font-mono text-center w-full">
                  Visual Diagram: Click the photo to inspect full resolution in fullscreen.
                </p>
              </div>
            )}

            {/* Problem Statement Prose (Cleaned of leaked options if MCQ) */}
            <div className="text-xs md:text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
              {activeKind === 'MCQ_SINGLE' || activeKind === 'MCQ_MULTI'
                ? mcqParsed.prompt
                : activeQuestion.statement}
            </div>

            {/* Input & Return Format (Safe, sanitized specifications) */}
            <div className="space-y-2 pt-1">
              {activeQuestion.inputDescription && (
                <div className="p-3 rounded-xl bg-surface-container-low flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">
                    Input Specification
                  </span>
                  <p className="text-xs text-on-surface">{activeQuestion.inputDescription}</p>
                </div>
              )}

              {activeQuestion.outputDescription &&
                !activeQuestion.outputDescription.toLowerCase().includes('expected answer') && (
                  <div className="p-3 rounded-xl bg-surface-container-low flex flex-col space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">
                      Return Format
                    </span>
                    <p className="text-xs text-on-surface">{activeQuestion.outputDescription}</p>
                  </div>
                )}

              {activeQuestion.constraints && (
                <div className="p-3 rounded-xl bg-surface-container-low flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">
                    Constraints
                  </span>
                  <p className="text-xs text-on-surface font-mono">{activeQuestion.constraints}</p>
                </div>
              )}
            </div>

            {/* Public Examples: Only shown for standard CODE problems, NEVER for MCQ or True/False */}
            {activeKind === 'CODE' &&
              activeQuestion.publicExamples &&
              activeQuestion.publicExamples.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-on-surface">Sample Input / Output</span>
                  {activeQuestion.publicExamples.slice(0, 2).map((ex: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-surface-container-low font-mono text-xs space-y-1.5 border border-surface-container-high/60 min-w-0 max-w-full"
                    >
                      <div className="text-on-surface-variant text-[11px]"># Input Data:</div>
                      <div className="text-on-surface font-semibold overflow-x-auto break-all max-w-full">
                        {ex.stdin || '<No input>'}
                      </div>
                      <div className="text-on-surface-variant text-[11px] pt-1"># Expected Return:</div>
                      <div className="text-on-tertiary-container font-bold overflow-x-auto break-all max-w-full">
                        {ex.expectedOutput}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* Private evaluation footer */}
            <div className="p-3 rounded-xl bg-surface-container flex items-center gap-2.5 text-xs text-on-surface-variant mt-auto">
              <span className="material-symbols-outlined text-[18px] text-secondary flex-shrink-0">
                shield
              </span>
              <p className="leading-tight">
                <strong>Evaluation Suite:</strong> Submissions are automatically evaluated against private verification suites upon final submission.
              </p>
            </div>
          </div>

          {/* Right Column: Specialized Answering Interface (7 cols) */}
          <div
            className={`lg:col-span-7 w-full max-w-full min-w-0 flex flex-col ${
              activeTab === 'statement' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* 1. TRUE / FALSE QUESTIONS */}
            {activeKind === 'TRUE_FALSE' && (
              <TrueFalseAnsweringPanel
                value={currentAnswer}
                onChange={handleAnswerChange}
              />
            )}

            {/* 2. MCQ SINGLE-CHOICE QUESTIONS */}
            {activeKind === 'MCQ_SINGLE' && (
              <McqSingleAnsweringPanel
                options={mcqParsed.options}
                value={currentAnswer}
                onChange={handleAnswerChange}
              />
            )}

            {/* 3. MCQ MULTI-SELECT QUESTIONS */}
            {activeKind === 'MCQ_MULTI' && (
              <McqMultiAnsweringPanel
                options={mcqParsed.options}
                value={currentAnswer}
                onChange={handleAnswerChange}
              />
            )}

            {/* 4. SHORT ANSWER / OUTPUT PREDICTION QUESTIONS */}
            {activeKind === 'SHORT_ANSWER' && (
              <ShortAnswerAnsweringPanel
                value={currentAnswer}
                onChange={handleAnswerChange}
              />
            )}

            {/* 5. PYTHON CODING & ROBOT SIMULATION QUESTIONS: Full Monaco Python Editor */}
            {(activeKind === 'CODE' || activeKind === 'ROBOT_SIMULATION') && (
              <div className="w-full max-w-full min-w-0 bg-dark-ide rounded-2xl border border-slate-800 shadow-md flex flex-col overflow-hidden">
                {/* Editor Chrome Top Bar */}
                <div className="h-10 px-3 sm:px-4 bg-dark-ide-header flex items-center justify-between select-none border-b border-slate-800 text-slate-300">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">
                      {activeKind === 'ROBOT_SIMULATION' ? 'smart_toy' : 'terminal'}
                    </span>
                    <span className="font-semibold text-slate-200">
                      {activeKind === 'ROBOT_SIMULATION' ? 'robot_solution.py' : 'solution.py'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                      Python 3.12 {activeKind === 'ROBOT_SIMULATION' && '• cs1robots'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Kernel Ready
                    </span>
                  </div>
                </div>

                {/* Monaco Python Editor Container */}
                <div className="flex-1 w-full max-w-full min-w-0 min-h-[340px] sm:min-h-[480px] h-[360px] sm:h-[480px] relative bg-dark-ide overflow-hidden">
                  <Editor
                    height="100%"
                    language="python"
                    theme="vs-dark"
                    value={currentAnswer}
                    onChange={(val) => handleAnswerChange(val)}
                    options={{
                      fontSize: 13,
                      lineNumbers: 'on',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      automaticLayout: true,
                      tabSize: 4,
                      renderWhitespace: 'selection',
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                </div>

                {/* Editor Status Footer */}
                <div className="px-3 sm:px-4 py-2 bg-dark-ide-footer text-slate-400 flex items-center justify-between text-xs font-mono border-t border-slate-800">
                  <div className="flex items-center gap-3">
                    <span>UTF-8</span>
                    <span>Spaces: 4</span>
                    <span className="hidden sm:inline">Execution Disabled During Exam</span>
                  </div>
                  <span className="text-emerald-400 font-medium">Auto-Sync Active</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Interactive Action Dock: Previous, Next & Submit */}
        <div className="sticky bottom-0 z-30 pt-3 pb-3 bg-surface/95 backdrop-blur-md border-t border-surface-container-high mt-auto w-full max-w-full min-w-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 max-w-7xl mx-auto">
            {/* Left Controls: Flag Bookmark & Previous / Next */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFlaggedQuestions((prev) => ({
                    ...prev,
                    [activeQuestion.id]: !prev[activeQuestion.id],
                  }));
                }}
                className={`h-11 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  flaggedQuestions[activeQuestion.id]
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-400'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-surface-container-high'
                }`}
                title="Flag this question to review later"
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    flaggedQuestions[activeQuestion.id] ? 'text-amber-600' : 'text-on-surface-variant'
                  }`}
                >
                  bookmark
                </span>
                <span>{flaggedQuestions[activeQuestion.id] ? 'Flagged' : 'Review Later'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveQuestionIdx((prev) => Math.max(0, prev - 1))}
                disabled={activeQuestionIdx === 0}
                className="h-11 px-5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:pointer-events-none border border-surface-container-high shadow-xs active:scale-[0.98]"
                title="Go to previous question"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveQuestionIdx((prev) => Math.min(questions.length - 1, prev + 1))
                }
                disabled={activeQuestionIdx === questions.length - 1}
                className="h-11 px-6 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:pointer-events-none border border-surface-container-high shadow-xs active:scale-[0.98]"
                title="Go to next question"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            {/* Right Controls: Question Progress Pill & Final Submit */}
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <span className="text-xs font-mono text-on-surface-variant hidden md:inline">
                Question {activeQuestionIdx + 1} of {questions.length}
              </span>

              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={isSubmitting}
                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.99] transition-all shadow-md ml-auto"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>Submit &amp; Grade Examination</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Final Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Final Submission Confirmation</h3>
                <p className="text-xs text-on-surface-variant">Are you ready to finalize your attempt?</p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Once submitted, all your answers and code solutions will be frozen and queued for isolated grading against private evaluation suites. You will not be able to modify your answers.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 sm:flex-initial px-4 h-10 rounded-xl bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high text-center"
              >
                Continue Working
              </button>

              <button
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-5 h-10 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-800 text-center"
              >
                {isSubmitting ? 'Grading...' : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. TRUE / FALSE ANSWERING PANEL COMPONENT
// ---------------------------------------------------------------------------
function TrueFalseAnsweringPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const normVal = value?.trim().toLowerCase();
  const isTrue = normVal === 'true' || normVal === 'print(true)';
  const isFalse = normVal === 'false' || normVal === 'print(false)';

  return (
    <div className="flex-1 flex flex-col justify-center p-4 sm:p-8 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm space-y-6">
      <div className="text-center space-y-1">
        <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 font-mono text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 border border-purple-500/20">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          True / False Question
        </span>
        <h3 className="text-base sm:text-lg font-bold text-on-surface pt-2">
          Select whether the statement is True or False:
        </h3>
        <p className="text-xs text-on-surface-variant">
          Click your chosen response below. Your selection is automatically saved in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto w-full">
        {/* TRUE CARD */}
        <button
          type="button"
          onClick={() => onChange('True')}
          className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-3 cursor-pointer select-none active:scale-[0.98] ${
            isTrue
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-md ring-4 ring-emerald-500/20'
              : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high hover:border-emerald-300 text-on-surface'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
              isTrue
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-surface-container-high text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <span className="material-symbols-outlined text-[32px]">check</span>
          </div>
          <div className="text-center">
            <span
              className={`text-lg font-bold font-mono tracking-wider ${
                isTrue ? 'text-emerald-700 dark:text-emerald-300' : 'text-on-surface'
              }`}
            >
              TRUE
            </span>
            <p className="text-[11px] text-on-surface-variant mt-0.5">The statement is correct</p>
          </div>
          {isTrue && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold font-mono">
              ✓ SELECTED
            </span>
          )}
        </button>

        {/* FALSE CARD */}
        <button
          type="button"
          onClick={() => onChange('False')}
          className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-3 cursor-pointer select-none active:scale-[0.98] ${
            isFalse
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-md ring-4 ring-rose-500/20'
              : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high hover:border-rose-300 text-on-surface'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
              isFalse
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-surface-container-high text-rose-600 dark:text-rose-400'
            }`}
          >
            <span className="material-symbols-outlined text-[32px]">close</span>
          </div>
          <div className="text-center">
            <span
              className={`text-lg font-bold font-mono tracking-wider ${
                isFalse ? 'text-rose-700 dark:text-rose-300' : 'text-on-surface'
              }`}
            >
              FALSE
            </span>
            <p className="text-[11px] text-on-surface-variant mt-0.5">The statement is incorrect</p>
          </div>
          {isFalse && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold font-mono">
              ✓ SELECTED
            </span>
          )}
        </button>
      </div>

      <div className="text-center pt-2">
        <span className="text-xs font-mono text-on-surface-variant">
          Current Answer:{' '}
          <strong
            className={
              isTrue ? 'text-emerald-600 font-bold' : isFalse ? 'text-rose-600 font-bold' : 'text-on-surface-variant'
            }
          >
            {isTrue ? 'TRUE' : isFalse ? 'FALSE' : 'No option chosen yet'}
          </strong>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. MCQ SINGLE-CHOICE ANSWERING PANEL COMPONENT
// ---------------------------------------------------------------------------
function McqSingleAnsweringPanel({
  options,
  value,
  onChange,
}: {
  options: McqOption[];
  value: string;
  onChange: (val: string) => void;
}) {
  const selectedLetter = value?.trim().toUpperCase();

  const displayOptions =
    options.length > 0
      ? options
      : [
          { letter: 'A', text: 'Option A' },
          { letter: 'B', text: 'Option B' },
          { letter: 'C', text: 'Option C' },
          { letter: 'D', text: 'Option D' },
        ];

  return (
    <div className="flex-1 flex flex-col justify-start p-4 sm:p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-blue-500/20">
            <span className="material-symbols-outlined text-[15px]">radio_button_checked</span>
            Single Choice (MCQ)
          </span>
          <h3 className="text-sm sm:text-base font-bold text-on-surface mt-1">Select the correct option:</h3>
        </div>
        {selectedLetter && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-mono text-on-surface-variant hover:text-error hover:underline"
          >
            Clear choice
          </button>
        )}
      </div>

      <div className="space-y-3 pt-1">
        {displayOptions.map((opt) => {
          const isSelected = selectedLetter === opt.letter;
          return (
            <button
              key={opt.letter}
              type="button"
              onClick={() => onChange(opt.letter)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer active:scale-[0.99] select-none ${
                isSelected
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                  : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
              }`}
            >
              {/* Radio Indicator */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-surface-container-high text-on-surface border border-surface-container-highest'
                }`}
              >
                {opt.letter}
              </div>

              {/* Option Text */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isSelected ? 'font-semibold text-blue-900 dark:text-blue-200' : 'text-on-surface'
                  }`}
                >
                  {opt.text}
                </span>
              </div>

              {/* Checkmark badge */}
              {isSelected && (
                <span className="material-symbols-outlined text-blue-600 text-[20px] flex-shrink-0">
                  check_circle
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-2 text-center text-xs font-mono text-on-surface-variant">
        {selectedLetter ? (
          <span>
            Selected Option:{' '}
            <strong className="text-blue-600 font-bold">Option {selectedLetter}</strong> (Live Saved)
          </span>
        ) : (
          <span>No option selected yet</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. MCQ MULTI-SELECT ANSWERING PANEL COMPONENT
// ---------------------------------------------------------------------------
function McqMultiAnsweringPanel({
  options,
  value,
  onChange,
}: {
  options: McqOption[];
  value: string;
  onChange: (val: string) => void;
}) {
  const selectedLetters = (value || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const displayOptions =
    options.length > 0
      ? options
      : [
          { letter: 'A', text: 'Option A' },
          { letter: 'B', text: 'Option B' },
          { letter: 'C', text: 'Option C' },
          { letter: 'D', text: 'Option D' },
        ];

  const handleToggle = (letter: string) => {
    let next: string[];
    if (selectedLetters.includes(letter)) {
      next = selectedLetters.filter((l) => l !== letter);
    } else {
      next = [...selectedLetters, letter].sort();
    }
    onChange(next.join(', '));
  };

  return (
    <div className="flex-1 flex flex-col justify-start p-4 sm:p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-amber-500/20">
            <span className="material-symbols-outlined text-[15px]">checklist</span>
            Multi-Select Evaluation
          </span>
          <h3 className="text-sm sm:text-base font-bold text-on-surface mt-1">
            Select all options that apply:
          </h3>
        </div>
        {selectedLetters.length > 0 && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-mono text-on-surface-variant hover:text-error hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-3 pt-1">
        {displayOptions.map((opt) => {
          const isSelected = selectedLetters.includes(opt.letter);
          return (
            <button
              key={opt.letter}
              type="button"
              onClick={() => handleToggle(opt.letter)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer active:scale-[0.99] select-none ${
                isSelected
                  ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                  : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
              }`}
            >
              {/* Checkbox indicator */}
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-surface-container border border-surface-container-highest text-on-surface-variant'
                }`}
              >
                {isSelected ? '✓' : ''}
              </div>

              <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface-container text-secondary">
                {opt.letter}
              </span>

              {/* Option Text */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isSelected ? 'font-semibold text-amber-900 dark:text-amber-200' : 'text-on-surface'
                  }`}
                >
                  {opt.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 text-center text-xs font-mono text-on-surface-variant">
        {selectedLetters.length > 0 ? (
          <span>
            Selected Options:{' '}
            <strong className="text-amber-600 font-bold">{selectedLetters.join(', ')}</strong> (Live Saved)
          </span>
        ) : (
          <span>No options selected yet</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. SHORT ANSWER / DIRECT OUTPUT ANSWERING PANEL COMPONENT
// ---------------------------------------------------------------------------
function ShortAnswerAnsweringPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col justify-start p-4 sm:p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm space-y-4">
      <div className="pb-3 border-b border-surface-container-high">
        <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-teal-500/20">
          <span className="material-symbols-outlined text-[15px]">edit_note</span>
          Direct Output / Short Answer
        </span>
        <h3 className="text-sm sm:text-base font-bold text-on-surface mt-1">
          Type your predicted output / answer:
        </h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Enter the exact value or output string. Leading and trailing whitespace will be trimmed during evaluation.
        </p>
      </div>

      <div className="space-y-2 pt-2">
        <label className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">
          Answer Input:
        </label>
        <textarea
          rows={5}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your exact predicted output here (e.g. 42, False, or [1, 2, 3])..."
          className="w-full p-4 rounded-xl bg-surface-container-low border-2 border-surface-container-high focus:border-primary focus:bg-surface focus:outline-none font-mono text-sm text-on-surface leading-relaxed transition-all shadow-inner resize-y"
        />
      </div>

      <div className="p-3 rounded-xl bg-surface-container flex items-center gap-2 text-xs text-on-surface-variant font-mono">
        <span className="material-symbols-outlined text-[16px] text-teal-600">info</span>
        <span>Changes autosave in real-time as you type.</span>
      </div>
    </div>
  );
}

function getDefaultStarterCode(title: string): string {
  if (title?.toLowerCase().includes('robot') || title?.toLowerCase().includes('cs1robots')) {
    return `from cs1robots import *

# Initialize world and robot
create_world(avenues=10, streets=10)
hubot = Robot(avenue=1, street=1, orientation='E', beepers=0)

# --- WRITE YOUR CS1ROBOTS SIMULATION CODE BELOW ---
`;
  }

  return `# Python 3.12 Solution
import sys

def solution():
    # Write your solution code here
    pass

if __name__ == '__main__':
    solution()
`;
}
