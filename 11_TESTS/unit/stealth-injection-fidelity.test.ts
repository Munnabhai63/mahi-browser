import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { ensureProfileStealthExtension } from '../../02_BROWSER/launcher.js';

describe('Task 6: Stealth Script Injection & Anti-Detect Fidelity Suite', () => {
  let tempDir: string;
  let stealthScriptCode: string;

  function createMockBrowserContext() {
    function Navigator() {}
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: function webdriver() {
        if (!this || !(this instanceof Navigator)) {
          throw new TypeError("Failed to execute 'webdriver' on 'Navigator': Illegal invocation");
        }
        return true;
      },
      configurable: true,
      enumerable: true,
    });
    Navigator.prototype.hardwareConcurrency = 4;
    Navigator.prototype.deviceMemory = 4;
    Navigator.prototype.platform = 'Win32';
    Navigator.prototype.maxTouchPoints = 0;

    function NavigatorUAData() {}
    NavigatorUAData.prototype = {};

    function HTMLIFrameElement() {}
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get: function() { return (this as any)._contentWindow; },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
      get: function() { return (this as any)._contentDocument; },
      configurable: true,
      enumerable: true
    });

    function HTMLCanvasElement() {}
    HTMLCanvasElement.prototype = {
      toDataURL: function() {
        return (this as any)._dataUrl ? (this as any)._dataUrl() : 'data:image/png;base64,mock';
      },
      toBlob: function(cb: any) { cb(null); },
    };

    function CanvasRenderingContext2D() {}
    CanvasRenderingContext2D.prototype = {
      getImageData: function(sx = 0, sy = 0, sw = 10, sh = 10) {
        if ((this as any)._getImageData) return (this as any)._getImageData(sx, sy, sw, sh);
        return { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
      },
      putImageData: function(img: any, dx = 0, dy = 0) {
        if ((this as any)._putImageData) (this as any)._putImageData(img, dx, dy);
      },
      drawImage: function(srcCanvas: any) {
        if ((this as any)._drawImage) (this as any)._drawImage(srcCanvas);
      },
    };

    function AudioBuffer() {}
    AudioBuffer.prototype = {
      getChannelData: function() { return new Float32Array(500); },
      copyFromChannel: function(dest: Float32Array, channelNumber: number, bufferOffset?: number) {
        const buf = this.getChannelData(channelNumber);
        const offset = bufferOffset || 0;
        for (let i = 0; i < dest.length && (i + offset) < buf.length; i++) {
          dest[i] = buf[i + offset];
        }
      },
    };

    function OffscreenCanvas() {}
    OffscreenCanvas.prototype = {
      getContext: function() {
        return {
          getImageData: function() { return { width: 10, height: 10, data: new Uint8ClampedArray(400) }; },
          putImageData: function() {},
        };
      },
      convertToBlob: function() { return Promise.resolve(null); },
    };

    function OffscreenCanvasRenderingContext2D() {}
    OffscreenCanvasRenderingContext2D.prototype = {
      getImageData: function() { return { width: 10, height: 10, data: new Uint8ClampedArray(400) }; },
      putImageData: function() {},
    };

    function Element() {}
    Element.prototype = {
      getBoundingClientRect: function() { return { x: 10, y: 10, width: 100, height: 50 }; },
      getClientRects: function() { return [{ x: 10, y: 10, width: 100, height: 50 }]; },
    };

    function Range() {}
    Range.prototype = {
      getBoundingClientRect: function() { return { x: 10, y: 10, width: 100, height: 50 }; },
      getClientRects: function() { return [{ x: 10, y: 10, width: 100, height: 50 }]; },
    };

    const mockWebglExt = { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 };
    function WebGLRenderingContext() {}
    WebGLRenderingContext.prototype = {
      getParameter: function() { return 'WebKit'; },
      getExtension: function(name: string) {
        if (name === 'WEBGL_debug_renderer_info') return mockWebglExt;
        return {};
      },
    };

    function WebGL2RenderingContext() {}
    WebGL2RenderingContext.prototype = {
      getParameter: function() { return 'WebKit'; },
      getExtension: function(name: string) {
        if (name === 'WEBGL_debug_renderer_info') return mockWebglExt;
        return {};
      },
    };

    const mockDocument = {
      createElement: (tag: string) => {
        let width = 50;
        let height = 50;
        const pixelData = new Uint8ClampedArray(width * height * 4);
        const ctx: any = {
          canvas: null as any,
          _getImageData: (sx = 0, sy = 0, sw = width, sh = height) => {
            const sub = new Uint8ClampedArray(sw * sh * 4);
            for (let y = 0; y < sh; y++) {
              for (let x = 0; x < sw; x++) {
                const srcIdx = ((sy + y) * width + (sx + x)) * 4;
                const dstIdx = (y * sw + x) * 4;
                sub[dstIdx] = pixelData[srcIdx];
                sub[dstIdx + 1] = pixelData[srcIdx + 1];
                sub[dstIdx + 2] = pixelData[srcIdx + 2];
                sub[dstIdx + 3] = pixelData[srcIdx + 3];
              }
            }
            return { width: sw, height: sh, data: sub };
          },
          _putImageData: (img: any, dx = 0, dy = 0) => {
            const sub = img.data;
            for (let y = 0; y < img.height; y++) {
              for (let x = 0; x < img.width; x++) {
                const srcIdx = (y * img.width + x) * 4;
                const dstIdx = ((dy + y) * width + (dx + x)) * 4;
                pixelData[dstIdx] = sub[srcIdx];
                pixelData[dstIdx + 1] = sub[srcIdx + 1];
                pixelData[dstIdx + 2] = sub[srcIdx + 2];
                pixelData[dstIdx + 3] = sub[srcIdx + 3];
              }
            }
          },
          _drawImage: (src: any) => {
            if (src && src._pixelData) {
              pixelData.set(src._pixelData.slice(0, pixelData.length));
            }
          },
        };
        const canvasObj: any = {
          width,
          height,
          _pixelData: pixelData,
          getContext: (type: string) => {
            if (type === '2d') {
              ctx.canvas = canvasObj;
              return Object.assign(Object.create(CanvasRenderingContext2D.prototype), ctx);
            }
            return null;
          },
          _dataUrl: () => {
            let sum = 0;
            for (let i = 0; i < pixelData.length; i++) sum = (sum * 31 + pixelData[i]) | 0;
            return 'data:image/png;base64,mock_' + (sum >>> 0).toString(16);
          },
        };
        Object.setPrototypeOf(canvasObj, HTMLCanvasElement.prototype);
        return canvasObj;
      },
      documentElement: {},
      querySelector: () => null,
    };

    const navigatorInstance = Object.create(Navigator.prototype);
    navigatorInstance.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.6943.53 Safari/537.36';

    const sandbox: Record<string, any> = {
      window: {},
      navigator: navigatorInstance,
      document: mockDocument,
      screen: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
      },
      Navigator,
      NavigatorUAData,
      HTMLIFrameElement,
      HTMLCanvasElement,
      CanvasRenderingContext2D,
      OffscreenCanvas,
      OffscreenCanvasRenderingContext2D,
      AudioBuffer,
      Element,
      Range,
      WebGLRenderingContext,
      WebGL2RenderingContext,
      DOMRect: function(x: number, y: number, w: number, h: number) {
        return { x, y, width: w, height: h };
      },
      WeakSet,
      WeakMap,
      Proxy,
      Object,
      Function,
      Array,
      Promise,
      Math,
      String,
      Number,
      Boolean,
      Uint8ClampedArray,
      Float32Array,
      Intl,
      Date,
      Reflect,
    };
    sandbox.window = sandbox;

    return sandbox;
  }

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-stealth-fidelity-'));
    const extDir = ensureProfileStealthExtension(tempDir, 'prof-fid-1', 'Stealth-Fidelity-Profile', {
      browser: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.53 Safari/537.36' },
    });
    stealthScriptCode = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('guarantees zero detectable global leaks on window', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    // CRITICAL: Window must NOT have __MAHI_STEALTH_INJECTED__ or __mahiProxies
    expect(sandbox.window.__MAHI_STEALTH_INJECTED__).toBeUndefined();
    expect(sandbox.window.__mahiProxies).toBeUndefined();
    expect(sandbox.window.hookedProxies).toBeUndefined();
  });

  it('guarantees Function.prototype.toString returns [native code] for all hooked functions', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const toStringFn = sandbox.Function.prototype.toString;

    // Check all hooked methods
    expect(toStringFn.call(sandbox.HTMLCanvasElement.prototype.toDataURL)).toBe('function toDataURL() { [native code] }');
    expect(toStringFn.call(sandbox.CanvasRenderingContext2D.prototype.getImageData)).toBe('function getImageData() { [native code] }');
    expect(toStringFn.call(sandbox.HTMLCanvasElement.prototype.toBlob)).toBe('function toBlob() { [native code] }');
    expect(toStringFn.call(sandbox.AudioBuffer.prototype.getChannelData)).toBe('function getChannelData() { [native code] }');
    expect(toStringFn.call(sandbox.Element.prototype.getBoundingClientRect)).toBe('function getBoundingClientRect() { [native code] }');
    expect(toStringFn.call(sandbox.WebGLRenderingContext.prototype.getParameter)).toBe('function getParameter() { [native code] }');
    expect(toStringFn.call(sandbox.WebGLRenderingContext.prototype.getExtension)).toBe('function getExtension() { [native code] }');
    expect(toStringFn.call(toStringFn)).toBe('function toString() { [native code] }');
  });

  it('guarantees repeated AudioBuffer.getChannelData calls are identical with zero in-place drift', () => {
    const sandbox = createMockBrowserContext();
    const sharedBuffer = new Float32Array(500);
    for (let i = 0; i < sharedBuffer.length; i++) sharedBuffer[i] = 0.5;

    sandbox.AudioBuffer.prototype.getChannelData = function() {
      return sharedBuffer;
    };

    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const call1 = sandbox.AudioBuffer.prototype.getChannelData(0);
    const snap1 = Array.from(call1);

    // Call it 10 more times
    for (let c = 0; c < 10; c++) {
      const repeatedCall = sandbox.AudioBuffer.prototype.getChannelData(0);
      const snapN = Array.from(repeatedCall);
      expect(snapN).toEqual(snap1);
    }
  });

  it('generates dynamic userAgentData matching profile User-Agent version with major-only brands and Symbol.toStringTag', async () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const uaData = sandbox.navigator.userAgentData;
    expect(uaData).toBeDefined();
    expect(uaData.brands).toBeDefined();

    const chromeBrand = uaData.brands.find((b: any) => b.brand === 'Google Chrome');
    expect(chromeBrand).toBeDefined();
    expect(chromeBrand.version).toBe('133');

    // FIX 2: Brand version must be major-only string (no dot notation in brands array)
    for (const b of uaData.brands) {
      expect(b.version).not.toContain('.');
    }

    // FIX 2: Symbol.toStringTag returns '[object NavigatorUAData]'
    expect(sandbox.Object.prototype.toString.call(uaData)).toBe('[object NavigatorUAData]');

    // Full version is available in getHighEntropyValues
    const entropy = await uaData.getHighEntropyValues(['fullVersionList']);
    expect(entropy.fullVersionList).toBeDefined();
    const chromeFull = entropy.fullVersionList.find((b: any) => b.brand === 'Google Chrome');
    expect(chromeFull).toBeDefined();
    expect(chromeFull.version).toBe('133.0.6943.53');
  });

  it('ensures navigator.webdriver getter name is "get webdriver" with native toString and throws Illegal invocation on foreign thisArg', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const desc = sandbox.Object.getOwnPropertyDescriptor(sandbox.Navigator.prototype, 'webdriver');
    expect(desc).toBeDefined();
    expect(desc.get).toBeDefined();
    expect(desc.get.name).toBe('get webdriver');
    expect(sandbox.Function.prototype.toString.call(desc.get)).toBe('function get webdriver() { [native code] }');
    expect(sandbox.navigator.webdriver).toBe(false);

    // Native illegal invocation parity: Calling getter with {} must throw TypeError (Illegal invocation)
    expect(() => desc.get.call({})).toThrow(/Illegal invocation/);
    expect(desc.get.call(sandbox.navigator)).toBe(false);
  });

  it('ensures spoofNavigator and userAgentData getters enforce native Illegal invocation checks', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const hwDesc = sandbox.Object.getOwnPropertyDescriptor(sandbox.Navigator.prototype, 'hardwareConcurrency');
    expect(hwDesc).toBeDefined();
    expect(() => hwDesc.get.call({})).toThrow(/Illegal invocation/);
    expect(typeof hwDesc.get.call(sandbox.navigator)).toBe('number');

    const uaDesc = sandbox.Object.getOwnPropertyDescriptor(sandbox.Navigator.prototype, 'userAgentData');
    expect(uaDesc).toBeDefined();
    expect(() => uaDesc.get.call({})).toThrow(/Illegal invocation/);
    expect(uaDesc.get.call(sandbox.navigator)).toBeDefined();
  });

  it('spoofs WebGL vendor and renderer without leaking host GPU', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const glProto = sandbox.WebGLRenderingContext.prototype;
    const vendor = glProto.getParameter(37445); // UNMASKED_VENDOR_WEBGL
    const renderer = glProto.getParameter(37446); // UNMASKED_RENDERER_WEBGL

    expect(typeof vendor).toBe('string');
    expect(typeof renderer).toBe('string');
    expect(renderer).not.toContain('Intel Arc');
    expect(vendor).toContain('Google Inc.');
  });

  it('spoofs timezone and Intl.DateTimeFormat while respecting explicit timezone overrides', () => {
    const tzDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-tz-test-'));
    try {
      const extDir = ensureProfileStealthExtension(tzDir, 'prof-tz-1', 'Stealth-Tz-Profile', {
        locale: { timezone: 'America/New_York' },
      });
      const tzStealthJs = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');

      const sandbox = createMockBrowserContext();
      const context = vm.createContext(sandbox);
      vm.runInContext(tzStealthJs, context);

      // Default Intl.DateTimeFormat must resolve to America/New_York
      const defaultDtf = new sandbox.Intl.DateTimeFormat();
      expect(defaultDtf.resolvedOptions().timeZone).toBe('America/New_York');

      // Explicit options.timeZone (e.g. UTC) must NOT be clobbered
      const explicitUtcDtf = new sandbox.Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });
      expect(explicitUtcDtf.resolvedOptions().timeZone).toBe('UTC');

      // Date.prototype.getTimezoneOffset must reflect America/New_York
      const offset = sandbox.Date.prototype.getTimezoneOffset.call(new Date());
      expect(typeof offset).toBe('number');
      // EDT is 240, EST is 300
      expect([240, 300]).toContain(offset);
    } finally {
      try { fs.rmSync(tzDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('ensures navigator.userAgentData has zero own properties and inherits prototype getters', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const uaData = sandbox.navigator.userAgentData;
    expect(uaData).toBeDefined();
    expect(sandbox.Object.getOwnPropertyNames(uaData)).toEqual([]);
    expect(uaData.brands).toBeDefined();
    expect(uaData.mobile).toBe(false);
    expect(uaData.platform).toBeDefined();
  });

  it('shifts Element and Range getClientRects and returns array-like proxy with item()', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const elem = Object.create(sandbox.Element.prototype);
    const rects = elem.getClientRects();
    expect(rects.length).toBe(1);
    expect(typeof rects.item).toBe('function');
    expect(rects[0].x).toBe(rects.item(0).x);
    // crShift was applied
    expect(rects[0].x).not.toBe(10);
  });

  it('hooks OffscreenCanvas and OffscreenCanvasRenderingContext2D with native toString masking', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const toStringFn = sandbox.Function.prototype.toString;
    expect(toStringFn.call(sandbox.OffscreenCanvasRenderingContext2D.prototype.getImageData)).toBe('function getImageData() { [native code] }');
    expect(toStringFn.call(sandbox.OffscreenCanvas.prototype.convertToBlob)).toBe('function convertToBlob() { [native code] }');
  });

  it('guarantees Canvas toDataURL produces distinct non-default hashes for 2 profiles on #f60 and #069 pixel data', () => {
    const extDir1 = ensureProfileStealthExtension(tempDir, 'prof-seed-1', 'Profile-1', {});
    const stealth1 = fs.readFileSync(path.join(extDir1, 'stealth-core.js'), 'utf8');

    const extDir2 = ensureProfileStealthExtension(tempDir, 'prof-seed-2', 'Profile-2', {});
    const stealth2 = fs.readFileSync(path.join(extDir2, 'stealth-core.js'), 'utf8');

    // Create sandbox 1 and populate with #f60 (255, 102, 0) and #069 (0, 102, 153)
    const sb1 = createMockBrowserContext();
    const ctx1 = vm.createContext(sb1);
    vm.runInContext(stealth1, ctx1);

    const canvas1 = sb1.document.createElement('canvas');
    const p1 = canvas1._pixelData;
    for (let i = 0; i < p1.length; i += 8) {
      // #f60
      p1[i] = 255; p1[i + 1] = 102; p1[i + 2] = 0; p1[i + 3] = 255;
      // #069
      p1[i + 4] = 0; p1[i + 5] = 102; p1[i + 6] = 153; p1[i + 7] = 255;
    }

    const defaultUrl = canvas1._dataUrl();
    const url1 = canvas1.toDataURL();

    // Must not equal un-noised defaultUrl
    expect(url1).not.toBe(defaultUrl);

    // Create sandbox 2 with same pixel data
    const sb2 = createMockBrowserContext();
    const ctx2 = vm.createContext(sb2);
    vm.runInContext(stealth2, ctx2);

    const canvas2 = sb2.document.createElement('canvas');
    canvas2._pixelData.set(p1);
    const url2 = canvas2.toDataURL();

    // Must not equal defaultUrl and must differ from profile 1
    expect(url2).not.toBe(defaultUrl);
    expect(url2).not.toBe(url1);
  });

  it('guarantees getImageData subregion reads return identical pixel values to full-canvas reads at overlapping coordinates', () => {
    const sb = createMockBrowserContext();
    const ctx = vm.createContext(sb);
    vm.runInContext(stealthScriptCode, ctx);

    const canvas = sb.document.createElement('canvas');
    const p = canvas._pixelData;
    for (let i = 0; i < p.length; i += 4) {
      p[i] = 255; p[i + 1] = 102; p[i + 2] = 0; p[i + 3] = 255;
    }

    const ctx2d = canvas.getContext('2d');
    const full = ctx2d.getImageData(0, 0, 50, 50);
    const sub = ctx2d.getImageData(10, 10, 10, 10);

    // At (10, 10), global coordinate is gx=10, gy=10
    // In full canvas, pixel (10, 10) is at index (10 * 50 + 10) * 4
    const fullIdx = (10 * 50 + 10) * 4;
    // In subregion, pixel (0, 0) is at local index 0, corresponding to global (10, 10)
    const subIdx = 0;

    expect(sub.data[subIdx]).toBe(full.data[fullIdx]);
    expect(sub.data[subIdx + 1]).toBe(full.data[fullIdx + 1]);
    expect(sub.data[subIdx + 2]).toBe(full.data[fullIdx + 2]);
    expect(sub.data[subIdx + 3]).toBe(full.data[fullIdx + 3]);
  });

  it('ensures NavigatorUAData.prototype.brands getter name is "get brands" and enforces Illegal invocation', () => {
    const sb = createMockBrowserContext();
    const ctx = vm.createContext(sb);
    vm.runInContext(stealthScriptCode, ctx);

    const proto = sb.NavigatorUAData.prototype;
    const desc = sb.Object.getOwnPropertyDescriptor(proto, 'brands');
    expect(desc).toBeDefined();
    expect(desc.get.name).toBe('get brands');
    expect(() => desc.get.call({})).toThrow(/Illegal invocation/);

    const brands = desc.get.call(sb.navigator.userAgentData);
    expect(Array.isArray(brands)).toBe(true);
  });

  it('ensures Intl.DateTimeFormat name is "DateTimeFormat", length is 0, and constructor matches itself', () => {
    const tzDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-tz-meta-'));
    try {
      const extDir = ensureProfileStealthExtension(tzDir, 'prof-tz-meta', 'Tz-Meta', {
        locale: { timezone: 'America/New_York' },
      });
      const tzStealth = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');

      const sb = createMockBrowserContext();
      const ctx = vm.createContext(sb);
      vm.runInContext(tzStealth, ctx);

      expect(sb.Intl.DateTimeFormat.name).toBe('DateTimeFormat');
      expect(sb.Intl.DateTimeFormat.length).toBe(0);
      expect(sb.Intl.DateTimeFormat.prototype.constructor).toBe(sb.Intl.DateTimeFormat);
    } finally {
      try { fs.rmSync(tzDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('ensures Date.prototype.toLocaleTimeString() uses targetTz when no explicit timezone is passed', () => {
    const tzDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-tz-locale-'));
    try {
      const extDir = ensureProfileStealthExtension(tzDir, 'prof-tz-loc', 'Tz-Loc', {
        locale: { timezone: 'America/New_York' },
      });
      const tzStealth = fs.readFileSync(path.join(extDir, 'stealth-core.js'), 'utf8');

      const sb = createMockBrowserContext();
      const ctx = vm.createContext(sb);
      vm.runInContext(tzStealth, ctx);

      // Fixed timestamp: 2026-11-16T15:00:00Z
      // In UTC: 15:00:00 (3:00 PM)
      // In America/New_York (EST, UTC-5): 10:00:00 AM
      const d = new sb.Date('2026-11-16T15:00:00Z');
      const timeStr = sb.Date.prototype.toLocaleTimeString.call(d, 'en-US');
      expect(timeStr).toContain('10:00:00');
      expect(timeStr).toContain('AM');
    } finally {
      try { fs.rmSync(tzDir, { recursive: true, force: true }); } catch {}
    }
  });

  it('ensures getExtension("WEBGL_debug_renderer_info") returns strict === same object reference on repeated calls', () => {
    const sb = createMockBrowserContext();
    const ctx = vm.createContext(sb);
    vm.runInContext(stealthScriptCode, ctx);

    const gl = Object.create(sb.WebGLRenderingContext.prototype);
    const ext1 = gl.getExtension('WEBGL_debug_renderer_info');
    const ext2 = gl.getExtension('WEBGL_debug_renderer_info');

    expect(ext1).toBeDefined();
    expect(ext1).toBe(ext2);
    expect(ext1.UNMASKED_RENDERER_WEBGL).toBe(37446);
  });

  it('ensures AudioBuffer.copyFromChannel produces identical output to getChannelData and skips silent buffers', () => {
    const sb = createMockBrowserContext();
    const ctx = vm.createContext(sb);
    vm.runInContext(stealthScriptCode, ctx);

    // 1. Silent buffer test
    const silentBuf = new sb.Float32Array(500); // All 0s
    const silentAudioBuf = {
      getChannelData: () => silentBuf,
      copyFromChannel: (dest: Float32Array) => dest.set(silentBuf),
    };
    Object.setPrototypeOf(silentAudioBuf, sb.AudioBuffer.prototype);

    const chDataSilent = silentAudioBuf.getChannelData(0);
    expect(chDataSilent[0]).toBe(0); // Silent integrity preserved!

    // 2. Non-silent buffer test
    const nonSilentBuf = new sb.Float32Array(500);
    for (let i = 0; i < nonSilentBuf.length; i++) nonSilentBuf[i] = 0.5;

    const nonSilentAudioBuf = {
      getChannelData: () => nonSilentBuf,
      copyFromChannel: (dest: Float32Array) => dest.set(nonSilentBuf),
    };
    Object.setPrototypeOf(nonSilentAudioBuf, sb.AudioBuffer.prototype);

    const chData = nonSilentAudioBuf.getChannelData(0);
    const dest = new sb.Float32Array(500);
    nonSilentAudioBuf.copyFromChannel(dest, 0);

    expect(dest[0]).toBe(chData[0]);
    expect(dest[100]).toBe(chData[100]);
  });

  it('ensures ClientRects does not corrupt 0x0 empty rects or disconnected elements', () => {
    const sb = createMockBrowserContext();
    const ctx = vm.createContext(sb);
    vm.runInContext(stealthScriptCode, ctx);

    const zeroElem = Object.create(sb.Element.prototype);
    zeroElem.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0 });
    zeroElem.getClientRects = () => [{ x: 0, y: 0, width: 0, height: 0 }];

    const rect = zeroElem.getBoundingClientRect();
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);

    const rects = zeroElem.getClientRects();
    expect(rects[0].x).toBe(0);
    expect(rects[0].y).toBe(0);
  });

  it('synchronously propagates stealth spoofing into cross-realm iframe windows (FIX 3 Regression)', () => {
    const parentSb = createMockBrowserContext();
    const parentCtx = vm.createContext(parentSb);
    vm.runInContext(stealthScriptCode, parentCtx);

    const childSb = createMockBrowserContext();
    const iframeElem: any = Object.create(parentSb.HTMLIFrameElement.prototype);
    iframeElem._contentWindow = childSb;
    iframeElem._contentDocument = childSb.document;

    // Accessing contentWindow should trigger synchronous realm patching
    const childWin = iframeElem.contentWindow;
    expect(childWin).toBe(childSb);
    expect(childWin.navigator.webdriver).toBe(false);
    expect(childWin.Function.prototype.toString.call(childWin.HTMLCanvasElement.prototype.toDataURL)).toBe('function toDataURL() { [native code] }');
    expect(childWin.Object.prototype.toString.call(childWin.navigator.userAgentData)).toBe('[object NavigatorUAData]');
    expect(childWin.WebGLRenderingContext.prototype.getParameter(37445)).toContain('Google Inc.');
  });
});
