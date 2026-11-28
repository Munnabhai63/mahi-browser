import crypto from 'node:crypto';
import { getDatabase } from '../06_DATABASE/connection.js';
import { getJwtSecret } from '../08_SECURITY/install-secrets.js';
import { getEmailProvider } from './email-service.js';
import { isPostgresConfigured, getCentralRepository } from '../06_DATABASE/central-repository.js';
import {
  checkAttemptLockoutAsync,
  recordFailedAttemptAsync,
  clearAttemptsAsync,
} from '../08_SECURITY/distributed-state-service.js';
import { websiteUrl } from '../10_CONFIG/shared/site-config.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('central-auth-service');

function mapRowToAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email || row.normalizedEmail || row.email.toLowerCase(),
    name: row.name || 'User',
    role: (row.role as AuthUserRole) || 'USER',
    status: (row.status as AuthUserStatus) || 'ACTIVE',
    emailVerified: row.email_verified === 1 || row.email_verified === true || Boolean(row.emailVerified),
    emailVerifiedAt: row.email_verified_at || row.emailVerifiedAt || undefined,
    planId: row.plan_id || row.planId || 'plan_free',
    profileQuota: row.profile_quota ?? row.profileQuota ?? 10,
    googleSub: row.google_sub || row.googleSub || undefined,
    avatarUrl: row.avatar_url || row.avatarUrl || undefined,
    authProvider: row.auth_provider || row.authProvider || undefined,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    lastLoginAt: row.last_login_at || row.lastLoginAt || undefined,
  };
}

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================
export const ACCESS_TOKEN_EXP_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_EXP_DAYS = 30;        // 30 days
export const VERIFY_TOKEN_EXP_HOURS = 24;        // 24 hours
export const RESET_TOKEN_EXP_HOURS = 1;          // 1 hour
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;  // 15 minutes

export type AuthUserStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'DISABLED';
export type AuthUserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  normalizedEmail: string;
  name: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  planId: string;
  profileQuota: number;
  googleSub?: string;
  avatarUrl?: string;
  authProvider?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  ipAddress?: string;
  isRevoked: boolean;
  isCurrent?: boolean;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// In-memory rate limiting map for brute-force protection
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

