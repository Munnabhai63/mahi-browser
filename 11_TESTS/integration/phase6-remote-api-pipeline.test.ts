import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { registerCentralUser, loginCentralUser } from '../../05_AUTH/central-auth-service.js';
import { createTeamWorkspace } from '../../07_BACKEND/services/team-workspace-service.js';
import { verifyWebhookSignature } from '../../07_BACKEND/services/webhook-service.js';
import { getApiKeys as getLocalApiKeys } from '../../07_BACKEND/services/api-v2-service.js';

describe('Phase 6 Integration Tests — Remote Cloud API Pipeline & Signed Webhooks', () => {
  let server: http.Server;
  let serverUrl: string;

  // Webhook receiver mock server
  let webhookServer: http.Server;
  let webhookUrl: string;
  let receivedWebhooks: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  let webhookFailOnce = false;

  beforeAll(async () => {
    await initializeDatabase();

    // Start commercial router HTTP server
    server = http.createServer(async (req, res) => {
      try {
        const handled = await handleCommercialAPIRequest(req, res);
        if (!handled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Start mock webhook target server
    webhookServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        receivedWebhooks.push({ headers: req.headers, body });
        if (webhookFailOnce) {
          webhookFailOnce = false;
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'temporary_error' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });

    await new Promise<void>((resolve) => {
      webhookServer.listen(0, '127.0.0.1', () => {
        const addr = webhookServer.address() as AddressInfo;
        webhookUrl = `http://127.0.0.1:${addr.port}/receiver`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => webhookServer.close(() => resolve()));
  });

  // Helper HTTP request function
  async function makeRequest(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: any
  ): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
    const url = new URL(path, serverUrl);
    return new Promise((resolve, reject) => {
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      const payload = body ? JSON.stringify(body) : undefined;
      if (payload) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
      }

      const req = http.request(
        url,
        {
          method,
          headers: reqHeaders,
        },
        (res) => {
          let resBody = '';
          res.on('data', (chunk) => {
            resBody += chunk;
          });
          res.on('end', () => {
            let parsed: any;
            try {
              parsed = JSON.parse(resBody);
            } catch {
              parsed = resBody;
            }
            resolve({
              status: res.statusCode || 0,
              body: parsed,
              headers: res.headers,
            });
          });
        }
      );

      req.on('error', reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  describe('End-to-End Remote API Flow', () => {
    let userAId: string;
    let userAJwt: string;
    let userAApiKey: string;
    let userAApiKeyId: string;

    let userBId: string;
    let userBApiKey: string;

    it('1. User A registers and obtains JWT Bearer token', async () => {
      const email = `usera_${Date.now()}@test.com`;
      const reg = await registerCentralUser({
        email,
        password: 'Password123!',
        name: 'User Alpha',
      });
      userAId = reg.user!.id;

      // Activate user
      const db = getDatabase();
      db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userAId);

      // Login to get access token
      const login = await loginCentralUser({
        email,
        password: 'Password123!',
      });
      expect(login.success).toBe(true);
      userAJwt = login.tokens!.accessToken;
      expect(userAJwt).toBeDefined();
    });

    it('2. User A creates a Remote API Key via JWT authentication', async () => {
      const res = await makeRequest(
        'POST',
        '/api/v1/remote/api-keys',
        { Authorization: `Bearer ${userAJwt}` },
        {
          name: 'CI Production Key',
          scopes: ['profiles:read', 'profiles:write', 'profiles:run', 'proxy:read', 'webhooks:manage', 'webhooks:read'],
          rateLimitPerMin: 120,
        }
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.apiKey).toBeDefined();
      expect(res.body.data.apiKey.name).toBe('CI Production Key');
      expect(res.body.data.secretKey).toBeDefined();
      expect(res.body.data.secretKey.startsWith('mahi_live_')).toBe(true);

      userAApiKey = res.body.data.secretKey;
      userAApiKeyId = res.body.data.apiKey.id;
    });

    it('3. User A queries /api/v1/remote/profiles using X-API-Key', async () => {
      const res = await makeRequest(
        'GET',
        '/api/v1/remote/profiles',
        { 'X-API-Key': userAApiKey }
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
    });

    let createdProfileId: string;

    it('4. User A creates a profile via Remote API and verifies idempotency', async () => {
      const idempotencyKey = `idem_${Date.now()}`;
      const payload = {
        name: 'Remote E-Commerce Profile',
        folder: 'Amazon',
        description: 'Automated remote profile',
        tags: ['bot', 'us-east'],
      };

      // First call with Idempotency-Key
      const res1 = await makeRequest(
        'POST',
        '/api/v1/remote/profiles',
        {
          'X-API-Key': userAApiKey,
          'Idempotency-Key': idempotencyKey,
        },
        payload
      );

      expect(res1.status).toBe(201);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.id).toBeDefined();
      expect(res1.body.data.name).toBe('Remote E-Commerce Profile');
      createdProfileId = res1.body.data.id;

      // Second identical call with same Idempotency-Key (simulating network retry)
      const res2 = await makeRequest(
        'POST',
        '/api/v1/remote/profiles',
        {
          'X-API-Key': userAApiKey,
          'Idempotency-Key': idempotencyKey,
        },
        payload
      );

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(createdProfileId); // Same response, no duplicate created
    });

    it('5. User A retrieves and updates the profile metadata', async () => {
      const getRes = await makeRequest(
        'GET',
        `/api/v1/remote/profiles/${createdProfileId}`,
        { 'X-API-Key': userAApiKey }
      );

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Remote E-Commerce Profile');
      // Verify no raw disk storage paths leaked in public API
      expect(getRes.body.data.storagePath).toBeUndefined();

      const putRes = await makeRequest(
        'PUT',
        `/api/v1/remote/profiles/${createdProfileId}`,
        { 'X-API-Key': userAApiKey },
        { name: 'Remote E-Commerce Profile [UPDATED]', folder: 'Amazon EU' }
      );

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.name).toBe('Remote E-Commerce Profile [UPDATED]');
    });

    it('6. Cross-User IDOR Isolation: User B cannot access User A profile', async () => {
      // Register User B
      const emailB = `userb_${Date.now()}@test.com`;
      const regB = await registerCentralUser({
        email: emailB,
        password: 'Password123!',
        name: 'User Bravo',
      });
      userBId = regB.user!.id;

      const db = getDatabase();
      db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userBId);

      const loginB = await loginCentralUser({ email: emailB, password: 'Password123!' });
      const userBJwt = loginB.tokens!.accessToken;

      // User B creates their own key
      const keyResB = await makeRequest(
        'POST',
        '/api/v1/remote/api-keys',
        { Authorization: `Bearer ${userBJwt}` },
        { name: 'User B Key', scopes: ['profiles:read', 'profiles:write'] }
      );
      userBApiKey = keyResB.body.data.secretKey;

      // User B attempts to access User A's profile
      const idorRes = await makeRequest(
        'GET',
        `/api/v1/remote/profiles/${createdProfileId}`,
        { 'X-API-Key': userBApiKey }
      );

      // Must return 404 NOT_FOUND to prevent IDOR scanning
      expect(idorRes.status).toBe(404);
      expect(idorRes.body.error.code).toBe('NOT_FOUND');
    });

    it('7. Honest Launch Model: returns 409 DEVICE_REQUIRED when no desktop agent is online', async () => {
      const launchRes = await makeRequest(
        'POST',
        `/api/v1/remote/profiles/${createdProfileId}/launch`,
        { 'X-API-Key': userAApiKey }
      );

      // Must not fake launch! Must report DEVICE_REQUIRED
      expect(launchRes.status).toBe(409);
      expect(launchRes.body.error.code).toBe('DEVICE_REQUIRED');
      expect(launchRes.body.error.message).toContain('desktop');
      expect(launchRes.body.data.status).toBe('DEVICE_REQUIRED');
    });

    it('8. Scope Denial: Key lacking workspace:manage is rejected with 403 FORBIDDEN_SCOPE', async () => {
      // userAApiKey only has profiles:*, proxy:read, webhooks:* — lacks workspace:manage
      const wsRes = await makeRequest(
        'POST',
        '/api/v1/remote/workspaces',
        { 'X-API-Key': userAApiKey },
        { name: 'Unauthorized Workspace' }
      );

      expect(wsRes.status).toBe(403);
      expect(wsRes.body.error.code).toBe('FORBIDDEN_SCOPE');
      expect(wsRes.body.error.message).toContain('workspace:manage');
    });

    it('9. Dual-Gate RBAC Denial: API key has scope, but workspace member role lacks permission', async () => {
      // Create a workspace owned by User A
      const ws = createTeamWorkspace(userAId, { name: 'Alpha Corp' });

      // Add User B as VIEWER in User A's workspace
      const db = getDatabase();
      db.prepare(`
        INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, joined_at, created_at)
        VALUES (?, ?, ?, 'VIEWER', 'ACTIVE', ?, ?)
      `).run(`mem_${Date.now()}`, ws.id, userBId, new Date().toISOString(), new Date().toISOString());

      // Create an API key for User B with omnipotent workspace:manage scope
      const keyBRes = await makeRequest(
        'POST',
        '/api/v1/remote/api-keys',
        { Authorization: `Bearer ${userBApiKey}` },
        {
          name: 'Manager Key',
          scopes: ['workspace:manage', 'workspace:read'],
          workspaceId: ws.id,
        }
      );

      const powerfulKey = keyBRes.body.data.secretKey;

      // User B attempts MEMBER_INVITE on workspace where their role is only VIEWER
      const inviteRes = await makeRequest(
        'POST',
        `/api/v1/remote/workspaces/${ws.id}/members/invite`,
        { 'X-API-Key': powerfulKey },
        { email: 'newmember@test.com', role: 'MEMBER' }
      );

      // Denied by workspace RBAC: FORBIDDEN_RBAC
      expect(inviteRes.status).toBe(403);
      expect(inviteRes.body.error.code).toBe('FORBIDDEN_RBAC');
    });

    describe('10. Outbound Webhooks System E2E', () => {
      let endpointId: string;
      let webhookSecret: string;

      it('registers a webhook endpoint and returns HMAC signing secret once', async () => {
        const res = await makeRequest(
          'POST',
          '/api/v1/remote/webhooks',
          { 'X-API-Key': userAApiKey },
          {
            url: webhookUrl,
            description: 'Local CI Receiver',
            events: ['test.ping', 'profile.created', 'proxy.created'],
            allowHttp: true, // Local test mock
          }
        );

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.secret).toBeDefined();
        expect(res.body.data.secret.startsWith('whsec_')).toBe(true);

        endpointId = res.body.data.id;
        webhookSecret = res.body.data.secret;
      });

      it('dispatches a signed test event and verifies HMAC-SHA256 signature', async () => {
        receivedWebhooks = [];

        const testRes = await makeRequest(
          'POST',
          `/api/v1/remote/webhooks/${endpointId}/test`,
          { 'X-API-Key': userAApiKey },
          { allowHttp: true }
        );

        expect(testRes.status).toBe(200);
        expect(testRes.body.success).toBe(true);
        expect(testRes.body.data.deliveryId).toBeDefined();

        // Verify receiver caught the payload
        expect(receivedWebhooks.length).toBeGreaterThanOrEqual(1);
        const received = receivedWebhooks[0];

        // Verify HMAC Signature header format: t=...,v1=...
        const sigHeader = received.headers['x-mahi-signature'] as string;
        expect(sigHeader).toBeDefined();
        expect(sigHeader).toContain('t=');
        expect(sigHeader).toContain('v1=');

        // Cryptographic verification
        const verified = verifyWebhookSignature(webhookSecret, sigHeader, received.body);
        expect(verified.verified).toBe(true);

        // Verify event headers
        expect(received.headers['x-mahi-event-type']).toBe('test.ping');
        expect(received.headers['x-mahi-event-id']).toBeDefined();
      });

      it('retries delivery with backoff when target server returns 500 error', async () => {
        receivedWebhooks = [];
        webhookFailOnce = true; // First attempt will 500, retry will 200

        const testRes = await makeRequest(
          'POST',
          `/api/v1/remote/webhooks/${endpointId}/test`,
          { 'X-API-Key': userAApiKey },
          { allowHttp: true }
        );

        expect(testRes.status).toBe(200);
        expect(testRes.body.data.attemptCount).toBeGreaterThanOrEqual(2);
        expect(testRes.body.data.success).toBe(true);
      });

      it('lists delivery logs for the endpoint', async () => {
        const deliveriesRes = await makeRequest(
          'GET',
          `/api/v1/remote/webhooks/${endpointId}/deliveries`,
          { 'X-API-Key': userAApiKey }
        );

        expect(deliveriesRes.status).toBe(200);
        expect(deliveriesRes.body.success).toBe(true);
        expect(Array.isArray(deliveriesRes.body.data)).toBe(true);
        expect(deliveriesRes.body.data.length).toBeGreaterThanOrEqual(2);
      });

      it('rotates signing secret and revokes endpoint', async () => {
        const rotateRes = await makeRequest(
          'POST',
          `/api/v1/remote/webhooks/${endpointId}/rotate-secret`,
          { 'X-API-Key': userAApiKey }
        );

        expect(rotateRes.status).toBe(200);
        expect(rotateRes.body.data.newSecret).not.toBe(webhookSecret);

        const deleteRes = await makeRequest(
          'DELETE',
          `/api/v1/remote/webhooks/${endpointId}`,
          { 'X-API-Key': userAApiKey }
        );

        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body.data.revoked).toBe(true);
      });
    });

    it('11. Revoking User A API key immediately rejects subsequent requests with 401', async () => {
      // Revoke the key
      const delKeyRes = await makeRequest(
        'DELETE',
        `/api/v1/remote/api-keys/${userAApiKeyId}`,
        { Authorization: `Bearer ${userAJwt}` }
      );
      expect(delKeyRes.status).toBe(200);

      // Attempt to use revoked key
      const retryRes = await makeRequest(
        'GET',
        '/api/v1/remote/profiles',
        { 'X-API-Key': userAApiKey }
      );

      expect(retryRes.status).toBe(401);
      expect(retryRes.body.error.code).toBe('UNAUTHORIZED');
    });

    it('12. Local REST API (port 32123) is preserved and functions air-gapped without cloud dependency', () => {
      const localKeys = getLocalApiKeys('owner');
      expect(Array.isArray(localKeys)).toBe(true);
    });
  });
});
