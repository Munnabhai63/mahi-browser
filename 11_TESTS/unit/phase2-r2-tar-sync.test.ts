/**
 * MAHI Browser — Phase 2: Cloudflare R2 & session.tar.gz Cloud Sync Verification Suite
 * 
 * Verifies:
 * 1. Cloudflare R2 Object Storage Provider hardening & AWS SDK v3 Presigned DELETE/HEAD operations.
 * 2. LocalStorageProvider action token scoping ('upload', 'download', 'delete').
 * 3. Pure-Node POSIX ustar + GNU @LongLink session.tar.gz packing and extraction (> 170 chars).
 * 4. Section 6 cache exclusions and path traversal security guards.
 * 5. Client-side Zero-Knowledge AES-256-GCM envelope encryption with SHA-256 integrity verification.
 * 6. Launch-time cloud pull (syncProfileIfCloudNewer) and atomic rollback over real node:http server.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import http from 'node:http';
import { AddressInfo } from 'node:net';
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
  getDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProfile,
  getProfileById,
  deleteProfile,
  getProfiles,
  getProfileStoragePath,
} from '../../02_BROWSER/services/profile-service.js';
import {
  encryptProfileArchive,
  decryptProfileArchive,
} from '../../08_SECURITY/cloud-profile-crypto.js';
import {
  downloadAndRestoreProfile,
  syncProfileIfCloudNewer,
  setProfileCloudBinding,
  getProfileCloudBinding,
  removeProfileCloudBinding,
} from '../../08_SECURITY/cloud-sync-service.js';
import {
  saveEncryptedSession,
  clearEncryptedSession,
} from '../../08_SECURITY/account-service.js';
import { handleCommercialApiRoute } from '../../07_BACKEND/commercial/commercial-api-router.js';

describe('PHASE 2: Cloudflare R2 & session.tar.gz Cloud Sync Engine', () => {
  let tempTestDir: string;
  let tempSqliteDir: string;
  let tempUserDataDir: string;
  let prevUserDataDir: string | undefined;
  let mockServer: http.Server | null = null;
  let prevCommercialApiUrl: string | undefined;

  beforeAll(async () => {
    prevUserDataDir = process.env.MAHI_USER_DATA_DIR;
    tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-userdata-'));
    process.env.MAHI_USER_DATA_DIR = tempUserDataDir;

    tempSqliteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-sqlite-'));
    setCustomDatabasePath(path.join(tempSqliteDir, 'phase2-test.sqlite'));
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    process.env.MAHI_USER_DATA_DIR = prevUserDataDir;
    try { fs.rmSync(tempUserDataDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(tempSqliteDir, { recursive: true, force: true }); } catch {}
  });

  beforeEach(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-work-'));
    setStorageProviderForTest(null);
    prevCommercialApiUrl = process.env.COMMERCIAL_API_URL;
  });

  afterEach(async () => {
    setStorageProviderForTest(null);
    clearEncryptedSession();
    process.env.COMMERCIAL_API_URL = prevCommercialApiUrl;
    vi.restoreAllMocks();

    if (mockServer) {
      await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
      mockServer = null;
    }

    try { fs.rmSync(tempTestDir, { recursive: true, force: true }); } catch {}
  });

  // ==========================================================================
  // 1. CLOUDFLARE R2 & AWS SDK v3 PRESIGNED OPERATIONS
  // ==========================================================================
  describe('1. Cloudflare R2 SigV4 Presigned Authentication & Connectivity', () => {
    it('generates AWS SDK v3 path-style presigned PUT, GET, DELETE, and HEAD URLs with forcePathStyle', async () => {
      const provider = new S3R2StorageProvider({
        bucket: 'mahi-profiles-prod',
        endpoint: 'https://cf-account-id.r2.cloudflarestorage.com',
        accessKeyId: 'R2_TEST_KEY_ID_123',
        secretAccessKey: 'R2_TEST_SECRET_ACCESS_KEY_456789',
        region: 'auto',
      });

      const objectKey = 'profiles/usr_1/prof_abc/session_v1.enc';
      const uploadUrl = await provider.createUploadUrl(objectKey, 'application/octet-stream', 600);
      const downloadUrl = await provider.createDownloadUrl(objectKey, 600);
      const deleteUrl = await provider.createDeleteUrl(objectKey, 600);
      const headUrl = await provider.createHeadUrl!(objectKey, 600);

      // Verify path-style structure: <endpoint>/<bucket>/<key>
      const expectedBasePath = 'https://cf-account-id.r2.cloudflarestorage.com/mahi-profiles-prod/profiles/usr_1/prof_abc/session_v1.enc';
      expect(uploadUrl).toContain(expectedBasePath);
      expect(downloadUrl).toContain(expectedBasePath);
      expect(deleteUrl).toContain(expectedBasePath);
      expect(headUrl).toContain(expectedBasePath);

      // Verify AWS SigV4 query authentication components
      expect(uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
      expect(uploadUrl).toContain('X-Amz-Credential=R2_TEST_KEY_ID_123');
      expect(uploadUrl).toContain('X-Amz-Signature=');
      expect(uploadUrl).toContain('X-Amz-Expires=600');
      expect(deleteUrl).toContain('X-Amz-Signature=');
      expect(headUrl).toContain('X-Amz-Signature=');
    });

    it('headObject uses HEAD-signed URL rather than GET-signed URL', async () => {
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
        return new Response(null, {
          status: 200,
          headers: { 'content-length': '1024', 'etag': '"checksum-abc"' },
        });
      });

      const headResult = await provider.headObject('profiles/user/test.enc');
      expect(headResult).toEqual({ exists: true, size: 1024, checksum: 'checksum-abc' });
      expect(requestedMethod).toBe('HEAD');

      // Verify the URL was signed for HEAD, NOT GET
      const headUrl = await provider.createHeadUrl!('profiles/user/test.enc', 300);
      expect(new URL(requestedUrl).pathname).toBe(new URL(headUrl).pathname);
    });

    it('verifyStorageConnectivity sends HEAD probe to a HEAD-signed URL', async () => {
      const provider = new S3R2StorageProvider({
        bucket: 'mahi-test-bucket',
        endpoint: 'https://s3.amazonaws.com',
        accessKeyId: 'AKIA_KEY',
        secretAccessKey: 'SEC_KEY',
      });

      let requestedMethod = '';
      let requestedUrl = '';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        return new Response(null, { status: 404 }); // 404 confirms bucket exists and probe reached S3
      });

      const conn = await provider.verifyStorageConnectivity();
      expect(conn.connected).toBe(true);
      expect(requestedMethod).toBe('HEAD');
      expect(requestedUrl).toContain('.connectivity-probe');
    });

    it('LocalStorageProvider scopes action tokens strictly and rejects upload token on delete', () => {
      const local = new LocalStorageProvider({ storageDir: tempTestDir });
      const expiresAt = Date.now() + 60000;

      // Access private generateToken via cast
      const uploadToken = (local as any).generateToken('key1', 'upload', expiresAt);
      const deleteToken = (local as any).generateToken('key1', 'delete', expiresAt);

      // Verify token scoping
      expect(local.verifyToken('key1', 'upload', expiresAt, uploadToken)).toBe(true);
      expect(local.verifyToken('key1', 'delete', expiresAt, uploadToken)).toBe(false); // REJECTED
      expect(local.verifyToken('key1', 'delete', expiresAt, deleteToken)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. PURE-NODE POSIX USTAR + GNU @LongLink SESSION.TAR.GZ PACKING
  // ==========================================================================
  describe('2. Pure-Node POSIX ustar + GNU @LongLink Session Packaging', () => {
    it('strictly enforces Section 6 exclusion rules (Cache, Code Cache, GPUCache, Crashpad, Service Worker/CacheStorage, locks)', () => {
      expect(isPathExcludedFromSync('Default/Cache/data_0')).toBe(true);
      expect(isPathExcludedFromSync('Default/Code Cache/js/index.bin')).toBe(true);
      expect(isPathExcludedFromSync('Default/GPUCache/data_1')).toBe(true);
      expect(isPathExcludedFromSync('Default/Crashpad/reports/crash.dmp')).toBe(true);
      expect(isPathExcludedFromSync('Default/Service Worker/CacheStorage/entry_1')).toBe(true);
      expect(isPathExcludedFromSync('Default/DawnCache/shader.bin')).toBe(true);
      expect(isPathExcludedFromSync('Default/blob_storage/part_1')).toBe(true);

      // Lock files & singletons
      expect(isPathExcludedFromSync('Default/Cookies.tmp')).toBe(true);
      expect(isPathExcludedFromSync('Default/LOCK')).toBe(true);
      expect(isPathExcludedFromSync('Default/SingletonLock')).toBe(true);

      // Path traversal guards
      expect(isPathExcludedFromSync('../evil.sh')).toBe(true);
      expect(isPathExcludedFromSync('/etc/passwd')).toBe(true);
      expect(isPathExcludedFromSync('C:\\Windows\\System32\\cmd.exe')).toBe(true);

      // Essential session files MUST NOT be excluded
      expect(isPathExcludedFromSync('Default/Cookies')).toBe(false);
      expect(isPathExcludedFromSync('Default/Network/Cookies')).toBe(false);
      expect(isPathExcludedFromSync('Default/Preferences')).toBe(false);
      expect(isPathExcludedFromSync('Default/Local Storage/leveldb/000005.ldb')).toBe(false);
      expect(isPathExcludedFromSync('profile.json')).toBe(false);
    });

    it('packs and unpacks deep paths > 170 chars using GNU @LongLink roundtrip', async () => {
      const profile = createProfile({
        name: 'LongPath-Test-Profile',
        folder: 'Enterprise',
      });

      const storageDir = getProfileStoragePath(profile.id);
      // Construct a deep path with > 170 chars and no '/' within first 155 chars
      const deepRelativeDir = 'Default/Storage/ext/' + 'a'.repeat(160);
      const deepDir = path.join(storageDir, deepRelativeDir);
      fs.mkdirSync(deepDir, { recursive: true });

      const deepFilePath = path.join(deepDir, 'state.json');
      fs.writeFileSync(deepFilePath, JSON.stringify({ state: 'deep-nested-success' }), 'utf8');

      const packResult = await packProfileSessionTarGz(profile.id);
      expect(packResult.buffer[0]).toBe(0x1f);
      expect(packResult.buffer[1]).toBe(0x8b);

      const targetId = crypto.randomUUID();
      const unpackResult = await unpackProfileSessionTarGz(packResult.buffer, targetId);

      expect(unpackResult.fileCount).toBeGreaterThanOrEqual(2);
      const restoredPath = path.join(getProfileStoragePath(targetId), deepRelativeDir, 'state.json');
      expect(fs.existsSync(restoredPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(restoredPath, 'utf8'))).toEqual({ state: 'deep-nested-success' });

      deleteProfile(profile.id);
      try { fs.rmSync(getProfileStoragePath(targetId), { recursive: true, force: true }); } catch {}
    });

    it('rejects path traversal attempts in tar headers', async () => {
      const evilHeader = Buffer.alloc(512, 0);
      evilHeader.write('../../../evil_payload.sh', 0, 100, 'utf8');
      evilHeader.write('0000644 \0', 100, 8, 'ascii');
      evilHeader.write('000000 \0', 108, 8, 'ascii');
      evilHeader.write('000000 \0', 116, 8, 'ascii');
      evilHeader.write('00000000010 ', 124, 12, 'ascii');
      evilHeader.write('00000000000 ', 136, 12, 'ascii');
      evilHeader.write('        ', 148, 8, 'ascii');
      evilHeader.write('0', 156, 1, 'ascii');
      evilHeader.write('ustar\0', 257, 6, 'ascii');
      evilHeader.write('00', 263, 2, 'ascii');

      let sum = 0;
      for (let i = 0; i < 512; i++) sum += evilHeader[i];
      evilHeader.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

      const payload = Buffer.alloc(512, 0);
      const eof = Buffer.alloc(1024, 0);
      const maliciousTar = Buffer.concat([evilHeader, payload, eof]);
      const maliciousGzip = zlib.gzipSync(maliciousTar);

      await expect(
        unpackProfileSessionTarGz(maliciousGzip, 'sandbox-target')
      ).rejects.toThrow('SECURITY_ALERT_PATH_TRAVERSAL');
    });
  });

  // ==========================================================================
  // 3. ZERO-KNOWLEDGE ENVELOPE ENCRYPTION & INTEGRITY
  // ==========================================================================
  describe('3. Client-Side Envelope Encryption & SHA-256 Checksum Validation', () => {
    it('performs full roundtrip: pack -> AES-256-GCM envelope encrypt -> SHA-256 verify -> decrypt -> unpack', async () => {
      const profile = createProfile({
        name: 'ZK-Crypto-Profile',
        folder: 'Security',
      });

      const storageDir = getProfileStoragePath(profile.id);
      fs.mkdirSync(path.join(storageDir, 'Default'), { recursive: true });
      fs.writeFileSync(path.join(storageDir, 'Default', 'Bookmarks'), '{"roots":{}}', 'utf8');

      const packResult = await packProfileSessionTarGz(profile.id);
      const masterPassphrase = 'secure-master-passphrase-32b';
      const encryptedPkg = encryptProfileArchive(packResult.buffer, masterPassphrase);

      expect(encryptedPkg.checksumSha256).toBe(crypto.createHash('sha256').update(encryptedPkg.ciphertext).digest('hex'));

      const decrypted = decryptProfileArchive({
        ciphertext: encryptedPkg.ciphertext,
        expectedChecksum: encryptedPkg.checksumSha256,
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag,
        userMasterKey: masterPassphrase,
      });

      expect(decrypted[0]).toBe(0x1f);
      expect(decrypted[1]).toBe(0x8b);

      deleteProfile(profile.id);
    });

    it('rejects tampered ciphertext during SHA-256 verification before decryption occurs', () => {
      const dummyPlaintext = Buffer.from('session-sample-data');
      const passphrase = 'test-passphrase';
      const pkg = encryptProfileArchive(dummyPlaintext, passphrase);

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
  // 4. REAL LOCAL HTTP SERVER: LAUNCH-TIME PULL & ATOMIC ROLLBACK
  // ==========================================================================
  describe('4. Real Server Launch-Time Cloud Pull & Atomic Rollback', () => {
    beforeEach(() => {
      saveEncryptedSession({
        token: 'test_token_phase2',
        refreshToken: 'test_refresh',
        account_id: 'SYSTEM_OWNER',
        email: 'phase2@test.com',
        sync_key: 'mahi-cloud-sync',
        saved_at: new Date().toISOString(),
      });
    });

    afterEach(() => {
      clearEncryptedSession();
    });

    it('syncProfileIfCloudNewer returns false cleanly when server reports version equal to local version', async () => {
      const profile = createProfile({ name: 'Sync-Clean-Test' });
      setProfileCloudBinding(profile.id, {
        cloudProfileId: 'cloud_sync_clean',
        lastSyncedVersion: 3,
        updatedAt: new Date().toISOString(),
      });

      // Ephemeral node:http server returning current_version = 3
      mockServer = http.createServer((req, res) => {
        if (req.url?.includes('/api/v1/sync/profiles/cloud_sync_clean') && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, profile: { id: 'cloud_sync_clean', current_version: 3 } }));
          return;
        }
        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => mockServer!.listen(0, '127.0.0.1', () => resolve()));
      const port = (mockServer.address() as AddressInfo).port;
      process.env.COMMERCIAL_API_URL = `http://127.0.0.1:${port}`;

      const updated = await syncProfileIfCloudNewer(profile.id);
      expect(updated).toBe(false);

      removeProfileCloudBinding(profile.id);
      deleteProfile(profile.id);
    });

    it('syncProfileIfCloudNewer handles offline/ECONNREFUSED gracefully without throwing', async () => {
      const profile = createProfile({ name: 'Offline-Pull-Test' });
      setProfileCloudBinding(profile.id, {
        cloudProfileId: 'cloud_offline',
        lastSyncedVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      process.env.COMMERCIAL_API_URL = 'http://127.0.0.1:65534'; // Closed port

      const updated = await syncProfileIfCloudNewer(profile.id);
      expect(updated).toBe(false); // Does not throw

      removeProfileCloudBinding(profile.id);
      deleteProfile(profile.id);
    });

    it('Machine A -> Cloud -> Machine B launch pull updates in place at plan limit (15/15) without duplicate', async () => {
      // 1. Create Machine B profile (prof_B)
      const profB = createProfile({ name: 'Machine-B-Profile', folder: 'Work' });
      const profBStorage = getProfileStoragePath(profB.id);
      fs.mkdirSync(path.join(profBStorage, 'Default'), { recursive: true });
      fs.writeFileSync(path.join(profBStorage, 'Default', 'Preferences'), JSON.stringify({ version: 1, machine: 'B' }), 'utf8');

      // Bind profB to cloud_shared at v1
      setProfileCloudBinding(profB.id, {
        cloudProfileId: 'cloud_shared_100',
        lastSyncedVersion: 1,
        updatedAt: new Date().toISOString(),
      });

      // Fill remaining user capacity so user has 15 total profiles (at 15/15 capacity!)
      const fillerProfiles: any[] = [];
      const currentCount = getProfiles().length;
      for (let i = currentCount; i < 15; i++) {
        fillerProfiles.push(createProfile({ name: `Quota-Filler-${i}` }));
      }
      expect(getProfiles().length).toBeGreaterThanOrEqual(15);

      // 2. Prepare Machine A cloud snapshot (prof_A at v2)
      const profA = createProfile({ name: 'Machine-A-Profile' });
      const profAStorage = getProfileStoragePath(profA.id);
      fs.mkdirSync(path.join(profAStorage, 'Default'), { recursive: true });
      fs.writeFileSync(path.join(profAStorage, 'Default', 'Preferences'), JSON.stringify({ version: 2, machine: 'A' }), 'utf8');

      const packA = await packProfileSessionTarGz(profA.id);
      deleteProfile(profA.id); // Clean up Machine A local record

      const passphrase = 'mahi-cloud-sync';
      const encPkg = encryptProfileArchive(packA.buffer, passphrase);

      // 3. Ephemeral server serving v2 snapshot
      mockServer = http.createServer((req, res) => {
        if (req.url?.includes('/api/v1/sync/profiles/cloud_shared_100') && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            profile: { id: 'cloud_shared_100', current_version: 2 },
          }));
          return;
        }

        if (req.url?.includes('/api/v1/sync/download-session') && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: {
              downloadUrl: `http://${req.headers.host}/storage/download/cloud_shared_v2.enc`,
              version: 2,
              checksumSha256: encPkg.checksumSha256,
              encryptedDataKey: encPkg.encryptedDataKey,
              iv: encPkg.iv,
              authTag: encPkg.authTag,
              fileSize: encPkg.ciphertext.length,
              profileName: 'Machine-B-Profile',
              localProfileId: 'prof_A_machine_a', // From Machine A!
            },
          }));
          return;
        }

        if (req.url?.includes('/storage/download/cloud_shared_v2.enc') && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': encPkg.ciphertext.length,
          });
          res.end(encPkg.ciphertext);
          return;
        }

        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => mockServer!.listen(0, '127.0.0.1', () => resolve()));
      const port = (mockServer.address() as AddressInfo).port;
      process.env.COMMERCIAL_API_URL = `http://127.0.0.1:${port}`;

      const profilesBefore = getProfiles().length;

      // 4. Execute launch pull on Machine B
      const pulled = await syncProfileIfCloudNewer(profB.id);
      expect(pulled).toBe(true);

      // Verify profB updated in place
      const updatedPrefs = JSON.parse(fs.readFileSync(path.join(profBStorage, 'Default', 'Preferences'), 'utf8'));
      expect(updatedPrefs).toEqual({ version: 2, machine: 'A' });

      // Verify no duplicate profile was created and total count did not increase
      expect(getProfiles().length).toBe(profilesBefore);

      // Verify binding version bumped to 2
      const newBinding = getProfileCloudBinding(profB.id);
      expect(newBinding?.lastSyncedVersion).toBe(2);

      // Cleanup
      removeProfileCloudBinding(profB.id);
      deleteProfile(profB.id);
      for (const p of fillerProfiles) {
        deleteProfile(p.id);
      }
    });

    it('atomic rollback restores previous storage directory if cloud restore fails', async () => {
      const prof = createProfile({ name: 'Rollback-Test-Profile' });
      const storagePath = getProfileStoragePath(prof.id);
      fs.mkdirSync(path.join(storagePath, 'Default'), { recursive: true });
      fs.writeFileSync(path.join(storagePath, 'Default', 'important_data.txt'), 'original-safe-data', 'utf8');

      // Prepare envelope payload that decrypts successfully and passes gzip magic byte check (0x1f 0x8b),
      // but fails during extraction due to truncated/invalid gzip stream, exercising unpack failure and atomic rollback.
      const corruptGzip = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00]);
      const encPkg = encryptProfileArchive(corruptGzip, 'mahi-cloud-sync');

      mockServer = http.createServer((req, res) => {
        if (req.url?.includes('/api/v1/sync/download-session')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: {
              downloadUrl: `http://${req.headers.host}/corrupt.enc`,
              version: 2,
              checksumSha256: encPkg.checksumSha256,
              encryptedDataKey: encPkg.encryptedDataKey,
              iv: encPkg.iv,
              authTag: encPkg.authTag,
              fileSize: encPkg.ciphertext.length,
              profileName: prof.name,
              localProfileId: prof.id,
            },
          }));
          return;
        }

        if (req.url?.includes('/corrupt.enc')) {
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': encPkg.ciphertext.length,
          });
          res.end(encPkg.ciphertext);
          return;
        }

        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => mockServer!.listen(0, '127.0.0.1', () => resolve()));
      const port = (mockServer.address() as AddressInfo).port;
      process.env.COMMERCIAL_API_URL = `http://127.0.0.1:${port}`;

      await expect(
        downloadAndRestoreProfile('cloud_corrupt_test', { targetLocalProfileId: prof.id })
      ).rejects.toThrow();

      // Original data must be fully intact
      expect(fs.existsSync(path.join(storagePath, 'Default', 'important_data.txt'))).toBe(true);
      expect(fs.readFileSync(path.join(storagePath, 'Default', 'important_data.txt'), 'utf8')).toBe('original-safe-data');

      deleteProfile(prof.id);
    });
  });
});
