import crypto from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyPortalAccess, type AuthScope } from './access.service.js';
import { decryptSecret, detectPotentialConvocation, encryptSecret, extractGmailText, type GmailPayloadPart } from './gmail-utils.js';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1';
const STATE_TTL_MS = 10 * 60_000;
const SYNC_OVERLAP_MS = 2 * 60_000;
const MAX_GMAIL_PAGES = 20;

const db = prisma as any;

let pollTimer: NodeJS.Timeout | null = null;
let firstPollTimer: NodeJS.Timeout | null = null;
let pollRunning = false;

export type GmailStatus = {
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

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GmailProfile = { emailAddress?: string };
type GmailListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>;
  nextPageToken?: string;
};

type GmailMessageResponse = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayloadPart;
};

function gmailConfigured() {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI &&
      env.GOOGLE_OAUTH_STATE_SECRET &&
      env.GOOGLE_TOKEN_ENCRYPTION_KEY
  );
}

function requireGmailConfig() {
  if (!gmailConfigured()) {
    throw new AppError('Integração Gmail ainda não configurada no servidor', 503, 'GMAIL_NOT_CONFIGURED');
  }
}

function requestTimeout() {
  return AbortSignal.timeout(20_000);
}

export function encryptGoogleRefreshToken(value: string, secret = env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '') {
  return encryptSecret(value, secret);
}

export function decryptGoogleRefreshToken(value: string, secret = env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? '') {
  return decryptSecret(value, secret);
}

function signState(payload: OAuthStatePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.GOOGLE_OAUTH_STATE_SECRET!)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verifyState(state: string) {
  requireGmailConfig();
  const [body, signature] = state.split('.');
  if (!body || !signature) throw new AppError('Estado OAuth inválido', 400);
  const expected = crypto
    .createHmac('sha256', env.GOOGLE_OAUTH_STATE_SECRET!)
    .update(body)
    .digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new AppError('Estado OAuth inválido', 400);
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
  if (!payload.companyId || !payload.userId || payload.expiresAt < Date.now()) {
    throw new AppError('Autorização Google expirada. Tente conectar novamente.', 400);
  }
  return payload;
}

async function googleRequest<T>(url: string, init: RequestInit, errorLabel: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: requestTimeout() });
  } catch {
    throw new AppError(`${errorLabel}: serviço do Google indisponível`, 502, 'GMAIL_UNAVAILABLE');
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
    const message =
      typeof data === 'object' && data && 'error_description' in data
        ? String((data as { error_description?: unknown }).error_description ?? '')
        : typeof data === 'object' && data && 'error' in data
          ? typeof (data as { error?: unknown }).error === 'string'
            ? String((data as { error?: unknown }).error)
            : JSON.stringify((data as { error?: unknown }).error)
          : '';
    throw new AppError(`${errorLabel}${message ? `: ${message}` : ''}`, 502, 'GMAIL_API_ERROR');
  }
  return data as T;
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    grant_type: 'authorization_code'
  });
  return googleRequest<GoogleTokenResponse>(
    GOOGLE_TOKEN_URL,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
    'Falha ao concluir OAuth do Google'
  );
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    grant_type: 'refresh_token'
  });
  const token = await googleRequest<GoogleTokenResponse>(
    GOOGLE_TOKEN_URL,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
    'Falha ao renovar acesso ao Gmail'
  );
  if (!token.access_token) throw new AppError('Google não retornou token de acesso', 502);
  return token.access_token;
}

