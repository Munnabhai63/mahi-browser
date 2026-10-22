import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { getAppSettings } from '../services/settings-service.js';
import {
  getProfiles,
  getProfileById,
  createProfile,
  bulkCreateProfiles,
  bulkUpdateProfiles,
  bulkAssignProxies,
  bulkDeleteProfiles,
  softDeleteProfile,
  getTrashProfiles,
  restoreProfile,
  permanentDeleteProfile,
  emptyTrash,
  updateProfile,
  deleteProfile,
  cloneProfile,
  getProfileStoragePath,
} from '../../02_BROWSER/services/profile-service.js';



import { processManager } from '../../02_BROWSER/process-manager.js';
import {
  getProxies,
  getProxyById,
  createProxy,
  updateProxy,
  deleteProxy,
} from '../../02_BROWSER/services/proxy-service.js';
import { runWorkflow } from '../../09_AUTOMATION/automation-engine.js';
import { sanitizeError } from '../../08_SECURITY/sanitizer.js';
import {
  getLicenses,
  getLicenseById,
  activateLicense,
  validateCurrentLicense,
  revokeLicense,
  extendLicense,
  getLicenseDevices,
  deactivateDevice,
} from '../../04_LICENSING/license-engine.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { synchronizerHub, SyncAction } from '../../09_AUTOMATION/sync-hub.js';



import { getWebAdminHtml } from '../server/web-admin-html.js';
import { getSuperAdminHtml } from '../server/super-admin-html.js';
import { getDownloadPortalHtml } from '../server/download-portal-html.js';
import { getDistributionInfo } from '../../03_HARDWARE/distribution-service.js';
import { getFolders, createFolder } from '../../02_BROWSER/services/folder-service.js';
import { getFeatureFlags, updateFeatureFlag } from '../services/feature-flag-service.js';
import { getFleetDevices, getLiveTelemetry, revokeDevice } from '../services/fleet-service.js';
import { getApiKeys, generateApiKey, revokeApiKey, validateApiKey } from '../services/api-v2-service.js';
import { getActivityLogs } from '../services/audit-service.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { handleCommercialApiRoutes } from '../commercial/commercial-api-router.js';
import { assertCanCreateProfile } from '../../08_SECURITY/freemium-guard.js';
import { isValidApiToken, isValidAdminWebSecret, getApiAuthToken } from '../../08_SECURITY/install-secrets.js';
import { verifyLicense } from '../../08_SECURITY/license-service.js';
import { CreateProfileDTOSchema } from '../../10_CONFIG/shared/validation/schemas.js';
import { getAccountSession } from '../../08_SECURITY/account-service.js';
import { getActiveUserId } from '../commercial/session-context.js';

function getLocalApiOwnerId(): string {
  const session = getAccountSession();
  if (session?.account_id) return session.account_id;
  const activeUser = getActiveUserId();
  if (activeUser) return activeUser;
  return 'SYSTEM_OWNER';
}

let apiServer: http.Server | null = null;

const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/127\.0\.0\.1(:[0-9]+)?$/,
  /^http:\/\/localhost(:[0-9]+)?$/,
  /^app:\/\//,
  /^file:\/\//,
  /^chrome-extension:\/\//,
  /^https?:\/\/([a-z0-9-]+\.)?mahibrowser\.com$/,
];

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function getCorsHeaders(req: http.IncomingMessage): Record<string, string> {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Admin-Secret',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return {};
}

