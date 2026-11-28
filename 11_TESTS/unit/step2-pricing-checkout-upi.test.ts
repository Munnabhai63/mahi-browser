/**
 * MAHI Browser — Step 2 Commercial Master Mission Verification Suite
 * Covers:
 * 1. Canonical Plan Catalog & Authoritative Minor-Unit Calculation
 * 2. Live Gateway Adapters & Signature Verification (Stripe, Razorpay)
 * 3. Persisted Manual UPI UTR Submission & Admin Approval/Rejection Workflow
 * 4. Central JWT Billing Endpoints & Strict IDOR User Isolation
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  CANONICAL_PLAN_CATALOG,
  CanonicalPlanId,
  calculateAuthoritativeOrderTotal,
  ADDON_PRICING,
  legacyPlanIdToCanonical,
} from '../../07_BACKEND/commercial/canonical-plan-catalog.js';
import {
  paymentService,
  PaymentGatewayNotConfiguredError,
  verifyRazorpayPaymentSignature,
  StripePaymentAdapter,
  RazorpayPaymentAdapter,
  YoupiPgPaymentAdapter,
} from '../../07_BACKEND/commercial/payment-service.js';
import { handleCommercialApiRoutes } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { handleRemoteApiRequest } from '../../07_BACKEND/commercial/remote-api-router.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import { getAdminWebSecret } from '../../08_SECURITY/install-secrets.js';
import { getWebAdminHtml } from '../../07_BACKEND/server/web-admin-html.js';
import { getCommercialPlanById } from '../../07_BACKEND/commercial/commercial-plan-service.js';

describe('STEP 2 COMMERCIAL MISSION — Unified Pricing, Checkout & UPI Lifecycle', () => {
  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    const db = getDatabase();
    // Clean test records
    db.prepare('DELETE FROM commercial_billing_invoices').run();
    db.prepare('DELETE FROM commercial_payments').run();
    db.prepare('DELETE FROM commercial_webhook_events').run();
    db.prepare('DELETE FROM commercial_subscriptions').run();

    // User A
    const userAEmail = `step2_usera_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const resA = await registerCentralUser({
      email: userAEmail,
      password: 'UserAStrongPass123!',
      name: 'Step2 User A',
    });
    userAId = resA.user!.id;
    userAToken = resA.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userAId);

    // User B
    const userBEmail = `step2_userb_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const resB = await registerCentralUser({
      email: userBEmail,
      password: 'UserBStrongPass123!',
      name: 'Step2 User B',
    });
    userBId = resB.user!.id;
    userBToken = resB.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userBId);
  });

  // Mock Request/Response Helper for testing handleCommercialApiRoutes
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

  async function invokeRoute(method: string, path: string, headers: Record<string, string> = {}, body?: any) {
    const urlObj = new URL(`https://api.mahibrowser.com${path}`);
    const { req, res, getResponse } = createMockReqRes(method, path, headers, body);
    const handled = await handleCommercialApiRoutes(req, res, urlObj.pathname, method, urlObj);
    return { handled, ...getResponse() };
  }

  // ==========================================================================
  // 1. CANONICAL PLAN CATALOG & AUTHORITATIVE MINOR-UNIT CALCULATION
  // ==========================================================================
  describe('1. Canonical Plan Catalog & Authoritative Minor-Unit Calculations', () => {
    it('enforces free tier limit of exactly 1 profile across canonical catalog', () => {
      expect(CANONICAL_PLAN_CATALOG.free.profileLimit).toBe(1);
      expect(CANONICAL_PLAN_CATALOG.free.seatLimit).toBe(1);
    });

    it('enforces exact profile & seat limits across all 8 commercial tiers', () => {
      expect(CANONICAL_PLAN_CATALOG.professional_10.profileLimit).toBe(10);
      expect(CANONICAL_PLAN_CATALOG.professional_10.seatLimit).toBe(1);

      expect(CANONICAL_PLAN_CATALOG.professional_25.profileLimit).toBe(25);
      expect(CANONICAL_PLAN_CATALOG.professional_25.seatLimit).toBe(2);

      expect(CANONICAL_PLAN_CATALOG.professional_50.profileLimit).toBe(50);
      expect(CANONICAL_PLAN_CATALOG.professional_50.seatLimit).toBe(3);

      expect(CANONICAL_PLAN_CATALOG.professional_100.profileLimit).toBe(100);
      expect(CANONICAL_PLAN_CATALOG.professional_100.seatLimit).toBe(5);

      expect(CANONICAL_PLAN_CATALOG.business_starter.profileLimit).toBe(50);
      expect(CANONICAL_PLAN_CATALOG.business_starter.seatLimit).toBe(5);

      expect(CANONICAL_PLAN_CATALOG.business_growth.profileLimit).toBe(100);
      expect(CANONICAL_PLAN_CATALOG.business_growth.seatLimit).toBe(10);

      expect(CANONICAL_PLAN_CATALOG.business_scale.profileLimit).toBe(200);
      expect(CANONICAL_PLAN_CATALOG.business_scale.seatLimit).toBe(20);

      expect(CANONICAL_PLAN_CATALOG.business_enterprise.profileLimit).toBe(300);
      expect(CANONICAL_PLAN_CATALOG.business_enterprise.seatLimit).toBe(999);
    });

    it('maps legacy plan aliases to canonical plan IDs or returns null for invalid plans', () => {
      expect(legacyPlanIdToCanonical('plan_pro')).toBe('professional_100');
      expect(legacyPlanIdToCanonical('plan_free')).toBe('free');
      expect(legacyPlanIdToCanonical('team_50')).toBe('business_starter');
      expect(legacyPlanIdToCanonical('team_100')).toBe('business_growth');
      expect(legacyPlanIdToCanonical('team_200')).toBe('business_scale');
      expect(legacyPlanIdToCanonical('team_300')).toBe('business_enterprise');
      expect(legacyPlanIdToCanonical('non_existent_plan_xyz')).toBeNull();
    });

    it('computes exact monthly and annual base rates with 50% discount in minor units (paise)', () => {
      // Monthly Professional 10: ₹599 = 59,900 paise
      const monthlyP10 = calculateAuthoritativeOrderTotal({
        planId: 'professional_10',
        billingCycle: 'MONTHLY',
        currency: 'INR',
      });
      expect(monthlyP10.totalChargeMinor).toBe(59900);
      expect(monthlyP10.billingMonths).toBe(1);

      // Annual Professional 10: (59,900 * 0.5) * 12 = 29,950 * 12 = 359,400 paise
      const annualP10 = calculateAuthoritativeOrderTotal({
        planId: 'professional_10',
        billingCycle: 'ANNUAL',
        currency: 'INR',
      });
      expect(annualP10.discountedMonthlyRateMinor).toBe(29950);
      expect(annualP10.billingMonths).toBe(12);
      expect(annualP10.totalChargeMinor).toBe(29950 * 12);
    });

    it('computes exact add-on pricing for extra seats and proxy traffic with 50% annual discount', () => {
      // Addon constants: extra seat = 49,900 paise/mo; extra proxy = 19,900 paise/mo
      expect(ADDON_PRICING.EXTRA_MEMBER.monthlyPricePaise).toBe(49900);
      expect(ADDON_PRICING.EXTRA_PROXY_GB.monthlyPricePaise).toBe(19900);

      // Monthly with 2 seats and 5 GB proxy
      // Base: 299,900 + (2 * 49,900) + (5 * 19,900) = 299,900 + 99,800 + 99,500 = 499,200 paise
      const orderMonthly = calculateAuthoritativeOrderTotal({
        planId: 'professional_50',
        billingCycle: 'MONTHLY',
        currency: 'INR',
        extraMembers: 2,
        extraProxyGb: 5,
      });
      expect(orderMonthly.baseMonthlyRateMinor).toBe(299900);
      expect(orderMonthly.extraMembersTotalMinor).toBe(99800);
      expect(orderMonthly.extraProxyGbTotalMinor).toBe(99500);
      expect(orderMonthly.totalChargeMinor).toBe(499200);

      // Annual with same add-ons: base discounted + 12 months addons
      const orderAnnual = calculateAuthoritativeOrderTotal({
        planId: 'professional_50',
        billingCycle: 'ANNUAL',
        currency: 'INR',
        extraMembers: 2,
        extraProxyGb: 5,
      });
      expect(orderAnnual.discountedMonthlyRateMinor).toBe(149950);
      expect(orderAnnual.billingMonths).toBe(12);
      expect(orderAnnual.totalChargeMinor).toBe(
        (149950 * 12) + (2 * 49900 * 12) + (5 * 19900 * 12)
      );
    });
  });

  // ==========================================================================
  // 2. LIVE GATEWAY ADAPTERS & SIGNATURE VERIFICATION
  // ==========================================================================
  describe('2. Live Gateway Adapters & Signature Verification', () => {
    it('throws PaymentGatewayNotConfiguredError when production keys are missing', async () => {
      const origEnv = process.env.NODE_ENV;
      const origStripe = process.env.STRIPE_SECRET_KEY;
      const origRzpKey = process.env.RAZORPAY_KEY_ID;
      const origRzpSec = process.env.RAZORPAY_KEY_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.STRIPE_SECRET_KEY;
        delete process.env.RAZORPAY_KEY_ID;
        delete process.env.RAZORPAY_KEY_SECRET;

        const stripeAdapter = new StripePaymentAdapter();
        const razorpayAdapter = new RazorpayPaymentAdapter();
        const plan = CANONICAL_PLAN_CATALOG.professional_50 as any;

        await expect(
          stripeAdapter.createCheckoutSession({ userId: userAId, planId: 'professional_50', billingCycle: 'MONTHLY' }, plan, 299900)
        ).rejects.toThrowError(PaymentGatewayNotConfiguredError);

        await expect(
          razorpayAdapter.createCheckoutSession({ userId: userAId, planId: 'professional_50', billingCycle: 'MONTHLY' }, plan, 299900)
        ).rejects.toThrowError(PaymentGatewayNotConfiguredError);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origStripe) process.env.STRIPE_SECRET_KEY = origStripe;
        if (origRzpKey) process.env.RAZORPAY_KEY_ID = origRzpKey;
        if (origRzpSec) process.env.RAZORPAY_KEY_SECRET = origRzpSec;
      }
    });

    it('verifies Razorpay payment signatures cryptographically and rejects tampered signatures', () => {
      const orderId = 'order_test_rzp_98765';
      const paymentId = 'pay_test_rzp_54321';
      const secret = 'rzp_test_secret_key_abcdef';

      // Valid signature
      const validSig = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(verifyRazorpayPaymentSignature(orderId, paymentId, validSig, secret)).toBe(true);

      // Tampered signature
      const tamperedSig = validSig.replace(/^[0-9a-f]/, (c) => (c === 'a' ? 'b' : 'a'));
      expect(verifyRazorpayPaymentSignature(orderId, paymentId, tamperedSig, secret)).toBe(false);

      // Wrong payment ID
      expect(verifyRazorpayPaymentSignature(orderId, 'pay_tampered_id', validSig, secret)).toBe(false);
    });

    it('verifies Stripe webhook signatures with timestamp tolerance check', () => {
      const adapter = new StripePaymentAdapter();
      const secret = 'whsec_test_stripe_secret_123';
      const rawPayload = JSON.stringify({ id: 'evt_test_1', type: 'payment_intent.succeeded' });
      const nowSec = Math.floor(Date.now() / 1000);

      // Generate valid header: t=timestamp,v1=sig
      const signedPayload = `${nowSec}.${rawPayload}`;
      const validSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const validHeader = `t=${nowSec},v1=${validSig}`;

      expect(adapter.verifyWebhookSignature(rawPayload, validHeader, secret)).toBe(true);

      // Tampered payload
      expect(adapter.verifyWebhookSignature(rawPayload + 'tampered', validHeader, secret)).toBe(false);

      // Expired timestamp (> 600s in past)
      const expiredSec = nowSec - 1000;
      const expiredSig = crypto.createHmac('sha256', secret).update(`${expiredSec}.${rawPayload}`).digest('hex');
      expect(adapter.verifyWebhookSignature(rawPayload, `t=${expiredSec},v1=${expiredSig}`, secret)).toBe(false);
    });
  });

  // ==========================================================================
  // 3. PERSISTED MANUAL UPI UTR FLOW & ADMIN APPROVAL/REJECTION WORKFLOW
  // ==========================================================================
  describe('3. Persisted Manual UPI UTR Flow & Admin Workflow', () => {
    it('persists manual UPI UTR submission in commercial_payments with PENDING_VERIFICATION', async () => {
      const utr = `UTR${Date.now()}`;
      const result = await paymentService.submitManualUpiPayment({
        userId: userAId,
        planId: 'professional_10',
        billingCycle: 'ANNUAL',
        utr,
      });

      expect(result.status).toBe('PENDING_VERIFICATION');
      expect(result.utr).toBe(utr);
      expect(result.amountPaise).toBe(calculateAuthoritativeOrderTotal({ planId: 'professional_10', billingCycle: 'ANNUAL' }).totalChargeMinor);

      const db = getDatabase();
      const row = db.prepare('SELECT * FROM commercial_payments WHERE external_payment_id = ?').get(utr) as any;
      expect(row).toBeDefined();
      expect(row.user_id).toBe(userAId);
      expect(row.provider).toBe('manual_upi');
      expect(row.status).toBe('PENDING_VERIFICATION');
    });

    it('rejects duplicate UTR submissions with 409 conflict error (anti-replay)', async () => {
      const duplicateUtr = `DUP${Date.now()}`;
      await paymentService.submitManualUpiPayment({
        userId: userAId,
        planId: 'professional_10',
        billingCycle: 'MONTHLY',
        utr: duplicateUtr,
      });

      await expect(
        paymentService.submitManualUpiPayment({
          userId: userBId,
          planId: 'professional_10',
          billingCycle: 'MONTHLY',
          utr: duplicateUtr,
        })
      ).rejects.toThrowError(/UTR_ALREADY_EXISTS/);
    });

    it('rejects invalid UTR formats (< 6 chars or non-alphanumeric)', async () => {
      await expect(
        paymentService.submitManualUpiPayment({
          userId: userAId,
          planId: 'professional_10',
          utr: '123',
        })
      ).rejects.toThrowError(/INVALID_UTR/);

      await expect(
        paymentService.submitManualUpiPayment({
          userId: userAId,
          planId: 'professional_10',
          utr: 'UTR@#$$!INVALID',
        })
      ).rejects.toThrowError(/INVALID_UTR/);
    });

    it('allows admin to approve pending UPI payment, activating subscription and creating invoice', async () => {
      const utr = `APPR${Date.now()}`;
      const submitRes = await paymentService.submitManualUpiPayment({
        userId: userAId,
        planId: 'professional_50',
        billingCycle: 'ANNUAL',
        utr,
      });

      const adminActor = { id: 'admin_1', name: 'Master Admin', role: 'SUPER_ADMIN' };
      const approveRes = await paymentService.approveManualPayment(submitRes.paymentId, adminActor);
      expect(approveRes.success).toBe(true);
      expect(approveRes.status).toBe('SUCCEEDED');

      // Verify payment is now SUCCEEDED
      const db = getDatabase();
      const pRow = db.prepare('SELECT status FROM commercial_payments WHERE id = ?').get(submitRes.paymentId) as any;
      expect(pRow.status).toBe('SUCCEEDED');

      // Verify subscription activated
      const sub = paymentService.getUserSubscription(userAId);
      expect(sub).toBeDefined();
      expect(sub?.status).toBe('ACTIVE');
      expect(sub?.planId).toBe('professional_50');

      // Verify invoice created
      const invoices = paymentService.getUserInvoices(userAId);
      expect(invoices.length).toBeGreaterThan(0);
      expect(invoices[0].status).toBe('PAID');
    });

    it('allows admin to reject pending UPI payment with recorded reason', async () => {
      const utr = `REJ${Date.now()}`;
      const submitRes = await paymentService.submitManualUpiPayment({
        userId: userBId,
        planId: 'professional_10',
        billingCycle: 'MONTHLY',
        utr,
      });

      const adminActor = { id: 'admin_1', name: 'Master Admin', role: 'SUPER_ADMIN' };
      const rejectRes = await paymentService.rejectManualPayment(submitRes.paymentId, adminActor, 'Fake UTR reference');
      expect(rejectRes.success).toBe(true);
      expect(rejectRes.status).toBe('REJECTED');
      expect(rejectRes.reason).toBe('Fake UTR reference');

      const db = getDatabase();
      const pRow = db.prepare('SELECT status, metadata_json FROM commercial_payments WHERE id = ?').get(submitRes.paymentId) as any;
      expect(pRow.status).toBe('REJECTED');
      expect(pRow.metadata_json).toContain('Fake UTR reference');
    });
  });

  // ==========================================================================
  // 4. JWT BILLING ENDPOINTS & STRICT IDOR ISOLATION
  // ==========================================================================
  describe('4. Central JWT Billing Endpoints & Strict IDOR Isolation', () => {
    it('serves payment gateways via GET /api/v1/billing/gateways', async () => {
      const res = await invokeRoute('GET', '/api/v1/billing/gateways');
      expect(res.handled).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.gateways)).toBe(true);
      const gwIds = res.body.gateways.map((g: any) => g.id);
      expect(gwIds).toContain('youpi_pg');
      expect(gwIds).toContain('stripe');
      expect(gwIds).toContain('upi_manual');
      expect(gwIds).not.toContain('razorpay');
    });

    it('creates checkout session via authenticated POST /api/v1/billing/checkout', async () => {
      const res = await invokeRoute(
        'POST',
        '/api/v1/billing/checkout',
        { authorization: `Bearer ${userAToken}` },
        { planId: 'professional_10', billingCycle: 'ANNUAL', provider: 'simulation' }
      );

      expect(res.handled).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.planId).toBe('professional_10');
    });

    it('submits manual UPI payment via POST /v1/account/payments/upi/submit and returns 409 on duplicate', async () => {
      const utr = `JWT${Date.now()}`;
      const res1 = await invokeRoute(
        'POST',
        '/v1/account/payments/upi/submit',
        { authorization: `Bearer ${userAToken}` },
        { planId: 'professional_10', billingCycle: 'MONTHLY', utr }
      );

      expect(res1.handled).toBe(true);
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.status).toBe('PENDING_VERIFICATION');

      // Duplicate submission returns 409
      const res2 = await invokeRoute(
        'POST',
        '/v1/account/payments/upi/submit',
        { authorization: `Bearer ${userBToken}` },
        { planId: 'professional_10', billingCycle: 'MONTHLY', utr }
      );

      expect(res2.handled).toBe(true);
      expect(res2.status).toBe(409);
      expect(res2.body.error).toContain('UTR_ALREADY_EXISTS');
    });

    it('enforces strict IDOR isolation on invoices and subscriptions between User A and User B', async () => {
      // Create invoice for User A
      await paymentService.activateSubscriptionFromPayment({
        userId: userAId,
        planId: 'professional_50',
        billingCycle: 'MONTHLY',
        amountCents: 299900,
        currency: 'INR',
        provider: 'simulation',
        externalPaymentId: `idor_pay_a_${Date.now()}`,
      });

      // User A can view their invoices
      const resA = await invokeRoute('GET', '/api/v1/billing/invoices', { authorization: `Bearer ${userAToken}` });
      expect(resA.status).toBe(200);
      expect(resA.body.invoices.length).toBe(1);
      expect(resA.body.invoices[0].userId).toBe(userAId);

      // User B cannot see User A's invoices
      const resB = await invokeRoute('GET', '/api/v1/billing/invoices', { authorization: `Bearer ${userBToken}` });
      expect(resB.status).toBe(200);
      expect(resB.body.invoices.length).toBe(0);

      // User A subscription summary
      const subResA = await invokeRoute('GET', '/api/v1/billing/subscription', { authorization: `Bearer ${userAToken}` });
      expect(subResA.status).toBe(200);
      expect(subResA.body.subscription?.planId).toBe('professional_50');

      // User B subscription summary is null
      const subResB = await invokeRoute('GET', '/api/v1/billing/subscription', { authorization: `Bearer ${userBToken}` });
      expect(subResB.status).toBe(200);
      expect(subResB.body.subscription).toBeNull();
    });

    it('serves admin payments list and processes approve/reject via admin routes', async () => {
      const adminSecret = getAdminWebSecret();
      const utr = `ADMINROUTE${Date.now()}`;
      const submitRes = await paymentService.submitManualUpiPayment({
        userId: userAId,
        planId: 'professional_25',
        billingCycle: 'ANNUAL',
        utr,
      });

      // 1. List payments with X-Admin-Secret
      const listRes = await invokeRoute('GET', '/api/v1/admin/payments?status=PENDING_VERIFICATION', {
        'x-admin-secret': adminSecret,
      });
      expect(listRes.status).toBe(200);
      expect(listRes.body.payments).toBeDefined();
      const found = listRes.body.payments.find((p: any) => p.id === submitRes.paymentId);
      expect(found).toBeDefined();

      // 2. Approve payment via admin route
      const approveRes = await invokeRoute(
        'POST',
        `/api/v1/admin/payments/${submitRes.paymentId}/approve`,
        { 'x-admin-secret': adminSecret }
      );
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('SUCCEEDED');

      // 3. Forbidden for non-admin
      const unauthRes = await invokeRoute('POST', `/api/v1/admin/payments/${submitRes.paymentId}/approve`);
      expect(unauthRes.status).toBe(403);
    });

    it('createCheckoutSession computes non-zero authoritative INR paise and USD cents for canonical plans with add-ons', async () => {
      // professional_50 monthly (2999/mo) + 2 extra members (499/mo each) + 10GB proxy (199/mo each) = 5987/mo
      const sessionInr = await paymentService.createCheckoutSession({
        userId: userAId,
        planId: 'professional_50',
        billingCycle: 'MONTHLY',
        currency: 'INR',
        extraMembers: 2,
        extraProxyGb: 10,
      }, 'simulation');
      const expectedMonthly = calculateAuthoritativeOrderTotal({
        planId: 'professional_50',
        billingCycle: 'MONTHLY',
        extraMembers: 2,
        extraProxyGb: 10,
        currency: 'INR',
      }).totalChargeMinor;
      expect(sessionInr.amountCents).toBe(expectedMonthly);
      expect(sessionInr.amountCents).toBe(598700);
      expect(sessionInr.currency).toBe('INR');

      const sessionAnnual = await paymentService.createCheckoutSession({
        userId: userAId,
        planId: 'professional_50',
        billingCycle: 'ANNUAL',
        currency: 'INR',
        extraMembers: 2,
        extraProxyGb: 10,
      }, 'simulation');
      const expectedAnnual = calculateAuthoritativeOrderTotal({
        planId: 'professional_50',
        billingCycle: 'ANNUAL',
        extraMembers: 2,
        extraProxyGb: 10,
        currency: 'INR',
      }).totalChargeMinor;
      expect(sessionAnnual.amountCents).toBe(expectedAnnual);
      expect(sessionAnnual.amountCents).toBe(5385000);
    });

    it('submitManualUpiPayment ignores client amountPaise tampering and enforces authoritative total', async () => {
      const utr = `TAMPER${Date.now()}`;
      const res = await paymentService.submitManualUpiPayment({
        userId: userAId,
        planId: 'professional_10',
        billingCycle: 'MONTHLY',
        amountPaise: 1, // Tampered amount
        utr,
      });

      expect(res.paymentId).toBeDefined();
      const db = getDatabase();
      const record = db.prepare('SELECT amount_cents FROM commercial_payments WHERE id = ?').get(res.paymentId) as any;
      expect(record.amount_cents).toBe(59900); // 599 INR (59900 paise), not 1 paisa!
    });

    it('throws PaymentGatewayNotConfiguredError when gateway keys are missing and test mode is disabled', async () => {
      const oldEnv = process.env.NODE_ENV;
      const oldAllow = process.env.PAYMENT_ALLOW_TEST_ADAPTERS;
      try {
        delete (process.env as any).NODE_ENV;
        delete (process.env as any).PAYMENT_ALLOW_TEST_ADAPTERS;

        const plan = getCommercialPlanById('professional_10')!;
        const stripeAdapter = new StripePaymentAdapter();
        await expect(
          stripeAdapter.createCheckoutSession(
            {
              userId: userAId,
              planId: 'professional_10',
              billingCycle: 'MONTHLY',
              currency: 'INR',
            },
            plan,
            59900
          )
        ).rejects.toThrow(PaymentGatewayNotConfiguredError);

        const razorpayAdapter = new RazorpayPaymentAdapter();
        await expect(
          razorpayAdapter.createCheckoutSession(
            {
              userId: userAId,
              planId: 'professional_10',
              billingCycle: 'MONTHLY',
              currency: 'INR',
            },
            plan,
            59900
          )
        ).rejects.toThrow(PaymentGatewayNotConfiguredError);
      } finally {
        process.env.NODE_ENV = oldEnv;
        if (oldAllow !== undefined) process.env.PAYMENT_ALLOW_TEST_ADAPTERS = oldAllow;
      }
    });

    it('escapes XSS payloads in admin payments table and enforces safe proof URL protocols', () => {
      const html = getWebAdminHtml();
      expect(html).toContain('<script src="/admin-assets/web-admin.js" defer></script>');
      expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
      const scriptSource = fs.readFileSync(
        path.join(process.cwd(), '07_BACKEND', 'server', 'assets', 'web-admin.js'),
        'utf-8'
      );
      expect(scriptSource).toContain('function escapeHtml(str)');
      expect(scriptSource).toContain('escapeHtml(safeProofAsset)');
      expect(scriptSource).toContain('escapeHtml(p.id)');
      expect(scriptSource).toContain("p.metadata.proofAsset.startsWith('https://') || p.metadata.proofAsset.startsWith('/')");
    });
  });

  // ==========================================================================
  // 5. TASK S2-7: YOUPI-PG CUSTOM PAYMENT GATEWAY INTEGRATION
  // ==========================================================================
  describe('5. Task S2-7: YouPI-PG Custom Payment Gateway Integration', () => {
    it('creates YouPI-PG checkout session with authoritative minor units and INR currency', async () => {
      const plan = getCommercialPlanById('professional_10')!;
      const adapter = new YoupiPgPaymentAdapter();
      const session = await adapter.createCheckoutSession(
        {
          userId: userAId,
          planId: 'professional_10',
          billingCycle: 'MONTHLY',
        },
        plan,
        59900
      );

      expect(session.provider).toBe('youpi_pg');
      expect(session.currency).toBe('INR');
      expect(session.amountCents).toBe(59900);
      expect(session.sessionId).toBeDefined();
      expect(session.checkoutUrl).toBeDefined();
      expect(session.checkoutUrl).toContain('/checkout/');
    });

    it('verifies YouPI-PG webhook signature using HMAC-SHA256 and rejects tampered payloads', () => {
      const adapter = new YoupiPgPaymentAdapter();
      const secret = 'whsec_custom_youpi_test_key_123';
      const rawPayload = JSON.stringify({
        id: 'evt_youpi_999',
        event: 'PAYMENT_SUCCESS',
        orderId: 'mahi_ord_12345',
        amount: '599.00',
        currency: 'INR',
        metadata: {
          userId: userAId,
          planId: 'professional_10',
          billingCycle: 'MONTHLY',
        },
      });

      const signature = adapter.signPayload(rawPayload, secret);
      expect(signature.startsWith('sha256=')).toBe(true);

      // Valid signature verifies true
      expect(adapter.verifyWebhookSignature(rawPayload, signature, secret)).toBe(true);

      // Bare hex signature without prefix also verifies true
      const hexOnly = signature.replace('sha256=', '');
      expect(adapter.verifyWebhookSignature(rawPayload, hexOnly, secret)).toBe(true);

      // Tampered payload fails
      expect(adapter.verifyWebhookSignature(rawPayload + 'tampered', signature, secret)).toBe(false);

      // Wrong secret fails
      expect(adapter.verifyWebhookSignature(rawPayload, signature, 'wrong_secret')).toBe(false);
    });

    it('processes YouPI-PG webhook via POST /api/v1/billing/webhook/youpi and activates subscription', async () => {
      const adapter = new YoupiPgPaymentAdapter();
      const orderId = `ord_act_${Date.now()}`;
      const payload = {
        id: `evt_youpi_act_${Date.now()}`,
        event: 'PAYMENT_SUCCESS',
        orderId,
        paymentId: `pay_act_${Date.now()}`,
        amountPaise: 59900,
        currency: 'INR',
        metadata: {
          userId: userBId,
          planId: 'professional_10',
          billingCycle: 'MONTHLY',
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = adapter.signPayload(rawBody);

      const res = await invokeRoute(
        'POST',
        '/api/v1/billing/webhook/youpi',
        {
          'content-type': 'application/json',
          'x-gateway-signature': signature,
        },
        rawBody
      );

      expect(res.handled).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify User B subscription is now active with professional_10
      const subRes = await invokeRoute('GET', '/api/v1/billing/subscription', {
        authorization: `Bearer ${userBToken}`,
      });
      expect(subRes.status).toBe(200);
      expect(subRes.body.subscription?.planId).toBe('professional_10');
      expect(subRes.body.subscription?.status).toBe('ACTIVE');
    });

    it('verifies YouPI order status via GET /api/v1/billing/youpi/status/:orderId', async () => {
      const db = getDatabase();
      const testOrderId = `ord_test_status_${Date.now()}`;
      db.prepare(`
        INSERT INTO commercial_payments (
          id, user_id, plan_id, billing_cycle, amount_cents, currency,
          status, provider, external_payment_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `pay_${testOrderId}`,
        userAId,
        'professional_10',
        'MONTHLY',
        59900,
        'INR',
        'SUCCEEDED',
        'youpi_pg',
        testOrderId,
        new Date().toISOString(),
        new Date().toISOString()
      );

      const res = await invokeRoute('GET', `/api/v1/billing/youpi/status/${testOrderId}`, {
        authorization: `Bearer ${userAToken}`,
      });
      expect(res.handled).toBe(true);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('SUCCEEDED');
    });

    it('enforces authentication and IDOR protection on YouPI order verification endpoints', async () => {
      const db = getDatabase();
      const userAOrderId = `ord_idor_test_${Date.now()}`;
      db.prepare(`
        INSERT INTO commercial_payments (
          id, user_id, plan_id, billing_cycle, amount_cents, currency,
          status, provider, external_payment_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `pay_${userAOrderId}`,
        userAId,
        'professional_10',
        'MONTHLY',
        59900,
        'INR',
        'SUCCEEDED',
        'youpi_pg',
        userAOrderId,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // 1. Unauthenticated GET /api/v1/billing/youpi/status/:orderId returns 401
      const noAuthGet = await invokeRoute('GET', `/api/v1/billing/youpi/status/${userAOrderId}`);
      expect(noAuthGet.handled).toBe(true);
      expect(noAuthGet.status).toBe(401);

      // 2. Unauthenticated POST /api/v1/billing/verify-youpi returns 401
      const noAuthPost = await invokeRoute('POST', '/api/v1/billing/verify-youpi', {}, { orderId: userAOrderId });
      expect(noAuthPost.handled).toBe(true);
      expect(noAuthPost.status).toBe(401);

      // 3. User B attempting to view User A's order returns 403 FORBIDDEN
      const crossUserGet = await invokeRoute('GET', `/api/v1/billing/youpi/status/${userAOrderId}`, {
        authorization: `Bearer ${userBToken}`,
      });
      expect(crossUserGet.handled).toBe(true);
      expect(crossUserGet.status).toBe(403);
      expect(crossUserGet.body.error).toContain('belong to authenticated user');

      // 4. User B attempting to verify User A's order via POST returns 403 FORBIDDEN
      const crossUserPost = await invokeRoute(
        'POST',
        '/api/v1/billing/verify-youpi',
        { authorization: `Bearer ${userBToken}` },
        { orderId: userAOrderId }
      );
      expect(crossUserPost.handled).toBe(true);
      expect(crossUserPost.status).toBe(403);
      expect(crossUserPost.body.error).toContain('belong to authenticated user');

      // 5. User A querying non-existent order returns 404 NOT_FOUND
      const notFoundGet = await invokeRoute('GET', '/api/v1/billing/youpi/status/non_existent_order_99999', {
        authorization: `Bearer ${userAToken}`,
      });
      expect(notFoundGet.handled).toBe(true);
      expect(notFoundGet.status).toBe(404);
    });

    it('outside test mode, YouPI webhook verification returns false when webhook secret is unset', () => {
      const origEnv = process.env.NODE_ENV;
      const origAllow = process.env.PAYMENT_ALLOW_TEST_ADAPTERS;
      const origSec1 = process.env.YOUPI_PG_WEBHOOK_SECRET;
      const origSec2 = process.env.YOUPI_WEBHOOK_SECRET;

      try {
        delete (process.env as any).NODE_ENV;
        delete (process.env as any).PAYMENT_ALLOW_TEST_ADAPTERS;
        delete (process.env as any).YOUPI_PG_WEBHOOK_SECRET;
        delete (process.env as any).YOUPI_WEBHOOK_SECRET;

        const adapter = new YoupiPgPaymentAdapter();
        expect(adapter.webhookSecret).toBe('');
        const verified = adapter.verifyWebhookSignature('{"event":"TEST"}', 'sha256=1234567890abcdef');
        expect(verified).toBe(false);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origAllow !== undefined) process.env.PAYMENT_ALLOW_TEST_ADAPTERS = origAllow;
        if (origSec1 !== undefined) process.env.YOUPI_PG_WEBHOOK_SECRET = origSec1;
        if (origSec2 !== undefined) process.env.YOUPI_WEBHOOK_SECRET = origSec2;
      }
    });

    it('handles live HTTP flow with local mock server and YOUPI_PG_LIVE_CALL=true', async () => {
      const plan = getCommercialPlanById('professional_10')!;
      let serverPort = 0;
      let lastCreatedOrderId = '';

      const server = http.createServer((req, res) => {
        if (req.url === '/api/v1/payments' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const parsed = JSON.parse(body);
            lastCreatedOrderId = parsed.orderId;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                id: 'youpi_pay_live_test_123',
                paymentId: 'youpi_pay_live_test_123',
                orderId: parsed.orderId,
                checkoutUrl: `http://localhost:${serverPort}/checkout/youpi_pay_live_test_123`,
                status: 'INITIATED',
              })
            );
          });
          return;
        }

        if (req.url?.startsWith('/api/v1/payments/') && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'youpi_pay_live_test_123',
              paymentId: 'youpi_pay_live_test_123',
              orderId: lastCreatedOrderId,
              status: 'SUCCESS',
              amount: 599.0,
            })
          );
          return;
        }

        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => server.listen(0, () => resolve()));
      serverPort = (server.address() as any).port;

      const origBaseUrl = process.env.YOUPI_PG_BASE_URL;
      const origKey = process.env.YOUPI_PG_API_KEY;
      const origLive = process.env.YOUPI_PG_LIVE_CALL;

      try {
        process.env.YOUPI_PG_BASE_URL = `http://localhost:${serverPort}`;
        process.env.YOUPI_PG_API_KEY = 'mock_merchant_live_key';
        process.env.YOUPI_PG_LIVE_CALL = 'true';

        const adapter = new YoupiPgPaymentAdapter();
        const session = await adapter.createCheckoutSession(
          {
            userId: userAId,
            planId: 'professional_10',
            billingCycle: 'MONTHLY',
          },
          plan,
          59900
        );

        expect(session.provider).toBe('youpi_pg');
        expect(session.sessionId).toBe('youpi_pay_live_test_123');
        expect(session.checkoutUrl).toBe(`http://localhost:${serverPort}/checkout/youpi_pay_live_test_123`);

        // Insert pending payment into DB to verify via verifyYoupiPgOrder
        const db = getDatabase();
        db.prepare(`
          INSERT INTO commercial_payments (
            id, user_id, plan_id, billing_cycle, amount_cents, currency,
            status, provider, external_payment_id, external_order_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'pay_live_test_123',
          userAId,
          'professional_10',
          'MONTHLY',
          59900,
          'INR',
          'PENDING',
          'youpi_pg',
          'youpi_pay_live_test_123',
          session.orderId,
          new Date().toISOString(),
          new Date().toISOString()
        );

        const verifyRes = await paymentService.verifyYoupiPgOrder('youpi_pay_live_test_123', userAId);
        expect(verifyRes.success).toBe(true);
        expect(verifyRes.status).toBe('SUCCEEDED');
        expect(verifyRes.subscription?.planId).toBe('professional_10');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        if (origBaseUrl !== undefined) process.env.YOUPI_PG_BASE_URL = origBaseUrl;
        else delete process.env.YOUPI_PG_BASE_URL;
        if (origKey !== undefined) process.env.YOUPI_PG_API_KEY = origKey;
        else delete process.env.YOUPI_PG_API_KEY;
        if (origLive !== undefined) process.env.YOUPI_PG_LIVE_CALL = origLive;
        else delete process.env.YOUPI_PG_LIVE_CALL;
      }
    });

    it('remote router accepts x-gateway-signature on /api/v1/remote/billing/webhook/youpi', async () => {
      const adapter = new YoupiPgPaymentAdapter();
      const payload = {
        id: `evt_remote_youpi_${Date.now()}`,
        event: 'PAYMENT_SUCCESS',
        orderId: `ord_remote_${Date.now()}`,
        paymentId: `pay_remote_${Date.now()}`,
        amountPaise: calculateAuthoritativeOrderTotal({ planId: 'professional_25', billingCycle: 'ANNUAL' }).totalChargeMinor,
        currency: 'INR',
        metadata: {
          userId: userBId,
          planId: 'professional_25',
          billingCycle: 'ANNUAL',
        },
      };
      const rawBody = JSON.stringify(payload);
      const signature = adapter.signPayload(rawBody);

      const { req, res, getResponse } = createMockReqRes(
        'POST',
        '/api/v1/remote/billing/webhook/youpi',
        {
          'content-type': 'application/json',
          'x-gateway-signature': signature,
        },
        rawBody
      );

      const handled = await handleRemoteApiRequest(req, res);
      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(200);
      expect(resp.body.success).toBe(true);
    });

    it('throws PaymentGatewayNotConfiguredError for YouPI when production keys are missing and test mode is disabled', async () => {
      const origEnv = process.env.NODE_ENV;
      const origAllow = process.env.PAYMENT_ALLOW_TEST_ADAPTERS;
      const origUrl = process.env.YOUPI_PG_BASE_URL;
      const origKey = process.env.YOUPI_PG_API_KEY;
      const origSec = process.env.YOUPI_PG_SECRET;

      try {
        delete (process.env as any).NODE_ENV;
        delete (process.env as any).PAYMENT_ALLOW_TEST_ADAPTERS;
        delete (process.env as any).YOUPI_PG_BASE_URL;
        delete (process.env as any).YOUPI_PG_API_KEY;
        delete (process.env as any).YOUPI_PG_SECRET;

        const plan = getCommercialPlanById('professional_10')!;
        const adapter = new YoupiPgPaymentAdapter();
        await expect(
          adapter.createCheckoutSession(
            { userId: userAId, planId: 'professional_10', billingCycle: 'MONTHLY' },
            plan,
            59900
          )
        ).rejects.toThrow(PaymentGatewayNotConfiguredError);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origAllow !== undefined) process.env.PAYMENT_ALLOW_TEST_ADAPTERS = origAllow;
        if (origUrl !== undefined) process.env.YOUPI_PG_BASE_URL = origUrl;
        if (origKey !== undefined) process.env.YOUPI_PG_API_KEY = origKey;
        if (origSec !== undefined) process.env.YOUPI_PG_SECRET = origSec;
      }
    });
  });
});
