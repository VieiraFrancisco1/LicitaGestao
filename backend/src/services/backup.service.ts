import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';

const BACKUP_FORMAT = 'LICITAGESTAO_BACKUP';
const records = z.array(z.record(z.string(), z.unknown()));
const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.union([z.literal(1), z.literal(2)]),
  generatedAt: z.string().datetime(),
  organization: z.object({ name: z.string() }).optional(),
  data: z.object({
    users: records,
    companies: records,
    companyUsers: records,
    platforms: records,
    tenders: records,
    bids: records,
    documents: records,
    discounts: records,
    proposalLetterTemplates: records,
    emailMessages: records
  })
});

export type SystemBackup = z.infer<typeof backupSchema>;
const requiredDate = (value: unknown) => new Date(String(value));
const optionalDate = (value: unknown) => (value ? new Date(String(value)) : null);
const nullableString = (value: unknown) => (value === null || value === undefined ? null : String(value));

export function parseSystemBackup(input: Buffer | string): SystemBackup {
  try {
    const raw = JSON.parse(Buffer.isBuffer(input) ? input.toString('utf8') : input);
    return backupSchema.parse(raw);
  } catch {
    throw new AppError('O arquivo não é um backup válido do LicitaGestão', 422, 'INVALID_BACKUP');
  }
}

export async function getBackupSummary(auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const companyWhere = { organizationId };
  const tenderWhere = { organizationId };
  const [companies, users, tenders, bids, documents, emailMessages, lastBackup] = await prisma.$transaction([
    prisma.company.count({ where: companyWhere }),
    prisma.user.count({ where: { organizationId } }),
    prisma.tender.count({ where: tenderWhere }),
    prisma.bid.count({ where: { tender: tenderWhere } }),
    prisma.document.count({ where: { bid: { tender: tenderWhere } } }),
    prisma.emailMessage.count({ where: { company: companyWhere } }),
    prisma.auditLog.findFirst({
      where: { organizationId, entityType: 'SYSTEM_BACKUP', action: 'CREATE' },
      select: { createdAt: true, actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  return { companies, users, tenders, bids, documents, emailMessages, lastBackup };
}

export async function createSystemBackup(auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } });
  const companies = await prisma.company.findMany({ where: { organizationId }, orderBy: { id: 'asc' } });
  const companyIds = companies.map((item) => item.id);
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true, name: true, email: true, role: true, active: true, companyId: true, createdAt: true, updatedAt: true },
    orderBy: { id: 'asc' }
  });
  const userIds = users.map((item) => item.id);
  const tenders = await prisma.tender.findMany({ where: { organizationId }, orderBy: { id: 'asc' } });
  const tenderIds = tenders.map((item) => item.id);
  const [companyUsers, platforms, bids, proposalLetterTemplates, emailMessages] = await prisma.$transaction([
    prisma.companyUser.findMany({ where: { companyId: { in: companyIds }, userId: { in: userIds } }, orderBy: [{ companyId: 'asc' }, { userId: 'asc' }] }),
    prisma.platform.findMany({ where: { organizationId }, orderBy: { id: 'asc' } }),
    prisma.bid.findMany({ where: { tenderId: { in: tenderIds }, companyId: { in: companyIds } }, orderBy: { id: 'asc' } }),
    prisma.proposalLetterTemplate.findMany({ where: { organizationId }, orderBy: { id: 'asc' } }),
    prisma.emailMessage.findMany({ where: { companyId: { in: companyIds } }, orderBy: { id: 'asc' } })
  ]);
  const bidIds = bids.map((item) => item.id);
  const [documents, discounts] = await prisma.$transaction([
    prisma.document.findMany({ where: { bidId: { in: bidIds } }, orderBy: { id: 'asc' } }),
    prisma.discountCalculation.findMany({ where: { companyId: { in: companyIds }, tenderId: { in: tenderIds } }, orderBy: { id: 'asc' } })
  ]);

  const generatedAt = new Date().toISOString();
  return {
    format: BACKUP_FORMAT,
    version: 2 as const,
    generatedAt,
    organization: { name: organization.name },
    security: {
      excluded: [
        'organization.passwordHash', 'user.passwordHash', 'refreshTokens', 'gmailRefreshToken',
        'outlookRefreshToken', 'megaPassword', 'notificationReads', 'passwordResetTokens'
      ],
      note: 'Senhas, sessões e credenciais externas não fazem parte deste arquivo.'
    },
    data: { users, companies, companyUsers, platforms, tenders, bids, documents, discounts, proposalLetterTemplates, emailMessages },
    counts: {
      users: users.length, companies: companies.length, companyUsers: companyUsers.length, platforms: platforms.length,
      tenders: tenders.length, bids: bids.length, documents: documents.length, discounts: discounts.length,
      proposalLetterTemplates: proposalLetterTemplates.length, emailMessages: emailMessages.length
    }
  };
}

