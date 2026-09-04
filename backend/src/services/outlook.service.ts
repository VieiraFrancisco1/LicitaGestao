import crypto from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyPortalAccess, type AuthScope } from './access.service.js';
import { decryptSecret, detectPotentialConvocation, encryptSecret } from './gmail-utils.js';
import { autoLinkConvocationMessage, relinkUnmatchedConvocations } from './gmail.service.js';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/User.Read',
  'https://graph.microsoft.com/Mail.Read'
].join(' ');
const STATE_TTL_MS = 10 * 60_000;
// A API do Outlook pode levar alguns minutos para disponibilizar uma mensagem que
// já aparece na Caixa de Entrada. Uma margem maior evita que ela fique para trás;
// mensagens repetidas continuam protegidas pela chave única no banco.
const SYNC_OVERLAP_MS = 60 * 60_000;
const MAX_OUTLOOK_PAGES = 20;
const MAX_BODY_CHARS = 30_000;

const db = prisma as any;

let pollTimer: NodeJS.Timeout | null = null;
let firstPollTimer: NodeJS.Timeout | null = null;
let pollRunning = false;

export type OutlookStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
  lastError: string | null;
  pollingIntervalSeconds: number;
};

type OAuthStatePayload = {
  companyId: string;
  userId: string;
  expiresAt: number;
  nonce: string;
};

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type MicrosoftProfile = {
  mail?: string | null;
  userPrincipalName?: string | null;
};

type GraphEmailAddress = {
  name?: string | null;
  address?: string | null;
};

type GraphMessage = {
  id?: string;
  conversationId?: string | null;
  receivedDateTime?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string | null } | null;
  from?: { emailAddress?: GraphEmailAddress | null } | null;
  sender?: { emailAddress?: GraphEmailAddress | null } | null;
};

type GraphMessageList = {
  value?: GraphMessage[];
  '@odata.nextLink'?: string;
};

function outlookConfigured() {
  return Boolean(
    env.MICROSOFT_CLIENT_ID &&
    env.MICROSOFT_CLIENT_SECRET &&
    env.MICROSOFT_REDIRECT_URI &&
    env.MICROSOFT_OAUTH_STATE_SECRET &&
    env.MICROSOFT_TOKEN_ENCRYPTION_KEY
  );
}

function requireOutlookConfig() {
  if (!outlookConfigured()) {
    throw new AppError('Integração Outlook ainda não configurada no servidor', 503, 'OUTLOOK_NOT_CONFIGURED');
  }
}

function requestTimeout() {
  return AbortSignal.timeout(20_000);
}

function encryptMicrosoftRefreshToken(value: string) {
  return encryptSecret(value, env.MICROSOFT_TOKEN_ENCRYPTION_KEY ?? '');
}

function decryptMicrosoftRefreshToken(value: string) {
  return decryptSecret(value, env.MICROSOFT_TOKEN_ENCRYPTION_KEY ?? '');
}

function signState(payload: OAuthStatePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.MICROSOFT_OAUTH_STATE_SECRET!)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verifyState(state: string) {
  requireOutlookConfig();
  const [body, signature] = state.split('.');
  if (!body || !signature) throw new AppError('Estado OAuth inválido', 400);
  const expected = crypto.createHmac('sha256', env.MICROSOFT_OAUTH_STATE_SECRET!).update(body).digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new AppError('Estado OAuth inválido', 400);
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
  if (!payload.companyId || !payload.userId || payload.expiresAt < Date.now()) {
    throw new AppError('Autorização Microsoft expirada. Tente conectar novamente.', 400);
  }
  return payload;
}

function microsoftErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  if ('error_description' in data && typeof data.error_description === 'string')
    return data.error_description;
  if ('error' in data) {
    const error = data.error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return '';
}

