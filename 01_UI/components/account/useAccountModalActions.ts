import { useState } from 'react';
import type React from 'react';
import type { CreateProfileDTO } from '../../../10_CONFIG/shared/types/profile.js';
import type {
  AccountCheckoutPayload,
  AccountCheckoutSession,
  AccountPaymentInfo,
} from '../../../10_CONFIG/shared/types/commercial.js';
import { CONTACT_CONFIG } from '../../../10_CONFIG/contact-config.js';
import type { ToastItem } from '../../stores/useToastStore.js';
import {
  formatAuthError,
  getAdminApiBaseUrl,
  getErrorMessageText,
  type CanonicalBillingCycle,
} from './account-plan-config.js';
import type { AccountAuthTab } from './AccountAuthView.js';

interface UseAccountModalActionsParams {
  onClose: () => void;
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  selectedPlanId: 'mahi_starter' | 'mahi_growth' | 'mahi_ultimate';
  selectedBillingCycle: CanonicalBillingCycle;
  priceInr: number;
  paymentInfo: AccountPaymentInfo | null;
  pendingProfileDto: CreateProfileDTO | null;
  clearPendingProfileDto: () => void;
  accountSignup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  accountLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string; deviceMismatch?: boolean }>;
  accountLoginWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  accountLogout: () => Promise<void>;
  accountSwitchDevice: () => Promise<{ success: boolean; error?: string }>;
  fetchPlanLimits: (dto?: { force?: boolean }) => Promise<void>;
  fetchActiveSessions: () => Promise<void>;
  fetchPaymentHistory: () => Promise<unknown>;
  revokeSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  revokeAllSessions: (keepCurrent?: boolean) => Promise<{ success: boolean; error?: string }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  createCheckoutSession: (payload: AccountCheckoutPayload) => Promise<{ success: boolean; session?: AccountCheckoutSession; error?: string }>;
  submitManualUpiPayment: (payload: {
    plan_id: string;
    utr: string;
    proof_asset?: string;
    billing_cycle?: string;
    amount_paise?: number;
  }) => Promise<{ success: boolean; status?: string; error?: string }>;
  submitManualCryptoPayment: (payload: {
    plan_id: string;
    tx_hash: string;
    network?: string;
    billing_cycle?: string;
  }) => Promise<{ success: boolean; status?: string; error?: string }>;
  activateTrial: (planId?: string) => Promise<{ success: boolean; error?: string }>;
}

