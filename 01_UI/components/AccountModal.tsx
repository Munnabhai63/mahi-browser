import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Copy,
  LogOut,
  ExternalLink,
  Laptop,
  AlertTriangle,
  Lock,
  Mail,
  Zap,
  KeyRound,
  RotateCcw,
  Trash2,
  ArrowLeft,
  Check,
  Users,
  Clock,
} from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { BrandLogo } from './BrandLogo.js';
import { CONTACT_CONFIG } from '../../10_CONFIG/contact-config.js';
import { getSiteConfig, websiteUrl } from '../../10_CONFIG/shared/site-config.js';
import { fetchMyLicense, MyLicenseResponse } from '../api-fallback.js';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getAdminApiBaseUrl(): string {
  return getSiteConfig({ productionFallback: true }).apiUrl;
}

type CanonicalBillingCycle = 'MONTHLY' | 'SEMI_ANNUAL' | 'ANNUAL';

interface DesktopPlanOption {
  id: 'mahi_starter' | 'mahi_growth' | 'mahi_ultimate';
  name: string;
  profiles: number;
  concurrent: number;
  priceInr: number;
  priceUsd: number;
  billingCycle: CanonicalBillingCycle;
  durationLabel: string;
  rateSubtext: string;
  badge?: string;
}

const DESKTOP_PLANS: DesktopPlanOption[] = [
  {
    id: 'mahi_starter',
    name: 'Starter',
    profiles: 25,
    concurrent: 3,
    priceInr: 599,
    priceUsd: 9,
    billingCycle: 'MONTHLY',
    durationLabel: '1 Month',
    rateSubtext: '₹599/mo • 25 Proxy Slots',
  },
  {
    id: 'mahi_growth',
    name: 'Growth',
    profiles: 100,
    concurrent: 10,
    priceInr: 999,
    priceUsd: 15,
    billingCycle: 'SEMI_ANNUAL',
    durationLabel: '6 Months',
    rateSubtext: '₹166/mo (Save 72%) • 25 Cloud Backups',
    badge: 'Popular',
  },
  {
    id: 'mahi_ultimate',
    name: 'Ultimate',
    profiles: 1000000,
    concurrent: 25,
    priceInr: 1499,
    priceUsd: 24,
    billingCycle: 'ANNUAL',
    durationLabel: '1 Year',
    rateSubtext: '₹125/mo (Save 79%) • Unlimited Backup & 2 Devices',
    badge: 'Best Value',
  },
];

