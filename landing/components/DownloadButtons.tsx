'use client';

import React, { useEffect, useState } from 'react';
import { BRAND } from '../lib/brand';

export type OperatingSystem = 'windows' | 'mac' | 'linux';

interface DownloadOption {
  id: string;
  label: string;
  os: OperatingSystem;
  arch: string;
  fileExt: string;
  downloadUrl: string;
  isPrimary?: boolean;
  comingSoon?: boolean;
  notes: string;
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  {
    id: 'win-installer',
    label: 'Windows 10 / 11 (x64 Installer)',
    os: 'windows',
    arch: 'x64',
    fileExt: '.exe',
    downloadUrl: BRAND.downloads.windowsSetup,
    isPrimary: true,
    notes: 'Standard NSIS installer with automatic desktop shortcut & background updater',
  },
  {
    id: 'win-portable',
    label: 'Windows Portable (Zero-Install)',
    os: 'windows',
    arch: 'x64',
    fileExt: '.exe',
    downloadUrl: BRAND.downloads.windowsPortable,
    notes: 'Standalone executable, run directly from USB or sandboxed enterprise directory',
  },
  {
    id: 'mac-arm',
    label: 'macOS Apple Silicon (M1/M2/M3/M4)',
    os: 'mac',
    arch: 'arm64',
    fileExt: '.dmg',
    downloadUrl: BRAND.downloads.macDmg,
    comingSoon: !BRAND.downloads.macDmgAvailable,
    notes: 'Native arm64 binary with Apple Notarization & Gatekeeper signing',
  },
  {
    id: 'mac-intel',
    label: 'macOS Intel (x64)',
    os: 'mac',
    arch: 'x64',
    fileExt: '.dmg',
    downloadUrl: BRAND.downloads.macDmg,
    comingSoon: !BRAND.downloads.macDmgAvailable,
    notes: 'Legacy Intel Mac build with full dual-engine hardware emulation',
  },
  {
    id: 'linux-appimage',
    label: 'Linux Universal (AppImage)',
    os: 'linux',
    arch: 'x64',
    fileExt: '.AppImage',
    downloadUrl: BRAND.downloads.linuxAppImage,
    isPrimary: true,
    comingSoon: !BRAND.downloads.linuxAvailable,
    notes: 'Runs on Ubuntu 20.04+, Debian 11+, Fedora, Arch, and Red Hat Linux',
  },
  {
    id: 'linux-deb',
    label: 'Linux Debian / Ubuntu (.deb)',
    os: 'linux',
    arch: 'x64',
    fileExt: '.deb',
    downloadUrl: BRAND.downloads.linuxAppImage,
    comingSoon: !BRAND.downloads.linuxAvailable,
    notes: 'DPKG package with systemd sandbox integration and apt compatibility',
  },
];

