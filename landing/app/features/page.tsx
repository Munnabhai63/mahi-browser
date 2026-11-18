'use client';

import React from 'react';
import Link from 'next/link';

export default function FeaturesPage() {
  const [activeWorkflowTab, setActiveWorkflowTab] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  const workflowTabs = [
    {
      title: 'Learns Your Processes',
      subtext: 'Mahi Browser adapts to your multi-account operations, automating routine profile warm-ups, fingerprint spoofing, and session rotations.',
      image: '/assets/mahi_workflow_dashboard.jpg',
    },
    {
      title: 'Handles Exceptions Intelligently',
      subtext: 'Agents learn your target anti-bot rules, proxy rotations, fingerprint policies, and exception handling.',
      image: '/assets/mahi_workflow_laptop.jpg',
    },
    {
      title: 'Scales Instantly',
      subtext: 'Launch 10x more profiles next month without adding headcount or extra hardware.',
      image: '/assets/mahi_workflow_scale.jpg',
    },
  ];

  // Auto-advancing tab progress animation (Framer style, 6s per tab)
  React.useEffect(() => {
    if (isPaused) return;

    const DURATION = 6000; // 6 seconds
    const TICK = 30; // 30ms interval for silky 33fps fill
    const step = (TICK / DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveWorkflowTab((curr) => (curr + 1) % workflowTabs.length);
          return 0;
        }
        return prev + step;
      });
    }, TICK);

    return () => clearInterval(timer);
  }, [isPaused, activeWorkflowTab, workflowTabs.length]);

  const selectTab = (idx: number) => {
    setActiveWorkflowTab(idx);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] selection:bg-white selection:text-black">
      
      {/* ========================================================================= */}
      {/* HERO SECTION: MEET YOUR COMPETITIVE ADVANTAGE (EXACT REFERENCE SCALE)     */}
      {/* ========================================================================= */}
      <section className="relative w-full pt-28 sm:pt-36 lg:pt-40 pb-16 overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          {/* Left-Aligned Header Block with Subtle Vertical Guide Line */}
          <div className="relative border-l border-white/10 pl-4 sm:pl-5 max-w-xl lg:max-w-2xl flex flex-col items-start text-left">
            
            {/* Eyebrow Tag: ■ PRODUCT */}
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-400 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
                PRODUCT
              </span>
            </div>

            {/* Exact Reference Proportional Serif Headline */}
            <h1 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[38px] xl:text-[42px] font-normal tracking-[-0.02em] leading-[1.12] text-white mb-3 sm:mb-3.5">
              Meet Your<br />
              <span className="whitespace-nowrap">Competitive Advantage</span>
            </h1>

            {/* Compact Refined Subtitle */}
            <p className="text-zinc-400 text-xs sm:text-[13px] lg:text-[13.5px] leading-relaxed max-w-[380px] font-normal mb-4 sm:mb-5">
              Eliminate account bans, protect ad spend, and scale 1,000+ browser profiles with zero fingerprint leaks.
            </p>

            {/* Compact Pill CTA Button */}
            <div className="flex items-center">
              <Link
                href="/download"
                className="inline-flex items-center justify-center rounded-full bg-white text-black px-4 py-1.5 text-xs sm:text-[12.5px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-sm"
              >
                Request Demo
              </Link>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* USER HERO IMAGE STAGE (NO BORDER, ONLY BOTTOM LOGO TICKER STRIP)          */}
          {/* ========================================================================= */}
          <div className="w-full mt-14 sm:mt-18">
            {/* Clean Photo Container: Rounded corners, NO outer border card, NO padding */}
            <div className="relative w-full max-w-6xl mx-auto rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-black">
              
              {/* 1600x900 Hero Image Composite */}
              <img
                src="/assets/features_hero_composite.svg"
                alt="Mahi Browser Enterprise Fleet Operation"
                className="w-full h-auto object-cover block select-none pointer-events-none"
                width={1600}
                height={900}
              />

              {/* Bottom Sliding Logo Ticker Strip ("पट्टी") - Mahi Browser Multi-Account Platforms */}
              <div className="absolute bottom-0 left-0 right-0 h-14 sm:h-16 lg:h-18 bg-gradient-to-t from-black/95 via-black/85 to-transparent flex items-center overflow-hidden z-10 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                
                {/* Continuous Infinite Scrolling Row */}
                <div className="flex items-center whitespace-nowrap animate-marquee">
                  
                  {/* Set 1: Real Supported Enterprise Multi-Account Ecosystems */}
                  <div className="flex shrink-0 items-center gap-10 sm:gap-14 lg:gap-16 px-6 sm:px-10">
                    <img src="/assets/img/platforms/meta-logo.svg" alt="Meta" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/g-ads-logo.svg" alt="Google Ads" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/tiktok-logo-1.svg" alt="TikTok" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/amazon-logo-1.svg" alt="Amazon" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/x-logo.svg" alt="X" className="h-3.5 sm:h-4 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/discord-logo-1.svg" alt="Discord" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/linkedin-logo-1.svg" alt="LinkedIn" className="h-3.5 sm:h-4 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/reddit-logo-1.svg" alt="Reddit" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/ebay-logo-1.svg" alt="eBay" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/youTube-logo.svg" alt="YouTube" className="h-3.5 sm:h-4 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                  </div>

                  {/* Set 2 (for seamless continuous infinite loop) */}
                  <div className="flex shrink-0 items-center gap-10 sm:gap-14 lg:gap-16 px-6 sm:px-10" aria-hidden="true">
                    <img src="/assets/img/platforms/meta-logo.svg" alt="Meta" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/g-ads-logo.svg" alt="Google Ads" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/tiktok-logo-1.svg" alt="TikTok" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/amazon-logo-1.svg" alt="Amazon" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/x-logo.svg" alt="X" className="h-3.5 sm:h-4 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/discord-logo-1.svg" alt="Discord" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/linkedin-logo-1.svg" alt="LinkedIn" className="h-3.5 sm:h-4 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/reddit-logo-1.svg" alt="Reddit" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/ebay-logo-1.svg" alt="eBay" className="h-4 sm:h-4.5 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                    <img src="/assets/img/platforms/youTube-logo.svg" alt="YouTube" className="h-3.5 sm:h-4 w-auto object-contain brightness-0 invert opacity-85 shrink-0" />
                  </div>

                </div>

              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: PROCESS 10X VOLUME / SCALE 10X ACCOUNTS (LIGHT BACKGROUND #F9F9F9) */}
      {/* ========================================================================= */}
      <section className="relative w-full bg-[#F9F9F9] text-zinc-900 pt-20 sm:pt-28 pb-24 sm:pb-32 overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          {/* Left-Aligned Header Block with Subtle Vertical Guide Line */}
          <div className="relative border-l border-zinc-300 pl-4 sm:pl-5 max-w-xl lg:max-w-2xl flex flex-col items-start text-left">
            
            {/* Eyebrow Tag: ■ PRODUCT */}
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-900 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-500">
                PRODUCT
              </span>
            </div>

            {/* Exact Reference Proportional Serif Headline in Dark Tone */}
            <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[38px] xl:text-[42px] font-normal tracking-[-0.02em] leading-[1.12] text-zinc-950 mb-3 sm:mb-3.5">
              Scale 10x Accounts.<br />
              <span className="whitespace-nowrap">Deploy in Seconds</span>
            </h2>

            {/* Compact Refined Subtitle in Subtle Gray */}
            <p className="text-zinc-600 text-xs sm:text-[13px] lg:text-[13.5px] leading-relaxed max-w-[420px] font-normal mb-4 sm:mb-5">
              Mahi Browser manages your entire multi-account fleet end-to-end. From instant C++ fingerprint generation to residential proxy rotation, from bulk profile warm-up to 99% ban-free execution.
            </p>

            {/* Compact Black Pill CTA Button with White Text (Exact Reference Match) */}
            <div className="flex items-center">
              <Link
                href="/download"
                className="inline-flex items-center justify-center rounded-full bg-black text-white px-4 py-1.5 text-xs sm:text-[12.5px] font-medium transition-all duration-200 hover:bg-zinc-800 active:scale-[0.98] shadow-sm"
              >
                Request Demo
              </Link>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* THREE VISUAL CARDS GRID (ASPECT ~4:3 WITH BALANCED GLASS BADGES)          */}
          {/* ========================================================================= */}
          <div className="w-full mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7 lg:gap-8">
            
            {/* Card 1: Autonomous Profile Fleet */}
            <div className="flex flex-col">
              {/* Image Box with Floating Glass Badge */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-200 group shadow-sm">
                <img
                  src="/assets/M1oxWnB7xb9RowzhF8iZjEdE.jpg"
                  alt="Autonomous Profile Fleet"
                  className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
                />
                
                {/* Floating Glass Badge (Identical typography scale & single-line fit across all 3 cards) */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-[88%] max-w-[320px] rounded-2xl border border-white/20 bg-black/65 backdrop-blur-xl p-4 sm:p-5 shadow-2xl">
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 mb-2">
                      ACTIVE INSTANCES
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-['Spectral',serif] text-xl sm:text-2xl lg:text-[26px] text-white font-normal whitespace-nowrap">
                        1,420 Profiles
                      </span>
                      <span className="text-[10px] font-mono text-zinc-300 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full whitespace-nowrap">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Content (Light weight, refined text-zinc-900 on white background) */}
              <div className="mt-4 sm:mt-5">
                <h3 className="text-[14.5px] sm:text-[15px] font-normal text-zinc-900 tracking-[-0.01em]">
                  Autonomous Profile Fleet
                </h3>
              </div>
            </div>

            {/* Card 2: Deep Fingerprint Stealth */}
            <div className="flex flex-col">
              {/* Image Box with Floating Glass Badge */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-200 group shadow-sm">
                <img
                  src="/assets/KUP2LdDDrV5R1Zsckb8CtPGqFkA.jpg"
                  alt="Deep Fingerprint Stealth"
                  className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
                />
                
                {/* Floating Glass Badge (99% Ban-Free as instructed, matching typography) */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-[88%] max-w-[320px] rounded-2xl border border-white/20 bg-black/65 backdrop-blur-xl p-4 sm:p-5 shadow-2xl">
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 mb-2">
                      STEALTH RATE
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-['Spectral',serif] text-xl sm:text-2xl lg:text-[26px] text-white font-normal whitespace-nowrap">
                        99% Ban-Free
                      </span>
                      <span className="text-[10px] font-mono text-zinc-300 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full whitespace-nowrap">
                        Clean
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Content (Light weight, refined text-zinc-900 on white background) */}
              <div className="mt-4 sm:mt-5">
                <h3 className="text-[14.5px] sm:text-[15px] font-normal text-zinc-900 tracking-[-0.01em]">
                  Deep Fingerprint Stealth
                </h3>
              </div>
            </div>

            {/* Card 3: Complete Fleet Visibility */}
            <div className="flex flex-col">
              {/* Image Box with Floating Glass Badge */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-200 group shadow-sm">
                <img
                  src="/assets/hero_bg_laptop.webp"
                  alt="Complete Fleet Visibility"
                  className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
                />
                
                {/* Floating Glass Badge (Monochrome silver/zinc, zero green) */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-[88%] max-w-[320px] rounded-2xl border border-white/20 bg-black/65 backdrop-blur-xl p-4 sm:p-5 shadow-2xl">
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 mb-2">
                      LIVE TELEMETRY
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-['Spectral',serif] text-xl sm:text-2xl lg:text-[26px] text-white font-normal whitespace-nowrap">
                        99.9% Uptime
                      </span>
                      <span className="text-[10px] font-mono text-zinc-300 bg-white/10 border border-white/20 px-2.5 py-1 rounded-full whitespace-nowrap">
                        Live
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Content (Light weight, refined text-zinc-900 on white background) */}
              <div className="mt-4 sm:mt-5">
                <h3 className="text-[14.5px] sm:text-[15px] font-normal text-zinc-900 tracking-[-0.01em]">
                  Complete Fleet Visibility
                </h3>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: WORKFLOW / WORK AT LIGHTNING SPEED (DARK OBSIDIAN #050505)     */}
      {/* ========================================================================= */}
      <section className="relative w-full bg-[#050505] text-white pt-20 sm:pt-28 pb-24 sm:pb-32 overflow-hidden border-t border-white/5">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          {/* Left-Aligned Header Block with Subtle Vertical Guide Line */}
          <div className="relative border-l border-white/10 pl-4 sm:pl-5 max-w-xl lg:max-w-2xl flex flex-col items-start text-left">
            
            {/* Eyebrow Tag: ■ WORKFLOW */}
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-400 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
                WORKFLOW
              </span>
            </div>

            {/* Exact Reference Proportional Serif Headline */}
            <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[38px] xl:text-[42px] font-normal tracking-[-0.02em] leading-[1.12] text-white mb-3 sm:mb-3.5">
              Work at Lightning Speed
            </h2>

            {/* Compact Refined Subtitle */}
            <p className="text-zinc-400 text-xs sm:text-[13px] lg:text-[13.5px] leading-relaxed max-w-[420px] font-normal mb-4 sm:mb-5">
              Mahi Browser deploys isolated browser instances that automate complex multi-account workflows end-to-end.
            </p>

            {/* Compact Pill CTA Button */}
            <div className="flex items-center">
              <Link
                href="/download"
                className="inline-flex items-center justify-center rounded-full bg-white text-black px-4 py-1.5 text-xs sm:text-[12.5px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-sm"
              >
                Request Demo
              </Link>
            </div>

          </div>

          {/* Interactive 3 Tabs Row with Auto-Progress Animation (Framer Style) */}
          <div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 mt-12 sm:mt-16 mb-8 sm:mb-12"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {workflowTabs.map((tab, idx) => {
              const isActive = activeWorkflowTab === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectTab(idx)}
                  className="text-left group cursor-pointer focus:outline-none flex flex-col items-start"
                >
                  {/* Top Animated Indicator Line */}
                  <div className="w-full h-[2px] bg-white/10 relative mb-4 rounded-full overflow-hidden">
                    {isActive ? (
                      <div
                        className="h-full bg-white transition-[width] duration-75 ease-linear rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                        style={{ width: `${progress}%` }}
                      />
                    ) : idx < activeWorkflowTab ? (
                      <div className="h-full w-full bg-white/20 rounded-full" />
                    ) : null}
                  </div>

                  {/* Title */}
                  <h3
                    className={`text-sm sm:text-[15px] tracking-tight transition-colors duration-200 ${
                      isActive ? 'text-white font-medium' : 'text-zinc-500 font-normal group-hover:text-zinc-300'
                    }`}
                  >
                    {tab.title}
                  </h3>

                  {/* Subtext Accordion with Smooth Fade & Slide */}
                  <div
                    className={`grid transition-all duration-300 ease-out text-left ${
                      isActive ? 'grid-rows-[1fr] opacity-100 mt-2.5' : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-xs sm:text-[13px] text-zinc-400 font-normal leading-relaxed">
                        {tab.subtext}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dashboard / Laptop Mockup Display Container (Dynamic with Smooth Entrance Animation) */}
          <div 
            className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#08090b] shadow-2xl transition-all duration-300 group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Top Bar Controls / Live Dot */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-zinc-300">
              <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>{isPaused ? 'PAUSED' : 'AUTO-TOUR'}</span>
            </div>

            <div className="relative w-full aspect-[16/9] overflow-hidden flex items-center justify-center bg-[#050505]">
              <img
                key={activeWorkflowTab}
                src={workflowTabs[activeWorkflowTab]?.image || '/assets/mahi_workflow_laptop.jpg'}
                alt={workflowTabs[activeWorkflowTab]?.title || 'Mahi Browser Workflow'}
                className="w-full h-full object-cover select-none pointer-events-none rounded-2xl animate-fadeInScale"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: INTEGRATIONS (DARK OBSIDIAN #050505 - EXACT LATERAL REFERENCE)  */}
      {/* ========================================================================= */}
      <section className="relative w-full bg-[#050505] text-white pt-24 sm:pt-32 pb-24 sm:pb-36 overflow-hidden border-t border-white/5">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          {/* Centered Header Block */}
          <div className="max-w-2xl mx-auto flex flex-col items-center text-center">
            
            {/* Eyebrow Tag: ■ INTEGRATIONS */}
            <div className="inline-flex items-center gap-2 mb-3.5">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-400 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
                INTEGRATIONS
              </span>
            </div>

            {/* Headline in Spectral Serif */}
            <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[40px] xl:text-[44px] font-normal tracking-[-0.02em] leading-[1.12] text-white mb-3.5 sm:mb-4">
              Fully Integrated With Your Existing Tools
            </h2>

            {/* Subtitle */}
            <p className="text-zinc-400 text-xs sm:text-[13.5px] lg:text-[14px] leading-relaxed max-w-[500px] font-normal mb-6 sm:mb-7">
              Mahi Browser integrates seamlessly with the platforms your teams already use, so you can scale without disrupting existing workflows.
            </p>

            {/* CTA Button */}
            <div className="flex items-center justify-center">
              <Link
                href="/download"
                className="inline-flex items-center justify-center rounded-full bg-white text-black px-5 py-2 text-xs sm:text-[12.5px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-sm"
              >
                Request Demo
              </Link>
            </div>

          </div>

          {/* Dual Infinite Scrolling Marquee Rows with Edge Gradient Masks */}
          <div className="mt-16 sm:mt-20 flex flex-col gap-6 sm:gap-8 relative [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            
            {/* Row 1: Scrolling Left (Platforms, Ad Networks, Payments) */}
            <div className="flex overflow-hidden select-none group">
              <div className="flex shrink-0 items-center gap-10 sm:gap-14 animate-marquee group-hover:[animation-play-state:paused]">
                <img src="/assets/img/platforms/meta-logo.svg" alt="Meta" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/g-ads-logo.svg" alt="Google Ads" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/tiktok-logo-1.svg" alt="TikTok" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/amazon-logo-1.svg" alt="Amazon" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/x-logo.svg" alt="X" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/discord-logo-1.svg" alt="Discord" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/linkedin-logo-1.svg" alt="LinkedIn" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/reddit-logo-1.svg" alt="Reddit" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/ebay-logo-1.svg" alt="eBay" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/youTube-logo.svg" alt="YouTube" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/instagram-logo-1.svg" alt="Instagram" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/facebook-logo-1.svg" alt="Facebook" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/gmail-logo.svg" alt="Gmail" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/Airbnb-logo.svg" alt="Airbnb" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/etsy-logo-1.svg" alt="Etsy" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/pintrest-logo.svg" alt="Pinterest" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
              </div>
              {/* Duplicate Set for Infinite Loop */}
              <div className="flex shrink-0 items-center gap-10 sm:gap-14 animate-marquee group-hover:[animation-play-state:paused]" aria-hidden="true">
                <img src="/assets/img/platforms/meta-logo.svg" alt="Meta" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/g-ads-logo.svg" alt="Google Ads" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/tiktok-logo-1.svg" alt="TikTok" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/amazon-logo-1.svg" alt="Amazon" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/x-logo.svg" alt="X" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/discord-logo-1.svg" alt="Discord" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/linkedin-logo-1.svg" alt="LinkedIn" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/reddit-logo-1.svg" alt="Reddit" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/ebay-logo-1.svg" alt="eBay" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/youTube-logo.svg" alt="YouTube" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/instagram-logo-1.svg" alt="Instagram" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/facebook-logo-1.svg" alt="Facebook" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/gmail-logo.svg" alt="Gmail" className="h-4.5 sm:h-5 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/Airbnb-logo.svg" alt="Airbnb" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/etsy-logo-1.svg" alt="Etsy" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
                <img src="/assets/img/platforms/pintrest-logo.svg" alt="Pinterest" className="h-5 sm:h-6 w-auto object-contain brightness-0 invert opacity-65 hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </div>

            {/* Row 2: Scrolling Right (Proxies, Automation Frameworks, OS, Dev Engines) */}
            <div className="flex overflow-hidden select-none group">
              <div className="flex shrink-0 items-center gap-10 sm:gap-14 animate-marquee-reverse group-hover:[animation-play-state:paused]">
                {/* Windows */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Windows">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Windows</span>
                </div>
                {/* Android */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Android">
                  <img src="/assets/img/features/android-icon.svg" alt="Android" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Android</span>
                </div>
                {/* Chromium */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Chromium Engine">
                  <img src="/assets/img/features/chrome-icon1.svg" alt="Chromium" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Chromium</span>
                </div>
                {/* Python */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Python SDK">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.8v.826H3.88S0 5.79 0 11.908c0 6.12 3.395 5.908 3.395 5.908h2.025v-2.836s-.11-3.387 3.32-3.387h5.714s3.21.053 3.21-3.11V2.656S18.006 0 11.914 0zm-3.27 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.442 22.162c6.094 0 5.714-2.656 5.714-2.656l-.006-2.752h-5.8v-.826h8.126S24 18.21 24 12.092c0-6.12-3.395-5.908-3.395-5.908h-2.025v2.836s.11 3.387-3.32 3.387h-5.714s-3.21-.053-3.21 3.11v5.828s-.346 2.656 5.746 2.656zm3.27-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Python</span>
                </div>
                {/* Playwright */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Playwright API">
                  <svg className="w-5 h-5 fill-none stroke-current text-white stroke-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Playwright</span>
                </div>
                {/* Puppeteer */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Puppeteer">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Puppeteer</span>
                </div>
                {/* Selenium */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Selenium Grid">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Selenium</span>
                </div>
                {/* OpenAI */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="OpenAI API">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.63a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 8.937a4.485 4.485 0 0 1 2.366-1.973V12.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.169a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 8.937zm16.597 3.855l-5.833-3.387L15.119 8.24a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.666zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 10.27V7.934a.08.08 0 0 1 .033-.062l4.84-2.796a4.499 4.499 0 0 1 6.665 4.686zM8.308 15.02l-2.02-1.164a.08.08 0 0 1-.038-.057V8.214a4.5 4.5 0 0 1 7.37-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.392.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.612-1.5z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">OpenAI</span>
                </div>
                {/* Proxies */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Residential & Mobile Proxies">
                  <img src="/assets/img/features/proxies-icon1.svg" alt="Proxies" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Proxies (4G/5G)</span>
                </div>
                {/* Fingerprint Engine */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="C++ Hardware Fingerprints">
                  <img src="/assets/img/features/fingerprint-icon1.svg" alt="Fingerprints" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">C++ Spoofing</span>
                </div>
                {/* Docker */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Docker Containerization">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.186v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.186.185.186zm0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186zm-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186zm-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186zm5.893 2.715h2.118a.186.186 0 00.186-.186V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.186v1.888c0 .102.082.185.185.185zm-2.93 0h2.12a.185.185 0 00.184-.186V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.186v1.888c0 .102.083.185.185.185zm-2.964 0h2.119a.185.185 0 00.185-.186V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.888c0 .102.084.185.186.185zm-2.928 0h2.119a.185.185 0 00.185-.186V9.006a.185.185 0 00-.185-.186H2.208a.185.185 0 00-.185.186v1.888c0 .102.083.185.185.185zm21.603.627a8.777 8.777 0 00-5.714-3.155.188.188 0 00-.168.077c-.504.665-1.255 1.055-2.072 1.055h-.372a.186.186 0 00-.186.186v3.292c0 .918.746 1.664 1.664 1.664h1.72c2.472 0 4.675-.98 6.305-2.585a.187.187 0 00.04-.194c-.31-.796-.723-1.583-1.217-2.344zM23.978 13.064c-.13-.092-.587-.394-1.442-.408-.667-.01-1.353.15-2.043.479-.65.31-1.306.467-1.95.467-.624 0-1.25-.145-1.874-.436-.64-.298-1.302-.45-1.966-.45-.664 0-1.326.152-1.967.45-.623.29-1.248.436-1.872.436-.643 0-1.302-.157-1.952-.467-.69-.328-1.376-.489-2.043-.479-.854.014-1.312.316-1.441.408a.222.222 0 00-.091.176c0 .878.23 2.656 1.34 4.398 1.135 1.782 2.923 2.868 5.318 3.23 1.326.2 2.673.2 3.999 0 2.396-.362 4.184-1.448 5.319-3.23 1.11-1.742 1.34-3.52 1.34-4.398a.22.22 0 00-.09-.176z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Docker</span>
                </div>
                {/* REST API */}
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0" title="Local Headless REST API">
                  <svg className="w-5 h-5 fill-none stroke-current text-white stroke-2" viewBox="0 0 24 24"><path d="M4 17l6-6-6-6M12 19h8"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">REST API</span>
                </div>
              </div>
              {/* Duplicate Set for Infinite Loop */}
              <div className="flex shrink-0 items-center gap-10 sm:gap-14 animate-marquee-reverse group-hover:[animation-play-state:paused]" aria-hidden="true">
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Windows</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <img src="/assets/img/features/android-icon.svg" alt="Android" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Android</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <img src="/assets/img/features/chrome-icon1.svg" alt="Chromium" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Chromium</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.006 2.752h5.8v.826H3.88S0 5.79 0 11.908c0 6.12 3.395 5.908 3.395 5.908h2.025v-2.836s-.11-3.387 3.32-3.387h5.714s3.21.053 3.21-3.11V2.656S18.006 0 11.914 0zm-3.27 1.838a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1zm3.442 22.162c6.094 0 5.714-2.656 5.714-2.656l-.006-2.752h-5.8v-.826h8.126S24 18.21 24 12.092c0-6.12-3.395-5.908-3.395-5.908h-2.025v2.836s.11 3.387-3.32 3.387h-5.714s-3.21-.053-3.21 3.11v5.828s-.346 2.656 5.746 2.656zm3.27-1.838a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Python</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-none stroke-current text-white stroke-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Playwright</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Puppeteer</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Selenium</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.63a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 8.937a4.485 4.485 0 0 1 2.366-1.973V12.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.169a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 8.937zm16.597 3.855l-5.833-3.387L15.119 8.24a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.666zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 10.27V7.934a.08.08 0 0 1 .033-.062l4.84-2.796a4.499 4.499 0 0 1 6.665 4.686zM8.308 15.02l-2.02-1.164a.08.08 0 0 1-.038-.057V8.214a4.5 4.5 0 0 1 7.37-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.392.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.612-1.5z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">OpenAI</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <img src="/assets/img/features/proxies-icon1.svg" alt="Proxies" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Proxies (4G/5G)</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <img src="/assets/img/features/fingerprint-icon1.svg" alt="Fingerprints" className="w-5 h-5 object-contain brightness-0 invert" />
                  <span className="text-xs font-mono tracking-tight text-zinc-300">C++ Spoofing</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.186v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.186.185.186zm0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186zm-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186zm-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186zm5.893 2.715h2.118a.186.186 0 00.186-.186V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.186v1.888c0 .102.082.185.185.185zm-2.93 0h2.12a.185.185 0 00.184-.186V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.186v1.888c0 .102.083.185.185.185zm-2.964 0h2.119a.185.185 0 00.185-.186V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.888c0 .102.084.185.186.185zm-2.928 0h2.119a.185.185 0 00.185-.186V9.006a.185.185 0 00-.185-.186H2.208a.185.185 0 00-.185.186v1.888c0 .102.083.185.185.185zm21.603.627a8.777 8.777 0 00-5.714-3.155.188.188 0 00-.168.077c-.504.665-1.255 1.055-2.072 1.055h-.372a.186.186 0 00-.186.186v3.292c0 .918.746 1.664 1.664 1.664h1.72c2.472 0 4.675-.98 6.305-2.585a.187.187 0 00.04-.194c-.31-.796-.723-1.583-1.217-2.344zM23.978 13.064c-.13-.092-.587-.394-1.442-.408-.667-.01-1.353.15-2.043.479-.65.31-1.306.467-1.95.467-.624 0-1.25-.145-1.874-.436-.64-.298-1.302-.45-1.966-.45-.664 0-1.326.152-1.967.45-.623.29-1.248.436-1.872.436-.643 0-1.302-.157-1.952-.467-.69-.328-1.376-.489-2.043-.479-.854.014-1.312.316-1.441.408a.222.222 0 00-.091.176c0 .878.23 2.656 1.34 4.398 1.135 1.782 2.923 2.868 5.318 3.23 1.326.2 2.673.2 3.999 0 2.396-.362 4.184-1.448 5.319-3.23 1.11-1.742 1.34-3.52 1.34-4.398a.22.22 0 00-.09-.176z"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">Docker</span>
                </div>
                <div className="flex items-center gap-2 opacity-65 hover:opacity-100 transition-opacity shrink-0">
                  <svg className="w-5 h-5 fill-none stroke-current text-white stroke-2" viewBox="0 0 24 24"><path d="M4 17l6-6-6-6M12 19h8"/></svg>
                  <span className="text-xs font-mono tracking-tight text-zinc-300">REST API</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 5: PURPOSE-BUILT FOR YOUR INDUSTRY & CUSTOMER TESTIMONIAL */}
      <section id="solutions" className="bg-[#f9f9f9] text-[#080808] pt-24 sm:pt-28 lg:pt-32 pb-24 sm:pb-28 lg:pb-32 border-t border-zinc-200/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-10">
          
          {/* Top Half: Header and 4 Cards with Lateral Left Border Guideline */}
          <div className="border-l border-zinc-300/80 pl-6 sm:pl-8 lg:pl-10">
            
            {/* Left Header Block */}
            <div className="flex flex-col gap-4 sm:gap-5 max-w-2xl">
              
              {/* Eyebrow Tag */}
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 bg-[#969290] rounded-[1px]" />
                <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#969290]">
                  SOLUTIONS
                </span>
              </div>

              {/* Headline */}
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal text-[#080808] tracking-[-0.035em] leading-[1.18]">
                Purpose-Built for Your Industry
              </h2>

              {/* Subtitle */}
              <p className="text-[15px] sm:text-[16px] text-[#636363] leading-[1.5] max-w-lg font-normal">
                Mahi Browser powers high-stakes multi-account workflows end-to-end, freeing your growth team to scale what actually drives revenue.
              </p>

              {/* Request Demo Button */}
              <div className="pt-2">
                <Link
                  href="#download"
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#030303] text-white text-[13px] font-medium tracking-tight hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  Request Demo
                </Link>
              </div>

            </div>

            {/* 4-Column Solutions Feature Cards Grid */}
            <div className="mt-16 sm:mt-20 lg:mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              
              {/* Card 1: Affiliate Marketing */}
              <div className="flex flex-col group">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-[#08090b] relative border border-[#222329] shadow-sm">
                  <img
                    src="/assets/solutions/solution_affiliate.svg"
                    alt="Affiliate Marketing"
                    className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 flex flex-col">
                  <h4 className="text-[17px] font-medium text-[#080808] tracking-[-0.02em] mb-1.5">
                    Affiliate Marketing
                  </h4>
                  <p className="text-[13px] sm:text-[14px] text-[#636363] leading-[1.45] font-normal">
                    Affiliate teams and media buyers use Mahi Browser to run high-volume ad accounts across Meta, TikTok, and Google Ads&mdash;eliminating account bans, fingerprint leaks, and pixel linking.
                  </p>
                </div>
              </div>

              {/* Card 2: E-Commerce Fleets */}
              <div className="flex flex-col group">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-[#08090b] relative border border-[#222329] shadow-sm">
                  <img
                    src="/assets/solutions/solution_ecommerce.svg"
                    alt="E-Commerce Fleets"
                    className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 flex flex-col">
                  <h4 className="text-[17px] font-medium text-[#080808] tracking-[-0.02em] mb-1.5">
                    E-Commerce Fleets
                  </h4>
                  <p className="text-[13px] sm:text-[14px] text-[#636363] leading-[1.45] font-normal">
                    Multi-store merchants use Mahi Browser to scale operations across Amazon, eBay, Shopify, and Etsy&mdash;maintaining 100% isolated browser environments with dedicated residential proxy binding.
                  </p>
                </div>
              </div>

              {/* Card 3: Web Scraping & Data */}
              <div className="flex flex-col group">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-[#08090b] relative border border-[#222329] shadow-sm">
                  <img
                    src="/assets/solutions/solution_scraping.svg"
                    alt="Web Scraping & Data"
                    className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 flex flex-col">
                  <h4 className="text-[17px] font-medium text-[#080808] tracking-[-0.02em] mb-1.5">
                    Web Scraping & Data
                  </h4>
                  <p className="text-[13px] sm:text-[14px] text-[#636363] leading-[1.45] font-normal">
                    Data extraction and intelligence firms use Mahi Browser to automate large-scale scraping loops, cleanly bypassing Cloudflare Turnstile, DataDome, and bot protections with Playwright.
                  </p>
                </div>
              </div>

              {/* Card 4: Social Media Operations */}
              <div className="flex flex-col group">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-[#08090b] relative border border-[#222329] shadow-sm">
                  <img
                    src="/assets/solutions/solution_social.svg"
                    alt="Social Media Operations"
                    className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 flex flex-col">
                  <h4 className="text-[17px] font-medium text-[#080808] tracking-[-0.02em] mb-1.5">
                    Social Media Operations
                  </h4>
                  <p className="text-[13px] sm:text-[14px] text-[#636363] leading-[1.45] font-normal">
                    Agencies and growth operators use Mahi Browser to manage multi-account fleets across X, Discord, Reddit, and LinkedIn with native device signatures and persistent sessions.
                  </p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION 6B: CUSTOMER TESTIMONIAL (Quote Section - 1:1 with Lateral #11qcowx) */}
      <section id="testimonial" className="w-full bg-[#f9f9f9] py-16 sm:py-20 lg:py-28 border-t border-zinc-200/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-10 flex flex-col items-center">
          
          {/* Centered 1120px Card (1:1 with Lateral Desktop framer-pfrisr) */}
          <div className="w-full max-w-[1120px] bg-[#e5e5e3] rounded-[4px] p-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-0">
            
            {/* Left: 1:1 Perfect Square Photo Wrapper */}
            <div className="w-full lg:flex-1 lg:pr-8 flex items-center justify-center">
              <div className="w-full aspect-square rounded-[4px] overflow-hidden bg-zinc-300">
                <img
                  src="/assets/testimonial_jane.jpg"
                  alt="Jane Berwick"
                  className="w-full h-full object-cover object-top rounded-[4px]"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Right: Content Column with 1px Divider */}
            <div className="w-full lg:flex-[1.25] flex flex-col justify-between self-stretch lg:border-l lg:border-[rgba(158,158,157,0.4)] lg:pl-8 pt-4 lg:pt-0">
              <div>
                {/* Westbridge Logo */}
                <div className="mb-6 opacity-85">
                  <img
                    src="/assets/westbridge_logo.svg"
                    alt="Westbridge"
                    className="h-5 w-auto object-contain"
                  />
                </div>

                {/* Quote (Mahi Browser Stealth & Anti-Detect Operations) */}
                <blockquote className="font-serif text-xl sm:text-2xl text-[#080808] leading-[1.32] tracking-[-0.02em] mb-6">
                  &ldquo;Mahi Browser has been transformational. Our multi-account fleet uptime reached 99.8%, freeing up $5.2M in media spend previously lost to platform bans. We scaled from an 18-day manual rotation cycle to automated instant deployments consistently.&rdquo;
                </blockquote>

                {/* Name & Title */}
                <div>
                  <div className="text-[13px] font-medium text-[#636363]">Jane Berwick</div>
                  <div className="text-[11px] font-sans text-[#636363] mt-0.5">
                    Managing Partner
                  </div>
                </div>
              </div>

              {/* Bottom 3 Metrics with Vertical 1px Dividers */}
              <div className="grid grid-cols-3 pt-6 mt-6 border-t border-[rgba(158,158,157,0.4)]">
                <div>
                  <div className="font-serif text-2xl sm:text-3xl font-light text-[#080808]">$180K</div>
                  <div className="text-[11px] font-sans text-[#969290] mt-1">Cost Savings</div>
                </div>
                <div className="border-l border-[rgba(158,158,157,0.4)] pl-6">
                  <div className="font-serif text-2xl sm:text-3xl font-light text-[#080808]">94%</div>
                  <div className="text-[11px] font-sans text-[#969290] mt-1">Increase in ARR</div>
                </div>
                <div className="border-l border-[rgba(158,158,157,0.4)] pl-6">
                  <div className="font-serif text-2xl sm:text-3xl font-light text-[#080808]">10x</div>
                  <div className="text-[11px] font-sans text-[#969290] mt-1">ROI</div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION 7: ENTERPRISE-GRADE SECURITY */}
      <section id="security" className="bg-[#030303] text-white py-24 sm:py-28 lg:py-32">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-10">
          
          <div className="border-l border-zinc-800 pl-6 sm:pl-8 lg:pl-10">
            
            {/* Header Block */}
            <div className="flex flex-col gap-4 sm:gap-5 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-[1px]" />
                <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-zinc-400">
                  SECURITY
                </span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal text-white tracking-[-0.035em] leading-[1.18]">
                Enterprise-Grade Security
              </h2>

              <p className="text-[15px] sm:text-[16px] text-zinc-400 leading-[1.5] max-w-lg font-normal">
                Hardware fingerprint spoofing, zero-knowledge profile encryption, and dedicated residential proxy isolation safeguard your team&apos;s assets.
              </p>

              <div className="pt-2">
                <Link
                  href="#download"
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-white text-black text-[13px] font-medium tracking-tight hover:bg-zinc-200 transition-colors shadow-sm"
                >
                  Request Demo
                </Link>
              </div>
            </div>

            {/* 3 Security Cards Grid matching Lateral 1:1 */}
            <div className="mt-16 sm:mt-20 lg:mt-24 grid grid-cols-1 md:grid-cols-3 border border-[#1f2123] rounded-[4px] overflow-hidden">
              
              {/* Card 1: SOC 2 */}
              <div className="p-8 flex flex-col justify-between min-h-[360px] bg-transparent group">
                <div>
                  <h3 className="text-base font-semibold tracking-wider text-white uppercase font-mono">
                    SOC TYPE II
                  </h3>
                  <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed font-normal">
                    SOC 2 Type II certified for enterprise-grade profile protection.
                  </p>
                </div>
                <div className="pt-12">
                  <img
                    src="/assets/security/soc2_shield.svg"
                    alt="SOC 2 Type II"
                    className="w-12 h-12 opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </div>

              {/* Card 2: ISO 27001 */}
              <div className="p-8 flex flex-col justify-between min-h-[360px] bg-transparent border-t md:border-t-0 md:border-l border-[#1f2123] group">
                <div>
                  <h3 className="text-base font-semibold tracking-wider text-white uppercase font-mono">
                    ISO 27001
                  </h3>
                  <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed font-normal">
                    ISO 27001 certified data center and encryption management.
                  </p>
                </div>
                <div className="pt-12">
                  <img
                    src="/assets/security/iso27001.svg"
                    alt="ISO 27001"
                    className="w-12 h-12 opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </div>

              {/* Card 3: GDPR */}
              <div className="p-8 flex flex-col justify-between min-h-[360px] bg-transparent border-t md:border-t-0 md:border-l border-[#1f2123] group">
                <div>
                  <h3 className="text-base font-semibold tracking-wider text-white uppercase font-mono">
                    GDPR
                  </h3>
                  <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed font-normal">
                    Fully compliant with GDPR and CCPA privacy standards.
                  </p>
                </div>
                <div className="pt-12">
                  <img
                    src="/assets/security/gdpr_stars.svg"
                    alt="GDPR"
                    className="w-12 h-12 opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION 8: FAQ ("YOUR QUESTIONS ANSWERED") */}
      <section id="faq" className="bg-[#f9f9f9] text-[#080808] py-24 sm:py-28 lg:py-32 border-t border-zinc-200/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-10">
          
          {/* Centered Header */}
          <div className="flex flex-col items-center text-center gap-4 sm:gap-5 max-w-2xl mx-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 bg-[#969290] rounded-[1px]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#969290]">
                FAQ
              </span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal text-[#080808] tracking-[-0.035em] leading-[1.18]">
              Your Questions Answered
            </h2>

            <p className="text-[15px] sm:text-[16px] text-[#636363] leading-[1.5] max-w-lg font-normal">
              Everything you need to know about Mahi Browser, hardware fingerprint spoofing, and multi-account fleet scalability.
            </p>

            <div className="pt-2">
              <Link
                href="#download"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#030303] text-white text-[13px] font-medium tracking-tight hover:bg-zinc-800 transition-colors shadow-sm"
              >
                Request Demo
              </Link>
            </div>
          </div>

          {/* Accordion List */}
          <div className="mt-16 sm:mt-20 max-w-3xl mx-auto border-t border-zinc-300/80">
            {[
              {
                q: 'How does Mahi Browser prevent platform bans and fingerprint leaks?',
                a: 'Mahi Browser alters fingerprint telemetry at the Chromium C++ core rather than via JavaScript overrides. Each browser profile runs in complete isolation with distinct Canvas, WebGL, AudioContext, ClientRects, WebRTC, fonts, and OS-matched hardware signatures.',
              },
              {
                q: 'Can we import our existing profiles, cookies, and proxies?',
                a: 'Yes. Mahi Browser offers 1-click automated bulk import from AdsPower, Multilogin, and Dolphin{anty}, instantly migrating cookies, localStorage, extensions, and proxy credentials with zero downtime.',
              },
              {
                q: 'What proxy protocols and integrations are supported?',
                a: 'We natively support HTTP, HTTPS, SOCKS5, 4G/5G mobile, and dedicated residential proxies with automated rotation endpoints and IP health checks built in.',
              },
              {
                q: 'Is our team data and profile configuration secure?',
                a: 'Yes. All browser profile data, session storage, and proxy credentials are encrypted with client-side AES-256 before synchronization. No unencrypted data is ever accessible to third parties.',
              },
              {
                q: 'Can we automate workflows using Playwright or Puppeteer?',
                a: 'Absolutely. Mahi Browser provides a local REST API and CDP (Chrome DevTools Protocol) endpoints compatible with Playwright, Puppeteer, and Selenium for seamless headless or headful multi-account automation.',
              },
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="border-b border-zinc-300/80">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full py-6 flex items-center justify-between text-left gap-4 group"
                  >
                    <span className="text-[15px] sm:text-[17px] font-medium text-[#080808] group-hover:text-zinc-600 transition-colors">
                      {item.q}
                    </span>
                    <span className="text-xl font-light text-zinc-500 shrink-0 select-none">
                      {isOpen ? '-' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-6 text-[14px] sm:text-[15px] text-[#636363] leading-relaxed font-normal">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* SECTION 9: FINAL PRE-FOOTER CTA CARD */}
      <section className="bg-[#f9f9f9] text-[#080808] pt-16 sm:pt-24 pb-20 sm:pb-28 border-t border-zinc-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-10">
          
          {/* Floating Dark Card (Centered 1280px matching Lateral 1:1) */}
          <div className="w-full max-w-[1280px] mx-auto bg-[#191919] text-white rounded-[4px] p-8 sm:p-12 lg:p-14 border border-[#2a2a2a] shadow-2xl relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-[1px]" />
                <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-zinc-400">
                  GET STARTED
                </span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-[-0.03em] leading-tight">
                See Why Top Growth Teams Use Mahi Browser
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                Book a demo or launch your first stealth fleet today.
              </p>
              <div className="pt-2">
                <Link
                  href="#download"
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-white text-black text-xs sm:text-sm font-medium hover:bg-zinc-200 transition-colors shadow-sm"
                >
                  Request Demo
                </Link>
              </div>
            </div>

            {/* Right Mockup */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-lg aspect-[16/10] rounded-[4px] overflow-hidden border border-zinc-800 shadow-xl bg-zinc-900">
                <img
                  src="/assets/mahi_workflow_dashboard.jpg"
                  alt="Mahi Browser Dashboard"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

          </div>



        </div>
      </section>

    </div>
  );
}
