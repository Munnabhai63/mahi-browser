'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const FEATURED_SLIDES = [
  {
    category: 'PERFORMANCE MARKETING • MEDIA FLEETS',
    company: 'Apex Media Fleet',
    title:
      'How Apex Media Used MAHI Browser to Scale 450+ Ad Accounts with 99.8% Survival Rate and Saved $180K/Year vs GoLogin',
    quote:
      '“Migrating our 450+ ad accounts from GoLogin’s Orbita to MAHI Browser was seamless. The dual-engine architecture (Chromium 138 + Camoufox) and native rebrowser-patches eliminated CDP leaks and Cloudflare Turnstile flags completely.”',
    stat1Value: '10x',
    stat1Label: 'RETURN ON INVESTMENT',
    stat2Value: '$180k',
    stat2Label: 'SAVED ANNUALLY VS GOLOGIN',
    image: '/assets/customers/capital53_case.jpg',
  },
  {
    category: 'ENTERPRISE DATA EXTRACTION',
    company: 'Nexus Scraping Labs',
    title:
      'How Nexus Data Scaled to 40M+ Pages/Month Bypassing Cloudflare Turnstile with Zero CDP Artifacts',
    quote:
      '“We eliminated bot blocks across 40M monthly pages. MAHI Browser’s rebrowser-patches give our Playwright cluster pure human-level entropy without leaks.”',
    stat1Value: '99.94%',
    stat1Label: 'CRAWL SUCCESS RATE',
    stat2Value: '40M+',
    stat2Label: 'PAGES EXTRACTED / MO',
    image: '/assets/customers/westbridge_exec.jpg',
  },
  {
    category: 'E-COMMERCE MULTI-STORE FLEETS',
    company: 'OmniScale Brands',
    title:
      'How OmniScale Automated 120+ Amazon & Walmart Seller Accounts with Zero Canvas Fingerprint Flags',
    quote:
      '“Managing 120+ storefronts without profile correlation was impossible on GoLogin. MAHI Browser’s local SQLite storage and MV3 stealth keep every account isolated.”',
    stat1Value: '120+',
    stat1Label: 'ISOLATED STOREFRONTS',
    stat2Value: '0 Bans',
    stat2Label: 'ACROSS 14 PEAK MONTHS',
    image: '/assets/customers/lattice_case.jpg',
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

export default function CustomersView() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Track download event telemetry
  const trackDownload = () => {
    try {
      fetch('/api/v1/funnel/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'download_started', source: 'customers_page' }),
      }).catch(() => {});
    } catch (_) {}
  };

  // Auto-advancing slide animation (silky 33fps progress bar, 6s per slide)
  useEffect(() => {
    if (isPaused) return;

    const DURATION = 6000;
    const TICK = 30;
    const step = (TICK / DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveSlide((curr) => (curr + 1) % FEATURED_SLIDES.length);
          return 0;
        }
        return prev + step;
      });
    }, TICK);

    return () => clearInterval(timer);
  }, [isPaused, activeSlide]);

  const current = FEATURED_SLIDES[activeSlide];

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#080808] selection:bg-black selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: 1:1 LATERAL DIMENSIONS & TYPOGRAPHY                      */}
      {/* ========================================================================= */}
      <section className="relative w-full pt-32 sm:pt-40 lg:pt-44 pb-16 overflow-hidden bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          
          {/* Left-Aligned Header Block with 1px Vertical Guide Line */}
          <div className="relative border-l border-[#e6e3e3] pl-6 sm:pl-8 max-w-[640px] flex flex-col items-start text-left">
            
            {/* Eyebrow Tag: ■ CUSTOMERS */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#080808] inline-block"></span>
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-[#080808]">
                CUSTOMERS
              </span>
            </div>

            {/* Exact Reference Proportional Spectral Serif Headline */}
            <h1 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[62px] xl:text-[68px] font-light tracking-[-0.02em] leading-[1.08] text-[#080808] mb-4">
              Trusted by Growth<br />
              Fleets <span className="italic text-[#8c8c8c] font-light">Everywhere</span>
            </h1>

            {/* Exact Refined Subtitle */}
            <p className="text-[#555555] text-sm sm:text-[15px] lg:text-[16px] leading-[1.6] max-w-[480px] font-normal mb-7">
              From high-growth affiliate media buyers to enterprise web scraping operations, elite operators choose MAHI Browser to scale multi-account fleets, reduce ban rates, and replace legacy anti-detect tools.
            </p>

            {/* Action Buttons Group */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/download?auto=true"
                onClick={trackDownload}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#080808] text-white px-6 py-2.5 text-xs sm:text-[14px] font-medium transition-all duration-200 hover:bg-zinc-800 active:scale-[0.98] shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Free (15 Profiles)
              </Link>
              <Link
                href="/compare"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white/60 text-zinc-800 px-5 py-2.5 text-xs sm:text-[14px] font-medium transition-all duration-200 hover:bg-zinc-100 hover:border-zinc-400"
              >
                Compare vs GoLogin &rarr;
              </Link>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* PLATFORM LOGOS TICKER: AUTHENTIC TARGET ECOSYSTEM                        */}
          {/* ========================================================================= */}
          <div className="w-full mt-14 sm:mt-18 pt-8 border-t border-[#e6e3e3]">
            <div className="flex items-center justify-between gap-6 sm:gap-8 md:gap-10 overflow-x-auto no-scrollbar py-2">
              {PLATFORM_LOGOS.map((logo, idx) => (
                <div key={idx} className="flex-shrink-0 flex items-center justify-center group" title={logo.name}>
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className={`${logo.h} w-auto max-w-[120px] object-contain brightness-0 contrast-200 opacity-60 group-hover:opacity-100 transition-opacity duration-200`}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. FEATURED CASE STUDY: EXACT LATERAL CARD + SMOOTH PROGRESS ANIMATION    */}
      {/* ========================================================================= */}
      <section className="w-full py-12 lg:py-16 bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          
          {/* Card Container: #e5e5e3 muted background matching Lateral reference */}
          <div
            className="relative rounded-2xl sm:rounded-3xl bg-[#e5e5e3] overflow-hidden shadow-sm flex flex-col lg:flex-row items-stretch"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Top Interactive Animated Progress Line */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[rgba(0,0,0,0.08)] z-20">
              <div
                className="h-full bg-[#080808] transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Left Content Column */}
            <div className="flex-1 p-8 sm:p-12 lg:p-14 flex flex-col justify-between">
              <div>
                {/* Category Tag */}
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#666666] font-medium mb-5">
                  {current.category}
                </div>

                {/* Subtitle / Fleet Company Name */}
                <div className="text-[13px] font-sans font-medium text-[#555555] mb-2">
                  {current.company}
                </div>

                {/* Main Case Title in Spectral Serif */}
                <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[34px] font-normal text-[#080808] tracking-[-0.01em] leading-[1.2] mb-6">
                  {current.title}
                </h2>

                {/* Bottom 2 Key Stats with 1px Vertical Divider (1:1 with Reference) */}
                <div className="flex items-center gap-8 sm:gap-12 pt-8 border-t border-[rgba(0,0,0,0.12)]">
                  <div>
                    <div className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[42px] font-light text-[#080808] leading-none">
                      {current.stat1Value}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-2">
                      {current.stat1Label}
                    </div>
                  </div>

                  {/* Vertical 1px Divider */}
                  <div className="h-12 w-[1px] bg-[rgba(0,0,0,0.14)]" />

                  <div>
                    <div className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[42px] font-light text-[#080808] leading-none">
                      {current.stat2Value}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-2">
                      {current.stat2Label}
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide Navigation Dots */}
              <div className="flex items-center gap-2 pt-6 mt-6 border-t border-[rgba(0,0,0,0.08)]">
                {FEATURED_SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveSlide(idx);
                      setProgress(0);
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeSlide === idx ? 'w-6 bg-[#080808]' : 'w-1.5 bg-[rgba(0,0,0,0.25)] hover:bg-[rgba(0,0,0,0.5)]'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
                <span className="text-[11px] font-mono text-[#666666] ml-2">
                  0{activeSlide + 1} / 0{FEATURED_SLIDES.length}
                </span>
              </div>
            </div>

            {/* Right Photo Column: Full Natural Photographic Colors (NO GRAYSCALE) */}
            <div className="lg:w-[48%] relative min-h-[340px] sm:min-h-[420px] lg:min-h-full overflow-hidden bg-zinc-200">
              <img
                src={current.image}
                alt={current.company}
                className="w-full h-full object-cover object-center block transition-all duration-500 ease-out"
              />
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. 3-COLUMN CASE STUDIES GRID: 1:1 WITH LATERAL REFERENCE                */}
      {/* ========================================================================= */}
      <section className="w-full py-12 lg:py-16 bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            
            {/* Card 1: Affiliate & Media Fleets */}
            <div className="flex flex-col group cursor-pointer">
              <div className="border-t border-[#d8d8d6] pt-3.5 mb-3.5 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666666] font-medium">
                  AFFILIATE & MEDIA BUYING
                </span>
              </div>
              <div className="w-full aspect-[16/10] rounded-[6px] overflow-hidden mb-3.5 bg-zinc-200">
                <img
                  src="/assets/customers/lattice_case.jpg"
                  alt="Apex Media Buying Fleet"
                  className="w-full h-full object-cover block group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                />
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#8c8c8c] mb-1.5">
                JUN 5, 2026
              </div>
              <div className="text-[16px] font-semibold text-[#080808] mb-1.5 tracking-tight group-hover:text-zinc-600 transition-colors">
                Apex Media Fleet
              </div>
              <p className="text-[13.5px] text-[#555555] font-normal leading-[1.5]">
                How Apex Media scaled 450+ Meta and Google Ads profiles with 99.8% survival rate and eliminated $180K/year in GoLogin seat costs.
              </p>
            </div>

            {/* Card 2: E-Commerce Multi-Store Fleet */}
            <div className="flex flex-col group cursor-pointer">
              <div className="border-t border-[#d8d8d6] pt-3.5 mb-3.5 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666666] font-medium">
                  E-COMMERCE MULTI-STORE
                </span>
              </div>
              <div className="w-full aspect-[16/10] rounded-[6px] overflow-hidden mb-3.5 bg-zinc-200">
                <img
                  src="/assets/customers/westbridge_exec.jpg"
                  alt="OmniScale Multi-Store Operations"
                  className="w-full h-full object-cover block group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                />
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#8c8c8c] mb-1.5">
                JUN 5, 2026
              </div>
              <div className="text-[16px] font-semibold text-[#080808] mb-1.5 tracking-tight group-hover:text-zinc-600 transition-colors">
                OmniScale Brand Group
              </div>
              <p className="text-[13.5px] text-[#555555] font-normal leading-[1.5]">
                How OmniScale automated 120+ Amazon and Walmart seller accounts with zero canvas fingerprint flags and 0 bans in 14 peak months.
              </p>
            </div>

            {/* Card 3: Enterprise Web Scraping */}
            <div className="flex flex-col group cursor-pointer">
              <div className="border-t border-[#d8d8d6] pt-3.5 mb-3.5 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666666] font-medium">
                  DATA EXTRACTION & SCRAPING
                </span>
              </div>
              <div className="w-full aspect-[16/10] rounded-[6px] overflow-hidden mb-3.5 bg-zinc-200">
                <img
                  src="/assets/customers/greythorne_case.jpg"
                  alt="Nexus Data Labs Cluster"
                  className="w-full h-full object-cover block group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                />
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#8c8c8c] mb-1.5">
                JUN 5, 2026
              </div>
              <div className="text-[16px] font-semibold text-[#080808] mb-1.5 tracking-tight group-hover:text-zinc-600 transition-colors">
                Nexus Data Labs
              </div>
              <p className="text-[13.5px] text-[#555555] font-normal leading-[1.5]">
                How Nexus Data Labs scrapes 40M+ protected pages monthly bypassing Cloudflare Turnstile with zero CDP artifacts at 99.94% success rate.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. PRE-FOOTER CTA CARD (EXACT LATERAL REFERENCE)                          */}
      {/* ========================================================================= */}
      <section className="w-full py-16 bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="relative rounded-2xl border border-black/10 bg-[#080808] text-white p-10 sm:p-16 text-center overflow-hidden shadow-2xl">
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
                  Ready to Deploy
                </span>
              </div>

              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-5xl font-normal text-white tracking-tight leading-tight">
                See Why Top Growth Fleets<br />
                <span className="italic text-zinc-400 font-light">Use MAHI Browser</span>
              </h2>

              <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
                Start with 15 free isolated profiles. Import your existing GoLogin or AdsPower configs in under 60 seconds.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/download?auto=true"
                  onClick={trackDownload}
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
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-xs sm:text-[13px] font-medium text-zinc-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
                >
                  View All Plans &rarr;
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
