/**
 * MAHI Browser — Remote Cloud API Service
 * Phase 6 Architecture
 *
 * Implements:
 * - Cryptographically Secure API Key Generation & SHA-256 Hashing
 * - API Key Revocation & Key Rotation
 * - Granular Scopes Enforcement
 * - Dual-Gate Enforcement (API Key Scope + Workspace RBAC)
 * - Multi-dimensional Rate Limiting
 * - Idempotency Cache
 * - API Security Audit Logging
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  consumeFixedWindowRateLimitAsync,
  clearLocalDistributedStateNamespace,
  clearDistributedStateNamespaceAsync,
} from '../../08_SECURITY/distributed-state-service.js';
import { getCentralUserById, AuthUser } from '../../05_AUTH/central-auth-service.js';
import { hasWorkspacePermission, getMemberRoleInWorkspace } from './team-workspace-service.js';
import { TeamRole, TeamPermission } from '../../10_CONFIG/shared/types/workspace.js';
import {
  RemoteApiKeyRecord,
  CreateRemoteApiKeyDTO,
  RemoteApiScope,
  ALL_REMOTE_API_SCOPES,
  RemoteAuthContext,
  RemoteApiKeyAuditRecord,
} from '../../10_CONFIG/shared/types/remote-api.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('remote-api-service');

// ============================================================================
// HASHING & KEY HELPERS
// ============================================================================

export function hashSecretKey(rawSecret: string): string {
  return crypto.createHash('sha256').update(rawSecret).digest('hex');
}

export function generateRandomKey(prefix = 'mahi_live_'): { rawKey: string; keyPrefix: string; keyHash: string } {
  const entropy = crypto.randomBytes(24).toString('hex');
  const rawKey = `${prefix}${entropy}`;
  const keyPrefix = rawKey.substring(0, 14);
  const keyHash = hashSecretKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

// ============================================================================
// SLIDING WINDOW IN-MEMORY RATE LIMITER
// ============================================================================

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Clean up stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now > bucket.resetAt) {
      rateLimitBuckets.delete(key);
    }
  }
}, 300000).unref();

export function checkRateLimit(
  identifier: string,
  limitPerMinute = 120
): { allowed: boolean; limit: number; remaining: number; resetSeconds: number } {
  const now = Date.now();
  const windowMs = 60000;
  let bucket = rateLimitBuckets.get(identifier);

  if (!bucket || now > bucket.resetAt) {
    bucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitBuckets.set(identifier, bucket);
    return {
      allowed: true,
      limit: limitPerMinute,
      remaining: Math.max(0, limitPerMinute - 1),
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  }

  bucket.count++;
  const remaining = Math.max(0, limitPerMinute - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return {
    allowed: bucket.count <= limitPerMinute,
    limit: limitPerMinute,
    remaining,
    resetSeconds,
  };
}

export async function checkRateLimitAsync(
  identifier: string,
  limitPerMinute = 120
): Promise<{ allowed: boolean; limit: number; remaining: number; resetSeconds: number }> {
  const windowMs = 60_000;
  const res = await consumeFixedWindowRateLimitAsync({
    namespace: 'remote_api_rl',
    key: identifier,
    windowMs,
    maxAttempts: limitPerMinute,
  });
  return {
    allowed: res.allowed,
    limit: limitPerMinute,
    remaining: res.remaining,
    resetSeconds: res.retryAfterSeconds || Math.ceil(windowMs / 1000),
  };
}

export function resetRateLimits(): void {
  rateLimitBuckets.clear();
  clearLocalDistributedStateNamespace('remote_api_rl');
}

export async function resetRateLimitsAsync(): Promise<void> {
  rateLimitBuckets.clear();
  await clearDistributedStateNamespaceAsync('remote_api_rl');
}

// ============================================================================
// IDEMPOTENCY SERVICE
// ============================================================================

export function getCachedIdempotentResponse(
  idempotencyKey: string,
  userId: string
): { statusCode: number; response: unknown } | null {
  if (!idempotencyKey) return null;
  const db = getDatabase();
  const row = db.prepare(`
    SELECT status_code, response_json, expires_at
    FROM api_idempotency_records
    WHERE idempotency_key = ? AND user_id = ?
  `).get(idempotencyKey, userId) as any;

  if (!row) return null;

  const now = new Date().toISOString();
  if (row.expires_at < now) {
    // Expired
    db.prepare('DELETE FROM api_idempotency_records WHERE idempotency_key = ? AND user_id = ?').run(idempotencyKey, userId);
    return null;
  }

  try {
    return {
      statusCode: row.status_code,
      response: JSON.parse(row.response_json),
    };
  } catch {
    return null;
  }
}

export function saveIdempotentResponse(
  idempotencyKey: string,
  userId: string,
  endpoint: string,
  statusCode: number,
  response: unknown,
  ttlHours = 24
): void {
  if (!idempotencyKey) return;
  const db = getDatabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 3600000).toISOString();

  try {
    db.prepare(`
      INSERT OR REPLACE INTO api_idempotency_records (
        idempotency_key, user_id, endpoint, status_code, response_json, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(idempotencyKey, userId, endpoint, statusCode, JSON.stringify(response), now.toISOString(), expiresAt);
  } catch (err) {
    log.error('[Idempotency] Failed to store idempotent record:', err);
  }
}

// ============================================================================
// REMOTE API SERVICE CLASS
// ============================================================================

export class RemoteApiService {
  private static instance: RemoteApiService | null = null;

  public static getInstance(): RemoteApiService {
    if (!RemoteApiService.instance) {
      RemoteApiService.instance = new RemoteApiService();
    }
    return RemoteApiService.instance;
  }

  // ==========================================================================
  // API KEY MANAGEMENT
  // ==========================================================================

  public createApiKey(
    userId: string,
    dto: CreateRemoteApiKeyDTO
  ): { keyRecord: RemoteApiKeyRecord; secretKey: string } {
    const user = getCentralUserById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User account not found or inactive');
    }

    const trimmedName = (dto.name || '').trim();
    if (!trimmedName) {
      throw new Error('API key name is required');
    }

    // Validate scopes
    const validScopes: RemoteApiScope[] = [];
    if (dto.scopes && Array.isArray(dto.scopes)) {
      for (const sc of dto.scopes) {
        if (ALL_REMOTE_API_SCOPES.includes(sc)) {
          validScopes.push(sc);
        }
      }
    }
    if (validScopes.length === 0) {
      validScopes.push('profiles:read');
    }

    const { rawKey, keyPrefix, keyHash } = generateRandomKey('mahi_live_');
    const id = `key_${crypto.randomUUID()}`;
    const now = new Date();
    const rateLimit = dto.rateLimitPerMin && dto.rateLimitPerMin > 0 ? dto.rateLimitPerMin : 120;

    let expiresAt: string | null = null;
    if (dto.expiresInDays && dto.expiresInDays > 0) {
      expiresAt = new Date(now.getTime() + dto.expiresInDays * 86400000).toISOString();
    }

    const db = getDatabase();
    db.prepare(`
      INSERT INTO remote_api_keys (
        id, user_id, workspace_id, name, key_prefix, key_hash,
        scopes_json, status, rate_limit_per_min, requests_count_month, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 0, ?, ?)
    `).run(
      id,
      userId,
      dto.workspaceId || null,
      trimmedName,
      keyPrefix,
      keyHash,
      JSON.stringify(validScopes),
      rateLimit,
      now.toISOString(),
      expiresAt
    );

    const keyRecord: RemoteApiKeyRecord = {
      id,
      userId,
      workspaceId: dto.workspaceId || null,
      name: trimmedName,
      keyPrefix,
      keyHash,
      scopes: validScopes,
      status: 'ACTIVE',
      rateLimitPerMin: rateLimit,
      requestsCountMonth: 0,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.logAudit(id, userId, 'CREATED', undefined, `Created API key "${trimmedName}" (${keyPrefix}...) with scopes: ${validScopes.join(', ')}`);

    return { keyRecord, secretKey: rawKey };
  }

  public listApiKeys(userId: string, workspaceId?: string): RemoteApiKeyRecord[] {
    const db = getDatabase();
    let query = 'SELECT * FROM remote_api_keys WHERE user_id = ? AND status != \'REVOKED\'';
    const params: unknown[] = [userId];

    if (workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(workspaceId);
    }

    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      workspaceId: r.workspace_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      keyHash: r.key_hash,
      scopes: JSON.parse(r.scopes_json || '[]'),
      status: r.status,
      rateLimitPerMin: r.rate_limit_per_min || 120,
      requestsCountMonth: r.requests_count_month || 0,
      lastUsedAt: r.last_used_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      revokedAt: r.revoked_at,
    }));
  }

  public getApiKeyById(keyId: string, userId: string): RemoteApiKeyRecord | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM remote_api_keys WHERE id = ? AND user_id = ?').get(keyId, userId) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      scopes: JSON.parse(row.scopes_json || '[]'),
      status: row.status,
      rateLimitPerMin: row.rate_limit_per_min || 120,
      requestsCountMonth: row.requests_count_month || 0,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    };
  }

  public revokeApiKey(keyId: string, userId: string): boolean {
    const db = getDatabase();
    const row = db.prepare('SELECT id, name FROM remote_api_keys WHERE id = ? AND user_id = ?').get(keyId, userId) as any;
    if (!row) return false;

    const now = new Date().toISOString();
    db.prepare('UPDATE remote_api_keys SET status = \'REVOKED\', revoked_at = ? WHERE id = ?').run(now, keyId);

    this.logAudit(keyId, userId, 'REVOKED', undefined, `Revoked API key "${row.name}" (${keyId})`);
    return true;
  }

  public rotateApiKey(keyId: string, userId: string): { keyRecord: RemoteApiKeyRecord; newSecretKey: string } {
    const key = this.getApiKeyById(keyId, userId);
    if (!key || key.status !== 'ACTIVE') {
      throw new Error('API key not found or revoked');
    }

    const { rawKey, keyPrefix, keyHash } = generateRandomKey('mahi_live_');
    const db = getDatabase();
    db.prepare(`
      UPDATE remote_api_keys
      SET key_prefix = ?, key_hash = ?
      WHERE id = ?
    `).run(keyPrefix, keyHash, keyId);

    key.keyPrefix = keyPrefix;
    key.keyHash = keyHash;

    this.logAudit(keyId, userId, 'ROTATED', undefined, `Rotated API key secret for "${key.name}" (${keyPrefix}...)`);
    return { keyRecord: key, newSecretKey: rawKey };
  }

  public authenticateApiKey(
    secretKey: string
  ): { keyRecord: RemoteApiKeyRecord; user: AuthUser; workspaceRole?: TeamRole } | null {
    if (!secretKey || !secretKey.startsWith('mahi_')) {
      return null;
    }

    const hash = hashSecretKey(secretKey);
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM remote_api_keys
      WHERE key_hash = ? AND status = 'ACTIVE'
    `).get(hash) as any;

    if (!row) return null;

    // Check expiration if set
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }

    const user = getCentralUserById(row.user_id);
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    // Update last used & increment monthly request counter
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE remote_api_keys
      SET last_used_at = ?, requests_count_month = requests_count_month + 1
      WHERE id = ?
    `).run(now, row.id);

    let workspaceRole: TeamRole | undefined;
    if (row.workspace_id) {
      const member = getMemberRoleInWorkspace(row.user_id, row.workspace_id);
      if (member) workspaceRole = member.role;
    }

    const keyRecord: RemoteApiKeyRecord = {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      keyHash: row.key_hash,
      scopes: JSON.parse(row.scopes_json || '[]'),
      status: row.status,
      rateLimitPerMin: row.rate_limit_per_min || 120,
      requestsCountMonth: (row.requests_count_month || 0) + 1,
      lastUsedAt: now,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    };

    return { keyRecord, user, workspaceRole };
  }

  // ==========================================================================
  // DUAL-GATE EVALUATION: SCOPES + WORKSPACE RBAC
  // ==========================================================================

  public evaluateAccess(
    authContext: RemoteAuthContext,
    requiredScope: RemoteApiScope,
    requiredPermission?: TeamPermission,
    targetWorkspaceId?: string
  ): { allowed: boolean; code?: string; message?: string } {
    // 1. If authenticated via API Key, verify the key has the required scope
    if (authContext.authType === 'API_KEY') {
      const scopes = authContext.apiKeyScopes || [];
      if (!scopes.includes(requiredScope)) {
        this.logAudit(
          authContext.apiKeyId || 'unknown',
          authContext.userId,
          'SCOPE_DENIED',
          undefined,
          `Denied access to scope "${requiredScope}"`
        );
        return {
          allowed: false,
          code: 'FORBIDDEN_SCOPE',
          message: `Forbidden: API Key lacks the required scope '${requiredScope}'.`,
        };
      }

      // If the key is locked to a specific workspace, ensure caller doesn't cross into another
      if (authContext.workspaceId && targetWorkspaceId && authContext.workspaceId !== targetWorkspaceId) {
        return {
          allowed: false,
          code: 'CROSS_WORKSPACE_DENIED',
          message: 'Forbidden: API Key is restricted to another workspace.',
        };
      }
    }

    // 2. If a workspace permission is required and target workspace is specified:
    const wsId = targetWorkspaceId || authContext.workspaceId;
    if (requiredPermission && wsId) {
      const hasPerm = hasWorkspacePermission(authContext.userId, wsId, requiredPermission);
      if (!hasPerm) {
        return {
          allowed: false,
          code: 'FORBIDDEN_RBAC',
          message: `Forbidden: Your workspace role does not have permission '${requiredPermission}'.`,
        };
      }
    }

    return { allowed: true };
  }

  // ==========================================================================
  // AUDIT LOGGING
  // ==========================================================================

  public logAudit(
    keyId: string,
    userId: string,
    action: 'CREATED' | 'REVOKED' | 'ROTATED' | 'SCOPE_DENIED' | 'RATE_LIMITED',
    ipAddress?: string,
    details?: string
  ): void {
    try {
      const db = getDatabase();
      const id = `aud_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO remote_api_key_audits (id, key_id, user_id, action, ip_address, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, keyId, userId, action, ipAddress || null, details || null, now);
    } catch (err) {
      log.error('[RemoteApiAudit] Error logging audit event:', err);
    }
  }

  public getAuditLogs(keyId: string, userId: string): RemoteApiKeyAuditRecord[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM remote_api_key_audits
      WHERE key_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(keyId, userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      keyId: r.key_id,
      userId: r.user_id,
      action: r.action,
      ipAddress: r.ip_address,
      details: r.details,
      createdAt: r.created_at,
    }));
  }
}
