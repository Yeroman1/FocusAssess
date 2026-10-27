'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';

export default function PreExamInstructionsPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const [examData, setExamData] = useState<any>(null);
  const [acknowledgments, setAcknowledgments] = useState([false, false, false, false]);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchWithAuth(`/exams/${examId}/instructions`)
      .then((data) => setExamData(data.exam))
      .catch((err) => {
        console.error('Failed to load examination instructions:', err);
        setErrorMessage(err.message || 'Unable to retrieve examination instructions. Check exam ID or key authorization.');
      });
  }, [examId]);

  const toggleCheck = (index: number) => {
    const updated = [...acknowledgments];
    updated[index] = !updated[index];
    setAcknowledgments(updated);
  };

  const allConfirmed = acknowledgments.every(Boolean);
  const confirmedCount = acknowledgments.filter(Boolean).length;

  const handleBeginExam = async () => {
    if (!allConfirmed || isStarting) return;
    setIsStarting(true);
    setErrorMessage('');

    try {
      const data = await fetchWithAuth(`/exams/${examId}/attempts`, {
        method: 'POST',
      });

      router.push(`/student/attempts/${data.attempt.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start examination session');
      setIsStarting(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="flex-1 flex flex-col relative w-full pt-20 pb-16 bg-surface px-4 md:px-8 max-w-3xl mx-auto">
        <div className="flex flex-col w-full pb-8">
          {/* Context Header Banner */}
          <section className="bg-surface-container-low rounded-2xl p-5 shadow-sm mb-4 border border-surface-container-high/60">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-white font-mono text-xs uppercase tracking-wider font-semibold">
                Midterm Assessment
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-on-surface-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container animate-pulse" />
                Environment Ready
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">
              {examData?.title || 'CS204: Python Data Structures & Algorithmic Complexity — Midterm Exam'}
            </h1>

            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              Official supervised assessment run under automated sandbox telemetry. Verify all institutional mandates before initiating the secure runtime session.
            </p>

            {/* Metadata Chip Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <div className="bg-surface-container-lowest rounded-xl p-3 flex items-center gap-2.5 shadow-sm border border-surface-container-high/40">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                </div>
                <div>
                  <span className="block text-[10px] text-on-surface-variant uppercase font-mono">Duration</span>
                  <span className="block text-xs font-semibold text-on-surface">{examData?.durationMinutes || 90} Minutes</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-3 flex items-center gap-2.5 shadow-sm border border-surface-container-high/40">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">code_blocks</span>
                </div>
                <div>
                  <span className="block text-[10px] text-on-surface-variant uppercase font-mono">Problems</span>
                  <span className="block text-xs font-semibold text-on-surface">{examData?.questionCount || 4} Questions</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-3 flex items-center gap-2.5 shadow-sm border border-surface-container-high/40">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">military_tech</span>
                </div>
                <div>
                  <span className="block text-[10px] text-on-surface-variant uppercase font-mono">Total Score</span>
                  <span className="block text-xs font-semibold text-on-surface">100 Marks</span>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-3 flex items-center gap-2.5 shadow-sm border border-surface-container-high/40">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
                <div>
                  <span className="block text-[10px] text-on-surface-variant uppercase font-mono">Pass Mark</span>
                  <span className="block text-xs font-semibold text-on-surface">60% Threshold</span>
                </div>
              </div>
            </div>
          </section>

          {/* Candidate Identity Verification Card */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm mb-4 border border-surface-container-high/60">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
                <h2 className="text-sm font-semibold text-on-surface">Candidate Biometric &amp; Key Token</h2>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
                ECDSA Sealed
              </span>
            </div>

            <div className="bg-surface-container-high/40 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                  AR
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-on-surface truncate">Candidate: Alex R. Vance</span>
                  <span className="block text-[11px] text-on-surface-variant truncate font-mono">ID: PY-99420-CS204</span>
                </div>
              </div>
              <span className="px-2 py-1 bg-surface-container-lowest rounded text-secondary font-mono text-xs font-semibold">
                HASH: 8f9b..c21e
              </span>
            </div>
          </section>

          {/* Transparent Monitoring & Baseline Meter */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm mb-4 border border-surface-container-high/60 space-y-4">
            <div className="bg-secondary/10 text-secondary rounded-xl p-3.5 flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] text-secondary flex-shrink-0">shield_lock</span>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Transparent Browser Monitoring Active</h3>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                  Proctor telemetry tracks window focus state, fullscreen integrity, and display state transitions during active testing.
                </p>
              </div>
            </div>

            {/* Live Baseline Meter Visual */}
            <div className="bg-surface-container-low rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-on-surface flex items-center gap-1 font-mono">
                  <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">speed</span>
                  Baseline Trust Score
                </span>
                <span className="text-xs font-bold font-mono text-on-tertiary-container">100% (Maximum Tier)</span>
              </div>

              <div className="w-full bg-surface-container-highest h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-error h-full" style={{ width: '70%' }} />
                <div className="bg-secondary h-full" style={{ width: '30%' }} />
              </div>

              <div className="flex justify-between items-center mt-1.5 text-[11px] font-mono text-on-surface-variant">
                <span>0% (Revoked)</span>
                <span className="font-semibold text-error">Critical Floor: 70%</span>
                <span>100% (Nominal)</span>
              </div>
            </div>

            {/* Policy Points */}
            <div className="space-y-2.5 pt-1">
              <h4 className="text-xs font-bold text-on-surface uppercase font-mono tracking-wider">Mandatory Execution Protocol</h4>
              <ul className="space-y-2 text-xs text-on-surface leading-normal">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center font-mono text-[10px] font-bold text-secondary flex-shrink-0">1</span>
                  <span><strong>Initial Trust Score is set to 100%.</strong> Every verified candidate initiates with a pristine trust matrix baseline.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center font-mono text-[10px] font-bold text-secondary flex-shrink-0">2</span>
                  <span><strong>Window blur, leaving tab, or exiting fullscreen</strong> triggers precise telemetric deductions from your live trust index.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center font-mono text-[10px] font-bold text-error flex-shrink-0">3</span>
                  <span><strong className="text-error">Trust Score strictly below 70% causes immediate termination.</strong> If points decline strictly lower than 70%, access freezes for instructor adjudication. <em>Score of exactly 70% does not terminate.</em></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center font-mono text-[10px] font-bold text-secondary flex-shrink-0">4</span>
                  <span><strong>Continuous snapshot synchronization.</strong> All accepted code solutions and drafts are automatically preserved upon any network drop or termination event.</span>
                </li>
              </ul>
            </div>

            {/* Sandbox Notice */}
            <div className="p-3 bg-surface-container-high/40 rounded-xl flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant flex-shrink-0 mt-0.5">terminal</span>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                <strong>Strict Backend-Only Compilation:</strong> This exam environment does not provide interactive 'Run Code' or local stdout feedback. Solutions are compiled against isolated PyTest evaluation runners solely upon final session submission.
              </p>
            </div>
          </section>

          {/* Interactive Checkbox Acknowledgments Form */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm mb-4 border border-surface-container-high/60 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-on-surface">Mandatory Acknowledgments</h3>
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                allConfirmed ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {confirmedCount}/4 Confirmed
              </span>
            </div>

            <p className="text-xs text-on-surface-variant">
              Confirm each declaration below. All statements must be accepted before session decryption unlocks.
            </p>

            <div className="space-y-2 pt-1">
              {[
                'I have read and understood all examination instructions and rubric expectations.',
                'I understand the browser monitoring and automated telemetric trust-score policy.',
                'I understand the strict 90-minute countdown and that compilation triggers on final submission.',
                'I agree that scoring strictly below 70% trust terminates my session for manual proctor review.',
              ].map((text, idx) => (
                <label
                  key={idx}
                  onClick={() => toggleCheck(idx)}
                  className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors select-none border border-surface-container-high/40"
                >
                  <input
                    type="checkbox"
                    checked={acknowledgments[idx]}
                    onChange={() => {}}
                    className="mt-0.5 w-4 h-4 rounded text-secondary focus:ring-0 cursor-pointer accent-secondary"
                  />
                  <span className="text-xs text-on-surface leading-snug">{text}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Action Trigger Card */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container-high/60 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">lock_open</span>
                <span>
                  Runtime Status:{' '}
                  <strong className={allConfirmed ? 'text-on-tertiary-container font-bold' : 'text-on-surface'}>
                    {allConfirmed ? 'Decryption Unlocked' : 'Awaiting Verification'}
                  </strong>
                </span>
              </div>
              <span className="text-on-surface-variant">SEED: 0x94BA</span>
            </div>

            {errorMessage && (
              <div className="p-3 bg-error-container text-error text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleBeginExam}
              disabled={!allConfirmed || isStarting}
              className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all ${
                allConfirmed && !isStarting
                  ? 'bg-secondary text-white hover:bg-secondary/90 active:scale-[0.99] cursor-pointer'
                  : 'bg-surface-container-highest text-on-surface-variant opacity-60 cursor-not-allowed'
              }`}
            >
              {isStarting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                  <span>Initializing Secure Sandbox...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">timer</span>
                  <span>Begin Examination (Starts Timer)</span>
                </>
              )}
            </button>

            <Link
              href="/student/dashboard"
              className="w-full h-10 rounded-xl bg-transparent hover:bg-surface-container-low text-on-surface text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Return to Dashboard</span>
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
