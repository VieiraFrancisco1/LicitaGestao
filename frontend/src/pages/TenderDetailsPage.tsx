import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  MessageSquareText,
  Pencil,
  Trash2,
  UserRoundCheck,
  UserRoundX
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Tender } from '../types';
import { formatCurrency, formatDate, optionLabel, progressOptions, situationOptions } from '../utils/bid';

export function TenderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(false);
  const [error, setError] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const load = async () => {
    const response = await api.get<ApiResponse<Tender>>(`/tenders/${id}`);
    setTender(response.data.data);
    setNotes(response.data.data.spreadsheetNotes || '');
  };

  useEffect(() => {
    let active = true;
    void api
      .get<ApiResponse<Tender>>(`/tenders/${id}`)
      .then((response) => {
        if (!active) return;
        setTender(response.data.data);
        setNotes(response.data.data.spreadsheetNotes || '');
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const toggleResponsibility = async (responsible: boolean) => {
    if (!tender) return;
    setAction(true);
    setError('');
    try {
      await api.patch(`/tenders/${tender.id}/spreadsheet-responsibility`, { responsible });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAction(false);
    }
  };

  const saveNotes = async () => {
    if (!tender) return;
    setAction(true);
    setError('');
    try {
      await api.patch(`/tenders/${tender.id}/spreadsheet-notes`, { notes: notes.trim() || null });
      setNotesOpen(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAction(false);
    }
  };

  const removeTender = async () => {
    if (!tender) return;
    const label = tender.noticeNumber ? `${tender.municipality} · ${tender.noticeNumber}` : tender.municipality;
    if (!window.confirm(`Excluir definitivamente a licitação ${label}?`)) return;
    setAction(true);
    try {
      await api.delete(`/tenders/${tender.id}`);
      navigate('/licitacoes');
    } catch (err) {
      setError(errorMessage(err));
      setAction(false);
    }
  };

  if (loading)
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando licitação...
      </div>
    );
  if (!tender) return <div className="alert alert-error">{error || 'Licitação não encontrada'}</div>;

  const isResponsible = tender.spreadsheetResponsibleUserId === user?.id;
  const canManageSpreadsheet = user?.role !== 'EMPRESA';
  const canEditNotes = user?.role === 'ADMIN' || isResponsible;
  const canRelease = isResponsible || user?.role === 'ADMIN';

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
        <div className="detail-header-actions">
          <Link className="primary-button" to={`/licitacoes/${tender.id}/editar`}>
            <Pencil size={16} />
            Editar dados gerais
          </Link>
          {user?.role !== 'EMPRESA' && (
            <button className="secondary-button danger-action" disabled={action} onClick={() => void removeTender()}>
              <Trash2 size={16} />
              Excluir
            </button>
          )}
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <section className="detail-panel spreadsheet-detail-panel">
        <div className="spreadsheet-detail-summary">
          <div>
            <span className="eyebrow">Controle da planilha</span>
            <h3>{tender.spreadsheetReady ? 'Planilha pronta' : 'Planilha em preparação'}</h3>
            <p>
              Responsável: <strong>{tender.spreadsheetResponsibleUser?.name || 'não definido'}</strong>
            </p>
          </div>
          <div className="spreadsheet-detail-actions">
            {canManageSpreadsheet && !tender.spreadsheetResponsibleUserId && (
              <button className="primary-button" disabled={action} onClick={() => void toggleResponsibility(true)}>
                <UserRoundCheck size={16} />
                Assumir planilha
              </button>
            )}
            {canManageSpreadsheet && tender.spreadsheetResponsibleUserId && canRelease && (
              <button className="secondary-button" disabled={action} onClick={() => void toggleResponsibility(false)}>
                <UserRoundX size={16} />
                Liberar responsabilidade
              </button>
            )}
            {(canEditNotes || tender.spreadsheetNotes) && (
              <button className="secondary-button" onClick={() => setNotesOpen(true)}>
                <MessageSquareText size={16} />
                {tender.spreadsheetNotes ? 'Ver observações' : 'Adicionar observações'}
              </button>
            )}
          </div>
        </div>
        {tender.spreadsheetNotes && (
          <div className="spreadsheet-detail-note">
            <MessageSquareText size={17} />
            <div>
              <small>Últimas observações/alterações</small>
              <p>{tender.spreadsheetNotes}</p>
            </div>
          </div>
        )}
      </section>

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
        <Info label="Modalidade" value={tender.modality || 'Não informada'} />
        <Info label="Número da licitação" value={tender.noticeNumber || 'Não informado'} />
        <Info label="Processo administrativo" value={tender.processNumber || 'Não informado'} />
        <Info label="Prazo de execução" value={tender.executionTerm || 'Não informado'} />
        <Info label="Data" value={formatDate(tender.sessionDate)} />
        <Info label="Plataforma" value={tender.platform?.name || 'Não informada'} />
        <Info label="Valor global" value={formatCurrency(tender.estimatedValue)} />
        <Info label="Validade" value={tender.proposalValidityDays ? `${tender.proposalValidityDays} dias` : 'Não informada'} />
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
          Cada perfil vê aqui somente as participações das empresas às quais tem acesso. Dados e documentos das demais empresas não são exibidos.
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
                    {optionLabel(progressOptions, bid.progress)} · {optionLabel(situationOptions, bid.situation)}
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

      {notesOpen && (
        <Modal title="Observações da planilha" onClose={() => setNotesOpen(false)}>
          <div className="entity-form">
            <div className="section-note">
              Responsável: {tender.spreadsheetResponsibleUser?.name || 'não definido'}
            </div>
            <label>
              Informações, alterações e pendências
              <textarea
                rows={8}
                value={notes}
                disabled={!canEditNotes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Registre alterações, pendências e pontos que precisam ser conferidos."
              />
            </label>
            {!canEditNotes && <small>Somente o responsável pela planilha ou um administrador pode editar.</small>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setNotesOpen(false)}>
                Fechar
              </button>
              {canEditNotes && (
                <button className="primary-button" disabled={action} onClick={() => void saveNotes()}>
                  {action ? 'Salvando...' : 'Salvar observações'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
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
