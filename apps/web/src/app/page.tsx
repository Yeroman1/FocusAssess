'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, signInWithGoogle, isLoading } = useAuth();
  const [examKey, setExamKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleValidateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examKey.trim()) return;

    if (!user) {
      setErrorMessage('Please sign in with Google before entering an examination session.');
      return;
    }

    setIsValidating(true);
    setErrorMessage('');

    try {
      const data = await fetchWithAuth('/exam-entry/validate-key', {
        method: 'POST',
        body: JSON.stringify({ key: examKey.trim().toUpperCase() }),
      });

      if (data.canResume && data.activeAttempt) {
        router.push(`/student/attempts/${data.activeAttempt.id}`);
      } else if (data.exam) {
        router.push(`/student/exams/${data.exam.id}/instructions`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid examination key or ineligible session');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="flex-1 pt-24 pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-secondary font-mono text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-ping" />
            Supervised Runtime • Python 3.12 Kernel
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-on-surface">
            Secure Python Examination &amp; Automatic Assessment Platform
          </h1>

          <p className="text-base md:text-lg text-on-surface-variant leading-relaxed">
            Engineered for high-stakes university programming evaluations. Real-time browser telemetry,
            server-authoritative trust scoring, and behavioral test-case auto-grading in an isolated sandbox.
          </p>

          {!user && !isLoading && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => signInWithGoogle('/student/dashboard')}
                className="h-12 px-6 rounded-xl bg-white border border-surface-container-high hover:border-secondary hover:shadow-md text-sm font-semibold text-on-surface flex items-center gap-3 transition-all active:scale-[0.99]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          )}
        </div>

        {/* Central Assessment Key Entry Bento Card */}
        <div className="max-w-xl mx-auto w-full bg-surface-container-lowest p-6 md:p-8 rounded-2xl shadow-sm border border-surface-container-high/80 mb-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">key</span>
              </div>
              <h2 className="text-lg font-semibold text-on-surface">Enter Examination Key</h2>
            </div>
            <span className="font-mono text-xs text-on-surface-variant font-semibold">TOKEN DISPATCH</span>
          </div>

          <p className="text-sm text-on-surface-variant mb-5">
            Received an authorized access token from your instructor or test administrator? Enter the key below to initiate your session verification.
          </p>

          <form onSubmit={handleValidateKey} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={examKey}
                  onChange={(e) => setExamKey(e.target.value.toUpperCase())}
                  placeholder="e.g. CS204-XYZ"
                  className="w-full h-12 px-4 bg-surface-container-low text-on-surface rounded-xl font-mono text-base uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-secondary focus:bg-white transition-all border border-surface-container-high"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isValidating}
                className="h-12 px-6 bg-primary text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    Verifying...
                  </>
                ) : (
                  <>
                    <span>Verify Token</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-error-container text-error text-xs flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{errorMessage}</span>
              </div>
            )}
          </form>

          {/* Quick Portal Switcher */}
          <div className="mt-8 pt-6 border-t border-surface-container-high grid grid-cols-3 gap-2 text-center">
            <Link
              href="/student/dashboard"
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-xs font-semibold text-secondary flex flex-col items-center gap-1"
            >
              <span className="material-symbols-outlined text-[20px]">school</span>
              Student Hub
            </Link>
            <Link
              href="/instructor/dashboard"
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-xs font-semibold text-primary flex flex-col items-center gap-1"
            >
              <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
              Instructor
            </Link>
            <Link
              href="/admin/dashboard"
              className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-xs font-semibold text-on-surface-variant flex flex-col items-center gap-1"
            >
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              Admin
            </Link>
          </div>
        </div>

        {/* Platform Core Safeguards Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          <div className="p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high flex flex-col space-y-2">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary mb-2">
              <span className="material-symbols-outlined text-[22px]">shield_lock</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface">Strict Anti-Cheating Telemetry</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Real-time monitoring of window blur, visibility loss, and fullscreen integrity. Server enforces strictly &lt; 70% automatic termination with immutable audit preservation.
            </p>
          </div>

          <div className="p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high flex flex-col space-y-2">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-tertiary-container mb-2">
              <span className="material-symbols-outlined text-[22px]">code</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface">Monaco Python Sandbox</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Industrial VS Code-grade editor with syntax highlighting and automatic indentation. Execution is strictly blocked during testing to eliminate trial-and-error bias.
            </p>
          </div>

          <div className="p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high flex flex-col space-y-2">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary mb-2">
              <span className="material-symbols-outlined text-[22px]">terminal</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface">Behavioral Auto-Grading</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Evaluated against hidden test suites in an isolated Linux container with timeout, memory, and output bounds. Grades solutions by I/O behavior, never fixed string matching.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
