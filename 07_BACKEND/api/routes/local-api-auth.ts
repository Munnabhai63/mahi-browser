import type http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { app } from '../../../08_SECURITY/electron-bridge.js';
import { resolveTrustedClientIp, parseBoundedJson } from '../../utils/http-security.js';
import { verifyAdminAccess } from '../../../05_AUTH/admin-auth.js';
import { verifyAccessToken, getCentralUserByIdAsync } from '../../../05_AUTH/central-auth-service.js';
import { buildHtmlSecurityHeaders } from '../../utils/security-headers.js';
import { validateApiKey } from '../../services/api-v2-service.js';
import { verifyToken, getUserById } from '../../commercial/commercial-auth-service.js';
import { evaluateUserEntitlements } from '../../commercial/commercial-entitlement-service.js';
import { isValidApiToken, isValidAdminWebSecret } from '../../../08_SECURITY/install-secrets.js';
import { getAccountSession } from '../../../08_SECURITY/account-service.js';
import { getActiveUserId } from '../../commercial/session-context.js';
import { createLogger } from '../../utils/logger.js';

export const log = createLogger('local-api-server');

export function getLocalApiOwnerId(): string {
  const activeUser = getActiveUserId();
  if (activeUser) return activeUser;
  const session = getAccountSession();
  if (session?.account_id) return session.account_id;
  return 'SYSTEM_OWNER';
}

const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/127\.0\.0\.1(:[0-9]+)?$/,
  /^http:\/\/localhost(:[0-9]+)?$/,
  /^app:\/\//,
  /^file:\/\//,
];

export function isAppPackaged(): boolean {
  try {
    return Boolean(app?.isPackaged);
  } catch {
    return false;
  }
}

export function isLocalSuperAdminEnabled(): boolean {
  if (isAppPackaged()) {
    return process.env.MAHI_ENABLE_LOCAL_SUPER_ADMIN === '1';
  }
  return (
    process.env.MAHI_ENABLE_LOCAL_SUPER_ADMIN === '1' ||
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test'
  );
}

interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
}

const superAdminRateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export function resetSuperAdminRateLimitForTesting(): void {
  superAdminRateLimitMap.clear();
}

export function getClientIp(req: http.IncomingMessage): string {
  return resolveTrustedClientIp(req);
}

export function checkSuperAdminRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = superAdminRateLimitMap.get(ip);
  if (!record) return true;
  if (now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    superAdminRateLimitMap.delete(ip);
    return true;
  }
  return record.attempts < RATE_LIMIT_MAX_ATTEMPTS;
}

export function recordFailedSuperAdminAttempt(ip: string): void {
  const now = Date.now();
  const record = superAdminRateLimitMap.get(ip);
  if (!record || now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    superAdminRateLimitMap.set(ip, { attempts: 1, firstAttemptAt: now });
  } else {
    record.attempts += 1;
  }
}