function isValidHost(host: string | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(':')[0].toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

function checkMutatingAuth(req: http.IncomingMessage, parsedUrl: URL, body?: any): boolean {
  const authHeader = req.headers['authorization'];
  let bearer = '';
  if (authHeader) {
    bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (isValidApiToken(bearer)) return true;
  }
  const queryToken = parsedUrl.searchParams.get('token');
  if (queryToken && isValidApiToken(queryToken)) return true;

  // Validate active desktop account session
  try {
    const session = getAccountSession();
    if (session?.token) {
      if ((bearer && bearer === session.token) || (queryToken && queryToken === session.token)) {
        return true;
      }
    }
  } catch {}

  const apiKey = (req.headers['x-api-key'] as string) || parsedUrl.searchParams.get('apiKey');
  if (apiKey) {
    const keyCheck = validateApiKey(apiKey);
    if (keyCheck) return true;
  }

  const adminSecret = (req.headers['x-admin-secret'] as string) || parsedUrl.searchParams.get('adminSecret') || (body && (body.adminSecret || body.secret));
  if (adminSecret && (verifyAdminAccess(adminSecret) || isValidAdminWebSecret(adminSecret))) {
    return true;
  }

  return false;
}

function sendHTML(res: http.ServerResponse, statusCode: number, html: string) {
  const req = (res as any).__req as http.IncomingMessage | undefined;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    ...corsHeaders,
  });
  res.end(html);
}

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  const req = (res as any).__req as http.IncomingMessage | undefined;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendFile(res: http.ServerResponse, filePath: string, downloadName: string) {
  const req = (res as any).__req as http.IncomingMessage | undefined;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  if (!fs.existsSync(filePath)) {
    sendJSON(res, 404, { success: false, error: 'File not found. Build installers first using npm run dist.' });
    return;
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${downloadName}"`,
    'Content-Length': stat.size,
    ...corsHeaders,
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', reject);
  });
}

