import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createProfile,
  getProfileById,
  bulkUpdateProfiles,
  bulkAssignProxies,
  bulkDeleteProfiles,
} from '../../02_BROWSER/services/profile-service.js';
import { createProxy } from '../../02_BROWSER/services/proxy-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { getProductionChromiumExecutablePath } from '../../02_BROWSER/managed-engine.js';

const REAL_CHROMIUM = (() => {
  try {
    const p = getProductionChromiumExecutablePath();
    const ok = fs.existsSync(p) && (fs.statSync(p).size > 10_000_000 || (process.platform === 'win32' && fs.existsSync(path.join(path.dirname(p), 'chrome.dll'))));
    if (!ok) {
      console.log('[SKIP REASON] phase8-bulk-operations: Real Chromium binary (>10MB / chrome.dll) not found on host');
    }
    return ok;
  } catch {
    console.log('[SKIP REASON] phase8-bulk-operations: Failed to inspect Chromium executable path');
    return false;
  }
})();

describe.skipIf(!REAL_CHROMIUM)('Phase 8: Bulk Profile Operations Suite & Staggered Batch Launcher [requires real Chromium binary on host]', () => {
  let tempDir: string;
  let profileIds: string[] = [];
  let proxyIds: string[] = [];

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase8-bulk-'));
    const testDbPath = path.join(tempDir, 'test_phase8.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(async () => {
    try {
      await processManager.stopAll();
    } catch {}
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  beforeEach(() => {
    // Create 6 test profiles
    profileIds = [];
    for (let i = 1; i <= 6; i++) {
      const p = createProfile({
        name: `Bulk-Test-Profile-${i}`,
        folder: 'General',
        tags: ['Fresh', 'Workspace'],
        notes: `Test note ${i}`,
        settings: getDefaultProfileSettings(),
      });
      profileIds.push(p.id);
    }

    // Create 3 test proxies
    proxyIds = [];
    const px1 = createProxy({
      name: 'Proxy US-1',
      protocol: 'http',
      host: '185.199.229.156',
      port: 50100,
    });
    const px2 = createProxy({
      name: 'Proxy UK-2',
      protocol: 'socks5',
      host: '51.89.255.67',
      port: 1080,
    });
    const px3 = createProxy({
      name: 'Proxy DE-3',
      protocol: 'https',
      host: '144.76.136.152',
      port: 8080,
    });
    proxyIds = [px1.id, px2.id, px3.id];
  });

  it('should bulk update folders, add tags, and remove tags across multiple profiles', () => {
    const targetIds = [profileIds[0], profileIds[1], profileIds[2]];
    const result = bulkUpdateProfiles({
      profileIds: targetIds,
      folder: 'VIP Farming',
      addTags: ['VIP', 'Verified'],
      removeTags: ['Fresh'],
      notes: 'Updated via bulk tool',
    });

    expect(result.updatedCount).toBe(3);
    for (const id of targetIds) {
      const p = getProfileById(id)!;
      expect(p.folder).toBe('VIP Farming');
      expect(p.tags).toContain('VIP');
      expect(p.tags).toContain('Verified');
      expect(p.tags).not.toContain('Fresh');
      expect(p.notes).toBe('Updated via bulk tool');
    }

    // Untargeted profiles should remain unchanged
    const p4 = getProfileById(profileIds[3])!;
    expect(p4.folder).toBe('General');
    expect(p4.tags).toContain('Fresh');
  });

  it('should bulk assign a single proxy to all selected profiles', () => {
    const targetIds = [profileIds[0], profileIds[1]];
    const res = bulkAssignProxies({
      profileIds: targetIds,
      proxyIds: [proxyIds[0]],
      distributionMode: 'single',
    });

    expect(res.assignedCount).toBe(2);
    const p1 = getProfileById(profileIds[0])!;
    const p2 = getProfileById(profileIds[1])!;

    expect(p1.settings.network.proxyId).toBe(proxyIds[0]);
    expect(p1.settings.network.directConnection).toBe(false);
    expect(p2.settings.network.proxyId).toBe(proxyIds[0]);
    expect(p2.settings.network.directConnection).toBe(false);
  });

  it('should round-robin distribute multiple proxies across profiles', () => {
    // Distribute 3 proxies across 6 profiles
    const res = bulkAssignProxies({
      profileIds: profileIds,
      proxyIds: proxyIds,
      distributionMode: 'round-robin',
    });

    expect(res.assignedCount).toBe(6);

    expect(getProfileById(profileIds[0])!.settings.network.proxyId).toBe(proxyIds[0]);
    expect(getProfileById(profileIds[1])!.settings.network.proxyId).toBe(proxyIds[1]);
    expect(getProfileById(profileIds[2])!.settings.network.proxyId).toBe(proxyIds[2]);
    expect(getProfileById(profileIds[3])!.settings.network.proxyId).toBe(proxyIds[0]);
    expect(getProfileById(profileIds[4])!.settings.network.proxyId).toBe(proxyIds[1]);
    expect(getProfileById(profileIds[5])!.settings.network.proxyId).toBe(proxyIds[2]);
  });

  it('should clear proxy configuration when distributionMode is clear', () => {
    // First assign proxy
    bulkAssignProxies({
      profileIds: [profileIds[0]],
      proxyIds: [proxyIds[0]],
      distributionMode: 'single',
    });
    expect(getProfileById(profileIds[0])!.settings.network.proxyId).toBe(proxyIds[0]);

    // Now clear proxy
    bulkAssignProxies({
      profileIds: [profileIds[0]],
      proxyIds: [],
      distributionMode: 'clear',
    });
    const p1 = getProfileById(profileIds[0])!;
    expect(p1.settings.network.proxyId).toBeUndefined();
    expect(p1.settings.network.directConnection).toBe(true);
  });

  it('should sequentially batch launch and batch stop profiles safely', async () => {
    const targetIds = [profileIds[0], profileIds[1]];
    const progressUpdates: any[] = [];

    // 1. Batch Start with 150ms stagger delay
    const batchResult = await processManager.startProfilesBatch(targetIds, 150, (p) => {
      progressUpdates.push(p);
    });

    expect(batchResult.results.length).toBe(2);
    expect(batchResult.results[0].success).toBe(true);
    expect(batchResult.results[0].pid).toBeDefined();
    expect(batchResult.results[1].success).toBe(true);
    expect(batchResult.results[1].pid).toBeDefined();

    expect(progressUpdates.length).toBe(2);
    expect(progressUpdates[0].completed).toBe(1);
    expect(progressUpdates[1].completed).toBe(2);

    expect(processManager.isRunning(profileIds[0])).toBe(true);
    expect(processManager.isRunning(profileIds[1])).toBe(true);
    expect(processManager.getRunningCount()).toBe(2);

    // 2. Batch Stop
    const stopRes = await processManager.stopProfilesBatch(targetIds);
    expect(stopRes.results.length).toBe(2);
    expect(stopRes.results[0].success).toBe(true);
    expect(stopRes.results[1].success).toBe(true);

    expect(processManager.isRunning(profileIds[0])).toBe(false);
    expect(processManager.isRunning(profileIds[1])).toBe(false);
    expect(processManager.getRunningCount()).toBe(0);
  }, 25000);

  it('should bulk delete profiles and remove database entries', () => {
    const deleteIds = [profileIds[4], profileIds[5]];
    const delResult = bulkDeleteProfiles(deleteIds);

    expect(delResult.success).toBe(true);
    expect(delResult.deletedCount).toBe(2);

    expect(getProfileById(profileIds[4])).toBeNull();
    expect(getProfileById(profileIds[5])).toBeNull();
  });
});
