import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import {
  AUTH_SESSION_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  LEGACY_AUTH_COOKIE_NAME,
  getAuthUserAsync,
} from '../../07_BACKEND/commercial/routes/router-shared.js';
import { resolveRemoteAuthAsync } from '../../07_BACKEND/commercial/routes/remote/remote-shared.js';
import { hashToken } from '../../05_AUTH/central-auth-service.js';
import { clearLocalDistributedStateNamespace } from '../../08_SECURITY/distributed-state-service.js';

interface HttpResponseResult {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  setCookies: string[];
  body: string;
  json: any;
}

function sendHttpRequest(
  port: number,
  method: string,
  reqPath: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<HttpResponseResult> {
  return new Promise((resolve, reject) => {
    const payload =
      options.body === undefined
        ? undefined
        : typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };
    if (payload !== undefined && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          const rawSetCookie = res.headers['set-cookie'];
          const setCookies = Array.isArray(rawSetCookie)
            ? rawSetCookie
            : rawSetCookie
              ? [rawSetCookie]
              : [];
          let parsedJson: any = null;
          try {
            parsedJson = body ? JSON.parse(body) : null;
          } catch {}
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            setCookies,
            body,
            json: parsedJson,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

function extractCookieValue(setCookies: string[], name: string): string | null {
  const prefix = `${name}=`;
  for (const header of setCookies) {
    if (header.startsWith(prefix)) {
      const valuePart = header.slice(prefix.length).split(';')[0];
      return decodeURIComponent(valuePart);
    }
  }
  return null;
}

describe('Phase 4B: HttpOnly Cookie Web Auth Migration', () => {
  let tempDir: string;
  let server: http.Server;
  let port: number;
  const origWebsiteUrl = process.env.MAHI_WEBSITE_URL;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase4b-auth-'));
    setCustomDatabasePath(path.join(tempDir, 'test.sqlite'));
    await initializeDatabase();
    process.env.MAHI_WEBSITE_URL = 'https://mahibrowser.com';

    server = http.createServer(async (req, res) => {
      try {
        const handled = await handleCommercialAPIRequest(req, res);
        if (!handled && !res.headersSent) {
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
        port = addr.port;
        resolve();
      });
    });
  });

  afterEach(() => {
    clearLocalDistributedStateNamespace('auth_rate_limit');
    clearLocalDistributedStateNamespace('login_attempts');
  });

  afterAll(async () => {
    if (origWebsiteUrl === undefined) {
      delete process.env.MAHI_WEBSITE_URL;
    } else {
      process.env.MAHI_WEBSITE_URL = origWebsiteUrl;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('issues HttpOnly SameSite=Lax cookies on register/login (dev localhost vs prod HTTPS domain) without leaking into URLs', async () => {
    const email = `phase4b_${Date.now()}@mahibrowser.com`;
    const password = 'Str0ng!Password123';

    // 1. Register on localhost dev (no Secure / no Domain=.mahibrowser.com)
    const regRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/register', {
      headers: {
        Host: 'localhost:32123',
      },
      body: {
        email,
        password,
        name: 'Phase 4B User',
        intent: 'trial',
        acceptedTerms: true,
        termsVersion: '2026-03-01',
      },
    });

    expect(regRes.statusCode).toBe(201);
    expect(regRes.json?.success).toBe(true);

    const regSessionCookieHeader = regRes.setCookies.find((c) => c.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`));
    const regRefreshCookieHeader = regRes.setCookies.find((c) => c.startsWith(`${AUTH_REFRESH_COOKIE_NAME}=`));
    const regLegacyClearHeader = regRes.setCookies.find((c) => c.startsWith(`${LEGACY_AUTH_COOKIE_NAME}=`));

    expect(regSessionCookieHeader).toBeTruthy();
    expect(regSessionCookieHeader).toContain('HttpOnly');
    expect(regSessionCookieHeader).toContain('SameSite=Lax');
    expect(regSessionCookieHeader).toContain('Path=/');
    expect(regSessionCookieHeader).not.toContain('Secure');
    expect(regSessionCookieHeader).not.toContain('Domain=.mahibrowser.com');

    expect(regRefreshCookieHeader).toBeTruthy();
    expect(regRefreshCookieHeader).toContain('HttpOnly');
    expect(regRefreshCookieHeader).toContain('Path=/api/v1/auth');

    expect(regLegacyClearHeader).toContain('Max-Age=0');

    // 2. Login on production HTTPS api.mahibrowser.com (enforces Secure + Domain=.mahibrowser.com)
    const prodLoginRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/login', {
      headers: {
        Host: 'api.mahibrowser.com',
        'X-Forwarded-Proto': 'https',
      },
      body: {
        email,
        password,
      },
    });

    expect(prodLoginRes.statusCode).toBe(200);
    const prodSessionHeader = prodLoginRes.setCookies.find((c) => c.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`));
    const prodRefreshHeader = prodLoginRes.setCookies.find((c) => c.startsWith(`${AUTH_REFRESH_COOKIE_NAME}=`));

    expect(prodSessionHeader).toContain('HttpOnly');
    expect(prodSessionHeader).toContain('SameSite=Lax');
    expect(prodSessionHeader).toContain('Domain=.mahibrowser.com');
    expect(prodSessionHeader).toContain('Secure');

    expect(prodRefreshHeader).toContain('HttpOnly');
    expect(prodRefreshHeader).toContain('Domain=.mahibrowser.com');
    expect(prodRefreshHeader).toContain('Secure');
  });

  it('authenticates getAuthUserAsync, resolveRemoteAuthAsync, /web-handoff, and /refresh via HttpOnly cookies while still supporting Bearer tokens and immediate revocation', async () => {
    const email = `phase4b_auth_${Date.now()}@mahibrowser.com`;
    const password = 'Str0ng!Password123';

    const regRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/register', {
      headers: { Host: 'localhost:32123' },
      body: {
        email,
        password,
        name: 'Cookie Auth User',
        intent: 'trial',
        acceptedTerms: true,
        termsVersion: '2026-03-01',
      },
    });

    expect(regRes.statusCode).toBe(201);
    const accessCookie = extractCookieValue(regRes.setCookies, AUTH_SESSION_COOKIE_NAME);
    const refreshCookie = extractCookieValue(regRes.setCookies, AUTH_REFRESH_COOKIE_NAME);
    expect(accessCookie).toBeTruthy();
    expect(refreshCookie).toBeTruthy();

    // Direct auth resolution with Cookie only
    const cookieReq = {
      headers: {
        cookie: `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(accessCookie!)}`,
      },
    } as unknown as http.IncomingMessage;

    const commercialAuth = await getAuthUserAsync(cookieReq);
    expect(commercialAuth).not.toBeNull();
    expect(commercialAuth?.email).toBe(email);
    expect(commercialAuth?.sessionId).toBeTruthy();

    // Remote API requires verified ACTIVE account status; verify email then resolve via HttpOnly cookie
    const db = getDatabase();
    db.prepare(`UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE email = ?`).run(email);

    const remoteAuth = await resolveRemoteAuthAsync(cookieReq);
    expect(remoteAuth).not.toBeNull();
    expect(remoteAuth?.authType).toBe('JWT');
    expect(remoteAuth?.email).toBe(email);

    // Bearer header continues to work for Electron desktop clients
    const bearerReq = {
      headers: {
        authorization: `Bearer ${accessCookie!}`,
      },
    } as unknown as http.IncomingMessage;
    const bearerAuth = await getAuthUserAsync(bearerReq);
    expect(bearerAuth?.email).toBe(email);

    // Web-handoff endpoint works with HttpOnly cookie alone
    const handoffRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/web-handoff', {
      headers: {
        Host: 'localhost:32123',
        Cookie: `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(accessCookie!)}`,
      },
      body: {
        client: 'nextjs-web-portal',
      },
    });
    expect(handoffRes.statusCode).toBe(200);
    expect(handoffRes.json?.success).toBe(true);
    expect(handoffRes.json?.handoffCode).toMatch(/^mb_web_/);

    // Refresh endpoint accepts {} when HttpOnly mahi_refresh cookie is present and rotates session cookies
    const refreshRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/refresh', {
      headers: {
        Host: 'api.mahibrowser.com',
        'X-Forwarded-Proto': 'https',
        Cookie: `${AUTH_REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshCookie!)}`,
      },
      body: {},
    });
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.json?.success).toBe(true);
    const rotatedAccessCookie = extractCookieValue(refreshRes.setCookies, AUTH_SESSION_COOKIE_NAME);
    const rotatedRefreshCookie = extractCookieValue(refreshRes.setCookies, AUTH_REFRESH_COOKIE_NAME);
    expect(rotatedAccessCookie).toBeTruthy();
    expect(rotatedRefreshCookie).toBeTruthy();

    // Logout revokes the DB session and emits Max-Age=0 headers to clear cookies
    const logoutRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/logout', {
      headers: {
        Host: 'api.mahibrowser.com',
        'X-Forwarded-Proto': 'https',
        Cookie: `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(rotatedAccessCookie!)}; ${AUTH_REFRESH_COOKIE_NAME}=${encodeURIComponent(rotatedRefreshCookie!)}`,
      },
      body: {},
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json?.success).toBe(true);

    const clearedSession = logoutRes.setCookies.find(
      (c) => c.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`) && c.includes('Max-Age=0')
    );
    const clearedRefresh = logoutRes.setCookies.find(
      (c) => c.startsWith(`${AUTH_REFRESH_COOKIE_NAME}=`) && c.includes('Max-Age=0')
    );
    expect(clearedSession).toBeTruthy();
    expect(clearedRefresh).toBeTruthy();

    // Revoked session cookie is rejected immediately by both getAuthUserAsync and resolveRemoteAuthAsync
    const revokedCookieReq = {
      headers: {
        cookie: `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(rotatedAccessCookie!)}`,
      },
    } as unknown as http.IncomingMessage;
    expect(await getAuthUserAsync(revokedCookieReq)).toBeNull();
    expect(await resolveRemoteAuthAsync(revokedCookieReq)).toBeNull();
  });

  it('revokes session when logging out with only mahi_refresh cookie (expired access token fallback)', async () => {
    const email = `phase4b_refresh_logout_${Date.now()}@mahibrowser.com`;
    const regRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/register', {
      headers: { Host: 'localhost:32123' },
      body: {
        email,
        password: 'Str0ng!Password123',
        name: 'Refresh Logout User',
        intent: 'trial',
        acceptedTerms: true,
        termsVersion: '2026-03-01',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const refreshCookie = extractCookieValue(regRes.setCookies, AUTH_REFRESH_COOKIE_NAME);
    expect(refreshCookie).toBeTruthy();

    // Simulate expired/missing mahi_session by sending only mahi_refresh cookie
    const logoutRes = await sendHttpRequest(port, 'POST', '/api/v1/auth/logout', {
      headers: {
        Host: 'localhost:32123',
        Cookie: `${AUTH_REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshCookie!)}`,
      },
      body: {},
    });
    expect(logoutRes.statusCode).toBe(200);

    const db = getDatabase();
    const sessionRow = db
      .prepare('SELECT is_revoked FROM auth_sessions WHERE refresh_token_hash = ?')
      .get(hashToken(refreshCookie!)) as any;
    expect(sessionRow?.is_revoked).toBe(1);
  });

  it('Google OAuth callback sets HttpOnly session cookies and never leaks token= or #token= in redirect Location', async () => {
    const db = getDatabase();
    const state = `phase4b_oauth_state_${Date.now()}`;
    const expiresAtIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const createdAtIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO oauth_states (
        state, nonce, provider, intent, plan_id, billing_cycle, return_url, expires_at, created_at, accepted_terms, terms_version
      ) VALUES (?, 'nonce_phase4b', 'google', 'trial', 'free', 'annual', '/download', ?, ?, 1, '2026-03-01')
    `).run(state, expiresAtIso, createdAtIso);

    const callbackRes = await sendHttpRequest(
      port,
      'GET',
      `/api/v1/auth/google/callback?code=mock_code_phase4b&state=${encodeURIComponent(state)}`,
      {
        headers: {
          Host: 'api.mahibrowser.com',
          'X-Forwarded-Proto': 'https',
        },
      }
    );

    expect(callbackRes.statusCode).toBe(302);
    const location = String(callbackRes.headers.location || '');
    expect(location).toBe('https://mahibrowser.com/download?login=success');
    expect(location).not.toContain('token=');
    expect(location).not.toContain('#token=');
    expect(location).not.toContain('eyJ');

    const sessionHeader = callbackRes.setCookies.find((c) => c.startsWith(`${AUTH_SESSION_COOKIE_NAME}=`));
    expect(sessionHeader).toBeTruthy();
    expect(sessionHeader).toContain('HttpOnly');
    expect(sessionHeader).toContain('SameSite=Lax');
    expect(sessionHeader).toContain('Domain=.mahibrowser.com');
    expect(sessionHeader).toContain('Secure');

    const tokenFromCookie = extractCookieValue(callbackRes.setCookies, AUTH_SESSION_COOKIE_NAME);
    expect(tokenFromCookie).toBeTruthy();
    expect(location).not.toContain(tokenFromCookie!);
  });

  it('frontend web portal and WebAuthStore no longer persist JWTs into localStorage or sessionStorage', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const filesToCheck = [
      'landing/app/login/page.tsx',
      'landing/app/signup/page.tsx',
      'landing/components/PricingView.tsx',
      'landing/components/DownloadButtons.tsx',
      '01_UI/web/state/useWebAuthStore.ts',
    ];

    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
      expect(content).not.toMatch(/localStorage\.setItem\(['"]mahi_/);
      expect(content).not.toMatch(/sessionStorage\.setItem\(['"]mahi_/);
      expect(content).not.toContain('#token=');
    }

    for (const fetchFile of filesToCheck.slice(0, 4)) {
      const content = fs.readFileSync(path.join(repoRoot, fetchFile), 'utf8');
      expect(content).toContain("credentials: 'include'");
    }
  });
});
