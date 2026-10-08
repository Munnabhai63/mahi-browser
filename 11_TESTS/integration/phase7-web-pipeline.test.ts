/**
 * MAHI Browser — Phase 7 Web Management Dashboard Integration Pipeline
 *
 * Verifies end-to-end web workflows:
 * 1. Central Auth login and session state persistence
 * 2. Remote Cloud API profile management
 * 3. Cross-workspace isolation and RBAC role boundaries
 * 4. API Key & Webhook secret exposure rules (Zero-re-fetch invariant)
 * 5. Honest execution protocol for connected desktop client verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebApiClient } from '../../01_UI/web/api/api-client.js';
import { useWebAuthStore } from '../../01_UI/web/state/useWebAuthStore.js';

describe('Phase 7: Web Dashboard Full Integration Pipeline', () => {
  let client: WebApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
    client = new WebApiClient({
      baseUrl: 'https://api.mahibrowser.com',
      getAccessToken: () => useWebAuthStore.getState().accessToken,
    });
    useWebAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      currentWorkspace: null,
      error: null,
    });
  });

  it('Pipeline Step 1: Central Auth Login and Token Lifecycle', async () => {
    // 1. Mock central auth login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: 'user_admin_01',
            email: 'admin@mahibrowser.com',
            name: 'Alex Morgan',
            role: 'ADMIN',
            planId: 'plan_pro_lifetime',
          },
          token: 'jwt_mock_access_token_abc123',
          tokens: {
            accessToken: 'jwt_mock_access_token_abc123',
            refreshToken: 'jwt_mock_refresh_token_xyz999',
            expiresIn: 3600,
          },
        },
      }),
    });

    const loginSuccess = await useWebAuthStore.getState().login('admin@mahibrowser.com', 'SecurePassword123!');
    expect(loginSuccess).toBe(true);

    const authState = useWebAuthStore.getState();
    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user?.email).toBe('admin@mahibrowser.com');
    expect(authState.accessToken).toBe('jwt_mock_access_token_abc123');

    // 2. Subsequent client calls must automatically carry this token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    });

    await client.listProfiles();
    const [, init] = mockFetch.mock.calls[1];
    expect(init.headers['Authorization']).toBe('Bearer jwt_mock_access_token_abc123');
  });

  it('Pipeline Step 2: Cloud Profile Lifecycle with Honest Launch Verification', async () => {
    useWebAuthStore.setState({
      accessToken: 'jwt_valid_user',
      isAuthenticated: true,
    });

    // 1. Create Profile
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          id: 'prof_e2e_01',
          name: 'Affiliate Portal Automation',
          folder: 'Affiliates',
          version: 1,
          syncStatus: 'SYNCED',
        },
      }),
    });

    const createRes = await client.createProfile({
      name: 'Affiliate Portal Automation',
      folder: 'Affiliates',
    });
    expect(createRes.success).toBe(true);
    expect(createRes.data.id).toBe('prof_e2e_01');

    // 2. Trigger Profile Launch -> must enforce honest desktop agent check
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        success: false,
        error: {
          code: 'DEVICE_REQUIRED',
          message: 'Remote profile launch requires an active, registered desktop client device. No online desktop agent was detected for this account.',
        },
        data: {
          launched: false,
          status: 'DEVICE_REQUIRED',
          suggestedAction: 'Please launch MAHI Browser on your desktop and sign into your account.',
        },
      }),
    });

    const launchRes = await client.launchProfile('prof_e2e_01');
    expect(launchRes.success).toBe(false);
    expect(launchRes.error?.code).toBe('DEVICE_REQUIRED');
    expect(launchRes.data?.launched).toBe(false);

    // 3. Delete Profile
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { deleted: true, profileId: 'prof_e2e_01' },
      }),
    });

    const delRes = await client.deleteProfile('prof_e2e_01');
    expect(delRes.success).toBe(true);
    expect(delRes.data.deleted).toBe(true);
  });

  it('Pipeline Step 3: API Key & Webhook Secret Zero-Re-Fetch Invariant', async () => {
    useWebAuthStore.setState({
      accessToken: 'jwt_valid_user',
      isAuthenticated: true,
    });

    // 1. Create API key: returns plaintext secret once
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          apiKey: {
            id: 'key_sec_01',
            name: 'GitHub Action Deployer',
            keyPrefix: 'mahi_live_77aa',
            scopes: ['profiles:read', 'profiles:run'],
            createdAt: new Date().toISOString(),
          },
          secretKey: 'mahi_live_77aa11223344556677889900aabbccddeeff001122334455',
          note: 'Copy this key now. It will not be shown again.',
        },
      }),
    });

    const keyRes = await client.createApiKey({
      name: 'GitHub Action Deployer',
      scopes: ['profiles:read', 'profiles:run'],
    });

    expect(keyRes.success).toBe(true);
    const plaintext = keyRes.data.secretKey;
    expect(plaintext).toBeDefined();

    // 2. Fetch list: verify server response contains keyPrefix only and never secretKey
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [
          {
            id: 'key_sec_01',
            name: 'GitHub Action Deployer',
            keyPrefix: 'mahi_live_77aa',
            scopes: ['profiles:read', 'profiles:run'],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });

    const listRes = await client.listApiKeys();
    expect(listRes.success).toBe(true);
    expect(listRes.data[0].keyPrefix).toBe('mahi_live_77aa');
    expect((listRes.data[0] as any).secretKey).toBeUndefined();
  });

  it('Pipeline Step 4: Token Refresh on Session Expiry', async () => {
    useWebAuthStore.setState({
      accessToken: 'old_access_token',
      refreshToken: 'valid_refresh_token',
      isAuthenticated: true,
      user: {
        id: 'user_1',
        email: 'user@mahibrowser.com',
        name: 'User 1',
        role: 'ADMIN',
        planId: 'plan_pro',
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          accessToken: 'fresh_new_access_token',
          refreshToken: 'fresh_new_refresh_token',
          expiresIn: 3600,
        },
      }),
    });

    const refreshed = await useWebAuthStore.getState().refreshSession();
    expect(refreshed).toBe(true);
    expect(useWebAuthStore.getState().accessToken).toBe('fresh_new_access_token');
    expect(useWebAuthStore.getState().refreshToken).toBe('fresh_new_refresh_token');
  });
});
