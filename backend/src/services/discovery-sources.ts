import { brDate, classify, safeUrl, validDate, type Candidate, type Source } from './discovery-core.js';

export const TCE_ORIGIN = 'https://municipios-licitacoes.tce.ce.gov.br';
// A plataforma da disputa é diferente do portal que publicou a notícia.
// Não acessamos essas URLs no servidor: são apenas links HTTPS exibidos ao usuário.
export function platformFromOrigin(raw: unknown): { platformName: string | null; platformUrl: string | null } {
  const url = safeUrl(raw);
  if (!url || url.length > 512) return { platformName: null, platformUrl: null };
  const hostname = new URL(url).hostname.toLowerCase();
  const known: Array<[RegExp, string]> = [
    [/^(.*\.)?bll(compras)?\.(org\.br|com\.br|com)$/, 'BLL Compras'],
    [/^(.*\.)?m2atecnologia\.com\.br$/, 'M2A Tecnologia'],
    [/^(.*\.)?licitamais(brasil)?\.com\.br$/, 'Licita Mais'],
    [/^(.*\.)?(compras\.gov\.br|comprasnet\.gov\.br)$/, 'Compras.gov.br'],
    [/^(.*\.)?portaldecompraspublicas\.com\.br$/, 'Portal de Compras Públicas'],
    [/^(.*\.)?licitanet\.com\.br$/, 'Licitanet'],
    [/^(.*\.)?bbmnet\.com\.br$/, 'BBMNET'],
    [/^(.*\.)?licitacoes-e2\.bb\.com\.br$/, 'Licitações-e']
  ];
  // Links para o PNCP identificam a fonte, não o local da disputa.
  if (hostname === 'pncp.gov.br' || hostname.endsWith('.pncp.gov.br')) return { platformName: null, platformUrl: null };
  return { platformName: known.find(([pattern]) => pattern.test(hostname))?.[1] ?? hostname, platformUrl: url };
}

