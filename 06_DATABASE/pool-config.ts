import fs from 'node:fs';
import type { PoolConfig } from 'pg';

function parsePositiveIntEnv(raw: string | undefined, fallback: number, min = 1, max = 600_000): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

function readSslCa(): string | undefined {
  const caEnv = process.env.DB_SSL_CA?.trim();
  if (!caEnv) return undefined;
  if (caEnv.includes('BEGIN CERTIFICATE')) {
    return caEnv.includes('\\n') ? caEnv.replace(/\\n/g, '\n') : caEnv;
  }
  return fs.readFileSync(caEnv, 'utf8');
}

/**
 * Builds a hardened `pg.Pool` configuration for PostgreSQL on Node.js / VPS.
 * Supports configurable pool sizing/timeouts/keepAlive (`DB_POOL_MAX`,
 * `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `DB_KEEPALIVE`),
 * preserves TLS certificate verification by default, and accepts custom CAs
 * via `DB_SSL_CA` (inline PEM or file path).
 */
export function parsePgPoolConfig(connectionString: string, maxPoolOverride?: number): PoolConfig {
  let sslMode: string | null = null;
  let effectiveConnectionString = connectionString;
  const ca = readSslCa();
  const explicitRejectFalse = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false';

  try {
    const parsed = new URL(connectionString);
    sslMode = parsed.searchParams.get('sslmode')?.toLowerCase() ?? null;
    // Remove sslmode when configuring SSL object explicitly so pg-connection-string
    // does not force verify-full and override custom CA or explicit TLS settings.
    if (sslMode !== 'disable' && (ca || explicitRejectFalse)) {
      parsed.searchParams.delete('sslmode');
      effectiveConnectionString = parsed.toString();
    }
  } catch {
    // Non-URL connection strings fall back directly to pg's parser.
  }

  const max =
    typeof maxPoolOverride === 'number' && Number.isFinite(maxPoolOverride)
      ? Math.max(1, Math.min(100, Math.floor(maxPoolOverride)))
      : parsePositiveIntEnv(process.env.DB_POOL_MAX, 10, 1, 100);

  const idleTimeoutMillis = parsePositiveIntEnv(process.env.DB_POOL_IDLE_TIMEOUT_MS, 60_000, 1000, 600_000);
  const connectionTimeoutMillis = parsePositiveIntEnv(
    process.env.DB_POOL_CONNECTION_TIMEOUT_MS,
    15_000,
    500,
    120_000
  );
  const keepAlive = process.env.DB_KEEPALIVE?.trim().toLowerCase() !== 'false';

  const config: PoolConfig = {
    connectionString: effectiveConnectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    keepAlive,
    ...(keepAlive ? { keepAliveInitialDelayMillis: 10_000 } : {}),
    allowExitOnIdle: true,
  };

  if (sslMode === 'disable') {
    config.ssl = false;
  } else if (ca) {
    config.ssl = {
      ca,
      rejectUnauthorized: !explicitRejectFalse,
    };
  } else if (explicitRejectFalse) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}
