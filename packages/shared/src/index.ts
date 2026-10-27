/**
 * PyAssess Shared Types, Constants, and Domain Models
 */

// -----------------------------------------------------------------------------
// 1. User Roles & Account Status
// -----------------------------------------------------------------------------
export type UserRole = 'admin' | 'instructor' | 'student';

export type AccountStatus = 'active' | 'suspended' | 'pending_approval';

export interface UserProfile {
  id: string; // Supabase Auth UUID
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// 2. Examination Lifecycle
// -----------------------------------------------------------------------------
export type ExamStatus = 'draft' | 'published' | 'closed' | 'archived';

export interface ExamRuleDeclaration {
  id: string;
  text: string;
  mandatory: boolean;
}

export interface AntiCheatingSettings {
  initialTrustScore: number;
  terminationThreshold: number; // Defaults to 70 (strictly < 70 triggers termination)
  penalties: {
    visibilityHidden: number;  // Default: -10
    windowBlur: number;        // Default: -10
    fullscreenExit: number;    // Default: -10
    clipboardCopy: number;     // Default: -5
    clipboardPaste: number;    // Default: -5
    contextMenu: number;       // Default: -3
  };
}

export const DEFAULT_ANTI_CHEATING_SETTINGS: AntiCheatingSettings = {
  initialTrustScore: 100,
  terminationThreshold: 70,
  penalties: {
    visibilityHidden: 10,
    windowBlur: 10,
    fullscreenExit: 10,
    clipboardCopy: 5,
    clipboardPaste: 5,
    contextMenu: 3,
  },
};

// -----------------------------------------------------------------------------
// 3. Question & Test Cases
// -----------------------------------------------------------------------------
export type OutputComparisonMode = 'TRIMMED_TEXT' | 'EXACT_TEXT' | 'NUMERIC_TOLERANCE';

export interface TestCaseSummary {
  id: string;
  position: number;
  marks: number;
  isHidden: boolean;
  comparisonMode: OutputComparisonMode;
  isEnabled: boolean;
  // Public examples display stdin & expectedOutput; hidden tests do NOT expose this to students!
  stdin?: string;
  expectedOutput?: string;
}

export interface QuestionSummary {
  id: string;
  position: number;
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints?: string | null;
  maxMarks: number;
  manualReviewRequired: boolean;
  publicExamples: Array<{
    stdin: string;
    expectedOutput: string;
    explanation?: string;
  }>;
}

// -----------------------------------------------------------------------------
// 4. Examination Attempt & Lifecycle States
// -----------------------------------------------------------------------------
export type AttemptStatus =
  | 'in_progress'
  | 'submitted'
  | 'expired'
  | 'terminated_suspicious';

export type GradingStatus =
  | 'pending'
  | 'grading'
  | 'graded'
  | 'failed';

export type ReviewStatus =
  | 'none'
  | 'pending_review'
  | 'reviewed'
  | 'reopened';

export interface ExamAttemptSummary {
  id: string;
  examId: string;
  examVersionId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt: string;
  deadlineAt: string;
  submittedAt?: string | null;
  terminatedAt?: string | null;
  trustScore: number;
  terminationReason?: string | null;
  gradingStatus: GradingStatus;
  reviewStatus: ReviewStatus;
  totalMarksAwarded?: number | null;
  maxMarksTotal?: number | null;
  percentageScore?: number | null;
}

// -----------------------------------------------------------------------------
// 5. Anti-Cheating & Monitoring Events
// -----------------------------------------------------------------------------
export type MonitoredEventType =
  | 'VISIBILITY_HIDDEN'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'CLIPBOARD_COPY'
  | 'CLIPBOARD_PASTE'
  | 'CONTEXT_MENU';

export interface MonitoringEventPayload {
  eventType: MonitoredEventType;
  occurredAt: string;
  durationMs?: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface TrustScoreState {
  attemptId: string;
  trustScore: number;
  status: AttemptStatus;
  isTerminated: boolean;
  terminationReason?: string | null;
  latestEventPenalty?: number;
}

/**
 * Trust Score Evaluation Rule:
 * Base = 100
 * Termination: strictly < 70 terminates immediately.
 * Score of exactly 70 remains operational!
 */
export function shouldTerminateAttempt(trustScore: number, threshold = 70): boolean {
  return trustScore < threshold;
}

// -----------------------------------------------------------------------------
// 6. Python Execution & Grading
// -----------------------------------------------------------------------------
export type RunnerExecutionStatus =
  | 'SUCCESS'
  | 'WRONG_ANSWER'
  | 'SYNTAX_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'OUTPUT_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export interface RunnerJobRequest {
  jobId: string;
  sourceCode: string;
  stdin: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface RunnerJobResponse {
  jobId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  executionStatus: RunnerExecutionStatus;
  error?: string;
}

export interface TestCaseGradingResult {
  testCaseId: string;
  passed: boolean;
  marksAwarded: number;
  maxMarks: number;
  executionStatus: RunnerExecutionStatus;
  durationMs: number;
  // Note: For students, hidden test case inputs and expected outputs are never returned!
  errorMessage?: string;
}

export interface QuestionGradingResult {
  questionId: string;
  marksAwarded: number;
  maxMarks: number;
  testCaseResults: TestCaseGradingResult[];
  manualReviewRequired: boolean;
  instructorFeedback?: string | null;
}

export interface AttemptGradingSummary {
  attemptId: string;
  examId: string;
  gradingStatus: GradingStatus;
  totalMarksAwarded: number;
  maxMarksTotal: number;
  percentage: number;
  resultsReleased: boolean;
  questions: QuestionGradingResult[];
}
