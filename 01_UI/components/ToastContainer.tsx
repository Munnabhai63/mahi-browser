import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, ToastItem } from '../stores/useToastStore.js';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full select-none pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-xl shadow-xl border flex items-start space-x-3 transition-all transform animate-in slide-in-from-top-5 duration-200 backdrop-blur-md bg-slate-900/85 ${
            toast.type === 'success'
              ? 'text-slate-100 border-emerald-500/50 shadow-emerald-500/10'
              : toast.type === 'error'
              ? 'text-slate-100 border-rose-500/50 shadow-rose-500/10'
              : toast.type === 'warning'
              ? 'text-slate-100 border-amber-500/50 shadow-amber-500/10'
              : 'text-slate-100 border-teal-500/40 shadow-teal-500/10'
          }`}
        >
          <div className="mt-0.5">
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-teal-400" />}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white">{toast.title}</h4>
            {toast.message && <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
