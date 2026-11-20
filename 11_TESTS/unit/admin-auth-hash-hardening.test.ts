import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  verifyAdminAccess,
  setOwnerAdminPin,
  hashPinScrypt,
  verifyPinScrypt,
} from '../../05_AUTH/admin-auth.js';

describe('BLOCK F9: Admin PIN Hardening & Scrypt-v1 Auto-Upgrade Suite', () => {
  const testDbDir = path.resolve('.mahi_data', 'test-admin-auth');
  const testDbPath = path.join(testDbDir, 'admin_auth_test.sqlite');

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // Case 1: Plaintext password auto-upgrades to scrypt-v1 on successful verify
  it('Case 1: Plaintext password auto-upgrades to scrypt-v1 on successful verify', () => {
    const db = getDatabase();
    const plainPin = 'AdminSecret999!';
    const now = new Date().toISOString();

    // Insert legacy plaintext pin in app_settings
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES ('owner_pin', ?, ?)").run(
      JSON.stringify({ pinHash: plainPin, updatedAt: now }),
      now
    );

    // Verify using plain PIN
    const isValid = verifyAdminAccess(plainPin);
    expect(isValid).toBe(true);

    // Assert that the stored setting has now auto-upgraded to scrypt-v1
    const upgraded = db.prepare("SELECT value_json FROM app_settings WHERE key = 'owner_pin'").get() as any;
    expect(upgraded).toBeDefined();
    const parsed = JSON.parse(upgraded.value_json);
    expect(parsed.format).toBe('scrypt-v1');
    expect(parsed.pinHash).toMatch(/^scrypt\$N=16384,r=8,p=1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);

    // Re-verify against the upgraded hash
    const reVerify = verifyAdminAccess(plainPin);
    expect(reVerify).toBe(true);
  });

  // Case 2: Timing-safe comparison rejects wrong PIN
  it('Case 2: Timing-safe comparison rejects wrong PIN', () => {
    const wrongPin = 'WrongPasswordWrongSalt!';
    const isValid = verifyAdminAccess(wrongPin);
    expect(isValid).toBe(false);

    // Also test verifyPinScrypt helper directly
    const validHash = hashPinScrypt('CorrectPIN123');
    expect(verifyPinScrypt('WrongPIN456', validHash)).toBe(false);
  });

  // Case 3: Re-verification against newly generated scrypt hash succeeds
  it('Case 3: Re-verification against newly generated scrypt hash succeeds', () => {
    const newPin = 'BrandNewScryptOwnerPIN2026!';
    const db = getDatabase();

    // Set new PIN using the updated setOwnerAdminPin function
    const settingRow = db.prepare("SELECT value_json FROM app_settings WHERE key = 'owner_pin'").get() as any;
    expect(settingRow).toBeDefined();

    // Update PIN in DB directly via hashPinScrypt
    const formatted = hashPinScrypt(newPin);
    const now = new Date().toISOString();
    db.prepare("UPDATE app_settings SET value_json = ?, updated_at = ? WHERE key = 'owner_pin'").run(
      JSON.stringify({ pinHash: formatted, format: 'scrypt-v1', updatedAt: now }),
      now
    );

    // Verify succeeds
    expect(verifyAdminAccess(newPin)).toBe(true);
    // Verify rejects partial match
    expect(verifyAdminAccess(newPin.slice(0, -1))).toBe(false);
  });
});