export async function restoreSystemBackup(backup: SystemBackup, auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const actorId = auth.userId;
  const data = backup.data;
  return prisma.$transaction(async (tx) => {
    const currentUsers = await tx.user.findMany({ where: { organizationId }, select: { id: true, email: true } });
    const currentById = new Map(currentUsers.map((user) => [user.id, user.id]));
    const currentByEmail = new Map(currentUsers.map((user) => [user.email.toLowerCase(), user.id]));
    const backupUsers = new Map(data.users.map((user) => [String(user.id), user]));
    const knownUserId = (backupId: unknown) => {
      if (!backupId) return null;
      const id = String(backupId);
      if (currentById.has(id)) return id;
      const email = backupUsers.get(id)?.email;
      return email ? (currentByEmail.get(String(email).toLowerCase()) ?? null) : null;
    };
    const actorUserId = (backupId: unknown) => knownUserId(backupId) ?? actorId;

    for (const item of data.companies) {
      const id = String(item.id);
      const values = {
        organizationId,
        legalName: String(item.legalName), tradeName: nullableString(item.tradeName), cnpj: String(item.cnpj),
        email: nullableString(item.email), phone: nullableString(item.phone), contactName: nullableString(item.contactName),
        observations: nullableString(item.observations), megaFolderPath: nullableString(item.megaFolderPath),
        active: Boolean(item.active), createdAt: requiredDate(item.createdAt), updatedAt: requiredDate(item.updatedAt)
      };
      const foreign = await tx.company.findFirst({ where: { id, organizationId: { not: organizationId } }, select: { id: true } });
      if (foreign) throw new AppError('O backup contém identificadores pertencentes a outra organização', 409);
      await tx.company.upsert({ where: { id }, create: { id, ...values }, update: values });
    }

    for (const item of data.platforms) {
      const id = String(item.id);
      const values = {
        organizationId, name: String(item.name), site: nullableString(item.site), observations: nullableString(item.observations),
        active: Boolean(item.active), createdAt: requiredDate(item.createdAt), updatedAt: requiredDate(item.updatedAt)
      };
      const foreign = await tx.platform.findFirst({ where: { id, organizationId: { not: organizationId } }, select: { id: true } });
      if (foreign) throw new AppError('O backup contém identificadores pertencentes a outra organização', 409);
      await tx.platform.upsert({ where: { id }, create: { id, ...values }, update: values });
    }

    for (const item of data.companyUsers) {
      const userId = knownUserId(item.userId);
      if (!userId) continue;
      const companyId = String(item.companyId);
      const company = await tx.company.findFirst({ where: { id: companyId, organizationId }, select: { id: true } });
      if (!company) continue;
      await tx.companyUser.upsert({
        where: { companyId_userId: { companyId, userId } },
        create: { companyId, userId, assignedAt: requiredDate(item.assignedAt) },
        update: { assignedAt: requiredDate(item.assignedAt) }
      });
    }

    for (const item of data.tenders) {
      const id = String(item.id);
      const values = {
        organizationId,
        modality: nullableString(item.modality), noticeNumber: nullableString(item.noticeNumber), processNumber: nullableString(item.processNumber),
        municipality: String(item.municipality), state: nullableString(item.state), agency: nullableString(item.agency),
        sessionDate: requiredDate(item.sessionDate), sessionTime: nullableString(item.sessionTime), object: String(item.object),
        executionTerm: nullableString(item.executionTerm), proposalValidityDays: item.proposalValidityDays == null ? null : Number(item.proposalValidityDays),
        proposalExpirationDate: optionalDate(item.proposalExpirationDate), estimatedValue: nullableString(item.estimatedValue),
        guaranteeType: item.guaranteeType as any, guaranteePercentage: nullableString(item.guaranteePercentage), guaranteeValue: nullableString(item.guaranteeValue),
        platformId: nullableString(item.platformId), platformLink: nullableString(item.platformLink), seobraLink: nullableString(item.seobraLink),
        spreadsheetReady: Boolean(item.spreadsheetReady), spreadsheetResponsibleUserId: knownUserId(item.spreadsheetResponsibleUserId),
        spreadsheetNotes: nullableString(item.spreadsheetNotes), spreadsheetNotesUpdatedAt: optionalDate(item.spreadsheetNotesUpdatedAt),
        listStatus: item.listStatus as any, createdById: actorUserId(item.createdById), updatedById: actorUserId(item.updatedById),
        createdAt: requiredDate(item.createdAt), updatedAt: requiredDate(item.updatedAt)
      };
      const foreign = await tx.tender.findFirst({ where: { id, organizationId: { not: organizationId } }, select: { id: true } });
      if (foreign) throw new AppError('O backup contém identificadores pertencentes a outra organização', 409);
      await tx.tender.upsert({ where: { id }, create: { id, ...values } as any, update: values as any });
    }

    for (const item of data.bids) {
      const id = String(item.id);
      const tenderId = String(item.tenderId); const companyId = String(item.companyId);
      const [tender, company] = await Promise.all([
        tx.tender.findFirst({ where: { id: tenderId, organizationId }, select: { id: true } }),
        tx.company.findFirst({ where: { id: companyId, organizationId }, select: { id: true } })
      ]);
      if (!tender || !company) continue;
      const values = { tenderId, companyId, proposalValue: nullableString(item.proposalValue), progress: item.progress as any,
        situation: item.situation as any, observations: nullableString(item.observations), createdById: actorUserId(item.createdById),
        updatedById: actorUserId(item.updatedById), createdAt: requiredDate(item.createdAt), updatedAt: requiredDate(item.updatedAt) };
      await tx.bid.upsert({ where: { id }, create: { id, ...values } as any, update: values as any });
    }

    for (const item of data.documents) {
      const id = String(item.id); const bidId = String(item.bidId);
      const bid = await tx.bid.findFirst({ where: { id: bidId, tender: { organizationId } }, select: { id: true } });
      if (!bid) continue;
      const values = { bidId, originalName: String(item.originalName), fileName: String(item.fileName), mimeType: String(item.mimeType),
        size: Number(item.size), category: item.category as any, path: String(item.path), storageProvider: String(item.storageProvider),
        remoteNodeId: nullableString(item.remoteNodeId), remotePath: nullableString(item.remotePath), megaIntegrationId: null,
        uploadedById: actorUserId(item.uploadedById), createdAt: requiredDate(item.createdAt) };
      await tx.document.upsert({ where: { id }, create: { id, ...values } as any, update: values as any });
    }

    for (const item of data.discounts) {
      const id = String(item.id); const companyId = String(item.companyId); const tenderId = String(item.tenderId);
      const values = { companyId, tenderId, discountedValue: nullableString(item.discountedValue), createdById: actorUserId(item.createdById),
        updatedById: actorUserId(item.updatedById), createdAt: requiredDate(item.createdAt), updatedAt: requiredDate(item.updatedAt) };
      await tx.discountCalculation.upsert({ where: { id }, create: { id, ...values } as any, update: values as any });
    }

    for (const item of data.proposalLetterTemplates) {
      const id = String(item.id);
      const values = { organizationId, scopeKey: String(item.scopeKey), municipality: String(item.municipality), state: nullableString(item.state),
        bodyTemplate: String(item.bodyTemplate), sourceType: String(item.sourceType), sourceFileName: nullableString(item.sourceFileName),
        sourcePdfImportedAt: optionalDate(item.sourcePdfImportedAt), createdAt: requiredDate(item.createdAt), updatedAt: requiredDate(item.updatedAt) };
      await tx.proposalLetterTemplate.upsert({ where: { id }, create: { id, ...values } as any, update: values as any });
    }

    for (const item of data.emailMessages) {
      const id = String(item.id); const companyId = String(item.companyId);
      const company = await tx.company.findFirst({ where: { id: companyId, organizationId }, select: { id: true } });
      if (!company) continue;
      const values = { companyId, gmailMessageId: String(item.gmailMessageId), threadId: String(item.threadId), provider: item.provider as any,
        sender: String(item.sender), subject: nullableString(item.subject), receivedAt: requiredDate(item.receivedAt), snippet: nullableString(item.snippet),
        textContent: nullableString(item.textContent), processingStatus: item.processingStatus as any, isPotentialConvocation: Boolean(item.isPotentialConvocation),
        convocationReason: nullableString(item.convocationReason), tenderId: nullableString(item.tenderId), bidId: nullableString(item.bidId),
        convocationMatchMethod: nullableString(item.convocationMatchMethod), convocationMatchConfidence: item.convocationMatchConfidence == null ? null : Number(item.convocationMatchConfidence),
        convocationMatchedAt: optionalDate(item.convocationMatchedAt), createdAt: requiredDate(item.createdAt), updatedAt: requiredDate(item.updatedAt) };
      await tx.emailMessage.upsert({ where: { id }, create: { id, ...values } as any, update: values as any });
    }

    return { companies: data.companies.length, companyUsers: data.companyUsers.length, platforms: data.platforms.length,
      tenders: data.tenders.length, bids: data.bids.length, documents: data.documents.length, discounts: data.discounts.length,
      proposalLetterTemplates: data.proposalLetterTemplates.length, emailMessages: data.emailMessages.length };
  }, { maxWait: 10_000, timeout: 120_000 });
}
