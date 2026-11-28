import type { Prisma, PrismaClient as PrismaClientType } from '@prisma/client';
import { getPrismaClient } from './prisma-client.js';
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

const log = createLogger('postgres-central-repository');

export class PostgresCentralRepository implements CentralRepository {
  public backendName: 'postgres' = 'postgres';

  private get client(): PrismaClientType {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('PostgresCentralRepository requires DATABASE_URL to be configured');
    }
    return prisma;
  }

  // --- Auth Users ---
  async findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const norm = email.toLowerCase().trim();
    return this.client.auth_users.findFirst({
      where: {
        OR: [{ email }, { normalized_email: norm }],
      },
    });
  }

  async findAuthUserById(id: string): Promise<AuthUserRecord | null> {
    return this.client.auth_users.findUnique({
      where: { id },
    });
  }

  async createAuthUser(data: AuthUserCreateInput): Promise<AuthUserRecord | null> {
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

  async updateAuthUser(id: string, data: AuthUserUpdateInput): Promise<AuthUserRecord | null> {
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
      log.error('[PostgresCentralRepository] updateAuthUserTerms error', {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // --- Auth Sessions ---
  async createAuthSession(data: AuthSessionCreateInput): Promise<AuthSessionRecord> {
    return this.client.auth_sessions.create({
      data: {
        id: data.id,
        user_id: data.user_id || data.userId || '',
        refresh_token_hash: data.refresh_token_hash || data.refreshTokenHash || '',
        device_id: data.device_id || data.deviceId || '',
        device_name: data.device_name || data.deviceName || 'Unknown Device',
        platform: data.platform || 'windows',
        ip_address: data.ip_address || data.ipAddress || null,
        is_revoked: data.is_revoked ? 1 : 0,
        created_at: data.created_at || new Date().toISOString(),
        last_used_at: data.last_used_at || new Date().toISOString(),
        expires_at: data.expires_at || data.expiresAt || '',
      },
    });
  }

  async findAuthSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    return this.client.auth_sessions.findUnique({
      where: { refresh_token_hash: tokenHash },
    });
  }

  async updateAuthSession(id: string, data: AuthSessionUpdateInput): Promise<AuthSessionRecord> {
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

  async listUserAuthSessions(userId: string): Promise<AuthSessionRecord[]> {
    return this.client.auth_sessions.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  // --- Verification Tokens ---
  async createVerificationToken(data: AuthVerificationTokenCreateInput): Promise<AuthVerificationTokenRecord> {
    return this.client.auth_verification_tokens.create({
      data: {
        id: data.id,
        token_hash: data.token_hash || data.tokenHash || '',
        user_id: data.user_id || data.userId || '',
        email: data.email,
        type: data.type || 'EMAIL_VERIFY',
        expires_at: data.expires_at || data.expiresAt || '',
        created_at: data.created_at || new Date().toISOString(),
        used_at: data.used_at || null,
      },
    });
  }

  async findVerificationTokenByHash(tokenHash: string): Promise<AuthVerificationTokenRecord | null> {
    return this.client.auth_verification_tokens.findUnique({
      where: { token_hash: tokenHash },
    });
  }

  async consumeVerificationToken(tokenHash: string): Promise<AuthVerificationTokenRecord | null> {
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

  async createSession(data: AuthSessionCreateInput): Promise<AuthSessionRecord> {
    return this.createAuthSession(data);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    return this.findAuthSessionByTokenHash(tokenHash);
  }

  async rotateSessionToken(sessionId: string, newHash: string, expiresAt: string, ip?: string): Promise<AuthSessionRecord> {
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
  async findCommercialUserById(id: string): Promise<CommercialUserRecord | null> {
    return this.client.commercial_users.findUnique({
      where: { id },
    });
  }

  async findCommercialUserByEmail(email: string): Promise<CommercialUserRecord | null> {
    return this.client.commercial_users.findUnique({
      where: { email },
    });
  }

  async createCommercialUser(data: CommercialUserCreateInput): Promise<CommercialUserRecord | null> {
    const now = new Date().toISOString();
    return this.client.commercial_users.create({
      data: {
        id: data.id,
        email: data.email,
        password_hash: data.password_hash || data.passwordHash || '',
        salt: data.salt,
        name: data.name || data.email.split('@')[0],
        role: data.role || 'USER',
        status: data.status || 'ACTIVE',
        plan_id: data.plan_id || data.planId || 'plan_free',
        bonus_profiles: data.bonus_profiles ?? data.bonusProfiles ?? 0,
        bonus_proxy_bytes: BigInt(data.bonus_proxy_bytes ?? data.bonusProxyBytes ?? 0),
        feature_overrides:
          typeof data.feature_overrides === 'string'
            ? data.feature_overrides
            : JSON.stringify(data.feature_overrides || {}),
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
        last_login_at: data.last_login_at || null,
      },
    });
  }

  async updateCommercialUser(id: string, data: CommercialUserUpdateInput): Promise<CommercialUserRecord | null> {
    const updateData: Prisma.commercial_usersUpdateInput = {
      ...data,
      updated_at: new Date().toISOString(),
    };
    return this.client.commercial_users.update({
      where: { id },
      data: updateData,
    });
  }

  // --- Cloud Profiles ---
  async findCloudProfileById(id: string): Promise<CloudProfileRecord | null> {
    const p = await this.client.cloud_profiles.findUnique({
      where: { id },
    });
    if (!p) return null;
    return {
      ...p,
      storage_bytes: Number(p.storage_bytes),
    };
  }

  async createCloudProfile(data: CloudProfileCreateInput): Promise<CloudProfileRecord | null> {
    const created = await this.client.cloud_profiles.create({
      data: {
        id: data.id,
        owner_id: data.owner_id || data.ownerId || '',
        local_profile_id: data.local_profile_id || data.localProfileId || '',
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

  async updateCloudProfile(id: string, data: CloudProfileUpdateInput): Promise<CloudProfileRecord | null> {
    const updateData: Prisma.cloud_profilesUpdateInput = {
      ...data,
      updated_at: new Date().toISOString(),
    };
    if (data.storage_bytes !== undefined) {
      updateData.storage_bytes = BigInt(data.storage_bytes);
    }

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

  async listCloudProfiles(ownerId: string): Promise<CloudProfileRecord[]> {
    const profiles = await this.client.cloud_profiles.findMany({
      where: { owner_id: ownerId },
      orderBy: { updated_at: 'desc' },
    });
    return profiles.map((p) => ({
      ...p,
      storage_bytes: Number(p.storage_bytes),
    }));
  }

  // --- Cloud Profile Versions ---
  async createCloudProfileVersion(data: CloudProfileVersionCreateInput): Promise<CloudProfileVersionRecord> {
    const version = await this.client.cloud_profile_versions.create({
      data: {
        id: data.id,
        cloud_profile_id: data.cloud_profile_id || data.cloudProfileId || '',
        version: data.version,
        object_key: data.object_key || data.objectKey || '',
        file_size: BigInt(data.file_size ?? data.fileSize ?? 0),
        checksum_sha256: data.checksum_sha256 || data.checksumSha256 || '',
        encrypted_data_key: data.encrypted_data_key || data.encryptedDataKey || '',
        iv: data.iv,
        auth_tag: data.auth_tag || data.authTag || '',
        source_device_id: data.source_device_id || data.sourceDeviceId || '',
        source_device_name: data.source_device_name || data.sourceDeviceName || null,
        created_at: data.created_at || new Date().toISOString(),
      },
    });
    return {
      ...version,
      file_size: Number(version.file_size),
    };
  }

  async getLatestCloudProfileVersion(cloudProfileId: string): Promise<CloudProfileVersionRecord | null> {
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

  async getCloudProfileVersion(cloudProfileId: string, versionNum: number): Promise<CloudProfileVersionRecord | null> {
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

  async createCloudProfileDelta(data: CloudProfileDeltaCreateInput): Promise<CloudProfileDeltaRecord | null> {
    const deltaClient = (this.client as Partial<PrismaClientType>).cloud_profile_deltas;
    if (!deltaClient || typeof deltaClient.create !== 'function') {
      return null;
    }
    try {
      const delta = await deltaClient.create({
        data: {
          id: data.id,
          cloud_profile_id: data.cloud_profile_id || data.cloudProfileId || '',
          base_version: data.base_version ?? data.baseVersion ?? 1,
          delta_version: data.delta_version ?? data.deltaVersion ?? 1,
          delta_type: data.delta_type || data.deltaType || 'cookies_only',
          manifest_hash: data.manifest_hash || data.manifestHash || null,
          object_key: data.object_key || data.objectKey || '',
          file_size: BigInt(data.file_size ?? data.fileSize ?? 0),
          checksum_sha256: data.checksum_sha256 || data.checksumSha256 || '',
          encrypted_data_key: data.encrypted_data_key || data.encryptedDataKey || '',
          iv: data.iv,
          auth_tag: data.auth_tag || data.authTag || '',
          source_device_id: data.source_device_id || data.sourceDeviceId || '',
          source_device_name: data.source_device_name || data.sourceDeviceName || null,
          created_at: data.created_at || new Date().toISOString(),
        },
      });
      return {
        ...delta,
        file_size: Number(delta.file_size),
      };
    } catch {
      return null;
    }
  }

  async getLatestCloudProfileDelta(cloudProfileId: string): Promise<CloudProfileDeltaRecord | null> {
    const deltaClient = (this.client as Partial<PrismaClientType>).cloud_profile_deltas;
    if (!deltaClient || typeof deltaClient.findFirst !== 'function') {
      return null;
    }
    try {
      const delta = await deltaClient.findFirst({
        where: { cloud_profile_id: cloudProfileId },
        orderBy: { delta_version: 'desc' },
      });
      if (!delta) return null;
      return {
        ...delta,
        file_size: Number(delta.file_size),
      };
    } catch {
      return null;
    }
  }

  // --- Upload Sessions ---
  async createUploadSessionRecord(data: CloudUploadSessionCreateInput): Promise<CloudUploadSessionRecord> {
    const baseData: Prisma.cloud_sync_upload_sessionsUncheckedCreateInput = {
      id: data.id,
      user_id: data.user_id || data.userId || '',
      cloud_profile_id: data.cloud_profile_id || data.cloudProfileId || '',
      base_version: data.base_version ?? data.baseVersion ?? 0,
      target_version: data.target_version ?? data.targetVersion ?? 1,
      object_key: data.object_key || data.objectKey || '',
      expected_size: BigInt(data.expected_size ?? data.expectedSize ?? 0),
      expected_checksum: data.expected_checksum || data.expectedChecksum || '',
      encrypted_data_key: data.encrypted_data_key || data.encryptedDataKey || '',
      iv: data.iv,
      auth_tag: data.auth_tag || data.authTag || '',
      status: data.status || 'PENDING',
      expires_at: data.expires_at || data.expiresAt || '',
      created_at: data.created_at || new Date().toISOString(),
    };
    try {
      return await this.client.cloud_sync_upload_sessions.create({
        data: {
          ...baseData,
          archive_format: data.archive_format || data.archiveFormat || 'full',
          manifest_hash: data.manifest_hash || data.manifestHash || null,
        },
      });
    } catch {
      return this.client.cloud_sync_upload_sessions.create({ data: baseData });
    }
  }

  async findUploadSessionById(id: string): Promise<CloudUploadSessionRecord | null> {
    const s = await this.client.cloud_sync_upload_sessions.findUnique({
      where: { id },
    });
    if (!s) return null;
    return {
      ...s,
      expected_size: Number(s.expected_size),
    };
  }

  async updateUploadSessionRecord(id: string, data: CloudUploadSessionUpdateInput): Promise<CloudUploadSessionRecord> {
    const updateData: Prisma.cloud_sync_upload_sessionsUpdateInput = { ...data };
    return this.client.cloud_sync_upload_sessions.update({
      where: { id },
      data: updateData,
    });
  }

  // --- Cloud Sync Audits ---
  async logCloudSyncAudit(
    userId: string,
    action: string,
    details?: string,
    cloudProfileId?: string,
    deviceId?: string
  ): Promise<CloudSyncAuditLogResult> {
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
  async findWorkspaceById(id: string): Promise<TeamWorkspaceRecord | null> {
    return this.client.team_workspaces.findUnique({
      where: { id },
    });
  }

  async createWorkspace(data: TeamWorkspaceCreateInput): Promise<TeamWorkspaceRecord | null> {
    return this.client.team_workspaces.create({
      data: {
        id: data.id,
        name: data.name,
        description: data.description || '',
        owner_user_id: data.owner_user_id || data.ownerUserId || '',
        status: data.status || 'ACTIVE',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      },
    });
  }

  async updateWorkspace(id: string, data: TeamWorkspaceUpdateInput): Promise<TeamWorkspaceRecord | null> {
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

  async listUserWorkspaces(userId: string): Promise<TeamWorkspaceRecord[]> {
    return this.client.team_workspaces.findMany({
      where: {
        OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId, status: 'ACTIVE' } } }],
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // --- Team Workspace Members ---
  async addWorkspaceMember(data: TeamWorkspaceMemberCreateInput): Promise<TeamWorkspaceMemberRecord> {
    return this.client.team_workspace_members.create({
      data: {
        id: data.id,
        workspace_id: data.workspace_id || data.workspaceId || '',
        user_id: data.user_id || data.userId || '',
        role: data.role || 'MEMBER',
        status: data.status || 'ACTIVE',
        invited_by: data.invited_by || data.invited_by_user_id || data.invitedByUserId || null,
        joined_at: data.joined_at || new Date().toISOString(),
        created_at: data.created_at || new Date().toISOString(),
      },
    });
  }

  async findWorkspaceMember(workspaceId: string, userId: string): Promise<TeamWorkspaceMemberRecord | null> {
    return this.client.team_workspace_members.findFirst({
      where: { workspace_id: workspaceId, user_id: userId },
    });
  }

  async listWorkspaceMembers(workspaceId: string): Promise<TeamWorkspaceMemberRecord[]> {
    return this.client.team_workspace_members.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: 'asc' },
    });
  }

  async updateWorkspaceMemberRole(workspaceId: string, userId: string, role: string): Promise<{ count: number }> {
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
  async findRemoteApiKeyByHash(keyHash: string): Promise<RemoteApiKeyRecord | null> {
    return this.client.remote_api_keys.findUnique({
      where: { key_hash: keyHash },
    });
  }

  async createRemoteApiKey(data: RemoteApiKeyCreateInput): Promise<RemoteApiKeyRecord> {
    return this.client.remote_api_keys.create({
      data: {
        id: data.id,
        user_id: data.user_id || data.userId || '',
        workspace_id: data.workspace_id || data.workspaceId || null,
        name: data.name,
        key_prefix: data.key_prefix || data.keyPrefix || '',
        key_hash: data.key_hash || data.keyHash || '',
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

  async listRemoteApiKeys(userId: string): Promise<RemoteApiKeyRecord[]> {
    return this.client.remote_api_keys.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async revokeRemoteApiKey(id: string, userId?: string): Promise<boolean> {
    try {
      const where: Prisma.remote_api_keysWhereInput = { id };
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

  async updateRemoteApiKeyLastUsed(id: string): Promise<RemoteApiKeyRecord> {
    return this.client.remote_api_keys.update({
      where: { id },
      data: { last_used_at: new Date().toISOString() },
    });
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
  async findLock(cloudProfileId: string): Promise<CloudProfileLockRecord | null> {
    return this.client.cloud_profile_locks.findUnique({
      where: { cloud_profile_id: cloudProfileId },
    });
  }

  async upsertLock(data: CloudProfileLockUpsertInput): Promise<CloudProfileLockRecord> {
    const deviceName = data.deviceName || 'Unknown Device';
    return this.client.cloud_profile_locks.upsert({
      where: { cloud_profile_id: data.cloudProfileId },
      create: {
        cloud_profile_id: data.cloudProfileId,
        device_id: data.deviceId,
        device_name: deviceName,
        user_id: data.userId,
        locked_at: data.lockedAt,
        expires_at: data.expiresAt,
      },
      update: {
        device_id: data.deviceId,
        device_name: deviceName,
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

  async createWebHandoffSession(data: WebHandoffSessionCreateInput): Promise<WebHandoffSessionRecord> {
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

  async consumeWebHandoffSessionAtomically(
    code: string,
    now: number
  ): Promise<{ token: string; user: WebHandoffUserPayload | null } | null> {
    const updated = await this.client.$executeRaw`
      UPDATE web_handoff_sessions 
      SET used = 1 
      WHERE code = ${code} AND used = 0 AND expires_at > ${BigInt(now)}
    `;
    if (updated === 1) {
      const session = await this.client.web_handoff_sessions.findUnique({ where: { code } });
      if (session) {
        let user: WebHandoffUserPayload | null = null;
        try {
          user = JSON.parse(session.user_json) as WebHandoffUserPayload;
        } catch (parseErr) {
          log.warn('Failed parsing PostgreSQL web handoff user_json', {
            err: parseErr instanceof Error ? parseErr.message : String(parseErr),
          });
        }
        return { token: session.token, user };
      }
    }
    return null;
  }
}
