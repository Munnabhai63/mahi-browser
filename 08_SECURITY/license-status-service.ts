import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app, BrowserWindow, Notification } from './electron-bridge.js';
import { getHWID, hasValidOfflineLicenseKey, hasValidOfflineLicenseKeyAsync } from './license-service.js';
import { getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';
import { getSiteConfig } from '../10_CONFIG/shared/site-config.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('license-status-service');

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================
export function getLicenseApiBaseUrl(): string {
  return getSiteConfig({ productionFallback: true }).apiUrl;
}

export const ADMIN_API_BASE_URL = getLicenseApiBaseUrl();
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days grace period
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;   // 6 hours check interval
const STARTUP_DELAY_MS = 5000;                   // 5s non-blocking delay on startup
const REQUEST_TIMEOUT_MS = 5000;                 // 5s network timeout

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzYel0Zuz0vYdzszLm2z5
GYRR+UzBtP93VVNaKGmEa81Ga8hQfO2GRAXoCRkwMLUEjByolGP5btsJUndjU6/9
xnHYPzjC+GfUKIAaJvxAz41YfzOfjnMCEt709LyPBoLDwwKo8c0feuo12pYvYWqB
hSMo402RGa2nXrYV6u2PHPk0MWkB4MivQTZ7zq932rzNiXihh8kWjDBkSruNfBnd
GqF3h6MISV3mHoO3AXSwD2PYWKhkljkOp4W/VfypOBXnoU6bKhMthPs/1fAISyH3
dGocQFs1hIUa/8KolAFRcoORmpBdOcVDdcwGvsoE6JIBgHy7kPlFOMJHUcVd7bPT
kQIDAQAB
-----END PUBLIC KEY-----`;

interface StatusCache {
  hwid: string;
  status: 'active' | 'revoked' | 'none';
  expires_at: string | null;
  server_time: number;
  verified_at: number;
  sig: string;
}

// In-memory runtime state
let isRevokedMemory = false;
let checkIntervalTimer: NodeJS.Timeout | null = null;

function getUserDataPath(): string {
  return getWritableUserDataDir();
}

function getCacheFilePath(): string {
  return path.join(getUserDataPath(), 'license-status-cache.json');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and parses the locally cached signed status response asynchronously.
 */
async function readStatusCacheAsync(): Promise<StatusCache | null> {
  try {
    const file = getCacheFilePath();
    if (await pathExists(file)) {
      const content = await fs.promises.readFile(file, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    log.warn('Failed reading license status cache asynchronously', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

async function writeStatusCacheAsync(cache: StatusCache): Promise<void> {
  try {
    const file = getCacheFilePath();
    const dir = path.dirname(file);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(file, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err: unknown) {
    log.error('[LicenseStatusService] Failed to persist status cache asynchronously:', err instanceof Error ? err.message : String(err));
  }
}

async function hasOfflineLicenseKeyAsync(): Promise<boolean> {
  return hasValidOfflineLicenseKeyAsync(getUserDataPath());
}

async function getEarliestOfflineLicenseMtimeAsync(): Promise<number | null> {
  try {
    const userDataDir = getUserDataPath();
    const candidates = [
      path.join(userDataDir, 'offline-license.key'),
      path.join(userDataDir, 'claimed-licenses.json'),
    ];
    let earliest: number | null = null;
    for (const file of candidates) {
      if (await pathExists(file)) {
        const stat = await fs.promises.stat(file);
        const ts = stat.birthtimeMs && stat.birthtimeMs > 0 ? Math.min(stat.birthtimeMs, stat.mtimeMs) : stat.mtimeMs;
        if (earliest === null || ts < earliest) earliest = ts;
      }
    }
    return earliest;
  } catch {
    return null;
  }
}

async function isGraceExpiredAsync(): Promise<boolean> {
  if (!(await hasOfflineLicenseKeyAsync())) return false;
  const cache = await readStatusCacheAsync();
  if (cache) {
    if (!verifyStatusSignature(cache, cache.sig)) {
      return true;
    }
    if (!cache.verified_at || cache.verified_at > Date.now() + 3600_000) {
      return true;
    }
    const anchorTime = cache.server_time && cache.server_time < cache.verified_at ? cache.server_time : cache.verified_at;
    return (Date.now() - anchorTime) > GRACE_PERIOD_MS;
  }
  const earliestMtime = await getEarliestOfflineLicenseMtimeAsync();
  if (earliestMtime !== null && (Date.now() - earliestMtime) > GRACE_PERIOD_MS) {
    return true;
  }
  return false;
}

/**
 * Reads and parses the locally cached signed status response.
 * // sync-compat-bootstrap: synchronous getter preserved for freemium-guard & sync tests; async paths use readStatusCacheAsync
 */
export function readStatusCache(): StatusCache | null {
  try {
    const file = getCacheFilePath();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    log.warn('Failed reading license status cache', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

/**
 * Returns true if the device currently possesses an offline RSA license.
 */
export function hasOfflineLicenseKey(): boolean {
  return hasValidOfflineLicenseKey(getUserDataPath());
}

/**
 * Verifies the RSA-SHA256 signature over the canonical status string.
 */
export function verifyStatusSignature(
  data: { hwid: string; status: string; expires_at: string | null; server_time: number },
  sig: string,
  publicKey: string = PUBLIC_KEY
): boolean {
  try {
    if (!sig) return false;
    const canonical = `${data.hwid}:${data.status}:${data.expires_at || ''}:${data.server_time}`;
    const verify = crypto.createVerify('SHA256');
    verify.update(canonical);
    verify.end();
    return verify.verify(publicKey, sig, 'base64');
  } catch {
    return false;
  }
}

function getEarliestOfflineLicenseMtime(): number | null {
  try {
    const userDataDir = getUserDataPath();
    const candidates = [
      path.join(userDataDir, 'offline-license.key'),
      path.join(userDataDir, 'claimed-licenses.json'),
    ];
    let earliest: number | null = null;
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        const stat = fs.statSync(file);
        const ts = stat.birthtimeMs && stat.birthtimeMs > 0 ? Math.min(stat.birthtimeMs, stat.mtimeMs) : stat.mtimeMs;
        if (earliest === null || ts < earliest) earliest = ts;
      }
    }
    return earliest;
  } catch {
    return null;
  }
}

/**
 * Checks whether the license is currently flagged as revoked.
 */
export function isOnlineRevoked(): boolean {
  if (isRevokedMemory) return true;
  const cache = readStatusCache();
  if (cache && cache.status === 'revoked' && verifyStatusSignature(cache, cache.sig)) {
    isRevokedMemory = true;
    return true;
  }
  return false;
}

/**
 * Checks whether the offline grace period has exceeded 7 days.
 * Fails closed when cached status fails RSA signature verification or has been deleted past license activation window.
 */
export function isGraceExpired(): boolean {
  if (!hasOfflineLicenseKey()) return false;
  const cache = readStatusCache();
  if (cache) {
    if (!verifyStatusSignature(cache, cache.sig)) {
      return true;
    }
    if (!cache.verified_at || cache.verified_at > Date.now() + 3600_000) {
      return true;
    }
    const anchorTime = cache.server_time && cache.server_time < cache.verified_at ? cache.server_time : cache.verified_at;
    return (Date.now() - anchorTime) > GRACE_PERIOD_MS;
  }
  // Cache deleted or never populated: bind initial offline grace to key file creation/modification timestamp
  const earliestMtime = getEarliestOfflineLicenseMtime();
  if (earliestMtime !== null && (Date.now() - earliestMtime) > GRACE_PERIOD_MS) {
    return true;
  }
  return false;
}

/**
 * Returns user-facing summary information for display in the UI.
 */
export function getOnlineStatusSummary(): {
  verified: boolean;
  revoked: boolean;
  graceExpired: boolean;
  offlineDaysLeft: number;
  statusText: string;
} {
  const isRevoked = isOnlineRevoked();
  const graceExpired = isGraceExpired();
  const cache = readStatusCache();

  if (isRevoked) {
    return {
      verified: false,
      revoked: true,
      graceExpired: false,
      offlineDaysLeft: 0,
      statusText: 'Revoked (License cancelled)'
    };
  }

  if (graceExpired) {
    return {
      verified: false,
      revoked: false,
      graceExpired: true,
      offlineDaysLeft: 0,
      statusText: 'Offline Grace Expired (Please connect to internet)'
    };
  }

  if (cache?.verified_at) {
    const elapsed = Date.now() - cache.verified_at;
    const remainingMs = Math.max(0, GRACE_PERIOD_MS - elapsed);
    const daysLeft = Math.ceil(remainingMs / (24 * 3600 * 1000));

    if (elapsed < 24 * 3600 * 1000) {
      return {
        verified: true,
        revoked: false,
        graceExpired: false,
        offlineDaysLeft: daysLeft,
        statusText: 'Verified ✓'
      };
    }

    return {
      verified: true,
      revoked: false,
      graceExpired: false,
      offlineDaysLeft: daysLeft,
      statusText: `Offline — ${daysLeft} days left`
    };
  }

  return {
    verified: false,
    revoked: false,
    graceExpired: false,
    offlineDaysLeft: 7,
    statusText: 'Offline — 7 days left'
  };
}

/**
 * Broadcasts status change to all renderer windows and sends system toast.
 */
function broadcastNotification(title: string, message: string, type: 'error' | 'warning' | 'info' | 'success') {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('license:statusToast', { title, message, type });
        win.webContents.send('license:statusChanged', getOnlineStatusSummary());
      }
    }

    // Native desktop toast notification
    if (Notification.isSupported()) {
      new Notification({ title, body: message }).show();
    }
  } catch (err: unknown) {
    log.error('[LicenseStatusService] Broadcast error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Core validation routine: queries admin server, validates RSA signature,
 * enforces anti-rollback, handles revocation, and manages grace caching.
 */
export async function checkLicenseStatusOnline(): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  // RULE 6: Free users make ZERO network calls
  if (!(await hasOfflineLicenseKeyAsync())) {
    return { success: true, status: 'free_no_call' };
  }

  const hwid = getHWID();
  const url = `${ADMIN_API_BASE_URL}/v1/license/status?hwid=${encodeURIComponent(hwid)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': `MAHI-BROWSER/${app.getVersion()}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      log.warn(`[LicenseStatusService] Server responded with HTTP ${res.status}`);
      return { success: false, error: `HTTP ${res.status}` };
    }

    const payload = await res.json();
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Malformed JSON payload' };
    }

    const { status, expires_at, server_time, sig } = payload;
    if (!status || !server_time || !sig) {
      log.warn('[LicenseStatusService] Incomplete payload fields, ignoring response.');
      return { success: false, error: 'Missing required signature or timestamp fields' };
    }

    // RULE 2: Cryptographic RSA-SHA256 signature verification
    const isAuthentic = verifyStatusSignature({
      hwid,
      status,
      expires_at: expires_at || null,
      server_time
    }, sig);

    if (!isAuthentic) {
      log.warn('[LicenseStatusService] Cryptographic signature INVALID or tampered! Ignoring.');
      return { success: false, error: 'Invalid cryptographic signature' };
    }

    // RULE 5: Anti-rollback protection
    const previousCache = await readStatusCacheAsync();
    if (previousCache?.server_time && server_time < previousCache.server_time - 60000) {
      log.warn('[LicenseStatusService] Anti-rollback check failed: server_time is older than previous verified time. Rejecting.');
      return { success: false, error: 'Anti-rollback check failed' };
    }

    // Persist verified cache
    const newCache: StatusCache = {
      hwid,
      status,
      expires_at: expires_at || null,
      server_time,
      verified_at: Date.now(),
      sig
    };
    await writeStatusCacheAsync(newCache);

    // RULE 3: Revocation enforcement
    if (status === 'revoked') {
      isRevokedMemory = true;
      broadcastNotification(
        'MAHI BROWSER',
        'License revoked. Support se contact karein.',
        'error'
      );
      return { success: true, status: 'revoked' };
    }

    // RULE 4: Auto-heal if previously downgraded
    if (status === 'active') {
      if (isRevokedMemory) {
        isRevokedMemory = false;
        broadcastNotification(
          'MAHI BROWSER',
          'License verified & restored to PRO.',
          'success'
        );
      }
      return { success: true, status: 'active' };
    }

    return { success: true, status };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn('[LicenseStatusService] Online check failed (offline or unreachable):', errMsg);

    // Check if grace period is expired while offline
    if (await isGraceExpiredAsync()) {
      broadcastNotification(
        'MAHI BROWSER',
        'Internet se connect karein — license verify ke liye',
        'warning'
      );
    }

    return { success: false, error: errMsg };
  }
}

/**
 * Initializes the background online status checking service.
 */
export function startLicenseStatusService(): void {
  // Clear any existing interval
  if (checkIntervalTimer) {
    clearInterval(checkIntervalTimer);
    checkIntervalTimer = null;
  }

  // 1. Startup check: non-blocking delay (5s)
  setTimeout(() => {
    checkLicenseStatusOnline().catch((err) => {
      log.debug('Startup online license check failed cleanly', {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, STARTUP_DELAY_MS);

  // 2. Periodic check: every 6 hours
  checkIntervalTimer = setInterval(() => {
    checkLicenseStatusOnline().catch((err) => {
      log.debug('Periodic online license check failed cleanly', {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, CHECK_INTERVAL_MS);
}
