import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { getStorageProvider } from '../../08_SECURITY/storage-provider.js';
import { evaluateUserEntitlements } from '../commercial/commercial-entitlement-service.js';
import { TeamRole, TeamPermission, ROLE_PERMISSIONS } from '../../10_CONFIG/shared/types/workspace.js';

/**
 * Check if a user has access to a cloud profile, either directly as owner
 * or through an active team workspace share.
 */
export function verifyUserProfileAccess(
  userId: string,
  cloudProfileId: string,
  requiredPermission: TeamPermission = 'PROFILE_VIEW'
): { profile: any; isOwner: boolean; sharedEnvelope?: string } | null {
  const db = getDatabase();

  // 1. Direct owner check
  const profile = db.prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `).get(cloudProfileId) as any;

  if (!profile) return null;

  if (profile.owner_id === userId) {
    return { profile, isOwner: true };
  }

  // 2. Team workspace share check
  // Check if profile is shared to any workspace where user is an ACTIVE member with required permission
  const share = db.prepare(`
    SELECT s.encrypted_key_envelope, s.permission_level, m.role
    FROM team_profile_shares s
    JOIN team_workspace_members m ON s.workspace_id = m.workspace_id
    JOIN team_workspaces w ON s.workspace_id = w.id
    WHERE s.cloud_profile_id = ?
      AND m.user_id = ?
      AND m.status = 'ACTIVE'
      AND w.status = 'ACTIVE'
      AND s.revoked_at IS NULL
    LIMIT 1
  `).get(cloudProfileId, userId) as any;

  if (!share) return null;

  // Check role permission in that workspace
  const role = share.role as TeamRole;
  const allowed = (ROLE_PERMISSIONS[role] || []).includes(requiredPermission);
  if (!allowed) {
    return null;
  }

  return {
    profile,
    isOwner: false,
    sharedEnvelope: share.encrypted_key_envelope,
  };
}

export interface CloudProfileRecord {
  id: string;
  owner_id: string;
  local_profile_id: string;
  name: string;
  current_version: number;
  status: string;
  storage_bytes: number;
  created_at: string;
  updated_at: string;
  latest_version?: {
    version: number;
    file_size: number;
    checksum_sha256: string;
    encrypted_data_key: string;
    iv: string;
    auth_tag: string;
    created_at: string;
  };
}

export interface CreateUploadSessionParams {
  localProfileId: string;
  profileName: string;
  baseVersion: number;
  archiveFormat?: string;
  expectedSize: number;
  expectedChecksum: string;
  encryptedDataKey: string;
  iv: string;
  authTag: string;
  deviceId: string;
  deviceName?: string;
}

export interface UploadSessionResult {
  conflict?: boolean;
  currentVersion?: number;
  message?: string;
  sessionId?: string;
  uploadUrl?: string;
  objectKey?: string;
  targetVersion?: number;
  cloudProfileId?: string;
}

const MAX_INDIVIDUAL_ARCHIVE_BYTES = 200 * 1024 * 1024; // 200 MB
const DEFAULT_MAX_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GB default

function logCloudAudit(userId: string, action: string, details?: string, cloudProfileId?: string, deviceId?: string) {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO cloud_sync_audit_logs (id, user_id, cloud_profile_id, action, device_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      cloudProfileId || null,
      action,
      deviceId || null,
      details || null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('[CloudProfileService] Failed to log audit event:', err);
  }
}

/**
 * Get cloud sync usage and quota for a user.
 */
export function getUserSyncUsage(userId: string) {
  const db = getDatabase();

  const countRow = db.prepare(`
    SELECT COUNT(*) as profile_count, COALESCE(SUM(storage_bytes), 0) as used_bytes
    FROM cloud_profiles
    WHERE owner_id = ? AND status != 'DELETED'
  `).get(userId) as { profile_count: number; used_bytes: number };

  const profileCount = countRow?.profile_count || 0;
  const usedBytes = countRow?.used_bytes || 0;

  // Resolve plan limits via entitlements
  const entitlements = evaluateUserEntitlements(userId);
  const planLimits = entitlements.plan.limits;
  const maxProfiles = planLimits.maxProfiles || 10;
  const totalBytes = DEFAULT_MAX_STORAGE_BYTES; // 1GB default quota

  return {
    profile_count: profileCount,
    max_profiles: maxProfiles,
    used_bytes: usedBytes,
    total_bytes: totalBytes,
    used_mb: parseFloat((usedBytes / (1024 * 1024)).toFixed(2)),
    total_mb: parseFloat((totalBytes / (1024 * 1024)).toFixed(2)),
    quota_percent: totalBytes > 0 ? Math.min(100, parseFloat(((usedBytes / totalBytes) * 100).toFixed(1))) : 0,
  };
}

/**
 * List all active cloud profiles for the user.
 */
export function listUserCloudProfiles(userId: string): CloudProfileRecord[] {
  const db = getDatabase();
  const profiles = db.prepare(`
    SELECT * FROM cloud_profiles
    WHERE owner_id = ? AND status != 'DELETED'
    ORDER BY updated_at DESC
  `).all(userId) as any[];

  return profiles.map(p => {
    const latestVersion = db.prepare(`
      SELECT version, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag, created_at
      FROM cloud_profile_versions
      WHERE cloud_profile_id = ?
      ORDER BY version DESC LIMIT 1
    `).get(p.id) as any;

    const sizeMb = p.storage_bytes ? parseFloat((p.storage_bytes / (1024 * 1024)).toFixed(2)) : 0;
    return {
      ...p,
      size_mb: sizeMb,
      version: p.current_version,
      latest_version: latestVersion || undefined,
    };
  });
}

/**
 * Get specific cloud profile details.
 */
export function getCloudProfile(userId: string, cloudProfileId: string): CloudProfileRecord | null {
  const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_VIEW');
  if (!access) return null;

  const db = getDatabase();
  const profile = access.profile;

  const latestVersion = db.prepare(`
    SELECT version, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag, created_at
    FROM cloud_profile_versions
    WHERE cloud_profile_id = ?
    ORDER BY version DESC LIMIT 1
  `).get(profile.id) as any;

  const sizeMb = profile.storage_bytes ? parseFloat((profile.storage_bytes / (1024 * 1024)).toFixed(2)) : 0;
  return {
    ...profile,
    size_mb: sizeMb,
    version: profile.current_version,
    latest_version: latestVersion ? {
      ...latestVersion,
      encrypted_data_key: access.sharedEnvelope || latestVersion.encrypted_data_key,
    } : undefined,
  };
}

/**
 * Create an upload session with optimistic concurrency and quota verification.
 */
export async function createUploadSession(
  userId: string,
  params: CreateUploadSessionParams
): Promise<UploadSessionResult> {
  const db = getDatabase();

  // 1. Quota Enforcement: Check archive size
  if (params.expectedSize > MAX_INDIVIDUAL_ARCHIVE_BYTES) {
    throw new Error(`Profile archive exceeds maximum 200MB limit (size: ${(params.expectedSize / (1024 * 1024)).toFixed(1)} MB)`);
  }

  // Quota Enforcement: Check user total quota
  const usage = getUserSyncUsage(userId);
  if (usage.used_bytes + params.expectedSize > usage.total_bytes) {
    throw new Error(`Cloud storage quota exceeded! Current usage: ${usage.used_mb}MB / ${usage.total_mb}MB.`);
  }

  // 2. Identify or match existing cloud profile
  let existing = db.prepare(`
    SELECT * FROM cloud_profiles
    WHERE owner_id = ? AND local_profile_id = ? AND status != 'DELETED'
  `).get(userId, params.localProfileId) as any;

  let cloudProfileId: string;
  let targetVersion: number;

  if (existing) {
    cloudProfileId = existing.id;

    // OPTIMISTIC CONCURRENCY CHECK
    // If baseVersion is specified (> 0) and doesn't match cloud profile current_version -> CONFLICT!
    if (params.baseVersion > 0 && params.baseVersion !== existing.current_version) {
      logCloudAudit(userId, 'SYNC_CONFLICT', `Conflict on profile ${existing.id}: base=${params.baseVersion}, current=${existing.current_version}`, existing.id, params.deviceId);
      return {
        conflict: true,
        currentVersion: existing.current_version,
        cloudProfileId: existing.id,
        message: `Version conflict: Cloud has version ${existing.current_version}, but upload was based on version ${params.baseVersion}.`,
      };
    }

    targetVersion = existing.current_version + 1;
  } else {
    // New cloud profile
    if (usage.profile_count >= usage.max_profiles) {
      throw new Error(`Maximum allowed cloud profiles limit reached (${usage.max_profiles} profiles). Upgrade plan to sync more.`);
    }

    cloudProfileId = crypto.randomUUID();
    targetVersion = 1;
  }

  // 3. Generate secure, opaque object key (never contains user email or plaintext profile name)
  const safeRandomId = crypto.randomBytes(16).toString('hex');
  const objectKey = `profiles/${userId}/${cloudProfileId}/${safeRandomId}_v${targetVersion}.enc`;

  // 4. Generate short-lived presigned upload URL
  const storage = getStorageProvider();
  const uploadUrl = await storage.createUploadUrl(objectKey, 'application/octet-stream', 900); // 15 mins

  // 5. Create upload session record
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO cloud_sync_upload_sessions (
      id, cloud_profile_id, user_id, target_version, base_version,
      object_key, expected_size, expected_checksum, encrypted_data_key,
      iv, auth_tag, status, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(
    sessionId,
    cloudProfileId,
    userId,
    targetVersion,
    params.baseVersion,
    objectKey,
    params.expectedSize,
    params.expectedChecksum,
    params.encryptedDataKey,
    params.iv,
    params.authTag,
    expiresAt,
    now
  );

  logCloudAudit(userId, 'UPLOAD_SESSION_CREATED', `Target version ${targetVersion}`, cloudProfileId, params.deviceId);

  return {
    conflict: false,
    sessionId,
    uploadUrl,
    objectKey,
    targetVersion,
    cloudProfileId,
  };
}

/**
 * Finalize upload session: verify that object was actually uploaded with expected size.
 * Only then activates the new version atomically.
 */
export async function finalizeUploadSession(
  userId: string,
  sessionId: string,
  profileName: string,
  localProfileId: string,
  sourceDeviceId: string,
  sourceDeviceName?: string
): Promise<{ success: boolean; cloudProfileId: string; version: number }> {
  const db = getDatabase();

  const session = db.prepare(`
    SELECT * FROM cloud_sync_upload_sessions
    WHERE id = ? AND user_id = ?
  `).get(sessionId, userId) as any;

  if (!session) {
    throw new Error('Upload session not found or unauthorized');
  }

  if (session.status !== 'PENDING') {
    throw new Error(`Upload session already processed (status: ${session.status})`);
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE cloud_sync_upload_sessions SET status = 'EXPIRED' WHERE id = ?").run(sessionId);
    throw new Error('Upload session expired. Please retry.');
  }

  // 1. Verify object existence and integrity with storage provider
  const storage = getStorageProvider();
  const head = await storage.headObject(session.object_key);
  if (!head || !head.exists) {
    throw new Error('Object not found on storage provider. Upload was not completed.');
  }

  if (head.size !== session.expected_size) {
    throw new Error(`Object size mismatch! Expected ${session.expected_size} bytes, got ${head.size} bytes.`);
  }

  // 2. Perform atomic database updates
  const now = new Date().toISOString();
  const versionId = crypto.randomUUID();

  const runUpdates = () => {
    // Check if cloud_profile exists
    const existing = db.prepare('SELECT * FROM cloud_profiles WHERE id = ?').get(session.cloud_profile_id) as any;

    if (existing) {
      db.prepare(`
        UPDATE cloud_profiles
        SET name = ?, current_version = ?, status = 'ACTIVE', storage_bytes = ?, updated_at = ?
        WHERE id = ?
      `).run(profileName, session.target_version, session.expected_size, now, session.cloud_profile_id);
    } else {
      db.prepare(`
        INSERT INTO cloud_profiles (id, owner_id, local_profile_id, name, current_version, status, storage_bytes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
      `).run(
        session.cloud_profile_id,
        userId,
        localProfileId,
        profileName,
        session.target_version,
        session.expected_size,
        now,
        now
      );
    }

    // Insert version
    db.prepare(`
      INSERT INTO cloud_profile_versions (
        id, cloud_profile_id, version, object_key, file_size, checksum_sha256,
        encrypted_data_key, iv, auth_tag, source_device_id, source_device_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      session.cloud_profile_id,
      session.target_version,
      session.object_key,
      session.expected_size,
      session.expected_checksum,
      session.encrypted_data_key,
      session.iv,
      session.auth_tag,
      sourceDeviceId,
      sourceDeviceName || 'Unknown Device',
      now
    );

    // Mark session completed
    db.prepare("UPDATE cloud_sync_upload_sessions SET status = 'COMPLETED' WHERE id = ?").run(sessionId);
  };

  if (typeof db.transaction === 'function') {
    db.transaction(runUpdates)();
  } else {
    runUpdates();
  }

  logCloudAudit(userId, 'UPLOAD_FINALIZED', `Activated version ${session.target_version}`, session.cloud_profile_id, sourceDeviceId);

  return {
    success: true,
    cloudProfileId: session.cloud_profile_id,
    version: session.target_version,
  };
}

