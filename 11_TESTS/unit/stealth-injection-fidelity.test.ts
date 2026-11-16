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

    function HTMLCanvasElement() {}
    HTMLCanvasElement.prototype = {
      toDataURL: function() { return 'data:image/png;base64,mock'; },
      toBlob: function(cb: any) { cb(null); },
    };

    function CanvasRenderingContext2D() {}
    CanvasRenderingContext2D.prototype = {
      getImageData: function() { return { width: 10, height: 10, data: new Uint8ClampedArray(400) }; },
      putImageData: function() {},
      drawImage: function() {},
    };

    function AudioBuffer() {}
    AudioBuffer.prototype = {
      getChannelData: function() { return new Float32Array(500); },
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

    function WebGLRenderingContext() {}
    WebGLRenderingContext.prototype = {
      getParameter: function() { return 'WebKit'; },
      getExtension: function() { return {}; },
    };

    function WebGL2RenderingContext() {}
    WebGL2RenderingContext.prototype = {
      getParameter: function() { return 'WebKit'; },
      getExtension: function() { return {}; },
    };

    const mockDocument = {
      createElement: (tag: string) => ({
        width: 10,
        height: 10,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({ width: 10, height: 10, data: new Uint8ClampedArray(400) }),
          putImageData: () => {},
        }),
      }),
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

  it('generates dynamic userAgentData matching profile User-Agent version', () => {
    const sandbox = createMockBrowserContext();
    const context = vm.createContext(sandbox);
    vm.runInContext(stealthScriptCode, context);

    const uaData = sandbox.navigator.userAgentData;
    expect(uaData).toBeDefined();
    expect(uaData.brands).toBeDefined();

    const chromeBrand = uaData.brands.find((b: any) => b.brand === 'Google Chrome');
    expect(chromeBrand).toBeDefined();
    expect(chromeBrand.version).toBe('133');
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
});
