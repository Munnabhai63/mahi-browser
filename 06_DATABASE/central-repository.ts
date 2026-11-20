/**
 * MAHI Platform V2 — Unified Central Data Access Layer
 * Seamlessly switches between PostgreSQL (Prisma) for Central Cloud Gateway
 * and SQLite for offline local desktop execution and testing.
 */

import { getPrismaClient, isPostgresConfigured } from './prisma-client.js';
export { isPostgresConfigured } from './prisma-client.js';
import { getDatabase } from './connection.js';

export interface CentralRepository {
  backendName: 'postgres' | 'sqlite';

  // Auth Users
  findAuthUserByEmail(email: string): Promise<any | null>;
  findAuthUserById(id: string): Promise<any | null>;
  createAuthUser(data: any): Promise<any>;
  updateAuthUser(id: string, data: any): Promise<any>;
  updateAuthUserTerms(userId: string, acceptedTerms: number, termsVersion: string): Promise<boolean>;

  // Auth Sessions
  createAuthSession(data: any): Promise<any>;
  findAuthSessionByTokenHash(tokenHash: string): Promise<any | null>;
  updateAuthSession(id: string, data: any): Promise<any>;
  revokeAuthSession(id: string): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
  listUserAuthSessions(userId: string): Promise<any[]>;

  // Verification Tokens
  createVerificationToken(data: any): Promise<any>;
  findVerificationTokenByHash(tokenHash: string): Promise<any | null>;
  consumeVerificationToken(tokenHash: string): Promise<any | null>;
  invalidatePendingVerificationTokens(userId: string, type?: string): Promise<number>;

  // Convenience Aliases for Auth Flow
  findUserByEmail?(email: string): Promise<any | null>;
  findUserById?(id: string): Promise<any | null>;
  createUser?(data: any): Promise<any>;
  updateUser?(id: string, data: any): Promise<any>;
  updateUserLastLogin?(id: string, timestamp?: string): Promise<any>;
  updateUserPassword?(id: string, passwordHash: string, salt: string): Promise<any>;
  markUserEmailVerified?(id: string): Promise<any>;
  createSession?(data: any): Promise<any>;
  findSessionByTokenHash?(tokenHash: string): Promise<any | null>;
  rotateSessionToken?(sessionId: string, newHash: string, expiresAt: string, ip?: string): Promise<any>;
  findVerificationToken?(tokenHash: string): Promise<any | null>;
  markVerificationTokenUsed?(tokenHashOrId: string): Promise<any | null>;

  // Security Logs
  logAuthSecurity(userId: string | null, action: string, details?: string, ip?: string, result?: string): Promise<any>;

  // Commercial Users
  findCommercialUserById(id: string): Promise<any | null>;
  findCommercialUserByEmail(email: string): Promise<any | null>;
  createCommercialUser(data: any): Promise<any>;
  updateCommercialUser(id: string, data: any): Promise<any>;

  // Cloud Profiles
  findCloudProfileById(id: string): Promise<any | null>;
  createCloudProfile(data: any): Promise<any>;
  updateCloudProfile(id: string, data: any): Promise<any>;
  deleteCloudProfile(id: string): Promise<boolean>;
  listCloudProfiles(ownerId: string): Promise<any[]>;

  // Cloud Versions
  createCloudProfileVersion(data: any): Promise<any>;
  getLatestCloudProfileVersion(cloudProfileId: string): Promise<any | null>;
  getCloudProfileVersion(cloudProfileId: string, version: number): Promise<any | null>;

  // Upload Sessions
  createUploadSessionRecord(data: any): Promise<any>;
  findUploadSessionById(id: string): Promise<any | null>;
  updateUploadSessionRecord(id: string, data: any): Promise<any>;

  // Cloud Sync Audits
  logCloudSyncAudit(userId: string, action: string, details?: string, cloudProfileId?: string, deviceId?: string): Promise<any>;

  // Team Workspaces
  findWorkspaceById(id: string): Promise<any | null>;
  createWorkspace(data: any): Promise<any>;
  updateWorkspace(id: string, data: any): Promise<any>;
  deleteWorkspace(id: string): Promise<boolean>;
  listUserWorkspaces(userId: string): Promise<any[]>;

  // Team Workspace Members
  addWorkspaceMember(data: any): Promise<any>;
  findWorkspaceMember(workspaceId: string, userId: string): Promise<any | null>;
  listWorkspaceMembers(workspaceId: string): Promise<any[]>;
  updateWorkspaceMemberRole(workspaceId: string, userId: string, role: string): Promise<any>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean>;

  // Remote API Keys
  findRemoteApiKeyByHash(keyHash: string): Promise<any | null>;
  createRemoteApiKey(data: any): Promise<any>;
  listRemoteApiKeys(userId: string): Promise<any[]>;
  revokeRemoteApiKey(id: string, userId?: string): Promise<boolean>;
  updateRemoteApiKeyLastUsed(id: string): Promise<any>;

  // Remote API Key Audits
  logRemoteApiKeyAudit(apiKeyId: string, userId: string, endpoint: string, method: string, statusCode: number, ipAddress?: string): Promise<any>;

