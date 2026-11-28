/**
 * MAHI Platform V2 — PostgreSQL & Prisma Client Singleton
 * Provides lazy connection management, health check probes, and test injection.
 */

import { createRequire } from 'node:module';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { parsePgPoolConfig } from './pool-config.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('prisma-client');

const nodeRequire = createRequire(import.meta.url);

let prismaInstance: PrismaClientType | null = null;
let pgPoolInstance: { end?: () => Promise<void> } | null = null;
let testPrismaInstance: any = null;

function getNormalizedPostgresUrl(): string {
  const rawUrl = process.env.DATABASE_URL;
  const url = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : '';
  if (rawUrl && rawUrl !== url) {
    process.env.DATABASE_URL = url;
  }
  return url;
}

/**
 * Returns true if DATABASE_URL environment variable is configured for PostgreSQL
 */
export function isPostgresConfigured(): boolean {
  if (testPrismaInstance) return true;
  // If running in Electron desktop runtime (or Vitest offline suites without an injected mock Prisma),
  // PostgreSQL is disabled so desktop runtime and offline tests run against SQLite without needing a live PG server.
  if ((typeof process !== 'undefined' && process.versions?.electron) || (process.env.VITEST && !testPrismaInstance)) {
    return false;
  }
  const url = getNormalizedPostgresUrl();
  return Boolean(
    url &&
    (url.startsWith('postgres://') || url.startsWith('postgresql://'))
  );
}

/**
 * Returns the lazy-initialized singleton PrismaClient instance.
 * Returns null if PostgreSQL is not configured and no test client has been injected.
 */
export function getPrismaClient(): PrismaClientType | null {
  if (testPrismaInstance) {
    return testPrismaInstance as PrismaClientType;
  }

  if (!isPostgresConfigured()) {
    return null;
  }

  if (!prismaInstance) {
    try {
      const connectionString = getNormalizedPostgresUrl();
      const prismaMod = nodeRequire('@prisma/client');
      const adapterMod = nodeRequire('@prisma/adapter-pg');
      const pgMod = nodeRequire('pg');

      const PrismaCtor = prismaMod.PrismaClient || prismaMod.default?.PrismaClient || prismaMod;
      const PrismaPgCtor = adapterMod.PrismaPg || adapterMod.default?.PrismaPg;
      const PoolCtor = pgMod.Pool || pgMod.default?.Pool;

      const poolConfig = parsePgPoolConfig(connectionString);
      const pool = new PoolCtor(poolConfig);
      const adapter = new PrismaPgCtor(pool, { disposeExternalPool: true });

      pgPoolInstance = pool;
      prismaInstance = new PrismaCtor({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    } catch (err: any) {
      console.error('[PrismaClient] Failed to load @prisma/client:', err?.message || err);
      return null;
    }
  }

  return prismaInstance;
}

/**
 * Executes a health check against PostgreSQL via Prisma.
 */
export async function checkPostgresHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (testPrismaInstance) {
    try {
      const start = Date.now();
      if (typeof testPrismaInstance.$queryRaw === 'function') {
        await testPrismaInstance.$queryRaw`SELECT 1`;
      }
      return { connected: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { connected: false, error: err?.message || 'Prisma test query failed' };
    }
  }

  if (!isPostgresConfigured()) {
    return { connected: false, error: 'DATABASE_URL not configured' };
  }

  const client = getPrismaClient();
  if (!client) {
    return { connected: false, error: 'PrismaClient failed to initialize' };
  }

  const start = Date.now();
  try {
    await client.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err?.message || 'Database connection error',
    };
  }
}

/**
 * Disconnects the active PrismaClient instance gracefully.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
    } catch (err) {
      log.debug('Prisma client disconnect error on reset', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    prismaInstance = null;
  }
  if (pgPoolInstance?.end) {
    try {
      await pgPoolInstance.end();
    } catch (err) {
      log.debug('PostgreSQL pool end error on reset', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    pgPoolInstance = null;
  }
}

/**
 * Sets an explicit PrismaClient or mock for automated tests.
 */
export function setPrismaClientForTest(client: any): void {
  testPrismaInstance = client;
}

export type { PrismaClientType as PrismaClient };
