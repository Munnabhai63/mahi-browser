import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile, getProfiles, getProfileById } from '../../02_BROWSER/services/profile-service.js';
import { importCookies, getCookies } from '../../02_BROWSER/services/cookie-service.js';
import {
  exportNetscapeCookies,
  exportProfileToArchive,
  previewProfileArchive,
  importProfileFromArchive,
  exportBulkProfilesToArchive,
  importCrossPlatformProfiles,
} from '../../02_BROWSER/services/archive-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 11: Universal Export, Multi-Profile Backup & Cross-Platform Importer Suite', () => {
  let tempDir: string;
  let profile1Id: string;
  let profile2Id: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase11-archive-'));
    const testDbPath = path.join(tempDir, 'test_phase11.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    // Create 2 test profiles
    const p1 = createProfile({
      name: 'Archive-Profile-1',
      folder: 'Social',
      tags: ['facebook', 'ads'],
      settings: getDefaultProfileSettings(),
    });
    const p2 = createProfile({
      name: 'Archive-Profile-2',
      folder: 'Crypto',
      tags: ['binance'],
      settings: getDefaultProfileSettings(),
    });

    profile1Id = p1.id;
    profile2Id = p2.id;

    // Add cookies to p1
    importCookies(
      profile1Id,
      JSON.stringify([
        {
          name: 'session_id',
          value: 'secret12345',
          domain: '.google.com',
          path: '/',
          secure: true,
          httpOnly: true,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          name: 'user_token',
          value: 'token98765',
          domain: 'amazon.com',
          path: '/cart',
          secure: false,
          httpOnly: false,
        },
      ])
    );
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should export profile cookies to standard Netscape HTTP cookie format (.txt)', () => {
    const netscape = exportNetscapeCookies(profile1Id);
    expect(netscape).toContain('# Netscape HTTP Cookie File');
    expect(netscape).toContain('.google.com');
    expect(netscape).toContain('session_id\tsecret12345');
    expect(netscape).toContain('user_token\ttoken98765');
  });

  it('should export and restore a single profile archive with password protection', () => {
    const archivePath = path.join(tempDir, 'test-profile.mahi-profile');
    const exportRes = exportProfileToArchive({
      profileId: profile1Id,
      targetFilePath: archivePath,
      includeCookies: true,
      includeHistory: false,
      includeExtensions: false,
      includeBrowserSettings: true,
      password: 'MahiSecretPassword123!',
    });

    expect(exportRes.success).toBe(true);
    expect(fs.existsSync(archivePath)).toBe(true);

    // Preview without password should indicate encryption
    const lockedPreview = previewProfileArchive(archivePath);
    expect(lockedPreview.isEncrypted).toBe(true);

    // Preview with valid password
    const unlockedPreview = previewProfileArchive(archivePath, 'MahiSecretPassword123!');
    expect(unlockedPreview.valid).toBe(true);
    expect(unlockedPreview.profileName).toBe('Archive-Profile-1');
    expect(unlockedPreview.cookieCount).toBe(2);

    // Import from archive
    const imported = importProfileFromArchive({
      sourceFilePath: archivePath,
      password: 'MahiSecretPassword123!',
      overrideName: 'Restored-Profile-1',
      targetFolder: 'Restored',
    });

    expect(imported).toBeDefined();
    expect(imported.name).toBe('Restored-Profile-1');
    expect(imported.folder).toBe('Restored');

    const importedCookies = getCookies({ profileId: imported.id });
    expect(importedCookies.length).toBe(2);
  });

  it('should export multiple profiles into a single bulk backup archive (.mahi-backup)', () => {
    const bulkBackupPath = path.join(tempDir, 'workspace-bulk.mahi-backup');
    const bulkRes = exportBulkProfilesToArchive({
      profileIds: [profile1Id, profile2Id],
      targetFilePath: bulkBackupPath,
      includeCookies: true,
      includeHistory: false,
      includeExtensions: true,
    });

    expect(bulkRes.success).toBe(true);
    expect(bulkRes.profileCount).toBe(2);
    expect(fs.existsSync(bulkBackupPath)).toBe(true);

    const fileContent = JSON.parse(fs.readFileSync(bulkBackupPath, 'utf8'));
    expect(fileContent.magic).toBe('MAHI_PROFILE_ARCHIVE');
  });

  it('should import cross-platform JSON profiles from Dolphin Anty and AdsPower format', () => {
    const dolphinJson = JSON.stringify([
      {
        name: 'Dolphin Facebook Account 1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        tags: ['fb-farm', 'us-proxy'],
        proxy: {
          host: '198.51.100.25',
          port: 8080,
          type: 'HTTP',
          login: 'user1',
          pass: 'pass1',
        },
        cookies: [
          {
            name: 'c_user',
            value: '100087654321',
            domain: '.facebook.com',
            path: '/',
            secure: true,
          },
        ],
      },
      {
        name: 'AdsPower Crypto Account',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
        tags: ['crypto'],
      },
    ]);

    const importRes = importCrossPlatformProfiles({
      platform: 'DOLPHIN',
      jsonData: dolphinJson,
      targetFolder: 'Cross-Platform-Imports',
    });

    expect(importRes.success).toBe(true);
    expect(importRes.importedCount).toBe(2);
    expect(importRes.profiles[0].name).toBe('Dolphin Facebook Account 1');
    expect(importRes.profiles[0].folder).toBe('Cross-Platform-Imports');
    expect(importRes.profiles[0].settings.browser.userAgent).toContain('Chrome/120.0.0.0');

    // Check imported cookies for profile 1
    const p1Cookies = getCookies({ profileId: importRes.profiles[0].id });
    expect(p1Cookies.length).toBe(1);
    expect(p1Cookies[0].name).toBe('c_user');
  });
});
