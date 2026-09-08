import {
  ArrowLeft,
  Building2,
  ChevronRight,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage } from '../services/api';
import type { OrganizationAccess, OrganizationMember, UserRole } from '../types';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';
import './access-flow.css';

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Funcionário',
  EMPRESA: 'Empresa'
};

export function LoginPage() {
  const { user, organizationLogin, memberLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [organizationAccess, setOrganizationAccess] = useState<OrganizationAccess | null>(null);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [email, setEmail] = useState('');
  const [organizationPassword, setOrganizationPassword] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const passwordChanged = searchParams.get('senha') === 'alterada';
  const sortedMembers = useMemo(() => organizationAccess?.members ?? [], [organizationAccess]);

  if (user) return <Navigate to="/" replace />;

  const submitOrganization = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const access = await organizationLogin(email, organizationPassword);
      setOrganizationAccess(access);
      setOrganizationPassword('');
      setSelectedMember(null);
      setMemberPassword('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const submitMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!organizationAccess || !selectedMember) return;
    setError('');
    setSubmitting(true);
    try {
      await memberLogin(organizationAccess.organizationToken, selectedMember.id, memberPassword);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const restartOrganizationLogin = () => {
    setOrganizationAccess(null);
    setSelectedMember(null);
    setMemberPassword('');
    setError('');
  };

  return (
    <div className="login-page organization-login-page">
      <section className="login-hero">
        <div className="hero-copy">
          <div className="login-brand-logo login-brand-hero">
            <img src={licitaGestaoLogo} alt="LicitaGestão" />
          </div>
          <span className="hero-kicker">Gestão de licitações</span>
          <h1>
            Controle simples.
            <br />
            Decisões seguras.
          </h1>
          <p>Centralize licitações, empresas, documentos, prazos e avisos em um único ambiente.</p>
        </div>
        <small>Acesso organizacional protegido</small>
      </section>

      <section className="login-panel">
        {!organizationAccess ? (
          <form className="login-card organization-access-card" onSubmit={submitOrganization}>
            <div className="login-form-logo">
              <img src={licitaGestaoLogo} alt="LicitaGestão" />
            </div>

            <div>
              <span className="eyebrow">Acesso da empresa</span>
              <h2>Entre na sua organização</h2>
              <p>Use o e-mail e a senha principal cadastrados para a sua empresa.</p>
            </div>

            {passwordChanged && (
              <div className="alert alert-success">Senha principal alterada. Entre com a nova senha.</div>
            )}
            {error && <div className="alert alert-error">{error}</div>}

            <label>
              E-mail principal
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

            <label>
              Senha da empresa
              <div className="input-with-icon">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={organizationPassword}
                  onChange={(event) => setOrganizationPassword(event.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="current-password"
                  placeholder="Senha principal"
                />
              </div>
            </label>

            <div className="organization-login-help">
              <Link to="/esqueci-senha">Esqueceu a senha principal?</Link>
            </div>

            <button className="primary-button large" disabled={submitting}>
              {submitting ? 'Validando...' : 'Continuar'}
              {!submitting && <ChevronRight size={18} />}
            </button>

            <div className="organization-login-security">
              <ShieldCheck size={17} />
              <span>Depois desta etapa, cada pessoa entra com sua própria senha.</span>
            </div>
          </form>
        ) : (
          <div className="login-card member-access-card">
            <div className="member-access-header">
              <button type="button" className="member-back-button" onClick={restartOrganizationLogin}>
                <ArrowLeft size={17} />
                Trocar empresa
              </button>
              <div className="member-organization-badge">
                <Building2 size={17} />
                <span>{organizationAccess.organization.name}</span>
              </div>
            </div>

            {!selectedMember ? (
              <>
                <div className="member-access-title">
                  <span className="eyebrow">Acesso individual</span>
                  <h2>Quem está acessando?</h2>
                  <p>Escolha seu usuário para continuar. As informações desta organização são compartilhadas conforme suas permissões.</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="member-grid">
                  {sortedMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="member-card"
                      onClick={() => {
                        setSelectedMember(member);
                        setMemberPassword('');
                        setError('');
                      }}
                    >
                      <span className="member-avatar">{member.name.charAt(0).toUpperCase()}</span>
                      <span className="member-card-copy">
                        <strong>{member.name}</strong>
                        <small>{roleLabels[member.role]}</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <form className="member-password-form" onSubmit={submitMember}>
                <button
                  type="button"
                  className="member-back-button member-back-inline"
                  onClick={() => {
                    setSelectedMember(null);
                    setMemberPassword('');
                    setError('');
                  }}
                >
                  <ArrowLeft size={17} />
                  Escolher outro usuário
                </button>

                <div className="selected-member-profile">
                  <span className="selected-member-avatar">
                    <UserRound size={26} />
                  </span>
                  <div>
                    <span className="eyebrow">Senha individual</span>
                    <h2>{selectedMember.name}</h2>
                    <p>{roleLabels[selectedMember.role]}</p>
                  </div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <label>
                  Sua senha
                  <div className="input-with-icon">
                    <LockKeyhole size={18} />
                    <input
                      type="password"
                      value={memberPassword}
                      onChange={(event) => setMemberPassword(event.target.value)}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="current-password"
                      autoFocus
                      placeholder="Digite sua senha"
                    />
                  </div>
                </label>

                <button className="primary-button large" disabled={submitting}>
                  {submitting ? 'Entrando...' : `Entrar como ${selectedMember.name.split(' ')[0]}`}
                </button>

                <p className="member-password-note">
                  Esqueceu sua senha individual? Solicite ao administrador da sua organização uma redefinição.
                </p>
              </form>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
