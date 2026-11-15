import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  CommercialEntitlements,
  CommercialPlan,
  CommercialSubscription,
  CommercialDevice,
  CommercialUser,
  FeatureCapability,
  CommercialPlanTier,
  CanonicalPlanId,
} from '../../10_CONFIG/shared/types/commercial.js';
import { getUserById } from './commercial-auth-service.js';
import { getCommercialPlanById, DEFAULT_COMMERCIAL_PLANS } from './commercial-plan-service.js';
import {
  resolveCapabilitiesForCanonicalPlan,
  CANONICAL_PLAN_CATALOG,
  findLowestPlanForCapability,
} from './canonical-plan-catalog.js';
import { registerOrUpdateDevice, getUserDevices } from './commercial-device-service.js';
import { getDeviceId, getDeviceName } from '../../03_HARDWARE/device-id.js';
import { getProfiles } from '../../02_BROWSER/services/profile-service.js';
import { getRealUserProfileCount } from '../../02_BROWSER/services/starter-profiles-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { validateCurrentLicense, getLicenseById } from '../../04_LICENSING/license-engine.js';
import { hasValidLicense } from '../../08_SECURITY/freemium-guard.js';
import { hasValidAccountSubscription, readCachedStatus, getAccountSession, isBusinessPlan } from '../../08_SECURITY/account-service.js';

export const CAPABILITY_REQUIREMENTS: Record<
  FeatureCapability,
  { requiredTier: CommercialPlanTier; planName: string; featureName: string }
> = {
  'profile.basic': { requiredTier: 'FREE', planName: 'Free', featureName: 'Basic Profiles' },
  'profile.multiple': { requiredTier: 'PRO', planName: 'Professional 10', featureName: 'Bulk Profile Creation' },
  'cloud.sync': { requiredTier: 'PRO', planName: 'Professional 10', featureName: 'Cloud Profile Sync' },
  'cloud.browser': { requiredTier: 'PRO', planName: 'Professional 50', featureName: 'Cloud Browser Isolated Execution' },
  'proxy.builtin': { requiredTier: 'PRO', planName: 'Professional 25', featureName: 'Built-in Commercial Proxies' },
  'proxy.custom': { requiredTier: 'FREE', planName: 'Free', featureName: 'Custom BYOP Proxies' },
  'automation.rpa': { requiredTier: 'PRO', planName: 'Professional 50', featureName: 'Visual RPA Automation Studio' },
  'automation.scheduler': { requiredTier: 'PRO', planName: 'Professional 50', featureName: 'Automation Task Scheduler' },
  'automation.multiProfile': { requiredTier: 'PRO', planName: 'Professional 50', featureName: 'Multi-Profile Batch Automation' },
  'automation.cookieWarmer': { requiredTier: 'PRO', planName: 'Professional 50', featureName: 'Smart Cookie Warmer' },
  'automation.synchronizer': { requiredTier: 'PRO', planName: 'Professional 100', featureName: 'CDP Action Synchronizer' },
  'workspace.team': { requiredTier: 'BUSINESS', planName: 'Team 50', featureName: 'Team Workspaces & RBAC' },
  'workspace.sharing': { requiredTier: 'PRO', planName: 'Professional 25', featureName: 'Profile Sharing' },
  'api.remote': { requiredTier: 'PRO', planName: 'Professional 100', featureName: 'Remote Cloud API' },
  'api.webhooks': { requiredTier: 'PRO', planName: 'Professional 100', featureName: 'Webhook Notifications' },
  'mobile.cloudBrowser': { requiredTier: 'PRO', planName: 'Professional 10', featureName: 'Mobile Cloud Browser Stream' },
  'advanced.fingerprint': { requiredTier: 'PRO', planName: 'Professional 10', featureName: 'Advanced Hardware Noise Spoofing' },
  'stealth.nativeHooks117': { requiredTier: 'FREE', planName: 'Free', featureName: '117 C++ Native Stealth Hooks (ClientRects & WebGPU)' },
  'stealth.aiHumanizer': { requiredTier: 'FREE', planName: 'Free', featureName: 'AI Humanizer Typing & Mouse Curves' },
  'stealth.multiCore': { requiredTier: 'PRO', planName: 'Professional 50', featureName: 'Multi-Core Chromium Version Selector' },
  'stealth.fakeVideoKYC': { requiredTier: 'PRO', planName: 'Professional 50', featureName: 'Virtual Video Camera Stream (KYC Bypass)' },
  'api.localDaemon': { requiredTier: 'PRO', planName: 'Professional 100', featureName: 'Local Automation Daemon & Bot API' },
};

