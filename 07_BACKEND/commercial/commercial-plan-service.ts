import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { CommercialPlan, CommercialPlanLimits, CommercialPlanTier, CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';
import { logCommercialAudit } from './commercial-audit-service.js';
import { CANONICAL_PLAN_CATALOG } from './canonical-plan-catalog.js';

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
  const rows = db.prepare('SELECT * FROM commercial_plans ORDER BY price_monthly ASC').all() as any[];

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
  const normalizedId = planId.startsWith('plan_') ? planId : `plan_${planId.toLowerCase()}`;
  let row = db.prepare('SELECT * FROM commercial_plans WHERE id = ? OR id = ?').get(planId, normalizedId) as any;
  if (!row) {
    row = db.prepare('SELECT * FROM commercial_plans WHERE LOWER(tier) = ?').get(planId.toLowerCase()) as any;
  }
  if (!row) {
    // Check canonical catalog (Pro 10, 25, 50, 100, etc.)
    const canonical = (CANONICAL_PLAN_CATALOG as any)[planId];
    if (canonical) {
      return {
        id: canonical.planId,
        name: canonical.displayName,
        tier: canonical.tier,
        priceMonthly: 0,
        priceAnnual: 0,
        limits: {
          maxProfiles: canonical.profileLimit,
          maxDevices: canonical.seatLimit || 2,
          maxConcurrentRunning: canonical.automationConcurrency || 10,
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
      (p) => p.id === planId || p.id === normalizedId || p.tier.toLowerCase() === planId.toLowerCase()
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

  return getCommercialPlanById(id)!;
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

function mapRowToPlan(r: any): CommercialPlan {
  let limits: CommercialPlanLimits = {
    maxProfiles: 10,
    maxDevices: 1,
    maxConcurrentRunning: 2,
    proxyAccess: true,
    cloudSync: false,
    apiAccess: false,
    rpaAutomation: false,
    synchronizer: false,
  };

  try {
    limits = { ...limits, ...JSON.parse(r.limits_json || '{}') };
  } catch {}

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
