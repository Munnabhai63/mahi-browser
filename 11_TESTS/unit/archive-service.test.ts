import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile, getProfiles } from '../../02_BROWSER/services/profile-service.js';
import { importCookies } from '../../02_BROWSER/services/cookie-service.js';
import {
  exportProfileToArchive,
  previewProfileArchive,
  importProfileFromArchive,
} from '../../02_BROWSER/services/archive-service.js';

describe('Profile Archive Import & Export (.mahi-profile)', () => {
  let profileId = '';
  const testOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-archive-svc-'));

  beforeAll(async () => {
    setCustomDatabasePath(path.join(testOutputDir, 'test_mahi_archive.sqlite'));
    await initializeDatabase();

    const p = createProfile({
      name: 'Archive Source Profile',
      folder: 'ExportTest',
      tags: ['Export', 'Zip'],
      notes: 'Contains confidential data',
    });
    profileId = p.id;

    importCookies(
      profileId,
      JSON.stringify([{ domain: '.test.com', name: 'sess', value: 'secret123', path: '/', secure: true, httpOnly: true }])
    );
  });

  afterAll(() => {
    closeDatabase();
    try { fs.rmSync(testOutputDir, { recursive: true, force: true }); } catch {}
  });

  it('should export a profile with password encryption to a .mahi-profile file', () => {
    const targetFile = path.join(testOutputDir, 'test_export.mahi-profile');
    const result = exportProfileToArchive({
      profileId,
      targetFilePath: targetFile,
      includeCookies: true,
      includeHistory: true,
      includeExtensions: true,
      includeBrowserSettings: true,
      password: 'ProfilePassword2026!',
    });

    expect(result.success).toBe(true);
    expect(fs.existsSync(targetFile)).toBe(true);
  });

  it('should preview an encrypted profile archive and require password', () => {
    const targetFile = path.join(testOutputDir, 'test_export.mahi-profile');

    // Without password
    const previewNoPwd = previewProfileArchive(targetFile);
    expect(previewNoPwd.isEncrypted).toBe(true);
    expect(previewNoPwd.valid).toBe(true);

    // With wrong password
    const previewWrong = previewProfileArchive(targetFile, 'WrongPassword');
    expect(previewWrong.valid).toBe(false);

    // With correct password
    const previewValid = previewProfileArchive(targetFile, 'ProfilePassword2026!');
    expect(previewValid.valid).toBe(true);
    expect(previewValid.profileName).toBe('Archive Source Profile');
    expect(previewValid.cookieCount).toBe(1);
  });

  it('should import the profile archive with password and create a new independent profile', () => {
    const targetFile = path.join(testOutputDir, 'test_export.mahi-profile');

    const imported = importProfileFromArchive({
      sourceFilePath: targetFile,
      password: 'ProfilePassword2026!',
      overrideName: 'Restored Test Profile',
      targetFolder: 'Restored',
    });

    expect(imported).toBeDefined();
    expect(imported.id).not.toBe(profileId);
    expect(imported.name).toBe('Restored Test Profile');
    expect(imported.folder).toBe('Restored');
  });
});
