import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { app, BrowserWindow } from './electron-bridge.js';
import { getHWID, verifyLicense } from './license-service.js';
import { ADMIN_API_BASE_URL, isOnlineRevoked, isGraceExpired } from './license-status-service.js';
import { hasValidLicense, assertCanCreateProfile } from './freemium-guard.js';
import { hasValidAccountSubscription, getAccountSyncKey, loadEncryptedSession } from './account-service.js';
import { getProfileById, getProfiles, getProfileStoragePath } from '../02_BROWSER/services/profile-service.js';
import {
  exportProfileToArchive,
  importProfileFromArchive,
  packProfileSessionTarGz,
  unpackProfileSessionTarGz
} from '../02_BROWSER/services/archive-service.js';
import {
  CloudProfileMetadata,
  CloudSyncUsage,
  CloudSyncConfig,
  CloudSyncStatus,
  CloudSyncProgressEvent
} from '../10_CONFIG/shared/types/sync.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { encryptProfileArchive, decryptProfileArchive } from './cloud-profile-crypto.js';
import { getDeviceId, getDeviceName } from '../03_HARDWARE/device-id.js';
import { getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';

const MAX_PROFILE_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_USER_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB
const DEFAULT_PASSPHRASE = 'mahi-cloud-sync';

export function getApiBaseUrl(): string {
  return process.env.COMMERCIAL_API_URL || ADMIN_API_BASE_URL;
}

function getUserDataPath(): string {
  return getWritableUserDataDir();
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

function getSyncBindingsPath(): string {
  return path.join(getUserDataPath(), 'cloud-profile-bindings.json');
}

// ============================================================================
// PROFILE BINDING STORAGE (Local UUID <-> Cloud Profile ID & Version)
// ============================================================================
export interface CloudBindingInfo {
  cloudProfileId: string;
  lastSyncedVersion: number;
  updatedAt: string;
}

export function getProfileCloudBinding(profileId: string): CloudBindingInfo | null {
  try {
    const file = getSyncBindingsPath();
    if (fs.existsSync(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(fs.readFileSync(file, 'utf8'));
      return map[profileId] || null;
    }
  } catch {}
  return null;
}

export function setProfileCloudBinding(profileId: string, binding: CloudBindingInfo): void {
  try {
    const file = getSyncBindingsPath();
    const map: Record<string, CloudBindingInfo> = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : {};
    map[profileId] = binding;
    fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    console.error('[CloudSync] Failed to save profile binding:', err);
  }
}

export function removeProfileCloudBinding(profileId: string): void {
  try {
    const file = getSyncBindingsPath();
    if (fs.existsSync(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(fs.readFileSync(file, 'utf8'));
      delete map[profileId];
      fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf8');
    }
  } catch {}
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
      'Authorization': `Bearer ${session.token}`,
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
  // 1. Explicit user/account sync key
  const accountKey = getAccountSyncKey();
  if (accountKey) return accountKey;

  // 2. User-configured custom sync passphrase (if non-default)
  const config = getSyncConfig();
  if (config.syncPassphrase && config.syncPassphrase !== DEFAULT_PASSPHRASE) {
    return config.syncPassphrase;
  }

  // 3. User Account Isolation: Derive deterministic zero-knowledge secret from account identity
  const session = loadEncryptedSession();
  if (session?.account_id) {
    return crypto
      .createHash('sha256')
      .update(`mahi-zk-sync-account:${session.account_id}:${session.email || ''}`)
      .digest('hex');
  }

  // 4. Active License Isolation: Derive from hardware ID + signed license key
  const lic = getActiveLicenseKey();
  if (lic) {
    return crypto
      .createHash('sha256')
      .update(`mahi-zk-sync-license:${getHWID()}:${lic}`)
      .digest('hex');
  }

  // 5. Machine-isolated hardware key fallback
  return crypto
    .createHash('sha256')
    .update(`mahi-zk-sync-device:${getHWID()}`)
    .digest('hex');
}

export function isCloudSyncAllowed(): { allowed: boolean; reason?: string } {
  const session = loadEncryptedSession();
  if (session?.token || session?.account_id || hasValidAccountSubscription()) {
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

export function updateLocalSyncStatus(profileId: string, status: CloudSyncStatus): void {
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
export function requestApi(urlStr: string, options: https.RequestOptions, body?: Buffer): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
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
  const baseUrl = getApiBaseUrl();

  const res = await requestApi(`${baseUrl}/api/v1/sync/usage`, {
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
  const baseUrl = getApiBaseUrl();

  const res = await requestApi(`${baseUrl}/api/v1/sync/list`, {
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

/**
 * Upload profile to cloud with zero-knowledge envelope encryption,
 * optimistic concurrency conflict detection, and presigned upload session.
 */
export async function uploadProfileToCloud(
  profileId: string,
  options?: { force?: boolean; baseVersion?: number }
): Promise<{ success: boolean; cloudProfile?: any; conflict?: boolean; currentCloudVersion?: number; localBaseVersion?: number }> {
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
  const baseUrl = getApiBaseUrl();

  broadcastProgress({
    stage: 'PACKING',
    profileId,
    percent: 15,
    message: `Exporting and packaging profile "${profile.name}" (cache excluded)...`
  });
  updateLocalSyncStatus(profileId, 'SYNCING');

  const tempExportPath = path.join(getUserDataPath(), `sync_temp_${profileId}_${Date.now()}.tar.gz`);

  try {
    // 1. Pack profile session into pure-Node POSIX ustar session.tar.gz (cache excluded per Section 6)
    const packResult = await packProfileSessionTarGz(profileId, tempExportPath);
    if (packResult.sizeBytes > MAX_PROFILE_BYTES) {
      throw new Error(`Profile exceeds maximum 200MB limit (size: ${(packResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`);
    }

    const archiveBuffer = packResult.buffer;

    // 2. Client-Side Zero-Knowledge Envelope Encryption (AES-256-GCM + random data key wrapped by user sync key)
    broadcastProgress({
      stage: 'PACKING',
      profileId,
      percent: 30,
      message: 'Encrypting archive with client-side zero-knowledge envelope encryption...'
    });

    const encryptedPackage = encryptProfileArchive(archiveBuffer, effectivePassphrase);

    // 3. Resolve baseVersion for optimistic concurrency
    const binding = getProfileCloudBinding(profileId);
    let baseVersion = options?.baseVersion !== undefined ? options.baseVersion : (binding?.lastSyncedVersion || 0);
    if (options?.force) {
      baseVersion = 0; // Force bypass
    }

    // 4. Request Upload Session from server
    broadcastProgress({
      stage: 'UPLOADING',
      profileId,
      percent: 45,
      message: 'Requesting secure cloud upload session...'
    });

    const uploadSessionPayload = JSON.stringify({
      localProfileId: profileId,
      profileName: profile.name,
      baseVersion,
      archiveFormat: 'tar.gz',
      expectedSize: encryptedPackage.ciphertext.length,
      expectedChecksum: encryptedPackage.checksumSha256,
      encryptedDataKey: encryptedPackage.encryptedDataKey,
      iv: encryptedPackage.iv,
      authTag: encryptedPackage.authTag,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
    });

    const sessionRes = await requestApi(`${baseUrl}/api/v1/sync/upload-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(uploadSessionPayload),
        ...authHeaders,
      }
    }, Buffer.from(uploadSessionPayload));

    // Handle Optimistic Concurrency Conflict (HTTP 409)
    if (sessionRes.statusCode === 409) {
      const conflictData = JSON.parse(sessionRes.body.toString('utf8'));
      updateLocalSyncStatus(profileId, 'CONFLICT');
      broadcastProgress({
        stage: 'ERROR',
        profileId,
        percent: 0,
        error: conflictData.message || 'Sync conflict detected. Profile has been modified on another device.',
      });
      broadcastSyncToast('warning', 'Sync Conflict Detected', `Profile "${profile.name}" has newer changes in cloud. Please choose conflict resolution.`);
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
      } catch {}
      const errObj: any = new Error(errMsg);
      errObj.status = sessionRes.statusCode;
      throw errObj;
    }

    const sessionData = JSON.parse(sessionRes.body.toString('utf8'));

    // 5. Upload Encrypted Ciphertext Blob to Object Storage (via Presigned URL)
    broadcastProgress({
      stage: 'UPLOADING',
      profileId,
      percent: 65,
      message: `Uploading encrypted blob (${(encryptedPackage.ciphertext.length / (1024 * 1024)).toFixed(2)} MB)...`
    });

    const uploadPutRes = await requestApi(sessionData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': encryptedPackage.ciphertext.length,
      }
    }, encryptedPackage.ciphertext);

    if (uploadPutRes.statusCode < 200 || uploadPutRes.statusCode >= 300) {
      throw new Error(`Failed to upload encrypted blob to storage provider (HTTP ${uploadPutRes.statusCode})`);
    }

    // 6. Finalize Upload Session on Server
    broadcastProgress({
      stage: 'UPLOADING',
      profileId,
      percent: 90,
      message: 'Verifying storage integrity and activating cloud version...'
    });

    const finalizePayload = JSON.stringify({
      sessionId: sessionData.sessionId,
      profileName: profile.name,
      localProfileId: profileId,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
    });

    const finalizeRes = await requestApi(`${baseUrl}/api/v1/sync/finalize-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(finalizePayload),
        ...authHeaders,
      }
    }, Buffer.from(finalizePayload));

    if (finalizeRes.statusCode !== 200) {
      const errText = finalizeRes.body.toString('utf8');
      throw new Error(`Finalize failed (HTTP ${finalizeRes.statusCode}): ${errText}`);
    }

    const finalizeData = JSON.parse(finalizeRes.body.toString('utf8'));

    // 7. Store Local Binding
    setProfileCloudBinding(profileId, {
      cloudProfileId: finalizeData.cloudProfileId,
      lastSyncedVersion: finalizeData.version,
      updatedAt: new Date().toISOString(),
    });

    updateLocalSyncStatus(profileId, 'SYNCED');
    broadcastProgress({
      stage: 'COMPLETED',
      profileId,
      percent: 100,
      message: `Profile "${profile.name}" securely synced to cloud (v${finalizeData.version}).`
    });

    logActivity('PROFILE', 'SUCCESS', 'Cloud Sync', `Synced "${profile.name}" to cloud storage (v${finalizeData.version})`, profileId, profile.name);

    return {
      success: true,
      cloudProfile: {
        id: finalizeData.cloudProfileId,
        version: finalizeData.version,
      }
    };
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

/**
 * Downloads and atomically restores a profile from cloud storage.
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
  }
): Promise<any> {
  // Resolve targetLocalId candidate:
  // 1) Explicit targetLocalProfileId from options
  // 2) Profile bound locally to cloudProfileId in sync-bindings
  let targetLocalId = options?.targetLocalProfileId;
  if (!targetLocalId) {
    try {
      const bindingsFile = getSyncBindingsPath();
      if (fs.existsSync(bindingsFile)) {
        const map: Record<string, CloudBindingInfo> = JSON.parse(fs.readFileSync(bindingsFile, 'utf8'));
        for (const [locId, bInfo] of Object.entries(map)) {
          if (bInfo?.cloudProfileId === cloudProfileId) {
            targetLocalId = locId;
            break;
          }
        }
      }
    } catch {}
  }

  let localProfile = targetLocalId ? getProfileById(targetLocalId) : null;

  // CRITICAL QUOTA ENFORCEMENT:
  // Only verify creation capacity when creating a brand-new local profile!
  // Updating an existing local profile must NEVER be blocked by plan profile limits.
  if (!localProfile) {
    assertCanCreateProfile(1);
  }

  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = getSyncAuthHeaders();
  const effectivePassphrase = options?.passphrase || getEffectiveSyncPassphrase();
  const baseUrl = getApiBaseUrl();

  broadcastProgress({
    stage: 'DOWNLOADING',
    profileId: cloudProfileId,
    percent: 20,
    message: 'Requesting secure download session from cloud...'
  });

  // 1. Request Download Session from Server
  const dlSessionPayload = JSON.stringify({
    cloudProfileId,
    version: options?.version,
  });

  const sessionRes = await requestApi(`${baseUrl}/api/v1/sync/download-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dlSessionPayload),
      ...authHeaders,
    }
  }, Buffer.from(dlSessionPayload));

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
    message: `Downloading encrypted archive blob (${(sessionData.fileSize / (1024 * 1024)).toFixed(2)} MB)...`
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
    message: 'Verifying archive checksum and decrypting payload...'
  });

  const actualChecksum = crypto.createHash('sha256').update(ciphertext).digest('hex');
  if (actualChecksum !== sessionData.checksumSha256) {
    throw new Error(`Checksum mismatch! Storage object integrity check failed. Expected: ${sessionData.checksumSha256}, Actual: ${actualChecksum}`);
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
  } catch (decErr: any) {
    throw new Error(`Decryption failed: ${decErr.message}`);
  }

  if (!localProfile && !targetLocalId && sessionData.localProfileId) {
    const existingCandidate = getProfileById(sessionData.localProfileId);
    if (existingCandidate) {
      targetLocalId = sessionData.localProfileId;
      localProfile = existingCandidate;
    }
  }

  // 5. Atomic Local Restore: Write to temporary file, stage extraction, and rollback on failure
  broadcastProgress({
    stage: 'EXTRACTING',
    profileId: cloudProfileId,
    percent: 85,
    message: 'Atomically restoring profile data and website sessions...'
  });

  const isTarGz = plaintextArchiveBuffer.length >= 2 && plaintextArchiveBuffer[0] === 0x1f && plaintextArchiveBuffer[1] === 0x8b;
  const tempExt = isTarGz ? 'tar.gz' : 'mahi-profile';
  const tempFilePath = path.join(getUserDataPath(), `restore_temp_${cloudProfileId}_${Date.now()}.${tempExt}`);
  fs.writeFileSync(tempFilePath, plaintextArchiveBuffer);

  const effectiveLocalId = localProfile?.id || targetLocalId || sessionData.localProfileId || cloudProfileId;
  const existingStorageDir = getProfileStoragePath(effectiveLocalId);
  const backupStorageDir = existingStorageDir && fs.existsSync(existingStorageDir)
    ? `${existingStorageDir}.backup_${Date.now()}`
    : null;

  // Backup existing directory if present to guarantee atomic rollback
  if (backupStorageDir && existingStorageDir) {
    try {
      fs.cpSync(existingStorageDir, backupStorageDir, { recursive: true });
    } catch {}
  }

  try {
    let restored: any;
    if (isTarGz) {
      // Modern pure-Node POSIX ustar session.tar.gz unpack
      if (!localProfile) {
        const { createProfile } = await import('../02_BROWSER/services/profile-service.js');
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
        targetFolder: options?.targetFolder
      });
    }

    // Cleanup backup on success
    if (backupStorageDir && fs.existsSync(backupStorageDir)) {
      try { fs.rmSync(backupStorageDir, { recursive: true, force: true }); } catch {}
    }

    // Save cloud binding
    setProfileCloudBinding(restored.id, {
      cloudProfileId,
      lastSyncedVersion: sessionData.version,
      updatedAt: new Date().toISOString(),
    });

    updateLocalSyncStatus(restored.id, 'SYNCED');

    broadcastProgress({
      stage: 'COMPLETED',
      profileId: restored.id,
      percent: 100,
      message: `Profile "${restored.name}" restored successfully from cloud (v${sessionData.version}).`
    });

    logActivity('PROFILE', 'SUCCESS', 'Cloud Restore', `Restored profile "${restored.name}" from cloud (v${sessionData.version})`, restored.id, restored.name);

    return restored;
  } catch (err: any) {
    // Atomic rollback: restore previous state if backup exists
    const rollbackTarget = localProfile ? getProfileStoragePath(localProfile.id) : existingStorageDir;
    if (backupStorageDir && fs.existsSync(backupStorageDir) && rollbackTarget) {
      try {
        if (fs.existsSync(rollbackTarget)) {
          fs.rmSync(rollbackTarget, { recursive: true, force: true });
        }
        fs.renameSync(backupStorageDir, rollbackTarget);
      } catch {}
    }
    throw err;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
    if (backupStorageDir && fs.existsSync(backupStorageDir)) {
      try { fs.rmSync(backupStorageDir, { recursive: true, force: true }); } catch {}
    }
  }
}

/**
 * Delete profile from cloud storage and remove local binding.
 */
export async function deleteCloudProfile(cloudProfileId: string): Promise<boolean> {
  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = getSyncAuthHeaders();
  const baseUrl = getApiBaseUrl();

  const res = await requestApi(`${baseUrl}/api/v1/sync/profile/${encodeURIComponent(cloudProfileId)}`, {
    method: 'DELETE',
    headers: authHeaders
  });

  if (res.statusCode === 200) {
    // Look up and remove binding for local profiles referencing this cloud profile
    try {
      const file = getSyncBindingsPath();
      if (fs.existsSync(file)) {
        const map: Record<string, CloudBindingInfo> = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const [locId, b] of Object.entries(map)) {
          if (b.cloudProfileId === cloudProfileId) {
            delete map[locId];
            updateLocalSyncStatus(locId, 'LOCAL_ONLY');
          }
        }
        fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf8');
      }
    } catch {}
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
): Promise<any> {
  const binding = getProfileCloudBinding(profileId);
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
    removeProfileCloudBinding(profileId);
    updateLocalSyncStatus(profileId, 'LOCAL_ONLY');
    // Upload as new independent profile
    return uploadProfileToCloud(profileId);
  }

  if (resolution === 'OVERWRITE_FORCE') {
    // Force upload with baseVersion 0 / force bypass
    return uploadProfileToCloud(profileId, { force: true });
  }

  throw new Error(`Unknown conflict resolution action: ${resolution}`);
}

// ============================================================================
// DISTRIBUTED PROFILE LOCKING (Client-side coordination)
// ============================================================================
let activeLockRenewInterval: NodeJS.Timeout | null = null;
let currentLockedCloudProfileId: string | null = null;

export async function acquireCloudLock(
  cloudProfileId: string,
  ttlSeconds = 300
): Promise<{ acquired: boolean; heldBy?: string; expiresAt?: string }> {
  try {
    const authHeaders = getSyncAuthHeaders();
    const baseUrl = getApiBaseUrl();

    const payload = JSON.stringify({
      cloudProfileId,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      ttlSeconds,
    });

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/acquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...authHeaders,
      }
    }, Buffer.from(payload));

    const data = JSON.parse(res.body.toString('utf8'));
    if (res.statusCode === 200 && data.acquired) {
      currentLockedCloudProfileId = cloudProfileId;
      // Start background heartbeat renewal every 60 seconds
      if (activeLockRenewInterval) clearInterval(activeLockRenewInterval);
      activeLockRenewInterval = setInterval(() => {
        renewCloudLock(cloudProfileId).catch(() => {});
      }, 60000);
      return { acquired: true, expiresAt: data.expiresAt };
    }

    return { acquired: false, heldBy: data.heldBy, expiresAt: data.expiresAt };
  } catch {
    // Offline mode or network error: never block local launch!
    return { acquired: true };
  }
}

export async function renewCloudLock(cloudProfileId: string, ttlSeconds = 300): Promise<boolean> {
  try {
    const authHeaders = getSyncAuthHeaders();
    const baseUrl = getApiBaseUrl();

    const payload = JSON.stringify({
      cloudProfileId,
      deviceId: getDeviceId(),
      ttlSeconds,
    });

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...authHeaders,
      }
    }, Buffer.from(payload));

    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export async function releaseCloudLock(cloudProfileId: string): Promise<boolean> {
  if (activeLockRenewInterval) {
    clearInterval(activeLockRenewInterval);
    activeLockRenewInterval = null;
  }
  currentLockedCloudProfileId = null;

  try {
    const authHeaders = getSyncAuthHeaders();
    const baseUrl = getApiBaseUrl();

    const payload = JSON.stringify({
      cloudProfileId,
      deviceId: getDeviceId(),
    });

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...authHeaders,
      }
    }, Buffer.from(payload));

    return res.statusCode === 200;
  } catch {
    return false;
  }
}

export async function getCloudLockStatus(cloudProfileId: string): Promise<{ isLocked: boolean; heldBy?: string; expiresAt?: string }> {
  try {
    const authHeaders = getSyncAuthHeaders();
    const baseUrl = getApiBaseUrl();

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/status?cloudProfileId=${encodeURIComponent(cloudProfileId)}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (res.statusCode === 200) {
      const data = JSON.parse(res.body.toString('utf8'));
      return data.data;
    }
  } catch {}
  return { isLocked: false };
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
        const result = await uploadProfileToCloud(item.profileId);
        if (result.conflict) {
          // If conflict, stop retrying this item
          queue.shift();
          saveQueue(queue);
          break;
        }
        queue.shift(); // remove on success
        saveQueue(queue);
      } catch (err: any) {
        const status = err.status || (
          err.message.includes('401') ? 401 :
          err.message.includes('403') ? 403 :
          err.message.includes('409') ? 409 :
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
        if (item.attempts >= 5) {
          updateLocalSyncStatus(item.profileId, 'ERROR');
          queue.shift(); // drop after 5 failed attempts
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
 * Checks if cloud version for a bound profile is newer than local synced version.
 * If cloud version is higher, pulls and atomically restores latest snapshot before launch.
 * Returns true if synced, false if already up-to-date or offline.
 */
export async function syncProfileIfCloudNewer(profileId: string): Promise<boolean> {
  try {
    const binding = getProfileCloudBinding(profileId);
    if (!binding?.cloudProfileId) {
      return false;
    }

    const authHeaders = getSyncAuthHeaders();
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
        message: `Newer cloud version detected (v${cloudVersion} > v${binding.lastSyncedVersion}). Synchronizing profile before launch...`
      });

      await downloadAndRestoreProfile(binding.cloudProfileId, { targetLocalProfileId: profileId });
      return true;
    }

    return false;
  } catch (err: any) {
    console.warn(`[CloudSync] Background sync check failed for ${profileId} (continuing offline):`, err?.message);
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
    processSyncQueue().catch(() => {});
  }, 5000);
}
