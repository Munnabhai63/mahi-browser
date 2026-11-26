import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  backupDatabaseBeforeMigration,
  closeDatabase,
  getDatabase,
  initSqlEngine,
  setCustomDatabasePath,
  snapshotSyncConfigFirstRun,
} from '../../06_DATABASE/connection.js';
import {
  getAppSchemaVersion,
  initializeDatabase,
  stampAppSchemaVersion,
} from '../../06_DATABASE/schema.js';

describe('LAYER 0 TASK 0.1: Pre-Update Backups & app_schema_version Stamp', () => {
  let tempDir: string;
  let prevUserDataDir: string | undefined;

  beforeEach(() => {
    prevUserDataDir = process.env.MAHI_USER_DATA_DIR;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer0-backup-'));
    process.env.MAHI_USER_DATA_DIR = tempDir;
  });

  afterEach(() => {
    closeDatabase();
    if (prevUserDataDir !== undefined) {
      process.env.MAHI_USER_DATA_DIR = prevUserDataDir;
    } else {
      delete process.env.MAHI_USER_DATA_DIR;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('creates pre-migration backup with WAL/SHM sidecars and stamps app_schema_version = 1', async () => {
    const dbPath = path.join(tempDir, 'mahi_browser.sqlite');
    setCustomDatabasePath(dbPath);
    await initSqlEngine();

    // First initialization creates fresh DB and stamps app_schema_version = 1
    await initializeDatabase();
    const db = getDatabase();
    const row = db
      .prepare('SELECT version, appliedAt FROM app_schema_version WHERE version = 1')
      .get() as { version: number; appliedAt: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.version).toBe(1);
    expect(typeof row?.appliedAt).toBe('string');
    expect(getAppSchemaVersion(db)).toBe(1);

    // Flush DB to disk and simulate WAL/SHM sidecars before next startup migration run
    closeDatabase();
    fs.writeFileSync(`${dbPath}-wal`, Buffer.from('mock-wal-bytes'));
    fs.writeFileSync(`${dbPath}-shm`, Buffer.from('mock-shm-bytes'));

    // Next startup initialization runs backupDatabaseBeforeMigration() BEFORE touching DB
    setCustomDatabasePath(dbPath);
    await initializeDatabase();

    const dbBackupsDir = path.join(tempDir, 'backups', 'db');
    expect(fs.existsSync(dbBackupsDir)).toBe(true);

    const backupFiles = fs
      .readdirSync(dbBackupsDir)
      .filter((f) => f.startsWith('pre-v1-') && f.endsWith('.sqlite'));
    expect(backupFiles.length).toBe(1);

    const backupPath = path.join(dbBackupsDir, backupFiles[0]);
    expect(fs.existsSync(`${backupPath}-wal`)).toBe(true);
    expect(fs.existsSync(`${backupPath}-shm`)).toBe(true);
    expect(fs.readFileSync(`${backupPath}-wal`, 'utf8')).toBe('mock-wal-bytes');
    expect(fs.readFileSync(`${backupPath}-shm`, 'utf8')).toBe('mock-shm-bytes');

    // Verify incremental stamping helper works cleanly
    stampAppSchemaVersion(getDatabase(), 2);
    expect(getAppSchemaVersion(getDatabase())).toBe(2);
  });

  it('retains only the 5 newest DB backups and deletes older backups with sidecars', async () => {
    const dbPath = path.join(tempDir, 'mahi_retention.sqlite');
    const backupsDir = path.join(tempDir, 'backups', 'db');
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from('SQLite format 3\0dummy-content'));

    // Seed 7 older backups with ascending timestamps
    const baseTime = Date.now() - 100_000;
    for (let i = 1; i <= 7; i++) {
      const staleFile = path.join(backupsDir, `pre-v1-2026-01-01T00-00-0${i}-000Z.sqlite`);
      fs.writeFileSync(staleFile, Buffer.from(`backup-${i}`));
      fs.writeFileSync(`${staleFile}-wal`, Buffer.from(`wal-${i}`));
      const t = new Date(baseTime + i * 1000);
      fs.utimesSync(staleFile, t, t);
    }

    const res = backupDatabaseBeforeMigration({
      dbPath,
      backupsDir,
      keepCount: 5,
    });

    expect(res.backedUp).toBe(true);
    expect(res.removedCount).toBe(3);

    const remainingSqlite = fs
      .readdirSync(backupsDir)
      .filter((f) => /^pre-.*\.sqlite$/i.test(f));
    expect(remainingSqlite.length).toBe(5);
    expect(remainingSqlite.some((f) => f.includes('00-00-01'))).toBe(false);
    expect(remainingSqlite.some((f) => f.includes('00-00-02'))).toBe(false);
    expect(remainingSqlite.some((f) => f.includes('00-00-03'))).toBe(false);
    expect(fs.existsSync(path.join(backupsDir, 'pre-v1-2026-01-01T00-00-01-000Z.sqlite-wal'))).toBe(
      false,
    );
  });

  it('initializes database cleanly even when backups directory cannot be written', async () => {
    // Occupy `<userData>/backups` with a regular file so mkdirSync(backups/db) throws EEXIST/ENOTDIR
    fs.writeFileSync(path.join(tempDir, 'backups'), 'read-only-blocker-file', 'utf8');

    const dbPath = path.join(tempDir, 'mahi_browser.sqlite');
    fs.writeFileSync(dbPath, Buffer.alloc(0));
    setCustomDatabasePath(dbPath);

    await expect(initializeDatabase()).resolves.toBeUndefined();
    expect(getAppSchemaVersion(getDatabase())).toBe(1);

    // Explicit backup call also degrades safely without throwing
    const backupRes = backupDatabaseBeforeMigration({ dbPath });
    expect(backupRes.backedUp).toBe(false);
  });

  it('snapshots cloud sync configs into backups/config/<timestamp>/ once on first run', () => {
    const syncConfig = { autoSync: true, syncPassphrase: 'test-passphrase-value' };
    const syncBindings = { p1: { cloudProfileId: 'c1', lastSyncedVersion: 3 } };
    const syncStatus = { p1: { status: 'SYNCED', updatedAt: '2026-11-26T00:00:00Z' } };

    fs.writeFileSync(path.join(tempDir, 'cloud-sync-config.json'), JSON.stringify(syncConfig));
    fs.writeFileSync(path.join(tempDir, 'cloud-profile-bindings.json'), JSON.stringify(syncBindings));
    fs.writeFileSync(path.join(tempDir, 'cloud-sync-status.json'), JSON.stringify(syncStatus));

    const firstSnap = snapshotSyncConfigFirstRun({ userDataDir: tempDir });
    expect(firstSnap.snapshotted).toBe(true);
    expect(firstSnap.filesCopied.sort()).toEqual([
      'cloud-profile-bindings.json',
      'cloud-sync-config.json',
      'cloud-sync-status.json',
    ]);
    expect(firstSnap.snapshotDir).toBeDefined();
    expect(
      JSON.parse(
        fs.readFileSync(path.join(firstSnap.snapshotDir!, 'cloud-sync-config.json'), 'utf8'),
      ),
    ).toEqual(syncConfig);

    // Subsequent startup does NOT create duplicate snapshots
    const secondSnap = snapshotSyncConfigFirstRun({ userDataDir: tempDir });
    expect(secondSnap.snapshotted).toBe(false);
    expect(secondSnap.filesCopied).toEqual([]);
  });
});
