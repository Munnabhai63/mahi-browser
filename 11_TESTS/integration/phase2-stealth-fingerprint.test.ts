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

    // 3. Canvas Noise & toBlob coverage
    expect(stealthCode).toContain('getImageData');
    expect(stealthCode).toContain('toDataURL');
    expect(stealthCode).toContain('toBlob');

    // 4. WebGL GPU spoofing
    expect(stealthCode).toContain('UNMASKED_VENDOR_WEBGL');
    expect(stealthCode).toContain('UNMASKED_RENDERER_WEBGL');
    expect(stealthCode).toContain('NVIDIA');

    // 5. AudioContext without in-place drift
    expect(stealthCode).toContain('AudioBuffer');
    expect(stealthCode).toContain('perturbedBuffers');
  });

  it('guarantees ZERO global window footprint leaks (__MAHI_STEALTH_INJECTED__ and __mahiProxies)', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-uuid-leak-test', 'Profile-No-Leaks', {
      browser: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36' },
    });

    const stealthCode = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');

    // Critical: must not attach detectable globals to window
    expect(stealthCode).not.toContain('window.__MAHI_STEALTH_INJECTED__');
    expect(stealthCode).not.toContain('window.__mahiProxies');
    expect(stealthCode).toContain('hookedProxies');
  });

  it('resolves dynamic Chrome major and full version for userAgentData from profile User-Agent', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-uuid-ua-dynamic', 'Profile-UA-Dynamic', {
      browser: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.6834.83 Safari/537.36' },
    });

    const stealthCode = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');
    expect(stealthCode).toContain('"132"');
    expect(stealthCode).toContain('"132.0.6834.83"');

    const rulesJson = JSON.parse(fs.readFileSync(path.join(extDir, 'rules.json'), 'utf8'));
    const secChUaRule = rulesJson[0].action.requestHeaders.find((h: any) => h.header === 'sec-ch-ua');
    expect(secChUaRule).toBeDefined();
    expect(secChUaRule.value).toContain('Chromium";v="132"');
  });

  it('ensures background.js properly defines pNum and pName for badge configuration', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-uuid-bg', 'Profile 42', {});
    const bgCode = fs.readFileSync(path.join(extDir, 'background.js'), 'utf8');

    expect(bgCode).toContain('var pNum = "42"');
    expect(bgCode).toContain('var pName = "Profile 42"');
    expect(bgCode).toContain('chrome.action.setBadgeText');
  });

  it('suppresses DOM pill and title mutation when showProfileBadge is disabled', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-uuid-nobadge', 'Silent-Profile', {
      browser: { showProfileBadge: false },
    });
    const contentCode = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');

    expect(contentCode).toContain('var enableInPageBadge = false');
  });

  it('should adapt GPU renderer target for macOS personas (Apple M-Series)', () => {
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-mac-1', 'Mac-Profile', {
      browser: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36' },
    });

    const stealthCode = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');
    expect(stealthCode).toContain('Apple');
  });
});
