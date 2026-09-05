import { prisma } from '../db/client';

export interface AuditEventInput {
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string;
  action: string;
  previousStateJson?: string | null;
  newStateJson?: string | null;
  contextJson?: string | null;
}

export class AuditService {
  /**
   * Appends an immutable AuditEvent to the database.
   * Public API mutations on historical AuditEvents are strictly prohibited.
   */
  async logAuditEvent(input: AuditEventInput) {
    return prisma.auditEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId,
        actorName: input.actorName,
        action: input.action,
        previousStateJson: input.previousStateJson ?? null,
        newStateJson: input.newStateJson ?? null,
        contextJson: input.contextJson ?? null,
      },
    });
  }

  /**
   * Retrieves audit log entries for a given entity.
   */
  async getAuditHistory(entityType: string, entityId: string) {
    return prisma.auditEvent.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}

export const auditService = new AuditService();