async function microsoftRequest<T>(url: string, init: RequestInit, errorLabel: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: requestTimeout() });
  } catch {
    throw new AppError(`${errorLabel}: serviço da Microsoft indisponível`, 502, 'OUTLOOK_UNAVAILABLE');
  }
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message = microsoftErrorMessage(data);
    throw new AppError(`${errorLabel}${message ? `: ${message}` : ''}`, 502, 'OUTLOOK_API_ERROR');
  }
  return data as T;
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri: env.MICROSOFT_REDIRECT_URI!,
    grant_type: 'authorization_code',
    scope: MICROSOFT_SCOPES
  });
  return microsoftRequest<MicrosoftTokenResponse>(
    MICROSOFT_TOKEN_URL,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
    'Falha ao concluir OAuth da Microsoft'
  );
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    redirect_uri: env.MICROSOFT_REDIRECT_URI!,
    grant_type: 'refresh_token',
    scope: MICROSOFT_SCOPES
  });
  const tokens = await microsoftRequest<MicrosoftTokenResponse>(
    MICROSOFT_TOKEN_URL,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
    'Falha ao renovar acesso ao Outlook'
  );
  if (!tokens.access_token) throw new AppError('Microsoft não retornou token de acesso', 502);
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null };
}

async function graphGet<T>(pathOrUrl: string, accessToken: string) {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH_API_URL}${pathOrUrl}`;
  if (!url.startsWith(`${GRAPH_API_URL}/`)) throw new AppError('URL de paginação do Outlook inválida', 502);
  return microsoftRequest<T>(
    url,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"'
      }
    },
    'Falha ao consultar Outlook'
  );
}

function safeMicrosoftError(error: unknown) {
  if (error instanceof AppError) return error.message.slice(0, 500);
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Falha desconhecida ao sincronizar Outlook';
}

function messageKey(value: string) {
  return `outlook:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function cleanText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split(String.fromCharCode(0))
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_BODY_CHARS);
}

function senderLabel(message: GraphMessage) {
  const address = message.from?.emailAddress ?? message.sender?.emailAddress;
  if (!address) return 'Remetente não informado';
  const name = address.name?.trim();
  const email = address.address?.trim();
  if (name && email) return `${name} <${email}>`.slice(0, 500);
  return (email || name || 'Remetente não informado').slice(0, 500);
}

async function authScopeFromState(userId: string): Promise<AuthScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, active: true, companyId: true, company: { select: { active: true } } }
  });
  if (!user?.active || (user.role === UserRole.EMPRESA && !user.company?.active)) {
    throw new AppError('Usuário sem acesso ao sistema', 403);
  }
  return { userId: user.id, role: user.role, companyId: user.companyId };
}

async function listNewMessages(accessToken: string, since: Date) {
  const messages: GraphMessage[] = [];
  const query = new URLSearchParams({
    $select: 'id,conversationId,receivedDateTime,from,sender,subject,bodyPreview,body',
    $filter: `receivedDateTime ge ${since.toISOString()}`,
    $orderby: 'receivedDateTime asc',
    $top: '100'
  });
  let nextUrl: string | undefined = `${GRAPH_API_URL}/me/mailFolders/inbox/messages?${query.toString()}`;

  for (let page = 0; page < MAX_OUTLOOK_PAGES && nextUrl; page += 1) {
    const data: GraphMessageList = await graphGet<GraphMessageList>(nextUrl, accessToken);
    messages.push(...(data.value ?? []));
    if (!data['@odata.nextLink']) return { messages, complete: true };
    nextUrl = data['@odata.nextLink'];
  }
  return { messages, complete: !nextUrl };
}

export async function getOutlookStatus(companyId: string, auth: AuthScope): Promise<OutlookStatus> {
  await assertCompanyPortalAccess(companyId, auth);
  const integration = await db.outlookIntegration.findUnique({
    where: { companyId },
    select: {
      microsoftEmail: true,
      connectedAt: true,
      lastSyncedAt: true,
      lastSuccessfulSyncAt: true,
      lastError: true
    }
  });
  return {
    configured: outlookConfigured(),
    connected: Boolean(integration),
    email: integration?.microsoftEmail ?? null,
    connectedAt: integration?.connectedAt ?? null,
    lastSyncedAt: integration?.lastSyncedAt ?? null,
    lastSuccessfulSyncAt: integration?.lastSuccessfulSyncAt ?? null,
    lastError: integration?.lastError ?? null,
    pollingIntervalSeconds: Math.round(env.OUTLOOK_POLL_INTERVAL_MS / 1000)
  };
}

