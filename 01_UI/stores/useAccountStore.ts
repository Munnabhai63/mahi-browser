import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CommercialUser,
  CommercialEntitlements,
  CommercialDevice,
} from '../../10_CONFIG/shared/types/commercial.js';
import { useProfileStore } from './useProfileStore.js';

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
  currentUser: UserAccount | null;
  savedAccounts: UserAccount[];
  activeWorkspaceId: string;
  workspaces: WorkspaceItem[];
  isAccountModalOpen: boolean;
  dashboardRole: 'ADMIN' | 'STUDENT';

  commercialUser: CommercialUser | null;
  commercialToken: string | null;
  entitlements: CommercialEntitlements | null;
  userDevices: CommercialDevice[];
  isCommercialLoading: boolean;
  commercialError: string | null;
  rememberMe: boolean;

  // GoLogin-Style Account & Subscription System (v1.1.0+)
  accountSession: any | null;
  planLimits: { isPro: boolean; plan: string; tier?: 'FREE' | 'PRO' | 'BUSINESS'; maxProfiles: number; expiresAt: string | null } | null;
  paymentInfo: any | null;
  pricingCatalog: any | null;
  paymentHistory: any[];
  pendingProfileDto: any | null;

  setDashboardRole: (role: 'ADMIN' | 'STUDENT') => void;
  openAccountModal: (pendingDto?: any) => void;
  closeAccountModal: () => void;
  clearPendingProfileDto: () => void;
  switchAccount: (email: string) => void;
  logout: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string) => void;
  setRememberMe: (val: boolean) => void;

  fetchPlanLimits: (dto?: { force?: boolean }) => Promise<void>;
  fetchPaymentInfo: () => Promise<void>;
  fetchPricingCatalog: () => Promise<any>;
  createCheckoutSession: (payload: any) => Promise<any>;
  fetchPaymentHistory: () => Promise<any>;
  submitManualUpiPayment: (payload: { plan_id: string; utr: string; proof_asset?: string; billing_cycle?: string; amount_paise?: number; extra_members?: number; extra_proxy_gb?: number }) => Promise<{ success: boolean; payment_id?: string; status?: string; message?: string; error?: string }>;
  accountSignup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  accountLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string; deviceMismatch?: boolean }>;
  accountLoginWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  accountLogout: () => Promise<void>;
  accountSwitchDevice: () => Promise<{ success: boolean; error?: string }>;

  activeSessions: any[];
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  fetchActiveSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  revokeAllSessions: (keepCurrent?: boolean) => Promise<{ success: boolean; error?: string }>;

  commercialLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  commercialRegister: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  
  syncEntitlements: () => Promise<void>;
  fetchUserDevices: () => Promise<void>;
  revokeUserDevice: (deviceId: string) => Promise<boolean>;
  activateLicenseKey: (rawKey: string) => Promise<{ success: boolean; message: string }>;
  hasCapability: (cap: string) => boolean;
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

