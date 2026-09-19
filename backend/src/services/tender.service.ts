import { BidSituation, GuaranteeType, Prisma, TenderListStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyPortalAccess, requireOrganizationId, type AuthScope } from './access.service.js';

// LICITAGESTAO_WORKFLOW_CITY_LAYOUT_V3_SERVICE
export type TenderWorkflowStatus = 'PENDENTE' | 'ANEXADA' | 'INICIADA' | 'SUSPENSA' | 'CONVOCADA' | 'RECURSO';

export type TenderFilterOptionsQuery = {
  workflowStatus?: TenderWorkflowStatus;
  companyId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type TenderInput = {
  modality?: string | null;
  noticeNumber?: string | null;
  processNumber?: string | null;
  executionTerm?: string | null;
  isPreQualification?: boolean; // LICITAGESTAO_PREQUAL_ALL_EMAILS_V1_SERVICE
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
  workflowStatus?: TenderWorkflowStatus;
  companyId?: string;
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
  const organizationId = requireOrganizationId(auth);
  if ((auth.role === UserRole.ADMIN || auth.role === UserRole.SUPER_ADMIN)) return { tender: { organizationId } };
  if (auth.role === UserRole.EMPRESA) {
    return {
      companyId: auth.companyId ?? '00000000-0000-0000-0000-000000000000',
      tender: { organizationId }
    };
  }
  return {
    company: { organizationId, staffLinks: { some: { userId: auth.userId } } },
    tender: { organizationId }
  };
};

const ensurePlatform = async (platformId: string | null | undefined, auth: AuthScope) => {
  if (!platformId) return;
  const platform = await prisma.platform.findFirst({
    where: { id: platformId, organizationId: requireOrganizationId(auth) },
    select: { active: true }
  });
  if (!platform?.active) throw new AppError('Plataforma não encontrada ou inativa', 422);
};

const clean = (data: TenderInput, referenceValue?: number | Prisma.Decimal | null) => {
  const { requiresGuaranteeOnePercent, ...rest } = data;
  const estimatedValue = data.estimatedValue ?? referenceValue;
  return {
    ...rest,
    ...(data.modality !== undefined ? { modality: data.modality || null } : {}),
    ...(data.noticeNumber !== undefined ? { noticeNumber: data.noticeNumber || null } : {}),
    ...(data.processNumber !== undefined ? { processNumber: data.processNumber || null } : {}),
    ...(data.executionTerm !== undefined ? { executionTerm: data.executionTerm || null } : {}),
    ...(data.platformLink !== undefined ? { platformLink: data.platformLink || null } : {}),
    ...(data.seobraLink !== undefined ? { seobraLink: data.seobraLink || null } : {}),
    ...(requiresGuaranteeOnePercent !== undefined
      ? {
          guaranteeType: requiresGuaranteeOnePercent ? GuaranteeType.PROPOSTA_INICIAL : GuaranteeType.NAO_EXIGIDA,
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
    spreadsheetResponsibleUser: { select: { id: true, name: true, email: true } },
    bids: {
      where: accessibleParticipationWhere(auth),
      include: { company: true, _count: { select: { documents: true } } },
      orderBy: { company: { legalName: 'asc' as const } }
    },
    _count: { select: { bids: true } }
  }) satisfies Prisma.TenderInclude;

export const createTender = async (
  input: TenderInput & Required<Pick<TenderInput, 'municipality' | 'sessionDate' | 'object' | 'proposalValidityDays' | 'estimatedValue' | 'platformId'>>,
  auth: AuthScope
) => {
  await ensurePlatform(input.platformId, auth);
  return prisma.tender.create({
    data: {
      ...clean(input, input.estimatedValue),
      organizationId: requireOrganizationId(auth),
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
  const current = await prisma.tender.findFirst({ where: { id, organizationId: requireOrganizationId(auth) } });
  if (!current) throw new AppError('Licitação geral não encontrada', 404);
  await ensurePlatform(input.platformId === undefined ? current.platformId : input.platformId, auth);
  const sessionDate = input.sessionDate ?? current.sessionDate;
  const validity = input.proposalValidityDays === undefined ? current.proposalValidityDays : input.proposalValidityDays;
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
  const tender = await prisma.tender.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    include: {
      ...includeTender(auth),
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } }
    }
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  return (await addAttachmentProgress([tender]))[0]!;
};

const normalizeWorkflowText = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

type WorkflowEventType = 'SUSPENDED' | 'RESUMED' | 'CONVOCATED' | 'RESOURCE';

const classifyWorkflowMessage = (message: {
  subject: string | null;
  snippet: string | null;
  textContent: string | null;
  convocationReason: string | null;
}): { type: WorkflowEventType; reason: string } | null => {
  const combined = normalizeWorkflowText(
    [message.subject, message.snippet, message.textContent, message.convocationReason]
      .filter(Boolean)
      .join('\n')
  );

  const resumedTerms = [
    'retorno da suspensao',
    'retorno de suspensao',
    'volta da suspensao',
    'fim da suspensao',
    'levantamento da suspensao',
    'retomada do certame',
    'retomada da sessao',
    'sessao retomada',
    'reabertura da sessao',
    'sessao reaberta',
    'reinicio da sessao',
    'reinicio do certame',
    'prosseguimento do certame',
    'prosseguimento da sessao',
    'continuidade do certame',
    'continuidade da sessao',
    'nova data da sessao'
  ];

  const resumed = resumedTerms.find((term) => combined.includes(term));
  if (resumed) return { type: 'RESUMED', reason: resumed };

  const suspendedTerms = [
    'aviso de suspensao',
    'suspensao do certame',
    'suspensao da sessao',
    'certame suspenso',
    'sessao suspensa',
    'licitacao suspensa',
    'processo suspenso',
    'fica suspenso',
    'fica suspensa'
  ];

  const suspended = suspendedTerms.find((term) => combined.includes(term));
  if (suspended) return { type: 'SUSPENDED', reason: suspended };

  const resourceTerms = [
    'manifestar intencao de recurso',
    'manifestacao de intencao de recurso',
    'intencao de recorrer',
    'intencao de interpor recurso',
    'prazo para recurso',
    'prazo recursal',
    'recurso administrativo',
    'apresentacao de recurso',
    'interposicao de recurso',
    'impugnacao ao edital',
    'pedido de impugnacao',
    'apresentar contrarrazoes',
    'prazo para contrarrazoes'
  ];

  const resource = resourceTerms.find((term) => combined.includes(term));
  if (resource) return { type: 'RESOURCE', reason: resource };

  const convocationTerms = [
    'termo de convocacao identificado',
    'convocacao',
    'convocado',
    'convocada',
    'convocamos',
    'fica convocado',
    'fica convocada',
    'empresa convocada',
    'empresa convocado',
    'proposta readequada',
    'readequacao da proposta',
    'enviar proposta readequada',
    'apresentar proposta readequada',
    'enviar a readequada',
    'enviar readequada',
    'apresentar a readequada',
    'proposta ajustada'
  ];

  const convocated = convocationTerms.find((term) => combined.includes(term));
  if (convocated) return { type: 'CONVOCATED', reason: convocated };

  return null;
};

const isStrongWorkflowEmailMatch = (message: {
  convocationMatchMethod: string | null;
  convocationMatchConfidence: number | null;
}) => {
  // LICITAGESTAO_STRONG_WORKFLOW_EMAIL_MATCH_V1
  // Um e-mail pode continuar aparecendo vinculado por contexto (cidade + plataforma),
  // mas só pode mudar o andamento da licitação quando a identificação for forte.
  if (message.convocationMatchMethod === 'MANUAL') return true;
  if (message.convocationMatchMethod === 'PROCESS_NUMBER') {
    return (message.convocationMatchConfidence ?? 0) >= 100;
  }
  if (message.convocationMatchMethod === 'NOTICE_NUMBER') {
    // 95+ normalmente significa que, além do número da concorrência/edital,
    // houve contexto suficiente para diferenciar a licitação (ex.: município).
    return (message.convocationMatchConfidence ?? 0) >= 95;
  }
  return false;
};

const todayInFortaleza = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

const addWorkflowMetadata = async <
  T extends { id: string; sessionDate: Date; listStatus: TenderListStatus }
>(
  items: T[],
  companyId?: string
) => {
  if (items.length === 0) return [];

  const messages = await prisma.emailMessage.findMany({
    where: {
      tenderId: { in: items.map((item) => item.id) },
      ...(companyId ? { companyId } : {})
    },
    select: {
      tenderId: true,
      companyId: true,
      receivedAt: true,
      subject: true,
      snippet: true,
      textContent: true,
      convocationReason: true,
      convocationMatchMethod: true,
      convocationMatchConfidence: true,
      company: { select: { id: true, legalName: true, tradeName: true } }
    },
    orderBy: { receivedAt: 'asc' }
  });

  const messagesByTender = new Map<string, typeof messages>();
  for (const message of messages) {
    if (!message.tenderId) continue;
    const current = messagesByTender.get(message.tenderId) ?? [];
    current.push(message);
    messagesByTender.set(message.tenderId, current);
  }

  const today = todayInFortaleza();

  return items.map((item) => {
    const tenderMessages = messagesByTender.get(item.id) ?? [];
    let latestEventType: WorkflowEventType | null = null;
    let latestEventReason: string | null = null;
    let latestEventAt: Date | null = null;
    const convokedCompanies = new Map<string, { id: string; name: string }>();

    for (const message of tenderMessages) {
      // E-mails ligados somente por contexto não podem marcar uma licitação
      // como SUSPENSA, CONVOCADA ou retomada. Eles continuam visíveis na área
      // de e-mails, mas não alteram o andamento.
      if (!isStrongWorkflowEmailMatch(message)) continue;

      const event = classifyWorkflowMessage(message);
      if (!event) continue;

      latestEventType = event.type;
      latestEventReason = event.reason;
      latestEventAt = message.receivedAt;

      if (event.type === 'CONVOCATED') {
        convokedCompanies.set(message.companyId, {
          id: message.company.id,
          name: message.company.tradeName || message.company.legalName
        });
      }
    }

    let workflowStatus: TenderWorkflowStatus;

    if (latestEventType === 'SUSPENDED') {
      workflowStatus = 'SUSPENSA';
    } else if (latestEventType === 'CONVOCATED') {
      workflowStatus = 'CONVOCADA';
    } else if (latestEventType === 'RESOURCE') {
      workflowStatus = 'RECURSO';
    } else if (latestEventType === 'RESUMED') {
      workflowStatus = 'INICIADA';
    } else if (item.sessionDate.toISOString().slice(0, 10) <= today) {
      workflowStatus = 'INICIADA';
    } else {
      workflowStatus = item.listStatus === TenderListStatus.ANEXADA ? 'ANEXADA' : 'PENDENTE';
    }

    return {
      ...item,
      workflowStatus,
      workflowEventAt: latestEventAt,
      workflowEventReason: latestEventReason,
      convokedCompanies: Array.from(convokedCompanies.values())
    };
  });
};

const tenderDateWhere = (dateFrom?: Date, dateTo?: Date): Prisma.TenderWhereInput =>
  dateFrom || dateTo
    ? { sessionDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
    : {};

export const listTenders = async (query: TenderQuery, auth: AuthScope) => {
  if (query.companyId) await assertCompanyPortalAccess(query.companyId, auth);
  const where: Prisma.TenderWhereInput = {
    organizationId: requireOrganizationId(auth),
    ...(query.companyId ? { bids: { some: { companyId: query.companyId } } } : {}),
    ...(query.municipality ? { municipality: { equals: query.municipality, mode: 'insensitive' } } : {}),
    ...(query.platformId ? { platformId: query.platformId } : {}),
    ...(query.listStatus && !query.workflowStatus ? { listStatus: query.listStatus } : {}),
    ...tenderDateWhere(query.dateFrom, query.dateTo),
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

  const rawItems = await prisma.tender.findMany({
    where,
    orderBy,
    include: includeTender(auth)
  });

  const withAttachments = await addAttachmentProgress(rawItems);
  const withWorkflow = await addWorkflowMetadata(withAttachments, query.companyId);
  const filtered = query.workflowStatus
    ? withWorkflow.filter((item) => item.workflowStatus === query.workflowStatus)
    : withWorkflow;

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  const items = filtered.slice(start, start + query.pageSize);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pages: Math.ceil(total / query.pageSize)
  };
};

export const listTenderFilterOptions = async (query: TenderFilterOptionsQuery, auth: AuthScope) => {
  if (query.companyId) await assertCompanyPortalAccess(query.companyId, auth);
  const baseItems = await prisma.tender.findMany({
    where: {
      organizationId: requireOrganizationId(auth),
      ...(query.companyId ? { bids: { some: { companyId: query.companyId } } } : {}),
      ...tenderDateWhere(query.dateFrom, query.dateTo)
    },
    select: {
      id: true,
      municipality: true,
      sessionDate: true,
      listStatus: true
    },
    orderBy: { municipality: 'asc' }
  });

  const withWorkflow = await addWorkflowMetadata(baseItems, query.companyId);
  const filtered = query.workflowStatus
    ? withWorkflow.filter((item) => item.workflowStatus === query.workflowStatus)
    : withWorkflow;

  const municipalities = Array.from(
    new Set(filtered.map((item) => item.municipality.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return { municipalities };
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
    return { ...item, attachedCompanies, allCompaniesAttached: item._count.bids > 0 && attachedCompanies === item._count.bids };
  });
};

export const deleteTender = async (id: string, auth: AuthScope) => {
  const tender = await prisma.tender.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    include: includeTender(auth)
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  await prisma.tender.delete({ where: { id } });
  return tender;
};

export const setSpreadsheetResponsibility = async (id: string, responsible: boolean, auth: AuthScope) => {
  if (auth.role === UserRole.EMPRESA) throw new AppError('Seu perfil não pode assumir a planilha do controle geral', 403);
  const tender = await prisma.tender.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    select: { id: true, spreadsheetResponsibleUserId: true, spreadsheetResponsibleUser: { select: { id: true, name: true } } }
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  if (responsible) {
    if (tender.spreadsheetResponsibleUserId && tender.spreadsheetResponsibleUserId !== auth.userId) {
      throw new AppError(`Esta planilha já está sob responsabilidade de ${tender.spreadsheetResponsibleUser?.name ?? 'outro usuário'}`, 409);
    }
    return prisma.tender.update({ where: { id }, data: { spreadsheetResponsibleUserId: auth.userId, updatedById: auth.userId }, include: includeTender(auth) });
  }
  if (tender.spreadsheetResponsibleUserId && tender.spreadsheetResponsibleUserId !== auth.userId && (auth.role !== UserRole.ADMIN && auth.role !== UserRole.SUPER_ADMIN)) {
    throw new AppError('Somente o responsável atual ou um administrador pode liberar esta planilha', 403);
  }
  return prisma.tender.update({ where: { id }, data: { spreadsheetResponsibleUserId: null, updatedById: auth.userId }, include: includeTender(auth) });
};

export const updateSpreadsheetNotes = async (id: string, notes: string | null, auth: AuthScope) => {
  const tender = await prisma.tender.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    select: { id: true, spreadsheetResponsibleUserId: true }
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  if ((auth.role !== UserRole.ADMIN && auth.role !== UserRole.SUPER_ADMIN) && tender.spreadsheetResponsibleUserId !== auth.userId) {
    throw new AppError('Somente o responsável pela planilha pode alterar as observações', 403);
  }
  return prisma.tender.update({
    where: { id },
    data: { spreadsheetNotes: notes?.trim() || null, spreadsheetNotesUpdatedAt: new Date(), updatedById: auth.userId },
    include: includeTender(auth)
  });
};

export const setSpreadsheetReady = async (id: string, ready: boolean, auth: AuthScope) => {
  const exists = await prisma.tender.findFirst({ where: { id, organizationId: requireOrganizationId(auth) }, select: { id: true } });
  if (!exists) throw new AppError('Licitação geral não encontrada', 404);
  return prisma.tender.update({ where: { id }, data: { spreadsheetReady: ready, updatedById: auth.userId }, include: includeTender(auth) });
};

export const setTenderListStatus = async (id: string, status: TenderListStatus, auth: AuthScope) => {
  const tender = await prisma.tender.findFirst({
    where: { id, organizationId: requireOrganizationId(auth) },
    include: { bids: { select: { situation: true } } }
  });
  if (!tender) throw new AppError('Licitação geral não encontrada', 404);
  if (status === TenderListStatus.ANEXADA && (tender.bids.length === 0 || tender.bids.some((bid) => bid.situation !== BidSituation.ANEXADA))) {
    throw new AppError('Todas as empresas associadas precisam estar com situação ANEXADA', 422);
  }
  return prisma.tender.update({ where: { id }, data: { listStatus: status, updatedById: auth.userId }, include: includeTender(auth) });
};
