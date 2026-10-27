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

export { router as instructorRoutes };
