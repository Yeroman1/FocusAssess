import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth.js';
import { AttemptService } from './attemptService.js';
import { GradingService } from '../grading/gradingService.js';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';

const router = Router();

const ValidateKeySchema = z.object({
  key: z.string().min(4),
});

const AutosaveSchema = z.object({
  sourceCode: z.string(),
});

// 1. Validate exam key and student eligibility
router.post('/exam-entry/validate-key', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = ValidateKeySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Key is required' });
  }

  const result = await AttemptService.validateKeyAndEligibility(parseResult.data.key, req.user!.id);
  return res.json({
    valid: true,
    exam: {
      id: result.exam.id,
      title: result.exam.title,
      description: result.exam.description,
      durationMinutes: result.exam.durationMinutes,
      maxAttempts: result.exam.maxAttempts,
    },
    canResume: result.canResume,
    activeAttempt: result.activeAttempt,
    attemptsCount: result.attemptsCount,
  });
});

// 2. Pre-exam instructions & rules
router.get('/exams/:examId/instructions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const exam = await prisma.exam.findUnique({
    where: { id: req.params.examId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: { _count: { select: { questions: true } } },
      },
    },
  });

  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const currentVersion = exam.versions[0];

  return res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      questionCount: currentVersion?._count.questions ?? 0,
      rules: exam.rules ? JSON.parse(exam.rules) : null,
    },
  });
});

// 3. Start or reconnect to exam attempt
router.post('/exams/:examId/attempts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const attempt = await AttemptService.startExamAttempt(req.params.examId, req.user!.id);
  return res.status(201).json({ attempt });
});

// 4. Get active attempt state and sanitized questions
router.get('/attempts/:attemptId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { attemptId } = req.params;
  const studentId = req.user!.id;

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: true,
      examVersion: {
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: {
              testCases: {
                where: { isHidden: false },
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      },
      answers: true,
    },
  });

  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.studentId !== studentId && req.user!.role !== 'admin' && attempt.exam.ownerId !== studentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Check deadline expiration automatically
  if (attempt.status === 'in_progress' && new Date() > attempt.deadlineAt) {
    const expiredAttempt = await AttemptService.expireAttempt(attempt.id);
    return res.json({
      attempt: expiredAttempt,
      isExpired: true,
    });
  }

  // Build answer lookup map
  const answersMap: Record<string, string> = {};
  for (const a of attempt.answers) {
    answersMap[a.questionId] = a.sourceCode;
  }

  // Sanitize questions: only include public examples! Hidden test cases are never disclosed.
  const questions = attempt.examVersion.questions.map((q) => ({
    id: q.id,
    title: q.title,
    statement: q.statement,
    inputDescription: q.inputDescription,
    outputDescription: q.outputDescription,
    constraints: q.constraints,
    maxMarks: q.maxMarks,
    position: q.position,
    publicExamples: q.testCases.map((tc) => ({
      stdin: tc.stdin,
      expectedOutput: tc.expectedOutput,
    })),
    savedSourceCode: answersMap[q.id] || '',
  }));

  return res.json({
    attempt: {
      id: attempt.id,
      examId: attempt.examId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      trustScore: attempt.trustScore,
      terminationReason: attempt.terminationReason,
      examTitle: attempt.exam.title,
    },
    questions,
    serverTime: new Date().toISOString(),
  });
});

// 5. Autosave answer
router.put('/attempts/:attemptId/answers/:questionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = AutosaveSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid answer source code' });
  }

  const saved = await AttemptService.autosaveAnswer(
    req.params.attemptId,
    req.user!.id,
    req.params.questionId,
    parseResult.data.sourceCode
  );

  return res.json({ saved: true, answerVersion: saved.answerVersion, savedAt: saved.savedAt });
});

// 6. Submit exam
router.post('/attempts/:attemptId/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const finalized = await AttemptService.submitExamAttempt(req.params.attemptId, req.user!.id);

  // Trigger background grading
  GradingService.gradeAttempt(finalized.id).catch((err) => {
    console.error(`[Grading Worker Error on ${finalized.id}]`, err);
  });

  return res.json({
    submitted: true,
    attempt: finalized,
    receiptId: `RCPT-${finalized.id.slice(0, 8).toUpperCase()}`,
  });
});

// 7. Get attempt results
router.get('/attempts/:attemptId/results', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: req.params.attemptId },
    include: {
      exam: { select: { title: true, resultsReleasedAt: true } },
      gradingResults: {
        select: {
          questionId: true,
          passed: true,
          marksAwarded: true,
          maxMarks: true,
          executionStatus: true,
        },
      },
    },
  });

  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.studentId !== req.user!.id && req.user!.role === 'student') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Result release gate: Students can ONLY see marks if results have been released!
  const isReleased = !!attempt.exam.resultsReleasedAt || req.user!.role !== 'student';

  if (!isReleased) {
    return res.json({
      resultsReleased: false,
      attemptId: attempt.id,
      examTitle: attempt.exam.title,
      status: attempt.status,
      gradingStatus: attempt.gradingStatus,
      trustScore: attempt.trustScore,
      submittedAt: attempt.submittedAt,
    });
  }

  return res.json({
    resultsReleased: true,
    attemptId: attempt.id,
    examTitle: attempt.exam.title,
    status: attempt.status,
    gradingStatus: attempt.gradingStatus,
    trustScore: attempt.trustScore,
    totalMarksAwarded: attempt.totalMarksAwarded,
    maxMarksTotal: attempt.maxMarksTotal,
    percentageScore: attempt.percentageScore,
    submittedAt: attempt.submittedAt,
    releasedAt: attempt.exam.resultsReleasedAt,
    questionBreakdown: attempt.gradingResults,
  });
});

export { router as attemptRoutes };
