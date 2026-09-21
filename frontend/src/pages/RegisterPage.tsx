import { Building2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AccessShowcaseCarousel } from '../components/AccessShowcaseCarousel';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage, rawApi } from '../services/api';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';
import './access-flow.css';

export function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await rawApi.post<{ success: true; data: { id: string; name: string; loginEmail: string; paymentRequired: boolean; billingToken: string } }>('/auth/register', {
        organizationName,
        adminName,
        email,
        password,
        confirmPassword
      });
      window.sessionStorage.setItem('licitagestao.billing-token', response.data.data.billingToken);
      navigate('/pagamento', { replace: true }); // LICITAGESTAO_BILLING_ORDERS_API_V2_REGISTER
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page organization-login-page auth-showcase-page">
      <AccessShowcaseCarousel />

      <section className="login-panel">
        <form className="login-card organization-access-card register-card" onSubmit={submit}>
          <div className="login-form-logo">
            <img src={licitaGestaoLogo} alt="LicitaGestão" />
          </div>
          <div>
            <span className="eyebrow">Criar conta</span>
            <h2>Nova organização</h2>
            <p>O primeiro usuário será o administrador. O acesso será liberado automaticamente após a confirmação do pagamento.</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}

          <label>
            Nome da organização
            <div className="input-with-icon">
              <Building2 size={18} />
              <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required minLength={3} />
            </div>
          </label>
          <label>
            Nome do administrador
            <div className="input-with-icon">
              <UserRound size={18} />
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} required minLength={2} />
            </div>
          </label>
          <label>
            E-mail principal
            <div className="input-with-icon">
              <Mail size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </label>
          <label>
            Senha
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
            </div>
          </label>
          <label>
            Confirmar senha
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={12} />
            </div>
          </label>

          <button className="primary-button large" disabled={submitting}>
            {submitting ? 'Criando conta...' : 'Criar minha conta'}
          </button>
          <div className="register-login-link">
            Já possui conta? <Link to="/login">Entrar</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
