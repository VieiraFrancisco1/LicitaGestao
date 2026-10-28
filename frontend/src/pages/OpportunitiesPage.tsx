import { ArrowRight, BellRing, Bot, CalendarRange, ChevronDown, ChevronUp, Download, ExternalLink, FileText, FolderOpen, MapPin, Radar, RefreshCw, Save, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse } from '../types';
import { formatCurrency, formatDate } from '../utils/bid';
import './opportunities.css';

type Category = 'CALCAMENTO' | 'OBRAS_GERAIS' | 'UBS' | 'CRECHES' | 'INTERTRAVADO' | 'PAVIMENTACAO' | 'PASSAGEM_MOLHADA' | 'REFORMAS' | 'PRACAS' | 'DRENAGEM' | 'SANEAMENTO' | 'ASFALTO' | 'ILUMINACAO' | 'REVITALIZACAO' | 'ESTRADAS' | 'URBANIZACAO' | 'MANUTENCAO_PREDIAL' | 'ESTRADAS_VICINAIS' | 'UNIDADES_HABITACIONAIS' | 'ABASTECIMENTO' | 'ESCOLAS' | 'CEI' | 'CONSTRUCAO';
type Platform = 'BLL' | 'M2A' | 'LICITAMAIS' | 'COMPRASGOV' | 'PORTALCOMPRAS' | 'LICITANET' | 'BBMNET' | 'OUTRAS' | 'NAO_INFORMADA';
type Source = 'PNCP' | 'TCE';
type Settings = { minValue: number; categories: Category[]; sources: Source[]; platforms: Platform[]; sessionFrom: string | null; sessionTo: string | null; municipality: string; keywords: string; includeUnknownValue: boolean; useAi: boolean; enabled: boolean; intervalHours: number };
type Run = { id: string; status: string; progress: string; warnings: string[]; addedCount: number; startedAt: string; reports?: Array<{ source: Source; pages: number; records: number; complete: boolean; message: string }> };
type Opportunity = { id: string; municipality: string; reference: string; agency: string; object: string; estimatedValue: number | null; sessionDate: string; sessionTime: string | null; categories: Category[]; sources: Array<{ source: Source; url: string }>; platformName?: string | null; platformUrl?: string | null; phaseStatus?: 'SIM' | 'NAO' | 'NAO_IDENTIFICADA'; phaseEvidence?: string; documents?: Array<{ title: string; url: string; type: string }>; reason: string; aiReviewed: boolean; lastSeenAt: string; importedTenderId: string | null };
type Result = { items: Opportunity[]; total: number; allTotal: number; platformCounts: Partial<Record<Platform, number>>; page: number; pages: number; limited: boolean };
type Status = { settings: Settings; run: Run | null; aiAvailable: boolean };
type LoginPlatform = 'BLL' | 'M2A' | 'LICITAMAIS';
type LoginStatus = { storageReady: boolean; automationReady: boolean; items: Array<{ platform: LoginPlatform; saved: boolean; updatedAt: string }> };

const categories: Array<[Category, string]> = [
  ['UBS', 'UBS'], ['CRECHES', 'Creches'], ['INTERTRAVADO', 'Intertravado'], ['PAVIMENTACAO', 'Pavimentação'],
  ['PASSAGEM_MOLHADA', 'Passagem molhada'], ['REFORMAS', 'Reformas'], ['PRACAS', 'Praças'], ['DRENAGEM', 'Drenagem'],
  ['SANEAMENTO', 'Saneamento'], ['ASFALTO', 'Asfalto'], ['ILUMINACAO', 'Iluminação pública'], ['REVITALIZACAO', 'Revitalização'],
  ['ESTRADAS', 'Estradas'], ['URBANIZACAO', 'Urbanização'], ['MANUTENCAO_PREDIAL', 'Manutenção predial'],
  ['ESTRADAS_VICINAIS', 'Estradas vicinais'], ['UNIDADES_HABITACIONAIS', 'Unidades habitacionais'],
  ['ABASTECIMENTO', 'Abastecimento de água'], ['ESCOLAS', 'Escolas'], ['CEI', 'CEI'], ['CONSTRUCAO', 'Construção']
];
const platforms: Array<[Platform, string]> = [
  ['BLL', 'BLL Compras'], ['M2A', 'M2A Compras'], ['LICITAMAIS', 'Licita Mais'],
  ['COMPRASGOV', 'Compras.gov.br'], ['PORTALCOMPRAS', 'Portal de Compras Públicas'],
  ['LICITANET', 'Licitanet'], ['BBMNET', 'BBMNET'], ['OUTRAS', 'Outras plataformas'],
  ['NAO_INFORMADA', 'Plataforma não informada']
];
const labels: Record<Category, string> = { ...Object.fromEntries(categories), CALCAMENTO: 'Calçamento', OBRAS_GERAIS: 'Obras em geral' } as Record<Category, string>;
const defaults: Settings = { minValue: 1000000, categories: categories.map(([c]) => c), sources: ['TCE', 'PNCP'], platforms: [], sessionFrom: null, sessionTo: null, municipality: '', keywords: '', includeUnknownValue: false, useAi: true, enabled: false, intervalHours: 6 };
const sourceLabel = (source: Source) => source === 'TCE' ? 'TCE-CE' : 'PNCP';
const platformLabel = (key: Platform) => platforms.find(([p]) => p === key)?.[1] ?? key;

