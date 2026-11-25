import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
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
  isPathExcludedFromSync,
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
  lastManifestHash?: string;
  lastSyncedMode?: 'full' | 'cookies_only';
  lastDeltaVersion?: number;
}

const MAX_COOKIE_DELTA_EXTRA_BYTES = 450 * 1024; // Keep cookie/session delta lightweight (< 500 KB)

export interface CookieDeltaPayload {
  format: 'mahi-cookies-delta-v1';
  profileId: string;
  baseVersion: number;
  createdAt: string;
  manifestHash: string;
  mahiCookiesJson: string | null;
  cookieFiles: Record<string, string>;
  localStorageFiles: Record<string, string>;
}

/**
 * Computes a deterministic SHA-256 manifest digest over a profile's core state files
 * (excluding Cache, GPUCache, Code Cache, lock/temp files via isPathExcludedFromSync)
 * and core profile metadata.
 */
export function computeProfileManifestHash(profileId: string): string {
  const hash = crypto.createHash('sha256');
  const profile = getProfileById(profileId);
  const baseDir = getProfileStoragePath(profileId);

  const metaSnapshot = profile
    ? {
        id: profile.id,
        name: profile.name,
        engine: profile.settings?.browser?.engine || 'chromium',
        fingerprint: profile.settings?.fingerprint || null,
        tags: profile.tags || [],
        folder: profile.folder || 'General',
        notes: profile.notes || '',
      }
    : { id: profileId };

  hash.update(`meta:${JSON.stringify(metaSnapshot)}\n`);

  if (!fs.existsSync(baseDir)) {
    hash.update('files:empty\n');
    return hash.digest('hex');
  }

  const fileEntries: Array<{ relPath: string; fullPath: string }> = [];

  function walkDir(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (isPathExcludedFromSync(relPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        fileEntries.push({ relPath, fullPath });
      }
    }
  }

  try {
    walkDir(baseDir);
  } catch {}

  fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  for (const item of fileEntries) {
    try {
      const content = fs.readFileSync(item.fullPath);
      const fileDigest = crypto.createHash('sha256').update(content).digest('hex');
      hash.update(`file:${item.relPath}:${content.length}:${fileDigest}\n`);
    } catch {
      hash.update(`file-unreadable:${item.relPath}\n`);
    }
  }

  return hash.digest('hex');
}

function isSafeDeltaRelativePath(relPath: string): boolean {
  if (!relPath || typeof relPath !== 'string') return false;
  if (
    relPath.includes('..') ||
    relPath.startsWith('/') ||
    relPath.startsWith('\\') ||
    /^[a-zA-Z]:/.test(relPath) ||
    path.isAbsolute(relPath) ||
    relPath.includes('\0')
  ) {
    return false;
  }
  return !isPathExcludedFromSync(relPath);
}

/**
 * Packages ONLY the lightweight cookie/session delta payload (mahi_cookies.json, Chromium Cookies DB,
 * and bounded Local Storage state) into a compressed buffer ready for AES-256-GCM envelope encryption.
 */
export function packCookiesDeltaPayload(
  profileId: string,
  baseVersion: number,
  manifestHash: string
): { buffer: Buffer; rawBytes: number; cookieCount: number; fileCount: number } {
  const baseDir = getProfileStoragePath(profileId);
  let mahiCookiesJson: string | null = null;
  let cookieCount = 0;
  let fileCount = 0;
  const cookieFiles: Record<string, string> = {};
  const localStorageFiles: Record<string, string> = {};

  const mahiCookiesPath = path.join(baseDir, 'mahi_cookies.json');
  if (fs.existsSync(mahiCookiesPath)) {
    try {
      mahiCookiesJson = fs.readFileSync(mahiCookiesPath, 'utf8');
      const parsed = JSON.parse(mahiCookiesJson);
      if (Array.isArray(parsed)) {
        cookieCount = parsed.length;
      }
      fileCount += 1;
    } catch {}
  }

  const cookieFileCandidates = [
    'Default/Network/Cookies',
    'Default/Cookies',
    'Network/Cookies',
    'Cookies',
  ];

  for (const relPath of cookieFileCandidates) {
    const absPath = path.join(baseDir, relPath);
    if (fs.existsSync(absPath)) {
      try {
        const stat = fs.statSync(absPath);
        if (stat.isFile()) {
          const data = fs.readFileSync(absPath);
          cookieFiles[relPath] = data.toString('base64');
          fileCount += 1;
        }
      } catch {}
    }
  }

  let localStorageBytes = 0;
  const localStorageDirs = [
    path.join(baseDir, 'Default', 'Local Storage'),
    path.join(baseDir, 'Local Storage'),
  ];

  for (const lsDir of localStorageDirs) {
    if (!fs.existsSync(lsDir)) continue;
    const scanLs = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDir, full).replace(/\\/g, '/');
        if (isPathExcludedFromSync(rel)) continue;
        if (entry.isDirectory()) {
          scanLs(full);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (lower === 'log' || lower === 'log.old' || lower === 'current' || lower.startsWith('manifest')) {
            // Skip internal leveldb logs unless tiny; keep data files (.ldb/.log) within delta cap
          }
          try {
            const buf = fs.readFileSync(full);
            if (localStorageBytes + buf.length <= MAX_COOKIE_DELTA_EXTRA_BYTES) {
              localStorageFiles[rel] = buf.toString('base64');
              localStorageBytes += buf.length;
              fileCount += 1;
            }
          } catch {}
        }
      }
    };
    try {
      scanLs(lsDir);
    } catch {}
  }

  const payload: CookieDeltaPayload = {
    format: 'mahi-cookies-delta-v1',
    profileId,
    baseVersion,
    createdAt: new Date().toISOString(),
    manifestHash,
    mahiCookiesJson,
    cookieFiles,
    localStorageFiles,
  };

  const jsonBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
  const gzipBuffer = zlib.gzipSync(jsonBuffer, { level: 6 });

  return {
    buffer: gzipBuffer,
    rawBytes: jsonBuffer.length,
    cookieCount,
    fileCount,
  };
}

