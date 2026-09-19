import { UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';
import { listCompanyOptions } from './company.service.js';

export type GlobalSearchResult = {
  id: string;
  type: 'TENDER' | 'COMPANY' | 'PLATFORM' | 'USER' | 'EMAIL';
  title: string;
  subtitle: string;
  link: string;
};

export async function globalSearch(auth: AuthScope, query: string) {
  const q = query.trim();
  if (q.length < 2) return [] as GlobalSearchResult[];

  const organizationId = requireOrganizationId(auth);
  const companies = await listCompanyOptions(auth);
  const companyIds = companies.map((company) => company.id);
  const admin = auth.role === UserRole.ADMIN || auth.role === UserRole.SUPER_ADMIN;

  const [tenders, platforms, users, emails] = await Promise.all([
    prisma.tender.findMany({
      where: {
        organizationId,
        ...(!admin ? { bids: { some: { companyId: { in: companyIds } } } } : {}),
        OR: [
          { municipality: { contains: q, mode: 'insensitive' } },
          { noticeNumber: { contains: q, mode: 'insensitive' } },
          { processNumber: { contains: q, mode: 'insensitive' } },
          { object: { contains: q, mode: 'insensitive' } },
          { agency: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: { id: true, municipality: true, noticeNumber: true, processNumber: true, object: true },
      take: 6,
      orderBy: { sessionDate: 'desc' }
    }),
    prisma.platform.findMany({
      where: {
        organizationId,
        active: true,
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { site: { contains: q, mode: 'insensitive' } }]
      },
      select: { id: true, name: true, site: true },
      take: 5,
      orderBy: { name: 'asc' }
    }),
    admin
      ? prisma.user.findMany({
          where: {
            organizationId,
            active: true,
            OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }]
          },
          select: { id: true, name: true, email: true },
          take: 5,
          orderBy: { name: 'asc' }
        })
      : Promise.resolve([]),
    prisma.emailMessage.findMany({
      where: {
        companyId: { in: companyIds },
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { sender: { contains: q, mode: 'insensitive' } },
          { snippet: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: { id: true, companyId: true, subject: true, sender: true, tenderId: true, bidId: true },
      take: 5,
      orderBy: { receivedAt: 'desc' }
    })
  ]);

  const companyResults = companies
    .filter((company) =>
      [company.legalName, company.tradeName].filter(Boolean).some((value) => value!.toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR')))
    )
    .slice(0, 5)
    .map<GlobalSearchResult>((company) => ({
      id: company.id,
      type: 'COMPANY',
      title: company.tradeName || company.legalName,
      subtitle: company.legalName,
      link: `/empresas/${company.id}`
    }));

  return [
    ...tenders.map<GlobalSearchResult>((tender) => ({
      id: tender.id,
      type: 'TENDER',
      title: `${tender.municipality}${tender.noticeNumber ? ` · ${tender.noticeNumber}` : ''}`,
      subtitle: tender.processNumber || tender.object.slice(0, 110),
      link: `/licitacoes/${tender.id}`
    })),
    ...companyResults,
    ...platforms.map<GlobalSearchResult>((platform) => ({
      id: platform.id,
      type: 'PLATFORM',
      title: platform.name,
      subtitle: platform.site || 'Plataforma cadastrada',
      link: '/plataformas'
    })),
    ...users.map<GlobalSearchResult>((user) => ({
      id: user.id,
      type: 'USER',
      title: user.name,
      subtitle: user.email,
      link: '/usuarios'
    })),
    ...emails.map<GlobalSearchResult>((email) => ({
      id: email.id,
      type: 'EMAIL',
      title: email.subject || 'E-mail sem assunto',
      subtitle: email.sender,
      link: email.bidId
        ? `/participacoes/${email.bidId}?tab=convocations&message=${email.id}`
        : email.tenderId
          ? `/licitacoes/${email.tenderId}`
          : `/empresas/${email.companyId}?tab=convocations`
    }))
  ].slice(0, 20);
}
