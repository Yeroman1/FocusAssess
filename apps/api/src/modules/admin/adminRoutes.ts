// Admin Management Routes for FocusAssess
import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest, invalidateUserAuthCache } from '../../middleware/auth.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { prisma } from '../../utils/prisma.js';
import { config } from '../../config/index.js';
import { z } from 'zod';
import { UserRole } from '@pyassess/shared';

const router = Router();

// =========================================================================
// TEACHER MANAGEMENT (Add Teacher & List Authorized Instructors)
// =========================================================================

// 1. List all authorized teachers (both active profiles and pre-authorized emails)
router.get('/teachers', requireAuth, requireRole(['admin']), async (_req: AuthenticatedRequest, res: Response) => {
  const [authorizedRecords, instructorProfiles] = await Promise.all([
    prisma.authorizedTeacher.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.profile.findMany({
      where: { role: 'instructor' },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        _count: { select: { ownedExams: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Combine and deduplicate by email
  const profilesByEmail = new Map<string, any>();
  for (const p of instructorProfiles) {
    profilesByEmail.set(p.email.toLowerCase(), p);
  }

  const combinedTeachers: any[] = [];
  const handledEmails = new Set<string>();

  // Include pre-authorized teachers first
  for (const auth of authorizedRecords) {
    const emailNorm = auth.email.toLowerCase();
    handledEmails.add(emailNorm);
    const existingProfile = profilesByEmail.get(emailNorm);

    combinedTeachers.push({
      id: auth.id,
      email: auth.email,
      fullName: existingProfile?.fullName || null,
      avatarUrl: existingProfile?.avatarUrl || null,
      isRegistered: !!existingProfile,
      status: existingProfile?.status || 'pending_login',
      createdAt: auth.createdAt,
      ownedExamsCount: existingProfile?._count?.ownedExams || 0,
      profileId: existingProfile?.id || null,
    });
  }

  // Include any other instructor profiles that might have been assigned directly
  for (const p of instructorProfiles) {
    const emailNorm = p.email.toLowerCase();
    if (!handledEmails.has(emailNorm)) {
      handledEmails.add(emailNorm);
      combinedTeachers.push({
        id: p.id,
        email: p.email,
        fullName: p.fullName,
        avatarUrl: p.avatarUrl,
        isRegistered: true,
        status: p.status,
        createdAt: p.createdAt,
        ownedExamsCount: p._count.ownedExams || 0,
        profileId: p.id,
      });
    }
  }

  return res.json({ teachers: combinedTeachers });
});

// 2. Add teacher by entering email
router.post('/teachers', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const Schema = z.object({
    email: z.string().email('Please enter a valid email address'),
  });

  const parseResult = Schema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Valid email is required' });
  }

  const normalizedEmail = parseResult.data.email.trim().toLowerCase();

  if (normalizedEmail === config.initialAdminEmail.toLowerCase()) {
    return res.status(400).json({ error: 'This email is already the designated Platform Administrator.' });
  }

  // 1. Upsert into AuthorizedTeacher table
  const authRecord = await prisma.authorizedTeacher.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: {
      email: normalizedEmail,
      addedBy: req.user!.id,
    },
  });

  // 2. If a Profile already exists, promote them to 'instructor' immediately
  const existingProfile = await prisma.profile.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingProfile) {
    await prisma.profile.update({
      where: { id: existingProfile.id },
      data: { role: 'instructor' },
    });
    invalidateUserAuthCache(existingProfile.id);
    invalidateUserAuthCache(normalizedEmail);
  }

  // 3. Record audit event
  await recordAuditEvent({
    actorId: req.user!.id,
    action: 'TEACHER_AUTHORIZED',
    targetType: 'AuthorizedTeacher',
    targetId: authRecord.id,
    metadata: {
      email: normalizedEmail,
      isRegistered: !!existingProfile,
    },
  });

  return res.status(201).json({
    success: true,
    message: `Teacher ${normalizedEmail} successfully authorized.`,
    teacher: {
      id: authRecord.id,
      email: normalizedEmail,
      isRegistered: !!existingProfile,
      fullName: existingProfile?.fullName || null,
      status: existingProfile ? 'active' : 'pending_login',
    },
  });
});

// 3. Remove/revoke teacher privileges
router.delete('/teachers/:identifier', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { identifier } = req.params;
  const decoded = decodeURIComponent(identifier).trim().toLowerCase();

  // Remove from AuthorizedTeacher by email or ID
  await prisma.authorizedTeacher.deleteMany({
    where: {
      OR: [{ email: decoded }, { id: identifier }],
    },
  });

  // If a profile exists with this email or ID, demote back to student
  const profile = await prisma.profile.findFirst({
    where: {
      OR: [{ email: decoded }, { id: identifier }],
    },
  });

  if (profile && profile.role === 'instructor') {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { role: 'student' },
    });
    invalidateUserAuthCache(profile.id);
    invalidateUserAuthCache(profile.email);
  }

  await recordAuditEvent({
    actorId: req.user!.id,
    action: 'TEACHER_REVOKED',
    targetType: 'AuthorizedTeacher',
    targetId: identifier,
    metadata: { identifier: decoded },
  });

  return res.json({ success: true, message: `Teacher access revoked for ${decoded}.` });
});

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

  invalidateUserAuthCache(userId);

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

  invalidateUserAuthCache(userId);

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

  invalidateUserAuthCache(userId);

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
