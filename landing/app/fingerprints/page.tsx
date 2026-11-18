'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface FingerprintState {
  os: 'windows' | 'mac' | 'linux';
  engine: 'chromium' | 'camoufox';
  canvasHash: string;
  webglVendor: string;
  webglRenderer: string;
  audioSeed: number;
  audioFrequency: string;
  brands: { brand: string; version: string }[];
  resolution: string;
  memory: string;
  hardwareConcurrency: number;
  timezone: string;
  webrtcMode: string;
  creepJsScore: string;
}

const PRESETS: Record<string, FingerprintState> = {
  win_chrome: {
    os: 'windows',
    engine: 'chromium',
    canvasHash: 'e3b0c44298fc1c149afbf4c8996fb924',
    webglVendor: 'Google Inc. (NVIDIA)',
    webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    audioSeed: 1248912,
    audioFrequency: '124.81 Hz (±0.00012dB noise injection)',
    brands: [
      { brand: 'Not(A:Brand', version: '24' },
      { brand: 'Chromium', version: '138' },
      { brand: 'Google Chrome', version: '138' },
    ],
    resolution: '1920 x 1080 (24-bit color, 1.0 DPR)',
    memory: '16 GB',
    hardwareConcurrency: 16,
    timezone: 'Asia/Kolkata (IST, UTC+05:30)',
    webrtcMode: 'Force Proxy Routed (No Local IP Leak)',
    creepJsScore: '0.0% Detection (CreepJS A+ Grade)',
  },
  mac_camoufox: {
    os: 'mac',
    engine: 'camoufox',
    canvasHash: '9a72dfc4182b8813ef0298a0117b3d42',
    webglVendor: 'Apple Inc.',
    webglRenderer: 'Apple M3 Pro Metal Engine',
    audioSeed: 884719,
    audioFrequency: '98.42 Hz (Hardware oscillator jitter)',
    brands: [
      { brand: 'Firefox', version: '135' },
      { brand: 'Gecko', version: '20100101' },
    ],
    resolution: '2560 x 1440 (30-bit color, 2.0 DPR)',
    memory: '18 GB',
    hardwareConcurrency: 12,
    timezone: 'America/New_York (EST, UTC-05:00)',
    webrtcMode: 'Restricted Interface (ICE Filtered)',
    creepJsScore: '0.0% Detection (CreepJS A+ Grade)',
  },
  linux_chrome: {
    os: 'linux',
    engine: 'chromium',
    canvasHash: '43f87b2190ee01aa9945c711dfa467bc',
    webglVendor: 'Google Inc. (AMD)',
    webglRenderer: 'ANGLE (AMD, AMD Radeon RX 7900 XT Vulkan, radv)',
    audioSeed: 591024,
    audioFrequency: '112.19 Hz (Sub-audible perturbation)',
    brands: [
      { brand: 'Not(A:Brand', version: '24' },
      { brand: 'Chromium', version: '138' },
      { brand: 'Google Chrome', version: '138' },
    ],
    resolution: '2560 x 1080 (24-bit color, 1.0 DPR)',
    memory: '32 GB',
    hardwareConcurrency: 32,
    timezone: 'Europe/London (GMT, UTC+00:00)',
    webrtcMode: 'Strict Proxy Tunneling',
    creepJsScore: '0.0% Detection (CreepJS A+ Grade)',
  },
};

