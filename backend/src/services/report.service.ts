import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import type { AuthScope } from './access.service.js';
import { accessibleBidWhere } from './bid.service.js';
import { listCompanyOptions } from './company.service.js';
import { buildOperationalSummary } from './report-metrics.js';

const DAY_MS = 86_400_000;

const reportBidSelect = {
  tenderId: true,
  situation: true,
  _count: { select: { documents: true } },
  tender: {
    select: {
      sessionDate: true,
      noticeNumber: true,
      processNumber: true,
      municipality: true,
      state: true,
      agency: true,
      spreadsheetReady: true,
      platform: { select: { name: true } }
    }
  }
} satisfies Prisma.BidSelect;

type ReportBid = Prisma.BidGetPayload<{ select: typeof reportBidSelect }>;

export type ReportQuery = {
  companyId?: string;
  dateFrom: Date;
  dateTo: Date;
};

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

const fortalezaStart = (date: Date) => new Date(`${dateOnly(date)}T00:00:00-03:00`);

const nextFortalezaDay = (date: Date) => {
  const next = new Date(date.getTime() + DAY_MS);
  return new Date(`${dateOnly(next)}T00:00:00-03:00`);
};

export async function getOperationalReport(auth: AuthScope, query: ReportQuery) {
  const companies = await listCompanyOptions(auth);

  if (query.companyId && !companies.some((company) => company.id === query.companyId)) {
    throw new AppError('Empresa não encontrada ou sem acesso', 404);
  }

  const scopedCompanies = query.companyId
    ? companies.filter((company) => company.id === query.companyId)
    : companies;
  const companyIds = scopedCompanies.map((company) => company.id);

  if (companyIds.length === 0) {
    return {
      scope: { companyId: query.companyId ?? null, companyName: null },
      companies,
      period: { dateFrom: dateOnly(query.dateFrom), dateTo: dateOnly(query.dateTo) },
      metrics: {
        tenders: 0,
        participations: 0,
        pendingAttachments: 0,
        spreadsheetsReady: 0,
        spreadsheetsPending: 0,
        documents: 0,
        emailAlerts: 0
      },
      monthly: [],
      platforms: [],
      municipalities: [],
      rows: []
    };
  }

  const bidWhere: Prisma.BidWhereInput = {
    ...accessibleBidWhere(auth),
    companyId: { in: companyIds },
    tender: { sessionDate: { gte: query.dateFrom, lte: query.dateTo } }
  };

  const [bids, emailAlerts] = await Promise.all([
    prisma.bid.findMany({
      where: bidWhere,
      select: reportBidSelect,
      orderBy: { tender: { sessionDate: 'desc' } }
    }),
    prisma.emailMessage.count({
      where: {
        companyId: { in: companyIds },
        isPotentialConvocation: true,
        receivedAt: {
          gte: fortalezaStart(query.dateFrom),
          lt: nextFortalezaDay(query.dateTo)
        }
      }
    })
  ]);

  const summary = buildOperationalSummary(
    bids.map((bid: ReportBid) => ({
      tenderId: bid.tenderId,
      sessionDate: dateOnly(bid.tender.sessionDate),
      noticeNumber: bid.tender.noticeNumber,
      processNumber: bid.tender.processNumber,
      municipality: bid.tender.municipality,
      state: bid.tender.state,
      agency: bid.tender.agency,
      platformName: bid.tender.platform?.name ?? null,
      spreadsheetReady: bid.tender.spreadsheetReady,
      situation: bid.situation,
      documents: bid._count.documents
    }))
  );

  const selectedCompany = query.companyId
    ? companies.find((company) => company.id === query.companyId) ?? null
    : null;

  return {
    scope: {
      companyId: query.companyId ?? null,
      companyName: selectedCompany ? selectedCompany.tradeName || selectedCompany.legalName : null
    },
    companies,
    period: { dateFrom: dateOnly(query.dateFrom), dateTo: dateOnly(query.dateTo) },
    metrics: { ...summary.metrics, emailAlerts },
    monthly: summary.monthly,
    platforms: summary.platforms,
    municipalities: summary.municipalities,
    rows: summary.rows
  };
}
