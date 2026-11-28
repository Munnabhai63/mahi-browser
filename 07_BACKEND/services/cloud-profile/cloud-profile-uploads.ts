import crypto from 'node:crypto';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { getStorageProvider } from '../../../08_SECURITY/storage-provider.js';
import {
  isPostgresConfigured,
  getCentralRepository,
  type CloudProfileRecord as RepoCloudProfileRecord,
  type CloudUploadSessionRecord,
} from '../../../06_DATABASE/central-repository.js';
import {
  type CreateUploadSessionParams,
  type UploadSessionResult,
  MAX_INDIVIDUAL_ARCHIVE_BYTES,
  saveDeltaPointerObject,
  loadDeltaPointerObject,
  logCloudAudit,
  logCloudAuditAsync,
} from './cloud-profile-shared.js';
import { getUserSyncUsage, getUserSyncUsageAsync } from './cloud-profile-access.js';

/**
 * Create an upload session with optimistic concurrency and quota verification.
 */
export async function createUploadSession(
  userId: string,
  params: CreateUploadSessionParams
): Promise<UploadSessionResult> {
  const syncMode: 'full' | 'cookies_only' =
    params.mode === 'cookies_only' || params.archiveFormat === 'cookies_only' ? 'cookies_only' : 'full';

  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    if (params.expectedSize > MAX_INDIVIDUAL_ARCHIVE_BYTES) {
      throw new Error(
        `Profile archive exceeds maximum 200MB limit (size: ${(params.expectedSize / (1024 * 1024)).toFixed(1)} MB)`
      );
    }

    const usage = await getUserSyncUsageAsync(userId);
    if (usage.used_bytes + params.expectedSize > usage.total_bytes) {
      throw new Error(`Cloud storage quota exceeded! Current usage: ${usage.used_mb}MB / ${usage.total_mb}MB.`);
    }

    const profiles = await repo.listCloudProfiles(userId);
    const existing = profiles.find((p) => p.local_profile_id === params.localProfileId && p.status !== 'DELETED');

    if (syncMode === 'cookies_only' && !existing) {
      return {
        conflict: false,
        fallbackToFull: true,
        syncMode: 'cookies_only',
        message: 'No base snapshot exists yet; full tarball sync required.',
      };
    }

    let cloudProfileId: string;
    let targetVersion: number;

    if (existing) {
      cloudProfileId = existing.id;
      if (params.baseVersion > 0 && params.baseVersion !== existing.current_version) {
        await logCloudAuditAsync(
          userId,
          'SYNC_CONFLICT',
          `Conflict on profile ${existing.id}: base=${params.baseVersion}, current=${existing.current_version}`,
          existing.id,
          params.deviceId
        );
        return {
          conflict: true,
          currentVersion: existing.current_version,
          cloudProfileId: existing.id,
          message: `Version conflict: Cloud has version ${existing.current_version}, but upload was based on version ${params.baseVersion}.`,
        };
      }
      targetVersion = syncMode === 'cookies_only' ? existing.current_version : existing.current_version + 1;
    } else {
      if (usage.profile_count >= usage.max_profiles) {
        throw new Error(
          `Maximum allowed cloud profiles limit reached (${usage.max_profiles} profiles). Upgrade plan to sync more.`
        );
      }
      cloudProfileId = crypto.randomUUID();
      targetVersion = 1;
    }

    const safeRandomId = crypto.randomBytes(16).toString('hex');
    const objectKey =
      syncMode === 'cookies_only'
        ? `profiles/${userId}/${cloudProfileId}/deltas/${safeRandomId}_b${targetVersion}.enc`
        : `profiles/${userId}/${cloudProfileId}/${safeRandomId}_v${targetVersion}.enc`;

    const storage = getStorageProvider();
    const uploadUrl = await storage.createUploadUrl(objectKey, 'application/octet-stream', 900);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await repo.createUploadSessionRecord({
      id: sessionId,
      cloud_profile_id: cloudProfileId,
      user_id: userId,
      target_version: targetVersion,
      base_version: params.baseVersion,
      archive_format: syncMode,
      manifest_hash: params.manifestHash || null,
      object_key: objectKey,
      expected_size: params.expectedSize,
      expected_checksum: params.expectedChecksum,
      encrypted_data_key: params.encryptedDataKey,
      iv: params.iv,
      auth_tag: params.authTag,
      source_device_id: params.deviceId,
      source_device_name: params.deviceName || 'Unknown Device',
      status: 'PENDING',
      expires_at: expiresAt,
      created_at: now,
    });

    await logCloudAuditAsync(
      userId,
      syncMode === 'cookies_only' ? 'DELTA_UPLOAD_SESSION_CREATED' : 'UPLOAD_SESSION_CREATED',
      syncMode === 'cookies_only' ? `Cookie delta for base v${targetVersion}` : `Target version ${targetVersion}`,
      cloudProfileId,
      params.deviceId
    );

    return {
      conflict: false,
      syncMode,
      sessionId,
      uploadUrl,
      objectKey,
      targetVersion,
      cloudProfileId,
    };
  }

  const db = getDatabase();

  // 1. Quota Enforcement: Check archive size
  if (params.expectedSize > MAX_INDIVIDUAL_ARCHIVE_BYTES) {
    throw new Error(
      `Profile archive exceeds maximum 200MB limit (size: ${(params.expectedSize / (1024 * 1024)).toFixed(1)} MB)`
    );
  }

  // Quota Enforcement: Check user total quota
  const usage = getUserSyncUsage(userId);
  if (usage.used_bytes + params.expectedSize > usage.total_bytes) {
    throw new Error(`Cloud storage quota exceeded! Current usage: ${usage.used_mb}MB / ${usage.total_mb}MB.`);
  }

  // 2. Identify or match existing cloud profile
  const existing = db
    .prepare(`
    SELECT * FROM cloud_profiles
    WHERE owner_id = ? AND local_profile_id = ? AND status != 'DELETED'
  `)
    .get(userId, params.localProfileId) as unknown as RepoCloudProfileRecord | undefined;

  if (syncMode === 'cookies_only' && !existing) {
    return {
      conflict: false,
      fallbackToFull: true,
      syncMode: 'cookies_only',
      message: 'No base snapshot exists yet; full tarball sync required.',
    };
  }

  let cloudProfileId: string;
  let targetVersion: number;

  if (existing) {
    cloudProfileId = existing.id;

    // OPTIMISTIC CONCURRENCY CHECK
    // If baseVersion is specified (> 0) and doesn't match cloud profile current_version -> CONFLICT!
    if (params.baseVersion > 0 && params.baseVersion !== existing.current_version) {
      logCloudAudit(
        userId,
        'SYNC_CONFLICT',
        `Conflict on profile ${existing.id}: base=${params.baseVersion}, current=${existing.current_version}`,
        existing.id,
        params.deviceId
      );
      return {
        conflict: true,
        currentVersion: existing.current_version,
        cloudProfileId: existing.id,
        message: `Version conflict: Cloud has version ${existing.current_version}, but upload was based on version ${params.baseVersion}.`,
      };
    }

    targetVersion = syncMode === 'cookies_only' ? existing.current_version : existing.current_version + 1;
  } else {
    // New cloud profile
    if (usage.profile_count >= usage.max_profiles) {
      throw new Error(
        `Maximum allowed cloud profiles limit reached (${usage.max_profiles} profiles). Upgrade plan to sync more.`
      );
    }

    cloudProfileId = crypto.randomUUID();
    targetVersion = 1;
  }

  // 3. Generate secure, opaque object key (never contains user email or plaintext profile name)
  const safeRandomId = crypto.randomBytes(16).toString('hex');
  const objectKey =
    syncMode === 'cookies_only'
      ? `profiles/${userId}/${cloudProfileId}/deltas/${safeRandomId}_b${targetVersion}.enc`
      : `profiles/${userId}/${cloudProfileId}/${safeRandomId}_v${targetVersion}.enc`;

  // 4. Generate short-lived presigned upload URL
  const storage = getStorageProvider();
  const uploadUrl = await storage.createUploadUrl(objectKey, 'application/octet-stream', 900); // 15 mins

  // 5. Create upload session record
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO cloud_sync_upload_sessions (
      id, cloud_profile_id, user_id, target_version, base_version, archive_format, manifest_hash,
      object_key, expected_size, expected_checksum, encrypted_data_key,
      iv, auth_tag, status, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(
    sessionId,
    cloudProfileId,
    userId,
    targetVersion,
    params.baseVersion,
    syncMode,
    params.manifestHash || null,
    objectKey,
    params.expectedSize,
    params.expectedChecksum,
    params.encryptedDataKey,
    params.iv,
    params.authTag,
    expiresAt,
    now
  );

  logCloudAudit(
    userId,
    syncMode === 'cookies_only' ? 'DELTA_UPLOAD_SESSION_CREATED' : 'UPLOAD_SESSION_CREATED',
    syncMode === 'cookies_only' ? `Cookie delta for base v${targetVersion}` : `Target version ${targetVersion}`,
    cloudProfileId,
    params.deviceId
  );

  return {
    conflict: false,
    syncMode,
    sessionId,
    uploadUrl,
    objectKey,
    targetVersion,
    cloudProfileId,
  };
}

