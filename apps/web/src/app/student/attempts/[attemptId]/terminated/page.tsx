'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function ExamTerminatedPage() {
  return (
    <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
      <ExamTerminatedContent />
    </ProtectedRoute>
  );
}

function ExamTerminatedContent() {
  const params = useParams();
  const attemptId = params.attemptId as string;

  const [attemptData, setAttemptData] = useState<any>(null);
  const [appealText, setAppealText] = useState('');
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  useEffect(() => {
    fetchWithAuth(`/attempts/${attemptId}`)
      .then((data) => setAttemptData(data.attempt))
      .catch((err) => console.log('Mock terminated state:', err));
  }, [attemptId]);

  const handleSubmitAppeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealText.trim()) return;
    setAppealSubmitted(true);
    setShowAppealForm(false);
  };

  const trustScore = attemptData?.trustScore ?? 65;

  return (
    <>
      <Navbar />

      <main className="flex-1 flex flex-col relative w-full pt-16 sm:pt-20 pb-12 sm:pb-16 bg-surface px-3 sm:px-4 md:px-8 max-w-2xl mx-auto">
        <div className="flex flex-col w-full pb-8 space-y-4">
          {/* Automatic Integrity Guard Alert Banner */}
          <div className="bg-error-container rounded-2xl p-4 sm:p-5 shadow-sm border border-error/20">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-error text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <span className="material-symbols-outlined text-[22px]">shield_with_heart</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-error bg-white px-2 py-0.5 rounded font-bold">
                    Automatic Integrity Guard
                  </span>
                  <span className="text-xs font-semibold text-error">Session Halted</span>
                </div>
                <h1 className="text-xl font-bold text-error mt-1 leading-snug">Examination Attempt Terminated</h1>
                <p className="text-xs text-error/90 mt-0.5">Session flagged for non-punitive manual review.</p>
              </div>
            </div>
          </div>

          {/* Incident Reference Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container-high/60 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-on-surface-variant uppercase">Incident Reference</span>
              <span className="font-bold text-on-surface select-all">#ATT-{attemptId.slice(0, 8).toUpperCase()}-CS204</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-on-surface-variant uppercase">Timestamp</span>
              <span className="text-on-surface">{new Date().toUTCString()}</span>
            </div>
          </div>

          {/* Integrity Metrics Gauge Card */}
          <div className="bg-surface-container rounded-2xl p-5 shadow-sm border border-surface-container-high/60 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-on-surface">Integrity Metrics</span>
              <span className="text-xs font-mono font-bold bg-error text-white px-2.5 py-0.5 rounded-full">
                Threshold Breached
              </span>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 flex flex-col gap-2.5 border border-surface-container-high/40">
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-on-surface-variant font-mono">Calculated Trust Score</span>
                  <span className="text-3xl font-mono font-bold text-error leading-none mt-1">{trustScore}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant font-mono block">Auto-Halt Trigger</span>
                  <span className="text-xs font-mono font-bold text-on-surface">&lt; 70% Trust Score</span>
                </div>
              </div>

              <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden flex">
                <div className="h-full bg-error transition-all duration-500 rounded-full" style={{ width: `${trustScore}%` }} />
              </div>

              <div className="flex justify-between text-[11px] font-mono text-on-surface-variant">
                <span>0% (Revoked)</span>
                <span className="text-error font-semibold">Threshold (70%)</span>
                <span>100% (Nominal)</span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">Audit Policy Notice:</strong> Your attempt has been paused and forwarded to your course proctor. Scores exactly at 70% remain operational; descending strictly below 70% initiates this safeguard to prevent unintended grading penalties during unexpected technical interruptions.
            </p>
          </div>

          {/* Preservation Guarantee Banner */}
          <div className="bg-tertiary-container text-on-tertiary rounded-2xl p-5 shadow-sm flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-on-tertiary-container text-white flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px]">cloud_done</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-on-tertiary-container">Preservation Guarantee</span>
              <h2 className="text-sm font-bold text-on-tertiary mt-0.5">Your progress is strictly intact</h2>
              <p className="text-xs text-on-tertiary-container mt-1 leading-relaxed">
                All written code, syntactical tokens, and answers submitted prior to the halt have been synchronized and safely preserved in backend persistent storage. No student work has been purged.
              </p>
            </div>
          </div>

          {/* Immutable System Audit Timeline */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container-high/60 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[20px]">history_edu</span>
                <h3 className="text-sm font-bold text-on-surface">System Audit Timeline</h3>
              </div>
              <span className="text-xs font-mono text-on-surface-variant">Immutable Log</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-container-low">
                <span className="font-mono text-on-surface-variant font-bold w-12 flex-shrink-0">14:02 UTC</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Session Initialized</span>
                    <span className="text-on-tertiary-container font-mono">100% Trust</span>
                  </div>
                  <span className="text-on-surface-variant text-[11px]">Browser lockdown environment engaged successfully.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-container-low">
                <span className="font-mono text-on-surface-variant font-bold w-12 flex-shrink-0">14:18 UTC</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Focus Switched</span>
                    <span className="text-error font-mono">-15% → 85%</span>
                  </div>
                  <span className="text-on-surface-variant text-[11px]">OS window lost active focus; notification dismissed.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-container-low">
                <span className="font-mono text-on-surface-variant font-bold w-12 flex-shrink-0">14:31 UTC</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Autosave Checkpoint</span>
                    <span className="text-on-tertiary-container font-mono">Stable (85%)</span>
                  </div>
                  <span className="text-on-surface-variant text-[11px]">Solution for Question 1 validated and stored to persistent volume.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-error-container/40 border border-error/20">
                <span className="font-mono text-error font-bold w-12 flex-shrink-0">14:42 UTC</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between font-semibold text-error">
                    <span>Display / Clipboard Conflict</span>
                    <span className="font-mono font-bold">-20% → {trustScore}%</span>
                  </div>
                  <span className="text-error text-[11px]">Fullscreen escaped accompanied by background capture request. Safety halt triggered.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructor Review & Student Appeal */}
          <div className="bg-surface-container-low rounded-2xl p-5 shadow-sm border border-surface-container-high/60 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">contact_support</span>
              <h3 className="text-sm font-bold text-on-surface">Instructor Review &amp; Student Appeal</h3>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your course instructor has been provided with this telemetry timeline, terminal state snapshot, and your preserved answers.
            </p>

            {appealSubmitted ? (
              <div className="p-4 rounded-xl bg-tertiary-container text-on-tertiary flex items-center gap-3">
                <span className="material-symbols-outlined text-on-tertiary-container text-[24px]">verified</span>
                <div>
                  <h4 className="text-xs font-bold text-on-tertiary">Appeal Transmitted Successfully</h4>
                  <p className="text-[11px] text-on-tertiary-container">Your instructor will review your explanation note alongside the execution timeline.</p>
                </div>
              </div>
            ) : showAppealForm ? (
              <form onSubmit={handleSubmitAppeal} className="space-y-3 bg-white p-4 rounded-xl border border-surface-container-high">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface">Explanatory Note to Instructor</span>
                  <button type="button" onClick={() => setShowAppealForm(false)} className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="e.g. My laptop displayed an unexpected low battery alert which toggled full-screen mode..."
                  rows={3}
                  className="w-full p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                  required
                />

                <button
                  type="submit"
                  className="h-10 px-4 bg-primary text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 ml-auto"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Send Appeal Note</span>
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowAppealForm(true)}
                className="w-full h-11 bg-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                <span>Submit Review Note to Instructor</span>
              </button>
            )}

            <Link
              href="/student/dashboard"
              className="w-full h-11 bg-surface-container-lowest text-on-surface rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-surface-container transition-colors shadow-sm border border-surface-container-high/60"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Return to Student Dashboard</span>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
