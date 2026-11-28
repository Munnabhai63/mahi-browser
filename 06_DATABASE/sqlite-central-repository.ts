import { getDatabase, type SqliteWrapper } from './connection.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
import type { CentralRepository } from './central-repository-contract.js';
import type {
  AuthSecurityLogResult,
  AuthSessionCreateInput,
  AuthSessionRecord,
  AuthSessionUpdateInput,
  AuthUserCreateInput,
  AuthUserRecord,
  AuthUserUpdateInput,
  AuthVerificationTokenCreateInput,
  AuthVerificationTokenRecord,
  CloudProfileCreateInput,
  CloudProfileDeltaCreateInput,
  CloudProfileDeltaRecord,
  CloudProfileLockRecord,
  CloudProfileLockUpsertInput,
  CloudProfileRecord,
  CloudProfileUpdateInput,
  CloudProfileVersionCreateInput,
  CloudProfileVersionRecord,
  CloudSyncAuditLogResult,
  CloudUploadSessionCreateInput,
  CloudUploadSessionRecord,
  CloudUploadSessionUpdateInput,
  CommercialUserCreateInput,
  CommercialUserRecord,
  CommercialUserUpdateInput,
  RemoteApiKeyAuditResult,
  RemoteApiKeyCreateInput,
  RemoteApiKeyRecord,
  TeamWorkspaceCreateInput,
  TeamWorkspaceMemberCreateInput,
  TeamWorkspaceMemberRecord,
  TeamWorkspaceRecord,
  TeamWorkspaceUpdateInput,
  WebHandoffSessionCreateInput,
  WebHandoffSessionRecord,
  WebHandoffUserPayload,
} from './central-repository-types.js';

const log = createLogger('sqlite-central-repository');

type SqliteUpdatableTable =
  | 'auth_users'
  | 'auth_sessions'
  | 'commercial_users'
  | 'cloud_profiles'
  | 'cloud_sync_upload_sessions'
  | 'team_workspaces';

export class SqliteCentralRepository implements CentralRepository {
  public backendName: 'sqlite' = 'sqlite';

  private get db(): SqliteWrapper {
    return getDatabase();
  }

