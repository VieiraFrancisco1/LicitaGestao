import {
  CheckCircle2,
  Cloud,
  Database,
  DatabaseBackup,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, BackupSummary, HealthStatus, SystemHealth } from '../types';
import './system-health.css';

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
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function formatStorage(bytes: number) {
  const gigabytes = bytes / 1024 / 1024 / 1024;
  if (gigabytes >= 1) return `${gigabytes.toFixed(gigabytes >= 100 ? 0 : 1)} GB`;
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

function storagePercentage(used: number | null, total: number | null) {
  if (used === null || total === null || total <= 0) return null;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

type HealthFact = { label: string; value: string | number };

function ServiceCard({
  icon: Icon,
  title,
  status,
  message,
  facts,
  details = []
}: {
  icon: LucideIcon;
  title: string;
  status: HealthStatus;
  message: string;
  facts: HealthFact[];
  details?: HealthFact[];
}) {
  return (
    <article className={`health-service-card status-${status.toLowerCase().replace('_', '-')}`}>
      <header className="health-service-card-header">
        <span className="health-service-icon">
          <Icon size={19} />
        </span>
        <strong>{title}</strong>
        <span className="health-service-status">{statusLabels[status]}</span>
      </header>

      <p className="health-service-message">{message}</p>

      <dl className="health-service-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {details.length > 0 && (
        <details className="health-service-details">
          <summary>Ver detalhes</summary>
          <dl>
            {details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  );
}

export function SystemHealthPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [backup, setBackup] = useState<BackupSummary | null>(null);
  const [backupUnavailable, setBackupUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [healthResponse, backupResponse] = await Promise.all([
        api.get<ApiResponse<SystemHealth>>('/system/health'),
        api.get<ApiResponse<BackupSummary>>('/backups/summary').catch(() => null)
      ]);

      setData(healthResponse.data.data);
      if (backupResponse) {
        setBackup(backupResponse.data.data);
        setBackupUnavailable(false);
      } else {
        setBackup(null);
        setBackupUnavailable(true);
      }
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

  if (loading && !data) {
    return (
      <div className="app-loader">
        <span className="spinner" />
        Verificando os serviços...
      </div>
    );
  }

  const statuses = data
    ? [data.api.status, data.database.status, data.mega.status, data.gmail.status, data.outlook.status]
    : [];
  const operationalCount = statuses.filter((status) => status === 'OPERATIONAL').length;
  const hasUnavailable = statuses.some((status) => status === 'UNAVAILABLE');
  const hasWarning = statuses.some((status) => status === 'WARNING' || status === 'NOT_CONFIGURED');
  const visualStatus: HealthStatus = hasUnavailable ? 'UNAVAILABLE' : hasWarning ? 'WARNING' : 'OPERATIONAL';

  const overallTitle =
    visualStatus === 'OPERATIONAL'
      ? 'Sistema funcionando normalmente'
      : visualStatus === 'UNAVAILABLE'
        ? 'Há serviço indisponível'
        : 'Alguns serviços precisam de atenção';

  const megaUsage = data ? storagePercentage(data.mega.spaceUsed, data.mega.spaceTotal) : null;
  const megaFree =
    data && data.mega.spaceUsed !== null && data.mega.spaceTotal !== null
      ? Math.max(0, data.mega.spaceTotal - data.mega.spaceUsed)
      : null;

  return (
    <div className="page-stack health-center-page">
      <div className="page-heading health-center-heading">
        <div>
          <span className="eyebrow">Monitoramento</span>
          <h2>Saúde do sistema</h2>
          <p>Status dos serviços essenciais, integrações e rotinas de proteção do LicitaGestão.</p>
        </div>
        <button className="secondary-button" disabled={refreshing} onClick={() => void load(true)}>
          <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
          {refreshing ? 'Verificando...' : 'Verificar agora'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <>
          <section className={`health-center-overview status-${visualStatus.toLowerCase()}`}>
            <div className="health-center-overview-main">
              <span className="health-center-overview-icon">
                {visualStatus === 'OPERATIONAL' ? <CheckCircle2 size={22} /> : <TriangleAlert size={22} />}
              </span>
              <div>
                <strong>{overallTitle}</strong>
                <small>Última verificação: {formatDateTime(data.checkedAt)}</small>
              </div>
            </div>

            <div className="health-center-overview-stats">
              <div>
                <strong>{operationalCount}/5</strong>
                <span>serviços operacionais</span>
              </div>
              <div>
                <strong>60s</strong>
                <span>atualização automática</span>
              </div>
            </div>
          </section>

          <section className="health-services-grid">
            <ServiceCard
              icon={Server}
              title="API"
              status={data.api.status}
              message={data.api.message}
              facts={[
                { label: 'Em funcionamento', value: formatUptime(data.api.uptimeSeconds) }
              ]}
            />

            <ServiceCard
              icon={Database}
              title="Banco de dados"
              status={data.database.status}
              message={data.database.message}
              facts={[
                {
                  label: 'Tempo de resposta',
                  value: data.database.latencyMs === null ? 'Indisponível' : `${data.database.latencyMs} ms`
                }
              ]}
            />

            <article className={`health-service-card status-${data.mega.status.toLowerCase().replace('_', '-')}`}>
              <header className="health-service-card-header">
                <span className="health-service-icon"><Cloud size={19} /></span>
                <strong>MEGA</strong>
                <span className="health-service-status">{statusLabels[data.mega.status]}</span>
              </header>

              <p className="health-service-message">{data.mega.message}</p>

              <dl className="health-service-facts">
                <div>
                  <dt>Armazenamento usado</dt>
                  <dd>{megaUsage === null ? 'Não informado' : `${megaUsage.toFixed(1)}%`}</dd>
                </div>
                <div>
                  <dt>Espaço livre</dt>
                  <dd>{megaFree === null ? 'Não informado' : formatStorage(megaFree)}</dd>
                </div>
              </dl>

              {megaUsage !== null && (
                <div className="health-storage-bar" aria-label={`${megaUsage.toFixed(1)}% do armazenamento utilizado`}>
                  <span style={{ width: `${megaUsage}%` }} />
                </div>
              )}

              <details className="health-service-details">
                <summary>Ver detalhes</summary>
                <dl>
                  <div>
                    <dt>Pasta principal</dt>
                    <dd>{data.mega.rootFolder}</dd>
                  </div>
                  <div>
                    <dt>Utilizado</dt>
                    <dd>{data.mega.spaceUsed === null ? 'Não informado' : formatStorage(data.mega.spaceUsed)}</dd>
                  </div>
                  <div>
                    <dt>Capacidade</dt>
                    <dd>{data.mega.spaceTotal === null ? 'Não informado' : formatStorage(data.mega.spaceTotal)}</dd>
                  </div>
                  <div>
                    <dt>Conexão</dt>
                    <dd>{data.mega.connected ? 'Conectado' : 'Desconectado'}</dd>
                  </div>
                </dl>
              </details>
            </article>

            <ServiceCard
              icon={Mail}
              title="Gmail"
              status={data.gmail.status}
              message={data.gmail.message}
              facts={[
                { label: 'Contas', value: data.gmail.connectedAccounts },
                { label: 'Última sincronização', value: formatDateTime(data.gmail.lastSuccessfulSyncAt) }
              ]}
              details={[
                { label: 'Integração', value: data.gmail.configured ? 'Configurada' : 'Não configurada' },
                { label: 'Verificação automática', value: `A cada ${data.gmail.pollingIntervalSeconds}s` },
                { label: 'Contas com erro', value: data.gmail.accountsWithError },
                { label: 'Sincronizações atrasadas', value: data.gmail.delayedAccounts }
              ]}
            />

            <ServiceCard
              icon={Mail}
              title="Outlook"
              status={data.outlook.status}
              message={data.outlook.message}
              facts={[
                { label: 'Contas', value: data.outlook.connectedAccounts },
                { label: 'Última sincronização', value: formatDateTime(data.outlook.lastSuccessfulSyncAt) }
              ]}
              details={[
                { label: 'Integração', value: data.outlook.configured ? 'Configurada' : 'Não configurada' },
                { label: 'Verificação automática', value: `A cada ${data.outlook.pollingIntervalSeconds}s` },
                { label: 'Contas com erro', value: data.outlook.accountsWithError },
                { label: 'Sincronizações atrasadas', value: data.outlook.delayedAccounts }
              ]}
            />
          </section>

          <section className="health-maintenance-section">
            <div className="health-maintenance-heading">
              <div>
                <span className="eyebrow">Proteção e manutenção</span>
                <h3>Rotinas administrativas</h3>
              </div>
            </div>

            <div className="health-maintenance-grid">
              <article className={`health-maintenance-card ${!backup?.lastBackup ? 'attention' : ''}`}>
                <span className="health-maintenance-icon"><DatabaseBackup size={19} /></span>
                <div>
                  <small>Último backup</small>
                  <strong>
                    {backupUnavailable
                      ? 'Não foi possível consultar'
                      : backup?.lastBackup
                        ? formatDateTime(backup.lastBackup.createdAt)
                        : 'Nenhum backup registrado'}
                  </strong>
                  <span>
                    {backup?.lastBackup?.actor?.name
                      ? `Gerado por ${backup.lastBackup.actor.name}`
                      : 'Acesse a área de backup para gerar ou revisar uma cópia.'}
                  </span>
                </div>
                <Link to="/backups">Abrir backups</Link>
              </article>

              <article className="health-maintenance-card protected">
                <span className="health-maintenance-icon"><ShieldCheck size={19} /></span>
                <div>
                  <small>Diagnóstico protegido</small>
                  <strong>Credenciais não são exibidas</strong>
                  <span>Senhas, tokens e segredos das integrações permanecem fora desta tela.</span>
                </div>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
