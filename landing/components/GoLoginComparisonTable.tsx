'use client';

import React from 'react';
import Link from 'next/link';
import { BRAND } from '../lib/brand';

interface ComparisonFeature {
  feature: string;
  category: string;
  mahi: { value: string; highlight?: boolean };
  gologin: { value: string };
  adspower: { value: string };
  multilogin: { value: string };
}

const COMPARISON_DATA: ComparisonFeature[] = [
  // Browser Engine & Core
  {
    category: 'Browser Engine & Core',
    feature: 'Chromium Engine Version',
    mahi: { value: 'Chromium 138.0.7204.0 (MV3 Main-World Stealth)', highlight: true },
    gologin: { value: 'Orbita (Chromium 132 - Outdated)' },
    adspower: { value: 'SunBrowser (Chromium 130)' },
    multilogin: { value: 'Mimic (Chromium 126)' },
  },
  {
    category: 'Browser Engine & Core',
    feature: 'Dual Engine Architecture',
    mahi: { value: 'Chromium 138 + Camoufox C++ Firefox', highlight: true },
    gologin: { value: 'Orbita (Chromium Only)' },
    adspower: { value: 'Chromium + Basic Firefox' },
    multilogin: { value: 'Chromium + Basic Firefox' },
  },

  // Anti-Detect & Stealth Technology
  {
    category: 'Anti-Detect & Stealth Technology',
    feature: 'CDP Runtime Leak Elimination',
    mahi: { value: 'Integrated Rebrowser-Patches (Zero CDP Artifacts)', highlight: true },
    gologin: { value: 'Partial / Standard CDP Flags (Leaks on Runtime.enable)' },
    adspower: { value: 'Basic Chrome Flags' },
    multilogin: { value: 'Proprietary Flags (Leaks on modern tests)' },
  },
  {
    category: 'Anti-Detect & Stealth Technology',
    feature: 'CreepJS Detection Benchmark',
    mahi: { value: '0.0% Detection (A+ Clean Score)', highlight: true },
    gologin: { value: '14.2% - 22% Detection (Flags Canvas/WebGL)' },
    adspower: { value: '18% - 30% Detection' },
    multilogin: { value: '15% - 25% Detection' },
  },
  {
    category: 'Anti-Detect & Stealth Technology',
    feature: 'Hooking Mechanism',
    mahi: { value: 'MV3 Main-World Stealth + Coherent Mathematical Noise', highlight: true },
    gologin: { value: 'JavaScript Prototype Injections' },
    adspower: { value: 'JS Prototype Injections' },
    multilogin: { value: 'Hybrid C++ & JS' },
  },
  {
    category: 'Anti-Detect & Stealth Technology',
    feature: 'Human Interaction Emulation',
    mahi: { value: 'Bézier Human Curves + Natural Typing Cadence', highlight: true },
    gologin: { value: 'Basic Random Delays' },
    adspower: { value: 'Linear Delays' },
    multilogin: { value: 'Basic Mouse Shuffler' },
  },

  // Data & Architecture
  {
    category: 'Data & Architecture',
    feature: 'Offline Mode (Air-Gapped)',
    mahi: { value: '100% Local SQLite Storage (Zero Server Reliance)', highlight: true },
    gologin: { value: 'No (Mandatory Cloud Dependency)' },
    adspower: { value: 'No (Cloud Only)' },
    multilogin: { value: 'No (Cloud Only)' },
  },
  {
    category: 'Data & Architecture',
    feature: 'Distributed Multi-Device Locks',
    mahi: { value: 'Redis Concurrency Mutex + R2 Session Sync', highlight: true },
    gologin: { value: 'Cloud Lock (Frequent Overwrites)' },
    adspower: { value: 'Seat Lock (Session Collision)' },
    multilogin: { value: 'Basic Cloud Lock' },
  },

  // Pricing & Support
  {
    category: 'Pricing & Support',
    feature: 'Starting Price',
    mahi: { value: 'Free Starter (15 Profiles) / From ₹299 ($4)/mo', highlight: true },
    gologin: { value: '$24 / month (No Free Tier)' },
    adspower: { value: '$9 / month' },
    multilogin: { value: '€99 / month (~$108)' },
  },
  {
    category: 'Pricing & Support',
    feature: 'Instant UPI (India) 0% Fee',
    mahi: { value: 'Yes (Dynamic QR: 6375823589@slc)', highlight: true },
    gologin: { value: 'No (Credit Card Only + FX Fees)' },
    adspower: { value: 'Third-party gateway only' },
    multilogin: { value: 'No (Credit Card Only)' },
  },
  {
    category: 'Pricing & Support',
    feature: 'Direct WhatsApp Line',
    mahi: { value: 'Yes (24/7 Priority WhatsApp)', highlight: true },
    gologin: { value: 'No (Standard Ticket Queue)' },
    adspower: { value: 'Telegram bot only' },
    multilogin: { value: 'Email support only' },
  },
];

