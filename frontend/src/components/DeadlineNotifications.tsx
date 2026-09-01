import { Bell, CheckCheck, MonitorCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { ApiResponse, DeadlineAlert, DeadlineData } from '../types';

const DESKTOP_NOTIFIED_STORAGE_KEY = 'licitagestao.desktop-notifications.v1';

type DesktopPermission = NotificationPermission | 'unsupported';

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
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

function desktopTitle(item: DeadlineAlert) {
  if (item.severity === 'OVERDUE') return `Prazo vencido — ${item.title}`;
  if (item.severity === 'TODAY') return `Prazo hoje — ${item.title}`;
  return `Prazo próximo — ${item.title}`;
}

function desktopBody(item: DeadlineAlert) {
  const reference = item.noticeNumber || item.processNumber || 'Licitação';
  const location = item.state ? `${item.municipality}/${item.state}` : item.municipality;
  const time = item.type === 'SESSION' && item.sessionTime ? ` às ${item.sessionTime}` : '';
  return `${reference} · ${location} · ${relativeLabel(item.days)}${time}`;
}

export function DeadlineNotifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DeadlineData | null>(null);
  const [desktopPermission, setDesktopPermission] = useState<DesktopPermission>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const location = useLocation();
  const navigate = useNavigate();

  const showDesktopAlerts = useCallback(
    (deadlineData: DeadlineData, permission: DesktopPermission = desktopPermission) => {
      if (permission !== 'granted' || !('Notification' in window)) return;

      const history = loadDesktopNotificationHistory();
      const day = todayKey();
      let changed = false;

      deadlineData.items
        .filter(
          (item) =>
            !item.read &&
            (item.severity === 'OVERDUE' || item.severity === 'TODAY' || item.severity === 'URGENT')
        )
        .forEach((item) => {
          const notificationKey = `${item.key}:${day}`;
          if (history.has(notificationKey)) return;

          const notification = new Notification(desktopTitle(item), {
            body: desktopBody(item),
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await api.get<ApiResponse<DeadlineData>>('/deadlines/alerts?horizon=7&pastDays=7');
        if (!active) return;
        setData(response.data.data);
        showDesktopAlerts(response.data.data);
      } catch {
        // As notificações não devem impedir o restante do sistema de funcionar se a consulta falhar.
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 300_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [location.pathname, showDesktopAlerts]);

  const requestDesktopPermission = async () => {
    if (!('Notification' in window)) {
      setDesktopPermission('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setDesktopPermission(permission);

    if (permission === 'granted') {
      new Notification('LicitaGestão', {
        body: 'Notificações no computador ativadas. Você será avisado sobre prazos urgentes.',
        tag: 'licitagestao-notifications-enabled'
      });
      if (data) showDesktopAlerts(data, permission);
    }
  };

  const openAlert = async (key: string, tenderId: string) => {
    setData((current) =>
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

  const markAll = async () => {
    await api.post('/deadlines/read-all');
    setData((current) =>
      current
        ? { ...current, unread: 0, items: current.items.map((item) => ({ ...item, read: true })) }
        : current
    );
  };

  const items = data?.items.slice(0, 8) ?? [];

  return (
    <div className="notification-area">
      <button
        className={`notification-button ${data?.unread ? 'has-unread' : ''}`}
        aria-label="Notificações de prazo"
        title="Notificações de prazo"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} />
        {!!data?.unread && (
          <span className="notification-count">{data.unread > 99 ? '99+' : data.unread}</span>
        )}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <div>
              <strong>Prazos e alertas</strong>
              <small>{data?.unread ?? 0} não lido(s)</small>
            </div>
            {!!data?.unread && (
              <button onClick={() => void markAll()} title="Marcar todas como lidas">
                <CheckCheck size={17} />
              </button>
            )}
          </div>

          {desktopPermission === 'default' && (
            <button className="desktop-notification-enable" onClick={() => void requestDesktopPermission()}>
              <MonitorCheck size={17} />
              <span>
                <strong>Ativar notificações no computador</strong>
                <small>Receba pop-ups do Windows para prazos urgentes.</small>
              </span>
            </button>
          )}
          {desktopPermission === 'granted' && (
            <div className="desktop-notification-status enabled">
              <MonitorCheck size={16} />
              <span>Notificações do computador ativadas</span>
            </div>
          )}
          {desktopPermission === 'denied' && (
            <div className="desktop-notification-status blocked">
              As notificações estão bloqueadas no navegador. Libere a permissão deste site para receber pop-ups.
            </div>
          )}
          {desktopPermission === 'unsupported' && (
            <div className="desktop-notification-status blocked">
              Este navegador não disponibilizou notificações do computador para esta página.
            </div>
          )}

          <div className="notification-list">
            {items.length === 0 ? (
              <div className="notification-empty">Nenhum prazo urgente nos próximos dias.</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.key}
                  className={`notification-item ${item.read ? 'read' : 'unread'}`}
                  onClick={() => void openAlert(item.key, item.tenderId)}
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
              ))
            )}
          </div>
          <button
            className="notification-view-all"
            onClick={() => {
              setOpen(false);
              navigate('/prazos');
            }}
          >
            Ver todos os prazos
          </button>
        </div>
      )}
    </div>
  );
}
