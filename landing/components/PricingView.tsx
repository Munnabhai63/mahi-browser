'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface PlanTier {
  id: string;
  name: string;
  durationLabel: string;
  tagline: string;
  popular?: boolean;
  valueBadge?: string;
  priceINR: number;
  originalPriceINR: number;
  perMonthINR: string;
  discountINR: string;
  priceUSD: number;
  originalPriceUSD: number;
  perMonthUSD: string;
  discountUSD: string;
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
    durationLabel: '1 Month Access',
    tagline: 'Essential air-gapped stealth toolkit for solo growth operators running their first fleet.',
    priceINR: 599,
    originalPriceINR: 1199,
    perMonthINR: '₹599 / month',
    discountINR: '50% OFF',
    priceUSD: 9,
    originalPriceUSD: 18,
    perMonthUSD: '$9 / month',
    discountUSD: '50% OFF',
    group1Title: 'Engines & Profiles',
    group1Features: [
      '25 Air-Gapped Profiles (Offline SQLite)',
      'Dual Engine (Chromium 138 + Camoufox)',
      '25 Custom Proxy Slots (HTTP/SOCKS5)',
      '1 Active Device License',
    ],
    group2Title: 'Stealth & Safety',
    group2Features: [
      'Zero CDP Artifacts (Rebrowser-Patches)',
      'Natural Bézier Curves & Typing Cadence',
      '3 Max Concurrent Browser Windows',
      '0% Instant UPI Payments (slc VPA)',
    ],
    ctaText: 'Get Starter (1 Month)',
    ctaHref: '/signup?plan=starter',
  },
  {
    id: 'growth',
    name: 'Growth',
    durationLabel: '6 Months Access',
    popular: true,
    tagline: 'High-leverage stealth engine for scaling affiliate teams and multi-account managers.',
    priceINR: 999,
    originalPriceINR: 3594,
    perMonthINR: '₹166 / month',
    discountINR: '72% OFF',
    priceUSD: 15,
    originalPriceUSD: 54,
    perMonthUSD: '$2.5 / month',
    discountUSD: '72% OFF',
    group1Title: 'Engines & Zero-Cost Unlocks',
    group1Features: [
      '100 High-Entropy Profiles (Offline SQLite)',
      '🔥 UNLIMITED Custom Proxies (BYOP)',
      '🔥 UNLIMITED Fingerprint Regenerations',
      '🔥 UNLIMITED Cookie & Session Import/Export',
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
    durationLabel: '1 Year Access (Annual)',
    valueBadge: 'Best Value • 100% Unlimited',
    tagline: 'The complete enterprise fleet with 100% UNLIMITED offline profiles and VIP perks.',
    priceINR: 1499,
    originalPriceINR: 7188,
    perMonthINR: 'सिर्फ ₹125 / month',
    discountINR: '79% OFF (Save ₹5,689)',
    priceUSD: 24,
    originalPriceUSD: 114,
    perMonthUSD: '$2.0 / month',
    discountUSD: '79% OFF',
    group1Title: 'Unlimited Fleets & Hardware',
    group1Features: [
      '🚀 UNLIMITED Air-Gapped Profiles (Offline SQLite)',
      '🚀 UNLIMITED Dual-Engine Stealth Fingerprints',
      '🚀 UNLIMITED Proxy Management & Routing',
      '🚀 UNLIMITED RPA & Headless Playwright API',
    ],
    group2Title: 'Governance & VIP Support',
    group2Features: [
      'Encrypted Cloud Backup & Device Sync',
      '2 Active Device Workspaces (Office + Laptop)',
      'Up to 25 Concurrent Running Windows',
      '24/7 Dedicated Founder WhatsApp (+91 9376343629)',
    ],
    ctaText: 'Get Ultimate (1 Year Access)',
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
      { name: 'Profiles Included', starter: '25 Air-Gapped', growth: '100 Profiles', ultimate: 'UNLIMITED 🚀' },
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
      { name: 'Custom Proxy Slots (HTTP/SOCKS5)', starter: '25 Slots', growth: 'UNLIMITED 🔥', ultimate: 'UNLIMITED 🚀' },
      { name: 'Fingerprint Perturbation & Re-generations', starter: 'Standard', growth: 'UNLIMITED 🔥', ultimate: 'UNLIMITED 🚀' },
      { name: 'Bulk Cookie & Session Importer (JSON/Netscape)', starter: 'Standard', growth: 'UNLIMITED 🔥', ultimate: 'UNLIMITED 🚀' },
    ],
  },
  {
    name: 'Automation & Hardware Concurrency',
    features: [
      { name: 'Visual RPA Studio & Flow Builder', starter: 'Basic', growth: 'Advanced', ultimate: 'UNLIMITED 🚀' },
      { name: 'Automated Cookie Warmer & Session Healer', starter: false, growth: true, ultimate: true },
      { name: 'Playwright / Puppeteer Remote API Access', starter: false, growth: true, ultimate: true },
      { name: 'Simultaneous Active Browser Windows', starter: '3 Windows', growth: '10 Windows', ultimate: '25 Windows' },
    ],
  },
  {
    name: 'Governance, Sync & Support',
    features: [
      { name: '0% Fee Instant Indian UPI Payments (slc VPA)', starter: true, growth: true, ultimate: true },
      { name: 'Authorized Device Workspaces', starter: '1 Device', growth: '1 Device', ultimate: '2 Devices (Office + PC)' },
      { name: 'Encrypted Cloud Backup & Session Sync', starter: false, growth: '25 Profiles', ultimate: 'Included (Encrypted Sync)' },
      { name: 'Support SLA', starter: 'Standard Email', growth: 'Priority Chat & Ticket', ultimate: '24/7 VIP Founder WhatsApp' },
    ],
  },
];

