'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fetchWithAuth } from '@/lib/api';
import { ProtectedRoute } from '@/components/ProtectedRoute';

type QuestionType = 'CODE' | 'TRUE_FALSE' | 'MCQ_SINGLE' | 'MCQ_MULTI' | 'SHORT_ANSWER';

interface TestCaseItem {
  id?: string;
  stdin: string;
  expectedOutput: string;
  marks: number;
  isHidden: boolean;
  comparisonMode: 'TRIMMED_TEXT' | 'EXACT_TEXT' | 'NUMERIC_TOLERANCE';
}

interface QuestionItem {
  id: string;
  title: string;
  statement: string;
  inputDescription?: string;
  outputDescription?: string;
  constraints?: string;
  maxMarks: number;
  position: number;
  testCases?: TestCaseItem[];
}

interface ExamDetails {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  durationMinutes: number;
  availableFrom?: string;
  status: string;
  currentVersion: number;
  versions?: Array<{
    id: string;
    versionNumber: number;
    questions: QuestionItem[];
  }>;
}

export default function ExamBuilderPage() {
  return (
    <ProtectedRoute allowedRoles={['instructor', 'admin']}>
      <ExamBuilderContent />
    </ProtectedRoute>
  );
}

function ExamBuilderContent() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = useState<ExamDetails | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Question Creation Form State
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [selectedType, setSelectedType] = useState<QuestionType>('CODE');
  const [qTitle, setQTitle] = useState('');
  const [qStatement, setQStatement] = useState('');
  const [qInputDesc, setQInputDesc] = useState('');
  const [qOutputDesc, setQOutputDesc] = useState('');
  const [qConstraints, setQConstraints] = useState('');
  const [qMarks, setQMarks] = useState(25);

  // State for True / False questions (single text field, auto-numbered)
  const [tfStatement, setTfStatement] = useState('');
  const [tfCorrect, setTfCorrect] = useState<boolean>(true);

  // Dynamic Test Cases for Python Code Question
  const [testCases, setTestCases] = useState<TestCaseItem[]>([
    {
      stdin: '5\n1 2 3 4 5',
      expectedOutput: '15',
      marks: 10,
      isHidden: false,
      comparisonMode: 'TRIMMED_TEXT',
    },
    {
      stdin: '3\n10 20 30',
      expectedOutput: '60',
      marks: 15,
      isHidden: true,
      comparisonMode: 'TRIMMED_TEXT',
    },
  ]);

  // State for MCQ questions
  const [mcqOptions, setMcqOptions] = useState<string[]>([
    'O(1) Constant Time',
    'O(N) Linear Time',
    'O(log N) Logarithmic Time',
    'O(N^2) Quadratic Time',
  ]);
  const [mcqCorrectIdx, setMcqCorrectIdx] = useState<number>(0);
  const [mcqMultiCorrect, setMcqMultiCorrect] = useState<boolean[]>([true, false, false, false]);

  // State for Short Answer / Output Prediction
  const [shortAnswerExpected, setShortAnswerExpected] = useState('');

  // Submission & Publish States
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedToken, setPublishedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Edit Step 1 Modal State
  const [isEditingExam, setIsEditingExam] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDuration, setEditDuration] = useState(90);
  const [editStart, setEditStart] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [isUpdatingExam, setIsUpdatingExam] = useState(false);

  // Load Exam Details
  const loadExam = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetchWithAuth(`/exams/${examId}`);
      if (res.exam) {
        setExam(res.exam);
        const versionQuestions = res.exam.versions?.[0]?.questions || [];
        setQuestions(versionQuestions);

        // Prep edit fields
        setEditTitle(res.exam.title || '');
        setEditDescription(res.exam.description || '');
        setEditDuration(res.exam.durationMinutes || 90);
        setEditStart(
          res.exam.availableFrom ? new Date(res.exam.availableFrom).toISOString().slice(0, 16) : ''
        );
        setEditInstructions(res.exam.instructions || '');
      }
    } catch (err: any) {
      console.error('Error fetching exam:', err);
      setErrorMsg(err.message || 'Failed to load exam details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (examId) {
      loadExam();
    }
  }, [examId]);

  // Reset Question Creation Form
  const resetQuestionForm = () => {
    setQTitle('');
    setQStatement('');
    setQInputDesc('');
    setQOutputDesc('');
    setQConstraints('');
    setQMarks(25);
    setTestCases([
      {
        stdin: '',
        expectedOutput: '',
        marks: 10,
        isHidden: false,
        comparisonMode: 'TRIMMED_TEXT',
      },
      {
        stdin: '',
        expectedOutput: '',
        marks: 15,
        isHidden: true,
        comparisonMode: 'TRIMMED_TEXT',
      },
    ]);
    setMcqOptions([
      'Option A',
      'Option B',
      'Option C',
      'Option D',
    ]);
    setMcqCorrectIdx(0);
    setMcqMultiCorrect([true, false, false, false]);
    setShortAnswerExpected('');
    setTfStatement('');
    setTfCorrect(true);
    setIsAddingQuestion(false);
  };

  // Add new Test Case row
  const handleAddTestCase = () => {
    setTestCases((prev) => [
      ...prev,
      {
        stdin: '',
        expectedOutput: '',
        marks: 5,
        isHidden: true,
        comparisonMode: 'TRIMMED_TEXT',
      },
    ]);
  };

  // Remove Test Case row
  const handleRemoveTestCase = (index: number) => {
    if (testCases.length <= 1) {
      alert('Every programming question must have at least one test case.');
      return;
    }
    setTestCases((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-distribute question marks equally across test cases
  const handleDistributeMarks = () => {
    if (testCases.length === 0) return;
    const perCase = Math.max(1, Math.floor(qMarks / testCases.length));
    const remainder = qMarks - perCase * testCases.length;
    setTestCases((prev) =>
      prev.map((tc, idx) => ({
        ...tc,
        marks: idx === 0 ? perCase + remainder : perCase,
      }))
    );
  };

  // Save Question to Exam
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingQuestion(true);
    setErrorMsg(null);

    try {
      // 1. Specialized handler for TRUE_FALSE (no title, no description, single text field)
      if (selectedType === 'TRUE_FALSE') {
        if (!tfStatement.trim()) {
          throw new Error(`Please enter the statement for Question ${questions.length + 1}.`);
        }
        if (qMarks <= 0) {
          throw new Error('Question marks must be greater than zero.');
        }

        const autoTitle = `Question ${questions.length + 1}`;
        const expectedVal = tfCorrect ? 'True' : 'False';

        await fetchWithAuth(`/exams/${examId}/questions-with-testcases`, {
          method: 'POST',
          body: JSON.stringify({
            title: autoTitle,
            statement: tfStatement.trim(),
            inputDescription: 'Select whether the statement is True or False.',
            outputDescription: `Expected answer: ${expectedVal}`,
            constraints: 'True / False Question',
            maxMarks: Number(qMarks) || 5,
            position: questions.length + 1,
            testCases: [
              {
                stdin: '',
                expectedOutput: expectedVal,
                marks: Number(qMarks) || 5,
                isHidden: false,
                comparisonMode: 'TRIMMED_TEXT',
              },
            ],
          }),
        });

        await loadExam();
        resetQuestionForm();
        return;
      }

      if (!qTitle.trim()) {
        throw new Error('Please enter a question title.');
      }
      if (!qStatement.trim()) {
        throw new Error('Please enter the question statement / problem prompt.');
      }
      if (qMarks <= 0) {
        throw new Error('Question marks must be greater than zero.');
      }

      let payloadTestCases: TestCaseItem[] = [];

      if (selectedType === 'CODE') {
        if (testCases.length === 0) {
          throw new Error('At least one testcase with expected output is required.');
        }
        for (let i = 0; i < testCases.length; i++) {
          if (!testCases[i].expectedOutput.trim()) {
            throw new Error(`Test Case #${i + 1} requires an expected output.`);
          }
        }
        payloadTestCases = testCases.map((tc) => ({
          stdin: tc.stdin,
          expectedOutput: tc.expectedOutput,
          marks: Number(tc.marks) || 0,
          isHidden: tc.isHidden,
          comparisonMode: tc.comparisonMode,
        }));
      } else if (selectedType === 'MCQ_SINGLE') {
        const correctOption = mcqOptions[mcqCorrectIdx] || 'Option A';
        const formattedStatement = `${qStatement}\n\n**Options:**\n${mcqOptions
          .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
          .join('\n')}`;

        payloadTestCases = [
          {
            stdin: '',
            expectedOutput: String.fromCharCode(65 + mcqCorrectIdx),
            marks: Number(qMarks),
            isHidden: false,
            comparisonMode: 'TRIMMED_TEXT',
          },
        ];

        // Override statement with options
        await fetchWithAuth(`/exams/${examId}/questions-with-testcases`, {
          method: 'POST',
          body: JSON.stringify({
            title: `[MCQ] ${qTitle.trim()}`,
            statement: formattedStatement,
            inputDescription: 'Select the correct letter corresponding to the answer (A, B, C, D).',
            outputDescription: `Expected answer: ${String.fromCharCode(65 + mcqCorrectIdx)} (${correctOption})`,
            constraints: 'Single Choice Evaluation',
            maxMarks: Number(qMarks),
            position: questions.length + 1,
            testCases: payloadTestCases,
          }),
        });

        await loadExam();
        resetQuestionForm();
        return;
      } else if (selectedType === 'MCQ_MULTI') {
        const correctLetters = mcqOptions
          .map((opt, i) => (mcqMultiCorrect[i] ? String.fromCharCode(65 + i) : null))
          .filter(Boolean)
          .join(', ');

        const formattedStatement = `${qStatement}\n\n**Options (Select all that apply):**\n${mcqOptions
          .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
          .join('\n')}`;

        payloadTestCases = [
          {
            stdin: '',
            expectedOutput: correctLetters,
            marks: Number(qMarks),
            isHidden: false,
            comparisonMode: 'TRIMMED_TEXT',
          },
        ];

        await fetchWithAuth(`/exams/${examId}/questions-with-testcases`, {
          method: 'POST',
          body: JSON.stringify({
            title: `[Multi-Select] ${qTitle.trim()}`,
            statement: formattedStatement,
            inputDescription: 'Select all correct option letters (comma-separated, e.g. A, C).',
            outputDescription: `Expected answers: ${correctLetters}`,
            constraints: 'Multiple Choice Evaluation',
            maxMarks: Number(qMarks),
            position: questions.length + 1,
            testCases: payloadTestCases,
          }),
        });

        await loadExam();
        resetQuestionForm();
        return;
      } else if (selectedType === 'SHORT_ANSWER') {
        if (!shortAnswerExpected.trim()) {
          throw new Error('Please enter the expected output / answer.');
        }

        payloadTestCases = [
          {
            stdin: '',
            expectedOutput: shortAnswerExpected.trim(),
            marks: Number(qMarks),
            isHidden: false,
            comparisonMode: 'TRIMMED_TEXT',
          },
        ];

        await fetchWithAuth(`/exams/${examId}/questions-with-testcases`, {
          method: 'POST',
          body: JSON.stringify({
            title: `[Output Prediction] ${qTitle.trim()}`,
            statement: qStatement,
            inputDescription: 'None / Direct Output Prediction',
            outputDescription: 'Exact output string predicted from code execution',
            constraints: 'Standard Output Match',
            maxMarks: Number(qMarks),
            position: questions.length + 1,
            testCases: payloadTestCases,
          }),
        });

        await loadExam();
        resetQuestionForm();
        return;
      }

      // Save Python Code Question
      await fetchWithAuth(`/exams/${examId}/questions-with-testcases`, {
        method: 'POST',
        body: JSON.stringify({
          title: qTitle.trim(),
          statement: qStatement.trim(),
          inputDescription: qInputDesc.trim() || undefined,
          outputDescription: qOutputDesc.trim() || undefined,
          constraints: qConstraints.trim() || undefined,
          maxMarks: Number(qMarks),
          position: questions.length + 1,
          testCases: payloadTestCases,
        }),
      });

      await loadExam();
      resetQuestionForm();
    } catch (err: any) {
      console.error('Error saving question:', err);
      setErrorMsg(err.message || 'Failed to save question.');
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question and all its test cases?')) {
      return;
    }

    try {
      await fetchWithAuth(`/exams/${examId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      await loadExam();
    } catch (err: any) {
      console.error('Error deleting question:', err);
      alert(`Failed to delete question: ${err.message}`);
    }
  };

  // Update Exam Details (Step 1 edit)
  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingExam(true);
    try {
      let formattedStart: string | undefined = undefined;
      if (editStart && editStart.trim() !== '') {
        const d = new Date(editStart);
        if (!isNaN(d.getTime())) formattedStart = d.toISOString();
      }

      await fetchWithAuth(`/exams/${examId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
          durationMinutes: Number(editDuration),
          availableFrom: formattedStart,
          instructions: editInstructions.trim() || undefined,
        }),
      });

      setIsEditingExam(false);
      await loadExam();
    } catch (err: any) {
      alert(`Failed to update exam specifications: ${err.message}`);
    } finally {
      setIsUpdatingExam(false);
    }
  };

  // Publish Examination
  const handlePublishExam = async () => {
    if (questions.length === 0) {
      alert('You must add at least one question before publishing the examination.');
      return;
    }

    if (!confirm('Are you ready to publish this examination? A secure cryptographic access key will be generated for student distribution.')) {
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetchWithAuth(`/exams/${examId}/publish`, {
        method: 'POST',
      });
      setPublishedToken(res.examKey);
      await loadExam();
    } catch (err: any) {
      console.error('Publish error:', err);
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Close / Unpublish Exam Entry
  const [isTogglingEntry, setIsTogglingEntry] = useState(false);

  const handleCloseEntry = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to close entry to this examination?\n\n' +
      '• Students who have already entered and started will continue taking the test uninterrupted.\n' +
      '• No new students will be allowed to enter, even if they have the correct examination key.'
    );
    if (!confirmed) return;

    setIsTogglingEntry(true);
    try {
      const res = await fetchWithAuth(`/exams/${examId}/close`, { method: 'POST' });
      setExam(res.exam);
      await loadExam();
    } catch (err: any) {
      alert(`Failed to close examination entry: ${err.message}`);
    } finally {
      setIsTogglingEntry(false);
    }
  };

  const handleReopenEntry = async () => {
    const confirmed = window.confirm(
      'Reopen examination entry?\n\n' +
      '• New students with the valid examination key will once again be permitted to enter and begin.'
    );
    if (!confirmed) return;

    setIsTogglingEntry(true);
    try {
      const res = await fetchWithAuth(`/exams/${examId}/reopen`, { method: 'POST' });
      setExam(res.exam);
      await loadExam();
    } catch (err: any) {
      alert(`Failed to reopen examination entry: ${err.message}`);
    } finally {
      setIsTogglingEntry(false);
    }
  };

  // Copy token to clipboard
  const handleCopyToken = () => {
    if (publishedToken) {
      navigator.clipboard.writeText(publishedToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 3000);
    }
  };

  const totalMarksTally = questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0);

  if (isLoading && !exam) {
    return (
      <DashboardLayout portalRole="instructor" title="Dynamic Question Builder" subtitle="Loading examination configuration...">
        <div className="flex items-center justify-center p-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-on-surface-variant">Accessing assessment kernel...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      portalRole="instructor"
      title={exam?.title || 'Dynamic Question Builder'}
      subtitle="Step 2: Add Python Coding Questions, Test Cases & Expected Outputs"
    >
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-20">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/instructor/dashboard"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              title="Return to Instructor Dashboard"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <span className="text-xs font-mono uppercase tracking-wider text-on-surface-variant">
              Instructor Console / Exams / {exam?.title || 'Exam Builder'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
              exam?.status === 'published'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : exam?.status === 'closed'
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
            }`}>
              {exam?.status === 'published'
                ? '● Published (Live)'
                : exam?.status === 'closed'
                ? '● Entry Closed'
                : '● Draft Mode'}
            </span>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step 1: Completed */}
            <div
              onClick={() => setIsEditingExam(true)}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 transition-colors"
              title="Click to edit exam details"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs font-mono shadow-sm">
                ✓
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-tight truncate">
                  1. Exam Details
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">
                  {exam?.durationMinutes} mins • Edit specs ✎
                </span>
              </div>
            </div>

            {/* Step 2: Active */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs font-mono shadow-sm">
                2
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-primary leading-tight truncate">
                  2. Question Builder
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">
                  {questions.length} Questions • {totalMarksTally} Marks
                </span>
              </div>
            </div>

            {/* Step 3: Publish */}
            <div className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
              publishedToken || exam?.status === 'published'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-surface-container-low border-surface-container-high opacity-80'
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono ${
                publishedToken || exam?.status === 'published'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                3
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-on-surface leading-tight truncate">
                  3. Token & Publish
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">
                  {publishedToken ? 'Key Generated' : 'Finalize & Distribute'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Exam Specifications Summary Card */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-on-surface tracking-tight truncate">
                {exam?.title}
              </h2>
              <button
                onClick={() => setIsEditingExam(true)}
                className="text-xs text-secondary hover:underline font-mono font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                <span>Edit Specs</span>
              </button>
            </div>
            {exam?.description && (
              <p className="text-xs text-on-surface-variant line-clamp-2">{exam.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs font-mono text-on-surface-variant flex-wrap pt-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-secondary">schedule</span>
                <span>{exam?.durationMinutes} Minutes</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-on-tertiary-container">event</span>
                <span>
                  {exam?.availableFrom
                    ? `Starts: ${new Date(exam.availableFrom).toLocaleString()}`
                    : 'On-Demand Access'}
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                <span>{questions.length} Questions ({totalMarksTally} Pts)</span>
              </span>
            </div>
            {exam?.instructions && (
              <div className="p-2.5 rounded-xl bg-surface-container-low text-[11px] text-on-surface-variant mt-2 border border-surface-container-high/40">
                <span className="font-bold text-on-surface block mb-0.5">Message to Students:</span>
                <p className="line-clamp-2">{exam.instructions}</p>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {!isAddingQuestion && exam?.status === 'draft' && (
              <button
                onClick={() => setIsAddingQuestion(true)}
                className="h-10 px-4 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-sm active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Add Question</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal: Edit Exam Details */}
        {isEditingExam && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest max-w-xl w-full rounded-2xl border border-surface-container-high shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
                <h3 className="text-sm font-bold text-on-surface font-mono uppercase tracking-wider">
                  Edit Assessment Specifications
                </h3>
                <button
                  onClick={() => setIsEditingExam(false)}
                  className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleUpdateExam} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold block mb-1">Assessment Title *</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full h-10 px-3 bg-surface-container-low rounded-xl border border-surface-container-high"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 bg-surface-container-low rounded-xl border border-surface-container-high resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold block mb-1">Duration (Minutes) *</label>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={editDuration}
                      onChange={(e) => setEditDuration(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl border border-surface-container-high font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold block mb-1">When it Starts</label>
                    <input
                      type="datetime-local"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl border border-surface-container-high font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold block mb-1">Message to Students / Exam Instructions</label>
                  <textarea
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 bg-surface-container-low rounded-xl border border-surface-container-high resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-high">
                  <button
                    type="button"
                    onClick={() => setIsEditingExam(false)}
                    className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingExam}
                    className="px-5 py-2 rounded-xl bg-primary text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>{isUpdatingExam ? 'Saving...' : 'Save Specifications'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Success Modal / Banner: Published Token Hero */}
        {publishedToken && (
          <div className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl border-2 border-emerald-500 shadow-md space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                <span className="material-symbols-outlined text-[28px]">key</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Examination Published Successfully!
                </h3>
                <p className="text-xs text-on-surface-variant">
                  The examination is now locked into an immutable version snapshot. Provide the cryptographic access token to candidates.
                </p>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high text-center space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-on-surface-variant">
                Candidate Access Token
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl sm:text-3xl font-mono font-bold text-secondary tracking-widest select-all">
                  {publishedToken}
                </span>
                <button
                  onClick={handleCopyToken}
                  className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center gap-1 hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {tokenCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{tokenCopied ? 'Copied!' : 'Copy Key'}</span>
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono">
                Students paste this key at <span className="text-primary font-bold">/student/dashboard</span> to launch the supervised IDE.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Link
                href="/instructor/dashboard"
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold flex items-center gap-2 hover:bg-slate-800"
              >
                <span>Return to Teacher Dashboard</span>
                <span className="material-symbols-outlined text-[16px]">dashboard</span>
              </Link>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-error-container/30 border border-error/30 text-error flex items-center gap-3 text-xs">
            <span className="material-symbols-outlined text-[20px] flex-shrink-0">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DYNAMIC QUESTION CREATOR PANEL (Appears when isAddingQuestion is true)    */}
        {/* ========================================================================= */}
        {isAddingQuestion && (
          <form
            onSubmit={handleSaveQuestion}
            className="bg-surface-container-lowest p-5 sm:p-7 rounded-2xl border-2 border-primary/40 shadow-md space-y-6 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  +
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
                    Add New Assessment Item
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Configure question prompt, expected output, and evaluation test cases.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetQuestionForm}
                className="p-1.5 rounded-xl text-on-surface-variant hover:bg-surface-container"
                title="Cancel item creation"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Question Format Selector Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface block">
                Select Item Format <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedType('CODE')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedType === 'CODE'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                    <span className="text-xs">Python Code</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal">Algorithm & Tests</span>
                </button>

                {/* TRUE / FALSE ITEM FORMAT */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType('TRUE_FALSE');
                    setQMarks(5);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedType === 'TRUE_FALSE'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">flaky</span>
                    <span className="text-xs">True / False</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal">Single Text Field</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('MCQ_SINGLE')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedType === 'MCQ_SINGLE'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">radio_button_checked</span>
                    <span className="text-xs">Single Choice</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal">MCQ 1-of-N</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('MCQ_MULTI')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedType === 'MCQ_MULTI'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">checklist</span>
                    <span className="text-xs">Multiple Choice</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal">Multi-Select</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('SHORT_ANSWER')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    selectedType === 'SHORT_ANSWER'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">find_in_page</span>
                    <span className="text-xs">Short Answer</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal">Output Prediction</span>
                </button>
              </div>
            </div>

            {/* CONDITIONAL FORM INPUTS BASED ON QUESTION FORMAT */}
            {selectedType === 'TRUE_FALSE' ? (
              <div className="space-y-4 pt-1">
                {/* Single text field labelled with number automatically */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-on-surface flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-primary text-white font-mono text-xs font-bold shadow-sm">
                        Question {questions.length + 1}
                      </span>
                      <span className="text-error">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                      Auto-Numbered #{questions.length + 1}
                    </span>
                  </div>
                  <textarea
                    value={tfStatement}
                    onChange={(e) => setTfStatement(e.target.value)}
                    rows={3}
                    placeholder={`Enter the statement for Question ${questions.length + 1} (e.g. In Python, tuples are immutable sequences while lists are mutable)...`}
                    className="w-full p-3.5 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans leading-relaxed"
                    required
                  />
                </div>

                {/* Expected Answer (True or False) & Marks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-2">
                      Expected Answer <span className="text-error">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setTfCorrect(true)}
                        className={`flex-1 h-11 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          tfCorrect
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/40'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {tfCorrect ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span>TRUE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTfCorrect(false)}
                        className={`flex-1 h-11 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          !tfCorrect
                            ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/40'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {!tfCorrect ? 'cancel' : 'radio_button_unchecked'}
                        </span>
                        <span>FALSE</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-2">
                      Marks / Points <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={qMarks}
                        onChange={(e) => setQMarks(Number(e.target.value))}
                        className="w-full h-11 px-3 bg-surface-container rounded-xl text-xs font-mono font-bold text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary"
                        required
                      />
                      <span className="absolute right-3.5 top-3.5 text-[11px] font-mono text-on-surface-variant pointer-events-none">
                        pts
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Standard Question Title & Marks for Code, MCQ, and Short Answer */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="text-xs font-bold text-on-surface block mb-1">
                      Question Title <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={qTitle}
                      onChange={(e) => setQTitle(e.target.value)}
                      placeholder={
                        selectedType === 'CODE'
                          ? 'e.g. Problem 1: Two-Dimensional Matrix Transpose'
                          : 'e.g. Python List Comprehension Evaluation'
                      }
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-1">
                      Marks / Points <span className="text-error">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={qMarks}
                      onChange={(e) => setQMarks(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono font-bold text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                {/* Problem Statement / Prompt */}
                <div>
                  <label className="text-xs font-bold text-on-surface block mb-1">
                    Problem Statement / Prompt <span className="text-error">*</span>
                  </label>
                  <textarea
                    value={qStatement}
                    onChange={(e) => setQStatement(e.target.value)}
                    rows={4}
                    placeholder="Explain the problem description, background, and expected behavior in detail..."
                    className="w-full p-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans leading-relaxed"
                    required
                  />
                </div>
              </>
            )}

            {/* ========================================================================= */}
            {/* FORMAT 1: PYTHON CODING QUESTION (WRITING CODE ITEM FORMAT)               */}
            {/* ========================================================================= */}
            {selectedType === 'CODE' && (
              <div className="space-y-5 pt-3 border-t border-surface-container-high">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-xs font-bold uppercase font-mono text-on-surface">
                      Python Code Specifications & Constraints
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    Standard I/O Execution
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-on-surface block mb-1">
                      Input Format Description
                    </label>
                    <input
                      type="text"
                      value={qInputDesc}
                      onChange={(e) => setQInputDesc(e.target.value)}
                      placeholder="e.g. Line 1: N, Line 2: N numbers"
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-on-surface block mb-1">
                      Output / Return Format
                    </label>
                    <input
                      type="text"
                      value={qOutputDesc}
                      onChange={(e) => setQOutputDesc(e.target.value)}
                      placeholder="e.g. Print transposed matrix row by row"
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-on-surface block mb-1">
                      Constraints
                    </label>
                    <input
                      type="text"
                      value={qConstraints}
                      onChange={(e) => setQConstraints(e.target.value)}
                      placeholder="e.g. 1 <= N <= 1000, Time: 2.0s"
                      className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono text-on-surface border border-surface-container-high"
                    />
                  </div>
                </div>

                {/* TEST CASES & EXPECTED OUTPUTS ENGINE */}
                <div className="space-y-3 pt-3 border-t border-surface-container-high">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase font-mono text-on-surface">
                        Test Cases & Expected Outputs ({testCases.length})
                      </h4>
                      <p className="text-[11px] text-on-surface-variant">
                        Each test case feeds input to stdin and verifies stdout matches expected output.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDistributeMarks}
                        className="px-2.5 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-low text-[11px] font-semibold text-on-surface hover:bg-surface-container"
                        title="Distribute total marks evenly across test cases"
                      >
                        Auto-Distribute Marks
                      </button>

                      <button
                        type="button"
                        onClick={handleAddTestCase}
                        className="px-3 py-1.5 rounded-lg bg-secondary text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-secondary/90 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>Add Test Case</span>
                      </button>
                    </div>
                  </div>

                  {/* Test Cases List */}
                  <div className="space-y-3">
                    {testCases.map((tc, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          tc.isHidden
                            ? 'bg-surface-container-low border-surface-container-high'
                            : 'bg-emerald-500/5 border-emerald-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container-high/60">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary text-white font-mono text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold font-mono text-on-surface">
                              Test Case #{idx + 1}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              tc.isHidden
                                ? 'bg-surface-container text-on-surface-variant'
                                : 'bg-emerald-600 text-white'
                            }`}>
                              {tc.isHidden ? 'Hidden (Evaluation)' : 'Sample (Public to Student)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Visibility toggle button */}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...testCases];
                                updated[idx].isHidden = !updated[idx].isHidden;
                                setTestCases(updated);
                              }}
                              className="px-2 py-1 rounded bg-surface-container text-[10px] font-mono font-semibold text-on-surface hover:bg-surface-container-high"
                            >
                              Toggle {tc.isHidden ? 'to Public' : 'to Hidden'}
                            </button>

                            {/* Marks input */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-mono text-on-surface-variant">Marks:</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={tc.marks}
                                onChange={(e) => {
                                  const updated = [...testCases];
                                  updated[idx].marks = Number(e.target.value);
                                  setTestCases(updated);
                                }}
                                className="w-14 h-7 px-1.5 rounded bg-surface-container-lowest border border-surface-container-high font-mono text-xs text-center"
                              />
                            </div>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveTestCase(idx)}
                              className="p-1 rounded text-error hover:bg-error-container/30"
                              title="Delete test case"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Stdin & Expected Output Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-mono font-semibold text-on-surface block mb-1">
                              Standard Input (stdin)
                            </label>
                            <textarea
                              value={tc.stdin}
                              onChange={(e) => {
                                const updated = [...testCases];
                                updated[idx].stdin = e.target.value;
                                setTestCases(updated);
                              }}
                              rows={3}
                              placeholder="Input fed to code via input() or sys.stdin..."
                              className="w-full p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high font-mono text-xs resize-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-mono font-semibold text-on-surface block mb-1">
                              Expected Output (stdout) <span className="text-error">*</span>
                            </label>
                            <textarea
                              value={tc.expectedOutput}
                              onChange={(e) => {
                                const updated = [...testCases];
                                updated[idx].expectedOutput = e.target.value;
                                setTestCases(updated);
                              }}
                              rows={3}
                              placeholder="Exact expected printed output..."
                              className="w-full p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high font-mono text-xs resize-none"
                              required
                            />
                          </div>
                        </div>

                        {/* Comparison mode */}
                        <div className="pt-2 mt-2 flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                          <span>Comparison: Trimmed Text (Ignores trailing whitespace & linebreaks)</span>
                          <span className="text-secondary font-semibold">Ready for execution</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORMAT 2: SINGLE CHOICE (MCQ)                                             */}
            {/* ========================================================================= */}
            {selectedType === 'MCQ_SINGLE' && (
              <div className="space-y-4 pt-3 border-t border-surface-container-high">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase font-mono text-on-surface">
                    Multiple Choice Options (Select Correct Answer)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setMcqOptions([...mcqOptions, `Option ${String.fromCharCode(65 + mcqOptions.length)}`])}
                    className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Add Option</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {mcqOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct-option"
                        checked={mcqCorrectIdx === idx}
                        onChange={() => setMcqCorrectIdx(idx)}
                        className="w-4 h-4 text-primary cursor-pointer"
                      />
                      <span className="w-6 font-mono font-bold text-xs text-on-surface">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...mcqOptions];
                          updated[idx] = e.target.value;
                          setMcqOptions(updated);
                        }}
                        className="flex-1 h-9 px-3 bg-surface-container-low rounded-xl text-xs border border-surface-container-high"
                        required
                      />
                      {mcqOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setMcqOptions(mcqOptions.filter((_, i) => i !== idx))}
                          className="p-1 text-error hover:bg-error-container/20 rounded"
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-mono text-on-surface-variant">
                  Selected correct answer: Option {String.fromCharCode(65 + mcqCorrectIdx)}
                </p>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORMAT 3: MULTIPLE CHOICE (MULTI-SELECT)                                   */}
            {/* ========================================================================= */}
            {selectedType === 'MCQ_MULTI' && (
              <div className="space-y-4 pt-3 border-t border-surface-container-high">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase font-mono text-on-surface">
                    Options (Check all correct answers)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setMcqOptions([...mcqOptions, `Option ${String.fromCharCode(65 + mcqOptions.length)}`]);
                      setMcqMultiCorrect([...mcqMultiCorrect, false]);
                    }}
                    className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Add Option</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {mcqOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={mcqMultiCorrect[idx] || false}
                        onChange={(e) => {
                          const updated = [...mcqMultiCorrect];
                          updated[idx] = e.target.checked;
                          setMcqMultiCorrect(updated);
                        }}
                        className="w-4 h-4 rounded text-primary cursor-pointer"
                      />
                      <span className="w-6 font-mono font-bold text-xs text-on-surface">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...mcqOptions];
                          updated[idx] = e.target.value;
                          setMcqOptions(updated);
                        }}
                        className="flex-1 h-9 px-3 bg-surface-container-low rounded-xl text-xs border border-surface-container-high"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORMAT 4: SHORT ANSWER / OUTPUT PREDICTION                                */}
            {/* ========================================================================= */}
            {selectedType === 'SHORT_ANSWER' && (
              <div className="space-y-4 pt-3 border-t border-surface-container-high">
                <h4 className="text-xs font-bold uppercase font-mono text-on-surface">
                  Expected Output String
                </h4>
                <div>
                  <label className="text-xs font-semibold text-on-surface block mb-1">
                    Expected Output / Answer Value <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={shortAnswerExpected}
                    onChange={(e) => setShortAnswerExpected(e.target.value)}
                    placeholder="e.g. [0, 2, 4, 6] or True or 42"
                    className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono text-on-surface border border-surface-container-high"
                    required
                  />
                  <p className="text-[11px] text-on-surface-variant font-mono mt-1">
                    Candidate answers will be compared after trimming outer whitespaces.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons for Form */}
            <div className="pt-4 border-t border-surface-container-high flex justify-end gap-2.5">
              <button
                type="button"
                onClick={resetQuestionForm}
                className="px-4 py-2 rounded-xl bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingQuestion}
                className="px-6 py-2 rounded-xl bg-primary text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 active:scale-95"
              >
                <span className="material-symbols-outlined text-[17px]">save</span>
                <span>{isSavingQuestion ? 'Saving Question...' : 'Save Question to Exam'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* EXISTING QUESTIONS LIST                                                   */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
              Configured Examination Items ({questions.length})
            </h3>
            <span className="text-xs font-mono font-semibold text-on-surface-variant">
              Accumulated Total: {totalMarksTally} Marks
            </span>
          </div>

          {questions.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-surface-container-lowest border-2 border-dashed border-surface-container-high text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[28px]">terminal</span>
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-base font-bold text-on-surface">No Questions Added Yet</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Click the button below to add your first Python coding problem, test cases, and expected outputs.
                </p>
              </div>
              <button
                onClick={() => setIsAddingQuestion(true)}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add First Question</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const isTrueFalse =
                  q.constraints?.toLowerCase().includes('true / false') ||
                  q.outputDescription?.includes('Expected answer: True') ||
                  q.outputDescription?.includes('Expected answer: False');
                const isCode = !isTrueFalse && !q.title.startsWith('[');
                const testCaseCount = q.testCases?.length || 0;
                const publicCount = q.testCases?.filter((tc) => !tc.isHidden).length || 0;
                const hiddenCount = q.testCases?.filter((tc) => tc.isHidden).length || 0;

                return (
                  <div
                    key={q.id}
                    className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center font-mono font-bold text-xs flex-shrink-0">
                        {idx + 1}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-on-surface truncate">{q.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isTrueFalse
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                              : isCode
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-secondary/10 text-secondary border border-secondary/20'
                          }`}>
                            {isTrueFalse ? 'True / False' : isCode ? 'Python Code' : 'Structured Item'}
                          </span>
                        </div>

                        <p className="text-xs text-on-surface-variant line-clamp-2">
                          {q.statement}
                        </p>

                        {isTrueFalse ? (
                          <div className="flex items-center gap-2 text-[11px] font-mono pt-0.5">
                            <span className="text-primary font-bold">{q.maxMarks} Marks</span>
                            <span>•</span>
                            <span className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                              q.outputDescription?.includes('True')
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                            }`}>
                              {q.outputDescription || 'Binary Evaluation'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant flex-wrap pt-0.5">
                            <span className="text-primary font-bold">{q.maxMarks} Marks</span>
                            <span>•</span>
                            <span>
                              {testCaseCount} Test Cases ({publicCount} Sample, {hiddenCount} Hidden)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      {exam?.status === 'draft' && (
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-2 rounded-xl text-error bg-error-container/20 hover:bg-error-container/50 border border-error/20 transition-colors"
                          title="Delete question"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STEP 3: PUBLISH FOOTER BAR                                                */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-on-surface block">
              Ready to Publish Assessment?
            </span>
            <span className="text-[11px] text-on-surface-variant font-mono">
              {questions.length} question(s) configured • Total Marks: {totalMarksTally} pts
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/instructor/dashboard"
              className="flex-1 sm:flex-none px-4 h-11 rounded-xl bg-surface-container text-xs font-semibold text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors"
            >
              Dashboard
            </Link>

            {exam?.status === 'draft' ? (
              <button
                onClick={handlePublishExam}
                disabled={isPublishing || questions.length === 0}
                className="flex-1 sm:flex-none px-6 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                <span>{isPublishing ? 'Publishing...' : 'Publish & Generate Token'}</span>
              </button>
            ) : exam?.status === 'published' ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-600 font-bold px-3 py-2 rounded-xl bg-emerald-500/10">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Exam Published</span>
                </div>
                <button
                  onClick={handleCloseEntry}
                  disabled={isTogglingEntry}
                  className="px-4 h-11 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 border border-rose-500/20 transition-all disabled:opacity-50"
                  title="Stop new candidate entries while allowing active attempts to finish"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  <span>{isTogglingEntry ? 'Closing...' : 'Close Entry (Unpublish)'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-mono text-rose-600 font-bold px-3 py-2 rounded-xl bg-rose-500/10">
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  <span>Entry Closed</span>
                </div>
                <button
                  onClick={handleReopenEntry}
                  disabled={isTogglingEntry}
                  className="px-4 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  title="Allow new candidate entries again using the examination key"
                >
                  <span className="material-symbols-outlined text-[18px]">lock_open</span>
                  <span>{isTogglingEntry ? 'Reopening...' : 'Reopen Examination Entry'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
