import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';

type PlatformInput = { name?: string; site?: string | null; observations?: string | null; active?: boolean };

const clean = (data: PlatformInput) => ({
  ...data,
  ...(data.site !== undefined ? { site: data.site || null } : {}),
  ...(data.observations !== undefined ? { observations: data.observations || null } : {})
});

export const createPlatform = (data: PlatformInput & { name: string }) =>
  prisma.platform.create({ data: clean(data) as Prisma.PlatformCreateInput });

export const updatePlatform = async (id: string, data: PlatformInput) => {
  const exists = await prisma.platform.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError('Plataforma não encontrada', 404);
  return prisma.platform.update({ where: { id }, data: clean(data) });
};

export const listPlatforms = (query: { search?: string; active?: string }) =>
  prisma.platform.findMany({
    where: {
      ...(query.active ? { active: query.active === 'true' } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {})
    },
    include: { _count: { select: { tenders: true } } },
    orderBy: { name: 'asc' }
  });
