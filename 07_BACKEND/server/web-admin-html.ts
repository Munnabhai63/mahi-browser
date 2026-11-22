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
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
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
          <input type="password" id="admin-secret-input" value="${process.env.ADMIN_BOOTSTRAP_TOKEN || ''}" placeholder="Enter Admin Secret" onkeydown="if(event.key==='Enter')refreshData()" class="bg-transparent text-slate-800 font-mono text-xs focus:outline-none w-36">
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
      const inputEl = document.getElementById('admin-secret-input');
      let val = inputEl?.value?.trim();
      if (val) {
        try {
          sessionStorage.setItem('mahi_admin_secret', val);
          localStorage.setItem('mahi_admin_secret', val);
        } catch {}
        return val;
      }
      try {
        val = localStorage.getItem('mahi_admin_secret') || sessionStorage.getItem('mahi_admin_secret') || '';
        if (val) {
          if (inputEl && !inputEl.value) inputEl.value = val;
          return val;
        }
      } catch {}
      return '';
    }

    async function apiFetch(url, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        'X-Admin-Secret': getAdminSecret(),
        ...(options.headers || {})
      };
      try {
        const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
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

    function copyToClipboard(text, el, label = 'Copied to clipboard!') {
      if (!text) return;
      const done = () => {
        showToast(label);
        if (el) {
          const orig = el.innerHTML;
          el.innerHTML = '✓ Copied';
          el.classList.add('text-emerald-600', 'font-bold');
          setTimeout(() => {
            el.innerHTML = orig;
            el.classList.remove('text-emerald-600', 'font-bold');
          }, 1500);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    }

    function fallbackCopy(text, cb) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); if (cb) cb(); } catch (e) {}
      document.body.removeChild(ta);
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
      container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading users and terms compliance...</div>';
      const [res, termsRes] = await Promise.all([
        apiFetch('/api/v1/admin/users'),
        apiFetch('/api/v1/admin/terms-compliance')
      ]);
      if (!res.success) {
        container.innerHTML = \`<div class="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl">\${res.error || 'Failed to load users'}</div>\`;
        return;
      }
      const termsData = (termsRes && termsRes.success && termsRes.data) || { totalUsers: 0, accepted: 0, missing: 0, byVersion: {} };

      container.innerHTML = \`
        <!-- Terms Acceptance & Legal Compliance Panel -->
        <div class="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-800">Legal & Terms Compliance Overview</h4>
              <p class="text-[11px] text-slate-400 mt-0.5">Tracking IT Rules 2021 & Terms of Service Acceptance across user accounts</p>
            </div>
            <button onclick="renderUsers()" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition">🔄 Refresh</button>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="text-[10px] font-bold text-slate-500 uppercase">Total Users</div>
              <div class="text-2xl font-extrabold text-slate-900 mt-1 font-mono">\${termsData.totalUsers ?? 0}</div>
            </div>
            <div class="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <div class="text-[10px] font-bold text-emerald-700 uppercase">Accepted</div>
              <div class="text-2xl font-extrabold text-emerald-800 mt-1 font-mono">\${termsData.accepted ?? 0}</div>
            </div>
            <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
              <div class="text-[10px] font-bold text-amber-700 uppercase">Missing</div>
              <div class="text-2xl font-extrabold text-amber-800 mt-1 font-mono">\${termsData.missing ?? 0}</div>
            </div>
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div class="text-[10px] font-bold text-slate-500 uppercase">Unversioned</div>
              <div class="text-2xl font-extrabold text-slate-800 mt-1 font-mono">\${(termsData.byVersion && termsData.byVersion['unversioned']) || 0}</div>
            </div>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100">
            <div class="text-[11px] font-bold text-slate-700 mb-2">Breakdown by Terms Version</div>
            <div class="flex flex-wrap gap-2">
              \${termsData.byVersion && Object.keys(termsData.byVersion).length > 0 ? Object.entries(termsData.byVersion).map(([v, count]) => \`
                <span class="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                  <strong class="text-slate-900">\${v}</strong>: \${count} users
                </span>
              \`).join('') : '<span class="text-xs text-slate-400">No versioned records.</span>'}
            </div>
          </div>
          <div class="mt-3 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-[11px] leading-relaxed">
            Users who registered before terms tracking was added will show as missing. This is expected, not an error.
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Registered Users (\${res.total})</h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Manage customer quotas, GoLogin-style boosters, enterprise feature overrides & HWID locks</p>
            </div>
            <div class="flex items-center space-x-2">
              <input type="text" id="user-filter-input" placeholder="🔍 Search name, email, or ID..." oninput="filterUsersTable(this.value)"
                class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-emerald-500 w-64 font-medium">
              <button onclick="renderUsers()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">🔄 Refresh</button>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th class="p-3">User Details</th>
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
                  <tr class="hover:bg-slate-50 transition" data-user-row="true">
                    <td class="p-3" style="user-select: text;">
                      <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs uppercase">
                          \${(u.name || u.email || 'U').charAt(0)}
                        </div>
                        <div class="space-y-1 min-w-0">
                          <div class="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                            <span class="truncate">\${u.name || 'Unnamed User'}</span>
                            <button onclick="copyToClipboard('\${(u.name || '').replace(/'/g, \"\\\\'\")}', this, 'Name copied!')" class="text-slate-400 hover:text-slate-700 text-[10px] p-0.5" title="Copy Name">📋</button>
                          </div>
                          <div class="flex items-center space-x-1.5">
                            <span class="text-[11px] text-slate-700 font-mono font-medium truncate">\${u.email}</span>
                            <button onclick="copyToClipboard('\${u.email}', this, 'Email copied!')" class="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold border border-slate-200 transition shrink-0" title="Click to copy email">
                              📋 Copy Email
                            </button>
                          </div>
                          <div class="flex items-center space-x-1">
                            <span class="text-[10px] text-slate-400 font-mono truncate">ID: \${u.id}</span>
                            <button onclick="copyToClipboard('\${u.id}', this, 'User ID copied!')" class="text-slate-400 hover:text-slate-700 text-[10px] p-0.5 shrink-0" title="Copy User ID">📋</button>
                          </div>
                        </div>
                      </div>
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
                      <button onclick="openGrantPremiumModal('\${u.id}', '\${(u.name || '').replace(/'/g, \"\\\\'\")}', '\${u.email}')" class="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-bold text-[10px] shadow-xs transition active:scale-95 inline-flex items-center space-x-1" title="Direct 1-Click Premium License Grant">
                        <span>👑</span>
                        <span>Grant Premium</span>
                      </button>
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

    function filterUsersTable(query) {
      const q = (query || '').toLowerCase().trim();
      const rows = document.querySelectorAll('tbody tr[data-user-row]');
      rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
      });
    }

    function openGrantPremiumModal(userId, name, email) {
      const modal = document.createElement('div');
      modal.id = 'grant-premium-modal';
      modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
      modal.innerHTML = \`
        <div class="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center space-x-2.5">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-lg shadow-sm">
                👑
              </div>
              <div>
                <h3 class="text-sm font-extrabold text-slate-900">Grant Premium License</h3>
                <p class="text-[11px] text-slate-400">Owner-level manual entitlement grant</p>
              </div>
            </div>
            <button onclick="document.getElementById('grant-premium-modal').remove()" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
          </div>

          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-medium">Target User:</span>
              <span class="font-bold text-slate-900 font-mono">\${name || 'User'}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-medium">Email:</span>
              <div class="flex items-center space-x-1">
                <span class="font-mono text-slate-800 font-medium">\${email}</span>
                <button onclick="copyToClipboard('\${email}', this, 'Copied!')" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100 transition">📋 Copy</button>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-medium">User ID:</span>
              <div class="flex items-center space-x-1">
                <span class="font-mono text-slate-500 text-[11px] truncate max-w-[200px]">\${userId}</span>
                <button onclick="copyToClipboard('\${userId}', this, 'Copied!')" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100 transition">📋 Copy</button>
              </div>
            </div>
          </div>

          <div id="grant-modal-form" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">Choose Commercial Plan</label>
              <select id="modal-grant-plan" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-purple-500 font-medium">
                <option value="plan_pro" selected>Professional (50 Profiles + Unlimited)</option>
                <option value="plan_starter">Starter (10 Profiles)</option>
                <option value="plan_enterprise">Enterprise (Unlimited Profiles + Full API)</option>
                <option value="plan_agency">Agency Fleet (Multi-Seat + Qunkong)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5">Duration</label>
              <select id="modal-grant-duration" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-purple-500 font-medium">
                <option value="30_DAYS" selected>30 Days (1 Month)</option>
                <option value="90_DAYS">90 Days (Quarterly)</option>
                <option value="1_YEAR">1 Year (Annual)</option>
                <option value="LIFETIME">Lifetime License</option>
              </select>
            </div>

            <div id="modal-totp-box" class="hidden p-3.5 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
              <div class="text-xs font-bold text-purple-900 flex items-center space-x-1.5">
                <span>🔐</span>
                <span>Google Authenticator Verification Required</span>
              </div>
              <p class="text-[11px] text-purple-700">Enter the 6-digit code from your phone's Authenticator app:</p>
              <input type="text" id="modal-totp-code" maxlength="6" inputmode="numeric" placeholder="123456"
                class="w-full text-center font-mono text-xl tracking-[0.3em] py-2 bg-white border border-purple-300 rounded-xl focus:outline-purple-600 text-slate-900">
            </div>

            <div id="modal-grant-error" class="hidden p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl"></div>

            <div class="pt-2 flex items-center justify-between border-t border-slate-100">
              <a href="/super-admin?action=grant&userId=\${encodeURIComponent(userId)}&email=\${encodeURIComponent(email)}&name=\${encodeURIComponent(name)}"
                class="text-xs text-purple-600 hover:text-purple-800 font-bold transition flex items-center space-x-1">
                <span>Super Admin Suite →</span>
              </a>
              <div class="flex items-center space-x-2">
                <button onclick="document.getElementById('grant-premium-modal').remove()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
                  Cancel
                </button>
                <button id="modal-grant-btn" onclick="executeModalGrant('\${userId}')" class="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 transition active:scale-95">
                  👑 Issue Premium Now
                </button>
              </div>
            </div>
          </div>

          <div id="modal-grant-result" class="hidden p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
            <div class="text-center">
              <div class="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold mb-1">
                ✓
              </div>
              <h4 class="text-sm font-extrabold text-emerald-900">Premium License Issued!</h4>
              <p class="text-[11px] text-emerald-700">Account has been upgraded successfully.</p>
            </div>
            <div class="bg-white p-3 rounded-xl border border-emerald-200/80">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">One-Time License Key:</label>
              <div class="flex items-center space-x-2">
                <input type="text" id="modal-raw-key" readonly class="w-full font-mono text-xs text-slate-800 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 select-all">
                <button onclick="copyToClipboard(document.getElementById('modal-raw-key').value, this, 'License Key Copied!')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shrink-0">
                  📋 Copy
                </button>
              </div>
            </div>
            <div class="text-center pt-2">
              <button onclick="document.getElementById('grant-premium-modal').remove(); renderUsers();" class="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition">
                Done & Refresh Table
              </button>
            </div>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }

    async function executeModalGrant(userId) {
      const planId = document.getElementById('modal-grant-plan')?.value || 'plan_pro';
      const duration = document.getElementById('modal-grant-duration')?.value || '30_DAYS';
      const errorDiv = document.getElementById('modal-grant-error');
      const totpBox = document.getElementById('modal-totp-box');
      const totpCodeInput = document.getElementById('modal-totp-code');
      const grantBtn = document.getElementById('modal-grant-btn');

      if (errorDiv) {
        errorDiv.classList.add('hidden');
        errorDiv.innerText = '';
      }

      const totpCode = totpCodeInput ? totpCodeInput.value.trim() : '';

      if (totpBox && !totpBox.classList.contains('hidden')) {
        if (!totpCode || totpCode.length !== 6) {
          errorDiv.classList.remove('hidden');
          errorDiv.innerText = 'Please enter a valid 6-digit Google Authenticator code.';
          return;
        }
        grantBtn.disabled = true;
        grantBtn.innerText = 'Verifying Authenticator...';
        const verifyRes = await apiFetch('/api/v1/admin/owner/verify', {
          method: 'POST',
          body: JSON.stringify({ code: totpCode })
        });
        if (!verifyRes.success) {
          grantBtn.disabled = false;
          grantBtn.innerText = '👑 Issue Premium Now';
          errorDiv.classList.remove('hidden');
          errorDiv.innerText = verifyRes.error || 'Invalid Authenticator code. Please check your phone.';
          return;
        }
      }

      grantBtn.disabled = true;
      grantBtn.innerText = 'Issuing License...';

      const res = await apiFetch('/api/v1/admin/owner/grant', {
        method: 'POST',
        body: JSON.stringify({ userId, planId, duration })
      });

      grantBtn.disabled = false;
      grantBtn.innerText = '👑 Issue Premium Now';

      if (res.success) {
        document.getElementById('grant-modal-form').classList.add('hidden');
        const resBox = document.getElementById('modal-grant-result');
        resBox.classList.remove('hidden');
        document.getElementById('modal-raw-key').value = res.data?.rawKey || res.rawKey || 'LICENSE-ISSUED';
        showToast('Premium license issued successfully!');
      } else {
        if (res.error && res.error.toLowerCase().includes('owner session')) {
          if (totpBox) totpBox.classList.remove('hidden');
          if (errorDiv) {
            errorDiv.classList.remove('hidden');
            errorDiv.innerText = 'Security Step-Up required. Please enter your 6-digit Authenticator code above.';
          }
          if (totpCodeInput) totpCodeInput.focus();
        } else {
          if (errorDiv) {
            errorDiv.classList.remove('hidden');
            errorDiv.innerText = res.error || 'Failed to grant premium.';
          }
        }
      }
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
    }

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
                      ? ('<a href="' + escapeHtml(safeProofAsset) + '" target="_blank" rel="noopener noreferrer" class="text-[10px] text-emerald-600 hover:underline block mt-0.5 font-medium">View Proof</a>')
                      : (p.metadata?.proofAsset ? ('<span class="text-[10px] text-slate-400 block mt-0.5">Proof: ' + escapeHtml(p.metadata.proofAsset) + '</span>') : '');

                    const rejectionHtml = (p.metadata?.rejectionReason && isRejected)
                      ? ('<div class="text-[10px] text-rose-600 font-medium mt-0.5 leading-tight">Reason: ' + escapeHtml(p.metadata.rejectionReason) + '</div>')
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
                          \` : '<span class="text-[11px] text-slate-400 italic">Completed</span>'}
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

export function getOwnerAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <title>MAHI — Owner Zone Console</title>
  <style>
    ${ADMIN_STYLESHEET}
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 9999px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
  <!-- Top Navigation Bar -->
  <header class="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-purple-500/20">
        👑
      </div>
      <div>
        <div class="flex items-center space-x-2">
          <h1 class="text-sm font-bold tracking-tight text-white">MAHI OWNER ZONE</h1>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">RESTRICTED</span>
        </div>
        <p class="text-[10px] text-slate-400">RFC 6238 Step-Up Protected Entitlement Console</p>
      </div>
    </div>
    <div class="flex items-center space-x-4">
      <div class="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
        <span class="text-[10px] text-slate-400 uppercase font-semibold">Admin Key:</span>
        <input type="password" id="owner-admin-secret" value="${process.env.ADMIN_BOOTSTRAP_TOKEN || ''}" placeholder="Admin Secret" class="bg-transparent text-white font-mono text-xs focus:outline-none w-32">
      </div>
      <button id="lock-console-btn" onclick="lockConsole()" class="px-3.5 py-1.5 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-700/50 rounded-xl text-xs font-bold transition flex items-center space-x-1.5">
        <span>🔒</span>
        <span>Lock Console</span>
      </button>
      <a href="/admin" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition">
        ← Back to Admin
      </a>
    </div>
  </header>

  <!-- Step 1: TOTP Login Screen (Bypassed for Testing) -->
  <div id="totp-auth-panel" class="hidden flex-1 items-center justify-center p-6">
    <div class="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
      <div class="text-center space-y-2">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-3xl">
          👑
        </div>
        <h2 class="text-xl font-bold text-white tracking-tight">MAHI OWNER ZONE</h2>
        <p class="text-xs text-slate-400">Enter the 6-digit verification code from your Google Authenticator app</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">Security Verification Code</label>
          <input type="text" id="totp-input" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" autofocus
            onkeydown="if(event.key==='Enter')submitVerifyTotp()"
            class="w-full text-center font-mono text-3xl tracking-[0.5em] py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-2xl text-white outline-none transition shadow-inner">
        </div>

        <div id="auth-error-msg" class="hidden p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold text-center"></div>

        <button onclick="submitVerifyTotp()" id="verify-btn" class="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-purple-500/20 transition active:scale-95">
          Verify Security Code
        </button>

        <div class="text-center">
          <a href="/admin" class="text-xs text-slate-400 hover:text-slate-200 transition">← Return to General Admin</a>
        </div>
      </div>
    </div>
  </div>

  <!-- Step 2: Owner Console Grid (Directly Visible) -->
  <main id="owner-console-panel" class="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6 custom-scroll">
    <div class="flex items-center justify-between pb-4 border-b border-slate-800">
      <div>
        <h2 class="text-lg font-bold text-white flex items-center space-x-2">
          <span>👑</span>
          <span>Privileged Owner Console</span>
        </h2>
        <p class="text-xs text-slate-400">Direct manual entitlements, plan management, and account enforcement</p>
      </div>
      <div class="flex items-center space-x-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Owner Console Active</span>
      </div>
    </div>

    <!-- 4 Action Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- CARD 1: Grant Premium -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-bold text-white flex items-center space-x-2">
            <span class="text-emerald-400">👑</span>
            <span>Grant Premium License</span>
          </h3>
          <span class="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Target User</label>
            <div class="relative">
              <input type="text" id="grant-user-search" placeholder="Search user by email or ID..." oninput="searchUsers('grant', this.value)"
                class="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white outline-none">
              <div id="grant-search-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl max-h-48 overflow-y-auto z-20 shadow-2xl custom-scroll"></div>
            </div>
            <div id="grant-selected-badge" class="hidden mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
              <span id="grant-selected-text"></span>
              <button onclick="clearSelectedUser('grant')" class="text-slate-400 hover:text-white">✕</button>
            </div>
            <input type="hidden" id="grant-user-id">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Commercial Plan</label>
            <select id="grant-plan-id" class="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white outline-none"></select>
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Duration</label>
            <select id="grant-duration" onchange="toggleCustomDate('grant', this.value)" class="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white outline-none">
              <option value="30_DAYS">30 Days</option>
              <option value="90_DAYS">90 Days</option>
              <option value="1_YEAR">1 Year (365 Days)</option>
              <option value="LIFETIME">Lifetime Access</option>
              <option value="CUSTOM">Custom Date</option>
            </select>
            <input type="datetime-local" id="grant-custom-date" class="hidden mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Reason / Notes (Optional)</label>
            <input type="text" id="grant-reason" placeholder="e.g. VIP sponsor, enterprise gift"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none">
          </div>

          <button onclick="executeGrant()" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/10">
            Grant Premium License
          </button>

          <div id="grant-status-msg" class="hidden text-xs p-3 rounded-xl"></div>
        </div>
      </div>

      <!-- CARD 2: Remove Premium -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-bold text-white flex items-center space-x-2">
            <span class="text-rose-400">❌</span>
            <span>Remove Premium Entitlement</span>
          </h3>
          <span class="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Revoke</span>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Target User</label>
            <div class="relative">
              <input type="text" id="remove-user-search" placeholder="Search user by email or ID..." oninput="searchUsers('remove', this.value)"
                class="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white outline-none">
              <div id="remove-search-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl max-h-48 overflow-y-auto z-20 shadow-2xl custom-scroll"></div>
            </div>
            <div id="remove-selected-badge" class="hidden mt-2 p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
              <span id="remove-selected-text"></span>
              <button onclick="clearSelectedUser('remove')" class="text-slate-400 hover:text-white">✕</button>
            </div>
            <input type="hidden" id="remove-user-id">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">License ID (Optional)</label>
            <input type="text" id="remove-license-id" placeholder="Leave blank to revoke all active licenses"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Reason (Optional)</label>
            <input type="text" id="remove-reason" placeholder="e.g. Terms violation, chargeback"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none">
          </div>

          <button onclick="executeRemove()" class="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-500/10">
            Revoke Entitlement & Reset to Free
          </button>

          <div id="remove-status-msg" class="hidden text-xs p-3 rounded-xl"></div>
        </div>
      </div>

      <!-- CARD 3: Upgrade / Downgrade Plan -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-bold text-white flex items-center space-x-2">
            <span class="text-sky-400">⚡</span>
            <span>Set Plan (Upgrade / Downgrade)</span>
          </h3>
          <span class="text-[10px] uppercase font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">Plan Sync</span>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Target User</label>
            <div class="relative">
              <input type="text" id="setplan-user-search" placeholder="Search user by email or ID..." oninput="searchUsers('setplan', this.value)"
                class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white outline-none">
              <div id="setplan-search-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl max-h-48 overflow-y-auto z-20 shadow-2xl custom-scroll"></div>
            </div>
            <div id="setplan-selected-badge" class="hidden mt-2 p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs text-sky-300 flex items-center justify-between">
              <span id="setplan-selected-text"></span>
              <button onclick="clearSelectedUser('setplan')" class="text-slate-400 hover:text-white">✕</button>
            </div>
            <input type="hidden" id="setplan-user-id">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">New Target Plan</label>
            <select id="setplan-plan-id" class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white outline-none"></select>
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Reason (Optional)</label>
            <input type="text" id="setplan-reason" placeholder="e.g. Plan upgrade request"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none">
          </div>

          <button onclick="executeSetPlan()" class="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-sky-500/10">
            Update User Plan
          </button>

          <div id="setplan-status-msg" class="hidden text-xs p-3 rounded-xl"></div>
        </div>
      </div>

      <!-- CARD 4: Account Enforcement (Suspend / Resume / Ban / Unban) -->
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 class="text-sm font-bold text-white flex items-center space-x-2">
            <span class="text-amber-400">🛡️</span>
            <span>Account Enforcement</span>
          </h3>
          <span class="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Security</span>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Target User</label>
            <div class="relative">
              <input type="text" id="enforce-user-search" placeholder="Search user by email or ID..." oninput="searchUsers('enforce', this.value)"
                class="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none">
              <div id="enforce-search-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl max-h-48 overflow-y-auto z-20 shadow-2xl custom-scroll"></div>
            </div>
            <div id="enforce-selected-badge" class="hidden mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between">
              <span id="enforce-selected-text"></span>
              <button onclick="clearSelectedUser('enforce')" class="text-slate-400 hover:text-white">✕</button>
            </div>
            <input type="hidden" id="enforce-user-id">
            <input type="hidden" id="enforce-user-email">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Action</label>
            <select id="enforce-action" onchange="toggleEnforceConfirm(this.value)" class="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none">
              <option value="suspend">Suspend Account (Lock logins & deactivate devices)</option>
              <option value="resume">Resume Account (Reactivate logins)</option>
              <option value="ban">Ban Account (Permanent mass-revoke & blacklist)</option>
              <option value="unban">Unban Account (Reactivate logins; licenses stay revoked)</option>
            </select>
          </div>

          <div id="enforce-confirm-container" class="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl space-y-1">
            <label class="block text-[11px] font-bold text-rose-300">Typed Confirmation Required</label>
            <p class="text-[10px] text-slate-400">Type the exact email of the target user to confirm destructive action:</p>
            <input type="text" id="enforce-confirm-input" placeholder="Type user email to confirm"
              class="w-full bg-slate-950 border border-rose-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Reason (Optional)</label>
            <input type="text" id="enforce-reason" placeholder="e.g. Chargeback fraud, security abuse"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none">
          </div>

          <button onclick="executeEnforce()" class="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/10">
            Execute Enforcement Action
          </button>

          <div id="enforce-status-msg" class="hidden text-xs p-3 rounded-xl"></div>
        </div>
      </div>

    </div>
  </main>

  <!-- One-Time License Key Display Modal -->
  <div id="key-modal" class="hidden fixed inset-0 bg-slate-950/80 backdrop-blur z-50 flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl">
          🔑
        </div>
        <div>
          <h3 class="text-base font-bold text-white">License Key (Shown ONCE)</h3>
          <p class="text-xs text-slate-400">Directly copy and provide this key to the user</p>
        </div>
      </div>

      <div class="space-y-2">
        <div class="relative">
          <input type="text" id="modal-key-display" readonly
            class="w-full font-mono text-center text-sm font-bold bg-slate-950 border border-emerald-500/40 text-emerald-400 rounded-2xl py-3 px-4 select-all outline-none">
        </div>
        <button onclick="copyModalKey()" id="modal-copy-btn" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow flex items-center justify-center space-x-1.5">
          <span>📋</span>
          <span>Copy License Key</span>
        </button>
      </div>

      <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-1">
        <div class="text-[11px] font-bold text-rose-400 flex items-center space-x-1.5">
          <span>⚠️</span>
          <span>Security Notice: One-Time Display Only</span>
        </div>
        <p class="text-[10px] text-rose-300 leading-relaxed">
          This raw cryptographic key is NEVER saved to the database or printed in server logs. Once this dialog is closed, the raw key cannot be retrieved.
        </p>
      </div>

      <button onclick="closeKeyModal()" class="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition">
        Done
      </button>
    </div>
  </div>

  <!-- Client-Side JavaScript Logic -->
  <script>
    let cachedPlans = [];
    let searchDebounceTimers = {};
    const selectedUsers = {};

    function getAdminSecret() {
      const secretInput = document.getElementById('owner-admin-secret');
      let val = secretInput ? secretInput.value.trim() : '';
      if (val) {
        try {
          sessionStorage.setItem('mahi_admin_secret', val);
          localStorage.setItem('mahi_admin_secret', val);
        } catch {}
        return val;
      }
      try {
        val = localStorage.getItem('mahi_admin_secret') || sessionStorage.getItem('mahi_admin_secret') || '';
        if (val) {
          if (secretInput && !secretInput.value) secretInput.value = val;
          return val;
        }
      } catch {}
      return '';
    }

    async function ownerFetch(url, options = {}) {
      const adminSecret = getAdminSecret();
      const headers = {
        'Content-Type': 'application/json',
        'X-Admin-Secret': adminSecret,
        ...(options.headers || {})
      };
      try {
        const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
        if (res.status === 204) return { success: true, status: 204 };
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    async function submitVerifyTotp() {
      const codeInput = document.getElementById('totp-input');
      const errorDiv = document.getElementById('auth-error-msg');
      const verifyBtn = document.getElementById('verify-btn');
      const code = codeInput ? codeInput.value.trim() : '';

      errorDiv.classList.add('hidden');
      errorDiv.innerText = '';

      if (!code || code.length !== 6 || !/^\\d{6}$/.test(code)) {
        errorDiv.classList.remove('hidden');
        errorDiv.innerText = 'Please enter a valid 6-digit verification code.';
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.innerText = 'Verifying...';

      const res = await ownerFetch('/api/v1/admin/owner/verify', {
        method: 'POST',
        body: JSON.stringify({ code })
      });

      verifyBtn.disabled = false;
      verifyBtn.innerText = 'Verify Security Code';

      if (res.success) {
        document.getElementById('totp-auth-panel').classList.add('hidden');
        document.getElementById('owner-console-panel').classList.remove('hidden');
        document.getElementById('lock-console-btn').classList.remove('hidden');
        initOwnerConsole();
      } else {
        errorDiv.classList.remove('hidden');
        errorDiv.innerText = res.error || 'Verification failed. Invalid or expired code.';
      }
    }

    async function lockConsole() {
      await ownerFetch('/api/v1/admin/owner/logout', { method: 'POST' });
      window.location.href = '/admin';
    }

    async function initOwnerConsole() {
      await loadPricingCatalog();
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'grant' && urlParams.get('userId')) {
          const uId = urlParams.get('userId');
          const uName = urlParams.get('name') || '';
          const uEmail = urlParams.get('email') || '';
          selectUser('grant', uId, uName, uEmail, 'ACTIVE');
        }
      } catch (e) {}
    }

    async function loadPricingCatalog() {
      const res = await ownerFetch('/api/v1/admin/pricing/catalog');
      const defaultPlans = [
        { id: 'plan_starter', name: 'Starter', tier: 'STARTER' },
        { id: 'plan_starter_plus', name: 'Starter+', tier: 'STARTER_PLUS' },
        { id: 'plan_pro', name: 'Professional', tier: 'PRO' },
        { id: 'plan_pro_plus', name: 'Professional+', tier: 'PRO_PLUS' },
        { id: 'plan_elite', name: 'Elite', tier: 'ELITE' },
        { id: 'plan_enterprise', name: 'Enterprise', tier: 'ENTERPRISE' },
        { id: 'plan_agency', name: 'Agency Fleet', tier: 'AGENCY' },
        { id: 'plan_custom', name: 'Custom Dedicated', tier: 'CUSTOM' }
      ];

      cachedPlans = res.success && Array.isArray(res.data) && res.data.length > 0 ? res.data : defaultPlans;

      const grantSelect = document.getElementById('grant-plan-id');
      const setplanSelect = document.getElementById('setplan-plan-id');
      if (grantSelect) {
        grantSelect.innerHTML = cachedPlans.map(p => \`<option value="\${p.id}">\${p.name} (\${p.tier || p.id})</option>\`).join('');
      }
      if (setplanSelect) {
        setplanSelect.innerHTML = cachedPlans.map(p => \`<option value="\${p.id}">\${p.name} (\${p.tier || p.id})</option>\`).join('');
      }
    }

    function toggleCustomDate(prefix, val) {
      const el = document.getElementById(prefix + '-custom-date');
      if (el) {
        if (val === 'CUSTOM') el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    }

    function toggleEnforceConfirm(val) {
      const container = document.getElementById('enforce-confirm-container');
      if (container) {
        if (val === 'suspend' || val === 'ban') container.classList.remove('hidden');
        else container.classList.add('hidden');
      }
    }

    function searchUsers(context, query) {
      const q = (query || '').trim();
      const resultsDiv = document.getElementById(context + '-search-results');
      if (!resultsDiv) return;

      if (searchDebounceTimers[context]) clearTimeout(searchDebounceTimers[context]);

      if (q.length < 2) {
        resultsDiv.classList.add('hidden');
        resultsDiv.innerHTML = '';
        return;
      }

      searchDebounceTimers[context] = setTimeout(async () => {
        resultsDiv.innerHTML = '<div class="p-3 text-slate-400 text-xs">Searching accounts...</div>';
        resultsDiv.classList.remove('hidden');

        const res = await ownerFetch('/api/v1/admin/users?search=' + encodeURIComponent(q) + '&limit=10');
        if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
          resultsDiv.innerHTML = '<div class="p-3 text-slate-400 text-xs">No matching users found.</div>';
          return;
        }

        resultsDiv.innerHTML = res.data.map(u => {
          const displayEmail = u.email || 'N/A';
          const escapedName = (u.name || u.email || 'User').replace(/"/g, '&quot;');
          const safeEmail = (u.email || '').replace(/"/g, '&quot;');
          return \`<div onclick="selectUser('\${context}', '\${u.id}', '\${escapedName}', '\${safeEmail}', '\${u.status || 'ACTIVE'}')"
            class="p-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/60 last:border-0 text-xs transition">
            <div class="font-bold text-white">\${escapedName}</div>
            <div class="text-[11px] text-slate-300 font-mono">\${displayEmail} <span class="text-slate-500">(\${u.id})</span></div>
          </div>\`;
        }).join('');
      }, 250);
    }

    function selectUser(context, id, name, email, status) {
      const cleanId = (id || '').startsWith('central:') ? id.replace('central:', '') : id;
      selectedUsers[context] = { id: cleanId, name, email, status };
      const searchInput = document.getElementById(context + '-user-search');
      const resultsDiv = document.getElementById(context + '-search-results');
      const badge = document.getElementById(context + '-selected-badge');
      const badgeText = document.getElementById(context + '-selected-text');
      const hiddenId = document.getElementById(context + '-user-id');
      const hiddenEmail = document.getElementById(context + '-user-email');

      if (searchInput) searchInput.classList.add('hidden');
      if (resultsDiv) resultsDiv.classList.add('hidden');
      if (badge) badge.classList.remove('hidden');
      if (badgeText) badgeText.innerText = \`\${name} (\${email || cleanId}) [Status: \${status}]\`;
      if (hiddenId) hiddenId.value = cleanId;
      if (hiddenEmail) hiddenEmail.value = email;
    }

    function clearSelectedUser(context) {
      delete selectedUsers[context];
      const searchInput = document.getElementById(context + '-user-search');
      const resultsDiv = document.getElementById(context + '-search-results');
      const badge = document.getElementById(context + '-selected-badge');
      const hiddenId = document.getElementById(context + '-user-id');
      const hiddenEmail = document.getElementById(context + '-user-email');

      if (searchInput) {
        searchInput.value = '';
        searchInput.classList.remove('hidden');
      }
      if (resultsDiv) resultsDiv.classList.add('hidden');
      if (badge) badge.classList.add('hidden');
      if (hiddenId) hiddenId.value = '';
      if (hiddenEmail) hiddenEmail.value = '';
    }

    async function executeGrant() {
      const msg = document.getElementById('grant-status-msg');
      msg.className = 'text-xs p-3 rounded-xl hidden';
      const userId = document.getElementById('grant-user-id')?.value;
      if (!userId) {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = 'Please search and select a target user.';
        return;
      }

      const planId = document.getElementById('grant-plan-id')?.value;
      const durationType = document.getElementById('grant-duration')?.value || '30_DAYS';
      const customExpiresAt = durationType === 'CUSTOM' ? document.getElementById('grant-custom-date')?.value : undefined;
      const reason = document.getElementById('grant-reason')?.value?.trim();

      const res = await ownerFetch('/api/v1/admin/owner/grant', {
        method: 'POST',
        body: JSON.stringify({ userId, planId, durationType, customExpiresAt, reason })
      });

      if (res.success) {
        msg.className = 'text-xs p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
        msg.innerText = \`License granted successfully! ID: \${res.licenseId} (Key: \${res.keyMasked})\${res.planSyncFailed ? ' [Warning: planSyncFailed]' : ''}\`;
        if (res.rawKey) {
          openKeyModal(res.rawKey);
        }
      } else {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = res.error || 'Failed to grant license';
      }
    }

    async function executeRemove() {
      const msg = document.getElementById('remove-status-msg');
      msg.className = 'text-xs p-3 rounded-xl hidden';
      const userId = document.getElementById('remove-user-id')?.value;
      if (!userId) {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = 'Please search and select a target user.';
        return;
      }

      const licenseId = document.getElementById('remove-license-id')?.value?.trim();
      const reason = document.getElementById('remove-reason')?.value?.trim();

      const res = await ownerFetch('/api/v1/admin/owner/remove', {
        method: 'POST',
        body: JSON.stringify({ userId, licenseId: licenseId || undefined, reason })
      });

      if (res.success) {
        msg.className = 'text-xs p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
        msg.innerText = \`Revoked \${res.revokedCount} license(s). User plan reset to plan_free.\`;
      } else {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = res.error || 'Failed to remove premium';
      }
    }

    async function executeSetPlan() {
      const msg = document.getElementById('setplan-status-msg');
      msg.className = 'text-xs p-3 rounded-xl hidden';
      const userId = document.getElementById('setplan-user-id')?.value;
      if (!userId) {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = 'Please search and select a target user.';
        return;
      }

      const planId = document.getElementById('setplan-plan-id')?.value;
      const reason = document.getElementById('setplan-reason')?.value?.trim();

      const res = await ownerFetch('/api/v1/admin/owner/set-plan', {
        method: 'POST',
        body: JSON.stringify({ userId, planId, reason })
      });

      if (res.success) {
        msg.className = 'text-xs p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
        msg.innerText = \`Plan successfully changed from \${res.from} to \${res.to}.\`;
      } else {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = res.error || 'Failed to update plan';
      }
    }

    async function executeEnforce() {
      const msg = document.getElementById('enforce-status-msg');
      msg.className = 'text-xs p-3 rounded-xl hidden';
      const userId = document.getElementById('enforce-user-id')?.value;
      const selected = selectedUsers['enforce'];
      if (!userId || !selected) {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = 'Please search and select a target user.';
        return;
      }

      const action = document.getElementById('enforce-action')?.value || 'suspend';
      const reason = document.getElementById('enforce-reason')?.value?.trim();

      if (action === 'suspend' || action === 'ban') {
        const confirmInput = document.getElementById('enforce-confirm-input')?.value?.trim() || '';
        const targetEmail = (selected.email || '').trim().toLowerCase();
        if (confirmInput.toLowerCase() !== targetEmail) {
          msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
          msg.innerText = \`Confirmation mismatch! Type user's exact email ("\${selected.email}") to confirm.\`;
          return;
        }
      }

      const res = await ownerFetch('/api/v1/admin/owner/' + action, {
        method: 'POST',
        body: JSON.stringify({ userId, reason })
      });

      if (res.success) {
        msg.className = 'text-xs p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
        msg.innerText = \`Action "\${action.toUpperCase()}" applied successfully. User status: \${res.status}.\`;
        selected.status = res.status;
        const badgeText = document.getElementById('enforce-selected-text');
        if (badgeText) badgeText.innerText = \`\${selected.name} (\${selected.email || selected.id}) [Status: \${res.status}]\`;
      } else {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.innerText = res.error || 'Failed to apply enforcement action';
      }
    }

    function openKeyModal(rawKey) {
      const modal = document.getElementById('key-modal');
      const input = document.getElementById('modal-key-display');
      if (input) input.value = rawKey;
      if (modal) modal.classList.remove('hidden');
    }

    function closeKeyModal() {
      const modal = document.getElementById('key-modal');
      const input = document.getElementById('modal-key-display');
      if (input) input.value = '';
      if (modal) modal.classList.add('hidden');
    }

    function copyModalKey() {
      const input = document.getElementById('modal-key-display');
      const btn = document.getElementById('modal-copy-btn');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        if (btn) btn.innerHTML = '<span>✓</span><span>Copied to Clipboard!</span>';
        setTimeout(() => {
          if (btn) btn.innerHTML = '<span>📋</span><span>Copy License Key</span>';
        }, 2000);
      }
    }

    // Auto-fill admin secret and initialize owner console immediately
    window.addEventListener('DOMContentLoaded', () => {
      getAdminSecret();
      initOwnerConsole();
    });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      getAdminSecret();
      initOwnerConsole();
    }
  </script>
</body>
</html>`;
}
