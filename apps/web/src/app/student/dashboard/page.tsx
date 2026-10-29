'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function StudentDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      <StudentDashboardContent />
    </ProtectedRoute>
  );
}

function StudentDashboardContent() {
  const router = useRouter();
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
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
  }, [user?.id]);

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
    <DashboardLayout portalRole="student" title="Student Assessment Hub" subtitle="Supervised Python runtime & active examinations">
      <div className="flex flex-col w-full pb-8 space-y-6">
        {/* Welcome Banner */}
        <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col gap-3 relative overflow-hidden border border-surface-container-high/60">
            <div className="flex items-center justify-between flex-wrap gap-2">
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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">Welcome back, {studentName}</h1>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
                FocusAssess Student Examination Portal
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 bg-surface-container-low/60 p-2.5 rounded-xl border border-surface-container-high/40">
              <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant flex-shrink-0">
                <span className="material-symbols-outlined text-[16px]">verified</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs text-on-surface-variant font-medium">Verified Student Identity</span>
                <span className="text-xs text-on-surface font-mono truncate">{studentEmail}</span>
              </div>
            </div>
          </section>

          {/* Instructor Quick Access (if user has instructor privileges) */}
          {profile?.role === 'instructor' && (
            <section className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Instructor Account Active</h4>
                  <p className="text-xs text-on-surface-variant">
                    You have verified instructor privileges to author programming assessments and evaluate submissions.
                  </p>
                </div>
              </div>
              <Link
                href="/instructor/dashboard"
                className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 flex-shrink-0"
              >
                <span>Instructor Portal</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </section>
          )}

          {/* Real Metrics 4-Up Grid (Student's Personal Examination History) */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-surface-container-lowest p-3 sm:p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between relative overflow-hidden">
              <div className="w-1.5 h-full bg-primary absolute left-0 top-0 rounded-l" />
              <div className="flex items-center justify-between pl-1">
                <span className="text-[10px] sm:text-xs text-on-surface-variant uppercase font-mono font-semibold">Exams Taken</span>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">history_edu</span>
                </div>
              </div>
              <div className="mt-2 pl-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : (dashboardData?.stats?.examsTaken ?? 0)}
                </span>
                <span className="text-[11px] sm:text-xs text-primary font-medium font-mono">Attempts</span>
              </div>
              <span className="text-[10px] sm:text-xs text-on-surface-variant pl-1">Total exams taken</span>
            </div>

            <div className="bg-surface-container-lowest p-3 sm:p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-on-surface-variant uppercase font-mono font-semibold">Completed</span>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-surface-container flex items-center justify-center text-emerald-600">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">task_alt</span>
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : (dashboardData?.stats?.completed ?? 0)}
                </span>
                <span className="text-[11px] sm:text-xs text-emerald-600 font-medium font-mono">Graded</span>
              </div>
              <span className="text-[10px] sm:text-xs text-on-surface-variant">Finalized results</span>
            </div>

            <div className="bg-surface-container-lowest p-3 sm:p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-on-surface-variant uppercase font-mono font-semibold">Evaluating</span>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-surface-container flex items-center justify-center text-amber-600">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">hourglass_top</span>
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : (dashboardData?.stats?.evaluating ?? 0)}
                </span>
                <span className="text-[11px] sm:text-xs text-amber-600 font-medium font-mono">Pending</span>
              </div>
              <span className="text-[10px] sm:text-xs text-on-surface-variant">Review in progress</span>
            </div>

            <div className="bg-surface-container-lowest p-3 sm:p-3.5 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-on-surface-variant uppercase font-mono font-semibold">Avg Trust Score</span>
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-surface-container flex items-center justify-center text-blue-600">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px]">verified_user</span>
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-semibold text-on-surface">
                  {isLoadingData ? '—' : `${dashboardData?.stats?.averageTrust ?? 100}%`}
                </span>
                <span className="text-[11px] sm:text-xs text-blue-600 font-medium font-mono">Integrity</span>
              </div>
              <span className="text-[10px] sm:text-xs text-on-surface-variant">Proctoring index</span>
            </div>
          </section>

          {/* Section 1: Available Exams & Access Dispatch */}
          <section id="available-exams" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">key</span>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-on-surface">Available Examinations &amp; Key Access</h3>
                  <p className="text-xs text-on-surface-variant">Enter your exam access key to start or resume an examination.</p>
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                ACCESS DISPATCH
              </span>
            </div>

            {/* Active In-Progress Attempt Card (if any exists) */}
            {dashboardData?.activeAttempt && (
              <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl shadow-sm border-2 border-secondary relative overflow-hidden">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-error text-xs font-mono font-semibold">
                    <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                    SESSION IN PROGRESS
                  </span>
                  <span className="text-xs font-mono text-secondary font-bold">ACTIVE ATTEMPT</span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-bold text-on-surface">{dashboardData.activeAttempt.exam?.title || 'Examination Attempt'}</h2>
                  <p className="text-xs sm:text-sm text-secondary font-medium">Session is live. Anti-cheating telemetry active.</p>
                </div>

                <div className="mt-4">
                  <Link
                    href={`/student/attempts/${dashboardData.activeAttempt.id}`}
                    className="w-full h-11 bg-secondary text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary/90 active:scale-[0.99] transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">lock_open</span>
                    <span>Resume Live Examination Workspace</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Assessment Key Entry Card */}
            <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl shadow-sm border border-surface-container-high/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[16px]">vpn_key</span>
                  </div>
                  <h4 className="text-sm font-semibold text-on-surface">Enter Assessment Key</h4>
                </div>
                <span className="text-[10px] sm:text-xs font-mono text-on-surface-variant font-medium">SINGLE-USE KEY</span>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                Exams in FocusAssess are private and unlocked using the single-use assessment key provided by your instructor or proctor.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                    placeholder="e.g. CS204-XYZ"
                    className="w-full h-11 sm:h-10 px-3 bg-surface-container-low text-on-surface rounded-xl font-mono text-xs uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-secondary focus:bg-white transition-all border border-surface-container-high"
                  />
                </div>
                <button
                  onClick={handleValidateToken}
                  disabled={isValidating || !tokenInput.trim()}
                  className="w-full sm:w-auto h-11 sm:h-10 px-5 bg-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] transition-all disabled:opacity-50"
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
                <div className="p-3 rounded-xl bg-error-container text-error text-xs flex items-start gap-2.5 leading-relaxed font-medium">
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
                  <span className="break-words">{tokenStatus}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-surface-container-low/70 border border-surface-container-high/40 flex items-start gap-2 text-[11px] text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary flex-shrink-0 mt-0.5">info</span>
                <span>
                  <strong>One-Time Use Policy:</strong> Each examination key can only be used once per candidate. Once started or submitted, the key cannot be reused.
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: My Taken Examinations & Submissions */}
          <section id="recent-submissions" className="space-y-3 scroll-mt-20">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">history_edu</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-on-surface">My Taken Examinations</h3>
                  <p className="text-xs text-on-surface-variant">Your historical test attempts, evaluation outcomes, and integrity scores.</p>
                </div>
              </div>
              <span className="text-xs text-primary font-semibold font-mono px-2.5 py-1 rounded-full bg-surface-container">
                {(dashboardData?.myExams?.length ?? dashboardData?.recentSubmissions?.length ?? 0)} Recorded
              </span>
            </div>

            {(dashboardData?.myExams?.length || dashboardData?.recentSubmissions?.length) ? (
              <div className="space-y-2.5">
                {(dashboardData?.myExams || dashboardData?.recentSubmissions).map((sub: any) => {
                  const isTerminated = sub.status === 'terminated_suspicious' || sub.status === 'terminated';
                  const isGraded = sub.gradingStatus === 'graded' && sub.resultsReleased;
                  const isEvaluating = !isTerminated && !isGraded;

                  return (
                    <div
                      key={sub.id}
                      className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-surface-container-high/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-surface-container-highest transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isTerminated
                              ? 'bg-rose-500/10 text-rose-600'
                              : isGraded
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {isTerminated ? 'gavel' : isGraded ? 'task_alt' : 'hourglass_top'}
                          </span>
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h5 className="text-sm font-bold text-on-surface truncate">{sub.examTitle}</h5>
                          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono flex-wrap">
                            <span className="capitalize">{sub.status?.replace('_', ' ')}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">shield</span>
                              <span>Trust: {sub.trustScore ?? 100}%</span>
                            </span>
                            {sub.submittedAt && (
                              <>
                                <span>•</span>
                                <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start pt-2 sm:pt-0 border-t sm:border-0 border-surface-container-high flex-shrink-0 gap-1.5">
                        {isGraded ? (
                          <>
                            <div className="text-right">
                              <span className="text-sm sm:text-base font-mono font-bold text-on-surface block">
                                {sub.totalMarks ?? 0} / {sub.maxMarks ?? 100}
                              </span>
                              {sub.percentageScore !== null && (
                                <span className="text-[11px] font-mono text-emerald-600 font-semibold block">
                                  {sub.percentageScore}% Score
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/student/attempts/${sub.id}/results`}
                              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-primary transition-colors flex items-center gap-1"
                            >
                              <span>View Results</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </Link>
                          </>
                        ) : isTerminated ? (
                          <>
                            <span className="text-xs font-mono text-rose-600 font-bold">Terminated (Security)</span>
                            <Link
                              href={`/student/attempts/${sub.id}/terminated`}
                              className="text-xs text-rose-600 hover:underline font-semibold"
                            >
                              Incident Report
                            </Link>
                          </>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-mono font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Under Evaluation
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-mono">Results pending release</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container-high/60 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mx-auto">
                  <span className="material-symbols-outlined text-[24px]">history_edu</span>
                </div>
                <h4 className="text-sm font-bold text-on-surface">No Past Examinations Taken</h4>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  You have not completed any examinations on this account yet. When you enter an assessment key above and complete an exam, your attempts and grades will appear here.
                </p>
              </div>
            )}
          </section>
        </div>

      {/* Proctoring Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">verified_user</span>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">Proctoring Protocols</h3>
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
              className="w-full h-11 bg-primary text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              I Acknowledge &amp; Understand
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
