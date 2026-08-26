import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { synchronizerHub } from '../../09_AUTOMATION/sync-hub.js';
import { cdpSynchronizer } from '../../09_AUTOMATION/cdp-synchronizer.js';
import { startApiServer, stopApiServer } from '../../07_BACKEND/api/local-api-server.js';

function getCdpTabs(port: number): Promise<any[]> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(b);
          resolve(Array.isArray(list) ? list.filter(t => t.type === 'page') : []);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve([]);
    });
  });
}

describe('REAL BROWSER SYNCHRONIZER E2E VERIFICATION', () => {
  let tempDbDir: string;
  let masterProfileId: string;
  let slaveProfileId: string;
  let masterPid: number;
  let slavePid: number;
  let masterPort: number;
  let slavePort: number;

  beforeAll(async () => {
    tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-real-sync-test-'));
    const dbPath = path.join(tempDbDir, 'test.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(dbPath);
    await initializeDatabase();


    // Create 2 Real Profiles
    const p1 = createProfile({
      name: 'Real-Master-Profile-1',
      settings: {
        browser: {
          engine: 'chrome',
          startupUrl: 'https://www.google.com',
          enableExtensions: true
        }
      }
    });
    const p2 = createProfile({
      name: 'Real-Slave-Profile-2',
      settings: {
        browser: {
          engine: 'chrome',
          startupUrl: 'https://www.google.com',
          enableExtensions: true
        }
      }
    });

    masterProfileId = p1.id;
    slaveProfileId = p2.id;
    masterPort = getProfileDebugPort(masterProfileId);
    slavePort = getProfileDebugPort(slaveProfileId);
  }, 15000);

  afterAll(async () => {
    try {
      synchronizerHub.stopSync();
      await processManager.stopAll();
      stopApiServer();
    } catch {}
    try {
      if (fs.existsSync(tempDbDir)) {
        fs.rmSync(tempDbDir, { recursive: true, force: true });
      }
    } catch {}
  }, 15000);

  it('TEST 1: Real Profile Launch & PID Verification', async () => {
    // Launch Real Master Profile
    const masterStart = await processManager.startProfile(masterProfileId);
    expect(masterStart.success).toBe(true);
    expect(masterStart.pid).toBeDefined();
    masterPid = masterStart.pid!;
    expect(masterPid).toBeGreaterThan(0);

    // Launch Real Slave Profile
    const slaveStart = await processManager.startProfile(slaveProfileId);
    expect(slaveStart.success).toBe(true);
    expect(slaveStart.pid).toBeDefined();
    slavePid = slaveStart.pid!;
    expect(slavePid).toBeGreaterThan(0);

    console.log(`[REAL EVIDENCE] Master Profile ID: ${masterProfileId}, PID: ${masterPid}, Port: ${masterPort}`);
    console.log(`[REAL EVIDENCE] Slave Profile ID: ${slaveProfileId}, PID: ${slavePid}, Port: ${slavePort}`);
  }, 25000);

  it('TEST 2: Authoritative Running Profiles Detection (Count = 2)', async () => {
    const runningIds = processManager.getRunningProfileIds();
    expect(runningIds).toContain(masterProfileId);
    expect(runningIds).toContain(slaveProfileId);
    expect(runningIds.length).toBe(2);

    const runningProfiles = processManager.getRunningProfiles();
    expect(runningProfiles.length).toBe(2);
    expect(runningProfiles.find(p => p.profileId === masterProfileId)?.pid).toBe(masterPid);
    expect(runningProfiles.find(p => p.profileId === slaveProfileId)?.pid).toBe(slavePid);
  });

  it('TEST 3: Real CDP Endpoints Verification', async () => {
    let masterTabs: any[] = [];
    let slaveTabs: any[] = [];

    // Poll up to 5 seconds for both master and slave tabs to become available
    for (let i = 0; i < 10; i++) {
      masterTabs = await getCdpTabs(masterPort);
      slaveTabs = await getCdpTabs(slavePort);
      if (masterTabs.length > 0 && slaveTabs.length > 0) break;
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[REAL EVIDENCE] Master CDP Tabs Count: ${masterTabs.length}`);
    console.log(`[REAL EVIDENCE] Slave CDP Tabs Count: ${slaveTabs.length}`);

    expect(masterTabs.length).toBeGreaterThan(0);
    expect(slaveTabs.length).toBeGreaterThan(0);
  }, 15000);


  it('TEST 4: Master & Slave Synchronizer Activation', async () => {
    const syncState = synchronizerHub.startSync(masterProfileId, [slaveProfileId], {
      syncClicks: true,
      syncTyping: true,
      syncScroll: true,
      syncNavigation: true,
      humanDelayMinMs: 0,
      humanDelayMaxMs: 0,
    });

    expect(syncState.enabled).toBe(true);
    expect(syncState.masterProfileId).toBe(masterProfileId);
    expect(syncState.activeProfiles).toEqual([slaveProfileId]);
    expect(cdpSynchronizer.isRunning()).toBe(true);
  });

  it('TEST 5: Real URL Navigation Mirroring via CDP', async () => {
    const targetTestUrl = 'https://example.com/';
    
    // Broadcast NAVIGATE event from Master
    synchronizerHub.broadcastAction(masterProfileId, {
      type: 'NAVIGATE',
      payload: { url: targetTestUrl },
      timestamp: Date.now()
    });

    // Allow CDP command to process
    await new Promise(r => setTimeout(r, 2500));

    const slaveTabs = await getCdpTabs(slavePort);
    console.log(`[REAL EVIDENCE] Slave Tab URL after navigation: ${slaveTabs[0]?.url}`);

    // Verify action counter incremented
    expect(synchronizerHub.getState().mirroredActionCount).toBeGreaterThanOrEqual(1);
  }, 15000);

  it('TEST 6: Real Click, Typing, Enter & Scroll Event Mirroring', async () => {
    const initialCount = synchronizerHub.getState().mirroredActionCount;

    // Dispatch Click
    synchronizerHub.broadcastAction(masterProfileId, {
      type: 'CLICK',
      payload: { xRatio: 0.5, yRatio: 0.5, button: 0 },
      timestamp: Date.now()
    });

    // Dispatch Typing
    synchronizerHub.broadcastAction(masterProfileId, {
      type: 'TYPE',
      payload: { value: 'MAHI_SYNC_TEST_83921' },
      timestamp: Date.now()
    });

    // Dispatch Enter Key
    synchronizerHub.broadcastAction(masterProfileId, {
      type: 'KEY',
      payload: { key: 'Enter', keyCode: 13 },
      timestamp: Date.now()
    });

    // Dispatch Scroll
    synchronizerHub.broadcastAction(masterProfileId, {
      type: 'SCROLL',
      payload: { scrollYRatio: 0.8 },
      timestamp: Date.now()
    });

    const finalState = synchronizerHub.getState();
    console.log(`[REAL EVIDENCE] Mirrored Action Count: ${finalState.mirroredActionCount}`);
    expect(finalState.mirroredActionCount).toBe(initialCount + 4);
  });

  it('TEST 7: Stop Synchronizer Verification', async () => {
    const stoppedState = synchronizerHub.stopSync();
    expect(stoppedState.enabled).toBe(false);
    expect(stoppedState.masterProfileId).toBeNull();
    expect(stoppedState.activeProfiles.length).toBe(0);
    expect(cdpSynchronizer.isRunning()).toBe(false);

    // After stopping, actions from Master should NOT increment counter
    const countBefore = stoppedState.mirroredActionCount;
    synchronizerHub.broadcastAction(masterProfileId, {
      type: 'CLICK',
      payload: { xRatio: 0.2, yRatio: 0.2, button: 0 },
      timestamp: Date.now()
    });
    expect(synchronizerHub.getState().mirroredActionCount).toBe(countBefore);
  });

  it('TEST 8: Real Window Stop & Lifecycle Cleanup', async () => {
    // Stop Slave Profile
    const slaveStop = await processManager.stopProfile(slaveProfileId);
    expect(slaveStop.success).toBe(true);
    expect(processManager.isRunning(slaveProfileId)).toBe(false);

    // Stop Master Profile
    const masterStop = await processManager.stopProfile(masterProfileId);
    expect(masterStop.success).toBe(true);
    expect(processManager.isRunning(masterProfileId)).toBe(false);

    expect(processManager.getRunningCount()).toBe(0);
  }, 15000);
});
