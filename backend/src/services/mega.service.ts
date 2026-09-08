import { UserRole } from '@prisma/client';
import { Storage } from 'megajs';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertCompanyPortalAccess, assertCompanyWriteAccess, requireOrganizationId, type AuthScope } from './access.service.js';
import { assertSafeUploadFile, assertSafeUploadName } from './file-security.service.js';
import { decryptSecret, encryptSecret } from './gmail-utils.js';

type MegaNode = {
  nodeId: string;
  name?: string | null;
  directory?: boolean;
  children?: MegaNode[];
  size?: number;
  timestamp?: number;
  upload: (options: { name: string; size?: number; forceHttps?: boolean }, data: Buffer) => {
    complete: Promise<MegaNode>;
  };
  mkdir: (name: string) => Promise<MegaNode>;
  rename: (name: string) => Promise<void>;
  delete: (permanent?: boolean) => Promise<void>;
  download: (options?: { forceHttps?: boolean }) => NodeJS.ReadableStream;
};

type MegaStorage = Storage & {
  root: MegaNode;
  files: Record<string, MegaNode>;
  reload: () => Promise<unknown>;
  getAccountInfo: () => Promise<Record<string, unknown>>;
};

type MegaIntegrationRecord = {
  id: string;
  userId: string;
  email: string;
  passwordEncrypted: string | null;
  connected: boolean;
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

export type MegaItem = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size: number;
  updatedAt: string | null;
  path: string;
};

const db = prisma as any;
const normalizeSlashes = (value: string) => value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
const safeSegments = (value: string) => {
  const normalized = normalizeSlashes(value);
  if (!normalized) return [];
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new AppError('Caminho inválido', 400);
  return segments;
};

const assertSafeName = (name: string) => {
  const clean = name.trim();
  if (!clean || clean === '.' || clean === '..' || /[\\/\0]/.test(clean)) {
    throw new AppError('Nome de arquivo ou pasta inválido', 422);
  }
  if (clean.length > 240) throw new AppError('Nome muito longo', 422);
  return clean;
};

const nameKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\s*\/?\s*A)\b/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const personalStoragePromises = new Map<string, Promise<MegaStorage>>();
let legacyStoragePromise: Promise<MegaStorage> | null = null;

export const isMegaConfigured = () => Boolean(env.MEGA_CREDENTIAL_ENCRYPTION_KEY);
export const isLegacyMegaConfigured = () => Boolean(env.MEGA_EMAIL && env.MEGA_PASSWORD);

function requirePersonalMegaConfig() {
  if (!env.MEGA_CREDENTIAL_ENCRYPTION_KEY) {
    throw new AppError('Integração MEGA individual ainda não configurada no servidor', 503, 'MEGA_NOT_CONFIGURED');
  }
}

function encryptMegaPassword(value: string) {
  requirePersonalMegaConfig();
  return encryptSecret(value, env.MEGA_CREDENTIAL_ENCRYPTION_KEY!);
}

function decryptMegaPassword(value: string) {
  requirePersonalMegaConfig();
  return decryptSecret(value, env.MEGA_CREDENTIAL_ENCRYPTION_KEY!);
}

function createStorage(email: string, password: string): Promise<MegaStorage> {
  return new Storage({
    email,
    password,
    userAgent: 'LicitaGestao/2.0',
    keepalive: true,
    autoload: true
  }).ready as Promise<MegaStorage>;
}

async function getIntegrationByUserId(userId: string): Promise<MegaIntegrationRecord | null> {
  return db.megaIntegration.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      email: true,
      passwordEncrypted: true,
      connected: true,
      connectedAt: true,
      lastSyncedAt: true,
      lastError: true
    }
  });
}

async function requireIntegrationByUserId(userId: string): Promise<MegaIntegrationRecord> {
  const integration = await getIntegrationByUserId(userId);
  if (!integration?.connected || !integration.passwordEncrypted) {
    throw new AppError('Conecte sua conta MEGA em Configurações antes de acessar os documentos.', 409, 'MEGA_ACCOUNT_REQUIRED');
  }
  return integration;
}