// ============================================================================
// CRYPTOGRAPHY & HASHING HELPERS
// ============================================================================
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const calculatedHash = hashPassword(password, salt);
    const bufA = Buffer.from(calculatedHash, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPasswordSecure(password: string): string {
  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  return `pbkdf2_sha256$100000$${salt}$${hash}`;
}

export function verifyPasswordSecure(password: string, encodedHash: string): boolean {
  try {
    if (!encodedHash || typeof encodedHash !== 'string') return false;
    const parts = encodedHash.split('$');
    if (parts.length !== 4) return false;
    const [, , salt, hash] = parts;
    return verifyPassword(password, salt, hash);
  } catch {
    return false;
  }
}

// ============================================================================
// JWT ACCESS TOKEN GENERATION & VERIFICATION
// ============================================================================
export interface JWTPayload {
  userId: string;
  email: string;
  role: AuthUserRole;
  planId: string;
  profileQuota: number;
  sessionId: string;
  exp: number;
}

export function signAccessToken(payload: Omit<JWTPayload, 'exp'>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXP_SECONDS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token: string): JWTPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expectedSig = crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url');
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expectedSig);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JWTPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================
export function logSecurityEvent(userId: string | null, action: string, details: string, result: 'SUCCESS' | 'FAILURE' | 'BLOCKED', ipAddress?: string): void {
  try {
    if (isPostgresConfigured()) {
      const repo = getCentralRepository();
      repo.logAuthSecurity(userId, action, details, ipAddress || '127.0.0.1', result).catch((err: unknown) => {
        log.debug('Async PG security audit log write failed', {
          action,
          err: err instanceof Error ? err.message : String(err),
        });
      });
      return;
    }
    const db = getDatabase();
    const id = `sec_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO auth_security_logs (id, user_id, action, ip_address, details, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, action, ipAddress || '127.0.0.1', details, result, now);
  } catch (err: any) {
    log.error('[CentralAuth] Security log error:', err?.message);
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================
function checkLoginRateLimit(key: string): { allowed: boolean; remainingMs?: number } {
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.lockedUntil > now) {
    return { allowed: false, remainingMs: record.lockedUntil - now };
  }

  if (now > record.lockedUntil && record.lockedUntil > 0) {
    loginAttempts.delete(key);
  }

  return { allowed: true };
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOGIN_LOCKOUT_MS;
  }
  loginAttempts.set(key, record);
}

export async function checkLoginRateLimitAsync(
  key: string
): Promise<{ allowed: boolean; remainingMs?: number }> {
  const res = await checkAttemptLockoutAsync({
    namespace: 'login_lock',
    key,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    windowMs: LOGIN_LOCKOUT_MS,
  });
  if (!res.allowed) {
    return { allowed: false, remainingMs: res.remainingMs };
  }
  return { allowed: true };
}

export async function recordLoginFailureAsync(key: string): Promise<void> {
  await recordFailedAttemptAsync({
    namespace: 'login_lock',
    key,
    windowMs: LOGIN_LOCKOUT_MS,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
  });
}

export async function clearLoginAttemptsAsync(key: string): Promise<void> {
  loginAttempts.delete(key);
  await clearAttemptsAsync({ namespace: 'login_lock', key });
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

// Periodic cleanup of stale rate limits
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts.entries()) {
    if (v.lockedUntil > 0 && v.lockedUntil < now) {
      loginAttempts.delete(k);
    }
  }
}, 60 * 1000).unref();

// ============================================================================
// USER REGISTRATION & EMAIL VERIFICATION
// ============================================================================
export async function registerCentralUser(params: {
  email: string;
  password: string;
  name?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; user?: AuthUser; tokens?: AuthTokens; error?: string }> {
  const rawEmail = (params.email || '').trim();
  const normalizedEmail = rawEmail.toLowerCase();

  if (!rawEmail || !normalizedEmail.includes('@') || normalizedEmail.length < 5) {
    return { success: false, error: 'A valid email address is required.' };
  }

  if (!params.password || params.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const existing = await repo.findAuthUserByEmail(normalizedEmail);
    if (existing) {
      logSecurityEvent(null, 'REGISTER_DUPLICATE', `Registration blocked for existing email: ${normalizedEmail}`, 'BLOCKED', params.ipAddress);
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const salt = generateSalt();
    const passwordHash = hashPassword(params.password, salt);
    const now = new Date().toISOString();
    const name = (params.name || normalizedEmail.split('@')[0] || 'User').trim();
    const planId = 'plan_free';
    const profileQuota = 10;
    const role: AuthUserRole = 'USER';
    const status: AuthUserStatus = 'PENDING_VERIFICATION';

    await repo.createAuthUser({
      id: userId,
      email: normalizedEmail,
      normalized_email: normalizedEmail,
      password_hash: passwordHash,
      salt,
      name,
      role,
      status,
      email_verified: 0,
      email_verified_at: null,
      plan_id: planId,
      profile_quota: profileQuota,
      created_at: now,
      updated_at: now,
      last_login_at: now,
    });

    try {
      await repo.createCommercialUser({
        id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        salt,
        name,
        role,
        status: 'ACTIVE',
        plan_id: planId,
        created_at: now,
        updated_at: now,
        last_login_at: now,
      });
    } catch (syncErr) {
      log.warn('Failed creating companion PG commercial_users record on register', {
        userId,
        err: syncErr instanceof Error ? syncErr.message : String(syncErr),
      });
    }

    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawVerifyToken);
    const tokenId = `tok_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

    await repo.createVerificationToken({
      id: tokenId,
      token_hash: tokenHash,
      user_id: userId,
      email: normalizedEmail,
      type: 'EMAIL_VERIFICATION',
      expires_at: expiresAt,
      created_at: now,
    });

    const verifyUrl = websiteUrl(`/verify-email?token=${rawVerifyToken}`, { productionFallback: true });
    try {
      await getEmailProvider().sendVerificationEmail(rawEmail, rawVerifyToken, verifyUrl);
    } catch (err: any) {
      log.warn('[CentralAuth] Failed to send verification email:', err?.message);
    }

    logSecurityEvent(userId, 'REGISTER', `New user registered: ${normalizedEmail}`, 'SUCCESS', params.ipAddress);

    const sessionId = `ses_${crypto.randomUUID()}`;
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshHash = hashToken(rawRefreshToken);
    const sessionExp = new Date(Date.now() + REFRESH_TOKEN_EXP_DAYS * 24 * 3600 * 1000).toISOString();

    await repo.createAuthSession({
      id: sessionId,
      user_id: userId,
      refresh_token_hash: refreshHash,
      device_id: 'dev-desktop-initial',
      device_name: 'Primary Device',
      platform: process.platform || 'windows',
      ip_address: params.ipAddress || '127.0.0.1',
      is_revoked: 0,
      created_at: now,
      last_used_at: now,
      expires_at: sessionExp,
    });

    const accessToken = signAccessToken({
      userId,
      email: rawEmail,
      role,
      planId,
      profileQuota,
      sessionId,
    });

    const userRow = await repo.findAuthUserById(userId);
    return {
      success: true,
      user: mapRowToAuthUser(userRow),
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: ACCESS_TOKEN_EXP_SECONDS,
        tokenType: 'Bearer',
      },
    };
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM auth_users WHERE normalized_email = ?').get(normalizedEmail);
  if (existing) {
    logSecurityEvent(null, 'REGISTER_DUPLICATE', `Registration blocked for existing email: ${normalizedEmail}`, 'BLOCKED', params.ipAddress);
    return { success: false, error: 'An account with this email address already exists.' };
  }

  const userId = `usr_${crypto.randomUUID()}`;
  const salt = generateSalt();
  const passwordHash = hashPassword(params.password, salt);
  const now = new Date().toISOString();
  const name = (params.name || normalizedEmail.split('@')[0] || 'User').trim();
  const planId = 'plan_free';
  const profileQuota = 10;
  const role: AuthUserRole = 'USER';
  const status: AuthUserStatus = 'PENDING_VERIFICATION';

  db.prepare(`
    INSERT INTO auth_users (
      id, email, normalized_email, password_hash, salt, name, role, status, email_verified, email_verified_at, plan_id, profile_quota, created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?)
  `).run(userId, normalizedEmail, normalizedEmail, passwordHash, salt, name, role, status, planId, profileQuota, now, now, now);

  try {
    db.prepare(`
      INSERT OR REPLACE INTO commercial_users (
        id, email, password_hash, salt, name, role, status, plan_id, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, passwordHash, salt, name, role, 'ACTIVE', planId, now, now, now);
  } catch (syncErr) {
    log.warn('Failed creating companion SQLite commercial_users record on register', {
      userId,
      err: syncErr instanceof Error ? syncErr.message : String(syncErr),
    });
  }

  // Generate Email Verification Token
  const rawVerifyToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawVerifyToken);
  const tokenId = `tok_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO auth_verification_tokens (id, token_hash, user_id, email, type, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'EMAIL_VERIFICATION', ?, ?)
  `).run(tokenId, tokenHash, userId, normalizedEmail, expiresAt, now);

  // Send verification email via provider
  const verifyUrl = websiteUrl(`/verify-email?token=${rawVerifyToken}`, { productionFallback: true });
  try {
    await getEmailProvider().sendVerificationEmail(rawEmail, rawVerifyToken, verifyUrl);
  } catch (err: any) {
    log.warn('[CentralAuth] Failed to send verification email:', err?.message);
  }

  logSecurityEvent(userId, 'REGISTER', `New user registered: ${normalizedEmail}`, 'SUCCESS', params.ipAddress);

  // Create initial session
  const sessionId = `ses_${crypto.randomUUID()}`;
  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  const refreshHash = hashToken(rawRefreshToken);
  const sessionExp = new Date(Date.now() + REFRESH_TOKEN_EXP_DAYS * 24 * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO auth_sessions (
      id, user_id, refresh_token_hash, device_id, device_name, platform, ip_address, is_revoked, created_at, last_used_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(sessionId, userId, refreshHash, 'dev-desktop-initial', 'Primary Device', process.platform || 'windows', params.ipAddress || '127.0.0.1', now, now, sessionExp);

  const accessToken = signAccessToken({
    userId,
    email: rawEmail,
    role,
    planId,
    profileQuota,
    sessionId,
  });

  const user = getCentralUserById(userId)!;

  return {
    success: true,
    user,
    tokens: {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_EXP_SECONDS,
      tokenType: 'Bearer',
    },
  };
}

export async function verifyEmailToken(rawToken: string, ipAddress?: string): Promise<{ success: boolean; error?: string }> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, error: 'Verification token is required.' };
  }

  const tokenHash = hashToken(rawToken);

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const row = await repo.findVerificationTokenByHash(tokenHash);
    if (!row) {
      return { success: false, error: 'Invalid or expired verification token.' };
    }
    if (row.used_at) {
      return { success: false, error: 'This verification token has already been used.' };
    }
    const now = new Date().toISOString();
    if (row.expires_at < now) {
      return { success: false, error: 'Verification token has expired. Please request a new one.' };
    }
    await repo.consumeVerificationToken(tokenHash);
    await repo.updateAuthUser(row.user_id, {
      email_verified: 1,
      email_verified_at: now,
      status: 'ACTIVE',
    });
    logSecurityEvent(row.user_id, 'VERIFY_EMAIL', `Email verified for ${row.email}`, 'SUCCESS', ipAddress);
    return { success: true };
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM auth_verification_tokens 
    WHERE token_hash = ? AND type = 'EMAIL_VERIFICATION'
  `).get(tokenHash) as any;

  if (!row) {
    return { success: false, error: 'Invalid or expired verification token.' };
  }

  if (row.used_at) {
    return { success: false, error: 'This verification token has already been used.' };
  }

  const now = new Date().toISOString();
  if (row.expires_at < now) {
    return { success: false, error: 'Verification token has expired. Please request a new one.' };
  }

  // Mark token used and user verified
  db.prepare('UPDATE auth_verification_tokens SET used_at = ? WHERE id = ?').run(now, row.id);
  db.prepare("UPDATE auth_users SET email_verified = 1, email_verified_at = ?, status = 'ACTIVE', updated_at = ? WHERE id = ?").run(now, now, row.user_id);

  logSecurityEvent(row.user_id, 'VERIFY_EMAIL', `Email verified for ${row.email}`, 'SUCCESS', ipAddress);

  return { success: true };
}

export async function resendEmailVerification(email: string, ipAddress?: string): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const user = await repo.findAuthUserByEmail(normalizedEmail);
    if (!user) {
      return { success: true };
    }
    if (user.email_verified === 1 || user.email_verified === true) {
      return { success: false, error: 'Email is already verified.' };
    }
    const now = new Date().toISOString();
    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawVerifyToken);
    const tokenId = `tok_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

    await repo.invalidatePendingVerificationTokens(user.id, 'EMAIL_VERIFICATION');
    await repo.createVerificationToken({
      id: tokenId,
      token_hash: tokenHash,
      user_id: user.id,
      email: normalizedEmail,
      type: 'EMAIL_VERIFICATION',
      expires_at: expiresAt,
      created_at: now,
    });

    const verifyUrl = websiteUrl(`/verify-email?token=${rawVerifyToken}`, { productionFallback: true });
    await getEmailProvider().sendVerificationEmail(user.email, rawVerifyToken, verifyUrl);
    logSecurityEvent(user.id, 'RESEND_VERIFICATION', `Resent verification to ${normalizedEmail}`, 'SUCCESS', ipAddress);
    return { success: true };
  }

  const db = getDatabase();
  const user = db.prepare('SELECT id, email, email_verified, status FROM auth_users WHERE normalized_email = ?').get(normalizedEmail) as any;

  if (!user) {
    // Return generic success to prevent email enumeration
    return { success: true };
  }

  if (user.email_verified) {
    return { success: false, error: 'Email is already verified.' };
  }

  const now = new Date().toISOString();
  const rawVerifyToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawVerifyToken);
  const tokenId = `tok_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

  // Invalidate previous pending verification tokens for this user
  db.prepare(`
    UPDATE auth_verification_tokens SET used_at = ? 
    WHERE user_id = ? AND type = 'EMAIL_VERIFICATION' AND used_at IS NULL
  `).run(now, user.id);

  db.prepare(`
    INSERT INTO auth_verification_tokens (id, token_hash, user_id, email, type, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'EMAIL_VERIFICATION', ?, ?)
  `).run(tokenId, tokenHash, user.id, normalizedEmail, expiresAt, now);

  const verifyUrl = websiteUrl(`/verify-email?token=${rawVerifyToken}`, { productionFallback: true });
  await getEmailProvider().sendVerificationEmail(user.email, rawVerifyToken, verifyUrl);

  logSecurityEvent(user.id, 'RESEND_VERIFICATION', `Resent verification to ${normalizedEmail}`, 'SUCCESS', ipAddress);

  return { success: true };
}

