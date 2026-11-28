import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { isPostgresConfigured, getCentralRepository } from '../../06_DATABASE/central-repository.js';
import { getPrismaClient } from '../../06_DATABASE/prisma-client.js';
import { syncCommercialMirrorFromAuthSqlite, ensurePgCommercialMirror } from '../user-model-unifier.js';
import { getEmailProvider } from '../email-service.js';
import { websiteUrl } from '../../10_CONFIG/shared/site-config.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';
import {
  ACCESS_TOKEN_EXP_SECONDS,
  REFRESH_TOKEN_EXP_DAYS,
  VERIFY_TOKEN_EXP_HOURS,
  RESET_TOKEN_EXP_HOURS,
  generateSalt,
  hashPassword,
  hashToken,
  signAccessToken,
  logSecurityEvent,
  mapRowToAuthUser,
  type AuthTokens,
  type AuthUser,
  type AuthUserRole,
  type AuthUserRowLike,
  type AuthUserStatus,
} from './auth-crypto.js';

const log = createLogger('central-auth-registration');

function loadLocalCentralUserById(userId: string): AuthUser | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(userId) as AuthUserRowLike | undefined;
  return row ? mapRowToAuthUser(row) : null;
}

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
      const prisma = getPrismaClient();
      if (prisma) {
        await ensurePgCommercialMirror(prisma, userId);
      }
    } catch (syncErr) {
      log.warn('Failed ensuring PG commercial_users FK mirror on register', {
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
    } catch (err: unknown) {
      log.warn('[CentralAuth] Failed to send verification email:', err instanceof Error ? err.message : String(err));
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
    if (!userRow) {
      return { success: false, error: 'Failed to load registered user record.' };
    }
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

  syncCommercialMirrorFromAuthSqlite(db, userId);

  const rawVerifyToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawVerifyToken);
  const tokenId = `tok_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO auth_verification_tokens (id, token_hash, user_id, email, type, expires_at, created_at)
    VALUES (?, ?, ?, ?, 'EMAIL_VERIFICATION', ?, ?)
  `).run(tokenId, tokenHash, userId, normalizedEmail, expiresAt, now);

  const verifyUrl = websiteUrl(`/verify-email?token=${rawVerifyToken}`, { productionFallback: true });
  try {
    await getEmailProvider().sendVerificationEmail(rawEmail, rawVerifyToken, verifyUrl);
  } catch (err: unknown) {
    log.warn('[CentralAuth] Failed to send verification email:', err instanceof Error ? err.message : String(err));
  }

  logSecurityEvent(userId, 'REGISTER', `New user registered: ${normalizedEmail}`, 'SUCCESS', params.ipAddress);

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

  const user = loadLocalCentralUserById(userId);
  if (!user) {
    throw new Error('Failed to load newly registered user');
  }

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
  `).get(tokenHash) as { id: string; user_id: string; email: string; used_at: string | null; expires_at: string } | undefined;

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
  const user = db.prepare('SELECT id, email, email_verified, status FROM auth_users WHERE normalized_email = ?').get(normalizedEmail) as {
    id: string;
    email: string;
    email_verified: number;
    status: string;
  } | undefined;

  if (!user) {
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
    } catch (err: unknown) {
      log.warn('[CentralAuth] Failed to send password reset email:', err instanceof Error ? err.message : String(err));
    }

    logSecurityEvent(user.id, 'PASSWORD_RESET_REQUESTED', `Reset token issued for ${normalizedEmail}`, 'SUCCESS', ipAddress);
    return { success: true, message: safeMessage };
  }

  const db = getDatabase();
  const user = db.prepare('SELECT id, email, status FROM auth_users WHERE normalized_email = ?').get(normalizedEmail) as {
    id: string;
    email: string;
    status: string;
  } | undefined;

  if (!user || user.status === 'DISABLED') {
    return { success: true, message: safeMessage };
  }

  const now = new Date().toISOString();
  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawResetToken);
  const tokenId = `tok_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXP_HOURS * 3600 * 1000).toISOString();

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
  } catch (err: unknown) {
    log.warn('[CentralAuth] Failed to send password reset email:', err instanceof Error ? err.message : String(err));
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
      const prisma = getPrismaClient();
      if (prisma && typeof prisma.commercial_users?.updateMany === 'function') {
        await prisma.commercial_users.updateMany({
          where: { id: row.user_id },
          data: { password_hash: newPasswordHash, salt: newSalt, updated_at: now },
        });
      }
    } catch (syncErr) {
      log.warn('Failed updating PG commercial_users FK mirror password on reset', {
        userId: row.user_id,
        err: syncErr instanceof Error ? syncErr.message : String(syncErr),
      });
    }
    await repo.consumeVerificationToken(tokenHash);
    await repo.revokeAllUserSessions(row.user_id);
    logSecurityEvent(row.user_id, 'PASSWORD_RESET', 'Password successfully reset; all sessions revoked', 'SUCCESS', ipAddress);
    return { success: true };
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM auth_verification_tokens 
    WHERE token_hash = ? AND type = 'PASSWORD_RESET'
  `).get(tokenHash) as { id: string; user_id: string; used_at: string | null; expires_at: string } | undefined;

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

  db.prepare(`
    UPDATE auth_users 
    SET password_hash = ?, salt = ?, updated_at = ? 
    WHERE id = ?
  `).run(newPasswordHash, newSalt, now, row.user_id);

  syncCommercialMirrorFromAuthSqlite(db, row.user_id);

  db.prepare('UPDATE auth_verification_tokens SET used_at = ? WHERE id = ?').run(now, row.id);
  db.prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE user_id = ?').run(row.user_id);

  logSecurityEvent(row.user_id, 'PASSWORD_RESET', 'Password successfully reset; all sessions revoked', 'SUCCESS', ipAddress);

  return { success: true };
}
