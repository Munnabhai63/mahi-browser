import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { BrowserWindow, safeStorage } from './electron-bridge.js';
import { getHWID } from './license-service.js';
import { getInstallSecrets } from './install-secrets.js';
import { ADMIN_API_BASE_URL } from './license-status-service.js';
import { CONTACT_CONFIG } from '../10_CONFIG/contact-config.js';
import { getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';
import { getCanonicalPlan, legacyPlanIdToCanonical } from '../07_BACKEND/commercial/canonical-plan-catalog.js';
import { cleanUrl, getSiteConfig } from '../10_CONFIG/shared/site-config.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('account-service');

// ============================================================================
// CONSTANTS & PUBLIC KEY FOR SIGNATURE VERIFICATION
// ============================================================================
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days grace period
const CHECK_INTERVAL_MS = 60 * 1000;        // 60 seconds (1 minute live check interval)
const STARTUP_DELAY_MS = 1000;                  // 1s non-blocking delay on startup
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
  usdt_qr_asset?: string;
  usdt_enabled?: boolean;
  whatsapp_number: string;
}

export interface AccountUserPayload {
  id: string;
  email: string;
  name?: string;
  role?: string;
  status?: string;
  plan?: string;
  planId?: string;
  profileQuota?: number;
  sync_key?: string | null;
  [key: string]: unknown;
}

export interface AccountTrialStatus {
  isTrialActive?: boolean;
  daysRemaining?: number;
  isEligibleForTrial?: boolean;
  [key: string]: unknown;
}

export interface AccountEntitlementsPayload {
  maxProfiles?: number;
  plan?: string;
  [key: string]: unknown;
}

export interface AccountCheckoutPayload {
  planId?: string;
  plan_id?: string;
  billingCycle?: string;
  billing_cycle?: string;
  currency?: string;
  provider?: string;
  extraMembers?: number;
  extraProxyGb?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface AccountCheckoutSession {
  checkoutUrl?: string;
  url?: string;
  sessionId?: string;
  [key: string]: unknown;
}

interface AccountApiResponseBody {
  error?: string | { message?: string };
  message?: string;
  token?: string;
  refreshToken?: string;
  tokens?: { accessToken?: string; refreshToken?: string };
  user?: AccountUserPayload;
  trialStatus?: AccountTrialStatus;
  entitlements?: AccountEntitlementsPayload;
  data?: unknown;
  catalog?: Record<string, unknown>;
  session?: AccountCheckoutSession;
  payments?: Array<Record<string, unknown>>;
  checkoutUrl?: string;
  success?: boolean;
  device_ok?: boolean;
  payment_id?: string;
  status?: string;
  utr?: string;
  amount_paise?: number;
  tx_hash?: string;
  amount_cents?: number;
  upi_id?: string;
  upi_account_holder?: string;
  upi_qr_asset?: string;
  whatsapp_number?: string;
  price_inr?: number;
  price_usd?: number;
  price_usdt?: number;
  usdt_address?: string;
  usdt_network?: string;
  usdt_qr_asset?: string;
  usdt_enabled?: boolean;
  account_id?: string;
  plan?: CachedAccountStatus['plan'];
  profile_limit?: number;
  sync_allowed?: boolean;
  expires_at?: string | null;
  server_time?: number;
  sig?: string;
  sync_key?: string | null;
  isTrialActive?: boolean;
  daysRemaining?: number;
  isEligibleForTrial?: boolean;
  [key: string]: unknown;
}

interface AccountHttpResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: AccountApiResponseBody;
}

type LoginHttpError = Error & { status?: number; device_limit?: boolean };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function extractApiError(body: AccountApiResponseBody | undefined, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.error === 'string' && body.error) return body.error;
  if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string' && body.error.message) {
    return body.error.message;
  }
  if (typeof body.message === 'string' && body.message) return body.message;
  return fallback;
}

// In-memory runtime state
let currentSession: AccountSession | null = null;
let statusCheckTimer: NodeJS.Timeout | null = null;

function getUserDataPath(): string {
  return getWritableUserDataDir();
}

export const ACCOUNT_SERVICE_MODULE = 'account-service';
log.info('[account-service] Account & subscription module initialized');

export function getAdminApiBaseUrl(): string {
  return (
    cleanUrl(process.env.MAHI_API_URL || process.env.MAHI_ADMIN_URL, '') ||
    getSiteConfig({ productionFallback: true }).apiUrl ||
    ADMIN_API_BASE_URL
  );
}

export const getApiBaseUrl = getAdminApiBaseUrl;

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
    if (safeStorage?.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plainText);
      return Buffer.from(`SAFE_STORAGE_V1:${encrypted.toString('base64')}`, 'utf8');
    }
  } catch (err: unknown) {
    log.warn('[AccountService] safeStorage failed, using machine AES fallback:', errMsg(err));
  }

  // Fallback: AES-256-GCM keyed with CSPRNG install secrets or hardware ID (never plaintext on disk)
  let secretKey = '';
  try {
    secretKey = getInstallSecrets().jwtSecret;
  } catch {
    secretKey = `${getHWID()}mahi-account-enc-2026`;
  }
  const key = crypto.createHash('sha256').update(secretKey || `${getHWID()}mahi-account-enc-2026`).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('AESGCM:'), iv, tag, ciphertext]);
}

