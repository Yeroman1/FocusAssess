import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest, invalidateUserAuthCache } from '../../middleware/auth.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { prisma } from '../../utils/prisma.js';

const router = Router();

// 1. Terminate session on server and cancel in-progress exam attempts on logout
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    // Invalidate in-memory server token cache
    invalidateUserAuthCache(user.id);

    // If student was inside an active exam session, terminate attempt for integrity
    if (user.role === 'student') {
      const activeAttempt = await prisma.examAttempt.findFirst({
        where: { studentId: user.id, status: 'in_progress' },
      });

      if (activeAttempt) {
        await prisma.examAttempt.update({
          where: { id: activeAttempt.id },
          data: {
            status: 'terminated_suspicious',
            terminatedAt: new Date(),
            submittedAt: new Date(),
            terminationReason: 'Session terminated: Student logged out of FocusAssess during active examination.',
          },
        });

        await recordAuditEvent({
          actorId: user.id,
          action: 'EXAM_ATTEMPT_TERMINATED',
          targetType: 'ExamAttempt',
          targetId: activeAttempt.id,
          metadata: { reason: 'User session logged out during examination' },
        });
      }
    }

    // Record logout audit event
    await recordAuditEvent({
      actorId: user.id,
      action: 'USER_LOGGED_OUT',
      targetType: 'Profile',
      targetId: user.id,
      metadata: { email: user.email },
    });

    return res.json({ success: true, message: 'Session terminated successfully.' });
  } catch (err: any) {
    console.error('[FocusAssess Logout Error]', err);
    return res.status(500).json({ error: 'Failed to process session termination' });
  }
});

// Current user profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

// Update profile name
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { fullName } = (req.body || {}) as { fullName?: string };
  if (!fullName || typeof fullName !== 'string') {
    return res.status(400).json({ error: 'Full name is required' });
  }

  const updated = await prisma.profile.update({
    where: { id: req.user!.id },
    data: { fullName: fullName.trim() },
  });

  invalidateUserAuthCache(req.user!.id);
  invalidateUserAuthCache(req.user!.email);

  return res.json({ user: updated });
});

// Real query-driven dashboard metrics
router.get('/me/dashboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  if (user.role === 'student') {
    const [
      totalAttempts,
      completedAttempts,
      pendingEvaluationAttempts,
      activeAttempt,
      studentAttempts,
    ] = await Promise.all([
      prisma.examAttempt.count({ where: { studentId: user.id } }),
      prisma.examAttempt.count({
        where: { studentId: user.id, status: { in: ['submitted', 'expired'] }, gradingStatus: 'graded' },
      }),
      prisma.examAttempt.count({
        where: { studentId: user.id, gradingStatus: { in: ['pending', 'grading'] } },
      }),
      prisma.examAttempt.findFirst({
        where: { studentId: user.id, status: 'in_progress' },
        include: { exam: { select: { id: true, title: true, durationMinutes: true } } },
      }),
      prisma.examAttempt.findMany({
        where: { studentId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { exam: { select: { id: true, title: true, durationMinutes: true, resultsReleasedAt: true } } },
      }),
    ]);

    const avgTrust =
      studentAttempts.length > 0
        ? Math.round(
            studentAttempts.reduce((acc, a) => acc + (a.trustScore ?? 100), 0) /
              studentAttempts.length
          )
        : 100;

    const mappedSubmissions = studentAttempts.map((att: any) => ({
      id: att.id,
      examId: att.exam.id,
      examTitle: att.exam.title,
      durationMinutes: att.exam.durationMinutes,
      status: att.status,
      gradingStatus: att.gradingStatus,
      trustScore: att.trustScore,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      // Only disclose marks if results released
      resultsReleased: !!att.exam.resultsReleasedAt,
      totalMarks: att.exam.resultsReleasedAt ? att.totalMarksAwarded : null,
      maxMarks: att.exam.resultsReleasedAt ? att.maxMarksTotal : null,
      percentageScore: att.exam.resultsReleasedAt ? att.percentageScore : null,
    }));

    return res.json({
      role: 'student',
      stats: {
        examsTaken: totalAttempts,
        completed: completedAttempts,
        evaluating: pendingEvaluationAttempts,
        averageTrust: avgTrust,
      },
      activeAttempt,
      recentSubmissions: mappedSubmissions,
      myExams: mappedSubmissions,
    });
  }

  if (user.role === 'instructor') {
    const [totalExams, publishedExams, activeAttempts, flaggedAttempts, recentSubmissions] =
      await Promise.all([
        prisma.exam.count({ where: { ownerId: user.id } }),
        prisma.exam.count({ where: { ownerId: user.id, status: 'published' } }),
        prisma.examAttempt.count({
          where: { exam: { ownerId: user.id }, status: 'in_progress' },
        }),
        prisma.examAttempt.count({
          where: { exam: { ownerId: user.id }, reviewStatus: 'pending_review' },
        }),
        prisma.examAttempt.findMany({
          where: { exam: { ownerId: user.id } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { student: { select: { fullName: true, email: true } }, exam: true },
        }),
      ]);

    return res.json({
      role: 'instructor',
      stats: {
        totalExams,
        publishedExams,
        activeAttempts,
        flaggedAttempts,
      },
      recentSubmissions,
    });
  }

  // Admin Dashboard
  const [totalUsers, totalStudents, totalInstructors, totalExams, flaggedAttempts] =
    await Promise.all([
      prisma.profile.count(),
      prisma.profile.count({ where: { role: 'student' } }),
      prisma.profile.count({ where: { role: 'instructor' } }),
      prisma.exam.count(),
      prisma.examAttempt.count({ where: { reviewStatus: 'pending_review' } }),
    ]);

  return res.json({
    role: 'admin',
    stats: {
      totalUsers,
      totalStudents,
      totalInstructors,
      totalExams,
      flaggedAttempts,
    },
  });
});

export { router as authRoutes };
