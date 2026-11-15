/**
 * MAHI Browser — Phase 2: Cloudflare R2 & session.tar.gz Cloud Sync Verification Suite
 * 
 * Tests:
 * 1. Cloudflare R2 Object Storage Provider hardening & AWS SigV4 Presigned DELETE fix.
 * 2. Pure-Node POSIX ustar session.tar.gz creation, cache bloat exclusion (Section 6), and extraction.
 * 3. Security guards: Path traversal prevention, gzip magic validation, and atomic rollback.
 * 4. Client-side Zero-Knowledge AES-256-GCM envelope encryption and SHA-256 integrity verification.
 * 5. Launch-time pull (syncProfileIfCloudNewer) and close-time push lifecycle coordination.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {
  S3R2StorageProvider,
  LocalStorageProvider,
  getStorageProvider,
  setStorageProviderForTest,
} from '../../08_SECURITY/storage-provider.js';
import {
  isPathExcludedFromSync,
  packProfileSessionTarGz,
  unpackProfileSessionTarGz,
} from '../../02_BROWSER/services/archive-service.js';
import {
  initSqlEngine,
  setCustomDatabasePath,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProfile,
  getProfileById,
  deleteProfile,
  getProfileStoragePath,
} from '../../02_BROWSER/services/profile-service.js';
import {
  encryptProfileArchive,
  decryptProfileArchive,
} from '../../08_SECURITY/cloud-profile-crypto.js';
import {
  syncProfileIfCloudNewer,
  setProfileCloudBinding,
  getProfileCloudBinding,
  removeProfileCloudBinding,
} from '../../08_SECURITY/cloud-sync-service.js';

describe('PHASE 2: Cloudflare R2 & session.tar.gz Cloud Sync Engine', () => {
  let tempTestDir: string;
  let tempSqliteDir: string;

  beforeAll(async () => {
    tempSqliteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-sqlite-'));
    setCustomDatabasePath(path.join(tempSqliteDir, 'phase2-test.sqlite'));
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    try { fs.rmSync(tempSqliteDir, { recursive: true, force: true }); } catch {}
  });

  beforeEach(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-work-'));
    setStorageProviderForTest(null);
  });

  afterEach(() => {
    setStorageProviderForTest(null);
    vi.restoreAllMocks();
    try { fs.rmSync(tempTestDir, { recursive: true, force: true }); } catch {}
  });

  // ==========================================================================
  // 1. CLOUDFLARE R2 & S3 STORAGE PROVIDER HARDENING
  // ==========================================================================
  describe('1. Cloudflare R2 SigV4 Presigned Authentication & Connectivity', () => {
    it('generates AWS SigV4 presigned DELETE URL with proper query signing (fixes 403 Forbidden)', async () => {
      const provider = new S3R2StorageProvider({
        bucket: 'mahi-profiles-prod',
        endpoint: 'https://cf-account-id.r2.cloudflarestorage.com',
        accessKeyId: 'R2_TEST_KEY_ID_123',
        secretAccessKey: 'R2_TEST_SECRET_ACCESS_KEY_456789',
        region: 'auto',
      });

      const objectKey = 'profiles/usr_1/prof_abc/session_v1.enc';
      const deleteUrl = await provider.createDeleteUrl(objectKey, 600);

      expect(deleteUrl).toContain('https://cf-account-id.r2.cloudflarestorage.com/mahi-profiles-prod/profiles/usr_1/prof_abc/session_v1.enc');
      expect(deleteUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
      expect(deleteUrl).toContain('X-Amz-Credential=R2_TEST_KEY_ID_123');
      expect(deleteUrl).toContain('X-Amz-Signature=');
      expect(deleteUrl).toContain('X-Amz-Expires=600');
    });

    it('executes deleteObject using presigned DELETE URL rather than unsigned fetch', async () => {
      const provider = new S3R2StorageProvider({
        bucket: 'mahi-profiles',
        endpoint: 'https://test.r2.cloudflarestorage.com',
        accessKeyId: 'KEY',
        secretAccessKey: 'SECRET',
      });

      let requestedUrl = '';
      let requestedMethod = '';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        return new Response(null, { status: 204 });
      });

      const result = await provider.deleteObject('profiles/user/test.enc');
      expect(result).toBe(true);
      expect(requestedMethod).toBe('DELETE');
      expect(requestedUrl).toContain('X-Amz-Signature=');
      expect(requestedUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    });

    it('verifyStorageConnectivity reports connection status accurately', async () => {
      const localProvider = new LocalStorageProvider({ storageDir: tempTestDir });
      const localStatus = await localProvider.verifyStorageConnectivity();
      expect(localStatus.connected).toBe(true);
      expect(localStatus.provider).toBe('local-storage');

      const s3Provider = new S3R2StorageProvider({
        bucket: 'mahi-test',
        endpoint: 'https://s3.amazonaws.com',
        accessKeyId: 'KEY',
        secretAccessKey: 'SECRET',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
      const s3Status = await s3Provider.verifyStorageConnectivity();
      expect(s3Status.connected).toBe(true);
      expect(s3Status.provider).toBe('s3-r2');
    });

    it('selects provider according to STORAGE_PROVIDER environment variable', () => {
      const prev = process.env.STORAGE_PROVIDER;

      try {
        process.env.STORAGE_PROVIDER = 'local';
        setStorageProviderForTest(null);
        expect(getStorageProvider().name).toBe('local-storage');

        process.env.STORAGE_PROVIDER = 's3-r2';
        setStorageProviderForTest(null);
        expect(getStorageProvider().name).toBe('s3-r2');
      } finally {
        process.env.STORAGE_PROVIDER = prev;
        setStorageProviderForTest(null);
      }
    });
  });

  // ==========================================================================
  // 2. PURE-NODE POSIX USTAR SESSION.TAR.GZ PACKING & EXCLUSION RULES
  // ==========================================================================
  describe('2. Pure-Node POSIX ustar session.tar.gz Engine & Cache Exclusions', () => {
    it('strictly identifies Section 6 excluded paths (Cache, Code Cache, GPUCache, Crashpad, Service Worker/CacheStorage)', () => {
      // Must exclude (Section 6)
      expect(isPathExcludedFromSync('Default/Cache/data_0')).toBe(true);
      expect(isPathExcludedFromSync('Default/Code Cache/js/index.bin')).toBe(true);
      expect(isPathExcludedFromSync('Default/GPUCache/data_1')).toBe(true);
      expect(isPathExcludedFromSync('Default/Crashpad/reports/crash.dmp')).toBe(true);
      expect(isPathExcludedFromSync('Default/Service Worker/CacheStorage/entry_1')).toBe(true);
      expect(isPathExcludedFromSync('Default/DawnCache/shader.bin')).toBe(true);
      expect(isPathExcludedFromSync('Default/blob_storage/part_1')).toBe(true);

      // Temporary & singletons
      expect(isPathExcludedFromSync('Default/Cookies.tmp')).toBe(true);
      expect(isPathExcludedFromSync('Default/LOCK')).toBe(true);
      expect(isPathExcludedFromSync('Default/SingletonLock')).toBe(true);
      expect(isPathExcludedFromSync('Default/SingletonCookie')).toBe(true);

      // Path traversal security
      expect(isPathExcludedFromSync('../evil.sh')).toBe(true);
      expect(isPathExcludedFromSync('/etc/passwd')).toBe(true);
      expect(isPathExcludedFromSync('C:\\Windows\\System32\\cmd.exe')).toBe(true);

      // MUST NOT exclude essential user session data
      expect(isPathExcludedFromSync('Default/Cookies')).toBe(false);
      expect(isPathExcludedFromSync('Default/Network/Cookies')).toBe(false);
      expect(isPathExcludedFromSync('Default/Preferences')).toBe(false);
      expect(isPathExcludedFromSync('Default/Local Storage/leveldb/000005.ldb')).toBe(false);
      expect(isPathExcludedFromSync('Default/IndexedDB/site.indexeddb.leveldb/000001.log')).toBe(false);
      expect(isPathExcludedFromSync('profile.json')).toBe(false);
    });

    it('packs profile storage into valid session.tar.gz starting with gzip magic bytes 0x1f 0x8b', async () => {
      const profile = createProfile({
        name: 'TarGz-Pack-Test-Profile',
        folder: 'Finance',
      });

      const storageDir = getProfileStoragePath(profile.id);
      const defDir = path.join(storageDir, 'Default');
      const ldbDir = path.join(defDir, 'Local Storage', 'leveldb');
      fs.mkdirSync(ldbDir, { recursive: true });

      // Essential session files
      fs.writeFileSync(path.join(defDir, 'Preferences'), JSON.stringify({ theme: 'dark' }), 'utf8');
      fs.writeFileSync(path.join(ldbDir, '000001.ldb'), 'essential-session-token-leveldb', 'utf8');

      // Bloat cache files that must be omitted
      const cacheDir = path.join(defDir, 'Cache');
      const gpuDir = path.join(defDir, 'GPUCache');
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.mkdirSync(gpuDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, 'heavy_cache_blob.bin'), 'exclude-me', 'utf8');
      fs.writeFileSync(path.join(gpuDir, 'shader_blob.bin'), 'exclude-me', 'utf8');

      const archiveDest = path.join(tempTestDir, 'test-session.tar.gz');
      const packResult = await packProfileSessionTarGz(profile.id, archiveDest);

      expect(packResult.sizeBytes).toBeGreaterThan(0);
      expect(fs.existsSync(archiveDest)).toBe(true);

      // Verify GZIP magic bytes: 0x1f 0x8b
      expect(packResult.buffer[0]).toBe(0x1f);
      expect(packResult.buffer[1]).toBe(0x8b);

      // Decompress and verify tar entries
      const tarData = zlib.gunzipSync(packResult.buffer);
      const tarString = tarData.toString('utf8');

      expect(tarString).toContain('profile.json');
      expect(tarString).toContain('Preferences');
      expect(tarString).toContain('Local Storage/leveldb/000001.ldb');
      expect(tarString).not.toContain('heavy_cache_blob.bin');
      expect(tarString).not.toContain('shader_blob.bin');

      deleteProfile(profile.id);
    });

    it('unpacks session.tar.gz restoring all session files and embedded profile metadata', async () => {
      const sourceProfile = createProfile({
        name: 'TarGz-Source-Profile',
        folder: 'Marketing',
        notes: 'Target extraction test',
      });

      const sourceDir = getProfileStoragePath(sourceProfile.id);
      const networkDir = path.join(sourceDir, 'Default', 'Network');
      fs.mkdirSync(networkDir, { recursive: true });
      fs.writeFileSync(path.join(networkDir, 'Cookies'), 'sqlite-cookie-data-blob', 'utf8');

      const packResult = await packProfileSessionTarGz(sourceProfile.id);

      // Unpack into a new target profile ID
      const targetProfileId = crypto.randomUUID();
      const unpackResult = await unpackProfileSessionTarGz(packResult.buffer, targetProfileId);

      expect(unpackResult.fileCount).toBeGreaterThanOrEqual(2);
      expect(unpackResult.profileMetadata).toBeDefined();
      expect(unpackResult.profileMetadata.name).toBe('TarGz-Source-Profile');

      const targetDir = getProfileStoragePath(targetProfileId);
      const restoredCookiePath = path.join(targetDir, 'Default', 'Network', 'Cookies');
      expect(fs.existsSync(restoredCookiePath)).toBe(true);
      expect(fs.readFileSync(restoredCookiePath, 'utf8')).toBe('sqlite-cookie-data-blob');

      // Cleanup
      deleteProfile(sourceProfile.id);
      try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch {}
    });

    it('rejects invalid non-gzip archives with INVALID_GZIP_MAGIC error', async () => {
      const fakeCorruptBuffer = Buffer.from('this is plain text not gzip');
      await expect(
        unpackProfileSessionTarGz(fakeCorruptBuffer, 'dummy-id')
      ).rejects.toThrow('INVALID_GZIP_MAGIC');
    });

    it('strictly detects and blocks path-traversal attacks in tar headers', async () => {
      // Construct a malicious tar archive attempting to escape storage sandbox
      const evilHeader = Buffer.alloc(512, 0);
      evilHeader.write('../../../evil_payload.sh', 0, 100, 'utf8');
      evilHeader.write('0000644 \0', 100, 8, 'ascii');
      evilHeader.write('000000 \0', 108, 8, 'ascii');
      evilHeader.write('000000 \0', 116, 8, 'ascii');
      evilHeader.write('00000000010 ', 124, 12, 'ascii'); // 8 bytes
      evilHeader.write('00000000000 ', 136, 12, 'ascii');
      evilHeader.write('        ', 148, 8, 'ascii');
      evilHeader.write('0', 156, 1, 'ascii');
      evilHeader.write('ustar\0', 257, 6, 'ascii');
      evilHeader.write('00', 263, 2, 'ascii');

      let sum = 0;
      for (let i = 0; i < 512; i++) sum += evilHeader[i];
      evilHeader.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

      const payload = Buffer.alloc(512, 0);
      payload.write('malicious-command', 0, 'utf8');
      const eof = Buffer.alloc(1024, 0);

      const maliciousTar = Buffer.concat([evilHeader, payload, eof]);
      const maliciousGzip = zlib.gzipSync(maliciousTar);

      await expect(
        unpackProfileSessionTarGz(maliciousGzip, 'sandbox-target')
      ).rejects.toThrow('SECURITY_ALERT_PATH_TRAVERSAL');
    });
  });

  // ==========================================================================
  // 3. ZERO-KNOWLEDGE ENVELOPE ENCRYPTION & SHA-256 INTEGRITY
  // ==========================================================================
  describe('3. Client-Side Envelope Encryption & SHA-256 Checksum Validation', () => {
    it('performs full roundtrip: pack -> AES-256-GCM envelope encrypt -> SHA-256 verify -> decrypt -> unpack', async () => {
      const profile = createProfile({
        name: 'ZK-Crypto-Roundtrip-Profile',
        folder: 'Security',
      });

      const storageDir = getProfileStoragePath(profile.id);
      fs.mkdirSync(path.join(storageDir, 'Default'), { recursive: true });
      fs.writeFileSync(path.join(storageDir, 'Default', 'Bookmarks'), '{"roots":{}}', 'utf8');

      // 1. Pack
      const packResult = await packProfileSessionTarGz(profile.id);

      // 2. Client-Side Envelope Encrypt
      const userMasterPassphrase = 'user-secret-sync-master-key-32b';
      const encryptedPkg = encryptProfileArchive(packResult.buffer, userMasterPassphrase);

      expect(encryptedPkg.ciphertext).toBeInstanceOf(Buffer);
      expect(encryptedPkg.iv).toHaveLength(24); // 12-byte hex IV
      expect(encryptedPkg.authTag).toHaveLength(32); // 16-byte hex tag
      expect(encryptedPkg.checksumSha256).toBeDefined();

      // 3. Verify SHA-256 Integrity
      const computedSha256 = crypto.createHash('sha256').update(encryptedPkg.ciphertext).digest('hex');
      expect(computedSha256).toBe(encryptedPkg.checksumSha256);

      // 4. Client-Side Envelope Decrypt
      const decryptedPlaintext = decryptProfileArchive({
        ciphertext: encryptedPkg.ciphertext,
        expectedChecksum: encryptedPkg.checksumSha256,
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag,
        userMasterKey: userMasterPassphrase,
      });

      expect(decryptedPlaintext[0]).toBe(0x1f);
      expect(decryptedPlaintext[1]).toBe(0x8b);

      // 5. Unpack
      const targetId = crypto.randomUUID();
      const unpackResult = await unpackProfileSessionTarGz(decryptedPlaintext, targetId);
      expect(unpackResult.fileCount).toBeGreaterThanOrEqual(1);

      deleteProfile(profile.id);
      try { fs.rmSync(getProfileStoragePath(targetId), { recursive: true, force: true }); } catch {}
    });

    it('rejects tampered ciphertext during SHA-256 verification before decryption occurs', () => {
      const dummyPlaintext = Buffer.from('session-sample-data');
      const passphrase = 'test-passphrase';
      const pkg = encryptProfileArchive(dummyPlaintext, passphrase);

      // Tamper 1 byte of ciphertext
      pkg.ciphertext[0] = pkg.ciphertext[0] ^ 0xff;

      expect(() => {
        decryptProfileArchive({
          ciphertext: pkg.ciphertext,
          expectedChecksum: pkg.checksumSha256,
          encryptedDataKey: pkg.encryptedDataKey,
          iv: pkg.iv,
          authTag: pkg.authTag,
          userMasterKey: passphrase,
        });
      }).toThrow(/checksum|integrity/i);
    });
  });

  // ==========================================================================
  // 4. LAUNCH-TIME PULL & CLOSE-TIME PUSH LIFECYCLE
  // ==========================================================================
  describe('4. Launch-Time Cloud Pull & Lifecycle Synchronization', () => {
    it('syncProfileIfCloudNewer returns false when local profile version is already up to date', async () => {
      const profile = createProfile({ name: 'Sync-Version-Test' });
      setProfileCloudBinding(profile.id, {
        cloudProfileId: 'cloud_prof_123',
        lastSyncedVersion: 5,
        updatedAt: new Date().toISOString(),
      });

      // Mock remote server returning version 5 (equal to local)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
        JSON.stringify({ success: true, profile: { current_version: 5 } }),
        { status: 200 }
      ));

      const updated = await syncProfileIfCloudNewer(profile.id);
      expect(updated).toBe(false);

      removeProfileCloudBinding(profile.id);
      deleteProfile(profile.id);
    });

    it('syncProfileIfCloudNewer handles offline/unreachable servers gracefully without throwing', async () => {
      const profile = createProfile({ name: 'Offline-Pull-Test' });
      setProfileCloudBinding(profile.id, {
        cloudProfileId: 'cloud_offline_123',
        lastSyncedVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      // Simulate connection refused / offline network error
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1'));

      const result = await syncProfileIfCloudNewer(profile.id);
      expect(result).toBe(false); // Does not throw, falls back gracefully

      removeProfileCloudBinding(profile.id);
      deleteProfile(profile.id);
    });
  });
});
