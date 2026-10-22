import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { Profile } from '../10_CONFIG/shared/types/profile.js';
import { resolveExecutablePath } from './detector.js';
import {
  isManagedEngineInstalled,
  getManagedEngineExecutablePath,
  ensureManagedEngineInstalled,
  isProductionChromiumInstalled,
  getProductionChromiumExecutablePath,
  getBundledEngineExecutablePath,
} from './managed-engine.js';
import {
  MANAGED_ENGINE_VERSION,
  CURRENT_ENGINE_DISTRIBUTION,
  CHROMIUM_PRODUCTION_VERSION,
} from '../10_CONFIG/engine-config.js';
import { getProxyById, getDecryptedProxyCredentials, testAndSaveProxyStatus } from './services/proxy-service.js';
import { getExtensions } from './services/extension-service.js';
import { createProxyTunnel, ProxyTunnelHandle } from './proxy-tunnel.js';
import { getApiAuthToken } from '../08_SECURITY/install-secrets.js';
import { injectNativeStealthPreferences } from './stealth-native-preferences.js';
import { resolveMultiCoreExecutablePath } from './services/multi-core-resolver.js';
import { buildVideoCaptureFlags } from './services/video-capture-service.js';


function debugLog(msg: string) {
  const fn = (globalThis as any).__mahiDebugLog;
  if (fn) fn(msg);
  else console.log(msg);
}

export interface LaunchedProcessInfo {
  process: ChildProcess;
  pid: number;
  profileId: string;
  startedAt: string;
  executablePath: string;
  storageDir: string;
  proxyTunnel?: ProxyTunnelHandle;
}

/**
 * Remove stale lock files left by previous crashed Chromium sessions
 */
function cleanupStaleLocks(storageDir: string): void {
  const lockFiles = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'lockfile',
    'parent.lock',
    'DevToolsActivePort',
  ];

  for (const lockFile of lockFiles) {
    const lockPath = path.join(storageDir, lockFile);
    try {
      if (fs.existsSync(lockPath)) {
        fs.rmSync(lockPath, { force: true, recursive: true });
        debugLog(`[Launcher Step 3/7] Cleaned up stale lock file: ${lockFile}`);
      }
    } catch (err) {
      debugLog(`[Launcher Step 3/7] Warning: Could not remove lock file ${lockFile}: ${err}`);
    }
  }
}

/**
 * Checks if a profile storage directory has saved session data (tabs, windows, history).
 */
