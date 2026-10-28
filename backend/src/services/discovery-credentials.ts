import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';
import { encryptSecret } from './gmail-utils.js';

export const permittedLoginPlatforms = ['BLL', 'M2A', 'LICITAMAIS'] as const;
export type LoginPlatform = typeof permittedLoginPlatforms[number];

function secretKey() {
  if (!env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY) throw new AppError('Configure PLATFORM_CREDENTIAL_ENCRYPTION_KEY no Render antes de salvar credenciais.', 503);
  return env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY;
}
export async function listPlatformLoginStatus(auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const records = await prisma.platformCredential.findMany({
    where: { organizationId, userId: auth.userId },
    select: { platform: true, updatedAt: true }
  });
  return { storageReady: Boolean(env.PLATFORM_CREDENTIAL_ENCRYPTION_KEY), automationReady: false,
    // Nenhum segredo, token ou senha é retornado ao frontend.
    items: records.map((c) => ({ platform: c.platform, saved: true, updatedAt: c.updatedAt })) };
}
export async function savePlatformLogin(auth: AuthScope, input: { platform: LoginPlatform; username: string; password: string }) {
  const organizationId = requireOrganizationId(auth);
  // A criptografia é feita antes de gravar no banco; logs não devem conter a carga recebida.
  const encrypted = encryptSecret(JSON.stringify({ username: input.username, password: input.password }), secretKey());
  await prisma.platformCredential.upsert({
    where: { userId_platform: { userId: auth.userId, platform: input.platform } },
    create: { organizationId, userId: auth.userId, platform: input.platform, secretEncrypted: encrypted },
    update: { organizationId, secretEncrypted: encrypted }
  });
  return { platform: input.platform, saved: true };
}
export async function removePlatformLogin(auth: AuthScope, platform: LoginPlatform) {
  await prisma.platformCredential.deleteMany({ where: { organizationId: requireOrganizationId(auth), userId: auth.userId, platform } });
  return { platform, saved: false };
}
