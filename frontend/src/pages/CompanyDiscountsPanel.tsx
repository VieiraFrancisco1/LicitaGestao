import { Calculator, Plus, Trash2, TrendingDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, DiscountCalculation, Paginated, Tender } from '../types';
import { formatCurrency, formatDate } from '../utils/bid';

export function CompanyDiscountsPanel({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<DiscountCalculation[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [discountResponse, tenderResponse] = await Promise.all([
        api.get<ApiResponse<DiscountCalculation[]>>(`/companies/${companyId}/discounts`),
        api.get<ApiResponse<Paginated<Tender>>>('/tenders', { params: { pageSize: 100 } })
      ]);
      setItems(discountResponse.data.data);
      setTenders(tenderResponse.data.data.items);
      setValues(
        Object.fromEntries(discountResponse.data.data.map((item) => [item.id, item.discountedValue ?? '']))
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const availableTenders = useMemo(
    () =>
      tenders.filter((tender) => tender.estimatedValue && !items.some((item) => item.tenderId === tender.id)),
    [tenders, items]
  );

  const add = async () => {
    if (!selectedTenderId) return;
    setSavingId('new');
    setError('');
    try {
      await api.post(`/companies/${companyId}/discounts`, { tenderId: selectedTenderId });
      setSelectedTenderId('');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId('');
    }
  };

  const calculate = async (item: DiscountCalculation) => {
    const value = values[item.id] ?? '';
    if (!value) {
      setError('Informe o valor já com desconto');
      return;
    }
    setSavingId(item.id);
    setError('');
    try {
      const response = await api.put<ApiResponse<DiscountCalculation>>(
        `/companies/${companyId}/discounts/${item.id}`,
        { discountedValue: value }
      );
      setItems((current) => current.map((row) => (row.id === item.id ? response.data.data : row)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId('');
    }
  };

  const remove = async (item: DiscountCalculation) => {
    if (!window.confirm(`Remover ${item.tender.municipality} da aba Baixas?`)) return;
    setSavingId(item.id);
    setError('');
    try {
      await api.delete(`/companies/${companyId}/discounts/${item.id}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId('');
    }
  };

  return (
    <section className="detail-panel company-discounts-panel">
      <div className="discount-heading">
        <div>
          <span className="eyebrow">Cálculo simples</span>
          <h3>Baixas das licitações</h3>
          <p>Informe o valor final e o sistema calcula a porcentagem de desconto sobre o valor global.</p>
        </div>
        <TrendingDown size={28} />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="discount-add-row">
        <select value={selectedTenderId} onChange={(event) => setSelectedTenderId(event.target.value)}>
          <option value="">Selecione uma licitação do controle geral</option>
          {availableTenders.map((tender) => (
            <option key={tender.id} value={tender.id}>
              {tender.municipality} · {formatDate(tender.sessionDate)} ·{' '}
              {formatCurrency(tender.estimatedValue)}
            </option>
          ))}
        </select>
        <button
          className="primary-button"
          disabled={!selectedTenderId || savingId === 'new'}
          onClick={() => void add()}
        >
          <Plus size={17} />
          Adicionar licitação
        </button>
      </div>
      <div className="table-wrap">
        <table className="discount-table">
          <thead>
            <tr>
              <th>Licitação</th>
              <th>Valor global</th>
              <th>Valor com desconto</th>
              <th>Baixa</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="table-message">
                  Carregando baixas...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="table-message">
                  <Calculator size={26} />
                  Nenhuma licitação adicionada às baixas.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.tender.municipality}</strong>
                    <small>
                      {formatDate(item.tender.sessionDate)} · {item.tender.object}
                    </small>
                  </td>
                  <td>
                    <strong>{formatCurrency(item.tender.estimatedValue)}</strong>
                  </td>
                  <td>
                    <input
                      aria-label="Valor com desconto"
                      type="number"
                      min="0"
                      max={item.tender.estimatedValue ?? undefined}
                      step="0.01"
                      value={values[item.id] ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      placeholder="0,00"
                    />
                  </td>
                  <td>
                    <span className={`discount-result ${item.discountPercentage ? 'calculated' : ''}`}>
                      {item.discountPercentage
                        ? `${Number(item.discountPercentage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                        : '—'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="primary-button compact"
                        disabled={savingId === item.id}
                        onClick={() => void calculate(item)}
                      >
                        <Calculator size={15} />
                        Calcular
                      </button>
                      <button
                        className="danger-icon"
                        disabled={savingId === item.id}
                        onClick={() => void remove(item)}
                        title="Remover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="discount-formula">
        Fórmula: (valor global − valor com desconto) ÷ valor global × 100
      </div>
    </section>
  );
}
