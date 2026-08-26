import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { ApiKeyRecord } from '../../10_CONFIG/shared/types/platform.js';
import { logActivity } from './audit-service.js';

export function hashApiKey(secretToken: string): string {
  return crypto.createHash('sha256').update(secretToken).digest('hex');
}

export function generateApiKey(
  name: string,
  userId = 'owner',
  scopes = ['profiles:read', 'profiles:write', 'profiles:launch', 'proxies:read']
): { keyRecord: ApiKeyRecord; secretKey: string } {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const rawHex = crypto.randomBytes(24).toString('hex');
  const secretKey = `mahi_live_${rawHex}`;
  const keyPrefix = secretKey.substring(0, 14);
  const keyHash = hashApiKey(secretKey);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO api_keys_v2 (
      id, user_id, name, key_prefix, key_hash, scopes_json,
      rate_limit_per_min, requests_count_month, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, name, keyPrefix, keyHash, JSON.stringify(scopes), 120, now);

  const keyRecord: ApiKeyRecord = {
    id,
    userId,
    name,
    keyPrefix,
    keyHash,
    scopes,
    rateLimitPerMin: 120,
    requestsCountMonth: 0,
    createdAt: now,
  };

  logActivity('API', 'INFO', 'Generate API Key', `Created API Key "${name}" (${keyPrefix}...)`);

  return { keyRecord, secretKey };
}

export function getApiKeys(userId = 'owner'): ApiKeyRecord[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM api_keys_v2 WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC').all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    keyPrefix: r.key_prefix,
    keyHash: r.key_hash,
    scopes: JSON.parse(r.scopes_json || '[]'),
    rateLimitPerMin: r.rate_limit_per_min || 60,
    requestsCountMonth: r.requests_count_month || 0,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

export function validateApiKey(secretKey: string): ApiKeyRecord | null {
  if (!secretKey) return null;
  const hash = hashApiKey(secretKey);
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM api_keys_v2 WHERE key_hash = ? AND revoked_at IS NULL').get(hash) as any;
  if (!row) return null;

  // Increment usage count and update last used
  const now = new Date().toISOString();
  db.prepare('UPDATE api_keys_v2 SET requests_count_month = requests_count_month + 1, last_used_at = ? WHERE id = ?').run(now, row.id);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    scopes: JSON.parse(row.scopes_json || '[]'),
    rateLimitPerMin: row.rate_limit_per_min || 60,
    requestsCountMonth: (row.requests_count_month || 0) + 1,
    lastUsedAt: now,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

export function revokeApiKey(keyId: string): boolean {
  const db = getDatabase();
  db.prepare('UPDATE api_keys_v2 SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), keyId);
  logActivity('API', 'WARNING', 'Revoke API Key', `Revoked API Key ID: ${keyId}`);
  return true;
}
