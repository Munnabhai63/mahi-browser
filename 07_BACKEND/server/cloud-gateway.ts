/**
 * MAHI Platform V2 — Fastify Cloud Gateway
 * Implements Section 2 and Section 9 of MAHI_BROWSER_TARGET.md.
 * High-performance standalone cloud gateway with Redis distributed locks,
 * PostgreSQL central repository, Cloudflare R2 session archives, and CORS/security headers.
 */

import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { isPostgresConfigured, checkPostgresHealth, disconnectPrisma } from '../../06_DATABASE/prisma-client.js';
import { isRedisConfigured, checkRedisHealth, disconnectRedis } from '../../08_SECURITY/redis-lock-service.js';
import { getStorageProvider } from '../../08_SECURITY/storage-provider.js';
import { handleCentralApiRequest } from './app.js';

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

/**
 * Builds and configures the Fastify Cloud Gateway instance.
 */
export async function createFastifyCloudGateway(
  options: FastifyGatewayOptions = {}
): Promise<FastifyInstance> {
  const app = fastify({
    logger: options.logger ?? false,
    bodyLimit: options.bodyLimit ?? (250 * 1024 * 1024), // 250 MB for R2 profile session blobs
  });

  // 1. CORS Configuration (Section 2 - Desktop & Web multi-origin support)
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (Electron desktop, curl, mobile apps, native callers)
      if (!origin) return cb(null, true);
      // Allow localhost, 127.0.0.1, and mahibrowser:// custom protocol
      if (
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('https://localhost') ||
        origin.startsWith('https://127.0.0.1') ||
        origin.startsWith('mahibrowser://') ||
        origin.startsWith('mahi://') ||
        origin.endsWith('.mahibrowser.com') ||
        origin === 'https://mahibrowser.com'
      ) {
        return cb(null, true);
      }
      return cb(null, true); // Dev & cloud permissive fallback
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
    ],
    exposedHeaders: ['Content-Range', 'X-Total-Count', 'Content-Disposition'],
    credentials: true,
  });

  // 2. Security Headers (Section 2 & Production Hardening)
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Gateway-Engine', 'Fastify-Node22');
  });

  // 3. Binary & URL-Encoded Content-Type Parsers
  app.addContentTypeParser(
    ['application/octet-stream', 'application/x-tar', 'application/gzip', 'application/x-gzip'],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const params = new URLSearchParams(body as string);
        const result: Record<string, any> = {};
        for (const [k, v] of params.entries()) {
          result[k] = v;
        }
        done(null, result);
      } catch (err: any) {
        done(err, undefined);
      }
    }
  );

  // 4. Health Check Helper
  const getHealthStatus = async () => {
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
        status: pgHealth.connected ? 'connected' : (isPostgresConfigured() ? 'error' : 'standalone_sqlite'),
        latencyMs: pgHealth.latencyMs,
        error: pgHealth.error,
      },
      redis: {
        configured: isRedisConfigured(),
        status: redisHealth.connected ? 'connected' : (isRedisConfigured() ? 'error' : 'disconnected'),
        latencyMs: redisHealth.latencyMs,
        error: redisHealth.error,
      },
      storage: {
        provider: storageProviderName,
        status: storageStatus,
      },
    };
  };

  // 5. Dedicated Native Fastify Health Check Endpoints
  app.get('/health', async (_request, _reply) => {
    return getHealthStatus();
  });

  app.get('/api/v2/health', async (_request, _reply) => {
    return getHealthStatus();
  });

  // 6. Universal Gateway Route Adapter (Delegates to Central and Commercial API Handlers)
  app.setNotFoundHandler(async (request, reply) => {
    reply.hijack();
    const req = request.raw;
    const res = reply.raw;

    // Attach parsed payloads for downstream consume
    (req as any).body = request.body;
    (req as any).rawBuffer = Buffer.isBuffer(request.body) ? request.body : undefined;

    await handleCentralApiRequest(req, res);
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
    } catch {}
    activeGatewayInstance = null;
  }
  await disconnectPrisma();
  await disconnectRedis();
}
