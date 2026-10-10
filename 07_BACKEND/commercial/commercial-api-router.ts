import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import {
  registerUser,
  loginUser,
  signToken,
  verifyToken,
  getUserById,
  getAllUsers,
  updateUserStatus,
  updateUserPlan,
} from './commercial-auth-service.js';
import {
  registerCentralUser,
  verifyEmailToken,
  resendEmailVerification,
  loginCentralUser,
  refreshAccessToken,
  logoutSession,
  listUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  requestPasswordReset,
  resetPasswordWithToken,
  getCentralUserById,
  getCentralUserByEmail,
  verifyAccessToken,
} from '../../05_AUTH/central-auth-service.js';
import {
  getCommercialPlans,
  getCommercialPlanById,
  createCommercialPlan,
  updateCommercialPlan,
} from './commercial-plan-service.js';
import {
  buildPlanCatalog,
  getAllPricingVersions,
  getActivePricingVersion,
  createPricingDraft,
  updatePricingDraft,
  previewPricingChanges,
  publishPricingVersion,
  rollbackPricing,
  getAdminRevenueSummary,
  getProviderSyncStatus,
  initializePricingTables,
} from './pricing-admin-service.js';
import {
  evaluateUserEntitlements,
  activateCommercialLicenseForUser,
  activateUserTrial,
  getUserTrialStatus,
} from './commercial-entitlement-service.js';
import {
  createDemoRequest,
  getDemoRequests,
  updateDemoRequestStatus,
  DemoRequestStatus,
} from './demo-service.js';
import {
  handleSupportChatMessage,
  getSupportTickets,
  updateSupportTicketStatus,
} from './support-ticket-service.js';
import {
  recordFunnelEvent,
  getFunnelMetrics,
} from './funnel-service.js';
import {
  generateOAuthAuthorization,
  validateAndConsumeOAuthState,
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  authenticateWithGoogleClaims,
  getGoogleOAuthConfig,
  normalizePlanId,
  GoogleClaims,
  OAuthStateRecord,
} from './google-oauth-service.js';
import {
  getUserDevices,
  getAllCommercialDevices,
  revokeCommercialDevice,
} from './commercial-device-service.js';
import {
  getCommercialAuditLogs,
  logCommercialAudit,
} from './commercial-audit-service.js';
import {
  getSoftwareVersions,
  publishSoftwareVersion,
  checkVersionCompatibility,
} from './commercial-version-service.js';
import {
  createLicense,
  getLicenses,
  revokeLicense,
  extendLicense,
  getLicenseDevices,
  deactivateDevice,
} from '../../04_LICENSING/license-engine.js';
import { verifyAdminAccess } from '../../05_AUTH/admin-auth.js';
import { isValidAdminWebSecret } from '../../08_SECURITY/install-secrets.js';
import { CommercialRole } from '../../10_CONFIG/shared/types/commercial.js';

import {
  getUserSyncUsage,
  listUserCloudProfiles,
  getCloudProfile,
  createUploadSession,
  finalizeUploadSession,
  createDownloadSession,
  deleteCloudProfile,
  acquireProfileLock,
  renewProfileLock,
  releaseProfileLock,
  getProfileLockStatus,
} from '../services/cloud-profile-service.js';
import {
  createTeamWorkspace,
  listUserTeamWorkspaces,
  getTeamWorkspace,
  updateTeamWorkspace,
  deleteTeamWorkspace,
  transferWorkspaceOwnership,
  getWorkspaceMembers,
  updateMemberRole,
  removeWorkspaceMember,
  inviteWorkspaceMember,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  acceptWorkspaceInvitation,
  shareProfileToWorkspace,
  revokeProfileShare,
  listWorkspaceProfiles,
  getWorkspaceAuditLogs,
  getWorkspaceKeyEnvelope,
  setWorkspaceKeyEnvelope,
} from '../services/team-workspace-service.js';
import { getStorageProvider, LocalStorageProvider } from '../../08_SECURITY/storage-provider.js';
import { handleRemoteApiRoutes } from './remote-api-router.js';

function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Admin-Secret, x-mahi-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
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

