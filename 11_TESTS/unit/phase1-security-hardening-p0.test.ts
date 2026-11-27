import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  setCustomDatabasePath,
  closeDatabase,
  getDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { signAccessToken } from '../../05_AUTH/central-auth-service.js';
import { authenticateRequest } from '../../05_AUTH/auth-middleware.js';
import {
  isOwnerSession,
  base32Decode,
  totpGenerate,
  clearAllOwnerSessions,
  clearOwnerVerifyRateLimits,
} from '../../07_BACKEND/services/owner-totp-service.js';
import { getAuthUser, getAuthUserAsync } from '../../07_BACKEND/commercial/routes/router-shared.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import {
  testProxy,
  resolveGeoLocation,
  isBlockedIpAddress,
  assertSafeProxyTargetRuntime,
  ProxySecurityError,
} from '../../02_BROWSER/services/proxy-test-service.js';
import { AppError, toSafeErrorResponse } from '../../07_BACKEND/utils/app-error.js';
import crypto from 'node:crypto';
import {
  validateCloudEnv,
  getCloudEnv,
  resetCloudEnvCacheForTesting,
  CloudEnvError,
} from '../../07_BACKEND/utils/cloud-env.js';
import {
  API_SECURITY_CSP,
  ADMIN_HTML_CSP,
  PORTAL_HTML_CSP,
  PERMISSIONS_POLICY_HEADER,
  COOP_HEADER,
} from '../../07_BACKEND/utils/security-headers.js';
import { startFastifyCloudGateway } from '../../07_BACKEND/server/cloud-gateway.js';

const TEST_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

