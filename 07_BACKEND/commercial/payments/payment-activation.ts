import crypto from 'node:crypto';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../../06_DATABASE/central-repository.js';
import { getCommercialPlanById } from '../commercial-plan-service.js';
import { BillingCycleType } from '../../../10_CONFIG/shared/types/commercial.js';
import {
  calculateAuthoritativeOrderTotal,
  legacyPlanIdToCanonical,
  normalizeBillingCycle,
  resolveSubscriptionDurationDays,
} from '../canonical-plan-catalog.js';
import { getUserById } from '../commercial-auth-service.js';
import { getCentralUserByIdAsync } from '../../../05_AUTH/central-auth-service.js';
import { createLicense } from '../../../04_LICENSING/license-engine.js';
import { assertNotEmergencyFrozen } from '../../services/kill-switch-service.js';
import { websiteUrl } from '../../../10_CONFIG/shared/site-config.js';
import {
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  PaymentInvoiceRecord,
  PaymentProvider,
  PaymentProviderType,
  PaymentWebhookEvent,
  UserSubscriptionSummary,
  calculatePlanAmountCents,
  isPgUniqueViolation,
  isStrictProductionPostgres,
  resolveCommercialPlan,
  resolvePgBillingClient,
  withPgTransaction,
} from './payment-types.js';
import { createLogger } from '../../utils/logger.js';
const log = createLogger('payment-activation');

export async function createCheckoutSessionImpl(
  req: CheckoutSessionRequest,
  defaultProvider: PaymentProviderType,
  getProvider: (type?: PaymentProviderType) => PaymentProvider,
  providerType?: PaymentProviderType
): Promise<CheckoutSessionResponse> {
  await assertNotEmergencyFrozen('checkout');
  const pgClient = resolvePgBillingClient(['commercial_payments', 'auth_users']);
  const db = pgClient ? null : getDatabase();

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
    amountCents = calculatePlanAmountCents(plan, effectiveBillingCycle);
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
    checkoutUrl: existing.receipt_url || websiteUrl(`/pricing?sessionId=${encodeURIComponent(existing.id)}`, { productionFallback: true }),
    orderId: existing.external_order_id,
    amountCents: existing.amount_cents,
    currency: existing.currency,
    provider: existing.provider as PaymentProviderType,
    planId: existing.plan_id,
    billingCycle: existing.billing_cycle as any,
    createdAt: existing.created_at,
  });

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

  const resolvedCurrency = (normalizedReq.currency || (plan.id.startsWith('plan_') ? 'USD' : 'INR')).toUpperCase();
  const effectiveProvider = providerType || (resolvedCurrency === 'INR' ? 'youpi_pg' : defaultProvider);
  const provider = getProvider(effectiveProvider);
  const session = await provider.createCheckoutSession(normalizedReq, plan, amountCents);
  if (normalizedReq.idempotencyKey) {
    session.orderId = normalizedReq.idempotencyKey;
  }

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
    const winner = await withPgTransaction(pgClient, async (tx) => {
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

export function validateWebhookEventAmountAndPlan(event: PaymentWebhookEvent): void {
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
    expectedAmount = calculatePlanAmountCents(targetPlan, event.billingCycle);
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
      expectedAmount = calculatePlanAmountCents(targetPlan, event.billingCycle);
    }
  }

  if (event.type === 'payment.succeeded' && event.amountCents < expectedAmount) {
    throw new Error(
      `AMOUNT_TAMPERING_DETECTED: Paid amount (${event.amountCents}) is less than required plan price (${expectedAmount}).`
    );
  }
}

