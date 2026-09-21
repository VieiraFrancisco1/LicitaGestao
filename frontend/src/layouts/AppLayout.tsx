import {
  Bell,
  Activity,
  Building2,
  CalendarClock,
  ChevronDown,
  DatabaseBackup,
  FileBarChart,
  Gavel,
  LayoutDashboard,
  History,
  Menu,
  Search,
  Settings,
  Shield,
  CircleHelp,
  Users,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DeadlineNotifications } from '../components/DeadlineNotifications';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { api } from '../services/api';
import type { ApiResponse, GlobalSearchResult } from '../types';
import licitaGestaoLogo from '../assets/licitagestao-logo.png';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/licitacoes': 'Licitações',
  '/empresas': 'Empresas',
  '/convocacoes': 'E-mails',
  '/prazos': 'Prazos',
  '/plataformas': 'Plataformas',
  '/usuarios': 'Usuários',
  '/auditoria': 'Auditoria',
  '/backups': 'Backup e recuperação',
  '/saude-sistema': 'Saúde do sistema',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações',
  '/ajuda': 'Ajuda',
  '/super-admin': 'Super Admin'
};


const roleLabels = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Usuário',
  EMPRESA: 'Empresa'
} as const;

const resultTypeLabel: Record<GlobalSearchResult['type'], string> = {
  TENDER: 'Licitação',
  COMPANY: 'Empresa',
  PLATFORM: 'Plataforma',
  USER: 'Usuário',
  EMAIL: 'E-mail'
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

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
        { to: '/convocacoes', label: 'E-mails', icon: Bell },
        { to: '/prazos', label: 'Prazos', icon: CalendarClock }
      ]
    },
    {
      label: 'Administração',
      items: [
        { to: '/plataformas', label: 'Plataformas', icon: Gavel },
        { to: '/usuarios', label: 'Usuários', icon: Users, adminOnly: true },
        { to: '/auditoria', label: 'Auditoria', icon: History, adminOnly: true },
        { to: '/backups', label: 'Backup', icon: DatabaseBackup, superAdminOnly: true },
        { to: '/saude-sistema', label: 'Saúde do sistema', icon: Activity, superAdminOnly: true },
        { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
        { to: '/configuracoes', label: 'Configurações', icon: Settings },
        { to: '/ajuda', label: 'Ajuda', icon: CircleHelp },
        { to: '/super-admin', label: 'Super Admin', icon: Shield, superAdminOnly: true }
      ]
    }
  ];

  const pageTitle =
    titles[location.pathname] ??
    (location.pathname.startsWith('/licitacoes/') ? 'Licitação' : undefined) ??
    (location.pathname.startsWith('/empresas/') ? 'Empresa' : undefined) ??
    'LicitaGestão';

  useEffect(() => {
    const closeProfile = () => setProfileOpen(false);
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
      if (searchOpen && searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('licitagestao:close-profile', closeProfile);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('licitagestao:close-profile', closeProfile);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen, searchOpen]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void api
        .get<ApiResponse<GlobalSearchResult[]>>('/search', { params: { q: query } })
        .then((response) => {
          setSearchResults(response.data.data);
          setSearchOpen(true);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMenuOpen(false);
      setProfileOpen(false);
      setSearchOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

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
                .filter((item) => {
                  const adminAllowed =
                    !('adminOnly' in item) ||
                    !item.adminOnly ||
                    user?.role === 'ADMIN' ||
                    user?.role === 'SUPER_ADMIN';
                  const superAllowed =
                    !('superAdminOnly' in item) ||
                    !item.superAdminOnly ||
                    user?.role === 'SUPER_ADMIN';
                  return adminAllowed && superAllowed;
                })
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
            <div className="global-search global-search-live" ref={searchRef}>
              <Search size={18} />
              <input
                aria-label="Busca"
                placeholder="Buscar no sistema"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
              />
              {searchLoading && <span className="global-search-spinner" aria-label="Buscando" />}
              {searchOpen && searchQuery.trim().length >= 2 && (
                <div className="global-search-results">
                  {searchLoading ? (
                    <div className="global-search-empty">Buscando...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="global-search-empty">Nenhum resultado encontrado.</div>
                  ) : (
                    searchResults.map((result) => (
                      <button
                        type="button"
                        key={`${result.type}:${result.id}`}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          navigate(result.link);
                        }}
                      >
                        <span className="global-search-type">{resultTypeLabel[result.type]}</span>
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <DeadlineNotifications />

            <div className="profile-area" ref={profileRef}>
              <button
                className="profile-button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('licitagestao:close-notifications'));
                  setProfileOpen((value) => !value);
                }}
              >
                <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
                <span className="profile-copy">
                  <strong>{user?.name}</strong>
                  <small>{user?.role ? roleLabels[user.role] : ''}</small>
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
