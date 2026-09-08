import { BidProgress, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { onlyDigits } from '../utils/cnpj.js';
import {
  assertCompanyPortalAccess,
  requireOrganizationId,
  type AuthScope
} from './access.service.js';

export type CompanyInput = {
  legalName?: string;
  tradeName?: string | null;
  cnpj?: string;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  observations?: string | null;
  active?: boolean;
};

const clean = (data: CompanyInput) => ({
  ...data,
  ...(data.cnpj ? { cnpj: onlyDigits(data.cnpj) } : {}),
  ...(data.email !== undefined ? { email: data.email || null } : {})
});

export const createCompany = (
  data: CompanyInput & { legalName: string; cnpj: string },
  auth: AuthScope
) =>
  prisma.company.create({
    data: {
      ...(clean(data) as Omit<Prisma.CompanyUncheckedCreateInput, 'organizationId'>),
      organizationId: requireOrganizationId(auth)
    }
  });

export const updateCompany = async (id: string, data: CompanyInput, auth: AuthScope) => {
  const organizationId = requireOrganizationId(auth);
  const exists = await prisma.company.findFirst({ where: { id, organizationId }, select: { id: true } });
  if (!exists) throw new AppError('Empresa não encontrada', 404);
  return prisma.company.update({ where: { id }, data: clean(data) });
};

export const getCompany = async (id: string, auth: AuthScope) => {
  await assertCompanyPortalAccess(id, auth);
  const company = await prisma.company.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    include: { _count: { select: { users: true, staffLinks: true, bids: true } } }
  });
  if (!company) throw new AppError('Empresa não encontrada', 404);
  return company;
};

export const listCompanies = async (
  query: { search?: string; active?: string; page: number; pageSize: number },
  auth: AuthScope
) => {
  const organizationId = requireOrganizationId(auth);
  const where: Prisma.CompanyWhereInput = {
    organizationId,
    ...(auth.role === UserRole.EMPRESA
      ? { id: auth.companyId ?? '00000000-0000-0000-0000-000000000000' }
      : {}),
    ...(auth.role === UserRole.FUNCIONARIO ? { staffLinks: { some: { userId: auth.userId } } } : {}),
    ...(query.active ? { active: query.active === 'true' } : {}),
    ...(query.search
      ? {
          OR: [
            { legalName: { contains: query.search, mode: 'insensitive' } },
            { tradeName: { contains: query.search, mode: 'insensitive' } },
            { cnpj: { contains: onlyDigits(query.search) } }
          ]
        }
      : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.company.findMany({
      where,
      orderBy: { legalName: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { users: true, staffLinks: true, bids: true } } }
    }),
    prisma.company.count({ where })
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize, pages: Math.ceil(total / query.pageSize) };
};

export const getCompanyDocuments = async (companyId: string, auth: AuthScope) => {
  await assertCompanyPortalAccess(companyId, auth);
  return prisma.document.findMany({
    where: { bid: { companyId, tender: { organizationId: requireOrganizationId(auth) } } },
    include: {
      bid: {
        select: {
          id: true,
          tender: { select: { id: true, noticeNumber: true, municipality: true, object: true } }
        }
      },
      uploadedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const getCompanyPlatformSummary = async (companyId: string, auth: AuthScope) => {
  await assertCompanyPortalAccess(companyId, auth);
  const bids = await prisma.bid.findMany({
    where: {
      companyId,
      progress: { not: BidProgress.FINALIZADA },
      tender: { organizationId: requireOrganizationId(auth), platformId: { not: null } }
    },
    select: {
      id: true,
      progress: true,
      tender: {
        select: {
          noticeNumber: true,
          municipality: true,
          sessionDate: true,
          platform: { select: { id: true, name: true, site: true } }
        }
      }
    },
    orderBy: { tender: { sessionDate: 'asc' } }
  });
  const grouped = new Map<string, { id: string; name: string; site: string | null; bids: typeof bids }>();
  for (const bid of bids) {
    if (!bid.tender.platform) continue;
    const current = grouped.get(bid.tender.platform.id) ?? { ...bid.tender.platform, bids: [] };
    current.bids.push(bid);
    grouped.set(bid.tender.platform.id, current);
  }
  return [...grouped.values()];
};

export const listCompanyOptions = (auth: AuthScope) =>
  prisma.company.findMany({
    where: {
      organizationId: requireOrganizationId(auth),
      active: true,
      ...(auth.role === UserRole.EMPRESA
        ? { id: auth.companyId ?? '00000000-0000-0000-0000-000000000000' }
        : {}),
      ...(auth.role === UserRole.FUNCIONARIO ? { staffLinks: { some: { userId: auth.userId } } } : {})
    },
    select: { id: true, legalName: true, tradeName: true },
    orderBy: { legalName: 'asc' }
  });
