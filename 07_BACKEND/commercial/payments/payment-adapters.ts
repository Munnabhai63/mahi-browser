import crypto from 'node:crypto';
import type { CommercialPlan } from '../../../10_CONFIG/shared/types/commercial.js';
import { apiUrl, websiteUrl } from '../../../10_CONFIG/shared/site-config.js';
import {
  type CheckoutSessionRequest,
  type CheckoutSessionResponse,
  PaymentGatewayNotConfiguredError,
  type PaymentProvider,
  type PaymentProviderType,
  type PaymentWebhookEvent,
  hashWebhookContent,
} from './payment-types.js';

interface StripeSessionCreateResponse {
  id: string;
  url?: string;
  currency?: string;
}

interface RazorpayOrderCreateResponse {
  id: string;
  amount: number;
}

interface YoupiCreatePaymentResponse {
  paymentId?: string;
  id?: string;
  checkoutUrl?: string;
  orderId?: string;
  queuePosition?: number;
}

function getAdapterErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
      params.append('success_url', req.successUrl || websiteUrl('/pricing?status=success&session_id={CHECKOUT_SESSION_ID}', { productionFallback: true }));
      params.append('cancel_url', req.cancelUrl || websiteUrl('/pricing', { productionFallback: true }));

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

      const sessionData = (await response.json()) as StripeSessionCreateResponse;
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
    } catch (err: unknown) {
      if (err instanceof PaymentGatewayNotConfiguredError) throw err;
      throw new Error(`Failed to create Stripe checkout session: ${getAdapterErrorMessage(err)}`);
    }
  }

  public verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    if (!signature) return false;
    const effectiveSecret = secret || this.defaultSecret;

    const parts = signature.split(',').reduce((acc, curr) => {
      const [k, v] = curr.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {} as Record<string, string>);

    if (!parts.t || !parts.v1) return false;

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
      billingCycle: dataObj.metadata?.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
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
        amount: Math.round(amountCents),
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

      const orderData = (await response.json()) as RazorpayOrderCreateResponse;
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
    } catch (err: unknown) {
      if (err instanceof PaymentGatewayNotConfiguredError) throw err;
      throw new Error(`Failed to create Razorpay order: ${getAdapterErrorMessage(err)}`);
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

export class SimulationPaymentAdapter implements PaymentProvider {
  public readonly name: PaymentProviderType = 'simulation';

  constructor() {
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
    const checkoutUrl = websiteUrl(`/pricing?status=simulated&session_id=${sessionId}`, { productionFallback: true });

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
      receiptUrl: payload.receiptUrl || apiUrl(`/api/v1/billing/invoices?receipt=${contentHash.slice(0, 16)}`, { productionFallback: true }),
      metadata: payload.metadata,
      rawPayload: payload,
    };
  }
}

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

    if (!isTest && (!hasBaseUrl || !hasApiKey)) {
      throw new PaymentGatewayNotConfiguredError(
        'youpi_pg',
        'YouPI-PG credentials (YOUPI_PG_BASE_URL / BASE_PAYMENT_API_URL and YOUPI_PG_API_KEY / YOUPI_PG_SECRET) are not configured.'
      );
    }

    const orderId = req.idempotencyKey || `mahi_ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const amountRupees = amountCents / 100;
    const returnUrl = req.successUrl || websiteUrl(`/pricing?status=success&orderId=${orderId}`, { productionFallback: true });

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

      const data = (await res.json()) as YoupiCreatePaymentResponse;
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
    } catch (err: unknown) {
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
