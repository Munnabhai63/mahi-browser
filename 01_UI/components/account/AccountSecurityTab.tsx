import type React from 'react';
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react';

interface AccountSecurityTabProps {
  activeTab: 'verify' | 'forgot' | 'reset';
  email: string;
  verificationToken: string;
  resetToken: string;
  newPassword: string;
  confirmNewPassword: string;
  isLoading: boolean;
  onBackToSignIn: () => void;
  onSwitchToReset: () => void;
  onEmailChange: (value: string) => void;
  onVerificationTokenChange: (value: string) => void;
  onResetTokenChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmNewPasswordChange: (value: string) => void;
  onVerifyEmailSubmit: (e: React.FormEvent) => void;
  onResendVerificationClick: () => void;
  onForgotPasswordSubmit: (e: React.FormEvent) => void;
  onResetPasswordSubmit: (e: React.FormEvent) => void;
}

export const AccountSecurityTab: React.FC<AccountSecurityTabProps> = ({
  activeTab,
  email,
  verificationToken,
  resetToken,
  newPassword,
  confirmNewPassword,
  isLoading,
  onBackToSignIn,
  onSwitchToReset,
  onEmailChange,
  onVerificationTokenChange,
  onResetTokenChange,
  onNewPasswordChange,
  onConfirmNewPasswordChange,
  onVerifyEmailSubmit,
  onResendVerificationClick,
  onForgotPasswordSubmit,
  onResetPasswordSubmit,
}) => {
  if (activeTab === 'verify') {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={onBackToSignIn}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h4 className="text-sm font-bold text-white">Verify Your Email</h4>
            <p className="text-[11px] text-slate-400">Enter the verification token sent to your email.</p>
          </div>
        </div>

        <form onSubmit={onVerifyEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="field-009" className="block text-xs font-semibold text-slate-400 mb-1">Verification Token</label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                id="field-009"
                type="text"
                required
                value={verificationToken}
                onChange={(e) => onVerificationTokenChange(e.target.value)}
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
              onClick={onResendVerificationClick}
              disabled={isLoading}
              className="text-xs text-teal-400 hover:underline font-semibold"
            >
              Resend Verification Email
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (activeTab === 'forgot') {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={onBackToSignIn}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h4 className="text-sm font-bold text-white">Forgot Password</h4>
            <p className="text-[11px] text-slate-400">Receive instructions to securely reset your password.</p>
          </div>
        </div>

        <form onSubmit={onForgotPasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="field-010" className="block text-xs font-semibold text-slate-400 mb-1">Account Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                id="field-010"
                type="email"
                required
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
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
              onClick={onSwitchToReset}
              className="text-[11px] text-slate-400 hover:text-teal-400 underline"
            >
              Already have a reset token? Enter here
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={onBackToSignIn}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h4 className="text-sm font-bold text-white">Reset Password</h4>
          <p className="text-[11px] text-slate-400">Set a new password using your reset token.</p>
        </div>
      </div>

      <form onSubmit={onResetPasswordSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="field-011" className="block text-xs font-semibold text-slate-400 mb-1">Reset Token</label>
          <div className="relative">
            <KeyRound size={15} className="absolute left-3.5 top-3 text-slate-500" />
            <input
              id="field-011"
              type="text"
              required
              value={resetToken}
              onChange={(e) => onResetTokenChange(e.target.value)}
              placeholder="Paste password reset token"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-012" className="block text-xs font-semibold text-slate-400 mb-1">New Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                id="field-012"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => onNewPasswordChange(e.target.value)}
                placeholder="Min 8 chars"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="field-013" className="block text-xs font-semibold text-slate-400 mb-1">Confirm New Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                id="field-013"
                type="password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => onConfirmNewPasswordChange(e.target.value)}
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
  );
};
