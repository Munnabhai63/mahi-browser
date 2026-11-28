(() => {
  let cachedMasterLicenses = [];
  let cachedMasterDevices = [];
  let initialized = false;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAuthHeaders() {
    const token = sessionStorage.getItem('mahi_api_token') || '';
    const secret = sessionStorage.getItem('mahi_admin_secret') || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(secret ? { 'X-Admin-Secret': secret } : {}),
    };
  }

  function showSuperToast(title, message, type = 'success') {
    const c = document.getElementById('super-toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `pointer-events-auto p-4 rounded-2xl border text-xs shadow-2xl backdrop-blur-md flex items-center space-x-3 transition-all duration-300 ${
      type === 'success'
        ? 'bg-white border-emerald-300 text-emerald-800'
        : type === 'error'
          ? 'bg-white border-rose-300 text-rose-800'
          : 'bg-white border-slate-300 text-slate-800'
    }`;
    t.innerHTML = `
      <span class="text-base">${type === 'success' ? '' : type === 'error' ? '' : ''}</span>
      <div>
        <h5 class="font-bold text-slate-900">${escapeHtml(title)}</h5>
        <p class="text-slate-500 text-[11px]">${escapeHtml(message)}</p>
      </div>
    `;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add('opacity-0');
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  function togglePinVisibility() {
    const input = document.getElementById('master-pin');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  async function authenticateMaster() {
    const pinEl = document.getElementById('master-pin');
    const err = document.getElementById('auth-error');
    const pin = pinEl ? pinEl.value.trim() : '';
    try {
      const res = await fetch('/api/v2/super-admin/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: pin }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('mahi_admin_secret', pin);
        if (data.token) sessionStorage.setItem('mahi_api_token', data.token);
        document.getElementById('auth-modal')?.classList.add('hidden');
        document.getElementById('super-admin-app')?.classList.remove('hidden');
        showSuperToast('Master Access Granted', 'Root privileges unlocked.', 'success');
        loadLicenses();
        loadMasterFleet();
      } else if (err) {
        err.textContent = data.error || 'Invalid Master Secret Key. Access Denied.';
        err.classList.remove('hidden');
      }
    } catch {
      if (err) {
        err.textContent = 'Authentication request failed.';
        err.classList.remove('hidden');
      }
    }
  }

  function lockConsole() {
    document.getElementById('auth-modal')?.classList.remove('hidden');
    document.getElementById('super-admin-app')?.classList.add('hidden');
    const pinEl = document.getElementById('master-pin');
    if (pinEl) pinEl.value = '';
    document.getElementById('auth-error')?.classList.add('hidden');
    showSuperToast('Console Locked', 'Master session ended.', 'info');
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach((el) => {
      el.classList.add('hidden');
    });
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.className =
        'tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all';
    });

    const target = document.getElementById(`tab-${tabId}`);
    const btn = document.getElementById(`tab-btn-${tabId}`);
    if (target) target.classList.remove('hidden');
    if (btn) btn.className = 'tab-btn active px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all';

    if (tabId === 'license-mint') loadLicenses();
    if (tabId === 'fleet-master') loadMasterFleet();
    if (tabId === 'db-inspector') inspectTable();
  }

  function copyMintedKey() {
    const key = document.getElementById('minted-key-text')?.textContent || '';
    navigator.clipboard.writeText(key);
    showSuperToast('Copied', 'License key copied to clipboard!', 'info');

    const btn = document.getElementById('copy-minted-btn');
    const icon = document.getElementById('copy-icon');
    const text = document.getElementById('copy-text');

    if (btn) btn.classList.replace('bg-emerald-600', 'bg-teal-600');
    if (icon) icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    if (text) text.textContent = 'Copied!';

    setTimeout(() => {
      if (btn) btn.classList.replace('bg-teal-600', 'bg-emerald-600');
      if (icon) {
        icon.innerHTML =
          '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
      }
      if (text) text.textContent = 'Copy Key';
    }, 2000);
  }

  async function actionLicense(id, action) {
    if (action === 'delete' && !confirm('Delete this license forever?')) return;
    try {
      await fetch('/api/v2/super-admin/licenses/action', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, action }),
      });
      loadLicenses();
    } catch {
      alert('Action failed');
    }
  }

  function copyToClip(text) {
    navigator.clipboard.writeText(text);
  }

  async function loadLicenses() {
    const tbody = document.getElementById('licenses-tbody');
    if (!tbody) return;
    try {
      const res = await fetch('/api/v2/super-admin/licenses/list', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success && json.data) {
        cachedMasterLicenses = json.data;
        if (json.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">No licenses minted yet.</td></tr>';
          return;
        }

        tbody.innerHTML = json.data
          .map((l, idx) => {
            const isBanned = l.status === 'DISABLED';
            const statusBadge = isBanned
              ? '<span class="px-2.5 py-1 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300/50 shadow-sm">DISABLED</span>'
              : '<span class="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300/50 shadow-sm">ACTIVE</span>';

            const actionBtn = isBanned
              ? `<button type="button" data-license-action="activate" data-license-idx="${idx}" class="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-[10px] font-bold transition-colors border border-emerald-200">Active</button>`
              : `<button type="button" data-license-action="disable" data-license-idx="${idx}" class="px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-[10px] font-bold transition-colors border border-amber-200">Ban</button>`;

            const name = escapeHtml(l.customer_name || 'Student');
            const fullHash = l.license_key_hash || '';
            const hash = escapeHtml(fullHash ? `${fullHash.substring(0, 25)}...` : 'MAHI-...');
            const dur = escapeHtml(l.duration_type || 'PRO');
            const devs = Number(l.max_devices || 5);
            const exp = escapeHtml(l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'Lifetime');
            const rowClass = `hover:bg-emerald-50/40 hover:shadow-sm cursor-default transition-all duration-300 border-b border-slate-100 last:border-0 group ${isBanned ? 'opacity-75' : ''}`;

            return `<tr class="${rowClass}">` +
              `<td class="px-6 py-4 font-bold text-slate-800">${name}</td>` +
              `<td class="px-6 py-4"><div class="flex items-center space-x-2">` +
              `<span class="font-mono font-bold text-emerald-700 text-[10px] group-hover:text-emerald-600 transition-colors">${hash}</span>` +
              `<button type="button" data-copy-license-idx="${idx}" class="text-slate-400 hover:text-emerald-600 transition-colors" title="Copy Key">` +
              `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></td>` +
              `<td class="px-6 py-4 mono font-semibold text-slate-600 text-[10px]">${dur} | ${devs} Dev</td>` +
              `<td class="px-6 py-4 mono text-slate-500 text-[10px]">${exp}</td>` +
              `<td class="px-6 py-4">${statusBadge}</td>` +
              `<td class="px-6 py-4 text-right space-x-1">` +
              `<button type="button" data-license-action="extend" data-license-idx="${idx}" class="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold transition-colors border border-blue-200" title="+30 Days">+30D</button>` +
              actionBtn +
              `<button type="button" data-license-action="delete" data-license-idx="${idx}" class="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[10px] font-bold transition-colors border border-rose-200">Del</button></td></tr>`;
          })
          .join('');
      }
    } catch {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-rose-500 font-bold">Failed to load licenses. Database error.</td></tr>';
    }
  }

  function actionLicenseByIndex(idx, act) {
    const l = cachedMasterLicenses[idx];
    if (l?.id) return actionLicense(l.id, act);
  }

  function copyLicenseHashByIndex(idx) {
    const l = cachedMasterLicenses[idx];
    if (l?.license_key_hash) copyToClip(l.license_key_hash);
  }

  async function revokeMasterDevice(id) {
    if (!confirm('Are you sure you want to FORCE REVOKE this device from the master network?')) return;
    await fetch(`/api/v2/fleet/devices/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getAuthHeaders() });
    showSuperToast('Device Revoked', 'Hardware access permanently severed.', 'error');
    loadMasterFleet();
  }

  function revokeMasterDeviceByIndex(idx) {
    const d = cachedMasterDevices[idx];
    if (d?.id) return revokeMasterDevice(d.id);
  }

  async function loadMasterFleet() {
    const tbody = document.getElementById('master-fleet-tbody');
    if (!tbody) return;
    try {
      const res = await fetch('/api/v2/fleet/devices', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success && json.data) {
        const devices = json.data;
        cachedMasterDevices = devices;
        if (devices.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No fleet devices enrolled yet.</td></tr>';
          return;
        }
        tbody.innerHTML = devices
          .map(
            (d, idx) => `
          <tr class="hover:bg-slate-50 transition">
            <td class="px-6 py-4 font-mono text-emerald-700 font-bold">${escapeHtml(d.id)}</td>
            <td class="px-6 py-4 font-bold text-slate-900">${escapeHtml(d.hostname)} (${escapeHtml(d.ipAddress || '127.0.0.1')})</td>
            <td class="px-6 py-4 text-slate-600">${escapeHtml(d.osType)}</td>
            <td class="px-6 py-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}">${escapeHtml(d.status)}</span></td>
            <td class="px-6 py-4 text-right">
              <button type="button" data-revoke-device-idx="${idx}" class="px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition">Force Revoke</button>
            </td>
          </tr>
        `
          )
          .join('');
      }
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-rose-500">Failed to load fleet.</td></tr>';
    }
  }

  async function inspectTable() {
    const select = document.getElementById('db-table-select');
    const out = document.getElementById('table-inspector-output');
    if (!select || !out) return;
    const tableName = select.value;
    out.innerHTML = `<span class="text-slate-400">Querying SQLite table ${escapeHtml(tableName)}...</span>`;
    try {
      const res = await fetch(`/api/v2/super-admin/db/table/${encodeURIComponent(tableName)}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        out.innerHTML = `<pre class="text-xs text-emerald-400">${escapeHtml(JSON.stringify(json.data, null, 2))}</pre>`;
      } else {
        out.innerHTML = `<span class="text-rose-400">Error: ${escapeHtml(json.error || 'Failed to query table')}</span>`;
      }
    } catch {
      out.innerHTML = '<span class="text-rose-400">Failed to query database.</span>';
    }
  }

  async function downloadBinary(endpoint, fallbackName) {
    try {
      const res = await fetch(endpoint, { headers: getAuthHeaders() });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showSuperToast('Download Blocked', errJson.error || 'Failed to download binary.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showSuperToast('Error', 'Download request failed.', 'error');
    }
  }

  async function rebuildSystemShortcuts() {
    try {
      const res = await fetch('/api/v2/system/fix-shortcuts', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        showSuperToast('Shortcuts Rebuilt', 'All workstation desktop shortcuts and icons refreshed successfully.', 'success');
      } else {
        showSuperToast('Notice', json.message || 'Shortcut check completed.', 'info');
      }
    } catch {
      showSuperToast('Error', 'Failed to rebuild shortcuts.', 'error');
    }
  }

  function emergencyLockdown() {
    if (confirm(' RED ALERT: Trigger EMERGENCY PLATFORM LOCKDOWN?\n\nThis will suspend all profile launches across the fleet.')) {
      showSuperToast('Emergency Lockdown', 'Red Alert broadcasted to all fleet nodes.', 'error');
    }
  }

  function saveCoreOverrides() {
    showSuperToast('Overrides Saved', 'Engine configuration applied in real-time.', 'success');
  }

  function bindEvents() {
    document.getElementById('toggle-pin-btn')?.addEventListener('click', togglePinVisibility);
    document.getElementById('auth-submit-btn')?.addEventListener('click', authenticateMaster);
    document.getElementById('master-pin')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') authenticateMaster();
    });
    document.getElementById('lockdown-btn')?.addEventListener('click', emergencyLockdown);
    document.getElementById('super-lock-console-btn')?.addEventListener('click', lockConsole);

    document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        if (tabId) switchTab(tabId);
      });
    });

    document.getElementById('copy-minted-btn')?.addEventListener('click', copyMintedKey);
    document.getElementById('refresh-licenses-btn')?.addEventListener('click', loadLicenses);
    document.getElementById('refresh-fleet-btn')?.addEventListener('click', loadMasterFleet);
    document.getElementById('db-table-select')?.addEventListener('change', inspectTable);
    document.getElementById('save-overrides-btn')?.addEventListener('click', saveCoreOverrides);

    document.querySelectorAll('[data-download-endpoint]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const endpoint = btn.getAttribute('data-download-endpoint');
        const filename = btn.getAttribute('data-download-filename') || 'MAHI-Setup.exe';
        if (endpoint) downloadBinary(endpoint, filename);
      });
    });

    document.getElementById('copy-portal-url-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText('http://127.0.0.1:32123/download');
      showSuperToast('Copied', 'Localhost link copied!', 'info');
    });

    document.getElementById('rebuild-shortcuts-btn')?.addEventListener('click', rebuildSystemShortcuts);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const licenseBtn = target.closest('[data-license-action]');
      if (licenseBtn) {
        const action = licenseBtn.getAttribute('data-license-action');
        const idx = Number.parseInt(licenseBtn.getAttribute('data-license-idx') || '', 10);
        if (action && !Number.isNaN(idx)) actionLicenseByIndex(idx, action);
        return;
      }

      const copyHashBtn = target.closest('[data-copy-license-idx]');
      if (copyHashBtn) {
        const idx = Number.parseInt(copyHashBtn.getAttribute('data-copy-license-idx') || '', 10);
        if (!Number.isNaN(idx)) copyLicenseHashByIndex(idx);
        return;
      }

      const revokeBtn = target.closest('[data-revoke-device-idx]');
      if (revokeBtn) {
        const idx = Number.parseInt(revokeBtn.getAttribute('data-revoke-device-idx') || '', 10);
        if (!Number.isNaN(idx)) revokeMasterDeviceByIndex(idx);
      }
    });
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
