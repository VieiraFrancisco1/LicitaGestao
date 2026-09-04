import {
  Building2,
  CalendarDays,
  Download,
  FileCheck2,
  FileText,
  Mail,
  Paperclip,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, CompanySummary } from '../types';
import './reports.css';

type ReportRow = {
  id: string;
  sessionDate: string;
  noticeNumber: string | null;
  processNumber: string | null;
  municipality: string;
  state: string | null;
  agency: string | null;
  platformName: string | null;
  participations: number;
  pendingAttachments: number;
  spreadsheetReady: boolean;
  documents: number;
};

type ReportData = {
  scope: { companyId: string | null; companyName: string | null };
  companies: CompanySummary[];
  period: { dateFrom: string; dateTo: string };
  metrics: {
    tenders: number;
    participations: number;
    pendingAttachments: number;
    spreadsheetsReady: number;
    spreadsheetsPending: number;
    documents: number;
    emailAlerts: number;
  };
  monthly: Array<{ month: string; count: number }>;
  platforms: Array<{ name: string; count: number }>;
  municipalities: Array<{ name: string; count: number }>;
  rows: ReportRow[];
};

type DateFilters = { dateFrom: string; dateTo: string };

function fortalezaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: values.year, month: values.month, day: values.day };
}

function defaultFilters(): DateFilters {
  const { year, month, day } = fortalezaDateParts();
  return { dateFrom: `${year}-${month}-01`, dateTo: `${year}-${month}-${day}` };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace('.', '');
}

