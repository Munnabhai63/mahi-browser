import { getDatabase } from '../../06_DATABASE/connection.js';
import { AppSettings } from '../../10_CONFIG/shared/types/settings.js';
import { DEFAULT_APP_SETTINGS } from '../../10_CONFIG/shared/constants/defaults.js';
import { hashPin, verifyPin } from '../../08_SECURITY/encryption.js';
import { logActivity } from './audit-service.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('settings-service');

const SETTINGS_KEY = 'main_config';
const PIN_SALT_KEY = 'pin_salt';

export function getAppSettings(): AppSettings {
  const db = getDatabase();
  const row = db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get(SETTINGS_KEY) as {
    value_json: string;
  } | undefined;

  if (!row) {
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO app_settings (key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `).run(SETTINGS_KEY, JSON.stringify(DEFAULT_APP_SETTINGS), now);
    } catch (err) {
      log.warn('Failed initializing default app_settings row', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return DEFAULT_APP_SETTINGS;
  }

  try {
    const parsed = JSON.parse(row.value_json);
    return {
      general: { ...DEFAULT_APP_SETTINGS.general, ...(parsed.general || {}) },
      privacy: { ...DEFAULT_APP_SETTINGS.privacy, ...(parsed.privacy || {}) },
      security: { ...DEFAULT_APP_SETTINGS.security, ...(parsed.security || {}) },
      performance: { ...DEFAULT_APP_SETTINGS.performance, ...(parsed.performance || {}) },
      advanced: { ...DEFAULT_APP_SETTINGS.advanced, ...(parsed.advanced || {}) },
    };
  } catch (parseErr) {
    log.warn('Failed parsing stored app_settings JSON; using defaults', {
      err: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: Partial<AppSettings>): AppSettings {
  const db = getDatabase();
  const row = db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get(SETTINGS_KEY) as {
    value_json: string;
  } | undefined;

  let current = DEFAULT_APP_SETTINGS;
  if (row) {
    try {
      const parsed = JSON.parse(row.value_json);
      current = {
        general: { ...DEFAULT_APP_SETTINGS.general, ...(parsed.general || {}) },
        privacy: { ...DEFAULT_APP_SETTINGS.privacy, ...(parsed.privacy || {}) },
        security: { ...DEFAULT_APP_SETTINGS.security, ...(parsed.security || {}) },
        performance: { ...DEFAULT_APP_SETTINGS.performance, ...(parsed.performance || {}) },
        advanced: { ...DEFAULT_APP_SETTINGS.advanced, ...(parsed.advanced || {}) },
      };
    } catch (parseErr) {
      log.warn('Failed parsing existing app_settings before update', {
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
    }
  }

  const merged: AppSettings = {
    general: { ...current.general, ...(settings.general || {}) },
    privacy: { ...current.privacy, ...(settings.privacy || {}) },
    security: { ...current.security, ...(settings.security || {}) },
    performance: { ...current.performance, ...(settings.performance || {}) },
    advanced: { ...current.advanced, ...(settings.advanced || {}) },
  };

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(SETTINGS_KEY, JSON.stringify(merged), now);

  return merged;
}

export function verifyAppPinCheck(pin: string): boolean {
  const db = getDatabase();
  const settings = getAppSettings();
  if (!settings.security.appLockEnabled || !settings.security.appLockPinHash) {
    return true; // No pin set
  }

  const saltRow = db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get(PIN_SALT_KEY) as {
    value_json: string;
  } | undefined;

  if (!saltRow) return false;
  const salt = saltRow.value_json;

  return verifyPin(pin, settings.security.appLockPinHash, salt);
}

export function setAppPinCode(newPin: string, oldPin?: string): boolean {
  const db = getDatabase();
  const settings = getAppSettings();

  if (settings.security.appLockEnabled && settings.security.appLockPinHash) {
    if (!oldPin || !verifyAppPinCheck(oldPin)) {
      throw new Error('Current PIN is incorrect');
    }
  }

  const { hash, salt } = hashPin(newPin);
  const now = new Date().toISOString();

  // Store salt
  db.prepare(`
    INSERT INTO app_settings (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(PIN_SALT_KEY, salt, now);

  // Update App Settings
  saveAppSettings({
    security: {
      ...settings.security,
      appLockEnabled: true,
      appLockPinHash: hash,
    },
  });

  logActivity('SECURITY', 'SUCCESS', 'PIN Changed', 'Application lock PIN was set/updated');

  return true;
}

export const updateAppSettings = saveAppSettings;