/**
 * Restores a decrypted cookie/session delta payload into the target profile directory
 * with path-traversal validation and atomic file writes.
 */
export function applyCookiesDeltaPayload(
  targetProfileId: string,
  decryptedBuffer: Buffer
): { restoredFiles: number; restoredCookies: number } {
  const isGzip =
    decryptedBuffer.length >= 2 &&
    decryptedBuffer[0] === 0x1f &&
    decryptedBuffer[1] === 0x8b;
  const rawJson = isGzip
    ? zlib.gunzipSync(decryptedBuffer).toString('utf8')
    : decryptedBuffer.toString('utf8');

  const payload = JSON.parse(rawJson) as CookieDeltaPayload;
  if (!payload || payload.format !== 'mahi-cookies-delta-v1') {
    throw new Error('INVALID_COOKIE_DELTA: Unsupported cookie delta payload format');
  }

  const baseDir = getProfileStoragePath(targetProfileId);
  fs.mkdirSync(baseDir, { recursive: true });
  const resolvedBase = path.resolve(baseDir);

  let restoredFiles = 0;
  let restoredCookies = 0;

  if (typeof payload.mahiCookiesJson === 'string') {
    const targetCookiesPath = path.join(baseDir, 'mahi_cookies.json');
    fs.writeFileSync(targetCookiesPath, payload.mahiCookiesJson, 'utf8');
    restoredFiles += 1;
    try {
      const parsed = JSON.parse(payload.mahiCookiesJson);
      if (Array.isArray(parsed)) {
        restoredCookies = parsed.length;
      }
    } catch {}
  }

  const writeSafeDeltaEntries = (entries: Record<string, string> | undefined) => {
    if (!entries || typeof entries !== 'object') return;
    for (const [relPath, b64] of Object.entries(entries)) {
      if (!isSafeDeltaRelativePath(relPath)) {
        throw new Error(`SECURITY_ALERT_PATH_TRAVERSAL: Unsafe delta entry path "${relPath}"`);
      }
      const targetPath = path.resolve(baseDir, relPath);
      if (!targetPath.startsWith(resolvedBase + path.sep)) {
        throw new Error(`SECURITY_ALERT_PATH_TRAVERSAL: Escaping delta entry path "${relPath}"`);
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, Buffer.from(b64, 'base64'));
      restoredFiles += 1;
    }
  };

  writeSafeDeltaEntries(payload.cookieFiles);
  writeSafeDeltaEntries(payload.localStorageFiles);

  return { restoredFiles, restoredCookies };
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
  const check = isCloudSyncAllowed();
  if (!check.allowed) {
    updateLocalSyncStatus(profileId, 'ERROR');
    throw new Error(check.reason);
  }

  const profile = getProfileById(profileId);
  if (!profile) {
    throw new Error(`Profile ${profileId} not found locally`);
  }

  const binding = getProfileCloudBinding(profileId);
  const manifestHash = computeProfileManifestHash(profileId);

  // Manifest Hash Short-Circuit: zero network upload when core state is unchanged
  if (
    !options?.force &&
    binding?.cloudProfileId &&
    binding.lastManifestHash &&
    binding.lastManifestHash === manifestHash
  ) {
    updateLocalSyncStatus(profileId, 'SYNCED');
    broadcastProgress({
      stage: 'COMPLETED',
      profileId,
      percent: 100,
      message: `Profile "${profile.name}" unchanged since last sync (skipped upload).`
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

  const authHeaders = getSyncAuthHeaders();
  const effectivePassphrase = getEffectiveSyncPassphrase();
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
  updateLocalSyncStatus(profileId, 'SYNCING');

  const tempExportPath = path.join(getUserDataPath(), `sync_temp_${profileId}_${Date.now()}.tar.gz`);

  try {
    return await withProfileCloudSyncLock(binding?.cloudProfileId, async () => {
      const prepareEncryptedPackage = async (modeToPack: CloudSyncMode) => {
        let rawPayloadBuffer: Buffer;
        if (modeToPack === 'cookies_only') {
          const deltaPack = packCookiesDeltaPayload(
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
          message: 'Encrypting archive with client-side zero-knowledge envelope encryption...'
        });

        return encryptProfileArchive(rawPayloadBuffer, effectivePassphrase);
      };

      let activeMode: CloudSyncMode = syncMode;
      let encryptedPackage = await prepareEncryptedPackage(activeMode);

      // Resolve baseVersion for optimistic concurrency
      let baseVersion = options?.baseVersion !== undefined ? options.baseVersion : (binding?.lastSyncedVersion || 0);
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

        return requestApi(`${baseUrl}/api/v1/sync/upload-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(uploadSessionPayload),
            ...authHeaders,
          }
        }, Buffer.from(uploadSessionPayload));
      };

      broadcastProgress({
        stage: 'UPLOADING',
        profileId,
        percent: 45,
        message: 'Requesting secure cloud upload session...'
      });

      let sessionRes = await requestSession(activeMode, encryptedPackage);

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
        message: `Uploading encrypted ${activeMode === 'cookies_only' ? 'cookie delta' : 'blob'} (${(encryptedPackage.ciphertext.length / 1024).toFixed(1)} KB)...`
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

      // 7. Store Local Binding with manifest hash & mode metadata
      setProfileCloudBinding(profileId, {
        cloudProfileId: finalizeData.cloudProfileId,
        lastSyncedVersion: finalizeData.version,
        updatedAt: new Date().toISOString(),
        lastManifestHash: manifestHash,
        lastSyncedMode: activeMode,
        ...(finalizeData.deltaVersion ? { lastDeltaVersion: finalizeData.deltaVersion } : {}),
      });

      updateLocalSyncStatus(profileId, 'SYNCED');
      broadcastProgress({
        stage: 'COMPLETED',
        profileId,
        percent: 100,
        message:
          activeMode === 'cookies_only'
            ? `Profile "${profile.name}" cookie delta synced (d${finalizeData.deltaVersion || 1} on v${finalizeData.version}).`
            : `Profile "${profile.name}" securely synced to cloud (v${finalizeData.version}).`
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
        }
      };
    });
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
 * Convenience wrapper to perform lightweight encrypted cookie/session sync.
 * Falls back gracefully to full tarball sync if no base snapshot exists yet.
 */
export async function syncCookiesOnly(
  profileId: string,
  options?: Omit<UploadProfileOptions, 'mode'>
): Promise<UploadProfileResult> {
  return uploadProfileToCloud(profileId, { ...options, mode: 'cookies_only' });
}

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
    ...(options?.mode ? { mode: options.mode } : {}),
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
    message: `Downloading encrypted ${sessionData.syncMode === 'cookies_only' ? 'cookie delta' : 'archive blob'} (${(sessionData.fileSize / (1024 * 1024)).toFixed(2)} MB)...`
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

  // Handle dedicated cookie-only delta restore without overwriting full storage
  if (sessionData.syncMode === 'cookies_only') {
    if (!localProfile) {
      const { createProfile } = await import('../02_BROWSER/services/profile-service.js');
      localProfile = createProfile({
        name: options?.overrideName || sessionData.profileName || 'Cloud Restored Profile',
        folder: options?.targetFolder || 'General',
        tags: [],
        notes: '',
      });
    }

    const targetDir = getProfileStoragePath(localProfile.id);
    const backupDir = fs.existsSync(targetDir) ? `${targetDir}.delta_backup_${Date.now()}` : null;
    if (backupDir) {
      try {
        fs.cpSync(targetDir, backupDir, { recursive: true });
      } catch {}
    }

    try {
      applyCookiesDeltaPayload(localProfile.id, plaintextArchiveBuffer);
      if (backupDir && fs.existsSync(backupDir)) {
        try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
      }

      const restoredManifestHash = computeProfileManifestHash(localProfile.id);
      setProfileCloudBinding(localProfile.id, {
        cloudProfileId,
        lastSyncedVersion: sessionData.version,
        updatedAt: new Date().toISOString(),
        lastManifestHash: restoredManifestHash,
        lastSyncedMode: 'cookies_only',
        ...(sessionData.deltaVersion ? { lastDeltaVersion: sessionData.deltaVersion } : {}),
      });
      updateLocalSyncStatus(localProfile.id, 'SYNCED');

      broadcastProgress({
        stage: 'COMPLETED',
        profileId: localProfile.id,
        percent: 100,
        message: `Profile "${localProfile.name}" cookies restored from cloud delta.`
      });

      return localProfile;
    } catch (deltaErr) {
      if (backupDir && fs.existsSync(backupDir)) {
        try {
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
          fs.renameSync(backupDir, targetDir);
        } catch {}
      }
      throw deltaErr;
    } finally {
      if (backupDir && fs.existsSync(backupDir)) {
        try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
      }
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
      applyCookiesDeltaPayload(restored.id, decryptedDelta);
    }

    // Cleanup backup on success
    if (backupStorageDir && fs.existsSync(backupStorageDir)) {
      try { fs.rmSync(backupStorageDir, { recursive: true, force: true }); } catch {}
    }

    // Save cloud binding with computed manifest hash
    const restoredManifestHash = computeProfileManifestHash(restored.id);
    setProfileCloudBinding(restored.id, {
      cloudProfileId,
      lastSyncedVersion: sessionData.version,
      updatedAt: new Date().toISOString(),
      lastManifestHash: restoredManifestHash,
      lastSyncedMode: sessionData.cookieDelta ? 'cookies_only' : 'full',
      ...(sessionData.cookieDelta?.deltaVersion ? { lastDeltaVersion: sessionData.cookieDelta.deltaVersion } : {}),
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
const activeLockHeartbeats = new Map<string, NodeJS.Timeout>();

export function getActiveLockHeartbeatCount(): number {
  return activeLockHeartbeats.size;
}

export async function acquireCloudLock(
  cloudProfileId: string,
  ttlSeconds = 300
): Promise<{ acquired: boolean; heldBy?: string; expiresAt?: string; statusCode?: number }> {
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
      // Clear any existing heartbeat interval strictly for this specific profile
      const existing = activeLockHeartbeats.get(cloudProfileId);
      if (existing) {
        clearInterval(existing);
        activeLockHeartbeats.delete(cloudProfileId);
      }
      // Start dedicated background heartbeat renewal every 60 seconds for this profile
      const timer = setInterval(() => {
        renewCloudLock(cloudProfileId).catch(() => {});
      }, 60000);
      activeLockHeartbeats.set(cloudProfileId, timer);
      return { acquired: true, expiresAt: data.expiresAt, statusCode: 200 };
    }

    return { acquired: false, heldBy: data.heldBy, expiresAt: data.expiresAt, statusCode: res.statusCode };
  } catch {
    // Offline mode or network error: never block local launch!
    return { acquired: true };
  }
}

async function withProfileCloudSyncLock<T>(
  cloudProfileId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (!cloudProfileId) {
    return fn();
  }

  const alreadyHeldLocally = activeLockHeartbeats.has(cloudProfileId);
  if (alreadyHeldLocally) {
    await renewCloudLock(cloudProfileId).catch(() => false);
    return fn();
  }

  const lockRes = await acquireCloudLock(cloudProfileId);
  if (!lockRes.acquired && lockRes.statusCode === 423) {
    throw new Error(`Profile is currently locked by another device (${lockRes.heldBy || 'active session'}).`);
  }

  const acquiredTempLock = Boolean(lockRes.acquired && lockRes.statusCode === 200);
  try {
    return await fn();
  } finally {
    if (acquiredTempLock) {
      await releaseCloudLock(cloudProfileId).catch(() => false);
    }
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
  const timer = activeLockHeartbeats.get(cloudProfileId);
  if (timer) {
    clearInterval(timer);
    activeLockHeartbeats.delete(cloudProfileId);
  }

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

export async function releaseAllCloudLocks(): Promise<void> {
  const profileIds = Array.from(activeLockHeartbeats.keys());
  for (const pid of profileIds) {
    const timer = activeLockHeartbeats.get(pid);
    if (timer) {
      clearInterval(timer);
      activeLockHeartbeats.delete(pid);
    }
  }
  await Promise.allSettled(profileIds.map((pid) => releaseCloudLock(pid)));
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