const INITIAL_WORKSPACES: WorkspaceItem[] = [
  { id: 'ws-default', name: 'My Workspace', color: 'bg-emerald-600', role: 'Owner' },
];

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      savedAccounts: [],
      activeWorkspaceId: 'ws-default',
      workspaces: INITIAL_WORKSPACES,
      isAccountModalOpen: false,
      dashboardRole: 'ADMIN',

      commercialUser: null,
      commercialToken: null,
      entitlements: null,
      userDevices: [],
      isCommercialLoading: false,
      commercialError: null,
      rememberMe: true,

      accountSession: null,
      planLimits: null,
      paymentInfo: null,
      pricingCatalog: null,
      paymentHistory: [],
      pendingProfileDto: null,
      activeSessions: [],

      setDashboardRole: (role) => set({ dashboardRole: role }),
      openAccountModal: (pendingDto) => set({ isAccountModalOpen: true, pendingProfileDto: pendingDto || null }),
      closeAccountModal: () => set({ isAccountModalOpen: false, pendingProfileDto: null }),
      clearPendingProfileDto: () => set({ pendingProfileDto: null }),

      fetchPlanLimits: async (dto?: { force?: boolean }) => {
        if (!window.mahiAPI) return;
        try {
          const limits = await window.mahiAPI.accountGetPlanLimits(dto);
          set({ planLimits: limits });
          const sess = await window.mahiAPI.accountGetSession();
          set({ accountSession: sess });
          if (sess) {
            set({
              currentUser: {
                email: sess.email,
                displayName: sess.email,
                avatarLetter: sess.email[0].toUpperCase(),
                avatarColor: getRandomColor(sess.email),
                planName: limits.plan.toUpperCase(),
                maxProfiles: limits.maxProfiles,
                createdAt: sess.saved_at,
              }
            });
          } else if (!get().commercialUser) {
            set({ currentUser: null, accountSession: null });
          }
          if (window.mahiAPI?.getEntitlements) {
            const ent = await window.mahiAPI.getEntitlements();
            if (ent) set({ entitlements: ent });
          }
        } catch {}
      },

      fetchPaymentInfo: async () => {
        if (!window.mahiAPI) return;
        try {
          const info = await window.mahiAPI.accountGetPaymentInfo();
          set({ paymentInfo: info });
        } catch {}
      },

      fetchPricingCatalog: async () => {
        if (!window.mahiAPI?.accountGetPricingCatalog) return null;
        try {
          const res = await window.mahiAPI.accountGetPricingCatalog();
          if (res?.success && res.catalog) {
            set({ pricingCatalog: res.catalog });
            return res.catalog;
          }
          return null;
        } catch {
          return null;
        }
      },

      createCheckoutSession: async (payload: any) => {
        if (!window.mahiAPI?.accountCreateCheckoutSession) {
          return { success: false, error: 'Checkout API unavailable' };
        }
        try {
          return await window.mahiAPI.accountCreateCheckoutSession(payload);
        } catch (err: any) {
          return { success: false, error: err.message || 'Checkout session creation failed' };
        }
      },

      fetchPaymentHistory: async () => {
        if (!window.mahiAPI?.accountGetPaymentStatus) return [];
        try {
          const res = await window.mahiAPI.accountGetPaymentStatus();
          if (res?.success && res.payments) {
            set({ paymentHistory: res.payments });
            return res.payments;
          }
          return [];
        } catch {
          return [];
        }
      },

      submitManualUpiPayment: async (payload) => {
        if (!window.mahiAPI?.accountSubmitManualUpiPayment) {
          return { success: false, error: 'Payment submission API unavailable' };
        }
        try {
          const res = await window.mahiAPI.accountSubmitManualUpiPayment(payload);
          return res;
        } catch (err: any) {
          return { success: false, error: err.message || 'Payment submission failed' };
        }
      },

      accountSignup: async (email, password) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        try {
          const res = await window.mahiAPI.accountSignup({ email, password });
          if (res.success) {
            await get().fetchPlanLimits({ force: true });
            return { success: true };
          }
          return { success: false, error: res.error || 'Signup failed' };
        } catch (err: any) {
          return { success: false, error: err.message || 'Signup failed' };
        }
      },

      accountLogin: async (email, password) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        try {
          const res = await window.mahiAPI.accountLogin({ email, password });
          if (res.success) {
            await get().fetchPlanLimits({ force: true });
            useProfileStore.getState().fetchProfiles().catch(() => {});
            return { success: true };
          }
          return { success: false, error: res.error || 'Login failed', deviceMismatch: (res as any).device_limit };
        } catch (err: any) {
          return { success: false, error: err.message || 'Login failed', deviceMismatch: err.device_limit };
        }
      },

      accountLoginWithToken: async (token) => {
        if (!window.mahiAPI?.accountLoginWithToken) return { success: false, error: 'API unavailable' };
        try {
          const res = await window.mahiAPI.accountLoginWithToken(token);
          if (res.success) {
            await get().fetchPlanLimits({ force: true });
            useProfileStore.getState().fetchProfiles().catch(() => {});
            return { success: true };
          }
          return { success: false, error: res.error || 'Token login failed' };
        } catch (err: any) {
          return { success: false, error: err.message || 'Token login failed' };
        }
      },

      accountLogout: async () => {
        if (!window.mahiAPI) return;
        try {
          await window.mahiAPI.accountLogout();
        } catch {}
        set({
          accountSession: null,
          currentUser: null,
          planLimits: { isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null },
        });
        useProfileStore.getState().fetchProfiles().catch(() => {});
      },

      accountSwitchDevice: async () => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        try {
          const res = await window.mahiAPI.accountSwitchDevice();
          if (res.success) {
            await get().fetchPlanLimits({ force: true });
            return { success: true };
          }
          return { success: false, error: (res as any).message || 'Device switch failed' };
        } catch (err: any) {
          return { success: false, error: err.message || 'Device switch failed' };
        }
      },

      verifyEmail: async (token: string) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        return window.mahiAPI.accountVerifyEmail({ token });
      },

      resendVerification: async (email: string) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        return window.mahiAPI.accountResendVerification({ email });
      },

      forgotPassword: async (email: string) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        return window.mahiAPI.accountForgotPassword({ email });
      },

      resetPassword: async (token: string, newPassword: string) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        return window.mahiAPI.accountResetPassword({ token, newPassword });
      },

      fetchActiveSessions: async () => {
        if (!window.mahiAPI) return;
        try {
          const res = await window.mahiAPI.accountListSessions();
          if (res.success && res.sessions) {
            set({ activeSessions: res.sessions });
          }
        } catch {}
      },

      revokeSession: async (sessionId: string) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        const res = await window.mahiAPI.accountRevokeSession({ sessionId });
        if (res.success) {
          await get().fetchActiveSessions();
        }
        return res;
      },

      revokeAllSessions: async (keepCurrent: boolean = true) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        const res = await window.mahiAPI.accountRevokeAllSessions({ keepCurrent });
        if (res.success) {
          await get().fetchActiveSessions();
        }
        return res;
      },

      setRememberMe: (val) => set({ rememberMe: val }),

      commercialLogin: async (email, password) => {
        set({ isCommercialLoading: true, commercialError: null });
        try {
          if (!window.mahiAPI) {
            set({ isCommercialLoading: false, commercialError: 'API not available' });
            return { success: false, error: 'API not available' };
          }
          const res = await window.mahiAPI.commercialLogin({ email, password });
          if (res.success && res.user) {
            const username = res.user.email;
            const newUser: UserAccount = {
              email: res.user.email,
              displayName: username,
              avatarLetter: username[0].toUpperCase(),
              avatarColor: getRandomColor(username),
              planName: res.user.planId || 'Free',
              maxProfiles: 100,
              createdAt: res.user.createdAt,
            };

            set({
              commercialUser: res.user,
              commercialToken: res.token,
              currentUser: newUser,
              isCommercialLoading: false,
              isAccountModalOpen: false,
              commercialError: null,
            });

            await get().syncEntitlements();
            await get().fetchUserDevices();
            return { success: true };
          } else {
            set({ isCommercialLoading: false, commercialError: res.error || 'Invalid credentials' });
            return { success: false, error: res.error || 'Invalid credentials' };
          }
        } catch (err: any) {
          set({ isCommercialLoading: false, commercialError: err.message || 'Login failed' });
          return { success: false, error: err.message || 'Login failed' };
        }
      },

      commercialRegister: async (email, password, name) => {
        set({ isCommercialLoading: true, commercialError: null });
        try {
          if (!window.mahiAPI) {
            set({ isCommercialLoading: false, commercialError: 'API not available' });
            return { success: false, error: 'API not available' };
          }
          const res = await window.mahiAPI.commercialRegister({ email, password, name: name || email });
          if (res.success && res.user) {
            const username = res.user.email;
            const newUser: UserAccount = {
              email: res.user.email,
              displayName: username,
              avatarLetter: username[0].toUpperCase(),
              avatarColor: getRandomColor(username),
              planName: res.user.planId || 'Free',
              maxProfiles: 100,
              createdAt: res.user.createdAt,
            };

            set({
              commercialUser: res.user,
              commercialToken: res.token,
              currentUser: newUser,
              isCommercialLoading: false,
              isAccountModalOpen: false,
              commercialError: null,
            });

            await get().syncEntitlements();
            await get().fetchUserDevices();
            return { success: true };
          } else {
            set({ isCommercialLoading: false, commercialError: res.error || 'Registration failed' });
            return { success: false, error: res.error || 'Registration failed' };
          }
        } catch (err: any) {
          set({ isCommercialLoading: false, commercialError: err.message || 'Registration failed' });
          return { success: false, error: err.message || 'Registration failed' };
        }
      },

      syncEntitlements: async () => {
        if (!window.mahiAPI) return;
        try {
          const { commercialUser } = get();
          const entitlements = commercialUser
            ? await window.mahiAPI.commercialGetEntitlements(commercialUser.id)
            : (window.mahiAPI.getEntitlements ? await window.mahiAPI.getEntitlements() : null);
          if (entitlements) {
            set({
              entitlements,
              currentUser: get().currentUser ? {
                ...get().currentUser!,
                planName: entitlements.plan?.name || get().currentUser!.planName,
                maxProfiles: entitlements.limits?.maxProfiles || get().currentUser!.maxProfiles,
              } : get().currentUser,
            });
          }
        } catch {}
      },

      hasCapability: (cap: string) => {
        const { entitlements, planLimits, currentUser } = get();
        // 1. If explicit server-authoritative capabilities exist in entitlements, evaluate them
        if (entitlements?.capabilities && typeof (entitlements.capabilities as any)[cap] === 'boolean') {
          return (entitlements.capabilities as any)[cap];
        }

        // 2. Basic capabilities available to everyone (FREE and up)
        if (cap === 'profile.basic' || cap === 'proxy.custom') return true;

        // 3. Determine effective plan and tier
        const plan = (planLimits?.plan || currentUser?.planName || '').toLowerCase().trim();
        const isPro = planLimits?.isPro || false;

        const isBusiness = (
          plan === 'business' ||
          plan === 'enterprise' ||
          plan.startsWith('business_') ||
          plan.startsWith('team_') ||
          plan === 'team' ||
          entitlements?.plan?.tier === 'BUSINESS' ||
          entitlements?.plan?.tier === 'ENTERPRISE'
        );

        // Features requiring BUSINESS tier
        if (cap === 'workspace.team') {
          return isBusiness;
        }

        // Features requiring PRO tier (included in both PRO and BUSINESS)
        const isProOrBusiness = isBusiness || isPro || plan === 'pro' || plan === 'trial' || plan.startsWith('pro_') || plan.startsWith('professional_') || plan === 'starter';
        return isProOrBusiness;
      },

      fetchUserDevices: async () => {
        const { commercialUser } = get();
        if (!commercialUser || !window.mahiAPI) return;
        try {
          const devices = await window.mahiAPI.commercialGetDevices(commercialUser.id);
          set({ userDevices: devices || [] });
        } catch {}
      },

      revokeUserDevice: async (deviceId) => {
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

      activateLicenseKey: async (rawKey) => {
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

      logout: async () => {
        try {
          if (window.mahiAPI && (window.mahiAPI as any).commercialLogout) {
            await (window.mahiAPI as any).commercialLogout();
          }
        } catch {}

        set({
          commercialUser: null,
          commercialToken: null,
          entitlements: null,
          userDevices: [],
          currentUser: null,
          isAccountModalOpen: false,
          commercialError: null,
        });
        useProfileStore.getState().fetchProfiles().catch(() => {});
      },

      switchAccount: (email) => {
        const found = get().savedAccounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
        if (found) set({ currentUser: found });
      },

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      addWorkspace: (name) => {
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
      partialize: (state) => {
        return {
          activeWorkspaceId: state.activeWorkspaceId,
          workspaces: state.workspaces,
          dashboardRole: state.dashboardRole,
          savedAccounts: state.savedAccounts,
          rememberMe: state.rememberMe,
          commercialUser: state.commercialUser,
          commercialToken: state.commercialToken,
          currentUser: state.currentUser,
          accountSession: state.accountSession,
          planLimits: state.planLimits,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // If a user account is present, keep the account modal closed
          if (state.currentUser || state.accountSession || state.commercialUser) {
            state.isAccountModalOpen = false;
          }
          state.isCommercialLoading = false;
          state.commercialError = null;
        }
      },
    }
  )
);
