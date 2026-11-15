/**
 * MAHI Platform V2 — PostgreSQL & Prisma Client Singleton
 * Provides lazy connection management, health check probes, and test injection.
 */

import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;
let testPrismaInstance: any = null;

/**
 * Returns true if DATABASE_URL environment variable is configured for PostgreSQL
 */
export function isPostgresConfigured(): boolean {
  if (testPrismaInstance) return true;
  const url = process.env.DATABASE_URL;
  return Boolean(
    url &&
    (url.startsWith('postgres://') ||
     url.startsWith('postgresql://') ||
     process.env.STORAGE_BACKEND === 'postgres')
  );
}

/**
 * Returns the lazy-initialized singleton PrismaClient instance.
 * Returns null if PostgreSQL is not configured and no test client has been injected.
 */
export function getPrismaClient(): PrismaClient | null {
  if (testPrismaInstance) {
    return testPrismaInstance as PrismaClient;
  }

  if (!isPostgresConfigured()) {
    return null;
  }

  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
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
    } catch {}
    prismaInstance = null;
  }
}

/**
 * Sets an explicit PrismaClient or mock for automated tests.
 */
export function setPrismaClientForTest(client: any): void {
  testPrismaInstance = client;
}

export { PrismaClient };
