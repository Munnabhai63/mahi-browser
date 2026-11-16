import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveEngineManifest, hasNativeStealthEngine } from '../../02_BROWSER/managed-engine.js';
import { runEngineDoctor } from '../../12_SCRIPTS/engine-doctor.js';

describe('Native Engine Manifest Discovery Suite (BUG-02 Regression)', () => {
  it('discovers mahi-engine.json one level above executable and enables native stealth', () => {
    const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-native-test-'));
    try {
      const manifestPath = path.join(tempBase, 'mahi-engine.json');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          engine: 'mahi-chromium',
          version: '138.0.7204.0',
          nativeStealth: true,
          rebrowserPatched: true,
        }),
        'utf8'
      );

      const subDir = path.join(tempBase, 'chrome-win64');
      fs.mkdirSync(subDir, { recursive: true });
      const fakeExe = path.join(subDir, 'chrome.exe');
      fs.writeFileSync(fakeExe, 'MZ_MOCK_BINARY', 'utf8');

      const manifest = resolveEngineManifest(fakeExe);
      expect(manifest).not.toBeNull();
      expect(manifest?.nativeStealth).toBe(true);
      expect(hasNativeStealthEngine(fakeExe)).toBe(true);
    } finally {
      try { fs.rmSync(tempBase, { recursive: true, force: true }); } catch {}
    }
  });

  it('evaluates hasNativeStealthEngine to false on stock build without manifest', () => {
    const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-stock-test-'));
    try {
      const subDir = path.join(tempBase, 'chrome-win');
      fs.mkdirSync(subDir, { recursive: true });
      const fakeExe = path.join(subDir, 'chrome.exe');
      fs.writeFileSync(fakeExe, 'MZ_STOCK_BINARY', 'utf8');

      expect(resolveEngineManifest(fakeExe)).toBeNull();
      expect(hasNativeStealthEngine(fakeExe)).toBe(false);
    } finally {
      try { fs.rmSync(tempBase, { recursive: true, force: true }); } catch {}
    }
  });

  it('discovers adjacent manifest inside ~/.mahi/cores/<name>/', () => {
    const home = os.homedir();
    const coresDir = path.join(home, '.mahi', 'cores', 'test-custom-core');
    let created = false;
    try {
      fs.mkdirSync(coresDir, { recursive: true });
      created = true;
      const manifestPath = path.join(coresDir, 'mahi-engine.json');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          engine: 'mahi-chromium',
          version: '138.0.7204.0',
          nativeStealth: true,
        }),
        'utf8'
      );
      const fakeExe = path.join(coresDir, 'chrome.exe');
      fs.writeFileSync(fakeExe, 'MZ_TEST', 'utf8');

      const manifest = resolveEngineManifest(fakeExe);
      expect(manifest).not.toBeNull();
      expect(manifest?.nativeStealth).toBe(true);
      expect(hasNativeStealthEngine(fakeExe)).toBe(true);
    } finally {
      if (created) {
        try { fs.rmSync(coresDir, { recursive: true, force: true }); } catch {}
      }
    }
  });

  it('runs engine:doctor diagnostics cleanly and reports truthful active stealth layer', () => {
    const report = runEngineDoctor();
    expect(report).toBeDefined();
    expect(typeof report.chromiumPath).toBe('string');
    expect(['native', 'js']).toContain(report.stealthLayer);
    expect(report.searchPaths.length).toBeGreaterThanOrEqual(3);
  });
});
