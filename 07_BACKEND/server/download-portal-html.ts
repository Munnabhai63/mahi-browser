/**
 * MAHI Platform V2 — World-Class Customer Landing & Download Experience
 * Premium Silicon Valley standard typography (Google Fonts Inter + Plus Jakarta Sans + JetBrains Mono).
 * Subpixel anti-aliased rendering with optical kerning and modern tracking.
 * Served on http://127.0.0.1:32123/download, /get, /app, /setup
 */

import { CONTACT_CONFIG } from '../../10_CONFIG/contact-config.js';

export function getDownloadPortalHtml(info?: {
  version?: string;
  setupSizeMB?: number;
  portableSizeMB?: number;
  localIps?: string[];
  port?: number;
}): string {
  const version = info?.version || '1.0.0';
  const setupSize = info?.setupSizeMB ? `${info.setupSizeMB} MB` : '87.9 MB';

  return `<!DOCTYPE html>
<html lang="en" class="dark scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAHI BROWSER — Next-Generation Enterprise Anti-Detect Browser</title>
  
  <!-- Premium Google Fonts: Inter (Google standard) + Plus Jakarta Sans + JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', '"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            emerald: {
              400: '#34d399',
              500: '#10b981',
              600: '#059669',
            },
            teal: {
              400: '#2dd4bf',
              500: '#14b8a6',
            }
          }
        }
      }
    }
  </script>
  <style>
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    body { 
      font-family: 'Inter', "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      letter-spacing: -0.015em;
    }
    
    .mono { 
      font-family: 'JetBrains Mono', monospace; 
      letter-spacing: -0.02em;
    }
    
    .heading-hero {
      letter-spacing: -0.035em;
      line-height: 1.12;
    }

    .aurora-bg {
      background-image: 
        radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.14) 0px, transparent 50%),
        radial-gradient(at 100% 0%, rgba(20, 184, 166, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 40%, rgba(5, 150, 105, 0.08) 0px, transparent 60%);
    }

    .grid-pattern {
      background-size: 32px 32px;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    }

    .glass-card {
      background: rgba(11, 17, 30, 0.78);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(16, 185, 129, 0.18);
    }

    .glass-card:hover {
      border-color: rgba(16, 185, 129, 0.40);
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.14);
    }
  </style>
</head>
<body class="bg-[#050811] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-black aurora-bg grid-pattern overflow-x-hidden">

  <!-- TOP BRAND NAVBAR -->
  <nav class="border-b border-slate-800/80 bg-[#050811]/85 backdrop-blur-2xl sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3.5">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/25 flex items-center justify-center">
          <div class="w-full h-full bg-slate-950 rounded-[15px] flex items-center justify-center text-emerald-400 font-black text-lg">
            M
          </div>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-extrabold text-base tracking-tight text-white">MAHI BROWSER</span>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">v${version} PRO</span>
          </div>
          <p class="text-[11px] text-slate-400 hidden sm:block tracking-normal">Hardware-Level Multi-Profile Isolation Platform</p>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <div class="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 font-medium">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Engine Status: <b class="text-white">Online & Verified</b></span>
        </div>

        <a
          href="#download-section"
          class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center space-x-1.5"
        >
          <svg class="w-3.5 h-3.5 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          <span>Get MAHI</span>
        </a>
      </div>
    </div>
  </nav>

  <!-- HERO SECTION -->
  <main class="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
    
    <!-- Hero Text -->
    <div class="text-center space-y-5 max-w-3xl mx-auto">
      <div class="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm">
        <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
        <span class="tracking-normal">Hardware Fingerprint Spoofing & Real CDP Synchronizer</span>
      </div>

      <h1 class="text-4xl sm:text-6xl font-black tracking-tight text-white heading-hero">
        The Ultimate Commercial <br class="hidden sm:inline"/>
        <span class="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Multi-Profile Browser</span>
      </h1>

      <p class="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
        Run hundreds of completely isolated browser instances simultaneously. Each profile carries distinct canvas, audio, WebGL, proxy, and hardware fingerprints without leaking your true identity.
      </p>

      <!-- Trust Metrics Strip -->
      <div class="pt-2 flex flex-wrap items-center justify-center gap-2.5 text-xs">
        <span class="px-3.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-full text-slate-300 flex items-center space-x-1.5 font-medium">
          <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          <span>Pixelscan <b class="text-white">100% Clean</b></span>
        </span>
        <span class="px-3.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-full text-slate-300 flex items-center space-x-1.5 font-medium">
          <svg class="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          <span>CreepJS <b class="text-white">A+ Trust Rating</b></span>
        </span>
        <span class="px-3.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-full text-slate-300 flex items-center space-x-1.5 font-medium">
          <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          <span>Zero Telemetry Leak</span>
        </span>
      </div>
    </div>

    <!-- PRODUCT INTERFACE MOCKUP -->
    <div class="relative max-w-4xl mx-auto rounded-3xl p-1 bg-gradient-to-b from-emerald-500/30 via-slate-800/40 to-transparent shadow-2xl shadow-emerald-500/10">
      <div class="bg-[#090E1A] rounded-[22px] border border-slate-800 overflow-hidden text-left shadow-2xl">
        <!-- Mockup Window Header -->
        <div class="h-10 bg-slate-950 px-4 flex items-center justify-between border-b border-slate-800/80">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-rose-500/80"></span>
            <span class="w-3 h-3 rounded-full bg-amber-500/80"></span>
            <span class="w-3 h-3 rounded-full bg-emerald-500/80"></span>
            <span class="text-[11px] font-mono text-slate-400 ml-2">MAHI Workstation Engine — 4 Active Profiles</span>
          </div>
          <div class="flex items-center space-x-2 text-[10px] font-mono text-emerald-400 font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>CDP SYNC: ACTIVE</span>
          </div>
        </div>

        <!-- Mockup Workspace Content -->
        <div class="p-4 sm:p-5 space-y-3 bg-[#090E1A]">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Profile Card 1 -->
            <div class="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-white truncate">Amazon Prime Store</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 font-mono">RUNNING</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono space-y-0.5">
                <div>IP: 185.220.101.44 (US)</div>
                <div>Canvas: Spoofed (GTX 4090)</div>
              </div>
            </div>

            <!-- Profile Card 2 -->
            <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-white truncate">Google Ads Master</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 font-mono">RUNNING</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono space-y-0.5">
                <div>IP: 194.26.29.112 (UK)</div>
                <div>Audio: Pure Noise Jitter</div>
              </div>
            </div>

            <!-- Profile Card 3 -->
            <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-white truncate">Crypto Vault Session</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 font-mono">RUNNING</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono space-y-0.5">
                <div>IP: 45.142.214.89 (DE)</div>
                <div>WebRTC: Disabled / Stealth</div>
              </div>
            </div>

            <!-- Profile Card 4 -->
            <div class="p-3.5 rounded-xl bg-slate-900/90 border border-teal-500/30 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-xs text-white truncate">TikTok Agency Node</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-teal-500/20 text-teal-400 font-mono">SYNC MASTER</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono space-y-0.5">
                <div>IP: Mobile 5G Hotspot</div>
                <div>RPA: Auto-Script Active</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PRIMARY DOWNLOAD CARD SECTION -->
    <div id="download-section" class="max-w-2xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center space-y-8 relative overflow-hidden">
      
      <!-- Top OS Selector Tabs -->
      <div class="flex items-center justify-center p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 max-w-md mx-auto">
        <button onclick="setOsTab('windows')" id="tab-windows" class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 bg-emerald-500 text-slate-950 shadow-md">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 88 88"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L0 75.58v-32.06zm4.326-39.027L87.914 0v41.525l-47.918.278zm47.918 38.647L87.914 88l-47.918-6.737V45.551z"></path></svg>
          <span>Windows</span>
        </button>

        <button onclick="setOsTab('mac')" id="tab-mac" class="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center space-x-2">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 170 170"><path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.07-7.6-7.85-11.7-14.35-6.08-9.7-10.74-20.2-13.98-31.48-3.24-11.28-4.86-22.18-4.86-32.69 0-14.35 3.59-26.4 10.77-36.14 7.18-9.74 16.32-14.73 27.42-14.97 4.58 0 9.8 1.25 15.66 3.76 5.86 2.5 9.74 3.81 11.64 3.92 1.52 0 5.6-1.41 12.24-4.23 6.64-2.82 12.38-4.08 17.23-3.79 13.06.77 23.36 5.37 30.89 13.79-11.65 7.07-17.38 16.74-17.2 29.02.18 9.9 3.99 18.23 11.43 24.99 7.44 6.75 16.33 10.66 26.67 11.73-2.18 6.42-4.84 12.69-7.98 18.82zM119.22 31.84c0-7.39 2.68-14.35 8.04-20.89 5.36-6.53 11.96-10.51 19.8-11.95.22 1.3.33 2.47.33 3.53 0 7.39-2.82 14.52-8.47 21.39-5.65 6.87-12.38 10.84-20.19 11.91-.22-1.3-.33-2.63-.33-3.99z"></path></svg>
          <span>macOS</span>
        </button>

        <button onclick="setOsTab('linux')" id="tab-linux" class="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center space-x-2">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 0-4 4v3.54C6.82 10.3 6 11.83 6 13.5c0 1.94 1.13 3.61 2.8 4.41L8 20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l-.8-2.09A4.97 4.97 0 0 0 18 13.5c0-1.67-.82-3.2-2-3.96V6a4 4 0 0 0-4-4zm0 2c1.1 0 2 .9 2 2v2H10V6c0-1.1.9-2 2-2zm0 7c1.66 0 3 1.34 3 3 0 1.3-.84 2.4-2 2.82V19h-2v-2.18c-1.16-.42-2-1.52-2-2.82 0-1.66 1.34-3 3-3z"></path></svg>
          <span>Linux</span>
        </button>
      </div>

      <div class="space-y-2">
        <h2 id="download-title" class="text-2xl sm:text-3xl font-black text-white tracking-tight">Download MAHI Browser for Windows</h2>
        <p id="download-subtitle" class="text-xs sm:text-sm text-slate-300 font-normal">Version ${version} — Windows x64 • By ${CONTACT_CONFIG.APP_AUTHOR}</p>
      </div>

      <!-- Action Button -->
      <div>
        <a
          id="main-download-btn"
          href="/download/setup"
          onclick="handleDownloadTrigger(event)"
          class="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center space-x-3 shadow-2xl shadow-emerald-500/35 transition transform hover:-translate-y-1 active:translate-y-0 cursor-pointer"
        >
          <svg class="w-6 h-6 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          <span id="download-btn-text">Download MAHI Browser for Windows</span>
        </a>
      </div>

      <!-- Live Download Metadata Pills -->
      <div class="pt-4 grid grid-cols-3 gap-2.5 border-t border-slate-800/80">
        <div class="flex items-center justify-center space-x-1.5 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 font-medium">
          <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
          <span>v${version}</span>
        </div>

        <div class="flex items-center justify-center space-x-1.5 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 font-medium">
          <svg class="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7c0-2-1.5-3-3.5-3h-9C5.5 4 4 5 4 7zm0 4h16"></path></svg>
          <span>${setupSize}</span>
        </div>

        <div class="flex items-center justify-center space-x-1.5 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 font-medium">
          <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          <span>Windows x64</span>
        </div>
      </div>
    </div>

    <!-- 4 CORE ARCHITECTURE HIGHLIGHTS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div class="p-6 glass-card rounded-3xl space-y-3">
        <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </div>
        <h3 class="font-extrabold text-white text-base tracking-tight">Deep Hardware Spoofing</h3>
        <p class="text-xs text-slate-300 leading-relaxed font-normal">
          Replaces native Canvas, WebGL shaders, AudioContext, ClientRects, WebRTC, CPU Cores, and Memory hardware profiles to prevent browser fingerprint tracking.
        </p>
      </div>

      <div class="p-6 glass-card rounded-3xl space-y-3">
        <div class="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        </div>
        <h3 class="font-extrabold text-white text-base tracking-tight">Zero-Latency CDP Synchronizer</h3>
        <p class="text-xs text-slate-300 leading-relaxed font-normal">
          Control hundreds of active browser windows from a single master profile. Replicates mouse clicks, smooth scroll, typing, and URL navigations in real time.
        </p>
      </div>

      <div class="p-6 glass-card rounded-3xl space-y-3">
        <div class="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <h3 class="font-extrabold text-white text-base tracking-tight">Encrypted Proxy Tunnels</h3>
        <p class="text-xs text-slate-300 leading-relaxed font-normal">
          Store credentials encrypted with military-grade AES-256-GCM. Features automatic mobile 4G/5G IP rotation, live latency health checking, and IP failover.
        </p>
      </div>

      <div class="p-6 glass-card rounded-3xl space-y-3">
        <div class="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        </div>
        <h3 class="font-extrabold text-white text-base tracking-tight">Visual Playwright RPA Studio</h3>
        <p class="text-xs text-slate-300 leading-relaxed font-normal">
          Automate repetitive web actions without code. Built-in solvers for Cloudflare Turnstile, reCAPTCHA v2/v3, and hCaptcha image challenges.
        </p>
      </div>
    </div>

    <!-- 3-STEP QUICK START GUIDE -->
    <div class="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-6">
      <h3 class="text-base font-extrabold text-white text-center tracking-tight">3-Step Getting Started</h3>
      
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <div class="space-y-2">
          <div class="w-9 h-9 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-500/30">1</div>
          <div class="font-bold text-xs text-white">Download</div>
          <p class="text-[11px] text-slate-400">Click the button above to get the verified setup file.</p>
        </div>

        <div class="space-y-2">
          <div class="w-9 h-9 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-500/30">2</div>
          <div class="font-bold text-xs text-white">Install</div>
          <p class="text-[11px] text-slate-400">Run the installer on your Windows, Mac, or Linux workstation.</p>
        </div>

        <div class="space-y-2">
          <div class="w-9 h-9 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-500/30">3</div>
          <div class="font-bold text-xs text-white">Launch & Work</div>
          <p class="text-[11px] text-slate-400">Create your isolated browser profiles and start working safely.</p>
        </div>
      </div>
    </div>

  </main>

  <!-- DOWNLOAD MODAL POPUP -->
  <div id="download-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 hidden animate-in fade-in duration-200">
    <div class="bg-[#090E1A] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl relative">
      <button onclick="closeDownloadModal()" class="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>

      <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      </div>

      <div class="space-y-1.5">
        <h3 class="text-lg font-bold text-white tracking-tight">Downloading MAHI Browser...</h3>
        <p class="text-xs text-slate-300">Your download should begin automatically. If not, click below:</p>
      </div>

      <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400">
        MAHI BROWSER-${version}-Setup.exe
      </div>

      <!-- Windows SmartScreen 1-Click Guide -->
      <div class="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-left space-y-1.5">
        <div class="flex items-center space-x-2 text-[11px] font-bold text-emerald-400">
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          <span>Quick Install Tip:</span>
        </div>
        <p class="text-[11px] text-slate-300 leading-snug">
          If Windows SmartScreen appears on first run, click <b class="text-white">"More info"</b> ➔ <b class="text-emerald-400">"Run anyway"</b>.
        </p>
      </div>

      <a href="/download/setup" class="block w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition">
        Direct Download Mirror
      </a>
    </div>
  </div>

  <!-- FOOTER -->
  <footer class="border-t border-slate-800/80 bg-[#050811] py-8 text-center text-xs text-slate-500 space-y-2">
    <p>© 2026 MAHI BROWSER — By ${CONTACT_CONFIG.APP_AUTHOR}. All rights reserved.</p>
    <p class="text-[11px] text-slate-500">Enterprise Anti-Detect Platform • Windows 11/10 • macOS • Linux</p>
  </footer>

  <script>
    function setOsTab(os) {
      const btnWindows = document.getElementById('tab-windows');
      const btnMac = document.getElementById('tab-mac');
      const btnLinux = document.getElementById('tab-linux');
      const title = document.getElementById('download-title');
      const subtitle = document.getElementById('download-subtitle');
      const btnText = document.getElementById('download-btn-text');

      const activeClass = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 bg-emerald-500 text-slate-950 shadow-md';
      const inactiveClass = 'flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center space-x-2';

      btnWindows.className = inactiveClass;
      btnMac.className = inactiveClass;
      btnLinux.className = inactiveClass;

      if (os === 'windows') {
        btnWindows.className = activeClass;
        title.innerText = 'MAHI Browser for Windows (64-bit)';
        subtitle.innerText = 'Production installer with automatic desktop launcher and stealth sandbox';
        btnText.innerText = 'Download MAHI Installer (64-bit)';
      } else if (os === 'mac') {
        btnMac.className = activeClass;
        title.innerText = 'MAHI Browser for macOS (Universal)';
        subtitle.innerText = 'Apple Silicon (M1/M2/M3/M4) & Intel DMG Package';
        btnText.innerText = 'Download macOS Package (.dmg)';
      } else if (os === 'linux') {
        btnLinux.className = activeClass;
        title.innerText = 'MAHI Browser for Linux (x64)';
        subtitle.innerText = 'Debian / Ubuntu (.deb) and Standalone AppImage';
        btnText.innerText = 'Download Linux AppImage';
      }
    }

    function handleDownloadTrigger(e) {
      document.getElementById('download-modal').classList.remove('hidden');
    }

    function closeDownloadModal() {
      document.getElementById('download-modal').classList.add('hidden');
    }
  </script>
</body>
</html>`;
}