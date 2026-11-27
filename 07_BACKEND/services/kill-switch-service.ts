/**
 * MAHI Platform — TOTP-Gated Emergency Kill Switch Service
 *
 * Allows an Owner TOTP-verified administrator (or `EMERGENCY_KILL_SWITCH=true`
 * environment override) to immediately pause:
 *   1. New commercial checkouts / payment submissions / payment webhooks
 *   2. New license minting / key activation / trial activation
 *   3. Cloud profile sync uploads, downloads, storage ops, and sync locks
 * returning a clean HTTP 503 Maintenance response across all gateway replicas.
 *
 * Persistence:
 *   - Redis key `mahi:system:emergency_kill_switch` for sub-millisecond cross-replica fanout
 *   - PostgreSQL `system_runtime_flags` table (or SQLite `app_settings` table) for durability
 *   - Safe in-memory fallback when neither SQLite nor PG nor Redis is initialized
 */

import http from 'node:http';
import { AppError } from '../utils/app-error.js';
import { isRedisConfigured, getRedisClient } from '../../08_SECURITY/redis-lock-service.js';
import { isPostgresConfigured } from '../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../06_DATABASE/prisma-client.js';
import { getDatabase, SqliteWrapper } from '../../06_DATABASE/connection.js';

export interface EmergencyKillSwitchState {
  enabled: boolean;
  source: 'env' | 'redis' | 'database' | 'memory' | 'default';
  envOverride: boolean;
  dbEnabled: boolean;
  reason: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface PersistedKillSwitchRecord {
  enabled: boolean;
  reason: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

const KILL_SWITCH_REDIS_KEY = 'mahi:system:emergency_kill_switch';
const KILL_SWITCH_DB_KEY = 'emergency_kill_switch';
const pgFlagsTableReady = new WeakSet<object>();

let memoryKillSwitchRecord: PersistedKillSwitchRecord | null = null;

export function isEnvKillSwitchEnabled(): boolean {
  const raw = (process.env.EMERGENCY_KILL_SWITCH || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

function tryGetSqlite(): SqliteWrapper | null {
  try {
    return getDatabase();
  } catch {
    return null;
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

function getRedisKvClient(): any | null {
  if (!isRedisConfigured()) return null;
  const client = getRedisClient() as any;
  if (!client || typeof client.get !== 'function' || typeof client.set !== 'function') {
    return null;
  }
  return client;
}

async function ensurePgFlagsTable(prisma: any): Promise<boolean> {
  if (pgFlagsTableReady.has(prisma)) return true;
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS system_runtime_flags (
        flag_key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_by TEXT,
        updated_at TEXT NOT NULL
      )
    `;
    pgFlagsTableReady.add(prisma);
    return true;
  } catch (err: any) {
    console.warn('[KillSwitch] PostgreSQL flags table init warning:', err?.message || err);
    return false;
  }
}

function parsePersistedRecord(raw: unknown): PersistedKillSwitchRecord | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
    if (typeof obj?.enabled !== 'boolean') return null;
    return {
      enabled: obj.enabled,
      reason: typeof obj.reason === 'string' ? obj.reason : null,
      updatedBy: typeof obj.updatedBy === 'string' ? obj.updatedBy : null,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
    };
  } catch {
    return null;
  }
}

async function readPersistedKillSwitchRecordAsync(): Promise<{
  record: PersistedKillSwitchRecord | null;
  source: 'redis' | 'database' | 'memory' | 'default';
}> {
  const redis = getRedisKvClient();
  if (redis) {
    try {
      const raw = await redis.get(KILL_SWITCH_REDIS_KEY);
      const parsed = parsePersistedRecord(raw);
      if (parsed) {
        return { record: parsed, source: 'redis' };
      }
    } catch (err: any) {
      console.warn('[KillSwitch] Redis read warning, checking database:', err?.message || err);
    }
  }

  const prisma = getCapablePgPrisma();
  if (prisma && (await ensurePgFlagsTable(prisma))) {
    try {
      const rows = (await prisma.$queryRaw`
        SELECT value_json FROM system_runtime_flags WHERE flag_key = ${KILL_SWITCH_DB_KEY} LIMIT 1
      `) as Array<{ value_json: string }>;
      if (Array.isArray(rows) && rows.length > 0) {
        const parsed = parsePersistedRecord(rows[0].value_json);
        if (parsed) {
          if (redis) {
            await redis.set(KILL_SWITCH_REDIS_KEY, JSON.stringify(parsed)).catch(() => {});
          }
          return { record: parsed, source: 'database' };
        }
      }
    } catch (err: any) {
      console.warn('[KillSwitch] PostgreSQL read warning, falling back:', err?.message || err);
    }
  }

  const db = tryGetSqlite();
  if (db) {
    try {
      const row = db
        .prepare('SELECT value_json FROM app_settings WHERE key = ?')
        .get(KILL_SWITCH_DB_KEY) as { value_json?: string } | undefined;
      if (row?.value_json) {
        const parsed = parsePersistedRecord(row.value_json);
        if (parsed) {
          if (redis) {
            await redis.set(KILL_SWITCH_REDIS_KEY, JSON.stringify(parsed)).catch(() => {});
          }
          return { record: parsed, source: 'database' };
        }
      }
    } catch {
      // Ignore if app_settings table is absent in isolated DB tests
    }
  }

  if (memoryKillSwitchRecord) {
    return { record: memoryKillSwitchRecord, source: 'memory' };
  }

  return { record: null, source: 'default' };
}

export async function getEmergencyKillSwitchStateAsync(): Promise<EmergencyKillSwitchState> {
  const envOverride = isEnvKillSwitchEnabled();
  const { record, source } = await readPersistedKillSwitchRecordAsync();
  const dbEnabled = Boolean(record?.enabled);
  const enabled = envOverride || dbEnabled;

  return {
    enabled,
    source: envOverride ? 'env' : source,
    envOverride,
    dbEnabled,
    reason: record?.reason ?? (envOverride ? 'Forced active via EMERGENCY_KILL_SWITCH env variable' : null),
    updatedBy: record?.updatedBy ?? null,
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function isEmergencyKillSwitchActiveAsync(): Promise<boolean> {
  if (isEnvKillSwitchEnabled()) return true;
  const { record } = await readPersistedKillSwitchRecordAsync();
  return Boolean(record?.enabled);
}

export async function setEmergencyKillSwitchAsync(params: {
  enabled: boolean;
  reason?: string | null;
  updatedBy?: string | null;
}): Promise<EmergencyKillSwitchState> {
  const now = new Date().toISOString();
  const cleanReason = typeof params.reason === 'string' && params.reason.trim() ? params.reason.trim().slice(0, 1000) : null;
  const cleanActor = typeof params.updatedBy === 'string' && params.updatedBy.trim() ? params.updatedBy.trim().slice(0, 200) : 'OWNER';

  const record: PersistedKillSwitchRecord = {
    enabled: Boolean(params.enabled),
    reason: cleanReason,
    updatedBy: cleanActor,
    updatedAt: now,
  };
  const payload = JSON.stringify(record);

  let persistedToDb = false;

  const prisma = getCapablePgPrisma();
  if (prisma && (await ensurePgFlagsTable(prisma))) {
    await prisma.$executeRaw`
      INSERT INTO system_runtime_flags (flag_key, value_json, updated_by, updated_at)
      VALUES (${KILL_SWITCH_DB_KEY}, ${payload}, ${cleanActor}, ${now})
      ON CONFLICT (flag_key) DO UPDATE SET
        value_json = EXCLUDED.value_json,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
    `;
    persistedToDb = true;
  }

  const db = tryGetSqlite();
  if (db) {
    try {
      db.prepare(
        `INSERT OR REPLACE INTO app_settings (key, value_json, updated_at)
         VALUES (?, ?, ?)`
      ).run(KILL_SWITCH_DB_KEY, payload, now);
      persistedToDb = true;
    } catch {
      // Fallback safely if app_settings doesn't exist
    }
  }

  if (!persistedToDb) {
    memoryKillSwitchRecord = record;
  } else {
    memoryKillSwitchRecord = null;
  }

  const redis = getRedisKvClient();
  if (redis) {
    try {
      await redis.set(KILL_SWITCH_REDIS_KEY, payload);
    } catch (err: any) {
      console.warn('[KillSwitch] Redis sync write warning:', err?.message || err);
    }
  }

  return getEmergencyKillSwitchStateAsync();
}

export function buildKillSwitchMaintenanceMessage(): string {
  return 'Service temporarily paused for emergency maintenance. Please try again later.';
}

export async function assertNotEmergencyFrozen(_operation: string): Promise<void> {
  if (await isEmergencyKillSwitchActiveAsync()) {
    throw new AppError('SERVICE_UNAVAILABLE', buildKillSwitchMaintenanceMessage(), 503);
  }
}

export async function rejectIfEmergencyFrozen(
  res: http.ServerResponse,
  _operation: string
): Promise<boolean> {
  if (!(await isEmergencyKillSwitchActiveAsync())) {
    return false;
  }
  if (!res.headersSent) {
    res.setHeader('Retry-After', '300');
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        maintenance: true,
        retryAfterSeconds: 300,
        error: buildKillSwitchMaintenanceMessage(),
      })
    );
  }
  return true;
}

export async function resetKillSwitchForTesting(): Promise<void> {
  memoryKillSwitchRecord = null;
  const redis = getRedisKvClient();
  if (redis && typeof redis.del === 'function') {
    await redis.del(KILL_SWITCH_REDIS_KEY).catch(() => {});
  }
  const prisma = getCapablePgPrisma();
  if (prisma && (await ensurePgFlagsTable(prisma))) {
    await prisma.$executeRaw`DELETE FROM system_runtime_flags WHERE flag_key = ${KILL_SWITCH_DB_KEY}`.catch(() => {});
  }
  const db = tryGetSqlite();
  if (db) {
    try {
      db.prepare('DELETE FROM app_settings WHERE key = ?').run(KILL_SWITCH_DB_KEY);
    } catch {}
  }
}
