/**
 * MAHI Platform V2 — Redis Distributed Concurrency Lock Manager
 * Implements Section 7 of MAHI_BROWSER_TARGET.md using ioredis.
 * Provides atomic Set-NX, atomic Lua renewals, and ownership-guarded releases.
 */

import { Redis } from 'ioredis';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('redis-lock-service');

export interface LockAcquireResult {
  acquired: boolean;
  cloudProfileId: string;
  heldBy?: string;
  deviceId?: string;
  deviceName?: string;
  lockedAt?: string;
  expiresAt?: string;
  ttlSeconds?: number;
}

export interface LockReleaseResult {
  released: boolean;
  cloudProfileId: string;
  reason?: string;
}

export interface LockRenewResult {
  renewed: boolean;
  cloudProfileId: string;
  expiresAt?: string;
  reason?: string;
}

export interface LockStatusResult {
  isLocked: boolean;
  cloudProfileId: string;
  deviceId?: string;
  heldBy?: string;
  deviceName?: string;
  userId?: string;
  lockedAt?: string;
  expiresAt?: string;
  ttlRemainingSeconds?: number;
}

const DEFAULT_LOCK_TTL_SECONDS = 300; // 5 minutes (Section 7)

// Atomic Lua script to renew lock ONLY if deviceId matches
const LUA_RENEW_LOCK = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
local match = false
local ok, data = pcall(cjson.decode, current)
if ok and data and data.deviceId == ARGV[1] then
  match = true
elseif string.find(current, '"deviceId":"' .. ARGV[1] .. '"', 1, true) or string.find(current, '"deviceId": "' .. ARGV[1] .. '"', 1, true) then
  match = true
end

if match then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return 1
else
  return -1
end
`;

// Atomic Lua script to release lock ONLY if deviceId matches
const LUA_RELEASE_LOCK = `
local current = redis.call('GET', KEYS[1])
if not current then
  return 0
end
local match = false
local ok, data = pcall(cjson.decode, current)
if ok and data and data.deviceId == ARGV[1] then
  match = true
elseif string.find(current, '"deviceId":"' .. ARGV[1] .. '"', 1, true) or string.find(current, '"deviceId": "' .. ARGV[1] .. '"', 1, true) then
  match = true
end

if match then
  return redis.call('DEL', KEYS[1])
else
  return -1
