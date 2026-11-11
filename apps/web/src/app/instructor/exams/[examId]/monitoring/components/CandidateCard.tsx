import React from 'react';
import Link from 'next/link';
import { AttemptCandidate, ExamInfo } from '../types';

interface CandidateCardProps {
  attempt: AttemptCandidate;
  exam: ExamInfo | null;
  currentTime: Date;
  onSelect: (attemptId: string) => void;
  onTerminate: (attempt: AttemptCandidate) => void;
  onReopen: (attempt: AttemptCandidate) => void;
}

export function CandidateCard({
  attempt,
  exam,
  currentTime,
  onSelect,
  onTerminate,
  onReopen,
}: CandidateCardProps) {
  const totalQ = exam?.totalQuestions || 1;
  const answeredQ = attempt.answers.length;
  const progressPct = Math.min(100, Math.round((answeredQ / totalQ) * 100));
  const isTerminated = attempt.status === 'terminated_suspicious';
  const isFlagged = attempt.trustScore < 70 || isTerminated;

  // Countdown computation
  const getCountdown = () => {
    if (attempt.status !== 'in_progress') return null;
    const deadline = new Date(attempt.deadlineAt).getTime();
    const now = currentTime.getTime();
    const diff = deadline - now;
    if (diff <= 0) return { text: 'Time Expired', isUrgent: true };
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return {
      text: `${minutes}m ${seconds.toString().padStart(2, '0')}s remaining`,
      isUrgent: minutes < 10,
    };
  };

  const countdown = getCountdown();

  // Time taken computation
  const getTimeTaken = () => {
    if (!attempt.submittedAt) return null;
    const diff = new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime();
    if (diff <= 0) return '0m';
    return `${Math.round(diff / (1000 * 60))} mins taken`;
  };

  const timeTaken = getTimeTaken();

  return (
    <div
      className={`bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-sm ${
        isTerminated
          ? 'border-error/40 bg-error/5'
          : isFlagged
          ? 'border-rose-500/40 bg-rose-500/5'
          : attempt.status === 'in_progress'
          ? 'border-emerald-500/30 hover:border-emerald-500/60'
          : 'border-surface-container-high/60 hover:border-surface-container-high'
      }`}
    >
      <div>
        {/* Candidate Profile & Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center font-bold text-xs text-on-surface font-mono flex-shrink-0">
              {attempt.student.fullName
                ? attempt.student.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : attempt.student.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-on-surface truncate">
                {attempt.student.fullName || 'Anonymous Candidate'}
              </h4>
              <span className="text-xs text-on-surface-variant font-mono truncate block">
                {attempt.student.email}
              </span>
            </div>
          </div>

          <div>
            {attempt.status === 'in_progress' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>WRITING</span>
              </span>
            )}
            {attempt.status === 'submitted' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                <span>SUBMITTED</span>
              </span>
            )}
            {attempt.status === 'terminated_suspicious' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-error-container text-error border border-error/20">
                <span className="material-symbols-outlined text-[13px]">block</span>
                <span>TERMINATED</span>
              </span>
            )}
            {attempt.status === 'expired' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-surface-container text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]">timer_off</span>
                <span>EXPIRED</span>
              </span>
            )}
          </div>
        </div>

        {/* Trust Score & Infraction Indicators */}
        <div className="mt-3.5 pt-3 border-t border-surface-container-high/40 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-mono text-on-surface-variant block">Integrity Trust</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-base font-bold font-mono ${
                  attempt.trustScore < 70
                    ? 'text-error'
                    : attempt.trustScore < 90
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {attempt.trustScore}%
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  attempt.trustScore < 70
                    ? 'bg-error-container text-error'
                    : attempt.trustScore < 90
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {attempt.trustScore < 70 ? 'CRITICAL' : attempt.trustScore < 90 ? 'WARNING' : 'CLEAN'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant block">Infractions</span>
            <div className="flex items-center gap-1 justify-end mt-0.5 font-mono text-xs">
              {attempt.events.length > 0 ? (
                <span className="text-error font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  {attempt.events.length} logged
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  0 incidents
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar & Question Micro-chips */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-on-surface-variant text-[11px]">Questions Answered:</span>
            <span className="font-semibold text-on-surface">
              {answeredQ} / {totalQ} ({progressPct}%)
            </span>
          </div>
          <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden flex">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-secondary' : 'bg-surface-container'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {exam?.questions && exam.questions.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {exam.questions.map((q, idx) => {
                const isAnswered = attempt.answers.some((ans) => ans.questionId === q.id);
                return (
                  <span
                    key={q.id}
                    title={`${q.title}: ${isAnswered ? 'Answer saved' : 'Not answered'}`}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold transition-colors ${
                      isAnswered ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    Q{idx + 1}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Timing Countdown */}
        <div className="mt-3.5 pt-2.5 border-t border-surface-container-high/40 flex items-center justify-between text-xs font-mono">
          {attempt.status === 'in_progress' && countdown && (
            <div
              className={`flex items-center gap-1.5 ${
                countdown.isUrgent ? 'text-error font-bold animate-pulse' : 'text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              <span>{countdown.text}</span>
            </div>
          )}

          {attempt.status === 'submitted' && (
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>{timeTaken || 'Submitted'}</span>
            </div>
          )}

          {attempt.status === 'terminated_suspicious' && (
            <div className="text-error truncate max-w-[200px]" title={attempt.terminationReason || 'Terminated'}>
              Reason: {attempt.terminationReason || 'Suspicious proctor event'}
            </div>
          )}

          {attempt.totalMarksAwarded !== null && (
            <span className="font-bold text-secondary">
              Score: {attempt.totalMarksAwarded} / {exam?.totalMaxMarks || attempt.maxMarksTotal}
            </span>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="mt-4 pt-3 border-t border-surface-container-high/40 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect(attempt.id)}
          className="flex-1 py-1.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-secondary hover:text-primary transition-colors flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[16px]">terminal</span>
          <span>Inspect Live</span>
        </button>

        <Link
          href={`/instructor/attempts/${attempt.id}`}
          className="py-1.5 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          title="Open full adjudication & audit page"
        >
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        </Link>

        {attempt.status === 'in_progress' ? (
          <button
            type="button"
            onClick={() => onTerminate(attempt)}
            className="py-1.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-error transition-colors"
            title="Force terminate this candidate immediately"
          >
            <span className="material-symbols-outlined text-[16px]">gavel</span>
          </button>
        ) : isTerminated ? (
          <button
            type="button"
            onClick={() => onReopen(attempt)}
            className="py-1.5 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition-colors"
            title="Reopen candidate attempt"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
