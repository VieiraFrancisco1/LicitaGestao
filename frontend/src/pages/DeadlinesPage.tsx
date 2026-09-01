import { AlertTriangle, CalendarClock, CalendarDays, Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, DeadlineAlert, DeadlineData } from '../types';

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
  const [data, setData] = useState<DeadlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState<'ALL' | DeadlineAlert['type']>('ALL');

  useEffect(() => {
    void (async () => {
      try {
        const response = await api.get<ApiResponse<DeadlineData>>('/deadlines/alerts?horizon=30&pastDays=30');
        setData(response.data.data);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const items = useMemo(
    () => data?.items.filter((item) => type === 'ALL' || item.type === type) ?? [],
    [data, type]
  );

  return (
    <div className="page-stack">
      <div className="page-heading deadlines-heading">
        <div>
          <p>Fase 3</p>
          <h2>Prazos e alertas</h2>
          <span>
            Acompanhe sessões e vencimentos de propostas calculados automaticamente pelas datas cadastradas.
          </span>
        </div>
      </div>

      <section className="deadline-summary-grid">
        <article className="deadline-summary overdue">
          <AlertTriangle size={20} />
          <div>
            <small>Vencidos</small>
            <strong>{data?.summary.overdue ?? 0}</strong>
          </div>
        </article>
        <article className="deadline-summary today">
          <Clock3 size={20} />
          <div>
            <small>Hoje</small>
            <strong>{data?.summary.today ?? 0}</strong>
          </div>
        </article>
        <article className="deadline-summary upcoming">
          <CalendarClock size={20} />
          <div>
            <small>Próximos 7 dias</small>
            <strong>{data?.summary.next7Days ?? 0}</strong>
          </div>
        </article>
        <article className="deadline-summary future">
          <CalendarDays size={20} />
          <div>
            <small>Próximos 30 dias</small>
            <strong>{data?.summary.next30Days ?? 0}</strong>
          </div>
        </article>
      </section>

      <section className="table-card deadline-panel">
        <div className="table-toolbar deadline-toolbar">
          <div>
            <strong>Agenda de prazos</strong>
            <small>{items.length} alerta(s) no período</small>
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
              <Link
                to={`/licitacoes/${item.tenderId}`}
                key={item.key}
                className={`deadline-row ${item.severity.toLowerCase()}`}
              >
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
