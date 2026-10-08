/**
 * MAHI Browser — Production Cloud Object Storage & Security Policy Unit Tests
 * Batch P0-C Verification Suite
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  S3R2StorageProvider,
  LocalStorageProvider,
  getStorageProvider,
  setStorageProviderForTest,
} from '../../08_SECURITY/storage-provider.js';

describe('Batch P0-C — Cloud Object Storage & Production Hardening', () => {
  beforeEach(() => {
    setStorageProviderForTest(null);
  });

  afterEach(() => {
    setStorageProviderForTest(null);
    vi.restoreAllMocks();
  });

  describe('1. S3 / R2 SigV4 Presigned URL Generation', () => {
    it('generates AWS SigV4 presigned upload and download URLs with cryptographic signatures', async () => {
      const provider = new S3R2StorageProvider({
        bucket: 'mahi-production-profiles',
        endpoint: 'https://test-account-id.r2.cloudflarestorage.com',
        accessKeyId: 'AKIA_PROD_TEST_KEY_123',
        secretAccessKey: 'sec_test_secret_key_456_secure_key',
        region: 'auto',
      });

      const objectKey = 'profiles/usr_123/prof_456/archive_v1.enc';
      const uploadUrl = await provider.createUploadUrl(objectKey, 'application/octet-stream', 900);
      const downloadUrl = await provider.createDownloadUrl(objectKey, 900);

      expect(uploadUrl).toContain('https://test-account-id.r2.cloudflarestorage.com/mahi-production-profiles/profiles/usr_123/prof_456/archive_v1.enc');
      expect(uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
      expect(uploadUrl).toContain('X-Amz-Credential=AKIA_PROD_TEST_KEY_123');
      expect(uploadUrl).toContain('X-Amz-Signature=');
      expect(uploadUrl).toContain('X-Amz-Expires=900');

      expect(downloadUrl).toContain('X-Amz-Signature=');
      expect(downloadUrl).not.toBe(uploadUrl);
    });

    it('detects and rejects expired presigned URLs', async () => {
      const provider = new S3R2StorageProvider({
        bucket: 'mahi-profiles',
        endpoint: 'https://s3.amazonaws.com',
        accessKeyId: 'AKIA_KEY',
        secretAccessKey: 'SEC_KEY',
        region: 'us-east-1',
      });

      // Valid URL (15 min expiry)
      const validUrl = await provider.createDownloadUrl('test.enc', 900);
      expect(S3R2StorageProvider.isPresignedUrlExpired(validUrl)).toBe(false);

      // Past/expired URL simulated
      const expiredUrl = validUrl.replace(/X-Amz-Expires=\d+/, 'X-Amz-Expires=0');
      expect(S3R2StorageProvider.isPresignedUrlExpired(expiredUrl)).toBe(true);
    });
  });

  describe('2. Bucket Security Policy & Lifecycle Configuration', () => {
    it('enforces private-only bucket access, zero public ACLs, and AES256 server-side encryption', () => {
      const provider = new S3R2StorageProvider({
        bucket: 'mahi-secure-vault',
        endpoint: 'https://s3.amazonaws.com',
        accessKeyId: 'KEY',
        secretAccessKey: 'SECRET',
      });

      const policy = provider.getSecurityPolicy();
      expect(policy.bucket).toBe('mahi-secure-vault');
      expect(policy.isPrivateOnly).toBe(true);
      expect(policy.blockPublicAccess.blockPublicAcls).toBe(true);
      expect(policy.blockPublicAccess.blockPublicPolicy).toBe(true);
      expect(policy.blockPublicAccess.ignorePublicAcls).toBe(true);
      expect(policy.blockPublicAccess.restrictPublicBuckets).toBe(true);
      expect(policy.serverSideEncryption).toBe('AES256');
      expect(policy.cors.allowedOrigins).toEqual([
        'https://app.mahibrowser.com',
        'https://admin.mahibrowser.com',
      ]);
      expect(policy.lifecycle.noncurrentVersionExpirationDays).toBe(30);
      expect(policy.lifecycle.abortIncompleteMultipartUploadDays).toBe(7);
    });
  });

  describe('3. Production Mode Hardening (No Silent Local Fallback)', () => {
    it('strictly throws PRODUCTION_STORAGE_UNAVAILABLE in production if credentials unset', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevR2Key = process.env.R2_ACCESS_KEY;
      const prevS3Key = process.env.AWS_ACCESS_KEY_ID;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.R2_ACCESS_KEY;
        delete process.env.R2_ACCESS_KEY_ID;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.R2_SECRET_KEY;
        delete process.env.R2_SECRET_ACCESS_KEY;
        delete process.env.AWS_SECRET_ACCESS_KEY;

        expect(() => {
          getStorageProvider();
        }).toThrow('PRODUCTION_STORAGE_UNAVAILABLE');
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevR2Key) process.env.R2_ACCESS_KEY = prevR2Key;
        if (prevS3Key) process.env.AWS_ACCESS_KEY_ID = prevS3Key;
      }
    });

    it('resolves S3R2StorageProvider when production credentials exist', () => {
      const prevR2Key = process.env.R2_ACCESS_KEY;
      const prevR2Sec = process.env.R2_SECRET_KEY;
      try {
        process.env.R2_ACCESS_KEY = 'r2_prod_key_id';
        process.env.R2_SECRET_KEY = 'r2_prod_secret_val';

        const provider = getStorageProvider();
        expect(provider instanceof S3R2StorageProvider).toBe(true);
        expect(provider.name).toBe('s3-r2');
      } finally {
        if (prevR2Key) process.env.R2_ACCESS_KEY = prevR2Key;
        else delete process.env.R2_ACCESS_KEY;
        if (prevR2Sec) process.env.R2_SECRET_KEY = prevR2Sec;
        else delete process.env.R2_SECRET_KEY;
      }
    });
  });

  describe('4. Encrypted Profile Object E2E Flow', () => {
    it('stores and restores encrypted profile payload with checksum verification', async () => {
      const localProvider = new LocalStorageProvider();
      const mockCiphertext = crypto.randomBytes(1024 * 32); // 32KB payload
      const checksum = crypto.createHash('sha256').update(mockCiphertext).digest('hex');
      const objectKey = `profiles/usr_alice/prof_e2e_${Date.now()}/data.enc`;

      // Upload
      const putResult = await localProvider.putObject(objectKey, mockCiphertext);
      expect(putResult.success).toBe(true);
      expect(putResult.size).toBe(mockCiphertext.length);

      // Head metadata
      const head = await localProvider.headObject(objectKey);
      expect(head).not.toBeNull();
      expect(head?.exists).toBe(true);
      expect(head?.size).toBe(mockCiphertext.length);
      expect(head?.checksum).toBe(checksum);

      // Download
      const retrieved = await localProvider.getObject(objectKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.equals(mockCiphertext)).toBe(true);

      // Delete
      const deleted = await localProvider.deleteObject(objectKey);
      expect(deleted).toBe(true);

      const afterDelete = await localProvider.headObject(objectKey);
      expect(afterDelete).toBeNull();
    });
  });
});
