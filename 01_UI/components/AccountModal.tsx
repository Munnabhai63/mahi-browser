import React, { useState, useEffect, useRef } from 'react';
import { Laptop, LogOut, X } from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { BrandLogo } from './BrandLogo.js';
import { fetchMyLicense, type MyLicenseResponse } from '../api-fallback.js';
import {
  mergeDynamicPlans,
  type CanonicalBillingCycle,
  type DesktopPlanOption,
} from './account/account-plan-config.js';
import { useAccountModalActions } from './account/useAccountModalActions.js';
import { AccountOverviewTab } from './account/AccountOverviewTab.js';
import { AccountSessionsTab } from './account/AccountSessionsTab.js';
import { AccountBillingTab } from './account/AccountBillingTab.js';
import { AccountAuthView } from './account/AccountAuthView.js';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
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

  const [myLicense, setMyLicense] = useState<MyLicenseResponse | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<'mahi_starter' | 'mahi_growth' | 'mahi_ultimate'>('mahi_growth');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<CanonicalBillingCycle>('SEMI_ANNUAL');

  const isUserLoggedIn = Boolean(accountSession?.token);
  const currentPlan = planLimits?.plan || 'free';
  const isProActive = planLimits?.isPro || false;

  const dynamicPlans = React.useMemo(() => mergeDynamicPlans(pricingCatalog), [pricingCatalog]);
  const activePlanMeta = dynamicPlans.find((p) => p.id === selectedPlanId) || dynamicPlans[1] || dynamicPlans[0];
  const priceInr = activePlanMeta.priceInr;
  const priceUsd = activePlanMeta.priceUsd;
  const latestPayment = (paymentHistory && paymentHistory.length > 0) ? paymentHistory[0] : null;

  const actions = useAccountModalActions({
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
  });

  const {
    setErrorMessage,
    setSuccessInfo,
    setDeviceMismatchError,
    setIsGoogleLoading,
    setIsLoading,
    isGoogleLoading,
  } = actions;

  const wasUserLoggedInRef = useRef(isUserLoggedIn);
  const isGoogleLoadingRef = useRef(isGoogleLoading);

  useEffect(() => {
    isGoogleLoadingRef.current = isGoogleLoading;
  }, [isGoogleLoading]);

  useEffect(() => {
    if (isOpen) {
      wasUserLoggedInRef.current = Boolean(useAccountStore.getState().accountSession?.token);
    }
  }, [isOpen]);

  const handleSelectPlan = (plan: DesktopPlanOption) => {
    setSelectedPlanId(plan.id);
    setSelectedBillingCycle(plan.billingCycle);
  };

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
  }, [
    isOpen,
    isUserLoggedIn,
    fetchPlanLimits,
    fetchPricingCatalog,
    fetchPaymentInfo,
    fetchPaymentHistory,
    fetchActiveSessions,
    setErrorMessage,
    setSuccessInfo,
    setDeviceMismatchError,
  ]);

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
  }, [isOpen, isGoogleLoading, isUserLoggedIn, accountSession?.email, showToast, onClose, setIsGoogleLoading]);

  // Listen for account:statusChanged IPC event from deep-link login
  useEffect(() => {
    if (!isOpen) return;
    const unsub = window.mahiAPI?.onAccountStatusChanged?.(async () => {
      const wasSignedIn = wasUserLoggedInRef.current;
      const wasPendingGoogle = isGoogleLoadingRef.current;

      setIsGoogleLoading(false);
      setIsLoading(false);

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
    });

    return () => {
      unsub?.();
    };
  }, [isOpen, fetchPlanLimits, onClose, showToast, setIsGoogleLoading, setIsLoading]);

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
            <div className="space-y-5">
              <AccountOverviewTab
                accountSession={accountSession}
                currentPlan={currentPlan}
                isProActive={isProActive}
                planLimits={planLimits}
                trialStatus={trialStatus}
                isActivatingTrial={actions.isActivatingTrial}
                myLicense={myLicense}
                onActivateTrial={actions.handleActivateTrial}
              />

              <AccountSessionsTab
                activeSessions={activeSessions}
                onRevokeSession={actions.handleRevokeSessionClick}
                onRevokeAllSessions={actions.handleRevokeAllSessionsClick}
              />

              {!isProActive && (
                <AccountBillingTab
                  activePlanMeta={activePlanMeta}
                  dynamicPlans={dynamicPlans}
                  priceInr={priceInr}
                  priceUsd={priceUsd}
                  paymentMethod={actions.paymentMethod}
                  showPaymentForm={actions.showPaymentForm}
                  utrInput={actions.utrInput}
                  txHashInput={actions.txHashInput}
                  isSubmittingPayment={actions.isSubmittingPayment}
                  paymentSubmittedStatus={actions.paymentSubmittedStatus}
                  latestPayment={latestPayment}
                  paymentInfo={paymentInfo}
                  accountEmail={accountSession?.email}
                  onSelectPlan={handleSelectPlan}
                  onPaymentMethodChange={(method) => {
                    actions.setPaymentMethod(method);
                    actions.setPaymentSubmittedStatus(null);
                  }}
                  onTogglePaymentForm={() => actions.setShowPaymentForm(!actions.showPaymentForm)}
                  onUtrChange={actions.setUtrInput}
                  onTxHashChange={actions.setTxHashInput}
                  onCopyToClipboard={actions.copyToClipboard}
                  onOnlineCheckout={actions.handleOnlineCheckout}
                  onRefreshPaymentStatus={() => {
                    fetchPaymentHistory();
                    fetchPlanLimits({ force: true });
                    showToast({ type: 'info', title: 'Refreshed', message: 'Payment status updated.' });
                  }}
                  onSubmitPayment={actions.handleSubmitPayment}
                  onSubmitCryptoPayment={actions.handleSubmitCryptoPayment}
                />
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={actions.handleSwitchDeviceClick}
                  disabled={actions.isLoading}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <Laptop size={14} />
                  <span>Rebind Device</span>
                </button>

                <button
                  type="button"
                  onClick={actions.handleLogoutClick}
                  disabled={actions.isLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 transition flex items-center gap-1.5"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <AccountAuthView
              activeTab={actions.activeTab}
              email={actions.email}
              password={actions.password}
              confirmPassword={actions.confirmPassword}
              verificationToken={actions.verificationToken}
              tokenInput={actions.tokenInput}
              showTokenInput={actions.showTokenInput}
              isGoogleLoading={actions.isGoogleLoading}
              resetToken={actions.resetToken}
              newPassword={actions.newPassword}
              confirmNewPassword={actions.confirmNewPassword}
              isLoading={actions.isLoading}
              errorMessage={actions.errorMessage}
              successInfo={actions.successInfo}
              deviceMismatchError={actions.deviceMismatchError}
              onSetActiveTab={actions.setActiveTab}
              onClearNotices={() => { actions.setErrorMessage(null); actions.setSuccessInfo(null); }}
              onClearErrorOnly={() => actions.setErrorMessage(null)}
              onEmailChange={actions.setEmail}
              onPasswordChange={actions.setPassword}
              onConfirmPasswordChange={actions.setConfirmPassword}
              onVerificationTokenChange={actions.setVerificationToken}
              onTokenInputChange={actions.setTokenInput}
              onShowTokenInput={() => actions.setShowTokenInput(true)}
              onCancelGoogleLogin={() => { actions.setIsGoogleLoading(false); actions.setSuccessInfo(null); }}
              onResetTokenChange={actions.setResetToken}
              onNewPasswordChange={actions.setNewPassword}
              onConfirmNewPasswordChange={actions.setConfirmNewPassword}
              onGoogleLogin={actions.handleGoogleLogin}
              onLoginSubmit={actions.handleLoginSubmit}
              onSignupSubmit={actions.handleSignupSubmit}
              onTokenLoginSubmit={actions.handleTokenLoginSubmit}
              onSwitchDeviceClick={actions.handleSwitchDeviceClick}
              onVerifyEmailSubmit={actions.handleVerifyEmailSubmit}
              onResendVerificationClick={actions.handleResendVerificationClick}
              onForgotPasswordSubmit={actions.handleForgotPasswordSubmit}
              onResetPasswordSubmit={actions.handleResetPasswordSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
};
