import { BidProgress, BidSituation, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyWriteAccess, scopedBidCompanyId, type AuthScope } from './access.service.js';

export type BidInput = {
  tenderId?: string;
  companyId?: string;
  proposalValue?: number | null;
  progress?: BidProgress;
  situation?: BidSituation;
  observations?: string | null;
};

export type BidQuery = {
  search?: string;
  companyId?: string;
  progress?: BidProgress;
  situation?: BidSituation;
  page: number;
  pageSize: number;
  sort: 'sessionDate' | 'createdAt' | 'municipality';
  direction: 'asc' | 'desc';
};

export const accessibleBidWhere = (auth: AuthScope): Prisma.BidWhereInput => {
  if (auth.role === UserRole.ADMIN) return {};
  if (auth.role === UserRole.EMPRESA) {
    return { companyId: auth.companyId ?? '00000000-0000-0000-0000-000000000000' };
  }
  return { company: { staffLinks: { some: { userId: auth.userId } } } };
};

const includeBid = {
  company: true,
  tender: { include: { platform: true } },
  _count: { select: { documents: true } }
} satisfies Prisma.BidInclude;

export const createBid = async (
  input: BidInput & Required<Pick<BidInput, 'tenderId' | 'companyId'>>,
  auth: AuthScope
) => {
  const companyId = scopedBidCompanyId(auth, input.companyId)!;
  await assertCompanyWriteAccess(companyId, auth);
  const [company, tender] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { active: true } }),
    prisma.tender.findUnique({ where: { id: input.tenderId }, select: { id: true } })
  ]);
  if (!company?.active) throw new AppError('Empresa não encontrada ou inativa', 422);
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);

  try {
    return await prisma.bid.create({
      data: {
        tenderId: input.tenderId,
        companyId,
        proposalValue: input.proposalValue,
        progress: input.progress,
        situation: input.situation,
        observations: input.observations || null,
        createdById: auth.userId,
        updatedById: auth.userId
      },
      include: includeBid
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Esta licitação já está associada à empresa', 409);
    }
    throw error;
  }
};

export const updateBid = async (id: string, input: BidInput, auth: AuthScope) => {
  const current = await prisma.bid.findFirst({ where: { id, ...accessibleBidWhere(auth) } });
  if (!current) throw new AppError('Participação não encontrada', 404);
  await assertCompanyWriteAccess(current.companyId, auth);
  return prisma.bid.update({
    where: { id },
    data: {
      ...(input.proposalValue !== undefined ? { proposalValue: input.proposalValue } : {}),
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(input.situation !== undefined ? { situation: input.situation } : {}),
      ...(input.observations !== undefined ? { observations: input.observations || null } : {}),
      updatedById: auth.userId
    },
    include: includeBid
  });
};

export const getBid = async (id: string, auth: AuthScope) => {
  const bid = await prisma.bid.findFirst({
    where: { id, ...accessibleBidWhere(auth) },
    include: {
      ...includeBid,
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } }
    }
  });
  if (!bid) throw new AppError('Participação não encontrada', 404);
  return bid;
};

export const listBids = async (query: BidQuery, auth: AuthScope) => {
  const companyId = scopedBidCompanyId(auth, query.companyId);
  if (companyId) await assertCompanyWriteAccess(companyId, auth);
  const where: Prisma.BidWhereInput = {
    ...accessibleBidWhere(auth),
    ...(companyId ? { companyId } : {}),
    ...(query.progress ? { progress: query.progress } : {}),
    ...(query.situation ? { situation: query.situation } : {}),
    ...(query.search
      ? {
          OR: [
            { tender: { municipality: { contains: query.search, mode: 'insensitive' } } },
            { tender: { object: { contains: query.search, mode: 'insensitive' } } },
            { tender: { noticeNumber: { contains: query.search, mode: 'insensitive' } } },
            { tender: { processNumber: { contains: query.search, mode: 'insensitive' } } },
            { company: { legalName: { contains: query.search, mode: 'insensitive' } } },
            { company: { tradeName: { contains: query.search, mode: 'insensitive' } } }
          ]
        }
      : {})
  };
  const orderBy: Prisma.BidOrderByWithRelationInput =
    query.sort === 'createdAt'
      ? { createdAt: query.direction }
      : { tender: { [query.sort]: query.direction } };
  const [items, total] = await prisma.$transaction([
    prisma.bid.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: includeBid
    }),
    prisma.bid.count({ where })
  ]);
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pages: Math.ceil(total / query.pageSize)
  };
};

export const deleteBid = async (id: string, auth: AuthScope) => {
  if (auth.role === UserRole.EMPRESA) {
    throw new AppError('Seu perfil não pode desassociar a licitação inteira', 403);
  }
  const bid = await getBid(id, auth);
  await assertCompanyWriteAccess(bid.companyId, auth);
  await prisma.$transaction([
    prisma.discountCalculation.deleteMany({ where: { companyId: bid.companyId, tenderId: bid.tenderId } }),
    prisma.bid.delete({ where: { id: bid.id } })
  ]);
  return bid;
};
