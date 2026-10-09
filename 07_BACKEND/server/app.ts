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

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function sendHTML(res: http.ServerResponse, statusCode: number, html: string) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

function sendFile(res: http.ServerResponse, filePath: string, filename: string) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(`File not found: ${filename}`);
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Access-Control-Allow-Origin': '*',
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
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      });
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

      // Static assets from landing/assets
      if (cleanPath.startsWith('/assets/') && method === 'GET') {
        const relPath = cleanPath.substring(8);
        const safePath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
        const assetFilePath = path.join(process.cwd(), 'landing', 'assets', safePath);
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
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          });
          return fs.createReadStream(assetFilePath).pipe(res);
        }
      }

      // Public /signup Page (Onboarding & Identity)
      if (cleanPath === '/signup' && method === 'GET') {
        const signupPath = path.join(process.cwd(), 'landing', 'signup.html');
        if (fs.existsSync(signupPath)) {
          return sendHTML(res, 200, fs.readFileSync(signupPath, 'utf8'));
        }
      }

      // Public /login Page
      if (cleanPath === '/login' && method === 'GET') {
        const loginPath = path.join(process.cwd(), 'landing', 'login.html');
        if (fs.existsSync(loginPath)) {
          return sendHTML(res, 200, fs.readFileSync(loginPath, 'utf8'));
        }
      }

      // Public /book-demo Page (Enterprise & Team Lead Capture)
      if (cleanPath === '/book-demo' && method === 'GET') {
        const demoPath = path.join(process.cwd(), 'landing', 'book-demo.html');
        if (fs.existsSync(demoPath)) {
          return sendHTML(res, 200, fs.readFileSync(demoPath, 'utf8'));
        }
      }

      // 0. Secret Super Admin Console
      if ((cleanPath === '/super-admin' || cleanPath === '/root-admin' || cleanPath === '/master-admin') && method === 'GET') {
        return sendHTML(res, 200, getSuperAdminHtml());
      }

      // 0. Standalone Web Admin Control Center UI
      if ((cleanPath === '' || cleanPath === '/' || cleanPath === '/admin' || cleanPath === '/web' || cleanPath === '/dashboard') && method === 'GET') {
        return sendHTML(res, 200, getWebAdminHtml());
      }

      // 0. Client Download & Installation Portal
      if ((cleanPath === '/download' || cleanPath === '/install' || cleanPath === '/client' || cleanPath === '/setup' || cleanPath === '/get' || cleanPath === '/app') && method === 'GET') {
        const downloadHtmlPath = path.join(process.cwd(), 'landing', 'download.html');
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
        return sendJSON(res, 200, { success: true, data: getDistributionInfo() });
      }

      // 0. Shortcut Repair API
      if (pathname === '/api/v2/system/fix-shortcuts' && method === 'POST') {
        const result = await fixDesktopShortcuts();
        return sendJSON(res, 200, result);
      }

      // 1. Health Endpoint
      if (cleanPath === '/health' || cleanPath === '/api/v2/health') {
        return sendJSON(res, 200, {
          status: 'HEALTHY',
          version: '2.0.0',
          platform: 'MAHI Platform V2',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Feature Flags
      if (pathname === '/api/v2/feature-flags' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getFeatureFlags() });
      }

      const flagMatch = pathname.match(/^\/api\/v2\/feature-flags\/([a-zA-Z0-9_-]+)$/);
      if (flagMatch && method === 'PUT') {
        const flagKey = flagMatch[1];
        const body = await parseBody(req);
        const updated = updateFeatureFlag(flagKey, body);
        return sendJSON(res, 200, { success: true, data: updated });
      }

      // 3. Profiles Endpoint
      if (pathname === '/api/v2/profiles' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getProfiles() });
      }

      if (pathname === '/api/v2/profiles' && method === 'POST') {
        try {
          assertCanCreateProfile(1);
          const body = await parseBody(req);
          const profile = createProfile(body);
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
          const profile = getProfileById(profileId);
          if (!profile) return sendJSON(res, 404, { success: false, error: 'Profile not found' });
          return sendJSON(res, 200, { success: true, data: profile });
        }
        if (method === 'PUT') {
          const body = await parseBody(req);
          const updated = updateProfile(profileId, body);
          return sendJSON(res, 200, { success: true, data: updated });
        }
        if (method === 'DELETE') {
          const ok = deleteProfile(profileId);
          return sendJSON(res, 200, { success: ok });
        }
      }

      // Profile Launch / Stop: /api/v2/profiles/:id/start & /api/v2/profiles/:id/stop
      const profileActionMatch = pathname.match(/^\/api\/v2\/profiles\/([a-zA-Z0-9_-]+)\/(start|stop|clone)$/);
      if (profileActionMatch && method === 'POST') {
        const profileId = profileActionMatch[1];
        const action = profileActionMatch[2];

        if (action === 'start') {
          const result = await processManager.startProfile(profileId);
          return sendJSON(res, result.success ? 200 : 500, result);
        }
        if (action === 'stop') {
          const result = await processManager.stopProfile(profileId);
          return sendJSON(res, result.success ? 200 : 500, result);
        }
        if (action === 'clone') {
          try {
            assertCanCreateProfile(1);
            const body = await parseBody(req);
            const cloned = cloneProfile(profileId, body.name || undefined);
            return sendJSON(res, 201, { success: true, data: cloned });
          } catch (err: any) {
            return sendJSON(res, 400, { success: false, error: err.message });
          }
        }
      }

      // 4. Folders
      if (pathname === '/api/v2/folders' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getFolders() });
      }
      if (pathname === '/api/v2/folders' && method === 'POST') {
        const body = await parseBody(req);
        const folder = createFolder(body.name, body.parentId, body.color, body.icon);
        return sendJSON(res, 201, { success: true, data: folder });
      }

      // 5. Proxies
      if (pathname === '/api/v2/proxies' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getProxies() });
      }
      if (pathname === '/api/v2/proxies' && method === 'POST') {
        const body = await parseBody(req);
        const proxy = createProxy(body);
        return sendJSON(res, 201, { success: true, data: proxy });
      }

      // 6. Fleet Telemetry & Devices
      if (pathname === '/api/v2/fleet/telemetry' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getLiveTelemetry() });
      }
      if (pathname === '/api/v2/fleet/devices' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getFleetDevices() });
      }
      const deviceMatch = pathname.match(/^\/api\/v2\/fleet\/devices\/([a-zA-Z0-9_-]+)$/);
      if (deviceMatch && method === 'DELETE') {
        const deviceId = deviceMatch[1];
        const ok = revokeDevice(deviceId);
        return sendJSON(res, 200, { success: ok });
      }

      // 7. Developer API Keys
      if (pathname === '/api/v2/api-keys' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getApiKeys() });
      }
      if (pathname === '/api/v2/api-keys' && method === 'POST') {
        const body = await parseBody(req);
        const result = generateApiKey(
          body.name || 'API-Key',
          body.userId || 'default-user',
          body.scopes || ['profiles:read', 'profiles:write', 'profiles:launch']
        );
        return sendJSON(res, 201, { success: true, data: result });
      }
      const apiKeyMatch = pathname.match(/^\/api\/v2\/api-keys\/([a-zA-Z0-9_-]+)$/);
      if (apiKeyMatch && method === 'DELETE') {
        const keyId = apiKeyMatch[1];
        const ok = revokeApiKey(keyId);
        return sendJSON(res, 200, { success: ok });
      }

      // 8. License Management & Minting Endpoints (Web Admin & Super Admin)
      if (pathname === '/api/v2/licenses' && method === 'GET') {
        return sendJSON(res, 200, { success: true, data: getLicenses() });
      }


      if (pathname === '/api/v2/licenses/revoke' && method === 'POST') {
        const body = await parseBody(req);
        const ok = revokeLicense(body.licenseId, body.reason || 'Revoked from Web Admin');
        return sendJSON(res, 200, { success: ok });
      }

      if (pathname === '/api/v2/licenses/extend' && method === 'POST') {
        const body = await parseBody(req);
        const record = extendLicense({
          licenseId: body.licenseId,
          additionalDays: parseInt(body.additionalDays, 10) || 30,
        });
        if (!record) return sendJSON(res, 404, { success: false, error: 'License not found' });
        return sendJSON(res, 200, { success: true, data: record });
      }

      // 9. Super Admin Raw SQLite Table Explorer
      const tableMatch = pathname.match(/^\/api\/v2\/super-admin\/db\/table\/([a-zA-Z0-9_]+)$/);
      if (tableMatch && method === 'GET') {
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
        return sendJSON(res, 200, { success: true, data: getActivityLogs() });
      }

      // 11. License validation
      if (pathname === '/api/v2/license/status' && method === 'GET') {
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
