/**
 * MAHI Platform V2 — Enterprise Web Admin Portal HTML
 * White & Emerald Green Premium Theme (Matching MAHI Browser design)
 * Served on http://127.0.0.1:32123/admin
 */

import { ADMIN_STYLESHEET } from './admin-css.js';

export function getWebAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAHI BROWSER — Commercial Admin Control Center</title>
  <style>
    ${ADMIN_STYLESHEET}
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  </style>
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
        <button onclick="switchPage('dashboard')" id="nav-dashboard" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            <span>Dashboard</span>
          </div>
        </button>

        <button onclick="switchPage('users')" id="nav-users" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            <span>Users & Accounts</span>
          </div>
          <span id="nav-users-count" class="text-[10px] font-mono text-slate-500">0</span>
        </button>

        <button onclick="switchPage('plans')" id="nav-plans" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <span>Plans & Tiers</span>
          </div>
        </button>

        <button onclick="switchPage('payments')" id="nav-payments" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            <span>Payments & Approvals</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-400">UPI</span>
        </button>

        <button onclick="switchPage('licenses')" id="nav-licenses" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            <span>Licenses & Minting</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">MINT</span>
        </button>

        <button onclick="switchPage('devices')" id="nav-devices" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <span>Device Activations</span>
          </div>
          <span id="nav-device-count" class="text-[10px] font-mono text-slate-500">0</span>
        </button>

        <button onclick="switchPage('versions')" id="nav-versions" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            <span>Software Versions</span>
          </div>
        </button>

        <button onclick="switchPage('audit_logs')" id="nav-audit_logs" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span>Audit Trail</span>
          </div>
        </button>

        <button onclick="switchPage('demo_requests')" id="nav-demo_requests" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <span>Demo Leads</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400">LEADS</span>
        </button>

        <button onclick="switchPage('funnel')" id="nav-funnel" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
          <div class="flex items-center space-x-3">
            <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            <span>Funnel Telemetry</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-sky-500/20 text-sky-400">FUNNEL</span>
        </button>

        <button onclick="switchPage('support_tickets')" id="nav-support_tickets" class="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
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
        <button onclick="refreshData()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5">
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

  <script>
    let currentPage = 'dashboard';
    let dashboardData = null;

    function getAdminSecret() {
      return document.getElementById('admin-secret-input')?.value || '';
    }

    async function apiFetch(url, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        'X-Admin-Secret': getAdminSecret(),
        ...(options.headers || {})
      };
      try {
        const res = await fetch(url, { ...options, headers });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    function showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = \`px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center space-x-2 pointer-events-auto transform transition duration-200 \${
        type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
      }\`;
      toast.innerHTML = \`<span>\${type === 'success' ? '✓' : '⚠️'}</span><span>\${message}</span>\`;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function switchPage(page) {
      currentPage = page;
      document.querySelectorAll('.nav-item').forEach(el => {
        el.className = 'nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all';
      });
      const activeNav = document.getElementById('nav-' + page);
      if (activeNav) {
        activeNav.className = 'nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 transition-all';
      }
      renderPage();
    }

    async function refreshData() {
      renderPage();
      showToast('Data refreshed successfully');
    }

    async function renderPage() {
      const container = document.getElementById('content-container');
      const title = document.getElementById('page-title');

      if (currentPage === 'dashboard') {
        title.innerText = 'Platform Overview';
        container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading dashboard telemetry...</div>';
        const res = await apiFetch('/api/v1/admin/dashboard');
        if (res.success && res.data) {
          dashboardData = res.data;
          document.getElementById('nav-users-count').innerText = res.data.totalUsers || 0;
          document.getElementById('nav-device-count').innerText = res.data.activeDevices || 0;
          const ticketBadge = document.getElementById('nav-tickets-count');
          if (ticketBadge) ticketBadge.innerText = res.data.openTickets || 0;
          renderDashboard(res.data);
        } else {
          container.innerHTML = \`<div class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">Error loading dashboard: \${res.error || 'Failed to authenticate'}</div>\`;
        }
      } else if (currentPage === 'users') {
        title.innerText = 'Commercial Users Management';
        renderUsers();
      } else if (currentPage === 'plans') {
        title.innerText = 'Subscription Plans & Entitlement Limits';
        renderPlans();
      } else if (currentPage === 'payments') {
        title.innerText = 'Payments & UPI Verification';
        renderPayments();
      } else if (currentPage === 'licenses') {
        title.innerText = 'License Key Minting & Control';
        renderLicenses();
      } else if (currentPage === 'devices') {
        title.innerText = 'Device Activations & Enforcement';
        renderDevices();
      } else if (currentPage === 'versions') {
        title.innerText = 'Software Versions & Updates';
        renderVersions();
      } else if (currentPage === 'audit_logs') {
        title.innerText = 'System Audit Trail';
        renderAuditLogs();
      } else if (currentPage === 'demo_requests') {
        title.innerText = 'Enterprise & Team Demo Leads';
        renderDemoRequests();
      } else if (currentPage === 'funnel') {
        title.innerText = 'Conversion Funnel Telemetry';
        renderFunnelTelemetry();
      } else if (currentPage === 'support_tickets') {
        title.innerText = 'Customer Support Desk & Ticket Inbox';
        renderSupportTickets();
      }
    }

    function renderDashboard(data) {
      const container = document.getElementById('content-container');
      container.innerHTML = \`
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Total Commercial Users</span>
              <span class="text-emerald-600 font-mono">USERS</span>
            </div>
            <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">\${data.totalUsers}</div>
            <div class="text-[11px] text-slate-400 mt-1 flex items-center space-x-2">
              <span class="text-emerald-600 font-bold">\${data.activeUsers} active</span>
              <span>•</span>
              <span class="text-rose-500 font-bold">\${data.suspendedUsers + data.bannedUsers} restricted</span>
            </div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Active Licenses</span>
              <span class="text-teal-600 font-mono">KEYS</span>
            </div>
            <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">\${data.activeLicenses}</div>
            <div class="text-[11px] text-slate-400 mt-1">\${data.expiredLicenses} expired keys</div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Authorized Devices</span>
              <span class="text-purple-600 font-mono">NODES</span>
            </div>
            <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">\${data.activeDevices}</div>
            <div class="text-[11px] text-slate-400 mt-1">Live client instances</div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Active Plans Configured</span>
              <span class="text-amber-600 font-mono">TIERS</span>
            </div>
            <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">\${data.totalPlans}</div>
            <div class="text-[11px] text-slate-400 mt-1">Free, Pro, Business, Enterprise</div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900">Recent Commercial Audit Logs</h3>
            <button onclick="switchPage('audit_logs')" class="text-xs font-bold text-emerald-600 hover:text-emerald-700">View All Logs →</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th class="p-3">Timestamp</th>
                  <th class="p-3">Actor</th>
                  <th class="p-3">Action</th>
                  <th class="p-3">Details</th>
                  <th class="p-3">Result</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                \${data.recentAuditLogs && data.recentAuditLogs.length > 0 ? data.recentAuditLogs.map(l => \`
                  <tr class="hover:bg-slate-50">
                    <td class="p-3 font-mono text-[11px] text-slate-400">\${new Date(l.createdAt).toLocaleTimeString()}</td>
                    <td class="p-3 font-bold text-slate-700">\${l.actorName} <span class="text-[10px] text-slate-400">(\${l.actorRole})</span></td>
                    <td class="p-3 font-mono font-semibold text-emerald-700">\${l.action}</td>
                    <td class="p-3 text-slate-600">\${l.details}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold \${l.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">\${l.result}</span></td>
                  </tr>
                \`).join('') : '<tr><td colspan="5" class="p-4 text-center text-slate-400">No recent logs recorded.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      \`;
    }

    async function renderUsers() {
      const container = document.getElementById('content-container');
      container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading users list...</div>';
      const res = await apiFetch('/api/v1/admin/users');
      if (!res.success) {
        container.innerHTML = \`<div class="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl">\${res.error || 'Failed to load users'}</div>\`;
        return;
      }

      container.innerHTML = \`
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Registered Users (\${res.total})</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Manage customer quotas, GoLogin-style boosters, enterprise feature overrides & HWID locks</p>
            </div>
            <button onclick="renderUsers()" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition">🔄 Refresh</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th class="p-3">User</th>
                  <th class="p-3">Role</th>
                  <th class="p-3">Plan & Quotas</th>
                  <th class="p-3">Enterprise Overrides</th>
                  <th class="p-3">Status</th>
                  <th class="p-3">Joined</th>
                  <th class="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                \${res.data && res.data.length > 0 ? res.data.map(u => \`
                  <tr class="hover:bg-slate-50 transition">
                    <td class="p-3">
                      <div class="font-bold text-slate-800">\${u.name}</div>
                      <div class="text-[11px] text-slate-400 font-mono">\${u.email}</div>
                    </td>
                    <td class="p-3"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-700">\${u.role}</span></td>
                    <td class="p-3">
                      <div class="font-semibold text-emerald-700">\${u.planId}</div>
                      \${u.bonusProfiles > 0 ? \`<div class="text-[10px] text-amber-600 font-bold font-mono">+\${u.bonusProfiles} Boosted Profiles</div>\` : ''}
                      \${u.bonusProxyBytes > 0 ? \`<div class="text-[10px] text-sky-600 font-bold font-mono">+\${Math.round(u.bonusProxyBytes / (1024*1024*1024))} GB Proxy</div>\` : ''}
                    </td>
                    <td class="p-3">
                      <div class="flex flex-wrap gap-1">
                        \${u.featureOverrides && u.featureOverrides.qunkong ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Qunkong</span>' : ''}
                        \${u.featureOverrides && u.featureOverrides.multiCore ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">MultiCore</span>' : ''}
                        \${u.featureOverrides && u.featureOverrides.apiDaemon ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">BotAPI</span>' : ''}
                        \${u.featureOverrides && u.featureOverrides.rpa ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">RPA</span>' : ''}
                        \${!u.featureOverrides || (!u.featureOverrides.qunkong && !u.featureOverrides.multiCore && !u.featureOverrides.apiDaemon && !u.featureOverrides.rpa) ? '<span class="text-[10px] text-slate-400">Standard Tier</span>' : ''}
                      </div>
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${
                        u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        u.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }">\${u.status}</span>
                    </td>
                    <td class="p-3 text-slate-400 text-[11px] font-mono">\${new Date(u.createdAt).toLocaleDateString()}</td>
                    <td class="p-3 text-right space-x-1 whitespace-nowrap">
                      <button onclick="openBoostModal('\${u.id}', '\${u.email}', \${u.bonusProfiles || 0})" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-bold text-[10px] border border-amber-200 transition" title="GoLogin-Style Quick Quota Boost">⚡ Boost</button>
                      <button onclick='openFeaturesModal("\${u.id}", "\${u.email}", \${JSON.stringify(u.featureOverrides || {})})' class="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg font-bold text-[10px] border border-purple-200 transition" title="MostLogin-Style Feature Overrides">⚙️ Features</button>
                      <button onclick="resetUserHardware('\${u.id}', '\${u.email}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] transition" title="1-Click Machine / HWID Unbind">🔓 HWID</button>
                      \${u.status === 'ACTIVE' ? \`
                        <button onclick="changeUserStatus('\${u.id}', 'SUSPENDED')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold text-[10px] transition">Suspend</button>
                        <button onclick="changeUserStatus('\${u.id}', 'BANNED')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[10px] transition">Ban</button>
                      \` : \`
                        <button onclick="changeUserStatus('\${u.id}', 'ACTIVE')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[10px] transition">Activate</button>
                      \`}
                    </td>
                  </tr>
                \`).join('') : '<tr><td colspan="7" class="p-6 text-center text-slate-400 font-medium">No users registered yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      \`;
    }

    async function changeUserStatus(userId, status) {
      const res = await apiFetch(\`/api/v1/admin/users/\${userId}/status\`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (res.success) {
        showToast(\`User status updated to \${status}\`);
        renderUsers();
      } else {
        showToast(res.error || 'Failed to update status', 'error');
      }
    }

    async function openBoostModal(userId, email, currentBonus) {
      const modal = document.createElement('div');
      modal.id = 'boost-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
      modal.innerHTML = \`
        <div class="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <span class="text-amber-500">⚡</span>
                <span>Instant Quota Booster (GoLogin Parity)</span>
              </h3>
              <p class="text-[11px] text-slate-500 font-mono mt-0.5">\${email}</p>
            </div>
            <button onclick="document.getElementById('boost-modal').remove()" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div class="flex justify-between">
              <span class="font-semibold">Current Bonus Profiles:</span>
              <span class="font-mono font-bold text-amber-600">+\${currentBonus} Profiles</span>
            </div>
            <p class="text-[10px] text-slate-400">Boosters immediately expand balance without changing subscription tier.</p>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-bold text-slate-700">1-Click Quick Boost:</div>
            <div class="grid grid-cols-3 gap-2">
              <button onclick="executeBoost('\${userId}', 'PROFILES', 10)" class="p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold text-center transition">
                +10 Profiles
              </button>
              <button onclick="executeBoost('\${userId}', 'PROFILES', 50)" class="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center transition">
                +50 Profiles
              </button>
              <button onclick="executeBoost('\${userId}', 'PROXY_GB', 5)" class="p-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold text-center transition">
                +5 GB Proxy
              </button>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 space-y-2">
            <label class="text-xs font-bold text-slate-700 block">Custom Profile Amount:</label>
            <div class="flex space-x-2">
              <input type="number" id="custom-boost-input" min="1" max="1000" placeholder="e.g. 25" class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-emerald-500 font-mono">
              <button onclick="const val = parseInt(document.getElementById('custom-boost-input').value, 10); if (val > 0) executeBoost('\${userId}', 'PROFILES', val);" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition">
                Grant
              </button>
            </div>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }

    async function executeBoost(userId, type, amount) {
      const res = await apiFetch(\`/api/v1/admin/users/\${userId}/boost\`, {
        method: 'POST',
        body: JSON.stringify({ type, amount })
      });
      if (res.success) {
        showToast(\`Successfully granted +\${amount} \${type === 'PROFILES' ? 'Profiles' : 'GB Proxy'}!\`);
        const m = document.getElementById('boost-modal');
        if (m) m.remove();
        renderUsers();
      } else {
        showToast(res.error || 'Failed to apply boost', 'error');
      }
    }

    async function openFeaturesModal(userId, email, currentOverrides) {
      const modal = document.createElement('div');
      modal.id = 'features-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
      const ov = currentOverrides || {};
      modal.innerHTML = \`
        <div class="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <span class="text-purple-600">⚙️</span>
                <span>Enterprise Feature Overrides (MostLogin Parity)</span>
              </h3>
              <p class="text-[11px] text-slate-500 font-mono mt-0.5">\${email}</p>
            </div>
            <button onclick="document.getElementById('features-modal').remove()" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
          </div>

          <div class="space-y-3 text-xs">
            <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <div class="font-bold text-slate-800">Qunkong Synchronizer (群控)</div>
                <div class="text-[10px] text-slate-500">Multi-window real-time input mirroring & grid placement</div>
              </div>
              <input type="checkbox" id="feat-qunkong" \${ov.qunkong ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
            </label>

            <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <div class="font-bold text-slate-800">Multi-Core Chromium Selector</div>
                <div class="text-[10px] text-slate-500">Orbita 130 / 140 / 150 kernel switching per profile</div>
              </div>
              <input type="checkbox" id="feat-multicore" \${ov.multiCore ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
            </label>

            <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <div class="font-bold text-slate-800">Local Bot API Daemon</div>
                <div class="text-[10px] text-slate-500">REST API (:30898/:32123) for Puppeteer/Selenium</div>
              </div>
              <input type="checkbox" id="feat-apidaemon" \${ov.apiDaemon ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
            </label>

            <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <div class="font-bold text-slate-800">Visual RPA Automation Studio</div>
                <div class="text-[10px] text-slate-500">Pre-built cookie warmer, KYC and scraping bot flows</div>
              </div>
              <input type="checkbox" id="feat-rpa" \${ov.rpa ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
            </label>
          </div>

          <div class="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button onclick="document.getElementById('features-modal').remove()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Cancel</button>
            <button onclick="saveFeatures('\${userId}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-sm">Save Overrides</button>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }

    async function saveFeatures(userId) {
      const overrides = {
        qunkong: document.getElementById('feat-qunkong').checked,
        multiCore: document.getElementById('feat-multicore').checked,
        apiDaemon: document.getElementById('feat-apidaemon').checked,
        rpa: document.getElementById('feat-rpa').checked,
      };
      const res = await apiFetch(\`/api/v1/admin/users/\${userId}/features\`, {
        method: 'PUT',
        body: JSON.stringify({ overrides })
      });
      if (res.success) {
        showToast('Enterprise feature overrides updated successfully!');
        const m = document.getElementById('features-modal');
        if (m) m.remove();
        renderUsers();
      } else {
        showToast(res.error || 'Failed to update overrides', 'error');
      }
    }

    async function resetUserHardware(userId, email) {
      if (!confirm(\`Are you sure you want to unbind all hardware and device locks for \${email}? User will be able to register new hardware immediately.\`)) {
        return;
      }
      const res = await apiFetch(\`/api/v1/admin/users/\${userId}/reset-devices\`, {
        method: 'POST'
      });
      if (res.success) {
        showToast(\`Unbound \${res.unbindCount} device(s) successfully!\`);
        renderUsers();
      } else {
        showToast(res.error || 'Failed to unbind devices', 'error');
      }
    }

    let currentTicketFilter = { status: '', category: '' };

    async function renderSupportTickets() {
      const container = document.getElementById('content-container');
      container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading support ticket inbox...</div>';
      
      let url = '/api/v1/commercial/admin/support-tickets';
      const params = [];
      if (currentTicketFilter.status) params.push('status=' + encodeURIComponent(currentTicketFilter.status));
      if (currentTicketFilter.category) params.push('category=' + encodeURIComponent(currentTicketFilter.category));
      if (params.length) url += '?' + params.join('&');

      const res = await apiFetch(url);
      if (!res.success) {
        container.innerHTML = \`<div class="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl">\${res.error || 'Failed to load tickets'}</div>\`;
        return;
      }

      const tickets = res.data || [];
      const openCount = tickets.filter(t => t.status === 'OPEN').length;
      const inProgCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
      const paymentCount = tickets.filter(t => t.category === 'PAYMENT').length;
      const resolvedCount = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

      container.innerHTML = \`
        <div class="space-y-4">
          <!-- Stat Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div class="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Tickets</div>
              <div class="text-2xl font-black text-slate-900 mt-1 font-mono">\${tickets.length}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs">
              <div class="text-rose-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Open & Pending</span>
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              </div>
              <div class="text-2xl font-black text-rose-600 mt-1 font-mono">\${openCount}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
              <div class="text-amber-600 text-[10px] font-bold uppercase tracking-wider">Payment Escalations</div>
              <div class="text-2xl font-black text-amber-600 mt-1 font-mono">\${paymentCount}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
              <div class="text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Resolved</div>
              <div class="text-2xl font-black text-emerald-600 mt-1 font-mono">\${resolvedCount}</div>
            </div>
          </div>

          <!-- Filters & Actions -->
          <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div class="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center space-x-2">
                <span class="text-xs font-bold text-slate-700">Filter Status:</span>
                <select onchange="currentTicketFilter.status = this.value; renderSupportTickets();" class="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold focus:outline-emerald-500">
                  <option value="" \${currentTicketFilter.status === '' ? 'selected' : ''}>All Statuses</option>
                  <option value="OPEN" \${currentTicketFilter.status === 'OPEN' ? 'selected' : ''}>OPEN</option>
                  <option value="IN_PROGRESS" \${currentTicketFilter.status === 'IN_PROGRESS' ? 'selected' : ''}>IN_PROGRESS</option>
                  <option value="RESOLVED" \${currentTicketFilter.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
                  <option value="CLOSED" \${currentTicketFilter.status === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
                </select>

                <span class="text-xs font-bold text-slate-700 ml-2">Category:</span>
                <select onchange="currentTicketFilter.category = this.value; renderSupportTickets();" class="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold focus:outline-emerald-500">
                  <option value="" \${currentTicketFilter.category === '' ? 'selected' : ''}>All Categories</option>
                  <option value="PAYMENT" \${currentTicketFilter.category === 'PAYMENT' ? 'selected' : ''}>Payment / Billing</option>
                  <option value="PRICING" \${currentTicketFilter.category === 'PRICING' ? 'selected' : ''}>Pricing & Plans</option>
                  <option value="SETUP" \${currentTicketFilter.category === 'SETUP' ? 'selected' : ''}>Setup & Onboarding</option>
                  <option value="FINGERPRINT" \${currentTicketFilter.category === 'FINGERPRINT' ? 'selected' : ''}>Fingerprint Engine</option>
                  <option value="PROFILES" \${currentTicketFilter.category === 'PROFILES' ? 'selected' : ''}>Profiles & Vault</option>
                  <option value="GENERAL" \${currentTicketFilter.category === 'GENERAL' ? 'selected' : ''}>General Support</option>
                </select>
              </div>
              <button onclick="renderSupportTickets()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">
                🔄 Refresh Inbox
              </button>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th class="p-3">Ticket #</th>
                    <th class="p-3">Customer</th>
                    <th class="p-3">Category</th>
                    <th class="p-3">Message Preview</th>
                    <th class="p-3">Status</th>
                    <th class="p-3">Created</th>
                    <th class="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  \${tickets.length > 0 ? tickets.map(t => \`
                    <tr class="hover:bg-slate-50 transition">
                      <td class="p-3 font-mono font-bold text-slate-900">\${t.ticketNumber}</td>
                      <td class="p-3">
                        <div class="font-bold text-slate-800">\${t.userName || 'Anonymous'}</div>
                        <div class="text-[11px] text-slate-400 font-mono">\${t.userEmail || 'No email provided'}</div>
                      </td>
                      <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${
                          t.category === 'PAYMENT' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          t.category === 'PRICING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }">\${t.category}</span>
                        \${t.isEscalated ? '<span class="ml-1 text-[9px] font-extrabold text-rose-600">⚡ ESCALATED</span>' : ''}
                      </td>
                      <td class="p-3 text-slate-600 max-w-xs truncate" title="\${(t.message || '').replace(/"/g, '&quot;')}">
                        \${t.message}
                      </td>
                      <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${
                          t.status === 'OPEN' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          t.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }">\${t.status}</span>
                      </td>
                      <td class="p-3 text-slate-400 text-[11px] font-mono">\${new Date(t.createdAt).toLocaleDateString()} \${new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td class="p-3 text-right">
                        <button onclick='openTicketReplyModal(\${JSON.stringify(t)})' class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] transition shadow-xs">
                          Reply & Manage
                        </button>
                      </td>
                    </tr>
                  \`).join('') : '<tr><td colspan="7" class="p-8 text-center text-slate-400 font-medium">No tickets match the selected filters.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      \`;
    }

    function openTicketReplyModal(ticket) {
      const modal = document.createElement('div');
      modal.id = 'ticket-reply-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
      modal.innerHTML = \`
        <div class="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <span>Ticket: \${ticket.ticketNumber}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">\${ticket.category}</span>
              </h3>
              <p class="text-[11px] text-slate-500 font-mono mt-0.5">From: \${ticket.userName || 'User'} (\${ticket.userEmail || 'No email'})</p>
            </div>
            <button onclick="document.getElementById('ticket-reply-modal').remove()" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
          </div>

          <div class="space-y-3">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer Message:</div>
              <div class="text-xs text-slate-800 whitespace-pre-wrap">\${ticket.message}</div>
            </div>

            \${ticket.reply ? \`
              <div class="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Last Sent Reply:</div>
                <div class="text-xs text-emerald-950 whitespace-pre-wrap">\${ticket.reply}</div>
              </div>
            \` : ''}

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-700 block">Dispatch Reply to Customer:</label>
              <textarea id="reply-text-input" rows="4" placeholder="Write official resolution or answer..." class="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-emerald-500 font-sans"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">Update Status:</label>
                <select id="reply-status-select" class="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 font-semibold focus:outline-emerald-500">
                  <option value="RESOLVED" \${ticket.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
                  <option value="IN_PROGRESS" \${ticket.status === 'IN_PROGRESS' ? 'selected' : ''}>IN_PROGRESS</option>
                  <option value="CLOSED" \${ticket.status === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
                  <option value="OPEN" \${ticket.status === 'OPEN' ? 'selected' : ''}>OPEN</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">Internal Admin Notes:</label>
                <input type="text" id="reply-admin-notes" value="\${ticket.adminNotes || ''}" placeholder="Optional private notes..." class="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-emerald-500">
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button onclick="document.getElementById('ticket-reply-modal').remove()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Cancel</button>
            <button onclick="sendTicketReply('\${ticket.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-sm">Send Official Reply</button>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }

    async function sendTicketReply(ticketId) {
      const reply = document.getElementById('reply-text-input').value.trim();
      const status = document.getElementById('reply-status-select').value;
      const adminNotes = document.getElementById('reply-admin-notes').value.trim();

      if (!reply) {
        showToast('Please type a reply message before submitting.', 'error');
        return;
      }

      const res = await apiFetch(\`/api/v1/commercial/admin/support-tickets/\${ticketId}/reply\`, {
        method: 'POST',
        body: JSON.stringify({ reply, status, adminNotes })
      });

      if (res.success) {
        showToast('Reply dispatched and ticket updated successfully!');
        const m = document.getElementById('ticket-reply-modal');
        if (m) m.remove();
        renderSupportTickets();
      } else {
        showToast(res.error || 'Failed to dispatch reply', 'error');
      }
    }

    let pricingState = {
      activeVersion: null,
      catalog: null,
      versions: [],
      syncStatus: {},
      revenue: null,
      currentCategory: 'personal',
      annualDiscountPercent: 50,
      subscriberPolicy: 'GRANDFATHER',
      draftPrices: {}
    };

    function onMonthlyPriceChange(planId) {
      const monthlyInput = document.getElementById('price-monthly-' + planId);
      const annualInput = document.getElementById('price-annual-' + planId);
      const equivBadge = document.getElementById('price-equiv-' + planId);
      if (!monthlyInput || !annualInput) return;

      const monthly = Math.max(0, parseInt(monthlyInput.value || '0', 10));
      const discount = Math.max(0, Math.min(100, pricingState.annualDiscountPercent));
      const annual = Math.round((monthly * 12) * (1 - (discount / 100)));

      annualInput.value = annual;
      if (equivBadge) {
        equivBadge.innerText = '₹' + Math.round(annual / 12).toLocaleString('en-IN') + '/mo';
      }

      pricingState.draftPrices[planId] = {
        planId: planId,
        monthlyPricePaise: monthly * 100,
        annualPricePaise: annual * 100,
        currency: 'INR'
      };
    }

    function onAnnualPriceChange(planId) {
      const annualInput = document.getElementById('price-annual-' + planId);
      const monthlyInput = document.getElementById('price-monthly-' + planId);
      const equivBadge = document.getElementById('price-equiv-' + planId);
      if (!annualInput) return;

      const annual = Math.max(0, parseInt(annualInput.value || '0', 10));
      if (equivBadge) {
        equivBadge.innerText = '₹' + Math.round(annual / 12).toLocaleString('en-IN') + '/mo';
      }

      pricingState.draftPrices[planId] = {
        planId: planId,
        monthlyPricePaise: (monthlyInput ? parseInt(monthlyInput.value || '0', 10) : Math.round(annual / 6)) * 100,
        annualPricePaise: annual * 100,
        currency: 'INR'
      };
    }

    function onDiscountPercentChange() {
      const discInput = document.getElementById('pricing-discount-input');
      if (!discInput) return;
      const val = Math.max(0, Math.min(100, parseInt(discInput.value || '50', 10)));
      pricingState.annualDiscountPercent = val;

      const allPlans = [...(pricingState.catalog?.personal || []), ...(pricingState.catalog?.business || [])];
      for (const p of allPlans) {
        const monthlyInput = document.getElementById('price-monthly-' + p.planId);
        if (monthlyInput) {
          onMonthlyPriceChange(p.planId);
        }
      }
      showToast(\`Annual discount updated to \${val}%. Recomputed annual prices.\`);
    }

    function switchPricingTab(category) {
      pricingState.currentCategory = category;
      const persTab = document.getElementById('pricing-tab-personal');
      const bizTab = document.getElementById('pricing-tab-business');
      const persGrid = document.getElementById('pricing-grid-personal');
      const bizGrid = document.getElementById('pricing-grid-business');

      if (category === 'personal') {
        persTab?.classList.replace('text-slate-500', 'text-emerald-700');
        persTab?.classList.replace('border-transparent', 'border-emerald-600');
        bizTab?.classList.replace('text-emerald-700', 'text-slate-500');
        bizTab?.classList.replace('border-emerald-600', 'border-transparent');
        persGrid?.classList.remove('hidden');
        bizGrid?.classList.add('hidden');
      } else {
        bizTab?.classList.replace('text-slate-500', 'text-emerald-700');
        bizTab?.classList.replace('border-transparent', 'border-emerald-600');
        persTab?.classList.replace('text-emerald-700', 'text-slate-500');
        persTab?.classList.replace('border-emerald-600', 'border-transparent');
        bizGrid?.classList.remove('hidden');
        persGrid?.classList.add('hidden');
      }
    }

    async function savePricingDraft() {
      const prices = Object.values(pricingState.draftPrices);
      if (prices.length === 0) {
        showToast('No price modifications made.', 'error');
        return;
      }

      const policyEl = document.getElementById('pricing-policy-select');
      const policy = policyEl ? policyEl.value : 'GRANDFATHER';

      const res = await apiFetch('/api/v1/admin/pricing/draft', {
        method: 'POST',
        body: JSON.stringify({
          prices: prices,
          annualDiscountPercent: pricingState.annualDiscountPercent,
          existingSubscriberPolicy: policy
        })
      });

      if (res.success) {
        showToast(\`Pricing draft v\${res.data.version} saved successfully!\`);
        renderPlans();
      } else {
        showToast(res.error || 'Failed to save draft', 'error');
      }
    }

    async function previewPricingModal() {
      const prices = Object.values(pricingState.draftPrices);
      const policyEl = document.getElementById('pricing-policy-select');
      const policy = policyEl ? policyEl.value : 'GRANDFATHER';

      const draftRes = await apiFetch('/api/v1/admin/pricing/draft', {
        method: 'POST',
        body: JSON.stringify({
          prices: prices,
          annualDiscountPercent: pricingState.annualDiscountPercent,
          existingSubscriberPolicy: policy
        })
      });

      if (!draftRes.success) {
        showToast(draftRes.error || 'Failed to prepare preview', 'error');
        return;
      }

      const draftVer = draftRes.data.version;
      const previewRes = await apiFetch(\`/api/v1/admin/pricing/preview/\${draftVer}\`);
      if (!previewRes.success) {
        showToast(previewRes.error || 'Failed to load preview', 'error');
        return;
      }

      const prev = previewRes.data;
      const modal = document.createElement('div');
      modal.id = 'pricing-preview-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
      modal.innerHTML = \`
        <div class="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-5">
          <div class="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 class="text-base font-bold text-slate-900">Preview Pricing Version v\${draftVer}</h3>
              <p class="text-xs text-slate-500">Inspect diffs, affected subscribers, and grandfathering policy before live publishing.</p>
            </div>
            <button onclick="document.getElementById('pricing-preview-modal').remove()" class="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <span class="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Subscriber Policy</span>
              <div class="text-xs font-black text-emerald-900 mt-1 font-mono">\${prev.existingSubscriberPolicy}</div>
            </div>
            <div class="p-3 bg-blue-50 rounded-2xl border border-blue-100">
              <span class="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Total Active Subs</span>
              <div class="text-base font-black text-blue-900 mt-0.5 font-mono">\${prev.activeSubscriberCount}</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Discount Rule</span>
              <div class="text-base font-black text-slate-900 mt-0.5 font-mono">\${prev.annualDiscountPercent}% OFF</div>
            </div>
          </div>

          <div class="max-h-64 overflow-y-auto custom-scroll border border-slate-200 rounded-2xl">
            <table class="w-full text-xs text-left">
              <thead class="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th class="p-2.5">Plan</th>
                  <th class="p-2.5">Old Monthly</th>
                  <th class="p-2.5">New Monthly</th>
                  <th class="p-2.5">Old Annual</th>
                  <th class="p-2.5">New Annual</th>
                  <th class="p-2.5 text-right">% Change</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-mono text-[11px]">
                \${prev.priceDiffs.map(d => \`
                  <tr class="\${d.monthlyChanged ? 'bg-amber-50/50' : ''}">
                    <td class="p-2.5 font-bold font-sans text-slate-800">\${d.displayName}</td>
                    <td class="p-2.5 text-slate-400">₹\${(d.oldMonthlyPaise / 100).toLocaleString('en-IN')}</td>
                    <td class="p-2.5 font-bold \${d.monthlyChanged ? 'text-emerald-700' : 'text-slate-700'}">₹\${(d.newMonthlyPaise / 100).toLocaleString('en-IN')}</td>
                    <td class="p-2.5 text-slate-400">₹\${(d.oldAnnualPaise / 100).toLocaleString('en-IN')}</td>
                    <td class="p-2.5 font-bold \${d.annualChanged ? 'text-emerald-700' : 'text-slate-700'}">₹\${(d.newAnnualPaise / 100).toLocaleString('en-IN')}</td>
                    <td class="p-2.5 text-right font-bold \${d.monthlyPercentChange > 0 ? 'text-rose-600' : d.monthlyPercentChange < 0 ? 'text-emerald-600' : 'text-slate-400'}">
                      \${d.monthlyPercentChange > 0 ? '+' : ''}\${d.monthlyPercentChange}%
                    </td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-slate-100">
            <div class="text-[11px] text-slate-500">
              Publishing creates immutable Version \${draftVer} and activates pricing live.
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="document.getElementById('pricing-preview-modal').remove()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Cancel</button>
              <button onclick="executePublishDraft(\${draftVer})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5">
                <span>✓ Confirm & Publish Live</span>
              </button>
            </div>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }

    async function executePublishDraft(version) {
      const modal = document.getElementById('pricing-preview-modal');
      if (modal) modal.remove();

      const policyEl = document.getElementById('pricing-policy-select');
      const policy = policyEl ? policyEl.value : 'GRANDFATHER';

      const res = await apiFetch(\`/api/v1/admin/pricing/publish/\${version}\`, {
        method: 'POST',
        body: JSON.stringify({ policy: policy })
      });

      if (res.success) {
        showToast(\`Pricing version v\${version} published LIVE successfully!\`);
        renderPlans();
      } else {
        showToast(res.error || 'Failed to publish version', 'error');
      }
    }

    async function promptRollback(version) {
      const reason = prompt(\`Enter rollback reason for Version \${version}:\`, 'Emergency pricing correction');
      if (!reason) return;

      const res = await apiFetch(\`/api/v1/admin/pricing/rollback/\${version}\`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason })
      });

      if (res.success) {
        showToast(\`Pricing successfully rolled back to Version \${version}!\`);
        renderPlans();
      } else {
        showToast(res.error || 'Rollback failed', 'error');
      }
    }

    async function renderPlans() {
      const container = document.getElementById('content-container');
      container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading pricing catalog and version state...</div>';

      const [catRes, actRes, verRes, syncRes, revRes] = await Promise.all([
        apiFetch('/api/v1/admin/pricing/catalog'),
        apiFetch('/api/v1/admin/pricing/active'),
        apiFetch('/api/v1/admin/pricing/versions'),
        apiFetch('/api/v1/admin/pricing/provider-sync-status'),
        apiFetch('/api/v1/admin/pricing/revenue-summary')
      ]);

      if (!catRes.success || !actRes.success) {
        container.innerHTML = \`<div class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">Failed to load pricing engine: \${catRes.error || actRes.error}</div>\`;
        return;
      }

      pricingState.catalog = catRes.data;
      pricingState.activeVersion = actRes.data;
      pricingState.versions = verRes.success ? verRes.data : [];
      pricingState.syncStatus = syncRes.success ? syncRes.data : {};
      pricingState.revenue = revRes.success ? revRes.data : null;
      pricingState.annualDiscountPercent = actRes.data.annualDiscountPercent || 50;
      pricingState.subscriberPolicy = actRes.data.existingSubscriberPolicy || 'GRANDFATHER';

      pricingState.draftPrices = {};
      const allPlans = [...(catRes.data.personal || []), ...(catRes.data.business || [])];
      for (const p of allPlans) {
        pricingState.draftPrices[p.planId] = {
          planId: p.planId,
          monthlyPricePaise: p.monthlyPricePaise,
          annualPricePaise: p.annualPricePaise,
          currency: 'INR'
        };
      }

      const activeVer = pricingState.activeVersion;
      const personalPlans = catRes.data.personal || [];
      const businessPlans = catRes.data.business || [];

      container.innerHTML = \`
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div class="flex items-center space-x-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">LIVE VERSION v\${activeVer.version}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">Policy: \${activeVer.existingSubscriberPolicy}</span>
                <span class="text-xs text-slate-400">Published \${new Date(activeVer.publishedAt).toLocaleDateString()} by \${activeVer.publishedBy}</span>
              </div>
              <h2 class="text-lg font-black text-slate-900 mt-1 tracking-tight">Admin Pricing & Plan Tiers Control Suite</h2>
              <p class="text-xs text-slate-500">Edit monthly price once — annual price auto-computes with 50% discount. Entitlements are strictly preserved.</p>
            </div>

            <div class="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Gateways:</span>
              <div class="flex items-center space-x-1.5 px-2 py-1 bg-white rounded-xl border border-slate-200 font-mono text-[11px]">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span class="text-slate-700 font-bold">Simulation</span>
              </div>
              <div class="flex items-center space-x-1.5 px-2 py-1 bg-white rounded-xl border border-slate-200 font-mono text-[11px]">
                <span class="w-2 h-2 rounded-full \${pricingState.syncStatus.stripe === 'SYNCED' ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
                <span class="text-slate-700 font-bold">Stripe</span>
              </div>
              <div class="flex items-center space-x-1.5 px-2 py-1 bg-white rounded-xl border border-slate-200 font-mono text-[11px]">
                <span class="w-2 h-2 rounded-full \${pricingState.syncStatus.razorpay === 'SYNCED' ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
                <span class="text-slate-700 font-bold">Razorpay</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div class="flex flex-col space-y-1">
              <label class="text-[11px] font-bold text-slate-600">Default Annual Discount %</label>
              <div class="flex items-center space-x-2">
                <input id="pricing-discount-input" type="number" min="0" max="90" value="\${pricingState.annualDiscountPercent}" onchange="onDiscountPercentChange()" class="w-20 px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 bg-slate-50">
                <span class="text-xs text-slate-500 font-bold">% off</span>
              </div>
            </div>

            <div class="flex flex-col space-y-1">
              <label class="text-[11px] font-bold text-slate-600">Subscriber Migration Policy</label>
              <select id="pricing-policy-select" class="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500">
                <option value="GRANDFATHER" \${pricingState.subscriberPolicy === 'GRANDFATHER' ? 'selected' : ''}>Grandfather (Keep old price indefinitely)</option>
                <option value="MIGRATE_RENEWAL" \${pricingState.subscriberPolicy === 'MIGRATE_RENEWAL' ? 'selected' : ''}>Migrate at Next Renewal</option>
                <option value="MIGRATE_IMMEDIATE" \${pricingState.subscriberPolicy === 'MIGRATE_IMMEDIATE' ? 'selected' : ''}>Migrate Immediately (Prorated)</option>
              </select>
            </div>

            <div class="md:col-span-2 flex items-center justify-end space-x-2">
              <button onclick="savePricingDraft()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs">
                Save Draft
              </button>
              <button onclick="previewPricingModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center space-x-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <span>Preview & Publish</span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-6 border-b border-slate-200 text-xs font-bold">
          <button id="pricing-tab-personal" onclick="switchPricingTab('personal')" class="pb-3 border-b-2 border-emerald-600 text-emerald-700 font-extrabold flex items-center space-x-2">
            <span>Personal Plans (Individual Users)</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">4</span>
          </button>
          <button id="pricing-tab-business" onclick="switchPricingTab('business')" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-2">
            <span>Business Plans (Teams & Organizations)</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">4</span>
          </button>
        </div>

        <div id="pricing-grid-personal" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          \${personalPlans.map(p => renderPlanCard(p)).join('')}
        </div>

        <div id="pricing-grid-business" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 hidden">
          \${businessPlans.map(p => renderPlanCard(p)).join('')}
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Pricing Version History & Audit Trail</h3>
              <p class="text-[11px] text-slate-400">All published snapshots are cryptographically versioned and rollback-ready.</p>
            </div>
            <span class="text-xs font-mono text-slate-500">\${pricingState.versions.length} versions</span>
          </div>

          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="p-3">Version</th>
                <th class="p-3">Status</th>
                <th class="p-3">Policy</th>
                <th class="p-3">Discount</th>
                <th class="p-3">Published At</th>
                <th class="p-3">Published By</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-mono text-[11px]">
              \${pricingState.versions.map(v => \`
                <tr class="\${v.version === activeVer.version ? 'bg-emerald-50/40 font-bold' : ''}">
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded font-black \${v.version === activeVer.version ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}">
                      v\${v.version}
                    </span>
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold \${v.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : v.status === 'SUPERSEDED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}">
                      \${v.status}
                    </span>
                  </td>
                  <td class="p-3 text-slate-600">\${v.existingSubscriberPolicy}</td>
                  <td class="p-3 text-slate-600">\${v.annualDiscountPercent}%</td>
                  <td class="p-3 text-slate-500 font-sans">\${v.publishedAt ? new Date(v.publishedAt).toLocaleString() : 'Draft'}</td>
                  <td class="p-3 text-slate-600 font-sans">\${v.publishedBy || 'SYSTEM'}</td>
                  <td class="p-3 text-right font-sans">
                    \${v.version !== activeVer.version && v.status === 'SUPERSEDED' ? \`
                      <button onclick="promptRollback(\${v.version})" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition">
                        Rollback
                      </button>
                    \` : v.version === activeVer.version ? \`
                      <span class="text-[10px] text-emerald-600 font-bold">Active</span>
                    \` : ''}
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    function renderPlanCard(p) {
      const monthlyPaise = p.monthlyPricePaise || 0;
      const annualPaise = p.annualPricePaise || 0;
      const monthlyRupees = Math.round(monthlyPaise / 100);
      const annualRupees = Math.round(annualPaise / 100);
      const isPopular = p.isPopular;

      return \`
        <div class="bg-white rounded-3xl border \${isPopular ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-md' : 'border-slate-200 shadow-xs'} p-5 flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-extrabold text-slate-900 text-sm tracking-tight">\${p.displayName}</h4>
                <span class="text-[10px] font-mono text-slate-400">\${p.planId}</span>
              </div>
              \${isPopular ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white uppercase tracking-wider">POPULAR</span>' : ''}
            </div>

            <div class="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <div>
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  <span>Monthly Price</span>
                  <span class="font-mono text-slate-400">₹ INR</span>
                </div>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                  <input id="price-monthly-\${p.planId}" type="number" step="1" value="\${monthlyRupees}" oninput="onMonthlyPriceChange('\${p.planId}')" class="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-emerald-500">
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  <span>Annual Price (Billed Yearly)</span>
                  <span id="price-equiv-\${p.planId}" class="font-mono text-emerald-700 text-[10px] font-bold">₹\${Math.round(annualRupees / 12).toLocaleString('en-IN')}/mo</span>
                </div>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                  <input id="price-annual-\${p.planId}" type="number" step="1" value="\${annualRupees}" oninput="onAnnualPriceChange('\${p.planId}')" class="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-emerald-500">
                </div>
                <p class="text-[9px] text-slate-400 mt-1">Auto-scales at 50% discount. Override permitted.</p>
              </div>
            </div>

            <div class="mt-4">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fixed Entitlements:</span>
              <ul class="mt-2 space-y-1.5 text-xs text-slate-700 font-medium">
                <li class="flex items-center justify-between">
                  <span class="text-slate-500">Profiles Limit:</span>
                  <span class="font-black text-slate-900 font-mono">\${p.profileLimit}</span>
                </li>
                \${p.seatLimit ? \`
                  <li class="flex items-center justify-between">
                    <span class="text-slate-500">Team Seats:</span>
                    <span class="font-black text-slate-900 font-mono">\${p.seatLimit === 999999 ? 'Unlimited' : p.seatLimit}</span>
                  </li>
                \` : ''}
                \${p.cloudMinutesMonthly ? \`
                  <li class="flex items-center justify-between">
                    <span class="text-slate-500">Cloud Android:</span>
                    <span class="font-black text-slate-900 font-mono">\${p.cloudMinutesMonthly} min/mo</span>
                  </li>
                \` : ''}
                \${p.proxyDataGbMonthly ? \`
                  <li class="flex items-center justify-between">
                    <span class="text-slate-500">Proxy Data:</span>
                    <span class="font-black text-slate-900 font-mono">\${p.proxyDataGbMonthly} GB/mo</span>
                  </li>
                \` : ''}
              </ul>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Capabilities: \${Object.keys(p.capabilities || {}).length}</span>
            <span class="text-emerald-700 font-bold">Separated from price ✓</span>
          </div>
        </div>
      \`;
    }

    async function renderLicenses() {
      const container = document.getElementById('content-container');
      container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading licenses...</div>';
      const res = await apiFetch('/api/v1/admin/licenses');
      if (!res.success) return;

      container.innerHTML = \`
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-slate-900">Mint New License Key</h3>
            <p class="text-xs text-slate-400">Generate a cryptographically signed MAHI Pro license key.</p>
          </div>
          <button onclick="promptMintLicense()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition">
            + Mint License Key
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Issued Licenses (\${res.data.length})</h3>
          </div>
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th class="p-3">Customer</th>
                <th class="p-3">Key Masked</th>
                <th class="p-3">Duration</th>
                <th class="p-3">Max Devices</th>
                <th class="p-3">Status</th>
                <th class="p-3">Expires</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              \${res.data.map(l => \`
                <tr class="hover:bg-slate-50">
                  <td class="p-3 font-bold text-slate-800">\${l.customerName}</td>
                  <td class="p-3 font-mono font-bold text-emerald-700">\${l.keyMasked}</td>
                  <td class="p-3 text-slate-600">\${l.durationType}</td>
                  <td class="p-3 text-slate-600">\${l.activeDevicesCount || 0} / \${l.maxDevices}</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${
                      l.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }">\${l.status}</span>
                  </td>
                  <td class="p-3 text-slate-400 text-[11px]">\${l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : 'Lifetime'}</td>
                  <td class="p-3 text-right space-x-1.5">
                    \${l.status === 'ACTIVE' ? \`
                      <button onclick="revokeLicenseKey('\${l.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[10px]">Revoke</button>
                    \` : ''}
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    async function promptMintLicense() {
      const name = prompt('Enter Customer / Client Name:', 'Client-1');
      if (!name) return;
      const res = await apiFetch('/api/v1/admin/licenses', {
        method: 'POST',
        body: JSON.stringify({
          customerName: name,
          durationType: '1_YEAR',
          maxDevices: 5
        })
      });
      if (res.success) {
        alert(\`License Minted Successfully!\\n\\nRaw Key (Save this): \${res.rawLicenseKey}\`);
        renderLicenses();
      } else {
        showToast(res.error || 'Minting failed', 'error');
      }
    }

    async function revokeLicenseKey(licenseId) {
      if (!confirm('Are you sure you want to revoke this license?')) return;
      const res = await apiFetch('/api/v1/admin/licenses/revoke', {
        method: 'POST',
        body: JSON.stringify({ licenseId, reason: 'Revoked from Admin Panel' })
      });
      if (res.success) {
        showToast('License revoked');
        renderLicenses();
      }
    }

    async function renderDevices() {
      const container = document.getElementById('content-container');
      const res = await apiFetch('/api/v1/admin/devices');
      if (!res.success) return;

      container.innerHTML = \`
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Active Authorized Devices (\${res.data.length})</h3>
          </div>
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th class="p-3">Device Name</th>
                <th class="p-3">Device ID</th>
                <th class="p-3">OS / Arch</th>
                <th class="p-3">Status</th>
                <th class="p-3">Last Seen</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              \${res.data.map(d => \`
                <tr class="hover:bg-slate-50">
                  <td class="p-3 font-bold text-slate-800">\${d.deviceName}</td>
                  <td class="p-3 font-mono text-[11px] text-slate-500">\${d.deviceId}</td>
                  <td class="p-3 text-slate-600">\${d.osInfo}</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${
                      d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }">\${d.status}</span>
                  </td>
                  <td class="p-3 text-slate-400 text-[11px]">\${new Date(d.lastSeenAt).toLocaleString()}</td>
                  <td class="p-3 text-right">
                    \${d.status === 'ACTIVE' ? \`
                      <button onclick="revokeDevice('\${d.deviceId}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[10px]">Revoke Access</button>
                    \` : ''}
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    async function revokeDevice(deviceId) {
      if (!confirm('Revoke access for this device?')) return;
      const res = await apiFetch(\`/api/v1/admin/devices/\${deviceId}\`, { method: 'DELETE' });
      if (res.success) {
        showToast('Device revoked successfully');
        renderDevices();
      }
    }

    async function renderVersions() {
      const container = document.getElementById('content-container');
      const res = await apiFetch('/api/v1/admin/versions');
      if (!res.success) return;

      container.innerHTML = \`
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-slate-900">Publish Software Release</h3>
            <p class="text-xs text-slate-400">Release a new client version and set minimum supported versions.</p>
          </div>
          <button onclick="promptPublishVersion()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition">
            + Publish Release
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Version History</h3>
          </div>
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th class="p-3">Version</th>
                <th class="p-3">Min Required</th>
                <th class="p-3">Release Notes</th>
                <th class="p-3">Mandatory</th>
                <th class="p-3">Released At</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              \${res.data.map(v => \`
                <tr class="hover:bg-slate-50">
                  <td class="p-3 font-mono font-bold text-emerald-700">v\${v.version}</td>
                  <td class="p-3 font-mono text-slate-500">v\${v.minSupportedVersion}</td>
                  <td class="p-3 text-slate-700">\${v.releaseNotes}</td>
                  <td class="p-3">\${v.isMandatory ? '<span class="text-rose-600 font-bold">YES</span>' : '<span class="text-slate-400">NO</span>'}</td>
                  <td class="p-3 text-slate-400 text-[11px]">\${new Date(v.releasedAt).toLocaleString()}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    }

    async function promptPublishVersion() {
      const ver = prompt('Enter Version Number (e.g. 2.1.0):');
      if (!ver) return;
      const notes = prompt('Enter Release Notes:', 'Performance improvements and bug fixes.');
      const res = await apiFetch('/api/v1/admin/versions', {
        method: 'POST',
        body: JSON.stringify({
          version: ver,
          releaseNotes: notes || '',
          minSupportedVersion: '1.0.0',
          isMandatory: false
        })
      });
      if (res.success) {
        showToast(\`Release v\${ver} published successfully!\`);
        renderVersions();
      }
    }

    async function renderAuditLogs() {
      const container = document.getElementById('content-container');
      const res = await apiFetch('/api/v1/admin/audit-logs');
      if (!res.success) return;

      container.innerHTML = \`
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Tamper-Proof Audit Trail (\${res.total})</h3>
          </div>
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
              <tr>
                <th class="p-3">Timestamp</th>
                <th class="p-3">Actor</th>
                <th class="p-3">Action</th>
                <th class="p-3">Target</th>
                <th class="p-3">Details</th>
                <th class="p-3">Result</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              \${res.data.map(l => \`
                <tr class="hover:bg-slate-50">
                  <td class="p-3 font-mono text-[11px] text-slate-400">\${new Date(l.createdAt).toLocaleString()}</td>
                  <td class="p-3 font-bold text-slate-700">\${l.actorName} <span class="text-[10px] text-slate-400">(\${l.actorRole})</span></td>
                  <td class="p-3 font-mono font-semibold text-emerald-700">\${l.action}</td>
                  <td class="p-3 font-mono text-[11px] text-slate-500">\${l.targetType}</td>
                  <td class="p-3 text-slate-600">\${l.details}</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold \${l.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">\${l.result}</span></td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`;
    async function renderDemoRequests(statusFilter = '') {
      const container = document.getElementById('content-container');
      const url = statusFilter ? \`/api/v1/commercial/admin/demo-requests?status=\${encodeURIComponent(statusFilter)}\` : '/api/v1/commercial/admin/demo-requests';
      const res = await apiFetch(url);
      if (!res.success) {
        container.innerHTML = '<div class="p-6 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold">Failed to load demo requests</div>';
        return;
      }

      const leads = res.data || [];
      const statuses = ['NEW', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'CLOSED'];

      container.innerHTML = \`
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <button onclick="renderDemoRequests('')" class="px-3 py-1.5 rounded-xl text-xs font-bold \${!statusFilter ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}">All (\${leads.length})</button>
              \${statuses.map(st => \`
                <button onclick="renderDemoRequests('\${st}')" class="px-3 py-1.5 rounded-xl text-xs font-bold \${statusFilter === st ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}">\${st}</button>
              \`).join('')}
            </div>
            <button onclick="renderDemoRequests('\${statusFilter}')" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50">↻ Refresh</button>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th class="p-3">Date</th>
                  <th class="p-3">Lead / Contact</th>
                  <th class="p-3">Company & Team</th>
                  <th class="p-3">Use Case</th>
                  <th class="p-3">Contact Preference</th>
                  <th class="p-3">Status</th>
                  <th class="p-3 text-right">Update Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                \${leads.length === 0 ? '<tr><td colspan="7" class="p-8 text-center text-slate-400">No demo requests found</td></tr>' : leads.map(lead => \`
                  <tr class="hover:bg-slate-50">
                    <td class="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">\${new Date(lead.createdAt).toLocaleDateString()}</td>
                    <td class="p-3">
                      <div class="font-bold text-slate-900">\${lead.fullName}</div>
                      <div class="text-[11px] text-slate-500 font-mono">\${lead.email}</div>
                    </td>
                    <td class="p-3">
                      <div class="font-bold text-slate-800">\${lead.companyName || '—'}</div>
                      <div class="text-[11px] text-slate-500">\${lead.teamSize} members</div>
                    </td>
                    <td class="p-3 text-slate-700 max-w-xs truncate">\${lead.useCase}</td>
                    <td class="p-3">
                      <div class="text-slate-800 font-medium">\${lead.contactMethod}</div>
                      \${lead.preferredDatetime ? \`<div class="text-[10px] text-slate-400">\${lead.preferredDatetime}</div>\` : ''}
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase \${
                        lead.status === 'NEW' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                        lead.status === 'SCHEDULED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        lead.status === 'COMPLETED' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        lead.status === 'CONTACTED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }">\${lead.status}</span>
                    </td>
                    <td class="p-3 text-right">
                      <select onchange="updateDemoStatus('\${lead.id}', this.value)" class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none">
                        \${statuses.map(s => \`<option value="\${s}" \${lead.status === s ? 'selected' : ''}>\${s}</option>\`).join('')}
                      </select>
                    </td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      \`;
    }

    async function updateDemoStatus(id, newStatus) {
      const res = await apiFetch(\`/api/v1/commercial/admin/demo-requests/\${id}/status\`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.success) {
        showToast('Lead status updated to ' + newStatus);
        renderDemoRequests();
      } else {
        showToast(res.error || 'Failed to update status', 'error');
      }
    }

    async function renderFunnelTelemetry() {
      const container = document.getElementById('content-container');
      const res = await apiFetch('/api/v1/commercial/admin/funnel-metrics');
      if (!res.success) {
        container.innerHTML = '<div class="p-6 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold">Failed to load funnel metrics</div>';
        return;
      }

      const m = res.data;
      container.innerHTML = \`
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CTA Clicks</span>
              <div class="text-2xl font-black text-slate-900 mt-1 font-mono">\${m.landingCtaClicks}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Landing engagement</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signup Starts</span>
              <div class="text-2xl font-black text-sky-600 mt-1 font-mono">\${m.signupStarts}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Registration begun</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accounts Created</span>
              <div class="text-2xl font-black text-emerald-600 mt-1 font-mono">\${m.signupCompletions}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">\${m.signupRate}% completion</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">7-Day Trials</span>
              <div class="text-2xl font-black text-amber-600 mt-1 font-mono">\${m.trialActivations}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Server entitlements</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Downloads</span>
              <div class="text-2xl font-black text-purple-600 mt-1 font-mono">\${m.downloadsStarted}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Windows x64 installer</div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid Conversions</span>
              <div class="text-2xl font-black text-emerald-700 mt-1 font-mono">\${m.paidConversions}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">\${m.overallConversionRate}% overall</div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 class="text-sm font-bold text-slate-900">Onboarding Pipeline Health</h3>
            <div class="space-y-3">
              <div>
                <div class="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Signup Completion (Starts → Created)</span>
                  <span>\${m.signupRate}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                  <div class="bg-emerald-500 h-2 rounded-full" style="width: \${Math.min(100, m.signupRate)}%"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Download Activation (Signups → Downloads)</span>
                  <span>\${m.downloadRate}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                  <div class="bg-purple-500 h-2 rounded-full" style="width: \${Math.min(100, m.downloadRate)}%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    async function renderPayments() {
      const container = document.getElementById('content-container');
      container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading payments and verification queue...</div>';
      const res = await apiFetch('/api/v1/admin/payments');
      if (!res.success) {
        container.innerHTML = \`<div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">Failed to load payments: \${res.error || 'Unauthorized'}</div>\`;
        return;
      }
      const list = res.data || res.payments || [];
      const pendingCount = list.filter(p => p.status === 'PENDING_VERIFICATION').length;

      container.innerHTML = \`
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Payments & Verification Queue</h2>
              <p class="text-xs text-slate-500">Review manual UPI UTR submissions, approve entitlements, or reject invalid transactions.</p>
            </div>
            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-1 rounded-full text-xs font-bold \${pendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">
                \${pendingCount} Pending Verification
              </span>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th class="p-3">Payment ID / Date</th>
                    <th class="p-3">User ID</th>
                    <th class="p-3">Plan / Cycle</th>
                    <th class="p-3">Amount</th>
                    <th class="p-3">Provider / Reference (UTR)</th>
                    <th class="p-3">Status</th>
                    <th class="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  \${list.length > 0 ? list.map(p => {
                    const isPending = p.status === 'PENDING_VERIFICATION';
                    const isSucceeded = p.status === 'SUCCEEDED';
                    const isRejected = p.status === 'REJECTED' || p.status === 'FAILED';
                    const amountFormatted = p.currency === 'INR'
                      ? '₹' + (p.amountCents / 100).toLocaleString('en-IN')
                      : '$' + (p.amountCents / 100).toFixed(2);
                    const statusBadge = isPending
                      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending Review</span>'
                      : isSucceeded
                      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Succeeded</span>'
                      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>';

                    const safeProofAsset = (p.metadata?.proofAsset && (p.metadata.proofAsset.startsWith('https://') || p.metadata.proofAsset.startsWith('/')))
                      ? p.metadata.proofAsset
                      : null;
                    const proofHtml = safeProofAsset
                      ? \\\`<a href="\${escapeHtml(safeProofAsset)}" target="_blank" rel="noopener noreferrer" class="text-[10px] text-emerald-600 hover:underline block mt-0.5 font-medium">View Proof</a>\\\`
                      : (p.metadata?.proofAsset ? \\\`<span class="text-[10px] text-slate-400 block mt-0.5">Proof: \${escapeHtml(p.metadata.proofAsset)}</span>\\\` : '');

                    const rejectionHtml = (p.metadata?.rejectionReason && isRejected)
                      ? \\\`<div class="text-[10px] text-rose-600 font-medium mt-0.5 leading-tight">Reason: \${escapeHtml(p.metadata.rejectionReason)}</div>\\\`
                      : '';

                    return \`
                      <tr class="hover:bg-slate-50/80 transition-colors">
                        <td class="p-3">
                          <div class="font-mono font-bold text-slate-800 text-[11px]">\${escapeHtml(p.id)}</div>
                          <div class="text-[10px] text-slate-400 mt-0.5">\${escapeHtml(new Date(p.createdAt).toLocaleString())}</div>
                        </td>
                        <td class="p-3">
                          <div class="font-mono text-slate-700 text-[11px]">\${escapeHtml(p.userId)}</div>
                        </td>
                        <td class="p-3">
                          <div class="font-bold text-slate-800 capitalize">\${escapeHtml((p.planId || '').replace(/_/g, ' '))}</div>
                          <div class="text-[10px] text-slate-400 uppercase font-semibold">\${escapeHtml(p.billingCycle)}</div>
                        </td>
                        <td class="p-3 font-mono font-extrabold text-slate-900">\${amountFormatted}</td>
                        <td class="p-3">
                          <div class="flex items-center space-x-1.5">
                            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600">\${escapeHtml(p.provider)}</span>
                            <span class="font-mono font-bold text-slate-900 text-[11px]">\${escapeHtml(p.externalPaymentId || '-')}</span>
                          </div>
                          \${proofHtml}
                        </td>
                        <td class="p-3">
                          \${statusBadge}
                          \${rejectionHtml}
                        </td>
                        <td class="p-3 text-right">
                          \${isPending ? \`
                            <div class="flex items-center justify-end space-x-1.5">
                              <button onclick="approvePayment('\${escapeHtml(p.id)}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-xs transition">
                                Approve
                              </button>
                              <button onclick="rejectPayment('\${escapeHtml(p.id)}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition">
                                Reject
                              </button>
                            </div>
                          \` : \\\`<span class="text-[11px] text-slate-400 italic">Completed</span>\\\`}
                        </td>
                      </tr>
                    \`;
                  }).join('') : \`
                    <tr>
                      <td colspan="7" class="p-8 text-center text-slate-400">No payment transactions recorded yet.</td>
                    </tr>
                  \`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      \`;
    }

    async function approvePayment(id) {
      if (!confirm('Approve this payment and immediately activate the user subscription?')) return;
      const res = await apiFetch('/api/v1/admin/payments/' + encodeURIComponent(id) + '/approve', { method: 'POST' });
      if (res.success) {
        showToast('Payment approved & subscription activated successfully!');
        renderPayments();
      } else {
        showToast('Approval failed: ' + (res.error || 'Unknown error'), 'error');
      }
    }

    async function rejectPayment(id) {
      const reason = prompt('Please enter rejection reason (e.g. Invalid UTR / Amount Mismatch):');
      if (reason === null) return;
      const res = await apiFetch('/api/v1/admin/payments/' + encodeURIComponent(id) + '/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || 'Payment rejected by administrator' })
      });
      if (res.success) {
        showToast('Payment marked as rejected.');
        renderPayments();
      } else {
        showToast('Rejection failed: ' + (res.error || 'Unknown error'), 'error');
      }
    }

    // Initial Load
    renderPage();
  </script>
</body>
</html>`;
}
