/**
 * MAHI Platform V2 — Unified Central Data Access Layer
 * Seamlessly switches between PostgreSQL (Prisma) for Central Cloud Gateway
 * and SQLite for offline local desktop execution and testing.
 */

import { getPrismaClient, isPostgresConfigured } from './prisma-client.js';
import { getDatabase } from './connection.js';

export interface CentralRepository {
  backendName: 'postgres' | 'sqlite';

  // Auth Users
  findAuthUserByEmail(email: string): Promise<any | null>;
  findAuthUserById(id: string): Promise<any | null>;
  createAuthUser(data: any): Promise<any>;
  updateAuthUser(id: string, data: any): Promise<any>;

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

  // Team Workspaces
  findWorkspaceById(id: string): Promise<any | null>;
  createWorkspace(data: any): Promise<any>;
  listUserWorkspaces(userId: string): Promise<any[]>;

  // Remote API Keys
  findRemoteApiKeyByHash(keyHash: string): Promise<any | null>;
  createRemoteApiKey(data: any): Promise<any>;
  listRemoteApiKeys(userId: string): Promise<any[]>;

  // Cloud Profile Locks (DB persistence fallback)
  findLock(cloudProfileId: string): Promise<any | null>;
  upsertLock(data: { cloudProfileId: string; deviceId: string; deviceName: string; userId: string; lockedAt: string; expiresAt: string }): Promise<any>;
  deleteLock(cloudProfileId: string): Promise<boolean>;
}

// ============================================================================
// POSTGRESQL REPOSITORY (Prisma)
// ============================================================================

export class PostgresCentralRepository implements CentralRepository {
  public backendName: 'postgres' = 'postgres';

  private get client() {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('PostgresCentralRepository requires DATABASE_URL to be configured');
    }
    return prisma;
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
        profile_quota: data.profile_quota || 10,
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
      },
    });
  }

  async updateAuthUser(id: string, data: any): Promise<any> {
    return this.client.auth_users.update({
      where: { id },
      data: {
        ...data,
        updated_at: data.updated_at || new Date().toISOString(),
      },
    });
  }

  // --- Cloud Profiles ---
  async findCloudProfileById(id: string): Promise<any | null> {
    const profile = await this.client.cloud_profiles.findUnique({
      where: { id },
    });
    if (!profile) return null;
    return {
      ...profile,
      storage_bytes: Number(profile.storage_bytes),
    };
  }

  async createCloudProfile(data: any): Promise<any> {
    const profile = await this.client.cloud_profiles.create({
      data: {
        id: data.id,
        owner_id: data.owner_id || data.ownerId,
        local_profile_id: data.local_profile_id || data.localProfileId,
        name: data.name,
        current_version: data.current_version || data.currentVersion || 1,
        status: data.status || 'ACTIVE',
        storage_bytes: BigInt(data.storage_bytes || data.storageBytes || 0),
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      },
    });
    return {
      ...profile,
      storage_bytes: Number(profile.storage_bytes),
    };
  }

  async updateCloudProfile(id: string, data: any): Promise<any> {
    const updateData: any = { ...data };
    if (updateData.storage_bytes !== undefined) {
      updateData.storage_bytes = BigInt(updateData.storage_bytes);
    }
    const profile = await this.client.cloud_profiles.update({
      where: { id },
      data: {
        ...updateData,
        updated_at: updateData.updated_at || new Date().toISOString(),
      },
    });
    return {
      ...profile,
      storage_bytes: Number(profile.storage_bytes),
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
    return profiles.map((p) => ({
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
        file_size: BigInt(data.file_size || data.fileSize),
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
}

// ============================================================================
// SQLITE REPOSITORY (Local / Existing Database)
// ============================================================================

export class SqliteCentralRepository implements CentralRepository {
  public backendName: 'sqlite' = 'sqlite';

  private get db() {
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
        google_sub, avatar_url, auth_provider, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.profile_quota || 10,
      data.trial_started_at || null,
      data.trial_expires_at || null,
      data.trial_used ? 1 : 0,
      data.signup_intent || null,
      data.google_sub || null,
      data.avatar_url || null,
      data.auth_provider || 'LOCAL',
      data.created_at || now,
      data.updated_at || now,
      data.last_login_at || null
    );
    return this.findAuthUserById(data.id);
  }

  async updateAuthUser(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return this.findAuthUserById(id);
    const sets = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => data[f]);
    this.db.prepare(`UPDATE auth_users SET ${sets} WHERE id = ?`).run(...values, id);
    return this.findAuthUserById(id);
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
      data.current_version || data.currentVersion || 1,
      data.status || 'ACTIVE',
      data.storage_bytes || data.storageBytes || 0,
      data.created_at || now,
      data.updated_at || now
    );
    return this.findCloudProfileById(data.id);
  }

  async updateCloudProfile(id: string, data: any): Promise<any> {
    const fields = Object.keys(data);
    if (fields.length === 0) return this.findCloudProfileById(id);
    const sets = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => data[f]);
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
      data.file_size || data.fileSize,
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

  async listUserWorkspaces(userId: string): Promise<any[]> {
    return this.db.prepare(`
      SELECT DISTINCT w.* FROM team_workspaces w
      LEFT JOIN team_workspace_members m ON w.id = m.workspace_id
      WHERE w.owner_user_id = ? OR (m.user_id = ? AND m.status = 'ACTIVE')
      ORDER BY w.created_at DESC
    `).all(userId, userId) as any[];
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
