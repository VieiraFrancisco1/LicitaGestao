import { Cloud, HardDrive, Link2, Mail, RefreshCw, ShieldCheck, Unlink } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../services/api';
import type { ApiResponse, MegaStatus } from '../types';
import { formatBytes } from '../utils/bid';
import './MegaAccountPanel.css';

function formatDateTime(value: string | null) {
  if (!value) return 'Ainda não sincronizada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function MegaAccountPanel() {
  const [status, setStatus] = useState<MegaStatus | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<MegaStatus>>('/mega/status');
      setStatus(response.data.data);
      if (response.data.data.email) setEmail(response.data.data.email);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post<ApiResponse<MegaStatus>>('/mega/account/connect', { email, password });
      setStatus(response.data.data);
      setPassword('');
      setMessage('Conta do MEGA conectada somente ao seu usuário.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post<ApiResponse<MegaStatus>>('/mega/account/sync');
      setStatus(response.data.data);
      setMessage('Sincronização do MEGA concluída.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (
      !window.confirm(
        'Desconectar sua conta do MEGA? Os arquivos não serão apagados. Documentos enviados por esta conta podem ficar indisponíveis até a conta original ser reconectada.'
      )
    ) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.delete('/mega/account');
      await load();
      setEmail('');
      setPassword('');
      setMessage('Conta do MEGA desconectada deste usuário.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-card settings-card-wide">
      <div className="settings-card-header">
        <span><Cloud size={21} /></span>
        <div>
          <h3>Minha conta MEGA</h3>
          <p>Cada usuário conecta sua própria conta. As credenciais não são compartilhadas com outros usuários.</p>
        </div>
      </div>

      {loading && <div className="mega-account-loading"><span className="spinner" />Verificando sua conta MEGA...</div>}

      {!loading && status && !status.serverConfigured && (
        <div className="settings-lgpd-note">
          <ShieldCheck size={18} />
          <p>A integração individual do MEGA ainda precisa ser habilitada no servidor pelo administrador do LicitaGestão.</p>
        </div>
      )}

      {!loading && status?.serverConfigured && status.configured && (
        <div className="mega-account-connected">
          <div className="mega-account-summary">
            <span className="mega-account-cloud"><Cloud size={22} /></span>
            <div>
              <small>Conta vinculada a este usuário</small>
              <strong>{status.email || status.accountName || 'Conta MEGA'}</strong>
              <span>Última verificação: {formatDateTime(status.lastVerifiedAt)}</span>
            </div>
            <span className={`mega-account-state ${status.connected ? 'is-active' : 'is-error'}`}>
              {status.connected ? 'Conectada' : 'Atenção'}
            </span>
          </div>

          <div className="mega-account-details">
            <div>
              <HardDrive size={17} />
              <span><small>Pasta inicial</small><strong>{status.rootFolder || 'Cloud Drive'}</strong></span>
            </div>
            <div>
              <HardDrive size={17} />
              <span>
                <small>Armazenamento</small>
                <strong>
                  {status.spaceUsed != null && status.spaceTotal != null
                    ? `${formatBytes(status.spaceUsed)} de ${formatBytes(status.spaceTotal)}`
                    : 'Informação não disponível'}
                </strong>
              </span>
            </div>
          </div>

          {status.lastError && <div className="alert alert-error">{status.lastError}</div>}

          <div className="mega-account-actions">
            <button className="secondary-button" type="button" onClick={() => void sync()} disabled={busy}>
              <RefreshCw size={16} />{busy ? 'Sincronizando...' : 'Sincronizar agora'}
            </button>
            <button className="mega-disconnect-button" type="button" onClick={() => void disconnect()} disabled={busy}>
              <Unlink size={16} />Desconectar conta
            </button>
          </div>
        </div>
      )}

      {!loading && status?.serverConfigured && !status.configured && (
        <form className="mega-account-form" onSubmit={connect}>
          <div className="mega-account-security-note">
            <ShieldCheck size={18} />
            <p>A senha do MEGA é criptografada antes de ser salva. Outros usuários da organização não conseguem usar esta conta.</p>
          </div>

          <div className="mega-account-fields">
            <label>
              E-mail do MEGA
              <div className="input-with-icon">
                <Mail size={18} />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" placeholder="seu-email@exemplo.com" />
              </div>
            </label>
            <label>
              Senha do MEGA
              <div className="input-with-icon">
                <Link2 size={18} />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={1} autoComplete="current-password" placeholder="Senha da sua conta MEGA" />
              </div>
            </label>
          </div>

          <button className="primary-button" disabled={busy}>
            <Cloud size={17} />{busy ? 'Conectando...' : 'Conectar minha conta MEGA'}
          </button>
        </form>
      )}

      {(error || message) && (
        <div className="mega-account-feedback">
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}
        </div>
      )}
    </section>
  );
}
