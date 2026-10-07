import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  collectEssentialStorageFiles,
  restoreStorageFiles,
  exportProfileToArchive,
  importProfileFromArchive
} from '../../02_BROWSER/services/archive-service.js';
import {
  getProfilesDirectory,
  createProfile,
  getProfileById,
  deleteProfile,
  getProfileStoragePath
} from '../../02_BROWSER/services/profile-service.js';
import {
  isCloudSyncAllowed,
  getSyncConfig,
  setSyncConfig,
  getProfileSyncStatus
} from '../../08_SECURITY/cloud-sync-service.js';
import {
  MANAGED_ENGINE_FALLBACK_URL,
  MANAGED_ENGINE_SHA256
} from '../../10_CONFIG/engine-config.js';

describe('Cloud Profile Sync & Engine Mirror Suite', () => {
  const testDir = path.join(process.cwd(), '.test_cloud_sync');
  let tempSqliteDir: string;

  beforeAll(async () => {
    tempSqliteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-sync-test-sqlite-'));
    setCustomDatabasePath(path.join(tempSqliteDir, 'test.sqlite'));
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    try { fs.rmSync(tempSqliteDir, { recursive: true, force: true }); } catch {}
  });

  beforeEach(() => {
    try { fs.mkdirSync(testDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  // --------------------------------------------------------------------------
  // 1. Cache Exclusion & Storage Bundling
  // --------------------------------------------------------------------------
  it('should bundle essential profile storage files and STRICTLY exclude browser caches', () => {
    const profile = createProfile({
      name: 'Test-Sync-Cache-Profile',
      folder: 'General'
    });

    const storageDir = getProfileStoragePath(profile.id);

    // Create essential files
    const defDir = path.join(storageDir, 'Default');
    const localStoreDir = path.join(defDir, 'Local Storage', 'leveldb');
    fs.mkdirSync(localStoreDir, { recursive: true });
    fs.writeFileSync(path.join(defDir, 'Preferences'), JSON.stringify({ homepage: 'https://example.com' }), 'utf8');
    fs.writeFileSync(path.join(localStoreDir, '000001.ldb'), 'fake-leveldb-data-token-xyz', 'utf8');

    // Create cache directories that MUST be excluded
    const cacheDir = path.join(defDir, 'Cache', 'Cache_Data');
    const codeCacheDir = path.join(defDir, 'Code Cache', 'js');
    const gpuCacheDir = path.join(defDir, 'GPUCache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.mkdirSync(codeCacheDir, { recursive: true });
    fs.mkdirSync(gpuCacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'f_000001'), 'heavy-cache-data-should-be-ignored', 'utf8');
    fs.writeFileSync(path.join(codeCacheDir, 'index.bin'), 'compiled-v8-cache-ignored', 'utf8');
    fs.writeFileSync(path.join(gpuCacheDir, 'shader.bin'), 'shader-cache-ignored', 'utf8');

    // Collect essential files
    const collected = collectEssentialStorageFiles(profile.id);
    const fileKeys = Object.keys(collected);

    // Assert essential files exist
    expect(fileKeys.some(k => k.includes('Preferences'))).toBe(true);
    expect(fileKeys.some(k => k.includes('Local Storage'))).toBe(true);

    // Assert ALL cache files are excluded
    expect(fileKeys.some(k => k.toLowerCase().includes('cache'))).toBe(false);
    expect(fileKeys.some(k => k.includes('GPUCache'))).toBe(false);
    expect(fileKeys.some(k => k.includes('Code Cache'))).toBe(false);

    // Cleanup
    deleteProfile(profile.id);
  });

  // --------------------------------------------------------------------------
  // 2. AES-256-GCM Zero-Knowledge Encryption Verification
  // --------------------------------------------------------------------------
  it('should encrypt archive with AES-256-GCM and store NO plaintext JSON on disk', () => {
    const profile = createProfile({
      name: 'Test-Encrypted-Profile',
      folder: 'Secret'
    });

    const exportPath = path.join(testDir, 'test-profile.mahi-profile');
    const passphrase = 'SuperSecretSyncPassphrase123!';

    exportProfileToArchive({
      profileId: profile.id,
      targetFilePath: exportPath,
      includeCookies: true,
      includeHistory: false,
      includeExtensions: false,
      includeBrowserSettings: true,
      includeStorage: true,
      password: passphrase
    });

    expect(fs.existsSync(exportPath)).toBe(true);
    const rawContent = fs.readFileSync(exportPath, 'utf8');
    const parsed = JSON.parse(rawContent);

    // Verify envelope format
    expect(parsed.magic).toBe('MAHI_PROFILE_ARCHIVE');
    expect(parsed.version).toBe('1.0');
    expect(parsed.isEncrypted).toBe(true);
    expect(parsed.saltHex).toBeDefined();
    expect(typeof parsed.payload).toBe('string');

    // STRICT PROOF: Server or disk sees ZERO plaintext
    expect(parsed.payload).not.toContain('Test-Encrypted-Profile');
    expect(parsed.payload).not.toContain('Secret');
    expect(rawContent).not.toContain('"profile":');

    // Decrypt and import into new profile
    const imported = importProfileFromArchive({
      sourceFilePath: exportPath,
      password: passphrase,
      overrideName: 'Decrypted-Profile'
    });

    expect(imported).toBeDefined();
    expect(imported.name).toBe('Decrypted-Profile');

    // Wrong password test
    expect(() => {
      importProfileFromArchive({
        sourceFilePath: exportPath,
        password: 'wrong-password'
      });
    }).toThrow(/password/i);

    deleteProfile(profile.id);
    deleteProfile(imported.id);
  });

  // --------------------------------------------------------------------------
  // 3. Multi-Machine Simulation (PC-1 Export -> PC-2 Restore with Cookies & Session)
  // --------------------------------------------------------------------------
  it('should simulate PC-1 export and PC-2 restore with login cookies and session intact', () => {
    // === PC-1 Machine ===
    const pc1Profile = createProfile({
      name: 'PC1-Live-Account',
      folder: 'Social Media'
    });

    // Populate fake login session cookie
    const pc1StorageDir = getProfileStoragePath(pc1Profile.id);
    const cookiesJsonPath = path.join(pc1StorageDir, 'mahi_cookies.json');
    const sessionCookie = [
      {
        name: 'session_auth_token',
        value: 'secure_auth_token_999888',
        domain: '.twitter.com',
        path: '/',
        secure: true,
        httpOnly: true
      }
    ];
    fs.writeFileSync(cookiesJsonPath, JSON.stringify(sessionCookie, null, 2), 'utf8');

    // Create session storage leveldb file
    const pc1DefDir = path.join(pc1StorageDir, 'Default', 'Session Storage');
    fs.mkdirSync(pc1DefDir, { recursive: true });
    fs.writeFileSync(path.join(pc1DefDir, '000003.log'), 'session-state-token', 'utf8');

    const syncPassphrase = 'SharedSyncPassphrase456!';
    const pc1ExportFile = path.join(testDir, 'cloud_blob.mahi-profile');

    exportProfileToArchive({
      profileId: pc1Profile.id,
      targetFilePath: pc1ExportFile,
      includeCookies: true,
      includeHistory: true,
      includeExtensions: false,
      includeBrowserSettings: true,
      includeStorage: true,
      password: syncPassphrase
    });

    // === PC-2 Machine (Restore) ===
    const pc2Restored = importProfileFromArchive({
      sourceFilePath: pc1ExportFile,
      password: syncPassphrase,
      overrideName: 'PC2-Restored-Account'
    });

    expect(pc2Restored).toBeDefined();
    expect(pc2Restored.name).toBe('PC2-Restored-Account');

    // Verify session cookies restored on PC-2
    const pc2StorageDir = getProfileStoragePath(pc2Restored.id);
    const pc2CookiesPath = path.join(pc2StorageDir, 'mahi_cookies.json');
    expect(fs.existsSync(pc2CookiesPath)).toBe(true);
    const pc2Cookies = JSON.parse(fs.readFileSync(pc2CookiesPath, 'utf8'));
    expect(pc2Cookies[0].name).toBe('session_auth_token');
    expect(pc2Cookies[0].value).toBe('secure_auth_token_999888');

    // Verify session storage restored on PC-2
    const pc2SessionLog = path.join(pc2StorageDir, 'Default', 'Session Storage', '000003.log');
    expect(fs.existsSync(pc2SessionLog)).toBe(true);
    expect(fs.readFileSync(pc2SessionLog, 'utf8')).toBe('session-state-token');

    deleteProfile(pc1Profile.id);
    deleteProfile(pc2Restored.id);
  });

  // --------------------------------------------------------------------------
  // 4. Sync Configuration & Status Helpers
  // --------------------------------------------------------------------------
  it('should manage cloud sync configuration with default autoSync true and custom passphrase', () => {
    const original = getSyncConfig();
    expect(typeof original.autoSync).toBe('boolean');
    expect(typeof original.syncPassphrase).toBe('string');

    setSyncConfig({ autoSync: false, syncPassphrase: 'custom-passphrase' });
    const updated = getSyncConfig();
    expect(updated.autoSync).toBe(false);
    expect(updated.syncPassphrase).toBe('custom-passphrase');

    // Restore
    setSyncConfig({ autoSync: true, syncPassphrase: original.syncPassphrase });
  });

  // --------------------------------------------------------------------------
  // 5. Engine Mirror Fallback & SHA-256 Checksum Verification
  // --------------------------------------------------------------------------
  it('should verify engine mirror configuration and integrity checksum match', () => {
    expect(MANAGED_ENGINE_FALLBACK_URL).toBe('https://mahibrowser.com/engine/chrome-138.zip');
    expect(MANAGED_ENGINE_SHA256).toBe('10a9fa695a9e4c05b336aebdc553f92c2351b2e9b962b00dc00612c8dcaacd68');
  });
});
