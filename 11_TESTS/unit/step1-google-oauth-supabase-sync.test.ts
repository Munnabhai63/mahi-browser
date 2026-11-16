import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { setPrismaClientForTest } from '../../06_DATABASE/prisma-client.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import { getCentralUserByIdAsync } from '../../05_AUTH/central-auth-service.js';
import {
  authenticateWithGoogleClaimsAsync,
  GoogleClaims,
  deriveProfileQuota,
} from '../../07_BACKEND/commercial/google-oauth-service.js';
import { handleCommercialApiRoutes } from '../../07_BACKEND/commercial/commercial-api-router.js';
import {
  getDatabase,
  initSqlEngine,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';

describe('Step 1: Google OAuth -> Supabase PostgreSQL Sync & Error Redirect', () => {
  const tempDir = path.resolve('.mahi_data', 'test-step1-oauth-sync');
  const dbPath = path.join(tempDir, 'step1_oauth_sync.sqlite');

  let authUsersMap: Map<string, any>;
  let mockPrisma: any;
  const originalEnvWebsite = process.env.MAHI_WEBSITE_URL;

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    setCustomDatabasePath(dbPath);
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  beforeEach(() => {
    authUsersMap = new Map();
    mockPrisma = {
      auth_users: {
        findFirst: async ({ where }: any) => {
          for (const u of authUsersMap.values()) {
            if (where?.OR) {
              for (const cond of where.OR) {
                if (cond.email && u.email === cond.email) return u;
                if (cond.normalized_email && u.normalized_email === cond.normalized_email) return u;
              }
            }
            if (where?.email && u.email === where.email) return u;
            if (where?.normalized_email && u.normalized_email === where.normalized_email) return u;
          }
          return null;
        },
        findUnique: async ({ where }: any) => {
          return authUsersMap.get(where.id) || null;
        },
        create: async ({ data }: any) => {
          authUsersMap.set(data.id, { ...data });
          return data;
        },
        update: async ({ where, data }: any) => {
          const existing = authUsersMap.get(where.id);
          if (!existing) throw new Error(`User not found: ${where.id}`);
          const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
          authUsersMap.set(where.id, updated);
          return updated;
        },
      },
      $queryRaw: async () => [{ '?column?': 1 }],
    };

    setPrismaClientForTest(mockPrisma);
  });

  afterEach(() => {
    setPrismaClientForTest(null);
    if (originalEnvWebsite !== undefined) {
      process.env.MAHI_WEBSITE_URL = originalEnvWebsite;
    } else {
      delete process.env.MAHI_WEBSITE_URL;
    }
  });

  it('correctly derives profileQuota from canonical plan', () => {
    expect(deriveProfileQuota('free')).toBe(1);
    expect(deriveProfileQuota('solo_10')).toBe(10);
    expect(deriveProfileQuota('professional_50')).toBe(50);
    expect(deriveProfileQuota('business_growth')).toBe(100);
    expect(deriveProfileQuota('business_enterprise')).toBe(300);
    expect(deriveProfileQuota('custom_500')).toBe(500);
    expect(deriveProfileQuota(undefined)).toBe(10);
  });

  it('a) creates new Google OAuth user in Supabase PostgreSQL auth_users with matching userId and getCentralUserByIdAsync returns ACTIVE user', async () => {
    expect(isPostgresConfigured()).toBe(true);

    const email = `new-google-user-${Date.now()}@example.com`;
    const googleSub = `sub_new_google_${Date.now()}`;
    const claims: GoogleClaims = {
      sub: googleSub,
      email,
      email_verified: true,
      name: 'Dr. Google User',
      picture: 'https://lh3.googleusercontent.com/a/mock-pic.jpg',
    };

    const res = await authenticateWithGoogleClaimsAsync(claims, {
      planId: 'professional_50',
      intent: 'trial',
      billingCycle: 'annual',
      state: 'mock_state',
      nonce: 'mock_nonce',
      provider: 'google',
      returnUrl: '/download',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      createdAt: new Date().toISOString(),
    });

    expect(res.success).toBe(true);
    expect(res.isNewAccount).toBe(true);
    expect(res.user).toBeDefined();
    expect(res.user.email).toBe(email);
    expect(res.token).toBeDefined();

    const createdUserId = res.user.id;
    expect(createdUserId).toMatch(/^usr_/);

    // Verify user exists in Supabase PostgreSQL mock
    const pgUser = authUsersMap.get(createdUserId);
    expect(pgUser).toBeDefined();
    expect(pgUser.id).toBe(createdUserId);
    expect(pgUser.email).toBe(email);
    expect(pgUser.google_sub).toBe(googleSub);
    expect(pgUser.auth_provider).toBe('GOOGLE');
    expect(pgUser.status).toBe('ACTIVE');
    expect(pgUser.email_verified).toBe(1);
    expect(pgUser.plan_id).toBe('professional_50');
    expect(pgUser.profile_quota).toBe(50);

    // Verify getCentralUserByIdAsync finds the user with ACTIVE status (used by /api/v1/remote/*)
    const centralUser = await getCentralUserByIdAsync(createdUserId);
    expect(centralUser).not.toBeNull();
    expect(centralUser?.id).toBe(createdUserId);
    expect(centralUser?.email).toBe(email);
    expect(centralUser?.status).toBe('ACTIVE');
    expect(centralUser?.planId).toBe('professional_50');

    // Verify SQLite commercial_users and auth_users share the exact same ID
    const db = getDatabase();
    const sqliteCommUser = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(createdUserId) as any;
    expect(sqliteCommUser).toBeDefined();
    expect(sqliteCommUser.email).toBe(email);
    expect(sqliteCommUser.google_sub).toBe(googleSub);

    const sqliteAuthUser = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(createdUserId) as any;
    expect(sqliteAuthUser).toBeDefined();
    expect(sqliteAuthUser.email).toBe(email);
  });

  it('b) links existing email/password Supabase PostgreSQL user logging in with Google OAuth without creating split/mismatched ID', async () => {
    expect(isPostgresConfigured()).toBe(true);

    const existingId = `usr_supabase_preexisting_${Date.now()}`;
    const email = `existing-supa-user-${Date.now()}@work.com`;

    // Pre-seed user in PostgreSQL auth_users (e.g. signed up previously with password)
    authUsersMap.set(existingId, {
      id: existingId,
      email,
      normalized_email: email,
      password_hash: 'argon2_hashed_secret',
      salt: 'salt_supa_123',
      name: 'Existing Supa Member',
      role: 'USER',
      status: 'ACTIVE',
      email_verified: 1,
      email_verified_at: new Date().toISOString(),
      plan_id: 'business_growth',
      profile_quota: 100,
      auth_provider: 'LOCAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    });

    const googleSub = `sub_linked_google_${Date.now()}`;
    const claims: GoogleClaims = {
      sub: googleSub,
      email,
      email_verified: true,
      name: 'Existing Supa Member (via Google)',
      picture: 'https://lh3.googleusercontent.com/a/linked-pic.jpg',
    };

    const res = await authenticateWithGoogleClaimsAsync(claims, null);

    expect(res.success).toBe(true);
    expect(res.isLinked).toBe(true);
    expect(res.isNewAccount).toBe(false);

    // CRITICAL: Must reuse the exact Supabase PostgreSQL ID! No split ID!
    expect(res.user.id).toBe(existingId);

    // Verify PostgreSQL was updated with google_sub and avatar
    const updatedPg = authUsersMap.get(existingId);
    expect(updatedPg).toBeDefined();
    expect(updatedPg.id).toBe(existingId);
    expect(updatedPg.google_sub).toBe(googleSub);
    expect(updatedPg.avatar_url).toBe('https://lh3.googleusercontent.com/a/linked-pic.jpg');
    expect(updatedPg.last_login_at).toBeDefined();

    // Verify getCentralUserByIdAsync returns the exact linked user
    const centralUser = await getCentralUserByIdAsync(existingId);
    expect(centralUser).not.toBeNull();
    expect(centralUser?.id).toBe(existingId);
    expect(centralUser?.email).toBe(email);
    expect(centralUser?.status).toBe('ACTIVE');

    // Verify SQLite commercial_users has matching userId
    const db = getDatabase();
    const sqliteCommUser = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(existingId) as any;
    expect(sqliteCommUser).toBeDefined();
    expect(sqliteCommUser.email).toBe(email);
    expect(sqliteCommUser.google_sub).toBe(googleSub);
  });

  it('c) /api/v1/auth/google/callback error redirects respect MAHI_WEBSITE_URL', async () => {
    process.env.MAHI_WEBSITE_URL = 'https://mahibrowser.com';

    function createMockRes(): { res: http.ServerResponse; getWritten: () => { statusCode: number; headers: Record<string, string> } } {
      let statusCode = 200;
      let headers: Record<string, string> = {};
      const res = {
        writeHead: (code: number, h?: any) => {
          statusCode = code;
          if (h) headers = { ...headers, ...h };
          return res;
        },
        setHeader: (key: string, val: string) => {
          headers[key.toLowerCase()] = val;
        },
        end: () => {},
      } as unknown as http.ServerResponse;

      return {
        res,
        getWritten: () => ({ statusCode, headers }),
      };
    }

    // Test 1: OAuth user cancellation / access_denied error redirect
    {
      const { res, getWritten } = createMockRes();
      const req = new EventEmitter() as unknown as http.IncomingMessage;
      req.method = 'GET';
      req.headers = { host: 'api.mahibrowser.com' };
      const parsedUrl = new URL('https://api.mahibrowser.com/api/v1/auth/google/callback?error=access_denied&state=');

      const handled = await handleCommercialApiRoutes(req, res, '/api/v1/auth/google/callback', 'GET', parsedUrl);
      expect(handled).toBe(true);

      const written = getWritten();
      expect(written.statusCode).toBe(302);
      expect(written.headers.Location).toBeDefined();
      expect(written.headers.Location).toContain('https://mahibrowser.com/signup?error=cancelled');
    }

    // Test 2: Invalid or expired state error redirect
    {
      const { res, getWritten } = createMockRes();
      const req = new EventEmitter() as unknown as http.IncomingMessage;
      req.method = 'GET';
      req.headers = { host: 'api.mahibrowser.com' };
      const parsedUrl = new URL('https://api.mahibrowser.com/api/v1/auth/google/callback?state=invalid_nonexistent_state&code=test_code');

      const handled = await handleCommercialApiRoutes(req, res, '/api/v1/auth/google/callback', 'GET', parsedUrl);
      expect(handled).toBe(true);

      const written = getWritten();
      expect(written.statusCode).toBe(302);
      expect(written.headers.Location).toBe('https://mahibrowser.com/signup?error=invalid_state');
    }

    // Test 3: Catch block error redirect with MAHI_WEBSITE_URL
    {
      const db = getDatabase();
      const validState = 'test_valid_state_for_throw_' + Date.now();
      db.prepare(`
        INSERT INTO oauth_states (state, nonce, provider, intent, plan_id, billing_cycle, return_url, expires_at, created_at)
        VALUES (?, 'nonce123', 'google', 'trial', 'professional_50', 'annual', '/download', datetime('now', '+10 minutes'), datetime('now'))
      `).run(validState);

      const { res, getWritten } = createMockRes();
      const req = new EventEmitter() as unknown as http.IncomingMessage;
      req.method = 'GET';
      req.headers = { host: 'api.mahibrowser.com' };
      // Code that will trigger an exception in exchangeGoogleAuthorizationCode
      const parsedUrl = new URL(`https://api.mahibrowser.com/api/v1/auth/google/callback?state=${validState}&code=invalid_code_that_fails`);

      const handled = await handleCommercialApiRoutes(req, res, '/api/v1/auth/google/callback', 'GET', parsedUrl);
      expect(handled).toBe(true);

      const written = getWritten();
      expect(written.statusCode).toBe(302);
      expect(written.headers.Location).toBeDefined();
      expect(written.headers.Location.startsWith('https://mahibrowser.com/signup?error=')).toBe(true);
    }
  });
});
