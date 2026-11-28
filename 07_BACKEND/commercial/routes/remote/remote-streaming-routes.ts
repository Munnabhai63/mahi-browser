import crypto from 'node:crypto';
import { isTrustedOrigin } from '../../../utils/http-security.js';
import {
  cloudBrowserControlPlane,
  sessionGateway,
  sessionScheduler,
  resourceLimiter,
} from '../../../cloud-browser/index.js';
import { mobileCompanionService } from '../../../services/mobile-companion-service.js';
import { parseBody, sendRemoteJSON, type RemoteRouteContext } from './remote-shared.js';
import type { CloudClientAction, CloudResourceClass } from '../../../../10_CONFIG/shared/types/cloud-browser.js';
import type { MobileNotificationPreferences } from '../../../../10_CONFIG/shared/types/mobile.js';
import { createLogger } from '../../../utils/logger.js';

const log = createLogger('remote-streaming-routes');

/** Handles remote cloud browser sessions/SSE streaming/input and mobile companion routes. */
export async function handleRemoteStreamingAndMobileRoutes(ctx: RemoteRouteContext): Promise<boolean> {
  const {
    req,
    res,
    method,
    parsedUrl,
    requestId,
    rateLimit,
    auth,
    route,
    requireAccess,
    requireFeature,
  } = ctx;

  // ========================================================================
  // CLOUD BROWSER ENDPOINTS
  // ========================================================================
  if (route === 'cloud-browser/sessions' && method === 'POST') {
    if (!requireAccess('profiles:run')) return true;
    if (!requireFeature('cloud.browser')) return true;

    const body = await parseBody<{
      profileId: string;
      workspaceId?: string;
      regionId?: string;
      resourceClass?: CloudResourceClass;
      maxDurationSeconds?: number;
      idleTimeoutSeconds?: number;
      startupUrl?: string;
    }>(req);
    if (!body.profileId) {
      sendRemoteJSON(req, res, 400, {
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'profileId is required.' },
      }, requestId, rateLimit);
      return true;
    }

    try {
      const sessionResult = await cloudBrowserControlPlane.requestSession(auth.userId, {
        profileId: body.profileId,
        workspaceId: auth.workspaceId || body.workspaceId,
        regionId: body.regionId,
        resourceClass: body.resourceClass,
        maxDurationSeconds: body.maxDurationSeconds,
        idleTimeoutSeconds: body.idleTimeoutSeconds,
        startupUrl: body.startupUrl,
      });

      sendRemoteJSON(req, res, 201, { success: true, data: sessionResult }, requestId, rateLimit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes('QUOTA_EXCEEDED');
      const isLocked = msg.includes('PROFILE_LOCKED');
      const isAccess = msg.includes('ACCESS_DENIED');
      const statusCode = isQuota ? 403 : isLocked ? 409 : isAccess ? 403 : 500;
      sendRemoteJSON(req, res, statusCode, {
        success: false,
        error: { code: isLocked ? 'PROFILE_LOCKED' : isQuota ? 'QUOTA_EXCEEDED' : 'LAUNCH_FAILED', message: msg },
      }, requestId, rateLimit);
    }
    return true;
  }

  if (route === 'cloud-browser/sessions' && method === 'GET') {
    if (!requireAccess('profiles:read')) return true;

    const sessions = cloudBrowserControlPlane.listSessions(auth.userId, auth.workspaceId);
    sendRemoteJSON(req, res, 200, { success: true, data: sessions }, requestId, rateLimit);
    return true;
  }

  if (route === 'cloud-browser/regions' && method === 'GET') {
    const regions = sessionScheduler.getRegions();
    sendRemoteJSON(req, res, 200, { success: true, data: regions }, requestId, rateLimit);
    return true;
  }

  if (route === 'cloud-browser/usage' && method === 'GET') {
    const usage = resourceLimiter.getUserUsageSummary(auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: usage }, requestId, rateLimit);
    return true;
  }

  const cbGetMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)$/);
  if (cbGetMatch && method === 'GET') {
    if (!requireAccess('profiles:read')) return true;

    const session = cloudBrowserControlPlane.getSession(cbGetMatch[1]);
    if (!session || (session.userId !== auth.userId && (!auth.workspaceId || session.workspaceId !== auth.workspaceId))) {
      sendRemoteJSON(req, res, 404, {
        success: false,
        error: { code: 'NOT_FOUND', message: `Cloud session ${cbGetMatch[1]} not found.` },
      }, requestId, rateLimit);
      return true;
    }

    sendRemoteJSON(req, res, 200, { success: true, data: session }, requestId, rateLimit);
    return true;
  }

  const cbStopMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/stop$/);
  if (cbStopMatch && method === 'POST') {
    if (!requireAccess('profiles:run')) return true;

    try {
      const body = await parseBody<{ reason?: string }>(req).catch(() => ({ reason: undefined }));
      const stopResult = await cloudBrowserControlPlane.stopSession(cbStopMatch[1], auth.userId, body.reason || 'USER_REQUESTED');
      sendRemoteJSON(req, res, 200, { success: true, data: stopResult }, requestId, rateLimit);
    } catch (err: unknown) {
      sendRemoteJSON(req, res, 400, {
        success: false,
        error: { code: 'STOP_FAILED', message: err instanceof Error ? err.message : String(err) },
      }, requestId, rateLimit);
    }
    return true;
  }

  const cbReconnectMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/reconnect-token$/);
  if (cbReconnectMatch && method === 'POST') {
    if (!requireAccess('profiles:run')) return true;

    try {
      const token = cloudBrowserControlPlane.generateReconnectToken(cbReconnectMatch[1], auth.userId);
      sendRemoteJSON(req, res, 200, {
        success: true,
        data: {
          sessionId: cbReconnectMatch[1],
          streamToken: token,
          streamGatewayUrl: `/api/v1/remote/cloud-browser/sessions/${cbReconnectMatch[1]}/stream`,
        },
      }, requestId, rateLimit);
    } catch (err: unknown) {
      sendRemoteJSON(req, res, 400, {
        success: false,
        error: { code: 'RECONNECT_FAILED', message: err instanceof Error ? err.message : String(err) },
      }, requestId, rateLimit);
    }
    return true;
  }

  const cbStreamMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/stream$/);
  if (cbStreamMatch && method === 'GET') {
    const sessionId = cbStreamMatch[1];
    const token = parsedUrl.searchParams.get('token');

    const authorized = token
      ? sessionGateway.verifyStreamToken(token, sessionId, auth.userId)
      : auth.userId && requireAccess('profiles:run');

    if (!authorized) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED_STREAM', message: 'Invalid or expired stream token.' } }));
      return true;
    }

    const sseOrigin = (req.headers.origin as string) || '';
    const sseHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Vary': 'Origin',
    };
    if (sseOrigin && isTrustedOrigin(sseOrigin)) {
      sseHeaders['Access-Control-Allow-Origin'] = sseOrigin;
      sseHeaders['Access-Control-Allow-Credentials'] = 'true';
    }
    res.writeHead(200, sseHeaders);
    res.write(': stream-connected\n\n');

    const subscriberId = crypto.randomUUID();
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = sessionGateway.subscribeClient({
        id: subscriberId,
        userId: auth.userId,
        sessionId,
        send: (msg) => {
          try {
            res.write(`data: ${JSON.stringify(msg)}\n\n`);
          } catch (writeErr) {
            log.debug('SSE frame write skipped for disconnected remote stream client', {
              err: writeErr instanceof Error ? writeErr.message : String(writeErr),
            });
          }
        },
        close: () => {
          try {
            res.end();
          } catch (closeErr) {
            log.debug('SSE stream close skipped', {
              err: closeErr instanceof Error ? closeErr.message : String(closeErr),
            });
          }
        },
      });
    } catch (subErr: unknown) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: subErr instanceof Error ? subErr.message : String(subErr) })}\n\n`);
      res.end();
      return true;
    }

    req.on('close', () => {
      if (unsubscribe) unsubscribe();
    });

    return true;
  }

  const cbInputMatch = route.match(/^cloud-browser\/sessions\/([a-zA-Z0-9_-]+)\/input$/);
  if (cbInputMatch && method === 'POST') {
    const sessionId = cbInputMatch[1];
    const token = parsedUrl.searchParams.get('token') || (req.headers['x-stream-token'] as string);

    const authorized = token
      ? sessionGateway.verifyStreamToken(token, sessionId, auth.userId)
      : auth.userId && requireAccess('profiles:run');

    if (!authorized) {
      sendRemoteJSON(req, res, 403, {
        success: false,
        error: { code: 'UNAUTHORIZED_INPUT', message: 'Valid stream token required for input dispatch.' },
      }, requestId, rateLimit);
      return true;
    }

    const body = await parseBody<{ action?: CloudClientAction }>(req);
    if (!body.action?.type) {
      sendRemoteJSON(req, res, 400, {
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Action object with type is required.' },
      }, requestId, rateLimit);
      return true;
    }

    sessionGateway.dispatchAction(sessionId, body.action);
    resourceLimiter.touchActivity(sessionId);

    sendRemoteJSON(req, res, 200, { success: true }, requestId, rateLimit);
    return true;
  }

  // ========================================================================
  // MOBILE COMPANION ENDPOINTS
  // ========================================================================
  if (route === 'mobile/device-token' && method === 'POST') {
    const body = await parseBody<{
      deviceId: string;
      pushToken: string;
      deviceModel?: string;
      osVersion?: string;
      appVersion?: string;
    }>(req);
    if (!body.deviceId || !body.pushToken) {
      sendRemoteJSON(req, res, 400, {
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'deviceId and pushToken are required.' },
      }, requestId, rateLimit);
      return true;
    }

    const record = mobileCompanionService.registerDeviceToken(auth.userId, {
      deviceId: body.deviceId,
      pushToken: body.pushToken,
      deviceModel: body.deviceModel,
      osVersion: body.osVersion,
      appVersion: body.appVersion,
    });

    sendRemoteJSON(req, res, 200, { success: true, data: record }, requestId, rateLimit);
    return true;
  }

  const dtDeleteMatch = route.match(/^mobile\/device-token\/([a-zA-Z0-9_-]+)$/);
  if (dtDeleteMatch && method === 'DELETE') {
    mobileCompanionService.revokeDeviceToken(auth.userId, dtDeleteMatch[1]);
    sendRemoteJSON(req, res, 200, { success: true }, requestId, rateLimit);
    return true;
  }

  if (route === 'mobile/notifications' && method === 'GET') {
    const unreadOnly = parsedUrl.searchParams.get('unread') === 'true';
    const notifications = mobileCompanionService.getUserNotifications(auth.userId, 50, unreadOnly);
    sendRemoteJSON(req, res, 200, { success: true, data: notifications }, requestId, rateLimit);
    return true;
  }

  const notifReadMatch = route.match(/^mobile\/notifications\/([a-zA-Z0-9_-]+)\/read$/);
  if (notifReadMatch && method === 'PUT') {
    mobileCompanionService.markNotificationRead(auth.userId, notifReadMatch[1]);
    sendRemoteJSON(req, res, 200, { success: true }, requestId, rateLimit);
    return true;
  }

  if (route === 'mobile/notifications/preferences' && method === 'GET') {
    const prefs = mobileCompanionService.getNotificationPreferences(auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: prefs }, requestId, rateLimit);
    return true;
  }

  if (route === 'mobile/notifications/preferences' && method === 'PUT') {
    const body = await parseBody<Partial<MobileNotificationPreferences>>(req);
    const updated = mobileCompanionService.updateNotificationPreferences(auth.userId, body);
    sendRemoteJSON(req, res, 200, { success: true, data: updated }, requestId, rateLimit);
    return true;
  }

  return false;
}
