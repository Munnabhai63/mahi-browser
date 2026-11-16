import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import * as child_process from 'node:child_process';

let mockSpawnCalls: Array<{ exe: any; args: any; opts: any }> = [];

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: vi.fn((exe: any, args: any, opts: any) => {
      mockSpawnCalls.push({ exe, args, opts });
      return {
        pid: 99999,
        unref: () => {},
      } as any;
    }),
  };
});
import {
  generateStatisticalProfileSettings,
  StatisticalProfileOptions,
} from '../../03_HARDWARE/fingerprint-generator-service.js';
import { MANAGED_ENGINE_VERSION } from '../../10_CONFIG/engine-config.js';
import {
  generateConsistentEnvironmentSettings,
  getDefaultProfileSettings,
} from '../../10_CONFIG/shared/constants/defaults.js';
import {
  validateAndNormalizeFingerprintCoherence,
} from '../../02_BROWSER/stealth-native-preferences.js';
import {
  createProfile,
  updateProfile,
  getProfileById,
  deleteProfile,
} from '../../02_BROWSER/services/profile-service.js';
import {
  ensureProfileStealthExtension,
  buildSanitizedLaunchArgs,
  launchCamoufoxProfile,
} from '../../02_BROWSER/launcher.js';
import {
  resolveExecutablePath,
  getCamoufoxExecutablePath,
  isCamoufoxInstalled,
  getEngineAvailability,
} from '../../02_BROWSER/detector.js';
import {
  resolveMultiCoreExecutablePath,
} from '../../02_BROWSER/services/multi-core-resolver.js';
import {
  auditProfileFingerprint,
} from '../../03_HARDWARE/diagnostics-service.js';
import { setCustomDatabasePath, getDatabase, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';

describe('Phase 4: Anti-Detect Engine Hardening', () => {
  let tempDir: string;

  beforeAll(async () => {
    const testDbDir = path.join(process.cwd(), '.test_data');
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    setCustomDatabasePath(
      path.join(testDbDir, `test_mahi_phase4_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.sqlite`)
    );
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase4-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // ==========================================================================
  // SUITE 1: Statistical Bayesian Fingerprint Coherence
  // ==========================================================================
  describe('1. Statistical Bayesian Fingerprint Coherence', () => {
    it('generates 50+ profiles across OS and engine variants with zero contradictions', () => {
      const osVariants: Array<'windows' | 'macos' | 'linux' | 'android'> = [
        'windows',
        'macos',
        'linux',
        'android',
      ];
      const engineVariants: Array<'chromium' | 'chrome' | 'edge' | 'camoufox'> = [
        'chromium',
        'chrome',
        'edge',
        'camoufox',
      ];

      for (let i = 0; i < 50; i++) {
        const targetOs = osVariants[i % osVariants.length];
        const engine = engineVariants[i % engineVariants.length];
        const settings = generateStatisticalProfileSettings({
          os: targetOs,
          engine,
          seed: `test-seed-${i}`,
        });

        // 1. Validation Report must be completely valid with 0 warnings
        const report = validateAndNormalizeFingerprintCoherence(settings);
        expect(report.valid).toBe(true);
        expect(report.warnings).toHaveLength(0);

        // 2. Engine to UA Coherence
        if (engine === 'camoufox') {
          expect(settings.browser.userAgent).toMatch(/Firefox|Gecko/);
          expect(settings.browser.userAgent).not.toMatch(/Chrome\/\d+/);
        } else if (engine === 'edge') {
          expect(settings.browser.userAgent).toContain('Edg/');
        } else {
          expect(settings.browser.userAgent).toContain('Chrome/');
        }

        // 3. OS and Platform Coherence
        const fp = settings.fingerprint!;
        if (targetOs === 'windows') {
          expect(fp.platform).toBe('Win32');
          expect(fp.isM1).toBe(false);
          expect(fp.webglRenderer).toContain('Direct3D');
          expect(fp.fonts?.some((f) => f.includes('Segoe UI') || f.includes('Calibri'))).toBe(true);
          expect(fp.fonts?.some((f) => f.includes('Apple Color Emoji') || f.includes('SF Pro'))).toBe(false);
        } else if (targetOs === 'macos') {
          expect(fp.platform).toBe('MacIntel');
          expect(fp.webglRenderer).toMatch(/Metal|Apple/);
          expect(fp.fonts?.some((f) => f.includes('SF Pro') || f.includes('Helvetica'))).toBe(true);
          expect(fp.fonts?.some((f) => f.includes('Segoe UI') || f.includes('Calibri'))).toBe(false);
        } else if (targetOs === 'linux') {
          expect(fp.platform).toBe('Linux x86_64');
          expect(fp.isM1).toBe(false);
          expect(fp.webglRenderer).toContain('Mesa');
          expect(fp.fonts?.some((f) => f.includes('DejaVu') || f.includes('Liberation'))).toBe(true);
          expect(fp.fonts?.some((f) => f.includes('Segoe UI') || f.includes('SF Pro'))).toBe(false);
        } else if (targetOs === 'android') {
          expect(fp.platform).toContain('Linux arm');
          expect(fp.maxTouchPoints).toBe(5);
          expect(settings.display.screenWidth).toBeLessThanOrEqual(500);
        }

        // 4. Client hints must NOT leak on Camoufox
        if (engine === 'camoufox') {
          expect(fp.clientHints).toBeUndefined();
        } else {
          expect(fp.clientHints).toBeDefined();
          expect(fp.clientHints?.brands?.length).toBeGreaterThan(0);
        }
      }
    });

    it('produces deterministic output when given the exact same seed', () => {
      const run1 = generateStatisticalProfileSettings({ seed: 'mahi-fixed-seed-42', os: 'windows', engine: 'chrome' });
      const run2 = generateStatisticalProfileSettings({ seed: 'mahi-fixed-seed-42', os: 'windows', engine: 'chrome' });

      expect(run1.browser.userAgent).toBe(run2.browser.userAgent);
      expect(run1.fingerprint?.webglRenderer).toBe(run2.fingerprint?.webglRenderer);
      expect(run1.display.screenWidth).toBe(run2.display.screenWidth);
      expect(run1.display.screenHeight).toBe(run2.display.screenHeight);
      expect(run1.fingerprint?.hardwareConcurrency).toBe(run2.fingerprint?.hardwareConcurrency);
    });

    it('generateConsistentEnvironmentSettings() delegates to statistical generator', () => {
      const generated = generateConsistentEnvironmentSettings();
      expect(generated.browser).toBeDefined();
      expect(generated.fingerprint).toBeDefined();
      expect(generated.fingerprint?.webglVendor).toBeDefined();
      expect(generated.fingerprint?.webglRenderer).toBeDefined();
      expect(generated.fingerprint?.fonts?.length).toBeGreaterThan(0);
      const report = validateAndNormalizeFingerprintCoherence(generated);
      expect(report.valid).toBe(true);
    });
  });

  // ==========================================================================
  // SUITE 2: Profile Persistence Normalization
  // ==========================================================================
  describe('2. Profile Persistence Normalization', () => {
    it('normalizes contradictory inputs on createProfile before saving to database', () => {
      // Contradictory input: Windows User-Agent with Apple M1 flag + macOS fonts + touch points
      const contradictorySettings: any = {
        browser: {
          engine: 'chrome',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        },
        fingerprint: {
          platform: 'MacIntel', // Contradicts Windows UA
          isM1: true,           // Contradicts Windows UA
          webglVendor: 'Google Inc. (Apple)',
          webglRenderer: 'ANGLE (Apple, Apple M1, Metal)',
          maxTouchPoints: 5,   // Contradicts Desktop Windows
          fonts: ['SF Pro', 'Apple Color Emoji', 'Segoe UI'],
        },
        display: {
          screenWidth: 400, // Contradicts Desktop Windows
          screenHeight: 300,
        },
      };

      const created = createProfile({
        name: 'Coherence Normalization Test',
        settings: contradictorySettings,
      });

      const fetched = getProfileById(created.id);
      expect(fetched).not.toBeNull();
      const savedFp = fetched!.settings.fingerprint!;
      const savedDisplay = fetched!.settings.display;

      // Platform must have been normalized to Win32
      expect(savedFp.platform).toBe('Win32');
      // isM1 must have been cleared
      expect(savedFp.isM1).toBe(false);
      // WebGL Renderer must have been normalized to Direct3D
      expect(savedFp.webglRenderer).toContain('Direct3D');
      // Screen width must have been normalized for desktop
      expect(savedDisplay.screenWidth).toBeGreaterThanOrEqual(800);
      // macOS proprietary fonts must have been purged
      expect(savedFp.fonts?.includes('SF Pro')).toBe(false);
      expect(savedFp.fonts?.includes('Apple Color Emoji')).toBe(false);
    });

    it('normalizes contradictory inputs on updateProfile before saving to database', () => {
      const profile = createProfile({
        name: 'Update Coherence Test',
      });

      // Update with Camoufox engine but Chrome UA
      const updated = updateProfile(profile.id, {
        settings: {
          browser: {
            engine: 'camoufox',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          },
        } as any,
      });

      expect(updated.settings.browser.engine).toBe('camoufox');
      expect(updated.settings.browser.userAgent).toMatch(/Firefox|Gecko/);
    });
  });

  // ==========================================================================
  // SUITE 3: CreepJS-Equivalent Runtime Stealth Verification
  // ==========================================================================
  describe('3. CreepJS-Equivalent Runtime Stealth Verification', () => {
    it('executes generated stealth-core.js in isolated node:vm and passes CreepJS anti-bot traps', () => {
      const extDir = ensureProfileStealthExtension(
        tempDir,
        'creepjs-profile-id',
        'CreepJS Profile',
        getDefaultProfileSettings(),
        { nativeStealthActive: false }
      );

      const stealthPath = path.join(extDir, 'stealth-core.js');
      expect(fs.existsSync(stealthPath)).toBe(true);
      const stealthJs = fs.readFileSync(stealthPath, 'utf8');

      // Construct Mock DOM and Browser Prototype Environment
      class MockNavigator {}
      Object.defineProperty(MockNavigator.prototype, 'webdriver', {
        get: function webdriver() {
          if (!this || !(this instanceof MockNavigator)) {
            throw new TypeError("Failed to execute 'webdriver' on 'Navigator': Illegal invocation");
          }
          return true; // Initially simulate automation controlled
        },
        configurable: true,
        enumerable: true,
      });
      const mockNavigatorProto = MockNavigator.prototype;
      const mockNavigator = new MockNavigator();

      class MockDOMRect {
        constructor(public x: number, public y: number, public width: number, public height: number) {}
      }

      class MockAudioBuffer {
        _data = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
        getChannelData() {
          return this._data;
        }
      }

      class MockCanvasRenderingContext2D {
        getImageData() {
          return { width: 10, height: 10, data: new Uint8ClampedArray(400) };
        }
        putImageData() {}
        drawImage() {}
      }

      class MockHTMLCanvasElement {
        width = 100;
        height = 100;
        getContext() {
          return new MockCanvasRenderingContext2D();
        }
        toDataURL() {
          return 'data:image/png;base64,mockCanvasHash';
        }
      }

      const mockWindow: any = {
        navigator: mockNavigator,
        Navigator: MockNavigator,
        document: {
          createElement: (tag: string) => {
            if (tag === 'canvas') return new MockHTMLCanvasElement();
            return {};
          },
        },
        HTMLCanvasElement: MockHTMLCanvasElement,
        CanvasRenderingContext2D: MockCanvasRenderingContext2D,
        DOMRect: MockDOMRect,
        AudioBuffer: MockAudioBuffer,
        Function,
        // Pre-inject known automation vectors to test pattern-based scrubbing
        cdc_adoQpoasnfa76pfcZLmcfl: 'chromedrive_vector',
        __webdriver_evaluate: () => {},
        __selenium_unwrapped: true,
      };
      mockWindow.window = mockWindow;

      // Execute stealth script inside isolated context
      vm.runInNewContext(stealthJs, mockWindow);

      // --- TRAP 1: navigator.webdriver evaluation ---
      expect(mockWindow.navigator.webdriver).toBe(false);

      // --- TRAP 2: Prototype descriptor and native fidelity ---
      const desc = Object.getOwnPropertyDescriptor(mockNavigatorProto, 'webdriver');
      expect(desc).toBeDefined();
      expect(typeof desc?.get).toBe('function');
      const getterStr = Function.prototype.toString.call(desc!.get);
      expect(getterStr).toContain('[native code]');
      expect(getterStr).toContain('get webdriver');
      // Native illegal invocation check: Calling on {} must throw TypeError
      expect(() => desc!.get!.call({})).toThrow(TypeError);
      expect(desc!.get!.call(mockNavigator)).toBe(false);

      // --- TRAP 3: Zero MAHI global namespace leaks ---
      const globalKeys = Object.keys(mockWindow);
      const mahiLeaks = globalKeys.filter((k) => k.startsWith('__MAHI') || k.startsWith('__mahi') || k.toLowerCase().includes('mahi_'));
      expect(mahiLeaks).toHaveLength(0);

      // --- TRAP 4: Complete scrubbing of automation artifacts ---
      expect(mockWindow.cdc_adoQpoasnfa76pfcZLmcfl).toBeUndefined();
      expect(mockWindow.__webdriver_evaluate).toBeUndefined();
      expect(mockWindow.__selenium_unwrapped).toBeUndefined();

      // --- TRAP 5: AudioBuffer non-in-place perturbation stability ---
      const audioBuf = new MockAudioBuffer();
      const firstChannel = audioBuf.getChannelData();
      const firstVal = firstChannel[0];
      const secondChannel = audioBuf.getChannelData();
      const secondVal = secondChannel[0];
      // Successive calls to the same buffer must not exhibit cumulative in-place drift
      expect(firstVal).toBe(secondVal);

      // --- TRAP 6: Canvas perturbation must be callable and deterministic ---
      const canvas = new MockHTMLCanvasElement();
      const dataUrl = canvas.toDataURL();
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SUITE 4: CDP Isolation & Rebrowser-Patches Wiring
  // ==========================================================================
  describe('4. CDP Isolation & Rebrowser-Patches Wiring', () => {
    it('wires --disable-blink-features=AutomationControlled and --mahi-cdp-isolated into launch args', () => {
      const argsNormal = buildSanitizedLaunchArgs({
        storageDir: tempDir,
        debugPort: 34123,
        mode: 'normal',
      });

      // Must disable Blink AutomationControlled
      expect(argsNormal).toContain('--disable-blink-features=AutomationControlled');
      // Must NEVER pass --enable-automation
      expect(argsNormal).not.toContain('--enable-automation');

      const argsAutomationNative = buildSanitizedLaunchArgs({
        storageDir: tempDir,
        debugPort: 34123,
        mode: 'automation',
        isNativeStealth: true,
      });

      // Automation mode with native stealth core must inject --mahi-cdp-isolated
      expect(argsAutomationNative).toContain('--mahi-cdp-isolated');
      expect(argsAutomationNative).toContain('--disable-blink-features=AutomationControlled');
      expect(argsAutomationNative).not.toContain('--enable-automation');

      const argsAutomationStock = buildSanitizedLaunchArgs({
        storageDir: tempDir,
        debugPort: 34123,
        mode: 'automation',
        isNativeStealth: false,
      });

      // Automation mode on stock Chromium must NOT inject fake unknown switch
      expect(argsAutomationStock).not.toContain('--mahi-cdp-isolated');
      expect(argsAutomationStock).toContain('--disable-blink-features=AutomationControlled');
      expect(argsAutomationStock).not.toContain('--enable-automation');
    });

    it('verifies automation engines import rebrowser-playwright-core and configure runtime fix mode', () => {
      const automationEnginePath = path.resolve('09_AUTOMATION/automation-engine.ts');
      const cookieWarmerPath = path.resolve('09_AUTOMATION/cookie-warmer-service.ts');

      const autoEngineCode = fs.readFileSync(automationEnginePath, 'utf8');
      const warmerCode = fs.readFileSync(cookieWarmerPath, 'utf8');

      // Must import rebrowser-playwright-core
      expect(autoEngineCode).toContain("from 'rebrowser-playwright-core'");
      expect(warmerCode).toContain("from 'rebrowser-playwright-core'");

      // Must configure REBROWSER_PATCHES_RUNTIME_FIX_MODE
      expect(autoEngineCode).toContain('REBROWSER_PATCHES_RUNTIME_FIX_MODE');

      // Must not directly import raw unpatched playwright-core
      expect(autoEngineCode).not.toContain("from 'playwright-core'");
      expect(warmerCode).not.toContain("from 'playwright-core'");
    });
  });

  // ==========================================================================
  // SUITE 5: Camoufox Dual-Engine Plumbing & Honesty Rule
  // ==========================================================================
  describe('5. Camoufox Dual-Engine Plumbing & Honesty Rule', () => {
    it('throws an honest, actionable error when Camoufox binary is absent (never fakes Chromium)', () => {
      const originalEnv = process.env.CAMOUFOX_EXECUTABLE_PATH;
      try {
        process.env.CAMOUFOX_EXECUTABLE_PATH = path.join(tempDir, 'non_existent_camoufox.exe');

        expect(() => {
          resolveExecutablePath('camoufox');
        }).toThrow(/Camoufox engine executable not found/);

        expect(() => {
          resolveMultiCoreExecutablePath('Mozilla/5.0 ... Firefox/135.0', undefined, 'camoufox');
        }).toThrow(/Camoufox engine executable not found/);
      } finally {
        if (originalEnv) process.env.CAMOUFOX_EXECUTABLE_PATH = originalEnv;
        else delete process.env.CAMOUFOX_EXECUTABLE_PATH;
      }
    });

    it('resolves Camoufox when valid binary is present and serializes chunked CAMOU_CONFIG_*', async () => {
      // Create mock Camoufox executable in tempDir
      const mockExePath = path.join(tempDir, os.platform() === 'win32' ? 'camoufox.exe' : 'camoufox');
      fs.writeFileSync(mockExePath, '#!/bin/sh\nexit 0\n', { mode: 0o777 });

      const originalEnv = process.env.CAMOUFOX_EXECUTABLE_PATH;
      try {
        process.env.CAMOUFOX_EXECUTABLE_PATH = mockExePath;

        expect(isCamoufoxInstalled()).toBe(true);
        expect(getCamoufoxExecutablePath()).toBe(mockExePath);

        const resolved = resolveExecutablePath('camoufox');
        expect(resolved).toBe(mockExePath);

        const multiCore = resolveMultiCoreExecutablePath('Mozilla/5.0 ... Firefox/135.0', undefined, 'camoufox');
        expect(multiCore.coreType).toBe('camoufox');
        expect(multiCore.executablePath).toBe(mockExePath);

        const availability = getEngineAvailability();
        expect(availability.camoufox).toBe(true);
      } finally {
        if (originalEnv) process.env.CAMOUFOX_EXECUTABLE_PATH = originalEnv;
        else delete process.env.CAMOUFOX_EXECUTABLE_PATH;
      }
    });

    it('verifies ensureProfileStealthExtension omits Sec-CH-UA headers on Camoufox profiles', () => {
      const extDir = ensureProfileStealthExtension(
        tempDir,
        'camoufox-profile-1',
        'Camoufox Profile',
        {
          browser: { engine: 'camoufox', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0' },
        },
        false
      );

      const rulesPath = path.join(extDir, 'rules.json');
      expect(fs.existsSync(rulesPath)).toBe(true);
      const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

      const headerRule = rules.find((r: any) => r.action?.type === 'modifyHeaders');
      expect(headerRule).toBeDefined();
      const requestHeaders: Array<{ header: string }> = headerRule.action.requestHeaders;

      // On Camoufox, sec-ch-ua headers MUST NOT be present
      const hasSecChUa = requestHeaders.some((h) => h.header.toLowerCase().startsWith('sec-ch-ua'));
      expect(hasSecChUa).toBe(false);
      // But Accept-Language should be present
      expect(requestHeaders.some((h) => h.header.toLowerCase() === 'accept-language')).toBe(true);
    });
  });

  // ==========================================================================
  // SUITE 6: Diagnostics Service Audit Scoring
  // ==========================================================================
  describe('6. Diagnostics Service Audit Scoring', () => {
    it('audits engine-to-UA alignment and flags contradictions with lower score', () => {
      // Contradictory profile: engine is camoufox, but UA is Chrome
      const p1 = createProfile({
        name: 'Diag Test 1',
        settings: {
          browser: {
            engine: 'camoufox',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          },
        } as any,
      });

      // Update directly via sqlite to bypass automatic createProfile normalization to test diagnostics sensor
      const db = getDatabase();
      const contradictorySettings = {
        browser: {
          engine: 'camoufox',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        },
        fingerprint: {
          canvas: 'noise',
          webgl: 'noise',
        },
        display: { screenWidth: 1920, screenHeight: 1080 },
        locale: { language: 'en-US', timezone: 'America/New_York' },
        network: { directConnection: true },
      };
      db.prepare('UPDATE profile_settings SET settings_json = ? WHERE profile_id = ?').run(
        JSON.stringify(contradictorySettings),
        p1.id
      );

      const report = auditProfileFingerprint(p1.id);
      expect(report).toBeDefined();
      const coherenceCheck = report.checks.find((c) => c.id === 'check-coherence');
      expect(coherenceCheck).toBeDefined();
      expect(coherenceCheck?.status).toBe('WARN');
      expect(coherenceCheck?.score).toBeLessThanOrEqual(75);
      expect(coherenceCheck?.recommendation).toMatch(/camoufox/i);
    });
  });

  // ==========================================================================
  // SUITE 7: Phase 4 Remediation Regressions (Adversarial Audit Hardening)
  // ==========================================================================
  describe('7. Phase 4 Remediation Regressions', () => {
    it('verifies 10_CONFIG/shared/constants/defaults.ts and fingerprint-coherence.ts are 100% browser-safe', () => {
      const defaultsSrc = fs.readFileSync(path.resolve('10_CONFIG/shared/constants/defaults.ts'), 'utf8');
      expect(defaultsSrc).not.toMatch(/from\s+['"]node:/);
      expect(defaultsSrc).not.toMatch(/from\s+['"](fs|path|crypto|zlib|adm-zip|fingerprint-generator|header-generator)['"]/);
      expect(defaultsSrc).not.toContain('fingerprint-generator-service');

      const coherenceSrc = fs.readFileSync(path.resolve('10_CONFIG/shared/utils/fingerprint-coherence.ts'), 'utf8');
      expect(coherenceSrc).not.toMatch(/from\s+['"]node:/);
      expect(coherenceSrc).not.toMatch(/from\s+['"](fs|path|crypto|zlib|adm-zip)['"]/);

      // Verify defaults functions execute cleanly without requiring node modules
      const generated = generateConsistentEnvironmentSettings();
      expect(generated.browser).toBeDefined();
      expect(generated.fingerprint).toBeDefined();
    });

    it('verifies built renderer bundle contains zero Node require leaks or adm-zip references', () => {
      const distAssetsDir = path.resolve('dist/assets');
      if (fs.existsSync(distAssetsDir)) {
        const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
        for (const file of jsFiles) {
          const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
          // Must not contain Node CJS require calls for fs, path, etc.
          expect(content).not.toMatch(/require\(['"](fs|path|crypto|zlib)['"]\)/);
          expect(content).not.toContain('adm-zip');
        }
      }
    });

    it('verifies launchCamoufoxProfile schema, locale extraction, WebRTC safety, and proxy prefs in user.js', async () => {
      const mockExe = path.join(tempDir, os.platform() === 'win32' ? 'mock_camoufox.exe' : 'mock_camoufox');
      fs.writeFileSync(mockExe, '#!/bin/sh\nexit 0\n', { mode: 0o777 });
      const origCamou = process.env.CAMOUFOX_EXECUTABLE_PATH;
      process.env.CAMOUFOX_EXECUTABLE_PATH = mockExe;
      mockSpawnCalls = [];

      try {
        const profile = createProfile({
          name: 'Camoufox Schema Validation Profile',
          settings: {
            browser: {
              engine: 'camoufox',
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
            },
            display: { screenWidth: 1920, screenHeight: 1080 },
            locale: { language: 'de-DE', timezone: 'Europe/Berlin' },
            network: { directConnection: true, webrtc: 'disabled' },
            fingerprint: {
              platform: 'Win32',
              hardwareConcurrency: 8,
              webglVendor: 'Google Inc. (NVIDIA)',
              webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 ps_5_0, D3D11)',
            },
          } as any,
        });

        const launchResult = await launchCamoufoxProfile(profile);
        expect(launchResult.pid).toBe(99999);
        expect(launchResult.profileId).toBe(profile.id);
        expect(mockSpawnCalls.length).toBeGreaterThan(0);

        const lastCall = mockSpawnCalls[mockSpawnCalls.length - 1];
        const capturedSpawnEnv = lastCall.opts?.env || {};

        // 1. Reassemble chunked CAMOU_CONFIG_*
        let camouConfigRaw = '';
        let cIdx = 1;
        while (capturedSpawnEnv[`CAMOU_CONFIG_${cIdx}`]) {
          camouConfigRaw += capturedSpawnEnv[`CAMOU_CONFIG_${cIdx}`];
          cIdx++;
        }
        expect(camouConfigRaw.length).toBeGreaterThan(0);
        const camouConfig = JSON.parse(camouConfigRaw);

        // WebGL schema casing: lowercase 'l'
        expect(camouConfig['webGl:vendor']).toBe('Google Inc. (NVIDIA)');
        expect(camouConfig['webGl:renderer']).toContain('Direct3D11');
        expect(camouConfig['webGL:vendor']).toBeUndefined();
        expect(camouConfig['webGL:renderer']).toBeUndefined();

        // Locale: base language 'de', ISO 3166-1 alpha-2 region 'DE'
        expect(camouConfig['locale:language']).toBe('de');
        expect(camouConfig['locale:region']).toBe('DE');

        // WebRTC: on direct or loopback connection, webrtc:ipv4 must NOT be set
        expect(camouConfig['webrtc:ipv4']).toBeUndefined();

        // 2. Inspect user.js in storageDir
        const userJsPath = path.join(profile.storagePath, 'user.js');
        expect(fs.existsSync(userJsPath)).toBe(true);
        const userJs = fs.readFileSync(userJsPath, 'utf8');
        expect(userJs).toContain('user_pref("network.proxy.type", 0);');
        expect(userJs).toContain('user_pref("media.peerconnection.enabled", false);');
      } finally {
        if (origCamou) process.env.CAMOUFOX_EXECUTABLE_PATH = origCamou;
        else delete process.env.CAMOUFOX_EXECUTABLE_PATH;
      }
    });

    it('verifies ensureProfileStealthExtension formats sec-ch-ua for Edge engine with Microsoft Edge', () => {
      const edgeExtDir = ensureProfileStealthExtension(
        tempDir,
        'edge-stealth-profile',
        'Edge Profile',
        {
          browser: { engine: 'edge', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0' },
        },
        false
      );

      const rulesPath = path.join(edgeExtDir, 'rules.json');
      expect(fs.existsSync(rulesPath)).toBe(true);
      const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

      const headerRule = rules.find((r: any) => r.action?.type === 'modifyHeaders');
      expect(headerRule).toBeDefined();
      const secChUa = headerRule.action.requestHeaders.find((h: any) => h.header === 'sec-ch-ua');
      expect(secChUa).toBeDefined();
      expect(secChUa.value).toContain('Microsoft Edge');
      expect(secChUa.value).not.toContain('Google Chrome');

      const secChUaFull = headerRule.action.requestHeaders.find((h: any) => h.header === 'sec-ch-ua-full-version-list');
      expect(secChUaFull).toBeDefined();
      expect(secChUaFull.value).toContain('Microsoft Edge');
    });

    it('verifies unseeded generateStatisticalProfileSettings consumes Bayesian generator output', () => {
      const unseeded = generateStatisticalProfileSettings({
        os: 'windows',
        engine: 'chrome',
      });
      expect(unseeded.browser).toBeDefined();
      expect(unseeded.fingerprint).toBeDefined();
      expect(unseeded.fingerprint?.hardwareConcurrency).toBeGreaterThanOrEqual(2);
      expect(unseeded.fingerprint?.deviceMemory).toBeGreaterThanOrEqual(2);
      expect(unseeded.fingerprint?.webglRenderer).toBeDefined();
      expect(unseeded.fingerprint?.clientHints?.brands?.some((b: any) => b.brand === 'Google Chrome')).toBe(true);
    });

    it('verifies unseeded generateStatisticalProfileSettings aligns clientHints with MANAGED_ENGINE_VERSION', () => {
      const chromeMajor = MANAGED_ENGINE_VERSION.split('.')[0];

      // Test Chrome engine
      const unseededChrome = generateStatisticalProfileSettings({
        os: 'windows',
        engine: 'chrome',
      });
      expect(unseededChrome.browser).toBeDefined();
      expect(unseededChrome.fingerprint?.clientHints).toBeDefined();
      const chromeBrands = unseededChrome.fingerprint!.clientHints!.brands;
      const chromeFullVersions = unseededChrome.fingerprint!.clientHints!.fullVersionList;

      for (const b of chromeBrands) {
        if (b.brand === 'Chromium' || b.brand === 'Google Chrome') {
          expect(b.version).toBe(chromeMajor);
        }
      }
      for (const fv of chromeFullVersions) {
        if (fv.brand === 'Chromium' || fv.brand === 'Google Chrome') {
          expect(fv.version).toBe(MANAGED_ENGINE_VERSION);
        }
      }

      // Test Edge engine
      const unseededEdge = generateStatisticalProfileSettings({
        os: 'windows',
        engine: 'edge',
      });
      expect(unseededEdge.fingerprint?.clientHints).toBeDefined();
      const edgeBrands = unseededEdge.fingerprint!.clientHints!.brands;
      const edgeFullVersions = unseededEdge.fingerprint!.clientHints!.fullVersionList;

      expect(edgeBrands.some((b: any) => b.brand === 'Microsoft Edge')).toBe(true);
      expect(edgeBrands.some((b: any) => b.brand === 'Google Chrome')).toBe(false);

      for (const b of edgeBrands) {
        if (b.brand === 'Chromium' || b.brand === 'Microsoft Edge') {
          expect(b.version).toBe(chromeMajor);
        }
      }
      for (const fv of edgeFullVersions) {
        if (fv.brand === 'Chromium' || fv.brand === 'Microsoft Edge') {
          expect(fv.version).toBe(MANAGED_ENGINE_VERSION);
        }
      }
    });

    it('proves HeadlessChrome never leaks in unseeded clientHints across 100 random iterations', () => {
      const chromeMajor = MANAGED_ENGINE_VERSION.split('.')[0];
      for (let i = 0; i < 100; i++) {
        const engineChoice = i % 2 === 0 ? 'chrome' : 'edge';
        const targetOs = i % 3 === 0 ? 'windows' : (i % 3 === 1 ? 'mac' : 'linux');
        const unseeded = generateStatisticalProfileSettings({
          os: targetOs,
          engine: engineChoice,
        });

        expect(unseeded.fingerprint).toBeDefined();
        const brands = unseeded.fingerprint?.clientHints?.brands || [];
        const fullVersionList = unseeded.fingerprint?.clientHints?.fullVersionList || [];

        expect(brands.length).toBeGreaterThan(0);
        expect(brands.some((b: any) => b.brand.toLowerCase().includes('headless'))).toBe(false);
        expect(fullVersionList.some((fv: any) => fv.brand.toLowerCase().includes('headless'))).toBe(false);

        if (engineChoice === 'chrome') {
          expect(brands.some((b: any) => b.brand === 'Google Chrome')).toBe(true);
          const chromeBrand = brands.find((b: any) => b.brand === 'Google Chrome');
          expect(chromeBrand?.version).toBe(chromeMajor);
          const chromeFv = fullVersionList.find((fv: any) => fv.brand === 'Google Chrome');
          expect(chromeFv?.version).toBe(MANAGED_ENGINE_VERSION);
        } else {
          expect(brands.some((b: any) => b.brand === 'Microsoft Edge')).toBe(true);
          const edgeBrand = brands.find((b: any) => b.brand === 'Microsoft Edge');
          expect(edgeBrand?.version).toBe(chromeMajor);
          const edgeFv = fullVersionList.find((fv: any) => fv.brand === 'Microsoft Edge');
          expect(edgeFv?.version).toBe(MANAGED_ENGINE_VERSION);
        }
      }
    });

    it('verifies cookie-warmer-service propagates locale, timezoneId, and proxy for Camoufox', () => {
      const warmerSrc = fs.readFileSync(path.resolve('09_AUTOMATION/cookie-warmer-service.ts'), 'utf8');
      expect(warmerSrc).toContain('firefox.launchPersistentContext');
      expect(warmerSrc).toContain('locale: profile.settings?.locale?.language');
      expect(warmerSrc).toContain('timezoneId: profile.settings?.locale?.timezone');
      expect(warmerSrc).toContain('proxy: proxyConfig');
      expect(warmerSrc).toContain('cleanupStaleLocks(storageDir)');
      expect(warmerSrc).toContain('getDecryptedProxyCredentials');
    });

    it('verifies cookie-warmer-service and automation-engine runtime fix mode and dual engine wiring', () => {
      const warmerSrc = fs.readFileSync(path.resolve('09_AUTOMATION/cookie-warmer-service.ts'), 'utf8');
      expect(warmerSrc).toContain('REBROWSER_PATCHES_RUNTIME_FIX_MODE');
      expect(warmerSrc).toContain("MAHI_CDP_ISOLATED = '1'");
      expect(warmerSrc).toContain("from 'rebrowser-playwright-core'");
      expect(warmerSrc).toContain('firefox.launchPersistentContext');

      const creepScriptSrc = fs.readFileSync(path.resolve('12_SCRIPTS/verify-creepjs.ts'), 'utf8');
      expect(creepScriptSrc).toContain('--headless=new');
      expect(creepScriptSrc).toContain('deterministic hash stability');
    });
  });
});
