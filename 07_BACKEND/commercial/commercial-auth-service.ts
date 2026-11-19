import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  CommercialUser,
  CommercialRole,
  CommercialUserStatus,
  RegisterUserDTO,
  LoginUserDTO,
  AuthSessionResponse,
} from '../../10_CONFIG/shared/types/commercial.js';
import { logCommercialAudit } from './commercial-audit-service.js';
import { getJwtSecret } from '../../08_SECURITY/install-secrets.js';

const JWT_EXPIRATION_HOURS = 24 * 7; // 7 days

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function signToken(payload: { userId: string; email: string; role: CommercialRole }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRATION_HOURS * 3600;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): { userId: string; email: string; role: CommercialRole } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const currentSecret = getJwtSecret();
  const expectedSig = crypto.createHmac('sha256', currentSecret).update(`${header}.${body}`).digest('base64url');

  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expectedSig);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function registerUser(dto: RegisterUserDTO, ipAddress?: string, explicitId?: string): { success: boolean; user?: CommercialUser; token?: string; error?: string } {
  const db = getDatabase();
  const email = (dto.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { success: false, error: 'A valid email address is required.' };
  }

  if (!dto.password || dto.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  const existing = db.prepare('SELECT id FROM commercial_users WHERE email = ?').get(email) as any;
  if (existing) {
    if (!explicitId || existing.id !== explicitId) {
      return { success: false, error: 'An account with this email address already exists.' };
    }
  }

  const id = explicitId || `usr_${crypto.randomUUID()}`;
  const salt = generateSalt();
  const passwordHash = hashPassword(dto.password, salt);
  const now = new Date().toISOString();
  const name = (dto.name || email.split('@')[0] || 'User').trim();
  const role: CommercialRole = 'USER';
  const status: CommercialUserStatus = 'ACTIVE';

  const intent = dto.intent || 'free';
  const isTrial = intent === 'trial';
  const targetPlan = dto.planId || (isTrial ? 'professional_50' : 'plan_free');
  const trialUsed = isTrial ? 1 : 0;
  const trialStartedAt = isTrial ? now : null;
  const trialExpiresAt = isTrial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
  const pendingPlanId = intent === 'paid' ? dto.planId || null : null;
  const pendingBillingCycle = intent === 'paid' ? dto.billingCycle || 'annual' : null;
  const acceptedTerms = typeof dto.acceptedTerms === 'boolean' ? (dto.acceptedTerms ? 1 : 0) : null;
  const termsVersion = dto.termsVersion ? String(dto.termsVersion).trim() : null;

  if (existing && existing.id === explicitId) {
    db.prepare(`
      UPDATE commercial_users SET
        password_hash = ?, salt = ?, name = ?, plan_id = ?,
        trial_started_at = ?, trial_expires_at = ?, trial_used = ?, signup_intent = ?,
        pending_plan_id = ?, pending_billing_cycle = ?,
        accepted_terms = COALESCE(?, accepted_terms),
        terms_version = COALESCE(?, terms_version),
        updated_at = ?
      WHERE id = ?
    `).run(
      passwordHash, salt, name, targetPlan,
      trialStartedAt, trialExpiresAt, trialUsed, intent,
      pendingPlanId, pendingBillingCycle,
      acceptedTerms, termsVersion,
      now, id
    );
  } else {
    db.prepare(`
      INSERT INTO commercial_users (
        id, email, password_hash, salt, name, role, status, plan_id,
        trial_started_at, trial_expires_at, trial_used, signup_intent,
        pending_plan_id, pending_billing_cycle,
        accepted_terms, terms_version,
        created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, email, passwordHash, salt, name, role, status, targetPlan,
      trialStartedAt, trialExpiresAt, trialUsed, intent,
      pendingPlanId, pendingBillingCycle,
      acceptedTerms, termsVersion,
      now, now, now
    );
  }

  // If trial intent, initialize a real 7-day trial subscription
  if (isTrial) {
    const subId = `sub_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO commercial_subscriptions (
        id, user_id, plan_id, license_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
      ) VALUES (?, ?, ?, ?, 'ACTIVE', 'TRIAL', ?, ?, 'DIRECT_TRIAL', ?)
    `).run(subId, id, targetPlan, null, now, trialExpiresAt, now);
  }

  logCommercialAudit({
    actorId: id,
    actorName: name,
    actorRole: 'USER',
    action: 'USER_REGISTER',
    targetType: 'USER',
    targetId: id,
    details: `New account registered: ${email}`,
    ipAddress,
    result: 'SUCCESS',
  });

  const user = getUserById(id)!;
  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return { success: true, user, token };
}

export function syncSupabaseUser(user: { id: string; email: string; name?: string }): { success: boolean } {
  const db = getDatabase();
  try {
    const existing = db.prepare('SELECT id FROM commercial_users WHERE id = ?').get(user.id);
    if (!existing) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO commercial_users (id, email, password_hash, salt, name, role, status, plan_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.email,
        'SUPABASE_AUTH',
        'SUPABASE_AUTH',
        user.name || user.email.split('@')[0],
        'USER',
        'ACTIVE',
        'plan_free',
        now,
        now
      );
    } else {
      // Just update last_login
      db.prepare('UPDATE commercial_users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
    }
    return { success: true };
  } catch (err: any) {
    console.error('syncSupabaseUser error:', err);
    return { success: false };
  }
}

export function loginUser(dto: LoginUserDTO, ipAddress?: string): { success: boolean; user?: CommercialUser; token?: string; error?: string } {
  const db = getDatabase();
  const email = (dto.email || '').trim().toLowerCase();
  if (!email || !dto.password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const row = db.prepare('SELECT * FROM commercial_users WHERE email = ?').get(email) as any;
  if (!row) {
    logCommercialAudit({
      actorId: 'anonymous',
      actorName: email,
      actorRole: 'USER',
      action: 'LOGIN_FAILED',
      targetType: 'USER',
      details: `Failed login attempt for non-existing email: ${email}`,
      ipAddress,
      result: 'FAILURE',
    });
    return { success: false, error: 'Invalid email or password.' };
  }

  if (row.password_hash === 'OAUTH_GOOGLE' || (!row.password_hash && row.google_sub) || (row.auth_provider === 'GOOGLE' && row.password_hash === 'OAUTH_GOOGLE')) {
    return {
      success: false,
      error: 'This account was created with Google Sign-In and has no password set. Please use "Continue with Google" or reset your password.',
    };
  }

  const calculatedHash = hashPassword(dto.password, row.salt);
  if (calculatedHash !== row.password_hash) {
    logCommercialAudit({
      actorId: row.id,
      actorName: row.name,
      actorRole: row.role as CommercialRole,
      action: 'LOGIN_FAILED',
      targetType: 'USER',
      targetId: row.id,
      details: `Invalid password supplied for ${email}`,
      ipAddress,
      result: 'FAILURE',
    });
    return { success: false, error: 'Invalid email or password.' };
  }

  // Account Status Checks: ACTIVE, SUSPENDED, BANNED
  if (row.status === 'BANNED') {
    logCommercialAudit({
      actorId: row.id,
      actorName: row.name,
      actorRole: row.role as CommercialRole,
      action: 'LOGIN_BLOCKED',
      targetType: 'USER',
      targetId: row.id,
      details: `Banned user attempted login: ${email}`,
      ipAddress,
      result: 'FAILURE',
    });
    return { success: false, error: 'This account has been permanently banned by an administrator.' };
  }

  if (row.status === 'SUSPENDED') {
    logCommercialAudit({
      actorId: row.id,
      actorName: row.name,
      actorRole: row.role as CommercialRole,
      action: 'LOGIN_BLOCKED',
      targetType: 'USER',
      targetId: row.id,
      details: `Suspended user attempted login: ${email}`,
      ipAddress,
      result: 'FAILURE',
    });
    return { success: false, error: 'This account is currently suspended. Please contact support.' };
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE commercial_users SET last_login_at = ? WHERE id = ?').run(now, row.id);

  logCommercialAudit({
    actorId: row.id,
    actorName: row.name,
    actorRole: row.role as CommercialRole,
    action: 'USER_LOGIN',
    targetType: 'USER',
    targetId: row.id,
    details: `User logged in successfully: ${email}`,
    ipAddress,
    result: 'SUCCESS',
  });

  const user = getUserById(row.id)!;
  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return { success: true, user, token };
}

export function getUserById(userId: string): CommercialUser | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM commercial_users WHERE id = ? OR email = ?').get(userId, userId) as any;
  if (row) {
    let featureOverrides: Record<string, boolean> = {};
    if (row.feature_overrides) {
      try {
        featureOverrides = JSON.parse(row.feature_overrides);
      } catch {}
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as CommercialRole,
      status: row.status as CommercialUserStatus,
      planId: row.plan_id || 'plan_free',
      bonusProfiles: row.bonus_profiles || 0,
      bonusProxyBytes: row.bonus_proxy_bytes || 0,
      featureOverrides,
      trialStartedAt: row.trial_started_at || undefined,
      trialExpiresAt: row.trial_expires_at || undefined,
      trialUsed: Boolean(row.trial_used),
      signupIntent: row.signup_intent || undefined,
      pendingPlanId: row.pending_plan_id || undefined,
      pendingBillingCycle: row.pending_billing_cycle || undefined,
      is_trial: Boolean(row.trial_expires_at && new Date(row.trial_expires_at) > new Date()),
      trial_started_at: row.trial_started_at || undefined,
      trial_expires_at: row.trial_expires_at || undefined,
      trial_used: Boolean(row.trial_used),
      signup_intent: row.signup_intent || undefined,
      pending_plan_id: row.pending_plan_id || undefined,
      pending_billing_cycle: row.pending_billing_cycle || undefined,
      googleSub: row.google_sub || undefined,
      avatarUrl: row.avatar_url || undefined,
      authProvider: row.auth_provider || 'LOCAL',
      acceptedTerms: row.accepted_terms === 1 ? true : row.accepted_terms === 0 ? false : undefined,
      termsVersion: row.terms_version || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at || undefined,
    } as any;
  }

  // Fallback to central auth_users table
  const authRow = db.prepare('SELECT * FROM auth_users WHERE id = ? OR email = ?').get(userId, userId) as any;
  if (authRow) {
    const role: CommercialRole = (authRow.role === 'ADMIN' || authRow.role === 'SUPER_ADMIN') ? authRow.role : 'USER';
    const status: CommercialUserStatus = authRow.status === 'BANNED' ? 'BANNED' : authRow.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    return {
      id: authRow.id,
      email: authRow.email,
      name: authRow.name || authRow.email.split('@')[0],
      role,
      status,
      planId: (authRow.plan_tier === 'pro' || authRow.plan_tier === 'PRO') ? 'plan_pro' : 'plan_free',
      createdAt: authRow.created_at,
      updatedAt: authRow.updated_at,
      lastLoginAt: authRow.last_login_at || undefined,
    };
  }

  return null;
}

export function getUserByEmail(email: string): CommercialUser | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM commercial_users WHERE email = ?').get(email.trim().toLowerCase()) as any;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as CommercialRole,
    status: row.status as CommercialUserStatus,
    planId: row.plan_id,
    acceptedTerms: row.accepted_terms === 1 ? true : row.accepted_terms === 0 ? false : undefined,
    termsVersion: row.terms_version || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

export function getAllUsers(filter?: { status?: string; role?: string; searchQuery?: string; limit?: number; offset?: number }): { users: CommercialUser[]; total: number } {
  const db = getDatabase();
  let query = 'SELECT * FROM commercial_users WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM commercial_users WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (filter?.status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(filter.status);
    countParams.push(filter.status);
  }

  if (filter?.role) {
    query += ' AND role = ?';
    countQuery += ' AND role = ?';
    params.push(filter.role);
    countParams.push(filter.role);
  }

  if (filter?.searchQuery) {
    const term = `%${filter.searchQuery}%`;
    query += ' AND (email LIKE ? OR name LIKE ?)';
    countQuery += ' AND (email LIKE ? OR name LIKE ?)';
    params.push(term, term);
    countParams.push(term, term);
  }

  query += ' ORDER BY created_at DESC';
  const limit = Math.min(100, Math.max(1, filter?.limit || 50));
  const offset = Math.max(0, filter?.offset || 0);
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const total = (db.prepare(countQuery).get(...countParams) as any)?.count || 0;
  const rows = db.prepare(query).all(...params) as any[];

  const users = rows.map((r) => {
    let featureOverrides: Record<string, boolean> = {};
    if (r.feature_overrides) {
      try {
        featureOverrides = JSON.parse(r.feature_overrides);
      } catch {}
    }
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role as CommercialRole,
      status: r.status as CommercialUserStatus,
      planId: r.plan_id,
      bonusProfiles: r.bonus_profiles || 0,
      bonusProxyBytes: r.bonus_proxy_bytes || 0,
      featureOverrides,
      acceptedTerms: r.accepted_terms === 1 ? true : r.accepted_terms === 0 ? false : undefined,
      termsVersion: r.terms_version || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastLoginAt: r.last_login_at || undefined,
    };
  });

  return { users, total };
}

export function updateUserStatus(
  userId: string,
  status: CommercialUserStatus,
  actor: { id: string; name: string; role: CommercialRole },
  reason?: string
): boolean {
  const db = getDatabase();
  const current = getUserById(userId);
  if (!current) return false;

  const now = new Date().toISOString();
  const res = db.prepare('UPDATE commercial_users SET status = ?, updated_at = ? WHERE id = ?').run(status, now, userId);

  if (res.changes > 0) {
    logCommercialAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: `USER_${status}`,
      targetType: 'USER',
      targetId: userId,
      details: `Changed user status for ${current.email} from ${current.status} to ${status}.${reason ? ` Reason: ${reason}` : ''}`,
      result: 'WARNING',
    });
    return true;
  }
  return false;
}

export function updateUserPlan(
  userId: string,
  planId: string,
  actor: { id: string; name: string; role: CommercialRole }
): boolean {
  const db = getDatabase();
  const current = getUserById(userId);
  if (!current) return false;

  const now = new Date().toISOString();
  const res = db.prepare('UPDATE commercial_users SET plan_id = ?, updated_at = ? WHERE id = ?').run(planId, now, userId);

  if (res.changes > 0) {
    logCommercialAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'USER_PLAN_CHANGE',
      targetType: 'USER',
      targetId: userId,
      details: `Changed plan for ${current.email} to ${planId}`,
      result: 'SUCCESS',
    });
    return true;
  }
  return false;
}

/**
 * Phase 23: GoLogin-Style Instant Quota Booster
 * Grants immediate bonus profiles or proxy gigabytes without requiring a plan upgrade.
 */
export function boostUserQuota(
  userId: string,
  type: 'PROFILES' | 'PROXY_GB',
  amount: number,
  actor: { id: string; name: string; role: CommercialRole }
): { success: boolean; bonusProfiles?: number; bonusProxyBytes?: number; error?: string } {
  const db = getDatabase();
  const current = getUserById(userId);
  if (!current) {
    return { success: false, error: 'User not found.' };
  }

  const now = new Date().toISOString();

  if (type === 'PROFILES') {
    const increment = Math.max(1, Math.floor(amount));
    db.prepare(`
      UPDATE commercial_users 
      SET bonus_profiles = COALESCE(bonus_profiles, 0) + ?, updated_at = ? 
      WHERE id = ?
    `).run(increment, now, current.id);

    const updated = getUserById(current.id);
    logCommercialAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'USER_QUOTA_BOOST_PROFILES',
      targetType: 'USER',
      targetId: current.id,
      details: `Admin granted +${increment} bonus profiles to ${current.email}. Total bonus: ${updated?.bonusProfiles || 0}`,
      result: 'SUCCESS',
    });

    return {
      success: true,
      bonusProfiles: updated?.bonusProfiles || 0,
      bonusProxyBytes: updated?.bonusProxyBytes || 0,
    };
  }

  if (type === 'PROXY_GB') {
    const incrementGb = Math.max(1, Math.floor(amount));
    const incrementBytes = incrementGb * 1024 * 1024 * 1024;
    db.prepare(`
      UPDATE commercial_users 
      SET bonus_proxy_bytes = COALESCE(bonus_proxy_bytes, 0) + ?, updated_at = ? 
      WHERE id = ?
    `).run(incrementBytes, now, current.id);

    const updated = getUserById(current.id);
    logCommercialAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'USER_QUOTA_BOOST_PROXY',
      targetType: 'USER',
      targetId: current.id,
      details: `Admin granted +${incrementGb} GB proxy data to ${current.email}.`,
      result: 'SUCCESS',
    });

    return {
      success: true,
      bonusProfiles: updated?.bonusProfiles || 0,
      bonusProxyBytes: updated?.bonusProxyBytes || 0,
    };
  }

  return { success: false, error: 'Invalid boost type. Expected PROFILES or PROXY_GB.' };
}

/**
 * Phase 23: MostLogin-Style Enterprise Feature Overrides
 * Grants or revokes specific enterprise features (Qunkong, Multi-Core, Bot Daemon, RPA)
 * directly per user account without changing their plan tier.
 */
export function setUserFeatureOverrides(
  userId: string,
  overrides: Record<string, boolean>,
  actor: { id: string; name: string; role: CommercialRole }
): { success: boolean; overrides?: Record<string, boolean>; error?: string } {
  const db = getDatabase();
  const current = getUserById(userId);
  if (!current) {
    return { success: false, error: 'User not found.' };
  }

  const existingOverrides = current.featureOverrides || {};
  const merged = { ...existingOverrides, ...overrides };
  const json = JSON.stringify(merged);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE commercial_users 
    SET feature_overrides = ?, updated_at = ? 
    WHERE id = ?
  `).run(json, now, current.id);

  logCommercialAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'USER_FEATURE_OVERRIDES_UPDATE',
    targetType: 'USER',
    targetId: current.id,
    details: `Updated enterprise feature overrides for ${current.email}: ${json}`,
    result: 'SUCCESS',
  });

  return { success: true, overrides: merged };
}

