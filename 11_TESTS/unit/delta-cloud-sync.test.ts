import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createProfile,
  deleteProfile,
  getProfileStoragePath,
} from '../../02_BROWSER/services/profile-service.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import {
  closeDatabase,
  getDatabase,
  initSqlEngine,
  setCustomDatabasePath,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import {
  acquireProfileLockAsync,
  releaseProfileLockAsync,
} from '../../07_BACKEND/services/cloud-profile-service.js';
import {
  clearEncryptedSession,
  saveEncryptedSession,
} from '../../08_SECURITY/account-service.js';
import { decryptProfileArchive } from '../../08_SECURITY/cloud-profile-crypto.js';
import {
  computeProfileManifestHash,
  downloadAndRestoreProfile,
  getEffectiveSyncPassphrase,
  getProfileCloudBinding,
  removeProfileCloudBinding,
  setSyncConfig,
  syncCookiesOnly,
  uploadProfileToCloud,
} from '../../08_SECURITY/cloud-sync-service.js';
import {
  LocalStorageProvider,
  setStorageProviderForTest,
} from '../../08_SECURITY/storage-provider.js';

describe('Layer 2 Step 2: Cookie-Only & Manifest Delta Cloud Sync', () => {
  let tempRootDir: string;
  let tempSqlitePath: string;
  let tempUserDataDir: string;
  let storageDir: string;
  let prevUserDataDir: string | undefined;
  let prevCommercialApiUrl: string | undefined;

  let server: http.Server;
  let baseUrl = '';
  let testUserId = '';
  let testAccessToken = '';
  let httpRequestsLog: Array<{ method: string; url: string }> = [];

  beforeAll(async () => {
    prevUserDataDir = process.env.MAHI_USER_DATA_DIR;
    prevCommercialApiUrl = process.env.COMMERCIAL_API_URL;

    tempRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-delta-sync-'));
    tempUserDataDir = path.join(tempRootDir, 'userdata');
    storageDir = path.join(tempRootDir, 'cloud_storage');
    tempSqlitePath = path.join(tempRootDir, 'delta_sync.sqlite');

    fs.mkdirSync(tempUserDataDir, { recursive: true });
    fs.mkdirSync(storageDir, { recursive: true });
    process.env.MAHI_USER_DATA_DIR = tempUserDataDir;

    setCustomDatabasePath(tempSqlitePath);
    await initSqlEngine();
    await initializeDatabase();

    server = http.createServer(async (req, res) => {
      httpRequestsLog.push({ method: req.method || 'GET', url: req.url || '' });
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
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    process.env.COMMERCIAL_API_URL = baseUrl;
    setStorageProviderForTest(new LocalStorageProvider({ storageDir, baseUrl }));

    const registered = await registerCentralUser({
      email: 'delta_sync_owner@test.mahi.local',
      password: 'Password123!',
      name: 'Delta Sync Owner',
      ipAddress: '127.0.0.1',
    });
    testUserId = registered.user!.id;
    testAccessToken = registered.tokens!.accessToken;

    saveEncryptedSession({
      token: testAccessToken,
      account_id: testUserId,
      email: 'delta_sync_owner@test.mahi.local',
      sync_key: 'delta-sync-master-passphrase-key',
      saved_at: new Date().toISOString(),
    });
    setSyncConfig({ autoSync: true, syncPassphrase: 'delta-sync-master-passphrase-key' });
  });

  afterEach(() => {
    httpRequestsLog = [];
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    clearEncryptedSession();
    setStorageProviderForTest(null);
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
    process.env.MAHI_USER_DATA_DIR = prevUserDataDir;
    if (prevCommercialApiUrl !== undefined) {
      process.env.COMMERCIAL_API_URL = prevCommercialApiUrl;
    } else {
      delete process.env.COMMERCIAL_API_URL;
    }
    try {
      fs.rmSync(tempRootDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('short-circuits unchanged profile manifests (including cache-only changes) with skipped: true and zero network calls', async () => {
    const profile = createProfile({ name: 'ShortCircuit-Profile', engine: 'chrome' });
    const storagePath = getProfileStoragePath(profile.id);
    fs.mkdirSync(path.join(storagePath, 'Default'), { recursive: true });
    fs.writeFileSync(path.join(storagePath, 'Default', 'Preferences'), JSON.stringify({ theme: 'dark' }), 'utf8');
    fs.writeFileSync(
      path.join(storagePath, 'mahi_cookies.json'),
      JSON.stringify([{ domain: '.example.com', name: 'sid', value: 'v1_secret_token' }]),
      'utf8',
    );

    const hashBefore = computeProfileManifestHash(profile.id);
    expect(hashBefore).toMatch(/^[a-f0-9]{64}$/);

    // 1. Initial full upload establishes baseline binding + manifest hash
    const firstUpload = await uploadProfileToCloud(profile.id);
    expect(firstUpload.success).toBe(true);
    expect(firstUpload.skipped).toBe(false);
    expect(firstUpload.mode).toBe('full');
    expect(firstUpload.manifestHash).toBe(hashBefore);
    expect(httpRequestsLog.some((r) => r.url.includes('/api/v1/sync/upload-session'))).toBe(true);

    // 2. Write heavy browser cache bloat ONLY (must be excluded from manifest hash)
    fs.mkdirSync(path.join(storagePath, 'Default', 'Cache'), { recursive: true });
    fs.mkdirSync(path.join(storagePath, 'Default', 'GPUCache'), { recursive: true });
    fs.mkdirSync(path.join(storagePath, 'Default', 'Code Cache'), { recursive: true });
    fs.writeFileSync(path.join(storagePath, 'Default', 'Cache', 'f_0001'), Buffer.alloc(128 * 1024, 0xaa));
    fs.writeFileSync(path.join(storagePath, 'Default', 'GPUCache', 'data_0'), Buffer.alloc(64 * 1024, 0xbb));
    fs.writeFileSync(path.join(storagePath, 'Default', 'Code Cache', 'js_1'), Buffer.alloc(64 * 1024, 0xcc));

    const hashAfterCacheOnly = computeProfileManifestHash(profile.id);
    expect(hashAfterCacheOnly).toBe(hashBefore);

    // 3. Second upload must short-circuit with zero HTTP/network calls
    httpRequestsLog = [];
    const secondUpload = await uploadProfileToCloud(profile.id);
    expect(secondUpload).toMatchObject({
      success: true,
      skipped: true,
      reason: 'unchanged',
      manifestHash: hashBefore,
    });
    expect(httpRequestsLog.length).toBe(0);

    // Same for cookies_only when unchanged
    const thirdUpload = await syncCookiesOnly(profile.id);
    expect(thirdUpload.skipped).toBe(true);
    expect(thirdUpload.reason).toBe('unchanged');
    expect(httpRequestsLog.length).toBe(0);

    removeProfileCloudBinding(profile.id);
    deleteProfile(profile.id);
  });

  it('encrypts lightweight cookie-only deltas with AES-256-GCM without overwriting full snapshot and round-trips cookies accurately', async () => {
    const profile = createProfile({ name: 'CookieDelta-Profile', engine: 'chrome' });
    const storagePath = getProfileStoragePath(profile.id);
    fs.mkdirSync(path.join(storagePath, 'Default', 'IndexedDB'), { recursive: true });
    fs.mkdirSync(path.join(storagePath, 'Default', 'Network'), { recursive: true });
    fs.mkdirSync(path.join(storagePath, 'Default', 'Local Storage', 'leveldb'), { recursive: true });

    // Large non-cookie profile state (~750 KB incompressible random bytes) that should stay in full snapshot
    const heavyIndexedDbPayload = crypto.randomBytes(750 * 1024);
    fs.writeFileSync(path.join(storagePath, 'Default', 'IndexedDB', 'large_app_state.bin'), heavyIndexedDbPayload);
    fs.writeFileSync(path.join(storagePath, 'Default', 'Preferences'), JSON.stringify({ lang: 'en-US' }), 'utf8');
    fs.writeFileSync(
      path.join(storagePath, 'mahi_cookies.json'),
      JSON.stringify([{ domain: '.app.example', name: 'auth_session', value: 'initial-cookie-v1' }]),
      'utf8',
    );
    fs.writeFileSync(path.join(storagePath, 'Default', 'Network', 'Cookies'), Buffer.from('SQLite format 3\0v1'));

    // 1. Initial full sync
    const fullRes = await uploadProfileToCloud(profile.id);
    expect(fullRes.success).toBe(true);
    expect(fullRes.mode).toBe('full');
    const cloudProfileId = fullRes.cloudProfile!.id;
    const baseVersion = fullRes.cloudProfile!.version;
    expect(baseVersion).toBe(1);

    const db = getDatabase();
    const versionRowBefore = db
      .prepare('SELECT * FROM cloud_profile_versions WHERE cloud_profile_id = ? AND version = 1')
      .get(cloudProfileId) as any;
    expect(versionRowBefore).toBeTruthy();
    expect(versionRowBefore.file_size).toBeGreaterThan(700 * 1024);

    // 2. Update ONLY session cookies & local storage with a unique secret token
    const updatedSecretCookie = 'super-secret-rotated-jwt-token-998877';
    const updatedCookies = [
      { domain: '.app.example', name: 'auth_session', value: updatedSecretCookie, httpOnly: true, secure: true },
      { domain: '.app.example', name: 'csrf_token', value: 'csrf-val-42', httpOnly: false, secure: true },
    ];
    fs.writeFileSync(path.join(storagePath, 'mahi_cookies.json'), JSON.stringify(updatedCookies, null, 2), 'utf8');
    fs.writeFileSync(path.join(storagePath, 'Default', 'Network', 'Cookies'), Buffer.from('SQLite format 3\0v2-updated-cookies'));
    fs.writeFileSync(
      path.join(storagePath, 'Default', 'Local Storage', 'leveldb', '000003.log'),
      Buffer.from('localstorage-token=delta-ok'),
    );

    // 3. Run lightweight cookie-only sync
    const deltaRes = await syncCookiesOnly(profile.id);
    expect(deltaRes.success).toBe(true);
    expect(deltaRes.skipped).toBe(false);
    expect(deltaRes.mode).toBe('cookies_only');
    expect(deltaRes.cloudProfile?.id).toBe(cloudProfileId);
    expect(deltaRes.cloudProfile?.version).toBe(1); // Base full snapshot version preserved!
    expect(deltaRes.cloudProfile?.deltaVersion).toBe(1);

    // Verify full snapshot v1 row & version counter remain intact
    const cloudProfileRow = db.prepare('SELECT * FROM cloud_profiles WHERE id = ?').get(cloudProfileId) as any;
    expect(cloudProfileRow.current_version).toBe(1);
    const fullVersionsCount = db
      .prepare('SELECT COUNT(*) as cnt FROM cloud_profile_versions WHERE cloud_profile_id = ?')
      .get(cloudProfileId) as { cnt: number };
    expect(fullVersionsCount.cnt).toBe(1);

    // Verify encrypted delta metadata row & ciphertext properties (zero-knowledge AES-256-GCM + tiny size)
    const deltaRow = db
      .prepare('SELECT * FROM cloud_profile_deltas WHERE cloud_profile_id = ? AND delta_version = 1')
      .get(cloudProfileId) as any;
    expect(deltaRow).toBeTruthy();
    expect(deltaRow.file_size).toBeLessThan(20 * 1024); // Dramatically smaller than >700 KB full snapshot!
    expect(deltaRow.file_size).toBeLessThan(versionRowBefore.file_size / 20);

    // Verify stored object on disk is AES-256-GCM ciphertext (NEVER plaintext cookies)
    const provider = new LocalStorageProvider({ storageDir, baseUrl });
    const storedDeltaCiphertext = await provider.getObject(deltaRow.object_key);
    expect(storedDeltaCiphertext).not.toBeNull();
    expect(storedDeltaCiphertext!.toString('utf8')).not.toContain(updatedSecretCookie);
    expect(storedDeltaCiphertext!.toString('utf8')).not.toContain('mahi-cookies-delta-v1');

    // Verify explicit decrypt with user passphrase recovers compressed delta
    const decryptedBuf = decryptProfileArchive({
      ciphertext: storedDeltaCiphertext!,
      expectedChecksum: deltaRow.checksum_sha256,
      encryptedDataKey: deltaRow.encrypted_data_key,
      iv: deltaRow.iv,
      authTag: deltaRow.auth_tag,
      userMasterKey: getEffectiveSyncPassphrase(),
    });
    expect(decryptedBuf.length).toBeGreaterThan(10);

    // 4. Restore cookie-only delta onto a second local target profile (keeps other files intact, updates cookies)
    const targetProfile = createProfile({ name: 'CookieDelta-Target', engine: 'chrome' });
    const targetStorage = getProfileStoragePath(targetProfile.id);
    fs.mkdirSync(path.join(targetStorage, 'Default'), { recursive: true });
    fs.writeFileSync(path.join(targetStorage, 'Default', 'Preferences'), JSON.stringify({ keepMe: true }), 'utf8');

    await downloadAndRestoreProfile(cloudProfileId, {
      targetLocalProfileId: targetProfile.id,
      mode: 'cookies_only',
    });

    const restoredCookies = JSON.parse(fs.readFileSync(path.join(targetStorage, 'mahi_cookies.json'), 'utf8'));
    expect(restoredCookies).toEqual(updatedCookies);
    expect(fs.readFileSync(path.join(targetStorage, 'Default', 'Network', 'Cookies'), 'utf8')).toBe(
      'SQLite format 3\0v2-updated-cookies',
    );
    expect(fs.readFileSync(path.join(targetStorage, 'Default', 'Local Storage', 'leveldb', '000003.log'), 'utf8')).toBe(
      'localstorage-token=delta-ok',
    );
    expect(JSON.parse(fs.readFileSync(path.join(targetStorage, 'Default', 'Preferences'), 'utf8'))).toEqual({
      keepMe: true,
    });

    // 5. Full restore onto a fresh 3rd profile ALSO includes full IndexedDB + overlays the latest cookie delta!
    const freshProfile = createProfile({ name: 'FullPlusDelta-Target', engine: 'chrome' });
    const freshStorage = getProfileStoragePath(freshProfile.id);
    await downloadAndRestoreProfile(cloudProfileId, {
      targetLocalProfileId: freshProfile.id,
      mode: 'full',
    });

    expect(fs.readFileSync(path.join(freshStorage, 'Default', 'IndexedDB', 'large_app_state.bin'))).toEqual(
      heavyIndexedDbPayload,
    );
    expect(JSON.parse(fs.readFileSync(path.join(freshStorage, 'mahi_cookies.json'), 'utf8'))).toEqual(updatedCookies);

    removeProfileCloudBinding(profile.id);
    removeProfileCloudBinding(targetProfile.id);
    removeProfileCloudBinding(freshProfile.id);
    deleteProfile(profile.id);
    deleteProfile(targetProfile.id);
    deleteProfile(freshProfile.id);
  });

  it('falls back gracefully to full tarball sync when no base snapshot exists and enforces distributed locks', async () => {
    const newProfile = createProfile({ name: 'Fallback-NoBase-Profile', engine: 'chrome' });
    const storagePath = getProfileStoragePath(newProfile.id);
    fs.mkdirSync(path.join(storagePath, 'Default'), { recursive: true });
    fs.writeFileSync(path.join(storagePath, 'Default', 'Preferences'), JSON.stringify({ clean: true }), 'utf8');
    fs.writeFileSync(
      path.join(storagePath, 'mahi_cookies.json'),
      JSON.stringify([{ domain: '.fallback.test', name: 'k', value: 'v' }]),
      'utf8',
    );

    // 1. Calling cookies_only with NO base snapshot falls back gracefully to full sync v1
    const res = await uploadProfileToCloud(newProfile.id, { mode: 'cookies_only' });
    expect(res.success).toBe(true);
    expect(res.mode).toBe('full');
    expect(res.cloudProfile?.version).toBe(1);

    const cloudProfileId = res.cloudProfile!.id;
    const binding = getProfileCloudBinding(newProfile.id);
    expect(binding?.lastSyncedVersion).toBe(1);

    // 2. Simulate another device holding distributed lock -> syncCookiesOnly must reject with lock error
    fs.writeFileSync(
      path.join(storagePath, 'mahi_cookies.json'),
      JSON.stringify([{ domain: '.fallback.test', name: 'k', value: 'v2-changed' }]),
      'utf8',
    );
    const foreignLock = await acquireProfileLockAsync(testUserId, cloudProfileId, 'other-device-id', 'Other PC', 120);
    expect(foreignLock.acquired).toBe(true);

    await expect(syncCookiesOnly(newProfile.id)).rejects.toThrow(/locked by another device/i);

    // 3. Release foreign lock -> syncCookiesOnly acquires, uploads delta, and releases lock cleanly
    await releaseProfileLockAsync(testUserId, cloudProfileId, 'other-device-id');
    const afterUnlock = await syncCookiesOnly(newProfile.id);
    expect(afterUnlock.success).toBe(true);
    expect(afterUnlock.mode).toBe('cookies_only');
    expect(afterUnlock.cloudProfile?.deltaVersion).toBe(1);

    // Confirm lock was released after sync completed
    const db = getDatabase();
    const lockRow = db.prepare('SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ?').get(cloudProfileId);
    expect(lockRow).toBeUndefined();

    removeProfileCloudBinding(newProfile.id);
    deleteProfile(newProfile.id);
  });
});