export function useAccountModalActions(params: UseAccountModalActionsParams) {
  const {
    onClose,
    showToast,
    selectedPlanId,
    selectedBillingCycle,
    priceInr,
    paymentInfo,
    pendingProfileDto,
    clearPendingProfileDto,
    accountSignup,
    accountLogin,
    accountLoginWithToken,
    accountLogout,
    accountSwitchDevice,
    fetchPlanLimits,
    fetchActiveSessions,
    fetchPaymentHistory,
    revokeSession,
    revokeAllSessions,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    createCheckoutSession,
    submitManualUpiPayment,
    submitManualCryptoPayment,
    activateTrial,
  } = params;

  const [activeTab, setActiveTab] = useState<AccountAuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [deviceMismatchError, setDeviceMismatchError] = useState(false);
  const [isActivatingTrial, setIsActivatingTrial] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'crypto'>('upi');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [txHashInput, setTxHashInput] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSubmittedStatus, setPaymentSubmittedStatus] = useState<string | null>(null);

  const usdtNetwork = paymentInfo?.usdt_network || CONTACT_CONFIG.USDT_NETWORK;

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
          } catch (err) {
            console.debug('[AccountModal] pending profile creation after signup skipped', err);
          }
        }
      } else {
        const errStr = res.error || 'Failed to create account.';
        if (errStr.toLowerCase().includes('already exists') || errStr.toLowerCase().includes('already registered')) {
          setErrorMessage('This email is already registered on MAHI Browser. Switched to Sign In — please enter your password or continue with Google.');
          setActiveTab('signin');
        } else {
          setErrorMessage(formatAuthError(errStr));
        }
      }
    } catch (err: unknown) {
      const msg = getErrorMessageText(err, 'Signup failed.');
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('already registered')) {
        setErrorMessage('This email is already registered on MAHI Browser. Switched to Sign In — please enter your password or continue with Google.');
        setActiveTab('signin');
      } else {
        setErrorMessage(formatAuthError(msg));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    setSuccessInfo('Opening Google sign-in in your default browser. Please complete sign-in in the browser window...');

    let ticket = '';
    let googleAuthUrl = '';

    if (window.mahiAPI?.accountStartDesktopOAuth) {
      try {
        const initRes = await window.mahiAPI.accountStartDesktopOAuth();
        if (initRes.success && initRes.ticket && initRes.authUrl) {
          ticket = initRes.ticket;
          googleAuthUrl = initRes.authUrl;
        }
      } catch (err: unknown) {
        console.warn('[AccountModal] IPC startDesktopOAuth failed, using fallback:', getErrorMessageText(err, 'Unknown error'));
      }
    }

    const adminBaseUrl = getAdminApiBaseUrl();

    if (!googleAuthUrl) {
      ticket = `dsk_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
      googleAuthUrl = `${adminBaseUrl}/api/v1/auth/google/start?intent=desktop_login&handoff=${encodeURIComponent(ticket)}`;
    }

    if (typeof window !== 'undefined') {
      window.open(googleAuthUrl, '_blank');
    }

    const pollStartTime = Date.now();
    const pollInterval = setInterval(async () => {
      if (Date.now() - pollStartTime > 150000) {
        clearInterval(pollInterval);
        setIsGoogleLoading(false);
        return;
      }
      try {
        const res = await fetch(`${adminBaseUrl}/api/v1/auth/desktop-status?ticket=${encodeURIComponent(ticket)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.code) {
            clearInterval(pollInterval);
            let loginRes: { success: boolean; error?: string } | undefined;
            if (window.mahiAPI?.accountExchangeDesktopCode) {
              loginRes = await window.mahiAPI.accountExchangeDesktopCode(ticket, data.code);
            } else {
              loginRes = { success: false, error: 'Desktop application API is unavailable. Please run inside MAHI Browser desktop client.' };
            }
            if (loginRes?.success) {
              showToast({
                type: 'success',
                title: 'Signed In',
                message: `Signed in successfully as ${data.email || 'Google User'}.`,
              });
              await fetchActiveSessions().catch((err) => { console.debug('[AccountModal] post-google sessions refresh failed', err); });
              setIsGoogleLoading(false);
              onClose();
            } else {
              setErrorMessage(loginRes?.error || 'Failed to complete authorization exchange.');
              setIsGoogleLoading(false);
            }
          }
        }
      } catch (pollErr) {
        console.debug('[AccountModal] google OAuth poll tick failed', pollErr);
      }
    }, 1500);
  };

  const handleTokenLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMessage('Please paste your session token from the browser.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await accountLoginWithToken(tokenInput.trim());
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Connected',
          message: 'Central MAHI account session connected successfully.',
        });
        await fetchActiveSessions().catch((err) => { console.debug('[AccountModal] token login sessions refresh failed', err); });
        onClose();
      } else {
        setErrorMessage(formatAuthError(res.error || 'Failed to authenticate session token.'));
      }
    } catch (err: unknown) {
      setErrorMessage(formatAuthError(getErrorMessageText(err, 'Token verification failed.')));
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
        await fetchActiveSessions().catch((err) => { console.debug('[AccountModal] token login sessions refresh failed', err); });
        onClose();

        if (pendingProfileDto && window.mahiAPI) {
          try {
            await window.mahiAPI.createProfile(pendingProfileDto);
            clearPendingProfileDto();
          } catch (err) {
            console.debug('[AccountModal] pending profile creation after signup skipped', err);
          }
        }
      } else {
        const errStr = res.error || 'Invalid credentials.';
        if (errStr.toLowerCase().includes('google') || (res as { code?: string }).code === 'GOOGLE_ACCOUNT') {
          setErrorMessage('This account was created with Google. Click "Continue with Google" above or use Forgot Password to set a password.');
        } else {
          setErrorMessage(formatAuthError(errStr));
        }
        if (res.deviceMismatch) {
          setDeviceMismatchError(true);
        }
      }
    } catch (err: unknown) {
      const msg = getErrorMessageText(err, 'Login failed.');
      const errMeta = err && typeof err === 'object' ? (err as { code?: string; device_limit?: boolean }) : undefined;
      if (msg.toLowerCase().includes('google') || errMeta?.code === 'GOOGLE_ACCOUNT') {
        setErrorMessage('This account was created with Google. Click "Continue with Google" above or use Forgot Password to set a password.');
      } else {
        setErrorMessage(formatAuthError(msg));
      }
      if (errMeta?.device_limit) {
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
    } catch (err: unknown) {
      setErrorMessage(getErrorMessageText(err, 'Verification failed.'));
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
    } catch (err: unknown) {
      setErrorMessage(getErrorMessageText(err, 'Network error.'));
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
    } catch (err: unknown) {
      setErrorMessage(getErrorMessageText(err, 'Network error.'));
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
    } catch (err: unknown) {
      setErrorMessage(getErrorMessageText(err, 'Network error.'));
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
    } catch (err) {
      console.debug('[AccountModal] revokeSession action failed', err);
    }
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
    } catch (err) {
      console.debug('[AccountModal] revokeAllSessions action failed', err);
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
        await fetchPlanLimits({ force: true });
      } else {
        setErrorMessage(res.error || 'Device switch rejected by cooldown.');
      }
    } catch (err: unknown) {
      setErrorMessage(getErrorMessageText(err, 'Failed to switch device.'));
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

  const handleActivateTrial = async () => {
    setIsActivatingTrial(true);
    try {
      const res = await activateTrial('professional_50');
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Trial Activated!',
          message: '7-Day Free Trial (50 Profiles) is now active.',
        });
      } else {
        showToast({
          type: 'error',
          title: 'Trial Activation',
          message: res.error || 'Failed to activate trial.',
        });
      }
    } finally {
      setIsActivatingTrial(false);
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

  const handleOnlineCheckout = async () => {
    try {
      const res = await createCheckoutSession({
        planId: selectedPlanId,
        billingCycle: selectedBillingCycle,
        provider: 'youpi_pg',
        currency: 'INR',
      });
      if (res?.success) {
        showToast({
          type: 'success',
          title: 'Checkout Opened',
          message: 'Secure checkout session launched in your browser.',
        });
        if (!window.mahiAPI?.accountCreateCheckoutSession && res.session?.checkoutUrl) {
          window.open(res.session.checkoutUrl, '_blank');
        }
        return;
      }
      showToast({
        type: 'error',
        title: 'Checkout Failed',
        message: res?.error || 'Failed to initialize checkout session.',
      });
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Checkout Error',
        message: getErrorMessageText(err, 'Failed to start online checkout.'),
      });
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = utrInput.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      showToast({
        type: 'error',
        title: 'Invalid UTR',
        message: 'Please enter a valid UPI Transaction Reference / UTR (at least 6 characters).',
      });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await submitManualUpiPayment({
        plan_id: selectedPlanId,
        billing_cycle: selectedBillingCycle,
        amount_paise: priceInr * 100,
        utr: cleanUtr,
      });

      if (res.success) {
        setPaymentSubmittedStatus(res.status || 'PENDING_VERIFICATION');
        fetchPaymentHistory().catch((err) => { console.debug('[AccountModal] UTR payment history refresh failed', err); });
        showToast({
          type: 'success',
          title: 'Payment Submitted',
          message: 'Your payment record is PENDING_VERIFICATION. Admin will activate your subscription.',
        });
      } else {
        showToast({
          type: 'error',
          title: 'Submission Failed',
          message: res.error || 'Failed to submit transaction reference.',
        });
      }
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Error',
        message: getErrorMessageText(err, 'Payment submission failed.'),
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSubmitCryptoPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHash = txHashInput.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
      showToast({
        type: 'error',
        title: 'Invalid TX Hash',
        message: 'Please paste the full 64-character TRON (TRC-20) transaction hash.',
      });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await submitManualCryptoPayment({
        plan_id: selectedPlanId,
        billing_cycle: selectedBillingCycle,
        tx_hash: cleanHash,
        network: usdtNetwork,
      });

      if (res.success) {
        setPaymentSubmittedStatus(res.status || 'PENDING_VERIFICATION');
        fetchPaymentHistory().catch((err) => { console.debug('[AccountModal] UTR payment history refresh failed', err); });
        showToast({
          type: 'success',
          title: 'Crypto TX Submitted',
          message: 'Your USDT (TRC-20) transaction is PENDING_VERIFICATION. Admin will verify and activate.',
        });
      } else {
        showToast({
          type: 'error',
          title: 'Submission Failed',
          message: res.error || 'Failed to submit TRC-20 transaction hash.',
        });
      }
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Error',
        message: getErrorMessageText(err, 'Crypto submission failed.'),
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    verificationToken,
    setVerificationToken,
    tokenInput,
    setTokenInput,
    showTokenInput,
    setShowTokenInput,
    isGoogleLoading,
    setIsGoogleLoading,
    resetToken,
    setResetToken,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    successInfo,
    setSuccessInfo,
    deviceMismatchError,
    setDeviceMismatchError,
    isActivatingTrial,
    paymentMethod,
    setPaymentMethod,
    showPaymentForm,
    setShowPaymentForm,
    utrInput,
    setUtrInput,
    txHashInput,
    setTxHashInput,
    isSubmittingPayment,
    paymentSubmittedStatus,
    setPaymentSubmittedStatus,
    handleSignupSubmit,
    handleGoogleLogin,
    handleTokenLoginSubmit,
    handleLoginSubmit,
    handleVerifyEmailSubmit,
    handleResendVerificationClick,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
    handleRevokeSessionClick,
    handleRevokeAllSessionsClick,
    handleSwitchDeviceClick,
    handleLogoutClick,
    handleActivateTrial,
    copyToClipboard,
    handleOnlineCheckout,
    handleSubmitPayment,
    handleSubmitCryptoPayment,
  };
}