export function resolveCapabilitiesForPlan(
  plan?: CommercialPlan | null,
  subscription?: CommercialSubscription
): Record<FeatureCapability, boolean> {
  const resolvedPlan = plan || DEFAULT_COMMERCIAL_PLANS[0];
  const isSubActive = !subscription || subscription.status === 'ACTIVE' || subscription.status === 'TRIAL';
  const effectiveTier: CommercialPlanTier = isSubActive ? resolvedPlan.tier : 'FREE';

  // Try canonical plan catalog first (supports per-plan differentiation: Pro 10/25/50/100)
  const planId = resolvedPlan.id;
  if (isSubActive) {
    const canonicalCaps = resolveCapabilitiesForCanonicalPlan(planId);
    // If we got a non-free result from canonical, use it
    const hasAnyCap = Object.values(canonicalCaps).some(v => v && v !== canonicalCaps['proxy.custom']);
    if (hasAnyCap || effectiveTier !== 'FREE') {
      return canonicalCaps;
    }
  }

  // Fallback: legacy tier-based resolution
  if (effectiveTier === 'BUSINESS' || effectiveTier === 'ENTERPRISE' || effectiveTier === 'CUSTOM') {
    return resolveCapabilitiesForCanonicalPlan('business_growth');
  }

  if (effectiveTier === 'PRO') {
    // Legacy plan_pro maps to professional_100 (highest personal tier)
    return resolveCapabilitiesForCanonicalPlan('professional_100');
  }

  // FREE Tier
  return resolveCapabilitiesForCanonicalPlan('free');
}

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

  // If user not in legacy local database, resolve through central account session or license
  if (!user) {
    const isSubActive = hasValidAccountSubscription();
    const isLicenseActive = hasValidLicense();
    const session = getAccountSession();
    const cached = readCachedStatus();

    let effectivePlan = defaultFreePlan;
    let capabilities = resolveCapabilitiesForPlan(defaultFreePlan);

    if (isSubActive && cached?.plan) {
      const planNorm = cached.plan.toLowerCase().trim();
      const isBiz = isBusinessPlan(planNorm);
      effectivePlan = isBiz
        ? (getCommercialPlanById('plan_business') || DEFAULT_COMMERCIAL_PLANS[2])
        : (getCommercialPlanById('plan_pro') || DEFAULT_COMMERCIAL_PLANS[1]);
      capabilities = resolveCapabilitiesForCanonicalPlan(planNorm);
    } else if (isLicenseActive) {
      effectivePlan = getCommercialPlanById('plan_pro') || DEFAULT_COMMERCIAL_PLANS[1];
      capabilities = resolveCapabilitiesForPlan(effectivePlan);
    }

    const maxProfiles = (cached?.profile_limit && cached.profile_limit > 0)
      ? cached.profile_limit
      : effectivePlan.limits.maxProfiles;

    const allProfiles = getProfiles({ includeTrash: false });
    const runningCount = processManager.getRunningCount();

    return {
      allowed: true,
      user: {
        id: userId || session?.account_id || 'LOCAL_CLIENT',
        email: session?.email || 'local@mahibrowser.local',
        name: session?.email ? session.email.split('@')[0] : 'Local User',
        role: 'USER',
        status: 'ACTIVE',
        planId: effectivePlan.id,
      },
      plan: effectivePlan,
      device: {
        deviceId: currentDeviceId,
        status: 'ACTIVE',
        isAuthorized: true,
      },
      limits: {
        ...effectivePlan.limits,
        maxProfiles,
      },
      capabilities,
      usage: {
        profilesCount: getRealUserProfileCount(userId),
        runningProfilesCount: runningCount,
        activeDevicesCount: 1,
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
      capabilities: resolveCapabilitiesForPlan(defaultFreePlan),
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
      capabilities: resolveCapabilitiesForPlan(defaultFreePlan),
      usage: { profilesCount: 0, runningProfilesCount: 0, activeDevicesCount: 0 },
    };
  }

  // 3. Fetch Plan
  const plan = getCommercialPlanById(user.planId) || defaultFreePlan;

  // 4. Fetch Active or Trial Subscription
  const subRow = db.prepare(
    "SELECT * FROM commercial_subscriptions WHERE user_id = ? AND status IN ('ACTIVE', 'TRIAL') ORDER BY starts_at DESC LIMIT 1"
  ).get(user.id) as any;

  let subscription: CommercialSubscription | undefined;
  if (subRow) {
    const isTrialSub = subRow.billing_cycle === 'TRIAL' || subRow.status === 'TRIAL';
    const isExpired = Boolean(
      (subRow.expires_at && new Date(subRow.expires_at).getTime() <= Date.now()) ||
      (isTrialSub && user.trialExpiresAt && new Date(user.trialExpiresAt).getTime() <= Date.now())
    );

    if (isExpired) {
      try {
        db.prepare("UPDATE commercial_subscriptions SET status = 'EXPIRED' WHERE id = ?").run(subRow.id);
        db.prepare("UPDATE commercial_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
        db.prepare("UPDATE auth_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
      } catch {}
      user.planId = 'plan_free';
    }

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
  } else if (user.trialExpiresAt && new Date(user.trialExpiresAt).getTime() <= Date.now() && user.planId !== 'plan_free') {
    try {
      db.prepare("UPDATE commercial_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
      db.prepare("UPDATE auth_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
      user.planId = 'plan_free';
    } catch {}
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
  const isTrialActive = Boolean(user.trialExpiresAt && new Date(user.trialExpiresAt).getTime() > Date.now());
  const isTrialUser = Boolean(isTrialActive && (user.signupIntent === 'trial' || subscription?.billingCycle === 'TRIAL' || subscription?.status === 'TRIAL'));
  const isSubActive = Boolean(subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL') && !(subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= Date.now()));
  const effectivePlanObj = (!isTrialUser && !isSubActive) ? defaultFreePlan : (isSubActive ? plan : (isTrialUser ? (getCommercialPlanById('professional_50') || plan) : defaultFreePlan));
  const capabilities = resolveCapabilitiesForPlan(effectivePlanObj, subscription);

  // Phase 23: MostLogin-style Enterprise Feature Overrides per User
  if (user.featureOverrides) {
    if (user.featureOverrides['qunkong']) {
      capabilities['automation.synchronizer'] = true;
    }
    if (user.featureOverrides['multiCore']) {
      capabilities['stealth.multiCore'] = true;
    }
    if (user.featureOverrides['apiDaemon']) {
      capabilities['api.localDaemon'] = true;
    }
    if (user.featureOverrides['rpa']) {
      capabilities['automation.rpa'] = true;
    }
  }

  const trialPlanId = (isTrialUser && isTrialActive) ? 'trial_50' : (effectivePlanObj.id.replace('plan_', '') || 'free');
  // Phase 23: Factor in GoLogin-style Quota Boosters (+10, +50 profiles)
  const bonusProfiles = user.bonusProfiles || 0;
  const baseMaxProfiles = (isTrialUser && isTrialActive) ? 50 : effectivePlanObj.limits.maxProfiles;
  const effectiveMaxProfiles = baseMaxProfiles + bonusProfiles;

  return {
    allowed: isDeviceAuthorized,
    reason: isDeviceAuthorized ? undefined : devReg.message,
    planId: trialPlanId,
    maxProfiles: effectiveMaxProfiles,
    isTrialActive,
    user,
    plan: effectivePlanObj,
    subscription,
    license: licenseInfo,
    device: {
      deviceId: currentDeviceId,
      status: isDeviceAuthorized ? 'ACTIVE' : 'REVOKED',
      isAuthorized: isDeviceAuthorized,
    },
    limits: {
      ...effectivePlanObj.limits,
      maxProfiles: effectiveMaxProfiles,
    },
    capabilities,
    features: {
      ...capabilities,
      uniqueFingerprints: true,
      cloudSync: true,
    } as any,
    usage: {
      profilesCount: getRealUserProfileCount(user.id),
      runningProfilesCount: runningCount,
      activeDevicesCount: activeDevCount,
    },
  };
}

/**
 * Validates whether a user account has entitlement for a specific capability.
 */
export function checkCapability(
  userId: string,
  capability: FeatureCapability
): {
  allowed: boolean;
  entitled: boolean;
  reason?: string;
  requiredTier: CommercialPlanTier;
  requiredPlan: CommercialPlanTier;
  planName: string;
  featureName: string;
} {
  const req = CAPABILITY_REQUIREMENTS[capability] || {
    requiredTier: 'PRO',
    planName: 'Professional',
    featureName: capability,
  };

  const user = getUserById(userId);
  if (user && (user.status === 'SUSPENDED' || user.status === 'BANNED')) {
    return {
      allowed: false,
      entitled: false,
      reason: 'Account access is suspended or unauthorized.',
      requiredPlan: req.requiredTier,
      ...req,
    };
  }

  const defaultFreePlan = DEFAULT_COMMERCIAL_PLANS[0];
  let isSubActive = false;
  let isTrialActive = Boolean(user?.trialExpiresAt && new Date(user.trialExpiresAt).getTime() > Date.now());

  if (user) {
    const db = getDatabase();
    const subRow = db
      .prepare("SELECT * FROM commercial_subscriptions WHERE user_id = ? AND status IN ('ACTIVE', 'TRIAL') ORDER BY starts_at DESC LIMIT 1")
      .get(user.id) as any;
    if (subRow) {
      const isTrialSub = subRow.billing_cycle === 'TRIAL' || subRow.status === 'TRIAL';
      const isExpired = Boolean(
        (subRow.expires_at && new Date(subRow.expires_at).getTime() <= Date.now()) ||
        (isTrialSub && user.trialExpiresAt && new Date(user.trialExpiresAt).getTime() <= Date.now())
      );
      if (!isExpired) {
        isSubActive = true;
      } else {
        try {
          db.prepare("UPDATE commercial_subscriptions SET status = 'EXPIRED' WHERE id = ?").run(subRow.id);
          db.prepare("UPDATE commercial_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
          db.prepare("UPDATE auth_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
        } catch {}
        user.planId = 'plan_free';
        isTrialActive = false;
      }
    } else if (user.trialExpiresAt && new Date(user.trialExpiresAt).getTime() <= Date.now() && user.planId !== 'plan_free') {
      try {
        db.prepare("UPDATE commercial_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
        db.prepare("UPDATE auth_users SET plan_id = 'plan_free' WHERE id = ?").run(user.id);
      } catch {}
      user.planId = 'plan_free';
      isTrialActive = false;
    }
  } else if (userId === 'LOCAL_CLIENT' || userId === 'SYSTEM_OWNER' || !userId) {
    isSubActive = hasValidLicense() || hasValidAccountSubscription();
  }

  const effectivePlan = (isSubActive || isTrialActive)
    ? (user ? (getCommercialPlanById(user.planId) || defaultFreePlan) : defaultFreePlan)
    : defaultFreePlan;

  const caps = resolveCapabilitiesForPlan(
    effectivePlan,
    (isSubActive || isTrialActive) ? ({ status: 'ACTIVE' } as any) : ({ status: 'EXPIRED' } as any)
  );
  const isAllowed = Boolean(caps[capability]);

  if (!isAllowed) {
    return {
      allowed: false,
      entitled: false,
      reason: `The feature "${req.featureName}" requires the ${req.planName} plan (${req.requiredTier}) or higher. Please upgrade your plan to unlock this feature.`,
      requiredPlan: req.requiredTier,
      ...req,
    };
  }

  return {
    allowed: true,
    entitled: true,
    requiredPlan: req.requiredTier,
    ...req,
  };
}

/**
 * Asserts entitlement for a capability, throwing a structured error if not included.
 */
export function assertEntitled(userId: string, capability: FeatureCapability): void {
  const res = checkCapability(userId, capability);
  if (!res.entitled) {
    const err = new Error(res.reason || `Feature "${capability}" is not included in current plan.`);
    (err as any).code = 'FEATURE_NOT_INCLUDED';
    (err as any).status = 403;
    (err as any).capability = capability;
    (err as any).requiredPlan = res.requiredTier;
    (err as any).requiredTier = res.requiredTier;
    (err as any).planName = res.planName;
    (err as any).featureName = res.featureName;
    throw err;
  }
}

/**
 * Validates whether the user can create another profile according to plan limits.
 */
export function canCreateProfile(userId: string): { allowed: boolean; message?: string } {
  const user = getUserById(userId);
  if (user && (user.status === 'SUSPENDED' || user.status === 'BANNED')) {
    return { allowed: false, message: `Account is ${user.status.toLowerCase()}.` };
  }

  const defaultFreePlan = DEFAULT_COMMERCIAL_PLANS[0];
  const plan = user ? (getCommercialPlanById(user.planId) || defaultFreePlan) : defaultFreePlan;

  const currentCount = getRealUserProfileCount(userId);
  if (currentCount >= plan.limits.maxProfiles) {
    return {
      allowed: false,
      message: `Profile creation limit reached (${currentCount}/${plan.limits.maxProfiles}) for plan "${plan.name}". Please upgrade your plan to add more profiles.`,
    };
  }

  return { allowed: true };
}

/**
 * Validates whether the user can launch another browser profile concurrently.
 */
export function canLaunchProfile(userId: string): { allowed: boolean; message?: string } {
  const user = getUserById(userId);
  if (user && (user.status === 'SUSPENDED' || user.status === 'BANNED')) {
    return { allowed: false, message: `Account is ${user.status.toLowerCase()}.` };
  }

  const defaultFreePlan = DEFAULT_COMMERCIAL_PLANS[0];
  const plan = user ? (getCommercialPlanById(user.planId) || defaultFreePlan) : defaultFreePlan;

  const runningCount = processManager.getRunningCount();
  if (runningCount >= plan.limits.maxConcurrentRunning) {
    return {
      allowed: false,
      message: `Concurrent running limit reached (${runningCount}/${plan.limits.maxConcurrentRunning}). Please close an active profile or upgrade your plan.`,
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

  validateCurrentLicense();

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

/**
 * Activates a 7-day trial entitlement for an eligible account.
 * Enforces server-side trial status (one trial per eligible user).
 */
export function activateUserTrial(
  userId: string,
  targetPlanId = 'professional_50'
): { success: boolean; isTrialActive?: boolean; error?: string; message?: string; trialExpiresAt?: string; planId?: string } {
  const db = getDatabase();
  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND', message: 'User account not found.' };
  }

  const runActivation = () => {
    // Check user and trial status directly inside transaction
    const userRow = db.prepare('SELECT trial_used, trial_expires_at FROM commercial_users WHERE id = ?').get(userId) as any;
    const existingSub = db.prepare("SELECT id FROM commercial_subscriptions WHERE user_id = ? AND billing_cycle = 'TRIAL' LIMIT 1").get(userId) as any;

    if (userRow?.trial_used || existingSub) {
      return {
        success: false,
        error: 'TRIAL_ALREADY_USED',
        message: 'A 7-day trial has already been used for this account.',
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString();
    const expStr = expiresAt.toISOString();

    // Atomically update commercial_users
    db.prepare(`
      UPDATE commercial_users
      SET plan_id = ?, trial_started_at = ?, trial_expires_at = ?, trial_used = 1, updated_at = ?
      WHERE id = ?
    `).run(targetPlanId, nowStr, expStr, nowStr, userId);

    // Update auth_users if present
    try {
      db.prepare(`
        UPDATE auth_users
        SET plan_id = ?, trial_started_at = ?, trial_expires_at = ?, trial_used = 1, updated_at = ?
        WHERE id = ?
      `).run(targetPlanId, nowStr, expStr, nowStr, userId);
    } catch {}

    // Create active trial subscription record
    const subId = `sub_trial_${Date.now()}`;
    db.prepare(`
      INSERT INTO commercial_subscriptions (
        id, user_id, plan_id, license_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
      ) VALUES (?, ?, ?, NULL, 'ACTIVE', 'TRIAL', ?, ?, 'DIRECT_TRIAL', ?)
    `).run(subId, userId, targetPlanId, nowStr, expStr, nowStr);

    return {
      success: true,
      isTrialActive: true,
      message: `7-day trial activated for ${targetPlanId}!`,
      trialExpiresAt: expStr,
      planId: targetPlanId,
    };
  };

  if (typeof (db as any).transaction === 'function') {
    return (db as any).transaction(runActivation)();
  }
  return runActivation();
}

/**
 * Checks server-side trial eligibility and status for a user.
 */
export function getUserTrialStatus(userId: string): {
  isEligibleForTrial: boolean;
  isTrialActive: boolean;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  daysRemaining?: number;
  planId?: string;
} {
  const user = getUserById(userId);
  if (!user) {
    return { isEligibleForTrial: false, isTrialActive: false };
  }

  const trialUsed = Boolean(user.trialUsed);
  const trialExpiresAt = user.trialExpiresAt;
  const isTrialActive = Boolean(
    trialExpiresAt && new Date(trialExpiresAt).getTime() > Date.now()
  );

  let daysRemaining = 0;
  if (isTrialActive && trialExpiresAt) {
    const diffMs = new Date(trialExpiresAt).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }

  return {
    isEligibleForTrial: !trialUsed,
    isTrialActive,
    trialStartedAt: user.trialStartedAt,
    trialExpiresAt: user.trialExpiresAt,
    daysRemaining,
    planId: user.planId,
  };
}
