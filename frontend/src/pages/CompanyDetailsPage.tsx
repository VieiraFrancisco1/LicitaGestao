import { ArrowLeft, Building2, Gavel, Percent, RadioTower } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { TendersPage } from './TendersPage';
import { CompanyDiscountsPanel } from './CompanyDiscountsPanel';
import { GmailIntegrationPanel } from '../components/GmailIntegrationPanel';
import { OutlookIntegrationPanel } from '../components/OutlookIntegrationPanel';
import { CompanyConvocationsPanel } from '../components/CompanyConvocationsPanel';
import { api, errorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { ApiResponse, BidProgress, Company } from '../types';
import { formatDate, optionLabel, progressOptions } from '../utils/bid';

type Tab = 'overview' | 'bids' | 'platforms' | 'discounts' | 'integrations' | 'convocations';

type PlatformGroup = {
  id: string;
  name: string;
  site: string | null;
  bids: Array<{
    id: string;
    progress: BidProgress;
    tender: {
      noticeNumber: string | null;
      municipality: string;
      sessionDate: string;
    };
  }>;
};

export function CompanyDetailsPage() {
  const { id } = useParams();
  const { user, setActiveCompanyId } = useAuth();
  const [searchParams] = useSearchParams();
  const [company, setCompany] = useState<Company | null>(null);
  const requestedTab = searchParams.get('tab');
  const initialTab: Tab =
    requestedTab === 'integrations' || requestedTab === 'convocations' ? requestedTab : 'overview';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [platforms, setPlatforms] = useState<PlatformGroup[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApiResponse<Company>>(`/companies/${id}`);
      setCompany(response.data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    const timer = window.setTimeout(() => {
      if (nextTab === 'integrations' || nextTab === 'convocations') setTab(nextTab);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (tab !== 'platforms') return;
    const timer = window.setTimeout(() => {
      void api
        .get<ApiResponse<PlatformGroup[]>>(`/companies/${id}/platforms`)
        .then((response) => setPlatforms(response.data.data))
        .catch((err) => setError(errorMessage(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, id]);

  if (loading) {
    return (
      <div className="app-loader">
        <span className="spinner" />
        Carregando empresa...
      </div>
    );
  }

  if (!company) return <div className="alert alert-error">{error || 'Empresa não encontrada'}</div>;

  const employeeCompanies =
    user?.role === 'FUNCIONARIO' ? user.assignedCompanies.filter((item) => item.active) : [];

  return (
    <div className="page-stack">
      {employeeCompanies.length > 1 && (
        <div className="employee-company-switcher" aria-label="Empresas vinculadas">
          {employeeCompanies.map((item) => (
            <Link
              key={item.id}
              className={item.id === company.id ? 'active' : ''}
              to={`/empresas/${item.id}`}
              onClick={() => setActiveCompanyId(item.id)}
            >
              {item.tradeName || item.legalName}
            </Link>
          ))}
        </div>
      )}

      <div className="details-header company-header">
        <div>
          <Link className="back-link" to="/empresas">
            <ArrowLeft size={16} />
            Empresas
          </Link>
          <span className="eyebrow">Área da empresa</span>
          <h2>{company.tradeName || company.legalName}</h2>
          <p>{company.legalName} · {formatCnpj(company.cnpj)}</p>
        </div>
        <span className={`status-pill ${company.active ? 'active' : 'inactive'}`}>
          {company.active ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs company-tabs">
        {(
          [
            ['overview', 'Visão geral'],
            ['bids', 'Licitações'],
            ['platforms', 'Plataformas'],
            ['discounts', 'Baixas'],
            ['integrations', 'Integrações'],
            ['convocations', 'Avisos por e-mail']
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="details-grid">
          <CompanyStat icon={<Gavel />} label="Licitações" value={company._count?.bids ?? 0} />
          <CompanyStat icon={<Percent />} label="Baixas" value="Cálculo por licitação" />
          <CompanyStat icon={<Building2 />} label="Usuários da empresa" value={company._count?.users ?? 0} />
          <CompanyStat
            icon={<Building2 />}
            label="Funcionários responsáveis"
            value={company._count?.staffLinks ?? 0}
          />
          <section className="detail-panel full-width">
            <dl className="data-list">
              <div>
                <dt>E-mail</dt>
                <dd>{company.email || '—'}</dd>
              </div>
              <div>
                <dt>Telefone</dt>
                <dd>{company.phone || '—'}</dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{company.contactName || '—'}</dd>
              </div>
              <div className="full">
                <dt>Observações</dt>
                <dd>{company.observations || 'Nenhuma observação.'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {tab === 'bids' && <TendersPage fixedCompanyId={company.id} embedded />}

      {tab === 'platforms' && (
        <section className="platform-grid company-platforms">
          {platforms.length === 0 && (
            <div className="empty-state compact">
              <RadioTower size={28} />
              <p>Nenhuma licitação ativa vinculada a uma plataforma.</p>
            </div>
          )}
          {platforms.map((platform) => (
            <article key={platform.id}>
              <div className="platform-icon">
                <RadioTower />
              </div>
              <div>
                <strong>{platform.name}</strong>
                <small>{platform.bids.length} participações em andamento</small>
                {platform.bids.map((bid) => (
                  <Link key={bid.id} to={`/participacoes/${bid.id}`}>
                    {bid.tender.municipality} · {formatDate(bid.tender.sessionDate)} ·{' '}
                    {optionLabel(progressOptions, bid.progress)}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'discounts' && <CompanyDiscountsPanel companyId={company.id} />}

      {tab === 'integrations' && (
        <div className="page-stack">
          <GmailIntegrationPanel companyId={company.id} />
          <OutlookIntegrationPanel companyId={company.id} />
        </div>
      )}

      {tab === 'convocations' && <CompanyConvocationsPanel companyId={company.id} />}
    </div>
  );
}

function CompanyStat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <article className="detail-stat company-stat">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function formatCnpj(value: string) {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
