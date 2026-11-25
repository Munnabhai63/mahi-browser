import http from 'node:http';
import { URL } from 'node:url';
import { sendJSON, parseBody, getAuthUser, signAccountStatus } from './router-shared.js';
import { getCentralUserByIdAsync, verifyAccessToken } from '../../../05_AUTH/central-auth-service.js';
import { evaluateUserEntitlements, activateCommercialLicenseForUser } from '../commercial-entitlement-service.js';
import { createDemoRequest } from '../demo-service.js';
import { recordFunnelEvent } from '../funnel-service.js';
import { getUserDevices, revokeCommercialDevice, registerOrUpdateDevice } from '../commercial-device-service.js';
import { getLicenses, evaluateServerStatus } from '../../../04_LICENSING/license-engine.js';
import { getCommercialPlans, getCommercialPlanById } from '../commercial-plan-service.js';
import { getActivePricingVersion, buildPlanCatalog } from '../pricing-admin-service.js';
import { getSoftwareVersions, checkVersionCompatibility } from '../commercial-version-service.js';
import { reconcileUserPlanOnLogin } from '../commercial-reconcile-service.js';
import { resolveCommercialPlan } from '../payment-service.js';
import { isPostgresConfigured } from '../../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../../06_DATABASE/prisma-client.js';
import { getDatabase } from '../../../06_DATABASE/connection.js';

