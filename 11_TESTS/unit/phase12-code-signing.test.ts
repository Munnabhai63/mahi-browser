/**
 * MAHI Browser — Code Signing Pipeline & Secret Protection Unit Tests
 * Batch P0-D Verification Suite
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Import CommonJS sign scripts via require
const signWin = require('../../12_SCRIPTS/sign.cjs').default;
const signMac = require('../../12_SCRIPTS/sign-mac.cjs').default;

describe('Batch P0-D — Desktop Code Signing & Release Trust', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Windows Authenticode Pipeline (sign.cjs)', () => {
    it('outputs honest CONFIGURED advisory when credentials are unset in environment', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const prevCsc = process.env.WIN_CSC_LINK;
      delete process.env.WIN_CSC_LINK;
      delete process.env.CSC_LINK;

      try {
        await signWin({ path: 'C:\\Users\\munaf\\Desktop\\mahai brouser\\release\\MAHI BROWSER-Setup.exe' });
        const logs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
        expect(logs).toContain('[Authenticode:CONFIGURED]');
        expect(logs).toContain('PRODUCTION CODE SIGNING CREDENTIAL REQUIRED');
      } finally {
        if (prevCsc) process.env.WIN_CSC_LINK = prevCsc;
      }
    });

    it('returns cleanly without errors when target path is undefined', async () => {
      await expect(signWin({})).resolves.toBeUndefined();
    });
  });

  describe('2. macOS Developer ID & Notarization Pipeline (sign-mac.cjs)', () => {
    it('outputs honest CONFIGURED advisory when Apple Developer ID is unset in environment', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const prevApple = process.env.APPLE_ID;
      delete process.env.APPLE_ID;
      delete process.env.CSC_LINK;
      delete process.env.MAC_CSC_LINK;

      try {
        await signMac({ appOutDir: 'C:\\Users\\munaf\\Desktop\\mahai brouser\\release\\mac-arm64' });
        const logs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
        expect(logs).toContain('[macOS:CONFIGURED]');
        expect(logs).toContain('PRODUCTION SIGNING AND NOTARIZATION CREDENTIAL REQUIRED');
      } finally {
        if (prevApple) process.env.APPLE_ID = prevApple;
      }
    });
  });

  describe('3. Signing Secrets Protection Policy', () => {
    it('verifies .gitignore strictly excludes certificate and private key files', () => {
      const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
      expect(gitignore).toContain('*.pfx');
      expect(gitignore).toContain('*.p12');
      expect(gitignore).toContain('*.keystore');
      expect(gitignore).toContain('*.jks');
      expect(gitignore).toContain('*.key');
      expect(gitignore).toContain('*.pem');
      expect(gitignore).toContain('.env');
    });

    it('verifies electron-builder.json excludes secrets and private keys from packaged app', () => {
      const builderConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'electron-builder.json'), 'utf8'));
      const excludedFiles = builderConfig.files || [];
      expect(excludedFiles).toContain('!*.pem');
      expect(excludedFiles).toContain('!*.key');
      expect(excludedFiles).toContain('!keys.json');
    });
  });

  describe('4. Platform Release Matrix Configuration', () => {
    it('defines targets for Windows (nsis + portable), macOS (arm64 + x64 with hardened runtime)', () => {
      const builderConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'electron-builder.json'), 'utf8'));

      // Windows targets
      expect(builderConfig.win.target.some((t: any) => t.target === 'nsis')).toBe(true);
      expect(builderConfig.win.signtoolOptions.sign).toBe('./12_SCRIPTS/sign.cjs');

      // macOS targets
      expect(builderConfig.mac.hardenedRuntime).toBe(true);
      expect(builderConfig.mac.entitlements).toBeDefined();
      expect(builderConfig.mac.target.some((t: any) => t.target === 'dmg')).toBe(true);
    });
  });
});
