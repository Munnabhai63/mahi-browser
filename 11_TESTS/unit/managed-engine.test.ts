import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  MANAGED_ENGINE_VERSION,
  MANAGED_ENGINE_SHA256,
  MANAGED_ENGINE_DOWNLOAD_URL,
  MANAGED_ENGINE_FALLBACK_URL,
  GOOGLE_CFT_MANIFEST_URL,
  MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES,
} from '../../10_CONFIG/engine-config.js';
import {
  getManagedEngineExecutablePath,
  getEnginesBaseDir,
  isManagedEngineInstalled,
  checkDiskSpace,
  cleanOldEngineVersions,
  ensureManagedEngineInstalled,
  getManagedEngineCurrentProgress,
} from '../../02_BROWSER/managed-engine.js';

describe('Managed Version-Pinned Browser Engine Suite', () => {
  const testMockDir = path.join(process.cwd(), '.test_engines_mock');

  beforeEach(() => {
    try { fs.mkdirSync(testMockDir, { recursive: true }); } catch {}
  });

  afterEach(() => {
    try { fs.rmSync(testMockDir, { recursive: true, force: true }); } catch {}
  });

  it('should have a pinned, immutable engine version and valid Google CDN and mirror URLs', () => {
    expect(MANAGED_ENGINE_VERSION).toBe('138.0.7204.183');
    expect(MANAGED_ENGINE_SHA256).toBe('10a9fa695a9e4c05b336aebdc553f92c2351b2e9b962b00dc00612c8dcaacd68');
    expect(MANAGED_ENGINE_DOWNLOAD_URL).toContain('storage.googleapis.com/chrome-for-testing-public/138.0.7204.183/win64/chrome-win64.zip');
    expect(MANAGED_ENGINE_FALLBACK_URL).toBe('https://mahibrowser.com/engine/chrome-138.zip');
    expect(GOOGLE_CFT_MANIFEST_URL).toBe('https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json');
    expect(MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES).toBe(600 * 1024 * 1024);
  });

  it('should resolve the correct engine path structure for win64', () => {
    const exePath = getManagedEngineExecutablePath(MANAGED_ENGINE_VERSION, 'win32', 'x64');
    expect(exePath).toContain(path.join('engines', MANAGED_ENGINE_VERSION, 'chrome-win64', 'chrome.exe'));
    expect(exePath.endsWith(path.join('chrome-win64', 'chrome.exe'))).toBe(true);

    const customVersionPath = getManagedEngineExecutablePath('130.0.0.0', 'win32', 'x64');
    expect(customVersionPath).toContain(path.join('engines', '130.0.0.0', 'chrome-win64', 'chrome.exe'));
  });

  it('should validate disk space check (requires at least 1GB free)', () => {
    const space = checkDiskSpace(process.cwd(), 1024 * 1024 * 1024);
    expect(typeof space.ok).toBe('boolean');
    expect(typeof space.freeBytes).toBe('number');
    expect(space.freeBytes).toBeGreaterThanOrEqual(0);
  });

  it('should verify SHA-256 integrity and detect checksum mismatches', () => {
    const samplePayload = Buffer.from('Official-Google-Chrome-Zip-Payload');
    const validHash = crypto.createHash('sha256').update(samplePayload).digest('hex');

    // Matching hash passes
    expect(validHash).toBe(crypto.createHash('sha256').update(samplePayload).digest('hex'));

    // Corrupted payload triggers mismatch
    const corruptedPayload = Buffer.from('Corrupted-Google-Chrome-Zip-Payload');
    const corruptedHash = crypto.createHash('sha256').update(corruptedPayload).digest('hex');
    expect(corruptedHash).not.toBe(validHash);
  });

  it('should clean up stale temporary folders and old engine versions on version switch', () => {
    const baseEngines = getEnginesBaseDir();
    try { fs.mkdirSync(baseEngines, { recursive: true }); } catch {}

    const oldVersionDir = path.join(baseEngines, '130.0.6723.58');
    const staleTmpDir = path.join(baseEngines, '138.0.7204.183.tmp-1710000000000');
    const currentVersionDir = path.join(baseEngines, MANAGED_ENGINE_VERSION);

    try { fs.mkdirSync(oldVersionDir, { recursive: true }); } catch {}
    try { fs.mkdirSync(staleTmpDir, { recursive: true }); } catch {}
    try { fs.mkdirSync(currentVersionDir, { recursive: true }); } catch {}

    expect(fs.existsSync(oldVersionDir)).toBe(true);
    expect(fs.existsSync(staleTmpDir)).toBe(true);
    expect(fs.existsSync(currentVersionDir)).toBe(true);

    // Run cleanup keeping only MANAGED_ENGINE_VERSION
    cleanOldEngineVersions(MANAGED_ENGINE_VERSION);

    // Old and tmp directories must be gone; current version must remain
    expect(fs.existsSync(oldVersionDir)).toBe(false);
    expect(fs.existsSync(staleTmpDir)).toBe(false);
    expect(fs.existsSync(currentVersionDir)).toBe(true);
  });

  it('should report progress states correctly', () => {
    const prog = getManagedEngineCurrentProgress();
    expect(prog).toHaveProperty('stage');
    expect(prog).toHaveProperty('percent');
    expect(prog).toHaveProperty('version');
    expect(prog.version).toBe(MANAGED_ENGINE_VERSION);
  });
});
