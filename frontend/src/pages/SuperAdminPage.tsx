import { Building2, Check, Mail, RefreshCw, Shield, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

export function SuperAdminPage() {
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

  return (
    <div className="page-stack">
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

      <div className="super-admin-summary">
        <article><Building2 /><small>Organizações</small><strong>{overview?.totals.organizations ?? 0}</strong></article>
        <article><Shield /><small>Ativas</small><strong>{overview?.totals.activeOrganizations ?? 0}</strong></article>
        <article><Mail /><small>Gmail pendentes</small><strong>{overview?.totals.pendingGmailRequests ?? 0}</strong></article>
      </div>

      <section className="table-card">
        <div className="panel-heading">
          <div><span className="eyebrow">Clientes</span><h3>Organizações cadastradas</h3></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Organização</th><th>Usuários</th><th>Empresas</th><th>Licitações</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>
              {overview?.organizations.map((organization) => (
                <tr key={organization.id}>
                  <td><strong>{organization.name}</strong><small>{organization.loginEmail}</small></td>
                  <td>{organization._count.users}</td>
                  <td>{organization._count.companies}</td>
                  <td>{organization._count.tenders}</td>
                  <td><span className={`status-pill ${organization.active ? 'active' : 'inactive'}`}>{organization.active ? 'Ativa' : 'Suspensa'}</span></td>
                  <td>
                    <button
                      className={organization.active ? 'danger-button' : 'secondary-button'}
                      disabled={working === organization.id}
                      onClick={() => void toggleOrganization(organization.id, !organization.active)}
                    >
                      {organization.active ? 'Suspender' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-card">
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

      <section className="detail-panel">
        <div className="panel-heading">
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
