import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { verifyLicense, getHWID } from '../../08_SECURITY/license-service.js';

describe('Offline RSA-2048 Licensing & Keygen Integration', () => {
  it('should generate a valid 1-year signed key for current machine HWID', () => {
    const currentHwid = getHWID();
    const keygenPath = path.resolve(process.cwd(), '../mahi-keygen/keygen.cjs');

    const output = execSync(`node "${keygenPath}" "${currentHwid}" 12`).toString();
    const keyMatch = output.match(/LICENSE KEY:\r?\n(MAHI-[A-Za-z0-9+/=_-]+)/);
    expect(keyMatch).not.toBeNull();

    const licenseKey = keyMatch![1];
    const result = verifyLicense(licenseKey);

    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBeDefined();

    const diffDays = Math.round(
      (new Date(result.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeGreaterThanOrEqual(360);
    expect(diffDays).toBeLessThanOrEqual(366);
  });

  it('should reject a license signed for a different HWID', () => {
    const fakeHwid = 'MAHI-0000-1111-2222-3333';
    const keygenPath = path.resolve(process.cwd(), '../mahi-keygen/keygen.cjs');

    const output = execSync(`node "${keygenPath}" "${fakeHwid}" 12`).toString();
    const keyMatch = output.match(/LICENSE KEY:\r?\n(MAHI-[A-Za-z0-9+/=_-]+)/);
    expect(keyMatch).not.toBeNull();

    const licenseKey = keyMatch![1];
    const result = verifyLicense(licenseKey);

    expect(result.valid).toBe(false);
    expect(result.error?.toLowerCase()).toContain('mismatch');
  });
});
