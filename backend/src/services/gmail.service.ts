import crypto from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyPortalAccess, type AuthScope } from './access.service.js';
import {
  decryptSecret,
  detectPotentialConvocation,
  encryptSecret,
  extractGmailText,
  type GmailPayloadPart
} from './gmail-utils.js';

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
  const expected = crypto.createHmac('sha256', env.GOOGLE_OAUTH_STATE_SECRET!).update(body).digest();
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

type MatchCandidate = {
  id: string;
  companyId: string;
  tenderId: string;
  tender: {
    id: string;
    modality: string | null;
    noticeNumber: string | null;
    processNumber: string | null;
    municipality: string;
    object: string;
    sessionDate: Date;
    platform: { id: string; name: string } | null;
  };
};

type MatchMessage = {
  id: string;
  companyId: string;
  subject: string | null;
  snippet: string | null;
  textContent: string | null;
  isPotentialConvocation: boolean;
  bidId?: string | null;
  convocationMatchMethod?: string | null;
};

type ConvocationMatch = {
  bidId: string;
  tenderId: string;
  method: 'PROCESS_NUMBER' | 'NOTICE_NUMBER' | 'CONTEXT';
  confidence: number;
};

function normalizeForMatch(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactIdentifier(value: string | null | undefined) {
  return normalizeForMatch(value).replace(/\s+/g, '');
}

function meaningfulPlatformTokens(name: string | null | undefined) {
  const ignored = new Set(['tecnologia', 'compras', 'portal', 'sistema', 'licitacoes', 'licitacao']);
  return normalizeForMatch(name)
    .split(' ')
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function objectKeywords(value: string | null | undefined) {
  const ignored = new Set([
    'contratacao',
    'empresa',
    'execucao',
    'municipio',
    'secretaria',
    'servicos',
    'atraves',
    'objeto',
    'publica',
    'publico',
    'para',
    'com',
    'dos',
    'das',
    'uma',
    'obra',
    'obras'
  ]);
  return Array.from(new Set(normalizeForMatch(value).split(' ')))
    .filter((token) => token.length >= 6 && !ignored.has(token))
    .slice(0, 12);
}

function evaluateCandidate(candidate: MatchCandidate, message: MatchMessage) {
  const raw = [message.subject, message.snippet, message.textContent].filter(Boolean).join('\n');
  const normalized = normalizeForMatch(raw);
  const compact = normalized.replace(/\s+/g, '');
  const process = compactIdentifier(candidate.tender.processNumber);
  const notice = compactIdentifier(candidate.tender.noticeNumber);
  const municipality = normalizeForMatch(candidate.tender.municipality);
  const modality = normalizeForMatch(candidate.tender.modality);
  const platformTokens = meaningfulPlatformTokens(candidate.tender.platform?.name);
  const keywords = objectKeywords(candidate.tender.object);

  const processMatch = process.length >= 6 && compact.includes(process);
  const noticeMatch = notice.length >= 4 && compact.includes(notice);
  const municipalityMatch = municipality.length >= 3 && normalized.includes(municipality);
  const modalityMatch = modality.length >= 4 && normalized.includes(modality);
  const platformMatch = platformTokens.some((token) => normalized.includes(token));
  const keywordMatches = keywords.filter((token) => normalized.includes(token)).length;

  let score = 0;
  if (processMatch) score += 100;
  if (noticeMatch) score += 70;
  if (municipalityMatch) score += 18;
  if (modalityMatch) score += 12;
  if (platformMatch) score += 12;
  score += Math.min(keywordMatches, 3) * 4;

  const contextMatch = municipalityMatch && platformMatch;
  if (contextMatch) score += 45;
  const method: ConvocationMatch['method'] | null = processMatch
    ? 'PROCESS_NUMBER'
    : noticeMatch
      ? 'NOTICE_NUMBER'
      : contextMatch
        ? 'CONTEXT'
        : null;
  const eligible = processMatch || noticeMatch || contextMatch;
  return { score, method, eligible };
}

async function findBestConvocationMatch(
  companyId: string,
  message: MatchMessage
): Promise<ConvocationMatch | null> {
  const candidates = (await db.bid.findMany({
    where: { companyId },
    select: {
      id: true,
      companyId: true,
      tenderId: true,
      tender: {
        select: {
          id: true,
          modality: true,
          noticeNumber: true,
          processNumber: true,
          municipality: true,
          object: true,
          sessionDate: true,
          platform: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { tender: { sessionDate: 'desc' } },
    take: 500
  })) as MatchCandidate[];

  const ranked = candidates
    .map((candidate) => ({ candidate, ...evaluateCandidate(candidate, message) }))
    .filter((item) => item.eligible && item.method)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || !best.method) return null;
  const second = ranked[1];
  if (second && second.score === best.score) return null;

  return {
    bidId: best.candidate.id,
    tenderId: best.candidate.tenderId,
    method: best.method,
    confidence:
      best.method === 'PROCESS_NUMBER'
        ? 100
        : best.method === 'NOTICE_NUMBER'
          ? Math.min(98, Math.max(85, best.score))
          : 75
  };
}

export async function autoLinkConvocationMessage(messageId: string) {
  const message = (await db.emailMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      companyId: true,
      subject: true,
      snippet: true,
      textContent: true,
      isPotentialConvocation: true,
      bidId: true,
      convocationMatchMethod: true
    }
  })) as MatchMessage | null;
  if (!message?.isPotentialConvocation) return null;
  if (message.bidId && message.convocationMatchMethod === 'MANUAL') return null;

  const match = await findBestConvocationMatch(message.companyId, message);
  if (!match) return null;
  await db.emailMessage.update({
    where: { id: message.id },
    data: {
      tenderId: match.tenderId,
      bidId: match.bidId,
      convocationMatchMethod: match.method,
      convocationMatchConfidence: match.confidence,
      convocationMatchedAt: new Date()
    }
  });
  return match;
}

export async function relinkPotentialConvocationsForTender(tenderId: string) {
  const bids = (await db.bid.findMany({
    where: { tenderId },
    select: { id: true, companyId: true }
  })) as Array<{
    id: string;
    companyId: string;
  }>;
  const companyIds = Array.from(new Set(bids.map((bid) => bid.companyId)));
  for (const companyId of companyIds) {
    const messages = (await db.emailMessage.findMany({
      where: {
        companyId,
        isPotentialConvocation: true,
        OR: [{ bidId: null }, { convocationMatchMethod: { not: 'MANUAL' } }]
      },
      select: { id: true },
      orderBy: { receivedAt: 'desc' },
      take: 200
    })) as Array<{ id: string }>;
    for (const message of messages) await autoLinkConvocationMessage(message.id);
  }
}

export async function relinkUnmatchedConvocations(companyId?: string) {
  const recentMessages = (await db.emailMessage.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      OR: [{ convocationMatchMethod: null }, { convocationMatchMethod: { not: 'MANUAL' } }],
      receivedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60_000) }
    },
    select: {
      id: true,
      sender: true,
      subject: true,
      snippet: true,
      textContent: true,
      isPotentialConvocation: true,
      convocationReason: true
    },
    orderBy: { receivedAt: 'desc' },
    take: 1000
  })) as Array<{
    id: string;
    sender: string;
    subject: string | null;
    snippet: string | null;
    textContent: string | null;
    isPotentialConvocation: boolean;
    convocationReason: string | null;
  }>;
  let reclassified = 0;
  let discarded = 0;
  for (const message of recentMessages) {
    const detection = detectPotentialConvocation({
      sender: message.sender,
      subject: message.subject,
      snippet: message.snippet,
      text: message.textContent
    });
    if (
      detection.detected === message.isPotentialConvocation &&
      detection.reason === message.convocationReason
    ) {
      continue;
    }
    await db.emailMessage.update({
      where: { id: message.id },
      data: detection.detected
        ? { isPotentialConvocation: true, convocationReason: detection.reason }
        : {
            isPotentialConvocation: false,
            convocationReason: null,
            tenderId: null,
            bidId: null,
            convocationMatchMethod: null,
            convocationMatchConfidence: null,
            convocationMatchedAt: null
          }
    });
    if (detection.detected) reclassified += 1;
    else discarded += 1;
  }

  const messages = (await db.emailMessage.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      isPotentialConvocation: true,
      bidId: null
    },
    select: { id: true },
    orderBy: { receivedAt: 'desc' },
    take: 500
  })) as Array<{ id: string }>;
  for (const message of messages) await autoLinkConvocationMessage(message.id);
  return { checked: recentMessages.length, reclassified, discarded };
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
  const refreshToken =
    tokens.refresh_token ?? (existing ? decryptGoogleRefreshToken(existing.refreshTokenEncrypted) : null);
  if (!refreshToken) {
    throw new AppError(
      'Google não forneceu autorização offline. Desconecte o acesso no Google e tente novamente.',
      400
    );
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
      const detection = detectPotentialConvocation({ sender, subject, snippet, text: textContent });

      try {
        const created = await db.emailMessage.create({
          data: {
            companyId,
            gmailMessageId: message.id,
            threadId: message.threadId,
            provider: 'GMAIL',
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

    await db.emailIntegration.update({
      where: { companyId },
      data: {
        ...(listed.complete ? { lastSyncedAt: syncStartedAt } : {}),
        lastSuccessfulSyncAt: new Date(),
        lastError: listed.complete
          ? null
          : 'Sincronização parcial: volume de mensagens acima do limite por ciclo.'
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
  const result = await syncGmailIntegration(companyId);
  const review = await relinkUnmatchedConvocations(companyId);
  return { ...result, convocations: result.convocations + review.reclassified };
}

export async function syncAllGmailIntegrations() {
  if (!gmailConfigured() || pollRunning) return;
  pollRunning = true;
  try {
    const integrations = (await db.emailIntegration.findMany({ select: { companyId: true } })) as Array<{
      companyId: string;
    }>;
    for (const integration of integrations) {
      try {
        await syncGmailIntegration(integration.companyId);
      } catch (error) {
        console.error(
          `Falha ao sincronizar Gmail da empresa ${integration.companyId}:`,
          safeGoogleError(error)
        );
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
  firstPollTimer = setTimeout(() => {
    void relinkUnmatchedConvocations()
      .catch((error) => console.error('Falha ao reavaliar convocações existentes:', safeGoogleError(error)))
      .finally(() => void syncAllGmailIntegrations());
  }, 10_000);
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
  query: { limit: number; convocationsOnly: boolean; bidId?: string }
) {
  await assertCompanyPortalAccess(companyId, auth);
  if (query.bidId) {
    const bid = await db.bid.findFirst({ where: { id: query.bidId, companyId }, select: { id: true } });
    if (!bid) throw new AppError('Participação não encontrada nesta empresa', 404);
  }
  const messages = await db.emailMessage.findMany({
    where: {
      companyId,
      ...(query.convocationsOnly ? { isPotentialConvocation: true } : {}),
      ...(query.bidId ? { bidId: query.bidId } : {})
    },
    select: {
      id: true,
      companyId: true,
      gmailMessageId: true,
      threadId: true,
      provider: true,
      sender: true,
      subject: true,
      receivedAt: true,
      snippet: true,
      textContent: true,
      processingStatus: true,
      isPotentialConvocation: true,
      convocationReason: true,
      tenderId: true,
      bidId: true,
      convocationMatchMethod: true,
      convocationMatchConfidence: true,
      convocationMatchedAt: true,
      tender: {
        select: { id: true, modality: true, noticeNumber: true, processNumber: true, municipality: true }
      },
      bid: { select: { id: true } },
      createdAt: true
    },
    orderBy: { receivedAt: 'desc' },
    take: query.limit
  });
  if (!query.convocationsOnly || messages.length === 0) return messages;
  const keys = messages.map((message: { id: string }) => `GMAIL_CONVOCATION:${message.id}`);
  const dismissed = await db.notificationRead.findMany({
    where: { userId: auth.userId, alertKey: { in: keys }, dismissedAt: { not: null } },
    select: { alertKey: true }
  });
  const dismissedKeys = new Set(dismissed.map((item: { alertKey: string }) => item.alertKey));
  return messages.filter((message: { id: string }) => !dismissedKeys.has(`GMAIL_CONVOCATION:${message.id}`));
}

export async function linkGmailConvocationToBid(messageId: string, bidId: string | null, auth: AuthScope) {
  const message = await db.emailMessage.findFirst({
    where: { id: messageId, ...emailAccessWhere(auth), isPotentialConvocation: true },
    select: { id: true, companyId: true }
  });
  if (!message) throw new AppError('Convocação não encontrada', 404);

  if (!bidId) {
    return db.emailMessage.update({
      where: { id: message.id },
      data: {
        tenderId: null,
        bidId: null,
        convocationMatchMethod: null,
        convocationMatchConfidence: null,
        convocationMatchedAt: null
      }
    });
  }

  const bid = await db.bid.findFirst({
    where: { id: bidId, companyId: message.companyId },
    select: { id: true, tenderId: true }
  });
  if (!bid) throw new AppError('A licitação selecionada não pertence à empresa desta convocação', 422);

  return db.emailMessage.update({
    where: { id: message.id },
    data: {
      tenderId: bid.tenderId,
      bidId: bid.id,
      convocationMatchMethod: 'MANUAL',
      convocationMatchConfidence: 100,
      convocationMatchedAt: new Date()
    }
  });
}

export async function listGmailConvocationAlerts(auth: AuthScope) {
  const messages = (await db.emailMessage.findMany({
    where: { ...emailAccessWhere(auth), isPotentialConvocation: true },
    select: {
      id: true,
      companyId: true,
      provider: true,
      sender: true,
      subject: true,
      receivedAt: true,
      snippet: true,
      tenderId: true,
      bidId: true,
      tender: { select: { modality: true, noticeNumber: true, processNumber: true, municipality: true } },
      company: { select: { legalName: true, tradeName: true } }
    },
    orderBy: { receivedAt: 'desc' },
    take: 50
  })) as Array<{
    id: string;
    companyId: string;
    provider: 'GMAIL' | 'OUTLOOK';
    sender: string;
    subject: string | null;
    receivedAt: Date;
    snippet: string | null;
    tenderId: string | null;
    bidId: string | null;
    tender: {
      modality: string | null;
      noticeNumber: string | null;
      processNumber: string | null;
      municipality: string;
    } | null;
    company: { legalName: string; tradeName: string | null };
  }>;
  const alertKeys = messages.map((message) => `GMAIL_CONVOCATION:${message.id}`);
  const reads = alertKeys.length
    ? ((await db.notificationRead.findMany({
        where: { userId: auth.userId, alertKey: { in: alertKeys } },
        select: { alertKey: true, dismissedAt: true }
      })) as Array<{ alertKey: string; dismissedAt: Date | null }>)
    : [];
  const readKeys = new Set(reads.map((item) => item.alertKey));
  const dismissedKeys = new Set(reads.filter((item) => item.dismissedAt).map((item) => item.alertKey));
  const items = messages
    .filter((message) => !dismissedKeys.has(`GMAIL_CONVOCATION:${message.id}`))
    .map((message) => {
      const key = `GMAIL_CONVOCATION:${message.id}`;
      return {
        key,
        messageId: message.id,
        companyId: message.companyId,
        provider: message.provider,
        companyName: message.company.tradeName || message.company.legalName,
        sender: message.sender,
        subject: message.subject,
        receivedAt: message.receivedAt,
        snippet: message.snippet,
        tenderId: message.tenderId,
        bidId: message.bidId,
        tender: message.tender,
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

export async function dismissGmailConvocationAlert(auth: AuthScope, messageId: string) {
  const message = await db.emailMessage.findFirst({
    where: { id: messageId, ...emailAccessWhere(auth), isPotentialConvocation: true },
    select: { id: true }
  });
  if (!message) throw new AppError('Notificação não encontrada', 404);
  const alertKey = `GMAIL_CONVOCATION:${message.id}`;
  await db.notificationRead.upsert({
    where: { userId_alertKey: { userId: auth.userId, alertKey } },
    create: { userId: auth.userId, alertKey, dismissedAt: new Date() },
    update: { readAt: new Date(), dismissedAt: new Date() }
  });
}
