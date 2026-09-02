import { LockKeyhole, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage } from '../services/api';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-brand-logo">
          <img src={licitaGestaoLogo} alt="LicitaGestão" />
        </div>
        <div className="hero-copy">
          <span className="hero-kicker">Gestão de licitações</span>
          <h1>
            Controle simples.
            <br />
            Decisões seguras.
          </h1>
          <p>
            Organize empresas, usuários e, nas próximas fases, todo o fluxo das licitações em um único lugar.
          </p>
        </div>
        <small>Acesso interno e protegido</small>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-form-logo">
            <img src={licitaGestaoLogo} alt="LicitaGestão" />
          </div>
          <div>
            <span className="eyebrow">Bem-vindo</span>
            <h2>Entre na sua conta</h2>
            <p>Use as credenciais cadastradas pelo administrador.</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <label>
            E-mail
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="voce@empresa.com.br"
              />
            </div>
          </label>
          <label>
            Senha
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="current-password"
                placeholder="Sua senha"
              />
            </div>
          </label>
          <button className="primary-button large" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar no sistema'}
          </button>
        </form>
      </section>
    </div>
  );
}
