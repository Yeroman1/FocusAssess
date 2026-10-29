import { prisma } from '../../utils/prisma.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  MonitoredEventType,
  MonitoringEventPayload,
  TrustScoreState,
  DEFAULT_ANTI_CHEATING_SETTINGS,
  shouldTerminateAttempt,
} from '@pyassess/shared';

const PENALTY_MAP: Record<MonitoredEventType, number> = {
  VISIBILITY_HIDDEN: DEFAULT_ANTI_CHEATING_SETTINGS.penalties.visibilityHidden, // 10
  WINDOW_BLUR: DEFAULT_ANTI_CHEATING_SETTINGS.penalties.windowBlur,             // 10
  FULLSCREEN_EXIT: DEFAULT_ANTI_CHEATING_SETTINGS.penalties.fullscreenExit,     // 10
  CLIPBOARD_COPY: DEFAULT_ANTI_CHEATING_SETTINGS.penalties.clipboardCopy,       // 5
  CLIPBOARD_PASTE: DEFAULT_ANTI_CHEATING_SETTINGS.penalties.clipboardPaste,     // 5
  CONTEXT_MENU: DEFAULT_ANTI_CHEATING_SETTINGS.penalties.contextMenu,           // 3
};

export class MonitoringService {
  /**
   * Records an anti-cheating event idempotently, deducts trust score, and enforces strictly < 70 termination.
   */
  static async recordEvent(
    attemptId: string,
    studentId: string,
    payload: MonitoringEventPayload
  ): Promise<TrustScoreState> {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== studentId) throw new Error('Forbidden');

    // If attempt is already terminated, submitted, or expired, return current state without penalty
    if (attempt.status !== 'in_progress') {
      return {
        attemptId: attempt.id,
        trustScore: attempt.trustScore,
        status: attempt.status,
        isTerminated: attempt.status === 'terminated_suspicious',
        terminationReason: attempt.terminationReason,
      };
    }

    // 1. Check idempotency key: prevent duplicate deduction for the same incident
    const existingEvent = await prisma.examEvent.findUnique({
      where: { idempotencyKey: payload.idempotencyKey },
    });

    if (existingEvent) {
      return {
        attemptId: attempt.id,
        trustScore: attempt.trustScore,
        status: attempt.status,
        isTerminated: false,
      };
    }

    const penalty = PENALTY_MAP[payload.eventType] ?? 5;
    const newTrustScore = Math.max(0, attempt.trustScore - penalty);

    // 2. Strict termination check: strictly < 70 (score of 70 does NOT terminate!)
    const shouldHalt = shouldTerminateAttempt(newTrustScore, 70);

    return await prisma.$transaction(async (tx) => {
      // Record immutable audit event
      await tx.examEvent.create({
        data: {
          attemptId,
          eventType: payload.eventType,
          occurredAt: new Date(payload.occurredAt || Date.now()),
          durationMs: payload.durationMs,
          penalty,
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
          idempotencyKey: payload.idempotencyKey,
        },
      });

      if (shouldHalt) {
        const terminationReason = `Integrity Guard Triggered: Trust score fell to ${newTrustScore}% (strictly below 70% threshold) following ${payload.eventType}. Session paused for non-punitive instructor review.`;

        const terminatedAttempt = await tx.examAttempt.update({
          where: { id: attemptId },
          data: {
            trustScore: newTrustScore,
            status: 'terminated_suspicious',
            terminatedAt: new Date(),
            terminationReason,
            reviewStatus: 'pending_review',
          },
        });

        await recordAuditEvent({
          actorId: studentId,
          action: 'ATTEMPT_TERMINATED_SUSPICIOUS',
          targetType: 'ExamAttempt',
          targetId: attemptId,
          reason: terminationReason,
          metadata: {
            eventType: payload.eventType,
            previousScore: attempt.trustScore,
            newScore: newTrustScore,
            threshold: 70,
          },
        });

        return {
          attemptId: terminatedAttempt.id,
          trustScore: terminatedAttempt.trustScore,
          status: terminatedAttempt.status,
          isTerminated: true,
          terminationReason,
          latestEventPenalty: penalty,
        };
      }

      // Normal state update (score >= 70)
      const updated = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          trustScore: newTrustScore,
        },
      });

      return {
        attemptId: updated.id,
        trustScore: updated.trustScore,
        status: updated.status,
        isTerminated: false,
        latestEventPenalty: penalty,
      };
    });
  }

  /**
   * Reopens a terminated attempt (Instructors and Admins only) with mandatory audit reason.
   */
  static async reopenAttempt(
    attemptId: string,
    authorizedActorId: string,
    reason: string,
    restoredTrustScore = 80
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('A valid explanatory reason is required to reopen an attempt');
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) throw new Error('Attempt not found');

    // Strict Authorization: Only the Exam Owner or a System Administrator can reopen an attempt
    const actor = await prisma.profile.findUnique({ where: { id: authorizedActorId } });
    const isAdmin = actor?.role === 'admin' || actor?.email?.toLowerCase() === 'yeritti2017@gmail.com';
    if (attempt.exam.ownerId !== authorizedActorId && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to reopen attempts for this examination.');
    }

    if (attempt.status !== 'terminated_suspicious') {
      throw new Error(`Cannot reopen attempt: Current status is ${attempt.status}`);
    }

    const reopened = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'in_progress',
        trustScore: Math.max(restoredTrustScore, 75),
        reviewStatus: 'reopened',
        terminatedAt: null,
        terminationReason: null,
      },
    });

    await recordAuditEvent({
      actorId: authorizedActorId,
      action: 'ATTEMPT_REOPENED',
      targetType: 'ExamAttempt',
      targetId: attemptId,
      reason,
      metadata: { previousScore: attempt.trustScore, restoredScore: reopened.trustScore },
    });

    return reopened;
  }
}
