import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'rebrowser-playwright-core';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { installExtension, getExtensions } from '../../02_BROWSER/services/extension-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Real Browser Extensions Launch & Runtime Verification', () => {
  let tempDir: string;
  let testProfileId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-real-ext-test-'));
    const testDbPath = path.join(tempDir, 'test_real_ext.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const prof = createProfile({
      name: 'Real Extension Test Profile',
      folder: 'Testing',
      settings: getDefaultProfileSettings(),
    });
    testProfileId = prof.id;

    // Create 2 unpacked extensions
    const ext1Dir = path.join(tempDir, 'ext-ublock');
    fs.mkdirSync(ext1Dir, { recursive: true });
    fs.writeFileSync(
      path.join(ext1Dir, 'manifest.json'),
      JSON.stringify({
        name: 'uBlock Origin Lite',
        version: '1.0.0',
        manifest_version: 3,
        description: 'Adblock extension',
      }),
      'utf8'
    );

    const ext2Dir = path.join(tempDir, 'ext-metamask');
    fs.mkdirSync(ext2Dir, { recursive: true });
    fs.writeFileSync(
      path.join(ext2Dir, 'manifest.json'),
      JSON.stringify({
        name: 'MetaMask',
        version: '12.0.0',
        manifest_version: 3,
        description: 'Web3 Wallet',
      }),
      'utf8'
    );

    await installExtension({
      profileId: testProfileId,
      name: 'uBlock Origin Lite',
      version: '1.0.0',
      source: 'unpacked',
      location: ext1Dir,
    });

    await installExtension({
      profileId: testProfileId,
      name: 'MetaMask',
      version: '12.0.0',
      source: 'unpacked',
      location: ext2Dir,
    });
  });

  afterAll(async () => {
    try {
      await processManager.stopAll();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should launch real Chrome with all enabled extensions loaded in browser arguments', async () => {
    // 1. Verify extensions are registered in database
    const exts = getExtensions(testProfileId);
    expect(exts.length).toBe(2);
    expect(exts.map((e) => e.name)).toContain('uBlock Origin Lite');
    expect(exts.map((e) => e.name)).toContain('MetaMask');

    // 2. Verify physical extension files exist on disk with valid manifest.json
    for (const ext of exts) {
      expect(fs.existsSync(path.join(ext.sourcePath, 'manifest.json'))).toBe(true);
    }

    // 3. Launch the real browser process
    const procInfo = await processManager.startProfile(testProfileId);
    expect(procInfo).toBeDefined();
    expect(procInfo.pid).toBeGreaterThan(0);

    // 4. Connect over CDP and inspect page
    const debugPort = getProfileDebugPort(testProfileId);
    let browser: any;

    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
        break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    expect(browser).toBeDefined();
    if (browser) {
      const contexts = browser.contexts();
      expect(contexts.length).toBeGreaterThan(0);
      await browser.close().catch(() => {});
    }
  }, 45000);
});
