import { Building2, Check, CircleDollarSign, Mail, RefreshCw, Shield, Trash2, UserX, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, errorMessage } from '../services/api';
import type {
  ApiResponse,
  GmailAccessRequest,
  GmailAccessRequestStatus,
  PlatformOverview,
  SupportSettings
} from '../types';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

const subscriptionLabel = (status: PlatformOverview['organizations'][number]['subscriptionStatus']) =>
  status === 'ACTIVE' ? 'Ativa' : status === 'EXPIRED' ? 'Vencida' : status === 'SUSPENDED' ? 'Suspensa' : 'Aguardando pagamento'; // LICITAGESTAO_BILLING_ORDERS_API_V2_SUPERADMIN

const subscriptionPlanLabel = (plan: PlatformOverview['organizations'][number]['subscriptionPlan']) =>
  plan === 'MONTHLY' ? 'Mensal' : plan === 'QUARTERLY' ? '3 meses' : plan === 'SEMIANNUAL' ? '6 meses' : 'Sem plano';

export function SuperAdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [requests, setRequests] = useState<GmailAccessRequest[]>([]);
  const [filter, setFilter] = useState<GmailAccessRequestStatus | ''>('PENDING');
  const [support, setSupport] = useState<SupportSettings | null>(null);
  const [supportName, setSupportName] = useState('Francisco');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [overviewResponse, requestsResponse, supportResponse] = await Promise.all([
        api.get<ApiResponse<PlatformOverview>>('/platform-admin/overview'),
        api.get<ApiResponse<GmailAccessRequest[]>>('/platform-admin/gmail-requests', {
          params: { status: filter || undefined }
        }),
        api.get<ApiResponse<SupportSettings>>('/platform-admin/support')
      ]);
      setOverview(overviewResponse.data.data);
      setRequests(requestsResponse.data.data);
      setSupport(supportResponse.data.data);
      setSupportName(supportResponse.data.data.supportName);
      setSupportWhatsapp(supportResponse.data.data.supportWhatsapp ?? '');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const review = async (request: GmailAccessRequest, status: 'APPROVED' | 'REJECTED') => {
    const note =
      status === 'REJECTED'
        ? window.prompt('Motivo da rejeição (opcional):')?.trim() || null
        : null;
    setWorking(request.id);
    try {
      await api.patch(`/platform-admin/gmail-requests/${request.id}`, { status, note });
      setSuccess(status === 'APPROVED' ? 'Solicitação aprovada. O cliente foi notificado.' : 'Solicitação rejeitada.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking('');
    }
  };

  const toggleOrganization = async (id: string, active: boolean) => {
    setWorking(id);
    try {
      await api.patch(`/platform-admin/organizations/${id}/status`, { active });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking('');
    }
  };

  const deleteOrganization = async (
    organization: PlatformOverview['organizations'][number]
  ) => {
    if (organization.id === user?.organizationId) return;

    const confirmation = window.prompt(
      `Esta ação apaga definitivamente a organização "${organization.name}" e todos os dados dela.\n\nPara confirmar, digite o e-mail principal:\n${organization.loginEmail}`
    );

    if (!confirmation) return;

    setWorking(`delete:${organization.id}`);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/platform-admin/organizations/${organization.id}`, {
        data: { confirmation: confirmation.trim() }
      });
      setSuccess(`Organização "${organization.name}" apagada definitivamente.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking('');
    }
  };

  const saveSupport = async (event: FormEvent) => {
    event.preventDefault();
    setWorking('support');
    try {
      const response = await api.put<ApiResponse<SupportSettings>>('/platform-admin/support', {
        supportName,
        supportWhatsapp
      });
      setSupport(response.data.data);
      setSuccess('Contato de suporte atualizado.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking('');
    }
  };

  const suspendedOrganizations =
    overview?.organizations.filter((organization) => !organization.active).length ?? 0;
  const expiredSubscriptions =
    overview?.organizations.filter(
      (organization) => !organization.billingExempt && organization.subscriptionStatus === 'EXPIRED'
    ).length ?? 0;

  return (
    <div className="page-stack super-admin-page">
      <div className="page-heading">
        <div>
          <p>Proprietário da plataforma</p>
          <h2>Super Admin</h2>
          <span>Gerencie organizações clientes, autorizações do Gmail e contato de suporte.</span>
        </div>
        <button className="secondary-button" onClick={() => void load()}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="super-admin-summary super-admin-summary-expanded">
        <article>
          <span className="super-admin-summary-icon"><Building2 /></span>
          <div><small>Organizações</small><strong>{overview?.totals.organizations ?? 0}</strong></div>
        </article>
        <article>
          <span className="super-admin-summary-icon"><Shield /></span>
          <div><small>Contas ativas</small><strong>{overview?.totals.activeOrganizations ?? 0}</strong></div>
        </article>
        <article>
          <span className="super-admin-summary-icon danger"><UserX /></span>
          <div><small>Contas suspensas</small><strong>{suspendedOrganizations}</strong></div>
        </article>
        <article>
          <span className="super-admin-summary-icon warning"><Mail /></span>
          <div><small>Gmail pendentes</small><strong>{overview?.totals.pendingGmailRequests ?? 0}</strong></div>
        </article>
        <article>
          <span className="super-admin-summary-icon warning"><CircleDollarSign /></span>
          <div><small>Assinaturas vencidas</small><strong>{expiredSubscriptions}</strong></div>
        </article>
      </div>

      <nav className="super-admin-quick-nav" aria-label="Seções do Super Admin">
        <a href="#super-admin-clientes">Clientes</a>
        <a href="#super-admin-gmail">Solicitações Gmail</a>
        <a href="#super-admin-suporte">Suporte</a>
      </nav>

      <section id="super-admin-clientes" className="table-card super-admin-organizations-card">
        <div className="panel-heading super-admin-section-heading">
          <div>
            <span className="eyebrow">Clientes</span>
            <h3>Organizações cadastradas</h3>
            <p>
              Esta área gerencia as contas do SaaS. A aba Empresas continua mostrando somente
              as empresas vinculadas à organização da sua própria conta.
            </p>
          </div>
        </div>
        <div className="table-wrap super-admin-table-wrap">
          <table className="super-admin-organizations-table">
            <thead>
              <tr>
                <th>Organização</th>
                <th>Usuários</th>
                <th>Empresas</th>
                <th>Licitações</th>
                <th>Assinatura</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {overview?.organizations.map((organization) => (
                <tr key={organization.id}>
                  <td><strong>{organization.name}</strong><small>{organization.loginEmail}</small></td>
                  <td>{organization._count.users}</td>
                  <td>{organization._count.companies}</td>
                  <td>{organization._count.tenders}</td>
                  <td>
                    <div className="super-admin-subscription-cell">
                      {organization.billingExempt ? (
                        <span className="status-pill active">Isenta</span>
                      ) : (
                        <span className={`status-pill ${organization.subscriptionStatus === 'ACTIVE' ? 'active' : 'inactive'}`}>
                          {subscriptionLabel(organization.subscriptionStatus)}
                        </span>
                      )}
                      <small>{organization.billingExempt ? 'Sem cobrança' : subscriptionPlanLabel(organization.subscriptionPlan)}</small>
                      {organization.subscriptionExpiresAt && (
                        <small>até {new Intl.DateTimeFormat('pt-BR').format(new Date(organization.subscriptionExpiresAt))}</small>
                      )}
                    </div>
                  </td>
                  <td><span className={`status-pill ${organization.active ? 'active' : 'inactive'}`}>{organization.active ? 'Ativa' : 'Suspensa'}</span></td>
                  <td>
                    <div className="super-admin-organization-actions">
                      <button
                        className={organization.active ? 'danger-button compact' : 'secondary-button compact'}
                        disabled={working === organization.id}
                        onClick={() => void toggleOrganization(organization.id, !organization.active)}
                      >
                        {organization.active ? 'Suspender' : 'Ativar'}
                      </button>
                      <button
                        className="danger-button compact super-admin-delete-button"
                        disabled={
                          organization.id === user?.organizationId ||
                          working === `delete:${organization.id}`
                        }
                        title={
                          organization.id === user?.organizationId
                            ? 'A organização do SUPER_ADMIN não pode ser apagada'
                            : 'Apagar organização e todos os dados'
                        }
                        onClick={() => void deleteOrganization(organization)}
                      >
                        <Trash2 size={14} />
                        Apagar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="super-admin-gmail" className="table-card super-admin-gmail-card">
        <div className="panel-heading super-admin-request-heading">
          <div>
            <span className="eyebrow">Google OAuth em teste</span>
            <h3>Solicitações de autorização do Gmail</h3>
            <p>Adicione manualmente o e-mail em “Test users” no Google Cloud e depois clique em Aprovar.</p>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value as GmailAccessRequestStatus | '')}>
            <option value="">Todas</option>
            <option value="PENDING">Pendentes</option>
            <option value="APPROVED">Aprovadas</option>
            <option value="REJECTED">Rejeitadas</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>E-mail</th><th>Organização / empresa</th><th>Solicitado por</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {requests.length === 0 && <tr><td colSpan={6} className="table-message">Nenhuma solicitação neste filtro.</td></tr>}
              {requests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{request.email}</strong></td>
                  <td><strong>{request.organization?.name}</strong><small>{request.company?.tradeName || request.company?.legalName}</small></td>
                  <td>{request.requestedBy?.name}<small>{request.requestedBy?.email}</small></td>
                  <td>{formatDate(request.requestedAt)}</td>
                  <td><span className={`status-pill ${request.status === 'APPROVED' ? 'active' : request.status === 'REJECTED' ? 'inactive' : ''}`}>{request.status === 'PENDING' ? 'Pendente' : request.status === 'APPROVED' ? 'Aprovada' : 'Rejeitada'}</span></td>
                  <td>
                    {request.status === 'PENDING' ? (
                      <div className="row-actions">
                        <button className="primary-button compact" disabled={working === request.id} onClick={() => void review(request, 'APPROVED')}><Check size={15} /> Aprovar</button>
                        <button className="danger-button compact" disabled={working === request.id} onClick={() => void review(request, 'REJECTED')}><X size={15} /> Rejeitar</button>
                      </div>
                    ) : request.reviewNote ? <small>{request.reviewNote}</small> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="super-admin-suporte" className="detail-panel super-admin-support-card">
        <div className="panel-heading super-admin-section-heading">
          <div><span className="eyebrow">Ajuda</span><h3>Contato de suporte</h3><p>Este contato aparece na aba Ajuda de todos os clientes.</p></div>
        </div>
        <form className="support-settings-form" onSubmit={saveSupport}>
          <label>Nome do suporte<input value={supportName} onChange={(e) => setSupportName(e.target.value)} required /></label>
          <label>WhatsApp com DDD<input value={supportWhatsapp} onChange={(e) => setSupportWhatsapp(e.target.value)} placeholder="Ex.: 5588999999999" /></label>
          <button className="primary-button" disabled={working === 'support'}>{working === 'support' ? 'Salvando...' : 'Salvar contato'}</button>
        </form>
        {support?.supportWhatsapp && <small>WhatsApp atual: {support.supportWhatsapp}</small>}
      </section>
    </div>
  );
}
