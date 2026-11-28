import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import type {
  AuthUserRecord,
  AuthSessionRecord as RepoAuthSessionRecord,
} from '../../06_DATABASE/central-repository-types.js';
import { getJwtSecret } from '../../08_SECURITY/install-secrets.js';
import {
  checkAttemptLockoutAsync,
  recordFailedAttemptAsync,
  clearAttemptsAsync,
} from '../../08_SECURITY/distributed-state-service.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';

const log = createLogger('central-auth-service');

export type AuthUserRowLike = AuthUserRecord & {
  normalizedEmail?: string;
  emailVerified?: boolean | number;
  emailVerifiedAt?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
  authProvider?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
};

export type AuthSessionRowLike = RepoAuthSessionRecord & {
  userId?: string;
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string | null;
  createdAt?: string;
  lastUsedAt?: string;
  expiresAt?: string;
};

export function mapRowToAuthUser(row: AuthUserRowLike): AuthUser {
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
// AUDIT LOGGING & RATE LIMITING
// ============================================================================
export function logSecurityEvent(
  userId: string | null,
  action: string,
  details: string,
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED',
  ipAddress?: string
): void {
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
  } catch (err: unknown) {
    log.error('[CentralAuth] Security log error:', err instanceof Error ? err.message : String(err));
  }
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
  await clearAttemptsAsync({ namespace: 'login_lock', key });
}
