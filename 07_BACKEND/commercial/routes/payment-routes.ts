import http from 'node:http';
import { URL } from 'node:url';
import { sendJSON, parseBody, parseRawBuffer, getAuthUserAsync } from './router-shared.js';
import { sendSafeError, validateStrictBody } from '../../utils/app-error.js';
import {
  UpiSubmitSchema,
  CryptoSubmitSchema,
  BillingCheckoutSchema,
  VerifyRazorpaySchema,
  VerifyYoupiSchema,
} from '../validation/commercial-schemas.js';
import { getRuntimePaymentMetadata } from '../../../10_CONFIG/contact-config.js';
import {
  paymentService,
  PaymentProviderType,
  PaymentGatewayNotConfiguredError,
  verifyRazorpayPaymentSignature,
  resolveCommercialPlan,
} from '../payment-service.js';
import { normalizeBillingCycle } from '../canonical-plan-catalog.js';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../../06_DATABASE/prisma-client.js';
import { evaluateUserEntitlements } from '../commercial-entitlement-service.js';
import { rejectIfEmergencyFrozen } from '../../services/kill-switch-service.js';

export async function handlePaymentRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if ((routePath === '/v1/account/payment-info' || routePath === '/api/v1/account/payment-info' || routePath === '/api/v1/commercial/payment-info') && method === 'GET') {
    const contact = getRuntimePaymentMetadata();
    sendJSON(res, 200, {
      success: true,
      upi_id: contact.upi.id,
      upi_account_holder: contact.upi.accountHolder,
      upi_qr_asset: contact.upi.qrAsset,
      price_inr: contact.defaultPriceInr,
      price_usd: contact.defaultPriceUsdt,
      price_usdt: contact.defaultPriceUsdt,
      usdt_address: contact.usdt.address,
      usdt_network: contact.usdt.network,
      usdt_qr_asset: contact.usdt.qrAsset,
      usdt_enabled: contact.usdt.enabled,
      whatsapp_number: contact.whatsappNumber,
      whatsapp_raw_number: contact.whatsappRawNumber,
      whatsapp_display: contact.whatsappDisplay,
      whatsapp_url: contact.whatsappUrl,
      support_email: contact.supportEmail,
      business_email: contact.businessEmail,
      legal_seller_name: contact.legalSellerName,
    });
    return true;
  }

  if ((routePath === '/v1/account/payments/upi/submit' || routePath === '/api/v1/account/payments/upi/submit') && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    if (await rejectIfEmergencyFrozen(res, 'manual_upi_checkout')) return true;
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(UpiSubmitSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const utr = (body.utr || '').trim();
    if (!utr || utr.length < 6) {
      sendJSON(res, 400, { success: false, error: 'Invalid UTR: Transaction reference must be at least 6 characters.' });
      return true;
    }
    const planId = body.planId || body.plan_id || body.plan;
    if (!planId || typeof planId !== 'string' || !planId.trim()) {
      sendJSON(res, 400, { success: false, error: 'planId is required. Cannot determine payment amount.' });
      return true;
    }
    const billingCycle = normalizeBillingCycle(
      String(body.billingCycle || body.billing_cycle || body.billing || ''),
      planId
    );
    const proofAsset = body.proofAsset || body.proof_asset || body.receiptUrl || body.receipt_url;
    const extraMembers = body.extraMembers || body.extra_members;
    const extraProxyGb = body.extraProxyGb || body.extra_proxy_gb;

    try {
      const result = await paymentService.submitManualUpiPayment({
        userId: auth.userId,
        planId,
        billingCycle,
        utr,
        proofAsset,
        extraMembers: extraMembers ? Number(extraMembers) : undefined,
        extraProxyGb: extraProxyGb ? Number(extraProxyGb) : undefined,
      });

      sendJSON(res, 200, {
        success: true,
        payment_id: result.paymentId,
        status: result.status,
        utr: result.utr,
        amount_paise: result.amountPaise,
        message: 'Payment submitted successfully for verification.',
      });
      return true;
    } catch (err: any) {
      if (err?.message && err.message.includes('UTR_ALREADY_EXISTS')) {
        sendSafeError(res, err, { fallbackStatus: 409 });
        return true;
      }
      sendSafeError(res, err, { fallbackStatus: 400 });
      return true;
    }
  }

  if ((routePath === '/v1/account/payments/crypto/submit' || routePath === '/api/v1/account/payments/crypto/submit') && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    if (await rejectIfEmergencyFrozen(res, 'manual_crypto_checkout')) return true;
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(CryptoSubmitSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const txHash = (body.txHash || body.tx_hash || body.hash || body.utr || '').trim();
    if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
      sendJSON(res, 400, { success: false, error: 'Invalid transaction hash: please paste the full 64-character TRC-20 transaction hash.' });
      return true;
    }
    const planId = body.planId || body.plan_id || body.plan;
    if (!planId || typeof planId !== 'string' || !planId.trim()) {
      sendJSON(res, 400, { success: false, error: 'planId is required. Cannot determine payment amount.' });
      return true;
    }
    const billingCycle = normalizeBillingCycle(
      String(body.billingCycle || body.billing_cycle || body.billing || ''),
      planId
    );
    const network = typeof body.network === 'string' && body.network.trim() ? body.network.trim() : undefined;
    const proofAsset = body.proofAsset || body.proof_asset || body.receiptUrl || body.receipt_url;
    const extraMembers = body.extraMembers || body.extra_members;
    const extraProxyGb = body.extraProxyGb || body.extra_proxy_gb;

    try {
      const result = await paymentService.submitManualCryptoPayment({
        userId: auth.userId,
        planId,
        billingCycle,
        txHash,
        network,
        proofAsset,
        extraMembers: extraMembers ? Number(extraMembers) : undefined,
        extraProxyGb: extraProxyGb ? Number(extraProxyGb) : undefined,
      });

      sendJSON(res, 200, {
        success: true,
        payment_id: result.paymentId,
        status: result.status,
        tx_hash: result.txHash,
        amount_cents: result.amountCents,
        currency: result.currency,
        network: result.network,
        wallet_address: result.walletAddress,
        message: 'USDT (TRC-20) transaction submitted for verification.',
      });
      return true;
    } catch (err: any) {
      if (err?.message && err.message.includes('TX_HASH_ALREADY_EXISTS')) {
        sendSafeError(res, err, { fallbackStatus: 409 });
        return true;
      }
      sendSafeError(res, err, { fallbackStatus: 400 });
      return true;
    }
  }

  if ((routePath === '/v1/account/payments/status' || routePath === '/api/v1/account/payments/status') && method === 'GET') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const payments = await paymentService.getUserPaymentHistoryAsync(auth.userId);
    sendJSON(res, 200, { success: true, payments, data: payments });
    return true;
  }

  // -------------------------------------------------------------
  // 0.1 CENTRAL JWT BILLING & CHECKOUT ENDPOINTS
  // -------------------------------------------------------------
  if (routePath === '/api/v1/billing/gateways' && method === 'GET') {
    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
    const isTest = process.env.NODE_ENV === 'test' || process.env.PAYMENT_ALLOW_TEST_ADAPTERS === 'true';
    const hasYoupi = Boolean(
      (process.env.YOUPI_PG_BASE_URL || process.env.BASE_PAYMENT_API_URL) &&
      (process.env.YOUPI_PG_API_KEY || process.env.YOUPI_PG_SECRET)
    );
    const contact = getRuntimePaymentMetadata();
    const gateways = [
      {
        id: 'youpi_pg',
        name: 'Instant UPI / Dynamic QR (0% Fee)',
        enabled: hasYoupi || isTest,
        currency: 'INR',
        isDirect: true,
        description: 'Instant 0% fee peer-to-bank settlement via GPay, PhonePe, Paytm & BHIM',
      },
      {
        id: 'usdt_trc20',
        name: 'Crypto USDT (TRC-20)',
        enabled: contact.usdt.enabled,
        currency: 'USD',
        isDirect: true,
        walletAddress: contact.usdt.address,
        network: contact.usdt.network,
        qrAsset: contact.usdt.qrAssetWeb,
        description: 'Zero-fee USDT (TRC-20 / TRON) payment with 64-character TX hash verification',
      },
      {
        id: 'stripe',
        name: 'Credit & Debit Cards (Global)',
        enabled: hasStripe || isTest,
        currency: 'USD',
        isDirect: false,
        description: 'International card processing powered by Stripe',
      },
      {
        id: 'upi_manual',
        name: 'Direct UPI Transfer (UTR)',
        enabled: contact.upi.enabled,
        currency: 'INR',
        isDirect: true,
        upiId: contact.upi.id,
        accountHolder: contact.upi.accountHolder,
        qrAsset: contact.upi.qrAssetWeb,
        description: 'Direct bank transfer to Slice UPI ID with manual admin verification',
      },
    ];
    sendJSON(res, 200, {
      success: true,
      gateways,
      support: {
        email: contact.supportEmail,
        businessEmail: contact.businessEmail,
        whatsappNumber: contact.whatsappNumber,
        whatsappRawNumber: contact.whatsappRawNumber,
        whatsappDisplay: contact.whatsappDisplay,
        whatsappUrl: contact.whatsappUrl,
        sellerName: contact.legalSellerName,
      },
    });
    return true;
  }

  if (routePath === '/api/v1/billing/checkout' && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    if (await rejectIfEmergencyFrozen(res, 'billing_checkout')) return true;
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(BillingCheckoutSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const planId = body.planId || body.plan;
    if (!planId) {
      sendJSON(res, 400, { success: false, error: 'Missing required field: planId.' });
      return true;
    }
    const billingCycle = normalizeBillingCycle(
      String(body.billingCycle || body.billing || ''),
      planId
    );
    const provider = ((body.provider || 'youpi_pg') as string).toLowerCase() as PaymentProviderType;
    const currency = (
      String(body.currency || (provider === 'stripe' ? 'USD' : 'INR')).toUpperCase() === 'USD'
        ? 'USD'
        : 'INR'
    ) as 'INR' | 'USD';
    const extraMembers = Number(body.extraMembers || 0);
    const extraProxyGb = Number(body.extraProxyGb || 0);

    try {
      const session = await paymentService.createCheckoutSession({
        userId: auth.userId,
        planId,
        billingCycle,
        currency,
        extraMembers,
        extraProxyGb,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        idempotencyKey: body.idempotencyKey,
      }, provider);

      sendJSON(res, 200, {
        success: true,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        orderId: session.orderId,
        gatewayMeta: session.gatewayMeta,
        amountMinor: session.amountCents,
        currency: session.currency,
        provider: session.provider,
        planId: session.planId,
        billingCycle: session.billingCycle,
      });
      return true;
    } catch (err: any) {
      const status = err instanceof PaymentGatewayNotConfiguredError ? 503 : 400;
      sendSafeError(res, err, { fallbackStatus: status });
      return true;
    }
  }

  if (routePath === '/api/v1/billing/verify-razorpay' && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    if (await rejectIfEmergencyFrozen(res, 'verify_razorpay')) return true;
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(VerifyRazorpaySchema, rawBody, res);
    if (!parsed.ok) return true;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      sendJSON(res, 400, { success: false, error: 'Missing required Razorpay verification fields.' });
      return true;
    }

    const isVerified = verifyRazorpayPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isVerified) {
      sendJSON(res, 400, { success: false, error: 'Invalid Razorpay payment signature.' });
      return true;
    }

    let pending: any = null;
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    if (prisma) {
      pending = await prisma.commercial_payments.findFirst({
        where: {
          OR: [
            { external_order_id: razorpay_order_id },
            { id: razorpay_order_id },
          ],
        },
      });
    } else {
      const db = getDatabase();
      pending = db.prepare('SELECT * FROM commercial_payments WHERE external_order_id = ? OR id = ?').get(razorpay_order_id, razorpay_order_id) as any;
    }
    if (!pending) {
      sendJSON(res, 404, { success: false, error: 'Order not found.' });
      return true;
    }
    if (pending.user_id !== auth.userId) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Order belongs to another user.' });
      return true;
    }
    if (pending.status === 'SUCCEEDED') {
      const existingSub = paymentService.getUserSubscription(auth.userId);
      sendJSON(res, 200, {
        success: true,
        message: 'Payment already verified and subscription activated.',
        subscription: existingSub,
      });
      return true;
    }

    const planId = pending.plan_id;
    const billingCycle = (pending.billing_cycle || 'MONTHLY') as 'MONTHLY' | 'ANNUAL';
    const amountCents = pending.amount_cents;

    const result = await paymentService.activateSubscriptionFromPayment({
      userId: auth.userId,
      planId,
      billingCycle,
      amountCents,
      currency: pending.currency || 'INR',
      provider: 'razorpay',
      externalPaymentId: razorpay_payment_id,
      externalOrderId: razorpay_order_id,
    });

    sendJSON(res, 200, {
      success: true,
      message: 'Payment verified and subscription activated successfully.',
      subscription: result.subscription,
      invoice: result.invoice,
    });
    return true;
  }

  if (routePath === '/api/v1/billing/verify-youpi' && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    if (await rejectIfEmergencyFrozen(res, 'verify_youpi')) return true;
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(VerifyYoupiSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const paymentOrOrderId = body.paymentId || body.orderId || body.external_payment_id || body.externalOrderId;
    if (!paymentOrOrderId) {
      sendJSON(res, 400, { success: false, error: 'Missing required field: paymentId or orderId.' });
      return true;
    }

    try {
      const result = await paymentService.verifyYoupiPgOrder(paymentOrOrderId, auth.userId);
      const statusCode = result.status === 'FORBIDDEN' ? 403 : result.status === 'NOT_FOUND' ? 404 : result.success ? 200 : 400;
      sendJSON(res, statusCode, result);
      return true;
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 500 });
      return true;
    }
  }

  const youpiStatusMatch = routePath.match(/^\/api\/v1\/billing\/youpi\/status\/([a-zA-Z0-9_.-]+)$/);
  if (youpiStatusMatch && method === 'GET') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const orderId = youpiStatusMatch[1];
    try {
      const result = await paymentService.verifyYoupiPgOrder(orderId, auth.userId);
      const statusCode = result.status === 'FORBIDDEN' ? 403 : result.status === 'NOT_FOUND' ? 404 : result.success ? 200 : 400;
      sendJSON(res, statusCode, result);
      return true;
    } catch (err: any) {
      sendSafeError(res, err, { fallbackStatus: 500 });
      return true;
    }
  }

  if (
    (routePath === '/api/v1/billing/webhook' ||
      routePath === '/api/v1/billing/webhook/youpi' ||
      routePath === '/api/v1/billing/webhook/youpi_pg' ||
      routePath === '/api/v1/commercial/checkout/webhook' ||
      routePath === '/api/v1/commercial/checkout/webhook/youpi') &&
    method === 'POST'
  ) {
    if (await rejectIfEmergencyFrozen(res, 'payment_webhook')) return true;
    try {
      const rawBody = (await parseRawBuffer(req, { maxBytes: 2 * 1024 * 1024, timeoutMs: 30_000 })).toString('utf-8');
      const signature = (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature'] ||
        req.headers['stripe-signature'] ||
        req.headers['x-razorpay-signature'] ||
        ''
      ) as string;

      const ALLOWED_WEBHOOK_PROVIDERS = ['youpi_pg', 'razorpay', 'stripe'];
      let provider: PaymentProviderType = 'youpi_pg';
      if (req.headers['stripe-signature']) {
        provider = 'stripe';
      } else if (req.headers['x-razorpay-signature']) {
        provider = 'razorpay';
      } else if (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature']
      ) {
        provider = 'youpi_pg';
      }

      if (parsedUrl.searchParams.get('provider')) {
        const requested = parsedUrl.searchParams.get('provider');
        if (!requested || !ALLOWED_WEBHOOK_PROVIDERS.includes(requested)) {
          sendJSON(res, 404, { success: false, error: 'Unknown webhook provider.' });
          return true;
        }
        provider = requested as PaymentProviderType;
      }

      const result = await paymentService.handleWebhook(provider, rawBody, signature);
      sendJSON(res, 200, { success: true, data: result });
      return true;
    } catch (err: any) {
      const isSig = Boolean(err?.message && err.message.includes('INVALID_WEBHOOK_SIGNATURE'));
      const fallbackStatus = isSig ? 400 : 500;
      const status = typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : fallbackStatus;
      sendSafeError(res, err, { fallbackStatus: status });
      return true;
    }
  }

  if (routePath === '/api/v1/billing/subscription' && method === 'GET') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const sub = await paymentService.getUserSubscriptionAsync(auth.userId);
    const entitlements = evaluateUserEntitlements(auth.userId);
    sendJSON(res, 200, {
      success: true,
      subscription: sub,
      entitlements,
    });
    return true;
  }

  if (routePath === '/api/v1/billing/invoices' && method === 'GET') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const invoices = await paymentService.getUserInvoicesAsync(auth.userId);
    sendJSON(res, 200, { success: true, invoices });
    return true;
  }

  return false;
}
