import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getDeviceId,
  getLegacyDeviceId,
  computeStableDeviceId,
  matchHardwareSignals,
  isSameDevice,
  resetDeviceIdCacheForTesting,
  HardwareSignals,
} from '../../03_HARDWARE/device-id.js';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { registerOrUpdateDevice, getUserDevices } from '../../07_BACKEND/commercial/commercial-device-service.js';
import { createLicense, activateLicense, validateCurrentLicense } from '../../04_LICENSING/license-engine.js';

describe('Layer 1 Step 3 — Backward-Compatible Fuzzy HWID & Zero-Lockout Verification', () => {
  let tempDir: string;

  beforeEach(async () => {
    resetDeviceIdCacheForTesting();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-fuzzy-hwid-'));
    setCustomDatabasePath(path.join(tempDir, 'test_hwid.sqlite'));
    await initializeDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDeviceIdCacheForTesting();
    closeDatabase();
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('1. stable HWID stays invariant when hostname or username changes (unlike legacy ID)', () => {
    const hostSpy = vi.spyOn(os, 'hostname').mockReturnValue('DESKTOP-ORIGINAL');
    const userSpy = vi.spyOn(os, 'userInfo').mockReturnValue({
      username: 'alice',
      uid: 1000,
      gid: 1000,
      shell: null,
      homedir: 'C:\\Users\\alice',
    });

    const stable1 = getDeviceId();
    const legacy1 = getLegacyDeviceId();

    // Simulate computer rename, VPN hostname change, or Windows user switch
    hostSpy.mockReturnValue('CORP-VPN-LAPTOP-99');
    userSpy.mockReturnValue({
      username: 'bob_admin',
      uid: 1001,
      gid: 1001,
      shell: null,
      homedir: 'C:\\Users\\bob_admin',
    });
    resetDeviceIdCacheForTesting();

    const stable2 = getDeviceId();
    const legacy2 = getLegacyDeviceId();

    expect(stable2).toBe(stable1);
    expect(legacy2).not.toBe(legacy1);
  });

  it('2. 2-of-3 fuzzy matcher tolerates 1 swapped hardware signal and rejects 2+ changed signals', () => {
    const baseline: HardwareSignals = {
      machineGuid: 'guid-hash-aaa111',
      cpuSignature: 'cpu-hash-bbb222',
      diskSerial: 'disk-hash-ccc333',
    };

    // SSD swapped: 2 of 3 signals still match
    const oneSwapped: HardwareSignals = {
      machineGuid: 'guid-hash-aaa111',
      cpuSignature: 'cpu-hash-bbb222',
      diskSerial: 'disk-hash-new999',
    };
    const matchOne = matchHardwareSignals(baseline, oneSwapped);
    expect(matchOne.isMatch).toBe(true);
    expect(matchOne.matchedSignals).toBe(2);
    expect(matchOne.details).toEqual({
      machineGuid: true,
      cpuSignature: true,
      diskSerial: false,
    });

    // Different machine (only CPU model happens to be the same, 2 signals differ)
    const twoSwapped: HardwareSignals = {
      machineGuid: 'guid-hash-other777',
      cpuSignature: 'cpu-hash-bbb222',
      diskSerial: 'disk-hash-other888',
    };
    const matchTwo = matchHardwareSignals(baseline, twoSwapped);
    expect(matchTwo.isMatch).toBe(false);
    expect(matchTwo.matchedSignals).toBe(1);

    // Candidate vs registered check with computeStableDeviceId
    const baselineId = computeStableDeviceId(baseline);
    const swappedId = computeStableDeviceId(oneSwapped);
    expect(swappedId).not.toBe(baselineId);
    expect(
      isSameDevice(
        { deviceId: swappedId, signals: oneSwapped },
        { deviceId: baselineId, signals: baseline }
      )
    ).toBe(true);
    expect(
      isSameDevice(
        { deviceId: computeStableDeviceId(twoSwapped), signals: twoSwapped },
        { deviceId: baselineId, signals: baseline }
      )
    ).toBe(false);
  });

  it('3. legacy v1.2.2 registered devices and 1-signal-swapped devices match without maxAllowedDevices=1 false lockouts', () => {
    const userId = 'user-legacy-upgrade-1';
    const legacyId = getLegacyDeviceId();
    const stableId = getDeviceId();

    // Step A: Simulate pre-upgrade v1.2.2 device stored in commercial_devices under legacyId
    const initialReg = registerOrUpdateDevice({
      userId,
      deviceId: legacyId,
      deviceName: 'Old Hostname PC',
      maxAllowedDevices: 1,
    });
    expect(initialReg.success).toBe(true);

    // Step B: User upgrades to v1.3.0; client checks in with new stable HWID (with maxAllowedDevices=1)
    const upgradedReg = registerOrUpdateDevice({
      userId,
      maxAllowedDevices: 1,
    });
    expect(upgradedReg.success).toBe(true);
    expect(upgradedReg.device?.deviceId).toBe(stableId);
    expect(getUserDevices(userId)).toHaveLength(1);

    // Step C: Later user swaps SSD (diskSerial changes -> new stable deviceId, 2-of-3 fuzzy match)
    const swappedSignals: HardwareSignals = {
      machineGuid: 'guid-hash-aaa111',
      cpuSignature: 'cpu-hash-bbb222',
      diskSerial: 'disk-hash-nvme-new',
    };
    const origSignals: HardwareSignals = {
      machineGuid: 'guid-hash-aaa111',
      cpuSignature: 'cpu-hash-bbb222',
      diskSerial: 'disk-hash-sata-old',
    };

    const user2 = 'user-ssd-swap-2';
    const reg2a = registerOrUpdateDevice({
      userId: user2,
      deviceId: computeStableDeviceId(origSignals),
      hardwareSignals: origSignals,
      maxAllowedDevices: 1,
    });
    expect(reg2a.success).toBe(true);

    const reg2b = registerOrUpdateDevice({
      userId: user2,
      deviceId: computeStableDeviceId(swappedSignals),
      hardwareSignals: swappedSignals,
      maxAllowedDevices: 1,
    });
    expect(reg2b.success).toBe(true);
    expect(getUserDevices(user2)).toHaveLength(1);
  });

  it('4. license-engine recognizes and validates existing license activated with legacy v1.2.2 deviceId', () => {
    const legacyId = getLegacyDeviceId();
    const created = createLicense({
      customerName: 'Legacy License User',
      durationType: '30_DAYS',
      maxDevices: 1,
    });

    const licenseKey = created.rawLicenseKey!;

    // Activate under legacy v1.2.2 device ID
    const act = activateLicense(licenseKey, legacyId, 'Legacy Desktop');
    expect(act.success).toBe(true);

    // Validate under upgraded runtime without targetDeviceId
    const val = validateCurrentLicense();
    expect(val.isValid).toBe(true);
    expect(val.status).toBe('ACTIVE');

    // Re-activating on the same machine with new stable getDeviceId() must succeed within maxDevices=1
    const react = activateLicense(licenseKey);
    expect(react.success).toBe(true);
  });
});
