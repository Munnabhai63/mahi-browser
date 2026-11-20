import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { reconcileUserPlanOnLogin } from '../../07_BACKEND/commercial/commercial-reconcile-service.js';
import { setPrismaClientForTest } from '../../06_DATABASE/prisma-client.js';
import { setCentralRepositoryForTest, CentralRepository } from '../../06_DATABASE/central-repository.js';

describe('BLOCK F5: Plan Reconcile Safety Suite', () => {
  const testDbDir = path.resolve('.mahi_data', 'test-plan-reconcile');
  const testDbPath = path.join(testDbDir, 'plan_reconcile_test.sqlite');

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    setPrismaClientForTest(null);
    setCentralRepositoryForTest(null);
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // Helper to seed a subscription in SQLite
  function seedSubscription(params: {
    userId: string;
    planId: string;
    status: string;
    expiresAt?: string | null;
  }) {
    const db = getDatabase();
    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO commercial_users (id, email, password_hash, salt, name, plan_id, created_at, updated_at)
      VALUES (?, ?, 'placeholder', 'placeholder', 'Subscriber', ?, ?, ?)
    `).run(params.userId, `${params.userId}@commercial.local`, params.planId, now, now);

    db.prepare(`
      INSERT OR IGNORE INTO commercial_plans (id, name, tier, limits_json, created_at)
      VALUES (?, 'Plan', 'pro', '{}', ?)
    `).run(params.planId, now);

    db.prepare(`
      INSERT INTO commercial_subscriptions (
        id, user_id, plan_id, status, billing_cycle, starts_at, expires_at,
        payment_provider, created_at
      ) VALUES (?, ?, ?, ?, 'ANNUAL', ?, ?, 'stripe', ?)
    `).run(subId, params.userId, params.planId, params.status, now, params.expiresAt ?? null, now);
  }

  // Case 1: Subscription is plan_pro (ACTIVE), PG has plan_free -> reconciles PG to plan_pro
  it('Case 1: Subscription is plan_pro (ACTIVE), PG has plan_free -> reconciles PG to plan_pro', async () => {
    const userId = 'user_case_1_upgrade';
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
    seedSubscription({
      userId,
      planId: 'plan_pro',
      status: 'ACTIVE',
      expiresAt: futureDate,
    });

    let updatedPgPlan: any = null;
    const mockRepo: Partial<CentralRepository> = {
      findAuthUserById: vi.fn().mockResolvedValue({
        id: userId,
        email: 'case1@example.com',
        plan_id: 'plan_free',
      }),
      updateAuthUser: vi.fn().mockImplementation(async (id: string, data: any) => {
        updatedPgPlan = data;
        return { id, ...data };
      }),
    };

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo as CentralRepository);

    const result = await reconcileUserPlanOnLogin(userId);

    expect(result.reconciled).toBe(true);
    expect(result.planId).toBe('plan_pro');
    expect(updatedPgPlan).toBeDefined();
    expect(updatedPgPlan.plan_id).toBe('plan_pro');
  });

  // Case 2: Subscription is plan_pro (EXPIRED), PG has plan_pro -> resets PG to plan_free with warning
  it('Case 2: Subscription is plan_pro (EXPIRED), PG has plan_pro -> resets PG to plan_free with warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    const userId = 'user_case_2_expired';
    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString();
    seedSubscription({
      userId,
      planId: 'plan_pro',
      status: 'ACTIVE',
      expiresAt: pastDate, // Past date = expired!
    });

    let updatedPgPlan: any = null;
    const mockRepo: Partial<CentralRepository> = {
      findAuthUserById: vi.fn().mockResolvedValue({
        id: userId,
        email: 'case2@example.com',
        plan_id: 'plan_pro',
      }),
      updateAuthUser: vi.fn().mockImplementation(async (id: string, data: any) => {
        updatedPgPlan = data;
        return { id, ...data };
      }),
    };

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo as CentralRepository);

    const result = await reconcileUserPlanOnLogin(userId);

    expect(result.reconciled).toBe(true);
    expect(result.planId).toBe('plan_free');
    expect(updatedPgPlan).toBeDefined();
    expect(updatedPgPlan.plan_id).toBe('plan_free');

    const hasWarnLog = warnSpy.mock.calls.some((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes('[Reconcile][EXPIRED]'))
    );
    expect(hasWarnLog).toBe(true);
    warnSpy.mockRestore();
  });

  // Case 3: Subscription is plan_starter, PG has plan_pro (ACTIVE higher plan) -> NEVER downgrades active subscription
  it('Case 3: Subscription is plan_starter, PG has plan_pro (ACTIVE higher plan) -> NEVER downgrades active subscription', async () => {
    const userId = 'user_case_3_no_downgrade';
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
    seedSubscription({
      userId,
      planId: 'plan_starter',
      status: 'ACTIVE',
      expiresAt: futureDate,
    });

    const updateAuthUserSpy = vi.fn();
    const mockRepo: Partial<CentralRepository> = {
      findAuthUserById: vi.fn().mockResolvedValue({
        id: userId,
        email: 'case3@example.com',
        plan_id: 'plan_pro', // Higher active plan in PG
      }),
      updateAuthUser: updateAuthUserSpy,
    };

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo as CentralRepository);

    const result = await reconcileUserPlanOnLogin(userId);

    expect(result.reconciled).toBe(false);
    expect(result.planId).toBe('plan_pro');
    expect(updateAuthUserSpy).not.toHaveBeenCalled();
  });

  // Case 4: Concurrent reconcile requests for same user -> loop guard handles cleanly without duplicate runs
  it('Case 4: Concurrent reconcile requests for same user -> loop guard handles cleanly without duplicate runs', async () => {
    const userId = 'user_case_4_concurrent';
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
    seedSubscription({
      userId,
      planId: 'plan_pro',
      status: 'ACTIVE',
      expiresAt: futureDate,
    });

    let updateCount = 0;
    const mockRepo: Partial<CentralRepository> = {
      findAuthUserById: vi.fn().mockImplementation(async () => {
        // Introduce small microtask delay to keep first call in flight
        await new Promise((r) => setTimeout(r, 20));
        return {
          id: userId,
          email: 'case4@example.com',
          plan_id: 'plan_free',
        };
      }),
      updateAuthUser: vi.fn().mockImplementation(async (id: string, data: any) => {
        updateCount++;
        return { id, ...data };
      }),
    };

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo as CentralRepository);

    // Trigger two concurrent reconcile calls
    const [res1, res2] = await Promise.all([
      reconcileUserPlanOnLogin(userId),
      reconcileUserPlanOnLogin(userId),
    ]);

    // Exactly one should perform the reconciliation, the concurrent one should return { reconciled: false }
    const reconciledResults = [res1.reconciled, res2.reconciled];
    expect(reconciledResults).toContain(true);
    expect(reconciledResults).toContain(false);
    expect(updateCount).toBe(1);
  });
});