export async function handleClientEntitlementRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if (routePath === '/v1/account/status' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid token required.' });
      return true;
    }
    const hwidParam = (parsedUrl.searchParams.get('hwid') || '').trim();
    const legacyHwidParam = (parsedUrl.searchParams.get('legacyHwid') || parsedUrl.searchParams.get('legacyDeviceId') || '').trim() || undefined;

    // 1. Fetch authoritative central user record (Postgres/SQLite)
    let centralUser: any = null;
    try {
      centralUser = await getCentralUserByIdAsync(auth.userId);
    } catch {}

    const entitlements = evaluateUserEntitlements(auth.userId, hwidParam || undefined, undefined, legacyHwidParam);

    // 2. Resolve Plan
    let rawPlan = centralUser?.planId || entitlements?.plan?.id || entitlements?.planId || 'free';
    if (rawPlan === 'plan_free') rawPlan = 'free';

    // 3. User status check (Banned / Suspended accounts are immediately demoted)
    const isBannedOrSuspended =
      centralUser?.status === 'BANNED' ||
      centralUser?.status === 'SUSPENDED' ||
      entitlements?.user?.status === 'BANNED' ||
      entitlements?.user?.status === 'SUSPENDED';

    const plan = isBannedOrSuspended ? 'free' : rawPlan;
    const targetPlan = resolveCommercialPlan(plan);

    // 4. Resolve Profile Limits & Cloud Sync
    let profile_limit = 15;
    if (isBannedOrSuspended) {
      profile_limit = 0;
    } else if (plan !== 'free') {
      profile_limit = centralUser?.profileQuota || targetPlan?.limits?.maxProfiles || entitlements?.maxProfiles || 100;
    } else {
      profile_limit = entitlements?.maxProfiles || entitlements?.limits?.maxProfiles || 15;
    }

    const sync_allowed = !isBannedOrSuspended && (entitlements?.features?.['cloud.sync'] ?? (plan !== 'free'));

    // 5. Expiration time from entitlement or Postgres license
    let expires_at: string | null = entitlements?.subscription?.expiresAt || null;
    if (isPostgresConfigured()) {
      try {
        const prisma = getPrismaClient();
        if (prisma && (prisma as any).licenses) {
          const activeLic = await (prisma as any).licenses.findFirst({
            where: { account_id: auth.userId, status: 'ACTIVE' },
            orderBy: { created_at: 'desc' },
          });
          if (activeLic?.expires_at) {
            expires_at = activeLic.expires_at instanceof Date
              ? activeLic.expires_at.toISOString()
              : String(activeLic.expires_at);
          }
        }
      } catch {}
    }
    if (expires_at && typeof expires_at !== 'string') {
      expires_at = (expires_at as any) instanceof Date ? (expires_at as any).toISOString() : String(expires_at);
    }

    const server_time = Date.now();
    const canonical = `${auth.userId}:${hwidParam}:${plan}:${profile_limit}:${sync_allowed ? 1 : 0}:${expires_at || ''}:${server_time}`;
    const sig = signAccountStatus(canonical);

    sendJSON(res, 200, {
      success: true,
      account_id: auth.userId,
      hwid: hwidParam,
      plan,
      profile_limit,
      sync_allowed,
      expires_at,
      server_time,
      sig,
    });
    return true;
  }

  if (routePath === '/v1/account/switch-device' && method === 'POST') {
    const body = await parseBody(req);
    const auth = getAuthUser(req);
    const token = body.token || (req.headers['x-mahi-token'] as string);
    const userId = auth?.userId || (token ? verifyAccessToken(token)?.userId : null);
    if (!userId) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized' });
      return true;
    }
    const hwid = body.hwid || '';
    const legacyHwid = body.legacyHwid || body.legacyDeviceId || undefined;
    if (hwid) {
      registerOrUpdateDevice({
        userId,
        deviceId: hwid,
        legacyDeviceId: legacyHwid,
        deviceName: body.deviceName || 'Windows Desktop',
        ipAddress: clientIp,
      });
    }
    sendJSON(res, 200, { success: true, message: 'Device rebound successfully' });
    return true;
  }

  if (routePath === '/api/v1/commercial/demo-request' && method === 'POST') {
    const body = await parseBody(req);
    const result = createDemoRequest(body);
    sendJSON(res, result.success ? 201 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/funnel/track' && method === 'POST') {
    const body = await parseBody(req);
    const result = recordFunnelEvent({
      ...body,
      ipAddress: clientIp,
    });
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if ((pathname === '/api/v1/me/license' || routePath === '/api/v1/me/license') && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }

    const db = getDatabase();
    // Scope strictly to auth.userId — never accept a userId query parameter (prevent IDOR)
    const row = db.prepare(`
      SELECT * FROM licenses 
      WHERE account_id = ? 
      ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC 
      LIMIT 1
    `).get(auth.userId) as any;

    if (!row) {
      sendJSON(res, 404, { success: false, error: 'NO_LICENSE' });
      return true;
    }

    const devicesCount = (db.prepare(
      "SELECT COUNT(*) as count FROM license_devices WHERE license_id = ? AND status = 'ACTIVE'"
    ).get(row.id) as any)?.count || 0;

    const evaluatedStatus = evaluateServerStatus(row.status, row.expires_at, row.revoked_at);
    if (evaluatedStatus !== row.status) {
      try {
        db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run(evaluatedStatus, row.id);
      } catch {}
    }

    // Resolve planId and planName
    let planId = '';
    if (row.notes) {
      const match = row.notes.match(/Plan:\s*([^\s|]+)/i);
      if (match) planId = match[1];
    }
    if (!planId) {
      const subRow = db.prepare('SELECT plan_id FROM commercial_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(auth.userId) as any;
      if (subRow?.plan_id) planId = subRow.plan_id;
      else {
        const u = db.prepare('SELECT plan_id FROM commercial_users WHERE id = ?').get(auth.userId) as any;
        if (u?.plan_id) planId = u.plan_id;
      }
    }
    if (!planId) planId = 'free';

    const plan = getCommercialPlanById(planId);
    const planName = plan ? plan.name : planId;

    sendJSON(res, 200, {
      success: true,
      data: {
        hasLicense: true,
        keyMasked: row.key_masked,
        planId,
        planName,
        status: evaluatedStatus,
        deviceLimit: row.max_devices || 1,
        devicesUsed: devicesCount,
        validUntil: row.expires_at || null,
        createdAt: row.created_at || null,
      },
    });
    return true;
  }

  if (pathname === '/api/v1/entitlements/check' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const deviceId = parsedUrl.searchParams.get('deviceId') || undefined;
    const deviceName = parsedUrl.searchParams.get('deviceName') || undefined;
    const legacyDeviceId = parsedUrl.searchParams.get('legacyDeviceId') || undefined;
    const entitlements = evaluateUserEntitlements(auth.userId, deviceId, deviceName, legacyDeviceId);
    sendJSON(res, 200, { success: true, data: entitlements });
    return true;
  }

  if (pathname === '/api/v1/entitlements/activate-key' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const result = activateCommercialLicenseForUser(auth.userId, body.licenseKey, body.deviceId, body.deviceName);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // -------------------------------------------------------------
  // 3. USER DEVICES (Authenticated)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/devices/my-devices' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const devices = getUserDevices(auth.userId);
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  if (pathname === '/api/v1/devices/revoke' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const ok = revokeCommercialDevice(body.deviceId, { id: auth.userId, name: auth.email, role: auth.role }, auth.userId);
    sendJSON(res, 200, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 4. PLANS & PRICING (Public)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/plans' && method === 'GET') {
    const plans = getCommercialPlans();
    sendJSON(res, 200, { success: true, data: plans });
    return true;
  }

  if ((pathname === '/api/v1/pricing/catalog' || pathname === '/api/v1/plans/catalog') && method === 'GET') {
    try {
      const catalog = buildPlanCatalog();
      sendJSON(res, 200, { success: true, data: catalog });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------
  // 5. SOFTWARE VERSIONS & COMPATIBILITY
  // -------------------------------------------------------------
  if (pathname === '/api/v1/updates/check' && method === 'GET') {
    const clientVersion = parsedUrl.searchParams.get('clientVersion') || '1.0.0';
    const status = checkVersionCompatibility(clientVersion);
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  return false;
}
