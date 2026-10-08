import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  RemoteApiService,
  hashSecretKey,
  generateRandomKey,
  checkRateLimit,
  resetRateLimits,
} from '../../07_BACKEND/services/remote-api-service.js';
import {
  validateWebhookUrl,
  generateWebhookSignature,
  verifyWebhookSignature,
} from '../../07_BACKEND/services/webhook-service.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import { createTeamWorkspace } from '../../07_BACKEND/services/team-workspace-service.js';

describe('Phase 6 Unit Tests — Remote API, API Keys, Scopes & Webhook Security', () => {
  let testUserId: string;

  beforeEach(async () => {
    await initializeDatabase();
    resetRateLimits();

    const email = `phase6_unit_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const res = await registerCentralUser({
      email,
      password: 'StrongPassword123!',
      name: 'Phase 6 Tester',
    });
    testUserId = res.user!.id;
    const db = getDatabase();
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(testUserId);
  });

  describe('1. API Key Generation & Cryptographic Hashing', () => {
    it('should generate recognizable key with prefix mahi_live_ and SHA-256 hash', () => {
      const { rawKey, keyPrefix, keyHash } = generateRandomKey('mahi_live_');
      expect(rawKey.startsWith('mahi_live_')).toBe(true);
      expect(keyPrefix).toBe(rawKey.substring(0, 14));
      expect(keyHash).toBe(crypto.createHash('sha256').update(rawKey).digest('hex'));
      expect(keyHash).toHaveLength(64);
    });

    it('should create API key, store only hash, and return plaintext secret once', () => {
      const service = RemoteApiService.getInstance();
      const { keyRecord, secretKey } = service.createApiKey(testUserId, {
        name: 'Test Key 1',
        scopes: ['profiles:read', 'profiles:write'],
        rateLimitPerMin: 60,
      });

      expect(keyRecord.id).toBeDefined();
      expect(secretKey.startsWith('mahi_live_')).toBe(true);
      expect(keyRecord.keyHash).toBe(hashSecretKey(secretKey));

      // Verify database does NOT store plaintext secretKey
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM remote_api_keys WHERE id = ?').get(keyRecord.id) as any;
      expect(row).toBeDefined();
      expect(row.key_hash).toBe(keyRecord.keyHash);
      expect(JSON.stringify(row)).not.toContain(secretKey);
    });

    it('should authenticate valid API key and update last_used_at', () => {
      const service = RemoteApiService.getInstance();
      const { keyRecord, secretKey } = service.createApiKey(testUserId, {
        name: 'Auth Key',
        scopes: ['profiles:read'],
      });

      const auth = service.authenticateApiKey(secretKey);
      expect(auth).not.toBeNull();
      expect(auth!.keyRecord.id).toBe(keyRecord.id);
      expect(auth!.user.id).toBe(testUserId);
      expect(auth!.keyRecord.lastUsedAt).toBeDefined();
    });

    it('should reject invalid or revoked API key', () => {
      const service = RemoteApiService.getInstance();
      const { keyRecord, secretKey } = service.createApiKey(testUserId, {
        name: 'Revoke Key',
        scopes: ['profiles:read'],
      });

      // Valid initially
      expect(service.authenticateApiKey(secretKey)).not.toBeNull();

      // Revoke key
      const revoked = service.revokeApiKey(keyRecord.id, testUserId);
      expect(revoked).toBe(true);

      // Now authentication must fail
      expect(service.authenticateApiKey(secretKey)).toBeNull();

      // Non-existent key must fail
      expect(service.authenticateApiKey('mahi_live_badkey12345678901234567890')).toBeNull();
    });

    it('should rotate API key secret securely', () => {
      const service = RemoteApiService.getInstance();
      const { keyRecord, secretKey: oldSecret } = service.createApiKey(testUserId, {
        name: 'Rotate Key',
        scopes: ['profiles:read'],
      });

      const { keyRecord: rotatedKey, newSecretKey } = service.rotateApiKey(keyRecord.id, testUserId);
      expect(rotatedKey.id).toBe(keyRecord.id);
      expect(newSecretKey).not.toBe(oldSecret);

      // Old secret must no longer authenticate
      expect(service.authenticateApiKey(oldSecret)).toBeNull();

      // New secret must authenticate
      const auth = service.authenticateApiKey(newSecretKey);
      expect(auth).not.toBeNull();
      expect(auth!.keyRecord.id).toBe(keyRecord.id);
    });
  });

  describe('2. Dual-Gate Scope & Workspace RBAC Enforcement', () => {
    it('should allow access when both API key scope and RBAC permissions are satisfied', () => {
      const service = RemoteApiService.getInstance();
      const ws = createTeamWorkspace(testUserId, { name: 'Engineering WS' });

      const authContext: any = {
        authType: 'API_KEY',
        userId: testUserId,
        email: 'test@example.com',
        userRole: 'USER',
        apiKeyId: 'key_123',
        apiKeyScopes: ['profiles:read', 'profiles:write', 'workspace:read'],
        workspaceId: ws.id,
      };

      const access = service.evaluateAccess(authContext, 'profiles:read', 'WORKSPACE_VIEW', ws.id);
      expect(access.allowed).toBe(true);
    });

    it('should deny access when API key lacks the required scope (even if user is workspace OWNER)', () => {
      const service = RemoteApiService.getInstance();
      const ws = createTeamWorkspace(testUserId, { name: 'Finance WS' });

      const authContext: any = {
        authType: 'API_KEY',
        userId: testUserId,
        email: 'owner@example.com',
        userRole: 'USER',
        apiKeyId: 'key_123',
        apiKeyScopes: ['profiles:read'], // Lacks 'workspace:manage'
        workspaceId: ws.id,
      };

      const access = service.evaluateAccess(authContext, 'workspace:manage', 'MEMBER_INVITE', ws.id);
      expect(access.allowed).toBe(false);
      expect(access.code).toBe('FORBIDDEN_SCOPE');
    });

    it('should deny access when member workspace role lacks permission (even if API key has scope)', async () => {
      const service = RemoteApiService.getInstance();
      const ws = createTeamWorkspace(testUserId, { name: 'Operations WS' });

      // Create a viewer user in the workspace
      const viewerEmail = `viewer_${Date.now()}@test.com`;
      const viewerRes = await registerCentralUser({
        email: viewerEmail,
        password: 'Password123!',
        name: 'Viewer User',
      });
      const viewerId = viewerRes.user!.id;
      const db = getDatabase();
      db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(viewerId);

      // Add as VIEWER in team_workspace_members
      db.prepare(`
        INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, joined_at, created_at)
        VALUES (?, ?, ?, 'VIEWER', 'ACTIVE', ?, ?)
      `).run(crypto.randomUUID(), ws.id, viewerId, new Date().toISOString(), new Date().toISOString());

      const authContext: any = {
        authType: 'API_KEY',
        userId: viewerId,
        email: viewerEmail,
        userRole: 'USER',
        apiKeyId: 'key_456',
        apiKeyScopes: ['workspace:manage', 'profiles:write'], // Omnipotent API key scopes
        workspaceId: ws.id,
      };

      // Attempt MEMBER_INVITE permission which VIEWER does not possess
      const access = service.evaluateAccess(authContext, 'workspace:manage', 'MEMBER_INVITE', ws.id);
      expect(access.allowed).toBe(false);
      expect(access.code).toBe('FORBIDDEN_RBAC');
    });

    it('should prevent cross-workspace IDOR if API key is bound to a specific workspace', () => {
      const service = RemoteApiService.getInstance();
      const wsA = createTeamWorkspace(testUserId, { name: 'Workspace A' });
      const wsB = createTeamWorkspace(testUserId, { name: 'Workspace B' });

      const authContext: any = {
        authType: 'API_KEY',
        userId: testUserId,
        email: 'user@test.com',
        userRole: 'USER',
        apiKeyId: 'key_789',
        apiKeyScopes: ['workspace:read'],
        workspaceId: wsA.id, // Bound to Workspace A
      };

      // Accessing Workspace B with a key bound to Workspace A
      const access = service.evaluateAccess(authContext, 'workspace:read', 'WORKSPACE_VIEW', wsB.id);
      expect(access.allowed).toBe(false);
      expect(access.code).toBe('CROSS_WORKSPACE_DENIED');
    });
  });

  describe('3. Rate Limiting System', () => {
    it('should allow requests within limit and track remaining capacity', () => {
      const id = `test_rate_${Date.now()}`;
      const res1 = checkRateLimit(id, 5);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(4);

      const res2 = checkRateLimit(id, 5);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(3);
    });

    it('should throttle and reject when limit is exceeded', () => {
      const id = `test_throttle_${Date.now()}`;
      for (let i = 0; i < 3; i++) {
        checkRateLimit(id, 3);
      }

      // 4th request must be denied
      const resBlocked = checkRateLimit(id, 3);
      expect(resBlocked.allowed).toBe(false);
      expect(resBlocked.remaining).toBe(0);
      expect(resBlocked.resetSeconds).toBeGreaterThan(0);
    });
  });

  describe('4. SSRF Protection & Webhook URL Validation', () => {
    it('should reject loopback and localhost destinations', () => {
      expect(validateWebhookUrl('http://127.0.0.1:8080/hook').valid).toBe(false);
      expect(validateWebhookUrl('https://localhost:8080/hook').valid).toBe(false);
      expect(validateWebhookUrl('https://127.0.0.1/hook').valid).toBe(false);
      expect(validateWebhookUrl('https://0.0.0.0/hook').valid).toBe(false);
      expect(validateWebhookUrl('https://sub.localhost/hook').valid).toBe(false);
    });

    it('should reject RFC1918 private IPv4 networks', () => {
      // 10.0.0.0/8
      expect(validateWebhookUrl('https://10.0.1.50/hook').valid).toBe(false);
      // 172.16.0.0/12
      expect(validateWebhookUrl('https://172.16.0.1/hook').valid).toBe(false);
      expect(validateWebhookUrl('https://172.31.255.254/hook').valid).toBe(false);
      // 192.168.0.0/16
      expect(validateWebhookUrl('https://192.168.1.1/hook').valid).toBe(false);
      expect(validateWebhookUrl('https://192.168.100.200/hook').valid).toBe(false);
    });

    it('should reject AWS / Cloud Metadata and Link-Local IPs (169.254.169.254)', () => {
      expect(validateWebhookUrl('https://169.254.169.254/latest/meta-data').valid).toBe(false);
      expect(validateWebhookUrl('https://169.254.1.1/hook').valid).toBe(false);
    });

    it('should reject Carrier-Grade NAT IPs (100.64.0.0/10)', () => {
      expect(validateWebhookUrl('https://100.64.1.1/hook').valid).toBe(false);
    });

    it('should reject non-HTTPS URLs in production mode', () => {
      const res = validateWebhookUrl('http://api.myservice.com/hook');
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('HTTPS');
    });

    it('should allow valid public HTTPS destinations', () => {
      expect(validateWebhookUrl('https://api.example.com/webhooks').valid).toBe(true);
      expect(validateWebhookUrl('https://hooks.slack.com/services/T00/B00/X00').valid).toBe(true);
      expect(validateWebhookUrl('https://discord.com/api/webhooks/123/abc').valid).toBe(true);
    });
  });

  describe('5. Webhook HMAC-SHA256 Signing & Replay Protection', () => {
    it('should sign payload and verify matching HMAC signature', () => {
      const secret = 'whsec_999888777666555444333222111000aa';
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({ id: 'evt_1', event: 'profile.created', data: { name: 'Profile 1' } });

      const sig = generateWebhookSignature(secret, timestamp, payload);
      const header = `t=${timestamp},v1=${sig}`;

      const verification = verifyWebhookSignature(secret, header, payload, 300);
      expect(verification.verified).toBe(true);
    });

    it('should reject signature if payload was tampered with', () => {
      const secret = 'whsec_secret_123';
      const timestamp = Math.floor(Date.now() / 1000);
      const originalPayload = JSON.stringify({ id: 'evt_1', amount: 100 });
      const tamperedPayload = JSON.stringify({ id: 'evt_1', amount: 999 });

      const sig = generateWebhookSignature(secret, timestamp, originalPayload);
      const header = `t=${timestamp},v1=${sig}`;

      const verification = verifyWebhookSignature(secret, header, tamperedPayload, 300);
      expect(verification.verified).toBe(false);
      expect(verification.reason).toBe('Signature mismatch');
    });

    it('should reject signature if secret is wrong', () => {
      const secretA = 'whsec_secret_A';
      const secretB = 'whsec_secret_B';
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({ id: 'evt_1' });

      const sig = generateWebhookSignature(secretA, timestamp, payload);
      const header = `t=${timestamp},v1=${sig}`;

      const verification = verifyWebhookSignature(secretB, header, payload, 300);
      expect(verification.verified).toBe(false);
    });

    it('should reject delivery if timestamp exceeds replay tolerance window', () => {
      const secret = 'whsec_secret_replay';
      // 10 minutes old timestamp (outside 300s window)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const payload = JSON.stringify({ id: 'evt_replay' });

      const sig = generateWebhookSignature(secret, oldTimestamp, payload);
      const header = `t=${oldTimestamp},v1=${sig}`;

      const verification = verifyWebhookSignature(secret, header, payload, 300);
      expect(verification.verified).toBe(false);
      expect(verification.reason).toContain('tolerance window');
    });
  });
});
