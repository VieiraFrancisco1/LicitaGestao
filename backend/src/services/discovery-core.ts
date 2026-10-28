import { createHash } from 'node:crypto';
import { z } from 'zod';

export const categoryNames = { CALCAMENTO: 'Calçamento', PAVIMENTACAO: 'Pavimentação', ESCOLAS: 'Escolas e creches', CONSTRUCAO: 'Construção', REFORMAS: 'Reformas e ampliações', DRENAGEM: 'Drenagem', SANEAMENTO: 'Saneamento', ESTRADAS: 'Rodovias e pontes', OBRAS_GERAIS: 'Todas as obras' } as const;
export type Category = keyof typeof categoryNames;
export type Source = 'PNCP' | 'TCE';
export type Platform = 'BLL' | 'M2A' | 'LICITAMAIS' | 'COMPRASGOV' | 'PORTALCOMPRAS' | 'LICITANET' | 'BBMNET' | 'OUTRAS' | 'NAO_INFORMADA';
export type Candidate = {
  key: string; sourceKeys: string[]; sources: Array<{ source: Source; url: string }>;
  municipality: string; state: 'CE'; reference: string; processNumber: string;
  agency: string; modality: string; object: string; estimatedValue: number | null;
  sessionDate: string; sessionTime: string | null; publishedDate: string | null;
  categories: Category[]; reason: string; aiReviewed: boolean;
  platformName?: string | null; platformUrl?: string | null;
  documents?: Array<{ title: string; url: string; type: string }>;
  phaseStatus?: 'SIM' | 'NAO' | 'NAO_IDENTIFICADA'; phaseEvidence?: string; phaseCheckedAt?: string;
};
export const discoverySettings = z.object({
  minValue: z.coerce.number().min(0).max(999999999999).default(1000000),
  categories: z.array(z.enum(['CALCAMENTO', 'PAVIMENTACAO', 'ESCOLAS', 'CONSTRUCAO', 'REFORMAS', 'DRENAGEM', 'SANEAMENTO', 'ESTRADAS', 'OBRAS_GERAIS'])).min(1).max(9).default(['OBRAS_GERAIS']),
  sources: z.array(z.enum(['PNCP', 'TCE'])).min(1).max(2).default(['PNCP', 'TCE']),
  municipality: z.string().trim().max(120).default(''),
  platforms: z.array(z.enum(['BLL', 'M2A', 'LICITAMAIS', 'COMPRASGOV', 'PORTALCOMPRAS', 'LICITANET', 'BBMNET', 'OUTRAS', 'NAO_INFORMADA'])).max(9).default([]),
  sessionFrom: z.string().refine((v) => !!validDate(v), 'Data inicial inválida').nullable().default(null),
  sessionTo: z.string().refine((v) => !!validDate(v), 'Data final inválida').nullable().default(null),
  keywords: z.string().trim().max(180).default(''),
  includeUnknownValue: z.boolean().default(false),
  useAi: z.boolean().default(true),
  enabled: z.boolean().default(false),
  intervalHours: z.coerce.number().int().min(1).max(24).default(6)
}).superRefine((s, ctx) => {
  if (s.sessionFrom && s.sessionTo && s.sessionFrom > s.sessionTo) ctx.addIssue({ code: 'custom', message: 'A data inicial precisa ser anterior à final', path: ['sessionTo'] });
  if (s.sessionFrom && s.sessionTo && (Date.parse(s.sessionTo) - Date.parse(s.sessionFrom)) / 86400000 > 180) ctx.addIssue({ code: 'custom', message: 'O período máximo é de 180 dias', path: ['sessionTo'] });
});
export type DiscoverySettings = z.infer<typeof discoverySettings>;
export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function todayCE(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
export function brDate(text: string) {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? validDate(`${m[3]}-${m[2]}-${m[1]}`) : null;
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function classify(object: string): Category[] {
  const text = normalize(object);
  // A fonte pode trazer compras de materiais de construção: elas NÃO são obras.
  const engineering = /\b(obras?|engenharia|construcao|reforma|ampliacao|pavimentacao|calcamento|recapeamento|terraplenagem|drenagem|saneamento|infraestrutura|ponte|viaduto|rodovia|estrada|edificacao|predial|quadra|unidade de saude|hospital|posto de saude|urbanizacao|praca|adutora|barragem|iluminacao publica|rede eletrica|eletrificacao|rede de esgoto|rede de agua)\b/.test(text);
  const procurement = /\b(aquisicao|compras?|fornecimento|locacao|aluguel)\b/.test(text);
  const excluded = /consultoria|assessoria|fiscalizacao|elaboracao de projetos|projeto executivo|projetos de engenharia|estudo tecnico|inspecao|laudo/.test(text);
  const explicitWorkContract = /execucao (de |das |dos )?(obras?|servicos de engenharia|pavimentacao|calcamento|construcao|reforma|drenagem|saneamento)/.test(text);
  if (!engineering || (excluded && !explicitWorkContract) || (procurement && !explicitWorkContract)) return [];
  const categories: Category[] = [];
  if (/calcamento|pedra tosca|paralelepiped|intertravado|bloquet|paver/.test(text)) categories.push('CALCAMENTO');
  if (/pavimenta|asfalt|cbuq|recapeamento/.test(text)) categories.push('PAVIMENTACAO');
  if (/escola|escolar|creche|educacao infantil|unidade de ensino|emeief|emef|centro educacional/.test(text)) categories.push('ESCOLAS');
  if (/construcao|edificacao|construcao civil|nova unidade/.test(text)) categories.push('CONSTRUCAO');
  if (/reforma|ampliacao|restauracao|requalificacao|recuperacao predial/.test(text)) categories.push('REFORMAS');
  if (/drenagem|galeria pluvial|aguas pluviais/.test(text)) categories.push('DRENAGEM');
  if (/saneamento|esgotamento|rede de agua|rede de esgoto|adutora|abastecimento/.test(text)) categories.push('SANEAMENTO');
  if (/estrada|rodovia|ponte|viaduto|passagem molhada/.test(text)) categories.push('ESTRADAS');
  return categories.length ? [...new Set(categories)] : ['OBRAS_GERAIS'];
}
export function isOpen(item: Candidate, now = new Date()) {
  if (item.state !== 'CE' || !validDate(item.sessionDate) || item.sessionDate < todayCE(now)) return false;
  if (item.sessionTime && /^\d\d:\d\d$/.test(item.sessionTime)) return new Date(`${item.sessionDate}T${item.sessionTime}:00-03:00`).getTime() > now.getTime();
  return true;
}
export function platformKey(name: string | null | undefined): Platform {
  const n = normalize(name ?? '');
  if (!n) return 'NAO_INFORMADA';
  if (n.includes('bll')) return 'BLL';
  if (n.includes('m2a')) return 'M2A';
  if (n.includes('licita mais') || n.includes('licitamais')) return 'LICITAMAIS';
  if (n.includes('compras gov') || n.includes('comprasnet')) return 'COMPRASGOV';
  if (n.includes('portal de compras publicas') || n.includes('portaldecompraspublicas')) return 'PORTALCOMPRAS';
  if (n.includes('licitanet')) return 'LICITANET';
  if (n.includes('bbmnet')) return 'BBMNET';
  return 'OUTRAS';
}
export function matches(item: Candidate, settings: DiscoverySettings, now = new Date()) {
  return isOpen(item, now)
    && (!settings.sessionFrom || item.sessionDate >= settings.sessionFrom)
    && (settings.sessionTo ? item.sessionDate <= settings.sessionTo : item.sessionDate <= todayCE(new Date(now.getTime() + 90 * 86400000)))
    && (!settings.platforms.length || settings.platforms.includes(platformKey(item.platformName))) && item.categories.length > 0 && (settings.categories.includes('OBRAS_GERAIS') || item.categories.some((c) => settings.categories.includes(c))) &&
    item.sources.some((s) => settings.sources.includes(s.source)) &&
    (item.estimatedValue === null ? settings.includeUnknownValue : item.estimatedValue > settings.minValue) &&
    (!settings.municipality || normalize(item.municipality).includes(normalize(settings.municipality))) &&
    (!settings.keywords || normalize(settings.keywords).split(' ').every((word) => normalize(item.object).includes(word)));
}
export function fingerprint(item: Candidate) {
  return createHash('sha256').update([normalize(item.municipality), normalize(item.reference).replace(/\b(ce|cp|pe)\b/g, '').replace(/\s/g, ''), item.sessionDate, item.estimatedValue ?? '', normalize(item.object)].join('|')).digest('hex');
}
export function deduplicate(items: Candidate[]) {
  const result: Candidate[] = []; const byKey = new Map<string, Candidate>(); const byHash = new Map<string, Candidate>();
  const groups = new Map<string, Candidate[]>();
  for (const item of items) {
    const hash = fingerprint(item);
    const ref = item.reference.replace(/[^0-9]/g, '');
    const group = `${normalize(item.municipality)}|${ref}|${item.sessionDate}|${item.estimatedValue}`;
    const existing = item.sourceKeys.map((key) => byKey.get(key)).find(Boolean) ?? byHash.get(hash) ??
      (ref.length >= 6 && item.estimatedValue !== null ? (groups.get(group) ?? []).find((other) => {
        if (other.sources.some((a) => item.sources.some((b) => a.source === b.source))) return false;
        const words = new Set(normalize(other.object).split(' ')); const incoming = new Set(normalize(item.object).split(' '));
        const overlap = [...words].filter((w) => incoming.has(w)).length;
        return Math.min(words.size, incoming.size) >= 10 && overlap / Math.max(words.size, incoming.size) >= 0.8;
      }) : undefined);
    if (existing) {
      existing.sourceKeys = [...new Set([...existing.sourceKeys, ...item.sourceKeys])];
      for (const source of item.sources) if (!existing.sources.some((s) => s.url === source.url)) existing.sources.push(source);
      if (!existing.platformUrl && item.platformUrl) { existing.platformUrl = item.platformUrl; existing.platformName = item.platformName ?? null; }
      if (!existing.documents?.length && item.documents?.length) existing.documents = item.documents;
      item.sourceKeys.forEach((key) => byKey.set(key, existing)); byHash.set(hash, existing);
    } else {
      const copy = { ...item, sourceKeys: [...item.sourceKeys], sources: [...item.sources] }; result.push(copy);
      copy.sourceKeys.forEach((key) => byKey.set(key, copy)); byHash.set(hash, copy); groups.set(group, [...(groups.get(group) ?? []), copy]);
    }
  }
  return result;
}
