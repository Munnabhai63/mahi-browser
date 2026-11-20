/**
 * MAHI Browser — Commercial Subscription Reconcile Service
 * P0 Remediation: Authority is commercial_subscriptions.
 *
 * Reconciles user plan and profile quota on login:
 * - Only upgrades or matches plan.
 * - NEVER downgrades an active subscription to a lower plan.
 * - If subscription is expired, resets to plan_free with warning log.
 * - In-memory Set loop guard prevents concurrent reconciliation runs on the same user.
 */

import { getDatabase } from '../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import { CANONICAL_PLAN_CATALOG, legacyPlanIdToCanonical } from './canonical-plan-catalog.js';
import { getCommercialPlanById } from './commercial-plan-service.js';

const inFlightReconciliations = new Set<string>();

export function getPlanRank(planId: string | null | undefined): number {
  if (!planId) return 0;
  const canonicalId = legacyPlanIdToCanonical(planId);
  if (canonicalId && CANONICAL_PLAN_CATALOG[canonicalId]) {
    return CANONICAL_PLAN_CATALOG[canonicalId].tierRank;
  }
  if (planId === 'plan_free' || planId === 'free') return 0;
  if (planId.includes('starter') || planId === 'plan_starter') return 25;
  if (planId.includes('pro') || planId === 'plan_pro') return 100;
  if (planId.includes('growth') || planId.includes('business')) return 200;
  if (planId.includes('ultimate') || planId.includes('enterprise')) return 1000;
  return 10;
}

export function getProfileQuotaForPlan(planId: string): number {
  const plan = getCommercialPlanById(planId);
  if (plan?.limits?.maxProfiles && typeof plan.limits.maxProfiles === 'number') {
    return plan.limits.maxProfiles;
  }
  const canonicalId = legacyPlanIdToCanonical(planId);
  if (canonicalId && CANONICAL_PLAN_CATALOG[canonicalId]) {
    return CANONICAL_PLAN_CATALOG[canonicalId].profileLimit;
  }
  if (planId.includes('enterprise')) return 500;
  if (planId.includes('business')) return 100;
  if (planId.includes('pro')) return 50;
  if (planId.includes('starter')) return 25;
  return 10;
}

export async function reconcileUserPlanOnLogin(
  userId: string
): Promise<{ reconciled: boolean; planId?: string }> {
  if (!userId) {
    return { reconciled: false };
  }

  if (inFlightReconciliations.has(userId)) {
    return { reconciled: false };
  }

  inFlightReconciliations.add(userId);
  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Query user's subscriptions ordered by created_at DESC
    let subs: any[] = [];
    try {
      subs = db.prepare(`
        SELECT * FROM commercial_subscriptions
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as any[];
    } catch (err: any) {
      console.error('[Reconcile] Error fetching subscriptions for user', userId, err?.message);
      return { reconciled: false };
    }

    // Determine current plan from PostgreSQL (if configured) or SQLite
    let currentPlan = 'plan_free';
    if (isPostgresConfigured()) {
      try {
        const repo = getCentralRepository();
        const pgUser = await repo.findAuthUserById(userId);
        if (pgUser?.plan_id) {
          currentPlan = pgUser.plan_id;
        }
      } catch (err: any) {
        console.error('[Reconcile] Error reading PG user plan for', userId, err?.message);
      }
    } else {
      try {
        const row = db.prepare('SELECT plan_id FROM auth_users WHERE id = ?').get(userId) as any;
        if (row?.plan_id) {
          currentPlan = row.plan_id;
        }
      } catch {}
    }

    // Identify active subscription
    const activeSub = subs.find((s) => {
      if (s.status !== 'ACTIVE') return false;
      if (!s.expires_at) return true;
      return new Date(s.expires_at).getTime() > Date.now();
    });

    if (activeSub) {
      const targetPlan = activeSub.plan_id;
      const currentRank = getPlanRank(currentPlan);
      const targetRank = getPlanRank(targetPlan);

      // Rule: NEVER downgrade an active subscription (unless expired)
      if (targetRank < currentRank) {
        return { reconciled: false, planId: currentPlan };
      }

      // If matching or already on target plan, no need to update
      if (currentPlan === targetPlan) {
        return { reconciled: false, planId: currentPlan };
      }

      // Upgrade / match: Update PG and SQLite
      const targetProfiles = getProfileQuotaForPlan(targetPlan);
      if (isPostgresConfigured()) {
        try {
          const repo = getCentralRepository();
          await repo.updateAuthUser(userId, {
            plan_id: targetPlan,
            profile_quota: targetProfiles,
          });
        } catch (err: any) {
          console.error('[Reconcile][CRITICAL] PG plan upgrade failed for user', userId, err?.message);
          return { reconciled: false, planId: currentPlan };
        }
      }

      try {
        db.prepare('UPDATE auth_users SET plan_id = ?, profile_quota = ?, updated_at = ? WHERE id = ?')
          .run(targetPlan, targetProfiles, now, userId);
        db.prepare('UPDATE commercial_users SET plan_id = ?, updated_at = ? WHERE id = ?')
          .run(targetPlan, now, userId);
      } catch {}

      return { reconciled: true, planId: targetPlan };
    }

    // No active subscription: check if user had a subscription that is now expired
    const expiredSub = subs.find((s) => {
      if (s.status === 'EXPIRED') return true;
      if (s.status === 'ACTIVE' && s.expires_at && new Date(s.expires_at).getTime() <= Date.now()) {
        return true;
      }
      return false;
    });

    if (expiredSub && currentPlan !== 'plan_free') {
      console.warn('[Reconcile][EXPIRED] Active subscription expired for user', userId, 'resetting to plan_free');
      const freeQuota = getProfileQuotaForPlan('plan_free');

      if (isPostgresConfigured()) {
        try {
          const repo = getCentralRepository();
          await repo.updateAuthUser(userId, {
            plan_id: 'plan_free',
            profile_quota: freeQuota,
          });
        } catch (err: any) {
          console.error('[Reconcile][CRITICAL] PG plan reset failed for user', userId, err?.message);
          return { reconciled: false, planId: currentPlan };
        }
      }

      try {
        db.prepare('UPDATE auth_users SET plan_id = ?, profile_quota = ?, updated_at = ? WHERE id = ?')
          .run('plan_free', freeQuota, now, userId);
        db.prepare('UPDATE commercial_users SET plan_id = ?, updated_at = ? WHERE id = ?')
          .run('plan_free', now, userId);
        db.prepare("UPDATE commercial_subscriptions SET status = 'EXPIRED' WHERE id = ?")
          .run(expiredSub.id);
      } catch {}

      return { reconciled: true, planId: 'plan_free' };
    }

    return { reconciled: false, planId: currentPlan };
  } finally {
    inFlightReconciliations.delete(userId);
  }
}
