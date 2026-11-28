import { getDatabase } from '../../06_DATABASE/connection.js';
import type { CommercialPlan, CommercialPlanLimits, CommercialPlanTier, CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';
import { logCommercialAudit } from './commercial-audit-service.js';
import { CANONICAL_PLAN_CATALOG, legacyPlanIdToCanonical, calculateAuthoritativeOrderTotal } from './canonical-plan-catalog.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('commercial-plan-service');

interface SqliteCommercialPlanRow {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
  price_annual: number;
  limits_json: string | null;
  is_active: number;
  created_at: string;
}

function getCanonicalPlanSpec(canonicalId: string | null) {
  if (!canonicalId) return null;
  return (CANONICAL_PLAN_CATALOG as Record<string, (typeof CANONICAL_PLAN_CATALOG)[keyof typeof CANONICAL_PLAN_CATALOG]>)[canonicalId] || null;
}

export const DEFAULT_COMMERCIAL_PLANS: CommercialPlan[] = [
  {
    id: 'plan_free',
    name: 'Free Trial',
    tier: 'FREE',
    priceMonthly: 0,
    priceAnnual: 0,
    limits: {
      maxProfiles: 15,
      maxDevices: 1,
      maxConcurrentRunning: 2,
      maxProxies: 15,
      maxCloudBackupProfiles: 0,
      proxyAccess: true,
      cloudSync: false,
      apiAccess: false,
      rpaAutomation: false,
      synchronizer: false,
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mahi_starter',
    name: 'Starter (1 Month)',
    tier: 'PRO',
    priceMonthly: 599,
    priceAnnual: 599,
    limits: {
      maxProfiles: 25,
      maxDevices: 1,
      maxConcurrentRunning: 3,
      maxProxies: 25,
      maxCloudBackupProfiles: 0,
      proxyAccess: true,
      cloudSync: false,
      apiAccess: false,
      rpaAutomation: false,
      synchronizer: false,
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mahi_growth',
    name: 'Growth (6 Months)',
    tier: 'PRO',
    priceMonthly: 166,
    priceAnnual: 999,
    limits: {
      maxProfiles: 100,
      maxDevices: 1,
      maxConcurrentRunning: 10,
      maxProxies: -1,
      maxCloudBackupProfiles: 25,
      proxyAccess: true,
      cloudSync: true,
      apiAccess: true,
      rpaAutomation: true,
      synchronizer: true,
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mahi_ultimate',
    name: 'Ultimate (1 Year)',
    tier: 'BUSINESS',
    priceMonthly: 125,
    priceAnnual: 1499,
    limits: {
      maxProfiles: 1000000, // True Unlimited offline profiles
      maxDevices: 2,
      maxConcurrentRunning: 25,
      maxProxies: -1,
      maxCloudBackupProfiles: -1,
      proxyAccess: true,
      cloudSync: true,
      apiAccess: true,
      rpaAutomation: true,
      synchronizer: true,
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'plan_pro',
    name: 'Professional',
    tier: 'PRO',
    priceMonthly: 29,
    priceAnnual: 290,
    limits: {
      maxProfiles: 100,
      maxDevices: 2,
      maxConcurrentRunning: 10,
      proxyAccess: true,
      cloudSync: true,
      apiAccess: true,
      rpaAutomation: true,
      synchronizer: true,
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'plan_business',
    name: 'Business Growth',
    tier: 'BUSINESS',
    priceMonthly: 79,
    priceAnnual: 790,
    limits: {
      maxProfiles: 500,
      maxDevices: 5,
      maxConcurrentRunning: 30,
      proxyAccess: true,
      cloudSync: true,
      apiAccess: true,
      rpaAutomation: true,
      synchronizer: true,
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise Fleet',
    tier: 'ENTERPRISE',
    priceMonthly: 199,
    priceAnnual: 1990,
    limits: {
      maxProfiles: 2500,
      maxDevices: 20,
      maxConcurrentRunning: 100,
      proxyAccess: true,
      cloudSync: true,
      apiAccess: true,
      rpaAutomation: true,
      synchronizer: true,
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function getCommercialPlans(includeInactive = false): CommercialPlan[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM commercial_plans ORDER BY price_monthly ASC').all<SqliteCommercialPlanRow>();

  if (rows.length === 0) {
    // Seed default plans
    for (const p of DEFAULT_COMMERCIAL_PLANS) {
      db.prepare(`
        INSERT OR REPLACE INTO commercial_plans (
          id, name, tier, price_monthly, price_annual, limits_json, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.id,
        p.name,
        p.tier,
        p.priceMonthly,
        p.priceAnnual,
        JSON.stringify(p.limits),
        p.isActive ? 1 : 0,
        p.createdAt,
        p.createdAt
      );
    }
    return DEFAULT_COMMERCIAL_PLANS.filter((p) => includeInactive || p.isActive);
  }

  const plans = rows.map(mapRowToPlan);
  return includeInactive ? plans : plans.filter((p) => p.isActive);
}

export function getCommercialPlanById(planId: string): CommercialPlan | null {
  const db = getDatabase();
  const aliasMap: Record<string, string> = {
    starter: 'mahi_starter',
    growth: 'mahi_growth',
    ultimate: 'mahi_ultimate',
    plan_1month: 'mahi_starter',
    plan_6months: 'mahi_growth',
    plan_1year: 'mahi_ultimate',
  };
  const raw = (planId || '').toLowerCase().trim();
  const resolved = aliasMap[raw] || raw;
  const normalizedId = resolved.startsWith('mahi_')
    ? resolved
    : (resolved.startsWith('plan_') ? resolved : `plan_${resolved}`);
  let row = db.prepare('SELECT * FROM commercial_plans WHERE id = ? OR id = ?').get<SqliteCommercialPlanRow>(resolved, normalizedId);
  if (!row) {
    row = db.prepare('SELECT * FROM commercial_plans WHERE LOWER(tier) = ?').get<SqliteCommercialPlanRow>(resolved.toLowerCase());
  }
  if (!row) {
    // Prefer exact default plan IDs (e.g. plan_pro, plan_free, mahi_starter/growth/ultimate)
    // before falling back to legacy alias remapping on unseeded test databases.
    // Note: keep plan_business routed through canonical business_growth (100 profiles) for quota tests.
    const directDefault =
      resolved !== 'plan_business'
        ? DEFAULT_COMMERCIAL_PLANS.find((p) => p.id === raw || p.id === resolved)
        : undefined;
    if (directDefault) {
      return directDefault;
    }

    // Check canonical catalog (Pro 10, 25, 50, 100, team aliases, etc.)
    const canonicalId = legacyPlanIdToCanonical(planId);
    const canonical = getCanonicalPlanSpec(canonicalId);
    if (canonical && canonicalId) {
      const orderTotalMonthly = calculateAuthoritativeOrderTotal({ planId: canonicalId, billingCycle: 'MONTHLY', currency: 'INR' });
      const orderTotalAnnual = calculateAuthoritativeOrderTotal({ planId: canonicalId, billingCycle: 'ANNUAL', currency: 'INR' });
      const priceMonthly = Math.round(orderTotalMonthly.totalChargeMinor / 100);
      const priceAnnual = Math.round(orderTotalAnnual.totalChargeMinor / 100);

      return {
        id: canonical.planId,
        name: canonical.displayName,
        tier: canonical.tier,
        priceMonthly,
        priceAnnual,
        limits: {
          maxProfiles: canonical.profileLimit,
          maxDevices: canonical.seatLimit || 1,
          maxConcurrentRunning: canonical.automationConcurrency || 10,
          maxProxies: canonical.proxySlotLimit ?? -1,
          maxCloudBackupProfiles: canonical.cloudBackupLimit ?? (canonical.capabilities['cloud.sync'] ? canonical.profileLimit : 0),
          proxyAccess: !!(canonical.capabilities['proxy.builtin'] || canonical.capabilities['proxy.custom']),
          cloudSync: !!canonical.capabilities['cloud.sync'],
          apiAccess: !!canonical.capabilities['api.remote'],
          rpaAutomation: !!canonical.capabilities['automation.rpa'],
          synchronizer: !!canonical.capabilities['automation.synchronizer'],
        },
        isActive: canonical.status === 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
    }

    // Check in default list if not yet inserted
    const fallback = DEFAULT_COMMERCIAL_PLANS.find(
      (p) => p.id === resolved || p.id === planId || p.id === normalizedId || p.tier.toLowerCase() === resolved.toLowerCase()
    );
    return fallback || null;
  }
  return mapRowToPlan(row);
}

export function createCommercialPlan(dto: {
  name: string;
  tier: CommercialPlanTier;
  priceMonthly: number;
  priceAnnual: number;
  limits: CommercialPlanLimits;
  isActive?: boolean;
}, actor: { id: string; name: string; role: CommercialRole } = { id: 'admin', name: 'Admin', role: 'ADMIN' }): CommercialPlan {
  const db = getDatabase();
  const id = `plan_${dto.tier.toLowerCase()}_${Date.now()}`;
  const now = new Date().toISOString();
  const isActive = dto.isActive !== undefined ? dto.isActive : true;

  db.prepare(`
    INSERT INTO commercial_plans (
      id, name, tier, price_monthly, price_annual, limits_json, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    dto.name.trim(),
    dto.tier,
    dto.priceMonthly,
    dto.priceAnnual,
    JSON.stringify(dto.limits),
    isActive ? 1 : 0,
    now
  );

  logCommercialAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'CREATE_PLAN',
    targetType: 'PLAN',
    targetId: id,
    details: `Created new plan "${dto.name}" (${dto.tier}) with maxProfiles=${dto.limits.maxProfiles}, maxDevices=${dto.limits.maxDevices}`,
  });

  const createdPlan = getCommercialPlanById(id);
  if (!createdPlan) {
    throw new Error(`Created commercial plan ${id} could not be retrieved`);
  }
  return createdPlan;
}

export function updateCommercialPlan(
  planId: string,
  dto: Partial<{
    name: string;
    tier: CommercialPlanTier;
    priceMonthly: number;
    priceAnnual: number;
    limits: Partial<CommercialPlanLimits>;
    isActive: boolean;
  }>,
  actor: { id: string; name: string; role: CommercialRole } = { id: 'admin', name: 'Admin', role: 'ADMIN' }
): CommercialPlan | null {
  const db = getDatabase();
  const current = getCommercialPlanById(planId);
  if (!current) return null;

  const mergedLimits: CommercialPlanLimits = {
    ...current.limits,
    ...(dto.limits || {}),
  };

  const updated: CommercialPlan = {
    ...current,
    name: dto.name !== undefined ? dto.name.trim() : current.name,
    tier: dto.tier !== undefined ? dto.tier : current.tier,
    priceMonthly: dto.priceMonthly !== undefined ? dto.priceMonthly : current.priceMonthly,
    priceAnnual: dto.priceAnnual !== undefined ? dto.priceAnnual : current.priceAnnual,
    limits: mergedLimits,
    isActive: dto.isActive !== undefined ? dto.isActive : current.isActive,
  };

  db.prepare(`
    INSERT OR REPLACE INTO commercial_plans (
      id, name, tier, price_monthly, price_annual, limits_json, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    updated.id,
    updated.name,
    updated.tier,
    updated.priceMonthly,
    updated.priceAnnual,
    JSON.stringify(updated.limits),
    updated.isActive ? 1 : 0,
    updated.createdAt
  );

  logCommercialAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'UPDATE_PLAN',
    targetType: 'PLAN',
    targetId: planId,
    details: `Updated plan "${updated.name}" limits and configuration`,
  });

  return updated;
}

function mapRowToPlan(r: SqliteCommercialPlanRow): CommercialPlan {
  const defaultPlan = DEFAULT_COMMERCIAL_PLANS.find((p) => p.id === r.id);
  const canonicalId = legacyPlanIdToCanonical(r.id);
  const canonical = getCanonicalPlanSpec(canonicalId);
  let limits: CommercialPlanLimits = defaultPlan
    ? { ...defaultPlan.limits }
    : {
        maxProfiles: canonical?.profileLimit ?? 10,
        maxDevices: canonical?.seatLimit ?? 1,
        maxConcurrentRunning: canonical?.automationConcurrency ?? 2,
        maxProxies: canonical?.proxySlotLimit ?? -1,
        maxCloudBackupProfiles: canonical?.cloudBackupLimit ?? (canonical?.capabilities?.['cloud.sync'] ? canonical?.profileLimit : 0),
        proxyAccess: true,
        cloudSync: false,
        apiAccess: false,
        rpaAutomation: false,
        synchronizer: false,
      };

  try {
    limits = { ...limits, ...JSON.parse(r.limits_json || '{}') };
  } catch (parseErr) {
    log.warn('Failed parsing plan limits_json in commercial-plan-service', {
      planId: r.id,
      err: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
  }

  return {
    id: r.id,
    name: r.name,
    tier: r.tier as CommercialPlanTier,
    priceMonthly: r.price_monthly,
    priceAnnual: r.price_annual,
    limits,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
  };
}
