import React from 'react';
import Link from 'next/link';
import { BRAND } from '../lib/brand';
import FingerprintPreview from '../components/FingerprintPreview';
import FaqAccordion from '../components/FaqAccordion';
import PricingTable from '../components/PricingTable';

export default function HomePage() {
  return (
    <div className="w-full space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 lg:pt-28 pb-12">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-4 py-1.5 text-xs font-semibold text-red-300">
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span>MAHI Browser v{BRAND.version} Released</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-300">Chromium 138 + Camoufox Dual-Engine</span>
          </div>

          {/* Heading */}
          <h1 className="mx-auto max-w-5xl text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            The Undetectable <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-red-500 via-red-400 to-amber-300 bg-clip-text text-transparent">
              Dual-Engine Anti-Detect
            </span>{' '}
            Browser
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-3xl text-base sm:text-xl text-slate-300 leading-relaxed font-normal">
            Bypass Cloudflare Turnstile, DataDome, and CreepJS with zero leaks. Built with C++ native hooks,{' '}
            <strong className="text-white font-semibold">rebrowser-patches</strong> CDP isolation, offline SQLite architecture, and Redis-locked team profile synchronization.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/download"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-8 py-4 text-base font-bold text-white shadow-xl shadow-red-900/40 transition hover:from-red-500 hover:to-red-600 active:scale-[0.99]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Free (15 Profiles)
            </Link>
            <Link
              href="/compare/gologin-alternative"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-6 py-4 text-base font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
            >
              Compare vs GoLogin
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Trust Stats Bar */}
          <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">0.0%</div>
              <div className="text-xs text-slate-400 mt-1">CreepJS Detection Score</div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">Dual Engine</div>
              <div className="text-xs text-slate-400 mt-1">Chromium 138 + Camoufox</div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">Zero CDP Leak</div>
              <div className="text-xs text-slate-400 mt-1">Rebrowser Patches Core</div>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-red-400">0% UPI Fee</div>
              <div className="text-xs text-slate-400 mt-1">Direct Bank QR Activation</div>
            </div>
          </div>
        </div>
      </section>

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
                  <h3 className="text-xl font-bold text-white">Chromium 138 C++ Engine</h3>
                  <p className="text-xs text-slate-400">Patched Blink / V8 Core</p>
                </div>
              </div>
              <span className="rounded bg-red-950 border border-red-800/60 px-2.5 py-1 text-xs font-bold text-red-300">
                Default
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Equipped with our native C++ ANGLE hooks, Client Hints major-version normalizer, and integrated rebrowser-patches. Eliminates CDP debugger leaks and delivers flawless browser coherence.
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
              When targets specifically watch for Chromium signatures, switch to Camoufox with one click. Built with native C++ hooks directly inside Gecko for Canvas, AudioContext, Font enumeration, and WebRTC.
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
  );
}
