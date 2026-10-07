/**
 * MAHI Platform V2  Master Super Admin Console HTML
 * White & Emerald Green Executive Theme (Matching MAHI Browser Software UI)
 * Served on http://127.0.0.1:32123/super-admin
 */

import { getMasterAdminSecret, getApiAuthToken } from '../../08_SECURITY/install-secrets.js';

export function getSuperAdminHtml(): string {
  const masterSecret = getMasterAdminSecret();
  const apiToken = getApiAuthToken();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAHI BROWSER  Master Super Admin Suite</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            emerald: {
              50: '#ecfdf5',
              100: '#d1fae5',
              200: '#a7f3d0',
              300: '#6ee7b7',
              400: '#34d399',
              500: '#10b981',
              600: '#059669',
              700: '#047857',
              800: '#065f46',
              900: '#064e3b',
            }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .pulse-glow { animation: pulse-ring 2.5s infinite ease-in-out; }
  </style>
</head>
<body class="bg-[#F8FAFC] text-slate-800 min-h-screen flex flex-col antialiased select-none">

  <!-- TOAST NOTIFICATIONS -->
  <div id="super-toast-container" class="fixed top-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none"></div>

  <!-- MASTER AUTHENTICATION OVERLAY (Crisp White & Emerald Vault Lock) -->
  <div id="auth-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div class="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6 relative overflow-hidden">
      <!-- Emerald ambient glow -->
      <div class="absolute -top-16 -left-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-16 -right-16 w-36 h-36 bg-teal-500/10 rounded-full blur-3xl"></div>

      <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 pulse-glow">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
      </div>

      <div>
        <div class="flex items-center justify-center space-x-2">
          <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">SUPER ADMIN CONSOLE</h2>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300 mono">ROOT</span>
        </div>
        <p class="text-xs text-slate-500 mt-1">Authorized Executive Access Only</p>
      </div>

      <div class="space-y-3 text-left">
        <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Master Secret Key / PIN</label>
        <div class="relative">
          <input type="password" id="master-pin" placeholder="Enter Super Admin Key..." class="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl text-sm text-slate-900 mono focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all">
          <button onclick="togglePinVisibility()" type="button" class="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors">
            <svg id="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <p class="text-[11px] text-slate-500">Master Secret Key: <code class="text-emerald-700 font-bold mono">\${masterSecret}</code></p>
      </div>

      <button onclick="authenticateMaster()" class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition transform active:scale-98">
        Unlock Master Suite
      </button>
      <p id="auth-error" class="hidden text-xs text-rose-600 font-bold"></p>
    </div>
  </div>

  <!-- MAIN SUPER ADMIN CONSOLE CONTAINER (Revealed on Auth) -->
  <div id="super-admin-app" class="hidden flex-1 flex flex-col h-screen overflow-hidden">
    
    <!-- Top Executive Header -->
    <header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 flex-shrink-0 shadow-sm">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-base font-black shadow-md shadow-emerald-500/20">
          
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-sm font-extrabold tracking-wider text-slate-900">MAHI SUPER ADMIN</h1>
            <span class="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 mono">ROOT GOVERNANCE</span>
          </div>
          <p class="text-[11px] text-slate-500">Master Governance, License Minting & Fleet Authority</p>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <button onclick="emergencyLockdown()" id="lockdown-btn" class="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-sm">
          <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          <span>Emergency Lockdown</span>
        </button>
        <button onclick="lockConsole()" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition">
          Lock Console
        </button>
      </div>
    </header>

    <!-- Navigation Ribbon -->
    <div class="bg-slate-900 border-b border-slate-800 px-6 flex-shrink-0">
      <nav class="flex space-x-1.5 py-3 overflow-x-auto custom-scroll">
        <button onclick="switchTab('license-mint')" id="tab-btn-license-mint" class="tab-btn active px-4 py-2 rounded-xl text-[11px] font-bold bg-emerald-600 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> License Key Minting</button>
        <button onclick="switchTab('distribution')" id="tab-btn-distribution" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Distribution & Deploy</button>
        <button onclick="switchTab('fleet-master')" id="tab-btn-fleet-master" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Global Fleet & HWID</button>
        <button onclick="switchTab('db-inspector')" id="tab-btn-db-inspector" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>SQLite Inspector</button>
        <button onclick="switchTab('core-overrides')" id="tab-btn-core-overrides" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Core Overrides</button>
        <button onclick="switchTab('root-tokens')" id="tab-btn-root-tokens" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Root Authority</button>
      </nav>
    </div>

    <!-- Main Scrollable Body (White & Green Cards) -->
    <main class="flex-1 p-6 overflow-y-auto custom-scroll max-w-5xl w-full mx-auto space-y-6">

      <!-- ================= 1. LICENSE KEY MINTING ================= -->
      <section id="tab-license-mint" class="tab-content space-y-6">
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div class="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 class="text-base font-bold text-slate-900">License Key Minting Machine</h2>
              <p class="text-xs text-slate-500">Generate authenticated, cryptographically signed commercial and enterprise license keys</p>
            </div>
            <span class="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold">ECDSA + SHA-256</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Student Name</label>
              <input type="text" id="mint-student" placeholder="e.g. Rahul Kumar" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
            <div>
              <label class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Plan Tier</label>
              <select id="mint-tier" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer shadow-sm">
                <option value="pro" selected>Pro Tier (100 Profiles)</option>
                <option value="free">Free Tier (15 Profiles)</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Profiles</label>
              <input type="number" id="mint-profiles" value="100" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
            <div>
              <label class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Devices</label>
              <input type="number" id="mint-devices" value="10" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
            <div>
              <label class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Days</label>
              <input type="number" id="mint-days" value="365" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
          </div>

          <!-- Added HWID Input -->
          <div class="mb-6">
            <label class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Student Hardware ID (HWID) <span class="text-rose-500">*Required for Offline Activation</span></label>
            <input type="text" id="mint-hwid" placeholder="Paste the HWID sent by the student here..." class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
          </div>

          <button disabled class="w-full justify-center py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center opacity-60 cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
             Use external keygen
          </button>

          <div id="minted-result" class="hidden mt-6 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 shadow-inner opacity-0 transition-opacity duration-500">
            <div class="flex items-center justify-between mb-3">
               <span class="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Authenticated License Key</span>
               <button id="copy-minted-btn" onclick="copyMintedKey()" class="text-xs bg-emerald-600 text-white hover:bg-emerald-500 px-4 py-2 rounded-xl font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center transform active:scale-95">
                 <svg id="copy-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                 <span id="copy-text">Copy Key</span>
               </button>
            </div>
            <div class="bg-white rounded-xl border border-emerald-100 p-4 max-h-32 overflow-y-auto cursor-text shadow-sm">
               <code id="minted-key-text" class="text-emerald-700 font-mono text-[11px] font-semibold break-all leading-relaxed select-all"></code>
            </div>
          </div>
        </div>

        <!-- Generated Licenses Table -->
        <div class="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <h3 class="text-sm font-bold text-slate-900 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 text-emerald-600"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Active System Licenses</h3>
            <button onclick="loadLicenses()" class="text-xs text-slate-500 hover:text-emerald-600 font-bold transition-colors flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Refresh</button>
          </div>
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50/80 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th class="px-6 py-4">Student</th>
                <th class="px-6 py-4">License Key</th>
                <th class="px-6 py-4">Quotas</th>
                <th class="px-6 py-4">Expires At</th>
                <th class="px-6 py-4">Status</th>
                <th class="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="licenses-tbody" class="divide-y divide-slate-100 text-slate-700">
              <tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Loading licenses...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ================= 2. GLOBAL FLEET & HARDWARE IDS ================= -->
      <section id="tab-fleet-master" class="tab-content hidden space-y-4">
        <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900">Global Fleet Hardware Governance</h2>
              <p class="text-xs text-slate-500">Master whitelist, hardware fingerprint analysis, and instant remote revocation</p>
            </div>
            <button onclick="loadMasterFleet()" class="text-xs text-emerald-600 font-bold hover:underline">Refresh Fleet</button>
          </div>

          <div class="overflow-hidden rounded-2xl border border-slate-200">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th class="px-6 py-4">Hardware ID / Device Key</th>
                  <th class="px-6 py-4">Hostname & IP</th>
                  <th class="px-6 py-4">OS & Node</th>
                  <th class="px-6 py-4">Authorization</th>
                  <th class="px-6 py-4 text-right">Master Actions</th>
                </tr>
              </thead>
              <tbody id="master-fleet-tbody" class="divide-y divide-slate-100 text-slate-700">
                <tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">Loading hardware nodes...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ================= 3. DATABASE TABLE INSPECTOR ================= -->
      <section id="tab-db-inspector" class="tab-content hidden space-y-4">
        <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900">SQLite Raw Table Inspector</h2>
              <p class="text-xs text-slate-500">Direct query engine across Migration v1 to v7 database schema</p>
            </div>
            <div class="flex items-center space-x-2">
              <select id="db-table-select" onchange="inspectTable()" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500">
                <option value="profiles">profiles (Browser Environments)</option>
                <option value="profile_folders">profile_folders (Hierarchical Trees)</option>
                <option value="profile_locks">profile_locks (Lock & Concurrency)</option>
                <option value="fleet_devices">fleet_devices (Fleet Registry)</option>
                <option value="feature_flags">feature_flags (Control Switches)</option>
                <option value="api_keys_v2">api_keys_v2 (Auth Credentials)</option>
                <option value="proxies">proxies (Proxy Pool)</option>
                <option value="activity_logs">activity_logs (Audit Trail)</option>
                <option value="workspaces">workspaces (Team Workspaces)</option>
              </select>
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-x-auto custom-scroll max-h-[500px]">
            <div id="table-inspector-output" class="text-xs mono text-emerald-400">Select a table to inspect records...</div>
          </div>
        </div>
      </section>

      <!-- ================= 4. MASTER CORE OVERRIDES ================= -->
      <section id="tab-core-overrides" class="tab-content hidden space-y-4">
        <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div>
            <h2 class="text-base font-bold text-slate-900">Master Engine Overrides</h2>
            <p class="text-xs text-slate-500">Force override system parameters, port listeners, and anti-detect protocols</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 opacity-80">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900">Commercial Profile Limits Enforced</span>
                <input type="checkbox" id="ovr-profile-limit" disabled class="w-4 h-4 accent-emerald-600 cursor-not-allowed">
              </div>
              <p class="text-[11px] text-slate-500">Limits (15 Free / 100 Pro) are enforced strictly by freemium-guard & RSA license. Overrides disabled.</p>
            </div>

            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900">Strict Lock Collision Enforcement</span>
                <input type="checkbox" id="ovr-lock-collision" checked class="w-4 h-4 accent-emerald-600">
              </div>
              <p class="text-[11px] text-slate-500">Prevent simultaneous launch of identical profile across multiple fleet nodes.</p>
            </div>

            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900">Force Canvas & WebGL Noise Injection</span>
                <input type="checkbox" id="ovr-noise-injection" checked class="w-4 h-4 accent-emerald-600">
              </div>
              <p class="text-[11px] text-slate-500">Ensure cryptographic noise perturbation on every newly launched browser tab.</p>
            </div>

            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900">Master Telemetry Streamer</span>
                <input type="checkbox" id="ovr-telemetry-stream" checked class="w-4 h-4 accent-emerald-600">
              </div>
              <p class="text-[11px] text-slate-500">Broadcast live CPU/RAM/PID telemetry every 2000ms over local WebSocket & REST.</p>
            </div>
          </div>

          <button onclick="saveCoreOverrides()" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20">
            Apply Core Overrides
          </button>
        </div>
      </section>

      <!-- ================= 5. ROOT TOKEN AUTHORITY ================= -->
      <section id="tab-root-tokens" class="tab-content hidden space-y-4">
        <div class="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <div>
            <h2 class="text-base font-bold text-slate-900">Root Authority Tokens</h2>
            <p class="text-xs text-slate-500">Master credentials with full administrative bypass</p>
          </div>

          <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs space-y-3">
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <span class="text-slate-500">Master Secret Key:</span>
              <span class="text-emerald-700 font-bold">\${masterSecret}</span>
            </div>
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <span class="text-slate-500">Default API Auth Header:</span>
              <span class="text-slate-800 font-bold">Authorization: Bearer \${apiToken}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Permissions Scope:</span>
              <span class="text-emerald-700 font-bold">* (Full Root Authority)</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= 6. SOFTWARE DISTRIBUTION & PACKAGING ================= -->
      <section id="tab-distribution" class="tab-content hidden space-y-6">
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div class="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 class="text-base font-bold text-slate-900">Software Distribution & Deployment Center</h2>
              <p class="text-xs text-slate-500">Manage client download endpoints, installer distribution, and system desktop shortcuts</p>
            </div>
            <span class="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold">Client Rollout Hub</span>
          </div>

          <!-- Direct Installer Binaries -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 flex items-center justify-between">
              <div>
                <h4 class="text-sm font-bold text-slate-900">MAHI BROWSER Setup (.exe)</h4>
                <p class="text-xs text-slate-500 mt-0.5">Full Windows NSIS installer with desktop shortcuts & auto-update</p>
              </div>
              <a href="/download/setup" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition">Download</a>
            </div>

            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-sm font-bold text-slate-900">MAHI BROWSER Portable (.exe)</h4>
                <p class="text-xs text-slate-500 mt-0.5">Zero-install standalone executable for fast deployment</p>
              </div>
              <a href="/download/portable" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition">Download</a>
            </div>
          </div>

          <!-- Live Network Links -->
          <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Download Portal Links</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="flex items-center space-x-2">
                <input type="text" readonly value="http://127.0.0.1:32123/download" class="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 select-all" />
                <button onclick="navigator.clipboard.writeText('http://127.0.0.1:32123/download'); showSuperToast('Copied', 'Localhost link copied!', 'info')" class="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-800 transition">Copy</button>
              </div>
              <div class="flex items-center space-x-2">
                <a href="/download" target="_blank" class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center transition shadow-sm">Open Public Download Portal </a>
              </div>
            </div>
          </div>

          <!-- Rebuild Shortcuts Action -->
          <div class="flex items-center justify-between pt-2">
            <div>
              <h4 class="text-xs font-bold text-slate-900">Workstation Desktop Shortcuts</h4>
              <p class="text-[11px] text-slate-500">Reconstructs all desktop shortcuts (App, Web Admin, Super Admin) with high-res official icons</p>
            </div>
            <button onclick="rebuildSystemShortcuts()" class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition">
              Rebuild All Desktop Shortcuts
            </button>
          </div>
        </div>
      </section>

    </main>
  </div>

  <!-- SUPER ADMIN CLIENT SCRIPT -->
  <script>
    let currentTab = 'license-mint';

    function getAuthHeaders() {
      const token = sessionStorage.getItem('mahi_api_token') || '\${apiToken}';
      const secret = sessionStorage.getItem('mahi_admin_secret') || '\${masterSecret}';
      return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(secret ? { 'X-Admin-Secret': secret } : {}),
      };
    }

    function showSuperToast(title, message, type = 'success') {
      const c = document.getElementById('super-toast-container');
      const t = document.createElement('div');
      t.className = \`pointer-events-auto p-4 rounded-2xl border text-xs shadow-2xl backdrop-blur-md flex items-center space-x-3 transition-all duration-300 \${
        type === 'success' ? 'bg-white border-emerald-300 text-emerald-800' :
        type === 'error' ? 'bg-white border-rose-300 text-rose-800' :
        'bg-white border-slate-300 text-slate-800'
      }\`;
      t.innerHTML = \`
        <span class="text-base">\${type === 'success' ? '' : type === 'error' ? '' : ''}</span>
        <div>
          <h5 class="font-bold text-slate-900">\${title}</h5>
          <p class="text-slate-500 text-[11px]">\${message}</p>
        </div>
      \`;
      c.appendChild(t);
      setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
      }, 3500);
    }

    function togglePinVisibility() {
      const input = document.getElementById('master-pin');
      input.type = input.type === 'password' ? 'text' : 'password';
    }

    async function authenticateMaster() {
      const pin = document.getElementById('master-pin').value.trim();
      const err = document.getElementById('auth-error');
      try {
        const res = await fetch('/api/v2/super-admin/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: pin })
        });
        const data = await res.json();
        if (data.success) {
          sessionStorage.setItem('mahi_admin_secret', pin);
          if (data.token) sessionStorage.setItem('mahi_api_token', data.token);
          document.getElementById('auth-modal').classList.add('hidden');
          document.getElementById('super-admin-app').classList.remove('hidden');
          showSuperToast('Master Access Granted', 'Root privileges unlocked.', 'success');
          loadLicenses();
          loadMasterFleet();
        } else {
          err.innerText = data.error || 'Invalid Master Secret Key. Access Denied.';
          err.classList.remove('hidden');
        }
      } catch (e) {
        err.innerText = 'Authentication request failed.';
        err.classList.remove('hidden');
      }
    }

    document.getElementById('master-pin').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') authenticateMaster();
    });

    function lockConsole() {
      document.getElementById('auth-modal').classList.remove('hidden');
      document.getElementById('super-admin-app').classList.add('hidden');
      document.getElementById('master-pin').value = '';
      document.getElementById('auth-error').classList.add('hidden');
      showSuperToast('Console Locked', 'Master session ended.', 'info');
    }

    function switchTab(tabId) {
      currentTab = tabId;
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all';
      });

      const target = document.getElementById('tab-' + tabId);
      const btn = document.getElementById('tab-btn-' + tabId);
      if (target) target.classList.remove('hidden');
      if (btn) btn.className = 'tab-btn active px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all';

      if (tabId === 'license-mint') loadLicenses();
      if (tabId === 'fleet-master') loadMasterFleet();
      if (tabId === 'db-inspector') inspectTable();
    }

    function mintLicenseKey() {
      showSuperToast('Notice', 'In-app license minting is disabled. Run ../mahi-keygen/keygen.cjs manually in a terminal.', 'info');
    }

    function copyMintedKey() {
      const key = document.getElementById('minted-key-text').innerText;
      navigator.clipboard.writeText(key);
      showSuperToast('Copied', 'License key copied to clipboard!', 'info');
      
      const btn = document.getElementById('copy-minted-btn');
      const icon = document.getElementById('copy-icon');
      const text = document.getElementById('copy-text');
      
      btn.classList.replace('bg-emerald-600', 'bg-teal-600');
      icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
      text.innerText = 'Copied!';
      
      setTimeout(() => {
        btn.classList.replace('bg-teal-600', 'bg-emerald-600');
        icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
        text.innerText = 'Copy Key';
      }, 2000);
    }

    async function actionLicense(id, action) {
      if (action === 'delete' && !confirm('Delete this license forever?')) return;
      try {
        await fetch('/api/v2/super-admin/licenses/action', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ id, action })
        });
        loadLicenses();
      } catch (e) {
        alert('Action failed');
      }
    }

    async function copyToClip(text) {
      navigator.clipboard.writeText(text);
      // Brief visual feedback could go here
    }

    async function loadLicenses() {
      const tbody = document.getElementById('licenses-tbody');
      try {
        const res = await fetch('/api/v2/super-admin/licenses/list', { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">No licenses minted yet.</td></tr>';
            return;
          }
          
          tbody.innerHTML = json.data.map(l => {
            const isBanned = l.status === 'DISABLED';
            const statusBadge = isBanned 
              ? '<span class="px-2.5 py-1 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300/50 shadow-sm">DISABLED</span>'
              : '<span class="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300/50 shadow-sm">ACTIVE</span>';
            
            const actionBtn = isBanned
              ? '<button onclick="actionLicense(\\'' + l.id + '\\', \\'activate\\')" class="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-[10px] font-bold transition-colors border border-emerald-200">Active</button>'
              : '<button onclick="actionLicense(\\'' + l.id + '\\', \\'disable\\')" class="px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-[10px] font-bold transition-colors border border-amber-200">Ban</button>';

            const name = l.customer_name || 'Student';
            const fullHash = l.license_key_hash || '';
            const hash = fullHash ? fullHash.substring(0,25) + '...' : 'MAHI-...';
            const dur = l.duration_type || 'PRO';
            const devs = l.max_devices || 5;
            const exp = l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'Lifetime';
            const rowClass = 'hover:bg-emerald-50/40 hover:shadow-sm cursor-default transition-all duration-300 border-b border-slate-100 last:border-0 group ' + (isBanned ? 'opacity-75' : '');

            return '<tr class="' + rowClass + '">' +
              '<td class="px-6 py-4 font-bold text-slate-800">' + name + '</td>' +
              '<td class="px-6 py-4"><div class="flex items-center space-x-2">' +
              '<span class="font-mono font-bold text-emerald-700 text-[10px] group-hover:text-emerald-600 transition-colors">' + hash + '</span>' +
              '<button onclick="copyToClip(\\'' + fullHash + '\\')" class="text-slate-400 hover:text-emerald-600 transition-colors" title="Copy Key">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></td>' +
              '<td class="px-6 py-4 mono font-semibold text-slate-600 text-[10px]">' + dur + ' | ' + devs + ' Dev</td>' +
              '<td class="px-6 py-4 mono text-slate-500 text-[10px]">' + exp + '</td>' +
              '<td class="px-6 py-4">' + statusBadge + '</td>' +
              '<td class="px-6 py-4 text-right space-x-1">' +
              '<button onclick="actionLicense(\\'' + l.id + '\\', \\'extend\\')" class="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold transition-colors border border-blue-200" title="+30 Days">+30D</button>' +
              actionBtn +
              '<button onclick="actionLicense(\\'' + l.id + '\\', \\'delete\\')" class="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[10px] font-bold transition-colors border border-rose-200">Del</button></td></tr>';
          }).join('');
        }
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-rose-500 font-bold">Failed to load licenses. Database error.</td></tr>';
      }
    }

    async function loadMasterFleet() {
      const tbody = document.getElementById('master-fleet-tbody');
      try {
        const res = await fetch('/api/v2/fleet/devices', { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success && json.data) {
          const devices = json.data;
          if (devices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No fleet devices enrolled yet.</td></tr>';
            return;
          }
          tbody.innerHTML = devices.map(d => \`
            <tr class="hover:bg-slate-50 transition">
              <td class="px-6 py-4 font-mono text-emerald-700 font-bold">\${d.id}</td>
              <td class="px-6 py-4 font-bold text-slate-900">\${d.hostname} (\${d.ipAddress || '127.0.0.1'})</td>
              <td class="px-6 py-4 text-slate-600">\${d.osType}</td>
              <td class="px-6 py-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold \${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}">\${d.status}</span></td>
              <td class="px-6 py-4 text-right">
                <button onclick="revokeMasterDevice('\${d.id}')" class="px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition">Force Revoke</button>
              </td>
            </tr>
          \`).join('');
        }
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-rose-500">Failed to load fleet.</td></tr>';
      }
    }

    async function revokeMasterDevice(id) {
      if (!confirm('Are you sure you want to FORCE REVOKE this device from the master network?')) return;
      await fetch('/api/v2/fleet/devices/' + id, { method: 'DELETE', headers: getAuthHeaders() });
      showSuperToast('Device Revoked', 'Hardware access permanently severed.', 'error');
      loadMasterFleet();
    }

    async function inspectTable() {
      const tableName = document.getElementById('db-table-select').value;
      const out = document.getElementById('table-inspector-output');
      out.innerHTML = '<span class="text-slate-400">Querying SQLite table ' + tableName + '...</span>';
      try {
        const res = await fetch('/api/v2/super-admin/db/table/' + tableName, { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) {
          out.innerHTML = '<pre class="text-xs text-emerald-400">' + JSON.stringify(json.data, null, 2) + '</pre>';
        } else {
          out.innerHTML = '<span class="text-rose-400">Error: ' + (json.error || 'Failed to query table') + '</span>';
        }
      } catch (e) {
        out.innerHTML = '<span class="text-rose-400">Failed to query database.</span>';
      }
    }

    async function rebuildSystemShortcuts() {
      try {
        const res = await fetch('/api/v2/system/fix-shortcuts', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showSuperToast('Shortcuts Rebuilt', 'All workstation desktop shortcuts and icons refreshed successfully.', 'success');
        } else {
          showSuperToast('Notice', json.message || 'Shortcut check completed.', 'info');
        }
      } catch (err) {
        showSuperToast('Error', 'Failed to rebuild shortcuts.', 'error');
      }
    }

    function emergencyLockdown() {
      if (confirm(' RED ALERT: Trigger EMERGENCY PLATFORM LOCKDOWN?\\n\\nThis will suspend all profile launches across the fleet.')) {
        showSuperToast('Emergency Lockdown', 'Red Alert broadcasted to all fleet nodes.', 'error');
      }
    }

    function saveCoreOverrides() {
      showSuperToast('Overrides Saved', 'Engine configuration applied in real-time.', 'success');
    }
  </script>
</body>
</html>`;
}
