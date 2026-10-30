import { describe, expect, it, vi } from 'vitest';
import { collectSources } from '../src/services/discovery-sources.js';

const date = new Date('2026-10-30T12:00:00Z');
const tceHtml = '<table><tr><th>Valor Estimado (R$)</th></tr>' +
  '<tr><td><a href="/index.php/licitacao/detalhes/proc/11/licit/9">001/2026</a></td>' +
  '<td>QUIXADÁ</td><td>Execução das obras de pavimentação</td><td>27/10/2026</td>' +
  '<td>30/10/2026</td><td>15/11/2026</td><td>1.500.000,00</td></tr></table>';

describe('consulta pública resiliente', () => {
  it('passa a modalidade exigida na consulta ao PNCP e informa progresso', async () => {
    const fetcher = vi.fn(async (_url: unknown) => new Response(JSON.stringify({ data: [], totalPaginas: 1 })));
    const progress: string[] = [];
    const result = await collectSources(['PNCP'], fetcher as unknown as typeof fetch, date, undefined, '2026-11-30', (message) => { progress.push(message); });
    expect(result.reports[0]?.complete).toBe(true);
    expect(result.reports[0]?.pages).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const call of fetcher.mock.calls) {
      const url = new URL(String(call[0]));
      expect(['4', '6', '8']).toContain(url.searchParams.get('codigoModalidadeContratacao'));
      expect(url.searchParams.get('uf')).toBe('CE');
      expect(url.searchParams.get('dataFinal')).toBe('20261130');
    }
    expect(progress.some((text) => text.includes('PNCP'))).toBe(true);
  });


  it('lê primeiro a listagem geral do TCE-CE e não depende apenas da pesquisa por palavra-chave', async () => {
    const firstPage = '<table><tr><th>Valor Estimado (R$)</th></tr>' +
      '<tr><td><a href="/index.php/licitacao/detalhes/proc/276308/licit/190844">CE-01/2026-SMS</a></td>' +
      '<td>ALTO SANTO</td><td>CONTRATAÇÃO DE EMPRESA ESPECIALIZADA EM ENGENHARIA PARA EXECUÇÃO DA REFORMA DO HOSPITAL</td>' +
      '<td>28/10/2026</td><td>13/11/2026</td><td></td><td>5.151.556,24</td></tr></table>';
    const emptySearch = '<table><tr><th>Valor Estimado (R$)</th></tr></table>';
    const fetcher = vi.fn(async (url: unknown, options?: RequestInit) => new Response(
      String(url).endsWith('/licitacao/abertas') && options?.method === 'GET' ? firstPage : emptySearch
    ));
    const result = await collectSources(['TCE'], fetcher as unknown as typeof fetch, date);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(result.items.some((item) => item.municipality === 'ALTO SANTO' && item.estimatedValue === 5151556.24 && item.sessionDate === '2026-11-13')).toBe(true);
    expect(result.reports[0]?.records).toBeGreaterThan(0);
  });

  it('a falha do PNCP não impede o retorno de resultados do TCE-CE', async () => {
    const fetcher = vi.fn(async (url: unknown) => {
      if (String(url).includes('pncp.gov.br')) throw new Error('PNCP temporariamente indisponível');
      return new Response(tceHtml);
    });
    const result = await collectSources(['PNCP', 'TCE'], fetcher as unknown as typeof fetch, date);
    expect(result.reports.find((r) => r.source === 'PNCP')?.complete).toBe(false);
    expect(result.reports.find((r) => r.source === 'TCE')?.pages).toBeGreaterThan(0);
    expect(result.items.some((item) => item.municipality === 'QUIXADÁ')).toBe(true);
  });

  it('respeita cancelamento de consulta sem ficar indefinidamente em andamento', async () => {
    const canceled = new AbortController();
    canceled.abort();
    const fetcher = vi.fn();
    const result = await collectSources(['PNCP', 'TCE'], fetcher as unknown as typeof fetch, date, canceled.signal);
    expect(result.reports.every((r) => !r.complete)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
