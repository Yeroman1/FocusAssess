'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fetchWithAuth } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function CreateExamPage() {
  return (
    <ProtectedRoute allowedRoles={['instructor', 'admin']}>
      <CreateExamContent />
    </ProtectedRoute>
  );
}

function CreateExamContent() {
  const router = useRouter();

  // Step 1: Exam Basic Specifications
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [availableFrom, setAvailableFrom] = useState('');
  const [instructions, setInstructions] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (!title.trim()) {
        throw new Error('Please provide an assessment title.');
      }
      if (durationMinutes < 5 || durationMinutes > 300) {
        throw new Error('Duration must be between 5 and 300 minutes.');
      }

      // Format ISO start date if specified
      let formattedStart: string | undefined = undefined;
      if (availableFrom && availableFrom.trim() !== '') {
        const parsedDate = new Date(availableFrom);
        if (!isNaN(parsedDate.getTime())) {
          formattedStart = parsedDate.toISOString();
        }
      }

      const res = await fetchWithAuth('/exams', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          durationMinutes: Number(durationMinutes),
          availableFrom: formattedStart,
          instructions: instructions.trim() || undefined,
          maxAttempts: Number(maxAttempts) || 1,
        }),
      });

      const examId = res?.exam?.id;
      if (!examId) {
        throw new Error('Failed to retrieve created exam identifier.');
      }

      // Direct to Step 2: Dynamic Question Builder page
      router.push(`/instructor/exams/${examId}/builder`);
    } catch (err: any) {
      console.error('Error creating exam:', err);
      setErrorMsg(err.message || 'Failed to initialize examination.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      portalRole="instructor"
      title="Create New Examination"
      subtitle="Step 1: Basic Specifications, Scheduling & Student Message"
    >
      <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            href="/instructor/dashboard"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            title="Return to Instructor Dashboard"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <span className="text-xs font-mono uppercase tracking-wider text-on-surface-variant">
            Instructor Console / Examinations / New
          </span>
        </div>

        {/* Multi-Step Visual Progress Stepper */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step 1: Active */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs font-mono shadow-sm">
                1
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-primary leading-tight truncate">
                  Exam Details
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">Title & Schedule</span>
              </div>
            </div>

            {/* Step 2: Next */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high opacity-70">
              <div className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface-variant flex items-center justify-center font-bold text-xs font-mono">
                2
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-on-surface leading-tight truncate">
                  Question Builder
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">Python Code & Output</span>
              </div>
            </div>

            {/* Step 3: Upcoming */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high opacity-70">
              <div className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface-variant flex items-center justify-center font-bold text-xs font-mono">
                3
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-on-surface leading-tight truncate">
                  Publish & Token
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">Access Distribution</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error notification alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-error-container/30 border border-error/30 text-error flex items-center gap-3 text-xs">
            <span className="material-symbols-outlined text-[20px] flex-shrink-0">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1 Form: Exam Specifications */}
        <form
          onSubmit={handleSubmitStep1}
          className="bg-surface-container-lowest p-5 sm:p-7 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
            <div>
              <h2 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
                1. Assessment Specifications
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Define the core title, duration, schedule, and candidate instructions.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-[11px] font-mono font-bold">
              Python 3.12 Runtime
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-on-surface block mb-1.5">
              Assessment Title <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CS204 Advanced Algorithmic Midterm Examination"
              className="w-full h-11 px-3.5 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container-high transition-all"
              required
            />
            <p className="text-[11px] text-on-surface-variant font-mono mt-1">
              Descriptive title displayed on candidate dashboards and proctoring logs.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-on-surface block mb-1.5">
              Assessment Description <span className="text-on-surface-variant font-normal font-mono">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. Comprehensive evaluation of dynamic programming, binary search trees, and algorithmic complexity in Python."
              className="w-full p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container-high resize-none transition-all"
            />
            <p className="text-[11px] text-on-surface-variant font-mono mt-1">
              Outlines the assessment scope, topics covered, and evaluation criteria.
            </p>
          </div>

          {/* Duration & Start Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-on-surface block mb-1.5">
                Duration (Minutes) <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full h-11 px-3.5 bg-surface-container-low rounded-xl text-xs font-mono font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container-high transition-all"
                  required
                />
                <span className="absolute right-3.5 top-3 text-[11px] font-mono text-on-surface-variant pointer-events-none">
                  mins
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono mt-1">
                Standard duration is 60 to 120 minutes.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1.5">
                When it Starts <span className="text-on-surface-variant font-normal font-mono">(Optional)</span>
              </label>
              <input
                type="datetime-local"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="w-full h-11 px-3.5 bg-surface-container-low rounded-xl text-xs font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container-high transition-all"
              />
              <p className="text-[11px] text-on-surface-variant font-mono mt-1">
                Leave blank for on-demand exams starting immediately upon token access.
              </p>
            </div>
          </div>

          {/* Message to Students / Instructions */}
          <div>
            <label className="text-xs font-bold text-on-surface block mb-1.5">
              Message to Students / Exam Instructions <span className="text-on-surface-variant font-normal font-mono">(Optional)</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="e.g. Welcome candidates. Please read each problem carefully. Write idiomatic Python 3 code. Tab switching and copy-pasting are strictly monitored by the proctoring kernel. Good luck!"
              className="w-full p-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 border border-surface-container-high resize-none transition-all"
            />
            <p className="text-[11px] text-on-surface-variant font-mono mt-1">
              Presented to students on the pre-exam instruction screen and pinned in the assessment sidebar.
            </p>
          </div>

          {/* Sandbox & Runtime Information Card */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary flex-shrink-0">
                <span className="material-symbols-outlined text-[20px]">terminal</span>
              </div>
              <div>
                <span className="text-xs font-bold text-on-surface block">
                  Isolated Python Execution Sandbox
                </span>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  Python 3.12 • Subprocess Jail • Memory & CPU Constraints
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                Ready for Question Setup
              </span>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-4 border-t border-surface-container-high flex flex-col-reverse sm:flex-row justify-between items-center gap-3">
            <Link
              href="/instructor/dashboard"
              className="w-full sm:w-auto px-5 h-11 rounded-xl bg-surface-container text-xs font-semibold text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-7 h-11 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 active:scale-95"
            >
              <span>{isSubmitting ? 'Creating Draft Exam...' : 'Save & Continue to Question Builder'}</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}