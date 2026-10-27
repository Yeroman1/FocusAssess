'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function RulesPage() {
  return (
    <>
      <Navbar />

      <main className="flex-1 pt-20 pb-16 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold text-on-surface">PyAssess Examination Protocols &amp; Integrity Guidelines</h1>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-6 text-sm text-on-surface">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">verified_user</span>
                1. Automated Telemetric Integrity Monitoring
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                PyAssess is engineered to protect examination equity for all students. Every examination attempt begins with an authoritative baseline trust index of 100%. Transparent client telemetry monitors active window focus, visibility status, and fullscreen containment.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-error">gavel</span>
                2. Mandatory Trust-Score Termination Boundary (&lt; 70%)
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                In accordance with academic protocol, if a student's calculated trust score drops strictly below 70%, the examination runtime environment is immediately halted by the automated integrity safeguard. A score of exactly 70% does not trigger termination.
              </p>
              <div className="p-3 bg-error-container/30 rounded-xl text-xs text-error font-medium">
                Termination halts active input to prevent compounding penalties, preserves all autosaved solutions, and flags the session for independent instructor review. It does not constitute a permanent or irreversible accusation of misconduct.
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-on-tertiary-container">terminal</span>
                3. Strict Backend-Only Compilation
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                During active examination testing, students write code in the embedded Monaco editor without interactive stdout feedback or immediate execution. All candidate solutions are compiled and evaluated exclusively against private test harnesses upon final submission or server deadline expiration.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">psychology_alt</span>
                4. Behavioral Grading Doctrine
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                All algorithmic questions are graded behaviorally by observing standard input to standard output correspondence, never by matching fixed source code strings. Different valid algorithms, loop constructs, or helper routines are granted full credit provided they meet behavioral constraints.
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
