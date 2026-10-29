'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, signInWithGoogle, isLoading } = useAuth();

  // Secret shortcut: Ctrl+Shift+S / Cmd+Shift+S navigates to the Admin Panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        router.push('/admin/dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);

  return (
    <>
      <Navbar />

      <main className="flex-1 pt-20 sm:pt-28 pb-12 sm:pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-5 mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-secondary font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-ping" />
            Supervised Runtime • Python 3.12 Kernel
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-on-surface leading-tight">
            Secure Python Examination &amp; Automatic Assessment Platform
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-on-surface-variant leading-relaxed">
            Engineered for high-stakes university programming evaluations. Real-time browser telemetry,
            server-authoritative trust scoring, and behavioral test-case auto-grading in an isolated sandbox.
          </p>

          {/* Authentication Actions */}
          <div className="pt-2 sm:pt-4 flex flex-col items-center justify-center gap-3 w-full">
            {isLoading ? (
              <div className="h-12 flex items-center gap-2 text-sm text-on-surface-variant font-medium">
                <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span>Checking session...</span>
              </div>
            ) : user ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Link
                  href={
                    user.email?.toLowerCase() === 'yeritti2017@gmail.com' || profile?.role === 'admin'
                      ? '/admin/dashboard'
                      : profile?.role === 'instructor'
                      ? '/instructor/dashboard'
                      : '/student/dashboard'
                  }
                  className="w-full sm:w-auto h-12 px-6 rounded-xl bg-primary text-white hover:bg-slate-800 hover:shadow-md text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <span>
                    Go to{' '}
                    {user.email?.toLowerCase() === 'yeritti2017@gmail.com' || profile?.role === 'admin'
                      ? 'Admin Dashboard'
                      : profile?.role === 'instructor'
                      ? 'Instructor Portal'
                      : 'Student Dashboard'}
                  </span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => signInWithGoogle()}
                  className="w-full sm:w-auto h-12 px-5 sm:px-7 rounded-xl bg-white border border-surface-container-high hover:border-secondary hover:shadow-md text-xs sm:text-sm font-semibold text-on-surface flex items-center justify-center gap-2.5 sm:gap-3 transition-all active:scale-[0.99]"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
                  <span>Sign in with Google to Continue</span>
                </button>
                <p className="text-[11px] sm:text-xs text-on-surface-variant max-w-sm sm:max-w-none text-center">
                  Registration and authentication are completed via your institutional or student Google account.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Platform Core Safeguards Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto w-full">
          <div className="p-4 sm:p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high flex flex-col space-y-2">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary mb-2">
              <span className="material-symbols-outlined text-[22px]">shield_lock</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface">Strict Anti-Cheating Telemetry</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Real-time monitoring of window blur, visibility loss, and fullscreen integrity. Server enforces strictly &lt; 70% automatic termination with immutable audit preservation.
            </p>
          </div>

          <div className="p-4 sm:p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high flex flex-col space-y-2">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-tertiary-container mb-2">
              <span className="material-symbols-outlined text-[22px]">code</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface">Monaco Python Sandbox</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Industrial VS Code-grade editor with syntax highlighting and automatic indentation. Execution is strictly blocked during testing to eliminate trial-and-error bias.
            </p>
          </div>

          <div className="p-4 sm:p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high flex flex-col space-y-2">
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
