import { Calculator, Info, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Tender, TenderCompanyDiscount } from '../types';
import { formatCurrency } from '../utils/bid';
import './tender-discount.css';

type Field = 'discountedValue' | 'budgetValue' | 'servicesValue' | 'materialsValue' | 'equipmentValue';
const informativeFields = [
  { key: 'servicesValue', label: 'Serviços' },
  { key: 'materialsValue', label: 'Materiais' },
  { key: 'equipmentValue', label: 'Equipamentos' }
] as const;

function parseMoney(raw: string): number | null {
  const value = raw.trim().replace(/[^\d.,]/g, '');
  if (!value) return null;
  const normalized = value.includes(',') && value.includes('.')
    ? (value.lastIndexOf(',') > value.lastIndexOf('.') ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, ''))
    : value.replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0 && numeric < 1e12 ? numeric : NaN;
}
const formatInput = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const displayPercent = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyFields = (globalValue: number): Record<Field, string> =>
  ({ discountedValue: '', budgetValue: globalValue > 0 ? formatInput(globalValue) : '',
    servicesValue: '', materialsValue: '', equipmentValue: '' });

export function TenderDiscountModal({ tender, companyId, onClose, onSaved }: {
  tender: Tender; companyId: string; onClose: () => void; onSaved: (data: TenderCompanyDiscount) => void;
}) {
  const originalValue = Number(tender.estimatedValue ?? 0);
  const [values, setValues] = useState<Record<Field, string>>(() => emptyFields(originalValue));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void api.get<ApiResponse<TenderCompanyDiscount>>(`/companies/${companyId}/discounts/tender/${tender.id}`)
      .then(({ data }) => {
        if (!active) return;
        const item = data.data;
        const next = emptyFields(originalValue);
        (Object.keys(next) as Field[]).forEach((key) => {
          if (item[key] !== null && item[key] !== undefined) {
            const numeric = Number(item[key]);
            next[key] = Number.isFinite(numeric) ? formatInput(numeric) : '';
          }
        });
        setValues(next);
      })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, tender.id, originalValue]);

  const globalValue = useMemo(() => parseMoney(values.budgetValue), [values.budgetValue]);
  const percentage = useMemo(() => {
    const discounted = parseMoney(values.discountedValue);
    return discounted !== null && Number.isFinite(discounted)
      && globalValue !== null && Number.isFinite(globalValue) && globalValue > 0 && discounted <= globalValue
      ? (globalValue - discounted) / globalValue * 100 : null;
  }, [globalValue, values.discountedValue]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || saving) return;
    const parsed = Object.fromEntries((Object.keys(values) as Field[]).map((key) => [key, parseMoney(values[key])])) as Record<Field, number | null>;
    if (parsed.budgetValue === null || !Number.isFinite(parsed.budgetValue) || parsed.budgetValue <= 0) {
      setError('Informe um valor global maior que zero.'); return;
    }
    if (Object.values(parsed).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
      setError('Confira os valores informados.'); return;
    }
    if (parsed.discountedValue !== null && parsed.discountedValue > parsed.budgetValue) {
      setError('O valor final da proposta não pode superar o valor global utilizado no cálculo.'); return;
    }
    if (informativeFields.some(({ key }) => parsed[key] !== null && parsed[key]! > 100)) {
      setError('Os descontos informativos devem ser percentuais entre 0 e 100.'); return;
    }
    setError(''); setSaving(true);
    try {
      const response = await api.put<ApiResponse<TenderCompanyDiscount>>(
        `/companies/${companyId}/discounts/tender/${tender.id}`, parsed);
      onSaved(response.data.data);
      onClose();
    } catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };
  const update = (key: Field, value: string) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <Modal title={tender.municipality} eyebrow="Desconto da empresa" onClose={onClose}>
      <form className="tender-discount-modal" onSubmit={(event) => void save(event)}>
        <div className="discount-reference-strip">
          <span>Edital <strong>{tender.noticeNumber || 'Não informado'}</strong></span>
          <span>Global cadastrado <strong>{formatCurrency(tender.estimatedValue)}</strong></span>
        </div>
        {error && <div role="alert" className="alert alert-error">{error}</div>}
        <section className="discount-form-section">
          <div className="discount-section-heading"><span className="discount-step">1</span><div><strong>Valor global para o cálculo</strong><small>Preenchido com o valor da licitação. Você pode alterar apenas para esta empresa.</small></div></div>
          <label className="discount-amount-field"><span>Valor global (R$)</span>
            <input inputMode="decimal" placeholder="0,00" disabled={loading || saving} value={values.budgetValue}
              onChange={(event) => update('budgetValue', event.target.value)} />
          </label>
        </section>
        <section className="discount-form-section">
          <div className="discount-section-heading"><span className="discount-step">2</span><div><strong>Proposta com desconto</strong><small>Este é o único valor de proposta que entra no cálculo oficial.</small></div></div>
          <label className="discount-amount-field"><span>Valor final da proposta (R$)</span>
            <input inputMode="decimal" placeholder="Informe o valor proposto" disabled={loading || saving} value={values.discountedValue}
              onChange={(event) => update('discountedValue', event.target.value)} />
          </label>
          <div className="discount-calculated-box">
            <div><small>Percentual de desconto</small><strong>{percentage === null ? '—' : `${displayPercent(percentage)}%`}</strong></div>
            <span><Calculator size={16}/> Calculado automaticamente</span>
          </div>
        </section>
        <section className="discount-form-section discount-notes-section">
          <div className="discount-section-heading"><span className="discount-step">3</span><div><strong>Descontos por item</strong><small>Registro informativo. Não altera o cálculo acima.</small></div></div>
          <div className="tender-discount-grid">
            {informativeFields.map(({ key, label }) => (
              <label key={key}>{label} (%)
                <input inputMode="decimal" placeholder="0,00" disabled={loading || saving} value={values[key]}
                  onChange={(event) => update(key, event.target.value)} />
              </label>
            ))}
          </div>
        </section>
        <small className="tender-discount-formula"><Info size={14}/> Desconto = (valor global da empresa − proposta final) ÷ valor global da empresa × 100</small>
        <div className="tender-discount-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={loading || saving}>
            <Save size={16}/> {saving ? 'Salvando...' : loading ? 'Carregando...' : 'Salvar desconto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
