import type http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { ExtendLicenseDTO } from '../../../10_CONFIG/shared/types/license.js';
import { getProfileStoragePath } from '../../../02_BROWSER/services/profile-service.js';
import {
  getLicenses,
  activateLicense,
  validateCurrentLicense,
  revokeLicense,
  extendLicense,
  getLicenseDevices,
  deactivateDevice,
} from '../../../04_LICENSING/license-engine.js';
import { verifyAdminAccess } from '../../../05_AUTH/admin-auth.js';
import { getWebAdminHtml } from '../../server/web-admin-html.js';
import { getSuperAdminHtml } from '../../server/super-admin-html.js';
import { getDownloadPortalHtml } from '../../server/download-portal-html.js';
import { loadAdminAssetAsync } from '../../server/admin-assets-loader.js';
import { getDistributionInfo } from '../../../03_HARDWARE/distribution-service.js';
import { getFeatureFlags, updateFeatureFlag } from '../../services/feature-flag-service.js';
import { getFleetDevices, getLiveTelemetry, revokeDevice } from '../../services/fleet-service.js';
import { getApiKeys, getApiKeyById, generateApiKey, revokeApiKey } from '../../services/api-v2-service.js';
import { getActivityLogs } from '../../services/audit-service.js';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { isValidAdminWebSecret, getApiAuthToken } from '../../../08_SECURITY/install-secrets.js';
import { verifyLicense } from '../../../08_SECURITY/license-service.js';
import {
  log,
  type AuthBodyLike,
  getLocalApiOwnerId,
  isLocalSuperAdminEnabled,
  getClientIp,
  checkSuperAdminRateLimit,
  recordFailedSuperAdminAttempt,
  recordSuccessfulSuperAdminAttempt,
  getCorsHeaders,
  requireUserOrAdminAuth,
  requireMasterAdminAuth,
  verifyDownloadAccess,
  sendHTML,
  sendJSON,
  sendFile,
  parseBody,
  toErrMsg,
} from './local-api-auth.js';

export async function handleApiKeysV2Route(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  if (pathname === '/api/v2/api-keys' && method === 'GET') {
    const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'api_keys:read');
    if (!auth) return true;
    const requestedOwner = parsedUrl.searchParams.get('userId')?.trim();
    const targetOwner =
      auth.role === 'master_admin' ? requestedOwner || undefined : auth.userId || getLocalApiOwnerId();
    sendJSON(res, 200, { success: true, data: getApiKeys(targetOwner) });
    return true;
  }

  if (pathname === '/api/v2/api-keys' && method === 'POST') {
    const body = await parseBody<{ userId?: string; scopes?: unknown; name?: string } & AuthBodyLike>(req);
    const auth = requireUserOrAdminAuth(req, res, parsedUrl, body, 'api_keys:write');
    if (!auth) return true;

    const requestedUserId = typeof body?.userId === 'string' && body.userId.trim() ? body.userId.trim() : '';
    const authenticatedUserId = auth.userId || getLocalApiOwnerId();
    if (auth.role !== 'master_admin' && requestedUserId && requestedUserId !== authenticatedUserId) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Cannot create API keys for another user.' });
      return true;
    }
    const targetUserId = auth.role === 'master_admin' && requestedUserId ? requestedUserId : authenticatedUserId;

    const defaultScopes = ['profiles:read', 'profiles:write', 'profiles:launch'];
    let targetScopes = defaultScopes;
    if (body?.scopes !== undefined) {
      if (
        !Array.isArray(body.scopes) ||
        body.scopes.length === 0 ||
        !body.scopes.every((s: unknown) => typeof s === 'string' && s.trim().length > 0)
      ) {
        sendJSON(res, 400, { success: false, error: 'Invalid scopes array.' });
        return true;
      }
      targetScopes = body.scopes.map((s: string) => s.trim());
    }

    if (auth.role !== 'master_admin' && !(auth.scopes || []).includes('*')) {
      const callerScopes = new Set(auth.scopes || []);
      const disallowed = targetScopes.filter((s) => s === '*' || !callerScopes.has(s));
      if (disallowed.length > 0) {
        sendJSON(res, 403, {
          success: false,
          error: `Forbidden. Cannot grant unauthorized scopes: ${disallowed.join(', ')}`,
        });
        return true;
      }
    }

    const keyName = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'API-Key';
    const result = generateApiKey(keyName, targetUserId, targetScopes);
    sendJSON(res, 201, { success: true, data: result });
    return true;
  }

  const apiKeyMatch = pathname.match(/^\/api\/v2\/api-keys\/([a-zA-Z0-9_-]+)$/);
  if (apiKeyMatch && method === 'DELETE') {
    const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'api_keys:write');
    if (!auth) return true;
    const keyId = apiKeyMatch[1];
    const existing = getApiKeyById(keyId);
    if (!existing) {
      sendJSON(res, 404, { success: false, error: 'API key not found.' });
      return true;
    }
    const authenticatedUserId = auth.userId || getLocalApiOwnerId();
    if (auth.role !== 'master_admin' && existing.userId !== authenticatedUserId) {
      sendJSON(res, 403, { success: false, error: "Forbidden. Cannot revoke another user's API key." });
      return true;
    }
    const ok = revokeApiKey(keyId, auth.role === 'master_admin' ? undefined : authenticatedUserId);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  return false;
}

