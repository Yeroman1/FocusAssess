export interface StudentAnswerInfo {
  id: string;
  questionId: string;
  answerVersion: number;
  savedAt: string;
  sourceCode: string;
}

export interface TelemetryEventInfo {
  id: string;
  eventType: string;
  occurredAt: string;
  durationMs: number | null;
  penalty: number;
  metadata: string | null;
}

export interface AttemptCandidate {
  id: string;
  studentId: string;
  status: 'in_progress' | 'submitted' | 'expired' | 'terminated_suspicious';
  trustScore: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  totalMarksAwarded: number | null;
  maxMarksTotal: number | null;
  percentageScore: number | null;
  student: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
  answers: StudentAnswerInfo[];
  events: TelemetryEventInfo[];
  _count: {
    answers: number;
    events: number;
  };
}

export interface ExamQuestionSummary {
  id: string;
  title: string;
  position: number;
  maxMarks: number;
}

export interface ExamInfo {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: 'draft' | 'published' | 'closed' | 'archived';
  currentVersion: number;
  totalQuestions: number;
  totalMaxMarks: number;
  questions: ExamQuestionSummary[];
}

export interface MonitoringSummary {
  totalCandidates: number;
  activeCount: number;
  submittedCount: number;
  terminatedCount: number;
  expiredCount: number;
  flaggedCount: number;
  averageTrustScore: number;
  averageScore: number;
}
