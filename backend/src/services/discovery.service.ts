import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';
import { organizationHasPaidAccess } from './billing.service.js';
import { reviewWithAi } from './discovery-ai.js';
import { categoryNames, deduplicate, discoverySettings, fingerprint, matches, platformKey, platformGroup, type Platform, type Candidate, type DiscoverySettings, type Source } from './discovery-core.js';
import { collectSources, validSourceLink, type Collection } from './discovery-sources.js';
import { enrichPncpDocuments } from './discovery-documents.js';
import { mergeOfficialEdict, readOfficialEdict } from './discovery-edital.js';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function discoveryScope(auth: AuthScope) {
  if (auth.role === UserRole.EMPRESA) throw new AppError('Esta área é destinada à equipe interna da conta', 403);
  return requireOrganizationId(auth);
}
// Cache contém somente publicações públicas, sem perfis ou dados de clientes.
const publicCache = new Map<string, { at: number; value: Promise<Collection> }>();
async function publicCollection(sources: Source[], lastDate: string | null) {
  const key = [...sources].sort().join(',') + '|' + (lastDate ?? 'padrao'); const entry = publicCache.get(key);
  if (entry && Date.now() - entry.at < 600000) return entry.value;
  const value = collectSources(sources, fetch, new Date(), AbortSignal.timeout(240000), lastDate);
  publicCache.set(key, { at: Date.now(), value });
  const result = await value;
  if (result.reports.some((r) => !r.complete)) publicCache.delete(key);
  return result;
}
export async function getDiscoveryStatus(auth: AuthScope) {
  const organizationId = discoveryScope(auth);
  const [profile, run] = await Promise.all([
    prisma.discoveryProfile.findUnique({ where: { userId: auth.userId } }),
    prisma.discoveryRun.findFirst({ where: { organizationId }, orderBy: { startedAt: 'desc' } })
  ]);
  let currentRun = run;
  if (run?.status === 'RUNNING' && Date.now() - run.startedAt.getTime() > 10 * 60000) {
    await prisma.discoveryRun.updateMany({ where: { id: run.id, organizationId, status: 'RUNNING' }, data: { status: 'FAILED', progress: 'Busca interrompida. Execute uma nova consulta.', finishedAt: new Date() } });
    currentRun = { ...run, status: 'FAILED', progress: 'Busca interrompida. Execute uma nova consulta.', finishedAt: new Date() };
  }
  return { settings: discoverySettings.parse(profile?.organizationId === organizationId ? profile.settings : {}), run: currentRun, aiAvailable: Boolean(env.TENDER_AI_API_KEY) };
}
export async function saveDiscoverySettings(input: DiscoverySettings, auth: AuthScope) {
  const organizationId = discoveryScope(auth); const settings = discoverySettings.parse(input);
  await prisma.discoveryProfile.upsert({ where: { userId: auth.userId }, create: { organizationId, userId: auth.userId, settings: json(settings), enabled: settings.enabled }, update: { organizationId, settings: json(settings), enabled: settings.enabled } });
  return settings;
}
export async function listOpportunities(auth: AuthScope, page = 1, settings?: DiscoverySettings, platform?: string) {
  const organizationId = discoveryScope(auth);
  const filter = settings ?? (await getDiscoveryStatus(auth)).settings;
  const rows = await prisma.discoveryOpportunity.findMany({ where: { organizationId, active: true }, include: { importedTender: { select: { id: true } } }, orderBy: { lastSeenAt: 'desc' }, take: 3000 });
  const matched = rows.map((row) => ({ ...(row.data as unknown as Candidate), id: row.id, firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt, importedTenderId: row.importedTender?.id ?? null })).filter((row) => matches(row, filter));
  const platformCounts: Partial<Record<Platform, number>> = {};
  const grouped = new Map<string, { key: string; title: string; count: number }>();
  for (const item of matched) {
    const legacy = platformKey(item.platformName);
    platformCounts[legacy] = (platformCounts[legacy] ?? 0) + 1;
    const group = platformGroup(item);
    const entry = grouped.get(group.key);
    if (entry) entry.count++;
    else grouped.set(group.key, { ...group, count: 1 });
  }
  const platformGroups = [...grouped.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'pt-BR'));
  const items = platform ? matched.filter((item) => platformGroup(item).key === platform) : matched;
  items.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.municipality.localeCompare(b.municipality));
  return { items: items.slice((page - 1) * 20, page * 20), total: items.length, allTotal: matched.length, platformCounts, platformGroups, page, pages: Math.ceil(items.length / 20), limited: rows.length === 3000 };
}
export async function opportunityDraft(id: string, auth: AuthScope) {
  const row = await prisma.discoveryOpportunity.findFirst({ where: { id, organizationId: discoveryScope(auth), active: true }, include: { importedTender: { select: { id: true } } } });
  if (!row) throw new AppError('Oportunidade não encontrada nesta conta', 404);
  if (row.importedTender) throw new AppError('Esta oportunidade já foi adicionada ao controle', 409);
  const data = row.data as unknown as Candidate;
  if (!data || data.state !== 'CE' || !data.sources?.length || !data.sources.every((s) => validSourceLink(s.url))) throw new AppError('Dados da fonte inválidos', 422);
  const base = { opportunityId: row.id, municipality: data.municipality, modality: data.modality, noticeNumber: data.reference, processNumber: data.processNumber, sessionDate: data.sessionDate, object: data.object, estimatedValue: data.estimatedValue?.toString() ?? '', platformLink: data.platformUrl ?? data.sources[0]!.url, platformName: data.platformName ?? '', sourceLabel: data.sources.map((s) => s.source === 'TCE' ? 'TCE-CE' : 'PNCP').join(' / ') };
  // Pré-seleciona a plataforma já cadastrada quando a correspondência for inequívoca.
  const registered = await prisma.platform.findMany({ where: { organizationId: row.organizationId, active: true }, select: { id: true, name: true } });
  const identified = platformKey(data.platformName);
  const matchedPlatforms = registered.filter((p) => identified !== 'NAO_INFORMADA' && identified !== 'OUTRAS' ? platformKey(p.name) === identified : Boolean(data.platformName && p.name.trim().toLowerCase() === data.platformName.trim().toLowerCase()));
  if (matchedPlatforms.length === 1) Object.assign(base, { platformId: matchedPlatforms[0]!.id });
  // Não bloqueia a inclusão quando a IA ou o edital estiver indisponível.
  const reading = await readOfficialEdict(data);
  return { ...(reading.extracted ? mergeOfficialEdict(base, reading.extracted) : base), sourceLabel: `${base.sourceLabel}. ${reading.note}`, edictDocumentUrl: reading.documentUrl, edictEvidence: reading.extracted?.evidence ?? '' };
}
export async function checkOpportunityPhase(id: string, auth: AuthScope) {
  const organizationId = discoveryScope(auth);
  const row = await prisma.discoveryOpportunity.findFirst({ where: { id, organizationId, active: true } });
  if (!row) throw new AppError('Oportunidade não encontrada nesta conta', 404);
  // A verificacao deve ler a informacao diretamente na tela inicial da M2A.
  // A antiga analise de PDFs nao satisfaz essa regra e foi desativada.
  const item = row.data as unknown as Candidate;
  if (platformKey(item.platformName) !== 'M2A') throw new AppError('A fase inversa será consultada apenas na M2A.', 422);
  throw new AppError('A consulta de fase inversa na M2A ainda depende da ativação do conector autorizado.', 501);
}
export async function startDiscoveryScan(auth: AuthScope, input?: DiscoverySettings) {
  const organizationId = discoveryScope(auth);
  const settings = input ? await saveDiscoverySettings(input, auth) : (await getDiscoveryStatus(auth)).settings;
  // Execuções abandonadas por um reinício são liberadas. Cada coleta tem limite de 4 minutos.
  await prisma.discoveryRun.updateMany({ where: { organizationId, status: 'RUNNING', startedAt: { lt: new Date(Date.now() - 10 * 60000) } }, data: { status: 'FAILED', progress: 'Execução interrompida; tente novamente.', finishedAt: new Date() } });
  const latest = await prisma.discoveryRun.findFirst({ where: { organizationId }, orderBy: { startedAt: 'desc' } });
  if (latest?.status === 'RUNNING') return latest;
  if (latest && Date.now() - latest.startedAt.getTime() < 60000) throw new AppError('Aguarde um minuto entre as buscas desta conta.', 429);
  let run;
  try { run = await prisma.discoveryRun.create({ data: { organizationId, userId: auth.userId } }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('Já há uma busca em andamento nesta conta.', 409);
    throw error;
  }
  await prisma.discoveryProfile.updateMany({ where: { userId: auth.userId, organizationId }, data: { lastRunAt: new Date() } });
  void executeScan(run.id, auth, settings).catch(() => console.error('Falha ao finalizar busca de oportunidades.'));
  return run;
}
async function executeScan(runId: string, auth: AuthScope, settings: DiscoverySettings) {
  const organizationId = requireOrganizationId(auth);
  try {
    const collection = await publicCollection(settings.sources, settings.sessionTo);
    const warnings = collection.reports.filter((r) => !r.complete).map((r) => `${r.source === 'TCE' ? 'TCE-CE' : r.source}: ${r.message}`);
    if (collection.reports.every((r) => r.pages === 0 && !r.complete)) throw new AppError('As fontes não responderam. Os resultados anteriores foram preservados.', 503);
    await prisma.discoveryRun.update({ where: { id: runId }, data: { progress: 'Classificando e organizando os resultados', reports: json(collection.reports) } });
    const candidates = deduplicate(collection.items).filter((item) => matches(item, settings));
    const reviewed = await reviewWithAi(candidates, settings);
    // Metadados de editais PNCP são coletados automaticamente, limitados para não
    // consumir toda a janela de busca. Os arquivos são baixados sob demanda.
    const documentWarnings = await enrichPncpDocuments(reviewed.items, 40);
    warnings.push(...documentWarnings);
    if (reviewed.warning) warnings.push(reviewed.warning);
    let addedCount = 0;
    for (const item of reviewed.items) {
      if (!item.aiReviewed) item.reason = `${item.categories.map((c) => categoryNames[c]).join(' / ')} identificado no objeto publicado. Confira as condições no edital.`;
      const hash = fingerprint(item);
      const current = await prisma.discoveryOpportunity.findFirst({ where: { organizationId, OR: [{ sourceKeys: { hasSome: item.sourceKeys } }, { fingerprint: hash }] } });
      if (current) {
        const previous = current.data as unknown as Candidate;
        const merged = { ...item, documents: item.documents?.length ? item.documents : previous.documents ?? [], phaseStatus: previous.phaseStatus && previous.phaseStatus !== 'NAO_IDENTIFICADA' ? previous.phaseStatus : item.phaseStatus ?? 'NAO_IDENTIFICADA', phaseEvidence: previous.phaseEvidence ?? item.phaseEvidence, phaseCheckedAt: previous.phaseCheckedAt ?? item.phaseCheckedAt, platformUrl: item.platformUrl ?? previous.platformUrl ?? null, platformName: item.platformName ?? previous.platformName ?? null, sourceKeys: [...new Set([...previous.sourceKeys, ...item.sourceKeys])], sources: [...previous.sources.filter((s) => !item.sources.some((n) => n.url === s.url)), ...item.sources] };
        await prisma.discoveryOpportunity.update({ where: { id: current.id }, data: { data: json(merged), sourceKeys: merged.sourceKeys, active: true, lastSeenAt: new Date() } });
      } else {
        await prisma.discoveryOpportunity.create({ data: { organizationId, fingerprint: hash, sourceKeys: item.sourceKeys, data: json(item) } }); addedCount++;
      }
    }
    // Só retira uma publicação ausente quando TODAS as suas fontes foram consultadas integralmente.
    const completeSources = new Set(collection.reports.filter((r) => r.complete).map((r) => r.source));
    const seen = new Set(collection.items.flatMap((item) => item.sourceKeys));
    const old = await prisma.discoveryOpportunity.findMany({ where: { organizationId, active: true }, select: { id: true, data: true, sourceKeys: true } });
    const absent = old.filter((row) => {
      const data = row.data as unknown as Candidate;
      return data.sources?.length && data.sources.every((s) => completeSources.has(s.source)) && !row.sourceKeys.some((key) => seen.has(key));
    }).map((row) => row.id);
    if (absent.length) await prisma.discoveryOpportunity.updateMany({ where: { id: { in: absent }, organizationId }, data: { active: false } });
    if (addedCount) await prisma.userNotification.create({ data: { userId: auth.userId, title: 'Novas licitações no Ceará', message: `${addedCount} nova(s) oportunidade(s) correspondem aos filtros da sua busca.`, link: '/oportunidades' } });
    await prisma.discoveryRun.update({ where: { id: runId }, data: { status: warnings.length ? 'PARTIAL' : 'COMPLETED', progress: 'Busca concluída', reports: json(collection.reports), warnings, addedCount, finishedAt: new Date() } });
  } catch (error) {
    await prisma.discoveryRun.update({ where: { id: runId }, data: { status: 'FAILED', progress: 'Não foi possível concluir a busca', warnings: [error instanceof AppError ? error.message : 'Falha ao consultar as fontes. Tente novamente.'], finishedAt: new Date() } });
  }
}
let timer: ReturnType<typeof setInterval> | undefined; let polling = false;
export async function pollDiscoveryProfiles() {
  if (polling) return; polling = true;
  try {
    const profiles = await prisma.discoveryProfile.findMany({ where: { enabled: true, user: { active: true }, organization: { active: true } }, include: { user: { select: { id: true, role: true, companyId: true } }, organization: true }, take: 100, orderBy: { lastRunAt: { sort: 'asc', nulls: 'first' } } });
    for (const profile of profiles) {
      if (!organizationHasPaidAccess(profile.organization) || profile.user.role === 'EMPRESA') continue;
      const settings = discoverySettings.safeParse(profile.settings); if (!settings.success) continue;
      if (profile.lastRunAt && Date.now() - profile.lastRunAt.getTime() < settings.data.intervalHours * 3600000) continue;
      await startDiscoveryScan({ userId: profile.user.id, role: profile.user.role, companyId: profile.user.companyId, organizationId: profile.organizationId }).catch(() => undefined);
    }
  } finally { polling = false; }
}
export function startDiscoveryPolling() {
  if (timer) return;
  timer = setInterval(() => { void pollDiscoveryProfiles().catch(() => console.error('Não foi possível verificar buscas programadas.')); }, 60000);
  timer.unref();
}
export function stopDiscoveryPolling() { if (timer) clearInterval(timer); timer = undefined; }
