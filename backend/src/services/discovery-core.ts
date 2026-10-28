import { createHash } from 'node:crypto';
import { z } from 'zod';

// Preserva categorias antigas nos perfis já salvos (V54), adicionando os 21 filtros da V56.
export const categoryNames = {
  OBRAS_GERAIS: 'Todas as obras', CALCAMENTO: 'Calçamento',
  UBS: 'UBS', CRECHES: 'Creches', INTERTRAVADO: 'Intertravado',
  PAVIMENTACAO: 'Pavimentação', PASSAGEM_MOLHADA: 'Passagem molhada',
  REFORMAS: 'Reformas', PRACAS: 'Praças', DRENAGEM: 'Drenagem',
  SANEAMENTO: 'Saneamento', ASFALTO: 'Asfalto', ILUMINACAO: 'Iluminação pública',
  REVITALIZACAO: 'Revitalização', ESTRADAS: 'Estradas', URBANIZACAO: 'Urbanização',
  MANUTENCAO_PREDIAL: 'Manutenção predial', ESTRADAS_VICINAIS: 'Estradas vicinais',
  UNIDADES_HABITACIONAIS: 'Unidades habitacionais', ABASTECIMENTO: 'Abastecimento de água',
  ESCOLAS: 'Escolas', CEI: 'CEI', CONSTRUCAO: 'Construção'
} as const;
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
  categories: z.array(z.enum(Object.keys(categoryNames) as [Category, ...Category[]])).min(1).max(23).default(['OBRAS_GERAIS']),
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
export const excludedMunicipalities = new Set(['fortaleza', 'eusebio']);
export function isExcludedMunicipality(municipality: string) {
  // Usa o município da execução quando informado pela fonte; não confundir com o endereço do órgão.
  return excludedMunicipalities.has(normalize(municipality));
}
export function classify(object: string): Category[] {
  const text = normalize(object);
  const engineering = /\b(obra|obras|engenharia|construcao|reformas?|ampliacao|pavimentacao|calcamento|recapeamento|terraplenagem|drenagem|saneamento|infraestrutura|ponte|viaduto|rodovia|estradas?|edificacao|predial|quadra|urbanizacao|revitalizacao|restauracao|pracas?|adutora|barragem|iluminacao|eletrificacao|rede de esgoto|rede de agua|abastecimento|ubs|unidade basica de saude|creches?|escolas?|cei|centro de educacao infantil|habitacional|passagem molhada|intertravado|asfaltamento|asfalto)\b/.test(text);
  const procurement = /\b(aquisicao|compras?|fornecimento|locacao|aluguel)\b/.test(text);
  const excluded = /consultoria|assessoria|fiscalizacao|elaboracao de projetos|projeto executivo|projetos de engenharia|estudo tecnico|inspecao|laudo/.test(text);
  const explicitExecution = /execucao (de |das |dos )?(obras?|servicos de engenharia|pavimentacao|calcamento|construcao|reforma|drenagem|saneamento|iluminacao|urbanizacao)|contratacao de empresa (especializada )?para (execucao|construcao|reforma)|servicos de (construcao|reforma|pavimentacao|manutencao predial|engenharia)/.test(text);
  if (!engineering || (excluded && !explicitExecution) || (procurement && !explicitExecution)) return [];
  const categories: Category[] = [];
  const add = (key: Category, pattern: RegExp) => { if (pattern.test(text)) categories.push(key); };
  add('UBS', /\bubs\b|unidade basica de saude|posto de saude|unidade de saude/);
  add('CRECHES', /creche|educacao infantil/);
  add('INTERTRAVADO', /intertravado|bloquet|paver|piso intertravado/);
  add('CALCAMENTO', /calcamento|pedra tosca|paralelepiped/);
  add('PAVIMENTACAO', /pavimenta|recapeamento|calcamento|intertravado|asfalt|cbuq/);
  add('PASSAGEM_MOLHADA', /passagem molhada/);
  add('REFORMAS', /reforma|ampliacao|restauracao|recuperacao predial/);
  add('PRACAS', /praca|passeio publico|espaco publico|parque urbano/);
  add('DRENAGEM', /drenagem|galeria pluvial|aguas pluviais/);
  add('SANEAMENTO', /saneamento|esgotamento|rede de agua|rede de esgoto|adutora|abastecimento/);
  add('ASFALTO', /asfalt|cbuq|massa asfaltica|recapeamento/);
  add('ILUMINACAO', /iluminacao|luminarias|eletrificacao|rede eletrica/);
  add('REVITALIZACAO', /revitalizacao|requalificacao|restauracao/);
  add('ESTRADAS', /estrada|rodovia|ponte|viaduto|passagem molhada/);
  add('URBANIZACAO', /urbanizacao|paisagismo|passeio publico/);
  add('MANUTENCAO_PREDIAL', /manutencao predial|manutencao (de |das |dos )?(edific|predi)|reparos prediais/);
  add('ESTRADAS_VICINAIS', /estrada vicinal|estradas vicinais|via vicinal|vias vicinais/);
  add('UNIDADES_HABITACIONAIS', /unidade habitacional|unidades habitacionais|conjunto habitacional|habitacao popular|moradias/);
  add('ABASTECIMENTO', /abastecimento|adutora|sistema de agua|rede de agua/);
  add('ESCOLAS', /escola|escolar|unidade de ensino|emeief|emef|centro educacional/);
  add('CEI', /\bcei\b|centro de educacao infantil/);
  add('CONSTRUCAO', /construcao|edificacao|construcao civil|nova unidade/);
  // OBRAS_GERAIS cobre obras de engenharia sem uma das palavras-chave específicas.
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
    && !isExcludedMunicipality(item.municipality)
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
