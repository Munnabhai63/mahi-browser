import { getDatabase } from '../../../06_DATABASE/connection.js';
import { isRedisConfigured, redisLockService } from '../../../08_SECURITY/redis-lock-service.js';
import {
  isPostgresConfigured,
  getCentralRepository,
  type CloudProfileLockRecord,
  type CloudProfileRecord as RepoCloudProfileRecord,
} from '../../../06_DATABASE/central-repository.js';
import { log, logCloudAudit, logCloudAuditAsync } from './cloud-profile-shared.js';
import { verifyUserProfileAccess, verifyUserProfileAccessAsync } from './cloud-profile-access.js';

// ============================================================================
// DISTRIBUTED PROFILE LOCKING
// ============================================================================
export function cleanupExpiredLocks(): void {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare('DELETE FROM cloud_profile_locks WHERE expires_at < ?').run(now);
  } catch (err) {
    log.debug('Expired cloud_profile_locks cleanup skipped', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export function acquireProfileLock(
  userId: string,
  cloudProfileId: string,
  deviceId: string,
  deviceName: string,
  ttlSeconds = 300
): { acquired: boolean; heldBy?: string; expiresAt?: string } {
  const db = getDatabase();
  const profile = db
    .prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `)
    .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_RUN');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  } else {
    // If cloud profile record does not exist yet, create placeholder record to preserve foreign key integrity
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO auth_users (id, email, normalized_email, password_hash, salt, name, created_at, updated_at)
      VALUES (?, ?, ?, 'system_placeholder', 'system_placeholder', 'System User', ?, ?)
    `).run(userId, `${userId}@local.system`, `${userId}@local.system`, nowIso, nowIso);
    db.prepare(`
      INSERT OR IGNORE INTO cloud_profiles (id, owner_id, local_profile_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cloudProfileId, userId, cloudProfileId, 'Cloud Profile', nowIso, nowIso);
  }

  cleanupExpiredLocks();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  // Check if lock already held by another device
  const existing = db
    .prepare(`
    SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ?
  `)
    .get(cloudProfileId) as unknown as CloudProfileLockRecord | undefined;

  if (existing) {
    if (existing.device_id === deviceId) {
      // Same device re-acquiring / renewing
      db.prepare(`
        UPDATE cloud_profile_locks SET expires_at = ?, locked_at = ? WHERE cloud_profile_id = ?
      `).run(expiresAt, now.toISOString(), cloudProfileId);
      return { acquired: true, expiresAt };
    }
    // Held by different device
    return {
      acquired: false,
      heldBy: existing.device_name || existing.device_id,
      expiresAt: existing.expires_at,
    };
  }

  // Insert new lock
  db.prepare(`
    INSERT INTO cloud_profile_locks (cloud_profile_id, device_id, device_name, user_id, locked_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(cloudProfileId, deviceId, deviceName, userId, now.toISOString(), expiresAt);

  logCloudAudit(userId, 'LOCK_ACQUIRED', `Locked by ${deviceName}`, cloudProfileId, deviceId);

  return { acquired: true, expiresAt };
}

export function renewProfileLock(
  userId: string,
  cloudProfileId: string,
  deviceId: string,
  ttlSeconds = 300
): { renewed: boolean; expiresAt?: string } {
  const db = getDatabase();
  const profile = db
    .prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `)
    .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_RUN');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  } else {
    // If cloud profile record does not exist yet, create placeholder record to preserve foreign key integrity
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO auth_users (id, email, normalized_email, password_hash, salt, name, created_at, updated_at)
      VALUES (?, ?, ?, 'system_placeholder', 'system_placeholder', 'System User', ?, ?)
    `).run(userId, `${userId}@local.system`, `${userId}@local.system`, nowIso, nowIso);
    db.prepare(`
      INSERT OR IGNORE INTO cloud_profiles (id, owner_id, local_profile_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cloudProfileId, userId, cloudProfileId, 'Cloud Profile', nowIso, nowIso);
  }

  cleanupExpiredLocks();

  const lock = db
    .prepare(`
    SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ? AND device_id = ?
  `)
    .get(cloudProfileId, deviceId) as unknown as CloudProfileLockRecord | undefined;

  if (!lock) {
    return { renewed: false };
  }

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  db.prepare(`
    UPDATE cloud_profile_locks SET expires_at = ? WHERE cloud_profile_id = ? AND device_id = ?
  `).run(expiresAt, cloudProfileId, deviceId);

  return { renewed: true, expiresAt };
}

export function releaseProfileLock(userId: string, cloudProfileId: string, deviceId: string): { released: boolean } {
  const db = getDatabase();
  const profile = db
    .prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `)
    .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_VIEW');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  }

  const res = db
    .prepare(`
    DELETE FROM cloud_profile_locks WHERE cloud_profile_id = ? AND device_id = ?
  `)
    .run(cloudProfileId, deviceId);

  if (res.changes > 0) {
    logCloudAudit(userId, 'LOCK_RELEASED', `Lock released by ${deviceId}`, cloudProfileId, deviceId);
  }

  return { released: res.changes > 0 };
}

export function getProfileLockStatus(userId: string, cloudProfileId: string) {
  const db = getDatabase();
  const profile = db
    .prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `)
    .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_VIEW');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  }

  cleanupExpiredLocks();

  const lock = db
    .prepare(`
    SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ?
  `)
    .get(cloudProfileId) as unknown as CloudProfileLockRecord | undefined;

  if (!lock) {
    return { isLocked: false };
  }

  return {
    isLocked: true,
    heldBy: lock.device_name || lock.device_id,
    deviceId: lock.device_id,
    expiresAt: lock.expires_at,
  };
}

// ============================================================================
// ASYNC DISTRIBUTED PROFILE LOCKING (REDIS WITH SQLITE FALLBACK)
// ============================================================================
export async function acquireProfileLockAsync(
  userId: string,
  cloudProfileId: string,
  deviceId: string,
  deviceName: string,
  ttlSeconds = 300
): Promise<{ acquired: boolean; heldBy?: string; deviceId?: string; expiresAt?: string }> {
  if (isRedisConfigured()) {
    try {
      const db = getDatabase();
      const profile = db
        .prepare(`SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'`)
        .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;
      if (profile) {
        const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_RUN');
        if (!access) {
          throw new Error('Access denied: Profile not found or not shared with you');
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('Access denied')) throw e;
    }

    const redisRes = await redisLockService.acquireLock(cloudProfileId, deviceId, deviceName, userId, ttlSeconds);
    if (redisRes.acquired) {
      await logCloudAuditAsync(userId, 'LOCK_ACQUIRED', `Locked by ${deviceName} (Redis)`, cloudProfileId, deviceId);
      return {
        acquired: true,
        expiresAt: redisRes.expiresAt,
        deviceId: redisRes.deviceId,
      };
    }
    return {
      acquired: false,
      heldBy: redisRes.heldBy,
      deviceId: redisRes.deviceId,
      expiresAt: redisRes.expiresAt,
    };
  }

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const existing = await repo.findLock(cloudProfileId);
    if (existing && new Date(existing.expires_at).getTime() > now.getTime()) {
      if (existing.device_id === deviceId) {
        await repo.upsertLock({
          cloudProfileId,
          deviceId,
          deviceName,
          userId,
          lockedAt: now.toISOString(),
          expiresAt,
        });
        return { acquired: true, expiresAt };
      }
      return {
        acquired: false,
        heldBy: existing.device_name || existing.device_id,
        deviceId: existing.device_id,
        expiresAt: existing.expires_at,
      };
    }
    await repo.upsertLock({
      cloudProfileId,
      deviceId,
      deviceName,
      userId,
      lockedAt: now.toISOString(),
      expiresAt,
    });
    await logCloudAuditAsync(userId, 'LOCK_ACQUIRED', `Locked by ${deviceName} (Postgres)`, cloudProfileId, deviceId);
    return { acquired: true, expiresAt };
  }

  return acquireProfileLock(userId, cloudProfileId, deviceId, deviceName, ttlSeconds);
}

