import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertCanCreateProfile } from '../freemium-guard.js';
import { getProfileById, getProfileStoragePath } from '../../02_BROWSER/services/profile-service.js';
import type { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { importProfileFromArchive, unpackProfileSessionTarGz } from '../../02_BROWSER/services/archive-service.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import { decryptProfileArchive } from '../cloud-profile-crypto.js';
import {
  log,
  pathExists,
  getApiBaseUrl,
  getUserDataPath,
  getSyncBindingsPath,
  isCloudSyncAllowedAsync,
  getSyncAuthHeadersAsync,
  getEffectiveSyncPassphraseAsync,
} from './sync-auth-config.js';
import {
  type CloudBindingInfo,
  getProfileCloudBindingAsync,
  setProfileCloudBindingAsync,
  removeProfileCloudBindingAsync,
  updateLocalSyncStatusAsync,
  broadcastProgress,
  requestApi,
} from './sync-state.js';
import { computeProfileManifestHashAsync, applyCookiesDeltaPayload } from './sync-delta.js';
import { type CloudSyncMode, type UploadProfileResult, uploadProfileToCloud } from './sync-upload.js';

/**
 * Downloads and atomically restores a profile (or lightweight cookie delta) from cloud storage.
 * Verifies SHA-256 checksum, performs zero-knowledge decryption, validates archive,
 * and stages restore to prevent any corruption of existing profiles.
 */
export async function downloadAndRestoreProfile(
  cloudProfileId: string,
  options?: {
    overrideName?: string;
    targetFolder?: string;
    passphrase?: string;
    version?: number;
    targetLocalProfileId?: string;
    mode?: CloudSyncMode;
  }
): Promise<Profile> {
  // Resolve targetLocalId candidate:
  // 1) Explicit targetLocalProfileId from options
  // 2) Profile bound locally to cloudProfileId in sync-bindings
  let targetLocalId = options?.targetLocalProfileId;
  if (!targetLocalId) {
    try {
      const bindingsFile = getSyncBindingsPath();
      if (await pathExists(bindingsFile)) {
        const map: Record<string, CloudBindingInfo> = JSON.parse(await fs.promises.readFile(bindingsFile, 'utf8'));
        for (const [locId, bInfo] of Object.entries(map)) {
          if (bInfo?.cloudProfileId === cloudProfileId) {
            targetLocalId = locId;
            break;
          }
        }
      }
    } catch (bindErr) {
      log.warn('Failed reading local bindings while resolving cloud restore target', {
        cloudProfileId,
        err: bindErr instanceof Error ? bindErr.message : String(bindErr),
      });
    }
  }

  let localProfile = targetLocalId ? getProfileById(targetLocalId) : null;

  // CRITICAL QUOTA ENFORCEMENT:
  // Only verify creation capacity when creating a brand-new local profile!
  // Updating an existing local profile must NEVER be blocked by plan profile limits.
  if (!localProfile) {
    assertCanCreateProfile(1);
  }

  const check = await isCloudSyncAllowedAsync();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = await getSyncAuthHeadersAsync();
  const effectivePassphrase = options?.passphrase || (await getEffectiveSyncPassphraseAsync());
  const baseUrl = getApiBaseUrl();

  broadcastProgress({
    stage: 'DOWNLOADING',
    profileId: cloudProfileId,
    percent: 20,
    message: 'Requesting secure download session from cloud...',
  });

  // 1. Request Download Session from Server
  const dlSessionPayload = JSON.stringify({
    cloudProfileId,
    version: options?.version,
    ...(options?.mode ? { mode: options.mode } : {}),
  });

  const sessionRes = await requestApi(
    `${baseUrl}/api/v1/sync/download-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dlSessionPayload),
        ...authHeaders,
      },
    },
    Buffer.from(dlSessionPayload)
  );

  if (sessionRes.statusCode !== 200) {
    const errText = sessionRes.body.toString('utf8');
    throw new Error(`Download session request failed (HTTP ${sessionRes.statusCode}): ${errText}`);
  }

  const sessionData = JSON.parse(sessionRes.body.toString('utf8')).data;

  // 2. Download Encrypted Blob from Storage Provider
  broadcastProgress({
    stage: 'DOWNLOADING',
    profileId: cloudProfileId,
    percent: 50,
    message: `Downloading encrypted ${sessionData.syncMode === 'cookies_only' ? 'cookie delta' : 'archive blob'} (${(sessionData.fileSize / (1024 * 1024)).toFixed(2)} MB)...`,
  });

  const downloadRes = await requestApi(sessionData.downloadUrl, { method: 'GET' });
  if (downloadRes.statusCode !== 200) {
    throw new Error(`Failed to download encrypted object from storage (HTTP ${downloadRes.statusCode})`);
  }

  const ciphertext = downloadRes.body;

  // 3. Verify SHA-256 Checksum BEFORE Decrypting
  broadcastProgress({
    stage: 'EXTRACTING',
    profileId: cloudProfileId,
    percent: 70,
    message: 'Verifying archive checksum and decrypting payload...',
  });

  const actualChecksum = crypto.createHash('sha256').update(ciphertext).digest('hex');
  if (actualChecksum !== sessionData.checksumSha256) {
    throw new Error(
      `Checksum mismatch! Storage object integrity check failed. Expected: ${sessionData.checksumSha256}, Actual: ${actualChecksum}`
    );
  }

  // 4. Decrypt via Client-Side Envelope Crypto
  let plaintextArchiveBuffer: Buffer;
  try {
    plaintextArchiveBuffer = decryptProfileArchive({
      ciphertext,
      expectedChecksum: sessionData.checksumSha256,
      encryptedDataKey: sessionData.encryptedDataKey,
      iv: sessionData.iv,
      authTag: sessionData.authTag,
      userMasterKey: effectivePassphrase,
    });
  } catch (decErr: unknown) {
    throw new Error(`Decryption failed: ${decErr instanceof Error ? decErr.message : String(decErr)}`);
  }

  if (!localProfile && !targetLocalId && sessionData.localProfileId) {
    const existingCandidate = getProfileById(sessionData.localProfileId);
    if (existingCandidate) {
      targetLocalId = sessionData.localProfileId;
      localProfile = existingCandidate;
    }
  }

  // Handle dedicated cookie-only delta restore without overwriting full storage
  if (sessionData.syncMode === 'cookies_only') {
    if (!localProfile) {
      const { createProfile } = await import('../../02_BROWSER/services/profile-service.js');
      localProfile = createProfile({
        name: options?.overrideName || sessionData.profileName || 'Cloud Restored Profile',
        folder: options?.targetFolder || 'General',
        tags: [],
        notes: '',
      });
    }

    const targetDir = getProfileStoragePath(localProfile.id);
    const backupDir = (await pathExists(targetDir)) ? `${targetDir}.delta_backup_${Date.now()}` : null;
    if (backupDir) {
      try {
        await fs.promises.cp(targetDir, backupDir, { recursive: true });
      } catch (cpErr) {
        log.warn('Failed creating pre-delta profile backup directory', {
          profileId: localProfile.id,
          backupDir,
          err: cpErr instanceof Error ? cpErr.message : String(cpErr),
        });
      }
    }

    try {
      await applyCookiesDeltaPayload(localProfile.id, plaintextArchiveBuffer);
      if (backupDir && (await pathExists(backupDir))) {
        try {
          await fs.promises.rm(backupDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          log.debug('Failed deleting pre-delta backup directory after restore', {
            backupDir,
            err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          });
        }
      }

      const restoredManifestHash = await computeProfileManifestHashAsync(localProfile.id);
      await setProfileCloudBindingAsync(localProfile.id, {
        cloudProfileId,
        lastSyncedVersion: sessionData.version,
        updatedAt: new Date().toISOString(),
        lastManifestHash: restoredManifestHash,
        lastSyncedMode: 'cookies_only',
        ...(sessionData.deltaVersion ? { lastDeltaVersion: sessionData.deltaVersion } : {}),
      });
      await updateLocalSyncStatusAsync(localProfile.id, 'SYNCED');

      broadcastProgress({
        stage: 'COMPLETED',
        profileId: localProfile.id,
        percent: 100,
        message: `Profile "${localProfile.name}" cookies restored from cloud delta.`,
      });

      return localProfile;
    } catch (deltaErr) {
      if (backupDir && (await pathExists(backupDir))) {
        try {
          if (await pathExists(targetDir)) {
            await fs.promises.rm(targetDir, { recursive: true, force: true });
          }
          await fs.promises.rename(backupDir, targetDir);
        } catch (rbErr) {
          log.error('Failed rolling back profile directory after delta restore failure', {
            profileId: localProfile.id,
            targetDir,
            err: rbErr instanceof Error ? rbErr.message : String(rbErr),
          });
        }
      }
      throw deltaErr;
    } finally {
      if (backupDir && (await pathExists(backupDir))) {
        try {
          await fs.promises.rm(backupDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          log.debug('Failed final cleanup of pre-delta backup directory', {
            backupDir,
            err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          });
        }
      }
    }
  }

  // 5. Atomic Local Restore: Write to temporary file, stage extraction, and rollback on failure
  broadcastProgress({
    stage: 'EXTRACTING',
    profileId: cloudProfileId,
    percent: 85,
    message: 'Atomically restoring profile data and website sessions...',
  });

  const isTarGz =
    plaintextArchiveBuffer.length >= 2 &&
    plaintextArchiveBuffer[0] === 0x1f &&
    plaintextArchiveBuffer[1] === 0x8b;
  const tempExt = isTarGz ? 'tar.gz' : 'mahi-profile';
  const tempFilePath = path.join(getUserDataPath(), `restore_temp_${cloudProfileId}_${Date.now()}.${tempExt}`);
  await fs.promises.writeFile(tempFilePath, plaintextArchiveBuffer);

  const effectiveLocalId = localProfile?.id || targetLocalId || sessionData.localProfileId || cloudProfileId;
  const existingStorageDir = getProfileStoragePath(effectiveLocalId);
  const backupStorageDir =
    existingStorageDir && (await pathExists(existingStorageDir))
      ? `${existingStorageDir}.backup_${Date.now()}`
      : null;

  // Backup existing directory if present to guarantee atomic rollback
  if (backupStorageDir && existingStorageDir) {
    try {
      await fs.promises.cp(existingStorageDir, backupStorageDir, { recursive: true });
    } catch (cpErr) {
      log.warn('Failed creating pre-restore profile backup directory', {
        existingStorageDir,
        backupStorageDir,
        err: cpErr instanceof Error ? cpErr.message : String(cpErr),
      });
    }
  }

  try {
    let restored: Profile;
    if (isTarGz) {
      // Modern pure-Node POSIX ustar session.tar.gz unpack
      if (!localProfile) {
        const { createProfile } = await import('../../02_BROWSER/services/profile-service.js');
        localProfile = createProfile({
          name: options?.overrideName || sessionData.profileName || 'Cloud Restored Profile',
          folder: options?.targetFolder || 'General',
          tags: [],
          notes: '',
        });
      }
      await unpackProfileSessionTarGz(tempFilePath, localProfile.id);
      restored = localProfile;
    } else {
      restored = importProfileFromArchive({
        sourceFilePath: tempFilePath,
        password: effectivePassphrase,
        overrideName: options?.overrideName,
        targetFolder: options?.targetFolder,
      });
    }

    // If a newer cookie delta exists alongside the full snapshot, overlay it cleanly
    if (sessionData.cookieDelta?.downloadUrl) {
      const deltaDlRes = await requestApi(sessionData.cookieDelta.downloadUrl, { method: 'GET' });
      if (deltaDlRes.statusCode !== 200) {
        throw new Error(`Failed to download accompanying cookie delta (HTTP ${deltaDlRes.statusCode})`);
      }
      const deltaChecksum = crypto.createHash('sha256').update(deltaDlRes.body).digest('hex');
      if (deltaChecksum !== sessionData.cookieDelta.checksumSha256) {
        throw new Error('Cookie delta checksum mismatch during restore');
      }
      const decryptedDelta = decryptProfileArchive({
        ciphertext: deltaDlRes.body,
        expectedChecksum: sessionData.cookieDelta.checksumSha256,
        encryptedDataKey: sessionData.cookieDelta.encryptedDataKey,
        iv: sessionData.cookieDelta.iv,
        authTag: sessionData.cookieDelta.authTag,
        userMasterKey: effectivePassphrase,
      });
      await applyCookiesDeltaPayload(restored.id, decryptedDelta);
    }

    // Cleanup backup on success
    if (backupStorageDir && (await pathExists(backupStorageDir))) {
      try {
        await fs.promises.rm(backupStorageDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        log.debug('Failed deleting restore backup directory after success', {
          backupStorageDir,
          err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      }
    }

    // Save cloud binding with computed manifest hash
    const restoredManifestHash = await computeProfileManifestHashAsync(restored.id);
    await setProfileCloudBindingAsync(restored.id, {
      cloudProfileId,
      lastSyncedVersion: sessionData.version,
      updatedAt: new Date().toISOString(),
      lastManifestHash: restoredManifestHash,
      lastSyncedMode: sessionData.cookieDelta ? 'cookies_only' : 'full',
      ...(sessionData.cookieDelta?.deltaVersion ? { lastDeltaVersion: sessionData.cookieDelta.deltaVersion } : {}),
    });

    await updateLocalSyncStatusAsync(restored.id, 'SYNCED');

    broadcastProgress({
      stage: 'COMPLETED',
      profileId: restored.id,
      percent: 100,
      message: `Profile "${restored.name}" restored successfully from cloud (v${sessionData.version}).`,
    });

    logActivity(
      'PROFILE',
      'SUCCESS',
      'Cloud Restore',
      `Restored profile "${restored.name}" from cloud (v${sessionData.version})`,
      restored.id,
      restored.name
    );

    return restored;
  } catch (err: unknown) {
    // Atomic rollback: restore previous state if backup exists
    const rollbackTarget = localProfile ? getProfileStoragePath(localProfile.id) : existingStorageDir;
    if (backupStorageDir && (await pathExists(backupStorageDir)) && rollbackTarget) {
      try {
        if (await pathExists(rollbackTarget)) {
          await fs.promises.rm(rollbackTarget, { recursive: true, force: true });
        }
        await fs.promises.rename(backupStorageDir, rollbackTarget);
      } catch (rbErr) {
        log.error('Failed rolling back profile directory after cloud restore error', {
          rollbackTarget,
          err: rbErr instanceof Error ? rbErr.message : String(rbErr),
        });
      }
    }
    throw err;
  } finally {
    if (await pathExists(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (cleanupErr) {
        log.debug('Failed deleting temp restore archive', {
          tempFilePath,
          err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      }
    }
    if (backupStorageDir && (await pathExists(backupStorageDir))) {
      try {
        await fs.promises.rm(backupStorageDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        log.debug('Failed cleaning up restore backup directory', {
          backupStorageDir,
          err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      }
    }
  }
}

/**
 * Delete profile from cloud storage and remove local binding.
 */
export async function deleteCloudProfile(cloudProfileId: string): Promise<boolean> {
  const check = await isCloudSyncAllowedAsync();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = await getSyncAuthHeadersAsync();
  const baseUrl = getApiBaseUrl();

  const res = await requestApi(`${baseUrl}/api/v1/sync/profile/${encodeURIComponent(cloudProfileId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  if (res.statusCode === 200) {
    // Look up and remove binding for local profiles referencing this cloud profile
    try {
      const file = getSyncBindingsPath();
      if (await pathExists(file)) {
        const map: Record<string, CloudBindingInfo> = JSON.parse(await fs.promises.readFile(file, 'utf8'));
        for (const [locId, b] of Object.entries(map)) {
          if (b.cloudProfileId === cloudProfileId) {
            delete map[locId];
            await updateLocalSyncStatusAsync(locId, 'LOCAL_ONLY');
          }
        }
        await fs.promises.writeFile(file, JSON.stringify(map, null, 2), 'utf8');
      }
    } catch (bindErr) {
      log.warn('Failed updating local bindings after deleting cloud profile', {
        cloudProfileId,
        err: bindErr instanceof Error ? bindErr.message : String(bindErr),
      });
    }
    return true;
  }
  return false;
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================
export async function resolveSyncConflict(
  profileId: string,
  resolution: 'DOWNLOAD_LATEST' | 'KEEP_LOCAL_AS_NEW' | 'OVERWRITE_FORCE'
): Promise<Profile | UploadProfileResult> {
  const binding = await getProfileCloudBindingAsync(profileId);
  const profile = getProfileById(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found locally`);
  }

  if (resolution === 'DOWNLOAD_LATEST') {
    if (!binding?.cloudProfileId) {
      throw new Error('No cloud profile binding found to download');
    }
    return downloadAndRestoreProfile(binding.cloudProfileId);
  }

  if (resolution === 'KEEP_LOCAL_AS_NEW') {
    // Unlink the profile from the conflicting cloud profile
    await removeProfileCloudBindingAsync(profileId);
    await updateLocalSyncStatusAsync(profileId, 'LOCAL_ONLY');
    // Upload as new independent profile
    return uploadProfileToCloud(profileId);
  }

  if (resolution === 'OVERWRITE_FORCE') {
    // Force upload with baseVersion 0 / force bypass
    return uploadProfileToCloud(profileId, { force: true });
  }

  throw new Error(`Unknown conflict resolution action: ${resolution}`);
}
