import { describe, expect, it, vi } from 'vitest';
import { discoverySettings, matches, type Candidate } from '../src/services/discovery-core.js';
import { identifyTcePlatform, enrichTcePlatforms, extractTceDocuments, fetchTceDocuments } from '../src/services/discovery-tce-platform.js';

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


describe('arquivos publicados no TCE-CE', () => {
  const detailsUrl = 'https://municipios-licitacoes.tce.ce.gov.br/index.php/licitacao/detalhes/proc/276296/licit/190835';
  const html = `<div class="detalhes"><h3>Detalhamento sobre a licitação</h3>
    <p>Objeto: construção de habitações</p></div>
    <aside><div class="box"><h4>Arquivos</h4><ul>
      <li><a href="/index.php/licitacao/arquivo/001">EDITAL PARTE 01</a></li>
      <li><a href="/index.php/licitacao/arquivo/002">EDITAL PARTE 02</a></li>
      <li><a href="/index.php/licitacao/arquivo/003">EDITAL PARTE 03</a></li>
      <li><a href="/index.php/licitacao/arquivo/004">PUBLICAÇÕES</a><span class="label">Excluído</span></li>
      <li><a href="/index.php/licitacao/arquivo/005?tipo=publicacao&amp;v=1">PUBLICAÇÕES</a></li>
    </ul></div><p>Dúvidas? Contate a Ouvidoria</p></aside>`;
  it('identifica os três editais e a publicação válida, ignorando a excluída', () => {
    const docs = extractTceDocuments(html, detailsUrl);
    expect(docs.map((d) => d.title)).toEqual(['EDITAL PARTE 01', 'EDITAL PARTE 02', 'EDITAL PARTE 03', 'PUBLICAÇÕES']);
    expect(docs[0]?.url).toBe('https://municipios-licitacoes.tce.ce.gov.br/index.php/licitacao/arquivo/001');
    expect(docs[3]?.url).toContain('?tipo=publicacao&v=1');
  });
  it('aceita documentos em outros subdomínios oficiais do TCE-CE', () => {
    const html = '<h4>Arquivos</h4><li><a href="https://arquivos.tce.ce.gov.br/licitacoes/edital.pdf">EDITAL COMPLETO</a></li>';
    const docs = extractTceDocuments(html, detailsUrl);
    expect(docs).toEqual([{ title: 'EDITAL COMPLETO', type: 'Edital', url: 'https://arquivos.tce.ce.gov.br/licitacoes/edital.pdf' }]);
  });
  it('não aceita anexos de domínios externos, javascript ou páginas de navegação', () => {
    const unsafe = `<h4>Arquivos</h4>
      <a href="https://example.org/edital.pdf">Documento externo</a>
      <a href="javascript:alert(1)">Script</a>
      <a href="/index.php/licitacao/abertas">Lista</a>
      <a href="/index.php/licitacao/arquivo/008">EDITAL</a>`;
    const docs = extractTceDocuments(unsafe, detailsUrl);
    expect(docs.map((doc) => doc.title)).toEqual(['EDITAL']);
  });
  it('não extrai arquivos quando a origem não é um detalhe autorizado do TCE', () => {
    expect(extractTceDocuments(html, 'https://example.org/')).toEqual([]);
    expect(extractTceDocuments(html, detailsUrl + '?other=1')).toEqual([]);
  });
  it('lê arquivos na mesma consulta que identifica a plataforma', async () => {
    const withPlatform = html + '<h4>Forma de Publicação</h4><p>Especificação: M2A Compras</p>';
    const candidate = { ...structuredClone(base), sources: [{ source: 'TCE' as const, url: detailsUrl }] };
    const fetcher = vi.fn().mockResolvedValue(new Response(withPlatform, { status: 200 }));
    const result = await enrichTcePlatforms([candidate], discoverySettings.parse({ sources: ['TCE'], sessionTo: '2099-12-31' }), fetcher);
    expect(result.checked).toBe(1);
    expect(candidate.documents?.length).toBe(4);
  });
  it('consulta anexos sob demanda fora do limite de 90 detalhes', async () => {
    const candidate = { ...structuredClone(base), sources: [{ source: 'TCE' as const, url: detailsUrl }] };
    const fetcher = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
    const docs = await fetchTceDocuments(candidate, fetcher);
    expect(docs.available).toBe(true);
    expect(docs.documents).toHaveLength(4);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
