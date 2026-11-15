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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3.5 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
          Cross-Platform Desktop Client
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Download MAHI Browser
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Install the native desktop application on your workstation or VPS. Features complete offline SQLite storage, native C++ stealth hooks, and dual Chromium 138 + Camoufox engines.
        </p>
      </div>

      {/* Download Action Component */}
      <DownloadButtons />

      {/* System Requirements Grid */}
      <div className="space-y-6 pt-4">
        <h3 className="text-xl font-bold text-white">System Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2">
              <span className="text-red-400">🪟</span> Windows
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Windows 10 / 11 (64-bit)</li>
              <li>4 GB RAM minimum (8 GB recommended)</li>
              <li>1.5 GB free disk storage</li>
              <li>DirectX 11+ or Vulkan compatible GPU</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2">
              <span className="text-red-400">🍎</span> macOS
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>macOS 11.0 (Big Sur) or higher</li>
              <li>Apple Silicon (M1/M2/M3/M4) native</li>
              <li>Intel Core i5/i7 (x64) build available</li>
              <li>Metal 2 GPU acceleration enabled</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2">
              <span className="text-red-400">🐧</span> Linux
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Ubuntu 20.04+, Debian 11+, Fedora 36+</li>
              <li>glibc 2.31 or newer</li>
              <li>FUSE support enabled (for AppImage)</li>
              <li>X11 or Wayland display server</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
