import { ArrowRight, BellRing, Bot, CalendarRange, Download, ExternalLink, FileText, MapPin, Radar, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse } from '../types';
import { formatCurrency, formatDate } from '../utils/bid';
import './opportunities.css';

type Category = 'CALCAMENTO' | 'PAVIMENTACAO' | 'ESCOLAS' | 'CONSTRUCAO' | 'REFORMAS' | 'DRENAGEM' | 'SANEAMENTO' | 'ESTRADAS' | 'OBRAS_GERAIS';
type Platform = 'BLL' | 'M2A' | 'LICITAMAIS' | 'COMPRASGOV' | 'PORTALCOMPRAS' | 'LICITANET' | 'BBMNET' | 'OUTRAS' | 'NAO_INFORMADA';
type Source = 'PNCP' | 'TCE';
type Settings = { minValue: number; categories: Category[]; sources: Source[]; platforms: Platform[]; sessionFrom: string | null; sessionTo: string | null; municipality: string; keywords: string; includeUnknownValue: boolean; useAi: boolean; enabled: boolean; intervalHours: number };
type Run = { id: string; status: string; progress: string; warnings: string[]; addedCount: number; startedAt: string; reports?: Array<{ source: Source; pages: number; records: number; complete: boolean; message: string }> };
type Opportunity = { id: string; municipality: string; reference: string; agency: string; object: string; estimatedValue: number | null; sessionDate: string; sessionTime: string | null; categories: Category[]; sources: Array<{ source: Source; url: string }>; platformName?: string | null; platformUrl?: string | null; phaseStatus?: 'SIM' | 'NAO' | 'NAO_IDENTIFICADA'; phaseEvidence?: string; documents?: Array<{ title: string; url: string; type: string }>; reason: string; aiReviewed: boolean; lastSeenAt: string; importedTenderId: string | null };
type Result = { items: Opportunity[]; total: number; page: number; pages: number; limited: boolean };
type Status = { settings: Settings; run: Run | null; aiAvailable: boolean };
const categories: Array<[Category, string]> = [['OBRAS_GERAIS', 'Todas as obras'], ['CALCAMENTO', 'Calçamento'], ['PAVIMENTACAO', 'Pavimentação'], ['ESCOLAS', 'Escolas e creches'], ['CONSTRUCAO', 'Construção'], ['REFORMAS', 'Reformas e ampliações'], ['DRENAGEM', 'Drenagem'], ['SANEAMENTO', 'Saneamento'], ['ESTRADAS', 'Rodovias e pontes']];
const platforms: Array<[Platform, string]> = [['BLL', 'BLL'], ['M2A', 'M2A'], ['LICITAMAIS', 'Licita Mais'], ['COMPRASGOV', 'Compras.gov.br'], ['PORTALCOMPRAS', 'Portal de Compras Públicas'], ['LICITANET', 'Licitanet'], ['BBMNET', 'BBMNET'], ['OUTRAS', 'Outras identificadas'], ['NAO_INFORMADA', 'Não informada']];
const defaults: Settings = { minValue: 1000000, categories: ['OBRAS_GERAIS'], sources: ['TCE', 'PNCP'], platforms: [], sessionFrom: null, sessionTo: null, municipality: '', keywords: '', includeUnknownValue: false, useAi: true, enabled: false, intervalHours: 6 };
const label = (source: Source) => source === 'TCE' ? 'TCE-CE' : 'PNCP';
export function OpportunitiesPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState('');
  const [phaseChecking, setPhaseChecking] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const running = status?.run?.status === 'RUNNING';
  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.get<ApiResponse<Status>>('/opportunities/status'), api.get<ApiResponse<Result>>('/opportunities', { params: { page } })]);
      setStatus(s.data.data); setResult(r.data.data);
    } catch (err) { setError(errorMessage(err)); }
  }, [page]);
  useEffect(() => {
    let active = true;
    void api.get<ApiResponse<Status>>('/opportunities/status').then((r) => { if (active) { setSettings(r.data.data.settings); setStatus(r.data.data); } }).catch((err) => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, []);
  useEffect(() => { const timeout = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timeout); }, [refresh]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [running, refresh]);
  const field = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const toggle = (key: 'categories' | 'sources' | 'platforms', value: Category | Source | Platform) => setSettings((s) => {
    const next = (s[key] as string[]).includes(value) ? (s[key] as string[]).filter((v) => v !== value) : [...s[key], value];
    return { ...s, [key]: next };
  });
  const submit = async (scan: boolean) => {
    if (busy || running) return;
    if (settings.sessionFrom && settings.sessionTo && settings.sessionFrom > settings.sessionTo) { setError('A data inicial precisa ser igual ou anterior à data final.'); return; }
    if (settings.sessionFrom && settings.sessionTo && (Date.parse(settings.sessionTo) - Date.parse(settings.sessionFrom)) / 86400000 > 180) { setError('O período máximo permitido é de 180 dias.'); return; }
    if (!settings.categories.length || !settings.sources.length || !Number.isFinite(settings.minValue) || settings.minValue < 0) { setError('Selecione ao menos um tipo de obra, uma fonte e um valor mínimo válido.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      if (scan) { const response = await api.post<ApiResponse<Run>>('/opportunities/scan', settings); setStatus((s) => s ? { ...s, settings, run: response.data.data } : { settings, aiAvailable: false, run: response.data.data }); setMessage('Agente de busca iniciado. Acompanhe os resultados nesta tela.'); }
      else { await api.put('/opportunities/settings', settings); setMessage('Filtros e monitoramento salvos.'); }
      setPage(1); await refresh();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const openDraft = async (item: Opportunity) => {
    setOpening(item.id); setError('');
    try { const response = await api.get<ApiResponse<Record<string, unknown>>>(`/opportunities/${item.id}/draft`); navigate('/licitacoes/nova', { state: { opportunityDraft: response.data.data } }); }
    catch (err) { setError(errorMessage(err)); setOpening(''); }
  };
  const checkPhase = async (item: Opportunity) => {
    setPhaseChecking(item.id); setError('');
    try { await api.post(`/opportunities/${item.id}/check-phase`, {}); await refresh(); setMessage('A análise da fase foi atualizada. Confira a evidência no edital oficial.'); }
    catch (err) { setError(errorMessage(err)); } finally { setPhaseChecking(''); }
  };
  return (
    <div className="page-stack discovery-page">
      <section className="discovery-hero">
        <div><span className="discovery-eyebrow"><Bot size={17} /> AGENTE DE MONITORAMENTO</span><h2>Seu agente de licitações de obras.</h2><p>Configure regras, execute o agente de busca ou monitore automaticamente os processos no Ceará. Consulte editais e plataformas em um só lugar.</p></div>
        <span className="discovery-ce"><MapPin size={18} /> Somente Ceará</span>
      </section>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="discovery-message" role="status">{message}</div>}
      <section className="discovery-filters">
        <div className="discovery-section-title"><div><h3>Regras do agente de busca</h3><p>Escolha obras, valores, plataformas e datas da sessão. Os mesmos filtros podem ser usados no monitoramento automático.</p></div><span className="discovery-ai-state"><Sparkles size={15} /> {status?.aiAvailable ? 'IA disponível' : 'Busca por filtros disponível'}</span></div>
        <div className="discovery-filter-grid">
          <label>Valor estimado acima de (R$)<input type="number" min="0" step="0.01" value={settings.minValue} onChange={(e) => field('minValue', e.target.value === '' ? 0 : Number(e.target.value))} /><small>{formatCurrency(String(settings.minValue))}</small></label>
          <label>Município<input placeholder="Todos os municípios do Ceará" value={settings.municipality} onChange={(e) => field('municipality', e.target.value)} maxLength={120} /></label>
          <label>Palavras adicionais<input placeholder="Ex.: drenagem, zona rural" value={settings.keywords} onChange={(e) => field('keywords', e.target.value)} maxLength={180} /><small>Todos os termos informados devem aparecer no objeto.</small></label>
        </div>
        <div className="discovery-period"><div className="discovery-period-title"><CalendarRange size={17} /><strong>Período da sessão ou prazo final de propostas</strong><small>Informe as datas exatas, como 20/11 a 20/12. Sem datas, o padrão é de 90 dias.</small></div><div className="discovery-dates"><label>De<input type="date" value={settings.sessionFrom ?? ''} onChange={(e) => field('sessionFrom', e.target.value || null)} /></label><label>Até<input type="date" value={settings.sessionTo ?? ''} onChange={(e) => field('sessionTo', e.target.value || null)} /></label></div></div>
        <fieldset className="discovery-platform-filter"><legend>Em quais plataformas deseja procurar?</legend><p>Sem nenhuma seleção, serão incluídas todas as plataformas encontradas nas fontes públicas. Se selecionar uma, só aparecerão licitações com essa plataforma identificada.</p><div className="discovery-choice-list">{platforms.map(([value, name]) => <label key={value} className={settings.platforms.includes(value) ? 'selected' : ''}><input type="checkbox" checked={settings.platforms.includes(value)} onChange={() => toggle('platforms', value)} />{name}</label>)}</div><small>Conectores com login próprio (BLL, M2A, Licita Mais e outros) ainda precisam ser autorizados e integrados. Esta busca usa as fontes públicas PNCP e TCE-CE.</small></fieldset>
        <div className="discovery-options-row">
          <fieldset><legend>Tipos de obra (selecione 'Todas as obras' para incluir qualquer obra de engenharia)</legend><div className="discovery-choice-list">{categories.map(([value, name]) => <label key={value} className={settings.categories.includes(value) ? 'selected' : ''}><input type="checkbox" checked={settings.categories.includes(value)} onChange={() => toggle('categories', value)} />{name}</label>)}</div></fieldset>
          <fieldset><legend>Fontes oficiais</legend><div className="discovery-choice-list">{(['TCE', 'PNCP'] as Source[]).map((value) => <label key={value} className={settings.sources.includes(value) ? 'selected' : ''}><input type="checkbox" checked={settings.sources.includes(value)} onChange={() => toggle('sources', value)} />{label(value)}</label>)}</div></fieldset>
        </div>
        <div className="discovery-checks">
          <label><input type="checkbox" checked={settings.includeUnknownValue} onChange={(e) => field('includeUnknownValue', e.target.checked)} /> Incluir editais sem valor publicado, identificados separadamente</label>
          <label><input type="checkbox" checked={settings.useAi && Boolean(status?.aiAvailable)} disabled={!status?.aiAvailable} onChange={(e) => field('useAi', e.target.checked)} /> Usar IA para revisar a relevância dos primeiros 20 resultados</label>
          {!status?.aiAvailable && <small>A análise por IA estará disponível quando o administrador configurar a integração. A consulta às fontes e os filtros funcionam normalmente.</small>}
        </div>
        <div className="discovery-footer-controls">
          <div className="discovery-monitor"><BellRing size={18} /><label><input type="checkbox" checked={settings.enabled} onChange={(e) => field('enabled', e.target.checked)} /> Monitorar automaticamente</label><select aria-label="Intervalo de monitoramento" value={settings.intervalHours} onChange={(e) => field('intervalHours', Number(e.target.value))}>{[1, 3, 6, 12, 24].map((n) => <option key={n} value={n}>A cada {n}h</option>)}</select></div>
          <div className="discovery-buttons"><button type="button" className="secondary-button" disabled={busy || running} onClick={() => void submit(false)}><Save size={16} />Salvar filtros</button><button type="button" className="primary-button" disabled={busy || running} onClick={() => void submit(true)}><Bot size={17} />{running ? 'Agente pesquisando...' : busy ? 'Aguarde...' : 'Agente de busca'}</button></div>
        </div>
        <small className="discovery-footnote">As datas filtram a sessão ou prazo final de propostas, não a publicação do edital. Sem período definido, são pesquisados os próximos 90 dias. O monitoramento funciona enquanto o backend estiver ativo. Buscas podem ser parciais por limites dos portais.</small>
      </section>
      {status?.run && <section className={`discovery-run ${running ? 'running' : ''}`} role="status"><div><RefreshCw size={18} className={running ? 'discovery-spin' : ''} /><strong>{status.run.progress}</strong><span>Última busca: {new Date(status.run.startedAt).toLocaleString('pt-BR')}</span></div>{status.run.reports && <div className="discovery-source-report">{status.run.reports.map((r) => <span key={r.source}>{label(r.source)} · {r.pages} página(s) · {r.complete ? 'consulta concluída' : 'consulta parcial'}</span>)}</div>}{status.run.warnings.map((w, i) => <p key={i}>{w}</p>)}</section>}
      <div className="discovery-results-heading"><div><h3>Licitações encontradas <span>{result?.total ?? 0}</span></h3><p>Fonte (PNCP/TCE-CE) e plataforma da disputa são informações diferentes; confirme edital e horário antes de participar.</p></div><button type="button" className="secondary-button compact" onClick={() => void refresh()}><RefreshCw size={15} />Atualizar lista</button></div>
      {result?.limited && <div className="alert">A lista alcançou o limite de registros. Refine os filtros e execute uma nova busca.</div>}
      {!result?.items.length && <div className="discovery-empty"><Radar size={35} /><h3>{running ? 'Consultando os portais oficiais...' : 'Sua próxima oportunidade começa aqui'}</h3><p>{running ? 'Você pode continuar usando o sistema enquanto o agente consulta os portais.' : 'Clique em Agente de busca. Se não houver correspondências, ajuste os filtros e tente novamente.'}</p></div>}
      <div className="discovery-results">{result?.items.map((item) => <article key={item.id} className="discovery-result">
        <div className="discovery-result-top"><span><MapPin size={15} />{item.municipality} · CE</span><div>{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{label(source.source)} <ExternalLink size={12} /></a>)}</div></div>
        <h3>{item.reference || 'Edital de licitação'}</h3><p className="discovery-object">{item.object.length > 400 ? `${item.object.slice(0, 400)}…` : item.object}</p>{item.object.length > 400 && <details><summary>Ver objeto completo</summary><p>{item.object}</p></details>}
        <div className="discovery-platform"><div><small>Plataforma da disputa</small><strong>{item.platformName || 'Plataforma não informada'}</strong></div>{item.platformUrl && <a href={item.platformUrl} target="_blank" rel="noopener noreferrer">Ir para plataforma <ExternalLink size={14} /></a>}</div>
        <div className="discovery-phase"><div><small>Fase inversa (habilitação antes das propostas)</small><strong>{item.phaseStatus === 'SIM' ? 'Sim' : item.phaseStatus === 'NAO' ? 'Não' : 'Não identificada — conferir edital'}</strong></div><small>{item.phaseEvidence || 'Não há confirmação nos metadados públicos. Não presumimos a ordem das fases.'}</small>{Boolean(status?.aiAvailable && item.documents?.some((d) => /edital/i.test(d.title + d.type))) && <button type="button" className="secondary-button compact" disabled={Boolean(phaseChecking) || running} onClick={() => void checkPhase(item)}><Sparkles size={14} />{phaseChecking === item.id ? 'Lendo edital...' : 'Analisar fase no edital com IA'}</button>}</div>
        <div className="discovery-documents"><strong><FileText size={16} /> Arquivos da obra / edital</strong>{item.documents?.length ? <div className="discovery-doc-list">{item.documents.map((doc) => <a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer"><Download size={14} />{doc.title}</a>)}</div> : <p>Nenhum arquivo catalogado automaticamente. Confira os anexos no link oficial da licitação.</p>}<small>Links oficiais do PNCP, guardados junto ao resultado para download quando disponíveis. O PDF não é armazenado no servidor do LicitaGestão nesta versão.</small></div>
        <div className="discovery-result-meta"><div><small>Valor estimado</small><strong>{item.estimatedValue === null ? 'Não publicado' : formatCurrency(String(item.estimatedValue))}</strong></div><div><small>Abertura / prazo de propostas</small><strong>{formatDate(item.sessionDate)}{item.sessionTime ? ` · ${item.sessionTime}` : ''}</strong>{!item.sessionTime && <small>Confira o horário no edital</small>}</div></div>
        <div className="discovery-tags">{item.categories.map((category) => <span key={category}>{categories.find(([c]) => c === category)?.[1]}</span>)}<span className={item.aiReviewed ? 'ai' : ''}>{item.aiReviewed ? 'Revisada por IA' : 'Classificada por filtros'}</span></div>
        <p className="discovery-reason">{item.reason}</p>
        <footer><small>Conferida em {new Date(item.lastSeenAt).toLocaleString('pt-BR')}</small>{item.importedTenderId ? <Link className="secondary-button compact" to={`/licitacoes/${item.importedTenderId}`}>Abrir no controle <ArrowRight size={15} /></Link> : <button type="button" className="primary-button compact" disabled={Boolean(opening)} onClick={() => void openDraft(item)}>{opening === item.id ? 'Abrindo...' : 'Adicionar ao LicitaGestão'}<ArrowRight size={15} /></button>}</footer>
      </article>)}</div>
      {result && result.pages > 1 && <div className="pagination"><span>{result.total} oportunidades</span><div><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</button><span>{page} de {result.pages}</span><button disabled={page === result.pages} onClick={() => setPage((p) => p + 1)}>Próxima</button></div></div>}
    </div>
  );
}
