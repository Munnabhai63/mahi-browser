import http from 'node:http';
import { URL } from 'node:url';
import {
  registerUser,
  loginUser,
  verifyToken,
  getUserById,
  getAllUsers,
  updateUserStatus,
  updateUserPlan,
} from './commercial-auth-service.js';
import {
  getCommercialPlans,
  getCommercialPlanById,
  createCommercialPlan,
  updateCommercialPlan,
} from './commercial-plan-service.js';
import {
  evaluateUserEntitlements,
  activateCommercialLicenseForUser,
} from './commercial-entitlement-service.js';
import {
  getUserDevices,
  getAllCommercialDevices,
  revokeCommercialDevice,
} from './commercial-device-service.js';
import {
  getCommercialAuditLogs,
  logCommercialAudit,
} from './commercial-audit-service.js';
import {
  getSoftwareVersions,
  publishSoftwareVersion,
  checkVersionCompatibility,
} from './commercial-version-service.js';
import {
  createLicense,
  getLicenses,
  revokeLicense,
  extendLicense,
  getLicenseDevices,
  deactivateDevice,
} from '../../04_LICENSING/license-engine.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { isValidAdminWebSecret } from '../../08_SECURITY/install-secrets.js';
import { CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Admin-Secret',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req: http.IncomingMessage): { userId: string; email: string; role: CommercialRole } | null {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return verifyToken(token);
  }
  return null;
}

function checkAdminAuth(req: http.IncomingMessage, body?: any): { isAdmin: boolean; actor: { id: string; name: string; role: CommercialRole } } {
  // 1. Check JWT role
  const user = getAuthUser(req);
  if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'SUPPORT' || user.role === 'BILLING')) {
    return {
      isAdmin: true,
      actor: { id: user.userId, name: user.email, role: user.role },
    };
  }

  // 2. Check X-Admin-Secret header or body secret
  const headerSecret = req.headers['x-admin-secret'] as string;
  const secret = headerSecret || (body && body.adminSecret) || '';
  if (secret && (verifyAdminAccess(secret) || isValidAdminWebSecret(secret))) {
    return {
      isAdmin: true,
      actor: { id: 'admin', name: 'Master Administrator', role: 'SUPER_ADMIN' },
    };
  }

  return {
    isAdmin: false,
    actor: { id: 'unknown', name: 'Unauthorized', role: 'USER' },
  };
}

