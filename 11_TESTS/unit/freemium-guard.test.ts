import { describe, it, expect } from 'vitest';
import { assertCanCreateProfile, getPlanLimitsInfo, hasValidLicense } from '../../08_SECURITY/freemium-guard.js';
import { FREE_PROFILE_LIMIT, PRO_PROFILE_LIMIT } from '../../10_CONFIG/freemium-limits.js';

describe('Freemium Guard & Profile Limits', () => {
  it('should export correct limits (15 free, 100 pro)', () => {
    expect(FREE_PROFILE_LIMIT).toBe(15);
    expect(PRO_PROFILE_LIMIT).toBe(100);
  });

  it('should return valid plan limits info', () => {
    const info = getPlanLimitsInfo();
    expect(info).toHaveProperty('isPro');
    expect(info).toHaveProperty('currentCount');
    expect(info).toHaveProperty('maxProfiles');
    expect(typeof info.isPro).toBe('boolean');
    if (info.isPro) {
      expect(info.maxProfiles).toBe(100);
    } else {
      expect(info.maxProfiles).toBe(15);
    }
  });

  it('should enforce limits properly via assertCanCreateProfile', () => {
    if (!hasValidLicense()) {
      expect(() => {
        assertCanCreateProfile(16);
      }).toThrow('Free plan limit reached (15 profiles). Activate a license (₹599/year) to create up to 100 profiles.');
    }
  });

  it('should strictly reject legacy SQLite DB license rows without RSA signatures', async () => {
    const { initializeDatabase } = await import('../../06_DATABASE/schema.js');
    await initializeDatabase();
    const { getDatabase } = await import('../../06_DATABASE/connection.js');
    const db = getDatabase();
    // Insert an active DB-only license row into SQLite
    try {
      db.prepare(`
        INSERT OR REPLACE INTO licenses (
          id, license_key_hash, key_masked, customer_name, account_id,
          status, duration_type, max_devices, starts_at, expires_at, created_at, created_by
        ) VALUES (
          'fake-db-lic-id', 'hash123', 'MAHI-TEST-KEY', 'Test User', 'acc_1',
          'ACTIVE', '1_YEAR', 5, datetime('now'), datetime('now', '+1 year'), datetime('now'), 'ADMIN'
        )
      `).run();

      // Ensure that hasValidLicense STILL returns false unless an authentic RSA signature file exists
      // (This proves the legacy DB bypass is completely killed)
      const limits = getPlanLimitsInfo();
      // If no valid RSA key file exists, plan MUST remain Free
      const fs = await import('node:fs');
      const path = await import('node:path');
      const rsaFile = path.join(process.cwd(), '.mahi_data', 'offline-license.key');
      if (!fs.existsSync(rsaFile)) {
        expect(hasValidLicense()).toBe(false);
        expect(limits.isPro).toBe(false);
        expect(limits.maxProfiles).toBe(15);
      }
    } finally {
      try {
        db.prepare("DELETE FROM licenses WHERE id = 'fake-db-lic-id'").run();
      } catch {}
    }
  });
});
