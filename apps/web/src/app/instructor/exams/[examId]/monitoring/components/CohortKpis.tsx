import React from 'react';
import { MonitoringSummary, ExamInfo } from '../types';

interface CohortKpisProps {
  summary: MonitoringSummary | null;
  exam: ExamInfo | null;
}

export function CohortKpis({ summary, exam }: CohortKpisProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {/* Active Writing Card */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Active Writing</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {summary ? summary.activeCount : '—'}
          </span>
          <span className="text-xs text-on-surface-variant font-mono">students</span>
        </div>
        <span className="text-[11px] text-on-surface-variant block mt-1">Currently taking exam</span>
      </div>

      {/* Total Candidates Registered */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Total Roster</span>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">group</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">
            {summary ? summary.totalCandidates : '—'}
          </span>
          <span className="text-xs text-on-surface-variant font-mono">total</span>
        </div>
        <span className="text-[11px] text-on-surface-variant block mt-1">Candidate attempts initiated</span>
      </div>

      {/* Completed Submissions */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Completed</span>
          <span className="material-symbols-outlined text-secondary text-[18px]">task_alt</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-secondary font-mono">
            {summary ? summary.submittedCount : '—'}
          </span>
          <span className="text-xs text-on-surface-variant font-mono">submitted</span>
        </div>
        <span className="text-[11px] text-on-surface-variant block mt-1">Final papers turned in</span>
      </div>

      {/* Integrity Suspicious / Flagged */}
      <div
        className={`p-4 rounded-2xl border shadow-xs transition-colors ${
          summary && summary.flaggedCount > 0
            ? 'bg-rose-500/10 border-rose-500/30'
            : 'bg-surface-container-lowest border-surface-container-high/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-rose-700 dark:text-rose-400">
            Suspicious / Flagged
          </span>
          <span className="material-symbols-outlined text-error text-[18px]">warning</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`text-2xl sm:text-3xl font-bold font-mono ${
              summary && summary.flaggedCount > 0 ? 'text-error' : 'text-on-surface'
            }`}
          >
            {summary ? summary.flaggedCount : '—'}
          </span>
          <span className="text-xs text-on-surface-variant font-mono">at risk</span>
        </div>
        <span className="text-[11px] text-on-surface-variant block mt-1">Trust &lt; 70% or terminated</span>
      </div>

      {/* Cohort Average Trust Index */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Cohort Trust Index</span>
          <span className="material-symbols-outlined text-secondary text-[18px]">shield</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`text-2xl sm:text-3xl font-bold font-mono ${
              (summary?.averageTrustScore ?? 100) < 70
                ? 'text-error'
                : (summary?.averageTrustScore ?? 100) < 90
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {summary ? `${summary.averageTrustScore}%` : '—'}
          </span>
        </div>
        <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              (summary?.averageTrustScore ?? 100) < 70
                ? 'bg-error'
                : (summary?.averageTrustScore ?? 100) < 90
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${summary?.averageTrustScore || 0}%` }}
          />
        </div>
      </div>

      {/* Average Cohort Score */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant">Average Score</span>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">analytics</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-on-surface font-mono">
            {summary ? `${summary.averageScore}` : '—'}
          </span>
          <span className="text-xs text-on-surface-variant font-mono">/ {exam?.totalMaxMarks || 100}</span>
        </div>
        <span className="text-[11px] text-on-surface-variant block mt-1">From submitted papers</span>
      </div>
    </div>
  );
}
