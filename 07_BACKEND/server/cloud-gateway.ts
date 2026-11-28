/**
 * MAHI Platform V2 — Fastify Cloud Gateway
 * Implements native Fastify route plugins with explicit domain prefixes,
 * Redis distributed locks, PostgreSQL central repository, Cloudflare R2 / local storage,
 * centralized CORS/CSP security headers, and global AppError safe error mapping.
 */

import fastify, { type FastifyInstance, type FastifyPluginAsync, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { isPostgresConfigured, checkPostgresHealth, disconnectPrisma } from '../../06_DATABASE/prisma-client.js';
import { isRedisConfigured, checkRedisHealth, disconnectRedis } from '../../08_SECURITY/redis-lock-service.js';
import { getStorageProvider } from '../../08_SECURITY/storage-provider.js';
import { applyFastifySecurityHeaders } from '../utils/security-headers.js';
import { InvalidJsonError, isTrustedOrigin } from '../utils/http-security.js';
import { toSafeErrorResponse } from '../utils/app-error.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cloud-gateway');
import {
  dispatchThroughFastifyReply,
  type RawBridgeRequest,
  registerPrefixBridgePlugin,
  wrapCommercialHandlers,
} from './fastify-route-adapter.js';
import { handleClientEntitlementRoutes } from '../commercial/routes/client-entitlement-routes.js';
import { handlePaymentRoutes } from '../commercial/routes/payment-routes.js';
import { handleAuthRoutes } from '../commercial/routes/auth-routes.js';
import { handleAdminOwnerRoutes } from '../commercial/routes/admin-owner-routes.js';
import { handleCloudSyncRoutes } from '../commercial/routes/cloud-sync-routes.js';
import { handleRemoteApiRoutes } from '../commercial/remote-api-router.js';
import {
  handlePortalAndStaticRoutes,
  handleBinaryDownloadRoutes,
  handleCentralV2Routes,
} from './app.js';

export { isTrustedOrigin };

export interface FastifyGatewayOptions {
  port?: number;
  host?: string;
  logger?: boolean;
  bodyLimit?: number;
}

let activeGatewayInstance: FastifyInstance | null = null;

export function getFastifyCloudGateway(): FastifyInstance | null {
  return activeGatewayInstance;
}

async function buildHealthPayload() {
  const [pgHealth, redisHealth] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
  ]);

  let storageProviderName = 'unknown';
  let storageStatus = 'unconfigured';
  try {
    const storage = getStorageProvider();
    storageProviderName = storage.name;
    storageStatus = 'ready';
  } catch {
    storageStatus = 'unavailable';
  }

  return {
    status: 'ok',
    service: 'mahi-cloud-gateway',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      configured: isPostgresConfigured(),
      provider: isPostgresConfigured() ? 'postgresql' : 'sqlite',
      status: pgHealth.connected ? 'connected' : isPostgresConfigured() ? 'error' : 'standalone_sqlite',
      latencyMs: pgHealth.latencyMs,
      error: pgHealth.error,
    },
    redis: {
      configured: isRedisConfigured(),
      status: redisHealth.connected ? 'connected' : isRedisConfigured() ? 'error' : 'disconnected',
      latencyMs: redisHealth.latencyMs,
      error: redisHealth.error,
    },
    storage: {
      provider: storageProviderName,
      status: storageStatus,
    },
  };
}

const healthRoutesPlugin: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => buildHealthPayload());
  app.get('/api/v2/health', async () => buildHealthPayload());
};

