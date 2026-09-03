import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FilterX,
  FolderOpen,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRoundCheck,
  UserRoundX
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, BidProgress, BidSituation, CompanySummary, Paginated, Tender } from '../types';
import { formatCurrency, formatDate, progressOptions, situationOptions } from '../utils/bid';

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

export function TendersPage() {
  const { user } = useAuth();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [data, setData] = useState<Paginated<Tender> | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [search, setSearch] = useState('');
  const [listStatus, setListStatus] = useState<'PENDENTE' | 'ANEXADA'>('PENDENTE');
  const [day, setDay] = useState('all');
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(currentYear);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [associating, setAssociating] = useState<Tender | null>(null);

  const yearOptions = Array.from({ length: 8 }, (_, index) => currentYear - 5 + index);
  const daysInSelectedMonth = month === 'all' ? 31 : new Date(year, Number(month), 0).getDate();
  const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, index) => index + 1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = dateRange(year, month, day);
      const response = await api.get<ApiResponse<Paginated<Tender>>>('/tenders', {
        params: {
          search: search || undefined,
          listStatus,
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
  }, [search, listStatus, day, month, year, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    void api
      .get<ApiResponse<CompanySummary[]>>('/companies/options')
      .then((response) => setCompanies(response.data.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

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


  const deleteTender = async (tender: Tender) => {
    const label = tender.noticeNumber ? `${tender.municipality} · ${tender.noticeNumber}` : tender.municipality;
    const confirmation = window.prompt(
      `ATENÇÃO: excluir ${label} também remove as participações e os registros vinculados.\n\nDigite EXCLUIR para confirmar:`
    );
    if (confirmation?.trim().toUpperCase() !== 'EXCLUIR') {
      return;
    }
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

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p>Controle geral compartilhado</p>
          <h2>Licitações</h2>
          <span>Organize as licitações por data, acompanhe a planilha e veja quem está responsável.</span>
        </div>
        <Link className="primary-button" to="/licitacoes/nova">
          <Plus size={18} />
          Nova licitação
        </Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tender-status-tabs">
        <button
          className={listStatus === 'PENDENTE' ? 'active' : ''}
          onClick={() => {
            setListStatus('PENDENTE');
            setPage(1);
          }}
        >
          Pendentes
        </button>
        <button
          className={listStatus === 'ANEXADA' ? 'active' : ''}
          onClick={() => {
            setListStatus('ANEXADA');
            setPage(1);
          }}
        >
          Já anexadas
        </button>
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
                <th>Empresas</th>
                <th>Planilha</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="table-message">
                    Carregando licitações...
                  </td>
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
                  const isResponsible = tender.spreadsheetResponsibleUserId === user?.id;
                  const canRelease = isResponsible || user?.role === 'ADMIN';
                  const canManageSpreadsheet = user?.role !== 'EMPRESA';
                  const hasAssociableCompanies = companies.some(
                    (company) => !tender.bids.some((bid) => bid.companyId === company.id)
                  );
                  const attachedBids = tender.bids.filter((bid) => bid.situation === 'ANEXADA');
                  const pendingBids = tender.bids.filter((bid) => bid.situation !== 'ANEXADA');
                  const tenderLabel = [tender.modality, tender.noticeNumber ? `Nº ${tender.noticeNumber}` : null]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <tr key={tender.id}>
                      <td className="tender-identity-cell compact-license-cell">
                        <div className="tender-cell-content">
                          <strong>{tender.municipality}</strong>
                          {tenderLabel && <small>{tenderLabel}</small>}
                        </div>
                      </td>
                      <td className="tender-date-cell">
                        <div className="tender-cell-content">
                          <strong>{formatDate(tender.sessionDate)}</strong>
                        </div>
                      </td>
                      <td className="object-cell organized-object-cell">
                        <div className="tender-cell-content">
                          <strong>{tender.object}</strong>
                        </div>
                      </td>
                      <td className="tender-validity-cell">
                        <div className="tender-cell-content">
                          <strong>{tender.proposalValidityDays ?? '—'} dias</strong>
                          <small>Validade da proposta</small>
                        </div>
                      </td>
                      <td className="tender-value-platform-cell">
                        <div className="tender-cell-content">
                          <strong>{formatCurrency(tender.estimatedValue)}</strong>
                          <small>{tender.platform?.name || 'Sem plataforma'}</small>
                        </div>
                      </td>
                      <td className="companies-cell organized-companies-cell">
                        <div className="tender-cell-content tender-companies-content">
                          <span className="association-count">
                            <Building2 size={15} />
                            {tender.attachedCompanies}/{tender._count?.bids ?? 0} anexaram
                          </span>
                          {attachedBids.length > 0 && (
                            <div className="attached-company-list">
                              {attachedBids.map((bid) => (
                                <span key={bid.id} className="attached-company-pill">
                                  {bid.company.tradeName || bid.company.legalName} anexou
                                </span>
                              ))}
                            </div>
                          )}
                          {attachedBids.length === 0 && pendingBids.length > 0 && (
                            <small>
                              Associadas: {pendingBids.map((bid) => bid.company.tradeName || bid.company.legalName).join(', ')}
                            </small>
                          )}
                          {tender.bids.length === 0 && <small>Nenhuma empresa associada</small>}
                        </div>
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
                            {canManageSpreadsheet && !tender.spreadsheetResponsibleUserId && (
                              <button
                                className="mini-action-button primary-soft"
                                disabled={actionId === tender.id}
                                onClick={() => void toggleResponsibility(tender, true)}
                              >
                                <UserRoundCheck size={14} />
                                Assumir
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
                        <div className="organized-row-actions paired-row-actions">
                          <Link className="action-button compact-action-button" to={`/licitacoes/${tender.id}`}>
                            <FolderOpen size={15} />
                            Abrir
                          </Link>
                          <button
                            className="action-button compact-action-button"
                            disabled={!hasAssociableCompanies}
                            onClick={() => hasAssociableCompanies && setAssociating(tender)}
                            title={hasAssociableCompanies ? 'Associar empresa' : 'Todas as empresas já foram associadas'}
                          >
                            <Link2 size={15} />
                            Associar
                          </button>
                          <Link className="action-button compact-action-button" to={`/licitacoes/${tender.id}/editar`}>
                            <Pencil size={15} />
                            Editar
                          </Link>
                          {user?.role === 'ADMIN' && (
                            <button
                              className="action-button compact-action-button danger-soft-button"
                              disabled={actionId === tender.id}
                              onClick={() => void deleteTender(tender)}
                            >
                              <Trash2 size={15} />
                              Apagar
                            </button>
                          )}
                        </div>
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
              <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </button>
              <span>
                {page} de {data.pages}
              </span>
              <button disabled={page === data.pages} onClick={() => setPage((value) => value + 1)}>
                Próxima
              </button>
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

    </div>
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
  const [proposalValue, setProposalValue] = useState('');
  const [progress, setProgress] = useState<BidProgress>('NAO_INICIADA');
  const [situation, setSituation] = useState<BidSituation>('PENDENTE');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const companyName = useMemo(() => companies.find((company) => company.id === companyId), [companies, companyId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/tenders/${tender.id}/participations`, {
        companyId,
        proposalValue: proposalValue || null,
        progress,
        situation,
        observations: observations || null
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Associar licitação à empresa" onClose={onClose}>
      <form className="entity-form" onSubmit={(event) => void submit(event)}>
        <div className="section-note">
          {tender.municipality} · {formatDate(tender.sessionDate)}. A participação e os documentos ficarão privados para a empresa.
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Empresa
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} required>
            <option value="">Selecione</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.tradeName || company.legalName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor da proposta (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={proposalValue}
            onChange={(event) => setProposalValue(event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            Andamento
            <select value={progress} onChange={(event) => setProgress(event.target.value as BidProgress)}>
              {progressOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Situação
            <select value={situation} onChange={(event) => setSituation(event.target.value as BidSituation)}>
              {situationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Observações privadas
          <textarea rows={3} value={observations} onChange={(event) => setObservations(event.target.value)} />
        </label>
        {companyName && <small>Será adicionada à lista de {companyName.tradeName || companyName.legalName}.</small>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? 'Associando...' : 'Associar empresa'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
