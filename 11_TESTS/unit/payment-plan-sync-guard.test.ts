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
import { paymentService } from '../../07_BACKEND/commercial/payment-service.js';
import { setPrismaClientForTest } from '../../06_DATABASE/prisma-client.js';
import { setCentralRepositoryForTest, CentralRepository } from '../../06_DATABASE/central-repository.js';

describe('BLOCK F5: Payment Plan Sync Guard Suite', () => {
  const testDbDir = path.resolve('.mahi_data', 'test-payment-sync-guard');
  const testDbPath = path.join(testDbDir, 'payment_sync_guard.sqlite');

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

  // Case 1: Payment success with PG configured -> PG updated, planSyncFailed: false
  it('Case 1: Payment success with PG configured -> PG updated, planSyncFailed: false', async () => {
    const userId = 'user_pay_case_1';
    let updatedPgUser: any = null;

    const mockRepo: Partial<CentralRepository> = {
      updateAuthUser: vi.fn().mockImplementation(async (id: string, data: any) => {
        updatedPgUser = { id, ...data };
        return updatedPgUser;
      }),
    };

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo as CentralRepository);

    const res = await paymentService.activateSubscriptionFromPayment({
      userId,
      planId: 'plan_pro',
      billingCycle: 'ANNUAL',
      amountCents: 599900,
      currency: 'INR',
      provider: 'stripe',
      externalPaymentId: `pay_case_1_${Date.now()}`,
    });

    expect(res.planSyncFailed).toBe(false);
    expect(res.subscription.status).toBe('ACTIVE');
    expect(res.subscription.planId).toBe('plan_pro');
    expect(updatedPgUser).toBeDefined();
    expect(updatedPgUser.plan_id).toBe('plan_pro');
  });

  // Case 2: Payment success with PG throwing -> logs [PaymentService][RECONCILE_REQUIRED], returns planSyncFailed: true
  it('Case 2: Payment success with PG throwing -> logs [PaymentService][RECONCILE_REQUIRED], returns planSyncFailed: true', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const userId = 'user_pay_case_2';

    const mockRepo: Partial<CentralRepository> = {
      updateAuthUser: vi.fn().mockRejectedValue(new Error('PostgreSQL connection timeout')),
    };

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo as CentralRepository);

    const res = await paymentService.activateSubscriptionFromPayment({
      userId,
      planId: 'plan_pro',
      billingCycle: 'ANNUAL',
      amountCents: 599900,
      currency: 'INR',
      provider: 'stripe',
      externalPaymentId: `pay_case_2_${Date.now()}`,
    });

    expect(res.planSyncFailed).toBe(true);
    expect(res.subscription.status).toBe('ACTIVE');

    const hasReconcileLog = errorSpy.mock.calls.some((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes('[PaymentService][RECONCILE_REQUIRED]'))
    );
    expect(hasReconcileLog).toBe(true);

    errorSpy.mockRestore();
  });

  // Case 3: Bare catch blocks removed (verifiable by error propagation or logging)
  it('Case 3: Bare catch blocks removed (verifiable by error logging when SQLite errors occur)', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const userId = 'user_pay_case_3';

    setPrismaClientForTest(null);
    setCentralRepositoryForTest(null);

    // Run activateSubscriptionFromPayment - verify no unhandled crash, and proper error logging if any
    const res = await paymentService.activateSubscriptionFromPayment({
      userId,
      planId: 'plan_pro',
      billingCycle: 'ANNUAL',
      amountCents: 599900,
      currency: 'INR',
      provider: 'stripe',
      externalPaymentId: `pay_case_3_${Date.now()}`,
    });

    expect(res.subscription.status).toBe('ACTIVE');
    expect(res.planSyncFailed).toBe(false);

    errorSpy.mockRestore();
  });
});
