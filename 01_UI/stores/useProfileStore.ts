import { create } from 'zustand';
import type {
  Profile,
  CreateProfileDTO,
  UpdateProfileDTO,
  CloneProfileDTO,
  ProfileFilterOptions,
  ProfileStatus,
} from '../../10_CONFIG/shared/types/profile.js';
import { useToastStore } from './useToastStore.js';

type BridgeApi = NonNullable<Window['mahiAPI']>;

interface ProfileState {
  profiles: Profile[];
  loading: boolean;
  selectedProfileId: string | null;
  filter: ProfileFilterOptions;
  viewMode: 'table' | 'grid';
  fetchProfiles: () => Promise<void>;
  setSelectedProfileId: (id: string | null) => void;
  setFilter: (filter: Partial<ProfileFilterOptions>) => void;
  setViewMode: (mode: 'table' | 'grid') => void;
  createProfile: (dto: CreateProfileDTO) => Promise<Profile | null>;
  bulkCreateProfiles: (dto: { count: number; namePrefix?: string; folder?: string; tags?: string[]; proxyId?: string; osType?: 'windows' | 'mac' | 'random' }) => Promise<Profile[]>;
  updateProfile: (id: string, dto: UpdateProfileDTO) => Promise<Profile | null>;

  deleteProfile: (id: string) => Promise<boolean>;
  trashProfiles: Profile[];
  fetchTrashProfiles: () => Promise<void>;
  restoreProfile: (id: string) => Promise<boolean>;
  permanentDeleteProfile: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<boolean>;
  cloneProfile: (dto: CloneProfileDTO) => Promise<Profile | null>;

  startProfile: (id: string) => Promise<boolean>;
  startProfileDetailed: (
    id: string,
    options?: { suppressConflictToast?: boolean }
  ) => Promise<{
    success: boolean;
    pid?: number;
    error?: string;
    code?: 'MOBILE_MODE_CONFLICT' | 'MOBILE_MODE_ROTATION_FAILED' | 'MOBILE_MODE_IP_UNCHANGED';
    runningProfileId?: string;
    runningProfileName?: string;
    rotatedIp?: string;
    notesUpdated?: boolean;
  }>;
  stopProfile: (id: string) => Promise<boolean>;
  bulkStartProfiles: (ids: string[], delayMs?: number) => Promise<{ results: { profileId: string; success: boolean; pid?: number; error?: string }[] }>;
  bulkStopProfiles: (ids: string[]) => Promise<boolean>;
  bulkUpdateProfiles: (dto: { profileIds: string[]; folder?: string; addTags?: string[]; removeTags?: string[]; notes?: string }) => Promise<boolean>;
  bulkDeleteProfiles: (ids: string[]) => Promise<boolean>;
  bulkAssignProxies: (dto: { profileIds: string[]; proxyIds: string[]; distributionMode: 'single' | 'round-robin' | 'clear' }) => Promise<boolean>;
  warmProfile: (
    id: string,
    options?: Parameters<BridgeApi['warmProfile']>[1]
  ) => ReturnType<BridgeApi['warmProfile']>;
  warmBulkProfiles: (
    ids: string[],
    options?: Parameters<BridgeApi['warmBulkProfiles']>[1]
  ) => ReturnType<BridgeApi['warmBulkProfiles']>;
  handleStatusChange: (data: { profileId: string; status: string; pid?: number; error?: string }) => void;
}



