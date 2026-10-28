import { setTimeout as wait } from 'node:timers/promises';
import { brDate, classify, safeUrl, validDate, type Candidate, type Source } from './discovery-core.js';

export const TCE_ORIGIN = 'https://municipios-licitacoes.tce.ce.gov.br';
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
    items.push({ key, sourceKeys: [key], sources: [{ source: 'TCE', url: `${TCE_ORIGIN}/index.php/licitacao/detalhes/proc/${link[2]}/licit/${link[3]}` }], municipality: text(cells[1]!), state: 'CE', reference: text(cells[0]!), processNumber: '', agency: '', modality: '', object, estimatedValue: value && Number.isFinite(value) ? value : null, sessionDate, sessionTime: null, publishedDate: brDate(text(cells[3]!)), categories: classify(object), reason: 'Objeto e dados publicados pelo TCE-CE.', aiReviewed: false });
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
    items.push({ key, sourceKeys: [key], sources: [{ source: 'PNCP', url: `https://pncp.gov.br/app/editais/${cnpj}/${item.anoCompra}/${item.sequencialCompra}` }], municipality: String(item.unidadeOrgao.municipioNome ?? ''), state: 'CE', reference: String(item.numeroCompra ?? '').slice(0, 120), processNumber: String(item.processo ?? '').slice(0, 120), agency: String(item.orgaoEntidade.razaoSocial ?? ''), modality: String(item.modalidadeNome ?? ''), object: item.objetoCompra.slice(0, 10000), estimatedValue: amount > 0 && Number.isFinite(amount) ? amount : null, sessionDate, sessionTime: /^\d\d:\d\d/.test(String(item.dataEncerramentoProposta).slice(11)) ? String(item.dataEncerramentoProposta).slice(11, 16) : null, publishedDate: validDate(String(item.dataPublicacaoPncp ?? '').slice(0, 10)), categories: classify(item.objetoCompra), reason: 'Objeto e dados publicados pelo PNCP.', aiReviewed: false });
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
// Somente endpoints públicos fixos. Nunca busca URLs fornecidas por usuários ou pela IA.
export async function collectSources(sources: Source[], fetcher: typeof fetch = fetch, now = new Date(), signal = AbortSignal.timeout(240000)): Promise<Collection> {
  const items: Candidate[] = []; const reports: SourceReport[] = [];
  for (const source of [...new Set(sources)]) {
    const report: SourceReport = { source, pages: 0, records: 0, complete: true, message: '' };
    reports.push(report);
    try {
      if (source === 'PNCP') {
        const end = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
        for (let page = 1; page <= 25; page++) {
          const url = new URL('https://pncp.gov.br/api/consulta/v1/contratacoes/proposta');
          url.search = new URLSearchParams({ dataFinal: end, uf: 'CE', pagina: String(page), tamanhoPagina: '50' }).toString();
          const response = await fetcher(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), headers: { 'User-Agent': 'LicitaGestao/1.0 (consulta publica de editais)' }, redirect: 'error' });
          if (response.status === 204) break;
          const parsed = parsePncp(JSON.parse(await read(response)));
          items.push(...parsed.items); report.pages++; report.records += parsed.items.length;
          if (page >= parsed.pages) break;
          if (page === 25) { report.complete = false; report.message = 'Consulta parcial: limite de 25 páginas do PNCP atingido.'; }
        }
      } else {
        // A busca textual do próprio TCE reduz a carga e evita varrer páginas antigas.
        for (const term of ['PAVIMENTA', 'CALÇAMENTO', 'ESCOLA', 'CRECHE', 'EDUCAÇÃO INFANTIL']) {
          for (let page = 1; page <= 8; page++) {
            if (signal.aborted) throw new Error('Tempo máximo da consulta atingido.');
            const url = `${TCE_ORIGIN}/index.php/licitacao/abertas${page > 1 ? `/page/${page}` : ''}`;
            const response = await fetcher(url, { method: 'POST', body: new URLSearchParams({ proc: '', obj: term, mun: '0', periodo: '' }), signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), headers: { 'User-Agent': 'LicitaGestao/1.0 (consulta publica de editais)' }, redirect: 'error' });
            const parsed = parseTce(await read(response));
            items.push(...parsed.items); report.pages++; report.records += parsed.items.length;
            if (page >= parsed.pages) break;
            if (page === 8) { report.complete = false; report.message = 'Consulta parcial: limite de páginas do TCE-CE atingido para um dos termos.'; }
            await wait(200, undefined, { signal });
          }
        }
      }
    } catch (err) { report.complete = false; report.message = err instanceof Error && !/abort/i.test(err.message) ? err.message : 'Fonte indisponível ou consulta interrompida pelo limite de tempo.'; }
  }
  return { items, reports };
}
export function validSourceLink(url: string) {
  const safe = safeUrl(url); if (!safe) return false;
  const u = new URL(safe);
  return (u.hostname === 'pncp.gov.br' && u.pathname.startsWith('/app/editais/')) || (u.hostname === 'municipios-licitacoes.tce.ce.gov.br' && /^\/index.php\/licitacao\/detalhes\/proc\/\d+\/licit\/\d+$/.test(u.pathname));
}
