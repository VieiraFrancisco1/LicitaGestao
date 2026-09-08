import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';
import { getMegaStatus } from './mega.service.js';

export type HealthStatus = 'OPERATIONAL' | 'WARNING' | 'UNAVAILABLE' | 'NOT_CONFIGURED';

type EmailIntegrationSnapshot = {
  lastSuccessfulSyncAt: Date | null;
  lastError: string | null;
};

type EmailHealthSummary = {
  status: HealthStatus;
  message: string;
  configured: boolean;
  connectedAccounts: number;
  accountsWithError: number;
  delayedAccounts: number;
  lastSuccessfulSyncAt: Date | null;
  pollingIntervalSeconds: number;
};

export function summarizeEmailHealth(input: {
  configured: boolean;
  integrations: EmailIntegrationSnapshot[];
  pollingIntervalMs: number;
  now?: Date;
}): EmailHealthSummary {
  const connectedAccounts = input.integrations.length;
  const accountsWithError = input.integrations.filter((item) => Boolean(item.lastError)).length;
  const now = input.now ?? new Date();
  const staleAfterMs = Math.max(10 * 60_000, input.pollingIntervalMs * 5);
  const delayedAccounts = input.integrations.filter(
    (item) => !item.lastSuccessfulSyncAt || now.getTime() - item.lastSuccessfulSyncAt.getTime() > staleAfterMs
  ).length;
  const lastSuccessfulSyncAt = input.integrations.reduce<Date | null>((latest, item) => {
    if (!item.lastSuccessfulSyncAt) return latest;
    if (!latest || item.lastSuccessfulSyncAt > latest) return item.lastSuccessfulSyncAt;
    return latest;
  }, null);

  let status: HealthStatus = 'OPERATIONAL';
  let message = `${connectedAccounts} conta(s) sincronizando normalmente.`;
  if (!input.configured) {
    status = 'NOT_CONFIGURED';
    message = 'Integração não configurada no servidor.';
  } else if (connectedAccounts === 0) {
    status = 'WARNING';
    message = 'Nenhuma conta conectada nesta organização.';
  } else if (accountsWithError > 0) {
    status = 'WARNING';
    message = `${accountsWithError} conta(s) com falha na última sincronização.`;
  } else if (delayedAccounts > 0) {
    status = 'WARNING';
    message = `${delayedAccounts} conta(s) com sincronização atrasada.`;
  }

  return {
    status,
    message,
    configured: input.configured,
    connectedAccounts,
    accountsWithError,
    delayedAccounts,
    lastSuccessfulSyncAt,
    pollingIntervalSeconds: Math.round(input.pollingIntervalMs / 1000)
  };
}

async function databaseHealth() {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'OPERATIONAL' as const,
      message: 'Conexão com o banco funcionando.',
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt))
    };
  } catch {
    return {
      status: 'UNAVAILABLE' as const,
      message: 'Não foi possível consultar o banco de dados.',
      latencyMs: null
    };
  }
}

async function megaHealth(auth: AuthScope) {
  try {
    const mega = await Promise.race([
      getMegaStatus(auth),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('Tempo limite do MEGA')), 8_000)
      )
    ]);

    if (!mega.serverConfigured) {
      return {
        status: 'NOT_CONFIGURED' as const,
        message: 'MEGA individual ainda não habilitado no servidor.',
        configured: false,
        connected: false,
        rootFolder: mega.rootFolder,
        spaceUsed: null,
        spaceTotal: null
      };
    }

    if (!mega.configured) {
      return {
        status: 'NOT_CONFIGURED' as const,
        message: 'Seu usuário ainda não conectou uma conta MEGA.',
        configured: false,
        connected: false,
        rootFolder: mega.rootFolder,
        spaceUsed: null,
        spaceTotal: null
      };
    }

    return {
      status: mega.connected ? ('OPERATIONAL' as const) : ('UNAVAILABLE' as const),
      message: mega.connected ? 'Sua conta MEGA está conectada.' : 'Não foi possível acessar sua conta MEGA.',
      configured: true,
      connected: mega.connected,
      rootFolder: mega.rootFolder,
      spaceUsed: mega.spaceUsed,
      spaceTotal: mega.spaceTotal
    };
  } catch {
    return {
      status: 'UNAVAILABLE' as const,
      message: 'O MEGA não respondeu dentro do tempo esperado.',
      configured: true,
      connected: false,
      rootFolder: env.MEGA_ROOT_FOLDER || 'Cloud Drive',
      spaceUsed: null,
      spaceTotal: null
    };
  }
}

const gmailConfigured = () =>
  Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI &&
      env.GOOGLE_OAUTH_STATE_SECRET &&
      env.GOOGLE_TOKEN_ENCRYPTION_KEY
  );

const outlookConfigured = () =>
  Boolean(
    env.MICROSOFT_CLIENT_ID &&
      env.MICROSOFT_CLIENT_SECRET &&
      env.MICROSOFT_REDIRECT_URI &&
      env.MICROSOFT_OAUTH_STATE_SECRET &&
      env.MICROSOFT_TOKEN_ENCRYPTION_KEY
  );

export async function getSystemHealth(auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const checkedAt = new Date();
  const [database, mega] = await Promise.all([databaseHealth(), megaHealth(auth)]);

  let gmailSnapshots: EmailIntegrationSnapshot[] = [];
  let outlookSnapshots: EmailIntegrationSnapshot[] = [];
  if (database.status === 'OPERATIONAL') {
    [gmailSnapshots, outlookSnapshots] = await Promise.all([
      prisma.emailIntegration.findMany({
        where: { company: { active: true, organizationId } },
        select: { lastSuccessfulSyncAt: true, lastError: true }
      }),
      prisma.outlookIntegration.findMany({
        where: { company: { active: true, organizationId } },
        select: { lastSuccessfulSyncAt: true, lastError: true }
      })
    ]);
  }

  const gmail = summarizeEmailHealth({
    configured: gmailConfigured(),
    integrations: gmailSnapshots,
    pollingIntervalMs: env.GMAIL_POLL_INTERVAL_MS,
    now: checkedAt
  });
  const outlook = summarizeEmailHealth({
    configured: outlookConfigured(),
    integrations: outlookSnapshots,
    pollingIntervalMs: env.OUTLOOK_POLL_INTERVAL_MS,
    now: checkedAt
  });

  if (database.status === 'UNAVAILABLE') {
    gmail.status = 'UNAVAILABLE';
    gmail.message = 'Status indisponível enquanto o banco estiver offline.';
    outlook.status = 'UNAVAILABLE';
    outlook.message = 'Status indisponível enquanto o banco estiver offline.';
  }

  const monitoredStatuses = [database.status, mega.status, gmail.status, outlook.status];
  const overall: HealthStatus =
    database.status === 'UNAVAILABLE'
      ? 'UNAVAILABLE'
      : monitoredStatuses.some((status) => status === 'WARNING' || status === 'UNAVAILABLE')
        ? 'WARNING'
        : 'OPERATIONAL';

  return {
    checkedAt,
    overall,
    api: {
      status: 'OPERATIONAL' as const,
      message: 'Servidor respondendo normalmente.',
      uptimeSeconds: Math.floor(process.uptime())
    },
    database,
    mega,
    gmail,
    outlook
  };
}
