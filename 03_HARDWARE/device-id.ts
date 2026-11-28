import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import child_process from 'node:child_process';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('device-id');

export interface HardwareSignals {
  /** OS-level unique machine identifier (Windows MachineGuid / macOS IOPlatformUUID / Linux machine-id) */
  machineGuid: string;
  /** Normalized CPU model + physical/logical core signature */
  cpuSignature: string;
  /** Primary disk / volume / board serial identifier */
  diskSerial: string;
}

export interface FuzzyHardwareMatchResult {
  isMatch: boolean;
  matchedSignals: number;
  totalComparableSignals: number;
  details: {
    machineGuid: boolean;
    cpuSignature: boolean;
    diskSerial: boolean;
  };
}

let cachedSignals: HardwareSignals | null = null;
let cachedStableDeviceId: string | null = null;

function hashSignal(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 24);
}

function readMachineGuid(): string {
  try {
    if (process.platform === 'win32') {
      const output = child_process.execSync(
        'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const match = output.match(/MachineGuid\s+REG_SZ\s+([A-Fa-f0-9-]+)/i);
      if (match?.[1]) return match[1].trim();
    } else if (process.platform === 'darwin') {
      const output = child_process.execSync(
        'ioreg -rd1 -c IOPlatformExpertDevice',
        { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/i);
      if (match?.[1]) return match[1].trim();
    } else {
      if (fs.existsSync('/etc/machine-id')) {
        const val = fs.readFileSync('/etc/machine-id', 'utf8').trim();
        if (val) return val;
      }
      if (fs.existsSync('/var/lib/dbus/machine-id')) {
        const val = fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
        if (val) return val;
      }
    }
  } catch (err) {
    log.debug('device-id machine-guid probe failed', { err });
  }
  return '';
}

function readCpuSignature(): string {
  try {
    const cpus = os.cpus();
    const model = cpus && cpus.length > 0 ? cpus[0].model.replace(/\s+/g, ' ').trim() : '';
    const count = cpus ? cpus.length : 0;
    if (model || count > 0) {
      return `${os.platform()}|${os.arch()}|${model}|${count}`;
    }
  } catch (err) {
    log.debug('device-id cpu signature probe failed', { err });
  }
  return `${os.platform()}|${os.arch()}|${os.totalmem ? os.totalmem() : 0}`;
}

function readDiskSerial(): string {
  try {
    if (process.platform === 'win32') {
      try {
        const regOut = child_process.execSync(
          'reg query "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Disk\\Enum" /v 0',
          { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }
        );
        const regMatch = regOut.match(/0\s+REG_SZ\s+(.+)/i);
        if (regMatch?.[1]?.trim()) {
          return regMatch[1].trim();
        }
      } catch (err) {
        log.debug('device-id windows disk enum probe failed, falling back to vol', { err });
      }

      const volOut = child_process.execSync(
        'cmd /c vol %SystemDrive%',
        { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const volMatch = volOut.match(/([0-9A-F]{4}-[0-9A-F]{4})/i);
      if (volMatch?.[1]) return volMatch[1].trim();
    } else if (process.platform === 'darwin') {
      const output = child_process.execSync(
        'ioreg -rd1 -c AppleNVMeController',
        { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const match = output.match(/"Serial Number"\s*=\s*"([^"]+)"/i);
      if (match?.[1]) return match[1].trim();
    } else {
      if (fs.existsSync('/sys/class/dmi/id/product_uuid')) {
        const val = fs.readFileSync('/sys/class/dmi/id/product_uuid', 'utf8').trim();
        if (val) return val;
      }
      if (fs.existsSync('/dev/disk/by-uuid')) {
        const entries = fs.readdirSync('/dev/disk/by-uuid').filter(Boolean).sort();
        if (entries.length > 0) return entries[0];
      }
    }
  } catch (err) {
    log.debug('device-id disk serial probe failed', { err });
  }
  return '';
}

/**
 * Resets cached hardware signals and device IDs (intended strictly for unit tests).
 */
export function resetDeviceIdCacheForTesting(): void {
  cachedSignals = null;
  cachedStableDeviceId = null;
}

/**
 * Collects and caches hashed, privacy-preserving hardware signals.
 * Never incorporates volatile hostname, Windows username, or VPN interfaces.
 */
export function collectHardwareSignals(forceRefresh = false): HardwareSignals {
  if (!forceRefresh && cachedSignals) {
    return cachedSignals;
  }

  const signals: HardwareSignals = {
    machineGuid: hashSignal(readMachineGuid()),
    cpuSignature: hashSignal(readCpuSignature()),
    diskSerial: hashSignal(readDiskSerial()),
  };

  cachedSignals = signals;
  return signals;
}

/**
 * Computes the deterministic 32-char device ID from stable hardware attributes.
 */
export function computeStableDeviceId(signals: HardwareSignals): string {
  const hasAnySignal = Boolean(signals.machineGuid || signals.cpuSignature || signals.diskSerial);
  if (!hasAnySignal) {
    return getLegacyDeviceId();
  }

  const payload = [
    os.platform(),
    signals.machineGuid,
    signals.cpuSignature,
    signals.diskSerial,
    'mahi_pro_stable_hwid_v2',
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

/**
 * Legacy v1 device ID formula (hostname + username + platform + arch).
 * Preserved strictly for backward-compatible matching of live v1.2.2 users.
 */
export function getLegacyDeviceId(): string {
  let username = 'user';
  try {
    username = os.userInfo()?.username || 'user';
  } catch (err) {
    log.debug('device-id os.userInfo fallback to default username', { err });
  }

  const payload = [
    os.platform(),
    os.arch(),
    os.hostname(),
    username,
    'mahi_pro_device_salt_v1',
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

/**
 * Returns the current machine's stable Hardware Device ID (immune to hostname/username/VPN changes).
 */
export function getDeviceId(): string {
  if (cachedStableDeviceId) {
    return cachedStableDeviceId;
  }
  const signals = collectHardwareSignals();
  cachedStableDeviceId = computeStableDeviceId(signals);
  return cachedStableDeviceId;
}

/**
 * 2-of-3 fuzzy hardware matcher.
 * Tolerates replacing 1 hardware attribute (e.g., SSD swap or OS reinstall GUID update)
 * while rejecting devices where 2+ hardware signals diverge.
 */
export function matchHardwareSignals(
  a: Partial<HardwareSignals>,
  b: Partial<HardwareSignals>
): FuzzyHardwareMatchResult {
  const details = {
    machineGuid: Boolean(a.machineGuid && b.machineGuid && a.machineGuid === b.machineGuid),
    cpuSignature: Boolean(a.cpuSignature && b.cpuSignature && a.cpuSignature === b.cpuSignature),
    diskSerial: Boolean(a.diskSerial && b.diskSerial && a.diskSerial === b.diskSerial),
  };

  let totalComparableSignals = 0;
  if (a.machineGuid && b.machineGuid) totalComparableSignals++;
  if (a.cpuSignature && b.cpuSignature) totalComparableSignals++;
  if (a.diskSerial && b.diskSerial) totalComparableSignals++;

  const matchedSignals =
    (details.machineGuid ? 1 : 0) +
    (details.cpuSignature ? 1 : 0) +
    (details.diskSerial ? 1 : 0);

  return {
    isMatch: matchedSignals >= 2,
    matchedSignals,
    totalComparableSignals,
    details,
  };
}

/**
 * Determines whether a candidate device matches a registered device record using:
 * 1. Exact stable deviceId match
 * 2. Legacy v1.2.2 deviceId compatibility match
 * 3. 2-of-3 fuzzy hardware signal match
 */
export function isSameDevice(
  candidate: {
    deviceId?: string;
    legacyDeviceId?: string;
    signals?: Partial<HardwareSignals>;
  },
  registered: {
    deviceId: string;
    legacyDeviceId?: string;
    signals?: Partial<HardwareSignals>;
  }
): boolean {
  if (candidate.deviceId && candidate.deviceId === registered.deviceId) {
    return true;
  }
  if (candidate.legacyDeviceId && candidate.legacyDeviceId === registered.deviceId) {
    return true;
  }
  if (candidate.deviceId && registered.legacyDeviceId && candidate.deviceId === registered.legacyDeviceId) {
    return true;
  }
  if (
    candidate.legacyDeviceId &&
    registered.legacyDeviceId &&
    candidate.legacyDeviceId === registered.legacyDeviceId
  ) {
    return true;
  }
  if (candidate.signals && registered.signals) {
    return matchHardwareSignals(candidate.signals, registered.signals).isMatch;
  }
  return false;
}

export function getDeviceName(): string {
  const host = os.hostname();
  const platform = os.platform() === 'win32' ? 'Windows PC' : os.platform() === 'darwin' ? 'Mac' : 'Linux';
  return `${host} (${platform})`;
}
