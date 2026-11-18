'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  popular?: boolean;
  priceMonthlyUSD: number;
  priceYearlyUSD: number;
  priceMonthlyINR: number;
  priceYearlyINR: number;
  group1Title: string;
  group1Features: string[];
  group2Title: string;
  group2Features: string[];
  ctaText: string;
  ctaHref: string;
}

const PRICING_PLANS: PlanTier[] = [
  {
    id: 'core',
    name: 'Core',
    tagline: 'For solo affiliates and growth operators automating their first stealth fleets.',
    priceMonthlyUSD: 8,
    priceYearlyUSD: 4,
    priceMonthlyINR: 599,
    priceYearlyINR: 299,
    group1Title: 'Engines & Profiles',
    group1Features: [
      '15 Air-Gapped Profiles (Offline SQLite)',
      'Dual Engine (Chromium 138 + Camoufox)',
    ],
    group2Title: 'Stealth & Automation',
    group2Features: [
      'Zero CDP Artifacts (Rebrowser-Patches)',
      '0% Instant UPI Payments (slc VPA)',
    ],
    ctaText: 'Start Free Forever',
    ctaHref: '/download',
  },
  {
    id: 'growth',
    name: 'Growth',
    popular: true,
    tagline: 'For agile media buyer squads, scraping clusters, and multi-store operators.',
    priceMonthlyUSD: 39,
    priceYearlyUSD: 20,
    priceMonthlyINR: 2999,
    priceYearlyINR: 1499,
    group1Title: 'Engines & Profiles',
    group1Features: [
      '100 High-Entropy Cloud Profiles',
      'Distributed Redis + R2 Concurrency Locks',
    ],
    group2Title: 'Stealth & Automation',
    group2Features: [
      'Visual RPA Studio & Cookie Warmer',
      'Playwright & Puppeteer Headless API',
    ],
    ctaText: 'Start 7-Day Trial',
    ctaHref: '/signup?plan=growth',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For large agencies, enterprise web scrapers, and institutional fleets.',
    priceMonthlyUSD: 129,
    priceYearlyUSD: 65,
    priceMonthlyINR: 9999,
    priceYearlyINR: 4999,
    group1Title: 'Engines & Profiles',
    group1Features: [
      'Unlimited Air-Gapped Profiles & Fleets',
      'Custom C++ Chromium & Firefox Builds',
    ],
    group2Title: 'Stealth & Automation',
    group2Features: [
      'Unlimited Concurrency & 100k API Calls',
      '24/7 Dedicated WhatsApp (+91 9376343629)',
    ],
    ctaText: 'Start Fleet Trial',
    ctaHref: '/signup?plan=pro',
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
    name: 'Engines & Isolation',
    features: [
      { name: 'Profiles Included', core: '15 Air-Gapped', growth: '100 Profiles', pro: 'Unlimited' },
      { name: 'Chromium 138 MV3 World Stealth', core: true, growth: true, pro: true },
      { name: 'Camoufox C++ Anti-Detect Firefox', core: true, growth: true, pro: true },
      { name: 'Offline SQLite Database (Air-Gapped)', core: true, growth: true, pro: true },
    ],
  },
  {
    name: 'Stealth & Fingerprinting',
    features: [
      { name: 'Integrated Rebrowser-Patches (Zero CDP Artifacts)', core: true, growth: true, pro: true },
      { name: 'CreepJS Detection Benchmark', core: '0.0% (A+)', growth: '0.0% (A+)', pro: '0.0% (A+)' },
      { name: 'Bézier Human Curve Emulation & Typing Cadence', core: true, growth: true, pro: true },
      { name: 'Canvas, WebGL & Audio Perturbation', core: true, growth: true, pro: true },
    ],
  },
  {
    name: 'Automation & Workflows',
    features: [
      { name: 'Visual RPA Studio & Flow Builder', core: 'Basic', growth: 'Advanced', pro: 'Unlimited' },
      { name: 'Automated Cookie Warmer & Session Healer', core: false, growth: true, pro: true },
      { name: 'Playwright / Puppeteer Remote API Access', core: false, growth: true, pro: true },
      { name: 'Distributed Redis Mutex Concurrency Locks', core: false, growth: true, pro: true },
    ],
  },
  {
    name: 'Payments & Team Governance',
    features: [
      { name: '0% Fee Instant UPI Payments (slc VPA)', core: true, growth: true, pro: true },
      { name: 'Team Member Seats with Granular RBAC', core: '1 Seat', growth: '5 Seats', pro: 'Unlimited' },
      { name: 'Encrypted R2 Cloud Backup & Session Sync', core: false, growth: true, pro: true },
      { name: 'Support SLA', core: 'Community', growth: 'Priority Chat', pro: '24/7 Dedicated WhatsApp' },
    ],
  },
];

