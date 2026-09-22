import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Platform, Tender } from '../types';

type TenderForm = { // LICITAGESTAO_PREQUAL_ALL_EMAILS_V1_FORM
  modality: string;
  noticeNumber: string;
  processNumber: string;
  executionTerm: string;
  isPreQualification: boolean;
  municipality: string;
  sessionDate: string;
  object: string;
  proposalValidityDays: string;
  estimatedValue: string;
  requiresGuaranteeOnePercent: boolean;
  platformId: string;
  platformLink: string;
  seobraLinks: string[];
};

const emptyForm: TenderForm = {
  modality: '',
  noticeNumber: '',
  processNumber: '',
  executionTerm: '',
  isPreQualification: false,
  municipality: '',
  sessionDate: '',
  object: '',
  proposalValidityDays: '',
  estimatedValue: '',
  requiresGuaranteeOnePercent: false,
  platformId: '',
  platformLink: '',
  seobraLinks: ['']
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
          modality: tender.modality ?? '',
          noticeNumber: tender.noticeNumber ?? '',
          processNumber: tender.processNumber ?? '',
          executionTerm: tender.executionTerm ?? '',
          isPreQualification: tender.isPreQualification,
          municipality: tender.municipality,
          sessionDate: tender.sessionDate.slice(0, 10),
          object: tender.object,
          proposalValidityDays: tender.proposalValidityDays?.toString() ?? '',
          estimatedValue: tender.estimatedValue ?? '',
          requiresGuaranteeOnePercent:
            tender.guaranteeType !== 'NAO_EXIGIDA' && Number(tender.guaranteePercentage) === 1,
          platformId: tender.platformId ?? '',
          platformLink: tender.platformLink ?? '',
          seobraLinks: tender.seobraLinks?.length ? tender.seobraLinks : tender.seobraLink ? [tender.seobraLink] : ['']
        });
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const field = (key: keyof TenderForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const seobraLinkField = (index: number, value: string) =>
    setForm((current) => ({
      ...current,
      seobraLinks: current.seobraLinks.map((link, itemIndex) => (itemIndex === index ? value : link))
    }));

  const addSeobraLink = () =>
    setForm((current) => ({ ...current, seobraLinks: [...current.seobraLinks, ''] }));

  const removeSeobraLink = (index: number) =>
    setForm((current) => ({
      ...current,
      seobraLinks:
        current.seobraLinks.length === 1
          ? ['']
          : current.seobraLinks.filter((_, itemIndex) => itemIndex !== index)
    }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        seobraLinks: form.seobraLinks.map((link) => link.trim()).filter(Boolean)
      };
      const response = id
        ? await api.put<ApiResponse<Tender>>(`/tenders/${id}`, payload)
        : await api.post<ApiResponse<Tender>>('/tenders', payload);
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
            Modalidade
            <select value={form.modality} onChange={(event) => field('modality', event.target.value)}>
              <option value="">Selecione (opcional)</option>
              <option value="Concorrência Eletrônica">Concorrência Eletrônica</option>
              <option value="Pregão Eletrônico">Pregão Eletrônico</option>
              <option value="Dispensa Eletrônica">Dispensa Eletrônica</option>
              <option value="Credenciamento">Credenciamento</option>
              <option value="Leilão Eletrônico">Leilão Eletrônico</option>
              <option value="Outro">Outro</option>
            </select>
            <small className="field-help">Ajuda a relacionar convocações e avisos recebidos por e-mail.</small>
          </label>
          <label>
            É pré-qualificação?
            <select
              value={form.isPreQualification ? 'sim' : 'nao'}
              onChange={(event) => field('isPreQualification', event.target.value === 'sim')}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
            <small className="field-help">
              Se for, o controle geral mostrará “Pré-qualificação” abaixo da modalidade.
            </small>
          </label>
          <label>
            Número do edital
            <input
              placeholder="Ex.: 005/2026"
              value={form.noticeNumber}
              onChange={(event) => field('noticeNumber', event.target.value)}
            />
            <small className="field-help">Número do pregão, concorrência ou procedimento eletrônico.</small>
          </label>
          <label>
            Processo administrativo
            <input
              placeholder="Ex.: 0000620260323000322"
              value={form.processNumber}
              onChange={(event) => field('processNumber', event.target.value)}
            />
            <small className="field-help">Informe exatamente como aparece nos avisos da plataforma.</small>
          </label>
          <label>
            Prazo de execução
            <input
              placeholder="Ex.: 8 meses ou 240 dias"
              value={form.executionTerm}
              onChange={(event) => field('executionTerm', event.target.value)}
            />
            <small className="field-help">Usado automaticamente na Carta Proposta.</small>
          </label>
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
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 3.437.508,84 ou 3437508.84"
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
          <label>
            Link da licitação na plataforma
            <input
              type="url"
              placeholder="https://..."
              value={form.platformLink}
              onChange={(event) => field('platformLink', event.target.value)}
            />
            <small className="field-help">Cole manualmente o link direto da licitação na plataforma.</small>
          </label>
          <div className="seobra-links-editor full">
            <div className="seobra-links-heading">
              <div>
                <strong>Links do SEOBRA</strong>
                <small className="field-help">Adicione um link para cada lote desta licitação.</small>
              </div>
              <button type="button" className="secondary-button compact" onClick={addSeobraLink}>
                <Plus size={15} /> Adicionar link
              </button>
            </div>
            <div className="seobra-links-list">
              {form.seobraLinks.map((link, index) => (
                <label key={index} className="seobra-link-row">
                  <span>Lote {index + 1}</span>
                  <div>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={link}
                      onChange={(event) => seobraLinkField(index, event.target.value)}
                    />
                    {form.seobraLinks.length > 1 && (
                      <button
                        type="button"
                        className="danger-icon"
                        title={`Remover Lote ${index + 1}`}
                        onClick={() => removeSeobraLink(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
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

        <div className="sticky-actions tender-form-actions">
          <Link className="secondary-button" to="/licitacoes">
            Cancelar
          </Link>
          <button className="primary-button" disabled={saving}>
            <Save size={17} />
            {saving ? 'Salvando...' : 'Salvar licitação'}
          </button>
        </div>
      </section>
    </form>
  );
}
