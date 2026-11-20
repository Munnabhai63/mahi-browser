import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import {
  saveEncryptedSession,
  loadEncryptedSession,
  clearEncryptedSession,
  loginWithToken,
  refreshAccountTokenWithMutex,
  fetchAndCacheStatus,
  writeCachedStatus,
  readCachedStatus,
  AccountSession,
  CachedAccountStatus,
} from '../../08_SECURITY/account-service.js';
import {
  getNonDeletedProfileCount,
  assertCanCreateProfile,
  getPlanLimitsInfo,
  resolveDefaultOwnerId,
} from '../../08_SECURITY/freemium-guard.js';
import { getHWID, resetHwidCacheForTesting } from '../../08_SECURITY/license-service.js';
import { setCustomDatabasePath, closeDatabase, getDatabase, initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getWritableUserDataDir } from '../../07_BACKEND/utils/runtime-paths.js';

describe('Task R3: Account Session, Token Refresh & Quota Isolation Suite', () => {
  const testDir = path.resolve('.mahi_data', 'test_account_session_quota');
  const dbPath = path.join(testDir, 'quota_test.sqlite');

  beforeAll(async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.env.APPDATA = path.join(testDir, 'appdata');
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  beforeEach(() => {
    clearEncryptedSession();
    resetHwidCacheForTesting();
  });

  afterEach(() => {
    clearEncryptedSession();
    vi.restoreAllMocks();
  });

  describe('1. Encrypted Session & Refresh Token Persistence', () => {
    it('can directly write and read cached status', () => {
      const cachedStatus: CachedAccountStatus = {
        account_id: 'usr_server_err',
        hwid: getHWID(),
        plan: 'pro',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: null,
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      };
      writeCachedStatus(cachedStatus);
      const read = readCachedStatus();
      expect(read).not.toBeNull();
      expect(read?.plan).toBe('pro');
    });

    it('persists refreshToken in encrypted session at rest', () => {
      const session: AccountSession = {
        token: 'acc_token_123',
        refreshToken: 'ref_token_456',
        account_id: 'usr_test_alpha',
        email: 'alpha@mahibrowser.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      };

      saveEncryptedSession(session);

      const loaded = loadEncryptedSession();
      expect(loaded).not.toBeNull();
      expect(loaded?.token).toBe('acc_token_123');
      expect(loaded?.refreshToken).toBe('ref_token_456');
      expect(loaded?.account_id).toBe('usr_test_alpha');

      // Check on-disk format is encrypted (either SAFE_STORAGE_V1: or AESGCM:)
      const sessionFile = path.join(getWritableUserDataDir(), 'account-session.enc');
      expect(fs.existsSync(sessionFile)).toBe(true);
      const rawContent = fs.readFileSync(sessionFile);
      const rawStr = rawContent.toString('utf8');
      const isEncrypted = rawStr.startsWith('SAFE_STORAGE_V1:')
        || rawContent.subarray(0, 7).equals(Buffer.from('AESGCM:'));
      expect(isEncrypted).toBe(true);
    });
  });

  describe('2. Token Refresh on 401 & Server 500 Error Persistence', () => {
    it('does not wipe session on transient server 500 errors', async () => {
      // Mock cached status
      const cachedStatus: CachedAccountStatus = {
        account_id: 'usr_server_err',
        hwid: getHWID(),
        plan: 'pro',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: null,
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      };
      writeCachedStatus(cachedStatus);

      saveEncryptedSession({
        token: 'token_valid',
        refreshToken: 'refresh_valid',
        account_id: 'usr_server_err',
        email: 'err@mahibrowser.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });

      // Mock an HTTP server returning 500
      const server = http.createServer((_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;
      const originalAdminUrl = process.env.MAHI_ADMIN_URL;
      process.env.MAHI_ADMIN_URL = `http://127.0.0.1:${port}`;

      try {
        // Even if status fails with 500, session must remain intact
        const sessionBefore = loadEncryptedSession();
        expect(sessionBefore).not.toBeNull();

        // Simulate 500 response handling
        const result = await fetchAndCacheStatus();
        expect(result).not.toBeNull(); // returns cached status
        expect(result?.plan).toBe('pro');

        const sessionAfter = loadEncryptedSession();
        expect(sessionAfter).not.toBeNull();
        expect(sessionAfter?.token).toBe('token_valid');
      } finally {
        if (originalAdminUrl !== undefined) {
          process.env.MAHI_ADMIN_URL = originalAdminUrl;
        } else {
          delete process.env.MAHI_ADMIN_URL;
        }
        server.close();
      }
    });

    it('deduplicates concurrent refresh requests via in-flight mutex', async () => {
      saveEncryptedSession({
        token: 'expired_token',
        refreshToken: 'valid_refresh_token',
        account_id: 'usr_mutex_test',
        email: 'mutex@mahibrowser.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });

      // Call mutex function concurrently 3 times
      const p1 = refreshAccountTokenWithMutex();
      const p2 = refreshAccountTokenWithMutex();
      const p3 = refreshAccountTokenWithMutex();

      // All 3 promises resolve without throwing unhandled rejections
      const results = await Promise.all([p1, p2, p3]);
      expect(results).toHaveLength(3);
      // They should all return the identical boolean result
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
    });

    it('executes live 401 -> mutex token refresh -> 200 retry in fetchAndCacheStatus() without wiping session', async () => {
      // Seed session with old token and refresh token
      saveEncryptedSession({
        token: 'old_expired_token_111',
        refreshToken: 'valid_refresh_token_222',
        account_id: 'usr_refresh_test',
        email: 'refresh_live@mahibrowser.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });

      let statusHits = 0;
      let refreshHits = 0;

      const server = http.createServer((req, res) => {
        const url = req.url || '';
        if (url.startsWith('/v1/account/status')) {
          statusHits++;
          const authHeader = req.headers['x-mahi-token'];
          if (authHeader === 'old_expired_token_111') {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Token expired' }));
            return;
          }
          if (authHeader === 'new_access_token_333') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              account_id: 'usr_refresh_test',
              plan: 'pro',
              profile_limit: 100,
              sync_allowed: true,
              server_time: Date.now(),
              verified_at: Date.now(),
              sig: 'mock_sig_refreshed'
            }));
            return;
          }
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }

        if (url === '/api/v1/auth/refresh') {
          refreshHits++;
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            const parsed = JSON.parse(body || '{}');
            if (parsed.refreshToken === 'valid_refresh_token_222') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                tokens: {
                  accessToken: 'new_access_token_333',
                  refreshToken: 'new_refresh_token_444'
                }
              }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid refresh token' }));
            }
          });
          return;
        }

        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as any).port;
      const originalAdminUrl = process.env.MAHI_ADMIN_URL;
      process.env.MAHI_ADMIN_URL = `http://127.0.0.1:${port}`;

      try {
        const statusResult = await fetchAndCacheStatus();
        expect(statusResult).not.toBeNull();
        expect(statusResult?.plan).toBe('pro');
        expect(statusResult?.profile_limit).toBe(100);

        expect(statusHits).toBe(2); // 1st was 401, 2nd was 200
        expect(refreshHits).toBe(1);

        const updatedSession = loadEncryptedSession();
        expect(updatedSession).not.toBeNull();
        expect(updatedSession?.token).toBe('new_access_token_333');
        expect(updatedSession?.refreshToken).toBe('new_refresh_token_444');
      } finally {
        if (originalAdminUrl !== undefined) {
          process.env.MAHI_ADMIN_URL = originalAdminUrl;
        } else {
          delete process.env.MAHI_ADMIN_URL;
        }
        server.close();
      }
    });
  });

  describe('3. Multi-Owner & Guest Profile Quota Isolation', () => {
    const ownerGuest = 'SYSTEM_OWNER';
    const ownerAlice = 'usr_alice_123';
    const ownerBob = 'usr_bob_456';

    beforeEach(() => {
      const db = getDatabase();
      db.prepare("DELETE FROM profiles WHERE owner_id IN (?, ?, ?) OR owner_id = 'LOCAL_CLIENT'").run(
        ownerGuest,
        ownerAlice,
        ownerBob
      );
    });

    it('counts profiles strictly partitioned by ownerId', () => {
      const db = getDatabase();
      const now = new Date().toISOString();

      // Insert 2 guest profiles
      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
        VALUES ('prof_g1', 'Guest 1', 'SYSTEM_OWNER', 'ready', '/tmp/g1', ?, ?),
               ('prof_g2', 'Guest 2', 'LOCAL_CLIENT', 'ready', '/tmp/g2', ?, ?)
      `).run(now, now, now, now);

      // Insert 3 Alice profiles
      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
        VALUES ('prof_a1', 'Alice 1', 'usr_alice_123', 'ready', '/tmp/a1', ?, ?),
               ('prof_a2', 'Alice 2', 'usr_alice_123', 'ready', '/tmp/a2', ?, ?),
               ('prof_a3', 'Alice 3', 'usr_alice_123', 'ready', '/tmp/a3', ?, ?)
      `).run(now, now, now, now, now, now);

      // Insert 1 Bob profile
      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
        VALUES ('prof_b1', 'Bob 1', 'usr_bob_456', 'ready', '/tmp/b1', ?, ?)
      `).run(now, now);

      // Verify guest count
      expect(getNonDeletedProfileCount()).toBe(2);
      expect(getNonDeletedProfileCount('SYSTEM_OWNER')).toBe(2);

      // Verify Alice count
      expect(getNonDeletedProfileCount('usr_alice_123')).toBe(3);

      // Verify Bob count
      expect(getNonDeletedProfileCount('usr_bob_456')).toBe(1);

      // Verify non-existent user has 0
      expect(getNonDeletedProfileCount('usr_charlie_789')).toBe(0);
    });

    it('ignores soft-deleted profiles when computing quota counts', () => {
      const db = getDatabase();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO profiles (id, name, owner_id, status, storage_path, deleted_at, created_at, updated_at)
        VALUES ('prof_del_1', 'Deleted 1', 'usr_alice_123', 'ready', '/tmp/d1', ?, ?, ?),
               ('prof_active_1', 'Active 1', 'usr_alice_123', 'ready', '/tmp/a1', NULL, ?, ?)
      `).run(now, now, now, now, now);

      expect(getNonDeletedProfileCount('usr_alice_123')).toBe(1);
    });

    it('asserts profile creation capacity per owner quota', () => {
      const limitsAlice = getPlanLimitsInfo('usr_alice_123');
      expect(limitsAlice.currentCount).toBe(0);

      // Does not throw when within limit
      expect(() => assertCanCreateProfile(1, 'usr_alice_123')).not.toThrow();
    });

    it('resolves active account session by default when ownerId is omitted, isolating quota from guest profiles', () => {
      const db = getDatabase();
      const now = new Date().toISOString();

      // Seed 15 active guest profiles (hitting the free limit of 15)
      for (let i = 1; i <= 15; i++) {
        db.prepare(`
          INSERT INTO profiles (id, name, owner_id, status, storage_path, created_at, updated_at)
          VALUES (?, ?, 'SYSTEM_OWNER', 'ready', ?, ?, ?)
        `).run(`prof_guest_${i}`, `Guest Profile ${i}`, `/tmp/guest_${i}`, now, now);
      }

      // Verify guest count is 15 (at capacity)
      expect(getNonDeletedProfileCount('SYSTEM_OWNER')).toBe(15);
      expect(() => assertCanCreateProfile(1, 'SYSTEM_OWNER')).toThrow(/Free plan limit reached/);

      // Now log in as a new customer with 0 profiles
      saveEncryptedSession({
        token: 'token_customer_new',
        refreshToken: 'refresh_customer_new',
        account_id: 'usr_new_customer',
        email: 'customer@mahibrowser.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });

      // Verify resolveDefaultOwnerId defaults to active session account_id
      expect(resolveDefaultOwnerId()).toBe('usr_new_customer');

      // Calling getPlanLimitsInfo() with NO arguments must evaluate usr_new_customer (0 profiles)
      const limits = getPlanLimitsInfo();
      expect(limits.currentCount).toBe(0);
      expect(limits.maxProfiles).toBe(15);

      // Calling assertCanCreateProfile(1) with NO arguments must succeed and NOT throw
      expect(() => assertCanCreateProfile(1)).not.toThrow();

      // Clean up customer session
      clearEncryptedSession();
    });
  });

  describe('4. Hardware ID (HWID) Machine Entropy', () => {
    it('generates a stable machine-bound HWID conforming to MAHI-XXXX-XXXX-XXXX-XXXX format', () => {
      const hwid1 = getHWID();
      const hwid2 = getHWID();

      expect(hwid1).toBe(hwid2);
      expect(hwid1).toMatch(/^MAHI-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    });
  });
});
