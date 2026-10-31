import { db } from "@/server/db";
import type { Prisma } from "@prisma/client";

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  actor?: string; // Search user name, email, or userId
  startDate?: Date | string;
  endDate?: Date | string;
  skip?: number;
  take?: number;
}

export class AuditQueryService {
  /**
   * Retrieves paginated audit logs with multi-field filtering
   */
  async listLogs(filters?: AuditLogFilters) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.entityType && filters.entityType !== "ALL") {
      where.entityType = filters.entityType;
    }

    if (filters?.action && filters.action !== "ALL") {
      where.action = filters.action;
    }

    if (filters?.actor && filters.actor.trim().length > 0) {
      const term = filters.actor.trim();
      where.OR = [
        { userId: term },
        { user: { email: { contains: term, mode: "insensitive" } } },
        { user: { name: { contains: term, mode: "insensitive" } } },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: filters?.skip ?? 0,
        take: filters?.take ?? 25,
      }),
      db.auditLog.count({ where }),
    ]);

    const formatted = logs.map((log) => ({
      ...log,
      oldStateParsed: log.oldState ? safeParseJson(log.oldState) : null,
      newStateParsed: log.newState ? safeParseJson(log.newState) : null,
      metadataParsed: log.metadata ? safeParseJson(log.metadata) : null,
    }));

    return {
      logs: formatted,
      total,
      page: Math.floor((filters?.skip ?? 0) / (filters?.take ?? 25)) + 1,
      pageSize: filters?.take ?? 25,
      totalPages: Math.ceil(total / (filters?.take ?? 25)),
    };
  }

  /**
   * Returns distinct entity types and action names for populating UI filter options
   */
  async getFilterOptions() {
    const [entities, actions] = await Promise.all([
      db.auditLog.findMany({
        select: { entityType: true },
        distinct: ["entityType"],
        orderBy: { entityType: "asc" },
      }),
      db.auditLog.findMany({
        select: { action: true },
        distinct: ["action"],
        orderBy: { action: "asc" },
      }),
    ]);

    return {
      entityTypes: entities.map((e) => e.entityType).filter(Boolean),
      actions: actions.map((a) => a.action).filter(Boolean),
    };
  }

  /**
   * Retrieves single audit log record by ID
   */
  async getById(id: string) {
    const log = await db.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!log) return null;

    return {
      ...log,
      oldStateParsed: log.oldState ? safeParseJson(log.oldState) : null,
      newStateParsed: log.newState ? safeParseJson(log.newState) : null,
      metadataParsed: log.metadata ? safeParseJson(log.metadata) : null,
    };
  }
}

function safeParseJson(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}

export const auditQueryService = new AuditQueryService();

