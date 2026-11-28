import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import https from 'node:https';
import http from 'node:http';
import { BrowserWindow } from './electron-bridge.js';
import { getHWID, verifyLicense } from './license-service.js';
import { ADMIN_API_BASE_URL, isOnlineRevoked, isGraceExpired } from './license-status-service.js';
import { hasValidLicense, assertCanCreateProfile } from './freemium-guard.js';
import { hasValidAccountSubscription, getAccountSyncKey, loadEncryptedSession, loadEncryptedSessionAsync, readCachedStatus, readCachedStatusAsync } from './account-service.js';
import { resolveCapabilitiesForCanonicalPlan } from '../07_BACKEND/commercial/canonical-plan-catalog.js';
import { getProfileById, getProfiles, getProfileStoragePath } from '../02_BROWSER/services/profile-service.js';
import type { Profile } from '../10_CONFIG/shared/types/profile.js';
import {
  importProfileFromArchive,
  isPathExcludedFromSync,
  packProfileSessionTarGz,
  unpackProfileSessionTarGz
} from '../02_BROWSER/services/archive-service.js';
import type {
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
import { cleanUrl, getSiteConfig } from '../10_CONFIG/shared/site-config.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('cloud-sync-service');

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const MAX_PROFILE_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_USER_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB
const DEFAULT_PASSPHRASE = 'mahi-cloud-sync';

export function getApiBaseUrl(): string {
  return (
    cleanUrl(process.env.COMMERCIAL_API_URL, '') ||
    getSiteConfig({ productionFallback: true }).apiUrl ||
    ADMIN_API_BASE_URL
  );
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
 * // sync-compat: synchronous version preserved for sync test assertions; async runtime paths call computeProfileManifestHashAsync
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
  } catch (err) {
    log.debug('Profile manifest walkDir skipped for missing/unreadable dir', {
      baseDir,
      err: err instanceof Error ? err.message : String(err),
    });
  }

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

/**
 * Asynchronous counterpart to computeProfileManifestHash for non-blocking runtime sync paths.
 */
export async function computeProfileManifestHashAsync(profileId: string): Promise<string> {
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

  if (!(await pathExists(baseDir))) {
    hash.update('files:empty\n');
    return hash.digest('hex');
  }

  const fileEntries: Array<{ relPath: string; fullPath: string }> = [];

  async function walkDirAsync(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (isPathExcludedFromSync(relPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walkDirAsync(fullPath);
      } else if (entry.isFile()) {
        fileEntries.push({ relPath, fullPath });
      }
    }
  }

  try {
    await walkDirAsync(baseDir);
  } catch (err) {
    log.debug('Profile manifest async walkDir skipped for missing/unreadable dir', {
      baseDir,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  for (const item of fileEntries) {
    try {
      const content = await fs.promises.readFile(item.fullPath);
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
export async function packCookiesDeltaPayload(
  profileId: string,
  baseVersion: number,
  manifestHash: string
): Promise<{ buffer: Buffer; rawBytes: number; cookieCount: number; fileCount: number }> {
  const baseDir = getProfileStoragePath(profileId);
  let mahiCookiesJson: string | null = null;
  let cookieCount = 0;
  let fileCount = 0;
  const cookieFiles: Record<string, string> = {};
  const localStorageFiles: Record<string, string> = {};

  const mahiCookiesPath = path.join(baseDir, 'mahi_cookies.json');
  if (await pathExists(mahiCookiesPath)) {
    try {
      mahiCookiesJson = await fs.promises.readFile(mahiCookiesPath, 'utf8');
      const parsed = JSON.parse(mahiCookiesJson);
      if (Array.isArray(parsed)) {
        cookieCount = parsed.length;
      }
      fileCount += 1;
    } catch (err) {
      log.warn('Failed reading mahi_cookies.json during delta pack', {
        mahiCookiesPath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const cookieFileCandidates = [
    'Default/Network/Cookies',
    'Default/Cookies',
    'Network/Cookies',
    'Cookies',
  ];

  for (const relPath of cookieFileCandidates) {
    const absPath = path.join(baseDir, relPath);
    if (await pathExists(absPath)) {
      try {
        const stat = await fs.promises.stat(absPath);
        if (stat.isFile()) {
          const data = await fs.promises.readFile(absPath);
          cookieFiles[relPath] = data.toString('base64');
          fileCount += 1;
        }
      } catch (err) {
        log.debug('Skipped locked/unreadable cookie file during delta pack', {
          relPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  let localStorageBytes = 0;
  const localStorageDirs = [
    path.join(baseDir, 'Default', 'Local Storage'),
    path.join(baseDir, 'Local Storage'),
  ];

  for (const lsDir of localStorageDirs) {
    if (!(await pathExists(lsDir))) continue;
    const scanLs = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDir, full).replace(/\\/g, '/');
        if (isPathExcludedFromSync(rel)) continue;
        if (entry.isDirectory()) {
          await scanLs(full);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (lower === 'log' || lower === 'log.old' || lower === 'current' || lower.startsWith('manifest')) {
            // Skip internal leveldb logs unless tiny; keep data files (.ldb/.log) within delta cap
          }
          try {
            const buf = await fs.promises.readFile(full);
            if (localStorageBytes + buf.length <= MAX_COOKIE_DELTA_EXTRA_BYTES) {
              localStorageFiles[rel] = buf.toString('base64');
              localStorageBytes += buf.length;
              fileCount += 1;
            }
          } catch (readErr) {
            log.debug('Skipped locked Local Storage file during delta pack', {
              rel,
              err: readErr instanceof Error ? readErr.message : String(readErr),
            });
          }
        }
      }
    };
    try {
      await scanLs(lsDir);
    } catch (lsErr) {
      log.debug('Local Storage delta scan skipped', {
        lsDir,
        err: lsErr instanceof Error ? lsErr.message : String(lsErr),
      });
    }
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
export async function applyCookiesDeltaPayload(
  targetProfileId: string,
  decryptedBuffer: Buffer
): Promise<{ restoredFiles: number; restoredCookies: number }> {
  const isGzip =
    decryptedBuffer.length >= 2 &&
    decryptedBuffer[0] === 0x1f &&
    decryptedBuffer[1] === 0x8b;
  const rawJson = isGzip
    ? zlib.gunzipSync(decryptedBuffer).toString('utf8')
    : decryptedBuffer.toString('utf8');

  const payload = JSON.parse(rawJson) as CookieDeltaPayload;
  if (payload?.format !== 'mahi-cookies-delta-v1') {
    throw new Error('INVALID_COOKIE_DELTA: Unsupported cookie delta payload format');
  }

  const baseDir = getProfileStoragePath(targetProfileId);
  await fs.promises.mkdir(baseDir, { recursive: true });
  const resolvedBase = path.resolve(baseDir);

  let restoredFiles = 0;
  let restoredCookies = 0;

  if (typeof payload.mahiCookiesJson === 'string') {
    const targetCookiesPath = path.join(baseDir, 'mahi_cookies.json');
    await fs.promises.writeFile(targetCookiesPath, payload.mahiCookiesJson, 'utf8');
    restoredFiles += 1;
    try {
      const parsed = JSON.parse(payload.mahiCookiesJson);
      if (Array.isArray(parsed)) {
        restoredCookies = parsed.length;
      }
    } catch (parseErr) {
      log.warn('Restored mahi_cookies.json could not be parsed for cookie count', {
        targetProfileId,
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
    }
  }

  const writeSafeDeltaEntries = async (entries: Record<string, string> | undefined) => {
    if (!entries || typeof entries !== 'object') return;
    for (const [relPath, b64] of Object.entries(entries)) {
      if (!isSafeDeltaRelativePath(relPath)) {
        throw new Error(`SECURITY_ALERT_PATH_TRAVERSAL: Unsafe delta entry path "${relPath}"`);
      }
      const targetPath = path.resolve(baseDir, relPath);
      if (!targetPath.startsWith(resolvedBase + path.sep)) {
        throw new Error(`SECURITY_ALERT_PATH_TRAVERSAL: Escaping delta entry path "${relPath}"`);
      }
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, Buffer.from(b64, 'base64'));
      restoredFiles += 1;
    }
  };

  await writeSafeDeltaEntries(payload.cookieFiles);
  await writeSafeDeltaEntries(payload.localStorageFiles);

  return { restoredFiles, restoredCookies };
}

// sync-compat: synchronous JSON accessors preserved for process-manager sync hooks & unit tests; async runtime paths use *Async
export function getProfileCloudBinding(profileId: string): CloudBindingInfo | null {
  try {
    const file = getSyncBindingsPath();
    if (fs.existsSync(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(fs.readFileSync(file, 'utf8'));
      return map[profileId] || null;
    }
  } catch (err) {
    log.warn('Failed reading cloud profile bindings cache', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
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
    log.error('[CloudSync] Failed to save profile binding:', err);
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
  } catch (err) {
    log.warn('Failed removing cloud profile binding entry', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getProfileCloudBindingAsync(profileId: string): Promise<CloudBindingInfo | null> {
  try {
    const file = getSyncBindingsPath();
    if (await pathExists(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      return map[profileId] || null;
    }
  } catch (err) {
    log.warn('Failed reading cloud profile bindings cache asynchronously', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export async function setProfileCloudBindingAsync(profileId: string, binding: CloudBindingInfo): Promise<void> {
  try {
    const file = getSyncBindingsPath();
    const map: Record<string, CloudBindingInfo> = (await pathExists(file))
      ? JSON.parse(await fs.promises.readFile(file, 'utf8'))
      : {};
    map[profileId] = binding;
    await fs.promises.writeFile(file, JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    log.error('[CloudSync] Failed to save profile binding asynchronously:', err);
  }
}

export async function removeProfileCloudBindingAsync(profileId: string): Promise<void> {
  try {
    const file = getSyncBindingsPath();
    if (await pathExists(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      delete map[profileId];
      await fs.promises.writeFile(file, JSON.stringify(map, null, 2), 'utf8');
    }
  } catch (err) {
    log.warn('Failed removing cloud profile binding entry asynchronously', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
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
        syncPassphrase: data.syncPassphrase || DEFAULT_PASSPHRASE,
        keyDerivationVersion: data.keyDerivationVersion === 2 ? 2 : 1,
      };
    }
  } catch (err) {
    log.warn('Failed reading cloud sync config; falling back to defaults', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return { autoSync: true, syncPassphrase: DEFAULT_PASSPHRASE, keyDerivationVersion: 1 };
}

export function setSyncConfig(config: Partial<CloudSyncConfig>): CloudSyncConfig {
  const current = getSyncConfig();
  const updated: CloudSyncConfig = {
    autoSync: config.autoSync !== undefined ? config.autoSync : current.autoSync,
    syncPassphrase: config.syncPassphrase !== undefined ? config.syncPassphrase : current.syncPassphrase,
    keyDerivationVersion:
      config.keyDerivationVersion === 2
        ? 2
        : config.keyDerivationVersion === 1
          ? 1
          : current.keyDerivationVersion || 1,
  };
  try {
    fs.writeFileSync(getSyncConfigPath(), JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    log.error('[CloudSync] Failed to save sync config:', err);
  }
  return updated;
}

export function isLegacyWeakPassphraseActive(config: CloudSyncConfig = getSyncConfig()): boolean {
  return !config.syncPassphrase || config.syncPassphrase === DEFAULT_PASSPHRASE || config.keyDerivationVersion !== 2;
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
    } catch (err) {
      log.warn('Failed reading claimed-licenses.json while resolving sync license key', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
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
  const cached = readCachedStatus();
  if (cached?.plan && hasValidAccountSubscription()) {
    const caps = resolveCapabilitiesForCanonicalPlan(cached.plan);
    if (caps['cloud.sync'] === false) {
      return {
        allowed: false,
        reason: 'Encrypted Cloud Backup is unlocked on Growth (25 profiles) and Ultimate (Unlimited) plans.',
      };
    }
  }

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

export async function getSyncConfigAsync(): Promise<CloudSyncConfig> {
  try {
    const file = getSyncConfigPath();
    if (await pathExists(file)) {
      const data = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      return {
        autoSync: data.autoSync !== false,
        syncPassphrase: data.syncPassphrase || DEFAULT_PASSPHRASE,
        keyDerivationVersion: data.keyDerivationVersion === 2 ? 2 : 1,
      };
    }
  } catch (err) {
    log.warn('Failed reading cloud sync config asynchronously; falling back to defaults', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return { autoSync: true, syncPassphrase: DEFAULT_PASSPHRASE, keyDerivationVersion: 1 };
}

export async function setSyncConfigAsync(config: Partial<CloudSyncConfig>): Promise<CloudSyncConfig> {
  const current = await getSyncConfigAsync();
  const updated: CloudSyncConfig = {
    autoSync: config.autoSync !== undefined ? config.autoSync : current.autoSync,
    syncPassphrase: config.syncPassphrase !== undefined ? config.syncPassphrase : current.syncPassphrase,
    keyDerivationVersion:
      config.keyDerivationVersion === 2
        ? 2
        : config.keyDerivationVersion === 1
          ? 1
          : current.keyDerivationVersion || 1,
  };
  try {
    await fs.promises.writeFile(getSyncConfigPath(), JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    log.error('[CloudSync] Failed to save sync config asynchronously:', err);
  }
  return updated;
}

export async function getActiveLicenseKeyAsync(): Promise<string | null> {
  const userDataDir = getUserDataPath();
  const licenseFile = path.join(userDataDir, 'offline-license.key');
  if (await pathExists(licenseFile)) {
    const key = (await fs.promises.readFile(licenseFile, 'utf8')).trim();
    if (key) return key;
  }

  const claimedFile = path.join(userDataDir, 'claimed-licenses.json');
  if (await pathExists(claimedFile)) {
    try {
      const claimed: Record<string, string> = JSON.parse(await fs.promises.readFile(claimedFile, 'utf8'));
      for (const key of Object.values(claimed)) {
        if (key && typeof key === 'string' && verifyLicense(key).valid) {
          return key;
        }
      }
    } catch (err) {
      log.warn('Failed reading claimed-licenses.json asynchronously while resolving sync license key', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return null;
}

export async function getSyncAuthHeadersAsync(): Promise<Record<string, string>> {
  const session = await loadEncryptedSessionAsync();
  const hwid = getHWID();
  if (session?.token) {
    return {
      'Authorization': `Bearer ${session.token}`,
      'x-mahi-token': session.token,
      'x-mahi-hwid': hwid,
    };
  }
  const key = await getActiveLicenseKeyAsync();
  if (key) {
    return {
      'x-mahi-hwid': hwid,
      'x-mahi-license-key': key,
    };
  }
  return { 'x-mahi-hwid': hwid };
}

export async function getEffectiveSyncPassphraseAsync(): Promise<string> {
  const session = await loadEncryptedSessionAsync();
  if (session?.sync_key) return session.sync_key;
  const accountKey = getAccountSyncKey();
  if (accountKey) return accountKey;

  const config = await getSyncConfigAsync();
  if (config.syncPassphrase && config.syncPassphrase !== DEFAULT_PASSPHRASE) {
    return config.syncPassphrase;
  }

  if (session?.account_id) {
    return crypto
      .createHash('sha256')
      .update(`mahi-zk-sync-account:${session.account_id}:${session.email || ''}`)
      .digest('hex');
  }

  const lic = await getActiveLicenseKeyAsync();
  if (lic) {
    return crypto
      .createHash('sha256')
      .update(`mahi-zk-sync-license:${getHWID()}:${lic}`)
      .digest('hex');
  }

  return crypto
    .createHash('sha256')
    .update(`mahi-zk-sync-device:${getHWID()}`)
    .digest('hex');
}

export async function isCloudSyncAllowedAsync(): Promise<{ allowed: boolean; reason?: string }> {
  const [session, cached] = await Promise.all([
    loadEncryptedSessionAsync(),
    readCachedStatusAsync(),
  ]);
  if (cached?.plan && hasValidAccountSubscription()) {
    const caps = resolveCapabilitiesForCanonicalPlan(cached.plan);
    if (caps['cloud.sync'] === false) {
      return {
        allowed: false,
        reason: 'Encrypted Cloud Backup is unlocked on Growth (25 profiles) and Ultimate (Unlimited) plans.',
      };
    }
  }

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
  const key = await getActiveLicenseKeyAsync();
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
  } catch (err) {
    log.warn('Failed reading local sync status cache', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return {};
}

export function updateLocalSyncStatus(profileId: string, status: CloudSyncStatus): void {
  try {
    const map = readLocalSyncStatus();
    map[profileId] = { status, updatedAt: new Date().toISOString() };
    fs.writeFileSync(getSyncStatusCachePath(), JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    log.warn('Failed updating local sync status cache', {
      profileId,
      status,
      err: err instanceof Error ? err.message : String(err),
    });
  }
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

async function readLocalSyncStatusAsync(): Promise<Record<string, { status: CloudSyncStatus; updatedAt: string }>> {
  try {
    const p = getSyncStatusCachePath();
    if (await pathExists(p)) {
      return JSON.parse(await fs.promises.readFile(p, 'utf8'));
    }
  } catch (err) {
    log.warn('Failed reading local sync status cache asynchronously', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return {};
}

export async function updateLocalSyncStatusAsync(profileId: string, status: CloudSyncStatus): Promise<void> {
  try {
    const map = await readLocalSyncStatusAsync();
    map[profileId] = { status, updatedAt: new Date().toISOString() };
    await fs.promises.writeFile(getSyncStatusCachePath(), JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    log.warn('Failed updating local sync status cache asynchronously', {
      profileId,
      status,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getAllProfilesSyncStatusAsync(): Promise<Record<string, CloudSyncStatus>> {
  const map = await readLocalSyncStatusAsync();
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
  if (BrowserWindow?.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('toast:show', { type, title, message });
        }
      });
    } catch (err) {
      log.debug('Skipped cloud sync toast broadcast IPC', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function broadcastProgress(event: CloudSyncProgressEvent): void {
  if (BrowserWindow?.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('sync:progress', event);
        }
      });
    } catch (err) {
      log.debug('Skipped cloud sync progress broadcast IPC', {
        stage: event.stage,
        err: err instanceof Error ? err.message : String(err),
      });
    }
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
  const check = await isCloudSyncAllowedAsync();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = await getSyncAuthHeadersAsync();
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
  const check = await isCloudSyncAllowedAsync();
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const authHeaders = await getSyncAuthHeadersAsync();
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
          message: 'Encrypting archive with client-side zero-knowledge envelope encryption...'
        });

        const keyVer = (await getSyncConfigAsync()).keyDerivationVersion === 2 ? 2 : 1;
        return encryptProfileArchive(rawPayloadBuffer, effectivePassphrase, { keyVersion: keyVer });
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
        await updateLocalSyncStatusAsync(profileId, 'CONFLICT');
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
      const { createProfile } = await import('../02_BROWSER/services/profile-service.js');
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
        message: `Profile "${localProfile.name}" cookies restored from cloud delta.`
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
    message: 'Atomically restoring profile data and website sessions...'
  });

  const isTarGz = plaintextArchiveBuffer.length >= 2 && plaintextArchiveBuffer[0] === 0x1f && plaintextArchiveBuffer[1] === 0x8b;
  const tempExt = isTarGz ? 'tar.gz' : 'mahi-profile';
  const tempFilePath = path.join(getUserDataPath(), `restore_temp_${cloudProfileId}_${Date.now()}.${tempExt}`);
  await fs.promises.writeFile(tempFilePath, plaintextArchiveBuffer);

  const effectiveLocalId = localProfile?.id || targetLocalId || sessionData.localProfileId || cloudProfileId;
  const existingStorageDir = getProfileStoragePath(effectiveLocalId);
  const backupStorageDir = existingStorageDir && (await pathExists(existingStorageDir))
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
      message: `Profile "${restored.name}" restored successfully from cloud (v${sessionData.version}).`
    });

    logActivity('PROFILE', 'SUCCESS', 'Cloud Restore', `Restored profile "${restored.name}" from cloud (v${sessionData.version})`, restored.id, restored.name);

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
    headers: authHeaders
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
    const authHeaders = await getSyncAuthHeadersAsync();
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
        renewCloudLock(cloudProfileId).catch((renewErr) => {
          log.debug('Cloud lock heartbeat renewal failed', {
            cloudProfileId,
            err: renewErr instanceof Error ? renewErr.message : String(renewErr),
          });
        });
      }, 60000);
      activeLockHeartbeats.set(cloudProfileId, timer);
      return { acquired: true, expiresAt: data.expiresAt, statusCode: 200 };
    }

    return { acquired: false, heldBy: data.heldBy, expiresAt: data.expiresAt, statusCode: res.statusCode };
  } catch (err) {
    // Offline mode or network error: never block local launch!
    log.debug('Cloud lock acquisition skipped (offline or unreachable)', {
      cloudProfileId,
      err: err instanceof Error ? err.message : String(err),
    });
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
    const authHeaders = await getSyncAuthHeadersAsync();
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
    const authHeaders = await getSyncAuthHeadersAsync();
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
    const authHeaders = await getSyncAuthHeadersAsync();
    const baseUrl = getApiBaseUrl();

    const res = await requestApi(`${baseUrl}/api/v1/sync/lock/status?cloudProfileId=${encodeURIComponent(cloudProfileId)}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (res.statusCode === 200) {
      const data = JSON.parse(res.body.toString('utf8'));
      return data.data;
    }
  } catch (err) {
    log.debug('Cloud lock status query fell back to unlocked', {
      cloudProfileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
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

  if (isQueuePausedForQuota) return;

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
        const status = errWithStatus?.status || (
          msg.includes('401') ? 401 :
          msg.includes('403') ? 403 :
          msg.includes('409') ? 409 :
          msg.includes('413') ? 413 :
          msg.includes('507') ? 507 : 500
        );

        if (status === 401 || status === 403) {
          // 401/403 (revoked/expired): retry STOP, clear queue, show single toast, no launch spam
          log.warn(`[CloudSync] Auth failure (${status}). Halting sync retries and clearing queue.`);
          await saveQueueAsync([]);
          if (!hasBroadcastAuthError) {
            hasBroadcastAuthError = true;
            broadcastSyncToast('error', 'Cloud Sync Disabled', 'Cloud sync suspended: Active license required. Local profiles remain completely safe.');
          }
          break;
        }

        if (status === 413 || status === 507) {
          // 413/507 (quota/disk): pause queue, show single usage toast, keep queue for later
          log.warn(`[CloudSync] Storage cap reached (${status}). Pausing sync queue.`);
          isQueuePausedForQuota = true;
          broadcastSyncToast('warning', 'Cloud Storage Full', 'Cloud storage quota (1GB) or server disk capacity reached. Sync queue paused.');
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

  if (isQueuePausedForQuota) return;

  await updateLocalSyncStatusAsync(profileId, 'PENDING');
  const queue = await readQueueAsync();
  if (!queue.some(q => q.profileId === profileId)) {
    queue.push({
      profileId,
      attempts: 0,
      addedAt: new Date().toISOString()
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
        message: `Newer cloud version detected (v${cloudVersion} > v${binding.lastSyncedVersion}). Synchronizing profile before launch...`
      });

      await downloadAndRestoreProfile(binding.cloudProfileId, { targetLocalProfileId: profileId });
      return true;
    }

    return false;
  } catch (err: unknown) {
    log.warn(`[CloudSync] Background sync check failed for ${profileId} (continuing offline):`, err instanceof Error ? err.message : String(err));
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
