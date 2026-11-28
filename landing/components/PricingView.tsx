'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '../lib/brand';
import { getRuntimePaymentMetadata } from '../../10_CONFIG/contact-config';

interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  popular?: boolean;
  badge?: string;
  priceINR: number;
  priceUSD: number;
  billingLabelINR: string;
  billingLabelUSD: string;
  group1Title: string;
  group1Features: string[];
  group2Title: string;
  group2Features: string[];
  ctaText: string;
  ctaHref: string;
}

const PRICING_PLANS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For solo affiliates and growth operators deploying their first stealth fleet.',
    priceINR: 599,
    priceUSD: 9,
    billingLabelINR: '1 MONTH ACCESS • ₹599 / MO',
    billingLabelUSD: '1 MONTH ACCESS • $9 / MO',
    group1Title: 'Engines & Profiles',
    group1Features: [
      '25 Air-Gapped Profiles (Offline SQLite)',
      'Dual Engine (Chromium 138 + Camoufox)',
      '25 Custom Proxy Slots (HTTP/SOCKS5)',
      '1 Active Device Seat',
    ],
    group2Title: 'Stealth & Isolation',
    group2Features: [
      'Zero CDP Artifacts (Rebrowser-Patches)',
      'Natural Bézier Curves & Typing Cadence',
      '3 Max Concurrent Browser Windows',
      '0% Instant UPI Payments (Slice UPI)',
    ],
    ctaText: 'Start 1 Month',
    ctaHref: '/signup?plan=starter',
  },
  {
    id: 'growth',
    name: 'Growth',
    popular: true,
    badge: 'Popular',
    tagline: 'For agile media buyer squads, scraping clusters, and multi-store operators.',
    priceINR: 999,
    priceUSD: 15,
    billingLabelINR: '6 MONTHS ACCESS • ₹166 / MO (SAVE 72%)',
    billingLabelUSD: '6 MONTHS ACCESS • $2.5 / MO (SAVE 72%)',
    group1Title: 'Engines & Unlocked Quotas',
    group1Features: [
      '100 High-Entropy Profiles (Offline SQLite)',
      'Unlimited Custom Proxies (BYOP)',
      'Unlimited Fingerprint Perturbation & Re-gen',
      'Unlimited Bulk Cookie & Session Importer',
    ],
    group2Title: 'Workflows & Cloud Backup',
    group2Features: [
      'Visual RPA Studio & Cookie Warmer',
      '25 Encrypted Cloud Backup Profiles',
      '10 Concurrent Running Windows',
      'Priority Chat & Ticket Support',
    ],
    ctaText: 'Get Growth (6 Months)',
    ctaHref: '/signup?plan=growth',
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    badge: 'Best Value',
    tagline: 'For enterprise fleets requiring unlimited offline profiles and dedicated VIP support.',
    priceINR: 1499,
    priceUSD: 24,
    billingLabelINR: 'ANNUAL ACCESS • ₹125 / MO (SAVE 79%)',
    billingLabelUSD: 'ANNUAL ACCESS • $2.0 / MO (SAVE 79%)',
    group1Title: 'Unlimited Fleets & Hardware',
    group1Features: [
      'Unlimited Air-Gapped Profiles (Offline SQLite)',
      'Unlimited Dual-Engine Stealth Fingerprints',
      'Unlimited Proxy Management & Routing',
      'Unlimited RPA & Headless Playwright API',
    ],
    group2Title: 'Governance & VIP Support',
    group2Features: [
      'Encrypted Cloud Backup & Workspace Sync',
      '2 Authorized Device Workspaces',
      'Up to 25 Concurrent Running Windows',
      '24/7 Dedicated VIP WhatsApp Support',
    ],
    ctaText: 'Get Ultimate (1 Year)',
    ctaHref: '/signup?plan=ultimate',
  },
];

const PLATFORM_LOGOS = [
  { name: 'Meta', src: '/assets/img/platforms/meta-logo.svg', h: 'h-5 sm:h-5.5' },
  { name: 'Google Ads', src: '/assets/img/platforms/g-ads-logo.svg', h: 'h-5 sm:h-5.5' },
  { name: 'TikTok', src: '/assets/img/platforms/tiktok-logo-1.svg', h: 'h-4.5 sm:h-5' },
  { name: 'Amazon', src: '/assets/img/platforms/amazon-logo-1.svg', h: 'h-5 sm:h-5.5' },
  { name: 'eBay', src: '/assets/img/platforms/ebay-logo-1.svg', h: 'h-5 sm:h-5.5' },
  { name: 'YouTube', src: '/assets/img/platforms/youTube-logo.svg', h: 'h-5 sm:h-5.5' },
  { name: 'Reddit', src: '/assets/img/platforms/reddit-logo-1.svg', h: 'h-5 sm:h-5.5' },
  { name: 'LinkedIn', src: '/assets/img/platforms/linkedin-logo-1.svg', h: 'h-5 sm:h-5.5' },
];

