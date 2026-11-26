import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getProfileById, getProfiles } from '../../02_BROWSER/services/profile-service.js';
import { closeDatabase, getDatabase, initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  getDefaultProfileSettings,
  parseStoredProfileSettings,
} from '../../10_CONFIG/shared/constants/defaults.js';
import { ProfileSettingsSchema } from '../../10_CONFIG/shared/validation/schemas.js';

describe('LAYER 0 TASK 0.2: Tolerant Settings Parser & Passthrough Schemas', () => {
  let tempDir: string;
  let prevUserDataDir: string | undefined;

  beforeEach(async () => {
    prevUserDataDir = process.env.MAHI_USER_DATA_DIR;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer0-settings-'));
    process.env.MAHI_USER_DATA_DIR = tempDir;
    setCustomDatabasePath(path.join(tempDir, 'mahi_browser.sqlite'));
    await initSqlEngine();
    await initializeDatabase();
  });

  afterEach(() => {
    closeDatabase();
    if (prevUserDataDir !== undefined) {
      process.env.MAHI_USER_DATA_DIR = prevUserDataDir;
    } else {
      delete process.env.MAHI_USER_DATA_DIR;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('sets settingsVersion = 0 in default settings', () => {
    const defaults = getDefaultProfileSettings();
    expect(defaults.settingsVersion).toBe(0);
  });

  it('preserves unknown top-level and nested future keys without modifying stored SQLite settings JSON', () => {
    const db = getDatabase();
    const profileId = crypto.randomUUID();
    const now = new Date().toISOString();

    const legacyPlusFutureJson = JSON.stringify({
      browser: {
        engine: 'chrome',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        futureBrowserFlag: 'keep-me-browser',
      },
      display: {
        screenWidth: 1440,
        screenHeight: 900,
        futureHdrMode: true,
      },
      locale: {
        language: 'de-DE',
        timezone: 'Europe/Berlin',
        futureLocaleTag: 'de-DE-u-hc-h24',
      },
      network: {
        webrtc: 'default',
        futureProxyChain: ['socks5://hop1', 'http://hop2'],
      },
      fingerprint: {
        webglVendor: 'Custom Vendor',
        futureWebGpuNoiseSeed: 987654321,
      },
      futureRootSection: {
        enabled: true,
        customThresholds: [1, 2, 3],
      },
      legacyExtraString: 'untouched-user-value',
    });

    db.prepare(`
      INSERT INTO profiles (id, name, description, folder, notes, status, storage_path, pinned, owner_id, created_at, updated_at)
      VALUES (?, ?, '', 'General', '', 'STOPPED', ?, 0, 'SYSTEM_OWNER', ?, ?)
    `).run(profileId, 'Legacy + Future Profile', path.join(tempDir, 'profiles', profileId), now, now);

    db.prepare(`
      INSERT INTO profile_settings (profile_id, settings_json)
      VALUES (?, ?)
    `).run(profileId, legacyPlusFutureJson);

    // Load via both getProfileById and getProfiles
    const loadedSingle = getProfileById(profileId);
    expect(loadedSingle).not.toBeNull();
    const settingsSingle = loadedSingle!.settings as any;

    // Stored unknown keys survived cleanly at both root and nested sections
    expect(settingsSingle.legacyExtraString).toBe('untouched-user-value');
    expect(settingsSingle.futureRootSection).toEqual({
      enabled: true,
      customThresholds: [1, 2, 3],
    });
    expect(settingsSingle.browser.futureBrowserFlag).toBe('keep-me-browser');
    expect(settingsSingle.display.futureHdrMode).toBe(true);
    expect(settingsSingle.locale.futureLocaleTag).toBe('de-DE-u-hc-h24');
    expect(settingsSingle.network.futureProxyChain).toEqual(['socks5://hop1', 'http://hop2']);
    expect(settingsSingle.fingerprint.futureWebGpuNoiseSeed).toBe(987654321);

    // Missing nested defaults populated safely at runtime
    expect(settingsSingle.settingsVersion).toBe(0);
    expect(settingsSingle.display.deviceScaleFactor).toBe(1);
    expect(settingsSingle.display.colorDepth).toBe(24);
    expect(settingsSingle.locale.languagesList).toEqual(['en-US', 'en']);
    expect(settingsSingle.network.directConnection).toBe(true);
    expect(settingsSingle.permissions.notifications).toBe('prompt');

    // getProfiles() also applies tolerant deep-merge
    const loadedList = getProfiles();
    const listItem = loadedList.find((p) => p.id === profileId);
    expect((listItem?.settings as any)?.futureRootSection).toEqual({
      enabled: true,
      customThresholds: [1, 2, 3],
    });

    // Stored row in SQLite must NEVER be rewritten on load
    const storedRowAfter = db
      .prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?')
      .get(profileId) as { settings_json: string };
    expect(storedRowAfter.settings_json).toBe(legacyPlusFutureJson);
  });

  it('validates settings with Zod .passthrough() without stripping unknown fields', () => {
    const parsed = parseStoredProfileSettings({
      browser: {
        engine: 'chrome',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
        futureEdgeOpt: 42,
      },
      network: {
        directConnection: true,
        webrtc: 'default',
        futureQuicMode: 'auto',
      },
      customTopLevelMeta: { note: 'preserve' },
    });

    const validated = ProfileSettingsSchema.parse(parsed) as any;
    expect(validated.customTopLevelMeta).toEqual({ note: 'preserve' });
    expect(validated.browser.futureEdgeOpt).toBe(42);
    expect(validated.network.futureQuicMode).toBe('auto');
  });
});
