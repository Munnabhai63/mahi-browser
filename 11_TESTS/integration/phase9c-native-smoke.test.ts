import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { platformAdapter } from '../../02_BROWSER/services/platform-adapter.js';
import {
  MANAGED_ENGINE_VERSION,
  MANAGED_ENGINE_PLATFORMS,
  resolveEnginePlatformKey,
} from '../../10_CONFIG/engine-config.js';

describe('PHASE 9C: Native Runtime Verification & Release Gate Harness Suite', () => {
  const rootDir = process.cwd();

  describe('1. Native Packaged Desktop Smoke Test Harness', () => {
    it('should have the smoke test harness script in 12_SCRIPTS', () => {
      const scriptPath = path.join(rootDir, '12_SCRIPTS', 'smoke-test-packaged-app.cjs');
      expect(fs.existsSync(scriptPath)).toBe(true);

      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain('resolveExecutable');
      expect(content).toContain('--smoke-test');
      expect(content).toContain('[SMOKE_TEST_PASS]');
    });

    it('should execute smoke harness cleanly on the active desktop platform', () => {
      const scriptPath = path.join(rootDir, '12_SCRIPTS', 'smoke-test-packaged-app.cjs');
      const output = execSync(`node "${scriptPath}"`, {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 35000,
      });

      expect(output).toContain('NATIVE DESKTOP SMOKE TEST PASSED SUCCESSFULLY');
    });
  });

  describe('2. Managed Chromium Multi-Platform Binary Matrix', () => {
    it('should verify explicit architecture mapping for macOS Apple Silicon and Intel', () => {
      expect(resolveEnginePlatformKey('darwin', 'arm64')).toBe('mac-arm64');
      expect(resolveEnginePlatformKey('darwin', 'x64')).toBe('mac-x64');

      const armConfig = MANAGED_ENGINE_PLATFORMS['mac-arm64'];
      const intelConfig = MANAGED_ENGINE_PLATFORMS['mac-x64'];

      expect(armConfig.downloadUrl).toContain('/mac-arm64/chrome-mac-arm64.zip');
      expect(intelConfig.downloadUrl).toContain('/mac-x64/chrome-mac-x64.zip');
      expect(armConfig.executableRelativePath).toContain('Google Chrome for Testing.app');
      expect(intelConfig.executableRelativePath).toContain('Google Chrome for Testing.app');
    });

    it('should verify Linux x64 binary mapping', () => {
      expect(resolveEnginePlatformKey('linux', 'x64')).toBe('linux64');
      const linuxConfig = MANAGED_ENGINE_PLATFORMS['linux64'];

      expect(linuxConfig.downloadUrl).toContain('/linux64/chrome-linux64.zip');
      expect(linuxConfig.executableRelativePath).toBe('chrome');
    });
  });

  describe('3. Platform Capability & Headless CI Isolation Rules', () => {
    it('should enforce safe default flags without insecure --no-sandbox in production', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      // Ensure start script does not hardcode --no-sandbox
      expect(pkg.scripts['start']).toBe('electron .');
    });

    it('should provide accurate platform capabilities for current environment', () => {
      const caps = platformAdapter.getCapabilities();
      expect(caps.managedEngineSupported).toBe(true);
      expect(caps.adbRotatorSupported).toBe(true);
      expect(caps.cdpSyncSupported).toBe(true);
    });
  });
});
