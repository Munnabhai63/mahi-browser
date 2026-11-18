'use client';

import React from 'react';
import Link from 'next/link';
import GoLoginComparisonTable from './GoLoginComparisonTable';

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

export default function CompareView() {
  const trackDownload = () => {
    try {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && navigator.sendBeacon) {
        const payload = JSON.stringify({ eventName: 'download_started', source: 'compare_page' });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/funnel/track', blob);
      }
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#080808] selection:bg-black selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: MAHI VS GOLOGIN HEAD-TO-HEAD                             */}
      {/* ========================================================================= */}
      <section className="relative w-full pt-32 sm:pt-40 lg:pt-44 pb-16 overflow-hidden bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          
          <div className="relative border-l border-[#e6e3e3] pl-6 sm:pl-8 max-w-[680px] flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#080808] inline-block"></span>
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-[#080808]">
                HEAD-TO-HEAD BENCHMARK
              </span>
            </div>

            <h1 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[62px] xl:text-[68px] font-light tracking-[-0.02em] leading-[1.08] text-[#080808] mb-4">
              The Modern, Undetectable<br />
              GoLogin <span className="italic text-[#8c8c8c] font-light">Alternative</span>
            </h1>

            <p className="text-[#555555] text-sm sm:text-[15px] lg:text-[16px] leading-[1.6] max-w-[520px] font-normal mb-7">
              Discover why media buyers, affiliate marketers, and automation engineers are moving from GoLogin’s aging Orbita browser to MAHI Browser’s dual-engine architecture (Chromium 138 + Camoufox C++ Gecko) with zero CDP leaks.
            </p>

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
              <a
                href="#matrix"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white/60 text-zinc-800 px-5 py-2.5 text-xs sm:text-[14px] font-medium transition-all duration-200 hover:bg-zinc-100 hover:border-zinc-400"
              >
                Compare Technical Specs &darr;
              </a>
            </div>
          </div>

          {/* PLATFORM LOGOS TICKER */}
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
      {/* 2. THE 4-WAY COMPETITIVE BENCHMARK MATRIX (ANCHOR: #matrix)               */}
      {/* ========================================================================= */}
      <section id="matrix" className="w-full py-16 scroll-mt-24 bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <GoLoginComparisonTable />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. PRE-FOOTER CTA CARD                                                    */}
      {/* ========================================================================= */}
      <section className="w-full py-16 bg-[#f9f9f9]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="relative rounded-2xl border border-black/10 bg-[#080808] text-white p-10 sm:p-16 text-center overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
                  Zero Downtime Switch
                </span>
              </div>

              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-5xl font-normal text-white tracking-tight leading-tight">
                Ready to Upgrade from GoLogin?<br />
                <span className="italic text-zinc-400 font-light">Get 15 Free Profiles</span>
              </h2>

              <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
                Eliminate CDP detection leaks and Cloudflare Turnstile blocks forever. Start immediately with 15 free profiles.
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
