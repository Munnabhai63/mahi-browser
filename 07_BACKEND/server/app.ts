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
import { parseBoundedJson, getErrorStatusCode } from '../utils/http-security.js';
import { sendSafeError } from '../utils/app-error.js';
import { buildHtmlSecurityHeaders } from '../utils/security-headers.js';
import { getProfiles, getProfileById, createProfile, updateProfile, deleteProfile, cloneProfile } from '../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getProxies, createProxy } from '../../02_BROWSER/services/proxy-service.js';
import { getFolders, createFolder } from '../../02_BROWSER/services/folder-service.js';
import { getFeatureFlags, updateFeatureFlag } from '../services/feature-flag-service.js';
import { getFleetDevices, getLiveTelemetry, revokeDevice } from '../services/fleet-service.js';
import { validateCurrentLicense, getLicenses, revokeLicense, extendLicense } from '../../04_LICENSING/license-engine.js';
import fs from 'node:fs';
import { getActivityLogs } from '../services/audit-service.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { isPostgresConfigured } from '../../06_DATABASE/central-repository.js';
import { getWebAdminHtml, getOwnerAdminHtml } from './web-admin-html.js';
import { getSuperAdminHtml } from './super-admin-html.js';
import { getDownloadPortalHtml } from './download-portal-html.js';
import { getDistributionInfo, fixDesktopShortcuts } from '../../03_HARDWARE/distribution-service.js';
import { handleCommercialApiRoutes } from '../commercial/commercial-api-router.js';
import { assertCanCreateProfile } from '../../08_SECURITY/freemium-guard.js';
import { getLandingBaseDir } from '../utils/runtime-paths.js';
import {
  authenticateRequest,
  verifyDownloadAccess,
  handleApiKeysV2Route,
  isLocalSuperAdminEnabled,
  getLocalApiOwnerId,
  getCorsHeaders,
  checkSuperAdminRateLimit,
  recordFailedSuperAdminAttempt,
  recordSuccessfulSuperAdminAttempt,
  type RequestAuth,
} from '../api/local-api-server.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { isValidAdminWebSecret, getApiAuthToken } from '../../08_SECURITY/install-secrets.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import type { CreateProfileDTO, UpdateProfileDTO } from '../../10_CONFIG/shared/types/profile.js';
import type { CreateProxyDTO } from '../../10_CONFIG/shared/types/proxy.js';
import type { FeatureFlagDefinition } from '../../10_CONFIG/shared/types/platform.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('app');

interface ResponseWithReq extends http.ServerResponse {
  __req?: http.IncomingMessage;
}

type AuthBodyLike = { adminSecret?: unknown; secret?: unknown } & Record<string, unknown>;

function toErrMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  const req = (res as ResponseWithReq).__req;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendHTML(res: http.ServerResponse, statusCode: number, html: string) {
  const req = (res as ResponseWithReq).__req;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    ...buildHtmlSecurityHeaders(html),
    ...corsHeaders,
  });
  res.end(html);
}

async function sendFile(res: http.ServerResponse, filePath: string, filename: string): Promise<void> {
  const req = (res as ResponseWithReq).__req;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders });
      res.end(`File not found: ${filename}`);
      return;
    }
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders });
    res.end(`File not found: ${filename}`);
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${filename}"`,
    ...corsHeaders,
  });
  pipeReadStream(filePath, res);
}

async function resolveSafeFileAsync(
  baseDir: string,
  relPath: string
): Promise<{ filePath: string; size: number } | null> {
  const resolvedBase = path.resolve(baseDir);
  const candidate = path.resolve(resolvedBase, relPath);
  if (candidate !== resolvedBase && !candidate.startsWith(`${resolvedBase}${path.sep}`)) {
    return null;
  }
  try {
    const stat = await fs.promises.stat(candidate);
    if (!stat.isFile()) return null;
    return { filePath: candidate, size: stat.size };
  } catch {
    return null;
  }
}

async function sendTextFileIfExistsAsync(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  filePath: string,
  contentType: string
): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      ...getCorsHeaders(req),
    });
    pipeReadStream(filePath, res);
    return true;
  } catch {
    return false;
  }
}