export async function renewProfileLockAsync(
  userId: string,
  cloudProfileId: string,
  deviceId: string,
  ttlSeconds = 300
): Promise<{ renewed: boolean; expiresAt?: string }> {
  if (isRedisConfigured()) {
    try {
      const access = await verifyUserProfileAccessAsync(userId, cloudProfileId, 'PROFILE_RUN');
      if (!access && !isPostgresConfigured()) {
        const db = getDatabase();
        const profile = db
          .prepare(`SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'`)
          .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;
        if (profile) throw new Error('Access denied: Profile not found or not shared with you');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('Access denied')) throw e;
    }

    const redisRes = await redisLockService.renewLock(cloudProfileId, deviceId, ttlSeconds);
    return {
      renewed: redisRes.renewed,
      expiresAt: redisRes.expiresAt,
    };
  }

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const existing = await repo.findLock(cloudProfileId);
    if (!existing || existing.device_id !== deviceId) {
      return { renewed: false };
    }
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await repo.upsertLock({
      cloudProfileId,
      deviceId,
      deviceName: existing.device_name,
      userId,
      lockedAt: existing.locked_at,
      expiresAt,
    });
    return { renewed: true, expiresAt };
  }

  return renewProfileLock(userId, cloudProfileId, deviceId, ttlSeconds);
}

