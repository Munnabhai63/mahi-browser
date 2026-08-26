import crypto from 'node:crypto';
import os from 'node:os';

/**
 * Generates a privacy-conscious, stable device identifier for MAHI license binding.
 * Uses system hostname, platform, release, username, and machine salt.
 * Raw hardware serials are NOT collected.
 */
export function getDeviceId(): string {
  const payload = [
    os.platform(),
    os.arch(),
    os.hostname(),
    os.userInfo()?.username || 'user',
    'mahi_pro_device_salt_v1',
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

export function getDeviceName(): string {
  const host = os.hostname();
  const platform = os.platform() === 'win32' ? 'Windows PC' : os.platform() === 'darwin' ? 'Mac' : 'Linux';
  return `${host} (${platform})`;
}