export async function handleCommercialApiRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // Only handle /api/v1/ routes
  if (!pathname.startsWith('/api/v1/')) {
    return false;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  // -------------------------------------------------------------
  // 1. PUBLIC AUTHENTICATION & REGISTRATION
  // -------------------------------------------------------------
  if (pathname === '/api/v1/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    const result = registerUser(body, clientIp);
    sendJSON(res, result.success ? 201 : 400, result);
    return true;
  }

  if (pathname === '/api/v1/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const result = loginUser(body, clientIp);
    if (!result.success || !result.user) {
      sendJSON(res, 401, result);
      return true;
    }
    const entitlements = evaluateUserEntitlements(result.user.id, body.deviceId, body.deviceName);
    sendJSON(res, 200, {
      success: true,
      token: result.token,
      user: result.user,
      entitlements,
    });
    return true;
  }

  // -------------------------------------------------------------
  // 2. USER PROFILE & ENTITLEMENTS (Authenticated)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/auth/me' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid Bearer token required.' });
      return true;
    }
    const user = getUserById(auth.userId);
    if (!user) {
      sendJSON(res, 404, { success: false, error: 'User not found.' });
      return true;
    }
    const entitlements = evaluateUserEntitlements(user.id);
    sendJSON(res, 200, { success: true, user, entitlements });
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
    const entitlements = evaluateUserEntitlements(auth.userId, deviceId, deviceName);
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

  // -------------------------------------------------------------
  // 5. SOFTWARE VERSIONS & COMPATIBILITY
  // -------------------------------------------------------------
  if (pathname === '/api/v1/updates/check' && method === 'GET') {
    const clientVersion = parsedUrl.searchParams.get('clientVersion') || '1.0.0';
    const status = checkVersionCompatibility(clientVersion);
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  // -------------------------------------------------------------
  // 6. ADMIN DASHBOARD & FLEET METRICS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/dashboard' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }

    const { users, total: totalUsers } = getAllUsers({ limit: 1000 });
    const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
    const suspendedUsers = users.filter((u) => u.status === 'SUSPENDED').length;
    const bannedUsers = users.filter((u) => u.status === 'BANNED').length;

    const licenses = getLicenses();
    const activeLicenses = licenses.filter((l) => l.status === 'ACTIVE').length;
    const expiredLicenses = licenses.filter((l) => l.status === 'EXPIRED').length;

    const devices = getAllCommercialDevices();
    const activeDevices = devices.filter((d) => d.status === 'ACTIVE').length;

    const plans = getCommercialPlans(true);
    const { logs: recentAuditLogs } = getCommercialAuditLogs({ limit: 10 });

    const stats = {
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      activeLicenses,
      expiredLicenses,
      activeDevices,
      activeSubscriptions: activeUsers,
      totalPlans: plans.length,
      revenueEstMonthly: activeLicenses * 29,
      recentAuditLogs,
    };

    sendJSON(res, 200, { success: true, data: stats });
    return true;
  }

  // -------------------------------------------------------------
  // 7. ADMIN USER MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/users' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const result = getAllUsers({ status, role, searchQuery: search, limit, offset });
    sendJSON(res, 200, { success: true, data: result.users, total: result.total });
    return true;
  }

  const userStatusMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/status$/);
  if (userStatusMatch && method === 'PUT') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userStatusMatch[1];
    const body = await parseBody(req);
    const ok = updateUserStatus(userId, body.status, actor, body.reason);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  const userPlanMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/plan$/);
  if (userPlanMatch && method === 'PUT') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userPlanMatch[1];
    const body = await parseBody(req);
    const ok = updateUserPlan(userId, body.planId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 8. ADMIN PLANS MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/plans' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getCommercialPlans(true) });
    return true;
  }

  if (pathname === '/api/v1/admin/plans' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const newPlan = createCommercialPlan(body, actor);
    sendJSON(res, 201, { success: true, data: newPlan });
    return true;
  }

  const planIdMatch = pathname.match(/^\/api\/v1\/admin\/plans\/([a-zA-Z0-9_-]+)$/);
  if (planIdMatch && method === 'PUT') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const planId = planIdMatch[1];
    const updated = updateCommercialPlan(planId, body, actor);
    sendJSON(res, updated ? 200 : 404, { success: Boolean(updated), data: updated });
    return true;
  }

  // -------------------------------------------------------------
  // 9. ADMIN LICENSE MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/licenses' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const licenses = getLicenses({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: licenses });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 403, {
      success: false,
      error: 'License minting inside the app is disabled. Use external keygen at ../mahi-keygen/keygen.cjs',
    });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses/revoke' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const ok = revokeLicense(body.licenseId, body.reason);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses/extend' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const record = extendLicense(body);
    sendJSON(res, record ? 200 : 404, { success: Boolean(record), data: record });
    return true;
  }

  // -------------------------------------------------------------
  // 10. ADMIN DEVICE FLEET MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/devices' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const devices = getAllCommercialDevices({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  const deviceRevokeMatch = pathname.match(/^\/api\/v1\/admin\/devices\/([a-zA-Z0-9_-]+)$/);
  if (deviceRevokeMatch && method === 'DELETE') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const deviceId = deviceRevokeMatch[1];
    const ok = revokeCommercialDevice(deviceId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 11. ADMIN AUDIT LOGS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const action = parsedUrl.searchParams.get('action') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const resultStatus = parsedUrl.searchParams.get('result') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const logs = getCommercialAuditLogs({
      action,
      actorRole: role,
      result: resultStatus,
      searchQuery: search,
      limit,
      offset,
    });
    sendJSON(res, 200, { success: true, data: logs.logs, total: logs.total });
    return true;
  }

  // -------------------------------------------------------------
  // 12. ADMIN SOFTWARE VERSIONS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/versions' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getSoftwareVersions() });
    return true;
  }

  if (pathname === '/api/v1/admin/versions' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const version = publishSoftwareVersion(body, actor);
    sendJSON(res, 201, { success: true, data: version });
    return true;
  }

  sendJSON(res, 404, { success: false, error: `Endpoint ${method} ${pathname} not found.` });
  return true;
}
