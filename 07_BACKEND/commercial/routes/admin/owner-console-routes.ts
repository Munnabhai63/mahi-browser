import crypto from 'node:crypto';
import { sendJSON, parseBody } from '../router-shared.js';
import { validateStrictBody } from '../../../utils/app-error.js';
import {
  OwnerVerifySchema,
  OwnerGrantSchema,
  OwnerPlanMutationSchema,
  OwnerUserMutationSchema,
  OwnerKillSwitchSchema,
} from '../../validation/commercial-schemas.js';
import { calculateExpiryDate, generateLicenseKey, revokeLicense } from '../../../../04_LICENSING/license-engine.js';
import { LicenseDurationType } from '../../../../10_CONFIG/shared/types/license.js';
import {
  isOwnerConfigured,
  verifyOwnerTotp,
  createOwnerSessionAsync,
  revokeOwnerSessionAsync,
  checkOwnerVerifyRateLimitAsync,
  recordFailedOwnerVerifyAttemptAsync,
  recordSuccessfulOwnerVerifyAttemptAsync,
} from '../../../services/owner-totp-service.js';
import {
  getEmergencyKillSwitchStateAsync,
  setEmergencyKillSwitchAsync,
  rejectIfEmergencyFrozen,
} from '../../../services/kill-switch-service.js';
import { getDatabase } from '../../../../06_DATABASE/connection.js';
import { isPostgresConfigured } from '../../../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../../../06_DATABASE/prisma-client.js';
import { resolveCommercialPlan } from '../../payment-service.js';
import {
  AdminRouteContext,
  requireAdminAccess,
  getOwnerSessionCookie,
  requireOwnerSession,
  recordOwnerActionAudit,
  resolveOwnerTargetOrRespond,
  resolveTrustedClientIp,
} from './admin-shared.js';

async function syncCommercialUserPlanPg(
  prisma: any,
  targetUser: any,
  userId: string,
  planId: string,
  now: string,
  label: string
): Promise<void> {
  try {
    if (typeof prisma.commercial_users?.findFirst !== 'function') return;
    const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
    if (commUser) {
      await prisma.commercial_users.update({
        where: { id: userId },
        data: { plan_id: planId, updated_at: now },
      });
    } else {
      await prisma.commercial_users.create({
        data: {
          id: userId,
          email: targetUser.email,
          password_hash: targetUser.passwordHash || 'OAUTH_MIRROR',
          salt: targetUser.salt || 'OAUTH_MIRROR',
          name: targetUser.name || targetUser.email.split('@')[0],
          role: targetUser.role || 'USER',
          status: targetUser.status || 'ACTIVE',
          plan_id: planId,
          created_at: now,
          updated_at: now,
          last_login_at: now,
        },
      });
    }
  } catch (err: any) {
    console.warn(`[OwnerService] commercial_users ${label} skipped/warn:`, err?.message);
  }
}