async function getPersonalStorageForIntegration(integration: MegaIntegrationRecord, forceReload = false) {
  if (!integration.passwordEncrypted || !integration.connected) {
    throw new AppError('A conta MEGA responsável pelo arquivo não está conectada.', 409, 'MEGA_ACCOUNT_DISCONNECTED');
  }
  let promise = personalStoragePromises.get(integration.id);
  if (!promise) {
    const password = decryptMegaPassword(integration.passwordEncrypted);
    promise = createStorage(integration.email, password);
    personalStoragePromises.set(integration.id, promise);
    promise.catch(() => personalStoragePromises.delete(integration.id));
  }
  const storage = await promise;
  if (forceReload) await storage.reload();
  return storage;
}

async function getCurrentUserStorage(auth: AuthScope, forceReload = false) {
  requireOrganizationId(auth);
  const integration = await requireIntegrationByUserId(auth.userId);
  return { integration, storage: await getPersonalStorageForIntegration(integration, forceReload) };
}

async function getLegacyStorage(forceReload = false): Promise<MegaStorage> {
  if (!env.MEGA_EMAIL || !env.MEGA_PASSWORD) {
    throw new AppError('O arquivo antigo utiliza uma conta MEGA legada que não está configurada no servidor.', 503);
  }
  if (!legacyStoragePromise) {
    legacyStoragePromise = createStorage(env.MEGA_EMAIL, env.MEGA_PASSWORD);
    legacyStoragePromise.catch(() => {
      legacyStoragePromise = null;
    });
  }
  const storage = await legacyStoragePromise;
  if (forceReload) await storage.reload();
  return storage;
}

const folderChildren = (node: MegaNode) => node.children ?? [];

function navigateFrom(base: MegaNode, relativePath = ''): MegaNode {
  let current = base;
  for (const segment of safeSegments(relativePath)) {
    const next = folderChildren(current).find(
      (child) => child.directory && (child.name ?? '').toLocaleLowerCase('pt-BR') === segment.toLocaleLowerCase('pt-BR')
    );
    if (!next) throw new AppError(`Pasta “${segment}” não encontrada no MEGA`, 404);
    current = next;
  }
  return current;
}

async function ensurePath(base: MegaNode, relativePath: string): Promise<MegaNode> {
  let current = base;
  for (const rawSegment of safeSegments(relativePath)) {
    const segment = assertSafeName(rawSegment);
    let next = folderChildren(current).find(
      (child) => child.directory && (child.name ?? '').toLocaleLowerCase('pt-BR') === segment.toLocaleLowerCase('pt-BR')
    );
    if (!next) next = await current.mkdir(segment);
    current = next;
  }
  return current;
}

function findNodeWithPath(base: MegaNode, nodeId: string) {
  const queue: Array<{ node: MegaNode; path: string }> = [{ node: base, path: '' }];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.node.nodeId === nodeId) return current;
    for (const child of folderChildren(current.node)) {
      const childPath = current.path ? `${current.path}/${child.name ?? ''}` : child.name ?? '';
      queue.push({ node: child, path: childPath });
    }
  }
  return null;
}

function findCompanyFolder(base: MegaNode, legalName: string, tradeName: string | null) {
  const candidates = [tradeName, legalName].filter(Boolean).map((value) => nameKey(value!));
  const queue: Array<{ node: MegaNode; path: string; depth: number }> = folderChildren(base)
    .filter((node) => node.directory)
    .map((node) => ({ node, path: node.name ?? '', depth: 1 }));
  let fallback: { node: MegaNode; path: string } | null = null;

  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = nameKey(current.node.name ?? '');
    if (candidates.includes(currentKey)) return { node: current.node, path: current.path };
    if (
      !fallback &&
      currentKey &&
      candidates.some((candidate) => candidate && (currentKey.includes(candidate) || candidate.includes(currentKey)))
    ) {
      fallback = { node: current.node, path: current.path };
    }
    if (current.depth < 4) {
      for (const child of folderChildren(current.node).filter((node) => node.directory)) {
        queue.push({ node: child, path: `${current.path}/${child.name ?? ''}`, depth: current.depth + 1 });
      }
    }
  }
  return fallback;
}

