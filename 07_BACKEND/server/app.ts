/**
 * MAHI Platform V2 — Central API Server, Web Admin & Secret Super Admin Console
 * Provides standard REST API endpoints for Desktop, Web, Admin, and Super Admin applications.
 * Serves:
 * - Web Admin on http://127.0.0.1:32123/admin
 * - Secret Super Admin on http://127.0.0.1:32123/super-admin
 */

import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';
import { getProfiles, getProfileById, createProfile, updateProfile, deleteProfile, cloneProfile } from '../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getProxies, createProxy, updateProxy, deleteProxy, testProxyConnection } from '../../02_BROWSER/services/proxy-service.js';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../../02_BROWSER/services/folder-service.js';
import { getProfileLock, acquireProfileLock, releaseProfileLock } from '../../02_BROWSER/services/profile-lock-service.js';
import { getFeatureFlags, isFeatureEnabled, updateFeatureFlag } from '../services/feature-flag-service.js';
import { getFleetDevices, getLiveTelemetry, revokeDevice } from '../services/fleet-service.js';
import { getApiKeys, generateApiKey, validateApiKey, revokeApiKey } from '../services/api-v2-service.js';
import { validateCurrentLicense, activateLicense, createLicense, getLicenses, revokeLicense, extendLicense } from '../../04_LICENSING/license-engine.js';
import fs from 'node:fs';
import { getActivityLogs } from '../services/audit-service.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { getWebAdminHtml } from './web-admin-html.js';
import { getSuperAdminHtml } from './super-admin-html.js';
import { getDownloadPortalHtml } from './download-portal-html.js';
import { getDistributionInfo, fixDesktopShortcuts } from '../../03_HARDWARE/distribution-service.js';
import { handleCommercialApiRoutes } from '../commercial/commercial-api-router.js';
import { assertCanCreateProfile } from '../../08_SECURITY/freemium-guard.js';
import { getLandingBaseDir } from '../utils/runtime-paths.js';
import {
  authenticateRequest,
  isLocalSuperAdminEnabled,
  getLocalApiOwnerId,
  getCorsHeaders,
  checkSuperAdminRateLimit,
  recordFailedSuperAdminAttempt,
  recordSuccessfulSuperAdminAttempt,
  RequestAuth,
} from '../api/local-api-server.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { isValidAdminWebSecret, getApiAuthToken } from '../../08_SECURITY/install-secrets.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  const req = (res as any).__req as http.IncomingMessage | undefined;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendHTML(res: http.ServerResponse, statusCode: number, html: string) {
  const req = (res as any).__req as http.IncomingMessage | undefined;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';",
    ...corsHeaders,
  });
  res.end(html);
}

function sendFile(res: http.ServerResponse, filePath: string, filename: string) {
  const req = (res as any).__req as http.IncomingMessage | undefined;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders });
    return res.end(`File not found: ${filename}`);
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${filename}"`,
    ...corsHeaders,
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

function requireUserOrAdminAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  body?: any,
  requiredScope?: string
): RequestAuth | null {
  const auth = authenticateRequest(req, parsedUrl, body);
  if (!auth.authenticated) {
    sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication credentials required.' });
    return null;
  }
  if (requiredScope && auth.role !== 'master_admin') {
    if (auth.scopes && auth.scopes.length > 0 && !auth.scopes.includes('*')) {
      if (!auth.scopes.includes(requiredScope)) {
        sendJSON(res, 403, { success: false, error: `Forbidden. Missing required scope: ${requiredScope}` });
        return null;
      }
    }
  }
  return auth;
}

