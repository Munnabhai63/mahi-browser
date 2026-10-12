import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  buildSanitizedLaunchArgs,
  ensureProfileStealthExtension,
} from '../../02_BROWSER/launcher.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { testProxy } from '../../02_BROWSER/services/proxy-test-service.js';

describe('FORENSIC NETWORK CONNECTIVITY & NO-PROXY CONTRACT SUITE', () => {
  let tempStorageDir: string;

  beforeEach(() => {
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-net-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Direct Profile Launch Arguments Contract', () => {
    it('does not contain --disable-background-networking in production browsing mode', () => {
      const args = buildSanitizedLaunchArgs({
        storageDir: tempStorageDir,
        debugPort: 9222,
        settings: getDefaultProfileSettings(),
        mode: 'normal',
      });

      expect(args).not.toContain('--disable-background-networking');
    });

    it('does not include EnableIPv6 in --disable-features to prevent dual-stack socket stalls', () => {
      const args = buildSanitizedLaunchArgs({
        storageDir: tempStorageDir,
        debugPort: 9222,
        settings: getDefaultProfileSettings(),
        mode: 'normal',
      });

      const disableFeaturesArg = args.find((a) => a.startsWith('--disable-features='));
      expect(disableFeaturesArg).toBeDefined();
      expect(disableFeaturesArg).not.toContain('EnableIPv6');
    });

    it('does not leak cloud worker host-rules (169.254.169.254) into desktop launch arguments', () => {
      const args = buildSanitizedLaunchArgs({
        storageDir: tempStorageDir,
        debugPort: 9222,
        settings: getDefaultProfileSettings(),
        mode: 'normal',
      });

      expect(args.some((a) => a.includes('169.254.169.254'))).toBe(false);
      expect(args.some((a) => a.startsWith('--host-rules'))).toBe(false);
    });

    it('does not force disable_non_proxied_udp for direct profiles without proxy', () => {
      const settings = getDefaultProfileSettings();
      // default profile has webrtc: 'default'
      const args = buildSanitizedLaunchArgs({
        storageDir: tempStorageDir,
        debugPort: 9222,
        settings,
        mode: 'normal',
      });

      expect(args).not.toContain('--webrtc-ip-handling-policy=disable_non_proxied_udp');
    });
  });

  describe('Stealth Extension Content & Integrity Audit', () => {
    it('sets navigator.webdriver to return false (native Chrome contract) instead of undefined', () => {
      const extDir = ensureProfileStealthExtension(tempStorageDir, 'test-p1', 'Test Profile');
      const stealthJs = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');

      expect(stealthJs).toContain('return false;');
      expect(stealthJs).not.toContain('return undefined;');
      expect(stealthJs).not.toContain('delete navigator.__proto__.webdriver');
    });

    it('does not inject inline script tags in content.js avoiding CSP violations', () => {
      const extDir = ensureProfileStealthExtension(tempStorageDir, 'test-p1', 'Test Profile');
      const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');

      expect(contentJs).not.toContain("document.createElement('script')");
    });

    it('does not hijack Enter key search submissions with delayed NAVIGATE replacement', () => {
      const extDir = ensureProfileStealthExtension(tempStorageDir, 'test-p1', 'Test Profile');
      const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');

      // Must not contain the timer that replaced URL with previous location.href
      expect(contentJs).not.toMatch(/sendSyncAction\(['"]NAVIGATE['"],\s*\{\s*url:\s*window\.location\.href\s*\}\)/);
    });

    it('does not make cross-origin fetch requests to localhost:32123 from inside web pages', () => {
      const extDir = ensureProfileStealthExtension(tempStorageDir, 'test-p1', 'Test Profile');
      const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');

      expect(contentJs).not.toContain('fetch(');
    });
  });

  describe('Proxy Validation Matrix', () => {
    it('validates invalid proxy configuration with appropriate error codes', async () => {
      const missingHost = await testProxy({ host: '', port: 8080 });
      expect(missingHost.success).toBe(false);
      expect(missingHost.errorCode).toBe('INVALID_CONFIG');

      const invalidPort = await testProxy({ host: '127.0.0.1', port: 99999 });
      expect(invalidPort.success).toBe(false);
      expect(invalidPort.errorCode).toBe('INVALID_CONFIG');
    });

    it('correctly routes SOCKS5 test requests via SOCKS5 handshake handler', async () => {
      // Testing against a non-listening local port to verify handshake routing and CONNECTION_REFUSED
      const socksResult = await testProxy({
        host: '127.0.0.1',
        port: 19999,
        protocol: 'socks5',
      });
      expect(socksResult.success).toBe(false);
      expect(socksResult.errorCode).toBe('CONNECTION_REFUSED');
    });
  });
});