const portalAndDownloadPlugin: FastifyPluginAsync = async (app) => {
  const dispatchPortal = async (request: FastifyRequest, reply: FastifyReply) => {
    const handled = await dispatchThroughFastifyReply(request, reply, async (req, res, parsedUrl) => {
      const pathname = parsedUrl.pathname;
      const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      return handlePortalAndStaticRoutes(req, res, parsedUrl, cleanPath, (req.method || 'GET').toUpperCase());
    });
    if (!handled && !reply.sent) {
      return reply.code(404).send({ success: false, error: `Route ${request.method} ${request.url.split('?')[0]} not found` });
    }
    return reply;
  };

  const dispatchDownload = async (request: FastifyRequest, reply: FastifyReply) => {
    const handled = await dispatchThroughFastifyReply(request, reply, async (req, res, parsedUrl) => {
      const pathname = parsedUrl.pathname;
      const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      return handleBinaryDownloadRoutes(req, res, parsedUrl, cleanPath);
    });
    if (!handled && !reply.sent) {
      return reply.code(404).send({ success: false, error: `Route ${request.method} ${request.url.split('?')[0]} not found` });
    }
    return reply;
  };

  // Explicit binary download routes
  const binaryDownloadRoutes = [
    '/download/setup',
    '/download/portable',
    '/download/MAHI-Setup.exe',
    '/api/v2/download/setup',
    '/api/v2/download/portable',
  ];
  for (const routePath of binaryDownloadRoutes) {
    app.get(routePath, dispatchDownload);
  }

  // Portal HTML & Next.js static export routes
  const portalGetRoutes = [
    '/',
    '/admin',
    '/web',
    '/super-admin',
    '/root-admin',
    '/master-admin',
    '/dashboard',
    '/download',
    '/install',
    '/client',
    '/setup',
    '/get',
    '/app',
    '/privacy',
    '/terms',
    '/aup',
    '/pricing',
    '/compare/gologin-alternative',
    '/docs',
    '/docs/*',
    '/blog',
    '/blog/*',
    '/signup',
    '/login',
    '/book-demo',
    '/assets/*',
    '/_next/*',
    '/sitemap.xml',
    '/robots.txt',
  ];
  for (const routePath of portalGetRoutes) {
    app.get(routePath, dispatchPortal);
  }
};

/**
 * Builds and configures the Fastify Cloud Gateway instance with native plugins.
 */
