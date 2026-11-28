(() => {
  let cachedPlans = [];
  let initialized = false;
  const searchDebounceTimers = {};
  const selectedUsers = {};
  const searchUserCache = {};

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAdminSecret() {
    const secretInput = document.getElementById('owner-admin-secret');
    let val = secretInput ? secretInput.value.trim() : '';
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
        if (secretInput && !secretInput.value) secretInput.value = val;
        return val;
      }
    } catch {
      void 0; /* browser storage blocked */
    }
    return '';
  }

  async function ownerFetch(url, options = {}) {
    const adminSecret = getAdminSecret();
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret,
      ...(options.headers || {}),
    };
    try {
      const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
      if (res.status === 204) return { success: true, status: 204 };
      return await res.json();
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function submitVerifyTotp() {
    const codeInput = document.getElementById('totp-input');
    const errorDiv = document.getElementById('auth-error-msg');
    const verifyBtn = document.getElementById('verify-btn');
    const code = codeInput ? codeInput.value.trim() : '';

    if (errorDiv) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    }

    if (!/^\d{6}$/.test(code)) {
      if (errorDiv) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = 'Please enter a valid 6-digit verification code.';
      }
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
    }

    const res = await ownerFetch('/api/v1/admin/owner/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });

    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Security Code';
    }

    if (res.success) {
      document.getElementById('totp-auth-panel')?.classList.add('hidden');
      document.getElementById('owner-console-panel')?.classList.remove('hidden');
      document.getElementById('lock-console-btn')?.classList.remove('hidden');
      await initOwnerConsole();
    } else if (errorDiv) {
      errorDiv.classList.remove('hidden');
      errorDiv.textContent = res.error || 'Verification failed. Invalid or expired code.';
    }
  }

  async function lockConsole() {
    await ownerFetch('/api/v1/admin/owner/logout', { method: 'POST' });
    window.location.href = '/admin';
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
      { id: 'plan_custom', name: 'Custom Dedicated', tier: 'CUSTOM' },
    ];

    cachedPlans = res.success && Array.isArray(res.data) && res.data.length > 0 ? res.data : defaultPlans;

    const grantSelect = document.getElementById('grant-plan-id');
    const setplanSelect = document.getElementById('setplan-plan-id');
    const optionsHtml = cachedPlans
      .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.tier || p.id)})</option>`)
      .join('');
    if (grantSelect) grantSelect.innerHTML = optionsHtml;
    if (setplanSelect) setplanSelect.innerHTML = optionsHtml;
  }

  async function initOwnerConsole() {
    await loadPricingCatalog();
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'grant' && urlParams.get('userId')) {
        const uId = urlParams.get('userId') || '';
        const uName = urlParams.get('name') || '';
        const uEmail = urlParams.get('email') || '';
        selectUser('grant', uId, uName, uEmail, 'ACTIVE');
      }
    } catch {
      void 0; /* ignore malformed query params in owner console URL */
    }
  }

  function toggleCustomDate(prefix, val) {
    const el = document.getElementById(`${prefix}-custom-date`);
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
    const resultsDiv = document.getElementById(`${context}-search-results`);
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

      const res = await ownerFetch(`/api/v1/admin/users?search=${encodeURIComponent(q)}&limit=10`);
      if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
        resultsDiv.innerHTML = '<div class="p-3 text-slate-400 text-xs">No matching users found.</div>';
        return;
      }

      searchUserCache[context] = res.data;
      resultsDiv.innerHTML = res.data
        .map((u, idx) => {
          const displayEmail = escapeHtml(u.email || 'N/A');
          const escapedName = escapeHtml(u.name || u.email || 'User');
          const escapedId = escapeHtml(u.id || '');
          return `<div data-select-context="${escapeHtml(context)}" data-select-index="${idx}"
            class="p-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/60 last:border-0 text-xs transition">
            <div class="font-bold text-white">${escapedName}</div>
            <div class="text-[11px] text-slate-300 font-mono">${displayEmail} <span class="text-slate-500">(${escapedId})</span></div>
          </div>`;
        })
        .join('');
    }, 250);
  }

  function selectUserByIndex(context, idx) {
    const list = searchUserCache[context] || [];
    const u = list[idx];
    if (!u) return;
    selectUser(context, u.id || '', u.name || u.email || 'User', u.email || '', u.status || 'ACTIVE');
  }

  function selectUser(context, id, name, email, status) {
    const cleanId = (id || '').startsWith('central:') ? id.replace('central:', '') : id;
    selectedUsers[context] = { id: cleanId, name, email, status };
    const searchInput = document.getElementById(`${context}-user-search`);
    const resultsDiv = document.getElementById(`${context}-search-results`);
    const badge = document.getElementById(`${context}-selected-badge`);
    const badgeText = document.getElementById(`${context}-selected-text`);
    const hiddenId = document.getElementById(`${context}-user-id`);
    const hiddenEmail = document.getElementById(`${context}-user-email`);

    if (searchInput) searchInput.classList.add('hidden');
    if (resultsDiv) resultsDiv.classList.add('hidden');
    if (badge) badge.classList.remove('hidden');
    if (badgeText) badgeText.textContent = `${name} (${email || cleanId}) [Status: ${status}]`;
    if (hiddenId) hiddenId.value = cleanId;
    if (hiddenEmail) hiddenEmail.value = email;
  }

  function clearSelectedUser(context) {
    delete selectedUsers[context];
    const searchInput = document.getElementById(`${context}-user-search`);
    const resultsDiv = document.getElementById(`${context}-search-results`);
    const badge = document.getElementById(`${context}-selected-badge`);
    const hiddenId = document.getElementById(`${context}-user-id`);
    const hiddenEmail = document.getElementById(`${context}-user-email`);

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
    if (!msg) return;
    msg.className = 'text-xs p-3 rounded-xl hidden';
    const userId = document.getElementById('grant-user-id')?.value;
    if (!userId) {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = 'Please search and select a target user.';
      return;
    }

    const planId = document.getElementById('grant-plan-id')?.value;
    const durationType = document.getElementById('grant-duration')?.value || '30_DAYS';
    const customExpiresAt = durationType === 'CUSTOM' ? document.getElementById('grant-custom-date')?.value : undefined;
    const reason = document.getElementById('grant-reason')?.value?.trim();

    const res = await ownerFetch('/api/v1/admin/owner/grant', {
      method: 'POST',
      body: JSON.stringify({ userId, planId, durationType, customExpiresAt, reason }),
    });

    if (res.success) {
      msg.className =
        'text-xs p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1 block';
      msg.innerHTML =
        '<div class="font-bold flex items-center space-x-1.5"><span class="text-base">✓</span> <span>Account Upgraded to PRO Successfully!</span></div><div class="text-[11px] text-emerald-400">100 Profiles unlocked. The user\'s Mahi Browser will automatically reflect PRO status. No manual key needed.</div>';
    } else {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = res.error || 'Failed to grant license';
    }
  }

  async function executeRemove() {
    const msg = document.getElementById('remove-status-msg');
    if (!msg) return;
    msg.className = 'text-xs p-3 rounded-xl hidden';
    const userId = document.getElementById('remove-user-id')?.value;
    if (!userId) {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = 'Please search and select a target user.';
      return;
    }

    const licenseId = document.getElementById('remove-license-id')?.value?.trim();
    const reason = document.getElementById('remove-reason')?.value?.trim();

    const res = await ownerFetch('/api/v1/admin/owner/remove', {
      method: 'POST',
      body: JSON.stringify({ userId, licenseId: licenseId || undefined, reason }),
    });

    if (res.success) {
      msg.className = 'text-xs p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
      msg.textContent = `Revoked ${res.revokedCount} license(s). User plan reset to plan_free.`;
    } else {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = res.error || 'Failed to remove premium';
    }
  }

  async function executeSetPlan() {
    const msg = document.getElementById('setplan-status-msg');
    if (!msg) return;
    msg.className = 'text-xs p-3 rounded-xl hidden';
    const userId = document.getElementById('setplan-user-id')?.value;
    if (!userId) {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = 'Please search and select a target user.';
      return;
    }

    const planId = document.getElementById('setplan-plan-id')?.value;
    const reason = document.getElementById('setplan-reason')?.value?.trim();

    const res = await ownerFetch('/api/v1/admin/owner/set-plan', {
      method: 'POST',
      body: JSON.stringify({ userId, planId, reason }),
    });

    if (res.success) {
      msg.className = 'text-xs p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
      msg.textContent = `Plan successfully changed from ${res.from} to ${res.to}.`;
    } else {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = res.error || 'Failed to update plan';
    }
  }

  async function executeEnforce() {
    const msg = document.getElementById('enforce-status-msg');
    if (!msg) return;
    msg.className = 'text-xs p-3 rounded-xl hidden';
    const userId = document.getElementById('enforce-user-id')?.value;
    const selected = selectedUsers.enforce;
    if (!userId || !selected) {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = 'Please search and select a target user.';
      return;
    }

    const action = document.getElementById('enforce-action')?.value || 'suspend';
    const reason = document.getElementById('enforce-reason')?.value?.trim();

    if (action === 'suspend' || action === 'ban') {
      const confirmInput = document.getElementById('enforce-confirm-input')?.value?.trim() || '';
      const targetEmail = (selected.email || '').trim().toLowerCase();
      if (confirmInput.toLowerCase() !== targetEmail) {
        msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
        msg.textContent = `Confirmation mismatch! Type user's exact email ("${selected.email}") to confirm.`;
        return;
      }
    }

    const res = await ownerFetch(`/api/v1/admin/owner/${action}`, {
      method: 'POST',
      body: JSON.stringify({ userId, reason }),
    });

    if (res.success) {
      msg.className = 'text-xs p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
      msg.textContent = `Action "${action.toUpperCase()}" applied successfully. User status: ${res.status}.`;
      selected.status = res.status;
      const badgeText = document.getElementById('enforce-selected-text');
      if (badgeText) {
        badgeText.textContent = `${selected.name} (${selected.email || selected.id}) [Status: ${res.status}]`;
      }
    } else {
      msg.className = 'text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300';
      msg.textContent = res.error || 'Failed to apply enforcement action';
    }
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
    if (input?.value) {
      navigator.clipboard.writeText(input.value);
      if (btn) btn.innerHTML = '<span>✓</span><span>Copied to Clipboard!</span>';
      setTimeout(() => {
        if (btn) btn.innerHTML = '<span>📋</span><span>Copy License Key</span>';
      }, 2000);
    }
  }

  function bindEvents() {
    document.getElementById('lock-console-btn')?.addEventListener('click', lockConsole);
    document.getElementById('verify-btn')?.addEventListener('click', submitVerifyTotp);
    document.getElementById('totp-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submitVerifyTotp();
    });

    document.querySelectorAll('[data-search-context]').forEach((inputEl) => {
      inputEl.addEventListener('input', () => {
        const context = inputEl.getAttribute('data-search-context');
        if (context) searchUsers(context, inputEl.value);
      });
    });

    document.querySelectorAll('[data-clear-context]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const context = btn.getAttribute('data-clear-context');
        if (context) clearSelectedUser(context);
      });
    });

    document.getElementById('grant-duration')?.addEventListener('change', (event) => {
      const target = event.currentTarget;
      toggleCustomDate('grant', target.value);
    });

    document.getElementById('enforce-action')?.addEventListener('change', (event) => {
      const target = event.currentTarget;
      toggleEnforceConfirm(target.value);
    });

    document.getElementById('grant-execute-btn')?.addEventListener('click', executeGrant);
    document.getElementById('remove-execute-btn')?.addEventListener('click', executeRemove);
    document.getElementById('setplan-execute-btn')?.addEventListener('click', executeSetPlan);
    document.getElementById('enforce-execute-btn')?.addEventListener('click', executeEnforce);
    document.getElementById('modal-copy-btn')?.addEventListener('click', copyModalKey);
    document.getElementById('modal-done-btn')?.addEventListener('click', closeKeyModal);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const optionEl = target.closest('[data-select-context]');
      if (!optionEl) return;
      const context = optionEl.getAttribute('data-select-context');
      const rawIdx = optionEl.getAttribute('data-select-index');
      if (!context || rawIdx === null) return;
      const idx = Number.parseInt(rawIdx, 10);
      if (!Number.isNaN(idx)) selectUserByIndex(context, idx);
    });
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    getAdminSecret();
    initOwnerConsole();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