// ============================================================================
// LOGIN & SESSIONS
// ============================================================================
export async function loginCentralUser(params: {
  email: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; user?: AuthUser; session?: { id: string; deviceId: string; deviceName: string; platform: string }; tokens?: AuthTokens; error?: string; lockedRemainingMs?: number }> {
  const rawEmail = (params.email || '').trim();
  const normalizedEmail = rawEmail.toLowerCase();
  const rateLimitKey = `${params.ipAddress || '127.0.0.1'}:${normalizedEmail}`;

  const rateCheck = await checkLoginRateLimitAsync(rateLimitKey);
  if (!rateCheck.allowed) {
    logSecurityEvent(null, 'LOGIN_LOCKED', `Login locked out for ${normalizedEmail}`, 'BLOCKED', params.ipAddress);
    return {
      success: false,
      error: 'Too many failed login attempts. Please try again in 15 minutes.',
      lockedRemainingMs: rateCheck.remainingMs,
    };
  }

  if (!rawEmail || !params.password) {
    return { success: false, error: 'Email and password are required.' };
  }

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const row = await repo.findAuthUserByEmail(normalizedEmail);
    if (!row) {
      await recordLoginFailureAsync(rateLimitKey);
      logSecurityEvent(null, 'LOGIN_FAILED', `Non-existent user attempted: ${normalizedEmail}`, 'FAILURE', params.ipAddress);
      return { success: false, error: 'Invalid email or password.' };
    }

    if (row.password_hash === 'OAUTH_GOOGLE' || (!row.password_hash && row.google_sub) || (row.auth_provider === 'GOOGLE' && row.password_hash === 'OAUTH_GOOGLE')) {
      return {
        success: false,
        error: 'This account was created with Google Sign-In and has no password set. Please use "Continue with Google" or use "Forgot Password" to set a password.',
      };
    }

    const isValid = verifyPassword(params.password, row.salt, row.password_hash);
    if (!isValid) {
      await recordLoginFailureAsync(rateLimitKey);
      logSecurityEvent(row.id, 'LOGIN_FAILED', `Invalid password for user: ${normalizedEmail}`, 'FAILURE', params.ipAddress);
      return { success: false, error: 'Invalid email or password.' };
    }

    if (row.status === 'SUSPENDED') {
      logSecurityEvent(row.id, 'LOGIN_BLOCKED', `Suspended user attempted login: ${normalizedEmail}`, 'BLOCKED', params.ipAddress);
      return { success: false, error: 'Your account has been suspended. Please contact support.' };
    }

    if (row.status === 'DISABLED') {
      logSecurityEvent(row.id, 'LOGIN_BLOCKED', `Disabled user attempted login: ${normalizedEmail}`, 'BLOCKED', params.ipAddress);
      return { success: false, error: 'Your account has been disabled.' };
    }

    await clearLoginAttemptsAsync(rateLimitKey);

    const now = new Date().toISOString();
    await repo.updateAuthUser(row.id, { last_login_at: now });

    const sessionId = `ses_${crypto.randomUUID()}`;
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshHash = hashToken(rawRefreshToken);
    const sessionExp = new Date(Date.now() + REFRESH_TOKEN_EXP_DAYS * 24 * 3600 * 1000).toISOString();
    const deviceId = params.deviceId || `dev_${crypto.randomUUID().substring(0, 8)}`;
    const deviceName = params.deviceName || 'Windows PC';
    const platform = params.platform || process.platform || 'windows';

    await repo.createAuthSession({
      id: sessionId,
      user_id: row.id,
      refresh_token_hash: refreshHash,
      device_id: deviceId,
      device_name: deviceName,
      platform,
      ip_address: params.ipAddress || '127.0.0.1',
      is_revoked: 0,
      created_at: now,
      last_used_at: now,
      expires_at: sessionExp,
    });

    const accessToken = signAccessToken({
      userId: row.id,
      email: row.email,
      role: row.role as AuthUserRole,
      planId: row.plan_id || row.planId,
      profileQuota: row.profile_quota ?? row.profileQuota ?? 10,
      sessionId,
    });

    logSecurityEvent(row.id, 'LOGIN_SUCCESS', `User logged in from ${deviceName} (${platform})`, 'SUCCESS', params.ipAddress);

    return {
      success: true,
      user: mapRowToAuthUser(row),
      session: {
        id: sessionId,
        deviceId,
        deviceName,
        platform,
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: ACCESS_TOKEN_EXP_SECONDS,
        tokenType: 'Bearer',
      },
    };
  }

  const db = getDatabase();
  const row = db.prepare('SELECT * FROM auth_users WHERE normalized_email = ?').get(normalizedEmail) as any;
  if (!row) {
    await recordLoginFailureAsync(rateLimitKey);
    logSecurityEvent(null, 'LOGIN_FAILED', `Non-existent user attempted: ${normalizedEmail}`, 'FAILURE', params.ipAddress);
    return { success: false, error: 'Invalid email or password.' };
  }

  if (row.password_hash === 'OAUTH_GOOGLE' || (!row.password_hash && row.google_sub) || (row.auth_provider === 'GOOGLE' && row.password_hash === 'OAUTH_GOOGLE')) {
    return {
      success: false,
      error: 'This account was created with Google Sign-In and has no password set. Please use "Continue with Google" or use "Forgot Password" to set a password.',
    };
  }

  const isValid = verifyPassword(params.password, row.salt, row.password_hash);
  if (!isValid) {
    await recordLoginFailureAsync(rateLimitKey);
    logSecurityEvent(row.id, 'LOGIN_FAILED', `Invalid password for user: ${normalizedEmail}`, 'FAILURE', params.ipAddress);
    return { success: false, error: 'Invalid email or password.' };
  }

  // Account status check
  if (row.status === 'SUSPENDED') {
    logSecurityEvent(row.id, 'LOGIN_BLOCKED', `Suspended user attempted login: ${normalizedEmail}`, 'BLOCKED', params.ipAddress);
    return { success: false, error: 'Your account has been suspended. Please contact support.' };
  }

  if (row.status === 'DISABLED') {
    logSecurityEvent(row.id, 'LOGIN_BLOCKED', `Disabled user attempted login: ${normalizedEmail}`, 'BLOCKED', params.ipAddress);
    return { success: false, error: 'Your account has been disabled.' };
  }

  // Clear rate limits on success
  await clearLoginAttemptsAsync(rateLimitKey);

  const now = new Date().toISOString();
  db.prepare('UPDATE auth_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, row.id);

  // Create persistent session
  const sessionId = `ses_${crypto.randomUUID()}`;
  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  const refreshHash = hashToken(rawRefreshToken);
  const sessionExp = new Date(Date.now() + REFRESH_TOKEN_EXP_DAYS * 24 * 3600 * 1000).toISOString();
  const deviceId = params.deviceId || `dev_${crypto.randomUUID().substring(0, 8)}`;
  const deviceName = params.deviceName || 'Windows PC';
  const platform = params.platform || process.platform || 'windows';

  db.prepare(`
    INSERT INTO auth_sessions (
      id, user_id, refresh_token_hash, device_id, device_name, platform, ip_address, is_revoked, created_at, last_used_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(sessionId, row.id, refreshHash, deviceId, deviceName, platform, params.ipAddress || '127.0.0.1', now, now, sessionExp);

  const accessToken = signAccessToken({
    userId: row.id,
    email: row.email,
    role: row.role as AuthUserRole,
    planId: row.plan_id,
    profileQuota: row.profile_quota,
    sessionId,
  });

  logSecurityEvent(row.id, 'LOGIN_SUCCESS', `User logged in from ${deviceName} (${platform})`, 'SUCCESS', params.ipAddress);

  const user = getCentralUserById(row.id)!;

  return {
    success: true,
    user,
    session: {
      id: sessionId,
      deviceId,
      deviceName,
      platform,
    },
    tokens: {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_EXP_SECONDS,
      tokenType: 'Bearer',
    },
  };
}

// ============================================================================
// TOKEN REFRESH & ROTATION
// ============================================================================
export async function refreshAccessToken(rawRefreshToken: string, ipAddress?: string): Promise<{
  success: boolean;
  tokens?: AuthTokens;
  user?: AuthUser;
  error?: string;
}> {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    return { success: false, error: 'Refresh token is required.' };
  }

  const refreshHash = hashToken(rawRefreshToken);

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const session = await repo.findAuthSessionByTokenHash(refreshHash);
    if (!session) {
      return { success: false, error: 'Invalid or revoked refresh session.' };
    }
    if (session.is_revoked === 1 || session.is_revoked === true) {
      logSecurityEvent(session.user_id, 'REFRESH_REVOKED', `Attempted refresh on revoked session: ${session.id}`, 'BLOCKED', ipAddress);
      return { success: false, error: 'This session has been revoked. Please sign in again.' };
    }
    const now = new Date().toISOString();
    if (session.expires_at < now) {
      return { success: false, error: 'Session has expired. Please sign in again.' };
    }
    const userRow = await repo.findAuthUserById(session.user_id);
    if (!userRow || userRow.status === 'SUSPENDED' || userRow.status === 'DISABLED') {
      return { success: false, error: 'Account is no longer active.' };
    }
    const user = mapRowToAuthUser(userRow);
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshHash = hashToken(newRawRefreshToken);
    const newSessionExp = new Date(Date.now() + REFRESH_TOKEN_EXP_DAYS * 24 * 3600 * 1000).toISOString();

    await repo.updateAuthSession(session.id, {
      refresh_token_hash: newRefreshHash,
      last_used_at: now,
      expires_at: newSessionExp,
      ip_address: ipAddress || session.ip_address || '127.0.0.1',
    });

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      planId: user.planId,
      profileQuota: user.profileQuota,
      sessionId: session.id,
    });

    return {
      success: true,
      user,
      tokens: {
        accessToken,
        refreshToken: newRawRefreshToken,
        expiresIn: ACCESS_TOKEN_EXP_SECONDS,
        tokenType: 'Bearer',
      },
    };
  }

  const db = getDatabase();
  const session = db.prepare('SELECT * FROM auth_sessions WHERE refresh_token_hash = ?').get(refreshHash) as any;

  if (!session) {
    return { success: false, error: 'Invalid or revoked refresh session.' };
  }

  if (session.is_revoked === 1) {
    logSecurityEvent(session.user_id, 'REFRESH_REVOKED', `Attempted refresh on revoked session: ${session.id}`, 'BLOCKED', ipAddress);
    return { success: false, error: 'This session has been revoked. Please sign in again.' };
  }

  const now = new Date().toISOString();
  if (session.expires_at < now) {
    return { success: false, error: 'Session has expired. Please sign in again.' };
  }

  const user = getCentralUserById(session.user_id);
  if (!user || user.status === 'SUSPENDED' || user.status === 'DISABLED') {
    return { success: false, error: 'Account is no longer active.' };
  }

  // Refresh Token Rotation: Rotate old refresh token with new random token
  const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
  const newRefreshHash = hashToken(newRawRefreshToken);
  const newSessionExp = new Date(Date.now() + REFRESH_TOKEN_EXP_DAYS * 24 * 3600 * 1000).toISOString();

  db.prepare(`
    UPDATE auth_sessions 
    SET refresh_token_hash = ?, last_used_at = ?, expires_at = ?, ip_address = ?
    WHERE id = ?
  `).run(newRefreshHash, now, newSessionExp, ipAddress || session.ip_address || '127.0.0.1', session.id);

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    planId: user.planId,
    profileQuota: user.profileQuota,
    sessionId: session.id,
  });

  return {
    success: true,
    user,
    tokens: {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: ACCESS_TOKEN_EXP_SECONDS,
      tokenType: 'Bearer',
    },
  };
}

export const refreshCentralSession = refreshAccessToken;

// ============================================================================
// LOGOUT & SESSION REVOCATION
// ============================================================================
export function logoutSession(sessionId: string, ipAddress?: string): boolean {
  if (!sessionId) return false;
  const db = getDatabase();
  const session = db.prepare('SELECT user_id FROM auth_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) return false;

  db.prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE id = ?').run(sessionId);
  logSecurityEvent(session.user_id, 'LOGOUT', `Logged out session: ${sessionId}`, 'SUCCESS', ipAddress);
  return true;
}

export function listUserSessions(userId: string, currentSessionId?: string): AuthSessionRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM auth_sessions 
    WHERE user_id = ? AND is_revoked = 0 
    ORDER BY last_used_at DESC
  `).all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    user_id: r.user_id,
    deviceId: r.device_id,
    device_id: r.device_id,
    deviceName: r.device_name,
    device_name: r.device_name,
    platform: r.platform,
    ipAddress: r.ip_address,
    ip_address: r.ip_address,
    isRevoked: r.is_revoked === 1,
    is_revoked: r.is_revoked === 1,
    isCurrent: currentSessionId ? r.id === currentSessionId : false,
    is_current: currentSessionId ? r.id === currentSessionId : false,
    createdAt: r.created_at,
    created_at: r.created_at,
    lastUsedAt: r.last_used_at,
    last_used_at: r.last_used_at,
    expiresAt: r.expires_at,
    expires_at: r.expires_at,
  }));
}

