import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';
import type { Candidate } from './discovery-core.js';
import { discoveryScope } from './discovery.service.js';

// Esta lista não substitui o Controle Geral: guardar/retirar uma oportunidade
// nunca cria nem remove uma licitação cadastrada.
export async function listWeeklyItems(auth: AuthScope) {
  const organizationId = discoveryScope(auth);
  const rows = await prisma.weeklyTenderItem.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { opportunity: { include: { importedTender: { select: { id: true } } } } }
  });
  return rows.map(({ id, opportunityId, createdAt, opportunity }) => ({
    id, opportunityId, createdAt,
    opportunity: {
      ...(opportunity.data as unknown as Candidate),
      importedTenderId: opportunity.importedTender?.id ?? null,
      active: opportunity.active
    }
  }));
}

export async function addWeeklyItem(auth: AuthScope, opportunityId: string) {
  const organizationId = discoveryScope(auth);
  const opportunity = await prisma.discoveryOpportunity.findFirst({
    where: { id: opportunityId, organizationId, active: true }, select: { id: true }
  });
  if (!opportunity) throw new AppError('A oportunidade não está mais ativa ou não pertence a esta conta.', 404);
  try {
    const item = await prisma.weeklyTenderItem.create({
      data: { organizationId, opportunityId }, select: { id: true, opportunityId: true }
    });
    return { ...item, alreadyAdded: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { opportunityId, alreadyAdded: true };
    }
    throw error;
  }
}

export async function removeWeeklyItem(auth: AuthScope, id: string) {
  const organizationId = discoveryScope(auth);
  const result = await prisma.weeklyTenderItem.deleteMany({ where: { id, organizationId } });
  if (!result.count) throw new AppError('Item não encontrado na lista semanal.', 404);
  return { removed: result.count };
}

export async function clearWeeklyItems(auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  discoveryScope(auth);
  const result = await prisma.weeklyTenderItem.deleteMany({ where: { organizationId } });
  return { removed: result.count };
}
