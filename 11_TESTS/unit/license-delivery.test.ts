import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase, setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { paymentService } from '../../07_BACKEND/commercial/payment-service.js';
import { handleCommercialApiRoutes } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import { getEmailProvider, setEmailProvider, EmailProvider } from '../../05_AUTH/email-service.js';
import * as licenseEngine from '../../04_LICENSING/license-engine.js';

// Stub Email Provider to capture emails sent during payment approval
class StubEmailProvider implements EmailProvider {
  public paymentApprovedEmails: Array<{
    email: string;
    planName: string;
    amountInr: string;
    paidAt: string;
    licenceKey?: string;
    validUntil?: string;
  }> = [];

  async sendVerificationEmail(): Promise<boolean> { return true; }
  async sendPasswordResetEmail(): Promise<boolean> { return true; }
  async sendSecurityAlert(): Promise<boolean> { return true; }
  async sendWorkspaceInvitationEmail(): Promise<boolean> { return true; }
  async sendBillingAlert(): Promise<boolean> { return true; }
  async sendSupportEscalationEmail(): Promise<boolean> { return true; }
  async sendPaymentPendingEmail(): Promise<boolean> { return true; }
  async sendPaymentApprovedEmail(payload: any): Promise<boolean> {
    this.paymentApprovedEmails.push(payload);
    return true;
  }
  async sendPaymentRejectedEmail(): Promise<boolean> { return true; }

  clear(): void {
    this.paymentApprovedEmails = [];
  }
}

