import { BidSituation, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import {
  assertCompanyPortalAccess,
  assertCompanyWriteAccess,
  requireOrganizationId,
  type AuthScope
} from './access.service.js';

const organizationChatMembers = async (organizationId: string) =>
  prisma.user.findMany({
    where: {
      organizationId,
      active: true,
      role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FUNCIONARIO] }
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' }
  });

async function assertTenderInCompany(tenderId: string, companyId: string, organizationId: string) {
  const bid = await prisma.bid.findFirst({
    where: { tenderId, companyId, tender: { organizationId } },
    select: { id: true }
  });
  if (!bid) throw new AppError('Esta licitação não está associada à empresa selecionada', 422);
}

export async function listAgenda(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  return prisma.agendaItem.findMany({
    where: { organizationId: requireOrganizationId(auth), companyId },
    include: {
      createdBy: { select: { id: true, name: true } },
      tender: {
        select: {
          id: true,
          municipality: true,
          noticeNumber: true,
          processNumber: true,
          sessionDate: true,
          sessionTime: true
        }
      }
    },
    orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }]
  });
}

export async function createAgendaItem(
  companyId: string,
  input: { title: string; notes?: string | null; eventDate: Date; tenderId?: string | null },
  auth: AuthScope
) {
  await assertCompanyWriteAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  if (input.tenderId) await assertTenderInCompany(input.tenderId, companyId, organizationId);

  return prisma.agendaItem.create({
    data: {
      organizationId,
      companyId,
      tenderId: input.tenderId || null,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      eventDate: input.eventDate,
      createdById: auth.userId
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      tender: {
        select: {
          id: true,
          municipality: true,
          noticeNumber: true,
          processNumber: true,
          sessionDate: true,
          sessionTime: true
        }
      }
    }
  });
}

export async function updateAgendaItem(
  companyId: string,
  itemId: string,
  input: { title?: string; notes?: string | null; eventDate?: Date; tenderId?: string | null },
  auth: AuthScope
) {
  await assertCompanyWriteAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  const current = await prisma.agendaItem.findFirst({
    where: { id: itemId, organizationId, companyId },
    select: { id: true }
  });
  if (!current) throw new AppError('Item da agenda não encontrado', 404);
  if (input.tenderId) await assertTenderInCompany(input.tenderId, companyId, organizationId);

  return prisma.agendaItem.update({
    where: { id: itemId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.eventDate !== undefined ? { eventDate: input.eventDate } : {}),
      ...(input.tenderId !== undefined ? { tenderId: input.tenderId || null } : {})
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      tender: {
        select: {
          id: true,
          municipality: true,
          noticeNumber: true,
          processNumber: true,
          sessionDate: true,
          sessionTime: true
        }
      }
    }
  });
}

export async function deleteAgendaItem(companyId: string, itemId: string, auth: AuthScope) {
  await assertCompanyWriteAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  const current = await prisma.agendaItem.findFirst({
    where: { id: itemId, organizationId, companyId },
    select: { id: true }
  });
  if (!current) throw new AppError('Item da agenda não encontrado', 404);
  await prisma.agendaItem.delete({ where: { id: itemId } });
  return { id: itemId };
}

const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function priorityStatus(item: {
  tender: {
    sessionDate: Date;
    bids: Array<{ situation: BidSituation }>;
    emailMessages: Array<{
      subject: string | null;
      snippet: string | null;
      textContent: string | null;
      convocationReason: string | null;
    }>;
  };
}) {
  const fallbackStatus = () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    if (item.tender.sessionDate.toISOString().slice(0, 10) <= today) return 'INICIADA' as const;
    if (item.tender.bids.some((bid) => bid.situation === BidSituation.ANEXADA)) return 'ANEXADA' as const;
    return 'PENDENTE' as const;
  };

  for (const message of item.tender.emailMessages) {
    const text = normalize(
      [message.subject, message.snippet, message.textContent, message.convocationReason]
        .filter(Boolean)
        .join(' ')
    );

    if (
      [
        'retorno da suspensao',
        'retorno de suspensao',
        'fim da suspensao',
        'retomada do certame',
        'retomada da sessao',
        'sessao retomada',
        'reabertura da sessao',
        'sessao reaberta',
        'prosseguimento do certame',
        'prosseguimento da sessao'
      ].some((term) => text.includes(term))
    ) {
      return fallbackStatus();
    }

    if (
      [
        'aviso de suspensao',
        'suspensao do certame',
        'suspensao da sessao',
        'certame suspenso',
        'sessao suspensa',
        'licitacao suspensa',
        'processo suspenso'
      ].some((term) => text.includes(term))
    ) {
      return 'SUSPENSA' as const;
    }

    if (
      [
        'manifestar intencao de recurso',
        'manifestacao de intencao de recurso',
        'manifestacao de recurso',
        'intencao de recorrer',
        'intencao de interpor recurso',
        'intencao recursal',
        'prazo para recurso',
        'prazo recursal',
        'fase recursal',
        'recurso administrativo',
        'apresentacao de recurso',
        'interposicao de recurso',
        'impugnacao ao edital',
        'impugnacao do edital',
        'impugnacao de edital',
        'pedido de impugnacao',
        'apresentar contrarrazoes',
        'apresentacao de contrarrazoes',
        'contrarrazoes ao recurso',
        'prazo para contrarrazoes'
      ].some((term) => text.includes(term))
    ) {
      return 'RECURSO' as const;
    }

    if (
      [
        'convocacao',
        'convocado',
        'convocada',
        'convocamos',
        'proposta readequada',
        'readequacao da proposta',
        'enviar proposta readequada',
        'apresentar proposta readequada'
      ].some((term) => text.includes(term))
    ) {
      return 'CONVOCADA' as const;
    }
  }

  return fallbackStatus();
}