export default function DownloadButtons() {
  const [detectedOs, setDetectedOs] = useState<OperatingSystem>('windows');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [isHandoffLoading, setIsHandoffLoading] = useState(false);
  const [trialActivated, setTrialActivated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes('mac') || ua.includes('darwin')) {
        setDetectedOs('mac');
      } else if (ua.includes('linux') || ua.includes('x11')) {
        setDetectedOs('linux');
      } else {
        setDetectedOs('windows');
      }

      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token') || urlParams.get('access_token') || urlParams.get('auth_token');
      if (urlToken) {
        setAuthToken(urlToken);
        try {
          localStorage.setItem('mahi_auth_token', urlToken);
        } catch {}
      } else {
        try {
          const stored = localStorage.getItem('mahi_auth_token') || localStorage.getItem('mahi_access_token');
          if (stored) setAuthToken(stored);
        } catch {}
      }

      // Auto-trigger download if navigated from Home CTA (require authentication)
      if (urlParams.get('auto') === 'true') {
        const currentToken =
          urlToken ||
          (typeof window !== 'undefined'
            ? localStorage.getItem('mahi_auth_token') || localStorage.getItem('mahi_access_token')
            : null);
        if (!currentToken) {
          window.location.href = '/signup?intent=trial&returnUrl=/download';
          return;
        }

        setTimeout(() => {
          const downloadTarget = BRAND.downloads.windowsSetup;
          const a = document.createElement('a');
          a.href = downloadTarget;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, 600);
      }
    }
  }, []);

  const trackDownload = async (opt: DownloadOption) => {
    try {
      await fetch(`${BRAND.apiUrl}/api/v1/funnel/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'download_click',
          optionId: opt.id,
          os: opt.os,
          arch: opt.arch,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {}
  };

  const handleDeepLinkHandoff = async () => {
    if (!authToken) return;
    setIsHandoffLoading(true);
    setHandoffStatus(null);
    try {
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/auth/web-handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          client: 'nextjs-web-portal',
          requestedAt: new Date().toISOString(),
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const deepLink = data.protocolUrl || (data.handoffCode ? `mahi://auth?handoff=${encodeURIComponent(data.handoffCode)}` : '');
        if (deepLink) {
          setHandoffStatus('Opening MAHI Desktop Application...');
          window.location.href = deepLink;
        } else {
          setHandoffStatus('Could not generate desktop handoff link.');
        }
      } else {
        setHandoffStatus('Failed to initiate desktop handoff session.');
      }
    } catch {
      setHandoffStatus('Error connecting to authentication service.');
    } finally {
      setIsHandoffLoading(false);
    }
  };

  const handleActivateTrial = async () => {
    if (!authToken) return;
    try {
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/auth/trial/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          source: 'download_page',
          product: 'mahi_browser_pro_trial',
        }),
      });
      if (resp.ok) setTrialActivated(true);
    } catch {
      setTrialActivated(true);
    }
  };

  const primaryOption =
    DOWNLOAD_OPTIONS.find((o) => o.os === detectedOs && o.isPrimary && !o.comingSoon) ||
    DOWNLOAD_OPTIONS.find((o) => o.os === detectedOs && !o.comingSoon) ||
    DOWNLOAD_OPTIONS.find((o) => o.id === 'win-installer') ||
    DOWNLOAD_OPTIONS[0];

  return (
    <div className="w-full space-y-8">
      {/* Cloud Authenticated Deep Link Banner */}
      {authToken && (
        <div className="rounded-[8px] border border-white/15 bg-[#131517] p-5 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-white inline-block" />
              <div>
                <p className="text-[13px] font-medium text-white">
                  Signed in to MAHI Cloud
                </p>
                <p className="text-[12px] text-white/50">
                  Your desktop client will automatically pair with your cloud profiles.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!trialActivated ? (
                <button
                  onClick={handleActivateTrial}
                  className="rounded-full bg-white text-black px-4 py-1.5 text-xs font-medium hover:bg-zinc-200 transition"
                >
                  Activate 7-Day Pro Trial
                </button>
              ) : (
                <span className="rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs text-white font-mono">
                  ✓ Pro Trial Active
                </span>
              )}
              <button
                onClick={handleDeepLinkHandoff}
                disabled={isHandoffLoading}
                className="rounded-full border border-white/20 bg-white/[0.05] hover:bg-white/10 px-4 py-1.5 text-xs font-medium text-white transition"
              >
                {isHandoffLoading ? 'Connecting...' : 'Launch in Desktop App (mahi://)'}
              </button>
            </div>
          </div>
          {handoffStatus && (
            <p className="mt-2 text-xs text-white/70 font-mono">{handoffStatus}</p>
          )}
        </div>
      )}

      {/* Primary OS Hero Download Card */}
      <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#131517] p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
              <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                DETECTED PLATFORM: {detectedOs === 'windows' ? 'WINDOWS x64' : detectedOs === 'mac' ? 'macOS (x64 / arm64)' : 'LINUX x64'}
              </span>
            </div>
            <h3 className="font-['Spectral',serif] text-2xl sm:text-4xl font-light text-white tracking-[-0.03em]">
              {primaryOption.label}
            </h3>
            <p className="text-[13px] sm:text-[14px] text-white/60 max-w-xl leading-relaxed">
              {primaryOption.notes}. Includes Chromium 138 with on-demand Camoufox dual-engine support and offline SQLite storage.
            </p>
            <div className="flex items-center gap-3 text-xs text-white/40 pt-1 font-mono">
              <span>Version: <strong className="text-white">v{BRAND.version}</strong></span>
              <span>•</span>
              <span>Architecture: <strong className="text-white">{primaryOption.arch}</strong></span>
              <span>•</span>
              <span>Status: <strong className="text-white">Stable Production</strong></span>
            </div>
          </div>

          <div className="shrink-0">
            {primaryOption.comingSoon ? (
              <button
                disabled
                className="inline-flex items-center justify-center gap-3 rounded-full bg-zinc-900 text-zinc-400 border border-white/10 px-8 py-3.5 text-[14px] font-medium cursor-not-allowed select-none"
              >
                <span>{detectedOs === 'mac' ? 'macOS — Coming Soon' : detectedOs === 'linux' ? 'Linux — Coming Soon' : 'Coming Soon'}</span>
              </button>
            ) : (
              <a
                href={primaryOption.downloadUrl}
                onClick={() => trackDownload(primaryOption)}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-white text-black px-8 py-3.5 text-[14px] font-medium shadow-xl hover:bg-zinc-200 transition-all duration-200 active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download for Windows</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* All Platforms & Alternatives Grid */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
          <span className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290]">
            ALL AVAILABLE BUILDS & PACKAGES
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOWNLOAD_OPTIONS.map((opt) => (
            <div
              key={opt.id}
              className="flex flex-col justify-between rounded-[8px] border border-white/10 bg-[#131517] p-5 transition hover:border-white/20 hover:bg-[#181a1d]"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#969290]">
                    {opt.os} ({opt.arch})
                  </span>
                  {opt.comingSoon ? (
                    <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                      Coming Soon
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-white">
                      {opt.fileExt}
                    </span>
                  )}
                </div>
                <h5 className="font-['Spectral',serif] font-light text-base text-white">{opt.label}</h5>
                <p className="text-xs text-white/50 leading-relaxed">{opt.notes}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-white/30 font-mono">v{BRAND.version}</span>
                {opt.comingSoon ? (
                  <button
                    disabled
                    className="text-[11px] font-mono text-zinc-500 cursor-not-allowed select-none border border-white/10 rounded-full px-2.5 py-0.5 bg-white/[0.02]"
                  >
                    {opt.os === 'mac' ? 'macOS — Coming Soon' : opt.os === 'linux' ? 'Linux — Coming Soon' : 'Coming Soon'}
                  </button>
                ) : (
                  <a
                    href={opt.downloadUrl}
                    onClick={() => trackDownload(opt)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white hover:underline underline-offset-4 transition"
                  >
                    <span>Download {opt.fileExt}</span>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enterprise Security Notice */}
      <div className="rounded-[8px] border border-white/10 bg-[#131517] p-5 text-xs text-white/50 space-y-2">
        <div className="flex items-center gap-2 text-white font-medium text-[13px]">
          <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290]" />
          SHA-256 Checksum Integrity & Multi-Layer Stealth Verification
        </div>
        <p className="leading-relaxed">
          All MAHI Browser releases include published SHA-256 checksums for cryptographic integrity verification. Shipped builds operate with JavaScript-layer stealth (MV3 main-world injection) and rebrowser-patches flags; native C++ engine available as an optional, separately provisioned build. For offline and air-gapped environments, MAHI Browser operates completely locally using embedded SQLite storage with zero cloud dependencies.
        </p>
      </div>
    </div>
  );
}
