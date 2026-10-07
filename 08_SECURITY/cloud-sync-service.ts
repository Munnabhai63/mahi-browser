import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { app, BrowserWindow } from 'electron';
import { getHWID, verifyLicense } from './license-service.js';
import { ADMIN_API_BASE_URL, isOnlineRevoked, isGraceExpired } from './license-status-service.js';
import { hasValidLicense, assertCanCreateProfile } from './freemium-guard.js';
import { hasValidAccountSubscription, getAccountSyncKey, loadEncryptedSession } from './account-service.js';
import { getProfileById, getProfiles } from '../02_BROWSER/services/profile-service.js';
import { exportProfileToArchive, importProfileFromArchive } from '../02_BROWSER/services/archive-service.js';
import {
  CloudProfileMetadata,
  CloudSyncUsage,
  CloudSyncConfig,
  CloudSyncStatus,
  CloudSyncProgressEvent
} from '../10_CONFIG/shared/types/sync.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';

const MAX_PROFILE_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_USER_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB
const DEFAULT_PASSPHRASE = 'mahi-cloud-sync';

function getUserDataPath(): string {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch {}

  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'mahi-browser');
  } else if (process.env.HOME) {
    return path.join(process.env.HOME, '.mahi-browser');
  }
  return path.join(process.cwd(), '.mahi_data');
}

function getSyncConfigPath(): string {
  return path.join(getUserDataPath(), 'cloud-sync-config.json');
}

function getSyncQueuePath(): string {
  return path.join(getUserDataPath(), 'sync-queue.json');
}

function getSyncStatusCachePath(): string {
  return path.join(getUserDataPath(), 'cloud-sync-status.json');
}

// ============================================================================
// CONFIGURATION & CREDENTIALS
// ============================================================================
export function getSyncConfig(): CloudSyncConfig {
  try {
    const file = getSyncConfigPath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        autoSync: data.autoSync !== false,
        syncPassphrase: data.syncPassphrase || DEFAULT_PASSPHRASE
      };
    }
  } catch {}
  return { autoSync: true, syncPassphrase: DEFAULT_PASSPHRASE };
}

