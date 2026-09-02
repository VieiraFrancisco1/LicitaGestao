import { BidProgress, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import type { AuthScope } from './access.service.js';
import { accessibleBidWhere } from './bid.service.js';
import { listCompanyOptions } from './company.service.js';
import { listGmailConvocationAlerts } from './gmail.service.js';

const DAY_MS = 86_400_000;

function todayUtc() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const daysBetween = (date: Date, today: Date) => Math.round((date.getTime() - today.getTime()) / DAY_MS);

export async function getDashboard(auth: AuthScope, requestedCompanyId?: string) {
  const companies = await listCompanyOptions(auth);
  if (requestedCompanyId && !companies.some((company) => company.id === requestedCompanyId)) {
    throw new AppError('Empresa não encontrada ou sem acesso', 404);
  }
  const companyIds = requestedCompanyId ? [requestedCompanyId] : companies.map((company) => company.id);
  const today = todayUtc();
  const in3Days = new Date(today.getTime() + 3 * DAY_MS);
  const in7Days = new Date(today.getTime() + 7 * DAY_MS);
  const sevenDaysAgo = new Date(today.getTime() - 7 * DAY_MS);

  const baseWhere: Prisma.BidWhereInput = {
    ...accessibleBidWhere(auth),
    ...(companyIds.length ? { companyId: { in: companyIds } } : { companyId: { in: [] } })
  };

  const gmailData = await listGmailConvocationAlerts(auth);
  const gmailItems = gmailData.items.filter((item) => !requestedCompanyId || item.companyId === requestedCompanyId);

  const [activeBids, upcomingSessions, statusGroups, upcomingBids, deadlineCandidates, activeByCompany, upcomingByCompany] =
    await Promise.all([
      prisma.bid.count({ where: { ...baseWhere, progress: { not: BidProgress.FINALIZADA } } }),
      prisma.bid.count({
        where: {
          ...baseWhere,
          progress: { not: BidProgress.FINALIZADA },
          tender: { sessionDate: { gte: today, lte: in7Days } }
        }
      }),
      prisma.bid.groupBy({ by: ['situation'], where: baseWhere, _count: { _all: true } }),
      prisma.bid.findMany({
        where: {
          ...baseWhere,
          progress: { not: BidProgress.FINALIZADA },
          tender: { sessionDate: { gte: today } }
        },
        include: { company: true, tender: { include: { platform: true } } },
        orderBy: { tender: { sessionDate: 'asc' } },
        take: 6
      }),
      prisma.bid.findMany({
        where: {
          ...baseWhere,
          progress: { not: BidProgress.FINALIZADA },
          tender: { sessionDate: { gte: sevenDaysAgo, lte: in3Days } }
        },
        include: { company: true, tender: { include: { platform: true } } },
        orderBy: { tender: { sessionDate: 'asc' } },
        take: 50
      }),
      prisma.bid.groupBy({
        by: ['companyId'],
        where: { ...accessibleBidWhere(auth), companyId: { in: companies.map((company) => company.id) }, progress: { not: BidProgress.FINALIZADA } },
        _count: { _all: true }
      }),
      prisma.bid.groupBy({
        by: ['companyId'],
        where: {
          ...accessibleBidWhere(auth),
          companyId: { in: companies.map((company) => company.id) },
          progress: { not: BidProgress.FINALIZADA },
          tender: { sessionDate: { gte: today, lte: in7Days } }
        },
        _count: { _all: true }
      })
    ]);

  const activeMap = new Map(activeByCompany.map((item) => [item.companyId, item._count._all]));
  const upcomingMap = new Map(upcomingByCompany.map((item) => [item.companyId, item._count._all]));
  const gmailUnreadByCompany = new Map<string, number>();
  gmailData.items.filter((item) => !item.read).forEach((item) => {
    gmailUnreadByCompany.set(item.companyId, (gmailUnreadByCompany.get(item.companyId) ?? 0) + 1);
  });

  const deadlineItems = deadlineCandidates.flatMap((bid) => {
    const items: Array<{
      key: string;
      type: 'SESSION';
      title: string;
      date: string;
      days: number;
      bidId: string;
      companyId: string;
      companyName: string;
      municipality: string;
      platformName: string | null;
    }> = [];
    const companyName = bid.company.tradeName || bid.company.legalName;
    const sessionDays = daysBetween(bid.tender.sessionDate, today);
    if (sessionDays >= -7 && sessionDays <= 3) {
      items.push({
        key: `SESSION:${bid.id}:${dateOnly(bid.tender.sessionDate)}`,
        type: 'SESSION',
        title: 'Sessão da licitação',
        date: dateOnly(bid.tender.sessionDate),
        days: sessionDays,
        bidId: bid.id,
        companyId: bid.companyId,
        companyName,
        municipality: bid.tender.municipality,
        platformName: bid.tender.platform?.name ?? null
      });
    }
    return items;
  }).sort((a, b) => a.days - b.days);

  const attention = [
    ...gmailItems.filter((item) => !item.read).slice(0, 4).map((item) => ({
      key: item.key,
      type: 'CONVOCATION' as const,
      title: 'Possível convocação',
      subtitle: `${item.companyName} · ${item.tender?.municipality || item.subject || 'E-mail recebido'}`,
      bidId: item.bidId,
      companyId: item.companyId,
      date: item.receivedAt,
      severity: 'INFO' as const
    })),
    ...deadlineItems.slice(0, 6).map((item) => ({
      key: item.key,
      type: item.type,
      title: item.title,
      subtitle: `${item.companyName} · ${item.municipality}`,
      bidId: item.bidId,
      companyId: item.companyId,
      date: item.date,
      days: item.days,
      severity: item.days < 0 ? ('OVERDUE' as const) : item.days <= 1 ? ('URGENT' as const) : ('WARNING' as const)
    }))
  ].slice(0, 8);

  return {
    scope: requestedCompanyId
      ? {
          companyId: requestedCompanyId,
          companyName: companies.find((company) => company.id === requestedCompanyId)?.tradeName ||
            companies.find((company) => company.id === requestedCompanyId)?.legalName ||
            null
        }
      : { companyId: null, companyName: null },
    companies,
    metrics: {
      activeBids,
      upcomingSessions,
      pendingConvocations: gmailItems.filter((item) => !item.read).length,
      criticalDeadlines: deadlineItems.filter((item) => item.days <= 3).length
    },
    attention,
    upcomingBids: upcomingBids.map((bid) => ({
      id: bid.id,
      companyId: bid.companyId,
      companyName: bid.company.tradeName || bid.company.legalName,
      municipality: bid.tender.municipality,
      noticeNumber: bid.tender.noticeNumber,
      sessionDate: dateOnly(bid.tender.sessionDate),
      platformName: bid.tender.platform?.name ?? null,
      situation: bid.situation,
      progress: bid.progress
    })),
    recentConvocations: gmailItems.slice(0, 6),
    statusBreakdown: statusGroups.map((item) => ({ situation: item.situation, count: item._count._all })),
    companyCards: companies.map((company) => ({
      id: company.id,
      name: company.tradeName || company.legalName,
      activeBids: activeMap.get(company.id) ?? 0,
      upcomingSessions: upcomingMap.get(company.id) ?? 0,
      pendingConvocations: gmailUnreadByCompany.get(company.id) ?? 0
    }))
  };
}