async function sendHtmlCandidatesIfExistsAsync(
  res: http.ServerResponse,
  candidates: string[]
): Promise<boolean> {
  for (const candidate of candidates) {
    try {
      const html = await fs.promises.readFile(candidate, 'utf8');
      sendHTML(res, 200, html);
      return true;
    } catch {
      // Try next fallback file path
    }
  }
  return false;
}

function requireUserOrAdminAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  body?: AuthBodyLike,
  requiredScope?: string
): RequestAuth | null {
  const auth = authenticateRequest(req, parsedUrl, body);
  if (!auth.authenticated) {
    sendJSON(res, 401, { success: false, error: 'Unauthorized. Authentication credentials required.' });
    return null;
  }
  if (requiredScope && auth.role !== 'master_admin') {
    const scopes = Array.isArray(auth.scopes) ? auth.scopes : [];
    if (!scopes.includes('*') && !scopes.includes(requiredScope)) {
      sendJSON(res, 403, { success: false, error: `Forbidden. Missing required scope: ${requiredScope}` });
      return null;
    }
  }
  return auth;
}

function requireMasterAdminAuth(req: http.IncomingMessage, res: http.ServerResponse, parsedUrl: URL, body?: AuthBodyLike): RequestAuth | null {
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

function pipeReadStream(filePath: string, res: http.ServerResponse): http.ServerResponse {
  const stream = fs.createReadStream(filePath);
  stream.on('error', (err: NodeJS.ErrnoException) => {
    log.error('[StaticStream] Error streaming file:', filePath, err?.message || err);
    if (!res.headersSent) {
      res.writeHead(err?.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to read file' }));
    } else if (!res.writableEnded && !res.destroyed) {
      res.destroy(err);
    }
  });
  res.on('close', () => {
    if (!stream.destroyed) {
      stream.destroy();
    }
  });
  return stream.pipe(res);
}

function parseBody<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  return parseBoundedJson<T>(req, { invalidJsonMessage: 'Invalid JSON payload' });
}

function resolveCleanPath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export async function handlePortalAndStaticRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _parsedUrl: URL,
  cleanPath: string,
  method: string
): Promise<boolean> {
  const landingBase = getLandingBaseDir();

  // Static assets from landing/out/assets, landing/public/assets or landing/assets
  if (cleanPath.startsWith('/assets/') && method === 'GET') {
    const relPath = cleanPath.substring(8);
    const assetDirs = [
      path.join(landingBase, 'out', 'assets'),
      path.join(landingBase, 'public', 'assets'),
      path.join(landingBase, 'assets'),
    ];
    for (const dir of assetDirs) {
      const found = await resolveSafeFileAsync(dir, relPath);
      if (found) {
        const ext = path.extname(found.filePath).toLowerCase();
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
          'Content-Length': found.size,
          'Cache-Control': 'public, max-age=3600',
          ...getCorsHeaders(req),
        });
        pipeReadStream(found.filePath, res);
        return true;
      }
    }
  }

  // Static Next.js assets from landing/out/_next
  if (cleanPath.startsWith('/_next/') && method === 'GET') {
    const relPath = cleanPath.substring(7);
    const found = await resolveSafeFileAsync(path.join(landingBase, 'out', '_next'), relPath);
    if (found) {
      const ext = path.extname(found.filePath).toLowerCase();
      const nextMimeMap: Record<string, string> = {
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.txt': 'text/plain; charset=utf-8',
        '.map': 'application/json',
      };
      const mime = nextMimeMap[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': found.size,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...getCorsHeaders(req),
      });
      pipeReadStream(found.filePath, res);
      return true;
    }
  }

  // Next.js static sitemap & robots
  if (cleanPath === '/sitemap.xml' && method === 'GET') {
    if (await sendTextFileIfExistsAsync(req, res, path.join(landingBase, 'out', 'sitemap.xml'), 'application/xml; charset=utf-8')) {
      return true;
    }
  }

  if (cleanPath === '/robots.txt' && method === 'GET') {
    if (await sendTextFileIfExistsAsync(req, res, path.join(landingBase, 'out', 'robots.txt'), 'text/plain; charset=utf-8')) {
      return true;
    }
  }

  // Mapped static HTML pages (Next.js export + legacy root fallbacks)
  if (method === 'GET') {
    const htmlRouteMap: Record<string, string[]> = {
      '/privacy': [path.join(landingBase, 'out', 'privacy.html'), path.join(landingBase, 'privacy.html')],
      '/terms': [path.join(landingBase, 'out', 'terms.html'), path.join(landingBase, 'terms.html')],
      '/aup': [path.join(landingBase, 'out', 'aup.html'), path.join(landingBase, 'aup.html')],
      '/pricing': [path.join(landingBase, 'out', 'pricing.html'), path.join(landingBase, 'pricing.html')],
      '/compare/gologin-alternative': [path.join(landingBase, 'out', 'compare', 'gologin-alternative.html')],
      '/docs': [path.join(landingBase, 'out', 'docs.html')],
      '/blog': [path.join(landingBase, 'out', 'blog.html')],
      '/signup': [path.join(landingBase, 'signup.html')],
      '/login': [path.join(landingBase, 'login.html')],
      '/book-demo': [path.join(landingBase, 'book-demo.html')],
      '': [path.join(landingBase, 'index.html')],
      '/': [path.join(landingBase, 'index.html')],
    };

    if (htmlRouteMap[cleanPath]) {
      if (await sendHtmlCandidatesIfExistsAsync(res, htmlRouteMap[cleanPath])) {
        return true;
      }
    }

    if (cleanPath.startsWith('/docs/')) {
      const slug = cleanPath.replace(/^\/docs\/?/, '').replace(/\/$/, '');
      if (slug && !slug.includes('..') && !slug.includes('/') && !slug.includes('\\')) {
        if (await sendHtmlCandidatesIfExistsAsync(res, [path.join(landingBase, 'out', 'docs', `${slug}.html`)])) {
          return true;
        }
      }
    }

    if (cleanPath.startsWith('/blog/')) {
      const slug = cleanPath.replace(/^\/blog\/?/, '').replace(/\/$/, '');
      if (slug && !slug.includes('..') && !slug.includes('/') && !slug.includes('\\')) {
        if (await sendHtmlCandidatesIfExistsAsync(res, [path.join(landingBase, 'out', 'blog', `${slug}.html`)])) {
          return true;
        }
      }
    }
  }

  // 0. Secret Super Admin Console & Owner Zone
  if (cleanPath === '/super-admin' && method === 'GET') {
    if (isLocalSuperAdminEnabled() && !process.env.MAHI_IS_GATEWAY && !isPostgresConfigured()) {
      sendHTML(res, 200, getSuperAdminHtml());
      return true;
    }
    sendHTML(res, 200, getOwnerAdminHtml());
    return true;
  }
  if ((cleanPath === '/root-admin' || cleanPath === '/master-admin') && method === 'GET') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
      return true;
    }
    sendHTML(res, 200, getSuperAdminHtml());
    return true;
  }

  // 0. Standalone Web Admin Control Center UI (Restricted to /admin and /web)
  if ((cleanPath === '/admin' || cleanPath === '/web') && method === 'GET') {
    sendHTML(res, 200, getWebAdminHtml());
    return true;
  }

  // 0. Customer Account & Onboarding Dashboard + Client Download Portal
  if (
    (cleanPath === '/dashboard' ||
      cleanPath === '/download' ||
      cleanPath === '/install' ||
      cleanPath === '/client' ||
      cleanPath === '/setup' ||
      cleanPath === '/get' ||
      cleanPath === '/app') &&
    method === 'GET'
  ) {
    if (await sendHtmlCandidatesIfExistsAsync(res, [path.join(landingBase, 'download.html')])) {
      return true;
    }
    const info = getDistributionInfo();
    sendHTML(res, 200, getDownloadPortalHtml(info));
    return true;
  }

  return false;
}

