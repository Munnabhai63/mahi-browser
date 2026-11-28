/**
 * MAHI Platform — Distributed State & Rate-Limit Service (Redis + PostgreSQL + SQLite Fallback)
 *
 * Replaces process-local in-memory rate-limit and owner-session Maps so horizontal
 * Fastify cloud gateway replicas share one atomic view of:
 *   1. Fixed-window HTTP rate limits (auth, commercial, remote API)
 *   2. Brute-force lockout counters (central login, owner TOTP verification)
 *   3. Ephemeral distributed sessions with TTL (owner step-up sessions)
 *
 * Precedence:
 *   - Redis (atomic Lua INCR/PEXPIRE and SET EX / DEL) when configured & capable
 *   - PostgreSQL (`system_runtime_state` atomic UPSERT via Prisma raw SQL) when configured
 *   - SQLite (`distributed_runtime_state` when DB initialized) + bounded local Map fallback
 */

import { getRedisClient, isRedisConfigured } from './redis-lock-service.js';
import { isPostgresConfigured } from '../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../06_DATABASE/prisma-client.js';
import { getDatabase, SqliteWrapper } from '../06_DATABASE/connection.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('distributed-state-service');

export interface FixedWindowRateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
  backend: 'redis' | 'postgres' | 'sqlite' | 'memory';
}

export interface AttemptLockoutCheckResult {
  allowed: boolean;
  count: number;
  remainingMs: number;
  retryAfterSeconds: number;
  backend: 'redis' | 'postgres' | 'sqlite' | 'memory';
}

export interface AttemptFailureRecordResult {
  count: number;
  locked: boolean;
  resetAt: number;
  backend: 'redis' | 'postgres' | 'sqlite' | 'memory';
}

const LUA_ATOMIC_INCR_EXPIRE = `
local current = redis.call('INCR', KEYS[1])
local pttl = redis.call('PTTL', KEYS[1])
if tonumber(current) == 1 or tonumber(pttl) < 0 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
  pttl = tonumber(ARGV[1])
end
return { tonumber(current), tonumber(pttl) }
`.trim();

const KEY_PREFIX = 'mahi:dist:';
const MAX_LOCAL_MEMORY_ENTRIES = 10_000;

interface LocalCounterEntry {
  count: number;
  expiresAtMs: number;
}

interface LocalKvEntry {
  valueJson: string;
  expiresAtMs: number;
}

const localCounterMap = new Map<string, LocalCounterEntry>();
const localKvMap = new Map<string, LocalKvEntry>();

const pgInitializedClients = new WeakSet<object>();
const sqliteInitializedDbs = new WeakSet<object>();

function buildStateKey(namespace: string, key: string): string {
  return `${KEY_PREFIX}${namespace}:${key}`;
}

function parseNamespacePrefix(namespace: string): string {
  return `${KEY_PREFIX}${namespace}:`;
}

function tryGetInitializedSqlite(): SqliteWrapper | null {
  try {
    return getDatabase();
  } catch {
    return null;
  }
}

function ensureSqliteStateTable(db: SqliteWrapper): boolean {
  if (sqliteInitializedDbs.has(db)) {
    return true;
  }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS distributed_runtime_state (
        state_key TEXT PRIMARY KEY,
        value_json TEXT,
        count INTEGER NOT NULL DEFAULT 0,
        expires_at_ms INTEGER NOT NULL DEFAULT 0
      )
    `);
    sqliteInitializedDbs.add(db);
    return true;
  } catch {
    return false;
  }
}

function getCapablePgPrisma(): any | null {
  if (!isPostgresConfigured()) return null;
  const prisma = getPrismaClient() as any;
  if (!prisma || typeof prisma.$queryRaw !== 'function' || typeof prisma.$executeRaw !== 'function') {
    return null;
  }
  return prisma;
}

async function ensurePgStateTable(prisma: any): Promise<boolean> {
  if (pgInitializedClients.has(prisma)) {
    return true;
  }
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS system_runtime_state (
        state_key TEXT PRIMARY KEY,
        value_json TEXT,
        count INTEGER NOT NULL DEFAULT 0,
        expires_at_ms BIGINT NOT NULL DEFAULT 0
      )
    `;
    pgInitializedClients.add(prisma);
    return true;
  } catch (err: any) {
    log.warn('[DistributedState] PostgreSQL state table init warning:', err?.message || err);
    return false;
  }
}