// Helper to mock HTTP req / res for handleCommercialApiRoutes
function createMockReqRes(method: string, url: string, headers: Record<string, string>, body?: any) {
  let statusCode = 200;
  let responseBody = '';
  const req: any = {
    method,
    url,
    headers: {
      host: 'api.mahibrowser.com',
      'content-type': 'application/json',
      ...headers,
    },
    on: (event: string, cb: any) => {
      if (event === 'data' && body) {
        cb(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
      }
      if (event === 'end') {
        cb();
      }
    },
  };

  const res: any = {
    writeHead: (code: number) => {
      statusCode = code;
    },
    setHeader: () => {},
    end: (data: string) => {
      responseBody = data;
    },
  };

  return {
    req,
    res,
    getResponse: () => ({
      status: statusCode,
      body: responseBody ? JSON.parse(responseBody) : {},
    }),
  };
}

async function invokeRoute(method: string, pathUrl: string, headers: Record<string, string> = {}, body?: any) {
  const urlObj = new URL(`https://api.mahibrowser.com${pathUrl}`);
  const { req, res, getResponse } = createMockReqRes(method, pathUrl, headers, body);
  const handled = await handleCommercialApiRoutes(req, res, urlObj.pathname, method, urlObj);
  return { handled, ...getResponse() };
}

describe('Licence Delivery & Customer Self-Service Suite (Block E)', () => {
  let testDbPath: string;
  let originalEmailProvider: EmailProvider;
  let stubProvider: StubEmailProvider;

  let userAId: string;
  let userAToken: string;
  let userAEmail: string;

  let userBId: string;
  let userBToken: string;
  let userBEmail: string;

  let userCId: string;
  let userCToken: string;
  let userCEmail: string;

  let userALicenceRawKey: string;

  beforeAll(async () => {
    testDbPath = path.join(os.tmpdir(), `test_license_delivery_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.sqlite`);
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    originalEmailProvider = getEmailProvider();
    stubProvider = new StubEmailProvider();
    setEmailProvider(stubProvider);

    const db = getDatabase();

    // Register User A (Paid user with licence)
    userAEmail = `lic_user_a_${Date.now()}@testmahibrowser.com`;
    const regA = await registerCentralUser({ email: userAEmail, password: 'Password123!', name: 'User A' });
    userAId = regA.user!.id;
    userAToken = regA.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userAId);
    db.prepare(`
      INSERT OR REPLACE INTO commercial_users (id, email, password_hash, salt, name, plan_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'salt', 'User A', 'plan_free', datetime('now'), datetime('now'))
    `).run(userAId, userAEmail);

    // Register User B (Another user)
    userBEmail = `lic_user_b_${Date.now()}@testmahibrowser.com`;
    const regB = await registerCentralUser({ email: userBEmail, password: 'Password123!', name: 'User B' });
    userBId = regB.user!.id;
    userBToken = regB.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userBId);
    db.prepare(`
      INSERT OR REPLACE INTO commercial_users (id, email, password_hash, salt, name, plan_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'salt', 'User B', 'plan_free', datetime('now'), datetime('now'))
    `).run(userBId, userBEmail);

    // Register User C (Free user with no licence)
    userCEmail = `lic_user_c_${Date.now()}@testmahibrowser.com`;
    const regC = await registerCentralUser({ email: userCEmail, password: 'Password123!', name: 'User C' });
    userCId = regC.user!.id;
    userCToken = regC.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userCId);
    db.prepare(`
      INSERT OR REPLACE INTO commercial_users (id, email, password_hash, salt, name, plan_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'salt', 'User C', 'plan_free', datetime('now'), datetime('now'))
    `).run(userCId, userCEmail);
  });

  afterAll(() => {
    setEmailProvider(originalEmailProvider);
    closeDatabase();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch {}
  });

  // 1. activateSubscriptionFromPayment returns a non-null licence with a rawKey matching format
  it('1. activateSubscriptionFromPayment returns a non-null licence with a rawKey matching /^MAHI-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/', async () => {
    const actResult = await paymentService.activateSubscriptionFromPayment({
      userId: userAId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      amountCents: 99900,
      currency: 'INR',
      provider: 'youpi_pg',
      externalPaymentId: 'pay_activation_test_1',
    });

    expect(actResult.subscription).toBeDefined();
    expect(actResult.subscription.status).toBe('ACTIVE');
    expect(actResult.invoice).toBeDefined();
    expect(actResult.invoice.status).toBe('PAID');

    expect(actResult.licence).not.toBeNull();
    expect(actResult.licence!.rawKey).toMatch(/^MAHI-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    expect(actResult.licence!.keyMasked).toMatch(/^MAHI-\*{4}-\*{4}-[A-F0-9]{4}$/);

    userALicenceRawKey = actResult.licence!.rawKey;

    // Verify persisted in DB
    const db = getDatabase();
    const licRow = db.prepare('SELECT * FROM licenses WHERE account_id = ?').get(userAId) as any;
    expect(licRow).toBeDefined();
    expect(licRow.key_masked).toBe(actResult.licence!.keyMasked);
    expect(licRow.status).toBe('ACTIVE');
  });

  // 2. Running the same activation twice (replayed webhook) creates exactly ONE licence, not two
  it('2. Running the same activation twice (replayed webhook) creates exactly ONE licence, not two', async () => {
    const db = getDatabase();
    const countBefore = (db.prepare('SELECT COUNT(*) as count FROM licenses WHERE account_id = ?').get(userAId) as any).count;
    expect(countBefore).toBe(1);

    // Replay activation with the exact same payment ID
    const replayResult = await paymentService.activateSubscriptionFromPayment({
      userId: userAId,
      planId: 'professional_10',
      billingCycle: 'MONTHLY',
      amountCents: 99900,
      currency: 'INR',
      provider: 'youpi_pg',
      externalPaymentId: 'pay_activation_test_1',
    });

    expect(replayResult.subscription.status).toBe('ACTIVE');

    const countAfter = (db.prepare('SELECT COUNT(*) as count FROM licenses WHERE account_id = ?').get(userAId) as any).count;
    expect(countAfter).toBe(1); // Exactly one licence, idempotency preserved
  });

  // 3. A licence-creation failure does NOT roll back the payment: monkeypatch createLicense to throw, assert subscription still ends ACTIVE and licence === null
  it('3. A licence-creation failure does NOT roll back the payment', async () => {
    const spy = vi.spyOn(licenseEngine, 'createLicense').mockImplementationOnce(() => {
      throw new Error('SIMULATED_MINTING_ERROR_GENERATOR_OFFLINE');
    });

    const paymentId = `pay_err_test_${Date.now()}`;
    const result = await paymentService.activateSubscriptionFromPayment({
      userId: userBId,
      planId: 'professional_25',
      billingCycle: 'ANNUAL',
      amountCents: 249900,
      currency: 'INR',
      provider: 'youpi_pg',
      externalPaymentId: paymentId,
    });

    // Payment and subscription must succeed and remain committed
    expect(result.subscription).toBeDefined();
    expect(result.subscription.status).toBe('ACTIVE');
    expect(result.invoice).toBeDefined();
    expect(result.invoice.status).toBe('PAID');

    // Licence was null because of failure, but did NOT roll back payment
    expect(result.licence).toBeNull();

    // Verify DB committed
    const db = getDatabase();
    const payRow = db.prepare('SELECT status FROM commercial_payments WHERE external_payment_id = ?').get(paymentId) as any;
    expect(payRow).toBeDefined();
    expect(payRow.status).toBe('SUCCEEDED');

    const subRow = db.prepare('SELECT status FROM commercial_subscriptions WHERE user_id = ?').get(userBId) as any;
    expect(subRow).toBeDefined();
    expect(subRow.status).toBe('ACTIVE');

    spy.mockRestore();
  });

  // 4. approveManualPayment passes a real licenceKey to sendPaymentApprovedEmail
  it('4. approveManualPayment passes a real licenceKey to sendPaymentApprovedEmail', async () => {
    stubProvider.clear();

    const utr = `UTRREALKEY${Date.now()}`;
    const submitRes = await paymentService.submitManualUpiPayment({
      userId: userBId,
      planId: 'professional_50',
      billingCycle: 'MONTHLY',
      utr,
    });

    const approveRes = await paymentService.approveManualPayment(submitRes.paymentId, {
      id: 'admin_test_1',
      name: 'Super Admin',
      role: 'ADMIN',
    });

    expect(approveRes.status).toBe('SUCCEEDED');
    expect(stubProvider.paymentApprovedEmails.length).toBe(1);

    const emailPayload = stubProvider.paymentApprovedEmails[0];
    expect(emailPayload.email).toBe(userBEmail);
    expect(emailPayload.licenceKey).toBeDefined();
    expect(emailPayload.licenceKey).toMatch(/^MAHI-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    expect(emailPayload.validUntil).toBeDefined();
    expect(emailPayload.validUntil).not.toBeNull();
  });

  // 5. GET /api/v1/me/license returns keyMasked and never the raw key
  it('5. GET /api/v1/me/license returns keyMasked and never the raw key', async () => {
    const res = await invokeRoute('GET', '/api/v1/me/license', {
      authorization: `Bearer ${userAToken}`,
    });

    expect(res.handled).toBe(true);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.hasLicense).toBe(true);
    expect(data.keyMasked).toMatch(/^MAHI-\*{4}-\*{4}-[A-F0-9]{4}$/);
    expect(data.planId).toBe('professional_10');
    expect(data.planName).toBeDefined();
    expect(data.status).toBe('ACTIVE');
    expect(data.deviceLimit).toBeGreaterThanOrEqual(1);
    expect(typeof data.devicesUsed).toBe('number');
    expect(data.validUntil).toBeDefined();
    expect(data.createdAt).toBeDefined();

    // CRITICAL SECURITY ASSERTION: Raw key is NEVER exposed in the JSON response
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain(userALicenceRawKey);
    expect(data.rawKey).toBeUndefined();
    expect(data.rawLicenseKey).toBeUndefined();
  });

  // 6. GET /api/v1/me/license for a user with no licence returns 404 NO_LICENSE
  it('6. GET /api/v1/me/license for a user with no licence returns 404 NO_LICENSE', async () => {
    const res = await invokeRoute('GET', '/api/v1/me/license', {
      authorization: `Bearer ${userCToken}`,
    });

    expect(res.handled).toBe(true);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_LICENSE');
  });

  // 7. GET /api/v1/me/license with another user's token cannot see the first user's licence (IDOR check)
  it("7. GET /api/v1/me/license with another user's token cannot see the first user's licence (IDOR check)", async () => {
    // User C attempts IDOR by appending ?userId=<userAId>
    const res = await invokeRoute('GET', `/api/v1/me/license?userId=${userAId}`, {
      authorization: `Bearer ${userCToken}`,
    });

    // Endpoint must ignore query param and resolve strictly to authenticated User C (who has no licence -> 404)
    expect(res.handled).toBe(true);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_LICENSE');

    // Unauthenticated request must return 401
    const unauthRes = await invokeRoute('GET', '/api/v1/me/license');
    expect(unauthRes.handled).toBe(true);
    expect(unauthRes.status).toBe(401);
  });
});
