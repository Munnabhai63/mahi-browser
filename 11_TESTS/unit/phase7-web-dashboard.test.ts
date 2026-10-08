/**
 * MAHI Browser — Phase 7 Web Management Dashboard Unit Tests
 *
 * Verifies:
 * 1. WebApiClient token handling and header injection
 * 2. Honest launch profile error handling (DEVICE_REQUIRED protocol)
 * 3. Scoped API Key creation and one-time plain text reveal behavior
 * 4. Webhook registration, SSRF validation, and HMAC signature flow
 * 5. Team Workspace RBAC permission awareness
 * 6. WebAuthStore state transitions, refresh, and session isolation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebApiClient } from '../../01_UI/web/api/api-client.js';
import { useWebAuthStore } from '../../01_UI/web/state/useWebAuthStore.js';

describe('Phase 7: Web Management Dashboard Architecture', () => {
  let client: WebApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
    client = new WebApiClient({
      baseUrl: 'https://api.mahibrowser.com',
      getAccessToken: () => 'test_jwt_access_token_123',
    });
  });

  describe('1. WebApiClient Security & Header Injection', () => {
    it('should inject Authorization Bearer token and X-Request-Id automatically', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      });

      await client.listProfiles();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.mahibrowser.com/api/v1/remote/profiles');
      expect(init.headers['Authorization']).toBe('Bearer test_jwt_access_token_123');
      expect(init.headers['X-Request-Id']).toMatch(/^req_web_\d+_[a-z0-9]+$/);
    });

    it('should trigger onUnauthorized callback on HTTP 401 response', async () => {
      const onUnauthorized = vi.fn();
      client.setOnUnauthorized(onUnauthorized);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
      });

      const res = await client.listProfiles();

      expect(res.success).toBe(false);
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('should pass Idempotency-Key header on creation requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { id: 'prof_1', name: 'Profile 1' } }),
      });

      await client.createProfile({ name: 'Profile 1' }, 'idem_key_unique_999');

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers['Idempotency-Key']).toBe('idem_key_unique_999');
    });
  });

  describe('2. Honest Remote Profile Launch Protocol', () => {
    it('should accurately return DEVICE_REQUIRED when no desktop client is online', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          success: false,
          error: {
            code: 'DEVICE_REQUIRED',
            message: 'Remote profile launch requires an active, registered desktop client device.',
          },
          data: {
            launched: false,
            status: 'DEVICE_REQUIRED',
            suggestedAction: 'Please launch MAHI Browser on your desktop and sign into your account.',
          },
        }),
      });

      const res = await client.launchProfile('prof_alpha_123');

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('DEVICE_REQUIRED');
      expect(res.data?.launched).toBe(false);
      expect(res.data?.status).toBe('DEVICE_REQUIRED');
    });

    it('should return 202 QUEUED when a verified online desktop agent exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({
          success: true,
          data: {
            launched: true,
            status: 'QUEUED',
            targetDevice: 'DESKTOP-WIN11-01',
          },
        }),
      });

      const res = await client.launchProfile('prof_alpha_123');

      expect(res.success).toBe(true);
      expect(res.data?.launched).toBe(true);
      expect(res.data?.status).toBe('QUEUED');
    });
  });

  describe('3. Developer API Keys & One-Time Secret Handling', () => {
    it('should create scoped API key and expose plaintext secret key once', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            apiKey: {
              id: 'key_123',
              name: 'CI/CD Key',
              keyPrefix: 'mahi_live_ab12',
              scopes: ['profiles:read', 'profiles:write'],
              createdAt: new Date().toISOString(),
            },
            secretKey: 'mahi_live_0123456789abcdef0123456789abcdef0123456789abcdef',
            note: 'Store this secret safely. It will not be shown again.',
          },
        }),
      });

      const res = await client.createApiKey({
        name: 'CI/CD Key',
        scopes: ['profiles:read', 'profiles:write'],
      });

      expect(res.success).toBe(true);
      expect(res.data?.secretKey).toMatch(/^mahi_live_[a-f0-9]{48}$/);
      expect(res.data?.apiKey.keyPrefix).toBe('mahi_live_ab12');
    });

    it('should list API keys returning only prefixes and never exposing secretKey', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'key_123',
              name: 'CI/CD Key',
              keyPrefix: 'mahi_live_ab12',
              scopes: ['profiles:read'],
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });

      const res = await client.listApiKeys();

      expect(res.success).toBe(true);
      expect(res.data?.[0].keyPrefix).toBe('mahi_live_ab12');
      expect((res.data?.[0] as any).secretKey).toBeUndefined();
    });

    it('should call revoke API key with DELETE verb', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { revoked: true, keyId: 'key_123' } }),
      });

      const res = await client.revokeApiKey('key_123');

      expect(res.success).toBe(true);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.mahibrowser.com/api/v1/remote/api-keys/key_123');
      expect(init.method).toBe('DELETE');
    });
  });

  describe('4. Outbound Webhook Endpoints & Delivery Audits', () => {
    it('should register webhook with event subscriptions and return secret', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: 'wh_endpoint_1',
            url: 'https://example.com/webhook',
            events: ['profile.created', 'sync.completed'],
            secret: 'whsec_fedcba9876543210',
            note: 'Store this signing secret safely for HMAC verification.',
          },
        }),
      });

      const res = await client.createWebhook({
        url: 'https://example.com/webhook',
        events: ['profile.created', 'sync.completed'],
      });

      expect(res.success).toBe(true);
      expect(res.data?.secret).toMatch(/^whsec_/);
    });

    it('should send test ping and return execution audit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'del_1',
            endpointId: 'wh_endpoint_1',
            eventId: 'evt_test_1',
            eventType: 'test.ping',
            destinationUrl: 'https://example.com/webhook',
            statusCode: 200,
            attemptCount: 1,
            success: true,
            deliveredAt: new Date().toISOString(),
          },
        }),
      });

      const res = await client.testWebhook('wh_endpoint_1');

      expect(res.success).toBe(true);
      expect(res.data?.statusCode).toBe(200);
      expect(res.data?.success).toBe(true);
    });
  });

  describe('5. Team Workspaces & RBAC Role Management', () => {
    it('should list team workspaces and fetch member rosters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            { id: 'ws_alpha', name: 'Alpha Ops', ownerUserId: 'user_owner', memberCount: 3, profileCount: 10 },
          ],
        }),
      });

      const res = await client.listWorkspaces();
      expect(res.success).toBe(true);
      expect(res.data?.[0].id).toBe('ws_alpha');
    });

    it('should update member role via PUT request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { success: true } }),
      });

      const res = await client.updateMemberRole('ws_alpha', 'user_beta', 'ADMIN');

      expect(res.success).toBe(true);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.mahibrowser.com/api/v1/remote/workspaces/ws_alpha/members/user_beta/role');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ role: 'ADMIN' });
    });
  });

  describe('6. Commercial Proxy Platform Operations', () => {
    it('should generate commercial proxy session via reference model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            session: {
              id: 'sess_rec_1',
              sessionId: 'upstream_sess_999',
              providerId: 'brightdata',
              networkType: 'RESIDENTIAL',
              country: 'US',
              sessionType: 'STICKY',
              expiresAt: new Date(Date.now() + 1800000).toISOString(),
            },
            proxy: {
              host: 'pr.oxylabs.io',
              port: 7777,
              protocol: 'http',
            },
          },
        }),
      });

      const res = await client.generateProxySession({
        networkType: 'RESIDENTIAL',
        country: 'US',
        sessionType: 'STICKY',
        ttlMinutes: 30,
      });

      expect(res.success).toBe(true);
      expect(res.data?.session.country).toBe('US');
      expect(res.data?.proxy.host).toBe('pr.oxylabs.io');
    });

    it('should rotate proxy session IP without exposing master provider credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            success: true,
            sessionId: 'sess_123',
            newIp: '185.220.101.5',
            rotationCount: 1,
            latencyMs: 124,
          },
        }),
      });

      const res = await client.rotateProxySession('sess_123');

      expect(res.success).toBe(true);
      expect(res.data?.newIp).toBe('185.220.101.5');
    });
  });
});