export async function createFastifyCloudGateway(
  options: FastifyGatewayOptions = {}
): Promise<FastifyInstance> {
  const app = fastify({
    logger: options.logger ?? false,
    bodyLimit: options.bodyLimit ?? 250 * 1024 * 1024, // 250 MB for R2 profile session blobs
    routerOptions: {
      ignoreTrailingSlash: true,
    },
  });

  // 1. CORS Configuration (Desktop & Web multi-origin support with strict origin verification)
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (isTrustedOrigin(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Mahi-Token',
      'X-Requested-With',
      'Range',
      'X-Device-Id',
      'X-Workspace-Id',
      'X-API-Key',
      'Idempotency-Key',
      'X-Admin-Secret',
      'X-Mahi-Signature',
      'X-Request-Id',
    ],
    exposedHeaders: ['Content-Range', 'X-Total-Count', 'Content-Disposition'],
    credentials: true,
  });

  // 2. Centralized Security Headers Hook (CSP, COOP, Permissions-Policy, X-Gateway-Engine)
  app.addHook('onSend', async (request, reply) => {
    applyFastifySecurityHeaders(reply, request.url || '/');
  });

  // 3. Preserve exact wire bytes (`rawBuffer`) for webhook signatures alongside empty-JSON toleration
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const rawBuf = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ''), 'utf8');
    (req.raw as RawBridgeRequest).rawBuffer = rawBuf;
    const text = rawBuf.toString('utf8').trim();
    if (!text) {
      return done(null, {});
    }
    try {
      const json = JSON.parse(text);
      done(null, json);
    } catch {
      done(new InvalidJsonError('Invalid JSON payload.'), undefined);
    }
  });

  // 4. Binary & URL-Encoded Content-Type Parsers
  app.addContentTypeParser(
    ['application/octet-stream', 'application/x-tar', 'application/gzip', 'application/x-gzip'],
    { parseAs: 'buffer' },
    (req, body, done) => {
      if (Buffer.isBuffer(body)) {
        (req.raw as RawBridgeRequest).rawBuffer = body;
      }
      done(null, body);
    }
  );

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        const rawStr = typeof body === 'string' ? body : String(body || '');
        (req.raw as RawBridgeRequest).rawBuffer = Buffer.from(rawStr, 'utf8');
        const params = new URLSearchParams(rawStr);
        const result: Record<string, string> = {};
        for (const [k, v] of params.entries()) {
          result[k] = v;
        }
        done(null, result);
      } catch (err: unknown) {
        done(err instanceof Error ? err : new Error(String(err)), undefined);
      }
    }
  );

  // 5. Global Safe Error Handler (never leak raw err.message / stack / DB errors)
  app.setErrorHandler((err: Error & { code?: string; statusCode?: number }, _request, reply) => {
    if (err?.code === 'FST_ERR_CTP_BODY_TOO_LARGE' || err?.statusCode === 413) {
      return reply.code(413).send({
        success: false,
        error: 'Request payload exceeds maximum allowed size.',
        code: 'PAYLOAD_TOO_LARGE',
      });
    }
    const safe = toSafeErrorResponse(err, { fallbackStatus: 500 });
    return reply.code(safe.statusCode).send({
      success: false,
      error: safe.message,
      code: safe.code,
      ...(safe.fieldErrors ? { fieldErrors: safe.fieldErrors } : {}),
    });
  });

  // 6. Native Fastify Domain Route Plugins (zero reply.hijack())
  await app.register(healthRoutesPlugin);

  // Commercial REST Domain Plugins
  registerPrefixBridgePlugin(app, ['/api/v1/auth', '/auth'], () =>
    wrapCommercialHandlers([handleAuthRoutes])
  );
  registerPrefixBridgePlugin(app, ['/api/v1/billing'], () =>
    wrapCommercialHandlers([handlePaymentRoutes])
  );
  registerPrefixBridgePlugin(app, ['/api/v1/account', '/v1/account'], () =>
    wrapCommercialHandlers([handleClientEntitlementRoutes, handlePaymentRoutes, handleAuthRoutes])
  );
  registerPrefixBridgePlugin(app, ['/api/v1/commercial'], () =>
    wrapCommercialHandlers([handleClientEntitlementRoutes, handlePaymentRoutes, handleAdminOwnerRoutes])
  );
  registerPrefixBridgePlugin(
    app,
    [
      '/api/v1/entitlements',
      '/api/v1/devices',
      '/api/v1/plans',
      '/api/v1/pricing',
      '/api/v1/updates',
      '/api/v1/funnel',
      '/api/v1/me',
      '/me',
    ],
    () => wrapCommercialHandlers([handleClientEntitlementRoutes])
  );
  registerPrefixBridgePlugin(app, ['/api/v1/admin', '/api/v1/support'], () =>
    wrapCommercialHandlers([handleAdminOwnerRoutes])
  );
  registerPrefixBridgePlugin(
    app,
    ['/api/v1/sync', '/api/v1/storage', '/api/v1/workspaces', '/v1/sync'],
    () => wrapCommercialHandlers([handleCloudSyncRoutes])
  );

  // Remote Cloud API Domain Plugins (registered after specific /v1/account & /v1/sync prefixes)
  registerPrefixBridgePlugin(
    app,
    ['/api/v1/remote', '/api/v1/cloud-browser', '/api/v1/webhooks', '/v1'],
    () => async (req, res, parsedUrl) =>
      handleRemoteApiRoutes(req, res, parsedUrl.pathname, (req.method || 'GET').toUpperCase(), parsedUrl)
  );

  // Portal HTML, Static Assets & Binary Downloads Plugin
  await app.register(portalAndDownloadPlugin);

  // Central V2 Control Plane Plugin (static /api/v2/health & /api/v2/download/* take precedence)
  registerPrefixBridgePlugin(app, ['/api/v2'], () => async (req, res, parsedUrl) => {
    const pathname = parsedUrl.pathname;
    const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    return handleCentralV2Routes(req, res, parsedUrl, pathname, cleanPath, (req.method || 'GET').toUpperCase());
  });

  // 7. Native 404 Handler (zero reply.hijack(), strict API CSP + CORS applied via hooks)
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      success: false,
      error: `Route ${request.method.toUpperCase()} ${request.url.split('?')[0]} not found`,
    });
  });

  activeGatewayInstance = app;
  return app;
}

/**
 * Starts the Fastify Cloud Gateway listening on the specified host and port.
 */
export async function startFastifyCloudGateway(
  options: FastifyGatewayOptions = {}
): Promise<{ app: FastifyInstance; address: string; port: number }> {
  const app = await createFastifyCloudGateway(options);
  const port = options.port ?? parseInt(process.env.PORT || '32123', 10);
  const host = options.host ?? (process.env.HOST || '0.0.0.0');

  const address = await app.listen({ port, host });
  const serverAddress = app.server.address();
  const actualPort = typeof serverAddress === 'object' && serverAddress ? serverAddress.port : port;

  return { app, address, port: actualPort };
}

/**
 * Gracefully shuts down the Fastify Cloud Gateway, Prisma client, and Redis client.
 */
export async function stopFastifyCloudGateway(): Promise<void> {
  if (activeGatewayInstance) {
    try {
      await activeGatewayInstance.close();
    } catch (closeErr) {
      log.debug('Fastify cloud gateway close error on shutdown', {
        err: closeErr instanceof Error ? closeErr.message : String(closeErr),
      });
    }
    activeGatewayInstance = null;
  }
  await disconnectPrisma();
  await disconnectRedis();
}