export function recordSuccessfulSuperAdminAttempt(ip: string): void {
  superAdminRateLimitMap.delete(ip);
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function getCorsHeaders(req: http.IncomingMessage): Record<string, string> {
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

export function isValidHost(host: string | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(':')[0].toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

export type AuthRole = 'master_admin' | 'user';

export interface RequestAuth {
  authenticated: boolean;
  role?: AuthRole;
  userId?: string;
  scopes?: string[];
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export type AuthBodyLike = { adminSecret?: unknown; secret?: unknown } & Record<string, unknown>;

export interface ResponseWithReq extends http.ServerResponse {
  __req?: http.IncomingMessage;
}

export function toErrMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function authenticateRequest(
  req: http.IncomingMessage,
  _parsedUrl: URL,
  body?: AuthBodyLike
): RequestAuth {
  // 1. Check Master Admin Secret first (Headers or JSON body only — never query strings)
  const bodySecret =
    body &&
    (typeof body.adminSecret === 'string'
      ? body.adminSecret
      : typeof body.secret === 'string'
        ? body.secret
        : '');
  const adminSecret = (req.headers['x-admin-secret'] as string) || bodySecret;
  if (adminSecret && (verifyAdminAccess(adminSecret) || isValidAdminWebSecret(adminSecret))) {
    if (isAppPackaged() && process.env.MAHI_ENABLE_LOCAL_SUPER_ADMIN !== '1') {
      return { authenticated: false };
    }
    return { authenticated: true, role: 'master_admin', userId: 'MASTER_ADMIN', scopes: ['*'] };
  }

  // 2. Bearer / X-Mahi-Token headers only (never query strings)
  const authHeader = req.headers.authorization;
  let bearer = '';
  if (authHeader) {
    bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  const headerMahiToken = ((req.headers['x-mahi-token'] as string) || '').trim();
  const tokenToTest = bearer || headerMahiToken;

  if (tokenToTest) {
    if (isValidApiToken(tokenToTest)) {
      if (isAppPackaged() && process.env.MAHI_ENABLE_LOCAL_SUPER_ADMIN !== '1') {
        // In packaged builds, local daemon token grants scoped automation/extension client access only (never master_admin).
        return {
          authenticated: true,
          role: 'user',
          userId: getLocalApiOwnerId(),
          scopes: [
            'profiles:read',
            'profiles:write',
            'profiles:launch',
            'proxies:read',
            'proxies:write',
            'automation:run',
            'sync:read',
            'sync:write',
            'rotator:read',
            'rotator:write',
          ],
        };
      }
      return { authenticated: true, role: 'master_admin', userId: 'MASTER_ADMIN', scopes: ['*'] };
    }
    try {
      const session = getAccountSession();
      if (session?.token && safeEqualStrings(session.token, tokenToTest)) {
        return { authenticated: true, role: 'user', userId: session.account_id || 'USER', scopes: ['*'] };
      }
    } catch (err) {
      log.debug('Account session check failed in local API auth', {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    const bearerApiKeyCheck = validateApiKey(tokenToTest);
    if (bearerApiKeyCheck) {
      return {
        authenticated: true,
        role: 'user',
        userId: bearerApiKeyCheck.userId || 'API_USER',
        scopes: bearerApiKeyCheck.scopes,
      };
    }
  }

  // 3. API Key header only (never query strings)
  const apiKey = ((req.headers['x-api-key'] as string) || '').trim();
  if (apiKey) {
    const keyCheck = validateApiKey(apiKey);
    if (keyCheck) {
      return {
        authenticated: true,
        role: 'user',
        userId: keyCheck.userId || 'API_USER',
        scopes: keyCheck.scopes,
      };
    }
  }

  return { authenticated: false };
}

export async function verifyDownloadAccess(
  req: http.IncomingMessage,
  parsedUrl: URL
): Promise<{ authorized: boolean; status: 401 | 403; reason?: string }> {
  const localAuth = authenticateRequest(req, parsedUrl);
  if (localAuth.authenticated) {
    return { authorized: true, status: 401 };
  }

  const authHeader = req.headers.authorization || '';
  const mahiHeader = (req.headers['x-mahi-token'] as string) || '';
  const cookieMatch = req.headers.cookie?.match(/(?:^|;\s*)mahi_token=([^;]+)/)?.[1];
  let cookieToken = '';
  if (cookieMatch) {
    try {
      cookieToken = decodeURIComponent(cookieMatch).trim();
    } catch {
      cookieToken = cookieMatch.trim();
    }
  }
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const jwtCandidate = bearerToken || mahiHeader.trim() || cookieToken;

  if (!jwtCandidate) {
    return { authorized: false, status: 401, reason: 'Authentication credentials required to download installer.' };
  }

  const centralPayload = verifyAccessToken(jwtCandidate);
  const commPayload = centralPayload ? null : verifyToken(jwtCandidate);
  const userId = centralPayload?.userId || commPayload?.userId;
  if (!userId) {
    return { authorized: false, status: 401, reason: 'Invalid or expired download session token.' };
  }

  const centralRecord = await getCentralUserByIdAsync(userId).catch(() => null);
  const commRecord = getUserById(userId);
  if (!centralRecord && !commRecord) {
    return { authorized: false, status: 401, reason: 'Account not found for download token.' };
  }

  const accountStatus = centralRecord?.status || commRecord?.status;
  if (accountStatus && accountStatus !== 'ACTIVE') {
    return { authorized: false, status: 403, reason: `Account is ${accountStatus}. Download forbidden.` };
  }

  const entitlements = evaluateUserEntitlements(userId);
  if (!entitlements?.planId) {
    return { authorized: false, status: 403, reason: 'Valid account entitlement required to download installer.' };
  }

  return { authorized: true, status: 401 };
}

export function checkMutatingAuth(req: http.IncomingMessage, parsedUrl: URL, body?: AuthBodyLike): boolean {
  return authenticateRequest(req, parsedUrl, body).authenticated;
}

export function requireUserOrAdminAuth(
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

export function requireMasterAdminAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL,
  body?: AuthBodyLike
): RequestAuth | null {
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

export function sendHTML(res: http.ServerResponse, statusCode: number, html: string): void {
  const req = (res as ResponseWithReq).__req;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    ...buildHtmlSecurityHeaders(html),
    ...corsHeaders,
  });
  res.end(html);
}

export function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const req = (res as ResponseWithReq).__req;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  });
  res.end(JSON.stringify(data));
}

export async function sendFile(res: http.ServerResponse, filePath: string, downloadName: string): Promise<void> {
  const req = (res as ResponseWithReq).__req;
  const corsHeaders = req ? getCorsHeaders(req) : {};
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      sendJSON(res, 404, { success: false, error: 'File not found. Build installers first using npm run dist.' });
      return;
    }
  } catch {
    sendJSON(res, 404, { success: false, error: 'File not found. Build installers first using npm run dist.' });
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${downloadName}"`,
    'Content-Length': stat.size,
    ...corsHeaders,
  });
  const stream = fs.createReadStream(filePath);
  stream.on('error', (err: NodeJS.ErrnoException) => {
    log.error('[LocalApi] Error streaming download file:', filePath, err?.message || err);
    if (!res.headersSent) {
      sendJSON(res, err?.code === 'ENOENT' ? 404 : 500, { success: false, error: 'Failed to stream installer file.' });
    } else if (!res.writableEnded && !res.destroyed) {
      res.destroy(err);
    }
  });
  res.on('close', () => {
    if (!stream.destroyed) {
      stream.destroy();
    }
  });
  stream.pipe(res);
}

export function parseBody<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  return parseBoundedJson<T>(req, { invalidJsonMessage: 'Invalid JSON in request body' });
}

