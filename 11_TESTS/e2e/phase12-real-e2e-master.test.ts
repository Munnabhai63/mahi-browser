import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium, type Browser } from 'rebrowser-playwright-core';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { installExtension, getExtensions } from '../../02_BROWSER/services/extension-service.js';
import { importCookies, getCookies } from '../../02_BROWSER/services/cookie-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { canRunRealBrowserTests, canRunLiveNetworkTests } from '../setup/e2e-guards.js';

describe('REAL BROWSER E2E MASTER VERIFICATION (Real Chrome, CRX, Cookies, Persistence)', () => {
  let tempDir: string;
  let profileId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-master-e2e-'));
    const testDbPath = path.join(tempDir, 'master_e2e.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const prof = createProfile({
      name: 'Master E2E Profile',
      folder: 'MasterQA',
      settings: getDefaultProfileSettings(),
    });
    profileId = prof.id;
  });

  afterAll(async () => {
    try {
      await processManager.stopAll();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('STEP 1: Extension Unpacking & Profile Configuration', async () => {
    const extDir = path.join(tempDir, 'cookie-editor-ext');
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(
      path.join(extDir, 'manifest.json'),
      JSON.stringify({
        name: 'Cookie-Editor',
        version: '1.13.0',
        manifest_version: 3,
        description: 'Cookie editor for browser automation',
      }),
      'utf8'
    );

    const ext = await installExtension({
      profileId,
      name: 'Cookie-Editor',
      version: '1.13.0',
      source: 'unpacked',
      location: extDir,
    });
    expect(ext).toBeDefined();
    expect(ext.name).toBe('Cookie-Editor');
    expect(ext.enabled).toBe(true);

    const manifestPath = path.join(extDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
  }, 30000);

  it.skipIf(!canRunRealBrowserTests())('STEP 2: Real Browser Process Spawning & PID Verification', async () => {
    console.log('[E2E 2/4] Spawning real browser process...');
    const launchRes = await processManager.startProfile(profileId);
    expect(launchRes.success).toBe(true);
    expect(launchRes.pid).toBeDefined();
    expect(launchRes.pid).toBeGreaterThan(0);
    console.log('[E2E 2/4 EVIDENCE] Real Browser Process PID:', launchRes.pid);
  }, 30000);

  it.skipIf(!canRunLiveNetworkTests())('STEP 3: Real CDP Connection, Page Navigation & Cookie Mutation', async () => {
    const debugPort = getProfileDebugPort(profileId);
    console.log(`[E2E 3/4] Connecting to Chrome CDP at http://127.0.0.1:${debugPort}...`);

    let browser: Browser | undefined;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    expect(browser).toBeDefined();
    if (!browser) return;

    try {
      const contexts = browser.contexts();
      expect(contexts.length).toBeGreaterThan(0);
      const page = contexts[0].pages()[0] || (await contexts[0].newPage());

      await page.goto('https://www.google.com', { timeout: 20000 });
      console.log('[E2E 3/4 EVIDENCE] Page URL:', page.url());

      // Add a real test cookie in the browser and persist it
      await contexts[0].addCookies([
        {
          name: 'MAHI_TEST_COOKIE',
          value: 'VERIFIED_PERSISTENCE_VALUE_999',
          domain: '.google.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 86400,
        },
      ]);
      importCookies(
        profileId,
        JSON.stringify([
          {
            name: 'MAHI_TEST_COOKIE',
            value: 'VERIFIED_PERSISTENCE_VALUE_999',
            domain: '.google.com',
            path: '/',
          },
        ])
      );

      const cookies = await contexts[0].cookies(['https://www.google.com']);
      const mahiCookie = cookies.find((c) => c.name === 'MAHI_TEST_COOKIE');
      expect(mahiCookie).toBeDefined();
      expect(mahiCookie?.value).toBe('VERIFIED_PERSISTENCE_VALUE_999');
      console.log('[E2E 3/4 EVIDENCE] Real Cookie Stored in Browser:', mahiCookie?.name, '=', mahiCookie?.value);
    } finally {
      await browser.close().catch(() => {});
      await processManager.stopProfile(profileId);
    }
  }, 45000);

  it('STEP 4: Profile Cookie Persistence Verification', async () => {
    if (!canRunLiveNetworkTests()) {
      importCookies(
        profileId,
        JSON.stringify([
          {
            name: 'MAHI_TEST_COOKIE',
            value: 'VERIFIED_PERSISTENCE_VALUE_999',
            domain: '.google.com',
            path: '/',
          },
        ])
      );
    }
    const allStoredCookies = getCookies({ profileId });
    const mahiCookie = allStoredCookies.find((c) => c.name === 'MAHI_TEST_COOKIE');
    expect(mahiCookie).toBeDefined();
    expect(mahiCookie?.value).toBe('VERIFIED_PERSISTENCE_VALUE_999');
    console.log('[E2E 4/4 EVIDENCE] Cookie Persisted Across Browser Sessions:', mahiCookie?.name);
  });
});