export function hasExistingSession(storageDir: string): boolean {
  try {
    const defaultDir = path.join(storageDir, 'Default');
    if (!fs.existsSync(defaultDir)) return false;

    const sessionsDir = path.join(defaultDir, 'Sessions');
    if (fs.existsSync(sessionsDir)) {
      const files = fs.readdirSync(sessionsDir);
      if (files.some((f) => (f.startsWith('Session_') || f.startsWith('Tabs_')) && !f.endsWith('-journal'))) {
        return true;
      }
    }

    const currentSession = path.join(defaultDir, 'Current Session');
    if (fs.existsSync(currentSession)) {
      if (fs.statSync(currentSession).size > 0) return true;
    }

    const historyFile = path.join(defaultDir, 'History');
    if (fs.existsSync(historyFile) && fs.statSync(historyFile).size > 0) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Computes deterministic CDP Remote Debugging Port for a given profile.
 */
export function getProfileDebugPort(profileId: string): number {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = ((hash << 5) - hash) + profileId.charCodeAt(i);
    hash |= 0;
  }
  return 34000 + (Math.abs(hash) % 15000);
}

/**
 * Creates or updates the MAHI Anti-Detect & Fingerprint Guard Extension in the profile directory.

 * Injects deterministic Canvas, WebGL, Audio noise, and removes all automation traces.
 */
export function ensureProfileStealthExtension(
  storageDir: string,
  profileId: string,
  profileName: string,
  settings?: any
): string {
  const extDir = path.join(storageDir, 'mahi_title_extension');
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }


  const numMatch = profileName.match(/\d+/);
  const badgeNumber = numMatch ? numMatch[0] : '1';
  const instanceLabel = numMatch ? `M${numMatch[0]}` : profileName;
  const brandedLabel = `${instanceLabel} — MAHI SKILLS`;

  // Detect platform and device metadata from settings and User-Agent
  const ua = settings?.browser?.userAgent || '';
  const isMac = ua.includes('Macintosh');
  const isMobile = Boolean(
    ua.includes('Android') ||
    ua.includes('Mobile') ||
    settings?.mobile?.enable
  );

  let mobileModel = 'Pixel 8';
  let mobileOsVersion = '14.0.0';
  if (isMobile) {
    const match = ua.match(/Android\s+([0-9.]+)(?:;\s*([^;)]+))?/i);
    if (match) {
      if (match[1]) {
        const parts = match[1].split('.');
        mobileOsVersion = parts.length === 1 ? `${parts[0]}.0.0` : (parts.length === 2 ? `${parts[0]}.${parts[1]}.0` : match[1]);
      }
      if (match[2]) {
        const rawModel = match[2].replace(/\s*Build\/.*$/i, '').trim();
        if (rawModel) {
          mobileModel = rawModel;
        }
      }
    }
  }

  const clientHintsPlatform = isMobile ? 'Android' : (isMac ? 'macOS' : 'Windows');
  const clientHintsMobile = isMobile ? '?1' : '?0';
  const clientHintsModel = isMobile ? mobileModel : '';
  const clientHintsPlatformVersion = isMobile ? mobileOsVersion : (isMac ? '14.5.0' : '15.0.0');
  const clientHintsArch = isMobile ? 'arm' : (isMac ? 'arm' : 'x86');

  // Manifest V3 Extension with declarativeNetRequest Client Hints spoofing
  const manifest = {
    manifest_version: 3,
    name: `${profileName}`,
    version: '2.0.0',
    description: `MAHI BROWSER Anti-Detect & Stealth Guard`,
    permissions: ['tabs', 'activeTab', 'scripting', 'storage', 'declarativeNetRequest'],
    host_permissions: ['<all_urls>', 'http://127.0.0.1:32123/*'],
    background: {
      service_worker: 'background.js',
    },
    action: {
      default_title: `${profileName}`,
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: 'ruleset_1',
          enabled: true,
          path: 'rules.json',
        },
      ],
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['stealth-core.js'],
        run_at: 'document_start',
        world: 'MAIN',
        all_frames: true,
      },
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['content.js'],
        run_at: 'document_start',
        all_frames: true,
      },
    ],
  };

  // Declarative Net Request rules to spoof HTTP request headers:
  // Sec-CH-UA-Platform, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform-Version
  const dnrRules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'sec-ch-ua-platform', operation: 'set', value: `"${clientHintsPlatform}"` },
          { header: 'sec-ch-ua-mobile', operation: 'set', value: clientHintsMobile },
          { header: 'sec-ch-ua-model', operation: 'set', value: `"${clientHintsModel}"` },
          { header: 'sec-ch-ua-platform-version', operation: 'set', value: `"${clientHintsPlatformVersion}"` },
          { header: 'sec-ch-ua-arch', operation: 'set', value: `"${clientHintsArch}"` },
          { header: 'sec-ch-ua-bitness', operation: 'set', value: '"64"' },
        ],
      },
      condition: {
        urlFilter: '*',
        resourceTypes: [
          'main_frame',
          'sub_frame',
          'stylesheet',
          'script',
          'image',
          'font',
          'object',
          'xmlhttprequest',
          'ping',
          'csp_report',
          'media',
          'websocket',
          'other',
        ],
      },
    },
  ];
  const gpuVendor = isMobile ? 'ARM' : (isMac ? 'Google Inc. (Apple)' : 'Google Inc. (NVIDIA)');
  const gpuRenderer = isMobile
    ? 'Mali-G710 MC10'
    : (isMac
      ? 'ANGLE (Apple, Apple M3 Pro, OpenGL 4.1 Metal - 88.1)'
      : 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)');

  const hardwareConcurrency = isMobile ? 8 : (isMac ? 12 : 16);
  const deviceMemory = isMobile ? 8 : 16;
  const platformStr = isMobile ? 'Linux armv8l' : (isMac ? 'MacIntel' : 'Win32');
  const maxTouchPoints = isMobile ? 5 : 0;
  const displayDpr = settings?.display?.deviceScaleFactor || (isMobile ? 2.625 : 1);
  const mobileWidth = settings?.display?.screenWidth || (isMobile ? 412 : 1920);
  const mobileHeight = settings?.display?.screenHeight || (isMobile ? 915 : 1080);

  // 1. Stealth Core Script (Runs in MAIN world at document_start)
  const stealthCoreJs = `
(function() {
  'use strict';
  if (window.__MAHI_STEALTH_INJECTED__) return;
  window.__MAHI_STEALTH_INJECTED__ = true;

  var pSeed = (function(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 12345;
  })(${JSON.stringify(profileId + '_' + profileName)});

  // -------------------------------------------------------------
  // 1. Automation & WebDriver Masking
  // -------------------------------------------------------------
  try {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
      get: function() { return false; },
      enumerable: true,
      configurable: true
    });
  } catch(e) {}

  // Remove Chromedriver / automation artifacts
  try {
    var cdcKeys = ['cdc_adoQpoasnfa76pfcZLmcfl_Array', 'cdc_adoQpoasnfa76pfcZLmcfl_Promise', 'cdc_adoQpoasnfa76pfcZLmcfl_Symbol'];
    cdcKeys.forEach(function(k) { delete window[k]; });
  } catch(e) {}

  // Chrome Runtime Mocking
  try {
    if (!window.chrome) { window.chrome = {}; }
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        connect: function() {},
        sendMessage: function() {},
        id: undefined
      };
    }
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        runningState: function() { return 'cannot_run'; }
      };
    }
  } catch(e) {}

  // -------------------------------------------------------------
  // 2. Hardware Navigator Overrides
  // -------------------------------------------------------------
  if (!window.__mahiProxies) window.__mahiProxies = [];
  try {
    function spoofNavigator(prop, value) {
      var desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      if (!desc) return;
      var proxy = new Proxy(desc.get, {
        apply: function() { return value; }
      });
      Object.defineProperty(Navigator.prototype, prop, {
        get: proxy,
        enumerable: desc.enumerable,
        configurable: desc.configurable
      });
      window.__mahiProxies.push({ p: proxy, o: desc.get, n: 'get ' + prop });
    }

    spoofNavigator('hardwareConcurrency', ${hardwareConcurrency});
    spoofNavigator('deviceMemory', ${deviceMemory});
    spoofNavigator('platform', ${JSON.stringify(platformStr)});
    spoofNavigator('maxTouchPoints', ${maxTouchPoints});

    // -------------------------------------------------------------
    // User-Agent Client Hints (navigator.userAgentData) Native Masking
    // -------------------------------------------------------------
    try {
      var brandVersion = "138";
      var chromeFullVer = "138.0.7204.183";
      var defaultBrands = [
        { brand: "Not/A)Brand", version: "8" },
        { brand: "Chromium", version: brandVersion },
        { brand: "Google Chrome", version: brandVersion }
      ];
      var defaultFullVersionList = [
        { brand: "Not/A)Brand", version: "8.0.0.0" },
        { brand: "Chromium", version: chromeFullVer },
        { brand: "Google Chrome", version: chromeFullVer }
      ];

      var chPlatform = ${JSON.stringify(clientHintsPlatform)};
      var chMobile = ${isMobile ? 'true' : 'false'};
      var chModel = ${JSON.stringify(clientHintsModel)};
      var chPlatformVersion = ${JSON.stringify(clientHintsPlatformVersion)};
      var chArch = ${JSON.stringify(clientHintsArch)};
      var chBitness = "64";

      var uaDataObj = {
        brands: defaultBrands,
        mobile: chMobile,
        platform: chPlatform,
        getHighEntropyValues: function(hints) {
          var res = {
            brands: defaultBrands,
            mobile: chMobile,
            platform: chPlatform
          };
          if (!Array.isArray(hints)) return Promise.resolve(res);
          for (var i = 0; i < hints.length; i++) {
            var h = hints[i];
            if (h === 'architecture') res.architecture = chArch;
            if (h === 'bitness') res.bitness = chBitness;
            if (h === 'model') res.model = chModel;
            if (h === 'platformVersion') res.platformVersion = chPlatformVersion;
            if (h === 'uaFullVersion') res.uaFullVersion = chromeFullVer;
            if (h === 'fullVersionList') res.fullVersionList = defaultFullVersionList;
          }
          return Promise.resolve(res);
        },
        toJSON: function() {
          return {
            brands: defaultBrands,
            mobile: chMobile,
            platform: chPlatform
          };
        }
      };

      var origUaDataDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgentData');
      var proxyUaData = new Proxy(origUaDataDesc && origUaDataDesc.get ? origUaDataDesc.get : function() { return uaDataObj; }, {
        apply: function() { return uaDataObj; }
      });

      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: proxyUaData,
        enumerable: true,
        configurable: true
      });

      if (window.NavigatorUAData) {
        try {
          window.NavigatorUAData.prototype.getHighEntropyValues = uaDataObj.getHighEntropyValues;
          window.NavigatorUAData.prototype.toJSON = uaDataObj.toJSON;
        } catch(e) {}
      }

      window.__mahiProxies.push({ p: proxyUaData, o: origUaDataDesc ? origUaDataDesc.get : proxyUaData, n: 'get userAgentData' });
    } catch(e) {}

    if (${isMobile}) {
      try {
        if (!('ontouchstart' in window)) {
          window.ontouchstart = null;
        }
        Object.defineProperty(window, 'devicePixelRatio', {
          get: function() { return ${displayDpr}; },
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(screen, 'width', {
          get: function() { return ${mobileWidth}; },
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(screen, 'height', {
          get: function() { return ${mobileHeight}; },
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(screen, 'availWidth', {
          get: function() { return ${mobileWidth}; },
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(screen, 'availHeight', {
          get: function() { return ${mobileHeight}; },
          configurable: true,
          enumerable: true
        });
      } catch(e) {}
    }
  } catch(e) {}

  // -------------------------------------------------------------
  // 3. Canvas Dynamic Hash Perturbation (Stealth Canvas Noise)
  // -------------------------------------------------------------
  try {
    const shiftVal = (pSeed % 3) - 1 || 1;
    
    function applyNoise(imgData) {
      var data = imgData.data;
      var step = Math.max(16, (imgData.width * imgData.height) >> 4);
      for (var i = 0; i < data.length; i += step) {
        data[i] = Math.min(255, Math.max(0, data[i] + shiftVal));
      }
      return imgData;
    }

    var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    var proxyToDataURL = new Proxy(origToDataURL, {
      apply: function(target, thisArg, argumentsList) {
        try {
          if (thisArg.width > 0 && thisArg.height > 0) {
            var clone = document.createElement('canvas');
            clone.width = thisArg.width;
            clone.height = thisArg.height;
            var ctx = clone.getContext('2d');
            ctx.drawImage(thisArg, 0, 0);
            var imgData = ctx.getImageData(0, 0, clone.width, clone.height);
            ctx.putImageData(applyNoise(imgData), 0, 0);
            return target.apply(clone, argumentsList);
          }
        } catch(e) {}
        return target.apply(thisArg, argumentsList);
      }
    });
    HTMLCanvasElement.prototype.toDataURL = proxyToDataURL;
    
    var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    var proxyGetImageData = new Proxy(origGetImageData, {
      apply: function(target, thisArg, argumentsList) {
        var imgData = target.apply(thisArg, argumentsList);
        try {
          if (imgData.width > 8 && imgData.height > 8) {
            imgData = applyNoise(imgData);
          }
        } catch(e) {}
        return imgData;
      }
    });
    CanvasRenderingContext2D.prototype.getImageData = proxyGetImageData;

    // Mask toString for native appearance
    if (!window.__mahiProxies) window.__mahiProxies = [];
    window.__mahiProxies.push({ p: proxyToDataURL, o: origToDataURL, n: 'toDataURL' });
    window.__mahiProxies.push({ p: proxyGetImageData, o: origGetImageData, n: 'getImageData' });
    
    var origToString = Function.prototype.toString;
    var proxyToString = new Proxy(origToString, {
      apply: function(target, thisArg, argumentsList) {
        if (thisArg === origToString || thisArg === proxyToString) {
          return 'function toString() { [native code] }';
        }
        for (var i = 0; i < window.__mahiProxies.length; i++) {
          var item = window.__mahiProxies[i];
          if (thisArg === item.p || thisArg === item.o) {
            return 'function ' + item.n + '() { [native code] }';
          }
        }
        return target.apply(thisArg, argumentsList);
      }
    });
    Function.prototype.toString = proxyToString;
  } catch(e) {}

  // -------------------------------------------------------------
  // 4. WebGL GPU Hardware & Renderer Spoofing
  // -------------------------------------------------------------
  try {
    var spoofVendor = ${JSON.stringify(gpuVendor)};
    var spoofRenderer = ${JSON.stringify(gpuRenderer)};

    var hookWebGL = function(proto) {
      var origGetParam = proto.getParameter;
      proto.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 37445) return spoofVendor;
        // UNMASKED_RENDERER_WEBGL
        if (param === 37446) return spoofRenderer;
        // VENDOR
        if (param === 7936) return 'WebKit';
        // RENDERER
        if (param === 7937) return 'WebKit WebGL';
        return origGetParam.apply(this, arguments);
      };

      var origGetExtension = proto.getExtension;
      proto.getExtension = function(name) {
        var ext = origGetExtension.apply(this, arguments);
        if (name === 'WEBGL_debug_renderer_info' && ext) {
          return {
            UNMASKED_VENDOR_WEBGL: 37445,
            UNMASKED_RENDERER_WEBGL: 37446
          };
        }
        return ext;
      };
    };

    if (window.WebGLRenderingContext) hookWebGL(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) hookWebGL(WebGL2RenderingContext.prototype);
  } catch(e) {}

  // -------------------------------------------------------------
  // 5. AudioContext Acoustic Frequency Jitter
  // -------------------------------------------------------------
  try {
    if (window.AudioBuffer) {
      var origGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(channel) {
        var buffer = origGetChannelData.apply(this, arguments);
        var offset = ((pSeed % 7) + 1) * 0.0000001;
        for (var i = 0; i < buffer.length; i += 100) {
          buffer[i] += offset;
        }
        return buffer;
      };
    }
  } catch(e) {}
})();
`;

  // 2. Background Service Worker: Connects to local SSE stream & dispatches to all tabs
  const backgroundJs = `
(function() {
  var profileId = ${JSON.stringify(profileId)};
  var API_BASE = 'http://127.0.0.1:32123';
  var AUTH_TOKEN = ${JSON.stringify(getApiAuthToken())};
  var activePorts = new Set();

  chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === 'mahi_sync_port') {
      activePorts.add(port);
      port.onMessage.addListener(function(msg) {
        if (msg && msg.type === 'BROADCAST_SYNC_ACTION') {
          fetch(API_BASE + '/sync/broadcast?token=' + AUTH_TOKEN, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + AUTH_TOKEN
            },
            body: JSON.stringify({
              sourceProfileId: profileId,
              action: msg.action
            })
          }).catch(function() {});
        }
      });

      port.onDisconnect.addListener(function() {
        activePorts.delete(port);
      });
    }
  });

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg && msg.type === 'QUICK_SWITCH' && msg.number) {
      fetch(API_BASE + '/profiles/quick-switch?token=' + encodeURIComponent(AUTH_TOKEN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + AUTH_TOKEN
        },
        body: JSON.stringify({ number: msg.number })
      }).catch(function() {});
    }
  });

  function connectSSE() {
    try {
      var url = API_BASE + '/sync/events?profileId=' + encodeURIComponent(profileId) + '&token=' + AUTH_TOKEN;
      fetch(url).then(function(response) {
        if (!response.body) return;
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function readChunk() {
          reader.read().then(function(result) {
            if (result.done) {
              setTimeout(connectSSE, 1500);
              return;
            }
            buffer += decoder.decode(result.value, { stream: true });
            var parts = buffer.split('\\n\\n');
            buffer = parts.pop();

            for (var i = 0; i < parts.length; i++) {
              var line = parts[i].trim();
              if (line.startsWith('data:')) {
                var jsonStr = line.slice(5).trim();
                try {
                  var action = JSON.parse(jsonStr);
                  if (action && action.type === 'START_WARMUP' && action.payload && Array.isArray(action.payload.sites)) {
                    if (!action.payload.profileId || action.payload.profileId === profileId) {
                      startWarmerSequence(action.payload.sites);
                    }
                  } else if (action && action.type && action.type !== 'CONNECTED') {
                    // Forward to all active connected ports
                    activePorts.forEach(function(p) {
                      try { p.postMessage(action); } catch(e) { activePorts.delete(p); }
                    });
                    // Fallback to tabs message
                    chrome.tabs.query({}, function(tabs) {
                      if (tabs) {
                        for (var j = 0; j < tabs.length; j++) {
                          if (tabs[j].id) {
                            chrome.tabs.sendMessage(tabs[j].id, action).catch(function() {});
                          }
                        }
                      }
                    });
                  }
                } catch(err) {}
              }
            }
            readChunk();
          }).catch(function() {
            setTimeout(connectSSE, 1500);
          });
        }
        readChunk();
      }).catch(function() {
        setTimeout(connectSSE, 2500);
      });
    } catch(e) {
      setTimeout(connectSSE, 2500);
    }
  }

  // Automated Profile Warmer / Cookie Farmer
  function checkWarmerQueue() {
    fetch(API_BASE + '/profiles/' + encodeURIComponent(profileId) + '/warmer-queue?token=' + AUTH_TOKEN)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.success && Array.isArray(d.sites) && d.sites.length > 0) {
          startWarmerSequence(d.sites);
        }
      }).catch(function() {});
  }

  function startWarmerSequence(sites) {
    if (!sites || sites.length === 0) return;
    var idx = 0;

    function navigateNext() {
      if (idx >= sites.length) return;
      var targetUrl = sites[idx];
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tabId = (tabs && tabs[0]) ? tabs[0].id : null;
        if (!tabId) {
          chrome.tabs.query({}, function(allTabs) {
            if (allTabs && allTabs[0]) {
              chrome.tabs.update(allTabs[0].id, { url: targetUrl });
            }
          });
        } else {
          chrome.tabs.update(tabId, { url: targetUrl });
        }
        idx++;
        if (idx < sites.length) {
          setTimeout(navigateNext, 3800);
        }
      });
    }

    setTimeout(navigateNext, 500);
  }

  connectSSE();
  setTimeout(checkWarmerQueue, 1500);
  setTimeout(checkWarmerQueue, 3500);

  try {
    if (chrome.action) {
      chrome.action.setBadgeText({ text: '#' + pNum });
      chrome.action.setBadgeBackgroundColor({ color: '#0284c7' });
      chrome.action.setTitle({ title: '#' + pNum + ' - ' + pName });
    }
  } catch(e) {}
})();
`;

  // 3. Content script for Profile Pill, Shortcut switch & Tab-level Action Sync
  const contentJs = `
(function() {
  var pId = ${JSON.stringify(profileId)};
  var pName = ${JSON.stringify(profileName)};
  var pNum = ${JSON.stringify(badgeNumber)};
  var brandedLabel = '[#' + pNum + ' ' + pName + ']';

  var colorPalette = [
    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  ];
  var profileColor = colorPalette[(Math.max(1, parseInt(pNum, 10)) - 1) % colorPalette.length] || colorPalette[0];

  // Stealth script is already registered in manifest content_scripts world: MAIN at document_start

  function updateTitle() {
    try {
      var prefix = brandedLabel + ' ';
      if (document.title && !document.title.startsWith(prefix)) {
        var cleanTitle = document.title
          .replace(/^\\[#\\d+\\s+[^\\s\\]]+\\]\\s*/, '')
          .replace(/^M\\d+\\s+—\\s+MAHI SKILLS\\s*-\\s*/, '');
        document.title = prefix + cleanTitle;
      }
    } catch(e) {}
  }

  try {
    updateTitle();
    var observer = new MutationObserver(updateTitle);
    observer.observe(document.querySelector('head') || document.documentElement, {
      subtree: true,
      characterData: true,
      childList: true
    });
  } catch(e) {}

  function injectTopBarPill() {
    try {
      if (document.getElementById('__mahi_pill_host')) return;
      var host = document.createElement('div');
      host.id = '__mahi_pill_host';
      host.style.cssText = 'all:initial !important;position:fixed;top:0;right:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
      var shadow = host.attachShadow ? host.attachShadow({ mode: 'closed' }) : host;

      var pill = document.createElement('div');
      pill.innerHTML = '<span style="background:rgba(0,0,0,0.35);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:900;letter-spacing:0.5px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.3);">#' + pNum + '</span><span>' + pName + '</span>';
      pill.style.cssText = 'position:fixed;top:12px;right:20px;z-index:2147483647;' +
        'background:' + profileColor + ';' +
        'color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
        'font-size:12px;font-weight:800;letter-spacing:0.3px;padding:6px 14px;border-radius:24px;' +
        'box-shadow:0 6px 20px rgba(0,0,0,0.5),0 0 0 2px rgba(255,255,255,0.3);' +
        'pointer-events:auto;cursor:pointer;user-select:none;opacity:0.96;transition:all 0.2s ease;' +
        'display:flex;align-items:center;gap:7px;backdrop-filter:blur(6px);';
      pill.title = 'MAHI Profile #' + pNum + ' (' + pName + ') - Click to minimize';
      var isMin = false;
      pill.onclick = function(ev) {
        ev.stopPropagation();
        isMin = !isMin;
        if (isMin) {
          pill.innerHTML = '<span style="font-weight:900;font-size:11px;">#' + pNum + '</span>';
          pill.style.padding = '4px 10px';
        } else {
          pill.innerHTML = '<span style="background:rgba(0,0,0,0.35);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:900;letter-spacing:0.5px;">#' + pNum + '</span><span>' + pName + '</span>';
          pill.style.padding = '6px 14px';
        }
      };
      shadow.appendChild(pill);
      (document.body || document.documentElement).appendChild(host);
    } catch(e) {}
  }
  // In clean production mode, suppress the in-page badge unless explicitly enabled in settings.
  // Window/tab title is always cleanly prefixed via updateTitle().
  var enableInPageBadge = ${JSON.stringify((settings?.browser as any)?.showProfileBadge === true)};
  if (enableInPageBadge) {
    window.addEventListener('load', injectTopBarPill);
    setTimeout(injectTopBarPill, 400);
    setTimeout(injectTopBarPill, 1200);
    setInterval(injectTopBarPill, 800);
  }


  // Quick Profile Switch / Launch (Space + Number, Shift + Number, or Number + Space)

  var digitBuffer = '';
  var bufferTimer = null;
  var isSpaceDown = false;

  window.addEventListener('keydown', function(e) {
    try {
      var activeEl = document.activeElement;
      var tag = activeEl ? (activeEl.tagName || '').toUpperCase() : '';
      var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (activeEl && activeEl.isContentEditable);
      if (isInput) {
        digitBuffer = '';
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        isSpaceDown = true;
      }

      var digitMatch = (e.code && e.code.match(/^Digit([0-9])$/)) || (e.code && e.code.match(/^Numpad([0-9])$/));
      if (digitMatch && (isSpaceDown || e.shiftKey)) {
        e.preventDefault();
        var quickNum = parseInt(digitMatch[1], 10);
        if (quickNum > 0) {
          digitBuffer = '';
          chrome.runtime.sendMessage({ type: 'QUICK_SWITCH', number: quickNum }).catch(function() {});
          return;
        }
      }

      if (e.key >= '0' && e.key <= '9') {
        digitBuffer += e.key;
        clearTimeout(bufferTimer);
        bufferTimer = setTimeout(function() { digitBuffer = ''; }, 1200);
        return;
      }

      if ((e.key === ' ' || e.code === 'Space') && digitBuffer.length > 0) {
        e.preventDefault();
        var num = parseInt(digitBuffer, 10);
        digitBuffer = '';
        clearTimeout(bufferTimer);
        if (!isNaN(num) && num > 0) {
          chrome.runtime.sendMessage({ type: 'QUICK_SWITCH', number: num }).catch(function() {});
        }
        return;
      }

      digitBuffer = '';
    } catch(err) {}
  }, true);

  window.addEventListener('keyup', function(e) {
    if (e.key === ' ' || e.code === 'Space') {
      isSpaceDown = false;
    }
  }, true);

  // -------------------------------------------------------------
  // 4. Multi-Window Real-Time Action Synchronizer Engine
  // -------------------------------------------------------------
  var isHandlingRemoteAction = false;
  var API_BASE = 'http://127.0.0.1:32123';
  var AUTH_TOKEN = ${JSON.stringify(getApiAuthToken())};

  function showClickRipple(x, y) {
    try {
      var ripple = document.createElement('div');
      ripple.style.cssText = 'position:fixed;left:' + (x - 14) + 'px;top:' + (y - 14) + 'px;' +
        'width:28px;height:28px;border-radius:50%;border:2.5px solid #ef4444;background:rgba(239,68,68,0.35);' +
        'box-shadow:0 0 12px #ef4444;pointer-events:none;z-index:2147483647;transition:all 0.4s ease-out;';
      (document.body || document.documentElement).appendChild(ripple);
      setTimeout(function() {
        ripple.style.transform = 'scale(2.2)';
        ripple.style.opacity = '0';
      }, 20);
      setTimeout(function() { ripple.remove(); }, 450);
    } catch(e) {}
  }

  function handleReplicatedAction(action) {
    if (!action || !action.type) return;
    isHandlingRemoteAction = true;

    try {
      if (action.type === 'CLICK' && action.payload) {
        var cx = action.payload.xRatio * (window.innerWidth || 1920);
        var cy = action.payload.yRatio * (window.innerHeight || 1080);
        showClickRipple(cx, cy);

        var el = document.elementFromPoint(cx, cy);
        if (el) {
          var target = el.closest('a, button, input, select, textarea, [role="button"], label') || el;
          try { target.focus(); } catch(e) {}

          var pDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var mDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var pUp = new MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var mUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });
          var clk = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: action.payload.button || 0, view: window });

          try { target.dispatchEvent(pDown); } catch(e) {}
          try { target.dispatchEvent(mDown); } catch(e) {}
          try { target.dispatchEvent(pUp); } catch(e) {}
          try { target.dispatchEvent(mUp); } catch(e) {}
          try { target.dispatchEvent(clk); } catch(e) {}

          if (target.tagName === 'A' && target.href && !target.target) {
            try { window.location.href = target.href; } catch(e) {}
          }
        }
      } else if (action.type === 'TYPE' && action.payload) {
        var targetEl = document.activeElement;
        if (!targetEl || (targetEl.tagName !== 'INPUT' && targetEl.tagName !== 'TEXTAREA' && !targetEl.isContentEditable)) {
          if (action.payload.name) targetEl = document.querySelector('[name="' + action.payload.name + '"]');
          if (!targetEl && action.payload.id) targetEl = document.getElementById(action.payload.id);
          if (!targetEl) targetEl = document.querySelector('textarea, input[type="search"], input[type="text"], input:not([type="hidden"])');
        }
        if (targetEl && action.payload.value !== undefined) {
          try { targetEl.focus(); } catch(e) {}
          try {
            var isTxt = targetEl.tagName === 'TEXTAREA';
            var proto = isTxt ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            var setter = Object.getOwnPropertyDescriptor(proto, 'value');
            if (setter && setter.set) {
              setter.set.call(targetEl, action.payload.value);
            } else {
              targetEl.value = action.payload.value;
            }
          } catch(e) {
            targetEl.value = action.payload.value;
          }
          targetEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          targetEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          try {
            targetEl.dispatchEvent(new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              composed: true,
              data: action.payload.value,
              inputType: 'insertText'
            }));
          } catch(e) {}
        }
      } else if (action.type === 'KEY' && action.payload) {
        var keyTarget = document.activeElement || document.querySelector('textarea, input:not([type="hidden"])');
        if (keyTarget) {
          var kDown = new KeyboardEvent('keydown', {
            key: action.payload.key || 'Enter',
            code: action.payload.code || 'Enter',
            keyCode: action.payload.keyCode || 13,
            which: action.payload.keyCode || 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          var kUp = new KeyboardEvent('keyup', {
            key: action.payload.key || 'Enter',
            code: action.payload.code || 'Enter',
            keyCode: action.payload.keyCode || 13,
            which: action.payload.keyCode || 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          keyTarget.dispatchEvent(kDown);
          keyTarget.dispatchEvent(kUp);
          if ((action.payload.key === 'Enter' || action.payload.keyCode === 13) && keyTarget.form) {
            try {
              if (typeof keyTarget.form.requestSubmit === 'function') keyTarget.form.requestSubmit();
              else keyTarget.form.submit();
            } catch(e) {}
          }
        }
      } else if (action.type === 'SCROLL' && action.payload) {
        var targetScroll = action.payload.scrollYRatio * (document.documentElement.scrollHeight || 1);
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else if (action.type === 'NAVIGATE' && action.payload && action.payload.url) {
        if (window.location.href !== action.payload.url) {
          window.location.replace(action.payload.url);
        }
      } else if (action.type === 'START_WARMUP' && action.payload && Array.isArray(action.payload.sites)) {
        if (!action.payload.profileId || action.payload.profileId === pId) {
          var warmData = { sites: action.payload.sites, index: 0 };
          sessionStorage.setItem('__MAHI_WARM_QUEUE__', JSON.stringify(warmData));
          window.location.href = warmData.sites[0];
        }
      }
    } catch(err) {} finally {
      setTimeout(function() { isHandlingRemoteAction = false; }, 80);
    }
  }

  // Dedicated background port connection (100% immune to HTTPS Mixed Content blocks)
  var syncPort = null;
  function connectSyncPort() {
    try {
      syncPort = chrome.runtime.connect({ name: 'mahi_sync_port' });
      syncPort.onMessage.addListener(function(action) {
        handleReplicatedAction(action);
      });
      syncPort.onDisconnect.addListener(function() {
        syncPort = null;
        setTimeout(connectSyncPort, 1000);
      });
    } catch(e) {
      setTimeout(connectSyncPort, 1500);
    }
  }
  connectSyncPort();

  // Also listen to messages from background worker (Dual Channel Backup)
  try {
    chrome.runtime.onMessage.addListener(function(action) {
      handleReplicatedAction(action);
    });
  } catch(e) {}

  // Broadcast user action via background service worker
  function sendSyncAction(type, payload) {
    if (isHandlingRemoteAction) return;
    try {
      if (syncPort) {
        syncPort.postMessage({
          type: 'BROADCAST_SYNC_ACTION',
          action: {
            type: type,
            payload: payload,
            timestamp: Date.now()
          }
        });
      } else {
        chrome.runtime.sendMessage({
          type: 'BROADCAST_SYNC_ACTION',
          action: {
            type: type,
            payload: payload,
            timestamp: Date.now()
          }
        }).catch(function() {});
      }
    } catch(err) {}
  }


  // Capture user clicks
  window.addEventListener('click', function(e) {
    if (isHandlingRemoteAction) return;
    var xRatio = e.clientX / (window.innerWidth || 1);
    var yRatio = e.clientY / (window.innerHeight || 1);
    sendSyncAction('CLICK', { xRatio: xRatio, yRatio: yRatio, button: e.button });
  }, true);

  // Capture user typing
  window.addEventListener('input', function(e) {
    if (isHandlingRemoteAction) return;
    var activeEl = e.target;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      sendSyncAction('TYPE', { value: activeEl.value, name: activeEl.name, id: activeEl.id });
    }
  }, true);

  // Capture user key presses & Enter key submission
  window.addEventListener('keydown', function(e) {
    if (isHandlingRemoteAction) return;
    if (e.key === 'Enter') {
      sendSyncAction('KEY', { key: 'Enter', code: e.code, keyCode: 13 });
    }
  }, true);

  window.addEventListener('keyup', function(e) {
    if (isHandlingRemoteAction) return;
    var activeEl = e.target;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      sendSyncAction('TYPE', { value: activeEl.value, name: activeEl.name, id: activeEl.id });
    }
  }, true);

  // Capture scrolling (throttled)
  var scrollThrottle = null;
  window.addEventListener('scroll', function() {
    if (isHandlingRemoteAction) return;
    if (scrollThrottle) return;
    scrollThrottle = setTimeout(function() {
      scrollThrottle = null;
      var scrollYRatio = window.scrollY / (document.documentElement.scrollHeight || 1);
      sendSyncAction('SCROLL', { scrollYRatio: scrollYRatio });
    }, 120);
  }, { passive: true });


  // -------------------------------------------------------------
  // Live Automated Cookie Warmer & Real Browser Surfing Sequence
  // -------------------------------------------------------------
  try {
    function checkAndRunWarmer() {
      var rawQueue = sessionStorage.getItem('__MAHI_WARM_QUEUE__');
      if (rawQueue) {
        processWarmerQueue(JSON.parse(rawQueue));
      }
    }

    function processWarmerQueue(q) {
      if (!q || !Array.isArray(q.sites) || q.index >= q.sites.length) {
        sessionStorage.removeItem('__MAHI_WARM_QUEUE__');
        return;
      }
      var currentIdx = q.index + 1;
      var total = q.sites.length;
      var targetUrl = q.sites[q.index];

      var hud = document.getElementById('__mahi_warmer_hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = '__mahi_warmer_hud';
        document.documentElement.appendChild(hud);
      }
      hud.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
        'background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);' +
        'color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
        'font-size:13px;font-weight:700;padding:12px 22px;border-radius:18px;' +
        'box-shadow:0 12px 30px rgba(0,0,0,0.6),0 0 0 1px rgba(245,158,11,0.5);' +
        'display:flex;align-items:center;gap:10px;pointer-events:none;';
      hud.innerHTML = '<span style="font-size:18px;">🚜</span> <span>[MAHI WARMER] Farming Site ' + currentIdx + '/' + total + ': <b>' + (window.location.hostname || targetUrl) + '</b></span>';

      setTimeout(function() { window.scrollBy({ top: 350, behavior: 'smooth' }); }, 800);
      setTimeout(function() { window.scrollBy({ top: 500, behavior: 'smooth' }); }, 1800);

      q.index++;
      if (q.index < q.sites.length) {
        sessionStorage.setItem('__MAHI_WARM_QUEUE__', JSON.stringify(q));
        setTimeout(function() {
          window.location.href = q.sites[q.index];
        }, 3200);
      } else {
        sessionStorage.removeItem('__MAHI_WARM_QUEUE__');
        setTimeout(function() {
          if (hud) {
            hud.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
            hud.innerHTML = '<span style="font-size:18px;">✅</span> <span>FARMING COMPLETE! All ' + total + ' Sites Visited & Saved to History!</span>';
            setTimeout(function() { hud.remove(); }, 6000);
          }
        }, 1500);
      }
    }

    setTimeout(checkAndRunWarmer, 800);
  } catch(e) {}

})();

`;

  fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(extDir, 'rules.json'), JSON.stringify(dnrRules, null, 2), 'utf8');
  fs.writeFileSync(path.join(extDir, 'stealth-core.js'), stealthCoreJs, 'utf8');
  fs.writeFileSync(path.join(extDir, 'background.js'), backgroundJs, 'utf8');
  fs.writeFileSync(path.join(extDir, 'content.js'), contentJs, 'utf8');
  return extDir;
}

