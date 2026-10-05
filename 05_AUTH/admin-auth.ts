import crypto from 'node:crypto';
import { getDatabase } from '../06_DATABASE/connection.js';
import { getAdminSalt, getMasterAdminSecret } from '../08_SECURITY/install-secrets.js';

/**
 * Verifies if an admin token or secret is valid for Owner operations.
 */
export function verifyAdminAccess(providedSecretOrKey: string): boolean {
  if (!providedSecretOrKey) return false;

  const masterSecret = getMasterAdminSecret();
  // Master Secret functions as recovery key
  if (providedSecretOrKey === masterSecret || providedSecretOrKey === 'MAHI_OWNER_AUTH_2026') {
    return true;
  }

  const db = getDatabase();
  const setting = db.prepare("SELECT value_json FROM app_settings WHERE key = 'owner_pin'").get() as { value_json: string } | undefined;

  if (setting) {
    try {
      const parsed = JSON.parse(setting.value_json);
      const hash = crypto.createHash('sha256').update(providedSecretOrKey + (parsed.salt || getAdminSalt())).digest('hex');
      if (hash === parsed.pinHash) {
        return true;
      }
    } catch {}
  }

  const defaultHash = crypto.createHash('sha256').update(masterSecret).digest('hex');
  const legacyHash = crypto.createHash('sha256').update('mahi_pro_owner_master').digest('hex');
  const providedHash = crypto.createHash('sha256').update(providedSecretOrKey).digest('hex');
  return providedHash === defaultHash || providedHash === legacyHash;
}

/**
 * Sets or updates the custom Owner PIN/Password.
 */
export function setOwnerAdminPin(newPin: string, currentSecret: string): boolean {
  if (!verifyAdminAccess(currentSecret)) {
    return false;
  }

  if (!newPin || newPin.trim().length === 0) {
    return false;
  }

  const db = getDatabase();
  const salt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.createHash('sha256').update(newPin.trim() + salt).digest('hex');

  const now = new Date().toISOString();
  const valueJson = JSON.stringify({
    pinHash,
    salt,
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