export async function createOutlookAuthorizationUrl(companyId: string, auth: AuthScope) {
  requireOutlookConfig();
  await assertCompanyPortalAccess(companyId, auth);
  const state = signState({
    companyId,
    userId: auth.userId,
    expiresAt: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  });
  const query = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    redirect_uri: env.MICROSOFT_REDIRECT_URI!,
    response_type: 'code',
    response_mode: 'query',
    scope: MICROSOFT_SCOPES,
    prompt: 'select_account',
    state
  });
  return `${MICROSOFT_AUTH_URL}?${query.toString()}`;
}

export async function completeOutlookOAuth(code: string, state: string) {
  requireOutlookConfig();
  const payload = verifyState(state);
  const auth = await authScopeFromState(payload.userId);
  await assertCompanyPortalAccess(payload.companyId, auth);

  const tokens = await exchangeCode(code);
  if (!tokens.access_token) throw new AppError('Microsoft não retornou token de acesso', 502);

  const existing = await db.outlookIntegration.findUnique({ where: { companyId: payload.companyId } });
  const refreshToken =
    tokens.refresh_token ?? (existing ? decryptMicrosoftRefreshToken(existing.refreshTokenEncrypted) : null);
  if (!refreshToken) {
    throw new AppError(
      'Microsoft não forneceu autorização offline. Remova o acesso e tente conectar novamente.',
      400
    );
  }

  const profile = await graphGet<MicrosoftProfile>('/me?$select=mail,userPrincipalName', tokens.access_token);
  const email = profile.mail || profile.userPrincipalName;
  if (!email) throw new AppError('Não foi possível identificar o e-mail Microsoft conectado', 502);

  const now = new Date();
  const integration = await db.outlookIntegration.upsert({
    where: { companyId: payload.companyId },
    create: {
      companyId: payload.companyId,
      microsoftEmail: email,
      refreshTokenEncrypted: encryptMicrosoftRefreshToken(refreshToken),
      connectedAt: now,
      lastSyncedAt: now,
      lastSuccessfulSyncAt: null,
      lastError: null
    },
    update: {
      microsoftEmail: email,
      refreshTokenEncrypted: encryptMicrosoftRefreshToken(refreshToken),
      connectedAt: now,
      lastSyncedAt: now,
      lastSuccessfulSyncAt: null,
      lastError: null
    }
  });
  return { integrationId: integration.id, companyId: payload.companyId, email, auth };
}

export async function disconnectOutlook(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  const integration = await db.outlookIntegration.findUnique({ where: { companyId } });
  if (!integration) return { disconnected: false };
  await db.outlookIntegration.delete({ where: { companyId } });
  return { disconnected: true, email: integration.microsoftEmail };
}

