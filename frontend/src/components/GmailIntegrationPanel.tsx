import { CheckCircle2, Clock3, Mail, RefreshCw, Send, Unplug, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, GmailAccessRequest, GmailIntegrationStatus } from '../types';

function formatDateTime(value: string | null) {
  if (!value) return 'Ainda não sincronizado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function GmailIntegrationPanel({ companyId }: { companyId: string }) {
  const [status, setStatus] = useState<GmailIntegrationStatus | null>(null);
  const [request, setRequest] = useState<GmailAccessRequest | null>(null);
  const [requestedEmail, setRequestedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [statusResponse, requestResponse] = await Promise.all([
        api.get<ApiResponse<GmailIntegrationStatus>>(`/integrations/gmail/${companyId}/status`),
        api.get<ApiResponse<GmailAccessRequest | null>>(`/integrations/gmail/${companyId}/access-request`)
      ]);
      setStatus(statusResponse.data.data);
      setRequest(requestResponse.data.data);
      if (requestResponse.data.data?.email) setRequestedEmail(requestResponse.data.data.email);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const requestAuthorization = async () => {
    if (!requestedEmail.trim()) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/integrations/gmail/${companyId}/access-request`, { email: requestedEmail });
      setMessage('Solicitação enviada. Aguarde o administrador principal aprovar o e-mail.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const connect = async () => {
    setWorking(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<{ url: string }>>(
        `/integrations/gmail/${companyId}/auth-url`
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
      const response = await api.post<ApiResponse<{ found: number; inserted: number; convocations: number }>>(
        `/integrations/gmail/${companyId}/sync`
      );
      setMessage(
        `${response.data.data.inserted} e-mail(s) novo(s) recebido(s); ${response.data.data.convocations} aviso(s) importante(s).`
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar esta conta Google? Os e-mails já sincronizados serão preservados.'))
      return;
    setWorking(true);
    try {
      await api.delete(`/integrations/gmail/${companyId}`);
      setMessage('Conta Google desconectada.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  if (loading)
    return (
      <section className="detail-panel">
        <div className="app-loader compact-loader">
          <span className="spinner" />
          Carregando integração...
        </div>
      </section>
    );

  if (!status) {
    return (
      <section className="detail-panel gmail-integration-panel">
        <div className="integration-heading">
          <span className="integration-icon">
            <Mail size={22} />
          </span>
          <div>
            <strong>Gmail</strong>
            <small>Google OAuth 2.0 + Gmail API</small>
          </div>
        </div>
        <div className="alert alert-error">
          {error || 'Não foi possível consultar a configuração do Gmail no servidor.'}
        </div>
      </section>
    );
  }

  if (!status.configured) {
    return (
      <section className="detail-panel gmail-integration-panel">
        <div className="integration-heading">
          <span className="integration-icon">
            <Mail size={22} />
          </span>
          <div>
            <strong>Gmail</strong>
            <small>Google OAuth 2.0 + Gmail API</small>
          </div>
        </div>
        <div className="integration-warning">
          <WifiOff size={20} />
          <div>
            <strong>Gmail ainda não configurado no servidor</strong>
            <p>Configure as variáveis do Google no Render.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="detail-panel gmail-integration-panel">
      <div className="integration-heading">
        <span className="integration-icon">
          <Mail size={22} />
        </span>
        <div>
          <strong>Gmail</strong>
          <small>Somente leitura. A senha da conta Google nunca é solicitada pelo LicitaGestão.</small>
        </div>
        <span className={`integration-state ${status.connected ? 'connected' : 'disconnected'}`}>
          {status.connected ? 'Conectado' : 'Não conectado'}
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {!status.connected ? (
        <div className="gmail-approval-flow">
          <div className="integration-empty">
            <Mail size={36} />
            <div>
              <strong>Solicite autorização para o Gmail</strong>
              <p>
                Enquanto o aplicativo Google estiver em fase de testes, o administrador principal precisa
                incluir seu e-mail nos usuários de teste.
              </p>
            </div>
          </div>

          <div className="gmail-request-form">
            <label>
              E-mail Google que será conectado
              <input
                type="email"
                value={requestedEmail}
                onChange={(e) => setRequestedEmail(e.target.value)}
                placeholder="conta@gmail.com"
              />
            </label>
            <button
              className="secondary-button"
              onClick={() => void requestAuthorization()}
              disabled={working || !requestedEmail.trim()}
            >
              <Send size={16} /> Solicitar autorização
            </button>
          </div>

          {request?.status === 'PENDING' && (
            <div className="integration-warning compact">
              <Clock3 size={18} />
              <div>
                <strong>Aguardando aprovação</strong>
                <p>{request.email} foi enviado ao administrador principal.</p>
              </div>
            </div>
          )}
          {request?.status === 'REJECTED' && (
            <div className="alert alert-error">
              Solicitação rejeitada{request.reviewNote ? `: ${request.reviewNote}` : '.'} Você pode enviar
              outra solicitação.
            </div>
          )}
          {request?.status === 'APPROVED' && (
            <div className="gmail-approved-box">
              <CheckCircle2 size={21} />
              <div>
                <strong>E-mail aprovado</strong>
                <p>{request.email} já pode ser conectado.</p>
              </div>
              <button className="primary-button" onClick={() => void connect()} disabled={working}>
                <Mail size={17} /> {working ? 'Abrindo Google...' : 'Conectar Gmail aprovado'}
              </button>
            </div>
          )}
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
            <div>
              <dt>Última sincronização</dt>
              <dd>{formatDateTime(status.lastSuccessfulSyncAt)}</dd>
            </div>
            <div>
              <dt>Verificação automática</dt>
              <dd>A cada {status.pollingIntervalSeconds} segundos</dd>
            </div>
          </dl>
          {status.lastError && (
            <div className="integration-warning compact">
              <WifiOff size={18} />
              <div>
                <strong>Última tentativa apresentou erro</strong>
                <p>{status.lastError}</p>
              </div>
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