async function gmailGet<T>(path: string, accessToken: string) {
  return googleRequest<T>(
    `${GMAIL_API_URL}${path}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    'Falha ao consultar Gmail'
  );
}

function headerValue(payload: GmailPayloadPart | undefined, name: string) {
  return payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}


function gmailSearchDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function safeGoogleError(error: unknown) {
  if (error instanceof AppError) return error.message.slice(0, 500);
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Falha desconhecida ao sincronizar Gmail';
}

function emailAccessWhere(auth: AuthScope): Record<string, unknown> {
  if (auth.role === UserRole.ADMIN) return {};
  if (auth.role === UserRole.EMPRESA) {
    return { companyId: auth.companyId ?? '00000000-0000-0000-0000-000000000000' };
  }
  return { company: { staffLinks: { some: { userId: auth.userId } } } };
}

export async function getGmailStatus(companyId: string, auth: AuthScope): Promise<GmailStatus> {
  await assertCompanyPortalAccess(companyId, auth);
  const integration = await db.emailIntegration.findUnique({
    where: { companyId },
    select: {
      googleEmail: true,
      connectedAt: true,
      lastSyncedAt: true,
      lastSuccessfulSyncAt: true,
      lastError: true
    }
  });
  return {
    configured: gmailConfigured(),
    connected: Boolean(integration),
    email: integration?.googleEmail ?? null,
    connectedAt: integration?.connectedAt ?? null,
    lastSyncedAt: integration?.lastSyncedAt ?? null,
    lastSuccessfulSyncAt: integration?.lastSuccessfulSyncAt ?? null,
    lastError: integration?.lastError ?? null,
    pollingIntervalSeconds: Math.round(env.GMAIL_POLL_INTERVAL_MS / 1000)
  };
}

export async function createGmailAuthorizationUrl(companyId: string, auth: AuthScope) {
  requireGmailConfig();
  await assertCompanyPortalAccess(companyId, auth);
  const state = signState({
    companyId,
    userId: auth.userId,
    expiresAt: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  });
  const query = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
  return `${GOOGLE_AUTH_URL}?${query.toString()}`;
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

export async function completeGmailOAuth(code: string, state: string) {
  requireGmailConfig();
  const payload = verifyState(state);
  const auth = await authScopeFromState(payload.userId);
  await assertCompanyPortalAccess(payload.companyId, auth);

  const tokens = await exchangeCode(code);
  if (!tokens.access_token) throw new AppError('Google não retornou token de acesso', 502);

  const existing = await db.emailIntegration.findUnique({ where: { companyId: payload.companyId } });
  const refreshToken = tokens.refresh_token ?? (existing ? decryptGoogleRefreshToken(existing.refreshTokenEncrypted) : null);
  if (!refreshToken) {
    throw new AppError('Google não forneceu autorização offline. Desconecte o acesso no Google e tente novamente.', 400);
  }

  const profile = await gmailGet<GmailProfile>('/users/me/profile', tokens.access_token);
  if (!profile.emailAddress) throw new AppError('Não foi possível identificar o e-mail conectado', 502);
  const now = new Date();
  const integration = await db.emailIntegration.upsert({
    where: { companyId: payload.companyId },
    create: {
      companyId: payload.companyId,
      googleEmail: profile.emailAddress,
      refreshTokenEncrypted: encryptGoogleRefreshToken(refreshToken),
      connectedAt: now,
      lastSyncedAt: now,
      lastSuccessfulSyncAt: null,
      lastError: null
    },
    update: {
      googleEmail: profile.emailAddress,
      refreshTokenEncrypted: encryptGoogleRefreshToken(refreshToken),
      connectedAt: now,
      lastSyncedAt: now,
      lastSuccessfulSyncAt: null,
      lastError: null
    }
  });
  return { integrationId: integration.id, companyId: payload.companyId, email: profile.emailAddress, auth };
}

async function revokeRefreshToken(refreshToken: string) {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: requestTimeout()
    });
  } catch {
    // A revogação remota é melhor esforço; a credencial local ainda será removida.
  }
}

export async function disconnectGmail(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  const integration = await db.emailIntegration.findUnique({ where: { companyId } });
  if (!integration) return { disconnected: false };
  const refreshToken = (() => {
    try {
      return decryptGoogleRefreshToken(integration.refreshTokenEncrypted);
    } catch {
      return null;
    }
  })();
  await db.emailIntegration.delete({ where: { companyId } });
  if (refreshToken) void revokeRefreshToken(refreshToken);
  return { disconnected: true, email: integration.googleEmail };
}

async function listNewMessageRefs(accessToken: string, since: Date) {
  const refs: Array<{ id: string; threadId: string | null }> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_GMAIL_PAGES; page += 1) {
    const query = new URLSearchParams({ maxResults: '500', q: `after:${gmailSearchDate(since)}` });
    if (pageToken) query.set('pageToken', pageToken);
    const data = await gmailGet<GmailListResponse>(`/users/me/messages?${query.toString()}`, accessToken);
    for (const item of data.messages ?? []) {
      if (item.id) refs.push({ id: item.id, threadId: item.threadId ?? null });
    }
    if (!data.nextPageToken) return { refs, complete: true };
    pageToken = data.nextPageToken;
  }
  return { refs, complete: false };
}

export async function syncGmailIntegration(companyId: string) {
  const integration = await db.emailIntegration.findUnique({ where: { companyId } });
  if (!integration) return { found: 0, inserted: 0, convocations: 0 };
  if (!gmailConfigured()) return { found: 0, inserted: 0, convocations: 0 };

  const syncStartedAt = new Date();
  const baseline = integration.lastSyncedAt ?? integration.connectedAt;
  const since = new Date(Math.max(0, baseline.getTime() - SYNC_OVERLAP_MS));
  try {
    const refreshToken = decryptGoogleRefreshToken(integration.refreshTokenEncrypted);
    const accessToken = await refreshAccessToken(refreshToken);
    const listed = await listNewMessageRefs(accessToken, since);
    let inserted = 0;
    let convocations = 0;

    for (const ref of listed.refs) {
      const exists = await db.emailMessage.findUnique({
        where: { companyId_gmailMessageId: { companyId, gmailMessageId: ref.id } },
        select: { id: true }
      });
      if (exists) continue;

      const message = await gmailGet<GmailMessageResponse>(
        `/users/me/messages/${encodeURIComponent(ref.id)}?format=full`,
        accessToken
      );
      if (!message.id || !message.threadId || !message.internalDate) continue;
      const receivedAt = new Date(Number(message.internalDate));
      if (!Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() <= since.getTime()) continue;

      const sender = (headerValue(message.payload, 'From') ?? 'Remetente não informado').slice(0, 500);
      const subject = headerValue(message.payload, 'Subject')?.slice(0, 500) ?? null;
      const textContent = extractGmailText(message.payload);
      const snippet = message.snippet?.slice(0, 4_000) ?? null;
      const detection = detectPotentialConvocation({ subject, snippet, text: textContent });

      try {
        await db.emailMessage.create({
          data: {
            companyId,
            gmailMessageId: message.id,
            threadId: message.threadId,
            sender,
            subject,
            receivedAt,
            snippet,
            textContent: detection.detected && textContent ? textContent : null,
            processingStatus: 'PROCESSADO',
            isPotentialConvocation: detection.detected,
            convocationReason: detection.reason
          }
        });
        inserted += 1;
        if (detection.detected) convocations += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }

    await db.emailIntegration.update({
      where: { companyId },
      data: {
        ...(listed.complete ? { lastSyncedAt: syncStartedAt } : {}),
        lastSuccessfulSyncAt: new Date(),
        lastError: listed.complete ? null : 'Sincronização parcial: volume de mensagens acima do limite por ciclo.'
      }
    });
    return { found: listed.refs.length, inserted, convocations, complete: listed.complete };
  } catch (error) {
    const message = safeGoogleError(error);
    await db.emailIntegration
      .update({ where: { companyId }, data: { lastError: message } })
      .catch(() => undefined);
    throw error;
  }
}

export async function syncCompanyGmail(companyId: string, auth: AuthScope) {
  await assertCompanyPortalAccess(companyId, auth);
  const integration = await db.emailIntegration.findUnique({ where: { companyId }, select: { id: true } });
  if (!integration) throw new AppError('Gmail não conectado nesta empresa', 404);
  return syncGmailIntegration(companyId);
}

export async function syncAllGmailIntegrations() {
  if (!gmailConfigured() || pollRunning) return;
  pollRunning = true;
  try {
    const integrations = (await db.emailIntegration.findMany({ select: { companyId: true } })) as Array<{ companyId: string }>;
    for (const integration of integrations) {
      try {
        await syncGmailIntegration(integration.companyId);
      } catch (error) {
        console.error(`Falha ao sincronizar Gmail da empresa ${integration.companyId}:`, safeGoogleError(error));
      }
    }
  } catch (error) {
    console.error('Falha ao consultar integrações Gmail:', safeGoogleError(error));
  } finally {
    pollRunning = false;
  }
}

export function startGmailPolling() {
  if (!gmailConfigured() || pollTimer) return;
  firstPollTimer = setTimeout(() => void syncAllGmailIntegrations(), 10_000);
  firstPollTimer.unref();
  pollTimer = setInterval(() => void syncAllGmailIntegrations(), env.GMAIL_POLL_INTERVAL_MS);
  pollTimer.unref();
  console.log(`Polling do Gmail ativo a cada ${Math.round(env.GMAIL_POLL_INTERVAL_MS / 1000)}s`);
}

export function stopGmailPolling() {
  if (firstPollTimer) clearTimeout(firstPollTimer);
  if (pollTimer) clearInterval(pollTimer);
  firstPollTimer = null;
  pollTimer = null;
}

export async function listCompanyEmailMessages(
  companyId: string,
  auth: AuthScope,
  query: { limit: number; convocationsOnly: boolean }
) {
  await assertCompanyPortalAccess(companyId, auth);
  return db.emailMessage.findMany({
    where: { companyId, ...(query.convocationsOnly ? { isPotentialConvocation: true } : {}) },
    select: {
      id: true,
      companyId: true,
      gmailMessageId: true,
      threadId: true,
      sender: true,
      subject: true,
      receivedAt: true,
      snippet: true,
      textContent: true,
      processingStatus: true,
      isPotentialConvocation: true,
      convocationReason: true,
      createdAt: true
    },
    orderBy: { receivedAt: 'desc' },
    take: query.limit
  });
}

export async function listGmailConvocationAlerts(auth: AuthScope) {
  const messages = (await db.emailMessage.findMany({
    where: { ...emailAccessWhere(auth), isPotentialConvocation: true },
    select: {
      id: true,
      companyId: true,
      sender: true,
      subject: true,
      receivedAt: true,
      snippet: true,
      company: { select: { legalName: true, tradeName: true } }
    },
    orderBy: { receivedAt: 'desc' },
    take: 50
  })) as Array<{
    id: string; companyId: string; sender: string; subject: string | null; receivedAt: Date; snippet: string | null;
    company: { legalName: string; tradeName: string | null };
  }>;
  const alertKeys = messages.map((message) => `GMAIL_CONVOCATION:${message.id}`);
  const reads = alertKeys.length
    ? (await db.notificationRead.findMany({
        where: { userId: auth.userId, alertKey: { in: alertKeys } },
        select: { alertKey: true }
      })) as Array<{ alertKey: string }>
    : [];
  const readKeys = new Set(reads.map((item: { alertKey: string }) => item.alertKey));
  const items = messages.map((message) => {
    const key = `GMAIL_CONVOCATION:${message.id}`;
    return {
      key,
      messageId: message.id,
      companyId: message.companyId,
      companyName: message.company.tradeName || message.company.legalName,
      sender: message.sender,
      subject: message.subject,
      receivedAt: message.receivedAt,
      snippet: message.snippet,
      read: readKeys.has(key)
    };
  });
  return { items, unread: items.filter((item) => !item.read).length };
}

export async function markGmailConvocationRead(auth: AuthScope, messageId: string) {
  const message = await db.emailMessage.findFirst({
    where: { id: messageId, ...emailAccessWhere(auth), isPotentialConvocation: true },
    select: { id: true }
  });
  if (!message) throw new AppError('Convocação não encontrada', 404);
  const alertKey = `GMAIL_CONVOCATION:${message.id}`;
  await db.notificationRead.upsert({
    where: { userId_alertKey: { userId: auth.userId, alertKey } },
    create: { userId: auth.userId, alertKey },
    update: { readAt: new Date() }
  });
}

export async function markAllGmailConvocationsRead(auth: AuthScope) {
  const current = await listGmailConvocationAlerts(auth);
  if (!current.items.length) return { count: 0 };
  await prisma.$transaction(
    current.items.map((item) =>
      db.notificationRead.upsert({
        where: { userId_alertKey: { userId: auth.userId, alertKey: item.key } },
        create: { userId: auth.userId, alertKey: item.key },
        update: { readAt: new Date() }
      })
    )
  );
  return { count: current.items.length };
}
