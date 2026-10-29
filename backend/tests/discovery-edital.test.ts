import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { mergeOfficialEdict, readOfficialEdict } from '../src/services/discovery-edital.js';
import { type Candidate } from '../src/services/discovery-core.js';

const documentUrl = 'https://pncp.gov.br/api/pncp/v1/orgaos/12345678000199/compras/2026/2/arquivos/1';
const candidate: Candidate = {
  key: 'PNCP:1', sourceKeys: ['PNCP:1'], sources: [{ source: 'PNCP', url: 'https://pncp.gov.br/app/editais/12345678000199/2026/2' }],
  state: 'CE', municipality: 'Boa Viagem', reference: '04/2026', processNumber: '', agency: 'Prefeitura', modality: 'Concorrência Eletrônica',
  object: 'Construção de escola pública', estimatedValue: 1100000, sessionDate: '2026-11-20', sessionTime: null,
  publishedDate: null, categories: ['CONSTRUCAO'], reason: '', aiReviewed: false,
  documents: [{ title: 'Edital', type: 'Edital', url: documentUrl }]
};
const parsed = {
  modality: 'Concorrência Eletrônica', noticeNumber: '04/2026', processNumber: '0102/2026',
  municipality: 'Boa Viagem', sessionDate: '2026-11-20', object: 'Construção de escola pública',
  estimatedValue: '1123456.75', proposalValidityDays: '60', requiresGuaranteeOnePercent: 'SIM' as const,
  isPreQualification: 'NAO_INFORMADO' as const, evidence: 'Página 2, item 8'
};
const oldKey = env.TENDER_AI_API_KEY;
afterEach(() => { env.TENDER_AI_API_KEY = oldKey; vi.restoreAllMocks(); });

describe('leitura de edital oficial sem armazenar PDF', () => {
  it('extrai dados apenas de um link oficial PNCP e exige revisão', async () => {
    env.TENDER_AI_API_KEY = 'chave-de-teste';
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(parsed) }] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const response = await readOfficialEdict(candidate, fetcher);
    expect(response.extracted?.estimatedValue).toBe('1123456.75');
    expect(response.documentUrl).toBe(documentUrl);
    expect(response.note).toContain('Revise');
  });
  it('não consulta arquivos que não sejam do PNCP', async () => {
    env.TENDER_AI_API_KEY = 'chave-de-teste';
    const fetcher = vi.fn() as unknown as typeof fetch;
    const response = await readOfficialEdict({ ...candidate, sources: [], documents: [{ title: 'Edital', type: 'Edital', url: 'https://exemplo.invalid/edital.pdf' }] }, fetcher);
    expect(response.extracted).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('mantém preenchimento parcial se a IA falhar', async () => {
    env.TENDER_AI_API_KEY = 'chave-de-teste';
    const fetcher = vi.fn(async () => new Response('Erro', { status: 503 })) as unknown as typeof fetch;
    const response = await readOfficialEdict(candidate, fetcher);
    expect(response.extracted).toBeNull();
    expect(response.note).toContain('metadados públicos');
  });
  it('não inventa valores para campos ausentes, nem permite IDs arbitrários', () => {
    const base = { opportunityId: 'id-existente', municipality: 'Boa Viagem', estimatedValue: '1100000', sessionDate: '2026-11-20' };
    const merged = mergeOfficialEdict(base, { ...parsed, estimatedValue: 'não consta', sessionDate: '2030-99-99', proposalValidityDays: '', requiresGuaranteeOnePercent: 'NAO_INFORMADO', isPreQualification: 'NAO_INFORMADO' });
    expect(merged.estimatedValue).toBe('1100000');
    expect(merged.sessionDate).toBe('2026-11-20');
    expect(merged).not.toHaveProperty('requiresGuaranteeOnePercent');
    expect(merged.opportunityId).toBe('id-existente');
  });
});
