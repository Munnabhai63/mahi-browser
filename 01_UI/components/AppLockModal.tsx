import React, { useState } from 'react';
import { Lock, KeyRound, ArrowRight } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore.js';

export const AppLockModal: React.FC = () => {
  const { isLocked, unlockApp } = useSettingsStore();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isLocked) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    const success = await unlockApp(pin);
    setLoading(false);
    if (!success) {
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md select-none">
      <div className="bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-800 p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-teal-500/20 text-slate-950 mb-6">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-wide">MAHI BROWSER</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">Application is locked. Enter your PIN to continue.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN..."
              maxLength={12}
              className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center tracking-widest text-lg font-mono text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center space-x-2 transition-all active:scale-98"
          >
            <span>{loading ? 'Verifying...' : 'Unlock Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
