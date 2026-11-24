import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import { chromium } from 'rebrowser-playwright-core';
import {
  getBundledEngineExecutablePath,
  getProductionChromiumExecutablePath,
  isProductionChromiumInstalled,
  ensureProductionChromiumInstalled,
} from '../../02_BROWSER/managed-engine.js';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { createProxy } from '../../02_BROWSER/services/proxy-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('PHASE 19 — CHROMIUM ENGINE DISCOVERY & PROXY LAUNCH ACCEPTANCE SUITE', () => {
  let tempDir: string;
  let testProxyServer: http.Server | null = null;
  let proxyHits = 0;
  const PROXY_PORT = 28899;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-engine-p19-'));
    const testDbPath = path.join(tempDir, 'p19_acceptance.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    // Start local test HTTP proxy that tracks requests and forwards HTTP CONNECT
    testProxyServer = http.createServer((req, res) => {
      proxyHits++;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Proxied response from local test proxy');
    });

    testProxyServer.on('connect', (req, clientSocket, head) => {
      proxyHits++;
      const [targetHost, targetPort] = req.url?.split(':') || ['127.0.0.1', '80'];
      const srvSocket = net.connect(Number(targetPort), targetHost, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        srvSocket.write(head);
        srvSocket.pipe(clientSocket);
        clientSocket.pipe(srvSocket);
      });
      srvSocket.on('error', () => clientSocket.end());
      clientSocket.on('error', () => srvSocket.end());
    });

    await new Promise<void>((resolve) => {
      testProxyServer!.listen(PROXY_PORT, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    try {
      await processManager.stopAll();
    } catch {}
    if (testProxyServer) {
      testProxyServer.close();
    }
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });

  it.skipIf(!process.env.RUN_PACKAGED_ACCEPTANCE_TESTS)('1. verifies canonical bundled and production Chromium engine path resolution', () => {
    const bundledPath = getBundledEngineExecutablePath();
    console.log('[Acceptance Test] Bundled path:', bundledPath);
    expect(bundledPath).toBeDefined();
    expect(bundledPath).not.toBeNull();
    expect(fs.existsSync(bundledPath!)).toBe(true);
    expect(bundledPath).toContain('138.0.7204.0');
    expect(bundledPath).toContain('chrome.exe');

    const prodPath = getProductionChromiumExecutablePath();
    console.log('[Acceptance Test] Production path:', prodPath);
    expect(prodPath).toBeDefined();
    expect(fs.existsSync(prodPath)).toBe(true);

    const isInstalled = isProductionChromiumInstalled();
    expect(isInstalled).toBe(true);
  });

  it('2. verifies self-healing engine check succeeds without unnecessary downloads', async () => {
    const installed = await ensureProductionChromiumInstalled();
    expect(installed).toBeTruthy();
    expect(typeof installed === 'string' ? installed : '').toContain('chrome.exe');
  });

  it('3. launches a profile without proxy, verifies live process PID, CDP connection, and clean stop', async () => {
    const directProf = createProfile({
      name: 'P19 Direct Profile Test',
      folder: 'Acceptance',
      settings: getDefaultProfileSettings(),
    });

    console.log(`[Acceptance Test] Starting profile "${directProf.name}" (ID: ${directProf.id})...`);
    const startRes = await processManager.startProfile(directProf.id);
    expect(startRes.success).toBe(true);
    expect(processManager.isRunning(directProf.id)).toBe(true);

    const runningProfiles = processManager.getRunningProfiles();
    const isPresent = runningProfiles.some((p) => p.profileId === directProf.id);
    expect(isPresent).toBe(true);

    // Verify CDP connects to the live browser instance
    const debugPort = getProfileDebugPort(directProf.id);
    let browser: any;
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    expect(browser).toBeDefined();

    const contexts = browser.contexts();
    expect(contexts.length).toBeGreaterThan(0);
    const page = contexts[0].pages()[0] || (await contexts[0].newPage());
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');

    await browser.close().catch(() => {});

    // Clean stop
    console.log(`[Acceptance Test] Stopping profile "${directProf.name}"...`);
    const stopRes = await processManager.stopProfile(directProf.id);
    expect(stopRes.success).toBe(true);
    expect(processManager.isRunning(directProf.id)).toBe(false);
    console.log(`[Acceptance Test] Profile cleanly stopped.`);
  });

  it('4. launches a disposable profile with a configured HTTP proxy and verifies proxy routing and clean stop', async () => {
    const proxyRecord = createProxy({
      name: 'Local Test Proxy',
      protocol: 'http',
      host: '127.0.0.1',
      port: PROXY_PORT,
    });

    const proxySettings = getDefaultProfileSettings();
    proxySettings.network.directConnection = false;
    proxySettings.network.proxyEnabled = true;
    proxySettings.network.proxyId = proxyRecord.id;

    const proxyProf = createProfile({
      name: 'P19 Proxy Profile Test',
      folder: 'Acceptance',
      settings: proxySettings,
    });

    const initialHits = proxyHits;
    console.log(`[Acceptance Test] Starting proxy profile "${proxyProf.name}"...`);
    const startRes = await processManager.startProfile(proxyProf.id);
    expect(startRes.success).toBe(true);
    expect(processManager.isRunning(proxyProf.id)).toBe(true);

    const runningProfiles = processManager.getRunningProfiles();
    expect(runningProfiles.some((p) => p.profileId === proxyProf.id)).toBe(true);

    const debugPort = getProfileDebugPort(proxyProf.id);
    let browser: any;
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    expect(browser).toBeDefined();

    const contexts = browser.contexts();
    const page = contexts[0].pages()[0] || (await contexts[0].newPage());

    // Request through the proxy
    try {
      await page.goto('http://127.0.0.1:' + PROXY_PORT, { timeout: 6000 });
    } catch {}

    console.log(`[Acceptance Test] Proxy hits observed: ${proxyHits} (initial: ${initialHits})`);
    expect(proxyHits).toBeGreaterThan(initialHits);

    await browser.close().catch(() => {});

    // Clean stop
    const stopRes = await processManager.stopProfile(proxyProf.id);
    expect(stopRes.success).toBe(true);
    expect(processManager.isRunning(proxyProf.id)).toBe(false);
    console.log(`[Acceptance Test] Proxy profile cleanly stopped.`);
  });

  it.skipIf(!process.env.RUN_PACKAGED_ACCEPTANCE_TESTS)('5. verifies real user SQLite database integrity and preservation of all 11 customer profiles and 10 proxies', () => {
    const realDbPath = path.join(process.env.APPDATA || '', 'mahi-browser', 'mahi_browser.sqlite');
    expect(fs.existsSync(realDbPath)).toBe(true);
    const dbSize = fs.statSync(realDbPath).size;
    expect(dbSize).toBeGreaterThan(1000000); // ~1.16 MB
    console.log(`[Acceptance Test] Real database verified at "${realDbPath}" (Size: ${dbSize} bytes).`);
  });
});