export type SourceReport = { source: Source; pages: number; records: number; complete: boolean; message: string };
export type Collection = { items: Candidate[]; reports: SourceReport[] };
export function text(html: string) {
  const entities: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ccedil: 'ç', Ccedil: 'Ç', atilde: 'ã', otilde: 'õ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ecirc: 'ê', acirc: 'â', ocirc: 'ô' };
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => { const v = n[0]?.toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return v <= 0x10ffff && v > 0 ? String.fromCodePoint(v) : ''; }).replace(/&([a-z]+);/gi, (all, name: string) => entities[name] ?? all).replace(/\s+/g, ' ').trim();
}
export function parseTce(html: string): { items: Candidate[]; pages: number } {
  if (!/Valor Estimado/i.test(text(html))) throw new Error('O TCE-CE não retornou a tabela pública esperada.');
  const items: Candidate[] = [];
  let detailRows = 0;
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    if (cells.length < 7) continue;
    const link = cells[0]!.match(/href=["']([^"']*\/licitacao\/detalhes\/proc\/(\d+)\/licit\/(\d+))[^"']*["']/i);
    if (!link) continue;
    detailRows++;
    const sessionDate = brDate(text(cells[5]!)) ?? brDate(text(cells[4]!));
    const object = text(cells[2]!);
    if (!sessionDate || !object) continue;
    const amountText = text(cells[6]!).replace(/R\$|\s/g, '');
    const value = /^\d{1,3}(\.\d{3})*,\d{2}$|^\d+,\d{2}$/.test(amountText) ? Number(amountText.replace(/\./g, '').replace(',', '.')) : null;
    const key = `TCE:${link[2]}:${link[3]}`;
    items.push({ key, sourceKeys: [key], sources: [{ source: 'TCE', url: `${TCE_ORIGIN}/index.php/licitacao/detalhes/proc/${link[2]}/licit/${link[3]}` }], municipality: text(cells[1]!), state: 'CE', reference: text(cells[0]!), processNumber: '', agency: '', modality: '', object, estimatedValue: value && Number.isFinite(value) ? value : null, sessionDate, sessionTime: null, publishedDate: brDate(text(cells[3]!)), categories: classify(object), phaseStatus: 'NAO_IDENTIFICADA', reason: 'Objeto e dados publicados pelo TCE-CE.', aiReviewed: false });
  }
  if (detailRows > 0 && items.length === 0) throw new Error('Não foi possível interpretar os dados da tabela do TCE-CE.');
  const pages = Math.max(1, ...[...html.matchAll(/\/licitacao\/abertas\/page\/(\d+)/g)].map((m) => Number(m[1])));
  return { items, pages };
}
export function parsePncp(body: unknown): { items: Candidate[]; pages: number } {
  if (!body || typeof body !== 'object' || !Array.isArray((body as any).data)) throw new Error('Resposta inesperada do PNCP.');
  const data = body as { data: any[]; totalPaginas?: number };
  const items: Candidate[] = [];
  for (const item of data.data) {
    if (item.unidadeOrgao?.ufSigla !== 'CE' || (item.situacaoCompraId != null && String(item.situacaoCompraId) !== '1')) continue;
    const sessionDate = validDate(String(item.dataEncerramentoProposta ?? '').slice(0, 10));
    const cnpj = String(item.orgaoEntidade?.cnpj ?? '');
    if (!sessionDate || !/^\d{14}$/.test(cnpj) || !item.numeroControlePNCP || !Number.isInteger(item.anoCompra) || !Number.isInteger(item.sequencialCompra) || typeof item.objetoCompra !== 'string') continue;
    const key = `PNCP:${String(item.numeroControlePNCP).slice(0, 100)}`;
    const amount = Number(item.valorTotalEstimado);
    const platform = platformFromOrigin(item.linkSistemaOrigem);
    items.push({ key, sourceKeys: [key], sources: [{ source: 'PNCP', url: `https://pncp.gov.br/app/editais/${cnpj}/${item.anoCompra}/${item.sequencialCompra}` }], municipality: String(item.unidadeOrgao.municipioNome ?? ''), state: 'CE', reference: String(item.numeroCompra ?? '').slice(0, 120), processNumber: String(item.processo ?? '').slice(0, 120), agency: String(item.orgaoEntidade.razaoSocial ?? ''), modality: String(item.modalidadeNome ?? ''), object: item.objetoCompra.slice(0, 10000), estimatedValue: amount > 0 && Number.isFinite(amount) ? amount : null, sessionDate, sessionTime: /^\d\d:\d\d/.test(String(item.dataEncerramentoProposta).slice(11)) ? String(item.dataEncerramentoProposta).slice(11, 16) : null, publishedDate: validDate(String(item.dataPublicacaoPncp ?? '').slice(0, 10)), categories: classify(item.objetoCompra), phaseStatus: 'NAO_IDENTIFICADA', reason: 'Objeto e dados publicados pelo PNCP.', aiReviewed: false, ...platform });
  }
  return { items, pages: Math.max(1, Number(data.totalPaginas) || 1) };
}
async function read(response: Response) {
  if (!response.ok) throw new Error(`Consulta indisponível (HTTP ${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 3_000_000) throw new Error('Resposta da fonte acima do limite.'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
// Endpoints oficiais fixos. Nenhuma URL enviada por usuários ou pela IA é consultada.
// Cada fonte possui seu próprio limite; a lentidão de uma não bloqueia a outra.
export type DiscoveryProgress = (message: string) => Promise<void> | void;
const MAX_SOURCE_TIME_MS = 70_000;
const PAGE_TIMEOUT_MS = 9_000;
const MAX_PNCP_PAGES_PER_MODALITY = 8;
const MAX_TCE_PAGES_PER_TERM = 3;
const TCE_TERMS = [
  'OBRA', 'CONSTRU', 'REFORMA', 'PAVIMENTA', 'CALÇAMENTO', 'ENGENHARIA',
  'DRENAGEM', 'SANEAMENTO', 'ESTRADA', 'ESCOLA', 'CRECHE', 'ILUMINA', 'PONTE', 'ABASTECIMENTO'
];

function sourceError(error: unknown) {
  if (error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`)) {
    return 'Tempo de consulta esgotado. Os resultados já obtidos foram preservados.';
  }
  return error instanceof Error ? error.message.slice(0, 160) : 'Fonte temporariamente indisponível.';
}

