import {
  Bell,
  Activity,
  Building2,
  CalendarClock,
  ChevronDown,
  DatabaseBackup,
  FileBarChart,
  FileText,
  Gavel,
  LayoutDashboard,
  History,
  Menu,
  Search,
  Settings,
  Users,
  X
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DeadlineNotifications } from '../components/DeadlineNotifications';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { api } from '../services/api';
import type { ApiResponse, CompanySummary } from '../types';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/licitacoes': 'Licitações',
  '/empresas': 'Empresas',
  '/convocacoes': 'Avisos por e-mail',
  '/prazos': 'Prazos',
  '/documentos': 'Documentos',
  '/plataformas': 'Plataformas',
  '/usuarios': 'Usuários',
  '/auditoria': 'Auditoria',
  '/backups': 'Backup e recuperação',
  '/saude-sistema': 'Saúde do sistema',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações'
};

export function AppLayout() {
  const { user, logout, activeCompanyId, setActiveCompanyId } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [adminCompanies, setAdminCompanies] = useState<CompanySummary[]>([]);
  const companyPath =
    user?.role === 'EMPRESA' && user.companyId ? `/empresas/${user.companyId}` : '/empresas';
  const sections = [
    { label: 'Início', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      label: 'Gestão',
      items: [
        { to: '/licitacoes', label: 'Licitações', icon: Gavel },
        {
          to: companyPath,
          label: user?.role === 'EMPRESA' ? 'Minha empresa' : 'Empresas',
          icon: Building2
        },
        { to: '/convocacoes', label: 'Avisos por e-mail', icon: Bell },
        { to: '/prazos', label: 'Prazos', icon: CalendarClock },
        { to: '/documentos', label: 'Documentos', icon: FileText }
      ]
    },
    {
      label: 'Administração',
      items: [
        { to: '/plataformas', label: 'Plataformas', icon: Gavel },
        { to: '/usuarios', label: 'Usuários', icon: Users, adminOnly: true },
        { to: '/auditoria', label: 'Auditoria', icon: History, adminOnly: true },
        { to: '/backups', label: 'Backup', icon: DatabaseBackup, adminOnly: true },
        { to: '/saude-sistema', label: 'Saúde do sistema', icon: Activity, adminOnly: true },
        { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
        { to: '/configuracoes', label: 'Configurações', icon: Settings }
      ]
    }
  ];
  const pageTitle =
    titles[location.pathname] ??
    (location.pathname.startsWith('/licitacoes/') ? 'Licitação' : undefined) ??
    (location.pathname.startsWith('/empresas/') ? 'Empresa' : undefined) ??
    'LicitaGestão';
  const activeAssignments = user?.assignedCompanies.filter((company) => company.active) ?? [];
  const switcherCompanies = user?.role === 'ADMIN' ? adminCompanies : activeAssignments;

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      setAdminCompanies([]);
      return;
    }

    let cancelled = false;
    void api
      .get<ApiResponse<CompanySummary[]>>('/companies/options')
      .then((response) => {
        if (!cancelled) setAdminCompanies(response.data.data);
      })
      .catch(() => {
        if (!cancelled) setAdminCompanies([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'ADMIN' || !activeCompanyId || adminCompanies.length === 0) return;
    if (!adminCompanies.some((company) => company.id === activeCompanyId)) setActiveCompanyId(null);
  }, [user?.role, activeCompanyId, adminCompanies, setActiveCompanyId]);

  return (
    <div className="app-shell">
      {menuOpen && (
        <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />
      )}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-logo-frame">
            <img src={licitaGestaoLogo} alt="LicitaGestão" />
          </div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <nav>
          {sections.map((section) => (
            <div className="nav-section" key={section.label}>
              <span className="nav-label">{section.label}</span>
              {section.items
                .filter((item) => !item.adminOnly || user?.role === 'ADMIN')
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMenuOpen(false)}
                  >
                    <item.icon size={19} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>Fase 5</span>
          <strong>E-mails e alertas</strong>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="menu-button" onClick={() => setMenuOpen(true)}>
              <Menu size={22} />
            </button>
            <div>
              <span className="eyebrow">Visão geral</span>
              <h1>{pageTitle}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {user?.role !== 'EMPRESA' && switcherCompanies.length > 0 && (
              <label className="company-switcher">
                <Building2 size={17} />
                <span>Empresa ativa</span>
                <select
                  value={activeCompanyId ?? ''}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setActiveCompanyId(event.target.value || null)}
                  aria-label="Trocar empresa ativa"
                >
                  {user?.role === 'ADMIN' && <option value="">Todas as empresas</option>}
                  {switcherCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.tradeName || company.legalName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="global-search">
              <Search size={18} />
              <input aria-label="Busca" placeholder="Buscar no sistema" disabled />
            </label>
            <DeadlineNotifications />
            <div className="profile-area">
              <button className="profile-button" onClick={() => setProfileOpen((value) => !value)}>
                <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
                <span className="profile-copy">
                  <strong>{user?.name}</strong>
                  <small>{user?.role}</small>
                </span>
                <ChevronDown size={16} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <button
                    className="security-option"
                    onClick={() => {
                      setProfileOpen(false);
                      setPasswordModalOpen(true);
                    }}
                  >
                    Alterar minha senha
                  </button>
                  <button className="logout-option" onClick={() => void logout()}>
                    Sair do sistema
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
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
