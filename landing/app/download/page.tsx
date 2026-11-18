import React from 'react';
import type { Metadata } from 'next';
import DownloadButtons from '../../components/DownloadButtons';

export const metadata: Metadata = {
  title: 'Download MAHI Browser — Desktop Anti-Detect Client',
  description:
    'Download MAHI Browser for Windows 10/11 x64, macOS Apple Silicon/Intel, and Linux AppImage/deb. 15 offline profiles included free forever.',
};

export default function DownloadPage() {
  return (
    <div className="relative min-h-screen bg-[#030303] text-white selection:bg-white selection:text-black pt-24 sm:pt-32 pb-24 overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/assets/company/hero_walking.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-10 filter contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/90 via-[#030303]/95 to-[#030303]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_900px_600px_at_50%_20%,rgba(255,255,255,0.03),transparent)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
            <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
              CROSS-PLATFORM DESKTOP CLIENT
            </span>
          </div>

          <h1 className="font-['Spectral',serif] text-3xl sm:text-5xl lg:text-[56px] font-light tracking-[-0.03em] leading-tight text-white">
            Download MAHI Browser
          </h1>

          <p className="text-white/60 text-[14px] sm:text-[15px] leading-relaxed max-w-2xl mx-auto">
            Install the native desktop application on your workstation or VPS. Features complete offline SQLite storage, Chromium 138 with JS-layer MV3 stealth injection, and on-demand Camoufox C++ Gecko engine.
          </p>
        </div>

        {/* Download Action Component */}
        <DownloadButtons />

        {/* System Requirements Bento Grid */}
        <div className="space-y-6 pt-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
            <span className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290]">
              SYSTEM SPECIFICATIONS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-[8px] border border-white/10 bg-[#131517] p-6 space-y-3">
              <h4 className="font-['Spectral',serif] text-xl font-light text-white flex items-center justify-between">
                <span>Windows</span>
                <span className="text-xs font-mono text-[#969290] uppercase">x64</span>
              </h4>
              <ul className="text-[13px] text-zinc-300 space-y-2 list-none pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  Windows 10 / 11 (64-bit)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  4 GB RAM minimum (8 GB recommended)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  1.5 GB free NVMe / SSD disk space
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  DirectX 11+ or Vulkan compatible GPU
                </li>
              </ul>
            </div>

            <div className="rounded-[8px] border border-white/10 bg-[#131517] p-6 space-y-3">
              <h4 className="font-['Spectral',serif] text-xl font-light text-white flex items-center justify-between">
                <span>macOS</span>
                <span className="text-xs font-mono text-[#969290] uppercase">arm64 / x64</span>
              </h4>
              <ul className="text-[13px] text-zinc-300 space-y-2 list-none pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  macOS 11.0 (Big Sur) or higher
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  Apple Silicon (M1/M2/M3/M4) native
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  Intel Core i5/i7 build available
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  Metal 2 hardware GPU acceleration
                </li>
              </ul>
            </div>

            <div className="rounded-[8px] border border-white/10 bg-[#131517] p-6 space-y-3">
              <h4 className="font-['Spectral',serif] text-xl font-light text-white flex items-center justify-between">
                <span>Linux</span>
                <span className="text-xs font-mono text-[#969290] uppercase">AppImage / deb</span>
              </h4>
              <ul className="text-[13px] text-zinc-300 space-y-2 list-none pt-2 border-t border-white/5">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  Ubuntu 20.04+, Debian 11+, Fedora 36+
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  glibc 2.31 or newer
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  FUSE support enabled (for AppImage)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-zinc-500" />
                  X11 or Wayland display server
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
