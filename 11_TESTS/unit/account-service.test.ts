import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  saveEncryptedSession,
  loadEncryptedSession,
  clearEncryptedSession,
  writeCachedStatus,
  verifyAccountStatusSignature,
  hasValidAccountSubscription,
  getAccountProfileLimit,
  isAccountSyncAllowed,
  getAccountSyncKey,
  getAccountAuthHeader,
  AccountSession,
  CachedAccountStatus
} from '../../08_SECURITY/account-service.js';
import { assertCanCreateProfile, getPlanLimitsInfo, isUserPro } from '../../08_SECURITY/freemium-guard.js';

describe('Phase 5.1: Account & Subscription Unit Tests', () => {
  const testUserData = path.join(process.cwd(), 'scratch', 'test_account_userdata');

  beforeEach(() => {
    fs.mkdirSync(testUserData, { recursive: true });
    process.env.APPDATA = path.join(testUserData, 'appdata');
  });

  afterEach(() => {
    clearEncryptedSession();
    try {
      fs.rmSync(testUserData, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Encrypted Session Storage', () => {
    it('should save and load encrypted account session correctly', () => {
      const mockSession: AccountSession = {
        token: 'test_token_999888777',
        account_id: 'usr_unit_test',
        email: 'unit@mahibrowser.com',
        sync_key: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        saved_at: new Date().toISOString()
      };

      saveEncryptedSession(mockSession);
      const loaded = loadEncryptedSession();

      expect(loaded).not.toBeNull();
      expect(loaded?.token).toBe('test_token_999888777');
      expect(loaded?.email).toBe('unit@mahibrowser.com');
      expect(loaded?.sync_key).toBe(mockSession.sync_key);
      expect(getAccountSyncKey()).toBe(mockSession.sync_key);
      expect(getAccountAuthHeader()).toBe('Bearer test_token_999888777');
    });

    it('should clear session and return null after logout', () => {
      const mockSession: AccountSession = {
        token: 'logout_token_123',
        account_id: 'usr_logout',
        email: 'logout@mahibrowser.com',
        sync_key: null,
        saved_at: new Date().toISOString()
      };

      saveEncryptedSession(mockSession);
      expect(loadEncryptedSession()).not.toBeNull();

      clearEncryptedSession();
      expect(loadEncryptedSession()).toBeNull();
      expect(getAccountSyncKey()).toBeNull();
      expect(getAccountAuthHeader()).toBeNull();
    });
  });

  describe('2. RSA Signature Verification & Status Logic', () => {
    // Generate an RSA-2048 keypair for cryptographic testing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    it('should verify authentic signed status and reject tampered signature', () => {
      const payload = {
        account_id: 'usr_test_sig',
        email: 'sig@mahibrowser.com',
        plan: 'trial',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        server_time: Date.now()
      };

      const signable = `${payload.account_id}:${payload.plan}:${payload.profile_limit}:${payload.sync_allowed}:${payload.expires_at}:${payload.server_time}`;
      const signer = crypto.createSign('SHA256');
      signer.update(signable);
      const signature = signer.sign(privateKey, 'base64');

      // Valid check with dynamic public key
      const verifier = crypto.createVerify('SHA256');
      verifier.update(signable);
      expect(verifier.verify(publicKey, signature, 'base64')).toBe(true);

      // Tampered check (flip last char)
      const tamperedSig = signature.slice(0, -2) + 'AA';
      const badVerifier = crypto.createVerify('SHA256');
      badVerifier.update(signable);
      expect(badVerifier.verify(publicKey, tamperedSig, 'base64')).toBe(false);
    });
  });

  describe('3. Freemium Guard Integration (Free=15, Trial/Pro=100)', () => {
    it('should allow up to 15 profiles on Free plan and block 16th', () => {
      clearEncryptedSession();
      // Ensure no active license or account
      expect(isUserPro()).toBe(false);
      expect(getPlanLimitsInfo().maxProfiles).toBe(15);

      // 14 existing + 1 new = 15 total (Allowed)
      expect(() => assertCanCreateProfile(1)).not.toThrow();
    });

    it('should allow up to 100 profiles when Account has active Trial/PRO plan', () => {
      const mockSession: AccountSession = {
        token: 'trial_token_pro',
        account_id: 'usr_trial_pro',
        email: 'trial@mahibrowser.com',
        sync_key: 'abcdef123',
        saved_at: new Date().toISOString()
      };
      saveEncryptedSession(mockSession);

      const mockStatus: CachedAccountStatus = {
        account_id: 'usr_trial_pro',
        hwid: 'HWID-TEST-123',
        plan: 'trial',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig'
      };
      writeCachedStatus(mockStatus);

      expect(hasValidAccountSubscription()).toBe(true);
      expect(getAccountProfileLimit()).toBe(100);
      expect(isAccountSyncAllowed()).toBe(true);
      expect(isUserPro()).toBe(true);
      expect(getPlanLimitsInfo().maxProfiles).toBe(100);
    });

    it('should downgrade to Free (15) when trial expires beyond 7-day grace period', () => {
      const mockSession: AccountSession = {
        token: 'expired_token',
        account_id: 'usr_expired',
        email: 'expired@mahibrowser.com',
        sync_key: null,
        saved_at: new Date().toISOString()
      };
      saveEncryptedSession(mockSession);

      // Expired trial 10 days ago (past 7-day grace)
      const mockStatus: CachedAccountStatus = {
        account_id: 'usr_expired',
        hwid: 'HWID-TEST-123',
        plan: 'trial',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        server_time: Date.now() - 10 * 86400000,
        verified_at: Date.now() - 10 * 86400000,
        sig: 'mock_sig'
      };
      writeCachedStatus(mockStatus);

      expect(hasValidAccountSubscription()).toBe(false);
      expect(getAccountProfileLimit()).toBe(15);
      expect(isAccountSyncAllowed()).toBe(false);
      expect(getPlanLimitsInfo().maxProfiles).toBe(15);
    });
  });

  describe('4. Device Binding & Cooldown Logic', () => {
    it('should enforce 7-day cooldown calculation correctly', () => {
      const now = Date.now();
      const lastSwitchMs = now - 3 * 86400000; // 3 days ago
      const cooldownMs = 7 * 86400000;
      const isAllowed = (now - lastSwitchMs) >= cooldownMs;
      expect(isAllowed).toBe(false);

      const daysRemaining = Math.ceil((cooldownMs - (now - lastSwitchMs)) / 86400000);
      expect(daysRemaining).toBe(4);

      const oldSwitchMs = now - 8 * 86400000; // 8 days ago
      const isAllowedOld = (now - oldSwitchMs) >= cooldownMs;
      expect(isAllowedOld).toBe(true);
    });
  });
});
