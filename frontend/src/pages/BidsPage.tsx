import { ExternalLink, FileText, FilterX, FolderOpen, Link2, Pencil, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Bid, BidProgress, BidSituation, CompanySummary, Paginated } from '../types';
import { formatCurrency, formatDate, optionLabel, progressOptions, situationOptions } from '../utils/bid';

export function BidsPage({ fixedCompanyId }: { fixedCompanyId?: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<Paginated<Bid> | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState(fixedCompanyId ?? '');
  const [progress, setProgress] = useState('');
  const [situation, setSituation] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<Paginated<Bid>>>('/bids', {
        params: {
          search: search || undefined,
          companyId: fixedCompanyId || companyId || undefined,
          progress: progress || undefined,
          situation: situation || undefined,
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
  }, [search, companyId, fixedCompanyId, progress, situation, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!fixedCompanyId)
      void api
        .get<ApiResponse<CompanySummary[]>>('/companies/options')
        .then((response) => setCompanies(response.data.data));
  }, [fixedCompanyId]);

  const clear = () => {
    setSearch('');
    setCompanyId(fixedCompanyId ?? '');
    setProgress('');
    setSituation('');
    setPage(1);
  };
  const canEdit = (bid: Bid) =>
    user?.role === 'ADMIN' ||
    user?.role === 'EMPRESA' ||
    user?.assignedCompanies.some((company) => company.id === bid.companyId);
  const canCreate =
    user?.role === 'ADMIN' || user?.role === 'EMPRESA' || Boolean(user?.assignedCompanies.length);

  return (
    <div className="page-stack">
      {fixedCompanyId && canCreate && (
        <div className="embedded-heading">
          <span>Participações e documentos exclusivos desta empresa</span>
          <Link className="primary-button" to="/licitacoes">
            <Link2 size={17} />
            Associar do controle geral
          </Link>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <section className="table-card">
        <div className="bid-filters">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Empresa, município, objeto, edital ou processo"
            />
          </label>
          {!fixedCompanyId && (
            <select
              value={companyId}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as empresas</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.tradeName || company.legalName}
                </option>
              ))}
            </select>
          )}
          <select
            value={progress}
            onChange={(event) => {
              setProgress(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os andamentos</option>
            {progressOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={situation}
            onChange={(event) => {
              setSituation(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as situações</option>
            {situationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="secondary-button" onClick={clear}>
            <FilterX size={16} />
            Limpar
          </button>
        </div>
        <div className="table-wrap">
          <table className="bids-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Município</th>
                <th>Data</th>
                <th>Objeto</th>
                <th>Validade</th>
                <th>Valor</th>
                <th>Seguro</th>
                <th>Andamento</th>
                <th>Plataforma</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="table-message">
                    Carregando licitações...
                  </td>
                </tr>
              )}
              {!loading && !data?.items.length && (
                <tr>
                  <td colSpan={11} className="table-message">
                    <FileText size={28} />
                    Nenhuma licitação encontrada.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((bid) => (
                  <tr key={bid.id}>
                    <td>
                      <strong>{bid.company.tradeName || bid.company.legalName}</strong>
                    </td>
                    <td>
                      <strong>{bid.tender.municipality}</strong>
                      {(bid.tender.modality || bid.tender.noticeNumber || bid.tender.processNumber) && (
                        <small>
                          {[bid.tender.modality, bid.tender.noticeNumber ? `Nº ${bid.tender.noticeNumber}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                          {bid.tender.processNumber
                            ? `${bid.tender.modality || bid.tender.noticeNumber ? ' · ' : ''}Proc. ${bid.tender.processNumber}`
                            : ''}
                        </small>
                      )}
                    </td>
                    <td>{formatDate(bid.tender.sessionDate)}</td>
                    <td className="object-cell">
                      <strong>{bid.tender.object}</strong>
                      <small>Valor global: {formatCurrency(bid.tender.estimatedValue)}</small>
                    </td>
                    <td>
                      {bid.tender.proposalValidityDays ? `${bid.tender.proposalValidityDays} dias` : '—'}
                    </td>
                    <td>{formatCurrency(bid.proposalValue || bid.tender.estimatedValue)}</td>
                    <td>{bid.tender.guaranteeType === 'NAO_EXIGIDA' ? 'Não' : 'Sim'}</td>
                    <td>
                      <span className="role-pill">
                        {optionLabel(progressOptions, bid.progress as BidProgress)}
                      </span>
                    </td>
                    <td>
                      <div className="table-platform-cell">
                        <span>{bid.tender.platform?.name || '—'}</span>
                        <div className="table-external-links">
                          {bid.tender.platformLink && (
                            <a
                              className="inline-link-button"
                              href={bid.tender.platformLink}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir esta licitação na plataforma"
                            >
                              <ExternalLink size={13} />
                              Plataforma
                            </a>
                          )}
                          {bid.tender.seobraLink && (
                            <a
                              className="inline-link-button"
                              href={bid.tender.seobraLink}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir esta licitação no SEOBRA"
                            >
                              <ExternalLink size={13} />
                              SEOBRA
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{optionLabel(situationOptions, bid.situation as BidSituation)}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="action-button" to={`/participacoes/${bid.id}`}>
                          <FolderOpen size={15} />
                          Abrir
                        </Link>
                        {canEdit(bid) && (
                          <Link className="action-button" to={`/participacoes/${bid.id}/editar`}>
                            <Pencil size={15} />
                          </Link>
                        )}
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
    </div>
  );
}