export function setSyncConfig(config: Partial<CloudSyncConfig>): CloudSyncConfig {
  const current = getSyncConfig();
  const updated: CloudSyncConfig = {
    autoSync: config.autoSync !== undefined ? config.autoSync : current.autoSync,
    syncPassphrase: config.syncPassphrase !== undefined ? config.syncPassphrase : current.syncPassphrase
  };
  try {
    fs.writeFileSync(getSyncConfigPath(), JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.error('[CloudSync] Failed to save sync config:', err);
  }
  return updated;
}

export function getActiveLicenseKey(): string | null {
  const userDataDir = getUserDataPath();
  const licenseFile = path.join(userDataDir, 'offline-license.key');
  if (fs.existsSync(licenseFile)) {
    const key = fs.readFileSync(licenseFile, 'utf8').trim();
    if (key) return key;
  }

  const claimedFile = path.join(userDataDir, 'claimed-licenses.json');
  if (fs.existsSync(claimedFile)) {
    try {
      const claimed: Record<string, string> = JSON.parse(fs.readFileSync(claimedFile, 'utf8'));
      for (const key of Object.values(claimed)) {
        if (key && typeof key === 'string' && verifyLicense(key).valid) {
          return key;
        }
      }
    } catch {}
  }
  return null;
}

export function getSyncAuthHeaders(): Record<string, string> {
  const session = loadEncryptedSession();
  const hwid = getHWID();
  if (session?.token) {
    return {
      'x-mahi-token': session.token,
      'x-mahi-hwid': hwid
    };
  }
  const key = getActiveLicenseKey();
  if (key) {
    return {
      'x-mahi-hwid': hwid,
      'x-mahi-license-key': key
    };
  }
  return { 'x-mahi-hwid': hwid };
}

export function getEffectiveSyncPassphrase(): string {
  const accountKey = getAccountSyncKey();
  if (accountKey) return accountKey;
  return getSyncConfig().syncPassphrase;
}

export function isCloudSyncAllowed(): { allowed: boolean; reason?: string } {
  if (hasValidAccountSubscription()) {
    return { allowed: true };
  }

  if (isOnlineRevoked()) {
    return { allowed: false, reason: 'License has been revoked by administration. Cloud sync disabled.' };
  }
  if (isGraceExpired()) {
    return { allowed: false, reason: 'License verification grace period expired. Please connect to internet to verify license.' };
  }
  if (!hasValidLicense()) {
    return { allowed: false, reason: 'Cloud Sync is a MAHI PRO feature. Active license or account required.' };
  }
  const key = getActiveLicenseKey();
  if (!key) {
    return { allowed: false, reason: 'No active license key found.' };
  }
  return { allowed: true };
}

// ============================================================================
// STATUS TRACKING & BROADCASTING
// ============================================================================
function readLocalSyncStatus(): Record<string, { status: CloudSyncStatus; updatedAt: string }> {
  try {
    const p = getSyncStatusCachePath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {}
  return {};
}

function updateLocalSyncStatus(profileId: string, status: CloudSyncStatus): void {
  try {
    const map = readLocalSyncStatus();
    map[profileId] = { status, updatedAt: new Date().toISOString() };
    fs.writeFileSync(getSyncStatusCachePath(), JSON.stringify(map, null, 2), 'utf8');
  } catch {}
}

export function getProfileSyncStatus(profileId: string): CloudSyncStatus {
  const map = readLocalSyncStatus();
  return map[profileId]?.status || 'LOCAL_ONLY';
}

export function getAllProfilesSyncStatus(): Record<string, CloudSyncStatus> {
  const map = readLocalSyncStatus();
  const res: Record<string, CloudSyncStatus> = {};
  for (const [k, v] of Object.entries(map)) {
    res[k] = v.status;
  }
  return res;
}

let hasBroadcastAuthError = false;
let isQueuePausedForQuota = false;

export function getQueuePausedStatus(): boolean {
  return isQueuePausedForQuota;
}

export function resetQueuePausedStatus(): void {
  isQueuePausedForQuota = false;
  hasBroadcastAuthError = false;
}

export function broadcastSyncToast(type: 'info' | 'warning' | 'error' | 'success', title: string, message: string): void {
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && BrowserWindow.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('toast:show', { type, title, message });
        }
      });
    } catch {}
  }
}

function broadcastProgress(event: CloudSyncProgressEvent): void {
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && BrowserWindow.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('sync:progress', event);
        }
      });
    } catch {}
  }
}

