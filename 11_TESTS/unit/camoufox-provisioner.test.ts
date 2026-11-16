import { describe, it, expect, vi } from 'vitest';
import https from 'node:https';
import fs from 'node:fs';
import {
  resolveCamoufoxRelease,
  getPinnedCamoufoxRelease,
  getCamoufoxPlatformArch,
  checkDiskFreeSpace,
  PINNED_CAMOUFOX_VERSION,
} from '../../02_BROWSER/services/engine-download-service.js';

describe('Camoufox Auto-Provisioner & URL Resolution Suite (BUG-01 & BUG-03 Regression)', () => {
  it('correctly maps OS platform and architecture to dot-separated naming convention', () => {
    const { plat, arch } = getCamoufoxPlatformArch();
    expect(['win', 'lin', 'mac']).toContain(plat);
    expect(['x86_64', 'arm64', 'i686']).toContain(arch);

    // Verify regex matches dot-separated platform and rejects hyphenated filenames
    const dotRegex = new RegExp(`^camoufox-[\\d.]+(?:-beta\\.\\d+)?-${plat}\\.${arch}\\.zip$`, 'i');
    const validAsset = `camoufox-135.0.1-beta.24-${plat}.${arch}.zip`;
    const invalidHyphenatedAsset = `camoufox-135.0.1-beta.24-${plat}-${arch}.zip`;

    expect(dotRegex.test(validAsset)).toBe(true);
    expect(dotRegex.test(invalidHyphenatedAsset)).toBe(false);
  });

  it('guarantees pinned Camoufox release URL constant adheres to official GitHub schema', () => {
    const pinned = getPinnedCamoufoxRelease();
    expect(pinned.tag).toBe(PINNED_CAMOUFOX_VERSION);
    expect(pinned.assetName).toMatch(/^camoufox-[\d.]+(-beta\.\d+)?-(win|lin|mac)\.(x86_64|arm64|i686)\.zip$/);
    expect(pinned.downloadUrl).toMatch(
      /^https:\/\/github\.com\/daijro\/camoufox\/releases\/download\/v[\d.]+(-beta\.\d+)?\/camoufox-[\d.]+(-beta\.\d+)?-(win|lin|mac)\.(x86_64|arm64|i686)\.zip$/
    );
  });

  it('throws INSUFFICIENT_DISK when available storage is less than 3x archive size', () => {
    const mockStatfs = vi.spyOn(fs, 'statfsSync' as any).mockReturnValue({
      bavail: 100, // Very low free space
      bsize: 1024,
    } as any);

    try {
      expect(() => {
        checkDiskFreeSpace(process.cwd(), 3 * 550 * 1024 * 1024);
      }).toThrow(/INSUFFICIENT_DISK/);
    } finally {
      mockStatfs.mockRestore();
    }
  });

  it('passes disk space preflight when storage satisfies the 3x requirement', () => {
    const mockStatfs = vi.spyOn(fs, 'statfsSync' as any).mockReturnValue({
      bavail: 10000000,
      bsize: 1024, // ~10 GB
    } as any);

    try {
      expect(() => {
        checkDiskFreeSpace(process.cwd(), 3 * 550 * 1024 * 1024);
      }).not.toThrow();
    } finally {
      mockStatfs.mockRestore();
    }
  });

  // Optional live network assertion (runs when MAHI_NETWORK_TESTS=1 or when online)
  describe.skipIf(!process.env.MAHI_NETWORK_TESTS)('Live GitHub Network Head Verification', () => {
    it('verifies HEAD on pinned release download URL returns HTTP 302 or 200', async () => {
      const pinned = getPinnedCamoufoxRelease();
      const statusCode = await new Promise<number>((resolve, reject) => {
        const req = https.request(pinned.downloadUrl, { method: 'HEAD', timeout: 10000 }, (res) => {
          resolve(res.statusCode || 0);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('Timeout')); });
        req.end();
      });

      expect([200, 302]).toContain(statusCode);
    });
  });
});
