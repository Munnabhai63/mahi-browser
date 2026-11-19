import React from 'react';
import Link from 'next/link';

export default function HeroSection() {
  const tickerItems = [
    'Chromium Core',
    'Playwright Stealth',
    'Puppeteer Extra',
    'Residential Proxies',
    'WebGL Spoofing',
    'JA4 / TLS Emulation',
  ];

  return (
    <section className="relative min-h-screen flex flex-col justify-between pt-36 pb-8 overflow-hidden bg-[#030303]">
      
      {/* BACKGROUND PHONE MOCKUP & GRADIENT OVERLAYS */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
        {/* Exact Framer Full Cover Image: Hand holding Phone */}
        <img
          src="/assets/sxPkE4LCDGhsTG2wk1HO9SrI.jpg"
          alt="Mahi Browser Mockup"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-95"
          draggable={false}
        />

        {/* Top Subtle Fade */}
        <div className="absolute top-0 left-0 right-0 h-32 top-fade" />

        {/* Left Gradient Vignette: Keeps Left Headline & Text 100% Readable */}
        <div className="absolute inset-0 hero-gradient-overlay" />

        {/* Bottom Fade: Smooth transition into partner logos */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bottom-fade" />
      </div>

      {/* MAIN CONTENT CONTAINER (LEFT-ALIGNED) */}
      <div className="relative z-10 max-w-[1440px] w-full mx-auto px-6 sm:px-10 flex-1 flex flex-col justify-center">
        <div className="max-w-[620px] flex flex-col items-start gap-6">
          
          {/* ANNOUNCEMENT PILL BADGE */}
          <Link
            href="/changelog"
            className="glass-pill inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-[13px] text-zinc-200 hover:text-white hover:border-zinc-500 transition-all group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <span className="font-normal text-zinc-300 group-hover:text-white">
              Mahi Browser v2.0 Released — Zero CDP Leaks
            </span>
            <svg
              className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* MAIN HEADLINE (Dual-Font: Bold Sans + Serif Italic) */}
          <h1 className="text-white text-5xl sm:text-6xl lg:text-[72px] leading-[1.08] tracking-[-0.035em] font-light">
            <span className="block font-semibold">The Ultimate Undetectable</span>
            <span className="block font-serif italic text-zinc-200 font-light mt-1">Multi-Profile Browser</span>
          </h1>

          {/* SUBTITLE DESCRIPTION */}
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-[500px] font-normal">
            Deploy thousands of isolated browser environments with unique hardware fingerprints, residential proxies, and zero bot detection.
          </p>

          {/* CTA BUTTONS GROUP */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/download"
              className="inline-flex items-center justify-center px-7 py-3 rounded-full bg-white text-black text-[14px] font-medium tracking-tight hover:bg-zinc-200 transition-all transform hover:scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.18)]"
            >
              Download for Windows
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all text-[14px] font-medium"
            >
              Explore Docs
            </Link>
          </div>

        </div>
      </div>

      {/* INFINITE LOGO MARQUEE TICKER */}
      <div className="relative z-10 w-full mt-14 pt-6 border-t border-zinc-900/60">
        <div className="relative max-w-[1440px] mx-auto overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="flex items-center gap-20 whitespace-nowrap animate-marquee py-2 opacity-50 hover:opacity-100 transition-opacity">
            {/* Ticker Set 1 */}
            {tickerItems.map((item, idx) => (
              <span key={`ticker-1-${idx}`} className="text-zinc-400 text-sm font-semibold tracking-wider font-sans">
                {item}
              </span>
            ))}
            {/* Ticker Set 2 (Duplicate for Seamless Loop) */}
            {tickerItems.map((item, idx) => (
              <span key={`ticker-2-${idx}`} className="text-zinc-400 text-sm font-semibold tracking-wider font-sans">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}