export async function handleV2AndPortalRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  cleanPath: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // Super Admin dynamic secret verification endpoint
  if (pathname === '/api/v2/super-admin/auth/verify' && method === 'POST') {
    const clientIp = getClientIp(req);
    if (!checkSuperAdminRateLimit(clientIp)) {
      sendJSON(res, 429, {
        success: false,
        error: 'Too many failed authentication attempts. Please try again later.',
      });
      return true;
    }
    const body = await parseBody<{ secret?: string; pin?: string }>(req);
    const secret = body.secret || body.pin || '';
    if (verifyAdminAccess(secret) || isValidAdminWebSecret(secret)) {
      recordSuccessfulSuperAdminAttempt(clientIp);
      sendJSON(res, 200, { success: true, token: getApiAuthToken() });
    } else {
      recordFailedSuperAdminAttempt(clientIp);
      sendJSON(res, 401, { success: false, error: 'Invalid master secret' });
    }
    return true;
  }

  // 0. Externalized Admin & Download Portal static CSS/JS assets (strict script-src 'self')
  if (cleanPath.startsWith('/admin-assets/') && method === 'GET') {
    const assetName = cleanPath.substring('/admin-assets/'.length);
    const asset = await loadAdminAssetAsync(assetName);
    if (asset) {
      res.writeHead(200, {
        'Content-Type': asset.contentType,
        'Content-Length': asset.content.byteLength,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=300',
        ...getCorsHeaders(req),
      });
      res.end(asset.content);
      return true;
    }
  }

  // 0. Secret Super Admin & Web Admin HTML Portals (Open directly in any browser)
  if (
    (cleanPath === '/super-admin' || cleanPath === '/root-admin' || cleanPath === '/master-admin') &&
    method === 'GET'
  ) {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
      return true;
    }
    sendHTML(res, 200, getSuperAdminHtml());
    return true;
  }

  if (
    (cleanPath === '' ||
      cleanPath === '/' ||
      cleanPath === '/admin' ||
      cleanPath === '/web' ||
      cleanPath === '/dashboard') &&
    method === 'GET'
  ) {
    sendHTML(res, 200, getWebAdminHtml());
    return true;
  }

  // 0. Client Download & Installation Portal (Open to customers)
  if (
    (cleanPath === '/download' ||
      cleanPath === '/install' ||
      cleanPath === '/client' ||
      cleanPath === '/setup' ||
      cleanPath === '/get' ||
      cleanPath === '/app') &&
    method === 'GET'
  ) {
    const info = getDistributionInfo();
    sendHTML(res, 200, getDownloadPortalHtml(info));
    return true;
  }

  // 0. Direct File Downloads: Setup and Portable executables (Authenticated + active entitlement required)
  if (cleanPath === '/download/setup' || cleanPath === '/api/v2/download/setup') {
    const dlAuth = await verifyDownloadAccess(req, parsedUrl);
    if (!dlAuth.authorized) {
      sendJSON(res, dlAuth.status, { success: false, error: dlAuth.reason || 'Unauthorized.' });
      return true;
    }
    const info = getDistributionInfo();
    await sendFile(res, info.setupPath, info.setupFileName);
    return true;
  }

  if (cleanPath === '/download/portable' || cleanPath === '/api/v2/download/portable') {
    const dlAuth = await verifyDownloadAccess(req, parsedUrl);
    if (!dlAuth.authorized) {
      sendJSON(res, dlAuth.status, { success: false, error: dlAuth.reason || 'Unauthorized.' });
      return true;
    }
    const info = getDistributionInfo();
    await sendFile(res, info.portablePath, info.portableFileName);
    return true;
  }

  // 0. Distribution Metadata API
  if (pathname === '/api/v2/distribution/info' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getDistributionInfo() });
    return true;
  }

  // Health check endpoint (minimal public response, no version/uptime leaks)
  if (cleanPath === '/health' || cleanPath === '/api/v2/health') {
    sendJSON(res, 200, {
      status: 'HEALTHY',
      ok: true,
    });
    return true;
  }

  // 1. Feature Flags V2
  if (pathname === '/api/v2/feature-flags' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getFeatureFlags() });
    return true;
  }
  const flagMatch = pathname.match(/^\/api\/v2\/feature-flags\/([a-zA-Z0-9_-]+)$/);
  if (flagMatch && method === 'PUT') {
    const body = await parseBody(req);
    if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return true;
    const flagKey = flagMatch[1];
    const updated = updateFeatureFlag(flagKey, body);
    sendJSON(res, 200, { success: true, data: updated });
    return true;
  }

  // 2. Fleet Telemetry & Devices V2
  if (pathname === '/api/v2/fleet/telemetry' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getLiveTelemetry() });
    return true;
  }
  if (pathname === '/api/v2/fleet/devices' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getFleetDevices() });
    return true;
  }
  const deviceMatch = pathname.match(/^\/api\/v2\/fleet\/devices\/([a-zA-Z0-9_-]+)$/);
  if (deviceMatch && method === 'DELETE') {
    if (!requireMasterAdminAuth(req, res, parsedUrl)) return true;
    const deviceId = deviceMatch[1];
    const ok = revokeDevice(deviceId);
    sendJSON(res, 200, { success: ok });
    return true;
  }

  // 3. Developer API Keys V2 (Enforces api_keys:read/write scopes and strict user ownership)
  if (await handleApiKeysV2Route(req, res, pathname, method, parsedUrl)) {
    return true;
  }

  // 4. Super Admin License List
  if (pathname === '/api/v2/super-admin/licenses/list' && method === 'GET') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
      return true;
    }
    if (!requireMasterAdminAuth(req, res, parsedUrl)) return true;
    try {
      const db = getDatabase();
      const licenses = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all();
      sendJSON(res, 200, { success: true, data: licenses });
    } catch (err: unknown) {
      sendJSON(res, 500, { success: false, error: toErrMsg(err) });
    }
    return true;
  }

  // 4b. Super Admin License Action (Activate/Disable/Extend/Delete)
  if (pathname === '/api/v2/super-admin/licenses/action' && method === 'POST') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
      return true;
    }
    try {
      const body = await parseBody<{ action?: string; id?: string } & AuthBodyLike>(req);
      if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return true;
      const db = getDatabase();

      if (body.action === 'delete') {
        db.prepare('DELETE FROM licenses WHERE id = ?').run(body.id);
      } else if (body.action === 'disable') {
        db.prepare("UPDATE licenses SET status = 'DISABLED' WHERE id = ?").run(body.id);
      } else if (body.action === 'activate') {
        db.prepare("UPDATE licenses SET status = 'ACTIVE' WHERE id = ?").run(body.id);
      } else if (body.action === 'extend') {
        db.prepare("UPDATE licenses SET expires_at = datetime(expires_at, '+30 days') WHERE id = ?").run(body.id);
      }

      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendJSON(res, 500, { success: false, error: toErrMsg(err) });
    }
    return true;
  }

  // 5. Super Admin Raw SQLite Table Explorer
  const tableMatch = pathname.match(/^\/api\/v2\/super-admin\/db\/table\/([a-zA-Z0-9_]+)$/);
  if (tableMatch && method === 'GET') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
      return true;
    }
    if (!requireMasterAdminAuth(req, res, parsedUrl)) return true;
    const tableName = tableMatch[1];
    const allowedTables = [
      'profiles',
      'profile_folders',
      'profile_locks',
      'fleet_devices',
      'feature_flags',
      'api_keys_v2',
      'proxies',
      'activity_logs',
      'workspaces',
      'licenses',
    ];
    if (!allowedTables.includes(tableName)) {
      sendJSON(res, 400, { success: false, error: 'Table access not permitted' });
      return true;
    }
    try {
      const db = getDatabase();
      const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 100`).all();
      sendJSON(res, 200, { success: true, data: rows });
      return true;
    } catch (dbErr: unknown) {
      sendJSON(res, 500, { success: false, error: toErrMsg(dbErr) });
      return true;
    }
  }

  // 6. Activity Logs & License Status V2
  if (pathname === '/api/v2/logs' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getActivityLogs() });
    return true;
  }
  if (pathname === '/api/v2/license/status' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    try {
      const userDataDir = getProfileStoragePath
        ? path.dirname(path.dirname(getProfileStoragePath('temp')))
        : process.cwd();
      const licenseFile = path.join(userDataDir, 'offline-license.key');
      let rawKey = '';
      try {
        rawKey = (await fs.promises.readFile(licenseFile, 'utf8')).trim();
      } catch (readErr: unknown) {
        if ((readErr as NodeJS.ErrnoException)?.code !== 'ENOENT') throw readErr;
      }
      if (rawKey) {
        const check = verifyLicense(rawKey);
        if (check.valid) {
          sendJSON(res, 200, {
            success: true,
            data: {
              isValid: true,
              status: 'ACTIVE',
              message: 'MAHI Pro Active',
              license: {
                id: 'local-rsa-license',
                customerName: 'MAHI PRO Subscriber',
                keyMasked: 'MAHI-RSA-ACTIVE',
                expiresAt: check.expiresAt || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                maxDevices: 1,
                activeDevicesCount: 1,
              },
            },
          });
          return true;
        }
      }
    } catch (licErr) {
      log.debug('Offline RSA license probe fell back to standard check', {
        err: licErr instanceof Error ? licErr.message : String(licErr),
      });
    }
    const status = validateCurrentLicense();
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  return false;
}

export async function handleLegacyLicenseAndAdminRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // USER LICENSING ROUTES
  if (pathname === '/license/status' && method === 'GET') {
    const result = validateCurrentLicense();
    sendJSON(res, 200, result);
    return true;
  }

  if (pathname === '/license/activate' && method === 'POST') {
    const body = await parseBody<{ licenseKey: string; deviceId?: string; deviceName?: string; accountId?: string }>(
      req
    );
    const result = activateLicense(body.licenseKey, body.deviceId, body.deviceName, body.accountId);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (pathname === '/admin/licenses' && method === 'GET') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { error: 'Forbidden. Local admin license operations are disabled.' });
      return true;
    }
    const clientIp = getClientIp(req);
    if (!checkSuperAdminRateLimit(clientIp)) {
      sendJSON(res, 429, { error: 'Too many failed authentication attempts. Try again later.' });
      return true;
    }
    const adminSecret = (req.headers['x-admin-secret'] as string) || '';
    if (!verifyAdminAccess(adminSecret)) {
      recordFailedSuperAdminAttempt(clientIp);
      sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
      return true;
    }
    recordSuccessfulSuperAdminAttempt(clientIp);
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const licenses = getLicenses({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: licenses });
    return true;
  }

  if (pathname === '/admin/license/revoke' && method === 'POST') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { error: 'Forbidden. Local admin license operations are disabled.' });
      return true;
    }
    const clientIp = getClientIp(req);
    if (!checkSuperAdminRateLimit(clientIp)) {
      sendJSON(res, 429, { error: 'Too many failed authentication attempts. Try again later.' });
      return true;
    }
    const body = await parseBody<{ licenseId?: string; reason?: string } & AuthBodyLike>(req);
    const adminSecret =
      (req.headers['x-admin-secret'] as string) || (typeof body.adminSecret === 'string' ? body.adminSecret : '');
    if (!verifyAdminAccess(adminSecret)) {
      recordFailedSuperAdminAttempt(clientIp);
      sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
      return true;
    }
    recordSuccessfulSuperAdminAttempt(clientIp);
    try {
      const ok = await revokeLicense(String(body.licenseId || ''), typeof body.reason === 'string' ? body.reason : undefined);
      sendJSON(res, ok ? 200 : 404, { success: ok });
      return true;
    } catch (e: unknown) {
      log.error('[LicenseEngine][CRITICAL] admin license op failed', toErrMsg(e));
      sendJSON(res, 500, { success: false, error: 'License operation failed.' });
      return true;
    }
  }

  if (pathname === '/admin/license/extend' && method === 'POST') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { error: 'Forbidden. Local admin license operations are disabled.' });
      return true;
    }
    const clientIp = getClientIp(req);
    if (!checkSuperAdminRateLimit(clientIp)) {
      sendJSON(res, 429, { error: 'Too many failed authentication attempts. Try again later.' });
      return true;
    }
    const body = await parseBody<ExtendLicenseDTO & AuthBodyLike>(req);
    const adminSecret =
      (req.headers['x-admin-secret'] as string) || (typeof body.adminSecret === 'string' ? body.adminSecret : '');
    if (!verifyAdminAccess(adminSecret)) {
      recordFailedSuperAdminAttempt(clientIp);
      sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
      return true;
    }
    recordSuccessfulSuperAdminAttempt(clientIp);
    try {
      const record = await extendLicense(body);
      if (!record) {
        sendJSON(res, 404, { error: 'License not found' });
        return true;
      }
      sendJSON(res, 200, { success: true, data: record });
      return true;
    } catch (e: unknown) {
      log.error('[LicenseEngine][CRITICAL] admin license op failed', toErrMsg(e));
      sendJSON(res, 500, { success: false, error: 'License operation failed.' });
      return true;
    }
  }

  const devicesMatch = pathname.match(/^\/admin\/license\/([^/]+)\/devices$/);
  if (devicesMatch && method === 'GET') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { error: 'Forbidden. Local admin license operations are disabled.' });
      return true;
    }
    const clientIp = getClientIp(req);
    if (!checkSuperAdminRateLimit(clientIp)) {
      sendJSON(res, 429, { error: 'Too many failed authentication attempts. Try again later.' });
      return true;
    }
    const adminSecret = (req.headers['x-admin-secret'] as string) || '';
    if (!verifyAdminAccess(adminSecret)) {
      recordFailedSuperAdminAttempt(clientIp);
      sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
      return true;
    }
    recordSuccessfulSuperAdminAttempt(clientIp);
    const devices = getLicenseDevices(devicesMatch[1]);
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  if (pathname === '/admin/license/deactivate-device' && method === 'POST') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { error: 'Forbidden. Local admin license operations are disabled.' });
      return true;
    }
    const clientIp = getClientIp(req);
    if (!checkSuperAdminRateLimit(clientIp)) {
      sendJSON(res, 429, { error: 'Too many failed authentication attempts. Try again later.' });
      return true;
    }
    const body = await parseBody<{ licenseId: string; deviceId: string } & AuthBodyLike>(req);
    const adminSecret =
      (req.headers['x-admin-secret'] as string) || (typeof body.adminSecret === 'string' ? body.adminSecret : '');
    if (!verifyAdminAccess(adminSecret)) {
      recordFailedSuperAdminAttempt(clientIp);
      sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
      return true;
    }
    recordSuccessfulSuperAdminAttempt(clientIp);
    const ok = deactivateDevice(body.licenseId, body.deviceId);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  return false;
}
