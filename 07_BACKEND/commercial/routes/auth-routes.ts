import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import {
  sendJSON,
  parseBody,
  getAuthUser,
  checkAuthRateLimit,
  desktopAuthTickets,
  WebHandoffSession,
  webHandoffSessions,
  pruneWebHandoffSessions,
  getDesktopAuthSuccessHtml,
  MAX_WEB_HANDOFF_SESSIONS,
  WEB_HANDOFF_TTL_MS,
} from './router-shared.js';
import {
  registerCentralUser,
  verifyEmailToken,
  resendEmailVerification,
  loginCentralUser,
  logoutSession,
  refreshAccessToken,
  logoutSessionAsync,
  listUserSessionsAsync,
  revokeUserSessionAsync,
  revokeAllUserSessionsAsync,
  requestPasswordReset,
  resetPasswordWithToken,
  getCentralUserByIdAsync,
  getCentralUserByEmail,
  getCentralUserByEmailAsync,
} from '../../../05_AUTH/central-auth-service.js';
import {
  registerUser,
  loginUser,
  signToken,
  getUserById,
} from '../commercial-auth-service.js';
import {
  generateOAuthAuthorization,
  validateAndConsumeOAuthState,
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  verifyGoogleIdToken,
  authenticateWithGoogleClaimsAsync,
  getGoogleOAuthConfig,
  normalizePlanId,
  GoogleClaims,
  OAuthStateRecord,
} from '../google-oauth-service.js';
import {
  evaluateUserEntitlements,
  activateUserTrial,
  getUserTrialStatus,
} from '../commercial-entitlement-service.js';
import { TRIAL_CONFIG } from '../canonical-plan-catalog.js';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../../06_DATABASE/central-repository.js';
import { recordFunnelEvent } from '../funnel-service.js';
import { reconcileUserPlanOnLogin } from '../commercial-reconcile-service.js';
import { CURRENT_TERMS_VERSION } from '../../../10_CONFIG/shared/types/commercial.js';

