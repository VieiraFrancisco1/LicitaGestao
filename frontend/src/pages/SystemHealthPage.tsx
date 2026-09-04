import {
  CheckCircle2,
  Cloud,
  Database,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, HealthStatus, SystemHealth } from '../types';
import { formatBytes } from '../utils/bid';

const statusLabels: Record<HealthStatus, string> = {
  OPERATIONAL: 'Funcionando',
  WARNING: 'Atenção',
  UNAVAILABLE: 'Indisponível',
  NOT_CONFIGURED: 'Não configurado'
};

function formatDateTime(value: string | null) {
  if (!value) return 'Ainda não registrado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days) return `${days}d ${hours}h ${minutes}min`;
  if (hours) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function HealthCard({
  icon: Icon,
  title,
  status,
  message,
  children
}: {
  icon: LucideIcon;
  title: string;
  status: HealthStatus;
  message: string;
  children: ReactNode;
}) {
  return (
    <article className={`system-health-card status-${status.toLowerCase().replace('_', '-')}`}>
      <div className="system-health-card-heading">
        <span className="system-health-card-icon">
          <Icon size={21} />
        </span>
        <div>
          <h3>{title}</h3>
          <span className="system-health-status">{statusLabels[status]}</span>
        </div>
      </div>
      <p>{message}</p>
      <dl>{children}</dl>
    </article>
  );
}

export function SystemHealthPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await api.get<ApiResponse<SystemHealth>>('/system/health');
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [load]);

  const overallTitle =
    data?.overall === 'OPERATIONAL'
      ? 'Sistema funcionando normalmente'
      : data?.overall === 'UNAVAILABLE'
        ? 'Serviço essencial indisponível'
        : 'Alguns serviços precisam de atenção';

  return (
    <div className="page-stack">
      <div className="page-heading system-health-heading">
        <div>
          <span className="eyebrow">Monitoramento</span>
          <h2>Saúde do sistema</h2>
          <p>Acompanhe os serviços essenciais do LicitaGestão em um único lugar.</p>
        </div>
        <button className="secondary-button" disabled={refreshing} onClick={() => void load(true)}>
          <RefreshCw size={17} className={refreshing ? 'spin-icon' : ''} />
          {refreshing ? 'Verificando...' : 'Verificar agora'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && !data && <div className="empty-state">Verificando os serviços...</div>}

      {data && (
        <>
          <section className={`system-health-overview status-${data.overall.toLowerCase()}`}>
            <span>
              {data.overall === 'OPERATIONAL' ? <CheckCircle2 size={25} /> : <TriangleAlert size={25} />}
            </span>
            <div>
              <strong>{overallTitle}</strong>
              <small>Última verificação: {formatDateTime(data.checkedAt)}</small>
            </div>
          </section>

          <section className="system-health-grid">
            <HealthCard icon={Server} title="API" status={data.api.status} message={data.api.message}>
              <div>
                <dt>Tempo em funcionamento</dt>
                <dd>{formatUptime(data.api.uptimeSeconds)}</dd>
              </div>
            </HealthCard>

            <HealthCard
              icon={Database}
              title="Banco de dados"
              status={data.database.status}
              message={data.database.message}
            >
              <div>
                <dt>Tempo de resposta</dt>
                <dd>{data.database.latencyMs === null ? 'Indisponível' : `${data.database.latencyMs} ms`}</dd>
              </div>
            </HealthCard>

            <HealthCard icon={Cloud} title="MEGA" status={data.mega.status} message={data.mega.message}>
              <div>
                <dt>Pasta principal</dt>
                <dd>{data.mega.rootFolder}</dd>
              </div>
              <div>
                <dt>Espaço utilizado</dt>
                <dd>
                  {data.mega.spaceUsed !== null && data.mega.spaceTotal !== null
                    ? `${formatBytes(data.mega.spaceUsed)} de ${formatBytes(data.mega.spaceTotal)}`
                    : 'Não informado'}
                </dd>
              </div>
            </HealthCard>

            <HealthCard icon={Mail} title="Gmail" status={data.gmail.status} message={data.gmail.message}>
              <div>
                <dt>Contas conectadas</dt>
                <dd>{data.gmail.connectedAccounts}</dd>
              </div>
              <div>
                <dt>Última sincronização</dt>
                <dd>{formatDateTime(data.gmail.lastSuccessfulSyncAt)}</dd>
              </div>
              <div>
                <dt>Verificação automática</dt>
                <dd>A cada {data.gmail.pollingIntervalSeconds}s</dd>
              </div>
            </HealthCard>

            <HealthCard icon={Mail} title="Outlook" status={data.outlook.status} message={data.outlook.message}>
              <div>
                <dt>Contas conectadas</dt>
                <dd>{data.outlook.connectedAccounts}</dd>
              </div>
              <div>
                <dt>Última sincronização</dt>
                <dd>{formatDateTime(data.outlook.lastSuccessfulSyncAt)}</dd>
              </div>
              <div>
                <dt>Verificação automática</dt>
                <dd>A cada {data.outlook.pollingIntervalSeconds}s</dd>
              </div>
            </HealthCard>
          </section>

          <section className="system-health-security-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Diagnóstico protegido</strong>
              <p>Esta tela é exclusiva do administrador e não mostra senhas, tokens ou credenciais.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
