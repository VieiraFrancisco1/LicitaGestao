import { type Candidate } from './discovery-core.js';

/** Links de download construídos SOMENTE a partir de IDs de editais públicos no PNCP.
 * Não acessa URLs recebidas de usuário, portal ou saída da IA (evita SSRF).
 */
function pncpRef(item: Candidate) {
  const source = item.sources.find((s) => s.source === 'PNCP');
  const match = source?.url.match(/^https:\/\/pncp\.gov\.br\/app\/editais\/(\d{14})\/(\d{4})\/(\d{1,10})$/);
  if (!match) return null;
  return { base: `https://pncp.gov.br/api/pncp/v1/orgaos/${match[1]}/compras/${match[2]}/${match[3]}/arquivos` };
}
function extractDocuments(json: unknown, base: string): NonNullable<Candidate['documents']> {
  const data = Array.isArray(json) ? json : (json && typeof json === 'object' ? (json as { data?: unknown; documentos?: unknown }).data ?? (json as { documentos?: unknown }).documentos : undefined);
  if (!Array.isArray(data)) return [];
  return data.flatMap((doc: unknown) => {
    if (!doc || typeof doc !== 'object') return [];
    const d = doc as Record<string, unknown>;
    const seq = Number(d.sequencialDocumento);
    if (!Number.isSafeInteger(seq) || seq < 1 || seq > 9999999) return [];
    const title = String(d.titulo ?? d.tipoDocumentoNome ?? 'Documento do processo').slice(0, 180);
    return [{ title, type: String(d.tipoDocumentoNome ?? 'Documento').slice(0, 100), url: `${base}/${seq}` }];
  }).sort((a, b) => Number(/edital/i.test(b.title + b.type)) - Number(/edital/i.test(a.title + a.type))).slice(0, 8);
}
export async function collectPncpDocuments(item: Candidate, fetcher: typeof fetch = fetch) {
  const ref = pncpRef(item);
  if (!ref) return [];
  const res = await fetcher(ref.base, { signal: AbortSignal.timeout(7000), redirect: 'error', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`PNCP documentos HTTP ${res.status}`);
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > 500_000) throw new Error('Lista de documentos acima do limite');
  const text = await res.text();
  if (text.length > 500_000) throw new Error('Lista de documentos acima do limite');
  return extractDocuments(JSON.parse(text), ref.base);
}
export async function enrichPncpDocuments(items: Candidate[], maxItems = 40, fetcher: typeof fetch = fetch): Promise<string[]> {
  const eligible = items.filter((i) => i.sources.some((s) => s.source === 'PNCP')).slice(0, maxItems);
  let next = 0; let failures = 0;
  await Promise.all(Array.from({ length: Math.min(4, eligible.length) }, async () => {
    while (next < eligible.length) {
      const item = eligible[next++];
      if (!item) continue;
      try { item.documents = await collectPncpDocuments(item, fetcher); } catch { failures++; }
    }
  }));
  const messages = [];
  if (failures) messages.push(`Os anexos de ${failures} licitação(ões) não puderam ser consultados no PNCP; abra o portal oficial para conferir.`);
  if (items.length > maxItems) messages.push(`Documentos consultados automaticamente para até ${maxItems} oportunidades deste ciclo; os demais podem ser verificados no PNCP.`);
  return messages;
}
