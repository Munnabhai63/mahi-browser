import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../../../06_DATABASE/prisma-client.js';
import { isPostgresConfigured } from '../../../06_DATABASE/central-repository.js';
import { getCommercialPlanById, DEFAULT_COMMERCIAL_PLANS } from '../commercial-plan-service.js';
import type { CommercialPlan, BillingCycleType } from '../../../10_CONFIG/shared/types/commercial.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('payment-types');

export type PaymentProviderType = 'stripe' | 'razorpay' | 'youpi_pg' | 'simulation';

export type PgBillingClient = Partial<PrismaClient>;

export interface CommercialPaymentRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  provider: string;
  external_order_id: string | null;
  external_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  plan_id: string;
  billing_cycle: string;
  receipt_url: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

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
  gatewayMeta?: Record<string, unknown>;
}

export interface PaymentWebhookEvent {
  id: string;
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
  metadata?: Record<string, unknown>;
  rawPayload?: unknown;
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

export interface PaymentProvider {
  readonly name: PaymentProviderType;
  createCheckoutSession(
    req: CheckoutSessionRequest,
    plan: CommercialPlan,
    amountCents: number
  ): Promise<CheckoutSessionResponse>;
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean;
  parseWebhookPayload(rawBody: string): PaymentWebhookEvent;
}

export function resolveCommercialPlan(planId: string): CommercialPlan | null {
  const plan = getCommercialPlanById(planId);
  if (plan) return plan;
  const normalized = (planId || '').toLowerCase().trim();
  const fallback = DEFAULT_COMMERCIAL_PLANS.find(
    (p) => p.id === planId || p.id.toLowerCase() === normalized || p.tier.toLowerCase() === normalized
  );
  return fallback || null;
}

export function hashWebhookContent(rawBody: string): string {
  return crypto.createHash('sha256').update(rawBody || '').digest('hex');
}

export function calculatePlanAmountCents(plan: CommercialPlan, billingCycle: BillingCycleType): number {
  const rateUsd = billingCycle === 'ANNUAL' || billingCycle === 'SEMI_ANNUAL' ? plan.priceAnnual : plan.priceMonthly;
  return rateUsd * 100;
}

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

export function isStrictProductionPostgres(): boolean {
  const proc = typeof process !== 'undefined' ? (process as NodeJS.Process & { versions?: { electron?: string } }) : undefined;
  return (
    isPostgresConfigured() &&
    process.env.NODE_ENV === 'production' &&
    !process.env.VITEST &&
    !proc?.versions?.electron
  );
}

export function resolvePgBillingClient(requiredModels: Array<keyof PrismaClient>): PgBillingClient | null {
  const prisma = isPostgresConfigured() ? (getPrismaClient() as PgBillingClient | null) : null;
  if (!prisma) return null;

  const ready = requiredModels.every((m) => Boolean(prisma[m]));
  if (!ready) {
    if (isStrictProductionPostgres()) {
      throw new Error(
        `[PaymentService][PG_UNAVAILABLE] Required Prisma billing models (${requiredModels.join(', ')}) unavailable in production.`
      );
    }
    log.warn(
      `[PaymentService][PG_CAPABILITY_MISSING] Prisma client cannot serve ${requiredModels.join(', ')}; falling back to local SQLite.`
    );
    return null;
  }
  return prisma;
}

export async function withPgTransaction<T>(
  prisma: PgBillingClient,
  fn: (tx: PgBillingClient) => Promise<T>
): Promise<T> {
  const txFn = prisma.$transaction as ((cb: (tx: PgBillingClient) => Promise<T>) => Promise<T>) | undefined;
  if (typeof txFn === 'function') {
    return await txFn.call(prisma, async (tx) => fn(tx));
  }
  return await fn(prisma);
}

export function isPgUniqueViolation(err: unknown): boolean {
  const record = err as { message?: unknown; code?: unknown } | null;
  const msg = String(record?.message || '').toLowerCase();
  return (
    record?.code === 'P2002' ||
    record?.code === '23505' ||
    msg.includes('unique constraint') ||
    msg.includes('duplicate key')
  );
}
