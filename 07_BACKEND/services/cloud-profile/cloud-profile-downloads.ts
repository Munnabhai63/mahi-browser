import { getDatabase } from '../../../06_DATABASE/connection.js';
import { getStorageProvider } from '../../../08_SECURITY/storage-provider.js';
import {
  isPostgresConfigured,
  getCentralRepository,
  type CloudProfileRecord as RepoCloudProfileRecord,
  type CloudProfileVersionRecord,
} from '../../../06_DATABASE/central-repository.js';
import {
  log,
  type SqliteObjectKeyRow,
  type CookieDeltaSummary,
  type CloudProfileDeltaView,
  getPgDelegateClient,
  errMsg,
  getCookieDeltaPointerKey,
  loadDeltaPointerObject,
  logCloudAudit,
  logCloudAuditAsync,
} from './cloud-profile-shared.js';
import { verifyUserProfileAccess, verifyUserProfileAccessAsync } from './cloud-profile-access.js';

/**
 * Request download session for a cloud profile (full tarball or cookie-only delta).
 */
export async function createDownloadSession(
  userId: string,
  cloudProfileId: string,
  targetVersion?: number,
  options?: { mode?: 'full' | 'cookies_only' }
) {
  const requestedMode: 'full' | 'cookies_only' = options?.mode === 'cookies_only' ? 'cookies_only' : 'full';

  if (isPostgresConfigured()) {
    const access = await verifyUserProfileAccessAsync(userId, cloudProfileId, 'PROFILE_RUN');
    if (!access) {
      throw new Error('Cloud profile not found or access denied');
    }
    const repo = getCentralRepository();
    const profile = access.profile;
    const storage = getStorageProvider();

    const latestDelta =
      (typeof repo.getLatestCloudProfileDelta === 'function'
        ? await repo.getLatestCloudProfileDelta(cloudProfileId)
        : null) || (await loadDeltaPointerObject(profile.owner_id, cloudProfileId));

    if (requestedMode === 'cookies_only' && latestDelta) {
      const deltaDownloadUrl = await storage.createDownloadUrl(latestDelta.object_key, 900);
      await logCloudAuditAsync(
        userId,
        'DELTA_DOWNLOAD_REQUESTED',
        `Cookie delta d${latestDelta.delta_version} (base v${latestDelta.base_version})`,
        cloudProfileId
      );
      return {
        downloadUrl: deltaDownloadUrl,
        version: latestDelta.base_version,
        deltaVersion: latestDelta.delta_version,
        syncMode: 'cookies_only' as const,
        checksumSha256: latestDelta.checksum_sha256,
        encryptedDataKey: latestDelta.encrypted_data_key,
        iv: latestDelta.iv,
        authTag: latestDelta.auth_tag,
        fileSize: latestDelta.file_size,
        manifestHash: latestDelta.manifest_hash || undefined,
        profileName: profile.name,
        localProfileId: profile.local_profile_id,
      };
    }

    let verRow: CloudProfileVersionRecord | null;
    if (targetVersion && targetVersion > 0) {
      verRow = await repo.getCloudProfileVersion(cloudProfileId, targetVersion);
    } else {
      verRow = await repo.getLatestCloudProfileVersion(cloudProfileId);
    }

    if (!verRow) {
      throw new Error('Requested profile version not found in storage');
    }

    const downloadUrl = await storage.createDownloadUrl(verRow.object_key, 900);
    let cookieDelta: CookieDeltaSummary | undefined;
    if ((!targetVersion || targetVersion <= 0) && latestDelta && latestDelta.base_version >= verRow.version) {
      const deltaDownloadUrl = await storage.createDownloadUrl(latestDelta.object_key, 900);
      cookieDelta = {
        downloadUrl: deltaDownloadUrl,
        version: latestDelta.base_version,
        deltaVersion: latestDelta.delta_version,
        checksumSha256: latestDelta.checksum_sha256,
        encryptedDataKey: latestDelta.encrypted_data_key,
        iv: latestDelta.iv,
        authTag: latestDelta.auth_tag,
        fileSize: latestDelta.file_size,
        manifestHash: latestDelta.manifest_hash || undefined,
      };
    }

    await logCloudAuditAsync(
      userId,
      'DOWNLOAD_REQUESTED',
      `Version ${verRow.version} (${access.isOwner ? 'owner' : 'team_member'})`,
      cloudProfileId
    );

    return {
      downloadUrl,
      version: verRow.version,
      syncMode: 'full' as const,
      ...(requestedMode === 'cookies_only' ? { fallbackToFull: true } : {}),
      checksumSha256: verRow.checksum_sha256,
      encryptedDataKey: access.sharedEnvelope || verRow.encrypted_data_key,
      iv: verRow.iv,
      authTag: verRow.auth_tag,
      fileSize: verRow.file_size,
      profileName: profile.name,
      localProfileId: profile.local_profile_id,
      ...(cookieDelta ? { cookieDelta } : {}),
    };
  }

  const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_RUN');
  if (!access) {
    throw new Error('Cloud profile not found or access denied');
  }

  const db = getDatabase();
  const profile = access.profile;
  const storage = getStorageProvider();

  let latestDelta: CloudProfileDeltaView | null = null;
  try {
    latestDelta =
      (db
        .prepare(`
      SELECT * FROM cloud_profile_deltas
      WHERE cloud_profile_id = ?
      ORDER BY delta_version DESC LIMIT 1
    `)
        .get(cloudProfileId) as unknown as CloudProfileDeltaView | undefined) ?? null;
  } catch (err) {
    log.debug('SQLite cloud_profile_deltas query skipped; checking storage pointer', {
      cloudProfileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  if (!latestDelta) {
    latestDelta = await loadDeltaPointerObject(profile.owner_id, cloudProfileId);
  }

  if (requestedMode === 'cookies_only' && latestDelta) {
    const deltaDownloadUrl = await storage.createDownloadUrl(latestDelta.object_key, 900);
    logCloudAudit(
      userId,
      'DELTA_DOWNLOAD_REQUESTED',
      `Cookie delta d${latestDelta.delta_version} (base v${latestDelta.base_version})`,
      cloudProfileId
    );
    return {
      downloadUrl: deltaDownloadUrl,
      version: latestDelta.base_version,
      deltaVersion: latestDelta.delta_version,
      syncMode: 'cookies_only' as const,
      checksumSha256: latestDelta.checksum_sha256,
      encryptedDataKey: latestDelta.encrypted_data_key,
      iv: latestDelta.iv,
      authTag: latestDelta.auth_tag,
      fileSize: latestDelta.file_size,
      manifestHash: latestDelta.manifest_hash || undefined,
      profileName: profile.name,
      localProfileId: profile.local_profile_id,
    };
  }

  let verRow: CloudProfileVersionRecord | undefined;
  if (targetVersion && targetVersion > 0) {
    verRow = db
      .prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ? AND version = ?
    `)
      .get(cloudProfileId, targetVersion) as unknown as CloudProfileVersionRecord | undefined;
  } else {
    verRow = db
      .prepare(`
      SELECT * FROM cloud_profile_versions
      WHERE cloud_profile_id = ?
      ORDER BY version DESC LIMIT 1
    `)
      .get(cloudProfileId) as unknown as CloudProfileVersionRecord | undefined;
  }

  if (!verRow) {
    throw new Error('Requested profile version not found in storage');
  }

  const downloadUrl = await storage.createDownloadUrl(verRow.object_key, 900); // 15 mins

  let cookieDelta: CookieDeltaSummary | undefined;
  if ((!targetVersion || targetVersion <= 0) && latestDelta && latestDelta.base_version >= verRow.version) {
    const deltaDownloadUrl = await storage.createDownloadUrl(latestDelta.object_key, 900);
    cookieDelta = {
      downloadUrl: deltaDownloadUrl,
      version: latestDelta.base_version,
      deltaVersion: latestDelta.delta_version,
      checksumSha256: latestDelta.checksum_sha256,
      encryptedDataKey: latestDelta.encrypted_data_key,
      iv: latestDelta.iv,
      authTag: latestDelta.auth_tag,
      fileSize: latestDelta.file_size,
      manifestHash: latestDelta.manifest_hash || undefined,
    };
  }

  logCloudAudit(
    userId,
    'DOWNLOAD_REQUESTED',
    `Version ${verRow.version} (${access.isOwner ? 'owner' : 'team_member'})`,
    cloudProfileId
  );

  return {
    downloadUrl,
    version: verRow.version,
    syncMode: 'full' as const,
    ...(requestedMode === 'cookies_only' ? { fallbackToFull: true } : {}),
    checksumSha256: verRow.checksum_sha256,
    encryptedDataKey: access.sharedEnvelope || verRow.encrypted_data_key,
    iv: verRow.iv,
    authTag: verRow.auth_tag,
    fileSize: verRow.file_size,
    profileName: profile.name,
    localProfileId: profile.local_profile_id,
    ...(cookieDelta ? { cookieDelta } : {}),
  };
}

/**
 * Delete a cloud profile and its storage objects.
 */
export async function deleteCloudProfile(userId: string, cloudProfileId: string): Promise<boolean> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const profile = await repo.findCloudProfileById(cloudProfileId);
    if (!profile || profile.owner_id !== userId) {
      throw new Error('Profile not found or access denied');
    }
    const storage = getStorageProvider();
    try {
      const prismaClient = getPgDelegateClient(repo);
      const versions = await prismaClient?.cloud_profile_versions?.findMany({
        where: { cloud_profile_id: cloudProfileId },
        select: { object_key: true },
      });
      if (versions) {
        for (const v of versions) {
          if (v.object_key) {
            await storage.deleteObject(v.object_key).catch((delErr) => {
              log.debug('Cloud profile version object delete skipped on cleanup', {
                objectKey: v.object_key,
                err: errMsg(delErr),
              });
            });
          }
        }
      }
      const deltas = await prismaClient?.cloud_profile_deltas?.findMany({
        where: { cloud_profile_id: cloudProfileId },
        select: { object_key: true },
      });
      if (deltas) {
        for (const d of deltas) {
          if (d.object_key) {
            await storage.deleteObject(d.object_key).catch((delErr) => {
              log.debug('Cloud profile delta object delete skipped on cleanup', {
                objectKey: d.object_key,
                err: delErr instanceof Error ? delErr.message : String(delErr),
              });
            });
          }
        }
      }
      await storage.deleteObject(getCookieDeltaPointerKey(userId, cloudProfileId)).catch((delErr) => {
        log.debug('Cloud cookie delta pointer delete skipped on cleanup', {
          cloudProfileId,
          err: delErr instanceof Error ? delErr.message : String(delErr),
        });
      });
    } catch (storageErr) {
      log.warn('Partial storage object cleanup error while deleting cloud profile', {
        cloudProfileId,
        err: storageErr instanceof Error ? storageErr.message : String(storageErr),
      });
    }
    await repo.deleteLock(cloudProfileId);
    await repo.deleteCloudProfile(cloudProfileId);
    await logCloudAuditAsync(userId, 'CLOUD_PROFILE_DELETED', `Deleted profile and all versions`, cloudProfileId);
    return true;
  }

  const db = getDatabase();

  const profile = db
    .prepare(`
    SELECT * FROM cloud_profiles
    WHERE id = ? AND owner_id = ?
  `)
    .get(cloudProfileId, userId) as unknown as RepoCloudProfileRecord | undefined;

  if (!profile) {
    throw new Error('Profile not found or access denied');
  }

  const storage = getStorageProvider();
  const versions = db
    .prepare(`
    SELECT object_key FROM cloud_profile_versions WHERE cloud_profile_id = ?
  `)
    .all(cloudProfileId) as unknown as SqliteObjectKeyRow[];

  // Delete objects from storage provider
  for (const v of versions) {
    if (v.object_key) {
      await storage.deleteObject(v.object_key);
    }
  }

  try {
    const deltas = db
      .prepare(`
      SELECT object_key FROM cloud_profile_deltas WHERE cloud_profile_id = ?
    `)
      .all(cloudProfileId) as unknown as SqliteObjectKeyRow[];
    for (const d of deltas) {
      if (d.object_key) {
        await storage.deleteObject(d.object_key).catch((delErr) => {
          log.debug('SQLite cloud delta object delete skipped on cleanup', {
            objectKey: d.object_key,
            err: delErr instanceof Error ? delErr.message : String(delErr),
          });
        });
      }
    }
    await storage.deleteObject(getCookieDeltaPointerKey(userId, cloudProfileId)).catch((delErr) => {
      log.debug('SQLite cloud cookie delta pointer delete skipped on cleanup', {
        cloudProfileId,
        err: delErr instanceof Error ? delErr.message : String(delErr),
      });
    });
  } catch (storageErr) {
    log.debug('SQLite cloud delta cleanup skipped', {
      cloudProfileId,
      err: storageErr instanceof Error ? storageErr.message : String(storageErr),
    });
  }

  // Delete DB records
  db.prepare('DELETE FROM cloud_profile_locks WHERE cloud_profile_id = ?').run(cloudProfileId);
  try {
    db.prepare('DELETE FROM cloud_profile_deltas WHERE cloud_profile_id = ?').run(cloudProfileId);
  } catch (deltaDbErr) {
    log.debug('cloud_profile_deltas DB cleanup skipped', {
      cloudProfileId,
      err: deltaDbErr instanceof Error ? deltaDbErr.message : String(deltaDbErr),
    });
  }
  db.prepare('DELETE FROM cloud_profile_versions WHERE cloud_profile_id = ?').run(cloudProfileId);
  db.prepare('DELETE FROM cloud_profiles WHERE id = ?').run(cloudProfileId);

  logCloudAudit(userId, 'CLOUD_PROFILE_DELETED', `Deleted profile and all versions`, cloudProfileId);

  return true;
}
