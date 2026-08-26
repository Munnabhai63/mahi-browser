import { getDatabase } from '../../06_DATABASE/connection.js';
import { FeatureFlagDefinition, PlanTierId } from '../../10_CONFIG/shared/types/platform.js';
import { logActivity } from './audit-service.js';

const TIER_WEIGHTS: Record<PlanTierId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
  custom: 5,
};

const DEFAULT_FLAGS: FeatureFlagDefinition[] = [
  {
    key: 'cloud_sync',
    name: 'Cloud Profile Synchronization',
    description: 'Enables encrypted cloud sync for profile metadata and state.',
    enabledGlobal: true,
    minPlanTier: 'starter',
    rolloutPercentage: 100,
    allowedUserIds: [],
    allowedOrgIds: [],
    killSwitchActive: false,
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'cdp_synchronizer',
    name: 'Multi-Window Action Synchronizer',
    description: 'Enables native CDP multi-window mirroring across browser windows.',
    enabledGlobal: true,
    minPlanTier: 'free',
    rolloutPercentage: 100,
    allowedUserIds: [],
    allowedOrgIds: [],
    killSwitchActive: false,
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'developer_api',
    name: 'Developer REST API & Webhooks',
    description: 'Access to programmatic profile launching, stopping, and automation API.',
    enabledGlobal: true,
    minPlanTier: 'pro',
    rolloutPercentage: 100,
    allowedUserIds: [],
    allowedOrgIds: [],
    killSwitchActive: false,
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'fleet_control',
    name: 'Fleet Command Center',
    description: 'Remote telemetry and multi-device management platform.',
    enabledGlobal: true,
    minPlanTier: 'business',
    rolloutPercentage: 100,
    allowedUserIds: [],
    allowedOrgIds: [],
    killSwitchActive: false,
    updatedAt: new Date().toISOString(),
  },
  {
    key: 'visual_automation',
    name: 'Visual No-Code Automation Studio',
    description: 'Playwright-backed visual RPA workflow runner.',
    enabledGlobal: true,
    minPlanTier: 'free',
    rolloutPercentage: 100,
    allowedUserIds: [],
    allowedOrgIds: [],
    killSwitchActive: false,
    updatedAt: new Date().toISOString(),
  },
];

export function getFeatureFlags(): FeatureFlagDefinition[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM feature_flags').all() as any[];

  if (rows.length === 0) {
    // Seed default flags
    for (const flag of DEFAULT_FLAGS) {
      db.prepare(`
        INSERT OR REPLACE INTO feature_flags (
          key, name, description, enabled_global, min_plan_tier,
          rollout_percentage, allowed_user_ids_json, allowed_org_ids_json,
          kill_switch_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        flag.key,
        flag.name,
        flag.description,
        flag.enabledGlobal ? 1 : 0,
        flag.minPlanTier,
        flag.rolloutPercentage,
        JSON.stringify(flag.allowedUserIds),
        JSON.stringify(flag.allowedOrgIds),
        flag.killSwitchActive ? 1 : 0,
        flag.updatedAt
      );
    }
    return DEFAULT_FLAGS;
  }

  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description || '',
    enabledGlobal: Boolean(r.enabled_global),
    minPlanTier: r.min_plan_tier as PlanTierId,
    rolloutPercentage: r.rollout_percentage || 100,
    allowedUserIds: JSON.parse(r.allowed_user_ids_json || '[]'),
    allowedOrgIds: JSON.parse(r.allowed_org_ids_json || '[]'),
    killSwitchActive: Boolean(r.kill_switch_active),
    updatedAt: r.updated_at,
  }));
}

export function isFeatureEnabled(
  flagKey: string,
  userTier: PlanTierId = 'free',
  userId?: string,
  orgId?: string
): boolean {
  const flags = getFeatureFlags();
  const flag = flags.find((f) => f.key === flagKey);
  if (!flag) return true; // default open if not configured

  // Emergency kill switch
  if (flag.killSwitchActive) return false;

  // Global disabled
  if (!flag.enabledGlobal) return false;

  // Explicit user/org override
  if (userId && flag.allowedUserIds.includes(userId)) return true;
  if (orgId && flag.allowedOrgIds.includes(orgId)) return true;

  // Plan tier check
  const userWeight = TIER_WEIGHTS[userTier] ?? 0;
  const reqWeight = TIER_WEIGHTS[flag.minPlanTier] ?? 0;
  return userWeight >= reqWeight;
}

export function updateFeatureFlag(
  key: string,
  updates: Partial<FeatureFlagDefinition>
): FeatureFlagDefinition | null {
  const db = getDatabase();
  const flags = getFeatureFlags();
  const existing = flags.find((f) => f.key === key);
  if (!existing) return null;

  const updated: FeatureFlagDefinition = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT OR REPLACE INTO feature_flags (
      key, name, description, enabled_global, min_plan_tier,
      rollout_percentage, allowed_user_ids_json, allowed_org_ids_json,
      kill_switch_active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    updated.key,
    updated.name,
    updated.description,
    updated.enabledGlobal ? 1 : 0,
    updated.minPlanTier,
    updated.rolloutPercentage,
    JSON.stringify(updated.allowedUserIds),
    JSON.stringify(updated.allowedOrgIds),
    updated.killSwitchActive ? 1 : 0,
    updated.updatedAt
  );

  logActivity('SETTINGS', 'WARNING', 'Update Feature Flag', `Updated feature flag "${key}"`);
  return updated;
}
