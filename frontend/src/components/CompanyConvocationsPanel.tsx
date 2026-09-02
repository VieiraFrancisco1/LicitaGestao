import { AlertTriangle, Mail, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, EmailMessage } from '../types';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function CompanyConvocationsPanel({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ApiResponse<EmailMessage[]>>(
        `/integrations/gmail/${companyId}/messages?convocationsOnly=true&limit=100`
      );
      setItems(response.data.data);
      setError('');
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

  return (
    <section className="detail-panel company-convocations-panel">
      <div className="section-heading-inline">
        <div>
          <strong>Convocações identificadas no Gmail</strong>
          <small>Detecção por termos explícitos de convocação, sem IA. Sempre confira o conteúdo do e-mail.</small>
        </div>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Atualizar
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="app-loader compact-loader"><span className="spinner" />Carregando convocações...</div>
      ) : items.length === 0 ? (
        <div className="empty-state compact">
          <Mail size={30} />
          <p>Nenhuma possível convocação foi identificada nos e-mails novos desta empresa.</p>
          <small>Somente mensagens recebidas depois da conexão do Gmail são acompanhadas.</small>
        </div>
      ) : (
        <div className="convocation-list">
          {items.map((item) => (
            <article key={item.id} className="convocation-card">
              <span className="convocation-icon"><AlertTriangle size={20} /></span>
              <div className="convocation-content">
                <div className="convocation-title-row">
                  <strong>{item.subject || 'E-mail sem assunto'}</strong>
                  <time>{formatDateTime(item.receivedAt)}</time>
                </div>
                <small>De: {item.sender}</small>
                {item.snippet && <p>{item.snippet}</p>}
                {item.convocationReason && <em>{item.convocationReason}</em>}
                {item.textContent && (
                  <details>
                    <summary>Ver conteúdo textual</summary>
                    <pre>{item.textContent}</pre>
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
