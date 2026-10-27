import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';
import { UserRole } from '@pyassess/shared';

const router = Router();

// List all users
router.get('/users', requireAuth, requireRole(['admin']), async (_req: AuthenticatedRequest, res: Response) => {
  const users = await prisma.profile.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { attempts: true, ownedExams: true } },
    },
  });

  return res.json({ users });
});

// Assign user role
router.post('/users/:userId/role', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const RoleSchema = z.object({
    role: z.enum(['admin', 'instructor', 'student']),
  });

  const parseResult = RoleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Valid role is required (admin, instructor, or student)' });
  }

  const { userId } = req.params;
  const newRole = parseResult.data.role as UserRole;

  const updated = await prisma.profile.update({
    where: { id: userId },
    data: { role: newRole },
  });

  await recordAuditEvent({
    actorId: req.user!.id,
    action: 'USER_ROLE_CHANGED',
    targetType: 'Profile',
    targetId: userId,
    metadata: { newRole },
  });

  return res.json({ user: updated });
});

// Suspend user account
router.post('/users/:userId/suspend', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;

  const updated = await prisma.profile.update({
    where: { id: userId },
    data: { status: 'suspended' },
  });

  await recordAuditEvent({
    actorId: req.user!.id,
    action: 'USER_ACCOUNT_SUSPENDED',
    targetType: 'Profile',
    targetId: userId,
  });

  return res.json({ user: updated });
});

// Activate user account
router.post('/users/:userId/activate', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params;

  const updated = await prisma.profile.update({
    where: { id: userId },
    data: { status: 'active' },
  });

  await recordAuditEvent({
    actorId: req.user!.id,
    action: 'USER_ACCOUNT_ACTIVATED',
    targetType: 'Profile',
    targetId: userId,
  });

  return res.json({ user: updated });
});

// Audit logs
router.get('/audit-logs', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { fullName: true, email: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return res.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Aggregate system reports
router.get('/reports', requireAuth, requireRole(['admin']), async (_req: AuthenticatedRequest, res: Response) => {
  const [
    totalUsers,
    studentCount,
    instructorCount,
    totalExams,
    publishedExams,
    totalAttempts,
    flaggedAttempts,
    submittedAttempts,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { role: 'student' } }),
    prisma.profile.count({ where: { role: 'instructor' } }),
    prisma.exam.count(),
    prisma.exam.count({ where: { status: 'published' } }),
    prisma.examAttempt.count(),
    prisma.examAttempt.count({ where: { reviewStatus: 'pending_review' } }),
    prisma.examAttempt.count({ where: { status: 'submitted' } }),
  ]);

  return res.json({
    reports: {
      totalUsers,
      studentCount,
      instructorCount,
      totalExams,
      publishedExams,
      totalAttempts,
      flaggedAttempts,
      submittedAttempts,
    },
  });
});

export { router as adminRoutes };