function parseRawBuffer(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function getAuthUser(req: http.IncomingMessage): { userId: string; email: string; role: CommercialRole; sessionId?: string } | null {
  const authHeader = (req.headers['authorization'] as string) || (req.headers['x-mahi-token'] ? `Bearer ${req.headers['x-mahi-token']}` : '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const centralPayload = verifyAccessToken(token);
    if (centralPayload) {
      return {
        userId: centralPayload.userId,
        email: centralPayload.email,
        role: centralPayload.role as CommercialRole,
        sessionId: centralPayload.sessionId,
      };
    }
    return verifyToken(token);
  }
  return null;
}

function checkAdminAuth(req: http.IncomingMessage, body?: any): { isAdmin: boolean; actor: { id: string; name: string; role: CommercialRole } } {
  // 1. Check JWT role
  const user = getAuthUser(req);
  if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'SUPPORT' || user.role === 'BILLING')) {
    return {
      isAdmin: true,
      actor: { id: user.userId, name: user.email, role: user.role },
    };
  }

  // 2. Check X-Admin-Secret header or body secret
  const headerSecret = req.headers['x-admin-secret'] as string;
  const secret = headerSecret || (body && body.adminSecret) || '';
  if (secret && (verifyAdminAccess(secret) || isValidAdminWebSecret(secret))) {
    return {
      isAdmin: true,
      actor: { id: 'admin', name: 'Master Administrator', role: 'SUPER_ADMIN' },
    };
  }

  return {
    isAdmin: false,
    actor: { id: 'unknown', name: 'Unauthorized', role: 'USER' },
  };
}

