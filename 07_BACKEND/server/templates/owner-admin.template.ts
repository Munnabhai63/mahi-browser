import { ADMIN_STYLESHEET } from '../admin-css.js';

export function getOwnerAdminTemplateHtml(): string {
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
        msg.className = 'text-xs p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1 block';
        msg.innerHTML = '<div class="font-bold flex items-center space-x-1.5"><span class="text-base">✓</span> <span>Account Upgraded to PRO Successfully!</span></div><div class="text-[11px] text-emerald-400">100 Profiles unlocked. The user\'s Mahi Browser will automatically reflect PRO status. No manual key needed.</div>';
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