function getRedisKvClient(): any | null {
  if (!isRedisConfigured()) return null;
  const client = getRedisClient() as any;
  if (
    !client ||
    typeof client.get !== 'function' ||
    typeof client.set !== 'function' ||
    typeof client.del !== 'function'
  ) {
    return null;
  }
  return client;
}

function getRedisCounterClient(): any | null {
  const client = getRedisKvClient();
  if (!client) return null;
  const hasLuaIncr = typeof client.eval === 'function' && typeof client.incr === 'function';
  const hasDirectIncr = typeof client.incr === 'function' && typeof client.pexpire === 'function';
  if (!hasLuaIncr && !hasDirectIncr) {
    return null;
  }
  return client;
}

async function incrementRedisCounterAtomic(
  redis: any,
  fullKey: string,
  windowMs: number
): Promise<{ count: number; pttlMs: number }> {
  if (typeof redis.eval === 'function' && typeof redis.incr === 'function') {
    const raw = await redis.eval(LUA_ATOMIC_INCR_EXPIRE, 1, fullKey, String(windowMs));
    if (Array.isArray(raw) && raw.length >= 2) {
      const count = Number(raw[0]) || 1;
      const pttlMs = Number(raw[1]) > 0 ? Number(raw[1]) : windowMs;
      return { count, pttlMs };
    }
  }

  const count = Number(await redis.incr(fullKey)) || 1;
  let pttlMs = typeof redis.pttl === 'function' ? Number(await redis.pttl(fullKey)) : -1;
  if (count === 1 || pttlMs < 0) {
    if (typeof redis.pexpire === 'function') {
      await redis.pexpire(fullKey, windowMs);
    } else if (typeof redis.expire === 'function') {
      await redis.expire(fullKey, Math.max(1, Math.ceil(windowMs / 1000)));
    }
    pttlMs = windowMs;
  }
  return { count, pttlMs };
}

function pruneLocalCountersIfNeeded(now: number): void {
  if (localCounterMap.size < MAX_LOCAL_MEMORY_ENTRIES) return;
  for (const [k, entry] of localCounterMap.entries()) {
    if (entry.expiresAtMs <= now) {
      localCounterMap.delete(k);
    }
  }
  while (localCounterMap.size >= MAX_LOCAL_MEMORY_ENTRIES) {
    const oldestKey = localCounterMap.keys().next().value;
    if (!oldestKey) break;
    localCounterMap.delete(oldestKey);
  }
}

function pruneLocalKvIfNeeded(now: number): void {
  if (localKvMap.size < MAX_LOCAL_MEMORY_ENTRIES) return;
  for (const [k, entry] of localKvMap.entries()) {
    if (entry.expiresAtMs <= now) {
      localKvMap.delete(k);
    }
  }
  while (localKvMap.size >= MAX_LOCAL_MEMORY_ENTRIES) {
    const oldestKey = localKvMap.keys().next().value;
    if (!oldestKey) break;
    localKvMap.delete(oldestKey);
  }
}

