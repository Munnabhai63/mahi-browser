import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import {
  getExtensions,
  installExtension,
  installFromWebStoreUrl,
  toggleExtension,
  removeExtension,
} from '../../02_BROWSER/services/extension-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 12: Chrome Extension Management & Direct CRX Installer Suite', () => {
  let tempDir: string;
  let p1Id: string;
  let p2Id: string;
  let sampleExtPath: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase12-ext-'));
    const testDbPath = path.join(tempDir, 'test_phase12.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    // Create a mock unpacked extension folder
    sampleExtPath = path.join(tempDir, 'sample-extension');
    fs.mkdirSync(sampleExtPath, { recursive: true });
    fs.writeFileSync(
      path.join(sampleExtPath, 'manifest.json'),
      JSON.stringify({
        name: 'Mahi Security Shield',
        version: '1.2.0',
        manifest_version: 3,
        description: 'Native anti-detect protection extension',
      }),
      'utf8'
    );

    // Create 2 test profiles
    const prof1 = createProfile({
      name: 'Ext-Profile-1',
      folder: 'Social',
      settings: getDefaultProfileSettings(),
    });
    const prof2 = createProfile({
      name: 'Ext-Profile-2',
      folder: 'Crypto',
      settings: getDefaultProfileSettings(),
    });

    p1Id = prof1.id;
    p2Id = prof2.id;
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should install an unpacked extension into a single profile', async () => {
    const installed = await installExtension({
      profileId: p1Id,
      name: 'Mahi Security Shield',
      version: '1.2.0',
      source: 'unpacked',
      location: sampleExtPath,
    });

    expect(installed).toBeDefined();
    expect(installed.name).toBe('Mahi Security Shield');
    expect(installed.enabled).toBe(true);

    const exts = getExtensions(p1Id);
    expect(exts.length).toBe(1);
    expect(exts[0].name).toBe('Mahi Security Shield');
  });

  it('should toggle extension enabled status and remove cleanly', () => {
    const exts = getExtensions(p1Id);
    const target = exts[0];

    // Toggle off
    toggleExtension(p1Id, target.id, false);
    let updated = getExtensions(p1Id);
    expect(updated.find((e) => e.id === target.id)?.enabled).toBe(false);

    // Toggle back on
    toggleExtension(p1Id, target.id, true);
    updated = getExtensions(p1Id);
    expect(updated.find((e) => e.id === target.id)?.enabled).toBe(true);

    // Remove
    removeExtension(p1Id, target.id);
    updated = getExtensions(p1Id);
    expect(updated.find((e) => e.id === target.id)).toBeUndefined();
  });
});
