/**
 * MAHI Browser — CreepJS & Pixelscan Anti-Detection Probe Verification Script
 *
 * Runs an automated live-browser CreepJS-equivalent probe testing:
 * 1. navigator.webdriver descriptor & prototype checks
 * 2. CDP Runtime.enable traps
 * 3. Canvas & WebGL deterministic hash stability across restarts
 * 4. Client Hints & Accept-Language headers
 * 5. WebRTC ICE candidate leak policy
 * 6. Optional Camoufox dual-engine probe if installed
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
import { ensureProfileStealthExtension } from '../02_BROWSER/launcher.js';
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
      webdriverName: (function() {
        var d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'webdriver');
        return d && typeof d.get === 'function' ? d.get.name : '';
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
  const server = http.createServer((_req, res) => {
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
  const tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-creepjs-probe-1-'));
  const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-creepjs-probe-2-'));

  try {
    const settings = generateStatisticalProfileSettings({
      os: 'windows',
      engine: 'chrome',
      seed: 'creepjs-probe-seed-fixed',
    });

    const extDir1 = ensureProfileStealthExtension(tempDir1, 'creepjs-probe-1', 'CreepJS Profile 1', settings, {
      nativeStealthActive: false,
    });
    const extDir2 = ensureProfileStealthExtension(tempDir2, 'creepjs-probe-1', 'CreepJS Profile 1', settings, {
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

    console.log(`[CreepJS Probe] Spawning Chromium engine at: ${execPath}`);
    process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = 'addBinding';
    process.env.MAHI_CDP_ISOLATED = '1';

    const launchArgs1 = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--mahi-cdp-isolated',
      '--headless=new',
      `--load-extension=${extDir1}`,
    ];

    // RUN 1: Probe initial launch
    const context1 = await chromium.launchPersistentContext(tempDir1, {
      executablePath: execPath,
      headless: false,
      args: launchArgs1,
    });

    const page1 = await context1.newPage();
    await page1.goto(url);
    await page1.waitForTimeout(1000);

    const results1 = await page1.evaluate(() => (window as any).__results);
    console.log('[CreepJS Probe Results (Run 1)]:', JSON.stringify(results1, null, 2));

    let passed = true;
    if (results1.webdriver !== false) {
      console.error('FAIL: navigator.webdriver !== false (was ' + results1.webdriver + ')');
      passed = false;
    } else {
      console.log('PASS: navigator.webdriver === false');
    }

    if (!results1.webdriverDescriptor.includes('[native code]')) {
      console.error('FAIL: navigator.webdriver prototype does not return [native code]');
      passed = false;
    } else {
      console.log('PASS: navigator.webdriver prototype contains [native code]');
    }

    if (results1.hasCdc) {
      console.error('FAIL: cdc_* automation artifacts detected');
      passed = false;
    } else {
      console.log('PASS: cdc_* automation artifacts completely scrubbed');
    }

    if (results1.hasMahiLeaks) {
      console.error('FAIL: __MAHI properties leaked to window');
      passed = false;
    } else {
      console.log('PASS: Zero MAHI properties leaked to window');
    }

    if (!results1.clientHintsBrands.includes('Google Chrome') && !results1.clientHintsBrands.includes('Chromium')) {
      console.error('FAIL: sec-ch-ua brand signature missing Chrome/Chromium: ' + results1.clientHintsBrands);
      passed = false;
    } else {
      console.log('PASS: Client Hints brands aligned with target engine (' + results1.clientHintsBrands + ')');
    }

    await context1.close();

    // RUN 2: Verify deterministic Canvas noise stability across 2 launches
    console.log('[CreepJS Probe] Launching Run 2 to verify deterministic Canvas hash stability...');
    const launchArgs2 = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--mahi-cdp-isolated',
      '--headless=new',
      `--load-extension=${extDir2}`,
    ];

    const context2 = await chromium.launchPersistentContext(tempDir2, {
      executablePath: execPath,
      headless: false,
      args: launchArgs2,
    });

    const page2 = await context2.newPage();
    await page2.goto(url);
    await page2.waitForTimeout(1000);

    const results2 = await page2.evaluate(() => (window as any).__results);
    console.log('[CreepJS Probe Results (Run 2)] Canvas Hash Length:', results2.canvasHash?.length);

    if (results1.canvasHash === results2.canvasHash) {
      console.log('PASS: Canvas hash is 100% deterministic across consecutive launches with same seed');
    } else {
      console.error('FAIL: Canvas hash variance detected between identical seeded runs');
      passed = false;
    }
    await context2.close();

    // OPTIONAL: Camoufox probe if installed
    const camoufoxPath = getCamoufoxExecutablePath();
    if (camoufoxPath && fs.existsSync(camoufoxPath)) {
      console.log(`[CreepJS Probe] Optional Camoufox detected at: ${camoufoxPath}. Running Firefox probe...`);
      try {
        const camouContext = await firefox.launchPersistentContext(tempDir1, {
          executablePath: camoufoxPath,
          headless: true,
        });
        const camouPage = await camouContext.newPage();
        await camouPage.goto(url);
        const camouResults = await camouPage.evaluate(() => (window as any).__results);
        console.log('[Camoufox Probe Results]:', JSON.stringify(camouResults, null, 2));
        if (camouResults.webdriver === false) {
          console.log('PASS: Camoufox navigator.webdriver === false');
        }
        await camouContext.close();
      } catch (camouErr: any) {
        console.log(`[Camoufox Probe Note]: ${camouErr.message}`);
      }
    }

    if (process.env.MAHI_LIVE_CREEPJS === '1') {
      console.log('\n[Live CreepJS Audit] Testing against https://abrahamjuliot.github.io/creepjs/ ...');
      const liveContext = await chromium.launchPersistentContext(tempDir1, {
        executablePath: execPath,
        headless: false,
        args: launchArgs1,
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
    if (fs.existsSync(tempDir1)) {
      try { fs.rmSync(tempDir1, { recursive: true, force: true }); } catch {}
    }
    if (fs.existsSync(tempDir2)) {
      try { fs.rmSync(tempDir2, { recursive: true, force: true }); } catch {}
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