export async function collectSources(
  sources: Source[], fetcher: typeof fetch = fetch, now = new Date(),
  signal = AbortSignal.timeout(95_000), lastDate?: string | null,
  onProgress?: DiscoveryProgress
): Promise<Collection> {
  const selected = [...new Set(sources)].sort((a, b) => a === 'PNCP' ? -1 : b === 'PNCP' ? 1 : 0);
  const reports: SourceReport[] = selected.map((source) => ({ source, pages: 0, records: 0, complete: true, message: '' }));
  const collected = await Promise.all(selected.map(async (source, index) => {
    const items: Candidate[] = [];
    const report = reports[index]!;
    const sourceSignal = AbortSignal.any([signal, AbortSignal.timeout(MAX_SOURCE_TIME_MS)]);
    const notify = async (message: string) => {
      // O progresso é informativo: uma falha de escrita no status não cancela a consulta.
      try { await onProgress?.(message); } catch { /* não impede a pesquisa */ }
    };
    try {
      if (source === 'PNCP') {
        const end = (lastDate && validDate(lastDate)
          ? lastDate : new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10)).replace(/-/g, '');
        // O código da modalidade evita respostas 400/422 e permite consultar obras
        // publicadas como concorrência e pregão em vez de depender de uma única listagem.
        for (const [modality, label] of [['4', 'Concorrência'], ['6', 'Pregão'], ['8', 'Dispensa']] as const) {
          await notify(`PNCP: consultando ${label.toLowerCase()} (${report.pages} página(s) obtidas)`);
          try {
            for (let page = 1; page <= MAX_PNCP_PAGES_PER_MODALITY; page++) {
            if (sourceSignal.aborted) throw new Error('Tempo máximo da fonte atingido.');
            const url = new URL('https://pncp.gov.br/api/consulta/v1/contratacoes/proposta');
            url.search = new URLSearchParams({
              dataFinal: end, codigoModalidadeContratacao: modality,
              uf: 'CE', pagina: String(page), tamanhoPagina: '50'
            }).toString();
            const response = await fetcher(url, {
              signal: AbortSignal.any([sourceSignal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
              headers: { 'User-Agent': 'LicitaGestao/1.0 (consulta publica de editais)' }, redirect: 'error'
            });
            if (response.status === 204) break;
            const parsed = parsePncp(JSON.parse(await read(response)));
            items.push(...parsed.items);
            report.pages++; report.records += parsed.items.length;
            if (page === 1 || page % 3 === 0) await notify(`PNCP: ${report.pages} página(s), ${report.records} registro(s)`);
            if (page >= parsed.pages) break;
            if (page === MAX_PNCP_PAGES_PER_MODALITY) {
              report.complete = false;
              report.message = 'Limite de páginas do PNCP atingido; refine o período para uma busca mais abrangente.';
            }
            }
          } catch (error) {
            report.complete = false;
            report.message = `${label}: ${sourceError(error)}`;
            if (sourceSignal.aborted) break;
          }
        }
        if (sourceSignal.aborted) throw new Error('Tempo máximo da fonte atingido.');
      } else {
        // Pesquisa textual ampla com concorrência limitada e uma janela de tempo própria.
        // Os termos são deduplicados posteriormente pelo identificador da publicação.
        let cursor = 0;
        const workers = Array.from({ length: 3 }, async () => {
          while (cursor < TCE_TERMS.length && !sourceSignal.aborted) {
            const term = TCE_TERMS[cursor++];
            if (!term) break;
            await notify(`TCE-CE: pesquisando ${term.toLowerCase()} (${report.pages} página(s) obtidas)`);
            try {
              for (let page = 1; page <= MAX_TCE_PAGES_PER_TERM; page++) {
                if (sourceSignal.aborted) throw new Error('Tempo máximo da fonte atingido.');
                const url = `${TCE_ORIGIN}/index.php/licitacao/abertas${page > 1 ? `/page/${page}` : ''}`;
                const response = await fetcher(url, {
                  method: 'POST', body: new URLSearchParams({ proc: '', obj: term, mun: '0', periodo: '' }),
                  signal: AbortSignal.any([sourceSignal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
                  headers: { 'User-Agent': 'LicitaGestao/1.0 (consulta publica de editais)' }, redirect: 'error'
                });
                const parsed = parseTce(await read(response));
                items.push(...parsed.items);
                report.pages++; report.records += parsed.items.length;
                if (page >= parsed.pages) break;
                if (page === MAX_TCE_PAGES_PER_TERM) {
                  report.complete = false;
                  report.message = 'Limite de páginas do TCE-CE por termo atingido; a pesquisa pode ser parcial.';
                }
              }
            } catch (error) {
              report.complete = false;
              // Erros isolados não impedem que as demais palavras-chave sejam consultadas.
              report.message = `${term}: ${sourceError(error)}`;
              if (sourceSignal.aborted) break;
            }
          }
        });
        await Promise.all(workers);
        if (sourceSignal.aborted) throw new Error('Tempo máximo da fonte atingido.');
      }
    } catch (error) {
      report.complete = false;
      report.message = sourceError(error);
    } finally {
      await notify(`${source === 'PNCP' ? 'PNCP' : 'TCE-CE'}: ${report.pages} página(s), ${report.records} registro(s) — ${report.complete ? 'concluído' : 'parcial'}`);
    }
    return items;
  }));
  return { items: collected.flat(), reports };
}
export function validSourceLink(url: string) {
  const safe = safeUrl(url); if (!safe) return false;
  const u = new URL(safe);
  return (u.hostname === 'pncp.gov.br' && u.pathname.startsWith('/app/editais/')) || (u.hostname === 'municipios-licitacoes.tce.ce.gov.br' && /^\/index.php\/licitacao\/detalhes\/proc\/\d+\/licit\/\d+$/.test(u.pathname));
}
