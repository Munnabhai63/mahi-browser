import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'Testing Methodology & Anti-Detect Benchmarks — MAHI Browser',
  description:
    'Public disclosure of MAHI Browser testing methodology, benchmark results across CreepJS, Pixelscan, and IPHEY, and dual-engine stealth verification.',
  openGraph: {
    title: 'Testing Methodology & Anti-Detect Benchmarks — MAHI Browser',
    description:
      'Public disclosure of MAHI Browser testing methodology, benchmark results across CreepJS, Pixelscan, and IPHEY, and dual-engine stealth verification.',
  },
};

export default function MethodologyPage() {
  return (
    <div className="relative min-h-screen bg-[#080808] text-white">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#e11d48]/20 via-[#be123c]/10 to-transparent blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-16">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            PUBLIC DISCLOSURE &bull; HOW WE TEST
          </div>
          <h1 className="font-['Spectral',serif] text-3xl sm:text-5xl font-light tracking-tight text-zinc-100">
            Testing Methodology &amp; Benchmarks
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl leading-relaxed">
            Anti-bot detection is an adversarial, rapidly shifting discipline. We do not make mathematically impossible claims of &ldquo;100% permanent undetectability.&rdquo; Instead, we hold our engineering to rigorous empirical standards, verified continuously against independent benchmark suites and live bot defenses.
          </p>
          <div className="text-xs font-mono text-zinc-500 pt-2">
            Last Updated: {BRAND.legal.lastUpdated} &bull; Document Version: 1.2.1
          </div>
        </div>

        {/* 1. Core Testing Philosophy */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-['Spectral',serif] font-normal text-zinc-100">
              1. Empirical Verification Over Marketing Hyperbole
            </h2>
            <div className="h-0.5 w-12 bg-red-600/80 rounded" />
          </div>
          <div className="text-sm sm:text-[15px] text-zinc-300 leading-relaxed space-y-4">
            <p>
              In the anti-detect industry, products frequently advertise &ldquo;100% ban-proof&rdquo; or &ldquo;zero-detection guarantees.&rdquo; In practical security engineering, detection systems like Cloudflare Turnstile, DataDome, Akamai, and Kasada use continuous behavioral telemetry, IP reputation scoring, and heuristic machine learning.
            </p>
            <p>
              MAHI Browser operates on a principle of total transparency. Our stealth layer guarantees browser identity coherence&mdash;ensuring that every DOM attribute, prototype descriptor, WebGL context, and TCP/TLS fingerprint aligns with real-world consumer operating systems without prototype leaks or script execution traces.
            </p>
          </div>
        </section>

        {/* 2. Measured Benchmark Results */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-['Spectral',serif] font-normal text-zinc-100">
              2. Lab Verification Matrix &amp; Test Suites
            </h2>
            <div className="h-0.5 w-12 bg-red-600/80 rounded" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* CreepJS Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">CreepJS</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  99.4%+ PASS
                </span>
              </div>
              <div className="text-2xl font-['Spectral',serif] font-normal text-white">
                Zero Prototype Lies
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tested against CreepJS prototype poisoning tests. JavaScript proxies on <code className="text-zinc-200">navigator</code>, <code className="text-zinc-200">screen</code>, and <code className="text-zinc-200">plugins</code> preserve native prototype chains and native descriptor attributes without detection traces.
              </p>
            </div>

            {/* Pixelscan Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Pixelscan</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  Consistent
                </span>
              </div>
              <div className="text-2xl font-['Spectral',serif] font-normal text-white">
                Coherent Persona
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Display metrics, WebGL unmasked vendor/renderer, system font distributions, and client hints adhere strictly to the target operating system persona without cross-platform inconsistencies.
              </p>
            </div>

            {/* IPHEY Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">IPHEY</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  Authentic
                </span>
              </div>
              <div className="text-2xl font-['Spectral',serif] font-normal text-white">
                Hardware Alignment
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Audits WebRTC IP isolation, TCP/IP stack fingerprints (p0f SYN packet signatures), and TLS JA4 fingerprint consistency to ensure total transport-layer and application-layer harmony.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Dual-Engine Architecture */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-['Spectral',serif] font-normal text-zinc-100">
              3. Dual-Engine Isolation Standards
            </h2>
            <div className="h-0.5 w-12 bg-red-600/80 rounded" />
          </div>
          <div className="text-sm sm:text-[15px] text-zinc-300 leading-relaxed space-y-4">
            <p>
              Different websites employ radically different bot detection methodologies. A single browser engine cannot counter all detection techniques equally. MAHI Browser implements an architectural dual-engine design:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-3">
                <h3 className="font-semibold text-white text-base">Chromium 138 (JavaScript MV3 Stealth)</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Utilizes a pinned Chromium 138 stock-snapshot engine with Rebrowser-Patches to eliminate DevTools protocol <code className="text-zinc-200">Runtime.enable</code> execution leaks. Deterministic sub-pixel math applies noise to Canvas and WebGL contexts while preserving visual crispness.
                </p>
              </div>
              <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-3">
                <h3 className="font-semibold text-white text-base">Camoufox C++ Hardened Engine</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  For extreme adversarial targets, MAHI Browser loads an on-demand C++ level hardened engine. Because spoofing occurs inside compiled C++ browser primitives rather than JavaScript wrappers, detection scripts cannot inspect function origins or proxy wrappers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Automated Quality Gates */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-['Spectral',serif] font-normal text-zinc-100">
              4. Continuous Integration &amp; Security Gates
            </h2>
            <div className="h-0.5 w-12 bg-red-600/80 rounded" />
          </div>
          <div className="text-sm sm:text-[15px] text-zinc-300 leading-relaxed space-y-3">
            <p>
              Every production build must satisfy our deterministic multi-gate CI pipeline before release:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 text-xs sm:text-sm pl-2">
              <li>
                <strong className="text-zinc-200">1237+ Unit &amp; Integration Tests:</strong> Covering payment security, terms consent tracking, password hashing (scrypt-v1), webhook forgery prevention, and distributed Redis profile locks.
              </li>
              <li>
                <strong className="text-zinc-200">Strict Provenance Stamping:</strong> Every installer embeds a signed <code className="text-zinc-200">build-info.json</code> detailing git commit SHA, bundled engine version, and verification metadata.
              </li>
              <li>
                <strong className="text-zinc-200">Cryptographic SHA-512 Verification:</strong> Release pipelines compare the downloaded binaries byte-for-byte against <code className="text-zinc-200">latest.yml</code> manifest checksums before auto-updater cutover.
              </li>
            </ul>
          </div>
        </section>

        {/* Footer CTA */}
        <div className="border-t border-zinc-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-zinc-500">
            Have questions about our testing benchmarks or wish to submit an audit? Contact{' '}
            <a href={`mailto:${BRAND.officialEmail}`} className="text-zinc-300 underline underline-offset-2">
              {BRAND.officialEmail}
            </a>
          </div>
          <Link
            href="/fingerprints"
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 transition-colors"
          >
            Explore Fingerprint Suite &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
