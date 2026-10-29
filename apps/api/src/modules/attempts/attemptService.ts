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

    // 1. Check if this student has ALREADY consumed this specific examination key
    const keyUsage = await prisma.examKeyUsage.findUnique({
      where: {
        examKeyId_studentId: {
          examKeyId: examKey.id,
          studentId,
        },
      },
    });

    if (keyUsage) {
      throw new Error(
        'This examination key is single-use and has already been used by your account. You cannot enter this examination again with this key.'
      );
    }

    // 2. Check if student has ALREADY entered and started an attempt for this examination
    const existingAttempts = await prisma.examAttempt.findMany({
      where: { examId: exam.id, studentId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAttempts.length > 0) {
      const latestAttempt = existingAttempts[0];
      if (latestAttempt.status === 'in_progress') {
        throw new Error(
          'You have already started this examination and have an active session in progress. This single-use key cannot be entered again. Please resume your live exam directly from your dashboard.'
        );
      }
      if (latestAttempt.status === 'terminated_suspicious') {
        throw new Error(
          'Your previous session for this examination was terminated for an integrity violation. This single-use examination key has already been consumed and cannot be reused.'
        );
      }
      if (latestAttempt.status === 'submitted') {
        throw new Error(
          'You have already completed and submitted this examination. Examination keys are single-use and cannot be used again.'
        );
      }
      throw new Error(
        'This examination key is single-use and was already used to start your exam. You cannot enter this examination again with this key.'
      );
    }

    return {
      exam,
      activeAttempt: null,
      canResume: false,
      attemptsCount: 0,
    };
  }

  /**
   * Starts an exam attempt atomically with authoritative server deadline and single-use key consumption
   */
  static async startExamAttempt(examId: string, studentId: string, rawKey?: string) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        keys: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!exam || exam.status !== 'published') {
      throw new Error('Exam is not available');
    }

    const currentVersion = exam.versions[0];
    if (!currentVersion) throw new Error('Exam version not found');

    // Check if active attempt already exists or if student already started an attempt
    const existingAttempts = await prisma.examAttempt.findMany({
      where: {
        examId,
        studentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAttempts.length > 0) {
      const latest = existingAttempts[0];
      if (latest.status === 'in_progress') {
        // If deadline already passed, expire it
        if (new Date() > latest.deadlineAt) {
          return await this.expireAttempt(latest.id);
        }
        return latest;
      }
      throw new Error(
        'You have already started or completed this examination. Examination access keys are single-use and cannot be used to start or re-enter an exam.'
      );
    }

    // Resolve matching exam key
    let matchingKey = null;
    if (rawKey) {
      const keyHash = hashExamKey(rawKey);
      matchingKey = exam.keys.find((k) => k.keyHash === keyHash);
    }
    if (!matchingKey && exam.keys.length > 0) {
      matchingKey = exam.keys[0];
    }

    // Check if key was already consumed by this student
    if (matchingKey) {
      const priorUsage = await prisma.examKeyUsage.findUnique({
        where: {
          examKeyId_studentId: {
            examKeyId: matchingKey.id,
            studentId,
          },
        },
      });

      if (priorUsage) {
        throw new Error(
          'This examination key has already been consumed by your account. Single-use keys cannot be used to start an exam again.'
        );
      }
    }

    // Server-authoritative start and deadline
    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + exam.durationMinutes * 60 * 1000);

    return await prisma.$transaction(async (tx) => {
      // 1. Create the single attempt
      const attempt = await tx.examAttempt.create({
        data: {
          examId,
          examVersionId: currentVersion.id,
          studentId,
          examKeyId: matchingKey?.id || null,
          status: 'in_progress',
          startedAt,
          deadlineAt,
          trustScore: 100,
          reviewStatus: 'none',
        },
      });

      // 2. Atomically record ExamKeyUsage so key is locked and cannot be reused
      if (matchingKey) {
        await tx.examKeyUsage.create({
          data: {
            examKeyId: matchingKey.id,
            studentId,
            examId,
            usedAt: startedAt,
          },
        });
      }

      await recordAuditEvent({
        actorId: studentId,
        action: 'EXAM_ATTEMPT_STARTED',
        targetType: 'ExamAttempt',
        targetId: attempt.id,
        metadata: {
          examId,
          examKeyId: matchingKey?.id,
          durationMinutes: exam.durationMinutes,
          deadlineAt: deadlineAt.toISOString(),
        },
      });

      return attempt;
    });
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