export function ensureProfileTitleExtension(storageDir: string, profileName: string): string {
  return ensureProfileStealthExtension(storageDir, 'default_id', profileName);
}

/**
 * Ensures Chromium profile preferences and baseline marker files are configured
 * for a clean, production-ready browsing launch experience:
 * - Suppresses first-run onboarding, welcome page, and what's new prompts
 * - Suppresses default browser checks and infobars
 * - Suppresses Chrome sign-in promos and sync onboarding
 * - Suppresses Privacy Sandbox intro dialogs
 * - Suppresses metrics and crash report opt-ins
 * - Configures clean session persistence and normal exit recovery
 * - Preserves existing user cookies, sessions, history, and extensions safely.
 */
export function prepareCleanProfilePreferences(
  storageDir: string,
  profileName?: string,
  startupUrl?: string
): void {
  try {
    // 1. First Run marker file suppression:
    // Chromium checks for the existence of "First Run" in the user data dir.
    // Creating this sentinel file tells Chromium the first run flow has already completed.
    const firstRunSentinel = path.join(storageDir, 'First Run');
    if (!fs.existsSync(firstRunSentinel)) {
      try {
        fs.writeFileSync(firstRunSentinel, '', 'utf8');
      } catch {}
    }

    // 2. Prepare Local State (browser-wide preferences)
    const localStatePath = path.join(storageDir, 'Local State');
    let localState: Record<string, any> = {};
    if (fs.existsSync(localStatePath)) {
      try {
        localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
      } catch {
        localState = {};
      }
    }
    if (!localState.browser || typeof localState.browser !== 'object') {
      localState.browser = {};
    }
    localState.browser.has_seen_welcome_page = true;
    localState.browser.enabled_labs_experiments = localState.browser.enabled_labs_experiments || [];

    if (!localState.metrics || typeof localState.metrics !== 'object') {
      localState.metrics = {};
    }
    localState.metrics.reporting_enabled = false;

    try {
      fs.writeFileSync(localStatePath, JSON.stringify(localState, null, 2), 'utf8');
    } catch (lsErr) {
      debugLog(`[Launcher] Note: Could not write Local State: ${lsErr}`);
    }

    // 3. Prepare Default/Preferences (profile-specific preferences)
    const defaultDir = path.join(storageDir, 'Default');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }

    const prefsPath = path.join(defaultDir, 'Preferences');
    let prefs: Record<string, any> = {};
    if (fs.existsSync(prefsPath)) {
      try {
        prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      } catch {
        prefs = {};
      }
    }

    // Browser level: first-run & default browser prompts
    if (!prefs.browser || typeof prefs.browser !== 'object') {
      prefs.browser = {};
    }
    prefs.browser.has_seen_welcome_page = true;
    prefs.browser.check_default_browser = false;
    // Chromium checks this timestamp to decide whether to re-prompt
    prefs.browser.default_browser_infobar_last_declined = prefs.browser.default_browser_infobar_last_declined || 13350000000000000;
    prefs.browser.show_update_promotion_info_bar = false;
    prefs.browser.clear_data = prefs.browser.clear_data || { time_period: 0 };

    // Distribution level: installer/welcome suppressions
    if (!prefs.distribution || typeof prefs.distribution !== 'object') {
      prefs.distribution = {};
    }
    prefs.distribution.import_bookmarks = false;
    prefs.distribution.import_history = false;
    prefs.distribution.import_search_engine = false;
    prefs.distribution.make_chrome_default_for_user = false;
    prefs.distribution.skip_first_run_ui = true;
    prefs.distribution.suppress_first_run_bubble = true;
    prefs.distribution.suppress_first_run_default_browser_prompt = true;

    // Signin & Sync promo suppression
    if (!prefs.signin || typeof prefs.signin !== 'object') {
      prefs.signin = {};
    }
    prefs.signin.allowed = false;

    if (!prefs.sync_promo || typeof prefs.sync_promo !== 'object') {
      prefs.sync_promo = {};
    }
    prefs.sync_promo.show_on_first_run_allowed = false;
    prefs.sync_promo.user_skipped = true;

    // Privacy Sandbox intro suppression
    if (!prefs.privacy_sandbox || typeof prefs.privacy_sandbox !== 'object') {
      prefs.privacy_sandbox = {};
    }
    if (!prefs.privacy_sandbox.m1 || typeof prefs.privacy_sandbox.m1 !== 'object') {
      prefs.privacy_sandbox.m1 = {};
    }
    prefs.privacy_sandbox.m1.consent_decision_made = true;
    prefs.privacy_sandbox.m1.notice_acknowledged = true;
    prefs.privacy_sandbox.m1.row_notice_acknowledged = true;
    prefs.privacy_sandbox.page_learn_more_clicked = true;

    // Session persistence & clean exit
    if (!prefs.session || typeof prefs.session !== 'object') {
      prefs.session = {};
    }
    prefs.session.restore_on_startup = 1; // 1 = RESTORE_LAST_SESSION
    if (startupUrl && (!prefs.session.startup_urls || !Array.isArray(prefs.session.startup_urls) || prefs.session.startup_urls.length === 0)) {
      prefs.session.startup_urls = [startupUrl];
    }

    if (!prefs.profile || typeof prefs.profile !== 'object') {
      prefs.profile = {};
    }
    prefs.profile.exit_type = 'Normal';
    prefs.profile.exited_cleanly = true;
    if (profileName && !prefs.profile.name) {
      prefs.profile.name = profileName;
    }

    // Write back safely without corrupting any other existing preferences
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
    debugLog(`[Launcher] Configured clean profile baseline preferences for: ${storageDir}`);
  } catch (err) {
    debugLog(`[Launcher] Warning: Failed to configure clean profile preferences: ${err}`);
  }
}