// ============================================================================
// NETWORK HELPERS
// ============================================================================
function requestApi(urlStr: string, options: https.RequestOptions, body?: Buffer): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.request(urlStr, options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Sync network request timed out'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ============================================================================
// PUBLIC SYNC APIS
// ============================================================================
export async function getCloudSyncUsage(): Promise<CloudSyncUsage> {
  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = getSyncAuthHeaders();

  const res = await requestApi(`${ADMIN_API_BASE_URL}/v1/sync/usage`, {
    method: 'GET',
    headers: authHeaders
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
    quota_percent: data.quota_percent || 0
  };
}

export async function getCloudSyncList(): Promise<CloudProfileMetadata[]> {
  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = getSyncAuthHeaders();

  const res = await requestApi(`${ADMIN_API_BASE_URL}/v1/sync/list`, {
    method: 'GET',
    headers: authHeaders
  });

  if (res.statusCode !== 200) {
    const errText = res.body.toString('utf8');
    throw new Error(`Failed to list cloud profiles (HTTP ${res.statusCode}): ${errText}`);
  }

  const data = JSON.parse(res.body.toString('utf8'));
  return data.profiles || [];
}

export async function uploadProfileToCloud(profileId: string): Promise<{ success: boolean; cloudProfile: any }> {
  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    updateLocalSyncStatus(profileId, 'ERROR');
    throw new Error(check.reason);
  }

  const profile = getProfileById(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found locally`);
  }

  const authHeaders = getSyncAuthHeaders();
  const effectivePassphrase = getEffectiveSyncPassphrase();

  broadcastProgress({
    stage: 'PACKING',
    profileId,
    percent: 15,
    message: `Exporting and encrypting profile "${profile.name}" (cache excluded)...`
  });
  updateLocalSyncStatus(profileId, 'SYNCING');

  const tempExportPath = path.join(getUserDataPath(), `sync_temp_${profileId}_${Date.now()}.mahi-profile`);

  try {
    // 1. Export archive with essential storage (excluding caches) + password encryption (AES-256-GCM)
    exportProfileToArchive({
      profileId,
      targetFilePath: tempExportPath,
      includeCookies: true,
      includeHistory: true,
      includeExtensions: true,
      includeBrowserSettings: true,
      includeStorage: true,
      password: effectivePassphrase
    });

    const fileStat = fs.statSync(tempExportPath);
    if (fileStat.size > MAX_PROFILE_BYTES) {
      throw new Error(`Profile exceeds maximum 200MB limit (size: ${(fileStat.size / (1024*1024)).toFixed(1)} MB)`);
    }

    broadcastProgress({
      stage: 'UPLOADING',
      profileId,
      percent: 40,
      message: `Uploading encrypted backup (${(fileStat.size / (1024*1024)).toFixed(2)} MB) to cloud...`
    });

    const fileBuffer = fs.readFileSync(tempExportPath);

    // 2. Upload to server
    const res = await requestApi(`${ADMIN_API_BASE_URL}/v1/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length,
        ...authHeaders,
        'x-mahi-profile-id': profileId,
        'x-mahi-profile-name': profile.name,
        'x-mahi-updated-at': new Date().toISOString()
      }
    }, fileBuffer);

    if (res.statusCode !== 200) {
      const errText = res.body.toString('utf8');
      let errMsg = `Upload failed (HTTP ${res.statusCode}): ${errText}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error) errMsg = parsed.error;
      } catch {}
      const errorObj: any = new Error(errMsg);
      errorObj.status = res.statusCode;
      throw errorObj;
    }

    const respData = JSON.parse(res.body.toString('utf8'));

    updateLocalSyncStatus(profileId, 'SYNCED');
    broadcastProgress({
      stage: 'COMPLETED',
      profileId,
      percent: 100,
      message: `Profile "${profile.name}" backed up to cloud successfully.`
    });

    logActivity('PROFILE', 'SUCCESS', 'Cloud Sync', `Backed up "${profile.name}" to cloud storage`, profileId, profile.name);

    return { success: true, cloudProfile: respData.profile };
  } catch (err: any) {
    updateLocalSyncStatus(profileId, 'ERROR');
    broadcastProgress({
      stage: 'ERROR',
      profileId,
      percent: 0,
      error: err.message
    });
    throw err;
  } finally {
    if (fs.existsSync(tempExportPath)) {
      try { fs.unlinkSync(tempExportPath); } catch {}
    }
  }
}

export async function downloadAndRestoreProfile(
  cloudProfileId: string,
  options?: { overrideName?: string; targetFolder?: string; passphrase?: string }
): Promise<any> {
  assertCanCreateProfile(1);
  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = getSyncAuthHeaders();
  const effectivePassphrase = options?.passphrase || getEffectiveSyncPassphrase();

  broadcastProgress({
    stage: 'DOWNLOADING',
    profileId: cloudProfileId,
    percent: 25,
    message: 'Downloading encrypted profile archive from cloud...'
  });

  const res = await requestApi(`${ADMIN_API_BASE_URL}/v1/sync/download?profile=${encodeURIComponent(cloudProfileId)}`, {
    method: 'GET',
    headers: authHeaders
  });

  if (res.statusCode !== 200) {
    const errText = res.body.toString('utf8');
    throw new Error(`Download failed (HTTP ${res.statusCode}): ${errText}`);
  }

  broadcastProgress({
    stage: 'EXTRACTING',
    profileId: cloudProfileId,
    percent: 75,
    message: 'Decrypting and restoring profile data...'
  });

  const tempFilePath = path.join(getUserDataPath(), `restore_temp_${cloudProfileId}_${Date.now()}.mahi-profile`);
  fs.writeFileSync(tempFilePath, res.body);

  try {
    const restored = importProfileFromArchive({
      sourceFilePath: tempFilePath,
      password: effectivePassphrase,
      overrideName: options?.overrideName,
      targetFolder: options?.targetFolder
    });

    updateLocalSyncStatus(restored.id, 'SYNCED');

    broadcastProgress({
      stage: 'COMPLETED',
      profileId: restored.id,
      percent: 100,
      message: `Profile "${restored.name}" restored successfully.`
    });

    logActivity('PROFILE', 'SUCCESS', 'Cloud Restore', `Restored profile "${restored.name}" from cloud`, restored.id, restored.name);

    return restored;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
  }
}

export async function deleteCloudProfile(cloudProfileId: string): Promise<boolean> {
  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = getSyncAuthHeaders();

  const res = await requestApi(`${ADMIN_API_BASE_URL}/v1/sync/profile?id=${encodeURIComponent(cloudProfileId)}`, {
    method: 'DELETE',
    headers: authHeaders
  });

  if (res.statusCode === 200) {
    updateLocalSyncStatus(cloudProfileId, 'LOCAL_ONLY');
    return true;
  }
  return false;
}

// ============================================================================
// UPLOAD QUEUE, RETRY & AUTO-SYNC
// ============================================================================
interface QueueItem {
  profileId: string;
  attempts: number;
  addedAt: string;
}

function readQueue(): QueueItem[] {
  try {
    const f = getSyncQueuePath();
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch {}
  return [];
}

function saveQueue(queue: QueueItem[]): void {
  try {
    fs.writeFileSync(getSyncQueuePath(), JSON.stringify(queue, null, 2), 'utf8');
  } catch {}
}

let isProcessingQueue = false;

export async function processSyncQueue(): Promise<void> {
  if (isProcessingQueue) return;
  const config = getSyncConfig();
  if (!config.autoSync) return;

  const auth = isCloudSyncAllowed();
  if (!auth.allowed) return;

  if (isQueuePausedForQuota) return;

  isProcessingQueue = true;
  const queue = readQueue();

  try {
    while (queue.length > 0) {
      const item = queue[0];
      try {
        await uploadProfileToCloud(item.profileId);
        queue.shift(); // remove on success
        saveQueue(queue);
      } catch (err: any) {
        const status = err.status || (
          err.message.includes('401') ? 401 :
          err.message.includes('403') ? 403 :
          err.message.includes('413') ? 413 :
          err.message.includes('507') ? 507 : 500
        );

        if (status === 401 || status === 403) {
          // 401/403 (revoked/expired): retry STOP, clear queue, show single toast, no launch spam
          console.warn(`[CloudSync] Auth failure (${status}). Halting sync retries and clearing queue.`);
          saveQueue([]);
          if (!hasBroadcastAuthError) {
            hasBroadcastAuthError = true;
            broadcastSyncToast('error', 'Cloud Sync Disabled', 'Cloud sync suspended: Active license required. Local profiles remain completely safe.');
          }
          break;
        }

        if (status === 413 || status === 507) {
          // 413/507 (quota/disk): pause queue, show single usage toast, keep queue for later
          console.warn(`[CloudSync] Storage cap reached (${status}). Pausing sync queue.`);
          isQueuePausedForQuota = true;
          broadcastSyncToast('warning', 'Cloud Storage Full', 'Cloud storage quota (1GB) or server disk capacity reached. Sync queue paused.');
          break;
        }

        console.warn(`[CloudSync] Queue item ${item.profileId} failed (attempt ${item.attempts + 1}):`, err.message);
        item.attempts += 1;
        if (item.attempts >= 3) {
          queue.shift(); // drop after 3 attempts
        }
        saveQueue(queue);
        break; // Stop and retry later on network error
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

export function enqueueSync(profileId: string): void {
  const config = getSyncConfig();
  if (!config.autoSync) return;

  const auth = isCloudSyncAllowed();
  if (!auth.allowed) return;

  if (isQueuePausedForQuota) return;

  updateLocalSyncStatus(profileId, 'PENDING');
  const queue = readQueue();
  if (!queue.some(q => q.profileId === profileId)) {
    queue.push({
      profileId,
      attempts: 0,
      addedAt: new Date().toISOString()
    });
    saveQueue(queue);
  }

  // Non-blocking processing
  setTimeout(() => {
    processSyncQueue().catch(() => {});
  }, 1000);
}

export function syncAllProfiles(): void {
  const auth = isCloudSyncAllowed();
  if (!auth.allowed) throw new Error(auth.reason);

  const profiles = getProfiles();
  for (const p of profiles) {
    enqueueSync(p.id);
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
    processSyncQueue().catch(() => {});
  }, 5000);
}
