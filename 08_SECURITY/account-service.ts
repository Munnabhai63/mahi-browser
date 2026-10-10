import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { app, BrowserWindow, safeStorage } from 'electron';
import { getHWID } from './license-service.js';
import { ADMIN_API_BASE_URL } from './license-status-service.js';
import { CONTACT_CONFIG } from '../10_CONFIG/contact-config.js';

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
  refreshToken?: string;
  account_id: string;
  email: string;
  name?: string;
  role?: string;
  status?: string;
  plan?: string;
  profile_quota?: number;
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
  upi_account_holder?: string;
  upi_qr_asset?: string;
  price_inr: number;
  price_usd?: number;
  price_usdt: number;
  usdt_address: string;
  usdt_network: string;
  usdt_enabled?: boolean;
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
export async function signup(email: string, password: string, name?: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const hwid = getHWID();
  let res: any;
  try {
    // Try primary Central Auth endpoint
    res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST'
    }, { email, password, name, deviceId: hwid });
  } catch {
    // Fallback to legacy endpoint if admin URL routes differently
    res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/signup`, {
      method: 'POST'
    }, { email, password, hwid });
  }

  if (res.statusCode !== 201 && res.statusCode !== 200) {
    const errMsg = res.body?.error || `Signup failed (HTTP ${res.statusCode})`;
    throw new Error(errMsg);
  }

  const token = res.body.token || res.body.tokens?.accessToken;
  const refreshToken = res.body.tokens?.refreshToken || res.body.refreshToken;
  const user = res.body.user;
  if (!token) throw new Error('Missing session token in signup response');

  saveEncryptedSession({
    token,
    refreshToken,
    account_id: user?.id || `usr_${Date.now()}`,
    email: user?.email || email,
    name: user?.name,
    role: user?.role,
    status: user?.status,
    plan: user?.planId || 'free',
    profile_quota: user?.profileQuota || 10,
    sync_key: null,
    saved_at: new Date().toISOString()
  });

  try {
    await fetchAndCacheStatus();
  } catch {}

  return { success: true, token, user };
}

export async function login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const hwid = getHWID();
  let res: any;
  try {
    res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST'
    }, { email, password, deviceId: hwid, deviceName: 'Windows Desktop', platform: process.platform || 'windows' });
  } catch {
    res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/login`, {
      method: 'POST'
    }, { email, password, hwid });
  }

  if (res.statusCode !== 200) {
    const errMsg = res.body?.error || `Login failed (HTTP ${res.statusCode})`;
    const err: any = new Error(errMsg);
    err.status = res.statusCode;
    err.device_limit = res.body?.device_ok === false;
    throw err;
  }

  const token = res.body.token || res.body.tokens?.accessToken;
  const refreshToken = res.body.tokens?.refreshToken || res.body.refreshToken;
  const user = res.body.user;

  saveEncryptedSession({
    token,
    refreshToken,
    account_id: user?.id || `usr_${Date.now()}`,
    email: user?.email || email,
    name: user?.name,
    role: user?.role,
    status: user?.status,
    plan: user?.planId || 'free',
    profile_quota: user?.profileQuota || 10,
    sync_key: null,
    saved_at: new Date().toISOString()
  });

  try {
    await fetchAndCacheStatus();
  } catch {}

  return { success: true, token, user };
}

export async function refreshAccountToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  const session = loadEncryptedSession();
  if (!session?.refreshToken) {
    return { success: false, error: 'No refresh token available' };
  }

  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST'
    }, { refreshToken: session.refreshToken });

    if (res.statusCode === 200 && res.body?.tokens) {
      session.token = res.body.tokens.accessToken;
      if (res.body.tokens.refreshToken) {
        session.refreshToken = res.body.tokens.refreshToken;
      }
      session.saved_at = new Date().toISOString();
      saveEncryptedSession(session);
      return { success: true, token: session.token };
    }
    return { success: false, error: res.body?.error || 'Token refresh failed' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during token refresh' };
  }
}

