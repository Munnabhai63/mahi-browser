export function getSuperAdminTemplateHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <title>MAHI BROWSER — Master Super Admin Suite</title>
  <link rel="stylesheet" href="/admin-assets/admin.css">
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
        <label for="master-pin" class="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Master Secret Key / PIN</label>
        <div class="relative">
          <input type="password" id="master-pin" placeholder="Enter Super Admin Key..." class="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl text-sm text-slate-900 mono focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all">
          <button id="toggle-pin-btn" type="button" class="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors">
            <svg id="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <p class="text-[11px] text-slate-500">Confidential Master Authorization Key required to unlock.</p>
      </div>

      <button type="button" id="auth-submit-btn" class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition transform active:scale-98">
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
        <button type="button" id="lockdown-btn" class="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-sm">
          <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          <span>Emergency Lockdown</span>
        </button>
        <button type="button" id="super-lock-console-btn" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition">
          Lock Console
        </button>
      </div>
    </header>

    <!-- Navigation Ribbon -->
    <div class="bg-slate-900 border-b border-slate-800 px-6 flex-shrink-0">
      <nav class="flex space-x-1.5 py-3 overflow-x-auto custom-scroll">
        <button type="button" data-tab="license-mint" id="tab-btn-license-mint" class="tab-btn active px-4 py-2 rounded-xl text-[11px] font-bold bg-emerald-600 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> License Key Minting</button>
        <button type="button" data-tab="distribution" id="tab-btn-distribution" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> Distribution & Deploy</button>
        <button type="button" data-tab="fleet-master" id="tab-btn-fleet-master" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Global Fleet & HWID</button>
        <button type="button" data-tab="db-inspector" id="tab-btn-db-inspector" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>SQLite Inspector</button>
        <button type="button" data-tab="core-overrides" id="tab-btn-core-overrides" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Core Overrides</button>
        <button type="button" data-tab="root-tokens" id="tab-btn-root-tokens" class="tab-btn px-4 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Root Authority</button>
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
              <label for="mint-student" class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Student Name</label>
              <input type="text" id="mint-student" placeholder="e.g. Rahul Kumar" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
            <div>
              <label for="mint-tier" class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Plan Tier</label>
              <select id="mint-tier" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer shadow-sm">
                <option value="pro" selected>Pro Tier (100 Profiles)</option>
                <option value="free">Free Tier (15 Profiles)</option>
              </select>
            </div>
            <div>
              <label for="mint-profiles" class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Profiles</label>
              <input type="number" id="mint-profiles" value="100" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
            <div>
              <label for="mint-devices" class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Devices</label>
              <input type="number" id="mint-devices" value="10" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
            <div>
              <label for="mint-days" class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Days</label>
              <input type="number" id="mint-days" value="365" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
            </div>
          </div>

          <!-- Added HWID Input -->
          <div class="mb-6">
            <label for="mint-hwid" class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Student Hardware ID (HWID) <span class="text-rose-500">*Required for Offline Activation</span></label>
            <input type="text" id="mint-hwid" placeholder="Paste the HWID sent by the student here..." class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
          </div>

          <button type="button" disabled class="w-full justify-center py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center opacity-60 cursor-not-allowed">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
             Disabled &mdash; Contact Support
          </button>

          <div id="minted-result" class="hidden mt-6 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 shadow-inner opacity-0 transition-opacity duration-500">
            <div class="flex items-center justify-between mb-3">
               <span class="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Authenticated License Key</span>
               <button type="button" id="copy-minted-btn" class="text-xs bg-emerald-600 text-white hover:bg-emerald-500 px-4 py-2 rounded-xl font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center transform active:scale-95">
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
            <button type="button" id="refresh-licenses-btn" class="text-xs text-slate-500 hover:text-emerald-600 font-bold transition-colors flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Refresh</button>
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
            <button type="button" id="refresh-fleet-btn" class="text-xs text-emerald-600 font-bold hover:underline">Refresh Fleet</button>
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
              <select id="db-table-select" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-500">
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

          <button type="button" id="save-overrides-btn" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20">
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
              <span class="text-emerald-700 font-bold">•••••••••••••••• (Redacted / Server Enforced)</span>
            </div>
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <span class="text-slate-500">Default API Auth Header:</span>
              <span class="text-slate-800 font-bold">Authorization: Bearer [Session Authenticated]</span>
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
              <button type="button" data-download-endpoint="/download/setup" data-download-filename="MAHI-Setup.exe" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition">Download</button>
            </div>

            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <h4 class="text-sm font-bold text-slate-900">MAHI BROWSER Portable (.exe)</h4>
                <p class="text-xs text-slate-500 mt-0.5">Zero-install standalone executable for fast deployment</p>
              </div>
              <button type="button" data-download-endpoint="/download/portable" data-download-filename="MAHI-Portable.exe" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition">Download</button>
            </div>
          </div>

          <!-- Live Network Links -->
          <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Download Portal Links</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="flex items-center space-x-2">
                <input type="text" readonly value="http://127.0.0.1:32123/download" class="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 select-all" />
                <button type="button" id="copy-portal-url-btn" class="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-800 transition">Copy</button>
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
            <button type="button" id="rebuild-shortcuts-btn" class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition">
              Rebuild All Desktop Shortcuts
            </button>
          </div>
        </div>
      </section>

    </main>
  </div>

  <script src="/admin-assets/super-admin.js" defer></script>
</body>
</html>`;
}
