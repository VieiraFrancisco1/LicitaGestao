import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FilterX,
  FolderOpen,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlink,
  UserRoundCheck,
  UserRoundX
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type {
  ApiResponse,
  BidProgress,
  BidSituation,
  CompanyChatData,
  CompanySummary,
  Paginated,
  Tender,
  TenderFilterOptions,
  TenderWorkflowStatus
} from '../types';
import { availableSituationOptions, formatCurrency, formatDate, progressOptions } from '../utils/bid';

const monthOptions = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' }
];

const workflowTabs: Array<[TenderWorkflowStatus, string]> = [
  ['PENDENTE', 'Pendentes'],
  ['ANEXADA', 'Já anexadas'],
  ['INICIADA', 'Iniciadas'],
  ['SUSPENSA', 'Suspensas'],
  ['CONVOCADA', 'Convocadas'],
  ['RECURSO', 'Recursos']
];

function dateRange(year: number, month: string, day: string) {
  if (month === 'all') return {};
  const monthNumber = Number(month);
  const mm = String(monthNumber).padStart(2, '0');
  if (day !== 'all') {
    const dd = String(Number(day)).padStart(2, '0');
    const date = `${year}-${mm}-${dd}`;
    return { dateFrom: date, dateTo: date };
  }
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    dateFrom: `${year}-${mm}-01`,
    dateTo: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
  };
}

function companyName(company: CompanySummary) {
  return company.tradeName || company.legalName;
}

