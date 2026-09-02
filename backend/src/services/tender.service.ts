import { BidSituation, GuaranteeType, Prisma, TenderListStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import type { AuthScope } from './access.service.js';

export type TenderInput = {
  noticeNumber?: string | null;
  processNumber?: string | null;
  municipality?: string;
  state?: string | null;
  agency?: string | null;
  sessionDate?: Date;
  sessionTime?: string | null;
  object?: string;
  proposalValidityDays?: number | null;
  estimatedValue?: number | null;
  guaranteeType?: GuaranteeType;
  guaranteePercentage?: number | null;
  guaranteeValue?: number | null;
  platformId?: string | null;
  platformLink?: string | null;
  seobraLink?: string | null;
  requiresGuaranteeOnePercent?: boolean;
};

export type TenderQuery = {
  search?: string;
  municipality?: string;
  platformId?: string;
  listStatus?: TenderListStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
  sort: 'sessionDate' | 'createdAt' | 'municipality';
  direction: 'asc' | 'desc';
};

const addDays = (date: Date, days: number | null | undefined) =>
  days === null || days === undefined ? null : new Date(date.getTime() + days * 86_400_000);

export const accessibleParticipationWhere = (auth: AuthScope): Prisma.BidWhereInput => {
  if (auth.role === UserRole.ADMIN) return {};
  if (auth.role === UserRole.EMPRESA) {
    return { companyId: auth.companyId ?? '00000000-0000-0000-0000-000000000000' };
  }
  return { company: { staffLinks: { some: { userId: auth.userId } } } };
};

const ensurePlatform = async (platformId?: string | null) => {
  if (!platformId) return;
  const platform = await prisma.platform.findUnique({ where: { id: platformId }, select: { active: true } });
  if (!platform?.active) throw new AppError('Plataforma não encontrada ou inativa', 422);
};

const clean = (data: TenderInput, referenceValue?: number | Prisma.Decimal | null) => {
  const { requiresGuaranteeOnePercent, ...rest } = data;
  const estimatedValue = data.estimatedValue ?? referenceValue;
  return {
    ...rest,
    ...(data.platformLink !== undefined ? { platformLink: data.platformLink || null } : {}),
    ...(data.seobraLink !== undefined ? { seobraLink: data.seobraLink || null } : {}),
    ...(requiresGuaranteeOnePercent !== undefined
      ? {
          guaranteeType: requiresGuaranteeOnePercent
            ? GuaranteeType.PROPOSTA_INICIAL
            : GuaranteeType.NAO_EXIGIDA,
          guaranteePercentage: requiresGuaranteeOnePercent ? new Prisma.Decimal(1) : null,
          guaranteeValue:
            requiresGuaranteeOnePercent && estimatedValue
              ? new Prisma.Decimal(estimatedValue).dividedBy(100).toDecimalPlaces(2)
              : null
        }
      : {})
  };
};

const includeTender = (auth: AuthScope) =>
  ({
    platform: true,
    bids: {
      where: accessibleParticipationWhere(auth),
      include: { company: true, _count: { select: { documents: true } } },
      orderBy: { company: { legalName: 'asc' as const } }
    },
    _count: { select: { bids: true } }
  }) satisfies Prisma.TenderInclude;

export const createTender = async (
  input: TenderInput &
    Required<
      Pick<
        TenderInput,
        'municipality' | 'sessionDate' | 'object' | 'proposalValidityDays' | 'estimatedValue' | 'platformId'
      >
    >,
  auth: AuthScope
) => {
  await ensurePlatform(input.platformId);
  return prisma.tender.create({
    data: {
      ...clean(input, input.estimatedValue),
      municipality: input.municipality,
      sessionDate: input.sessionDate,
      object: input.object,
      proposalExpirationDate: addDays(input.sessionDate, input.proposalValidityDays),
      createdById: auth.userId,
      updatedById: auth.userId
    },
    include: includeTender(auth)
  });
};

export const updateTender = async (id: string, input: TenderInput, auth: AuthScope) => {
  const current = await prisma.tender.findUnique({ where: { id } });
  if (!current) throw new AppError('Licitação geral não encontrada', 404);
  await ensurePlatform(input.platformId === undefined ? current.platformId : input.platformId);
  const sessionDate = input.sessionDate ?? current.sessionDate;
  const validity =
    input.proposalValidityDays === undefined ? current.proposalValidityDays : input.proposalValidityDays;
  return prisma.tender.update({
    where: { id },
    data: {
      ...clean(input, current.estimatedValue),
      proposalExpirationDate: addDays(sessionDate, validity),
      updatedById: auth.userId
    },
    include: includeTender(auth)
  });
};

export const getTender = async (id: string, auth: AuthScope) => {
  const tender = await prisma.tender.findUnique({
    where: { id },
    include: {
      ...includeTender(auth),
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } }
    }
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  return (await addAttachmentProgress([tender]))[0]!;
};

export const listTenders = async (query: TenderQuery, auth: AuthScope) => {
  const where: Prisma.TenderWhereInput = {
    ...(query.municipality ? { municipality: { contains: query.municipality, mode: 'insensitive' } } : {}),
    ...(query.platformId ? { platformId: query.platformId } : {}),
    ...(query.listStatus ? { listStatus: query.listStatus } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          sessionDate: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {})
          }
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { municipality: { contains: query.search, mode: 'insensitive' } },
            { object: { contains: query.search, mode: 'insensitive' } },
            { noticeNumber: { contains: query.search, mode: 'insensitive' } },
            { processNumber: { contains: query.search, mode: 'insensitive' } },
            { agency: { contains: query.search, mode: 'insensitive' } }
          ]
        }
      : {})
  };
  const orderBy = { [query.sort]: query.direction } as Prisma.TenderOrderByWithRelationInput;
  const [items, total] = await prisma.$transaction([
    prisma.tender.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: includeTender(auth)
    }),
    prisma.tender.count({ where })
  ]);
  return {
    items: await addAttachmentProgress(items),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pages: Math.ceil(total / query.pageSize)
  };
};

