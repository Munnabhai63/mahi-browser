import crypto from 'node:crypto';
import { getPrismaClient, isPostgresConfigured } from '../../06_DATABASE/prisma-client.js';
import type { CommercialUserStatus, CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';
import { ensurePgCommercialMirror, stripCentralUserPrefix } from '../../05_AUTH/user-model-unifier.js';
import {
  updateUserStatus,
  updateUserPlan,
  boostUserQuota,
  setUserFeatureOverrides,
} from './commercial-auth-service.js';
import { resetAllUserDevices } from './commercial-device-service.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('admin-actions');

function isPrismaNotFoundError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'P2025';
}

async function insertPostgresAuditLog(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  params: {
    actor: { id: string; name: string; role: CommercialRole };
    action: string;
    targetId: string;
    details: string;
    result: string;
    createdAt?: string;
  }
): Promise<void> {
  await prisma.commercial_audit_logs.create({
    data: {
      id: crypto.randomUUID(),
      actor_id: params.actor.id,
      actor_name: params.actor.name,
      actor_role: params.actor.role,
      action: params.action,
      target_type: 'USER',
      target_id: params.targetId,
      details: params.details,
      ip_address: null,
      result: params.result,
      created_at: params.createdAt || new Date().toISOString(),
    },
  });
}

/**
 * Admin action: update user status (ACTIVE, SUSPENDED, BANNED).
 * Updates authoritative `auth_users` and syncs companion FK mirror if present.
 */
export async function adminSetUserStatus(
  rawUserId: string,
  status: CommercialUserStatus,
  actor: { id: string; name: string; role: CommercialRole },
  reason?: string
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const userId = stripCentralUserPrefix(rawUserId);
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  if (!prisma) {
    const ok = updateUserStatus(userId, status, actor, reason);
    return { ok };
  }

  const now = new Date().toISOString();
  const current = await prisma.auth_users.findUnique({ where: { id: userId } });
  const mirror = current ? null : await prisma.commercial_users.findUnique({ where: { id: userId } });
  const targetEmail = current?.email || mirror?.email;
  const previousStatus = current?.status || mirror?.status;
  if (!targetEmail) return { ok: false };

  if (current) {
    try {
      await prisma.auth_users.update({
        where: { id: userId },
        data: { status, updated_at: now },
      });
    } catch (err: unknown) {
      if (isPrismaNotFoundError(err)) return { ok: false };
      throw err;
    }
  }

  if (typeof prisma.commercial_users?.updateMany === 'function') {
    await prisma.commercial_users.updateMany({
      where: { id: userId },
      data: { status, updated_at: now },
    });
  }

  await insertPostgresAuditLog(prisma, {
    actor,
    action: `USER_${status}`,
    targetId: userId,
    details: `Changed user status for ${targetEmail} from ${previousStatus} to ${status}.${reason ? ` Reason: ${reason}` : ''}`,
    result: 'WARNING',
    createdAt: now,
  });

  return { ok: true };
}

/**
 * Admin action: update user plan on authoritative `auth_users` + commercial mirror.
 */
export async function adminSetUserPlan(
  rawUserId: string,
  planId: string,
  actor: { id: string; name: string; role: CommercialRole }
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const userId = stripCentralUserPrefix(rawUserId);
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  if (!prisma) {
    const ok = updateUserPlan(userId, planId, actor);
    return { ok };
  }

  const mirror = await ensurePgCommercialMirror(prisma, userId);
  const authUser = await prisma.auth_users.findUnique({ where: { id: userId } });
  if (!mirror && !authUser) return { ok: false };

  const now = new Date().toISOString();
  if (authUser) {
    await prisma.auth_users.update({
      where: { id: userId },
      data: { plan_id: planId, updated_at: now },
    });
  }

  if (mirror) {
    try {
      await prisma.commercial_users.update({
        where: { id: userId },
        data: { plan_id: planId, updated_at: now },
      });
    } catch (err: unknown) {
      if (!isPrismaNotFoundError(err)) throw err;
    }
  }

  await insertPostgresAuditLog(prisma, {
    actor,
    action: 'USER_PLAN_CHANGE',
    targetId: userId,
    details: `Changed plan for ${authUser?.email || mirror?.email || userId} to ${planId}`,
    result: 'SUCCESS',
    createdAt: now,
  });

  return { ok: true };
}

/**
 * Admin action: instant quota booster (PROFILES or PROXY_GB).
 */
