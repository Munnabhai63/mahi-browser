import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CommercialUser,
  CommercialEntitlements,
  CommercialDevice,
} from '../../10_CONFIG/shared/types/commercial.js';

export interface UserAccount {
  email: string;
  displayName: string;
  avatarLetter: string;
  avatarColor: string;
  planName: string;
  maxProfiles: number;
  createdAt: string;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  color: string;
  role: 'Owner' | 'Admin' | 'Member';
}

interface AccountState {
  currentUser: UserAccount;
  savedAccounts: UserAccount[];
  activeWorkspaceId: string;
  workspaces: WorkspaceItem[];
  isAccountModalOpen: boolean;
  dashboardRole: 'ADMIN' | 'STUDENT';

  // Commercial Architecture State
  commercialUser: CommercialUser | null;
  commercialToken: string | null;
  entitlements: CommercialEntitlements | null;
  userDevices: CommercialDevice[];
  isCommercialLoading: boolean;
  commercialError: string | null;

  // Actions
  setDashboardRole: (role: 'ADMIN' | 'STUDENT') => void;
  openAccountModal: () => void;
  closeAccountModal: () => void;
  loginWithGmail: (email: string, planName?: string) => { success: boolean; error?: string };
  switchAccount: (email: string) => void;
  logout: () => void;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string) => void;

  // Commercial Backend Actions
  commercialLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  commercialRegister: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  syncEntitlements: () => Promise<void>;
  fetchUserDevices: () => Promise<void>;
  revokeUserDevice: (deviceId: string) => Promise<boolean>;
  activateLicenseKey: (rawKey: string) => Promise<{ success: boolean; message: string }>;
}

const DEFAULT_AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-teal-600',
  'bg-indigo-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-violet-600',
];

function getRandomColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEFAULT_AVATAR_COLORS.length;
  return DEFAULT_AVATAR_COLORS[index];
}

const INITIAL_USER: UserAccount = {
  email: 'owner@gmail.com',
  displayName: 'owner',
  avatarLetter: 'O',
  avatarColor: 'bg-teal-600',
  planName: 'Enterprise',
  maxProfiles: 1000,
  createdAt: new Date().toISOString(),
};

