import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AccountActiveSessionRecord,
  AccountCheckoutPayload,
  AccountCheckoutSession,
  AccountPaymentInfo,
  AccountPaymentRecord,
  AccountPricingCatalog,
  AccountSession,
  AccountTrialStatus,
  CommercialUser,
  CommercialEntitlements,
  CommercialDevice,
  FeatureCapability,
} from '../../10_CONFIG/shared/types/commercial.js';
import type { CreateProfileDTO, Profile } from '../../10_CONFIG/shared/types/profile.js';
import { useProfileStore } from './useProfileStore.js';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

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
  accountSession: AccountSession | null;
  planLimits: { isPro: boolean; plan: string; tier?: 'FREE' | 'PRO' | 'BUSINESS'; maxProfiles: number; expiresAt: string | null } | null;
  paymentInfo: AccountPaymentInfo | null;
  pricingCatalog: AccountPricingCatalog | null;
  paymentHistory: AccountPaymentRecord[];
  pendingProfileDto: CreateProfileDTO | null;
  selectedPlanTier?: string | null;

  setDashboardRole: (role: 'ADMIN' | 'STUDENT') => void;
  openAccountModal: (pendingDto?: CreateProfileDTO | string | null) => void;
  closeAccountModal: () => void;
  clearPendingProfileDto: () => void;
  switchAccount: (email: string) => void;
  logout: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (name: string) => void;
  setRememberMe: (val: boolean) => void;

  fetchPlanLimits: (dto?: { force?: boolean }) => Promise<void>;
  fetchPaymentInfo: () => Promise<void>;
  fetchPricingCatalog: () => Promise<AccountPricingCatalog | null>;
  createCheckoutSession: (payload: AccountCheckoutPayload) => Promise<{ success: boolean; session?: AccountCheckoutSession; error?: string }>;
  fetchPaymentHistory: () => Promise<AccountPaymentRecord[]>;
  submitManualUpiPayment: (payload: { plan_id: string; utr: string; proof_asset?: string; billing_cycle?: string; amount_paise?: number; extra_members?: number; extra_proxy_gb?: number }) => Promise<{ success: boolean; payment_id?: string; status?: string; message?: string; error?: string }>;
  submitManualCryptoPayment: (payload: { plan_id: string; tx_hash: string; network?: string; proof_asset?: string; billing_cycle?: string; extra_members?: number; extra_proxy_gb?: number }) => Promise<{ success: boolean; payment_id?: string; status?: string; tx_hash?: string; message?: string; error?: string }>;
  accountSignup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  accountLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string; deviceMismatch?: boolean }>;
  accountLoginWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  accountLogout: () => Promise<void>;
  accountSwitchDevice: () => Promise<{ success: boolean; error?: string }>;

  activeSessions: AccountActiveSessionRecord[];
  trialStatus: AccountTrialStatus | null;
  unassignedGuestProfiles: Profile[];

  activateTrial: (planId?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  fetchTrialStatus: () => Promise<AccountTrialStatus | null>;
  checkUnassignedGuestProfiles: () => Promise<Profile[]>;
  claimGuestProfiles: (profileIds?: string[]) => Promise<{ success: boolean; claimedCount: number; error?: string }>;
  dismissGuestProfilesBanner: () => void;
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
      selectedPlanTier: null,
      activeSessions: [],
      trialStatus: null,
      unassignedGuestProfiles: [],

      setDashboardRole: (role) => set({ dashboardRole: role }),
      openAccountModal: (param?: CreateProfileDTO | string | null) => {
        if (typeof param === 'string') {
          set({ isAccountModalOpen: true, selectedPlanTier: param, pendingProfileDto: null });
        } else {
          set({ isAccountModalOpen: true, pendingProfileDto: param || null, selectedPlanTier: null });
        }
      },
      closeAccountModal: () => set({ isAccountModalOpen: false, pendingProfileDto: null, selectedPlanTier: null }),
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
            get().checkUnassignedGuestProfiles().catch((err) => { console.debug('[useAccountStore] guest profiles probe failed', err); });
            get().fetchTrialStatus().catch((err) => { console.debug('[useAccountStore] trial status fetch failed', err); });
          } else if (!get().commercialUser) {
            set({ currentUser: null, accountSession: null });
          }
          if (window.mahiAPI?.getEntitlements) {
            const ent = await window.mahiAPI.getEntitlements();
            if (ent) set({ entitlements: ent });
          }
        } catch (err) {
          console.debug('[useAccountStore] fetchPlanLimits failed', err);
        }
      },

      fetchPaymentInfo: async () => {
        if (!window.mahiAPI) return;
        try {
          const info = await window.mahiAPI.accountGetPaymentInfo();
          set({ paymentInfo: info });
        } catch (err) {
          console.debug('[useAccountStore] fetchPaymentInfo failed', err);
        }
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

      createCheckoutSession: async (payload: AccountCheckoutPayload) => {
        if (!window.mahiAPI?.accountCreateCheckoutSession) {
          return { success: false, error: 'Checkout API unavailable' };
        }
        try {
          return await window.mahiAPI.accountCreateCheckoutSession(payload);
        } catch (err: unknown) {
          return { success: false, error: getErrorMessage(err, 'Checkout session creation failed') };
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
        } catch (err: unknown) {
          return { success: false, error: getErrorMessage(err, 'Payment submission failed') };
        }
      },

      submitManualCryptoPayment: async (payload) => {
        if (!window.mahiAPI?.accountSubmitManualCryptoPayment) {
          return { success: false, error: 'Crypto payment submission API unavailable' };
        }
        try {
          const res = await window.mahiAPI.accountSubmitManualCryptoPayment(payload);
          return res;
        } catch (err: unknown) {
          return { success: false, error: getErrorMessage(err, 'Crypto payment submission failed') };
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
        } catch (err: unknown) {
          return { success: false, error: getErrorMessage(err, 'Signup failed') };
        }
      },

      accountLogin: async (email, password) => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        try {
          const res = await window.mahiAPI.accountLogin({ email, password });
          if (res.success) {
            await get().fetchPlanLimits({ force: true });
            get().checkUnassignedGuestProfiles().catch((err) => { console.debug('[useAccountStore] post-login guest profile check failed', err); });
            get().fetchTrialStatus().catch((err) => { console.debug('[useAccountStore] post-login trial status check failed', err); });
            useProfileStore.getState().fetchProfiles().catch((err) => { console.debug('[useAccountStore] post-login profile refresh failed', err); });
            return { success: true };
          }
          return { success: false, error: res.error || 'Login failed', deviceMismatch: res.device_limit };
        } catch (err: unknown) {
          const deviceMismatch = Boolean(
            err && typeof err === 'object' && 'device_limit' in err
              ? (err as { device_limit?: unknown }).device_limit
              : undefined
          );
          return { success: false, error: getErrorMessage(err, 'Login failed'), deviceMismatch };
        }
      },

      accountLoginWithToken: async (token) => {
        if (!window.mahiAPI?.accountLoginWithToken) return { success: false, error: 'API unavailable' };
        try {
          const res = await window.mahiAPI.accountLoginWithToken(token);
          if (res.success) {
            await get().fetchPlanLimits({ force: true });
            get().checkUnassignedGuestProfiles().catch((err) => { console.debug('[useAccountStore] post-token guest profile check failed', err); });
            get().fetchTrialStatus().catch((err) => { console.debug('[useAccountStore] post-token trial status check failed', err); });
            useProfileStore.getState().fetchProfiles().catch((err) => { console.debug('[useAccountStore] post-token profile refresh failed', err); });
            return { success: true };
          }
          return { success: false, error: res.error || 'Token login failed' };
        } catch (err: unknown) {
          return { success: false, error: getErrorMessage(err, 'Token login failed') };
        }
      },

      accountLogout: async () => {
        try {
          if (window.mahiAPI?.accountLogout) {
            await window.mahiAPI.accountLogout();
          }
        } catch (err) {
          console.debug('[useAccountStore] accountLogout IPC failed', err);
        }
        try {
          if (window.mahiAPI?.commercialLogout) {
            await window.mahiAPI.commercialLogout();
          }
        } catch (err) {
          console.debug('[useAccountStore] commercialLogout IPC failed', err);
        }
        set({
          accountSession: null,
          currentUser: null,
          trialStatus: null,
          unassignedGuestProfiles: [],
          planLimits: { isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null },
          commercialUser: null,
          commercialToken: null,
          entitlements: null,
          userDevices: [],
          isAccountModalOpen: false,
          commercialError: null,
        });
        useProfileStore.getState().fetchProfiles().catch((err) => { console.debug('[useAccountStore] post-logout profile refresh failed', err); });
      },

      accountSwitchDevice: async () => {
        if (!window.mahiAPI) return { success: false, error: 'API unavailable' };
        try {
          const res = await window.mahiAPI.accountSwitchDevice();
          if (res.success) {
            await get().fetchPlanLimits({ force: true });
            return { success: true };
          }
          return { success: false, error: res.message || 'Device switch failed' };
        } catch (err: unknown) {
          return { success: false, error: getErrorMessage(err, 'Device switch failed') };
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
        } catch (err) {
          console.debug('[useAccountStore] fetchActiveSessions failed', err);
        }
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

      fetchTrialStatus: async () => {
        if (!window.mahiAPI?.accountGetTrialStatus) return null;
        try {
          const res = await window.mahiAPI.accountGetTrialStatus();
          if (res?.success) {
            set({ trialStatus: res });
            return res;
          }
          return null;
        } catch {
          return null;
        }
      },

      activateTrial: async (planId?: string) => {
        if (!window.mahiAPI?.accountActivateTrial) {
          return { success: false, error: 'Trial activation API unavailable' };
        }
        try {
          const res = await window.mahiAPI.accountActivateTrial(planId || 'professional_50');
          if (res?.success) {
            await get().fetchPlanLimits({ force: true });
            await get().fetchTrialStatus();
            useProfileStore.getState().fetchProfiles().catch((err) => { console.debug('[useAccountStore] post-trial profile refresh failed', err); });
            return { success: true, message: res.message || '7-Day Free Trial activated successfully!' };
          }
          return { success: false, error: res?.error || 'Trial activation failed' };
        } catch (err: unknown) {
          return { success: false, error: getErrorMessage(err, 'Trial activation failed') };
        }
      },

      checkUnassignedGuestProfiles: async () => {
        if (!window.mahiAPI?.getUnassignedLegacy) return [];
        try {
          const profiles = await window.mahiAPI.getUnassignedLegacy();
          const guestProfiles = Array.isArray(profiles) ? profiles : [];
          set({ unassignedGuestProfiles: guestProfiles });
          return guestProfiles;
        } catch {
          return [];
        }
      },

      claimGuestProfiles: async (profileIds?: string[]) => {
        if (!window.mahiAPI?.claimLegacy) {
          return { success: false, claimedCount: 0, error: 'Profile claim API unavailable' };
        }
        try {
          const ids = profileIds || get().unassignedGuestProfiles.map((p) => p.id);
          if (!ids || ids.length === 0) {
            return { success: true, claimedCount: 0 };
          }
          const res = await window.mahiAPI.claimLegacy({
            profileIds: ids,
            userConfirmed: true,
          });
          if (res?.success) {
            set({ unassignedGuestProfiles: [] });
            await get().fetchPlanLimits({ force: true });
            useProfileStore.getState().fetchProfiles().catch((err) => { console.debug('[useAccountStore] post-claim profile refresh failed', err); });
            return { success: true, claimedCount: res.claimedCount };
          }
          return { success: false, claimedCount: res?.claimedCount || 0, error: res?.error || 'Failed to claim profiles' };
        } catch (err: unknown) {
          return { success: false, claimedCount: 0, error: getErrorMessage(err, 'Failed to claim profiles') };
        }
      },

      dismissGuestProfilesBanner: () => {
        set({ unassignedGuestProfiles: [] });
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
        } catch (err: unknown) {
          const message = getErrorMessage(err, 'Login failed');
          set({ isCommercialLoading: false, commercialError: message });
          return { success: false, error: message };
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
        } catch (err: unknown) {
          const message = getErrorMessage(err, 'Registration failed');
          set({ isCommercialLoading: false, commercialError: message });
          return { success: false, error: message };
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
            const existingUser = get().currentUser;
            set({
              entitlements,
              currentUser: existingUser ? {
                ...existingUser,
                planName: entitlements.plan?.name || existingUser.planName,
                maxProfiles: entitlements.limits?.maxProfiles || existingUser.maxProfiles,
              } : existingUser,
            });
          }
        } catch (err) {
          console.debug('[useAccountStore] syncEntitlements failed', err);
        }
      },

      hasCapability: (cap: string) => {
        const { entitlements, planLimits, currentUser } = get();
        // 1. If explicit server-authoritative capabilities exist in entitlements, evaluate them
        const capValue = entitlements?.capabilities?.[cap as FeatureCapability];
        if (typeof capValue === 'boolean') {
          return capValue;
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
        } catch (err) {
          console.debug('[useAccountStore] fetchUserDevices failed', err);
        }
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
        } catch (err: unknown) {
          return { success: false, message: getErrorMessage(err, 'Activation failed.') };
        }
      },

      logout: async () => {
        await get().accountLogout();
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
          currentUser: state.currentUser,
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
