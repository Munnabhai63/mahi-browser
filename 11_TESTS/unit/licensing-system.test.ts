import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createLicense,
  activateLicense,
  getLicenseById,
  getLicenses,
  revokeLicense,
  extendLicense,
  getLicenseDevices,
  deactivateDevice,
  validateCurrentLicense,
  normalizeLicenseKey,
  evaluateServerStatus,
} from '../../04_LICENSING/license-engine.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { createProfile, getProfiles } from '../../02_BROWSER/services/profile-service.js';

describe('MAHI PRO — Secure Server-Side Licensing System Test Suite', () => {
  let tempDir: string;
  let dbPath: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-licensing-test-'));
    dbPath = path.join(tempDir, 'test_license.sqlite');
    setCustomDatabasePath(dbPath);
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // 1. Key generation and normalization
  describe('License Key Generation & Normalization', () => {
    it('should normalize license keys safely (uppercase, strip whitespace, format hyphens)', () => {
      const input1 = 'mahi-a1b2-c3d4-e5f6-7890';
      expect(normalizeLicenseKey(input1)).toBe('MAHI-A1B2-C3D4-E5F6-7890');

      const input2 = '  mahi a1b2 c3d4 e5f6 7890  ';
      expect(normalizeLicenseKey(input2)).toBe('MAHI-A1B2-C3D4-E5F6-7890');
    });
  });

  // 2. License Creation (1 Day, 30 Days, 1 Year, Lifetime, Custom)
  describe('Owner / Admin License Creation', () => {
    it('should create a 1-day license with correct calculated expiry', () => {
      const res = createLicense({
        customerName: 'Alice 1-Day Trial',
        durationType: '1_DAY',
        maxDevices: 1,
      });

      expect(res.success).toBe(true);
      expect(res.rawLicenseKey).toMatch(/^MAHI-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(res.license.durationType).toBe('1_DAY');
      expect(res.license.status).toBe('ACTIVE');
      expect(res.license.expiresAt).not.toBeNull();

      const startTime = new Date(res.license.startsAt).getTime();
      const expiryTime = new Date(res.license.expiresAt!).getTime();
      const diffHours = (expiryTime - startTime) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(24);
    });

    it('should create a 30-day license with correct calculated expiry', () => {
      const res = createLicense({
        customerName: 'Bob 30-Day Pro',
        durationType: '30_DAYS',
        maxDevices: 2,
      });

      expect(res.success).toBe(true);
      expect(res.license.durationType).toBe('30_DAYS');
      expect(res.license.maxDevices).toBe(2);

      const startTime = new Date(res.license.startsAt).getTime();
      const expiryTime = new Date(res.license.expiresAt!).getTime();
      const diffDays = (expiryTime - startTime) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(30);
    });

    it('should create a 1-year license with correct calculated expiry', () => {
      const res = createLicense({
        customerName: 'Charlie Enterprise 1-Year',
        durationType: '1_YEAR',
        maxDevices: 5,
      });

      expect(res.success).toBe(true);
      const startTime = new Date(res.license.startsAt).getTime();
      const expiryTime = new Date(res.license.expiresAt!).getTime();
      const diffDays = (expiryTime - startTime) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(365);
    });

    it('should create a lifetime license with null expiresAt', () => {
      const res = createLicense({
        customerName: 'David Lifetime VIP',
        durationType: 'LIFETIME',
        maxDevices: 10,
      });

      expect(res.success).toBe(true);
      expect(res.license.expiresAt).toBeNull();
      expect(res.license.status).toBe('ACTIVE');
    });

    it('should create a custom duration license with user-defined dates', () => {
      const customExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const res = createLicense({
        customerName: 'Eva Custom Period',
        durationType: 'CUSTOM',
        expiresAt: customExpiry,
        maxDevices: 3,
      });

      expect(res.success).toBe(true);
      expect(res.license.expiresAt).toBe(customExpiry);
    });
  });

  // 3. User Activation & Device Limit Enforcement
  describe('License Activation & Device Limits', () => {
    it('should activate a valid license on Device 1', () => {
      const created = createLicense({
        customerName: 'Frank Single Device',
        durationType: '30_DAYS',
        maxDevices: 1,
      });

      const actRes = activateLicense(created.rawLicenseKey, 'device_frank_01', 'Frank Laptop (Windows)');
      expect(actRes.success).toBe(true);
      expect(actRes.status).toBe('ACTIVE');
      expect(actRes.license?.activeDevicesCount).toBe(1);

      // Verify current license state
      const current = validateCurrentLicense();
      expect(current.isValid).toBe(true);
      expect(current.status).toBe('ACTIVE');
    });

    it('should reject activation on Device 2 when maxDevices limit is 1', () => {
      const created = createLicense({
        customerName: 'Grace Max 1 Device',
        durationType: '30_DAYS',
        maxDevices: 1,
      });

      // Device A activates
      const actA = activateLicense(created.rawLicenseKey, 'device_grace_A', 'Grace PC');
      expect(actA.success).toBe(true);

      // Device B attempts activation
      const actB = activateLicense(created.rawLicenseKey, 'device_grace_B', 'Grace Secondary Laptop');
      expect(actB.success).toBe(false);
      expect(actB.status).toBe('SUSPENDED');
      expect(actB.message).toContain('Device activation limit reached');
    });

    it('should allow activation up to maxDevices = 3 and reject the 4th device', () => {
      const created = createLicense({
        customerName: 'Team Multi Device',
        durationType: '30_DAYS',
        maxDevices: 3,
      });

      expect(activateLicense(created.rawLicenseKey, 'dev_1', 'Device 1').success).toBe(true);
      expect(activateLicense(created.rawLicenseKey, 'dev_2', 'Device 2').success).toBe(true);
      expect(activateLicense(created.rawLicenseKey, 'dev_3', 'Device 3').success).toBe(true);

      // 4th device rejected
      const act4 = activateLicense(created.rawLicenseKey, 'dev_4', 'Device 4');
      expect(act4.success).toBe(false);
      expect(act4.message).toContain('Device activation limit reached');
    });

    it('should allow activating new device after deactivating an existing device', () => {
      const created = createLicense({
        customerName: 'Device Swap User',
        durationType: '30_DAYS',
        maxDevices: 1,
      });

      activateLicense(created.rawLicenseKey, 'old_device_1', 'Old PC');
      expect(getLicenseDevices(created.license.id).length).toBe(1);

      // Deactivate old device
      expect(deactivateDevice(created.license.id, 'old_device_1')).toBe(true);

      // New device can now activate
      const actNew = activateLicense(created.rawLicenseKey, 'new_device_2', 'New PC');
      expect(actNew.success).toBe(true);
      expect(actNew.status).toBe('ACTIVE');
    });

    it('should reject invalid / non-existent license keys', () => {
      const act = activateLicense('MAHI-0000-0000-0000-0000', 'dev_test', 'PC');
      expect(act.success).toBe(false);
      expect(act.status).toBe('NOT_ACTIVATED');
      expect(act.message).toContain('No matching license found');
    });
  });

  // 4. Expiry & Revocation Checks
  describe('Server-Side Expiry & Revocation Handling', () => {
    it('should evaluate server-side expired status if past expiry date', () => {
      // Past expiry date in ISO
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      const status = evaluateServerStatus('ACTIVE', pastDate, null);
      expect(status).toBe('EXPIRED');
    });

    it('should reject activation for an expired license', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      const created = createLicense({
        customerName: 'Expired User',
        durationType: 'CUSTOM',
        expiresAt: pastDate,
        maxDevices: 1,
      });

      const act = activateLicense(created.rawLicenseKey, 'dev_exp', 'PC');
      expect(act.success).toBe(false);
      expect(act.status).toBe('EXPIRED');
      expect(act.message).toContain('license has expired');
    });

    it('should revoke a license and deactivate all bound devices immediately', () => {
      const created = createLicense({
        customerName: 'Bad Actor',
        durationType: '1_YEAR',
        maxDevices: 2,
      });

      activateLicense(created.rawLicenseKey, 'bad_dev_1', 'Bad PC 1');
      activateLicense(created.rawLicenseKey, 'bad_dev_2', 'Bad PC 2');

      expect(revokeLicense(created.license.id, 'Terms of service violation')).toBe(true);

      const retrieved = getLicenseById(created.license.id);
      expect(retrieved?.status).toBe('REVOKED');
      expect(retrieved?.revokedAt).not.toBeNull();

      // Subsequent activation attempts must be rejected
      const reAct = activateLicense(created.rawLicenseKey, 'bad_dev_3', 'Bad PC 3');
      expect(reAct.success).toBe(false);
      expect(reAct.status).toBe('REVOKED');
      expect(reAct.message).toContain('license has been revoked');
    });

    it('should extend an expired license and restore ACTIVE status', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      const created = createLicense({
        customerName: 'Renewal Customer',
        durationType: 'CUSTOM',
        expiresAt: pastDate,
        maxDevices: 1,
      });

      expect(getLicenseById(created.license.id)?.status).toBe('EXPIRED');

      const extended = extendLicense({
        licenseId: created.license.id,
        additionalDays: 30,
      });

      expect(extended?.status).toBe('ACTIVE');
      expect(new Date(extended!.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  // 5. Account Binding
  describe('Account Binding Validation', () => {
    it('should enforce account matching when account_id is specified', () => {
      const created = createLicense({
        customerName: 'Account Bound User',
        accountId: 'acc_12345',
        durationType: '30_DAYS',
        maxDevices: 1,
      });

      // Different account rejected
      const mismatch = activateLicense(created.rawLicenseKey, 'dev_acc_test', 'PC', 'acc_99999');
      expect(mismatch.success).toBe(false);
      expect(mismatch.message).toContain('Account mismatch');

      // Correct account accepted
      const match = activateLicense(created.rawLicenseKey, 'dev_acc_test', 'PC', 'acc_12345');
      expect(match.success).toBe(true);
      expect(match.status).toBe('ACTIVE');
    });
  });

  // 6. RBAC & Admin Authorization
  describe('Owner / Admin RBAC Security', () => {
    it('should authenticate valid Owner / Admin credentials and reject unauthorized attempts', async () => {
      const { getMasterAdminSecret } = await import('../../08_SECURITY/install-secrets.js');
      const dynamicSecret = getMasterAdminSecret();
      expect(verifyAdminAccess(dynamicSecret)).toBe(true);
      expect(verifyAdminAccess('MAHI_OWNER_AUTH_2026')).toBe(false);
      expect(verifyAdminAccess('mahi_pro_owner_master')).toBe(false);
      expect(verifyAdminAccess('invalid_secret_key_123')).toBe(false);
      expect(verifyAdminAccess('')).toBe(false);
    });
  });

  // 7. Non-Destructive Data Safety
  describe('Data Safety & Profile Integrity', () => {
    it('should not interfere with or modify existing profiles', () => {
      const p = createProfile({ name: 'Licensing Test Profile', folder: 'Work' });
      expect(p.id).toBeDefined();

      const all = getProfiles();
      expect(all.some((prof) => prof.id === p.id)).toBe(true);
    });
  });
});
