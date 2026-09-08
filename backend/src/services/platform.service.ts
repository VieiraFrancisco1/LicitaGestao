import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';

type PlatformInput = { name?: string; site?: string | null; observations?: string | null; active?: boolean };
const clean = (data: PlatformInput) => ({
  ...data,
  ...(data.site !== undefined ? { site: data.site || null } : {}),
  ...(data.observations !== undefined ? { observations: data.observations || null } : {})
});

export const createPlatform = (data: PlatformInput & { name: string }, auth: AuthScope) =>
  prisma.platform.create({
    data: {
      ...(clean(data) as Omit<Prisma.PlatformUncheckedCreateInput, 'organizationId'>),
      organizationId: requireOrganizationId(auth)
    }
  });

export const updatePlatform = async (id: string, data: PlatformInput, auth: AuthScope) => {
  const exists = await prisma.platform.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    select: { id: true }
  });
  if (!exists) throw new AppError('Plataforma não encontrada', 404);
  return prisma.platform.update({ where: { id }, data: clean(data) });
};

export const listPlatforms = (query: { search?: string; active?: string }, auth: AuthScope) =>
  prisma.platform.findMany({
    where: {
      organizationId: requireOrganizationId(auth),
      ...(query.active ? { active: query.active === 'true' } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {})
    },
    include: { _count: { select: { tenders: true } } },
    orderBy: { name: 'asc' }
  });
