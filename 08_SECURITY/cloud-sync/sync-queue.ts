import fs from 'node:fs';
import { getProfiles } from '../../02_BROWSER/services/profile-service.js';
import {
  log,
  pathExists,
  getApiBaseUrl,
  getSyncQueuePath,
  getSyncConfigAsync,
  isCloudSyncAllowed,
  isCloudSyncAllowedAsync,
  getSyncAuthHeadersAsync,
} from './sync-auth-config.js';
import {
  getProfileCloudBindingAsync,
  updateLocalSyncStatusAsync,
  broadcastSyncToast,
  broadcastProgress,
  requestApi,
  getQueuePausedStatus,
  setQueuePausedForQuota,
  hasBroadcastAuthErrorSent,
  setHasBroadcastAuthError,
} from './sync-state.js';
import { uploadProfileToCloud } from './sync-upload.js';
import { downloadAndRestoreProfile } from './sync-restore.js';

// ============================================================================
// UPLOAD QUEUE, RETRY & AUTO-SYNC
// ============================================================================
interface QueueItem {
  profileId: string;
  attempts: number;
  addedAt: string;
}

async function readQueueAsync(): Promise<QueueItem[]> {
  try {
    const f = getSyncQueuePath();
    if (await pathExists(f)) {
      return JSON.parse(await fs.promises.readFile(f, 'utf8'));
    }
  } catch (err) {
    log.warn('Failed reading cloud sync queue file asynchronously', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return [];
}

async function saveQueueAsync(queue: QueueItem[]): Promise<void> {
  try {
    await fs.promises.writeFile(getSyncQueuePath(), JSON.stringify(queue, null, 2), 'utf8');
  } catch (err) {
    log.warn('Failed persisting cloud sync queue file asynchronously', {
      queueLength: queue.length,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

let isProcessingQueue = false;

export async function processSyncQueue(): Promise<void> {
  if (isProcessingQueue) return;
  const config = await getSyncConfigAsync();
  if (!config.autoSync) return;

  const auth = await isCloudSyncAllowedAsync();
  if (!auth.allowed) return;

  if (getQueuePausedStatus()) return;

  isProcessingQueue = true;
  const queue = await readQueueAsync();

  try {
    while (queue.length > 0) {
      const item = queue[0];
      try {
        const result = await uploadProfileToCloud(item.profileId);
        if (result.conflict) {
          // If conflict, stop retrying this item
          queue.shift();
          await saveQueueAsync(queue);
          break;
        }
        queue.shift(); // remove on success
        await saveQueueAsync(queue);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const errWithStatus = err && typeof err === 'object' ? (err as { status?: number }) : undefined;
        const status =
          errWithStatus?.status ||
          (msg.includes('401')
            ? 401
            : msg.includes('403')
              ? 403
              : msg.includes('409')
                ? 409
                : msg.includes('413')
                  ? 413
                  : msg.includes('507')
                    ? 507
                    : 500);

        if (status === 401 || status === 403) {
          // 401/403 (revoked/expired): retry STOP, clear queue, show single toast, no launch spam
          log.warn(`[CloudSync] Auth failure (${status}). Halting sync retries and clearing queue.`);
          await saveQueueAsync([]);
          if (!hasBroadcastAuthErrorSent()) {
            setHasBroadcastAuthError(true);
            broadcastSyncToast(
              'error',
              'Cloud Sync Disabled',
              'Cloud sync suspended: Active license required. Local profiles remain completely safe.'
            );
          }
          break;
        }

        if (status === 413 || status === 507) {
          // 413/507 (quota/disk): pause queue, show single usage toast, keep queue for later
          log.warn(`[CloudSync] Storage cap reached (${status}). Pausing sync queue.`);
          setQueuePausedForQuota(true);
          broadcastSyncToast(
            'warning',
            'Cloud Storage Full',
            'Cloud storage quota (1GB) or server disk capacity reached. Sync queue paused.'
          );
          break;
        }

        log.warn(
          `[CloudSync] Queue item ${item.profileId} failed (attempt ${item.attempts + 1}):`,
          err instanceof Error ? err.message : String(err)
        );
        item.attempts += 1;
        if (item.attempts >= 5) {
          await updateLocalSyncStatusAsync(item.profileId, 'ERROR');
          queue.shift(); // drop after 5 failed attempts
        }
        await saveQueueAsync(queue);
        break; // Stop and retry later on network error
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

export async function enqueueSyncAsync(profileId: string): Promise<void> {
  const config = await getSyncConfigAsync();
  if (!config.autoSync) return;

  const auth = await isCloudSyncAllowedAsync();
  if (!auth.allowed) return;

  if (getQueuePausedStatus()) return;

  await updateLocalSyncStatusAsync(profileId, 'PENDING');
  const queue = await readQueueAsync();
  if (!queue.some((q) => q.profileId === profileId)) {
    queue.push({
      profileId,
      attempts: 0,
      addedAt: new Date().toISOString(),
    });
    await saveQueueAsync(queue);
  }

  // Non-blocking processing
  setTimeout(() => {
    processSyncQueue().catch((err) => {
      log.warn('Background cloud sync queue pass failed after enqueue', {
        profileId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, 1000);
}

export function enqueueSync(profileId: string): void {
  void enqueueSyncAsync(profileId);
}

export async function syncAllProfilesAsync(): Promise<void> {
  const auth = await isCloudSyncAllowedAsync();
  if (!auth.allowed) throw new Error(auth.reason);

  const profiles = getProfiles();
  for (const p of profiles) {
    await enqueueSyncAsync(p.id);
  }
}

export function syncAllProfiles(): void {
  const auth = isCloudSyncAllowed();
  if (!auth.allowed) throw new Error(auth.reason);

  const profiles = getProfiles();
  for (const p of profiles) {
    void enqueueSyncAsync(p.id);
  }
}

/**
 * Checks if cloud version for a bound profile is newer than local synced version.
 * If cloud version is higher, pulls and atomically restores latest snapshot before launch.
 * Returns true if synced, false if already up-to-date or offline.
 */
export async function syncProfileIfCloudNewer(profileId: string): Promise<boolean> {
  try {
    const binding = await getProfileCloudBindingAsync(profileId);
    if (!binding?.cloudProfileId) {
      return false;
    }

    const authHeaders = await getSyncAuthHeadersAsync();
    const baseUrl = getApiBaseUrl();

    // Query cloud profile metadata
    const res = await requestApi(`${baseUrl}/api/v1/sync/profiles/${binding.cloudProfileId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (res.statusCode !== 200) {
      return false; // Server unreachable or offline: continue with local profile
    }

    const payload = JSON.parse(res.body.toString('utf8'));
    const cloudProfile = payload.profile || payload.data || payload;
    const cloudVersion = cloudProfile.current_version || cloudProfile.version || 0;

    if (cloudVersion > binding.lastSyncedVersion) {
      broadcastProgress({
        stage: 'DOWNLOADING',
        profileId,
        percent: 10,
        message: `Newer cloud version detected (v${cloudVersion} > v${binding.lastSyncedVersion}). Synchronizing profile before launch...`,
      });

      await downloadAndRestoreProfile(binding.cloudProfileId, { targetLocalProfileId: profileId });
      return true;
    }

    return false;
  } catch (err: unknown) {
    log.warn(
      `[CloudSync] Background sync check failed for ${profileId} (continuing offline):`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

/**
 * Initializes startup sync queue resumption
 */
export function initCloudSync(): void {
  const auth = isCloudSyncAllowed();
  if (!auth.allowed) {
    // Suppress launch spam if user is not authorized for cloud sync
    return;
  }
  setTimeout(() => {
    processSyncQueue().catch((err) => {
      log.warn('Startup cloud sync queue pass failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, 5000);
}
