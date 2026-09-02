import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FilterX,
  FolderOpen,
  Link2,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
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

function monthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
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
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(currentYear);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [associating, setAssociating] = useState<Tender | null>(null);
  const [notesTender, setNotesTender] = useState<Tender | null>(null);

  const yearOptions = Array.from({ length: 8 }, (_, index) => currentYear - 5 + index);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = month === 'all' ? {} : monthRange(year, Number(month));
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
  }, [search, listStatus, month, year, page]);

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

  const moveTender = async (tender: Tender, status: 'PENDENTE' | 'ANEXADA') => {
    setActionId(tender.id);
    setError('');
    try {
      await api.patch(`/tenders/${tender.id}/list-status`, { status });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId('');
    }
  };

  const deleteTender = async (tender: Tender) => {
    const label = tender.noticeNumber ? `${tender.municipality} · ${tender.noticeNumber}` : tender.municipality;
    if (
      !window.confirm(
        `Excluir definitivamente a licitação ${label}? As participações e registros vinculados a ela também serão removidos do banco.`
      )
    ) {
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

  const changeMonth = (delta: number) => {
    if (month === 'all') {
      setMonth(String(currentMonth));
      setYear(currentYear);
      setPage(1);
      return;
    }
    let nextMonth = Number(month) + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setMonth(String(nextMonth));
    setYear(nextYear);
    setPage(1);
  };

  const selectedMonthLabel =
    month === 'all' ? `Todos os meses de ${year}` : `${monthOptions.find((item) => item.value === month)?.label} de ${year}`;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p>Controle geral compartilhado</p>
          <h2>Licitações</h2>
          <span>Organize as sessões por mês, acompanhe a planilha e veja quem está responsável.</span>
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
        <div className="tender-month-bar">
          <div className="month-navigation">
            <button className="icon-button" onClick={() => changeMonth(-1)} title="Mês anterior">
              <ChevronLeft size={17} />
            </button>
            <div className="month-title">
              <CalendarDays size={18} />
              <span>
                <small>Sessões de</small>
                <strong>{selectedMonthLabel}</strong>
              </span>
            </div>
            <button className="icon-button" onClick={() => changeMonth(1)} title="Próximo mês">
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="month-selectors">
            <select
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
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
            <select
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value));
                setPage(1);
              }}
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
                <th>Objeto</th>
                <th>Valor e plataforma</th>
                <th>Planilha</th>
                <th>Empresas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="table-message">
                    Carregando licitações...
                  </td>
                </tr>
              )}
              {!loading && !data?.items.length && (
                <tr>
                  <td colSpan={6} className="table-message">
                    <FileText size={28} />
                    Nenhuma licitação em {selectedMonthLabel.toLowerCase()}.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((tender) => {
                  const isResponsible = tender.spreadsheetResponsibleUserId === user?.id;
                  const canRelease = isResponsible || user?.role === 'ADMIN';
                  const canManageSpreadsheet = user?.role !== 'EMPRESA';
                  return (
                    <tr key={tender.id}>
                      <td className="tender-identity-cell">
                        <div className="tender-city-line">
                          <strong>{tender.municipality}</strong>
                          <span>{formatDate(tender.sessionDate)}</span>
                        </div>
                        {(tender.modality || tender.noticeNumber) && (
                          <small>
                            {[tender.modality, tender.noticeNumber ? `Nº ${tender.noticeNumber}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                        )}
                        {tender.processNumber && <small>Proc. {tender.processNumber}</small>}
                      </td>
                      <td className="object-cell organized-object-cell">
                        <strong>{tender.object}</strong>
                        <small>
                          Validade: {tender.proposalValidityDays ?? '—'} dias · Garantia 1%:{' '}
                          {Number(tender.guaranteePercentage) === 1 ? 'Sim' : 'Não'}
                        </small>
                      </td>
                      <td className="tender-value-platform-cell">
                        <strong>{formatCurrency(tender.estimatedValue)}</strong>
                        <small>{tender.platform?.name || 'Sem plataforma'}</small>
                      </td>
                      <td className="spreadsheet-control-cell">
                        <div className="spreadsheet-status-line">
                          <span className={`spreadsheet-status-pill ${tender.spreadsheetReady ? 'ready' : ''}`}>
                            {tender.spreadsheetReady ? <CheckCircle2 size={14} /> : <ClipboardCheck size={14} />}
                            {tender.spreadsheetReady ? 'Pronta' : 'Em preparação'}
                          </span>
                        </div>
                        <div className="spreadsheet-owner-line">
                          <UserRoundCheck size={15} />
                          <span>
                            <small>Responsável</small>
                            <strong>{tender.spreadsheetResponsibleUser?.name || 'Não definido'}</strong>
                          </span>
                        </div>
                        {tender.spreadsheetNotes && (
                          <button className="spreadsheet-note-preview" onClick={() => setNotesTender(tender)}>
                            <MessageSquareText size={14} />
                            <span>{tender.spreadsheetNotes}</span>
                          </button>
                        )}
                        <div className="spreadsheet-actions">
                          {canManageSpreadsheet && !tender.spreadsheetResponsibleUserId && (
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
                          {(isResponsible || user?.role === 'ADMIN' || tender.spreadsheetNotes) && (
                            <button className="mini-action-button" onClick={() => setNotesTender(tender)}>
                              <MessageSquareText size={14} />
                              Observações
                            </button>
                          )}
                          <button
                            className={`mini-action-button ${tender.spreadsheetReady ? 'ready' : ''}`}
                            disabled={actionId === tender.id}
                            onClick={() => void toggleSpreadsheet(tender)}
                          >
                            {tender.spreadsheetReady ? 'Marcar não pronta' : 'Marcar pronta'}
                          </button>
                        </div>
                      </td>
                      <td className="companies-cell">
                        <span className="association-count">
                          <Building2 size={15} />
                          {tender.attachedCompanies}/{tender._count?.bids ?? 0} anexaram
                        </span>
                        {tender.bids.length > 0 ? (
                          <small>
                            {tender.bids.map((bid) => bid.company.tradeName || bid.company.legalName).join(', ')}
                          </small>
                        ) : (
                          <small>Nenhuma empresa associada</small>
                        )}
                      </td>
                      <td className="organized-actions-cell">
                        <div className="row-actions organized-row-actions">
                          <Link className="action-button" to={`/licitacoes/${tender.id}`}>
                            <FolderOpen size={15} />
                            Abrir
                          </Link>
                          {companies.some((company) => !tender.bids.some((bid) => bid.companyId === company.id)) && (
                            <button className="action-button" onClick={() => setAssociating(tender)}>
                              <Link2 size={15} />
                              Associar
                            </button>
                          )}
                          {listStatus === 'PENDENTE' ? (
                            <button
                              className="action-button move-attached"
                              disabled={!tender.allCompaniesAttached || actionId === tender.id}
                              title={
                                tender.allCompaniesAttached
                                  ? 'Mover para já anexadas'
                                  : 'Todas as empresas precisam marcar a participação como ANEXADA'
                              }
                              onClick={() => void moveTender(tender, 'ANEXADA')}
                            >
                              <CheckCircle2 size={15} />
                              Já anexada
                            </button>
                          ) : (
                            <button
                              className="action-button"
                              disabled={actionId === tender.id}
                              onClick={() => void moveTender(tender, 'PENDENTE')}
                            >
                              <RotateCcw size={15} />
                              Voltar
                            </button>
                          )}
                          <Link className="action-button icon-only-action" to={`/licitacoes/${tender.id}/editar`} title="Editar">
                            <Pencil size={15} />
                          </Link>
                          {user?.role !== 'EMPRESA' && (
                            <button
                              className="action-button icon-only-action danger-action"
                              disabled={actionId === tender.id}
                              onClick={() => void deleteTender(tender)}
                              title="Excluir licitação"
                            >
                              <Trash2 size={15} />
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

      {notesTender && (
        <SpreadsheetNotesModal
          tender={notesTender}
          canEdit={user?.role === 'ADMIN' || notesTender.spreadsheetResponsibleUserId === user?.id}
          onClose={() => setNotesTender(null)}
          onSaved={() => {
            setNotesTender(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function SpreadsheetNotesModal({
  tender,
  canEdit,
  onClose,
  onSaved
}: {
  tender: Tender;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(tender.spreadsheetNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/tenders/${tender.id}/spreadsheet-notes`, { notes: notes.trim() || null });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Observações da planilha" onClose={onClose}>
      <form className="entity-form" onSubmit={(event) => void save(event)}>
        <div className="section-note">
          <strong>{tender.municipality}</strong> · {formatDate(tender.sessionDate)}
          <br />
          Responsável: {tender.spreadsheetResponsibleUser?.name || 'não definido'}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Informações, alterações e pendências da planilha
          <textarea
            rows={8}
            value={notes}
            disabled={!canEdit}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: revisar composição do item 4.2; orçamento atualizado; falta conferir BDI..."
          />
        </label>
        {!canEdit && <small>Somente o responsável pela planilha ou um administrador pode editar.</small>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Fechar
          </button>
          {canEdit && (
            <button className="primary-button" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar observações'}
            </button>
          )}
        </div>
      </form>
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
