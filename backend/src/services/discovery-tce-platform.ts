import { matches, type Candidate, type DiscoverySettings } from './discovery-core.js';
import { TCE_ORIGIN, text } from './discovery-sources.js';

/**
 * Identifica a plataforma exclusivamente nos campos do DETALHAMENTO do TCE.
 * Nomes que aparecem no objeto, em anexos ou no cabeçalho da página não
 * comprovam qual portal conduz a disputa.
 */
const PROVIDERS = [
  { name: 'BLL Compras', match: /\b(?:bll\s*compras|bllcompras|bll\.org\.br|bllcompras\.com(?:\.br)?)\b/i },
  { name: 'M2A Compras', match: /\b(?:m2a\s*(?:compras|tecnologia)|compras\.m2atecnologia\.com\.br|precodereferencia\.m2atecnologia\.com\.br)\b/i },
  { name: 'Licita Mais', match: /\b(?:licita\s*mais|licitamais(?:brasil)?\.com\.br)\b/i },
  { name: 'Licitanet', match: /\b(?:licitanet|licitanet\.com\.br)\b/i },
  { name: 'Portal de Compras Públicas', match: /\b(?:portal\s*de\s*compras\s*p[uú]blicas|portaldecompraspublicas\.com\.br)\b/i },
  { name: 'Compras.gov.br', match: /\b(?:compras\.gov\.br|comprasnet\.gov\.br|compras\s*gov\s*br|comprasnet)\b/i },
  { name: 'BBMNET', match: /\b(?:bbmnet|bbm\s*net)\b/i },
  { name: 'Licitações-e', match: /\b(?:licita[cç][oõ]es[- ]e|licitacoes-e2\.bb\.com\.br)\b/i },
  { name: 'Licita Digital', match: /\b(?:licita\s*digital|licitadigital\.com\.br)\b/i },
  { name: 'BNC Compras', match: /\b(?:bnc\s*compras|bnccompras\.com)\b/i }
] as const;

const DETAILS = /^https:\/\/municipios-licitacoes\.tce\.ce\.gov\.br\/index\.php\/licitacao\/detalhes\/proc\/\d+\/licit\/\d+$/i;
export type TcePlatformMatch = { platformName: string; platformUrl: string | null; platformEvidence: string } | null;

function trustedPlatformLink(value: string, name: string): string | null {
  const url = value.match(/https:\/\/[^\s"'<>),;]+/i)?.[0];
  if (!url) return null;
  try {
    const candidate = new URL(url);
    if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.search || candidate.hash) return null;
    const provider = PROVIDERS.find((p) => p.name === name);
    return provider?.match.test(candidate.hostname) ? candidate.origin + candidate.pathname : null;
  } catch { return null; }
}

export function identifyTcePlatform(html: string): TcePlatformMatch {
  const readable = text(html).slice(0, 120000);
  // O campo Local da licitação é a indicação mais específica do portal.
  const local = readable.match(/\bLocal\s*:\s*([\s\S]{1,450}?)(?=\bForma de Publica[cç][aã]o\b|\bForma de Publicacao\b|\bÓrgãos\b|\bOrgaos\b|$)/i)?.[1]?.trim() ?? '';
  for (const provider of PROVIDERS) {
    if (provider.match.test(local)) return {
      platformName: provider.name,
      platformUrl: trustedPlatformLink(local, provider.name),
      platformEvidence: `TCE-CE · Local: ${local.slice(0, 170)}`
    };
  }
  // Publicações em PNCP, Diário Oficial ou na prefeitura NÃO são prova de
  // plataforma. O nome de um portal de disputa precisa estar explícito.
  const section = readable.match(/\bForma de Publica[cç][aã]o\b([\s\S]*?)(?=\bÓrgãos\b|\bOrgaos\b|\bObjeto\/Lotes\b|$)/i)?.[1] ?? '';
  for (const provider of PROVIDERS) {
    if (provider.match.test(section)) return {
      platformName: provider.name,
      platformUrl: null,
      platformEvidence: `TCE-CE · Forma de Publicação: ${provider.name}`
    };
  }
  return null;
}

function detailsUrl(item: Candidate): string | null {
  const source = item.sources.find((s) => s.source === 'TCE' && DETAILS.test(s.url));
  return source?.url ?? null;
}

export type TceEnrichmentReport = { checked: number; identified: number; eligible: number; skipped: number; failed: number };

/** Nunca consulta domínios fornecidos nos editais; só páginas fixas do TCE. */
export async function enrichTcePlatforms(
  items: Candidate[],
  settings: DiscoverySettings,
  fetcher: typeof fetch = fetch,
  onProgress?: (message: string) => Promise<void> | void,
  maxDetails = 90
): Promise<TceEnrichmentReport> {
  // Primeiro filtra obras, valor, data e município. A plataforma ainda é
  // desconhecida, por isso o filtro de plataforma só é aplicado DEPOIS.
  const eligible = items.filter((item) =>
    item.sources.some((s) => s.source === 'TCE')
    && matches(item, { ...settings, sources: ['TCE'], platforms: [] })
  ).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const selected = eligible.filter(detailsUrl).slice(0, Math.max(0, Math.min(150, maxDetails)));
  let checked = 0; let identified = 0; let failed = 0; let cursor = 0;
  const workers = Array.from({ length: Math.min(5, selected.length) }, async () => {
    while (cursor < selected.length) {
      const item = selected[cursor++];
      if (!item) return;
      const url = detailsUrl(item);
      if (!url) continue;
      try {
        const response = await fetcher(url, {
          signal: AbortSignal.timeout(7000), redirect: 'error',
          headers: { 'User-Agent': 'LicitaGestao/1.0 (consulta publica TCE-CE)' }
        });
        if (!response.ok) throw new Error('HTTP indisponível');
        const body = await response.text();
        if (body.length > 1_200_000) throw new Error('Documento acima do limite');
        const matched = identifyTcePlatform(body);
        if (matched) {
          item.platformName = matched.platformName;
          item.platformUrl = matched.platformUrl;
          item.platformEvidence = matched.platformEvidence;
          identified++;
        }
      } catch { failed++; }
      checked++;
      if (checked === selected.length || checked % 15 === 0) {
        try { await onProgress?.(`TCE-CE: identificando plataformas (${checked}/${selected.length} detalhes; ${identified} identificadas)`); }
        catch { /* progresso informativo */ }
      }
    }
  });
  await Promise.all(workers);
  return { checked, identified, eligible: eligible.length, skipped: Math.max(0, eligible.length - selected.length), failed };
}
