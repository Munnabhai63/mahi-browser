import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  deriveUserSyncKey,
  wrapDataKey,
  unwrapDataKey,
  encryptProfileArchive,
  decryptProfileArchive,
} from '../../08_SECURITY/cloud-profile-crypto.js';
import {
  getEffectiveSyncPassphrase,
  getSyncConfig,
  setSyncConfig,
  acquireCloudLock,
} from '../../08_SECURITY/cloud-sync-service.js';
import {
  saveEncryptedSession,
  clearEncryptedSession,
} from '../../08_SECURITY/account-service.js';

describe('Task 4: Cloud Sync Encryption Key Isolation & Offline Fallback', () => {
  beforeEach(() => {
    clearEncryptedSession();
    setSyncConfig({ syncPassphrase: 'mahi-cloud-sync' });
  });

  afterEach(() => {
    clearEncryptedSession();
    setSyncConfig({ syncPassphrase: 'mahi-cloud-sync' });
  });

  describe('Sync Key Derivation & Input Validation', () => {
    it('should derive a 32-byte (256-bit) buffer from a valid passphrase', () => {
      const key = deriveUserSyncKey('my-secure-passphrase-2026');
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should reject empty or non-string passphrase with an explicit error', () => {
      expect(() => deriveUserSyncKey('')).toThrow('Sync passphrase or secret must be a non-empty string');
      expect(() => deriveUserSyncKey(null as any)).toThrow('Sync passphrase or secret must be a non-empty string');
      expect(() => deriveUserSyncKey(undefined as any)).toThrow('Sync passphrase or secret must be a non-empty string');
    });

    it('should isolate salt when userIdentifier is passed', () => {
      const keyDefault = deriveUserSyncKey('shared-passphrase');
      const keyUserA = deriveUserSyncKey('shared-passphrase', undefined, 'usr_alpha');
      const keyUserB = deriveUserSyncKey('shared-passphrase', undefined, 'usr_beta');

      expect(keyUserA.equals(keyDefault)).toBe(false);
      expect(keyUserB.equals(keyDefault)).toBe(false);
      expect(keyUserA.equals(keyUserB)).toBe(false);
    });
  });

  describe('User Account Isolation (Zero Cross-User Decryption)', () => {
    it('should generate distinct effective passphrases for different logged-in accounts', () => {
      // Simulate User A session
      saveEncryptedSession({
        token: 'token_user_a',
        account_id: 'usr_account_111',
        email: 'usera@example.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });
      const passphraseA = getEffectiveSyncPassphrase();

      // Simulate User B session
      saveEncryptedSession({
        token: 'token_user_b',
        account_id: 'usr_account_222',
        email: 'userb@example.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });
      const passphraseB = getEffectiveSyncPassphrase();

      expect(passphraseA).not.toBe(passphraseB);
      expect(passphraseA).not.toBe('mahi-cloud-sync');
      expect(passphraseB).not.toBe('mahi-cloud-sync');
    });

    it('should prevent User B from decrypting a package encrypted by User A', () => {
      const rawPayload = Buffer.from('Sensitive profile state: cookies, localStorage, tokens');

      // User A encrypts
      saveEncryptedSession({
        token: 'token_user_a',
        account_id: 'usr_account_111',
        email: 'usera@example.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });
      const keyA = getEffectiveSyncPassphrase();
      const pkgA = encryptProfileArchive(rawPayload, keyA);

      // User B attempts to decrypt with their effective key
      saveEncryptedSession({
        token: 'token_user_b',
        account_id: 'usr_account_222',
        email: 'userb@example.com',
        sync_key: null,
        saved_at: new Date().toISOString(),
      });
      const keyB = getEffectiveSyncPassphrase();

      expect(() => {
        decryptProfileArchive({
          ciphertext: pkgA.ciphertext,
          expectedChecksum: pkgA.checksumSha256,
          encryptedDataKey: pkgA.encryptedDataKey,
          iv: pkgA.iv,
          authTag: pkgA.authTag,
          userMasterKey: keyB,
        });
      }).toThrow(/Failed to unwrap profile encryption key|Invalid passphrase/);

      // User A can decrypt successfully
      const decrypted = decryptProfileArchive({
        ciphertext: pkgA.ciphertext,
        expectedChecksum: pkgA.checksumSha256,
        encryptedDataKey: pkgA.encryptedDataKey,
        iv: pkgA.iv,
        authTag: pkgA.authTag,
        userMasterKey: keyA,
      });
      expect(decrypted.toString('utf8')).toBe(rawPayload.toString('utf8'));
    });

    it('should honor explicit user sync key when configured in session', () => {
      const customKey = 'zk-explicit-custom-sync-key-999';
      saveEncryptedSession({
        token: 'token_custom',
        account_id: 'usr_custom_key',
        email: 'custom@example.com',
        sync_key: customKey,
        saved_at: new Date().toISOString(),
      });

      expect(getEffectiveSyncPassphrase()).toBe(customKey);
    });

    it('should honor custom syncPassphrase from sync config if explicitly set', () => {
      setSyncConfig({ syncPassphrase: 'custom-user-entered-passphrase' });
      expect(getEffectiveSyncPassphrase()).toBe('custom-user-entered-passphrase');
    });
  });

  describe('Envelope Encryption & Integrity Verification', () => {
    it('should detect tampered ciphertext and fail before decryption', () => {
      const payload = Buffer.from('Original profile archive data');
      const key = 'test-encryption-key-777';
      const pkg = encryptProfileArchive(payload, key);

      // Tamper with ciphertext
      const tamperedCiphertext = Buffer.from(pkg.ciphertext);
      tamperedCiphertext[0] ^= 0xff; // Flip bits

      expect(() => {
        decryptProfileArchive({
          ciphertext: tamperedCiphertext,
          expectedChecksum: pkg.checksumSha256,
          encryptedDataKey: pkg.encryptedDataKey,
          iv: pkg.iv,
          authTag: pkg.authTag,
          userMasterKey: key,
        });
      }).toThrow(/Checksum verification failed/);
    });

    it('should detect tampered auth tag and reject payload', () => {
      const payload = Buffer.from('Integrity test payload');
      const key = 'test-auth-key-888';
      const pkg = encryptProfileArchive(payload, key);

      // Recompute checksum to match tampered ciphertext, but authTag remains invalid
      const tamperedCiphertext = Buffer.from(pkg.ciphertext);
      tamperedCiphertext[0] ^= 0x01;
      const newChecksum = crypto.createHash('sha256').update(tamperedCiphertext).digest('hex');

      expect(() => {
        decryptProfileArchive({
          ciphertext: tamperedCiphertext,
          expectedChecksum: newChecksum,
          encryptedDataKey: pkg.encryptedDataKey,
          iv: pkg.iv,
          authTag: pkg.authTag,
          userMasterKey: key,
        });
      }).toThrow(/Decryption failed/);
    });
  });

  describe('Offline Tolerance & Non-Blocking Fallback', () => {
    it('should safely return acquired=true when offline / unreachable network', async () => {
      // Point to an unreachable port to simulate complete network offline state
      process.env.COMMERCIAL_API_URL = 'http://127.0.0.1:59999';

      const lockRes = await acquireCloudLock('offline_test_profile_id', 30);
      expect(lockRes).toBeDefined();
      expect(lockRes.acquired).toBe(true);

      delete process.env.COMMERCIAL_API_URL;
    });
  });
});
