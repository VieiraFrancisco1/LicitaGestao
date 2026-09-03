import { Bell, CheckCheck, MailWarning, MonitorCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []);
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

export function DeadlineNotifications() {
  const [open, setOpen] = useState(false);
  const [deadlines, setDeadlines] = useState<DeadlineData | null>(null);
  const [gmailAlerts, setGmailAlerts] = useState<GmailConvocationAlertData | null>(null);
  const [desktopPermission, setDesktopPermission] = useState<DesktopPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
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
          const notification = new Notification(`Possível convocação — ${item.companyName}`, {
            body: gmailDesktopBody(item),
            tag: item.key,
            requireInteraction: true
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
            void api.post('/integrations/gmail/alerts/read', { messageId: item.messageId }).catch(() => undefined);
            navigate(item.bidId ? `/participacoes/${item.bidId}?tab=convocations&message=${item.messageId}` : `/empresas/${item.companyId}?tab=convocations&message=${item.messageId}`);
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

  const requestDesktopPermission = async () => {
    if (!('Notification' in window)) {
      setDesktopPermission('unsupported');
      return;
    }
    const permission = await Notification.requestPermission();
    setDesktopPermission(permission);
    if (permission === 'granted') {
      new Notification('LicitaGestão', {
        body: 'Notificações ativadas. Você será avisado sobre prazos urgentes e possíveis convocações.',
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
            unread: Math.max(0, current.unread - (current.items.find((item) => item.key === key)?.read ? 0 : 1)),
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
    navigate(item.bidId ? `/participacoes/${item.bidId}?tab=convocations&message=${item.messageId}` : `/empresas/${item.companyId}?tab=convocations&message=${item.messageId}`);
  };

  const markAll = async () => {
    await Promise.allSettled([api.post('/deadlines/read-all'), api.post('/integrations/gmail/alerts/read-all')]);
    setDeadlines((current) =>
      current ? { ...current, unread: 0, items: current.items.map((item) => ({ ...item, read: true })) } : current
    );
    setGmailAlerts((current) =>
      current ? { ...current, unread: 0, items: current.items.map((item) => ({ ...item, read: true })) } : current
    );
  };

  const deadlineItems = deadlines?.items.slice(0, 5) ?? [];
  const gmailItems = gmailAlerts?.items.slice(0, 5) ?? [];
  const unread = (deadlines?.unread ?? 0) + (gmailAlerts?.unread ?? 0);
  const hasItems = deadlineItems.length > 0 || gmailItems.length > 0;
  const permissionDescription = useMemo(
    () => 'Receba pop-ups do Windows para prazos urgentes e possíveis convocações por e-mail.',
    []
  );

  return (
    <div className="notification-area">
      <button
        className={`notification-button ${unread ? 'has-unread' : ''}`}
        aria-label="Notificações"
        title="Notificações"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} />
        {!!unread && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <div><strong>Alertas</strong><small>{unread} não lido(s)</small></div>
            {!!unread && <button onClick={() => void markAll()} title="Marcar todos como lidos"><CheckCheck size={17} /></button>}
          </div>

          {desktopPermission === 'default' && (
            <button className="desktop-notification-enable" onClick={() => void requestDesktopPermission()}>
              <MonitorCheck size={17} />
              <span><strong>Ativar notificações no computador</strong><small>{permissionDescription}</small></span>
            </button>
          )}
          {desktopPermission === 'granted' && (
            <div className="desktop-notification-status enabled"><MonitorCheck size={16} /><span>Notificações do computador ativadas</span></div>
          )}
          {desktopPermission === 'denied' && (
            <div className="desktop-notification-status blocked">As notificações estão bloqueadas no navegador. Libere a permissão deste site para receber pop-ups.</div>
          )}
          {desktopPermission === 'unsupported' && (
            <div className="desktop-notification-status blocked">Este navegador não disponibilizou notificações do computador para esta página.</div>
          )}

          <div className="notification-list">
            {!hasItems && <div className="notification-empty">Nenhum alerta urgente no momento.</div>}
            {gmailItems.length > 0 && <div className="notification-section-label"><MailWarning size={14} /> E-mail</div>}
            {gmailItems.map((item) => (
              <button key={item.key} className={`notification-item gmail ${item.read ? 'read' : 'unread'}`} onClick={() => void openGmailAlert(item)}>
                <span className="deadline-dot urgent" />
                <span>
                  <strong>{item.subject || 'Possível convocação'}</strong>
                  <small>{item.companyName} · {formatDateTime(item.receivedAt)}</small>
                  <em>{item.bidId ? 'Convocação vinculada à licitação' : 'Possível convocação recebida por e-mail'}</em>
                </span>
              </button>
            ))}
            {deadlineItems.length > 0 && <div className="notification-section-label">Prazos</div>}
            {deadlineItems.map((item) => (
              <button key={item.key} className={`notification-item ${item.read ? 'read' : 'unread'}`} onClick={() => void openDeadline(item.key, item.tenderId)}>
                <span className={`deadline-dot ${item.severity.toLowerCase()}`} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.noticeNumber || item.processNumber || item.municipality} · {formatDate(item.date)}</small>
                  <em>{relativeLabel(item.days)}</em>
                </span>
              </button>
            ))}
          </div>
          <button className="notification-view-all" onClick={() => { setOpen(false); navigate('/prazos'); }}>Ver todos os prazos</button>
        </div>
      )}
    </div>
  );
}
