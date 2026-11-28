import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import {
  ACCESS_TOKEN_EXP_SECONDS,
  REFRESH_TOKEN_EXP_DAYS,
  checkLoginRateLimitAsync,
  clearLoginAttemptsAsync,
  hashToken,
  logSecurityEvent,
  mapRowToAuthUser,
  recordLoginFailureAsync,
  signAccessToken,
  verifyPassword,
  type AuthSessionRecord,
  type AuthSessionRowLike,
  type AuthTokens,
  type AuthUser,
  type AuthUserRole,
  type AuthUserRowLike,
  type AuthUserStatus,
} from './auth-crypto.js';

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
}): Promise<{
  success: boolean;
  user?: AuthUser;
  session?: { id: string; deviceId: string; deviceName: string; platform: string };
  tokens?: AuthTokens;
  error?: string;
  lockedRemainingMs?: number;
}> {
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
      planId: row.plan_id || row.planId || 'plan_free',
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
  const row = db.prepare('SELECT * FROM auth_users WHERE normalized_email = ?').get(normalizedEmail) as AuthUserRowLike | undefined;
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
  db.prepare('UPDATE auth_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, row.id);

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

  const user = getCentralUserById(row.id);
  if (!user) {
    throw new Error('Failed to load authenticated user');
  }

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
  const session = db.prepare('SELECT * FROM auth_sessions WHERE refresh_token_hash = ?').get(refreshHash) as AuthSessionRowLike | undefined;

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
  const session = db.prepare('SELECT user_id FROM auth_sessions WHERE id = ?').get(sessionId) as { user_id: string } | undefined;
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
  `).all<AuthSessionRowLike>(userId);

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    user_id: r.user_id,
    deviceId: r.device_id,
    device_id: r.device_id,
    deviceName: r.device_name,
    device_name: r.device_name,
    platform: r.platform,
    ipAddress: r.ip_address || undefined,
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
  const params: string[] = [userId];

  if (exceptSessionId) {
    query += ' AND id != ?';
    params.push(exceptSessionId);
  }

  const res = db.prepare(query).run(...params);
  logSecurityEvent(userId, 'REVOKE_ALL_SESSIONS', `Revoked ${res.changes} session(s)${exceptSessionId ? ` (kept ${exceptSessionId})` : ''}`, 'SUCCESS', ipAddress);
  return res.changes;
}

// ============================================================================
// USER LOOKUP & ASYNC EQUIVALENTS
// ============================================================================
export function getCentralUserById(userId: string): AuthUser | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(userId) as AuthUserRowLike | undefined;
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email || row.email.toLowerCase(),
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
  const row = db.prepare('SELECT * FROM auth_users WHERE normalized_email = ?').get(normalized) as AuthUserRowLike | undefined;
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email || row.email.toLowerCase(),
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
    .get(refreshHash) as { id: string; user_id: string } | undefined;
  if (!row?.id) return false;
  return logoutSession(row.id, ipAddress);
}

export async function listUserSessionsAsync(userId: string, currentSessionId?: string): Promise<AuthSessionRecord[]> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const rows = (await repo.listUserAuthSessions(userId)) as AuthSessionRowLike[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id || r.userId || '',
      deviceId: r.device_id || r.deviceId || '',
      deviceName: r.device_name || r.deviceName || '',
      platform: r.platform,
      ipAddress: r.ip_address || r.ipAddress || undefined,
      isRevoked: r.is_revoked === 1 || r.is_revoked === true,
      isCurrent: currentSessionId ? r.id === currentSessionId : false,
      createdAt: r.created_at || r.createdAt || '',
      lastUsedAt: r.last_used_at || r.lastUsedAt || '',
      expiresAt: r.expires_at || r.expiresAt || '',
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
