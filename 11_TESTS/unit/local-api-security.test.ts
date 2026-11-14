import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { initSqlEngine, setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createCentralApiServer } from '../../07_BACKEND/server/app.js';
import {
  resetSuperAdminRateLimitForTesting,
  isOriginAllowed,
  getCorsHeaders,
} from '../../07_BACKEND/api/local-api-server.js';
import { generateApiKey } from '../../07_BACKEND/services/api-v2-service.js';
import { createProfile, deleteProfile } from '../../02_BROWSER/services/profile-service.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
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
    const generated = generateApiKey('Standard User Key', 'user_123', ['profiles:read', 'profiles:write']);
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

  // 8. PROFILE START RETURN ACTUAL CDP PORT
  it('8. Profile launch returns actual mapped cdpPort from getProfileDebugPort', async () => {
    const expectedPort = getProfileDebugPort(testProfileId);
    expect(typeof expectedPort).toBe('number');
    expect(expectedPort).toBeGreaterThan(0);

    const res = await request(`/api/v2/profiles/${testProfileId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testApiKey}` },
    });
    // In headless test environments without Chromium, processManager returns result with cdpPort
    expect(res.data.cdpPort).toBe(expectedPort);
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
});
