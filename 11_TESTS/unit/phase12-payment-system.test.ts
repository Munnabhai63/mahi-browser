/**
 * MAHI Browser — Commercial Payment System & Webhook Security Unit Tests
 * Batch P0-A Verification Suite
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  paymentService,
  PaymentWebhookEvent,
  SimulationPaymentAdapter,
} from '../../07_BACKEND/commercial/payment-service.js';
import { handleRemoteApiRequest } from '../../07_BACKEND/commercial/remote-api-router.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';

describe('Batch P0-A — Commercial Payment System & Security Tests', () => {
  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;

  const getSimProvider = () => paymentService.getProvider('simulation') as SimulationPaymentAdapter;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    const db = getDatabase();
    // Clean test billing records
    db.prepare('DELETE FROM commercial_billing_invoices').run();
    db.prepare('DELETE FROM commercial_payments').run();
    db.prepare('DELETE FROM commercial_webhook_events').run();
    db.prepare('DELETE FROM commercial_subscriptions').run();

    // Register User A
    const userAEmail = `pay_usera_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const resA = await registerCentralUser({
      email: userAEmail,
      password: 'UserAStrongPass123!',
      name: 'User A',
    });
    userAId = resA.user!.id;
    userAToken = resA.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userAId);

    // Register User B
    const userBEmail = `pay_userb_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const resB = await registerCentralUser({
      email: userBEmail,
      password: 'UserBStrongPass123!',
      name: 'User B',
    });
    userBId = resB.user!.id;
    userBToken = resB.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userBId);
  });

  describe('1. Plan Catalog & Server-Side Price Resolution', () => {
    it('returns available commercial plan catalog with server-side cents pricing', () => {
      const catalog = paymentService.getPlanCatalog();
      expect(catalog.length).toBeGreaterThan(0);

      const proPlan = catalog.find((p) => p.id === 'plan_pro' || p.tier === 'PRO');
      expect(proPlan).toBeDefined();
      expect(proPlan!.priceMonthly).toBe(29);
      expect(paymentService.calculatePlanAmountCents(proPlan!, 'MONTHLY')).toBe(2900);
      expect(paymentService.calculatePlanAmountCents(proPlan!, 'ANNUAL')).toBe(29000);
    });

    it('rejects checkout session for non-existent plan', async () => {
      await expect(
        paymentService.createCheckoutSession({
          userId: userAId,
          planId: 'plan_non_existent',
          billingCycle: 'MONTHLY',
        })
      ).rejects.toThrow('is not available for purchase');
    });

    it('rejects checkout session for FREE plan', async () => {
      await expect(
        paymentService.createCheckoutSession({
          userId: userAId,
          planId: 'plan_free',
          billingCycle: 'MONTHLY',
        })
      ).rejects.toThrow('Free tier does not require checkout payment');
    });
  });

  describe('2. Multi-Provider Checkout Session Creation', () => {
    it('creates simulation checkout session with correct pricing and pending transaction', async () => {
      const session = await paymentService.createCheckoutSession(
        {
          userId: userAId,
          planId: 'plan_pro',
          billingCycle: 'MONTHLY',
        },
        'simulation'
      );

      expect(session.sessionId).toMatch(/^sim_cs_/);
      expect(session.orderId).toMatch(/^sim_ord_/);
      expect(session.amountCents).toBe(2900);
      expect(session.currency).toBe('USD');
      expect(session.provider).toBe('simulation');

      const db = getDatabase();
      const pendingPay = db
        .prepare("SELECT * FROM commercial_payments WHERE id = ? AND status = 'PENDING'")
        .get(session.sessionId) as any;
      expect(pendingPay).toBeDefined();
      expect(pendingPay.amount_cents).toBe(2900);
      expect(pendingPay.user_id).toBe(userAId);
    });

    it('creates Stripe checkout session URL and metadata', async () => {
      const session = await paymentService.createCheckoutSession(
        {
          userId: userAId,
          planId: 'plan_business',
          billingCycle: 'ANNUAL',
        },
        'stripe'
      );

      expect(session.sessionId).toMatch(/^cs_(test|live)_/);
      expect(session.amountCents).toBe(79000); // $790.00
      expect(session.provider).toBe('stripe');
      expect(session.checkoutUrl).toContain('stripe.com');
    });

    it('creates Razorpay order with INR currency equivalence', async () => {
      const session = await paymentService.createCheckoutSession(
        {
          userId: userAId,
          planId: 'plan_pro',
          billingCycle: 'MONTHLY',
        },
        'razorpay'
      );

      expect(session.orderId).toMatch(/^order_/);
      expect(session.currency).toBe('INR');
      expect(session.amountCents).toBe(2900);
      expect(session.provider).toBe('razorpay');
    });

    it('honors checkout idempotency key to prevent duplicate pending orders', async () => {
      const key = `idem_${Date.now()}`;
      const session1 = await paymentService.createCheckoutSession(
        {
          userId: userAId,
          planId: 'plan_pro',
          billingCycle: 'MONTHLY',
          idempotencyKey: key,
        },
        'simulation'
      );

      const session2 = await paymentService.createCheckoutSession(
        {
          userId: userAId,
          planId: 'plan_pro',
          billingCycle: 'MONTHLY',
          idempotencyKey: key,
        },
        'simulation'
      );

      expect(session1.sessionId).toBe(session2.sessionId);
      expect(session1.orderId).toBe(key);
      expect(session2.orderId).toBe(key);
    });
  });

  describe('3. Cryptographic Webhook Signature & Security Enforcement', () => {
    it('verifies valid simulation HMAC signature and processes successful payment', async () => {
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const payload: PaymentWebhookEvent = {
        id: eventId,
        type: 'payment.succeeded',
        provider: 'simulation',
        userId: userAId,
        planId: 'plan_pro',
        billingCycle: 'MONTHLY',
        amountCents: 2900,
        currency: 'USD',
        externalPaymentId: `sim_pay_${Date.now()}`,
      };

      const rawPayload = JSON.stringify(payload);
      const validSig = getSimProvider().signPayload(rawPayload);

      const result = await paymentService.handleWebhook('simulation', rawPayload, validSig);
      expect(result.success).toBe(true);
      expect(result.eventId).toBe(eventId);

      // Verify entitlement activated in database
      const db = getDatabase();
      const user = db.prepare('SELECT plan_id, profile_quota FROM auth_users WHERE id = ?').get(userAId) as any;
      expect(user.plan_id).toBe('plan_pro');
      expect(user.profile_quota).toBe(100);

      // Verify invoice created
      const invoice = db.prepare('SELECT * FROM commercial_billing_invoices WHERE user_id = ?').get(userAId) as any;
      expect(invoice).toBeDefined();
      expect(invoice.amount_cents).toBe(2900);
      expect(invoice.status).toBe('PAID');

      // Verify active subscription
      const sub = paymentService.getUserSubscription(userAId);
      expect(sub).not.toBeNull();
      expect(sub?.status).toBe('ACTIVE');
      expect(sub?.planId).toBe('plan_pro');
    });

    it('rejects tampered webhook signature with cryptographic error', async () => {
      const rawPayload = JSON.stringify({
        id: `evt_fake_${Date.now()}`,
        type: 'payment.succeeded',
        userId: userAId,
        planId: 'plan_pro',
        amountCents: 2900,
      });

      const badSig = 'tampered_invalid_signature_hex';
      await expect(
        paymentService.handleWebhook('simulation', rawPayload, badSig)
      ).rejects.toThrow('Cryptographic verification of payment webhook failed');
    });

    it('rejects tampered amount (less than plan price)', async () => {
      const eventId = `evt_tamper_${Date.now()}`;
      const payload: PaymentWebhookEvent = {
        id: eventId,
        type: 'payment.succeeded',
        provider: 'simulation',
        userId: userAId,
        planId: 'plan_pro',
        billingCycle: 'MONTHLY',
        amountCents: 100, // Only 100 cents instead of 2900!
        currency: 'USD',
        externalPaymentId: `sim_tamper_${Date.now()}`,
      };

      const rawPayload = JSON.stringify(payload);
      const sig = getSimProvider().signPayload(rawPayload);

      await expect(
        paymentService.handleWebhook('simulation', rawPayload, sig)
      ).rejects.toThrow('AMOUNT_TAMPERING_DETECTED');
    });

    it('enforces webhook idempotency and rejects replay attacks', async () => {
      const eventId = `evt_idem_${Date.now()}`;
      const payload: PaymentWebhookEvent = {
        id: eventId,
        type: 'payment.succeeded',
        provider: 'simulation',
        userId: userAId,
        planId: 'plan_pro',
        billingCycle: 'MONTHLY',
        amountCents: 2900,
        currency: 'USD',
        externalPaymentId: `sim_idem_${Date.now()}`,
      };

      const rawPayload = JSON.stringify(payload);
      const sig = getSimProvider().signPayload(rawPayload);

      // First run: Success
      const res1 = await paymentService.handleWebhook('simulation', rawPayload, sig);
      expect(res1.success).toBe(true);

      // Replay attack / duplicate delivery: Must return idempotent success without duplicate rows
      const res2 = await paymentService.handleWebhook('simulation', rawPayload, sig);
      expect(res2.success).toBe(true);
      expect(res2.message).toContain('already processed');

      const db = getDatabase();
      const subs = db.prepare('SELECT COUNT(*) as cnt FROM commercial_subscriptions WHERE user_id = ?').get(userAId) as any;
      expect(subs.cnt).toBe(1);
    });
  });

  describe('4. Invoicing & Strict IDOR User Isolation', () => {
    it('isolates invoices between User A and User B', async () => {
      // User A payment
      const rawPayloadA = JSON.stringify({
        id: `evt_userA_${Date.now()}`,
        type: 'payment.succeeded',
        provider: 'simulation',
        userId: userAId,
        planId: 'plan_pro',
        billingCycle: 'MONTHLY',
        amountCents: 2900,
        currency: 'USD',
        externalPaymentId: `pay_A_${Date.now()}`,
      });
      const sigA = getSimProvider().signPayload(rawPayloadA);
      await paymentService.handleWebhook('simulation', rawPayloadA, sigA);

      // User B payment
      const rawPayloadB = JSON.stringify({
        id: `evt_userB_${Date.now()}`,
        type: 'payment.succeeded',
        provider: 'simulation',
        userId: userBId,
        planId: 'plan_business',
        billingCycle: 'MONTHLY',
        amountCents: 7900,
        currency: 'USD',
        externalPaymentId: `pay_B_${Date.now()}`,
      });
      const sigB = getSimProvider().signPayload(rawPayloadB);
      await paymentService.handleWebhook('simulation', rawPayloadB, sigB);

      // User A invoices
      const invoicesA = paymentService.getUserInvoices(userAId);
      expect(invoicesA.length).toBe(1);
      expect(invoicesA[0].userId).toBe(userAId);
      expect(invoicesA[0].amountCents).toBe(2900);

      // User B invoices
      const invoicesB = paymentService.getUserInvoices(userBId);
      expect(invoicesB.length).toBe(1);
      expect(invoicesB[0].userId).toBe(userBId);
      expect(invoicesB[0].amountCents).toBe(7900);
    });

    it('cancels active subscription successfully', async () => {
      // Create active sub for User A
      const rawPayload = JSON.stringify({
        id: `evt_sub_${Date.now()}`,
        type: 'payment.succeeded',
        provider: 'simulation',
        userId: userAId,
        planId: 'plan_pro',
        billingCycle: 'MONTHLY',
        amountCents: 2900,
        currency: 'USD',
        externalPaymentId: `pay_sub_${Date.now()}`,
      });
      const sig = getSimProvider().signPayload(rawPayload);
      await paymentService.handleWebhook('simulation', rawPayload, sig);

      expect(paymentService.getUserSubscription(userAId)?.status).toBe('ACTIVE');

      const cancelled = paymentService.cancelSubscription(userAId);
      expect(cancelled).toBe(true);
      expect(paymentService.getUserSubscription(userAId)).toBeNull();
    });
  });

  describe('5. Remote API Router Billing Endpoints Integration', () => {
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

    it('serves public commercial plans catalog via GET /api/v1/billing/plans', async () => {
      const { req, res, getResponse } = createMockReqRes('GET', '/api/v1/billing/plans', {});
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(200);
      expect(resp.body.success).toBe(true);
      expect(Array.isArray(resp.body.data.plans)).toBe(true);
    });

    it('creates checkout session via authenticated POST /api/v1/remote/billing/checkout', async () => {
      const { req, res, getResponse } = createMockReqRes(
        'POST',
        '/api/v1/remote/billing/checkout',
        { authorization: `Bearer ${userAToken}` },
        { planId: 'plan_pro', billingCycle: 'MONTHLY', provider: 'simulation' }
      );
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(201);
      expect(resp.body.success).toBe(true);
      expect(resp.body.data.sessionId).toMatch(/^sim_cs_/);
    });

    it('processes verified webhook via POST /api/v1/billing/webhook', async () => {
      const eventId = `evt_http_${Date.now()}`;
      const payload: PaymentWebhookEvent = {
        id: eventId,
        type: 'payment.succeeded',
        provider: 'simulation',
        userId: userBId,
        planId: 'plan_pro',
        billingCycle: 'MONTHLY',
        amountCents: 2900,
        currency: 'USD',
        externalPaymentId: `http_pay_${Date.now()}`,
      };

      const rawPayload = JSON.stringify(payload);
      const sig = getSimProvider().signPayload(rawPayload);

      const { req, res, getResponse } = createMockReqRes(
        'POST',
        '/api/v1/billing/webhook?provider=simulation',
        { 'x-simulation-signature': sig },
        rawPayload
      );
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(200);
      expect(resp.body.success).toBe(true);
      expect(resp.body.data.eventId).toBe(eventId);
    });

    it('returns 400 for tampered webhook signature on POST /api/v1/billing/webhook', async () => {
      const rawPayload = JSON.stringify({
        id: `evt_bad_${Date.now()}`,
        type: 'payment.succeeded',
        userId: userBId,
        planId: 'plan_pro',
        amountCents: 2900,
      });

      const { req, res, getResponse } = createMockReqRes(
        'POST',
        '/api/v1/billing/webhook?provider=simulation',
        { 'x-simulation-signature': 'forged_signature_attack' },
        rawPayload
      );
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(400);
      expect(resp.body.success).toBe(false);
      expect(resp.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('retrieves user invoices via authenticated GET /api/v1/remote/billing/invoices', async () => {
      const { req, res, getResponse } = createMockReqRes(
        'GET',
        '/api/v1/remote/billing/invoices',
        { authorization: `Bearer ${userBToken}` }
      );
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(200);
      expect(resp.body.success).toBe(true);
      expect(Array.isArray(resp.body.data.invoices)).toBe(true);
    });
  });
});
