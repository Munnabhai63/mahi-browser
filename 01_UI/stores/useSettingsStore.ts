import { create } from 'zustand';
import type { AppSettings } from '../../10_CONFIG/shared/types/settings.js';
import { DEFAULT_APP_SETTINGS } from '../../10_CONFIG/shared/constants/defaults.js';
import { useToastStore } from './useToastStore.js';

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  isLocked: boolean;
  theme: 'light' | 'dark' | 'system';
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  unlockApp: (pin: string) => Promise<boolean>;
  lockApp: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  loading: false,
  isLocked: false,
  theme: 'light',

  fetchSettings: async () => {
    set({ loading: true });
    try {
      if (window.mahiAPI) {
        const settings = await window.mahiAPI.getAppSettings();
        const theme = settings.general.theme || 'light';
        const isLocked = Boolean(settings.security.appLockEnabled && settings.security.appLockPinHash);

        set({ settings, theme, isLocked });
        get().setTheme(theme);
      }
    } catch (err) {
      console.debug('[useSettingsStore] app settings fetch failed', err);
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const updated = await window.mahiAPI.updateAppSettings(newSettings);
      set({ settings: updated });
      if (newSettings.general?.theme) {
        get().setTheme(newSettings.general.theme);
      }
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Application preferences updated.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Settings Save Failed',
        message: msg,
      });
    }
  },

  setTheme: (theme) => {
    set({ theme });
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  },

  unlockApp: async (pin) => {
    try {
      const valid = await window.mahiAPI.verifyAppPin(pin);
      if (valid) {
        set({ isLocked: false });
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Unlocked',
          message: 'Welcome back to MAHI BROWSER',
        });
        return true;
      } else {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'PIN Incorrect',
          message: 'The PIN you entered is invalid.',
        });
        return false;
      }
    } catch {
      return false;
    }
  },

  lockApp: () => {
    const { settings } = get();
    if (settings.security.appLockEnabled) {
      set({ isLocked: true });
    }
  },
}));
