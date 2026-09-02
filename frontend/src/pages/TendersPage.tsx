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
  RotateCcw,
  Search
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, BidProgress, BidSituation, CompanySummary, Paginated, Tender } from '../types';
import { formatCurrency, formatDate, progressOptions, situationOptions } from '../utils/bid';

export function TendersPage() {
  const [data, setData] = useState<Paginated<Tender> | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [search, setSearch] = useState('');
  const [listStatus, setListStatus] = useState<'PENDENTE' | 'ANEXADA'>('PENDENTE');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [associating, setAssociating] = useState<Tender | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<Paginated<Tender>>>('/tenders', {
        params: { search: search || undefined, listStatus, page, pageSize: 20 }
      });
      setData(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, listStatus, page]);

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

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p>Controle geral compartilhado</p>
          <h2>Licitações</h2>
          <span>Todos os perfis veem a mesma situação da planilha e dos anexos.</span>
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

      <section className="table-card">
        <div className="bid-filters general-tender-filters">
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
              setPage(1);
            }}
          >
            <FilterX size={16} />
            Limpar
          </button>
        </div>
        <div className="table-wrap">
          <table className="bids-table general-tenders-table simplified-tenders-table">
            <thead>
              <tr>
                <th>Cidade</th>
                <th>Data</th>
                <th>Objeto</th>
                <th>Valor global</th>
                <th>Plataforma</th>
                <th>Planilha</th>
                <th>Empresas</th>
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
                    Nenhuma licitação nesta lista.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((tender) => (
                  <tr key={tender.id}>
                    <td>
                      <strong>{tender.municipality}</strong>
                      {(tender.modality || tender.noticeNumber || tender.processNumber) && (
                        <small>
                          {[tender.modality, tender.noticeNumber ? `Nº ${tender.noticeNumber}` : null].filter(Boolean).join(' · ')}
                          {tender.processNumber ? `${tender.modality || tender.noticeNumber ? ' · ' : ''}Proc. ${tender.processNumber}` : ''}
                        </small>
                      )}
                    </td>
                    <td>{formatDate(tender.sessionDate)}</td>
                    <td className="object-cell">
                      <strong>{tender.object}</strong>
                      <small>
                        Validade: {tender.proposalValidityDays ?? '—'} dias · Garantia 1%:{' '}
                        {Number(tender.guaranteePercentage) === 1 ? 'Sim' : 'Não'}
                      </small>
                    </td>
                    <td>
                      <strong>{formatCurrency(tender.estimatedValue)}</strong>
                    </td>
                    <td>{tender.platform?.name || '—'}</td>
                    <td>
                      <button
                        className={`spreadsheet-button ${tender.spreadsheetReady ? 'ready' : ''}`}
                        disabled={actionId === tender.id}
                        onClick={() => void toggleSpreadsheet(tender)}
                      >
                        {tender.spreadsheetReady ? <CheckCircle2 size={16} /> : <ClipboardCheck size={16} />}
                        {tender.spreadsheetReady ? 'Planilha pronta' : 'Marcar como pronta'}
                      </button>
                    </td>
                    <td>
                      <span className="association-count">
                        <Building2 size={15} />
                        {tender.attachedCompanies}/{tender._count?.bids ?? 0} anexaram
                      </span>
                      {tender.bids.length > 0 && (
                        <small>
                          {tender.bids
                            .map((bid) => bid.company.tradeName || bid.company.legalName)
                            .join(', ')}
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link className="action-button" to={`/licitacoes/${tender.id}`}>
                          <FolderOpen size={15} />
                          Abrir
                        </Link>
                        {companies.some(
                          (company) => !tender.bids.some((bid) => bid.companyId === company.id)
                        ) && (
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
                        <Link className="action-button" to={`/licitacoes/${tender.id}/editar`} title="Editar">
                          <Pencil size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
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
          companies={companies.filter(
            (company) => !associating.bids.some((bid) => bid.companyId === company.id)
          )}
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
  const companyName = useMemo(
    () => companies.find((company) => company.id === companyId),
    [companies, companyId]
  );
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
          {tender.municipality} · {formatDate(tender.sessionDate)}. A participação e os documentos ficarão
          privados para a empresa.
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
        {companyName && (
          <small>Será adicionada à lista de {companyName.tradeName || companyName.legalName}.</small>
        )}
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
