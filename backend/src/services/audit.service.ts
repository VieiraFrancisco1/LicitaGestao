import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import type { AuthScope } from './access.service.js';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'UPLOAD';

export const AuditActions = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  UPLOAD: 'UPLOAD'
} as const;

export type AuditInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAudit(auth: AuthScope, input: AuditInput) {
  try {
    await (prisma as any).auditLog.create({
      data: {
        actorId: auth.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        description: input.description,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
      }
    });
  } catch (error) {
    console.error('Falha ao registrar auditoria:', error);
  }
}

export async function listAuditLogs(query: {
  page: number;
  pageSize: number;
  action?: AuditAction;
  entityType?: string;
  search?: string;
}) {
  const where = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.search
      ? {
          OR: [
            { description: { contains: query.search, mode: 'insensitive' } },
            { entityLabel: { contains: query.search, mode: 'insensitive' } },
            { actor: { name: { contains: query.search, mode: 'insensitive' } } },
            { actor: { email: { contains: query.search, mode: 'insensitive' } } }
          ]
        }
      : {})
  };
  const [items, total] = await prisma.$transaction([
    (prisma as any).auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    (prisma as any).auditLog.count({ where })
  ]);
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pages: Math.ceil(total / query.pageSize)
  };
}