export async function handleAuthRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if (routePath === '/v1/account/signup' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password, name } = body;
    if (!email || !password) {
      sendJSON(res, 400, { success: false, error: 'Email and password required' });
      return true;
    }
    const result = await registerCentralUser({ email, password, name, ipAddress: clientIp });
    if (!result.success) {
      sendJSON(res, 400, { success: false, error: result.error });
      return true;
    }
    sendJSON(res, 201, {
      success: true,
      token: result.tokens?.accessToken,
      refreshToken: result.tokens?.refreshToken,
      user: result.user,
    });
    return true;
  }

  if (routePath === '/v1/account/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password, hwid } = body;
    if (!email || !password) {
      sendJSON(res, 400, { success: false, error: 'Email and password required' });
      return true;
    }
    const result = await loginCentralUser({ email, password, deviceId: hwid, ipAddress: clientIp });
    if (!result.success) {
      const isDeviceErr = !!result.error?.toLowerCase().includes('device');
      sendJSON(res, 401, { success: false, error: result.error, device_ok: !isDeviceErr });
      return true;
    }
    sendJSON(res, 200, {
      success: true,
      token: result.tokens?.accessToken,
      refreshToken: result.tokens?.refreshToken,
      user: result.user,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/register' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'register');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    if (body.acceptedTerms !== true) {
      sendJSON(res, 400, {
        success: false,
        error: {
          code: 'TERMS_NOT_ACCEPTED',
          message: 'You must accept the Terms of Service and Privacy Policy to create an account.',
        },
      });
      return true;
    }
    const VALID_REGISTER_PLANS = [
      'free',
      'starter',
      'growth',
      'ultimate',
      'mahi_starter',
      'mahi_growth',
      'mahi_ultimate',
      'pro',
      'business',
      'enterprise',
      'plan_free',
      'plan_pro',
      'plan_business',
      'plan_enterprise',
    ];
    if (body.planId && !VALID_REGISTER_PLANS.includes(String(body.planId).toLowerCase().trim())) {
      sendJSON(res, 400, { success: false, error: `Invalid plan "${body.planId}"` });
      return true;
    }
    const result = await registerCentralUser({
      email: body.email,
      password: body.password,
      name: body.name,
      ipAddress: clientIp,
    });
    if (!result.success) {
      const isDuplicate = typeof result.error === 'string' && result.error.includes('already exists');
      const statusCode = isDuplicate ? 409 : 400;
      sendJSON(res, statusCode, {
        success: false,
        error: {
          code: isDuplicate ? 'EMAIL_ALREADY_EXISTS' : 'REGISTRATION_FAILED',
          message: result.error || 'Registration failed',
        },
      });
      return true;
    }
    // Server is authoritative for the terms version. A client-supplied value is never
    // trusted, otherwise a user could record consent against an arbitrary or nonexistent
    // version, making the audit trail worthless.
    const termsVer = CURRENT_TERMS_VERSION;
    const acceptedTermsVal = 1;
    const termsVersionVal = termsVer;
    let termsSaved = false;

    if (result.user?.id) {
      try {
        const db = getDatabase();
        const info = db.prepare('UPDATE commercial_users SET accepted_terms = ?, terms_version = ? WHERE id = ?').run(acceptedTermsVal, termsVersionVal, result.user.id);
        if (info.changes > 0) termsSaved = true;
      } catch (err) {
        console.error('[Registration] SQLite commercial_users terms write error', err);
      }

      try {
        const db = getDatabase();
        const info = db.prepare('UPDATE auth_users SET accepted_terms = ?, terms_version = ? WHERE id = ?').run(acceptedTermsVal, termsVersionVal, result.user.id);
        if (info.changes > 0) termsSaved = true;
      } catch (err) {
        console.error('[Registration] SQLite auth_users terms write error', err);
      }

      if (isPostgresConfigured()) {
        try {
          const pgOk = await getCentralRepository().updateAuthUserTerms(result.user.id, acceptedTermsVal, termsVersionVal);
          if (pgOk) termsSaved = true;
        } catch (err) {
          console.error('[Registration] PG terms write error', err);
        }
      }
    }

    if (!termsSaved) {
      console.error('[Registration][CRITICAL] Terms consent could not be saved to ANY store for user', result.user?.id);
      sendJSON(res, 500, { success: false, error: 'Registration failed to persist legal consent. Please retry.' });
      return true;
    }

    let commUserResult: any;
    try {
      commUserResult = registerUser({
        email: body.email,
        password: body.password,
        name: body.name,
        intent: body.intent,
        planId: body.planId || body.plan,
        billingCycle: body.billingCycle || body.billing,
        acceptedTerms: true,
        termsVersion: termsVer,
      }, clientIp, result.user?.id);
    } catch (err: any) {
      console.error('[REGISTER] commercial mirror write failed for user %s: %s',
                    result.user?.id, err?.message || err);
    }

    const registeredUser = commUserResult?.user || result.user;
    const token = commUserResult?.token || result.tokens?.accessToken;
    const isTrial = registeredUser?.signupIntent === 'trial' || body.intent === 'trial';
    const trialExpiresAt = registeredUser?.trialExpiresAt;
    const planId = registeredUser?.planId || (isTrial ? TRIAL_CONFIG.trialPlanId : 'plan_free');

    // Record privacy-safe conversion funnel event
    try {
      recordFunnelEvent({
        eventName: 'signup_completed',
        userId: registeredUser?.id,
        planId,
        billingCycle: body.billingCycle || body.billing,
        ipAddress: clientIp,
        metadata: { intent: body.intent },
      });
      if (isTrial) {
        recordFunnelEvent({
          eventName: 'trial_activated',
          userId: registeredUser?.id,
          planId,
          ipAddress: clientIp,
        });
      }
    } catch {}

    const registeredUserId = registeredUser?.id || result.user?.id;
    const trialStatus = registeredUserId ? getUserTrialStatus(registeredUserId) : { isTrialActive: isTrial, daysRemaining: isTrial ? 7 : 0, isEligibleForTrial: !isTrial };
    const entitlements = registeredUserId ? evaluateUserEntitlements(registeredUserId) : null;

    sendJSON(res, 201, {
      success: true,
      user: registeredUser,
      tokens: result.tokens,
      token,
      trialActive: isTrial,
      trialExpiresAt,
      trialStatus,
      entitlements,
      planId,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/verify-email' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'verify-email');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many verification attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await verifyEmailToken(body.token, clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/resend-verification' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'resend-verification');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many verification requests. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await resendEmailVerification(body.email, clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/login' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'login');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const centralRes = await loginCentralUser({
      email: body.email,
      password: body.password,
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      ipAddress: clientIp,
    });

    if (centralRes.success && centralRes.user && centralRes.tokens) {
      try {
        await reconcileUserPlanOnLogin(centralRes.user.id);
      } catch (err) {
        console.error('[Login] Reconcile error:', err);
      }
      const commUser = getUserById(centralRes.user.id);
      const isTrial = Boolean(commUser?.trialExpiresAt && new Date(commUser.trialExpiresAt).getTime() > Date.now());
      const entitlements = evaluateUserEntitlements(centralRes.user.id, body.deviceId, body.deviceName);
      sendJSON(res, 200, {
        success: true,
        token: centralRes.tokens.accessToken,
        tokens: centralRes.tokens,
        user: {
          ...centralRes.user,
          ...(commUser || {}),
          id: centralRes.user.id,
          is_trial: isTrial,
          trial_started_at: commUser?.trialStartedAt,
          trial_expires_at: commUser?.trialExpiresAt,
        },
        entitlements,
      });
      return true;
    }

    // Fallback to legacy commercial login only if not registered in central auth
    const centralUserExists = getCentralUserByEmail(body.email);
    if (!centralUserExists) {
      const legacyResult = loginUser(body, clientIp);
      if (legacyResult.success && legacyResult.user) {
        try {
          await reconcileUserPlanOnLogin(legacyResult.user.id);
        } catch (err) {
          console.error('[Login] Reconcile error:', err);
        }
        const entitlements = evaluateUserEntitlements(legacyResult.user.id, body.deviceId, body.deviceName);
        sendJSON(res, 200, {
          success: true,
          token: legacyResult.token,
          user: legacyResult.user,
          entitlements,
        });
        return true;
      }
    }

    sendJSON(res, centralRes.lockedRemainingMs ? 429 : 401, {
      success: false,
      error: centralRes.error || 'Invalid email or password.',
    });
    return true;
  }

  // ============================================================================
  // Google OAuth SSO Endpoints (Phase 19 & GoLogin Workflow Parity)
  // ============================================================================

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

    let auth;
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
    } catch (err: any) {
      if (err?.message === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
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

    // Check if caller requested JSON response (e.g., API client or AJAX)
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

    // Direct browser navigation: 302 Redirect to Google Auth URL
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

    const websiteBase = (process.env.MAHI_WEBSITE_URL || (process.env.NODE_ENV === 'production' ? 'https://mahibrowser.com' : '')).replace(/\/+$/, '');

    // Handle user cancellation or OAuth error
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

    // Validate and consume state (anti-CSRF & single-use)
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

      // Check if this was a desktop login flow and update tickets with single-use authCode
      const handoffMatch = stateRecord.returnUrl?.match(/handoff=([^&]+)/);
      const handoffTicket = handoffMatch ? decodeURIComponent(handoffMatch[1]) : '';
      if (handoffTicket && desktopAuthTickets.has(handoffTicket)) {
        const ticketRec = desktopAuthTickets.get(handoffTicket)!;
        const authCode = 'mb_code_' + crypto.randomBytes(32).toString('hex');
        ticketRec.authCode = authCode;
        ticketRec.token = authResult.token;
        ticketRec.user = authResult.user;
        ticketRec.email = authResult.user.email;
        ticketRec.planId = authResult.user.planId;
        ticketRec.codeExpiresAt = Date.now() + 60 * 1000; // 60s TTL
        ticketRec.used = false;
      }

      // Establish session cookie and redirect to onboarding / desktop-success
      let targetUrl = authResult.returnUrl;
      const isDesktop = stateRecord.intent === 'desktop_login' || authResult.returnUrl.includes('/auth/desktop-success');

      if (!isDesktop) {
        if (targetUrl.startsWith('/') && websiteBase) {
          targetUrl = `${websiteBase}${targetUrl}`;
        }
        const sep = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${sep}token=${encodeURIComponent(authResult.token || '')}&login=success`;
      } else {
        const ticketRec = handoffTicket ? desktopAuthTickets.get(handoffTicket) : null;
        const codeParam = ticketRec?.authCode ? `&code=${encodeURIComponent(ticketRec.authCode)}` : '';
        targetUrl = `/auth/desktop-success?handoff=${encodeURIComponent(handoffTicket)}${codeParam}&email=${encodeURIComponent(authResult.user.email)}&plan=${encodeURIComponent(authResult.user.planId || 'trial')}`;

        // CRITICAL SECURITY HARDENING: Never expose raw JWT session token in redirect URL, query strings or cookies!
        res.writeHead(302, {
          Location: targetUrl,
        });
        res.end();
        return true;
      }

      res.writeHead(302, {
        Location: targetUrl,
        'Set-Cookie': `mahi_token=${authResult.token}; Path=/; Max-Age=2592000; SameSite=Lax`,
      });
      res.end();
      return true;
    } catch (err: any) {
      res.writeHead(302, {
        Location: `${websiteBase}/signup?error=${encodeURIComponent(err.message || 'oauth_exchange_failed')}`,
      });
      res.end();
      return true;
    }
  }

  // 2.1 Desktop Auth Status Polling (Fallback for environments without custom protocol or loopback)
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
    // Return single-use code to polling client. Never expose raw token!
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
    let body: any = {};
    try {
      body = await parseBody(req);
    } catch {
      sendJSON(res, 400, { success: false, error: 'Invalid JSON payload' });
      return true;
    }
    const { ticket, code, code_verifier } = body;
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

    // Verify PKCE challenge if challenge was registered
    if (record.codeChallenge) {
      const hashHex = crypto.createHash('sha256').update(code_verifier).digest('hex');
      const hashBase64Url = crypto.createHash('sha256').update(code_verifier).digest('base64url');
      if (record.codeChallenge !== hashHex && record.codeChallenge !== hashBase64Url) {
        desktopAuthTickets.delete(ticket);
        sendJSON(res, 403, { success: false, error: 'PKCE code verification failed' });
        return true;
      }
    }

    // Mark used and consume single-use ticket immediately
    record.used = true;
    const issuedToken = record.token;
    const userProfile = record.user;
    desktopAuthTickets.delete(ticket);

    sendJSON(res, 200, {
      success: true,
      token: issuedToken,
      user: userProfile,
      message: 'Authentication completed successfully'
    });
    return true;
  }

  // 2.3 Desktop Loopback Handoff (Invoked by browser completion page to local daemon port 32123)
  if (routePath === '/api/v1/auth/desktop-handoff' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const { ticket, code } = body;
      if (ticket && code) {
        const { exchangeDesktopAuthCode } = await import('../../../08_SECURITY/account-service.js');
        const exchangeResult = await exchangeDesktopAuthCode(ticket, code);
        sendJSON(res, 200, {
          success: exchangeResult.success,
          message: exchangeResult.success ? 'Desktop authenticated via PKCE loopback' : exchangeResult.error
        });
        return true;
      }
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err?.message || 'Invalid payload' });
      return true;
    }
    sendJSON(res, 400, { success: false, error: 'ticket and code are required' });
    return true;
  }

  // 2.4 Branded Desktop Auth Completion Page (GoLogin UX Parity & Zero Token Exposure)
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

  // 2.5 Zero-Token Web-to-Desktop Handoff Endpoint (Single-Use, 120s TTL)
  if (routePath === '/api/v1/auth/web-handoff' && method === 'POST') {
    pruneWebHandoffSessions();
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const authHeader = (req.headers['authorization'] as string) || (req.headers['x-mahi-token'] ? `Bearer ${req.headers['x-mahi-token']}` : '');
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

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
      console.error('[WEB_HANDOFF] Failed to persist session to central repository:', dbErr);
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

  // 2.6 Web-to-Desktop Handoff Code Exchange (Single-Use Anti-Replay)
  if (routePath === '/api/v1/auth/web-handoff/exchange' && method === 'POST') {
    pruneWebHandoffSessions();
    const body = await parseBody(req);
    const handoffCode = body?.handoffCode || body?.code;

    if (!handoffCode || typeof handoffCode !== 'string') {
      sendJSON(res, 400, { success: false, error: 'handoffCode is required.' });
      return true;
    }

    const now = Date.now();
    let token: string | null = null;
    let user: any = null;

    // Multi-replica production mode: when PostgreSQL is configured, the central DB is the
    // single source of truth across all gateway replicas. Consume atomically via CentralRepository.
    // If null, it was already consumed by another replica or is expired/invalid -> 403 immediately.
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
        console.error('[WEB_HANDOFF] PostgreSQL atomic consumption error:', pgErr);
        sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
        return true;
      }
    } else {
      // Single-process dev / SQLite fallback
      // Fast memory check (handles test mocks that update in-memory session.expiresAt)
      const memSession = webHandoffSessions.get(handoffCode);
      if (memSession && (memSession.used || memSession.expiresAt <= now)) {
        try {
          const repo = getCentralRepository();
          await repo.consumeWebHandoffSessionAtomically(handoffCode, now);
        } catch {}
        webHandoffSessions.delete(handoffCode);
        sendJSON(res, 403, { success: false, error: 'Handoff code has expired, already been used, or is invalid.' });
        return true;
      }

      // Try central repo (SQLite atomic)
      try {
        const repo = getCentralRepository();
        const consumed = await repo.consumeWebHandoffSessionAtomically(handoffCode, now);
        if (consumed) {
          token = consumed.token;
          user = consumed.user;
          webHandoffSessions.delete(handoffCode);
        }
      } catch {}

      // Fallback to in-memory map
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

    // Optional deviceId validation if present in body and session
    if (body?.deviceId && user?.deviceId && body.deviceId !== user.deviceId) {
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

  // 3. Programmatic Google OAuth SSO Endpoint (Requires cryptographically verified ID token or OAuth code)
  if (routePath === '/api/v1/auth/google' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'google_oauth');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const rawIdToken =
      typeof body?.idToken === 'string'
        ? body.idToken.trim()
        : typeof body?.id_token === 'string'
          ? body.id_token.trim()
          : '';
    const authCode = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!rawIdToken && !authCode) {
      sendJSON(res, 401, {
        success: false,
        error: 'UNVERIFIED_GOOGLE_AUTH: A verified Google idToken or OAuth authorization code is required.',
      });
      return true;
    }

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
    } catch (err: any) {
      sendJSON(res, 401, {
        success: false,
        error: err?.message || 'Google credential verification failed.',
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
    if (!authResult.success) {
      sendJSON(res, 400, { success: false, error: authResult.error });
      return true;
    }

    const entitlements = evaluateUserEntitlements(authResult.user.id);
    const trialStatus = getUserTrialStatus(authResult.user.id);

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

  if (routePath === '/api/v1/auth/refresh' && method === 'POST') {
    const body = await parseBody(req);
    const refreshToken = body.refreshToken || body.token;
    const result = await refreshAccessToken(refreshToken, clientIp);
    if (!result.success || !result.tokens) {
      sendJSON(res, 401, result);
      return true;
    }
    sendJSON(res, 200, {
      success: true,
      tokens: result.tokens,
      token: result.tokens.accessToken,
      user: result.user,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/logout' && method === 'POST') {
    const auth = getAuthUser(req);
    const body = await parseBody(req);
    const sessionId = body.sessionId || (auth as any)?.sessionId;
    if (sessionId) {
      logoutSession(sessionId, clientIp);
    }
    sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });
    return true;
  }

  if (routePath === '/api/v1/auth/forgot-password' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'forgot-password');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many password reset requests. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await requestPasswordReset(body.email, clientIp);
    sendJSON(res, 200, result);
    return true;
  }

  if (routePath === '/api/v1/auth/reset-password' && method === 'POST') {
    const rate = checkAuthRateLimit(clientIp, 'reset-password');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many password reset attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const body = await parseBody(req);
    const result = await resetPasswordWithToken({
      token: body.token,
      newPassword: body.newPassword || body.password,
      ipAddress: clientIp,
    });
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/sessions' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const currentSessionId = (auth as any).sessionId;
    const sessions = await listUserSessionsAsync(auth.userId, currentSessionId);
    sendJSON(res, 200, { success: true, data: sessions });
    return true;
  }

  if (routePath === '/api/v1/auth/sessions/revoke' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const success = await revokeUserSessionAsync(auth.userId, body.sessionId, clientIp);
    sendJSON(res, 200, { success });
    return true;
  }

  if (routePath === '/api/v1/auth/sessions/revoke-all' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const currentSessionId = (auth as any).sessionId;
    const revokedCount = await revokeAllUserSessionsAsync(auth.userId, body.keepCurrent ? currentSessionId : undefined, clientIp);
    sendJSON(res, 200, { success: true, revokedCount });
    return true;
  }

  // -------------------------------------------------------------
  // 2. USER PROFILE & ENTITLEMENTS (Authenticated)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/auth/me' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Valid Bearer token required.' });
      return true;
    }
    // Look up in central users first, then legacy
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
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    // Fall back to the canonical trial plan: the download page sends no planId, and
    // TRIAL_CONFIG is the single source of truth for which plan a trial grants.
    const trialPlanId = body.planId || body.plan_id || TRIAL_CONFIG.trialPlanId;
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
      } catch {}
    }
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/trial/status' && method === 'GET') {
    const auth = getAuthUser(req);
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
