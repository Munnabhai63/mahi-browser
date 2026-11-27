import crypto from 'node:crypto';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { BillingCycleType } from '../../../10_CONFIG/shared/types/commercial.js';
import { calculateAuthoritativeOrderTotal, normalizeBillingCycle } from '../canonical-plan-catalog.js';
import { logCommercialAudit } from '../commercial-audit-service.js';
import { getEmailProvider } from '../../../05_AUTH/email-service.js';
import { CONTACT_CONFIG, getRuntimeContactConfig } from '../../../10_CONFIG/contact-config.js';
import { getUserById } from '../commercial-auth-service.js';
import { getCentralUserByIdAsync } from '../../../05_AUTH/central-auth-service.js';
import { assertNotEmergencyFrozen } from '../../services/kill-switch-service.js';
import {
  PaymentInvoiceRecord,
  UserSubscriptionSummary,
  isPgUniqueViolation,
  resolveCommercialPlan,
  resolvePgBillingClient,
  withPgTransaction,
} from './payment-types.js';
import { activateSubscriptionFromPaymentImpl } from './payment-activation.js';

export async function submitManualUpiPaymentImpl(params: {
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
  const amountPaise = orderTotal.totalChargeMinor;

  const paymentId = `pay_upi_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const externalOrderId = `upi_ord_${Date.now()}`;
  const now = new Date().toISOString();

  const pgClient = resolvePgBillingClient(['commercial_payments']);
  if (pgClient) {
    await withPgTransaction(pgClient, async (tx) => {
      const existing = await tx.commercial_payments.findFirst({
        where: {
          OR: [{ external_payment_id: cleanUtr }, { id: cleanUtr }],
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
        if (isPgUniqueViolation(err)) {
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
              details: `UPI ₹${amountPaise / 100} pending — UTR ${cleanUtr} — plan ${plan.id}`,
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
        details: `UPI ₹${amountPaise / 100} pending — UTR ${cleanUtr} — plan ${plan.id}`,
      });
    } catch {}
  }

  try {
    const emailProvider = getEmailProvider();
    const adminEmail = process.env.ADMIN_PAYMENT_EMAIL || getRuntimeContactConfig().supportEmail;
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

export async function submitManualCryptoPaymentImpl(params: {
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
  const runtimeContact = getRuntimeContactConfig();
  const network = (params.network || runtimeContact.usdt.network || 'TRC-20 (TRON)').trim();
  const walletAddress = (runtimeContact.usdt.address || '').trim();

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

  const pgClient = resolvePgBillingClient(['commercial_payments']);
  if (pgClient) {
    await withPgTransaction(pgClient, async (tx) => {
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
        if (isPgUniqueViolation(err)) {
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
    const adminEmail = process.env.ADMIN_PAYMENT_EMAIL || getRuntimeContactConfig().supportEmail;
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

export async function approveManualPaymentImpl(
  paymentId: string,
  adminActor: { id: string; name: string; role?: string }
): Promise<{ success: boolean; paymentId: string; status: string; userId: string }> {
  await assertNotEmergencyFrozen('manual_payment_approval');
  const pgClient = resolvePgBillingClient([
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
    const txOutcome = await withPgTransaction(pgClient, async (tx) => {
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

      const activated = await activateSubscriptionFromPaymentImpl({
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

    actResult = await activateSubscriptionFromPaymentImpl({
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

export async function rejectManualPaymentImpl(
  paymentId: string,
  adminActor: { id: string; name: string; role?: string },
  reason: string
): Promise<{ success: boolean; paymentId: string; status: string; reason: string }> {
  const pgClient = resolvePgBillingClient(['commercial_payments']);
  let payment: any = null;

  if (pgClient) {
    payment = await withPgTransaction(pgClient, async (tx) => {
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
        supportEmail: getRuntimeContactConfig().supportEmail,
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
