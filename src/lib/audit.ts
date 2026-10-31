import { db } from "@/server/db";
import { logger } from "@/lib/logger";

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Writes an immutable audit trail record for lifecycle, financial, and security actions.
 * Safely fails without breaking caller operations if database is temporarily unavailable.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldState: params.oldState ? JSON.stringify(params.oldState) : null,
        newState: params.newState ? JSON.stringify(params.newState) : null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (error) {
    logger.error("Failed to write audit log entry", { params }, error);
  }
}

