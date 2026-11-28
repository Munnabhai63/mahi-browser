import type http from 'node:http';
import {
  sendJSON,
  parseBody,
  getAuthUserAsync,
  parseCookies,
  AUTH_REFRESH_COOKIE_NAME,
  buildWebAuthCookies,
  buildClearWebAuthCookies,
  appendSetCookies,
} from './router-shared.js';
import { validateStrictBody } from '../../utils/app-error.js';
import { rejectIfEmergencyFrozen } from '../../services/kill-switch-service.js';
import {
  RefreshTokenSchema,
  LogoutSchema,
  RevokeSessionSchema,
  RevokeAllSessionsSchema,
  TrialActivateSchema,
} from '../validation/commercial-schemas.js';
import {
  refreshAccessToken,
  logoutSessionAsync,
  logoutByRefreshTokenAsync,
  listUserSessionsAsync,
  revokeUserSessionAsync,
  revokeAllUserSessionsAsync,
  getCentralUserByIdAsync,
} from '../../../05_AUTH/central-auth-service.js';
import { getUserById } from '../commercial-auth-service.js';
import {
  evaluateUserEntitlements,
  activateUserTrial,
  getUserTrialStatus,
} from '../commercial-entitlement-service.js';
import { TRIAL_CONFIG } from '../canonical-plan-catalog.js';
import { recordFunnelEvent } from '../funnel-service.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('auth-session-profile-routes');

export async function handleAuthSessionAndProfileRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  method: string,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if (routePath === '/api/v1/auth/refresh' && method === 'POST') {
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(RefreshTokenSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const cookieRefreshToken = parseCookies(req)[AUTH_REFRESH_COOKIE_NAME] || '';
    const refreshToken = body.refreshToken || body.token || cookieRefreshToken;
    const result = await refreshAccessToken(refreshToken, clientIp);
    if (!result.success || !result.tokens) {
      sendJSON(res, 401, result);
      return true;
    }
    appendSetCookies(
      res,
      buildWebAuthCookies({
        req,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      })
    );
    sendJSON(res, 200, {
      success: true,
      tokens: result.tokens,
      token: result.tokens.accessToken,
      user: result.user,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/logout' && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(LogoutSchema, rawBody, res);
    if (!parsed.ok) return true;
    const cookieRefreshToken = parseCookies(req)[AUTH_REFRESH_COOKIE_NAME] || '';
    const rawRefreshToken = parsed.data.refreshToken || cookieRefreshToken;
    const sessionId = parsed.data.sessionId || auth?.sessionId;
    const revokedBySession = sessionId ? await logoutSessionAsync(sessionId, clientIp) : false;
    if (rawRefreshToken && !revokedBySession) {
      await logoutByRefreshTokenAsync(rawRefreshToken, clientIp);
    }
    appendSetCookies(res, buildClearWebAuthCookies(req));
    sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });
    return true;
  }

  if (routePath === '/api/v1/auth/sessions' && method === 'GET') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const currentSessionId = auth.sessionId;
    const sessions = await listUserSessionsAsync(auth.userId, currentSessionId);
    sendJSON(res, 200, { success: true, data: sessions });
    return true;
  }

  if (routePath === '/api/v1/auth/sessions/revoke' && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(RevokeSessionSchema, rawBody, res);
    if (!parsed.ok) return true;
    const success = await revokeUserSessionAsync(auth.userId, parsed.data.sessionId || '', clientIp);
    sendJSON(res, 200, { success });
    return true;
  }

  if (routePath === '/api/v1/auth/sessions/revoke-all' && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(RevokeAllSessionsSchema, rawBody, res);
    if (!parsed.ok) return true;
    const currentSessionId = auth.sessionId;
    const revokedCount = await revokeAllUserSessionsAsync(auth.userId, parsed.data.keepCurrent ? currentSessionId : undefined, clientIp);
    sendJSON(res, 200, { success: true, revokedCount });
    return true;
  }

  if (routePath === '/api/v1/auth/me' && method === 'GET') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid Bearer token required.' });
      return true;
    }
    const centralUser = await getCentralUserByIdAsync(auth.userId);
    const commUser = getUserById(auth.userId);
    if (!centralUser && !commUser) {
      sendJSON(res, 404, { success: false, error: 'User not found.' });
      return true;
    }
    const trialStatus = getUserTrialStatus(auth.userId);
    const entitlements = evaluateUserEntitlements(auth.userId);
    const user = {
      ...(commUser || {}),
      ...(centralUser || {}),
      id: auth.userId,
      email: centralUser?.email || commUser?.email,
      name: commUser?.name || centralUser?.name,
      emailVerified: centralUser ? centralUser.emailVerified : true,
      status: centralUser?.status || commUser?.status || 'ACTIVE',
      planId: commUser?.planId || centralUser?.planId || 'plan_free',
      profileQuota: entitlements?.maxProfiles || centralUser?.profileQuota || 15,
    };
    sendJSON(res, 200, { success: true, user, trialStatus, entitlements });
    return true;
  }

  if (routePath === '/api/v1/auth/trial/activate' && method === 'POST') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    if (await rejectIfEmergencyFrozen(res, 'trial_activation')) return true;
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(TrialActivateSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const trialPlanId = body.planId || body.plan_id || body.plan || TRIAL_CONFIG.trialPlanId;
    if (!trialPlanId) {
      sendJSON(res, 400, { success: false, error: 'NO_TRIAL_PLAN_CONFIGURED' });
      return true;
    }
    const result = activateUserTrial(auth.userId, trialPlanId);
    if (result.success) {
      try {
        recordFunnelEvent({
          eventName: 'trial_activated',
          userId: auth.userId,
          planId: result.planId,
          ipAddress: clientIp,
        });
      } catch (funnelErr) {
        log.debug('Skipped trial activation funnel telemetry logging', {
          userId: auth.userId,
          err: funnelErr instanceof Error ? funnelErr.message : String(funnelErr),
        });
      }
    }
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/trial/status' && method === 'GET') {
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const status = getUserTrialStatus(auth.userId);
    sendJSON(res, 200, { success: true, ...status });
    return true;
  }

  return false;
}
