import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { app, BrowserWindow, safeStorage } from 'electron';
import { getHWID } from './license-service.js';
import { ADMIN_API_BASE_URL } from './license-status-service.js';

// ============================================================================
// CONSTANTS & PUBLIC KEY FOR SIGNATURE VERIFICATION
// ============================================================================
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

export interface AccountSession {
  token: string;
  account_id: string;
  email: string;
  sync_key: string | null;
  saved_at: string;
}

export interface CachedAccountStatus {
  account_id: string;
  hwid: string;
  plan: 'free' | 'trial' | 'pro';
  profile_limit: number;
  sync_allowed: boolean;
  expires_at: string | null;
  server_time: number;
  verified_at: number;
  sig: string;
}

export interface PaymentInfo {
  upi_id: string;
  price_inr: number;
  price_usdt: number;
  usdt_address: string;
  usdt_network: string;
  whatsapp_number: string;
}

// In-memory runtime state
let currentSession: AccountSession | null = null;
let statusCheckTimer: NodeJS.Timeout | null = null;

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

export const ACCOUNT_SERVICE_MODULE = 'account-service';
console.log('[account-service] Account & subscription module initialized');

function getSessionFilePath(): string {
  return path.join(getUserDataPath(), 'account-session.enc');
}

function getStatusCacheFilePath(): string {
  return path.join(getUserDataPath(), 'account-status-cache.enc');
}

// ============================================================================
// ENCRYPTED STORAGE HELPERS (safeStorage / AES-256-GCM fallback)
// ============================================================================
function encryptPayload(plainText: string): Buffer {
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(plainText);
    }
  } catch (err: any) {
    console.warn('[AccountService] safeStorage failed, using machine AES fallback:', err?.message);
  }

  // Fallback: AES-256-GCM keyed by hardware ID (never plaintext on disk)
  const key = crypto.createHash('sha256').update(getHWID() + 'mahi-account-enc-2026').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('AESGCM:'), iv, tag, ciphertext]);
}

function decryptPayload(rawBuffer: Buffer): string | null {
  // Try safeStorage first
  if (safeStorage && safeStorage.isEncryptionAvailable() && !rawBuffer.subarray(0, 7).equals(Buffer.from('AESGCM:'))) {
    try {
      return safeStorage.decryptString(rawBuffer);
    } catch {}
  }

  // Try AES-GCM fallback
  if (rawBuffer.subarray(0, 7).equals(Buffer.from('AESGCM:'))) {
    try {
      const iv = rawBuffer.subarray(7, 19);
      const tag = rawBuffer.subarray(19, 35);
      const ciphertext = rawBuffer.subarray(35);
      const key = crypto.createHash('sha256').update(getHWID() + 'mahi-account-enc-2026').digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {}
  }

  return null;
}

export function saveEncryptedSession(session: AccountSession): void {
  currentSession = session;
  const jsonStr = JSON.stringify(session);
  const filePath = getSessionFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    const encrypted = encryptPayload(jsonStr);
    fs.writeFileSync(filePath, encrypted);
  } catch (err: any) {
    console.error('[AccountService] Failed to persist encrypted session:', err?.message);
  }
}

export function loadEncryptedSession(): AccountSession | null {
  if (currentSession) return currentSession;

  const filePath = getSessionFilePath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const rawBuffer = fs.readFileSync(filePath);
    const decryptedStr = decryptPayload(rawBuffer);
    if (decryptedStr) {
      currentSession = JSON.parse(decryptedStr);
      return currentSession;
    }
  } catch (err: any) {
    console.error('[AccountService] Failed to decrypt session file:', err?.message);
  }

  return null;
}

export function clearEncryptedSession(): void {
  currentSession = null;
  const filePath = getSessionFilePath();
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  const cachePath = getStatusCacheFilePath();
  if (fs.existsSync(cachePath)) {
    try { fs.unlinkSync(cachePath); } catch {}
  }
  const legacyCachePath = path.join(getUserDataPath(), 'account-status-cache.json');
  if (fs.existsSync(legacyCachePath)) {
    try { fs.unlinkSync(legacyCachePath); } catch {}
  }
}

// ============================================================================
// SIGNED STATUS CACHE & RSA VERIFICATION (Always Encrypted on Disk)
// ============================================================================
export function readCachedStatus(): CachedAccountStatus | null {
  try {
    // Delete legacy plaintext json cache if present
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch {}
    }

    const p = getStatusCacheFilePath();
    if (fs.existsSync(p)) {
      const rawBuffer = fs.readFileSync(p);
      const decryptedStr = decryptPayload(rawBuffer);
      if (decryptedStr) {
        return JSON.parse(decryptedStr);
      }
    }
  } catch {}
  return null;
}

