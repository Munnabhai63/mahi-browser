import { getDatabase } from '../../../06_DATABASE/connection.js';
import { isPostgresConfigured } from '../../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../../06_DATABASE/prisma-client.js';
import { getCommercialPlans, getCommercialPlanById } from '../commercial-plan-service.js';
import { BillingCycleType } from '../../../10_CONFIG/shared/types/commercial.js';
import {
  PaymentInvoiceRecord,
  PaymentProvider,
  PaymentProviderType,
  UserSubscriptionSummary,
} from './payment-types.js';
import { YoupiPgPaymentAdapter } from './payment-adapters.js';
import { activateSubscriptionFromPaymentImpl } from './payment-activation.js';

export function getUserInvoicesImpl(userId: string): PaymentInvoiceRecord[] {
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

export async function getUserInvoicesAsyncImpl(userId: string): Promise<PaymentInvoiceRecord[]> {
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
  return getUserInvoicesImpl(userId);
}

export function getUserSubscriptionImpl(userId: string): UserSubscriptionSummary | null {
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

export async function getUserSubscriptionAsyncImpl(userId: string): Promise<UserSubscriptionSummary | null> {
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
  return getUserSubscriptionImpl(userId);
}

export function cancelSubscriptionImpl(userId: string): boolean {
  const db = getDatabase();
  const res = db.prepare(`
    UPDATE commercial_subscriptions
    SET status = 'CANCELLED'
    WHERE user_id = ? AND status = 'ACTIVE'
  `).run(userId);
  return res.changes > 0;
}

function mapPaymentRow(r: any) {
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
}

export async function getUserPaymentHistoryAsyncImpl(userId: string): Promise<any[]> {
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  if (prisma) {
    const rows = await prisma.commercial_payments.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapPaymentRow);
  }
  return getUserPaymentHistoryImpl(userId);
}

export function getUserPaymentHistoryImpl(userId: string): any[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM commercial_payments
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as any[];

  return rows.map(mapPaymentRow);
}

export function listAdminPaymentsImpl(statusFilter?: string): any[] {
  const db = getDatabase();
  const query = statusFilter
    ? 'SELECT * FROM commercial_payments WHERE status = ? ORDER BY created_at DESC'
    : 'SELECT * FROM commercial_payments ORDER BY created_at DESC';
  const rows = (statusFilter ? db.prepare(query).all(statusFilter) : db.prepare(query).all()) as any[];
  return rows.map(mapPaymentRow);
}

export async function verifyYoupiPgOrderImpl(
  paymentOrOrderId: string,
  getProvider: (type?: PaymentProviderType) => PaymentProvider,
  expectedUserId?: string
): Promise<{
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
    const sub = await getUserSubscriptionAsyncImpl(payment.user_id);
    return { success: true, status: 'SUCCEEDED', subscription: sub || undefined };
  }

  const youpiAdapter = getProvider('youpi_pg') as YoupiPgPaymentAdapter;
  const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';

  try {
    const queryId = payment.external_payment_id || payment.id;
    const headers: Record<string, string> = {};
    if (youpiAdapter.apiKey) {
      headers['X-Merchant-Key'] = youpiAdapter.apiKey;
    }
    const res = await fetch(`${youpiAdapter.baseUrl}/api/v1/payments/${encodeURIComponent(queryId)}`, { headers });
    if (res.ok) {
      const details = (await res.json()) as any;
      if (details.status === 'SUCCESS') {
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

        const act = await activateSubscriptionFromPaymentImpl({
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
  } catch {
    if (isTest) {
      return { success: true, status: payment.status };
    }
  }

  return { success: true, status: payment.status };
}
