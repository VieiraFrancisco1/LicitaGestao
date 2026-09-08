import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import { useState } from 'react';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { MegaAccountPanel } from '../components/MegaAccountPanel';
import { useAuth } from '../contexts/AuthContext';
import './settings.css';

const roleLabels = {
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Funcionário',
  EMPRESA: 'Empresa'
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeZone: 'America/Fortaleza'
  }).format(new Date(value));
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  if (!user) return <div className="empty-state">Não foi possível carregar os dados da conta.</div>;

  const associatedCompanies =
    user.role === 'EMPRESA'
      ? user.company
        ? [{ ...user.company, active: true }]
        : []
      : user.assignedCompanies;

  return (
    <div className="page-stack settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Conta e privacidade</span>
          <h2>Configurações</h2>
          <p>Consulte seus dados, empresas vinculadas e orientações de segurança e privacidade.</p>
        </div>
      </div>

      <section className="settings-summary">
        <span className="settings-summary-icon">
          <ShieldCheck size={26} />
        </span>
        <div>
          <strong>Conta protegida e acesso controlado</strong>
          <p>
            O LicitaGestão utiliza perfis de acesso e vínculos com empresas para limitar o que cada usuário pode
            visualizar e alterar.
          </p>
        </div>
        <span className={`settings-status ${user.active ? 'is-active' : 'is-inactive'}`}>
          {user.active ? 'Conta ativa' : 'Conta inativa'}
        </span>
      </section>

      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-header">
            <span>
              <UserRound size={21} />
            </span>
            <div>
              <h3>Minha conta</h3>
              <p>Informações utilizadas para identificar seu acesso ao sistema.</p>
            </div>
          </div>

          <div className="settings-detail-list">
            <div className="settings-detail-row">
              <UserRound size={18} />
              <div>
                <small>Nome</small>
                <strong>{user.name}</strong>
              </div>
            </div>
            <div className="settings-detail-row">
              <Mail size={18} />
              <div>
                <small>E-mail</small>
                <strong>{user.email}</strong>
              </div>
            </div>
            <div className="settings-detail-row">
              <ShieldCheck size={18} />
              <div>
                <small>Perfil de acesso</small>
                <strong>{roleLabels[user.role]}</strong>
              </div>
            </div>
            <div className="settings-detail-row">
              <CalendarDays size={18} />
              <div>
                <small>Conta criada em</small>
                <strong>{formatDate(user.createdAt)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <span>
              <Building2 size={21} />
            </span>
            <div>
              <h3>Empresas associadas</h3>
              <p>Empresas relacionadas ao seu acesso atual.</p>
            </div>
          </div>

          {user.role === 'ADMIN' && associatedCompanies.length === 0 ? (
            <div className="settings-inline-note">
              <ShieldCheck size={19} />
              <div>
                <strong>Acesso administrativo</strong>
                <p>Seu perfil possui visão geral conforme as permissões administrativas do sistema.</p>
              </div>
            </div>
          ) : associatedCompanies.length > 0 ? (
            <div className="settings-company-list">
              {associatedCompanies.map((company) => (
                <article key={company.id} className="settings-company-item">
                  <span className="settings-company-icon">
                    <Building2 size={18} />
                  </span>
                  <div>
                    <strong>{company.tradeName || company.legalName}</strong>
                    {company.tradeName && <small>{company.legalName}</small>}
                  </div>
                  <span className={`settings-company-status ${company.active ? 'is-active' : 'is-inactive'}`}>
                    {company.active ? 'Ativa' : 'Inativa'}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="settings-empty-company">Nenhuma empresa associada foi encontrada para esta conta.</div>
          )}
        </section>

        <section className="settings-card settings-card-wide">
          <div className="settings-card-header settings-card-header-action">
            <span>
              <LockKeyhole size={21} />
            </span>
            <div>
              <h3>Segurança da conta</h3>
              <p>Cuidados simples para reduzir o risco de acesso indevido.</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => setPasswordModalOpen(true)}>
              <KeyRound size={17} />
              Alterar minha senha
            </button>
          </div>

          <div className="settings-guidance-grid">
            <div className="settings-guidance-item">
              <CheckCircle2 size={18} />
              <div>
                <strong>Use uma senha exclusiva</strong>
                <p>A nova senha deve ter pelo menos 12 caracteres e não deve ser reutilizada em outros serviços.</p>
              </div>
            </div>
            <div className="settings-guidance-item">
              <CheckCircle2 size={18} />
              <div>
                <strong>Não compartilhe sua conta</strong>
                <p>Cada pessoa deve utilizar seu próprio usuário para manter permissões e auditoria confiáveis.</p>
              </div>
            </div>
            <div className="settings-guidance-item">
              <CheckCircle2 size={18} />
              <div>
                <strong>Revise seus vínculos</strong>
                <p>Se sua função mudar, confirme se as empresas associadas e o perfil de acesso continuam corretos.</p>
              </div>
            </div>
          </div>

          <p className="settings-security-footnote">
            Ao alterar a senha, sua sessão é encerrada e será necessário entrar novamente no sistema.
          </p>
        </section>

        <MegaAccountPanel />

        <section className="settings-card">
          <div className="settings-card-header">
            <span>
              <ShieldCheck size={21} />
            </span>
            <div>
              <h3>Privacidade e tratamento de dados</h3>
              <p>Resumo prático de como os dados são usados dentro do LicitaGestão.</p>
            </div>
          </div>

          <div className="settings-copy-list">
            <p>
              O sistema utiliza dados de conta, empresas, licitações, documentos, prazos e mensagens relacionadas ao
              trabalho para executar suas funcionalidades de gestão.
            </p>
            <p>
              O acesso às informações deve respeitar o perfil do usuário e, quando aplicável, as empresas às quais ele
              está associado.
            </p>
            <p>
              Integrações externas, como armazenamento de documentos e contas de e-mail, são utilizadas apenas quando
              configuradas para as funções do sistema.
            </p>
          </div>

          <div className="settings-lgpd-note">
            <ShieldCheck size={18} />
            <p>
              Esta área organiza transparência e controles já existentes, mas não representa certificação nem garante,
              sozinha, conformidade integral com a LGPD.
            </p>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <span>
              <Database size={21} />
            </span>
            <div>
              <h3>Retenção e exclusão de dados</h3>
              <p>Critérios que a organização deve definir para o ciclo de vida das informações.</p>
            </div>
          </div>

          <div className="settings-copy-list">
            <p>
              Nesta versão, o LicitaGestão não executa exclusão automática de registros apenas porque determinado prazo
              de tempo foi atingido.
            </p>
            <p>
              Antes de excluir informações, a organização deve considerar a finalidade do dado, obrigações aplicáveis,
              necessidade de auditoria e possibilidade de recuperação por backup.
            </p>
            <p>
              Os backups administrativos são voltados à recuperação do sistema e não incluem senhas, sessões nem
              credenciais das integrações externas.
            </p>
          </div>

          <div className="settings-retention-action">
            <Database size={18} />
            <div>
              <strong>Próximo passo organizacional</strong>
              <p>Definir e documentar internamente prazos de retenção e responsáveis por pedidos de correção ou exclusão.</p>
            </div>
          </div>
        </section>
      </div>

      {passwordModalOpen && (
        <ChangePasswordModal
          onClose={() => setPasswordModalOpen(false)}
          onPasswordChanged={() => {
            setPasswordModalOpen(false);
            void logout();
          }}
        />
      )}
    </div>
  );
}