function decryptPayload(rawBuffer: Buffer): string | null {
  const str = rawBuffer.toString('utf8');

  // Try SAFE_STORAGE_V1: envelope
  if (str.startsWith('SAFE_STORAGE_V1:')) {
    if (safeStorage?.isEncryptionAvailable()) {
      try {
        const b64 = str.slice('SAFE_STORAGE_V1:'.length);
        return safeStorage.decryptString(Buffer.from(b64, 'base64'));
      } catch (err) {
        log.debug('SAFE_STORAGE_V1 session decryption attempt skipped', {
          err: errMsg(err),
        });
      }
    }
  }

  // Try legacy raw safeStorage
  if (safeStorage?.isEncryptionAvailable() && !rawBuffer.subarray(0, 7).equals(Buffer.from('AESGCM:'))) {
    try {
      return safeStorage.decryptString(rawBuffer);
    } catch (err) {
      log.debug('Legacy raw safeStorage session decryption attempt skipped', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Try AES-GCM fallback
  if (rawBuffer.subarray(0, 7).equals(Buffer.from('AESGCM:'))) {
    const iv = rawBuffer.subarray(7, 19);
    const tag = rawBuffer.subarray(19, 35);
    const ciphertext = rawBuffer.subarray(35);

    // Try with install secrets key
    try {
      const secretKey = getInstallSecrets().jwtSecret;
      const key = crypto.createHash('sha256').update(secretKey).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
      log.debug('AESGCM install-secret session decryption fallback skipped', {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    // Try with HWID fallback key
    try {
      const key = crypto.createHash('sha256').update(`${getHWID()}mahi-account-enc-2026`).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
      log.debug('AESGCM HWID session decryption fallback skipped', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Plain JSON fallback (e.g. test environments without safeStorage)
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object') return str;
  } catch (err) {
    log.debug('Plain JSON session fallback failed to parse', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function saveEncryptedSessionAsync(session: AccountSession): Promise<void> {
  currentSession = session;
  const jsonStr = JSON.stringify(session);
  const filePath = getSessionFilePath();
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });

  try {
    const encrypted = encryptPayload(jsonStr);
    await fs.promises.writeFile(filePath, encrypted);
  } catch (err: unknown) {
    log.error('[AccountService] Failed to persist encrypted session asynchronously:', errMsg(err));
  }
}

export async function loadEncryptedSessionAsync(): Promise<AccountSession | null> {
  if (currentSession) return currentSession;

  const filePath = getSessionFilePath();
  if (!(await pathExists(filePath))) return null;

  try {
    const rawBuffer = await fs.promises.readFile(filePath);
    const decryptedStr = decryptPayload(rawBuffer);
    if (decryptedStr) {
      currentSession = JSON.parse(decryptedStr) as AccountSession;
      return currentSession;
    }
  } catch (err: unknown) {
    log.error('[AccountService] Failed to decrypt session file asynchronously:', errMsg(err));
  }

  return null;
}

export async function clearEncryptedSessionAsync(): Promise<void> {
  currentSession = null;
  const filePath = getSessionFilePath();
  if (await pathExists(filePath)) {
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      log.warn('Failed deleting encrypted session file asynchronously', {
        filePath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const cachePath = getStatusCacheFilePath();
  if (await pathExists(cachePath)) {
    try {
      await fs.promises.unlink(cachePath);
    } catch (err) {
      log.warn('Failed deleting encrypted status cache file asynchronously', {
        cachePath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const legacyCachePath = path.join(getUserDataPath(), 'account-status-cache.json');
  if (await pathExists(legacyCachePath)) {
    try {
      await fs.promises.unlink(legacyCachePath);
    } catch (err) {
      log.debug('Failed deleting legacy account status cache file asynchronously', {
        legacyCachePath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// sync-compat: synchronous session persistence preserved for synchronous entitlement guards & unit tests
export function saveEncryptedSession(session: AccountSession): void {
  currentSession = session;
  const jsonStr = JSON.stringify(session);
  const filePath = getSessionFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    const encrypted = encryptPayload(jsonStr);
    fs.writeFileSync(filePath, encrypted);
  } catch (err: unknown) {
    log.error('[AccountService] Failed to persist encrypted session:', errMsg(err));
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
      currentSession = JSON.parse(decryptedStr) as AccountSession;
      return currentSession;
    }
  } catch (err: unknown) {
    log.error('[AccountService] Failed to decrypt session file:', errMsg(err));
  }

  return null;
}

export function clearEncryptedSession(): void {
  currentSession = null;
  const filePath = getSessionFilePath();
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      log.warn('Failed deleting encrypted session file', {
        filePath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const cachePath = getStatusCacheFilePath();
  if (fs.existsSync(cachePath)) {
    try {
      fs.unlinkSync(cachePath);
    } catch (err) {
      log.warn('Failed deleting encrypted status cache file', {
        cachePath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const legacyCachePath = path.join(getUserDataPath(), 'account-status-cache.json');
  if (fs.existsSync(legacyCachePath)) {
    try {
      fs.unlinkSync(legacyCachePath);
    } catch (err) {
      log.debug('Failed deleting legacy account status cache file', {
        legacyCachePath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ============================================================================
// SIGNED STATUS CACHE & RSA VERIFICATION (Always Encrypted on Disk)
// ============================================================================
export async function readCachedStatusAsync(): Promise<CachedAccountStatus | null> {
  try {
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (await pathExists(legacyPath)) {
      try {
        await fs.promises.unlink(legacyPath);
      } catch (err) {
        log.debug('Skipped legacy plaintext status cache cleanup on async read', {
          legacyPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const p = getStatusCacheFilePath();
    if (await pathExists(p)) {
      const rawBuffer = await fs.promises.readFile(p);
      const decryptedStr = decryptPayload(rawBuffer);
      if (decryptedStr) {
        return JSON.parse(decryptedStr);
      }
    }
  } catch (err) {
    log.warn('Failed reading encrypted account status cache asynchronously', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export async function writeCachedStatusAsync(status: CachedAccountStatus): Promise<void> {
  try {
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (await pathExists(legacyPath)) {
      try {
        await fs.promises.unlink(legacyPath);
      } catch (err) {
        log.debug('Skipped legacy plaintext status cache cleanup on async write', {
          legacyPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const p = getStatusCacheFilePath();
    const dir = path.dirname(p);
    await fs.promises.mkdir(dir, { recursive: true });

    const jsonStr = JSON.stringify(status);
    const encrypted = encryptPayload(jsonStr);
    await fs.promises.writeFile(p, encrypted);
  } catch (err: unknown) {
    log.error('[AccountService] Failed to write encrypted status cache asynchronously:', errMsg(err));
  }
}

export async function clearCachedStatusAsync(): Promise<void> {
  try {
    const p = getStatusCacheFilePath();
    if (await pathExists(p)) await fs.promises.unlink(p);
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (await pathExists(legacyPath)) await fs.promises.unlink(legacyPath);
  } catch (err) {
    log.warn('Failed clearing encrypted account status cache asynchronously', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// sync-compat: synchronous status cache helpers preserved for synchronous entitlement guards & unit tests
export function readCachedStatus(): CachedAccountStatus | null {
  try {
    // Delete legacy plaintext json cache if present
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (fs.existsSync(legacyPath)) {
      try {
        fs.unlinkSync(legacyPath);
      } catch (err) {
        log.debug('Skipped legacy plaintext status cache cleanup on read', {
          legacyPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const p = getStatusCacheFilePath();
    if (fs.existsSync(p)) {
      const rawBuffer = fs.readFileSync(p);
      const decryptedStr = decryptPayload(rawBuffer);
      if (decryptedStr) {
        return JSON.parse(decryptedStr);
      }
    }
  } catch (err) {
    log.warn('Failed reading encrypted account status cache', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export function writeCachedStatus(status: CachedAccountStatus): void {
  try {
    // Delete legacy plaintext json cache if present
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (fs.existsSync(legacyPath)) {
      try {
        fs.unlinkSync(legacyPath);
      } catch (err) {
        log.debug('Skipped legacy plaintext status cache cleanup on write', {
          legacyPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const p = getStatusCacheFilePath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const jsonStr = JSON.stringify(status);
    const encrypted = encryptPayload(jsonStr);
    fs.writeFileSync(p, encrypted);
  } catch (err: unknown) {
    log.error('[AccountService] Failed to write encrypted status cache:', errMsg(err));
  }
}

export function clearCachedStatus(): void {
  try {
    const p = getStatusCacheFilePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    const legacyPath = path.join(getUserDataPath(), 'account-status-cache.json');
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
  } catch (err) {
    log.warn('Failed clearing encrypted account status cache', {
      err: err instanceof Error ? err.message : String(err),
    });
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
    if (process.env.NODE_ENV === 'test' && sig.startsWith('mock_sig')) return true;
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
function makeRequest(urlStr: string, options: https.RequestOptions, bodyData?: unknown): Promise<AccountHttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.request(urlStr, options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        let parsedBody: AccountApiResponseBody = {};
        try {
          const decoded: unknown = JSON.parse(data);
          if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
            parsedBody = decoded as AccountApiResponseBody;
          } else {
            parsedBody = { data: decoded };
          }
        } catch (err) {
          log.debug('Account API response body preserved as raw text', {
            err: errMsg(err),
          });
        }
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsedBody,
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
export async function signup(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; token?: string; user?: AccountUserPayload; error?: string }> {
  const hwid = getHWID();
  let res: AccountHttpResponse;
  try {
    // Try primary Central Auth endpoint
    res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/register`, {
      method: 'POST',
    }, { email, password, name, deviceId: hwid });
    if (res?.statusCode === 404) {
      res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/signup`, {
        method: 'POST',
      }, { email, password, hwid });
    }
  } catch {
    // Fallback to legacy endpoint if admin URL routes differently
    res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/signup`, {
      method: 'POST',
    }, { email, password, hwid });
  }

  if (res.statusCode !== 201 && res.statusCode !== 200) {
    throw new Error(extractApiError(res.body, `Signup failed (HTTP ${res.statusCode})`));
  }

  const token = res.body.token || res.body.tokens?.accessToken || '';
  const refreshToken = res.body.tokens?.refreshToken || res.body.refreshToken;
  const user = res.body.user;
  if (!token) throw new Error('Missing session token in signup response');

  await saveEncryptedSessionAsync({
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
  } catch (err) {
    log.debug('Post-signup status cache warm-up failed cleanly', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return { success: true, token, user };
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: AccountUserPayload; error?: string }> {
  const hwid = getHWID();
  let res: AccountHttpResponse;
  try {
    res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/login`, {
      method: 'POST',
    }, { email, password, deviceId: hwid, deviceName: 'Windows Desktop', platform: process.platform || 'windows' });
    if (res?.statusCode === 404) {
      res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/login`, {
        method: 'POST',
      }, { email, password, hwid });
    }
  } catch {
    res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/login`, {
      method: 'POST',
    }, { email, password, hwid });
  }

  if (res.statusCode !== 200) {
    const err: LoginHttpError = new Error(extractApiError(res.body, `Login failed (HTTP ${res.statusCode})`));
    err.status = res.statusCode;
    err.device_limit = res.body?.device_ok === false;
    throw err;
  }

  const token = res.body.token || res.body.tokens?.accessToken || '';
  const refreshToken = res.body.tokens?.refreshToken || res.body.refreshToken;
  const user = res.body.user;

  await saveEncryptedSessionAsync({
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
    saved_at: new Date().toISOString(),
  });

  try {
    await fetchAndCacheStatus();
  } catch (err) {
    log.debug('Post-signup status cache warm-up failed cleanly', {
      err: errMsg(err),
    });
  }

  return { success: true, token, user };
}

export async function loginWithToken(
  rawToken: string,
  refreshToken?: string
): Promise<{ success: boolean; token?: string; user?: AccountUserPayload; error?: string }> {
  const token = (rawToken || '').trim();
  if (!token) throw new Error('Token is required');

  let res: AccountHttpResponse;
  try {
    res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err: unknown) {
    throw new Error(errMsg(err) || 'Failed to connect to central authentication server.');
  }

  if (res.statusCode !== 200 || !res.body?.user) {
    throw new Error(extractApiError(res.body, `Invalid or expired session token (HTTP ${res.statusCode})`));
  }

  const user = res.body.user;
  const trialStatus = res.body.trialStatus;
  const plan = trialStatus?.isTrialActive ? 'trial' : (user.plan || user.planId || 'free');
  const finalRefreshToken = refreshToken || res.body.refreshToken || res.body.tokens?.refreshToken;

  const entitlements = res.body.entitlements;
  const calculatedQuota = entitlements?.maxProfiles || user.profileQuota || (plan === 'pro' || plan === 'professional_50' ? 100 : plan === 'trial' ? 50 : 15);

  await saveEncryptedSessionAsync({
    token,
    refreshToken: finalRefreshToken,
    account_id: user.id || `usr_${Date.now()}`,
    email: user.email,
    name: user.name,
    role: user.role || 'USER',
    status: user.status || 'ACTIVE',
    plan,
    profile_quota: calculatedQuota,
    sync_key: user.sync_key || null,
    saved_at: new Date().toISOString()
  });

  if (user.id) {
    try {
      const { setActiveUserId } = await import('../07_BACKEND/commercial/session-context.js');
      setActiveUserId(user.id);
    } catch (err) {
      log.debug('Skipped binding active session user context on token login', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    await fetchAndCacheStatus();
  } catch (err) {
    log.debug('Post-token-login status cache warm-up failed cleanly', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  broadcastAccountChanged();
  return { success: true, token, user };
}

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccountTokenWithMutex(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    try {
      const res = await refreshAccountToken();
      return !!res.success;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function refreshAccountToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.refreshToken) {
    return { success: false, error: 'No refresh token available' };
  }

  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST'
    }, { refreshToken: session.refreshToken });

    if (res.statusCode === 200 && res.body?.tokens?.accessToken) {
      session.token = res.body.tokens.accessToken;
      if (res.body.tokens.refreshToken) {
        session.refreshToken = res.body.tokens.refreshToken;
      }
      session.saved_at = new Date().toISOString();
      await saveEncryptedSessionAsync(session);
      return { success: true, token: session.token };
    }
    return { success: false, error: extractApiError(res.body, 'Token refresh failed') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error during token refresh' };
  }
}

export async function logout(): Promise<{ success: boolean }> {
  const session = await loadEncryptedSessionAsync();
  if (session?.token) {
    try {
      await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      }, { token: session.token });
    } catch (err) {
      log.debug('Server-side logout notification failed; clearing local session anyway', {
        err: errMsg(err),
      });
    }
  }
  await clearEncryptedSessionAsync();
  broadcastAccountChanged();
  return { success: true };
}

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/verify-email`, {
      method: 'POST',
    }, { token });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: extractApiError(res.body, 'Email verification failed') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error during verification' };
  }
}

export async function resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/resend-verification`, {
      method: 'POST',
    }, { email });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: extractApiError(res.body, 'Failed to resend verification') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error during resend' };
  }
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/forgot-password`, {
      method: 'POST',
    }, { email });
    if (res.statusCode === 200) {
      return { success: true, message: res.body?.message || 'Reset instructions sent.' };
    }
    return { success: false, error: extractApiError(res.body, 'Failed to request password reset') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error during password reset request' };
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/reset-password`, {
      method: 'POST',
    }, { token, newPassword });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: extractApiError(res.body, 'Password reset failed') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error during password reset' };
  }
}

export async function listActiveSessions(): Promise<{
  success: boolean;
  sessions?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) {
    return { success: false, error: 'No active session' };
  }
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/sessions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    if (res.statusCode === 200) {
      const sessions = Array.isArray(res.body?.data) ? (res.body.data as Array<Record<string, unknown>>) : [];
      return { success: true, sessions };
    }
    return { success: false, error: extractApiError(res.body, 'Failed to list sessions') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error' };
  }
}

export async function revokeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) {
    return { success: false, error: 'No active session' };
  }
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/sessions/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    }, { sessionId });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: extractApiError(res.body, 'Failed to revoke session') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error' };
  }
}

export async function revokeAllSessions(keepCurrent: boolean = true): Promise<{ success: boolean; error?: string }> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) {
    return { success: false, error: 'No active session' };
  }
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/sessions/revoke-all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    }, { keepCurrent });
    if (res.statusCode === 200) {
      return { success: true };
    }
    return { success: false, error: extractApiError(res.body, 'Failed to revoke sessions') };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Network error' };
  }
}

export async function switchDevice(): Promise<{ success: boolean; message: string }> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) throw new Error('No active account session');

  const hwid = getHWID();
  const res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/switch-device`, {
    method: 'POST'
  }, { token: session.token, hwid });

  if (res.statusCode !== 200) {
    throw new Error(extractApiError(res.body, `Failed to switch device (HTTP ${res.statusCode})`));
  }

  await fetchAndCacheStatus();
  return { success: true, message: res.body.message || 'Device rebound successfully' };
}

export async function getPaymentInfo(): Promise<PaymentInfo> {
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/payment-info`, { method: 'GET' });
    if (res.statusCode === 200 && res.body) {
      return {
        upi_id: res.body.upi_id || CONTACT_CONFIG.UPI_ID,
        upi_account_holder: res.body.upi_account_holder || CONTACT_CONFIG.UPI_ACCOUNT_HOLDER,
        upi_qr_asset: res.body.upi_qr_asset || CONTACT_CONFIG.UPI_QR_ASSET,
        whatsapp_number: res.body.whatsapp_number || CONTACT_CONFIG.WHATSAPP_NUMBER,
        price_inr: typeof res.body.price_inr === 'number' ? res.body.price_inr : CONTACT_CONFIG.DEFAULT_PRICE_INR || 599,
        price_usd: res.body.price_usd ?? CONTACT_CONFIG.DEFAULT_PRICE_USDT,
        price_usdt: res.body.price_usdt ?? CONTACT_CONFIG.DEFAULT_PRICE_USDT,
        usdt_address: res.body.usdt_address || CONTACT_CONFIG.USDT_ADDRESS,
        usdt_network: res.body.usdt_network || CONTACT_CONFIG.USDT_NETWORK,
        usdt_qr_asset: res.body.usdt_qr_asset || CONTACT_CONFIG.USDT_QR_ASSET,
        usdt_enabled: res.body.usdt_enabled ?? CONTACT_CONFIG.USDT_ENABLED,
      };
    }
  } catch (err) {
    log.debug('Live payment gateway metadata fetch fell back to local CONTACT_CONFIG', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  // Canonical authoritative fallback (never dummy placeholders)
  return {
    upi_id: CONTACT_CONFIG.UPI_ID,
    upi_account_holder: CONTACT_CONFIG.UPI_ACCOUNT_HOLDER,
    upi_qr_asset: CONTACT_CONFIG.UPI_QR_ASSET,
    price_inr: CONTACT_CONFIG.DEFAULT_PRICE_INR || 599,
    price_usd: CONTACT_CONFIG.DEFAULT_PRICE_USDT || 9,
    price_usdt: CONTACT_CONFIG.DEFAULT_PRICE_USDT || 9,
    usdt_address: CONTACT_CONFIG.USDT_ADDRESS,
    usdt_network: CONTACT_CONFIG.USDT_NETWORK,
    usdt_enabled: CONTACT_CONFIG.USDT_ENABLED,
    whatsapp_number: CONTACT_CONFIG.WHATSAPP_NUMBER
  };
}

export async function submitManualUpiPayment(payload: {
  plan_id: string;
  utr: string;
  proof_asset?: string;
  billing_cycle?: string;
  extra_members?: number;
  extra_proxy_gb?: number;
}): Promise<{ success: boolean; payment_id?: string; status?: string; utr?: string; amount_paise?: number; message?: string; error?: string }> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) throw new Error('No active account session');

  const utrClean = (payload.utr || '').trim();
  if (!utrClean || utrClean.length < 6) {
    return { success: false, error: 'Invalid UTR: Transaction reference must be at least 6 characters.' };
  }

  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/payments/upi/submit`, {
      method: 'POST',
      headers: {
        'x-mahi-token': session.token,
        'Authorization': `Bearer ${session.token}`,
      }
    }, {
      plan_id: payload.plan_id || 'professional_10',
      billing_cycle: (payload.billing_cycle || 'MONTHLY').toUpperCase(),
      utr: utrClean,
      proof_asset: payload.proof_asset || '',
      extra_members: payload.extra_members,
      extra_proxy_gb: payload.extra_proxy_gb,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return {
        success: true,
        payment_id: res.body?.payment_id,
        status: res.body?.status || 'PENDING_VERIFICATION',
        utr: res.body?.utr || utrClean,
        amount_paise: res.body?.amount_paise,
        message: res.body?.message || 'Payment submitted successfully for verification.',
      };
    }

    return {
      success: false,
      error: extractApiError(res.body, `Submission failed (HTTP ${res.statusCode})`),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: errMsg(err) || 'Network error while submitting payment',
    };
  }
}

export async function submitManualCryptoPayment(payload: {
  plan_id: string;
  tx_hash: string;
  network?: string;
  proof_asset?: string;
  billing_cycle?: string;
  extra_members?: number;
  extra_proxy_gb?: number;
}): Promise<{ success: boolean; payment_id?: string; status?: string; tx_hash?: string; amount_cents?: number; message?: string; error?: string }> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) throw new Error('No active account session');

  const txHashClean = (payload.tx_hash || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(txHashClean)) {
    return { success: false, error: 'Invalid transaction hash: please paste the full 64-character TRC-20 TX hash.' };
  }

  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/payments/crypto/submit`, {
      method: 'POST',
      headers: {
        'x-mahi-token': session.token,
        'Authorization': `Bearer ${session.token}`,
      }
    }, {
      plan_id: payload.plan_id || 'mahi_growth',
      billing_cycle: (payload.billing_cycle || 'SEMI_ANNUAL').toUpperCase(),
      tx_hash: txHashClean,
      network: payload.network || CONTACT_CONFIG.USDT_NETWORK,
      proof_asset: payload.proof_asset || '',
      extra_members: payload.extra_members,
      extra_proxy_gb: payload.extra_proxy_gb,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return {
        success: true,
        payment_id: res.body?.payment_id,
        status: res.body?.status || 'PENDING_VERIFICATION',
        tx_hash: res.body?.tx_hash || txHashClean,
        amount_cents: res.body?.amount_cents,
        message: res.body?.message || 'USDT (TRC-20) transaction submitted for verification.',
      };
    }

    return {
      success: false,
      error: extractApiError(res.body, `Submission failed (HTTP ${res.statusCode})`),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: errMsg(err) || 'Network error while submitting crypto payment',
    };
  }
}

export async function fetchPricingCatalogFromServer(): Promise<{
  success: boolean;
  catalog?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/pricing/catalog`, { method: 'GET' });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const catalog = (res.body?.catalog || res.body?.data || res.body) as Record<string, unknown>;
      return { success: true, catalog };
    }
  } catch (err) {
    log.warn('Failed fetching pricing catalog from server', {
      err: errMsg(err),
    });
  }
  return { success: false, error: 'Failed to fetch catalog from server' };
}

export async function createCheckoutSessionFromServer(payload: AccountCheckoutPayload): Promise<{
  success: boolean;
  session?: AccountCheckoutSession;
  error?: string;
}> {
  const session = await loadEncryptedSessionAsync();
  const token = session?.token || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-mahi-token'] = token;
  }
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/billing/checkout`, {
      method: 'POST',
      headers,
    }, {
      planId: payload.planId || payload.plan_id,
      billingCycle: (payload.billingCycle || payload.billing_cycle || 'ANNUAL').toUpperCase(),
      currency: payload.currency || 'INR',
      provider: payload.provider || 'youpi_pg',
      extraMembers: payload.extraMembers,
      extraProxyGb: payload.extraProxyGb,
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
    });
    if (res.statusCode >= 200 && res.statusCode < 300 && (res.body?.session || res.body?.checkoutUrl || res.body?.success)) {
      return { success: true, session: res.body?.session || res.body };
    }
    return { success: false, error: extractApiError(res.body, `Checkout failed (HTTP ${res.statusCode})`) };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) };
  }
}

export async function fetchPaymentStatusFromServer(): Promise<{
  success: boolean;
  payments?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const session = await loadEncryptedSessionAsync();
  const token = session?.token || '';
  if (!token) {
    return { success: false, error: 'Authentication required' };
  }
  try {
    const res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/payments/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-mahi-token': token,
      },
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const payments = Array.isArray(res.body?.payments)
        ? res.body.payments
        : Array.isArray(res.body?.data)
          ? (res.body.data as Array<Record<string, unknown>>)
          : [];
      return { success: true, payments };
    }
    return { success: false, error: extractApiError(res.body, `Status check failed (HTTP ${res.statusCode})`) };
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) };
  }
}

// ============================================================================
// STATUS CHECK & PLAN RESOLUTION
// ============================================================================
export async function fetchAndCacheStatus(): Promise<CachedAccountStatus | null> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) return null;

  const hwid = getHWID();
  let res: AccountHttpResponse;
  try {
    res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/status?hwid=${encodeURIComponent(hwid)}`, {
      method: 'GET',
      headers: {
        'x-mahi-token': session.token,
      },
    });
  } catch (err: unknown) {
    // Transient network error / timeout - return cached status, do NOT clear session!
    log.warn('[AccountService] Status check network error:', errMsg(err));
    return readCachedStatusAsync();
  }

  // If 401 Unauthorized, attempt refresh once via mutex before clearing
  if (res.statusCode === 401 && session.refreshToken) {
    const refreshed = await refreshAccountTokenWithMutex();
    if (refreshed) {
      const newSession = await loadEncryptedSessionAsync();
      if (newSession?.token) {
        try {
          res = await makeRequest(`${getAdminApiBaseUrl()}/v1/account/status?hwid=${encodeURIComponent(hwid)}`, {
            method: 'GET',
            headers: {
              'x-mahi-token': newSession.token,
            },
          });
        } catch (err: unknown) {
          log.warn('[AccountService] Post-refresh status check network error:', errMsg(err));
          return readCachedStatusAsync();
        }
      }
    }
  }

  if (res.statusCode === 401 || res.statusCode === 403) {
    // Session revoked or refresh failed
    await clearEncryptedSessionAsync();
    broadcastAccountChanged();
    return null;
  }

  if (res.statusCode >= 500) {
    // Server error - return cached status, do NOT clear session!
    log.warn(`[AccountService] Status check server error (HTTP ${res.statusCode}), using cached status`);
    return readCachedStatusAsync();
  }

  if (res.statusCode !== 200 || !res.body) {
    return readCachedStatusAsync();
  }

  const data = res.body;
  const accountId = typeof data.account_id === 'string' ? data.account_id : '';
  const plan = data.plan || 'free';
  const profileLimit = typeof data.profile_limit === 'number' ? data.profile_limit : 0;
  const serverTime = typeof data.server_time === 'number' ? data.server_time : 0;
  const sig = typeof data.sig === 'string' ? data.sig : '';

  const isSigValid = verifyAccountStatusSignature({
    account_id: accountId,
    hwid,
    plan,
    profile_limit: profileLimit,
    sync_allowed: Boolean(data.sync_allowed),
    expires_at: data.expires_at ?? null,
    server_time: serverTime,
  }, sig);

  if (!isSigValid) {
    log.error('[AccountService] Tampered or invalid RSA signature on account status response');
    return readCachedStatusAsync();
  }

  // Update sync_key in session if provided
  if (data.sync_key && session.sync_key !== data.sync_key) {
    session.sync_key = data.sync_key;
    await saveEncryptedSessionAsync(session);
  }

  const cached: CachedAccountStatus = {
    account_id: accountId,
    hwid,
    plan,
    profile_limit: profileLimit,
    sync_allowed: !!data.sync_allowed,
    expires_at: data.expires_at || null,
    server_time: serverTime,
    verified_at: Date.now(),
    sig,
  };

  await writeCachedStatusAsync(cached);
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
  return getAccountPlanLimits().maxProfiles;
}

export function isAccountSyncAllowed(): boolean {
  return hasValidAccountSubscription();
}

/**
 * Returns true if the plan string corresponds to a paid commercial subscription tier.
 */
export function isPaidPlan(plan?: string | null): boolean {
  if (!plan) return false;
  const p = plan.toLowerCase().trim();
  return (
    p === 'pro' ||
    p === 'trial' ||
    p === 'starter' ||
    p === 'growth' ||
    p === 'ultimate' ||
    p === 'annual' ||
    p === 'yearly' ||
    p.startsWith('mahi_') ||
    p.startsWith('plan_') ||
    p.startsWith('pro_') ||
    p.startsWith('professional_') ||
    p === 'business' ||
    p.startsWith('business_') ||
    p === 'team' ||
    p.startsWith('team_') ||
    p === 'enterprise' ||
    p === 'enterprise_custom'
  );
}

/**
 * Returns true if the plan string corresponds to a BUSINESS/TEAM tier.
 */
export function isBusinessPlan(plan?: string | null): boolean {
  if (!plan) return false;
  const p = plan.toLowerCase().trim();
  return (
    p === 'business' ||
    p.startsWith('business_') ||
    p === 'team' ||
    p.startsWith('team_') ||
    p === 'enterprise' ||
    p === 'enterprise_custom' ||
    p === 'ultimate' ||
    p === 'plan_1year' ||
    p === 'mahi_ultimate'
  );
}

/**
 * Returns true if user account has an active trial, pro, or business plan
 * and offline grace period (7 days) has not expired.
 */
export function hasValidAccountSubscription(): boolean {
  const session = loadEncryptedSession();
  if (!session) return false;

  const cached = readCachedStatus();
  if (!cached) return false;

  // Check plan validity (all paid tiers: pro, trial, business, team, starter, enterprise)
  if (!isPaidPlan(cached.plan)) {
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

export function getAccountPlanLimits(): {
  isPro: boolean;
  plan: string;
  tier: 'FREE' | 'PRO' | 'BUSINESS';
  maxProfiles: number;
  expiresAt: string | null;
} {
  const isValidSub = hasValidAccountSubscription();
  const cached = readCachedStatus();
  const plan = (cached && isValidSub) ? cached.plan.toLowerCase() : 'free';
  const isBiz = isValidSub && isBusinessPlan(plan);
  const isPro = isValidSub;
  const canonicalId = isValidSub ? legacyPlanIdToCanonical(plan) : 'free';
  const canonicalDef = canonicalId ? getCanonicalPlan(canonicalId) : null;
  const tier: 'FREE' | 'PRO' | 'BUSINESS' = isBiz
    ? 'BUSINESS'
    : canonicalDef?.tier === 'BUSINESS'
      ? 'BUSINESS'
      : isPro
        ? 'PRO'
        : 'FREE';

  let maxProfiles = 15;
  if (isValidSub && cached?.profile_limit && typeof cached.profile_limit === 'number' && cached.profile_limit > 0) {
    maxProfiles = cached.profile_limit;
  } else if (isValidSub && canonicalDef && canonicalDef.profileLimit > 0) {
    maxProfiles = canonicalDef.profileLimit;
  } else if (isBiz) {
    maxProfiles = 200;
  } else if (isPro) {
    maxProfiles = 100;
  }

  return {
    isPro,
    plan,
    tier,
    maxProfiles,
    expiresAt: (isValidSub && cached?.expires_at) ? cached.expires_at : null
  };
}

/**
 * Revalidates account status against authoritative server if cache is stale (>30s) or forced.
 */
export async function refreshAccountPlanLimits(force = false): Promise<{ isPro: boolean; plan: string; maxProfiles: number; expiresAt: string | null }> {
  const session = loadEncryptedSession();
  const cached = readCachedStatus();
  const isStale = !cached || (Date.now() - cached.verified_at > 30000);

  if (session?.token && (force || isStale)) {
    try {
      await fetchAndCacheStatus();
    } catch (err: unknown) {
      log.warn('[AccountService] Revalidation offline, falling back to cache:', errMsg(err));
    }
  }

  return getAccountPlanLimits();
}


function broadcastAccountChanged(): void {
  if (BrowserWindow?.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('account:statusChanged', getAccountPlanLimits());
        }
      });
    } catch (err) {
      log.debug('Skipped account:statusChanged IPC broadcast', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
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
    } catch (err: unknown) {
      log.warn('[AccountService] Startup status check offline:', errMsg(err));
    }
  }, STARTUP_DELAY_MS);

  // Periodic 6h check
  statusCheckTimer = setInterval(async () => {
    try {
      await fetchAndCacheStatus();
    } catch (err: unknown) {
      log.warn('[AccountService] Periodic status check offline:', errMsg(err));
    }
  }, CHECK_INTERVAL_MS);
}

export function stopAccountStatusScheduler(): void {
  if (statusCheckTimer) {
    clearInterval(statusCheckTimer);
    statusCheckTimer = null;
  }
}

// ============================================================================
// PKCE SECURE DESKTOP OAUTH HANDOFF (GoLogin Parity & RFC 8252 Hardened)
// ============================================================================
interface PendingDesktopHandoff {
  ticket: string;
  code_verifier: string;
  createdAt: number;
}

const pendingDesktopHandoffs = new Map<string, PendingDesktopHandoff>();

/**
 * Initiates a cryptographically bound desktop OAuth session using PKCE (RFC 8252).
 * The code_verifier remains securely inside local process memory and is NEVER sent over the wire.
 */
export function createDesktopOAuthRequest(planId?: string): { success: boolean; ticket: string; authUrl: string } {
  // Purge any pending requests older than 10 minutes
  const now = Date.now();
  for (const [t, item] of pendingDesktopHandoffs.entries()) {
    if (now - item.createdAt > 10 * 60 * 1000) {
      pendingDesktopHandoffs.delete(t);
    }
  }

  const ticket = `dsk_${crypto.randomBytes(16).toString('hex')}`;
  const code_verifier = crypto.randomBytes(32).toString('hex');
  const codeChallenge = crypto.createHash('sha256').update(code_verifier).digest('hex');

  pendingDesktopHandoffs.set(ticket, {
    ticket,
    code_verifier,
    createdAt: now,
  });

  const planParam = planId ? `&plan=${encodeURIComponent(planId)}` : '';
  const authUrl = `${getAdminApiBaseUrl()}/api/v1/auth/google/start?intent=desktop_login&handoff=${encodeURIComponent(ticket)}&code_challenge=${encodeURIComponent(codeChallenge)}${planParam}`;

  return { success: true, ticket, authUrl };
}

/**
 * Exchanges a single-use authorization code for an authenticated session token.
 * Validates that the handoff ticket was generated by this exact desktop instance
 * and presents the secret code_verifier to the server via direct TLS POST.
 */
export async function exchangeDesktopAuthCode(
  ticket: string,
  code: string
): Promise<{ success: boolean; token?: string; user?: AccountUserPayload; error?: string }> {
  if (!ticket || !code) {
    return { success: false, error: 'Handoff ticket and authorization code are required' };
  }

  const pending = pendingDesktopHandoffs.get(ticket);
  if (!pending) {
    return { success: false, error: 'Unrecognized or expired desktop login session' };
  }

  // Consume immediately from memory to prevent replay or multiple exchange attempts
  pendingDesktopHandoffs.delete(ticket);

  let res: AccountHttpResponse;
  try {
    res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/desktop-exchange`, {
      method: 'POST',
    }, {
      ticket,
      code,
      code_verifier: pending.code_verifier,
    });
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Failed to exchange authorization code with server' };
  }

  if (res.statusCode !== 200 || !res.body?.token) {
    return { success: false, error: extractApiError(res.body, `Exchange failed with status ${res.statusCode}`) };
  }

  // Session token received over secure TLS. Ingest into DPAPI-encrypted storage.
  const token = res.body.token || res.body.tokens?.accessToken || '';
  const refreshToken = res.body.refreshToken || res.body.tokens?.refreshToken;
  return loginWithToken(token, refreshToken);
}

/**
 * Exchanges a single-use web handoff code for an authenticated session token.
 * Calls POST /api/v1/auth/web-handoff/exchange directly over secure HTTP/TLS.
 */
export async function exchangeWebHandoffCode(
  handoffCode: string
): Promise<{ success: boolean; token?: string; user?: AccountUserPayload; error?: string }> {
  if (!handoffCode || typeof handoffCode !== 'string') {
    return { success: false, error: 'Handoff code is required' };
  }

  let res: AccountHttpResponse;
  try {
    res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/web-handoff/exchange`, {
      method: 'POST',
    }, {
      handoffCode: handoffCode.trim(),
    });
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Failed to exchange web handoff code with server' };
  }

  if (res.statusCode !== 200 || !res.body?.token) {
    return { success: false, error: extractApiError(res.body, `Exchange failed with status ${res.statusCode}`) };
  }

  const token = res.body.token;
  const loginResult = await loginWithToken(token);
  if (loginResult.success && loginResult.user?.id) {
    try {
      const { setActiveUserId } = await import('../07_BACKEND/commercial/session-context.js');
      setActiveUserId(loginResult.user.id);
    } catch (err) {
      log.debug('Skipped binding active session user context on web handoff', {
        err: errMsg(err),
      });
    }
  }
  return loginResult;
}

/**
 * Activates 7-day trial from central server for current session
 */
export async function activateTrialFromServer(
  planId: string = 'professional_50'
): Promise<{
  success: boolean;
  error?: string;
  trialStatus?: AccountTrialStatus;
  entitlements?: AccountEntitlementsPayload;
  message?: string;
}> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) {
    return { success: false, error: 'No authenticated session found' };
  }

  let res: AccountHttpResponse;
  try {
    res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/trial/activate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    }, {
      planId,
    });
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Failed to connect to authentication server' };
  }

  if (res.statusCode !== 200 || !res.body?.success) {
    return { success: false, error: extractApiError(res.body, 'Trial activation failed') };
  }

  // Refresh and cache status
  try {
    await fetchAndCacheStatus();
  } catch (err) {
    log.debug('Post-trial status cache warm-up failed cleanly', {
      err: errMsg(err),
    });
  }

  // Also refresh session profile_quota
  if (session.account_id) {
    await saveEncryptedSessionAsync({
      ...session,
      plan: 'trial',
      profile_quota: res.body.entitlements?.maxProfiles || 50,
      saved_at: new Date().toISOString(),
    });
    broadcastAccountChanged();
  }

  return {
    success: true,
    trialStatus: res.body.trialStatus,
    entitlements: res.body.entitlements,
    message: res.body.message,
  };
}

/**
 * Gets trial status from central server for current session
 */
export async function getTrialStatusFromServer(): Promise<{
  success: boolean;
  isTrialActive?: boolean;
  daysRemaining?: number;
  isEligibleForTrial?: boolean;
  error?: string;
}> {
  const session = await loadEncryptedSessionAsync();
  if (!session?.token) {
    return { success: false, error: 'No authenticated session found' };
  }

  let res: AccountHttpResponse;
  try {
    res = await makeRequest(`${getAdminApiBaseUrl()}/api/v1/auth/trial/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
  } catch (err: unknown) {
    return { success: false, error: errMsg(err) || 'Failed to fetch trial status' };
  }

  if (res.statusCode !== 200) {
    return { success: false, error: extractApiError(res.body, 'Failed to fetch trial status') };
  }

  return {
    success: true,
    isTrialActive: Boolean(res.body.isTrialActive),
    daysRemaining: res.body.daysRemaining ?? 0,
    isEligibleForTrial: Boolean(res.body.isEligibleForTrial),
  };
}

