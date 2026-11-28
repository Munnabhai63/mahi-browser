import type http from 'node:http';
import crypto from 'node:crypto';
import type { URL } from 'node:url';
import {
  sendJSON,
  parseBody,
  getAuthUserAsync,
  checkAuthRateLimitAsync,
  buildWebAuthCookies,
  appendSetCookies,
  extractRequestAuthToken,
  desktopAuthTickets,
  type AuthPublicUser,
  type WebHandoffSession,
  webHandoffSessions,
  pruneWebHandoffSessions,
  getDesktopAuthSuccessHtml,
  MAX_WEB_HANDOFF_SESSIONS,
  WEB_HANDOFF_TTL_MS,
} from './router-shared.js';
import { sendSafeError, validateStrictBody } from '../../utils/app-error.js';
import { cleanUrl, getSiteConfig } from '../../../10_CONFIG/shared/site-config.js';
import {
  DesktopExchangeSchema,
  DesktopHandoffSchema,
  WebHandoffExchangeSchema,
  GoogleAuthPostSchema,
} from '../validation/commercial-schemas.js';
import { getCentralUserByIdAsync } from '../../../05_AUTH/central-auth-service.js';
import { getUserById } from '../commercial-auth-service.js';
import {
  generateOAuthAuthorization,
  validateAndConsumeOAuthState,
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  verifyGoogleIdToken,
  authenticateWithGoogleClaimsAsync,
  getGoogleOAuthConfig,
  normalizePlanId,
  type GoogleClaims,
  type OAuthStateRecord,
} from '../google-oauth-service.js';
import { evaluateUserEntitlements, getUserTrialStatus } from '../commercial-entitlement-service.js';
import { TRIAL_CONFIG } from '../canonical-plan-catalog.js';
import { isPostgresConfigured, getCentralRepository } from '../../../06_DATABASE/central-repository.js';
import type { WebHandoffUserPayload } from '../../../06_DATABASE/central-repository-types.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('auth-oauth-handoff-routes');

export async function handleAuthOAuthAndHandoffRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  // 1. OAuth Start: Redirects browser to Google OAuth consent
  if (routePath === '/api/v1/auth/google/start' && method === 'GET') {
    const intent = parsedUrl.searchParams.get('intent') || 'trial';
    const planId = parsedUrl.searchParams.get('plan') || parsedUrl.searchParams.get('planId') || TRIAL_CONFIG.trialPlanId;
    const billingCycle = parsedUrl.searchParams.get('billing') || parsedUrl.searchParams.get('billingCycle') || 'annual';
    const returnUrl = parsedUrl.searchParams.get('returnUrl') || parsedUrl.searchParams.get('return_url') || '';
    const handoff = parsedUrl.searchParams.get('handoff') || '';
    const codeChallenge = parsedUrl.searchParams.get('code_challenge') || '';
    const acceptedTerms = parsedUrl.searchParams.get('acceptedTerms') === 'true';
    const termsVersion = parsedUrl.searchParams.get('termsVersion') || undefined;

    if (handoff) {
      desktopAuthTickets.set(handoff, {
        handoff,
        codeChallenge,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
    }

    let auth: ReturnType<typeof generateOAuthAuthorization>;
    try {
      auth = generateOAuthAuthorization({
        intent,
        planId,
        billingCycle,
        returnUrl,
        handoff,
        acceptedTerms,
        termsVersion,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
        const acceptsJson = req.headers.accept?.includes('application/json') || req.headers['x-requested-with'];
        if (acceptsJson) {
          sendJSON(res, 503, {
            success: false,
            error: 'Google OAuth is not configured on this server.',
            code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          });
          return true;
        }
        res.writeHead(302, {
          Location: `/login?error=${encodeURIComponent('Google OAuth is not configured yet. Please sign in with email and password.')}`,
        });
        res.end();
        return true;
      }
      throw err;
    }

    const acceptsJson = req.headers.accept?.includes('application/json') || req.headers['x-requested-with'];
    if (acceptsJson) {
      sendJSON(res, 200, {
        success: true,
        authUrl: auth.authUrl,
        state: auth.state,
        configured: auth.configured,
      });
      return true;
    }

    res.writeHead(302, {
      Location: auth.authUrl,
    });
    res.end();
    return true;
  }

  // 2. OAuth Callback: Validates state, exchanges code, links/creates user, creates session
  if (routePath === '/api/v1/auth/google/callback' && method === 'GET') {
    const code = parsedUrl.searchParams.get('code');
    const state = parsedUrl.searchParams.get('state');
    const error = parsedUrl.searchParams.get('error');

    const explicitWebsite = cleanUrl(process.env.MAHI_WEBSITE_URL || process.env.WEBSITE_URL, '');
    const websiteBase =
      explicitWebsite ||
      (process.env.NODE_ENV === 'production' ? getSiteConfig({ productionFallback: true }).websiteUrl : '');

    if (error || !state) {
      const stateRecord = state ? validateAndConsumeOAuthState(state) : null;
      const fallbackIntent = stateRecord?.intent || 'trial';
      const fallbackPlan = stateRecord?.planId || TRIAL_CONFIG.trialPlanId;
      const errorMsg = error === 'access_denied' ? 'cancelled' : (error || 'oauth_error');
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=${encodeURIComponent(errorMsg)}&intent=${encodeURIComponent(fallbackIntent)}&plan=${encodeURIComponent(fallbackPlan)}`,
      });
      res.end();
      return true;
    }

    const stateRecord = validateAndConsumeOAuthState(state);
    if (!stateRecord) {
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=invalid_state`,
      });
      res.end();
      return true;
    }

    if (!code) {
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=missing_code`,
      });
      res.end();
      return true;
    }

    try {
      const redirectUri = getGoogleOAuthConfig().defaultRedirectUri;
      const tokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
      const profile = await fetchGoogleProfile(tokens.accessToken);

      const authResult = await authenticateWithGoogleClaimsAsync(profile, stateRecord, clientIp);
      if (!authResult.success) {
        res.writeHead(302, {
          Location: `${websiteBase}/signup?error=${encodeURIComponent(authResult.error || 'auth_failed')}`,
        });
        res.end();
        return true;
      }

      const handoffMatch = stateRecord.returnUrl?.match(/handoff=([^&]+)/);
      const handoffTicket = handoffMatch ? decodeURIComponent(handoffMatch[1]) : '';
      const ticketRec = handoffTicket ? desktopAuthTickets.get(handoffTicket) : undefined;
      if (ticketRec && authResult.user) {
        const authCode = `mb_code_${crypto.randomBytes(32).toString('hex')}`;
        ticketRec.authCode = authCode;
        ticketRec.token = authResult.token;
        ticketRec.user = authResult.user;
        ticketRec.email = authResult.user.email;
        ticketRec.planId = authResult.user.planId;
        ticketRec.codeExpiresAt = Date.now() + 60 * 1000;
        ticketRec.used = false;
      }

      let targetUrl = authResult.returnUrl;
      const isDesktop = stateRecord.intent === 'desktop_login' || authResult.returnUrl.includes('/auth/desktop-success');

      if (!isDesktop) {
        if (targetUrl.startsWith('/') && websiteBase) {
          targetUrl = `${websiteBase}${targetUrl}`;
        }
        const sep = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${sep}login=success`;
      } else {
        const ticketObj = handoffTicket ? desktopAuthTickets.get(handoffTicket) : null;
        const codeParam = ticketObj?.authCode ? `&code=${encodeURIComponent(ticketObj.authCode)}` : '';
        targetUrl = `/auth/desktop-success?handoff=${encodeURIComponent(handoffTicket)}${codeParam}&email=${encodeURIComponent(authResult.user?.email || '')}&plan=${encodeURIComponent(authResult.user?.planId || 'trial')}`;

        res.writeHead(302, {
          Location: targetUrl,
        });
        res.end();
        return true;
      }

      if (authResult.token) {
        appendSetCookies(
          res,
          buildWebAuthCookies({
            req,
            accessToken: authResult.token,
          })
        );
      }
      res.writeHead(302, {
        Location: targetUrl,
      });
      res.end();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const safeErrorCode = msg.startsWith('GOOGLE_EMAIL_NOT_VERIFIED')
        ? 'google_email_not_verified'
        : msg.startsWith('GOOGLE_ID_TOKEN_')
          ? 'google_token_invalid'
          : msg.startsWith('GOOGLE_OAUTH_NOT_CONFIGURED')
            ? 'google_oauth_not_configured'
            : 'oauth_exchange_failed';
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=${encodeURIComponent(safeErrorCode)}`,
      });
      res.end();
      return true;
    }
  }

  // 2.1 Desktop Auth Status Polling
  if (routePath === '/api/v1/auth/desktop-status' && method === 'GET') {
    const ticket = parsedUrl.searchParams.get('ticket');
    if (!ticket) {
      sendJSON(res, 400, { success: false, error: 'Ticket parameter required' });
      return true;
    }
    const record = desktopAuthTickets.get(ticket);
    if (!record || record.expiresAt < Date.now()) {
      sendJSON(res, 200, { success: false, error: 'Ticket expired or not found', authenticated: false });
      return true;
    }
    if (record.authCode && !record.used && record.codeExpiresAt && record.codeExpiresAt > Date.now()) {
      sendJSON(res, 200, {
        success: true,
        authenticated: true,
        code: record.authCode,
        ticket: record.handoff,
        email: record.email,
        plan: record.planId,
      });
      return true;
    }
    sendJSON(res, 200, { success: true, authenticated: false });
    return true;
  }

  // 2.2 Secure PKCE Authorization Code Exchange (RFC 8252 Hardened)
  if (routePath === '/api/v1/auth/desktop-exchange' && method === 'POST') {
    let rawBody: Record<string, unknown> = {};
    try {
      rawBody = await parseBody(req);
    } catch {
      sendJSON(res, 400, { success: false, error: 'Invalid JSON payload' });
      return true;
    }
    const parsed = validateStrictBody(DesktopExchangeSchema, rawBody, res);
    if (!parsed.ok) return true;
    const { ticket, code, code_verifier } = parsed.data;
    if (!ticket || !code || !code_verifier) {
      sendJSON(res, 400, { success: false, error: 'ticket, code, and code_verifier are required' });
      return true;
    }

    const record = desktopAuthTickets.get(ticket);
    if (!record) {
      sendJSON(res, 403, { success: false, error: 'Invalid or expired handoff ticket' });
      return true;
    }

    if (record.used) {
      desktopAuthTickets.delete(ticket);
      sendJSON(res, 403, { success: false, error: 'Authorization code already consumed (replay prevented)' });
      return true;
    }

    if (record.codeExpiresAt && record.codeExpiresAt < Date.now()) {
      desktopAuthTickets.delete(ticket);
      sendJSON(res, 403, { success: false, error: 'Authorization code expired' });
      return true;
    }

    if (record.authCode !== code) {
      sendJSON(res, 403, { success: false, error: 'Authorization code mismatch' });
      return true;
    }

    if (record.codeChallenge) {
      const hashHex = crypto.createHash('sha256').update(code_verifier).digest('hex');
      const hashBase64Url = crypto.createHash('sha256').update(code_verifier).digest('base64url');
      if (record.codeChallenge !== hashHex && record.codeChallenge !== hashBase64Url) {
        desktopAuthTickets.delete(ticket);
        sendJSON(res, 403, { success: false, error: 'PKCE code verification failed' });
        return true;
      }
    }

    record.used = true;
    const issuedToken = record.token;
    const userProfile = record.user;
    desktopAuthTickets.delete(ticket);

    sendJSON(res, 200, {
      success: true,
      token: issuedToken,
      user: userProfile,
      message: 'Authentication completed successfully',
    });
    return true;
  }

  // 2.3 Desktop Loopback Handoff
  if (routePath === '/api/v1/auth/desktop-handoff' && method === 'POST') {
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(DesktopHandoffSchema, rawBody, res);
      if (!parsed.ok) return true;
      const { ticket, code } = parsed.data;
      if (ticket && code) {
        const { exchangeDesktopAuthCode } = await import('../../../08_SECURITY/account-service.js');
        const exchangeResult = await exchangeDesktopAuthCode(ticket, code);
        sendJSON(res, 200, {
          success: exchangeResult.success,
          message: exchangeResult.success ? 'Desktop authenticated via PKCE loopback' : exchangeResult.error,
        });
        return true;
      }
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400, fallbackMessage: 'Invalid payload' });
      return true;
    }
    sendJSON(res, 400, { success: false, error: 'ticket and code are required' });
    return true;
  }

  // 2.4 Branded Desktop Auth Completion Page
  if ((routePath === '/auth/desktop-success' || routePath === '/auth/success') && method === 'GET') {
    const code = parsedUrl.searchParams.get('code') || '';
    const email = parsedUrl.searchParams.get('email') || '';
    const plan = parsedUrl.searchParams.get('plan') || '';
    const handoff = parsedUrl.searchParams.get('handoff') || '';
    const html = getDesktopAuthSuccessHtml({ handoff, code, email, plan });
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end(html);
    return true;
  }

  // 2.5 Zero-Token Web-to-Desktop Handoff Endpoint
  if (routePath === '/api/v1/auth/web-handoff' && method === 'POST') {
    pruneWebHandoffSessions();
    const auth = await getAuthUserAsync(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid session cookie or Bearer token required.' });
      return true;
    }
    const token = extractRequestAuthToken(req).token || '';

    const centralUser = await getCentralUserByIdAsync(auth.userId);
    const commUser = getUserById(auth.userId);
    const user = {
      ...(commUser || {}),
      ...(centralUser || {}),
      id: auth.userId,
      email: centralUser?.email || commUser?.email || auth.email,
      name: commUser?.name || centralUser?.name,
      planId: commUser?.planId || centralUser?.planId || 'plan_free',
    };

    if (webHandoffSessions.size >= MAX_WEB_HANDOFF_SESSIONS) {
      const oldestKey = webHandoffSessions.keys().next().value;
      if (oldestKey) webHandoffSessions.delete(oldestKey);
    }

    const handoffCode = `mb_web_${crypto.randomBytes(24).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + WEB_HANDOFF_TTL_MS;
    const sessionObj: WebHandoffSession = {
      code: handoffCode,
      userId: auth.userId,
      token,
      user,
      createdAt: now,
      expiresAt,
      used: false,
    };
    webHandoffSessions.set(handoffCode, sessionObj);

    try {
      const repo = getCentralRepository();
      await repo.createWebHandoffSession({
        code: handoffCode,
        token,
        userJson: JSON.stringify(user),
        createdAt: now,
        expiresAt,
      });
    } catch (dbErr) {
      log.error('[WEB_HANDOFF] Failed to persist session to central repository:', dbErr);
    }

    sendJSON(res, 200, {
      success: true,
      handoffCode,
      expiresInSeconds: 120,
      protocolUrl: `mahibrowser://auth-callback?handoff=${encodeURIComponent(handoffCode)}`,
      legacyProtocolUrl: `mahi://auth?handoff=${encodeURIComponent(handoffCode)}`,
    });
    return true;
  }

  // 2.6 Web-to-Desktop Handoff Code Exchange
  if (routePath === '/api/v1/auth/web-handoff/exchange' && method === 'POST') {
    pruneWebHandoffSessions();
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(WebHandoffExchangeSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const handoffCode = body?.handoffCode || body?.code;

    if (!handoffCode || typeof handoffCode !== 'string') {
      sendJSON(res, 400, { success: false, error: 'handoffCode is required.' });
      return true;
    }

    const now = Date.now();
    let token: string | null = null;
    let user: AuthPublicUser | WebHandoffUserPayload | null = null;

    if (isPostgresConfigured()) {
      try {
        const repo = getCentralRepository();
        const consumed = await repo.consumeWebHandoffSessionAtomically(handoffCode, now);
        if (consumed) {
          token = consumed.token;
          user = consumed.user;
          webHandoffSessions.delete(handoffCode);
        } else {
          webHandoffSessions.delete(handoffCode);
          sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
          return true;
        }
      } catch (pgErr) {
        log.error('[WEB_HANDOFF] PostgreSQL atomic consumption error:', pgErr);
        sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
        return true;
      }
    } else {
      const memSession = webHandoffSessions.get(handoffCode);
      if (memSession && (memSession.used || memSession.expiresAt <= now)) {
        try {
          const repo = getCentralRepository();
          await repo.consumeWebHandoffSessionAtomically(handoffCode, now);
        } catch (consumeErr) {
          log.debug('Failed atomic web handoff expire sync in central repo', {
            err: consumeErr instanceof Error ? consumeErr.message : String(consumeErr),
          });
        }
        webHandoffSessions.delete(handoffCode);
        sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
        return true;
      }

      try {
        const repo = getCentralRepository();
        const consumed = await repo.consumeWebHandoffSessionAtomically(handoffCode, now);
        if (consumed) {
          token = consumed.token;
          user = consumed.user;
          webHandoffSessions.delete(handoffCode);
        }
      } catch (consumeErr) {
        log.warn('Failed consuming web handoff session from central repo', {
          err: consumeErr instanceof Error ? consumeErr.message : String(consumeErr),
        });
      }

      if (!token) {
        const session = webHandoffSessions.get(handoffCode);
        if (!session || session.used || session.expiresAt <= now) {
          if (session) {
            webHandoffSessions.delete(handoffCode);
          }
          sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
          return true;
        }
        session.used = true;
        token = session.token;
        user = session.user;
      }

      webHandoffSessions.delete(handoffCode);
    }

    if (body?.deviceId && typeof user?.deviceId === 'string' && body.deviceId !== user.deviceId) {
      sendJSON(res, 403, { success: false, error: 'Handoff code device mismatch.' });
      return true;
    }

    sendJSON(res, 200, {
      success: true,
      token,
      user,
    });
    return true;
  }

  // 3. Programmatic Google OAuth SSO Endpoint
  if (routePath === '/api/v1/auth/google' && method === 'POST') {
    const rate = await checkAuthRateLimitAsync(clientIp, 'google_oauth');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const rawBody = await parseBody(req);
    const candidateIdToken =
      typeof rawBody?.idToken === 'string'
        ? rawBody.idToken.trim()
        : typeof rawBody?.id_token === 'string'
          ? rawBody.id_token.trim()
          : '';
    const candidateCode = typeof rawBody?.code === 'string' ? rawBody.code.trim() : '';

    if (!candidateIdToken && !candidateCode) {
      sendJSON(res, 401, {
        success: false,
        error: 'UNVERIFIED_GOOGLE_AUTH: A verified Google idToken or OAuth authorization code is required.',
      });
      return true;
    }

    const parsed = validateStrictBody(GoogleAuthPostSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const rawIdToken =
      typeof body?.idToken === 'string'
        ? body.idToken.trim()
        : typeof body?.id_token === 'string'
          ? body.id_token.trim()
          : '';
    const authCode = typeof body?.code === 'string' ? body.code.trim() : '';

    let claims: GoogleClaims;
    try {
      if (rawIdToken) {
        claims = await verifyGoogleIdToken(rawIdToken);
      } else {
        const config = getGoogleOAuthConfig();
        const redirectUri =
          typeof body?.redirectUri === 'string' && body.redirectUri.trim() === config.defaultRedirectUri
            ? config.defaultRedirectUri
            : config.defaultRedirectUri;
        const tokens = await exchangeGoogleAuthorizationCode(authCode, redirectUri);
        if (tokens.idToken && !(process.env.NODE_ENV === 'test' && tokens.idToken.startsWith('mock_id_token_'))) {
          claims = await verifyGoogleIdToken(tokens.idToken);
        } else {
          claims = await fetchGoogleProfile(tokens.accessToken);
        }
      }
    } catch (err: unknown) {
      sendSafeError(res, err, {
        fallbackStatus: 401,
        fallbackMessage: 'Google credential verification failed.',
      });
      return true;
    }

    if (!claims?.email || !claims?.sub || claims.email_verified !== true) {
      sendJSON(res, 401, {
        success: false,
        error: 'GOOGLE_EMAIL_NOT_VERIFIED: Verified Google claims are required.',
      });
      return true;
    }

    const requestedIntent = String(body?.intent || 'trial').toLowerCase();
    const safeIntent = requestedIntent === 'login' || requestedIntent === 'paid' ? requestedIntent : 'trial';
    const safeBillingCycle = String(body?.billingCycle || 'annual').toLowerCase() === 'monthly' ? 'monthly' : 'annual';

    const stateContext: OAuthStateRecord = {
      state: 'verified_post',
      nonce: crypto.randomBytes(16).toString('hex'),
      provider: 'google',
      intent: safeIntent,
      planId: safeIntent === 'paid' && typeof body?.planId === 'string' ? normalizePlanId(body.planId) : 'free',
      billingCycle: safeBillingCycle,
      returnUrl: typeof body?.returnUrl === 'string' ? body.returnUrl : '',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const authResult = await authenticateWithGoogleClaimsAsync(claims, stateContext, clientIp);
    if (!authResult.success || !authResult.user) {
      sendJSON(res, 400, { success: false, error: authResult.error });
      return true;
    }

    const entitlements = evaluateUserEntitlements(authResult.user.id);
    const trialStatus = getUserTrialStatus(authResult.user.id);

    if (authResult.token) {
      appendSetCookies(
        res,
        buildWebAuthCookies({
          req,
          accessToken: authResult.token,
        })
      );
    }

    sendJSON(res, 200, {
      success: true,
      token: authResult.token,
      tokens: { accessToken: authResult.token },
      user: authResult.user,
      entitlements,
      trialStatus,
      trialActive: trialStatus.isTrialActive,
      trialExpiresAt: trialStatus.trialExpiresAt,
      isNewAccount: authResult.isNewAccount,
      isLinked: authResult.isLinked,
      planId: authResult.user.planId,
    });
    return true;
  }

  return false;
}
