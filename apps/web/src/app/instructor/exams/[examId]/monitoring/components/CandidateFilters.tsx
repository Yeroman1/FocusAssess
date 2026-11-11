import React from 'react';
import { AttemptCandidate, MonitoringSummary } from '../types';

interface CandidateFiltersProps {
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  trustFilter: 'all' | 'safe' | 'warning' | 'critical';
  setTrustFilter: (trust: 'all' | 'safe' | 'warning' | 'critical') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'trust_asc' | 'trust_desc' | 'name_asc' | 'progress_desc' | 'deadline_asc' | 'activity_desc';
  setSortBy: (sort: any) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  attempts: AttemptCandidate[];
  summary: MonitoringSummary | null;
}

export function CandidateFilters({
  statusFilter,
  setStatusFilter,
  trustFilter,
  setTrustFilter,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  attempts,
  summary,
}: CandidateFiltersProps) {
  return (
    <div className="flex flex-col gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs">
      {/* Status Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            statusFilter === 'all'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>All Candidates</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-surface-container-high'
            }`}
          >
            {attempts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('in_progress')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            statusFilter === 'in_progress'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Active Taking Exam</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/10">
            {summary?.activeCount || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('submitted')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            statusFilter === 'submitted'
              ? 'bg-secondary text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>Submitted</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-container-high">
            {summary?.submittedCount || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('flagged')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            statusFilter === 'flagged'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">warning</span>
          <span>Flagged / High Risk</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/10">
            {summary?.flaggedCount || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('terminated_suspicious')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            statusFilter === 'terminated_suspicious'
              ? 'bg-error text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>Terminated</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-container-high">
            {summary?.terminatedCount || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('expired')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            statusFilter === 'expired'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span>Expired</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-container-high">
            {summary?.expiredCount || 0}
          </span>
        </button>
      </div>

      {/* Search, Filter & Sorter Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-surface-container-high/40">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, email, or attempt ID..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-secondary placeholder:text-on-surface-variant/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1.5 rounded-xl border border-surface-container-high">
            <span className="text-[11px] font-mono text-on-surface-variant">Trust:</span>
            <select
              value={trustFilter}
              onChange={(e) => setTrustFilter(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="all">All Integrity Levels</option>
              <option value="safe">Clean (90% - 100%)</option>
              <option value="warning">Moderate (70% - 89%)</option>
              <option value="critical">Critical (&lt; 70%)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1.5 rounded-xl border border-surface-container-high">
            <span className="text-[11px] font-mono text-on-surface-variant">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="trust_asc">Risk Priority (Lowest Trust First)</option>
              <option value="trust_desc">Highest Trust First</option>
              <option value="name_asc">Candidate Name (A-Z)</option>
              <option value="progress_desc">Most Questions Answered</option>
              <option value="deadline_asc">Least Time Left</option>
              <option value="activity_desc">Recent Activity</option>
            </select>
          </div>

          <div className="flex items-center bg-surface-container rounded-xl p-1 border border-surface-container-high">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Compact Roster Table View"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">table_rows</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
