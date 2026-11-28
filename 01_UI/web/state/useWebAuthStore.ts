/**
 * MAHI Browser — Web Dashboard Authentication Store
 *
 * Manages Central Auth state for the Web Dashboard using backend-issued
 * `HttpOnly` session cookies (`credentials: 'include'`). Never persists raw JWTs
 * in localStorage, sessionStorage, or URL fragments/query strings.
 */

import { create } from 'zustand';
import { api } from '../api/api-client.js';
import type { TeamWorkspace } from '../../../10_CONFIG/shared/types/workspace.js';

export interface WebUser {
  id: string;
  email: string;
  name: string;
  role: string;
  planId: string;
  status?: string;
  profileQuota?: number;
}

interface WebAuthState {
  user: WebUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentWorkspace: TeamWorkspace | null;

  initialize: () => Promise<void> | void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setCurrentWorkspace: (workspace: TeamWorkspace | null) => void;
  clearError: () => void;
}

const LEGACY_STORAGE_KEYS = ['mahi_web_auth_session', 'mahi_auth_token', 'mahi_access_token'];

function clearLegacyBrowserTokenStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      window.sessionStorage?.removeItem(key);
    } catch (err) {
      console.debug('[useWebAuthStore] legacy sessionStorage clear skipped', err);
    }
    try {
      window.localStorage?.removeItem(key);
    } catch (err) {
      console.debug('[useWebAuthStore] legacy localStorage clear skipped', err);
    }
  }
}

function stripLegacyUrlTokenParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const hasTokenParam =
      hashParams.has('token') ||
      hashParams.has('accessToken') ||
      searchParams.has('token') ||
      searchParams.has('accessToken');
    if (hasTokenParam) {
      hashParams.delete('token');
      hashParams.delete('accessToken');
      searchParams.delete('token');
      searchParams.delete('accessToken');
      const qs = searchParams.toString();
      const hash = hashParams.toString();
      const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch (err) {
    console.debug('[useWebAuthStore] legacy URL token strip skipped', err);
  }
}

interface RawWebUser {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  planId?: string;
  status?: string;
  profileQuota?: number;
}

interface AuthResponsePayload {
  user?: RawWebUser;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
  };
  data?: AuthResponsePayload;
}

function unwrapAuthPayload(res: unknown): AuthResponsePayload {
  if (!res || typeof res !== 'object') return {};
  const rec = res as AuthResponsePayload;
  if (rec.data && typeof rec.data === 'object') {
    return rec.data;
  }
  return rec;
}

function mapToWebUser(rawUser: RawWebUser | undefined): WebUser {
  const email = rawUser?.email || '';
  const planId = rawUser?.planId || 'plan_free';
  return {
    id: rawUser?.id || '',
    email,
    name: rawUser?.name || (email ? email.split('@')[0] : 'User'),
    role: rawUser?.role || 'USER',
    planId,
    status: rawUser?.status,
    profileQuota:
      rawUser?.profileQuota ??
      (planId && planId !== 'plan_free' && planId !== 'free' ? 100 : 15),
  };
}

export const useWebAuthStore = create<WebAuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  currentWorkspace: null,

  initialize: async () => {
    api.setTokenGetter(() => get().accessToken);

    api.setOnUnauthorized(() => {
      if (!get().isAuthenticated) return;
      get().refreshSession().then((refreshed) => {
        if (!refreshed) {
          get().logout();
        }
      });
    });

    stripLegacyUrlTokenParams();
    clearLegacyBrowserTokenStorage();

    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    try {
      const meRes = await api.getMe();
      const payload = unwrapAuthPayload(meRes);
      if (meRes.success && payload?.user) {
        set({
          user: mapToWebUser(payload.user),
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      const refreshRes = await api.refreshToken();
      if (refreshRes.success) {
        const refreshedMe = await api.getMe();
        const refreshedPayload = unwrapAuthPayload(refreshedMe);
        if (refreshedMe.success && refreshedPayload?.user) {
          set({
            user: mapToWebUser(refreshedPayload.user),
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        }
      }
    } catch (err) {
      console.debug('[useWebAuthStore] session bootstrap failed, treating as signed out', err);
    }

    set({ isAuthenticated: false, user: null, isLoading: false });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login(email, password);
      const payload = unwrapAuthPayload(res);
      if (res.success && payload?.user) {
        const accessToken = payload.token || payload.tokens?.accessToken || null;
        const refreshToken = payload.tokens?.refreshToken || null;
        clearLegacyBrowserTokenStorage();

        set({
          user: mapToWebUser(payload.user),
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      }

      set({
        isLoading: false,
        error:
          typeof res.error === 'string'
            ? res.error
            : res.error?.message || 'Login failed. Please check credentials.',
      });
      return false;
    } catch (err: unknown) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'An unexpected login error occurred',
      });
      return false;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.register(email, password, name);
      if (res.success) {
        set({ isLoading: false, error: null });
        return await get().login(email, password);
      }
      set({
        isLoading: false,
        error: typeof res.error === 'string' ? res.error : res.error?.message || 'Registration failed',
      });
      return false;
    } catch (err: unknown) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Registration error',
      });
      return false;
    }
  },

  refreshSession: async () => {
    const { refreshToken } = get();
    try {
      const res = await api.refreshToken(refreshToken || undefined);
      const payload = unwrapAuthPayload(res);
      if (res.success) {
        const newAccessToken = payload?.accessToken || payload?.tokens?.accessToken || get().accessToken;
        const newRefreshToken = payload?.refreshToken || payload?.tokens?.refreshToken || refreshToken;
        set({
          accessToken: newAccessToken || null,
          refreshToken: newRefreshToken || null,
          isAuthenticated: true,
          ...(payload?.user ? { user: mapToWebUser(payload.user) } : {}),
        });
        return true;
      }
      await get().logout();
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    try {
      await api.logout(refreshToken || undefined);
    } catch (err) {
      console.debug('[useWebAuthStore] remote logout call failed', err);
    }

    clearLegacyBrowserTokenStorage();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      currentWorkspace: null,
      error: null,
    });
  },

  setCurrentWorkspace: (workspace: TeamWorkspace | null) => {
    set({ currentWorkspace: workspace });
  },

  clearError: () => {
    set({ error: null });
  },
}));
