import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Mail,
  User,
  Trash2,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useToastStore } from '../stores/useToastStore.js';

interface CommercialUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommercialUserModal: React.FC<CommercialUserModalProps> = ({ isOpen, onClose }) => {
  const {
    commercialUser,
    entitlements,
    userDevices,
    isCommercialLoading,
    commercialError,
    commercialLogin,
    commercialRegister,
    syncEntitlements,
    fetchUserDevices,
    revokeUserDevice,
    activateLicenseKey,
    logout,
  } = useAccountStore();

  const { showToast } = useToastStore();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'DASHBOARD'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isKeyActivating, setIsKeyActivating] = useState(false);

  useEffect(() => {
    if (commercialUser) {
      setMode('DASHBOARD');
      syncEntitlements();
      fetchUserDevices();
    } else {
      setMode('LOGIN');
    }
  }, [commercialUser, isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await commercialLogin(email, password);
    if (res.success) {
      showToast({
        type: 'success',
        title: 'Authentication Successful',
        message: `Welcome back to MAHI Browser!`,
      });
      setMode('DASHBOARD');
    } else {
      showToast({
        type: 'error',
        title: 'Login Failed',
        message: res.error || 'Invalid email or password',
      });
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await commercialRegister(email, password, name);
    if (res.success) {
      showToast({
        type: 'success',
        title: 'Account Created',
        message: `Your MAHI commercial account is active!`,
      });
      setMode('DASHBOARD');
    } else {
      showToast({
        type: 'error',
        title: 'Registration Error',
        message: res.error || 'Failed to create account',
      });
    }
  };

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;
    setIsKeyActivating(true);
    const res = await activateLicenseKey(licenseKeyInput.trim());
    setIsKeyActivating(false);
    if (res.success) {
      showToast({
        type: 'success',
        title: 'License Activated',
        message: res.message,
      });
      setLicenseKeyInput('');
    } else {
      showToast({
        type: 'error',
        title: 'Activation Failed',
        message: res.message,
      });
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    const ok = await revokeUserDevice(deviceId);
    if (ok) {
      showToast({
        type: 'info',
        title: 'Device Removed',
        message: 'Device authorization cleared.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 font-black">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Commercial Account & License</h3>
              <p className="text-xs text-slate-400">Manage plan entitlements and authorized devices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* VIEW 1: USER DASHBOARD (Logged in) */}
        {mode === 'DASHBOARD' && commercialUser && (
          <div className="space-y-5">
            {/* Account & Plan Summary */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-white">{commercialUser.name || commercialUser.email}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {entitlements?.plan?.name || 'Pro Plan'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">{commercialUser.email}</p>
              </div>
              <button
                onClick={() => logout()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
              >
                Sign Out
              </button>
            </div>

            {/* Plan Entitlements Limits */}
            {entitlements && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Profiles Limit</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    {entitlements.usage.profilesCount} / {entitlements.limits.maxProfiles}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Max Devices</span>
                  <div className="text-lg font-bold text-teal-400 font-mono">
                    {entitlements.usage.activeDevicesCount} / {entitlements.limits.maxDevices}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Concurrent Running</span>
                  <div className="text-lg font-bold text-cyan-400 font-mono">
                    {entitlements.usage.runningProfilesCount} / {entitlements.limits.maxConcurrentRunning}
                  </div>
                </div>
              </div>
            )}

            {/* License Key Activation Form */}
            <form onSubmit={handleActivateKey} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Key size={14} className="text-emerald-400" />
                <span>Activate License Key</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="MAHI-XXXX-XXXX-XXXX"
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 uppercase"
                />
                <button
                  type="submit"
                  disabled={isKeyActivating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {isKeyActivating ? 'Activating...' : 'Activate'}
                </button>
              </div>
            </form>

            {/* My Authorized Devices */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Authorized Devices ({userDevices.length})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scroll">
                {userDevices.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Laptop size={16} className="text-teal-400" />
                      <div>
                        <div className="font-bold text-white">{d.deviceName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{d.deviceId}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        d.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {d.status}
                      </span>
                      {d.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevokeDevice(d.deviceId)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Revoke Device"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: LOGIN FORM */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@domain.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isCommercialLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <span>{isCommercialLoading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight size={14} />
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              <span>Don't have an account? </span>
              <button
                type="button"
                onClick={() => setMode('REGISTER')}
                className="text-emerald-400 font-bold hover:underline"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* VIEW 3: REGISTER FORM */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Full Name / Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@domain.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Password (min 6 chars)</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isCommercialLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <span>{isCommercialLoading ? 'Creating Account...' : 'Create Commercial Account'}</span>
              <Sparkles size={14} />
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              <span>Already have an account? </span>
              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="text-emerald-400 font-bold hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