export function revokeUserSession(
  arg1: string,
  arg2: string,
  ipAddress?: string
): { success: boolean } {
  const db = getDatabase();
  const res = db.prepare(`
    UPDATE auth_sessions SET is_revoked = 1 
    WHERE (id = ? AND user_id = ?) OR (id = ? AND user_id = ?)
  `).run(arg1, arg2, arg2, arg1);
  const ok = res.changes > 0;
  if (ok) {
    const userId = arg1.startsWith('usr_') ? arg1 : arg2;
    const sessId = arg1.startsWith('usr_') ? arg2 : arg1;
    logSecurityEvent(userId, 'REVOKE_SESSION', `Revoked session: ${sessId}`, 'SUCCESS', ipAddress);
  }
  return { success: ok };
}

export function revokeAllUserSessions(userId: string, exceptSessionId?: string, ipAddress?: string): number {
  const db = getDatabase();
  let query = 'UPDATE auth_sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0';
  const params: any[] = [userId];

  if (exceptSessionId) {
    query += ' AND id != ?';
    params.push(exceptSessionId);
  }

  const res = db.prepare(query).run(...params);
  logSecurityEvent(userId, 'REVOKE_ALL_SESSIONS', `Revoked ${res.changes} session(s)${exceptSessionId ? ` (kept ${exceptSessionId})` : ''}`, 'SUCCESS', ipAddress);
  return res.changes;
}

