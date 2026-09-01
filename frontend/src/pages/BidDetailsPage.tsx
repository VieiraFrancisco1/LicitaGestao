import { ArrowLeft, CheckCircle2, Download, File as FileIcon, FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Bid, BidDocument, DocumentCategory } from '../types';
import {
  documentCategoryOptions,
  formatBytes,
  formatCurrency,
  formatDate,
  guaranteeOptions,
  optionLabel,
  progressOptions,
  situationOptions
} from '../utils/bid';

type Tab = 'summary' | 'data' | 'documents' | 'convocations' | 'deadlines' | 'history';

export function BidDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [bid, setBid] = useState<Bid | null>(null);
  const [documents, setDocuments] = useState<BidDocument[]>([]);
  const [tab, setTab] = useState<Tab>('summary');
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
  const loadDocuments = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<BidDocument[]>>(`/bids/${id}/documents`);
      setDocuments(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadBid(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBid]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === 'documents') void loadDocuments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadDocuments]);

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
    user?.role === 'EMPRESA' ||
    user?.assignedCompanies.some((company) => company.id === bid.companyId)
  );
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
      <div className="details-header">
        <div>
          <Link to={`/empresas/${bid.companyId}`} className="back-link">
            <ArrowLeft size={16} />
            Área da empresa
          </Link>
          <span className="eyebrow">{bid.company.tradeName || bid.company.legalName}</span>
          <h2>
            {bid.tender.municipality} — {formatDate(bid.tender.sessionDate)}
          </h2>
          <p>{bid.tender.object}</p>
        </div>
        <div className="details-actions">
          <span className="status-pill active">{optionLabel(situationOptions, bid.situation)}</span>
          {canEdit && bid.situation !== 'ANEXADA' && (
            <button
              className="secondary-button"
              disabled={markingAttached}
              onClick={() => void markAttached()}
            >
              <CheckCircle2 size={16} />
              {markingAttached ? 'Marcando...' : 'Marcar como anexada'}
            </button>
          )}
          {canEdit && (
            <Link className="primary-button" to={`/participacoes/${bid.id}/editar`}>
              <Pencil size={16} />
              Editar
            </Link>
          )}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs">
        {(
          [
            ['summary', 'Resumo'],
            ['data', 'Dados'],
            ['documents', `Documentos (${bid._count?.documents ?? documents.length})`],
            ['convocations', 'Convocações'],
            ['deadlines', 'Prazos'],
            ['history', 'Histórico']
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
              bid.tender.proposalValidityDays
                ? `${bid.tender.proposalValidityDays} dias — ${formatDate(bid.tender.proposalExpirationDate)}`
                : 'Não informada'
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
              <dt>Planilha</dt>
              <dd>{bid.tender.spreadsheetReady ? 'Pronta' : 'Ainda não pronta'}</dd>
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
            <div className="full">
              <dt>Observações</dt>
              <dd>{bid.observations || 'Nenhuma observação.'}</dd>
            </div>
          </dl>
        </section>
      )}
      {tab === 'documents' && (
        <DocumentsPanel
          bidId={bid.id}
          documents={documents}
          canEdit={canEdit}
          onChanged={() => {
            void loadDocuments();
            void loadBid();
          }}
        />
      )}
      {tab === 'convocations' && (
        <FuturePanel text="As convocações desta licitação aparecerão aqui quando a integração de e-mail for ativada." />
      )}
      {tab === 'deadlines' && (
        <FuturePanel text="Os prazos específicos desta licitação serão adicionados na Fase 3." />
      )}
      {tab === 'history' && (
        <FuturePanel text="O histórico completo será registrado pelo módulo de auditoria." />
      )}
    </div>
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

function FuturePanel({ text }: { text: string }) {
  return (
    <section className="empty-state compact">
      <p>{text}</p>
    </section>
  );
}

function DocumentsPanel({
  bidId,
  documents,
  canEdit,
  onChanged
}: {
  bidId: string;
  documents: BidDocument[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>('OUTRO');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    setSending(true);
    setError('');
    try {
      await api.post(`/bids/${bidId}/documents`, form);
      setFile(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  const download = async (document: BidDocument) => {
    try {
      const response = await api.get(`/documents/${document.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const remove = async (document: BidDocument) => {
    if (!window.confirm(`Excluir o documento “${document.originalName}”?`)) return;
    try {
      await api.delete(`/documents/${document.id}`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="detail-panel documents-panel">
      {canEdit && (
        <form className="upload-box" onSubmit={upload}>
          <div>
            <FilePlus2 size={24} />
            <strong>Anexar documento</strong>
            <small>PDF, Word, Excel, imagem, CSV ou ZIP — até 25 MB</small>
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>
            {documentCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button className="primary-button" disabled={sending || !file}>
            {sending ? 'Enviando...' : 'Fazer upload'}
          </button>
        </form>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="document-list">
        {documents.length === 0 && (
          <div className="table-message">
            <FileIcon size={27} />
            Nenhum documento anexado.
          </div>
        )}
        {documents.map((document) => (
          <article key={document.id}>
            <span className="file-icon">
              <FileIcon size={20} />
            </span>
            <div>
              <strong>{document.originalName}</strong>
              <small>
                {optionLabel(documentCategoryOptions, document.category)} · {formatBytes(document.size)} ·{' '}
                {document.uploadedBy.name} · {formatDate(document.createdAt)}
              </small>
            </div>
            <button className="action-button" onClick={() => void download(document)}>
              <Download size={16} />
              Baixar
            </button>
            {canEdit && (
              <button className="danger-icon" onClick={() => void remove(document)} title="Excluir">
                <Trash2 size={16} />
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