const INITIAL_WORKSPACES: WorkspaceItem[] = [
  { id: 'ws-default', name: 'Personal Workspace', color: 'bg-emerald-600', role: 'Owner' },
  { id: 'ws-agency', name: 'Agency Team', color: 'bg-indigo-600', role: 'Owner' },
];

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      currentUser: INITIAL_USER,
      savedAccounts: [INITIAL_USER],
      activeWorkspaceId: 'ws-default',
      workspaces: INITIAL_WORKSPACES,
      isAccountModalOpen: false,
      dashboardRole: 'ADMIN',

      // Commercial State
      commercialUser: null,
      commercialToken: null,
      entitlements: null,
      userDevices: [],
      isCommercialLoading: false,
      commercialError: null,

      setDashboardRole: (role: 'ADMIN' | 'STUDENT') => set({ dashboardRole: role }),
      openAccountModal: () => set({ isAccountModalOpen: true }),
      closeAccountModal: () => set({ isAccountModalOpen: false }),

      loginWithGmail: (rawEmail: string, planName = 'Enterprise') => {
        const email = rawEmail.trim().toLowerCase();
        
        if (!email.endsWith('@gmail.com')) {
          return {
            success: false,
            error: 'Invalid email! Only @gmail.com accounts are allowed.',
          };
        }

        const username = email.split('@')[0];
        if (!username || username.length < 2) {
          return {
            success: false,
            error: 'Please enter a valid Gmail username.',
          };
        }

        const avatarLetter = username[0].toUpperCase();
        const avatarColor = getRandomColor(username);

        const newUser: UserAccount = {
          email,
          displayName: username,
          avatarLetter,
          avatarColor,
          planName,
          maxProfiles: 1000,
          createdAt: new Date().toISOString(),
        };

        const existing = get().savedAccounts.filter((a) => a.email !== email);

        set({
          currentUser: newUser,
          savedAccounts: [newUser, ...existing],
          isAccountModalOpen: false,
        });

        return { success: true };
      },

      commercialLogin: async (email: string, password: string) => {
        set({ isCommercialLoading: true, commercialError: null });
        try {
          if (window.mahiAPI) {
            const res = await window.mahiAPI.commercialLogin({ email, password });
            if (res.success && res.user) {
              const username = res.user.name || res.user.email.split('@')[0];
              const newUser: UserAccount = {
                email: res.user.email,
                displayName: username,
                avatarLetter: username[0].toUpperCase(),
                avatarColor: getRandomColor(username),
                planName: res.user.planId,
                maxProfiles: 100,
                createdAt: res.user.createdAt,
              };

              set({
                commercialUser: res.user,
                commercialToken: res.token || null,
                currentUser: newUser,
                isCommercialLoading: false,
                isAccountModalOpen: false,
              });

              await get().syncEntitlements();
              await get().fetchUserDevices();
              return { success: true };
            }
            set({ isCommercialLoading: false, commercialError: res.error || 'Login failed' });
            return { success: false, error: res.error || 'Invalid credentials' };
          }
          return { success: false, error: 'API bridge unavailable' };
        } catch (err: any) {
          set({ isCommercialLoading: false, commercialError: err?.message || 'Login error' });
          return { success: false, error: err?.message || 'Login error' };
        }
      },

      commercialRegister: async (email: string, password: string, name?: string) => {
        set({ isCommercialLoading: true, commercialError: null });
        try {
          if (window.mahiAPI) {
            const res = await window.mahiAPI.commercialRegister({ email, password, name });
            if (res.success && res.user) {
              const username = res.user.name || res.user.email.split('@')[0];
              const newUser: UserAccount = {
                email: res.user.email,
                displayName: username,
                avatarLetter: username[0].toUpperCase(),
                avatarColor: getRandomColor(username),
                planName: res.user.planId,
                maxProfiles: 5,
                createdAt: res.user.createdAt,
              };

              set({
                commercialUser: res.user,
                commercialToken: res.token || null,
                currentUser: newUser,
                isCommercialLoading: false,
                isAccountModalOpen: false,
              });

              await get().syncEntitlements();
              await get().fetchUserDevices();
              return { success: true };
            }
            set({ isCommercialLoading: false, commercialError: res.error || 'Registration failed' });
            return { success: false, error: res.error || 'Registration failed' };
          }
          return { success: false, error: 'API bridge unavailable' };
        } catch (err: any) {
          set({ isCommercialLoading: false, commercialError: err?.message || 'Registration error' });
          return { success: false, error: err?.message || 'Registration error' };
        }
      },

      syncEntitlements: async () => {
        const { commercialUser } = get();
        if (!commercialUser || !window.mahiAPI) return;
        try {
          const entitlements = await window.mahiAPI.commercialGetEntitlements(commercialUser.id);
          if (entitlements) {
            set({
              entitlements,
              currentUser: {
                ...get().currentUser,
                planName: entitlements.plan?.name || get().currentUser.planName,
                maxProfiles: entitlements.limits?.maxProfiles || get().currentUser.maxProfiles,
              },
            });
          }
        } catch {}
      },

      fetchUserDevices: async () => {
        const { commercialUser } = get();
        if (!commercialUser || !window.mahiAPI) return;
        try {
          const devices = await window.mahiAPI.commercialGetDevices(commercialUser.id);
          set({ userDevices: devices || [] });
        } catch {}
      },

      revokeUserDevice: async (deviceId: string) => {
        const { commercialUser } = get();
        if (!commercialUser || !window.mahiAPI) return false;
        try {
          const ok = await window.mahiAPI.commercialRevokeDevice(deviceId, commercialUser.id);
          if (ok) {
            await get().fetchUserDevices();
            await get().syncEntitlements();
          }
          return ok;
        } catch {
          return false;
        }
      },

      activateLicenseKey: async (rawKey: string) => {
        const { commercialUser } = get();
        if (!commercialUser || !window.mahiAPI) return { success: false, message: 'Please sign in first.' };
        try {
          const res = await window.mahiAPI.commercialActivateKey(commercialUser.id, rawKey);
          if (res.success) {
            await get().syncEntitlements();
            await get().fetchUserDevices();
          }
          return res;
        } catch (err: any) {
          return { success: false, message: err?.message || 'Activation failed.' };
        }
      },

      switchAccount: (email: string) => {
        const found = get().savedAccounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
        if (found) {
          set({ currentUser: found });
        }
      },

      logout: () => {
        set({
          commercialUser: null,
          commercialToken: null,
          entitlements: null,
          userDevices: [],
          isAccountModalOpen: true,
        });
      },

      setActiveWorkspace: (id: string) => {
        set({ activeWorkspaceId: id });
      },

      addWorkspace: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const newWs: WorkspaceItem = {
          id: `ws-${Date.now()}`,
          name: trimmed,
          color: getRandomColor(trimmed),
          role: 'Owner',
        };
        set((state) => ({
          workspaces: [...state.workspaces, newWs],
          activeWorkspaceId: newWs.id,
        }));
      },
    }),
    {
      name: 'mahi_user_account_storage',
    }
  )
);
