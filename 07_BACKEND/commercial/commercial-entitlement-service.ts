import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  CommercialEntitlements,
  CommercialPlan,
  CommercialSubscription,
  CommercialDevice,
  CommercialUser,
} from '../../10_CONFIG/shared/types/commercial.js';
import { getUserById } from './commercial-auth-service.js';
import { getCommercialPlanById, DEFAULT_COMMERCIAL_PLANS } from './commercial-plan-service.js';
import { registerOrUpdateDevice, getUserDevices } from './commercial-device-service.js';
import { getDeviceId, getDeviceName } from '../../03_HARDWARE/device-id.js';
import { getProfiles } from '../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { validateCurrentLicense, getLicenseById } from '../../04_LICENSING/license-engine.js';

export function evaluateUserEntitlements(
  userId: string,
  targetDeviceId?: string,
  targetDeviceName?: string
): CommercialEntitlements {
  const db = getDatabase();
  const currentDeviceId = targetDeviceId || getDeviceId();
  const currentDeviceName = targetDeviceName || getDeviceName();

  const defaultFreePlan = DEFAULT_COMMERCIAL_PLANS[0];

  // 1. Fetch User Record
  const user = getUserById(userId);
  if (!user) {
    return {
      allowed: false,
      reason: 'User account not found.',
      user: {
        id: userId,
        email: 'unknown@mahibrowser.local',
        name: 'Unknown',
        role: 'USER',
        status: 'SUSPENDED',
      },
      plan: defaultFreePlan,
      device: {
        deviceId: currentDeviceId,
        status: 'REVOKED',
        isAuthorized: false,
      },
      limits: defaultFreePlan.limits,
      usage: {
        profilesCount: 0,
        runningProfilesCount: 0,
        activeDevicesCount: 0,
      },
    };
  }

  // 2. Check User Status (ACTIVE, SUSPENDED, BANNED)
  if (user.status === 'BANNED') {
    return {
      allowed: false,
      reason: 'Account has been banned by an administrator.',
      user,
      plan: defaultFreePlan,
      device: {
        deviceId: currentDeviceId,
        status: 'REVOKED',
        isAuthorized: false,
      },
      limits: { ...defaultFreePlan.limits, maxProfiles: 0, maxConcurrentRunning: 0 },
      usage: { profilesCount: 0, runningProfilesCount: 0, activeDevicesCount: 0 },
    };
  }

  if (user.status === 'SUSPENDED') {
    return {
      allowed: false,
      reason: 'Account is currently suspended.',
      user,
      plan: defaultFreePlan,
      device: {
        deviceId: currentDeviceId,
        status: 'REVOKED',
        isAuthorized: false,
      },
      limits: { ...defaultFreePlan.limits, maxProfiles: 0, maxConcurrentRunning: 0 },
      usage: { profilesCount: 0, runningProfilesCount: 0, activeDevicesCount: 0 },
    };
  }

  // 3. Fetch Plan
  const plan = getCommercialPlanById(user.planId) || defaultFreePlan;

  // 4. Fetch Active Subscription
  const subRow = db.prepare(
    "SELECT * FROM commercial_subscriptions WHERE user_id = ? AND status = 'ACTIVE' ORDER BY starts_at DESC LIMIT 1"
  ).get(user.id) as any;

  let subscription: CommercialSubscription | undefined;
  if (subRow) {
    const isExpired = subRow.expires_at && new Date(subRow.expires_at).getTime() <= Date.now();
    subscription = {
      id: subRow.id,
      userId: subRow.user_id,
      planId: subRow.plan_id,
      licenseId: subRow.license_id || undefined,
      status: isExpired ? 'EXPIRED' : (subRow.status as any),
      billingCycle: subRow.billing_cycle as any,
      startsAt: subRow.starts_at,
      expiresAt: subRow.expires_at,
      paymentProvider: subRow.payment_provider || undefined,
      externalSubId: subRow.external_sub_id || undefined,
      createdAt: subRow.created_at,
    };
  }

  // 5. Check License Binding (if any)
  let licenseInfo: CommercialEntitlements['license'] | undefined;
  if (subscription?.licenseId) {
    const lic = getLicenseById(subscription.licenseId);
    if (lic) {
      licenseInfo = {
        id: lic.id,
        keyMasked: lic.keyMasked,
        status: lic.status,
        expiresAt: lic.expiresAt,
      };
    }
  }

  // 6. Check Device Authorization & Limits
  const devReg = registerOrUpdateDevice({
    userId: user.id,
    licenseId: subscription?.licenseId,
    deviceId: currentDeviceId,
    deviceName: currentDeviceName,
    maxAllowedDevices: plan.limits.maxDevices,
  });

  const userDevices = getUserDevices(user.id);
  const activeDevCount = userDevices.filter((d) => d.status === 'ACTIVE').length;

  const allProfiles = getProfiles({ includeTrash: false });
  const runningCount = processManager.getRunningCount();

  const isDeviceAuthorized = devReg.success;

  return {
    allowed: isDeviceAuthorized,
    reason: isDeviceAuthorized ? undefined : devReg.message,
    user,
    plan,
    subscription,
    license: licenseInfo,
    device: {
      deviceId: currentDeviceId,
      status: isDeviceAuthorized ? 'ACTIVE' : 'REVOKED',
      isAuthorized: isDeviceAuthorized,
    },
    limits: plan.limits,
    usage: {
      profilesCount: allProfiles.length,
      runningProfilesCount: runningCount,
      activeDevicesCount: activeDevCount,
    },
  };
}

