import React, { useState } from 'react';
import {
  Mail,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  User,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useToastStore } from '../stores/useToastStore.js';

export const GmailAccountModal: React.FC = () => {
  const {
    currentUser,
    savedAccounts,
    isAccountModalOpen,
    closeAccountModal,
    loginWithGmail,
    switchAccount,
  } = useAccountStore();

  const [gmailInput, setGmailInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToastStore();

  if (!isAccountModalOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = loginWithGmail(gmailInput);
    if (res.success) {
      showToast({
        type: 'success',
        title: 'Logged In',
        message: `Welcome, ${gmailInput.trim().toLowerCase()}!`,
      });
      setGmailInput('');
      closeAccountModal();
    } else {
      setError(res.error || 'Failed to login');
    }
  };

  const handleSwitch = (email: string) => {
    switchAccount(email);
    showToast({
      type: 'info',
      title: 'Account Switched',
      message: `Active account changed to ${email}`,
    });
    closeAccountModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/20 font-black">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">MAHI User Account</h3>
              <p className="text-xs text-slate-400">Login with your official @gmail.com</p>
            </div>
          </div>
          <button
            onClick={closeAccountModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Saved Accounts List */}
        {savedAccounts.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Saved Accounts
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {savedAccounts.map((acc) => {
                const isCurrent = acc.email === currentUser.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSwitch(acc.email)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition text-left text-xs ${
                      isCurrent
                        ? 'bg-teal-500/10 border-teal-500/40 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className={`w-7 h-7 rounded-lg ${acc.avatarColor || 'bg-teal-600'} text-white flex items-center justify-center font-bold text-xs shrink-0`}>
                        {acc.avatarLetter}
                      </div>
                      <div className="truncate">
                        <div className="truncate">{acc.email}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{acc.planName || 'Enterprise'} Plan</div>
                      </div>
                    </div>
                    {isCurrent && <CheckCircle2 size={16} className="text-teal-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-3.5 pt-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Add / Login New Gmail:
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={gmailInput}
                onChange={(e) => {
                  setGmailInput(e.target.value);
                  setError(null);
                }}
                placeholder="yourname@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition font-mono"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-teal-400 font-semibold select-none pointer-events-none">
                @gmail.com
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle size={14} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-teal-500/20 active:scale-98"
          >
            <span>Login & Switch Account</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500">
          🔒 Fast, passwordless local Gmail account session.
        </p>

      </div>
    </div>
  );
};
