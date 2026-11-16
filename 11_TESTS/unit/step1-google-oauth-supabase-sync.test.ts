import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { setPrismaClientForTest } from '../../06_DATABASE/prisma-client.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import { getCentralUserByIdAsync } from '../../05_AUTH/central-auth-service.js';
import {
  authenticateWithGoogleClaims,
  authenticateWithGoogleClaimsAsync,
  GoogleClaims,
  deriveProfileQuota,
} from '../../07_BACKEND/commercial/google-oauth-service.js';
import { getUserSyncUsageAsync } from '../../07_BACKEND/services/cloud-profile-service.js';
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
      cloud_profiles: {
        findMany: async ({ where }: any) => {
          return [];
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

  it('d) blocks suspended user from OAuth login in PostgreSQL and SQLite, never overwriting status to ACTIVE', async () => {
    expect(isPostgresConfigured()).toBe(true);
    const db = getDatabase();

    // 1. PostgreSQL suspended user
    const pgSuspendedId = `usr_pg_suspended_${Date.now()}`;
    const pgSuspendedEmail = `suspended-pg-${Date.now()}@example.com`;
    authUsersMap.set(pgSuspendedId, {
      id: pgSuspendedId,
      email: pgSuspendedEmail,
      normalized_email: pgSuspendedEmail,
      password_hash: 'argon2_hash',
      salt: 'salt123',
      name: 'Suspended PG User',
      role: 'USER',
      status: 'SUSPENDED',
      email_verified: 1,
      email_verified_at: new Date().toISOString(),
      plan_id: 'solo_10',
      profile_quota: 10,
      auth_provider: 'LOCAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    });

    const resPg = await authenticateWithGoogleClaimsAsync({
      sub: `google_sub_suspended_pg_${Date.now()}`,
      email: pgSuspendedEmail,
      email_verified: true,
      name: 'Suspended PG User',
    }, null);

    expect(resPg.success).toBe(false);
    expect(resPg.error).toContain('ACCOUNT_SUSPENDED');

    // Ensure status was NEVER overwritten to ACTIVE
    const pgUserAfter = authUsersMap.get(pgSuspendedId);
    expect(pgUserAfter.status).toBe('SUSPENDED');

    // 2. SQLite suspended user
    const sqliteSuspendedId = `usr_sqlite_suspended_${Date.now()}`;
    const sqliteSuspendedEmail = `suspended-sqlite-${Date.now()}@example.com`;
    db.prepare(`
      INSERT INTO commercial_users (
        id, email, password_hash, salt, name, role, status, plan_id,
        trial_used, auth_provider, created_at, updated_at
      ) VALUES (?, ?, 'hash', 'salt', 'Suspended SQLite User', 'USER', 'SUSPENDED', 'free', 0, 'LOCAL', datetime('now'), datetime('now'))
    `).run(sqliteSuspendedId, sqliteSuspendedEmail);

    const resSqlite = await authenticateWithGoogleClaimsAsync({
      sub: `google_sub_suspended_sqlite_${Date.now()}`,
      email: sqliteSuspendedEmail,
      email_verified: true,
      name: 'Suspended SQLite User',
    }, null);

    expect(resSqlite.success).toBe(false);
    expect(resSqlite.error).toContain('ACCOUNT_SUSPENDED');

    const sqliteRow = db.prepare('SELECT status FROM commercial_users WHERE id = ?').get(sqliteSuspendedId) as any;
    expect(sqliteRow.status).toBe('SUSPENDED');
  });

  it('e) handles pgUser ID mismatch, migrates SQLite child rows in transaction, and preserves PostgreSQL profile quota in getUserSyncUsageAsync', async () => {
    expect(isPostgresConfigured()).toBe(true);
    const db = getDatabase();

    const sqliteOldId = `usr_sqlite_mismatch_old_${Date.now()}`;
    const pgNewId = `usr_pg_mismatch_new_${Date.now()}`;
    const email = `mismatch-quota-${Date.now()}@company.com`;
    const googleSub = `sub_mismatch_${Date.now()}`;

    // 1. Seed existing user in local SQLite with old ID
    db.prepare(`
      INSERT INTO commercial_users (
        id, email, password_hash, salt, name, role, status, plan_id,
        trial_used, auth_provider, created_at, updated_at
      ) VALUES (?, ?, 'old_hash', 'old_salt', 'Old SQLite Member', 'USER', 'ACTIVE', 'free', 0, 'LOCAL', datetime('now'), datetime('now'))
    `).run(sqliteOldId, email);

    db.prepare(`
      INSERT INTO auth_users (
        id, email, normalized_email, password_hash, salt, name, role, status,
        email_verified, plan_id, profile_quota, created_at, updated_at
      ) VALUES (?, ?, ?, 'old_hash', 'old_salt', 'Old SQLite Member', 'USER', 'ACTIVE', 1, 'free', 1, datetime('now'), datetime('now'))
    `).run(sqliteOldId, email, email);

    // Seed child referencing rows in commercial_subscriptions and auth_sessions
    const subId = `sub_mismatch_child_${Date.now()}`;
    db.prepare(`
      INSERT INTO commercial_subscriptions (
        id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
      ) VALUES (?, ?, 'free', 'ACTIVE', 'monthly', datetime('now'), datetime('now', '+30 days'), 'free', datetime('now'))
    `).run(subId, sqliteOldId);

    const sessionId = `sess_mismatch_child_${Date.now()}`;
    db.prepare(`
      INSERT INTO auth_sessions (
        id, user_id, refresh_token_hash, device_id, device_name, platform, ip_address, is_revoked, created_at, last_used_at, expires_at
      ) VALUES (?, ?, 'hash_tok_12345', 'dev_1', 'Desktop', 'win32', '127.0.0.1', 0, datetime('now'), datetime('now'), datetime('now', '+7 days'))
    `).run(sessionId, sqliteOldId);

    // 2. Seed existing user in Supabase PostgreSQL with NEW ID and professional_50 (profile_quota = 50)
    authUsersMap.set(pgNewId, {
      id: pgNewId,
      email,
      normalized_email: email,
      password_hash: 'pg_hash',
      salt: 'pg_salt',
      name: 'New PG Aligned Member',
      role: 'USER',
      status: 'ACTIVE',
      email_verified: 1,
      email_verified_at: new Date().toISOString(),
      plan_id: 'professional_50',
      profile_quota: 50,
      auth_provider: 'LOCAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    });

    // 3. User logs in with Google OAuth
    const res = await authenticateWithGoogleClaimsAsync({
      sub: googleSub,
      email,
      email_verified: true,
      name: 'Google Logged In User',
    }, null);

    expect(res.success).toBe(true);
    // Verified: Res returns the PostgreSQL ID, aligning SQLite with Supabase!
    expect(res.user.id).toBe(pgNewId);

    // 4. Verify SQLite commercial_users was migrated to pgNewId
    const oldRow = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(sqliteOldId);
    expect(oldRow).toBeUndefined();

    const migratedRow = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(pgNewId) as any;
    expect(migratedRow).toBeDefined();
    expect(migratedRow.email).toBe(email);
    expect(migratedRow.google_sub).toBe(googleSub);

    // 5. Verify child referencing rows were cleanly migrated to pgNewId
    const migratedSub = db.prepare('SELECT user_id FROM commercial_subscriptions WHERE id = ?').get(subId) as any;
    expect(migratedSub?.user_id).toBe(pgNewId);

    const migratedSession = db.prepare('SELECT user_id FROM auth_sessions WHERE id = ?').get(sessionId) as any;
    expect(migratedSession?.user_id).toBe(pgNewId);

    // 6. Verify getUserSyncUsageAsync respects PostgreSQL profile_quota (50) and is not downgraded to free tier (1)
    const usage = await getUserSyncUsageAsync(pgNewId);
    expect(usage.max_profiles).toBe(50);

    // 7. Verify a free plan user with profile_quota = 1 receives max_profiles === 1 (not forced up to 10)
    const freeUserId = `usr_free_user_${Date.now()}`;
    authUsersMap.set(freeUserId, {
      id: freeUserId,
      email: `free-${Date.now()}@example.com`,
      plan_id: 'free',
      profile_quota: 1,
    });
    const freeUsage = await getUserSyncUsageAsync(freeUserId);
    expect(freeUsage.max_profiles).toBe(1);
  });
});