export interface CdpEndpointResolution {
  httpEndpoint: string;
  wsEndpoint: string;
  live: boolean;
}

/**
 * Resolves the live Chromium WebSocket debugger URL from /json/version on 127.0.0.1:<port>.
 * Falls back cleanly to the canonical devtools browser base URL on timeout or unreachable port.
 */
export async function resolveCdpWebSocketEndpoint(
  debugPort: number,
  options: { timeoutMs?: number; pollIntervalMs?: number; probeTimeoutMs?: number } = {}
): Promise<CdpEndpointResolution> {
  const httpEndpoint = `http://127.0.0.1:${debugPort}`;
  const fallbackWs = `ws://127.0.0.1:${debugPort}/devtools/browser`;
  const timeoutMs = options.timeoutMs ?? 2500;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const probeTimeoutMs = options.probeTimeoutMs ?? 600;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const res = await fetch(`${httpEndpoint}/json/version`, {
        signal: AbortSignal.timeout(probeTimeoutMs),
      });
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (
          typeof data?.webSocketDebuggerUrl === 'string' &&
          (data.webSocketDebuggerUrl.startsWith('ws://') || data.webSocketDebuggerUrl.startsWith('wss://'))
        ) {
          return {
            httpEndpoint,
            wsEndpoint: data.webSocketDebuggerUrl,
            live: true,
          };
        }
      }
    } catch (pollErr) {
      log.debug('Waiting for local profile CDP endpoint readiness', {
        httpEndpoint,
        err: pollErr instanceof Error ? pollErr.message : String(pollErr),
      });
    }

    if (Date.now() + pollIntervalMs > deadline) {
      break;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return {
    httpEndpoint,
    wsEndpoint: fallbackWs,
    live: false,
  };
}
