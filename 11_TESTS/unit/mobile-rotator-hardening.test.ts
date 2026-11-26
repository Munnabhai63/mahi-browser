import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  validateAdbDeviceId,
  parseAdbDevicesOutput,
  resolveAdbExecutable,
  getAdbEnvironmentStatus,
  getOfficialPlatformToolsUrl,
  getConnectedAdbDevices,
  rotateViaAdb,
  rotateViaWebhook,
  rotateMobileIp,
  maybeAutoRotateOnProfileStart,
  getRotatorConfig,
  saveRotatorConfig,
  getRotationHistory,
  clearRotationHistory,
  resetMobileRotatorStateForTesting,
  _setMobileRotatorExecFileForTesting,
} from '../../03_HARDWARE/mobile-rotator-service.js';
import { createLocalApiServer } from '../../07_BACKEND/api/local-api-server.js';
import { getApiAuthToken } from '../../08_SECURITY/install-secrets.js';

function mockIpSequence(ips: string[]) {
  let callIndex = 0;
  return vi.spyOn(https, 'get').mockImplementation((_url: any, _opts: any, cb?: any) => {
    const callback = typeof _opts === 'function' ? _opts : cb;
    const req = new EventEmitter() as any;
    req.destroy = vi.fn();

    const selectedIp = ips[Math.min(callIndex, ips.length - 1)];
    callIndex++;

    queueMicrotask(() => {
      const res = new EventEmitter() as any;
      res.statusCode = 200;
      if (callback) callback(res);
      res.emit(
        'data',
        JSON.stringify({
          ip: selectedIp,
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

describe('Mobile 4G/5G IP Rotator Hardening & End-to-End Integration', () => {
  let tempDir: string;
  let fakeAdbPath: string;
  let prevMahiAdbEnv: string | undefined;

  beforeEach(async () => {
    resetMobileRotatorStateForTesting();
    prevMahiAdbEnv = process.env.MAHI_ADB_PATH;

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-rotator-test-'));
    setCustomDatabasePath(path.join(tempDir, 'rotator_test.sqlite'));
    await initializeDatabase();

    fakeAdbPath = path.join(tempDir, process.platform === 'win32' ? 'adb.exe' : 'adb');
    fs.writeFileSync(fakeAdbPath, 'fake-adb-binary');
    process.env.MAHI_ADB_PATH = fakeAdbPath;
  });

  afterEach(() => {
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

  it('validates ADB serial IDs safely to block shell metacharacter injection', () => {
    expect(validateAdbDeviceId('RZ8T12345XY')).toBe('RZ8T12345XY');
    expect(validateAdbDeviceId('192.168.1.45:5555')).toBe('192.168.1.45:5555');
    expect(() => validateAdbDeviceId('abc; rm -rf /')).toThrow(/Invalid ADB device identifier/);
    expect(() => validateAdbDeviceId('abc && whoami')).toThrow(/Invalid ADB device identifier/);
    expect(() => validateAdbDeviceId('')).toThrow(/Invalid ADB device identifier/);
  });

  it('parses adb devices -l output across device, unauthorized, and offline states', () => {
    const sampleOutput = [
      'List of devices attached',
      'RZ8T123ABC             device product:dm1q model:SM_S911B device:dm1q transport_id:1',
      '988919484344545849     unauthorized usb:1-2 transport_id:2',
      '192.168.1.25:5555      offline',
      '',
    ].join('\n');

    const parsed = parseAdbDevicesOutput(sampleOutput);
    expect(parsed).toEqual([
      { id: 'RZ8T123ABC', model: 'SM S911B', product: 'dm1q', status: 'device' },
      { id: '988919484344545849', model: 'Android Phone', product: undefined, status: 'unauthorized' },
      { id: '192.168.1.25:5555', model: 'Android Phone', product: undefined, status: 'offline' },
    ]);
  });

  it('resolves MAHI_ADB_PATH and reports official Google platform-tools download URLs', async () => {
    const resolved = await resolveAdbExecutable();
    expect(resolved.adbPath).toBe(path.resolve(fakeAdbPath));
    expect(resolved.source).toBe('env');

    _setMobileRotatorExecFileForTesting(async (_file, args) => {
      if (args[0] === 'version') {
        return { stdout: 'Android Debug Bridge version 1.0.41\nVersion 35.0.2', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });

    const status = await getAdbEnvironmentStatus();
    expect(status.installed).toBe(true);
    expect(status.version).toContain('Android Debug Bridge');
    expect(getOfficialPlatformToolsUrl('win32')).toContain('platform-tools-latest-windows.zip');
    expect(getOfficialPlatformToolsUrl('darwin')).toContain('platform-tools-latest-darwin.zip');
    expect(getOfficialPlatformToolsUrl('linux')).toContain('platform-tools-latest-linux.zip');
  });

  it('rejects unauthorized or offline ADB devices with actionable guidance', async () => {
    _setMobileRotatorExecFileForTesting(async (_file, args) => {
      if (args[0] === 'devices') {
        return {
          stdout: 'List of devices attached\nPHONE_AUTH_TEST unauthorized\n',
          stderr: '',
        };
      }
      return { stdout: '', stderr: '' };
    });

    const devices = await getConnectedAdbDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].status).toBe('unauthorized');

    await expect(rotateViaAdb('PHONE_AUTH_TEST', 500)).rejects.toThrow(/Allow USB debugging/i);
  });

  it('falls back through Android airplane-mode -> settings -> svc data commands safely via execFile', async () => {
    const executedCommands: string[] = [];

    _setMobileRotatorExecFileForTesting(async (_file, args) => {
      const joined = args.join(' ');
      executedCommands.push(joined);

      if (args[0] === 'devices') {
        return {
          stdout: 'List of devices attached\nDEV001 device model:Pixel_8\n',
          stderr: '',
        };
      }

      if (joined.includes('cmd connectivity') || joined.includes('airplane_mode_on')) {
        throw new Error('SecurityException: permission denied without root');
      }

      return { stdout: '', stderr: '' };
    });

    const res = await rotateViaAdb('DEV001', 500);
    expect(res.ok).toBe(true);
    expect(res.deviceId).toBe('DEV001');
    expect(res.strategy).toBe('svc-mobile-data-cycle');
    expect(executedCommands).toContain('-s DEV001 shell svc data disable');
    expect(executedCommands).toContain('-s DEV001 shell svc data enable');
  });

  it('tracks ipChanged accurately, records persisted history, and skips within cooldown', async () => {
    _setMobileRotatorExecFileForTesting(async (_file, args) => {
      if (args[0] === 'devices') {
        return { stdout: 'List of devices attached\nDEV999 device model:Galaxy_S23\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });

    saveRotatorConfig({
      method: 'adb',
      adbDeviceId: 'DEV999',
      airplaneDelayMs: 500,
      autoRotateOnProfileStart: true,
      minIntervalSeconds: 60,
    });

    mockIpSequence(['49.36.10.1', '49.36.99.22']);

    const first = await rotateMobileIp(undefined, { triggerSource: 'manual' });
    expect(first.success).toBe(true);
    expect(first.oldIp).toBe('49.36.10.1');
    expect(first.newIp).toBe('49.36.99.22');
    expect(first.ipChanged).toBe(true);
    expect(first.deviceId).toBe('DEV999');

    // Auto-rotate right after manual rotation must honor minIntervalSeconds cooldown
    const autoSkipped = await maybeAutoRotateOnProfileStart('profile-123');
    expect(autoSkipped.triggered).toBe(true);
    expect(autoSkipped.result?.skippedByCooldown).toBe(true);
    expect(autoSkipped.result?.cooldownRemainingSeconds).toBeGreaterThan(0);

    const history = getRotationHistory();
    expect(history).toHaveLength(2);
    expect(history[0].status).toBe('COOLDOWN_SKIPPED');
    expect(history[0].profileId).toBe('profile-123');
    expect(history[1].status).toBe('SUCCESS');

    expect(clearRotationHistory()).toBe(true);
    expect(getRotationHistory()).toEqual([]);
  });

  it('rejects non-2xx webhook responses clearly with status error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);

    await expect(rotateViaWebhook('https://dongle.local/api/rotate', 'POST')).rejects.toThrow(
      /HTTP 503/
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes authenticated /mobile-rotator/* routes on Local API Server', async () => {
    const server = createLocalApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const token = getApiAuthToken();

    try {
      const saveRes = await fetch(`${baseUrl}/mobile-rotator/config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'webhook',
          webhookUrl: 'https://example.org/rotate',
          autoRotateOnProfileStart: true,
          minIntervalSeconds: 45,
        }),
      });
      expect(saveRes.status).toBe(200);
      const savedConfig = await saveRes.json();
      expect(savedConfig.autoRotateOnProfileStart).toBe(true);
      expect(savedConfig.minIntervalSeconds).toBe(45);

      const getRes = await fetch(`${baseUrl}/mobile-rotator/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(getRes.status).toBe(200);
      expect(getRotatorConfig().minIntervalSeconds).toBe(45);

      const historyRes = await fetch(`${baseUrl}/mobile-rotator/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(historyRes.status).toBe(200);
      expect(Array.isArray(await historyRes.json())).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('resolves bundled platform-tools package and validates Windows DLL dependencies', async () => {
    delete process.env.MAHI_ADB_PATH;

    // Staged .mahi_data/platform-tools or packaged resources/platform-tools with incomplete DLLs must not pass on win32
    const fakeResourcesDir = path.join(tempDir, 'packaged-resources');
    const ptDir = path.join(fakeResourcesDir, 'platform-tools');
    fs.mkdirSync(ptDir, { recursive: true });
    const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
    fs.writeFileSync(path.join(ptDir, adbName), 'fake-bundled-adb');

    const prevResourcesPath = (process as any).resourcesPath;
    (process as any).resourcesPath = fakeResourcesDir;

    try {
      if (process.platform === 'win32') {
        fs.writeFileSync(path.join(ptDir, 'AdbWinApi.dll'), 'dll1');
        fs.writeFileSync(path.join(ptDir, 'AdbWinUsbApi.dll'), 'dll2');
      }

      const resolved = await resolveAdbExecutable();
      expect(resolved.adbPath).toBe(path.join(ptDir, adbName));
      expect(resolved.source).toBe('bundled');
    } finally {
      (process as any).resourcesPath = prevResourcesPath;
    }
  });
});