  // Cloud Profile Locks (DB persistence fallback)
  findLock(cloudProfileId: string): Promise<any | null>;
  upsertLock(data: { cloudProfileId: string; deviceId: string; deviceName: string; userId: string; lockedAt: string; expiresAt: string }): Promise<any>;
  deleteLock(cloudProfileId: string): Promise<boolean>;

  // Web Handoff Sessions
  createWebHandoffSession(data: { code: string; token: string; userJson: string; createdAt: number; expiresAt: number }): Promise<any>;
  consumeWebHandoffSessionAtomically(code: string, now: number): Promise<{ token: string; user: any } | null>;
}

// ============================================================================
// POSTGRESQL REPOSITORY (Prisma)
// ============================================================================

export class PostgresCentralRepository implements CentralRepository {
  public backendName: 'postgres' = 'postgres';

  private get client(): any {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('PostgresCentralRepository requires DATABASE_URL to be configured');
    }
    return prisma as any;
  }

  // --- Auth Users ---
  async findAuthUserByEmail(email: string): Promise<any | null> {
    const norm = email.toLowerCase().trim();
    return this.client.auth_users.findFirst({
      where: {
        OR: [{ email }, { normalized_email: norm }],
      },
    });
  }

  async findAuthUserById(id: string): Promise<any | null> {
    return this.client.auth_users.findUnique({
      where: { id },
    });
  }

  async createAuthUser(data: any): Promise<any> {
    const normalizedEmail = (data.normalized_email || data.email).toLowerCase().trim();
    return this.client.auth_users.create({
      data: {
        id: data.id,
        email: data.email,
        normalized_email: normalizedEmail,
        password_hash: data.password_hash || data.passwordHash || '',
        salt: data.salt || '',
        name: data.name || '',
        role: data.role || 'USER',
        status: data.status || 'ACTIVE',
        email_verified: data.email_verified ? 1 : 0,
        email_verified_at: data.email_verified_at || null,
        plan_id: data.plan_id || 'plan_free',
        profile_quota: data.profile_quota ?? 10,
        trial_started_at: data.trial_started_at || null,
        trial_expires_at: data.trial_expires_at || null,
        trial_used: data.trial_used ? 1 : 0,
        signup_intent: data.signup_intent || null,
        google_sub: data.google_sub || null,
        avatar_url: data.avatar_url || null,
        auth_provider: data.auth_provider || 'LOCAL',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        last_login_at: data.last_login_at || null,
        accepted_terms: data.accepted_terms ?? data.acceptedTerms ?? 0,
        terms_version: data.terms_version || data.termsVersion || null,
      },
    });
  }

  async updateAuthUser(id: string, data: any): Promise<any> {
    return this.client.auth_users.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date().toISOString(),
      },
    });
  }

  async updateAuthUserTerms(userId: string, acceptedTerms: number, termsVersion: string): Promise<boolean> {
    try {
      await this.client.auth_users.update({
        where: { id: userId },
        data: {
          accepted_terms: acceptedTerms,
          terms_version: termsVersion,
          updated_at: new Date().toISOString(),
        },
      });
      return true;
    } catch (err) {
      console.error('[PostgresCentralRepository] updateAuthUserTerms error:', err);
      return false;
    }
  }

  // --- Auth Sessions ---
  async createAuthSession(data: any): Promise<any> {
    return this.client.auth_sessions.create({
      data: {
        id: data.id,
        user_id: data.user_id || data.userId,
        refresh_token_hash: data.refresh_token_hash || data.refreshTokenHash,
        device_id: data.device_id || data.deviceId,
        device_name: data.device_name || data.deviceName || 'Unknown Device',
        platform: data.platform || 'windows',
        ip_address: data.ip_address || data.ipAddress || null,
        is_revoked: data.is_revoked ? 1 : 0,
        created_at: data.created_at || new Date().toISOString(),
        last_used_at: data.last_used_at || new Date().toISOString(),
        expires_at: data.expires_at || data.expiresAt,
      },
    });
  }

  async findAuthSessionByTokenHash(tokenHash: string): Promise<any | null> {
    return this.client.auth_sessions.findUnique({
      where: { refresh_token_hash: tokenHash },
    });
  }

  async updateAuthSession(id: string, data: any): Promise<any> {
    return this.client.auth_sessions.update({
      where: { id },
      data,
    });
  }

  async revokeAuthSession(id: string): Promise<boolean> {
    try {
      await this.client.auth_sessions.update({
        where: { id },
        data: { is_revoked: 1 },
      });
      return true;
    } catch {
      return false;
    }
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const res = await this.client.auth_sessions.updateMany({
      where: { user_id: userId, is_revoked: 0 },
      data: { is_revoked: 1 },
    });
    return res.count ?? 0;
  }

  async listUserAuthSessions(userId: string): Promise<any[]> {
    return this.client.auth_sessions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  // --- Verification Tokens ---
  async createVerificationToken(data: any): Promise<any> {
    return this.client.auth_verification_tokens.create({
      data: {
        id: data.id,
        token_hash: data.token_hash || data.tokenHash,
        user_id: data.user_id || data.userId,
        email: data.email,
        type: data.type || 'EMAIL_VERIFY',
        expires_at: data.expires_at || data.expiresAt,
        created_at: data.created_at || new Date().toISOString(),
        used_at: data.used_at || null,
      },
    });
  }

  async findVerificationTokenByHash(tokenHash: string): Promise<any | null> {
    return this.client.auth_verification_tokens.findUnique({
      where: { token_hash: tokenHash },
    });
  }

  async consumeVerificationToken(tokenHash: string): Promise<any | null> {
    const token = await this.client.auth_verification_tokens.findUnique({
      where: { token_hash: tokenHash },
    });
    if (!token || token.used_at) return null;
    return this.client.auth_verification_tokens.update({
      where: { token_hash: tokenHash },
      data: { used_at: new Date().toISOString() },
    });
  }

  async invalidatePendingVerificationTokens(userId: string, type = 'EMAIL_VERIFICATION'): Promise<number> {
    const now = new Date().toISOString();
    const res = await this.client.auth_verification_tokens.updateMany({
      where: { user_id: userId, type, used_at: null },
      data: { used_at: now },
    });
    return res.count ?? 0;
  }

  // Convenience Aliases for Auth Flow
  async findUserByEmail(email: string): Promise<any | null> {
    return this.findAuthUserByEmail(email);
  }

  async findUserById(id: string): Promise<any | null> {
    return this.findAuthUserById(id);
  }

  async createUser(data: any): Promise<any> {
    return this.createAuthUser(data);
  }

  async updateUser(id: string, data: any): Promise<any> {
    return this.updateAuthUser(id, data);
  }

  async updateUserLastLogin(id: string, timestamp?: string): Promise<any> {
    return this.updateAuthUser(id, { last_login_at: timestamp || new Date().toISOString() });
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<any> {
    return this.updateAuthUser(id, { password_hash: passwordHash, salt });
  }

  async markUserEmailVerified(id: string): Promise<any> {
    const now = new Date().toISOString();
    return this.updateAuthUser(id, { email_verified: 1, email_verified_at: now, status: 'ACTIVE' });
  }

  async createSession(data: any): Promise<any> {
    return this.createAuthSession(data);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<any | null> {
    return this.findAuthSessionByTokenHash(tokenHash);
  }

  async rotateSessionToken(sessionId: string, newHash: string, expiresAt: string, ip?: string): Promise<any> {
    return this.updateAuthSession(sessionId, {
      refresh_token_hash: newHash,
      expires_at: expiresAt,
      last_used_at: new Date().toISOString(),
      ip_address: ip || '127.0.0.1',
    });
  }

  async findVerificationToken(tokenHash: string): Promise<any | null> {
    return this.findVerificationTokenByHash(tokenHash);
  }

  async markVerificationTokenUsed(tokenHashOrId: string): Promise<any | null> {
    return this.consumeVerificationToken(tokenHashOrId);
  }

  // --- Security Logs ---
  async logAuthSecurity(userId: string | null, action: string, details?: string, ip?: string, result = 'SUCCESS'): Promise<any> {
    return this.client.auth_security_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: userId,
        action,
        ip_address: ip || null,
        details: details || null,
        result,
        created_at: new Date().toISOString(),
      },
    });
  }

  // --- Commercial Users ---
  async findCommercialUserById(id: string): Promise<any | null> {
    return this.client.commercial_users.findUnique({
      where: { id },
    });
  }

  async findCommercialUserByEmail(email: string): Promise<any | null> {
    return this.client.commercial_users.findUnique({
      where: { email },
    });
  }

  async createCommercialUser(data: any): Promise<any> {
    const now = new Date().toISOString();
    return this.client.commercial_users.create({
      data: {
        id: data.id,
        email: data.email,
        password_hash: data.password_hash || data.passwordHash,
        salt: data.salt,
        name: data.name || data.email.split('@')[0],
        role: data.role || 'USER',
        status: data.status || 'ACTIVE',
        plan_id: data.plan_id || data.planId || 'plan_free',
        bonus_profiles: data.bonus_profiles ?? data.bonusProfiles ?? 0,
        bonus_proxy_bytes: BigInt(data.bonus_proxy_bytes ?? data.bonusProxyBytes ?? 0),
        feature_overrides: typeof data.feature_overrides === 'string' ? data.feature_overrides : JSON.stringify(data.feature_overrides || {}),
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        last_login_at: data.last_login_at || null,
      },
    });
  }

  async updateCommercialUser(id: string, data: any): Promise<any> {
    return this.client.commercial_users.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date().toISOString(),
      },
    });
  }

  // --- Cloud Profiles ---
  async findCloudProfileById(id: string): Promise<any | null> {
    const p = await this.client.cloud_profiles.findUnique({
      where: { id },
    });
    if (!p) return null;
    return {
      ...p,
      storage_bytes: Number(p.storage_bytes),
    };
  }

  async createCloudProfile(data: any): Promise<any> {
    const created = await this.client.cloud_profiles.create({
      data: {
        id: data.id,
        owner_id: data.owner_id || data.ownerId,
        local_profile_id: data.local_profile_id || data.localProfileId,
        name: data.name,
        current_version: data.current_version ?? data.currentVersion ?? 1,
        status: data.status || 'ACTIVE',
        storage_bytes: BigInt(data.storage_bytes ?? data.storageBytes ?? 0),
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      },
    });
    return {
      ...created,
      storage_bytes: Number(created.storage_bytes),
    };
  }

  async updateCloudProfile(id: string, data: any): Promise<any> {
    const updateData: any = { ...data };
    if (updateData.storage_bytes !== undefined) {
      updateData.storage_bytes = BigInt(updateData.storage_bytes);
    }
    updateData.updated_at = new Date().toISOString();

    const updated = await this.client.cloud_profiles.update({
      where: { id },
      data: updateData,
    });
    return {
      ...updated,
      storage_bytes: Number(updated.storage_bytes),
    };
  }

  async deleteCloudProfile(id: string): Promise<boolean> {
    try {
      await this.client.cloud_profiles.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async listCloudProfiles(ownerId: string): Promise<any[]> {
    const profiles = await this.client.cloud_profiles.findMany({
      where: { owner_id: ownerId },
      orderBy: { updated_at: 'desc' },
    });
    return profiles.map((p: any) => ({
      ...p,
      storage_bytes: Number(p.storage_bytes),
    }));
  }

  // --- Cloud Profile Versions ---
  async createCloudProfileVersion(data: any): Promise<any> {
    const version = await this.client.cloud_profile_versions.create({
      data: {
        id: data.id,
        cloud_profile_id: data.cloud_profile_id || data.cloudProfileId,
        version: data.version,
        object_key: data.object_key || data.objectKey,
        file_size: BigInt(data.file_size ?? data.fileSize ?? 0),
        checksum_sha256: data.checksum_sha256 || data.checksumSha256,
        encrypted_data_key: data.encrypted_data_key || data.encryptedDataKey,
        iv: data.iv,
        auth_tag: data.auth_tag || data.authTag,
        source_device_id: data.source_device_id || data.sourceDeviceId,
        source_device_name: data.source_device_name || data.sourceDeviceName || null,
        created_at: data.created_at || new Date().toISOString(),
      },
    });
    return {
      ...version,
      file_size: Number(version.file_size),
    };
  }

  async getLatestCloudProfileVersion(cloudProfileId: string): Promise<any | null> {
    const version = await this.client.cloud_profile_versions.findFirst({
      where: { cloud_profile_id: cloudProfileId },
      orderBy: { version: 'desc' },
    });
    if (!version) return null;
    return {
      ...version,
      file_size: Number(version.file_size),
    };
  }

  async getCloudProfileVersion(cloudProfileId: string, versionNum: number): Promise<any | null> {
    const version = await this.client.cloud_profile_versions.findFirst({
      where: {
        cloud_profile_id: cloudProfileId,
        version: versionNum,
      },
    });
    if (!version) return null;
    return {
      ...version,
      file_size: Number(version.file_size),
    };
  }

  // --- Upload Sessions ---
  async createUploadSessionRecord(data: any): Promise<any> {
    return this.client.cloud_sync_upload_sessions.create({
      data: {
        id: data.id,
        user_id: data.user_id || data.userId,
        cloud_profile_id: data.cloud_profile_id || data.cloudProfileId,
        base_version: data.base_version ?? data.baseVersion ?? 0,
        target_version: data.target_version ?? data.targetVersion ?? 1,
        object_key: data.object_key || data.objectKey,
        expected_size: BigInt(data.expected_size ?? data.expectedSize ?? 0),
        expected_checksum: data.expected_checksum || data.expectedChecksum,
        encrypted_data_key: data.encrypted_data_key || data.encryptedDataKey,
        iv: data.iv,
        auth_tag: data.auth_tag || data.authTag,
        status: data.status || 'PENDING',
        expires_at: data.expires_at || data.expiresAt,
        created_at: data.created_at || new Date().toISOString(),
      },
    });
  }

  async findUploadSessionById(id: string): Promise<any | null> {
    const s = await this.client.cloud_sync_upload_sessions.findUnique({
      where: { id },
    });
    if (!s) return null;
    return {
      ...s,
      expected_size: Number(s.expected_size),
    };
  }

  async updateUploadSessionRecord(id: string, data: any): Promise<any> {
    return this.client.cloud_sync_upload_sessions.update({
      where: { id },
      data,
    });
  }

  // --- Cloud Sync Audits ---
  async logCloudSyncAudit(userId: string, action: string, details?: string, cloudProfileId?: string, deviceId?: string): Promise<any> {
    return this.client.cloud_sync_audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: userId,
        cloud_profile_id: cloudProfileId || null,
        action,
        device_id: deviceId || null,
        details: details || null,
        created_at: new Date().toISOString(),
      },
    });
  }

  // --- Team Workspaces ---
  async findWorkspaceById(id: string): Promise<any | null> {
    return this.client.team_workspaces.findUnique({
      where: { id },
    });
  }

  async createWorkspace(data: any): Promise<any> {
    return this.client.team_workspaces.create({
      data: {
        id: data.id,
        name: data.name,
        description: data.description || '',
        owner_user_id: data.owner_user_id || data.ownerUserId,
        status: data.status || 'ACTIVE',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      },
    });
  }

  async updateWorkspace(id: string, data: any): Promise<any> {
    return this.client.team_workspaces.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date().toISOString(),
      },
    });
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    try {
      await this.client.team_workspaces.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async listUserWorkspaces(userId: string): Promise<any[]> {
    return this.client.team_workspaces.findMany({
      where: {
        OR: [
          { owner_user_id: userId },
          { members: { some: { user_id: userId, status: 'ACTIVE' } } },
        ],
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // --- Team Workspace Members ---
  async addWorkspaceMember(data: any): Promise<any> {
    return this.client.team_workspace_members.create({
      data: {
        id: data.id,
        workspace_id: data.workspace_id || data.workspaceId,
        user_id: data.user_id || data.userId,
        role: data.role || 'MEMBER',
        status: data.status || 'ACTIVE',
        invited_by: data.invited_by || data.invited_by_user_id || data.invitedByUserId || null,
        joined_at: data.joined_at || new Date().toISOString(),
        created_at: data.created_at || new Date().toISOString(),
      },
    });
  }

  async findWorkspaceMember(workspaceId: string, userId: string): Promise<any | null> {
    return this.client.team_workspace_members.findFirst({
      where: { workspace_id: workspaceId, user_id: userId },
    });
  }

  async listWorkspaceMembers(workspaceId: string): Promise<any[]> {
    return this.client.team_workspace_members.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'asc' },
    });
  }

  async updateWorkspaceMemberRole(workspaceId: string, userId: string, role: string): Promise<any> {
    return this.client.team_workspace_members.updateMany({
      where: { workspace_id: workspaceId, user_id: userId },
      data: { role },
    });
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    try {
      await this.client.team_workspace_members.deleteMany({
        where: { workspace_id: workspaceId, user_id: userId },
      });
      return true;
    } catch {
      return false;
    }
  }

  // --- Remote API Keys ---
  async findRemoteApiKeyByHash(keyHash: string): Promise<any | null> {
    return this.client.remote_api_keys.findUnique({
      where: { key_hash: keyHash },
    });
  }

  async createRemoteApiKey(data: any): Promise<any> {
    return this.client.remote_api_keys.create({
      data: {
        id: data.id,
        user_id: data.user_id || data.userId,
        workspace_id: data.workspace_id || data.workspaceId || null,
        name: data.name,
        key_prefix: data.key_prefix || data.keyPrefix,
        key_hash: data.key_hash || data.keyHash,
        scopes_json: data.scopes_json || data.scopesJson || '["profiles:read"]',
        status: data.status || 'ACTIVE',
        rate_limit_per_min: data.rate_limit_per_min || data.rateLimitPerMin || 120,
        requests_count_month: data.requests_count_month || data.requestsCountMonth || 0,
        last_used_at: data.last_used_at || null,
        expires_at: data.expires_at || null,
        created_at: data.created_at || new Date().toISOString(),
        revoked_at: data.revoked_at || null,
      },
    });
  }

  async listRemoteApiKeys(userId: string): Promise<any[]> {
    return this.client.remote_api_keys.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async revokeRemoteApiKey(id: string, userId?: string): Promise<boolean> {
    try {
      const where: any = { id };
      if (userId) {
        where.user_id = userId;
      }
      const res = await this.client.remote_api_keys.updateMany({
        where,
        data: { status: 'REVOKED', revoked_at: new Date().toISOString() },
      });
      return res.count > 0;
    } catch {
      return false;
    }
  }

  async updateRemoteApiKeyLastUsed(id: string): Promise<any> {
    return this.client.remote_api_keys.update({
      where: { id },
      data: { last_used_at: new Date().toISOString() },
    });
  }

  // --- Remote API Key Audits ---
  async logRemoteApiKeyAudit(apiKeyId: string, userId: string, endpoint: string, method: string, statusCode: number, ipAddress?: string): Promise<any> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const action = `${method.toUpperCase()} ${endpoint}`;
    const details = JSON.stringify({ statusCode, method, endpoint });
    return this.client.remote_api_key_audits.create({
      data: {
        id,
        key_id: apiKeyId,
        user_id: userId,
        action,
        ip_address: ipAddress || null,
        details,
        created_at: now,
      },
    });
  }

  // --- Locks ---
  async findLock(cloudProfileId: string): Promise<any | null> {
    return this.client.cloud_profile_locks.findUnique({
      where: { cloud_profile_id: cloudProfileId },
    });
  }

  async upsertLock(data: { cloudProfileId: string; deviceId: string; deviceName: string; userId: string; lockedAt: string; expiresAt: string }): Promise<any> {
    return this.client.cloud_profile_locks.upsert({
      where: { cloud_profile_id: data.cloudProfileId },
      create: {
        cloud_profile_id: data.cloudProfileId,
        device_id: data.deviceId,
        device_name: data.deviceName,
        user_id: data.userId,
        locked_at: data.lockedAt,
        expires_at: data.expiresAt,
      },
      update: {
        device_id: data.deviceId,
        device_name: data.deviceName,
        user_id: data.userId,
        locked_at: data.lockedAt,
        expires_at: data.expiresAt,
      },
    });
  }

  async deleteLock(cloudProfileId: string): Promise<boolean> {
    try {
      await this.client.cloud_profile_locks.delete({
        where: { cloud_profile_id: cloudProfileId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async createWebHandoffSession(data: { code: string; token: string; userJson: string; createdAt: number; expiresAt: number }): Promise<any> {
    return this.client.web_handoff_sessions.create({
      data: {
        code: data.code,
        token: data.token,
        user_json: data.userJson,
        created_at: BigInt(data.createdAt),
        expires_at: BigInt(data.expiresAt),
        used: 0,
      },
    });
  }

  async consumeWebHandoffSessionAtomically(code: string, now: number): Promise<{ token: string; user: any } | null> {
    const updated = await this.client.$executeRaw`
      UPDATE web_handoff_sessions 
      SET used = 1 
      WHERE code = ${code} AND used = 0 AND expires_at > ${BigInt(now)}
    `;
    if (updated === 1) {
      const session = await this.client.web_handoff_sessions.findUnique({ where: { code } });
      if (session) {
        let user: any = null;
        try { user = JSON.parse(session.user_json); } catch {}
        return { token: session.token, user };
      }
    }
    return null;
  }
}

// ============================================================================
// SQLITE REPOSITORY (Local / Existing Database)
// ============================================================================

export class SqliteCentralRepository implements CentralRepository {
  public backendName: 'sqlite' = 'sqlite';

  private get db(): any {
    return getDatabase();
  }

  // --- Auth Users ---
  async findAuthUserByEmail(email: string): Promise<any | null> {
    const norm = email.toLowerCase().trim();
    const row = this.db.prepare('SELECT * FROM auth_users WHERE email = ? OR normalized_email = ?').get(email, norm);
    return row || null;
  }

  async findAuthUserById(id: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id);
    return row || null;
  }

  async createAuthUser(data: any): Promise<any> {
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

  async updateAuthUser(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return this.findAuthUserById(id);
    const sets = fields.map((f: string) => `${f} = ?`).join(', ');
    const values = fields.map((f: string) => data[f]);
    this.db.prepare(`UPDATE auth_users SET ${sets} WHERE id = ?`).run(...values, id);
    return this.findAuthUserById(id);
  }

  async updateAuthUserTerms(userId: string, acceptedTerms: number, termsVersion: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const info = this.db.prepare(
        'UPDATE auth_users SET accepted_terms = ?, terms_version = ?, updated_at = ? WHERE id = ?'
      ).run(acceptedTerms, termsVersion, now, userId);
      return info.changes > 0;
    } catch (err) {
      console.error('[SqliteCentralRepository] updateAuthUserTerms error:', err);
      return false;
    }
  }

  // --- Auth Sessions ---
  async createAuthSession(data: any): Promise<any> {
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

  async findAuthSessionByTokenHash(tokenHash: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM auth_sessions WHERE refresh_token_hash = ?').get(tokenHash);
    return row || null;
  }

  async updateAuthSession(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return null;
    const sets = fields.map((f: string) => `${f} = ?`).join(', ');
    const values = fields.map((f: string) => data[f]);
    this.db.prepare(`UPDATE auth_sessions SET ${sets} WHERE id = ?`).run(...values, id);
    return true;
  }

  async revokeAuthSession(id: string): Promise<boolean> {
    const res = this.db.prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE id = ?').run(id);
    return res.changes > 0;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    const res = this.db.prepare('UPDATE auth_sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0').run(userId);
    return res.changes;
  }

  async listUserAuthSessions(userId: string): Promise<any[]> {
    return this.db.prepare('SELECT * FROM auth_sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
  }

  // --- Verification Tokens ---
  async createVerificationToken(data: any): Promise<any> {
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

  async findVerificationTokenByHash(tokenHash: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM auth_verification_tokens WHERE token_hash = ?').get(tokenHash);
    return row || null;
  }

  async consumeVerificationToken(tokenHash: string): Promise<any | null> {
    const token = await this.findVerificationTokenByHash(tokenHash);
    if (!token || token.used_at) return null;
    const now = new Date().toISOString();
    this.db.prepare('UPDATE auth_verification_tokens SET used_at = ? WHERE token_hash = ?').run(now, tokenHash);
    return { ...token, used_at: now };
  }

  async invalidatePendingVerificationTokens(userId: string, type = 'EMAIL_VERIFICATION'): Promise<number> {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      UPDATE auth_verification_tokens SET used_at = ?
      WHERE user_id = ? AND type = ? AND used_at IS NULL
    `).run(now, userId, type);
    return res.changes;
  }

  // Convenience Aliases for Auth Flow
  async findUserByEmail(email: string): Promise<any | null> {
    return this.findAuthUserByEmail(email);
  }

  async findUserById(id: string): Promise<any | null> {
    return this.findAuthUserById(id);
  }

  async createUser(data: any): Promise<any> {
    return this.createAuthUser(data);
  }

  async updateUser(id: string, data: any): Promise<any> {
    return this.updateAuthUser(id, data);
  }

  async updateUserLastLogin(id: string, timestamp?: string): Promise<any> {
    return this.updateAuthUser(id, { last_login_at: timestamp || new Date().toISOString() });
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<any> {
    return this.updateAuthUser(id, { password_hash: passwordHash, salt });
  }

  async markUserEmailVerified(id: string): Promise<any> {
    const now = new Date().toISOString();
    return this.updateAuthUser(id, { email_verified: 1, email_verified_at: now, status: 'ACTIVE' });
  }

  async createSession(data: any): Promise<any> {
    return this.createAuthSession(data);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<any | null> {
    return this.findAuthSessionByTokenHash(tokenHash);
  }

  async rotateSessionToken(sessionId: string, newHash: string, expiresAt: string, ip?: string): Promise<any> {
    return this.updateAuthSession(sessionId, {
      refresh_token_hash: newHash,
      expires_at: expiresAt,
      last_used_at: new Date().toISOString(),
      ip_address: ip || '127.0.0.1',
    });
  }

  async findVerificationToken(tokenHash: string): Promise<any | null> {
    return this.findVerificationTokenByHash(tokenHash);
  }

  async markVerificationTokenUsed(tokenHashOrId: string): Promise<any | null> {
    return this.consumeVerificationToken(tokenHashOrId);
  }

  // --- Security Logs ---
  async logAuthSecurity(userId: string | null, action: string, details?: string, ip?: string, result = 'SUCCESS'): Promise<any> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO auth_security_logs (id, user_id, action, ip_address, details, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, action, ip || null, details || null, result, now);
    return { id, user_id: userId, action, result };
  }

  // --- Commercial Users ---
  async findCommercialUserById(id: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(id);
    return row || null;
  }

  async findCommercialUserByEmail(email: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM commercial_users WHERE email = ?').get(email);
    return row || null;
  }

  async createCommercialUser(data: any): Promise<any> {
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

  async updateCommercialUser(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return this.findCommercialUserById(id);
    const sets = fields.map((f: string) => `${f} = ?`).join(', ');
    const values = fields.map((f: string) => data[f]);
    this.db.prepare(`UPDATE commercial_users SET ${sets} WHERE id = ?`).run(...values, id);
    return this.findCommercialUserById(id);
  }

  // --- Cloud Profiles ---
  async findCloudProfileById(id: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM cloud_profiles WHERE id = ?').get(id);
    return row || null;
  }

  async createCloudProfile(data: any): Promise<any> {
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

  async updateCloudProfile(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return this.findCloudProfileById(id);
    const sets = fields.map((f: string) => `${f} = ?`).join(', ');
    const values = fields.map((f: string) => data[f]);
    this.db.prepare(`UPDATE cloud_profiles SET ${sets} WHERE id = ?`).run(...values, id);
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

  async listCloudProfiles(ownerId: string): Promise<any[]> {
    return this.db.prepare('SELECT * FROM cloud_profiles WHERE owner_id = ? ORDER BY updated_at DESC').all(ownerId) as any[];
  }

  // --- Cloud Profile Versions ---
  async createCloudProfileVersion(data: any): Promise<any> {
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

  async getLatestCloudProfileVersion(cloudProfileId: string): Promise<any | null> {
    const row = this.db.prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ?
      ORDER BY version DESC
      LIMIT 1
    `).get(cloudProfileId);
    return row || null;
  }

  async getCloudProfileVersion(cloudProfileId: string, versionNum: number): Promise<any | null> {
    const row = this.db.prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ? AND version = ?
    `).get(cloudProfileId, versionNum);
    return row || null;
  }

  // --- Upload Sessions ---
  async createUploadSessionRecord(data: any): Promise<any> {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO cloud_sync_upload_sessions (
        id, user_id, cloud_profile_id, base_version, target_version, object_key, expected_size, expected_checksum,
        encrypted_data_key, iv, auth_tag, status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.user_id || data.userId,
      data.cloud_profile_id || data.cloudProfileId,
      data.base_version ?? data.baseVersion ?? 0,
      data.target_version ?? data.targetVersion ?? 1,
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

  async findUploadSessionById(id: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM cloud_sync_upload_sessions WHERE id = ?').get(id);
    return row || null;
  }

  async updateUploadSessionRecord(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return null;
    const sets = fields.map((f: string) => `${f} = ?`).join(', ');
    const values = fields.map((f: string) => data[f]);
    this.db.prepare(`UPDATE cloud_sync_upload_sessions SET ${sets} WHERE id = ?`).run(...values, id);
    return true;
  }

  // --- Cloud Sync Audits ---
  async logCloudSyncAudit(userId: string, action: string, details?: string, cloudProfileId?: string, deviceId?: string): Promise<any> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO cloud_sync_audit_logs (id, user_id, cloud_profile_id, action, device_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, cloudProfileId || null, action, deviceId || null, details || null, now);
    return { id, user_id: userId, action };
  }

  // --- Team Workspaces ---
  async findWorkspaceById(id: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM team_workspaces WHERE id = ?').get(id);
    return row || null;
  }

  async createWorkspace(data: any): Promise<any> {
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

  async updateWorkspace(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return this.findWorkspaceById(id);
    const sets = fields.map((f: string) => `${f} = ?`).join(', ');
    const values = fields.map((f: string) => data[f]);
    this.db.prepare(`UPDATE team_workspaces SET ${sets} WHERE id = ?`).run(...values, id);
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

  async listUserWorkspaces(userId: string): Promise<any[]> {
    return this.db.prepare(`
      SELECT DISTINCT w.* FROM team_workspaces w
      LEFT JOIN team_workspace_members m ON w.id = m.workspace_id
      WHERE w.owner_user_id = ? OR (m.user_id = ? AND m.status = 'ACTIVE')
      ORDER BY w.created_at DESC
    `).all(userId, userId) as any[];
  }

  // --- Team Workspace Members ---
  async addWorkspaceMember(data: any): Promise<any> {
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

  async findWorkspaceMember(workspaceId: string, userId: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM team_workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
    return row || null;
  }

  async listWorkspaceMembers(workspaceId: string): Promise<any[]> {
    return this.db.prepare('SELECT * FROM team_workspace_members WHERE workspace_id = ? ORDER BY created_at ASC').all(workspaceId) as any[];
  }

  async updateWorkspaceMemberRole(workspaceId: string, userId: string, role: string): Promise<any> {
    this.db.prepare('UPDATE team_workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?').run(role, workspaceId, userId);
    return true;
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM team_workspace_members WHERE workspace_id = ? AND user_id = ?').run(workspaceId, userId);
    return res.changes > 0;
  }

  // --- Remote API Keys ---
  async findRemoteApiKeyByHash(keyHash: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM remote_api_keys WHERE key_hash = ?').get(keyHash);
    return row || null;
  }

  async createRemoteApiKey(data: any): Promise<any> {
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

  async listRemoteApiKeys(userId: string): Promise<any[]> {
    return this.db.prepare('SELECT * FROM remote_api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
  }

  async revokeRemoteApiKey(id: string, userId?: string): Promise<boolean> {
    const now = new Date().toISOString();
    let res;
    if (userId) {
      res = this.db.prepare('UPDATE remote_api_keys SET status = "REVOKED", revoked_at = ? WHERE id = ? AND user_id = ?').run(now, id, userId);
    } else {
      res = this.db.prepare('UPDATE remote_api_keys SET status = "REVOKED", revoked_at = ? WHERE id = ?').run(now, id);
    }
    return res.changes > 0;
  }

  async updateRemoteApiKeyLastUsed(id: string): Promise<any> {
    this.db.prepare('UPDATE remote_api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    return true;
  }

  // --- Remote API Key Audits ---
  async logRemoteApiKeyAudit(apiKeyId: string, userId: string, endpoint: string, method: string, statusCode: number, ipAddress?: string): Promise<any> {
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
  async findLock(cloudProfileId: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ?').get(cloudProfileId);
    return row || null;
  }

  async upsertLock(data: { cloudProfileId: string; deviceId: string; deviceName: string; userId: string; lockedAt: string; expiresAt: string }): Promise<any> {
    this.db.prepare(`
      INSERT OR REPLACE INTO cloud_profile_locks (cloud_profile_id, device_id, device_name, user_id, locked_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.cloudProfileId,
      data.deviceId,
      data.deviceName,
      data.userId,
      data.lockedAt,
      data.expiresAt
    );
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

  async createWebHandoffSession(data: { code: string; token: string; userJson: string; createdAt: number; expiresAt: number }): Promise<any> {
    this.db.prepare(
      'INSERT INTO web_handoff_sessions (code, token, user_json, created_at, expires_at, used) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(data.code, data.token, data.userJson, data.createdAt, data.expiresAt);
    return data;
  }

  async consumeWebHandoffSessionAtomically(code: string, now: number): Promise<{ token: string; user: any } | null> {
    const row = this.db.prepare('SELECT * FROM web_handoff_sessions WHERE code = ?').get(code) as any;
    if (!row) return null;
    if (row.used === 1 || Number(row.expires_at) <= now) {
      try { this.db.prepare('DELETE FROM web_handoff_sessions WHERE code = ?').run(code); } catch {}
      return null;
    }
    const updateRes = this.db.prepare(
      'UPDATE web_handoff_sessions SET used = 1 WHERE code = ? AND used = 0 AND expires_at > ?'
    ).run(code, now);
    if (updateRes.changes === 1) {
      let user: any = null;
      try { user = JSON.parse(row.user_json); } catch {}
      return { token: row.token, user };
    }
    return null;
  }
}

// ============================================================================
// SINGLETON REPOSITORY ACCESSOR
// ============================================================================

let testRepository: CentralRepository | null = null;

export function getCentralRepository(): CentralRepository {
  if (testRepository) {
    return testRepository;
  }
  if (isPostgresConfigured()) {
    return new PostgresCentralRepository();
  }
  return new SqliteCentralRepository();
}

export function setCentralRepositoryForTest(repo: CentralRepository | null): void {
  testRepository = repo;
}
