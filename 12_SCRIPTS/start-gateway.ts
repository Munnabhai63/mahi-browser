/**
 * MAHI Platform V2 — Fastify Cloud Gateway Daemon Runner
 * Implements Section 2 & 9 of MAHI_BROWSER_TARGET.md
 * Starts the Node.js 22 Fastify Gateway with Redis Mutex and Central DB connections.
 */

import { initializeDatabase } from '../06_DATABASE/schema.js';
import { isPostgresConfigured, checkPostgresHealth } from '../06_DATABASE/prisma-client.js';
import { isRedisConfigured, checkRedisHealth } from '../08_SECURITY/redis-lock-service.js';
import { getStorageProvider } from '../08_SECURITY/storage-provider.js';
import { validateProductionSecrets } from '../08_SECURITY/install-secrets.js';
import { startFastifyCloudGateway, stopFastifyCloudGateway } from '../07_BACKEND/server/cloud-gateway.js';
import { DEFAULT_CLOUD_GATEWAY_PORT } from '../10_CONFIG/shared/network-endpoints.js';

async function main() {
  console.log('===================================================');
  console.log('  MAHI BROWSER V2 — FASTIFY CLOUD GATEWAY STARTUP  ');
  console.log('===================================================');

  // Fail fast in non-Electron production if required secrets or status keys are missing/weak
  validateProductionSecrets();

  // Initialize SQLite schema fallback for local desktop mode
  console.log('[Gateway] Initializing local database schema...');
  await initializeDatabase();

  // Verify external cloud subsystems
  const pgConfigured = isPostgresConfigured();
  console.log(`[Gateway] Central Database (PostgreSQL): ${pgConfigured ? 'Configured' : 'Unset (Using Local SQLite)'}`);
  if (pgConfigured) {
    const pgHealth = await checkPostgresHealth();
    console.log(`[Gateway] PostgreSQL Health: ${pgHealth.connected ? 'Connected' : `Failed (${pgHealth.error})`}`);
  }

  const redisConfigured = isRedisConfigured();
  console.log(`[Gateway] Distributed Mutex (Redis): ${redisConfigured ? 'Configured' : 'Unset (Using Local Locks)'}`);
  if (redisConfigured) {
    const redisHealth = await checkRedisHealth();
    console.log(`[Gateway] Redis Health: ${redisHealth.connected ? 'Connected' : `Failed (${redisHealth.error})`}`);
  }

  try {
    const storage = getStorageProvider();
    console.log(`[Gateway] Session Storage: ${storage.name} (${storage.isProductionReady() ? 'Production Ready' : 'Development'})`);
  } catch (err: any) {
    console.log(`[Gateway] Session Storage: Error (${err.message})`);
  }

  const port = parseInt(process.env.PORT || String(DEFAULT_CLOUD_GATEWAY_PORT), 10);
  const host = process.env.HOST || '0.0.0.0';

  const { address, port: actualPort } = await startFastifyCloudGateway({
    port,
    host,
    logger: process.env.NODE_ENV !== 'production',
  });

  console.log('===================================================');
  console.log(`  Gateway Listening on:    ${address}`);
  console.log(`  Health Check URL:        http://127.0.0.1:${actualPort}/health`);
  console.log(`  API v2 Health Check:     http://127.0.0.1:${actualPort}/api/v2/health`);
  console.log(`  Web Admin Portal:        http://127.0.0.1:${actualPort}/admin`);
  console.log(`  Super Admin Portal:      http://127.0.0.1:${actualPort}/super-admin`);
  console.log(`  Remote API v1 Prefix:    http://127.0.0.1:${actualPort}/v1/`);
  console.log('===================================================');

  const shutdown = async (signal: string) => {
    console.log(`\n[Gateway] Received ${signal}. Shutting down gracefully...`);
    try {
      await stopFastifyCloudGateway();
      console.log('[Gateway] Fastify Cloud Gateway stopped.');
      process.exit(0);
    } catch (err) {
      console.error('[Gateway] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Gateway] Fatal startup error:', err);
  process.exit(1);
});
