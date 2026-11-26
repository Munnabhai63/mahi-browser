import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { URL } from 'node:url';

import {
  setCustomDatabasePath,
  getDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  resolveTrustedClientIp,
  readBoundedBuffer,
  readBoundedText,
  parseBoundedJson,
  PayloadTooLargeError,
  RequestTimeoutError,
  redactSensitiveTokens,
  constantTimeEqualStrings,
} from '../../07_BACKEND/utils/http-security.js';
import {
  parseBody,
  parseRawBuffer,
  signAccountStatus,
  checkAuthRateLimit,
  resetAuthRateLimitForTesting,
} from '../../07_BACKEND/commercial/routes/router-shared.js';
import { handleCommercialApiRoutes } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { handleAuthRoutes } from '../../07_BACKEND/commercial/routes/auth-routes.js';
import {
  handleRemoteApiRoutes,
  parseBody as parseRemoteBody,
  parseRawBody as parseRemoteRawBody,
} from '../../07_BACKEND/commercial/remote-api-router.js';
import { synchronizerHub } from '../../09_AUTOMATION/sync-hub.js';
import {
  getJwtSecret,
  getMasterAdminSecret,
  validateProductionSecrets,
  resetCachedSecretsForTesting,
} from '../../08_SECURITY/install-secrets.js';
import { hashPin, verifyPin, resetCachedMasterKeyForTesting } from '../../08_SECURITY/encryption.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { createCentralApiServer } from '../../07_BACKEND/server/app.js';
import { createLocalApiServer } from '../../07_BACKEND/api/local-api-server.js';

function createMockReq(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  remoteAddress?: string;
  body?: unknown;
  rawBuffer?: Buffer;
} = {}): http.IncomingMessage {
  const emitter = new EventEmitter() as any;
  emitter.method = options.method || 'GET';
  emitter.url = options.url || '/';
  emitter.headers = options.headers || {};
  emitter.socket = { remoteAddress: options.remoteAddress || '198.51.100.10' };
  if (options.body !== undefined) emitter.body = options.body;
  if (options.rawBuffer !== undefined) emitter.rawBuffer = options.rawBuffer;
  emitter.readableEnded = options.body !== undefined || options.rawBuffer !== undefined;
  return emitter as http.IncomingMessage;
}

function createMockRes() {
  const emitter = new EventEmitter() as any;
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = '';

  emitter.setHeader = (k: string, v: string) => {
    headers[k.toLowerCase()] = String(v);
  };
  emitter.getHeader = (k: string) => headers[k.toLowerCase()];
  emitter.writeHead = (code: number, hdrs?: Record<string, string>) => {
    statusCode = code;
    if (hdrs) {
      for (const [k, v] of Object.entries(hdrs)) {
        headers[k.toLowerCase()] = String(v);
      }
    }
    return emitter;
  };
  emitter.write = (chunk: string | Buffer) => {
    body += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    return true;
  };
  emitter.end = (chunk?: string | Buffer) => {
    if (chunk) emitter.write(chunk);
    return emitter;
  };
  return {
    res: emitter as http.ServerResponse,
    getResult: () => ({ statusCode, headers, body }),
  };
}

