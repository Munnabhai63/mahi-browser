/**
 * MAHI Browser — Payment Webhook Forgery Guard Unit Tests
 * F1 Verification Suite: Strict Webhook Provider Whitelisting & Secret Lockdown
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  paymentService,
  PaymentGatewayNotConfiguredError,
  SimulationPaymentAdapter,
} from '../../07_BACKEND/commercial/payment-service.js';
import { handleCommercialApiRoutes } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';

function createMockReqRes(method: string, url: string, headers: Record<string, string> = {}, body?: any) {
  let statusCode = 200;
  let responseBody = '';
  const rawData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

  const req: any = {
    method,
    url,
    headers: {
      host: 'api.mahibrowser.com',
      'content-type': 'application/json',
      ...headers,
    },
    on: (event: string, cb: any) => {
      if (event === 'data' && rawData) {
        cb(Buffer.from(rawData));
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

async function invokeWebhook(url: string, headers: Record<string, string> = {}, body?: any) {
  const urlObj = new URL(`https://api.mahibrowser.com${url}`);
  const { req, res, getResponse } = createMockReqRes('POST', url, headers, body);
  const handled = await handleCommercialApiRoutes(req, res, urlObj.pathname, 'POST', urlObj);
  return { handled, ...getResponse() };
}

describe('F1 — Webhook Forgery Lockdown & Provider Whitelist', () => {
  let testUserId: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    const db = getDatabase();
    db.prepare('DELETE FROM commercial_billing_invoices').run();
    db.prepare('DELETE FROM commercial_payments').run();
    db.prepare('DELETE FROM commercial_webhook_events').run();
    db.prepare('DELETE FROM commercial_subscriptions').run();

    const email = `forge_test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const userRes = await registerCentralUser({
      email,
      password: 'StrongPassword123!',
      name: 'Webhook Forgery Test User',
    });
    testUserId = userRes.user!.id;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(testUserId);
  });

  it('Case 1: NODE_ENV=production and no simulation secret -> SimulationPaymentAdapter instantiate throws', () => {
    const origEnv = process.env.NODE_ENV;
    const origAllow = process.env.PAYMENT_ALLOW_TEST_ADAPTERS;
    const origSec = process.env.PAYMENT_SIMULATION_WEBHOOK_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.PAYMENT_ALLOW_TEST_ADAPTERS;
      delete process.env.PAYMENT_SIMULATION_WEBHOOK_SECRET;

      expect(() => new SimulationPaymentAdapter()).toThrow(PaymentGatewayNotConfiguredError);
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origAllow !== undefined) process.env.PAYMENT_ALLOW_TEST_ADAPTERS = origAllow;
      if (origSec !== undefined) process.env.PAYMENT_SIMULATION_WEBHOOK_SECRET = origSec;
    }
  });

  it('Case 2: POST /api/v1/billing/webhook?provider=simulation -> 404, no subscription created', async () => {
    const payload = {
      id: `evt_sim_${Date.now()}`,
      type: 'payment.succeeded',
      userId: testUserId,
      planId: 'plan_pro',
      billingCycle: 'MONTHLY',
      amountCents: 2900,
      currency: 'USD',
      externalPaymentId: `sim_forged_${Date.now()}`,
    };

    const res = await invokeWebhook(
      '/api/v1/billing/webhook?provider=simulation',
      { 'x-simulation-signature': 'fake_signature' },
      payload
    );

    expect(res.handled).toBe(true);
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Unknown webhook provider');

    // Confirm no subscription was created
    const sub = paymentService.getUserSubscription(testUserId);
    expect(sub).toBeNull();

    const db = getDatabase();
    const subCount = db.prepare('SELECT count(*) as cnt FROM commercial_subscriptions WHERE user_id = ?').get(testUserId) as any;
    expect(subCount.cnt).toBe(0);
  });

  it('Case 3: Valid YouPI signature with payload -> 200 and subscription created', async () => {
    const origSec = process.env.YOUPI_PG_WEBHOOK_SECRET;
    const testSecret = 'test_youpi_pg_secret_key_123';
    process.env.YOUPI_PG_WEBHOOK_SECRET = testSecret;

    try {
      const payload = {
        id: `evt_youpi_${Date.now()}`,
        type: 'payment.succeeded',
        provider: 'youpi_pg',
        amount: 5999,
        amountPaise: 599900,
        currency: 'INR',
        metadata: {
          userId: testUserId,
          planId: 'plan_pro',
          billingCycle: 'MONTHLY',
        },
        externalPaymentId: `upi_tx_${Date.now()}`,
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', testSecret).update(rawBody).digest('hex');

      const res = await invokeWebhook(
        '/api/v1/billing/webhook',
        { 'x-youpi-signature': signature },
        rawBody
      );

      expect(res.handled).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify active subscription
      const sub = paymentService.getUserSubscription(testUserId);
      expect(sub).not.toBeNull();
      expect(sub?.status).toBe('ACTIVE');
      expect(sub?.planId).toBe('plan_pro');
    } finally {
      if (origSec !== undefined) {
        process.env.YOUPI_PG_WEBHOOK_SECRET = origSec;
      } else {
        delete process.env.YOUPI_PG_WEBHOOK_SECRET;
      }
    }
  });

  it('Case 4: Stripe header with wrong signature -> 400 INVALID_WEBHOOK_SIGNATURE', async () => {
    const payload = {
      id: `evt_stripe_${Date.now()}`,
      type: 'payment.succeeded',
      userId: testUserId,
      planId: 'plan_pro',
      amountCents: 2900,
    };

    const res = await invokeWebhook(
      '/api/v1/billing/webhook',
      { 'stripe-signature': 't=123456,v1=tampered_invalid_hex_signature' },
      payload
    );

    expect(res.handled).toBe(true);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('INVALID_WEBHOOK_SIGNATURE');

    // Confirm no subscription was created
    const sub = paymentService.getUserSubscription(testUserId);
    expect(sub).toBeNull();
  });
});
