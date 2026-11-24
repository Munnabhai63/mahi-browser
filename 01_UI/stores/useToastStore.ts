import { create } from 'zustand';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

const DEBOUNCE_WINDOW_MS = 1500;
const recentToastTimestamps = new Map<string, number>();

export function resetToastDebounceHistoryForTests(): void {
  recentToastTimestamps.clear();
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (toast) => {
    const key = `${toast.type}:${toast.title}:${toast.message || ''}`;
    const now = Date.now();
    const lastSeen = recentToastTimestamps.get(key) || 0;

    if (now - lastSeen < DEBOUNCE_WINDOW_MS) {
      return;
    }
    recentToastTimestamps.set(key, now);

    // Prune stale keys if map exceeds 50 items
    if (recentToastTimestamps.size > 50) {
      for (const [k, time] of recentToastTimestamps.entries()) {
        if (now - time > 10000) {
          recentToastTimestamps.delete(k);
        }
      }
    }

    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, item] }));

    const duration = toast.duration || 4000;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clearAllToasts: () => {
    set({ toasts: [] });
    recentToastTimestamps.clear();
  },
}));
