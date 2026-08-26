import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

let cachedMasterKey: Buffer | null = null;

function getMasterKeyPath(): string {
  const userDataDir = app ? app.getPath('userData') : path.join(process.cwd(), '.mahi_data');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, '.mahi_master.key');
}

export function getOrCreateMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const keyPath = getMasterKeyPath();
  if (fs.existsSync(keyPath)) {
    try {
      const stored = fs.readFileSync(keyPath, 'utf8').trim();
      cachedMasterKey = Buffer.from(stored, 'hex');
      if (cachedMasterKey.length === KEY_LENGTH) {
        return cachedMasterKey;
      }
    } catch {
      // regenerate if corrupted
    }
  }

  const newKey = crypto.randomBytes(KEY_LENGTH);
  fs.writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 });
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
  const salt = Buffer.from(saltHex, 'hex');
  const computedHash = crypto.pbkdf2Sync(pin, salt, ITERATIONS, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
}
