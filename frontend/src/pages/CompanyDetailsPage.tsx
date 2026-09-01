import { ArrowLeft, Building2, Download, File, FolderOpen, Gavel, Percent, RadioTower } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BidsPage } from './BidsPage';
import { CompanyDiscountsPanel } from './CompanyDiscountsPanel';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, BidDocument, BidProgress, Company } from '../types';
import { formatBytes, formatDate, optionLabel, progressOptions } from '../utils/bid';

type Tab = 'overview' | 'bids' | 'documents' | 'platforms' | 'discounts' | 'convocations';
type PlatformGroup = {
  id: string;
  name: string;
  site: string | null;
  bids: Array<{
    id: string;
    progress: BidProgress;
    tender: {
      noticeNumber: string | null;
      municipality: string;
      sessionDate: string;
    };
  }>;
};

export function CompanyDetailsPage() {
  const { id } = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [documents, setDocuments] = useState<BidDocument[]>([]);
  const [platforms, setPlatforms] = useState<PlatformGroup[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<Company>>(`/companies/${id}`);
      setCompany(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === 'documents')
        void api
          .get<ApiResponse<BidDocument[]>>(`/companies/${id}/documents`)
          .then((response) => setDocuments(response.data.data))
          .catch((err) => setError(errorMessage(err)));
      if (tab === 'platforms')
        void api
          .get<ApiResponse<PlatformGroup[]>>(`/companies/${id}/platforms`)
          .then((response) => setPlatforms(response.data.data))
          .catch((err) => setError(errorMessage(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, id]);

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
  if (loading)
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando empresa...
      </div>
    );
  if (!company) return <div className="alert alert-error">{error || 'Empresa não encontrada'}</div>;
  return (
    <div className="page-stack">
      <div className="details-header company-header">
        <div>
          <Link className="back-link" to="/empresas">
            <ArrowLeft size={16} />
            Empresas
          </Link>
          <span className="eyebrow">Área da empresa</span>
          <h2>{company.tradeName || company.legalName}</h2>
          <p>
            {company.legalName} · {formatCnpj(company.cnpj)}
          </p>
        </div>
        <span className={`status-pill ${company.active ? 'active' : 'inactive'}`}>
          {company.active ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs company-tabs">
        {(
          [
            ['overview', 'Visão geral'],
            ['bids', 'Licitações'],
            ['documents', 'Documentos'],
            ['platforms', 'Plataformas'],
            ['discounts', 'Baixas'],
            ['convocations', 'Convocações']
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="details-grid">
          <CompanyStat icon={<Gavel />} label="Licitações" value={company._count?.bids ?? 0} />
          <CompanyStat icon={<File />} label="Documentos" value="Por licitação" />
          <CompanyStat icon={<Percent />} label="Baixas" value="Cálculo por licitação" />
          <CompanyStat icon={<Building2 />} label="Usuários da empresa" value={company._count?.users ?? 0} />
          <CompanyStat
            icon={<Building2 />}
            label="Funcionários responsáveis"
            value={company._count?.staffLinks ?? 0}
          />
          <section className="detail-panel full-width">
            <dl className="data-list">
              <div>
                <dt>E-mail</dt>
                <dd>{company.email || '—'}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{company.phone || '—'}</dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{company.contactName || '—'}</dd>
              </div>
              <div className="full">
                <dt>Observações</dt>
                <dd>{company.observations || 'Nenhuma observação.'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
      {tab === 'bids' && <BidsPage fixedCompanyId={company.id} />}
      {tab === 'documents' && (
        <section className="detail-panel">
          <div className="section-note">
            Os documentos ficam vinculados à licitação correta. Para enviar um novo arquivo, abra a licitação.
          </div>
          <div className="document-list">
            {documents.length === 0 && (
              <div className="table-message">
                <File size={28} />
                Nenhum documento nesta empresa.
              </div>
            )}
            {documents.map((document) => (
              <article key={document.id}>
                <span className="file-icon">
                  <File size={20} />
                </span>
                <div>
                  <strong>{document.originalName}</strong>
                  <small>
                    {document.bid?.tender.municipality} · {formatBytes(document.size)} ·{' '}
                    {formatDate(document.createdAt)}
                  </small>
                </div>
                <Link className="action-button" to={`/participacoes/${document.bidId}`}>
                  <FolderOpen size={15} />
                  Licitação
                </Link>
                <button className="action-button" onClick={() => void download(document)}>
                  <Download size={15} />
                  Baixar
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === 'platforms' && (
        <section className="platform-grid company-platforms">
          {platforms.length === 0 && (
            <div className="empty-state compact">
              <RadioTower size={28} />
              <p>Nenhuma licitação ativa vinculada a uma plataforma.</p>
            </div>
          )}
          {platforms.map((platform) => (
            <article key={platform.id}>
              <div className="platform-icon">
                <RadioTower />
              </div>
              <div>
                <strong>{platform.name}</strong>
                <small>{platform.bids.length} participações em andamento</small>
                {platform.bids.map((bid) => (
                  <Link key={bid.id} to={`/participacoes/${bid.id}`}>
                    {bid.tender.municipality} · {formatDate(bid.tender.sessionDate)} ·{' '}
                    {optionLabel(progressOptions, bid.progress)}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
      {tab === 'discounts' && <CompanyDiscountsPanel companyId={company.id} />}
      {tab === 'convocations' && (
        <section className="empty-state compact">
          <p>As convocações desta empresa aparecerão aqui após a integração do Gmail.</p>
        </section>
      )}
    </div>
  );
}

function CompanyStat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <article className="detail-stat company-stat">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function formatCnpj(value: string) {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
