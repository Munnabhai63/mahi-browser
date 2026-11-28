import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import child_process from 'node:child_process';
import fs from 'node:fs';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('license-service');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzYel0Zuz0vYdzszLm2z5
GYRR+UzBtP93VVNaKGmEa81Ga8hQfO2GRAXoCRkwMLUEjByolGP5btsJUndjU6/9
xnHYPzjC+GfUKIAaJvxAz41YfzOfjnMCEt709LyPBoLDwwKo8c0feuo12pYvYWqB
hSMo402RGa2nXrYV6u2PHPk0MWkB4MivQTZ7zq932rzNiXihh8kWjDBkSruNfBnd
GqF3h6MISV3mHoO3AXSwD2PYWKhkljkOp4W/VfypOBXnoU6bKhMthPs/1fAISyH3
dGocQFs1hIUa/8KolAFRcoORmpBdOcVDdcwGvsoE6JIBgHy7kPlFOMJHUcVd7bPT
kQIDAQAB
-----END PUBLIC KEY-----`;

let cachedHwid: string | null = null;

function getMachineGuid(): string {
  try {
    if (process.platform === 'win32') {
      const output = child_process.execSync(
        'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const match = output.match(/MachineGuid\s+REG_SZ\s+([A-Fa-f0-9-]+)/i);
      if (match?.[1]) {
        return match[1].trim();
      }
    } else if (process.platform === 'darwin') {
      const output = child_process.execSync(
        'ioreg -rd1 -c IOPlatformExpertDevice',
        { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/i);
      if (match?.[1]) {
        return match[1].trim();
      }
    } else {
      if (fs.existsSync('/etc/machine-id')) {
        return fs.readFileSync('/etc/machine-id', 'utf8').trim();
      }
      if (fs.existsSync('/var/lib/dbus/machine-id')) {
        return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
      }
    }
  } catch (err) {
    log.debug('Native OS machine-id lookup fell back to secondary signals', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return '';
}

export function resetHwidCacheForTesting(): void {
  cachedHwid = null;
}

/**
 * Gets the unique Hardware ID (HWID) for this computer.
 * It combines OS machine GUID, CPU model, and total memory to create a machine-bound static identifier.
 */
export function getHWID(): string {
  if (cachedHwid) return cachedHwid;
  try {
    const machineGuid = getMachineGuid();
    const cpuModel = (os.cpus()?.[0]?.model) || '';
    const mem = os.totalmem ? os.totalmem() : 0;
    const raw = `${machineGuid}:${cpuModel}:${mem}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
    const short = hash.substring(0, 16);
    // Format as XXXX-XXXX-XXXX-XXXX
    cachedHwid = `MAHI-${short.substring(0,4)}-${short.substring(4,8)}-${short.substring(8,12)}-${short.substring(12,16)}`;
    return cachedHwid;
  } catch {
    return 'MAHI-UNKNOWN-HWID';
  }
}

/**
 * Verifies an RSA-signed license key against the HWID.
 * The key format is expected to be: base64(JSON(hwid, exp, sig))
 */
export function verifyLicense(licenseKey: string): { valid: boolean; error?: string; expiresAt?: string } {
  try {
    let raw = (licenseKey || '').trim();
    if (raw.startsWith('MAHI-')) {
      raw = raw.substring(5);
    }
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const data = JSON.parse(decoded);

    if (!data.hwid || !data.exp || !data.sig) {
      return { valid: false, error: 'Invalid license format' };
    }

    const currentHwid = getHWID();
    if (data.hwid !== currentHwid) {
      return { valid: false, error: 'License is not valid for this PC (HWID Mismatch)' };
    }

    if (Date.now() > data.exp) {
      return { valid: false, error: 'License has expired' };
    }

    // Verify RSA signature
    const verify = crypto.createVerify('SHA256');
    verify.update(`${data.hwid}:${data.exp}`);
    verify.end();

    const isAuthentic = verify.verify(PUBLIC_KEY, data.sig, 'base64');
    
    if (!isAuthentic) {
      return { valid: false, error: 'License signature is invalid or tampered' };
    }

    return { 
      valid: true, 
      expiresAt: new Date(data.exp).toISOString()
    };
  } catch {
    return { valid: false, error: 'Invalid license key' };
  }
}

/**
 * Resolves a stored offline RSA license key from `offline-license.key` or `claimed-licenses.json`.
 * Keeps offline RSA cryptographic discovery inside `08_SECURITY/license-service.ts`.
 */
export function resolveOfflineLicenseKey(
  userDataDir: string,
  options: { requireValidOfflineKey?: boolean } = {}
): string | null {
  const requireValidOfflineKey = options.requireValidOfflineKey ?? true;
  try {
    const licenseFile = path.join(userDataDir, 'offline-license.key');
    if (fs.existsSync(licenseFile)) {
      const rawKey = fs.readFileSync(licenseFile, 'utf8').trim();
      if (rawKey && (!requireValidOfflineKey || verifyLicense(rawKey).valid)) {
        return rawKey;
      }
    }

    const claimedFile = path.join(userDataDir, 'claimed-licenses.json');
    if (fs.existsSync(claimedFile)) {
      const claimed = JSON.parse(fs.readFileSync(claimedFile, 'utf8')) as Record<string, unknown>;
      for (const candidate of Object.values(claimed)) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed && verifyLicense(trimmed).valid) {
            return trimmed;
          }
        }
      }
    }
  } catch (err) {
    log.debug('Offline/claimed license lookup skipped', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

/** Asynchronous equivalent of `resolveOfflineLicenseKey` using `fs.promises`. */
export async function resolveOfflineLicenseKeyAsync(
  userDataDir: string,
  options: { requireValidOfflineKey?: boolean } = {}
): Promise<string | null> {
  const requireValidOfflineKey = options.requireValidOfflineKey ?? true;
  try {
    const licenseFile = path.join(userDataDir, 'offline-license.key');
    try {
      const rawKey = (await fs.promises.readFile(licenseFile, 'utf8')).trim();
      if (rawKey && (!requireValidOfflineKey || verifyLicense(rawKey).valid)) {
        return rawKey;
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        log.debug('Async offline-license.key read skipped', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const claimedFile = path.join(userDataDir, 'claimed-licenses.json');
    try {
      const claimed = JSON.parse(await fs.promises.readFile(claimedFile, 'utf8')) as Record<string, unknown>;
      for (const candidate of Object.values(claimed)) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed && verifyLicense(trimmed).valid) {
            return trimmed;
          }
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        log.debug('Async claimed-licenses.json read skipped', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    log.debug('Async offline/claimed license lookup skipped', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export function hasValidOfflineLicenseKey(userDataDir: string): boolean {
  return resolveOfflineLicenseKey(userDataDir, { requireValidOfflineKey: true }) !== null;
}

export async function hasValidOfflineLicenseKeyAsync(userDataDir: string): Promise<boolean> {
  return (await resolveOfflineLicenseKeyAsync(userDataDir, { requireValidOfflineKey: true })) !== null;
}
