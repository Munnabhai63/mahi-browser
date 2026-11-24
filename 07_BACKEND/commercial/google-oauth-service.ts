import crypto from 'node:crypto';
import https from 'node:https';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import { signToken, getUserById } from './commercial-auth-service.js';
import { CANONICAL_PLAN_CATALOG } from './canonical-plan-catalog.js';
import { recordFunnelEvent } from './funnel-service.js';
import { logCommercialAudit } from './commercial-audit-service.js';
import { CURRENT_TERMS_VERSION } from '../../10_CONFIG/shared/types/commercial.js';

export interface GoogleAuthResult {
  success: boolean;
  token?: string;
  user?: any;
  isNewAccount: boolean;
  isLinked: boolean;
  trialActive: boolean;
  trialExpiresAt?: string | null;
  returnUrl: string;
  error?: string;
}

export function deriveProfileQuota(planId?: string | null): number {
  if (!planId) return 10;
  const canonical = (CANONICAL_PLAN_CATALOG as Record<string, any>)[planId];
  if (canonical?.profileLimit && typeof canonical.profileLimit === 'number') {
    return canonical.profileLimit;
  }
  if (planId.includes('500')) return 500;
  if (planId.includes('300')) return 300;
  if (planId.includes('200')) return 200;
  if (planId.includes('100')) return 100;
  if (planId.includes('50')) return 50;
  if (planId.includes('25')) return 25;
  if (planId.includes('10')) return 10;
  if (planId.includes('free')) return 1;
  return 10;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  defaultRedirectUri: string;
}

export interface GoogleClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface OAuthStateRecord {
  state: string;
  nonce: string;
  provider: string;
  intent: string;
  planId: string;
  billingCycle: string;
  returnUrl: string;
  expiresAt: string;
  createdAt: string;
  acceptedTerms?: boolean | null;
  termsVersion?: string | null;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    defaultRedirectUri: process.env.GOOGLE_REDIRECT_URI || (isProd
      ? 'https://mahibrowser.com/api/v1/auth/google/callback'
      : 'http://localhost:32123/api/v1/auth/google/callback'),
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const config = getGoogleOAuthConfig();
  return Boolean(
    config.clientId &&
    config.clientSecret &&
    config.clientId.trim().length > 10 &&
    config.clientSecret.trim().length > 10
  );
}

/**
 * Checks if a URL is a safe, internal relative path.
 * Rejects external URLs, protocol-relative URLs (//evil.com), javascript:, backslash escapes, etc.
 */
export function isSafeInternalUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Disallow backslashes or path traversal '..' anywhere
  if (trimmed.includes('\\') || trimmed.includes('..')) {
    return false;
  }
  // Disallow control characters or newlines
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return false;
  }

  const ALLOWED_EXACT_OR_PREFIXES = [
    '/dashboard',
    '/download',
    '/pricing',
    '/book-demo',
    '/account',
    '/checkout',
    '/auth',
    '/overview',
  ];

  const TRUSTED_ORIGINS = [
    'https://mahibrowser.com',
    'https://www.mahibrowser.com',
    'https://app.mahibrowser.com',
  ];

  // Case A: Absolute HTTPS URL on a trusted MAHI origin
  if (trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') return false;
      if (!TRUSTED_ORIGINS.includes(parsed.origin.toLowerCase())) return false;
      const pathname = parsed.pathname.toLowerCase();
      if (pathname === '/') return true;
      return ALLOWED_EXACT_OR_PREFIXES.some(prefix =>
        pathname === prefix || pathname.startsWith(prefix + '/')
      );
    } catch {
      return false;
    }
  }

  // Case B: Relative path (must start with single '/' and not '//' or '/\')
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return false;
  }
  // Disallow '//' in relative path
  if (trimmed.includes('//')) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, 'https://mahibrowser.com');
    if (parsed.origin !== 'https://mahibrowser.com') return false;
    const pathname = parsed.pathname.toLowerCase();
    if (pathname === '/') return true;
    return ALLOWED_EXACT_OR_PREFIXES.some(prefix =>
      pathname === prefix || pathname.startsWith(prefix + '/')
    );
  } catch {
    return false;
  }
}

/**
 * Canonical post-auth redirect resolver.
 * Ensures consistent intent-aware destination across all auth surfaces:
 * - normal login -> /dashboard
 * - normal signup -> /dashboard
 * - desktop login -> /auth/desktop-success (GoLogin-style seamless handoff)
 * - trial signup/login -> /dashboard?onboarding=trial (&plan=...)
 * - explicit download CTA -> /download
 * - paid plan intent -> /pricing?plan=...&billing=...
 * - enterprise demo -> /book-demo
 */
