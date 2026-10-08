import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {
  encryptProfileArchive,
  decryptProfileArchive,
  deriveUserSyncKey,
  wrapDataKey,
  unwrapDataKey,
} from '../../08_SECURITY/cloud-profile-crypto.js';
import {
  LocalStorageProvider,
  S3R2StorageProvider,
} from '../../08_SECURITY/storage-provider.js';
import {
  initSqlEngine,
  setCustomDatabasePath,
  closeDatabase,
  getDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  acquireProfileLock,
  renewProfileLock,
  releaseProfileLock,
  getProfileLockStatus,
  cleanupExpiredLocks,
} from '../../07_BACKEND/services/cloud-profile-service.js';
import {
  createProfile,
  getProfileById,
  deleteProfile,
  cloneProfile,
} from '../../02_BROWSER/services/profile-service.js';
import {
  getProfileCloudBinding,
  setProfileCloudBinding,
  removeProfileCloudBinding,
} from '../../08_SECURITY/cloud-sync-service.js';

describe('PHASE 2 UNIT: Zero-Knowledge Envelope Crypto, Storage & Locking', () => {
  const testDir = path.join(process.cwd(), '.test_phase2_unit');
  let tempSqliteDir: string;

  beforeAll(async () => {
    tempSqliteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-unit-'));
    setCustomDatabasePath(path.join(tempSqliteDir, 'unit_test.sqlite'));
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try { fs.rmSync(tempSqliteDir, { recursive: true, force: true }); } catch {}
  });

  beforeEach(() => {
    try { fs.mkdirSync(testDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  // --------------------------------------------------------------------------
  // 1. Envelope Cryptography Tests
  // --------------------------------------------------------------------------
  it('should encrypt profile archive with AES-256-GCM envelope encryption and decrypt successfully', () => {
    const rawArchiveData = Buffer.from(JSON.stringify({
      version: '1.0',
      profile: { name: 'E2E Profile', canvas: 'noise', userAgent: 'Chrome 138' },
      cookies: [{ name: 'session_id', value: 'secret_token_123', domain: '.google.com' }],
      storage: { 'Default/Preferences': '{"locale":"en-US"}' }
    }));

    const userPassphrase = 'SuperSecretUserPassphrase!2026';

    // Encrypt
    const encryptedPkg = encryptProfileArchive(rawArchiveData, userPassphrase);

    expect(encryptedPkg.ciphertext).toBeInstanceOf(Buffer);
    expect(encryptedPkg.ciphertext.length).toBeGreaterThan(0);
    expect(encryptedPkg.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(encryptedPkg.encryptedDataKey).toBeTruthy();
    expect(encryptedPkg.iv).toHaveLength(24); // 12 bytes hex
    expect(encryptedPkg.authTag).toHaveLength(32); // 16 bytes hex

    // Decrypt
    const decryptedBuffer = decryptProfileArchive({
      ciphertext: encryptedPkg.ciphertext,
      expectedChecksum: encryptedPkg.checksumSha256,
      encryptedDataKey: encryptedPkg.encryptedDataKey,
      iv: encryptedPkg.iv,
      authTag: encryptedPkg.authTag,
      userMasterKey: userPassphrase,
    });

    expect(decryptedBuffer.toString('utf8')).toBe(rawArchiveData.toString('utf8'));
  });

  it('should generate unique random data keys and IVs on consecutive encryptions of identical payloads', () => {
    const payload = Buffer.from('Identical profile payload');
    const passphrase = 'consistent-passphrase';

    const pkg1 = encryptProfileArchive(payload, passphrase);
    const pkg2 = encryptProfileArchive(payload, passphrase);

    expect(pkg1.iv).not.toBe(pkg2.iv);
    expect(pkg1.ciphertext.toString('hex')).not.toBe(pkg2.ciphertext.toString('hex'));
    expect(pkg1.checksumSha256).not.toBe(pkg2.checksumSha256);
    expect(pkg1.encryptedDataKey).not.toBe(pkg2.encryptedDataKey);
  });

  it('should fail decryption if wrong passphrase is provided (zero-knowledge security)', () => {
    const rawArchiveData = Buffer.from('Secret profile data');
    const correctPassphrase = 'CorrectPassphrase123';
    const wrongPassphrase = 'WrongPassphrase456';

    const encryptedPkg = encryptProfileArchive(rawArchiveData, correctPassphrase);

    expect(() => {
      decryptProfileArchive({
        ciphertext: encryptedPkg.ciphertext,
        expectedChecksum: encryptedPkg.checksumSha256,
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag,
        userMasterKey: wrongPassphrase,
      });
    }).toThrow(/Failed to unwrap profile encryption key|Decryption failed/);
  });

  it('should reject decryption immediately if checksum mismatch occurs', () => {
    const rawArchiveData = Buffer.from('Intact profile data');
    const passphrase = 'Passphrase123';

    const encryptedPkg = encryptProfileArchive(rawArchiveData, passphrase);

    expect(() => {
      decryptProfileArchive({
        ciphertext: encryptedPkg.ciphertext,
        expectedChecksum: '0000000000000000000000000000000000000000000000000000000000000000',
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag,
        userMasterKey: passphrase,
      });
    }).toThrow(/Checksum verification failed/);
  });

  it('should detect tampered ciphertext via AES-256-GCM authentication tag', () => {
    const rawArchiveData = Buffer.from('Sensitive financial session credentials');
    const passphrase = 'Passphrase123';

    const encryptedPkg = encryptProfileArchive(rawArchiveData, passphrase);

    // Tamper with ciphertext by altering a single byte
    const tamperedCiphertext = Buffer.from(encryptedPkg.ciphertext);
    tamperedCiphertext[0] = tamperedCiphertext[0] ^ 0xff;
    const tamperedChecksum = crypto.createHash('sha256').update(tamperedCiphertext).digest('hex');

    expect(() => {
      decryptProfileArchive({
        ciphertext: tamperedCiphertext,
        expectedChecksum: tamperedChecksum,
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag,
        userMasterKey: passphrase,
      });
    }).toThrow(/Decryption failed: Payload was tampered with or corrupted/);
  });

  // --------------------------------------------------------------------------
  // 2. Storage Provider Abstraction Tests
  // --------------------------------------------------------------------------
  it('should store, head, get, and delete objects using LocalStorageProvider', async () => {
    const storageDir = path.join(testDir, 'storage');
    const provider = new LocalStorageProvider({ storageDir, baseUrl: 'http://127.0.0.1:8989' });

    const key = 'test/profile-1/archive.enc';
    const testData = Buffer.from('Encrypted binary data blob');

    // Put
    const putRes = await provider.putObject(key, testData);
    expect(putRes.success).toBe(true);
    expect(putRes.size).toBe(testData.length);

    // Head
    const headRes = await provider.headObject(key);
    expect(headRes?.exists).toBe(true);
    expect(headRes?.size).toBe(testData.length);
    expect(headRes?.checksum).toBe(crypto.createHash('sha256').update(testData).digest('hex'));

    // Get
    const fetched = await provider.getObject(key);
    expect(fetched?.toString('utf8')).toBe(testData.toString('utf8'));

    // Presigned URLs
    const uploadUrl = await provider.createUploadUrl(key, 'application/octet-stream', 60);
    expect(uploadUrl).toContain('key=' + encodeURIComponent(key));
    expect(uploadUrl).toContain('token=');

    const downloadUrl = await provider.createDownloadUrl(key, 60);
    expect(downloadUrl).toContain('key=' + encodeURIComponent(key));

    // Delete
    const deleted = await provider.deleteObject(key);
    expect(deleted).toBe(true);

    const headAfter = await provider.headObject(key);
    expect(headAfter).toBeNull();
  });

  it('should generate AWS SigV4 presigned URLs in S3R2StorageProvider without credentials leaks', async () => {
    const r2Provider = new S3R2StorageProvider({
      bucket: 'my-cloud-profiles',
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      accessKeyId: 'TEST_ACCESS_KEY_ID',
      secretAccessKey: 'TEST_SECRET_ACCESS_KEY_123456789',
      region: 'auto',
    });

    const key = 'profiles/usr_1/prof_2/archive.enc';
    const uploadUrl = await r2Provider.createUploadUrl(key);
    const downloadUrl = await r2Provider.createDownloadUrl(key);

    expect(uploadUrl).toContain('https://test-account.r2.cloudflarestorage.com/my-cloud-profiles/profiles/usr_1/prof_2/archive.enc');
    expect(uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(uploadUrl).toContain('X-Amz-Credential=TEST_ACCESS_KEY_ID');
    expect(uploadUrl).toContain('X-Amz-Signature=');
    expect(uploadUrl).not.toContain('TEST_SECRET_ACCESS_KEY'); // Never leak secret!

    expect(downloadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(downloadUrl).not.toContain('TEST_SECRET_ACCESS_KEY');
  });

  // --------------------------------------------------------------------------
  // 3. Distributed Profile Locking Tests
  // --------------------------------------------------------------------------
  it('should acquire, renew, release, and expire distributed profile locks correctly', () => {
    const userId = 'user_test_lock_1';
    const profileId = 'cloud_profile_lock_abc';
    const deviceA = 'device_laptop_win';
    const deviceB = 'device_desktop_mac';

    // Device A acquires lock
    const resA = acquireProfileLock(userId, profileId, deviceA, 'My Windows Laptop', 10);
    expect(resA.acquired).toBe(true);

    // Device B attempts to acquire same profile while locked
    const resB = acquireProfileLock(userId, profileId, deviceB, 'My Mac Studio', 10);
    expect(resB.acquired).toBe(false);
    expect(resB.heldBy).toBe('My Windows Laptop');

    // Status check
    const status = getProfileLockStatus(userId, profileId);
    expect(status.isLocked).toBe(true);
    expect(status.deviceId).toBe(deviceA);

    // Device A renews lock
    const renew = renewProfileLock(userId, profileId, deviceA, 30);
    expect(renew.renewed).toBe(true);

    // Device A releases lock
    const release = releaseProfileLock(userId, profileId, deviceA);
    expect(release.released).toBe(true);

    // Device B can now acquire lock
    const resB2 = acquireProfileLock(userId, profileId, deviceB, 'My Mac Studio', 10);
    expect(resB2.acquired).toBe(true);

    // Cleanup
    releaseProfileLock(userId, profileId, deviceB);
  });

  it('should automatically allow acquisition after lock TTL expiration', () => {
    const db = getDatabase();
    const userId = 'user_ttl_test';
    const profileId = 'cloud_profile_ttl_123';
    const deviceA = 'device_a';
    const deviceB = 'device_b';

    // Insert an expired lock directly in DB
    const expiredTime = new Date(Date.now() - 5000).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO cloud_profile_locks (cloud_profile_id, device_id, device_name, user_id, locked_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(profileId, deviceA, 'Crashed PC', userId, expiredTime, expiredTime);

    // Device B should immediately acquire the lock without deadlock
    const resB = acquireProfileLock(userId, profileId, deviceB, 'Device B', 60);
    expect(resB.acquired).toBe(true);

    releaseProfileLock(userId, profileId, deviceB);
  });

  // --------------------------------------------------------------------------
  // 4. Profile Cloning & Identity Isolation Test
  // --------------------------------------------------------------------------
  it('should ensure cloned profiles receive a fresh identity and never inherit cloud bindings', () => {
    const sourceProfile = createProfile({
      name: 'Original Cloud Profile',
      folder: 'Social Media',
      tags: ['Work'],
    });

    // Simulate source having a cloud binding
    setProfileCloudBinding(sourceProfile.id, {
      cloudProfileId: 'cloud_bound_uuid_999',
      lastSyncedVersion: 5,
      updatedAt: new Date().toISOString(),
    });

    const bindingOriginal = getProfileCloudBinding(sourceProfile.id);
    expect(bindingOriginal?.cloudProfileId).toBe('cloud_bound_uuid_999');

    // Clone the profile
    const clonedProfile = cloneProfile({
      sourceProfileId: sourceProfile.id,
      newName: 'Cloned Profile Copy',
    });

    expect(clonedProfile.id).not.toBe(sourceProfile.id);

    // Assert the cloned profile has NO cloud binding (zero leak)
    const bindingCloned = getProfileCloudBinding(clonedProfile.id);
    expect(bindingCloned).toBeNull();

    // Clean up
    removeProfileCloudBinding(sourceProfile.id);
    deleteProfile(sourceProfile.id);
    deleteProfile(clonedProfile.id);
  });
});
