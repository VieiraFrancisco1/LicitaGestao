import { ArrowLeft, Building2, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { rawApi, errorMessage } from '../services/api';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';
import './password-reset.css';
import './access-flow.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await rawApi.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="password-recovery-page">
      <form className="password-recovery-card" onSubmit={submit}>
        <div className="password-recovery-logo">
          <img src={licitaGestaoLogo} alt="LicitaGestão" />
        </div>

        <div>
          <span className="eyebrow">Acesso principal da empresa</span>
          <h1>Esqueceu a senha?</h1>
          <p>
            Informe o e-mail principal cadastrado para a organização. O link enviado redefine somente a senha de
            entrada da empresa.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {sent ? (
          <div className="password-recovery-success">
            <strong>Verifique o e-mail da empresa</strong>
            <p>
              Se o endereço estiver cadastrado como acesso principal, enviaremos um link seguro e temporário para
              criar uma nova senha.
            </p>
          </div>
        ) : (
          <>
            <label>
              E-mail principal da organização
              <div className="input-with-icon">
                <Mail size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="empresa@exemplo.com.br"
                />
              </div>
            </label>

            <div className="organization-login-security">
              <Building2 size={17} />
              <span>Senhas individuais de funcionários continuam sendo administradas pelo administrador da empresa.</span>
            </div>

            <button className="primary-button large" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </>
        )}

        <Link className="password-recovery-back" to="/login">
          <ArrowLeft size={16} />
          Voltar para o login
        </Link>
      </form>
    </div>
  );
}
