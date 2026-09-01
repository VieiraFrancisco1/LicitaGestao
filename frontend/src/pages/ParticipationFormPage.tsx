import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Bid, BidProgress, BidSituation } from '../types';
import { progressOptions, situationOptions } from '../utils/bid';

export function ParticipationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bid, setBid] = useState<Bid | null>(null);
  const [proposalValue, setProposalValue] = useState('');
  const [progress, setProgress] = useState<BidProgress>('NAO_INICIADA');
  const [situation, setSituation] = useState<BidSituation>('PENDENTE');
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .get<ApiResponse<Bid>>(`/bids/${id}`)
      .then((response) => {
        const item = response.data.data;
        setBid(item);
        setProposalValue(item.proposalValue ?? '');
        setProgress(item.progress);
        setSituation(item.situation);
        setObservations(item.observations ?? '');
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/bids/${id}`, {
        proposalValue: proposalValue || null,
        progress,
        situation,
        observations: observations || null
      });
      navigate(`/participacoes/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando participação...
      </div>
    );
  if (!bid) return <div className="alert alert-error">{error || 'Participação não encontrada'}</div>;
  return (
    <form className="page-stack" onSubmit={(event) => void submit(event)}>
      <div className="page-heading">
        <div>
          <p>Dados privados da empresa</p>
          <h2>Editar participação</h2>
          <span>
            {bid.company.tradeName || bid.company.legalName} · {bid.tender.municipality}
          </span>
        </div>
        <Link className="secondary-button" to={`/participacoes/${id}`}>
          <ArrowLeft size={17} />
          Voltar
        </Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="form-section">
        <div className="form-section-title">
          <span>Controle da empresa</span>
        </div>
        <div className="bid-form-grid">
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
          <label className="full">
            Observações privadas
            <textarea
              rows={5}
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
            />
          </label>
        </div>
      </section>
      <div className="sticky-actions">
        <Link className="secondary-button" to={`/participacoes/${id}`}>
          Cancelar
        </Link>
        <button className="primary-button" disabled={saving}>
          <Save size={17} />
          {saving ? 'Salvando...' : 'Salvar participação'}
        </button>
      </div>
    </form>
  );
}
