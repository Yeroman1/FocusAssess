'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function StudentResultsPage() {
  return (
    <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
      <StudentResultsContent />
    </ProtectedRoute>
  );
}

function StudentResultsContent() {
  const params = useParams();
  const attemptId = params.attemptId as string;

  const [resultData, setResultData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth(`/attempts/${attemptId}/results`)
      .then((data) => {
        setResultData(data);
      })
      .catch((err) => {
        console.error('Failed to load assessment results:', err);
        setError(err.message || 'Unable to retrieve examination result.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [attemptId]);

  return (
    <>
      <Navbar />

      <main className="flex-1 flex flex-col relative w-full pt-16 sm:pt-20 pb-12 sm:pb-16 bg-surface px-3 sm:px-4 md:px-8 max-w-2xl mx-auto">
        <div className="flex flex-col w-full pb-8 space-y-4 sm:space-y-5">
          {/* Header Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-6 shadow-sm border border-surface-container-high/60 text-center space-y-3">
            {loading ? (
              <div className="py-12 space-y-3 text-center">
                <span className="material-symbols-outlined text-[36px] text-secondary animate-spin">refresh</span>
                <p className="text-xs text-on-surface-variant font-mono">Loading examination outcome from database...</p>
              </div>
            ) : error ? (
              <div className="py-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-error-container text-error mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px]">error</span>
                </div>
                <h1 className="text-lg font-bold text-on-surface">Result Unavailable</h1>
                <p className="text-xs text-on-surface-variant">{error}</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-tertiary-container text-on-tertiary mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-on-tertiary-container">verified</span>
                </div>

                <h1 className="text-xl font-bold text-on-surface">
                  {resultData?.examTitle || 'Examination Outcome'}
                </h1>
                <p className="text-xs text-on-surface-variant font-mono">
                  Attempt Reference #{attemptId.slice(0, 8).toUpperCase()}
                </p>

                {/* If Results Released */}
                {resultData?.resultsReleased ? (
                  <div className="pt-4 border-t border-surface-container-high space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-4xl font-bold font-mono text-on-surface">
                        {resultData.totalMarksAwarded ?? 0}
                      </span>
                      <span className="text-base text-on-surface-variant font-mono">
                        / {resultData.maxMarksTotal ?? 100} MARKS
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-mono text-xs font-bold">
                      Score: {resultData.percentageScore ?? 0}% • Assessment Finalized
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 text-left">
                      <div className="p-3 rounded-xl bg-surface-container-low">
                        <span className="text-[10px] uppercase font-mono text-on-surface-variant block">Integrity Trust Index</span>
                        <span className="text-sm font-bold font-mono text-on-tertiary-container">
                          {resultData.trustScore}% Verified
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-surface-container-low">
                        <span className="text-[10px] uppercase font-mono text-on-surface-variant block">Auto-Grader Status</span>
                        <span className="text-sm font-bold font-mono text-secondary capitalize">
                          {resultData.gradingStatus || 'Evaluated'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* If Results Pending Release */
                  <div className="pt-4 border-t border-surface-container-high space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-secondary font-mono text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                      Grading Finalized • Awaiting Instructor Release
                    </div>

                    <p className="text-xs text-on-surface-variant max-w-md mx-auto pt-2 leading-relaxed">
                      Your solutions have been safely evaluated by the automated grading worker. Formal grades and individual test breakdowns will appear immediately once released by your instructor.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <Link
            href="/student/dashboard"
            className="w-full h-11 bg-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            <span>Return to Student Dashboard</span>
          </Link>
        </div>
      </main>
    </>
  );
}
