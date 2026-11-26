import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {
  buildSanitizedLaunchArgs,
  ensureProfileStealthExtension,
  resolveEffectiveWebrtcPolicy,
} from '../../02_BROWSER/launcher.js';
import {
  deriveLocaleFromGeo,
  generateConsistentEnvironmentSettings,
  getDefaultProfileSettings,
} from '../../10_CONFIG/shared/constants/defaults.js';
import {
  getDeterministicGreaseTriplet,
  getDeterministicWebglLimits,
} from '../../10_CONFIG/shared/utils/fingerprint-coherence.js';

function runStealthCoreInVm(stealthJs: string) {
  class MockNavigator {
    userAgent = '';
    language = 'en-US';
    languages = ['en-US'];
    platform = 'Win32';
    hardwareConcurrency = 8;
    deviceMemory = 8;
    maxTouchPoints = 0;
    webdriver = false;
    plugins: any = [];
    mimeTypes: any = [];
    pdfViewerEnabled = true;
    mediaDevices = {
      enumerateDevices: async () => [{ deviceId: 'host', kind: 'audioinput', label: 'Host Mic', groupId: 'host-grp' }],
    };
    getGamepads() {
      return [];
    }
    serviceWorker = undefined;
  }

  class MockFontFaceSet {
    check(_font: string) {
      return true;
    }
  }

  class MockCtx2D {
    font = '16px Arial';
    lastMeasuredFont = '';
    measureText(text: string) {
      this.lastMeasuredFont = this.font;
      return { width: this.font.length + text.length };
    }
    getImageData() {
      return { width: 1, height: 1, data: new Uint8ClampedArray(4) };
    }
    putImageData() {}
  }

  class MockWebGL {
    getParameter(p: number) {
      if (p === 3379) return 1024;
      return null;
    }
    getExtension() {
      return null;
    }
    readPixels() {}
  }

  class MockNavigatorUAData {}
  class MockPluginArray {}
  class MockMimeTypeArray {}
  class MockMediaDevices {
    enumerateDevices() {
      return Promise.resolve([]);
    }
  }
  class MockAccelerometer {}
  class MockGyroscope {}
  class MockAbsoluteOrientationSensor {}

  const navInstance = new MockNavigator();
  const docFonts = new MockFontFaceSet();
  const screenObj: Record<string, any> = {};
  const speechVoices = [
    { name: 'Host Voice', lang: 'en-US', default: true, localService: true, voiceURI: 'Host Voice' },
  ];

  const sandbox: Record<string, any> = {
    window: null as any,
    self: null as any,
    top: null as any,
    document: {
      fonts: docFonts,
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
      addEventListener: () => {},
    },
    navigator: navInstance,
    Navigator: MockNavigator,
    NavigatorUAData: MockNavigatorUAData,
    PluginArray: MockPluginArray,
    MimeTypeArray: MockMimeTypeArray,
    MediaDevices: MockMediaDevices,
    FontFaceSet: MockFontFaceSet,
    CanvasRenderingContext2D: MockCtx2D,
    HTMLCanvasElement: { prototype: { toDataURL: () => '', toBlob: () => {} } },
    HTMLIFrameElement: { prototype: {} },
    Element: { prototype: { getBoundingClientRect: () => ({}), getClientRects: () => [] } },
    WebGLRenderingContext: MockWebGL,
    WebGL2RenderingContext: class MockWebGL2 extends MockWebGL {},
    screen: screenObj,
    devicePixelRatio: 1,
    outerWidth: 1280,
    outerHeight: 800,
    Accelerometer: MockAccelerometer,
    Gyroscope: MockGyroscope,
    AbsoluteOrientationSensor: MockAbsoluteOrientationSensor,
    speechSynthesis: {
      getVoices: () => speechVoices,
    },
    Intl,
    Date,
    Promise,
    Proxy,
    Object,
    Array,
    Math,
    WeakMap,
    WeakSet,
    Symbol,
    TypeError,
    chrome: undefined,
    RTCPeerConnection: undefined,
    webkitRTCPeerConnection: undefined,
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;

  vm.runInNewContext(stealthJs, sandbox);

  return {
    sandbox,
    MockCtx2D,
    MockWebGL,
    MockFontFaceSet,
    MockNavigator,
  };
}

describe('Layer 1: Stealth & Fingerprint Coherence Hardening', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-layer1-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures on Windows
    }
  });

  it('Task 1.1: Enforces disable_non_proxied_udp on default/legacy/noise profiles while leaving explicit allow_all unprotected and stored settings unmutated', () => {
    const legacySettings = {
      browser: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/138.0.0.0 Safari/537.36' },
      network: { directConnection: true, webrtc: 'default' as const },
      locale: { language: 'en-US', timezone: 'America/New_York' },
      display: { screenWidth: 1920, screenHeight: 1080 },
    };
    const beforeSnapshot = JSON.stringify(legacySettings);

    expect(resolveEffectiveWebrtcPolicy(legacySettings)).toBe('disable_non_proxied_udp');
    expect(resolveEffectiveWebrtcPolicy({ network: { directConnection: true, webrtc: 'noise' } })).toBe('disable_non_proxied_udp');
    expect(resolveEffectiveWebrtcPolicy({ network: { directConnection: true } })).toBe('disable_non_proxied_udp');
    expect(resolveEffectiveWebrtcPolicy({ network: { directConnection: true, webrtc: 'allow_all' } })).toBe('allow_all');

    const protectedArgs = buildSanitizedLaunchArgs({
      storageDir: tmpRoot,
      debugPort: 35001,
      settings: legacySettings,
    });
    expect(protectedArgs).toContain('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
    expect(protectedArgs).toContain('--enforce-webrtc-ip-permission-check');
    // Must not mutate caller settings object
    expect(JSON.stringify(legacySettings)).toBe(beforeSnapshot);

    const allowAllArgs = buildSanitizedLaunchArgs({
      storageDir: tmpRoot,
      debugPort: 35002,
      settings: {
        ...legacySettings,
        network: { directConnection: true, webrtc: 'allow_all' },
      },
    });
    expect(allowAllArgs).not.toContain('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
    expect(getDefaultProfileSettings().network.webrtc).toBe('disable_non_proxied_udp');
  });

  it('Task 1.2: Masks unlisted fonts in FontFaceSet.check and Canvas measureText with Function.prototype.toString protection', () => {
    const settings = generateConsistentEnvironmentSettings({ os: 'windows', seed: 'win-font-seed' });
    settings.fingerprint.fonts = ['Arial', 'Segoe UI', 'Courier New'];

    const extDir = ensureProfileStealthExtension(tmpRoot, 'prof-fonts', 'Font Test', settings);
    const stealthJs = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');
    const { sandbox, MockCtx2D } = runStealthCoreInVm(stealthJs);

    expect(sandbox.document.fonts.check('16px "NonExistentSecretFont"')).toBe(false);
    expect(sandbox.document.fonts.check('16px "Segoe UI"')).toBe(true);
    expect(Function.prototype.toString.call(sandbox.document.fonts.check)).toContain('[native code]');

    const ctx = new MockCtx2D();
    ctx.font = '14px "InstalledRareFont"';
    ctx.measureText('hello');
    expect(ctx.lastMeasuredFont).toBe('14px "Arial"');
    // Original ctx.font restored after call
    expect(ctx.font).toBe('14px "InstalledRareFont"');
    expect(Function.prototype.toString.call(ctx.measureText)).toContain('[native code]');
  });

  it('Task 1.3: Applies consistent Screen / availHeight / orientation / DPR on BOTH desktop and mobile profiles and clamps desktop --window-size', () => {
    const desktopSettings = generateConsistentEnvironmentSettings({ os: 'windows', seed: 'desktop-screen-seed' });
    desktopSettings.display.screenWidth = 1920;
    desktopSettings.display.screenHeight = 1080;
    desktopSettings.display.deviceScaleFactor = 1;

    const extDesktop = ensureProfileStealthExtension(
      path.join(tmpRoot, 'desk'),
      'prof-desk',
      'Desktop Screen',
      desktopSettings
    );
    const { sandbox: deskVm } = runStealthCoreInVm(
      fs.readFileSync(path.join(extDesktop, 'stealth-core.js'), 'utf8')
    );

    expect(deskVm.screen.width).toBe(1920);
    expect(deskVm.screen.height).toBe(1080);
    expect(deskVm.screen.availHeight).toBe(1040);
    expect(deskVm.screen.availTop).toBe(0);
    expect(deskVm.screen.availLeft).toBe(0);
    expect(deskVm.screen.colorDepth).toBe(24);
    expect(deskVm.screen.pixelDepth).toBe(24);
    expect(deskVm.screen.orientation.type).toBe('landscape-primary');
    expect(deskVm.devicePixelRatio).toBe(1);

    const tinyDesktopArgs = buildSanitizedLaunchArgs({
      storageDir: tmpRoot,
      debugPort: 35005,
      settings: {
        ...desktopSettings,
        display: { screenWidth: 200, screenHeight: 150 },
      },
    });
    expect(tinyDesktopArgs).toContain('--window-size=400,400');

    const mobileSettings = generateConsistentEnvironmentSettings({ os: 'android', seed: 'mobile-screen-seed' });
    mobileSettings.display.screenWidth = 412;
    mobileSettings.display.screenHeight = 915;
    mobileSettings.display.deviceScaleFactor = 3;

    const extMob = ensureProfileStealthExtension(
      path.join(tmpRoot, 'mob'),
      'prof-mob',
      'Mobile Screen',
      mobileSettings
    );
    const { sandbox: mobVm } = runStealthCoreInVm(
      fs.readFileSync(path.join(extMob, 'stealth-core.js'), 'utf8')
    );

    expect(mobVm.screen.width).toBe(412);
    expect(mobVm.screen.height).toBe(915);
    expect(mobVm.screen.availHeight).toBe(915);
    expect(mobVm.screen.orientation.type).toBe('portrait-primary');
    expect(mobVm.devicePixelRatio).toBe(3);
  });

  it('Task 1.4: Aligns plugins, pdfViewerEnabled, mediaDevices, speechSynthesis, getGamepads, and sensors per OS without leaking desktop sensors', async () => {
    const winSettings = generateConsistentEnvironmentSettings({ os: 'windows', seed: 'env-win-seed' });
    const extWin = ensureProfileStealthExtension(
      path.join(tmpRoot, 'env-win'),
      'prof-env-win',
      'Env Win',
      winSettings
    );
    const { sandbox: winVm } = runStealthCoreInVm(
      fs.readFileSync(path.join(extWin, 'stealth-core.js'), 'utf8')
    );

    expect(winVm.navigator.pdfViewerEnabled).toBe(true);
    expect(winVm.navigator.plugins.length).toBeGreaterThan(0);
    expect(winVm.navigator.mimeTypes.length).toBeGreaterThan(0);
    expect(winVm.navigator.getGamepads()).toEqual([null, null, null, null]);
    expect(winVm.Accelerometer).toBeUndefined();
    expect(winVm.Gyroscope).toBeUndefined();
    expect(winVm.AbsoluteOrientationSensor).toBeUndefined();

    const winDevices = await winVm.navigator.mediaDevices.enumerateDevices();
    expect(winDevices.length).toBe(4);
    expect(winDevices.every((d: any) => d.label === '' && d.deviceId === '')).toBe(true);
    const winVoices = winVm.speechSynthesis.getVoices();
    expect(winVoices.length).toBeGreaterThan(0);
    expect(winVoices.every((v: any) => String(v.name).includes('Microsoft'))).toBe(true);

    const androidSettings = generateConsistentEnvironmentSettings({ os: 'android', seed: 'env-and-seed' });
    const extAnd = ensureProfileStealthExtension(
      path.join(tmpRoot, 'env-and'),
      'prof-env-and',
      'Env Android',
      androidSettings
    );
    const { sandbox: andVm } = runStealthCoreInVm(
      fs.readFileSync(path.join(extAnd, 'stealth-core.js'), 'utf8')
    );

    expect(andVm.navigator.pdfViewerEnabled).toBe(false);
    expect(andVm.navigator.plugins.length).toBe(0);
    expect(typeof andVm.Accelerometer).toBe('function');
    expect(typeof andVm.Gyroscope).toBe('function');
    const andDevices = await andVm.navigator.mediaDevices.enumerateDevices();
    expect(andDevices.length).toBe(3);
  });

  it('Task 1.5: Derives matching locale/timezone from proxy geo without touching defaults for existing profiles', () => {
    const usLocale = deriveLocaleFromGeo({ countryCode: 'US', timezone: 'America/Los_Angeles' });
    expect(usLocale).toEqual({
      timezone: 'America/Los_Angeles',
      language: 'en-US',
      languagesList: ['en-US', 'en'],
    });

    const deLocale = deriveLocaleFromGeo({ countryCode: 'DE' });
    expect(deLocale).toEqual({
      timezone: 'Europe/Berlin',
      language: 'de-DE',
      languagesList: ['de-DE', 'de', 'en'],
    });

    expect(getDefaultProfileSettings().locale.autoSyncFromIp).toBeUndefined();
    expect(generateConsistentEnvironmentSettings({ os: 'windows', seed: 'seed-geo' }).locale.autoSyncFromIp).toBe(true);
  });

  it('Task 1.6: Produces deterministic per-profile GREASE brands and WebGL limits without hardcoded Not/A)Brand v8', async () => {
    const s1 = generateConsistentEnvironmentSettings({ os: 'windows', seed: 'profile-alpha-seed-111' });
    const s2 = generateConsistentEnvironmentSettings({ os: 'windows', seed: 'profile-beta-seed-999' });
    s1.fingerprint.fingerprintSeed = 'profile-alpha-seed-111';
    s2.fingerprint.fingerprintSeed = 'profile-beta-seed-999';

    const g1 = getDeterministicGreaseTriplet('p1:seedA');
    const g2 = getDeterministicGreaseTriplet('p2:seedB');
    expect(g1).toEqual(getDeterministicGreaseTriplet('p1:seedA'));
    expect(g1.greaseBrand).toBeTruthy();

    const ext1 = ensureProfileStealthExtension(path.join(tmpRoot, 'p1'), 'p1', 'P1', s1);
    const ext2 = ensureProfileStealthExtension(path.join(tmpRoot, 'p2'), 'p2', 'P2', s2);

    const { sandbox: vm1, MockWebGL: Gl1 } = runStealthCoreInVm(
      fs.readFileSync(path.join(ext1, 'stealth-core.js'), 'utf8')
    );
    const { sandbox: vm2, MockWebGL: Gl2 } = runStealthCoreInVm(
      fs.readFileSync(path.join(ext2, 'stealth-core.js'), 'utf8')
    );

    const brands1 = vm1.navigator.userAgentData.brands;
    const brands2 = vm2.navigator.userAgentData.brands;
    expect(brands1[0]).not.toEqual({ brand: 'Not/A)Brand', version: '8' });
    expect(brands1).toHaveLength(3);
    expect(brands2).toHaveLength(3);

    const high1 = await vm1.navigator.userAgentData.getHighEntropyValues(['fullVersionList']);
    expect(high1.fullVersionList[0].brand).toBe(brands1[0].brand);
    expect(high1.fullVersionList[0].version).toBe(`${brands1[0].version}.0.0.0`);

    const gl1 = new Gl1();
    const gl2 = new Gl2();
    const l1 = getDeterministicWebglLimits(`p1:${s1.fingerprint.fingerprintSeed}`, false);
    const l2 = getDeterministicWebglLimits(`p2:${s2.fingerprint.fingerprintSeed}`, false);
    expect(gl1.getParameter(3379)).toBe(l1.maxTextureSize);
    expect(gl2.getParameter(3379)).toBe(l2.maxTextureSize);
    expect(gl1.getParameter(36347)).toBe(l1.maxVertexUniformVectors);
    expect(g1.greaseBrand !== g2.greaseBrand || l1.maxVertexUniformVectors !== l2.maxVertexUniformVectors || brands1[0].brand !== brands2[0].brand).toBe(true);
  });
});
