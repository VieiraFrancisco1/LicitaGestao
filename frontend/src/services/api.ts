import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3333/api');

export const rawApi = axios.create({ baseURL, withCredentials: true });
export const api = axios.create({ baseURL, withCredentials: true });

let accessToken: string | null = null;
let refreshSession: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setRefreshHandler = (handler: () => Promise<string | null>) => {
  refreshSession = handler;
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retry || !refreshSession) {
      return Promise.reject(error);
    }
    original._retry = true;
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    const token = await refreshPromise;
    if (!token) return Promise.reject(error);
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  }
);

export const errorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      'Não foi possível concluir a operação'
    );
  }
  return 'Ocorreu um erro inesperado';
};
