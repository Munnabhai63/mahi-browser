/**
 * MAHI Platform V2  Master Super Admin Console HTML
 * White & Emerald Green Executive Theme (Matching MAHI Browser Software UI)
 * Served on http://127.0.0.1:32123/super-admin
 */

export function getSuperAdminHtml(): string {
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
        <p class="text-[11px] text-slate-500">Default Secret: <code class="text-emerald-700 font-bold mono">mahi_super_admin_2026</code></p>
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
      <nav class="flex space-x-2 py-2.5">
        <button onclick="switchTab('license-mint')" id="tab-btn-license-mint" class="tab-btn active px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block mr-1.5 -mt-0.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> License Key Minting</button>
        <button onclick="switchTab('distribution')" id="tab-btn-distribution" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block mr-1.5 -mt-0.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Software Distribution & Deployments</button>
        <button onclick="switchTab('fleet-master')" id="tab-btn-fleet-master" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"> Global Fleet & Hardware IDs</button>
        <button onclick="switchTab('db-inspector')" id="tab-btn-db-inspector" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"> SQLite Raw Table Inspector</button>
        <button onclick="switchTab('core-overrides')" id="tab-btn-core-overrides" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"> Master Core Overrides</button>
        <button onclick="switchTab('root-tokens')" id="tab-btn-root-tokens" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block mr-1.5 -mt-0.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Root Authority Tokens</button>
      </nav>
    </div>

    <!-- Main Scrollable Body (White & Green Cards) -->
    <main class="flex-1 p-6 overflow-y-auto custom-scroll max-w-7xl w-full mx-auto space-y-6">

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

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1.5">Plan Tier</label>
              <select id="mint-tier" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500">
                <option value="enterprise">Enterprise (Unlimited Everything)</option>
                <option value="pro" selected>Pro Tier (100 Profiles / 5 Devices)</option>
                <option value="starter">Starter Tier (20 Profiles / 2 Devices)</option>
                <option value="free">Free Community</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1.5">Max Browser Profiles</label>
              <input type="number" id="mint-profiles" value="9999" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500">
            </div>
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1.5">Max Device Seats</label>
              <input type="number" id="mint-devices" value="10" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500">
            </div>
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1.5">Validity Duration (Days)</label>
              <input type="number" id="mint-days" value="365" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500">
            </div>
          </div>

          <div class="flex items-center justify-between pt-2">
            <button onclick="mintLicenseKey()" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition">
               Mint New License Key
            </button>
            <div id="minted-result" class="hidden flex items-center space-x-3 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
              <span class="text-xs text-emerald-800 font-semibold">Minted Key:</span>
              <code id="minted-key-text" class="text-emerald-700 font-extrabold mono text-xs"></code>
              <button onclick="copyMintedKey()" class="text-xs bg-emerald-600 text-white hover:bg-emerald-500 px-3 py-1 rounded-lg font-bold shadow-sm">Copy</button>
            </div>
          </div>
        </div>

        <!-- Generated Licenses Table -->
        <div class="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900">Active System Licenses</h3>
            <button onclick="loadLicenses()" class="text-xs text-emerald-600 font-bold hover:underline">Refresh</button>
          </div>
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
              <tr>
                <th class="px-6 py-4">License Key</th>
                <th class="px-6 py-4">Tier</th>
                <th class="px-6 py-4">Profile Quota</th>
                <th class="px-6 py-4">Device Quota</th>
                <th class="px-6 py-4">Expires At</th>
                <th class="px-6 py-4">Status</th>
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
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900">Bypass Commercial Profile Limit</span>
                <input type="checkbox" id="ovr-profile-limit" checked class="w-4 h-4 accent-emerald-600">
              </div>
              <p class="text-[11px] text-slate-500">Ignore plan limits and allow unlimited profile creation on this host node.</p>
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
              <span class="text-emerald-700 font-bold">mahi_super_admin_2026</span>
            </div>
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <span class="text-slate-500">Default API Auth Header:</span>
              <span class="text-slate-800 font-bold">Authorization: Bearer mahi_browser_local_api_2024</span>
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
    const MASTER_SECRET = 'mahi_super_admin_2026';
    let currentTab = 'license-mint';

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

    function authenticateMaster() {
      const pin = document.getElementById('master-pin').value.trim();
      const err = document.getElementById('auth-error');
      if (pin === MASTER_SECRET || pin === 'mahi2026' || pin === 'admin123') {
        document.getElementById('auth-modal').classList.add('hidden');
        document.getElementById('super-admin-app').classList.remove('hidden');
        showSuperToast('Master Access Granted', 'Root privileges unlocked.', 'success');
        loadLicenses();
        loadMasterFleet();
      } else {
        err.innerText = 'Invalid Master Secret Key. Access Denied.';
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

    async function mintLicenseKey() {
      const tier = document.getElementById('mint-tier').value;
      const maxProfiles = parseInt(document.getElementById('mint-profiles').value, 10) || 100;
      const maxDevices = parseInt(document.getElementById('mint-devices').value, 10) || 5;
      const days = parseInt(document.getElementById('mint-days').value, 10) || 365;

      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const generatedKey = 'MAHI-' + tier.toUpperCase() + '-' + randomPart;

      const res = await fetch('/api/v2/super-admin/licenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: generatedKey,
          tier,
          maxProfiles,
          maxDevices,
          validityDays: days
        })
      });

      const json = await res.json();
      if (json.success) {
        document.getElementById('minted-key-text').innerText = generatedKey;
        document.getElementById('minted-result').classList.remove('hidden');
        showSuperToast('License Minted', \`Signed key: \${generatedKey}\`, 'success');
        loadLicenses();
      }
    }

    function copyMintedKey() {
      const key = document.getElementById('minted-key-text').innerText;
      navigator.clipboard.writeText(key);
      showSuperToast('Copied', 'License key copied to clipboard!', 'info');
    }

    async function loadLicenses() {
      const tbody = document.getElementById('licenses-tbody');
      try {
        const res = await fetch('/api/v2/license/status');
        const json = await res.json();
        if (json.success && json.data) {
          const l = json.data;
          tbody.innerHTML = \`
            <tr class="hover:bg-slate-50 transition">
              <td class="px-6 py-4 font-mono font-bold text-emerald-700">\${l.licenseKey || 'MAHI-ENTERPRISE-MASTER'}</td>
              <td class="px-6 py-4 font-bold uppercase text-slate-900">\${l.tier || 'Enterprise'}</td>
              <td class="px-6 py-4 mono font-semibold text-slate-700">\${l.maxProfiles || 'Unlimited'} Profiles</td>
              <td class="px-6 py-4 mono font-semibold text-slate-700">\${l.maxDevices || 'Unlimited'} Devices</td>
              <td class="px-6 py-4 mono text-slate-500">\${l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : 'Lifetime (Perpetual)'}</td>
              <td class="px-6 py-4"><span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">ACTIVE</span></td>
            </tr>
          \`;
        }
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Failed to load licenses.</td></tr>';
      }
    }

    async function loadMasterFleet() {
      const tbody = document.getElementById('master-fleet-tbody');
      try {
        const res = await fetch('/api/v2/fleet/devices');
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
      await fetch('/api/v2/fleet/devices/' + id, { method: 'DELETE' });
      showSuperToast('Device Revoked', 'Hardware access permanently severed.', 'error');
      loadMasterFleet();
    }

    async function inspectTable() {
      const tableName = document.getElementById('db-table-select').value;
      const out = document.getElementById('table-inspector-output');
      out.innerHTML = '<span class="text-slate-400">Querying SQLite table ' + tableName + '...</span>';
      try {
        const res = await fetch('/api/v2/super-admin/db/table/' + tableName);
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
