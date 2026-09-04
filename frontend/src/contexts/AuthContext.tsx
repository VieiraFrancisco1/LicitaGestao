import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { rawApi, setAccessToken, setRefreshHandler } from '../services/api';
import type { ApiResponse, User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  activeCompanyId: string | null;
  setActiveCompanyId: (companyId: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  const applyUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser) return setActiveCompanyId(null);

    const stored = window.localStorage.getItem(`active-company:${nextUser.id}`);
    const activeAssignments = nextUser.assignedCompanies.filter((company) => company.active);
    const allowed =
      nextUser.role === 'EMPRESA'
        ? nextUser.companyId
        : nextUser.role === 'ADMIN'
          ? stored
          : activeAssignments.some((company) => company.id === stored)
            ? stored
            : (activeAssignments[0]?.id ?? null);

    setActiveCompanyId(allowed ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await rawApi.post<ApiResponse<{ accessToken: string; user: User }>>('/auth/refresh');
      setAccessToken(response.data.data.accessToken);
      applyUser(response.data.data.user);
      return response.data.data.accessToken;
    } catch {
      setAccessToken(null);
      applyUser(null);
      return null;
    }
  }, [applyUser]);

  useEffect(() => {
    setRefreshHandler(refresh);
    const timer = window.setTimeout(() => void refresh().finally(() => setLoading(false)), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await rawApi.post<ApiResponse<{ accessToken: string; user: User }>>('/auth/login', {
        email,
        password
      });
      setAccessToken(response.data.data.accessToken);
      applyUser(response.data.data.user);
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    try {
      await rawApi.post('/auth/logout');
    } finally {
      setAccessToken(null);
      applyUser(null);
    }
  }, [applyUser]);

  const selectCompany = useCallback(
    (companyId: string | null) => {
      setActiveCompanyId(companyId);
      if (!user) return;

      const storageKey = `active-company:${user.id}`;
      if (companyId) window.localStorage.setItem(storageKey, companyId);
      else window.localStorage.removeItem(storageKey);
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, activeCompanyId, setActiveCompanyId: selectCompany, login, logout }),
    [user, loading, activeCompanyId, selectCompany, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