async function configuredRoot(storage: MegaStorage): Promise<MegaNode> {
  if (!env.MEGA_ROOT_FOLDER) return storage.root;
  try {
    return navigateFrom(storage.root, env.MEGA_ROOT_FOLDER);
  } catch {
    return ensurePath(storage.root, env.MEGA_ROOT_FOLDER);
  }
}

async function companyRoot(companyId: string, auth: AuthScope, createIfMissing = true) {
  await assertCompanyPortalAccess(companyId, auth);
  const organizationId = requireOrganizationId(auth);
  const company = await db.company.findFirst({
    where: { id: companyId, organizationId },
    select: { id: true, legalName: true, tradeName: true }
  });
  if (!company) throw new AppError('Empresa não encontrada', 404);

  const { integration, storage } = await getCurrentUserStorage(auth);
  const root = await configuredRoot(storage);
  const mapping = await db.megaCompanyFolder.findUnique({
    where: { megaIntegrationId_companyId: { megaIntegrationId: integration.id, companyId } }
  });

  if (mapping?.path) {
    try {
      return { node: navigateFrom(root, mapping.path), relativePath: mapping.path, company, integration };
    } catch {
      // A pasta pode ter sido movida diretamente pelo MEGA; redescobrimos abaixo.
    }
  }

  const found = findCompanyFolder(root, company.legalName, company.tradeName);
  if (found) {
    await db.megaCompanyFolder.upsert({
      where: { megaIntegrationId_companyId: { megaIntegrationId: integration.id, companyId } },
      create: { megaIntegrationId: integration.id, companyId, path: found.path },
      update: { path: found.path }
    });
    return { node: found.node, relativePath: found.path, company, integration };
  }

  if (!createIfMissing) return { node: null, relativePath: null, company, integration };
  await assertCompanyWriteAccess(companyId, auth);
  const folderName = assertSafeName(company.tradeName || company.legalName);
  const node = await root.mkdir(folderName);
  await db.megaCompanyFolder.upsert({
    where: { megaIntegrationId_companyId: { megaIntegrationId: integration.id, companyId } },
    create: { megaIntegrationId: integration.id, companyId, path: folderName },
    update: { path: folderName }
  });
  return { node, relativePath: folderName, company, integration };
}

async function scopeBase(auth: AuthScope, companyId?: string) {
  if (auth.role === UserRole.EMPRESA) {
    if (!auth.companyId) throw new AppError('Usuário sem empresa vinculada', 403);
    return companyRoot(auth.companyId, auth);
  }
  if (auth.role === UserRole.FUNCIONARIO) {
    if (!companyId) throw new AppError('Selecione uma empresa para acessar os documentos', 422);
    return companyRoot(companyId, auth);
  }
  if (companyId) return companyRoot(companyId, auth);
  const { integration, storage } = await getCurrentUserStorage(auth);
  const root = await configuredRoot(storage);
  return { node: root, relativePath: '', company: null, integration };
}

export async function connectMegaAccount(auth: AuthScope, email: string, password: string) {
  requireOrganizationId(auth);
  requirePersonalMegaConfig();
  const cleanEmail = email.trim().toLowerCase();
  let storage: MegaStorage;
  try {
    storage = await createStorage(cleanEmail, password);
    await storage.getAccountInfo();
  } catch {
    throw new AppError('Não foi possível entrar no MEGA. Confira o e-mail e a senha informados.', 422, 'MEGA_LOGIN_FAILED');
  }

  const now = new Date();
  const integration = await db.megaIntegration.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      email: cleanEmail,
      passwordEncrypted: encryptMegaPassword(password),
      connected: true,
      connectedAt: now,
      lastSyncedAt: now,
      lastError: null
    },
    update: {
      email: cleanEmail,
      passwordEncrypted: encryptMegaPassword(password),
      connected: true,
      connectedAt: now,
      lastSyncedAt: now,
      lastError: null
    }
  });
  personalStoragePromises.set(integration.id, Promise.resolve(storage));
  return getMegaStatus(auth);
}

