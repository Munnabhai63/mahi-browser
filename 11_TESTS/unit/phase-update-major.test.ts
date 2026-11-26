import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
  snapshotSyncConfigFirstRun,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase, getAppSchemaVersion } from '../../06_DATABASE/schema.js';
import { getProfileById } from '../../02_BROWSER/services/profile-service.js';
import { buildSanitizedLaunchArgs } from '../../02_BROWSER/launcher.js';
import { cleanOldEngineVersions } from '../../02_BROWSER/managed-engine.js';
import { getSyncConfig } from '../../08_SECURITY/cloud-sync-service.js';
import { decryptProfileArchive, encryptProfileArchive } from '../../08_SECURITY/cloud-profile-crypto.js';

describe('Layer 5: Simulated In-Place Auto-Update Upgrade QA (Existing User Data Safety)', () => {
  const tempDirs: string[] = [];
  const prevUserDataDir = process.env.MAHI_USER_DATA_DIR;
  const prevEnginesDir = process.env.MAHI_ENGINES_DIR;

  afterEach(() => {
    closeDatabase();
    if (prevUserDataDir === undefined) delete process.env.MAHI_USER_DATA_DIR;
    else process.env.MAHI_USER_DATA_DIR = prevUserDataDir;
    if (prevEnginesDir === undefined) delete process.env.MAHI_ENGINES_DIR;
    else process.env.MAHI_ENGINES_DIR = prevEnginesDir;

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('preserves pre-upgrade SQLite DB, legacy stored profile settings, cookies, sync bindings, v1 cloud backups, and installed engines across two-boot upgrade', async () => {
    const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-upgrade-sim-'));
    tempDirs.push(tmpUserData);
    process.env.MAHI_USER_DATA_DIR = tmpUserData;
    const dbPath = path.join(tmpUserData, 'mahi_browser.sqlite');
    const enginesDir = path.join(tmpUserData, 'engines');
    process.env.MAHI_ENGINES_DIR = enginesDir;

    // 1. Seed realistic pre-update user state (v1.2.2 layout WITHOUT app_schema_version table)
    const syncConfigPath = path.join(tmpUserData, 'cloud-sync-config.json');
    const syncBindingsPath = path.join(tmpUserData, 'cloud-profile-bindings.json');
    fs.writeFileSync(syncConfigPath, JSON.stringify({ autoSync: true, syncPassphrase: 'mahi-cloud-sync' }));
    fs.writeFileSync(
      syncBindingsPath,
      JSON.stringify({ 'legacy-prof-1': { cloudProfileId: 'cloud-1', lastSyncedVersion: 4 } })
    );

    const legacyProfileStorage = path.join(tmpUserData, 'profiles', 'legacy-prof-1');
    fs.mkdirSync(legacyProfileStorage, { recursive: true });
    const legacyCookies = [{ name: 'session', value: 'keep_session_xyz', domain: '.example.com' }];
    fs.writeFileSync(path.join(legacyProfileStorage, 'mahi_cookies.json'), JSON.stringify(legacyCookies));

    // Existing bundled 138 engine installation
    fs.mkdirSync(path.join(enginesDir, '138.0.7204.0', 'chrome-win'), { recursive: true });
    fs.writeFileSync(path.join(enginesDir, '138.0.7204.0', 'chrome-win', 'chrome.exe'), 'MZ');

    // Initialize pre-update DB, then drop app_schema_version to simulate v1.2.2 user DB
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
    const db = getDatabase();
    db.exec('DROP TABLE IF EXISTS app_schema_version;');

    const now = new Date().toISOString();
    const legacyRawSettingsJson = JSON.stringify({
      browser: { engine: 'chrome', version: '138.0.7204.0', userAgent: 'Mozilla/5.0 Chrome/138.0.7204.0' },
      network: { directConnection: true, webrtc: 'default' },
      locale: { language: 'en-US', timezone: 'America/New_York' },
      display: { screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 1 },
      customLegacyExtensionMeta: { preserved: true, note: 'do-not-rewrite' },
    });

    db.prepare(`
      INSERT INTO profiles (id, name, description, folder, notes, status, storage_path, pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('legacy-prof-1', 'Existing Store Profile', 'legacy', 'General', 'important notes', 'STOPPED', legacyProfileStorage, 1, now, now);

    db.prepare(`INSERT INTO profile_settings (profile_id, settings_json) VALUES (?, ?)`).run(
      'legacy-prof-1',
      legacyRawSettingsJson
    );
    closeDatabase();

    // Create a legacy v1 encrypted backup blob before upgrade
    const v1Archive = Buffer.from('legacy-v1-backup-archive');
    const v1EncryptedPkg = encryptProfileArchive(v1Archive, 'mahi-cloud-sync', { keyVersion: 1 });

    // 2. Simulate Boot #1 after auto-update installation
    const cfgSnap1 = snapshotSyncConfigFirstRun({ userDataDir: tmpUserData });
    expect(cfgSnap1.snapshotted).toBe(true);

    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();

    expect(getAppSchemaVersion()).toBe(1);
    const dbBackupsDir = path.join(tmpUserData, 'backups', 'db');
    expect(fs.readdirSync(dbBackupsDir).some((f) => f.startsWith('pre-v') && f.endsWith('.sqlite'))).toBe(true);

    // Raw DB JSON MUST remain untouched
    const rawRowAfterBoot = getDatabase()
      .prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?')
      .get('legacy-prof-1') as { settings_json: string };
    expect(rawRowAfterBoot.settings_json).toBe(legacyRawSettingsJson);

    // Runtime profile load fills safe defaults without mutating DB
    const loadedProfile = getProfileById('legacy-prof-1');
    expect(loadedProfile).toBeDefined();
    expect((loadedProfile!.settings as any).customLegacyExtensionMeta).toEqual({ preserved: true, note: 'do-not-rewrite' });
    expect(loadedProfile!.settings.network.webrtc).toBe('default');
    expect(loadedProfile!.settings.locale.autoSyncFromIp).toBeUndefined();

    // Runtime launch args enforce WebRTC UDP protection and omit fixed CDP debugging port
    const launchArgs = buildSanitizedLaunchArgs({
      storageDir: loadedProfile!.storagePath,
      settings: loadedProfile!.settings,
      mode: 'normal',
    });
    expect(launchArgs).toContain('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
    expect(launchArgs.some((a) => a.startsWith('--remote-debugging-port='))).toBe(false);

    // Cookies & engine & sync config remain intact
    expect(JSON.parse(fs.readFileSync(path.join(legacyProfileStorage, 'mahi_cookies.json'), 'utf8'))).toEqual(legacyCookies);
    cleanOldEngineVersions('158.0.8127.88');
    expect(fs.existsSync(path.join(enginesDir, '138.0.7204.0', 'chrome-win', 'chrome.exe'))).toBe(true);
    expect(getSyncConfig()).toMatchObject({ autoSync: true, syncPassphrase: 'mahi-cloud-sync', keyDerivationVersion: 1 });

    // Legacy v1 cloud backup still decrypts cleanly
    const dec = decryptProfileArchive({
      ciphertext: v1EncryptedPkg.ciphertext,
      expectedChecksum: v1EncryptedPkg.checksumSha256,
      encryptedDataKey: v1EncryptedPkg.encryptedDataKey,
      iv: v1EncryptedPkg.iv,
      authTag: v1EncryptedPkg.authTag,
      userMasterKey: 'mahi-cloud-sync',
    });
    expect(dec.equals(v1Archive)).toBe(true);

    closeDatabase();

    // 3. Simulate Boot #2 (idempotent re-launch)
    const cfgSnap2 = snapshotSyncConfigFirstRun({ userDataDir: tmpUserData });
    expect(cfgSnap2.snapshotted).toBe(false);

    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
    expect(getAppSchemaVersion()).toBe(1);
    expect(getProfileById('legacy-prof-1')?.name).toBe('Existing Store Profile');
  });
});
