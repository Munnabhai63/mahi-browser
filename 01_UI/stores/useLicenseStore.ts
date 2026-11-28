import { create } from 'zustand';
import type {
  LicenseRecord,
  LicenseValidationResult,
  CreateLicenseDTO,
  CreateLicenseResponse,
  ExtendLicenseDTO,
  ActivatedDevice,
} from '../../10_CONFIG/shared/types/license.js';

interface LicenseState {
  currentLicenseStatus: LicenseValidationResult | null;
  isLoading: boolean;
  error: string | null;

  // Admin state
  adminLicenses: LicenseRecord[];
  selectedLicenseDevices: ActivatedDevice[];
  isAdminAuthenticated: boolean;
  adminSecret: string;

  // Actions
  fetchCurrentStatus: () => Promise<LicenseValidationResult>;
  activate: (rawKey: string, accountId?: string) => Promise<{ success: boolean; message?: string }>;
  setAdminSecret: (secret: string) => void;
  adminLogin: (secret: string) => Promise<boolean>;
  adminFetchLicenses: (filter?: { status?: string; searchQuery?: string }) => Promise<void>;
  adminCreate: (dto: CreateLicenseDTO) => Promise<CreateLicenseResponse>;
  adminRevoke: (licenseId: string, reason?: string) => Promise<boolean>;
  adminExtend: (dto: ExtendLicenseDTO) => Promise<boolean>;
  adminFetchDevices: (licenseId: string) => Promise<void>;
  adminDeactivateDev: (licenseId: string, deviceId: string) => Promise<boolean>;
  adminChangePin: (newPin: string) => Promise<boolean>;
}

export const useLicenseStore = create<LicenseState>((set, get) => ({

  currentLicenseStatus: null,
  isLoading: false,
  error: null,
  adminLicenses: [],
  selectedLicenseDevices: [],
  isAdminAuthenticated: false,
  adminSecret: '',

  fetchCurrentStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await window.mahiAPI.getLicenseStatus();
      set({ currentLicenseStatus: res, isLoading: false });
      return res;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : undefined;
      const fallback: LicenseValidationResult = {
        isValid: false,
        status: 'NOT_ACTIVATED',
        message: errMsg || 'Error checking license',
      };
      set({ currentLicenseStatus: fallback, isLoading: false, error: errMsg });
      return fallback;
    }
  },

  activate: async (rawKey: string, accountId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await window.mahiAPI.activateLicense({
        licenseKey: rawKey,
        accountId,
      });

      await get().fetchCurrentStatus();
      set({ isLoading: false });
      return { success: res.success, message: res.message };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : undefined;
      set({ isLoading: false, error: errMsg });
      return { success: false, message: errMsg || 'Activation failed' };
    }
  },

  setAdminSecret: (secret: string) => set({ adminSecret: secret }),

  adminLogin: async (secret: string) => {
    set({ isLoading: true, error: null });
    try {
      const list = await window.mahiAPI.adminGetLicenses(secret);
      set({
        adminSecret: secret,
        isAdminAuthenticated: true,
        adminLicenses: list,
        isLoading: false,
      });
      return true;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : undefined;
      set({
        isAdminAuthenticated: false,
        isLoading: false,
        error: errMsg || 'Invalid admin credentials',
      });
      return false;
    }
  },

  adminFetchLicenses: async (filter) => {
    const { adminSecret } = get();
    if (!adminSecret) return;
    try {
      const list = await window.mahiAPI.adminGetLicenses(adminSecret, filter);
      set({ adminLicenses: list });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  adminCreate: async (dto: CreateLicenseDTO) => {
    const { adminSecret } = get();
    const res = await window.mahiAPI.adminCreateLicense(dto, adminSecret);
    await get().adminFetchLicenses();
    return res;
  },

  adminRevoke: async (licenseId: string, reason?: string) => {
    const { adminSecret } = get();
    const ok = await window.mahiAPI.adminRevokeLicense(licenseId, adminSecret, reason);
    await get().adminFetchLicenses();
    return ok;
  },

  adminExtend: async (dto: ExtendLicenseDTO) => {
    const { adminSecret } = get();
    const res = await window.mahiAPI.adminExtendLicense(dto, adminSecret);
    await get().adminFetchLicenses();
    return Boolean(res);
  },

  adminFetchDevices: async (licenseId: string) => {
    const { adminSecret } = get();
    try {
      const devices = await window.mahiAPI.adminGetLicenseDevices(licenseId, adminSecret);
      set({ selectedLicenseDevices: devices });
    } catch {
      set({ selectedLicenseDevices: [] });
    }
  },

  adminDeactivateDev: async (licenseId: string, deviceId: string) => {
    const { adminSecret } = get();
    const ok = await window.mahiAPI.adminDeactivateDevice(licenseId, deviceId, adminSecret);
    await get().adminFetchDevices(licenseId);
    await get().adminFetchLicenses();
    return ok;
  },

  adminChangePin: async (newPin: string) => {
    const { adminSecret } = get();
    const ok = await window.mahiAPI.adminSetPin(newPin, adminSecret);
    if (ok) {
      set({ adminSecret: newPin });
    }
    return ok;
  },
}));

