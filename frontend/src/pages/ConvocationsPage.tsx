import { CheckCheck, MailWarning, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, GmailConvocationAlert, GmailConvocationAlertData } from '../types';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function ConvocationsPage() {
  const [data, setData] = useState<GmailConvocationAlertData>({ items: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ApiResponse<GmailConvocationAlertData>>('/integrations/gmail/alerts');
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const open = async (item: GmailConvocationAlert) => {
    void api.post('/integrations/gmail/alerts/read', { messageId: item.messageId }).catch(() => undefined);
    navigate(
      item.bidId
        ? `/participacoes/${item.bidId}?tab=convocations&message=${item.messageId}`
        : `/empresas/${item.companyId}?tab=convocations&message=${item.messageId}`
    );
  };

  const markAll = async () => {
    await api.post('/integrations/gmail/alerts/read-all');
    setData((current) => ({
      ...current,
      unread: 0,
      items: current.items.map((item) => ({ ...item, read: true }))
    }));
  };

  const dismiss = async (item: GmailConvocationAlert) => {
    const confirmed = window.confirm(
      'Apagar esta notificação da sua lista? O e-mail original continuará preservado na conta conectada.'
    );
    if (!confirmed) return;
    setRemovingId(item.messageId);
    setError('');
    try {
      await api.delete(`/integrations/gmail/alerts/${item.messageId}`);
      setData((current) => ({
        ...current,
        unread: Math.max(0, current.unread - (item.read ? 0 : 1)),
        items: current.items.filter((currentItem) => currentItem.messageId !== item.messageId)
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRemovingId('');
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">E-mail</span>
          <h2>Avisos por e-mail</h2>
          <p>Convocações e avisos importantes identificados automaticamente nos e-mails das plataformas.</p>
        </div>
        <div className="page-heading-actions">
          {!!data.unread && (
            <button className="secondary-button" onClick={() => void markAll()}>
              <CheckCheck size={16} /> Marcar todas como lidas
            </button>
          )}
          <button className="secondary-button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Atualizar
          </button>
        </div>
      </div>

      <div className="convocation-summary-card">
        <MailWarning size={22} />
        <div>
          <small>Alertas não lidos</small>
          <strong>{data.unread}</strong>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="app-loader">
          <span className="spinner" />
          Carregando avisos...
        </div>
      ) : data.items.length === 0 ? (
        <section className="empty-state">
          <MailWarning size={36} />
          <h2>Nenhum aviso importante encontrado</h2>
          <p>
            Quando o Gmail ou Outlook receber uma convocação ou aviso das plataformas monitoradas, o alerta
            aparecerá aqui.
          </p>
        </section>
      ) : (
        <section className="convocation-list global-convocation-list">
          {data.items.map((item) => (
            <article
              key={item.messageId}
              className={`convocation-card convocation-card-with-actions ${item.read ? 'read' : 'unread'}`}
            >
              <button className="convocation-card-open" onClick={() => void open(item)}>
                <span className="convocation-icon">
                  <MailWarning size={20} />
                </span>
                <div className="convocation-content">
                  <div className="convocation-title-row">
                    <strong>{item.subject || 'Aviso importante'}</strong>
                    <time>{formatDateTime(item.receivedAt)}</time>
                  </div>
                  <small>
                    {item.provider === 'OUTLOOK' ? 'Outlook' : 'Gmail'} · {item.companyName} · De:{' '}
                    {item.sender}
                  </small>
                  {item.tender ? (
                    <div className="convocation-inline-match matched">
                      Vinculada:{' '}
                      {[item.tender.modality, item.tender.noticeNumber].filter(Boolean).join(' ') ||
                        'Licitação'}{' '}
                      · {item.tender.municipality}
                    </div>
                  ) : (
                    <div className="convocation-inline-match pending">
                      Não vinculada — confira e vincule na área da empresa
                    </div>
                  )}
                  {item.snippet && <p>{item.snippet}</p>}
                </div>
              </button>
              <button
                className="convocation-delete-button"
                disabled={removingId === item.messageId}
                title="Apagar notificação"
                onClick={() => void dismiss(item)}
              >
                <Trash2 size={16} />
                {removingId === item.messageId ? 'Apagando...' : 'Apagar'}
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
