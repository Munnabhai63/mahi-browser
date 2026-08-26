import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ensureProfileStealthExtension } from '../../02_BROWSER/launcher.js';

describe('Phase 2: God-Level Stealth & Fingerprint Noise Engine', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-stealth-test-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should generate a valid Manifest V3 stealth extension with MAIN world execution', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-uuid-1', 'Profile 1');
    expect(fs.existsSync(extDir)).toBe(true);

    const manifestPath = path.join(extDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.content_scripts.length).toBeGreaterThanOrEqual(2);

    const stealthScript = manifest.content_scripts.find((cs: any) => cs.js.includes('stealth-core.js'));
    expect(stealthScript).toBeDefined();
    expect(stealthScript.run_at).toBe('document_start');
    expect(stealthScript.world).toBe('MAIN');
  });

  it('should inject deterministic Canvas micro-noise, WebGL spoofing, and Audio jitter in stealth-core.js', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-uuid-2', 'FB-Account-01', {
      browser: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36' },
    });

    const stealthCode = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');

    // 1. Automation removal
    expect(stealthCode).toContain('navigator');
    expect(stealthCode).toContain('webdriver');
    expect(stealthCode).toContain('cdc_');

    // 2. Hardware Concurrency & Memory
    expect(stealthCode).toContain('hardwareConcurrency');
    expect(stealthCode).toContain('deviceMemory');

    // 3. Canvas Noise
    expect(stealthCode).toContain('getImageData');
    expect(stealthCode).toContain('toDataURL');

    // 4. WebGL GPU spoofing
    expect(stealthCode).toContain('UNMASKED_VENDOR_WEBGL');
    expect(stealthCode).toContain('UNMASKED_RENDERER_WEBGL');
    expect(stealthCode).toContain('NVIDIA');

    // 5. AudioContext
    expect(stealthCode).toContain('AudioBuffer');
  });

  it('should adapt GPU renderer target for macOS personas (Apple M-Series)', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-mac-1', 'Mac-Profile', {
      browser: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36' },
    });

    const stealthCode = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');
    expect(stealthCode).toContain('Apple');
  });
});
