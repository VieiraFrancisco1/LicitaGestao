import { BellRing, Building2, CalendarClock, ChevronRight, Gavel, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, DashboardData } from '../types';
import { optionLabel, progressOptions, situationOptions } from '../utils/bid';

function relative(days?: number) {
  if (days === undefined) return '';
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

export function DashboardPage() {
  const { user, activeCompanyId } = useAuth();
  const initialCompany = user?.role === 'EMPRESA' ? user.companyId : user?.role === 'FUNCIONARIO' ? activeCompanyId : null;
  const [companyId, setCompanyId] = useState<string | null>(initialCompany ?? null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<DashboardData>>('/dashboard', {
        params: companyId ? { companyId } : undefined
      });
      setData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedName = useMemo(
    () => data?.companies.find((company) => company.id === companyId)?.tradeName || data?.companies.find((company) => company.id === companyId)?.legalName,
    [data, companyId]
  );

  if (loading && !data) {
    return <div className="app-loader"><span className="spinner" />Carregando dashboard...</div>;
  }

  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Área de trabalho</span>
          <h2>Bom trabalho, {user?.name.split(' ')[0]}.</h2>
          <p>{selectedName ? `Acompanhamento da empresa ${selectedName}.` : 'Acompanhe o que precisa da sua atenção hoje.'}</p>
        </div>
        <div className="dashboard-scope-control">
          {user?.role !== 'EMPRESA' && (
            <label>
              <span>Visão do dashboard</span>
              <select value={companyId ?? ''} onChange={(event) => setCompanyId(event.target.value || null)}>
                <option value="">Todas as empresas</option>
                {data?.companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.tradeName || company.legalName}</option>
                ))}
              </select>
            </label>
          )}
          <button className="secondary-button compact" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="dashboard-metrics">
        <Metric icon={<Gavel />} label="Em andamento" value={data?.metrics.activeBids ?? 0} detail="participações ativas" />
        <Metric icon={<CalendarClock />} label="Próximas sessões" value={data?.metrics.upcomingSessions ?? 0} detail="nos próximos 7 dias" />
        <Metric icon={<BellRing />} label="Convocações" value={data?.metrics.pendingConvocations ?? 0} detail="pendentes de leitura" />
        <Metric icon={<TriangleAlert />} label="Prazos críticos" value={data?.metrics.criticalDeadlines ?? 0} detail="vencidos ou em até 3 dias" />
      </section>

      <section className="dashboard-grid-main">
        <article className="dashboard-panel dashboard-attention">
          <div className="dashboard-panel-heading">
            <div><span className="eyebrow">Prioridade</span><h3>Precisa da sua atenção</h3></div>
          </div>
          <div className="attention-list">
            {!data?.attention.length && <div className="dashboard-empty">Nenhum item crítico no momento.</div>}
            {data?.attention.map((item) => (
              <Link key={item.key} className={`attention-row ${item.severity.toLowerCase()}`} to={item.bidId ? `/participacoes/${item.bidId}${item.type === 'CONVOCATION' ? '?tab=convocations' : item.type === 'PROPOSAL_EXPIRATION' ? '?tab=deadlines' : ''}` : `/empresas/${item.companyId}?tab=convocations`}>
                <span className="attention-indicator" />
                <span className="attention-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                <span className="attention-time">{item.type === 'CONVOCATION' ? 'Nova mensagem' : relative(item.days)}</span>
                <ChevronRight size={17} />
              </Link>
            ))}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span className="eyebrow">Agenda</span><h3>Próximas licitações</h3></div><Link to="/licitacoes">Ver todas</Link></div>
          <div className="dashboard-compact-list">
            {!data?.upcomingBids.length && <div className="dashboard-empty">Nenhuma sessão futura cadastrada.</div>}
            {data?.upcomingBids.map((bid) => (
              <Link key={bid.id} to={`/participacoes/${bid.id}`}>
                <span className="dashboard-date-box"><strong>{bid.sessionDate.slice(8,10)}</strong><small>{new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${bid.sessionDate}T00:00:00Z`)).replace('.','')}</small></span>
                <span><strong>{bid.municipality}{bid.noticeNumber ? ` · ${bid.noticeNumber}` : ''}</strong><small>{bid.companyName} · {bid.platformName || 'Sem plataforma'}</small></span>
                <em>{optionLabel(progressOptions, bid.progress)}</em>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid-secondary">
        <article className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span className="eyebrow">Gmail</span><h3>Convocações recentes</h3></div><Link to="/convocacoes">Ver todas</Link></div>
          <div className="dashboard-compact-list convocations">
            {!data?.recentConvocations.length && <div className="dashboard-empty">Nenhuma convocação recente.</div>}
            {data?.recentConvocations.map((item) => (
              <Link key={item.messageId} to={item.bidId ? `/participacoes/${item.bidId}?tab=convocations` : `/empresas/${item.companyId}?tab=convocations`}>
                <span className={`dashboard-mail-dot ${item.read ? 'read' : ''}`} />
                <span><strong>{item.tender?.municipality || item.subject || 'Possível convocação'}</strong><small>{item.companyName} · {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.receivedAt))}</small></span>
                <em>{item.read ? 'Lida' : 'Pendente'}</em>
              </Link>
            ))}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-heading"><div><span className="eyebrow">Situação</span><h3>Participações</h3></div></div>
          <div className="status-breakdown">
            {!data?.statusBreakdown.length && <div className="dashboard-empty">Sem participações cadastradas.</div>}
            {data?.statusBreakdown.map((item) => <div key={item.situation}><span>{optionLabel(situationOptions, item.situation)}</span><strong>{item.count}</strong></div>)}
          </div>
        </article>
      </section>

      {!companyId && Boolean(data?.companyCards.length) && (
        <section className="dashboard-companies-section">
          <div className="dashboard-section-heading"><div><span className="eyebrow">Empresas</span><h3>Visão individual por empresa</h3><p>Abra uma empresa no próprio dashboard sem perder a visão geral.</p></div></div>
          <div className="dashboard-company-cards">
            {data?.companyCards.map((company) => (
              <button key={company.id} onClick={() => setCompanyId(company.id)}>
                <span className="company-card-icon"><Building2 size={19} /></span>
                <span className="company-card-copy"><strong>{company.name}</strong><small>{company.activeBids} em andamento · {company.upcomingSessions} próximas sessões</small></span>
                {company.pendingConvocations > 0 && <em>{company.pendingConvocations} convocação{company.pendingConvocations === 1 ? '' : 'ões'}</em>}
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number; detail: string }) {
  return <article className="dashboard-metric-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}
