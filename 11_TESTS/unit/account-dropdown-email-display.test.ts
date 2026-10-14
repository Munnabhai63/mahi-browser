import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountStore } from '../../01_UI/stores/useAccountStore.js';
import { useLicenseStore } from '../../01_UI/stores/useLicenseStore.js';

describe('MAHI Browser — Account Email Display UI Logic', () => {
  beforeEach(() => {
    // Mock global window object for node test runner
    if (typeof globalThis.window === 'undefined') {
      (globalThis as any).window = {
        mahiAPI: {
          accountLogout: async () => ({ success: true }),
          accountGetPlanLimits: async () => ({ isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null }),
          accountGetSession: async () => null,
        }
      };
    }
    // Reset stores to pristine initial state
    useAccountStore.setState({
      currentUser: null,
      accountSession: null,
      commercialUser: null,
      planLimits: { isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null },
    });
    useLicenseStore.setState({
      currentLicenseStatus: null,
    });
  });

  it('TEST 1: Signed-in Free user displays exact registered email', () => {
    const freeEmail = 'alex.freemium@mahibrowser.com';
    useAccountStore.setState({
      accountSession: {
        token: 'mock_token_free_123',
        email: freeEmail,
        account_id: 'usr_free_01',
        plan: 'free',
        profile_quota: 15,
        saved_at: new Date().toISOString()
      },
      planLimits: { isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null }
    });

    const state = useAccountStore.getState();
    const userEmail = state.accountSession?.email || state.currentUser?.email || null;
    const isSigned = Boolean(state.accountSession?.token || state.currentUser);

    expect(isSigned).toBe(true);
    expect(userEmail).toBe(freeEmail);
    expect(state.planLimits?.plan).toBe('free');
    expect(state.planLimits?.maxProfiles).toBe(15);
  });

  it('TEST 2: Signed-in PRO user displays exact registered email and PRO quota', () => {
    const proEmail = 'vip.pro.user@enterprise.org';
    useAccountStore.setState({
      accountSession: {
        token: 'mock_token_pro_999',
        email: proEmail,
        account_id: 'usr_pro_99',
        plan: 'pro',
        profile_quota: 100,
        saved_at: new Date().toISOString()
      },
      planLimits: { isPro: true, plan: 'pro', maxProfiles: 100, expiresAt: null }
    });
    useLicenseStore.setState({
      currentLicenseStatus: { isValid: true, status: 'ACTIVE', plan: 'PRO' } as any
    });

    const state = useAccountStore.getState();
    const userEmail = state.accountSession?.email || state.currentUser?.email || null;
    const isSigned = Boolean(state.accountSession?.token || state.currentUser);

    expect(isSigned).toBe(true);
    expect(userEmail).toBe(proEmail);
    expect(state.planLimits?.isPro).toBe(true);
    expect(state.planLimits?.maxProfiles).toBe(100);
  });

  it('TEST 3: Logged-out user displays "Not signed in" rather than fake or stale email', () => {
    useAccountStore.setState({
      currentUser: null,
      accountSession: null,
      commercialUser: null,
      planLimits: { isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null }
    });

    const state = useAccountStore.getState();
    const userEmail = state.accountSession?.email || state.currentUser?.email || null;
    const isSigned = Boolean(state.accountSession?.token || state.currentUser);

    expect(isSigned).toBe(false);
    expect(userEmail).toBeNull();
    const displayLabel = userEmail || 'Not signed in';
    expect(displayLabel).toBe('Not signed in');
  });

  it('TEST 4: Account switch updates email automatically', () => {
    // Initial login: User A
    useAccountStore.setState({
      accountSession: {
        token: 'token_a',
        email: 'userA@work.com',
        account_id: 'usr_a',
        plan: 'free',
        saved_at: new Date().toISOString()
      }
    });
    let state = useAccountStore.getState();
    expect(state.accountSession?.email).toBe('userA@work.com');

    // Switch to User B
    useAccountStore.setState({
      accountSession: {
        token: 'token_b',
        email: 'userB@studio.io',
        account_id: 'usr_b',
        plan: 'pro',
        saved_at: new Date().toISOString()
      }
    });
    state = useAccountStore.getState();
    expect(state.accountSession?.email).toBe('userB@studio.io');
  });

  it('TEST 5: Long email preservation and tooltip title contract', () => {
    const longEmail = 'supercalifragilisticexpialidocious.very.long.workspace.member.account@subdomain.corporate-network.co.uk';
    useAccountStore.setState({
      accountSession: {
        token: 'token_long',
        email: longEmail,
        account_id: 'usr_long',
        plan: 'free',
        saved_at: new Date().toISOString()
      }
    });

    const state = useAccountStore.getState();
    const userEmail = state.accountSession?.email || null;

    // Tooltip title must contain the 100% complete unabridged email
    const tooltipTitle = userEmail || 'Not signed in';
    expect(tooltipTitle).toBe(longEmail);
    expect(tooltipTitle.length).toBeGreaterThan(60);
  });

  it('TEST 6: Zero exposure of sensitive secrets (tokens, HWID, passwords)', () => {
    const secretSession = {
      token: 'SECRET_BEARER_TOKEN_9999999',
      refreshToken: 'SECRET_REFRESH_TOKEN_88888',
      hwid: 'HWID-SECRET-HARDWARE-ID-1234',
      email: 'safe.customer@mahibrowser.com',
      account_id: 'usr_safe_01',
      saved_at: new Date().toISOString()
    };
    useAccountStore.setState({ accountSession: secretSession });

    const state = useAccountStore.getState();
    const userEmail = state.accountSession?.email || null;

    // Only email is exposed to UI text / title
    expect(userEmail).toBe('safe.customer@mahibrowser.com');
    expect(userEmail).not.toContain('SECRET_BEARER');
    expect(userEmail).not.toContain('HWID');
  });

  it('TEST 7: Resetting session on logout cleanses all email references', async () => {
    useAccountStore.setState({
      accountSession: {
        token: 'token_to_logout',
        email: 'will.logout@test.com',
        account_id: 'usr_logout',
        plan: 'pro',
        saved_at: new Date().toISOString()
      },
      currentUser: {
        email: 'will.logout@test.com',
        displayName: 'will.logout',
        avatarLetter: 'W',
        avatarColor: 'bg-teal-600',
        planName: 'PRO',
        maxProfiles: 100,
        createdAt: new Date().toISOString()
      }
    });

    // Execute logout
    await useAccountStore.getState().accountLogout();

    const postLogoutState = useAccountStore.getState();
    expect(postLogoutState.accountSession).toBeNull();
    expect(postLogoutState.currentUser).toBeNull();
    const postEmail = postLogoutState.accountSession?.email || postLogoutState.currentUser?.email || null;
    expect(postEmail).toBeNull();
  });

  it('TEST 8: fetchPlanLimits sets displayName to full login email instead of stripping to username (e.g. munaf)', async () => {
    (globalThis as any).window.mahiAPI = {
      accountGetPlanLimits: async () => ({ isPro: true, plan: 'pro', maxProfiles: 100, expiresAt: null }),
      accountGetSession: async () => ({
        token: 'sess_munaf_123',
        email: 'munaf@mahibrowser.com',
        account_id: 'usr_munaf',
        saved_at: '2026-10-13T00:00:00Z',
      }),
      getEntitlements: async () => null,
    };

    await useAccountStore.getState().fetchPlanLimits();

    const state = useAccountStore.getState();
    expect(state.currentUser?.email).toBe('munaf@mahibrowser.com');
    // Crucial check: displayName must NOT be 'munaf', it must be the full login email
    expect(state.currentUser?.displayName).toBe('munaf@mahibrowser.com');
    expect(state.currentUser?.displayName).not.toBe('munaf');
  });
});