export async function releaseProfileLockAsync(
  userId: string,
  cloudProfileId: string,
  deviceId: string
): Promise<{ released: boolean }> {
  if (isRedisConfigured()) {
    try {
      const access = await verifyUserProfileAccessAsync(userId, cloudProfileId, 'PROFILE_VIEW');
      if (!access && !isPostgresConfigured()) {
        const db = getDatabase();
        const profile = db
          .prepare(`SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'`)
          .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;
        if (profile) throw new Error('Access denied: Profile not found or not shared with you');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('Access denied')) throw e;
    }

    const redisRes = await redisLockService.releaseLock(cloudProfileId, deviceId);
    if (redisRes.released) {
      await logCloudAuditAsync(
        userId,
        'LOCK_RELEASED',
        `Lock released by ${deviceId} (Redis)`,
        cloudProfileId,
        deviceId
      );
    }
    return { released: redisRes.released };
  }

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const existing = await repo.findLock(cloudProfileId);
    if (existing && existing.device_id === deviceId) {
      const res = await repo.deleteLock(cloudProfileId);
      if (res) {
        await logCloudAuditAsync(
          userId,
          'LOCK_RELEASED',
          `Lock released by ${deviceId} (Postgres)`,
          cloudProfileId,
          deviceId
        );
      }
      return { released: res };
    }
    return { released: false };
  }

  return releaseProfileLock(userId, cloudProfileId, deviceId);
}

export async function getProfileLockStatusAsync(
  userId: string,
  cloudProfileId: string
): Promise<{ isLocked: boolean; heldBy?: string; deviceId?: string; expiresAt?: string }> {
  if (isRedisConfigured()) {
    try {
      const access = await verifyUserProfileAccessAsync(userId, cloudProfileId, 'PROFILE_VIEW');
      if (!access && !isPostgresConfigured()) {
        const db = getDatabase();
        const profile = db
          .prepare(`SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'`)
          .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;
        if (profile) throw new Error('Access denied: Profile not found or not shared with you');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('Access denied')) throw e;
    }

    const redisRes = await redisLockService.getLockStatus(cloudProfileId);
    if (!redisRes.isLocked) {
      return { isLocked: false };
    }
    return {
      isLocked: true,
      heldBy: redisRes.heldBy,
      deviceId: redisRes.deviceId,
      expiresAt: redisRes.expiresAt,
    };
  }

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const lock = await repo.findLock(cloudProfileId);
    if (!lock) return { isLocked: false };
    if (new Date(lock.expires_at).getTime() < Date.now()) {
      await repo.deleteLock(cloudProfileId);
      return { isLocked: false };
    }
    return {
      isLocked: true,
      heldBy: lock.device_name || lock.device_id,
      deviceId: lock.device_id,
      expiresAt: lock.expires_at,
    };
  }

  return getProfileLockStatus(userId, cloudProfileId);
}