// ============================================================================
// FORGOT PASSWORD & RESET PASSWORD
// ============================================================================
export async function requestPasswordReset(email: string, ipAddress?: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const safeMessage = 'If an account exists with that email, a password reset link has been dispatched.';

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const user = await repo.findAuthUserByEmail(normalizedEmail);
    if (!user || user.status === 'DISABLED') {
      return { success: true, message: safeMessage };
    }
    const now = new Date().toISOString();
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawResetToken);
    const tokenId = `tok_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

    await repo.invalidatePendingVerificationTokens(user.id, 'PASSWORD_RESET');
    await repo.createVerificationToken({
      id: tokenId,
      token_hash: tokenHash,
      user_id: user.id,
      email: normalizedEmail,
      type: 'PASSWORD_RESET',
      expires_at: expiresAt,
      created_at: now,
    });

    const resetUrl = websiteUrl(`/reset-password?token=${rawResetToken}`, { productionFallback: true });
    try {
      await getEmailProvider().sendPasswordResetEmail(user.email, rawResetToken, resetUrl);
    } catch (err: any) {
      log.warn('[CentralAuth] Failed to send password reset email:', err?.message);
    }

    logSecurityEvent(user.id, 'PASSWORD_RESET_REQUESTED', `Reset token issued for ${normalizedEmail}`, 'SUCCESS', ipAddress);
    return { success: true, message: safeMessage };
  }

  const db = getDatabase();
  const user = db.prepare('SELECT id, email, status FROM auth_users WHERE normalized_email = ?').get(normalizedEmail) as any;

  if (!user || user.status === 'DISABLED') {
    return { success: true, message: safeMessage };
  }

  const now = new Date().toISOString();
  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawResetToken);
  const tokenId = `tok_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

  // Invalidate any existing unused reset tokens
  db.prepare(`
    UPDATE auth_verification_tokens SET used_at = ? 
    WHERE user_id = ? AND type = 'PASSWORD_RESET' AND used_at IS NULL
  `).run(now, user.id);

  db.prepare(`
    INSERT INTO auth_verification_tokens (id, token_hash, user_id, email, type, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'PASSWORD_RESET', ?, ?)
  `).run(tokenId, tokenHash, user.id, normalizedEmail, expiresAt, now);

  const resetUrl = websiteUrl(`/reset-password?token=${rawResetToken}`, { productionFallback: true });
  try {
    await getEmailProvider().sendPasswordResetEmail(user.email, rawResetToken, resetUrl);
  } catch (err: any) {
    log.warn('[CentralAuth] Failed to send password reset email:', err?.message);
  }

  logSecurityEvent(user.id, 'PASSWORD_RESET_REQUESTED', `Reset token issued for ${normalizedEmail}`, 'SUCCESS', ipAddress);

  return { success: true, message: safeMessage };
}

