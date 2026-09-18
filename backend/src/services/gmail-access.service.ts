import { GmailAccessRequestStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyPortalAccess, requireOrganizationId, type AuthScope } from './access.service.js';

export async function getLatestGmailAccessRequest(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  return prisma.gmailAccessRequest.findFirst({
    where: { companyId, organizationId: requireOrganizationId(auth) },
    orderBy: { requestedAt: 'desc' },
    include: {
      company: { select: { id: true, legalName: true, tradeName: true } }
    }
  });
}

export async function requestGmailAccess(companyId: string, email: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  const normalizedEmail = email.trim().toLowerCase();

  const integration = await prisma.emailIntegration.findUnique({ where: { companyId }, select: { id: true } });
  if (integration) throw new AppError('Esta empresa já possui uma conta Gmail conectada', 409);

  const pending = await prisma.gmailAccessRequest.findFirst({
    where: { companyId, organizationId, status: GmailAccessRequestStatus.PENDING },
    orderBy: { requestedAt: 'desc' }
  });
  if (pending?.email === normalizedEmail) return pending;

  if (pending) {
    await prisma.gmailAccessRequest.update({
      where: { id: pending.id },
      data: {
        status: GmailAccessRequestStatus.REJECTED,
        reviewNote: 'Substituída por uma nova solicitação de e-mail',
        reviewedAt: new Date()
      }
    });
  }

  return prisma.gmailAccessRequest.create({
    data: {
      organizationId,
      companyId,
      requestedById: auth.userId,
      email: normalizedEmail
    }
  });
}

export async function getApprovedGmailAccess(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  if (auth.role === UserRole.SUPER_ADMIN) return null;
  const approval = await prisma.gmailAccessRequest.findFirst({
    where: {
      companyId,
      organizationId: requireOrganizationId(auth),
      status: GmailAccessRequestStatus.APPROVED
    },
    orderBy: { reviewedAt: 'desc' }
  });
  if (!approval) {
    throw new AppError(
      'Solicite a autorização do Gmail e aguarde a aprovação do suporte antes de conectar a conta.',
      403,
      'GMAIL_ACCESS_NOT_APPROVED'
    );
  }
  return approval;
}

export async function ensureApprovedGmailAddress(companyId: string, email: string, auth: AuthScope) {
  if (auth.role === UserRole.SUPER_ADMIN) return;
  const approved = await prisma.gmailAccessRequest.findFirst({
    where: {
      companyId,
      organizationId: requireOrganizationId(auth),
      email: email.trim().toLowerCase(),
      status: GmailAccessRequestStatus.APPROVED
    },
    orderBy: { reviewedAt: 'desc' }
  });
  if (!approved) {
    throw new AppError(
      'A conta Google escolhida não é o e-mail aprovado para esta empresa.',
      403,
      'GMAIL_EMAIL_NOT_APPROVED'
    );
  }
}