export function startApiServer(): void {
  const settings = getAppSettings();
  if (!settings.advanced.apiServerEnabled) {
    return;
  }

  if (apiServer) {
    try { apiServer.close(); } catch {}
  }

  const port = settings.advanced.apiPort || 32123;
  const token = settings.advanced.apiAuthToken;

  apiServer = http.createServer(async (req, res) => {
    (res as any).__req = req;

    // Host header validation — blocks DNS rebinding
    if (!isValidHost(req.headers.host)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Invalid Host header');
      return;
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      const corsHeaders = getCorsHeaders(req);
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const method = req.method?.toUpperCase() || 'GET';

    // Commercial API Layer (/api/v1/*)
    const handledCommercial = await handleCommercialApiRoutes(req, res, pathname, method, parsedUrl);
    if (handledCommercial) {
      return;
    }

    // Super Admin dynamic secret verification endpoint
    if (pathname === '/api/v2/super-admin/auth/verify' && method === 'POST') {
      const body = await parseBody(req);
      const secret = body.secret || body.pin || '';
      if (verifyAdminAccess(secret) || isValidAdminWebSecret(secret)) {
        sendJSON(res, 200, { success: true, token: getApiAuthToken() });
      } else {
        sendJSON(res, 401, { success: false, error: 'Invalid master secret' });
      }
      return;
    }

    // 0. Secret Super Admin & Web Admin HTML Portals (Open directly in any browser)
    if ((cleanPath === '/super-admin' || cleanPath === '/root-admin' || cleanPath === '/master-admin') && method === 'GET') {
      sendHTML(res, 200, getSuperAdminHtml());
      return;
    }

    if ((cleanPath === '' || cleanPath === '/' || cleanPath === '/admin' || cleanPath === '/web' || cleanPath === '/dashboard') && method === 'GET') {
      sendHTML(res, 200, getWebAdminHtml());
      return;
    }

    // 0. Client Download & Installation Portal (Open to customers)
    if ((cleanPath === '/download' || cleanPath === '/install' || cleanPath === '/client' || cleanPath === '/setup' || cleanPath === '/get' || cleanPath === '/app') && method === 'GET') {
      const info = getDistributionInfo();
      sendHTML(res, 200, getDownloadPortalHtml(info));
      return;
    }

    // 0. Direct File Downloads: Setup and Portable executables
    if (cleanPath === '/download/setup' || cleanPath === '/api/v2/download/setup') {
      const info = getDistributionInfo();
      sendFile(res, info.setupPath, info.setupFileName);
      return;
    }

    if (cleanPath === '/download/portable' || cleanPath === '/api/v2/download/portable') {
      const info = getDistributionInfo();
      sendFile(res, info.portablePath, info.portableFileName);
      return;
    }

    // 0. Distribution Metadata API
    if (pathname === '/api/v2/distribution/info' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: getDistributionInfo() });
      return;
    }

    // Health check endpoint (open)
    if (cleanPath === '/health' || cleanPath === '/api/v2/health') {
      sendJSON(res, 200, {
        status: 'HEALTHY',
        version: '2.0.0',
        platform: 'MAHI Platform V2',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 1. Feature Flags V2
    if (pathname === '/api/v2/feature-flags' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: getFeatureFlags() });
      return;
    }
    const flagMatch = pathname.match(/^\/api\/v2\/feature-flags\/([a-zA-Z0-9_-]+)$/);
    if (flagMatch && method === 'PUT') {
      const body = await parseBody(req);
      if (!checkMutatingAuth(req, parsedUrl, body)) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
        return;
      }
      const flagKey = flagMatch[1];
      const updated = updateFeatureFlag(flagKey, body);
      sendJSON(res, 200, { success: true, data: updated });
      return;
    }

    // 2. Fleet Telemetry & Devices V2
    if (pathname === '/api/v2/fleet/telemetry' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: getLiveTelemetry() });
      return;
    }
    if (pathname === '/api/v2/fleet/devices' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: getFleetDevices() });
      return;
    }
    const deviceMatch = pathname.match(/^\/api\/v2\/fleet\/devices\/([a-zA-Z0-9_-]+)$/);
    if (deviceMatch && method === 'DELETE') {
      if (!checkMutatingAuth(req, parsedUrl)) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
        return;
      }
      const deviceId = deviceMatch[1];
      const ok = revokeDevice(deviceId);
      sendJSON(res, 200, { success: ok });
      return;
    }

    // 3. Developer API Keys V2
    if (pathname === '/api/v2/api-keys' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: getApiKeys() });
      return;
    }
    if (pathname === '/api/v2/api-keys' && method === 'POST') {
      const body = await parseBody(req);
      if (!checkMutatingAuth(req, parsedUrl, body)) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
        return;
      }
      const result = generateApiKey(
        body.name || 'API-Key',
        body.userId || 'default-user',
        body.scopes || ['profiles:read', 'profiles:write', 'profiles:launch']
      );
      sendJSON(res, 201, { success: true, data: result });
      return;
    }
    const apiKeyMatch = pathname.match(/^\/api\/v2\/api-keys\/([a-zA-Z0-9_-]+)$/);
    if (apiKeyMatch && method === 'DELETE') {
      if (!checkMutatingAuth(req, parsedUrl)) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
        return;
      }
      const keyId = apiKeyMatch[1];
      const ok = revokeApiKey(keyId);
      sendJSON(res, 200, { success: ok });
      return;
    }

    // 4. Super Admin License List
    if (pathname === '/api/v2/super-admin/licenses/list' && method === 'GET') {
      if (!checkMutatingAuth(req, parsedUrl)) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
        return;
      }
      try {
        const db = getDatabase();
        const licenses = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all();
        sendJSON(res, 200, { success: true, data: licenses });
      } catch(err: any) {
        sendJSON(res, 500, { success: false, error: err.message });
      }
      return;
    }
    
    // 4b. Super Admin License Action (Activate/Disable/Extend/Delete)
    if (pathname === '/api/v2/super-admin/licenses/action' && method === 'POST') {
      try {
        const body = await parseBody(req);
        if (!checkMutatingAuth(req, parsedUrl, body)) {
          sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
          return;
        }
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
      } catch(err: any) {
        sendJSON(res, 500, { success: false, error: err.message });
      }
      return;
    }

    // 5. Super Admin Raw SQLite Table Explorer
    const tableMatch = pathname.match(/^\/api\/v2\/super-admin\/db\/table\/([a-zA-Z0-9_]+)$/);
    if (tableMatch && method === 'GET') {
      if (!checkMutatingAuth(req, parsedUrl)) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
        return;
      }
      const tableName = tableMatch[1];
      const allowedTables = ['profiles', 'profile_folders', 'profile_locks', 'fleet_devices', 'feature_flags', 'api_keys_v2', 'proxies', 'activity_logs', 'workspaces', 'licenses'];
      if (!allowedTables.includes(tableName)) {
        sendJSON(res, 400, { success: false, error: 'Table access not permitted' });
        return;
      }
      try {
        const db = getDatabase();
        const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 100`).all();
        sendJSON(res, 200, { success: true, data: rows });
        return;
      } catch (dbErr: any) {
        sendJSON(res, 500, { success: false, error: dbErr.message });
        return;
      }
    }

    // 6. Activity Logs & License Status V2
    if (pathname === '/api/v2/logs' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: getActivityLogs() });
      return;
    }
    if (pathname === '/api/v2/license/status' && method === 'GET') {
      try {
        const userDataDir = getProfileStoragePath ? path.dirname(path.dirname(getProfileStoragePath('temp'))) : process.cwd();
        const licenseFile = path.join(userDataDir, 'offline-license.key');
        if (fs.existsSync(licenseFile)) {
          const rawKey = fs.readFileSync(licenseFile, 'utf8').trim();
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
              return;
            }
          }
        }
      } catch {}
      const status = validateCurrentLicense();
      sendJSON(res, 200, { success: true, data: status });
      return;
    }

    // 7. Profiles V2 Endpoints
    if (pathname === '/api/v2/profiles' && method === 'GET') {
      const activeOwnerId = getLocalApiOwnerId();
      sendJSON(res, 200, { success: true, data: getProfiles({ ownerId: activeOwnerId }) });
      return;
    }
    if (pathname === '/api/v2/profiles' && method === 'POST') {
      try {
        const body = await parseBody(req);
        if (!checkMutatingAuth(req, parsedUrl, body)) {
          sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
          return;
        }
        assertCanCreateProfile(1);
        const activeOwnerId = getLocalApiOwnerId();
        const profile = createProfile({ ...body, ownerId: activeOwnerId });
        sendJSON(res, 201, { success: true, data: profile });
      } catch (err: any) {
        sendJSON(res, 400, { success: false, error: err.message });
      }
      return;
    }
    const profileV2Action = pathname.match(/^\/api\/v2\/profiles\/([a-zA-Z0-9_-]+)\/(start|stop|clone)$/);
    if (profileV2Action && method === 'POST') {
      const body = await parseBody(req);
      if (!checkMutatingAuth(req, parsedUrl, body)) {
        sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication required.' });
        return;
      }
      const profileId = profileV2Action[1];
      const action = profileV2Action[2];
      const activeOwnerId = getLocalApiOwnerId();
      const existing = getProfileById(profileId, activeOwnerId);
      if (!existing) {
        sendJSON(res, 404, { success: false, error: 'Profile not found or access denied.' });
        return;
      }
      if (action === 'start') {
        const result = await processManager.startProfile(profileId);
        sendJSON(res, result.success ? 200 : 500, result);
        return;
      }
      if (action === 'stop') {
        const result = await processManager.stopProfile(profileId);
        sendJSON(res, result.success ? 200 : 500, result);
        return;
      }
      if (action === 'clone') {
        try {
          assertCanCreateProfile(1);
          const cloned = cloneProfile(profileId, body.name || undefined, activeOwnerId);
          sendJSON(res, 201, { success: true, data: cloned });
        } catch (err: any) {
          sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
      }
    }

    // Authenticate Bearer token for Legacy REST endpoints (Header, Query param, API Key, or Admin secret)
    const isAuthorized = checkMutatingAuth(req, parsedUrl);
    if (!isAuthorized) {
      sendJSON(res, 401, { error: 'Unauthorized. Invalid or missing authentication credentials.' });
      return;
    }


    try {
      // PROFILES ROUTES
      if (pathname === '/profiles' && method === 'GET') {
        const search = parsedUrl.searchParams.get('search') || undefined;
        const status = (parsedUrl.searchParams.get('status') as any) || undefined;
        const profiles = getProfiles({ searchQuery: search, status, ownerId: getLocalApiOwnerId() });
        sendJSON(res, 200, { success: true, data: profiles });
        return;
      }

      if (pathname === '/profiles' && method === 'POST') {
        try {
          const body = await parseBody(req);
          assertCanCreateProfile(1);
          const validated = CreateProfileDTOSchema.parse(body);
          const result = createProfile({ ...validated, ownerId: getLocalApiOwnerId() });
          sendJSON(res, 201, { success: true, data: result });
        } catch (err: any) {
          sendJSON(res, 400, { success: false, error: sanitizeError(err) });
        }
        return;
      }

      if (pathname === '/profiles/bulk' && method === 'POST') {
        const body = await parseBody(req);
        assertCanCreateProfile(body?.count || 1);
        const result = bulkCreateProfiles({ ...body, ownerId: getLocalApiOwnerId() });
        sendJSON(res, 201, { success: true, data: result });
        return;
      }

      if (pathname === '/profiles/bulk-update' && method === 'POST') {
        const body = await parseBody(req);
        const result = bulkUpdateProfiles(body, getLocalApiOwnerId());
        sendJSON(res, 200, { success: true, data: result });
        return;
      }

      if (pathname === '/profiles/bulk-delete' && method === 'POST') {
        const body = await parseBody(req);
        const result = bulkDeleteProfiles(body.profileIds || [], getLocalApiOwnerId());
        sendJSON(res, 200, { success: true, data: result });
        return;
      }

      if (pathname === '/profiles/bulk-assign-proxies' && method === 'POST') {
        const body = await parseBody(req);
        const result = bulkAssignProxies(body, getLocalApiOwnerId());
        sendJSON(res, 200, { success: true, data: result });
        return;
      }

      if (pathname === '/profiles/quick-switch' && method === 'POST') {
        const body = await parseBody(req);
        const num = parseInt(body.number || body.profileNumber || '1', 10);
        const result = await processManager.quickSwitchProfile(num);
        sendJSON(res, result.success ? 200 : 404, result);
        return;
      }



      if (pathname === '/profiles/trash' && method === 'GET') {
        const trash = getTrashProfiles(getLocalApiOwnerId());
        sendJSON(res, 200, { success: true, data: trash });
        return;
      }

      if (pathname === '/profiles/trash/empty' && method === 'POST') {
        const result = emptyTrash(getLocalApiOwnerId());
        sendJSON(res, 200, { success: true, data: result });
        return;
      }

      // Match /profiles/:id/restore
      const restoreMatch = pathname.match(/^\/profiles\/([^/]+)\/restore$/);
      if (restoreMatch && method === 'POST') {
        const id = restoreMatch[1];
        const restored = restoreProfile(id, getLocalApiOwnerId());
        sendJSON(res, 200, { success: true, data: restored });
        return;
      }

      // Match /profiles/:id/permanent
      const permMatch = pathname.match(/^\/profiles\/([^/]+)\/permanent$/);
      if (permMatch && method === 'DELETE') {
        const id = permMatch[1];
        const activeOwnerId = getLocalApiOwnerId();
        const existing = getProfileById(id, activeOwnerId);
        if (!existing) {
          sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
          return;
        }
        if (processManager.isRunning(id)) {
          await processManager.stopProfile(id);
        }
        const ok = permanentDeleteProfile(id, activeOwnerId);
        sendJSON(res, 200, { success: ok });
        return;
      }

      // Match /profiles/:id
      const profileMatch = pathname.match(/^\/profiles\/([^/]+)$/);
      if (profileMatch) {
        const id = profileMatch[1];
        const activeOwnerId = getLocalApiOwnerId();
        if (method === 'GET') {
          const p = getProfileById(id, activeOwnerId);
          if (!p) return sendJSON(res, 404, { error: 'Profile not found or access denied' });
          return sendJSON(res, 200, { success: true, data: p });
        }
        if (method === 'PUT') {
          const body = await parseBody(req);
          const p = updateProfile(id, body, activeOwnerId);
          return sendJSON(res, 200, { success: true, data: p });
        }
        if (method === 'DELETE') {
          const p = getProfileById(id, activeOwnerId);
          if (!p) return sendJSON(res, 404, { error: 'Profile not found or access denied' });
          if (processManager.isRunning(id)) {
            await processManager.stopProfile(id);
          }
          const ok = softDeleteProfile(id, activeOwnerId);
          return sendJSON(res, 200, { success: ok });
        }
      }


      // /profiles/:id/start
      const startMatch = pathname.match(/^\/profiles\/([^/]+)\/start$/);
      if (startMatch && method === 'POST') {
        const id = startMatch[1];
        const activeOwnerId = getLocalApiOwnerId();
        const p = getProfileById(id, activeOwnerId);
        if (!p) return sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
        const result = await processManager.startProfile(id);
        return sendJSON(res, result.success ? 200 : 500, result);
      }

      // MostLogin / GoLogin Compatibility Route: /api/v1/profile/start or /browser/start
      if ((pathname === '/api/v1/profile/start' || pathname === '/browser/start') && (method === 'GET' || method === 'POST')) {
        let id = parsedUrl.searchParams.get('profileId') || parsedUrl.searchParams.get('profile_id');
        if (!id && method === 'POST') {
          const body = await parseBody(req);
          id = body.profileId || body.profile_id || body.id;
        }
        if (!id) return sendJSON(res, 400, { code: 400, success: false, error: 'Missing profileId' });
        const activeOwnerId = getLocalApiOwnerId();
        const p = getProfileById(id, activeOwnerId);
        if (!p) return sendJSON(res, 404, { code: 404, success: false, error: 'Profile not found or access denied' });
        const result = await processManager.startProfile(id);
        const cdpPort = 9222;
        return sendJSON(res, result.success ? 200 : 500, {
          code: result.success ? 0 : 500,
          success: result.success,
          data: {
            profileId: id,
            pid: result.pid,
            cdpPort,
            wsEndpoint: `ws://127.0.0.1:${cdpPort}/devtools/browser`,
          },
          error: result.error,
        });
      }

      // /profiles/:id/stop
      const stopMatch = pathname.match(/^\/profiles\/([^/]+)\/stop$/);
      if (stopMatch && method === 'POST') {
        const id = stopMatch[1];
        const activeOwnerId = getLocalApiOwnerId();
        const p = getProfileById(id, activeOwnerId);
        if (!p) return sendJSON(res, 404, { success: false, error: 'Profile not found or access denied' });
        const result = await processManager.stopProfile(id);
        return sendJSON(res, result.success ? 200 : 500, result);
      }

      // MostLogin / GoLogin Compatibility Route: /api/v1/profile/stop or /browser/stop
      if ((pathname === '/api/v1/profile/stop' || pathname === '/browser/stop') && (method === 'GET' || method === 'POST')) {
        let id = parsedUrl.searchParams.get('profileId') || parsedUrl.searchParams.get('profile_id');
        if (!id && method === 'POST') {
          const body = await parseBody(req);
          id = body.profileId || body.profile_id || body.id;
        }
        if (!id) return sendJSON(res, 400, { code: 400, success: false, error: 'Missing profileId' });
        const result = await processManager.stopProfile(id);
        return sendJSON(res, result.success ? 200 : 500, {
          code: result.success ? 0 : 500,
          success: result.success,
          data: { profileId: id },
          error: result.error,
        });
      }

      // /profiles/:id/clone
      const cloneMatch = pathname.match(/^\/profiles\/([^/]+)\/clone$/);
      if (cloneMatch && method === 'POST') {
        const id = cloneMatch[1];
        const activeOwnerId = getLocalApiOwnerId();
        const existing = getProfileById(id, activeOwnerId);
        if (!existing) return sendJSON(res, 404, { success: false, error: 'Source profile not found or access denied' });
        assertCanCreateProfile(1);
        const body = await parseBody(req);
        const p = cloneProfile({
          sourceProfileId: id,
          newName: body.newName || `Cloned Profile`,
          copyCookies: Boolean(body.copyCookies ?? true),
          copyHistory: Boolean(body.copyHistory ?? false),
          copyExtensions: Boolean(body.copyExtensions ?? true),
          copyBrowserSettings: Boolean(body.copyBrowserSettings ?? true),
        }, undefined, activeOwnerId);
        return sendJSON(res, 201, { success: true, data: p });
      }

      // /profiles/:id/warmer-queue
      const queueMatch = pathname.match(/^\/profiles\/([^/]+)\/warmer-queue$/);
      if (queueMatch && method === 'GET') {
        const id = queueMatch[1];
        const storageDir = getProfileStoragePath(id);
        const qFile = path.join(storageDir, 'mahi_warmer_queue.json');
        if (fs.existsSync(qFile)) {
          try {
            const raw = fs.readFileSync(qFile, 'utf8');
            const data = JSON.parse(raw);
            fs.unlinkSync(qFile); // Consume once
            return sendJSON(res, 200, { success: true, sites: data.sites || [] });
          } catch {
            return sendJSON(res, 200, { success: false, sites: [] });
          }
        }
        return sendJSON(res, 200, { success: false, sites: [] });
      }

      // PROXIES ROUTES

      if (pathname === '/proxies' && method === 'GET') {
        const proxies = getProxies();
        sendJSON(res, 200, { success: true, data: proxies });
        return;
      }

      if (pathname === '/proxies' && method === 'POST') {
        const body = await parseBody(req);
        const proxy = createProxy(body);
        sendJSON(res, 201, { success: true, data: proxy });
        return;
      }

      const proxyMatch = pathname.match(/^\/proxies\/([^/]+)$/);
      if (proxyMatch) {
        const id = proxyMatch[1];
        if (method === 'GET') {
          const proxy = getProxyById(id);
          if (!proxy) return sendJSON(res, 404, { error: 'Proxy not found' });
          return sendJSON(res, 200, { success: true, data: proxy });
        }
        if (method === 'PUT') {
          const body = await parseBody(req);
          const proxy = updateProxy(id, body);
          return sendJSON(res, 200, { success: true, data: proxy });
        }
        if (method === 'DELETE') {
          const ok = deleteProxy(id);
          return sendJSON(res, 200, { success: ok });
        }
      }

      // AUTOMATION RUN
      if (pathname === '/automation/run' && method === 'POST') {
        const body = await parseBody(req);
        const result = await runWorkflow(body);
        return sendJSON(res, 200, { success: true, data: result });
      }

      // USER LICENSING ROUTES
      if (pathname === '/license/status' && method === 'GET') {
        const result = validateCurrentLicense();
        return sendJSON(res, 200, result);
      }

      if (pathname === '/license/activate' && method === 'POST') {
        const body = await parseBody(req);
        const result = activateLicense(body.licenseKey, body.deviceId, body.deviceName, body.accountId);
        return sendJSON(res, result.success ? 200 : 400, result);
      }



      if (pathname === '/admin/licenses' && method === 'GET') {
        const adminSecret = req.headers['x-admin-secret'] as string || parsedUrl.searchParams.get('adminSecret') || '';
        if (!verifyAdminAccess(adminSecret)) {
          return sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
        }
        const status = parsedUrl.searchParams.get('status') || undefined;
        const search = parsedUrl.searchParams.get('search') || undefined;
        const licenses = getLicenses({ status, searchQuery: search });
        return sendJSON(res, 200, { success: true, data: licenses });
      }

      if (pathname === '/admin/license/revoke' && method === 'POST') {
        const body = await parseBody(req);
        if (!verifyAdminAccess(body.adminSecret)) {
          return sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
        }
        const ok = revokeLicense(body.licenseId, body.reason);
        return sendJSON(res, ok ? 200 : 404, { success: ok });
      }

      if (pathname === '/admin/license/extend' && method === 'POST') {
        const body = await parseBody(req);
        if (!verifyAdminAccess(body.adminSecret)) {
          return sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
        }
        const record = extendLicense(body);
        if (!record) return sendJSON(res, 404, { error: 'License not found' });
        return sendJSON(res, 200, { success: true, data: record });
      }

      const devicesMatch = pathname.match(/^\/admin\/license\/([^/]+)\/devices$/);
      if (devicesMatch && method === 'GET') {
        const adminSecret = req.headers['x-admin-secret'] as string || parsedUrl.searchParams.get('adminSecret') || '';
        if (!verifyAdminAccess(adminSecret)) {
          return sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
        }
        const devices = getLicenseDevices(devicesMatch[1]);
        return sendJSON(res, 200, { success: true, data: devices });
      }

      if (pathname === '/admin/license/deactivate-device' && method === 'POST') {
        const body = await parseBody(req);
        if (!verifyAdminAccess(body.adminSecret)) {
          return sendJSON(res, 403, { error: 'Forbidden. Admin authentication required.' });
        }
        const ok = deactivateDevice(body.licenseId, body.deviceId);
        return sendJSON(res, ok ? 200 : 404, { success: ok });
      }

      // -------------------------------------------------------------
      // ACTION SYNCHRONIZER (MULTI-WINDOW MIRROR) ROUTES
      // -------------------------------------------------------------
      if ((pathname === '/sync/status' || pathname === '/synchronizer/status') && method === 'GET') {
        return sendJSON(res, 200, synchronizerHub.getState());
      }

      if ((pathname === '/sync/start' || pathname === '/synchronizer/start') && method === 'POST') {
        const body = await parseBody(req);
        const masterId = body.masterProfileId || body.masterId;
        const active = body.activeProfiles || body.active;
        const state = synchronizerHub.startSync(masterId, active, body.config);
        return sendJSON(res, 200, { success: true, state });
      }

      if ((pathname === '/sync/stop' || pathname === '/synchronizer/stop') && method === 'POST') {
        const state = synchronizerHub.stopSync();
        return sendJSON(res, 200, { success: true, state });
      }

      if ((pathname === '/sync/config' || pathname === '/synchronizer/config') && method === 'PUT') {
        const body = await parseBody(req);
        const state = synchronizerHub.updateConfig(body);
        return sendJSON(res, 200, { success: true, state });
      }

      if ((pathname === '/sync/broadcast' || pathname === '/synchronizer/broadcast') && method === 'POST') {
        const body = await parseBody(req) as { sourceProfileId: string; action: SyncAction };
        if (body.sourceProfileId && body.action) {
          synchronizerHub.broadcastAction(body.sourceProfileId, body.action);
        }
        return sendJSON(res, 200, { success: true });
      }

      if ((pathname === '/sync/events' || pathname === '/synchronizer/events') && method === 'GET') {
        const profileId = parsedUrl.searchParams.get('profileId') || 'unknown';
        synchronizerHub.registerClient(profileId, res);
        return;
      }

      if ((pathname === '/sync/running-profiles' || pathname === '/synchronizer/running-profiles') && method === 'GET') {
        return sendJSON(res, 200, { success: true, runningProfileIds: processManager.getRunningProfileIds() });
      }

      sendJSON(res, 404, { error: `Endpoint ${method} ${pathname} not found` });



    } catch (err: unknown) {
      sendJSON(res, 500, { error: sanitizeError(err) });
    }
  });

  apiServer.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`[API Server] Port ${port} is already in use. Skipping duplicate server bind.`);
    } else {
      console.error('[API Server] Error:', err);
    }
  });

  apiServer.listen(port, '127.0.0.1', () => {
    // API server active on localhost
  });
}

export function stopApiServer(): void {
  if (apiServer) {
    try {
      apiServer.close();
    } catch {
      // ignore
    }
    apiServer = null;
  }
}
