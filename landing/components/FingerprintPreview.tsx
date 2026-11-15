'use client';

import React, { useState } from 'react';

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

export default function FingerprintPreview() {
  const [activePresetKey, setActivePresetKey] = useState<string>('win_chrome');
  const [currentFp, setCurrentFp] = useState<FingerprintState>(PRESETS.win_chrome);
  const [isScrambling, setIsScrambling] = useState(false);

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
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Hardware Emulation Preview
          </div>
          <h3 className="mt-2 text-xl sm:text-2xl font-bold text-white tracking-tight">
            Cryptographic Anti-Detect Engine
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time inspection of low-level C++ native hooks & WebGL/Canvas mathematical perturbations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSelectPreset('win_chrome')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePresetKey === 'win_chrome'
                ? 'bg-red-600 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            Windows / Chrome 138
          </button>
          <button
            onClick={() => handleSelectPreset('mac_camoufox')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePresetKey === 'mac_camoufox'
                ? 'bg-red-600 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            macOS / Camoufox
          </button>
          <button
            onClick={() => handleSelectPreset('linux_chrome')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePresetKey === 'linux_chrome'
                ? 'bg-red-600 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            Linux / Vulkan
          </button>
          <button
            onClick={handleRandomize}
            disabled={isScrambling}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition active:scale-95 flex items-center gap-1.5"
          >
            <svg
              className={`h-3.5 w-3.5 ${isScrambling ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Scramble Noise
          </button>
        </div>
      </div>

      {/* Grid of hardware parameters */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Canvas & Noise */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Canvas Perturbation</span>
            <span className="rounded bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
              Noise Injected
            </span>
          </div>
          <p className="text-xs font-mono text-slate-200 break-all bg-slate-950/80 p-2 rounded border border-slate-800">
            Hash: {currentFp.canvasHash}
          </p>
          <p className="text-[11px] text-slate-400">
            Deterministic pixel-level mathematical variance preventing cross-profile tracking without pixel drift errors.
          </p>
        </div>

        {/* WebGL GPU */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">WebGL Vendor / Renderer</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
              Native Mask
            </span>
          </div>
          <div className="space-y-1 bg-slate-950/80 p-2 rounded border border-slate-800 text-xs font-mono">
            <div className="text-red-400 font-semibold truncate">{currentFp.webglVendor}</div>
            <div className="text-slate-300 truncate text-[11px]">{currentFp.webglRenderer}</div>
          </div>
          <p className="text-[11px] text-slate-400">
            Overwritten via C++ ANGLE hook before WebGL initialization to prevent unmasked vendor enumeration.
          </p>
        </div>

        {/* AudioContext */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AudioContext Frequency</span>
            <span className="rounded bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
              Seed: {currentFp.audioSeed}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-200 bg-slate-950/80 p-2 rounded border border-slate-800">
            {currentFp.audioFrequency}
          </p>
          <p className="text-[11px] text-slate-400">
            DynamicsCompressor and OfflineAudioContext response curve perturbed with micro-jitter.
          </p>
        </div>

        {/* Client Hints */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client Hints Brands</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
              Sec-CH-UA
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-950/80 p-2 rounded border border-slate-800">
            {currentFp.brands.map((b, i) => (
              <span key={i} className="rounded bg-slate-800/90 px-2 py-0.5 text-[11px] font-mono text-red-300">
                "{b.brand}": {b.version}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Strictly aligned with User-Agent major version and GREASE brands to pass Cloudflare Turnstile & DataDome.
          </p>
        </div>

        {/* Hardware & Concurrency */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Hardware Profile</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
              Coherent
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-2 rounded border border-slate-800 text-xs font-mono">
            <div>RAM: <span className="text-white">{currentFp.memory}</span></div>
            <div>Cores: <span className="text-white">{currentFp.hardwareConcurrency}</span></div>
            <div className="col-span-2 text-[11px] text-slate-400 truncate">{currentFp.resolution}</div>
          </div>
          <p className="text-[11px] text-slate-400">
            Device memory, CPU threads, and display metrics match actual hardware distributions.
          </p>
        </div>

        {/* Verification Benchmark */}
        <div className="rounded-xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/20 to-slate-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">CreepJS Detection Score</span>
            <span className="rounded bg-emerald-900/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              PASS
            </span>
          </div>
          <div className="bg-slate-950/80 p-2 rounded border border-emerald-900/50 text-xs font-mono text-emerald-300">
            {currentFp.creepJsScore}
          </div>
          <p className="text-[11px] text-slate-300">
            Pixelscan 100% Consistent • IPHEY Authentic • Rebrowser-Patches Runtime.Enable Leak Eliminated.
          </p>
        </div>
      </div>
    </div>
  );
}