function seedUser(params: {
  id: string;
  email: string;
  role: string;
  status?: string;
  sessionId?: string;
  isRevoked?: number;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO auth_users
     (id, email, normalized_email, password_hash, salt, name, role, status, email_verified, plan_id, profile_quota, created_at, updated_at)
     VALUES (?, ?, ?, 'hash', 'salt', 'Test User', ?, ?, 1, 'plan_free', 10, ?, ?)`
  ).run(
    params.id,
    params.email,
    params.email.toLowerCase(),
    params.role,
    params.status ?? 'ACTIVE',
    now,
    now
  );

  if (params.sessionId) {
    db.prepare(
      `INSERT OR REPLACE INTO auth_sessions
       (id, user_id, refresh_token_hash, device_id, device_name, platform, ip_address, is_revoked, created_at, last_used_at, expires_at)
       VALUES (?, ?, ?, 'dev_1', 'Test Device', 'win32', '127.0.0.1', ?, ?, ?, ?)`
    ).run(
      params.sessionId,
      params.id,
      `rt_${params.sessionId}_${Date.now()}`,
      params.isRevoked ?? 0,
      now,
      now,
      expiresAt
    );
  }
}

describe('Phase 1 P0 Security Hardening — Steps 1 & 2 (TOTP Bypass, 404 Non-Staff, Revocation)', () => {
  let tempDir: string;
  let server: http.Server;
  let baseUrl: string;
  const origTotpSecret = process.env.MAHI_OWNER_TOTP_SECRET;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-p0-sec-'));
    setCustomDatabasePath(path.join(tempDir, 'test.sqlite'));
    await initializeDatabase();

    process.env.MAHI_OWNER_TOTP_SECRET = TEST_TOTP_SECRET;

    server = http.createServer(async (req, res) => {
      try {
        const handled = await handleCommercialAPIRequest(req, res);
        if (!handled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Not found' }));
        }
      } catch (err: any) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err?.message || 'Internal error' }));
        }
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    clearAllOwnerSessions();
    clearOwnerVerifyRateLimits();
    process.env.MAHI_OWNER_TOTP_SECRET = TEST_TOTP_SECRET;
  });

  afterAll(async () => {
    clearAllOwnerSessions();
    clearOwnerVerifyRateLimits();
    if (origTotpSecret === undefined) {
      delete process.env.MAHI_OWNER_TOTP_SECRET;
    } else {
      process.env.MAHI_OWNER_TOTP_SECRET = origTotpSecret;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects hardcoded testing-bypass and bypass owner session tokens', () => {
    expect(isOwnerSession('testing-bypass')).toBe(false);
    expect(isOwnerSession('bypass')).toBe(false);
    expect(isOwnerSession('')).toBe(false);
    expect(isOwnerSession(null)).toBe(false);
    expect(isOwnerSession(undefined)).toBe(false);
  });

  it('rejects missing or forged testing-bypass owner_session cookies on owner endpoints and accepts real TOTP session', async () => {
    const adminId = 'usr_super_admin_p0';
    const adminSess = 'sess_super_admin_p0';
    const targetId = 'usr_target_p0';
    seedUser({ id: adminId, email: 'owner@example.com', role: 'SUPER_ADMIN', sessionId: adminSess });
    seedUser({ id: targetId, email: 'target@example.com', role: 'USER', sessionId: 'sess_target_p0' });

    const adminJwt = signAccessToken({
      userId: adminId,
      email: 'owner@example.com',
      role: 'SUPER_ADMIN',
      planId: 'plan_free',
      profileQuota: 10,
      sessionId: adminSess,
    });

    // 1. Missing owner_session cookie -> 403
    const resNoCookie = await fetch(`${baseUrl}/api/v1/admin/owner/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ userId: targetId, planId: 'plan_pro' }),
    });
    expect(resNoCookie.status).toBe(403);

    // 2. Forged Cookie: owner_session=testing-bypass -> 403 on both grant & ban
    for (const bypassVal of ['testing-bypass', 'bypass']) {
      const resGrant = await fetch(`${baseUrl}/api/v1/admin/owner/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminJwt}`,
          Cookie: `owner_session=${bypassVal}`,
        },
        body: JSON.stringify({ userId: targetId, planId: 'plan_pro' }),
      });
      expect(resGrant.status).toBe(403);

      const resBan = await fetch(`${baseUrl}/api/v1/admin/owner/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminJwt}`,
          Cookie: `owner_session=${bypassVal}`,
        },
        body: JSON.stringify({ userId: targetId, reason: 'test' }),
      });
      expect(resBan.status).toBe(403);
    }

    // 3. Invalid TOTP -> 401
    const resBadTotp = await fetch(`${baseUrl}/api/v1/admin/owner/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ code: '000000' }),
    });
    expect(resBadTotp.status).toBe(401);

    // 4. Valid live TOTP -> sets real owner_session cookie and allows owner/grant
    const counter = BigInt(Math.floor(Date.now() / 30000));
    const liveCode = totpGenerate(base32Decode(TEST_TOTP_SECRET), counter);
    const resVerify = await fetch(`${baseUrl}/api/v1/admin/owner/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ code: liveCode }),
    });
    expect(resVerify.status).toBe(200);
    const setCookie = resVerify.headers.get('set-cookie') || '';
    const match = setCookie.match(/owner_session=([^;]+)/);
    expect(match?.[1]).toBeTruthy();
    expect(match?.[1]).not.toBe('testing-bypass');
    expect(isOwnerSession(match![1])).toBe(true);

    const resRealGrant = await fetch(`${baseUrl}/api/v1/admin/owner/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwt}`,
        Cookie: `owner_session=${match![1]}`,
      },
      body: JSON.stringify({ userId: targetId, planId: 'plan_pro' }),
    });
    expect(resRealGrant.status).not.toBe(401);
    expect(resRealGrant.status).not.toBe(403);
    expect(resRealGrant.status).toBe(200);

    // 5. /api/v1/admin/owner/verify-totp alias behaves identically
    const resVerifyAlias = await fetch(`${baseUrl}/api/v1/admin/owner/verify-totp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ code: liveCode }),
    });
    expect(resVerifyAlias.status).toBe(200);
    const aliasCookie = resVerifyAlias.headers.get('set-cookie')?.match(/owner_session=([^;]+)/)?.[1];
    expect(aliasCookie).toBeTruthy();
    expect(isOwnerSession(aliasCookie!)).toBe(true);
  });

  it('returns real HTTP 404 for authenticated non-staff on admin/owner routes and unauthenticated on owner routes', async () => {
    for (const role of ['USER', 'SUPPORT', 'BILLING'] as const) {
      const uid = `usr_nonstaff_${role}`;
      const sid = `sess_nonstaff_${role}`;
      seedUser({ id: uid, email: `${role.toLowerCase()}@example.com`, role, sessionId: sid });
      const token = signAccessToken({
        userId: uid,
        email: `${role.toLowerCase()}@example.com`,
        role,
        planId: 'plan_free',
        profileQuota: 10,
        sessionId: sid,
      });

      const dashRes = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(dashRes.status).toBe(404);

      const usersRes = await fetch(`${baseUrl}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(usersRes.status).toBe(404);

      const ownerVerifyRes = await fetch(`${baseUrl}/api/v1/admin/owner/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: '123456' }),
      });
      expect(ownerVerifyRes.status).toBe(404);

      const ownerGrantRes = await fetch(`${baseUrl}/api/v1/admin/owner/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: uid, planId: 'plan_pro' }),
      });
      expect(ownerGrantRes.status).toBe(404);
    }

    // Unauthenticated owner routes return 404 (hidden), while unauthenticated standard admin route stays 403
    const unauthOwner = await fetch(`${baseUrl}/api/v1/admin/owner/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    });
    expect(unauthOwner.status).toBe(404);

    const unauthDash = await fetch(`${baseUrl}/api/v1/admin/dashboard`);
    expect(unauthDash.status).toBe(403);
  });

  it('immediately blocks banned/suspended users and revoked sessions in getAuthUser, getAuthUserAsync, authenticateRequest, and protected routes', async () => {
    const uid = 'usr_revocation_p0';
    const sid = 'sess_revocation_p0';
    seedUser({ id: uid, email: 'revoke@example.com', role: 'USER', status: 'ACTIVE', sessionId: sid });

    const token = signAccessToken({
      userId: uid,
      email: 'revoke@example.com',
      role: 'ADMIN', // stale elevated claim; DB role is USER
      planId: 'plan_free',
      profileQuota: 10,
      sessionId: sid,
    });

    const mockReq = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as http.IncomingMessage;

    // 1. Active session succeeds and syncs current role from DB ('USER', not stale 'ADMIN')
    const syncAuth = getAuthUser(mockReq);
    expect(syncAuth?.userId).toBe(uid);
    expect(syncAuth?.role).toBe('USER');

    const asyncAuth = await getAuthUserAsync(mockReq);
    expect(asyncAuth?.userId).toBe(uid);
    expect(asyncAuth?.role).toBe('USER');
    expect(authenticateRequest(mockReq)?.id).toBe(uid);

    // 2. Suspend user -> immediately blocked even with unexpired JWT
    getDatabase().prepare("UPDATE auth_users SET status = 'SUSPENDED' WHERE id = ?").run(uid);
    expect(getAuthUser(mockReq)).toBeNull();
    expect(await getAuthUserAsync(mockReq)).toBeNull();
    expect(authenticateRequest(mockReq)).toBeNull();

    // 3. Ban user -> blocked on commercial endpoint (/api/v1/auth/me)
    getDatabase().prepare("UPDATE auth_users SET status = 'BANNED' WHERE id = ?").run(uid);
    const bannedMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(bannedMeRes.status).toBe(401);

    // 4. Restore ACTIVE user, revoke session -> immediately blocked
    getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE' WHERE id = ?").run(uid);
    getDatabase().prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE id = ?').run(sid);
    expect(getAuthUser(mockReq)).toBeNull();
    expect(await getAuthUserAsync(mockReq)).toBeNull();
    expect(authenticateRequest(mockReq)).toBeNull();

    const revokedMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(revokedMeRes.status).toBe(401);
  });
});

describe('Phase 1 P0 Security Hardening — Step 3 (Proxy SSRF, DNS Rebinding, HTTPS Geo)', () => {
  it('identifies loopback, RFC1918, cloud metadata, and private IPv6/IPv4-mapped addresses as blocked', () => {
    const blocked = [
      '127.0.0.1',
      '127.255.255.254',
      '169.254.169.254',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.1',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      '::',
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
      'fe80::1',
      'fc00::1',
      'fd12:3456:789a::1',
    ];
    for (const ip of blocked) {
      expect(isBlockedIpAddress(ip), `Expected ${ip} to be blocked`).toBe(true);
    }

    const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111'];
    for (const ip of allowed) {
      expect(isBlockedIpAddress(ip), `Expected ${ip} to be allowed`).toBe(false);
    }
  });

  it('blocks testProxy requests targeting internal IPs, localhost, metadata hostnames, and DNS rebinding', async () => {
    const ssrfTargets = [
      '127.0.0.1',
      '169.254.169.254',
      '10.0.0.1',
      '192.168.1.1',
      '::1',
      '[::1]',
      'localhost',
      'metadata.google.internal',
      '2130706433',
    ];
    for (const host of ssrfTargets) {
      const res = await testProxy({ host, port: 8080, protocol: 'http' });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('SSRF_BLOCKED');
    }

    // DNS rebinding simulation: domain returns public IP + private/metadata IP
    const rebindRes = await testProxy(
      { host: 'rebind.attacker.example', port: 8080, protocol: 'http' },
      {
        lookupFn: async () => [
          { address: '93.184.216.34', family: 4 },
          { address: '169.254.169.254', family: 4 },
        ],
      }
    );
    expect(rebindRes.success).toBe(false);
    expect(rebindRes.errorCode).toBe('SSRF_BLOCKED');

    // Public hostname resolving cleanly returns pinned public IP
    const resolved = await assertSafeProxyTargetRuntime('proxy.public-example.test', {
      lookupFn: async () => [{ address: '93.184.216.34', family: 4 }],
    });
    expect(resolved.resolvedIp).toBe('93.184.216.34');
    expect(resolved.family).toBe(4);

    // Non-existent / empty DNS fails cleanly with ProxySecurityError
    await expect(
      assertSafeProxyTargetRuntime('missing.invalid.example', {
        lookupFn: async () => [],
      })
    ).rejects.toThrow(ProxySecurityError);
  });

  it('uses HTTPS-only geolocation providers and skips blocked internal IPs', async () => {
    const origFetch = globalThis.fetch;
    const requestedUrls: string[] = [];

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      requestedUrls.push(url);
      return new Response(
        JSON.stringify({
          ipAddress: '8.8.8.8',
          countryName: 'United States',
          countryCode: 'US',
          regionName: 'California',
          cityName: 'Mountain View',
          timeZone: 'America/Los_Angeles',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const blockedGeo = await resolveGeoLocation('127.0.0.1');
      expect(blockedGeo).toBeNull();
      expect(requestedUrls).toHaveLength(0);

      const publicGeo = await resolveGeoLocation('8.8.8.8');
      expect(publicGeo?.countryCode).toBe('US');
      expect(requestedUrls.length).toBeGreaterThan(0);
      for (const u of requestedUrls) {
        expect(u.startsWith('https://')).toBe(true);
        expect(u.includes('ip-api.com')).toBe(false);
      }
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe('Phase 1 P0 Security Hardening — Step 4 (Strict Zod Validation & Safe AppError Mapping)', () => {
  let tempDir: string;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-p0-step4-'));
    setCustomDatabasePath(path.join(tempDir, 'test.sqlite'));
    await initializeDatabase();

    server = http.createServer(async (req, res) => {
      await handleCommercialAPIRequest(req, res);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects unexpected/injected body fields with HTTP 400 VALIDATION_ERROR via z.strictObject()', async () => {
    // 1. Unauthenticated /api/v1/auth/register with unexpected mass-assignment field (role)
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'strict-test@example.com',
        password: 'StrongPassword123!',
        acceptedTerms: true,
        role: 'SUPER_ADMIN',
      }),
    });
    expect(regRes.status).toBe(400);
    const regJson = (await regRes.json()) as any;
    expect(regJson.success).toBe(false);
    expect(regJson.code).toBe('VALIDATION_ERROR');
    expect(String(regJson.error)).toContain('Unexpected field');

    // 2. Authenticated user hitting payment checkout with unexpected field
    const uid = 'usr_step4_zod';
    const sid = 'sess_step4_zod';
    seedUser({ id: uid, email: 'step4@example.com', role: 'USER', sessionId: sid });
    const jwt = signAccessToken({
      userId: uid,
      email: 'step4@example.com',
      role: 'USER',
      planId: 'plan_free',
      profileQuota: 10,
      sessionId: sid,
    });

    const checkoutRes = await fetch(`${baseUrl}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        planId: 'plan_pro',
        amountOverride: 1,
      }),
    });
    expect(checkoutRes.status).toBe(400);
    const checkoutJson = (await checkoutRes.json()) as any;
    expect(checkoutJson.code).toBe('VALIDATION_ERROR');
    expect(String(checkoutJson.error)).toContain('amountOverride');

    // 3. Non-staff hitting hidden owner route with unexpected field still receives 404 (not 400 leak)
    const hiddenRes = await fetch(`${baseUrl}/api/v1/admin/owner/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ unexpectedField: true }),
    });
    expect(hiddenRes.status).toBe(404);
  });

  it('masks raw DB/path/stack exceptions while preserving AppError and allowlisted domain errors', () => {
    const errSpy = (() => {
      const orig = console.error;
      console.error = () => {};
      return () => {
        console.error = orig;
      };
    })();

    try {
      const sqliteLeak = toSafeErrorResponse(
        new Error('SQLITE_ERROR: no such table: secret_tokens at C:\\Users\\admin\\app.ts:42'),
        { fallbackStatus: 500 }
      );
      expect(sqliteLeak.statusCode).toBe(500);
      expect(sqliteLeak.code).toBe('INTERNAL_ERROR');
      expect(sqliteLeak.message).toBe('Internal server error.');
      expect(sqliteLeak.message).not.toContain('SQLITE_ERROR');
      expect(sqliteLeak.message).not.toContain('secret_tokens');
      expect(sqliteLeak.message).not.toContain('C:\\Users');

      const pgLeak = toSafeErrorResponse(
        new Error('PrismaClientKnownRequestError: relation "commercial_payments" does not exist'),
        { fallbackStatus: 400 }
      );
      expect(pgLeak.message).toBe('Invalid request.');
      expect(pgLeak.message).not.toContain('PrismaClient');
      expect(pgLeak.message).not.toContain('commercial_payments');

      const appErr = toSafeErrorResponse(
        new AppError('CONFLICT', 'Email is already registered.', 409)
      );
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe('CONFLICT');
      expect(appErr.message).toBe('Email is already registered.');

      const utrErr = toSafeErrorResponse(
        new Error('UTR_ALREADY_EXISTS: This UTR has already been submitted.'),
        { fallbackStatus: 409 }
      );
      expect(utrErr.statusCode).toBe(409);
      expect(utrErr.message).toContain('UTR_ALREADY_EXISTS');
    } finally {
      errSpy();
    }
  });
});

describe('Phase 1 P0 Security Hardening — Step 5 (CloudEnv Fail-Fast & Strict Security Headers/CSP)', () => {
  it('validates production environment fail-fast rules in validateCloudEnv / getCloudEnv', () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const validRsaPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    // Non-production allows dev/test defaults cleanly
    expect(() => validateCloudEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).not.toThrow();

    const makeProdEnv = (overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv =>
      ({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(48) + '_prod_unique_key_9f8e',
        ADMIN_BOOTSTRAP_TOKEN: 'y'.repeat(48) + '_admin_bootstrap_unique_3a2b',
        MAHI_STATUS_PRIVATE_KEY: validRsaPem,
        LOCAL_STORAGE_SECRET: 'z'.repeat(32) + '_storage_key_7c6d',
        APP_URL: 'https://app.mahibrowser.com',
        API_URL: 'https://api.mahibrowser.com',
        ...overrides,
      }) as NodeJS.ProcessEnv;

    const origEnv = { ...process.env };
    try {
      const setProdEnv = (envObj: NodeJS.ProcessEnv) => {
        for (const k of [
          'NODE_ENV',
          'JWT_SECRET',
          'MAHI_JWT_SECRET',
          'ADMIN_BOOTSTRAP_TOKEN',
          'MASTER_ADMIN_SECRET',
          'MAHI_STATUS_PRIVATE_KEY',
          'RSA_PRIVATE_KEY',
          'LOCAL_STORAGE_SECRET',
          'PAYMENT_ALLOW_TEST_ADAPTERS',
          'PAYMENT_PROVIDER',
          'CORS_ALLOW_ALL',
          'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_SECRET',
          'APP_URL',
          'API_URL',
          'R2_BUCKET',
          'S3_BUCKET',
          'AWS_S3_BUCKET',
        ]) {
          if (envObj[k] === undefined) {
            delete process.env[k];
          } else {
            process.env[k] = envObj[k];
          }
        }
        resetCloudEnvCacheForTesting();
      };

      // Valid production env succeeds
      setProdEnv(makeProdEnv());
      const valid = getCloudEnv({ forceReload: true });
      expect(valid.NODE_ENV).toBe('production');

      // Missing secrets -> fails fast
      setProdEnv(makeProdEnv({ JWT_SECRET: undefined, LOCAL_STORAGE_SECRET: undefined }));
      expect(() => getCloudEnv({ forceReload: true })).toThrow(CloudEnvError);

      // PAYMENT_ALLOW_TEST_ADAPTERS=true -> fails fast
      setProdEnv(makeProdEnv({ PAYMENT_ALLOW_TEST_ADAPTERS: 'true' }));
      expect(() => getCloudEnv({ forceReload: true })).toThrow(/PAYMENT_ALLOW_TEST_ADAPTERS/);

      // PAYMENT_PROVIDER=simulation -> fails fast
      setProdEnv(makeProdEnv({ PAYMENT_PROVIDER: 'simulation' }));
      expect(() => getCloudEnv({ forceReload: true })).toThrow(/PAYMENT_PROVIDER=simulation/);

      // CORS_ALLOW_ALL=true -> fails fast
      setProdEnv(makeProdEnv({ CORS_ALLOW_ALL: 'true' }));
      expect(() => getCloudEnv({ forceReload: true })).toThrow(/CORS_ALLOW_ALL/);

      // Unpaired GOOGLE_CLIENT_ID without GOOGLE_CLIENT_SECRET -> fails fast
      setProdEnv(makeProdEnv({ GOOGLE_CLIENT_ID: 'client-only-123' }));
      expect(() => getCloudEnv({ forceReload: true })).toThrow(/GOOGLE_CLIENT_ID/);

      // Non-HTTPS API_URL -> fails fast
      setProdEnv(makeProdEnv({ API_URL: 'http://api.mahibrowser.com' }));
      expect(() => getCloudEnv({ forceReload: true })).toThrow(/API_URL must be a valid https/);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in origEnv)) delete process.env[key];
      }
      Object.assign(process.env, origEnv);
      resetCloudEnvCacheForTesting();
    }
  });

  it('serves strict CSP, Permissions-Policy, COOP, no-store, and X-Gateway-Engine headers across Gateway & HTML portals', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-p0-step5-'));
    setCustomDatabasePath(path.join(tempDir, 'test.sqlite'));
    await initializeDatabase();

    const { app, port } = await startFastifyCloudGateway({ port: 0, host: '127.0.0.1', logger: false });
    try {
      const gwBase = `http://127.0.0.1:${port}`;

      // 1. Native Fastify endpoint (/health)
      const healthRes = await fetch(`${gwBase}/health`);
      expect(healthRes.status).toBe(200);
      expect(healthRes.headers.get('x-gateway-engine')).toBe('Fastify-Node22');
      expect(healthRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(healthRes.headers.get('x-frame-options')).toBe('DENY');
      expect(healthRes.headers.get('permissions-policy')).toBe(PERMISSIONS_POLICY_HEADER);
      expect(healthRes.headers.get('cross-origin-opener-policy')).toBe(COOP_HEADER);
      expect(healthRes.headers.get('content-security-policy')).toBe(API_SECURITY_CSP);
      expect(healthRes.headers.get('cache-control')).toContain('no-store');

      // 2. Hijacked Commercial API endpoint (/api/v1/plans)
      const apiRes = await fetch(`${gwBase}/api/v1/plans`);
      expect(apiRes.status).toBe(200);
      expect(apiRes.headers.get('x-gateway-engine')).toBe('Fastify-Node22');
      expect(apiRes.headers.get('permissions-policy')).toBe(PERMISSIONS_POLICY_HEADER);
      expect(apiRes.headers.get('cross-origin-opener-policy')).toBe(COOP_HEADER);
      expect(apiRes.headers.get('content-security-policy')).toBe(API_SECURITY_CSP);
      expect(apiRes.headers.get('cache-control')).toContain('no-store');

      // 3. HTML Admin Portal (/admin) uses tightened ADMIN_HTML_CSP (no unsafe-inline in default-src)
      const adminHtmlRes = await fetch(`${gwBase}/admin`);
      expect(adminHtmlRes.status).toBe(200);
      const adminCsp = adminHtmlRes.headers.get('content-security-policy') || '';
      expect(adminCsp).toBe(ADMIN_HTML_CSP);
      expect(adminCsp).not.toContain("default-src 'self' 'unsafe-inline'");
      expect(adminCsp).toContain("object-src 'none'");
      expect(adminCsp).toContain("frame-ancestors 'none'");
      expect(adminHtmlRes.headers.get('permissions-policy')).toBe(PERMISSIONS_POLICY_HEADER);
      expect(adminHtmlRes.headers.get('cross-origin-opener-policy')).toBe(COOP_HEADER);

      // 4. Download portal HTML (/download) allows Tailwind CDN explicitly in PORTAL_HTML_CSP
      const dlHtmlRes = await fetch(`${gwBase}/download`);
      expect(dlHtmlRes.status).toBe(200);
      expect(dlHtmlRes.headers.get('content-security-policy')).toBe(PORTAL_HTML_CSP);

      // 5. nginx-production.conf contains strict CSP, Permissions-Policy, and COOP directives
      const nginxConf = fs.readFileSync(
        path.join(process.cwd(), '10_CONFIG', 'infrastructure', 'nginx-production.conf'),
        'utf-8'
      );
      expect(nginxConf).toContain('Content-Security-Policy');
      expect(nginxConf).toContain('Permissions-Policy');
      expect(nginxConf).toContain('Cross-Origin-Opener-Policy');
    } finally {
      await app.close();
      closeDatabase();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});



