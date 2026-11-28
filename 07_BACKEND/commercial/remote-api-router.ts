/**
 * MAHI Browser — Remote Cloud API Router Facade
 * Phase 6+ Modular Architecture
 *
 * Normalizes /v1/* and /api/v1/{remote,webhooks,cloud-browser,billing}/* routes,
 * handles auth, distributed rate limits, idempotency, and delegates to domain modules.
 */

import type http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import {
  RemoteApiService,
  checkRateLimitAsync,
  getCachedIdempotentResponse,
} from '../services/remote-api-service.js';
import { WebhookService } from '../services/webhook-service.js';
import { getErrorStatusCode } from '../utils/http-security.js';
import {
  parseRawBody,
  parseBody,
  sendRemoteJSON,
  resolveRemoteAuthAsync,
  resolveRemoteAuth,
  handleRemoteCorsPreflight,
  makeAccessGuards,
  type RemoteRouteContext,
} from './routes/remote/remote-shared.js';
import {
  handleRemotePublicBillingRoutes,
  handleRemoteBillingRoutes,
} from './routes/remote/remote-billing-routes.js';
import { handleRemoteProfileAndWorkspaceRoutes } from './routes/remote/remote-profiles-routes.js';
import { handleRemoteAutomationAndProxyRoutes } from './routes/remote/remote-automation-routes.js';
import { handleRemoteStreamingAndMobileRoutes } from './routes/remote/remote-streaming-routes.js';

export { parseRawBody, parseBody, sendRemoteJSON, resolveRemoteAuthAsync, resolveRemoteAuth };

function normalizeRemotePath(pathname: string): string {
  if (pathname.startsWith('/v1/')) {
    return `/api/v1/remote/${pathname.substring(4)}`;
  }
  if (pathname.startsWith('/api/v1/webhooks')) {
    return `/api/v1/remote/webhooks${pathname.substring(16)}`;
  }
  if (pathname.startsWith('/api/v1/cloud-browser')) {
    return `/api/v1/remote/cloud-browser${pathname.substring(21)}`;
  }
  if (pathname.startsWith('/api/v1/billing')) {
    return `/api/v1/remote/billing${pathname.substring(15)}`;
  }
  return pathname;
}

export async function handleRemoteApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const urlStr = req.url || '/';
  const parsedUrl = new URL(urlStr, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();
  return handleRemoteApiRoutes(req, res, pathname, method, parsedUrl);
}

export async function handleRemoteApiRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  const normalizedPath = normalizeRemotePath(pathname);
  if (!normalizedPath.startsWith('/api/v1/remote/')) {
    return false;
  }

  const requestId = (req.headers['x-request-id'] as string) || `req_${crypto.randomUUID()}`;

  if (method === 'OPTIONS') {
    return handleRemoteCorsPreflight(req, res);
  }

  if (await handleRemotePublicBillingRoutes({ req, res, normalizedPath, method, parsedUrl, requestId })) {
    return true;
  }

  const auth = await resolveRemoteAuthAsync(req);
  if (!auth) {
    sendRemoteJSON(
      req,
      res,
      401,
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication credentials. Provide a valid X-API-Key or Bearer token.',
        },
      },
      requestId
    );
    return true;
  }

  const rateLimitKey = auth.apiKeyId ? `key:${auth.apiKeyId}` : `usr:${auth.userId}`;
  const rateLimit = await checkRateLimitAsync(rateLimitKey);
  if (!rateLimit.allowed) {
    RemoteApiService.getInstance().logAudit(
      auth.apiKeyId || 'jwt',
      auth.userId,
      'RATE_LIMITED',
      undefined,
      'Rate limit exceeded'
    );
    sendRemoteJSON(
      req,
      res,
      429,
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'API rate limit exceeded. Please wait before making further requests.',
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  const idempotencyKey = (req.headers['idempotency-key'] as string) || '';
  if (idempotencyKey && (method === 'POST' || method === 'PUT')) {
    const cached = getCachedIdempotentResponse(idempotencyKey, auth.userId);
    if (cached) {
      sendRemoteJSON(
        req,
        res,
        cached.statusCode,
        cached.response as Parameters<typeof sendRemoteJSON>[3],
        requestId,
        rateLimit
      );
      return true;
    }
  }

  const remoteService = RemoteApiService.getInstance();
  const webhookService = WebhookService.getInstance();
  const route = normalizedPath.substring('/api/v1/remote/'.length);
  const { requireAccess, requireFeature } = makeAccessGuards(req, res, auth, requestId, rateLimit, remoteService);

  const ctx: RemoteRouteContext = {
    req,
    res,
    method,
    parsedUrl,
    requestId,
    rateLimit,
    auth,
    route,
    idempotencyKey,
    remoteService,
    webhookService,
    requireAccess,
    requireFeature,
  };

  try {
    if (await handleRemoteProfileAndWorkspaceRoutes(ctx)) return true;
    if (await handleRemoteAutomationAndProxyRoutes(ctx)) return true;
    if (await handleRemoteStreamingAndMobileRoutes(ctx)) return true;
    if (await handleRemoteBillingRoutes(ctx)) return true;

    sendRemoteJSON(
      req,
      res,
      404,
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Remote endpoint ${method} /api/v1/remote/${route} not found.`,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  } catch (err: unknown) {
    const status = getErrorStatusCode(err, 500);
    const errCode = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code || 'INTERNAL_ERROR') : 'INTERNAL_ERROR';
    const errMessage = err instanceof Error ? err.message : 'An unexpected server error occurred.';
    sendRemoteJSON(
      req,
      res,
      status,
      {
        success: false,
        error: {
          code: errCode,
          message: errMessage,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }
}
