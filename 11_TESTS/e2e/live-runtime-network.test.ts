import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('STEP 20 — LIVE RUNTIME NETWORK CONNECTIVITY E2E TEST', () => {
  let tempDir: string;
  let profileId: string;
  let debugPort: number;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-live-net-'));
    const testDbPath = path.join(tempDir, 'live_network_test.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const prof = createProfile({
      name: 'Live Forensic Network Profile',
      folder: 'NetworkAudit',
      settings: getDefaultProfileSettings(),
    });
    profileId = prof.id;
    debugPort = getProfileDebugPort(profileId);
  });

  afterAll(async () => {
    try {
      await processManager.stopAll();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('verifies new profile with NO proxy connects to real internet: example.com, google.com, search, ipify, and profile reopen', async () => {
    // 1. Launch profile
    console.log('[LIVE TEST] Launching profile with direct connection...');
    const startResult = await processManager.startProfile(profileId);
    expect(startResult).toBeDefined();
    expect(processManager.isRunning(profileId)).toBe(true);

    let browser: any;
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    expect(browser).toBeDefined();

    try {
      const contexts = browser.contexts();
      expect(contexts.length).toBeGreaterThan(0);
      const page = contexts[0].pages()[0] || (await contexts[0].newPage());

      // Test A: example.com
      console.log('[LIVE TEST] Navigating to https://example.com...');
      const exResp = await page.goto('https://example.com', { timeout: 20000 });
      expect(exResp?.status()).toBe(200);
      const exTitle = await page.title();
      expect(exTitle.toLowerCase()).toContain('example');
      console.log('[LIVE TEST] Example.com PASS! Status: 200, Title:', exTitle);

      // Test B: google.com
      console.log('[LIVE TEST] Navigating to https://www.google.com...');
      const googleResp = await page.goto('https://www.google.com', { timeout: 20000 });
      expect(googleResp?.status()).toBe(200);
      const googleUrl = page.url();
      expect(googleUrl).toContain('google.com');
      console.log('[LIVE TEST] Google.com PASS! Status: 200, URL:', googleUrl);

      // Test C: google.com search query
      console.log('[LIVE TEST] Executing search query: https://www.google.com/search?q=mahi+browser...');
      const searchResp = await page.goto('https://www.google.com/search?q=mahi+browser', { timeout: 20000 });
      expect(searchResp?.status()).toBe(200);
      console.log('[LIVE TEST] Google Search PASS! Status: 200, URL:', page.url());

      // Test D: api.ipify.org
      console.log('[LIVE TEST] Querying public IP: https://api.ipify.org?format=json...');
      const ipResp = await page.goto('https://api.ipify.org?format=json', { timeout: 20000 });
      expect(ipResp?.status()).toBe(200);
      const ipContent = await page.textContent('body');
      expect(ipContent).toContain('ip');
      console.log('[LIVE TEST] Public IP endpoint PASS! Result:', ipContent?.trim());
    } finally {
      if (browser) await browser.close().catch(() => {});
      await processManager.stopProfile(profileId);
    }

    expect(processManager.isRunning(profileId)).toBe(false);
    console.log('[LIVE TEST] First run closed cleanly.');

    // Allow Windows file handles and CDP sockets to completely detach
    await new Promise((r) => setTimeout(r, 1500));

    // 2. Reopen Profile Test
    console.log('[LIVE TEST] Reopening profile to verify session persistence and internet...');
    await processManager.startProfile(profileId);
    expect(processManager.isRunning(profileId)).toBe(true);

    let reopenBrowser: any;
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        reopenBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    expect(reopenBrowser).toBeDefined();

    try {
      const contexts = reopenBrowser.contexts();
      const page = contexts[0].pages()[0] || (await contexts[0].newPage());
      const reopenResp = await page.goto('https://example.com', { timeout: 20000 });
      expect(reopenResp?.status()).toBe(200);
      const reopenTitle = await page.title();
      expect(reopenTitle.toLowerCase()).toContain('example');
      console.log('[LIVE TEST] Reopened profile PASS! Status: 200, Title:', reopenTitle);
    } finally {
      if (reopenBrowser) await reopenBrowser.close().catch(() => {});
      await processManager.stopProfile(profileId);
    }

    console.log('[LIVE TEST] Profile reopened and verified successfully!');
  }, 90000);
});