function csvCell(value: string | number | null) {
  const text = String(value ?? '');
  const protectedText = /^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

function downloadCsv(data: ReportData) {
  const header = [
    'Data',
    'Município',
    'UF',
    'Edital',
    'Processo',
    'Órgão',
    'Plataforma',
    'Participações no escopo',
    'Pendências de anexação',
    'Planilha pronta',
    'Documentos'
  ];
  const rows = data.rows.map((row) => [
    dateLabel(row.sessionDate),
    row.municipality,
    row.state,
    row.noticeNumber,
    row.processNumber,
    row.agency,
    row.platformName,
    row.participations,
    row.pendingAttachments,
    row.spreadsheetReady ? 'Sim' : 'Não',
    row.documents
  ]);
  const metadata = [
    ['Relatório', 'Operacional'],
    ['Período', `${dateLabel(data.period.dateFrom)} a ${dateLabel(data.period.dateTo)}`],
    ['Escopo', data.scope.companyName || 'Visão geral das empresas permitidas'],
    []
  ];
  const csv = `\uFEFF${[...metadata, header, ...rows]
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `licitagestao-relatorio-operacional-${data.period.dateFrom}-${data.period.dateTo}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { user, activeCompanyId } = useAuth();
  const initialFilters = useMemo(() => defaultFilters(), []);
  const [draftFilters, setDraftFilters] = useState<DateFilters>(initialFilters);
  const [filters, setFilters] = useState<DateFilters>(initialFilters);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const scopedCompanyId = user?.role === 'EMPRESA' ? user.companyId : activeCompanyId;

  const load = useCallback(async () => {
    if (!filters.dateFrom || !filters.dateTo) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<ReportData>>('/reports', {
        params: {
          ...filters,
          ...(scopedCompanyId ? { companyId: scopedCompanyId } : {})
        }
      });
      setData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, scopedCompanyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (draftFilters.dateFrom > draftFilters.dateTo) {
      setError('A data inicial não pode ser maior que a data final.');
      return;
    }
    setError('');
    setFilters(draftFilters);
  };

  const maxMonthly = Math.max(1, ...(data?.monthly.map((item) => item.count) ?? []));
  const maxPlatform = Math.max(1, ...(data?.platforms.map((item) => item.count) ?? []));
  const maxMunicipality = Math.max(1, ...(data?.municipalities.map((item) => item.count) ?? []));

  if (loading && !data) {
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando relatório...
      </div>
    );
  }

  return (
    <div className="page-stack reports-page">
      <section className="reports-hero">
        <div>
          <span className="eyebrow">Gestão operacional</span>
          <h2>Relatórios</h2>
          <p>
            Acompanhe volume de trabalho, anexações, planilhas, documentos e avisos sem criar comparações
            comerciais entre empresas.
          </p>
        </div>
        <button className="secondary-button compact" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </section>

      <section className="reports-privacy-note">
        <ShieldCheck size={20} />
        <div>
          <strong>Relatório voltado à operação</strong>
          <span>
            Esta área não exibe valores de propostas, vencedoras, taxa de êxito nem ranking de desempenho entre
            empresas.
          </span>
        </div>
      </section>

      <form className="reports-filters" onSubmit={applyFilters}>
        <label>
          <span>De</span>
          <input
            type="date"
            value={draftFilters.dateFrom}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))
            }
            required
          />
        </label>
        <label>
          <span>Até</span>
          <input
            type="date"
            value={draftFilters.dateTo}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setDraftFilters((current) => ({ ...current, dateTo: event.target.value }))
            }
            required
          />
        </label>
        <button className="reports-primary-button" type="submit" disabled={loading}>
          Aplicar filtros
        </button>
        <button
          className="reports-export-button"
          type="button"
          disabled={!data?.rows.length}
          onClick={() => data && downloadCsv(data)}
        >
          <Download size={16} /> Exportar CSV
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="reports-scope-line">
        <CalendarDays size={17} />
        <span>
          {data ? `${dateLabel(data.period.dateFrom)} a ${dateLabel(data.period.dateTo)}` : 'Período selecionado'}
        </span>
        <i />
        <Building2 size={17} />
        <span>{data?.scope.companyName || 'Visão geral das empresas permitidas'}</span>
      </section>

      <section className="reports-metrics">
        <ReportMetric
          icon={<FileText />}
          label="Licitações no período"
          value={data?.metrics.tenders ?? 0}
          detail="licitações distintas no escopo"
        />
        <ReportMetric
          icon={<Building2 />}
          label="Participações acompanhadas"
          value={data?.metrics.participations ?? 0}
          detail="volume operacional registrado"
        />
        <ReportMetric
          icon={<FileCheck2 />}
          label="Pendentes de anexação"
          value={data?.metrics.pendingAttachments ?? 0}
          detail="participações ainda pendentes"
          attention={Boolean(data?.metrics.pendingAttachments)}
        />
        <ReportMetric
          icon={<FileCheck2 />}
          label="Planilhas prontas"
          value={data?.metrics.spreadsheetsReady ?? 0}
          detail={`${data?.metrics.spreadsheetsPending ?? 0} ainda pendente${(data?.metrics.spreadsheetsPending ?? 0) === 1 ? '' : 's'}`}
        />
        <ReportMetric
          icon={<Paperclip />}
          label="Documentos vinculados"
          value={data?.metrics.documents ?? 0}
          detail="nas participações do período"
        />
        <ReportMetric
          icon={<Mail />}
          label="Avisos por e-mail"
          value={data?.metrics.emailAlerts ?? 0}
          detail="avisos relevantes recebidos no período"
        />
      </section>

      <section className="reports-analysis-grid">
        <ReportBars
          title="Licitações por mês"
          subtitle="Volume de licitações distintas dentro do período."
          items={(data?.monthly ?? []).map((item) => ({
            key: item.month,
            label: monthLabel(item.month),
            count: item.count,
            width: (item.count / maxMonthly) * 100
          }))}
        />
        <ReportBars
          title="Plataformas no período"
          subtitle="Onde as licitações acompanhadas estão acontecendo."
          items={(data?.platforms ?? []).slice(0, 8).map((item) => ({
            key: item.name,
            label: item.name,
            count: item.count,
            width: (item.count / maxPlatform) * 100
          }))}
        />
        <ReportBars
          title="Municípios no período"
          subtitle="Distribuição da carga de trabalho por localidade."
          items={(data?.municipalities ?? []).slice(0, 8).map((item) => ({
            key: item.name,
            label: item.name,
            count: item.count,
            width: (item.count / maxMunicipality) * 100
          }))}
        />
      </section>

      <section className="reports-table-card">
        <div className="reports-section-heading">
          <div>
            <span className="eyebrow">Detalhamento</span>
            <h3>Licitações do período</h3>
            <p>
              A visão geral agrega participações sem colocar empresas lado a lado. Abra a licitação para ver os
              detalhes permitidos pelo seu perfil.
            </p>
          </div>
          <strong>{data?.rows.length ?? 0} registro{(data?.rows.length ?? 0) === 1 ? '' : 's'}</strong>
        </div>

        {!data?.rows.length ? (
          <div className="reports-empty">Nenhuma licitação encontrada para o período e escopo selecionados.</div>
        ) : (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Licitação</th>
                  <th>Plataforma</th>
                  <th>Participações</th>
                  <th>Anexação</th>
                  <th>Planilha</th>
                  <th>Documentos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateLabel(row.sessionDate)}</td>
                    <td>
                      <strong>
                        {row.municipality}
                        {row.state ? `/${row.state}` : ''}
                      </strong>
                      <small>
                        {row.noticeNumber ? `Edital ${row.noticeNumber}` : row.processNumber ? `Processo ${row.processNumber}` : 'Sem número informado'}
                      </small>
                    </td>
                    <td>{row.platformName || 'Sem plataforma'}</td>
                    <td>{row.participations}</td>
                    <td>
                      <span className={`reports-status ${row.pendingAttachments ? 'pending' : 'ok'}`}>
                        {row.pendingAttachments
                          ? `${row.pendingAttachments} pendente${row.pendingAttachments === 1 ? '' : 's'}`
                          : 'Sem pendência'}
                      </span>
                    </td>
                    <td>
                      <span className={`reports-status ${row.spreadsheetReady ? 'ok' : 'neutral'}`}>
                        {row.spreadsheetReady ? 'Pronta' : 'Pendente'}
                      </span>
                    </td>
                    <td>{row.documents}</td>
                    <td>
                      <Link className="reports-open-link" to={`/licitacoes/${row.id}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ReportMetric({
  icon,
  label,
  value,
  detail,
  attention = false
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  attention?: boolean;
}) {
  return (
    <article className={`reports-metric ${attention ? 'attention' : ''}`}>
      <span className="reports-metric-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ReportBars({
  title,
  subtitle,
  items
}: {
  title: string;
  subtitle: string;
  items: Array<{ key: string; label: string; count: number; width: number }>;
}) {
  return (
    <article className="reports-panel">
      <div className="reports-panel-heading">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {!items.length ? (
        <div className="reports-empty compact">Sem dados neste período.</div>
      ) : (
        <div className="reports-bars">
          {items.map((item) => (
            <div className="reports-bar-row" key={item.key}>
              <div>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
              <span className="reports-bar-track">
                <i style={{ width: `${Math.max(5, item.width)}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
