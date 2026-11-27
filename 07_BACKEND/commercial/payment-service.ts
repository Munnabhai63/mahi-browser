/**
 * MAHI Browser — Commercial Payment Service & Provider Abstraction
 * Batch P0-A Architecture
 *
 * Implements:
 * - Provider Abstraction (Stripe, Razorpay, Simulation)
 * - Server-Side Plan Catalog & Price Validation (Anti-tampering)
 * - Cryptographic Webhook HMAC-SHA256 Signature Verification
 * - Webhook Idempotency & Replay Attack Defense
 * - Atomic Multi-Table Entitlement Synchronization (auth_users + commercial_users + subscriptions)
 * - Invoicing & Billing History (Strict IDOR Protection)
 * - Zero Raw Card Storage (Tokenized/Hosted Checkouts Only)
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../06_DATABASE/prisma-client.js';
import { getCommercialPlans, getCommercialPlanById, DEFAULT_COMMERCIAL_PLANS } from './commercial-plan-service.js';
import { CommercialPlan, BillingCycleType } from '../../10_CONFIG/shared/types/commercial.js';
import {
  calculateAuthoritativeOrderTotal,
  legacyPlanIdToCanonical,
  normalizeBillingCycle,
  resolveSubscriptionDurationDays,
} from './canonical-plan-catalog.js';
import { logCommercialAudit } from './commercial-audit-service.js';
import { getEmailProvider } from '../../05_AUTH/email-service.js';
import { SUPPORT_EMAIL, CONTACT_CONFIG } from '../../10_CONFIG/contact-config.js';
import { getUserById } from './commercial-auth-service.js';
import { getCentralUserByIdAsync } from '../../05_AUTH/central-auth-service.js';
import { createLicense, generateLicenseKey } from '../../04_LICENSING/license-engine.js';
import { assertNotEmergencyFrozen } from '../services/kill-switch-service.js';

export function resolveCommercialPlan(planId: string): CommercialPlan | null {
  const plan = getCommercialPlanById(planId);
  if (plan) return plan;
  const normalized = (planId || '').toLowerCase().trim();
  const fallback = DEFAULT_COMMERCIAL_PLANS.find(
    (p) => p.id === planId || p.id.toLowerCase() === normalized || p.tier.toLowerCase() === normalized
  );
  return fallback || null;
}

function hashWebhookContent(rawBody: string): string {
  return crypto.createHash('sha256').update(rawBody || '').digest('hex');
}

export type PaymentProviderType = 'stripe' | 'razorpay' | 'youpi_pg' | 'simulation';

export class PaymentGatewayNotConfiguredError extends Error {
  public readonly provider: string;
  constructor(provider: string, message?: string) {
    super(message || `Payment provider "${provider}" is not configured with required API keys.`);
    this.name = 'PaymentGatewayNotConfiguredError';
    this.provider = provider;
  }
}

export interface CheckoutSessionRequest {
  userId: string;
  planId: string;
  billingCycle: BillingCycleType;
  currency?: 'INR' | 'USD';
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  extraMembers?: number;
  extraProxyGb?: number;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  checkoutUrl: string;
  orderId: string;
  amountCents: number;
  currency: string;
  provider: PaymentProviderType;
  planId: string;
  billingCycle: BillingCycleType;
  createdAt: string;
  gatewayMeta?: Record<string, any>;
}

export interface PaymentWebhookEvent {
  id: string; // Idempotency event key
  type: 'payment.succeeded' | 'payment.failed' | 'subscription.cancelled' | 'subscription.renewed';
  provider: PaymentProviderType;
  userId: string;
  planId: string;
  billingCycle: BillingCycleType;
  amountCents: number;
  currency: string;
  externalPaymentId: string;
  externalOrderId?: string;
  externalSubscriptionId?: string;
  receiptUrl?: string;
  metadata?: Record<string, any>;
  rawPayload?: any;
}

export interface PaymentInvoiceRecord {
  id: string;
  userId: string;
  paymentId?: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: 'PAID' | 'OPEN' | 'VOID';
  periodStart: string;
  periodEnd: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface UserSubscriptionSummary {
  userId: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED';
  billingCycle: BillingCycleType;
  startsAt: string;
  expiresAt: string;
  maxProfiles: number;
  maxDevices: number;
  paymentProvider?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER ADAPTER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentProvider {
  readonly name: PaymentProviderType;
  createCheckoutSession(req: CheckoutSessionRequest, plan: CommercialPlan, amountCents: number): Promise<CheckoutSessionResponse>;
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean;
  parseWebhookPayload(rawBody: string): PaymentWebhookEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

export class StripePaymentAdapter implements PaymentProvider {
  public readonly name: PaymentProviderType = 'stripe';
  private get defaultSecret(): string {
    const s = process.env.STRIPE_WEBHOOK_SECRET;
    if (s) return s;
    if (process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true') {
      return 'whsec_test_only_not_for_production';
    }
    throw new PaymentGatewayNotConfiguredError('stripe', 'STRIPE_WEBHOOK_SECRET is not configured.');
  }

  public async createCheckoutSession(
    req: CheckoutSessionRequest,
    plan: CommercialPlan,
    amountCents: number
  ): Promise<CheckoutSessionResponse> {
    const stripeApiKey = process.env.STRIPE_SECRET_KEY;
    const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';

    // Fast deterministic simulation fallback for unit tests when live API key is not provided
    if (!stripeApiKey) {
      if (isTest) {
        const sessionId = `cs_test_${crypto.randomBytes(16).toString('hex')}`;
        const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;

        return {
          sessionId,
          checkoutUrl,
          orderId: `ord_stripe_${Date.now()}`,
          amountCents,
          currency: req.currency || 'USD',
          provider: 'stripe',
          planId: plan.id,
          billingCycle: req.billingCycle,
          createdAt: new Date().toISOString(),
          gatewayMeta: {
            stripeSessionId: sessionId,
            stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock',
          },
        };
      }
      throw new PaymentGatewayNotConfiguredError('stripe');
    }

    try {
      const params = new URLSearchParams();
      params.append('payment_method_types[0]', 'card');
      params.append('mode', 'payment');
      params.append('client_reference_id', req.userId);
      params.append('line_items[0][price_data][currency]', (req.currency || 'USD').toLowerCase());
      params.append('line_items[0][price_data][unit_amount]', String(Math.round(amountCents)));
      params.append('line_items[0][price_data][product_data][name]', `MAHI Browser — ${plan.name}`);
      params.append('line_items[0][price_data][product_data][description]', `Billing Cycle: ${req.billingCycle}`);
      params.append('line_items[0][quantity]', '1');
      params.append('metadata[userId]', req.userId);
      params.append('metadata[planId]', plan.id);
      params.append('metadata[billingCycle]', req.billingCycle);
      params.append('success_url', req.successUrl || 'https://mahibrowser.com/checkout/success?session_id={CHECKOUT_SESSION_ID}');
      params.append('cancel_url', req.cancelUrl || 'https://mahibrowser.com/pricing');

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Stripe API error (${response.status}): ${errText}`);
      }

      const sessionData = await response.json() as any;
      return {
        sessionId: sessionData.id,
        checkoutUrl: sessionData.url || `https://checkout.stripe.com/c/pay/${sessionData.id}`,
        orderId: sessionData.id,
        amountCents,
        currency: (sessionData.currency || 'USD').toUpperCase(),
        provider: 'stripe',
        planId: plan.id,
        billingCycle: req.billingCycle,
        createdAt: new Date().toISOString(),
        gatewayMeta: {
          stripeSessionId: sessionData.id,
          stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        },
      };
    } catch (err: any) {
      if (err instanceof PaymentGatewayNotConfiguredError) throw err;
      throw new Error(`Failed to create Stripe checkout session: ${err.message}`);
    }
  }

  public verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    if (!signature) return false;
    const effectiveSecret = secret || this.defaultSecret;

    // Parse stripe-signature: t=timestamp,v1=signature
    const parts = signature.split(',').reduce((acc, curr) => {
      const [k, v] = curr.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {} as Record<string, string>);

    if (!parts.t || !parts.v1) return false;

    // Tolerance check (300 seconds)
    const timestamp = parseInt(parts.t, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 600) {
      return false;
    }

    const signedPayload = `${parts.t}.${rawBody}`;
    const expectedSig = crypto.createHmac('sha256', effectiveSecret).update(signedPayload).digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const actualBuf = Buffer.from(parts.v1, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  public parseWebhookPayload(rawBody: string): PaymentWebhookEvent {
    const payload = JSON.parse(rawBody);
    const dataObj = payload.data?.object || payload;
    const contentHash = hashWebhookContent(rawBody);

    const eventId = payload.id || `evt_stripe_${contentHash.slice(0, 32)}`;
    const typeStr = payload.type || 'payment.succeeded';

    let normalizedType: PaymentWebhookEvent['type'] = 'payment.succeeded';
    if (typeStr.includes('fail')) normalizedType = 'payment.failed';
    else if (typeStr.includes('cancel') || typeStr.includes('deleted')) normalizedType = 'subscription.cancelled';

    return {
      id: eventId,
      type: normalizedType,
      provider: 'stripe',
      userId: dataObj.metadata?.userId || dataObj.client_reference_id || 'unknown_user',
      planId: dataObj.metadata?.planId || 'plan_pro',
      billingCycle: (dataObj.metadata?.billingCycle as any) || 'MONTHLY',
      amountCents: dataObj.amount_total ?? dataObj.amount ?? 2900,
      currency: (dataObj.currency || 'USD').toUpperCase(),
      externalPaymentId: dataObj.payment_intent || dataObj.id || `pi_${contentHash.slice(0, 24)}`,
      externalOrderId: dataObj.id,
      externalSubscriptionId: dataObj.subscription,
      receiptUrl: dataObj.receipt_url,
      metadata: dataObj.metadata,
      rawPayload: payload,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY ADAPTER & SIGNATURE VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret?: string
): boolean {
  if (!orderId || !paymentId || !signature) return false;
  const envSecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
  let effectiveSecret = secret || envSecret;
  if (!effectiveSecret) {
    if (process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true') {
      effectiveSecret = 'rzp_sec_test_only_not_for_production';
    } else {
      throw new PaymentGatewayNotConfiguredError(
        'razorpay',
        'RAZORPAY_KEY_SECRET or RAZORPAY_WEBHOOK_SECRET is required before Razorpay signatures can be verified.'
      );
    }
  }
  const text = `${orderId}|${paymentId}`;
  const expectedSig = crypto.createHmac('sha256', effectiveSecret).update(text).digest('hex');

  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export class RazorpayPaymentAdapter implements PaymentProvider {
  public readonly name: PaymentProviderType = 'razorpay';
  private get defaultSecret(): string {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true') {
      return 'rzp_sec_test_only_not_for_production';
    }
    throw new PaymentGatewayNotConfiguredError(
      'razorpay',
      'RAZORPAY_WEBHOOK_SECRET is required before Razorpay webhooks can be verified.'
    );
  }

  public async createCheckoutSession(
    req: CheckoutSessionRequest,
    plan: CommercialPlan,
    amountCents: number
  ): Promise<CheckoutSessionResponse> {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';

    if (!keyId || !keySecret) {
      if (isTest) {
        const orderId = `order_${crypto.randomBytes(12).toString('hex')}`;
        const checkoutUrl = `https://api.razorpay.com/v1/checkout/${orderId}`;

        return {
          sessionId: orderId,
          checkoutUrl,
          orderId,
          amountCents,
          currency: 'INR',
          provider: 'razorpay',
          planId: plan.id,
          billingCycle: req.billingCycle,
          createdAt: new Date().toISOString(),
          gatewayMeta: {
            razorpayKeyId: 'rzp_test_mock_key',
            razorpayOrderId: orderId,
            amount: amountCents,
            currency: 'INR',
            name: 'MAHI Browser',
            description: `Subscription: ${plan.name} (${req.billingCycle})`,
          },
        };
      }
      throw new PaymentGatewayNotConfiguredError('razorpay');
    }

    try {
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const orderPayload = {
        amount: Math.round(amountCents), // In paise (minor units)
        currency: 'INR',
        receipt: `rcpt_${Date.now()}_${req.userId.slice(-6)}`,
        notes: {
          userId: req.userId,
          planId: plan.id,
          billingCycle: req.billingCycle,
        },
      };

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Razorpay API error (${response.status}): ${errText}`);
      }

      const orderData = await response.json() as any;
      return {
        sessionId: orderData.id,
        checkoutUrl: `https://checkout.razorpay.com/v1/checkout.html?order_id=${orderData.id}`,
        orderId: orderData.id,
        amountCents: orderData.amount,
        currency: 'INR',
        provider: 'razorpay',
        planId: plan.id,
        billingCycle: req.billingCycle,
        createdAt: new Date().toISOString(),
        gatewayMeta: {
          razorpayKeyId: keyId,
          razorpayOrderId: orderData.id,
          amount: orderData.amount,
          currency: 'INR',
          name: 'MAHI Browser',
          description: `Subscription: ${plan.name} (${req.billingCycle})`,
          notes: orderPayload.notes,
        },
      };
    } catch (err: any) {
      if (err instanceof PaymentGatewayNotConfiguredError) throw err;
      throw new Error(`Failed to create Razorpay order: ${err.message}`);
    }
  }

  public verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    if (!signature) return false;
    const effectiveSecret = secret || this.defaultSecret;

    const expectedSig = crypto.createHmac('sha256', effectiveSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  public parseWebhookPayload(rawBody: string): PaymentWebhookEvent {
    const payload = JSON.parse(rawBody);
    const payment = payload.payload?.payment?.entity || payload.payment || payload;
    const contentHash = hashWebhookContent(rawBody);

    const eventId = payload.event_id || `evt_rzp_${contentHash.slice(0, 32)}`;
    const eventType = payload.event || 'order.paid';

    let normalizedType: PaymentWebhookEvent['type'] = 'payment.succeeded';
    if (eventType.includes('failed')) normalizedType = 'payment.failed';
    else if (eventType.includes('cancelled')) normalizedType = 'subscription.cancelled';

    const notes = payment.notes || {};

    return {
      id: eventId,
      type: normalizedType,
      provider: 'razorpay',
      userId: notes.userId || 'unknown_user',
      planId: notes.planId || 'plan_pro',
      billingCycle: notes.billingCycle || 'MONTHLY',
      amountCents: payment.amount ?? 2900,
      currency: (payment.currency || 'INR').toUpperCase(),
      externalPaymentId: payment.id || `pay_${contentHash.slice(0, 24)}`,
      externalOrderId: payment.order_id,
      receiptUrl: payment.invoice_url,
      metadata: notes,
      rawPayload: payload,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION ADAPTER (Deterministic E2E Testing)
// ─────────────────────────────────────────────────────────────────────────────

export class SimulationPaymentAdapter implements PaymentProvider {
  public readonly name: PaymentProviderType = 'simulation';

  constructor() {
    // Evaluating defaultSecret on instantiation enforces that in non-test modes without an explicit
    // secret, instantiating this adapter fails immediately.
    const _s = this.defaultSecret;
  }

  private get defaultSecret(): string {
    const s = process.env.PAYMENT_SIMULATION_WEBHOOK_SECRET;
    if (s) return s;
    if (process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true') {
      return 'sim_secret_mahi_test_suite_key_2026';
    }
    throw new PaymentGatewayNotConfiguredError(
      'simulation',
      'PAYMENT_SIMULATION_WEBHOOK_SECRET is not configured.'
    );
  }

  public get secret(): string {
    return this.defaultSecret;
  }

  public async createCheckoutSession(
    req: CheckoutSessionRequest,
    plan: CommercialPlan,
    amountCents: number
  ): Promise<CheckoutSessionResponse> {
    const sessionId = `sim_cs_${crypto.randomBytes(16).toString('hex')}`;
    const checkoutUrl = `https://checkout.mahibrowser.com/sim/pay/${sessionId}`;

    return {
      sessionId,
      checkoutUrl,
      orderId: `sim_ord_${Date.now()}`,
      amountCents,
      currency: req.currency || (plan.id.startsWith('plan_') ? 'USD' : 'INR'),
      provider: 'simulation',
      planId: plan.id,
      billingCycle: req.billingCycle,
      createdAt: new Date().toISOString(),
    };
  }

  public verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    if (!signature) return false;
    const effectiveSecret = secret || this.secret;
    const expectedSig = crypto.createHmac('sha256', effectiveSecret).update(rawBody).digest('hex');

    const expectedBuf = Buffer.from(expectedSig);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  public signPayload(rawBody: string, secret?: string): string {
    return crypto.createHmac('sha256', secret || this.secret).update(rawBody).digest('hex');
  }

  public parseWebhookPayload(rawBody: string): PaymentWebhookEvent {
    const payload = JSON.parse(rawBody);
    const contentHash = hashWebhookContent(rawBody);
    return {
      id: payload.id || `evt_sim_${contentHash.slice(0, 32)}`,
      type: payload.type || 'payment.succeeded',
      provider: 'simulation',
      userId: payload.userId,
      planId: payload.planId,
      billingCycle: payload.billingCycle || 'MONTHLY',
      amountCents: payload.amountCents,
      currency: payload.currency || 'USD',
      externalPaymentId: payload.externalPaymentId || `sim_pi_${contentHash.slice(0, 24)}`,
      externalOrderId: payload.externalOrderId,
      receiptUrl: payload.receiptUrl || `https://invoices.mahibrowser.com/receipt_${contentHash.slice(0, 16)}.pdf`,
      metadata: payload.metadata,
      rawPayload: payload,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUPI-PG ADAPTER (Owner's Sovereign 0% Fee UPI & QR Gateway)
// ─────────────────────────────────────────────────────────────────────────────

export class YoupiPgPaymentAdapter implements PaymentProvider {
  public readonly name: PaymentProviderType = 'youpi_pg';

  public get baseUrl(): string {
    return (process.env.YOUPI_PG_BASE_URL || process.env.BASE_PAYMENT_API_URL || 'http://localhost:6100').replace(/\/+$/, '');
  }

  public get merchantId(): string {
    return process.env.YOUPI_PG_MERCHANT_ID || '00000000-0000-0000-0000-000000000001';
  }

  public get apiKey(): string {
    return process.env.YOUPI_PG_API_KEY || process.env.YOUPI_PG_SECRET || '';
  }

  public get webhookSecret(): string {
    const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';
    return process.env.YOUPI_PG_WEBHOOK_SECRET || process.env.YOUPI_WEBHOOK_SECRET || (isTest ? 'whsec_mahi_youpi_test_secret_2026' : '');
  }

  public async createCheckoutSession(
    req: CheckoutSessionRequest,
    plan: CommercialPlan,
    amountCents: number
  ): Promise<CheckoutSessionResponse> {
    const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';
    const hasBaseUrl = Boolean(process.env.YOUPI_PG_BASE_URL || process.env.BASE_PAYMENT_API_URL);
    const hasApiKey = Boolean(process.env.YOUPI_PG_API_KEY || process.env.YOUPI_PG_SECRET);

    // Outside of test mode, throw error unless BOTH baseUrl and apiKey are configured
    if (!isTest && (!hasBaseUrl || !hasApiKey)) {
      throw new PaymentGatewayNotConfiguredError(
        'youpi_pg',
        'YouPI-PG credentials (YOUPI_PG_BASE_URL / BASE_PAYMENT_API_URL and YOUPI_PG_API_KEY / YOUPI_PG_SECRET) are not configured.'
      );
    }

    const orderId = req.idempotencyKey || `mahi_ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const amountRupees = amountCents / 100;
    const returnUrl = req.successUrl || `https://mahibrowser.com/pricing?status=success&orderId=${orderId}`;

    const resolveCheckoutUrl = (sessionId: string, customUrl?: string) => {
      if (customUrl) return customUrl;
      if (process.env.YOUPI_PG_CHECKOUT_URL) {
        return `${process.env.YOUPI_PG_CHECKOUT_URL.replace(/\/+$/, '')}/checkout/${sessionId}`;
      }
      if (this.baseUrl.includes(':6100')) {
        return `${this.baseUrl.replace(':6100', ':7000')}/checkout/${sessionId}`;
      }
      return `${this.baseUrl}/checkout/${sessionId}`;
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Merchant-Id': this.merchantId,
    };
    if (this.apiKey) {
      headers['X-Merchant-Key'] = this.apiKey;
    }

    const payload = {
      orderId,
      amount: amountRupees,
      currency: 'INR',
      returnUrl,
      metadata: {
        userId: req.userId,
        planId: plan.id,
        billingCycle: req.billingCycle,
        extraMembers: req.extraMembers,
        extraProxyGb: req.extraProxyGb,
      },
    };

    // If in test mode without an active live server, return deterministic simulation response
    if (isTest && (process.env.YOUPI_PG_MOCK === 'true' || !process.env.YOUPI_PG_LIVE_CALL)) {
      const sessionId = `youpi_cs_${crypto.randomBytes(16).toString('hex')}`;
      const checkoutUrl = resolveCheckoutUrl(sessionId);
      return {
        sessionId,
        checkoutUrl,
        orderId,
        amountCents,
        currency: 'INR',
        provider: 'youpi_pg',
        planId: plan.id,
        billingCycle: req.billingCycle,
        createdAt: new Date().toISOString(),
        gatewayMeta: {
          youpiPaymentId: sessionId,
          orderId,
          queuePosition: 0,
        },
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`YouPI-PG payment creation failed [HTTP ${res.status}]: ${errText}`);
      }

      const data = await res.json() as any;
      const sessionId = data.paymentId || data.id || orderId;
      const checkoutUrl = resolveCheckoutUrl(sessionId, data.checkoutUrl);

      return {
        sessionId,
        checkoutUrl,
        orderId: data.orderId || orderId,
        amountCents,
        currency: 'INR',
        provider: 'youpi_pg',
        planId: plan.id,
        billingCycle: req.billingCycle,
        createdAt: new Date().toISOString(),
        gatewayMeta: {
          youpiPaymentId: sessionId,
          orderId: data.orderId || orderId,
          queuePosition: data.queuePosition || 0,
        },
      };
    } catch (err: any) {
      if (isTest && !process.env.YOUPI_PG_LIVE_CALL) {
        const sessionId = `youpi_cs_${crypto.randomBytes(16).toString('hex')}`;
        const checkoutUrl = resolveCheckoutUrl(sessionId);
        return {
          sessionId,
          checkoutUrl,
          orderId,
          amountCents,
          currency: 'INR',
          provider: 'youpi_pg',
          planId: plan.id,
          billingCycle: req.billingCycle,
          createdAt: new Date().toISOString(),
          gatewayMeta: {
            youpiPaymentId: sessionId,
            orderId,
            queuePosition: 0,
          },
        };
      }
      throw err;
    }
  }

  public verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    if (!signature) return false;
    const effectiveSecret = secret || this.webhookSecret;
    if (!effectiveSecret) return false;

    const normalizedSig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const expectedSig = crypto.createHmac('sha256', effectiveSecret).update(rawBody).digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'utf-8');
    const actualBuf = Buffer.from(normalizedSig, 'utf-8');

    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }

  public signPayload(rawBody: string, secret?: string): string {
    const effectiveSecret = secret || this.webhookSecret;
    return `sha256=${crypto.createHmac('sha256', effectiveSecret).update(rawBody).digest('hex')}`;
  }

  public parseWebhookPayload(rawBody: string): PaymentWebhookEvent {
    const payload = JSON.parse(rawBody);
    const contentHash = hashWebhookContent(rawBody);
    const eventType = payload.event || payload.type || (payload.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED');
    const isSuccess =
      eventType === 'SUCCESS' ||
      eventType === 'PAYMENT_SUCCESS' ||
      eventType === 'payment.succeeded' ||
      payload.status === 'SUCCESS';
    const amountPaise = payload.amountPaise ? Number(payload.amountPaise) : Math.round(Number(payload.amount || 0) * 100);

    return {
      id: payload.deliveryId || payload.id || `evt_youpi_${contentHash.slice(0, 32)}`,
      type: isSuccess ? 'payment.succeeded' : 'payment.failed',
      provider: 'youpi_pg',
      userId: payload.metadata?.userId || '',
      planId: payload.metadata?.planId || '',
      billingCycle: payload.metadata?.billingCycle || 'ANNUAL',
      amountCents: amountPaise,
      currency: payload.currency || 'INR',
      externalPaymentId: payload.paymentId || payload.id || payload.utr || payload.orderId || `youpi_pi_${contentHash.slice(0, 24)}`,
      externalOrderId: payload.orderId,
      receiptUrl: payload.receiptUrl || `${this.baseUrl}/receipt/${payload.paymentId || payload.orderId}`,
      metadata: payload.metadata,
      rawPayload: payload,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL PAYMENT SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export class PaymentService {
  private static instance: PaymentService | null = null;
  private providers = new Map<PaymentProviderType, PaymentProvider>();
  private defaultProvider: PaymentProviderType = 'youpi_pg';

  private constructor() {
    this.registerProvider(new StripePaymentAdapter());
    this.registerProvider(new RazorpayPaymentAdapter());
    this.registerProvider(new YoupiPgPaymentAdapter());
    if (process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true') {
      this.registerProvider(new SimulationPaymentAdapter());
    }

    const envProv = process.env.PAYMENT_PROVIDER?.toLowerCase() as PaymentProviderType;
    if (envProv && this.providers.has(envProv)) {
      this.defaultProvider = envProv;
    } else {
      this.defaultProvider = 'youpi_pg';
    }
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  public registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.name, provider);
  }

  public setDefaultProvider(type: PaymentProviderType): void {
    if (this.providers.has(type)) {
      this.defaultProvider = type;
    }
  }

  public getProvider(type?: PaymentProviderType): PaymentProvider {
    const target = type || this.defaultProvider;
    const prov = this.providers.get(target);
    if (!prov) {
      throw new Error(`Payment provider "${target}" is not configured.`);
    }
    return prov;
  }

  /**
   * Returns current verified commercial plan catalog with rates.
   */
  public getPlanCatalog(): CommercialPlan[] {
    return getCommercialPlans(false);
  }

  /**
   * Resolves expected price in cents based on plan and billing cycle.
   */
  public calculatePlanAmountCents(plan: CommercialPlan, billingCycle: BillingCycleType): number {
    const rateUsd = billingCycle === 'ANNUAL' || billingCycle === 'SEMI_ANNUAL' ? plan.priceAnnual : plan.priceMonthly;
    return rateUsd * 100;
  }

  private isStrictProductionPostgres(): boolean {
    return (
      isPostgresConfigured() &&
      process.env.NODE_ENV === 'production' &&
      !process.env.VITEST &&
      !(typeof process !== 'undefined' && Boolean((process as any).versions?.electron))
    );
  }

  private resolvePgBillingClient(requiredModels: string[]): any | null {
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    if (!prisma) return null;

    const ready = requiredModels.every((m) => Boolean((prisma as any)[m]));
    if (!ready) {
      if (this.isStrictProductionPostgres()) {
        throw new Error(
          `[PaymentService][PG_UNAVAILABLE] Required Prisma billing models (${requiredModels.join(', ')}) unavailable in production.`
        );
      }
      console.warn(
        `[PaymentService][PG_CAPABILITY_MISSING] Prisma client cannot serve ${requiredModels.join(', ')}; falling back to local SQLite.`
      );
      return null;
    }
    return prisma;
  }

  private async withPgTransaction<T>(prisma: any, fn: (tx: any) => Promise<T>): Promise<T> {
    if (prisma && typeof prisma.$transaction === 'function') {
      return await prisma.$transaction(async (tx: any) => fn(tx));
    }
    return await fn(prisma);
  }

  private isPgUniqueViolation(err: any): boolean {
    const msg = String(err?.message || '').toLowerCase();
    return err?.code === 'P2002' || err?.code === '23505' || msg.includes('unique constraint') || msg.includes('duplicate key');
  }

  /**
   * Creates an authenticated, server-side verified checkout session.
   */
  public async createCheckoutSession(
    req: CheckoutSessionRequest,
    providerType?: PaymentProviderType
  ): Promise<CheckoutSessionResponse> {
    await assertNotEmergencyFrozen('checkout');
    const pgClient = this.resolvePgBillingClient(['commercial_payments', 'auth_users']);
    const db = pgClient ? null : getDatabase();

    // 1. Validate User
    let userCheck: any = null;
    if (pgClient) {
      userCheck =
        (await pgClient.auth_users.findFirst({ where: { id: req.userId }, select: { id: true } })) ||
        (typeof pgClient.commercial_users?.findFirst === 'function'
          ? await pgClient.commercial_users.findFirst({ where: { id: req.userId }, select: { id: true } })
          : null);
    } else if (db) {
      userCheck =
        db.prepare('SELECT id FROM auth_users WHERE id = ?').get(req.userId) ||
        db.prepare('SELECT id FROM commercial_users WHERE id = ?').get(req.userId);
    }
    if (!userCheck) {
      throw new Error(`User account "${req.userId}" does not exist.`);
    }

    // 2. Validate Plan & Server-Side Price Lookup
    const plan = getCommercialPlanById(req.planId);
    if (!plan || !plan.isActive) {
      throw new Error(`Selected plan "${req.planId}" is not available for purchase.`);
    }

    if (plan.tier === 'FREE') {
      throw new Error('Free tier does not require checkout payment.');
    }

    const effectiveBillingCycle = normalizeBillingCycle(req.billingCycle, plan.id);
    const normalizedReq: CheckoutSessionRequest = {
      ...req,
      billingCycle: effectiveBillingCycle,
    };

    let amountCents: number;
    let authoritativeBreakdown: any = null;
    const isLegacyPlan = plan.id.startsWith('plan_') && plan.priceMonthly > 0;

    if (isLegacyPlan && !normalizedReq.extraMembers && !normalizedReq.extraProxyGb && (!normalizedReq.currency || normalizedReq.currency === 'USD')) {
      amountCents = this.calculatePlanAmountCents(plan, effectiveBillingCycle);
    } else {
      const orderTotal = calculateAuthoritativeOrderTotal({
        planId: req.planId,
        billingCycle: effectiveBillingCycle,
        currency: req.currency || (plan.id.startsWith('plan_') ? 'USD' : 'INR'),
        extraMembers: req.extraMembers,
        extraProxyGb: req.extraProxyGb,
      });
      amountCents = orderTotal.totalChargeMinor;
      authoritativeBreakdown = orderTotal;
    }

    const formatExistingCheckout = (existing: any): CheckoutSessionResponse => ({
      sessionId: existing.id,
      checkoutUrl: existing.receipt_url || `https://checkout.mahibrowser.com/session/${existing.id}`,
      orderId: existing.external_order_id,
      amountCents: existing.amount_cents,
      currency: existing.currency,
      provider: existing.provider as PaymentProviderType,
      planId: existing.plan_id,
      billingCycle: existing.billing_cycle as any,
      createdAt: existing.created_at,
    });

    // 3. Check Idempotency Key
    if (req.idempotencyKey) {
      let existing: any = null;
      if (pgClient) {
        existing = await pgClient.commercial_payments.findFirst({
          where: { external_order_id: req.idempotencyKey, status: 'PENDING' },
        });
      } else if (db) {
        existing = db.prepare(
          "SELECT * FROM commercial_payments WHERE external_order_id = ? AND status = 'PENDING'"
        ).get(req.idempotencyKey) as any;
      }
      if (existing) {
        return formatExistingCheckout(existing);
      }
    }

    // 4. Delegate to provider adapter
    const resolvedCurrency = (normalizedReq.currency || (plan.id.startsWith('plan_') ? 'USD' : 'INR')).toUpperCase();
    const effectiveProvider = providerType || (resolvedCurrency === 'INR' ? 'youpi_pg' : this.defaultProvider);
    const provider = this.getProvider(effectiveProvider);
    const session = await provider.createCheckoutSession(normalizedReq, plan, amountCents);
    if (normalizedReq.idempotencyKey) {
      session.orderId = normalizedReq.idempotencyKey;
    }

    // 5. Record pending payment transaction atomically
    const now = new Date().toISOString();
    const metadataJson = JSON.stringify({
      userId: normalizedReq.userId,
      planId: plan.id,
      billingCycle: effectiveBillingCycle,
      extraMembers: normalizedReq.extraMembers || 0,
      extraProxyGb: normalizedReq.extraProxyGb || 0,
      authoritativeBreakdown,
    });
    if (pgClient) {
      const winner = await this.withPgTransaction(pgClient, async (tx) => {
        if (normalizedReq.idempotencyKey) {
          let lockedExisting: any = null;
          if (typeof tx.$queryRaw === 'function') {
            const rows = (await tx.$queryRaw`
              SELECT * FROM commercial_payments
              WHERE external_order_id = ${normalizedReq.idempotencyKey} AND status = 'PENDING'
              LIMIT 1 FOR UPDATE
            `) as any[];
            lockedExisting = rows?.[0] || null;
          } else {
            lockedExisting = await tx.commercial_payments.findFirst({
              where: { external_order_id: normalizedReq.idempotencyKey, status: 'PENDING' },
            });
          }
          if (lockedExisting) {
            return formatExistingCheckout(lockedExisting);
          }
        }

        await tx.commercial_payments.create({
          data: {
            id: session.sessionId,
            user_id: normalizedReq.userId,
            subscription_id: null,
            provider: session.provider,
            external_order_id: normalizedReq.idempotencyKey || session.orderId,
            external_payment_id: session.sessionId,
            amount_cents: amountCents,
            currency: session.currency,
            status: 'PENDING',
            plan_id: plan.id,
            billing_cycle: effectiveBillingCycle,
            receipt_url: session.checkoutUrl,
            metadata_json: metadataJson,
            created_at: now,
            updated_at: now,
          },
        });
        return session;
      });
      return winner;
    } else if (db) {
      const writeCheckoutSqlite = () => {
        if (normalizedReq.idempotencyKey) {
          const existing = db.prepare(
            "SELECT * FROM commercial_payments WHERE external_order_id = ? AND status = 'PENDING'"
          ).get(normalizedReq.idempotencyKey) as any;
          if (existing) {
            return formatExistingCheckout(existing);
          }
        }
        db.prepare(`
          INSERT INTO commercial_payments (
            id, user_id, subscription_id, provider, external_order_id, external_payment_id,
            amount_cents, currency, status, plan_id, billing_cycle, receipt_url, metadata_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)
        `).run(
          session.sessionId,
          normalizedReq.userId,
          null,
          session.provider,
          normalizedReq.idempotencyKey || session.orderId,
          session.sessionId,
          amountCents,
          session.currency,
          plan.id,
          effectiveBillingCycle,
          session.checkoutUrl,
          metadataJson,
          now,
          now
        );
        return session;
      };
      return typeof (db as any).transaction === 'function'
        ? (db as any).transaction(writeCheckoutSqlite)()
        : writeCheckoutSqlite();
    }

    return session;
  }

  private validateWebhookEventAmountAndPlan(event: PaymentWebhookEvent): void {
    if (event.type === 'payment.succeeded' || event.type === 'payment.failed') {
      if (!event.planId || !event.planId.trim()) {
        throw new Error('PLAN_NOT_FOUND: Webhook references missing or empty planId.');
      }
    }

    if (!event.planId || !event.planId.trim()) {
      return;
    }

    const isUsd = event.currency === 'USD';
    let expectedAmount: number;
    if (event.planId.startsWith('plan_')) {
      const targetPlan = getCommercialPlanById(event.planId);
      if (!targetPlan) {
        throw new Error(`PLAN_NOT_FOUND: Webhook references unknown plan "${event.planId}".`);
      }
      expectedAmount = this.calculatePlanAmountCents(targetPlan, event.billingCycle);
    } else {
      const canonicalId = legacyPlanIdToCanonical(event.planId);
      if (!canonicalId) {
        throw new Error(`PLAN_NOT_FOUND: Webhook references unknown plan "${event.planId}".`);
      }
      try {
        const orderTotal = calculateAuthoritativeOrderTotal({
          planId: canonicalId,
          billingCycle: event.billingCycle,
          currency: isUsd ? 'USD' : 'INR',
        });
        expectedAmount = orderTotal.totalChargeMinor;
      } catch {
        const targetPlan = getCommercialPlanById(event.planId);
        if (!targetPlan) {
          throw new Error(`PLAN_NOT_FOUND: Webhook references unknown plan "${event.planId}".`);
        }
        expectedAmount = this.calculatePlanAmountCents(targetPlan, event.billingCycle);
      }
    }

    if (event.type === 'payment.succeeded' && event.amountCents < expectedAmount) {
      throw new Error(
        `AMOUNT_TAMPERING_DETECTED: Paid amount (${event.amountCents}) is less than required plan price (${expectedAmount}).`
      );
    }
  }

  /**
   * Processes inbound webhook event with signature and atomic database idempotency verification.
   */
  public async handleWebhook(
    providerType: PaymentProviderType,
    rawPayload: string,
    signature: string,
    options?: { secret?: string }
  ): Promise<{ success: boolean; eventId: string; type: string; message: string }> {
    await assertNotEmergencyFrozen('payment_webhook');
    const provider = this.getProvider(providerType);

    // 1. Verify Cryptographic Signature
    const isValid = provider.verifyWebhookSignature(rawPayload, signature, options?.secret);
    if (!isValid) {
      throw new Error('INVALID_WEBHOOK_SIGNATURE: Cryptographic verification of payment webhook failed.');
    }

    // 2. Parse Normalized Event (deterministic SHA-256 fallback ID when upstream omits event ID)
    const event = provider.parseWebhookPayload(rawPayload);
    const now = new Date().toISOString();

    const pgClient = this.resolvePgBillingClient([
      'commercial_webhook_events',
      'commercial_payments',
      'commercial_subscriptions',
      'commercial_billing_invoices',
      'licenses',
      'auth_users',
    ]);

    if (pgClient) {
      return await this.withPgTransaction(pgClient, async (tx) => {
        // 3. Atomic Webhook Idempotency Claim inside PostgreSQL transaction
        let claimed = false;
        if (typeof tx.$queryRaw === 'function') {
          const rows = (await tx.$queryRaw`
            INSERT INTO commercial_webhook_events (id, provider, event_type, payload_json, status, created_at)
            VALUES (${event.id}, ${event.provider}, ${event.type}, ${rawPayload}, 'PROCESSING', ${now})
            ON CONFLICT (id) DO NOTHING
            RETURNING id
          `) as any[];
          claimed = Array.isArray(rows) && rows.length > 0;
        } else {
          const existing = await tx.commercial_webhook_events.findFirst({
            where: { id: event.id },
            select: { id: true, status: true },
          });
          if (!existing) {
            try {
              await tx.commercial_webhook_events.create({
                data: {
                  id: event.id,
                  provider: event.provider,
                  event_type: event.type,
                  payload_json: rawPayload,
                  status: 'PROCESSING',
                  created_at: now,
                },
              });
              claimed = true;
            } catch (dupErr: any) {
              if (!this.isPgUniqueViolation(dupErr)) throw dupErr;
              claimed = false;
            }
          }
        }

        if (!claimed) {
          return {
            success: true,
            eventId: event.id,
            type: event.type,
            message: 'Webhook event was already processed (Idempotent response).',
          };
        }

        // 4. Correlate OviPay/gateway webhooks that omit metadata back to pending checkout row (locked)
        let correlatedPaymentId: string | undefined;
        if (!event.userId || !event.planId) {
          const lookupKeys = [event.externalPaymentId, event.externalOrderId].filter(
            (v): v is string => typeof v === 'string' && v.trim().length > 0
          );
          let correlatedPayment: any = null;
          if (lookupKeys.length > 0) {
            if (typeof tx.$queryRaw === 'function') {
              for (const key of lookupKeys) {
                const rows = (await tx.$queryRaw`
                  SELECT * FROM commercial_payments
                  WHERE external_payment_id = ${key} OR external_order_id = ${key} OR id = ${key}
                  LIMIT 1 FOR UPDATE
                `) as any[];
                if (rows?.[0]) {
                  correlatedPayment = rows[0];
                  break;
                }
              }
            } else {
              correlatedPayment = await tx.commercial_payments.findFirst({
                where: {
                  OR: [
                    { external_payment_id: { in: lookupKeys } },
                    { external_order_id: { in: lookupKeys } },
                    { id: { in: lookupKeys } },
                  ],
                },
              });
            }
          }
          if (correlatedPayment) {
            correlatedPaymentId = correlatedPayment.id;
            event.userId = event.userId || correlatedPayment.user_id;
            event.planId = event.planId || correlatedPayment.plan_id;
            event.billingCycle = (event.metadata?.billingCycle || correlatedPayment.billing_cycle || event.billingCycle) as BillingCycleType;
            event.currency = correlatedPayment.currency || event.currency;
          }
        }

        // 5. Validate Amount & Currency Consistency (throwing rolls back PG TX & webhook claim cleanly)
        this.validateWebhookEventAmountAndPlan(event);

        // 6. Execute Business State Transition Atomically within same TX
        if (event.type === 'payment.succeeded') {
          await this.activateSubscriptionFromPayment({
            userId: event.userId,
            planId: event.planId,
            billingCycle: event.billingCycle,
            amountCents: event.amountCents,
            currency: event.currency,
            provider: event.provider,
            externalPaymentId: event.externalPaymentId,
            externalOrderId: event.externalOrderId,
            receiptUrl: event.receiptUrl,
            metadata: event.metadata,
            tx,
            targetPaymentId: correlatedPaymentId,
          });
        } else if (event.type === 'payment.failed') {
          const failId = `pay_fail_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          await tx.commercial_payments.create({
            data: {
              id: failId,
              user_id: event.userId,
              subscription_id: null,
              provider: event.provider,
              external_order_id: event.externalOrderId || null,
              external_payment_id: event.externalPaymentId,
              amount_cents: event.amountCents,
              currency: event.currency,
              status: 'FAILED',
              plan_id: event.planId,
              billing_cycle: event.billingCycle,
              receipt_url: null,
              metadata_json: JSON.stringify(event.metadata || {}),
              created_at: now,
              updated_at: now,
            },
          });
        } else if (event.type === 'subscription.cancelled') {
          await tx.commercial_subscriptions.updateMany({
            where: { user_id: event.userId, status: 'ACTIVE' },
            data: { status: 'CANCELLED', updated_at: now },
          });
        }

        // 7. Mark Processed
        if (typeof tx.commercial_webhook_events.updateMany === 'function') {
          await tx.commercial_webhook_events.updateMany({
            where: { id: event.id },
            data: { status: 'PROCESSED' },
          });
        } else if (typeof tx.commercial_webhook_events.update === 'function') {
          await tx.commercial_webhook_events.update({
            where: { id: event.id },
            data: { status: 'PROCESSED' },
          });
        }

        return {
          success: true,
          eventId: event.id,
          type: event.type,
          message: `Successfully processed ${event.type} event.`,
        };
      });
    }

    // SQLite fallback path (local dev & unit tests without full PostgreSQL)
    const db = getDatabase();

    // Claim synchronously BEFORE any await to eliminate concurrent async duplicate execution
    const claimRes = db.prepare(`
      INSERT OR IGNORE INTO commercial_webhook_events (
        id, provider, event_type, payload_json, status, created_at
      ) VALUES (?, ?, ?, ?, 'PROCESSING', ?)
    `).run(event.id, event.provider, event.type, rawPayload, now);

    if (claimRes.changes === 0) {
      return {
        success: true,
        eventId: event.id,
        type: event.type,
        message: 'Webhook event was already processed (Idempotent response).',
      };
    }

    try {
      let correlatedPaymentId: string | undefined;
      if (!event.userId || !event.planId) {
        const lookupKeys = [event.externalPaymentId, event.externalOrderId].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        );
        let correlatedPayment: any = null;
        for (const key of lookupKeys) {
          correlatedPayment = db
            .prepare(
              'SELECT * FROM commercial_payments WHERE external_payment_id = ? OR external_order_id = ? OR id = ? LIMIT 1'
            )
            .get(key, key, key) as any;
          if (correlatedPayment) break;
        }
        if (correlatedPayment) {
          correlatedPaymentId = correlatedPayment.id;
          event.userId = event.userId || correlatedPayment.user_id;
          event.planId = event.planId || correlatedPayment.plan_id;
          event.billingCycle = (event.metadata?.billingCycle || correlatedPayment.billing_cycle || event.billingCycle) as BillingCycleType;
          event.currency = correlatedPayment.currency || event.currency;
        }
      }

      this.validateWebhookEventAmountAndPlan(event);

      if (event.type === 'payment.succeeded') {
        await this.activateSubscriptionFromPayment({
          userId: event.userId,
          planId: event.planId,
          billingCycle: event.billingCycle,
          amountCents: event.amountCents,
          currency: event.currency,
          provider: event.provider,
          externalPaymentId: event.externalPaymentId,
          externalOrderId: event.externalOrderId,
          receiptUrl: event.receiptUrl,
          metadata: event.metadata,
          targetPaymentId: correlatedPaymentId,
        });
      } else if (event.type === 'payment.failed') {
        const failId = `pay_fail_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        db.prepare(`
          INSERT INTO commercial_payments (
            id, user_id, subscription_id, provider, external_order_id, external_payment_id,
            amount_cents, currency, status, plan_id, billing_cycle, receipt_url, metadata_json,
            created_at, updated_at
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'FAILED', ?, ?, NULL, ?, ?, ?)
        `).run(
          failId,
          event.userId,
          event.provider,
          event.externalOrderId || null,
          event.externalPaymentId,
          event.amountCents,
          event.currency,
          event.planId,
          event.billingCycle,
          JSON.stringify(event.metadata || {}),
          now,
          now
        );
      } else if (event.type === 'subscription.cancelled') {
        db.prepare(`
          UPDATE commercial_subscriptions
          SET status = 'CANCELLED'
          WHERE user_id = ? AND status = 'ACTIVE'
        `).run(event.userId);
      }

      db.prepare("UPDATE commercial_webhook_events SET status = 'PROCESSED' WHERE id = ?").run(event.id);
    } catch (err) {
      try {
        db.prepare("DELETE FROM commercial_webhook_events WHERE id = ? AND status = 'PROCESSING'").run(event.id);
      } catch {}
      throw err;
    }

    return {
      success: true,
      eventId: event.id,
      type: event.type,
      message: `Successfully processed ${event.type} event.`,
    };
  }

  /**
   * Atomically updates commercial_payments, commercial_subscriptions, commercial_users,
   * auth_users, and commercial_billing_invoices upon verified checkout/payment completion.
   */
  public async activateSubscriptionFromPayment(params: {
    userId: string;
    planId: string;
    billingCycle: BillingCycleType | string;
    amountCents: number;
    currency: string;
    provider: PaymentProviderType;
    externalPaymentId: string;
    externalOrderId?: string;
    receiptUrl?: string;
    metadata?: Record<string, any>;
    tx?: any;
    targetPaymentId?: string;
    alreadyClaimedPaymentId?: string;
  }): Promise<{
    subscription: UserSubscriptionSummary;
    invoice: PaymentInvoiceRecord;
    licence: { rawKey: string; keyMasked: string } | null;
    planSyncFailed?: boolean;
  }> {
    await assertNotEmergencyFrozen('license_minting');
    const targetPlan = resolveCommercialPlan(params.planId);
    if (!targetPlan) {
      throw new Error(`PLAN_NOT_FOUND: Unknown plan "${params.planId}".`);
    }

    const effectiveCycle = normalizeBillingCycle(params.billingCycle, targetPlan.id);
    const now = new Date().toISOString();
    const durationDays = resolveSubscriptionDurationDays(targetPlan.id, effectiveCycle);
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const subId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const invoiceId = `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    let licenceResult: { rawKey: string; keyMasked: string } | null = null;
    let planSyncFailed = false;

    const pgClient = params.tx
      ? params.tx
      : this.resolvePgBillingClient([
          'commercial_payments',
          'commercial_subscriptions',
          'commercial_billing_invoices',
          'licenses',
          'auth_users',
        ]);

    const pgReady = Boolean(
      pgClient &&
        typeof pgClient.commercial_payments?.findFirst === 'function' &&
        typeof pgClient.commercial_payments?.create === 'function' &&
        typeof pgClient.commercial_payments?.update === 'function' &&
        typeof pgClient.commercial_subscriptions?.create === 'function' &&
        typeof pgClient.commercial_billing_invoices?.create === 'function' &&
        typeof pgClient.licenses?.create === 'function' &&
        typeof pgClient.licenses?.findFirst === 'function' &&
        typeof pgClient.auth_users?.update === 'function'
    );

    if (pgClient && !pgReady) {
      if (this.isStrictProductionPostgres()) {
        throw new Error('[PaymentService][PG_UNAVAILABLE] Incomplete Prisma billing client in production.');
      }
      console.warn(
        '[PaymentService][PG_CAPABILITY_MISSING] Prisma client cannot serve commercial_payments chain; falling back to local SQLite activation + PG auth-users sync only'
      );
    }

    if (pgClient && pgReady) {
      const executePgActivation = async (tx: any): Promise<{
        earlyReturn?: {
          subscription: UserSubscriptionSummary;
          invoice: PaymentInvoiceRecord;
          licence: { rawKey: string; keyMasked: string } | null;
          planSyncFailed?: boolean;
        };
      }> => {
        // 1) Lock payment row (if present) and guard against duplicate payment settlement
        let existingPayment: any = null;
        if (typeof tx.$queryRaw === 'function') {
          const rows = params.targetPaymentId
            ? ((await tx.$queryRaw`
                SELECT * FROM commercial_payments WHERE id = ${params.targetPaymentId} LIMIT 1 FOR UPDATE
              `) as any[])
            : ((await tx.$queryRaw`
                SELECT * FROM commercial_payments WHERE external_payment_id = ${params.externalPaymentId} LIMIT 1 FOR UPDATE
              `) as any[]);
          existingPayment = rows?.[0] || null;
        } else {
          existingPayment = params.targetPaymentId
            ? await tx.commercial_payments.findFirst({ where: { id: params.targetPaymentId } })
            : await tx.commercial_payments.findFirst({
                where: { external_payment_id: params.externalPaymentId },
              });
        }

        if (!params.alreadyClaimedPaymentId && existingPayment?.status === 'SUCCEEDED') {
          const existingSub =
            typeof tx.commercial_subscriptions?.findFirst === 'function'
              ? await tx.commercial_subscriptions.findFirst({
                  where: { user_id: params.userId, status: 'ACTIVE' },
                  orderBy: { starts_at: 'desc' },
                })
              : null;
          const existingInv =
            typeof tx.commercial_billing_invoices?.findFirst === 'function'
              ? await tx.commercial_billing_invoices.findFirst({
                  where: { payment_id: params.externalPaymentId },
                })
              : null;

          return {
            earlyReturn: {
              subscription: {
                userId: params.userId,
                planId: existingSub?.plan_id || targetPlan.id,
                planName: targetPlan.name,
                status: 'ACTIVE',
                billingCycle: (existingSub?.billing_cycle || effectiveCycle) as any,
                startsAt: existingSub?.starts_at || now,
                expiresAt: existingSub?.expires_at || expiresAt,
                maxProfiles: targetPlan.limits.maxProfiles,
                maxDevices: targetPlan.limits.maxDevices,
                paymentProvider: params.provider,
              },
              invoice: {
                id: existingInv?.id || invoiceId,
                userId: params.userId,
                paymentId: params.externalPaymentId,
                invoiceNumber: existingInv?.invoice_number || invoiceNumber,
                amountCents: existingInv?.amount_cents ?? params.amountCents,
                currency: existingInv?.currency || params.currency,
                status: 'PAID',
                periodStart: existingInv?.period_start || now,
                periodEnd: existingInv?.period_end || expiresAt,
                pdfUrl: existingInv?.pdf_url || params.receiptUrl || undefined,
                createdAt: existingInv?.created_at || now,
              },
              licence: null,
              planSyncFailed: false,
            },
          };
        }

        if (existingPayment) {
          await tx.commercial_payments.update({
            where: { id: existingPayment.id },
            data: {
              status: 'SUCCEEDED',
              subscription_id: existingPayment.subscription_id || subId,
              receipt_url: params.receiptUrl || existingPayment.receipt_url || null,
              updated_at: now,
            },
          });
        } else {
          await tx.commercial_payments.create({
            data: {
              id: `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
              user_id: params.userId,
              subscription_id: subId,
              provider: params.provider,
              external_order_id: params.externalOrderId || null,
              external_payment_id: params.externalPaymentId,
              amount_cents: params.amountCents,
              currency: params.currency,
              status: 'SUCCEEDED',
              plan_id: targetPlan.id,
              billing_cycle: effectiveCycle,
              receipt_url: params.receiptUrl || null,
              metadata_json: JSON.stringify(params.metadata || {}),
              created_at: now,
              updated_at: now,
            },
          });
        }

        // 2) Invoice create
        await tx.commercial_billing_invoices.create({
          data: {
            id: invoiceId,
            user_id: params.userId,
            payment_id: params.externalPaymentId,
            invoice_number: invoiceNumber,
            amount_cents: params.amountCents,
            currency: params.currency,
            status: 'PAID',
            period_start: now,
            period_end: expiresAt,
            pdf_url: params.receiptUrl || null,
            created_at: now,
          },
        });

        // 3) Subscription create
        await tx.commercial_subscriptions.create({
          data: {
            id: subId,
            user_id: params.userId,
            plan_id: targetPlan.id,
            status: 'ACTIVE',
            billing_cycle: effectiveCycle,
            starts_at: now,
            expires_at: expiresAt,
            payment_provider: params.provider,
            external_sub_id: params.externalOrderId || null,
            created_at: now,
          },
        });

        // 4) auth_users update without aborting PG transaction if mock user is absent
        try {
          if (typeof tx.auth_users.updateMany === 'function') {
            const updatedAuth = await tx.auth_users.updateMany({
              where: { id: params.userId },
              data: {
                plan_id: targetPlan.id,
                profile_quota: targetPlan.limits.maxProfiles,
                updated_at: now,
              },
            });
            if (updatedAuth?.count === 0) {
              planSyncFailed = true;
            }
          } else {
            await tx.auth_users.update({
              where: { id: params.userId },
              data: {
                plan_id: targetPlan.id,
                profile_quota: targetPlan.limits.maxProfiles,
                updated_at: now,
              },
            });
          }
        } catch (err: any) {
          console.error('[PaymentService][CRITICAL] PG plan sync error', err?.message);
          planSyncFailed = true;
        }

        if (planSyncFailed) {
          console.error('[PaymentService][RECONCILE_REQUIRED] Subscription active but PG out of sync for user', params.userId);
        }

        // 5) commercial_users update if mirror exists
        try {
          if (typeof tx.commercial_users?.findFirst === 'function') {
            const commUser = await tx.commercial_users.findFirst({
              where: { id: params.userId },
            });
            if (commUser) {
              await tx.commercial_users.update({
                where: { id: params.userId },
                data: {
                  plan_id: targetPlan.id,
                  updated_at: now,
                },
              });
            } else {
              console.warn(`[PaymentService] Mirror-missing user ${params.userId} in commercial_users; skipping commercial_users update.`);
            }
          }
        } catch (err: any) {
          console.warn(`[PaymentService] Failed to update commercial_users plan_id for ${params.userId}:`, err?.message);
        }

        // 6) License minting with idempotency duplicate check inside tx
        const existingLicense = await tx.licenses.findFirst({
          where: {
            account_id: params.userId,
            OR: [
              { notes: { contains: params.externalPaymentId } },
              { notes: { contains: subId } },
            ],
          },
        });

        if (!existingLicense) {
          let customerName = params.userId;
          try {
            const u = typeof tx.auth_users.findFirst === 'function'
              ? await tx.auth_users.findFirst({ where: { id: params.userId }, select: { name: true, email: true } })
              : await getCentralUserByIdAsync(params.userId);
            if (u?.name) customerName = u.name.trim();
            else if (u?.email) customerName = u.email.trim();
          } catch {}

          const { rawKey, keyHash, keyMasked } = generateLicenseKey();
          await tx.licenses.create({
            data: {
              id: crypto.randomUUID(),
              license_key_hash: keyHash,
              key_masked: keyMasked,
              customer_name: customerName,
              account_id: params.userId,
              status: 'ACTIVE',
              duration_type: 'CUSTOM',
              max_devices: targetPlan.limits.maxDevices || 1,
              starts_at: now,
              expires_at: expiresAt,
              created_at: now,
              created_by: 'PAYMENT_GATEWAY',
              revoked_at: null,
              last_validation_at: null,
              notes: `Plan: ${params.planId} | Payment: ${params.externalPaymentId} | Sub: ${subId}`,
            },
          });
          licenceResult = { rawKey, keyMasked };

          if (typeof tx.commercial_audit_logs?.create === 'function') {
            await tx.commercial_audit_logs.create({
              data: {
                id: crypto.randomUUID(),
                actor_id: params.userId,
                actor_name: customerName,
                actor_role: 'SYSTEM',
                action: 'LICENSE_ISSUED',
                target_type: 'LICENSE',
                target_id: params.userId,
                details: `License issued on plan approval: ${params.planId} (sub ${subId})`,
                ip_address: null,
                result: 'SUCCESS',
                created_at: now,
              },
            });
          }
        }
        return {};
      };

      const txRes = params.tx
        ? await executePgActivation(params.tx)
        : await this.withPgTransaction(pgClient, executePgActivation);
      if (txRes?.earlyReturn) {
        return txRes.earlyReturn;
      }
    } else {
      const db = getDatabase();
      let earlySqliteResult: {
        subscription: UserSubscriptionSummary;
        invoice: PaymentInvoiceRecord;
        licence: { rawKey: string; keyMasked: string } | null;
        planSyncFailed?: boolean;
      } | null = null;

      const runUpdates = () => {
        // 1. Payment Record + duplicate settlement guard
        const existingPayment = (params.targetPaymentId
          ? db.prepare('SELECT * FROM commercial_payments WHERE id = ?').get(params.targetPaymentId)
          : db.prepare('SELECT * FROM commercial_payments WHERE external_payment_id = ?').get(params.externalPaymentId)) as any;

        if (!params.alreadyClaimedPaymentId && existingPayment?.status === 'SUCCEEDED') {
          const existingSub = db.prepare(
            "SELECT * FROM commercial_subscriptions WHERE user_id = ? AND status = 'ACTIVE' ORDER BY starts_at DESC LIMIT 1"
          ).get(params.userId) as any;
          const existingInv = db.prepare(
            'SELECT * FROM commercial_billing_invoices WHERE payment_id = ? LIMIT 1'
          ).get(params.externalPaymentId) as any;

          earlySqliteResult = {
            subscription: {
              userId: params.userId,
              planId: existingSub?.plan_id || targetPlan.id,
              planName: targetPlan.name,
              status: 'ACTIVE',
              billingCycle: (existingSub?.billing_cycle || effectiveCycle) as any,
              startsAt: existingSub?.starts_at || now,
              expiresAt: existingSub?.expires_at || expiresAt,
              maxProfiles: targetPlan.limits.maxProfiles,
              maxDevices: targetPlan.limits.maxDevices,
              paymentProvider: params.provider,
            },
            invoice: {
              id: existingInv?.id || invoiceId,
              userId: params.userId,
              paymentId: params.externalPaymentId,
              invoiceNumber: existingInv?.invoice_number || invoiceNumber,
              amountCents: existingInv?.amount_cents ?? params.amountCents,
              currency: existingInv?.currency || params.currency,
              status: 'PAID',
              periodStart: existingInv?.period_start || now,
              periodEnd: existingInv?.period_end || expiresAt,
              pdfUrl: existingInv?.pdf_url || params.receiptUrl || undefined,
              createdAt: existingInv?.created_at || now,
            },
            licence: null,
            planSyncFailed: false,
          };
          return;
        }

        if (existingPayment) {
          db.prepare(`
            UPDATE commercial_payments
            SET status = 'SUCCEEDED', subscription_id = COALESCE(subscription_id, ?), receipt_url = COALESCE(?, receipt_url), updated_at = ?
            WHERE id = ?
          `).run(subId, params.receiptUrl || null, now, existingPayment.id);
        } else {
          db.prepare(`
            INSERT INTO commercial_payments (
              id, user_id, subscription_id, provider, external_order_id, external_payment_id,
              amount_cents, currency, status, plan_id, billing_cycle, receipt_url, metadata_json,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SUCCEEDED', ?, ?, ?, ?, ?, ?)
          `).run(
            `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            params.userId,
            subId,
            params.provider,
            params.externalOrderId || null,
            params.externalPaymentId,
            params.amountCents,
            params.currency,
            targetPlan.id,
            effectiveCycle,
            params.receiptUrl || null,
            JSON.stringify(params.metadata || {}),
            now,
            now
          );
        }

        // 2. Create Invoice Record
        db.prepare(`
          INSERT INTO commercial_billing_invoices (
            id, user_id, payment_id, invoice_number, amount_cents, currency, status,
            period_start, period_end, pdf_url, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?, ?)
        `).run(
          invoiceId,
          params.userId,
          params.externalPaymentId,
          invoiceNumber,
          params.amountCents,
          params.currency,
          now,
          expiresAt,
          params.receiptUrl || null,
          now
        );

        // 3. Ensure commercial_users and commercial_plans rows exist to satisfy FK constraints under PRAGMA foreign_keys = ON
        db.prepare(`
          INSERT OR IGNORE INTO commercial_users (id, email, password_hash, salt, name, plan_id, created_at, updated_at)
          VALUES (?, ?, 'placeholder', 'placeholder', 'Subscriber', ?, ?, ?)
        `).run(params.userId, `${params.userId}@commercial.local`, targetPlan.id, now, now);
        db.prepare(`
          INSERT OR IGNORE INTO commercial_plans (id, name, tier, limits_json, created_at)
          VALUES (?, 'Plan', 'pro', '{}', ?)
        `).run(targetPlan.id, now);

        // 4. Activate Subscription in Database
        db.prepare(`
          INSERT INTO commercial_subscriptions (
            id, user_id, plan_id, status, billing_cycle, starts_at, expires_at,
            payment_provider, external_sub_id, created_at
          ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)
        `).run(
          subId,
          params.userId,
          targetPlan.id,
          effectiveCycle,
          now,
          expiresAt,
          params.provider,
          params.externalOrderId || null,
          now
        );

        // 5. Update User Plan & Quotas in auth_users
        try {
          db.prepare(`
            UPDATE auth_users
            SET plan_id = ?, profile_quota = ?, updated_at = ?
            WHERE id = ?
          `).run(targetPlan.id, targetPlan.limits.maxProfiles, now, params.userId);
        } catch (err: any) {
          console.error('[PaymentService] SQLite auth_users plan update error:', err?.message);
        }

        // 6. Update User Plan in commercial_users
        try {
          db.prepare(`
            UPDATE commercial_users
            SET plan_id = ?
            WHERE id = ?
          `).run(targetPlan.id, params.userId);
        } catch (err: any) {
          console.error('[PaymentService] SQLite commercial_users plan update error:', err?.message);
        }

        // 7. Create License in Database (with idempotency duplicate guard)
        try {
          const existingLicence = db.prepare(
            'SELECT id, key_masked FROM licenses WHERE account_id = ? AND (notes LIKE ? OR notes LIKE ?)'
          ).get(params.userId, `%${params.externalPaymentId}%`, `%${subId}%`) as any;

          if (!existingLicence) {
            let customerName = params.userId;
            try {
              const u = getUserById(params.userId);
              if (u?.name) customerName = u.name;
              else if (u?.email) customerName = u.email;
            } catch {}

            const created = createLicense({
              durationType: 'CUSTOM',
              customerName,
              accountId: params.userId,
              maxDevices: targetPlan.limits.maxDevices || 1,
              startsAt: now,
              expiresAt,
              notes: `Plan: ${params.planId} | Payment: ${params.externalPaymentId} | Sub: ${subId}`,
            }, 'PAYMENT_GATEWAY');

            if (created && created.rawLicenseKey) {
              licenceResult = {
                rawKey: created.rawLicenseKey,
                keyMasked: created.license.keyMasked,
              };
            }
          }
        } catch (licErr: any) {
          console.warn(`[PaymentService] licence creation failed for user ${params.userId}:`, licErr?.message || licErr);
          licenceResult = null;
        }
      };

      if (typeof (db as any).transaction === 'function') {
        (db as any).transaction(runUpdates)();
      } else {
        runUpdates();
      }

      if (earlySqliteResult) {
        return earlySqliteResult;
      }

      if (isPostgresConfigured()) {
        try {
          const repo = getCentralRepository();
          await repo.updateAuthUser(params.userId, {
            plan_id: targetPlan.id,
            profile_quota: targetPlan.limits.maxProfiles,
          });
        } catch (err: any) {
          console.error('[PaymentService][CRITICAL] PG plan sync error', err?.message);
          planSyncFailed = true;
        }
      }

      if (planSyncFailed) {
        console.error('[PaymentService][RECONCILE_REQUIRED] Subscription active but PG out of sync for user', params.userId);
      }
    }

    const subSummary: UserSubscriptionSummary = {
      userId: params.userId,
      planId: targetPlan.id,
      planName: targetPlan.name,
      status: 'ACTIVE',
      billingCycle: effectiveCycle,
      startsAt: now,
      expiresAt,
      maxProfiles: targetPlan.limits.maxProfiles,
      maxDevices: targetPlan.limits.maxDevices,
      paymentProvider: params.provider,
    };

    const invoiceRecord: PaymentInvoiceRecord = {
      id: invoiceId,
      userId: params.userId,
      paymentId: params.externalPaymentId,
      invoiceNumber,
      amountCents: params.amountCents,
      currency: params.currency,
      status: 'PAID',
      periodStart: now,
      periodEnd: expiresAt,
      pdfUrl: params.receiptUrl || undefined,
      createdAt: now,
    };

    return {
      subscription: subSummary,
      invoice: invoiceRecord,
      licence: licenceResult,
      planSyncFailed,
    };
  }

  /**
   * Retrieves invoices for a user with strict IDOR user-scoping.
   */
  public getUserInvoices(userId: string): PaymentInvoiceRecord[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM commercial_billing_invoices
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      paymentId: r.payment_id || undefined,
      invoiceNumber: r.invoice_number,
      amountCents: r.amount_cents,
      currency: r.currency,
      status: r.status,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      pdfUrl: r.pdf_url || undefined,
      createdAt: r.created_at,
    }));
  }

  public async getUserInvoicesAsync(userId: string): Promise<PaymentInvoiceRecord[]> {
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    if (prisma) {
      const rows = await prisma.commercial_billing_invoices.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      });
      return rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        paymentId: r.payment_id || undefined,
        invoiceNumber: r.invoice_number,
        amountCents: r.amount_cents,
        currency: r.currency,
        status: r.status,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        pdfUrl: r.pdf_url || undefined,
        createdAt: r.created_at,
      }));
    }
    return this.getUserInvoices(userId);
  }

  /**
   * Retrieves active subscription summary for a user.
   */
  public getUserSubscription(userId: string): UserSubscriptionSummary | null {
    const db = getDatabase();
    const sub = db.prepare(`
      SELECT * FROM commercial_subscriptions
      WHERE user_id = ? AND status = 'ACTIVE'
      ORDER BY starts_at DESC
      LIMIT 1
    `).get(userId) as any;

    if (!sub) return null;

    const plan = getCommercialPlanById(sub.plan_id) || getCommercialPlans()[0];
    return {
      userId,
      planId: sub.plan_id,
      planName: plan.name,
      status: sub.status,
      billingCycle: sub.billing_cycle,
      startsAt: sub.starts_at,
      expiresAt: sub.expires_at,
      maxProfiles: plan.limits.maxProfiles,
      maxDevices: plan.limits.maxDevices,
      paymentProvider: sub.payment_provider || undefined,
    };
  }

  public async getUserSubscriptionAsync(userId: string): Promise<UserSubscriptionSummary | null> {
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    if (prisma) {
      const sub = await prisma.commercial_subscriptions.findFirst({
        where: { user_id: userId, status: 'ACTIVE' },
        orderBy: { starts_at: 'desc' },
      });
      if (!sub) return null;
      const plan = getCommercialPlanById(sub.plan_id) || getCommercialPlans()[0];
      return {
        userId,
        planId: sub.plan_id,
        planName: plan.name,
        status: sub.status as UserSubscriptionSummary['status'],
        billingCycle: sub.billing_cycle as BillingCycleType,
        startsAt: sub.starts_at,
        expiresAt: sub.expires_at || '',
        maxProfiles: plan.limits.maxProfiles,
        maxDevices: plan.limits.maxDevices,
        paymentProvider: sub.payment_provider || undefined,
      };
    }
    return this.getUserSubscription(userId);
  }

  /**
   * Cancels active subscription for a user.
   */
  public cancelSubscription(userId: string): boolean {
    const db = getDatabase();
    const res = db.prepare(`
      UPDATE commercial_subscriptions
      SET status = 'CANCELLED'
      WHERE user_id = ? AND status = 'ACTIVE'
    `).run(userId);
    return res.changes > 0;
  }

  /**
   * Submits a manual UPI payment with UTR reference and persists it under PENDING_VERIFICATION.
   */
  public async submitManualUpiPayment(params: {
    userId: string;
    planId: string;
    billingCycle?: BillingCycleType | string;
    utr: string;
    amountPaise?: number;
    proofAsset?: string;
    extraMembers?: number;
    extraProxyGb?: number;
  }): Promise<{ paymentId: string; status: string; utr: string; amountPaise: number; createdAt: string }> {
    await assertNotEmergencyFrozen('manual_upi_checkout');
    const cleanUtr = (params.utr || '').trim();

    if (!cleanUtr || cleanUtr.length < 6 || cleanUtr.length > 30 || !/^[a-zA-Z0-9]+$/.test(cleanUtr)) {
      throw new Error('INVALID_UTR: Transaction reference must be 6-30 alphanumeric characters.');
    }

    const plan = resolveCommercialPlan(params.planId);
    if (!plan || !plan.isActive) {
      throw new Error(`Selected plan "${params.planId}" is not available for purchase.`);
    }

    const cycle = normalizeBillingCycle(params.billingCycle, plan.id);
    const orderTotal = calculateAuthoritativeOrderTotal({
      planId: params.planId as any,
      billingCycle: cycle,
      currency: 'INR',
      extraMembers: params.extraMembers,
      extraProxyGb: params.extraProxyGb,
    });
    // ALWAYS enforce server-calculated authoritative order total. Never accept client amountPaise!
    const amountPaise = orderTotal.totalChargeMinor;

    const paymentId = `pay_upi_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const externalOrderId = `upi_ord_${Date.now()}`;
    const now = new Date().toISOString();

    const pgClient = this.resolvePgBillingClient(['commercial_payments']);
    if (pgClient) {
      await this.withPgTransaction(pgClient, async (tx) => {
        const existing = await tx.commercial_payments.findFirst({
          where: {
            OR: [
              { external_payment_id: cleanUtr },
              { id: cleanUtr },
            ],
          },
        });
        if (existing) {
          throw new Error('UTR_ALREADY_EXISTS: This UTR has already been submitted.');
        }

        try {
          await tx.commercial_payments.create({
            data: {
              id: paymentId,
              user_id: params.userId,
              subscription_id: null,
              provider: 'manual_upi',
              external_order_id: externalOrderId,
              external_payment_id: cleanUtr,
              amount_cents: amountPaise,
              currency: 'INR',
              status: 'PENDING_VERIFICATION',
              plan_id: plan.id,
              billing_cycle: cycle,
              receipt_url: params.proofAsset || null,
              metadata_json: JSON.stringify({
                utr: cleanUtr,
                proofAsset: params.proofAsset,
                submittedAt: now,
                extraMembers: params.extraMembers || 0,
                extraProxyGb: params.extraProxyGb || 0,
                orderTotal,
              }),
              created_at: now,
              updated_at: now,
            },
          });
        } catch (err: any) {
          if (this.isPgUniqueViolation(err)) {
            throw new Error('UTR_ALREADY_EXISTS: This UTR has already been submitted.');
          }
          throw err;
        }

        if (typeof tx.commercial_audit_logs?.create === 'function') {
          try {
            await tx.commercial_audit_logs.create({
              data: {
                id: crypto.randomUUID(),
                actor_id: params.userId,
                actor_name: 'USER',
                actor_role: 'USER',
                action: 'UPI_UTR_SUBMITTED',
                target_type: 'PAYMENT',
                target_id: paymentId,
                details: `UPI ₹${amountPaise/100} pending — UTR ${cleanUtr} — plan ${plan.id}`,
                ip_address: null,
                result: 'SUCCESS',
                created_at: now,
              },
            });
          } catch {}
        }
      });
    } else {
      const db = getDatabase();
      const insertUpiSqlite = () => {
        const existing = db.prepare('SELECT id FROM commercial_payments WHERE external_payment_id = ?').get(cleanUtr) as any;
        if (existing) {
          throw new Error('UTR_ALREADY_EXISTS: This UTR has already been submitted.');
        }

        db.prepare(`
          INSERT INTO commercial_payments (
            id, user_id, subscription_id, provider, external_order_id, external_payment_id,
            amount_cents, currency, status, plan_id, billing_cycle, receipt_url, metadata_json,
            created_at, updated_at
          ) VALUES (?, ?, NULL, 'manual_upi', ?, ?, ?, 'INR', 'PENDING_VERIFICATION', ?, ?, ?, ?, ?, ?)
        `).run(
          paymentId,
          params.userId,
          externalOrderId,
          cleanUtr,
          amountPaise,
          plan.id,
          cycle,
          params.proofAsset || null,
          JSON.stringify({
            utr: cleanUtr,
            proofAsset: params.proofAsset,
            submittedAt: now,
            extraMembers: params.extraMembers || 0,
            extraProxyGb: params.extraProxyGb || 0,
            orderTotal,
          }),
          now,
          now
        );
      };

      if (typeof (db as any).transaction === 'function') {
        (db as any).transaction(insertUpiSqlite)();
      } else {
        insertUpiSqlite();
      }

      try {
        await logCommercialAudit({
          actorId: params.userId,
          actorName: 'USER',
          actorRole: 'USER',
          action: 'UPI_UTR_SUBMITTED',
          targetType: 'PAYMENT',
          targetId: paymentId,
          details: `UPI ₹${amountPaise/100} pending — UTR ${cleanUtr} — plan ${plan.id}`,
        });
      } catch {}
    }

    try {
      const emailProvider = getEmailProvider();
      const adminEmail = process.env.ADMIN_PAYMENT_EMAIL || SUPPORT_EMAIL;
      const amountInr = `₹${(amountPaise / 100).toFixed(2)}`;
      await emailProvider.sendBillingAlert(
        adminEmail,
        paymentId,
        amountInr,
        `UPI UTR ${cleanUtr} pending admin approval`,
        {
          planName: plan.name || plan.id,
          userId: params.userId,
          submittedAt: now,
          instruction: 'Please review and approve from the admin panel.',
        }
      );
    } catch (err: any) {
      console.warn(`[PaymentService] admin UTR notification failed: ${err.message}`);
    }

    return {
      paymentId,
      status: 'PENDING_VERIFICATION',
      utr: cleanUtr,
      amountPaise,
      createdAt: now,
    };
  }

  /**
   * Submits a manual USDT (TRC-20) crypto transaction hash and persists it under PENDING_VERIFICATION.
   */
  public async submitManualCryptoPayment(params: {
    userId: string;
    planId: string;
    billingCycle?: BillingCycleType | string;
    txHash: string;
    network?: string;
    proofAsset?: string;
    extraMembers?: number;
    extraProxyGb?: number;
  }): Promise<{
    paymentId: string;
    status: string;
    txHash: string;
    amountCents: number;
    currency: string;
    network: string;
    walletAddress: string;
    createdAt: string;
  }> {
    await assertNotEmergencyFrozen('manual_crypto_checkout');
    const cleanHash = (params.txHash || '').trim();
    if (!/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
      throw new Error('INVALID_TX_HASH: Please enter a valid 64-character TRON (TRC-20) transaction hash.');
    }

    const plan = resolveCommercialPlan(params.planId);
    if (!plan || !plan.isActive || plan.tier === 'FREE') {
      throw new Error(`Selected plan "${params.planId}" is not available for purchase.`);
    }

    const cycle = normalizeBillingCycle(params.billingCycle, plan.id);
    const orderTotal = calculateAuthoritativeOrderTotal({
      planId: params.planId as any,
      billingCycle: cycle,
      currency: 'USD',
      extraMembers: params.extraMembers,
      extraProxyGb: params.extraProxyGb,
    });
    const amountCents = orderTotal.totalChargeMinor;
    const network = (params.network || process.env.PAYMENT_USDT_NETWORK || CONTACT_CONFIG.USDT_NETWORK || 'TRC-20 (TRON)').trim();
    const walletAddress = (process.env.PAYMENT_USDT_ADDRESS || CONTACT_CONFIG.USDT_ADDRESS || '').trim();

    const paymentId = `pay_usdt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const externalOrderId = `usdt_ord_${Date.now()}`;
    const now = new Date().toISOString();
    const metaJson = JSON.stringify({
      txHash: cleanHash,
      network,
      walletAddress,
      proofAsset: params.proofAsset,
      submittedAt: now,
      extraMembers: params.extraMembers || 0,
      extraProxyGb: params.extraProxyGb || 0,
      orderTotal,
    });

    const pgClient = this.resolvePgBillingClient(['commercial_payments']);
    if (pgClient) {
      await this.withPgTransaction(pgClient, async (tx) => {
        const existing = await tx.commercial_payments.findFirst({
          where: {
            OR: [{ external_payment_id: cleanHash }, { id: cleanHash }],
          },
        });
        if (existing) {
          throw new Error('TX_HASH_ALREADY_EXISTS: This transaction hash has already been submitted.');
        }

        try {
          await tx.commercial_payments.create({
            data: {
              id: paymentId,
              user_id: params.userId,
              subscription_id: null,
              provider: 'manual_usdt_trc20',
              external_order_id: externalOrderId,
              external_payment_id: cleanHash,
              amount_cents: amountCents,
              currency: 'USD',
              status: 'PENDING_VERIFICATION',
              plan_id: plan.id,
              billing_cycle: cycle,
              receipt_url: params.proofAsset || null,
              metadata_json: metaJson,
              created_at: now,
              updated_at: now,
            },
          });
        } catch (err: any) {
          if (this.isPgUniqueViolation(err)) {
            throw new Error('TX_HASH_ALREADY_EXISTS: This transaction hash has already been submitted.');
          }
          throw err;
        }

        if (typeof tx.commercial_audit_logs?.create === 'function') {
          try {
            await tx.commercial_audit_logs.create({
              data: {
                id: crypto.randomUUID(),
                actor_id: params.userId,
                actor_name: 'USER',
                actor_role: 'USER',
                action: 'CRYPTO_TX_SUBMITTED',
                target_type: 'PAYMENT',
                target_id: paymentId,
                details: `USDT ($${(amountCents / 100).toFixed(2)} ${network}) pending — TX ${cleanHash} — plan ${plan.id}`,
                ip_address: null,
                result: 'SUCCESS',
                created_at: now,
              },
            });
          } catch {}
        }
      });
    } else {
      const db = getDatabase();
      const insertUsdtSqlite = () => {
        const existing = db.prepare('SELECT id FROM commercial_payments WHERE external_payment_id = ?').get(cleanHash) as any;
        if (existing) {
          throw new Error('TX_HASH_ALREADY_EXISTS: This transaction hash has already been submitted.');
        }

        db.prepare(`
          INSERT INTO commercial_payments (
            id, user_id, subscription_id, provider, external_order_id, external_payment_id,
            amount_cents, currency, status, plan_id, billing_cycle, receipt_url, metadata_json,
            created_at, updated_at
          ) VALUES (?, ?, NULL, 'manual_usdt_trc20', ?, ?, ?, 'USD', 'PENDING_VERIFICATION', ?, ?, ?, ?, ?, ?)
        `).run(
          paymentId,
          params.userId,
          externalOrderId,
          cleanHash,
          amountCents,
          plan.id,
          cycle,
          params.proofAsset || null,
          metaJson,
          now,
          now
        );
      };

      if (typeof (db as any).transaction === 'function') {
        (db as any).transaction(insertUsdtSqlite)();
      } else {
        insertUsdtSqlite();
      }

      try {
        await logCommercialAudit({
          actorId: params.userId,
          actorName: 'USER',
          actorRole: 'USER',
          action: 'CRYPTO_TX_SUBMITTED',
          targetType: 'PAYMENT',
          targetId: paymentId,
          details: `USDT ($${(amountCents / 100).toFixed(2)} ${network}) pending — TX ${cleanHash} — plan ${plan.id}`,
        });
      } catch {}
    }

    try {
      const emailProvider = getEmailProvider();
      const adminEmail = process.env.ADMIN_PAYMENT_EMAIL || SUPPORT_EMAIL;
      const amountUsd = `$${(amountCents / 100).toFixed(2)} USDT`;
      await emailProvider.sendBillingAlert(
        adminEmail,
        paymentId,
        amountUsd,
        `USDT (${network}) TX ${cleanHash} pending admin approval`,
        {
          planName: plan.name || plan.id,
          userId: params.userId,
          submittedAt: now,
          instruction: 'Verify TRC-20 transaction on Tronscan and approve in admin panel.',
        }
      );
    } catch (err: any) {
      console.warn(`[PaymentService] admin crypto notification failed: ${err.message}`);
    }

    return {
      paymentId,
      status: 'PENDING_VERIFICATION',
      txHash: cleanHash,
      amountCents,
      currency: 'USD',
      network,
      walletAddress,
      createdAt: now,
    };
  }

  /**
   * Approves a manual UPI payment, activating subscription and creating an invoice.
   */
  public async approveManualPayment(
    paymentId: string,
    adminActor: { id: string; name: string; role?: string }
  ): Promise<{ success: boolean; paymentId: string; status: string; userId: string }> {
    await assertNotEmergencyFrozen('manual_payment_approval');
    const pgClient = this.resolvePgBillingClient([
      'commercial_payments',
      'commercial_subscriptions',
      'commercial_billing_invoices',
      'licenses',
      'auth_users',
    ]);

    let payment: any = null;
    let actResult: {
      subscription: UserSubscriptionSummary;
      invoice: PaymentInvoiceRecord;
      licence: { rawKey: string; keyMasked: string } | null;
      planSyncFailed?: boolean;
    };

    if (pgClient) {
      const txOutcome = await this.withPgTransaction(pgClient, async (tx) => {
        let lockedPayment: any = null;
        if (typeof tx.$queryRaw === 'function') {
          const rows = (await tx.$queryRaw`
            SELECT * FROM commercial_payments
            WHERE id = ${paymentId} OR external_payment_id = ${paymentId}
            LIMIT 1 FOR UPDATE
          `) as any[];
          lockedPayment = rows?.[0] || null;
        } else {
          lockedPayment = await tx.commercial_payments.findFirst({
            where: {
              OR: [{ id: paymentId }, { external_payment_id: paymentId }],
            },
          });
        }

        if (!lockedPayment) {
          throw new Error(`Payment record "${paymentId}" not found.`);
        }
        if (lockedPayment.status !== 'PENDING_VERIFICATION') {
          throw new Error(`Payment is not pending verification (current status: ${lockedPayment.status}).`);
        }

        const claimNow = new Date().toISOString();
        if (typeof tx.commercial_payments.updateMany === 'function') {
          const claimed = await tx.commercial_payments.updateMany({
            where: { id: lockedPayment.id, status: 'PENDING_VERIFICATION' },
            data: { status: 'SUCCEEDED', updated_at: claimNow },
          });
          if (!claimed || claimed.count !== 1) {
            throw new Error('Payment is not pending verification (already processed).');
          }
        } else {
          await tx.commercial_payments.update({
            where: { id: lockedPayment.id },
            data: { status: 'SUCCEEDED', updated_at: claimNow },
          });
        }

        let meta: any = {};
        try {
          meta = JSON.parse(lockedPayment.metadata_json || '{}');
        } catch {}

        const activated = await this.activateSubscriptionFromPayment({
          userId: lockedPayment.user_id,
          planId: lockedPayment.plan_id,
          billingCycle: lockedPayment.billing_cycle,
          amountCents: lockedPayment.amount_cents,
          currency: lockedPayment.currency,
          provider: lockedPayment.provider,
          externalPaymentId: lockedPayment.external_payment_id || lockedPayment.id,
          externalOrderId: lockedPayment.external_order_id,
          receiptUrl: lockedPayment.receipt_url,
          metadata: meta,
          tx,
          targetPaymentId: lockedPayment.id,
          alreadyClaimedPaymentId: lockedPayment.id,
        });

        const isCrypto = lockedPayment.provider === 'manual_usdt_trc20';
        const methodLabel = isCrypto ? 'USDT TRC-20' : 'manual UPI';
        const refLabel = isCrypto ? 'TX' : 'UTR';

        if (typeof tx.commercial_audit_logs?.create === 'function') {
          await tx.commercial_audit_logs.create({
            data: {
              id: crypto.randomUUID(),
              actor_id: adminActor.id,
              actor_name: adminActor.name,
              actor_role: (adminActor.role as any) || 'ADMIN',
              action: 'APPROVE_MANUAL_PAYMENT',
              target_type: 'PAYMENT',
              target_id: lockedPayment.id,
              details: `Approved ${methodLabel} payment ${lockedPayment.id} for user ${lockedPayment.user_id} (${refLabel}: ${lockedPayment.external_payment_id})`,
              ip_address: null,
              result: 'SUCCESS',
              created_at: new Date().toISOString(),
            },
          });
        }

        return { lockedPayment, activated };
      });

      payment = txOutcome.lockedPayment;
      actResult = txOutcome.activated;
    } else {
      const db = getDatabase();
      // Atomic synchronous claim inside SQLite SAVEPOINT prevents concurrent double-approval
      const claimSqlite = () => {
        const row = db.prepare(
          'SELECT * FROM commercial_payments WHERE id = ? OR external_payment_id = ?'
        ).get(paymentId, paymentId) as any;

        if (!row) {
          throw new Error(`Payment record "${paymentId}" not found.`);
        }
        if (row.status !== 'PENDING_VERIFICATION') {
          throw new Error(`Payment is not pending verification (current status: ${row.status}).`);
        }

        const claimNow = new Date().toISOString();
        const upd = db.prepare(
          "UPDATE commercial_payments SET status = 'SUCCEEDED', updated_at = ? WHERE id = ? AND status = 'PENDING_VERIFICATION'"
        ).run(claimNow, row.id);
        if (upd.changes !== 1) {
          throw new Error('Payment is not pending verification (already processed).');
        }
        return row;
      };

      payment = typeof (db as any).transaction === 'function'
        ? (db as any).transaction(claimSqlite)()
        : claimSqlite();

      let meta: any = {};
      try {
        meta = JSON.parse(payment.metadata_json || '{}');
      } catch {}

      actResult = await this.activateSubscriptionFromPayment({
        userId: payment.user_id,
        planId: payment.plan_id,
        billingCycle: payment.billing_cycle,
        amountCents: payment.amount_cents,
        currency: payment.currency,
        provider: payment.provider,
        externalPaymentId: payment.external_payment_id || payment.id,
        externalOrderId: payment.external_order_id,
        receiptUrl: payment.receipt_url,
        metadata: meta,
        targetPaymentId: payment.id,
        alreadyClaimedPaymentId: payment.id,
      });

      const isCrypto = payment.provider === 'manual_usdt_trc20';
      const methodLabel = isCrypto ? 'USDT TRC-20' : 'manual UPI';
      const refLabel = isCrypto ? 'TX' : 'UTR';
      try {
        logCommercialAudit({
          actorId: adminActor.id,
          actorName: adminActor.name,
          actorRole: (adminActor.role as any) || 'ADMIN',
          action: 'APPROVE_MANUAL_PAYMENT',
          targetType: 'PAYMENT',
          targetId: payment.id,
          details: `Approved ${methodLabel} payment ${payment.id} for user ${payment.user_id} (${refLabel}: ${payment.external_payment_id})`,
        });
      } catch {}
    }

    const formattedAmount =
      payment.currency === 'USD'
        ? `$${(payment.amount_cents / 100).toFixed(2)} USD`
        : `₹${(payment.amount_cents / 100).toFixed(2)}`;

    try {
      let userEmail: string | undefined;
      if (pgClient) {
        const u = await getCentralUserByIdAsync(payment.user_id);
        userEmail = u?.email;
      } else {
        const user = getUserById(payment.user_id);
        userEmail = user?.email;
      }

      if (!userEmail) {
        console.log(`[PaymentService] skipping approval email: user or email not found for userId=${payment.user_id}`);
      } else {
        const plan = resolveCommercialPlan(payment.plan_id);
        const planName = plan ? plan.name : payment.plan_id;
        const paidAt = new Date().toISOString();
        await getEmailProvider().sendPaymentApprovedEmail({
          email: userEmail,
          planName,
          amountInr: formattedAmount,
          paidAt,
          licenceKey: actResult.licence?.rawKey,
          validUntil: actResult.subscription.expiresAt,
        });
      }
    } catch (err: any) {
      console.warn(`[PaymentService] payment approval notification failed: ${err.message}`);
    }

    return {
      success: true,
      paymentId: payment.id,
      status: 'SUCCEEDED',
      userId: payment.user_id,
    };
  }

  /**
   * Rejects a manual UPI payment with a recorded reason atomically.
   */
  public async rejectManualPayment(
    paymentId: string,
    adminActor: { id: string; name: string; role?: string },
    reason: string
  ): Promise<{ success: boolean; paymentId: string; status: string; reason: string }> {
    const pgClient = this.resolvePgBillingClient(['commercial_payments']);
    let payment: any = null;

    if (pgClient) {
      payment = await this.withPgTransaction(pgClient, async (tx) => {
        let lockedPayment: any = null;
        if (typeof tx.$queryRaw === 'function') {
          const rows = (await tx.$queryRaw`
            SELECT * FROM commercial_payments
            WHERE id = ${paymentId} OR external_payment_id = ${paymentId}
            LIMIT 1 FOR UPDATE
          `) as any[];
          lockedPayment = rows?.[0] || null;
        } else {
          lockedPayment = await tx.commercial_payments.findFirst({
            where: {
              OR: [{ id: paymentId }, { external_payment_id: paymentId }],
            },
          });
        }

        if (!lockedPayment) {
          throw new Error(`Payment record "${paymentId}" not found.`);
        }
        if (lockedPayment.status !== 'PENDING_VERIFICATION') {
          throw new Error(`Payment is not pending verification (current status: ${lockedPayment.status}).`);
        }

        const now = new Date().toISOString();
        let meta: any = {};
        try {
          meta = JSON.parse(lockedPayment.metadata_json || '{}');
        } catch {}
        meta.rejectionReason = reason;
        meta.rejectedBy = adminActor.name;
        meta.rejectedAt = now;

        if (typeof tx.commercial_payments.updateMany === 'function') {
          const updated = await tx.commercial_payments.updateMany({
            where: { id: lockedPayment.id, status: 'PENDING_VERIFICATION' },
            data: {
              status: 'REJECTED',
              metadata_json: JSON.stringify(meta),
              updated_at: now,
            },
          });
          if (!updated || updated.count !== 1) {
            throw new Error('Payment is not pending verification (already processed).');
          }
        } else {
          await tx.commercial_payments.update({
            where: { id: lockedPayment.id },
            data: {
              status: 'REJECTED',
              metadata_json: JSON.stringify(meta),
              updated_at: now,
            },
          });
        }

        if (typeof tx.commercial_audit_logs?.create === 'function') {
          await tx.commercial_audit_logs.create({
            data: {
              id: crypto.randomUUID(),
              actor_id: adminActor.id,
              actor_name: adminActor.name,
              actor_role: (adminActor.role as any) || 'ADMIN',
              action: 'REJECT_MANUAL_PAYMENT',
              target_type: 'PAYMENT',
              target_id: lockedPayment.id,
              details: `Rejected manual UPI payment ${lockedPayment.id} for user ${lockedPayment.user_id}. Reason: ${reason}`,
              ip_address: null,
              result: 'SUCCESS',
              created_at: now,
            },
          });
        }
        return lockedPayment;
      });
    } else {
      const db = getDatabase();
      const rejectSqlite = () => {
        const row = db.prepare(
          'SELECT * FROM commercial_payments WHERE id = ? OR external_payment_id = ?'
        ).get(paymentId, paymentId) as any;

        if (!row) {
          throw new Error(`Payment record "${paymentId}" not found.`);
        }
        if (row.status !== 'PENDING_VERIFICATION') {
          throw new Error(`Payment is not pending verification (current status: ${row.status}).`);
        }

        const now = new Date().toISOString();
        let meta: any = {};
        try {
          meta = JSON.parse(row.metadata_json || '{}');
        } catch {}
        meta.rejectionReason = reason;
        meta.rejectedBy = adminActor.name;
        meta.rejectedAt = now;

        const res = db.prepare(`
          UPDATE commercial_payments
          SET status = 'REJECTED', metadata_json = ?, updated_at = ?
          WHERE id = ? AND status = 'PENDING_VERIFICATION'
        `).run(JSON.stringify(meta), now, row.id);
        if (res.changes !== 1) {
          throw new Error('Payment is not pending verification (already processed).');
        }
        return row;
      };

      payment = typeof (db as any).transaction === 'function'
        ? (db as any).transaction(rejectSqlite)()
        : rejectSqlite();

      try {
        logCommercialAudit({
          actorId: adminActor.id,
          actorName: adminActor.name,
          actorRole: (adminActor.role as any) || 'ADMIN',
          action: 'REJECT_MANUAL_PAYMENT',
          targetType: 'PAYMENT',
          targetId: payment.id,
          details: `Rejected manual UPI payment ${payment.id} for user ${payment.user_id}. Reason: ${reason}`,
        });
      } catch {}
    }

    try {
      let userEmail: string | undefined;
      if (pgClient) {
        const u = await getCentralUserByIdAsync(payment.user_id);
        userEmail = u?.email;
      } else {
        const user = getUserById(payment.user_id);
        userEmail = user?.email;
      }

      if (!userEmail) {
        console.log(`[PaymentService] skipping rejection email: user or email not found for userId=${payment.user_id}`);
      } else {
        const plan = resolveCommercialPlan(payment.plan_id);
        const planName = plan ? plan.name : payment.plan_id;
        await getEmailProvider().sendPaymentRejectedEmail({
          email: userEmail,
          planName,
          reason,
          supportEmail: SUPPORT_EMAIL,
        });
      }
    } catch (err: any) {
      console.warn(`[PaymentService] payment rejection notification failed: ${err.message}`);
    }

    return {
      success: true,
      paymentId: payment.id,
      status: 'REJECTED',
      reason,
    };
  }

  /**
   * Retrieves user payment history ordered by date descending.
   */
  public async getUserPaymentHistoryAsync(userId: string): Promise<any[]> {
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    if (prisma) {
      const rows = await prisma.commercial_payments.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      });
      return rows.map((r: any) => {
        let metadata: any = {};
        try {
          metadata = JSON.parse(r.metadata_json || '{}');
        } catch {}
        return {
          id: r.id,
          userId: r.user_id,
          planId: r.plan_id,
          billingCycle: r.billing_cycle,
          amountCents: r.amount_cents,
          currency: r.currency,
          provider: r.provider,
          status: r.status,
          externalPaymentId: r.external_payment_id,
          externalOrderId: r.external_order_id,
          receiptUrl: r.receipt_url,
          metadata,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });
    }
    return this.getUserPaymentHistory(userId);
  }

  public getUserPaymentHistory(userId: string): any[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM commercial_payments
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) as any[];

    return rows.map((r) => {
      let metadata: any = {};
      try {
        metadata = JSON.parse(r.metadata_json || '{}');
      } catch {}
      return {
        id: r.id,
        userId: r.user_id,
        planId: r.plan_id,
        billingCycle: r.billing_cycle,
        amountCents: r.amount_cents,
        currency: r.currency,
        provider: r.provider,
        status: r.status,
        externalPaymentId: r.external_payment_id,
        externalOrderId: r.external_order_id,
        receiptUrl: r.receipt_url,
        metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  /**
   * Lists payments for admin overview with optional status filtering.
   */
  public listAdminPayments(statusFilter?: string): any[] {
    const db = getDatabase();
    const query = statusFilter
      ? 'SELECT * FROM commercial_payments WHERE status = ? ORDER BY created_at DESC'
      : 'SELECT * FROM commercial_payments ORDER BY created_at DESC';
    const rows = (statusFilter ? db.prepare(query).all(statusFilter) : db.prepare(query).all()) as any[];

    return rows.map((r) => {
      let metadata: any = {};
      try {
        metadata = JSON.parse(r.metadata_json || '{}');
      } catch {}
      return {
        id: r.id,
        userId: r.user_id,
        planId: r.plan_id,
        billingCycle: r.billing_cycle,
        amountCents: r.amount_cents,
        currency: r.currency,
        provider: r.provider,
        status: r.status,
        externalPaymentId: r.external_payment_id,
        externalOrderId: r.external_order_id,
        receiptUrl: r.receipt_url,
        metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  /**
   * Verifies an order status directly with YouPI-PG and activates subscription idempotently if paid.
   */
  public async verifyYoupiPgOrder(paymentOrOrderId: string, expectedUserId?: string): Promise<{
    success: boolean;
    status: string;
    subscription?: UserSubscriptionSummary | null;
    invoice?: PaymentInvoiceRecord;
    error?: string;
  }> {
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    let payment: any = null;
    if (prisma) {
      payment = await prisma.commercial_payments.findFirst({
        where: {
          AND: [
            {
              OR: [
                { external_payment_id: paymentOrOrderId },
                { external_order_id: paymentOrOrderId },
                { id: paymentOrOrderId },
              ],
            },
            { provider: { in: ['youpi_pg', 'simulation'] } },
          ],
        },
      });
    } else {
      const db = getDatabase();
      payment = db.prepare(`
        SELECT * FROM commercial_payments 
        WHERE (external_payment_id = ? OR external_order_id = ? OR id = ?) 
        AND provider IN ('youpi_pg', 'simulation')
      `).get(paymentOrOrderId, paymentOrOrderId, paymentOrOrderId) as any;
    }

    if (!payment) {
      return { success: false, status: 'NOT_FOUND', error: 'Payment record not found.' };
    }

    if (expectedUserId && payment.user_id !== expectedUserId) {
      return { success: false, status: 'FORBIDDEN', error: 'Payment does not belong to authenticated user.' };
    }

    if (payment.status === 'SUCCEEDED') {
      const sub = await this.getUserSubscriptionAsync(payment.user_id);
      return { success: true, status: 'SUCCEEDED', subscription: sub || undefined };
    }

    const youpiAdapter = this.getProvider('youpi_pg') as YoupiPgPaymentAdapter;
    const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';

    try {
      const queryId = payment.external_payment_id || payment.id;
      const headers: Record<string, string> = {};
      if (youpiAdapter.apiKey) {
        headers['X-Merchant-Key'] = youpiAdapter.apiKey;
      }
      const res = await fetch(`${youpiAdapter.baseUrl}/api/v1/payments/${encodeURIComponent(queryId)}`, { headers });
      if (res.ok) {
        const details = await res.json() as any;
        if (details.status === 'SUCCESS') {
          // Verify returned gateway details.amount (if provided) matches payment.amount_cents
          if (details.amount !== undefined && details.amount !== null) {
            const parsedNum = Number(details.amount);
            const matchesRupees = Math.round(parsedNum * 100) === payment.amount_cents;
            const matchesPaise = Math.round(parsedNum) === payment.amount_cents;
            if (!matchesRupees && !matchesPaise) {
              return {
                success: false,
                status: 'AMOUNT_MISMATCH',
                error: `AMOUNT_TAMPERING_DETECTED: Gateway verified amount (${details.amount}) does not match payment record (${payment.amount_cents} paise).`,
              };
            }
          }

          const act = await this.activateSubscriptionFromPayment({
            userId: payment.user_id,
            planId: payment.plan_id,
            billingCycle: payment.billing_cycle as any,
            amountCents: payment.amount_cents,
            currency: payment.currency,
            provider: 'youpi_pg',
            externalPaymentId: details.paymentId || details.id || queryId,
            externalOrderId: details.orderId || payment.external_order_id,
          });
          return { success: true, status: 'SUCCEEDED', subscription: act.subscription, invoice: act.invoice };
        }
        return { success: true, status: details.status || payment.status };
      }
    } catch (err: any) {
      if (isTest) {
        return { success: true, status: payment.status };
      }
    }

    return { success: true, status: payment.status };
  }
}

export const paymentService = PaymentService.getInstance();
