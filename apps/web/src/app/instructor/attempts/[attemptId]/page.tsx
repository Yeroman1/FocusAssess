'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fetchWithAuth } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function InstructorAttemptReviewPage() {
  return (
    <ProtectedRoute allowedRoles={['instructor', 'admin']}>
      <InstructorAttemptReviewContent />
    </ProtectedRoute>
  );
}

function InstructorAttemptReviewContent() {
  const params = useParams();
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<any>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [overrideMarks, setOverrideMarks] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  useEffect(() => {
    fetchWithAuth(`/instructor/attempts/${attemptId}/submission`)
      .then((data) => {
        setAttempt(data.attempt);
        setOverrideMarks(data.attempt.totalMarksAwarded ?? 0);
      })
      .catch((err) => {
        console.error('Failed to load instructor attempt review:', err);
      });
  }, [attemptId]);

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth(`/instructor/attempts/${attemptId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason: reopenReason, restoredTrustScore: 80 }),
      });
      setActionFeedback('Attempt successfully reopened. Student can resume examination.');
      setShowReopenModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to reopen attempt');
    }
  };

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth(`/instructor/attempts/${attemptId}/grade-override`, {
        method: 'POST',
        body: JSON.stringify({ newTotalMarks: Number(overrideMarks), reason: overrideReason }),
      });
      setActionFeedback(`Grade overridden successfully to ${overrideMarks} marks.`);
      setShowOverrideModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to override grade');
    }
  };

  return (
    <DashboardLayout portalRole="instructor" title="Submission & Telemetry Adjudication" subtitle={`Attempt #${attemptId.slice(0, 8).toUpperCase()} • Comprehensive Proctoring Audit`}>
      <div className="flex flex-col gap-5 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/instructor/dashboard" className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <h1 className="text-lg sm:text-xl font-bold text-on-surface">Submission &amp; Telemetry Adjudication</h1>
          </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowReopenModal(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-surface-container text-xs font-semibold text-secondary hover:bg-surface-container-high transition-colors text-center"
              >
                Reopen Attempt
              </button>
              <button
                onClick={() => setShowOverrideModal(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-slate-800 transition-colors text-center"
              >
                Override Grade
              </button>
            </div>
          </div>

          {actionFeedback && (
            <div className="p-3 bg-tertiary-container text-on-tertiary text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-on-tertiary-container">check_circle</span>
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* Candidate Overview Card */}
          <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high/60 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <span className="text-[10px] uppercase font-mono text-on-surface-variant block">Candidate Profile</span>
              <span className="text-sm font-bold text-on-surface block mt-0.5">{attempt?.student?.fullName}</span>
              <span className="text-xs text-on-surface-variant font-mono">{attempt?.student?.email}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono text-on-surface-variant block">Attempt Status</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold mt-1 ${
                attempt?.status === 'terminated_suspicious' ? 'bg-error-container text-error' : 'bg-surface-container text-secondary'
              }`}>
                {attempt?.status}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono text-on-surface-variant block">Integrity Trust Score</span>
              <span className={`text-xl font-mono font-bold block mt-0.5 ${
                (attempt?.trustScore ?? 100) < 70 ? 'text-error' : 'text-on-tertiary-container'
              }`}>
                {attempt?.trustScore}%
              </span>
            </div>
          </div>

          {/* Submitted Code Solution Viewer */}
          <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">Candidate Source Code Snapshot</h2>
            <div className="bg-dark-ide rounded-xl p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-[350px]">
              <pre>{attempt?.answers?.[0]?.sourceCode || '# No code recorded'}</pre>
            </div>
          </section>

          {/* Proctor Telemetry Audit Timeline */}
          <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">Recorded Telemetry Incidents</h2>
            <div className="space-y-2">
              {attempt?.events?.map((ev: any, idx: number) => (
                <div key={idx} className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                    <span className="font-mono font-semibold">{ev.eventType}</span>
                  </div>
                  <div className="flex items-center gap-4 text-on-surface-variant font-mono">
                    <span className="text-error font-bold">-{ev.penalty}% Penalty</span>
                    <span>{new Date(ev.occurredAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleReopen} className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-on-surface">Reopen Examination Attempt</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Reopening will reset the candidate attempt status to in_progress and restore their trust index above 70%. An immutable audit record is required.
            </p>

            <div>
              <label className="text-xs font-semibold block mb-1">Mandatory Justification Reason</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Verified accidental browser resize due to OS battery alert..."
                rows={3}
                className="w-full p-2.5 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-4 h-9 rounded-xl bg-surface-container text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 h-9 rounded-xl bg-primary text-white text-xs font-semibold"
              >
                Confirm Reopen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Override Grade Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleOverride} className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-on-surface">Manual Grade Override</h3>

            <div>
              <label className="text-xs font-semibold block mb-1">New Total Marks Awarded (out of 100)</label>
              <input
                type="number"
                value={overrideMarks}
                onChange={(e) => setOverrideMarks(Number(e.target.value))}
                className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono border border-surface-container-high"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Mandatory Override Reason</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Awarded 10 partial credit marks for optimal heap helper implementation..."
                rows={3}
                className="w-full p-2.5 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-4 h-9 rounded-xl bg-surface-container text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 h-9 rounded-xl bg-primary text-white text-xs font-semibold"
              >
                Apply Override
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
