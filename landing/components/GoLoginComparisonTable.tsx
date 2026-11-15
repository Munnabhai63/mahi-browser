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
  {
    category: 'Browser Engine & Core',
    feature: 'Chromium Engine Version',
    mahi: { value: 'Chromium 138.0.7204.0 (Latest C++ Patched)', highlight: true },
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
    mahi: { value: 'Deep C++ Native Engine & ANGLE Overwrites', highlight: true },
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
    mahi: { value: 'Yes (+91 9376343629)', highlight: true },
    gologin: { value: 'No (Standard Ticket Queue)' },
    adspower: { value: 'Telegram bot only' },
    multilogin: { value: 'Email support only' },
  },
];

export default function GoLoginComparisonTable() {
  return (
    <div className="w-full space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300">
              <th className="p-4 sm:p-5 font-bold text-white min-w-[200px]">Technical Capability</th>
              <th className="p-4 sm:p-5 font-extrabold text-red-400 bg-red-950/30 border-x border-red-900/50 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <span>MAHI Browser v{BRAND.version}</span>
                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">BEST</span>
                </div>
              </th>
              <th className="p-4 sm:p-5 font-semibold text-slate-400 min-w-[160px]">GoLogin (Orbita)</th>
              <th className="p-4 sm:p-5 font-semibold text-slate-400 min-w-[150px]">AdsPower</th>
              <th className="p-4 sm:p-5 font-semibold text-slate-400 min-w-[150px]">Multilogin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {COMPARISON_DATA.map((row, idx) => (
              <tr key={idx} className="transition hover:bg-slate-900/30">
                <td className="p-4 sm:p-5 font-medium text-slate-300">
                  <div className="font-semibold text-white">{row.feature}</div>
                  <div className="text-[11px] text-slate-500">{row.category}</div>
                </td>
                <td className="p-4 sm:p-5 font-semibold text-emerald-400 bg-red-950/10 border-x border-red-900/30">
                  <div className="flex items-start gap-2">
                    <svg className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{row.mahi.value}</span>
                  </div>
                </td>
                <td className="p-4 sm:p-5 text-slate-400">{row.gologin.value}</td>
                <td className="p-4 sm:p-5 text-slate-400">{row.adspower.value}</td>
                <td className="p-4 sm:p-5 text-slate-400">{row.multilogin.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-red-900/40 bg-gradient-to-r from-red-950/40 to-slate-950 p-6">
        <div>
          <h4 className="font-bold text-white text-base">Ready to switch to undetectable dual-engine stealth?</h4>
          <p className="text-xs sm:text-sm text-slate-300">
            Import your GoLogin, AdsPower, or Multilogin profiles in one click via Universal Bulk Import.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/download"
            className="rounded-xl bg-red-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-red-500 shadow-lg shadow-red-900/30"
          >
            Download MAHI Browser Free
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