export function OpportunitiesPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null);
  const [showTypes, setShowTypes] = useState(false);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState('');
  const [phaseChecking, setPhaseChecking] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loginPanelOpen, setLoginPanelOpen] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus | null>(null);
  const [loginPlatform, setLoginPlatform] = useState<LoginPlatform>('BLL');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSaving, setLoginSaving] = useState(false);
  const running = status?.run?.status === 'RUNNING';

  const refresh = useCallback(async () => {
    try {
      const params = { page, ...(activePlatform ? { platform: activePlatform } : {}) };
      const [s, r] = await Promise.all([
        api.get<ApiResponse<Status>>('/opportunities/status'),
        api.get<ApiResponse<Result>>('/opportunities', { params })
      ]);
      setStatus(s.data.data);
      setResult(r.data.data);
    } catch (err) { setError(errorMessage(err)); }
  }, [page, activePlatform]);
  useEffect(() => {
    let active = true;
    void api.get<ApiResponse<Status>>('/opportunities/status').then((r) => {
      if (active) {
        setSettings(r.data.data.settings);
        setStatus(r.data.data);
      }
    }).catch((err) => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, []);
  useEffect(() => { const handle = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(handle); }, [refresh]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [running, refresh]);
  useEffect(() => {
    let active = true;
    void api.get<ApiResponse<LoginStatus>>('/opportunities/platform-logins').then((r) => {
      if (active) setLoginStatus(r.data.data);
    }).catch(() => { if (active) setLoginStatus(null); });
    return () => { active = false; };
  }, []);
  const saveLogin = async () => {
    if (!loginUsername.trim() || !loginPassword || loginSaving) return;
    setLoginSaving(true); setError('');
    try {
      await api.post('/opportunities/platform-logins', { platform: loginPlatform, username: loginUsername, password: loginPassword });
      const response = await api.get<ApiResponse<LoginStatus>>('/opportunities/platform-logins');
      setLoginStatus(response.data.data); setLoginUsername(''); setLoginPassword('');
      setMessage('Credenciais protegidas e salvas. A automação de login exigirá a ativação do conector desta plataforma.');
    } catch (err) { setError(errorMessage(err)); } finally { setLoginSaving(false); }
  };
  const removeLogin = async (p: LoginPlatform) => {
    setLoginSaving(true); setError('');
    try {
      await api.delete(`/opportunities/platform-logins/${p}`);
      const response = await api.get<ApiResponse<LoginStatus>>('/opportunities/platform-logins');
      setLoginStatus(response.data.data); setMessage('Credenciais removidas desta plataforma.');
    } catch (err) { setError(errorMessage(err)); } finally { setLoginSaving(false); }
  };
  const field = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const toggle = (key: 'categories' | 'sources' | 'platforms', value: Category | Source | Platform) => setSettings((s) => {
    const next = (s[key] as string[]).includes(value) ? (s[key] as string[]).filter((v) => v !== value) : [...s[key], value];
    return { ...s, [key]: next };
  });
  const submit = async (scan: boolean) => {
    if (busy || running) return;
    if (settings.sessionFrom && settings.sessionTo && settings.sessionFrom > settings.sessionTo) { setError('A data inicial precisa ser anterior à final.'); return; }
    if (settings.sessionFrom && settings.sessionTo && (Date.parse(settings.sessionTo) - Date.parse(settings.sessionFrom)) / 86400000 > 180) { setError('O período máximo permitido é de 180 dias.'); return; }
    if (!settings.categories.length || !settings.sources.length || !Number.isFinite(settings.minValue) || settings.minValue < 0) { setError('Selecione pelo menos um tipo de obra, uma fonte e um valor válido.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      if (scan) {
        const response = await api.post<ApiResponse<Run>>('/opportunities/scan', settings);
        setStatus((s) => s ? { ...s, settings, run: response.data.data } : { settings, aiAvailable: false, run: response.data.data });
        setMessage('Agente iniciado. As plataformas identificadas aparecerão abaixo quando houver resultados.');
      } else {
        await api.put('/opportunities/settings', settings);
        setMessage('Regras e monitoramento salvos.');
      }
      setPage(1); setActivePlatform(null);
      await refresh();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const openDraft = async (item: Opportunity) => {
    setOpening(item.id); setError('');
    try {
      const response = await api.get<ApiResponse<Record<string, unknown>>>(`/opportunities/${item.id}/draft`);
      navigate('/licitacoes/nova', { state: { opportunityDraft: response.data.data } });
    } catch (err) { setError(errorMessage(err)); setOpening(''); }
  };
  const checkPhase = async (item: Opportunity) => {
    setPhaseChecking(item.id); setError('');
    try { await api.post(`/opportunities/${item.id}/check-phase`, {}); await refresh(); setMessage('Análise atualizada. Confira o trecho citado no edital.'); }
    catch (err) { setError(errorMessage(err)); } finally { setPhaseChecking(''); }
  };
  const choosePlatform = (value: Platform) => {
    setPage(1);
    setActivePlatform((old) => old === value ? null : value);
    setOpenFiles([]);
  };
  const toggleFiles = (id: string) => setOpenFiles((old) => old.includes(id) ? old.filter((v) => v !== id) : [...old, id]);
  const counts = result?.platformCounts ?? {};
  const count = result?.allTotal ?? 0;
  const groups = platforms.filter(([p]) => (counts[p] ?? 0) > 0);
  return (
    <div className="page-stack discovery-page">
      <section className="discovery-hero">
        <div><span className="discovery-eyebrow"><Bot size={17} /> AGENTE DE MONITORAMENTO</span><h2>Licitações de obras em um só lugar</h2><p>Defina suas regras, execute o agente e consulte os resultados organizados por plataforma. Fortaleza e Eusébio ficam fora das buscas.</p></div>
        <span className="discovery-ce"><MapPin size={18} /> Ceará · interior e demais municípios</span>
      </section>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="discovery-message" role="status">{message}</div>}
      <section className="discovery-filters">
        <div className="discovery-section-title"><div><h3>Regras do agente</h3><p>Valor e período ficam sempre visíveis. Abra os filtros apenas para escolher tipos de obra.</p></div><span className="discovery-ai-state"><Sparkles size={15} /> {status?.aiAvailable ? 'IA disponível' : 'Busca por filtros'}</span></div>
        <div className="agent-primary-controls">
          <label>Valor acima de (R$)<input type="number" min="0" step="0.01" value={settings.minValue} onChange={(e) => field('minValue', e.target.value === '' ? 0 : Number(e.target.value))} /></label>
          <label>Data inicial<input type="date" value={settings.sessionFrom ?? ''} onChange={(e) => field('sessionFrom', e.target.value || null)} /></label>
          <label>Data final<input type="date" value={settings.sessionTo ?? ''} onChange={(e) => field('sessionTo', e.target.value || null)} /></label>
          <button type="button" className="primary-button agent-search-button" disabled={busy || running} onClick={() => void submit(true)}><Bot size={18} />{running ? 'Pesquisando...' : busy ? 'Iniciando...' : 'Agente de busca'}</button>
        </div>
        <div className="agent-type-control">
          <button type="button" className="secondary-button agent-filter-toggle" onClick={() => setShowTypes((v) => !v)} aria-expanded={showTypes} aria-controls="agent-work-types"><SlidersHorizontal size={16} /> Filtros de obras ({settings.categories.includes('OBRAS_GERAIS') ? 'Todas' : settings.categories.length}) {showTypes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
          {showTypes && <div id="agent-work-types" className="agent-type-panel">
            <div className="agent-type-header"><strong>Tipos de obras</strong><div><button type="button" className="secondary-button compact" onClick={() => field('categories', categories.map(([p]) => p))}>Marcar todos</button><button type="button" className="secondary-button compact" onClick={() => field('categories', [])}>Limpar</button></div></div>
            <div className="agent-type-list">{categories.map(([c, title]) => <label key={c} className={settings.categories.includes(c) || settings.categories.includes('OBRAS_GERAIS') ? 'selected' : ''}><input type="checkbox" checked={settings.categories.includes(c) || settings.categories.includes('OBRAS_GERAIS')} onChange={() => { const current = settings.categories.includes('OBRAS_GERAIS') ? categories.map(([x]) => x) : settings.categories; field('categories', current.includes(c) ? current.filter((x) => x !== c) : [...current, c]); }} />{title}</label>)}</div>
            <button type="button" className="secondary-button" onClick={() => setShowTypes(false)}>Aplicar filtros e fechar</button>
          </div>}
        </div>
        <fieldset className="agent-platform-filter"><legend>Plataformas a considerar</legend><div className="discovery-choice-list">{platforms.map(([p, title]) => <label key={p} className={settings.platforms.includes(p) ? 'selected' : ''}><input type="checkbox" checked={settings.platforms.includes(p)} onChange={() => toggle('platforms', p)} />{title}</label>)}</div><small>Nenhuma marcada = todas. Esta versão consulta PNCP e TCE-CE e identifica a plataforma indicada nos dados. A navegação autenticada por Playwright precisa de conectores próprios.</small></fieldset>
        <div className="agent-secondary-controls">
          <label>Município (opcional)<input placeholder="Qualquer, exceto Fortaleza e Eusébio" value={settings.municipality} onChange={(e) => field('municipality', e.target.value)} maxLength={120} /></label>
          <label>Palavras adicionais (opcional)<input placeholder="Ex.: zona rural" value={settings.keywords} onChange={(e) => field('keywords', e.target.value)} maxLength={180} /></label>
        </div>
        <div className="agent-advanced-controls">
          <div className="discovery-checks">
            <label><input type="checkbox" checked={settings.includeUnknownValue} onChange={(e) => field('includeUnknownValue', e.target.checked)} /> Incluir obras sem valor informado</label>
            <label><input type="checkbox" checked={settings.useAi && Boolean(status?.aiAvailable)} disabled={!status?.aiAvailable} onChange={(e) => field('useAi', e.target.checked)} /> Usar IA na classificação dos primeiros 20 resultados</label>
          </div>
          <div className="agent-source-control"><strong>Fontes</strong>{(['TCE', 'PNCP'] as Source[]).map((source) => <label key={source}><input type="checkbox" checked={settings.sources.includes(source)} onChange={() => toggle('sources', source)} />{sourceLabel(source)}</label>)}</div>
        </div>
        <div className="discovery-footer-controls"><div className="discovery-monitor"><BellRing size={18} /><label><input type="checkbox" checked={settings.enabled} onChange={(e) => field('enabled', e.target.checked)} /> Monitorar automaticamente as fontes públicas</label><select aria-label="Intervalo" value={settings.intervalHours} onChange={(e) => field('intervalHours', Number(e.target.value))}>{[1, 3, 6, 12, 24].map((n) => <option key={n} value={n}>A cada {n}h</option>)}</select></div><button type="button" className="secondary-button" disabled={busy || running} onClick={() => void submit(false)}><Save size={15} /> Salvar regras</button></div>
        <small className="discovery-footnote">Período: data da sessão ou prazo final de propostas. Sem datas, próximos 90 dias. O monitoramento depende do servidor ativo. Municípios correspondem aos dados da fonte; verifique no edital o local efetivo da obra.</small>
      </section>
      <section className="agent-accounts">
        <button type="button" className="secondary-button agent-accounts-toggle" onClick={() => setLoginPanelOpen((v) => !v)} aria-expanded={loginPanelOpen}>
          <SlidersHorizontal size={15} /> Contas das plataformas {loginStatus?.items.length ? `(${loginStatus.items.length} salva(s))` : ''}{loginPanelOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {loginPanelOpen && <div className="agent-accounts-body">
          <p>Cadastre usuário e senha somente nesta área protegida do LicitaGestão. As senhas são criptografadas no banco e nunca retornam ao navegador. <strong>Os conectores de navegação automática ainda estão em validação:</strong> credenciais salvas não significam acesso automatizado ativo.</p>
          {!loginStatus?.storageReady && <p className="agent-vault-warning">Antes de salvar logins, configure a variável PLATFORM_CREDENTIAL_ENCRYPTION_KEY no Render e publique o backend da V56.</p>}
          <div className="agent-account-list">{(['BLL', 'M2A', 'LICITAMAIS'] as LoginPlatform[]).map((p) => <div key={p}><strong>{platformLabel(p)}</strong><small>{loginStatus?.items.some((v) => v.platform === p) ? 'Credenciais salvas · conector em preparação' : 'Sem credenciais'}</small>{loginStatus?.items.some((v) => v.platform === p) && <button type="button" className="secondary-button compact" disabled={loginSaving} onClick={() => void removeLogin(p)}>Remover</button>}</div>)}</div>
          <div className="agent-account-form">
            <label>Plataforma<select value={loginPlatform} onChange={(e) => setLoginPlatform(e.target.value as LoginPlatform)}><option value="BLL">BLL Compras</option><option value="M2A">M2A Compras</option><option value="LICITAMAIS">Licita Mais</option></select></label>
            <label>Login<input autoComplete="off" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Usuário ou e-mail" /></label>
            <label>Senha<input type="password" autoComplete="new-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Senha da plataforma" /></label>
            <button type="button" className="secondary-button" disabled={!loginStatus?.storageReady || loginSaving || !loginUsername.trim() || !loginPassword} onClick={() => void saveLogin()}>{loginSaving ? 'Salvando...' : 'Salvar credenciais'}</button>
          </div>
          <small>Não envie senhas por mensagens. O sistema não solicita nem contorna CAPTCHA, 2FA ou bloqueios da plataforma.</small>
        </div>}
      </section>
      {status?.run && <section className={`discovery-run ${running ? 'running' : ''}`} role="status"><div><RefreshCw size={18} className={running ? 'discovery-spin' : ''} /><strong>{status.run.progress}</strong><span>Última busca: {new Date(status.run.startedAt).toLocaleString('pt-BR')}</span></div>{status.run.reports && <div className="discovery-source-report">{status.run.reports.map((r) => <span key={r.source}>{sourceLabel(r.source)} · {r.pages} página(s) · {r.complete ? 'concluída' : 'parcial'}</span>)}</div>}{status.run.warnings.map((w, i) => <p key={i}>{w}</p>)}</section>}
      <div className="discovery-results-heading"><div><h3>Resultados do agente <span>{count}</span></h3><p>Clique no card da plataforma para consultar as licitações encontradas.</p></div><button type="button" className="secondary-button compact" onClick={() => void refresh()}><RefreshCw size={15} /> Atualizar</button></div>
      {result?.limited && <div className="alert">A lista atingiu o limite de registros. Refine as regras e pesquise novamente.</div>}
      {groups.length > 0 && <div className="agent-platform-groups">{groups.map(([key, title]) => <button type="button" key={key} className={`agent-platform-card ${activePlatform === key ? 'active' : ''}`} onClick={() => choosePlatform(key)} aria-pressed={activePlatform === key}><span className="agent-platform-card-top"><FileText size={20} /><span className="agent-platform-count">{counts[key]}</span></span><strong>{title}</strong><small>{activePlatform === key ? 'Fechar lista' : 'Ver licitações'}</small>{activePlatform === key ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>)}</div>}
      {!count && <div className="discovery-empty"><Radar size={35} /><h3>{running ? 'O agente está pesquisando...' : 'Nenhuma oportunidade encontrada'}</h3><p>{running ? 'As plataformas serão agrupadas quando as fontes responderem.' : 'Clique em Agente de busca e confira as datas, valor e tipos de obras selecionados.'}</p></div>}
      {count > 0 && !activePlatform && <div className="agent-select-hint"><CalendarRange size={18} /> Selecione uma plataforma acima para abrir suas licitações.</div>}
      {activePlatform && <div className="agent-selected-heading"><h3>{platformLabel(activePlatform)} <span>· {result?.total ?? 0} licitações</span></h3><button className="secondary-button compact" type="button" onClick={() => choosePlatform(activePlatform)}>Fechar</button></div>}
      {activePlatform && <div className="discovery-results">{result?.items.map((item) => <article key={item.id} className="discovery-result">
        <div className="discovery-result-top"><span><MapPin size={15} />{item.municipality} · CE</span><div>{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{sourceLabel(source.source)} <ExternalLink size={12} /></a>)}</div></div>
        <h3>{item.reference || 'Licitação de obras'}</h3><p className="discovery-object">{item.object.length > 300 ? `${item.object.slice(0, 300)}…` : item.object}</p>{item.object.length > 300 && <details><summary>Ver objeto completo</summary><p>{item.object}</p></details>}
        <div className="discovery-result-meta"><div><small>Valor estimado</small><strong>{item.estimatedValue === null ? 'Não informado' : formatCurrency(String(item.estimatedValue))}</strong></div><div><small>Data da sessão</small><strong>{formatDate(item.sessionDate)}{item.sessionTime ? ` · ${item.sessionTime}` : ''}</strong></div><div><small>Órgão responsável</small><strong className="agent-agency-name">{item.agency || 'Não informado'}</strong></div><div><small>Fase inversa</small><strong className={`agent-phase-label ${item.phaseStatus === 'SIM' ? 'yes' : item.phaseStatus === 'NAO' ? 'no' : ''}`}>{item.phaseStatus === 'SIM' ? 'Sim' : item.phaseStatus === 'NAO' ? 'Não' : 'Não identificada'}</strong></div></div>
        {item.phaseEvidence && <p className="agent-phase-evidence">{item.phaseEvidence}</p>}
        <div className="discovery-tags">{item.categories.filter((c) => c !== 'OBRAS_GERAIS').slice(0, 4).map((c) => <span key={c}>{labels[c]}</span>)}<span className={item.aiReviewed ? 'ai' : ''}>{item.aiReviewed ? 'Analisada por IA' : 'Filtrada pelo agente'}</span></div>
        <div className="agent-card-actions"><button type="button" className="secondary-button compact" onClick={() => toggleFiles(item.id)} aria-expanded={openFiles.includes(item.id)}><FolderOpen size={16} />Arquivos ({item.documents?.length ?? 0}){openFiles.includes(item.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>{item.platformUrl && <a className="secondary-button compact" href={item.platformUrl} target="_blank" rel="noopener noreferrer">Plataforma <ExternalLink size={14} /></a>}{Boolean(status?.aiAvailable && item.documents?.some((d) => /edital/i.test(d.title + d.type))) && <button type="button" className="secondary-button compact" disabled={Boolean(phaseChecking) || running} onClick={() => void checkPhase(item)}><Sparkles size={15} />{phaseChecking === item.id ? 'Analisando...' : 'Analisar fase'}</button>}</div>
        {openFiles.includes(item.id) && <div className="agent-files-panel"><strong>Arquivos disponíveis</strong>{item.documents?.length ? item.documents.map((doc) => <a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer"><Download size={15} />{doc.title}<ExternalLink size={13} /></a>) : <p>Não foram encontrados arquivos acessíveis. Abra a publicação oficial e confira os anexos.</p>}<small>Abre o documento oficial em nova aba. Conforme o portal, o navegador pode exibir o PDF ou iniciar o download. Nenhuma cópia é armazenada no LicitaGestão.</small></div>}
        <footer><small>Encontrada em {new Date(item.lastSeenAt).toLocaleString('pt-BR')}</small>{item.importedTenderId ? <Link className="secondary-button compact" to={`/licitacoes/${item.importedTenderId}`}>Abrir no controle <ArrowRight size={15} /></Link> : <button type="button" className="primary-button compact" disabled={Boolean(opening)} onClick={() => void openDraft(item)}>{opening === item.id ? 'Abrindo...' : 'Adicionar ao Controle Geral'}<ArrowRight size={15} /></button>}</footer>
      </article>)}</div>}
      {activePlatform && result && result.pages > 1 && <div className="pagination"><span>{result.total} oportunidades nesta plataforma</span><div><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</button><span>{page} de {result.pages}</span><button disabled={page === result.pages} onClick={() => setPage((p) => p + 1)}>Próxima</button></div></div>}
    </div>
  );
}
