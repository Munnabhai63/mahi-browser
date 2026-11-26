/**
 * MAHI Browser — Web Dashboard Authentication Store
 * Phase 7 Architecture
 *
 * Manages Central Auth state for the Web Dashboard.
 * Keeps tokens in memory with secure sessionStorage fallback for page refreshes.
 * Binds token getter to the WebApiClient singleton.
 */

import { create } from 'zustand';
import { api } from '../api/api-client.js';
import { TeamWorkspace } from '../../../10_CONFIG/shared/types/workspace.js';

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

  // Actions
  initialize: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setCurrentWorkspace: (workspace: TeamWorkspace | null) => void;
  clearError: () => void;
}

const STORAGE_KEY = 'mahi_web_auth_session';

export const useWebAuthStore = create<WebAuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  currentWorkspace: null,

  initialize: () => {
    // Bind token getter to API client
    api.setTokenGetter(() => get().accessToken);

    // Bind automatic unauthorized callback to trigger session refresh or logout
    api.setOnUnauthorized(() => {
      get().refreshSession().then((refreshed) => {
        if (!refreshed) {
          get().logout();
        }
      });
    });

    // 1. Hydrate token from URL fragment (#token=) or legacy query params when redirected from login
    if (typeof window !== 'undefined') {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken =
          hashParams.get('token') ||
          hashParams.get('accessToken') ||
          urlParams.get('token') ||
          urlParams.get('accessToken');
        if (urlToken) {
          // Strip token from fragment/query without reloading the page
          const cleanSearchParams = new URLSearchParams(window.location.search);
          cleanSearchParams.delete('token');
          cleanSearchParams.delete('accessToken');
          const qs = cleanSearchParams.toString();
          const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '');
          window.history.replaceState({}, document.title, cleanUrl);

          let decodedUser: WebUser = {
            id: 'hydrated',
            email: '',
            name: 'User',
            role: 'user',
            planId: 'free',
            profileQuota: 15,
          };
          try {
            const parts = urlToken.split('.');
            if (parts.length === 3) {
              const base64Url = parts[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const payload = JSON.parse(jsonPayload);
              decodedUser = {
                id: payload.userId || payload.id || 'hydrated',
                email: payload.email || '',
                name: payload.name || (payload.email ? payload.email.split('@')[0] : 'User'),
                role: payload.role || 'user',
                planId: payload.planId || 'free',
                profileQuota:
                  payload.profileQuota ??
                  (payload.planId && payload.planId !== 'plan_free' && payload.planId !== 'free' ? 100 : 15),
              };
            }
          } catch {}

          set({
            accessToken: urlToken,
            user: decodedUser,
            isAuthenticated: true,
            isLoading: false,
          });

          if (window.sessionStorage) {
            window.sessionStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ accessToken: urlToken, user: decodedUser })
            );
          }
          return;
        }
      } catch {}
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = window.sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.accessToken && parsed.user) {
            const restoredUser = {
              ...parsed.user,
              profileQuota:
                parsed.user.profileQuota ??
                (parsed.user.planId && parsed.user.planId !== 'plan_free' && parsed.user.planId !== 'free'
                  ? 100
                  : 15),
            };
            set({
              user: restoredUser,
              accessToken: parsed.accessToken,
              refreshToken: parsed.refreshToken || null,
              isAuthenticated: true,
              isLoading: false,
            });
            // Try refresh in background
            if (parsed.refreshToken) {
              get().refreshSession().catch(() => {});
            }
            return;
          }
        }
      } catch {}
    }
    set({ isLoading: false });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login(email, password);
      if (res.success && res.data) {
        const { user, token, tokens } = res.data;
        const accessToken = token || tokens?.accessToken;
        const refreshToken = tokens?.refreshToken;

        const webUser: WebUser = {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: user.role,
          planId: user.planId || 'plan_free',
          profileQuota: user.profileQuota ?? (user.planId && user.planId !== 'plan_free' && user.planId !== 'free' ? 100 : 15),
        };

        set({
          user: webUser,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // Persist in sessionStorage for page refreshes
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ user: webUser, accessToken, refreshToken })
          );
        }

        return true;
      } else {
        set({
          isLoading: false,
          error: res.error?.message || 'Login failed. Please check credentials.',
        });
        return false;
      }
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'An unexpected login error occurred',
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
        // Automatically attempt login
        return await get().login(email, password);
      } else {
        set({
          isLoading: false,
          error: res.error?.message || 'Registration failed',
        });
        return false;
      }
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Registration error',
      });
      return false;
    }
  },

  refreshSession: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;

    try {
      const res = await api.refreshToken(refreshToken);
      if (res.success && res.data) {
        const newAccessToken = res.data.accessToken;
        const newRefreshToken = res.data.refreshToken || refreshToken;

        set({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });

        if (typeof window !== 'undefined' && window.sessionStorage) {
          const current = get();
          window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              user: current.user,
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
            })
          );
        }
        return true;
      } else {
        // Refresh token failed/expired
        get().logout();
        return false;
      }
    } catch {
      return false;
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch {}

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      currentWorkspace: null,
      error: null,
    });

    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  },

  setCurrentWorkspace: (workspace: TeamWorkspace | null) => {
    set({ currentWorkspace: workspace });
  },

  clearError: () => {
    set({ error: null });
  },
}));
