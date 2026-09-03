import { Building2, CheckCheck, MailWarning, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, CompanySummary, GmailConvocationAlert, GmailConvocationAlertData } from '../types';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function ConvocationsPage() {
  const { user, activeCompanyId, setActiveCompanyId } = useAuth();
  const [data, setData] = useState<GmailConvocationAlertData>({ items: [], unread: 0 });
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsResponse, companiesResponse] = await Promise.all([
        api.get<ApiResponse<GmailConvocationAlertData>>('/integrations/gmail/alerts'),
        api.get<ApiResponse<CompanySummary[]>>('/companies/options')
      ]);
      const alerts = alertsResponse.data.data;
      const options = [...companiesResponse.data.data];
      alerts.items.forEach((item) => {
        if (!options.some((company) => company.id === item.companyId)) {
          options.push({ id: item.companyId, legalName: item.companyName, tradeName: item.companyName });
        }
      });
      setData(alerts);
      setCompanies(options);
      setSelectedCompanyId((current) => {
        if (options.some((company) => company.id === current)) return current;
        if (activeCompanyId && options.some((company) => company.id === activeCompanyId))
          return activeCompanyId;
        return options[0]?.id ?? '';
      });
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const open = async (item: GmailConvocationAlert) => {
    if (!item.read) {
      setData((current) => ({
        ...current,
        unread: Math.max(0, current.unread - 1),
        items: current.items.map((currentItem) =>
          currentItem.messageId === item.messageId ? { ...currentItem, read: true } : currentItem
        )
      }));
      await api.post('/integrations/gmail/alerts/read', { messageId: item.messageId }).catch(() => undefined);
    }
    navigate(
      item.bidId
        ? `/participacoes/${item.bidId}?tab=convocations&message=${item.messageId}`
        : `/empresas/${item.companyId}?tab=convocations&message=${item.messageId}`
    );
  };

  const markAll = async () => {
    const unreadItems = data.items.filter((item) => item.companyId === selectedCompanyId && !item.read);
    if (unreadItems.length === 0) return;
    await Promise.all(
      unreadItems.map((item) => api.post('/integrations/gmail/alerts/read', { messageId: item.messageId }))
    );
    setData((current) => ({
      ...current,
      unread: Math.max(0, current.unread - unreadItems.length),
      items: current.items.map((item) =>
        item.companyId === selectedCompanyId ? { ...item, read: true } : item
      )
    }));
  };

  const unreadByCompany = useMemo(() => {
    const counts = new Map<string, number>();
    data.items.forEach((item) => {
      if (!item.read) counts.set(item.companyId, (counts.get(item.companyId) ?? 0) + 1);
    });
    return counts;
  }, [data.items]);

  const visibleItems = useMemo(
    () => data.items.filter((item) => item.companyId === selectedCompanyId),
    [data.items, selectedCompanyId]
  );
  const selectedUnread = unreadByCompany.get(selectedCompanyId) ?? 0;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);

  const selectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    if (user?.role === 'FUNCIONARIO') setActiveCompanyId(companyId);
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
          {!!selectedUnread && (
            <button className="secondary-button" onClick={() => void markAll()}>
              <CheckCheck size={16} /> Marcar empresa como lida
            </button>
          )}
          <button className="secondary-button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {companies.length > 0 && (
        <nav className="company-alert-tabs" aria-label="Avisos separados por empresa">
          {companies.map((company) => {
            const unread = unreadByCompany.get(company.id) ?? 0;
            return (
              <button
                key={company.id}
                className={selectedCompanyId === company.id ? 'active' : ''}
                onClick={() => selectCompany(company.id)}
              >
                <Building2 size={16} />
                <span>{company.tradeName || company.legalName}</span>
                {unread > 0 && (
                  <strong className="company-alert-badge">{unread > 99 ? '99+' : unread}</strong>
                )}
              </button>
            );
          })}
        </nav>
      )}

      <div className="convocation-summary-card">
        <MailWarning size={22} />
        <div>
          <small>Não lidos · {selectedCompany?.tradeName || selectedCompany?.legalName || 'Empresa'}</small>
          <strong>{selectedUnread}</strong>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="app-loader">
          <span className="spinner" />
          Carregando avisos...
        </div>
      ) : visibleItems.length === 0 ? (
        <section className="empty-state">
          <MailWarning size={36} />
          <h2>Nenhum aviso encontrado para esta empresa</h2>
          <p>
            Quando o Gmail ou Outlook desta empresa receber um aviso de licitação, ele aparecerá nesta aba.
          </p>
        </section>
      ) : (
        <section className="convocation-list global-convocation-list">
          {visibleItems.map((item) => (
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
