import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
  flushDatabaseToDisk,
  saveDatabaseToDisk,
} from '../../06_DATABASE/connection.js';
import {
  initializeDatabase,
  columnExists,
  addColumnIfNotExists,
  runMigration,
} from '../../06_DATABASE/schema.js';

describe('Phase 11 — Database Migration Integrity & Dual-Path Verification', () => {
  const tempDir = path.resolve('.mahi_data', 'test-migration-integrity');

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    closeDatabase();
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

    it('creates all tables from scratch and advances sequentially to v23', async () => {
      if (fs.existsSync(freshDbPath)) fs.unlinkSync(freshDbPath);
      setCustomDatabasePath(freshDbPath);

      // Run fresh initializeDatabase
      await initializeDatabase();
      const db = getDatabase();

      // Verify schema_migrations versions 1 through 24
      const migrations = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
      const versions = migrations.map((m) => m.version);

      expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
      expect(Math.max(...versions)).toBe(24);

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

      // Verify Phase 23 columns exist
      expect(columnExists(db, 'commercial_users', 'bonus_profiles')).toBe(true);
      expect(columnExists(db, 'commercial_users', 'bonus_proxy_bytes')).toBe(true);
      expect(columnExists(db, 'commercial_users', 'feature_overrides')).toBe(true);

      // Verify default cloud regions were seeded
      const regionsCount = db.prepare('SELECT COUNT(*) as count FROM cloud_browser_regions').get() as any;
      expect(regionsCount?.count).toBeGreaterThanOrEqual(4);

      closeDatabase();
    });
  });

  // =========================================================================
  // 2. UPGRADE FROM EXISTING v16 DATABASE PATH
  // =========================================================================
  describe('Path B: Existing v16 Database Upgrade to Phase 11 (v23)', () => {
    const upgradeDbPath = path.join(tempDir, 'v16_upgrade.sqlite');

    it('upgrades a v16 database to v23 without data loss or schema conflict', async () => {
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
        CREATE TABLE commercial_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'USER',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          plan_id TEXT NOT NULL DEFAULT 'plan_free',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT
        );
        CREATE TABLE commercial_plans (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tier TEXT NOT NULL,
          price_monthly REAL NOT NULL DEFAULT 0,
          price_annual REAL NOT NULL DEFAULT 0,
          limits_json TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE proxies (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          protocol TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE automation_workflows (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE automation_steps (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          step_order INTEGER NOT NULL,
          action_type TEXT NOT NULL,
          created_at TEXT NOT NULL
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

      // Verify schema version is now 24
      const versionRow = db.prepare('SELECT MAX(version) as maxVersion FROM schema_migrations').get() as any;
      expect(versionRow.maxVersion).toBe(24);

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
      expect(countMigrations.count).toBe(24);

      const maxVer = db.prepare('SELECT MAX(version) as maxVer FROM schema_migrations').get() as any;
      expect(maxVer.maxVer).toBe(24);

      closeDatabase();
    });
  });

  // =========================================================================
  // 4. ACCURATE ROW CHANGES COUNT (sql.js getRowsModified)
  // =========================================================================
  describe('Path D: Accurate Row Changes Count (No Hardcoded changes: 1)', () => {
    const changesDbPath = path.join(tempDir, 'changes_test.sqlite');

    it('returns changes: 0 for non-matching UPDATE/DELETE and real count for matching', async () => {
      if (fs.existsSync(changesDbPath)) fs.unlinkSync(changesDbPath);
      setCustomDatabasePath(changesDbPath);
      await initializeDatabase();
      const db = getDatabase();

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO profiles (id, name, storage_path, created_at, updated_at)
        VALUES ('prof_change_target', 'Original Target', '/data/profiles/target', ?, ?)
      `).run(now, now);

      // Non-matching update must return changes: 0
      const noMatchUpdate = db.prepare("UPDATE profiles SET name = 'Ghost' WHERE id = 'prof_does_not_exist'").run();
      expect(noMatchUpdate.changes).toBe(0);

      // Non-matching delete must return changes: 0
      const noMatchDelete = db.prepare("DELETE FROM profiles WHERE id = 'prof_does_not_exist'").run();
      expect(noMatchDelete.changes).toBe(0);

      // Matching update must return changes: 1
      const matchUpdate = db.prepare("UPDATE profiles SET name = 'Real Name' WHERE id = 'prof_change_target'").run();
      expect(matchUpdate.changes).toBe(1);

      // Matching delete must return changes: 1
      const matchDelete = db.prepare("DELETE FROM profiles WHERE id = 'prof_change_target'").run();
      expect(matchDelete.changes).toBe(1);

      closeDatabase();
    });
  });

  // =========================================================================
  // 5. PRAGMA foreign_keys = ON & Cascading Deletions
  // =========================================================================
  describe('Path E: Foreign Key Enforcement & Cascading Deletion', () => {
    const fkDbPath = path.join(tempDir, 'fk_test.sqlite');

    it('enforces foreign keys and cascades deletions automatically', async () => {
      if (fs.existsSync(fkDbPath)) fs.unlinkSync(fkDbPath);
      setCustomDatabasePath(fkDbPath);
      await initializeDatabase();
      const db = getDatabase();

      // Check PRAGMA foreign_keys is 1
      const fkPragma = db.prepare('PRAGMA foreign_keys').get() as any;
      expect(fkPragma.foreign_keys).toBe(1);

      const now = new Date().toISOString();
      // Insert valid parent license
      db.prepare(`
        INSERT INTO licenses (id, license_key_hash, key_masked, customer_name, status, duration_type, starts_at, created_at)
        VALUES ('lic_parent_1', 'hash_parent_1', 'XXXX-1111', 'Test Customer', 'ACTIVE', 'LIFETIME', ?, ?)
      `).run(now, now);

      // Insert child license_devices referencing parent
      db.prepare(`
        INSERT INTO license_devices (id, license_id, device_id, device_name, activated_at, last_seen_at)
        VALUES ('dev_child_1', 'lic_parent_1', 'dev_hw_1', 'MacBook Pro', ?, ?)
      `).run(now, now);

      const childBefore = db.prepare("SELECT * FROM license_devices WHERE id = 'dev_child_1'").get();
      expect(childBefore).toBeDefined();

      // Delete parent license - cascade should delete child
      db.prepare("DELETE FROM licenses WHERE id = 'lic_parent_1'").run();

      const childAfter = db.prepare("SELECT * FROM license_devices WHERE id = 'dev_child_1'").get();
      expect(childAfter).toBeUndefined();

      // Inserting child with non-existent parent should throw FOREIGN KEY constraint failed
      expect(() => {
        db.prepare(`
          INSERT INTO license_devices (id, license_id, device_id, device_name, activated_at, last_seen_at)
          VALUES ('dev_orphan', 'non_existent_lic', 'dev_hw_orphan', 'Orphan PC', ?, ?)
        `).run(now, now);
      }).toThrow(/FOREIGN KEY constraint failed/i);

      closeDatabase();
    });
  });

  // =========================================================================
  // 6. NESTED TRANSACTIONS & SAVEPOINTS
  // =========================================================================
  describe('Path F: Nested Transactions with Savepoint Rollback', () => {
    const txDbPath = path.join(tempDir, 'tx_test.sqlite');

    it('rolls back inner transaction without aborting outer transaction', async () => {
      if (fs.existsSync(txDbPath)) fs.unlinkSync(txDbPath);
      setCustomDatabasePath(txDbPath);
      await initializeDatabase();
      const db = getDatabase();

      const now = new Date().toISOString();

      // Outer transaction
      db.transaction(() => {
        db.prepare(`
          INSERT INTO profiles (id, name, storage_path, created_at, updated_at)
          VALUES ('prof_outer_keep', 'Outer Profile', '/data/outer', ?, ?)
        `).run(now, now);

        // Inner transaction that fails and is caught
        try {
          db.transaction(() => {
            db.prepare(`
              INSERT INTO profiles (id, name, storage_path, created_at, updated_at)
              VALUES ('prof_inner_drop', 'Inner Profile', '/data/inner', ?, ?)
            `).run(now, now);

            throw new Error('Simulated inner failure');
          })();
        } catch (err: any) {
          expect(err.message).toBe('Simulated inner failure');
        }
      })();

      // Confirm outer row exists and inner row was rolled back
      const outerRow = db.prepare("SELECT * FROM profiles WHERE id = 'prof_outer_keep'").get();
      expect(outerRow).toBeDefined();

      const innerRow = db.prepare("SELECT * FROM profiles WHERE id = 'prof_inner_drop'").get();
      expect(innerRow).toBeUndefined();

      closeDatabase();
    });
  });

  // =========================================================================
  // 7. ATOMIC PERSISTENCE & FLUSH
  // =========================================================================
  describe('Path G: Atomic Disk Persistence & Sync Flush', () => {
    const flushDbPath = path.join(tempDir, 'flush_test.sqlite');

    it('persists changes to disk via temp file + atomic rename without leftover tmp files', async () => {
      if (fs.existsSync(flushDbPath)) fs.unlinkSync(flushDbPath);
      setCustomDatabasePath(flushDbPath);
      await initializeDatabase();
      const db = getDatabase();

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO profiles (id, name, storage_path, created_at, updated_at)
        VALUES ('prof_flush_check', 'Flush Check', '/data/flush', ?, ?)
      `).run(now, now);

      // Force synchronous flush to disk
      flushDatabaseToDisk();

      // Verify the file exists on disk and is non-empty
      expect(fs.existsSync(flushDbPath)).toBe(true);
      const stats = fs.statSync(flushDbPath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify no temporary files remain in tempDir
      const files = fs.readdirSync(tempDir);
      const tmpFiles = files.filter(f => f.startsWith('flush_test.sqlite.tmp.'));
      expect(tmpFiles).toHaveLength(0);

      closeDatabase();
    });
  });

  // =========================================================================
  // 8. CORRUPT DATABASE PRESERVATION (ZERO-WIPE SAFETY)
  // =========================================================================
  describe('Path H: Corrupt Database Preservation (Zero Silent Wipe)', () => {
    const corruptDbPath = path.join(tempDir, 'corrupt_sample.sqlite');

    it('preserves corrupt file to .corrupt.<timestamp>.bak instead of wiping it silently', async () => {
      // Create a non-empty file with corrupted contents
      const corruptPayload = 'CRITICAL_USER_DATA_THAT_WAS_CORRUPTED_ON_POWER_LOSS';
      fs.writeFileSync(corruptDbPath, corruptPayload, 'utf-8');

      setCustomDatabasePath(corruptDbPath);

      // getDatabase should detect non-SQLite bytes, preserve the corrupt file, and initialize clean fallback
      const db = getDatabase();
      expect(db).toBeDefined();

      // Check that a .corrupt.<timestamp>.bak file exists
      const files = fs.readdirSync(tempDir);
      const bakFiles = files.filter(f => f.startsWith('corrupt_sample.sqlite.corrupt.'));
      expect(bakFiles.length).toBeGreaterThanOrEqual(1);

      // Check that backup file content matches original corrupted payload
      const backupContent = fs.readFileSync(path.join(tempDir, bakFiles[0]), 'utf-8');
      expect(backupContent).toBe(corruptPayload);

      closeDatabase();
    });
  });

  // =========================================================================
  // 9. MIGRATION ROLLBACK ON DDL FAILURE
  // =========================================================================
  describe('Path I: Migration Rollback on DDL Failure & Helper Idempotency', () => {
    const migDbPath = path.join(tempDir, 'mig_fail_test.sqlite');

    it('rolls back failed migration without recording it in schema_migrations', async () => {
      if (fs.existsSync(migDbPath)) fs.unlinkSync(migDbPath);
      setCustomDatabasePath(migDbPath);
      await initializeDatabase();
      const db = getDatabase();

      // Verify columnExists helper
      expect(columnExists(db, 'profiles', 'name')).toBe(true);
      expect(columnExists(db, 'profiles', 'non_existent_col')).toBe(false);

      // Verify addColumnIfNotExists helper
      addColumnIfNotExists(db, 'profiles', 'test_idempotent_col', 'TEXT DEFAULT NULL');
      expect(columnExists(db, 'profiles', 'test_idempotent_col')).toBe(true);

      // Calling again should not throw
      expect(() => {
        addColumnIfNotExists(db, 'profiles', 'test_idempotent_col', 'TEXT DEFAULT NULL');
      }).not.toThrow();

      // Test runMigration with failure
      expect(() => {
        runMigration(db, 999, 'intentional failure', () => {
          db.exec('CREATE TABLE temp_fail_test (id TEXT PRIMARY KEY);');
          throw new Error('Simulated DDL crash mid-migration');
        });
      }).toThrow(/Simulated DDL crash mid-migration/);

      // Verify version 999 was NOT recorded
      const checkMig = db.prepare('SELECT version FROM schema_migrations WHERE version = 999').get();
      expect(checkMig).toBeUndefined();

      // Verify temp_fail_test table was rolled back
      const checkTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='temp_fail_test'").get();
      expect(checkTable).toBeUndefined();

      closeDatabase();
    });
  });
});
