'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';

export default function CreateExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [instructions, setInstructions] = useState('');
  const [qTitle, setQTitle] = useState('');
  const [qStatement, setQStatement] = useState('');
  const [qMarks, setQMarks] = useState(25);
  const [tcInput, setTcInput] = useState('');
  const [tcOutput, setTcOutput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const handleCreateAndPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Create exam
      const examRes = await fetchWithAuth('/exams', {
        method: 'POST',
        body: JSON.stringify({
          title,
          durationMinutes: Number(durationMinutes),
          instructions,
        }),
      });

      const examId = examRes.exam.id;

      // 2. Add Question
      const qRes = await fetchWithAuth(`/exams/${examId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          title: qTitle,
          statement: qStatement,
          maxMarks: Number(qMarks),
          position: 1,
        }),
      });

      // 3. Add Test Case
      await fetchWithAuth(`/questions/${qRes.question.id}/test-cases`, {
        method: 'POST',
        body: JSON.stringify({
          stdin: tcInput,
          expectedOutput: tcOutput,
          marks: Number(qMarks),
          isHidden: false,
          position: 1,
        }),
      });

      // 4. Publish Exam & Generate Secure Key
      const pubRes = await fetchWithAuth(`/exams/${examId}/publish`, {
        method: 'POST',
      });

      setCreatedKey(pubRes.examKey);
    } catch (err: any) {
      alert(`Error creating exam: ${err.message || 'Operation failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />

      <main className="flex-1 pt-20 pb-16 px-4 md:px-8 max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Link href="/instructor/dashboard" className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <h1 className="text-xl font-bold text-on-surface">Configure New Python Examination</h1>
          </div>

          {createdKey ? (
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-tertiary-fixed shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-on-tertiary-container text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">key</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Examination Published Successfully</h2>
                  <p className="text-xs text-on-surface-variant">Distribute the secure cryptographic token to eligible students.</p>
                </div>
              </div>

              <div className="p-4 bg-surface-container-low rounded-xl text-center space-y-1">
                <span className="text-[10px] uppercase font-mono text-on-surface-variant">Generated Access Token</span>
                <div className="text-2xl font-mono font-bold text-secondary tracking-widest select-all">{createdKey}</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link
                  href="/instructor/dashboard"
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateAndPublish} className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-5">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">1. Basic Specification</h2>

                <div>
                  <label className="text-xs font-medium text-on-surface block mb-1">Assessment Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. CS204 Advanced Algorithmic Midterm"
                    className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary border border-surface-container-high"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-on-surface block mb-1">Duration (Minutes)</label>
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary border border-surface-container-high"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-on-surface block mb-1">Python Version</label>
                    <input
                      type="text"
                      disabled
                      value="Python 3.12 (Strict Sandbox)"
                      className="w-full h-10 px-3 bg-surface-container rounded-xl text-xs font-mono text-on-surface-variant border border-surface-container-high"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-surface-container-high">
                <h2 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">2. Primary Question Setup</h2>

                <div>
                  <label className="text-xs font-medium text-on-surface block mb-1">Question Title</label>
                  <input
                    type="text"
                    value={qTitle}
                    onChange={(e) => setQTitle(e.target.value)}
                    className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-on-surface block mb-1">Problem Statement</label>
                  <textarea
                    value={qStatement}
                    onChange={(e) => setQStatement(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-on-surface block mb-1">Test Stdin</label>
                    <input
                      type="text"
                      value={tcInput}
                      onChange={(e) => setTcInput(e.target.value)}
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono text-on-surface border border-surface-container-high"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-on-surface block mb-1">Expected Output</label>
                    <input
                      type="text"
                      value={tcOutput}
                      onChange={(e) => setTcOutput(e.target.value)}
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono text-on-surface border border-surface-container-high"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-container-high flex justify-end gap-3">
                <Link
                  href="/instructor/dashboard"
                  className="px-4 h-11 rounded-xl bg-surface-container text-xs font-medium text-on-surface flex items-center justify-center hover:bg-surface-container-high"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 h-11 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish & Generate Token'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