export async function listPriorities(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  const items = await prisma.tenderPriority.findMany({
    where: { organizationId, companyId },
    include: {
      tender: {
        select: {
          id: true,
          municipality: true,
          noticeNumber: true,
          processNumber: true,
          object: true,
          sessionDate: true,
          sessionTime: true,
          bids: {
            where: { companyId },
            select: { id: true, situation: true, progress: true }
          },
          emailMessages: {
            where: { companyId },
            orderBy: { receivedAt: 'desc' },
            take: 8,
            select: {
              subject: true,
              snippet: true,
              textContent: true,
              convocationReason: true,
              receivedAt: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return items.map((item) => ({
    id: item.id,
    tenderId: item.tenderId,
    createdAt: item.createdAt,
    status: priorityStatus(item),
    tender: item.tender
  }));
}

export async function addPriority(companyId: string, tenderId: string, auth: AuthScope) {
  await assertCompanyWriteAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  await assertTenderInCompany(tenderId, companyId, organizationId);
  return prisma.tenderPriority.upsert({
    where: { companyId_tenderId: { companyId, tenderId } },
    create: { organizationId, companyId, tenderId, createdById: auth.userId },
    update: {}
  });
}

export async function removePriority(companyId: string, tenderId: string, auth: AuthScope) {
  await assertCompanyWriteAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  const item = await prisma.tenderPriority.findFirst({
    where: { organizationId, companyId, tenderId },
    select: { id: true }
  });
  if (!item) return { removed: false };
  await prisma.tenderPriority.delete({ where: { id: item.id } });
  return { removed: true };
}

export async function listOrganizationChat(auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const members = await organizationChatMembers(organizationId);
  if (!members.some((member) => member.id === auth.userId)) {
    throw new AppError('Seu usuário não possui acesso ao chat da equipe', 403);
  }
  const messages = await prisma.companyChatMessage.findMany({
    where: { organizationId },
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return {
    enabled: members.length > 1,
    members,
    messages: messages.reverse()
  };
}

export async function sendOrganizationChatMessage(
  input: { content: string; mentionUserIds?: string[] },
  auth: AuthScope
) {
  const organizationId = requireOrganizationId(auth);
  const members = await organizationChatMembers(organizationId);

  if (members.length <= 1) {
    throw new AppError('O chat é liberado quando a organização possui mais de um usuário na equipe', 422);
  }

  const author = members.find((member) => member.id === auth.userId);
  if (!author) {
    throw new AppError('Seu usuário não possui acesso ao chat da equipe', 403);
  }

  const allowedIds = new Set(members.map((member) => member.id));
  const mentionUserIds = Array.from(
    new Set((input.mentionUserIds ?? []).filter((id) => id !== auth.userId && allowedIds.has(id)))
  );

  const message = await prisma.companyChatMessage.create({
    data: {
      organizationId,
      companyId: null,
      authorId: auth.userId,
      content: input.content.trim(),
      mentionUserIds
    },
    include: { author: { select: { id: true, name: true, role: true } } }
  });

  if (mentionUserIds.length > 0) {
    await prisma.userNotification.createMany({
      data: mentionUserIds.map((userId) => ({
        userId,
        title: `${message.author.name} mencionou você no chat`,
        message: input.content.trim().slice(0, 1000),
        link: '/?chat=1'
      }))
    });
  }

  return message;
}

export async function deleteOrganizationChatMessage(messageId: string, auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const message = await prisma.companyChatMessage.findFirst({
    where: { id: messageId, organizationId },
    select: { id: true, authorId: true }
  });

  if (!message) throw new AppError('Mensagem não encontrada', 404);
  if (message.authorId !== auth.userId) {
    throw new AppError('Você só pode excluir as suas próprias mensagens', 403);
  }

  await prisma.companyChatMessage.delete({ where: { id: message.id } });
  return { id: message.id };
}

export async function listCompanyChat(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  return listOrganizationChat(auth);
}

export async function sendCompanyChatMessage(
  companyId: string,
  input: { content: string; mentionUserIds?: string[] },
  auth: AuthScope
) {
  await assertCompanyWriteAccess(companyId, auth);
  return sendOrganizationChatMessage(input, auth);
}