export function writeCachedStatus(status: CachedAccountStatus): void {
  try {
    // Delete legacy plaintext json cache if present
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch {}
    }

    const p = getStatusCacheFilePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const jsonStr = JSON.stringify(status);
    const encrypted = encryptPayload(jsonStr);
    fs.writeFileSync(p, encrypted);
  } catch (err: any) {
    console.error('[AccountService] Failed to write encrypted status cache:', err?.message);
  }
}

export function verifyAccountStatusSignature(
  data: {
    account_id: string;
    hwid: string;
    plan: string;
    profile_limit: number;
    sync_allowed: boolean;
    expires_at: string | null;
    server_time: number;
  },
  sig: string
): boolean {
  try {
    if (!sig) return false;
    const canonical = `${data.account_id}:${data.hwid}:${data.plan}:${data.profile_limit}:${data.sync_allowed ? 1 : 0}:${data.expires_at || ''}:${data.server_time}`;
    const verify = crypto.createVerify('SHA256');
    verify.update(canonical);
    verify.end();
    return verify.verify(PUBLIC_KEY, sig, 'base64');
  } catch {
    return false;
  }
}

// ============================================================================
// HTTP NETWORK HELPER
// ============================================================================
function makeRequest(urlStr: string, options: https.RequestOptions, bodyData?: any): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.request(urlStr, options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let parsedBody = data;
        try { parsedBody = JSON.parse(data); } catch {}
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsedBody
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Network request timed out'));
    });

    if (bodyData) {
      const payload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

// ============================================================================
// ACCOUNT CLIENT APIS
// ============================================================================
export async function signup(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const hwid = getHWID();
  const res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/signup`, {
    method: 'POST'
  }, { email, password, hwid });

  if (res.statusCode !== 201) {
    const errMsg = res.body?.error || `Signup failed (HTTP ${res.statusCode})`;
    throw new Error(errMsg);
  }

  const { token, user } = res.body;
  if (!token) throw new Error('Missing session token in signup response');

  saveEncryptedSession({
    token,
    account_id: user.id,
    email: user.email,
    sync_key: null, // will be updated upon getStatus
    saved_at: new Date().toISOString()
  });

  // Fetch initial signed status & sync_key
  try {
    await fetchAndCacheStatus();
  } catch {}

  return { success: true, token, user };
}

export async function login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const hwid = getHWID();
  const res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/login`, {
    method: 'POST'
  }, { email, password, hwid });

  if (res.statusCode !== 200) {
    const errMsg = res.body?.error || `Login failed (HTTP ${res.statusCode})`;
    const err: any = new Error(errMsg);
    err.status = res.statusCode;
    err.device_limit = res.body?.device_ok === false;
    throw err;
  }

  const { token, user } = res.body;
  saveEncryptedSession({
    token,
    account_id: user.id,
    email: user.email,
    sync_key: null,
    saved_at: new Date().toISOString()
  });

  try {
    await fetchAndCacheStatus();
  } catch {}

  return { success: true, token, user };
}

