import http from 'node:http';
import { DEFAULT_LOCAL_DAEMON_PORT } from '../../10_CONFIG/shared/network-endpoints.js';
import { getAppSettings } from '../services/settings-service.js';
import { getErrorStatusCode } from '../utils/http-security.js';
import { sanitizeError } from '../../08_SECURITY/sanitizer.js';
import { handleCommercialApiRoutes } from '../commercial/commercial-api-router.js';
import {
  log,
  type ResponseWithReq,
  isValidHost,
  getCorsHeaders,
  checkMutatingAuth,
  sendJSON,
} from './routes/local-api-auth.js';
import {
  handleV2AndPortalRoutes,
  handleLegacyLicenseAndAdminRoutes,
} from './routes/local-api-admin-routes.js';
import {
  handleStartAutomationRoute,
  handleV2ProfilesRoutes,
  handleLegacyProfilesRoutes,
} from './routes/local-api-profiles-routes.js';
import {
  handleProxyAndEngineRoutes,
  handleSyncAndRotatorRoutes,
} from './routes/local-api-proxy-sync-routes.js';

export {
  getLocalApiOwnerId,
  isAppPackaged,
  isLocalSuperAdminEnabled,
  resetSuperAdminRateLimitForTesting,
  checkSuperAdminRateLimit,
  recordFailedSuperAdminAttempt,
  recordSuccessfulSuperAdminAttempt,
  isOriginAllowed,
  getCorsHeaders,
  type AuthRole,
  type RequestAuth,
  type AuthBodyLike,
  authenticateRequest,
  verifyDownloadAccess,
  type CdpEndpointResolution,
  resolveCdpWebSocketEndpoint,
} from './routes/local-api-auth.js';

export { handleApiKeysV2Route } from './routes/local-api-admin-routes.js';

let apiServer: http.Server | null = null;

export async function handleLocalApiRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  (res as ResponseWithReq).__req = req;

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

  if (await handleStartAutomationRoute(req, res, pathname, method, parsedUrl)) {
    return;
  }

  // Commercial API Layer (/api/v1/*)
  if (await handleCommercialApiRoutes(req, res, pathname, method, parsedUrl)) {
    return;
  }

  if (await handleV2AndPortalRoutes(req, res, pathname, cleanPath, method, parsedUrl)) {
    return;
  }

  if (await handleV2ProfilesRoutes(req, res, pathname, method, parsedUrl)) {
    return;
  }

  // Authenticate Bearer token for Legacy REST endpoints (Header, API Key, or Admin secret)
  if (!checkMutatingAuth(req, parsedUrl)) {
    sendJSON(res, 401, { error: 'Unauthorized. Invalid or missing authentication credentials.' });
    return;
  }

  try {
    if (await handleLegacyProfilesRoutes(req, res, pathname, method, parsedUrl)) {
      return;
    }

    if (await handleProxyAndEngineRoutes(req, res, pathname, method, parsedUrl)) {
      return;
    }

    if (await handleLegacyLicenseAndAdminRoutes(req, res, pathname, method, parsedUrl)) {
      return;
    }

    if (await handleSyncAndRotatorRoutes(req, res, pathname, method, parsedUrl)) {
      return;
    }

    sendJSON(res, 404, { error: `Endpoint ${method} ${pathname} not found` });
  } catch (err: unknown) {
    sendJSON(res, getErrorStatusCode(err, 500), { error: sanitizeError(err) });
  }
}

export function createLocalApiServer(): http.Server {
  return http.createServer(handleLocalApiRequest);
}

export function startApiServer(): void {
  const settings = getAppSettings();
  if (!settings.advanced.apiServerEnabled) {
    return;
  }

  if (apiServer) {
    try {
      apiServer.close();
    } catch (closeErr) {
      log.debug('Previous local API server close skipped', {
        err: closeErr instanceof Error ? closeErr.message : String(closeErr),
      });
    }
  }

  const port = settings.advanced.apiPort || DEFAULT_LOCAL_DAEMON_PORT;

  apiServer = createLocalApiServer();

  apiServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err && err.code === 'EADDRINUSE') {
      log.warn(`[API Server] Port ${port} is already in use. Skipping duplicate server bind.`);
    } else {
      log.error('[API Server] Error:', err);
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
    } catch (closeErr) {
      log.debug('Local API server close skipped on stop', {
        err: closeErr instanceof Error ? closeErr.message : String(closeErr),
      });
    }
    apiServer = null;
  }
}
