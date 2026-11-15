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