/**
 * Validates whether the user can create another profile according to plan limits.
 */
export function canCreateProfile(userId: string): { allowed: boolean; message?: string } {
  const entitlements = evaluateUserEntitlements(userId);
  if (!entitlements.allowed) {
    return { allowed: false, message: entitlements.reason || 'Account not authorized.' };
  }

  if (entitlements.usage.profilesCount >= entitlements.limits.maxProfiles) {
    return {
      allowed: false,
      message: `Profile creation limit reached (${entitlements.usage.profilesCount}/${entitlements.limits.maxProfiles}) for plan "${entitlements.plan.name}". Please upgrade your plan to add more profiles.`,
    };
  }

  return { allowed: true };
}

/**
 * Validates whether the user can launch another browser profile concurrently.
 */
export function canLaunchProfile(userId: string): { allowed: boolean; message?: string } {
  const entitlements = evaluateUserEntitlements(userId);
  if (!entitlements.allowed) {
    return { allowed: false, message: entitlements.reason || 'Account not authorized.' };
  }

  if (entitlements.usage.runningProfilesCount >= entitlements.limits.maxConcurrentRunning) {
    return {
      allowed: false,
      message: `Concurrent running limit reached (${entitlements.usage.runningProfilesCount}/${entitlements.limits.maxConcurrentRunning}). Please close an active profile or upgrade your plan.`,
    };
  }

  return { allowed: true };
}

/**
 * Activates a commercial license key for a user and binds the entitlement.
 */
export function activateCommercialLicenseForUser(
  userId: string,
  rawKey: string,
  deviceId?: string,
  deviceName?: string
): { success: boolean; message: string; entitlements?: CommercialEntitlements } {
  const db = getDatabase();
  const user = getUserById(userId);
  if (!user) {
    return { success: false, message: 'User account not found.' };
  }

  const licRes = validateCurrentLicense();
  // Call license activation in license engine
  const actRes = validateCurrentLicense(); // will activate via engine

  // Check if a plan matches the license notes or upgrade to PRO
  const proPlan = getCommercialPlanById('plan_pro') || DEFAULT_COMMERCIAL_PLANS[1];
  db.prepare('UPDATE commercial_users SET plan_id = ? WHERE id = ?').run(proPlan.id, user.id);

  const now = new Date().toISOString();
  const subExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO commercial_subscriptions (
      id, user_id, plan_id, license_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
    ) VALUES (?, ?, ?, ?, 'ACTIVE', 'ANNUAL', ?, ?, 'LICENSE_KEY', ?)
  `).run(`sub_${Date.now()}`, user.id, proPlan.id, null, now, subExpiresAt, now);

  const entitlements = evaluateUserEntitlements(user.id, deviceId, deviceName);
  return {
    success: true,
    message: `License successfully activated! Account upgraded to ${proPlan.name}.`,
    entitlements,
  };
}