export async function adminBoostQuota(
  rawUserId: string,
  type: 'PROFILES' | 'PROXY_GB',
  amount: number,
  actor: { id: string; name: string; role: CommercialRole }
): Promise<{
  success: boolean;
  bonusProfiles?: number;
  bonusProxyBytes?: number;
  error?: string;
  message?: string;
}> {
  const userId = stripCentralUserPrefix(rawUserId);
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  if (!prisma) {
    return boostUserQuota(userId, type, amount, actor);
  }

  if (type !== 'PROFILES' && type !== 'PROXY_GB') {
    return { success: false, error: 'Invalid boost type. Expected PROFILES or PROXY_GB.' };
  }

  const current = await ensurePgCommercialMirror(prisma, userId);
  if (!current) {
    return { success: false, error: 'User not found.' };
  }

  const now = new Date().toISOString();

  if (type === 'PROFILES') {
    const increment = Math.max(1, Math.floor(amount));
    await prisma.$executeRaw`UPDATE commercial_users SET bonus_profiles = COALESCE(bonus_profiles, 0) + ${increment}, updated_at = ${now} WHERE id = ${userId}`;
    const updated = await prisma.commercial_users.findUnique({
      where: { id: userId },
      select: { bonus_profiles: true, bonus_proxy_bytes: true },
    });
    const bonusProfiles = updated?.bonus_profiles ?? 0;
    const rawProxyBytes = updated?.bonus_proxy_bytes ?? 0n;
    if (rawProxyBytes > BigInt(Number.MAX_SAFE_INTEGER)) {
      log.warn(`[adminBoostQuota] bonus_proxy_bytes exceeds MAX_SAFE_INTEGER for user ${userId}: ${rawProxyBytes}`);
    }
    const bonusProxyBytes = Number(rawProxyBytes);

    await insertPostgresAuditLog(prisma, {
      actor,
      action: 'USER_QUOTA_BOOST_PROFILES',
      targetId: userId,
      details: `Admin granted +${increment} bonus profiles to ${current.email}. Total bonus: ${bonusProfiles}`,
      result: 'SUCCESS',
      createdAt: now,
    });

    return {
      success: true,
      bonusProfiles,
      bonusProxyBytes,
    };
  }

  if (type === 'PROXY_GB') {
    const incrementGb = Math.max(1, Math.floor(amount));
    const incrementBytes = BigInt(incrementGb) * BigInt(1024 * 1024 * 1024);
    await prisma.$executeRaw`UPDATE commercial_users SET bonus_proxy_bytes = COALESCE(bonus_proxy_bytes, 0) + ${incrementBytes}, updated_at = ${now} WHERE id = ${userId}`;
    const updated = await prisma.commercial_users.findUnique({
      where: { id: userId },
      select: { bonus_profiles: true, bonus_proxy_bytes: true },
    });
    const bonusProfiles = updated?.bonus_profiles ?? 0;
    const rawProxyBytes = updated?.bonus_proxy_bytes ?? 0n;
    if (rawProxyBytes > BigInt(Number.MAX_SAFE_INTEGER)) {
      log.warn(`[adminBoostQuota] bonus_proxy_bytes exceeds MAX_SAFE_INTEGER for user ${userId}: ${rawProxyBytes}`);
    }
    const bonusProxyBytes = Number(rawProxyBytes);

    await insertPostgresAuditLog(prisma, {
      actor,
      action: 'USER_QUOTA_BOOST_PROXY',
      targetId: userId,
      details: `Admin granted +${incrementGb} GB proxy data to ${current.email}.`,
      result: 'SUCCESS',
      createdAt: now,
    });

    return {
      success: true,
      bonusProfiles,
      bonusProxyBytes,
    };
  }

  return { success: false, error: 'Invalid boost type. Expected PROFILES or PROXY_GB.' };
}

/**
 * Admin action: enterprise feature overrides.
 */
export async function adminSetFeatureOverrides(
  rawUserId: string,
  overrides: Record<string, boolean>,
  actor: { id: string; name: string; role: CommercialRole }
): Promise<{
  success: boolean;
  overrides?: Record<string, boolean>;
  error?: string;
  message?: string;
}> {
  const userId = stripCentralUserPrefix(rawUserId);
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  if (!prisma) {
    return setUserFeatureOverrides(userId, overrides, actor);
  }

  const current = await ensurePgCommercialMirror(prisma, userId);
  if (!current) {
    return { success: false, error: 'User not found.' };
  }

  let existingOverrides: Record<string, boolean> = {};
  try {
    existingOverrides = JSON.parse(current.feature_overrides || '{}');
  } catch (err) {
    log.warn(`[adminSetFeatureOverrides] Failed to parse feature_overrides JSON for user ${userId}, using {}:`, err);
    existingOverrides = {};
  }

  const merged = { ...existingOverrides, ...(overrides || {}) };
  const json = JSON.stringify(merged);
  const now = new Date().toISOString();

  try {
    await prisma.commercial_users.update({
      where: { id: userId },
      data: { feature_overrides: json, updated_at: now },
    });
  } catch (err: unknown) {
    if (isPrismaNotFoundError(err)) return { success: false, error: 'User not found.' };
    throw err;
  }

  await insertPostgresAuditLog(prisma, {
    actor,
    action: 'USER_FEATURE_OVERRIDES_UPDATE',
    targetId: userId,
    details: `Updated enterprise feature overrides for ${current.email}: ${json}`,
    result: 'SUCCESS',
    createdAt: now,
  });

  return { success: true, overrides: merged };
}

/**
 * Admin action: 1-Click HWID & Machine Unbind.
 * Clears all commercial device bindings for the user.
 */
export async function adminResetUserDevices(
  rawUserId: string,
  actor?: { id: string; name: string; role: CommercialRole }
): Promise<{
  success: boolean;
  unbindCount: number;
  error?: string;
  message?: string;
}> {
  const userId = stripCentralUserPrefix(rawUserId);
  const prisma = isPostgresConfigured() ? getPrismaClient() : null;
  if (!prisma) {
    return resetAllUserDevices(userId, actor);
  }

  const deleteRes = await prisma.commercial_devices.deleteMany({
    where: { user_id: userId },
  });
  const unbindCount = deleteRes.count;
  const now = new Date().toISOString();

  if (actor) {
    await insertPostgresAuditLog(prisma, {
      actor,
      action: 'USER_DEVICES_RESET_ALL',
      targetId: userId,
      details: `1-Click HWID unbind executed: removed ${unbindCount} active device bindings for user ${userId}`,
      result: 'SUCCESS',
      createdAt: now,
    });
  }

  return { success: true, unbindCount };
}