/**
 * Finalize upload session: verify that object was actually uploaded with expected size.
 * Only then activates the new version (or cookie-only delta) atomically.
 */
export async function finalizeUploadSession(
  userId: string,
  sessionId: string,
  profileName: string,
  localProfileId: string,
  sourceDeviceId: string,
  sourceDeviceName?: string
): Promise<{
  success: boolean;
  cloudProfileId: string;
  version: number;
  deltaVersion?: number;
  syncMode?: 'full' | 'cookies_only';
}> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const session = await repo.findUploadSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      throw new Error('Upload session not found or unauthorized');
    }
    if (session.status !== 'PENDING') {
      throw new Error(`Upload session already processed (status: ${session.status})`);
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await repo.updateUploadSessionRecord(sessionId, { status: 'EXPIRED' });
      throw new Error('Upload session expired. Please retry.');
    }

    const storage = getStorageProvider();
    const head = await storage.headObject(session.object_key);
    if (!head?.exists) {
      throw new Error('Object not found on storage provider. Upload was not completed.');
    }
    if (head.size !== session.expected_size) {
      throw new Error(`Object size mismatch! Expected ${session.expected_size} bytes, got ${head.size} bytes.`);
    }

    const now = new Date().toISOString();
    const existing = await repo.findCloudProfileById(session.cloud_profile_id);
    const isCookiesDelta =
      session.archive_format === 'cookies_only' ||
      (typeof session.object_key === 'string' && session.object_key.includes('/deltas/'));

    if (isCookiesDelta) {
      if (!existing) {
        throw new Error('Base cloud profile snapshot not found for cookie-only delta');
      }
      const prevDelta =
        (typeof repo.getLatestCloudProfileDelta === 'function'
          ? await repo.getLatestCloudProfileDelta(session.cloud_profile_id)
          : null) || (await loadDeltaPointerObject(userId, session.cloud_profile_id));
      const deltaVersion = (prevDelta?.delta_version || 0) + 1;
      const baseVersion = existing.current_version;

      if (typeof repo.createCloudProfileDelta === 'function') {
        await repo.createCloudProfileDelta({
          id: crypto.randomUUID(),
          cloud_profile_id: session.cloud_profile_id,
          base_version: baseVersion,
          delta_version: deltaVersion,
          delta_type: 'cookies_only',
          manifest_hash: session.manifest_hash || null,
          object_key: session.object_key,
          file_size: session.expected_size,
          checksum_sha256: session.expected_checksum,
          encrypted_data_key: session.encrypted_data_key,
          iv: session.iv,
          auth_tag: session.auth_tag,
          source_device_id: sourceDeviceId,
          source_device_name: sourceDeviceName || 'Unknown Device',
          created_at: now,
        });
      }

      await saveDeltaPointerObject(userId, session.cloud_profile_id, {
        deltaVersion,
        baseVersion,
        objectKey: session.object_key,
        fileSize: session.expected_size,
        checksumSha256: session.expected_checksum,
        encryptedDataKey: session.encrypted_data_key,
        iv: session.iv,
        authTag: session.auth_tag,
        manifestHash: session.manifest_hash || null,
        sourceDeviceId,
        sourceDeviceName: sourceDeviceName || 'Unknown Device',
        createdAt: now,
      });

      await repo.updateCloudProfile(session.cloud_profile_id, {
        name: profileName,
      });
      await repo.updateUploadSessionRecord(sessionId, { status: 'COMPLETED' });
      await logCloudAuditAsync(
        userId,
        'DELTA_UPLOAD_FINALIZED',
        `Activated cookie delta d${deltaVersion} on base v${baseVersion}`,
        session.cloud_profile_id,
        sourceDeviceId
      );

      return {
        success: true,
        cloudProfileId: session.cloud_profile_id,
        version: baseVersion,
        deltaVersion,
        syncMode: 'cookies_only',
      };
    }

    const versionId = crypto.randomUUID();
    if (existing) {
      await repo.updateCloudProfile(session.cloud_profile_id, {
        name: profileName,
        current_version: session.target_version,
        status: 'ACTIVE',
        storage_bytes: session.expected_size,
      });
    } else {
      await repo.createCloudProfile({
        id: session.cloud_profile_id,
        owner_id: userId,
        local_profile_id: localProfileId,
        name: profileName,
        current_version: session.target_version,
        status: 'ACTIVE',
        storage_bytes: session.expected_size,
      });
    }

    await repo.createCloudProfileVersion({
      id: versionId,
      cloud_profile_id: session.cloud_profile_id,
      version: session.target_version,
      object_key: session.object_key,
      file_size: session.expected_size,
      checksum_sha256: session.expected_checksum,
      encrypted_data_key: session.encrypted_data_key,
      iv: session.iv,
      auth_tag: session.auth_tag,
      source_device_id: sourceDeviceId,
      source_device_name: sourceDeviceName || 'Unknown Device',
    });

    await repo.updateUploadSessionRecord(sessionId, { status: 'COMPLETED' });
    await logCloudAuditAsync(
      userId,
      'UPLOAD_FINALIZED',
      `Activated version ${session.target_version}`,
      session.cloud_profile_id,
      sourceDeviceId
    );

    return {
      success: true,
      cloudProfileId: session.cloud_profile_id,
      version: session.target_version,
      syncMode: 'full',
    };
  }

  const db = getDatabase();

  const session = db
    .prepare(`
    SELECT * FROM cloud_sync_upload_sessions
    WHERE id = ? AND user_id = ?
  `)
    .get(sessionId, userId) as unknown as CloudUploadSessionRecord | undefined;

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
  if (!head?.exists) {
    throw new Error('Object not found on storage provider. Upload was not completed.');
  }

  if (head.size !== session.expected_size) {
    throw new Error(`Object size mismatch! Expected ${session.expected_size} bytes, got ${head.size} bytes.`);
  }

  const now = new Date().toISOString();
  const isCookiesDelta =
    session.archive_format === 'cookies_only' ||
    (typeof session.object_key === 'string' && session.object_key.includes('/deltas/'));

  if (isCookiesDelta) {
    const existing = db
      .prepare('SELECT * FROM cloud_profiles WHERE id = ?')
      .get(session.cloud_profile_id) as unknown as RepoCloudProfileRecord | undefined;
    if (!existing) {
      throw new Error('Base cloud profile snapshot not found for cookie-only delta');
    }

    const prevDeltaRow = db
      .prepare('SELECT MAX(delta_version) as max_ver FROM cloud_profile_deltas WHERE cloud_profile_id = ?')
      .get(session.cloud_profile_id) as { max_ver?: number } | undefined;
    const deltaVersion = (prevDeltaRow?.max_ver || 0) + 1;
    const baseVersion = existing.current_version;
    const deltaId = crypto.randomUUID();

    const runDeltaUpdates = () => {
      db.prepare(`
        UPDATE cloud_profiles
        SET name = ?, updated_at = ?
        WHERE id = ?
      `).run(profileName, now, session.cloud_profile_id);

      db.prepare(`
        INSERT INTO cloud_profile_deltas (
          id, cloud_profile_id, base_version, delta_version, delta_type, manifest_hash,
          object_key, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag,
          source_device_id, source_device_name, created_at
        ) VALUES (?, ?, ?, ?, 'cookies_only', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deltaId,
        session.cloud_profile_id,
        baseVersion,
        deltaVersion,
        session.manifest_hash || null,
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

      db.prepare("UPDATE cloud_sync_upload_sessions SET status = 'COMPLETED' WHERE id = ?").run(sessionId);
    };

    if (typeof db.transaction === 'function') {
      db.transaction(runDeltaUpdates)();
    } else {
      runDeltaUpdates();
    }

    await saveDeltaPointerObject(userId, session.cloud_profile_id, {
      deltaVersion,
      baseVersion,
      objectKey: session.object_key,
      fileSize: Number(session.expected_size),
      checksumSha256: session.expected_checksum,
      encryptedDataKey: session.encrypted_data_key,
      iv: session.iv,
      authTag: session.auth_tag,
      manifestHash: session.manifest_hash || null,
      sourceDeviceId,
      sourceDeviceName: sourceDeviceName || 'Unknown Device',
      createdAt: now,
    });

    logCloudAudit(
      userId,
      'DELTA_UPLOAD_FINALIZED',
      `Activated cookie delta d${deltaVersion} on base v${baseVersion}`,
      session.cloud_profile_id,
      sourceDeviceId
    );

    return {
      success: true,
      cloudProfileId: session.cloud_profile_id,
      version: baseVersion,
      deltaVersion,
      syncMode: 'cookies_only',
    };
  }

  // 2. Perform atomic database updates for full tarball snapshot
  const versionId = crypto.randomUUID();

  const runUpdates = () => {
    // Check if cloud_profile exists
    const existing = db
      .prepare('SELECT * FROM cloud_profiles WHERE id = ?')
      .get(session.cloud_profile_id) as unknown as RepoCloudProfileRecord | undefined;

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

  logCloudAudit(
    userId,
    'UPLOAD_FINALIZED',
    `Activated version ${session.target_version}`,
    session.cloud_profile_id,
    sourceDeviceId
  );

  return {
    success: true,
    cloudProfileId: session.cloud_profile_id,
    version: session.target_version,
    syncMode: 'full',
  };
}
