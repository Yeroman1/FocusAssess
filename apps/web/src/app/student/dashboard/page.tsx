'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoadingData(true);
    fetchWithAuth('/auth/me/dashboard')
      .then((data) => {
        if (mounted) setDashboardData(data);
      })
      .catch((err) => {
        console.error('Failed to load student dashboard:', err);
      })
      .finally(() => {
        if (mounted) setIsLoadingData(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleValidateToken = async () => {
    if (!tokenInput.trim()) return;
    setIsValidating(true);
    setTokenStatus(null);
    try {
      const data = await fetchWithAuth('/exam-entry/validate-key', {
        method: 'POST',
        body: JSON.stringify({ key: tokenInput.trim().toUpperCase() }),
      });

      if (data.canResume && data.activeAttempt) {
        router.push(`/student/attempts/${data.activeAttempt.id}`);
      } else if (data.exam) {
        router.push(`/student/exams/${data.exam.id}/instructions`);
      }
    } catch (err: any) {
      setTokenStatus(`Error: ${err.message || 'Invalid assessment key'}`);
    } finally {
      setIsValidating(false);
    }
  };

  const studentName = profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student Candidate';
  const studentEmail = profile?.email || user?.email || 'authenticated-session';

  return (
    <>
      <Navbar />

      <main className="flex-1 flex flex-col relative w-full pt-20 pb-24 bg-surface px-4 md:px-8 max-w-4xl mx-auto">
        <div className="flex flex-col w-full pb-8 space-y-5">
          {/* Welcome Banner */}
          <section className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 relative overflow-hidden border border-surface-container-high/60">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-secondary text-xs uppercase font-mono font-semibold">
                <span className="material-symbols-outlined text-[14px]">school</span>
                <span>ASTU Python Assessment</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low text-on-tertiary-container text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-ping" />
                <span className="font-medium">Live PostgreSQL</span>
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">Welcome back, {studentName}</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                PyAssess Student Examination Portal
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 bg-surface-container-low/60 p-2.5 rounded-xl border border-surface-container-high/40">
              <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant flex-shrink-0">
                <span className="material-symbols-outlined text-[16px]">verified</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-on-surface-variant font-medium">Verified Student Identity</span>
                <span className="text-xs text-on-surface font-mono truncate">{studentEmail}</span>
              </div>
            </div>
          </section>

          {/* Real Metrics 4-Up Grid */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between relative overflow-hidden">
              <div className="w-1.5 h-full bg-secondary absolute left-0 top-0 rounded-l" />
              <div className="flex items-center justify-between pl-1">
                <span className="text-xs text-on-surface-variant uppercase font-mono font-semibold">Available</span>
                <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                </div>
              </div>
              <div className="mt-2 pl-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : (dashboardData?.stats?.activeNow ?? 0)}
                </span>
                <span className="text-xs text-secondary font-medium font-mono">Published</span>
              </div>
              <span className="text-xs text-on-surface-variant pl-1">Active examinations</span>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant uppercase font-mono font-semibold">Scheduled</span>
                <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : (dashboardData?.stats?.upcoming ?? 0)}
                </span>
                <span className="text-xs text-on-surface-variant font-medium font-mono">Upcoming</span>
              </div>
              <span className="text-xs text-on-surface-variant">Academic calendar</span>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant uppercase font-mono font-semibold">Completed</span>
                <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-tertiary-container">
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : (dashboardData?.stats?.completed ?? 0)}
                </span>
                <span className="text-xs text-on-surface-variant font-medium font-mono">Graded</span>
              </div>
              <span className="text-xs text-on-surface-variant">Submitted attempts</span>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant uppercase font-mono font-semibold">Evaluating</span>
                <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : (dashboardData?.stats?.evaluating ?? 0)}
                </span>
                <span className="text-xs text-secondary font-medium font-mono">Pending</span>
              </div>
              <span className="text-xs text-on-surface-variant">Sandbox evaluation</span>
            </div>
          </section>

          {/* Active In-Progress Attempt Card (if any exists) */}
          {dashboardData?.activeAttempt && (
            <section className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border-2 border-secondary relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-error text-xs font-mono font-semibold">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                  SESSION IN PROGRESS
                </span>
                <span className="text-xs font-mono text-secondary font-bold">ACTIVE ATTEMPT</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-on-surface">{dashboardData.activeAttempt.exam?.title || 'Examination Attempt'}</h2>
                <p className="text-sm text-secondary font-medium">Session is live. Anti-cheating telemetry active.</p>
              </div>

              <div className="mt-4">
                <Link
                  href={`/student/attempts/${dashboardData.activeAttempt.id}`}
                  className="w-full h-11 bg-secondary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary/90 active:scale-[0.99] transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">lock_open</span>
                  <span>Resume Live Examination Workspace</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </section>
          )}

          {/* Assessment Key Entry Card */}
          <section className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-surface-container-high/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">key</span>
                </div>
                <h3 className="text-sm font-semibold text-on-surface">Enter Examination Key</h3>
              </div>
              <span className="text-xs font-mono text-on-surface-variant font-medium">ACCESS DISPATCH</span>
            </div>

            <p className="text-xs text-on-surface-variant">
              Enter the unique examination key distributed by your instructor or department proctor.
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="e.g. CS204-XYZ"
                  className="w-full h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-mono text-xs uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-secondary focus:bg-white transition-all border border-surface-container-high"
                />
              </div>
              <button
                onClick={handleValidateToken}
                disabled={isValidating || !tokenInput.trim()}
                className="h-10 px-5 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {isValidating ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                ) : (
                  <>
                    <span>Verify &amp; Enter</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </button>
            </div>

            {tokenStatus && (
              <div className="p-2.5 rounded-lg bg-error-container text-error text-xs flex items-center gap-2 font-mono">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span className="truncate">{tokenStatus}</span>
              </div>
            )}
          </section>

          {/* Real Scheduled Assessments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">event_upcoming</span>
                <h3 className="text-sm font-semibold text-on-surface">Published Examinations</h3>
              </div>
              <span className="text-xs text-on-surface-variant font-medium">
                {dashboardData?.scheduledExams?.length ?? 0} Available
              </span>
            </div>

            {dashboardData?.scheduledExams && dashboardData.scheduledExams.length > 0 ? (
              <div className="space-y-2">
                {dashboardData.scheduledExams.map((exam: any) => (
                  <div
                    key={exam.id}
                    className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-surface-container-high/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface">{exam.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-on-surface-variant font-mono mt-1">
                        <span>Duration: {exam.durationMinutes} min</span>
                        {exam.availableFrom && (
                          <span>From: {new Date(exam.availableFrom).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/student/exams/${exam.id}/instructions`}
                      className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-secondary transition-colors"
                    >
                      View Instructions
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high/60 text-center text-xs text-on-surface-variant">
                No examinations currently published. Enter your access key above when your test begins.
              </div>
            )}
          </section>

          {/* Real Recent Submissions */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-tertiary-container text-[20px]">assignment_turned_in</span>
                <h3 className="text-sm font-semibold text-on-surface">Recent Submissions &amp; Results</h3>
              </div>
              <span className="text-xs text-secondary font-semibold font-mono">
                {dashboardData?.recentSubmissions?.length ?? 0} Total
              </span>
            </div>

            {dashboardData?.recentSubmissions && dashboardData.recentSubmissions.length > 0 ? (
              <div className="space-y-2">
                {dashboardData.recentSubmissions.map((sub: any) => (
                  <div
                    key={sub.id}
                    className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-tertiary-container flex-shrink-0">
                        <span className="material-symbols-outlined text-[20px]">
                          {sub.status === 'terminated_suspicious' ? 'gavel' : 'check_box'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-sm font-semibold text-on-surface truncate">{sub.examTitle}</h5>
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono">
                          <span>Status: {sub.status}</span>
                          <span>•</span>
                          <span>Trust: {sub.trustScore}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      {sub.resultsReleased ? (
                        <>
                          <span className="text-sm font-mono font-bold text-on-surface">
                            {sub.totalMarks ?? 0}/{sub.maxMarks ?? 100}
                          </span>
                          <Link
                            href={`/student/attempts/${sub.id}/results`}
                            className="text-xs text-secondary font-semibold hover:underline"
                          >
                            View Result
                          </Link>
                        </>
                      ) : (
                        <span className="text-xs text-on-surface-variant font-mono">Evaluation Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high/60 text-center text-xs text-on-surface-variant">
                No past submissions found for this account.
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Proctoring Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">verified_user</span>
                <h3 className="text-lg font-bold text-on-surface">Proctoring Protocols</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-on-surface-variant">
              <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">hard_drive</span>
                <div>
                  <strong className="text-on-surface block font-semibold">Browser Lockout</strong>
                  Focus loss beyond permitted occurrences or window resizing will terminate test tokens immediately.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                <span className="material-symbols-outlined text-on-tertiary-container text-[18px] mt-0.5">code_blocks</span>
                <div>
                  <strong className="text-on-surface block font-semibold">Execution Sandbox</strong>
                  All code runs under Python 3.12 with strict resource boundaries and 3000ms wall-clock timeout.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                <span className="material-symbols-outlined text-error text-[18px] mt-0.5">security_update_warning</span>
                <div>
                  <strong className="text-on-surface block font-semibold">Server-Enforced Trust Threshold</strong>
                  Baseline score is 100%. Trust strictly below 70% results in immediate automated termination.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full h-11 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              I Acknowledge &amp; Understand
            </button>
          </div>
        </div>
      )}
    </>
  );
}