/**
 * Request download session for a cloud profile.
 */
export async function createDownloadSession(
  userId: string,
  cloudProfileId: string,
  targetVersion?: number
) {
  const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_RUN');
  if (!access) {
    throw new Error('Cloud profile not found or access denied');
  }

  const db = getDatabase();
  const profile = access.profile;

  let verRow: any;
  if (targetVersion && targetVersion > 0) {
    verRow = db.prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ? AND version = ?
    `).get(cloudProfileId, targetVersion);
  } else {
    verRow = db.prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ?
      ORDER BY version DESC LIMIT 1
    `).get(cloudProfileId);
  }

  if (!verRow) {
    throw new Error('Requested profile version not found in storage');
  }

  const storage = getStorageProvider();
  const downloadUrl = await storage.createDownloadUrl(verRow.object_key, 900); // 15 mins

  logCloudAudit(userId, 'DOWNLOAD_REQUESTED', `Version ${verRow.version} (${access.isOwner ? 'owner' : 'team_member'})`, cloudProfileId);

  return {
    downloadUrl,
    version: verRow.version,
    checksumSha256: verRow.checksum_sha256,
    encryptedDataKey: access.sharedEnvelope || verRow.encrypted_data_key,
    iv: verRow.iv,
    authTag: verRow.auth_tag,
    fileSize: verRow.file_size,
    profileName: profile.name,
    localProfileId: profile.local_profile_id,
  };
}

