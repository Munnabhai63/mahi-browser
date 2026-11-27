import http from 'node:http';
import { URL } from 'node:url';
import { saveIdempotentResponse } from '../../../services/remote-api-service.js';
import { rejectIfEmergencyFrozen } from '../../../services/kill-switch-service.js';
import { getErrorStatusCode } from '../../../utils/http-security.js';
import { paymentService } from '../../payment-service.js';
import { parseRawBody, parseBody, sendRemoteJSON, RemoteRouteContext } from './remote-shared.js';

/** Handles public unauthenticated billing routes (plan catalog & signed provider webhooks). */
export async function handleRemotePublicBillingRoutes(params: {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  normalizedPath: string;
  method: string;
  parsedUrl: URL;
  requestId: string;
}): Promise<boolean> {
  const { req, res, normalizedPath, method, parsedUrl, requestId } = params;

  if (normalizedPath === '/api/v1/remote/billing/plans' && method === 'GET') {
    sendRemoteJSON(
      req,
      res,
      200,
      {
        success: true,
        data: {
          plans: paymentService.getPlanCatalog(),
        },
      },
      requestId
    );
    return true;
  }

  if (
    (normalizedPath === '/api/v1/remote/billing/webhook' ||
      normalizedPath.startsWith('/api/v1/remote/billing/webhook/')) &&
    method === 'POST'
  ) {
    try {
      const rawBody = await parseRawBody(req);
      const signature = (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature'] ||
        req.headers['stripe-signature'] ||
        req.headers['x-razorpay-signature'] ||
        req.headers['x-simulation-signature'] ||
        req.headers['x-signature'] ||
        ''
      ) as string;

      let provider: any = 'simulation';
      if (req.headers['stripe-signature']) {
        provider = 'stripe';
      } else if (
        req.headers['x-gateway-signature'] ||
        req.headers['x-gateway-signature-v2'] ||
        req.headers['x-youpi-signature']
      ) {
        provider = 'youpi_pg';
      } else if (req.headers['x-razorpay-signature']) {
        provider = 'razorpay';
      } else if (parsedUrl.searchParams.get('provider')) {
        provider = parsedUrl.searchParams.get('provider');
      } else if (normalizedPath.endsWith('/youpi') || normalizedPath.endsWith('/youpi_pg')) {
        provider = 'youpi_pg';
      }

      const result = await paymentService.handleWebhook(provider, rawBody, signature);
      sendRemoteJSON(req, res, 200, { success: true, data: result }, requestId);
      return true;
    } catch (err: any) {
      const isSig = err.message && err.message.includes('INVALID_WEBHOOK_SIGNATURE');
      const isTamper = err.message && err.message.includes('AMOUNT_TAMPERING_DETECTED');
      const status = getErrorStatusCode(err, isSig || isTamper ? 400 : 500);
      sendRemoteJSON(
        req,
        res,
        status,
        {
          success: false,
          error: {
            code: isSig ? 'INVALID_SIGNATURE' : isTamper ? 'AMOUNT_TAMPERED' : 'WEBHOOK_FAILED',
            message: err.message || 'Webhook processing failed',
          },
        },
        requestId
      );
      return true;
    }
  }

  return false;
}

/** Handles authenticated remote billing routes (checkout, subscription, invoices, cancel). */
export async function handleRemoteBillingRoutes(ctx: RemoteRouteContext): Promise<boolean> {
  const { req, res, method, route, auth, requestId, rateLimit, idempotencyKey } = ctx;

  if (route === 'billing/checkout' && method === 'POST') {
    if (await rejectIfEmergencyFrozen(res, 'remote_billing_checkout')) return true;
    const body = await parseBody(req);
    const session = await paymentService.createCheckoutSession(
      {
        userId: auth.userId,
        planId: body.planId,
        billingCycle: body.billingCycle || 'MONTHLY',
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        idempotencyKey: idempotencyKey || body.idempotencyKey,
      },
      body.provider
    );

    const responsePayload = { success: true, data: session };
    if (idempotencyKey) {
      saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
    }
    sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
    return true;
  }

  if (route === 'billing/subscription' && method === 'GET') {
    const sub = paymentService.getUserSubscription(auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: { subscription: sub } }, requestId, rateLimit);
    return true;
  }

  if (route === 'billing/invoices' && method === 'GET') {
    const invoices = paymentService.getUserInvoices(auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: { invoices } }, requestId, rateLimit);
    return true;
  }

  if (route === 'billing/cancel' && method === 'POST') {
    const cancelled = paymentService.cancelSubscription(auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: { cancelled } }, requestId, rateLimit);
    return true;
  }

  return false;
}