export async function activateSubscriptionFromPaymentImpl(params: {
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
    : resolvePgBillingClient([
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
    if (isStrictProductionPostgres()) {
      throw new Error('[PaymentService][PG_UNAVAILABLE] Incomplete Prisma billing client in production.');
    }
    log.warn(
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
        log.error('[PaymentService][CRITICAL] PG plan sync error', err?.message);
        planSyncFailed = true;
      }

      if (planSyncFailed) {
        log.error('[PaymentService][RECONCILE_REQUIRED] Subscription active but PG out of sync for user', params.userId);
      }

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
            log.warn(`[PaymentService] Mirror-missing user ${params.userId} in commercial_users; skipping commercial_users update.`);
          }
        }
      } catch (err: any) {
        log.warn(`[PaymentService] Failed to update commercial_users plan_id for ${params.userId}:`, err?.message);
      }

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
        } catch (err) {
          log.debug('Customer name lookup fell back to userId during PG license minting', {
            userId: params.userId,
            err: err instanceof Error ? err.message : String(err),
          });
        }

        const { generateLicenseKey } = await import('../../../04_LICENSING/license-engine.js');
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
      : await withPgTransaction(pgClient, executePgActivation);
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

      db.prepare(`
        INSERT OR IGNORE INTO commercial_users (id, email, password_hash, salt, name, plan_id, created_at, updated_at)
        VALUES (?, ?, 'placeholder', 'placeholder', 'Subscriber', ?, ?, ?)
      `).run(params.userId, `${params.userId}@commercial.local`, targetPlan.id, now, now);
      db.prepare(`
        INSERT OR IGNORE INTO commercial_plans (id, name, tier, limits_json, created_at)
        VALUES (?, 'Plan', 'pro', '{}', ?)
      `).run(targetPlan.id, now);

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

      try {
        db.prepare(`
          UPDATE auth_users
          SET plan_id = ?, profile_quota = ?, updated_at = ?
          WHERE id = ?
        `).run(targetPlan.id, targetPlan.limits.maxProfiles, now, params.userId);
      } catch (err: any) {
        log.error('[PaymentService] SQLite auth_users plan update error:', err?.message);
      }

      try {
        db.prepare(`
          UPDATE commercial_users
          SET plan_id = ?
          WHERE id = ?
        `).run(targetPlan.id, params.userId);
      } catch (err: any) {
        log.error('[PaymentService] SQLite commercial_users plan update error:', err?.message);
      }

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
          } catch (err) {
            log.debug('Customer name lookup fell back to userId during SQLite license minting', {
              userId: params.userId,
              err: err instanceof Error ? err.message : String(err),
            });
          }

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
        log.warn(`[PaymentService] licence creation failed for user ${params.userId}:`, licErr?.message || licErr);
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
        log.error('[PaymentService][CRITICAL] PG plan sync error', err?.message);
        planSyncFailed = true;
      }
    }

    if (planSyncFailed) {
      log.error('[PaymentService][RECONCILE_REQUIRED] Subscription active but PG out of sync for user', params.userId);
    }
  }

  return {
    subscription: {
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
    },
    invoice: {
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
    },
    licence: licenceResult,
    planSyncFailed,
  };
}

export async function handleWebhookImpl(
  providerType: PaymentProviderType,
  rawPayload: string,
  signature: string,
  getProvider: (type?: PaymentProviderType) => PaymentProvider,
  options?: { secret?: string }
): Promise<{ success: boolean; eventId: string; type: string; message: string }> {
  await assertNotEmergencyFrozen('payment_webhook');
  const provider = getProvider(providerType);

  const isValid = provider.verifyWebhookSignature(rawPayload, signature, options?.secret);
  if (!isValid) {
    throw new Error('INVALID_WEBHOOK_SIGNATURE: Cryptographic verification of payment webhook failed.');
  }

  const event = provider.parseWebhookPayload(rawPayload);
  const now = new Date().toISOString();

  const pgClient = resolvePgBillingClient([
    'commercial_webhook_events',
    'commercial_payments',
    'commercial_subscriptions',
    'commercial_billing_invoices',
    'licenses',
    'auth_users',
  ]);

  if (pgClient) {
    return await withPgTransaction(pgClient, async (tx) => {
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
            if (!isPgUniqueViolation(dupErr)) throw dupErr;
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

      validateWebhookEventAmountAndPlan(event);

      if (event.type === 'payment.succeeded') {
        await activateSubscriptionFromPaymentImpl({
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

  const db = getDatabase();

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

    validateWebhookEventAmountAndPlan(event);

    if (event.type === 'payment.succeeded') {
      await activateSubscriptionFromPaymentImpl({
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
    } catch (cleanupErr) {
      log.warn('Failed releasing PROCESSING lock row after webhook processing failure', {
        eventId: event.id,
        err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    }
    throw err;
  }

  return {
    success: true,
    eventId: event.id,
    type: event.type,
    message: `Successfully processed ${event.type} event.`,
  };
}