const PRICING_FAQS = [
  {
    question: 'How are browser profiles stored and isolated?',
    answer:
      'Unlike legacy tools that send your session data to external cloud servers, MAHI Browser stores all profile cookies, local storage, and proxy configurations in local-first encrypted SQLite databases. Your profiles can run completely air-gapped without internet access to an auth server.',
  },
  {
    question: 'Can I import my existing GoLogin or AdsPower profiles and cookies?',
    answer:
      'Yes. MAHI Browser features a Universal Bulk Importer. Simply export your profiles from GoLogin, AdsPower, or Multilogin as JSON, drag and drop the file into MAHI Browser, and our engine automatically maps proxies, User-Agents, and cookies into isolated profiles.',
  },
  {
    question: 'How does 0% fee Indian UPI payment work?',
    answer:
      'You can pay directly via any Indian UPI app (PhonePe, Google Pay, Paytm, CRED, BHIM) to our registered merchant VPA 6375823589@slc. Your account is activated instantly without international credit card markup or foreign transaction fees.',
  },
  {
    question: 'Can I upgrade, downgrade, or cancel anytime?',
    answer:
      'Yes. There are no lock-in contracts. You can upgrade or switch between monthly and annual plans at any time from your account dashboard with prorated billing.',
  },
  {
    question: 'What is the 7-day money-back guarantee?',
    answer:
      'If our dual-engine architecture (Chromium 138 + Camoufox) fails to pass your target platform’s anti-fraud checks (Cloudflare Turnstile, DataDome, CreepJS), simply message our support within 7 days for a full, unconditional refund.',
  },
];