export async function disconnectMegaAccount(auth: AuthScope) {
  requireOrganizationId(auth);
  const integration = await getIntegrationByUserId(auth.userId);
  if (!integration) return { disconnected: false };
  personalStoragePromises.delete(integration.id);
  await db.megaIntegration.update({
    where: { id: integration.id },
    data: { connected: false, passwordEncrypted: null, lastError: null }
  });
  return { disconnected: true, email: integration.email };
}

export async function getMegaStatus(auth: AuthScope) {
  requireOrganizationId(auth);
  const integration = await getIntegrationByUserId(auth.userId);
  const serverConfigured = isMegaConfigured();
  if (!serverConfigured) {
    return {
      serverConfigured: false,
      configured: Boolean(integration),
      connected: false,
      email: integration?.email ?? null,
      rootFolder: env.MEGA_ROOT_FOLDER || 'Cloud Drive',
      accountName: integration?.email ?? null,
      spaceUsed: null,
      spaceTotal: null,
      lastVerifiedAt: integration?.lastSyncedAt ?? null,
      lastError: integration?.lastError ?? null
    };
  }
  if (!integration?.connected || !integration.passwordEncrypted) {
    return {
      serverConfigured: true,
      configured: Boolean(integration?.connected && integration.passwordEncrypted),
      connected: false,
      email: integration?.email ?? null,
      rootFolder: env.MEGA_ROOT_FOLDER || 'Cloud Drive',
      accountName: integration?.email ?? null,
      spaceUsed: null,
      spaceTotal: null,
      lastVerifiedAt: integration?.lastSyncedAt ?? null,
      lastError: integration?.lastError ?? null
    };
  }
  try {
    const storage = await getPersonalStorageForIntegration(integration);
    const info = (await storage.getAccountInfo().catch(() => ({}))) as {
      spaceUsed?: number;
      spaceTotal?: number;
    };
    const verifiedAt = new Date();
    await db.megaIntegration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: verifiedAt, lastError: null }
    }).catch(() => undefined);
    return {
      serverConfigured: true,
      configured: true,
      connected: true,
      email: integration.email,
      rootFolder: env.MEGA_ROOT_FOLDER || 'Cloud Drive',
      accountName: integration.email,
      spaceUsed: typeof info.spaceUsed === 'number' ? info.spaceUsed : null,
      spaceTotal: typeof info.spaceTotal === 'number' ? info.spaceTotal : null,
      lastVerifiedAt: verifiedAt,
      lastError: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Falha ao conectar ao MEGA';
    personalStoragePromises.delete(integration.id);
    await db.megaIntegration.update({ where: { id: integration.id }, data: { lastError: message } }).catch(() => undefined);
    return {
      serverConfigured: true,
      configured: true,
      connected: false,
      email: integration.email,
      rootFolder: env.MEGA_ROOT_FOLDER || 'Cloud Drive',
      accountName: integration.email,
      spaceUsed: null,
      spaceTotal: null,
      lastVerifiedAt: integration.lastSyncedAt,
      lastError: message
    };
  }
}

export async function syncMegaAccount(auth: AuthScope) {
  const integration = await requireIntegrationByUserId(auth.userId);
  await getPersonalStorageForIntegration(integration, true);
  return getMegaStatus(auth);
}