export async function handleBinaryDownloadRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  cleanPath: string
): Promise<boolean> {
  // Direct File Downloads: Setup, Portable executables, and MAHI-Setup.exe (Verified token & entitlement required)
  if (
    cleanPath === '/download/setup' ||
    cleanPath === '/api/v2/download/setup' ||
    cleanPath === '/download/MAHI-Setup.exe'
  ) {
    const dlAuth = await verifyDownloadAccess(req, parsedUrl);
    if (!dlAuth.authorized) {
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') && dlAuth.status === 401) {
        res.writeHead(302, { Location: '/signup?intent=trial&returnUrl=/download' });
        res.end();
        return true;
      }
      sendJSON(res, dlAuth.status, {
        success: false,
        error: dlAuth.reason || 'Unauthorized. Authentication required to download installer.',
      });
      return true;
    }

    const info = getDistributionInfo();
    await sendFile(res, info.setupPath, info.setupFileName);
    return true;
  }

  if (cleanPath === '/download/portable' || cleanPath === '/api/v2/download/portable') {
    const dlAuth = await verifyDownloadAccess(req, parsedUrl);
    if (!dlAuth.authorized) {
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') && dlAuth.status === 401) {
        res.writeHead(302, { Location: '/signup?intent=trial&returnUrl=/download' });
        res.end();
        return true;
      }
      sendJSON(res, dlAuth.status, {
        success: false,
        error: dlAuth.reason || 'Unauthorized. Authentication required to download portable executable.',
      });
      return true;
    }

    const info = getDistributionInfo();
    await sendFile(res, info.portablePath, info.portableFileName);
    return true;
  }

  return false;
}

