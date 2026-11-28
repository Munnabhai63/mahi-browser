'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '../lib/brand';

const STATS = [
  { target: 500, suffix: '+', label: 'FLEET CUSTOMERS' },
  { target: 52, suffix: '', label: 'CORE CONTRIBUTORS' },
  { target: 25, suffix: '', label: 'COUNTRIES REACHED' },
];

function StatCounter({
  target,
  suffix = '',
  label,
  hasBorderLeft = false,
}: {
  target: number;
  suffix?: string;
  label: string;
  hasBorderLeft?: boolean;
}) {
  const [count, setCount] = React.useState(0);
  const [hasAnimated, setHasAnimated] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  React.useEffect(() => {
    if (!hasAnimated) return;

    let startTime: number | null = null;
    const duration = 1400; // 1.4s smooth count up

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic curve
      const easeProgress = 1 - (1 - progress) ** 3;
      setCount(Math.floor(easeProgress * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    requestAnimationFrame(animate);
  }, [hasAnimated, target]);

  return (
    <div
      ref={ref}
      className={`flex flex-col justify-between py-7 ${
        hasBorderLeft
          ? 'px-6 border-l border-[#e6e3e3]'
          : 'pl-0 pr-6 border-l-0'
      }`}
    >
      <div className="font-['Spectral',serif] text-6xl lg:text-[72px] font-light text-[#080808] leading-none tracking-[-0.04em] mb-4 tabular-nums">
        {count}
        {suffix}
      </div>
      <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#8f8b85]">
        {label}
      </div>
    </div>
  );
}

const INVESTORS = [
  {
    name: 'SUMMIT CAPITAL',
    svg: '/assets/company/investor_summit.svg',
    width: 182,
    height: 68,
  },
  {
    name: 'Northpoint',
    svg: '/assets/company/investor_northpoint.svg',
    width: 196,
    height: 44,
  },
  {
    name: 'Monument Partners',
    svg: '/assets/company/investor_monument.svg',
    width: 182,
    height: 64,
  },
];

const LEADERSHIP = [
  {
    name: 'Mahipal Choudhary',
    role: 'Founder & CEO',
    image: '/assets/company/mahipal_founder.jpg',
  },
  {
    name: 'John Carver',
    role: 'Co-Founder',
    image: '/assets/company/lateral_john.jpg',
  },
  {
    name: 'Sophie Green',
    role: 'CTO',
    image: '/assets/company/lateral_sophie.jpg',
  },
  {
    name: 'Jo West',
    role: 'VP Product',
    image: '/assets/company/lateral_jo.jpg',
  },
];

const OPEN_ROLES = [
  {
    title: 'Lead Chromium & C++ Engine Engineer',
    type: 'FULL TIME',
    location: 'Remote / London, UK',
    href: `mailto:${BRAND.officialEmail}?subject=Job%20Application:%20Lead%20Chromium%20%26%20C%2B%2B%20Engine%20Engineer`,
  },
  {
    title: 'Lead Anti-Detect & Fingerprint Researcher',
    type: 'FULL TIME',
    location: 'Remote / San Francisco, CA',
    href: `mailto:${BRAND.officialEmail}?subject=Job%20Application:%20Lead%20Anti-Detect%20%26%20Fingerprint%20Researcher`,
  },
  {
    title: 'Full Stack Engineer (TypeScript, Next.js, Rust)',
    type: 'FULL TIME',
    location: 'Remote',
    href: `mailto:${BRAND.officialEmail}?subject=Job%20Application:%20Full%20Stack%20Engineer`,
  },
  {
    title: 'Head of Enterprise Sales & Agency Fleets',
    type: 'FULL TIME',
    location: 'San Francisco, CA',
    href: `mailto:${BRAND.officialEmail}?subject=Job%20Application:%20Head%20of%20Enterprise%20Sales`,
  },
  {
    title: 'Media Operations & Growth Fleet Specialist',
    type: 'FULL TIME',
    location: 'London, UK',
    href: `mailto:${BRAND.officialEmail}?subject=Job%20Application:%20Media%20Operations%20Specialist`,
  },
];

export default function CompanyView() {
  return (
    <div className="min-h-screen bg-[#030303] text-[#ededed] selection:bg-white selection:text-black">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: EXACT LATERAL FRAMER TEMPLATE HERO                      */}
      {/* ========================================================================= */}
      <section className="relative w-full min-h-[90vh] sm:min-h-screen flex items-center justify-center text-center overflow-hidden bg-[#030303] pt-24 pb-16">
        
        {/* Background Photo with Subtle Dark Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/assets/company/hero_walking.jpg"
            alt="MAHI Browser Engineering Team & Vision"
            fill
            className="object-cover object-center opacity-40 filter contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-[#030303]/80" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-10 flex flex-col items-center">
          
          {/* Eyebrow Pill Announcement */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs sm:text-[13px] font-medium text-white backdrop-blur-md transition-all hover:bg-white/20 mb-8"
          >
            <span>MAHI Browser v2.0 Released • Dual-Engine Architecture</span>
            <span className="text-zinc-400">→</span>
          </Link>

          {/* Headline in Spectral Serif */}
          <h1 className="font-['Spectral',serif] text-4xl sm:text-6xl lg:text-[76px] font-light tracking-[-0.04em] leading-[1.06] text-white max-w-4xl mb-6">
            Powering the<br />
            <span className="italic text-zinc-300 font-light">Future of Anti-Detect</span>
          </h1>

          {/* Subtitle */}
          <p className="text-white/70 text-base sm:text-lg lg:text-[19px] max-w-xl font-normal leading-relaxed mb-10 text-center">
            We're building the undetectable dual-engine browser for multi-account operators and enterprise fleets.
          </p>

          {/* White Pill Action Button */}
          <div>
            <Link
              href="#careers"
              className="inline-flex items-center justify-center rounded-full bg-white text-black px-7 py-3 text-sm font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-lg shadow-white/10"
            >
              Join Us
            </Link>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. INTRO SECTION ("OUR MISSION" & ANIMATED COUNT-UP STATS)                */}
      {/* ========================================================================= */}
      <section className="w-full py-28 bg-[#f9f9f9] text-[#030303]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10">
          
          {/* Exact Inner Container with Left Border Gutter Line */}
          <div className="w-full pl-6 sm:pl-8 border-l border-[#e6e3e3] space-y-24">
            
            {/* Mission Statement Content Block */}
            <div className="max-w-[600px] space-y-8">
              
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block"></span>
                <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                  OUR MISSION
                </span>
              </div>

              {/* Mission Sentences in Exact Sentient/Spectral Serif */}
              <div className="space-y-6">
                <h2 className="font-['Spectral',serif] text-2xl sm:text-[28px] font-light leading-[1.2] tracking-[-0.03em] text-[#030303]">
                  We're building MAHI Browser to transform how multi-account operators and growth fleets scale. Our dual-engine architecture delivers authentic mathematical fingerprint entropy and 100% C++ stealth—so growth teams can run hundreds of accounts without fear of bans or detection.
                </h2>
                <p className="font-['Spectral',serif] text-2xl sm:text-[28px] font-light leading-[1.2] tracking-[-0.03em] text-[#969290]">
                  MAHI Browser's mission is to empower exceptional digital operators worldwide. We make this a reality by eliminating browser fingerprint anomalies, blocking CDP automation leaks, and putting enterprise privacy back in your hands.
                </p>
              </div>

            </div>

            {/* Exact Metric Cards with Live Count-Up Animation & Vertical Dividers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 max-w-[1328px]">
              {STATS.map((stat, idx) => (
                <StatCounter
                  key={stat.label}
                  target={stat.target}
                  suffix={stat.suffix}
                  label={stat.label}
                  hasBorderLeft={idx !== 0}
                />
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. INVESTORS SECTION (EXACT LATERAL SVG LOGO CARDS & TALL ASPECT RATIO)   */}
      {/* ========================================================================= */}
      <section className="w-full py-28 bg-[#030303] text-white">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10">
          
          {/* Inner Container with Left Border Gutter Line */}
          <div className="w-full pl-6 sm:pl-8 border-l border-white/10 space-y-16">
            
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block"></span>
                <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                  INVESTORS
                </span>
              </div>
              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[52px] font-light text-white leading-[1.2] tracking-[-0.04em] max-w-[680px] mb-4">
                Backed by World-<br className="hidden sm:inline" />Class Investors
              </h2>
              <p className="text-white/60 text-base leading-[1.4] tracking-[-0.01em] max-w-[480px]">
                MAHI Browser is supported by leading venture partners, anti-detect engineering advisors, and web security specialists.
              </p>
            </div>

            {/* 3 Tall Luxury Investor Cards with Exact SVG Logos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-[1380px]">
              {INVESTORS.map((inv) => (
                <div
                  key={inv.name}
                  className="rounded-[6px] bg-[#131517] h-[260px] sm:h-[320px] lg:h-[388px] flex items-center justify-center p-8 hover:bg-[#181a1d] transition-colors duration-300"
                >
                  <Image
                    src={inv.svg}
                    alt={inv.name}
                    width={inv.width}
                    height={inv.height}
                    className="max-w-[70%] max-h-[45%] object-contain opacity-90 hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. LEADERSHIP TEAM (MAHIPAL CHOUDHARY + 1:1 LATERAL 4 PORTRAIT GRID)       */}
      {/* ========================================================================= */}
      <section className="w-full py-28 bg-[#030303] text-white border-t border-white/10">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10">
          
          {/* Inner Container with Left Border Gutter Line */}
          <div className="w-full pl-6 sm:pl-8 border-l border-white/10 space-y-16">
            
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block"></span>
                <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                  LEADERSHIP
                </span>
              </div>
              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[52px] font-light text-white leading-[1.2] tracking-[-0.04em] max-w-[680px] mb-4">
                Built by Operators<br className="hidden sm:inline" />and AI Experts
              </h2>
              <p className="text-white/60 text-base leading-[1.4] tracking-[-0.01em] max-w-[480px]">
                The MAHI Browser team combines expertise from Chromium kernel engineering, C++ Camoufox modifications, and advanced browser fingerprint synthesis to create an undetectable browsing fleet.
              </p>
            </div>

            {/* 4 Portrait Cards: 2 Men on Left (Mahipal Choudhary, John Carver), 2 Ladies on Right (Sophie Green, Jo West) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1380px]">
              {LEADERSHIP.map((leader) => (
                <div key={leader.name} className="group flex flex-col">
                  <div className="relative w-full aspect-square rounded-[6px] overflow-hidden bg-[#131517] mb-3">
                    <Image
                      src={leader.image}
                      alt={leader.name}
                      fill
                      className="object-cover object-center group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                    />
                  </div>
                  <div className="text-[14px] font-normal text-white tracking-[-0.01em]">
                    {leader.name}
                  </div>
                  <div className="text-[12px] font-normal text-white/60 tracking-[-0.01em] mt-0.5">
                    {leader.role}
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. CAREERS & OPEN ROLES (EXACT LATERAL LIGHT THEME #f9f9f9)                */}
      {/* ========================================================================= */}
      <section id="careers" className="w-full py-28 bg-[#f9f9f9] text-[#030303]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10">
          
          {/* Inner Container with Left Border Gutter Line */}
          <div className="w-full pl-6 sm:pl-8 border-l border-[#e6e3e3] space-y-20">
            
            {/* Careers Header */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block"></span>
                <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                  CAREERS
                </span>
              </div>
              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[52px] font-light text-[#030303] leading-[1.2] tracking-[-0.04em] max-w-[680px] mb-4">
                Help Build the Future<br className="hidden sm:inline" />of Anti-Detect
              </h2>
              <p className="text-[#555555] text-base leading-[1.4] tracking-[-0.01em] max-w-[480px]">
                We’re seeking talented individuals who want to build a category-defining company. If that’s you, come join us.
              </p>
            </div>

            {/* Wide Cinematic Conference Keynote Banner (Exact 16:9 Lateral Banner) */}
            <div className="relative w-full max-w-[1380px] aspect-[16/9] rounded-[6px] overflow-hidden bg-black shadow-2xl">
              <Image
                src="/assets/company/mahi_conference_banner.jpg"
                alt="MAHI BROWSER Keynote Conference - Manage Multiple Identities Without Detection"
                fill
                className="object-cover object-center"
              />
            </div>

            {/* Vacancies / Open Roles Section (Exact 1:1 Lateral Measurements & Black Pill Buttons) */}
            <div className="space-y-12 max-w-[1380px]">
              <div>
                <div className="inline-flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block"></span>
                  <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                    VACANCIES
                  </span>
                </div>
                <h3 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[52px] font-light leading-[1.18] tracking-[-0.04em] text-[#080808] mb-3">
                  Open Roles
                </h3>
                <p className="text-[#636363] text-base leading-[1.4] tracking-[-0.01em] max-w-xl">
                  Join our core team of world-class engineers and researchers who are shaping the future of undetectable anti-detect browsing.
                </p>
              </div>

              {/* Roles Table (Exact Lateral Flex Columns + Black Pill Buttons) */}
              <div className="border-t border-[#e6e3e3]">
                {OPEN_ROLES.map((role) => (
                  <div
                    key={role.title}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-6 border-b border-[#e6e3e3] hover:bg-black/[0.015] px-2 -mx-2 transition-colors duration-150 gap-4 sm:gap-0"
                  >
                    {/* Job Title */}
                    <div className="sm:flex-1 pr-4">
                      <Link
                        href={role.href}
                        className="text-[15px] font-normal text-[#080808] hover:text-black transition-colors"
                      >
                        {role.title}
                      </Link>
                    </div>

                    {/* Type */}
                    <div className="sm:w-[160px] text-left">
                      <span className="font-mono text-[11px] font-normal uppercase tracking-[0.05em] text-[#969290]">
                        {role.type}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="sm:w-[220px] text-left">
                      <span className="text-[12px] font-normal text-[#636363]">
                        {role.location}
                      </span>
                    </div>

                    {/* Button */}
                    <div className="sm:w-[120px] flex sm:justify-end">
                      <Link
                        href={role.href}
                        className="inline-flex items-center justify-center rounded-full bg-[#030303] text-white px-5 py-2 text-[14px] font-normal transition-colors hover:bg-zinc-800 shadow-sm"
                      >
                        View Job
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Employee Quote Card (Placed Below Vacancies in Obsidian Dark #131517) */}
            <div className="rounded-[6px] bg-[#131517] overflow-hidden p-3 grid grid-cols-1 lg:grid-cols-2 max-w-[1380px] gap-6 lg:gap-12 items-center">
              <div className="relative aspect-[4/3] w-full rounded-[4px] overflow-hidden">
                <Image
                  src="/assets/company/quote_team.jpg"
                  alt="James Hunter at MAHI Browser"
                  fill
                  className="object-cover object-center"
                />
              </div>
              <div className="py-8 sm:py-12 lg:py-14 px-4 sm:px-8 lg:px-6 flex flex-col justify-between h-full">
                <blockquote className="font-['Spectral',serif] text-xl sm:text-2xl lg:text-[24px] font-light leading-[1.3] text-white tracking-[-0.03em]">
                  "I love working with a world-class team where people are passionate, unbelievably driven, and genuinely care about what they’re doing."
                </blockquote>
                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="text-[14px] font-normal text-white">
                    James Hunter
                  </div>
                  <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290] mt-1">
                    BROWSER CORE ENGINEER
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
}
