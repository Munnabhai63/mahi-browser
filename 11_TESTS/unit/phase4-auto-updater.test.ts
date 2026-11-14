import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {
  validateSemVer,
  compareSemVer,
  isDowngradeOrSame,
  isValidTransition,
  validateUpdateManifest,
  calculateFileHash,
  verifyFileIntegrity,
} from '../../07_BACKEND/services/updater-validator.js';
import {
  loadUpdateConfig,
  saveUpdateConfig,
  checkForAppUpdates,
  startDownloadUpdate,
  applyAndRestartUpdate,
  getAppUpdateStatus,
  getUpdateConfig,
  setUpdateConfig,
  resetUpdaterStateForTesting,
  getSafeAppVersion,
} from '../../07_BACKEND/services/updater-service.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import {
  MockUpdateProvider,
  setActiveUpdateProvider,
  getActiveUpdateProvider,
  GenericHttpUpdateProvider,
} from '../../07_BACKEND/services/updater-provider.js';
import { processManager } from '../../02_BROWSER/process-manager.js';

describe('PHASE 4 UNIT: Production Auto-Updater, Semver, Integrity & Safety', () => {
  let tempDir: string;
  let mockProvider: MockUpdateProvider;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase4-unit-'));
    mockProvider = new MockUpdateProvider();
    setActiveUpdateProvider(mockProvider);
    resetUpdaterStateForTesting();
  });

  afterEach(() => {
    setActiveUpdateProvider(new GenericHttpUpdateProvider());
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // --------------------------------------------------------------------------
  // 1. SEMANTIC VERSIONING & DOWNGRADE PROTECTION (STEP 5)
  // --------------------------------------------------------------------------
  describe('Semantic Versioning & Downgrade Blocking', () => {
    it('should validate valid semantic versions and reject malformed ones', () => {
      expect(validateSemVer('1.1.1')).toBe(true);
      expect(validateSemVer('v1.2.0')).toBe(true);
      expect(validateSemVer('2.0.0-beta.1')).toBe(true);
      expect(validateSemVer('0.9.5-alpha')).toBe(true);

      expect(validateSemVer('')).toBe(false);
      expect(validateSemVer('1.1')).toBe(false);
      expect(validateSemVer('latest')).toBe(false);
      expect(validateSemVer('v1.1.x')).toBe(false);
      expect(validateSemVer('../etc/passwd')).toBe(false);
    });

    it('should compare semantic versions with correct precedence', () => {
      expect(compareSemVer('1.2.0', '1.1.1')).toBe(1);
      expect(compareSemVer('1.1.1', '1.2.0')).toBe(-1);
      expect(compareSemVer('1.1.1', '1.1.1')).toBe(0);
      expect(compareSemVer('2.0.0', '1.9.9')).toBe(1);
      expect(compareSemVer('1.2.0', '1.2.0-beta.1')).toBe(1); // Normal release > prerelease
      expect(compareSemVer('1.2.0-beta.1', '1.2.0')).toBe(-1);
    });

    it('should block downgrade attempts and duplicate versions', () => {
      expect(isDowngradeOrSame('1.1.0', '1.1.1')).toBe(true);
      expect(isDowngradeOrSame('1.1.1', '1.1.1')).toBe(true);
      expect(isDowngradeOrSame('1.0.9', '1.1.1')).toBe(true);
      expect(isDowngradeOrSame('1.2.0', '1.1.1')).toBe(false); // Upgrade allowed
    });
  });

  // --------------------------------------------------------------------------
  // 2. STATE TRANSITIONS & LIFECYCLE (STEP 3 & 10)
  // --------------------------------------------------------------------------
  describe('State Transitions & Lifecycle Rules', () => {
    it('should enforce legitimate state transitions in updater lifecycle', () => {
      expect(isValidTransition('IDLE', 'CHECKING')).toBe(true);
      expect(isValidTransition('CHECKING', 'AVAILABLE')).toBe(true);
      expect(isValidTransition('CHECKING', 'NOT_AVAILABLE')).toBe(true);
      expect(isValidTransition('AVAILABLE', 'DOWNLOADING')).toBe(true);
      expect(isValidTransition('DOWNLOADING', 'DOWNLOADED')).toBe(true);
      expect(isValidTransition('DOWNLOADED', 'INSTALLING')).toBe(true);

      // Illegal transitions
      expect(isValidTransition('IDLE', 'DOWNLOADED')).toBe(false);
      expect(isValidTransition('DOWNLOADING', 'AVAILABLE')).toBe(false);
      expect(isValidTransition('NOT_AVAILABLE', 'DOWNLOADING')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. MANIFEST VALIDATION & CHANNEL FILTERING (STEP 4 & 8)
  // --------------------------------------------------------------------------
  describe('Manifest Validation & Release Channel Isolation', () => {
    it('should validate a complete, authentic production manifest', () => {
      const manifest = {
        version: '1.2.0',
        releaseDate: '2026-10-08T00:00:00Z',
        channel: 'STABLE',
        releaseNotes: 'Security fixes and workspace enhancements.',
        files: [
          {
            url: 'https://mahibrowser.com/update/MAHI-1.2.0-Setup.exe',
            name: 'MAHI-1.2.0-Setup.exe',
            size: 94371840,
            sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            arch: 'x64',
          },
        ],
      };

      const res = validateUpdateManifest(manifest, '1.1.1', 'STABLE');
      expect(res.valid).toBe(true);
      expect(res.validatedManifest).toBeDefined();
      expect(res.validatedManifest?.version).toBe('1.2.0');
    });

    it('should reject downgrade manifest where version is <= current version', () => {
      const manifest = {
        version: '1.1.0',
        channel: 'STABLE',
        files: [{ url: 'http://test/setup.exe', size: 1000, sha256: 'abc' }],
      };

      const res = validateUpdateManifest(manifest, '1.1.1', 'STABLE');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Downgrade or duplicate version blocked/);
    });

    it('should block Beta manifest for users configured on STABLE channel', () => {
      const betaManifest = {
        version: '1.3.0-beta.1',
        channel: 'BETA',
        files: [{ url: 'http://test/setup.exe', size: 1000, sha256: 'abc' }],
      };

      // User on STABLE -> Rejected
      const resStable = validateUpdateManifest(betaManifest, '1.1.1', 'STABLE');
      expect(resStable.valid).toBe(false);
      expect(resStable.error).toMatch(/Prerelease\/Beta update blocked/);

      // User on BETA -> Allowed
      const resBeta = validateUpdateManifest(betaManifest, '1.1.1', 'BETA');
      expect(resBeta.valid).toBe(true);
    });

    it('should reject manifest with empty or missing release files/checksums', () => {
      const invalidManifest1 = { version: '1.2.0', files: [] };
      expect(validateUpdateManifest(invalidManifest1, '1.1.1', 'STABLE').valid).toBe(false);

      const invalidManifest2 = {
        version: '1.2.0',
        files: [{ url: 'http://test/file.exe', size: 0 }],
      };
      expect(validateUpdateManifest(invalidManifest2, '1.1.1', 'STABLE').valid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. CRYPTOGRAPHIC CHECKSUM & INTEGRITY VERIFICATION (STEP 9)
  // --------------------------------------------------------------------------
  describe('Cryptographic Checksum & Tamper Detection', () => {
    it('should accurately calculate SHA-256 and SHA-512 hashes and verify integrity', async () => {
      const sampleFile = path.join(tempDir, 'sample_binary.exe');
      const testData = Buffer.from('MAHI_BROWSER_AUTHENTIC_SIGNED_PAYLOAD_TEST_DATA');
      fs.writeFileSync(sampleFile, testData);

      const expectedSha256 = crypto.createHash('sha256').update(testData).digest('hex');
      const expectedSha512 = crypto.createHash('sha512').update(testData).digest('hex');

      // Hash calculation
      const calculatedSha256 = await calculateFileHash(sampleFile, 'sha256');
      expect(calculatedSha256).toBe(expectedSha256);

      const calculatedSha512 = await calculateFileHash(sampleFile, 'sha512');
      expect(calculatedSha512).toBe(expectedSha512);

      // Integrity verification
      const verify256 = await verifyFileIntegrity(sampleFile, expectedSha256, 'sha256', testData.length);
      expect(verify256.verified).toBe(true);

      const verify512 = await verifyFileIntegrity(sampleFile, expectedSha512, 'sha512', testData.length);
      expect(verify512.verified).toBe(true);
    });

    it('should reject tampered or corrupted binary with checksum mismatch', async () => {
      const tamperedFile = path.join(tempDir, 'tampered_binary.exe');
      fs.writeFileSync(tamperedFile, Buffer.from('TAMPERED_MALICIOUS_PAYLOAD'));

      const legitimateSha256 = crypto.createHash('sha256').update('ORIGINAL_PAYLOAD').digest('hex');

      const result = await verifyFileIntegrity(tamperedFile, legitimateSha256, 'sha256');
      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/Cryptographic integrity verification failed/);
    });
  });

  // --------------------------------------------------------------------------
  // 5. PROFILE SAFETY & ACTIVE PROCESS GUARDS (STEP 16 & 17)
  // --------------------------------------------------------------------------
  describe('Profile Safety Before Restart', () => {
    it('should allow clean restart when no browser profiles are active', async () => {
      // No profiles running
      const res = await applyAndRestartUpdate();
      expect(res.success).toBe(true);
    });

    it('should block restart and alert when active browser profiles are detected', async () => {
      // Mock active profile in processManager
      const fakeProcess = { pid: 99999, kill: () => {} } as any;
      (processManager as any).activeProcesses.set('mock-profile-id', {
        process: fakeProcess,
        pid: 99999,
        profileId: 'mock-profile-id',
        profileName: 'Work E-Commerce (Active)',
        storageDir: '/fake/dir',
        launchedAt: Date.now(),
      });

      try {
        // Normal restart attempt -> DEFERRED / BLOCKED
        const res = await applyAndRestartUpdate({ force: false });
        expect(res.success).toBe(false);
        expect(res.reason).toBe('PROFILES_ACTIVE');
        expect(res.activeProfiles).toContain('Work E-Commerce (Active)');
        expect(res.error).toMatch(/Cannot update while 1 browser profile/);

        // Explicit force restart -> ALLOWED
        const forceRes = await applyAndRestartUpdate({ force: true });
        expect(forceRes.success).toBe(true);
      } finally {
        // Clean up mock profile
        (processManager as any).activeProcesses.delete('mock-profile-id');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. OFFLINE RESILIENCE & CONFIGURATION (STEP 13 & 28)
  // --------------------------------------------------------------------------
  describe('Offline Resilience & Configuration Preferences', () => {
    it('should handle offline update server gracefully without crashing', async () => {
      mockProvider.setManifest(null);

      const status = await checkForAppUpdates(true);
      expect(status.state).toBe('NOT_AVAILABLE');
    });

    it('should get and set user update preferences correctly', () => {
      const initial = getUpdateConfig();
      expect(initial.channel).toBeDefined();

      const updated = setUpdateConfig({
        channel: 'BETA',
        autoDownload: false,
        notifyBeforeRestart: true,
      });

      expect(updated.channel).toBe('BETA');
      expect(updated.autoDownload).toBe(false);

      setUpdateConfig({ channel: 'STABLE', autoDownload: true });
    });

    it('should reject non-existent file or size mismatch in integrity checker', async () => {
      const nonExistent = path.join(tempDir, 'does_not_exist.exe');
      const resMissing = await verifyFileIntegrity(nonExistent, 'abc123hash', 'sha256');
      expect(resMissing.verified).toBe(false);
      expect(resMissing.error).toBe('File does not exist');

      const realFile = path.join(tempDir, 'real.bin');
      fs.writeFileSync(realFile, Buffer.from('hello'));
      const resSize = await verifyFileIntegrity(realFile, 'dummy', 'sha256', 9999);
      expect(resSize.verified).toBe(false);
      expect(resSize.error).toMatch(/File size mismatch/);
    });

    it('should return safe default configuration when config file is absent', () => {
      const config = loadUpdateConfig();
      expect(config.channel).toBe('STABLE');
      expect(config.autoCheck).toBe(true);
      expect(config.autoDownload).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. TASK 7: SINGLE VERSION SOURCE & STRUCTURED ERROR HANDLING
  // --------------------------------------------------------------------------
  describe('Task 7: Single Version Source & Structured Provider Error Handling', () => {
    it('should inject dynamic application version matching package.json and version config', () => {
      const currentVer = getSafeAppVersion();
      expect(currentVer).toBe(APP_VERSION);
      expect(currentVer).toMatch(/^1\.[0-9]+\.[0-9]+/);
    });

    it('should transition to ERROR state when update provider throws network or HTTP error', async () => {
      const failingProvider = {
        name: 'FailingProvider',
        fetchManifest: async () => {
          throw new Error('Failed to fetch update manifest: HTTP 500');
        },
        downloadFile: async () => {
          throw new Error('Download failed');
        },
      };

      setActiveUpdateProvider(failingProvider);

      const status = await checkForAppUpdates(true);
      expect(status.state).toBe('ERROR');
      expect(status.error).toContain('HTTP 500');
    });

    it('GenericHttpUpdateProvider should throw on non-200 responses or invalid JSON rather than silently returning null', async () => {
      const httpProvider = new GenericHttpUpdateProvider();

      // Test with an invalid feed URL that returns connection error
      await expect(httpProvider.fetchManifest('STABLE', 'http://127.0.0.1:1/nonexistent/')).rejects.toThrow();
    });
  });
});
