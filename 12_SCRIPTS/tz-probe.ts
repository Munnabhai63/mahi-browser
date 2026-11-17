/**
 * MAHI Browser — Timezone Diagnostics Probe (FIX-0)
 * Evaluates timezone behavior across Main Thread, Web Worker, and Service Worker.
 */

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { chromium } from 'rebrowser-playwright-core';
import { launchBrowser, getProfileDebugPort } from '../02_BROWSER/launcher.js';
import type { Profile } from '../10_CONFIG/shared/types/profile.js';

interface TzResult {
  context: string;
  offset: number;
  timeZone: string;
  dateString: string;
}

async function runProbe() {
  process.env.MAHI_TZ_DEBUG = '1';

  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-tz-probe-'));
  const targetTz = 'America/New_York';

  // 1. Setup local HTTP server to allow ServiceWorker and Worker testing
  let serverResolve: (results: Record<string, TzResult>) => void;
  const resultsPromise = new Promise<Record<string, TzResult>>((res) => {
    serverResolve = res;
  });

  const collectedResults: Record<string, TzResult> = {};

  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head><title>Timezone Probe</title></head>
<body>
<h1>Timezone Probe Page</h1>
<script>
  (async function() {
    const mainResult = {
      context: 'Main Thread',
      offset: new Date().getTimezoneOffset(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateString: new Date().toString()
    };
    fetch('/report', { method: 'POST', body: JSON.stringify(mainResult) });

    // Web Worker
    try {
      const w = new Worker('/worker.js');
      w.onmessage = (e) => {
        fetch('/report', { method: 'POST', body: JSON.stringify(e.data) });
      };
    } catch(err) {
      fetch('/report', { method: 'POST', body: JSON.stringify({ context: 'Web Worker', offset: NaN, timeZone: 'ERROR: ' + err.message, dateString: '' }) });
    }

    // Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        navigator.serviceWorker.addEventListener('message', (e) => {
          fetch('/report', { method: 'POST', body: JSON.stringify(e.data) });
        });
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage('ping');
        } else {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            navigator.serviceWorker.controller.postMessage('ping');
          });
        }
      } catch(err) {
        fetch('/report', { method: 'POST', body: JSON.stringify({ context: 'Service Worker', offset: NaN, timeZone: 'ERROR: ' + err.message, dateString: '' }) });
      }
    }
  })();
</script>
</body>
</html>`);
    } else if (req.url === '/worker.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(`
        self.postMessage({
          context: 'Web Worker',
          offset: new Date().getTimezoneOffset(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          dateString: new Date().toString()
        });
      `);
    } else if (req.url === '/sw.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(`
        self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
        self.addEventListener('message', (e) => {
          e.source.postMessage({
            context: 'Service Worker',
            offset: new Date().getTimezoneOffset(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            dateString: new Date().toString()
          });
        });
      `);
    } else if (req.url === '/report' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          collectedResults[data.context] = data;
          res.writeHead(200);
          res.end('ok');
          if (collectedResults['Main Thread'] && collectedResults['Web Worker']) {
            // Wait slightly for Service Worker
            setTimeout(() => serverResolve(collectedResults), 500);
          }
        } catch {}
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const serverPort = (server.address() as any).port;
  const probeUrl = `http://127.0.0.1:${serverPort}/`;

  const profileId = 'tz-probe-profile-01';
  const profile: Profile = {
    id: profileId,
    name: 'Timezone Probe Profile',
    status: 'STOPPED',
    storagePath: testDir,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      browser: {
        startupUrl: probeUrl,
        showProfileBadge: false,
      },
      locale: {
        timezone: targetTz,
        language: 'en-US',
        languagesList: ['en-US', 'en'],
      },
    },
  };

  const debugPort = getProfileDebugPort(profile.id);
  console.log(`[TZ Probe] Launching test profile with timezone: ${targetTz} on debug port ${debugPort}...`);
  const launched = await launchBrowser(profile);

  let cdpBrowser: any = null;
  try {
    const cdpEndpoint = `http://127.0.0.1:${debugPort}`;
    console.log(`[TZ Probe] Connecting to CDP at ${cdpEndpoint}...`);
    // Wait for CDP to respond
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`${cdpEndpoint}/json/version`);
        if (res.ok) break;
      } catch {}
      await new Promise(r => setTimeout(r, 150));
    }

    cdpBrowser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 10000 });
    const contexts = cdpBrowser.contexts();
    const ctx = contexts[0] || await cdpBrowser.newContext();
    const page = ctx.pages()[0] || await ctx.newPage();

    console.log(`[TZ Probe] Navigating to ${probeUrl}...`);
    await page.goto(probeUrl, { waitUntil: 'domcontentloaded' });

    // Wait up to 6 seconds for results
    const results = await Promise.race([
      resultsPromise,
      new Promise<Record<string, TzResult>>(r => setTimeout(() => r(collectedResults), 6000))
    ]);

    console.log('\n=======================================================');
    console.log('             TIMEZONE PROBE AUDIT RESULTS');
    console.log('=======================================================');
    console.table(Object.values(results));

    // Inspect JS Proxy vs Native descriptor
    const tzOffsetToString = await page.evaluate(() => Date.prototype.getTimezoneOffset.toString());
    const dtfResolvedToString = await page.evaluate(() => Intl.DateTimeFormat.prototype.resolvedOptions.toString());
    console.log(`\n[Native / Proxy Checks]`);
    console.log(`Date.prototype.getTimezoneOffset.toString() = "${tzOffsetToString}"`);
    console.log(`Intl.DateTimeFormat.prototype.resolvedOptions.toString() = "${dtfResolvedToString}"`);

    // Verify consistency
    const contextsList = Object.keys(results);
    let allAgree = true;
    for (const c of contextsList) {
      const res = results[c];
      const validOffset = res.offset === 240 || res.offset === 300; // EDT 240, EST 300
      const validTz = res.timeZone === targetTz;
      console.log(`[${c}] offset=${res.offset} (valid: ${validOffset}), timeZone=${res.timeZone} (valid: ${validTz}), date=${res.dateString}`);
      if (!validOffset || !validTz) {
        allAgree = false;
      }
    }

    if (!allAgree) {
      console.error('\n[TZ Probe FAILURE] Contexts disagree or did not match target timezone!');
    } else {
      console.log('\n[TZ Probe SUCCESS] All contexts agree with target timezone!');
    }

    return allAgree;
  } finally {
    try { await cdpBrowser?.close(); } catch {}
    try { launched.process.kill(); } catch {}
    try { server.close(); } catch {}
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  }
}

runProbe()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('[TZ Probe Error]:', err);
    process.exit(1);
  });
