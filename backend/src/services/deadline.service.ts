import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import type { AuthScope } from './access.service.js';

export type DeadlineType = 'SESSION';
export type DeadlineSeverity = 'OVERDUE' | 'TODAY' | 'URGENT' | 'UPCOMING' | 'FUTURE';

const DAY_MS = 86_400_000;

function localTodayAsUtcDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
}

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const daysFromToday = (date: Date, today: Date) => Math.round((date.getTime() - today.getTime()) / DAY_MS);

function severity(days: number): DeadlineSeverity {
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'TODAY';
  if (days <= 3) return 'URGENT';
  if (days <= 7) return 'UPCOMING';
  return 'FUTURE';
}

function tenderScope(auth: AuthScope): Prisma.TenderWhereInput {
  if (auth.role === UserRole.ADMIN) return {};
  if (auth.role === UserRole.EMPRESA) {
    return { bids: { some: { companyId: auth.companyId ?? '00000000-0000-0000-0000-000000000000' } } };
  }
  return { bids: { some: { company: { staffLinks: { some: { userId: auth.userId } } } } } };
}

export async function listDeadlineAlerts(auth: AuthScope, query: { horizon: number; pastDays: number }) {
  const today = localTodayAsUtcDate();
  const min = new Date(today.getTime() - query.pastDays * DAY_MS);
  const max = new Date(today.getTime() + query.horizon * DAY_MS);
  const tenders = await prisma.tender.findMany({
    where: {
      ...tenderScope(auth),
      sessionDate: { gte: min, lte: max }
    },
    include: { platform: { select: { id: true, name: true } } },
    orderBy: { sessionDate: 'asc' }
  });

  const alerts = tenders.flatMap((tender) => {
    const base = {
      tenderId: tender.id,
      noticeNumber: tender.noticeNumber,
      processNumber: tender.processNumber,
      municipality: tender.municipality,
      state: tender.state,
      object: tender.object,
      sessionTime: tender.sessionTime,
      platform: tender.platform
    };
    const result: Array<
      {
        key: string;
        type: DeadlineType;
        title: string;
        date: string;
        days: number;
        severity: DeadlineSeverity;
      } & typeof base
    > = [];

    const sessionDays = daysFromToday(tender.sessionDate, today);
    if (sessionDays >= -query.pastDays && sessionDays <= query.horizon) {
      result.push({
        ...base,
        key: `SESSION:${tender.id}:${dateOnly(tender.sessionDate)}`,
        type: 'SESSION',
        title: 'Sessão da licitação',
        date: dateOnly(tender.sessionDate),
        days: sessionDays,
        severity: severity(sessionDays)
      });
    }

    return result;
  });

  const reads = alerts.length
    ? await (prisma as any).notificationRead.findMany({
        where: { userId: auth.userId, alertKey: { in: alerts.map((alert) => alert.key) } },
        select: { alertKey: true }
      })
    : [];
  const readKeys = new Set(reads.map((item: { alertKey: string }) => item.alertKey));

  const items = alerts
    .map((alert) => ({ ...alert, read: readKeys.has(alert.key) }))
    .sort((a, b) => a.days - b.days || a.date.localeCompare(b.date));

  return {
    items,
    unread: items.filter((item) => !item.read).length,
    summary: {
      overdue: items.filter((item) => item.days < 0).length,
      today: items.filter((item) => item.days === 0).length,
      next7Days: items.filter((item) => item.days > 0 && item.days <= 7).length,
      next30Days: items.filter((item) => item.days > 0 && item.days <= 30).length
    }
  };
}

export async function listTenderDeadlines(auth: AuthScope, tenderId: string) {
  const today = localTodayAsUtcDate();
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, ...tenderScope(auth) },
    include: { platform: { select: { id: true, name: true } } }
  });

  if (!tender) throw new AppError('Licitação não encontrada', 404);

  const base = {
    tenderId: tender.id,
    noticeNumber: tender.noticeNumber,
    processNumber: tender.processNumber,
    municipality: tender.municipality,
    state: tender.state,
    object: tender.object,
    sessionTime: tender.sessionTime,
    platform: tender.platform
  };

  const items = [
    {
      ...base,
      key: `SESSION:${tender.id}:${dateOnly(tender.sessionDate)}`,
      type: 'SESSION' as const,
      title: 'Sessão da licitação',
      date: dateOnly(tender.sessionDate),
      days: daysFromToday(tender.sessionDate, today),
      severity: severity(daysFromToday(tender.sessionDate, today))
    }
  ];

  const reads = await (prisma as any).notificationRead.findMany({
    where: { userId: auth.userId, alertKey: { in: items.map((item) => item.key) } },
    select: { alertKey: true }
  });
  const readKeys = new Set(reads.map((item: { alertKey: string }) => item.alertKey));

  return items
    .map((item) => ({ ...item, read: readKeys.has(item.key) }))
    .sort((a, b) => a.days - b.days || a.date.localeCompare(b.date));
}

export async function markDeadlineRead(userId: string, alertKey: string) {
  return (prisma as any).notificationRead.upsert({
    where: { userId_alertKey: { userId, alertKey } },
    create: { userId, alertKey },
    update: { readAt: new Date() }
  });
}

export async function markAllDeadlineReads(auth: AuthScope) {
  const current = await listDeadlineAlerts(auth, { horizon: 30, pastDays: 30 });
  if (current.items.length === 0) return { count: 0 };
  await prisma.$transaction(
    current.items.map((alert) =>
      (prisma as any).notificationRead.upsert({
        where: { userId_alertKey: { userId: auth.userId, alertKey: alert.key } },
        create: { userId: auth.userId, alertKey: alert.key },
        update: { readAt: new Date() }
      })
    )
  );
  return { count: current.items.length };
}
