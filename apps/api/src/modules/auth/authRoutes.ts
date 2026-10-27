import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth.js';
import { prisma } from '../../utils/prisma.js';

const router = Router();

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

  return res.json({ user: updated });
});

// Real query-driven dashboard metrics
router.get('/me/dashboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  if (user.role === 'student') {
    const [
      activeNowCount,
      scheduledExams,
      completedAttempts,
      pendingEvaluationAttempts,
      activeAttempt,
      recentSubmissions,
    ] = await Promise.all([
      prisma.exam.count({ where: { status: 'published' } }),
      prisma.exam.findMany({
        where: { status: 'published' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          durationMinutes: true,
          availableFrom: true,
          availableUntil: true,
          status: true,
        },
      }),
      prisma.examAttempt.count({
        where: { studentId: user.id, status: { in: ['submitted', 'expired'] }, gradingStatus: 'graded' },
      }),
      prisma.examAttempt.count({
        where: { studentId: user.id, gradingStatus: { in: ['pending', 'grading'] } },
      }),
      prisma.examAttempt.findFirst({
        where: { studentId: user.id, status: 'in_progress' },
        include: { exam: true },
      }),
      prisma.examAttempt.findMany({
        where: { studentId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { exam: { select: { title: true, resultsReleasedAt: true } } },
      }),
    ]);

    return res.json({
      role: 'student',
      stats: {
        activeNow: activeNowCount,
        upcoming: scheduledExams.length,
        completed: completedAttempts,
        evaluating: pendingEvaluationAttempts,
      },
      activeAttempt,
      scheduledExams,
      recentSubmissions: recentSubmissions.map((att: any) => ({
        id: att.id,
        examTitle: att.exam.title,
        status: att.status,
        gradingStatus: att.gradingStatus,
        trustScore: att.trustScore,
        submittedAt: att.submittedAt,
        // Only disclose marks if results released
        resultsReleased: !!att.exam.resultsReleasedAt,
        totalMarks: att.exam.resultsReleasedAt ? att.totalMarksAwarded : null,
        maxMarks: att.exam.resultsReleasedAt ? att.maxMarksTotal : null,
        percentageScore: att.exam.resultsReleasedAt ? att.percentageScore : null,
      })),
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
