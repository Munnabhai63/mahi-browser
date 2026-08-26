import { create } from 'zustand';
import { ProxyItem, CreateProxyDTO, UpdateProxyDTO, ProxyTestResult } from '../../10_CONFIG/shared/types/proxy.js';
import { useToastStore } from './useToastStore.js';

interface ProxyState {
  proxies: ProxyItem[];
  loading: boolean;
  testingProxyId: string | null;
  fetchProxies: () => Promise<void>;
  createProxy: (dto: CreateProxyDTO) => Promise<ProxyItem | null>;
  parseAndCreateProxy: (rawString: string, customName?: string) => Promise<{ proxy: ProxyItem; testResult: ProxyTestResult } | null>;
  updateProxy: (id: string, dto: UpdateProxyDTO) => Promise<ProxyItem | null>;
  deleteProxy: (id: string) => Promise<boolean>;
  testProxy: (dto: Partial<CreateProxyDTO>) => Promise<ProxyTestResult>;
}

export const useProxyStore = create<ProxyState>((set, get) => ({
  proxies: [],
  loading: false,
  testingProxyId: null,

  fetchProxies: async () => {
    set({ loading: true });
    try {
      if (window.mahiAPI) {
        const proxies = await window.mahiAPI.getProxies();
        set({ proxies, loading: false });
      }
    } catch (err: unknown) {
      set({ loading: false });
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to load proxies',
        message: msg,
      });
    }
  },

  createProxy: async (dto) => {
    try {
      const proxy = await window.mahiAPI.createProxy(dto);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Proxy Created',
        message: `Proxy "${proxy.name}" added successfully.`,
      });
      await get().fetchProxies();
      return proxy;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to create proxy',
        message: msg,
      });
      return null;
    }
  },

  parseAndCreateProxy: async (rawString, customName) => {
    try {
      const result = await window.mahiAPI.parseAndCreateProxy(rawString, customName);
      await get().fetchProxies();
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Proxy Parse Failed',
        message: msg,
      });
      return null;
    }
  },

  updateProxy: async (id, dto) => {

    try {
      const proxy = await window.mahiAPI.updateProxy(id, dto);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Proxy Updated',
        message: `Proxy "${proxy.name}" updated.`,
      });
      await get().fetchProxies();
      return proxy;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to update proxy',
        message: msg,
      });
      return null;
    }
  },

  deleteProxy: async (id) => {
    try {
      const ok = await window.mahiAPI.deleteProxy(id);
      if (ok) {
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Proxy Deleted',
          message: 'Proxy configuration removed.',
        });
        await get().fetchProxies();
      }
      return ok;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to delete proxy',
        message: msg,
      });
      return false;
    }
  },

  testProxy: async (dto) => {
    try {
      const result = await window.mahiAPI.testProxy(dto);
      if (result.success) {
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Proxy Connected',
          message: `Latency: ${result.latencyMs}ms`,
        });
      } else {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'Proxy Connection Failed',
          message: result.errorMessage || 'Unknown error',
        });
      }
      await get().fetchProxies();
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Proxy Test Error',
        message: msg,
      });
      return { success: false, latencyMs: 0, errorMessage: msg };
    }
  },
}));
