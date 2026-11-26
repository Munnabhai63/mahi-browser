import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile, getProfileById } from '../../02_BROWSER/services/profile-service.js';
import { createProxy } from '../../02_BROWSER/services/proxy-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import {
  saveRotatorConfig,
  resetMobileRotatorStateForTesting,
  _setMobileRotatorExecFileForTesting,
} from '../../03_HARDWARE/mobile-rotator-service.js';

const mockLaunchBrowser = vi.fn();

vi.mock('../../02_BROWSER/launcher.js', () => ({
  launchBrowser: (...args: unknown[]) => mockLaunchBrowser(...args),
  markCleanExit: vi.fn(),
  getProfileDebugPort: vi.fn(() => undefined),
}));

import { processManager } from '../../02_BROWSER/process-manager.js';

function createFakeChildProcess(pid = 884422) {
  const proc = new EventEmitter() as any;
  proc.pid = pid;
  proc.kill = vi.fn();
  return proc;
}

function mockPublicIpSequence(ips: string[]) {
  let idx = 0;
  return vi.spyOn(https, 'get').mockImplementation((_url: any, _opts: any, cb?: any) => {
    const callback = typeof _opts === 'function' ? _opts : cb;
    const req = new EventEmitter() as any;
    req.destroy = vi.fn();
    const chosen = ips[Math.min(idx, ips.length - 1)];
    idx++;

    queueMicrotask(() => {
      const res = new EventEmitter() as any;
      res.statusCode = 200;
      if (callback) callback(res);
      res.emit(
        'data',
        JSON.stringify({
          ip: chosen,
          country: 'IN',
          city: 'Jaipur',
          org: 'AS55836 Reliance Jio',
        })
      );
      res.emit('end');
    });
    return req;
  });
}

