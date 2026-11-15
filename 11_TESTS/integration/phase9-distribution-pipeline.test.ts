import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getManagedEngineExecutablePath } from '../../02_BROWSER/managed-engine.js';
import { MANAGED_ENGINE_VERSION } from '../../10_CONFIG/engine-config.js';

describe('PHASE 9 INTEGRATION: Multi-Platform Distribution Pipeline & Packaging Gates', () => {
  const rootDir = process.cwd();

  describe('1. Electron Builder Multi-Platform Specification', () => {
    it('should have a valid electron-builder.json with Windows, macOS, and Linux configurations', () => {
      const configPath = path.join(rootDir, 'electron-builder.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);

      // Windows
      expect(config.win).toBeDefined();
      expect(config.win.target).toBeDefined();
      expect(['MAHI-Browser-Setup-${version}.${ext}', '${productName}-${version}-Setup.${ext}']).toContain(config.win.artifactName);

      // macOS
      expect(config.mac).toBeDefined();
      expect(config.mac.category).toBe('public.app-category.developer-tools');
      expect(config.mac.hardenedRuntime).toBe(true);
      expect(config.mac.target).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: 'dmg', arch: expect.arrayContaining(['arm64', 'x64']) }),
          expect.objectContaining({ target: 'zip', arch: expect.arrayContaining(['arm64', 'x64']) }),
        ])
      );
      expect(config.mac.artifactName).toBe('MAHI-Browser-${version}-macOS-${arch}.${ext}');

      // Linux
      expect(config.linux).toBeDefined();
      expect(config.linux.category).toContain('Network;WebBrowser');
      expect(config.linux.target).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: 'AppImage', arch: ['x64'] }),
          expect.objectContaining({ target: 'deb', arch: ['x64'] }),
        ])
      );
      expect(config.linux.artifactName).toBe('MAHI-Browser-${version}-Linux-${arch}.${ext}');
    });

    it('should verify macOS entitlements files exist and have valid plist XML content', () => {
      const configPath = path.join(rootDir, 'electron-builder.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      const entitlementsPath = path.join(rootDir, config.mac.entitlements);
      const inheritPath = path.join(rootDir, config.mac.entitlementsInherit);

      expect(fs.existsSync(entitlementsPath)).toBe(true);
      expect(fs.existsSync(inheritPath)).toBe(true);

      const entitlementsXml = fs.readFileSync(entitlementsPath, 'utf8');
      expect(entitlementsXml).toContain('com.apple.security.cs.allow-jit');
      expect(entitlementsXml).toContain('com.apple.security.cs.allow-unsigned-executable-memory');
      expect(entitlementsXml).toContain('com.apple.security.network.client');
      expect(entitlementsXml).toContain('com.apple.security.network.server');
      expect(entitlementsXml).toContain('<!DOCTYPE plist PUBLIC');

      const inheritXml = fs.readFileSync(inheritPath, 'utf8');
      expect(inheritXml).toContain('com.apple.security.cs.allow-jit');
      expect(inheritXml).toContain('<!DOCTYPE plist PUBLIC');
    });
  });

  describe('2. Package.json Cross-Platform Scripts', () => {
    it('should declare targeted packaging commands in package.json', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkg.scripts['dist']).toBeDefined();
      expect(pkg.scripts['dist:win']).toContain('--win');
      expect(pkg.scripts['dist:mac']).toContain('--mac');
      expect(pkg.scripts['dist:linux']).toContain('--linux');
      expect(pkg.scripts['dist:all']).toBe('npm run build && electron-builder -mwl');
    });
  });

  describe('3. CI/CD GitHub Actions Build Matrix Pipeline', () => {
    it('should have a valid GitHub Actions workflow matrix for Windows, macOS, and Linux', () => {
      const workflowPath = path.join(rootDir, '.github', 'workflows', 'cross-platform-release.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);

      const workflowYaml = fs.readFileSync(workflowPath, 'utf8');
      expect(workflowYaml).toContain('windows-latest');
      expect(workflowYaml).toContain('macos-latest');
      expect(workflowYaml).toContain('ubuntu-latest');

      // Quality Gates
      expect(workflowYaml).toContain('npm run typecheck');
      expect(workflowYaml).toMatch(/npm (run test:ci|test)/);
      expect(workflowYaml).toContain('npm run build');

      // Packaging
      expect(workflowYaml).toContain('npm run dist:${{ matrix.platform }}');

      // Security Check: No raw private keys hardcoded
      expect(workflowYaml).not.toMatch(/BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/);
      expect(workflowYaml).toContain('secrets.APPLE_ID');
      expect(workflowYaml).toContain('secrets.APPLE_APP_SPECIFIC_PASSWORD');
    });
  });

  describe('4. Managed Engine Platform Path Resolution', () => {
    it('should generate platform-appropriate engine executable paths', () => {
      const execPath = getManagedEngineExecutablePath();
      expect(execPath).toContain(MANAGED_ENGINE_VERSION);

      if (process.platform === 'win32') {
        expect(execPath.endsWith('chrome.exe')).toBe(true);
        expect(execPath).toContain('chrome-win64');
      } else if (process.platform === 'darwin') {
        expect(execPath).toContain('Contents/MacOS/Google Chrome for Testing');
      } else {
        expect(execPath.endsWith('chrome')).toBe(true);
        expect(execPath).toContain('chrome-linux64');
      }
    });
  });
});
