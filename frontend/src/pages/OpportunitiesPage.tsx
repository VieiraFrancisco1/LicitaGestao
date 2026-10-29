import { ArrowRight, BellRing, Bot, CalendarRange, ChevronDown, ChevronUp, Download, ExternalLink, FileText, FolderOpen, MapPin, Radar, RefreshCw, Save, SlidersHorizontal, Plug, Settings2, Eraser, MonitorPlay, X, ListPlus, CheckCircle2 } from 'lucide-react';
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
type Result = { items: Opportunity[]; total: number; allTotal: number; platformGroups?: Array<{ key: string; title: string; count: number }>; platformCounts: Partial<Record<Platform, number>>; page: number; pages: number; limited: boolean };
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
  ['LICITANET', 'Licitanet'], ['BBMNET', 'BBMNET'],
  ['NAO_INFORMADA', 'Plataforma não identificada']
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
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [showTypes, setShowTypes] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [openDetails, setOpenDetails] = useState<string[]>([]);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loginPanelOpen, setLoginPanelOpen] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus | null>(null);
  const [loginPlatform, setLoginPlatform] = useState<LoginPlatform>('BLL');
  const [editingLogin, setEditingLogin] = useState<LoginPlatform | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSaving, setLoginSaving] = useState(false);
  const [testingLogin, setTestingLogin] = useState<LoginPlatform | null>(null);
  const [loginTestResults, setLoginTestResults] = useState<Partial<Record<LoginPlatform, string>>>({});
  const [resultsCleared, setResultsCleared] = useState(false);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  const [queueSaving, setQueueSaving] = useState('');
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
  useEffect(() => {
    let live = true;
    void api.get<ApiResponse<Array<{ opportunityId: string }>>>('/weekly-list')
      .then(({ data }) => { if (live) setQueuedIds(data.data.map((item) => item.opportunityId)); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  const sendToWeeklyList = async (id: string) => {
    if (queueSaving || queuedIds.includes(id)) return;
    setQueueSaving(id); setError('');
    try {
      await api.post('/weekly-list', { opportunityId: id });
      setQueuedIds((current) => current.includes(id) ? current : [...current, id]);
      setMessage('Licitação enviada para a lista semanal. Abra Licitações → Lista semanal para conferir.');
    } catch (err) { setError(errorMessage(err)); }
    finally { setQueueSaving(''); }
  };
  const saveLogin = async () => {
    if (!loginUsername.trim() || !loginPassword || loginSaving) return;
    setLoginSaving(true); setError('');
    try {
      await api.post('/opportunities/platform-logins', { platform: loginPlatform, username: loginUsername, password: loginPassword });
      const response = await api.get<ApiResponse<LoginStatus>>('/opportunities/platform-logins');
      setLoginStatus(response.data.data); setLoginUsername(''); setLoginPassword(''); setEditingLogin(null);
      setMessage('Credenciais protegidas e salvas. A automação de login exigirá a ativação do conector desta plataforma.');
    } catch (err) { setError(errorMessage(err)); } finally { setLoginSaving(false); }
  };
  const testLogin = async (p: LoginPlatform) => {
    setTestingLogin(p); setError('');
    try {
      const response = await api.post<ApiResponse<{ status: string; message: string }>>(`/opportunities/platform-logins/${p}/test`, {}, { timeout: 75000 });
      setLoginTestResults((current) => ({ ...current, [p]: `${response.data.data.status === 'VERIFIED' ? 'Acesso confirmado' : 'Teste pendente'}: ${response.data.data.message}` }));
    } catch (err) { setLoginTestResults((current) => ({ ...current, [p]: errorMessage(err) })); }
    finally { setTestingLogin(null); }
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
    if (scan) setResultsCleared(false);
    if (scan) { setShowTypes(false); setShowAdvanced(false); setLoginPanelOpen(false); }
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
  const clearSearch = () => {
    if (busy || running) return;
    setSettings(defaults); setResult(null); setPage(1); setActivePlatform(null);
    setOpenFiles([]); setOpenDetails([]); setShowTypes(false); setShowAdvanced(false);
    setResultsCleared(true); setError(''); setMessage('Busca limpa. Selecione novos filtros e clique em Agente de busca.');
  };
  const openDraft = async (item: Opportunity) => {
    setOpening(item.id); setError('');
    try {
      const response = await api.get<ApiResponse<Record<string, unknown>>>(`/opportunities/${item.id}/draft`, { timeout: 125000 });
      navigate('/licitacoes/nova', { state: { opportunityDraft: response.data.data } });
    } catch (err) { setError(errorMessage(err)); setOpening(''); }
  };
  const choosePlatform = (value: string) => {
    setPage(1);
    setActivePlatform((old) => old === value ? null : value);
    setOpenFiles([]);
    setOpenDetails([]);
  };
  const toggleFiles = (id: string) => setOpenFiles((old) => old.includes(id) ? old.filter((v) => v !== id) : [...old, id]);
  const toggleDetails = (id: string) => setOpenDetails((old) => old.includes(id) ? old.filter((v) => v !== id) : [...old, id]);
  const counts = result?.platformCounts ?? {};
  const count = resultsCleared ? 0 : (result?.allTotal ?? 0);
  const groups = resultsCleared ? [] : (result?.platformGroups ?? platforms.filter(([key]) => (counts[key] ?? 0) > 0).map(([key, title]) => ({ key, title, count: counts[key] ?? 0 })));
  const selectedPlatformName = groups.find((g) => g.key === activePlatform)?.title ?? 'Plataforma não identificada';
  return (
    <div className="page-stack discovery-page">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="discovery-filters">
        <div className="discovery-section-title"><h2>Agente de Monitoramento</h2></div>
        <div className="agent-primary-controls">
          <label>Valor acima de (R$)<input type="number" min="0" step="0.01" value={settings.minValue} onChange={(e) => field('minValue', e.target.value === '' ? 0 : Number(e.target.value))} /></label>
          <label>Data inicial<input type="date" value={settings.sessionFrom ?? ''} onChange={(e) => field('sessionFrom', e.target.value || null)} /></label>
          <label>Data final<input type="date" value={settings.sessionTo ?? ''} onChange={(e) => field('sessionTo', e.target.value || null)} /></label>
          <div className="agent-search-actions">
            <button type="button" className="primary-button agent-search-button" disabled={busy || running} onClick={() => void submit(true)}><Bot size={18} />{running ? 'Pesquisando...' : busy ? 'Iniciando...' : 'Agente de busca'}</button>
            <button type="button" className="secondary-button" disabled={busy || running} onClick={clearSearch} title="Limpar os filtros e ocultar os resultados sem excluir licitações salvas"><Eraser size={16} />Limpar busca</button>
          </div>
        </div>
        {message && <p className="agent-inline-feedback" role="status">{message}</p>}
        <div className="agent-quick-panels">
        <div className={`agent-type-control ${showTypes ? 'expanded' : ''}`}>
          <button type="button" className="agent-section-toggle" onClick={() => { setShowTypes((v) => !v); setShowAdvanced(false); setLoginPanelOpen(false); }} aria-expanded={showTypes} aria-controls="agent-work-types"><span className="agent-section-toggle-left"><SlidersHorizontal size={18} /><span><strong>Filtros de obras</strong><small>{settings.categories.includes('OBRAS_GERAIS') ? 'Todas as obras selecionadas' : `${settings.categories.length} tipo(s) selecionado(s)`}</small></span></span>{showTypes ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          {showTypes && <div id="agent-work-types" className="agent-type-panel">
            <div className="agent-type-header"><strong>Tipos de obras</strong><div><button type="button" className="secondary-button compact" onClick={() => field('categories', categories.map(([p]) => p))}>Marcar todos</button><button type="button" className="secondary-button compact" onClick={() => field('categories', [])}>Limpar</button></div></div>
            <div className="agent-type-list">{categories.map(([c, title]) => <label key={c} className={settings.categories.includes(c) || settings.categories.includes('OBRAS_GERAIS') ? 'selected' : ''}><input type="checkbox" checked={settings.categories.includes(c) || settings.categories.includes('OBRAS_GERAIS')} onChange={() => { const current = settings.categories.includes('OBRAS_GERAIS') ? categories.map(([x]) => x) : settings.categories; field('categories', current.includes(c) ? current.filter((x) => x !== c) : [...current, c]); }} />{title}</label>)}</div>
            <button type="button" className="secondary-button" onClick={() => setShowTypes(false)}>Aplicar filtros e fechar</button>
          </div>}
        </div>
        <div className={`agent-settings-control ${showAdvanced ? 'expanded' : ''}`}>
          <button type="button" className="agent-section-toggle" onClick={() => { setShowAdvanced((v) => !v); setShowTypes(false); setLoginPanelOpen(false); }} aria-expanded={showAdvanced} aria-controls="agent-extra-settings">
            <span className="agent-section-toggle-left"><Settings2 size={18} /><span><strong>Mais opções</strong><small>Pesquisa e monitoramento</small></span></span>
            {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showAdvanced && <div id="agent-extra-settings" className="agent-settings-panel">
        <fieldset className="agent-platform-filter"><legend>Plataformas a considerar</legend><div className="discovery-choice-list">{platforms.map(([p, title]) => <label key={p} className={settings.platforms.includes(p) ? 'selected' : ''}><input type="checkbox" checked={settings.platforms.includes(p)} onChange={() => toggle('platforms', p)} />{title}</label>)}<button type="button" className="secondary-button compact" onClick={() => field('platforms', [])}>Todas</button></div><small>Nenhuma marcada = todas. Esta versão consulta PNCP e TCE-CE e identifica a plataforma indicada nos dados. A navegação autenticada por Playwright precisa de conectores próprios.</small></fieldset>
        <div className="agent-secondary-controls">
          <label>Município (opcional)<input placeholder="Qualquer município" value={settings.municipality} onChange={(e) => field('municipality', e.target.value)} maxLength={120} /></label>
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
        <small className="discovery-footnote">O monitoramento exige servidor ativo. Confira no edital o local onde a obra será executada.</small>
          </div>}
        </div>
        <div className={`agent-accounts ${loginPanelOpen ? 'expanded' : ''}`}>
        <button type="button" className="agent-section-toggle" onClick={() => { setLoginPanelOpen((v) => !v); setShowTypes(false); setShowAdvanced(false); }} aria-expanded={loginPanelOpen} aria-controls="agent-saved-logins">
          <span className="agent-section-toggle-left"><Plug size={17} /><span><strong>Plataformas</strong><small>{loginStatus?.items.length ? `${loginStatus.items.length} cadastrada(s)` : 'Conectar contas'}</small></span></span>
          {loginPanelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {loginPanelOpen && <div id="agent-saved-logins" className="agent-accounts-body">
          <p>Cadastre usuário e senha somente nesta área protegida do LicitaGestão. As senhas são criptografadas no banco e nunca retornam ao navegador. <strong>Os conectores de navegação automática ainda estão em validação:</strong> credenciais salvas não significam acesso automatizado ativo.</p>
          {!loginStatus?.storageReady && <p className="agent-vault-warning">Antes de salvar logins, configure a variável PLATFORM_CREDENTIAL_ENCRYPTION_KEY no Render e publique o backend da V56.</p>}
          <div className="agent-account-list">{(['BLL', 'M2A', 'LICITAMAIS'] as LoginPlatform[]).map((p) => {
            const saved = loginStatus?.items.some((v) => v.platform === p);
            return <div key={p} className="agent-login-card"><strong>{platformLabel(p)}</strong><small>{saved ? 'Credenciais cadastradas · conector não ativado' : 'Não conectada'}</small><div className="agent-login-actions"><button type="button" className="secondary-button compact" onClick={() => { setLoginPlatform(p); setEditingLogin((current) => current === p ? null : p); setLoginUsername(''); setLoginPassword(''); }} aria-expanded={editingLogin === p}>{editingLogin === p ? 'Cancelar' : saved ? 'Editar acesso' : 'Conectar'}</button>{saved && <button type="button" className="secondary-button compact" disabled={loginSaving || Boolean(testingLogin) || p === 'BLL'} title={p === 'BLL' ? 'BLL exige adaptação ao teclado virtual' : 'Testar login com credenciais salvas'} onClick={() => void testLogin(p)}>{testingLogin === p ? 'Testando...' : 'Testar acesso'}</button>}{saved && <button type="button" className="secondary-button compact" disabled={loginSaving} onClick={() => void removeLogin(p)}>Remover</button>}</div>{loginTestResults[p] && <small role="status">{loginTestResults[p]}</small>}</div>;
          })}</div>
          {editingLogin && <div className="agent-account-form">
            <strong className="agent-login-form-title">{loginStatus?.items.some((v) => v.platform === editingLogin) ? 'Atualizar' : 'Cadastrar'} — {platformLabel(editingLogin)}</strong>
            <label>Login<input autoComplete="off" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Usuário ou e-mail" /></label>
            <label>Senha<input type="password" autoComplete="new-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Senha da plataforma" /></label>
            <button type="button" className="secondary-button" disabled={!loginStatus?.storageReady || loginSaving || !loginUsername.trim() || !loginPassword} onClick={() => void saveLogin()}>{loginSaving ? 'Salvando...' : 'Salvar acesso'}</button>
          </div>}
          <small>Não envie senhas por mensagens. O sistema não solicita nem contorna CAPTCHA, 2FA ou bloqueios da plataforma.</small>
        </div>}
        </div>
        </div>
      </section>
      {!resultsCleared && status?.run && <section className={`discovery-run agent-run-compact ${running ? 'running' : ''}`} role="status">
        <div className="agent-run-top"><span className="agent-run-status"><RefreshCw size={17} className={running ? 'discovery-spin' : ''} /><strong>{status.run.progress}</strong>{status.run.warnings.length > 0 && <span className="agent-run-warnings">{status.run.warnings.length} aviso(s)</span>}</span><div className="agent-run-actions"><button type="button" className="secondary-button compact" onClick={() => setMonitorOpen(true)}><MonitorPlay size={15}/>Acompanhar agente</button><button type="button" className="secondary-button compact" onClick={() => setShowRunDetails((v) => !v)} aria-expanded={showRunDetails} aria-controls="agent-run-report">{showRunDetails ? 'Ocultar detalhes' : 'Ver detalhes'}{showRunDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></div></div>
        {showRunDetails && <div id="agent-run-report" className="agent-run-report"><small>Última busca: {new Date(status.run.startedAt).toLocaleString('pt-BR')}</small>{status.run.reports && <div className="discovery-source-report">{status.run.reports.map((r) => <span key={r.source}>{sourceLabel(r.source)} · {r.pages} página(s) · {r.complete ? 'concluída' : 'parcial'}</span>)}</div>}{status.run.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
      </section>}
      <div className="discovery-results-heading"><div><h3>Resultados do agente <span>{count}</span></h3><p>Selecione uma plataforma e abra as licitações que interessam.</p></div><button type="button" className="secondary-button compact" onClick={() => void refresh()}><RefreshCw size={15} /> Atualizar</button></div>
      {!resultsCleared && result?.limited && <div className="alert">A lista atingiu o limite de registros. Refine as regras e pesquise novamente.</div>}
      {groups.length > 0 && <div className="agent-platform-groups">{groups.map(({ key, title, count: groupCount }) => <button type="button" key={key} className={`agent-platform-card ${activePlatform === key ? 'active' : ''}`} onClick={() => choosePlatform(key)} aria-pressed={activePlatform === key}><span className="agent-platform-card-top"><FileText size={20} /><span className="agent-platform-count">{groupCount}</span></span><strong>{title}</strong><small>{activePlatform === key ? 'Fechar lista' : 'Ver licitações'}</small>{activePlatform === key ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button>)}</div>}
      {!count && <div className="discovery-empty"><Radar size={35} /><h3>{resultsCleared ? 'Busca limpa' : running ? 'O agente está pesquisando...' : 'Nenhuma oportunidade encontrada'}</h3><p>{resultsCleared ? 'Os resultados anteriores foram ocultados, sem excluir licitações já salvas.' : running ? 'As plataformas serão agrupadas quando as fontes responderem.' : 'Clique em Agente de busca e confira as datas, valor e tipos de obras selecionados.'}</p></div>}
      {count > 0 && !activePlatform && <div className="agent-select-hint"><CalendarRange size={18} /> Selecione uma plataforma acima para abrir suas licitações.</div>}
      {activePlatform && <div className="agent-selected-heading"><h3>{selectedPlatformName} <span>· {result?.total ?? 0} licitações</span></h3><button className="secondary-button compact" type="button" onClick={() => choosePlatform(activePlatform)}>Fechar</button></div>}
      {activePlatform && <div className="discovery-results agent-compact-results">
        {result?.items.map((item) => {
          const detailsOpen = openDetails.includes(item.id);
          const filesOpen = openFiles.includes(item.id);
          const mainCategory = item.categories.find((c) => c !== 'OBRAS_GERAIS') ?? item.categories[0];
          return <article key={item.id} className={`discovery-result agent-tender-card ${detailsOpen ? 'is-open' : ''}`}>
            <div className="agent-tender-topline">
              <span className="agent-tender-kind">{mainCategory ? labels[mainCategory] : 'Obra pública'}</span>
              <span className="agent-tender-location"><MapPin size={13} />{item.municipality} / CE</span>
            </div>
            <h3>{item.object.length > 115 ? `${item.object.slice(0, 115).trimEnd()}…` : item.object}</h3>
            <div className="agent-tender-highlights">
              <div><small>Valor estimado</small><strong>{item.estimatedValue === null ? 'Não informado' : formatCurrency(String(item.estimatedValue))}</strong></div>
              <div><small>Sessão</small><strong>{formatDate(item.sessionDate)}{item.sessionTime ? ` · ${item.sessionTime}` : ''}</strong></div>
              {activePlatform === 'M2A' && <div><small>Fase inversa · M2A</small><strong className="agent-phase-label">Aguardando consulta à M2A</strong></div>}
            </div>
            <div className="agent-tender-toolbar">
              <button type="button" className="secondary-button compact" onClick={() => toggleDetails(item.id)} aria-expanded={detailsOpen} aria-controls={`agent-details-${item.id}`}><FileText size={15} />{detailsOpen ? 'Ocultar detalhes' : 'Ver detalhes'}{detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              <button type="button" className="secondary-button compact" onClick={() => toggleFiles(item.id)} aria-expanded={filesOpen} aria-controls={`agent-files-${item.id}`}><FolderOpen size={15} />Arquivos ({item.documents?.length ?? 0}){filesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              <button type="button" className="secondary-button compact" disabled={Boolean(queueSaving) || queuedIds.includes(item.id)} onClick={() => void sendToWeeklyList(item.id)}>{queuedIds.includes(item.id) ? <CheckCircle2 size={15} /> : <ListPlus size={15} />}{queuedIds.includes(item.id) ? 'Na lista semanal' : queueSaving === item.id ? 'Enviando...' : 'Enviar para lista'}</button>
            </div>
            {filesOpen && <div id={`agent-files-${item.id}`} className="agent-files-panel"><strong>Arquivos disponíveis</strong>{item.documents?.length ? item.documents.map((doc) => <a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer"><Download size={15} />{doc.title}<ExternalLink size={13} /></a>) : <p>Nenhum arquivo acessível encontrado. Consulte o portal oficial.</p>}<small>Os documentos abrem em outra aba ou iniciam o download, conforme o portal. Não ficam armazenados no LicitaGestão.</small></div>}
            {detailsOpen && <div id={`agent-details-${item.id}`} className="agent-tender-details">
              <div className="agent-tender-detail-grid">
                <div><small>Número do edital</small><strong>{item.reference || 'Não informado'}</strong></div>
                <div><small>Plataforma</small><strong>{item.platformName?.trim() || selectedPlatformName}</strong></div>
                <div><small>Órgão responsável</small><strong>{item.agency || 'Não informado'}</strong></div>
                <div><small>Análise</small><strong>{item.aiReviewed ? 'Revisada por IA' : 'Classificação por filtros'}</strong></div>
              </div>
              <p className="agent-full-object"><strong>Objeto:</strong> {item.object}</p>
              <div className="discovery-tags">{item.categories.filter((c) => c !== 'OBRAS_GERAIS').slice(0, 5).map((c) => <span key={c}>{labels[c]}</span>)}</div>
              <div className="agent-tender-links">
                {item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">Fonte {sourceLabel(source.source)} <ExternalLink size={13} /></a>)}
                {item.platformUrl && <a href={item.platformUrl} target="_blank" rel="noopener noreferrer">{item.platformName?.trim() || selectedPlatformName} <ExternalLink size={13} /></a>}
              </div>
              <div className="agent-tender-footer"><small>Encontrada em {new Date(item.lastSeenAt).toLocaleString('pt-BR')}</small>{item.importedTenderId ? <Link className="secondary-button compact" to={`/licitacoes/${item.importedTenderId}`}>Abrir no controle <ArrowRight size={15} /></Link> : <button type="button" className="primary-button compact" disabled={Boolean(opening)} onClick={() => void openDraft(item)}>{opening === item.id ? 'Lendo edital...' : 'Adicionar ao Controle Geral'} <ArrowRight size={15} /></button>}</div>
            </div>}
          </article>;
        })}
      </div>}
      {monitorOpen && <div className="agent-monitor-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMonitorOpen(false); }}>
        <section className="agent-monitor-dialog" role="dialog" aria-modal="true" aria-labelledby="agent-monitor-title">
          <div className="agent-monitor-header"><h3 id="agent-monitor-title"><MonitorPlay size={18}/>Acompanhar agente</h3><button type="button" className="secondary-button compact" onClick={() => setMonitorOpen(false)} aria-label="Fechar acompanhamento"><X size={17}/></button></div>
          <div className="agent-monitor-screen">
            <MonitorPlay size={36}/><strong>{status?.run?.progress ?? 'Nenhuma busca em andamento'}</strong>
            <p>Progresso real da consulta às fontes PNCP e TCE-CE. A transmissão visual das abas de BLL, M2A e Licita Mais dependerá da ativação e validação dos respectivos conectores Playwright.</p>
          </div>
          <div className="agent-monitor-metrics">
            <div><small>Situação</small><strong>{status?.run?.status ?? 'Sem execução'}</strong></div>
            <div><small>Novas oportunidades</small><strong>{status?.run?.addedCount ?? 0}</strong></div>
            <div><small>Fontes consultadas</small><strong>{status?.run?.reports?.map((x) => sourceLabel(x.source)).join(' / ') || 'Aguardando'}</strong></div>
          </div>
          {status?.run?.warnings?.map((warning, i) => <p key={i} className="agent-monitor-warning">{warning}</p>)}
        </section>
      </div>}
      {activePlatform && result && result.pages > 1 && <div className="pagination"><span>{result.total} oportunidades nesta plataforma</span><div><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</button><span>{page} de {result.pages}</span><button disabled={page === result.pages} onClick={() => setPage((p) => p + 1)}>Próxima</button></div></div>}
    </div>
  );
}
