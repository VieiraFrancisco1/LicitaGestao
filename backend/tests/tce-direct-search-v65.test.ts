import { describe, expect, it, vi } from 'vitest';
import { parseTcePublicDetails, fetchTcePublicDetails } from '../src/services/discovery-tce-details.js';
import { lookupTcePublic } from '../src/services/discovery-tce-search.js';
import type { Candidate } from '../src/services/discovery-core.js';

const details = 'https://municipios-licitacoes.tce.ce.gov.br/index.php/licitacao/detalhes/proc/276296/licit/190835';
const candidate: Candidate = {
  key:'TCE:276296:190835',sourceKeys:['TCE:276296:190835'],
  sources:[{source:'TCE',url:details}],
  municipality:'PACUJA',state:'CE',reference:'PCSSEINFRACE010/2026',processNumber:'',
  agency:'',modality:'',object:'CONSTRUÇÃO DE HABITAÇÕES',estimatedValue:2771207.12,
  sessionDate:'2026-11-03',sessionTime:null,publishedDate:null,
  categories:['OBRAS_GERAIS'],reason:'',aiReviewed:false
};
const detailHtml = `<h3>Detalhamento sobre a licitação</h3>
 <p>Exercício: 2026</p>
 <p>Objeto: CONSTRUÇÃO DE 20 UNIDADES HABITACIONAIS NA CIDADE</p>
 <p>Síntese do Objeto: Obras</p><p>Modalidade: Concorrência</p>
 <p>Critério de julgamento: Menor Preço</p><p>Situação: Aberta</p>
 <p>Observações: inversão de fases</p>
 <p>Data da Publicação do Aviso: 19/10/2026 Data de Abertura: 03/11/2026 Hora da Abertura: 09:00</p>
 <p>Local: Realização através do endereço eletrônico m2atecnologia.com.br</p>
 <h3>Forma de Publicação</h3><p>Outros meios</p>
 <h3>Órgãos</h3><p>SECRETARIA MUNICIPAL DE INFRAESTRUTURA</p>
 <h3>Objeto/Lotes/Itens</h3>
 <p>Nº do Processo Administrativo: 010/2026</p>
 <p>Fundamentação Legal: Lei 14.133</p>
 <h4>Arquivos</h4><a href="/index.php/licitacao/arquivo/01">EDITAL PARTE 01</a>
 <p>Dúvidas? Contate a Ouvidoria</p>`;

describe('Detalhamento público TCE-CE no cadastro', () => {
 it('preenche apenas campos explícitos e mantém o valor publicado na lista', () => {
  const item = parseTcePublicDetails(detailHtml,candidate);
  expect(item.object).toContain('20 UNIDADES');
  expect(item.agency).toContain('SECRETARIA MUNICIPAL');
  expect(item.processNumber).toBe('010/2026');
  expect(item.sessionTime).toBe('09:00');
  expect(item.isInvertedPhase).toBe(true);
  expect(item.estimatedValue).toBe(2771207.12);
  expect(item.platformName).toBe('M2A Compras');
  expect(item.documents).toHaveLength(1);
 });
 it('não inventa dados quando os detalhes estão indisponíveis', () => {
  expect(parseTcePublicDetails('<h1>Indisponível</h1>', candidate)).toEqual(candidate);
 });
 it('consulta exclusivamente URL oficial do TCE', async () => {
  const fetcher=vi.fn().mockResolvedValue(new Response(detailHtml,{status:200}));
  const item=await fetchTcePublicDetails(candidate,fetcher);
  expect(fetcher).toHaveBeenCalledWith(details,expect.objectContaining({redirect:'error'}));
  expect(item.sessionTime).toBe('09:00');
  const invalid={...candidate,sources:[{source:'TCE' as const,url:'https://evil.test/private'}]};
  await fetchTcePublicDetails(invalid,fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
});

describe('Busca direta no TCE-CE', () => {
 const index=`<select name="mun"><option value="0">Todos</option><option value="101">PEDRA BRANCA</option></select>
 <table><tr><th>Valor Estimado</th></tr>
 <tr><td><a href="/index.php/licitacao/detalhes/proc/276296/licit/190835">019/2026-CP</a></td>
 <td>PEDRA BRANCA</td><td>CONSTRUÇÃO DE UMA CRECHE MUNICIPAL</td>
 <td>19/10/2026</td><td>11/11/2026</td><td>11/11/2026</td><td>4.037.839,57</td></tr></table>`;
 it('envia nome de município como código do formulário oficial e mostra obras',async()=>{
  const fetcher=vi.fn(async (_url:string|URL,init?:RequestInit)=>{
   if(init?.method==='POST') {
    expect(String(init.body)).toContain('mun=101');
    return new Response(index,{status:200});
   }
   return new Response(index,{status:200});
  }) as unknown as typeof fetch;
  const found=await lookupTcePublic('Pedra Branca',fetcher);
  expect(found.items).toHaveLength(1);
  expect(found.items[0]?.municipality).toBe('PEDRA BRANCA');
  expect(found.items[0]?.reference).toBe('019/2026-CP');
 });
 it('envia número de procedimento pela pesquisa pública sem acessar plataformas',async()=>{
  const fetcher=vi.fn(async (_url:string|URL,init?:RequestInit)=>{
   if(init?.method==='POST') expect(String(init.body)).toContain('proc=019%2F2026-CP');
   return new Response(index,{status:200});
  }) as unknown as typeof fetch;
  const found=await lookupTcePublic('019/2026-CP',fetcher);
  expect(found.items).toHaveLength(1);
  const called=vi.mocked(fetcher).mock.calls.map((args)=>String(args[0]));
  expect(called.every((url)=>url.startsWith('https://municipios-licitacoes.tce.ce.gov.br/'))).toBe(true);
 });
});
