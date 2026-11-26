import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  cleanOldEngineVersions,
  hasNativeStealthEngine,
  resolveEngineManifest,
} from '../../02_BROWSER/managed-engine.js';
import { PINNED_CAMOUFOX_VERSION, getPinnedCamoufoxRelease } from '../../02_BROWSER/services/engine-download-service.js';
import { initSqlEngine, setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { generateConsistentEnvironmentSettings } from '../../10_CONFIG/shared/constants/defaults.js';

const require = createRequire(import.meta.url);
const { applyEngineVersionToConfig } = require('../../12_SCRIPTS/engine-bump.cjs');

describe('Layer 3: Engine Version Bump, Safe Cleanup & Strict Native Patch Loader', () => {
  const tempDirs: string[] = [];
  const prevEnginesEnv = process.env.MAHI_ENGINES_DIR;

  afterEach(() => {
    if (prevEnginesEnv === undefined) delete process.env.MAHI_ENGINES_DIR;
    else process.env.MAHI_ENGINES_DIR = prevEnginesEnv;

    closeDatabase();
    while (tempDirs.length > 0) {
      const d = tempDirs.pop()!;
      try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
    }
  });

  it('Task 3.1: engine-bump helper cleanly rewrites version, fallback mirror names, and SHA256 without corrupting config', () => {
    const sample = fs.readFileSync(path.resolve('10_CONFIG', 'engine-config.ts'), 'utf8');
    const { next } = applyEngineVersionToConfig(sample, '159.0.8200.10', 'deadbeef'.repeat(8));
    expect(next).toContain("export const MANAGED_ENGINE_VERSION = '159.0.8200.10';");
    expect(next).toContain("export const LEGACY_CFT_VERSION = '159.0.8200.10';");
    expect(next).toContain('chrome-159.zip');
    expect(next).toContain('deadbeef'.repeat(8));
  });

  it('Task 3.1: cleanOldEngineVersions protects versions referenced by active profiles and preserves the 2 newest dirs', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer3-clean-'));
    tempDirs.push(tmp);
    const enginesDir = path.join(tmp, 'engines');
    process.env.MAHI_ENGINES_DIR = enginesDir;

    setCustomDatabasePath(path.join(tmp, 'test.sqlite'));
    await initSqlEngine();
    await initializeDatabase();

    const refSettings = generateConsistentEnvironmentSettings({ os: 'windows', seed: 'ref-v120' });
    refSettings.browser.version = '120.0.6099.10';
    createProfile({ name: 'LegacyPinned120', settings: refSettings });

    for (const dirName of [
      '120.0.6099.10', // referenced by profile -> MUST survive
      '125.0.6422.14', // unreferenced oldest -> deleted
      '140.0.7300.10', // 2nd newest -> MUST survive
      '158.0.8127.88', // newest -> MUST survive
      '158.0.8127.88.tmp-999', // orphaned tmp -> deleted
    ]) {
      fs.mkdirSync(path.join(enginesDir, dirName), { recursive: true });
    }

    cleanOldEngineVersions('158.0.8127.88');

    expect(fs.existsSync(path.join(enginesDir, '120.0.6099.10'))).toBe(true);
    expect(fs.existsSync(path.join(enginesDir, '125.0.6422.14'))).toBe(false);
    expect(fs.existsSync(path.join(enginesDir, '140.0.7300.10'))).toBe(true);
    expect(fs.existsSync(path.join(enginesDir, '158.0.8127.88'))).toBe(true);
    expect(fs.existsSync(path.join(enginesDir, '158.0.8127.88.tmp-999'))).toBe(false);
  });

  it('Task 3.2: hasNativeStealthEngine strictly validates executablePath, chromiumVersion, and non-empty capabilities', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer3-manifest-'));
    tempDirs.push(tmp);

    const engDir = path.join(tmp, 'engines', '158.0.8127.88', 'chrome-win64');
    fs.mkdirSync(engDir, { recursive: true });
    const realExe = path.join(engDir, 'chrome.exe');
    fs.writeFileSync(realExe, 'MZ');

    // Mismatched executablePath must be rejected
    fs.writeFileSync(
      path.join(engDir, 'mahi-engine.json'),
      JSON.stringify({
        engine: 'mahi-chromium',
        nativeStealth: true,
        executablePath: path.join(engDir, 'other-binary.exe'),
        capabilities: { canvas: true },
      })
    );
    expect(hasNativeStealthEngine(realExe)).toBe(false);

    // Mismatched chromiumVersion must be rejected
    fs.writeFileSync(
      path.join(engDir, 'mahi-engine.json'),
      JSON.stringify({
        engine: 'mahi-chromium',
        nativeStealth: true,
        chromiumVersion: '138.0.7204.0',
        capabilities: { canvas: true },
      })
    );
    expect(hasNativeStealthEngine(realExe)).toBe(false);

    // Empty capabilities map must be rejected
    fs.writeFileSync(
      path.join(engDir, 'mahi-engine.json'),
      JSON.stringify({
        engine: 'mahi-chromium',
        nativeStealth: true,
        chromiumVersion: '158.0.8127.88',
        capabilities: { canvas: false, webgl: false },
      })
    );
    expect(hasNativeStealthEngine(realExe)).toBe(false);

    // Exact match passes
    fs.writeFileSync(
      path.join(engDir, 'mahi-engine.json'),
      JSON.stringify({
        engine: 'mahi-chromium',
        nativeStealth: true,
        chromiumVersion: '158.0.8127.88',
        executablePath: 'chrome.exe',
        capabilities: { canvas: true, webrtc: true },
      })
    );
    expect(resolveEngineManifest(realExe)).not.toBeNull();
    expect(hasNativeStealthEngine(realExe)).toBe(true);
  });

  it('Task 3.2: Camoufox pinned version uses updated release and matches dynamic asset URL', () => {
    expect(PINNED_CAMOUFOX_VERSION).not.toBe('v135.0.1-beta.24');
    const pinned = getPinnedCamoufoxRelease();
    expect(pinned.downloadUrl).toContain(PINNED_CAMOUFOX_VERSION);
    expect(pinned.assetName).toContain(PINNED_CAMOUFOX_VERSION.replace(/^v/, ''));
  });
});