const COMPARISON_CATEGORIES = [
  {
    name: 'Engines & Profile Quotas',
    features: [
      { name: 'Profiles Included', starter: '25 Air-Gapped', growth: '100 Profiles', ultimate: 'Unlimited' },
      { name: 'Chromium 138 MV3 World Stealth', starter: true, growth: true, ultimate: true },
      { name: 'Camoufox C++ Anti-Detect Firefox', starter: true, growth: true, ultimate: true },
      { name: 'Offline SQLite Database (Air-Gapped)', starter: true, growth: true, ultimate: true },
    ],
  },
  {
    name: 'Stealth & Fingerprinting',
    features: [
      { name: 'Integrated Rebrowser-Patches (Zero CDP Artifacts)', starter: true, growth: true, ultimate: true },
      { name: 'CreepJS Detection Benchmark', starter: '0.0% (A+)', growth: '0.0% (A+)', ultimate: '0.0% (A+)' },
      { name: 'Custom Proxy Slots (HTTP/SOCKS5)', starter: '25 Slots', growth: 'Unlimited', ultimate: 'Unlimited' },
      { name: 'Fingerprint Perturbation & Re-generations', starter: 'Standard', growth: 'Unlimited', ultimate: 'Unlimited' },
      { name: 'Bulk Cookie & Session Importer (JSON/Netscape)', starter: 'Standard', growth: 'Unlimited', ultimate: 'Unlimited' },
    ],
  },
  {
    name: 'Automation & Hardware Concurrency',
    features: [
      { name: 'Visual RPA Studio & Flow Builder', starter: 'Basic', growth: 'Advanced', ultimate: 'Unlimited' },
      { name: 'Automated Cookie Warmer & Session Healer', starter: false, growth: true, ultimate: true },
      { name: 'Playwright / Puppeteer Remote API Access', starter: false, growth: true, ultimate: true },
      { name: 'Simultaneous Active Browser Windows', starter: '3 Windows', growth: '10 Windows', ultimate: '25 Windows' },
    ],
  },
  {
    name: 'Governance, Sync & Support',
    features: [
      { name: '0% Fee Instant Indian UPI Payments (Slice UPI)', starter: true, growth: true, ultimate: true },
      { name: 'Authorized Device Workspaces', starter: '1 Device', growth: '1 Device', ultimate: '2 Devices' },
      { name: 'Encrypted Cloud Backup & Session Sync', starter: false, growth: '25 Profiles', ultimate: 'Included' },
      { name: 'Support SLA', starter: 'Standard Email', growth: 'Priority Chat', ultimate: '24/7 Dedicated WhatsApp' },
    ],
  },
];

function getPricingFaqs(upiId: string) {
  return [
    {
      question: 'How are browser profiles stored and isolated in MAHI Browser?',
      answer:
        'Unlike legacy cloud tools that send your session data to external cloud servers, MAHI Browser stores all profile cookies, local storage, and proxy configurations in local-first encrypted SQLite databases on your machine. Your profiles run completely air-gapped without leaking data.',
    },
    {
      question: 'What is the difference between Starter (1M), Growth (6M), and Ultimate (1Y)?',
      answer:
        'Starter (₹599) includes 25 air-gapped profiles for 1 month. Growth (₹999) provides 6 months of access (effective ₹166/month) with 100 profiles and unlimited proxy slots. Ultimate (₹1,499) provides 1 full year of access (effective ₹125/month) with unlimited offline profiles, 2 device workspaces, and 24/7 dedicated VIP WhatsApp support.',
    },
    {
      question: 'How does 0% fee Indian UPI payment work?',
      answer:
        `You can pay directly via any Indian UPI app (PhonePe, Google Pay, Paytm, CRED, BHIM) to our registered merchant VPA ${upiId}. There are zero international credit card markups or foreign transaction fees. Your license key is verified and activated promptly.`,
    },
    {
      question: 'Can I import my existing GoLogin or AdsPower profiles and cookies?',
      answer:
        'Yes. MAHI Browser features a Universal Bulk Importer. Simply export your profiles from GoLogin, AdsPower, or Multilogin as JSON, drag and drop the file into MAHI Browser, and our engine automatically maps proxies, User-Agents, and cookies into isolated profiles.',
    },
    {
      question: 'Can I upgrade from 1 Month or 6 Months to 1 Year later?',
      answer:
        'Yes. You can upgrade at any time. Any remaining days on your current subscription will be prorated and stacked seamlessly onto your new 1-Year Ultimate plan.',
    },
    {
      question: 'What is the 7-day money-back guarantee?',
      answer:
        'If our dual-engine architecture (Chromium 138 + Camoufox) fails to pass your target platform’s anti-fraud checks (Cloudflare Turnstile, DataDome, CreepJS), simply message our WhatsApp support within 7 days for a full, unconditional refund.',
    },
  ];
}

