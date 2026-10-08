/**
 * MAHI Browser — Phase 10 Real Cloud Browser Worker & Interactive Session E2E Tests
 *
 * Verifies real Chromium process execution in isolated environment,
 * CDP bridge connection, interactive input dispatch, and safe persistence sync back.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import {
  browserWorkerManager,
  sessionGateway,
  workerProfileLoader,
} from '../../07_BACKEND/cloud-browser/index.js';
import { getDatabase, initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';

describe('Phase 10: Real Cloud Browser Worker & Interactive Session E2E Suite', () => {
  const testSessionId = `e2e_cloud_session_${Date.now()}`;
  const testUserId = `user_e2e_${Date.now()}`;
  const testProfileId = `prof_e2e_${Date.now()}`;
  const testRuntimeDir = path.resolve('.mahi_data', 'cloud-workers', testSessionId);

  beforeAll(async () => {
    await initSqlEngine();
    initializeDatabase();
  });

  afterAll(async () => {
    // Terminate any active test worker and wipe directory
    await browserWorkerManager.terminateAll();
    workerProfileLoader.cleanWorkerDirectory(testRuntimeDir);
  });

  it('should launch a real isolated Chromium process on worker and verify CDP health', async () => {
    const workerInstance = await browserWorkerManager.launchWorker({
      sessionId: testSessionId,
      userId: testUserId,
      profileId: testProfileId,
      runtimeDir: testRuntimeDir,
      settings: {
        browser: {
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          startupUrl: 'about:blank',
        },
        display: {
          screenWidth: 1280,
          screenHeight: 800,
        },
      },
      resourceClass: 'STANDARD',
    });

    expect(workerInstance).toBeDefined();
    expect(workerInstance.pid).toBeGreaterThan(0);
    expect(workerInstance.cdpPort).toBeGreaterThan(10000);
    expect(workerInstance.process.killed).toBe(false);

    // Verify HTTP 200 from real Chromium CDP version endpoint
    const versionInfo = await new Promise<any>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${workerInstance.cdpPort}/json/version`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
    });

    expect(versionInfo).toBeDefined();
    expect(versionInfo.Browser).toContain('Chrome');
    expect(versionInfo.webSocketDebuggerUrl).toBeDefined();
  }, 15000);

  it('should attach session gateway and dispatch interactive input actions to Chromium', async () => {
    const workerInstance = browserWorkerManager.getWorker(testSessionId);
    expect(workerInstance).toBeDefined();

    // Attach gateway to real Chromium
    await sessionGateway.attachSession(testSessionId, workerInstance!.cdpPort);

    // Subscribe a client listener
    const receivedFrames: any[] = [];
    const unsubscribe = sessionGateway.subscribeClient({
      id: 'test-client-sub-1',
      userId: testUserId,
      sessionId: testSessionId,
      send: (msg) => receivedFrames.push(msg),
      close: () => {},
    });

    // Dispatch real mouse and navigation events
    sessionGateway.dispatchAction(testSessionId, { type: 'navigate', url: 'about:blank' });
    sessionGateway.dispatchAction(testSessionId, { type: 'mouseMove', x: 200, y: 300 });
    sessionGateway.dispatchAction(testSessionId, { type: 'mouseClick', x: 200, y: 300, button: 'left' });
    sessionGateway.dispatchAction(testSessionId, { type: 'mouseWheel', deltaX: 0, deltaY: 50, x: 200, y: 300 });
    sessionGateway.dispatchAction(testSessionId, { type: 'keyDown', key: 'a', text: 'a' });
    sessionGateway.dispatchAction(testSessionId, { type: 'keyUp', key: 'a' });

    // Allow events to process
    await new Promise((r) => setTimeout(r, 600));

    unsubscribe();
    expect(workerInstance!.process.killed).toBe(false);
  });

  it('should gracefully stop worker, package profile persistently, and clean worker storage', async () => {
    const workerInstance = browserWorkerManager.getWorker(testSessionId);
    expect(workerInstance).toBeDefined();

    // 1. Gracefully stop Chromium
    await workerInstance!.stop();
    expect(workerInstance!.process.killed).toBe(true);

    // 2. Detach gateway
    sessionGateway.detachSession(testSessionId);

    // 3. Package and sync profile back
    const syncRes = await workerProfileLoader.packageAndSyncProfile({
      sessionId: testSessionId,
      userId: testUserId,
      profileId: testProfileId,
      targetDir: testRuntimeDir,
      baseVersion: 1,
    });

    expect(syncRes.success).toBe(true);
    expect(syncRes.newVersion).toBe(2);

    // 4. Securely wipe worker directory
    await new Promise((r) => setTimeout(r, 500));
    workerProfileLoader.cleanWorkerDirectory(testRuntimeDir);
    expect(fs.existsSync(testRuntimeDir)).toBe(false);
  });
});