describe('Mobile Mode in Profiles Tab & ProcessManager Enforcement', () => {
  let tempDir: string;
  let fakeAdbPath: string;
  let prevMahiAdbEnv: string | undefined;

  beforeEach(async () => {
    resetMobileRotatorStateForTesting();
    prevMahiAdbEnv = process.env.MAHI_ADB_PATH;

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-mobile-mode-'));
    setCustomDatabasePath(path.join(tempDir, 'mobile_mode.sqlite'));
    await initializeDatabase();

    fakeAdbPath = path.join(tempDir, process.platform === 'win32' ? 'adb.exe' : 'adb');
    fs.writeFileSync(fakeAdbPath, 'fake-adb');
    process.env.MAHI_ADB_PATH = fakeAdbPath;

    mockLaunchBrowser.mockReset();
    let pidCounter = 910000;
    mockLaunchBrowser.mockImplementation(async (profile: any) => ({
      process: createFakeChildProcess(pidCounter++),
      pid: pidCounter,
      storageDir: profile.storagePath,
    }));

    await processManager.stopAll();
  });

  afterEach(async () => {
    await processManager.stopAll();
    vi.restoreAllMocks();
    _setMobileRotatorExecFileForTesting(null);
    resetMobileRotatorStateForTesting();
    if (prevMahiAdbEnv === undefined) {
      delete process.env.MAHI_ADB_PATH;
    } else {
      process.env.MAHI_ADB_PATH = prevMahiAdbEnv;
    }
    closeDatabase();
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('rotates IP on Direct profile launch, replaces Notes with new IP, blocks 2nd simultaneous profile, and forces fresh rotation after stop', async () => {
    let adbRotationCount = 0;
    _setMobileRotatorExecFileForTesting(async (_file, args) => {
      if (args[0] === 'devices') {
        return { stdout: 'List of devices attached\nMOBILE001 device model:Pixel_8\n', stderr: '' };
      }
      if (args.join(' ').includes('airplane-mode enable')) {
        adbRotationCount++;
      }
      return { stdout: '', stderr: '' };
    });

    saveRotatorConfig({
      method: 'adb',
      adbDeviceId: 'MOBILE001',
      airplaneDelayMs: 500,
      minIntervalSeconds: 60, // Cooldown must be bypassed in Mobile Mode
      mobileModeEnabled: true,
    });

    const p1 = createProfile({ name: 'Mob Profile 1', notes: 'old-note@example.com' });
    const p2 = createProfile({ name: 'Mob Profile 2', notes: 'another-old-note' });

    // IP sequence: P1 pre-check (10.1) -> P1 post-check (10.2) -> P2 pre-check (10.2) -> P2 post-check (10.3)
    mockPublicIpSequence(['49.36.10.1', '49.36.10.2', '49.36.10.2', '49.36.10.3']);

    // 1. Launch Profile 1 -> rotates IP to 49.36.10.2 & replaces notes completely
    const res1 = await processManager.startProfile(p1.id);
    expect(res1.success).toBe(true);
    expect(res1.rotatedIp).toBe('49.36.10.2');
    expect(res1.notesUpdated).toBe(true);
    expect(adbRotationCount).toBe(1);
    expect(getProfileById(p1.id)?.notes).toBe('49.36.10.2');
    expect(mockLaunchBrowser).toHaveBeenCalledTimes(1);

    // 2. Try running Profile 2 while Profile 1 is still running -> must block cleanly with MOBILE_MODE_CONFLICT
    const conflict = await processManager.startProfile(p2.id);
    expect(conflict.success).toBe(false);
    expect(conflict.code).toBe('MOBILE_MODE_CONFLICT');
    expect(conflict.runningProfileId).toBe(p1.id);
    expect(conflict.runningProfileName).toBe('Mob Profile 1');
    expect(mockLaunchBrowser).toHaveBeenCalledTimes(1);

    // 3. Batch launch of multiple profiles must also be rejected while Mobile Mode is ON
    const batchRes = await processManager.startProfilesBatch([p1.id, p2.id], 0);
    expect(batchRes.results.every((r) => !r.success)).toBe(true);

    // 4. Stop Profile 1 and immediately run Profile 2 -> bypasses 60s cooldown and forces a brand new rotation!
    await processManager.stopProfile(p1.id);
    const res2 = await processManager.startProfile(p2.id);
    expect(res2.success).toBe(true);
    expect(res2.rotatedIp).toBe('49.36.10.3');
    expect(res2.notesUpdated).toBe(true);
    expect(adbRotationCount).toBe(2);
    expect(getProfileById(p2.id)?.notes).toBe('49.36.10.3');
    expect(mockLaunchBrowser).toHaveBeenCalledTimes(2);
  });

  it('skips mobile IP rotation and keeps existing Notes when launching a Proxied profile in Mobile Mode', async () => {
    let adbCalled = false;
    _setMobileRotatorExecFileForTesting(async () => {
      adbCalled = true;
      return { stdout: '', stderr: '' };
    });

    saveRotatorConfig({
      method: 'adb',
      airplaneDelayMs: 500,
      mobileModeEnabled: true,
    });

    const proxy = createProxy({
      name: 'Dedicated Residential Proxy',
      protocol: 'http',
      host: '198.51.100.10',
      port: 8080,
    });

    const defaults = getDefaultProfileSettings();
    const proxiedProfile = createProfile({
      name: 'Proxied Mobile Profile',
      notes: 'client-account@example.com',
      settings: {
        ...defaults,
        network: {
          ...defaults.network,
          directConnection: false,
          proxyId: proxy.id,
        },
      },
    });

    const res = await processManager.startProfile(proxiedProfile.id);
    expect(res.success).toBe(true);
    expect(res.rotatedIp).toBeUndefined();
    expect(res.notesUpdated).toBeUndefined();
    expect(adbCalled).toBe(false);
    expect(getProfileById(proxiedProfile.id)?.notes).toBe('client-account@example.com');
    expect(mockLaunchBrowser).toHaveBeenCalledTimes(1);
  });

  it('blocks profile launch in Mobile Mode when phone is disconnected or public IP fails to change', async () => {
    saveRotatorConfig({
      method: 'adb',
      airplaneDelayMs: 500,
      mobileModeEnabled: true,
    });

    const p = createProfile({ name: 'Strict Guard Profile', notes: 'keep-me-unchanged' });

    // Case A: No ADB phone detected
    _setMobileRotatorExecFileForTesting(async (_file, args) => {
      if (args[0] === 'devices') {
        return { stdout: 'List of devices attached\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });
    mockPublicIpSequence(['49.36.10.1']);

    const disconnectedRes = await processManager.startProfile(p.id);
    expect(disconnectedRes.success).toBe(false);
    expect(disconnectedRes.code).toBe('MOBILE_MODE_ROTATION_FAILED');
    expect(getProfileById(p.id)?.notes).toBe('keep-me-unchanged');
    expect(mockLaunchBrowser).not.toHaveBeenCalled();

    // Case B: Phone connected, but carrier/Wi-Fi returned identical IP across checks
    _setMobileRotatorExecFileForTesting(async (_file, args) => {
      if (args[0] === 'devices') {
        return { stdout: 'List of devices attached\nDEV01 device model:Pixel_8\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });
    mockPublicIpSequence(['49.36.10.1', '49.36.10.1']);

    const unchangedRes = await processManager.startProfile(p.id);
    expect(unchangedRes.success).toBe(false);
    expect(unchangedRes.code).toBe('MOBILE_MODE_IP_UNCHANGED');
    expect(getProfileById(p.id)?.notes).toBe('keep-me-unchanged');
    expect(mockLaunchBrowser).not.toHaveBeenCalled();
  });
});
