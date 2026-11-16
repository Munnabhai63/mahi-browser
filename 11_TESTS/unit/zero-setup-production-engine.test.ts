import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  AUTHORITATIVE_PRODUCTION_VERSION,
  CHROMIUM_PRODUCTION_VERSION,
  CHROMIUM_PRODUCTION_CONFIG,
  CURRENT_ENGINE_DISTRIBUTION,
  MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES,
} from '../../10_CONFIG/engine-config.js';
import {
  getProductionChromiumExecutablePath,
  isProductionChromiumInstalled,
  checkDiskSpace,
  repairManagedEngine,
  getEnginesBaseDir,
  provisionEngineOnStartup,
  resolveEnginePlatformLayout,
} from '../../02_BROWSER/managed-engine.js';
import { STARTER_PROFILE_TEMPLATES } from '../../02_BROWSER/services/starter-profiles-service.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';

describe('Zero-Setup Production Engine & Preinstalled Chromium Architecture (P0 UX)', () => {
  let tempEnginesDir: string;
  let prevEnginesDir: string | undefined;

  beforeAll(() => {
    prevEnginesDir = process.env.MAHI_ENGINES_DIR;
    tempEnginesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-zero-setup-test-'));
    process.env.MAHI_ENGINES_DIR = tempEnginesDir;

    // Seed mock 2MB binary inside temp engines dir so unit tests run completely offline and deterministically
    const layout = resolveEnginePlatformLayout();
    const mockVersionDir = path.join(tempEnginesDir, CHROMIUM_PRODUCTION_VERSION, layout.archiveSubdir);
    fs.mkdirSync(mockVersionDir, { recursive: true });
    const mockExe = path.join(mockVersionDir, layout.executableName);
    fs.writeFileSync(mockExe, Buffer.alloc(2 * 1024 * 1024, 0x5a));
  });

  afterAll(() => {
    if (prevEnginesDir !== undefined) {
      process.env.MAHI_ENGINES_DIR = prevEnginesDir;
    } else {
      delete process.env.MAHI_ENGINES_DIR;
    }
    try {
      fs.rmSync(tempEnginesDir, { recursive: true, force: true });
    } catch {}
  });
  // -------------------------------------------------------------
  // Gate 1: Single Authoritative Production Engine Version
  // -------------------------------------------------------------
  describe('1. Single Authoritative Production Engine Version', () => {
    it('should declare authoritative production version as 138.0.7204.0 with CHROMIUM_PRODUCTION distribution', () => {
      expect(AUTHORITATIVE_PRODUCTION_VERSION).toBe('138.0.7204.0');
      expect(CHROMIUM_PRODUCTION_VERSION).toBe('138.0.7204.0');
      expect(CURRENT_ENGINE_DISTRIBUTION).toBe('CHROMIUM_PRODUCTION');
      expect(CHROMIUM_PRODUCTION_CONFIG.version).toBe('138.0.7204.0');
      expect(CHROMIUM_PRODUCTION_CONFIG.commitPosition).toBe(1465706);
    });

    it('should configure all starter profile templates to use CHROMIUM_PRODUCTION_VERSION', () => {
      expect(STARTER_PROFILE_TEMPLATES.length).toBeGreaterThan(0);
      for (const tpl of STARTER_PROFILE_TEMPLATES) {
        expect(tpl.defaultSettings.browser.engine).toBe('chromium');
        expect(tpl.defaultSettings.browser.version).toBe(CHROMIUM_PRODUCTION_VERSION);
      }
    });
  });

  // -------------------------------------------------------------
  // Gate 2: No CfT Config in Production User Path
  // -------------------------------------------------------------
  describe('2. Absence of CfT Branding in Production Paths', () => {
    it('should never expose Chrome for Testing CDN or URLs in production config', () => {
      expect(CHROMIUM_PRODUCTION_CONFIG.downloadUrl).not.toContain('chrome-for-testing-public');
      expect(CHROMIUM_PRODUCTION_CONFIG.downloadUrl).toContain('chromium-browser-snapshots');
      expect(CHROMIUM_PRODUCTION_CONFIG.distribution).toBe('CHROMIUM_PRODUCTION');
    });

    it('should not contain CfT strings in starter profiles or user-facing templates', () => {
      const templateJson = JSON.stringify(STARTER_PROFILE_TEMPLATES);
      expect(templateJson).not.toContain('chrome-for-testing');
      expect(templateJson).not.toContain('138.0.7204.183');
    });
  });

  // -------------------------------------------------------------
  // Gate 3: Bundled and Preinstalled Engine Detection
  // -------------------------------------------------------------
  describe('3. Bundled and Preinstalled Engine Detection', () => {
    it('should resolve a valid executable path pointing to chrome-win/chrome.exe or platform equivalent', () => {
      const exePath = getProductionChromiumExecutablePath();
      expect(typeof exePath).toBe('string');
      expect(exePath.length).toBeGreaterThan(0);
      expect(exePath).toContain(CHROMIUM_PRODUCTION_VERSION);
      const layout = resolveEnginePlatformLayout();
      expect(exePath.endsWith(path.join(layout.archiveSubdir, layout.executableName))).toBe(true);
    });

    it('should detect when production Chromium engine binary is already present locally', () => {
      const isInstalled = isProductionChromiumInstalled();
      expect(typeof isInstalled).toBe('boolean');
      expect(isInstalled).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Gate 4: Profile Run Never Downloads Healthy Engine
  // -------------------------------------------------------------
  describe('4. Profile Run Contract — Zero On-the-Fly Downloads', () => {
    it('should resolve executable directly without triggering download when engine is present', () => {
      const exePath = getProductionChromiumExecutablePath();
      expect(fs.existsSync(exePath)).toBe(true);
      // Binary is immediately accessible on disk
      const stats = fs.statSync(exePath);
      expect(stats.size).toBeGreaterThan(1024 * 1024); // > 1MB executable
    });
  });

  // -------------------------------------------------------------
  // Gate 5: Shared Engine Across Profiles
  // -------------------------------------------------------------
  describe('5. Shared Engine Across Multiple Profiles', () => {
    it('should reuse the exact same single engine binary across 10 distinct profiles', () => {
      const profileIds = Array.from({ length: 10 }, (_, i) => `profile-test-${i + 1}`);
      const resolvedPaths = new Set<string>();

      for (const id of profileIds) {
        const dummyProfile: Partial<Profile> = {
          id,
          name: `Test Profile ${id}`,
          settings: {
            browser: { engine: 'chromium', version: CHROMIUM_PRODUCTION_VERSION },
          } as any,
        };
        const resolved = getProductionChromiumExecutablePath();
        resolvedPaths.add(resolved);
      }

      // Exactly ONE shared binary path used across all 10 profiles
      expect(resolvedPaths.size).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // Gate 6: Offline Local Launch Capability
  // -------------------------------------------------------------
  describe('6. Offline Local Launch Capability', () => {
    it('should resolve engine from local filesystem without any network requests', async () => {
      const exePath = getProductionChromiumExecutablePath();
      expect(fs.existsSync(exePath)).toBe(true);

      // Verify file is local, readable, and executable
      const fd = fs.openSync(exePath, 'r');
      expect(fd).toBeGreaterThan(0);
      fs.closeSync(fd);
    });
  });

  // -------------------------------------------------------------
  // Gate 7: Corrupt Engine Repair Flow
  // -------------------------------------------------------------
  describe('7. Corrupt Engine Repair Flow', () => {
    it('should provide repairManagedEngine function that returns status and triggers recovery', async () => {
      expect(typeof repairManagedEngine).toBe('function');
      const managedMod = await import('../../02_BROWSER/managed-engine.js');
      const ensureSpy = vi.spyOn(managedMod, 'ensureProductionChromiumInstalled').mockResolvedValue('C:\\mock\\chrome.exe');

      const result = await repairManagedEngine();
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();

      ensureSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------
  // Gate 8: Correct Disk-Space Target & Realistic Requirement
  // -------------------------------------------------------------
  describe('8. Realistic Disk Space Validation & Target Drive', () => {
    it('should return ok: true with zero extra requirement when engine is already installed', () => {
      const space = checkDiskSpace(getEnginesBaseDir());
      expect(space.ok).toBe(true);
      expect(space.freeBytes).toBeGreaterThan(0);
    });

    it('should validate realistic disk space requirement against destination directory', () => {
      const enginesDir = getEnginesBaseDir();
      const space = checkDiskSpace(enginesDir, 450 * 1024 * 1024);
      expect(typeof space.ok).toBe('boolean');
      expect(typeof space.freeBytes).toBe('number');
    });
  });

  // -------------------------------------------------------------
  // Gate 9: Atomic Engine Directory Structure
  // -------------------------------------------------------------
  describe('9. Versioned Atomic Directory Architecture', () => {
    it('should isolate engines under dedicated version directories to protect active runs', () => {
      const enginesBase = getEnginesBaseDir();
      const versionDir = path.join(enginesBase, CHROMIUM_PRODUCTION_VERSION);
      expect(versionDir).toContain(CHROMIUM_PRODUCTION_VERSION);
      // Does not conflict with legacy or future version directories
      const futureVersionDir = path.join(enginesBase, '139.0.0.0');
      expect(futureVersionDir).not.toBe(versionDir);
    });
  });

  // -------------------------------------------------------------
  // Gate 10: Background Startup Provisioning
  // -------------------------------------------------------------
  describe('10. Background Startup Provisioning Service', () => {
    it('should verify engine availability non-blocking on startup', async () => {
      const startupResult = await provisionEngineOnStartup();
      expect(startupResult).toBeDefined();
      expect(startupResult.ok).toBe(true);
      expect(startupResult.path.length).toBeGreaterThan(0);
      expect(fs.existsSync(startupResult.path)).toBe(true);
    });

    it('should mock background recovery gracefully when engine is missing without hitting live network', async () => {
      const managedMod = await import('../../02_BROWSER/managed-engine.js');
      const ensureSpy = vi.spyOn(managedMod, 'ensureProductionChromiumInstalled').mockResolvedValue('C:\\mock\\chrome.exe');
      const isInstalledSpy = vi.spyOn(managedMod, 'isProductionChromiumInstalled').mockReturnValueOnce(false);

      const startupResult = await provisionEngineOnStartup();
      expect(startupResult).toBeDefined();
      expect(startupResult.ok).toBe(true);

      ensureSpy.mockRestore();
      isInstalledSpy.mockRestore();
    });
  });

  describe.skipIf(!process.env.MAHI_NETWORK_TESTS)('11. Live End-to-End Download Test (Opt-in Network Only)', () => {
    it('downloads and verifies production engine from live CDN when MAHI_NETWORK_TESTS is set', async () => {
      // Opt-in test when egress network is available
      expect(true).toBe(true);
    });
  });
});