function incrementLocalCounter(fullKey: string, windowMs: number, now: number): { count: number; expiresAtMs: number; backend: 'sqlite' | 'memory' } {
  const db = tryGetInitializedSqlite();
  if (db && ensureSqliteStateTable(db)) {
    const nextResetAt = now + windowMs;
    const runSqlite = () => {
      const existing = db
        .prepare('SELECT count, expires_at_ms FROM distributed_runtime_state WHERE state_key = ?')
        .get(fullKey) as { count: number; expires_at_ms: number } | undefined;

      if (!existing || Number(existing.expires_at_ms) <= now) {
        db.prepare(
          `INSERT OR REPLACE INTO distributed_runtime_state (state_key, value_json, count, expires_at_ms)
           VALUES (?, NULL, 1, ?)`
        ).run(fullKey, nextResetAt);
        return { count: 1, expiresAtMs: nextResetAt, backend: 'sqlite' as const };
      }

      const nextCount = (Number(existing.count) || 0) + 1;
      const existingExp = Number(existing.expires_at_ms) || nextResetAt;
      db.prepare('UPDATE distributed_runtime_state SET count = ? WHERE state_key = ?').run(nextCount, fullKey);
      return { count: nextCount, expiresAtMs: existingExp, backend: 'sqlite' as const };
    };

    try {
      return typeof db.transaction === 'function' ? db.transaction(runSqlite)() : runSqlite();
    } catch (err) {
      // Fall through cleanly to in-memory fallback
      log.debug('Distributed state SQLite increment fell back to memory', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  pruneLocalCountersIfNeeded(now);
  const existing = localCounterMap.get(fullKey);
  if (!existing || existing.expiresAtMs <= now) {
    const entry = { count: 1, expiresAtMs: now + windowMs };
    localCounterMap.set(fullKey, entry);
    return { count: 1, expiresAtMs: entry.expiresAtMs, backend: 'memory' };
  }

  existing.count += 1;
  return { count: existing.count, expiresAtMs: existing.expiresAtMs, backend: 'memory' };
}

function readLocalCounter(fullKey: string, now: number): { count: number; expiresAtMs: number; backend: 'sqlite' | 'memory' } {
  const db = tryGetInitializedSqlite();
  if (db && ensureSqliteStateTable(db)) {
    try {
      const existing = db
        .prepare('SELECT count, expires_at_ms FROM distributed_runtime_state WHERE state_key = ?')
        .get(fullKey) as { count: number; expires_at_ms: number } | undefined;
      if (!existing || Number(existing.expires_at_ms) <= now) {
        if (existing) {
          db.prepare('DELETE FROM distributed_runtime_state WHERE state_key = ?').run(fullKey);
        }
        return { count: 0, expiresAtMs: 0, backend: 'sqlite' };
      }
      return {
        count: Number(existing.count) || 0,
        expiresAtMs: Number(existing.expires_at_ms) || 0,
        backend: 'sqlite',
      };
    } catch (err) {
      // Fall through to memory
      log.debug('Distributed state SQLite read fell back to memory', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const existing = localCounterMap.get(fullKey);
  if (!existing || existing.expiresAtMs <= now) {
    if (existing) localCounterMap.delete(fullKey);
    return { count: 0, expiresAtMs: 0, backend: 'memory' };
  }
  return { count: existing.count, expiresAtMs: existing.expiresAtMs, backend: 'memory' };
}

function deleteLocalKey(fullKey: string): void {
  localCounterMap.delete(fullKey);
  localKvMap.delete(fullKey);
  const db = tryGetInitializedSqlite();
  if (db && ensureSqliteStateTable(db)) {
    try {
      db.prepare('DELETE FROM distributed_runtime_state WHERE state_key = ?').run(fullKey);
    } catch (err) {
      // Non-fatal in fallback cleanup
      log.debug('Distributed state SQLite delete cleanup skipped', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Atomic fixed-window rate limiter shared across replicas via Redis (Lua) or PostgreSQL.
 * Falls back safely to SQLite / bounded Map when Redis/PG are unavailable.
 */
export async function consumeFixedWindowRateLimitAsync(params: {
  namespace: string;
  key: string;
  windowMs: number;
  maxAttempts: number;
  nowMs?: number;
}): Promise<FixedWindowRateLimitResult> {
  const fullKey = buildStateKey(params.namespace, params.key);
  const now = params.nowMs ?? Date.now();
  const windowMs = Math.max(1000, params.windowMs);

  // Respect explicit synthetic clock time-travel in unit tests without hitting wall-clock Redis TTLs
  if (params.nowMs === undefined) {
    const redis = getRedisCounterClient();
    if (redis) {
      try {
        const { count, pttlMs } = await incrementRedisCounterAtomic(redis, fullKey, windowMs);
        return {
          allowed: count <= params.maxAttempts,
          count,
          remaining: Math.max(0, params.maxAttempts - count),
          retryAfterSeconds: Math.max(1, Math.ceil(pttlMs / 1000)),
          resetAt: now + pttlMs,
          backend: 'redis',
        };
      } catch (err: any) {
        log.warn('[DistributedState] Redis rate-limit error, falling back:', err?.message || err);
      }
    }

    const prisma = getCapablePgPrisma();
    if (prisma && (await ensurePgStateTable(prisma))) {
      try {
        const nextResetAt = now + windowMs;
        const rows = (await prisma.$queryRaw`
          INSERT INTO system_runtime_state (state_key, value_json, count, expires_at_ms)
          VALUES (${fullKey}, NULL, 1, ${nextResetAt})
          ON CONFLICT (state_key) DO UPDATE SET
            count = CASE
              WHEN system_runtime_state.expires_at_ms <= ${now} THEN 1
              ELSE system_runtime_state.count + 1
            END,
            expires_at_ms = CASE
              WHEN system_runtime_state.expires_at_ms <= ${now} THEN ${nextResetAt}
              ELSE system_runtime_state.expires_at_ms
            END
          RETURNING count, expires_at_ms
        `) as Array<{ count: number | bigint; expires_at_ms: number | bigint }>;

        if (Array.isArray(rows) && rows.length > 0) {
          const count = Number(rows[0].count) || 1;
          const resetAt = Number(rows[0].expires_at_ms) || nextResetAt;
          const remainingMs = Math.max(1000, resetAt - now);
          return {
            allowed: count <= params.maxAttempts,
            count,
            remaining: Math.max(0, params.maxAttempts - count),
            retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
            resetAt,
            backend: 'postgres',
          };
        }
      } catch (err: any) {
        log.warn('[DistributedState] PostgreSQL rate-limit error, falling back:', err?.message || err);
      }
    }
  }

  const local = incrementLocalCounter(fullKey, windowMs, now);
  const remainingMs = Math.max(0, local.expiresAtMs - now);
  return {
    allowed: local.count <= params.maxAttempts,
    count: local.count,
    remaining: Math.max(0, params.maxAttempts - local.count),
    retryAfterSeconds: local.count > params.maxAttempts ? Math.max(1, Math.ceil(remainingMs / 1000)) : 0,
    resetAt: local.expiresAtMs,
    backend: local.backend,
  };
}

/**
 * Checks whether an account/IP brute-force counter has reached its lockout threshold
 * without incrementing the counter.
 */
export async function checkAttemptLockoutAsync(params: {
  namespace: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
  nowMs?: number;
}): Promise<AttemptLockoutCheckResult> {
  const fullKey = buildStateKey(params.namespace, params.key);
  const now = params.nowMs ?? Date.now();

  if (params.nowMs === undefined) {
    const redis = getRedisCounterClient();
    if (redis) {
      try {
        const rawCount = await redis.get(fullKey);
        if (!rawCount) {
          return { allowed: true, count: 0, remainingMs: 0, retryAfterSeconds: 0, backend: 'redis' };
        }
        const count = Number(rawCount) || 0;
        if (count < params.maxAttempts) {
          return { allowed: true, count, remainingMs: 0, retryAfterSeconds: 0, backend: 'redis' };
        }
        let pttlMs = params.windowMs;
        if (typeof redis.pttl === 'function') {
          const ttl = Number(await redis.pttl(fullKey));
          if (ttl > 0) pttlMs = ttl;
        } else if (typeof redis.ttl === 'function') {
          const ttlSec = Number(await redis.ttl(fullKey));
          if (ttlSec > 0) pttlMs = ttlSec * 1000;
        }
        return {
          allowed: false,
          count,
          remainingMs: pttlMs,
          retryAfterSeconds: Math.max(1, Math.ceil(pttlMs / 1000)),
          backend: 'redis',
        };
      } catch (err: any) {
        log.warn('[DistributedState] Redis lockout check error, falling back:', err?.message || err);
      }
    }

    const prisma = getCapablePgPrisma();
    if (prisma && (await ensurePgStateTable(prisma))) {
      try {
        const rows = (await prisma.$queryRaw`
          SELECT count, expires_at_ms
          FROM system_runtime_state
          WHERE state_key = ${fullKey}
          LIMIT 1
        `) as Array<{ count: number | bigint; expires_at_ms: number | bigint }>;
        if (!rows || rows.length === 0) {
          return { allowed: true, count: 0, remainingMs: 0, retryAfterSeconds: 0, backend: 'postgres' };
        }
        const count = Number(rows[0].count) || 0;
        const expiresAt = Number(rows[0].expires_at_ms) || 0;
        if (expiresAt <= now) {
          await prisma.$executeRaw`DELETE FROM system_runtime_state WHERE state_key = ${fullKey}`.catch((pgErr: unknown) => {
            log.debug('Expired PG lockout state cleanup skipped', {
              err: pgErr instanceof Error ? pgErr.message : String(pgErr),
            });
          });
          return { allowed: true, count: 0, remainingMs: 0, retryAfterSeconds: 0, backend: 'postgres' };
        }
        const remainingMs = Math.max(0, expiresAt - now);
        return {
          allowed: count < params.maxAttempts,
          count,
          remainingMs,
          retryAfterSeconds: count >= params.maxAttempts ? Math.max(1, Math.ceil(remainingMs / 1000)) : 0,
          backend: 'postgres',
        };
      } catch (err: any) {
        log.warn('[DistributedState] PostgreSQL lockout check error, falling back:', err?.message || err);
      }
    }
  }

  const local = readLocalCounter(fullKey, now);
  if (local.count < params.maxAttempts) {
    return { allowed: true, count: local.count, remainingMs: 0, retryAfterSeconds: 0, backend: local.backend };
  }
  const remainingMs = Math.max(0, local.expiresAtMs - now);
  return {
    allowed: false,
    count: local.count,
    remainingMs,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    backend: local.backend,
  };
}

/**
 * Records a failed login or verification attempt atomically across replicas.
 */
export async function recordFailedAttemptAsync(params: {
  namespace: string;
  key: string;
  windowMs: number;
  maxAttempts: number;
  nowMs?: number;
}): Promise<AttemptFailureRecordResult> {
  const res = await consumeFixedWindowRateLimitAsync(params);
  return {
    count: res.count,
    locked: res.count >= params.maxAttempts,
    resetAt: res.resetAt,
    backend: res.backend,
  };
}

/**
 * Clears failure counter across Redis, PostgreSQL, SQLite, and local memory.
 */
export async function clearAttemptsAsync(params: { namespace: string; key: string }): Promise<void> {
  const fullKey = buildStateKey(params.namespace, params.key);
  deleteLocalKey(fullKey);

  const redis = getRedisKvClient();
  if (redis) {
    try {
      await redis.del(fullKey);
    } catch (err: any) {
      log.warn('[DistributedState] Redis clear attempts warning:', err?.message || err);
    }
  }

  const prisma = getCapablePgPrisma();
  if (prisma && (await ensurePgStateTable(prisma))) {
    try {
      await prisma.$executeRaw`DELETE FROM system_runtime_state WHERE state_key = ${fullKey}`;
    } catch (err: any) {
      log.warn('[DistributedState] PostgreSQL clear attempts warning:', err?.message || err);
    }
  }
}

/**
 * Stores a distributed session / key-value payload with TTL across Redis or PostgreSQL.
 */
export async function setDistributedKvAsync(params: {
  namespace: string;
  key: string;
  value: Record<string, unknown>;
  ttlMs: number;
  nowMs?: number;
}): Promise<void> {
  const fullKey = buildStateKey(params.namespace, params.key);
  const now = params.nowMs ?? Date.now();
  const expiresAtMs = now + Math.max(1000, params.ttlMs);
  const ttlSec = Math.max(1, Math.ceil(params.ttlMs / 1000));
  const payload = JSON.stringify({ ...params.value, exp: expiresAtMs });

  const redis = getRedisKvClient();
  if (redis && params.nowMs === undefined) {
    try {
      await redis.set(fullKey, payload, 'EX', ttlSec);
      return;
    } catch (err: any) {
      log.warn('[DistributedState] Redis KV set warning, falling back:', err?.message || err);
    }
  }

  const prisma = getCapablePgPrisma();
  if (prisma && params.nowMs === undefined && (await ensurePgStateTable(prisma))) {
    try {
      await prisma.$executeRaw`
        INSERT INTO system_runtime_state (state_key, value_json, count, expires_at_ms)
        VALUES (${fullKey}, ${payload}, 0, ${expiresAtMs})
        ON CONFLICT (state_key) DO UPDATE SET
          value_json = EXCLUDED.value_json,
          expires_at_ms = EXCLUDED.expires_at_ms
      `;
      return;
    } catch (err: any) {
      log.warn('[DistributedState] PostgreSQL KV set warning, falling back:', err?.message || err);
    }
  }

  const db = tryGetInitializedSqlite();
  if (db && ensureSqliteStateTable(db)) {
    try {
      db.prepare(
        `INSERT OR REPLACE INTO distributed_runtime_state (state_key, value_json, count, expires_at_ms)
         VALUES (?, ?, 0, ?)`
      ).run(fullKey, payload, expiresAtMs);
      return;
    } catch (err) {
      // Fall through to memory
      log.debug('Distributed KV SQLite write fell back to memory', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  pruneLocalKvIfNeeded(now);
  localKvMap.set(fullKey, { valueJson: payload, expiresAtMs });
}

/**
 * Reads a distributed session / key-value payload. Never returns expired items.
 * When Redis is configured, treats Redis as the authoritative source of truth so
 * revocations take effect immediately across all replicas.
 */
export async function getDistributedKvAsync(params: {
  namespace: string;
  key: string;
  nowMs?: number;
}): Promise<Record<string, unknown> | null> {
  const fullKey = buildStateKey(params.namespace, params.key);
  const now = params.nowMs ?? Date.now();

  const redis = getRedisKvClient();
  if (redis && params.nowMs === undefined) {
    try {
      const raw = await redis.get(fullKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.exp && Number(parsed.exp) <= now) {
        await redis.del(fullKey).catch((delErr: unknown) => {
          log.debug('Expired Redis KV cleanup skipped', {
            err: delErr instanceof Error ? delErr.message : String(delErr),
          });
        });
        return null;
      }
      return parsed;
    } catch (err: any) {
      log.warn('[DistributedState] Redis KV get warning, falling back:', err?.message || err);
    }
  }

  const prisma = getCapablePgPrisma();
  if (prisma && params.nowMs === undefined && (await ensurePgStateTable(prisma))) {
    try {
      const rows = (await prisma.$queryRaw`
        SELECT value_json, expires_at_ms
        FROM system_runtime_state
        WHERE state_key = ${fullKey}
        LIMIT 1
      `) as Array<{ value_json: string | null; expires_at_ms: number | bigint }>;
      if (!rows || rows.length === 0 || !rows[0].value_json) {
        return null;
      }
      const exp = Number(rows[0].expires_at_ms) || 0;
      if (exp > 0 && exp <= now) {
        await prisma.$executeRaw`DELETE FROM system_runtime_state WHERE state_key = ${fullKey}`.catch((pgErr: unknown) => {
          log.debug('Expired PG KV cleanup skipped', {
            err: pgErr instanceof Error ? pgErr.message : String(pgErr),
          });
        });
        return null;
      }
      return JSON.parse(rows[0].value_json);
    } catch (err: any) {
      log.warn('[DistributedState] PostgreSQL KV get warning, falling back:', err?.message || err);
    }
  }

  const db = tryGetInitializedSqlite();
  if (db && ensureSqliteStateTable(db)) {
    try {
      const row = db
        .prepare('SELECT value_json, expires_at_ms FROM distributed_runtime_state WHERE state_key = ?')
        .get(fullKey) as { value_json: string | null; expires_at_ms: number } | undefined;
      if (row) {
        if (!row.value_json || (row.expires_at_ms > 0 && Number(row.expires_at_ms) <= now)) {
          db.prepare('DELETE FROM distributed_runtime_state WHERE state_key = ?').run(fullKey);
          return null;
        }
        return JSON.parse(row.value_json);
      }
    } catch (err) {
      // Fall through to memory
      log.debug('Distributed KV SQLite read fell back to memory', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const local = localKvMap.get(fullKey);
  if (!local) return null;
  if (local.expiresAtMs <= now) {
    localKvMap.delete(fullKey);
    return null;
  }
  try {
    return JSON.parse(local.valueJson);
  } catch {
    return null;
  }
}

export async function deleteDistributedKvAsync(params: { namespace: string; key: string }): Promise<void> {
  await clearAttemptsAsync(params);
}

/**
 * Clears all keys for a namespace in local memory / SQLite fallback (used in tests).
 */
export function clearLocalDistributedStateNamespace(namespace: string): void {
  const prefix = parseNamespacePrefix(namespace);
  for (const k of localCounterMap.keys()) {
    if (k.startsWith(prefix)) localCounterMap.delete(k);
  }
  for (const k of localKvMap.keys()) {
    if (k.startsWith(prefix)) localKvMap.delete(k);
  }
  const db = tryGetInitializedSqlite();
  if (db && ensureSqliteStateTable(db)) {
    try {
      db.prepare('DELETE FROM distributed_runtime_state WHERE state_key LIKE ?').run(`${prefix}%`);
    } catch (err) {
      // Non-fatal in test cleanup
      log.debug('Distributed state SQLite namespace cleanup skipped', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function clearDistributedStateNamespaceAsync(namespace: string): Promise<void> {
  clearLocalDistributedStateNamespace(namespace);
  const prefix = parseNamespacePrefix(namespace);

  const prisma = getCapablePgPrisma();
  if (prisma && (await ensurePgStateTable(prisma))) {
    try {
      await prisma.$executeRaw`DELETE FROM system_runtime_state WHERE state_key LIKE ${`${prefix}%`}`;
    } catch (err) {
      // Non-fatal in test cleanup
      log.debug('Distributed state PG namespace cleanup skipped', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