export default function PricingView() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isYearly = billingCycle === 'yearly';

  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] selection:bg-white selection:text-black">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: EXACT LATERAL SCALE, DARK OBSIDIAN AESTHETIC             */}
      {/* ========================================================================= */}
      <section className="relative w-full pt-32 sm:pt-40 lg:pt-44 pb-20 bg-[#050505] text-white overflow-hidden">
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
          <p className="text-zinc-400 text-sm sm:text-[15px] lg:text-[16px] max-w-[540px] mx-auto font-normal leading-[1.6] mb-9">
            Start automating multi-account operations for less than the cost of a single ban. Most operators see 10x ROI and 99.8% fleet survival in their first month.
          </p>

          {/* Billing Cycle & Currency Controls */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-12 sm:mb-16">
            
            {/* Monthly / Yearly Switch with Save 20% Pill Badge */}
            <div className="inline-flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-1.5 shadow-inner">
              <span className={`text-[13px] font-medium transition-colors ${!isYearly ? 'text-white' : 'text-zinc-400'}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(isYearly ? 'monthly' : 'yearly')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isYearly ? 'bg-white' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={isYearly}
                aria-label="Toggle annual billing"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                    isYearly ? 'translate-x-5' : 'translate-x-0 bg-white'
                  }`}
                />
              </button>
              <span className={`text-[13px] font-medium transition-colors ${isYearly ? 'text-white' : 'text-zinc-400'}`}>
                Yearly
              </span>
              <span className="rounded-full bg-white/10 text-white text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-white/15">
                Save 20%
              </span>
            </div>

            {/* Currency Selector (USD $ / INR ₹ 0% UPI) */}
            <div className="inline-flex items-center rounded-full bg-zinc-900/80 border border-zinc-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`rounded-full px-3 py-1 font-medium transition-all ${
                  currency === 'USD' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('INR')}
                className={`rounded-full px-3 py-1 font-medium transition-all ${
                  currency === 'INR' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                INR (₹ UPI)
              </button>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* 3 PRICING CARDS: EXACT LATERAL CARDS + POPULAR BADGE                      */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto text-left">
            {PRICING_PLANS.map((plan) => {
              const price = isYearly
                ? currency === 'USD' ? plan.priceYearlyUSD : plan.priceYearlyINR
                : currency === 'USD' ? plan.priceMonthlyUSD : plan.priceMonthlyINR;
              const symbol = currency === 'USD' ? '$' : '₹';

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl sm:rounded-3xl p-8 sm:p-9 flex flex-col justify-between transition-all duration-300 ${
                    plan.popular
                      ? 'bg-[#111114] border border-zinc-700/80 shadow-[0_0_40px_rgba(255,255,255,0.04)]'
                      : 'bg-[#0c0c0e] border border-white/[0.08]'
                  }`}
                >
                  <div>
                    {/* Top Header: Title & Optional Popular Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-semibold text-white tracking-tight">
                        {plan.name}
                      </h3>
                      {plan.popular && (
                        <span className="rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-mono px-2.5 py-0.5">
                          Popular
                        </span>
                      )}
                    </div>

                    {/* Tagline */}
                    <p className="text-zinc-400 text-[13px] leading-relaxed min-h-[40px] mb-6">
                      {plan.tagline}
                    </p>

                    {/* Price in Spectral Serif (1:1 with Lateral Reference) */}
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-2xl font-light text-zinc-400 font-['Spectral',serif]">
                        {symbol}
                      </span>
                      <span className="font-['Spectral',serif] text-5xl sm:text-[54px] font-light text-white tracking-tight leading-none">
                        {price.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 pb-6 border-b border-white/[0.08]">
                      PER USER/MONTH
                    </div>

                    {/* Features Group 1 */}
                    <div className="mt-6">
                      <div className="text-[12px] font-medium text-white mb-3">
                        {plan.group1Title}
                      </div>
                      <div className="space-y-2.5">
                        {plan.group1Features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-[13px] text-zinc-300">
                            <svg className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                            </svg>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Features Group 2 */}
                    <div className="mt-6 mb-8">
                      <div className="text-[12px] font-medium text-white mb-3">
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

                  {/* Single Clean White Pill Button (1:1 with Reference) */}
                  <div className="pt-4 border-t border-white/[0.08]">
                    <Link
                      href={plan.ctaHref}
                      className="inline-flex w-full items-center justify-center rounded-full bg-white text-black py-3 px-6 text-sm font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-sm"
                    >
                      {plan.ctaText}
                    </Link>
                  </div>

                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* CLIENT / PLATFORM LOGOS TICKER (EXACT 1:1 LATERAL TICKER STRIP)           */}
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
                PLANS
              </span>
            </div>
            <h2 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[56px] font-light tracking-[-0.02em] leading-tight text-[#080808] mb-4">
              Compare Plans
            </h2>
            <p className="text-[#555555] text-sm sm:text-base leading-relaxed">
              All MAHI plans include a host of powerful features built to help you move faster and work smarter.
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
                  const price = isYearly
                    ? currency === 'USD' ? plan.priceYearlyUSD : plan.priceYearlyINR
                    : currency === 'USD' ? plan.priceMonthlyUSD : plan.priceMonthlyINR;
                  const symbol = currency === 'USD' ? '$' : '₹';

                  return (
                    <div key={plan.id} className="text-center px-4 space-y-3">
                      <div className="text-lg font-semibold text-[#080808]">
                        {plan.name}
                      </div>
                      <div className="text-xs text-[#666666] font-mono">
                        {symbol}{price.toLocaleString()} / mo billed annually
                      </div>
                      <Link
                        href={plan.ctaHref}
                        className="inline-flex items-center justify-center rounded-full bg-[#080808] text-white px-5 py-2 text-xs font-medium hover:bg-zinc-800 transition-colors shadow-sm"
                      >
                        Get started
                      </Link>
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

                        {/* Core Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.core === 'boolean' ? (
                            feat.core ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs">{feat.core}</span>
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
                              <span className="text-zinc-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-medium text-black">{feat.growth}</span>
                          )}
                        </div>

                        {/* Pro Value */}
                        <div className="text-center text-[#555555]">
                          {typeof feat.pro === 'boolean' ? (
                            feat.pro ? (
                              <svg className="w-4 h-4 mx-auto text-[#080808]" viewBox="0 0 16 16" fill="currentColor">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-medium text-black">{feat.pro}</span>
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
            
            {/* Left Photo Column: Natural Full Color (Woman with phone) */}
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
                {/* Brand Logo / Subtitle */}
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-xs font-mono font-semibold uppercase tracking-widest text-[#555555]">
                    Westbridge Media Fleets
                  </span>
                </div>

                {/* Main Quote in Spectral Serif */}
                <blockquote className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[32px] font-normal leading-[1.25] tracking-tight mb-8">
                  “MAHI Browser has been transformational. We scaled 450+ ad accounts with a 99.8% survival rate, completely eliminating CDP detection flags and saving $180,000 annually versus GoLogin seat fees.”
                </blockquote>

                {/* Author Info */}
                <div className="text-xs font-mono uppercase tracking-widest text-[#777777] mb-8">
                  Marcus Vance • <span className="text-[#333333]">Head of Media Operations</span>
                </div>
              </div>

              {/* 3 Key Stats with Vertical Dividers (1:1 with Reference) */}
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
      {/* 4. FAQ SECTION: EXACT LATERAL 2-COLUMN LAYOUT                              */}
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
                  href="/download"
                  className="inline-flex items-center justify-center rounded-full bg-[#080808] text-white px-6 py-2.5 text-xs sm:text-[13px] font-medium hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  Request Demo
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
      {/* 5. PRE-FOOTER CTA CARD & UNIFIED FOOTER                                   */}
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
                See Why Top Finance Teams<br />
                <span className="italic text-zinc-400 font-light">Use MAHI Browser</span>
              </h2>

              <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
                Book a demo or download MAHI Browser to see stealth dual-engine browsing in action.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/download"
                  className="inline-flex items-center justify-center rounded-full bg-white text-black px-7 py-3 text-xs sm:text-[13px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-lg shadow-white/5"
                >
                  Download for Windows
                </Link>
                <Link
                  href="/book-demo"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-xs sm:text-[13px] font-medium text-zinc-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
                >
                  Request Demo
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
