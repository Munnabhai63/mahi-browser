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
  Smartphone,
  Globe,
  AlertTriangle,
  Lock,
  Mail,
  Zap,
  KeyRound,
  RotateCcw,
  Trash2,
  ArrowLeft,
  Check,
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
    activeSessions,
    fetchActiveSessions,
    revokeSession,
    revokeAllSessions,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
  } = useAccountStore();

  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'signup' | 'signin' | 'verify' | 'forgot' | 'reset'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [deviceMismatchError, setDeviceMismatchError] = useState(false);

  const isUserLoggedIn = Boolean(accountSession?.token);

  useEffect(() => {
    if (isOpen) {
      fetchPlanLimits().catch(() => {});
      fetchPaymentInfo().catch(() => {});
      if (isUserLoggedIn) {
        fetchActiveSessions().catch(() => {});
      }
      setErrorMessage(null);
      setSuccessInfo(null);
      setDeviceMismatchError(false);
    }
  }, [isOpen, isUserLoggedIn]);

  if (!isOpen) return null;

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

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
          title: 'Account Registered',
          message: 'Verification instructions sent to your email.',
        });
        setSuccessInfo('Registration successful. Enter the verification token sent to your email to verify your account.');
        setActiveTab('verify');

        if (pendingProfileDto && window.mahiAPI) {
          try {
            await window.mahiAPI.createProfile(pendingProfileDto);
            showToast({
              type: 'success',
              title: 'Profile Created',
              message: `Profile "${pendingProfileDto.name}" created.`,
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
    setSuccessInfo(null);
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
        await fetchActiveSessions().catch(() => {});
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

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    if (!verificationToken.trim()) {
      setErrorMessage('Please enter the verification token.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyEmail(verificationToken.trim());
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Email Verified',
          message: 'Your email has been verified. You can now sign in.',
        });
        setSuccessInfo('Email verified successfully! Please sign in.');
        setActiveTab('signin');
      } else {
        setErrorMessage(res.error || 'Verification failed. The token may be expired or invalid.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationClick = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email address to resend verification.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await resendVerification(email.trim());
      if (res.success) {
        showToast({
          type: 'info',
          title: 'Verification Resent',
          message: `Verification link sent to ${email.trim()}.`,
        });
        setSuccessInfo(`A fresh verification token has been sent to ${email.trim()}.`);
      } else {
        setErrorMessage(res.error || 'Failed to resend verification.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your account email.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      if (res.success) {
        showToast({
          type: 'info',
          title: 'Instructions Sent',
          message: 'If an account exists, a reset token was generated.',
        });
        setSuccessInfo('Password reset instructions sent. Enter your token below.');
        setActiveTab('reset');
      } else {
        setErrorMessage(res.error || 'Failed to request reset token.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    if (!resetToken.trim() || !newPassword) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword(resetToken.trim(), newPassword);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Password Updated',
          message: 'Your password has been reset successfully. Please log in.',
        });
        setSuccessInfo('Password reset successfully. Sign in with your new password.');
        setPassword('');
        setActiveTab('signin');
      } else {
        setErrorMessage(res.error || 'Password reset failed. Token may be invalid or expired.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSessionClick = async (sessionId: string) => {
    try {
      const res = await revokeSession(sessionId);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Session Revoked',
          message: 'Device session has been disconnected.',
        });
      } else {
        showToast({
          type: 'error',
          title: 'Revoke Failed',
          message: res.error || 'Could not revoke session.',
        });
      }
    } catch {}
  };

  const handleRevokeAllSessionsClick = async () => {
    try {
      const res = await revokeAllSessions(true);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Other Sessions Revoked',
          message: 'All other devices have been disconnected.',
        });
      }
    } catch {}
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
              <p className="text-[11px] text-slate-400">Central Identity & Multi-Device Sessions</p>
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
            <div className="space-y-5">
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

              {/* Active Sessions & Devices Management */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Laptop size={14} className="text-teal-400" />
                    <span>ACTIVE DEVICES & SESSIONS</span>
                  </div>
                  {activeSessions && activeSessions.length > 1 && (
                    <button
                      type="button"
                      onClick={handleRevokeAllSessionsClick}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Log out other devices
                    </button>
                  )}
                </div>

                {activeSessions && activeSessions.length > 0 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {activeSessions.map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Laptop size={14} className="text-slate-400" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{s.device_name || 'Windows Desktop'}</span>
                              {s.is_current && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {s.platform || 'windows'} • {s.last_used_at ? new Date(s.last_used_at).toLocaleDateString() : 'Active'}
                            </span>
                          </div>
                        </div>

                        {!s.is_current && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSessionClick(s.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Revoke session"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Current device session is active.</p>
                )}
              </div>

              {/* Upgrade Pitch if not Pro */}
              {!isProActive && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-teal-950/40 to-slate-900 border border-teal-800/60">
                  <div className="flex items-center gap-2 mb-2 text-teal-400">
                    <Sparkles size={16} />
                    <h4 className="font-bold text-sm text-white">Upgrade to MAHI PRO (100 Profiles)</h4>
                  </div>
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    Unlock 100 anti-detect profiles and encrypted cloud sync for ₹{priceInr}/year (UPI) or ≈${priceUsdt} USDT (TRC20).
                  </p>

                  <div className="space-y-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono">
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
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition"
                  >
                    <span>Send Payment Proof to WhatsApp</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
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
            /* VIEW B: SIGN UP / SIGN IN / VERIFY / FORGOT / RESET TABS   */
            /* ========================================================== */
            <div>
              {/* Top Navigation Tabs */}
              {(activeTab === 'signup' || activeTab === 'signin') && (
                <div className="flex p-1 bg-slate-950 rounded-2xl mb-5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('signup'); setErrorMessage(null); setSuccessInfo(null); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                      activeTab === 'signup'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign Up (7-Day Trial)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('signin'); setErrorMessage(null); setSuccessInfo(null); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                      activeTab === 'signin'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                </div>
              )}

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

              {/* Success Info Alert */}
              {successInfo && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>{successInfo}</span>
                </div>
              )}

              {/* TAB 1: SIGN UP */}
              {activeTab === 'signup' && (
                <div>
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-800/50 mb-4">
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
                        <span><strong>Encrypted cloud session security</strong> across devices</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>Chrome 138 managed engine isolation</span>
                      </li>
                    </ul>
                  </div>

                  <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="yourname@domain.com"
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
                            placeholder="Re-type"
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
                      {isLoading ? <span>Creating Account...</span> : <span>Create Account & Start Trial</span>}
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Already registered?</span>
                      <button
                        type="button"
                        onClick={() => { setActiveTab('verify'); setErrorMessage(null); }}
                        className="text-emerald-400 hover:underline"
                      >
                        Enter Email Verification Token
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: SIGN IN */}
              {activeTab === 'signin' && (
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
                          placeholder="yourname@domain.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-400">Password</label>
                        <button
                          type="button"
                          onClick={() => { setActiveTab('forgot'); setErrorMessage(null); setSuccessInfo(null); }}
                          className="text-[11px] text-teal-400 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
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

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => { setActiveTab('verify'); setErrorMessage(null); }}
                        className="text-slate-400 hover:text-emerald-400"
                      >
                        Verify Email Token
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveTab('reset'); setErrorMessage(null); }}
                        className="text-slate-400 hover:text-teal-400"
                      >
                        Have a Reset Code?
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: VERIFY EMAIL */}
              {activeTab === 'verify' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h4 className="text-sm font-bold text-white">Verify Your Email</h4>
                      <p className="text-[11px] text-slate-400">Enter the verification token sent to your email.</p>
                    </div>
                  </div>

                  <form onSubmit={handleVerifyEmailSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Verification Token</label>
                      <div className="relative">
                        <KeyRound size={15} className="absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={verificationToken}
                          onChange={(e) => setVerificationToken(e.target.value)}
                          placeholder="Paste verification token"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                      {isLoading ? <span>Verifying...</span> : <span>Confirm Email Verification</span>}
                    </button>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">Didn't receive it?</span>
                      <button
                        type="button"
                        onClick={handleResendVerificationClick}
                        disabled={isLoading}
                        className="text-xs text-teal-400 hover:underline font-semibold"
                      >
                        Resend Verification Email
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 4: FORGOT PASSWORD */}
              {activeTab === 'forgot' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h4 className="text-sm font-bold text-white">Forgot Password</h4>
                      <p className="text-[11px] text-slate-400">Receive instructions to securely reset your password.</p>
                    </div>
                  </div>

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Account Email</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="yourname@domain.com"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                      {isLoading ? <span>Sending...</span> : <span>Send Password Reset Instructions</span>}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => { setActiveTab('reset'); setErrorMessage(null); }}
                        className="text-[11px] text-slate-400 hover:text-teal-400 underline"
                      >
                        Already have a reset token? Enter here
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 5: RESET PASSWORD */}
              {activeTab === 'reset' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h4 className="text-sm font-bold text-white">Reset Password</h4>
                      <p className="text-[11px] text-slate-400">Set a new password using your reset token.</p>
                    </div>
                  </div>

                  <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Reset Token</label>
                      <div className="relative">
                        <KeyRound size={15} className="absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          placeholder="Paste password reset token"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">New Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min 8 chars"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm New Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            placeholder="Re-type"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 mt-2"
                    >
                      {isLoading ? <span>Updating Password...</span> : <span>Update Password</span>}
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
