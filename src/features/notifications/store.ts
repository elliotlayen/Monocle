import { create } from "zustand";

export interface Toast {
  id: string;
  type: "info" | "success" | "error" | "warning" | "update";
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
  progress?: { current: number; total: number };
  actions?: { label: string; onClick: () => void }[];
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  updateToast: (id: string, updates: Partial<Omit<Toast, "id">>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

let toastIdCounter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastIdCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    return id;
  },

  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((toast) =>
        toast.id === id ? { ...toast, ...updates } : toast
      ),
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

// Helper function to show a toast outside of React components
export function showToast(toast: Omit<Toast, "id">): string {
  return useToastStore.getState().addToast(toast);
}