describe('Phase 1B Security Hardening (Rate Limits, CORS, Body Limits, Secrets & Token Redaction)', () => {
  const rootTemp = path.join(os.tmpdir(), `mahi-phase1b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const userDataDir = path.join(rootTemp, 'userData');
  const prevEnv = { ...process.env };

  beforeAll(async () => {
    fs.mkdirSync(userDataDir, { recursive: true });
    process.env.MAHI_USER_DATA_DIR = userDataDir;
    resetCachedMasterKeyForTesting();
    resetCachedSecretsForTesting();
    resetAuthRateLimitForTesting();
    setCustomDatabasePath(path.join(rootTemp, 'phase1b.sqlite'));
    await initializeDatabase();
  });

  afterEach(() => {
    resetAuthRateLimitForTesting();
    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY_IPS;
    process.env.NODE_ENV = prevEnv.NODE_ENV || 'test';
    if (prevEnv.JWT_SECRET !== undefined) process.env.JWT_SECRET = prevEnv.JWT_SECRET;
    else delete process.env.JWT_SECRET;
    if (prevEnv.ADMIN_BOOTSTRAP_TOKEN !== undefined) process.env.ADMIN_BOOTSTRAP_TOKEN = prevEnv.ADMIN_BOOTSTRAP_TOKEN;
    else delete process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (prevEnv.MAHI_STATUS_PRIVATE_KEY !== undefined) process.env.MAHI_STATUS_PRIVATE_KEY = prevEnv.MAHI_STATUS_PRIVATE_KEY;
    else delete process.env.MAHI_STATUS_PRIVATE_KEY;
  });

  afterAll(() => {
    process.env = { ...prevEnv };
    resetCachedMasterKeyForTesting();
    resetCachedSecretsForTesting();
    try {
      fs.rmSync(rootTemp, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Trusted-Proxy Client IP & Auth Rate-Limit Spoofing Prevention', () => {
    it('ignores X-Forwarded-For spoofing by default and rate-limits real socket peer across commercial router', async () => {
      for (let i = 0; i < 10; i++) {
        const req = createMockReq({
          method: 'POST',
          url: '/api/v1/auth/login',
          remoteAddress: '198.51.100.77',
          headers: {
            'x-forwarded-for': `203.0.113.${i + 1}`,
            'content-type': 'application/json',
          },
          body: { email: `nobody-${i}@example.com`, password: 'wrong-password' },
        });
        const { res, getResult } = createMockRes();
        await handleCommercialApiRoutes(req, res, '/api/v1/auth/login', 'POST', new URL('http://127.0.0.1/api/v1/auth/login'));
        expect(getResult().statusCode).not.toBe(429);
      }

      // 11th request from same peer IP with ANOTHER forged X-Forwarded-For must be rate-limited (429)
      const blockedReq = createMockReq({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: '198.51.100.77',
        headers: {
          'x-forwarded-for': '8.8.8.8',
          'content-type': 'application/json',
        },
        body: { email: 'nobody-11@example.com', password: 'wrong-password' },
      });
      const { res, getResult } = createMockRes();
      await handleCommercialApiRoutes(blockedReq, res, '/api/v1/auth/login', 'POST', new URL('http://127.0.0.1/api/v1/auth/login'));
      expect(getResult().statusCode).toBe(429);
    });

    it('resolves forwarded client IP only when TRUSTED_PROXY_IPS or TRUST_PROXY is explicitly configured', () => {
      const spoofedReq = createMockReq({
        remoteAddress: '198.51.100.5',
        headers: { 'x-forwarded-for': '203.0.113.99' },
      });
      expect(resolveTrustedClientIp(spoofedReq)).toBe('198.51.100.5');

      // TRUSTED_PROXY_IPS only trusts configured proxy socket peer
      process.env.TRUSTED_PROXY_IPS = '10.0.0.2';
      expect(resolveTrustedClientIp(spoofedReq)).toBe('198.51.100.5');

      const proxiedReq = createMockReq({
        remoteAddress: '::ffff:10.0.0.2',
        headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.44' },
      });
      expect(resolveTrustedClientIp(proxiedReq)).toBe('203.0.113.44');

      // TRUST_PROXY=1 takes rightmost non-spoofable entry
      delete process.env.TRUSTED_PROXY_IPS;
      process.env.TRUST_PROXY = 'true';
      expect(resolveTrustedClientIp(proxiedReq)).toBe('203.0.113.44');

      // Non-IP header garbage is rejected in favor of socket IP
      const invalidHeaderReq = createMockReq({
        remoteAddress: '198.51.100.20',
        headers: { 'x-forwarded-for': 'not-an-ip-address' },
      });
      expect(resolveTrustedClientIp(invalidHeaderReq)).toBe('198.51.100.20');
    });

    it('normalizes IPv4-mapped IPv6 keys in checkAuthRateLimit', () => {
      for (let i = 0; i < 10; i++) {
        expect(checkAuthRateLimit('::ffff:192.0.2.10', 'login').allowed).toBe(true);
      }
      expect(checkAuthRateLimit('192.0.2.10', 'login').allowed).toBe(false);
    });
  });

  describe('2. Strict Origin CORS Enforcement (remote-api-router, auth-routes, sync-hub)', () => {
    it('blocks untrusted origins and avoids wildcard * on remote-api-router OPTIONS & desktop-success', async () => {
      // Untrusted OPTIONS on remote-api-router directly
      const badOptReq = createMockReq({
        method: 'OPTIONS',
        url: '/api/v1/remote/profiles',
        headers: { origin: 'https://evil-attacker.com' },
      });
      const badOptRes = createMockRes();
      await handleRemoteApiRoutes(
        badOptReq,
        badOptRes.res,
        '/api/v1/remote/profiles',
        'OPTIONS',
        new URL('http://127.0.0.1/api/v1/remote/profiles')
      );
      expect(badOptRes.getResult().statusCode).toBe(403);
      expect(badOptRes.getResult().headers['access-control-allow-origin']).toBeUndefined();

      // Trusted OPTIONS reflects exact origin instead of '*'
      const goodOptReq = createMockReq({
        method: 'OPTIONS',
        url: '/api/v1/remote/profiles',
        headers: { origin: 'https://mahibrowser.com' },
      });
      const goodOptRes = createMockRes();
      await handleRemoteApiRoutes(
        goodOptReq,
        goodOptRes.res,
        '/api/v1/remote/profiles',
        'OPTIONS',
        new URL('http://127.0.0.1/api/v1/remote/profiles')
      );
      expect(goodOptRes.getResult().statusCode).toBe(204);
      expect(goodOptRes.getResult().headers['access-control-allow-origin']).toBe('https://mahibrowser.com');

      // auth-routes desktop-success & google/start never emit Access-Control-Allow-Origin: *
      const desktopReq = createMockReq({
        method: 'GET',
        url: '/auth/desktop-success?email=u@test.com',
        headers: { origin: 'https://evil-attacker.com' },
      });
      const desktopRes = createMockRes();
      await handleAuthRoutes(
        desktopReq,
        desktopRes.res,
        '/auth/desktop-success',
        'GET',
        new URL('http://127.0.0.1/auth/desktop-success?email=u@test.com'),
        '/auth/desktop-success',
        '198.51.100.1'
      );
      expect(desktopRes.getResult().statusCode).toBe(200);
      expect(desktopRes.getResult().headers['access-control-allow-origin']).toBeUndefined();

      const googleStartReq = createMockReq({
        method: 'GET',
        url: '/api/v1/auth/google/start',
        headers: { origin: 'https://evil-attacker.com' },
      });
      const googleStartRes = createMockRes();
      await handleCommercialApiRoutes(
        googleStartReq,
        googleStartRes.res,
        '/api/v1/auth/google/start',
        'GET',
        new URL('http://127.0.0.1/api/v1/auth/google/start')
      );
      expect(googleStartRes.getResult().statusCode).toBe(302);
      expect(googleStartRes.getResult().headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects untrusted origins and validates trusted origins in sync-hub SSE registerClient', () => {
      const evilMock = createMockRes();
      synchronizerHub.registerClient('p-evil', evilMock.res, 'https://evil.example.org');
      try {
        expect(evilMock.getResult().headers['access-control-allow-origin']).toBeUndefined();
        expect(evilMock.getResult().headers['access-control-allow-headers']).toBeUndefined();
      } finally {
        (evilMock.res as any).emit('close');
      }

      const trustedMock = createMockRes();
      synchronizerHub.registerClient('p-good', trustedMock.res, 'http://localhost:5173');
      try {
        expect(trustedMock.getResult().headers['access-control-allow-origin']).toBe('http://localhost:5173');
        expect(trustedMock.getResult().headers['access-control-allow-credentials']).toBe('true');
      } finally {
        (trustedMock.res as any).emit('close');
      }
    });
  });

  describe('3. Bounded Body Parsing & Timeout Protection', () => {
    it('rejects oversized chunked payloads with PayloadTooLargeError (413) across shared parsers', async () => {
      const makeStreamReq = (chunks: Buffer[], headers: Record<string, string> = {}) => {
        const req = new EventEmitter() as any;
        req.headers = headers;
        queueMicrotask(() => {
          for (const c of chunks) req.emit('data', c);
          req.emit('end');
        });
        return req as http.IncomingMessage;
      };

      const bigChunk = Buffer.alloc(1024, 'a');
      await expect(
        readBoundedBuffer(makeStreamReq([bigChunk, bigChunk]), { maxBytes: 1500 })
      ).rejects.toBeInstanceOf(PayloadTooLargeError);

      await expect(
        readBoundedText(makeStreamReq([Buffer.from('{"a":"' + 'x'.repeat(2500) + '"}')]), { maxBytes: 1024 })
      ).rejects.toBeInstanceOf(PayloadTooLargeError);

      await expect(
        parseBoundedJson(makeStreamReq([Buffer.from('{"k":"' + 'x'.repeat(2000) + '"}')]), { maxBytes: 512 })
      ).rejects.toBeInstanceOf(PayloadTooLargeError);

      await expect(
        parseBody(makeStreamReq([Buffer.alloc(3000, 'b')]), { maxBytes: 1024 })
      ).rejects.toMatchObject({ statusCode: 413 });

      await expect(
        parseRawBuffer(makeStreamReq([Buffer.alloc(3000, 'c')]), { maxBytes: 1024 })
      ).rejects.toMatchObject({ statusCode: 413 });

      await expect(
        parseRemoteBody(makeStreamReq([Buffer.alloc(3000, 'd')]), { maxBytes: 1024 })
      ).rejects.toMatchObject({ statusCode: 413 });

      await expect(
        parseRemoteRawBody(makeStreamReq([Buffer.alloc(3000, 'e')]), { maxBytes: 1024 })
      ).rejects.toMatchObject({ statusCode: 413 });
    });

    it('rejects stalled streams with RequestTimeoutError (408)', async () => {
      const stalledReq = new EventEmitter() as any;
      stalledReq.headers = {};
      await expect(
        readBoundedBuffer(stalledReq as http.IncomingMessage, { timeoutMs: 25 })
      ).rejects.toBeInstanceOf(RequestTimeoutError);
    });

    it('returns HTTP 413 on real Central & Local servers when JSON body exceeds 2 MB cap', async () => {
      const oversizedPayload = JSON.stringify({ pad: 'A'.repeat(2_300_000) });

      for (const server of [createCentralApiServer(), createLocalApiServer()]) {
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
        const addr = server.address() as net.AddressInfo;
        try {
          const res = await fetch(`http://127.0.0.1:${addr.port}/api/v2/profiles`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Secret': getMasterAdminSecret(),
            },
            body: oversizedPayload,
          });
          expect(res.status).toBe(413);
        } finally {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      }
    });
  });

  describe('4. Fail-Fast Production Secrets & Constant-Time Crypto', () => {
    it('fails fast in non-Electron production when JWT_SECRET, ADMIN_BOOTSTRAP_TOKEN, or RSA status key are missing/weak', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      delete process.env.ADMIN_BOOTSTRAP_TOKEN;
      delete process.env.MAHI_MASTER_ADMIN_SECRET;
      delete process.env.MAHI_STATUS_PRIVATE_KEY;
      delete process.env.RSA_PRIVATE_KEY;

      expect(() => getJwtSecret()).toThrow(/JWT_SECRET/i);
      expect(() => getMasterAdminSecret()).toThrow(/ADMIN_BOOTSTRAP_TOKEN/i);
      expect(() => signAccountStatus('test-canonical')).toThrow(/MAHI_STATUS_PRIVATE_KEY/i);
      expect(() => validateProductionSecrets()).toThrow();

      // Weak short secrets are also rejected in production
      process.env.JWT_SECRET = 'short_jwt_secret';
      process.env.ADMIN_BOOTSTRAP_TOKEN = 'short_admin_secret';
      expect(() => getJwtSecret()).toThrow();
      expect(() => getMasterAdminSecret()).toThrow();

      // Valid strong secrets & 2048-bit RSA key pass cleanly
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      process.env.JWT_SECRET = 'prod_jwt_secret_with_sufficient_entropy_123456';
      process.env.ADMIN_BOOTSTRAP_TOKEN = 'prod_admin_bootstrap_token_sufficient_entropy';
      process.env.MAHI_STATUS_PRIVATE_KEY = privateKey;

      expect(() => validateProductionSecrets()).not.toThrow();
      expect(getJwtSecret()).toBe(process.env.JWT_SECRET);
      expect(getMasterAdminSecret()).toBe(process.env.ADMIN_BOOTSTRAP_TOKEN);
      expect(signAccountStatus('canonical-account-status').length).toBeGreaterThan(20);
    });

    it('verifyPin returns false safely on malformed or mismatched-length storedHash without throwing', () => {
      const { hash, salt } = hashPin('4242');
      expect(verifyPin('4242', hash, salt)).toBe(true);
      expect(verifyPin('4242', 'abcd', salt)).toBe(false);
      expect(verifyPin('4242', 'not-hex-xyz', salt)).toBe(false);
      expect(verifyPin('4242', '', salt)).toBe(false);
    });

    it('constantTimeEqualStrings and verifyAdminAccess handle legacy PIN comparison without ===', () => {
      expect(constantTimeEqualStrings('alpha-123', 'alpha-123')).toBe(true);
      expect(constantTimeEqualStrings('alpha-123', 'alpha-124')).toBe(false);
      expect(constantTimeEqualStrings('short', 'much-longer-string')).toBe(false);

      const db = getDatabase();
      const now = new Date().toISOString();
      db.prepare('INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)').run(
        'owner_pin',
        JSON.stringify({ pinHash: '998877' }),
        now
      );
      expect(verifyAdminAccess('000000')).toBe(false);
      expect(verifyAdminAccess('998877')).toBe(true);
    });
  });

  describe('5. Sensitive Token Redaction & Redirect Query-Param Removal', () => {
    it('redacts deep-link ?handoff=, ?code=, ?token=, Bearer tokens, and raw JWTs', () => {
      const raw =
        'DeepLink mahibrowser://auth-callback?handoff=hf_12345&code=oauth_67890&token=tok_abc Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYSJ9.c2lnbmF0dXJlMTIzNDU';
      const redacted = redactSensitiveTokens(raw);
      expect(redacted).not.toContain('hf_12345');
      expect(redacted).not.toContain('oauth_67890');
      expect(redacted).not.toContain('tok_abc');
      expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(redacted).toContain('handoff=[REDACTED]');
      expect(redacted).toContain('code=[REDACTED]');
      expect(redacted).toContain('token=[REDACTED]');
      expect(redacted).toContain('Bearer [REDACTED]');
    });

    it('removes ?token= from login/signup redirects and applies redaction in deep links & diagnostics', () => {
      const loginSrc = fs.readFileSync(path.resolve(process.cwd(), 'landing/app/login/page.tsx'), 'utf8');
      const signupSrc = fs.readFileSync(path.resolve(process.cwd(), 'landing/app/signup/page.tsx'), 'utf8');
      const indexSrc = fs.readFileSync(path.resolve(process.cwd(), '07_BACKEND/index.ts'), 'utf8');
      const handlersSrc = fs.readFileSync(path.resolve(process.cwd(), '07_BACKEND/ipc/register-handlers.ts'), 'utf8');

      expect(loginSrc).not.toContain('/overview?token=');
      expect(signupSrc).not.toContain('/download?token=');
      expect(indexSrc).toContain('redactSensitiveTokens(urlStr)');
      expect(handlersSrc).toContain('redactSensitiveTokens(');
    });
  });
});
