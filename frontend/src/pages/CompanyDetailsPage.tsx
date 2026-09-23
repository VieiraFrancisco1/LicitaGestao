import { Building2, Gavel, Percent, RadioTower } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { TendersPage } from './TendersPage';
import { CompanyDiscountsPanel } from './CompanyDiscountsPanel';
import { GmailIntegrationPanel } from '../components/GmailIntegrationPanel';
import { OutlookIntegrationPanel } from '../components/OutlookIntegrationPanel';
import { CompanyConvocationsPanel } from '../components/CompanyConvocationsPanel';
import { CompanyBrandMark } from '../components/CompanyBrand';
import { api, errorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { ApiResponse, BidProgress, Company } from '../types';
import { formatDate, optionLabel, progressOptions } from '../utils/bid';
import dashboardHeroBg from '../assets/dashboard-hero-bg.png';
import bannerAgf from '../assets/company-banners/agf.png';
import bannerAmaro from '../assets/company-banners/amaro.png';
import bannerEgr from '../assets/company-banners/egr.png';
import bannerEqv from '../assets/company-banners/eqv.png';
import bannerIcv from '../assets/company-banners/icv.png';
import bannerLm from '../assets/company-banners/lm.png';
import bannerRb from '../assets/company-banners/rb.png';
import bannerRecanto from '../assets/company-banners/recanto.png';
import bannerSecon from '../assets/company-banners/secon.png';
import bannerSerfi from '../assets/company-banners/serfi.png';
import bannerVertical from '../assets/company-banners/vertical.png';
import bannerWhipec from '../assets/company-banners/whipec.png';

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

const normalizeCompanyBannerName = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const companyBannerMatches = (name: string, ...aliases: string[]) =>
  aliases.some(
    (alias) =>
      name === alias ||
      name.startsWith(`${alias} `) ||
      name.includes(` ${alias} `) ||
      name.endsWith(` ${alias}`)
  );

const resolveCompanyBanner = (value?: string | null) => {
  const name = normalizeCompanyBannerName(value);

  if (companyBannerMatches(name, 'AGF')) return bannerAgf;
  if (companyBannerMatches(name, 'AMARO', 'AMARO ENGENHARIA', 'AMARO ENGENHARIA LTDA')) return bannerAmaro;
  if (companyBannerMatches(name, 'EG&R', 'EGR', 'EG R', 'EG & R')) return bannerEgr;
  if (companyBannerMatches(name, 'EQV', 'EQV EMPREENDIMENTOS')) return bannerEqv;
  if (companyBannerMatches(name, 'ICV', 'I C V', 'ICV CONSTRUCAO CIVIL')) return bannerIcv;
  if (companyBannerMatches(name, 'LM', 'LM CONSTRUCOES', 'LM CONSTRUCOES & SERVICOS')) return bannerLm;
  if (companyBannerMatches(name, 'RB', 'RB EMPREENDIMENTOS')) return bannerRb;
  if (companyBannerMatches(name, 'RECANTO', 'CONSTRUTORA RECANTO', 'RECANTO CONSTRUTORA')) return bannerRecanto;
  if (companyBannerMatches(name, 'SECON', 'SECON SERVICOS & CONSTRUCOES')) return bannerSecon;
  if (companyBannerMatches(name, 'SERFI', 'SERFI CONSTRUTORA')) return bannerSerfi;
  if (companyBannerMatches(name, 'VERTICAL', 'VERTICAL ENGENHARIA', 'VERTICAL ENGENHARIA E SERVICOS')) return bannerVertical;
  if (companyBannerMatches(name, 'WHIPEC', 'WHIPEC EMPREENDIMENTOS')) return bannerWhipec;

  return undefined;
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
  const companyBanner = resolveCompanyBanner(company.tradeName || company.legalName);

  return (
    <div className="page-stack">
      {employeeCompanies.length > 1 && (
        <div className="employee-company-switcher tender-company-tabs" aria-label="Empresas vinculadas">
          {employeeCompanies.map((item) => (
            <Link
              key={item.id}
              className={item.id === company.id ? 'active' : ''}
              to={`/empresas/${item.id}`}
              onClick={() => setActiveCompanyId(item.id)}
            >
              <CompanyBrandMark companyName={item.tradeName || item.legalName} size={34} />
              <span>{(item.tradeName || item.legalName).toLocaleUpperCase('pt-BR')}</span>
            </Link>
          ))}
        </div>
      )}

      <div
        className="details-header company-header dashboard-hero"
        style={{
          backgroundImage: companyBanner
            ? `url(${companyBanner})`
            : `linear-gradient(90deg, rgba(7, 47, 129, 0.92), rgba(9, 58, 157, 0.86)), url(${dashboardHeroBg})`
        }}
      >
        <div>

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
            label="Usuários responsáveis"
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
