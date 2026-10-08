import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { platformAdapter, PlatformAdapter } from '../../02_BROWSER/services/platform-adapter.js';
import {
  MANAGED_ENGINE_VERSION,
  MANAGED_ENGINE_PLATFORMS,
  resolveEnginePlatformKey,
  getPlatformEngineConfig,
} from '../../10_CONFIG/engine-config.js';
import { validateUpdateManifest } from '../../07_BACKEND/services/updater-validator.js';

describe('PHASE 9: Cross-Platform Abstraction & Platform Adapter Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase9-test-'));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('1. Platform & Architecture Detection', () => {
    it('should detect valid OS and architecture from host environment', () => {
      const platform = platformAdapter.getPlatform();
      const arch = platformAdapter.getArch();

      expect(['win32', 'darwin', 'linux']).toContain(platform);
      expect(['x64', 'arm64', 'ia32']).toContain(arch);
    });

    it('should correctly evaluate platform boolean flags', () => {
      const isWin = platformAdapter.isWindows();
      const isMac = platformAdapter.isMac();
      const isLinux = platformAdapter.isLinux();

      // Exactly one must be true on supported OS
      const trueCount = [isWin, isMac, isLinux].filter(Boolean).length;
      expect(trueCount).toBe(1);
    });

    it('should detect Apple Silicon only when darwin and arm64', () => {
      const isApple = platformAdapter.isAppleSilicon();
      if (process.platform === 'darwin' && process.arch === 'arm64') {
        expect(isApple).toBe(true);
      } else {
        expect(isApple).toBe(false);
      }
    });
  });

  describe('2. Cross-Platform Storage Directories', () => {
    it('should generate standard Windows AppData directory path', () => {
      const dir = platformAdapter.getAppDataDir('win32');
      expect(dir).toContain('mahi-browser');
      expect(dir).toMatch(/AppData[\\/]Roaming[\\/]mahi-browser/i);
    });

    it('should generate standard macOS Application Support path', () => {
      const dir = platformAdapter.getAppDataDir('darwin');
      expect(dir).toContain(path.join('Library', 'Application Support', 'mahi-browser'));
    });

    it('should generate standard Linux .config directory path', () => {
      const dir = platformAdapter.getAppDataDir('linux');
      expect(dir).toContain(path.join('.config', 'mahi-browser'));
    });

    it('should append profiles subdirectory correctly for all platforms', () => {
      const winProfiles = platformAdapter.getProfileStorageBaseDir('win32');
      const macProfiles = platformAdapter.getProfileStorageBaseDir('darwin');
      const linuxProfiles = platformAdapter.getProfileStorageBaseDir('linux');

      expect(winProfiles.endsWith(path.join('mahi-browser', 'profiles'))).toBe(true);
      expect(macProfiles.endsWith(path.join('mahi-browser', 'profiles'))).toBe(true);
      expect(linuxProfiles.endsWith(path.join('mahi-browser', 'profiles'))).toBe(true);
    });
  });

  describe('3. System Browser Discovery across Platforms', () => {
    it('should return Windows browser candidate paths', () => {
      const winCandidates = platformAdapter.getSystemBrowserCandidates('win32');
      expect(winCandidates.length).toBeGreaterThanOrEqual(4);
      expect(winCandidates.some((c) => c.name.includes('Chrome') && c.path.endsWith('chrome.exe'))).toBe(true);
      expect(winCandidates.some((c) => c.name.includes('Edge') && c.path.endsWith('msedge.exe'))).toBe(true);
      expect(winCandidates.some((c) => c.name.includes('Brave') && c.path.endsWith('brave.exe'))).toBe(true);
    });

    it('should return macOS browser app bundle candidate paths', () => {
      const macCandidates = platformAdapter.getSystemBrowserCandidates('darwin');
      expect(macCandidates.length).toBeGreaterThanOrEqual(3);
      expect(macCandidates.some((c) => c.name.includes('Chrome') && c.path.includes('.app/Contents/MacOS'))).toBe(true);
      expect(macCandidates.some((c) => c.name.includes('Edge') && c.path.includes('.app/Contents/MacOS'))).toBe(true);
      expect(macCandidates.some((c) => c.name.includes('Brave') && c.path.includes('.app/Contents/MacOS'))).toBe(true);
    });

    it('should return Linux candidate paths in /usr/bin and /snap/bin', () => {
      const linuxCandidates = platformAdapter.getSystemBrowserCandidates('linux');
      expect(linuxCandidates.length).toBeGreaterThanOrEqual(4);
      expect(linuxCandidates.some((c) => c.path === '/usr/bin/google-chrome')).toBe(true);
      expect(linuxCandidates.some((c) => c.path === '/usr/bin/chromium-browser')).toBe(true);
      expect(linuxCandidates.some((c) => c.path === '/snap/bin/chromium')).toBe(true);
      expect(linuxCandidates.some((c) => c.path === '/usr/bin/brave-browser')).toBe(true);
    });
  });

  describe('4. Platform Capability Matrix', () => {
    it('should return accurate capability configurations per platform', () => {
      const caps = platformAdapter.getCapabilities();

      expect(caps.platform).toBe(process.platform);
      expect(caps.arch).toBe(process.arch);
      expect(typeof caps.managedEngineSupported).toBe('boolean');
      expect(caps.managedEngineSupported).toBe(true);
      expect(caps.cdpSyncSupported).toBe(true);
      expect(caps.adbRotatorSupported).toBe(true);

      if (caps.platform === 'win32') {
        expect(caps.secureStorageType).toBe('DPAPI');
        expect(caps.shortcutType).toBe('LNK');
        expect(caps.processKillStrategy).toBe('TASKKILL');
      } else if (caps.platform === 'darwin') {
        expect(caps.secureStorageType).toBe('KEYCHAIN');
        expect(caps.shortcutType).toBe('COMMAND');
        expect(caps.processKillStrategy).toBe('POSIX_PROCESS_GROUP');
      } else {
        expect(caps.secureStorageType).toBe('SECRET_SERVICE_OR_AESGCM');
        expect(caps.shortcutType).toBe('DESKTOP');
        expect(caps.processKillStrategy).toBe('POSIX_PROCESS_GROUP');
      }
    });
  });

  describe('5. Managed Chromium Cross-Platform Engine Configuration', () => {
    it('should resolve correct platform keys', () => {
      expect(resolveEnginePlatformKey('win32', 'x64')).toBe('win64');
      expect(resolveEnginePlatformKey('darwin', 'arm64')).toBe('mac-arm64');
      expect(resolveEnginePlatformKey('darwin', 'x64')).toBe('mac-x64');
      expect(resolveEnginePlatformKey('linux', 'x64')).toBe('linux64');
    });

    it('should target the exact same pinned Chromium version across all platforms', () => {
      const keys = ['win64', 'mac-arm64', 'mac-x64', 'linux64'] as const;
      for (const k of keys) {
        const config = MANAGED_ENGINE_PLATFORMS[k];
        expect(config.downloadUrl).toContain(`/${MANAGED_ENGINE_VERSION}/`);
        expect(config.platformKey).toBe(k);
      }
    });

    it('should have platform-specific executable paths in engine config', () => {
      expect(MANAGED_ENGINE_PLATFORMS.win64.executableRelativePath).toBe('chrome.exe');
      expect(MANAGED_ENGINE_PLATFORMS['mac-arm64'].executableRelativePath).toContain('Contents/MacOS/Google Chrome for Testing');
      expect(MANAGED_ENGINE_PLATFORMS['mac-x64'].executableRelativePath).toContain('Contents/MacOS/Google Chrome for Testing');
      expect(MANAGED_ENGINE_PLATFORMS.linux64.executableRelativePath).toBe('chrome');
    });

    it('should return matching platform engine configuration for current host', () => {
      const cfg = getPlatformEngineConfig();
      expect(cfg).toBeDefined();
      expect(cfg.downloadUrl).toContain('chrome');
      expect(cfg.archiveSubdir).toBeTruthy();
    });
  });

  describe('6. Cross-OS Profile Portability Policy & Emulation', () => {
    it('should classify Windows user-agent profile as Win32 platform', () => {
      const policy = platformAdapter.resolveCrossOsProfilePolicy({
        settings: {
          browser: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          },
        } as any,
      });

      expect(policy.policy).toBe('EMULATED_PORTABLE');
      expect(policy.profilePlatform).toBe('win32');
      expect(policy.emulatedNavigatorPlatform).toBe('Win32');
      expect(policy.emulatedGpuVendor).toContain('NVIDIA');
    });

    it('should classify macOS user-agent profile as MacIntel platform and Apple GPU', () => {
      const policy = platformAdapter.resolveCrossOsProfilePolicy({
        settings: {
          browser: {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          },
        } as any,
      });

      expect(policy.policy).toBe('EMULATED_PORTABLE');
      expect(policy.profilePlatform).toBe('darwin');
      expect(policy.emulatedNavigatorPlatform).toBe('MacIntel');
      expect(policy.emulatedGpuVendor).toContain('Apple');
      expect(policy.emulatedGpuRenderer).toContain('Apple M3 Pro');
    });

    it('should classify Linux user-agent profile as Linux x86_64 platform and Mesa GPU', () => {
      const policy = platformAdapter.resolveCrossOsProfilePolicy({
        settings: {
          browser: {
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          },
        } as any,
      });

      expect(policy.policy).toBe('EMULATED_PORTABLE');
      expect(policy.profilePlatform).toBe('linux');
      expect(policy.emulatedNavigatorPlatform).toBe('Linux x86_64');
      expect(policy.emulatedGpuVendor).toContain('Mesa');
    });
  });

  describe('7. Cross-Platform Desktop Shortcuts', () => {
    it('should write a valid Linux .desktop entry shortcut file', () => {
      const shortcutPath = path.join(tempDir, 'mahi-test-profile.desktop');
      const content = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=MAHI — Alpha Trader',
        'Exec="/usr/bin/mahi-browser" --profile-id=test-123',
        'Icon=/usr/share/pixmaps/mahi-browser.png',
        'Terminal=false',
        'Categories=Network;WebBrowser;',
      ].join('\n');

      fs.writeFileSync(shortcutPath, content, { encoding: 'utf8', mode: 0o755 });

      const read = fs.readFileSync(shortcutPath, 'utf8');
      expect(read).toContain('[Desktop Entry]');
      expect(read).toContain('Exec="/usr/bin/mahi-browser" --profile-id=test-123');
      expect(read).toContain('Type=Application');
    });

    it('should write a valid macOS .command launch script file', () => {
      const scriptPath = path.join(tempDir, 'MAHI - Alpha Trader.command');
      const scriptContent = `#!/bin/bash\n"/Applications/MAHI Browser.app/Contents/MacOS/MAHI Browser" --profile-id=test-123 &\nexit 0\n`;

      fs.writeFileSync(scriptPath, scriptContent, { encoding: 'utf8', mode: 0o755 });

      const read = fs.readFileSync(scriptPath, 'utf8');
      expect(read).toContain('#!/bin/bash');
      expect(read).toContain('--profile-id=test-123');
    });
  });

  describe('8. Updater Cross-Platform Integrity & Target Platform Isolation', () => {
    it('should reject update manifest targeting a different platform', () => {
      const otherPlatform = process.platform === 'win32' ? 'darwin' : 'win32';
      const manifest = {
        version: '2.0.0',
        releaseDate: new Date().toISOString(),
        channel: 'STABLE',
        targetPlatform: otherPlatform,
        files: [
          {
            url: `https://download.mahibrowser.com/releases/MAHI-Browser-2.0.0-${otherPlatform}-x64.pkg`,
            sha256: 'a'.repeat(64),
            size: 104857600,
          },
        ],
      };

      const result = validateUpdateManifest(manifest, '1.1.1', 'STABLE');
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`Update target platform "${otherPlatform}" does not match host platform`);
    });

    it('should accept update manifest matching host platform or without explicit targetPlatform', () => {
      const manifest = {
        version: '2.0.0',
        releaseDate: new Date().toISOString(),
        channel: 'STABLE',
        targetPlatform: process.platform,
        files: [
          {
            url: `https://download.mahibrowser.com/releases/MAHI-Browser-2.0.0.exe`,
            sha256: 'b'.repeat(64),
            size: 104857600,
            platform: process.platform,
            format: 'NSIS',
            signatureStatus: 'CONFIGURED',
          },
        ],
      };

      const result = validateUpdateManifest(manifest, '1.1.1', 'STABLE');
      expect(result.valid).toBe(true);
      expect(result.validatedManifest?.files[0].platform).toBe(process.platform);
    });
  });
});
