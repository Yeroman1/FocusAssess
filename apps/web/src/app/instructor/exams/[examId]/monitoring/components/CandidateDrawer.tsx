import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AttemptCandidate, ExamInfo } from '../types';

interface CandidateDrawerProps {
  selectedAttempt: AttemptCandidate;
  exam: ExamInfo | null;
  onClose: () => void;
  onTerminate: (attempt: AttemptCandidate) => void;
  onReopen: (attempt: AttemptCandidate) => void;
}

export function CandidateDrawer({
  selectedAttempt,
  exam,
  onClose,
  onTerminate,
  onReopen,
}: CandidateDrawerProps) {
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (exam?.questions && exam.questions.length > 0) {
      if (!activeQuestionId || !exam.questions.some((q) => q.id === activeQuestionId)) {
        setActiveQuestionId(exam.questions[0].id);
      }
    }
  }, [exam?.questions, activeQuestionId]);

  const curAnswer = selectedAttempt.answers.find((a) => a.questionId === activeQuestionId);
  const curQuestion = exam?.questions.find((q) => q.id === activeQuestionId);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-surface-container-lowest border-l border-surface-container-high shadow-2xl flex flex-col h-full">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-surface-container-high/60 flex items-center justify-between gap-3 bg-surface-container-low">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-on-surface truncate">
                  {selectedAttempt.student.fullName || 'Candidate Inspection'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedAttempt.status === 'in_progress'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : selectedAttempt.status === 'submitted'
                      ? 'bg-secondary/10 text-secondary'
                      : 'bg-error-container text-error'
                  }`}
                >
                  {selectedAttempt.status}
                </span>
              </div>
              <span className="text-xs text-on-surface-variant font-mono truncate block mt-0.5">
                {selectedAttempt.student.email} • Attempt #{selectedAttempt.id.slice(0, 8)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/instructor/attempts/${selectedAttempt.id}`}
                className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-secondary flex items-center gap-1"
                title="Open dedicated adjudication workspace"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                <span>Full Audit</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Overview Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 p-3 sm:p-4 bg-surface-container-low/50 border-b border-surface-container-high/40 text-center font-mono">
            <div className="bg-surface-container-lowest p-2.5 rounded-xl border border-surface-container-high/60">
              <span className="text-[10px] text-on-surface-variant block uppercase">Trust Score</span>
              <span
                className={`text-lg font-bold block mt-0.5 ${
                  selectedAttempt.trustScore < 70 ? 'text-error' : 'text-emerald-600'
                }`}
              >
                {selectedAttempt.trustScore}%
              </span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl border border-surface-container-high/60">
              <span className="text-[10px] text-on-surface-variant block uppercase">Answers Saved</span>
              <span className="text-lg font-bold text-on-surface block mt-0.5">
                {selectedAttempt.answers.length} / {exam?.totalQuestions || 0}
              </span>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl border border-surface-container-high/60">
              <span className="text-[10px] text-on-surface-variant block uppercase">Total Penalties</span>
              <span className="text-lg font-bold text-error block mt-0.5">
                {selectedAttempt.events.reduce((sum, ev) => sum + ev.penalty, 0)}%
              </span>
            </div>
          </div>

          {/* Drawer Body: Tabs for Live Answers & Telemetry Events */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Live Answer Inspection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary">code</span>
                  <span>Candidate Code by Question</span>
                </h4>
                <span className="text-[11px] font-mono text-on-surface-variant">Live Autosave Feed</span>
              </div>

              {exam?.questions && exam.questions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {exam.questions.map((q, idx) => {
                    const hasAns = selectedAttempt.answers.some((a) => a.questionId === q.id);
                    const isSelected = activeQuestionId === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setActiveQuestionId(q.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-secondary text-white shadow-xs'
                            : hasAns
                            ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                            : 'bg-surface-container-low text-on-surface-variant opacity-60'
                        }`}
                      >
                        <span>Q{idx + 1}</span>
                        <span className="text-[10px] font-mono">({q.maxMarks}m)</span>
                        {hasAns && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Code Display Area */}
              <div className="bg-[#0f172a] rounded-2xl p-4 text-slate-200 border border-slate-800 shadow-inner space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800">
                  <span className="font-semibold text-slate-300">
                    {curQuestion?.title || 'Question Answer'}
                  </span>
                  {curAnswer ? (
                    <span>
                      v{curAnswer.answerVersion} • Saved {new Date(curAnswer.savedAt).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-amber-400">No code submitted for this question yet</span>
                  )}
                </div>

                <pre className="font-mono text-xs overflow-x-auto max-h-[300px] leading-relaxed whitespace-pre-wrap break-all text-slate-100">
                  {curAnswer?.sourceCode || '# Student has not entered code for this question yet.'}
                </pre>
              </div>
            </div>

            {/* Anti-Cheating Telemetry Audit Stream */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-error">security</span>
                  <span>Anti-Cheating Telemetry Audit Log</span>
                </h4>
                <span className="text-[11px] font-mono text-on-surface-variant">
                  {selectedAttempt.events.length} security events
                </span>
              </div>

              {selectedAttempt.events.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">verified</span>
                  <span>Zero security infractions logged. Candidate session remains verified.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {selectedAttempt.events.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high/60 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-error text-[18px] mt-0.5">
                          {ev.eventType.includes('BLUR') || ev.eventType.includes('VISIBILITY')
                            ? 'visibility_off'
                            : ev.eventType.includes('FULLSCREEN')
                            ? 'fullscreen_exit'
                            : 'warning'}
                        </span>
                        <div>
                          <span className="font-mono font-bold text-on-surface">{ev.eventType}</span>
                          {ev.durationMs ? (
                            <span className="text-on-surface-variant font-mono text-[11px] block mt-0.5">
                              Away duration: {(ev.durationMs / 1000).toFixed(1)}s
                            </span>
                          ) : null}
                          {ev.metadata && ev.metadata !== '{}' && (
                            <span className="text-[10px] font-mono text-on-surface-variant block mt-0.5 truncate max-w-sm">
                              {ev.metadata}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 font-mono">
                        <span className="text-error font-bold block">-{ev.penalty}%</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(ev.occurredAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-surface-container-high/60 bg-surface-container-low flex items-center justify-between gap-3">
            {selectedAttempt.status === 'in_progress' ? (
              <button
                type="button"
                onClick={() => onTerminate(selectedAttempt)}
                className="px-4 py-2 rounded-xl bg-error text-white hover:bg-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">block</span>
                <span>Force Terminate Candidate</span>
              </button>
            ) : selectedAttempt.status === 'terminated_suspicious' ? (
              <button
                type="button"
                onClick={() => onReopen(selectedAttempt)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>Reopen Attempt</span>
              </button>
            ) : (
              <span className="text-xs text-on-surface-variant font-mono">Candidate finished examination.</span>
            )}

            <Link
              href={`/instructor/attempts/${selectedAttempt.id}`}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <span>Full Adjudication &amp; Grade Override</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