export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  trashProfiles: [],
  loading: false,
  selectedProfileId: null,

  filter: {
    searchQuery: '',
    folder: '',
    tag: '',
    status: 'ALL',
    pinnedOnly: false,
    sortBy: 'createdAt',
    sortDirection: 'desc',
  },
  viewMode: 'table',

  fetchProfiles: async () => {
    set({ loading: true });
    try {
      if (window.mahiAPI) {
        const profiles = await window.mahiAPI.getProfiles(get().filter);
        set({ profiles });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to load profiles',
        message: msg,
      });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedProfileId: (id) => set({ selectedProfileId: id }),

  setFilter: (newFilter) => {
    set((state) => ({ filter: { ...state.filter, ...newFilter } }));
    get().fetchProfiles();
  },

  setViewMode: (viewMode) => set({ viewMode }),

  createProfile: async (dto) => {
    try {
      const profile = await window.mahiAPI.createProfile(dto);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Profile Created',
        message: `Profile "${profile.name}" created successfully.`,
      });
      await get().fetchProfiles();
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Free plan limit reached') || msg.includes('Pro plan limit reached') || msg.includes('PROFILE_LIMIT_REACHED')) {
        import('./useAccountStore.js').then(({ useAccountStore }) => {
          useAccountStore.getState().openAccountModal(dto);
        });
      }
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Creation Failed',
        message: msg,
      });
      return null;
    }
  },

  bulkCreateProfiles: async (dto) => {
    set({ loading: true });
    try {
      const created = await window.mahiAPI.bulkCreateProfiles(dto);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Profiles Created',
        message: `Successfully created ${created.length} new profiles!`,
      });
      await get().fetchProfiles();
      set({ loading: false });
      return created;
    } catch (err: unknown) {
      set({ loading: false });
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Free plan limit reached') || msg.includes('Pro plan limit reached')) {
        import('./useAccountStore.js').then(({ useAccountStore }) => {
          useAccountStore.getState().openAccountModal();
        });
      }
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Bulk Creation Failed',
        message: msg,
      });
      return [];
    }
  },

  updateProfile: async (id, dto) => {

    try {
      const profile = await window.mahiAPI.updateProfile(id, dto);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Profile Updated',
        message: `Profile "${profile.name}" updated successfully.`,
      });
      await get().fetchProfiles();
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Update Failed',
        message: msg,
      });
      return null;
    }
  },

  deleteProfile: async (id) => {
    try {
      const ok = await window.mahiAPI.deleteProfile(id);
      if (ok) {
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Moved to Trash',
          message: 'Profile moved to 30-day Trash Bin. You can restore it anytime.',
        });
        await get().fetchProfiles();
        await get().fetchTrashProfiles();
      }
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Delete Failed',
        message: msg,
      });
      return false;
    }
  },

  fetchTrashProfiles: async () => {
    try {
      if (window.mahiAPI?.getTrashProfiles) {
        const trash = await window.mahiAPI.getTrashProfiles();
        set({ trashProfiles: Array.isArray(trash) ? trash : [] });
      }
    } catch (err) {
      console.error('Failed to fetch trash profiles:', err);
    }
  },

  restoreProfile: async (id) => {
    try {
      const restored = await window.mahiAPI.restoreProfile(id);
      if (restored) {
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Profile Restored',
          message: `Restored "${restored.name}" back to your active list.`,
        });
        await get().fetchProfiles();
        await get().fetchTrashProfiles();
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Restore Failed',
        message: msg,
      });
      return false;
    }
  },

  permanentDeleteProfile: async (id) => {
    try {
      const ok = await window.mahiAPI.permanentDeleteProfile(id);
      if (ok) {
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Permanently Deleted',
          message: 'Profile and all session files removed permanently.',
        });
        await get().fetchTrashProfiles();
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Delete Failed',
        message: msg,
      });
      return false;
    }
  },

  emptyTrash: async () => {
    try {
      const res = await window.mahiAPI.emptyTrash();
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Trash Emptied',
        message: `Permanently deleted ${res.deletedCount} profiles.`,
      });
      await get().fetchTrashProfiles();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Empty Trash Failed',
        message: msg,
      });
      return false;
    }
  },


  cloneProfile: async (dto) => {
    try {
      const profile = await window.mahiAPI.cloneProfile(dto);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Profile Cloned',
        message: `Cloned into "${profile.name}".`,
      });
      await get().fetchProfiles();
      return profile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Clone Failed',
        message: msg,
      });
      return null;
    }
  },

  startProfileDetailed: async (id, options) => {
    try {
      const res = await window.mahiAPI.startProfile(id);
      if (res.notesUpdated) {
        await get().fetchProfiles();
      }
      if (!res.success) {
        if (!(options?.suppressConflictToast && res.code === 'MOBILE_MODE_CONFLICT')) {
          useToastStore.getState().showToast({
            type: 'error',
            title: res.code === 'MOBILE_MODE_CONFLICT' ? 'Mobile Mode: 1 Profile Limit' : 'Launch Failed',
            message: res.error || 'Could not start browser process',
          });
        }
        return res;
      }
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Launch Failed',
        message: msg,
      });
      return { success: false, error: msg };
    }
  },

  startProfile: async (id) => {
    const res = await get().startProfileDetailed(id);
    return Boolean(res.success);
  },

  stopProfile: async (id) => {
    try {
      const res = await window.mahiAPI.stopProfile(id);
      if (!res.success) {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'Stop Failed',
          message: res.error || 'Could not stop browser process',
        });
        return false;
      }
      return true;
    } catch (err: unknown) {

      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Stop Failed',
        message: msg,
      });
      return false;
    }
  },

  bulkStartProfiles: async (ids, delayMs = 1500) => {
    try {
      const res = await window.mahiAPI.bulkStartProfiles(ids, delayMs);
      await get().fetchProfiles();
      const successCount = res.results.filter((r) => r.success).length;
      useToastStore.getState().showToast({
        type: successCount > 0 ? 'success' : 'error',
        title: 'Batch Launch Complete',
        message: `Successfully launched ${successCount} of ${ids.length} profiles.`,
      });
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Batch Launch Failed',
        message: msg,
      });
      return { results: [] };
    }
  },

  bulkStopProfiles: async (ids) => {
    try {
      const res = await window.mahiAPI.bulkStopProfiles(ids);
      await get().fetchProfiles();
      const successCount = res.results.filter((r) => r.success).length;
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Batch Stop Complete',
        message: `Stopped ${successCount} running profiles.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Batch Stop Failed',
        message: msg,
      });
      return false;
    }
  },

  bulkUpdateProfiles: async (dto) => {
    try {
      await window.mahiAPI.bulkUpdateProfiles(dto);
      await get().fetchProfiles();
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Batch Update Successful',
        message: `Updated ${dto.profileIds.length} profiles.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Batch Update Failed',
        message: msg,
      });
      return false;
    }
  },

  bulkDeleteProfiles: async (ids) => {
    try {
      await window.mahiAPI.bulkDeleteProfiles(ids);
      await get().fetchProfiles();
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Batch Delete Successful',
        message: `Deleted ${ids.length} profiles.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Batch Delete Failed',
        message: msg,
      });
      return false;
    }
  },

  bulkAssignProxies: async (dto) => {
    try {
      await window.mahiAPI.bulkAssignProxies(dto);
      await get().fetchProfiles();
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Proxies Assigned',
        message: `Assigned proxies to ${dto.profileIds.length} profiles.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Proxy Assignment Failed',
        message: msg,
      });
      return false;
    }
  },

  warmProfile: async (id, options) => {

    try {
      const res = await window.mahiAPI.warmProfile(id, options);
      await get().fetchProfiles();
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Warmup Failed',
        message: msg,
      });
      throw err;
    }
  },

  warmBulkProfiles: async (ids, options) => {
    try {
      const res = await window.mahiAPI.warmBulkProfiles(ids, options);
      await get().fetchProfiles();
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Bulk Warmup Failed',
        message: msg,
      });
      throw err;
    }
  },


  handleStatusChange: ({ profileId, status, pid, error }) => {
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === profileId
          ? {
              ...p,
              status: status as ProfileStatus,
              activePid: pid,
              lastError: error,
              lastUsedAt: status === 'RUNNING' ? new Date().toISOString() : p.lastUsedAt,
            }
          : p
      ),
    }));
    // After a session ends, refetch profiles to load freshly accumulated stats from DB
    // (totalSessions, totalUptimeSeconds are written on stop — we need to reload to reflect them)
    if (status === 'STOPPED' || status === 'ERROR') {
      setTimeout(() => {
        get().fetchProfiles();
      }, 500);
    }
  },
}));
