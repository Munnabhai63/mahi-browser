import http from 'node:http';
import { URL } from 'node:url';
import { sendJSON } from './routes/router-shared.js';
import { sendSafeError } from '../utils/app-error.js';
import { resolveTrustedClientIp, isTrustedOrigin } from '../utils/http-security.js';
import { handleRemoteApiRoutes } from './remote-api-router.js';
import { handleClientEntitlementRoutes } from './routes/client-entitlement-routes.js';
import { handlePaymentRoutes } from './routes/payment-routes.js';
import { handleAuthRoutes } from './routes/auth-routes.js';
import { handleAdminOwnerRoutes } from './routes/admin-owner-routes.js';
import { handleCloudSyncRoutes } from './routes/cloud-sync-routes.js';

// Re-export shared types, helpers, and in-memory caches to maintain 100% backward compatibility
export type {
  DesktopAuthTicket,
  WebHandoffSession,
} from './routes/router-shared.js';

export {
  desktopAuthTickets,
  webHandoffSessions,
  pruneWebHandoffSessions,
  _resetWebHandoffSessions,
  getDesktopAuthSuccessHtml,
  checkAuthRateLimit,
  resetAuthRateLimitForTesting,
} from './routes/router-shared.js';

/**
 * Commercial REST API Central Router
 * Dispatches incoming requests across 5 domain sub-routers in strict precedence order:
 * 1. Client Entitlement & Device endpoints (/v1/account/status, switch-device, licenses)
 * 2. Billing & Payments endpoints (UPI, Razorpay, YouPI-PG, invoices)
 * 3. Central & Desktop Authentication endpoints (register, login, google, handoff)
 * 4. Administration & Owner TOTP Step-Up Console (users, plans, pricing, licenses)
 * 5. Cloud Sync, Storage & Team Workspaces (storage, profile locks, workspaces)
 */
export async function handleCommercialApiRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  (res as any).__req = req;

  // Handle CORS preflight OPTIONS requests for all commercial API paths
  if (method === 'OPTIONS') {
    const origin = (req.headers.origin as string) || '';
    if (origin && isTrustedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else if (!origin) {
      res.setHeader('Vary', 'Origin');
    } else {
      res.writeHead(403);
      res.end();
      return true;
    }
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-API-Key, X-Admin-Secret, x-mahi-token, Idempotency-Key, X-Mahi-Signature, X-Request-Id'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.writeHead(204);
    res.end();
    return true;
  }

  // Support /api/v1/*, direct /auth/*, direct /v1/sync/*, direct /v1/*, and direct /me/* routes
  const isApiV1 = pathname.startsWith('/api/v1/');
  const isDirectAuth = pathname.startsWith('/auth/');
  const isDirectSync = pathname.startsWith('/v1/sync/');
  const isDirectV1 = pathname.startsWith('/v1/');
  const isDirectMe = pathname.startsWith('/me/');
  if (!isApiV1 && !isDirectAuth && !isDirectSync && !isDirectV1 && !isDirectMe) {
    return false;
  }

  // Support direct /v1/account/* endpoints before remote API delegation
  if (pathname.startsWith('/v1/account/')) {
    // handled directly below in commercial router
  } else if (
    pathname.startsWith('/api/v1/remote/') ||
    pathname.startsWith('/api/v1/cloud-browser') ||
    pathname.startsWith('/api/v1/webhooks') ||
    pathname.startsWith('/v1/')
  ) {
    const handled = await handleRemoteApiRoutes(req, res, pathname, method, parsedUrl);
    if (handled) return true;
  }

  const routePath = isDirectAuth || isDirectMe ? `/api/v1${pathname}` : isDirectSync ? `/api${pathname}` : pathname;
  const clientIp = resolveTrustedClientIp(req);

  try {
    // 1. Client Entitlement & Device Endpoints
    if (await handleClientEntitlementRoutes(req, res, pathname, method, parsedUrl, routePath, clientIp)) {
      return true;
    }

    // 2. Billing & Payment Endpoints
    if (await handlePaymentRoutes(req, res, pathname, method, parsedUrl, routePath, clientIp)) {
      return true;
    }

    // 3. Central & Desktop Authentication Endpoints
    if (await handleAuthRoutes(req, res, pathname, method, parsedUrl, routePath, clientIp)) {
      return true;
    }

    // 4. Administration & Owner Step-Up Console
    if (await handleAdminOwnerRoutes(req, res, pathname, method, parsedUrl, routePath, clientIp)) {
      return true;
    }

    // 5. Cloud Sync, Storage & Team Workspaces
    if (await handleCloudSyncRoutes(req, res, pathname, method, parsedUrl, routePath, clientIp)) {
      return true;
    }

    sendJSON(res, 404, { success: false, error: `Endpoint ${method} ${pathname} not found.` });
    return true;
  } catch (err) {
    sendSafeError(res, err, { fallbackStatus: 500 });
    return true;
  }
}

export async function handleCommercialAPIRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const host = req.headers.host || '127.0.0.1';
  const parsedUrl = new URL(req.url || '/', `http://${host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method || 'GET';
  return handleCommercialApiRoutes(req, res, pathname, method, parsedUrl);
}