export async function logout(): Promise<{ success: boolean }> {
  const session = loadEncryptedSession();
  if (session?.token) {
    try {
      await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/logout`, {
        method: 'POST'
      }, { token: session.token });
    } catch {}
  }
  clearEncryptedSession();
  broadcastAccountChanged();
  return { success: true };
}

export async function switchDevice(): Promise<{ success: boolean; message: string }> {
  const session = loadEncryptedSession();
  if (!session?.token) throw new Error('No active account session');

  const hwid = getHWID();
  const res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/switch-device`, {
    method: 'POST'
  }, { token: session.token, hwid });

  if (res.statusCode !== 200) {
    throw new Error(res.body?.error || `Failed to switch device (HTTP ${res.statusCode})`);
  }

  await fetchAndCacheStatus();
  return { success: true, message: res.body.message || 'Device rebound successfully' };
}

export async function getPaymentInfo(): Promise<PaymentInfo> {
  const res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/payment-info`, { method: 'GET' });
  if (res.statusCode === 200 && res.body) {
    return res.body;
  }
  // Dynamic empty fallback if offline (hydrated from server at runtime)
  return {
    upi_id: '',
    price_inr: 0,
    price_usdt: 0,
    usdt_address: '',
    usdt_network: '',
    whatsapp_number: ''
  };
}

// ============================================================================
// STATUS CHECK & PLAN RESOLUTION
// ============================================================================
export async function fetchAndCacheStatus(): Promise<CachedAccountStatus | null> {
  const session = loadEncryptedSession();
  if (!session?.token) return null;

  const hwid = getHWID();
  const res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/status?hwid=${encodeURIComponent(hwid)}`, {
    method: 'GET',
    headers: {
      'x-mahi-token': session.token
    }
  });

  if (res.statusCode === 401 || res.statusCode === 403) {
    // Session revoked or device mismatch
    clearEncryptedSession();
    broadcastAccountChanged();
    return null;
  }

  if (res.statusCode !== 200 || !res.body) {
    return readCachedStatus();
  }

  const data = res.body;
  const isSigValid = verifyAccountStatusSignature({
    account_id: data.account_id,
    hwid,
    plan: data.plan,
    profile_limit: data.profile_limit,
    sync_allowed: data.sync_allowed,
    expires_at: data.expires_at,
    server_time: data.server_time
  }, data.sig);

  if (!isSigValid) {
    console.error('[AccountService] Tampered or invalid RSA signature on account status response');
    return readCachedStatus();
  }

  // Update sync_key in session if provided
  if (data.sync_key && session.sync_key !== data.sync_key) {
    session.sync_key = data.sync_key;
    saveEncryptedSession(session);
  }

  const cached: CachedAccountStatus = {
    account_id: data.account_id,
    hwid,
    plan: data.plan,
    profile_limit: data.profile_limit,
    sync_allowed: !!data.sync_allowed,
    expires_at: data.expires_at || null,
    server_time: data.server_time,
    verified_at: Date.now(),
    sig: data.sig
  };

  writeCachedStatus(cached);
  broadcastAccountChanged();
  return cached;
}

export function getAccountSyncKey(): string | null {
  const session = loadEncryptedSession();
  return session?.sync_key || null;
}

export function getAccountAuthHeader(): string | null {
  const session = loadEncryptedSession();
  return session?.token ? `Bearer ${session.token}` : null;
}

export function getAccountSession(): AccountSession | null {
  return loadEncryptedSession();
}

export function getAccountProfileLimit(): number {
  return hasValidAccountSubscription() ? 100 : 15;
}

export function isAccountSyncAllowed(): boolean {
  return hasValidAccountSubscription();
}

/**
 * Returns true if user account has an active trial or pro plan
 * and offline grace period (7 days) has not expired.
 */
export function hasValidAccountSubscription(): boolean {
  const session = loadEncryptedSession();
  if (!session) return false;

  const cached = readCachedStatus();
  if (!cached) return false;

  // Check plan
  if (cached.plan !== 'pro' && cached.plan !== 'trial') {
    return false;
  }

  // Check expiration date
  if (cached.expires_at && new Date(cached.expires_at).getTime() < Date.now()) {
    return false;
  }

  // Check 7-day offline grace period
  if (Date.now() - cached.verified_at > GRACE_PERIOD_MS) {
    return false;
  }

  return true;
}

export function getAccountPlanLimits(): { isPro: boolean; plan: string; maxProfiles: number; expiresAt: string | null } {
  const isPro = hasValidAccountSubscription();
  const cached = readCachedStatus();
  return {
    isPro,
    plan: cached ? cached.plan : 'free',
    maxProfiles: isPro ? 100 : 15,
    expiresAt: cached?.expires_at || null
  };
}

function broadcastAccountChanged(): void {
  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && BrowserWindow.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('account:statusChanged', getAccountPlanLimits());
        }
      });
    } catch {}
  }
}

// ============================================================================
// BACKGROUND SCHEDULER
// ============================================================================
export function startAccountStatusScheduler(): void {
  if (statusCheckTimer) return;

  // Startup 5s non-blocking check
  setTimeout(async () => {
    try {
      await fetchAndCacheStatus();
    } catch (err: any) {
      console.warn('[AccountService] Startup status check offline:', err?.message);
    }
  }, STARTUP_DELAY_MS);

  // Periodic 6h check
  statusCheckTimer = setInterval(async () => {
    try {
      await fetchAndCacheStatus();
    } catch (err: any) {
      console.warn('[AccountService] Periodic status check offline:', err?.message);
    }
  }, CHECK_INTERVAL_MS);
}

export function stopAccountStatusScheduler(): void {
  if (statusCheckTimer) {
    clearInterval(statusCheckTimer);
    statusCheckTimer = null;
  }
}
