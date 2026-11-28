import type React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react';
import { AccountSecurityTab } from './AccountSecurityTab.js';

export type AccountAuthTab = 'signup' | 'signin' | 'verify' | 'forgot' | 'reset';

interface AccountAuthViewProps {
  activeTab: AccountAuthTab;
  email: string;
  password: string;
  confirmPassword: string;
  verificationToken: string;
  tokenInput: string;
  showTokenInput: boolean;
  isGoogleLoading: boolean;
  resetToken: string;
  newPassword: string;
  confirmNewPassword: string;
  isLoading: boolean;
  errorMessage: string | null;
  successInfo: string | null;
  deviceMismatchError: boolean;
  onSetActiveTab: (tab: AccountAuthTab) => void;
  onClearNotices: () => void;
  onClearErrorOnly: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onVerificationTokenChange: (value: string) => void;
  onTokenInputChange: (value: string) => void;
  onShowTokenInput: () => void;
  onCancelGoogleLogin: () => void;
  onResetTokenChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmNewPasswordChange: (value: string) => void;
  onGoogleLogin: () => void;
  onLoginSubmit: (e: React.FormEvent) => void;
  onSignupSubmit: (e: React.FormEvent) => void;
  onTokenLoginSubmit: (e: React.FormEvent) => void;
  onSwitchDeviceClick: () => void;
  onVerifyEmailSubmit: (e: React.FormEvent) => void;
  onResendVerificationClick: () => void;
  onForgotPasswordSubmit: (e: React.FormEvent) => void;
  onResetPasswordSubmit: (e: React.FormEvent) => void;
}

const GoogleLogoIcon: React.FC = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.28 21.44 7.35 24 12 24z" />
    <path fill="#FBBC05" d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.57H1.25C.45 8.15 0 9.99 0 12s.45 3.85 1.25 5.43l4.03-3.11z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.28 2.56 1.25 6.57l4.03 3.11c.95-2.83 3.6-4.93 6.72-4.93z" />
  </svg>
);

