'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function InstructorDashboardPage() {
  const { user, profile } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, [user]);

  return (
    <>
      <Navbar />

      <main className="flex-1 pt-20 pb-16 px-4 md:px-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col gap-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-on-surface">Instructor Command Center</h1>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Manage examinations, security keys, student monitoring, and automatic test-case grading.
              </p>
            </div>

            <Link
              href="/instructor/exams/create"
              className="h-10 px-4 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto hover:bg-slate-800 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create Examination</span>
            </Link>
          </div>

          {/* Quick Metrics 4-Up Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Total Examinations</span>
              <span className="text-2xl font-bold text-on-surface mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.totalExams ?? exams.length)}
              </span>
            </div>

            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Published Active</span>
              <span className="text-2xl font-bold text-secondary mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.publishedExams ?? 0)}
              </span>
            </div>

            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Live In-Progress</span>
              <span className="text-2xl font-bold text-on-tertiary-container mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.activeAttempts ?? 0)}
              </span>
            </div>

            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Flagged For Review</span>
              <span className="text-2xl font-bold text-error mt-1 block">
                {isLoading ? '—' : (dashboardData?.stats?.flaggedAttempts ?? 0)}
              </span>
            </div>
          </div>

          {/* Examination Roster */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-on-surface">Your Examinations</h2>
              <span className="text-xs font-mono text-on-surface-variant">{exams.length} Configured</span>
            </div>

            {exams.length > 0 ? (
              <div className="divide-y divide-surface-container-high">
                {exams.map((ex) => (
                  <div key={ex.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-on-surface">{ex.title}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            ex.status === 'published'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {ex.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-on-surface-variant font-mono">
                        <span>{ex.durationMinutes} Minutes</span>
                        <span>•</span>
                        <span>{ex._count?.attempts ?? 0} Candidate Submissions</span>
                        {ex.keys?.[0] && (
                          <>
                            <span>•</span>
                            <span className="text-secondary font-bold">Key Prefix: {ex.keys[0].keyPrefix}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/student/exams/${ex.id}/instructions`}
                        className="px-3 py-1.5 rounded-lg bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        Preview Instructions
                      </Link>
                    </div>
                  </div>
                ))}
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
            <section className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface">Recent Student Attempts</h2>
                <span className="text-xs font-mono text-on-surface-variant">Live Telemetry</span>
              </div>

              <div className="divide-y divide-surface-container-high">
                {dashboardData.recentSubmissions.map((att: any) => (
                  <div key={att.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
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
                      <span className="text-xs text-on-surface-variant font-mono">
                        {att.exam?.title} • Status: {att.status}
                      </span>
                    </div>

                    <Link
                      href={`/instructor/attempts/${att.id}`}
                      className="px-3 py-1.5 rounded-lg bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      Audit Telemetry
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
