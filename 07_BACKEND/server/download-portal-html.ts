/**
 * MAHI Platform V2 — Client Download & Installation Portal HTML
 * Responsive modern design with 1-click downloads, share links, and step-by-step installation guides (Hindi & English).
 * Served on http://127.0.0.1:32123/download and http://<local-ip>:32123/download
 */

export function getDownloadPortalHtml(info?: {
  version?: string;
  setupSizeMB?: number;
  portableSizeMB?: number;
  localIps?: string[];
  port?: number;
}): string {
  const version = info?.version || '1.0.0';
  const setupSize = info?.setupSizeMB ? `${info.setupSizeMB} MB` : '92 MB';
  const portableSize = info?.portableSizeMB ? `${info.portableSizeMB} MB` : '91 MB';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download MAHI BROWSER — Professional Multi-Profile Browser</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f0fdfa',
              100: '#ccfbf1',
              200: '#99f6e4',
              300: '#5eead4',
              400: '#2dd4bf',
              500: '#14b8a6',
              600: '#0d9488',
              700: '#0f766e',
              800: '#115e59',
              900: '#134e4a',
            }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-teal-500 selection:text-black">

  <!-- TOP HEADER -->
  <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20 text-lg">
          M
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-extrabold text-base tracking-tight text-white">MAHI BROWSER</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">v${version} Release</span>
          </div>
          <p class="text-[11px] text-slate-400 hidden sm:block">Enterprise Multi-Profile Platform</p>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <a href="/admin" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition border border-slate-700/80 flex items-center space-x-1.5">
          <svg class="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
          <span>Web Admin</span>
        </a>
      </div>
    </div>
  </header>

  <!-- MAIN HERO SECTION -->
  <main class="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
    <!-- Hero Banner -->
    <div class="text-center space-y-4 max-w-2xl mx-auto">
      <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-semibold">
        <span class="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
        <span>Official Client Distribution Center</span>
      </div>
      <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-white">
        Download <span class="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">MAHI BROWSER</span>
      </h1>
      <p class="text-slate-400 text-sm sm:text-base leading-relaxed">
        High-performance anti-detect multi-profile browser, stealth fingerprint spoofing, encrypted proxy routing & Playwright RPA automation engine.
      </p>
    </div>

    <!-- 2 DOWNLOAD CARDS -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Card 1: Setup Installer (Recommended) -->
      <div class="bg-slate-900/90 border-2 border-teal-500/40 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl shadow-teal-500/5 relative overflow-hidden group hover:border-teal-400 transition-all">
        <div class="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500 text-slate-950 uppercase tracking-wide">
          Recommended
        </div>

        <div class="space-y-4">
          <div class="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">Windows Installer (Setup .exe)</h2>
            <p class="text-xs text-slate-400 mt-1">
              Full Windows installation with Desktop shortcuts, Start Menu entry, automatic updates, and full icon integration.
            </p>
          </div>
          <div class="flex items-center space-x-3 text-xs text-slate-400 font-mono">
            <span class="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Size: ~${setupSize}</span>
            <span class="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">x64 (Win 10/11)</span>
          </div>
        </div>

        <div class="space-y-2">
          <a href="/download/setup" class="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-teal-500/20 active:scale-[0.98] transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            <span>Download MAHI Setup (.exe)</span>
          </a>
          <p class="text-[11px] text-center text-slate-500">Fast 1-click installer with automatic desktop shortcut</p>
        </div>
      </div>

      <!-- Card 2: Portable Edition -->
      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all">
        <div class="space-y-4">
          <div class="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">Portable Edition (.exe)</h2>
            <p class="text-xs text-slate-400 mt-1">
              Zero installation required. Single standalone executable that runs directly from USB drive, Desktop, or Downloads folder without admin privileges.
            </p>
          </div>
          <div class="flex items-center space-x-3 text-xs text-slate-400 font-mono">
            <span class="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Size: ~${portableSize}</span>
            <span class="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">No Install Required</span>
          </div>
        </div>

        <div class="space-y-2">
          <a href="/download/portable" class="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center space-x-2 border border-slate-700 active:scale-[0.98] transition">
            <svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            <span>Download Portable (.exe)</span>
          </a>
          <p class="text-[11px] text-center text-slate-500">Double click and run immediately anywhere</p>
        </div>
      </div>
    </div>

    <!-- QUICK SHARE / LINK COPY BAR -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center space-x-2">
            <svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            <span>Share Download Link With Client / Friend</span>
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">Anyone on your network or internet can open this link to download the software</p>
        </div>

        <div class="flex items-center space-x-2">
          <button onclick="copyShareLink()" id="btn-copy" class="px-4 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-bold transition flex items-center space-x-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            <span id="copy-text">Copy Link</span>
          </button>
          <a id="btn-whatsapp" target="_blank" class="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition flex items-center space-x-2">
            <span>WhatsApp</span>
          </a>
        </div>
      </div>
      <input type="text" id="share-input" readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-300 select-all" />
    </div>

    <!-- STEP-BY-STEP INSTALLATION GUIDE -->
    <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
      <div class="border-b border-slate-800 pb-4">
        <h3 class="text-lg font-bold text-white flex items-center space-x-2">
          <svg class="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>Quick Deployment & Installation Guide</span>
        </h3>
        <p class="text-xs text-slate-400 mt-1">Follow these 3 simple steps to install and start using MAHI BROWSER on your workstation:</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        <!-- Step 1 -->
        <div class="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
          <div class="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 font-bold flex items-center justify-center text-sm">1</div>
          <h4 class="font-bold text-white">Download the Package</h4>
          <p class="text-slate-400 leading-relaxed">
            Click <strong>Download Setup (.exe)</strong> above. The installer will be saved to your local Downloads directory.
          </p>
        </div>

        <!-- Step 2 -->
        <div class="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
          <div class="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 font-bold flex items-center justify-center text-sm">2</div>
          <h4 class="font-bold text-white">Windows SmartScreen Verification</h4>
          <p class="text-slate-400 leading-relaxed">
            If Windows SmartScreen prompts <em>"Windows protected your PC"</em>, click <strong>"More info"</strong> and select <strong>"Run anyway"</strong>.
          </p>
        </div>

        <!-- Step 3 -->
        <div class="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-2">
          <div class="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 font-bold flex items-center justify-center text-sm">3</div>
          <h4 class="font-bold text-white">Instant Launch & Profiles</h4>
          <p class="text-slate-400 leading-relaxed">
            The installation creates official <strong>MAHI BROWSER</strong> desktop shortcuts. Double-click the shortcut to start creating isolated profiles immediately.
          </p>
        </div>
      </div>
    </div>
  </main>

  <!-- FOOTER -->
  <footer class="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
    <p>MAHI BROWSER V2 — Enterprise Multi-Profile Platform & Automation Engine</p>
  </footer>

  <script>
    const currentUrl = window.location.href;
    const shareInput = document.getElementById('share-input');
    if (shareInput) {
      shareInput.value = currentUrl;
    }
    const whatsappBtn = document.getElementById('btn-whatsapp');
    if (whatsappBtn) {
      whatsappBtn.href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent('Download MAHI BROWSER Software: ' + currentUrl);
    }

    function copyShareLink() {
      if (shareInput) {
        navigator.clipboard.writeText(shareInput.value);
        const copyText = document.getElementById('copy-text');
        if (copyText) {
          copyText.innerText = 'Copied!';
          setTimeout(() => {
            copyText.innerText = 'Copy Link';
          }, 2500);
        }
      }
    }
  </script>
</body>
</html>`;
}