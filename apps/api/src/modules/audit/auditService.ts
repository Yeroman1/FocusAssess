import { prisma } from '../../utils/prisma.js';

export interface RecordAuditParams {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(params: RecordAuditParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (err) {
    console.error('[Audit Log Error] Failed to write audit event:', err);
    // Do not throw to avoid crashing the primary operation
    return null;
  }
}
