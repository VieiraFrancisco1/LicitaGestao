import { AlertTriangle, CheckCircle2, Link2, Mail, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, Bid, EmailMessage, Paginated } from '../types';
import { formatDate } from '../utils/bid';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

function bidLabel(bid: Bid) {
  const reference = [bid.tender.modality, bid.tender.noticeNumber].filter(Boolean).join(' ');
  return `${reference || 'Licitação sem número'} · ${bid.tender.municipality} · ${formatDate(bid.tender.sessionDate)}`;
}

function matchLabel(item: EmailMessage) {
  if (item.convocationMatchMethod === 'PROCESS_NUMBER') return 'Processo administrativo identificado';
  if (item.convocationMatchMethod === 'NOTICE_NUMBER') return 'Número da licitação identificado';
  if (item.convocationMatchMethod === 'CONTEXT') return 'Cidade e plataforma identificadas';
  if (item.convocationMatchMethod === 'MANUAL') return 'Vinculação manual';
  return null;
}

export function CompanyConvocationsPanel({
  companyId,
  bidId,
  showHeading = true
}: {
  companyId: string;
  bidId?: string;
  showHeading?: boolean;
}) {
  const [items, setItems] = useState<EmailMessage[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ convocationsOnly: 'true', limit: '100' });
      if (bidId) params.set('bidId', bidId);
      const messagesResponse = await api.get<ApiResponse<EmailMessage[]>>(
        `/integrations/gmail/${companyId}/messages?${params.toString()}`
      );
      setItems(messagesResponse.data.data);
      if (!bidId) {
        const bidsResponse = await api.get<ApiResponse<Paginated<Bid>>>('/bids', {
          params: { companyId, page: 1, pageSize: 100, sort: 'sessionDate', direction: 'desc' }
        });
        setBids(bidsResponse.data.data.items);
      }
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [bidId, companyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const bidMap = useMemo(() => new Map(bids.map((bid) => [bid.id, bid])), [bids]);

  const linkMessage = async (messageId: string, targetBidId: string | null) => {
    if (targetBidId === '') return;
    setSavingId(messageId);
    setError('');
    try {
      await api.put(`/integrations/gmail/messages/${messageId}/link`, { bidId: targetBidId });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const dismissMessage = async (item: EmailMessage) => {
    const confirmed = window.confirm(
      'Apagar esta notificação da sua lista? O e-mail original continuará preservado na conta conectada.'
    );
    if (!confirmed) return;
    setSavingId(item.id);
    setError('');
    try {
      await api.delete(`/integrations/gmail/alerts/${item.id}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="detail-panel company-convocations-panel">
      {showHeading && (
        <div className="section-heading-inline">
          <div>
            <strong>Avisos identificados nos e-mails</strong>
            <small>
              O LicitaGestão tenta relacionar convocações e avisos das plataformas pelo processo e número da
              licitação.
            </small>
          </div>
          <button className="secondary-button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Atualizar
          </button>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="app-loader compact-loader">
          <span className="spinner" />
          Carregando avisos...
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state compact">
          <Mail size={30} />
          <p>
            {bidId
              ? 'Nenhum aviso foi vinculado a esta licitação.'
              : 'Nenhuma convocação ou aviso de plataforma foi identificado nos e-mails desta empresa.'}
          </p>
          <small>
            {bidId
              ? 'Quando o processo ou número da licitação for identificado no e-mail, o aviso aparecerá aqui.'
              : 'Avisos sem correspondência segura continuam disponíveis aqui para vinculação manual.'}
          </small>
        </div>
      ) : (
        <div className="convocation-list">
          {items.map((item) => {
            const linkedBid = item.bidId ? bidMap.get(item.bidId) : undefined;
            const match = matchLabel(item);
            return (
              <article key={item.id} className={`convocation-card ${item.bidId ? 'matched' : 'unmatched'}`}>
                <span className="convocation-icon">
                  <AlertTriangle size={20} />
                </span>
                <div className="convocation-content">
                  <div className="convocation-title-row">
                    <strong>{item.subject || 'E-mail sem assunto'}</strong>
                    <time>{formatDateTime(item.receivedAt)}</time>
                  </div>
                  <small>
                    {item.provider === 'OUTLOOK' ? 'Outlook' : 'Gmail'} · De: {item.sender}
                  </small>
                  {item.snippet && <p>{item.snippet}</p>}
                  {item.convocationReason && <em>{item.convocationReason}</em>}

                  {item.bidId && item.tender ? (
                    <div className="convocation-match-box matched">
                      <CheckCircle2 size={16} />
                      <span>
                        <strong>Vinculada à licitação</strong>
                        <small>
                          {[item.tender.modality, item.tender.noticeNumber].filter(Boolean).join(' ') ||
                            'Licitação'}{' '}
                          · {item.tender.municipality}
                          {match ? ` · ${match}` : ''}
                        </small>
                      </span>
                      <Link to={`/participacoes/${item.bidId}`}>Abrir</Link>
                      {!bidId && (
                        <button
                          type="button"
                          className="text-action danger"
                          disabled={savingId === item.id}
                          onClick={() => void linkMessage(item.id, null)}
                          title="Remover vínculo"
                        >
                          <Unlink size={14} />
                          Desvincular
                        </button>
                      )}
                    </div>
                  ) : !bidId ? (
                    <div className="convocation-match-box pending">
                      <Link2 size={16} />
                      <span>
                        <strong>Não vinculada a uma licitação</strong>
                        <small>
                          Selecione manualmente caso o e-mail não traga identificadores suficientes.
                        </small>
                      </span>
                      <select
                        value={selection[item.id] ?? ''}
                        onChange={(event) =>
                          setSelection((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                      >
                        <option value="">Selecionar licitação</option>
                        {bids.map((bid) => (
                          <option key={bid.id} value={bid.id}>
                            {bidLabel(bid)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        disabled={!selection[item.id] || savingId === item.id}
                        onClick={() => void linkMessage(item.id, selection[item.id] ?? '')}
                      >
                        <Link2 size={14} />
                        {savingId === item.id ? 'Vinculando...' : 'Vincular'}
                      </button>
                    </div>
                  ) : null}

                  {item.textContent && (
                    <details>
                      <summary>Ver conteúdo textual</summary>
                      <pre>{item.textContent}</pre>
                    </details>
                  )}
                  {linkedBid && !item.tender && <small>{bidLabel(linkedBid)}</small>}
                  <button
                    type="button"
                    className="text-action danger convocation-dismiss-action"
                    disabled={savingId === item.id}
                    onClick={() => void dismissMessage(item)}
                  >
                    <Trash2 size={14} />
                    {savingId === item.id ? 'Apagando...' : 'Apagar notificação'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
