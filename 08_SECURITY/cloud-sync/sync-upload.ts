import fs from 'node:fs';
import path from 'node:path';
import { getProfileById } from '../../02_BROWSER/services/profile-service.js';
import { packProfileSessionTarGz } from '../../02_BROWSER/services/archive-service.js';
import type { CloudProfileMetadata, CloudSyncUsage } from '../../10_CONFIG/shared/types/sync.js';
import { logActivity } from '../../07_BACKEND/services/audit-service.js';
import { encryptProfileArchive } from '../cloud-profile-crypto.js';
import { getDeviceId, getDeviceName } from '../../03_HARDWARE/device-id.js';
import {
  log,
  pathExists,
  MAX_PROFILE_BYTES,
  MAX_USER_QUOTA_BYTES,
  getApiBaseUrl,
  getUserDataPath,
  isCloudSyncAllowedAsync,
  getSyncAuthHeadersAsync,
  getEffectiveSyncPassphraseAsync,
  getSyncConfigAsync,
} from './sync-auth-config.js';
import {
  getProfileCloudBindingAsync,
  setProfileCloudBindingAsync,
  updateLocalSyncStatusAsync,
  broadcastProgress,
  broadcastSyncToast,
  requestApi,
} from './sync-state.js';
import { computeProfileManifestHashAsync, packCookiesDeltaPayload } from './sync-delta.js';
import { withProfileCloudSyncLock } from './sync-locks.js';

