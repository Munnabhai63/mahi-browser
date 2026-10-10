import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';

describe('Phase 11 — Database Migration Integrity & Dual-Path Verification', () => {
  const tempDir = path.resolve('.mahi_data', 'test-migration-integrity');

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    closeDatabase();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // =========================================================================
  // 1. FRESH INSTALLATION PATH
  // =========================================================================
  describe('Path A: Fresh Database Installation', () => {
    const freshDbPath = path.join(tempDir, 'fresh_install.sqlite');

    it('creates all tables from scratch and advances sequentially to v17', async () => {
      if (fs.existsSync(freshDbPath)) fs.unlinkSync(freshDbPath);
      setCustomDatabasePath(freshDbPath);

      // Run fresh initializeDatabase
      await initializeDatabase();
      const db = getDatabase();

      // Verify schema_migrations versions 1 through 17
      const migrations = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
      const versions = migrations.map((m) => m.version);

      expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
      expect(Math.max(...versions)).toBe(22);

      // Verify Phase 11 Mobile Tables exist
      const checkTokens = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_device_tokens'").get();
      expect(checkTokens).toBeDefined();

      const checkPrefs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_notification_preferences'").get();
      expect(checkPrefs).toBeDefined();

      const checkNotifs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_notifications'").get();
      expect(checkNotifs).toBeDefined();

      // Verify Phase 10 Cloud Browser Tables exist
      const checkRegions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cloud_browser_regions'").get();
      expect(checkRegions).toBeDefined();

      const checkWorkers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cloud_browser_workers'").get();
      expect(checkWorkers).toBeDefined();

      const checkSessions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cloud_browser_sessions'").get();
      expect(checkSessions).toBeDefined();

      // Verify default cloud regions were seeded
      const regionsCount = db.prepare('SELECT COUNT(*) as count FROM cloud_browser_regions').get() as any;
      expect(regionsCount?.count).toBeGreaterThanOrEqual(4);

      closeDatabase();
    });
  });

  // =========================================================================
  // 2. UPGRADE FROM EXISTING v16 DATABASE PATH
  // =========================================================================
  describe('Path B: Existing v16 Database Upgrade to Phase 11 (v17)', () => {
    const upgradeDbPath = path.join(tempDir, 'v16_upgrade.sqlite');

    it('upgrades a v16 database to v17 without data loss or schema conflict', async () => {
      if (fs.existsSync(upgradeDbPath)) fs.unlinkSync(upgradeDbPath);
      setCustomDatabasePath(upgradeDbPath);

      const SQL = await initSqlEngine();
      const rawDb = new SQL.Database();

      // 1. Setup minimal v16 schema with existing user data
      rawDb.run(`
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );
        CREATE TABLE profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          folder TEXT DEFAULT 'General',
          notes TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'STOPPED',
          storage_path TEXT NOT NULL,
          pinned INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT,
          last_error TEXT,
          deleted_at TEXT DEFAULT NULL,
          owner_id TEXT NOT NULL DEFAULT 'SYSTEM_OWNER',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE auth_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          normalized_email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'USER',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          email_verified INTEGER NOT NULL DEFAULT 0,
          email_verified_at TEXT,
          plan_id TEXT NOT NULL DEFAULT 'plan_free',
          profile_quota INTEGER NOT NULL DEFAULT 10,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT
        );
        CREATE TABLE cloud_browser_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workspace_id TEXT,
          profile_id TEXT NOT NULL,
          worker_id TEXT,
          region_id TEXT NOT NULL DEFAULT 'in-west',
          status TEXT NOT NULL DEFAULT 'REQUESTED',
          resource_class TEXT NOT NULL DEFAULT 'STANDARD',
          profile_version INTEGER NOT NULL DEFAULT 1,
          lock_id TEXT,
          session_token_hash TEXT,
          stream_gateway_url TEXT,
          cdp_port INTEGER,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          max_duration_seconds INTEGER NOT NULL DEFAULT 3600,
          idle_timeout_seconds INTEGER NOT NULL DEFAULT 600,
          last_activity_at TEXT NOT NULL,
          started_at TEXT,
          ended_at TEXT,
          termination_reason TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Record migrations 1 through 16 as applied
      const now = new Date().toISOString();
      for (let v = 1; v <= 16; v++) {
        rawDb.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [v, now]);
      }

      // Seed historical user data in v16
      rawDb.run(`
        INSERT INTO auth_users (id, email, normalized_email, password_hash, salt, name, created_at, updated_at)
        VALUES ('usr_v16_existing', 'operator@agency.com', 'operator@agency.com', 'hash_abc', 'salt_xyz', 'Agency Operator', ?, ?)
      `, [now, now]);

      rawDb.run(`
        INSERT INTO profiles (id, name, storage_path, created_at, updated_at)
        VALUES ('prof_v16_critical', 'Amazon Seller Production', '/data/profiles/prof_1', ?, ?)
      `, [now, now]);

      rawDb.run(`
        INSERT INTO cloud_browser_sessions (id, user_id, profile_id, status, created_at, updated_at, last_activity_at)
        VALUES ('sess_v16_cloud', 'usr_v16_existing', 'prof_v16_critical', 'STOPPED', ?, ?, ?)
      `, [now, now, now]);

      // Export to file
      fs.writeFileSync(upgradeDbPath, Buffer.from(rawDb.export()));
      rawDb.close();

      // 2. Run initializeDatabase() to trigger upgrade
      closeDatabase();
      setCustomDatabasePath(upgradeDbPath);
      await initializeDatabase();

      const db = getDatabase();

      // Verify schema version is now 22
      const versionRow = db.prepare('SELECT MAX(version) as maxVersion FROM schema_migrations').get() as any;
      expect(versionRow.maxVersion).toBe(22);

      // Verify Phase 11 mobile tables were created during upgrade
      const checkTokens = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_device_tokens'").get();
      expect(checkTokens).toBeDefined();

      const checkPrefs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_notification_preferences'").get();
      expect(checkPrefs).toBeDefined();

      const checkNotifs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_notifications'").get();
      expect(checkNotifs).toBeDefined();

      // Verify historical data is 100% intact
      const existingUser = db.prepare("SELECT * FROM auth_users WHERE id = 'usr_v16_existing'").get() as any;
      expect(existingUser).toBeDefined();
      expect(existingUser.email).toBe('operator@agency.com');

      const existingProfile = db.prepare("SELECT * FROM profiles WHERE id = 'prof_v16_critical'").get() as any;
      expect(existingProfile).toBeDefined();
      expect(existingProfile.name).toBe('Amazon Seller Production');

      const existingSession = db.prepare("SELECT * FROM cloud_browser_sessions WHERE id = 'sess_v16_cloud'").get() as any;
      expect(existingSession).toBeDefined();
      expect(existingSession.status).toBe('STOPPED');

      // Verify writing to new Phase 11 tables succeeds on upgraded database
      db.prepare(`
        INSERT INTO mobile_device_tokens (id, user_id, device_id, push_token, platform, last_seen_at, created_at, updated_at)
        VALUES ('tok_upgrade_1', 'usr_v16_existing', 'pixel_8_upgrade', 'fcm_upgraded_token', 'android', ?, ?, ?)
      `).run(now, now, now);

      const insertedToken = db.prepare("SELECT * FROM mobile_device_tokens WHERE id = 'tok_upgrade_1'").get() as any;
      expect(insertedToken).toBeDefined();
      expect(insertedToken.user_id).toBe('usr_v16_existing');

      closeDatabase();
    });
  });

  // =========================================================================
  // 3. IDEMPOTENCY & STABILITY
  // =========================================================================
  describe('Path C: Migration Idempotency & Stability', () => {
    it('running initializeDatabase multiple times produces no errors or duplicate migration entries', async () => {
      const idempotencyDbPath = path.join(tempDir, 'idempotent.sqlite');
      if (fs.existsSync(idempotencyDbPath)) fs.unlinkSync(idempotencyDbPath);
      setCustomDatabasePath(idempotencyDbPath);

      // Run 1st time
      await initializeDatabase();
      // Run 2nd time
      await initializeDatabase();
      // Run 3rd time
      await initializeDatabase();

      const db = getDatabase();
      const countMigrations = db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get() as any;
      expect(countMigrations.count).toBe(22);

      const maxVer = db.prepare('SELECT MAX(version) as maxVer FROM schema_migrations').get() as any;
      expect(maxVer.maxVer).toBe(22);

      closeDatabase();
    });
  });
});
