import React from 'react';
import Link from 'next/link';
import { AttemptCandidate, ExamInfo } from '../types';

interface CandidateTableProps {
  attempts: AttemptCandidate[];
  exam: ExamInfo | null;
  currentTime: Date;
  onSelect: (attemptId: string) => void;
}

export function CandidateTable({
  attempts,
  exam,
  currentTime,
  onSelect,
}: CandidateTableProps) {
  const formatRemainingTime = (deadlineAt: string, status: string) => {
    if (status !== 'in_progress') return null;
    const deadline = new Date(deadlineAt).getTime();
    const now = currentTime.getTime();
    const diff = deadline - now;
    if (diff <= 0) return { text: 'Expired', isUrgent: true };
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return {
      text: `${minutes}m ${seconds.toString().padStart(2, '0')}s`,
      isUrgent: minutes < 10,
    };
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-xs overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-surface-container-low border-b border-surface-container-high text-on-surface-variant font-mono uppercase text-[10px]">
            <th className="py-3 px-4">Candidate</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Trust Index</th>
            <th className="py-3 px-4">Infractions</th>
            <th className="py-3 px-4">Progress</th>
            <th className="py-3 px-4">Timer / Elapsed</th>
            <th className="py-3 px-4">Score</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-high/40">
          {attempts.map((att) => {
            const countdown = formatRemainingTime(att.deadlineAt, att.status);
            const totalQ = exam?.totalQuestions || 1;
            const answeredQ = att.answers.length;

            return (
              <tr key={att.id} className="hover:bg-surface-container/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-bold text-on-surface">{att.student.fullName || 'Anonymous'}</div>
                  <div className="font-mono text-on-surface-variant text-[11px]">{att.student.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      att.status === 'in_progress'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : att.status === 'submitted'
                        ? 'bg-secondary/10 text-secondary'
                        : att.status === 'terminated_suspicious'
                        ? 'bg-error-container text-error'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {att.status}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono">
                  <span
                    className={`font-bold ${
                      att.trustScore < 70
                        ? 'text-error'
                        : att.trustScore < 90
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {att.trustScore}%
                  </span>
                </td>
                <td className="py-3 px-4 font-mono">
                  {att.events.length > 0 ? (
                    <span className="text-error font-semibold">{att.events.length} incidents</span>
                  ) : (
                    <span className="text-emerald-600">0</span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono">
                  {answeredQ} / {totalQ} Qs
                </td>
                <td className="py-3 px-4 font-mono">
                  {countdown ? countdown.text : att.submittedAt ? 'Done' : '—'}
                </td>
                <td className="py-3 px-4 font-mono font-bold">
                  {att.totalMarksAwarded !== null ? `${att.totalMarksAwarded} pts` : '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelect(att.id)}
                      className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary text-xs font-semibold"
                    >
                      Inspect
                    </button>
                    <Link
                      href={`/instructor/attempts/${att.id}`}
                      className="p-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
