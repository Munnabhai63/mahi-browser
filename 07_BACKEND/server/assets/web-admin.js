(() => {
  let currentPage = 'dashboard';
  let cachedAdminUsers = [];
  let cachedAdminTickets = [];
  let initialized = false;
  const currentTicketFilter = { status: '', category: '' };

  const pricingState = {
    activeVersion: null,
    catalog: null,
    versions: [],
    syncStatus: {},
    revenue: null,
    currentCategory: 'personal',
    annualDiscountPercent: 50,
    subscriberPolicy: 'GRANDFATHER',
    draftPrices: {},
  };

  function getAdminSecret() {
    const inputEl = document.getElementById('admin-secret-input');
    let val = inputEl?.value?.trim();
    if (val) {
      try {
        sessionStorage.setItem('mahi_admin_secret', val);
        localStorage.setItem('mahi_admin_secret', val);
      } catch {
        void 0; /* browser storage blocked */
      }
      return val;
    }
    try {
      val = localStorage.getItem('mahi_admin_secret') || sessionStorage.getItem('mahi_admin_secret') || '';
      if (val) {
        if (inputEl && !inputEl.value) inputEl.value = val;
        return val;
      }
    } catch {
      void 0; /* browser storage blocked */
    }
    return '';
  }

  async function apiFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Secret': getAdminSecret(),
      ...(options.headers || {}),
    };
    try {
      const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
      return await res.json();
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
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

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center space-x-2 pointer-events-auto transform transition duration-200 ${
      type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
    }`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.className = 'mahi-sr-hidden';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (cb) cb();
    } catch {
      void 0; /* browser copy fallback */
    }
    document.body.removeChild(ta);
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
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.className =
        'nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all';
    });
    const activeNav = document.getElementById(`nav-${page}`);
    if (activeNav) {
      activeNav.className =
        'nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 transition-all';
    }
    renderPage();
  }

  async function refreshData() {
    await renderPage();
    showToast('Data refreshed successfully');
  }

  async function renderPage() {
    const container = document.getElementById('content-container');
    const title = document.getElementById('page-title');
    if (!container || !title) return;

    if (currentPage === 'dashboard') {
      title.textContent = 'Platform Overview';
      container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading dashboard telemetry...</div>';
      const res = await apiFetch('/api/v1/admin/dashboard');
      if (res.success && res.data) {
        const usersCountEl = document.getElementById('nav-users-count');
        const deviceCountEl = document.getElementById('nav-device-count');
        const ticketBadge = document.getElementById('nav-tickets-count');
        if (usersCountEl) usersCountEl.textContent = String(res.data.totalUsers || 0);
        if (deviceCountEl) deviceCountEl.textContent = String(res.data.activeDevices || 0);
        if (ticketBadge) ticketBadge.textContent = String(res.data.openTickets || 0);
        renderDashboard(res.data);
      } else {
        container.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">Error loading dashboard: ${escapeHtml(res.error || 'Failed to authenticate')}</div>`;
      }
    } else if (currentPage === 'users') {
      title.textContent = 'Commercial Users Management';
      await renderUsers();
    } else if (currentPage === 'plans') {
      title.textContent = 'Subscription Plans & Entitlement Limits';
      await renderPlans();
    } else if (currentPage === 'payments') {
      title.textContent = 'Payments & UPI Verification';
      await renderPayments();
    } else if (currentPage === 'licenses') {
      title.textContent = 'License Key Minting & Control';
      await renderLicenses();
    } else if (currentPage === 'devices') {
      title.textContent = 'Device Activations & Enforcement';
      await renderDevices();
    } else if (currentPage === 'versions') {
      title.textContent = 'Software Versions & Updates';
      await renderVersions();
    } else if (currentPage === 'audit_logs') {
      title.textContent = 'System Audit Trail';
      await renderAuditLogs();
    } else if (currentPage === 'demo_requests') {
      title.textContent = 'Enterprise & Team Demo Leads';
      await renderDemoRequests();
    } else if (currentPage === 'funnel') {
      title.textContent = 'Conversion Funnel Telemetry';
      await renderFunnelTelemetry();
    } else if (currentPage === 'support_tickets') {
      title.textContent = 'Customer Support Desk & Ticket Inbox';
      await renderSupportTickets();
    }
  }

  function renderDashboard(data) {
    const container = document.getElementById('content-container');
    if (!container) return;
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Commercial Users</span>
            <span class="text-emerald-600 font-mono">USERS</span>
          </div>
          <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">${Number(data.totalUsers || 0)}</div>
          <div class="text-[11px] text-slate-400 mt-1 flex items-center space-x-2">
            <span class="text-emerald-600 font-bold">${Number(data.activeUsers || 0)} active</span>
            <span>•</span>
            <span class="text-rose-500 font-bold">${Number((data.suspendedUsers || 0) + (data.bannedUsers || 0))} restricted</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Active Licenses</span>
            <span class="text-teal-600 font-mono">KEYS</span>
          </div>
          <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">${Number(data.activeLicenses || 0)}</div>
          <div class="text-[11px] text-slate-400 mt-1">${Number(data.expiredLicenses || 0)} expired keys</div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Authorized Devices</span>
            <span class="text-purple-600 font-mono">NODES</span>
          </div>
          <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">${Number(data.activeDevices || 0)}</div>
          <div class="text-[11px] text-slate-400 mt-1">Live client instances</div>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Active Plans Configured</span>
            <span class="text-amber-600 font-mono">TIERS</span>
          </div>
          <div class="text-3xl font-extrabold text-slate-900 mt-2 font-mono">${Number(data.totalPlans || 0)}</div>
          <div class="text-[11px] text-slate-400 mt-1">Free, Pro, Business, Enterprise</div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-900">Recent Commercial Audit Logs</h3>
          <button type="button" data-action="switch-page" data-page="audit_logs" class="text-xs font-bold text-emerald-600 hover:text-emerald-700">View All Logs →</button>
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
              ${data.recentAuditLogs && data.recentAuditLogs.length > 0 ? data.recentAuditLogs.map((l) => `
                <tr class="hover:bg-slate-50">
                  <td class="p-3 font-mono text-[11px] text-slate-400">${escapeHtml(new Date(l.createdAt).toLocaleTimeString())}</td>
                  <td class="p-3 font-bold text-slate-700">${escapeHtml(l.actorName)} <span class="text-[10px] text-slate-400">(${escapeHtml(l.actorRole)})</span></td>
                  <td class="p-3 font-mono font-semibold text-emerald-700">${escapeHtml(l.action)}</td>
                  <td class="p-3 text-slate-600">${escapeHtml(l.details)}</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${l.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${escapeHtml(l.result)}</span></td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="p-4 text-center text-slate-400">No recent logs recorded.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function renderUsers() {
    const container = document.getElementById('content-container');
    if (!container) return;
    container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading users and terms compliance...</div>';
    const [res, termsRes] = await Promise.all([
      apiFetch('/api/v1/admin/users'),
      apiFetch('/api/v1/admin/terms-compliance'),
    ]);
    if (!res.success) {
      container.innerHTML = `<div class="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl">${escapeHtml(res.error || 'Failed to load users')}</div>`;
      return;
    }
    cachedAdminUsers = Array.isArray(res.data) ? res.data : [];
    const termsData = (termsRes?.success && termsRes.data) || { totalUsers: 0, accepted: 0, missing: 0, byVersion: {} };

    container.innerHTML = `
      <!-- Terms Acceptance & Legal Compliance Panel -->
      <div class="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-800">Legal & Terms Compliance Overview</h4>
            <p class="text-[11px] text-slate-400 mt-0.5">Tracking IT Rules 2021 & Terms of Service Acceptance across user accounts</p>
          </div>
          <button type="button" data-action="refresh-users" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition">🔄 Refresh</button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div class="text-[10px] font-bold text-slate-500 uppercase">Total Users</div>
            <div class="text-2xl font-extrabold text-slate-900 mt-1 font-mono">${termsData.totalUsers ?? 0}</div>
          </div>
          <div class="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
            <div class="text-[10px] font-bold text-emerald-700 uppercase">Accepted</div>
            <div class="text-2xl font-extrabold text-emerald-800 mt-1 font-mono">${termsData.accepted ?? 0}</div>
          </div>
          <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
            <div class="text-[10px] font-bold text-amber-700 uppercase">Missing</div>
            <div class="text-2xl font-extrabold text-amber-800 mt-1 font-mono">${termsData.missing ?? 0}</div>
          </div>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div class="text-[10px] font-bold text-slate-500 uppercase">Unversioned</div>
            <div class="text-2xl font-extrabold text-slate-800 mt-1 font-mono">${termsData.byVersion?.unversioned || 0}</div>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100">
          <div class="text-[11px] font-bold text-slate-700 mb-2">Breakdown by Terms Version</div>
          <div class="flex flex-wrap gap-2">
            ${termsData.byVersion && Object.keys(termsData.byVersion).length > 0 ? Object.entries(termsData.byVersion).map(([v, count]) => `
              <span class="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                <strong class="text-slate-900">${escapeHtml(v)}</strong>: ${Number(count)} users
              </span>
            `).join('') : '<span class="text-xs text-slate-400">No versioned records.</span>'}
          </div>
        </div>
        <div class="mt-3 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-[11px] leading-relaxed">
          Users who registered before terms tracking was added will show as missing. This is expected, not an error.
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-slate-900">Registered Users (${Number(res.total || cachedAdminUsers.length)})</h3>
            <p class="text-[11px] text-slate-400 mt-0.5">Manage customer quotas, GoLogin-style boosters, enterprise feature overrides & HWID locks</p>
          </div>
          <div class="flex items-center space-x-2">
            <input type="text" id="user-filter-input" placeholder="🔍 Search name, email, or ID..."
              class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-emerald-500 w-64 font-medium">
            <button type="button" data-action="refresh-users" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">🔄 Refresh</button>
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
              ${cachedAdminUsers.length > 0 ? cachedAdminUsers.map((u, idx) => `
                <tr class="hover:bg-slate-50 transition" data-user-row="true">
                  <td class="p-3 mahi-select-text">
                    <div class="flex items-start space-x-3">
                      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs uppercase">
                        ${escapeHtml((u.name || u.email || 'U').charAt(0))}
                      </div>
                      <div class="space-y-1 min-w-0">
                        <div class="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                          <span class="truncate">${escapeHtml(u.name || 'Unnamed User')}</span>
                          <button type="button" data-action="copy-user-field" data-idx="${idx}" data-field="name" class="text-slate-400 hover:text-slate-700 text-[10px] p-0.5" title="Copy Name">📋</button>
                        </div>
                        <div class="flex items-center space-x-1.5">
                          <span class="text-[11px] text-slate-700 font-mono font-medium truncate">${escapeHtml(u.email)}</span>
                          <button type="button" data-action="copy-user-field" data-idx="${idx}" data-field="email" class="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold border border-slate-200 transition shrink-0" title="Click to copy email">
                            📋 Copy Email
                          </button>
                        </div>
                        <div class="flex items-center space-x-1">
                          <span class="text-[10px] text-slate-400 font-mono truncate">ID: ${escapeHtml(u.id)}</span>
                          <button type="button" data-action="copy-user-field" data-idx="${idx}" data-field="id" class="text-slate-400 hover:text-slate-700 text-[10px] p-0.5 shrink-0" title="Copy User ID">📋</button>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="p-3"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-700">${escapeHtml(u.role)}</span></td>
                  <td class="p-3">
                    <div class="font-semibold text-emerald-700">${escapeHtml(u.planId)}</div>
                    ${u.bonusProfiles > 0 ? `<div class="text-[10px] text-amber-600 font-bold font-mono">+${Number(u.bonusProfiles)} Boosted Profiles</div>` : ''}
                    ${u.bonusProxyBytes > 0 ? `<div class="text-[10px] text-sky-600 font-bold font-mono">+${Math.round(u.bonusProxyBytes / (1024 * 1024 * 1024))} GB Proxy</div>` : ''}
                  </td>
                  <td class="p-3">
                    <div class="flex flex-wrap gap-1">
                      ${u.featureOverrides?.qunkong ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Qunkong</span>' : ''}
                      ${u.featureOverrides?.multiCore ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">MultiCore</span>' : ''}
                      ${u.featureOverrides?.apiDaemon ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">BotAPI</span>' : ''}
                      ${u.featureOverrides?.rpa ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">RPA</span>' : ''}
                      ${!u.featureOverrides || (!u.featureOverrides.qunkong && !u.featureOverrides.multiCore && !u.featureOverrides.apiDaemon && !u.featureOverrides.rpa) ? '<span class="text-[10px] text-slate-400">Standard Tier</span>' : ''}
                    </div>
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      u.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }">${escapeHtml(u.status)}</span>
                  </td>
                  <td class="p-3 text-slate-400 text-[11px] font-mono">${escapeHtml(new Date(u.createdAt).toLocaleDateString())}</td>
                  <td class="p-3 text-right space-x-1 whitespace-nowrap">
                    <button type="button" data-action="open-grant-modal" data-idx="${idx}" class="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-bold text-[10px] shadow-xs transition active:scale-95 inline-flex items-center space-x-1" title="Direct 1-Click Premium License Grant">
                      <span>👑</span>
                      <span>Grant Premium</span>
                    </button>
                    <button type="button" data-action="open-boost-modal" data-idx="${idx}" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-bold text-[10px] border border-amber-200 transition" title="GoLogin-Style Quick Quota Boost">⚡ Boost</button>
                    <button type="button" data-action="open-features-modal" data-idx="${idx}" class="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg font-bold text-[10px] border border-purple-200 transition" title="MostLogin-Style Feature Overrides">⚙️ Features</button>
                    <button type="button" data-action="reset-user-hwid" data-idx="${idx}" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] transition" title="1-Click Machine / HWID Unbind">🔓 HWID</button>
                    ${u.status === 'ACTIVE' ? `
                      <button type="button" data-action="change-user-status" data-idx="${idx}" data-status="SUSPENDED" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold text-[10px] transition">Suspend</button>
                      <button type="button" data-action="change-user-status" data-idx="${idx}" data-status="BANNED" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[10px] transition">Ban</button>
                    ` : `
                      <button type="button" data-action="change-user-status" data-idx="${idx}" data-status="ACTIVE" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[10px] transition">Activate</button>
                    `}
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="7" class="p-6 text-center text-slate-400 font-medium">No users registered yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function filterUsersTable(query) {
    const q = (query || '').toLowerCase().trim();
    const rows = document.querySelectorAll('tbody tr[data-user-row]');
    rows.forEach((r) => {
      const text = (r instanceof HTMLElement ? r.textContent : r.textContent || '').toLowerCase();
      r.classList.toggle('hidden', q.length > 0 && !text.includes(q));
    });
  }

  function copyUserFieldByIndex(idx, field, el) {
    const u = cachedAdminUsers[idx];
    if (!u) return;
    const val = field === 'name' ? u.name || '' : field === 'email' ? u.email || '' : u.id || '';
    const label = field === 'name' ? 'Name copied!' : field === 'email' ? 'Email copied!' : 'User ID copied!';
    copyToClipboard(val, el, label);
  }

  function openGrantPremiumModal(userId, name, email) {
    document.getElementById('grant-premium-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'grant-premium-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
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
          <button type="button" data-close-modal="grant-premium-modal" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
        </div>

        <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-slate-500 font-medium">Target User:</span>
            <span class="font-bold text-slate-900 font-mono">${escapeHtml(name || 'User')}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-500 font-medium">Email:</span>
            <div class="flex items-center space-x-1">
              <span class="font-mono text-slate-800 font-medium">${escapeHtml(email)}</span>
              <button type="button" data-action="copy-text" data-copy="${escapeHtml(email)}" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100 transition">📋 Copy</button>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-500 font-medium">User ID:</span>
            <div class="flex items-center space-x-1">
              <span class="font-mono text-slate-500 text-[11px] truncate max-w-[200px]">${escapeHtml(userId)}</span>
              <button type="button" data-action="copy-text" data-copy="${escapeHtml(userId)}" class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100 transition">📋 Copy</button>
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
            <a href="/super-admin?action=grant&userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}"
              class="text-xs text-purple-600 hover:text-purple-800 font-bold transition flex items-center space-x-1">
              <span>Super Admin Suite →</span>
            </a>
            <div class="flex items-center space-x-2">
              <button type="button" data-close-modal="grant-premium-modal" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
                Cancel
              </button>
              <button type="button" id="modal-grant-btn" data-action="execute-modal-grant" data-uid="${escapeHtml(userId)}" class="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 transition active:scale-95">
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
            <h4 class="text-sm font-extrabold text-emerald-900">Account Upgraded to PRO!</h4>
            <p class="text-[11px] text-emerald-700">Account has been upgraded directly in the cloud. 100 Profiles unlocked.</p>
          </div>
          <div class="p-3 bg-white rounded-xl border border-emerald-200/80 text-center space-y-1">
            <p class="text-xs font-bold text-emerald-800">Direct Cloud Activation Active</p>
            <p class="text-[11px] text-slate-500">No manual license key is needed. The user's Mahi Browser will automatically reflect PRO status on next sync or restart.</p>
          </div>
          <div class="text-center pt-2">
            <button type="button" data-action="close-grant-and-refresh" class="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition">
              Done & Refresh Table
            </button>
          </div>
        </div>
      </div>
    `;
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
      errorDiv.textContent = '';
    }

    const totpCode = totpCodeInput ? totpCodeInput.value.trim() : '';

    if (totpBox instanceof HTMLElement && !totpBox.classList.contains('hidden')) {
      if (totpCode.length !== 6) {
        if (errorDiv) {
          errorDiv.classList.remove('hidden');
          errorDiv.textContent = 'Please enter a valid 6-digit Google Authenticator code.';
        }
        return;
      }
      if (grantBtn) {
        grantBtn.disabled = true;
        grantBtn.textContent = 'Verifying Authenticator...';
      }
      const verifyRes = await apiFetch('/api/v1/admin/owner/verify', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      if (!verifyRes.success) {
        if (grantBtn) {
          grantBtn.disabled = false;
          grantBtn.textContent = '👑 Issue Premium Now';
        }
        if (errorDiv) {
          errorDiv.classList.remove('hidden');
          errorDiv.textContent = verifyRes.error || 'Invalid Authenticator code. Please check your phone.';
        }
        return;
      }
    }

    if (grantBtn) {
      grantBtn.disabled = true;
      grantBtn.textContent = 'Issuing License...';
    }

    const res = await apiFetch('/api/v1/admin/owner/grant', {
      method: 'POST',
      body: JSON.stringify({ userId, planId, duration }),
    });

    if (grantBtn) {
      grantBtn.disabled = false;
      grantBtn.textContent = '👑 Issue Premium Now';
    }

    if (res.success) {
      document.getElementById('grant-modal-form')?.classList.add('hidden');
      document.getElementById('modal-grant-result')?.classList.remove('hidden');
      showToast('Account upgraded to PRO successfully!');
    } else if (res.error?.toLowerCase().includes('owner session')) {
      if (totpBox) totpBox.classList.remove('hidden');
      if (errorDiv) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = 'Security Step-Up required. Please enter your 6-digit Authenticator code above.';
      }
      if (totpCodeInput) totpCodeInput.focus();
    } else if (errorDiv) {
      errorDiv.classList.remove('hidden');
      errorDiv.textContent = res.error || 'Failed to grant premium.';
    }
  }

  async function changeUserStatus(userId, status) {
    const res = await apiFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (res.success) {
      showToast(`User status updated to ${status}`);
      await renderUsers();
    } else {
      showToast(res.error || 'Failed to update status', 'error');
    }
  }

  function openBoostModal(userId, email, currentBonus) {
    document.getElementById('boost-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'boost-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 class="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <span class="text-amber-500">⚡</span>
              <span>Instant Quota Booster (GoLogin Parity)</span>
            </h3>
            <p class="text-[11px] text-slate-500 font-mono mt-0.5">${escapeHtml(email)}</p>
          </div>
          <button type="button" data-close-modal="boost-modal" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
        </div>

        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
          <div class="flex justify-between">
            <span class="font-semibold">Current Bonus Profiles:</span>
            <span class="font-mono font-bold text-amber-600">+${Number(currentBonus || 0)} Profiles</span>
          </div>
          <p class="text-[10px] text-slate-400">Boosters immediately expand balance without changing subscription tier.</p>
        </div>

        <div class="space-y-2">
          <div class="text-xs font-bold text-slate-700">1-Click Quick Boost:</div>
          <div class="grid grid-cols-3 gap-2">
            <button type="button" data-action="execute-boost" data-uid="${escapeHtml(userId)}" data-boost-type="PROFILES" data-amount="10" class="p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold text-center transition">
              +10 Profiles
            </button>
            <button type="button" data-action="execute-boost" data-uid="${escapeHtml(userId)}" data-boost-type="PROFILES" data-amount="50" class="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center transition">
              +50 Profiles
            </button>
            <button type="button" data-action="execute-boost" data-uid="${escapeHtml(userId)}" data-boost-type="PROXY_GB" data-amount="5" class="p-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold text-center transition">
              +5 GB Proxy
            </button>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 space-y-2">
          <label class="text-xs font-bold text-slate-700 block">Custom Profile Amount:</label>
          <div class="flex space-x-2">
            <input type="number" id="custom-boost-input" min="1" max="1000" placeholder="e.g. 25" class="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-emerald-500 font-mono">
            <button type="button" data-action="execute-custom-boost" data-uid="${escapeHtml(userId)}" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition">
              Grant
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async function executeBoost(userId, type, amount) {
    const res = await apiFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/boost`, {
      method: 'POST',
      body: JSON.stringify({ type, amount }),
    });
    if (res.success) {
      showToast(`Successfully granted +${amount} ${type === 'PROFILES' ? 'Profiles' : 'GB Proxy'}!`);
      document.getElementById('boost-modal')?.remove();
      await renderUsers();
    } else {
      showToast(res.error || 'Failed to apply boost', 'error');
    }
  }

  function openFeaturesModal(userId, email, currentOverrides) {
    document.getElementById('features-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'features-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
    const ov = currentOverrides || {};
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 class="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <span class="text-purple-600">⚙️</span>
              <span>Enterprise Feature Overrides (MostLogin Parity)</span>
            </h3>
            <p class="text-[11px] text-slate-500 font-mono mt-0.5">${escapeHtml(email)}</p>
          </div>
          <button type="button" data-close-modal="features-modal" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <div>
              <div class="font-bold text-slate-800">Qunkong Synchronizer (群控)</div>
              <div class="text-[10px] text-slate-500">Multi-window real-time input mirroring & grid placement</div>
            </div>
            <input type="checkbox" id="feat-qunkong" ${ov.qunkong ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
          </label>

          <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <div>
              <div class="font-bold text-slate-800">Multi-Core Chromium Selector</div>
              <div class="text-[10px] text-slate-500">Orbita 130 / 140 / 150 kernel switching per profile</div>
            </div>
            <input type="checkbox" id="feat-multicore" ${ov.multiCore ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
          </label>

          <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <div>
              <div class="font-bold text-slate-800">Local Bot API Daemon</div>
              <div class="text-[10px] text-slate-500">REST API (:30898/:32123) for Puppeteer/Selenium</div>
            </div>
            <input type="checkbox" id="feat-apidaemon" ${ov.apiDaemon ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
          </label>

          <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <div>
              <div class="font-bold text-slate-800">Visual RPA Automation Studio</div>
              <div class="text-[10px] text-slate-500">Pre-built cookie warmer, KYC and scraping bot flows</div>
            </div>
            <input type="checkbox" id="feat-rpa" ${ov.rpa ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600">
          </label>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-100">
          <button type="button" data-close-modal="features-modal" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Cancel</button>
          <button type="button" data-action="save-features" data-uid="${escapeHtml(userId)}" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-sm">Save Overrides</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async function saveFeatures(userId) {
    const overrides = {
      qunkong: Boolean(document.getElementById('feat-qunkong')?.checked),
      multiCore: Boolean(document.getElementById('feat-multicore')?.checked),
      apiDaemon: Boolean(document.getElementById('feat-apidaemon')?.checked),
      rpa: Boolean(document.getElementById('feat-rpa')?.checked),
    };
    const res = await apiFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/features`, {
      method: 'PUT',
      body: JSON.stringify({ overrides }),
    });
    if (res.success) {
      showToast('Enterprise feature overrides updated successfully!');
      document.getElementById('features-modal')?.remove();
      await renderUsers();
    } else {
      showToast(res.error || 'Failed to update overrides', 'error');
    }
  }

  async function resetUserHardware(userId, email) {
    if (!confirm(`Are you sure you want to unbind all hardware and device locks for ${email}? User will be able to register new hardware immediately.`)) {
      return;
    }
    const res = await apiFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/reset-devices`, {
      method: 'POST',
    });
    if (res.success) {
      showToast(`Unbound ${res.unbindCount} device(s) successfully!`);
      await renderUsers();
    } else {
      showToast(res.error || 'Failed to unbind devices', 'error');
    }
  }

  async function renderSupportTickets() {
    const container = document.getElementById('content-container');
    if (!container) return;
    container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading support ticket inbox...</div>';

    let url = '/api/v1/commercial/admin/support-tickets';
    const params = [];
    if (currentTicketFilter.status) params.push(`status=${encodeURIComponent(currentTicketFilter.status)}`);
    if (currentTicketFilter.category) params.push(`category=${encodeURIComponent(currentTicketFilter.category)}`);
    if (params.length) url += `?${params.join('&')}`;

    const res = await apiFetch(url);
    if (!res.success) {
      container.innerHTML = `<div class="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl">${escapeHtml(res.error || 'Failed to load tickets')}</div>`;
      return;
    }

    const tickets = res.data || [];
    cachedAdminTickets = tickets;
    const openCount = tickets.filter((t) => t.status === 'OPEN').length;
    const paymentCount = tickets.filter((t) => t.category === 'PAYMENT').length;
    const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Stat Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div class="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Tickets</div>
            <div class="text-2xl font-black text-slate-900 mt-1 font-mono">${tickets.length}</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs">
            <div class="text-rose-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Open & Pending</span>
              <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            </div>
            <div class="text-2xl font-black text-rose-600 mt-1 font-mono">${openCount}</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
            <div class="text-amber-600 text-[10px] font-bold uppercase tracking-wider">Payment Escalations</div>
            <div class="text-2xl font-black text-amber-600 mt-1 font-mono">${paymentCount}</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
            <div class="text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Resolved</div>
            <div class="text-2xl font-black text-emerald-600 mt-1 font-mono">${resolvedCount}</div>
          </div>
        </div>

        <!-- Filters & Actions -->
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div class="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-slate-700">Filter Status:</span>
              <select id="ticket-status-filter" class="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold focus:outline-emerald-500">
                <option value="" ${currentTicketFilter.status === '' ? 'selected' : ''}>All Statuses</option>
                <option value="OPEN" ${currentTicketFilter.status === 'OPEN' ? 'selected' : ''}>OPEN</option>
                <option value="IN_PROGRESS" ${currentTicketFilter.status === 'IN_PROGRESS' ? 'selected' : ''}>IN_PROGRESS</option>
                <option value="RESOLVED" ${currentTicketFilter.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
                <option value="CLOSED" ${currentTicketFilter.status === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
              </select>

              <span class="text-xs font-bold text-slate-700 ml-2">Category:</span>
              <select id="ticket-category-filter" class="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-semibold focus:outline-emerald-500">
                <option value="" ${currentTicketFilter.category === '' ? 'selected' : ''}>All Categories</option>
                <option value="PAYMENT" ${currentTicketFilter.category === 'PAYMENT' ? 'selected' : ''}>Payment / Billing</option>
                <option value="PRICING" ${currentTicketFilter.category === 'PRICING' ? 'selected' : ''}>Pricing & Plans</option>
                <option value="SETUP" ${currentTicketFilter.category === 'SETUP' ? 'selected' : ''}>Setup & Onboarding</option>
                <option value="FINGERPRINT" ${currentTicketFilter.category === 'FINGERPRINT' ? 'selected' : ''}>Fingerprint Engine</option>
                <option value="PROFILES" ${currentTicketFilter.category === 'PROFILES' ? 'selected' : ''}>Profiles & Vault</option>
                <option value="GENERAL" ${currentTicketFilter.category === 'GENERAL' ? 'selected' : ''}>General Support</option>
              </select>
            </div>
            <button type="button" data-action="refresh-tickets" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition">
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
                ${tickets.length > 0 ? tickets.map((t, idx) => `
                  <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-mono font-bold text-slate-900">${escapeHtml(t.ticketNumber)}</td>
                    <td class="p-3">
                      <div class="font-bold text-slate-800">${escapeHtml(t.userName || 'Anonymous')}</div>
                      <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(t.userEmail || 'No email provided')}</div>
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.category === 'PAYMENT' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        t.category === 'PRICING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }">${escapeHtml(t.category)}</span>
                      ${t.isEscalated ? '<span class="ml-1 text-[9px] font-extrabold text-rose-600">⚡ ESCALATED</span>' : ''}
                    </td>
                    <td class="p-3 text-slate-600 max-w-xs truncate" title="${escapeHtml(t.message || '')}">
                      ${escapeHtml(t.message)}
                    </td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'OPEN' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        t.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }">${escapeHtml(t.status)}</span>
                    </td>
                    <td class="p-3 text-slate-400 text-[11px] font-mono">${escapeHtml(new Date(t.createdAt).toLocaleDateString())} ${escapeHtml(new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</td>
                    <td class="p-3 text-right">
                      <button type="button" data-action="open-ticket-reply" data-idx="${idx}" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] transition shadow-xs">
                        Reply & Manage
                      </button>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="7" class="p-8 text-center text-slate-400 font-medium">No tickets match the selected filters.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function openTicketReplyModal(ticket) {
    document.getElementById('ticket-reply-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'ticket-reply-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 class="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <span>Ticket: ${escapeHtml(ticket.ticketNumber)}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${escapeHtml(ticket.category)}</span>
            </h3>
            <p class="text-[11px] text-slate-500 font-mono mt-0.5">From: ${escapeHtml(ticket.userName || 'User')} (${escapeHtml(ticket.userEmail || 'No email')})</p>
          </div>
          <button type="button" data-close-modal="ticket-reply-modal" class="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
        </div>

        <div class="space-y-3">
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer Message:</div>
            <div class="text-xs text-slate-800 whitespace-pre-wrap">${escapeHtml(ticket.message)}</div>
          </div>

          ${ticket.reply ? `
            <div class="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Last Sent Reply:</div>
              <div class="text-xs text-emerald-950 whitespace-pre-wrap">${escapeHtml(ticket.reply)}</div>
            </div>
          ` : ''}

          <div class="space-y-1.5">
            <label class="text-xs font-bold text-slate-700 block">Dispatch Reply to Customer:</label>
            <textarea id="reply-text-input" rows="4" placeholder="Write official resolution or answer..." class="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-emerald-500 font-sans"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1">Update Status:</label>
              <select id="reply-status-select" class="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 font-semibold focus:outline-emerald-500">
                <option value="RESOLVED" ${ticket.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
                <option value="IN_PROGRESS" ${ticket.status === 'IN_PROGRESS' ? 'selected' : ''}>IN_PROGRESS</option>
                <option value="CLOSED" ${ticket.status === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
                <option value="OPEN" ${ticket.status === 'OPEN' ? 'selected' : ''}>OPEN</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-slate-700 block mb-1">Internal Admin Notes:</label>
              <input type="text" id="reply-admin-notes" value="${escapeHtml(ticket.adminNotes || '')}" placeholder="Optional private notes..." class="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-emerald-500">
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-3 border-t border-slate-100">
          <button type="button" data-close-modal="ticket-reply-modal" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Cancel</button>
          <button type="button" data-action="send-ticket-reply" data-ticket-id="${escapeHtml(ticket.id)}" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-sm">Send Official Reply</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async function sendTicketReply(ticketId) {
    const reply = document.getElementById('reply-text-input')?.value?.trim() || '';
    const status = document.getElementById('reply-status-select')?.value || 'RESOLVED';
    const adminNotes = document.getElementById('reply-admin-notes')?.value?.trim() || '';

    if (!reply) {
      showToast('Please type a reply message before submitting.', 'error');
      return;
    }

    const res = await apiFetch(`/api/v1/commercial/admin/support-tickets/${encodeURIComponent(ticketId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply, status, adminNotes }),
    });

    if (res.success) {
      showToast('Reply dispatched and ticket updated successfully!');
      document.getElementById('ticket-reply-modal')?.remove();
      await renderSupportTickets();
    } else {
      showToast(res.error || 'Failed to dispatch reply', 'error');
    }
  }

  function onMonthlyPriceChange(planId) {
    const monthlyInput = document.getElementById(`price-monthly-${planId}`);
    const annualInput = document.getElementById(`price-annual-${planId}`);
    const equivBadge = document.getElementById(`price-equiv-${planId}`);
    if (!monthlyInput || !annualInput) return;

    const monthly = Math.max(0, Number.parseInt(monthlyInput.value || '0', 10));
    const discount = Math.max(0, Math.min(100, pricingState.annualDiscountPercent));
    const annual = Math.round(monthly * 12 * (1 - discount / 100));

    annualInput.value = String(annual);
    if (equivBadge) {
      equivBadge.textContent = `₹${Math.round(annual / 12).toLocaleString('en-IN')}/mo`;
    }

    pricingState.draftPrices[planId] = {
      planId,
      monthlyPricePaise: monthly * 100,
      annualPricePaise: annual * 100,
      currency: 'INR',
    };
  }

  function onAnnualPriceChange(planId) {
    const annualInput = document.getElementById(`price-annual-${planId}`);
    const monthlyInput = document.getElementById(`price-monthly-${planId}`);
    const equivBadge = document.getElementById(`price-equiv-${planId}`);
    if (!annualInput) return;

    const annual = Math.max(0, Number.parseInt(annualInput.value || '0', 10));
    if (equivBadge) {
      equivBadge.textContent = `₹${Math.round(annual / 12).toLocaleString('en-IN')}/mo`;
    }

    pricingState.draftPrices[planId] = {
      planId,
      monthlyPricePaise: (monthlyInput ? Number.parseInt(monthlyInput.value || '0', 10) : Math.round(annual / 6)) * 100,
      annualPricePaise: annual * 100,
      currency: 'INR',
    };
  }

  function onDiscountPercentChange() {
    const discInput = document.getElementById('pricing-discount-input');
    if (!discInput) return;
    const val = Math.max(0, Math.min(100, Number.parseInt(discInput.value || '50', 10)));
    pricingState.annualDiscountPercent = val;

    const allPlans = [...(pricingState.catalog?.personal || []), ...(pricingState.catalog?.business || [])];
    for (const p of allPlans) {
      if (document.getElementById(`price-monthly-${p.planId}`)) {
        onMonthlyPriceChange(p.planId);
      }
    }
    showToast(`Annual discount updated to ${val}%. Recomputed annual prices.`);
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
        prices,
        annualDiscountPercent: pricingState.annualDiscountPercent,
        existingSubscriberPolicy: policy,
      }),
    });

    if (res.success) {
      showToast(`Pricing draft v${res.data.version} saved successfully!`);
      await renderPlans();
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
        prices,
        annualDiscountPercent: pricingState.annualDiscountPercent,
        existingSubscriberPolicy: policy,
      }),
    });

    if (!draftRes.success) {
      showToast(draftRes.error || 'Failed to prepare preview', 'error');
      return;
    }

    const draftVer = draftRes.data.version;
    const previewRes = await apiFetch(`/api/v1/admin/pricing/preview/${draftVer}`);
    if (!previewRes.success) {
      showToast(previewRes.error || 'Failed to load preview', 'error');
      return;
    }

    const prev = previewRes.data;
    document.getElementById('pricing-preview-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'pricing-preview-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden space-y-5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 class="text-base font-bold text-slate-900">Preview Pricing Version v${escapeHtml(draftVer)}</h3>
            <p class="text-xs text-slate-500">Inspect diffs, affected subscribers, and grandfathering policy before live publishing.</p>
          </div>
          <button type="button" data-close-modal="pricing-preview-modal" class="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
            <span class="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Subscriber Policy</span>
            <div class="text-xs font-black text-emerald-900 mt-1 font-mono">${escapeHtml(prev.existingSubscriberPolicy)}</div>
          </div>
          <div class="p-3 bg-blue-50 rounded-2xl border border-blue-100">
            <span class="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Total Active Subs</span>
            <div class="text-base font-black text-blue-900 mt-0.5 font-mono">${Number(prev.activeSubscriberCount || 0)}</div>
          </div>
          <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Discount Rule</span>
            <div class="text-base font-black text-slate-900 mt-0.5 font-mono">${Number(prev.annualDiscountPercent || 0)}% OFF</div>
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
              ${prev.priceDiffs.map((d) => `
                <tr class="${d.monthlyChanged ? 'bg-amber-50/50' : ''}">
                  <td class="p-2.5 font-bold font-sans text-slate-800">${escapeHtml(d.displayName)}</td>
                  <td class="p-2.5 text-slate-400">₹${(d.oldMonthlyPaise / 100).toLocaleString('en-IN')}</td>
                  <td class="p-2.5 font-bold ${d.monthlyChanged ? 'text-emerald-700' : 'text-slate-700'}">₹${(d.newMonthlyPaise / 100).toLocaleString('en-IN')}</td>
                  <td class="p-2.5 text-slate-400">₹${(d.oldAnnualPaise / 100).toLocaleString('en-IN')}</td>
                  <td class="p-2.5 font-bold ${d.annualChanged ? 'text-emerald-700' : 'text-slate-700'}">₹${(d.newAnnualPaise / 100).toLocaleString('en-IN')}</td>
                  <td class="p-2.5 text-right font-bold ${d.monthlyPercentChange > 0 ? 'text-rose-600' : d.monthlyPercentChange < 0 ? 'text-emerald-600' : 'text-slate-400'}">
                    ${d.monthlyPercentChange > 0 ? '+' : ''}${Number(d.monthlyPercentChange || 0)}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-slate-100">
          <div class="text-[11px] text-slate-500">
            Publishing creates immutable Version ${escapeHtml(draftVer)} and activates pricing live.
          </div>
          <div class="flex items-center space-x-2">
            <button type="button" data-close-modal="pricing-preview-modal" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Cancel</button>
            <button type="button" data-action="execute-publish-draft" data-version="${escapeHtml(draftVer)}" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5">
              <span>✓ Confirm & Publish Live</span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async function executePublishDraft(version) {
    document.getElementById('pricing-preview-modal')?.remove();

    const policyEl = document.getElementById('pricing-policy-select');
    const policy = policyEl ? policyEl.value : 'GRANDFATHER';

    const res = await apiFetch(`/api/v1/admin/pricing/publish/${encodeURIComponent(version)}`, {
      method: 'POST',
      body: JSON.stringify({ policy }),
    });

    if (res.success) {
      showToast(`Pricing version v${version} published LIVE successfully!`);
      await renderPlans();
    } else {
      showToast(res.error || 'Failed to publish version', 'error');
    }
  }

  async function promptRollback(version) {
    const reason = prompt(`Enter rollback reason for Version ${version}:`, 'Emergency pricing correction');
    if (!reason) return;

    const res = await apiFetch(`/api/v1/admin/pricing/rollback/${encodeURIComponent(version)}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

    if (res.success) {
      showToast(`Pricing successfully rolled back to Version ${version}!`);
      await renderPlans();
    } else {
      showToast(res.error || 'Rollback failed', 'error');
    }
  }

  function renderPlanCard(p) {
    const monthlyPaise = p.monthlyPricePaise || 0;
    const annualPaise = p.annualPricePaise || 0;
    const monthlyRupees = Math.round(monthlyPaise / 100);
    const annualRupees = Math.round(annualPaise / 100);
    const isPopular = p.isPopular;
    const escapedPlanId = escapeHtml(p.planId);

    return `
      <div class="bg-white rounded-3xl border ${isPopular ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-md' : 'border-slate-200 shadow-xs'} p-5 flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-extrabold text-slate-900 text-sm tracking-tight">${escapeHtml(p.displayName)}</h4>
              <span class="text-[10px] font-mono text-slate-400">${escapedPlanId}</span>
            </div>
            ${isPopular ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white uppercase tracking-wider">POPULAR</span>' : ''}
          </div>

          <div class="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <div>
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Monthly Price</span>
                <span class="font-mono text-slate-400">₹ INR</span>
              </div>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                <input id="price-monthly-${escapedPlanId}" data-price-type="monthly" data-plan-id="${escapedPlanId}" type="number" step="1" value="${monthlyRupees}" class="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-emerald-500">
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                <span>Annual Price (Billed Yearly)</span>
                <span id="price-equiv-${escapedPlanId}" class="font-mono text-emerald-700 text-[10px] font-bold">₹${Math.round(annualRupees / 12).toLocaleString('en-IN')}/mo</span>
              </div>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                <input id="price-annual-${escapedPlanId}" data-price-type="annual" data-plan-id="${escapedPlanId}" type="number" step="1" value="${annualRupees}" class="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-emerald-500">
              </div>
              <p class="text-[9px] text-slate-400 mt-1">Auto-scales at 50% discount. Override permitted.</p>
            </div>
          </div>

          <div class="mt-4">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fixed Entitlements:</span>
            <ul class="mt-2 space-y-1.5 text-xs text-slate-700 font-medium">
              <li class="flex items-center justify-between">
                <span class="text-slate-500">Profiles Limit:</span>
                <span class="font-black text-slate-900 font-mono">${Number(p.profileLimit || 0)}</span>
              </li>
              ${p.seatLimit ? `
                <li class="flex items-center justify-between">
                  <span class="text-slate-500">Team Seats:</span>
                  <span class="font-black text-slate-900 font-mono">${p.seatLimit === 999999 ? 'Unlimited' : Number(p.seatLimit)}</span>
                </li>
              ` : ''}
              ${p.cloudMinutesMonthly ? `
                <li class="flex items-center justify-between">
                  <span class="text-slate-500">Cloud Android:</span>
                  <span class="font-black text-slate-900 font-mono">${Number(p.cloudMinutesMonthly)} min/mo</span>
                </li>
              ` : ''}
              ${p.proxyDataGbMonthly ? `
                <li class="flex items-center justify-between">
                  <span class="text-slate-500">Proxy Data:</span>
                  <span class="font-black text-slate-900 font-mono">${Number(p.proxyDataGbMonthly)} GB/mo</span>
                </li>
              ` : ''}
            </ul>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Capabilities: ${Object.keys(p.capabilities || {}).length}</span>
          <span class="text-emerald-700 font-bold">Separated from price ✓</span>
        </div>
      </div>
    `;
  }

  async function renderPlans() {
    const container = document.getElementById('content-container');
    if (!container) return;
    container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading pricing catalog and version state...</div>';

    const [catRes, actRes, verRes, syncRes, revRes] = await Promise.all([
      apiFetch('/api/v1/admin/pricing/catalog'),
      apiFetch('/api/v1/admin/pricing/active'),
      apiFetch('/api/v1/admin/pricing/versions'),
      apiFetch('/api/v1/admin/pricing/provider-sync-status'),
      apiFetch('/api/v1/admin/pricing/revenue-summary'),
    ]);

    if (!catRes.success || !actRes.success) {
      container.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold">Failed to load pricing engine: ${escapeHtml(catRes.error || actRes.error)}</div>`;
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
        currency: 'INR',
      };
    }

    const activeVer = pricingState.activeVersion;
    const personalPlans = catRes.data.personal || [];
    const businessPlans = catRes.data.business || [];

    container.innerHTML = `
      <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">LIVE VERSION v${escapeHtml(activeVer.version)}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">Policy: ${escapeHtml(activeVer.existingSubscriberPolicy)}</span>
              <span class="text-xs text-slate-400">Published ${escapeHtml(new Date(activeVer.publishedAt).toLocaleDateString())} by ${escapeHtml(activeVer.publishedBy)}</span>
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
              <span class="w-2 h-2 rounded-full ${pricingState.syncStatus.stripe === 'SYNCED' ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
              <span class="text-slate-700 font-bold">Stripe</span>
            </div>
            <div class="flex items-center space-x-1.5 px-2 py-1 bg-white rounded-xl border border-slate-200 font-mono text-[11px]">
              <span class="w-2 h-2 rounded-full ${pricingState.syncStatus.razorpay === 'SYNCED' ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
              <span class="text-slate-700 font-bold">Razorpay</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div class="flex flex-col space-y-1">
            <label class="text-[11px] font-bold text-slate-600">Default Annual Discount %</label>
            <div class="flex items-center space-x-2">
              <input id="pricing-discount-input" type="number" min="0" max="90" value="${Number(pricingState.annualDiscountPercent)}" class="w-20 px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 bg-slate-50">
              <span class="text-xs text-slate-500 font-bold">% off</span>
            </div>
          </div>

          <div class="flex flex-col space-y-1">
            <label class="text-[11px] font-bold text-slate-600">Subscriber Migration Policy</label>
            <select id="pricing-policy-select" class="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500">
              <option value="GRANDFATHER" ${pricingState.subscriberPolicy === 'GRANDFATHER' ? 'selected' : ''}>Grandfather (Keep old price indefinitely)</option>
              <option value="MIGRATE_RENEWAL" ${pricingState.subscriberPolicy === 'MIGRATE_RENEWAL' ? 'selected' : ''}>Migrate at Next Renewal</option>
              <option value="MIGRATE_IMMEDIATE" ${pricingState.subscriberPolicy === 'MIGRATE_IMMEDIATE' ? 'selected' : ''}>Migrate Immediately (Prorated)</option>
            </select>
          </div>

          <div class="md:col-span-2 flex items-center justify-end space-x-2">
            <button type="button" data-action="save-pricing-draft" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs">
              Save Draft
            </button>
            <button type="button" data-action="preview-pricing-modal" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center space-x-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>Preview & Publish</span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center space-x-6 border-b border-slate-200 text-xs font-bold">
        <button type="button" id="pricing-tab-personal" data-action="switch-pricing-tab" data-category="personal" class="pb-3 border-b-2 border-emerald-600 text-emerald-700 font-extrabold flex items-center space-x-2">
          <span>Personal Plans (Individual Users)</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">4</span>
        </button>
        <button type="button" id="pricing-tab-business" data-action="switch-pricing-tab" data-category="business" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-2">
          <span>Business Plans (Teams & Organizations)</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">4</span>
        </button>
      </div>

      <div id="pricing-grid-personal" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        ${personalPlans.map((p) => renderPlanCard(p)).join('')}
      </div>

      <div id="pricing-grid-business" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 hidden">
        ${businessPlans.map((p) => renderPlanCard(p)).join('')}
      </div>

      <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider">Pricing Version History & Audit Trail</h3>
            <p class="text-[11px] text-slate-400">All published snapshots are cryptographically versioned and rollback-ready.</p>
          </div>
          <span class="text-xs font-mono text-slate-500">${pricingState.versions.length} versions</span>
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
            ${pricingState.versions.map((v) => `
              <tr class="${v.version === activeVer.version ? 'bg-emerald-50/40 font-bold' : ''}">
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded font-black ${v.version === activeVer.version ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}">
                    v${escapeHtml(v.version)}
                  </span>
                </td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${v.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : v.status === 'SUPERSEDED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}">
                    ${escapeHtml(v.status)}
                  </span>
                </td>
                <td class="p-3 text-slate-600">${escapeHtml(v.existingSubscriberPolicy)}</td>
                <td class="p-3 text-slate-600">${Number(v.annualDiscountPercent || 0)}%</td>
                <td class="p-3 text-slate-500 font-sans">${v.publishedAt ? escapeHtml(new Date(v.publishedAt).toLocaleString()) : 'Draft'}</td>
                <td class="p-3 text-slate-600 font-sans">${escapeHtml(v.publishedBy || 'SYSTEM')}</td>
                <td class="p-3 text-right font-sans">
                  ${v.version !== activeVer.version && v.status === 'SUPERSEDED' ? `
                    <button type="button" data-action="rollback-pricing" data-version="${escapeHtml(v.version)}" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition">
                      Rollback
                    </button>
                  ` : v.version === activeVer.version ? `
                    <span class="text-[10px] text-emerald-600 font-bold">Active</span>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderLicenses() {
    const container = document.getElementById('content-container');
    if (!container) return;
    container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading licenses...</div>';
    const res = await apiFetch('/api/v1/admin/licenses');
    if (!res.success) return;

    container.innerHTML = `
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Mint New License Key</h3>
          <p class="text-xs text-slate-400">Generate a cryptographically signed MAHI Pro license key.</p>
        </div>
        <button type="button" data-action="mint-license" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition">
          + Mint License Key
        </button>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="p-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-900">Issued Licenses (${res.data.length})</h3>
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
            ${res.data.map((l) => `
              <tr class="hover:bg-slate-50">
                <td class="p-3 font-bold text-slate-800">${escapeHtml(l.customerName)}</td>
                <td class="p-3 font-mono font-bold text-emerald-700">${escapeHtml(l.keyMasked)}</td>
                <td class="p-3 text-slate-600">${escapeHtml(l.durationType)}</td>
                <td class="p-3 text-slate-600">${Number(l.activeDevicesCount || 0)} / ${Number(l.maxDevices || 0)}</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    l.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }">${escapeHtml(l.status)}</span>
                </td>
                <td class="p-3 text-slate-400 text-[11px]">${l.expiresAt ? escapeHtml(new Date(l.expiresAt).toLocaleDateString()) : 'Lifetime'}</td>
                <td class="p-3 text-right space-x-1.5">
                  ${l.status === 'ACTIVE' ? `
                    <button type="button" data-action="revoke-license" data-lid="${escapeHtml(l.id)}" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[10px]">Revoke</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function promptMintLicense() {
    const name = prompt('Enter Customer / Client Name:', 'Client-1');
    if (!name) return;
    const res = await apiFetch('/api/v1/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({
        customerName: name,
        durationType: '1_YEAR',
        maxDevices: 5,
      }),
    });
    if (res.success) {
      alert(`License Minted Successfully!\n\nRaw Key (Save this): ${res.rawLicenseKey}`);
      await renderLicenses();
    } else {
      showToast(res.error || 'Minting failed', 'error');
    }
  }

  async function revokeLicenseKey(licenseId) {
    if (!confirm('Are you sure you want to revoke this license?')) return;
    const res = await apiFetch('/api/v1/admin/licenses/revoke', {
      method: 'POST',
      body: JSON.stringify({ licenseId, reason: 'Revoked from Admin Panel' }),
    });
    if (res.success) {
      showToast('License revoked');
      await renderLicenses();
    }
  }

  async function renderDevices() {
    const container = document.getElementById('content-container');
    if (!container) return;
    const res = await apiFetch('/api/v1/admin/devices');
    if (!res.success) return;

    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="p-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-900">Active Authorized Devices (${res.data.length})</h3>
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
            ${res.data.map((d) => `
              <tr class="hover:bg-slate-50">
                <td class="p-3 font-bold text-slate-800">${escapeHtml(d.deviceName)}</td>
                <td class="p-3 font-mono text-[11px] text-slate-500">${escapeHtml(d.deviceId)}</td>
                <td class="p-3 text-slate-600">${escapeHtml(d.osInfo)}</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }">${escapeHtml(d.status)}</span>
                </td>
                <td class="p-3 text-slate-400 text-[11px]">${escapeHtml(new Date(d.lastSeenAt).toLocaleString())}</td>
                <td class="p-3 text-right">
                  ${d.status === 'ACTIVE' ? `
                    <button type="button" data-action="revoke-device" data-did="${escapeHtml(d.deviceId)}" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[10px]">Revoke Access</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function revokeDevice(deviceId) {
    if (!confirm('Revoke access for this device?')) return;
    const res = await apiFetch(`/api/v1/admin/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Device revoked successfully');
      await renderDevices();
    }
  }

  async function renderVersions() {
    const container = document.getElementById('content-container');
    if (!container) return;
    const res = await apiFetch('/api/v1/admin/versions');
    if (!res.success) return;

    container.innerHTML = `
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Publish Software Release</h3>
          <p class="text-xs text-slate-400">Release a new client version and set minimum supported versions.</p>
        </div>
        <button type="button" data-action="publish-version" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition">
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
            ${res.data.map((v) => `
              <tr class="hover:bg-slate-50">
                <td class="p-3 font-mono font-bold text-emerald-700">v${escapeHtml(v.version)}</td>
                <td class="p-3 font-mono text-slate-500">v${escapeHtml(v.minSupportedVersion)}</td>
                <td class="p-3 text-slate-700">${escapeHtml(v.releaseNotes)}</td>
                <td class="p-3">${v.isMandatory ? '<span class="text-rose-600 font-bold">YES</span>' : '<span class="text-slate-400">NO</span>'}</td>
                <td class="p-3 text-slate-400 text-[11px]">${escapeHtml(new Date(v.releasedAt).toLocaleString())}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
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
        isMandatory: false,
      }),
    });
    if (res.success) {
      showToast(`Release v${ver} published successfully!`);
      await renderVersions();
    }
  }

  async function renderAuditLogs() {
    const container = document.getElementById('content-container');
    if (!container) return;
    const res = await apiFetch('/api/v1/admin/audit-logs');
    if (!res.success) return;

    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="p-4 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-900">Tamper-Proof Audit Trail (${Number(res.total || res.data?.length || 0)})</h3>
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
            ${res.data.map((l) => `
              <tr class="hover:bg-slate-50">
                <td class="p-3 font-mono text-[11px] text-slate-400">${escapeHtml(new Date(l.createdAt).toLocaleString())}</td>
                <td class="p-3 font-bold text-slate-700">${escapeHtml(l.actorName)} <span class="text-[10px] text-slate-400">(${escapeHtml(l.actorRole)})</span></td>
                <td class="p-3 font-mono font-semibold text-emerald-700">${escapeHtml(l.action)}</td>
                <td class="p-3 font-mono text-[11px] text-slate-500">${escapeHtml(l.targetType)}</td>
                <td class="p-3 text-slate-600">${escapeHtml(l.details)}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${l.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${escapeHtml(l.result)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderDemoRequests(statusFilter = '') {
    const container = document.getElementById('content-container');
    if (!container) return;
    const url = statusFilter
      ? `/api/v1/commercial/admin/demo-requests?status=${encodeURIComponent(statusFilter)}`
      : '/api/v1/commercial/admin/demo-requests';
    const res = await apiFetch(url);
    if (!res.success) {
      container.innerHTML = '<div class="p-6 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold">Failed to load demo requests</div>';
      return;
    }

    const leads = res.data || [];
    const statuses = ['NEW', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'CLOSED'];

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <button type="button" data-action="filter-demo-requests" data-status="" class="px-3 py-1.5 rounded-xl text-xs font-bold ${!statusFilter ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}">All (${leads.length})</button>
            ${statuses.map((st) => `
              <button type="button" data-action="filter-demo-requests" data-status="${st}" class="px-3 py-1.5 rounded-xl text-xs font-bold ${statusFilter === st ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}">${st}</button>
            `).join('')}
          </div>
          <button type="button" data-action="filter-demo-requests" data-status="${escapeHtml(statusFilter)}" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50">↻ Refresh</button>
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
              ${leads.length === 0 ? '<tr><td colspan="7" class="p-8 text-center text-slate-400">No demo requests found</td></tr>' : leads.map((lead) => `
                <tr class="hover:bg-slate-50">
                  <td class="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">${escapeHtml(new Date(lead.createdAt).toLocaleDateString())}</td>
                  <td class="p-3">
                    <div class="font-bold text-slate-900">${escapeHtml(lead.fullName)}</div>
                    <div class="text-[11px] text-slate-500 font-mono">${escapeHtml(lead.email)}</div>
                  </td>
                  <td class="p-3">
                    <div class="font-bold text-slate-800">${escapeHtml(lead.companyName || '—')}</div>
                    <div class="text-[11px] text-slate-500">${escapeHtml(lead.teamSize)} members</div>
                  </td>
                  <td class="p-3 text-slate-700 max-w-xs truncate">${escapeHtml(lead.useCase)}</td>
                  <td class="p-3">
                    <div class="text-slate-800 font-medium">${escapeHtml(lead.contactMethod)}</div>
                    ${lead.preferredDatetime ? `<div class="text-[10px] text-slate-400">${escapeHtml(lead.preferredDatetime)}</div>` : ''}
                  </td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      lead.status === 'NEW' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                      lead.status === 'SCHEDULED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      lead.status === 'COMPLETED' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                      lead.status === 'CONTACTED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }">${escapeHtml(lead.status)}</span>
                  </td>
                  <td class="p-3 text-right">
                    <select data-demo-status-select="true" data-lead-id="${escapeHtml(lead.id)}" class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none">
                      ${statuses.map((s) => `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function updateDemoStatus(id, newStatus) {
    const res = await apiFetch(`/api/v1/commercial/admin/demo-requests/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.success) {
      showToast(`Lead status updated to ${newStatus}`);
      await renderDemoRequests();
    } else {
      showToast(res.error || 'Failed to update status', 'error');
    }
  }

  async function renderFunnelTelemetry() {
    const container = document.getElementById('content-container');
    if (!container) return;
    const res = await apiFetch('/api/v1/commercial/admin/funnel-metrics');
    if (!res.success) {
      container.innerHTML = '<div class="p-6 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold">Failed to load funnel metrics</div>';
      return;
    }

    const m = res.data;
    const signupPct = Math.min(100, Number(m.signupRate) || 0);
    const downloadPct = Math.min(100, Number(m.downloadRate) || 0);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CTA Clicks</span>
            <div class="text-2xl font-black text-slate-900 mt-1 font-mono">${Number(m.landingCtaClicks || 0)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Landing engagement</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signup Starts</span>
            <div class="text-2xl font-black text-sky-600 mt-1 font-mono">${Number(m.signupStarts || 0)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Registration begun</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accounts Created</span>
            <div class="text-2xl font-black text-emerald-600 mt-1 font-mono">${Number(m.signupCompletions || 0)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${signupPct}% completion</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">7-Day Trials</span>
            <div class="text-2xl font-black text-amber-600 mt-1 font-mono">${Number(m.trialActivations || 0)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Server entitlements</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Downloads</span>
            <div class="text-2xl font-black text-purple-600 mt-1 font-mono">${Number(m.downloadsStarted || 0)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Windows x64 installer</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid Conversions</span>
            <div class="text-2xl font-black text-emerald-700 mt-1 font-mono">${Number(m.paidConversions || 0)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${Number(m.overallConversionRate || 0)}% overall</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 class="text-sm font-bold text-slate-900">Onboarding Pipeline Health</h3>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Signup Completion (Starts → Created)</span>
                <span>${signupPct}%</span>
              </div>
              <progress max="100" value="${signupPct}" class="mahi-progress mahi-progress-emerald"></progress>
            </div>
            <div>
              <div class="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Download Activation (Signups → Downloads)</span>
                <span>${downloadPct}%</span>
              </div>
              <progress max="100" value="${downloadPct}" class="mahi-progress mahi-progress-purple"></progress>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function renderPayments() {
    const container = document.getElementById('content-container');
    if (!container) return;
    container.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">Loading payments and verification queue...</div>';
    const res = await apiFetch('/api/v1/admin/payments');
    if (!res.success) {
      container.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">Failed to load payments: ${escapeHtml(res.error || 'Unauthorized')}</div>`;
      return;
    }
    const list = res.data || res.payments || [];
    const pendingCount = list.filter((p) => p.status === 'PENDING_VERIFICATION').length;

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Payments & Verification Queue</h2>
            <p class="text-xs text-slate-500">Review manual UPI UTR submissions, approve entitlements, or reject invalid transactions.</p>
          </div>
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${pendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">
              ${pendingCount} Pending Verification
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
                ${list.length > 0 ? list.map((p) => {
                  const isPending = p.status === 'PENDING_VERIFICATION';
                  const isSucceeded = p.status === 'SUCCEEDED';
                  const isRejected = p.status === 'REJECTED' || p.status === 'FAILED';
                  const amountFormatted = p.currency === 'INR'
                    ? `₹${(p.amountCents / 100).toLocaleString('en-IN')}`
                    : `$${(p.amountCents / 100).toFixed(2)}`;
                  const statusBadge = isPending
                    ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending Review</span>'
                    : isSucceeded
                      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Succeeded</span>'
                      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>';

                  const safeProofAsset = p.metadata?.proofAsset && (p.metadata.proofAsset.startsWith('https://') || p.metadata.proofAsset.startsWith('/'))
                    ? p.metadata.proofAsset
                    : null;
                  const proofHtml = safeProofAsset
                    ? `<a href="${escapeHtml(safeProofAsset)}" target="_blank" rel="noopener noreferrer" class="text-[10px] text-emerald-600 hover:underline block mt-0.5 font-medium">View Proof</a>`
                    : p.metadata?.proofAsset ? `<span class="text-[10px] text-slate-400 block mt-0.5">Proof: ${escapeHtml(p.metadata.proofAsset)}</span>` : '';

                  const rejectionHtml = p.metadata?.rejectionReason && isRejected
                    ? `<div class="text-[10px] text-rose-600 font-medium mt-0.5 leading-tight">Reason: ${escapeHtml(p.metadata.rejectionReason)}</div>`
                    : '';

                  return `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="p-3">
                        <div class="font-mono font-bold text-slate-800 text-[11px]">${escapeHtml(p.id)}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(new Date(p.createdAt).toLocaleString())}</div>
                      </td>
                      <td class="p-3">
                        <div class="font-mono text-slate-700 text-[11px]">${escapeHtml(p.userId)}</div>
                      </td>
                      <td class="p-3">
                        <div class="font-bold text-slate-800 capitalize">${escapeHtml((p.planId || '').replace(/_/g, ' '))}</div>
                        <div class="text-[10px] text-slate-400 uppercase font-semibold">${escapeHtml(p.billingCycle)}</div>
                      </td>
                      <td class="p-3 font-mono font-extrabold text-slate-900">${amountFormatted}</td>
                      <td class="p-3">
                        <div class="flex items-center space-x-1.5">
                          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600">${escapeHtml(p.provider)}</span>
                          <span class="font-mono font-bold text-slate-900 text-[11px]">${escapeHtml(p.externalPaymentId || '-')}</span>
                        </div>
                        ${proofHtml}
                      </td>
                      <td class="p-3">
                        ${statusBadge}
                        ${rejectionHtml}
                      </td>
                      <td class="p-3 text-right">
                        ${isPending ? `
                          <div class="flex items-center justify-end space-x-1.5">
                            <button type="button" data-action="approve-payment" data-pid="${escapeHtml(p.id)}" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-xs transition">
                              Approve
                            </button>
                            <button type="button" data-action="reject-payment" data-pid="${escapeHtml(p.id)}" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition">
                              Reject
                            </button>
                          </div>
                        ` : '<span class="text-[11px] text-slate-400 italic">Completed</span>'}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" class="p-8 text-center text-slate-400">No payment transactions recorded yet.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  async function approvePayment(id) {
    if (!confirm('Approve this payment and immediately activate the user subscription?')) return;
    const res = await apiFetch(`/api/v1/admin/payments/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    if (res.success) {
      showToast('Payment approved & subscription activated successfully!');
      await renderPayments();
    } else {
      showToast(`Approval failed: ${res.error || 'Unknown error'}`, 'error');
    }
  }

  async function rejectPayment(id) {
    const reason = prompt('Please enter rejection reason (e.g. Invalid UTR / Amount Mismatch):');
    if (reason === null) return;
    const res = await apiFetch(`/api/v1/admin/payments/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() || 'Payment rejected by administrator' }),
    });
    if (res.success) {
      showToast('Payment marked as rejected.');
      await renderPayments();
    } else {
      showToast(`Rejection failed: ${res.error || 'Unknown error'}`, 'error');
    }
  }

  function handleActionClick(actionEl) {
    const action = actionEl.getAttribute('data-action');
    const idx = Number.parseInt(actionEl.getAttribute('data-idx') || '', 10);

    switch (action) {
      case 'switch-page': {
        const page = actionEl.getAttribute('data-page');
        if (page) switchPage(page);
        break;
      }
      case 'refresh-users':
        renderUsers();
        break;
      case 'copy-user-field':
        if (!Number.isNaN(idx)) {
          const field = actionEl.getAttribute('data-field') || 'id';
          copyUserFieldByIndex(idx, field, actionEl);
        }
        break;
      case 'open-grant-modal': {
        const u = cachedAdminUsers[idx];
        if (u) openGrantPremiumModal(u.id, u.name || '', u.email || '');
        break;
      }
      case 'open-boost-modal': {
        const u = cachedAdminUsers[idx];
        if (u) openBoostModal(u.id, u.email || '', u.bonusProfiles || 0);
        break;
      }
      case 'open-features-modal': {
        const u = cachedAdminUsers[idx];
        if (u) openFeaturesModal(u.id, u.email || '', u.featureOverrides || {});
        break;
      }
      case 'reset-user-hwid': {
        const u = cachedAdminUsers[idx];
        if (u) resetUserHardware(u.id, u.email || '');
        break;
      }
      case 'change-user-status': {
        const u = cachedAdminUsers[idx];
        const status = actionEl.getAttribute('data-status');
        if (u && status) changeUserStatus(u.id, status);
        break;
      }
      case 'copy-text':
        copyToClipboard(actionEl.getAttribute('data-copy') || '', actionEl, 'Copied!');
        break;
      case 'execute-modal-grant': {
        const uid = actionEl.getAttribute('data-uid');
        if (uid) executeModalGrant(uid);
        break;
      }
      case 'close-grant-and-refresh':
        document.getElementById('grant-premium-modal')?.remove();
        renderUsers();
        break;
      case 'execute-boost': {
        const uid = actionEl.getAttribute('data-uid');
        const boostType = actionEl.getAttribute('data-boost-type') || 'PROFILES';
        const amount = Number.parseInt(actionEl.getAttribute('data-amount') || '0', 10);
        if (uid && amount > 0) executeBoost(uid, boostType, amount);
        break;
      }
      case 'execute-custom-boost': {
        const uid = actionEl.getAttribute('data-uid');
        const raw = document.getElementById('custom-boost-input')?.value || '';
        const val = Number.parseInt(raw, 10);
        if (uid && val > 0) executeBoost(uid, 'PROFILES', val);
        break;
      }
      case 'save-features': {
        const uid = actionEl.getAttribute('data-uid');
        if (uid) saveFeatures(uid);
        break;
      }
      case 'refresh-tickets':
        renderSupportTickets();
        break;
      case 'open-ticket-reply': {
        const t = cachedAdminTickets[idx];
        if (t) openTicketReplyModal(t);
        break;
      }
      case 'send-ticket-reply': {
        const tid = actionEl.getAttribute('data-ticket-id');
        if (tid) sendTicketReply(tid);
        break;
      }
      case 'save-pricing-draft':
        savePricingDraft();
        break;
      case 'preview-pricing-modal':
        previewPricingModal();
        break;
      case 'switch-pricing-tab': {
        const cat = actionEl.getAttribute('data-category');
        if (cat) switchPricingTab(cat);
        break;
      }
      case 'execute-publish-draft': {
        const ver = actionEl.getAttribute('data-version');
        if (ver) executePublishDraft(ver);
        break;
      }
      case 'rollback-pricing': {
        const ver = actionEl.getAttribute('data-version');
        if (ver) promptRollback(ver);
        break;
      }
      case 'mint-license':
        promptMintLicense();
        break;
      case 'revoke-license': {
        const lid = actionEl.getAttribute('data-lid');
        if (lid) revokeLicenseKey(lid);
        break;
      }
      case 'revoke-device': {
        const did = actionEl.getAttribute('data-did');
        if (did) revokeDevice(did);
        break;
      }
      case 'publish-version':
        promptPublishVersion();
        break;
      case 'filter-demo-requests':
        renderDemoRequests(actionEl.getAttribute('data-status') || '');
        break;
      case 'approve-payment': {
        const pid = actionEl.getAttribute('data-pid');
        if (pid) approvePayment(pid);
        break;
      }
      case 'reject-payment': {
        const pid = actionEl.getAttribute('data-pid');
        if (pid) rejectPayment(pid);
        break;
      }
      default:
        break;
    }
  }

  function bindEvents() {
    document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = btn.getAttribute('data-page');
        if (page) switchPage(page);
      });
    });

    document.getElementById('admin-secret-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') refreshData();
    });

    document.getElementById('refresh-data-btn')?.addEventListener('click', refreshData);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const closeBtn = target.closest('[data-close-modal]');
      if (closeBtn) {
        const modalId = closeBtn.getAttribute('data-close-modal');
        if (modalId) document.getElementById(modalId)?.remove();
        return;
      }

      const actionEl = target.closest('[data-action]');
      if (actionEl) handleActionClick(actionEl);
    });

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.id === 'user-filter-input') {
        filterUsersTable(target.value);
        return;
      }
      const priceType = target.getAttribute('data-price-type');
      const planId = target.getAttribute('data-plan-id');
      if (priceType && planId) {
        if (priceType === 'monthly') onMonthlyPriceChange(planId);
        else if (priceType === 'annual') onAnnualPriceChange(planId);
      }
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement || target instanceof HTMLInputElement)) return;
      if (target.id === 'ticket-status-filter') {
        currentTicketFilter.status = target.value;
        renderSupportTickets();
        return;
      }
      if (target.id === 'ticket-category-filter') {
        currentTicketFilter.category = target.value;
        renderSupportTickets();
        return;
      }
      if (target.id === 'pricing-discount-input') {
        onDiscountPercentChange();
        return;
      }
      if (target.getAttribute('data-demo-status-select') === 'true') {
        const leadId = target.getAttribute('data-lead-id');
        if (leadId) updateDemoStatus(leadId, target.value);
      }
    });
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    getAdminSecret();
    renderPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
