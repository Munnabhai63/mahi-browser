import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getHWID, resolveOfflineLicenseKey, resolveOfflineLicenseKeyAsync } from '../license-service.js';
import { ADMIN_API_BASE_URL, isOnlineRevoked, isGraceExpired } from '../license-status-service.js';
import { hasValidLicense } from '../freemium-guard.js';
import {
  hasValidAccountSubscription,
  getAccountSyncKey,
  loadEncryptedSession,
  loadEncryptedSessionAsync,
  readCachedStatus,
  readCachedStatusAsync,
} from '../account-service.js';
import { resolveCapabilitiesForCanonicalPlan } from '../../07_BACKEND/commercial/canonical-plan-catalog.js';
import type { CloudSyncConfig } from '../../10_CONFIG/shared/types/sync.js';
import { getWritableUserDataDir } from '../../07_BACKEND/utils/runtime-paths.js';
import { cleanUrl, getSiteConfig } from '../../10_CONFIG/shared/site-config.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';

export const log = createLogger('cloud-sync-service');

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export const MAX_PROFILE_BYTES = 200 * 1024 * 1024; // 200MB
export const MAX_USER_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB
export const DEFAULT_PASSPHRASE = 'mahi-cloud-sync';

export function getApiBaseUrl(): string {
  return (
    cleanUrl(process.env.COMMERCIAL_API_URL, '') ||
    getSiteConfig({ productionFallback: true }).apiUrl ||
    ADMIN_API_BASE_URL
  );
}

export function getUserDataPath(): string {
  return getWritableUserDataDir();
}

export function getSyncConfigPath(): string {
  return path.join(getUserDataPath(), 'cloud-sync-config.json');
}

export function getSyncQueuePath(): string {
  return path.join(getUserDataPath(), 'sync-queue.json');
}

export function getSyncStatusCachePath(): string {
  return path.join(getUserDataPath(), 'cloud-sync-status.json');
}

export function getSyncBindingsPath(): string {
  return path.join(getUserDataPath(), 'cloud-profile-bindings.json');
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
  return resolveOfflineLicenseKey(getUserDataPath(), { requireValidOfflineKey: false });
}

export function getSyncAuthHeaders(): Record<string, string> {
  const session = loadEncryptedSession();
  const hwid = getHWID();
  if (session?.token) {
    return {
      Authorization: `Bearer ${session.token}`,
      'x-mahi-token': session.token,
      'x-mahi-hwid': hwid,
    };
  }
  const key = getActiveLicenseKey();
  if (key) {
    return {
      'x-mahi-hwid': hwid,
      'x-mahi-license-key': key,
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
    return {
      allowed: false,
      reason: 'License verification grace period expired. Please connect to internet to verify license.',
    };
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
  return resolveOfflineLicenseKeyAsync(getUserDataPath(), { requireValidOfflineKey: false });
}

export async function getSyncAuthHeadersAsync(): Promise<Record<string, string>> {
  const session = await loadEncryptedSessionAsync();
  const hwid = getHWID();
  if (session?.token) {
    return {
      Authorization: `Bearer ${session.token}`,
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
  const [session, cached] = await Promise.all([loadEncryptedSessionAsync(), readCachedStatusAsync()]);
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
    return {
      allowed: false,
      reason: 'License verification grace period expired. Please connect to internet to verify license.',
    };
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
