import { describe, expect, it, vi } from 'vitest';
import { discoverySettings, matches, type Candidate } from '../src/services/discovery-core.js';
import { identifyTcePlatform, enrichTcePlatforms } from '../src/services/discovery-tce-platform.js';

const tceUrl = 'https://municipios-licitacoes.tce.ce.gov.br/index.php/licitacao/detalhes/proc/276058/licit/190713';
const base: Candidate = {
  key: 'TCE:276058:190713', sourceKeys: ['TCE:276058:190713'],
  sources: [{ source: 'TCE', url: tceUrl }], municipality: 'Maracanaú', state: 'CE',
  reference: '10.023/2026-CE', processNumber: '', agency: '', modality: '',
  object: 'Execução de reforma e ampliação de estádio municipal',
  estimatedValue: 1468387, sessionDate: '2099-11-15', sessionTime: null, publishedDate: null,
  categories: ['REFORMAS'], reason: '', aiReviewed: false
};
const setting = discoverySettings.parse({ sources: ['TCE'], platforms: ['BLL'], sessionTo: '2099-12-31' });
const bll = `<section>
  <h3>Detalhamento sobre a licitação</h3>
  <p>Objeto: Reforma de estádio no município de Maracanaú.</p>
  <p>Local: Através do endereço eletrônico https://bllcompras.com – Acesso identificado</p>
  <h4>Forma de Publicação</h4>
  <p>Outros Meios de Publicações - Especificação: BLL COMPRAS</p>
  <h4>Órgãos</h4>
  <p>Secretaria de Infraestrutura</p>
</section>`;

describe('identificação avançada da plataforma nos detalhes do TCE-CE', () => {
  it('identifica BLL pelo campo Local com link HTTPS explícito', () => {
    const result = identifyTcePlatform(bll);
    expect(result?.platformName).toBe('BLL Compras');
    expect(result?.platformUrl).toBe('https://bllcompras.com/');
    expect(result?.platformEvidence).toContain('Local:');
  });
  it('identifica M2A por Local HTTP, sem publicar endereço inseguro como link', () => {
    const result = identifyTcePlatform('<p>Local: http://compras.m2atecnologia.com.br</p><h3>Forma de Publicação</h3>');
    expect(result?.platformName).toBe('M2A Compras');
    expect(result?.platformUrl).toBeNull();
  });
  it('usa publicação específica e ignora PNCP e Diário Oficial como plataformas', () => {
    const html = '<p>Local: Sede da prefeitura</p><h3>Forma de Publicação</h3><p>Especificação: Portal Nacional de Contratações Públicas - PNCP</p><p>Especificação: Licitanet</p><h3>Órgãos</h3>';
    expect(identifyTcePlatform(html)?.platformName).toBe('Licitanet');
    expect(identifyTcePlatform('<p>Local: Prefeitura</p><h3>Forma de Publicação</h3><p>Especificação: PNCP</p><h3>Órgãos</h3>')).toBeNull();
  });
  it('não escolhe arbitrariamente entre plataformas distintas publicadas', () => {
    const html = '<p>Local: Prefeitura</p><h3>Forma de Publicação</h3><p>Especificação: BLL Compras</p><p>Especificação: M2A Compras</p><h3>Órgãos</h3>';
    expect(identifyTcePlatform(html)).toBeNull();
  });
  it('não confunde nome da plataforma citado no objeto com local de disputa', () => {
    const html = '<p>Objeto: fornecimento de licenças da plataforma M2A Compras</p><p>Local: sala de reunião</p><h3>Forma de Publicação</h3><p>Especificação: Diário Oficial</p><h3>Órgãos</h3>';
    expect(identifyTcePlatform(html)).toBeNull();
  });
  it('consulta só detalhes do TCE para obras elegíveis e identifica antes do filtro por plataforma', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(bll, { status: 200 }));
    const item = structuredClone(base);
    const result = await enrichTcePlatforms([item], setting, fetcher);
    expect(result.checked).toBe(1);
    expect(result.identified).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(tceUrl, expect.objectContaining({ redirect: 'error' }));
    expect(item.platformName).toBe('BLL Compras');
    expect(matches(item, setting)).toBe(true);
  });
  it('não acessa páginas externas ou licitações de Fortaleza e Eusébio', async () => {
    const fetcher = vi.fn();
    const others = [
      { ...base, municipality: 'Fortaleza' },
      { ...base, municipality: 'Eusébio' },
      { ...base, sources: [{ source: 'PNCP' as const, url: 'https://pncp.gov.br/app/editais/123/2026/1' }] }
    ];
    const result = await enrichTcePlatforms(others, setting, fetcher);
    expect(result.checked).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserva resultados quando o detalhe não responde', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('timeout'));
    const item = structuredClone(base);
    const result = await enrichTcePlatforms([item], setting, fetcher);
    expect(result.failed).toBe(1);
    expect(item.platformName).toBeUndefined();
  });
});
