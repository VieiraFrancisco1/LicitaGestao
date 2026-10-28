import { UserRole } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/database.js';
import { classify, deduplicate, discoverySettings, isOpen, matches, type Candidate } from '../src/services/discovery-core.js';
import { collectSources, parsePncp, parseTce, validSourceLink } from '../src/services/discovery-sources.js';
import { discoveryScope, getDiscoveryStatus, listOpportunities, opportunityDraft } from '../src/services/discovery.service.js';
import { createTender } from '../src/services/tender.service.js';
import { env } from '../src/config/env.js';
import { reviewWithAi } from '../src/services/discovery-ai.js';

const auth = { userId: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222', role: UserRole.FUNCIONARIO, companyId: null };
const now = new Date('2026-10-28T15:00:00Z');
const candidate: Candidate = { key: 'TCE:1:2', sourceKeys: ['TCE:1:2'], sources: [{ source: 'TCE', url: 'https://municipios-licitacoes.tce.ce.gov.br/index.php/licitacao/detalhes/proc/1/licit/2' }], municipality: 'Crato', state: 'CE', reference: '005/2026', processNumber: '', agency: '', modality: '', object: 'Contratação de empresa para execução das obras de pavimentação em pedra tosca em diversas ruas do município', estimatedValue: 1500000, sessionDate: '2026-11-15', sessionTime: null, publishedDate: '2026-10-27', categories: ['CALCAMENTO', 'PAVIMENTACAO'], reason: '', aiReviewed: false };
const html = '<table><tr><th>Valor Estimado (R$)</th></tr><tr><td><a href="/index.php/licitacao/detalhes/proc/1/licit/2">005/2026</a></td><td>CRATO</td><td>Execução de pavimentação em pedra tosca</td><td>27/10/2026</td><td>20/10/2026<br>08:00</td><td>15/11/2026</td><td><p>1.500.000,00</p></td></tr></table><a href="/index.php/licitacao/abertas/page/3/mun/000">Última</a>';
afterEach(() => vi.restoreAllMocks());
describe('busca de obras no Ceará', () => {
  it.each([
    ['Contratação dos serviços de engenharia para pavimentação em paralelepípedo em diversas ruas', ['CALCAMENTO', 'PAVIMENTACAO']],
    ['Assessoria de engenharia para fiscalização das obras de escolas', []],
    ['Execução de pavimentação em paralelepípedo em diversas ruas', ['CALCAMENTO', 'PAVIMENTACAO']],
    ['Construção de creche padrão FNDE', ['ESCOLAS']],
    ['Ampliação de centro de educação infantil', ['ESCOLAS']],
    ['Reforma de quadra na EMEIEF João', ['ESCOLAS']],
    ['Aquisição de merenda escolar', []],
    ['Aquisição de mobiliário escolar', []],
    ['Fornecimento de pedras para manutenção de pavimentação', []],
    ['Contratação de consultoria para projetos de saúde', []]
  ])('classifica o objeto: %s', (object, expected) => expect(classify(object)).toEqual(expected));
  it('interpreta moeda brasileira e prioriza reabertura', () => {
    const result = parseTce(html); expect(result.items[0]?.estimatedValue).toBe(1500000); expect(result.items[0]?.sessionDate).toBe('2026-11-15'); expect(result.pages).toBe(3);
  });
  it('trata valores sigilosos sem inventar números', () => expect(parseTce(html.replace('1.500.000,00', 'Sigiloso')).items[0]?.estimatedValue).toBeNull());
  it('recusa páginas de bloqueio e mudanças de layout', () => expect(() => parseTce('<html>Verifique o CAPTCHA</html>')).toThrow());
  it('usa limite estritamente superior a um milhão e Ceará fixo', () => {
    const settings = discoverySettings.parse({});
    expect(matches(candidate, settings, now)).toBe(true);
    expect(matches({ ...candidate, estimatedValue: 1000000 }, settings, now)).toBe(false);
    expect(matches({ ...candidate, state: 'SP' } as any, settings, now)).toBe(false);
    expect(matches({ ...candidate, estimatedValue: null }, settings, now)).toBe(false);
    expect(matches({ ...candidate, estimatedValue: null }, { ...settings, includeUnknownValue: true }, now)).toBe(true);
  });
  it('exclui prazos passados em Fortaleza e mantém o dia quando o horário é desconhecido', () => {
    expect(isOpen({ ...candidate, sessionDate: '2026-10-27' }, now)).toBe(false);
    expect(isOpen({ ...candidate, sessionDate: '2026-10-28', sessionTime: '08:00' }, now)).toBe(false);
    expect(isOpen({ ...candidate, sessionDate: '2026-10-28', sessionTime: null }, now)).toBe(true);
  });
  it('consolida o mesmo edital entre fontes sem confundir municípios', () => {
    const pncp = { ...candidate, key: 'PNCP:x', sourceKeys: ['PNCP:x'], sources: [{ source: 'PNCP' as const, url: 'https://pncp.gov.br/app/editais/12345678000199/2026/1' }] };
    const rows = deduplicate([candidate, pncp, { ...candidate, key: 'TCE:3:4', sourceKeys: ['TCE:3:4'], municipality: 'Pacoti' }]);
    expect(rows).toHaveLength(2); expect(rows[0]?.sources).toHaveLength(2);
  });
  it('rejeita links fora das duas fontes públicas permitidas', () => {
    expect(validSourceLink(candidate.sources[0]!.url)).toBe(true);
    expect(validSourceLink('https://127.0.0.1/index.php/licitacao/detalhes/proc/1/licit/2')).toBe(false);
    expect(validSourceLink('javascript:alert(1)')).toBe(false);
  });
  it('mantém resultado parcial quando uma fonte falha', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('indisponível'));
    const result = await collectSources(['PNCP', 'TCE'], fetcher, now);
    expect(result.reports).toHaveLength(2); expect(result.reports.every((r) => !r.complete)).toBe(true);
  });
  it('consulta o PNCP com uf CE e acompanha sua paginação', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [], totalPaginas: 2 }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [], totalPaginas: 2 })));
    const result = await collectSources(['PNCP'], fetcher, now);
    expect(result.reports[0]?.pages).toBe(2); expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get('uf')).toBe('CE');
  });
  it('descarta dados de outros estados e respostas incompatíveis', () => {
    expect(parsePncp({ data: [{ unidadeOrgao: { ufSigla: 'SP' } }] }).items).toHaveLength(0);
    expect(() => parsePncp({ result: [] })).toThrow();
  });
});
describe('isolamento e importação de oportunidades', () => {
  it('recupera o estado de uma execução interrompida sem manter a tela presa', async () => {
    vi.spyOn(prisma.discoveryProfile, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.discoveryRun, 'findFirst').mockResolvedValue({ id: 'stale', status: 'RUNNING', startedAt: new Date(Date.now() - 11 * 60000) } as never);
    const update = vi.spyOn(prisma.discoveryRun, 'updateMany').mockResolvedValue({ count: 1 });
    const status = await getDiscoveryStatus(auth);
    expect(status.run?.status).toBe('FAILED');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'stale', organizationId: auth.organizationId, status: 'RUNNING' } }));
  });

  it('nega a área ao perfil externo da empresa', () => expect(() => discoveryScope({ ...auth, role: UserRole.EMPRESA })).toThrow());
  it('consulta resultados apenas na organização autenticada', async () => {
    const find = vi.spyOn(prisma.discoveryOpportunity, 'findMany').mockResolvedValue([]);
    await listOpportunities(auth, 1, discoverySettings.parse({}));
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: auth.organizationId, active: true } }));
  });
  it('não fornece rascunho de outra conta', async () => {
    const find = vi.spyOn(prisma.discoveryOpportunity, 'findFirst').mockResolvedValue(null);
    await expect(opportunityDraft('id', auth)).rejects.toThrow('nesta conta');
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'id', organizationId: auth.organizationId, active: true } }));
  });
  it('bloqueia importação já realizada', async () => {
    vi.spyOn(prisma.discoveryOpportunity, 'findFirst').mockResolvedValue({ importedTender: { id: 'existing' } } as never);
    await expect(opportunityDraft('id', auth)).rejects.toThrow('já foi adicionada');
  });
  it('verifica a organização também ao salvar o rascunho', async () => {
    vi.spyOn(prisma.discoveryOpportunity, 'findFirst').mockResolvedValue(null);
    const create = vi.spyOn(prisma.tender, 'create');
    await expect(createTender({ sessionDate: now, opportunityId: 'other-org' }, auth)).rejects.toThrow('nesta conta');
    expect(create).not.toHaveBeenCalled();
  });
});
describe('análise por IA', () => {
  it('funciona por filtros sem chamar API quando a IA está desativada', async () => {
    const fetcher = vi.fn(); const result = await reviewWithAi([candidate], { ...discoverySettings.parse({}), useAi: false }, fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect(result.items).toEqual([candidate]);
  });
  it('recusa identificadores inventados pela IA e mantém os dados originais', async () => {
    const old = env.TENDER_AI_API_KEY; env.TENDER_AI_API_KEY = 'test-only';
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ items: [{ key: 'inventado', relevant: false, reason: 'erro' }] }) }] }] })));
      const result = await reviewWithAi([candidate], discoverySettings.parse({}), fetcher);
      expect(result.items).toEqual([candidate]); expect(result.warning).toContain('não pôde');
      const body = JSON.parse(fetcher.mock.calls[0]![1].body); expect(body.store).toBe(false); expect(body.tools).toBeUndefined();
    } finally { env.TENDER_AI_API_KEY = old; }
  });
});
