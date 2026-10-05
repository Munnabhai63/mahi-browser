import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { FREE_PROFILE_LIMIT, PRO_PROFILE_LIMIT } from '../10_CONFIG/freemium-limits.js';
import { verifyLicense } from './license-service.js';
import { validateCurrentLicense } from '../04_LICENSING/license-engine.js';
import { getDatabase } from '../06_DATABASE/connection.js';

function getUserDataPath(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch {}

  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'mahi-browser');
  } else if (process.env.HOME) {
    return path.join(process.env.HOME, '.mahi-browser');
  }
  return path.join(process.cwd(), '.mahi_data');
}

/**
 * Returns true if the device has an authentic, unexpired RSA or DB license.
 * If expired or invalid, returns false so limits fall back to FREE tier.
 */
export function hasValidLicense(): boolean {
  // 1. Check RSA offline-license.key
  try {
    const userDataDir = getUserDataPath();
    const licenseFile = path.join(userDataDir, 'offline-license.key');
    if (fs.existsSync(licenseFile)) {
      const rawKey = fs.readFileSync(licenseFile, 'utf8').trim();
      if (rawKey) {
        const check = verifyLicense(rawKey);
        if (check.valid) {
          return true;
        }
      }
    }
  } catch {}

  // 2. Check claimed-licenses.json
  try {
    const userDataDir = getUserDataPath();
    const claimedFile = path.join(userDataDir, 'claimed-licenses.json');
    if (fs.existsSync(claimedFile)) {
      const claimed: Record<string, string> = JSON.parse(fs.readFileSync(claimedFile, 'utf8'));
      for (const key of Object.values(claimed)) {
        if (key && typeof key === 'string') {
          const check = verifyLicense(key.trim());
          if (check.valid) {
            return true;
          }
        }
      }
    }
  } catch {}

  // 3. Check 04_LICENSING SQLite engine
  try {
    const status = validateCurrentLicense();
    if (status && status.isValid && status.status === 'ACTIVE') {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Returns current number of active (non-deleted) profiles in the database.
 */
export function getNonDeletedProfileCount(): number {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE deleted_at IS NULL').get() as { count: number } | undefined;
    return typeof row?.count === 'number' ? row.count : 0;
  } catch {
    return 0;
  }
}

/**
 * Validates whether creating `additionalCount` profiles is permitted under current plan.
 * Throws a user-friendly error if the limit is exceeded.
 */
export function assertCanCreateProfile(additionalCount = 1): void {
  const currentCount = getNonDeletedProfileCount();
  const isLicensed = hasValidLicense();

  if (!isLicensed) {
    if (currentCount + additionalCount > FREE_PROFILE_LIMIT) {
      throw new Error(
        `Free plan limit reached (${FREE_PROFILE_LIMIT} profiles). Activate a license (₹599/year) to create up to ${PRO_PROFILE_LIMIT} profiles.`
      );
    }
  } else {
    if (currentCount + additionalCount > PRO_PROFILE_LIMIT) {
      throw new Error('Pro plan limit reached.');
    }
  }
}

/**
 * Helper to query plan information without throwing.
 */
export function getPlanLimitsInfo(): {
  isLicensed: boolean;
  isPro: boolean;
  currentCount: number;
  maxProfiles: number;
  freeLimit: number;
  proLimit: number;
} {
  const isLicensed = hasValidLicense();
  return {
    isLicensed,
    isPro: isLicensed,
    currentCount: getNonDeletedProfileCount(),
    maxProfiles: isLicensed ? PRO_PROFILE_LIMIT : FREE_PROFILE_LIMIT,
    freeLimit: FREE_PROFILE_LIMIT,
    proLimit: PRO_PROFILE_LIMIT,
  };
}
