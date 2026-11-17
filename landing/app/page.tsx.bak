import React from 'react';
import Link from 'next/link';
import { BRAND } from '../lib/brand';
import FramerHeroAndIntro from '../components/FramerHeroAndIntro';
import FingerprintPreview from '../components/FingerprintPreview';
import FaqAccordion from '../components/FaqAccordion';
import PricingTable from '../components/PricingTable';

export default function HomePage() {
  return (
    <div className="w-full pb-20">
      {/* 100% Pixel-Perfect Framer Section 1 (Nav + Hero + Ticker) & Section 2 (Intro + Stats) */}
      <FramerHeroAndIntro />

      <div className="space-y-20 mt-20">
        {/* Interactive Fingerprint Preview */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FingerprintPreview />
      </section>

      {/* Dual Engine Section */}
      <section id="dual-engine" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
            Architecture Breakdown
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Why One Engine Is Never Enough
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-400">
            Anti-bot networks correlate execution traits across visits. MAHI Browser gives you two completely independent, native-level rendering engines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Chromium 138 Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-black">
                  Cr
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Chromium 138 Stealth Engine</h3>
                  <p className="text-xs text-slate-400">JavaScript MV3 Stealth Core (Native C++ Optional)</p>
                </div>
              </div>
              <span className="rounded bg-red-950 border border-red-800/60 px-2.5 py-1 text-xs font-bold text-red-300">
                Default
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Equipped with JavaScript-layer MV3 main-world stealth injection (canvas/audio/WebGL/timezone/client-hints coherence) and rebrowser-patches automation. Native C++ engine available as an optional, separately provisioned build.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Zero CDP Runtime.enable leak artifacts</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Mathematical Canvas noise without pixel drift</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Full WebGL GPU vendor/renderer spoofing</span>
              </li>
            </ul>
          </div>

          {/* Camoufox Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-black">
                  Fx
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Camoufox Gecko Engine</h3>
                  <p className="text-xs text-slate-400">Hardened C++ Firefox Fork</p>
                </div>
              </div>
              <span className="rounded bg-orange-950 border border-orange-800/60 px-2.5 py-1 text-xs font-bold text-orange-300">
                Anti-Correlation
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              When targets specifically watch for Chromium signatures, switch to Camoufox with one click. Built on a hardened C++ Firefox fork (downloaded on demand) with native Gecko hooks for Canvas, AudioContext, Font enumeration, and WebRTC.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Complete immunity against Chromium-specific heuristics</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>C++ level Audio and Font fingerprint injection</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Cookie Warmer and session healing integration</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
            Built for Power Users
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Enterprise Fleet Capabilities
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-400">
            Engineered for affiliate teams, media buyers, automated scrapers, and account managers who demand reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
              ⚡
            </div>
            <h3 className="font-bold text-lg text-white">Local-First Offline SQLite</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Never worry about downtime. All profiles, proxies, and tags are stored in an embedded SQLite engine. Runs completely offline without pinging cloud servers.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
              🔒
            </div>
            <h3 className="font-bold text-lg text-white">Distributed Concurrency Locks</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              When teams share profiles, our Fastify Cloud Gateway and Redis lock manager prevent double-launches, keeping session cookies safe and uncorrupted.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
              🍪
            </div>
            <h3 className="font-bold text-lg text-white">Built-in Cookie Warmer</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Warm up new browser profiles automatically across major search engines and social platforms using natural Bézier mouse curves and human typing cadences.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
              📥
            </div>
            <h3 className="font-bold text-lg text-white">Universal 1-Click Migration</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Import hundreds of profiles from GoLogin, AdsPower, Multilogin, or Dolphin Anty via JSON and CSV in seconds with automatic fingerprint normalisation.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
              🌐
            </div>
            <h3 className="font-bold text-lg text-white">Proxy Manager & Health Checks</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Real-time latency, geolocation, and IP leak testing for HTTP, SOCKS5, and residential proxies. Automatic proxy rotation upon connection failure.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
              🇮🇳
            </div>
            <h3 className="font-bold text-lg text-white">Zero-Fee Instant UPI</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Pay directly bank-to-bank with Indian UPI (VPA: 6375823589@slc). Zero payment gateway fees, instant license activation, and direct WhatsApp support.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section Teaser */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
            Transparent Plans
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Fair Pricing with Zero Hidden Fees
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-400">
            Start free with 15 offline profiles. Upgrade anytime for cloud backup, team collaboration, and automated RPA tasks.
          </p>
        </div>

        <PricingTable />
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Everything you need to know about MAHI Browser's stealth engine and deployment.
          </p>
        </div>

        <FaqAccordion />
      </section>

      {/* Bottom CTA Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-red-900/60 bg-gradient-to-r from-red-950/60 via-slate-950 to-red-950/60 p-8 sm:p-14 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/80 px-4 py-1.5 text-xs font-bold text-red-300">
            15 Free Offline Profiles Included
          </div>
          <h2 className="mx-auto max-w-3xl text-3xl sm:text-5xl font-black text-white tracking-tight">
            Take Control of Your Multi-Account Fleet Today
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-300">
            Download the desktop client now or start your 7-day Pro cloud trial with zero risk.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/download"
              className="w-full sm:w-auto rounded-xl bg-red-600 px-8 py-3.5 text-sm sm:text-base font-bold text-white transition hover:bg-red-500 shadow-xl shadow-red-900/40"
            >
              Download for Windows / Mac / Linux
            </Link>
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm sm:text-base font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Create Free Cloud Account
            </Link>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