export async function resetPasswordWithToken(
  tokenOrParams: string | { token: string; newPassword: string; ipAddress?: string },
  maybeNewPassword?: string,
  maybeIpAddress?: string
): Promise<{ success: boolean; error?: string }> {
  let token = '';
  let newPassword = '';
  let ipAddress = maybeIpAddress;

  if (typeof tokenOrParams === 'object') {
    token = tokenOrParams.token;
    newPassword = tokenOrParams.newPassword;
    ipAddress = tokenOrParams.ipAddress || ipAddress;
  } else {
    token = tokenOrParams;
    newPassword = maybeNewPassword || '';
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Reset token is required.' };
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long.' };
  }

  const tokenHash = hashToken(token);

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const row = await repo.findVerificationTokenByHash(tokenHash);
    if (!row) {
      return { success: false, error: 'Invalid or expired password reset link.' };
    }
    if (row.used_at) {
      return { success: false, error: 'This password reset link has already been used.' };
    }
    const now = new Date().toISOString();
    if (row.expires_at < now) {
      return { success: false, error: 'Password reset link has expired. Please request a new one.' };
    }
    const newSalt = generateSalt();
    const newPasswordHash = hashPassword(newPassword, newSalt);
    await repo.updateAuthUser(row.user_id, {
      password_hash: newPasswordHash,
      salt: newSalt,
      updated_at: now,
    });
    try {
      await repo.updateCommercialUser(row.user_id, {
        password_hash: newPasswordHash,
        salt: newSalt,
        updated_at: now,
      });
    } catch (syncErr) {
      log.warn('Failed updating PG commercial_users password on reset', {
        userId: row.user_id,
        err: syncErr instanceof Error ? syncErr.message : String(syncErr),
      });
    }
    await repo.consumeVerificationToken(tokenHash);
    await repo.revokeAllUserSessions(row.user_id);
    logSecurityEvent(row.user_id, 'PASSWORD_RESET', `Password successfully reset; all sessions revoked`, 'SUCCESS', ipAddress);
    return { success: true };
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM auth_verification_tokens 
    WHERE token_hash = ? AND type = 'PASSWORD_RESET'
  `).get(tokenHash) as any;

  if (!row) {
    return { success: false, error: 'Invalid or expired password reset link.' };
  }

  if (row.used_at) {
    return { success: false, error: 'This password reset link has already been used.' };
  }

  const now = new Date().toISOString();
  if (row.expires_at < now) {
    return { success: false, error: 'Password reset link has expired. Please request a new one.' };
  }

  // Update user's password
  const newSalt = generateSalt();
  const newPasswordHash = hashPassword(newPassword, newSalt);

  db.prepare(`
    UPDATE auth_users 
    SET password_hash = ?, salt = ?, updated_at = ? 
    WHERE id = ?
  `).run(newPasswordHash, newSalt, now, row.user_id);

  try {
    db.prepare(`
      UPDATE commercial_users 
      SET password_hash = ?, salt = ?, updated_at = ? 
      WHERE id = ?
    `).run(newPasswordHash, newSalt, now, row.user_id);
  } catch (syncErr) {
    log.warn('Failed updating SQLite commercial_users password on reset', {
      userId: row.user_id,
      err: syncErr instanceof Error ? syncErr.message : String(syncErr),
    });
  }

  // Mark token used
  db.prepare('UPDATE auth_verification_tokens SET used_at = ? WHERE id = ?').run(now, row.id);

  // Security guarantee: revoke all existing sessions to invalidate compromised logins
  db.prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE user_id = ?').run(row.user_id);

  logSecurityEvent(row.user_id, 'PASSWORD_RESET', `Password successfully reset; all sessions revoked`, 'SUCCESS', ipAddress);

  return { success: true };
}

// ============================================================================
// USER LOOKUP
// ============================================================================
export function getCentralUserById(userId: string): AuthUser | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(userId) as any;
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    name: row.name,
    role: row.role as AuthUserRole,
    status: row.status as AuthUserStatus,
    emailVerified: row.email_verified === 1,
    emailVerifiedAt: row.email_verified_at || undefined,
    planId: row.plan_id,
    profileQuota: row.profile_quota,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

export function getCentralUserByEmail(email: string): AuthUser | null {
  const db = getDatabase();
  const normalized = (email || '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM auth_users WHERE normalized_email = ?').get(normalized) as any;
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    name: row.name,
    role: row.role as AuthUserRole,
    status: row.status as AuthUserStatus,
    emailVerified: row.email_verified === 1,
    emailVerifiedAt: row.email_verified_at || undefined,
    planId: row.plan_id,
    profileQuota: row.profile_quota,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

// ============================================================================
// ASYNC CENTRAL DATA ACCESS EQUIVALENTS (POSTGRESQL / SQLITE FALLBACK)
// ============================================================================

export async function getCentralUserByIdAsync(id: string): Promise<AuthUser | null> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const row = await repo.findAuthUserById(id);
    return row ? mapRowToAuthUser(row) : null;
  }
  return getCentralUserById(id);
}

export async function getCentralUserByEmailAsync(email: string): Promise<AuthUser | null> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const row = await repo.findAuthUserByEmail(email);
    return row ? mapRowToAuthUser(row) : null;
  }
  return getCentralUserByEmail(email);
}

export async function logoutSessionAsync(sessionId: string, ipAddress?: string): Promise<boolean> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    return repo.revokeAuthSession(sessionId);
  }
  return logoutSession(sessionId, ipAddress);
}

/** Revokes the session matching a raw refresh token across PostgreSQL or SQLite. */
export async function logoutByRefreshTokenAsync(rawRefreshToken: string, ipAddress?: string): Promise<boolean> {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') return false;
  const refreshHash = hashToken(rawRefreshToken);
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const session = await repo.findAuthSessionByTokenHash(refreshHash);
    if (!session?.id) return false;
    return repo.revokeAuthSession(session.id);
  }
  const db = getDatabase();
  const row = db
    .prepare('SELECT id, user_id FROM auth_sessions WHERE refresh_token_hash = ?')
    .get(refreshHash) as any;
  if (!row?.id) return false;
  return logoutSession(row.id, ipAddress);
}

export async function listUserSessionsAsync(userId: string, currentSessionId?: string): Promise<AuthSessionRecord[]> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const rows = await repo.listUserAuthSessions(userId);
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id || r.userId,
      deviceId: r.device_id || r.deviceId,
      deviceName: r.device_name || r.deviceName,
      platform: r.platform,
      ipAddress: r.ip_address || r.ipAddress,
      isRevoked: r.is_revoked === 1 || r.is_revoked === true,
      isCurrent: currentSessionId ? r.id === currentSessionId : false,
      createdAt: r.created_at || r.createdAt,
      lastUsedAt: r.last_used_at || r.lastUsedAt,
      expiresAt: r.expires_at || r.expiresAt,
    }));
  }
  return listUserSessions(userId, currentSessionId);
}

export async function revokeUserSessionAsync(userId: string, sessionId: string, ipAddress?: string): Promise<boolean> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    return repo.revokeAuthSession(sessionId);
  }
  return revokeUserSession(userId, sessionId, ipAddress).success;
}

export async function revokeAllUserSessionsAsync(userId: string, exceptSessionId?: string, ipAddress?: string): Promise<number> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    return repo.revokeAllUserSessions(userId);
  }
  return revokeAllUserSessions(userId, exceptSessionId, ipAddress);
}
