import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { MonitoringService } from '../monitoring/monitoringService.js';
import { GradingService } from '../grading/gradingService.js';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';

const router = Router();

const ReopenSchema = z.object({
  reason: z.string().min(5),
  restoredTrustScore: z.number().int().min(70).max(100).default(80),
});

const OverrideSchema = z.object({
  newTotalMarks: z.number().nonnegative(),
  reason: z.string().min(5),
});

// List attempts for an exam
router.get('/exams/:examId/attempts', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { examId } = req.params;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  if (exam.ownerId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const attempts = await prisma.examAttempt.findMany({
    where: { examId },
    include: {
      student: { select: { fullName: true, email: true, avatarUrl: true } },
      _count: { select: { events: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ attempts });
});

// Comprehensive Real-time Live Exam Monitoring & Cohort Telemetry
router.get('/exams/:examId/monitoring', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { examId } = req.params;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: {
          questions: {
            select: { id: true, title: true, maxMarks: true, position: true },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });

  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  if (exam.ownerId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const currentVersion = exam.versions[0];
  const questions = currentVersion?.questions || [];
  const totalQuestions = questions.length;
  const totalMaxMarks = questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0);

  const attempts = await prisma.examAttempt.findMany({
    where: { examId },
    include: {
      student: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      answers: {
        select: { id: true, questionId: true, answerVersion: true, savedAt: true, sourceCode: true },
      },
      events: {
        select: { id: true, eventType: true, occurredAt: true, durationMs: true, penalty: true, metadata: true },
        orderBy: { occurredAt: 'desc' },
      },
      _count: { select: { answers: true, events: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeAttempts = attempts.filter((a) => a.status === 'in_progress');
  const submittedAttempts = attempts.filter((a) => a.status === 'submitted');
  const terminatedAttempts = attempts.filter((a) => a.status === 'terminated_suspicious');
  const expiredAttempts = attempts.filter((a) => a.status === 'expired');
  const flaggedAttempts = attempts.filter((a) => a.trustScore < 70 || a.status === 'terminated_suspicious');

  const avgTrustScore = attempts.length > 0
    ? Math.round(attempts.reduce((sum, a) => sum + a.trustScore, 0) / attempts.length)
    : 100;

  const avgScore = submittedAttempts.length > 0
    ? Math.round((submittedAttempts.reduce((sum, a) => sum + (a.totalMarksAwarded || 0), 0) / submittedAttempts.length) * 10) / 10
    : 0;

  return res.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      status: exam.status,
      currentVersion: currentVersion?.versionNumber || 1,
      totalQuestions,
      totalMaxMarks,
      questions,
    },
    summary: {
      totalCandidates: attempts.length,
      activeCount: activeAttempts.length,
      submittedCount: submittedAttempts.length,
      terminatedCount: terminatedAttempts.length,
      expiredCount: expiredAttempts.length,
      flaggedCount: flaggedAttempts.length,
      averageTrustScore: avgTrustScore,
      averageScore: avgScore,
    },
    attempts,
  });
});

// Force-terminate a live attempt manually by instructor
router.post('/attempts/:attemptId/terminate', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { attemptId } = req.params;
  const { reason } = req.body;

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: true },
  });

  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.exam.ownerId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const terminated = await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'terminated_suspicious',
      terminatedAt: new Date(),
      terminationReason: reason || 'Terminated manually by instructor during live monitoring',
      trustScore: 0,
      reviewStatus: 'pending_review',
    },
  });

  return res.json({ terminated: true, attempt: terminated });
});

// Detailed submission review
router.get('/attempts/:attemptId/submission', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { attemptId } = req.params;

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      student: { select: { id: true, fullName: true, email: true } },
      exam: true,
      examVersion: {
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: { testCases: { orderBy: { position: 'asc' } } },
          },
        },
      },
      answers: true,
      events: { orderBy: { occurredAt: 'asc' } },
      gradingResults: true,
    },
  });

  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.exam.ownerId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json({ attempt });
});

// Reopen a terminated attempt
router.post('/attempts/:attemptId/reopen', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = ReopenSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Valid reason is required (min 5 characters)' });
  }

  const reopened = await MonitoringService.reopenAttempt(
    req.params.attemptId,
    req.user!.id,
    parseResult.data.reason,
    parseResult.data.restoredTrustScore
  );

  return res.json({ reopened: true, attempt: reopened });
});

// Override grade with mandatory reason
router.post('/attempts/:attemptId/grade-override', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = OverrideSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid score or reason' });
  }

  const updated = await GradingService.overrideGrade(
    req.params.attemptId,
    req.user!.id,
    parseResult.data.newTotalMarks,
    parseResult.data.reason
  );

  return res.json({ updated: true, attempt: updated });
});

// Interactive Instructor Test Code Execution (for previewing questions/solutions in builder)
router.post('/test-code', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { sourceCode, stdin } = req.body;
  if (typeof sourceCode !== 'string') {
    return res.status(400).json({ error: 'sourceCode is required' });
  }

  try {
    const result = await GradingService.callRunnerService({
      jobId: `preview-${req.user!.id}-${Date.now()}`,
      sourceCode,
      stdin: stdin || '',
      timeoutMs: 4000,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Runner execution failed' });
  }
});

export { router as instructorRoutes };
