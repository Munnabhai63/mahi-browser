import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { FREE_PROFILE_LIMIT, PRO_PROFILE_LIMIT } from '../10_CONFIG/freemium-limits.js';
import { verifyLicense } from './license-service.js';
import { isOnlineRevoked, isGraceExpired } from './license-status-service.js';
import { getDynamicPrice } from './price-service.js';
import { getDatabase } from '../06_DATABASE/connection.js';
import { hasValidAccountSubscription, getAccountPlanLimits, isBusinessPlan, readCachedStatus, getAccountSession } from './account-service.js';
import { getActiveUserId } from '../07_BACKEND/commercial/session-context.js';

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
 * Returns true if the device has an authentic, unexpired RSA-signed MAHI- license.
 * The ONLY path to PRO is an RSA-signed license verified with the public key.
 * If expired, missing, revoked, or grace-expired, returns false so limits fall back to FREE tier.
 */
export function hasValidLicense(): boolean {
  if (isOnlineRevoked() || isGraceExpired()) {
    return false;
  }
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

  return false;
}

/**
 * Resolves the effective owner ID for quota enforcement.
 * Defaults to authenticated session account_id, then active memory user ID,
 * and finally 'SYSTEM_OWNER' (desktop guest).
 */
export function resolveDefaultOwnerId(explicitOwnerId?: string): string {
  if (explicitOwnerId) return explicitOwnerId;
  try {
    const session = getAccountSession();
    if (session?.account_id) return session.account_id;
  } catch {}
  try {
    const activeUserId = getActiveUserId();
    if (activeUserId) return activeUserId;
  } catch {}
  return 'SYSTEM_OWNER';
}

/**
 * Returns current number of active (non-deleted) profiles in the database.
 * Supports isolation by owner_id (defaults to active user or 'SYSTEM_OWNER' for desktop guest profiles).
 */
export function getNonDeletedProfileCount(ownerId?: string): number {
  try {
    const targetOwner = resolveDefaultOwnerId(ownerId);
    const db = getDatabase();
    if (targetOwner === 'SYSTEM_OWNER') {
      const row = db.prepare(
        "SELECT COUNT(*) as count FROM profiles WHERE deleted_at IS NULL AND (owner_id = 'SYSTEM_OWNER' OR owner_id = 'LOCAL_CLIENT' OR owner_id IS NULL)"
      ).get() as { count: number } | undefined;
      return typeof row?.count === 'number' ? row.count : 0;
    }
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM profiles WHERE deleted_at IS NULL AND owner_id = ?'
    ).get(targetOwner) as { count: number } | undefined;
    return typeof row?.count === 'number' ? row.count : 0;
  } catch {
    return 0;
  }
}

export function isUserBusiness(): boolean {
  if (!hasValidAccountSubscription()) return false;
  const cached = readCachedStatus();
  return isBusinessPlan(cached?.plan);
}

export function isUserPro(): boolean {
  return hasValidAccountSubscription() || hasValidLicense();
}

/**
 * Validates whether creating `additionalCount` profiles is permitted under current plan.
 * Throws a user-friendly error if the limit is exceeded.
 */
export function assertCanCreateProfile(additionalCount = 1, ownerId?: string): void {
  const resolvedOwner = resolveDefaultOwnerId(ownerId);
  const currentCount = getNonDeletedProfileCount(resolvedOwner);
  const limits = getPlanLimitsInfo(resolvedOwner);

  if (currentCount + additionalCount > limits.maxProfiles) {
    if (limits.maxProfiles <= FREE_PROFILE_LIMIT) {
      const price = getDynamicPrice();
      throw new Error(
        `Free plan limit reached (${FREE_PROFILE_LIMIT} profiles). Upgrade MAHI PRO (₹${price}/year) for ${PRO_PROFILE_LIMIT} profiles.`
      );
    } else if (limits.maxProfiles <= PRO_PROFILE_LIMIT) {
      throw new Error(
        `PRO plan limit reached (${PRO_PROFILE_LIMIT} profiles). Upgrade to BUSINESS to unlock up to 300+ profiles and Team Workspaces.`
      );
    } else {
      throw new Error(
        `Business plan limit reached (${limits.maxProfiles} profiles). Please contact support for an enterprise quota expansion.`
      );
    }
  }
}

/**
 * Helper to query plan information without throwing.
 */
export function getPlanLimitsInfo(ownerId?: string): {
  isLicensed: boolean;
  isPro: boolean;
  isBusiness: boolean;
  currentCount: number;
  maxProfiles: number;
  freeLimit: number;
  proLimit: number;
  tier: 'FREE' | 'PRO' | 'BUSINESS';
} {
  const isLicensed = hasValidLicense();
  const isBiz = isUserBusiness();
  const isPro = isBiz || isUserPro();
  const accountLimits = getAccountPlanLimits();

  let maxProfiles = FREE_PROFILE_LIMIT;
  if (isBiz) {
    maxProfiles = Math.max(accountLimits.maxProfiles, 100);
  } else if (isPro) {
    maxProfiles = accountLimits.maxProfiles > 15 ? accountLimits.maxProfiles : PRO_PROFILE_LIMIT;
  }

  const tier: 'FREE' | 'PRO' | 'BUSINESS' = isBiz ? 'BUSINESS' : isPro ? 'PRO' : 'FREE';
  const resolvedOwner = resolveDefaultOwnerId(ownerId);

  return {
    isLicensed,
    isPro,
    isBusiness: isBiz,
    currentCount: getNonDeletedProfileCount(resolvedOwner),
    maxProfiles,
    freeLimit: FREE_PROFILE_LIMIT,
    proLimit: PRO_PROFILE_LIMIT,
    tier,
  };
}

/**
 * Asserts that the desktop environment has entitlement for a specific capability.
 */
export function assertCapability(capability: string): void {
  // 1. Basic features available to all users (including reverse-engineered native C++ hooks and humanizer)
  if (
    capability === 'profile.basic' ||
    capability === 'proxy.custom' ||
    capability === 'stealth.nativeHooks117' ||
    capability === 'stealth.aiHumanizer'
  ) {
    return;
  }

  // 2. Capabilities requiring BUSINESS tier
  if (capability === 'workspace.team') {
    if (!isUserBusiness()) {
      const err = new Error(
        `FEATURE_NOT_INCLUDED: Feature "${capability}" requires a MAHI BUSINESS subscription. Please upgrade to unlock team workspaces.`
      );
      (err as any).code = 'FEATURE_NOT_INCLUDED';
      (err as any).capability = capability;
      (err as any).requiredPlan = 'BUSINESS';
      throw err;
    }
    return;
  }

  // 3. Capabilities requiring PRO or BUSINESS
  const isPro = isUserPro();
  if (!isPro) {
    const err = new Error(
      `FEATURE_NOT_INCLUDED: Feature "${capability}" requires MAHI PRO or Business plan. Please upgrade to unlock.`
    );
    (err as any).code = 'FEATURE_NOT_INCLUDED';
    (err as any).capability = capability;
    (err as any).requiredPlan = 'PRO';
    throw err;
  }
}

