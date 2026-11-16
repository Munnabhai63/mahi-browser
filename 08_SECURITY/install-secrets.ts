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
    const stored = readSecretsFile(filePath);
    if (stored && stored.jwtSecret && stored.apiAuthToken && stored.adminSalt) {
      cachedSecrets = stored;
      return cachedSecrets!;
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

export function getJwtSecret(): string {
  if (!process.versions?.electron) {
    const envJwt = process.env.JWT_SECRET?.trim();
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
    if (envAdmin && envAdmin.length >= 16) {
      return envAdmin;
    }
  }
  return getInstallSecrets().masterAdminSecret;
}

export function getAdminWebSecret(): string {
  return getInstallSecrets().adminWebSecret;
}

/**
 * Validates local API tokens strictly against dynamic per-install secret. Fail closed.
 */
export function isValidApiToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const currentToken = getApiAuthToken();
  if (!currentToken) return false;
  return token === currentToken;
}

/**
 * Validates admin web secret strictly against dynamic per-install secret. Fail closed.
 */
export function isValidAdminWebSecret(secret: string | null | undefined): boolean {
  if (!secret) return false;
  const currentSecret = getAdminWebSecret();
  if (!currentSecret) return false;
  return secret === currentSecret;
}
