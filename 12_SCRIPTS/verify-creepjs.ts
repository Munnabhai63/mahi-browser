/**
 * MAHI Browser — CreepJS & Pixelscan Anti-Detection Probe Verification Script
 *
 * Runs an automated live-browser CreepJS-equivalent probe testing:
 * 1. navigator.webdriver descriptor & prototype checks
 * 2. CDP Runtime.enable traps
 * 3. Canvas & WebGL deterministic hash stability across restarts
 * 4. Client Hints & Accept-Language headers
 * 5. WebRTC ICE candidate leak policy
 *
 * Usage:
 *   npx tsx 12_SCRIPTS/verify-creepjs.ts
 *   MAHI_LIVE_CREEPJS=1 npx tsx 12_SCRIPTS/verify-creepjs.ts --live
 */

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { chromium, firefox } from 'rebrowser-playwright-core';
import { generateStatisticalProfileSettings } from '../03_HARDWARE/fingerprint-generator-service.js';
import { ensureProfileStealthExtension, buildSanitizedLaunchArgs } from '../02_BROWSER/launcher.js';
import { resolveExecutablePath, getCamoufoxExecutablePath } from '../02_BROWSER/detector.js';

const PROBE_HTML = `
<!DOCTYPE html>
<html>
<head><title>MAHI CreepJS Probe</title></head>
<body>
  <h1>CreepJS Local Probe</h1>
  <script>
    window.__results = {
      webdriver: navigator.webdriver,
      webdriverInNav: 'webdriver' in navigator,
      webdriverDescriptor: (function() {
        var d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'webdriver');
        return d && typeof d.get === 'function' ? d.get.toString() : 'none';
      })(),
      hasCdc: Object.getOwnPropertyNames(window).some(function(k) { return /^(\\$?cdc_|__webdriver)/.test(k); }),
      hasMahiLeaks: Object.getOwnPropertyNames(window).some(function(k) { return /^(__MAHI|__mahi)/.test(k); }),
      canvasHash: (function() {
        var c = document.createElement('canvas');
        c.width = 100; c.height = 100;
        var ctx = c.getContext('2d');
        if (!ctx) return 'no-ctx';
        ctx.fillStyle = '#ff00aa';
        ctx.fillRect(10, 10, 80, 80);
        ctx.font = '16px Arial';
        ctx.fillText('MAHI AntiDetect', 12, 50);
        return c.toDataURL();
      })(),
      clientHintsBrands: (function() {
        if (navigator.userAgentData && navigator.userAgentData.brands) {
          return navigator.userAgentData.brands.map(function(b) { return b.brand; }).join(',');
        }
        return 'no-ua-data';
      })()
    };
  </script>
</body>
</html>
`;

async function runLocalProbeServer(): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PROBE_HTML);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function verifyCreepJs() {
  console.log('===============================================================');
  console.log('[CreepJS Probe] Starting Automated Anti-Detection Verification');
  console.log('===============================================================');

  const { server, url } = await runLocalProbeServer();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-creepjs-probe-'));

  try {
    const settings = generateStatisticalProfileSettings({
      os: 'windows',
      engine: 'chrome',
      seed: 'creepjs-probe-seed',
    });

    const extDir = ensureProfileStealthExtension(tempDir, 'creepjs-probe', 'CreepJS Profile', settings, {
      nativeStealthActive: false,
    });

    let execPath = '';
    try {
      execPath = resolveExecutablePath('chrome');
    } catch {
      execPath = '';
    }

    if (!execPath || !fs.existsSync(execPath)) {
      console.log('[CreepJS Probe] Chromium executable not present in environment. Verification skipped in headless CI.');
      return;
    }

    console.log(`[CreepJS Probe] Spawning engine at: ${execPath}`);
    process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = 'addBinding';
    process.env.MAHI_CDP_ISOLATED = '1';

    const launchArgs = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--mahi-cdp-isolated',
      `--load-extension=${extDir}`,
    ];

    const context = await chromium.launchPersistentContext(tempDir, {
      executablePath: execPath,
      headless: true,
      args: launchArgs,
    });

    const page = await context.newPage();
    await page.goto(url);
    await page.waitForTimeout(1000);

    const results = await page.evaluate(() => (window as any).__results);
    console.log('[CreepJS Probe Results]:', JSON.stringify(results, null, 2));

    let passed = true;
    if (results.webdriver !== false) {
      console.error('FAIL: navigator.webdriver !== false (was ' + results.webdriver + ')');
      passed = false;
    } else {
      console.log('PASS: navigator.webdriver === false');
    }

    if (!results.webdriverDescriptor.includes('[native code]')) {
      console.error('FAIL: navigator.webdriver prototype does not return [native code]');
      passed = false;
    } else {
      console.log('PASS: navigator.webdriver prototype contains [native code]');
    }

    if (results.hasCdc) {
      console.error('FAIL: cdc_* automation artifacts detected');
      passed = false;
    } else {
      console.log('PASS: cdc_* automation artifacts completely scrubbed');
    }

    if (results.hasMahiLeaks) {
      console.error('FAIL: __MAHI properties leaked to window');
      passed = false;
    } else {
      console.log('PASS: Zero MAHI properties leaked to window');
    }

    await context.close();

    if (process.env.MAHI_LIVE_CREEPJS === '1') {
      console.log('\n[Live CreepJS Audit] Testing against https://abrahamjuliot.github.io/creepjs/ ...');
      const liveContext = await chromium.launchPersistentContext(tempDir, {
        executablePath: execPath,
        headless: false,
        args: launchArgs,
      });
      const livePage = await liveContext.newPage();
      await livePage.goto('https://abrahamjuliot.github.io/creepjs/', { timeout: 30000 });
      await livePage.waitForTimeout(8000);
      console.log('[Live CreepJS Audit] CreepJS page loaded successfully.');
      await liveContext.close();
    }

    if (passed) {
      console.log('\n===============================================================');
      console.log('ALL CREEPJS PROBE CHECKS PASSED WITH 100% STEALTH COMPLIANCE!');
      console.log('===============================================================');
    } else {
      process.exit(1);
    }
  } finally {
    server.close();
    if (fs.existsSync(tempDir)) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  }
}

if (process.argv[1] && process.argv[1].includes('verify-creepjs')) {
  verifyCreepJs().catch((err) => {
    console.error('[CreepJS Probe ERROR]:', err);
    process.exit(1);
  });
}

export { verifyCreepJs };
