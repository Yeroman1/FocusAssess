import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth.js';
import { MonitoringService } from './monitoringService.js';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';

const router = Router();

const EventSchema = z.object({
  eventType: z.enum([
    'VISIBILITY_HIDDEN',
    'WINDOW_BLUR',
    'FULLSCREEN_EXIT',
    'CLIPBOARD_COPY',
    'CLIPBOARD_PASTE',
    'CONTEXT_MENU',
  ]),
  occurredAt: z.string().datetime().optional().default(() => new Date().toISOString()),
  durationMs: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().min(8),
  metadata: z.record(z.any()).optional(),
});

// Record monitoring event
router.post('/attempts/:attemptId/events', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = EventSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
  }

  const result = await MonitoringService.recordEvent(
    req.params.attemptId,
    req.user!.id,
    parseResult.data
  );

  return res.json(result);
});

// Get trust status (Strictly authorized to the attempt candidate, exam owner, or admin)
router.get('/attempts/:attemptId/trust-status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: req.params.attemptId },
    select: {
      id: true,
      studentId: true,
      trustScore: true,
      status: true,
      terminationReason: true,
      terminatedAt: true,
      exam: { select: { ownerId: true } },
    },
  });

  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

  const user = req.user!;
  if (user.role === 'student' && attempt.studentId !== user.id) {
    return res.status(403).json({ error: 'Forbidden: You cannot access telemetry for another candidate.' });
  }
  if (user.role === 'instructor' && attempt.exam.ownerId !== user.id) {
    return res.status(403).json({ error: 'Forbidden: You cannot access telemetry for another instructor\'s exam.' });
  }

  return res.json({
    attemptId: attempt.id,
    trustScore: attempt.trustScore,
    status: attempt.status,
    isTerminated: attempt.status === 'terminated_suspicious',
    terminationReason: attempt.terminationReason,
    terminatedAt: attempt.terminatedAt,
  });
});

export { router as monitoringRoutes };