export default function GoLoginComparisonTable() {
  const categories = Array.from(new Set(COMPARISON_DATA.map((item) => item.category)));

  return (
    <div className="w-full space-y-8">
      {/* Table Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-black/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-black inline-block"></span>
            <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-500">
              HEAD-TO-HEAD MATRIX
            </span>
          </div>
          <h3 className="font-['Spectral',serif] text-2xl sm:text-3xl font-normal text-[#0a0a0a] tracking-[-0.01em]">
            Technical Capability Benchmark
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-xl font-normal">
            Side-by-side engineering comparison across browser engine versions, anti-fingerprinting hooks, automation stealth, and enterprise pricing.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[11px] font-mono text-zinc-600 bg-white px-3.5 py-1.5 rounded-full border border-black/10 shadow-sm">
            Updated November 2026 • Verified Benchmarks
          </span>
        </div>
      </div>

      {/* Clean Luxury Light Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-[0_4px_30px_rgba(0,0,0,0.04)]">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-black/10 bg-zinc-50/90 text-zinc-600">
              <th className="p-4 sm:p-5 font-semibold text-zinc-700 text-xs tracking-wider uppercase min-w-[200px]">
                Technical Capability
              </th>
              {/* Highlighted MAHI Browser Column */}
              <th className="p-4 sm:p-5 font-semibold text-zinc-900 bg-red-50/40 border-x border-red-200/50 min-w-[240px]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 tracking-tight">MAHI Browser v{BRAND.version}</span>
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
                    BEST
                  </span>
                </div>
              </th>
              <th className="p-4 sm:p-5 font-medium text-zinc-600 min-w-[170px]">
                GoLogin (Orbita)
              </th>
              <th className="p-4 sm:p-5 font-medium text-zinc-600 min-w-[160px]">
                AdsPower
              </th>
              <th className="p-4 sm:p-5 font-medium text-zinc-600 min-w-[160px]">
                Multilogin
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {categories.map((category) => {
              const rows = COMPARISON_DATA.filter((r) => r.category === category);
              return (
                <React.Fragment key={category}>
                  {/* Category Section Row */}
                  <tr className="bg-zinc-100/70 border-t border-b border-black/5">
                    <td colSpan={5} className="py-2.5 px-4 sm:px-5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-red-600"></span>
                        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-700 font-semibold">
                          {category}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Category Data Rows */}
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="transition-colors duration-150 hover:bg-zinc-50/70"
                    >
                      <td className="p-4 sm:p-5 font-normal text-zinc-800 align-middle">
                        <div className="font-semibold text-zinc-900 text-xs sm:text-[13px]">{row.feature}</div>
                        <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{row.category}</div>
                      </td>

                      {/* MAHI Highlighted Column */}
                      <td className="p-4 sm:p-5 font-medium text-zinc-900 bg-red-50/30 border-x border-red-200/40 align-middle">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <span className="text-xs sm:text-[13px] font-semibold text-zinc-900 leading-snug">{row.mahi.value}</span>
                        </div>
                      </td>

                      <td className="p-4 sm:p-5 text-zinc-600 text-xs sm:text-[13px] align-middle font-light">
                        {row.gologin.value}
                      </td>
                      <td className="p-4 sm:p-5 text-zinc-600 text-xs sm:text-[13px] align-middle font-light">
                        {row.adspower.value}
                      </td>
                      <td className="p-4 sm:p-5 text-zinc-600 text-xs sm:text-[13px] align-middle font-light">
                        {row.multilogin.value}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Migration / Switch Callout Bar (Dark Luxury Contrast Banner) */}
      <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-[#0c0c0c] text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
              Zero-Downtime Migration
            </span>
          </div>
          <h4 className="font-['Spectral',serif] text-xl sm:text-2xl font-normal text-white tracking-tight">
            Ready to switch to undetectable dual-engine stealth?
          </h4>
          <p className="text-xs sm:text-[13.5px] text-zinc-400 leading-relaxed font-light">
            Import your GoLogin, AdsPower, or Multilogin profiles in one click via Universal Bulk Importer. Proxies, cookies, and fingerprint headers map automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/download?auto=true"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-6 py-2.5 text-xs sm:text-[13px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Free (15 Profiles)
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs sm:text-[13px] font-medium text-zinc-200 transition-all duration-200 hover:bg-white/10 hover:text-white"
          >
            Compare Plans &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
