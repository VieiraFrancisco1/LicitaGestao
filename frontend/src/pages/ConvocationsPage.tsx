import {
  Building2,
  CheckCheck,
  Filter,
  Link2,
  Mail,
  MailWarning,
  RefreshCw,
  Search,
  Trash2,
  Unlink2
} from 'lucide-react';
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

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `há ${minutes} min`;
  }
  if (hours < 24) return `há ${hours} hora${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}

export function ConvocationsPage() {
  const { user, activeCompanyId, setActiveCompanyId } = useAuth();
  const [data, setData] = useState<GmailConvocationAlertData>({ items: [], unread: 0 });
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [emailFilter, setEmailFilter] = useState<'IMPORTANTES' | 'TODOS'>('IMPORTANTES');
  const [search, setSearch] = useState('');
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
        if (activeCompanyId && options.some((company) => company.id === activeCompanyId)) {
          return activeCompanyId;
        }
        if ((user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && !activeCompanyId) return '';
        if (options.some((company) => company.id === current)) return current;
        return options[0]?.id ?? '';
      });
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, user?.role]);

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
        : item.tenderId
          ? `/licitacoes/${item.tenderId}`
          : `/empresas/${item.companyId}?tab=convocations&message=${item.messageId}`
    );
  };

  const markAll = async () => {
    const unreadItems = filteredItems.filter((item) => !item.read);
    if (unreadItems.length === 0) return;
    await Promise.all(
      unreadItems.map((item) => api.post('/integrations/gmail/alerts/read', { messageId: item.messageId }))
    );
    const unreadIds = new Set(unreadItems.map((item) => item.messageId));
    setData((current) => ({
      ...current,
      unread: Math.max(0, current.unread - unreadItems.length),
      items: current.items.map((item) => (unreadIds.has(item.messageId) ? { ...item, read: true } : item))
    }));
  };

  const unreadByCompany = useMemo(() => {
    const counts = new Map<string, number>();
    data.items.forEach((item) => {
      if (!item.read) counts.set(item.companyId, (counts.get(item.companyId) ?? 0) + 1);
    });
    return counts;
  }, [data.items]);

  const companyItems = useMemo(
    () => (selectedCompanyId ? data.items.filter((item) => item.companyId === selectedCompanyId) : data.items),
    [data.items, selectedCompanyId]
  );

  const importantCount = companyItems.filter((item) => item.priority).length;
  const linkedCount = companyItems.filter((item) => Boolean(item.tender)).length;
  const unlinkedCount = companyItems.filter((item) => !item.tender).length;

  const searchTerm = search.trim().toLocaleLowerCase('pt-BR');
  const filteredItems = (emailFilter === 'IMPORTANTES'
    ? companyItems.filter((item) => item.priority)
    : companyItems
  ).filter((item) => {
    if (!searchTerm) return true;
    return [item.subject, item.sender, item.snippet, item.companyName, item.tender?.municipality]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('pt-BR').includes(searchTerm));
  });

  const selectedUnread = filteredItems.filter((item) => !item.read).length;

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);

  const selectCompany = (companyId: string | null) => {
    setSelectedCompanyId(companyId ?? '');
    if (user?.role !== 'EMPRESA') setActiveCompanyId(companyId);
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
    <div className="page-stack emails-page-stack">
      <div className="emails-header-block">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h2>E-mails</h2>
          <h3>E-mails recebidos</h3>
          <p>
            Todos os e-mails das contas conectadas aparecem aqui, com associação automática à licitação quando
            houver correspondência segura.
          </p>
        </div>
      </div>

      {companies.length > 0 && (
        <nav className="company-alert-tabs emails-company-tabs" aria-label="Avisos separados por empresa">
          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <button className={selectedCompanyId === '' ? 'active' : ''} onClick={() => selectCompany(null)}>
              <Building2 size={16} />
              <span>Todas as empresas</span>
              {data.unread > 0 && (
                <strong className="company-alert-badge">{data.unread > 99 ? '99+' : data.unread}</strong>
              )}
            </button>
          )}
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

      <section className="emails-toolbar-card">
        <div className="emails-toolbar-left">
          <button
            className={`emails-filter-pill ${emailFilter === 'IMPORTANTES' ? 'active' : ''}`}
            onClick={() => setEmailFilter('IMPORTANTES')}
          >
            <Mail size={16} /> Importantes ({importantCount})
          </button>
          <button
            className={`emails-filter-pill ${emailFilter === 'TODOS' ? 'active' : ''}`}
            onClick={() => setEmailFilter('TODOS')}
          >
            <CheckCheck size={16} /> Todos ({companyItems.length})
          </button>
        </div>

        <label className="emails-search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por assunto, remetente ou conteúdo..."
          />
        </label>

        <div className="emails-toolbar-actions">
          <button className="secondary-button emails-mini-filter" type="button">
            <Filter size={16} /> Filtros
          </button>
          {!!selectedUnread && (
            <button className="secondary-button" onClick={() => void markAll()}>
              <CheckCheck size={16} /> Marcar como lidos
            </button>
          )}
          <button className="secondary-button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Atualizar
          </button>
        </div>
      </section>

      <section className="emails-summary-grid">
        <article className="email-stat-card">
          <span className="email-stat-icon blue">
            <Mail size={20} />
          </span>
          <div>
            <small>Não lidos</small>
            <strong>{companyItems.filter((item) => !item.read).length}</strong>
            <p>E-mails não lidos na caixa</p>
          </div>
        </article>
        <article className="email-stat-card">
          <span className="email-stat-icon amber">
            <MailWarning size={20} />
          </span>
          <div>
            <small>Prioridade</small>
            <strong>{importantCount}</strong>
            <p>E-mails marcados como prioridade</p>
          </div>
        </article>
        <article className="email-stat-card">
          <span className="email-stat-icon green">
            <Link2 size={20} />
          </span>
          <div>
            <small>Vinculados</small>
            <strong>{linkedCount}</strong>
            <p>E-mails vinculados a licitações</p>
          </div>
        </article>
        <article className="email-stat-card">
          <span className="email-stat-icon gold">
            <Unlink2 size={20} />
          </span>
          <div>
            <small>Não vinculados</small>
            <strong>{unlinkedCount}</strong>
            <p>E-mails que precisam de vínculo</p>
          </div>
        </article>
      </section>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="app-loader">
          <span className="spinner" />
          Carregando avisos...
        </div>
      ) : filteredItems.length === 0 ? (
        <section className="empty-state">
          <MailWarning size={36} />
          <h2>Nenhum aviso encontrado para este escopo</h2>
          <p>
            Quando o Gmail ou Outlook receber qualquer e-mail dentro do escopo selecionado, ele aparecerá aqui.
          </p>
        </section>
      ) : (
        <section className="convocation-list global-convocation-list emails-convocation-list">
          {filteredItems.map((item) => (
            <article key={item.messageId} className={`convocation-card-with-actions ${item.read ? 'read' : 'unread'}`}>
              <button className="convocation-card-open" onClick={() => void open(item)}>
                <span className="emails-message-icon">
                  <Mail size={18} />
                </span>
                <div className="convocation-content">
                  <div className="convocation-title-row">
                    <strong>{item.subject || 'E-mail sem assunto'}</strong>
                    {item.priority && (
                      <span className="email-priority-badge">
                        {item.priorityKind === 'PRIMEIRO_COLOCADO' ? 'Primeiro colocado' : 'Prioridade'}
                      </span>
                    )}
                  </div>
                  <small>
                    {item.provider === 'OUTLOOK' ? 'Outlook' : 'Gmail'} · {item.companyName} · {item.sender}
                  </small>
                  {item.tender ? (
                    <div className="convocation-inline-match matched">
                      Vinculado: {[item.tender.modality, item.tender.noticeNumber].filter(Boolean).join(' ') || 'Licitação'} ·{' '}
                      {item.tender.municipality}
                    </div>
                  ) : (
                    <div className="convocation-inline-match pending">
                      Não vinculada — confira e vincule na área da empresa
                    </div>
                  )}
                  {item.snippet && <p>{item.snippet}</p>}
                </div>
                <div className="emails-message-meta">
                  <time>{formatDateTime(item.receivedAt)}</time>
                  <small>{relativeTime(item.receivedAt)}</small>
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

      <div className="emails-scope-caption">
        Exibindo: {selectedCompany?.tradeName || selectedCompany?.legalName || 'Todas as empresas'}
      </div>
    </div>
  );
}
