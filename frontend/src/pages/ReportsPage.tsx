import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Layers3,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
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

type DetailView =
  | { kind: 'all'; title: string; description: string }
  | { kind: 'pendingAttachments'; title: string; description: string }
  | { kind: 'spreadsheetPending'; title: string; description: string }
  | { kind: 'platform'; title: string; description: string; platform: string };

const PAGE_SIZE = 10;

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

function csvCell(value: string | number | null) {
  const text = String(value ?? '');
  const protectedText = /^\s*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

function downloadCsv(data: ReportData, rows: ReportRow[], title: string) {
  const header = [
    'Data',
    'Município',
    'UF',
    'Edital',
    'Processo',
    'Órgão',
    'Plataforma',
    'Anexação',
    'Planilha'
  ];
  const body = rows.map((row) => [
    dateLabel(row.sessionDate),
    row.municipality,
    row.state,
    row.noticeNumber,
    row.processNumber,
    row.agency,
    row.platformName,
    row.pendingAttachments > 0 ? 'Pendente' : 'Sem pendência',
    row.spreadsheetReady ? 'Pronta' : 'Pendente'
  ]);
  const metadata = [
    ['Relatório', title],
    ['Empresa', data.scope.companyName || 'Empresa selecionada'],
    ['Período', `${dateLabel(data.period.dateFrom)} a ${dateLabel(data.period.dateTo)}`],
    []
  ];
  const csv = `\uFEFF${[...metadata, header, ...body].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `licitagestao-relatorio-${data.period.dateFrom}-${data.period.dateTo}.csv`;
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
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailPage, setDetailPage] = useState(1);

  const scopedCompanyId = user?.role === 'EMPRESA' ? user.companyId : activeCompanyId;
  const needsCompanySelection = user?.role === 'ADMIN' && !scopedCompanyId;

  const load = useCallback(async () => {
    if (!filters.dateFrom || !filters.dateTo) return;
    if (needsCompanySelection) {
      setData(null);
      setDetailView(null);
      setDetailSearch('');
      setDetailPage(1);
      setError('');
      setLoading(false);
      return;
    }

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
      setDetailView(null);
      setDetailSearch('');
      setDetailPage(1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, needsCompanySelection, scopedCompanyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!detailView) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailView(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [detailView]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (draftFilters.dateFrom > draftFilters.dateTo) {
      setError('A data inicial não pode ser maior que a data final.');
      return;
    }
    setError('');
    setFilters(draftFilters);
  };

  const openDetail = (view: DetailView) => {
    setDetailView(view);
    setDetailSearch('');
    setDetailPage(1);
  };

  const detailRows = useMemo(() => {
    if (!detailView) return [];
    const query = detailSearch.trim().toLocaleLowerCase('pt-BR');
    return (data?.rows ?? []).filter((row) => {
      const matchesView = (() => {
        switch (detailView.kind) {
          case 'pendingAttachments':
            return row.pendingAttachments > 0;
          case 'spreadsheetPending':
            return !row.spreadsheetReady;
          case 'platform':
            return (row.platformName || 'Sem plataforma') === detailView.platform;
          default:
            return true;
        }
      })();
      if (!matchesView || !query) return matchesView;
      return [
        row.municipality,
        row.state,
        row.noticeNumber,
        row.processNumber,
        row.agency,
        row.platformName
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(query);
    });
  }, [data?.rows, detailSearch, detailView]);

  const detailPageCount = Math.max(1, Math.ceil(detailRows.length / PAGE_SIZE));
  const safeDetailPage = Math.min(detailPage, detailPageCount);
  const detailPageRows = detailRows.slice(
    (safeDetailPage - 1) * PAGE_SIZE,
    safeDetailPage * PAGE_SIZE
  );

  if (loading && !data && !needsCompanySelection) {
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
          <span className="eyebrow">Relatório operacional</span>
          <h2>Resumo da empresa</h2>
          <p>Escolha o período e consulte somente as informações que ajudam no acompanhamento das licitações.</p>
        </div>
        <button className="secondary-button compact" onClick={() => void load()} disabled={loading || needsCompanySelection}>
          <RefreshCw size={15} /> Atualizar
        </button>
      </section>

      <section className="reports-context-card">
        <div className="reports-company-context">
          <span className="reports-context-icon"><Building2 size={20} /></span>
          <div>
            <small>Empresa selecionada</small>
            <strong>{data?.scope.companyName || (needsCompanySelection ? 'Nenhuma empresa selecionada' : 'Empresa atual')}</strong>
            <span>{user?.role === 'ADMIN' ? 'Troque a empresa pelo seletor fixo no topo.' : 'O relatório acompanha a empresa ativa no sistema.'}</span>
          </div>
        </div>

        <form className="reports-period-form" onSubmit={applyFilters}>
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
          <button type="submit" className="reports-apply-button" disabled={loading || needsCompanySelection}>
            Aplicar período
          </button>
        </form>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {needsCompanySelection ? (
        <section className="reports-company-required">
          <Building2 size={30} />
          <div>
            <h3>Selecione uma empresa para gerar o relatório</h3>
            <p>
              O relatório foi pensado para a visão individual de cada empresa. Use o seletor “Empresa ativa” no topo da tela.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="reports-period-heading">
            <div>
              <span className="eyebrow">Período analisado</span>
              <h3>{data ? `${dateLabel(data.period.dateFrom)} a ${dateLabel(data.period.dateTo)}` : 'Período selecionado'}</h3>
            </div>
            <span><CalendarDays size={16} /> Dados da empresa selecionada</span>
          </section>

          <section className="reports-summary-grid">
            <SummaryCard
              icon={<FileText />}
              label="Licitações participadas"
              value={data?.metrics.tenders ?? 0}
              description="Relação completa das licitações da empresa neste período."
              action="Ver licitações"
              onClick={() => openDetail({
                kind: 'all',
                title: 'Licitações do período',
                description: 'Todas as licitações participadas pela empresa no período selecionado.'
              })}
            />
            <SummaryCard
              icon={<FileCheck2 />}
              label="Pendentes de anexação"
              value={data?.metrics.pendingAttachments ?? 0}
              description="Licitações que ainda precisam concluir a anexação."
              action="Ver pendências"
              attention={Boolean(data?.metrics.pendingAttachments)}
              onClick={() => openDetail({
                kind: 'pendingAttachments',
                title: 'Pendentes de anexação',
                description: 'Licitações do período que ainda possuem pendência de anexação.'
              })}
            />
            <SummaryCard
              icon={<CheckCircle2 />}
              label="Planilhas pendentes"
              value={data?.metrics.spreadsheetsPending ?? 0}
              description="Licitações cuja planilha ainda não foi marcada como pronta."
              action="Ver planilhas"
              attention={Boolean(data?.metrics.spreadsheetsPending)}
              onClick={() => openDetail({
                kind: 'spreadsheetPending',
                title: 'Planilhas pendentes',
                description: 'Licitações do período cuja planilha ainda precisa ser concluída.'
              })}
            />
          </section>

          <section className="reports-platforms-card">
            <div className="reports-section-title">
              <div>
                <span className="eyebrow">Plataformas</span>
                <h3>Participação por plataforma</h3>
                <p>Veja quantas licitações do período aconteceram em cada plataforma. Clique para abrir a relação.</p>
              </div>
              <span className="reports-platform-total">
                <Layers3 size={16} /> {data?.platforms.length ?? 0} plataforma{(data?.platforms.length ?? 0) === 1 ? '' : 's'}
              </span>
            </div>

            {!data?.platforms.length ? (
              <div className="reports-empty-state">Nenhuma plataforma encontrada neste período.</div>
            ) : (
              <div className="reports-platform-list">
                {data.platforms.map((platform) => (
                  <button
                    type="button"
                    key={platform.name}
                    className="reports-platform-item"
                    onClick={() => openDetail({
                      kind: 'platform',
                      platform: platform.name,
                      title: platform.name,
                      description: `Licitações do período realizadas pela empresa na plataforma ${platform.name}.`
                    })}
                  >
                    <span className="reports-platform-icon"><Layers3 size={18} /></span>
                    <span className="reports-platform-copy">
                      <strong>{platform.name}</strong>
                      <small>{platform.count} licitação{platform.count === 1 ? '' : 'ões'} no período</small>
                    </span>
                    <strong className="reports-platform-count">{platform.count}</strong>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {detailView && data && (
        <div className="reports-modal-backdrop" role="presentation" onMouseDown={() => setDetailView(null)}>
          <section
            className="reports-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reports-modal-title"
            onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
          >
            <header className="reports-modal-header">
              <div>
                <span className="eyebrow">{data.scope.companyName || 'Empresa selecionada'}</span>
                <h2 id="reports-modal-title">{detailView.title}</h2>
                <p>{detailView.description}</p>
                <small>{dateLabel(data.period.dateFrom)} a {dateLabel(data.period.dateTo)}</small>
              </div>
              <button type="button" className="reports-modal-close" onClick={() => setDetailView(null)} aria-label="Fechar janela">
                <X size={20} />
              </button>
            </header>

            <div className="reports-modal-summary">
              <span><strong>{detailRows.length}</strong> licitação{detailRows.length === 1 ? '' : 'ões'}</span>
              <span><strong>{detailRows.filter((row) => row.pendingAttachments > 0).length}</strong> com anexação pendente</span>
              <span><strong>{detailRows.filter((row) => !row.spreadsheetReady).length}</strong> com planilha pendente</span>
            </div>

            <div className="reports-modal-toolbar">
              <label className="reports-modal-search">
                <Search size={16} />
                <input
                  value={detailSearch}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setDetailSearch(event.target.value);
                    setDetailPage(1);
                  }}
                  placeholder="Buscar município, edital, processo, órgão ou plataforma"
                />
              </label>
              <button
                type="button"
                className="reports-export-button"
                disabled={!detailRows.length}
                onClick={() => downloadCsv(data, detailRows, detailView.title)}
              >
                <Download size={15} /> Exportar relação
              </button>
            </div>

            <div className="reports-modal-content">
              {!detailRows.length ? (
                <div className="reports-empty-state modal-empty">
                  Nenhuma licitação encontrada para este filtro no período selecionado.
                </div>
              ) : (
                <div className="reports-detail-list">
                  {detailPageRows.map((row) => (
                    <article className="reports-detail-row" key={row.id}>
                      <div className="reports-detail-date">
                        <strong>{row.sessionDate.slice(8, 10)}</strong>
                        <span>{new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
                          .format(new Date(`${row.sessionDate}T00:00:00Z`))
                          .replace('.', '')}</span>
                      </div>

                      <div className="reports-detail-main">
                        <div className="reports-detail-title-line">
                          <div>
                            <strong>{row.municipality}{row.state ? `/${row.state}` : ''}</strong>
                            <small>
                              {row.noticeNumber
                                ? `Edital ${row.noticeNumber}`
                                : row.processNumber
                                  ? `Processo ${row.processNumber}`
                                  : 'Sem número informado'}
                            </small>
                          </div>
                          <span className="reports-detail-platform">{row.platformName || 'Sem plataforma'}</span>
                        </div>

                        <div className="reports-detail-meta">
                          {row.processNumber && row.noticeNumber && <span>Processo: <strong>{row.processNumber}</strong></span>}
                          {row.agency && <span>Órgão: <strong>{row.agency}</strong></span>}
                          <span>Data: <strong>{dateLabel(row.sessionDate)}</strong></span>
                        </div>

                        <div className="reports-detail-statuses">
                          <span className={`reports-status ${row.pendingAttachments > 0 ? 'pending' : 'ok'}`}>
                            Anexação: {row.pendingAttachments > 0 ? 'Pendente' : 'Sem pendência'}
                          </span>
                          <span className={`reports-status ${row.spreadsheetReady ? 'ok' : 'pending'}`}>
                            Planilha: {row.spreadsheetReady ? 'Pronta' : 'Pendente'}
                          </span>
                        </div>
                      </div>

                      <Link className="reports-open-link" to={`/licitacoes/${row.id}`} onClick={() => setDetailView(null)}>
                        Abrir licitação <ArrowRight size={14} />
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {detailPageCount > 1 && (
              <footer className="reports-modal-footer">
                <span>
                  Mostrando {(safeDetailPage - 1) * PAGE_SIZE + 1}–{Math.min(safeDetailPage * PAGE_SIZE, detailRows.length)} de {detailRows.length}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={safeDetailPage === 1}
                    onClick={() => setDetailPage((current) => Math.max(1, current - 1))}
                  >
                    Anterior
                  </button>
                  <strong>{safeDetailPage} de {detailPageCount}</strong>
                  <button
                    type="button"
                    disabled={safeDetailPage === detailPageCount}
                    onClick={() => setDetailPage((current) => Math.min(detailPageCount, current + 1))}
                  >
                    Próxima
                  </button>
                </div>
              </footer>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
  action,
  attention = false,
  onClick
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
  action: string;
  attention?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`reports-summary-card ${attention ? 'attention' : ''}`} onClick={onClick}>
      <span className="reports-summary-icon">{icon}</span>
      <span className="reports-summary-copy">
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{description}</span>
        <em>{action} <ArrowRight size={13} /></em>
      </span>
    </button>
  );
}