export async function browseMega(auth: AuthScope, options: { companyId?: string; path?: string; refresh?: boolean }) {
  if (options.refresh) {
    const integration = await requireIntegrationByUserId(auth.userId);
    await getPersonalStorageForIntegration(integration, true);
  }
  const scoped = await scopeBase(auth, options.companyId);
  if (!scoped.node) throw new AppError('Pasta da empresa não encontrada no MEGA', 404);
  const relativePath = normalizeSlashes(options.path ?? '');
  const folder = navigateFrom(scoped.node, relativePath);
  if (!folder.directory) throw new AppError('O caminho informado não é uma pasta', 422);

  const items: MegaItem[] = folderChildren(folder)
    .map((node) => ({
      id: node.nodeId,
      name: node.name || 'Sem nome',
      type: (node.directory ? 'folder' : 'file') as 'folder' | 'file',
      size: node.size ?? 0,
      updatedAt: node.timestamp ? new Date(node.timestamp * 1000).toISOString() : null,
      path: relativePath ? `${relativePath}/${node.name ?? ''}` : node.name ?? ''
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });

  return {
    path: relativePath,
    basePath: scoped.relativePath,
    scopeLabel: scoped.company ? scoped.company.tradeName || scoped.company.legalName : 'Meu MEGA',
    items
  };
}

async function resolveFolderForAction(auth: AuthScope, companyId: string | undefined, relativePath: string) {
  const scoped = await scopeBase(auth, companyId);
  if (!scoped.node) throw new AppError('Pasta da empresa não encontrada no MEGA', 404);
  return { scoped, folder: navigateFrom(scoped.node, relativePath) };
}

export async function createMegaFolder(auth: AuthScope, companyId: string | undefined, relativePath: string, name: string) {
  if (companyId) await assertCompanyWriteAccess(companyId, auth);
  if (!companyId && auth.role !== UserRole.ADMIN) throw new AppError('Selecione uma empresa', 422);
  const { folder } = await resolveFolderForAction(auth, companyId, relativePath);
  const cleanName = assertSafeName(name);
  if (folderChildren(folder).some((node) => node.directory && (node.name ?? '').toLowerCase() === cleanName.toLowerCase())) {
    throw new AppError('Já existe uma pasta com esse nome', 409);
  }
  const created = await folder.mkdir(cleanName);
  return { id: created.nodeId, name: created.name ?? cleanName };
}

export async function uploadMegaFile(
  auth: AuthScope,
  companyId: string | undefined,
  relativePath: string,
  file: Express.Multer.File | undefined
) {
  if (!file) throw new AppError('Selecione um arquivo', 422);
  assertSafeUploadFile(file);
  if (companyId) await assertCompanyWriteAccess(companyId, auth);
  if (!companyId && auth.role !== UserRole.ADMIN) throw new AppError('Selecione uma empresa', 422);
  const { folder } = await resolveFolderForAction(auth, companyId, relativePath);
  const name = assertSafeName(file.originalname);
  const duplicate = folderChildren(folder).find(
    (node) => !node.directory && (node.name ?? '').toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR')
  );
  if (duplicate) throw new AppError('Já existe um arquivo com esse nome nesta pasta', 409);
  const uploaded = await folder.upload({ name, size: file.size, forceHttps: true }, file.buffer).complete;
  return { id: uploaded.nodeId, name: uploaded.name ?? name, size: uploaded.size ?? file.size };
}

async function resolveNodeForAction(auth: AuthScope, companyId: string | undefined, nodeId: string) {
  const scoped = await scopeBase(auth, companyId);
  if (!scoped.node) throw new AppError('Pasta da empresa não encontrada no MEGA', 404);
  const found = findNodeWithPath(scoped.node, nodeId);
  if (!found) throw new AppError('Arquivo ou pasta não encontrado', 404);
  return found;
}

export async function renameMegaNode(auth: AuthScope, companyId: string | undefined, nodeId: string, name: string) {
  if (companyId) await assertCompanyWriteAccess(companyId, auth);
  if (!companyId && auth.role !== UserRole.ADMIN) throw new AppError('Selecione uma empresa', 422);
  const found = await resolveNodeForAction(auth, companyId, nodeId);
  if (found.node.directory && auth.role !== UserRole.ADMIN) {
    throw new AppError('Somente um administrador pode renomear pastas', 403);
  }
  const cleanName = assertSafeName(name);
  if (!found.node.directory) assertSafeUploadName(cleanName);
  await found.node.rename(cleanName);
  return { id: found.node.nodeId, name: cleanName };
}

export async function deleteMegaNode(auth: AuthScope, companyId: string | undefined, nodeId: string) {
  if (companyId) await assertCompanyWriteAccess(companyId, auth);
  if (!companyId && auth.role !== UserRole.ADMIN) throw new AppError('Selecione uma empresa', 422);
  const found = await resolveNodeForAction(auth, companyId, nodeId);
  if (found.node.directory && auth.role !== UserRole.ADMIN) {
    throw new AppError('Somente um administrador pode mover pastas inteiras para a lixeira', 403);
  }
  await found.node.delete(false);
  return { id: nodeId, name: found.node.name ?? 'Arquivo', type: found.node.directory ? 'folder' : 'file' };
}

export async function getMegaDownload(auth: AuthScope, companyId: string | undefined, nodeId: string) {
  const found = await resolveNodeForAction(auth, companyId, nodeId);
  if (found.node.directory) throw new AppError('Pastas não podem ser baixadas diretamente', 422);
  return { name: found.node.name || 'arquivo', size: found.node.size ?? 0, stream: found.node.download({ forceHttps: true }) };
}

export async function linkCompanyFolder(companyId: string, relativePath: string, auth: AuthScope) {
  if (auth.role === UserRole.EMPRESA) throw new AppError('Você não pode alterar a pasta principal da empresa', 403);
  await assertCompanyWriteAccess(companyId, auth);
  const { integration, storage } = await getCurrentUserStorage(auth);
  const root = await configuredRoot(storage);
  const cleanPath = normalizeSlashes(relativePath);
  const folder = navigateFrom(root, cleanPath);
  if (!folder.directory) throw new AppError('Selecione uma pasta', 422);
  await db.megaCompanyFolder.upsert({
    where: { megaIntegrationId_companyId: { megaIntegrationId: integration.id, companyId } },
    create: { megaIntegrationId: integration.id, companyId, path: cleanPath },
    update: { path: cleanPath }
  });
  return { companyId, megaFolderPath: cleanPath };
}

export async function saveBidFileToMega(
  input: {
    companyId: string;
    companyName: string;
    municipality: string;
    sessionDate: Date;
    noticeNumber: string | null;
    processNumber: string | null;
    bidId: string;
    file: Express.Multer.File;
  },
  auth: AuthScope
) {
  assertSafeUploadFile(input.file);
  await assertCompanyWriteAccess(input.companyId, auth);
  const { integration, storage } = await getCurrentUserStorage(auth);
  const root = await configuredRoot(storage);
  const year = input.sessionDate.getUTCFullYear();
  const municipality = assertSafeName(input.municipality.toLocaleUpperCase('pt-BR'));
  const tenderName = assertSafeName(input.noticeNumber || input.processNumber || `LICITACAO-${input.bidId.slice(0, 8)}`);
  const companyName = assertSafeName(input.companyName);
  const basePath = [env.MEGA_TENDERS_FOLDER, `${env.MEGA_TENDERS_FOLDER} ${year}`, municipality, tenderName, companyName]
    .filter(Boolean)
    .join('/');
  const folder = await ensurePath(root, basePath);
  const fileName = assertSafeName(input.file.originalname);
  const existing = folderChildren(folder).find(
    (node) => !node.directory && (node.name ?? '').toLocaleLowerCase('pt-BR') === fileName.toLocaleLowerCase('pt-BR')
  );
  if (existing) throw new AppError('Já existe um documento com esse nome nesta licitação', 409);
  const uploaded = await folder.upload({ name: fileName, size: input.file.size, forceHttps: true }, input.file.buffer).complete;
  return {
    nodeId: uploaded.nodeId,
    remotePath: `${basePath}/${fileName}`,
    fileName,
    megaIntegrationId: integration.id
  };
}

async function storageForDocument(megaIntegrationId?: string | null) {
  if (!megaIntegrationId) return getLegacyStorage();
  const integration = await db.megaIntegration.findUnique({
    where: { id: megaIntegrationId },
    select: {
      id: true,
      userId: true,
      email: true,
      passwordEncrypted: true,
      connected: true,
      connectedAt: true,
      lastSyncedAt: true,
      lastError: true
    }
  });
  if (!integration) throw new AppError('A conta MEGA responsável por este arquivo não foi encontrada.', 404);
  return getPersonalStorageForIntegration(integration);
}

export async function getMegaNodeById(nodeId: string, megaIntegrationId?: string | null) {
  const storage = await storageForDocument(megaIntegrationId);
  const node = storage.files[nodeId];
  if (!node) throw new AppError('Arquivo não encontrado no MEGA', 404);
  return node;
}

export async function removeMegaNodeById(nodeId: string, megaIntegrationId?: string | null) {
  const node = await getMegaNodeById(nodeId, megaIntegrationId);
  await node.delete(false);
}