function requireMasterAdminAuth(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL, body?: any): RequestAuth | null {
  const auth = authenticateRequest(req, parsedUrl, body);
  if (!auth.authenticated) {
    sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication credentials required.' });
    return null;
  }
  if (auth.role !== 'master_admin') {
    sendJSON(res, 403, { success: false, error: 'Forbidden. Master admin credentials required.' });
    return null;
  }
  return auth;
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

export function createCentralApiServer(): http.Server {
  return http.createServer(async (req, res) => {
    (res as any).__req = req;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      const corsHeaders = getCorsHeaders(req);
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;
    const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const method = req.method?.toUpperCase() || 'GET';

    try {
      // Commercial API Layer (/api/v1/*)
      const handledCommercial = await handleCommercialApiRoutes(req, res, pathname, method, parsedUrl);
      if (handledCommercial) {
        return;
      }

      // Super Admin dynamic secret verification endpoint
      if (pathname === '/api/v2/super-admin/auth/verify' && method === 'POST') {
        const clientIp = req.socket.remoteAddress || '127.0.0.1';
        if (!checkSuperAdminRateLimit(clientIp)) {
          return sendJSON(res, 429, { success: false, error: 'Too many failed authentication attempts. Please try again later.' });
        }
        const body = await parseBody(req);
        const secret = body.secret || body.pin || '';
        if (verifyAdminAccess(secret) || isValidAdminWebSecret(secret)) {
          recordSuccessfulSuperAdminAttempt(clientIp);
          return sendJSON(res, 200, { success: true, token: getApiAuthToken() });
        } else {
          recordFailedSuperAdminAttempt(clientIp);
          return sendJSON(res, 401, { success: false, error: 'Invalid master secret' });
        }
      }

      // Static assets from landing/assets
      if (cleanPath.startsWith('/assets/') && method === 'GET') {
        const relPath = cleanPath.substring(8);
        const safePath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
        const assetFilePath = path.join(getLandingBaseDir(), 'assets', safePath);
        if (fs.existsSync(assetFilePath) && fs.statSync(assetFilePath).isFile()) {
          const ext = path.extname(assetFilePath).toLowerCase();
          const mimeMap: Record<string, string> = {
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
            '.woff2': 'font/woff2',
            '.json': 'application/json',
            '.mp4': 'video/mp4',
          };
          const mime = mimeMap[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=3600',
            ...getCorsHeaders(req),
          });
          return fs.createReadStream(assetFilePath).pipe(res);
        }
      }

      // Public /signup Page (Onboarding & Identity)
      if (cleanPath === '/signup' && method === 'GET') {
        const signupPath = path.join(getLandingBaseDir(), 'signup.html');
        if (fs.existsSync(signupPath)) {
          return sendHTML(res, 200, fs.readFileSync(signupPath, 'utf8'));
        }
      }

      // Public /login Page
      if (cleanPath === '/login' && method === 'GET') {
        const loginPath = path.join(getLandingBaseDir(), 'login.html');
        if (fs.existsSync(loginPath)) {
          return sendHTML(res, 200, fs.readFileSync(loginPath, 'utf8'));
        }
      }

      // Public /book-demo Page (Enterprise & Team Lead Capture)
      if (cleanPath === '/book-demo' && method === 'GET') {
        const demoPath = path.join(getLandingBaseDir(), 'book-demo.html');
        if (fs.existsSync(demoPath)) {
          return sendHTML(res, 200, fs.readFileSync(demoPath, 'utf8'));
        }
      }

      // 0. Secret Super Admin Console
      if ((cleanPath === '/super-admin' || cleanPath === '/root-admin' || cleanPath === '/master-admin') && method === 'GET') {
        if (!isLocalSuperAdminEnabled()) {
          return sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
        }
        return sendHTML(res, 200, getSuperAdminHtml());
      }

      // 0. Standalone Web Admin Control Center UI (Restricted to /admin and /web)
      if ((cleanPath === '/admin' || cleanPath === '/web') && method === 'GET') {
        return sendHTML(res, 200, getWebAdminHtml());
      }

      // 0. Public Root Landing Page
      if ((cleanPath === '' || cleanPath === '/') && method === 'GET') {
        const indexPath = path.join(getLandingBaseDir(), 'index.html');
        if (fs.existsSync(indexPath)) {
          return sendHTML(res, 200, fs.readFileSync(indexPath, 'utf8'));
        }
      }

      // 0. Customer Account & Onboarding Dashboard (/dashboard)
      if (cleanPath === '/dashboard' && method === 'GET') {
        const downloadHtmlPath = path.join(getLandingBaseDir(), 'download.html');
        if (fs.existsSync(downloadHtmlPath)) {
          return sendHTML(res, 200, fs.readFileSync(downloadHtmlPath, 'utf8'));
        }
        const info = getDistributionInfo();
        return sendHTML(res, 200, getDownloadPortalHtml(info));
      }

      // 0. Client Download & Installation Portal
      if ((cleanPath === '/download' || cleanPath === '/install' || cleanPath === '/client' || cleanPath === '/setup' || cleanPath === '/get' || cleanPath === '/app') && method === 'GET') {
        const downloadHtmlPath = path.join(getLandingBaseDir(), 'download.html');
        if (fs.existsSync(downloadHtmlPath)) {
          return sendHTML(res, 200, fs.readFileSync(downloadHtmlPath, 'utf8'));
        }
        const info = getDistributionInfo();
        return sendHTML(res, 200, getDownloadPortalHtml(info));
      }

      // 0. Direct File Downloads: Setup, Portable executables, and MAHI-Setup.exe (Gated to authenticated visitors)
      if (
        cleanPath === '/download/setup' ||
        cleanPath === '/api/v2/download/setup' ||
        cleanPath === '/download/MAHI-Setup.exe'
      ) {
        const authHeader = (req.headers['authorization'] as string) || '';
        const cookieToken = req.headers['cookie']?.match(/mahi_token=([^;]+)/)?.[1];
        const queryToken = parsedUrl.searchParams.get('token');
        const token = authHeader.replace('Bearer ', '').trim() || cookieToken || queryToken;

        const acceptHeader = req.headers['accept'] || '';
        // If an anonymous user navigates directly via browser without token, redirect to signup onboarding
        if (!token && acceptHeader.includes('text/html')) {
          res.writeHead(302, { Location: '/signup?intent=trial&returnUrl=/download' });
          return res.end();
        }

        const info = getDistributionInfo();
        return sendFile(res, info.setupPath, info.setupFileName);
      }

      if (cleanPath === '/download/portable' || cleanPath === '/api/v2/download/portable') {
        const authHeader = (req.headers['authorization'] as string) || '';
        const cookieToken = req.headers['cookie']?.match(/mahi_token=([^;]+)/)?.[1];
        const queryToken = parsedUrl.searchParams.get('token');
        const token = authHeader.replace('Bearer ', '').trim() || cookieToken || queryToken;

        const acceptHeader = req.headers['accept'] || '';
        if (!token && acceptHeader.includes('text/html')) {
          res.writeHead(302, { Location: '/signup?intent=trial&returnUrl=/download' });
          return res.end();
        }

        const info = getDistributionInfo();
        return sendFile(res, info.portablePath, info.portableFileName);
      }

      // 0. Distribution Metadata API
      if (pathname === '/api/v2/distribution/info' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getDistributionInfo() });
      }

      // 0. Shortcut Repair API
      if (pathname === '/api/v2/system/fix-shortcuts' && method === 'POST') {
        const result = await fixDesktopShortcuts();
        return sendJSON(res, 200, result);
      }

      // 1. Health Endpoint (minimal public response, zero info leak)
      if (cleanPath === '/health' || cleanPath === '/api/v2/health') {
        return sendJSON(res, 200, {
          status: 'HEALTHY',
          ok: true,
        });
      }

      // 2. Feature Flags
      if (pathname === '/api/v2/feature-flags' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getFeatureFlags() });
      }

      const flagMatch = pathname.match(/^\/api\/v2\/feature-flags\/([a-zA-Z0-9_-]+)$/);
      if (flagMatch && method === 'PUT') {
        const body = await parseBody(req);
        if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return;
        const flagKey = flagMatch[1];
        const updated = updateFeatureFlag(flagKey, body);
        return sendJSON(res, 200, { success: true, data: updated });
      }

      // 3. Profiles Endpoint
      if (pathname === '/api/v2/profiles' && method === 'GET') {
        const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read');
        if (!auth) return;
        const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
        return sendJSON(res, 200, { success: true, data: getProfiles(ownerId ? { ownerId } : {}) });
      }

      if (pathname === '/api/v2/profiles' && method === 'POST') {
        try {
          const body = await parseBody(req);
          const auth = requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write');
          if (!auth) return;
          const ownerId = auth.userId || getLocalApiOwnerId();
          const effectiveOwnerId = (auth.role === 'master_admin' && body.ownerId) ? body.ownerId : ownerId;
          assertCanCreateProfile(1, effectiveOwnerId);
          const profile = createProfile({ ...body, ownerId: effectiveOwnerId });
          return sendJSON(res, 201, { success: true, data: profile });
        } catch (err: any) {
          return sendJSON(res, 400, { success: false, error: err.message });
        }
      }

      // Single profile route: /api/v2/profiles/:id
      const profileMatch = pathname.match(/^\/api\/v2\/profiles\/([a-zA-Z0-9_-]+)$/);
      if (profileMatch) {
        const profileId = profileMatch[1];
        if (method === 'GET') {
          const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read');
          if (!auth) return;
          const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
          const profile = getProfileById(profileId, ownerId);
          if (!profile) return sendJSON(res, 404, { success: false, error: 'Profile not found' });
          return sendJSON(res, 200, { success: true, data: profile });
        }
        if (method === 'PUT') {
          const body = await parseBody(req);
          const auth = requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write');
          if (!auth) return;
          const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
          const existing = getProfileById(profileId, ownerId);
          if (!existing) return sendJSON(res, 404, { success: false, error: 'Profile not found' });
          const updated = updateProfile(profileId, body, ownerId);
          return sendJSON(res, 200, { success: true, data: updated });
        }
        if (method === 'DELETE') {
          const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:write');
          if (!auth) return;
          const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
          const existing = getProfileById(profileId, ownerId);
          if (!existing) return sendJSON(res, 404, { success: false, error: 'Profile not found' });
          const ok = deleteProfile(profileId, ownerId);
          return sendJSON(res, 200, { success: ok });
        }
      }

      // Profile Launch / Stop: /api/v2/profiles/:id/start & /api/v2/profiles/:id/stop
      const profileActionMatch = pathname.match(/^\/api\/v2\/profiles\/([a-zA-Z0-9_-]+)\/(start|stop|clone)$/);
      if (profileActionMatch && method === 'POST') {
        const body = await parseBody(req);
        const action = profileActionMatch[2];
        const requiredScope = action === 'clone' ? 'profiles:write' : 'profiles:launch';
        const auth = requireUserOrAdminAuth(req, res, parsedUrl, body, requiredScope);
        if (!auth) return;
        const profileId = profileActionMatch[1];

        if (action === 'start') {
          const result = await processManager.startProfile(profileId);
          const cdpPort = getProfileDebugPort(profileId);
          return sendJSON(res, result.success ? 200 : 500, { ...result, cdpPort });
        }
        if (action === 'stop') {
          const result = await processManager.stopProfile(profileId);
          return sendJSON(res, result.success ? 200 : 500, result);
        }
        if (action === 'clone') {
          try {
            const ownerId = auth.userId || getLocalApiOwnerId();
            assertCanCreateProfile(1, ownerId);
            const cloned = cloneProfile(profileId, body.name || undefined, ownerId);
            return sendJSON(res, 201, { success: true, data: cloned });
          } catch (err: any) {
            return sendJSON(res, 400, { success: false, error: err.message });
          }
        }
      }

      // 4. Folders
      if (pathname === '/api/v2/folders' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getFolders() });
      }
      if (pathname === '/api/v2/folders' && method === 'POST') {
        const body = await parseBody(req);
        if (!requireUserOrAdminAuth(req, res, parsedUrl, body)) return;
        const folder = createFolder(body.name, body.parentId, body.color, body.icon);
        return sendJSON(res, 201, { success: true, data: folder });
      }

      // 5. Proxies
      if (pathname === '/api/v2/proxies' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getProxies() });
      }
      if (pathname === '/api/v2/proxies' && method === 'POST') {
        const body = await parseBody(req);
        if (!requireUserOrAdminAuth(req, res, parsedUrl, body)) return;
        const proxy = createProxy(body);
        return sendJSON(res, 201, { success: true, data: proxy });
      }

      // 6. Fleet Telemetry & Devices
      if (pathname === '/api/v2/fleet/telemetry' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getLiveTelemetry() });
      }
      if (pathname === '/api/v2/fleet/devices' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getFleetDevices() });
      }
      const deviceMatch = pathname.match(/^\/api\/v2\/fleet\/devices\/([a-zA-Z0-9_-]+)$/);
      if (deviceMatch && method === 'DELETE') {
        if (!requireMasterAdminAuth(req, res, parsedUrl)) return;
        const deviceId = deviceMatch[1];
        const ok = revokeDevice(deviceId);
        return sendJSON(res, 200, { success: ok });
      }

      // 7. Developer API Keys
      if (pathname === '/api/v2/api-keys' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getApiKeys() });
      }
      if (pathname === '/api/v2/api-keys' && method === 'POST') {
        const body = await parseBody(req);
        if (!requireUserOrAdminAuth(req, res, parsedUrl, body)) return;
        const result = generateApiKey(
          body.name || 'API-Key',
          body.userId || 'default-user',
          body.scopes || ['profiles:read', 'profiles:write', 'profiles:launch']
        );
        return sendJSON(res, 201, { success: true, data: result });
      }
      const apiKeyMatch = pathname.match(/^\/api\/v2\/api-keys\/([a-zA-Z0-9_-]+)$/);
      if (apiKeyMatch && method === 'DELETE') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        const keyId = apiKeyMatch[1];
        const ok = revokeApiKey(keyId);
        return sendJSON(res, 200, { success: ok });
      }

      // 8. License Management & Minting Endpoints (Web Admin & Super Admin)
      if (pathname === '/api/v2/licenses' && method === 'GET') {
        if (!requireMasterAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getLicenses() });
      }

      if (pathname === '/api/v2/licenses/revoke' && method === 'POST') {
        const body = await parseBody(req);
        if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return;
        const ok = revokeLicense(body.licenseId, body.reason || 'Revoked from Web Admin');
        return sendJSON(res, 200, { success: ok });
      }

      if (pathname === '/api/v2/licenses/extend' && method === 'POST') {
        const body = await parseBody(req);
        if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return;
        const record = extendLicense({
          licenseId: body.licenseId,
          additionalDays: parseInt(body.additionalDays, 10) || 30,
        });
        if (!record) return sendJSON(res, 404, { success: false, error: 'License not found' });
        return sendJSON(res, 200, { success: true, data: record });
      }

      // 8b. Super Admin License List & Action
      if (pathname === '/api/v2/super-admin/licenses/list' && method === 'GET') {
        if (!isLocalSuperAdminEnabled()) {
          return sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
        }
        if (!requireMasterAdminAuth(req, res, parsedUrl)) return;
        try {
          const db = getDatabase();
          const licenses = db.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all();
          return sendJSON(res, 200, { success: true, data: licenses });
        } catch (err: any) {
          return sendJSON(res, 500, { success: false, error: err.message });
        }
      }

      if (pathname === '/api/v2/super-admin/licenses/action' && method === 'POST') {
        if (!isLocalSuperAdminEnabled()) {
          return sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
        }
        try {
          const body = await parseBody(req);
          if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return;
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

          return sendJSON(res, 200, { success: true });
        } catch (err: any) {
          return sendJSON(res, 500, { success: false, error: err.message });
        }
      }

      // 9. Super Admin Raw SQLite Table Explorer
      const tableMatch = pathname.match(/^\/api\/v2\/super-admin\/db\/table\/([a-zA-Z0-9_]+)$/);
      if (tableMatch && method === 'GET') {
        if (!isLocalSuperAdminEnabled()) {
          return sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
        }
        if (!requireMasterAdminAuth(req, res, parsedUrl)) return;
        const tableName = tableMatch[1];
        const allowedTables = ['profiles', 'profile_folders', 'profile_locks', 'fleet_devices', 'feature_flags', 'api_keys_v2', 'proxies', 'activity_logs', 'workspaces', 'licenses'];
        if (!allowedTables.includes(tableName)) {
          return sendJSON(res, 400, { success: false, error: 'Table access not permitted' });
        }
        try {
          const db = getDatabase();
          const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 100`).all();
          return sendJSON(res, 200, { success: true, data: rows });
        } catch (dbErr: any) {
          return sendJSON(res, 500, { success: false, error: dbErr.message });
        }
      }

      // 10. Activity Logs
      if (pathname === '/api/v2/logs' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        return sendJSON(res, 200, { success: true, data: getActivityLogs() });
      }

      // 11. License validation
      if (pathname === '/api/v2/license/status' && method === 'GET') {
        if (!requireUserOrAdminAuth(req, res, parsedUrl)) return;
        const status = validateCurrentLicense();
        return sendJSON(res, 200, { success: true, data: status });
      }

      // 404 Route Not Found
      return sendJSON(res, 404, { success: false, error: `Route ${method} ${pathname} not found` });
    } catch (err: any) {
      return sendJSON(res, 500, { success: false, error: err.message || 'Internal Server Error' });
    }
  });
}
