import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { rawApi, errorMessage } from '../services/api';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';
import './password-reset.css';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      navigate('/login?senha=alterada', { replace: true });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [navigate, success]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Este link não possui um token válido. Solicite uma nova recuperação de senha.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não confere.');
      return;
    }

    setSubmitting(true);
    try {
      await rawApi.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword
      });
      setSuccess(true);
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
          <span className="eyebrow">Nova senha</span>
          <h1>Redefinir senha</h1>
          <p>Crie uma nova senha com pelo menos 12 caracteres.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {success ? (
          <div className="password-recovery-success">
            <strong>Senha alterada com sucesso</strong>
            <p>Você será levado automaticamente de volta para a tela de login.</p>
          </div>
        ) : (
          <>
            <label>
              Nova senha
              <div className="input-with-icon">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Mínimo de 12 caracteres"
                />
              </div>
            </label>

            <label>
              Confirmar nova senha
              <div className="input-with-icon">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                />
              </div>
            </label>

            <button className="primary-button large" disabled={submitting || !token}>
              {submitting ? 'Alterando...' : 'Alterar senha'}
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