/**
 * Delete a cloud profile and its storage objects.
 */
export async function deleteCloudProfile(userId: string, cloudProfileId: string): Promise<boolean> {
  const db = getDatabase();

  const profile = db.prepare(`
    SELECT * FROM cloud_profiles
    WHERE id = ? AND owner_id = ?
  `).get(cloudProfileId, userId) as any;

  if (!profile) {
    throw new Error('Profile not found or access denied');
  }

  const storage = getStorageProvider();
  const versions = db.prepare(`
    SELECT object_key FROM cloud_profile_versions WHERE cloud_profile_id = ?
  `).all(cloudProfileId) as any[];

  // Delete objects from storage provider
  for (const v of versions) {
    if (v.object_key) {
      await storage.deleteObject(v.object_key);
    }
  }

  // Delete DB records
  db.prepare('DELETE FROM cloud_profile_locks WHERE cloud_profile_id = ?').run(cloudProfileId);
  db.prepare('DELETE FROM cloud_profile_versions WHERE cloud_profile_id = ?').run(cloudProfileId);
  db.prepare('DELETE FROM cloud_profiles WHERE id = ?').run(cloudProfileId);

  logCloudAudit(userId, 'CLOUD_PROFILE_DELETED', `Deleted profile and all versions`, cloudProfileId);

  return true;
}

