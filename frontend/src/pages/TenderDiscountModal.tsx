import { Calculator, Save, TrendingDown } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Tender, TenderCompanyDiscount } from '../types';
import { formatCurrency } from '../utils/bid';
import './tender-discount.css';

type Field = 'discountedValue' | 'budgetValue' | 'servicesValue' | 'materialsValue' | 'equipmentValue';
const fields: Array<{ key: Field; label: string }> = [
  { key: 'budgetValue', label: 'Valor do orçamento (referência)' },
  { key: 'discountedValue', label: 'Valor final da proposta com desconto' },
  { key: 'servicesValue', label: 'Desconto em Serviços (informativo)' },
  { key: 'materialsValue', label: 'Desconto em Materiais (informativo)' },
  { key: 'equipmentValue', label: 'Desconto em Equipamentos (informativo)' }
];

function parseMoney(raw: string): number | null {
  const value = raw.trim().replace(/[^\d.,]/g, '');
  if (!value) return null;
  const normalized = value.includes(',') && value.includes('.')
    ? (value.lastIndexOf(',') > value.lastIndexOf('.') ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, ''))
    : value.replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0 && numeric < 1e12 ? numeric : NaN;
}
const emptyFields = (): Record<Field, string> =>
  ({ discountedValue: '', budgetValue: '', servicesValue: '', materialsValue: '', equipmentValue: '' });
function displayPercent(value: number) { return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function TenderDiscountModal({ tender, companyId, onClose, onSaved }: {
  tender: Tender; companyId: string; onClose: () => void; onSaved: (data: TenderCompanyDiscount) => void;
}) {
  const [values, setValues] = useState<Record<Field, string>>(emptyFields);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const globalValue = Number(tender.estimatedValue ?? 0);
  useEffect(() => {
    let active = true;
    void api.get<ApiResponse<TenderCompanyDiscount>>(`/companies/${companyId}/discounts/tender/${tender.id}`)
      .then(({ data }) => {
        if (!active) return;
        setValues(Object.fromEntries(fields.map(({ key }) => [key, data.data[key] == null ? '' : String(data.data[key])])) as Record<Field, string>);
      })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, tender.id]);
  const percent = useMemo(() => {
    const discounted = parseMoney(values.discountedValue);
    return discounted !== null && Number.isFinite(discounted) && globalValue > 0 && discounted <= globalValue
      ? ((globalValue - discounted) / globalValue) * 100 : null;
  }, [globalValue, values.discountedValue]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || saving) return;
    const parsed = Object.fromEntries(fields.map(({ key }) => [key, parseMoney(values[key])])) as Record<Field, number | null>;
    if (Object.values(parsed).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
      setError('Verifique os valores informados.'); return;
    }
    if (parsed.discountedValue !== null && parsed.discountedValue > globalValue) {
      setError('A proposta com desconto não pode superar o valor global.'); return;
    }
    if (!(globalValue > 0)) { setError('A licitação precisa ter valor global maior que zero.'); return; }
    setError(''); setSaving(true);
    try {
      const response = await api.put<ApiResponse<TenderCompanyDiscount>>(
        `/companies/${companyId}/discounts/tender/${tender.id}`, parsed);
      onSaved(response.data.data);
      onClose();
    } catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={tender.municipality} eyebrow="Desconto da empresa · orçamento" onClose={onClose}>
      <form className="tender-discount-modal" onSubmit={(event) => void save(event)}>
        <div className="tender-discount-summary">
          <div><small>Licitação</small><strong>{tender.noticeNumber || 'Sem número'}</strong></div>
          <div><small>Valor global</small><strong>{formatCurrency(tender.estimatedValue)}</strong></div>
          <div><small>Desconto principal</small><strong className="discount-rate">{percent === null ? 'Não calculado' : `${displayPercent(percent)}%`}</strong></div>
        </div>
        {error && <div role="alert" className="alert alert-error">{error}</div>}
        <div className="tender-discount-primary">
          <label>Valor do orçamento para referência
            <input inputMode="decimal" placeholder="0,00" disabled={loading || saving} value={values.budgetValue}
              onChange={(event) => setValues((current) => ({ ...current, budgetValue: event.target.value }))} />
          </label>
          <label>Valor da proposta com desconto (vale no cálculo)
            <input inputMode="decimal" placeholder="0,00" disabled={loading || saving} value={values.discountedValue}
              onChange={(event) => setValues((current) => ({ ...current, discountedValue: event.target.value }))} />
          </label>
        </div>
        <div className="tender-discount-info">
          <div><TrendingDown size={17} /><strong>Descontos informativos por item</strong></div>
          <p>Registre os descontos que já foram dados. Estes campos não alteram o percentual principal.</p>
          <div className="tender-discount-grid">
            {fields.slice(2).map(({ key, label }) => (
              <label key={key}>{label}
                <input inputMode="decimal" placeholder="0,00" disabled={loading || saving} value={values[key]}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
        </div>
        <small className="tender-discount-formula"><Calculator size={14} /> Percentual = (valor global − proposta final) ÷ valor global × 100</small>
        <div className="tender-discount-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={loading || saving}>
            <Save size={16} /> {saving ? 'Salvando...' : loading ? 'Carregando...' : 'Salvar desconto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
