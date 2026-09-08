import { Bell, CheckCheck, MailWarning, MonitorCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type {
  ApiResponse,
  DeadlineAlert,
  DeadlineData,
  GmailConvocationAlert,
  GmailConvocationAlertData
} from '../types';

const DESKTOP_NOTIFIED_STORAGE_KEY = 'licitagestao.desktop-notifications.v2';

type DesktopPermission = NotificationPermission | 'unsupported';
type SelectedAlertKey = `gmail:${string}` | `deadline:${string}`;

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(date));
}

function relativeLabel(days: number) {
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function loadDesktopNotificationHistory() {
  try {
    const raw = window.localStorage.getItem(DESKTOP_NOTIFIED_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const values = JSON.parse(raw) as unknown;
    return new Set(
      Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []
    );
  } catch {
    return new Set<string>();
  }
}

function saveDesktopNotificationHistory(history: Set<string>) {
  const currentDay = todayKey();
  const compact = [...history].filter((value) => value.endsWith(`:${currentDay}`));
  window.localStorage.setItem(DESKTOP_NOTIFIED_STORAGE_KEY, JSON.stringify(compact));
}

function deadlineDesktopTitle(item: DeadlineAlert) {
  if (item.severity === 'OVERDUE') return `Prazo vencido — ${item.title}`;
  if (item.severity === 'TODAY') return `Prazo hoje — ${item.title}`;
  return `Prazo próximo — ${item.title}`;
}

function deadlineDesktopBody(item: DeadlineAlert) {
  const reference = item.noticeNumber || item.processNumber || 'Licitação';
  const location = item.state ? `${item.municipality}/${item.state}` : item.municipality;
  const time = item.type === 'SESSION' && item.sessionTime ? ` às ${item.sessionTime}` : '';
  return `${reference} · ${location} · ${relativeLabel(item.days)}${time}`;
}

function gmailDesktopBody(item: GmailConvocationAlert) {
  const subject = item.subject || 'E-mail sem assunto';
  return `${item.companyName} · ${subject} · De: ${item.sender}`;
}

const gmailSelectionKey = (item: GmailConvocationAlert): SelectedAlertKey => `gmail:${item.messageId}`;
const deadlineSelectionKey = (item: DeadlineAlert): SelectedAlertKey => `deadline:${item.key}`;

export function DeadlineNotifications() {
  const [open, setOpen] = useState(false);
  const [deadlines, setDeadlines] = useState<DeadlineData | null>(null);
  const [gmailAlerts, setGmailAlerts] = useState<GmailConvocationAlertData | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<SelectedAlertKey>>(() => new Set());
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<DesktopPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const emailSyncRunning = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  const showDesktopDeadlineAlerts = useCallback(
    (deadlineData: DeadlineData, permission: DesktopPermission = desktopPermission) => {
      if (permission !== 'granted' || !('Notification' in window)) return;
      const history = loadDesktopNotificationHistory();
      const day = todayKey();
      let changed = false;

      deadlineData.items
        .filter(
          (item) =>
            item.type === 'SESSION' &&
            !item.read &&
            (item.severity === 'OVERDUE' || item.severity === 'TODAY' || item.severity === 'URGENT')
        )
        .forEach((item) => {
          const notificationKey = `${item.key}:${day}`;
          if (history.has(notificationKey)) return;
          const notification = new Notification(deadlineDesktopTitle(item), {
            body: deadlineDesktopBody(item),
            tag: item.key,
            requireInteraction: item.severity === 'OVERDUE' || item.severity === 'TODAY'
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
            void api.post('/deadlines/read', { alertKey: item.key }).catch(() => undefined);
            navigate(`/licitacoes/${item.tenderId}`);
          };
          history.add(notificationKey);
          changed = true;
        });
      if (changed) saveDesktopNotificationHistory(history);
    },
    [desktopPermission, navigate]
  );

  const showDesktopGmailAlerts = useCallback(
    (gmailData: GmailConvocationAlertData, permission: DesktopPermission = desktopPermission) => {
      if (permission !== 'granted' || !('Notification' in window)) return;
      const history = loadDesktopNotificationHistory();
      const day = todayKey();
      let changed = false;

      gmailData.items
        .filter((item) => !item.read)
        .forEach((item) => {
          const notificationKey = `${item.key}:${day}`;
          if (history.has(notificationKey)) return;
          const notification = new Notification(`Alerta de licitação — ${item.companyName}`, {
            body: gmailDesktopBody(item),
            tag: item.key,
            requireInteraction: true
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
            void api
              .post('/integrations/gmail/alerts/read', { messageId: item.messageId })
              .catch(() => undefined);
            navigate(
              item.bidId
                ? `/participacoes/${item.bidId}?tab=convocations&message=${item.messageId}`
                : `/empresas/${item.companyId}?tab=convocations&message=${item.messageId}`
            );
          };
          history.add(notificationKey);
          changed = true;
        });
      if (changed) saveDesktopNotificationHistory(history);
    },
    [desktopPermission, navigate]
  );

  const loadAlerts = useCallback(async () => {
    const [deadlineResult, gmailResult] = await Promise.allSettled([
      api.get<ApiResponse<DeadlineData>>('/deadlines/alerts?horizon=7&pastDays=7'),
      api.get<ApiResponse<GmailConvocationAlertData>>('/integrations/gmail/alerts')
    ]);
    if (deadlineResult.status === 'fulfilled') {
      setDeadlines(deadlineResult.value.data.data);
      showDesktopDeadlineAlerts(deadlineResult.value.data.data);
    }
    if (gmailResult.status === 'fulfilled') {
      setGmailAlerts(gmailResult.value.data.data);
      showDesktopGmailAlerts(gmailResult.value.data.data);
    }
  }, [showDesktopDeadlineAlerts, showDesktopGmailAlerts]);

  const syncEmails = useCallback(async () => {
    if (emailSyncRunning.current) return;
    emailSyncRunning.current = true;
    try {
      await api.post('/integrations/email/sync');
      await loadAlerts();
    } catch {
      // O status detalhado da integração continua disponível na área da empresa.
    } finally {
      emailSyncRunning.current = false;
    }
  }, [loadAlerts]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await loadAlerts();
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [location.pathname, loadAlerts]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void syncEmails(), 0);
    const timer = window.setInterval(() => void syncEmails(), 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncEmails();
    };
    const handleFocus = () => void syncEmails();
    const handleOnline = () => void syncEmails();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [syncEmails]);

  const requestDesktopPermission = async () => {
    if (!('Notification' in window)) {
      setDesktopPermission('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setDesktopPermission(permission);
    if (permission === 'granted') {
      new Notification('LicitaGestão', {
        body: 'Notificações ativadas. Você será avisado sobre prazos, convocações e avisos das plataformas.',
        tag: 'licitagestao-notifications-enabled'
      });
      if (deadlines) showDesktopDeadlineAlerts(deadlines, permission);
      if (gmailAlerts) showDesktopGmailAlerts(gmailAlerts, permission);
    }
  };

  const openDeadline = async (key: string, tenderId: string) => {
    setDeadlines((current) =>
      current
        ? {
            ...current,
            unread: Math.max(
              0,
              current.unread - (current.items.find((item) => item.key === key)?.read ? 0 : 1)
            ),
            items: current.items.map((item) => (item.key === key ? { ...item, read: true } : item))
          }
        : current
    );
    setOpen(false);
    void api.post('/deadlines/read', { alertKey: key }).catch(() => undefined);
    navigate(`/licitacoes/${tenderId}`);
  };

  const openGmailAlert = async (item: GmailConvocationAlert) => {
    setGmailAlerts((current) =>
      current
        ? {
            ...current,
            unread: Math.max(0, current.unread - (item.read ? 0 : 1)),
            items: current.items.map((currentItem) =>
              currentItem.messageId === item.messageId ? { ...currentItem, read: true } : currentItem
            )
          }
        : current
    );
    setOpen(false);
    void api.post('/integrations/gmail/alerts/read', { messageId: item.messageId }).catch(() => undefined);
    navigate(
      item.bidId
        ? `/participacoes/${item.bidId}?tab=convocations&message=${item.messageId}`
        : `/empresas/${item.companyId}?tab=convocations&message=${item.messageId}`
    );
  };

  const markAll = async () => {
    await Promise.allSettled([
      api.post('/deadlines/read-all'),
      api.post('/integrations/gmail/alerts/read-all')
    ]);
    setDeadlines((current) =>
      current
        ? { ...current, unread: 0, items: current.items.map((item) => ({ ...item, read: true })) }
        : current
    );
    setGmailAlerts((current) =>
      current
        ? { ...current, unread: 0, items: current.items.map((item) => ({ ...item, read: true })) }
        : current
    );
  };

  const dismissGmailAlert = async (item: GmailConvocationAlert) => {
    try {
      await api.delete(`/integrations/gmail/alerts/${item.messageId}`);
      setGmailAlerts((current) =>
        current
          ? {
              ...current,
              unread: Math.max(0, current.unread - (item.read ? 0 : 1)),
              items: current.items.filter((currentItem) => currentItem.messageId !== item.messageId)
            }
          : current
      );
    } catch {
      await loadAlerts();
    }
  };

  const dismissDeadline = async (item: DeadlineAlert) => {
    try {
      await api.post('/deadlines/dismiss', { alertKey: item.key });
      setDeadlines((current) =>
        current
          ? {
              ...current,
              unread: Math.max(0, current.unread - (item.read ? 0 : 1)),
              items: current.items.filter((currentItem) => currentItem.key !== item.key)
            }
          : current
      );
    } catch {
      await loadAlerts();
    }
  };

  const gmailItems = gmailAlerts?.items ?? [];
  const deadlineItems = deadlines?.items ?? [];
  const allSelectionKeys = useMemo<SelectedAlertKey[]>(
    () => [
      ...gmailItems.map((item) => gmailSelectionKey(item)),
      ...deadlineItems.map((item) => deadlineSelectionKey(item))
    ],
    [gmailItems, deadlineItems]
  );
  const selectedCount = selectedAlerts.size;
  const allSelected = allSelectionKeys.length > 0 && allSelectionKeys.every((key) => selectedAlerts.has(key));

  const toggleSelection = (key: SelectedAlertKey) => {
    setSelectedAlerts((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedAlerts(allSelected ? new Set<SelectedAlertKey>() : new Set(allSelectionKeys));
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedAlerts(new Set<SelectedAlertKey>());
  };

  const deleteSelectedAlerts = async () => {
    const selectedGmail = gmailItems.filter((item) => selectedAlerts.has(gmailSelectionKey(item)));
    const selectedDeadlines = deadlineItems.filter((item) => selectedAlerts.has(deadlineSelectionKey(item)));
    const total = selectedGmail.length + selectedDeadlines.length;
    if (total === 0 || deletingSelected) return;

    const confirmed = window.confirm(
      `Apagar ${total} notificação${total === 1 ? '' : 'ões'} selecionada${total === 1 ? '' : 's'}?\n\n` +
        'Isso remove os alertas da sua lista, mas não apaga o e-mail nem a licitação.'
    );
    if (!confirmed) return;

    setDeletingSelected(true);
    try {
      const results = await Promise.allSettled([
        ...selectedGmail.map((item) => api.delete(`/integrations/gmail/alerts/${item.messageId}`)),
        ...selectedDeadlines.map((item) => api.post('/deadlines/dismiss', { alertKey: item.key }))
      ]);
      const failed = results.filter((result) => result.status === 'rejected').length;
      await loadAlerts();
      cancelSelection();
      if (failed > 0) {
        window.alert(
          `${failed} notificação${failed === 1 ? '' : 'ões'} não ${failed === 1 ? 'pôde' : 'puderam'} ser apagada${failed === 1 ? '' : 's'}. A lista foi atualizada.`
        );
      }
    } finally {
      setDeletingSelected(false);
    }
  };

  const unread = (deadlines?.unread ?? 0) + (gmailAlerts?.unread ?? 0);
  const hasItems = deadlineItems.length > 0 || gmailItems.length > 0;
  const permissionDescription = useMemo(
    () => 'Receba pop-ups do Windows para prazos, convocações e avisos importantes das plataformas.',
    []
  );

  const togglePopover = () => {
    if (open) cancelSelection();
    setOpen((value) => !value);
  };

  return (
    <div className="notification-area">
      <button
        className={`notification-button ${unread ? 'has-unread' : ''}`}
        aria-label="Notificações"
        title="Notificações"
        onClick={togglePopover}
      >
        <Bell size={20} />
        {!!unread && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <div>
              <strong>Alertas</strong>
              <small>
                {selectionMode
                  ? `${selectedCount} selecionada(s)`
                  : `${unread} não lido(s)`}
              </small>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {!selectionMode && !!unread && (
                <button onClick={() => void markAll()} title="Marcar todos como lidos">
                  <CheckCheck size={17} />
                </button>
              )}
              {hasItems && (
                <button
                  onClick={() => {
                    if (selectionMode) cancelSelection();
                    else {
                      setSelectedAlerts(new Set<SelectedAlertKey>());
                      setSelectionMode(true);
                    }
                  }}
                  title={selectionMode ? 'Cancelar seleção' : 'Selecionar notificações para apagar'}
                  aria-label={selectionMode ? 'Cancelar seleção' : 'Selecionar notificações para apagar'}
                  style={selectionMode ? { color: '#b42318', background: '#fff1f2' } : undefined}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          </div>

          {selectionMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 12px',
                borderBottom: '1px solid var(--line)',
                background: '#f8fafc'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                  color: '#344054',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Selecionar todas as notificações"
                />
                <span>{allSelected ? 'Desmarcar todas' : 'Selecionar todas'}</span>
              </label>
              <button
                className="secondary-button"
                disabled={selectedCount === 0 || deletingSelected}
                onClick={() => void deleteSelectedAlerts()}
                style={{
                  padding: '7px 10px',
                  background: '#fff1f2',
                  color: '#b42318',
                  border: '1px solid #fecdd3',
                  whiteSpace: 'nowrap'
                }}
              >
                <Trash2 size={14} />
                {deletingSelected ? 'Apagando...' : `Apagar (${selectedCount})`}
              </button>
            </div>
          )}

          {!selectionMode && desktopPermission === 'default' && (
            <button className="desktop-notification-enable" onClick={() => void requestDesktopPermission()}>
              <MonitorCheck size={17} />
              <span>
                <strong>Ativar notificações no computador</strong>
                <small>{permissionDescription}</small>
              </span>
            </button>
          )}
          {!selectionMode && desktopPermission === 'granted' && (
            <div className="desktop-notification-status enabled">
              <MonitorCheck size={16} />
              <span>Notificações do computador ativadas</span>
            </div>
          )}
          {!selectionMode && desktopPermission === 'denied' && (
            <div className="desktop-notification-status blocked">
              As notificações estão bloqueadas no navegador. Libere a permissão deste site para receber
              pop-ups.
            </div>
          )}
          {!selectionMode && desktopPermission === 'unsupported' && (
            <div className="desktop-notification-status blocked">
              Este navegador não disponibilizou notificações do computador para esta página.
            </div>
          )}

          <div className="notification-list">
            {!hasItems && <div className="notification-empty">Nenhum alerta urgente no momento.</div>}
            {gmailItems.length > 0 && (
              <div className="notification-section-label">
                <MailWarning size={14} /> E-mail
              </div>
            )}
            {gmailItems.map((item) => {
              const selectionKey = gmailSelectionKey(item);
              const selected = selectedAlerts.has(selectionKey);
              return (
                <div
                  key={item.key}
                  className={`notification-item gmail ${item.read ? 'read' : 'unread'}`}
                  style={selectionMode && selected ? { background: '#eef4ff' } : undefined}
                >
                  {selectionMode && (
                    <label
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        padding: '0 2px 0 12px',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelection(selectionKey)}
                        aria-label={`Selecionar notificação ${item.subject || 'Aviso importante'}`}
                      />
                    </label>
                  )}
                  <button
                    className="notification-item-open"
                    onClick={() =>
                      selectionMode ? toggleSelection(selectionKey) : void openGmailAlert(item)
                    }
                  >
                    <span className="deadline-dot urgent" />
                    <span>
                      <strong>{item.subject || 'Aviso importante'}</strong>
                      <small>
                        {item.companyName} · {formatDateTime(item.receivedAt)}
                      </small>
                      <em>
                        {item.bidId ? 'Aviso vinculado à licitação' : 'Aviso importante recebido por e-mail'}
                      </em>
                    </span>
                  </button>
                  {!selectionMode && (
                    <button
                      className="notification-dismiss"
                      title="Apagar notificação"
                      aria-label={`Apagar notificação ${item.subject || 'Aviso importante'}`}
                      onClick={() => void dismissGmailAlert(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
            {deadlineItems.length > 0 && <div className="notification-section-label">Prazos</div>}
            {deadlineItems.map((item) => {
              const selectionKey = deadlineSelectionKey(item);
              const selected = selectedAlerts.has(selectionKey);
              return (
                <div
                  key={item.key}
                  className={`notification-item ${item.read ? 'read' : 'unread'}`}
                  style={selectionMode && selected ? { background: '#eef4ff' } : undefined}
                >
                  {selectionMode && (
                    <label
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        padding: '0 2px 0 12px',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelection(selectionKey)}
                        aria-label={`Selecionar notificação ${item.title}`}
                      />
                    </label>
                  )}
                  <button
                    className="notification-item-open"
                    onClick={() =>
                      selectionMode
                        ? toggleSelection(selectionKey)
                        : void openDeadline(item.key, item.tenderId)
                    }
                  >
                    <span className={`deadline-dot ${item.severity.toLowerCase()}`} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.noticeNumber || item.processNumber || item.municipality} · {formatDate(item.date)}
                      </small>
                      <em>{relativeLabel(item.days)}</em>
                    </span>
                  </button>
                  {!selectionMode && (
                    <button
                      className="notification-dismiss"
                      title="Apagar notificação"
                      aria-label={`Apagar notificação ${item.title}`}
                      onClick={() => void dismissDeadline(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {!selectionMode && (
            <button
              className="notification-view-all"
              onClick={() => {
                setOpen(false);
                navigate('/prazos');
              }}
            >
              Ver todos os prazos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