const addAttachmentProgress = async <T extends { id: string; _count: { bids: number } }>(items: T[]) => {
  if (items.length === 0) return [];
  const attached = await prisma.bid.groupBy({
    by: ['tenderId'],
    where: { tenderId: { in: items.map((item) => item.id) }, situation: BidSituation.ANEXADA },
    _count: { _all: true }
  });
  const counts = new Map(attached.map((item) => [item.tenderId, item._count._all]));
  return items.map((item) => {
    const attachedCompanies = counts.get(item.id) ?? 0;
    return {
      ...item,
      attachedCompanies,
      allCompaniesAttached: item._count.bids > 0 && attachedCompanies === item._count.bids
    };
  });
};

export const setSpreadsheetReady = async (id: string, ready: boolean, auth: AuthScope) => {
  const exists = await prisma.tender.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError('Licitação geral não encontrada', 404);
  return prisma.tender.update({
    where: { id },
    data: { spreadsheetReady: ready, updatedById: auth.userId },
    include: includeTender(auth)
  });
};

export const setTenderListStatus = async (id: string, status: TenderListStatus, auth: AuthScope) => {
  const tender = await prisma.tender.findUnique({
    where: { id },
    include: { bids: { select: { situation: true } } }
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  if (
    status === TenderListStatus.ANEXADA &&
    (tender.bids.length === 0 || tender.bids.some((bid) => bid.situation !== BidSituation.ANEXADA))
  ) {
    throw new AppError('Todas as empresas associadas precisam estar com situação ANEXADA', 422);
  }
  return prisma.tender.update({
    where: { id },
    data: { listStatus: status, updatedById: auth.userId },
    include: includeTender(auth)
  });
};