export function resolvePostAuthRedirect(params: {
  intent?: string;
  planId?: string;
  billingCycle?: string;
  returnUrl?: string;
  handoff?: string;
} = {}): string {
  const { intent, planId, billingCycle, returnUrl, handoff } = params;

  // 1. If an explicit safe returnUrl was passed, validate and preserve it
  if (returnUrl && isSafeInternalUrl(returnUrl)) {
    return returnUrl.trim();
  }

  // 2. Intent-based canonical routing
  const normalizedIntent = (intent || '').toLowerCase();

  if (normalizedIntent === 'desktop_login' || normalizedIntent === 'desktop') {
    return handoff ? `/auth/desktop-success?handoff=${encodeURIComponent(handoff)}` : '/auth/desktop-success';
  }

  if (normalizedIntent === 'download') {
    return '/download';
  }

  if (normalizedIntent === 'trial') {
    const query = new URLSearchParams();
    query.set('onboarding', 'trial');
    if (planId && planId !== 'free') {
      query.set('plan', planId);
    }
    return `/dashboard?${query.toString()}`;
  }

  if (normalizedIntent === 'paid' || normalizedIntent === 'checkout') {
    const query = new URLSearchParams();
    if (planId) query.set('plan', planId);
    if (billingCycle) query.set('billing', billingCycle);
    const qs = query.toString();
    return qs ? `/pricing?${qs}` : '/pricing';
  }

  if (normalizedIntent === 'demo') {
    return '/book-demo';
  }

  // 3. Default canonical route for normal login / signup
  return '/dashboard';
}

/**
 * Validates a planId against the canonical plan catalog or known aliases
 */
export function normalizePlanId(planId?: string): string {
  if (!planId) return 'professional_50';
  const clean = planId.trim().toLowerCase();
  if (CANONICAL_PLAN_CATALOG[clean as keyof typeof CANONICAL_PLAN_CATALOG]) {
    return clean;
  }
  // Aliases
  if (clean === 'pro_10') return 'professional_10';
  if (clean === 'pro_25') return 'professional_25';
  if (clean === 'pro_50') return 'professional_50';
  if (clean === 'pro_100') return 'professional_100';
  if (clean === 'team_50') return 'business_starter';
  if (clean === 'team_100') return 'business_growth';
  if (clean === 'team_200') return 'business_scale';
  if (clean === 'team_300') return 'business_enterprise';
  return 'professional_50';
}

/**
 * Generates secure OAuth authorization parameters and registers state in SQLite
 */
export function generateOAuthAuthorization(params: {
  intent?: string;
  planId?: string;
  billingCycle?: string;
  returnUrl?: string;
  redirectUri?: string;
  handoff?: string;
  acceptedTerms?: boolean;
  termsVersion?: string;
}): { authUrl: string; state: string; nonce: string; configured: boolean; redirectUri: string } {
  const config = getGoogleOAuthConfig();
  const db = getDatabase();

  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes TTL

  const intent = (params.intent || 'trial').toLowerCase();
  const planId = normalizePlanId(params.planId);
  const billingCycle = (params.billingCycle || 'annual').toLowerCase();
  const returnUrl = resolvePostAuthRedirect({
    intent,
    planId,
    billingCycle,
    returnUrl: params.returnUrl,
    handoff: params.handoff,
  });
  const redirectUri = params.redirectUri || config.defaultRedirectUri;
  const acceptedTermsInt = params.acceptedTerms === true ? 1 : (params.acceptedTerms === false ? 0 : null);
  const termsVersion = params.termsVersion || null;

  db.prepare(`
    INSERT INTO oauth_states (
      state, nonce, provider, intent, plan_id, billing_cycle, return_url, expires_at, created_at, accepted_terms, terms_version
    ) VALUES (?, ?, 'google', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(state, nonce, intent, planId, billingCycle, returnUrl, expiresAt, now, acceptedTermsInt, termsVersion);

  if (!config.clientId || !config.clientSecret) {
    throw new Error('GOOGLE_OAUTH_NOT_CONFIGURED');
  }
  const clientId = config.clientId;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}&nonce=${nonce}&prompt=select_account`;

  return {
    authUrl,
    state,
    nonce,
    configured: isGoogleOAuthConfigured(),
    redirectUri,
  };
}

/**
 * Atomically validates and consumes the OAuth state from SQLite (prevents CSRF and state replay)
 */
export function validateAndConsumeOAuthState(state: string): OAuthStateRecord | null {
  if (!state || typeof state !== 'string') return null;
  const db = getDatabase();

  const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state) as any;
  if (!row) return null;

  // Single-use: delete immediately
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

  if (new Date(row.expires_at) < new Date()) {
    return null; // Expired state
  }

  return {
    state: row.state,
    nonce: row.nonce,
    provider: row.provider,
    intent: row.intent,
    planId: row.plan_id,
    billingCycle: row.billing_cycle,
    returnUrl: row.return_url,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedTerms: row.accepted_terms === 1 ? true : (row.accepted_terms === 0 ? false : null),
    termsVersion: row.terms_version || null,
  };
}

/**
 * Exchanges Google authorization code for tokens server-side
 */
