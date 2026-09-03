import { CheckCircle2, Mail, RefreshCw, Unplug, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, OutlookIntegrationStatus } from '../types';

function formatDateTime(value: string | null) {
  if (!value) return 'Ainda não sincronizado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function OutlookIntegrationPanel({ companyId }: { companyId: string }) {
  const oauthResult = new URLSearchParams(window.location.search).get('outlook');
  const [status, setStatus] = useState<OutlookIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(
    oauthResult === 'connected' ? 'Conta Microsoft conectada com sucesso.' : ''
  );
  const [error, setError] = useState(
    oauthResult === 'error' ? 'Não foi possível concluir a conexão com a Microsoft. Tente novamente.' : ''
  );

  const load = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<OutlookIntegrationStatus>>(
        `/integrations/outlook/${companyId}/status`
      );
      setStatus(response.data.data);
      if (oauthResult !== 'error') setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId, oauthResult]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const connect = async () => {
    setWorking(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<{ url: string }>>(
        `/integrations/outlook/${companyId}/auth-url`
      );
      window.location.assign(response.data.data.url);
    } catch (err) {
      setError(errorMessage(err));
      setWorking(false);
    }
  };

  const sync = async () => {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post<
        ApiResponse<{ found: number; inserted: number; convocations: number; complete?: boolean }>
      >(`/integrations/outlook/${companyId}/sync`);
      setMessage(
        `${response.data.data.found} e-mail(s) recente(s) localizado(s) na Caixa de Entrada; ` +
          `${response.data.data.inserted} novo(s) importado(s); ` +
          `${response.data.data.convocations} aviso(s) importante(s).`
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar esta conta Microsoft? Os e-mails já sincronizados serão preservados.')) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      await api.delete(`/integrations/outlook/${companyId}`);
      setMessage('Conta Microsoft desconectada.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <section className="detail-panel gmail-integration-panel">
        <div className="app-loader compact-loader"><span className="spinner" />Carregando integração...</div>
      </section>
    );
  }

  if (!status?.configured) {
    return (
      <section className="detail-panel gmail-integration-panel">
        <div className="integration-heading">
          <span className="integration-icon"><Mail size={22} /></span>
          <div><strong>Outlook / Hotmail</strong><small>Microsoft OAuth 2.0 + Microsoft Graph</small></div>
        </div>
        <div className="integration-warning">
          <WifiOff size={20} />
          <div>
            <strong>Outlook ainda não configurado no servidor</strong>
            <p>Confira as variáveis da Microsoft no Render para liberar a conexão das contas das empresas.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="detail-panel gmail-integration-panel">
      <div className="integration-heading">
        <span className="integration-icon"><Mail size={22} /></span>
        <div>
          <strong>Outlook / Hotmail</strong>
          <small>Somente leitura. A senha da conta Microsoft nunca é solicitada pelo LicitaGestão.</small>
        </div>
        <span className={`integration-state ${status.connected ? 'connected' : 'disconnected'}`}>
          {status.connected ? 'Conectado' : 'Não conectado'}
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {!status.connected ? (
        <div className="integration-empty">
          <Mail size={36} />
          <div>
            <strong>Outlook não conectado</strong>
            <p>Conecte a conta Outlook ou Hotmail usada pela empresa para receber novos e-mails no LicitaGestão.</p>
          </div>
          <button className="primary-button" onClick={() => void connect()} disabled={working}>
            <Mail size={17} />
            {working ? 'Abrindo Microsoft...' : 'Conectar Outlook / Hotmail'}
          </button>
        </div>
      ) : (
        <div className="integration-connected">
          <div className="integration-account">
            <CheckCircle2 size={22} />
            <div>
              <small>Conta conectada</small>
              <strong>{status.email}</strong>
            </div>
          </div>
          <dl className="integration-data">
            <div><dt>Última sincronização</dt><dd>{formatDateTime(status.lastSuccessfulSyncAt)}</dd></div>
            <div><dt>Verificação automática</dt><dd>A cada {status.pollingIntervalSeconds} segundos</dd></div>
          </dl>
          {status.lastError && (
            <div className="integration-warning compact">
              <WifiOff size={18} />
              <div><strong>Última tentativa apresentou erro</strong><p>{status.lastError}</p></div>
            </div>
          )}
          <div className="integration-actions">
            <button className="secondary-button" onClick={() => void sync()} disabled={working}>
              <RefreshCw size={16} className={working ? 'spin-icon' : ''} />
              Sincronizar agora
            </button>
            <button className="danger-button" onClick={() => void disconnect()} disabled={working}>
              <Unplug size={16} />
              Desconectar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