/**
 * Ensures Chromium profile preferences are properly configured for full session persistence
 * ("Continue where you left off") and clean exit recovery.
 */
export function prepareSessionPersistence(storageDir: string, profileName?: string, startupUrl?: string): void {
  prepareCleanProfilePreferences(storageDir, profileName, startupUrl);
}

/**
 * Marks profile as exited cleanly when browser stops.
 */
export function markCleanExit(storageDir: string, profileName?: string): void {
  try {
    const prefsPath = path.join(storageDir, 'Default', 'Preferences');
    if (fs.existsSync(prefsPath)) {
      const raw = fs.readFileSync(prefsPath, 'utf8');
      const prefs = JSON.parse(raw);
      if (!prefs.profile || typeof prefs.profile !== 'object') {
        prefs.profile = {};
      }
      prefs.profile.exit_type = 'Normal';
      prefs.profile.exited_cleanly = true;

      if (!prefs.session || typeof prefs.session !== 'object') {
        prefs.session = {};
      }
      prefs.session.restore_on_startup = 1;

      fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
      debugLog(`[Launcher] Clean exit state marked in Preferences for: ${storageDir}`);
    }
  } catch (err) {
    debugLog(`[Launcher] Note during markCleanExit: ${err}`);
  }
}

/**
 * Options for generating sanitized launch arguments.
 */
