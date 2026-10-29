'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function InstructorDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['instructor', 'admin']}>
      <InstructorDashboardContent />
    </ProtectedRoute>
  );
}

function InstructorDashboardContent() {
  const { user, profile } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionExamId, setActionExamId] = useState<string | null>(null);

  const handleToggleEntry = async (examId: string, currentStatus: string, examTitle: string) => {
    if (currentStatus === 'published') {
      const confirmed = window.confirm(
        `Are you sure you want to close entry to "${examTitle}"?\n\n` +
        `• Students who have already entered and started will continue taking the test uninterrupted.\n` +
        `• No new students will be allowed to enter, even if they have the correct examination key.`
      );
      if (!confirmed) return;

      setActionExamId(examId);
      try {
        const res = await fetchWithAuth(`/exams/${examId}/close`, { method: 'POST' });
        setExams((prev) =>
          prev.map((e) => (e.id === examId ? { ...e, status: res.exam?.status || 'closed' } : e))
        );
        if (dashboardData?.stats) {
          setDashboardData((prev: any) => ({
            ...prev,
            stats: {
              ...prev.stats,
              publishedExams: Math.max(0, (prev.stats.publishedExams || 1) - 1),
            },
          }));
        }
      } catch (err: any) {
        alert(`Failed to close examination entry: ${err.message}`);
      } finally {
        setActionExamId(null);
      }
    } else if (currentStatus === 'closed') {
      const confirmed = window.confirm(
        `Reopen examination entry for "${examTitle}"?\n\n` +
        `• New students with the valid examination key will once again be permitted to enter and begin.`
      );
      if (!confirmed) return;

      setActionExamId(examId);
      try {
        const res = await fetchWithAuth(`/exams/${examId}/reopen`, { method: 'POST' });
        setExams((prev) =>
          prev.map((e) => (e.id === examId ? { ...e, status: res.exam?.status || 'published' } : e))
        );
        if (dashboardData?.stats) {
          setDashboardData((prev: any) => ({
            ...prev,
            stats: {
              ...prev.stats,
              publishedExams: (prev.stats.publishedExams || 0) + 1,
            },
          }));
        }
      } catch (err: any) {
        alert(`Failed to reopen examination entry: ${err.message}`);
      } finally {
        setActionExamId(null);
      }
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    setIsLoading(true);

    Promise.all([
      fetchWithAuth('/auth/me/dashboard').catch((err) => {
        console.error('Failed to load instructor metrics:', err);
        return null;
      }),
      fetchWithAuth('/exams').catch((err) => {
        console.error('Failed to load exams list:', err);
        return { exams: [] };
      }),
    ])
      .then(([metrics, examsResponse]) => {
        if (!mounted) return;
        if (metrics) setDashboardData(metrics);
        if (examsResponse?.exams) setExams(examsResponse.exams);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <DashboardLayout portalRole="instructor" title="Instructor Exam Console" subtitle="Manage examinations, test-cases, and anti-cheating telemetry">
      <div className="flex flex-col gap-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface">Instructor Command Center</h1>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Manage examinations, security keys, student monitoring, and automatic test-case grading.
              </p>
            </div>

            <Link
              href="/instructor/exams/create"
              className="w-full sm:w-auto h-10 px-4 bg-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create Examination</span>
            </Link>
          </div>

          {/* Quick Metrics 4-Up Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Total Examinations</span>
              <span className="text-xl sm:text-2xl font-bold text-on-surface mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.totalExams ?? exams.length)}
              </span>
            </div>

            <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Published Active</span>
              <span className="text-xl sm:text-2xl font-bold text-secondary mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.publishedExams ?? 0)}
              </span>
            </div>

            <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Live In-Progress</span>
              <span className="text-xl sm:text-2xl font-bold text-on-tertiary-container mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.activeAttempts ?? 0)}
              </span>
            </div>

            <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Flagged For Review</span>
              <span className="text-xl sm:text-2xl font-bold text-error mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.flaggedAttempts ?? 0)}
              </span>
            </div>
          </div>

          {/* Examination Roster */}
          <section id="exams" className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high/60 shadow-sm space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm sm:text-base font-bold text-on-surface">Your Examinations</h2>
              <span className="text-xs font-mono text-on-surface-variant">{exams.length} Configured</span>
            </div>

            {exams.length > 0 ? (
              <div className="divide-y divide-surface-container-high">
                {exams.map((ex) => {
                  const isPublished = ex.status === 'published';
                  const isClosed = ex.status === 'closed';
                  const isDraft = ex.status === 'draft';

                  return (
                    <div key={ex.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-on-surface">{ex.title}</h3>
                          {isPublished && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Published • Live
                            </span>
                          )}
                          {isClosed && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Entry Closed
                            </span>
                          )}
                          {isDraft && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-surface-container text-on-surface-variant">
                              Draft Mode
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-xs text-on-surface-variant font-mono flex-wrap">
                          <span>{ex.durationMinutes} Minutes</span>
                          <span>•</span>
                          <span>{ex._count?.attempts ?? 0} Submissions</span>
                          {ex.keys?.[0] && (
                            <>
                              <span>•</span>
                              <span className="text-secondary font-bold">Key Prefix: {ex.keys[0].keyPrefix}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="w-full sm:w-auto flex items-center gap-2 pt-1 sm:pt-0 flex-wrap">
                        {/* Close Entry Action for Published Exams */}
                        {isPublished && (
                          <button
                            onClick={() => handleToggleEntry(ex.id, ex.status, ex.title)}
                            disabled={actionExamId === ex.id}
                            title="Close new candidate entry (students currently taking the test can still finish)"
                            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-rose-500/20 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {actionExamId === ex.id ? 'sync' : 'lock'}
                            </span>
                            <span>{actionExamId === ex.id ? 'Closing...' : 'Close Entry'}</span>
                          </button>
                        )}

                        {/* Reopen Entry Action for Closed Exams */}
                        {isClosed && (
                          <button
                            onClick={() => handleToggleEntry(ex.id, ex.status, ex.title)}
                            disabled={actionExamId === ex.id}
                            title="Reopen entry to allow new candidates to enter with the exam key"
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-emerald-500/20 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {actionExamId === ex.id ? 'sync' : 'lock_open'}
                            </span>
                            <span>{actionExamId === ex.id ? 'Reopening...' : 'Reopen Entry'}</span>
                          </button>
                        )}

                        {isDraft ? (
                          <Link
                            href={`/instructor/exams/${ex.id}/builder`}
                            className="w-full sm:w-auto text-center px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit_note</span>
                            <span>Question Builder</span>
                          </Link>
                        ) : (
                          <>
                            <Link
                              href={`/instructor/exams/${ex.id}/builder`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface transition-colors flex items-center gap-1"
                              title="View questions and settings"
                            >
                              <span className="material-symbols-outlined text-[15px]">settings</span>
                              <span>Builder</span>
                            </Link>
                            <Link
                              href={`/student/exams/${ex.id}/instructions`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-medium text-on-surface transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">visibility</span>
                              <span>Preview</span>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[24px]">assignment</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-on-surface">No examinations created yet</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Click &ldquo;Create Examination&rdquo; above to set up your first Python test with hidden test cases.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Recent Submissions & Flagged Review List */}
          {dashboardData?.recentSubmissions && dashboardData.recentSubmissions.length > 0 && (
            <section id="submissions" className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high/60 shadow-sm space-y-4 scroll-mt-20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm sm:text-base font-bold text-on-surface">Recent Student Attempts</h2>
                <span className="text-xs font-mono text-on-surface-variant">Live Telemetry</span>
              </div>

              <div className="divide-y divide-surface-container-high">
                {dashboardData.recentSubmissions.map((att: any) => (
                  <div key={att.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-on-surface">
                          {att.student?.fullName || att.student?.email || 'Student'}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                            att.trustScore < 70
                              ? 'bg-error-container text-error'
                              : 'bg-surface-container text-secondary'
                          }`}
                        >
                          Trust: {att.trustScore}%
                        </span>
                      </div>
                      <span className="text-xs text-on-surface-variant font-mono mt-0.5 block">
                        {att.exam?.title} • Status: {att.status}
                      </span>
                    </div>

                    <Link
                      href={`/instructor/attempts/${att.id}`}
                      className="w-full sm:w-auto text-center px-3.5 py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      Audit Telemetry
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
    </DashboardLayout>
  );
}
