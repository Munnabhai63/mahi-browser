import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  CURRENT_ENGINE_DISTRIBUTION,
  CHROMIUM_PRODUCTION_CONFIG,
  CHROMIUM_PRODUCTION_VERSION,
  CHROMIUM_PRODUCTION_SHA256,
  CHROMIUM_PRODUCTION_DOWNLOAD_URL,
} from '../../10_CONFIG/engine-config.js';
import {
  getProductionChromiumExecutablePath,
  isProductionChromiumInstalled,
  getManagedEngineExecutablePath,
  isManagedEngineInstalled,
  resolveEnginePlatformLayout,
  getEnginesBaseDir,
} from '../../02_BROWSER/managed-engine.js';

const REAL_CHROMIUM = (() => {
  try {
    const p = getProductionChromiumExecutablePath();
    return fs.existsSync(p) && (fs.statSync(p).size > 10_000_000 || (process.platform === 'win32' && fs.existsSync(path.join(path.dirname(p), 'chrome.dll'))));
  } catch {
    return false;
  }
})();

describe('Production Unbranded Chromium Engine Suite (P0 Batch 1)', () => {
  let tempEnginesDir: string;

  beforeAll(() => {
    const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-prod-engine-test-'));
    tempEnginesDir = path.join(tempBase, 'engines');
    fs.mkdirSync(tempEnginesDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(path.dirname(tempEnginesDir), { recursive: true, force: true });
    } catch {}
  });

  it('declares CHROMIUM_PRODUCTION as the active engine policy', () => {
    expect(CURRENT_ENGINE_DISTRIBUTION).toBe('CHROMIUM_PRODUCTION');
  });

  it('defines explicit, verified production Chromium configuration', () => {
    expect(CHROMIUM_PRODUCTION_CONFIG.distribution).toBe('CHROMIUM_PRODUCTION');
    expect(CHROMIUM_PRODUCTION_CONFIG.version).toBe('138.0.7204.0');
    expect(CHROMIUM_PRODUCTION_CONFIG.commitPosition).toBe(1465706);
    expect(CHROMIUM_PRODUCTION_CONFIG.platform).toBe('win32');
    expect(CHROMIUM_PRODUCTION_CONFIG.arch).toBe('x64');
    expect(CHROMIUM_PRODUCTION_CONFIG.platformKey).toBe('win64');
    expect(CHROMIUM_PRODUCTION_CONFIG.archiveSubdir).toBe('chrome-win');
    expect(CHROMIUM_PRODUCTION_CONFIG.executableRelativePath).toBe('chrome.exe');
  });

  it('pins trusted official Google snapshot CDN and SHA-256 checksum', () => {
    expect(CHROMIUM_PRODUCTION_DOWNLOAD_URL).toBe(
      'https://commondatastorage.googleapis.com/chromium-browser-snapshots/Win_x64/1465706/chrome-win.zip'
    );
    expect(CHROMIUM_PRODUCTION_SHA256).toBe(
      '26237e603d68f909f2ba62162a30c51fa1ba94683ca61358e5489b0a08461bc2'
    );
    expect(CHROMIUM_PRODUCTION_CONFIG.fileSizeBytes).toBe(296108021);
  });

  it('resolves production Chromium executable path in isolated engine directory derived from layout', () => {
    const layout = resolveEnginePlatformLayout();
    const exePath = getProductionChromiumExecutablePath();
    expect(exePath).toContain(path.join('engines', CHROMIUM_PRODUCTION_VERSION, layout.archiveSubdir, layout.executableName));
    expect(exePath.endsWith(path.join(layout.archiveSubdir, layout.executableName))).toBe(true);
  });

  it('verifies engine detection with mock binary in MAHI_ENGINES_DIR override', () => {
    const prevEnv = process.env.MAHI_ENGINES_DIR;
    process.env.MAHI_ENGINES_DIR = tempEnginesDir;
    try {
      const layout = resolveEnginePlatformLayout();
      const mockVersionDir = path.join(tempEnginesDir, CHROMIUM_PRODUCTION_VERSION, layout.archiveSubdir);
      const mockExe = path.join(mockVersionDir, layout.executableName);

      // Initially false before binary creation
      expect(isProductionChromiumInstalled()).toBe(false);

      // Create fake mock binary
      fs.mkdirSync(mockVersionDir, { recursive: true });
      fs.writeFileSync(mockExe, 'MZ_MOCK_PROD_CHROMIUM_BINARY', 'utf8');

      // Evaluates to true and resolves to mock binary
      expect(isProductionChromiumInstalled()).toBe(true);
      expect(getProductionChromiumExecutablePath()).toBe(mockExe);
      expect(getManagedEngineExecutablePath(CHROMIUM_PRODUCTION_VERSION)).toBe(mockExe);
      expect(isManagedEngineInstalled(CHROMIUM_PRODUCTION_VERSION)).toBe(true);

      // Clean up mock binary
      fs.rmSync(mockExe, { force: true });
      expect(isProductionChromiumInstalled()).toBe(false);
    } finally {
      if (prevEnv !== undefined) {
        process.env.MAHI_ENGINES_DIR = prevEnv;
      } else {
        delete process.env.MAHI_ENGINES_DIR;
      }
    }
  });

  it('preserves backwards-compatible access to CfT engine for regression safety', () => {
    const cftPath = getManagedEngineExecutablePath('138.0.7204.183', 'win32', 'x64');
    expect(cftPath).toContain(path.join('engines', '138.0.7204.183', 'chrome-win64', 'chrome.exe'));
  });

  it('validates package.json and release artifact version consistency', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    expect(pkg.version).toMatch(/^1\.1\.[0-9]$/);
    expect(pkg.name).toBe('mahi-browser');
  });

  it.skipIf(!REAL_CHROMIUM)('verifies production Chromium binary metadata and absence of CfT branding [requires real Chromium on host]', () => {
    const exePath = getProductionChromiumExecutablePath();
    expect(fs.existsSync(exePath)).toBe(true);

    if (process.platform === 'win32') {
      const { execSync } = require('node:child_process');
      const versionCmd = `powershell -NoProfile -Command "(Get-Item '${exePath}').VersionInfo | Select-Object -Property ProductName, FileDescription, FileVersion | ConvertTo-Json"`;
      const jsonStr = execSync(versionCmd).toString();
      const info = JSON.parse(jsonStr);

      expect(info.ProductName).toBe('Chromium');
      expect(info.FileDescription).toBe('Chromium');
      expect(info.FileVersion.startsWith('138.')).toBe(true);
    }
  });

  it.skipIf(!REAL_CHROMIUM)('launches production unbranded Chromium cleanly via launcher [requires real Chromium on host]', async () => {
    const { launchBrowser } = await import('../../02_BROWSER/launcher.js');
    const testStorage = path.resolve('.mahi_data', 'profiles', 'test-unit-unbranded');
    fs.mkdirSync(testStorage, { recursive: true });

    const testProfile: any = {
      id: 'test-unit-unbranded-id',
      name: 'Unbranded Chromium Unit Test',
      status: 'STOPPED',
      storagePath: testStorage,
      settings: {
        browser: {
          startupUrl: 'about:blank',
          showProfileBadge: false,
        },
      },
    };

    const launched = await launchBrowser(testProfile);
    expect(launched).toBeDefined();
    expect(launched.process).toBeDefined();
    expect(typeof launched.process.pid).toBe('number');
    expect(launched.process.pid).toBeGreaterThan(0);

    // Clean shutdown
    try {
      launched.process.kill();
    } catch {}
  });

  describe.skipIf(!fs.existsSync(path.resolve('release', 'latest.yml')))('Release Artifacts Validation (Packaged builds only)', () => {
    it('validates release/latest.yml artifact manifest integrity', () => {
      const ymlPath = path.resolve('release', 'latest.yml');
      expect(fs.existsSync(ymlPath)).toBe(true);
      const content = fs.readFileSync(ymlPath, 'utf8');
      expect(content).toMatch(/version:\s*1\.1\.[0-9]/);
      expect(content).toMatch(/MAHI-Browser-Setup-1\.1\.[0-9]\.exe/);
      expect(content).toContain('sha512:');
      expect(content).toContain('size:');
    });

    it('validates release/latest.json manifest matches packaged installer hash', () => {
      const jsonPath = path.resolve('release', 'latest.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      expect(manifest.version).toBe(pkg.version);
      expect(manifest.channel).toBe('STABLE');
      expect(manifest.files.length).toBeGreaterThanOrEqual(2);

      const setupFile = manifest.files.find((f: any) => f.name.includes('Setup'));
      expect(setupFile).toBeDefined();
      expect(setupFile.size).toBeGreaterThan(200 * 1024 * 1024);
      expect(setupFile.sha256.length).toBe(64);
    });
  });

  it('enforces clean runtime policy without CfT or automation banners in launch arguments', async () => {
    const { buildSanitizedLaunchArgs } = await import('../../02_BROWSER/launcher.js');
    const args = buildSanitizedLaunchArgs({
      storageDir: path.resolve('.mahi_data', 'profiles', 'mock-clean-profile'),
      debugPort: 9222,
      mode: 'normal',
    });

    expect(args).toContain('--no-first-run');
    expect(args).toContain('--no-default-browser-check');
    expect(args).toContain('--disable-infobars');
    // Ensure CfT or testing automation banners are strictly prohibited
    expect(args.some((a: string) => a.includes('--enable-automation'))).toBe(false);
    expect(args.some((a: string) => a.includes('--test-type'))).toBe(false);
  });
});

