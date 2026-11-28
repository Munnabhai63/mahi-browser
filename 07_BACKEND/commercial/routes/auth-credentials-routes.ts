import type http from 'node:http';
import {
  sendJSON,
  parseBody,
  checkAuthRateLimitAsync,
  buildWebAuthCookies,
  appendSetCookies,
} from './router-shared.js';
import { validateStrictBody } from '../../utils/app-error.js';
import {
  LegacySignupSchema,
  LegacyLoginSchema,
  AuthRegisterSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  AuthLoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../validation/commercial-schemas.js';
import {
  registerCentralUser,
  verifyEmailToken,
  resendEmailVerification,
  loginCentralUser,
  requestPasswordReset,
  resetPasswordWithToken,
  getCentralUserByEmail,
} from '../../../05_AUTH/central-auth-service.js';
import { registerUser, loginUser, getUserById } from '../commercial-auth-service.js';
import { evaluateUserEntitlements, getUserTrialStatus } from '../commercial-entitlement-service.js';
import { TRIAL_CONFIG } from '../canonical-plan-catalog.js';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../../06_DATABASE/central-repository.js';
import { recordFunnelEvent } from '../funnel-service.js';
import { reconcileUserPlanOnLogin } from '../commercial-reconcile-service.js';
import { CURRENT_TERMS_VERSION } from '../../../10_CONFIG/shared/types/commercial.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('auth-credentials-routes');

export async function handleAuthCredentialRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  method: string,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if (routePath === '/v1/account/signup' && method === 'POST') {
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(LegacySignupSchema, rawBody, res);
    if (!parsed.ok) return true;
    const { email, password, name } = parsed.data;
    if (!email || !password) {
      sendJSON(res, 400, { success: false, error: 'Email and password required' });
      return true;
    }
    const result = await registerCentralUser({ email, password, name, ipAddress: clientIp });
    if (!result.success) {
      sendJSON(res, 400, { success: false, error: result.error });
      return true;
    }
    if (result.tokens?.accessToken) {
      appendSetCookies(
        res,
        buildWebAuthCookies({
          req,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        })
      );
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
    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(LegacyLoginSchema, rawBody, res);
    if (!parsed.ok) return true;
    const { email, password, hwid } = parsed.data;
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
    if (result.tokens?.accessToken) {
      appendSetCookies(
        res,
        buildWebAuthCookies({
          req,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        })
      );
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
    const rate = await checkAuthRateLimitAsync(clientIp, 'register');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AuthRegisterSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
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
    const regEmail = (body.email || '').trim();
    const regPassword = body.password || '';
    const regIntent = (body.intent === 'paid' || body.intent === 'trial' ? body.intent : 'free') as 'free' | 'trial' | 'paid';
    const result = await registerCentralUser({
      email: regEmail,
      password: regPassword,
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

    const termsVer = CURRENT_TERMS_VERSION;
    const acceptedTermsVal = 1;
    const termsVersionVal = termsVer;
    let termsSaved = false;

    if (result.user?.id) {
      try {
        const db = getDatabase();
        const info = db.prepare('UPDATE auth_users SET accepted_terms = ?, terms_version = ? WHERE id = ?').run(acceptedTermsVal, termsVersionVal, result.user.id);
        if (info.changes > 0) termsSaved = true;
        db.prepare('UPDATE commercial_users SET accepted_terms = ?, terms_version = ? WHERE id = ?').run(acceptedTermsVal, termsVersionVal, result.user.id);
      } catch (err) {
        log.error('[Registration] SQLite auth_users terms write error', err);
      }

      if (isPostgresConfigured()) {
        try {
          const pgOk = await getCentralRepository().updateAuthUserTerms(result.user.id, acceptedTermsVal, termsVersionVal);
          if (pgOk) termsSaved = true;
        } catch (err) {
          log.error('[Registration] PG terms write error', err);
        }
      }
    }

    if (!termsSaved) {
      log.error('[Registration][CRITICAL] Terms consent could not be saved to ANY store for user', result.user?.id);
      sendJSON(res, 500, { success: false, error: 'Registration failed to persist legal consent. Please retry.' });
      return true;
    }

    let commUserResult: ReturnType<typeof registerUser> | undefined;
    try {
      commUserResult = registerUser({
        email: regEmail,
        password: regPassword,
        name: body.name,
        intent: regIntent,
        planId: body.planId || body.plan || body.requestedPlan,
        billingCycle: body.billingCycle || body.billing,
        acceptedTerms: true,
        termsVersion: termsVer,
      }, clientIp, result.user?.id);
    } catch (err: unknown) {
      log.error(`[REGISTER] commercial mirror write failed for user ${result.user?.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    const commUser = commUserResult?.user;
    const registeredUser = commUser || result.user;
    const token = commUserResult?.token || result.tokens?.accessToken;
    const isTrial = commUser?.signupIntent === 'trial' || body.intent === 'trial';
    const trialExpiresAt = commUser?.trialExpiresAt;
    const planId = registeredUser?.planId || (isTrial ? TRIAL_CONFIG.trialPlanId : 'plan_free');

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
    } catch (funnelErr) {
      log.debug('Skipped register funnel event logging', {
        err: funnelErr instanceof Error ? funnelErr.message : String(funnelErr),
      });
    }

    const registeredUserId = registeredUser?.id || result.user?.id;
    const trialStatus = registeredUserId ? getUserTrialStatus(registeredUserId) : { isTrialActive: isTrial, daysRemaining: isTrial ? 7 : 0, isEligibleForTrial: !isTrial };
    const entitlements = registeredUserId ? evaluateUserEntitlements(registeredUserId) : null;

    const authCookieToken = result.tokens?.accessToken || token;
    if (authCookieToken) {
      appendSetCookies(
        res,
        buildWebAuthCookies({
          req,
          accessToken: authCookieToken,
          refreshToken: result.tokens?.refreshToken,
        })
      );
    }

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
    const rate = await checkAuthRateLimitAsync(clientIp, 'verify-email');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many verification attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(VerifyEmailSchema, rawBody, res);
    if (!parsed.ok) return true;
    const result = await verifyEmailToken(parsed.data.token || '', clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/resend-verification' && method === 'POST') {
    const rate = await checkAuthRateLimitAsync(clientIp, 'resend-verification');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many verification requests. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(ResendVerificationSchema, rawBody, res);
    if (!parsed.ok) return true;
    const result = await resendEmailVerification(parsed.data.email || '', clientIp);
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  if (routePath === '/api/v1/auth/login' && method === 'POST') {
    const rate = await checkAuthRateLimitAsync(clientIp, 'login');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many login attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(AuthLoginSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const centralRes = await loginCentralUser({
      email: body.email || '',
      password: body.password || '',
      deviceId: body.deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      ipAddress: clientIp,
    });

    if (centralRes.success && centralRes.user && centralRes.tokens) {
      try {
        await reconcileUserPlanOnLogin(centralRes.user.id);
      } catch (err) {
        log.error('[Login] Reconcile error:', err);
      }
      const commUser = getUserById(centralRes.user.id);
      const isTrial = Boolean(commUser?.trialExpiresAt && new Date(commUser.trialExpiresAt).getTime() > Date.now());
      const entitlements = evaluateUserEntitlements(centralRes.user.id, body.deviceId, body.deviceName);
      appendSetCookies(
        res,
        buildWebAuthCookies({
          req,
          accessToken: centralRes.tokens.accessToken,
          refreshToken: centralRes.tokens.refreshToken,
        })
      );
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

    const loginEmail = (body.email || '').trim();
    const loginPassword = body.password || '';
    const centralUserExists = loginEmail ? getCentralUserByEmail(loginEmail) : null;
    if (!centralUserExists && loginEmail && loginPassword) {
      const legacyResult = loginUser(
        { ...body, email: loginEmail, password: loginPassword },
        clientIp
      );
      if (legacyResult.success && legacyResult.user) {
        try {
          await reconcileUserPlanOnLogin(legacyResult.user.id);
        } catch (err) {
          log.error('[Login] Reconcile error:', err);
        }
        const entitlements = evaluateUserEntitlements(legacyResult.user.id, body.deviceId, body.deviceName);
        if (legacyResult.token) {
          appendSetCookies(
            res,
            buildWebAuthCookies({
              req,
              accessToken: legacyResult.token,
            })
          );
        }
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

  if (routePath === '/api/v1/auth/forgot-password' && method === 'POST') {
    const rate = await checkAuthRateLimitAsync(clientIp, 'forgot-password');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many password reset requests. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(ForgotPasswordSchema, rawBody, res);
    if (!parsed.ok) return true;
    const result = await requestPasswordReset(parsed.data.email || '', clientIp);
    sendJSON(res, 200, result);
    return true;
  }

  if (routePath === '/api/v1/auth/reset-password' && method === 'POST') {
    const rate = await checkAuthRateLimitAsync(clientIp, 'reset-password');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      sendJSON(res, 429, {
        success: false,
        error: 'Too many password reset attempts. Please try again later.',
        retryAfter: rate.retryAfterSeconds,
      });
      return true;
    }

    const rawBody = await parseBody(req);
    const parsed = validateStrictBody(ResetPasswordSchema, rawBody, res);
    if (!parsed.ok) return true;
    const body = parsed.data;
    const result = await resetPasswordWithToken({
      token: body.token || '',
      newPassword: body.newPassword || body.password || '',
      ipAddress: clientIp,
    });
    sendJSON(res, result.success ? 200 : 400, result);
    return true;
  }

  return false;
}
