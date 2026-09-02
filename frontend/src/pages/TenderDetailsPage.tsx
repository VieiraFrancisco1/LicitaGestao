import { ArrowLeft, Building2, ExternalLink, FileSpreadsheet, FileText, FolderOpen, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Tender } from '../types';
import { formatCurrency, formatDate, optionLabel, progressOptions, situationOptions } from '../utils/bid';

export function TenderDetailsPage() {
  const { id } = useParams();
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    void api
      .get<ApiResponse<Tender>>(`/tenders/${id}`)
      .then((response) => setTender(response.data.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);
  if (loading)
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando licitação...
      </div>
    );
  if (!tender) return <div className="alert alert-error">{error || 'Licitação não encontrada'}</div>;
  return (
    <div className="page-stack">
      <div className="details-header">
        <div>
          <Link to="/licitacoes" className="back-link">
            <ArrowLeft size={16} />
            Controle geral
          </Link>
          <span className="eyebrow">Dados gerais do edital</span>
          <h2>
            {tender.municipality} — {formatDate(tender.sessionDate)}
          </h2>
          <p>{tender.object}</p>
        </div>
        <Link className="primary-button" to={`/licitacoes/${tender.id}/editar`}>
          <Pencil size={16} />
          Editar dados gerais
        </Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {(tender.seobraLink || tender.platformLink) && (
        <section className="detail-panel tender-links-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Acessos rápidos</span>
              <h3>Links da licitação</h3>
            </div>
          </div>
          <div className="tender-link-actions">
            {tender.seobraLink && (
              <a className="primary-button" href={tender.seobraLink} target="_blank" rel="noreferrer">
                <FileSpreadsheet size={17} />
                Abrir no SEOBRA
                <ExternalLink size={14} />
              </a>
            )}
            {tender.platformLink && (
              <a className="secondary-button" href={tender.platformLink} target="_blank" rel="noreferrer">
                <ExternalLink size={17} />
                Abrir na plataforma
              </a>
            )}
          </div>
        </section>
      )}
      <div className="details-grid">
        <Info label="Data" value={formatDate(tender.sessionDate)} />
        <Info label="Plataforma" value={tender.platform?.name || 'Não informada'} />
        <Info label="Valor global" value={formatCurrency(tender.estimatedValue)} />
        <Info
          label="Validade"
          value={
            tender.proposalValidityDays
              ? `${tender.proposalValidityDays} dias — ${formatDate(tender.proposalExpirationDate)}`
              : 'Não informada'
          }
        />
        <Info label="Garantia de 1%" value={Number(tender.guaranteePercentage) === 1 ? 'Sim' : 'Não'} />
        <Info label="Planilha" value={tender.spreadsheetReady ? 'Pronta' : 'Ainda não pronta'} />
        <Info label="Lista" value={tender.listStatus === 'ANEXADA' ? 'Já anexada' : 'Pendente'} />
        <Info label="Empresas associadas" value={String(tender._count?.bids ?? 0)} />
      </div>
      <section className="detail-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Acesso permitido</span>
            <h3>Minhas participações visíveis</h3>
          </div>
        </div>
        <p className="section-note">
          Cada perfil vê aqui somente as participações das empresas às quais tem acesso. Dados e documentos
          das demais empresas não são exibidos.
        </p>
        <div className="participation-cards">
          {tender.bids.length === 0 && (
            <div className="empty-state compact">
              <Building2 size={28} />
              <p>Esta licitação ainda não foi associada a uma das suas empresas.</p>
              <Link className="primary-button" to="/licitacoes">
                Associar no controle geral
              </Link>
            </div>
          )}
          {tender.bids.map((bid) => (
            <article key={bid.id}>
              <div>
                <Building2 size={20} />
                <span>
                  <strong>{bid.company.tradeName || bid.company.legalName}</strong>
                  <small>
                    {optionLabel(progressOptions, bid.progress)} ·{' '}
                    {optionLabel(situationOptions, bid.situation)}
                  </small>
                </span>
              </div>
              <span>{formatCurrency(bid.proposalValue)}</span>
              <Link className="action-button" to={`/participacoes/${bid.id}`}>
                <FolderOpen size={15} />
                Abrir participação
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="detail-panel tender-object-panel">
        <FileText size={22} />
        <div>
          <strong>Objeto completo</strong>
          <p>{tender.object}</p>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <article className="detail-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}
