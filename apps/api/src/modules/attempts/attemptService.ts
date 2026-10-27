import crypto from 'crypto';
import { prisma } from '../../utils/prisma.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { hashExamKey } from '../exams/examService.js';
import { AttemptStatus } from '@pyassess/shared';

export class AttemptService {
  /**
   * Validates examination key and student eligibility
   */
  static async validateKeyAndEligibility(rawKey: string, studentId: string) {
    const keyHash = hashExamKey(rawKey);

    const examKey = await prisma.examKey.findUnique({
      where: { keyHash },
      include: {
        exam: {
          include: {
            classes: true,
            versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!examKey) {
      throw new Error('Invalid examination key');
    }

    if (examKey.revokedAt) {
      throw new Error('This examination key has been revoked');
    }

    if (examKey.expiresAt && new Date() > examKey.expiresAt) {
      throw new Error('This examination key has expired');
    }

    const exam = examKey.exam;

    if (exam.status !== 'published') {
      throw new Error('This examination is currently not open for attempts');
    }

    const now = new Date();
    if (exam.availableFrom && now < exam.availableFrom) {
      throw new Error('This examination window has not opened yet');
    }

    if (exam.availableUntil && now > exam.availableUntil) {
      throw new Error('This examination window has closed');
    }

    // Check account status
    const student = await prisma.profile.findUnique({ where: { id: studentId } });
    if (!student || student.status === 'suspended') {
      throw new Error('Student account is suspended or ineligible');
    }

    // Check class enrollment eligibility if exam is bound to specific classes
    if (exam.classes.length > 0) {
      const classIds = exam.classes.map((c) => c.classId);
      const enrollment = await prisma.classEnrollment.findFirst({
        where: {
          studentId,
          classId: { in: classIds },
          status: 'enrolled',
        },
      });

      if (!enrollment) {
        throw new Error('You are not enrolled in the authorized class roster for this exam');
      }
    }

    // Check existing attempts
    const existingAttempts = await prisma.examAttempt.findMany({
      where: { examId: exam.id, studentId },
      orderBy: { createdAt: 'desc' },
    });

    const activeAttempt = existingAttempts.find((a) => a.status === 'in_progress');
    if (activeAttempt) {
      return {
        exam,
        activeAttempt,
        canResume: true,
        attemptsCount: existingAttempts.length,
      };
    }

    if (existingAttempts.length >= exam.maxAttempts) {
      throw new Error(`Maximum attempt limit (${exam.maxAttempts}) reached for this examination`);
    }

    return {
      exam,
      activeAttempt: null,
      canResume: false,
      attemptsCount: existingAttempts.length,
    };
  }

  /**
   * Starts an exam attempt atomically with authoritative server deadline
   */
  static async startExamAttempt(examId: string, studentId: string) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!exam || exam.status !== 'published') {
      throw new Error('Exam is not available');
    }

    const currentVersion = exam.versions[0];
    if (!currentVersion) throw new Error('Exam version not found');

    // Check if active attempt already exists (idempotency)
    const existingActive = await prisma.examAttempt.findFirst({
      where: {
        examId,
        studentId,
        status: 'in_progress',
      },
    });

    if (existingActive) {
      // If deadline already passed, expire it
      if (new Date() > existingActive.deadlineAt) {
        return await this.expireAttempt(existingActive.id);
      }
      return existingActive;
    }

    // Check attempt limits
    const priorAttemptsCount = await prisma.examAttempt.count({
      where: { examId, studentId },
    });

    if (priorAttemptsCount >= exam.maxAttempts) {
      throw new Error('Maximum permitted attempts exceeded');
    }

    // Server-authoritative start and deadline
    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + exam.durationMinutes * 60 * 1000);

    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        examVersionId: currentVersion.id,
        studentId,
        status: 'in_progress',
        startedAt,
        deadlineAt,
        trustScore: 100,
        reviewStatus: 'none',
      },
    });

    await recordAuditEvent({
      actorId: studentId,
      action: 'EXAM_ATTEMPT_STARTED',
      targetType: 'ExamAttempt',
      targetId: attempt.id,
      metadata: { examId, durationMinutes: exam.durationMinutes, deadlineAt: deadlineAt.toISOString() },
    });

    return attempt;
  }

  /**
   * Autosaves code solution with optimistic versioning & deadline enforcement
   */
  static async autosaveAnswer(
    attemptId: string,
    studentId: string,
    questionId: string,
    sourceCode: string
  ) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== studentId) throw new Error('Forbidden');

    if (attempt.status !== 'in_progress') {
      throw new Error(`Cannot save answer: Examination is ${attempt.status}`);
    }

    // Server deadline enforcement
    if (new Date() > attempt.deadlineAt) {
      await this.expireAttempt(attemptId);
      throw new Error('Examination deadline has expired. Answers can no longer be updated.');
    }

    const existing = await prisma.studentAnswer.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
    });

    const newVersion = (existing?.answerVersion ?? 0) + 1;

    return await prisma.studentAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        sourceCode,
        answerVersion: 1,
        savedAt: new Date(),
      },
      update: {
        sourceCode,
        answerVersion: newVersion,
        savedAt: new Date(),
      },
    });
  }

  /**
   * Finalizes and submits an examination attempt idempotently
   */
  static async submitExamAttempt(attemptId: string, studentId: string) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });

    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== studentId) throw new Error('Forbidden');

    if (attempt.status === 'submitted') {
      return attempt; // Idempotent return
    }

    if (attempt.status === 'terminated_suspicious') {
      throw new Error('This attempt was halted by automated proctoring safeguard and cannot be manually submitted');
    }

    const submittedAt = new Date();

    // Compute hash of final answers as immutable snapshot reference
    const answersData = attempt.answers
      .sort((a, b) => a.questionId.localeCompare(b.questionId))
      .map((a) => `${a.questionId}:${a.sourceCode}`)
      .join('|');
    const answersSnapshotHash = crypto.createHash('sha256').update(answersData).digest('hex');

    const updated = await prisma.$transaction(async (tx) => {
      const finalized = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'submitted',
          submittedAt,
          gradingStatus: 'pending',
        },
      });

      // Update snapshot hash on answers
      await tx.studentAnswer.updateMany({
        where: { attemptId },
        data: { submittedSourceHash: answersSnapshotHash },
      });

      // Idempotently create grading job
      await tx.gradingJob.upsert({
        where: { attemptId },
        create: {
          attemptId,
          status: 'pending',
          idempotencyKey: `grade-attempt-${attemptId}`,
        },
        update: {},
      });

      return finalized;
    });

    await recordAuditEvent({
      actorId: studentId,
      action: 'EXAM_ATTEMPT_SUBMITTED',
      targetType: 'ExamAttempt',
      targetId: attemptId,
      metadata: { answersSnapshotHash, submittedAt: submittedAt.toISOString() },
    });

    return updated;
  }

  /**
   * Expire attempt when authoritative server timer passes deadline
   */
  static async expireAttempt(attemptId: string) {
    return await prisma.$transaction(async (tx) => {
      const attempt = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'expired',
          gradingStatus: 'pending',
        },
      });

      await tx.gradingJob.upsert({
        where: { attemptId },
        create: {
          attemptId,
          status: 'pending',
          idempotencyKey: `grade-attempt-${attemptId}`,
        },
        update: {},
      });

      return attempt;
    });
  }
}
