import React, { useState } from 'react';
import { Globe2, Lock, Mail, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useWebAuthStore } from '../state/useWebAuthStore.js';

export const LoginPage: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { login, register, isLoading, error, clearError } = useWebAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (isRegisterMode) {
      await register(email, password, name || email.split('@')[0]);
    } else {
      await login(email, password);
    }
  };

  const handleDemoFill = () => {
    setEmail('admin@mahibrowser.com');
    setPassword('MahiAdmin2026!');
  };

  return (
    <div className="min-h-screen w-screen bg-[#070b14] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0c1222]/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-500 text-white items-center justify-center shadow-xl shadow-teal-500/20 mb-2">
            <Globe2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">MAHI CLOUD CONSOLE</h1>
          <p className="text-xs text-slate-400">
            {isRegisterMode ? 'Create your centralized MAHI account' : 'Sign in to access your cloud-managed browser fleet'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Master Password</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>{isRegisterMode ? 'Create Account' : 'Sign In to Console'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs pt-2">
          <button
            type="button"
            onClick={() => {
              clearError();
              setIsRegisterMode(!isRegisterMode);
            }}
            className="text-teal-400 hover:text-teal-300 font-semibold"
          >
            {isRegisterMode ? 'Already have an account? Sign In' : 'Need an account? Register'}
          </button>
          <button
            type="button"
            onClick={handleDemoFill}
            className="text-slate-500 hover:text-slate-300 text-[11px]"
          >
            Fill Demo
          </button>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
          <span>Central Auth & RBAC enforced by Remote Cloud API v1</span>
        </div>
      </div>
    </div>
  );
};