export async function handleCentralV2Routes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  pathname: string,
  cleanPath: string,
  method: string
): Promise<boolean> {
  // Super Admin dynamic secret verification endpoint
  if (pathname === '/api/v2/super-admin/auth/verify' && method === 'POST') {
    const clientIp = req.socket?.remoteAddress || '127.0.0.1';
    if (!checkSuperAdminRateLimit(clientIp)) {
      sendJSON(res, 429, { success: false, error: 'Too many failed authentication attempts. Please try again later.' });
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

  // Distribution Metadata API
  if (pathname === '/api/v2/distribution/info' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getDistributionInfo() });
    return true;
  }

  // Shortcut Repair API (Authenticated master admin required)
  if (pathname === '/api/v2/system/fix-shortcuts' && method === 'POST') {
    if (!requireMasterAdminAuth(req, res, parsedUrl)) return true;
    const result = await fixDesktopShortcuts();
    sendJSON(res, 200, result);
    return true;
  }

  // Health Endpoint (minimal public response, zero info leak)
  if (cleanPath === '/health' || cleanPath === '/api/v2/health') {
    sendJSON(res, 200, {
      status: 'HEALTHY',
      ok: true,
    });
    return true;
  }

  // Feature Flags
  if (pathname === '/api/v2/feature-flags' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getFeatureFlags() });
    return true;
  }

  const flagMatch = pathname.match(/^\/api\/v2\/feature-flags\/([a-zA-Z0-9_-]+)$/);
  if (flagMatch && method === 'PUT') {
    const body = await parseBody<Partial<FeatureFlagDefinition> & AuthBodyLike>(req);
    if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return true;
    const flagKey = flagMatch[1];
    const updated = updateFeatureFlag(flagKey, body);
    sendJSON(res, 200, { success: true, data: updated });
    return true;
  }

  // Profiles Endpoint
  if (pathname === '/api/v2/profiles' && method === 'GET') {
    const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read');
    if (!auth) return true;
    const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
    sendJSON(res, 200, { success: true, data: getProfiles(ownerId ? { ownerId } : {}) });
    return true;
  }

  if (pathname === '/api/v2/profiles' && method === 'POST') {
    try {
      const body = await parseBody<CreateProfileDTO & AuthBodyLike>(req);
      const auth = requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write');
      if (!auth) return true;
      const ownerId = auth.userId || getLocalApiOwnerId();
      const effectiveOwnerId = (auth.role === 'master_admin' && body.ownerId) ? body.ownerId : ownerId;
      assertCanCreateProfile(1, effectiveOwnerId);
      const profile = createProfile({ ...body, ownerId: effectiveOwnerId });
      sendJSON(res, 201, { success: true, data: profile });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: getErrorStatusCode(err, 400) });
    }
    return true;
  }

  // Single profile route: /api/v2/profiles/:id
  const profileMatch = pathname.match(/^\/api\/v2\/profiles\/([a-zA-Z0-9_-]+)$/);
  if (profileMatch) {
    const profileId = profileMatch[1];
    if (method === 'GET') {
      const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:read');
      if (!auth) return true;
      const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
      const profile = getProfileById(profileId, ownerId);
      if (!profile) {
        sendJSON(res, 404, { success: false, error: 'Profile not found' });
        return true;
      }
      sendJSON(res, 200, { success: true, data: profile });
      return true;
    }
    if (method === 'PUT') {
      const body = await parseBody<UpdateProfileDTO & AuthBodyLike>(req);
      const auth = requireUserOrAdminAuth(req, res, parsedUrl, body, 'profiles:write');
      if (!auth) return true;
      const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
      const existing = getProfileById(profileId, ownerId);
      if (!existing) {
        sendJSON(res, 404, { success: false, error: 'Profile not found' });
        return true;
      }
      const updated = updateProfile(profileId, body, ownerId);
      sendJSON(res, 200, { success: true, data: updated });
      return true;
    }
    if (method === 'DELETE') {
      const auth = requireUserOrAdminAuth(req, res, parsedUrl, undefined, 'profiles:write');
      if (!auth) return true;
      const ownerId = auth.role === 'master_admin' ? undefined : (auth.userId || getLocalApiOwnerId());
      const existing = getProfileById(profileId, ownerId);
      if (!existing) {
        sendJSON(res, 404, { success: false, error: 'Profile not found' });
        return true;
      }
      const ok = deleteProfile(profileId, ownerId);
      sendJSON(res, 200, { success: ok });
      return true;
    }
  }

  // Profile Launch / Stop: /api/v2/profiles/:id/start & /api/v2/profiles/:id/stop
  const profileActionMatch = pathname.match(/^\/api\/v2\/profiles\/([a-zA-Z0-9_-]+)\/(start|stop|clone)$/);
  if (profileActionMatch && method === 'POST') {
    const body = await parseBody<{ name?: string } & AuthBodyLike>(req);
    const action = profileActionMatch[2];
    const requiredScope = action === 'clone' ? 'profiles:write' : 'profiles:launch';
    const auth = requireUserOrAdminAuth(req, res, parsedUrl, body, requiredScope);
    if (!auth) return true;
    const profileId = profileActionMatch[1];

    if (action === 'start') {
      const result = await processManager.startProfile(profileId);
      const cdpPort = processManager.getDebugPort(profileId) ?? (processManager.isRunning(profileId) ? undefined : getProfileDebugPort(profileId));
      sendJSON(res, result.success ? 200 : 500, cdpPort ? { ...result, cdpPort } : { ...result, cdpDisabled: true });
      return true;
    }
    if (action === 'stop') {
      const result = await processManager.stopProfile(profileId);
      sendJSON(res, result.success ? 200 : 500, result);
      return true;
    }
    if (action === 'clone') {
      try {
        const ownerId = auth.userId || getLocalApiOwnerId();
        assertCanCreateProfile(1, ownerId);
        const cloned = cloneProfile(profileId, body.name || undefined, ownerId);
        sendJSON(res, 201, { success: true, data: cloned });
      } catch (err: unknown) {
        sendSafeError(res, err, { fallbackStatus: 400 });
      }
      return true;
    }
  }

  // Folders
  if (pathname === '/api/v2/folders' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getFolders() });
    return true;
  }
  if (pathname === '/api/v2/folders' && method === 'POST') {
    const body = await parseBody<{ name: string; parentId?: string | null; color?: string; icon?: string } & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body)) return true;
    const folder = createFolder(body.name, body.parentId, body.color, body.icon);
    sendJSON(res, 201, { success: true, data: folder });
    return true;
  }

  // Proxies
  if (pathname === '/api/v2/proxies' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getProxies() });
    return true;
  }
  if (pathname === '/api/v2/proxies' && method === 'POST') {
    const body = await parseBody<CreateProxyDTO & AuthBodyLike>(req);
    if (!requireUserOrAdminAuth(req, res, parsedUrl, body)) return true;
    const proxy = createProxy(body);
    sendJSON(res, 201, { success: true, data: proxy });
    return true;
  }

  // Fleet Telemetry & Devices
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

  // Developer API Keys (Shared scope + ownership hardened handler)
  if (await handleApiKeysV2Route(req, res, pathname, method, parsedUrl)) {
    return true;
  }

  // License Management & Minting Endpoints (Web Admin & Super Admin)
  if (pathname === '/api/v2/licenses' && method === 'GET') {
    if (!requireMasterAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getLicenses() });
    return true;
  }

  if (pathname === '/api/v2/licenses/revoke' && method === 'POST') {
    const body = await parseBody<{ licenseId: string; reason?: string } & AuthBodyLike>(req);
    if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return true;
    try {
      const ok = await revokeLicense(body.licenseId, body.reason || 'Revoked from Web Admin');
      sendJSON(res, 200, { success: ok });
    } catch (e: unknown) {
      log.error('[LicenseEngine][CRITICAL] admin license op failed', toErrMsg(e));
      sendJSON(res, 500, { success: false, error: 'License operation failed.' });
    }
    return true;
  }

  if (pathname === '/api/v2/licenses/extend' && method === 'POST') {
    const body = await parseBody<{ licenseId: string; additionalDays?: string | number } & AuthBodyLike>(req);
    if (!requireMasterAdminAuth(req, res, parsedUrl, body)) return true;
    try {
      const record = await extendLicense({
        licenseId: body.licenseId,
        additionalDays: parseInt(String(body.additionalDays ?? ''), 10) || 30,
      });
      if (!record) {
        sendJSON(res, 404, { success: false, error: 'License not found' });
        return true;
      }
      sendJSON(res, 200, { success: true, data: record });
    } catch (e: unknown) {
      log.error('[LicenseEngine][CRITICAL] admin license op failed', toErrMsg(e));
      sendJSON(res, 500, { success: false, error: 'License operation failed.' });
    }
    return true;
  }

  // Super Admin License List & Action
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
      sendSafeError(res, err, { fallbackStatus: 500 });
    }
    return true;
  }

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
      sendSafeError(res, err, { fallbackStatus: getErrorStatusCode(err, 500) });
    }
    return true;
  }

  // Super Admin Raw SQLite Table Explorer
  const tableMatch = pathname.match(/^\/api\/v2\/super-admin\/db\/table\/([a-zA-Z0-9_]+)$/);
  if (tableMatch && method === 'GET') {
    if (!isLocalSuperAdminEnabled()) {
      sendJSON(res, 403, { success: false, error: 'Local Super Admin interface is disabled.' });
      return true;
    }
    if (!requireMasterAdminAuth(req, res, parsedUrl)) return true;
    const tableName = tableMatch[1];
    const allowedTables = ['profiles', 'profile_folders', 'profile_locks', 'fleet_devices', 'feature_flags', 'api_keys_v2', 'proxies', 'activity_logs', 'workspaces', 'licenses'];
    if (!allowedTables.includes(tableName)) {
      sendJSON(res, 400, { success: false, error: 'Table access not permitted' });
      return true;
    }
    try {
      const db = getDatabase();
      const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 100`).all();
      sendJSON(res, 200, { success: true, data: rows });
    } catch (dbErr: unknown) {
      sendSafeError(res, dbErr, { fallbackStatus: 500 });
    }
    return true;
  }

  // Activity Logs
  if (pathname === '/api/v2/logs' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    sendJSON(res, 200, { success: true, data: getActivityLogs() });
    return true;
  }

  // License validation
  if (pathname === '/api/v2/license/status' && method === 'GET') {
    if (!requireUserOrAdminAuth(req, res, parsedUrl)) return true;
    const status = validateCurrentLicense();
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  return false;
}

export async function handleCentralApiRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  (res as ResponseWithReq).__req = req;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(req);
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const pathname = parsedUrl.pathname;
  const cleanPath = resolveCleanPath(pathname);
  const method = req.method?.toUpperCase() || 'GET';

  try {
    if (await handleCommercialApiRoutes(req, res, pathname, method, parsedUrl)) {
      return;
    }

    if (await handlePortalAndStaticRoutes(req, res, parsedUrl, cleanPath, method)) {
      return;
    }

    if (await handleBinaryDownloadRoutes(req, res, parsedUrl, cleanPath)) {
      return;
    }

    if (await handleCentralV2Routes(req, res, parsedUrl, pathname, cleanPath, method)) {
      return;
    }

    sendJSON(res, 404, { success: false, error: `Route ${method} ${pathname} not found` });
  } catch (err: unknown) {
    sendSafeError(res, err, { fallbackStatus: getErrorStatusCode(err, 500) });
  }
}

export function createCentralApiServer(): http.Server {
  return http.createServer(handleCentralApiRequest);
}