export default function FingerprintsPage() {
  const [activePresetKey, setActivePresetKey] = useState<string>('win_chrome');
  const [currentFp, setCurrentFp] = useState<FingerprintState>(PRESETS.win_chrome);
  const [isScrambling, setIsScrambling] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Track download event telemetry
  const trackDownload = () => {
    try {
      fetch('/api/v1/funnel/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'download_started', source: 'fingerprints_page' }),
      }).catch(() => {});
    } catch (_) {}
  };

  const handleSelectPreset = (key: string) => {
    setActivePresetKey(key);
    setCurrentFp(PRESETS[key]);
  };

  const handleRandomize = () => {
    setIsScrambling(true);
    setTimeout(() => {
      const randomSeed = Math.floor(Math.random() * 9000000) + 1000000;
      const hexChars = '0123456789abcdef';
      let randomHash = '';
      for (let i = 0; i < 32; i++) {
        randomHash += hexChars[Math.floor(Math.random() * hexChars.length)];
      }

      setCurrentFp((prev) => ({
        ...prev,
        canvasHash: randomHash,
        audioSeed: randomSeed,
        audioFrequency: `${(Math.random() * 50 + 90).toFixed(2)} Hz (±${(Math.random() * 0.0005).toFixed(5)}dB jitter)`,
      }));
      setIsScrambling(false);
    }, 250);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] selection:bg-white selection:text-black">
      
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: HARDWARE-LEVEL FINGERPRINT SPOOFING                      */}
      {/* ========================================================================= */}
      <section className="relative w-full pt-28 sm:pt-36 lg:pt-40 pb-16 overflow-hidden">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          {/* Left-Aligned Header Block with Subtle Vertical Guide Line */}
          <div className="relative border-l border-white/10 pl-4 sm:pl-5 max-w-xl lg:max-w-2xl flex flex-col items-start text-left">
            
            {/* Eyebrow Tag: ■ FINGERPRINT ENGINE */}
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-400 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
                FINGERPRINT ENGINE &amp; KERNEL SPOOFING
              </span>
            </div>

            {/* Exact Reference Proportional Serif Headline */}
            <h1 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[38px] xl:text-[42px] font-normal tracking-[-0.02em] leading-[1.12] text-white mb-3 sm:mb-3.5">
              Mathematical Precision.<br />
              <span className="whitespace-nowrap">Zero Pixel Drift.</span>
            </h1>

            {/* Compact Refined Subtitle */}
            <p className="text-zinc-400 text-xs sm:text-[13px] lg:text-[13.5px] leading-relaxed max-w-[440px] font-normal mb-5 sm:mb-6">
              Deterministic Canvas perturbation, native WebGL GPU vendor masking, and sub-audible audio jitter engineered at the C++ kernel level. Defeat CreepJS, Pixelscan, and Cloudflare Turnstile consistently.
            </p>

            {/* Dual Action Buttons Group */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/download?auto=true"
                onClick={trackDownload}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-5 py-2 text-xs sm:text-[13px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Free (15 Profiles)
              </Link>
              <Link
                href="/compare"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-700 bg-white/5 text-zinc-300 px-4 py-2 text-xs sm:text-[13px] font-medium transition-all duration-200 hover:bg-white/10 hover:text-white hover:border-zinc-500"
              >
                Compare vs GoLogin &rarr;
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SECTION 2: LIVE INTERACTIVE HARDWARE EMULATION LAB                     */}
      {/* ========================================================================= */}
      <section className="relative w-full pb-20 sm:pb-28">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          <div className="w-full rounded-2xl border border-white/10 bg-[#08090b] p-6 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-xl">
            
            {/* Top Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6 sm:pb-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-mono text-zinc-300 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE HARDWARE EMULATION LAB
                </div>
                <h3 className="text-xl sm:text-2xl font-['Spectral',serif] text-white tracking-tight">
                  Cryptographic Anti-Detect Engine Preview
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-lg">
                  Real-time inspection of low-level MV3 stealth hooks, C++ WebGL injection, and Canvas mathematical perturbations.
                </p>
              </div>

              {/* Preset Selector & Scramble Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('win_chrome')}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    activePresetKey === 'win_chrome'
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  Windows / Chrome 138
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset('mac_camoufox')}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    activePresetKey === 'mac_camoufox'
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  macOS / Camoufox
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset('linux_chrome')}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    activePresetKey === 'linux_chrome'
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  Linux / Vulkan
                </button>

                {/* Scramble Noise Button */}
                <button
                  type="button"
                  onClick={handleRandomize}
                  disabled={isScrambling}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition active:scale-95 flex items-center gap-1.5"
                >
                  <svg
                    className={`h-3.5 w-3.5 text-emerald-400 ${isScrambling ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{isScrambling ? 'Scrambling...' : 'Scramble Noise'}</span>
                </button>
              </div>
            </div>

            {/* Grid of Live Hardware Parameters */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              {/* Tile 1: Canvas & Noise */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Canvas Perturbation
                  </span>
                  <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400">
                    Noise Injected
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-200 break-all bg-black/80 p-2.5 rounded-lg border border-white/10">
                  Hash: {currentFp.canvasHash}
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Deterministic pixel-level mathematical variance preventing cross-profile tracking without visual drift errors.
                </p>
              </div>

              {/* Tile 2: WebGL GPU */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    WebGL Vendor &amp; Renderer
                  </span>
                  <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-mono text-zinc-300">
                    Native Mask
                  </span>
                </div>
                <div className="space-y-1 bg-black/80 p-2.5 rounded-lg border border-white/10 text-xs font-mono">
                  <div className="text-white font-medium truncate">{currentFp.webglVendor}</div>
                  <div className="text-zinc-400 truncate text-[11px]">{currentFp.webglRenderer}</div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Overwritten via C++ main-world WebGL hook before context initialization to prevent unmasked GPU enumeration.
                </p>
              </div>

              {/* Tile 3: AudioContext */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    AudioContext Frequency
                  </span>
                  <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400">
                    Seed: {currentFp.audioSeed}
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-200 bg-black/80 p-2.5 rounded-lg border border-white/10 truncate">
                  {currentFp.audioFrequency}
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  DynamicsCompressor and OfflineAudioContext response curve perturbed with sub-audible micro-jitter.
                </p>
              </div>

              {/* Tile 4: Client Hints */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Client Hints Brands
                  </span>
                  <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-mono text-zinc-300">
                    Sec-CH-UA
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 bg-black/80 p-2.5 rounded-lg border border-white/10">
                  {currentFp.brands.map((b, i) => (
                    <span key={i} className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-200">
                      &quot;{b.brand}&quot;: {b.version}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Strictly aligned with User-Agent major version and GREASE brands to pass Cloudflare Turnstile &amp; DataDome.
                </p>
              </div>

              {/* Tile 5: Hardware & Memory Profile */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Device Hardware Profile
                  </span>
                  <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[10px] font-mono text-zinc-300">
                    Coherent
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-black/80 p-2.5 rounded-lg border border-white/10 text-xs font-mono">
                  <div>RAM: <span className="text-white">{currentFp.memory}</span></div>
                  <div>Cores: <span className="text-white">{currentFp.hardwareConcurrency}</span></div>
                  <div className="col-span-2 text-[11px] text-zinc-400 truncate">{currentFp.resolution}</div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Device memory, CPU threads, and display metrics match actual hardware distributions without impossible pairings.
                </p>
              </div>

              {/* Tile 6: Verification Benchmark */}
              <div className="rounded-xl border border-white/15 bg-white/5 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-300">
                    CreepJS Benchmark Score
                  </span>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-mono font-medium text-emerald-300">
                    100% PASS
                  </span>
                </div>
                <div className="bg-black/80 p-2.5 rounded-lg border border-white/10 text-xs font-mono text-emerald-400 font-medium">
                  {currentFp.creepJsScore}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Pixelscan 100% Consistent &bull; IPHEY Authentic &bull; Rebrowser-Patches Runtime.Enable Leak Eliminated.
                </p>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SECTION 3: THE 8 CORE ATTACK VECTORS WE PROTECT (4x2 GRID)             */}
      {/* ========================================================================= */}
      <section className="relative w-full bg-[#f9f9f9] text-zinc-900 py-24 sm:py-32 border-t border-zinc-200/80">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          <div className="border-l border-zinc-300 pl-4 sm:pl-5 max-w-xl lg:max-w-2xl flex flex-col items-start text-left mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-900 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-500">
                ATTACK VECTORS COVERAGE
              </span>
            </div>
            <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[38px] xl:text-[42px] font-normal tracking-[-0.02em] leading-[1.12] text-zinc-950 mb-3.5">
              The 8 Fingerprint Vectors.<br />
              <span className="whitespace-nowrap">Protected End-to-End.</span>
            </h2>
            <p className="text-zinc-600 text-xs sm:text-[13px] lg:text-[13.5px] leading-relaxed max-w-[420px] font-normal">
              Modern anti-bot engines correlate multiple independent signals simultaneously. MAHI Browser isolates every single layer.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
            {[
              {
                num: '01',
                title: 'Canvas 2D Hash',
                desc: 'Alters getImageData and toDataURL with mathematical micro-noise that preserves rendering layout without revealing spoofing artifacts.',
              },
              {
                num: '02',
                title: 'WebGL 3D & Shaders',
                desc: 'Masks GPU vendors (NVIDIA, AMD, Apple Metal) and simulates ANGLE shader precision without leaking underlying hardware identifiers.',
              },
              {
                num: '03',
                title: 'AudioContext Oscillator',
                desc: 'Perturbs DynamicsCompressor and FFT frequency curves with unique random seeds to defeat audio fingerprint clustering.',
              },
              {
                num: '04',
                title: 'Client Hints & Sec-CH-UA',
                desc: 'Synchronizes HTTP headers, Navigator user-agent metadata, and GREASE brands to ensure 100% coherence across web requests.',
              },
              {
                num: '05',
                title: 'WebRTC Local IP Shield',
                desc: 'Strictly routes WebRTC STUN/TURN traffic through your bound residential proxy, completely blocking local IPv4/IPv6 address leakage.',
              },
              {
                num: '06',
                title: 'Fonts & Screen Metrics',
                desc: 'Matches system font lists, DPI scaling, viewport bounds, and color depth strictly to the target operating system persona.',
              },
              {
                num: '07',
                title: 'Hardware Concurrency',
                desc: 'Emulates realistic CPU core counts and navigator.deviceMemory distributions that perfectly mirror real commercial laptops and workstations.',
              },
              {
                num: '08',
                title: 'CDP & Rebrowser Patches',
                desc: 'Removes navigator.webdriver, eliminates Runtime.enable inspector traps, and passes all automated DevTools detection vectors.',
              },
            ].map((v, idx) => (
              <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-mono text-zinc-400 font-semibold">{v.num}</span>
                  <h4 className="text-base font-medium text-zinc-950 mt-2 mb-2">{v.title}</h4>
                  <p className="text-xs text-zinc-600 leading-relaxed font-normal">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECTION 4: THIRD-PARTY VERIFICATION SCORECARD                          */}
      {/* ========================================================================= */}
      <section className="relative w-full bg-[#050505] text-white py-24 sm:py-32 border-t border-white/5">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          <div className="max-w-2xl mx-auto flex flex-col items-center text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 mb-3.5">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-400 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
                INDEPENDENT VERIFICATION
              </span>
            </div>
            <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[40px] xl:text-[44px] font-normal tracking-[-0.02em] leading-[1.12] text-white mb-4">
              Tested on the World&apos;s Strictest Checkers
            </h2>
            <p className="text-zinc-400 text-xs sm:text-[13.5px] leading-relaxed max-w-[500px] font-normal">
              Every build of MAHI Browser is rigorously verified across leading anti-bot benchmarks to guarantee 100% authentic scoring.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-white/10 bg-[#0d0f12] p-6 flex flex-col items-center text-center">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">CreepJS Detection</span>
              <div className="font-['Spectral',serif] text-4xl text-white font-normal my-3">0.0%</div>
              <span className="text-[11px] font-mono text-emerald-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                A+ Rating &bull; Zero Lies
              </span>
              <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
                Zero prototype tampering traces detected on JavaScript navigator proxies.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d0f12] p-6 flex flex-col items-center text-center">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Pixelscan Consistency</span>
              <div className="font-['Spectral',serif] text-4xl text-white font-normal my-3">100%</div>
              <span className="text-[11px] font-mono text-emerald-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                Clean Persona &bull; No Flags
              </span>
              <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
                Display metrics, WebGL vendor, and font counts match target OS persona exactly.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d0f12] p-6 flex flex-col items-center text-center">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">IPHEY Hardware Authenticity</span>
              <div className="font-['Spectral',serif] text-4xl text-white font-normal my-3">Passed</div>
              <span className="text-[11px] font-mono text-emerald-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                Authentic Hardware
              </span>
              <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
                TCP/IP fingerprint (p0f) and TLS JA4 fingerprint correspond with target OS persona.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0d0f12] p-6 flex flex-col items-center text-center">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">BrowserLeaks WebRTC</span>
              <div className="font-['Spectral',serif] text-4xl text-white font-normal my-3">0 Leaks</div>
              <span className="text-[11px] font-mono text-emerald-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                Proxy Tunneling Strict
              </span>
              <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
                Host candidates disabled. STUN/TURN binding strictly enforces residential IP.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SECTION 5: TECHNICAL DEEP DIVE: C++ KERNEL VS JAVASCRIPT OVERRIDES     */}
      {/* ========================================================================= */}
      <section className="relative w-full bg-[#f9f9f9] text-zinc-900 py-24 sm:py-32 border-t border-zinc-200/80">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-20">
          
          <div className="border-l border-zinc-300 pl-4 sm:pl-5 max-w-xl lg:max-w-2xl flex flex-col items-start text-left mb-16">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-zinc-900 inline-block"></span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-500">
                ARCHITECTURE COMPARISON
              </span>
            </div>
            <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[38px] xl:text-[42px] font-normal tracking-[-0.02em] leading-[1.12] text-zinc-950 mb-3.5">
              Why C++ Kernel Spoofing<br />
              <span className="whitespace-nowrap">Beats Basic JS Injection</span>
            </h2>
            <p className="text-zinc-600 text-xs sm:text-[13px] lg:text-[13.5px] leading-relaxed max-w-[440px] font-normal">
              Most antidetect browsers inject simple JavaScript overrides (`Object.defineProperty`) which can be caught via `Function.prototype.toString` or iframe leaks. MAHI Browser modifies the browser at the source.
            </p>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-4 px-4 font-medium">Evaluation Criterion</th>
                  <th className="py-4 px-4 font-medium text-zinc-900">Standard Antidetect (JS Proxy)</th>
                  <th className="py-4 px-4 font-semibold text-black bg-zinc-200/60 rounded-t-lg">MAHI Browser (C++ Kernel)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                <tr>
                  <td className="py-4 px-4 font-medium text-zinc-900">Execution Layer</td>
                  <td className="py-4 px-4 text-zinc-500">JavaScript DOM Prototype Override</td>
                  <td className="py-4 px-4 font-medium text-black bg-zinc-200/30">C++ Source &amp; Native Engine Hooks</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium text-zinc-900">Iframe &amp; Worker Isolation</td>
                  <td className="py-4 px-4 text-red-600 font-medium">Leaks real GPU in Web Workers</td>
                  <td className="py-4 px-4 font-medium text-emerald-700 bg-zinc-200/30">100% Consistent in Workers &amp; Iframes</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium text-zinc-900">CDP Inspector Detection</td>
                  <td className="py-4 px-4 text-red-600 font-medium">Flagged via Runtime.enable</td>
                  <td className="py-4 px-4 font-medium text-emerald-700 bg-zinc-200/30">Zero CDP Leaks (Rebrowser Patches)</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium text-zinc-900">Canvas Drift Protection</td>
                  <td className="py-4 px-4 text-zinc-500">Random noise causes image distortion</td>
                  <td className="py-4 px-4 font-medium text-black bg-zinc-200/30">Deterministic mathematical perturbation</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium text-zinc-900">Secondary Engine Support</td>
                  <td className="py-4 px-4 text-zinc-500">Only Chromium</td>
                  <td className="py-4 px-4 font-medium text-black bg-zinc-200/30">Chromium 138 + Camoufox C++ Gecko</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. SECTION 6: INTERACTIVE FINGERPRINTING FAQ                              */}
      {/* ========================================================================= */}
      <section id="faq" className="bg-[#050505] text-white py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-10">
          
          <div className="flex flex-col items-center text-center gap-4 sm:gap-5 max-w-2xl mx-auto mb-16">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-[1px]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-zinc-400">
                FAQ
              </span>
            </div>

            <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[46px] font-normal text-white tracking-[-0.035em] leading-[1.18]">
              Frequently Asked Questions
            </h2>

            <p className="text-zinc-400 text-xs sm:text-[14px] leading-relaxed max-w-lg font-normal">
              Technical answers regarding MAHI Browser&apos;s low-level fingerprint emulation and anti-detect architecture.
            </p>
          </div>

          <div className="max-w-3xl mx-auto border-t border-white/10">
            {[
              {
                q: 'How does MAHI Browser prevent Canvas fingerprinting without breaking images?',
                a: 'MAHI Browser applies a deterministic sub-pixel mathematical perturbation to 2D canvas drawing routines. This alters the cryptographic hash calculated by anti-bot scripts while keeping user-visible renderings, charts, and captcha graphics 100% sharp and undistorted.',
              },
              {
                q: 'Can anti-bot networks detect that WebGL GPU information is masked?',
                a: 'Standard spoofers are detected because their UNMASKED_VENDOR_WEBGL returns a fake string while the underlying shader compilation engine still exposes the actual hardware driver. MAHI Browser alters both the renderer strings and the underlying ANGLE driver parameters to maintain perfect mathematical coherence.',
              },
              {
                q: 'How does WebRTC routing prevent local IP address leaks?',
                a: 'MAHI Browser enforces a strict proxy-bound WebRTC policy. All STUN/TURN host candidates that would otherwise expose your local LAN IPv4 or IPv6 address are stripped at the network socket layer, ensuring third-party servers only ever receive your residential proxy address.',
              },
              {
                q: 'What is the advantage of the Camoufox Gecko engine over standard Chromium?',
                a: 'Camoufox is a custom C++ hardened Gecko build specifically designed to defeat modern anti-bot systems like Cloudflare Turnstile and DataDome. Because its codebase is entirely distinct from Chromium, it does not share the same Blink execution patterns that security vendors look for.',
              },
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full py-6 flex items-center justify-between text-left gap-4 group"
                  >
                    <span className="text-[15px] sm:text-[17px] font-medium text-white group-hover:text-zinc-300 transition-colors">
                      {item.q}
                    </span>
                    <span className="text-xl font-light text-zinc-500 shrink-0 select-none">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-6 text-[13.5px] sm:text-[14.5px] text-zinc-400 leading-relaxed font-normal">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. SECTION 7: FINAL PRE-FOOTER CTA CARD                                   */}
      {/* ========================================================================= */}
      <section className="bg-[#f9f9f9] text-[#080808] pt-16 sm:pt-24 pb-20 sm:pb-28 border-t border-zinc-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-10">
          
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
                Generate Your First Undetectable Fleet Today
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                Start with 15 free offline profiles with real hardware fingerprint masking.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/download?auto=true"
                  onClick={trackDownload}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-white text-black text-xs sm:text-sm font-medium hover:bg-zinc-200 transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Free (15 Profiles)
                </Link>
                <Link
                  href="/compare"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-zinc-700 bg-white/5 text-zinc-300 text-xs sm:text-sm font-medium hover:bg-white/10 hover:text-white hover:border-zinc-500 transition-colors"
                >
                  Compare vs GoLogin &rarr;
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