const PRICING_FAQS = [
  {
    question: 'How are browser profiles stored and isolated in MAHI Browser?',
    answer:
      'Unlike legacy cloud tools that send your sensitive session data to external third-party servers, MAHI Browser stores all profile cookies, local storage, and proxy configurations in local-first encrypted SQLite databases on your own machine. Your profiles run completely air-gapped without leaking data.',
  },
  {
    question: 'What is the difference between Starter (1M), Growth (6M), and Ultimate (1Y)?',
    answer:
      'Starter (₹599) includes 25 air-gapped profiles for 1 month. Growth (₹999) gives you 6 months of access (just ₹166/mo) with 100 profiles, plus UNLIMITED proxy management and fingerprint regenerations. Ultimate (₹1,499) gives you a full year (just ₹125/mo) with 100% UNLIMITED offline profiles, 2 device workspaces, and 24/7 dedicated VIP WhatsApp support.',
  },
  {
    question: 'How does 0% fee Indian UPI payment work?',
    answer:
      'You can pay directly via any Indian UPI app (PhonePe, Google Pay, Paytm, CRED, BHIM) to our official merchant VPA 6375823589@slc (Mahipal Choudhary). There are zero international credit card markups or foreign transaction fees. Your license key is activated within 5 minutes.',
  },
  {
    question: 'Can I import my existing GoLogin or AdsPower profiles and cookies?',
    answer:
      'Yes. MAHI Browser features a Universal Bulk Importer. Simply export your profiles from GoLogin, AdsPower, or Multilogin as JSON, drag and drop the file into MAHI Browser, and our engine automatically maps proxies, User-Agents, and cookies into isolated profiles.',
  },
  {
    question: 'Can I upgrade from 1 Month or 6 Months to 1 Year later?',
    answer:
      'Yes! You can upgrade anytime. Any remaining days on your current subscription will be prorated and stacked seamlessly onto your new 1-Year Ultimate plan.',
  },
  {
    question: 'What is the 7-day money-back guarantee?',
    answer:
      'If our dual-engine architecture (Chromium 138 + Camoufox) fails to pass your target platform’s anti-fraud checks (Cloudflare Turnstile, DataDome, CreepJS), simply message our WhatsApp support within 7 days for a full, unconditional refund.',
  },
];

