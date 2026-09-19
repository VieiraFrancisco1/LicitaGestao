import { AlertTriangle, Building2, CalendarClock, CalendarDays, Clock3, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, CompanySummary, DeadlineAlert, DeadlineData } from '../types';

const dateFormat = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

const relativeLabel = (days: number) => {
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
};

export function DeadlinesPage() {
  const { user, activeCompanyId, setActiveCompanyId } = useAuth();
  const initialCompanyId =
    user?.role === 'EMPRESA'
      ? user.companyId
      : activeCompanyId ||
        (user?.role === 'FUNCIONARIO'
          ? user.assignedCompanies.find((company) => company.active)?.id ?? null
          : null);

  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null);
  const [data, setData] = useState<DeadlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState<'ALL' | DeadlineAlert['type']>('ALL');
  const [removingKey, setRemovingKey] = useState('');

  useEffect(() => {
    if (user?.role === 'EMPRESA') return;
    void api
      .get<ApiResponse<CompanySummary[]>>('/companies/options')
      .then((response) => {
        setCompanies(response.data.data);
        if (
          user?.role === 'FUNCIONARIO' &&
          !companyId &&
          response.data.data.length > 0
        ) {
          const first = response.data.data[0]!.id;
          setCompanyId(first);
          setActiveCompanyId(first);
        }
      })
      .catch((err) => setError(errorMessage(err)));
  }, [user?.role, companyId, setActiveCompanyId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<DeadlineData>>('/deadlines/alerts', {
        params: {
          horizon: 30,
          pastDays: 30,
          ...(companyId ? { companyId } : {})
        }
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

  const items = useMemo(
    () => data?.items.filter((item) => type === 'ALL' || item.type === type) ?? [],
    [data, type]
  );

  const selectedCompany = companies.find((company) => company.id === companyId);
  const selectedCompanyName =
    user?.role === 'EMPRESA'
      ? user.company?.tradeName || user.company?.legalName || 'Minha empresa'
      : selectedCompany?.tradeName || selectedCompany?.legalName;

  const dismiss = async (item: DeadlineAlert) => {
    if (!window.confirm('Apagar este alerta de prazo da sua lista? A data da licitação continuará preservada.')) return;
    setRemovingKey(item.key);
    setError('');
    try {
      await api.post('/deadlines/dismiss', { alertKey: item.key });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRemovingKey('');
    }
  };

  return (
    <div className="page-stack deadlines-page">
      <section className="deadline-company-scope">
        <div>
          <span className="eyebrow">Empresa</span>
          {user?.role === 'EMPRESA' ? (
            <strong>{selectedCompanyName}</strong>
          ) : (
            <label>
              <Building2 size={17} />
              <select
                value={companyId ?? ''}
                onChange={(event) => {
                  const next = event.target.value || null;
                  setCompanyId(next);
                  setActiveCompanyId(next);
                }}
              >
                {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <option value="">Todas as empresas</option>
                )}
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.tradeName || company.legalName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <small>
          {companyId
            ? 'Todos os cartões e a agenda abaixo mostram somente os prazos desta empresa.'
            : 'Visão consolidada das empresas às quais você tem acesso.'}
        </small>
      </section>

      <div className="page-heading deadlines-heading">
        <div>
          <h2>Prazos e alertas</h2>
          <span>
            Acompanhe sessões e vencimentos de propostas calculados automaticamente pelas datas cadastradas.
          </span>
        </div>
      </div>

      <section className="deadline-summary-grid">
        <article className="deadline-summary overdue">
          <AlertTriangle size={20} />
          <div><small>Vencidos</small><strong>{data?.summary.overdue ?? 0}</strong></div>
        </article>
        <article className="deadline-summary today">
          <Clock3 size={20} />
          <div><small>Hoje</small><strong>{data?.summary.today ?? 0}</strong></div>
        </article>
        <article className="deadline-summary upcoming">
          <CalendarClock size={20} />
          <div><small>Próximos 7 dias</small><strong>{data?.summary.next7Days ?? 0}</strong></div>
        </article>
        <article className="deadline-summary future">
          <CalendarDays size={20} />
          <div><small>Próximos 30 dias</small><strong>{data?.summary.next30Days ?? 0}</strong></div>
        </article>
      </section>

      <section className="table-card deadline-panel">
        <div className="table-toolbar deadline-toolbar">
          <div>
            <strong>Agenda de prazos</strong>
            <small>{items.length} alerta(s) no período{selectedCompanyName ? ` · ${selectedCompanyName}` : ''}</small>
          </div>
          <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="ALL">Todos os tipos</option>
            <option value="SESSION">Sessões</option>
            <option value="PROPOSAL_EXPIRATION">Validade de proposta</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Carregando prazos...</div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : items.length === 0 ? (
          <div className="empty-state">Nenhum prazo encontrado nesse período.</div>
        ) : (
          <div className="deadline-list">
            {items.map((item) => (
              <article key={item.key} className={`deadline-row deadline-row-dismissible ${item.severity.toLowerCase()}`}>
                <Link to={`/licitacoes/${item.tenderId}`} className="deadline-row-link">
                  <span className={`deadline-date-box ${item.severity.toLowerCase()}`}>
                    <strong>{item.date.slice(8, 10)}</strong>
                    <small>
                      {new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
                        .format(new Date(`${item.date}T00:00:00Z`))
                        .replace('.', '')}
                    </small>
                  </span>
                  <span className="deadline-main">
                    <span className="deadline-title-line">
                      <strong>{item.title}</strong>
                      <em>{relativeLabel(item.days)}</em>
                    </span>
                    <span>
                      {item.noticeNumber || item.processNumber || 'Licitação sem número'} · {item.municipality}
                      {item.state ? `/${item.state}` : ''}
                    </span>
                    <small>{item.object}</small>
                  </span>
                  <span className="deadline-meta">
                    <strong>
                      {dateFormat(item.date)}
                      {item.type === 'SESSION' && item.sessionTime ? ` às ${item.sessionTime}` : ''}
                    </strong>
                    <small>{item.platform?.name || 'Sem plataforma'}</small>
                  </span>
                </Link>
                <button
                  className="deadline-dismiss-button"
                  disabled={removingKey === item.key}
                  title="Apagar alerta"
                  onClick={() => void dismiss(item)}
                >
                  <Trash2 size={16} />
                  <span>{removingKey === item.key ? 'Apagando...' : 'Apagar'}</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
