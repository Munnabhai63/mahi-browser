import type { PrismaClient } from '@prisma/client';
import type { getDatabase } from '../06_DATABASE/connection.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('user-model-unifier');

export type SqliteDbHandle = ReturnType<typeof getDatabase>;

export interface AuthUserUnifiedRow {
  id: string;
  email: string;
  normalized_email: string;
  password_hash: string;
  salt: string;
  name: string;
  role: string;
  status: string;
  email_verified: number;
  email_verified_at: string | null;
  plan_id: string;
  profile_quota: number;
  bonus_profiles: number | null;
  bonus_proxy_bytes: number | null;
  feature_overrides: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  trial_used: number | null;
  signup_intent: string | null;
  pending_plan_id: string | null;
  pending_billing_cycle: string | null;
  google_sub: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  accepted_terms: number | null;
  terms_version: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface LegacyCommercialUserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  name: string;
  role: string;
  status: string;
  plan_id: string | null;
  bonus_profiles?: number | null;
  bonus_proxy_bytes?: number | null;
  feature_overrides?: string | null;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  trial_used?: number | null;
  signup_intent?: string | null;
  pending_plan_id?: string | null;
  pending_billing_cycle?: string | null;
  google_sub?: string | null;
  avatar_url?: string | null;
  auth_provider?: string | null;
  accepted_terms?: number | null;
  terms_version?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface CommercialMirrorPayload {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  name: string;
  role?: string;
  status?: string;
  planId?: string;
  bonusProfiles?: number;
  bonusProxyBytes?: number;
  featureOverrides?: string;
  trialStartedAt?: string | null;
  trialExpiresAt?: string | null;
  trialUsed?: number;
  signupIntent?: string | null;
  pendingPlanId?: string | null;
  pendingBillingCycle?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
  authProvider?: string | null;
  acceptedTerms?: number | null;
  termsVersion?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

/** Strips legacy `central:` ID prefixes so all subsystems address canonical `auth_users.id`. */
export function stripCentralUserPrefix(userId: string): string {
  const clean = (userId || '').trim();
  return clean.startsWith('central:') ? clean.slice('central:'.length).trim() : clean;
}

/**
 * Promotes a legacy `commercial_users`-only SQLite row into authoritative `auth_users`.
 * Used during startup DB migration and to safely assimilate direct SQLite fixture rows.
 */
export function promoteLegacyCommercialRowToAuthSqlite(
  db: SqliteDbHandle,
  row: LegacyCommercialUserRow
): AuthUserUnifiedRow | null {
  const normalizedEmail = (row.email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const now = new Date().toISOString();
  const planId = row.plan_id || 'plan_free';

  const existingById = db.prepare('SELECT * FROM auth_users WHERE id = ?').get(row.id) as
    | AuthUserUnifiedRow
    | undefined;
  const existing =
    existingById ||
    (db.prepare('SELECT * FROM auth_users WHERE normalized_email = ?').get(normalizedEmail) as
      | AuthUserUnifiedRow
      | undefined);

  if (!existing) {
    db.prepare(`
      INSERT INTO auth_users (
        id, email, normalized_email, password_hash, salt, name, role, status,
        email_verified, email_verified_at, plan_id, profile_quota,
        bonus_profiles, bonus_proxy_bytes, feature_overrides,
        trial_started_at, trial_expires_at, trial_used, signup_intent,
        pending_plan_id, pending_billing_cycle,
        google_sub, avatar_url, auth_provider,
        accepted_terms, terms_version, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id,
      normalizedEmail,
      normalizedEmail,
      row.password_hash || 'LEGACY_MIGRATED',
      row.salt || 'LEGACY_MIGRATED',
      row.name || normalizedEmail.split('@')[0] || 'User',
      row.role || 'USER',
      row.status || 'ACTIVE',
      row.created_at || now,
      planId,
      planId === 'plan_free' || planId === 'free' ? 15 : 50,
      row.bonus_profiles ?? 0,
      row.bonus_proxy_bytes ?? 0,
      row.feature_overrides || '{}',
      row.trial_started_at || null,
      row.trial_expires_at || null,
      row.trial_used ?? 0,
      row.signup_intent || null,
      row.pending_plan_id || null,
      row.pending_billing_cycle || null,
      row.google_sub || null,
      row.avatar_url || null,
      row.auth_provider || 'LOCAL',
      row.accepted_terms ?? null,
      row.terms_version || null,
      row.created_at || now,
      row.updated_at || now,
      row.last_login_at || null
    );
  } else {
    db.prepare(`
      UPDATE auth_users SET
        bonus_profiles = COALESCE(NULLIF(bonus_profiles, 0), ?, bonus_profiles),
        bonus_proxy_bytes = COALESCE(NULLIF(bonus_proxy_bytes, 0), ?, bonus_proxy_bytes),
        feature_overrides = CASE WHEN feature_overrides IS NULL OR feature_overrides = '' OR feature_overrides = '{}' THEN COALESCE(?, '{}') ELSE feature_overrides END,
        trial_started_at = COALESCE(trial_started_at, ?),
        trial_expires_at = COALESCE(trial_expires_at, ?),
        trial_used = COALESCE(NULLIF(trial_used, 0), ?, trial_used),
        signup_intent = COALESCE(signup_intent, ?),
        pending_plan_id = COALESCE(pending_plan_id, ?),
        pending_billing_cycle = COALESCE(pending_billing_cycle, ?),
        google_sub = COALESCE(google_sub, ?),
        avatar_url = COALESCE(avatar_url, ?),
        auth_provider = COALESCE(auth_provider, ?),
        accepted_terms = COALESCE(accepted_terms, ?),
        terms_version = COALESCE(terms_version, ?)
      WHERE id = ?
    `).run(
      row.bonus_profiles ?? 0,
      row.bonus_proxy_bytes ?? 0,
      row.feature_overrides || '{}',
      row.trial_started_at || null,
      row.trial_expires_at || null,
      row.trial_used ?? 0,
      row.signup_intent || null,
      row.pending_plan_id || null,
      row.pending_billing_cycle || null,
      row.google_sub || null,
      row.avatar_url || null,
      row.auth_provider || 'LOCAL',
      row.accepted_terms ?? null,
      row.terms_version || null,
      existing.id
    );
  }

  return (
    (db.prepare('SELECT * FROM auth_users WHERE id = ?').get(existing?.id || row.id) as
      | AuthUserUnifiedRow
      | undefined) || null
  );
}

/**
 * Startup schema backfill uniting all historical `commercial_users` rows into `auth_users`.
 * Keeps the legacy table only for `commercial_subscriptions` foreign-key integrity.
 */
export function migrateLegacyCommercialUsersToAuthUsers(db: SqliteDbHandle): number {
  let migrated = 0;
  try {
    const legacyRows = db
      .prepare('SELECT * FROM commercial_users')
      .all() as unknown as LegacyCommercialUserRow[];
    for (const row of legacyRows) {
      if (promoteLegacyCommercialRowToAuthSqlite(db, row)) {
        migrated++;
      }
    }
  } catch (err) {
    log.warn('Failed migrating legacy commercial_users rows into auth_users', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return migrated;
}

/**
 * Resolves a user from the single authoritative `auth_users` model by ID (with optional `central:` prefix)
 * or normalized email. Never queries `commercial_users` directly in runtime lookups.
 */
export function findAuthoritativeUserSqlite(db: SqliteDbHandle, idOrEmail: string): AuthUserUnifiedRow | null {
  const clean = stripCentralUserPrefix(idOrEmail);
  if (!clean) return null;
  const normalized = clean.toLowerCase();
  const row = db
    .prepare('SELECT * FROM auth_users WHERE id = ? OR normalized_email = ? OR email = ?')
    .get(clean, normalized, clean) as AuthUserUnifiedRow | undefined;
  return row || null;
}

/**
 * Keeps the SQLite `commercial_users` FK-compatibility row synchronized with an authoritative
 * `auth_users` write so `commercial_subscriptions` FK constraints never fail.
 */
export function upsertCommercialMirrorSqlite(db: SqliteDbHandle, payload: CommercialMirrorPayload): void {
  const now = new Date().toISOString();
  const normalizedEmail = (payload.email || '').trim().toLowerCase();
  const existingById = db.prepare('SELECT id FROM commercial_users WHERE id = ?').get(payload.id) as
    | { id: string }
    | undefined;
  const existingByEmail = db.prepare('SELECT id FROM commercial_users WHERE email = ?').get(normalizedEmail) as
    | { id: string }
    | undefined;

  if (existingById || existingByEmail) {
    const targetId = existingById?.id || existingByEmail?.id || payload.id;
    db.prepare(`
      UPDATE commercial_users SET
        id = ?,
        email = ?,
        password_hash = COALESCE(NULLIF(?, ''), password_hash),
        salt = COALESCE(NULLIF(?, ''), salt),
        name = ?,
        role = COALESCE(?, role),
        status = COALESCE(?, status),
        plan_id = COALESCE(?, plan_id),
        bonus_profiles = COALESCE(?, bonus_profiles),
        bonus_proxy_bytes = COALESCE(?, bonus_proxy_bytes),
        feature_overrides = COALESCE(?, feature_overrides),
        trial_started_at = COALESCE(?, trial_started_at),
        trial_expires_at = COALESCE(?, trial_expires_at),
        trial_used = COALESCE(?, trial_used),
        signup_intent = COALESCE(?, signup_intent),
        pending_plan_id = COALESCE(?, pending_plan_id),
        pending_billing_cycle = COALESCE(?, pending_billing_cycle),
        google_sub = COALESCE(?, google_sub),
        avatar_url = COALESCE(?, avatar_url),
        auth_provider = COALESCE(?, auth_provider),
        accepted_terms = COALESCE(?, accepted_terms),
        terms_version = COALESCE(?, terms_version),
        updated_at = ?,
        last_login_at = COALESCE(?, last_login_at)
      WHERE id = ?
    `).run(
      payload.id,
      normalizedEmail,
      payload.passwordHash,
      payload.salt,
      payload.name,
      payload.role || 'USER',
      payload.status || 'ACTIVE',
      payload.planId || 'plan_free',
      payload.bonusProfiles ?? null,
      payload.bonusProxyBytes ?? null,
      payload.featureOverrides ?? null,
      payload.trialStartedAt ?? null,
      payload.trialExpiresAt ?? null,
      payload.trialUsed ?? null,
      payload.signupIntent ?? null,
      payload.pendingPlanId ?? null,
      payload.pendingBillingCycle ?? null,
      payload.googleSub ?? null,
      payload.avatarUrl ?? null,
      payload.authProvider ?? null,
      payload.acceptedTerms ?? null,
      payload.termsVersion ?? null,
      payload.updatedAt || now,
      payload.lastLoginAt ?? null,
      targetId
    );
    return;
  }

  db.prepare(`
    INSERT INTO commercial_users (
      id, email, password_hash, salt, name, role, status, plan_id,
      bonus_profiles, bonus_proxy_bytes, feature_overrides,
      trial_started_at, trial_expires_at, trial_used, signup_intent,
      pending_plan_id, pending_billing_cycle,
      google_sub, avatar_url, auth_provider,
      accepted_terms, terms_version, created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.id,
    normalizedEmail,
    payload.passwordHash,
    payload.salt,
    payload.name,
    payload.role || 'USER',
    payload.status || 'ACTIVE',
    payload.planId || 'plan_free',
    payload.bonusProfiles ?? 0,
    payload.bonusProxyBytes ?? 0,
    payload.featureOverrides || '{}',
    payload.trialStartedAt ?? null,
    payload.trialExpiresAt ?? null,
    payload.trialUsed ?? 0,
    payload.signupIntent ?? null,
    payload.pendingPlanId ?? null,
    payload.pendingBillingCycle ?? null,
    payload.googleSub ?? null,
    payload.avatarUrl ?? null,
    payload.authProvider || 'LOCAL',
    payload.acceptedTerms ?? null,
    payload.termsVersion ?? null,
    payload.createdAt || now,
    payload.updatedAt || now,
    payload.lastLoginAt ?? null
  );
}

/** Synchronizes an existing authoritative `auth_users` row into the SQLite `commercial_users` FK mirror. */
export function syncCommercialMirrorFromAuthSqlite(db: SqliteDbHandle, userId: string): void {
  const cleanId = stripCentralUserPrefix(userId);
  const authRow = findAuthoritativeUserSqlite(db, cleanId);
  if (!authRow) return;
  try {
    upsertCommercialMirrorSqlite(db, {
      id: authRow.id,
      email: authRow.email,
      passwordHash: authRow.password_hash,
      salt: authRow.salt,
      name: authRow.name,
      role: authRow.role,
      status: authRow.status,
      planId: authRow.plan_id,
      bonusProfiles: authRow.bonus_profiles ?? 0,
      bonusProxyBytes: authRow.bonus_proxy_bytes ?? 0,
      featureOverrides: authRow.feature_overrides || '{}',
      trialStartedAt: authRow.trial_started_at,
      trialExpiresAt: authRow.trial_expires_at,
      trialUsed: authRow.trial_used ?? 0,
      signupIntent: authRow.signup_intent,
      pendingPlanId: authRow.pending_plan_id,
      pendingBillingCycle: authRow.pending_billing_cycle,
      googleSub: authRow.google_sub,
      avatarUrl: authRow.avatar_url,
      authProvider: authRow.auth_provider,
      acceptedTerms: authRow.accepted_terms,
      termsVersion: authRow.terms_version,
      createdAt: authRow.created_at,
      updatedAt: authRow.updated_at,
      lastLoginAt: authRow.last_login_at,
    });
  } catch (err) {
    log.warn('Failed synchronizing SQLite commercial_users FK mirror from auth_users', {
      userId: cleanId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Ensures a PostgreSQL `commercial_users` FK/quota-extension companion row exists for an
 * authoritative `auth_users` user, eliminating manual "mirror-missing" admin blockers.
 */
export async function ensurePgCommercialMirror(
  prisma: Partial<PrismaClient>,
  rawUserId: string
): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  plan_id: string;
  bonus_profiles: number;
  bonus_proxy_bytes: bigint;
  feature_overrides: string;
} | null> {
  const userId = stripCentralUserPrefix(rawUserId);
  if (!userId || typeof prisma.commercial_users?.findUnique !== 'function') return null;

  const existingComm = await prisma.commercial_users.findUnique({ where: { id: userId } });
  if (existingComm) {
    return existingComm;
  }

  if (typeof prisma.auth_users?.findUnique !== 'function') return null;
  const authUser = await prisma.auth_users.findUnique({ where: { id: userId } });
  if (!authUser) return null;

  if (typeof prisma.commercial_users?.create !== 'function') return null;
  const now = new Date().toISOString();
  try {
    return await prisma.commercial_users.create({
      data: {
        id: authUser.id,
        email: authUser.email,
        password_hash: authUser.password_hash || 'CENTRAL_MIRROR',
        salt: authUser.salt || 'CENTRAL_MIRROR',
        name: authUser.name || authUser.email.split('@')[0],
        role: authUser.role || 'USER',
        status: authUser.status || 'ACTIVE',
        plan_id: authUser.plan_id || 'plan_free',
        bonus_profiles: 0,
        bonus_proxy_bytes: BigInt(0),
        feature_overrides: '{}',
        trial_started_at: authUser.trial_started_at || null,
        trial_expires_at: authUser.trial_expires_at || null,
        trial_used: authUser.trial_used ?? 0,
        signup_intent: authUser.signup_intent || null,
        google_sub: authUser.google_sub || null,
        avatar_url: authUser.avatar_url || null,
        auth_provider: authUser.auth_provider || 'LOCAL',
        created_at: authUser.created_at || now,
        updated_at: now,
        last_login_at: authUser.last_login_at || null,
      },
    });
  } catch (err) {
    log.warn('ensurePgCommercialMirror race fallback lookup', {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
    return prisma.commercial_users.findUnique({ where: { id: userId } });
  }
}
