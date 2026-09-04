import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';

const BACKUP_FORMAT = 'LICITAGESTAO_BACKUP';
const BACKUP_VERSION = 1;

const records = z.array(z.record(z.string(), z.unknown()));
const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  generatedAt: z.string().datetime(),
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

export async function getBackupSummary() {
  const [companies, users, tenders, bids, documents, emailMessages, lastBackup] = await prisma.$transaction([
    prisma.company.count(),
    prisma.user.count(),
    prisma.tender.count(),
    prisma.bid.count(),
    prisma.document.count(),
    prisma.emailMessage.count(),
    prisma.auditLog.findFirst({
      where: { entityType: 'SYSTEM_BACKUP', action: 'CREATE' },
      select: { createdAt: true, actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  return { companies, users, tenders, bids, documents, emailMessages, lastBackup };
}

export async function createSystemBackup() {
  const [
    users,
    companies,
    companyUsers,
    platforms,
    tenders,
    bids,
    documents,
    discounts,
    proposalLetterTemplates,
    emailMessages
  ] = await prisma.$transaction([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        companyId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { id: 'asc' }
    }),
    prisma.company.findMany({ orderBy: { id: 'asc' } }),
    prisma.companyUser.findMany({ orderBy: [{ companyId: 'asc' }, { userId: 'asc' }] }),
    prisma.platform.findMany({ orderBy: { id: 'asc' } }),
    prisma.tender.findMany({ orderBy: { id: 'asc' } }),
    prisma.bid.findMany({ orderBy: { id: 'asc' } }),
    prisma.document.findMany({ orderBy: { id: 'asc' } }),
    prisma.discountCalculation.findMany({ orderBy: { id: 'asc' } }),
    prisma.proposalLetterTemplate.findMany({ orderBy: { id: 'asc' } }),
    prisma.emailMessage.findMany({ orderBy: { id: 'asc' } })
  ]);

  const generatedAt = new Date().toISOString();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    generatedAt,
    security: {
      excluded: [
        'passwordHash',
        'refreshTokens',
        'gmailRefreshToken',
        'outlookRefreshToken',
        'notificationReads'
      ],
      note: 'Senhas, sessões e credenciais externas não fazem parte deste arquivo.'
    },
    data: {
      users,
      companies,
      companyUsers,
      platforms,
      tenders,
      bids,
      documents,
      discounts,
      proposalLetterTemplates,
      emailMessages
    },
    counts: {
      users: users.length,
      companies: companies.length,
      companyUsers: companyUsers.length,
      platforms: platforms.length,
      tenders: tenders.length,
      bids: bids.length,
      documents: documents.length,
      discounts: discounts.length,
      proposalLetterTemplates: proposalLetterTemplates.length,
      emailMessages: emailMessages.length
    }
  };
}

export async function restoreSystemBackup(backup: SystemBackup, actorId: string) {
  const data = backup.data;
  return prisma.$transaction(
    async (tx) => {
      const currentUsers = await tx.user.findMany({ select: { id: true, email: true } });
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
        const values = {
          legalName: String(item.legalName),
          tradeName: nullableString(item.tradeName),
          cnpj: String(item.cnpj),
          email: nullableString(item.email),
          phone: nullableString(item.phone),
          contactName: nullableString(item.contactName),
          observations: nullableString(item.observations),
          megaFolderPath: nullableString(item.megaFolderPath),
          active: Boolean(item.active),
          createdAt: requiredDate(item.createdAt),
          updatedAt: requiredDate(item.updatedAt)
        };
        await tx.company.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        });
      }

      for (const item of data.platforms) {
        const values = {
          name: String(item.name),
          site: nullableString(item.site),
          observations: nullableString(item.observations),
          active: Boolean(item.active),
          createdAt: requiredDate(item.createdAt),
          updatedAt: requiredDate(item.updatedAt)
        };
        await tx.platform.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        });
      }

      for (const item of data.companyUsers) {
        const userId = knownUserId(item.userId);
        if (!userId) continue;
        const companyId = String(item.companyId);
        await tx.companyUser.upsert({
          where: { companyId_userId: { companyId, userId } },
          create: { companyId, userId, assignedAt: requiredDate(item.assignedAt) },
          update: { assignedAt: requiredDate(item.assignedAt) }
        });
      }

      for (const item of data.tenders) {
        const values = {
          modality: nullableString(item.modality),
          noticeNumber: nullableString(item.noticeNumber),
          processNumber: nullableString(item.processNumber),
          municipality: String(item.municipality),
          state: nullableString(item.state),
          agency: nullableString(item.agency),
          sessionDate: requiredDate(item.sessionDate),
          sessionTime: nullableString(item.sessionTime),
          object: String(item.object),
          executionTerm: nullableString(item.executionTerm),
          proposalValidityDays: item.proposalValidityDays === null ? null : Number(item.proposalValidityDays),
          proposalExpirationDate: optionalDate(item.proposalExpirationDate),
          estimatedValue: nullableString(item.estimatedValue),
          guaranteeType: item.guaranteeType,
          guaranteePercentage: nullableString(item.guaranteePercentage),
          guaranteeValue: nullableString(item.guaranteeValue),
          platformId: nullableString(item.platformId),
          platformLink: nullableString(item.platformLink),
          seobraLink: nullableString(item.seobraLink),
          spreadsheetReady: Boolean(item.spreadsheetReady),
          spreadsheetResponsibleUserId: knownUserId(item.spreadsheetResponsibleUserId),
          spreadsheetNotes: nullableString(item.spreadsheetNotes),
          spreadsheetNotesUpdatedAt: optionalDate(item.spreadsheetNotesUpdatedAt),
          listStatus: item.listStatus,
          createdById: actorUserId(item.createdById),
          updatedById: actorUserId(item.updatedById),
          createdAt: requiredDate(item.createdAt),
          updatedAt: requiredDate(item.updatedAt)
        };
        await tx.tender.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        } as any);
      }

      for (const item of data.bids) {
        const values = {
          tenderId: String(item.tenderId),
          companyId: String(item.companyId),
          proposalValue: nullableString(item.proposalValue),
          progress: item.progress,
          situation: item.situation,
          observations: nullableString(item.observations),
          createdById: actorUserId(item.createdById),
          updatedById: actorUserId(item.updatedById),
          createdAt: requiredDate(item.createdAt),
          updatedAt: requiredDate(item.updatedAt)
        };
        await tx.bid.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        } as any);
      }

      for (const item of data.documents) {
        const values = {
          bidId: String(item.bidId),
          originalName: String(item.originalName),
          fileName: String(item.fileName),
          mimeType: String(item.mimeType),
          size: Number(item.size),
          category: item.category,
          path: String(item.path),
          storageProvider: String(item.storageProvider),
          remoteNodeId: nullableString(item.remoteNodeId),
          remotePath: nullableString(item.remotePath),
          uploadedById: actorUserId(item.uploadedById),
          createdAt: requiredDate(item.createdAt)
        };
        await tx.document.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        } as any);
      }

      for (const item of data.discounts) {
        const values = {
          companyId: String(item.companyId),
          tenderId: String(item.tenderId),
          discountedValue: nullableString(item.discountedValue),
          createdById: actorUserId(item.createdById),
          updatedById: actorUserId(item.updatedById),
          createdAt: requiredDate(item.createdAt),
          updatedAt: requiredDate(item.updatedAt)
        };
        await tx.discountCalculation.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        } as any);
      }

      for (const item of data.proposalLetterTemplates) {
        const values = {
          scopeKey: String(item.scopeKey),
          municipality: String(item.municipality),
          state: nullableString(item.state),
          bodyTemplate: String(item.bodyTemplate),
          sourceType: String(item.sourceType),
          sourceFileName: nullableString(item.sourceFileName),
          sourcePdfImportedAt: optionalDate(item.sourcePdfImportedAt),
          createdAt: requiredDate(item.createdAt),
          updatedAt: requiredDate(item.updatedAt)
        };
        await tx.proposalLetterTemplate.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        });
      }

      for (const item of data.emailMessages) {
        const values = {
          companyId: String(item.companyId),
          gmailMessageId: String(item.gmailMessageId),
          threadId: String(item.threadId),
          provider: item.provider,
          sender: String(item.sender),
          subject: nullableString(item.subject),
          receivedAt: requiredDate(item.receivedAt),
          snippet: nullableString(item.snippet),
          textContent: nullableString(item.textContent),
          processingStatus: item.processingStatus,
          isPotentialConvocation: Boolean(item.isPotentialConvocation),
          convocationReason: nullableString(item.convocationReason),
          tenderId: nullableString(item.tenderId),
          bidId: nullableString(item.bidId),
          convocationMatchMethod: nullableString(item.convocationMatchMethod),
          convocationMatchConfidence:
            item.convocationMatchConfidence === null ? null : Number(item.convocationMatchConfidence),
          convocationMatchedAt: optionalDate(item.convocationMatchedAt),
          createdAt: requiredDate(item.createdAt),
          updatedAt: requiredDate(item.updatedAt)
        };
        await tx.emailMessage.upsert({
          where: { id: String(item.id) },
          create: { id: String(item.id), ...values },
          update: values
        } as any);
      }

      return {
        companies: data.companies.length,
        companyUsers: data.companyUsers.length,
        platforms: data.platforms.length,
        tenders: data.tenders.length,
        bids: data.bids.length,
        documents: data.documents.length,
        discounts: data.discounts.length,
        proposalLetterTemplates: data.proposalLetterTemplates.length,
        emailMessages: data.emailMessages.length
      };
    },
    { maxWait: 10_000, timeout: 120_000 }
  );
}