export const AccountAuthView: React.FC<AccountAuthViewProps> = ({
  activeTab,
  email,
  password,
  confirmPassword,
  verificationToken,
  tokenInput,
  showTokenInput,
  isGoogleLoading,
  resetToken,
  newPassword,
  confirmNewPassword,
  isLoading,
  errorMessage,
  successInfo,
  deviceMismatchError,
  onSetActiveTab,
  onClearNotices,
  onClearErrorOnly,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onVerificationTokenChange,
  onTokenInputChange,
  onShowTokenInput,
  onCancelGoogleLogin,
  onResetTokenChange,
  onNewPasswordChange,
  onConfirmNewPasswordChange,
  onGoogleLogin,
  onLoginSubmit,
  onSignupSubmit,
  onTokenLoginSubmit,
  onSwitchDeviceClick,
  onVerifyEmailSubmit,
  onResendVerificationClick,
  onForgotPasswordSubmit,
  onResetPasswordSubmit,
}) => {
  return (
    <div>
      {/* Top Navigation Tabs: Sign In is Primary, Create Account is Secondary */}
      {(activeTab === 'signup' || activeTab === 'signin') && (
        <div className="flex p-1 bg-slate-950 rounded-2xl mb-5 border border-slate-800">
          <button
            type="button"
            onClick={() => { onSetActiveTab('signin'); onClearNotices(); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'signin'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In to Existing Account
          </button>
          <button
            type="button"
            onClick={() => { onSetActiveTab('signup'); onClearNotices(); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
              activeTab === 'signup'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account with Email
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
                  onClick={onSwitchDeviceClick}
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

      {/* TAB 1: SIGN IN (PRIMARY / DEFAULT) */}
      {activeTab === 'signin' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <p className="text-xs text-slate-300 leading-relaxed">
              Use the same MAHI account you created on our website. All your profiles, trial days, and entitlements sync automatically.
            </p>
          </div>

          {/* Google Single-Sign-On */}
          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-2.5 active:scale-[0.99]"
          >
            <GoogleLogoIcon />
            <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          {isGoogleLoading && (
            <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-800/60 flex items-center justify-between text-xs text-teal-300 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                <span>Sign in in browser window to continue...</span>
              </div>
              <button
                type="button"
                onClick={onCancelGoogleLogin}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Or Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-800"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">or sign in with email</span>
            <div className="flex-1 h-px bg-slate-800"></div>
          </div>

          <form onSubmit={onLoginSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="field-003" className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  id="field-003"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="yourname@domain.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="field-004" className="text-xs font-semibold text-slate-400">Password</label>
                <button
                  type="button"
                  onClick={() => { onSetActiveTab('forgot'); onClearNotices(); }}
                  className="text-[11px] text-teal-400 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  id="field-004"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-2 mt-1"
            >
              {isLoading ? <span>Signing In...</span> : <span>Sign In</span>}
            </button>

            {/* Web Token Paste Option (For smooth desktop handoff from browser) */}
            {showTokenInput ? (
              <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-teal-800/60 space-y-2">
                <label htmlFor="field-005" className="block text-[11px] font-semibold text-teal-400">
                  Paste Session Token from Browser:
                </label>
                <div className="flex gap-2">
                  <input
                    id="field-005"
                    type="text"
                    value={tokenInput}
                    onChange={(e) => onTokenInputChange(e.target.value)}
                    placeholder="Paste token from web dashboard"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={onTokenLoginSubmit}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold"
                  >
                    Connect
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={onShowTokenInput}
                  className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                >
                  Have a session token from website? Paste it here
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => { onSetActiveTab('verify'); onClearErrorOnly(); }}
                className="text-slate-400 hover:text-emerald-400"
              >
                Verify Email Token
              </button>
              <button
                type="button"
                onClick={() => { onSetActiveTab('reset'); onClearErrorOnly(); }}
                className="text-slate-400 hover:text-teal-400"
              >
                Have a Reset Code?
              </button>
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-400">
              <span>Don't have an account yet? </span>
              <button
                type="button"
                onClick={() => { onSetActiveTab('signup'); onClearErrorOnly(); }}
                className="text-emerald-400 hover:underline font-bold"
              >
                Create Account (7-Day Trial)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SIGN UP (SECONDARY) */}
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

          {/* Google Sign-Up Button */}
          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-2.5 active:scale-[0.99] mb-3"
          >
            <GoogleLogoIcon />
            <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google (Start 7-Day Trial)'}</span>
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-slate-800"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">or register with email</span>
            <div className="flex-1 h-px bg-slate-800"></div>
          </div>

          <form onSubmit={onSignupSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="field-006" className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  id="field-006"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="yourname@domain.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="field-007" className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    id="field-007"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    placeholder="Min 8 chars"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="field-008" className="block text-xs font-semibold text-slate-400 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    id="field-008"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => onConfirmPasswordChange(e.target.value)}
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
              <span>Already registered on website?</span>
              <button
                type="button"
                onClick={() => { onSetActiveTab('signin'); onClearErrorOnly(); }}
                className="text-emerald-400 hover:underline font-bold"
              >
                Sign In with existing account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABS 3-5: VERIFY / FORGOT / RESET */}
      {(activeTab === 'verify' || activeTab === 'forgot' || activeTab === 'reset') && (
        <AccountSecurityTab
          activeTab={activeTab}
          email={email}
          verificationToken={verificationToken}
          resetToken={resetToken}
          newPassword={newPassword}
          confirmNewPassword={confirmNewPassword}
          isLoading={isLoading}
          onBackToSignIn={() => { onSetActiveTab('signin'); onClearErrorOnly(); }}
          onSwitchToReset={() => { onSetActiveTab('reset'); onClearErrorOnly(); }}
          onEmailChange={onEmailChange}
          onVerificationTokenChange={onVerificationTokenChange}
          onResetTokenChange={onResetTokenChange}
          onNewPasswordChange={onNewPasswordChange}
          onConfirmNewPasswordChange={onConfirmNewPasswordChange}
          onVerifyEmailSubmit={onVerifyEmailSubmit}
          onResendVerificationClick={onResendVerificationClick}
          onForgotPasswordSubmit={onForgotPasswordSubmit}
          onResetPasswordSubmit={onResetPasswordSubmit}
        />
      )}
    </div>
  );
};