export async function syncOutlookIntegration(companyId: string) {
  const integration = await db.outlookIntegration.findUnique({ where: { companyId } });
  if (!integration || !outlookConfigured()) return { found: 0, inserted: 0, convocations: 0 };

  const syncStartedAt = new Date();
  const baseline = integration.lastSyncedAt ?? integration.connectedAt;
  const since = new Date(Math.max(0, baseline.getTime() - SYNC_OVERLAP_MS));
  try {
    const refreshToken = decryptMicrosoftRefreshToken(integration.refreshTokenEncrypted);
    const refreshed = await refreshAccessToken(refreshToken);
    if (refreshed.refreshToken && refreshed.refreshToken !== refreshToken) {
      await db.outlookIntegration.update({
        where: { companyId },
        data: { refreshTokenEncrypted: encryptMicrosoftRefreshToken(refreshed.refreshToken) }
      });
    }
    const listed = await listNewMessages(refreshed.accessToken, since);
    let inserted = 0;
    let convocations = 0;

    for (const message of listed.messages) {
      if (!message.id || !message.receivedDateTime) continue;
      const receivedAt = new Date(message.receivedDateTime);
      if (!Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() <= since.getTime()) continue;

      const externalId = messageKey(message.id);
      const exists = await db.emailMessage.findUnique({
        where: { companyId_gmailMessageId: { companyId, gmailMessageId: externalId } },
        select: { id: true }
      });
      if (exists) continue;

      const subject = message.subject?.slice(0, 500) ?? null;
      const snippet = cleanText(message.bodyPreview).slice(0, 4_000) || null;
      const textContent = cleanText(message.body?.content);
      const sender = senderLabel(message);
      const detection = detectPotentialConvocation({ sender, subject, snippet, text: textContent });

      try {
        const created = await db.emailMessage.create({
          data: {
            companyId,
            gmailMessageId: externalId,
            threadId: messageKey(message.conversationId || message.id),
            provider: 'OUTLOOK',
            sender,
            subject,
            receivedAt,
            snippet,
            textContent: detection.detected && textContent ? textContent : null,
            processingStatus: 'PROCESSADO',
            isPotentialConvocation: detection.detected,
            convocationReason: detection.reason
          },
          select: { id: true }
        });
        inserted += 1;
        if (detection.detected) {
          convocations += 1;
          await autoLinkConvocationMessage(created.id);
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }

    await db.outlookIntegration.update({
      where: { companyId },
      data: {
        ...(listed.complete ? { lastSyncedAt: syncStartedAt } : {}),
        lastSuccessfulSyncAt: new Date(),
        lastError: listed.complete
          ? null
          : 'Sincronização parcial: volume de mensagens acima do limite por ciclo.'
      }
    });
    return { found: listed.messages.length, inserted, convocations, complete: listed.complete };
  } catch (error) {
    const message = safeMicrosoftError(error);
    await db.outlookIntegration
      .update({ where: { companyId }, data: { lastError: message } })
      .catch(() => undefined);
    throw error;
  }
}

export async function syncCompanyOutlook(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  const integration = await db.outlookIntegration.findUnique({ where: { companyId }, select: { id: true } });
  if (!integration) throw new AppError('Outlook não conectado nesta empresa', 404);
  const result = await syncOutlookIntegration(companyId);
  const review = await relinkUnmatchedConvocations(companyId);
  return { ...result, convocations: result.convocations + review.reclassified };
}

export async function syncAllOutlookIntegrations() {
  if (!outlookConfigured() || pollRunning) return;
  pollRunning = true;
  try {
    const integrations = (await db.outlookIntegration.findMany({ select: { companyId: true } })) as Array<{
      companyId: string;
    }>;
    for (const integration of integrations) {
      try {
        await syncOutlookIntegration(integration.companyId);
      } catch (error) {
        console.error(
          `Falha ao sincronizar Outlook da empresa ${integration.companyId}:`,
          safeMicrosoftError(error)
        );
      }
    }
  } catch (error) {
    console.error('Falha ao consultar integrações Outlook:', safeMicrosoftError(error));
  } finally {
    pollRunning = false;
  }
}

export function startOutlookPolling() {
  if (!outlookConfigured() || pollTimer) return;
  firstPollTimer = setTimeout(() => void syncAllOutlookIntegrations(), 15_000);
  firstPollTimer.unref();
  pollTimer = setInterval(() => void syncAllOutlookIntegrations(), env.OUTLOOK_POLL_INTERVAL_MS);
  pollTimer.unref();
  console.log(`Polling do Outlook ativo a cada ${Math.round(env.OUTLOOK_POLL_INTERVAL_MS / 1000)}s`);
}

export function stopOutlookPolling() {
  if (firstPollTimer) clearTimeout(firstPollTimer);
  if (pollTimer) clearInterval(pollTimer);
  firstPollTimer = null;
  pollTimer = null;
}
