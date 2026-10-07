import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Sparkles,
  Cloud,
  CheckCircle2,
  Copy,
  LogOut,
  ExternalLink,
  Laptop,
  AlertTriangle,
  Lock,
  Mail,
  Zap,
} from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useToastStore } from '../stores/useToastStore.js';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const {
    accountSession,
    planLimits,
    paymentInfo,
    pendingProfileDto,
    clearPendingProfileDto,
    accountSignup,
    accountLogin,
    accountLogout,
    accountSwitchDevice,
    fetchPlanLimits,
    fetchPaymentInfo,
  } = useAccountStore();

  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceMismatchError, setDeviceMismatchError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPlanLimits().catch(() => {});
      fetchPaymentInfo().catch(() => {});
      setErrorMessage(null);
      setDeviceMismatchError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await accountSignup(email.trim(), password);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'PRO Trial Activated!',
          message: 'Enjoy 100 anti-detect profiles and encrypted cloud sync for 7 days.',
        });
        onClose();

        // If user was blocked while creating a profile (16th profile), trigger creation now
        if (pendingProfileDto && window.mahiAPI) {
          try {
            await window.mahiAPI.createProfile(pendingProfileDto);
            showToast({
              type: 'success',
              title: 'Profile Created',
              message: `Profile "${pendingProfileDto.name}" successfully created with PRO entitlement.`,
            });
            clearPendingProfileDto();
          } catch {}
        }
      } else {
        setErrorMessage(res.error || 'Failed to create account.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Signup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDeviceMismatchError(false);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await accountLogin(email.trim(), password);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Welcome Back!',
          message: 'Successfully logged in to your MAHI Browser account.',
        });
        onClose();

        if (pendingProfileDto && window.mahiAPI) {
          try {
            await window.mahiAPI.createProfile(pendingProfileDto);
            clearPendingProfileDto();
          } catch {}
        }
      } else {
        setErrorMessage(res.error || 'Invalid credentials.');
        if (res.deviceMismatch) {
          setDeviceMismatchError(true);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed.');
      if (err.device_limit) {
        setDeviceMismatchError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchDeviceClick = async () => {
    setIsLoading(true);
    try {
      const res = await accountSwitchDevice();
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Device Rebound',
          message: 'This device is now registered as your active PC.',
        });
        setDeviceMismatchError(false);
        setErrorMessage(null);
        await fetchPlanLimits();
      } else {
        setErrorMessage(res.error || 'Device switch rejected by cooldown.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to switch device.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    setIsLoading(true);
    try {
      await accountLogout();
      showToast({
        type: 'info',
        title: 'Logged Out',
        message: 'Reverted to Free tier (15 profiles). Your local data is completely safe.',
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast({
      type: 'success',
      title: 'Copied!',
      message: `${label} copied to clipboard.`,
    });
  };

  const isUserLoggedIn = Boolean(accountSession?.token);
  const currentPlan = planLimits?.plan || 'free';
  const isProActive = planLimits?.isPro || false;

  const priceInr = paymentInfo?.price_inr || 0;
  const priceUsdt = paymentInfo?.price_usdt || 0;
  const upiId = paymentInfo?.upi_id || 'Loading...';
  const usdtAddress = paymentInfo?.usdt_address || 'Loading...';
  const waNumber = paymentInfo?.whatsapp_number || '';
  const waCleanNumber = waNumber.replace(/[^0-9]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative text-slate-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              M
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">MAHI BROWSER ACCOUNT</h3>
              <p className="text-[11px] text-slate-400">GoLogin-Style Multi-Device Cloud Sync</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {isUserLoggedIn ? (
            /* ========================================================== */
            /* VIEW A: LOGGED IN USER STATUS & SUBSCRIPTION DETAILS       */
            /* ========================================================== */
            <div className="space-y-6">
              {/* Account Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">ACCOUNT EMAIL</span>
                    <h4 className="text-sm font-bold text-white">{accountSession?.email}</h4>
                  </div>
                  <div>
                    {currentPlan === 'pro' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Zap size={13} /> PRO ACTIVE
                      </span>
                    )}
                    {currentPlan === 'trial' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                        <Sparkles size={13} /> 7-DAY TRIAL
                      </span>
                    )}
                    {currentPlan === 'free' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
                        FREE PLAN (15/15)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/40 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Profile Capacity</span>
                    <strong className="text-white font-mono">{planLimits?.maxProfiles || 15} Profiles</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Expires On</span>
                    <strong className="text-white font-mono">
                      {planLimits?.expiresAt ? new Date(planLimits.expiresAt).toLocaleDateString() : 'Never (Free)'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Upgrade Pitch if not Pro or Trial Expired */}
              {!isProActive && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-teal-950/40 to-slate-900 border border-teal-800/60">
                  <div className="flex items-center gap-2 mb-2 text-teal-400">
                    <Sparkles size={16} />
                    <h4 className="font-bold text-sm text-white">Upgrade to MAHI PRO (100 Profiles)</h4>
                  </div>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Unlock 100 anti-detect profiles and encrypted cross-device cloud sync for ₹{priceInr}/year (UPI) or ≈${priceUsdt} USDT (TRC20).
                  </p>

                  {/* Payment Details Box */}
                  <div className="space-y-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">UPI ID:</span>
                      <div className="flex items-center gap-2">
                        <strong className="text-teal-400">{upiId}</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(upiId, 'UPI ID')}
                          className="text-slate-400 hover:text-white"
                          title="Copy UPI ID"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">USDT (TRC20):</span>
                      <div className="flex items-center gap-2">
                        <strong className="text-teal-400 truncate max-w-[180px]">{usdtAddress}</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(usdtAddress, 'USDT TRC20 Address')}
                          className="text-slate-400 hover:text-white"
                          title="Copy USDT TRC20 Address"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/${waCleanNumber}?text=${encodeURIComponent(`Hi, I would like to activate MAHI PRO for account email: ${accountSession?.email}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition"
                  >
                    <span>Send Payment Proof to WhatsApp</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSwitchDeviceClick}
                  disabled={isLoading}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <Laptop size={14} />
                  <span>Rebind Device</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogoutClick}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 transition flex items-center gap-1.5"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* VIEW B: SIGN UP (7-DAY TRIAL) / SIGN IN TABS               */
            /* ========================================================== */
            <div>
              {/* Tabs Bar */}
              <div className="flex p-1 bg-slate-950 rounded-2xl mb-6 border border-slate-800">
                <button
                  type="button"
                  onClick={() => { setActiveTab('signup'); setErrorMessage(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                    activeTab === 'signup'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Start 7-Day PRO Trial
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                    activeTab === 'signin'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{errorMessage}</span>
                    {deviceMismatchError && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={handleSwitchDeviceClick}
                          className="px-3 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-[11px] font-bold transition"
                        >
                          Switch Active Device to this PC
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'signup' ? (
                /* TAB 1: 7-DAY TRIAL SIGN UP */
                <div>
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-800/50 mb-5">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <Sparkles size={16} />
                      <h4 className="font-bold text-sm text-white">Start Your 7-Day Free PRO Trial</h4>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span><strong>100 anti-detect profiles</strong> with unlimited tabs</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span><strong>End-to-end encrypted cloud sync</strong> across multiple machines</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>Full hardware stealth & isolation (Chrome 138 engine)</span>
                      </li>
                    </ul>
                  </div>

                  <form onSubmit={handleSignupSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="yourname@gmail.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 8 chars"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-type password"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-2 mt-2"
                    >
                      {isLoading ? <span>Activating Trial...</span> : <span>Create Account & Start 7-Day PRO Trial</span>}
                    </button>
                    <p className="text-[11px] text-center text-slate-500">
                      Zero credit card needed. Instant access to 100 profiles.
                    </p>
                  </form>
                </div>
              ) : (
                /* TAB 2: SIGN IN */
                <div>
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="yourname@gmail.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 mt-2"
                    >
                      {isLoading ? <span>Signing In...</span> : <span>Sign In</span>}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
