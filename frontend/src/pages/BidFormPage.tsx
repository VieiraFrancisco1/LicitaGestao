import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Platform, Tender } from '../types';

type TenderForm = {
  municipality: string;
  sessionDate: string;
  object: string;
  proposalValidityDays: string;
  estimatedValue: string;
  requiresGuaranteeOnePercent: boolean;
  platformId: string;
};

const emptyForm: TenderForm = {
  municipality: '',
  sessionDate: '',
  object: '',
  proposalValidityDays: '',
  estimatedValue: '',
  requiresGuaranteeOnePercent: false,
  platformId: ''
};

export function BidFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<TenderForm>(emptyForm);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .get<ApiResponse<Platform[]>>('/platforms', { params: { active: 'true' } })
      .then((response) => setPlatforms(response.data.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!id) return;
    void api
      .get<ApiResponse<Tender>>(`/tenders/${id}`)
      .then((response) => {
        const tender = response.data.data;
        setForm({
          municipality: tender.municipality,
          sessionDate: tender.sessionDate.slice(0, 10),
          object: tender.object,
          proposalValidityDays: tender.proposalValidityDays?.toString() ?? '',
          estimatedValue: tender.estimatedValue ?? '',
          requiresGuaranteeOnePercent:
            tender.guaranteeType !== 'NAO_EXIGIDA' && Number(tender.guaranteePercentage) === 1,
          platformId: tender.platformId ?? ''
        });
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const field = (key: keyof TenderForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const response = id
        ? await api.put<ApiResponse<Tender>>(`/tenders/${id}`, form)
        : await api.post<ApiResponse<Tender>>('/tenders', form);
      navigate(`/licitacoes/${response.data.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  if (loading)
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando licitação...
      </div>
    );

  return (
    <form className="page-stack" onSubmit={submit}>
      <div className="page-heading">
        <div>
          <p>Controle geral</p>
          <h2>{id ? 'Editar licitação' : 'Nova licitação'}</h2>
          <span>Cadastro rápido somente com os dados usados no controle diário.</span>
        </div>
        <Link className="secondary-button" to={id ? `/licitacoes/${id}` : '/licitacoes'}>
          <ArrowLeft size={17} />
          Voltar
        </Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <section className="form-section simplified-tender-form">
        <div className="form-section-title">
          <span>Dados da licitação</span>
        </div>
        <div className="bid-form-grid">
          <label>
            Data da licitação
            <input
              type="date"
              value={form.sessionDate}
              onChange={(event) => field('sessionDate', event.target.value)}
              required
            />
          </label>
          <label>
            Cidade
            <input
              value={form.municipality}
              onChange={(event) => field('municipality', event.target.value)}
              required
            />
          </label>
          <label>
            Validade da carta-proposta (dias)
            <input
              type="number"
              min="1"
              value={form.proposalValidityDays}
              onChange={(event) => field('proposalValidityDays', event.target.value)}
              required
            />
          </label>
          <label>
            Garantia de proposta de 1%?
            <select
              value={form.requiresGuaranteeOnePercent ? 'sim' : 'nao'}
              onChange={(event) => field('requiresGuaranteeOnePercent', event.target.value === 'sim')}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </label>
          <label>
            Valor global (R$)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.estimatedValue}
              onChange={(event) => field('estimatedValue', event.target.value)}
              required
            />
          </label>
          <label>
            Plataforma
            <select
              value={form.platformId}
              onChange={(event) => field('platformId', event.target.value)}
              required
            >
              <option value="">{platforms.length ? 'Selecione' : 'Nenhuma plataforma cadastrada'}</option>
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
            {platforms.length === 0 && (
              <small className="field-help">
                Execute as migrations da atualização ou cadastre uma plataforma no menu Plataformas.
              </small>
            )}
          </label>
          <label className="full">
            Objeto
            <textarea
              rows={4}
              value={form.object}
              onChange={(event) => field('object', event.target.value)}
              required
            />
          </label>
        </div>
      </section>

      <div className="sticky-actions">
        <Link className="secondary-button" to="/licitacoes">
          Cancelar
        </Link>
        <button className="primary-button" disabled={saving}>
          <Save size={17} />
          {saving ? 'Salvando...' : 'Salvar licitação'}
        </button>
      </div>
    </form>
  );
}
