import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { safeStorage } from './electron-bridge.js';
import { getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('encryption');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

let cachedMasterKey: Buffer | null = null;

function isSafeStorageAvailable(): boolean {
  try {
    return !!safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function writeMasterKeyFile(keyPath: string, keyBuffer: Buffer): void {
  const keyHex = keyBuffer.toString('hex');
  let payload = keyHex;
  if (isSafeStorageAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(keyHex);
      payload = `SAFE_STORAGE_V1:${encrypted.toString('base64')}`;
    } catch (err) {
      log.warn('[SECURITY] safeStorage.encryptString failed for master key, falling back to restricted file permissions:', err);
    }
  }
  fs.writeFileSync(keyPath, payload, { encoding: 'utf8', mode: 0o600 });
}

function readMasterKeyFile(keyPath: string): Buffer | null {
  try {
    const raw = fs.readFileSync(keyPath, 'utf8').trim();
    if (!raw) return null;

    if (raw.startsWith('SAFE_STORAGE_V1:')) {
      if (!isSafeStorageAvailable()) {
        log.error('[SECURITY] safeStorage is not available to decrypt .mahi_master.key');
        return null;
      }
      const b64 = raw.slice('SAFE_STORAGE_V1:'.length);
      const decryptedHex = safeStorage.decryptString(Buffer.from(b64, 'base64')).trim();
      const buf = Buffer.from(decryptedHex, 'hex');
      if (buf.length === KEY_LENGTH) return buf;
      return null;
    }

    // Legacy plaintext hex
    const buf = Buffer.from(raw, 'hex');
    if (buf.length === KEY_LENGTH) {
      if (isSafeStorageAvailable()) {
        try {
          writeMasterKeyFile(keyPath, buf);
          log.info('[SECURITY] Migrated .mahi_master.key to safeStorage encrypted format.');
        } catch (migErr) {
          log.warn('Master key migration to safeStorage format failed softly', {
            err: migErr instanceof Error ? migErr.message : String(migErr),
          });
        }
      }
      return buf;
    }
  } catch (err) {
    log.error('[SECURITY] Failed to read .mahi_master.key:', err);
  }
  return null;
}

export function resetCachedMasterKeyForTesting(): void {
  cachedMasterKey = null;
}

function getMasterKeyPath(): string {
  const userDataDir = getWritableUserDataDir();
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, '.mahi_master.key');
}

export function getOrCreateMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const keyPath = getMasterKeyPath();
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, 'utf8').trim();
    if (raw.length > 0) {
      const stored = readMasterKeyFile(keyPath);
      if (stored && stored.length === KEY_LENGTH) {
        cachedMasterKey = stored;
        return cachedMasterKey;
      }
      throw new Error(
        '[SECURITY] Existing .mahi_master.key could not be decrypted or validated (safeStorage unavailable or corrupted). Refusing to overwrite existing master key.'
      );
    }
  }

  const newKey = crypto.randomBytes(KEY_LENGTH);
  writeMasterKeyFile(keyPath, newKey);
  cachedMasterKey = newKey;
  return newKey;
}

export function deriveKeyFromPassword(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encryptData(plainText: string, key?: Buffer): string {
  if (!plainText) return '';
  const cipherKey = key || getOrCreateMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, cipherKey, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (in base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptData(cipherText: string, key?: Buffer): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const cipherKey = key || getOrCreateMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, cipherKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function hashPin(pin: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(pin, salt, ITERATIONS, 32, 'sha256').toString('hex');
  return { hash, salt: salt.toString('hex') };
}

export function verifyPin(pin: string, storedHash: string, saltHex: string): boolean {
  if (!pin || !storedHash || !saltHex || !/^[0-9a-fA-F]+$/.test(storedHash)) {
    return false;
  }
  const salt = Buffer.from(saltHex, 'hex');
  const computedHash = crypto.pbkdf2Sync(pin, salt, ITERATIONS, 32, 'sha256').toString('hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (computedBuf.length === 0 || computedBuf.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(computedBuf, storedBuf);
}
