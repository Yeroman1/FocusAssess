'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Editor from '@monaco-editor/react';

type QuestionKind =
  | 'TRUE_FALSE'
  | 'MCQ_SINGLE'
  | 'MCQ_MULTI'
  | 'SHORT_ANSWER'
  | 'ROBOT_SIMULATION'
  | 'CODE';

function detectQuestionKind(q: any): QuestionKind {
  const title = (q?.title || '').toLowerCase();
  const statement = (q?.statement || '').toLowerCase();
  const constr = (q?.constraints || '').toLowerCase();

  if (
    title.includes('[true/false]') ||
    title.includes('true/false') ||
    title.includes('true or false') ||
    statement.includes('select true or false') ||
    statement.includes('whether the statement is true or false') ||
    constr.includes('boolean evaluation')
  ) {
    return 'TRUE_FALSE';
  }

  if (
    title.includes('[multi-select]') ||
    title.includes('multi-select') ||
    constr.includes('multiple choice evaluation') && constr.includes('select all')
  ) {
    return 'MCQ_MULTI';
  }

  if (
    title.includes('[mcq]') ||
    title.includes('mcq') ||
    constr.includes('single choice evaluation') ||
    constr.includes('multiple choice evaluation') ||
    statement.includes('which of the following') ||
    statement.includes('select the correct option')
  ) {
    return 'MCQ_SINGLE';
  }

  if (
    title.includes('[output prediction]') ||
    title.includes('output prediction') ||
    title.includes('short answer') ||
    constr.includes('standard output match')
  ) {
    return 'SHORT_ANSWER';
  }

  if (
    title.includes('robot') ||
    title.includes('cs1robots') ||
    statement.includes('cs1robots') ||
    statement.includes('create_world')
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

  const lines = statement.split('\n');
  const optionRegex = /^\s*([A-D])\s*[\)\.\:\-]\s*(.*)$/i;

  const options: McqOption[] = [];
  const promptLines: string[] = [];

  for (const line of lines) {
    const match = line.match(optionRegex);
    if (match) {
      options.push({
        letter: match[1].toUpperCase(),
        text: match[2].trim(),
      });
    } else if (options.length === 0) {
      promptLines.push(line);
    }
  }

  return {
    prompt: options.length > 0 ? promptLines.join('\n').trim() : statement,
    options,
  };
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

export default function InstructorExamPreviewPage() {
  return (
    <ProtectedRoute allowedRoles={['instructor', 'admin']}>
      <InstructorExamPreviewContent />
    </ProtectedRoute>
  );
}

function InstructorExamPreviewContent() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({});
  const [seenQuestions, setSeenQuestions] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'both' | 'statement' | 'editor'>('both');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [showSolutionKey, setShowSolutionKey] = useState(false);

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

  // Fetch exam questions for preview
  useEffect(() => {
    setIsLoading(true);
    fetchWithAuth(`/exams/${examId}`)
      .then((data) => {
        if (!data?.exam) {
          throw new Error('Examination not found');
        }
        setExam(data.exam);

        const currentVersion = data.exam.versions?.[0];
        const loadedQuestions = currentVersion?.questions || [];
        setQuestions(loadedQuestions);

        if (loadedQuestions.length > 0) {
          setSeenQuestions({ [loadedQuestions[0].id]: true });
          const initialAnswers: Record<string, string> = {};
          loadedQuestions.forEach((q: any) => {
            const kind = detectQuestionKind(q);
            if (kind === 'CODE' || kind === 'ROBOT_SIMULATION') {
              initialAnswers[q.id] = getDefaultStarterCode(q.title);
            } else {
              initialAnswers[q.id] = '';
            }
          });
          setCodeAnswers(initialAnswers);
        }
      })
      .catch((err) => {
        console.error('Failed to load exam preview:', err);
        setLoadError(err.message || 'Unable to load examination for preview.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [examId]);

  // Track seen questions whenever activeQuestion changes
  useEffect(() => {
    if (questions[activeQuestionIdx]?.id) {
      const qId = questions[activeQuestionIdx].id;
      setSeenQuestions((prev) => {
        if (prev[qId]) return prev;
        return { ...prev, [qId]: true };
      });
    }
  }, [activeQuestionIdx, questions]);

  const activeQuestion = questions[activeQuestionIdx] || null;
  const activeKind: QuestionKind = activeQuestion ? detectQuestionKind(activeQuestion) : 'CODE';

  const mcqParsed = useMemo(() => {
    if (activeQuestion && (activeKind === 'MCQ_SINGLE' || activeKind === 'MCQ_MULTI')) {
      return parseMcq(activeQuestion.statement);
    }
    return { prompt: activeQuestion?.statement || '', options: [] };
  }, [activeKind, activeQuestion]);

  const currentAnswer = activeQuestion ? codeAnswers[activeQuestion.id] || '' : '';

  const handleAnswerChange = (val: string) => {
    if (!activeQuestion) return;
    setCodeAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: val,
    }));
  };

  // 3-state board counters
  const completedCount = questions.filter((q) => isQuestionCompleted(q, codeAnswers[q.id])).length;
  const seenCount = questions.filter(
    (q) => seenQuestions[q.id] && !isQuestionCompleted(q, codeAnswers[q.id])
  ).length;
  const unseenCount = Math.max(0, questions.length - completedCount - seenCount);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-on-surface-variant font-semibold">
            Loading candidate exam preview...
          </span>
        </div>
      </div>
    );
  }

  if (loadError || !activeQuestion) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-error-container text-error flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[28px]">visibility_off</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-on-surface">Unable to Preview Exam</h1>
            <p className="text-xs text-on-surface-variant mt-1">
              {loadError || 'This examination has no questions added yet. Add questions in the builder first.'}
            </p>
          </div>
          <Link
            href={`/instructor/exams/${examId}/builder`}
            className="inline-flex items-center justify-center w-full h-10 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Open Question Builder
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans select-none w-full max-w-full overflow-x-hidden overflow-x-clip">
      {/* Pinned Instructor Preview Master Banner */}
      <div className="bg-indigo-950 text-indigo-100 border-b border-indigo-800/80 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs font-mono select-none sticky top-0 z-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded bg-amber-400 text-indigo-950 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
            <span className="material-symbols-outlined text-[14px]">visibility</span>
            Instructor Preview
          </span>
          <span className="hidden md:inline text-indigo-200 truncate">
            Visualizing candidate view for: <strong className="text-white">{exam?.title}</strong>
          </span>
          <span className="hidden lg:inline text-indigo-400 text-[11px]">
            • Telemetry Inactive • Unlimited Previews
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Solution Rubric Toggle */}
          <button
            type="button"
            onClick={() => setShowSolutionKey((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
              showSolutionKey
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                : 'bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 border-indigo-700'
            }`}
            title="Toggle display of author solution and evaluation test cases"
          >
            <span className="material-symbols-outlined text-[15px]">
              {showSolutionKey ? 'check_circle' : 'key'}
            </span>
            <span>{showSolutionKey ? 'Rubric Visible' : 'Show Answer Key'}</span>
          </button>

          {/* Quick return to builder */}
          <Link
            href={`/instructor/exams/${examId}/builder`}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1 border border-white/20"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span className="hidden sm:inline">Edit in Builder</span>
          </Link>

          {/* Close preview */}
          <Link
            href="/instructor/dashboard"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Exit Preview to Dashboard"
          >
            ✕
          </Link>
        </div>
      </div>

      {/* Candidate-Facing Sub-Header (Identical to Student View) */}
      <header className="bg-surface/95 backdrop-blur-md border-b border-surface-container-high px-3 sm:px-4 md:px-8 py-2 sm:py-2.5 shadow-sm w-full max-w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Brand & Mode Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="font-bold text-sm sm:text-base text-on-surface">FocusAssess</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-xs font-mono font-bold border border-secondary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span>Preview Mode</span>
            </span>
            <span className="text-xs font-mono text-on-surface-variant hidden md:inline">
              Autosave in Local State
            </span>
          </div>

          {/* Simulated Candidate Trust Score & Duration */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-tertiary-fixed text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span>Trust 100%</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider bg-primary-container text-primary-fixed">
              <span className="material-symbols-outlined text-[15px]">timer</span>
              <span>{exam?.durationMinutes || 90}:00</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full max-w-full px-3 sm:px-4 md:px-8 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4 min-w-0 overflow-x-hidden overflow-x-clip">
        {/* Top Question Number Board with 3-State Color Indicators */}
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
              <span className="text-secondary font-semibold">({activeQuestion.maxMarks || 0} pts)</span>
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
            {activeQuestion?.imageUrl && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[12px]">image</span>
                Photo
              </span>
            )}
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

        {/* 2-Column Split: Problem Statement (Left) + Answering Interface (Right) */}
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
                      Short Answer
                    </span>
                  )}
                  {activeKind === 'ROBOT_SIMULATION' && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">smart_toy</span>
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

            {/* Question Attached Photo / Diagram (Visual Problem Reference) */}
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

            {/* Problem Statement Prose */}
            <div className="text-xs md:text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
              {activeKind === 'MCQ_SINGLE' || activeKind === 'MCQ_MULTI'
                ? mcqParsed.prompt
                : activeQuestion.statement}
            </div>

            {/* Input & Return Format */}
            <div className="space-y-2 pt-1">
              {activeQuestion.inputDescription && (
                <div className="p-3 rounded-xl bg-surface-container-low flex flex-col space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">
                    Input Specification
                  </span>
                  <p className="text-xs text-on-surface">{activeQuestion.inputDescription}</p>
                </div>
              )}

              {activeQuestion.outputDescription && (
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

            {/* Teacher Rubric Overlay (Only visible in Preview when toggled on) */}
            {showSolutionKey && activeQuestion.testCases && activeQuestion.testCases.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 space-y-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <span className="material-symbols-outlined text-[16px]">key</span>
                  <span>Teacher Solution Key &amp; Rubric:</span>
                </div>
                {activeQuestion.testCases.map((tc: any, i: number) => (
                  <div key={tc.id || i} className="p-2 rounded-lg bg-white/80 dark:bg-slate-900 border border-emerald-500/30 space-y-1">
                    <div className="flex justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      <span>Evaluation Case #{i + 1} ({tc.marks} marks)</span>
                      <span>{tc.isHidden ? 'Hidden Private' : 'Public Example'}</span>
                    </div>
                    {tc.stdin && (
                      <div className="text-[11px] text-slate-700 dark:text-slate-300">
                        <strong>Input:</strong> {tc.stdin}
                      </div>
                    )}
                    <div className="text-[11px] text-emerald-900 dark:text-emerald-200">
                      <strong>Expected Output / Choice:</strong> {tc.expectedOutput}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

            {/* 5. PYTHON CODING & ROBOT SIMULATION: Monaco Python Editor */}
            {(activeKind === 'CODE' || activeKind === 'ROBOT_SIMULATION') && (
              <div className="w-full max-w-full min-w-0 bg-dark-ide rounded-2xl border border-slate-800 shadow-md flex flex-col overflow-hidden">
                {/* Editor Top Bar */}
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
                    {activeQuestion?.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setSelectedImageModal(activeQuestion.imageUrl)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition-colors"
                        title="Click to view attached question diagram"
                      >
                        <span className="material-symbols-outlined text-[15px]">image</span>
                        <span>View Diagram</span>
                      </button>
                    )}
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Preview Ready
                    </span>
                  </div>
                </div>

                {/* Monaco Editor Component */}
                <div className="w-full min-h-[360px] sm:min-h-[440px] lg:min-h-[520px] bg-dark-ide">
                  <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={currentAnswer}
                    onChange={(val) => handleAnswerChange(val || '')}
                    options={{
                      fontSize: 13,
                      lineNumbers: 'on',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      tabSize: 4,
                      automaticLayout: true,
                      wordWrap: 'on',
                      renderWhitespace: 'selection',
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                </div>

                {/* Editor Footer */}
                <div className="px-3 sm:px-4 py-2 bg-dark-ide-footer text-slate-400 flex items-center justify-between text-xs font-mono border-t border-slate-800">
                  <div className="flex items-center gap-3">
                    <span>UTF-8</span>
                    <span>Spaces: 4</span>
                    <span className="hidden sm:inline">Preview Mode (Changes Stored Locally)</span>
                  </div>
                  <span className="text-indigo-400 font-medium">Instructor Testing</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Interactive Navigation Dock */}
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

            {/* Right Controls: Reset Test Answers & Return to Builder */}
            <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear all your temporary preview answers to test from scratch?')) {
                    const reset: Record<string, string> = {};
                    questions.forEach((q) => {
                      const kind = detectQuestionKind(q);
                      reset[q.id] = (kind === 'CODE' || kind === 'ROBOT_SIMULATION')
                        ? getDefaultStarterCode(q.title)
                        : '';
                    });
                    setCodeAnswers(reset);
                    setFlaggedQuestions({});
                    setSeenQuestions({ [questions[0].id]: true });
                  }
                }}
                className="px-3.5 h-11 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors flex items-center gap-1.5 border border-surface-container-high"
                title="Clear temporary answers to test again"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span className="hidden sm:inline">Reset Answers</span>
              </button>

              <Link
                href={`/instructor/exams/${examId}/builder`}
                className="w-full sm:w-auto h-11 px-5 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.99] transition-all shadow-md ml-auto"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Exit Preview to Builder</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Fullscreen High-Resolution Image Lightbox Modal */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setSelectedImageModal(null)}
        >
          {/* Top Bar */}
          <div
            className="w-full max-w-5xl flex items-center justify-between pb-3 text-white px-2 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-amber-400">image</span>
              <span className="text-sm font-semibold">
                Question Diagram: {activeQuestion?.title || `Problem ${activeQuestionIdx + 1}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60 font-mono hidden sm:inline">
                Press Esc or click outside to close
              </span>
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Full-resolution Image Frame */}
          <div
            className="max-w-5xl max-h-[85vh] w-full flex items-center justify-center overflow-auto p-2 bg-slate-950/80 rounded-2xl border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImageModal}
              alt="Full size question diagram"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg"
            />
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
          Click your chosen response below. Testing in candidate view.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto w-full pt-2">
        <button
          type="button"
          onClick={() => onChange('True')}
          className={`p-6 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 select-none active:scale-[0.98] ${
            isTrue
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-600 shadow-md ring-2 ring-purple-500/30'
              : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isTrue
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[28px]">check</span>
          </div>
          <span
            className={`text-lg font-bold tracking-tight ${
              isTrue ? 'text-purple-700 dark:text-purple-300' : 'text-on-surface'
            }`}
          >
            TRUE
          </span>
          <span className="text-[11px] font-mono text-on-surface-variant">Statement is correct</span>
        </button>

        <button
          type="button"
          onClick={() => onChange('False')}
          className={`p-6 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 select-none active:scale-[0.98] ${
            isFalse
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-600 shadow-md ring-2 ring-purple-500/30'
              : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isFalse
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[28px]">close</span>
          </div>
          <span
            className={`text-lg font-bold tracking-tight ${
              isFalse ? 'text-purple-700 dark:text-purple-300' : 'text-on-surface'
            }`}
          >
            FALSE
          </span>
          <span className="text-[11px] font-mono text-on-surface-variant">Statement is incorrect</span>
        </button>
      </div>

      <div className="text-center text-xs font-mono text-on-surface-variant pt-2">
        {isTrue || isFalse ? (
          <span>
            Selected:{' '}
            <strong className="text-purple-600 font-bold">{isTrue ? 'TRUE' : 'FALSE'}</strong>
          </span>
        ) : (
          <span>No response selected yet</span>
        )}
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
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-surface-container-high text-on-surface border border-surface-container-highest'
                }`}
              >
                {opt.letter}
              </div>

              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isSelected ? 'font-semibold text-blue-900 dark:text-blue-200' : 'text-on-surface'
                  }`}
                >
                  {opt.text}
                </span>
              </div>

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
            <strong className="text-blue-600 font-bold">Option {selectedLetter}</strong>
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
  const selectedLetters = useMemo(() => {
    if (!value) return [];
    return value
      .split(/[,;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [value]);

  const toggleOption = (letter: string) => {
    const uppercaseLetter = letter.toUpperCase();
    let updated: string[];
    if (selectedLetters.includes(uppercaseLetter)) {
      updated = selectedLetters.filter((l) => l !== uppercaseLetter);
    } else {
      updated = [...selectedLetters, uppercaseLetter].sort();
    }
    onChange(updated.join(', '));
  };

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
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 border border-amber-500/20">
            <span className="material-symbols-outlined text-[15px]">checklist</span>
            Multi-Select Question
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
            Clear all ({selectedLetters.length})
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
              onClick={() => toggleOption(opt.letter)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer active:scale-[0.99] select-none ${
                isSelected
                  ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-600 shadow-sm ring-2 ring-amber-500/20'
                  : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-surface-container-high text-on-surface border border-surface-container-highest'
                }`}
              >
                {isSelected ? '✓' : opt.letter}
              </div>

              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isSelected ? 'font-semibold text-amber-900 dark:text-amber-200' : 'text-on-surface'
                  }`}
                >
                  {opt.text}
                </span>
              </div>

              <span className="text-[11px] font-mono font-bold text-on-surface-variant px-1.5 py-0.5 rounded bg-surface-container">
                Option {opt.letter}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-2 text-center text-xs font-mono text-on-surface-variant">
        {selectedLetters.length > 0 ? (
          <span>
            Selected Options:{' '}
            <strong className="text-amber-600 font-bold">
              {selectedLetters.join(', ')}
            </strong>{' '}
            ({selectedLetters.length} selected)
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
        <span>Candidate view testing mode.</span>
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

