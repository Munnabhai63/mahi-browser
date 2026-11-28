import crypto from 'node:crypto';
import { getDatabase } from '../06_DATABASE/connection.js';
import { getMasterAdminSecret } from '../08_SECURITY/install-secrets.js';
import { constantTimeEqualStrings } from '../07_BACKEND/utils/http-security.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('admin-auth');

/**
 * Hashes a PIN or password using scrypt-v1 (N=16384, r=8, p=1, keylen=64).
 * Returns: scrypt$N=16384,r=8,p=1$<salt_hex>$<hash_hex>
 */
export function hashPinScrypt(pin: string, saltHex?: string): string {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt}$${derived.toString('hex')}`;
}

/**
 * Verifies a PIN against a scrypt-v1 formatted hash using constant-time comparison.
 */
export function verifyPinScrypt(pin: string, storedFormatted: string): boolean {
  if (!storedFormatted?.startsWith('scrypt$')) return false;
  const parts = storedFormatted.split('$');
  if (parts.length < 4) return false;
  const saltHex = parts[2];
  const expectedHashHex = parts[3];

  const derived = crypto.scryptSync(pin, saltHex, 64, { N: 16384, r: 8, p: 1 });
  const derivedHex = derived.toString('hex');

  const bufA = Buffer.from(derivedHex, 'hex');
  const bufB = Buffer.from(expectedHashHex, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies if an admin token or secret is valid for Owner operations.
 * Constant-time evaluation with transparent auto-upgrade to scrypt-v1.
 */
export function verifyAdminAccess(providedSecretOrKey: string): boolean {
  if (!providedSecretOrKey) return false;

  const masterSecret = getMasterAdminSecret();
  if (!masterSecret) return false;

  // Constant-time check for Master Secret recovery key
  const provBuf = Buffer.from(providedSecretOrKey);
  const mastBuf = Buffer.from(masterSecret);
  if (provBuf.length === mastBuf.length && crypto.timingSafeEqual(provBuf, mastBuf)) {
    return true;
  }

  const db = getDatabase();
  const setting = db.prepare("SELECT value_json FROM app_settings WHERE key = 'owner_pin'").get() as { value_json: string } | undefined;

  if (setting) {
    try {
      const parsed = JSON.parse(setting.value_json);
      const storedHash = parsed.pinHash || parsed.hash;

      // 1. Scrypt-v1 Format
      if (typeof storedHash === 'string' && storedHash.startsWith('scrypt$')) {
        return verifyPinScrypt(providedSecretOrKey, storedHash);
      }

      // 2. Legacy SHA-256 with Salt — Verify and Auto-Upgrade
      if (typeof storedHash === 'string' && parsed.salt) {
        const legacyHash = crypto.createHash('sha256').update(providedSecretOrKey + parsed.salt).digest('hex');
        const bufA = Buffer.from(legacyHash, 'hex');
        const bufB = Buffer.from(storedHash, 'hex');
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          // Transparently upgrade to scrypt-v1
          const upgraded = hashPinScrypt(providedSecretOrKey);
          const now = new Date().toISOString();
          const newValueJson = JSON.stringify({
            pinHash: upgraded,
            salt: upgraded.split('$')[2],
            format: 'scrypt-v1',
            updatedAt: now,
          });
          db.prepare("UPDATE app_settings SET value_json = ?, updated_at = ? WHERE key = 'owner_pin'").run(newValueJson, now);
          return true;
        }
      }

      // 3. Plaintext Legacy PIN — Verify and Auto-Upgrade
      if (typeof storedHash === 'string' && constantTimeEqualStrings(storedHash, providedSecretOrKey)) {
        const upgraded = hashPinScrypt(providedSecretOrKey);
        const now = new Date().toISOString();
        const newValueJson = JSON.stringify({
          pinHash: upgraded,
          salt: upgraded.split('$')[2],
          format: 'scrypt-v1',
          updatedAt: now,
        });
        db.prepare("UPDATE app_settings SET value_json = ?, updated_at = ? WHERE key = 'owner_pin'").run(newValueJson, now);
        return true;
      }
    } catch (err: unknown) {
      log.error('[AdminAuth] Error verifying owner_pin:', err instanceof Error ? err.message : String(err));
    }
  }

  // Master secret SHA-256 timing-safe fallback
  const defaultHash = crypto.createHash('sha256').update(masterSecret).digest('hex');
  const providedHash = crypto.createHash('sha256').update(providedSecretOrKey).digest('hex');
  const hA = Buffer.from(providedHash, 'hex');
  const hB = Buffer.from(defaultHash, 'hex');
  return hA.length === hB.length && crypto.timingSafeEqual(hA, hB);
}

/**
 * Sets or updates the custom Owner PIN/Password with scrypt-v1 hashing.
 */
export function setOwnerAdminPin(newPin: string, currentSecret: string): boolean {
  if (!verifyAdminAccess(currentSecret)) {
    return false;
  }

  if (!newPin || newPin.trim().length === 0) {
    return false;
  }

  const db = getDatabase();
  const trimmed = newPin.trim();
  const scryptHash = hashPinScrypt(trimmed);
  const salt = scryptHash.split('$')[2];
  const now = new Date().toISOString();

  const valueJson = JSON.stringify({
    pinHash: scryptHash,
    salt,
    format: 'scrypt-v1',
    updatedAt: now,
  });

  const existing = db.prepare("SELECT key FROM app_settings WHERE key = 'owner_pin'").get();
  if (existing) {
    db.prepare("UPDATE app_settings SET value_json = ?, updated_at = ? WHERE key = 'owner_pin'").run(valueJson, now);
  } else {
    db.prepare("INSERT INTO app_settings (key, value_json, updated_at) VALUES ('owner_pin', ?, ?)").run(valueJson, now);
  }

  return true;
}