  private runDynamicUpdate(table: SqliteUpdatableTable, id: string, data: object): boolean {
    const record = data as Record<string, unknown>;
    const fields = Object.keys(record);
    if (fields.length === 0) return false;
    const sets = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => record[f]);
    this.db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...values, id);
    return true;
  }

  // --- Auth Users ---
  async findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const norm = email.toLowerCase().trim();
    const row = this.db.prepare('SELECT * FROM auth_users WHERE email = ? OR normalized_email = ?').get(email, norm);
    return (row as unknown as AuthUserRecord | undefined) || null;
  }

  async findAuthUserById(id: string): Promise<AuthUserRecord | null> {
    const row = this.db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id);
    return (row as unknown as AuthUserRecord | undefined) || null;
  }

  async createAuthUser(data: AuthUserCreateInput): Promise<AuthUserRecord | null> {
    const normalizedEmail = (data.normalized_email || data.email).toLowerCase().trim();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO auth_users (
        id, email, normalized_email, password_hash, salt, name, role, status,
        email_verified, email_verified_at, plan_id, profile_quota,
        trial_started_at, trial_expires_at, trial_used, signup_intent,
        google_sub, avatar_url, auth_provider, created_at, updated_at, last_login_at,
        accepted_terms, terms_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.email,
      normalizedEmail,
      data.password_hash || data.passwordHash || '',
      data.salt || '',
      data.name || '',
      data.role || 'USER',
      data.status || 'ACTIVE',
      data.email_verified ? 1 : 0,
      data.email_verified_at || null,
      data.plan_id || 'plan_free',
      data.profile_quota ?? 10,
      data.trial_started_at || null,
      data.trial_expires_at || null,
      data.trial_used ? 1 : 0,
      data.signup_intent || null,
      data.google_sub || null,
      data.avatar_url || null,
      data.auth_provider || 'LOCAL',
      data.created_at || now,
      data.updated_at || now,
      data.last_login_at || null,
      data.accepted_terms ?? data.acceptedTerms ?? 0,
      data.terms_version || data.termsVersion || null
    );
    return this.findAuthUserById(data.id);
  }

  async updateAuthUser(id: string, data: AuthUserUpdateInput): Promise<AuthUserRecord | null> {
    this.runDynamicUpdate('auth_users', id, data);
    return this.findAuthUserById(id);
  }

  async updateAuthUserTerms(userId: string, acceptedTerms: number, termsVersion: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const info = this.db
        .prepare('UPDATE auth_users SET accepted_terms = ?, terms_version = ?, updated_at = ? WHERE id = ?')
        .run(acceptedTerms, termsVersion, now, userId);
      return info.changes > 0;
    } catch (err) {
      log.error('[SqliteCentralRepository] updateAuthUserTerms error', {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // --- Auth Sessions ---
  async createAuthSession(data: AuthSessionCreateInput): Promise<AuthSessionCreateInput> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO auth_sessions (
        id, user_id, refresh_token_hash, device_id, device_name, platform, ip_address, is_revoked, created_at, last_used_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.user_id || data.userId,
      data.refresh_token_hash || data.refreshTokenHash,
      data.device_id || data.deviceId,
      data.device_name || data.deviceName || 'Unknown Device',
      data.platform || 'windows',
      data.ip_address || data.ipAddress || null,
      data.is_revoked ? 1 : 0,
      data.created_at || now,
      data.last_used_at || now,
      data.expires_at || data.expiresAt
    );
    return data;
  }

  async findAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const row = this.db.prepare('SELECT * FROM auth_sessions WHERE refresh_token_hash = ?').get(tokenHash);
    return (row as unknown as AuthSessionRecord | undefined) || null;
  }

  async updateAuthSession(id: string, data: AuthSessionUpdateInput): Promise<boolean | null> {
    return this.runDynamicUpdate('auth_sessions', id, data) ? true : null;
  }

  async revokeAuthSession(id: string): Promise<boolean> {
    const res = this.db.prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE id = ?').run(id);
    return res.changes > 0;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const res = this.db.prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0').run(userId);
    return res.changes;
  }

  async listUserAuthSessions(userId: string): Promise<AuthSessionRecord[]> {
    return this.db
      .prepare('SELECT * FROM auth_sessions WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as AuthSessionRecord[];
  }

  // --- Verification Tokens ---
  async createVerificationToken(data: AuthVerificationTokenCreateInput): Promise<AuthVerificationTokenCreateInput> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO auth_verification_tokens (id, token_hash, user_id, email, type, expires_at, created_at, used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.token_hash || data.tokenHash,
      data.user_id || data.userId,
      data.email,
      data.type || 'EMAIL_VERIFY',
      data.expires_at || data.expiresAt,
      data.created_at || now,
      data.used_at || null
    );
    return data;
  }

  async findVerificationTokenByHash(tokenHash: string): Promise<AuthVerificationTokenRecord | null> {
    const row = this.db.prepare('SELECT * FROM auth_verification_tokens WHERE token_hash = ?').get(tokenHash);
    return (row as unknown as AuthVerificationTokenRecord | undefined) || null;
  }

  async consumeVerificationToken(tokenHash: string): Promise<AuthVerificationTokenRecord | null> {
    const token = await this.findVerificationTokenByHash(tokenHash);
    if (!token || token.used_at) return null;
    const now = new Date().toISOString();
    this.db.prepare('UPDATE auth_verification_tokens SET used_at = ? WHERE token_hash = ?').run(now, tokenHash);
    return { ...token, used_at: now };
  }

  async invalidatePendingVerificationTokens(userId: string, type = 'EMAIL_VERIFICATION'): Promise<number> {
    const now = new Date().toISOString();
    const res = this.db
      .prepare(`
      UPDATE auth_verification_tokens SET used_at = ?
      WHERE user_id = ? AND type = ? AND used_at IS NULL
    `)
      .run(now, userId, type);
    return res.changes;
  }

  // Convenience Aliases for Auth Flow
  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.findAuthUserByEmail(email);
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    return this.findAuthUserById(id);
  }

  async createUser(data: AuthUserCreateInput): Promise<AuthUserRecord | null> {
    return this.createAuthUser(data);
  }

  async updateUser(id: string, data: AuthUserUpdateInput): Promise<AuthUserRecord | null> {
    return this.updateAuthUser(id, data);
  }

  async updateUserLastLogin(id: string, timestamp?: string): Promise<AuthUserRecord | null> {
    return this.updateAuthUser(id, { last_login_at: timestamp || new Date().toISOString() });
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<AuthUserRecord | null> {
    return this.updateAuthUser(id, { password_hash: passwordHash, salt });
  }

  async markUserEmailVerified(id: string): Promise<AuthUserRecord | null> {
    const now = new Date().toISOString();
    return this.updateAuthUser(id, { email_verified: 1, email_verified_at: now, status: 'ACTIVE' });
  }

  async createSession(data: AuthSessionCreateInput): Promise<AuthSessionCreateInput> {
    return this.createAuthSession(data);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    return this.findAuthSessionByTokenHash(tokenHash);
  }

  async rotateSessionToken(
    sessionId: string,
    newHash: string,
    expiresAt: string,
    ip?: string
  ): Promise<boolean | null> {
    return this.updateAuthSession(sessionId, {
      refresh_token_hash: newHash,
      expires_at: expiresAt,
      last_used_at: new Date().toISOString(),
      ip_address: ip || '127.0.0.1',
    });
  }

  async findVerificationToken(tokenHash: string): Promise<AuthVerificationTokenRecord | null> {
    return this.findVerificationTokenByHash(tokenHash);
  }

  async markVerificationTokenUsed(tokenHashOrId: string): Promise<AuthVerificationTokenRecord | null> {
    return this.consumeVerificationToken(tokenHashOrId);
  }

  // --- Security Logs ---
  async logAuthSecurity(
    userId: string | null,
    action: string,
    details?: string,
    ip?: string,
    result = 'SUCCESS'
  ): Promise<AuthSecurityLogResult> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO auth_security_logs (id, user_id, action, ip_address, details, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, action, ip || null, details || null, result, now);
    return { id, user_id: userId, action, result };
  }

  // --- Commercial Users ---
  async findCommercialUserById(id: string): Promise<CommercialUserRecord | null> {
    const row = this.db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(id);
    return (row as unknown as CommercialUserRecord | undefined) || null;
  }

  async findCommercialUserByEmail(email: string): Promise<CommercialUserRecord | null> {
    const row = this.db.prepare('SELECT * FROM commercial_users WHERE email = ?').get(email);
    return (row as unknown as CommercialUserRecord | undefined) || null;
  }

  async createCommercialUser(data: CommercialUserCreateInput): Promise<CommercialUserRecord | null> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO commercial_users (
        id, email, password_hash, salt, name, role, status, plan_id, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.email,
      data.password_hash || data.passwordHash,
      data.salt,
      data.name || data.email.split('@')[0],
      data.role || 'USER',
      data.status || 'ACTIVE',
      data.plan_id || data.planId || 'plan_free',
      data.created_at || now,
      data.updated_at || now,
      data.last_login_at || null
    );
    return this.findCommercialUserById(data.id);
  }

  async updateCommercialUser(id: string, data: CommercialUserUpdateInput): Promise<CommercialUserRecord | null> {
    this.runDynamicUpdate('commercial_users', id, data);
    return this.findCommercialUserById(id);
  }

  // --- Cloud Profiles ---
  async findCloudProfileById(id: string): Promise<CloudProfileRecord | null> {
    const row = this.db.prepare('SELECT * FROM cloud_profiles WHERE id = ?').get(id);
    return (row as unknown as CloudProfileRecord | undefined) || null;
  }

  async createCloudProfile(data: CloudProfileCreateInput): Promise<CloudProfileRecord | null> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO cloud_profiles (id, owner_id, local_profile_id, name, current_version, status, storage_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.owner_id || data.ownerId,
      data.local_profile_id || data.localProfileId,
      data.name,
      data.current_version ?? data.currentVersion ?? 1,
      data.status || 'ACTIVE',
      data.storage_bytes ?? data.storageBytes ?? 0,
      data.created_at || now,
      data.updated_at || now
    );
    return this.findCloudProfileById(data.id);
  }

  async updateCloudProfile(id: string, data: CloudProfileUpdateInput): Promise<CloudProfileRecord | null> {
    this.runDynamicUpdate('cloud_profiles', id, data);
    return this.findCloudProfileById(id);
  }

  async deleteCloudProfile(id: string): Promise<boolean> {
    try {
      this.db.prepare('DELETE FROM cloud_profiles WHERE id = ?').run(id);
      return true;
    } catch {
      return false;
    }
  }

  async listCloudProfiles(ownerId: string): Promise<CloudProfileRecord[]> {
    return this.db
      .prepare('SELECT * FROM cloud_profiles WHERE owner_id = ? ORDER BY updated_at DESC')
      .all(ownerId) as unknown as CloudProfileRecord[];
  }

  // --- Cloud Profile Versions ---
  async createCloudProfileVersion(data: CloudProfileVersionCreateInput): Promise<CloudProfileVersionCreateInput> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO cloud_profile_versions (
        id, cloud_profile_id, version, object_key, file_size, checksum_sha256,
        encrypted_data_key, iv, auth_tag, source_device_id, source_device_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.cloud_profile_id || data.cloudProfileId,
      data.version,
      data.object_key || data.objectKey,
      data.file_size ?? data.fileSize ?? 0,
      data.checksum_sha256 || data.checksumSha256,
      data.encrypted_data_key || data.encryptedDataKey,
      data.iv,
      data.auth_tag || data.authTag,
      data.source_device_id || data.sourceDeviceId,
      data.source_device_name || data.sourceDeviceName || null,
      data.created_at || now
    );
    return data;
  }

  async getLatestCloudProfileVersion(cloudProfileId: string): Promise<CloudProfileVersionRecord | null> {
    const row = this.db
      .prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ?
      ORDER BY version DESC
      LIMIT 1
    `)
      .get(cloudProfileId);
    return (row as unknown as CloudProfileVersionRecord | undefined) || null;
  }

  async getCloudProfileVersion(cloudProfileId: string, versionNum: number): Promise<CloudProfileVersionRecord | null> {
    const row = this.db
      .prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ? AND version = ?
    `)
      .get(cloudProfileId, versionNum);
    return (row as unknown as CloudProfileVersionRecord | undefined) || null;
  }

  async createCloudProfileDelta(data: CloudProfileDeltaCreateInput): Promise<CloudProfileDeltaCreateInput> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO cloud_profile_deltas (
        id, cloud_profile_id, base_version, delta_version, delta_type, manifest_hash,
        object_key, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag,
        source_device_id, source_device_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.cloud_profile_id || data.cloudProfileId,
      data.base_version ?? data.baseVersion ?? 1,
      data.delta_version ?? data.deltaVersion ?? 1,
      data.delta_type || data.deltaType || 'cookies_only',
      data.manifest_hash || data.manifestHash || null,
      data.object_key || data.objectKey,
      data.file_size ?? data.fileSize ?? 0,
      data.checksum_sha256 || data.checksumSha256,
      data.encrypted_data_key || data.encryptedDataKey,
      data.iv,
      data.auth_tag || data.authTag,
      data.source_device_id || data.sourceDeviceId,
      data.source_device_name || data.sourceDeviceName || null,
      data.created_at || now
    );
    return data;
  }

  async getLatestCloudProfileDelta(cloudProfileId: string): Promise<CloudProfileDeltaRecord | null> {
    const row = this.db
      .prepare(`
      SELECT * FROM cloud_profile_deltas
      WHERE cloud_profile_id = ?
      ORDER BY delta_version DESC
      LIMIT 1
    `)
      .get(cloudProfileId);
    return (row as unknown as CloudProfileDeltaRecord | undefined) || null;
  }

  // --- Upload Sessions ---
  async createUploadSessionRecord(data: CloudUploadSessionCreateInput): Promise<CloudUploadSessionCreateInput> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO cloud_sync_upload_sessions (
        id, user_id, cloud_profile_id, base_version, target_version, archive_format, manifest_hash,
        object_key, expected_size, expected_checksum, encrypted_data_key, iv, auth_tag, status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.user_id || data.userId,
      data.cloud_profile_id || data.cloudProfileId,
      data.base_version ?? data.baseVersion ?? 0,
      data.target_version ?? data.targetVersion ?? 1,
      data.archive_format || data.archiveFormat || 'full',
      data.manifest_hash || data.manifestHash || null,
      data.object_key || data.objectKey,
      data.expected_size ?? data.expectedSize ?? 0,
      data.expected_checksum || data.expectedChecksum,
      data.encrypted_data_key || data.encryptedDataKey,
      data.iv,
      data.auth_tag || data.authTag,
      data.status || 'PENDING',
      data.expires_at || data.expiresAt,
      data.created_at || now
    );
    return data;
  }

  async findUploadSessionById(id: string): Promise<CloudUploadSessionRecord | null> {
    const row = this.db.prepare('SELECT * FROM cloud_sync_upload_sessions WHERE id = ?').get(id);
    return (row as unknown as CloudUploadSessionRecord | undefined) || null;
  }

  async updateUploadSessionRecord(id: string, data: CloudUploadSessionUpdateInput): Promise<boolean | null> {
    return this.runDynamicUpdate('cloud_sync_upload_sessions', id, data) ? true : null;
  }

  // --- Cloud Sync Audits ---
  async logCloudSyncAudit(
    userId: string,
    action: string,
    details?: string,
    cloudProfileId?: string,
    deviceId?: string
  ): Promise<CloudSyncAuditLogResult> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO cloud_sync_audit_logs (id, user_id, cloud_profile_id, action, device_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, cloudProfileId || null, action, deviceId || null, details || null, now);
    return { id, user_id: userId, action };
  }

  // --- Team Workspaces ---
  async findWorkspaceById(id: string): Promise<TeamWorkspaceRecord | null> {
    const row = this.db.prepare('SELECT * FROM team_workspaces WHERE id = ?').get(id);
    return (row as unknown as TeamWorkspaceRecord | undefined) || null;
  }

  async createWorkspace(data: TeamWorkspaceCreateInput): Promise<TeamWorkspaceRecord | null> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO team_workspaces (id, name, description, owner_user_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.name,
      data.description || '',
      data.owner_user_id || data.ownerUserId,
      data.status || 'ACTIVE',
      data.created_at || now,
      data.updated_at || now
    );
    return this.findWorkspaceById(data.id);
  }

  async updateWorkspace(id: string, data: TeamWorkspaceUpdateInput): Promise<TeamWorkspaceRecord | null> {
    this.runDynamicUpdate('team_workspaces', id, data);
    return this.findWorkspaceById(id);
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    try {
      this.db.prepare('DELETE FROM team_workspaces WHERE id = ?').run(id);
      return true;
    } catch {
      return false;
    }
  }

  async listUserWorkspaces(userId: string): Promise<TeamWorkspaceRecord[]> {
    return this.db
      .prepare(`
      SELECT DISTINCT w.* FROM team_workspaces w
      LEFT JOIN team_workspace_members m ON w.id = m.workspace_id
      WHERE w.owner_user_id = ? OR (m.user_id = ? AND m.status = 'ACTIVE')
      ORDER BY w.created_at DESC
    `)
      .all(userId, userId) as unknown as TeamWorkspaceRecord[];
  }

  // --- Team Workspace Members ---
  async addWorkspaceMember(data: TeamWorkspaceMemberCreateInput): Promise<TeamWorkspaceMemberCreateInput> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO team_workspace_members (
        id, workspace_id, user_id, role, status, invited_by, joined_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.workspace_id || data.workspaceId,
      data.user_id || data.userId,
      data.role || 'MEMBER',
      data.status || 'ACTIVE',
      data.invited_by || data.invited_by_user_id || data.invitedByUserId || null,
      data.joined_at || now,
      data.created_at || now
    );
    return data;
  }

  async findWorkspaceMember(workspaceId: string, userId: string): Promise<TeamWorkspaceMemberRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM team_workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get(workspaceId, userId);
    return (row as unknown as TeamWorkspaceMemberRecord | undefined) || null;
  }

  async listWorkspaceMembers(workspaceId: string): Promise<TeamWorkspaceMemberRecord[]> {
    return this.db
      .prepare('SELECT * FROM team_workspace_members WHERE workspace_id = ? ORDER BY created_at ASC')
      .all(workspaceId) as unknown as TeamWorkspaceMemberRecord[];
  }

  async updateWorkspaceMemberRole(workspaceId: string, userId: string, role: string): Promise<boolean> {
    this.db
      .prepare('UPDATE team_workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?')
      .run(role, workspaceId, userId);
    return true;
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const res = this.db
      .prepare('DELETE FROM team_workspace_members WHERE workspace_id = ? AND user_id = ?')
      .run(workspaceId, userId);
    return res.changes > 0;
  }

  // --- Remote API Keys ---
  async findRemoteApiKeyByHash(keyHash: string): Promise<RemoteApiKeyRecord | null> {
    const row = this.db.prepare('SELECT * FROM remote_api_keys WHERE key_hash = ?').get(keyHash);
    return (row as unknown as RemoteApiKeyRecord | undefined) || null;
  }

  async createRemoteApiKey(data: RemoteApiKeyCreateInput): Promise<RemoteApiKeyCreateInput> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO remote_api_keys (
        id, user_id, workspace_id, name, key_prefix, key_hash, scopes_json,
        status, rate_limit_per_min, requests_count_month, last_used_at, expires_at, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.user_id || data.userId,
      data.workspace_id || data.workspaceId || null,
      data.name,
      data.key_prefix || data.keyPrefix,
      data.key_hash || data.keyHash,
      data.scopes_json || data.scopesJson || '["profiles:read"]',
      data.status || 'ACTIVE',
      data.rate_limit_per_min || data.rateLimitPerMin || 120,
      data.requests_count_month || data.requestsCountMonth || 0,
      data.last_used_at || null,
      data.expires_at || null,
      data.created_at || now,
      data.revoked_at || null
    );
    return data;
  }

  async listRemoteApiKeys(userId: string): Promise<RemoteApiKeyRecord[]> {
    return this.db
      .prepare('SELECT * FROM remote_api_keys WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as RemoteApiKeyRecord[];
  }

  async revokeRemoteApiKey(id: string, userId?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = userId
      ? this.db
          .prepare('UPDATE remote_api_keys SET status = "REVOKED", revoked_at = ? WHERE id = ? AND user_id = ?')
          .run(now, id, userId)
      : this.db.prepare('UPDATE remote_api_keys SET status = "REVOKED", revoked_at = ? WHERE id = ?').run(now, id);
    return res.changes > 0;
  }

  async updateRemoteApiKeyLastUsed(id: string): Promise<boolean> {
    this.db.prepare('UPDATE remote_api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    return true;
  }

  // --- Remote API Key Audits ---
  async logRemoteApiKeyAudit(
    apiKeyId: string,
    userId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    ipAddress?: string
  ): Promise<RemoteApiKeyAuditResult> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const action = `${method.toUpperCase()} ${endpoint}`;
    const details = JSON.stringify({ statusCode, method, endpoint });
    this.db.prepare(`
      INSERT INTO remote_api_key_audits (id, key_id, user_id, action, ip_address, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, apiKeyId, userId, action, ipAddress || null, details, now);
    return { id, key_id: apiKeyId, user_id: userId, action, details };
  }

  // --- Locks ---
  async findLock(cloudProfileId: string): Promise<CloudProfileLockRecord | null> {
    const row = this.db.prepare('SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ?').get(cloudProfileId);
    return (row as unknown as CloudProfileLockRecord | undefined) || null;
  }

  async upsertLock(data: CloudProfileLockUpsertInput): Promise<CloudProfileLockUpsertInput> {
    this.db.prepare(`
      INSERT OR REPLACE INTO cloud_profile_locks (cloud_profile_id, device_id, device_name, user_id, locked_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.cloudProfileId, data.deviceId, data.deviceName, data.userId, data.lockedAt, data.expiresAt);
    return data;
  }

  async deleteLock(cloudProfileId: string): Promise<boolean> {
    try {
      this.db.prepare('DELETE FROM cloud_profile_locks WHERE cloud_profile_id = ?').run(cloudProfileId);
      return true;
    } catch {
      return false;
    }
  }

  async createWebHandoffSession(data: WebHandoffSessionCreateInput): Promise<WebHandoffSessionCreateInput> {
    this.db
      .prepare('INSERT INTO web_handoff_sessions (code, token, user_json, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)')
      .run(data.code, data.token, data.userJson, data.createdAt, data.expiresAt);
    return data;
  }

  async consumeWebHandoffSessionAtomically(
    code: string,
    now: number
  ): Promise<{ token: string; user: WebHandoffUserPayload | null } | null> {
    const row = this.db
      .prepare('SELECT * FROM web_handoff_sessions WHERE code = ?')
      .get(code) as unknown as WebHandoffSessionRecord | undefined;
    if (!row) return null;
    if (row.used === 1 || Number(row.expires_at) <= now) {
      try {
        this.db.prepare('DELETE FROM web_handoff_sessions WHERE code = ?').run(code);
      } catch (cleanupErr) {
        log.debug('Expired SQLite web_handoff_sessions cleanup skipped', {
          err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      }
      return null;
    }
    const updateRes = this.db
      .prepare('UPDATE web_handoff_sessions SET used = 1 WHERE code = ? AND used = 0 AND expires_at > ?')
      .run(code, now);
    if (updateRes.changes === 1) {
      let user: WebHandoffUserPayload | null = null;
      try {
        user = JSON.parse(row.user_json) as WebHandoffUserPayload;
      } catch (parseErr) {
        log.warn('Failed parsing consumed SQLite web_handoff_sessions user_json', {
          err: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }
      return { token: row.token, user };
    }
    return null;
  }
}
