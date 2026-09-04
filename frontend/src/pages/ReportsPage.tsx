import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileCheck2,
  FileText,
  ListFilter,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode
} from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse } from '../types';
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

type DetailFilter =
  | { kind: 'all'; label: string }
  | { kind: 'pendingAttachments'; label: string }
  | { kind: 'spreadsheetPending'; label: string }
  | { kind: 'documents'; label: string }
  | { kind: 'month'; label: string; value: string }
  | { kind: 'platform'; label: string; value: string }
  | { kind: 'municipality'; label: string; value: string };

const PAGE_SIZE = 10;
const ALL_FILTER: DetailFilter = { kind: 'all', label: 'Todas as licitações' };

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

function municipalityKey(row: ReportRow) {
  return row.state ? `${row.municipality}/${row.state}` : row.municipality;
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
  const [detailFilter, setDetailFilter] = useState<DetailFilter>(ALL_FILTER);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailPage, setDetailPage] = useState(1);
  const detailRef = useRef<HTMLElement | null>(null);

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
      setDetailFilter(ALL_FILTER);
      setDetailSearch('');
      setDetailPage(1);
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

  const openDetail = useCallback((filter: DetailFilter) => {
    setDetailFilter(filter);
    setDetailSearch('');
    setDetailPage(1);
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }, []);

  const filteredRows = useMemo(() => {
    const query = detailSearch.trim().toLocaleLowerCase('pt-BR');
    return (data?.rows ?? []).filter((row) => {
      const matchesFilter = (() => {
        switch (detailFilter.kind) {
          case 'pendingAttachments':
            return row.pendingAttachments > 0;
          case 'spreadsheetPending':
            return !row.spreadsheetReady;
          case 'documents':
            return row.documents > 0;
          case 'month':
            return row.sessionDate.slice(0, 7) === detailFilter.value;
          case 'platform':
            return (row.platformName || 'Sem plataforma') === detailFilter.value;
          case 'municipality':
            return municipalityKey(row) === detailFilter.value;
          default:
            return true;
        }
      })();
      if (!matchesFilter || !query) return matchesFilter;
      const searchable = [
        row.municipality,
        row.state,
        row.noticeNumber,
        row.processNumber,
        row.agency,
        row.platformName
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return searchable.includes(query);
    });
  }, [data?.rows, detailFilter, detailSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(detailPage, pageCount);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
          <p>Veja o volume de trabalho do período e abra rapidamente os pontos que precisam de atenção.</p>
        </div>
        <div className="reports-hero-actions">
          <span
            className="reports-mode-badge"
            title="Sem valores de propostas, vencedoras, taxa de êxito ou ranking entre empresas."
          >
            <ShieldCheck size={16} /> Operacional e privado
          </span>
          <button className="secondary-button compact" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>
      </section>

      <section className="reports-control-card">
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
            Aplicar período
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

        <div className="reports-scope-line">
          <span><CalendarDays size={16} /> {data ? `${dateLabel(data.period.dateFrom)} a ${dateLabel(data.period.dateTo)}` : 'Período selecionado'}</span>
          <span><Building2 size={16} /> {data?.scope.companyName || 'Todas as empresas permitidas'}</span>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="reports-metrics">
        <ReportMetric
          icon={<FileText />}
          label="Licitações no período"
          value={data?.metrics.tenders ?? 0}
          detail="licitações distintas no escopo"
          actionLabel="Ver licitações"
          onClick={() => openDetail(ALL_FILTER)}
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
          detail="participações que ainda exigem ação"
          attention={Boolean(data?.metrics.pendingAttachments)}
          actionLabel="Ver pendências"
          onClick={() => openDetail({ kind: 'pendingAttachments', label: 'Pendentes de anexação' })}
        />
        <ReportMetric
          icon={<FileCheck2 />}
          label="Planilhas pendentes"
          value={data?.metrics.spreadsheetsPending ?? 0}
          detail={`${data?.metrics.spreadsheetsReady ?? 0} pronta${(data?.metrics.spreadsheetsReady ?? 0) === 1 ? '' : 's'} no período`}
          attention={Boolean(data?.metrics.spreadsheetsPending)}
          actionLabel="Ver pendentes"
          onClick={() => openDetail({ kind: 'spreadsheetPending', label: 'Planilhas pendentes' })}
        />
        <ReportMetric
          icon={<Paperclip />}
          label="Documentos vinculados"
          value={data?.metrics.documents ?? 0}
          detail="arquivos ligados às participações"
          actionLabel="Abrir documentos"
          to="/documentos"
        />
        <ReportMetric
          icon={<Mail />}
          label="Avisos por e-mail"
          value={data?.metrics.emailAlerts ?? 0}
          detail="avisos relevantes recebidos no período"
          actionLabel="Abrir avisos"
          to="/convocacoes"
        />
      </section>

      <section className="reports-insights-heading">
        <div>
          <span className="eyebrow">Distribuição</span>
          <h3>Onde o trabalho está concentrado</h3>
          <p>Clique em uma linha para filtrar o detalhamento. Listas grandes ficam compactas e podem ser expandidas.</p>
        </div>
      </section>

      <section className="reports-analysis-grid">
        <ReportBars
          title="Licitações por mês"
          subtitle="Evolução do volume dentro do período."
          visibleLimit={6}
          items={(data?.monthly ?? []).map((item) => ({
            key: item.month,
            label: monthLabel(item.month),
            count: item.count,
            width: (item.count / maxMonthly) * 100
          }))}
          onSelect={(key, label) => openDetail({ kind: 'month', value: key, label: `Mês: ${label}` })}
        />
        <ReportBars
          title="Plataformas"
          subtitle="Principais ambientes usados nas licitações."
          visibleLimit={5}
          items={(data?.platforms ?? []).map((item) => ({
            key: item.name,
            label: item.name,
            count: item.count,
            width: (item.count / maxPlatform) * 100
          }))}
          onSelect={(key, label) => openDetail({ kind: 'platform', value: key, label: `Plataforma: ${label}` })}
        />
        <ReportBars
          title="Municípios"
          subtitle="Localidades com maior volume no período."
          visibleLimit={5}
          items={(data?.municipalities ?? []).map((item) => ({
            key: item.name,
            label: item.name,
            count: item.count,
            width: (item.count / maxMunicipality) * 100
          }))}
          onSelect={(key, label) => openDetail({ kind: 'municipality', value: key, label: `Município: ${label}` })}
        />
      </section>

      <section className="reports-table-card" ref={detailRef}>
        <div className="reports-section-heading">
          <div>
            <span className="eyebrow">Detalhamento</span>
            <h3>Licitações do período</h3>
            <p>Use os indicadores e distribuições acima como atalhos para chegar ao que precisa conferir.</p>
          </div>
          <strong>{filteredRows.length} registro{filteredRows.length === 1 ? '' : 's'}</strong>
        </div>

        <div className="reports-detail-toolbar">
          <div className="reports-filter-chip">
            <ListFilter size={15} />
            <span>{detailFilter.label}</span>
            {detailFilter.kind !== 'all' && (
              <button type="button" onClick={() => openDetail(ALL_FILTER)} title="Limpar filtro">
                <X size={14} />
              </button>
            )}
          </div>
          <label className="reports-detail-search">
            <Search size={16} />
            <input
              value={detailSearch}
              onChange={(event) => {
                setDetailSearch(event.target.value);
                setDetailPage(1);
              }}
              placeholder="Buscar município, edital, processo, órgão ou plataforma"
            />
          </label>
          <div className="reports-quick-filters" aria-label="Filtros rápidos">
            <button
              type="button"
              className={detailFilter.kind === 'pendingAttachments' ? 'active' : ''}
              onClick={() => openDetail({ kind: 'pendingAttachments', label: 'Pendentes de anexação' })}
            >
              Anexação pendente
            </button>
            <button
              type="button"
              className={detailFilter.kind === 'spreadsheetPending' ? 'active' : ''}
              onClick={() => openDetail({ kind: 'spreadsheetPending', label: 'Planilhas pendentes' })}
            >
              Planilha pendente
            </button>
            <button
              type="button"
              className={detailFilter.kind === 'documents' ? 'active' : ''}
              onClick={() => openDetail({ kind: 'documents', label: 'Com documentos' })}
            >
              Com documentos
            </button>
          </div>
        </div>

        {!filteredRows.length ? (
          <div className="reports-empty">
            <strong>Nenhuma licitação encontrada.</strong>
            <span>Altere o filtro ou a busca para visualizar outros registros do período.</span>
          </div>
        ) : (
          <>
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
                  {pageRows.map((row) => (
                    <tr key={row.id}>
                      <td>{dateLabel(row.sessionDate)}</td>
                      <td>
                        <strong>
                          {row.municipality}
                          {row.state ? `/${row.state}` : ''}
                        </strong>
                        <small>
                          {row.noticeNumber
                            ? `Edital ${row.noticeNumber}`
                            : row.processNumber
                              ? `Processo ${row.processNumber}`
                              : 'Sem número informado'}
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
                          Abrir <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="reports-pagination">
                <span>
                  Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} de {filteredRows.length}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setDetailPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft size={15} /> Anterior
                  </button>
                  <strong>{safePage} de {pageCount}</strong>
                  <button
                    type="button"
                    disabled={safePage === pageCount}
                    onClick={() => setDetailPage((current) => Math.min(pageCount, current + 1))}
                  >
                    Próxima <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
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
  attention = false,
  actionLabel,
  onClick,
  to
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
  attention?: boolean;
  actionLabel?: string;
  onClick?: () => void;
  to?: string;
}) {
  const content = (
    <>
      <span className="reports-metric-icon">{icon}</span>
      <div className="reports-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
        {actionLabel && <em>{actionLabel} <ArrowRight size={12} /></em>}
      </div>
    </>
  );
  const className = `reports-metric ${attention ? 'attention' : ''} ${actionLabel ? 'interactive' : ''}`;

  if (to) {
    return <Link className={className} to={to}>{content}</Link>;
  }
  if (onClick) {
    return <button type="button" className={className} onClick={onClick}>{content}</button>;
  }
  return <article className={className}>{content}</article>;
}

function ReportBars({
  title,
  subtitle,
  items,
  visibleLimit,
  onSelect
}: {
  title: string;
  subtitle: string;
  items: Array<{ key: string; label: string; count: number; width: number }>;
  visibleLimit: number;
  onSelect?: (key: string, label: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, visibleLimit);
  const hasMore = items.length > visibleLimit;

  return (
    <article className="reports-panel">
      <div className="reports-panel-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {!!items.length && <span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span>}
      </div>
      {!items.length ? (
        <div className="reports-empty compact">Sem dados neste período.</div>
      ) : (
        <>
          <div className={`reports-bars ${expanded ? 'expanded' : ''}`}>
            {visibleItems.map((item) => (
              <button
                type="button"
                className="reports-bar-row"
                key={item.key}
                onClick={() => onSelect?.(item.key, item.label)}
                disabled={!onSelect}
                title={onSelect ? `Filtrar detalhamento por ${item.label}` : undefined}
              >
                <span className="reports-bar-copy">
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </span>
                <span className="reports-bar-track">
                  <i style={{ width: `${Math.max(5, item.width)}%` }} />
                </span>
              </button>
            ))}
          </div>
          {hasMore && (
            <button className="reports-show-more" type="button" onClick={() => setExpanded((current) => !current)}>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {expanded ? 'Mostrar menos' : `Ver todos (${items.length})`}
            </button>
          )}
        </>
      )}
    </article>
  );
}
