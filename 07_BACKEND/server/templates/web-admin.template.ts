export function getWebAdminTemplateHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <title>MAHI BROWSER — Commercial Admin Control Center</title>
  <link rel="stylesheet" href="/admin-assets/admin.css">
</head>
<body class="bg-[#F8FAFC] text-slate-800 h-screen w-screen flex overflow-hidden antialiased select-none">

  <!-- TOAST NOTIFICATIONS CONTAINER -->
  <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none"></div>

  <!-- LEFT NAVIGATION SIDEBAR (Slate-900 / Emerald Navigation) -->
  <aside class="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between flex-shrink-0 z-30 border-r border-slate-800 select-none">
    <div>
      <!-- Workspace Brand Header -->
      <div class="h-16 px-4 flex items-center justify-between border-b border-slate-800">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20 text-sm">
            M
          </div>
          <div>
            <div class="flex items-center space-x-1.5">
              <h1 class="text-sm font-bold tracking-tight text-white">MAHI ADMIN</h1>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PRO</span>
            </div>
            <p class="text-[10px] text-slate-400">Commercial Control Suite</p>
          </div>
        </div>
      </div>

      <!-- Navigation Links -->
      <div class="p-3 space-y-1 overflow-y-auto custom-scroll max-h-[calc(100vh-140px)]">
        <button type="button" data-page="dashboard" id="nav-dashboard" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            <span>Dashboard</span>
          </div>
        </button>

        <button type="button" data-page="users" id="nav-users" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            <span>Users & Accounts</span>
          </div>
          <span id="nav-users-count" class="text-[10px] font-mono text-slate-500">0</span>
        </button>

        <button type="button" data-page="plans" id="nav-plans" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <span>Plans & Tiers</span>
          </div>
        </button>

        <button type="button" data-page="payments" id="nav-payments" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            <span>Payments & Approvals</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-400">UPI</span>
        </button>

        <button type="button" data-page="licenses" id="nav-licenses" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            <span>Licenses & Minting</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">MINT</span>
        </button>

        <button type="button" data-page="devices" id="nav-devices" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <span>Device Activations</span>
          </div>
          <span id="nav-device-count" class="text-[10px] font-mono text-slate-500">0</span>
        </button>

        <button type="button" data-page="versions" id="nav-versions" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            <span>Software Versions</span>
          </div>
        </button>

        <button type="button" data-page="audit_logs" id="nav-audit_logs" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span>Audit Trail</span>
          </div>
        </button>

        <button type="button" data-page="demo_requests" id="nav-demo_requests" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span>Demo Leads</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">LEADS</span>
        </button>

        <button type="button" data-page="funnel" id="nav-funnel" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            <span>Funnel Telemetry</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-sky-500/20 text-sky-400">FUNNEL</span>
        </button>

        <button type="button" data-page="support_tickets" id="nav-support_tickets" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            <span>Support Tickets</span>
          </div>
          <span id="nav-tickets-count" class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-500/20 text-rose-400">0</span>
        </button>
      </div>
    </div>

    <!-- Bottom Controls -->
    <div class="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
      <div class="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
        <div class="flex items-center space-x-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="font-bold text-slate-300">Authority</span>
        </div>
        <span class="text-emerald-400 font-mono text-[10px] uppercase font-bold">ONLINE</span>
      </div>
      <a href="/super-admin" class="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition group">
        <div class="flex items-center space-x-2">
          <span>👑</span>
          <span>Super Admin Suite</span>
        </div>
        <svg class="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
      </a>
    </div>
  </aside>

  <!-- MAIN VIEWPORT -->
  <main class="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFC]">
    <!-- Top Global Header -->
    <header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
      <div class="flex items-center space-x-3">
        <h2 id="page-title" class="text-base font-extrabold text-slate-900 tracking-tight">Platform Overview</h2>
        <span id="page-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">REAL-TIME</span>
      </div>

      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
          <span class="text-slate-500 font-medium">Admin Key:</span>
          <input type="password" id="admin-secret-input" value="" placeholder="Enter Admin Secret" class="bg-transparent text-slate-800 font-mono text-xs focus:outline-none w-36">
        </div>
        <button type="button" id="refresh-data-btn" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          <span>Refresh</span>
        </button>
      </div>
    </header>

    <!-- Page Content Container -->
    <div id="content-container" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
      <!-- Dynamic Content Rendered by JS -->
    </div>
  </main>

  <script src="/admin-assets/web-admin.js" defer></script>
</body>
</html>`;
}