export function TendersPage({
  fixedCompanyId,
  embedded = false
}: {
  fixedCompanyId?: string;
  embedded?: boolean;
} = {}) {
  const { user } = useAuth();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [data, setData] = useState<Paginated<Tender> | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [companyScopeId, setCompanyScopeId] = useState(fixedCompanyId ?? '');
  const [companyStaffCount, setCompanyStaffCount] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<TenderWorkflowStatus>('PENDENTE');
  const [city, setCity] = useState('');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [day, setDay] = useState('all');
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(currentYear);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [associating, setAssociating] = useState<Tender | null>(null);
  const [viewingCompanies, setViewingCompanies] = useState<Tender | null>(null);
  const [linksTender, setLinksTender] = useState<Tender | null>(null);

  const selectedCompanyId = fixedCompanyId ?? (companyScopeId || undefined);
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;
  const companyMode = Boolean(selectedCompanyId);

  const yearOptions = Array.from({ length: 8 }, (_, index) => currentYear - 5 + index);
  const daysInSelectedMonth = month === 'all' ? 31 : new Date(year, Number(month), 0).getDate();
  const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1);

  useEffect(() => {
    void api
      .get<ApiResponse<CompanySummary[]>>('/companies/options')
      .then((response) => {
        setCompanies(response.data.data);
        if (fixedCompanyId) setCompanyScopeId(fixedCompanyId);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [fixedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyStaffCount(null);
      return;
    }
    void api
      .get<ApiResponse<CompanyChatData>>(`/workspace/${selectedCompanyId}/chat`)
      .then((response) => {
        setCompanyStaffCount(
          response.data.data.members.filter((member) => member.role === 'FUNCIONARIO').length
        );
      })
      .catch(() => setCompanyStaffCount(null));
  }, [selectedCompanyId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = dateRange(year, month, day);
      const response = await api.get<ApiResponse<Paginated<Tender>>>('/tenders', {
        params: {
          search: search || undefined,
          workflowStatus,
          municipality: city || undefined,
          companyId: selectedCompanyId,
          ...range,
          page,
          pageSize: 20
        }
      });
      setData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, workflowStatus, city, selectedCompanyId, day, month, year, page]);

  const loadCityOptions = useCallback(async () => {
    try {
      const range = dateRange(year, month, day);
      const response = await api.get<ApiResponse<TenderFilterOptions>>('/tenders/filter-options', {
        params: { workflowStatus, companyId: selectedCompanyId, ...range }
      });
      const municipalities = response.data.data.municipalities ?? [];
      setCityOptions(municipalities);
      if (city && !municipalities.includes(city)) {
        setCity('');
        setPage(1);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [workflowStatus, selectedCompanyId, day, month, year, city]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCityOptions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCityOptions]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
      void loadCityOptions();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load, loadCityOptions]);

  const toggleSpreadsheet = async (tender: Tender) => {
    setActionId(tender.id);
    setError('');
    try {
      await api.patch(`/tenders/${tender.id}/spreadsheet-ready`, { ready: !tender.spreadsheetReady });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId('');
    }
  };

  const toggleResponsibility = async (tender: Tender, responsible: boolean) => {
    setActionId(tender.id);
    setError('');
    try {
      await api.patch(`/tenders/${tender.id}/spreadsheet-responsibility`, { responsible });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId('');
    }
  };

  const markAttached = async (bidId: string) => {
    setActionId(bidId);
    setError('');
    try {
      await api.put(`/bids/${bidId}`, { situation: 'ANEXADA' });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId('');
    }
  };

  const detach = async (tender: Tender, bidId: string) => {
    const label = selectedCompany ? companyName(selectedCompany) : 'esta empresa';
    if (!window.confirm(`Desassociar a licitação de ${label}? A licitação continuará no controle geral.`)) return;
    setActionId(bidId);
    setError('');
    try {
      await api.delete(`/bids/${bidId}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId('');
    }
  };

  const deleteTender = async (tender: Tender) => {
    const label = tender.noticeNumber ? `${tender.municipality} · ${tender.noticeNumber}` : tender.municipality;
    const confirmation = window.prompt(
      `ATENÇÃO: excluir ${label} também remove as participações vinculadas.\n\nDigite EXCLUIR para confirmar:`
    );
    if (confirmation?.trim().toUpperCase() !== 'EXCLUIR') return;
    setActionId(tender.id);
    setError('');
    try {
      await api.delete(`/tenders/${tender.id}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId('');
    }
  };

  const selectedDateLabel =
    month === 'all'
      ? `todos os meses de ${year}`
      : day === 'all'
        ? `${monthOptions.find((item) => item.value === month)?.label} de ${year}`
        : `${String(Number(day)).padStart(2, '0')}/${String(Number(month)).padStart(2, '0')}/${year}`;

  const canShowAssume =
    !companyMode || companyStaffCount === null || companyStaffCount > 1;

  return (
    <div className={embedded ? 'page-stack embedded-tenders-page' : 'page-stack'}>
      {!embedded && (
        <div className="page-heading">
          <div>
            <p>Controle geral compartilhado</p>
            <h2>Licitações</h2>
            <span>Veja o controle geral ou filtre diretamente pelas empresas às quais você tem acesso.</span>
          </div>
          <Link className="primary-button" to="/licitacoes/nova">
            <Plus size={18} />
            Nova licitação
          </Link>
        </div>
      )}

      {!fixedCompanyId && (
        <nav className="tender-company-tabs" aria-label="Licitações por empresa">
          <button
            className={!companyScopeId ? 'active' : ''}
            onClick={() => {
              setCompanyScopeId('');
              setPage(1);
              setCity('');
            }}
          >
            Geral
          </button>
          {companies.map((company) => (
            <button
              key={company.id}
              className={companyScopeId === company.id ? 'active' : ''}
              onClick={() => {
                setCompanyScopeId(company.id);
                setPage(1);
                setCity('');
              }}
            >
              {companyName(company)}
            </button>
          ))}
        </nav>
      )}

      {companyMode && !embedded && selectedCompany && (
        <div className="company-scope-banner">
          <Building2 size={18} />
          <div>
            <small>Licitações da empresa</small>
            <strong>{companyName(selectedCompany)}</strong>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tender-status-tabs">
        {workflowTabs.map(([status, label]) => (
          <button
            key={status}
            className={workflowStatus === status ? 'active' : ''}
            onClick={() => {
              setWorkflowStatus(status);
              setCity('');
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="table-card tender-control-card">
        <div className="tender-date-filter-bar">
          <div className="tender-date-selectors">
            <label>
              <span>Dia</span>
              <select
                value={day}
                disabled={month === 'all'}
                onChange={(event) => {
                  setDay(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Todos</option>
                {dayOptions.map((option) => (
                  <option key={option} value={option}>
                    {String(option).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </label>
            <label className="tender-city-filter">
              <span>Cidade</span>
              <select
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {cityOptions.map((municipality) => (
                  <option key={municipality} value={municipality}>
                    {municipality}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Mês</span>
              <select
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setDay('all');
                  setPage(1);
                }}
              >
                <option value="all">Todos os meses</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Ano</span>
              <select
                value={year}
                onChange={(event) => {
                  setYear(Number(event.target.value));
                  setDay('all');
                  setPage(1);
                }}
              >
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bid-filters general-tender-filters organized-tender-filters">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Cidade, número, processo ou objeto"
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              setSearch('');
              setCity('');
              setDay('all');
              setMonth(String(currentMonth));
              setYear(currentYear);
              setPage(1);
            }}
          >
            <FilterX size={16} />
            Limpar filtros
          </button>
        </div>

        <div className="table-wrap">
          <table className="bids-table general-tenders-table organized-tenders-table">
            <thead>
              <tr>
                <th>Licitação</th>
                <th>Data</th>
                <th>Objeto</th>
                <th>Validade</th>
                <th>Valor e plataforma</th>
                <th>{companyMode ? 'Anexação' : 'Empresas'}</th>
                <th>Planilha</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="table-message">Carregando licitações...</td>
                </tr>
              )}
              {!loading && !data?.items.length && (
                <tr>
                  <td colSpan={8} className="table-message">
                    <FileText size={28} />
                    Nenhuma licitação para {selectedDateLabel.toLowerCase()}.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((tender) => {
                  const selectedBid = selectedCompanyId
                    ? tender.bids.find((bid) => bid.companyId === selectedCompanyId)
                    : undefined;
                  const isResponsible = tender.spreadsheetResponsibleUserId === user?.id;
                  const canRelease =
                    isResponsible || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
                  const canManageSpreadsheet = user?.role !== 'EMPRESA';
                  const hasAssociableCompanies = companies.some(
                    (company) => !tender.bids.some((bid) => bid.companyId === company.id)
                  );
                  const attachedBids = tender.bids.filter((bid) => bid.situation === 'ANEXADA');
                  const tenderLabel = [tender.modality, tender.noticeNumber ? `Nº ${tender.noticeNumber}` : null]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <tr key={tender.id}>
                      <td className="tender-identity-cell compact-license-cell">
                        <div className="tender-cell-content">
                          <strong>{tender.municipality}</strong>
                          {tenderLabel && <small>{tenderLabel}</small>}
                          {tender.isPreQualification && <small className="prequalification-note">Pré-qualificação</small>}
                          <small>Garantia: {tender.guaranteeType === 'NAO_EXIGIDA' ? 'Não' : 'Sim'}</small>
                          {tender.workflowStatus === 'CONVOCADA' && (
                            <small className="tender-workflow-note convoked">Convocada por aviso recebido</small>
                          )}
                          {tender.workflowStatus === 'SUSPENSA' && (
                            <small className="tender-workflow-note suspended">Suspensa por aviso recebido</small>
                          )}
                          {tender.workflowStatus === 'RECURSO' && (
                            <small className="tender-workflow-note resource">Recurso / manifestação identificada</small>
                          )}
                        </div>
                      </td>
                      <td className="tender-date-cell"><strong>{formatDate(tender.sessionDate)}</strong></td>
                      <td className="object-cell organized-object-cell"><strong>{tender.object}</strong></td>
                      <td className="tender-validity-cell">
                        <strong>{tender.proposalValidityDays ?? '—'} dias</strong>
                        <small>Validade da proposta</small>
                      </td>
                      <td className="tender-value-platform-cell">
                        <strong>{formatCurrency(tender.estimatedValue)}</strong>
                        <small>{tender.platform?.name || 'Sem plataforma'}</small>
                      </td>
                      <td className="companies-cell organized-companies-cell">
                        {companyMode && selectedBid ? (
                          <div className="company-attachment-control">
                            <span className={`attachment-status ${selectedBid.situation === 'ANEXADA' ? 'attached' : 'pending'}`}>
                              {selectedBid.situation === 'ANEXADA' ? 'Anexada' : 'Pendente'}
                            </span>
                            {selectedBid.situation !== 'ANEXADA' && (
                              <button
                                type="button"
                                className="mini-action-button attach-now-button"
                                disabled={actionId === selectedBid.id}
                                onClick={() => void markAttached(selectedBid.id)}
                              >
                                <CheckCircle2 size={14} />
                                {actionId === selectedBid.id ? 'Salvando...' : 'Anexar'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="association-count"
                            disabled={attachedBids.length === 0}
                            onClick={() => setViewingCompanies(tender)}
                          >
                            <Building2 size={15} />
                            {attachedBids.length} {attachedBids.length === 1 ? 'anexou' : 'anexaram'}
                          </button>
                        )}
                      </td>
                      <td className="spreadsheet-control-cell">
                        <div className="spreadsheet-inline-layout">
                          <div className="spreadsheet-inline-info">
                            <span className={`spreadsheet-status-pill ${tender.spreadsheetReady ? 'ready' : ''}`}>
                              {tender.spreadsheetReady ? <CheckCircle2 size={14} /> : <ClipboardCheck size={14} />}
                              {tender.spreadsheetReady ? 'Pronta' : 'Em preparação'}
                            </span>
                            <div className="spreadsheet-inline-owner">
                              <small>Responsável técnico</small>
                              <strong>{tender.spreadsheetResponsibleUser?.name || 'Não definido'}</strong>
                            </div>
                          </div>
                          <div className="spreadsheet-inline-actions">
                            {canManageSpreadsheet &&
                              canShowAssume &&
                              !tender.spreadsheetResponsibleUserId && (
                                <button
                                  className="mini-action-button primary-soft"
                                  disabled={actionId === tender.id}
                                  onClick={() => void toggleResponsibility(tender, true)}
                                >
                                  <UserRoundCheck size={14} />
                                  Assumir planilha
                                </button>
                              )}
                            {canManageSpreadsheet && tender.spreadsheetResponsibleUserId && canRelease && (
                              <button
                                className="mini-action-button"
                                disabled={actionId === tender.id}
                                onClick={() => void toggleResponsibility(tender, false)}
                              >
                                <UserRoundX size={14} />
                                Liberar
                              </button>
                            )}
                            <button
                              className={`mini-action-button spreadsheet-ready-button ${tender.spreadsheetReady ? 'ready' : ''}`}
                              disabled={actionId === tender.id}
                              onClick={() => void toggleSpreadsheet(tender)}
                            >
                              {tender.spreadsheetReady ? 'Desmarcar pronta' : 'Marcar pronta'}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="organized-actions-cell">
                        {companyMode && selectedBid ? (
                          <div className="organized-row-actions company-action-grid">
                            <Link className="action-button compact-action-button" to={`/participacoes/${selectedBid.id}`}>
                              <FolderOpen size={15} /> Abrir
                            </Link>
                            <button
                              className="action-button compact-action-button danger-soft-button"
                              disabled={actionId === selectedBid.id}
                              onClick={() => void detach(tender, selectedBid.id)}
                            >
                              <Unlink size={15} /> Desassociar
                            </button>
                            <Link className="action-button compact-action-button" to={`/participacoes/${selectedBid.id}/editar`}>
                              <Pencil size={15} /> Editar
                            </Link>
                            <button className="action-button compact-action-button" onClick={() => setLinksTender(tender)}>
                              <ExternalLink size={15} /> Links
                            </button>
                          </div>
                        ) : (
                          <div className="organized-row-actions paired-row-actions">
                            <Link className="action-button compact-action-button" to={`/licitacoes/${tender.id}`}>
                              <FolderOpen size={15} /> Abrir
                            </Link>
                            <button
                              className="action-button compact-action-button"
                              disabled={!hasAssociableCompanies}
                              onClick={() => hasAssociableCompanies && setAssociating(tender)}
                            >
                              <Link2 size={15} /> Associar
                            </button>
                            <Link className="action-button compact-action-button" to={`/licitacoes/${tender.id}/editar`}>
                              <Pencil size={15} /> Editar
                            </Link>
                            <button className="action-button compact-action-button" onClick={() => setLinksTender(tender)}>
                              <ExternalLink size={15} /> Links
                            </button>
                            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                              <button
                                className="action-button compact-action-button danger-soft-button"
                                disabled={actionId === tender.id}
                                onClick={() => void deleteTender(tender)}
                              >
                                <Trash2 size={15} /> Apagar
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="pagination">
            <span>{data.total} licitações</span>
            <div>
              <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
              <span>{page} de {data.pages}</span>
              <button disabled={page === data.pages} onClick={() => setPage((value) => value + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </section>

      {associating && (
        <AssociationModal
          tender={associating}
          companies={companies.filter((company) => !associating.bids.some((bid) => bid.companyId === company.id))}
          onClose={() => setAssociating(null)}
          onSaved={() => {
            setAssociating(null);
            void load();
          }}
        />
      )}

      {viewingCompanies && (
        <TenderCompaniesModal tender={viewingCompanies} onClose={() => setViewingCompanies(null)} />
      )}

      {linksTender && <TenderLinksModal tender={linksTender} onClose={() => setLinksTender(null)} />}
    </div>
  );
}

function TenderCompaniesModal({ tender, onClose }: { tender: Tender; onClose: () => void }) {
  const attachedBids = tender.bids.filter((bid) => bid.situation === 'ANEXADA');
  const reference = [tender.municipality, tender.noticeNumber ? `Nº ${tender.noticeNumber}` : tender.processNumber]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal title="Empresas que anexaram" eyebrow="Licitação" onClose={onClose}>
      <div className="tender-companies-modal">
        <div className="tender-companies-modal-summary">
          <span className="tender-companies-modal-icon"><Building2 size={20} /></span>
          <div>
            <strong>{reference}</strong>
            <small>{attachedBids.length} {attachedBids.length === 1 ? 'empresa anexou esta licitação' : 'empresas anexaram esta licitação'}</small>
          </div>
        </div>
        <div className="tender-companies-modal-list">
          {attachedBids.length === 0 && <div className="table-message">Nenhuma empresa anexou esta licitação.</div>}
          {attachedBids.map((bid) => (
            <article key={bid.id}>
              <span className="tender-company-check"><CheckCircle2 size={17} /></span>
              <div>
                <strong>{bid.company.tradeName || bid.company.legalName}</strong>
                <small>Situação atual da participação</small>
              </div>
              <span className="tender-company-status">Anexada</span>
            </article>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function TenderLinksModal({ tender, onClose }: { tender: Tender; onClose: () => void }) {
  const reference = [tender.municipality, formatDate(tender.sessionDate)].join(' · ');
  const links = [
    { label: 'SEOBRA', url: tender.seobraLink, description: 'Consulta externa da licitação' },
    { label: 'Plataforma', url: tender.platformLink || tender.platform?.site, description: tender.platform?.name || 'Plataforma do certame' }
  ];

  return (
    <Modal title="Links da licitação" eyebrow={reference} onClose={onClose}>
      <div className="tender-links-modal">
        {links.map((item) => (
          <article key={item.label} className={item.url ? '' : 'unavailable'}>
            <span className="tender-link-icon"><ExternalLink size={19} /></span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
              {!item.url && <em>Link não informado</em>}
            </div>
            {item.url ? (
              <a className="primary-button compact" href={item.url} target="_blank" rel="noreferrer">
                Abrir <ExternalLink size={14} />
              </a>
            ) : (
              <button className="secondary-button compact" disabled>Indisponível</button>
            )}
          </article>
        ))}
      </div>
    </Modal>
  );
}

function AssociationModal({
  tender,
  companies,
  onClose,
  onSaved
}: {
  tender: Tender;
  companies: CompanySummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0]!.id : '');
  const [progress, setProgress] = useState<BidProgress>('NAO_INICIADA');
  const [situation, setSituation] = useState<BidSituation>('PENDENTE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const company = useMemo(() => companies.find((item) => item.id === companyId), [companies, companyId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/tenders/${tender.id}/participations`, { companyId, progress, situation });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title="Associar licitação à empresa" onClose={onClose}>
      <form className="entity-form association-form-clean" onSubmit={(event) => void submit(event)}>
        <div className="section-note">
          {tender.municipality} · {formatDate(tender.sessionDate)}. Escolha a empresa e o estado inicial da participação.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Empresa
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} required disabled={saving}>
            <option value="">Selecione</option>
            {companies.map((item) => (
              <option key={item.id} value={item.id}>{companyName(item)}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Andamento
            <select value={progress} onChange={(event) => setProgress(event.target.value as BidProgress)} disabled={saving}>
              {progressOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Situação
            <select value={situation} onChange={(event) => setSituation(event.target.value as BidSituation)} disabled={saving}>
              {availableSituationOptions(tender.isPreQualification).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        {company && <small>Será adicionada à lista de {companyName(company)}.</small>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="primary-button" disabled={saving || !companyId}>{saving ? 'Associando...' : 'Associar empresa'}</button>
        </div>
      </form>
    </Modal>
  );
}
