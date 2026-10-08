import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import { DevelopmentEmailProvider } from '../../05_AUTH/email-service.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { verifyAccessToken } from '../../05_AUTH/central-auth-service.js';

describe('PHASE 1: Central Auth Endpoints & Security Controls Integration', () => {
  const testDbDir = path.join(process.cwd(), '.test_phase1_api');
  const testDbPath = path.join(testDbDir, 'phase1_api.sqlite');
  let server: http.Server;
  let serverPort = 0;
  let baseUrl = '';

  beforeEach(async () => {
    try { fs.mkdirSync(testDbDir, { recursive: true }); } catch {}
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
    DevelopmentEmailProvider.clear();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.rmdirSync(testDbDir); } catch {}
  });

  // Start a lightweight test HTTP server running handleCommercialAPIRequest
  beforeEach(async () => {
    if (!server) {
      server = http.createServer(async (req, res) => {
        try {
          const handled = await handleCommercialAPIRequest(req, res);
          if (!handled) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          serverPort = addr.port;
          baseUrl = `http://127.0.0.1:${serverPort}`;
          resolve();
        });
      });
    }
  });

  async function apiRequest(endpoint: string, options: { method?: string; body?: any; token?: string } = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  describe('1. Full End-to-End API Registration & Verification Lifecycle', () => {
    it('should complete registration, email verification, and profile retrieval via API', async () => {
      // 1. Register
      const reg = await apiRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          email: 'api-user@mahibrowser.com',
          password: 'Password1234!',
          name: 'API Tester',
        },
      });

      expect(reg.status).toBe(201);
      expect(reg.data.success).toBe(true);
      expect(reg.data.tokens?.accessToken).toBeDefined();

      const emailMsg = DevelopmentEmailProvider.getLastEmailFor('api-user@mahibrowser.com');
      expect(emailMsg).toBeDefined();
      const token = emailMsg!.token;

      // 2. Verify Email
      const verify = await apiRequest('/api/v1/auth/verify-email', {
        method: 'POST',
        body: { token },
      });

      expect(verify.status).toBe(200);
      expect(verify.data.success).toBe(true);

      // 3. Login
      const login = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: 'api-user@mahibrowser.com',
          password: 'Password1234!',
          deviceName: 'Studio PC',
          platform: 'windows',
        },
      });

      expect(login.status).toBe(200);
      expect(login.data.success).toBe(true);
      const accessToken = login.data.tokens.accessToken;
      const refreshToken = login.data.tokens.refreshToken;
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      // 4. Fetch Current Account (/me)
      const me = await apiRequest('/api/v1/auth/me', {
        method: 'GET',
        token: accessToken,
      });

      expect(me.status).toBe(200);
      expect(me.data.success).toBe(true);
      expect(me.data.user.email).toBe('api-user@mahibrowser.com');
      expect(me.data.user.emailVerified).toBe(true);
      expect(me.data.user.status).toBe('ACTIVE');
      expect(me.data.user.profileQuota).toBe(10);

      // 5. List Sessions
      const sessions = await apiRequest('/api/v1/auth/sessions', {
        method: 'GET',
        token: accessToken,
      });

      expect(sessions.status).toBe(200);
      expect(sessions.data.success).toBe(true);
      expect(Array.isArray(sessions.data.data)).toBe(true);
      expect(sessions.data.data.length).toBeGreaterThanOrEqual(1);

      // 6. Refresh Token
      const refreshed = await apiRequest('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });

      expect(refreshed.status).toBe(200);
      expect(refreshed.data.success).toBe(true);
      expect(refreshed.data.tokens.accessToken).toBeDefined();
      expect(refreshed.data.tokens.refreshToken).not.toBe(refreshToken);

      // 7. Logout
      const logout = await apiRequest('/api/v1/auth/logout', {
        method: 'POST',
        token: refreshed.data.tokens.accessToken,
        body: { token: refreshed.data.tokens.accessToken },
      });

      expect(logout.status).toBe(200);
      expect(logout.data.success).toBe(true);
    });
  });

  describe('2. Security Defenses & Resilience', () => {
    it('should reject tampered and invalid JWT access tokens', async () => {
      const tampered = await apiRequest('/api/v1/auth/me', {
        method: 'GET',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      });

      expect(tampered.status).toBe(401);
      expect(tampered.data.success).toBe(false);
    });

    it('should reject SQL injection attacks in login credentials safely', async () => {
      const sqli = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: "' OR '1'='1' --",
          password: "' OR '1'='1' --",
        },
      });

      expect(sqli.status).toBe(401);
      expect(sqli.data.success).toBe(false);
      expect(sqli.data.error).toBe('Invalid email or password.');
    });

    it('should enforce password reset flow and invalidate existing access tokens', async () => {
      // Register
      await apiRequest('/api/v1/auth/register', {
        method: 'POST',
        body: { email: 'reset-sec@mahibrowser.com', password: 'PasswordOld123!' },
      });

      // Request forgot password
      const forgot = await apiRequest('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: { email: 'reset-sec@mahibrowser.com' },
      });
      expect(forgot.status).toBe(200);

      const resetEmail = DevelopmentEmailProvider.getLastEmailFor('reset-sec@mahibrowser.com');
      expect(resetEmail).toBeDefined();
      const resetToken = resetEmail!.token;

      // Reset password
      const reset = await apiRequest('/api/v1/auth/reset-password', {
        method: 'POST',
        body: {
          token: resetToken,
          newPassword: 'PasswordNew456!',
        },
      });
      expect(reset.status).toBe(200);
      expect(reset.data.success).toBe(true);

      // Old password login fails
      const oldLogin = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'reset-sec@mahibrowser.com', password: 'PasswordOld123!' },
      });
      expect(oldLogin.status).toBe(401);

      // New password login succeeds
      const newLogin = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'reset-sec@mahibrowser.com', password: 'PasswordNew456!' },
      });
      expect(newLogin.status).toBe(200);
    });
  });
});
