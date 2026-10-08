import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  isPending = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const buttonStyle =
    confirmVariant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
      : confirmVariant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
      : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                confirmVariant === 'danger'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">Irreversible Action</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
          <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 ${buttonStyle}`}
          >
            {isPending ? (
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : confirmVariant === 'danger' ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : null}
            <span>{isPending ? 'Processing...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
