import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Percent,
  Pencil,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CompanyConvocationsPanel } from '../components/CompanyConvocationsPanel';
import { api, errorMessage } from '../services/api';
import type {
  ApiResponse,
  Bid,
  DeadlineAlert,
  DiscountCalculation
} from '../types';
import {
  formatCurrency,
  formatDate,
  guaranteeOptions,
  optionLabel,
  progressOptions,
  situationLabel
} from '../utils/bid';

type Tab = 'summary' | 'data' | 'discount' | 'convocations' | 'deadlines';

export function BidDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [bid, setBid] = useState<Bid | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineAlert[]>([]);
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [deadlineError, setDeadlineError] = useState('');
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    requestedTab &&
      ['summary', 'data', 'discount', 'convocations', 'deadlines'].includes(
        requestedTab
      )
      ? (requestedTab as Tab)
      : 'summary'
  );
  const [loading, setLoading] = useState(true);
  const [markingAttached, setMarkingAttached] = useState(false);
  const [error, setError] = useState('');

  const loadBid = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<Bid>>(`/bids/${id}`);
      setBid(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);
  const loadDeadlines = useCallback(async (tenderId: string) => {
    setDeadlineLoading(true);
    setDeadlineError('');
    try {
      const response = await api.get<ApiResponse<DeadlineAlert[]>>(`/deadlines/tender/${tenderId}`);
      setDeadlines(response.data.data);
    } catch (err) {
      setDeadlineError(errorMessage(err));
    } finally {
      setDeadlineLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadBid(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBid]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === 'deadlines' && bid) void loadDeadlines(bid.tenderId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, bid, loadDeadlines]);

  if (loading)
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando licitação...
      </div>
    );
  if (!bid) return <div className="alert alert-error">{error || 'Licitação não encontrada'}</div>;
  const canEdit = Boolean(
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'EMPRESA' ||
    user?.assignedCompanies.some((company) => company.id === bid.companyId)
  );
  const seobraLinks = bid.tender.seobraLinks?.length
    ? bid.tender.seobraLinks
    : bid.tender.seobraLink
      ? [bid.tender.seobraLink]
      : [];
  const markAttached = async () => {
    setMarkingAttached(true);
    setError('');
    try {
      await api.put(`/bids/${bid.id}`, { situation: 'ANEXADA' });
      await loadBid();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMarkingAttached(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="details-header bid-details-header">
        <div className="details-copy">
          <Link to={`/empresas/${bid.companyId}`} className="back-link">
            <ArrowLeft size={16} />
            Área da empresa
          </Link>
          <span className="eyebrow">{bid.company.tradeName || bid.company.legalName}</span>
          <h2>
            {bid.tender.municipality} — {formatDate(bid.tender.sessionDate)}
          </h2>
          {(bid.tender.modality || bid.tender.noticeNumber || bid.tender.processNumber) && (
            <div className="tender-reference-line">
              {bid.tender.modality && <span>{bid.tender.modality}</span>}
              {bid.tender.noticeNumber && <span>Nº {bid.tender.noticeNumber}</span>}
              {bid.tender.processNumber && <span>Processo {bid.tender.processNumber}</span>}
            </div>
          )}
          <p>{bid.tender.object}</p>
        </div>
        <div className="details-actions bid-details-actions bid-detail-action-grid">
          {seobraLinks.length > 0 ? (
            seobraLinks.map((url, index) => (
              <a className="bid-detail-action-card" href={url} target="_blank" rel="noreferrer" key={url}>
                <ExternalLink size={16} />
                <span><small>SEOBRA</small><strong>Lote {index + 1}</strong></span>
              </a>
            ))
          ) : (
            <span className="bid-detail-action-card disabled">
              <ExternalLink size={16} />
              <span><small>Link não informado</small><strong>SEOBRA</strong></span>
            </span>
          )}
          {bid.tender.platformLink ? (
            <a className="bid-detail-action-card" href={bid.tender.platformLink} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              <span><small>{bid.tender.platform?.name || 'Plataforma'}</small><strong>Plataforma</strong></span>
            </a>
          ) : (
            <span className="bid-detail-action-card disabled">
              <ExternalLink size={16} />
              <span><small>Link não informado</small><strong>Plataforma</strong></span>
            </span>
          )}
          {canEdit && bid.situation === 'PENDENTE' ? (
            <button className="bid-detail-action-card status-action" disabled={markingAttached} onClick={() => void markAttached()}>
              <CheckCircle2 size={16} />
              <span><small>Situação</small><strong>{markingAttached ? 'Marcando...' : 'Marcar anexada'}</strong></span>
            </button>
          ) : (
            <span className="bid-detail-action-card status-action attached">
              <CheckCircle2 size={16} />
              <span><small>Situação</small><strong>{situationLabel(bid.situation, bid.tender.isPreQualification)}</strong></span>
            </span>
          )}
          {canEdit ? (
            <Link className="bid-detail-action-card primary" to={`/participacoes/${bid.id}/editar`}>
              <Pencil size={16} />
              <span><small>Dados da empresa</small><strong>Editar</strong></span>
            </Link>
          ) : (
            <span className="bid-detail-action-card disabled">
              <Pencil size={16} />
              <span><small>Sem permissão</small><strong>Editar</strong></span>
            </span>
          )}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs">
        {(
          [
            ['summary', 'Resumo'],
            ['data', 'Dados'],
            ['discount', 'Baixa'],
            ['convocations', 'Avisos por e-mail'],
            ['deadlines', 'Prazos'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'summary' && (
        <div className="details-grid">
          <InfoCard label="Sessão" value={formatDate(bid.tender.sessionDate)} />
          <InfoCard label="Plataforma" value={bid.tender.platform?.name || 'Não informada'} />
          <InfoCard label="Andamento" value={optionLabel(progressOptions, bid.progress)} />
          <InfoCard label="Proposta" value={formatCurrency(bid.proposalValue)} />
          <InfoCard
            label="Validade"
            value={
              bid.tender.proposalValidityDays ? `${bid.tender.proposalValidityDays} dias` : 'Não informada'
            }
          />
          <InfoCard label="Garantia" value={optionLabel(guaranteeOptions, bid.tender.guaranteeType)} />
        </div>
      )}
      {tab === 'data' && (
        <section className="detail-panel">
          <dl className="data-list">
            <div>
              <dt>Empresa</dt>
              <dd>{bid.company.legalName}</dd>
            </div>
            <div>
              <dt>Modalidade</dt>
              <dd>{bid.tender.modality || '—'}</dd>
            </div>
            <div>
              <dt>Número do edital</dt>
              <dd>{bid.tender.noticeNumber || '—'}</dd>
            </div>
            <div>
              <dt>Processo administrativo</dt>
              <dd>{bid.tender.processNumber || '—'}</dd>
            </div>
            <div>
              <dt>Prazo de execução</dt>
              <dd>{bid.tender.executionTerm || '—'}</dd>
            </div>
            <div>
              <dt>Planilha</dt>
              <dd>{bid.tender.spreadsheetReady ? 'Concluído' : 'Em andamento'}</dd>
            </div>
            <div>
              <dt>Lista geral</dt>
              <dd>{bid.tender.listStatus === 'ANEXADA' ? 'Já anexada' : 'Pendente'}</dd>
            </div>
            <div>
              <dt>Valor estimado</dt>
              <dd>{formatCurrency(bid.tender.estimatedValue)}</dd>
            </div>
            <div>
              <dt>Percentual da garantia</dt>
              <dd>{bid.tender.guaranteePercentage ? `${bid.tender.guaranteePercentage}%` : '—'}</dd>
            </div>
            <div>
              <dt>Valor da garantia</dt>
              <dd>{formatCurrency(bid.tender.guaranteeValue)}</dd>
            </div>
            <div>
              <dt>Link da plataforma</dt>
              <dd>
                {bid.tender.platformLink ? (
                  <a href={bid.tender.platformLink} target="_blank" rel="noreferrer">
                    Abrir plataforma
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Link do SEOBRA</dt>
              <dd>
                {seobraLinks.length > 0
                  ? seobraLinks.map((url, index) => (
                      <a href={url} target="_blank" rel="noreferrer" key={url}>
                        Lote {index + 1}{index < seobraLinks.length - 1 ? ' · ' : ''}
                      </a>
                    ))
                  : '—'}
              </dd>
            </div>
            <div className="full">
              <dt>Observações</dt>
              <dd>{bid.observations || 'Nenhuma observação.'}</dd>
            </div>
          </dl>
        </section>
      )}
      {tab === 'discount' && <DiscountPanel bid={bid} canEdit={canEdit} />}
      {tab === 'convocations' && (
        <CompanyConvocationsPanel companyId={bid.companyId} bidId={bid.id} showHeading={false} />
      )}
      {tab === 'deadlines' && (
        <DeadlinesPanel deadlines={deadlines} loading={deadlineLoading} error={deadlineError} />
      )}

    </div>
  );
}

function DiscountPanel({ bid, canEdit }: { bid: Bid; canEdit: boolean }) {
  const [item, setItem] = useState<DiscountCalculation | null>(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<DiscountCalculation[]>>(
        `/companies/${bid.companyId}/discounts`
      );
      const current = response.data.data.find((row) => row.tenderId === bid.tenderId) ?? null;
      setItem(current);
      setValue(current?.discountedValue ?? '');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [bid.companyId, bid.tenderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async () => {
    if (!value) return setError('Informe o valor final da proposta após a baixa.');
    setSaving(true);
    setError('');
    try {
      let discountId = item?.id;
      if (!discountId) {
        const created = await api.post<ApiResponse<DiscountCalculation>>(
          `/companies/${bid.companyId}/discounts`,
          {
            tenderId: bid.tenderId
          }
        );
        discountId = created.data.data.id;
      }
      await api.put(`/companies/${bid.companyId}/discounts/${discountId}`, { discountedValue: value });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const percentage = item?.discountPercentage ? Number(item.discountPercentage) : null;
  return (
    <section className="detail-panel bid-discount-panel">
      <div className="section-heading-inline commercial-heading">
        <div>
          <span className="eyebrow">Proposta da empresa</span>
          <strong>Baixa desta licitação</strong>
          <small>Informe aqui o valor final da proposta desta empresa.</small>
        </div>
        <Percent size={24} />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="table-message">
          <span className="spinner" />
          Carregando baixa...
        </div>
      ) : (
        <div className="bid-discount-grid">
          <div>
            <small>Valor global</small>
            <strong>{formatCurrency(bid.tender.estimatedValue)}</strong>
          </div>
          <label>
            Valor final após a baixa
            <input
              type="number"
              min="0"
              step="0.01"
              max={bid.tender.estimatedValue ?? undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={!canEdit}
              placeholder="0,00"
            />
          </label>
          <div>
            <small>Percentual de baixa</small>
            <strong>
              {percentage === null
                ? '—'
                : `${percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
            </strong>
          </div>
          {canEdit && (
            <button className="primary-button" onClick={() => void save()} disabled={saving || !value}>
              {saving ? 'Salvando...' : item ? 'Atualizar baixa' : 'Salvar baixa'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function formatDeadlineDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function deadlineRelativeLabel(days: number) {
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Vence amanhã';
  return `Vence em ${days} dias`;
}

function DeadlinesPanel({
  deadlines,
  loading,
  error
}: {
  deadlines: DeadlineAlert[];
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <section className="detail-panel">
        <div className="table-message">
          <span className="spinner" />
          Carregando prazos...
        </div>
      </section>
    );
  }

  if (error) return <div className="alert alert-error">{error}</div>;

  if (deadlines.length === 0) {
    return (
      <section className="empty-state compact">
        <CalendarClock size={28} />
        <p>Nenhum prazo cadastrado para esta licitação.</p>
      </section>
    );
  }

  return (
    <section className="detail-panel deadline-panel">
      <div className="section-note">
        Aqui aparecem somente datas operacionais da licitação, como a sessão. A validade da Carta Proposta não
        é tratada como prazo.
      </div>
      <div className="deadline-list">
        {deadlines.map((item) => (
          <article key={item.key} className={`deadline-row ${item.severity.toLowerCase()}`}>
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
                <em>{deadlineRelativeLabel(item.days)}</em>
              </span>
              <span>
                {item.noticeNumber || item.processNumber || 'Licitação sem número'} · {item.municipality}
                {item.state ? `/${item.state}` : ''}
              </span>
              <small>Data da sessão cadastrada na licitação.</small>
            </span>
            <span className="deadline-meta">
              <strong>
                {formatDeadlineDate(item.date)}
                {item.type === 'SESSION' && item.sessionTime ? ` às ${item.sessionTime}` : ''}
              </strong>
              <small>{item.platform?.name || 'Sem plataforma'}</small>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="detail-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