export async function handleCommercialApiRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL
): Promise<boolean> {
  // Support /api/v1/*, direct /auth/*, direct /v1/sync/*, and direct /v1/* routes
  const isApiV1 = pathname.startsWith('/api/v1/');
  const isDirectAuth = pathname.startsWith('/auth/');
  const isDirectSync = pathname.startsWith('/v1/sync/');
  const isDirectV1 = pathname.startsWith('/v1/');
  if (!isApiV1 && !isDirectAuth && !isDirectSync && !isDirectV1) {
    return false;
  }

  // Delegate remote cloud API, cloud browser & webhooks
  if (
    pathname.startsWith('/api/v1/remote/') ||
    pathname.startsWith('/api/v1/cloud-browser') ||
    pathname.startsWith('/api/v1/webhooks') ||
    pathname.startsWith('/v1/')
  ) {
    const handled = await handleRemoteApiRoutes(req, res, pathname, method, parsedUrl);
    if (handled) return true;
  }

  const routePath = isDirectAuth ? `/api/v1${pathname}` : isDirectSync ? `/api${pathname}` : pathname;

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  // -------------------------------------------------------------
  // 1. PUBLIC AUTHENTICATION & REGISTRATION
  // -------------------------------------------------------------
  if (routePath === '/api/v1/auth/register' && method === 'POST') {
    const body = await parseBody(req);
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
    let commUserResult: any;
    try {
      commUserResult = registerUser({
        email: body.email,
        password: body.password,
        name: body.name,
        intent: body.intent,
        planId: body.planId || body.plan,
        billingCycle: body.billingCycle || body.billing,
      }, clientIp, result.user?.id);
    } catch {}

    const registeredUser = commUserResult?.user || result.user;
    const token = commUserResult?.token || result.tokens?.accessToken;
    const isTrial = registeredUser?.signupIntent === 'trial' || body.intent === 'trial';
    const trialExpiresAt = registeredUser?.trialExpiresAt;
    const planId = registeredUser?.planId || (isTrial ? 'professional_50' : 'plan_free');

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

    sendJSON(res, 201, {
      success: true,
      user: registeredUser,
      tokens: result.tokens,
      token,
      trialActive: isTrial,
      trialExpiresAt,
      planId,
    });
    return true;
  }

  if (routePath === '/api/v1/auth/verify-email' && method === 'POST') {
    const body = await parseBody(req);
    const result = await verifyEmailToken(body.token, clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/resend-verification' && method === 'POST') {
    const body = await parseBody(req);
    const result = await resendEmailVerification(body.email, clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/login' && method === 'POST') {
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
  // Google OAuth SSO Endpoints (Phase 19)
  // ============================================================================

  // 1. OAuth Start: Redirects browser to Google OAuth consent
  if (routePath === '/api/v1/auth/google/start' && method === 'GET') {
    const intent = parsedUrl.searchParams.get('intent') || 'trial';
    const planId = parsedUrl.searchParams.get('plan') || parsedUrl.searchParams.get('planId') || 'professional_50';
    const billingCycle = parsedUrl.searchParams.get('billing') || parsedUrl.searchParams.get('billingCycle') || 'annual';
    const returnUrl = parsedUrl.searchParams.get('returnUrl') || '/download';

    const auth = generateOAuthAuthorization({
      intent,
      planId,
      billingCycle,
      returnUrl,
    });

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
      'Access-Control-Allow-Origin': '*',
    });
    res.end();
    return true;
  }

  // 2. OAuth Callback: Validates state, exchanges code, links/creates user, creates session
  if (routePath === '/api/v1/auth/google/callback' && method === 'GET') {
    const code = parsedUrl.searchParams.get('code');
    const state = parsedUrl.searchParams.get('state');
    const error = parsedUrl.searchParams.get('error');

    // Handle user cancellation or OAuth error
    if (error || !state) {
      const stateRecord = state ? validateAndConsumeOAuthState(state) : null;
      const fallbackIntent = stateRecord?.intent || 'trial';
      const fallbackPlan = stateRecord?.planId || 'professional_50';
      const errorMsg = error === 'access_denied' ? 'cancelled' : (error || 'oauth_error');
      res.writeHead(302, {
        Location: `/signup?error=${encodeURIComponent(errorMsg)}&intent=${encodeURIComponent(fallbackIntent)}&plan=${encodeURIComponent(fallbackPlan)}`,
      });
      res.end();
      return true;
    }

    // Validate and consume state (anti-CSRF & single-use)
    const stateRecord = validateAndConsumeOAuthState(state);
    if (!stateRecord) {
      res.writeHead(302, {
        Location: '/signup?error=invalid_state',
      });
      res.end();
      return true;
    }

    if (!code) {
      res.writeHead(302, {
        Location: '/signup?error=missing_code',
      });
      res.end();
      return true;
    }

    try {
      const redirectUri = getGoogleOAuthConfig().defaultRedirectUri;
      const tokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
      const profile = await fetchGoogleProfile(tokens.accessToken);

      const authResult = authenticateWithGoogleClaims(profile, stateRecord, clientIp);
      if (!authResult.success) {
        res.writeHead(302, {
          Location: `/signup?error=${encodeURIComponent(authResult.error || 'auth_failed')}`,
        });
        res.end();
        return true;
      }

      // Establish session cookie and redirect to onboarding / download
      const targetUrl = authResult.returnUrl.startsWith('http')
        ? authResult.returnUrl
        : `${authResult.returnUrl}${authResult.returnUrl.includes('?') ? '&' : '?'}token=${authResult.token}&login=success`;

      res.writeHead(302, {
        Location: targetUrl,
        'Set-Cookie': `mahi_token=${authResult.token}; Path=/; Max-Age=2592000; SameSite=Lax`,
      });
      res.end();
      return true;
    } catch (err: any) {
      res.writeHead(302, {
        Location: `/signup?error=${encodeURIComponent(err.message || 'oauth_exchange_failed')}`,
      });
      res.end();
      return true;
    }
  }

  // 3. Programmatic Google OAuth SSO Endpoint (Used by desktop, mobile, or direct API)
  if (routePath === '/api/v1/auth/google' && method === 'POST') {
    const body = await parseBody(req);
    const googleEmail = (body.email || '').trim().toLowerCase();
    if (!googleEmail || !googleEmail.includes('@')) {
      sendJSON(res, 400, { success: false, error: 'A valid email address is required.' });
      return true;
    }

    const claims: GoogleClaims = {
      sub: body.sub || `google_sub_${crypto.createHash('sha256').update(googleEmail).digest('hex').substring(0, 24)}`,
      email: googleEmail,
      email_verified: body.email_verified !== undefined ? Boolean(body.email_verified) : true,
      name: body.name || googleEmail.split('@')[0],
      picture: body.picture || body.avatarUrl,
    };

    const stateContext: OAuthStateRecord = {
      state: 'direct_post',
      nonce: 'direct_post',
      provider: 'google',
      intent: body.intent || 'trial',
      planId: normalizePlanId(body.planId),
      billingCycle: body.billingCycle || 'annual',
      returnUrl: body.returnUrl || '/download',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const authResult = authenticateWithGoogleClaims(claims, stateContext, clientIp);
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
    const body = await parseBody(req);
    const result = await requestPasswordReset(body.email, clientIp);
    sendJSON(res, 200, result);
    return true;
  }

  if (routePath === '/api/v1/auth/reset-password' && method === 'POST') {
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
    const sessions = listUserSessions(auth.userId, currentSessionId);
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
    const resRevoke = revokeUserSession(auth.userId, body.sessionId, clientIp);
    sendJSON(res, 200, { success: resRevoke.success });
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
    const revokedCount = revokeAllUserSessions(auth.userId, body.keepCurrent ? currentSessionId : undefined, clientIp);
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
    const centralUser = getCentralUserById(auth.userId);
    const commUser = getUserById(auth.userId);
    if (!centralUser && !commUser) {
      sendJSON(res, 404, { success: false, error: 'User not found.' });
      return true;
    }
    const user = {
      ...(commUser || {}),
      ...(centralUser || {}),
      id: auth.userId,
      email: centralUser?.email || commUser?.email,
      name: commUser?.name || centralUser?.name,
      emailVerified: centralUser ? centralUser.emailVerified : true,
      status: centralUser?.status || commUser?.status || 'ACTIVE',
      planId: commUser?.planId || centralUser?.planId || 'plan_free',
      profileQuota: centralUser?.profileQuota || 10,
    };
    const trialStatus = getUserTrialStatus(auth.userId);
    const entitlements = evaluateUserEntitlements(auth.userId);
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
    const result = activateUserTrial(auth.userId, body.planId || 'professional_50');
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

  // Demo Request Lead Submission
  if (routePath === '/api/v1/commercial/demo-request' && method === 'POST') {
    const body = await parseBody(req);
    const result = createDemoRequest(body);
    sendJSON(res, result.success ? 201 : 400, result);
    return true;
  }

  // Admin: Get Demo Requests
  if (routePath === '/api/v1/commercial/admin/demo-requests' && method === 'GET') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const statusFilter = parsedUrl.searchParams.get('status') as DemoRequestStatus | undefined;
    const leads = getDemoRequests(statusFilter);
    sendJSON(res, 200, { success: true, data: leads });
    return true;
  }

  // Admin: Update Demo Request Status
  const demoStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/demo-requests\/([a-zA-Z0-9_-]+)\/status$/);
  if (demoStatusMatch && method === 'PUT') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const demoId = demoStatusMatch[1];
    const body = await parseBody(req);
    const result = updateDemoRequestStatus(demoId, body.status, body.adminNotes, adminAuth.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 20: AI Support Assistant & Payment Escalation Chat Route
  if (
    (routePath === '/api/v1/commercial/support/chat' || routePath === '/api/v1/support/chat') &&
    method === 'POST'
  ) {
    const body = await parseBody(req);
    const result = await handleSupportChatMessage(body);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Phase 20: Admin: List Support Tickets
  if (routePath === '/api/v1/commercial/admin/support-tickets' && method === 'GET') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const category = parsedUrl.searchParams.get('category') || undefined;
    const escalatedOnly = parsedUrl.searchParams.get('escalatedOnly') === 'true';
    const tickets = getSupportTickets({ status, category, escalatedOnly });
    sendJSON(res, 200, { success: true, data: tickets });
    return true;
  }

  // Phase 20: Admin: Update Support Ticket Status
  const ticketStatusMatch = routePath.match(/^\/api\/v1\/commercial\/admin\/support-tickets\/([a-zA-Z0-9_-]+)\/status$/);
  if (ticketStatusMatch && method === 'PUT') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const ticketId = ticketStatusMatch[1];
    const body = await parseBody(req);
    const result = updateSupportTicketStatus(ticketId, body.status, body.adminNotes, adminAuth.actor.name);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Funnel Event Tracking
  if (routePath === '/api/v1/funnel/track' && method === 'POST') {
    const body = await parseBody(req);
    const result = recordFunnelEvent({
      ...body,
      ipAddress: clientIp,
    });
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // Admin: Funnel Metrics Summary
  if (routePath === '/api/v1/commercial/admin/funnel-metrics' && method === 'GET') {
    const adminAuth = checkAdminAuth(req);
    if (!adminAuth.isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Admin authorization required' });
      return true;
    }
    const metrics = getFunnelMetrics();
    sendJSON(res, 200, { success: true, data: metrics });
    return true;
  }

  if (pathname === '/api/v1/entitlements/check' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const deviceId = parsedUrl.searchParams.get('deviceId') || undefined;
    const deviceName = parsedUrl.searchParams.get('deviceName') || undefined;
    const entitlements = evaluateUserEntitlements(auth.userId, deviceId, deviceName);
    sendJSON(res, 200, { success: true, data: entitlements });
    return true;
  }

  if (pathname === '/api/v1/entitlements/activate-key' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const result = activateCommercialLicenseForUser(auth.userId, body.licenseKey, body.deviceId, body.deviceName);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  // -------------------------------------------------------------
  // 3. USER DEVICES (Authenticated)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/devices/my-devices' && method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const devices = getUserDevices(auth.userId);
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  if (pathname === '/api/v1/devices/revoke' && method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Bearer token required.' });
      return true;
    }
    const body = await parseBody(req);
    const ok = revokeCommercialDevice(body.deviceId, { id: auth.userId, name: auth.email, role: auth.role }, auth.userId);
    sendJSON(res, 200, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 4. PLANS & PRICING (Public)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/plans' && method === 'GET') {
    const plans = getCommercialPlans();
    sendJSON(res, 200, { success: true, data: plans });
    return true;
  }

  if ((pathname === '/api/v1/pricing/catalog' || pathname === '/api/v1/plans/catalog') && method === 'GET') {
    try {
      const catalog = buildPlanCatalog();
      sendJSON(res, 200, { success: true, data: catalog });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------
  // 5. SOFTWARE VERSIONS & COMPATIBILITY
  // -------------------------------------------------------------
  if (pathname === '/api/v1/updates/check' && method === 'GET') {
    const clientVersion = parsedUrl.searchParams.get('clientVersion') || '1.0.0';
    const status = checkVersionCompatibility(clientVersion);
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  // -------------------------------------------------------------
  // 6. ADMIN DASHBOARD & FLEET METRICS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/dashboard' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }

    const { users, total: totalUsers } = getAllUsers({ limit: 1000 });
    const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
    const suspendedUsers = users.filter((u) => u.status === 'SUSPENDED').length;
    const bannedUsers = users.filter((u) => u.status === 'BANNED').length;

    const licenses = getLicenses();
    const activeLicenses = licenses.filter((l) => l.status === 'ACTIVE').length;
    const expiredLicenses = licenses.filter((l) => l.status === 'EXPIRED').length;

    const devices = getAllCommercialDevices();
    const activeDevices = devices.filter((d) => d.status === 'ACTIVE').length;

    const plans = getCommercialPlans(true);
    const { logs: recentAuditLogs } = getCommercialAuditLogs({ limit: 10 });

    const stats = {
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      activeLicenses,
      expiredLicenses,
      activeDevices,
      activeSubscriptions: activeUsers,
      totalPlans: plans.length,
      revenueEstMonthly: activeLicenses * 29,
      recentAuditLogs,
    };

    sendJSON(res, 200, { success: true, data: stats });
    return true;
  }

  // -------------------------------------------------------------
  // 7. ADMIN USER MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/users' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const result = getAllUsers({ status, role, searchQuery: search, limit, offset });
    sendJSON(res, 200, { success: true, data: result.users, total: result.total });
    return true;
  }

  const userStatusMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/status$/);
  if (userStatusMatch && method === 'PUT') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userStatusMatch[1];
    const body = await parseBody(req);
    const ok = updateUserStatus(userId, body.status, actor, body.reason);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  const userPlanMatch = pathname.match(/^\/api\/v1\/admin\/users\/([a-zA-Z0-9_-]+)\/plan$/);
  if (userPlanMatch && method === 'PUT') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    const userId = userPlanMatch[1];
    const body = await parseBody(req);
    const ok = updateUserPlan(userId, body.planId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 8. ADMIN PLANS MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/plans' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getCommercialPlans(true) });
    return true;
  }

  if (pathname === '/api/v1/admin/plans' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const newPlan = createCommercialPlan(body, actor);
    sendJSON(res, 201, { success: true, data: newPlan });
    return true;
  }

  const planIdMatch = pathname.match(/^\/api\/v1\/admin\/plans\/([a-zA-Z0-9_-]+)$/);
  if (planIdMatch && method === 'PUT') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const planId = planIdMatch[1];
    const updated = updateCommercialPlan(planId, body, actor);
    sendJSON(res, updated ? 200 : 404, { success: Boolean(updated), data: updated });
    return true;
  }

  // -------------------------------------------------------------
  // 8B. ADMIN PRICING VERSIONING & CATALOG (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/pricing/catalog' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const catalog = buildPlanCatalog();
      sendJSON(res, 200, { success: true, data: catalog });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/versions' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getAllPricingVersions() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/active' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getActivePricingVersion() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/draft' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const draft = createPricingDraft(body, actor.id, actor.name);
      sendJSON(res, 201, { success: true, data: draft });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const pricingDraftUpdateMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/draft\/(\d+)$/);
  if (pricingDraftUpdateMatch && method === 'PUT') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingDraftUpdateMatch[1], 10);
      const updated = updatePricingDraft(version, body, actor.id, actor.name);
      sendJSON(res, updated ? 200 : 404, { success: Boolean(updated), data: updated });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const pricingPreviewMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/preview\/(\d+)$/);
  if (pricingPreviewMatch && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingPreviewMatch[1], 10);
      const preview = previewPricingChanges(version);
      sendJSON(res, 200, { success: true, data: preview });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  const pricingPublishMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/publish\/(\d+)$/);
  if (pricingPublishMatch && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingPublishMatch[1], 10);
      const resPublish = publishPricingVersion(version, actor.id, actor.name);
      sendJSON(res, resPublish.success ? 200 : 400, resPublish);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const pricingRollbackMatch = pathname.match(/^\/api\/v1\/admin\/pricing\/rollback\/(\d+)$/);
  if (pricingRollbackMatch && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    try {
      const version = parseInt(pricingRollbackMatch[1], 10);
      const rolledBack = rollbackPricing(version, actor.id, actor.name);
      sendJSON(res, rolledBack.success ? 200 : 400, rolledBack);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/revenue-summary' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getAdminRevenueSummary() });
    return true;
  }

  if (pathname === '/api/v1/admin/pricing/provider-sync-status' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden. Admin privileges required.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getProviderSyncStatus() });
    return true;
  }

  // -------------------------------------------------------------
  // 9. ADMIN LICENSE MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/licenses' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const licenses = getLicenses({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: licenses });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 403, {
      success: false,
      error: 'License minting is disabled in the app. Contact support.',
    });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses/revoke' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const ok = revokeLicense(body.licenseId, body.reason);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  if (pathname === '/api/v1/admin/licenses/extend' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const record = extendLicense(body);
    sendJSON(res, record ? 200 : 404, { success: Boolean(record), data: record });
    return true;
  }

  // -------------------------------------------------------------
  // 10. ADMIN DEVICE FLEET MANAGEMENT (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/devices' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const status = parsedUrl.searchParams.get('status') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const devices = getAllCommercialDevices({ status, searchQuery: search });
    sendJSON(res, 200, { success: true, data: devices });
    return true;
  }

  const deviceRevokeMatch = pathname.match(/^\/api\/v1\/admin\/devices\/([a-zA-Z0-9_-]+)$/);
  if (deviceRevokeMatch && method === 'DELETE') {
    const { isAdmin, actor } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const deviceId = deviceRevokeMatch[1];
    const ok = revokeCommercialDevice(deviceId, actor);
    sendJSON(res, ok ? 200 : 404, { success: ok });
    return true;
  }

  // -------------------------------------------------------------
  // 11. ADMIN AUDIT LOGS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const action = parsedUrl.searchParams.get('action') || undefined;
    const role = parsedUrl.searchParams.get('role') || undefined;
    const resultStatus = parsedUrl.searchParams.get('result') || undefined;
    const search = parsedUrl.searchParams.get('search') || undefined;
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

    const logs = getCommercialAuditLogs({
      action,
      actorRole: role,
      result: resultStatus,
      searchQuery: search,
      limit,
      offset,
    });
    sendJSON(res, 200, { success: true, data: logs.logs, total: logs.total });
    return true;
  }

  // -------------------------------------------------------------
  // 12. ADMIN SOFTWARE VERSIONS (Protected)
  // -------------------------------------------------------------
  if (pathname === '/api/v1/admin/versions' && method === 'GET') {
    const { isAdmin } = checkAdminAuth(req);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    sendJSON(res, 200, { success: true, data: getSoftwareVersions() });
    return true;
  }

  if (pathname === '/api/v1/admin/versions' && method === 'POST') {
    const body = await parseBody(req);
    const { isAdmin, actor } = checkAdminAuth(req, body);
    if (!isAdmin) {
      sendJSON(res, 403, { success: false, error: 'Forbidden.' });
      return true;
    }
    const version = publishSoftwareVersion(body, actor);
    sendJSON(res, 201, { success: true, data: version });
    return true;
  }

  // -------------------------------------------------------------
  // 13. STORAGE PROVIDER PRESIGNED ENDPOINTS (Local / S3 Fallback)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/storage/upload' && method === 'PUT') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (storage instanceof LocalStorageProvider) {
      const valid = storage.verifyToken(key, 'upload', expires, token);
      if (!valid) {
        sendJSON(res, 403, { success: false, error: 'Invalid or expired upload signature' });
        return true;
      }
    }

    try {
      const buffer = await parseRawBuffer(req);
      const putResult = await storage.putObject(key, buffer);
      sendJSON(res, 200, { success: true, size: putResult.size });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/storage/download' && method === 'GET') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (storage instanceof LocalStorageProvider) {
      const valid = storage.verifyToken(key, 'download', expires, token);
      if (!valid) {
        sendJSON(res, 403, { success: false, error: 'Invalid or expired download signature' });
        return true;
      }
    }

    try {
      const buffer = await storage.getObject(key);
      if (!buffer) {
        sendJSON(res, 404, { success: false, error: 'Object not found' });
        return true;
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buffer);
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------
  // 14. PHASE 2 CLOUD PROFILE SYNC ENDPOINTS (Protected)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/sync/usage' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Login required for cloud sync.' });
      return true;
    }
    const usage = getUserSyncUsage(user.userId);
    sendJSON(res, 200, { success: true, ...usage });
    return true;
  }

  if (routePath === '/api/v1/sync/list' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profiles = listUserCloudProfiles(user.userId);
    sendJSON(res, 200, { success: true, profiles });
    return true;
  }

  const syncProfileDetailMatch = routePath.match(/^\/api\/v1\/sync\/profile\/([a-zA-Z0-9_-]+)$/);
  if (syncProfileDetailMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profile = getCloudProfile(user.userId, syncProfileDetailMatch[1]);
    if (!profile) {
      sendJSON(res, 404, { success: false, error: 'Cloud profile not found' });
      return true;
    }
    sendJSON(res, 200, { success: true, profile });
    return true;
  }

  if (syncProfileDetailMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      await deleteCloudProfile(user.userId, syncProfileDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/upload-session' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await createUploadSession(user.userId, body);
      if (result.conflict) {
        sendJSON(res, 409, { success: false, ...result });
      } else {
        sendJSON(res, 200, { success: true, ...result });
      }
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/finalize-upload' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await finalizeUploadSession(
        user.userId,
        body.sessionId,
        body.profileName,
        body.localProfileId,
        body.deviceId,
        body.deviceName
      );
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/download-session' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await createDownloadSession(user.userId, body.cloudProfileId, body.version);
      sendJSON(res, 200, { success: true, data: result });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/acquire' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = acquireProfileLock(
        user.userId,
        body.cloudProfileId,
        body.deviceId,
        body.deviceName,
        body.ttlSeconds
      );
      sendJSON(res, result.acquired ? 200 : 423, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/renew' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = renewProfileLock(user.userId, body.cloudProfileId, body.deviceId, body.ttlSeconds);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/release' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = releaseProfileLock(user.userId, body.cloudProfileId, body.deviceId);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/status' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profileId = parsedUrl.searchParams.get('cloudProfileId') || '';
    const status = getProfileLockStatus(user.userId, profileId);
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  // -------------------------------------------------------------
  // 15. PHASE 3 TEAM WORKSPACES & RBAC ENDPOINTS (Protected)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/workspaces' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Central login required.' });
      return true;
    }
    const workspaces = listUserTeamWorkspaces(user.userId);
    sendJSON(res, 200, { success: true, workspaces });
    return true;
  }

  if (routePath === '/api/v1/workspaces' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const ws = createTeamWorkspace(user.userId, body);
      sendJSON(res, 201, { success: true, workspace: ws });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/workspaces/invitations/accept' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = acceptWorkspaceInvitation(user.userId, body.token);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsDetailMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)$/);
  if (wsDetailMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const ws = getTeamWorkspace(user.userId, wsDetailMatch[1]);
    if (!ws) {
      sendJSON(res, 404, { success: false, error: 'Workspace not found or access denied.' });
      return true;
    }
    sendJSON(res, 200, { success: true, workspace: ws });
    return true;
  }

  if (wsDetailMatch && method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const updated = updateTeamWorkspace(user.userId, wsDetailMatch[1], body);
      sendJSON(res, 200, { success: true, workspace: updated });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  if (wsDetailMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      deleteTeamWorkspace(user.userId, wsDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsTransferMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/transfer-ownership$/);
  if (wsTransferMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      transferWorkspaceOwnership(user.userId, wsTransferMatch[1], body.newOwnerUserId);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsMembersMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members$/);
  if (wsMembersMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const members = getWorkspaceMembers(user.userId, wsMembersMatch[1]);
      sendJSON(res, 200, { success: true, members });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/invite$/);
  if (wsInviteMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await inviteWorkspaceMember(user.userId, wsInviteMatch[1], body.email, body.role);
      sendJSON(res, 201, { success: true, invitation: result });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsRoleMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)\/role$/);
  if (wsRoleMatch && method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      updateMemberRole(user.userId, wsRoleMatch[1], wsRoleMatch[2], body.role);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsRemoveMemberMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
  if (wsRemoveMemberMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      removeWorkspaceMember(user.userId, wsRemoveMemberMatch[1], wsRemoveMemberMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsListInvitesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations$/);
  if (wsListInvitesMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const invitations = listWorkspaceInvitations(user.userId, wsListInvitesMatch[1]);
      sendJSON(res, 200, { success: true, invitations });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsRevokeInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations\/([a-zA-Z0-9_-]+)\/revoke$/);
  if (wsRevokeInviteMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeWorkspaceInvitation(user.userId, wsRevokeInviteMatch[1], wsRevokeInviteMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsProfilesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles$/);
  if (wsProfilesMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const profiles = listWorkspaceProfiles(user.userId, wsProfilesMatch[1]);
      sendJSON(res, 200, { success: true, profiles });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/share$/);
  if (wsShareMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const share = shareProfileToWorkspace(user.userId, wsShareMatch[1], body);
      sendJSON(res, 200, { success: true, share });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsRevokeShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/([a-zA-Z0-9_-]+)\/share$/);
  if (wsRevokeShareMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeProfileShare(user.userId, wsRevokeShareMatch[1], wsRevokeShareMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsAuditMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/audit-logs$/);
  if (wsAuditMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
      const logs = getWorkspaceAuditLogs(user.userId, wsAuditMatch[1], limit);
      sendJSON(res, 200, { success: true, logs });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsKeyMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/key$/);
  if (wsKeyMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const envelope = getWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1]);
    sendJSON(res, 200, { success: true, keyEnvelope: envelope });
    return true;
  }

  if (wsKeyMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      setWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1], body.targetUserId, body.encryptedKey);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  sendJSON(res, 404, { success: false, error: `Endpoint ${method} ${pathname} not found.` });
  return true;
}

export async function handleCommercialAPIRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  const host = req.headers.host || '127.0.0.1';
  const parsedUrl = new URL(req.url || '/', `http://${host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method || 'GET';
  return handleCommercialApiRoutes(req, res, pathname, method, parsedUrl);
}