end
`;

let redisClientInstance: Redis | null = null;
let testRedisInstance: any = null;

export function isRedisConfigured(): boolean {
  if (testRedisInstance) return true;
  const rawUrl = process.env.REDIS_URL;
  const url = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : '';
  if (rawUrl && rawUrl !== url) {
    process.env.REDIS_URL = url;
  }
  return Boolean(url);
}

export function getRedisClient(): Redis | null {
  if (testRedisInstance) return testRedisInstance;
  if (!isRedisConfigured()) return null;

  if (!redisClientInstance) {
    const rawUrl = process.env.REDIS_URL!;
    const url = rawUrl.trim().replace(/^["']|["']$/g, '');
    redisClientInstance = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
    });
  }
  return redisClientInstance;
}

export function setRedisClientForTest(client: any): void {
  testRedisInstance = client;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClientInstance) {
    try {
      await redisClientInstance.quit();
    } catch (err) {
      log.debug('Redis disconnect quit skipped cleanly', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    redisClientInstance = null;
  }
}

export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (testRedisInstance) {
    try {
      const start = Date.now();
      const pong = await testRedisInstance.ping();
      return { connected: pong === 'PONG', latencyMs: Date.now() - start };
    } catch (err: any) {
      return { connected: false, error: err?.message || 'Redis ping failed' };
    }
  }

  if (!isRedisConfigured()) {
    return { connected: false, error: 'REDIS_URL not configured' };
  }

  const client = getRedisClient();
  if (!client) {
    return { connected: false, error: 'Redis client not initialized' };
  }

  const start = Date.now();
  try {
    const res = await client.ping();
    return {
      connected: res === 'PONG',
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err?.message || 'Redis connection error',
    };
  }
}

export class RedisDistributedLockService {
  private get client(): Redis {
    const r = getRedisClient();
    if (!r) {
      throw new Error('RedisDistributedLockService requires REDIS_URL to be configured');
    }
    return r;
  }

  private getLockKey(cloudProfileId: string): string {
    return `lock:profile:${cloudProfileId}`;
  }

  /**
   * Acquires a distributed lock for a profile using atomic SET NX EX.
   */
  async acquireLock(
    cloudProfileId: string,
    deviceId: string,
    deviceName: string,
    userId: string = 'SYSTEM',
    ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
  ): Promise<LockAcquireResult> {
    const lockKey = this.getLockKey(cloudProfileId);
    const lockedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const payload = JSON.stringify({
      deviceId,
      deviceName,
      userId,
      acquiredAt: lockedAt,
      expiresAt,
    });

    const res = await this.client.set(lockKey, payload, 'EX', ttlSeconds, 'NX');
    if (res === 'OK') {
      return {
        acquired: true,
        cloudProfileId,
        deviceId,
        deviceName,
        lockedAt,
        expiresAt,
        ttlSeconds,
      };
    }

    // Lock already exists: check if held by same device
    const existingRaw = await this.client.get(lockKey);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (existing.deviceId === deviceId) {
          // Re-acquire / extend
          const renewed = await this.renewLock(cloudProfileId, deviceId, ttlSeconds);
          return {
            acquired: renewed.renewed,
            cloudProfileId,
            deviceId,
            deviceName,
            lockedAt: existing.acquiredAt || lockedAt,
            expiresAt: renewed.expiresAt || expiresAt,
            ttlSeconds,
          };
        }
        return {
          acquired: false,
          cloudProfileId,
          heldBy: existing.deviceName || existing.deviceId || 'Another Device',
          deviceId: existing.deviceId,
          expiresAt: existing.expiresAt,
        };
      } catch (parseErr) {
        log.warn('Failed parsing existing Redis lock metadata payload', {
          cloudProfileId,
          err: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }
    }

    return {
      acquired: false,
      cloudProfileId,
      heldBy: 'Another Device',
    };
  }

  /**
   * Renews an existing lock using atomic Lua evaluation ensuring ownership matches.
   */
  async renewLock(
    cloudProfileId: string,
    deviceId: string,
    ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
  ): Promise<LockRenewResult> {
    const lockKey = this.getLockKey(cloudProfileId);
    const existingRaw = await this.client.get(lockKey);
    let userId = 'SYSTEM';
    let deviceName = deviceId;
    let acquiredAt = new Date().toISOString();

    if (existingRaw) {
      try {
        const p = JSON.parse(existingRaw);
        userId = p.userId || userId;
        deviceName = p.deviceName || deviceName;
        acquiredAt = p.acquiredAt || acquiredAt;
      } catch (parseErr) {
        log.warn('Failed parsing Redis lock payload during renew', {
          cloudProfileId,
          err: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const newPayload = JSON.stringify({
      deviceId,
      deviceName,
      userId,
      acquiredAt,
      expiresAt,
    });

    const evalRes = await this.client.eval(
      LUA_RENEW_LOCK,
      1,
      lockKey,
      deviceId,
      newPayload,
      ttlSeconds.toString()
    );

    if (evalRes === 1) {
      return { renewed: true, cloudProfileId, expiresAt };
    } else if (evalRes === -1) {
      return { renewed: false, cloudProfileId, reason: 'LOCK_HELD_BY_ANOTHER' };
    } else {
      return { renewed: false, cloudProfileId, reason: 'LOCK_NOT_FOUND' };
    }
  }

  /**
   * Releases an existing lock using atomic Lua evaluation ensuring ownership matches.
   */
  async releaseLock(cloudProfileId: string, deviceId: string): Promise<LockReleaseResult> {
    const lockKey = this.getLockKey(cloudProfileId);
    const evalRes = await this.client.eval(LUA_RELEASE_LOCK, 1, lockKey, deviceId);

    if (evalRes === 1) {
      return { released: true, cloudProfileId };
    } else if (evalRes === 0) {
      return { released: false, cloudProfileId, reason: 'LOCK_NOT_FOUND' };
    } else {
      return { released: false, cloudProfileId, reason: 'LOCK_HELD_BY_ANOTHER' };
    }
  }

  /**
   * Queries the current lock status and remaining TTL from Redis.
   */
  async getLockStatus(cloudProfileId: string): Promise<LockStatusResult> {
    const lockKey = this.getLockKey(cloudProfileId);
    const raw = await this.client.get(lockKey);
    const ttl = await this.client.ttl(lockKey);

    if (!raw || ttl <= 0) {
      return {
        isLocked: false,
        cloudProfileId,
      };
    }

    try {
      const data = JSON.parse(raw);
      return {
        isLocked: true,
        cloudProfileId,
        deviceId: data.deviceId,
        heldBy: data.deviceName || data.deviceId || 'Unknown Device',
        deviceName: data.deviceName,
        userId: data.userId,
        lockedAt: data.acquiredAt,
        expiresAt: data.expiresAt,
        ttlRemainingSeconds: ttl,
      };
    } catch {
      return {
        isLocked: true,
        cloudProfileId,
        heldBy: 'Active Lock',
        ttlRemainingSeconds: ttl,
      };
    }
  }
}

// Global Singleton Instance
export const redisLockService = new RedisDistributedLockService();