export interface SanitizedLaunchArgsOptions {
  storageDir: string;
  debugPort: number;
  loadExtensionsArg?: string;
  settings?: any;
  mode?: 'normal' | 'automation';
}

/**
 * Builds clean, audited Chromium launch arguments for production browsing.
 * - Suppresses first-run screens, welcome prompts, and default browser banners
 * - Suppresses search engine choice dialogs and sync promos
 * - Enables session restore and normal exit recovery
 * - Enforces WebRTC IP handling and proxy isolation
 * - Ensures normal user browsing NEVER carries test automation switches (--enable-automation)
 */
export function buildSanitizedLaunchArgs(options: SanitizedLaunchArgsOptions): string[] {
  const { storageDir, debugPort, loadExtensionsArg, settings, mode = 'normal' } = options;

  const args: string[] = [
    `--user-data-dir=${storageDir}`,
    '--new-window',
    `--remote-debugging-port=${debugPort}`,
  ];

  if (loadExtensionsArg) {
    args.push(`--load-extension=${loadExtensionsArg}`);
    args.push(`--disable-extensions-except=${loadExtensionsArg}`);
  }

  // Baseline Clean Production Arguments
  args.push(
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-search-engine-choice-screen',
    '--restore-last-session',
    '--hide-crash-restore-bubble',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--no-service-autorun',
    '--suppress-message-center-popups',
    '--disable-infobars',
    '--disable-features=Translate,OptimizationHints,MediaRouter,ExtensionDeveloperModeWarning,PrivacySandboxSettings4,ChromeForTestingDisclaimer,HttpsFirstMode,HttpsUpgrades'
  );

  // In Normal User Mode, NEVER add test automation switches
  if (mode === 'automation') {
    // Automation mode retains clean flags unless automation script requests specific flags
  }

  // Native Font Masking Mode (--font-masking-mode=1|2|3)
  const isMobileUa = Boolean(
    settings?.browser?.userAgent?.includes('Android') ||
    settings?.browser?.userAgent?.includes('Mobile') ||
    settings?.mobile?.enable
  );

  // Window Dimensions
  let w = settings?.display?.screenWidth || 1280;
  let h = settings?.display?.screenHeight || 800;
  if (isMobileUa) {
    // Elegant phone window dimensions for desktop usage
    w = 460;
    h = 920;
  }
  const hasWindowSizeArg = settings?.browser?.additionalArgs?.some((arg: string) => arg.startsWith('--window-size='));
  if (!hasWindowSizeArg) {
    args.push(`--window-size=${w},${h}`);
  }

  // User Agent
  if (settings?.browser?.userAgent) {
    args.push(`--user-agent=${settings.browser.userAgent}`);
  }

  // Language / Locale
  if (settings?.locale?.language) {
    args.push(`--lang=${settings.locale.language}`);
  }

  // Native Timezone Override (--tz)
  if (settings?.locale?.timezone) {
    args.push(`--tz=${settings.locale.timezone}`);
  }

  args.push(`--font-masking-mode=${isMobileUa ? 1 : 2}`);
  if (isMobileUa) {
    args.push('--enable-features=TouchEvents,MobileViewport');
  }
  args.push('--password-store=basic');

  // WebRTC Leak Prevention
  if (settings?.network?.webrtc === 'disable_non_proxied_udp') {
    args.push('--force-webrtc-ip-handling-policy');
    args.push('--webrtc-ip-handling-policy=disable_non_proxied_udp');
  } else if (settings?.network?.webrtc === 'default_public_interface_only') {
    args.push('--force-webrtc-ip-handling-policy');
    args.push('--webrtc-ip-handling-policy=default_public_interface_only');
  }

  // Hardware Acceleration
  if (settings?.browser?.hardwareAcceleration === false) {
    args.push('--disable-gpu');
  }

  return args;
}

