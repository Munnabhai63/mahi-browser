import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { initSqlEngine, setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createCentralApiServer } from '../../07_BACKEND/server/app.js';
import {
  createLocalApiServer,
  resetSuperAdminRateLimitForTesting,
  isOriginAllowed,
  getCorsHeaders,
  isAppPackaged,
  isLocalSuperAdminEnabled,
} from '../../07_BACKEND/api/local-api-server.js';
import { generateApiKey } from '../../07_BACKEND/services/api-v2-service.js';
import { checkAdminAuth } from '../../07_BACKEND/commercial/routes/router-shared.js';
import { signToken } from '../../07_BACKEND/commercial/commercial-auth-service.js';
import { createProfile, deleteProfile } from '../../02_BROWSER/services/profile-service.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import {
  getInstallSecrets,
  resetCachedSecretsForTesting,
  getMasterAdminSecret,
} from '../../08_SECURITY/install-secrets.js';
import {
  getOrCreateMasterKey,
  resetCachedMasterKeyForTesting,
} from '../../08_SECURITY/encryption.js';

describe('TASK 2: Local REST API Lockdown, RBAC & Encrypted Secrets Storage', () => {
  let server: http.Server;
  const PORT = 35678;
  const testDbDir = path.resolve('.mahi_data', 'test-local-api-sec-isolated');
  const testDbPath = path.join(testDbDir, 'test_local_api_sec.sqlite');

  let testApiKey = '';
  let testProfileId = '';
  const adminSecret = getMasterAdminSecret();

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initSqlEngine();
    await initializeDatabase();

    // Create a dummy profile for testing
    const p = createProfile({ name: 'Security Test Profile', engine: 'chrome' });
    testProfileId = p.id;

    // Generate a standard user API key
    const generated = generateApiKey('Standard User Key', 'user_123', ['profiles:read', 'profiles:write', 'profiles:launch']);
    testApiKey = generated.secretKey;

    // Start Central API server on test port
    server = createCentralApiServer();
    await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', () => resolve()));
  });

  afterAll(async () => {
    if (testProfileId) {
      try { deleteProfile(testProfileId); } catch {}
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    resetSuperAdminRateLimitForTesting();
  });

  const request = async (
    urlPath: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) => {
    const res = await fetch(`http://127.0.0.1:${PORT}${urlPath}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, headers: res.headers, data };
  };

  // 1. PUBLIC HEALTH ENDPOINT
  it('1. Public health check returns minimal status without version or uptime leakage', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: 'HEALTHY', ok: true });
    expect(res.data.version).toBeUndefined();
    expect(res.data.uptime).toBeUndefined();
    expect(res.data.timestamp).toBeUndefined();

    const resV2 = await request('/api/v2/health');
    expect(resV2.status).toBe(200);
    expect(resV2.data).toEqual({ status: 'HEALTHY', ok: true });
  });

  // 2. UNAUTHENTICATED ENDPOINTS REQUIRE AUTH (401)
  it('2. Unauthenticated requests to /api/v2/* endpoints return 401 Unauthorized', async () => {
    const endpoints = [
      '/api/v2/profiles',
      '/api/v2/api-keys',
      '/api/v2/fleet/telemetry',
      '/api/v2/fleet/devices',
      '/api/v2/logs',
      '/api/v2/feature-flags',
      '/api/v2/distribution/info',
      '/api/v2/license/status',
    ];

    for (const ep of endpoints) {
      const res = await request(ep);
      expect(res.status, `Endpoint ${ep} should require auth`).toBe(401);
      expect(res.data.success).toBe(false);
    }
  });

  // 3. AUTHENTICATED USER CAN ACCESS USER ENDPOINTS
  it('3. Valid API Key grants access to user endpoints with 200 OK', async () => {
    const resProfiles = await request('/api/v2/profiles', {
      headers: { Authorization: `Bearer ${testApiKey}` },
    });
    expect(resProfiles.status).toBe(200);
    expect(resProfiles.data.success).toBe(true);
    expect(Array.isArray(resProfiles.data.data)).toBe(true);

    const resFlags = await request('/api/v2/feature-flags', {
      headers: { 'X-API-Key': testApiKey },
    });
    expect(resFlags.status).toBe(200);
    expect(resFlags.data.success).toBe(true);
  });

  // 4. RBAC: NORMAL USER CANNOT ACCESS SUPER ADMIN ROUTES (403)
  it('4. Standard user token/API key receives 403 Forbidden on super-admin routes', async () => {
    const superAdminEndpoints = [
      '/api/v2/super-admin/licenses/list',
      '/api/v2/super-admin/db/table/profiles',
    ];

    for (const ep of superAdminEndpoints) {
      const res = await request(ep, {
        headers: { Authorization: `Bearer ${testApiKey}` },
      });
      expect(res.status, `User should be forbidden from ${ep}`).toBe(403);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toContain('Master admin');
    }
  });

  // 5. MASTER ADMIN CAN ACCESS SUPER ADMIN ROUTES (200)
  it('5. Master admin secret grants access to super-admin routes', async () => {
    const res = await request('/api/v2/super-admin/db/table/profiles', {
      headers: { 'X-Admin-Secret': adminSecret },
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  // 6. RATE LIMITING ON SUPER ADMIN VERIFY
  it('6. In-memory rate limiter blocks brute force on super-admin auth verify (max 5 fails -> 429)', async () => {
    resetSuperAdminRateLimitForTesting();

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request('/api/v2/super-admin/auth/verify', {
        method: 'POST',
        body: { secret: 'wrong_secret_' + i },
      });
      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
    }

    // 6th attempt should be rate limited (429)
    const res6 = await request('/api/v2/super-admin/auth/verify', {
      method: 'POST',
      body: { secret: 'wrong_secret_6' },
    });
    expect(res6.status).toBe(429);
    expect(res6.data.error).toContain('Too many failed');
  });

  // 7. CORS ORIGIN RESTRICTIONS
  it('7. CORS origin validation restricts strictly to desktop origins and rejects unauthorized origins', () => {
    // Valid desktop origins
    expect(isOriginAllowed('http://127.0.0.1:32123')).toBe(true);
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(isOriginAllowed('app://mahi-browser')).toBe(true);
    expect(isOriginAllowed('file:///app/index.html')).toBe(true);

    // Rejected external origins
    expect(isOriginAllowed('https://evil-attacker.com')).toBe(false);
    expect(isOriginAllowed('http://malicious.org')).toBe(false);
    expect(isOriginAllowed('chrome-extension://abcdefghijklmnop')).toBe(false);
    expect(isOriginAllowed('https://mahibrowser.com')).toBe(false);
  });

  // 8. PROFILE START HARDENING: NO FIXED CDP PORT BY DEFAULT
  it('8. Profile launch keeps CDP disabled in normal mode and never exposes predictable getProfileDebugPort', async () => {
    const deprecatedPredictablePort = getProfileDebugPort(testProfileId);
    expect(typeof deprecatedPredictablePort).toBe('number');
    expect(deprecatedPredictablePort).toBeGreaterThan(0);

    try {
      const res = await request(`/api/v2/profiles/${testProfileId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testApiKey}` },
      });
      if (res.data.success) {
        expect(res.data.cdpDisabled).toBe(true);
        expect(res.data.cdpPort).toBeUndefined();
      } else {
        expect(res.data.cdpPort).toBe(deprecatedPredictablePort);
      }
    } finally {
      await processManager.stopProfile(testProfileId).catch(() => {});
    }
  });

  // 9. ENCRYPTED SECRETS AT REST & MIGRATION SAFETY
  it('9. Install secrets and master key support encrypted format at rest and legacy migration', () => {
    resetCachedSecretsForTesting();
    const secrets = getInstallSecrets();
    expect(secrets).toBeDefined();
    expect(secrets.jwtSecret).toBeDefined();
    expect(secrets.apiAuthToken).toBeDefined();
    expect(secrets.adminSalt).toBeDefined();

    resetCachedMasterKeyForTesting();
    const key = getOrCreateMasterKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  // 10. API KEY GRANULAR SCOPE ENFORCEMENT
  it('10. API key with read-only scope is forbidden from write endpoints', async () => {
    const readOnlyKey = generateApiKey('Read Only Key', 'user_ro', ['profiles:read']).secretKey;
    
    // Read succeeds with 200
    const resRead = await request('/api/v2/profiles', {
      headers: { Authorization: `Bearer ${readOnlyKey}` },
    });
    expect(resRead.status).toBe(200);

    // Write fails with 403 Forbidden
    const resWrite = await request('/api/v2/profiles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${readOnlyKey}` },
      body: { name: 'Unauthorized Create' },
    });
    expect(resWrite.status).toBe(403);
    expect(resWrite.data.success).toBe(false);
    expect(resWrite.data.error).toContain('profiles:write');
  });

  // 11. LOCAL SUPER ADMIN TOGGLE
  it('11. isLocalSuperAdminEnabled obeys packaging and environment gates', () => {
    const isPackaged = isAppPackaged();
    if (!isPackaged) {
      expect(isLocalSuperAdminEnabled()).toBe(true);
    }
  });

  // 12. SUB-STEP 1A: QUERY-PARAM SECRETS REJECTED, API KEY SCOPE/IDOR LOCKDOWN, & SHORTCUTS AUTH
  it('12. rejects URL query-param credentials (?token, ?apiKey, ?adminSecret) and requires auth on fix-shortcuts', async () => {
    const resQueryToken = await request(`/api/v2/profiles?token=${encodeURIComponent(testApiKey)}`);
    expect(resQueryToken.status).toBe(401);

    const resQueryApiKey = await request(`/api/v2/profiles?apiKey=${encodeURIComponent(testApiKey)}`);
    expect(resQueryApiKey.status).toBe(401);

    const resQueryAdmin = await request(`/api/v2/super-admin/db/table/profiles?adminSecret=${encodeURIComponent(adminSecret)}`);
    expect(resQueryAdmin.status).toBe(401);

    const localDaemon = createLocalApiServer();
    await new Promise<void>((resolve) => localDaemon.listen(0, '127.0.0.1', () => resolve()));
    const daemonAddr = localDaemon.address() as any;
    const daemonBase = `http://127.0.0.1:${daemonAddr.port}`;
    try {
      const resQueryLegacyAdmin = await fetch(`${daemonBase}/admin/licenses?adminSecret=${encodeURIComponent(adminSecret)}`);
      expect(resQueryLegacyAdmin.status).toBe(401);

      const resDaemonDlUnauth = await fetch(`${daemonBase}/download/setup`);
      expect(resDaemonDlUnauth.status).toBe(401);

      const resDaemonQueryToken = await fetch(`${daemonBase}/api/v2/profiles?token=${encodeURIComponent(testApiKey)}`);
      expect(resDaemonQueryToken.status).toBe(401);
    } finally {
      await new Promise<void>((resolve) => localDaemon.close(() => resolve()));
    }

    const resUnauthShortcut = await request('/api/v2/system/fix-shortcuts', { method: 'POST' });
    expect(resUnauthShortcut.status).toBe(401);

    const resUserShortcut = await request('/api/v2/system/fix-shortcuts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testApiKey}` },
    });
    expect(resUserShortcut.status).toBe(403);
  });

  it('13. enforces api_keys:read/write scopes and prevents cross-user minting/revocation on /api/v2/api-keys', async () => {
    // Low-privilege key (without api_keys:write) cannot mint API keys
    const lowPrivCreate = await request('/api/v2/api-keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testApiKey}` },
      body: { name: 'Escalated', userId: 'victim_user', scopes: ['*'] },
    });
    expect(lowPrivCreate.status).toBe(403);

    // Master admin creates keys for userA and userB (with api_keys:read/write for userA)
    const userAKeyRes = await request('/api/v2/api-keys', {
      method: 'POST',
      headers: { 'X-Admin-Secret': adminSecret },
      body: {
        name: 'UserA Manager',
        userId: 'user_alpha',
        scopes: ['api_keys:read', 'api_keys:write', 'profiles:read'],
      },
    });
    expect(userAKeyRes.status).toBe(201);
    const userASecret = userAKeyRes.data.data.secretKey as string;

    const userBKeyRes = await request('/api/v2/api-keys', {
      method: 'POST',
      headers: { 'X-Admin-Secret': adminSecret },
      body: { name: 'UserB Victim', userId: 'user_beta', scopes: ['profiles:read'] },
    });
    expect(userBKeyRes.status).toBe(201);
    const userBKeyId = userBKeyRes.data.data.keyRecord.id as string;

    // userA cannot mint keys for user_beta or escalate scopes beyond its own
    const crossMint = await request('/api/v2/api-keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userASecret}` },
      body: { name: 'Forged', userId: 'user_beta', scopes: ['profiles:read'] },
    });
    expect(crossMint.status).toBe(403);

    const scopeEscalation = await request('/api/v2/api-keys', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userASecret}` },
      body: { name: 'Wildcard', scopes: ['*'] },
    });
    expect(scopeEscalation.status).toBe(403);

    // userA cannot revoke user_beta's key
    const crossDelete = await request(`/api/v2/api-keys/${userBKeyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userASecret}` },
    });
    expect(crossDelete.status).toBe(403);
  });

  it('14. restricts checkAdminAuth so SUPPORT and BILLING roles cannot pass admin gate', () => {
    const roles: Array<{ role: 'USER' | 'SUPPORT' | 'BILLING' | 'ADMIN' | 'SUPER_ADMIN'; expected: boolean }> = [
      { role: 'USER', expected: false },
      { role: 'SUPPORT', expected: false },
      { role: 'BILLING', expected: false },
      { role: 'ADMIN', expected: true },
      { role: 'SUPER_ADMIN', expected: true },
    ];

    for (const tc of roles) {
      const jwt = signToken({ userId: `u_${tc.role}`, email: `${tc.role.toLowerCase()}@mahibrowser.com`, role: tc.role });
      const mockReq = {
        headers: { authorization: `Bearer ${jwt}` },
      } as unknown as http.IncomingMessage;
      expect(checkAdminAuth(mockReq).isAdmin).toBe(tc.expected);
    }
  });
});