/** Handles TOTP-gated Owner console routes including kill switch, grants, plans, and bans. */
export async function handleOwnerConsoleRoutes(ctx: AdminRouteContext): Promise<boolean> {
  const { req, res, pathname, method } = ctx;
  if (!pathname.startsWith('/api/v1/admin/owner/')) return false;

  if (
    (pathname === '/api/v1/admin/owner/verify' || pathname === '/api/v1/admin/owner/verify-totp') &&
    method === 'POST'
  ) {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerVerifySchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!isOwnerConfigured()) {
      sendJSON(res, 503, { success: false, error: 'Owner console not configured.' });
      return true;
    }
    const clientIp = resolveTrustedClientIp(req);
    if (!(await checkOwnerVerifyRateLimitAsync(clientIp))) {
      sendJSON(res, 429, { success: false, error: 'Too many failed verification attempts. Please try again later.' });
      return true;
    }
    const code = body?.code !== undefined && body?.code !== null ? String(body.code).trim() : '';
    if (!code || !verifyOwnerTotp(code)) {
      await recordFailedOwnerVerifyAttemptAsync(clientIp);
      sendJSON(res, 401, { success: false, error: 'Invalid or expired code' });
      return true;
    }

    await recordSuccessfulOwnerVerifyAttemptAsync(clientIp);
    const sessionToken = await createOwnerSessionAsync();
    res.setHeader('Set-Cookie', `owner_session=${sessionToken}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=1800`);
    sendJSON(res, 200, { success: true });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/logout' && method === 'POST') {
    const adminGate = await requireAdminAccess(req, res, undefined, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const cookieToken = getOwnerSessionCookie(req);
    if (cookieToken) {
      await revokeOwnerSessionAsync(cookieToken);
    }
    res.setHeader('Set-Cookie', 'owner_session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0');
    res.writeHead(204);
    res.end();
    return true;
  }

  if (pathname === '/api/v1/admin/owner/kill-switch' && method === 'GET') {
    const adminGate = await requireAdminAccess(req, res, undefined, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    if (!(await requireOwnerSession(req, res))) return true;
    const state = await getEmergencyKillSwitchStateAsync();
    sendJSON(res, 200, { success: true, ...state });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/kill-switch' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerKillSwitchSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!(await requireOwnerSession(req, res))) return true;

    const state = await setEmergencyKillSwitchAsync({
      enabled: body.enabled,
      reason: body.reason,
      updatedBy: adminGate.actor.id || adminGate.actor.name || 'OWNER',
    });

    await recordOwnerActionAudit({
      action: body.enabled ? 'OWNER_KILL_SWITCH_ENABLED' : 'OWNER_KILL_SWITCH_DISABLED',
      targetType: 'SYSTEM',
      targetId: 'emergency_kill_switch',
      details: {
        enabled: state.enabled,
        dbEnabled: state.dbEnabled,
        envOverride: state.envOverride,
        reason: body.reason,
        ip: ctx.clientIp,
      },
      ip: ctx.clientIp,
    });

    sendJSON(res, 200, { success: true, ...state });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/grant' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerGrantSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!(await requireOwnerSession(req, res))) return true;
    if (await rejectIfEmergencyFrozen(res, 'owner_license_grant')) return true;

    const clientIp = resolveTrustedClientIp(req);
    const resolved = await resolveOwnerTargetOrRespond(res, body?.userId, 'grant');
    if (!resolved.ok) return true;
    const { user: targetUser, userId } = resolved;

    const targetPlan = resolveCommercialPlan(body?.planId ? String(body.planId).trim() : '');
    if (!targetPlan) {
      sendJSON(res, 400, { success: false, error: 'PLAN_NOT_FOUND' });
      return true;
    }

    const durationType = (body?.durationType || '30_DAYS') as LicenseDurationType;
    const now = new Date().toISOString();
    const expiresAt = calculateExpiryDate(durationType, now, body?.customExpiresAt);
    const maxDevices = targetPlan.limits?.maxDevices && targetPlan.limits.maxDevices > 0 ? targetPlan.limits.maxDevices : 1;
    const customerName = (targetUser.name || targetUser.email || userId).trim();
    const notes = `Admin-granted | Plan: ${targetPlan.id}${body?.reason ? ' | Reason: ' + body.reason : ''}`;
    const { rawKey, keyHash, keyMasked } = generateLicenseKey();
    const licenseId = crypto.randomUUID();
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && ['licenses', 'auth_users'].every((m) => !!(prisma as any)[m]);
    let planSyncFailed = false;

    if (prisma && pgReady) {
      try {
        await prisma.licenses.create({
          data: {
            id: licenseId,
            license_key_hash: keyHash,
            key_masked: keyMasked,
            customer_name: customerName,
            account_id: userId,
            status: 'ACTIVE',
            duration_type: durationType,
            max_devices: maxDevices,
            starts_at: now,
            expires_at: expiresAt,
            created_at: now,
            created_by: 'OWNER',
            revoked_at: null,
            last_validation_at: null,
            notes,
          },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] Postgres license create failed:', err?.message || err);
        sendJSON(res, 500, { success: false, error: 'Failed to create license in database' });
        return true;
      }

      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: { plan_id: targetPlan.id, profile_quota: targetPlan.limits?.maxProfiles, updated_at: now },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG plan sync error', err?.message);
        planSyncFailed = true;
      }

      await syncCommercialUserPlanPg(prisma, targetUser, userId, targetPlan.id, now, 'plan sync');

      try {
        if (typeof (prisma as any).commercial_subscriptions?.create === 'function') {
          await (prisma as any).commercial_subscriptions.create({
            data: {
              id: `sub_${crypto.randomUUID()}`,
              user_id: userId,
              plan_id: targetPlan.id,
              license_id: licenseId,
              status: 'ACTIVE',
              billing_cycle: durationType === '1_YEAR' ? 'ANNUAL' : 'MONTHLY',
              starts_at: now,
              expires_at: expiresAt,
              payment_provider: 'OWNER_GRANT',
              created_at: now,
            },
          });
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_subscriptions grant sync skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare(`
          INSERT INTO licenses (
            id, license_key_hash, key_masked, customer_name, account_id,
            status, duration_type, max_devices, starts_at, expires_at,
            created_at, created_by, revoked_at, last_validation_at, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          licenseId, keyHash, keyMasked, customerName, userId,
          'ACTIVE', durationType, maxDevices, now, expiresAt,
          now, 'OWNER', null, null, notes
        );

        try {
          if (db.prepare('SELECT id FROM auth_users WHERE id = ?').get(userId)) {
            db.prepare('UPDATE auth_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(targetPlan.id, now, userId);
          }
          db.prepare('UPDATE commercial_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(targetPlan.id, now, userId);
        } catch (e: any) {
          console.error('[OwnerService][CRITICAL] SQLite plan sync error', e?.message);
          planSyncFailed = true;
        }

        try {
          db.prepare(`
            INSERT INTO commercial_subscriptions (
              id, user_id, plan_id, license_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
            ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 'OWNER_GRANT', ?)
          `).run(`sub_${crypto.randomUUID()}`, userId, targetPlan.id, licenseId, durationType === '1_YEAR' ? 'ANNUAL' : 'MONTHLY', now, expiresAt, now);
        } catch (e: any) {
          console.warn('[OwnerService] SQLite subscription grant sync warn:', e?.message);
        }
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite license create failed:', err?.message || err);
        sendJSON(res, 500, { success: false, error: 'Failed to create license' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_GRANT_PREMIUM',
      targetType: 'LICENSE',
      targetId: licenseId,
      details: { target: userId, planId: targetPlan.id, licenseId, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, licenseId, keyMasked, rawKey, planSyncFailed });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/remove' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!(await requireOwnerSession(req, res))) return true;

    const clientIp = resolveTrustedClientIp(req);
    const resolved = await resolveOwnerTargetOrRespond(res, body?.userId, 'remove');
    if (!resolved.ok) return true;
    const { userId } = resolved;

    const reason = body?.reason || 'Revoked by owner';
    let revokedCount = 0;

    try {
      if (body?.licenseId) {
        if (await revokeLicense(String(body.licenseId).trim(), reason)) revokedCount++;
      } else {
        const prisma = isPostgresConfigured() ? getPrismaClient() : null;
        const pgReady = prisma && !!(prisma as any).licenses;
        const userLicenses = prisma && pgReady
          ? await prisma.licenses.findMany({
              where: { account_id: userId, status: { in: ['ACTIVE', 'NOT_ACTIVATED', 'EXPIRED'] } },
              select: { id: true },
            })
          : (getDatabase()
              .prepare("SELECT id FROM licenses WHERE account_id = ? AND status IN ('ACTIVE', 'NOT_ACTIVATED', 'EXPIRED')")
              .all(userId) as any[]);
        for (const lic of userLicenses) {
          if (await revokeLicense(lic.id, reason)) revokedCount++;
        }
      }
    } catch (err: any) {
      console.error('[OwnerService][CRITICAL] License revoke error during remove:', err?.message || err);
      sendJSON(res, 500, { success: false, error: 'Failed to revoke licenses' });
      return true;
    }

    const now = new Date().toISOString();
    let planSyncFailed = false;
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({ where: { id: userId }, data: { plan_id: 'plan_free', updated_at: now } });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG plan reset error', err?.message);
        planSyncFailed = true;
      }
      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({ where: { id: userId }, data: { plan_id: 'plan_free', updated_at: now } });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users plan reset skipped/warn:', err?.message);
      }
    } else {
      try {
        getDatabase().prepare('UPDATE auth_users SET plan_id = ?, updated_at = ? WHERE id = ?').run('plan_free', now, userId);
      } catch {
        planSyncFailed = true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_REMOVE_PREMIUM',
      targetType: body?.licenseId ? 'LICENSE' : 'USER',
      targetId: body?.licenseId ? String(body.licenseId) : userId,
      details: { target: userId, licenseId: body?.licenseId, revokedCount, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, revokedCount, planSyncFailed });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/set-plan' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerPlanMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!(await requireOwnerSession(req, res))) return true;

    const clientIp = resolveTrustedClientIp(req);
    const resolved = await resolveOwnerTargetOrRespond(res, body?.userId, 'set-plan');
    if (!resolved.ok) return true;
    const { user: targetUser, userId } = resolved;

    const targetPlan = resolveCommercialPlan(body?.planId ? String(body.planId).trim() : '');
    if (!targetPlan) {
      sendJSON(res, 400, { success: false, error: 'PLAN_NOT_FOUND' });
      return true;
    }

    const fromPlan = targetUser.plan_id || 'unknown';
    const now = new Date().toISOString();
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;
    const isPaidPlan = targetPlan.id !== 'plan_free' && targetPlan.id !== 'free';

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({
          where: { id: userId },
          data: { plan_id: targetPlan.id, profile_quota: targetPlan.limits?.maxProfiles, updated_at: now },
        });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG set-plan error', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update plan in database' });
        return true;
      }

      await syncCommercialUserPlanPg(prisma, targetUser, userId, targetPlan.id, now, 'set-plan');

      try {
        if (isPaidPlan && typeof (prisma as any).commercial_subscriptions?.create === 'function') {
          const expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await (prisma as any).commercial_subscriptions.create({
            data: {
              id: `sub_${crypto.randomUUID()}`,
              user_id: userId,
              plan_id: targetPlan.id,
              status: 'ACTIVE',
              billing_cycle: 'MONTHLY',
              starts_at: now,
              expires_at: expDate,
              payment_provider: 'OWNER_SET_PLAN',
              created_at: now,
            },
          });
        } else if (!isPaidPlan && typeof (prisma as any).commercial_subscriptions?.updateMany === 'function') {
          await (prisma as any).commercial_subscriptions.updateMany({
            where: { user_id: userId, status: 'ACTIVE' },
            data: { status: 'CANCELLED' },
          });
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_subscriptions set-plan sync skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(targetPlan.id, now, userId);
        try {
          db.prepare('UPDATE commercial_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(targetPlan.id, now, userId);
          if (isPaidPlan) {
            const expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            db.prepare(`
              INSERT INTO commercial_subscriptions (
                id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
              ) VALUES (?, ?, ?, 'ACTIVE', 'MONTHLY', ?, ?, 'OWNER_SET_PLAN', ?)
            `).run(`sub_${crypto.randomUUID()}`, userId, targetPlan.id, now, expDate, now);
          } else {
            db.prepare("UPDATE commercial_subscriptions SET status = 'CANCELLED' WHERE user_id = ? AND status = 'ACTIVE'").run(userId);
          }
        } catch {}
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite set-plan error', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update plan' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_PLAN_CHANGED',
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, from: fromPlan, to: targetPlan.id, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, from: fromPlan, to: targetPlan.id });
    return true;
  }

  if ((pathname === '/api/v1/admin/owner/suspend' || pathname === '/api/v1/admin/owner/resume') && method === 'POST') {
    const isSuspend = pathname.endsWith('/suspend');
    const newStatus = isSuspend ? 'SUSPENDED' : 'ACTIVE';
    const auditAction = isSuspend ? 'OWNER_USER_SUSPENDED' : 'OWNER_USER_RESUMED';

    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!(await requireOwnerSession(req, res))) return true;

    const clientIp = resolveTrustedClientIp(req);
    const resolved = await resolveOwnerTargetOrRespond(res, body?.userId, 'status change');
    if (!resolved.ok) return true;
    const { userId } = resolved;

    const now = new Date().toISOString();
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({ where: { id: userId }, data: { status: newStatus, updated_at: now } });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG status update failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update user status in database' });
        return true;
      }
      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({ where: { id: userId }, data: { status: newStatus, updated_at: now } });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users status update skipped/warn:', err?.message);
      }
      if (isSuspend) {
        try {
          const userLicenses = await prisma.licenses.findMany({ where: { account_id: userId }, select: { id: true } });
          const licIds = userLicenses.map((l: any) => l.id);
          if (licIds.length > 0 && typeof (prisma as any).license_devices?.updateMany === 'function') {
            await prisma.license_devices.updateMany({
              where: { license_id: { in: licIds }, status: 'ACTIVE' },
              data: { status: 'DEACTIVATED' },
            });
          }
        } catch (err: any) {
          console.warn('[OwnerService] license_devices deactivation skipped/warn:', err?.message);
        }
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, userId);
        try {
          db.prepare('UPDATE commercial_users SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, userId);
        } catch {}
        if (isSuspend) {
          try {
            db.prepare(`
              UPDATE license_devices SET status = 'DEACTIVATED'
              WHERE status = 'ACTIVE' AND license_id IN (SELECT id FROM licenses WHERE account_id = ?)
            `).run(userId);
          } catch {}
        }
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite status update failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to update user status' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: auditAction,
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, status: newStatus, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, status: newStatus });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/ban' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!(await requireOwnerSession(req, res))) return true;

    const clientIp = resolveTrustedClientIp(req);
    const resolved = await resolveOwnerTargetOrRespond(res, body?.userId, 'ban');
    if (!resolved.ok) return true;
    const { userId } = resolved;

    const now = new Date().toISOString();
    const reason = body?.reason || 'User banned by owner';
    let revokedCount = 0;
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({ where: { id: userId }, data: { status: 'BANNED', updated_at: now } });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG ban status update failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to ban user in database' });
        return true;
      }
      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({ where: { id: userId }, data: { status: 'BANNED', updated_at: now } });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users ban status update skipped/warn:', err?.message);
      }
      try {
        const userLicenses = await prisma.licenses.findMany({
          where: { account_id: userId, status: { in: ['ACTIVE', 'NOT_ACTIVATED', 'EXPIRED'] } },
          select: { id: true },
        });
        for (const lic of userLicenses) {
          if (await revokeLicense(lic.id, reason)) revokedCount++;
        }
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] Mass license revoke failed on ban:', err?.message);
      }
      try {
        const allUserLicenses = await prisma.licenses.findMany({ where: { account_id: userId }, select: { id: true } });
        const licIds = allUserLicenses.map((l: any) => l.id);
        if (licIds.length > 0 && typeof (prisma as any).license_devices?.updateMany === 'function') {
          await prisma.license_devices.updateMany({
            where: { license_id: { in: licIds }, status: 'ACTIVE' },
            data: { status: 'DEACTIVATED' },
          });
        }
      } catch (err: any) {
        console.warn('[OwnerService] license_devices deactivation skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?').run('BANNED', now, userId);
        try {
          db.prepare('UPDATE commercial_users SET status = ?, updated_at = ? WHERE id = ?').run('BANNED', now, userId);
        } catch {}
        const userLicenses = db.prepare(
          "SELECT id FROM licenses WHERE account_id = ? AND status IN ('ACTIVE', 'NOT_ACTIVATED', 'EXPIRED')"
        ).all(userId) as any[];
        for (const lic of userLicenses) {
          if (await revokeLicense(lic.id, reason)) revokedCount++;
        }
        try {
          db.prepare(`
            UPDATE license_devices SET status = 'DEACTIVATED'
            WHERE status = 'ACTIVE' AND license_id IN (SELECT id FROM licenses WHERE account_id = ?)
          `).run(userId);
        } catch {}
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite ban failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to ban user' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_USER_BANNED',
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, status: 'BANNED', revokedCount, reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, { success: true, status: 'BANNED', revokedCount });
    return true;
  }

  if (pathname === '/api/v1/admin/owner/unban' && method === 'POST') {
    const rawBody = await parseBody(req);
    const adminGate = await requireAdminAccess(req, res, rawBody, { hideUnauthenticated: true });
    if (!adminGate.ok) return true;
    const parsed = validateStrictBody(OwnerUserMutationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    if (!(await requireOwnerSession(req, res))) return true;

    const clientIp = resolveTrustedClientIp(req);
    const resolved = await resolveOwnerTargetOrRespond(res, body?.userId, 'unban');
    if (!resolved.ok) return true;
    const { userId } = resolved;

    const now = new Date().toISOString();
    const prisma = isPostgresConfigured() ? getPrismaClient() : null;
    const pgReady = prisma && !!(prisma as any).auth_users;

    if (prisma && pgReady) {
      try {
        await prisma.auth_users.update({ where: { id: userId }, data: { status: 'ACTIVE', updated_at: now } });
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] PG unban failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to unban user in database' });
        return true;
      }
      try {
        if (typeof (prisma as any).commercial_users?.findFirst === 'function') {
          const commUser = await prisma.commercial_users.findFirst({ where: { id: userId } });
          if (commUser) {
            await prisma.commercial_users.update({ where: { id: userId }, data: { status: 'ACTIVE', updated_at: now } });
          }
        }
      } catch (err: any) {
        console.warn('[OwnerService] commercial_users unban status update skipped/warn:', err?.message);
      }
    } else {
      try {
        const db = getDatabase();
        db.prepare('UPDATE auth_users SET status = ?, updated_at = ? WHERE id = ?').run('ACTIVE', now, userId);
        try {
          db.prepare('UPDATE commercial_users SET status = ?, updated_at = ? WHERE id = ?').run('ACTIVE', now, userId);
        } catch {}
      } catch (err: any) {
        console.error('[OwnerService][CRITICAL] SQLite unban failed:', err?.message);
        sendJSON(res, 500, { success: false, error: 'Failed to unban user' });
        return true;
      }
    }

    await recordOwnerActionAudit({
      action: 'OWNER_USER_UNBANNED',
      targetType: 'USER',
      targetId: userId,
      details: { target: userId, status: 'ACTIVE', reason: body?.reason, ip: clientIp },
      ip: clientIp,
    });

    sendJSON(res, 200, {
      success: true,
      status: 'ACTIVE',
      note: 'Account unbanned. Existing licenses remain revoked; re-grant is required if access is desired.',
    });
    return true;
  }

  return false;
}
