import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { deduplicate, fingerprint, isExcludedMunicipality, normalize, type Candidate } from './discovery-core.js';
import { parseTce, text, TCE_ORIGIN } from './discovery-sources.js';
import { fetchTcePublicDetails } from './discovery-tce-details.js';
import { requireOrganizationId, type AuthScope } from './access.service.js';

const PUBLIC_LIST = `${TCE_ORIGIN}/index.php/licitacao/abertas`;
const MAX_PAGES = 6;
const MAX_DETAILS = 20;
const MAX_RESULTS = 40;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const isConstruction = (object: string) =>
  /(?:\bobra\b|\bobras\b|constru[cç][aã]o|reforma|pavimenta[cç][aã]o|cal[cç]amento|drenagem|saneamento|estrada|ponte|bueiro|infraestrutura|engenharia|amplia[cç][aã]o|edifica[cç][aã]o|creche|escola|pra[cç]a|urbaniza[cç][aã]o|recupera[cç][aã]o de (?:vias|rodovias)|ilumina[cç][aã]o p[uú]blica)/i.test(object);

function municipalityCode(html: string, name: string): string | null {
  const target = normalize(name).trim();
  const selects = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)];
  const matched = selects.filter((part) => /\b(?:name|id)\s*=\s*["']?(?:mun|municipio|municipios)\b/i.test(part[1] ?? ''));
  const candidates = matched.length ? matched : selects;
  for (const select of candidates) {
    for (const option of select[2]!.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
      const value = option[1]?.match(/\bvalue\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
      const id = value?.[1] ?? value?.[2] ?? value?.[3] ?? '';
      const label = normalize(text(option[2] ?? '')).trim();
      if (/^\d{1,8}$/.test(id) && id !== '0' && label === target) return id;
    }
  }
  return null;
}

async function fetchList(body: URLSearchParams | null, page: number, fetcher: typeof fetch, signal: AbortSignal) {
  const url = `${PUBLIC_LIST}${page > 1 ? `/page/${page}` : ''}`;
  const response = await fetcher(url, {
    method: body ? 'POST' : 'GET',
    ...(body ? { body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LicitaGestao/1.0 (consulta TCE-CE)' } }
      : { headers: { 'User-Agent': 'LicitaGestao/1.0 (consulta TCE-CE)' } }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
    redirect: 'error'
  });
  if (!response.ok) throw new Error('O TCE-CE não respondeu à pesquisa');
  if (Number(response.headers.get('content-length') ?? 0) > 3_000_000) throw new Error('Página acima do limite');
  const html = await response.text();
  if (html.length > 3_000_000) throw new Error('Página acima do limite');
  return html;
}

export async function lookupTcePublic(query: string, fetcher: typeof fetch = fetch) {
  const value = query.trim().slice(0, 120);
  if (value.length < 3) throw new AppError('Digite pelo menos 3 caracteres da cidade ou do número da licitação.', 422);
  const isNumber = /\d/.test(value);
  const signal = AbortSignal.timeout(50_000);
  let home: string;
  try { home = await fetchList(null, 1, fetcher, signal); }
  catch { throw new AppError('Não foi possível consultar a página pública do TCE-CE. Tente novamente.', 503); }

  const mun = isNumber ? '0' : municipalityCode(home, value);
  if (!isNumber && !mun) throw new AppError('Município não localizado no formulário público do TCE-CE. Use o nome completo da cidade.', 422);
  const body = new URLSearchParams({ proc: isNumber ? value : '', obj: '', mun: mun ?? '0', periodo: '' });

  let first;
  try { first = parseTce(await fetchList(body, 1, fetcher, signal)); }
  catch { throw new AppError('A consulta pública do TCE-CE não respondeu ao filtro solicitado.', 503); }
  const maxPage = Math.min(MAX_PAGES, first.pages);
  let failed = 0;
  const pages = await Promise.all(Array.from({ length: maxPage - 1 }, async (_, index) => {
    try { return parseTce(await fetchList(body, index + 2, fetcher, signal)).items; }
    catch { failed++; return [] as Candidate[]; }
  }));
  const all = deduplicate([...first.items, ...pages.flat()]);
  const needle = normalize(value).replace(/[^a-z0-9]/g, '');
  const matches = all.filter((item) => {
    if (isExcludedMunicipality(item.municipality) || !isConstruction(item.object)) return false;
    if (!isNumber) return normalize(item.municipality).trim() === normalize(value);
    return normalize(item.reference).replace(/[^a-z0-9]/g, '').includes(needle)
      || normalize(item.processNumber).replace(/[^a-z0-9]/g, '').includes(needle);
  }).slice(0, MAX_RESULTS);
  let detailsFailed = 0;
  let index = 0;
  const enriched = [...matches];
  await Promise.all(Array.from({ length: Math.min(4, Math.min(MAX_DETAILS, enriched.length)) }, async () => {
    while (index < Math.min(MAX_DETAILS, enriched.length)) {
      const at = index++;
      try { enriched[at] = await fetchTcePublicDetails(enriched[at]!, fetcher); }
      catch { detailsFailed++; }
    }
  }));
  return {
    items: enriched,
    pagesChecked: maxPage,
    partial: first.pages > maxPage || failed > 0 || all.length > MAX_RESULTS || detailsFailed > 0,
    notice: failed ? `${failed} página(s) do TCE não responderam.`
      : first.pages > maxPage ? `Foram consultadas ${maxPage} de ${first.pages} páginas. A pesquisa pode ser parcial.`
      : detailsFailed ? `Alguns detalhamentos não responderam (${detailsFailed}).` : ''
  };
}

export async function searchAndSaveTce(query: string, auth: AuthScope) {
  const organizationId = requireOrganizationId(auth);
  const found = await lookupTcePublic(query);
  const items = [];
  for (const candidate of found.items) {
    const hash = fingerprint(candidate);
    const current = await prisma.discoveryOpportunity.findFirst({
      where: { organizationId, OR: [{ sourceKeys: { hasSome: candidate.sourceKeys } }, { fingerprint: hash }] },
      include: { importedTender: { select: { id: true } } }
    });
    if (current) {
      const previous = current.data as unknown as Candidate;
      const item: Candidate = {
        ...previous, ...candidate,
        manualSearch: true,
        documents: candidate.documents?.length ? candidate.documents : previous.documents,
        platformName: candidate.platformName ?? previous.platformName,
        platformUrl: candidate.platformUrl ?? previous.platformUrl,
        platformEvidence: candidate.platformEvidence ?? previous.platformEvidence
      };
      await prisma.discoveryOpportunity.update({ where: { id: current.id }, data: {
        data: json(item), active: true, lastSeenAt: new Date()
      } });
      items.push({ ...item, id: current.id, importedTenderId: current.importedTender?.id ?? null, lastSeenAt: new Date().toISOString() });
    } else {
      const item: Candidate = { ...candidate, manualSearch: true };
      const row = await prisma.discoveryOpportunity.create({ data: {
        organizationId, fingerprint: hash, sourceKeys: item.sourceKeys, data: json(item)
      } });
      items.push({ ...item, id: row.id, importedTenderId: null, lastSeenAt: new Date().toISOString() });
    }
  }
  return { ...found, items };
}