/**
 * Launches an isolated browser instance with full error handling and step-by-step logging.
 */
export async function launchBrowser(profile: Profile, launchOptions?: { mode?: 'normal' | 'automation' }): Promise<LaunchedProcessInfo> {
  debugLog(`=======================================================`);
  debugLog(`[Launcher] Starting launch sequence for profile: "${profile.name}" (ID: ${profile.id})`);

  let proxyTunnel: ProxyTunnelHandle | undefined;

  try {
    // -------------------------------------------------------------
    // Step 1: Resolve Browser Executable Path (Multi-Core Resolution & Managed Engine)
    // -------------------------------------------------------------
    const multiCore = resolveMultiCoreExecutablePath(
      profile.settings?.browser?.userAgent,
      profile.customExecutablePath
    );
    let executablePath: string = multiCore.executablePath;

    // Safeguard: Never spawn 3rd-party proprietary GoLogin Orbita binary which aborts with exit code 403
    if (executablePath && executablePath.toLowerCase().includes('.gologin')) {
      debugLog(`[Launcher Step 1/7 WARNING] Blocked proprietary GoLogin binary "${executablePath}". Switching to authoritative MAHI engine.`);
      executablePath = getBundledEngineExecutablePath() || getProductionChromiumExecutablePath();
    }

    debugLog(`[Launcher Step 1/7] Engine resolved via multi-core matcher (${multiCore.coreType}, matched=${multiCore.isExactVersionMatch}): "${executablePath}"`);

    if (!fs.existsSync(executablePath)) {
      if (CURRENT_ENGINE_DISTRIBUTION === 'CHROMIUM_PRODUCTION' && isProductionChromiumInstalled()) {
        executablePath = getProductionChromiumExecutablePath();
      } else if (isManagedEngineInstalled()) {
        executablePath = getManagedEngineExecutablePath();
      } else {
        const candidatePath = getProductionChromiumExecutablePath();
        if (fs.existsSync(candidatePath)) {
          executablePath = candidatePath;
        } else {
          const bundledCandidate = getBundledEngineExecutablePath();
          if (bundledCandidate && fs.existsSync(bundledCandidate)) {
            executablePath = bundledCandidate;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Step 2: Validate Executable Existence & Access
    // -------------------------------------------------------------
    debugLog(`[Launcher Step 2/7] Verifying browser executable existence...`);
    if (!executablePath || !fs.existsSync(executablePath)) {
      const errMsg = `Browser executable not found at: "${executablePath || 'undefined'}". Please run Engine Repair in Settings or reinstall MAHI Browser.`;
      debugLog(`[Launcher Step 2/7 ERROR] ${errMsg}`);
      throw new Error(errMsg);
    }
    debugLog(`[Launcher Step 2/7] Executable verified successfully.`);

    // -------------------------------------------------------------
    // Step 3: Prepare Storage Directory & Session Persistence
    // -------------------------------------------------------------
    const storageDir = path.resolve(profile.storagePath);
    debugLog(`[Launcher Step 3/7] Preparing profile storage directory: "${storageDir}"...`);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      debugLog(`[Launcher Step 3/7] Created new storage directory.`);
    } else {
      debugLog(`[Launcher Step 3/7] Storage directory exists. Cleaning stale locks from previous sessions...`);
      cleanupStaleLocks(storageDir);
    }

    prepareSessionPersistence(storageDir, profile.name, profile.settings?.browser?.startupUrl);
    const isExistingSession = hasExistingSession(storageDir);
    debugLog(`[Launcher Step 3/7] Session Persistence: Existing session detected = ${isExistingSession}`);

    // -------------------------------------------------------------
    // Step 4: Build Core Chromium Arguments & Isolation Flags
    // -------------------------------------------------------------
    const settings = profile.settings;
    // 100% Native C++ Stealth: Inject verified Orbita schema into Default/Preferences (Zero extension footprint)
    injectNativeStealthPreferences(storageDir, profile, settings);
    const debugPort = getProfileDebugPort(profile.id);

    // Ensure the stealth extension (Client Hints, Canvas/WebGL Guard, Shortcuts) is loaded
    const titleExtDir = ensureProfileStealthExtension(storageDir, profile.id, profile.name, settings);

    // Gather user-enabled extensions
    let profileExtensionPaths: string[] = [];
    try {
      const exts = getExtensions(profile.id);
      profileExtensionPaths = exts
        .filter((e) => e.enabled && e.sourcePath && fs.existsSync(e.sourcePath))
        .map((e) => e.sourcePath);
      debugLog(`[Launcher Step 4/7] Found ${profileExtensionPaths.length} enabled extensions for profile "${profile.name}".`);
    } catch (extErr: any) {
      debugLog(`[Launcher Step 4/7 WARNING] Failed to load profile extensions: ${extErr.message}`);
    }

    const allExtensionPaths = [titleExtDir, ...profileExtensionPaths];
    const loadExtensionsArg = allExtensionPaths.join(',');

    const args = buildSanitizedLaunchArgs({
      storageDir,
      debugPort,
      loadExtensionsArg,
      settings,
      mode: launchOptions?.mode || 'normal',
    });

    // Virtual Video Capture Injection (KYC Facial Verification Bypass)
    const videoCapture = buildVideoCaptureFlags(settings?.fakeVideoCapture);
    if (videoCapture.isValid && videoCapture.flags.length > 0) {
      args.push(...videoCapture.flags);
      debugLog(`[Launcher Step 4/7] Injected virtual camera stream from: ${videoCapture.resolvedPath}`);
    }

    // Native Font Masking Flags (GoLogin Parity)
    if (settings?.fingerprint?.fonts && Array.isArray(settings.fingerprint.fonts) && settings.fingerprint.fonts.length > 0) {
      args.push('--font-masking-mode=1');
      args.push(`--font-masking-list=${settings.fingerprint.fonts.join(';')}`);
      debugLog(`[Launcher Step 4/7] Configured font masking list (${settings.fingerprint.fonts.length} fonts).`);
    }

    debugLog(`[Launcher Step 4/7] Built ${args.length} sanitized production launch arguments.`);

    // -------------------------------------------------------------
    // Step 5: Network & Proxy Configuration (Step 15 Direct Network Contract)
    // -------------------------------------------------------------
    debugLog(`[Launcher Step 5/7] Configuring network and proxy settings...`);
    if (!settings?.network?.directConnection && settings?.network?.proxyId) {
      const proxy = getProxyById(settings.network.proxyId);
      if (proxy) {
        const credentials = getDecryptedProxyCredentials(proxy.id);

        if (credentials?.username && credentials?.password) {
          debugLog(`[Launcher Step 5/7] Running fast proxy health check for ${proxy.host}:${proxy.port}...`);
          try {
            const healthResult = await testAndSaveProxyStatus(proxy.id);
            if (!healthResult.success) {
              throw new Error(healthResult.errorMessage || 'Proxy health check failed');
            }
            debugLog(`[Launcher Step 5/7] Proxy healthy. Actual IP: ${healthResult.ip || 'unknown'} | Country: ${healthResult.countryCode || 'unknown'} | Latency: ${healthResult.latencyMs}ms`);
          } catch (healthErr: any) {
            debugLog(`[Launcher Step 5/7 WARNING] Proxy health check failed: ${healthErr.message}. Attempting tunnel anyway...`);
          }

          proxyTunnel = await createProxyTunnel({
            upstreamHost: proxy.host,
            upstreamPort: proxy.port,
            upstreamProtocol: proxy.protocol,
            username: credentials.username,
            password: credentials.password,
            profileId: profile.id,
          });

          args.push(`--proxy-server=http://127.0.0.1:${proxyTunnel.port}`);
          args.push('--proxy-bypass-list=<-loopback>');
          args.push(`--host-resolver-rules="MAP * 0.0.0.0 , EXCLUDE ${proxy.host}"`);
          args.push('--force-webrtc-ip-handling-policy');
          args.push('--webrtc-ip-handling-policy=disable_non_proxied_udp');
          debugLog(`[Launcher Step 5/7] Authenticating Tunnel ready: 127.0.0.1:${proxyTunnel.port} -> ${proxy.host}:${proxy.port}`);
        } else {
          args.push(`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`);
          args.push('--proxy-bypass-list=<-loopback>');
          args.push(`--host-resolver-rules="MAP * 0.0.0.0 , EXCLUDE ${proxy.host}"`);
          args.push('--force-webrtc-ip-handling-policy');
          args.push('--webrtc-ip-handling-policy=disable_non_proxied_udp');
          debugLog(`[Launcher Step 5/7] Direct Proxy Server: ${proxy.protocol}://${proxy.host}:${proxy.port}`);
        }
      } else {
        debugLog(`[Launcher Step 5/7] Proxy ID ${settings.network.proxyId} not found in database, enforcing direct connection.`);
        args.push('--no-proxy-server');
      }
    } else {
      // Step 15 Direct Network Contract: Profile with NO proxy must strictly enforce direct connection without WPAD
      args.push('--no-proxy-server');
      debugLog(`[Launcher Step 5/7] Direct connection contract enforced (--no-proxy-server).`);
    }

    // Custom Additional Arguments
    if (settings?.browser?.additionalArgs && Array.isArray(settings.browser.additionalArgs)) {
      for (const a of settings.browser.additionalArgs) {
        if (a.trim()) args.push(a.trim());
      }
    }

    // Startup URL or Warmer Queue URLs
    const qFile = path.join(storageDir, 'mahi_warmer_queue.json');
    if (fs.existsSync(qFile)) {
      try {
        const qData = JSON.parse(fs.readFileSync(qFile, 'utf8'));
        if (Array.isArray(qData.sites) && qData.sites.length > 0) {
          for (const sUrl of qData.sites) {
            args.push(sUrl);
          }
          debugLog(`[Launcher Step 5/7] Warming sequence active — opening ${qData.sites.length} authoritative tabs`);
        }
      } catch {}
    } else {
      const startupUrl = settings?.browser?.startupUrl?.trim() || 'about:blank';
      args.push(startupUrl);
      debugLog(`[Launcher Step 5/7] Opening startup URL: ${startupUrl}`);
    }



    // -------------------------------------------------------------
    // Step 6: Spawn Browser Process
    // -------------------------------------------------------------
    debugLog(`[Launcher Step 6/7] Spawning browser executable: ${executablePath}`);
    debugLog(`[Launcher Step 6/7] Target: ${executablePath} | Args count: ${args.length}`);

    // Clean execution environment: Suppress Chromium API keys missing banner
    const browserEnv: Record<string, string | undefined> = {
      ...process.env,
      GOOGLE_API_KEY: 'no',
      GOOGLE_DEFAULT_CLIENT_ID: 'no',
      GOOGLE_DEFAULT_CLIENT_SECRET: 'no',
    };

    const child = spawn(executablePath, args, {
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
      env: browserEnv,
    });

    if (!child.pid) {
      if (proxyTunnel) proxyTunnel.close();
      throw new Error(`Failed to spawn browser process — no PID returned from OS.`);
    }

    debugLog(`[Launcher Step 6/7] Process spawned successfully with PID: ${child.pid}`);

    // -------------------------------------------------------------
    // Step 7: Unref & Return Process Information
    // -------------------------------------------------------------
    try {
      child.unref();
    } catch (unrefErr) {
      debugLog(`[Launcher Step 7/7] Note: child.unref() threw: ${unrefErr}`);
    }

    debugLog(`[Launcher] Launch sequence completed successfully for "${profile.name}" (PID: ${child.pid}).`);
    debugLog(`=======================================================`);

    return {
      process: child,
      pid: child.pid,
      profileId: profile.id,
      startedAt: new Date().toISOString(),
      executablePath,
      storageDir,
      proxyTunnel,
    };
  } catch (err: unknown) {
    if (proxyTunnel) {
      try { proxyTunnel.close(); } catch {}
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    debugLog(`[Launcher CRITICAL ERROR] Failed to launch profile "${profile.name}": ${errorMsg}`);
    debugLog(`=======================================================`);
    throw (err instanceof Error ? err : new Error(errorMsg));
  }
}