// ============================================================================
// DISTRIBUTED PROFILE LOCKING
// ============================================================================

export function cleanupExpiredLocks(): void {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare('DELETE FROM cloud_profile_locks WHERE expires_at < ?').run(now);
  } catch {}
}

export function acquireProfileLock(
  userId: string,
  cloudProfileId: string,
  deviceId: string,
  deviceName: string,
  ttlSeconds = 300
): { acquired: boolean; heldBy?: string; expiresAt?: string } {
  const db = getDatabase();
  const profile = db.prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `).get(cloudProfileId) as any;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_RUN');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  } else {
    // If cloud profile record does not exist yet, create placeholder record to preserve foreign key integrity
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO auth_users (id, email, normalized_email, password_hash, salt, name, created_at, updated_at)
      VALUES (?, ?, ?, 'system_placeholder', 'system_placeholder', 'System User', ?, ?)
    `).run(userId, `${userId}@local.system`, `${userId}@local.system`, nowIso, nowIso);
    db.prepare(`
      INSERT OR IGNORE INTO cloud_profiles (id, owner_id, local_profile_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cloudProfileId, userId, cloudProfileId, 'Cloud Profile', nowIso, nowIso);
  }

  cleanupExpiredLocks();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (ttlSeconds * 1000)).toISOString();

  // Check if lock already held by another device
  const existing = db.prepare(`
    SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ?
  `).get(cloudProfileId) as any;

  if (existing) {
    if (existing.device_id === deviceId) {
      // Same device re-acquiring / renewing
      db.prepare(`
        UPDATE cloud_profile_locks SET expires_at = ?, locked_at = ? WHERE cloud_profile_id = ?
      `).run(expiresAt, now.toISOString(), cloudProfileId);
      return { acquired: true, expiresAt };
    } else {
      // Held by different device
      return {
        acquired: false,
        heldBy: existing.device_name || existing.device_id,
        expiresAt: existing.expires_at,
      };
    }
  }

  // Insert new lock
  db.prepare(`
    INSERT INTO cloud_profile_locks (cloud_profile_id, device_id, device_name, user_id, locked_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(cloudProfileId, deviceId, deviceName, userId, now.toISOString(), expiresAt);

  logCloudAudit(userId, 'LOCK_ACQUIRED', `Locked by ${deviceName}`, cloudProfileId, deviceId);

  return { acquired: true, expiresAt };
}

export function renewProfileLock(
  userId: string,
  cloudProfileId: string,
  deviceId: string,
  ttlSeconds = 300
): { renewed: boolean; expiresAt?: string } {
  const db = getDatabase();
  const profile = db.prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `).get(cloudProfileId) as any;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_RUN');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  } else {
    // If cloud profile record does not exist yet, create placeholder record to preserve foreign key integrity
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO auth_users (id, email, normalized_email, password_hash, salt, name, created_at, updated_at)
      VALUES (?, ?, ?, 'system_placeholder', 'system_placeholder', 'System User', ?, ?)
    `).run(userId, `${userId}@local.system`, `${userId}@local.system`, nowIso, nowIso);
    db.prepare(`
      INSERT OR IGNORE INTO cloud_profiles (id, owner_id, local_profile_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cloudProfileId, userId, cloudProfileId, 'Cloud Profile', nowIso, nowIso);
  }

  cleanupExpiredLocks();

  const lock = db.prepare(`
    SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ? AND device_id = ?
  `).get(cloudProfileId, deviceId) as any;

  if (!lock) {
    return { renewed: false };
  }

  const expiresAt = new Date(Date.now() + (ttlSeconds * 1000)).toISOString();
  db.prepare(`
    UPDATE cloud_profile_locks SET expires_at = ? WHERE cloud_profile_id = ? AND device_id = ?
  `).run(expiresAt, cloudProfileId, deviceId);

  return { renewed: true, expiresAt };
}

export function releaseProfileLock(
  userId: string,
  cloudProfileId: string,
  deviceId: string
): { released: boolean } {
  const db = getDatabase();
  const profile = db.prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `).get(cloudProfileId) as any;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_VIEW');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  }

  const res = db.prepare(`
    DELETE FROM cloud_profile_locks WHERE cloud_profile_id = ? AND device_id = ?
  `).run(cloudProfileId, deviceId);

  if (res.changes > 0) {
    logCloudAudit(userId, 'LOCK_RELEASED', `Lock released by ${deviceId}`, cloudProfileId, deviceId);
  }

  return { released: res.changes > 0 };
}

export function getProfileLockStatus(userId: string, cloudProfileId: string) {
  const db = getDatabase();
  const profile = db.prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `).get(cloudProfileId) as any;

  if (profile) {
    const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_VIEW');
    if (!access) {
      throw new Error('Access denied: Profile not found or not shared with you');
    }
  }

  cleanupExpiredLocks();

  const lock = db.prepare(`
    SELECT * FROM cloud_profile_locks WHERE cloud_profile_id = ?
  `).get(cloudProfileId) as any;

  if (!lock) {
    return { isLocked: false };
  }

  return {
    isLocked: true,
    heldBy: lock.device_name || lock.device_id,
    deviceId: lock.device_id,
    expiresAt: lock.expires_at,
  };
}