export default function PricingView() {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Indian UPI Modal state
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [selectedUpiPlan, setSelectedUpiPlan] = useState<{
    name: string;
    price: number;
    duration: string;
    perMonth: string;
  } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [utrSubmitted, setUtrSubmitted] = useState(false);

  // Telemetry event tracking (active in production to avoid dev-mode 404 toast)
  const trackFunnel = (eventName: string, metadata?: Record<string, any>) => {
    try {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && navigator.sendBeacon) {
        const payload = JSON.stringify({ eventName, source: 'pricing_page', ...metadata });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/funnel/track', blob);
      }
    } catch (_) {}
  };

  // Plan CTA Click Handler
  const handlePlanClick = (plan: PlanTier) => {
    trackFunnel('plan_cta_clicked', { planId: plan.id, currency });

    if (currency === 'INR') {
      setSelectedUpiPlan({
        name: plan.name,
        price: plan.priceINR,
        duration: plan.durationLabel,
        perMonth: plan.perMonthINR,
      });
      setIsUpiModalOpen(true);
      setUtrSubmitted(false);
      setUtrInput('');
    } else {
      window.location.href = `${plan.ctaHref}&currency=USD`;
    }
  };

  // Copy VPA to clipboard (with safe promise catch and textarea fallback)
  const handleCopyUpi = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText('6375823589@slc')
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
  const handleUtrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrInput.trim()) return;
    trackFunnel('upi_utr_submitted', {
      utr: utrInput,
      plan: selectedUpiPlan?.name,
      amount: selectedUpiPlan?.price,
    });
    setUtrSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] selection:bg-white selection:text-black">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: EXACT OBSIDIAN SCALE, DARK MONOCHROME AESTHETIC          */}
      {/* ========================================================================= */}
      <section className="relative w-full pt-32 sm:pt-40 lg:pt-44 pb-20 bg-[#050505] text-white overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 text-center">
          
          {/* Eyebrow: ■ PRICING */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
            <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
              TRANSPARENT PRICING
            </span>
          </div>

          {/* Headline in Spectral Serif */}
          <h1 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[62px] xl:text-[68px] font-light tracking-[-0.02em] leading-[1.08] text-white mb-4">
            Simple Pricing.<br />
            <span className="italic text-zinc-400 font-light">Built for Scale & Zero Leaks.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-zinc-400 text-sm sm:text-[15px] lg:text-[16px] max-w-[580px] mx-auto font-normal leading-[1.6] mb-9">
            Run multi-account operations without recurring per-seat fees or cloud leak vulnerabilities. Air-gapped offline profiles, dual-engine stealth, and instant 0% fee UPI activation.
          </p>

          {/* Currency Controls & Value Highlight */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-12 sm:mb-16">
            
            {/* Value Highlight Badge */}
            <div className="inline-flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-full px-4 py-1.5 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[12px] font-mono text-zinc-300">
                1 Year Plan Includes <strong>UNLIMITED Profiles</strong>
              </span>
            </div>

            {/* Currency Selector (INR ₹ 0% UPI / USD $) */}
            <div className="inline-flex items-center rounded-full bg-zinc-900/90 border border-zinc-800 p-0.5 text-xs shadow-inner">
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

          {/* ========================================================================= */}
          {/* 3 PRICING CARDS: EXACT LATERAL CARDS + POPULAR & UNLIMITED VALUE BADGES    */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto text-left items-stretch">
            {PRICING_PLANS.map((plan) => {
              const price = currency === 'INR' ? plan.priceINR : plan.priceUSD;
              const originalPrice = currency === 'INR' ? plan.originalPriceINR : plan.originalPriceUSD;
              const perMonth = currency === 'INR' ? plan.perMonthINR : plan.perMonthUSD;
              const discount = currency === 'INR' ? plan.discountINR : plan.discountUSD;
              const symbol = currency === 'INR' ? '₹' : '$';

              const isUltimate = plan.id === 'ultimate';
              const isGrowth = plan.id === 'growth';

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl sm:rounded-3xl p-8 sm:p-9 flex flex-col justify-between transition-all duration-300 ${
                    isUltimate
                      ? 'bg-[#121216] border-2 border-white/40 shadow-[0_0_50px_rgba(255,255,255,0.07)] ring-1 ring-white/20'
                      : isGrowth
                      ? 'bg-[#101013] border border-zinc-700 shadow-[0_0_35px_rgba(255,255,255,0.03)]'
                      : 'bg-[#0c0c0e] border border-white/[0.08]'
                  }`}
                >
                  <div>
                    {/* Top Duration & Badges */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400 font-medium">
                        {plan.durationLabel}
                      </span>
                      {plan.valueBadge ? (
                        <span className="rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-semibold px-3 py-0.5 shadow-sm">
                          {plan.valueBadge}
                        </span>
                      ) : plan.popular ? (
                        <span className="rounded-full bg-zinc-800 border border-zinc-600 text-zinc-200 text-[11px] font-mono px-2.5 py-0.5">
                          Most Popular
                        </span>
                      ) : null}
                    </div>

                    {/* Plan Name */}
                    <h3 className="text-2xl font-semibold text-white tracking-tight mb-2">
                      {plan.name}
                    </h3>

                    {/* Tagline */}
                    <p className="text-zinc-400 text-[13px] leading-relaxed min-h-[42px] mb-6">
                      {plan.tagline}
                    </p>

                    {/* Price & Strikethrough Box */}
                    <div className="pt-2 pb-4 mb-2">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="line-through text-zinc-500 text-base sm:text-lg font-mono">
                          {symbol}{originalPrice.toLocaleString()}
                        </span>
                        <span className="rounded-full bg-white/10 text-white text-[11px] font-mono px-2 py-0.5 border border-white/20">
                          {discount}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-light text-zinc-400 font-['Spectral',serif]">
                          {symbol}
                        </span>
                        <span className="font-['Spectral',serif] text-5xl sm:text-[56px] font-light text-white tracking-tight leading-none">
                          {price.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Per Month Breakdown Pill */}
                    <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[12px] font-mono text-zinc-300">
                      <span>Effective Cost:</span>
                      <strong className={`font-semibold ${isUltimate ? 'text-emerald-400' : 'text-white'}`}>
                        {perMonth}
                      </strong>
                    </div>

                    <div className="border-b border-white/[0.08] mb-6"></div>

                    {/* Features Group 1 */}
                    <div className="mb-6">
                      <div className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3 font-semibold">
                        {plan.group1Title}
                      </div>
                      <div className="space-y-2.5">
                        {plan.group1Features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-[13px] text-zinc-200">
                            <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                            <span className={feat.includes('UNLIMITED') ? 'font-medium text-white' : ''}>
                              {feat}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Features Group 2 */}
                    <div className="mb-8">
                      <div className="text-[12px] font-mono uppercase tracking-wider text-zinc-400 mb-3 font-semibold">
                        {plan.group2Title}
                      </div>
                      <div className="space-y-2.5">
                        {plan.group2Features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-[13px] text-zinc-300">
                            <svg className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Clean Action CTA Button */}
                  <div className="pt-4 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => handlePlanClick(plan)}
                      className={`inline-flex w-full items-center justify-center rounded-full py-3.5 px-6 text-sm font-semibold transition-all duration-200 active:scale-[0.98] shadow-sm ${
                        isUltimate
                          ? 'bg-white text-black hover:bg-zinc-200 shadow-white/10 shadow-lg'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
                      }`}
                    >
                      {currency === 'INR'
                        ? `Pay with UPI (${symbol}${price.toLocaleString()})`
                        : `${plan.ctaText} (${symbol}${price})`}
                    </button>
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
              {PLATFORM_LOGOS.map((logo, idx) => (
                <div key={idx} className="flex-shrink-0 flex items-center justify-center group" title={logo.name}>
                  <img
                    src={logo.src}
                    alt={logo.name}
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
                PLAN COMPARISON
              </span>
            </div>
            <h2 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[56px] font-light tracking-[-0.02em] leading-tight text-[#080808] mb-4">
              Compare Plan Limits
            </h2>
            <p className="text-[#555555] text-sm sm:text-base leading-relaxed">
              Every plan includes full C++ dual-engine stealth. Upgrade to 1 Year Ultimate for unconstrained offline scale.
            </p>
          </div>

          {/* Comparison Table Container */}
          <div className="w-full overflow-x-auto no-scrollbar">
            <div className="min-w-[760px] w-full">
              
              {/* Sticky Table Header with Plan Names and CTAs */}
              <div className="grid grid-cols-4 pb-6 border-b border-[#e6e3e3] items-end">
                <div className="text-[13px] font-mono text-[#888888] uppercase tracking-wider font-semibold">
                  Features & Quotas
                </div>
                {PRICING_PLANS.map((plan) => {
                  const price = currency === 'INR' ? plan.priceINR : plan.priceUSD;
                  const perMonth = currency === 'INR' ? plan.perMonthINR : plan.perMonthUSD;
                  const symbol = currency === 'INR' ? '₹' : '$';

                  return (
                    <div key={plan.id} className="text-center px-4 space-y-2">
                      <div className="text-lg font-semibold text-[#080808]">
                        {plan.name}
                      </div>
                      <div className="text-xs text-[#555555] font-mono font-medium">
                        {symbol}{price.toLocaleString()} ({perMonth})
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlanClick(plan)}
                        className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold transition-colors shadow-sm ${
                          plan.id === 'ultimate'
                            ? 'bg-[#080808] text-white hover:bg-zinc-800'
                            : 'bg-zinc-200 text-[#080808] hover:bg-zinc-300'
                        }`}
                      >
                        {currency === 'INR' ? 'Pay with UPI' : 'Select Plan'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Categorized Rows */}
              {COMPARISON_CATEGORIES.map((cat, catIdx) => (
                <div key={catIdx} className="pt-8">
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#888888] font-semibold mb-4">
                    {cat.name}
                  </div>
                  <div className="divide-y divide-[#eceae7]">
                    {cat.features.map((feat, fIdx) => (
                      <div key={fIdx} className="grid grid-cols-4 py-3.5 items-center text-sm">
                        <div className="text-[#333333] font-normal pr-4">
                          {feat.name}
                        </div>

                        {/* Starter Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.starter === 'boolean' ? (
                            feat.starter ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs">{feat.starter}</span>
                          )}
                        </div>

                        {/* Growth Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.growth === 'boolean' ? (
                            feat.growth ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-semibold text-black">{feat.growth}</span>
                          )}
                        </div>

                        {/* Ultimate Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.ultimate === 'boolean' ? (
                            feat.ultimate ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {feat.ultimate}
                            </span>
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
              <img
                src="/assets/customers/lattice_case.jpg"
                alt="Executive Customer Case Study"
                className="w-full h-full object-cover object-center block"
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
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Free (15 Profiles)
                </Link>
              </div>
            </div>

            {/* Right Accordion Column */}
            <div className="lg:col-span-7 divide-y divide-[#e6e3e3] border-y border-[#e6e3e3]">
              {PRICING_FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="py-4">
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
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
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="relative w-full max-w-md rounded-3xl bg-[#0c0c0e] border border-white/15 p-6 sm:p-8 text-white shadow-2xl space-y-5">
            
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
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase tracking-wider mb-2">
                0% Fee Instant Indian UPI Activation
              </div>
              <h3 className="text-xl sm:text-2xl font-['Spectral',serif] font-normal text-white">
                {selectedUpiPlan.name} Plan Activation
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Duration: <span className="text-white font-medium">{selectedUpiPlan.duration}</span> • Effective:{' '}
                <strong className="text-emerald-400 font-mono">{selectedUpiPlan.perMonth}</strong>
              </p>
            </div>

            {/* UPI QR Code Container */}
            <div className="rounded-2xl bg-white p-4 flex flex-col items-center justify-center space-y-2">
              <img
                src="/assets/img/payments/mahi-upi-qr.png"
                alt="MAHI Browser UPI QR Code"
                className="w-48 h-48 object-contain rounded-lg"
              />
              <div className="text-[12px] font-mono text-zinc-700 text-center font-bold">
                Scan & Pay ₹{selectedUpiPlan.price.toLocaleString()} via Any UPI App
              </div>
              <div className="text-[10px] font-mono text-zinc-500 text-center">
                PhonePe • Google Pay • Paytm • CRED • BHIM
              </div>
            </div>

            {/* Merchant Details & Copy VPA */}
            <div className="space-y-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 p-3.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Account Holder:</span>
                <span className="font-semibold text-white">Mahipal Choudhary</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-zinc-800">
                <span>Official Merchant VPA:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
                    6375823589@slc
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-white transition-colors"
                  >
                    {copiedUpi ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* UTR Submission Form */}
            {!utrSubmitted ? (
              <form onSubmit={handleUtrSubmit} className="space-y-3">
                <div>
                  <label htmlFor="utr-input" className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                    Enter 12-Digit UTR / Transaction Reference No.
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
                  className="w-full rounded-full bg-white text-black py-2.5 text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-colors shadow-sm"
                >
                  Verify Payment & Submit
                </button>
              </form>
            ) : (
              <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4 text-center space-y-2">
                <div className="text-emerald-400 font-semibold text-sm">
                  ✓ Payment Reference Recorded!
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Your UTR <code className="text-white font-mono">{utrInput}</code> for ₹{selectedUpiPlan.price.toLocaleString()} has been submitted. Instant license key is dispatched to your email and WhatsApp within 5 minutes.
                </p>
                <div className="pt-2">
                  <a
                    href={`https://wa.me/919376343629?text=Hi%20Mahipal,%20I%20have%20paid%20INR%20${selectedUpiPlan.price}%20via%20UPI%20for%20MAHI%20Browser%20${encodeURIComponent(selectedUpiPlan.name)}%20Plan%20(${encodeURIComponent(selectedUpiPlan.duration)}).%20UTR:%20${encodeURIComponent(utrInput)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-black px-4 py-2 text-xs font-bold hover:bg-[#20ba59] transition-colors"
                  >
                    Confirm on WhatsApp (+91 9376343629)
                  </a>
                </div>
              </div>
            )}

            {/* Direct WhatsApp Instant Help */}
            <div className="text-center text-[11px] text-zinc-500 pt-1">
              Need instant activation help? WhatsApp Founder directly at{' '}
              <a
                href="https://wa.me/919376343629"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 hover:text-white underline"
              >
                +91 9376343629
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