export async function logout(): Promise<{ success: boolean }> {
  const session = loadEncryptedSession();
  if (session?.token) {
    try {
      await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      }, { token: session.token });
    } catch {}
  }
  clearEncryptedSession();
  broadcastAccountChanged();
  return { success: true };
}

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/verify-email`, {
      method: 'POST'
    }, { token });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: res.body?.error || 'Email verification failed' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during verification' };
  }
}

export async function resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/resend-verification`, {
      method: 'POST'
    }, { email });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: res.body?.error || 'Failed to resend verification' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during resend' };
  }
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST'
    }, { email });
    if (res.statusCode === 200) {
      return { success: true, message: res.body?.message || 'Reset instructions sent.' };
    }
    return { success: false, error: res.body?.error || 'Failed to request password reset' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during password reset request' };
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST'
    }, { token, newPassword });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: res.body?.error || 'Password reset failed' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during password reset' };
  }
}

export async function listActiveSessions(): Promise<{ success: boolean; sessions?: any[]; error?: string }> {
  const session = loadEncryptedSession();
  if (!session?.token) {
    return { success: false, error: 'No active session' };
  }
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });
    if (res.statusCode === 200) {
      return { success: true, sessions: res.body?.data || [] };
    }
    return { success: false, error: res.body?.error || 'Failed to list sessions' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function revokeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const session = loadEncryptedSession();
  if (!session?.token) {
    return { success: false, error: 'No active session' };
  }
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/sessions/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    }, { sessionId });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: res.body?.error || 'Failed to revoke session' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function revokeAllSessions(keepCurrent: boolean = true): Promise<{ success: boolean; error?: string }> {
  const session = loadEncryptedSession();
  if (!session?.token) {
    return { success: false, error: 'No active session' };
  }
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/api/v1/auth/sessions/revoke-all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    }, { keepCurrent });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: res.body?.error || 'Failed to revoke sessions' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
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
  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/payment-info`, { method: 'GET' });
    if (res.statusCode === 200 && res.body) {
      return {
        ...res.body,
        upi_id: res.body.upi_id || CONTACT_CONFIG.UPI_ID,
        upi_account_holder: res.body.upi_account_holder || CONTACT_CONFIG.UPI_ACCOUNT_HOLDER,
        upi_qr_asset: res.body.upi_qr_asset || CONTACT_CONFIG.UPI_QR_ASSET,
        whatsapp_number: res.body.whatsapp_number || CONTACT_CONFIG.WHATSAPP_NUMBER,
        usdt_enabled: res.body.usdt_enabled === true,
      };
    }
  } catch {}
  // Canonical authoritative fallback (never dummy placeholders)
  return {
    upi_id: CONTACT_CONFIG.UPI_ID,
    upi_account_holder: CONTACT_CONFIG.UPI_ACCOUNT_HOLDER,
    upi_qr_asset: CONTACT_CONFIG.UPI_QR_ASSET,
    price_inr: 1499,
    price_usd: 19,
    price_usdt: 0,
    usdt_address: '',
    usdt_network: '',
    usdt_enabled: false,
    whatsapp_number: CONTACT_CONFIG.WHATSAPP_NUMBER
  };
}

export async function submitManualUpiPayment(payload: {
  plan_id: string;
  utr: string;
  proof_asset?: string;
}): Promise<{ success: boolean; payment_id?: string; status?: string; message?: string; error?: string }> {
  const session = loadEncryptedSession();
  if (!session?.token) throw new Error('No active account session');

  const utrClean = (payload.utr || '').trim();
  if (!utrClean || utrClean.length < 6) {
    return { success: false, error: 'Invalid UTR: Transaction reference must be at least 6 characters.' };
  }

  try {
    const res = await makeRequest(`${ADMIN_API_BASE_URL}/v1/account/payments/upi/submit`, {
      method: 'POST',
      headers: {
        'x-mahi-token': session.token,
        'Authorization': `Bearer ${session.token}`,
      }
    }, {
      plan_id: payload.plan_id || 'pro',
      utr: utrClean,
      proof_asset: payload.proof_asset || '',
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return {
        success: true,
        payment_id: res.body?.payment_id,
        status: res.body?.status || 'PENDING_VERIFICATION',
        message: res.body?.message || 'Payment submitted successfully for verification.',
      };
    }

    return {
      success: false,
      error: res.body?.error || `Submission failed (HTTP ${res.statusCode})`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while submitting payment'
    };
  }
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