type BillingCycle = 'MONTHLY' | 'SEMI_ANNUAL' | 'ANNUAL';

function getPlanBillingCycle(planId: string): BillingCycle {
  if (planId === 'starter') return 'MONTHLY';
  if (planId === 'growth') return 'SEMI_ANNUAL';
  return 'ANNUAL';
}

export default function PricingView() {
  const initialContact = getRuntimePaymentMetadata();
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Indian UPI Modal state (build-time env defaults + live Gateway hydration)
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [upiId, setUpiId] = useState(initialContact.upi.id);
  const [upiAccountHolder, setUpiAccountHolder] = useState(initialContact.upi.accountHolder);
  const [upiQrAsset, setUpiQrAsset] = useState(initialContact.upi.qrAssetWeb);
  const [whatsappRawNumber, setWhatsappRawNumber] = useState(initialContact.whatsappRawNumber);
  const [sellerName, setSellerName] = useState(initialContact.legalSellerName);
  const [selectedUpiPlan, setSelectedUpiPlan] = useState<{
    id: string;
    name: string;
    price: number;
    billingLabel: string;
    cycle: BillingCycle;
  } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [submittedPaymentId, setSubmittedPaymentId] = useState<string | null>(null);
  const [isYoupiEnabled, setIsYoupiEnabled] = useState(false);
  const [isStripeEnabled, setIsStripeEnabled] = useState(false);
  const [isUsdtEnabled, setIsUsdtEnabled] = useState(initialContact.usdt.enabled);
  const [usdtAddress, setUsdtAddress] = useState(initialContact.usdt.address);
  const [usdtNetwork, setUsdtNetwork] = useState(initialContact.usdt.network);
  const [usdtQrAsset, setUsdtQrAsset] = useState(initialContact.usdt.qrAssetWeb);
  const [isCryptoModalOpen, setIsCryptoModalOpen] = useState(false);
  const [selectedCryptoPlan, setSelectedCryptoPlan] = useState<{
    id: string;
    name: string;
    price: number;
    billingLabel: string;
    cycle: BillingCycle;
  } | null>(null);
  const [copiedCrypto, setCopiedCrypto] = useState(false);
  const [txHashInput, setTxHashInput] = useState('');
  const [txSubmitted, setTxSubmitted] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [submittedCryptoPaymentId, setSubmittedCryptoPaymentId] = useState<string | null>(null);
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
    setUtrSubmitted(false);
    setUtrInput('');
    setUtrError(null);
    setSubmittedPaymentId(null);
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
    setTxSubmitted(false);
    setTxHashInput('');
    setTxError(null);
    setSubmittedCryptoPaymentId(null);
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
  const trackFunnel = (eventName: string, metadata?: Record<string, unknown>) => {
    try {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && navigator.sendBeacon) {
        const payload = JSON.stringify({ eventName, source: 'pricing_page', ...metadata });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/funnel/track', blob);
      }
    } catch (err) {
      console.debug('[PricingView] funnel telemetry skipped', err);
    }
  };

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

  // Copy VPA to clipboard (with safe promise catch and textarea fallback)
  const handleCopyUpi = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(upiId)
          .then(() => {
            setCopiedUpi(true);
            setTimeout(() => setCopiedUpi(false), 2500);
          })
          .catch(() => {
            setCopiedUpi(true);
            setTimeout(() => setCopiedUpi(false), 2500);
          });
      } else {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      }
    } catch (_) {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  // Handle UTR submission
  const handleUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUtr = utrInput.trim();
    if (!trimmedUtr || !selectedUpiPlan) return;

    if (!/^[a-zA-Z0-9]{6,30}$/.test(trimmedUtr)) {
      setUtrError('Please enter a valid 6-30 character alphanumeric UTR / Transaction Reference number.');
      return;
    }

    setIsSubmittingUtr(true);
    setUtrError(null);

    try {
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/account/payments/upi/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedUpiPlan.id,
          billingCycle: selectedUpiPlan.cycle,
          utr: trimmedUtr,
          currency: 'INR',
        }),
      });

      if (resp.status === 401) {
        setHasAuthToken(false);
        setUtrError('Please log in first so we can attach this payment to your account.');
        return;
      }

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        setUtrError(
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || 'Could not submit UTR. Please check and retry.'
        );
        return;
      }

      trackFunnel('upi_utr_submitted', {
        utr: trimmedUtr,
        paymentId: data.payment_id,
        amountPaise: data.amount_paise,
      });
      setSubmittedPaymentId(data.payment_id || null);
      setUtrSubmitted(true);
    } catch {
      setUtrError('Network error. Your payment is safe — please retry or contact support.');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  const handleCopyCrypto = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(usdtAddress)
          .then(() => {
            setCopiedCrypto(true);
            setTimeout(() => setCopiedCrypto(false), 2500);
          })
          .catch(() => {
            setCopiedCrypto(true);
            setTimeout(() => setCopiedCrypto(false), 2500);
          });
      } else {
        setCopiedCrypto(true);
        setTimeout(() => setCopiedCrypto(false), 2500);
      }
    } catch (_) {
      setCopiedCrypto(true);
      setTimeout(() => setCopiedCrypto(false), 2500);
    }
  };

  const handleCryptoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedHash = txHashInput.trim();
    if (!trimmedHash || !selectedCryptoPlan) return;

    if (!/^[a-fA-F0-9]{64}$/.test(trimmedHash)) {
      setTxError('Please paste a valid 64-character TRON (TRC-20) transaction hash.');
      return;
    }

    setIsSubmittingTx(true);
    setTxError(null);

    try {
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/account/payments/crypto/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: selectedCryptoPlan.id,
          billingCycle: selectedCryptoPlan.cycle,
          txHash: trimmedHash,
          network: usdtNetwork,
        }),
      });

      if (resp.status === 401) {
        setHasAuthToken(false);
        setTxError('Please log in first so we can attach this USDT payment to your account.');
        return;
      }

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        setTxError(
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || 'Could not submit TRC-20 transaction hash. Please check and retry.'
        );
        return;
      }

      trackFunnel('crypto_tx_submitted', {
        txHash: trimmedHash,
        paymentId: data.payment_id,
        amountCents: data.amount_cents,
      });
      setSubmittedCryptoPaymentId(data.payment_id || null);
      setTxSubmitted(true);
    } catch {
      setTxError('Network error. Your transaction is safe on-chain — please retry or contact support.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-[#ededed] selection:bg-white selection:text-black">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: EXACT LATERAL SCALE, DARK OBSIDIAN AESTHETIC             */}
      {/* ========================================================================= */}
      <section className="relative w-full pt-32 sm:pt-40 lg:pt-44 pb-20 bg-[#030303] text-white overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 text-center">
          
          {/* Eyebrow: ■ PRICING */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
            <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
              PRICING
            </span>
          </div>

          {/* Headline in Spectral Serif */}
          <h1 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[62px] xl:text-[68px] font-light tracking-[-0.02em] leading-[1.08] text-white mb-4">
            Simple Pricing<br />
            <span className="italic text-zinc-400 font-light">Built for Scale</span>
          </h1>

          {/* Subtitle */}
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

          {/* ========================================================================= */}
          {/* 3 PRICING CARDS: EXPANDED SIZE, HIGH-END SCALE & LUXURY MONOCHROME        */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 xl:gap-8 max-w-[1380px] mx-auto text-left items-stretch">
            {PRICING_PLANS.map((plan) => {
              const price = currency === 'INR' ? plan.priceINR : plan.priceUSD;
              const billingLabel = currency === 'INR' ? plan.billingLabelINR : plan.billingLabelUSD;
              const symbol = currency === 'INR' ? '₹' : '$';

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl sm:rounded-3xl p-8 sm:p-10 lg:p-9 xl:p-11 flex flex-col justify-between transition-all duration-300 ${
                    plan.popular
                      ? 'bg-[#111114] border border-zinc-700/80 shadow-[0_0_50px_rgba(255,255,255,0.05)]'
                      : 'bg-[#0c0c0e] border border-white/[0.08]'
                  }`}
                >
                  <div>
                    {/* Top Header: Title & Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-2xl font-semibold text-white tracking-tight">
                        {plan.name}
                      </h3>
                      {plan.badge && (
                        <span className="rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-mono px-3 py-1">
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    {/* Tagline */}
                    <p className="text-zinc-400 text-[14px] leading-relaxed min-h-[44px] mb-7">
                      {plan.tagline}
                    </p>

                    {/* Price in Spectral Serif */}
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className="text-3xl font-light text-zinc-400 font-['Spectral',serif]">
                        {symbol}
                      </span>
                      <span className="font-['Spectral',serif] text-5xl sm:text-6xl xl:text-[64px] font-light text-white tracking-tight leading-none">
                        {price.toLocaleString()}
                      </span>
                    </div>

                    {/* Sub-line under Price (Exact Lateral uppercase font-mono) */}
                    <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400 pb-7 border-b border-white/[0.08]">
                      {billingLabel}
                    </div>

                    {/* Features Group 1 */}
                    <div className="mt-7">
                      <div className="text-[13px] font-medium text-white mb-3.5 tracking-wide">
                        {plan.group1Title}
                      </div>
                      <div className="space-y-3">
                        {plan.group1Features.map((feat) => (
                          <div key={feat} className="flex items-start gap-3 text-[14px] text-zinc-200">
                            <svg className="w-4 h-4 text-zinc-400 mt-1 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                            <span className="leading-snug">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Features Group 2 */}
                    <div className="mt-7 mb-9">
                      <div className="text-[13px] font-medium text-white mb-3.5 tracking-wide">
                        {plan.group2Title}
                      </div>
                      <div className="space-y-3">
                        {plan.group2Features.map((feat) => (
                          <div key={feat} className="flex items-start gap-3 text-[14px] text-zinc-200">
                            <svg className="w-4 h-4 text-zinc-400 mt-1 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                            <span className="leading-snug">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Single Clean White / Dark Pill Button */}
                  <div className="pt-5 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => handlePlanClick(plan)}
                      disabled={activeCheckoutPlanId === plan.id}
                      className={`inline-flex w-full items-center justify-center rounded-full py-3.5 px-6 text-sm sm:text-base font-medium transition-all duration-200 active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:cursor-wait ${
                        plan.popular || plan.id === 'ultimate'
                          ? 'bg-white text-black hover:bg-zinc-200'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-700/80'
                      }`}
                    >
                      {activeCheckoutPlanId === plan.id
                        ? 'Redirecting to Checkout...'
                        : currency === 'INR'
                          ? (isYoupiEnabled
                              ? 'Pay Now (Instant UPI)'
                              : `Pay with UPI (${symbol}${price.toLocaleString()})`)
                          : (isStripeEnabled
                              ? `Pay with Card (${symbol}${price})`
                              : isUsdtEnabled
                                ? `Pay with USDT (${symbol}${price})`
                                : `Pay with Card (${symbol}${price})`)}
                    </button>
                    {currency === 'INR' && !isYoupiEnabled && (
                      <p className="text-[11px] text-zinc-500 font-mono text-center mt-2.5">
                        Instant checkout is being activated. Manual UPI is available now.
                      </p>
                    )}
                    {currency === 'USD' && (
                      <div className="mt-2.5 text-center space-y-1">
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {isStripeEnabled
                            ? 'Secure international Stripe checkout • Instant activation'
                            : isUsdtEnabled
                              ? `Zero-fee USDT (${usdtNetwork}) transfer • Verified activation`
                              : 'Secure international USD checkout'}
                        </p>
                        {isStripeEnabled && isUsdtEnabled && usdtAddress && (
                          <button
                            type="button"
                            onClick={() => openCryptoModal(plan)}
                            className="text-[11px] text-zinc-300 hover:text-white underline font-mono"
                          >
                            Or pay with USDT (TRC-20) →
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* CLIENT / PLATFORM LOGOS TICKER                                            */}
          {/* ========================================================================= */}
          <div className="w-full mt-16 sm:mt-24 pt-8 border-t border-white/10">
            <div className="flex items-center justify-between gap-6 sm:gap-8 md:gap-10 overflow-x-auto no-scrollbar py-2">
              {PLATFORM_LOGOS.map((logo) => (
                <div key={logo.name} className="flex-shrink-0 flex items-center justify-center group" title={logo.name}>
                  <Image
                    src={logo.src}
                    alt={logo.name}
                    width={120}
                    height={24}
                    className={`${logo.h} w-auto max-w-[120px] object-contain invert brightness-0 opacity-50 group-hover:opacity-100 transition-opacity duration-200`}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. COMPARE PLANS SECTION (EXACT LATERAL LIGHT THEME #f9f9f9)              */}
      {/* ========================================================================= */}
      <section className="w-full py-20 bg-[#f9f9f9] text-[#080808]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#080808] inline-block"></span>
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-[#080808]">
                PLANS
              </span>
            </div>
            <h2 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[56px] font-light tracking-[-0.02em] leading-tight text-[#080808] mb-4">
              Compare Plans
            </h2>
            <p className="text-[#555555] text-sm sm:text-base leading-relaxed">
              All MAHI plans include full C++ dual-engine stealth. Choose the quota that fits your operational scale.
            </p>
          </div>

          {/* Comparison Table Container */}
          <div className="w-full overflow-x-auto no-scrollbar">
            <div className="min-w-[760px] w-full">
              
              {/* Sticky Table Header with Plan Names and CTAs */}
              <div className="grid grid-cols-4 pb-6 border-b border-[#e6e3e3] items-end">
                <div className="text-[13px] font-mono text-[#888888] uppercase tracking-wider">
                  Features
                </div>
                {PRICING_PLANS.map((plan) => {
                  const price = currency === 'INR' ? plan.priceINR : plan.priceUSD;
                  const symbol = currency === 'INR' ? '₹' : '$';

                  return (
                    <div key={plan.id} className="text-center px-4 space-y-3">
                      <div className="text-lg font-semibold text-[#080808]">
                        {plan.name}
                      </div>
                      <div className="text-xs text-[#666666] font-mono">
                        {symbol}{price.toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlanClick(plan)}
                        className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-medium transition-colors shadow-sm ${
                          plan.popular || plan.id === 'ultimate'
                            ? 'bg-[#080808] text-white hover:bg-zinc-800'
                            : 'bg-zinc-200 text-[#080808] hover:bg-zinc-300'
                        }`}
                      >
                        {currency === 'INR'
                          ? (isYoupiEnabled ? 'Pay Now (Instant UPI)' : 'Pay with UPI')
                          : (isStripeEnabled ? 'Get Started' : isUsdtEnabled ? 'Pay with USDT' : 'Get Started')}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Categorized Rows */}
              {COMPARISON_CATEGORIES.map((cat) => (
                <div key={cat.name} className="pt-8">
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#888888] font-semibold mb-4">
                    {cat.name}
                  </div>
                  <div className="divide-y divide-[#eceae7]">
                    {cat.features.map((feat) => (
                      <div key={feat.name} className="grid grid-cols-4 py-3.5 items-center text-sm">
                        <div className="text-[#333333] font-normal pr-4">
                          {feat.name}
                        </div>

                        {/* Starter Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.starter === 'boolean' ? (
                            feat.starter ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs">{feat.starter}</span>
                          )}
                        </div>

                        {/* Growth Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.growth === 'boolean' ? (
                            feat.growth ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-medium text-black">{feat.growth}</span>
                          )}
                        </div>

                        {/* Ultimate Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.ultimate === 'boolean' ? (
                            feat.ultimate ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-semibold text-black">{feat.ultimate}</span>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              ))}

            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. TESTIMONIAL BENTO CARD (EXACT LATERAL #e5e5e3 WARM GREY CARD)           */}
      {/* ========================================================================= */}
      <section className="w-full py-12 lg:py-16 bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="rounded-2xl sm:rounded-3xl bg-[#e5e5e3] overflow-hidden shadow-sm flex flex-col lg:flex-row items-stretch">
            
            {/* Left Photo Column */}
            <div className="lg:w-[45%] relative min-h-[300px] sm:min-h-[380px] lg:min-h-full overflow-hidden bg-zinc-200">
              <Image
                src="/assets/customers/lattice_case.jpg"
                alt="Executive Customer Case Study"
                fill
                className="object-cover object-center block"
              />
            </div>

            {/* Right Quote & Stats Column */}
            <div className="flex-1 p-8 sm:p-12 lg:p-16 flex flex-col justify-between text-[#080808]">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-xs font-mono font-semibold uppercase tracking-widest text-[#555555]">
                    Westbridge Media Fleets
                  </span>
                </div>

                <blockquote className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[32px] font-normal leading-[1.25] tracking-tight mb-8">
                  “MAHI Browser has been transformational. We scaled 450+ ad accounts with a 99.8% survival rate, completely eliminating CDP detection flags and saving $180,000 annually versus GoLogin seat fees.”
                </blockquote>

                <div className="text-xs font-mono uppercase tracking-widest text-[#777777] mb-8">
                  Marcus Vance • <span className="text-[#333333]">Head of Media Operations</span>
                </div>
              </div>

              {/* 3 Key Stats with Vertical Dividers */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[rgba(0,0,0,0.12)]">
                <div>
                  <div className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-[#080808]">
                    $180K
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-1">
                    Cost Savings
                  </div>
                </div>

                <div className="border-l border-[rgba(0,0,0,0.14)] pl-4">
                  <div className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-[#080808]">
                    99.8%
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-1">
                    Fleet Survival
                  </div>
                </div>

                <div className="border-l border-[rgba(0,0,0,0.14)] pl-4">
                  <div className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-[#080808]">
                    10x
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-1">
                    ROI
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. FAQ SECTION                                                            */}
      {/* ========================================================================= */}
      <section className="w-full py-20 bg-[#f9f9f9] text-[#080808]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* Left Header Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#080808] inline-block"></span>
                <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-[#080808]">
                  FAQ
                </span>
              </div>
              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[46px] font-light tracking-tight leading-[1.1] text-[#080808]">
                Your Questions<br />Answered
              </h2>
              <p className="text-sm text-[#555555] leading-relaxed max-w-md pt-2 pb-4">
                MAHI Browser eliminates cloud lock-in and international FX fees with local-first air-gapped stealth and instant UPI payments.
              </p>
              <div>
                <Link
                  href="/download?auto=true"
                  onClick={() => trackFunnel('download_started', { source: 'pricing_faq' })}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#080808] text-white px-6 py-2.5 text-xs sm:text-[13px] font-medium hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Free (15 Profiles)
                </Link>
              </div>
            </div>

            {/* Right Accordion Column */}
            <div className="lg:col-span-7 divide-y divide-[#e6e3e3] border-y border-[#e6e3e3]">
              {getPricingFaqs(upiId).map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={faq.question} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between text-left py-2 group"
                      aria-expanded={isOpen}
                    >
                      <span className="text-[15px] sm:text-[16px] font-medium text-[#080808] group-hover:text-zinc-600 transition-colors pr-6">
                        {faq.question}
                      </span>
                      <span className="text-xl font-light text-[#888888] flex-shrink-0">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="pt-2 pb-3 text-sm text-[#555555] leading-relaxed animate-fadeIn">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. PRE-FOOTER CTA CARD                                                    */}
      {/* ========================================================================= */}
      <section className="w-full py-16 bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="relative rounded-2xl border border-black/10 bg-[#080808] text-white p-10 sm:p-16 text-center overflow-hidden shadow-2xl">
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
                  GET STARTED
                </span>
              </div>

              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-5xl font-normal text-white tracking-tight leading-tight">
                See Why Top Growth Fleets<br />
                <span className="italic text-zinc-400 font-light">Use MAHI Browser</span>
              </h2>

              <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
                Download MAHI Browser now to experience undetected dual-engine stealth with 15 free profiles.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/download?auto=true"
                  onClick={() => trackFunnel('download_started', { source: 'pricing_prefooter' })}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-7 py-3 text-xs sm:text-[13px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-lg shadow-white/5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Free (15 Profiles)
                </Link>
                <Link
                  href="/compare"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-xs sm:text-[13px] font-medium text-zinc-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
                >
                  Compare vs GoLogin &rarr;
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. INTERACTIVE INDIAN UPI PAYMENT MODAL (0% GATEWAY FEE)                   */}
      {/* ========================================================================= */}
      {isUpiModalOpen && selectedUpiPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-[#0c0c0e] border border-white/10 p-6 sm:p-8 text-white shadow-2xl space-y-5">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsUpiModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
                <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
                  INSTANT UPI ACTIVATION • 0% GATEWAY FEE
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-['Spectral',serif] font-normal text-white">
                {selectedUpiPlan.name} Plan Activation
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Amount: <strong className="text-white text-sm">₹{selectedUpiPlan.price.toLocaleString()}</strong> ({selectedUpiPlan.billingLabel})
              </p>
              {!isYoupiEnabled && (
                <p className="text-[11px] text-zinc-400 font-mono mt-2">
                  Instant checkout is being activated. Manual UPI is available now.
                </p>
              )}
            </div>

            {/* UPI QR Code Container */}
            <div className="rounded-2xl bg-white p-4 flex flex-col items-center justify-center space-y-2">
              <Image
                src={upiQrAsset}
                alt="MAHI Browser UPI QR Code"
                width={192}
                height={192}
                className="w-48 h-48 object-contain rounded-lg"
              />
              <div className="text-[11px] font-mono text-zinc-600 text-center font-medium">
                Scan with PhonePe, GPay, Paytm, CRED or BHIM
              </div>
            </div>

            {/* Merchant Details & Copy VPA */}
            <div className="space-y-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 p-3.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Account Holder:</span>
                <span className="font-semibold text-white">{upiAccountHolder}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-zinc-800">
                <span>Official Merchant VPA:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                    {upiId}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-white transition-colors"
                  >
                    {copiedUpi ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* UTR Submission Form */}
            {!utrSubmitted ? (
              <form onSubmit={handleUtrSubmit} className="space-y-3">
                {!hasAuthToken && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
                    <span>Sign in first so we can activate this payment on your account.</span>
                    <a
                      href={`/login?redirect=${encodeURIComponent(`/pricing?plan=${selectedUpiPlan.id}&currency=INR&openUpi=1`)}&plan=${encodeURIComponent(selectedUpiPlan.id)}&currency=INR`}
                      className="shrink-0 underline font-semibold text-white hover:text-amber-100"
                    >
                      Sign In
                    </a>
                  </div>
                )}
                {utrError && (
                  <div className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-[#e6e3e3]">
                    {utrError}
                  </div>
                )}
                <div>
                  <label htmlFor="utr-input" className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Enter UTR / Transaction Reference No. (6-30 alphanumeric)
                  </label>
                  <input
                    id="utr-input"
                    type="text"
                    required
                    placeholder="e.g. 412345678901"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    className="w-full rounded-xl bg-black border border-zinc-700 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingUtr}
                  className="w-full rounded-full bg-white text-black py-2.5 text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingUtr ? 'Submitting…' : 'Verify Payment & Submit'}
                </button>
              </form>
            ) : (
              <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 text-center space-y-2">
                <div className="text-white font-semibold text-sm">
                  Payment Reference Recorded
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your UTR <code className="text-white font-mono">{utrInput}</code> for ₹{selectedUpiPlan.price.toLocaleString()} has been submitted for verification.
                  Your license will be activated after manual verification (usually within 24 hours).
                  {submittedPaymentId && (
                    <span className="block mt-1 font-mono text-[11px] text-zinc-400">
                      Keep this reference: <code className="text-white font-semibold">{submittedPaymentId}</code>
                    </span>
                  )}
                </p>
                <div className="pt-2">
                  <a
                    href={`https://wa.me/${whatsappRawNumber}?text=Hi%20${encodeURIComponent(sellerName.split(' ')[0])},%20I%20have%20paid%20INR%20${selectedUpiPlan.price}%20via%20UPI%20for%20MAHI%20Browser%20${encodeURIComponent(selectedUpiPlan.name)}%20Plan.%20UTR:%20${encodeURIComponent(utrInput)}${submittedPaymentId ? `%20Ref:%20${encodeURIComponent(submittedPaymentId)}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover:bg-zinc-200 transition-colors"
                  >
                    Confirm on WhatsApp
                  </a>
                </div>
              </div>
            )}

            {/* Direct WhatsApp Instant Help */}
            <div className="text-center text-[11px] text-zinc-500 pt-1">
              Need instant activation help?{' '}
              <a
                href={`https://wa.me/${whatsappRawNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 hover:text-white underline"
              >
                Chat with Founder on WhatsApp
              </a>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CRYPTO USDT (TRC-20) PAYMENT MODAL                                     */}
      {/* ========================================================================= */}
      {isCryptoModalOpen && selectedCryptoPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0a0a0c] border border-zinc-800 p-6 sm:p-7 text-left shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsCryptoModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400 mb-1">
                USDT Crypto Checkout • {usdtNetwork}
              </div>
              <h3 className="font-['Spectral',serif] text-2xl font-light text-white">
                {selectedCryptoPlan.name} — ${selectedCryptoPlan.price.toLocaleString()} USDT
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {selectedCryptoPlan.billingLabel}
              </p>
              <p className="text-[11px] text-amber-300/90 font-mono mt-2">
                Send ONLY USDT via TRON (TRC-20) network to this address.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 flex flex-col items-center justify-center space-y-2">
              <Image
                src={usdtQrAsset}
                alt="MAHI Browser USDT TRC-20 QR Code"
                width={192}
                height={192}
                className="w-48 h-48 object-contain rounded-lg"
              />
              <div className="text-[11px] font-mono text-zinc-600 text-center font-medium">
                Scan with TronLink, Trust Wallet, Binance, Bybit or OKX
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 p-3.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Network:</span>
                <span className="font-semibold text-emerald-400">{usdtNetwork}</span>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-zinc-800">
                <span className="text-zinc-400 block">TRC-20 Wallet Address:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[11px] text-zinc-200 bg-zinc-800 px-2.5 py-1.5 rounded border border-zinc-700 break-all flex-1">
                    {usdtAddress}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCrypto}
                    className="shrink-0 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-white transition-colors"
                  >
                    {copiedCrypto ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {!txSubmitted ? (
              <form onSubmit={handleCryptoSubmit} className="space-y-3">
                {!hasAuthToken && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
                    <span>Sign in first so we can activate this payment on your account.</span>
                    <a
                      href={`/login?redirect=${encodeURIComponent(`/pricing?plan=${selectedCryptoPlan.id}&currency=USD&openCrypto=1`)}&plan=${encodeURIComponent(selectedCryptoPlan.id)}&currency=USD`}
                      className="shrink-0 underline font-semibold text-white hover:text-amber-100"
                    >
                      Sign In
                    </a>
                  </div>
                )}
                {txError && (
                  <div className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-[#e6e3e3]">
                    {txError}
                  </div>
                )}
                <div>
                  <label htmlFor="txhash-input" className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Enter TRON (TRC-20) Transaction Hash (64 characters)
                  </label>
                  <input
                    id="txhash-input"
                    type="text"
                    required
                    maxLength={64}
                    placeholder="Paste 64-character TRC-20 transaction hash"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    className="w-full rounded-xl bg-black border border-zinc-700 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingTx}
                  className="w-full rounded-full bg-white text-black py-2.5 text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingTx ? 'Submitting TX…' : 'Verify USDT TX & Submit'}
                </button>
              </form>
            ) : (
              <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 text-center space-y-2">
                <div className="text-white font-semibold text-sm">
                  USDT Transaction Recorded
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your TRC-20 TX <code className="text-white font-mono break-all">{txHashInput}</code> for ${selectedCryptoPlan.price.toLocaleString()} USDT has been submitted for verification.
                  {submittedCryptoPaymentId && (
                    <span className="block mt-1 font-mono text-[11px] text-zinc-400">
                      Reference: <code className="text-white font-semibold">{submittedCryptoPaymentId}</code>
                    </span>
                  )}
                </p>
                <div className="pt-2">
                  <a
                    href={`https://wa.me/${whatsappRawNumber}?text=Hi%20${encodeURIComponent(sellerName.split(' ')[0])},%20I%20have%20paid%20${selectedCryptoPlan.price}%20USDT%20(TRC-20)%20for%20MAHI%20Browser%20${encodeURIComponent(selectedCryptoPlan.name)}%20Plan.%20TX:%20${encodeURIComponent(txHashInput)}${submittedCryptoPaymentId ? `%20Ref:%20${encodeURIComponent(submittedCryptoPaymentId)}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover:bg-zinc-200 transition-colors"
                  >
                    Confirm on WhatsApp
                  </a>
                </div>
              </div>
            )}

            <div className="text-center text-[11px] text-zinc-500 pt-1">
              Need instant activation help?{' '}
              <a
                href={`https://wa.me/${whatsappRawNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 hover:text-white underline"
              >
                Chat with Founder on WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