function formatAuthError(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';
  let msg = typeof err === 'string' ? err : err.message || err.error || '';
  msg = msg.replace(/^Error invoking remote method '[^']+':\s*Error:\s*/i, '');
  msg = msg.replace(/^Error invoking remote method '[^']+':\s*/i, '');
  msg = msg.replace(/^Error:\s*/i, '');

  const lower = msg.toLowerCase();
  if (
    lower.includes('http 401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid credentials') ||
    lower.includes('password incorrect') ||
    lower.includes('user not found')
  ) {
    return 'Invalid email or password. Please verify your credentials or continue with Google.';
  }
  if (lower.includes('already exists') || lower.includes('already registered')) {
    return 'This email is already registered on MAHI Browser. Switched to Sign In — please enter your password or continue with Google.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('enotfound') ||
    lower.includes('offline')
  ) {
    return 'Unable to reach MAHI authentication servers. Please check your internet connection.';
  }
  if (lower.includes('google')) {
    return 'This account was registered using Google Sign-In. Please click "Continue with Google" above.';
  }
  return msg || 'Authentication request failed. Please try again.';
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const {
    accountSession,
    planLimits,
    paymentInfo,
    pricingCatalog,
    paymentHistory,
    selectedPlanTier,
    pendingProfileDto,
    trialStatus,
    activateTrial,
    clearPendingProfileDto,
    accountSignup,
    accountLogin,
    accountLoginWithToken,
    accountLogout,
    accountSwitchDevice,
    fetchPlanLimits,
    fetchPaymentInfo,
    fetchPricingCatalog,
    fetchPaymentHistory,
    createCheckoutSession,
    activeSessions,
    fetchActiveSessions,
    revokeSession,
    revokeAllSessions,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    submitManualUpiPayment,
    submitManualCryptoPayment,
  } = useAccountStore();

  const { showToast } = useToastStore();

  // Default to 'signin' because existing website users install desktop and sign in
  const [activeTab, setActiveTab] = useState<'signup' | 'signin' | 'verify' | 'forgot' | 'reset'>('signin');
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
  const [myLicense, setMyLicense] = useState<MyLicenseResponse | null>(null);

  // Manual UPI / Crypto payment submission states
  const [selectedPlanId, setSelectedPlanId] = useState<'mahi_starter' | 'mahi_growth' | 'mahi_ultimate'>('mahi_growth');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<CanonicalBillingCycle>('SEMI_ANNUAL');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'crypto'>('upi');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [txHashInput, setTxHashInput] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSubmittedStatus, setPaymentSubmittedStatus] = useState<string | null>(null);

  const isUserLoggedIn = Boolean(accountSession?.token);
  const wasUserLoggedInRef = useRef(isUserLoggedIn);
  const isGoogleLoadingRef = useRef(isGoogleLoading);

  // Synchronize Google loading state ref
  useEffect(() => {
    isGoogleLoadingRef.current = isGoogleLoading;
  }, [isGoogleLoading]);

  // Capture whether user was already signed in when modal opened
  useEffect(() => {
    if (isOpen) {
      wasUserLoggedInRef.current = Boolean(useAccountStore.getState().accountSession?.token);
    }
  }, [isOpen]);

  const currentPlan = planLimits?.plan || 'free';
  const isProActive = planLimits?.isPro || false;

  const dynamicPlans = React.useMemo(() => {
    if (!pricingCatalog) return DESKTOP_PLANS;
    const remoteRows = [
      ...(Array.isArray(pricingCatalog.personal) ? pricingCatalog.personal : []),
      ...(Array.isArray(pricingCatalog.business) ? pricingCatalog.business : []),
    ];
    return DESKTOP_PLANS.map((basePlan) => {
      const remote = remoteRows.find((r: any) => r?.planId === basePlan.id);
      if (!remote) return basePlan;
      const authoritativePaise =
        basePlan.billingCycle === 'MONTHLY'
          ? remote.monthlyPricePaise
          : remote.annualPricePaise || remote.monthlyPricePaise;
      const remotePriceInr =
        typeof authoritativePaise === 'number' && authoritativePaise > 0
          ? Math.round(authoritativePaise / 100)
          : basePlan.priceInr;
      return {
        ...basePlan,
        name: remote.displayName || basePlan.name,
        profiles:
          typeof remote.profileLimit === 'number' && remote.profileLimit > 0
            ? remote.profileLimit
            : basePlan.profiles,
        priceInr: remotePriceInr,
      };
    });
  }, [pricingCatalog]);

  const activePlanMeta = dynamicPlans.find((p) => p.id === selectedPlanId) || dynamicPlans[1] || dynamicPlans[0];
  const priceInr = activePlanMeta.priceInr;
  const priceUsd = activePlanMeta.priceUsd;

  const handleSelectPlan = (plan: DesktopPlanOption) => {
    setSelectedPlanId(plan.id);
    setSelectedBillingCycle(plan.billingCycle);
  };

  const latestPayment = (paymentHistory && paymentHistory.length > 0) ? paymentHistory[0] : null;

  useEffect(() => {
    if (isOpen) {
      fetchPlanLimits({ force: true }).catch((err) => { console.debug('[AccountModal] plan limits fetch failed', err); });
      fetchPaymentInfo().catch((err) => { console.debug('[AccountModal] payment info fetch failed', err); });
      fetchPricingCatalog().catch((err) => { console.debug('[AccountModal] pricing catalog fetch failed', err); });
      fetchPaymentHistory().catch((err) => { console.debug('[AccountModal] payment history fetch failed', err); });
      if (isUserLoggedIn) {
        fetchActiveSessions().catch((err) => { console.debug('[AccountModal] active sessions fetch failed', err); });
        fetchMyLicense().then(setMyLicense).catch(() => setMyLicense(null));
      } else {
        setMyLicense(null);
      }
      setErrorMessage(null);
      setSuccessInfo(null);
      setDeviceMismatchError(false);
    }
  }, [isOpen, isUserLoggedIn]);

  // Fetch payment coordinates and dynamic pricing on mount with silent fallback
  useEffect(() => {
    fetchPaymentInfo().catch((err) => { console.debug('[AccountModal] mount payment info fetch failed', err); });
    fetchPricingCatalog().catch((err) => { console.debug('[AccountModal] mount pricing catalog fetch failed', err); });
  }, [fetchPaymentInfo, fetchPricingCatalog]);

  useEffect(() => {
    if (selectedPlanTier === 'BUSINESS') {
      setSelectedPlanId('mahi_ultimate');
      setSelectedBillingCycle('ANNUAL');
    } else if (selectedPlanTier === 'PRO') {
      setSelectedPlanId('mahi_growth');
      setSelectedBillingCycle('SEMI_ANNUAL');
    }
  }, [selectedPlanTier]);

  // Auto-dismiss modal when login completes during Google or deep-link auth
  useEffect(() => {
    if (isOpen && isGoogleLoading && isUserLoggedIn) {
      setIsGoogleLoading(false);
      showToast({
        type: 'success',
        title: 'Signed In',
        message: `Welcome back! Signed in as ${accountSession?.email || 'authenticated user'}.`,
      });
      onClose();
    }
  }, [isOpen, isGoogleLoading, isUserLoggedIn, accountSession?.email]);

  // Listen for account:statusChanged IPC event from deep-link login
  useEffect(() => {
    if (!isOpen) return;
    const unsub = window.mahiAPI?.onAccountStatusChanged?.(async () => {
      const wasSignedIn = wasUserLoggedInRef.current;
      const wasPendingGoogle = isGoogleLoadingRef.current;

      setIsGoogleLoading(false);
      setIsLoading(false);

      // Silently update limits and profiles without force loop
      try {
        await fetchPlanLimits({ force: false });
        await useProfileStore.getState().fetchProfiles();
      } catch (err) {
        console.debug('[AccountModal] post-statusChanged refresh notice:', err);
      }

      const currentSession = useAccountStore.getState().accountSession;
      const isNowSignedIn = Boolean(currentSession?.token);

      // ONLY show deep-link sign-in toast and close modal if user actually transitioned
      // from signed-out to signed-in, or was actively waiting in a Google/OAuth deep-link flow.
      if ((!wasSignedIn && isNowSignedIn) || (wasPendingGoogle && isNowSignedIn)) {
        wasUserLoggedInRef.current = true;
        showToast({
          type: 'success',
          title: 'Signed In',
          message: 'Account signed in successfully via deep link!',
        });
        onClose();
      }
      // If already signed in, modal stays open without deep-link toast!
    });

    return () => {
      unsub?.();
    };
  }, [isOpen, fetchPlanLimits, onClose, showToast]);

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
    } catch (err: any) {
      const msg = err.message || 'Signup failed.';
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
      } catch (err: any) {
        console.warn('[AccountModal] IPC startDesktopOAuth failed, using fallback:', err?.message);
      }
    }

    const adminBaseUrl = getAdminApiBaseUrl();

    if (!googleAuthUrl) {
      ticket = 'dsk_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      googleAuthUrl = `${adminBaseUrl}/api/v1/auth/google/start?intent=desktop_login&handoff=${encodeURIComponent(ticket)}`;
    }
    
    if (typeof window !== 'undefined') {
      window.open(googleAuthUrl, '_blank');
    }

    // Resilient background polling fallback
    const pollStartTime = Date.now();
    const pollInterval = setInterval(async () => {
      // Timeout after 2.5 minutes
      if (Date.now() - pollStartTime > 150000) {
        clearInterval(pollInterval);
        setIsGoogleLoading(false);
        return;
      }
      try {
        const res = await fetch(`${adminBaseUrl}/api/v1/auth/desktop-status?ticket=${encodeURIComponent(ticket)}`);
        if (res.ok) {
          const data = await res.json();
          // Authenticated status returns single-use authorization code (NEVER raw session token)
          if (data.authenticated && data.code) {
            clearInterval(pollInterval);
            let loginRes: any;
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
    } catch (err: any) {
      setErrorMessage(formatAuthError(err.message || 'Token verification failed.'));
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
        if (errStr.toLowerCase().includes('google') || (res as any).code === 'GOOGLE_ACCOUNT') {
          setErrorMessage('This account was created with Google. Click "Continue with Google" above or use Forgot Password to set a password.');
        } else {
          setErrorMessage(formatAuthError(errStr));
        }
        if (res.deviceMismatch) {
          setDeviceMismatchError(true);
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed.';
      if (msg.toLowerCase().includes('google') || err.code === 'GOOGLE_ACCOUNT') {
        setErrorMessage('This account was created with Google. Click "Continue with Google" above or use Forgot Password to set a password.');
      } else {
        setErrorMessage(formatAuthError(msg));
      }
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
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Checkout Error',
        message: err.message || 'Failed to start online checkout.',
      });
    }
  };

  const upiId = paymentInfo?.upi_id || CONTACT_CONFIG.UPI_ID;
  const upiHolder = paymentInfo?.upi_account_holder || CONTACT_CONFIG.UPI_ACCOUNT_HOLDER;
  const upiQrAsset = paymentInfo?.upi_qr_asset || CONTACT_CONFIG.UPI_QR_ASSET;
  const usdtEnabled = paymentInfo?.usdt_enabled ?? CONTACT_CONFIG.USDT_ENABLED;
  const usdtAddress = paymentInfo?.usdt_address || CONTACT_CONFIG.USDT_ADDRESS;
  const usdtNetwork = paymentInfo?.usdt_network || CONTACT_CONFIG.USDT_NETWORK;
  const usdtQrAsset = paymentInfo?.usdt_qr_asset || CONTACT_CONFIG.USDT_QR_ASSET;
  const waNumber = paymentInfo?.whatsapp_number || CONTACT_CONFIG.WHATSAPP_NUMBER;
  const waCleanNumber = waNumber.replace(/[^0-9]/g, '') || CONTACT_CONFIG.WHATSAPP_RAW_NUMBER;

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
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Payment submission failed.',
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
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Crypto submission failed.',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative text-slate-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <BrandLogo variant="icon" className="w-8 h-8 rounded-xl shadow-sm shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                {isUserLoggedIn ? 'MAHI BROWSER ACCOUNT' : 'Welcome to MAHI Browser'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isUserLoggedIn ? 'Central Identity & Multi-Device Sessions' : 'Create your account to start managing isolated browser profiles.'}
              </p>
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
        <div className="p-6 overflow-y-auto flex-1">
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
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{accountSession?.email}</span>
                      {(accountSession?.auth_provider === 'GOOGLE' || accountSession?.google_sub) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Google Linked
                        </span>
                      )}
                    </h4>
                  </div>
                  <div>
                    {(currentPlan === 'business' || currentPlan.startsWith('business_') || currentPlan === 'team' || currentPlan === 'enterprise') && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                        <Users size={13} /> {currentPlan.toUpperCase()} ACTIVE
                      </span>
                    )}
                    {(currentPlan === 'mahi_ultimate' || currentPlan === 'ultimate') && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                        <Zap size={13} /> ULTIMATE ACTIVE
                      </span>
                    )}
                    {(currentPlan === 'mahi_growth' || currentPlan === 'growth') && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Zap size={13} /> GROWTH ACTIVE
                      </span>
                    )}
                    {(currentPlan === 'mahi_starter' || currentPlan === 'starter') && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                        <Zap size={13} /> STARTER ACTIVE
                      </span>
                    )}
                    {(currentPlan === 'pro' || currentPlan.startsWith('pro_') || currentPlan.startsWith('professional_')) && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Zap size={13} /> {currentPlan.startsWith('professional_') ? currentPlan.replace('_', ' ').toUpperCase() : 'PRO'} ACTIVE
                      </span>
                    )}
                    {currentPlan === 'trial' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                        <Sparkles size={13} /> 7-DAY TRIAL {trialStatus?.daysRemaining ? `(${trialStatus.daysRemaining}d left)` : ''}
                      </span>
                    )}
                    {currentPlan !== 'pro' &&
                      currentPlan !== 'trial' &&
                      currentPlan !== 'starter' &&
                      currentPlan !== 'mahi_starter' &&
                      currentPlan !== 'growth' &&
                      currentPlan !== 'mahi_growth' &&
                      currentPlan !== 'ultimate' &&
                      currentPlan !== 'mahi_ultimate' &&
                      !currentPlan.startsWith('pro_') &&
                      !currentPlan.startsWith('professional_') &&
                      currentPlan !== 'business' &&
                      !currentPlan.startsWith('business_') &&
                      currentPlan !== 'team' &&
                      currentPlan !== 'enterprise' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
                          FREE PLAN ({planLimits?.maxProfiles || 15} Profiles)
                        </span>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/40 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Profile Capacity</span>
                    <strong className="text-white font-mono">
                      {(planLimits?.maxProfiles ?? 0) >= 100000 || planLimits?.maxProfiles === -1
                        ? 'Unlimited Profiles'
                        : `${planLimits?.maxProfiles || 15} Profiles`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Expires On</span>
                    <strong className="text-white font-mono">
                      {planLimits?.expiresAt ? new Date(planLimits.expiresAt).toLocaleDateString() : 'Never (Free)'}
                    </strong>
                  </div>
                </div>

                {currentPlan !== 'pro' && currentPlan !== 'trial' && !isProActive && trialStatus?.isEligibleForTrial && (
                  <div className="pt-3 border-t border-slate-700/40">
                    <button
                      type="button"
                      disabled={isActivatingTrial}
                      onClick={async () => {
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
                      }}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      {isActivatingTrial ? 'Activating 7-Day Trial...' : 'Start 7-Day Free Trial (50 Profiles)'}
                    </button>
                  </div>
                )}
              </div>

              {/* Your Licence Block */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Your Licence
                </div>
                {myLicense && myLicense.hasLicense ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-mono text-xs tracking-wider bg-slate-900/80 p-2.5 rounded-xl border border-slate-700 text-slate-100 select-all">
                      {myLicense.keyMasked}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                      <div>Plan: <span className="text-slate-200 font-medium">{myLicense.planName || myLicense.planId}</span></div>
                      <div>Devices: <span className="text-slate-200 font-mono">{myLicense.devicesUsed} / {myLicense.deviceLimit}</span></div>
                      <div>Valid until: <span className="text-slate-200 font-mono">{myLicense.validUntil ? new Date(myLicense.validUntil).toLocaleDateString() : 'Lifetime'}</span></div>
                      <div>Status: <span className="text-slate-200 font-mono uppercase">{myLicense.status || 'ACTIVE'}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>No licence yet. It is issued automatically after payment is approved.</p>
                    <a href={websiteUrl('/pricing', { productionFallback: true })} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white underline inline-block font-medium">View Pricing</a>
                  </div>
                )}
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
              {/* Upgrade Pitch with UPI Manual Payment */}
              {!isProActive && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-teal-950/40 to-slate-900 border border-teal-800/60 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-teal-400">
                      <Sparkles size={16} />
                      <h4 className="font-bold text-sm text-white">
                        Upgrade to MAHI {activePlanMeta.name} (
                        {activePlanMeta.profiles >= 100000 ? 'Unlimited Profiles' : `${activePlanMeta.profiles} Profiles`})
                      </h4>
                    </div>
                    <span className="shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ₹{priceInr.toLocaleString()} / {activePlanMeta.durationLabel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Unlock isolated anti-detect browser containers, automated workflows, custom proxy routing, and encrypted cloud backup.
                  </p>

                  {/* Canonical 3-Tier Plan Selector (Starter / Growth / Ultimate) */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Choose Plan</span>
                      <span className="text-[11px] font-mono text-teal-300">
                        {activePlanMeta.concurrent} Concurrent Windows
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {dynamicPlans.map((p) => {
                        const isSelected = p.id === activePlanMeta.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPlan(p)}
                            className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-xs'
                                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white">{p.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">• {p.durationLabel}</span>
                                {p.badge && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    {p.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {p.profiles >= 100000 ? 'Unlimited Profiles' : `${p.profiles} Profiles`} • {p.rateSubtext}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-xs font-extrabold text-emerald-300">
                                {paymentMethod === 'crypto' ? `$${p.priceUsd} USDT` : `₹${p.priceInr.toLocaleString()}`}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Container (UPI / Crypto USDT TRC-20) */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 gap-2">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap size={14} className="text-teal-400" />
                        {paymentMethod === 'crypto' ? 'USDT (TRC-20) Payment' : 'UPI Payment'}
                      </span>
                      {usdtEnabled && usdtAddress ? (
                        <div className="inline-flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod('upi');
                              setPaymentSubmittedStatus(null);
                            }}
                            className={`px-2 py-0.5 rounded-md font-bold transition ${
                              paymentMethod === 'upi' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            UPI (₹)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod('crypto');
                              setPaymentSubmittedStatus(null);
                            }}
                            className={`px-2 py-0.5 rounded-md font-bold transition ${
                              paymentMethod === 'crypto' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            USDT ($)
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-400">Verified Gateway</span>
                      )}
                    </div>

                    {paymentMethod === 'crypto' && usdtEnabled && usdtAddress ? (
                      <>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="p-2 bg-white rounded-xl shadow-lg shrink-0 flex flex-col items-center">
                            <img
                              src={usdtQrAsset}
                              alt="Official MAHI USDT TRC-20 QR"
                              className="w-32 h-32 object-contain rounded-lg"
                            />
                            <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase tracking-wider">TRON (TRC-20)</span>
                          </div>

                          <div className="space-y-2.5 w-full text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Network</span>
                              <strong className="text-emerald-300 text-xs block">{usdtNetwork}</strong>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">USDT Wallet Address</span>
                              <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 mt-0.5">
                                <strong className="text-teal-400 font-mono text-[11px] break-all">{usdtAddress}</strong>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(usdtAddress, 'USDT TRC-20 Address')}
                                  className="shrink-0 text-slate-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                                  title="Copy USDT TRC-20 Address"
                                >
                                  <Copy size={11} />
                                  <span className="text-[10px]">Copy</span>
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payable Amount</span>
                              <strong className="text-emerald-400 font-bold text-sm">${priceUsd} USDT (TRC-20)</strong>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(usdtAddress, 'USDT TRC-20 Address')}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                          >
                            <Copy size={13} />
                            <span>Copy Address</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowPaymentForm(!showPaymentForm)}
                            className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 size={13} />
                            <span>{showPaymentForm ? 'Hide TX Form' : 'I Have Sent USDT'}</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          {/* Authoritative Slice QR Asset */}
                          <div className="p-2 bg-white rounded-xl shadow-lg shrink-0 flex flex-col items-center">
                            <img
                              src={upiQrAsset}
                              alt="Official MAHI UPI QR"
                              className="w-32 h-32 object-contain rounded-lg"
                            />
                            <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase tracking-wider">Scan with UPI App</span>
                          </div>

                          {/* UPI Account Details */}
                          <div className="space-y-2.5 w-full text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Holder</span>
                              <strong className="text-white text-sm block">{upiHolder}</strong>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">UPI ID</span>
                              <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 mt-0.5">
                                <strong className="text-teal-400 font-mono text-xs">{upiId}</strong>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(upiId, 'UPI ID')}
                                  className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                                  title="Copy UPI ID"
                                >
                                  <Copy size={11} />
                                  <span className="text-[10px]">Copy</span>
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payable Amount</span>
                              <strong className="text-emerald-400 font-bold text-sm">₹{priceInr} INR</strong>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Copy UPI ID, Online Checkout & I Have Paid */}
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(upiId, 'UPI ID')}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                          >
                            <Copy size={13} />
                            <span>Copy UPI</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleOnlineCheckout}
                            className="py-2 px-3 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                            title="Instant UPI online checkout"
                          >
                            <Sparkles size={13} />
                            <span>Instant UPI</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowPaymentForm(!showPaymentForm)}
                            className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 size={13} />
                            <span>{showPaymentForm ? 'Hide Form' : 'I Have Paid'}</span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* Latest Payment Status / History Banner */}
                    {(latestPayment || paymentSubmittedStatus) && (
                      <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        (latestPayment?.status === 'SUCCEEDED' || paymentSubmittedStatus === 'SUCCEEDED')
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : (latestPayment?.status === 'REJECTED' || latestPayment?.status === 'FAILED')
                          ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                          : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                      }`}>
                        <div className="flex items-center justify-between font-bold">
                          <div className="flex items-center gap-1.5">
                            {(latestPayment?.status === 'SUCCEEDED' || paymentSubmittedStatus === 'SUCCEEDED') ? (
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            ) : (latestPayment?.status === 'REJECTED' || latestPayment?.status === 'FAILED') ? (
                              <AlertTriangle size={14} className="text-rose-400" />
                            ) : (
                              <Clock size={14} className="text-amber-400" />
                            )}
                            <span>Payment Status: {latestPayment?.status || paymentSubmittedStatus}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              fetchPaymentHistory();
                              fetchPlanLimits({ force: true });
                              showToast({ type: 'info', title: 'Refreshed', message: 'Payment status updated.' });
                            }}
                            className="text-[11px] flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 transition"
                          >
                            <RotateCcw size={11} />
                            <span>Refresh Status</span>
                          </button>
                        </div>
                        {(latestPayment?.externalPaymentId || latestPayment?.external_payment_id) && (
                          <div className="text-[11px] font-mono text-slate-400">
                            Ref: {latestPayment.externalPaymentId || latestPayment.external_payment_id}
                          </div>
                        )}
                        {(latestPayment?.status === 'REJECTED' || latestPayment?.status === 'FAILED') && (
                          <p className="text-[11px] text-rose-300 leading-relaxed font-semibold">
                            Rejection Reason: {latestPayment?.metadata?.rejectionReason || latestPayment?.rejection_reason || 'Verification was declined. Please verify your UTR and resubmit.'}
                          </p>
                        )}
                        {(latestPayment?.status === 'PENDING_VERIFICATION' || paymentSubmittedStatus === 'PENDING_VERIFICATION') && (
                          <p className="text-[11px] text-amber-300/90 leading-relaxed">
                            Your payment is under review. An administrator will verify and activate your subscription.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Verification Form */}
                    {showPaymentForm && (
                      <form
                        onSubmit={paymentMethod === 'crypto' ? handleSubmitCryptoPayment : handleSubmitPayment}
                        className="mt-3 pt-3 border-t border-slate-800/80 space-y-3"
                      >
                        {paymentSubmittedStatus ? (
                          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs space-y-1">
                            <div className="flex items-center gap-2 font-bold">
                              <CheckCircle2 size={15} />
                              <span>Status: {paymentSubmittedStatus}</span>
                            </div>
                            <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                              Your {paymentMethod === 'crypto' ? 'TRC-20 transaction hash' : 'UTR'} has been submitted for manual approval. An administrator will verify and activate your PRO entitlement.
                            </p>
                          </div>
                        ) : paymentMethod === 'crypto' ? (
                          <>
                            <div>
                              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                                TRON (TRC-20) Transaction Hash <span className="text-rose-400">*</span>
                              </label>
                              <input
                                type="text"
                                value={txHashInput}
                                onChange={(e) => setTxHashInput(e.target.value)}
                                placeholder="Paste 64-character TRC-20 transaction hash"
                                maxLength={64}
                                required
                                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-teal-500 focus:outline-none"
                              />
                              <p className="text-[10px] text-slate-500 mt-1">
                                Send ONLY USDT on the TRON (TRC-20) network and paste the full 64-char TX hash from TronLink / Binance / OKX.
                              </p>
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmittingPayment}
                              className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2"
                            >
                              {isSubmittingPayment ? (
                                <span>Submitting TX Hash...</span>
                              ) : (
                                <>
                                  <Check size={13} />
                                  <span>Submit Crypto Payment for Approval</span>
                                </>
                              )}
                            </button>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                                UTR / Bank Reference Number <span className="text-rose-400">*</span>
                              </label>
                              <input
                                type="text"
                                value={utrInput}
                                onChange={(e) => setUtrInput(e.target.value)}
                                placeholder="e.g. 427189028341 (12 digits)"
                                required
                                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-teal-500 focus:outline-none"
                              />
                              <p className="text-[10px] text-slate-500 mt-1">
                                Found in your GPay / PhonePe / Paytm / Slice payment receipt under "UTR" or "UPI Ref ID".
                              </p>
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmittingPayment}
                              className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2"
                            >
                              {isSubmittingPayment ? (
                                <span>Verifying &amp; Submitting...</span>
                              ) : (
                                <>
                                  <Check size={13} />
                                  <span>Submit Payment for Approval</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </form>
                    )}
                  </div>

                  {/* WhatsApp Support Backup */}
                  <a
                    href={`https://wa.me/${waCleanNumber}?text=${encodeURIComponent(`Hi, I need help with MAHI PRO payment. Email: ${accountSession?.email || ''}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700/60 transition"
                  >
                    <span>Need Help? Contact WhatsApp Support ({paymentInfo?.whatsapp_number || CONTACT_CONFIG.WHATSAPP_DISPLAY})</span>
                    <ExternalLink size={12} />
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
              {/* Top Navigation Tabs: Sign In is Primary, Create Account is Secondary */}
              {(activeTab === 'signup' || activeTab === 'signin') && (
                <div className="flex p-1 bg-slate-950 rounded-2xl mb-5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('signin'); setErrorMessage(null); setSuccessInfo(null); }}
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
                    onClick={() => { setActiveTab('signup'); setErrorMessage(null); setSuccessInfo(null); }}
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
                    onClick={handleGoogleLogin}
                    disabled={isLoading || isGoogleLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-2.5 active:scale-[0.99]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.28 21.44 7.35 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.57H1.25C.45 8.15 0 9.99 0 12s.45 3.85 1.25 5.43l4.03-3.11z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.28 2.56 1.25 6.57l4.03 3.11c.95-2.83 3.6-4.93 6.72-4.93z"/>
                    </svg>
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
                        onClick={() => { setIsGoogleLoading(false); setSuccessInfo(null); }}
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

                  <form onSubmit={handleLoginSubmit} className="space-y-3.5">
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
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-2 mt-1"
                    >
                      {isLoading ? <span>Signing In...</span> : <span>Sign In</span>}
                    </button>

                    {/* Web Token Paste Option (For smooth desktop handoff from browser) */}
                    {showTokenInput ? (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-teal-800/60 space-y-2">
                        <label className="block text-[11px] font-semibold text-teal-400">
                          Paste Session Token from Browser:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            placeholder="Paste token from web dashboard"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
                          />
                          <button
                            type="button"
                            onClick={handleTokenLoginSubmit}
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
                          onClick={() => setShowTokenInput(true)}
                          className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                        >
                          Have a session token from website? Paste it here
                        </button>
                      </div>
                    )}

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

                    <div className="pt-2 text-center text-[11px] text-slate-400">
                      <span>Don't have an account yet? </span>
                      <button
                        type="button"
                        onClick={() => { setActiveTab('signup'); setErrorMessage(null); }}
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
                    onClick={handleGoogleLogin}
                    disabled={isLoading || isGoogleLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition flex items-center justify-center gap-2.5 active:scale-[0.99] mb-3"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.28 21.44 7.35 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.57H1.25C.45 8.15 0 9.99 0 12s.45 3.85 1.25 5.43l4.03-3.11z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.28 2.56 1.25 6.57l4.03 3.11c.95-2.83 3.6-4.93 6.72-4.93z"/>
                    </svg>
                    <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google (Start 7-Day Trial)'}</span>
                  </button>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-slate-800"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">or register with email</span>
                    <div className="flex-1 h-px bg-slate-800"></div>
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
                      <span>Already registered on website?</span>
                      <button
                        type="button"
                        onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
                        className="text-emerald-400 hover:underline font-bold"
                      >
                        Sign In with existing account
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
