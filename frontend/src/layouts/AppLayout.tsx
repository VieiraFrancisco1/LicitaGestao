import {
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
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
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DeadlineNotifications } from '../components/DeadlineNotifications';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/licitacoes': 'Licitações',
  '/empresas': 'Empresas',
  '/convocacoes': 'Convocações',
  '/prazos': 'Prazos',
  '/documentos': 'Documentos',
  '/plataformas': 'Plataformas',
  '/usuarios': 'Usuários',
  '/auditoria': 'Auditoria',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações'
};

export function AppLayout() {
  const { user, logout, activeCompanyId, setActiveCompanyId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
        { to: '/convocacoes', label: 'Convocações', icon: Bell },
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

  return (
    <div className="app-shell">
      {menuOpen && (
        <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />
      )}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Gavel size={23} />
          </div>
          <div>
            <strong>LicitaGestão</strong>
            <span>Controle empresarial</span>
          </div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)}>
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
          <strong>Gmail e convocações</strong>
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
            {user?.role === 'FUNCIONARIO' && activeAssignments.length > 0 && (
              <label className="company-switcher">
                <Building2 size={17} />
                <span>Empresa ativa</span>
                <select
                  value={activeCompanyId ?? ''}
                  onChange={(event) => {
                    const companyId = event.target.value;
                    setActiveCompanyId(companyId);
                    navigate(`/empresas/${companyId}`);
                  }}
                >
                  {activeAssignments.map((company) => (
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
                  <button onClick={() => void logout()}>Sair do sistema</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
