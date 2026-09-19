import { GmailAccessRequestStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import type { AuthScope } from './access.service.js';

export async function getPlatformOverview() {
  const [organizations, pendingGmailRequests] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        loginEmail: true,
        active: true,
        billingExempt: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        createdAt: true,
        _count: { select: { users: true, companies: true, tenders: true } }
      } // LICITAGESTAO_BILLING_ORDERS_API_V2_PLATFORM_ADMIN
    }),
    prisma.gmailAccessRequest.count({ where: { status: GmailAccessRequestStatus.PENDING } })
  ]);
  return {
    organizations,
    totals: {
      organizations: organizations.length,
      activeOrganizations: organizations.filter((item) => item.active).length,
      pendingGmailRequests
    }
  };
}

export async function setOrganizationActive(id: string, active: boolean, auth: AuthScope) {
  if (id === auth.organizationId && !active) {
    throw new AppError('A organização do SUPER_ADMIN não pode ser desativada por esta tela', 422);
  }
  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) throw new AppError('Organização não encontrada', 404);
  return prisma.organization.update({ where: { id }, data: { active } });
}

export async function deleteOrganizationPermanently(
  id: string,
  confirmation: string,
  auth: AuthScope
) {
  if (id === auth.organizationId) {
    throw new AppError(
      'A organização do SUPER_ADMIN não pode ser apagada por esta tela',
      422
    );
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true, loginEmail: true }
  });

  if (!organization) throw new AppError('Organização não encontrada', 404);

  if (confirmation.trim().toLowerCase() !== organization.loginEmail.toLowerCase()) {
    throw new AppError(
      'Confirmação inválida. Digite exatamente o e-mail principal da organização.',
      422
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { organizationId: id } });
    await tx.proposalLetterTemplate.deleteMany({ where: { organizationId: id } });

    // Tender remove em cascata participacoes, documentos e calculos dependentes.
    await tx.tender.deleteMany({ where: { organizationId: id } });
    await tx.platform.deleteMany({ where: { organizationId: id } });

    // Remove usuarios antes das empresas para liberar FKs de companyId.
    await tx.user.deleteMany({ where: { organizationId: id } });
    await tx.company.deleteMany({ where: { organizationId: id } });

    // Billing, reset de senha e solicitacoes Gmail ligadas diretamente
    // a Organization possuem onDelete Cascade.
    await tx.organization.delete({ where: { id } });
  });

  return {
    id: organization.id,
    name: organization.name,
    loginEmail: organization.loginEmail
  };
} // LICITAGESTAO_SUPERADMIN_DELETE_V22

export async function listGmailAccessRequests(status?: GmailAccessRequestStatus) {
  return prisma.gmailAccessRequest.findMany({
    where: status ? { status } : {},
    orderBy: { requestedAt: 'desc' },
    take: 200,
    include: {
      organization: { select: { id: true, name: true, loginEmail: true } },
      company: { select: { id: true, legalName: true, tradeName: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } }
    }
  });
}

export async function reviewGmailAccessRequest(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  note: string | null,
  auth: AuthScope
) {
  const request = await prisma.gmailAccessRequest.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true } },
      company: { select: { tradeName: true, legalName: true } }
    }
  });
  if (!request) throw new AppError('Solicitação não encontrada', 404);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.gmailAccessRequest.update({
      where: { id },
      data: {
        status,
        reviewNote: note,
        reviewedById: auth.userId,
        reviewedAt: new Date()
      }
    });
    const companyName = request.company.tradeName || request.company.legalName;
    await tx.userNotification.create({
      data: {
        userId: request.requestedById,
        title: status === GmailAccessRequestStatus.APPROVED
          ? 'Gmail autorizado'
          : 'Solicitação do Gmail revisada',
        message: status === GmailAccessRequestStatus.APPROVED
          ? `O e-mail ${request.email} foi aprovado para ${companyName}. Você já pode conectar a conta Google em Integrações.`
          : `A solicitação do e-mail ${request.email} para ${companyName} não foi aprovada.${note ? ` Motivo: ${note}` : ''}`,
        link: `/empresas/${request.companyId}?tab=integrations`
      }
    });
    return result;
  });
  return updated;
}

export async function getSupportSettings() {
  return prisma.platformSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', supportName: 'Francisco' },
    update: {}
  });
}

export async function updateSupportSettings(supportName: string, supportWhatsapp: string | null) {
  return prisma.platformSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', supportName, supportWhatsapp },
    update: { supportName, supportWhatsapp }
  });
}
