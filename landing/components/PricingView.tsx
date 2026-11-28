'use client';

import { useState, useEffect, useCallback } from 'react';
import { BRAND } from '../lib/brand';
import { getRuntimePaymentMetadata } from '../../10_CONFIG/contact-config';
import {
  PRICING_PLANS,
  getPlanBillingCycle,
  type PlanTier,
  type SelectedPlanModalInfo,
} from './pricing/pricing-data';
import { PlanGrid } from './pricing/PlanGrid';
import { ComparisonMatrix } from './pricing/ComparisonMatrix';
import { PricingFaq } from './pricing/PricingFaq';
import { UpiPaymentModal } from './pricing/UpiPaymentModal';
import { CryptoPaymentModal } from './pricing/CryptoPaymentModal';
import {
  PlatformLogosBar,
  PricingPreFooterCta,
  PricingTestimonialBento,
} from './pricing/PricingEditorialSections';

export default function PricingView() {
  const initialContact = getRuntimePaymentMetadata();
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  // Indian UPI Modal state (build-time env defaults + live Gateway hydration)
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [upiId, setUpiId] = useState(initialContact.upi.id);
  const [upiAccountHolder, setUpiAccountHolder] = useState(initialContact.upi.accountHolder);
  const [upiQrAsset, setUpiQrAsset] = useState(initialContact.upi.qrAssetWeb);
  const [whatsappRawNumber, setWhatsappRawNumber] = useState(initialContact.whatsappRawNumber);
  const [sellerName, setSellerName] = useState(initialContact.legalSellerName);
  const [selectedUpiPlan, setSelectedUpiPlan] = useState<SelectedPlanModalInfo | null>(null);

  const [isYoupiEnabled, setIsYoupiEnabled] = useState(false);
  const [isStripeEnabled, setIsStripeEnabled] = useState(false);
  const [isUsdtEnabled, setIsUsdtEnabled] = useState(initialContact.usdt.enabled);
  const [usdtAddress, setUsdtAddress] = useState(initialContact.usdt.address);
  const [usdtNetwork, setUsdtNetwork] = useState(initialContact.usdt.network);
  const [usdtQrAsset, setUsdtQrAsset] = useState(initialContact.usdt.qrAssetWeb);
  const [isCryptoModalOpen, setIsCryptoModalOpen] = useState(false);
  const [selectedCryptoPlan, setSelectedCryptoPlan] = useState<SelectedPlanModalInfo | null>(null);

  const [gatewaysLoaded, setGatewaysLoaded] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasAuthToken, setHasAuthToken] = useState(false);
  const [activeCheckoutPlanId, setActiveCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const openManualUpiModal = useCallback((plan: PlanTier) => {
    setSelectedUpiPlan({
      id: plan.id,
      name: plan.name,
      price: plan.priceINR,
      billingLabel: plan.billingLabelINR,
      cycle: getPlanBillingCycle(plan.id),
    });
    setIsUpiModalOpen(true);
  }, []);

  const openCryptoModal = useCallback((plan: PlanTier) => {
    setSelectedCryptoPlan({
      id: plan.id,
      name: plan.name,
      price: plan.priceUSD,
      billingLabel: plan.billingLabelUSD,
      cycle: getPlanBillingCycle(plan.id),
    });
    setIsCryptoModalOpen(true);
  }, []);

  // Hydrate URL query state (currency, status) and probe session + payment gateways on mount
  useEffect(() => {
    let mounted = true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // Clean up any legacy token query/hash fragments without storing JWTs in Web Storage.
      if (params.has('token')) {
        params.delete('token');
        const nextQuery = params.toString();
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
        );
      }
      try {
        localStorage.removeItem('mahi_auth_token');
        localStorage.removeItem('mahi_access_token');
      } catch (err) {
        console.debug('[PricingView] legacy localStorage token clear skipped', err);
      }

      const urlCurrency = (params.get('currency') || '').toUpperCase();
      if (urlCurrency === 'USD' || urlCurrency === 'INR') {
        setCurrency(urlCurrency);
      }

      const statusParam = params.get('status');
      if (statusParam === 'success') {
        setCheckoutNotice('Payment completed! Your MAHI Browser subscription is activating.');
      } else if (statusParam === 'cancelled') {
        setCheckoutError('Checkout was cancelled before completion. Select a plan to retry anytime.');
      }

      const openUpi = params.get('openUpi');
      const openCrypto = params.get('openCrypto');
      const requestedPlanId = params.get('plan');
      if (openUpi === '1' && requestedPlanId) {
        const matched = PRICING_PLANS.find((p) => p.id === requestedPlanId);
        if (matched) {
          openManualUpiModal(matched);
        }
      } else if (openCrypto === '1' && requestedPlanId) {
        const matched = PRICING_PLANS.find((p) => p.id === requestedPlanId);
        if (matched) {
          setCurrency('USD');
          openCryptoModal(matched);
        }
      }
    }

    const fetchSessionStatus = async () => {
      try {
        const resp = await fetch(`${BRAND.apiUrl}/api/v1/auth/me`, {
          method: 'GET',
          credentials: 'include',
        });
        if (mounted) {
          setHasAuthToken(resp.ok);
        }
      } catch {
        if (mounted) {
          setHasAuthToken(false);
        }
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    };

    const fetchGateways = async () => {
      try {
        const resp = await fetch(`${BRAND.apiUrl}/api/v1/billing/gateways`);
        if (resp.ok) {
          const data = (await resp.json()) as {
            gateways?: Array<{
              id?: string;
              enabled?: boolean;
              walletAddress?: string;
              network?: string;
              qrAsset?: string;
              upiId?: string;
              accountHolder?: string;
            }>;
            support?: {
              whatsappRawNumber?: string;
              sellerName?: string;
            };
          };
          if (mounted && Array.isArray(data?.gateways)) {
            const youpi = data.gateways.find((g) => g.id === 'youpi_pg');
            if (youpi?.enabled) {
              setIsYoupiEnabled(true);
            }
            const stripe = data.gateways.find((g) => g.id === 'stripe');
            if (stripe?.enabled) {
              setIsStripeEnabled(true);
            }
            const usdt = data.gateways.find((g) => g.id === 'usdt_trc20');
            if (usdt) {
              setIsUsdtEnabled(Boolean(usdt.enabled));
              if (usdt.walletAddress) setUsdtAddress(usdt.walletAddress);
              if (usdt.network) setUsdtNetwork(usdt.network);
              if (usdt.qrAsset) setUsdtQrAsset(usdt.qrAsset);
            }
            const upiManual = data.gateways.find((g) => g.id === 'upi_manual');
            if (upiManual) {
              if (upiManual.upiId) setUpiId(upiManual.upiId);
              if (upiManual.accountHolder) setUpiAccountHolder(upiManual.accountHolder);
              if (upiManual.qrAsset) setUpiQrAsset(upiManual.qrAsset);
            }
          }
          if (mounted && data?.support) {
            if (data.support.whatsappRawNumber) setWhatsappRawNumber(data.support.whatsappRawNumber);
            if (data.support.sellerName) setSellerName(data.support.sellerName);
          }
        }
      } catch (err) {
        console.debug('[PricingView] gateway probe failed, using defaults', err);
      } finally {
        if (mounted) {
          setGatewaysLoaded(true);
        }
      }
    };
    void fetchSessionStatus();
    void fetchGateways();
    return () => {
      mounted = false;
    };
  }, [openCryptoModal, openManualUpiModal]);

  // Telemetry event tracking (active in production to avoid dev-mode 404 toast)
  const trackFunnel = useCallback((eventName: string, metadata?: Record<string, unknown>) => {
    try {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && navigator.sendBeacon) {
        const payload = JSON.stringify({ eventName, source: 'pricing_page', ...metadata });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/funnel/track', blob);
      }
    } catch (err) {
      console.debug('[PricingView] funnel telemetry skipped', err);
    }
  }, []);

  const startOnlineCheckout = useCallback(async (
    plan: PlanTier,
    targetCurrency: 'INR' | 'USD',
    provider: 'youpi_pg' | 'stripe'
  ): Promise<{ redirected: boolean; error?: string }> => {
    if (typeof window === 'undefined') {
      return { redirected: false };
    }

    const cycle = getPlanBillingCycle(plan.id);
    const nextPricingPath = `/pricing?plan=${encodeURIComponent(plan.id)}&currency=${targetCurrency}&autoCheckout=1`;

    if (authChecked && !hasAuthToken) {
      if (targetCurrency === 'USD') {
        window.location.href = `/signup?plan=${encodeURIComponent(plan.id)}&currency=USD&redirect=${encodeURIComponent(nextPricingPath)}`;
      } else {
        window.location.href = `/login?redirect=${encodeURIComponent(nextPricingPath)}&plan=${encodeURIComponent(plan.id)}&currency=INR`;
      }
      return { redirected: true };
    }

    try {
      setActiveCheckoutPlanId(plan.id);
      const origin = window.location.origin;
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/billing/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: cycle,
          provider,
          currency: targetCurrency,
          successUrl: `${origin}/pricing?status=success&plan=${encodeURIComponent(plan.id)}&currency=${targetCurrency}`,
          cancelUrl: `${origin}/pricing?status=cancelled&plan=${encodeURIComponent(plan.id)}&currency=${targetCurrency}`,
        }),
      });

      if (resp.status === 401) {
        setHasAuthToken(false);
        if (targetCurrency === 'USD') {
          window.location.href = `/signup?plan=${encodeURIComponent(plan.id)}&currency=USD&redirect=${encodeURIComponent(nextPricingPath)}`;
        } else {
          window.location.href = `/login?redirect=${encodeURIComponent(nextPricingPath)}&plan=${encodeURIComponent(plan.id)}&currency=INR`;
        }
        return { redirected: true };
      }

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return { redirected: true };
      }

      const errorMessage =
        typeof data?.error === 'string'
          ? data.error
          : data?.error?.message || `Checkout failed (${resp.status}).`;
      return { redirected: false, error: errorMessage };
    } catch {
      return { redirected: false, error: 'Unable to reach billing service. Please retry.' };
    } finally {
      setActiveCheckoutPlanId(null);
    }
  }, [authChecked, hasAuthToken]);

  // Auto-resume checkout after returning from /login or /signup
  useEffect(() => {
    if (!gatewaysLoaded || !authChecked || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoCheckout') !== '1') return;

    const planId = params.get('plan');
    const urlCurrency = (params.get('currency') || '').toUpperCase();
    const targetCurrency: 'INR' | 'USD' = urlCurrency === 'USD' ? 'USD' : 'INR';
    const matchedPlan = PRICING_PLANS.find((p) => p.id === planId);

    params.delete('autoCheckout');
    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
    );

    if (!matchedPlan || !hasAuthToken) return;

    if (targetCurrency === 'USD') {
      if (isStripeEnabled) {
        void startOnlineCheckout(matchedPlan, 'USD', 'stripe').then((res) => {
          if (!res.redirected && res.error) {
            setCheckoutError(res.error);
          }
        });
      } else if (isUsdtEnabled && usdtAddress) {
        openCryptoModal(matchedPlan);
      }
    } else if (isYoupiEnabled) {
      void startOnlineCheckout(matchedPlan, 'INR', 'youpi_pg').then((res) => {
        if (!res.redirected) {
          openManualUpiModal(matchedPlan);
        }
      });
    } else {
      openManualUpiModal(matchedPlan);
    }
  }, [
    gatewaysLoaded,
    authChecked,
    hasAuthToken,
    isYoupiEnabled,
    isStripeEnabled,
    isUsdtEnabled,
    usdtAddress,
    openCryptoModal,
    openManualUpiModal,
    startOnlineCheckout,
  ]);

  // Plan CTA Click Handler
  const handlePlanClick = async (plan: PlanTier) => {
    trackFunnel('plan_cta_clicked', { planId: plan.id, currency });
    setCheckoutError(null);
    setCheckoutNotice(null);

    if (currency === 'INR') {
      if (isYoupiEnabled) {
        const result = await startOnlineCheckout(plan, 'INR', 'youpi_pg');
        if (result.redirected) return;
      }

      openManualUpiModal(plan);
    } else {
      if (isStripeEnabled) {
        const result = await startOnlineCheckout(plan, 'USD', 'stripe');
        if (result.redirected) return;
        if (result.error && !isUsdtEnabled) {
          setCheckoutError(result.error);
          return;
        }
      }

      if (isUsdtEnabled && usdtAddress) {
        openCryptoModal(plan);
      } else {
        const result = await startOnlineCheckout(plan, 'USD', 'stripe');
        if (!result.redirected && result.error) {
          setCheckoutError(result.error);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-[#ededed] selection:bg-white selection:text-black">
      {/* 1. HERO SECTION */}
      <section className="relative w-full pt-32 sm:pt-40 lg:pt-44 pb-20 bg-[#030303] text-white overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
            <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
              PRICING
            </span>
          </div>

          <h1 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[62px] xl:text-[68px] font-light tracking-[-0.02em] leading-[1.08] text-white mb-4">
            Simple Pricing<br />
            <span className="italic text-zinc-400 font-light">Built for Scale</span>
          </h1>

          <p className="text-zinc-400 text-sm sm:text-[15px] lg:text-[16px] max-w-[660px] mx-auto font-normal leading-[1.6] mb-9">
            Start automating multi-account operations for less than the cost of a single ban. Most operators see 10x ROI and 99.8% fleet survival in their first month.
          </p>

          {/* Currency Controls (USD $ / INR ₹ 0% UPI) */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-12 sm:mb-16">
            <div className="inline-flex items-center rounded-full bg-zinc-900/80 border border-zinc-800 p-0.5 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setCurrency('INR')}
                className={`rounded-full px-3.5 py-1.5 font-medium transition-all ${
                  currency === 'INR' ? 'bg-white text-black shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                INR (₹ UPI 0% Fee)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`rounded-full px-3.5 py-1.5 font-medium transition-all ${
                  currency === 'USD' ? 'bg-white text-black shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          {(checkoutNotice || checkoutError) && (
            <div className="max-w-2xl mx-auto mb-10">
              {checkoutNotice && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {checkoutNotice}
                </div>
              )}
              {checkoutError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {checkoutError}
                </div>
              )}
            </div>
          )}

          <PlanGrid
            plans={PRICING_PLANS}
            currency={currency}
            activeCheckoutPlanId={activeCheckoutPlanId}
            isYoupiEnabled={isYoupiEnabled}
            isStripeEnabled={isStripeEnabled}
            isUsdtEnabled={isUsdtEnabled}
            usdtAddress={usdtAddress}
            usdtNetwork={usdtNetwork}
            onPlanClick={handlePlanClick}
            onOpenCryptoModal={openCryptoModal}
          />

          <PlatformLogosBar />
        </div>
      </section>

      <ComparisonMatrix
        plans={PRICING_PLANS}
        currency={currency}
        isYoupiEnabled={isYoupiEnabled}
        isStripeEnabled={isStripeEnabled}
        isUsdtEnabled={isUsdtEnabled}
        onPlanClick={handlePlanClick}
      />

      <PricingTestimonialBento />

      <PricingFaq
        upiId={upiId}
        onDownloadClick={(source) => trackFunnel('download_started', { source })}
      />

      <PricingPreFooterCta
        onDownloadClick={(source) => trackFunnel('download_started', { source })}
      />

      <UpiPaymentModal
        isOpen={isUpiModalOpen}
        plan={selectedUpiPlan}
        isYoupiEnabled={isYoupiEnabled}
        upiId={upiId}
        upiAccountHolder={upiAccountHolder}
        upiQrAsset={upiQrAsset}
        whatsappRawNumber={whatsappRawNumber}
        sellerName={sellerName}
        hasAuthToken={hasAuthToken}
        onClose={() => setIsUpiModalOpen(false)}
        onUnauthenticated={() => setHasAuthToken(false)}
        onTrackFunnel={trackFunnel}
      />

      <CryptoPaymentModal
        isOpen={isCryptoModalOpen}
        plan={selectedCryptoPlan}
        usdtNetwork={usdtNetwork}
        usdtAddress={usdtAddress}
        usdtQrAsset={usdtQrAsset}
        whatsappRawNumber={whatsappRawNumber}
        sellerName={sellerName}
        hasAuthToken={hasAuthToken}
        onClose={() => setIsCryptoModalOpen(false)}
        onUnauthenticated={() => setHasAuthToken(false)}
        onTrackFunnel={trackFunnel}
      />
    </div>
  );
}