export async function exchangeGoogleAuthorizationCode(code: string, redirectUri: string): Promise<{
  accessToken: string;
  idToken?: string;
  expiresIn?: number;
}> {
  const config = getGoogleOAuthConfig();

  // Explicit failure test trigger
  if (code === 'invalid_code_that_fails' || code.startsWith('error_')) {
    throw new Error('OAUTH_CODE_EXCHANGE_REJECTED: Invalid authorization code');
  }

  // Test / Simulated support for automated tests without hitting live Google servers
  // STRICT SECURITY GUARD: Mock OAuth code exchange is strictly permitted ONLY in test environment
  const isTestEnv = process.env.NODE_ENV === 'test';
  if (isTestEnv && code.startsWith('mock_code_')) {
    return {
      accessToken: `mock_access_token_${code}`,
      idToken: `mock_id_token_${code}`,
      expiresIn: 3600,
    };
  }

  if (!isGoogleOAuthConfigured()) {
    throw new Error('GOOGLE_OAUTH_NOT_CONFIGURED: Missing Google Client ID or Secret.');
  }

  const postData = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(data.error_description || data.error || 'Failed to exchange authorization code'));
          }
          resolve({
            accessToken: data.access_token,
            idToken: data.id_token,
            expiresIn: data.expires_in,
          });
        } catch (err: any) {
          reject(new Error(`Invalid response from Google token endpoint: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Fetches user profile data from Google using access token
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleClaims> {
  // Test / Simulated support: STRICT SECURITY GUARD - only permitted in test environment
  const isTestEnv = process.env.NODE_ENV === 'test';
  if (isTestEnv && accessToken.startsWith('mock_access_token_')) {
    const suffix = accessToken.replace('mock_access_token_', '');
    return {
      sub: `google_sub_${suffix}`,
      email: `${suffix.toLowerCase()}@gmail.com`,
      email_verified: true,
      name: `Google User ${suffix}`,
      given_name: 'Google',
      family_name: suffix,
      picture: `https://lh3.googleusercontent.com/a/mock_avatar_${suffix}`,
    };
  }

  return new Promise((resolve, reject) => {
    const req = https.request('https://www.googleapis.com/oauth2/v3/userinfo', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(data.error_description || data.error || 'Failed to fetch userinfo from Google'));
          }
          resolve({
            sub: data.sub,
            email: data.email,
            email_verified: Boolean(data.email_verified),
            name: data.name,
            given_name: data.given_name,
            family_name: data.family_name,
            picture: data.picture,
          });
        } catch (err: any) {
          reject(new Error(`Invalid response from Google userinfo: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Unifies Google OAuth identity with Central Auth, preserving plan/trial intent
 * Asynchronous version that synchronizes to Supabase PostgreSQL (auth_users) and local SQLite.
 */
export async function authenticateWithGoogleClaimsAsync(
  claims: GoogleClaims,
  stateRecord?: OAuthStateRecord | null,
  clientIp: string = '127.0.0.1'
): Promise<GoogleAuthResult> {
  const db = getDatabase();

  if (!claims.email_verified) {
    return {
      success: false,
      isNewAccount: false,
      isLinked: false,
      trialActive: false,
      returnUrl: '/signup',
      error: 'GOOGLE_EMAIL_NOT_VERIFIED: Your Google account email is not verified.',
    };
  }

  const cleanEmail = claims.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const intent = stateRecord?.intent || 'trial';
  const planId = normalizePlanId(stateRecord?.planId);
  const billingCycle = stateRecord?.billingCycle || 'annual';
  const profileQuota = deriveProfileQuota(planId);
  const returnUrl = resolvePostAuthRedirect({
    intent,
    planId,
    billingCycle,
    returnUrl: stateRecord?.returnUrl,
  });

  const isPg = isPostgresConfigured();
  const repo = isPg ? getCentralRepository() : null;

  // Step 1: Check PostgreSQL auth_users first if PostgreSQL is active
  let pgUser: any = null;
  if (repo) {
    try {
      pgUser = await repo.findAuthUserByEmail(cleanEmail);
    } catch (e: any) {
      console.error('[GoogleOAuth] Failed to query PostgreSQL by email:', e?.message);
      return {
        success: false,
        isNewAccount: false,
        isLinked: false,
        trialActive: false,
        returnUrl: '/signup',
        error: `DATABASE_SYNC_ERROR: Failed to query PostgreSQL auth_users: ${e?.message || 'unknown'}`,
      };
    }
  }

  // Step 2: Check local SQLite commercial_users
  let existingUser = db.prepare('SELECT * FROM commercial_users WHERE google_sub = ?').get(claims.sub) as any;
  if (!existingUser) {
    existingUser = db.prepare('SELECT * FROM commercial_users WHERE email = ?').get(cleanEmail) as any;
  }

  // Step 3: Enforce account status BEFORE updating or issuing a token
  if ((pgUser && pgUser.status && pgUser.status !== 'ACTIVE') || (existingUser && existingUser.status && existingUser.status !== 'ACTIVE')) {
    const suspendedStatus = (pgUser?.status && pgUser.status !== 'ACTIVE') ? pgUser.status : existingUser?.status;
    logCommercialAudit({
      actorId: pgUser?.id || existingUser?.id || 'unknown',
      actorName: claims.name || cleanEmail,
      actorRole: pgUser?.role || existingUser?.role || 'USER',
      action: 'OAUTH_LOGIN_BLOCKED',
      targetType: 'USER',
      targetId: pgUser?.id || existingUser?.id || 'unknown',
      details: `Google login rejected because account is ${suspendedStatus}: ${cleanEmail}`,
      ipAddress: clientIp,
      result: 'FAILURE',
    });
    return {
      success: false,
      isNewAccount: false,
      isLinked: false,
      trialActive: false,
      returnUrl: '/signup',
      error: `ACCOUNT_SUSPENDED: Account is ${suspendedStatus || 'not active'}.`,
    };
  }

  let userId: string;
  let isNewAccount = false;
  let isLinked = false;

  if (pgUser) {
    // Existing user in Supabase PostgreSQL (e.g., registered via email/password or previous OAuth)
    // Reuse/align the ID so existing email-registered Supabase users never get duplicate/mismatched IDs!
    userId = pgUser.id;
    isLinked = !pgUser.google_sub || pgUser.auth_provider !== 'GOOGLE';

    // Update PostgreSQL auth_users (NEVER overwrite status)
    try {
      await repo!.updateAuthUser(userId, {
        google_sub: claims.sub,
        avatar_url: claims.picture || pgUser.avatar_url || null,
        email_verified: 1,
        last_login_at: now,
      });
    } catch (e: any) {
      console.error('[GoogleOAuth] Failed to update PostgreSQL user:', e?.message);
      return {
        success: false,
        isNewAccount: false,
        isLinked: false,
        trialActive: false,
        returnUrl: '/signup',
        error: `DATABASE_SYNC_ERROR: Failed to update user in central PostgreSQL: ${e?.message || 'unknown'}`,
      };
    }

    // Ensure SQLite commercial_users and auth_users match the exact same userId
    if (existingUser) {
      if (existingUser.id !== userId) {
        db.exec('PRAGMA foreign_keys = OFF;');
        db.exec('BEGIN TRANSACTION;');
        try {
          db.prepare(`
            UPDATE commercial_users
            SET id = ?, google_sub = ?, avatar_url = COALESCE(avatar_url, ?), last_login_at = ?, updated_at = ?
            WHERE id = ?
          `).run(userId, claims.sub, claims.picture || null, now, now, existingUser.id);

          try {
            db.prepare(`
              UPDATE auth_users
              SET id = ?, google_sub = ?, avatar_url = COALESCE(avatar_url, ?), email_verified = 1, last_login_at = ?, updated_at = ?
              WHERE id = ? OR email = ? OR normalized_email = ?
            `).run(userId, claims.sub, claims.picture || null, now, now, existingUser.id, cleanEmail, cleanEmail);
          } catch {}

          try {
            db.prepare('UPDATE commercial_subscriptions SET user_id = ? WHERE user_id = ?').run(userId, existingUser.id);
          } catch {}
          try {
            db.prepare('UPDATE auth_sessions SET user_id = ? WHERE user_id = ?').run(userId, existingUser.id);
          } catch {}
          try {
            db.prepare('UPDATE cloud_profiles SET owner_id = ? WHERE owner_id = ?').run(userId, existingUser.id);
          } catch {}

          db.exec('COMMIT;');
        } catch (txErr: any) {
          db.exec('ROLLBACK;');
          console.error('[GoogleOAuth] Failed to align SQLite user ID with PostgreSQL ID:', txErr?.message);
          throw txErr;
        } finally {
          try { db.exec('PRAGMA foreign_keys = ON;'); } catch {}
        }
      } else {
        db.prepare(`
          UPDATE commercial_users
          SET google_sub = ?, avatar_url = COALESCE(avatar_url, ?), last_login_at = ?, updated_at = ?
          WHERE id = ?
        `).run(claims.sub, claims.picture || null, now, now, userId);
        try {
          db.prepare(`
            UPDATE auth_users
            SET google_sub = ?, avatar_url = COALESCE(avatar_url, ?), email_verified = 1, last_login_at = ?, updated_at = ?
            WHERE id = ?
          `).run(claims.sub, claims.picture || null, now, now, userId);
        } catch {}
      }
    } else {
      // Create user in SQLite commercial_users + auth_users with matching pgUser.id
      const displayName = (claims.name || pgUser.name || cleanEmail.split('@')[0] || 'Google User').trim();
      const avatarUrl = claims.picture || pgUser.avatar_url || null;
      const acceptedTermsInt = stateRecord?.acceptedTerms === true ? 1 : (stateRecord?.acceptedTerms === false ? 0 : null);
      const termsVersion = stateRecord?.termsVersion || null;
      db.prepare(`
        INSERT INTO commercial_users (
          id, email, password_hash, salt, name, role, status, plan_id,
          trial_started_at, trial_expires_at, trial_used, signup_intent,
          google_sub, avatar_url, auth_provider, created_at, updated_at, last_login_at,
          accepted_terms, terms_version
        ) VALUES (?, ?, 'OAUTH_GOOGLE', 'OAUTH_GOOGLE', ?, 'USER', ?, ?, ?, ?, ?, ?, ?, ?, 'GOOGLE', ?, ?, ?, ?, ?)
      `).run(
        userId, cleanEmail, displayName, pgUser.status || 'ACTIVE', pgUser.plan_id || planId,
        pgUser.trial_started_at || null, pgUser.trial_expires_at || null, pgUser.trial_used ? 1 : 0, intent,
        claims.sub, avatarUrl, pgUser.created_at || now, now, now,
        acceptedTermsInt, termsVersion
      );

      try {
        db.prepare(`
          INSERT INTO auth_users (
            id, email, normalized_email, password_hash, salt, name, role, status,
            email_verified, email_verified_at, plan_id, profile_quota,
            trial_started_at, trial_expires_at, trial_used, signup_intent,
            google_sub, avatar_url, auth_provider, created_at, updated_at, last_login_at,
            accepted_terms, terms_version
          ) VALUES (?, ?, ?, 'OAUTH_GOOGLE', 'OAUTH_GOOGLE', ?, 'USER', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GOOGLE', ?, ?, ?, ?, ?)
        `).run(
          userId, cleanEmail, cleanEmail, displayName, pgUser.status || 'ACTIVE', now, pgUser.plan_id || planId, pgUser.profile_quota || profileQuota,
          pgUser.trial_started_at || null, pgUser.trial_expires_at || null, pgUser.trial_used ? 1 : 0, intent,
          claims.sub, avatarUrl, pgUser.created_at || now, now, now,
          acceptedTermsInt, termsVersion
        );
      } catch (err) {
        console.error('[GoogleOAuth] SQLite auth_users terms write error', err);
      }

      if (isPostgresConfigured() && repo && acceptedTermsInt !== null) {
        try {
          await repo.updateAuthUserTerms(userId, acceptedTermsInt, termsVersion || CURRENT_TERMS_VERSION);
        } catch (err) {
          console.error('[GoogleOAuth] PG terms write error', err);
        }
      }
    }

    logCommercialAudit({
      actorId: userId,
      actorName: pgUser.name || claims.name || cleanEmail,
      actorRole: pgUser.role || 'USER',
      action: isLinked ? 'OAUTH_LINK_GOOGLE' : 'OAUTH_LOGIN_GOOGLE',
      targetType: 'USER',
      targetId: userId,
      details: `Google identity (${claims.sub}) linked/authenticated to Supabase user: ${cleanEmail}`,
      ipAddress: clientIp,
      result: 'SUCCESS',
    });

  } else if (existingUser) {
    // Existing user in SQLite, but not found in PostgreSQL (heal-create in PostgreSQL)
    userId = existingUser.id;
    isLinked = !existingUser.google_sub || existingUser.auth_provider !== 'GOOGLE';

    // Update SQLite commercial_users and auth_users
    db.prepare(`
      UPDATE commercial_users
      SET google_sub = ?, avatar_url = COALESCE(avatar_url, ?), last_login_at = ?, updated_at = ?
      WHERE id = ?
    `).run(claims.sub, claims.picture || null, now, now, userId);

    try {
      db.prepare(`
        UPDATE auth_users
        SET google_sub = ?, avatar_url = COALESCE(avatar_url, ?), email_verified = 1, last_login_at = ?, updated_at = ?
        WHERE id = ?
      `).run(claims.sub, claims.picture || null, now, now, userId);
    } catch {}

    // Heal-create in PostgreSQL auth_users
    if (repo) {
      const displayName = (claims.name || existingUser.name || cleanEmail.split('@')[0] || 'Google User').trim();
      const userPlan = existingUser.plan_id || planId;
      const userQuota = deriveProfileQuota(userPlan);
      try {
        await repo.createAuthUser({
          id: userId,
          email: cleanEmail,
          normalized_email: cleanEmail,
          password_hash: existingUser.password_hash || 'OAUTH_GOOGLE',
          salt: existingUser.salt || 'OAUTH_GOOGLE',
          name: displayName,
          role: existingUser.role || 'USER',
          status: existingUser.status || 'ACTIVE',
          email_verified: 1,
          email_verified_at: now,
          plan_id: userPlan,
          profile_quota: userQuota,
          trial_started_at: existingUser.trial_started_at || null,
          trial_expires_at: existingUser.trial_expires_at || null,
          trial_used: existingUser.trial_used ? 1 : 0,
          signup_intent: existingUser.signup_intent || intent,
          google_sub: claims.sub,
          avatar_url: claims.picture || existingUser.avatar_url || null,
          auth_provider: 'GOOGLE',
          created_at: existingUser.created_at || now,
          updated_at: now,
          last_login_at: now,
        });
      } catch (e: any) {
        console.error('[GoogleOAuth] Failed to heal-create user in PostgreSQL:', e?.message);
        return {
          success: false,
          isNewAccount: false,
          isLinked: false,
          trialActive: false,
          returnUrl: '/signup',
          error: `DATABASE_SYNC_ERROR: Failed to heal-create user in central PostgreSQL: ${e?.message || 'unknown'}`,
        };
      }
    }

    logCommercialAudit({
      actorId: userId,
      actorName: existingUser.name,
      actorRole: existingUser.role || 'USER',
      action: isLinked ? 'OAUTH_LINK_GOOGLE' : 'OAUTH_LOGIN_GOOGLE',
      targetType: 'USER',
      targetId: userId,
      details: `User logged in via Google OAuth: ${cleanEmail}`,
      ipAddress: clientIp,
      result: 'SUCCESS',
    });

  } else {
    // Brand new user account creation in both SQLite and Supabase PostgreSQL
    isNewAccount = true;
    userId = `usr_${crypto.randomUUID()}`;
    const displayName = (claims.name || cleanEmail.split('@')[0] || 'Google User').trim();
    const avatarUrl = claims.picture || null;
    const isTrial = intent === 'trial';
    const trialStartedAt = isTrial ? now : null;
    const trialExpiresAt = isTrial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
    const trialUsed = isTrial ? 1 : 0;
    const pendingPlanId = intent === 'paid' ? planId : null;
    const pendingBillingCycle = intent === 'paid' ? billingCycle : null;
    const acceptedTermsInt = stateRecord?.acceptedTerms === true ? 1 : (stateRecord?.acceptedTerms === false ? 0 : null);
    const termsVersion = stateRecord?.termsVersion || null;

    // Insert into SQLite commercial_users
    db.prepare(`
      INSERT INTO commercial_users (
        id, email, password_hash, salt, name, role, status, plan_id,
        trial_started_at, trial_expires_at, trial_used, signup_intent,
        pending_plan_id, pending_billing_cycle, google_sub, avatar_url, auth_provider,
        created_at, updated_at, last_login_at,
        accepted_terms, terms_version
      ) VALUES (?, ?, 'OAUTH_GOOGLE', 'OAUTH_GOOGLE', ?, 'USER', 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GOOGLE', ?, ?, ?, ?, ?)
    `).run(
      userId, cleanEmail, displayName, planId,
      trialStartedAt, trialExpiresAt, trialUsed, intent,
      pendingPlanId, pendingBillingCycle, claims.sub, avatarUrl,
      now, now, now,
      acceptedTermsInt, termsVersion
    );

    // Insert into SQLite auth_users
    try {
      db.prepare(`
        INSERT INTO auth_users (
          id, email, normalized_email, password_hash, salt, name, role, status,
          email_verified, email_verified_at, plan_id, profile_quota,
          trial_started_at, trial_expires_at, trial_used, signup_intent,
          google_sub, avatar_url, auth_provider, created_at, updated_at, last_login_at,
          accepted_terms, terms_version
        ) VALUES (?, ?, ?, 'OAUTH_GOOGLE', 'OAUTH_GOOGLE', ?, 'USER', 'ACTIVE', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GOOGLE', ?, ?, ?, ?, ?)
      `).run(
        userId, cleanEmail, cleanEmail, displayName, now, planId, profileQuota,
        trialStartedAt, trialExpiresAt, trialUsed, intent,
        claims.sub, avatarUrl, now, now, now,
        acceptedTermsInt, termsVersion
      );
    } catch (err) {
      console.error('[GoogleOAuth] SQLite auth_users insert error', err);
    }

    // Insert into Supabase PostgreSQL auth_users via repo
    if (repo) {
      try {
        await repo.createAuthUser({
          id: userId,
          email: cleanEmail,
          normalized_email: cleanEmail,
          password_hash: 'OAUTH_GOOGLE',
          salt: 'OAUTH_GOOGLE',
          name: displayName,
          role: 'USER',
          status: 'ACTIVE',
          email_verified: 1,
          email_verified_at: now,
          plan_id: planId,
          profile_quota: profileQuota,
          trial_started_at: trialStartedAt,
          trial_expires_at: trialExpiresAt,
          trial_used: trialUsed,
          signup_intent: intent,
          google_sub: claims.sub,
          avatar_url: avatarUrl,
          auth_provider: 'GOOGLE',
          created_at: now,
          updated_at: now,
          last_login_at: now,
          accepted_terms: acceptedTermsInt !== null ? acceptedTermsInt : 0,
          terms_version: termsVersion || CURRENT_TERMS_VERSION,
        });
      } catch (e: any) {
        console.error('[GoogleOAuth] Failed to create user in PostgreSQL:', e?.message);
        try {
          db.prepare('DELETE FROM commercial_users WHERE id = ?').run(userId);
          db.prepare('DELETE FROM auth_users WHERE id = ?').run(userId);
          db.prepare('DELETE FROM commercial_subscriptions WHERE user_id = ?').run(userId);
        } catch {}
        return {
          success: false,
          isNewAccount: false,
          isLinked: false,
          trialActive: false,
          returnUrl: '/signup',
          error: `DATABASE_SYNC_ERROR: Failed to create user in central PostgreSQL: ${e?.message || 'unknown'}`,
        };
      }
    }

    if (isTrial) {
      const subId = `sub_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO commercial_subscriptions (
          id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
        ) VALUES (?, ?, ?, 'ACTIVE', 'TRIAL', ?, ?, 'GOOGLE_OAUTH_TRIAL', ?)
      `).run(subId, userId, planId, now, trialExpiresAt, now);
    }

    logCommercialAudit({
      actorId: userId,
      actorName: displayName,
      actorRole: 'USER',
      action: 'OAUTH_REGISTER_GOOGLE',
      targetType: 'USER',
      targetId: userId,
      details: `New user account created via Google OAuth: ${cleanEmail} (Plan: ${planId})`,
      ipAddress: clientIp,
      result: 'SUCCESS',
    });

    try {
      recordFunnelEvent({
        eventName: 'signup_completed',
        userId,
        planId,
        ipAddress: clientIp,
        metadata: { provider: 'google', intent, planId },
      });
      if (isTrial) {
        recordFunnelEvent({
          eventName: 'trial_activated',
          userId,
          planId,
          ipAddress: clientIp,
        });
      }
    } catch {}
  }

  // Retrieve unified user record
  const user = getUserById(userId) || {
    id: userId,
    email: cleanEmail,
    name: (claims.name || pgUser?.name || cleanEmail.split('@')[0] || 'Google User').trim(),
    role: (pgUser?.role || 'USER') as any,
    status: (pgUser?.status || 'ACTIVE') as any,
    planId: pgUser?.plan_id || planId,
    trialExpiresAt: pgUser?.trial_expires_at || null,
    avatarUrl: claims.picture || pgUser?.avatar_url || null,
    createdAt: pgUser?.created_at || now,
    updatedAt: now,
  };
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  const isTrialActive = Boolean(
    user.trialExpiresAt && new Date(user.trialExpiresAt) > new Date()
  );

  return {
    success: true,
    token,
    user: {
      ...user,
      googleSub: claims.sub,
      avatarUrl: claims.picture || user.avatarUrl,
    },
    isNewAccount,
    isLinked,
    trialActive: isTrialActive,
    trialExpiresAt: user.trialExpiresAt,
    returnUrl,
  };
}

/**
 * Synchronous backward-compatible wrapper for authenticateWithGoogleClaims.
 * Performs synchronous SQLite operations and triggers background PostgreSQL sync when PostgreSQL is active.
 */
export function authenticateWithGoogleClaims(
  claims: GoogleClaims,
  stateRecord?: OAuthStateRecord | null,
  clientIp: string = '127.0.0.1'
): GoogleAuthResult {
  const db = getDatabase();

  if (!claims.email_verified) {
    return {
      success: false,
      isNewAccount: false,
      isLinked: false,
      trialActive: false,
      returnUrl: '/signup',
      error: 'GOOGLE_EMAIL_NOT_VERIFIED: Your Google account email is not verified.',
    };
  }

  const cleanEmail = claims.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const intent = stateRecord?.intent || 'trial';
  const planId = normalizePlanId(stateRecord?.planId);
  const billingCycle = stateRecord?.billingCycle || 'annual';
  const profileQuota = deriveProfileQuota(planId);
  const returnUrl = resolvePostAuthRedirect({
    intent,
    planId,
    billingCycle,
    returnUrl: stateRecord?.returnUrl,
  });

  // Check 1: Find existing user by google_sub
  let existingUser = db.prepare('SELECT * FROM commercial_users WHERE google_sub = ?').get(claims.sub) as any;
  let isLinked = false;
  let isNewAccount = false;

  // Check 2: Find existing user by email (Account Linking)
  if (!existingUser) {
    const userByEmail = db.prepare('SELECT * FROM commercial_users WHERE email = ?').get(cleanEmail) as any;
    if (userByEmail) {
      existingUser = userByEmail;
      isLinked = true;
    }
  }

  // Enforce account status BEFORE updating or issuing a token
  if (existingUser && existingUser.status && existingUser.status !== 'ACTIVE') {
    return {
      success: false,
      isNewAccount: false,
      isLinked: false,
      trialActive: false,
      returnUrl: '/signup',
      error: `ACCOUNT_SUSPENDED: Account is ${existingUser.status || 'not active'}.`,
    };
  }

  if (existingUser && isLinked) {
    db.prepare(`
      UPDATE commercial_users
      SET google_sub = ?,
          avatar_url = COALESCE(avatar_url, ?),
          updated_at = ?
      WHERE id = ?
    `).run(claims.sub, claims.picture || null, now, existingUser.id);

    try {
      db.prepare(`
        UPDATE auth_users
        SET google_sub = ?,
            avatar_url = COALESCE(avatar_url, ?),
            email_verified = 1,
            updated_at = ?
        WHERE id = ?
      `).run(claims.sub, claims.picture || null, now, existingUser.id);
    } catch {}

    logCommercialAudit({
      actorId: existingUser.id,
      actorName: existingUser.name,
      actorRole: 'USER',
      action: 'OAUTH_LINK_GOOGLE',
      targetType: 'USER',
      targetId: existingUser.id,
      details: `Linked Google account (${claims.sub}) to existing user: ${cleanEmail}`,
      ipAddress: clientIp,
      result: 'SUCCESS',
    });
  }

  // Case 3: Brand New User Account Creation
  let userId: string;
  if (!existingUser) {
    isNewAccount = true;
    userId = `usr_${crypto.randomUUID()}`;
    const displayName = (claims.name || cleanEmail.split('@')[0] || 'Google User').trim();
    const avatarUrl = claims.picture || null;

    const isTrial = intent === 'trial';
    const trialStartedAt = isTrial ? now : null;
    const trialExpiresAt = isTrial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
    const trialUsed = isTrial ? 1 : 0;
    const pendingPlanId = intent === 'paid' ? planId : null;
    const pendingBillingCycle = intent === 'paid' ? billingCycle : null;
    const acceptedTermsInt = stateRecord?.acceptedTerms === true ? 1 : (stateRecord?.acceptedTerms === false ? 0 : null);
    const termsVersion = stateRecord?.termsVersion || null;

    db.prepare(`
      INSERT INTO commercial_users (
        id, email, password_hash, salt, name, role, status, plan_id,
        trial_started_at, trial_expires_at, trial_used, signup_intent,
        pending_plan_id, pending_billing_cycle, google_sub, avatar_url, auth_provider,
        created_at, updated_at, last_login_at,
        accepted_terms, terms_version
      ) VALUES (?, ?, 'OAUTH_GOOGLE', 'OAUTH_GOOGLE', ?, 'USER', 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GOOGLE', ?, ?, ?, ?, ?)
    `).run(
      userId, cleanEmail, displayName, planId,
      trialStartedAt, trialExpiresAt, trialUsed, intent,
      pendingPlanId, pendingBillingCycle, claims.sub, avatarUrl,
      now, now, now,
      acceptedTermsInt, termsVersion
    );

    try {
      db.prepare(`
        INSERT INTO auth_users (
          id, email, normalized_email, password_hash, salt, name, role, status,
          email_verified, email_verified_at, plan_id, profile_quota,
          trial_started_at, trial_expires_at, trial_used, signup_intent,
          google_sub, avatar_url, auth_provider, created_at, updated_at, last_login_at,
          accepted_terms, terms_version
        ) VALUES (?, ?, ?, 'OAUTH_GOOGLE', 'OAUTH_GOOGLE', ?, 'USER', 'ACTIVE', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GOOGLE', ?, ?, ?, ?, ?)
      `).run(
        userId, cleanEmail, cleanEmail, displayName, now, planId, profileQuota,
        trialStartedAt, trialExpiresAt, trialUsed, intent,
        claims.sub, avatarUrl, now, now, now,
        acceptedTermsInt, termsVersion
      );
    } catch {}

    if (isTrial) {
      const subId = `sub_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO commercial_subscriptions (
          id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
        ) VALUES (?, ?, ?, 'ACTIVE', 'TRIAL', ?, ?, 'GOOGLE_OAUTH_TRIAL', ?)
      `).run(subId, userId, planId, now, trialExpiresAt, now);
    }

    logCommercialAudit({
      actorId: userId,
      actorName: displayName,
      actorRole: 'USER',
      action: 'OAUTH_REGISTER_GOOGLE',
      targetType: 'USER',
      targetId: userId,
      details: `New user account created via Google OAuth: ${cleanEmail} (Plan: ${planId})`,
      ipAddress: clientIp,
      result: 'SUCCESS',
    });

    try {
      recordFunnelEvent({
        eventName: 'signup_completed',
        userId,
        planId,
        ipAddress: clientIp,
        metadata: { provider: 'google', intent, planId },
      });
      if (isTrial) {
        recordFunnelEvent({
          eventName: 'trial_activated',
          userId,
          planId,
          ipAddress: clientIp,
        });
      }
    } catch {}

  } else {
    // Existing User Login: Update last login and avatar
    userId = existingUser.id;
    if (claims.picture && !existingUser.avatar_url) {
      db.prepare('UPDATE commercial_users SET avatar_url = ? WHERE id = ?').run(claims.picture, userId);
    }
    db.prepare('UPDATE commercial_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, userId);

    logCommercialAudit({
      actorId: userId,
      actorName: existingUser.name,
      actorRole: existingUser.role || 'USER',
      action: 'OAUTH_LOGIN_GOOGLE',
      targetType: 'USER',
      targetId: userId,
      details: `User logged in via Google OAuth: ${cleanEmail}`,
      ipAddress: clientIp,
      result: 'SUCCESS',
    });
  }

  // Retrieve unified user record
  const user = getUserById(userId) || {
    id: userId,
    email: cleanEmail,
    name: (claims.name || existingUser?.name || cleanEmail.split('@')[0] || 'Google User').trim(),
    role: (existingUser?.role || 'USER') as any,
    status: (existingUser?.status || 'ACTIVE') as any,
    planId: existingUser?.plan_id || planId,
    trialExpiresAt: existingUser?.trial_expires_at || null,
    avatarUrl: claims.picture || existingUser?.avatar_url || null,
    createdAt: existingUser?.created_at || now,
    updatedAt: now,
  };
  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  // Evaluate trial state
  const isTrialActive = Boolean(
    user.trialExpiresAt && new Date(user.trialExpiresAt) > new Date()
  );

  return {
    success: true,
    token,
    user: {
      ...user,
      googleSub: claims.sub,
      avatarUrl: claims.picture || user.avatarUrl,
    },
    isNewAccount,
    isLinked,
    trialActive: isTrialActive,
    trialExpiresAt: user.trialExpiresAt,
    returnUrl,
  };
}