// ============================================================================
// PUBLIC SYNC APIS (USAGE, LISTING & UPLOAD)
// ============================================================================
export async function getCloudSyncUsage(): Promise<CloudSyncUsage> {
  const check = await isCloudSyncAllowedAsync();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = await getSyncAuthHeadersAsync();
  const baseUrl = getApiBaseUrl();

  const res = await requestApi(`${baseUrl}/api/v1/sync/usage`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (res.statusCode !== 200) {
    const errText = res.body.toString('utf8');
    throw new Error(`Failed to fetch sync usage (HTTP ${res.statusCode}): ${errText}`);
  }

  const data = JSON.parse(res.body.toString('utf8'));
  return {
    used_bytes: data.used_bytes || 0,
    total_bytes: data.total_bytes || MAX_USER_QUOTA_BYTES,
    used_mb: data.used_mb || 0,
    total_mb: data.total_mb || 1024,
    profile_count: data.profile_count || 0,
    quota_percent: data.quota_percent || 0,
  };
}

export async function getCloudSyncList(): Promise<CloudProfileMetadata[]> {
  const check = await isCloudSyncAllowedAsync();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = await getSyncAuthHeadersAsync();
  const baseUrl = getApiBaseUrl();

  const res = await requestApi(`${baseUrl}/api/v1/sync/list`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (res.statusCode !== 200) {
    const errText = res.body.toString('utf8');
    throw new Error(`Failed to list cloud profiles (HTTP ${res.statusCode}): ${errText}`);
  }

  const data = JSON.parse(res.body.toString('utf8'));
  return data.profiles || [];
}

export type CloudSyncMode = 'full' | 'cookies_only';

export interface UploadProfileOptions {
  force?: boolean;
  baseVersion?: number;
  mode?: CloudSyncMode;
}

export interface UploadProfileResult {
  success: boolean;
  skipped?: boolean;
  reason?: 'unchanged';
  mode?: CloudSyncMode;
  manifestHash?: string;
  cloudProfile?: {
    id: string;
    version: number;
    deltaVersion?: number;
  };
  conflict?: boolean;
  currentCloudVersion?: number;
  localBaseVersion?: number;
}

/**
 * Upload profile to cloud with manifest hash short-circuit, zero-knowledge AES-256-GCM
 * envelope encryption, optional cookie-only delta mode, optimistic concurrency conflict
 * detection, distributed lock coordination, and presigned upload session.
 */
export async function uploadProfileToCloud(
  profileId: string,
  options?: UploadProfileOptions
): Promise<UploadProfileResult> {
  const check = await isCloudSyncAllowedAsync();
  if (!check.allowed) {
    await updateLocalSyncStatusAsync(profileId, 'ERROR');
    throw new Error(check.reason);
  }

  const profile = getProfileById(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found locally`);
  }

  const binding = await getProfileCloudBindingAsync(profileId);
  const manifestHash = await computeProfileManifestHashAsync(profileId);

  // Manifest Hash Short-Circuit: zero network upload when core state is unchanged
  if (
    !options?.force &&
    binding?.cloudProfileId &&
    binding.lastManifestHash &&
    binding.lastManifestHash === manifestHash
  ) {
    await updateLocalSyncStatusAsync(profileId, 'SYNCED');
    broadcastProgress({
      stage: 'COMPLETED',
      profileId,
      percent: 100,
      message: `Profile "${profile.name}" unchanged since last sync (skipped upload).`,
    });
    return {
      success: true,
      skipped: true,
      reason: 'unchanged',
      mode: options?.mode || binding.lastSyncedMode || 'full',
      manifestHash,
      cloudProfile: {
        id: binding.cloudProfileId,
        version: binding.lastSyncedVersion,
        ...(binding.lastDeltaVersion ? { deltaVersion: binding.lastDeltaVersion } : {}),
      },
    };
  }

  const authHeaders = await getSyncAuthHeadersAsync();
  const effectivePassphrase = await getEffectiveSyncPassphraseAsync();
  const baseUrl = getApiBaseUrl();

  // Graceful fallback to full tarball sync if cookies_only requested without any base snapshot
  let syncMode: CloudSyncMode = options?.mode === 'cookies_only' ? 'cookies_only' : 'full';
  if (syncMode === 'cookies_only' && (!binding?.cloudProfileId || !binding?.lastSyncedVersion)) {
    syncMode = 'full';
  }

  broadcastProgress({
    stage: 'PACKING',
    profileId,
    percent: 15,
    message:
      syncMode === 'cookies_only'
        ? `Packaging lightweight cookie & session delta for "${profile.name}"...`
        : `Exporting and packaging profile "${profile.name}" (cache excluded)...`,
  });
  await updateLocalSyncStatusAsync(profileId, 'SYNCING');

  const tempExportPath = path.join(getUserDataPath(), `sync_temp_${profileId}_${Date.now()}.tar.gz`);

  try {
    return await withProfileCloudSyncLock(binding?.cloudProfileId, async () => {
      const prepareEncryptedPackage = async (modeToPack: CloudSyncMode) => {
        let rawPayloadBuffer: Buffer;
        if (modeToPack === 'cookies_only') {
          const deltaPack = await packCookiesDeltaPayload(
            profileId,
            options?.baseVersion !== undefined ? options.baseVersion : binding?.lastSyncedVersion || 1,
            manifestHash
          );
          rawPayloadBuffer = deltaPack.buffer;
        } else {
          const packResult = await packProfileSessionTarGz(profileId, tempExportPath);
          if (packResult.sizeBytes > MAX_PROFILE_BYTES) {
            throw new Error(
              `Profile exceeds maximum 200MB limit (size: ${(packResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`
            );
          }
          rawPayloadBuffer = packResult.buffer;
        }

        broadcastProgress({
          stage: 'PACKING',
          profileId,
          percent: 30,
          message: 'Encrypting archive with client-side zero-knowledge envelope encryption...',
        });

        const keyVer = (await getSyncConfigAsync()).keyDerivationVersion === 2 ? 2 : 1;
        return encryptProfileArchive(rawPayloadBuffer, effectivePassphrase, { keyVersion: keyVer });
      };

      let activeMode: CloudSyncMode = syncMode;
      let encryptedPackage = await prepareEncryptedPackage(activeMode);

      // Resolve baseVersion for optimistic concurrency
      let baseVersion = options?.baseVersion !== undefined ? options.baseVersion : binding?.lastSyncedVersion || 0;
      if (options?.force) {
        baseVersion = 0; // Force bypass
      }

      const requestSession = async (modeForReq: CloudSyncMode, pkg: ReturnType<typeof encryptProfileArchive>) => {
        const uploadSessionPayload = JSON.stringify({
          localProfileId: profileId,
          profileName: profile.name,
          baseVersion,
          mode: modeForReq,
          archiveFormat: modeForReq === 'cookies_only' ? 'cookies_only' : 'tar.gz',
          manifestHash,
          expectedSize: pkg.ciphertext.length,
          expectedChecksum: pkg.checksumSha256,
          encryptedDataKey: pkg.encryptedDataKey,
          iv: pkg.iv,
          authTag: pkg.authTag,
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
        });

        return requestApi(
          `${baseUrl}/api/v1/sync/upload-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(uploadSessionPayload),
              ...authHeaders,
            },
          },
          Buffer.from(uploadSessionPayload)
        );
      };

      broadcastProgress({
        stage: 'UPLOADING',
        profileId,
        percent: 45,
        message: 'Requesting secure cloud upload session...',
      });

      let sessionRes = await requestSession(activeMode, encryptedPackage);

      // Handle Optimistic Concurrency Conflict (HTTP 409)
      if (sessionRes.statusCode === 409) {
        const conflictData = JSON.parse(sessionRes.body.toString('utf8'));
        await updateLocalSyncStatusAsync(profileId, 'CONFLICT');
        broadcastProgress({
          stage: 'ERROR',
          profileId,
          percent: 0,
          error: conflictData.message || 'Sync conflict detected. Profile has been modified on another device.',
        });
        broadcastSyncToast(
          'warning',
          'Sync Conflict Detected',
          `Profile "${profile.name}" has newer changes in cloud. Please choose conflict resolution.`
        );
        return {
          success: false,
          conflict: true,
          currentCloudVersion: conflictData.currentVersion,
          localBaseVersion: baseVersion,
        };
      }

      if (sessionRes.statusCode !== 200 && sessionRes.statusCode !== 201) {
        const errText = sessionRes.body.toString('utf8');
        let errMsg = `Upload session request failed (HTTP ${sessionRes.statusCode}): ${errText}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) errMsg = parsed.error;
        } catch (parseErr) {
          log.debug('Upload session error body was not JSON', {
            statusCode: sessionRes.statusCode,
            err: parseErr instanceof Error ? parseErr.message : String(parseErr),
          });
        }
        const errObj = new Error(errMsg) as Error & { status?: number };
        errObj.status = sessionRes.statusCode;
        throw errObj;
      }

      let sessionData = JSON.parse(sessionRes.body.toString('utf8'));

      // Server-instructed graceful fallback if no base full snapshot exists on cloud
      if (activeMode === 'cookies_only' && sessionData.fallbackToFull) {
        activeMode = 'full';
        baseVersion = 0;
        encryptedPackage = await prepareEncryptedPackage('full');
        sessionRes = await requestSession('full', encryptedPackage);
        if (sessionRes.statusCode !== 200 && sessionRes.statusCode !== 201) {
          throw new Error(`Fallback full upload session failed (HTTP ${sessionRes.statusCode})`);
        }
        sessionData = JSON.parse(sessionRes.body.toString('utf8'));
      }

      // 5. Upload Encrypted Ciphertext Blob to Object Storage (via Presigned URL)
      broadcastProgress({
        stage: 'UPLOADING',
        profileId,
        percent: 65,
        message: `Uploading encrypted ${activeMode === 'cookies_only' ? 'cookie delta' : 'blob'} (${(encryptedPackage.ciphertext.length / 1024).toFixed(1)} KB)...`,
      });

      const uploadPutRes = await requestApi(
        sessionData.uploadUrl,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': encryptedPackage.ciphertext.length,
          },
        },
        encryptedPackage.ciphertext
      );

      if (uploadPutRes.statusCode < 200 || uploadPutRes.statusCode >= 300) {
        throw new Error(`Failed to upload encrypted blob to storage provider (HTTP ${uploadPutRes.statusCode})`);
      }

      // 6. Finalize Upload Session on Server
      broadcastProgress({
        stage: 'UPLOADING',
        profileId,
        percent: 90,
        message: 'Verifying storage integrity and activating cloud version...',
      });

      const finalizePayload = JSON.stringify({
        sessionId: sessionData.sessionId,
        profileName: profile.name,
        localProfileId: profileId,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
      });

      const finalizeRes = await requestApi(
        `${baseUrl}/api/v1/sync/finalize-upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(finalizePayload),
            ...authHeaders,
          },
        },
        Buffer.from(finalizePayload)
      );

      if (finalizeRes.statusCode !== 200) {
        const errText = finalizeRes.body.toString('utf8');
        throw new Error(`Finalize failed (HTTP ${finalizeRes.statusCode}): ${errText}`);
      }

      const finalizeData = JSON.parse(finalizeRes.body.toString('utf8'));

      // 7. Store Local Binding with manifest hash & mode metadata
      await setProfileCloudBindingAsync(profileId, {
        cloudProfileId: finalizeData.cloudProfileId,
        lastSyncedVersion: finalizeData.version,
        updatedAt: new Date().toISOString(),
        lastManifestHash: manifestHash,
        lastSyncedMode: activeMode,
        ...(finalizeData.deltaVersion ? { lastDeltaVersion: finalizeData.deltaVersion } : {}),
      });

      await updateLocalSyncStatusAsync(profileId, 'SYNCED');
      broadcastProgress({
        stage: 'COMPLETED',
        profileId,
        percent: 100,
        message:
          activeMode === 'cookies_only'
            ? `Profile "${profile.name}" cookie delta synced (d${finalizeData.deltaVersion || 1} on v${finalizeData.version}).`
            : `Profile "${profile.name}" securely synced to cloud (v${finalizeData.version}).`,
      });

      logActivity(
        'PROFILE',
        'SUCCESS',
        'Cloud Sync',
        activeMode === 'cookies_only'
          ? `Synced cookie delta for "${profile.name}" (d${finalizeData.deltaVersion || 1})`
          : `Synced "${profile.name}" to cloud storage (v${finalizeData.version})`,
        profileId,
        profile.name
      );

      return {
        success: true,
        skipped: false,
        mode: activeMode,
        manifestHash,
        cloudProfile: {
          id: finalizeData.cloudProfileId,
          version: finalizeData.version,
          ...(finalizeData.deltaVersion ? { deltaVersion: finalizeData.deltaVersion } : {}),
        },
      };
    });
  } catch (err: unknown) {
    await updateLocalSyncStatusAsync(profileId, 'ERROR');
    broadcastProgress({
      stage: 'ERROR',
      profileId,
      percent: 0,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    if (await pathExists(tempExportPath)) {
      try {
        await fs.promises.unlink(tempExportPath);
      } catch (cleanupErr) {
        log.debug('Failed deleting temp upload archive', {
          tempExportPath,
          err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      }
    }
  }
}

/**
 * Convenience wrapper to perform lightweight encrypted cookie/session sync.
 * Falls back gracefully to full tarball sync if no base snapshot exists yet.
 */
export async function syncCookiesOnly(
  profileId: string,
  options?: Omit<UploadProfileOptions, 'mode'>
): Promise<UploadProfileResult> {
  return uploadProfileToCloud(profileId, { ...options, mode: 'cookies_only' });
}
