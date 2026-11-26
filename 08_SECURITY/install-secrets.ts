import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from './electron-bridge.js';
import { getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';

export interface InstallSecrets {
  jwtSecret: string;
  apiAuthToken: string;
  adminSalt: string;
  masterAdminSecret: string;
  adminWebSecret: string;
  createdAt: string;
}

let cachedSecrets: InstallSecrets | null = null;

function isSafeStorageAvailable(): boolean {
  try {
    return !!safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function writeSecretsFile(filePath: string, data: InstallSecrets): void {
  const jsonStr = JSON.stringify(data, null, 2);
  let payload = jsonStr;
  if (isSafeStorageAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(jsonStr);
      payload = 'SAFE_STORAGE_V1:' + encrypted.toString('base64');
    } catch (err) {
      console.warn('[SECURITY] safeStorage.encryptString failed, falling back to restricted file permissions:', err);
    }
  }
  fs.writeFileSync(filePath, payload, { encoding: 'utf8', mode: 0o600 });
}

function readSecretsFile(filePath: string): InstallSecrets | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return null;

    if (raw.startsWith('SAFE_STORAGE_V1:')) {
      if (!isSafeStorageAvailable()) {
        console.error('[SECURITY] safeStorage encryption is not available to decrypt install-secrets.json');
        return null;
      }
      const b64 = raw.slice('SAFE_STORAGE_V1:'.length);
      const decrypted = safeStorage.decryptString(Buffer.from(b64, 'base64'));
      return JSON.parse(decrypted);
    }

    // Legacy plaintext format -> parse, and if safeStorage is now available, migrate immediately to encrypted format
    const parsed = JSON.parse(raw);
    if (parsed.jwtSecret && parsed.apiAuthToken && parsed.adminSalt) {
      if (isSafeStorageAvailable()) {
        try {
          writeSecretsFile(filePath, parsed);
          console.log('[SECURITY] Migrated install-secrets.json to safeStorage encrypted format.');
        } catch {}
      }
      return parsed;
    }
  } catch (err) {
    console.error('[SECURITY] Failed to read or parse install-secrets.json:', err);
  }
  return null;
}

export function resetCachedSecretsForTesting(): void {
  cachedSecrets = null;
}

function getSecretsFilePath(): string {
  const baseDir = getWritableUserDataDir();
  return path.join(baseDir, 'install-secrets.json');
}

export function getInstallSecrets(): InstallSecrets {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  const filePath = getSecretsFilePath();
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (raw.length > 0) {
      const stored = readSecretsFile(filePath);
      if (stored && stored.jwtSecret && stored.apiAuthToken && stored.adminSalt) {
        cachedSecrets = stored;
        return cachedSecrets;
      }
      throw new Error(
        '[SECURITY] Existing install-secrets.json could not be decrypted or validated (safeStorage unavailable or corrupted). Refusing to overwrite existing install secrets.'
      );
    }
  }

  // Generate per-install cryptographically random secrets on first run
  const newSecrets: InstallSecrets = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    apiAuthToken: crypto.randomBytes(24).toString('hex'),
    adminSalt: crypto.randomBytes(16).toString('hex'),
    masterAdminSecret: crypto.randomBytes(16).toString('hex'),
    adminWebSecret: crypto.randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
  };

  try {
    writeSecretsFile(filePath, newSecrets);
  } catch (err) {
    console.error('[SECURITY] Failed to save install-secrets.json:', err);
  }

  cachedSecrets = newSecrets;
  return newSecrets;
}

const KNOWN_WEAK_SECRETS = new Set([
  'changeme',
  'change-me',
  'default',
  'secret',
  'password',
  'admin',
  'mahi-secret',
  'mahi-dev-secret',
  'jwt-secret',
  'test-secret',
]);

function isNonElectronProduction(): boolean {
  return process.env.NODE_ENV === 'production' && !process.versions?.electron;
}

export function isWeakSecret(secret: string | null | undefined, minLength = 32): boolean {
  if (!secret) return true;
  const trimmed = secret.trim();
  if (trimmed.length < minLength) return true;
  if (KNOWN_WEAK_SECRETS.has(trimmed.toLowerCase())) return true;
  // Reject trivial single-character or tiny repeating patterns
  if (new Set(trimmed).size < 4) return true;
  return false;
}

export function getJwtSecret(): string {
  if (!process.versions?.electron) {
    const envJwt = process.env.JWT_SECRET?.trim();
    if (isNonElectronProduction()) {
      if (isWeakSecret(envJwt, 32)) {
        throw new Error(
          '[Security] Production startup requires a strong JWT_SECRET (>= 32 chars) via environment; disk fallback is disabled.'
        );
      }
      return envJwt!;
    }
    if (envJwt && envJwt.length >= 16) {
      return envJwt;
    }
  }
  return getInstallSecrets().jwtSecret;
}

export function getApiAuthToken(): string {
  return getInstallSecrets().apiAuthToken;
}

export function getAdminSalt(): string {
  return getInstallSecrets().adminSalt;
}

export function getMasterAdminSecret(): string {
  if (!process.versions?.electron) {
    const envAdmin = (process.env.ADMIN_BOOTSTRAP_TOKEN || process.env.MAHI_MASTER_ADMIN_SECRET)?.trim();
    if (isNonElectronProduction()) {
      if (isWeakSecret(envAdmin, 32)) {
        throw new Error(
          '[Security] Production startup requires a strong ADMIN_BOOTSTRAP_TOKEN (>= 32 chars) via environment; disk fallback is disabled.'
        );
      }
      return envAdmin!;
    }
    if (envAdmin && envAdmin.length >= 16) {
      return envAdmin;
    }
  }
  return getInstallSecrets().masterAdminSecret;
}

export function validateProductionSecrets(): void {
  if (!isNonElectronProduction()) {
    return;
  }
  getJwtSecret();
  getMasterAdminSecret();

  const rawPrivateKey = (process.env.MAHI_STATUS_PRIVATE_KEY || process.env.RSA_PRIVATE_KEY)?.trim();
  if (!rawPrivateKey) {
    throw new Error(
      '[Security] Production startup requires MAHI_STATUS_PRIVATE_KEY (or RSA_PRIVATE_KEY) for status signing.'
    );
  }
  const formatted = rawPrivateKey.includes('\\n') ? rawPrivateKey.replace(/\\n/g, '\n') : rawPrivateKey;
  let keyObj: crypto.KeyObject;
  try {
    keyObj = crypto.createPrivateKey(formatted);
  } catch (err: any) {
    throw new Error(`[Security] Production status signing private key is invalid: ${err?.message || 'parse failed'}`);
  }
  if (keyObj.asymmetricKeyType === 'rsa') {
    const bits = keyObj.asymmetricKeyDetails?.modulusLength ?? 0;
    if (bits < 2048) {
      throw new Error(`[Security] Production RSA status signing key is too weak (${bits} bits; minimum 2048 bits).`);
    }
  }
}

export function getAdminWebSecret(): string {
  return getInstallSecrets().adminWebSecret;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates local API tokens strictly against dynamic per-install secret. Fail closed.
 */
export function isValidApiToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const currentToken = getApiAuthToken();
  if (!currentToken) return false;
  return constantTimeEqual(token, currentToken);
}

/**
 * Validates admin web secret strictly against dynamic per-install secret. Fail closed.
 */
export function isValidAdminWebSecret(secret: string | null | undefined): boolean {
  if (!secret) return false;
  const currentSecret = getAdminWebSecret();
  if (!currentSecret) return false;
  return constantTimeEqual(secret, currentSecret);
}
