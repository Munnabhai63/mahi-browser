import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app, BrowserWindow, Notification } from 'electron';
import { getHWID, verifyLicense } from './license-service.js';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================
export const ADMIN_API_BASE_URL = process.env.MAHI_ADMIN_URL || 'https://admin.mahibrowser.com';
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

function getCacheFilePath(): string {
  return path.join(getUserDataPath(), 'license-status-cache.json');
}

/**
 * Reads and parses the locally cached signed status response.
 */
export function readStatusCache(): StatusCache | null {
  try {
    const file = getCacheFilePath();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      return JSON.parse(content);
    }
  } catch {}
  return null;
}

function writeStatusCache(cache: StatusCache): void {
  try {
    const file = getCacheFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err: any) {
    console.error('[LicenseStatusService] Failed to persist status cache:', err?.message);
  }
}

/**
 * Returns true if the device currently possesses an offline RSA license.
 */
export function hasOfflineLicenseKey(): boolean {
  try {
    const userDataDir = getUserDataPath();
    const licenseFile = path.join(userDataDir, 'offline-license.key');
    if (fs.existsSync(licenseFile)) {
      const rawKey = fs.readFileSync(licenseFile, 'utf8').trim();
      if (rawKey) {
        const check = verifyLicense(rawKey);
        if (check.valid) return true;
      }
    }

    const claimedFile = path.join(userDataDir, 'claimed-licenses.json');
    if (fs.existsSync(claimedFile)) {
      const claimed = JSON.parse(fs.readFileSync(claimedFile, 'utf8'));
      for (const k of Object.values(claimed)) {
        if (k && typeof k === 'string') {
          const check = verifyLicense(k.trim());
          if (check.valid) return true;
        }
      }
    }
  } catch {}
  return false;
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

/**
 * Checks whether the license is currently flagged as revoked.
 */
export function isOnlineRevoked(): boolean {
  if (isRevokedMemory) return true;
  const cache = readStatusCache();
  if (cache && cache.status === 'revoked') {
    isRevokedMemory = true;
    return true;
  }
  return false;
}

/**
 * Checks whether the offline grace period has exceeded 7 days.
 */
export function isGraceExpired(): boolean {
  if (!hasOfflineLicenseKey()) return false;
  const cache = readStatusCache();
  if (!cache || !cache.verified_at) {
    // If no verified check has ever run, allow initial grace
    return false;
  }
  return (Date.now() - cache.verified_at) > GRACE_PERIOD_MS;
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
      statusText: 'Revoked (लाइसेंस रद्द है)'
    };
  }

  if (graceExpired) {
    return {
      verified: false,
      revoked: false,
      graceExpired: true,
      offlineDaysLeft: 0,
      statusText: 'Offline Grace Expired (इंटरनेट कनेक्ट करें)'
    };
  }

  if (cache && cache.verified_at) {
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
  } catch (err: any) {
    console.error('[LicenseStatusService] Broadcast error:', err?.message);
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
  if (!hasOfflineLicenseKey()) {
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
      console.warn(`[LicenseStatusService] Server responded with HTTP ${res.status}`);
      return { success: false, error: `HTTP ${res.status}` };
    }

    const payload = await res.json();
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Malformed JSON payload' };
    }

    const { status, expires_at, server_time, sig } = payload;
    if (!status || !server_time || !sig) {
      console.warn('[LicenseStatusService] Incomplete payload fields, ignoring response.');
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
      console.warn('[LicenseStatusService] Cryptographic signature INVALID or tampered! Ignoring.');
      return { success: false, error: 'Invalid cryptographic signature' };
    }

    // RULE 5: Anti-rollback protection
    const previousCache = readStatusCache();
    if (previousCache && previousCache.server_time && server_time < previousCache.server_time - 60000) {
      console.warn('[LicenseStatusService] Anti-rollback check failed: server_time is older than previous verified time. Rejecting.');
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
    writeStatusCache(newCache);

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
  } catch (err: any) {
    console.warn('[LicenseStatusService] Online check failed (offline or unreachable):', err?.message);

    // Check if grace period is expired while offline
    if (isGraceExpired()) {
      broadcastNotification(
        'MAHI BROWSER',
        'Internet se connect karein — license verify ke liye',
        'warning'
      );
    }

    return { success: false, error: err?.message };
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
    checkLicenseStatusOnline().catch(() => {});
  }, STARTUP_DELAY_MS);

  // 2. Periodic check: every 6 hours
  checkIntervalTimer = setInterval(() => {
    checkLicenseStatusOnline().catch(() => {});
  }, CHECK_INTERVAL_MS);
}
