import { create } from 'zustand';
import { ActivityLogItem, ActivityLogFilter } from '../../10_CONFIG/shared/types/logs.js';

interface LogState {
  logs: ActivityLogItem[];
  loading: boolean;
  filter: ActivityLogFilter;
  fetchLogs: () => Promise<void>;
  setFilter: (filter: Partial<ActivityLogFilter>) => void;
  addLog: (log: ActivityLogItem) => void;
  clearLogs: () => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  loading: false,
  filter: {
    limit: 100,
  },

  fetchLogs: async () => {
    set({ loading: true });
    try {
      if (window.mahiAPI) {
        const logs = await window.mahiAPI.getActivityLogs(get().filter);
        set({ logs });
      }
    } catch {
      // ignore
    } finally {
      set({ loading: false });
    }
  },

  setFilter: (newFilter) => {
    set((state) => ({ filter: { ...state.filter, ...newFilter } }));
    get().fetchLogs();
  },

  addLog: (log) => {
    set((state) => ({ logs: [log, ...state.logs].slice(0, 300) }));
  },

  clearLogs: async () => {
    try {
      if (window.mahiAPI) {
        await window.mahiAPI.clearActivityLogs();
        set({ logs: [] });
      }
    } catch {
      // ignore
    }
  },
}));
