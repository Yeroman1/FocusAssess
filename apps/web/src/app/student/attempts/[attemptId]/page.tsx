'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { fetchWithAuth } from '@/lib/api';
import { MonitoredEventType } from '@pyassess/shared';

// Dynamically import Monaco Editor to avoid SSR window errors
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
import { ProtectedRoute } from '@/components/ProtectedRoute';

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

  // Timers and telemetry
  const [remainingSeconds, setRemainingSeconds] = useState<number>(5400); // 90 mins default
  const [trustScore, setTrustScore] = useState<number>(100);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Saved just now');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch initial attempt state & questions
  useEffect(() => {
    fetchWithAuth(`/attempts/${attemptId}`)
      .then((data) => {
        setAttemptData(data.attempt);
        setTrustScore(data.attempt.trustScore ?? 100);

        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          const initialAnswers: Record<string, string> = {};
          data.questions.forEach((q: any) => {
            initialAnswers[q.id] = q.savedSourceCode || getDefaultStarterCode(q.title);
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
        setLoadError(err.message || 'Unable to load examination session. The session may be invalid or unauthorized.');
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

  // 3. Anti-Cheating Telemetry Event Dispatcher
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

  // 5. Debounced Autosave (1.5s delay)
  const handleCodeChange = (newCode: string | undefined) => {
    const code = newCode ?? '';
    const activeQ = questions[activeQuestionIdx];
    if (!activeQ) return;

    setCodeAnswers((prev) => ({ ...prev, [activeQ.id]: code }));
    setAutosaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await fetchWithAuth(`/attempts/${attemptId}/answers/${activeQ.id}`, {
          method: 'PUT',
          body: JSON.stringify({ sourceCode: code }),
        });
        setAutosaveStatus('saved');
        setLastSavedTime('Saved just now');
      } catch (err) {
        setAutosaveStatus('error');
        setLastSavedTime('Save failed');
      }
    }, 1500);
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

  const currentCode = codeAnswers[activeQuestion.id] || '';

  // Format timer
  const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');

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
    <div className="min-h-screen bg-surface flex flex-col font-sans select-none">
      {/* Pinned Exam Meta Sub-Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surface-container-high px-3 sm:px-4 md:px-8 py-2 sm:py-2.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Autosave Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="font-bold text-sm sm:text-base text-on-surface">FocusAssess</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high text-xs font-mono text-on-surface">
              <span className={`w-1.5 h-1.5 rounded-full ${autosaveStatus === 'saving' ? 'bg-amber-500 animate-spin' : 'bg-on-tertiary-container animate-pulse'}`} />
              <span>{autosaveStatus === 'saving' ? 'Autosaving...' : 'Live Sync'}</span>
            </span>
            <span className="text-xs font-mono text-on-surface-variant hidden md:inline">
              {lastSavedTime}
            </span>
          </div>

          {/* Trust Score & Authoritative Timer */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold ${
              trustScore >= 70 ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-error'
            }`}>
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span>Trust {trustScore}%</span>
            </div>

            <div className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold tracking-wider ${
              remainingSeconds < 300 ? 'bg-error text-white animate-pulse' : 'bg-primary-container text-primary-fixed'
            }`}>
              <span className="material-symbols-outlined text-[14px] sm:text-[15px]">timer</span>
              <span>{hours}:{mins}:{secs}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 md:px-8 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4">
        {/* Question Stepper Navigation Ribbon */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-on-surface-variant uppercase tracking-wider font-semibold">Problem Navigator</span>
            <span className="text-secondary font-medium">Question {activeQuestionIdx + 1} of {questions.length}</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
            {questions.map((q, idx) => {
              const isAnswered = !!codeAnswers[q.id]?.trim() && codeAnswers[q.id] !== getDefaultStarterCode(q.title);
              const isActive = idx === activeQuestionIdx;
              const isFlagged = flaggedQuestions[q.id];

              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl transition-all flex-shrink-0 text-left border ${
                    isActive
                      ? 'bg-secondary text-white border-secondary shadow-sm'
                      : isFlagged
                      ? 'bg-error-container/40 text-on-surface border-error/40'
                      : isAnswered
                      ? 'bg-surface-container-high text-on-surface border-surface-container-high'
                      : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high/60'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] font-bold ${
                    isActive
                      ? 'bg-white text-secondary'
                      : isAnswered
                      ? 'bg-on-tertiary-container text-white'
                      : 'bg-surface-container text-on-surface'
                  }`}>
                    {isAnswered && !isActive ? '✓' : idx + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{q.title.split(':')[0]}</span>
                    <span className="text-[10px] leading-tight opacity-80 font-mono">{q.maxMarks} pts</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Column Split: Problem Statement (Left) + Monaco Python Editor (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left Column: Problem Statement & Bento Specs (5 cols) */}
          <div className="lg:col-span-5 bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high/80 shadow-sm flex flex-col space-y-4 overflow-y-auto max-h-[500px] lg:max-h-[750px]">
            <div className="flex items-start justify-between gap-2 border-b border-surface-container-high pb-3">
              <div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-container text-secondary">
                  Problem {activeQuestionIdx + 1}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-on-surface mt-1">{activeQuestion.title}</h2>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface font-mono text-xs font-bold flex-shrink-0">
                {activeQuestion.maxMarks} Marks
              </span>
            </div>

            {/* Problem Statement Prose */}
            <div className="text-xs md:text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
              {activeQuestion.statement}
            </div>

            {/* Bento Specs */}
            <div className="space-y-2 pt-1">
              {activeQuestion.inputDescription && (
                <div className="p-3 rounded-xl bg-surface-container-low flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Input Format</span>
                  <p className="text-xs text-on-surface">{activeQuestion.inputDescription}</p>
                </div>
              )}

              {activeQuestion.outputDescription && (
                <div className="p-3 rounded-xl bg-surface-container-low flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Return Format</span>
                  <p className="text-xs text-on-surface">{activeQuestion.outputDescription}</p>
                </div>
              )}

              {activeQuestion.constraints && (
                <div className="p-3 rounded-xl bg-surface-container-low flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Constraints</span>
                  <p className="text-xs text-on-surface font-mono">{activeQuestion.constraints}</p>
                </div>
              )}
            </div>

            {/* Public Examples */}
            {activeQuestion.publicExamples && activeQuestion.publicExamples.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-on-surface">Public Example 1</span>
                <div className="p-3 rounded-xl bg-surface-container-low font-mono text-xs space-y-1.5 border border-surface-container-high/60">
                  <div className="text-on-surface-variant text-[11px]"># Input Data:</div>
                  <div className="text-on-surface font-semibold overflow-x-auto">{activeQuestion.publicExamples[0].stdin}</div>
                  <div className="text-on-surface-variant text-[11px] pt-1"># Expected Output:</div>
                  <div className="text-on-tertiary-container font-bold overflow-x-auto">{activeQuestion.publicExamples[0].expectedOutput}</div>
                </div>
              </div>
            )}

            {/* Hidden Test Notice */}
            <div className="p-3 rounded-xl bg-surface-container flex items-center gap-2.5 text-xs text-on-surface-variant mt-auto">
              <span className="material-symbols-outlined text-[18px] text-secondary flex-shrink-0">lock</span>
              <p className="leading-tight">
                <strong>Private evaluation suites</strong> execute in the isolated grading worker solely upon final submission.
              </p>
            </div>
          </div>

          {/* Right Column: Monaco Python Editor (7 cols) */}
          <div className="lg:col-span-7 bg-dark-ide rounded-2xl border border-slate-800 shadow-md flex flex-col overflow-hidden">
            {/* Editor Chrome Top Bar */}
            <div className="h-10 px-3 sm:px-4 bg-dark-ide-header flex items-center justify-between select-none border-b border-slate-800 text-slate-300">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">terminal</span>
                <span className="font-semibold text-slate-200">solution.py</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">Python 3.12</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Kernel Ready
                </span>
              </div>
            </div>

            {/* Quick Answer Selector for True / False Questions */}
            {(activeQuestion?.constraints?.toLowerCase().includes('true / false') ||
              activeQuestion?.outputDescription?.includes('True') ||
              activeQuestion?.outputDescription?.includes('False')) && (
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-purple-400">check_circle</span>
                  <span>Select Answer:</span>
                </span>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <button
                    type="button"
                    onClick={() => handleCodeChange('print(True)')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 ${
                      currentCode.toLowerCase().includes('true')
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>TRUE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCodeChange('print(False)')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 ${
                      currentCode.toLowerCase().includes('false')
                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>FALSE</span>
                  </button>
                </div>
              </div>
            )}

            {/* Monaco Python Editor Container */}
            <div className="flex-1 w-full min-h-[360px] sm:min-h-[460px] relative bg-dark-ide">
              <Editor
                height="460px"
                language="python"
                theme="vs-dark"
                value={currentCode}
                onChange={handleCodeChange}
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
              <span className="text-emerald-400 font-medium">Syntax Valid</span>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Action Dock */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 border-t border-surface-container-high">
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setFlaggedQuestions((prev) => ({
                  ...prev,
                  [activeQuestion.id]: !prev[activeQuestion.id],
                }));
              }}
              className={`h-11 px-3.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors flex-1 sm:flex-initial ${
                flaggedQuestions[activeQuestion.id]
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-surface-container-high text-on-surface border-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">bookmark</span>
              <span>{flaggedQuestions[activeQuestion.id] ? 'Flagged' : 'Review Later'}</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveQuestionIdx((prev) => Math.max(0, prev - 1))}
                disabled={activeQuestionIdx === 0}
                className="h-11 px-3 rounded-xl bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                <span>Prev</span>
              </button>

              <button
                onClick={() => setActiveQuestionIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={activeQuestionIdx === questions.length - 1}
                className="h-11 px-3 rounded-xl bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.99] transition-all shadow-md ml-auto"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            <span>Submit &amp; Grade Examination</span>
          </button>
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
              Once submitted, all your written Python solutions will be frozen and queued for isolated grading against private test harnesses. You will not be able to modify your answers.
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

function getDefaultStarterCode(title: string): string {
  return `# Python 3.12 Solution for: ${title}
import sys

def solution():
    # Write your solution code here
    pass

if __name__ == '__main__':
    solution()
`;
}
