'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fetchWithAuth } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import {
  AttemptCandidate,
  ExamInfo,
  MonitoringSummary,
} from './types';
import { playSecurityAlertSound } from './utils/soundAlert';
import { exportCohortCSV } from './utils/exportCsv';
import { CohortKpis } from './components/CohortKpis';
import { CandidateFilters } from './components/CandidateFilters';
import { CandidateCard } from './components/CandidateCard';
import { CandidateTable } from './components/CandidateTable';
import { CandidateDrawer } from './components/CandidateDrawer';
import { TerminateModal } from './components/TerminateModal';
import { ReopenModal } from './components/ReopenModal';

export default function InstructorExamMonitoringPage() {
  return (
    <ProtectedRoute allowedRoles={['instructor', 'admin']}>
      <InstructorExamMonitoringContent />
    </ProtectedRoute>
  );
}

function InstructorExamMonitoringContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  // Server state
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [attempts, setAttempts] = useState<AttemptCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time telemetry sync state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds
  const [secondsUntilNext, setSecondsUntilNext] = useState(5);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trustFilter, setTrustFilter] = useState<'all' | 'safe' | 'warning' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'trust_asc' | 'trust_desc' | 'name_asc' | 'progress_desc' | 'deadline_asc' | 'activity_desc'
  >('trust_asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Slide-over candidate inspector drawer
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  // Proctor Actions Modals
  const [terminatingAttempt, setTerminatingAttempt] = useState<AttemptCandidate | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [isSubmittingTerminate, setIsSubmittingTerminate] = useState(false);

  const [reopeningAttempt, setReopeningAttempt] = useState<AttemptCandidate | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenTrustScore, setReopenTrustScore] = useState(85);
  const [isSubmittingReopen, setIsSubmittingReopen] = useState(false);

  const [entryToggleLoading, setEntryToggleLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Track flagged count to trigger sound alarm when new candidate gets flagged
  const prevFlaggedCountRef = useRef<number>(0);

  // Load telemetry data from backend
  const loadMonitoringData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setIsSyncing(true);
      try {
        const data = await fetchWithAuth(`/instructor/exams/${examId}/monitoring`);
        if (data.exam) setExam(data.exam);
        if (data.summary) {
          setSummary(data.summary);
          if (
            soundAlerts &&
            prevFlaggedCountRef.current > 0 &&
            data.summary.flaggedCount > prevFlaggedCountRef.current
          ) {
            playSecurityAlertSound();
          }
          prevFlaggedCountRef.current = data.summary.flaggedCount;
        }
        if (Array.isArray(data.attempts)) {
          setAttempts(data.attempts);
        }
        setLastSyncedAt(new Date());
        setError(null);
      } catch (err: any) {
        console.error('Monitoring telemetry fetch failed:', err);
        if (!isBackground) {
          setError(err.message || 'Failed to sync monitoring telemetry');
        }
      } finally {
        setLoading(false);
        setIsSyncing(false);
        setSecondsUntilNext(refreshInterval);
      }
    },
    [examId, refreshInterval, soundAlerts]
  );

  // Initial load
  useEffect(() => {
    loadMonitoringData(false);
  }, [loadMonitoringData]);

  // Clock tick every 1000ms for live deadline countdowns and next-sync countdown
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
      if (autoRefresh) {
        setSecondsUntilNext((prev) => {
          if (prev <= 1) {
            loadMonitoringData(true);
            return refreshInterval;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [autoRefresh, refreshInterval, loadMonitoringData]);

  // Find currently selected candidate for inspection drawer
  const selectedAttempt = useMemo(() => {
    if (!selectedAttemptId) return null;
    return attempts.find((a) => a.id === selectedAttemptId) || null;
  }, [attempts, selectedAttemptId]);

  // Close / Reopen Entry Action
  const handleToggleEntry = async () => {
    if (!exam) return;
    const isPublished = exam.status === 'published';
    const action = isPublished ? 'close' : 'reopen';
    const confirmMessage = isPublished
      ? 'Lock examination entry? New candidates will NOT be allowed to start, but students currently writing can still finish.'
      : 'Reopen examination entry? New candidates with the access key will be permitted to start.';

    if (!window.confirm(confirmMessage)) return;

    setEntryToggleLoading(true);
    setActionNotice(null);
    try {
      await fetchWithAuth(`/exams/${exam.id}/${action}`, { method: 'POST' });
      setExam((prev) => (prev ? { ...prev, status: isPublished ? 'closed' : 'published' } : null));
      setActionNotice({
        type: 'success',
        message: isPublished ? 'Examination entry locked successfully.' : 'Examination entry reopened successfully.',
      });
      loadMonitoringData(true);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: `Failed to toggle entry: ${err.message}`,
      });
    } finally {
      setEntryToggleLoading(false);
    }
  };

  // Force Terminate candidate attempt
  const handleConfirmTerminate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminatingAttempt) return;

    setIsSubmittingTerminate(true);
    try {
      await fetchWithAuth(`/instructor/attempts/${terminatingAttempt.id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({
          reason: terminateReason || 'Terminated by instructor due to proctoring policy violation',
        }),
      });
      setActionNotice({
        type: 'success',
        message: `Candidate ${
          terminatingAttempt.student.fullName || terminatingAttempt.student.email
        } has been terminated.`,
      });
      setTerminatingAttempt(null);
      setTerminateReason('');
      await loadMonitoringData(false);
    } catch (err: any) {
      alert(`Failed to terminate candidate: ${err.message}`);
    } finally {
      setIsSubmittingTerminate(false);
    }
  };

  // Reopen candidate attempt
  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopeningAttempt) return;

    setIsSubmittingReopen(true);
    try {
      await fetchWithAuth(`/instructor/attempts/${reopeningAttempt.id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reopenReason || 'Restored following instructor telemetry review',
          restoredTrustScore: Number(reopenTrustScore) || 80,
        }),
      });
      setActionNotice({
        type: 'success',
        message: `Candidate ${
          reopeningAttempt.student.fullName || reopeningAttempt.student.email
        } attempt reopened.`,
      });
      setReopeningAttempt(null);
      setReopenReason('');
      await loadMonitoringData(false);
    } catch (err: any) {
      alert(`Failed to reopen attempt: ${err.message}`);
    } finally {
      setIsSubmittingReopen(false);
    }
  };

  // Filtered & Sorted candidate attempts
  const filteredAttempts = useMemo(() => {
    return attempts
      .filter((att) => {
        // Status filter
        if (statusFilter === 'in_progress' && att.status !== 'in_progress') return false;
        if (statusFilter === 'submitted' && att.status !== 'submitted') return false;
        if (statusFilter === 'terminated_suspicious' && att.status !== 'terminated_suspicious') return false;
        if (statusFilter === 'expired' && att.status !== 'expired') return false;
        if (statusFilter === 'flagged' && att.trustScore >= 70 && att.status !== 'terminated_suspicious')
          return false;

        // Trust risk filter
        if (trustFilter === 'safe' && att.trustScore < 90) return false;
        if (trustFilter === 'warning' && (att.trustScore < 70 || att.trustScore >= 90)) return false;
        if (trustFilter === 'critical' && att.trustScore >= 70) return false;

        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const name = (att.student.fullName || '').toLowerCase();
          const email = (att.student.email || '').toLowerCase();
          const id = att.id.toLowerCase();
          if (!name.includes(query) && !email.includes(query) && !id.includes(query)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'trust_asc') return a.trustScore - b.trustScore;
        if (sortBy === 'trust_desc') return b.trustScore - a.trustScore;
        if (sortBy === 'name_asc') {
          const nameA = a.student.fullName || a.student.email;
          const nameB = b.student.fullName || b.student.email;
          return nameA.localeCompare(nameB);
        }
        if (sortBy === 'progress_desc') return b.answers.length - a.answers.length;
        if (sortBy === 'deadline_asc') return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
        if (sortBy === 'activity_desc') {
          const lastA = a.answers[0]?.savedAt ? new Date(a.answers[0].savedAt).getTime() : 0;
          const lastB = b.answers[0]?.savedAt ? new Date(b.answers[0].savedAt).getTime() : 0;
          return lastB - lastA;
        }
        return 0;
      });
  }, [attempts, statusFilter, trustFilter, searchQuery, sortBy]);

  return (
    <DashboardLayout
      portalRole="instructor"
      title={exam ? `Live Monitoring: ${exam.title}` : 'Exam Telemetry Mission Control'}
      subtitle="Real-time candidate telemetry, live answers, trust scores, and anti-cheating intervention"
    >
      <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-full min-w-0 pb-16">
        {/* Navigation Breadcrumbs & Master Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high/60 shadow-xs">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono">
              <Link href="/instructor/dashboard" className="hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Dashboard</span>
              </Link>
              <span>/</span>
              <span className="truncate max-w-[200px] sm:max-w-xs">{exam?.title || 'Loading exam...'}</span>
              <span>/</span>
              <span className="text-secondary font-bold">Live Radar</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-on-surface flex items-center gap-2">
                <span>{exam?.title || 'Examination Telemetry'}</span>
                {exam && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold uppercase ${
                      exam.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : exam.status === 'closed'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {exam.status === 'published' ? 'Entry Open' : exam.status === 'closed' ? 'Entry Locked' : exam.status}
                  </span>
                )}
              </h1>

              {/* Pulsing Live Radar Beacon */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${
                      !autoRefresh && 'hidden'
                    }`}
                  ></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{autoRefresh ? 'RADAR ACTIVE' : 'RADAR PAUSED'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-on-surface-variant font-mono mt-0.5 flex-wrap">
              <span>Duration: <b className="text-on-surface">{exam?.durationMinutes || 0} mins</b></span>
              <span>Questions: <b className="text-on-surface">{exam?.totalQuestions || 0}</b></span>
              <span>Total Marks: <b className="text-on-surface">{exam?.totalMaxMarks || 0}</b></span>
              {lastSyncedAt && (
                <span className="text-slate-400">Last synced: {lastSyncedAt.toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          {/* Master Action Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start md:justify-end">
            {/* Auto-Refresh Toggle */}
            <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1 border border-surface-container-high">
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh ? 'Pause auto-sync' : 'Resume auto-sync'}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  autoRefresh
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {autoRefresh ? 'pause' : 'play_arrow'}
                </span>
                <span>{autoRefresh ? `${secondsUntilNext}s` : 'Paused'}</span>
              </button>

              <select
                value={refreshInterval}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRefreshInterval(val);
                  setSecondsUntilNext(val);
                }}
                disabled={!autoRefresh}
                className="bg-transparent text-xs font-mono text-on-surface pr-1 pl-1 py-1 focus:outline-none disabled:opacity-50 cursor-pointer"
                title="Telemetry refresh frequency"
              >
                <option value={3}>3s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
            </div>

            {/* Manual Sync */}
            <button
              type="button"
              onClick={() => loadMonitoringData(false)}
              disabled={isSyncing}
              title="Force reload telemetry"
              className="p-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl border border-surface-container-high text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin text-primary' : ''}`}>
                sync
              </span>
            </button>

            {/* Sound Alerts */}
            <button
              type="button"
              onClick={() => setSoundAlerts(!soundAlerts)}
              title={soundAlerts ? 'Sound alarms enabled for security infractions' : 'Sound alarms muted'}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors ${
                soundAlerts
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                  : 'bg-surface-container border-surface-container-high text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {soundAlerts ? 'notifications_active' : 'notifications_off'}
              </span>
            </button>

            {/* Entry Lock / Unlock */}
            {exam && (exam.status === 'published' || exam.status === 'closed') && (
              <button
                type="button"
                onClick={handleToggleEntry}
                disabled={entryToggleLoading}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
                  exam.status === 'published'
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                }`}
                title={exam.status === 'published' ? 'Lock exam entry for new students' : 'Reopen exam entry'}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {exam.status === 'published' ? 'lock' : 'lock_open'}
                </span>
                <span>{exam.status === 'published' ? 'Lock Entry' : 'Open Entry'}</span>
              </button>
            )}

            {/* Preview Sheet */}
            <Link
              href={`/instructor/exams/${examId}/preview`}
              className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-secondary hover:text-primary transition-colors flex items-center gap-1.5 border border-surface-container-high"
              title="Preview candidate examination sheet"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span className="hidden sm:inline">Preview Sheet</span>
            </Link>

            {/* Export CSV */}
            <button
              type="button"
              onClick={() => exportCohortCSV(exam, attempts)}
              className="px-3 py-2 rounded-xl bg-primary text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Download cohort telemetry CSV report"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                : 'bg-error-container text-error border border-error/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {actionNotice.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{actionNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="opacity-70 hover:opacity-100"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Cohort KPIs Bento-Grid */}
        <CohortKpis summary={summary} exam={exam} />

        {/* Candidate Filters & Search */}
        <CandidateFilters
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          trustFilter={trustFilter}
          setTrustFilter={setTrustFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          attempts={attempts}
          summary={summary}
        />

        {/* Roster Display */}
        {loading ? (
          <div className="py-20 text-center space-y-3 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60">
            <span className="material-symbols-outlined text-[36px] text-primary animate-spin">sync</span>
            <p className="text-xs text-on-surface-variant font-mono">Loading live candidate telemetry radar...</p>
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60">
            <div className="w-12 h-12 rounded-xl bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[26px]">person_search</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-on-surface">No candidate attempts found</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                {searchQuery || statusFilter !== 'all' || trustFilter !== 'all'
                  ? 'No candidates match your current filter criteria. Try resetting filters.'
                  : 'No students have started this examination yet.'}
              </p>
            </div>
            {(searchQuery || statusFilter !== 'all' || trustFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setTrustFilter('all');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 bg-surface-container text-xs font-semibold rounded-xl text-primary hover:bg-surface-container-high transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredAttempts.map((att) => (
              <CandidateCard
                key={att.id}
                attempt={att}
                exam={exam}
                currentTime={currentTime}
                onSelect={(id) => setSelectedAttemptId(id)}
                onTerminate={(target) => {
                  setTerminatingAttempt(target);
                  setTerminateReason('Proctor intervention during live examination');
                }}
                onReopen={(target) => {
                  setReopeningAttempt(target);
                  setReopenReason('Proctor approved attempt restoration');
                  setReopenTrustScore(80);
                }}
              />
            ))}
          </div>
        ) : (
          <CandidateTable
            attempts={filteredAttempts}
            exam={exam}
            currentTime={currentTime}
            onSelect={(id) => setSelectedAttemptId(id)}
          />
        )}

        {/* Slide-over Inspection Drawer */}
        {selectedAttempt && (
          <CandidateDrawer
            selectedAttempt={selectedAttempt}
            exam={exam}
            onClose={() => setSelectedAttemptId(null)}
            onTerminate={(target) => {
              setTerminatingAttempt(target);
              setTerminateReason('Terminated by proctor during live telemetry monitoring');
            }}
            onReopen={(target) => {
              setReopeningAttempt(target);
              setReopenReason('Proctor verified and approved session restore');
              setReopenTrustScore(85);
            }}
          />
        )}

        {/* Terminate Modal */}
        {terminatingAttempt && (
          <TerminateModal
            terminatingAttempt={terminatingAttempt}
            terminateReason={terminateReason}
            setTerminateReason={setTerminateReason}
            isSubmittingTerminate={isSubmittingTerminate}
            onConfirm={handleConfirmTerminate}
            onClose={() => setTerminatingAttempt(null)}
          />
        )}

        {/* Reopen Modal */}
        {reopeningAttempt && (
          <ReopenModal
            reopeningAttempt={reopeningAttempt}
            reopenReason={reopenReason}
            setReopenReason={setReopenReason}
            reopenTrustScore={reopenTrustScore}
            setReopenTrustScore={setReopenTrustScore}
            isSubmittingReopen={isSubmittingReopen}
            onConfirm={handleConfirmReopen}
            onClose={() => setReopeningAttempt(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
