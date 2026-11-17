import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'rebrowser-playwright-core';
import { Profile } from '../10_CONFIG/shared/types/profile.js';
import { resolveExecutablePath } from './detector.js';
import {
  isManagedEngineInstalled,
  getManagedEngineExecutablePath,
  ensureManagedEngineInstalled,
  isProductionChromiumInstalled,
  getProductionChromiumExecutablePath,
  getBundledEngineExecutablePath,
  hasNativeStealthEngine,
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
import { ensureCamoufoxInstalled } from './services/engine-download-service.js';


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
export function cleanupStaleLocks(storageDir: string): void {
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
  settings?: any,
  options?: { nativeStealthActive?: boolean } | boolean
): string {
  const isNativeStealth = typeof options === 'boolean' ? options : Boolean(options?.nativeStealthActive);
  const extDir = path.join(storageDir, 'mahi_title_extension');
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }


  const safeProfileName = profileName || profileId || 'Profile 1';
  const numMatch = safeProfileName.match(/\d+/);
  const badgeNumber = numMatch ? numMatch[0] : '1';
  const instanceLabel = numMatch ? `M${numMatch[0]}` : safeProfileName;
  const brandedLabel = `${instanceLabel} — MAHI SKILLS`;

  // Detect platform and device metadata from settings, fingerprint and User-Agent
  const ua = settings?.browser?.userAgent || '';
  const fp = settings?.fingerprint || {};
  const isMobile = Boolean(
    ua.includes('Android') ||
    ua.includes('Mobile') ||
    settings?.mobile?.enable
  );
  const isMac = !isMobile && ua.includes('Macintosh');
  const isLinux = !isMobile && !isMac && (ua.includes('Linux') || ua.includes('X11'));
  const isMacArm = isMac && Boolean(fp.isM1 || fp.architecture === 'arm64' || ua.includes('arm64') || ua.includes('aarch64'));

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

  const clientHintsPlatform = isMobile ? 'Android' : (isMac ? 'macOS' : (isLinux ? 'Linux' : 'Windows'));
  const clientHintsMobile = isMobile ? '?1' : '?0';
  const clientHintsModel = isMobile ? mobileModel : '';
  const clientHintsPlatformVersion = isMobile ? mobileOsVersion : (isMac ? '14.5.0' : (isLinux ? '6.5.0' : '15.0.0'));
  const clientHintsArch = isMobile ? 'arm' : (isMac ? (isMacArm ? 'arm' : 'x86') : (isLinux ? 'x86_64' : 'x86'));
  const chromeVerMatch = ua.match(/Chrome\/([0-9.]+)/i);
  const chromeFullVer = chromeVerMatch ? chromeVerMatch[1] : CHROMIUM_PRODUCTION_VERSION;
  const chromeMajorVer = chromeFullVer.split('.')[0] || '138';

  const rawLangs = settings?.locale?.languagesList || settings?.locale?.languages || settings?.locale?.language;
  const languagesList: string[] = Array.isArray(rawLangs)
    ? rawLangs
    : (typeof rawLangs === 'string' && rawLangs.trim().length > 0
      ? rawLangs.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['en-US', 'en']);
  const acceptLanguageHeader = languagesList.map((l: string, idx: number) => idx === 0 ? l : `${l};q=${Math.max(0.1, 1 - idx * 0.1).toFixed(1)}`).join(', ');

  const profileDebugPort = getProfileDebugPort(profileId);

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
    content_scripts: isNativeStealth
      ? [
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['content.js'],
            run_at: 'document_start',
            all_frames: true,
            match_about_blank: true,
            match_origin_as_fallback: true,
          },
        ]
      : [
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['stealth-core.js'],
            run_at: 'document_start',
            world: 'MAIN',
            all_frames: true,
            match_about_blank: true,
            match_origin_as_fallback: true,
          },
          {
            matches: ['http://*/*', 'https://*/*', '<all_urls>'],
            js: ['content.js'],
            run_at: 'document_start',
            all_frames: true,
            match_about_blank: true,
            match_origin_as_fallback: true,
          },
        ],
  };

  const isCamoufox = settings?.browser?.engine === 'camoufox';
  const isEdge = settings?.browser?.engine === 'edge';
  const targetBrandName = isEdge ? 'Microsoft Edge' : 'Google Chrome';

  let secChUaHeader = `"Not/A)Brand";v="8", "Chromium";v="${chromeMajorVer}", "${targetBrandName}";v="${chromeMajorVer}"`;
  let secChUaFullVersionHeader = `"Not/A)Brand";v="8.0.0.0", "Chromium";v="${chromeFullVer}", "${targetBrandName}";v="${chromeFullVer}"`;

  if (fp.clientHints?.brands && Array.isArray(fp.clientHints.brands) && fp.clientHints.brands.length > 0) {
    secChUaHeader = fp.clientHints.brands.map((b: any) => `"${b.brand}";v="${b.version}"`).join(', ');
  }
  if (fp.clientHints?.fullVersionList && Array.isArray(fp.clientHints.fullVersionList) && fp.clientHints.fullVersionList.length > 0) {
    secChUaFullVersionHeader = fp.clientHints.fullVersionList.map((b: any) => `"${b.brand}";v="${b.version}"`).join(', ');
  }

  const dnrRequestHeaders = isCamoufox
    ? [
        { header: 'accept-language', operation: 'set', value: acceptLanguageHeader },
      ]
    : [
        { header: 'sec-ch-ua', operation: 'set', value: secChUaHeader },
        { header: 'sec-ch-ua-full-version-list', operation: 'set', value: secChUaFullVersionHeader },
        { header: 'sec-ch-ua-platform', operation: 'set', value: `"${clientHintsPlatform}"` },
        { header: 'sec-ch-ua-mobile', operation: 'set', value: clientHintsMobile },
        { header: 'sec-ch-ua-model', operation: 'set', value: `"${clientHintsModel}"` },
        { header: 'sec-ch-ua-platform-version', operation: 'set', value: `"${clientHintsPlatformVersion}"` },
        { header: 'sec-ch-ua-arch', operation: 'set', value: `"${clientHintsArch}"` },
        { header: 'sec-ch-ua-bitness', operation: 'set', value: '"64"' },
        { header: 'accept-language', operation: 'set', value: acceptLanguageHeader },
      ];

  // Declarative Net Request rules to spoof HTTP request headers:
  // Sec-CH-UA, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Platform, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform-Version, Accept-Language
  // and block remote CDP debugging port leakage (both 9222 and profile-specific debugPort)
  const dnrRules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: dnrRequestHeaders,
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
    {
      id: 2,
      priority: 2,
      action: {
        type: 'block',
      },
      condition: {
        urlFilter: '||127.0.0.1:9222',
        resourceTypes: [
          'xmlhttprequest',
          'websocket',
          'script',
          'image',
          'sub_frame',
          'other',
        ],
      },
    },
    {
      id: 3,
      priority: 2,
      action: {
        type: 'block',
      },
      condition: {
        urlFilter: `||127.0.0.1:${profileDebugPort}`,
        resourceTypes: [
          'xmlhttprequest',
          'websocket',
          'script',
          'image',
          'sub_frame',
          'other',
        ],
      },
    },
    {
      id: 4,
      priority: 2,
      action: {
        type: 'block',
      },
      condition: {
        urlFilter: `||localhost:${profileDebugPort}`,
        resourceTypes: [
          'xmlhttprequest',
          'websocket',
          'script',
          'image',
          'sub_frame',
          'other',
        ],
      },
    },
  ];

  const gpuSpoofOn = Boolean(fp?.webglVendor && fp?.webglRenderer);
  const gpuVendor   = gpuSpoofOn ? fp.webglVendor   : '';
  const gpuRenderer = gpuSpoofOn ? fp.webglRenderer : '';

  const hardwareConcurrency = fp.hardwareConcurrency || (isMobile ? 8 : (isMac ? (isMacArm ? 12 : 8) : (isLinux ? 8 : 16)));
  const deviceMemory = fp.deviceMemory || (isMobile ? 8 : (isLinux ? 8 : 16));
  const platformStr = isMobile ? 'Linux armv8l' : (isMac ? 'MacIntel' : (isLinux ? 'Linux x86_64' : 'Win32'));
  const maxTouchPoints = fp.maxTouchPoints !== undefined ? fp.maxTouchPoints : (isMobile ? 5 : 0);
  const displayDpr = settings?.display?.deviceScaleFactor || (isMobile ? 2.625 : 1);
  const mobileWidth = settings?.display?.screenWidth || (isMobile ? 412 : 1920);
  const mobileHeight = settings?.display?.screenHeight || (isMobile ? 915 : 1080);
  const targetTimezone = settings?.locale?.timezone || '';
  const canvasMode = fp.canvas || 'noise';
  const audioMode = fp.audio || 'noise';
  const webglMode = fp.webgl || 'noise';
  const clientRectsMode = fp.clientRects || 'noise';
  const webrtcOpt = settings?.network?.webrtc || fp.webrtc || 'default';
  // 1. Stealth Core Script (Runs in MAIN world at document_start)
  const stealthCoreJs = `
(function() {
  'use strict';
  var pSeed = (function(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 12345;
  })(${JSON.stringify(profileId + '_' + profileName)});

  // Closure-scoped native registry for Function.prototype.toString spoofing (never leaks to window)
  var hookedProxies = typeof Map !== 'undefined' ? new Map() : null;
  var hookedProxiesList = hookedProxies ? null : [];
  function registerNative(fn, name) {
    if (typeof fn === 'function') {
      var n = name || fn.name || '';
      try { Object.defineProperty(fn, 'name', { value: n, configurable: true }); } catch (e) {}
      try { Object.defineProperty(fn, 'length', { value: fn.length, configurable: true }); } catch (e) {}
      if (hookedProxies) {
        hookedProxies.set(fn, n);
      } else if (hookedProxiesList) {
        hookedProxiesList.push({ fn: fn, name: n });
      }
    }
  }
  function lookupNativeName(fn) {
    if (hookedProxies) {
      return hookedProxies.get(fn);
    }
    if (hookedProxiesList) {
      for (var i = 0; i < hookedProxiesList.length; i++) {
        if (fn === hookedProxiesList[i].fn) return hookedProxiesList[i].name;
      }
    }
    return void 0;
  }

  // Universal Function.prototype.toString Masking
  try {
    var origToString = Function.prototype.toString;
    var proxyToString = new Proxy(origToString, {
      apply: function(target, thisArg, argumentsList) {
        if (thisArg === origToString || thisArg === proxyToString) {
          return 'function toString() { [native code] }';
        }
        var foundName = lookupNativeName(thisArg);
        if (foundName !== undefined) {
          return 'function ' + foundName + '() { [native code] }';
        }
        return target.apply(thisArg, argumentsList);
      }
    });
    Function.prototype.toString = proxyToString;
    registerNative(proxyToString, 'toString');
  } catch(e) {}

  // Shared Stealth Configuration & Perturbation Primitives
  var seedOffset = (pSeed % 15) + 1;
  function applyNoiseToImageData(imgData, sx, sy, canvasWidth, canvasHeight) {
    if (!imgData || !imgData.data) return imgData;
    var sw = imgData.width;
    var sh = imgData.height;
    var cw = canvasWidth || sw;
    var ch = canvasHeight || sh;
    if (cw <= 8 || ch <= 8 || sw <= 8 || sh <= 8) return imgData;
    var data = imgData.data;
    var startX = sx || 0;
    var startY = sy || 0;

    for (var y = 0; y < sh; y++) {
      var gy = startY + y;
      for (var x = 0; x < sw; x++) {
        var gx = startX + x;
        var _h = Math.imul(gx + 0x9E3779B9, 0x85EBCA6B) ^
                 Math.imul(gy + pSeed, 0xC2B2AE35) ^ seedOffset;
        _h ^= _h >>> 15; _h = Math.imul(_h, 0x2545F491);
        _h ^= _h >>> 13;
        if ((_h & 127) === 0) {
          var dataIdx = (y * sw + x) * 4;
          if (data[dataIdx + 3] === 0) continue;
          var chIdx = (pSeed + gx + gy) % 3;
          data[dataIdx + chIdx] ^= 1;
        }
      }
    }
    return imgData;
  }

  function getTzOffset(date, tz) {
    try {
      var formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false, hourCycle: 'h23'
      });
      var parts = formatter.formatToParts(date);
      var map = {};
      for (var pIdx = 0; pIdx < parts.length; pIdx++) map[parts[pIdx].type] = parseInt(parts[pIdx].value, 10);
      var tzHour = map.hour === 24 ? 0 : map.hour;
      var tzDate = Date.UTC(map.year, map.month - 1, map.day, tzHour, map.minute, map.second);
      var utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
      return Math.round((utcDate - tzDate) / 60000);
    } catch(e) {
      return 0;
    }
  }

  var brandVersion = ${JSON.stringify(chromeMajorVer)};
  var chromeFullVer = ${JSON.stringify(chromeFullVer)};
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
  var targetTz = ${JSON.stringify(targetTimezone)};
  var mahiTzApplied = false;

  // Synchronous Cross-Realm <iframe> Hooking & Comprehensive Stealth Propagation
  try {
    var patchedWindows = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var patchedFramesRealms = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var patchRealm = function(targetWin, depth) {
      if (!targetWin || (patchedWindows && patchedWindows.has(targetWin))) return;
      if (depth && depth > 1) return;
      var nextDepth = (depth || 0) + 1;
      try {
        if (patchedWindows) patchedWindows.add(targetWin);

        // 1. Function.prototype.toString native masking for targetWin
        if (targetWin.Function && targetWin.Function.prototype) {
          var frameOrigToString = targetWin.Function.prototype.toString;
          var frameProxyToString = new Proxy(frameOrigToString, {
            apply: function(target, thisArg, argumentsList) {
              if (thisArg === frameOrigToString || thisArg === frameProxyToString) {
                return 'function toString() { [native code] }';
              }
              var found = lookupNativeName(thisArg);
              if (found !== undefined) {
                return 'function ' + found + '() { [native code] }';
              }
              return target.apply(thisArg, argumentsList);
            }
          });
          targetWin.Function.prototype.toString = frameProxyToString;
          registerNative(frameProxyToString, 'toString');
        }

        // 2. Navigator.prototype spoofing in targetWin
        if (targetWin.Navigator && targetWin.Navigator.prototype) {
          var tNavProto = targetWin.Navigator.prototype;
          function spoofTargetNav(prop, val) {
            try {
              if (targetWin.navigator) {
                try { delete targetWin.navigator[prop]; } catch(e) {}
              }
              var desc = Object.getOwnPropertyDescriptor(tNavProto, prop);
              var dummy = { get [prop]() { return val; } };
              var fallback = Object.getOwnPropertyDescriptor(dummy, prop).get;
              var targetGetter = (desc && desc.get && desc.get.name === 'get ' + prop) ? desc.get : fallback;
              var proxy = new Proxy(targetGetter, {
                apply: function(target, thisArg, args) {
                  if (!thisArg || !(thisArg instanceof targetWin.Navigator)) {
                    if (desc && typeof desc.get === 'function') {
                      try { return desc.get.apply(thisArg, args); } catch(e) { throw e; }
                    }
                    throw new TypeError("Failed to execute '" + prop + "' on 'Navigator': Illegal invocation");
                  }
                  return val;
                }
              });
              Object.defineProperty(tNavProto, prop, {
                get: proxy,
                enumerable: desc ? desc.enumerable : true,
                configurable: desc ? desc.configurable : true
              });
              registerNative(proxy, 'get ' + prop);
            } catch(e) {}
          }
          spoofTargetNav('webdriver', false);
          spoofTargetNav('hardwareConcurrency', ${hardwareConcurrency});
          spoofTargetNav('deviceMemory', ${deviceMemory});
          spoofTargetNav('platform', ${JSON.stringify(platformStr)});
          spoofTargetNav('maxTouchPoints', ${maxTouchPoints});
          spoofTargetNav('language', ${JSON.stringify(languagesList[0] || 'en-US')});
          spoofTargetNav('languages', Object.freeze(${JSON.stringify(languagesList)}));

          // userAgentData in targetWin
          if (!${isCamoufox}) {
            try {
              var tUaProto = (typeof targetWin.NavigatorUAData !== 'undefined' && targetWin.NavigatorUAData.prototype)
                ? targetWin.NavigatorUAData.prototype
                : null;
              var tUaDataObj;
              var dummyT = {
                get brands() {
                  if (typeof targetWin.NavigatorUAData !== 'undefined' && (!this || !(this instanceof targetWin.NavigatorUAData))) {
                    throw new TypeError("Failed to read the 'brands' property from 'NavigatorUAData': Illegal invocation");
                  }
                  return defaultBrands;
                },
                get mobile() {
                  if (typeof targetWin.NavigatorUAData !== 'undefined' && (!this || !(this instanceof targetWin.NavigatorUAData))) {
                    throw new TypeError("Failed to read the 'mobile' property from 'NavigatorUAData': Illegal invocation");
                  }
                  return chMobile;
                },
                get platform() {
                  if (typeof targetWin.NavigatorUAData !== 'undefined' && (!this || !(this instanceof targetWin.NavigatorUAData))) {
                    throw new TypeError("Failed to read the 'platform' property from 'NavigatorUAData': Illegal invocation");
                  }
                  return chPlatform;
                }
              };
              var getTBrands = Object.getOwnPropertyDescriptor(dummyT, 'brands').get;
              var getTMobile = Object.getOwnPropertyDescriptor(dummyT, 'mobile').get;
              var getTPlatform = Object.getOwnPropertyDescriptor(dummyT, 'platform').get;
              var getTHighEntropy = function getHighEntropyValues(hints) {
                if (typeof targetWin.NavigatorUAData !== 'undefined' && (!this || !(this instanceof targetWin.NavigatorUAData))) {
                  return Promise.reject(new TypeError("Failed to execute 'getHighEntropyValues' on 'NavigatorUAData': Illegal invocation"));
                }
                var res = { brands: defaultBrands, mobile: chMobile, platform: chPlatform };
                if (!Array.isArray(hints)) return Promise.resolve(res);
                for (var hi = 0; hi < hints.length; hi++) {
                  if (hints[hi] === 'architecture') res.architecture = chArch;
                  if (hints[hi] === 'bitness') res.bitness = chBitness;
                  if (hints[hi] === 'model') res.model = chModel;
                  if (hints[hi] === 'platformVersion') res.platformVersion = chPlatformVersion;
                  if (hints[hi] === 'uaFullVersion') res.uaFullVersion = chromeFullVer;
                  if (hints[hi] === 'fullVersionList') res.fullVersionList = defaultFullVersionList;
                }
                return Promise.resolve(res);
              };
              var tToJSON = function toJSON() {
                if (typeof targetWin.NavigatorUAData !== 'undefined' && (!this || !(this instanceof targetWin.NavigatorUAData))) {
                  throw new TypeError("Failed to execute 'toJSON' on 'NavigatorUAData': Illegal invocation");
                }
                return { brands: defaultBrands, mobile: chMobile, platform: chPlatform };
              };
              if (tUaProto) {
                Object.defineProperties(tUaProto, {
                  brands: { get: getTBrands, enumerable: true, configurable: true },
                  mobile: { get: getTMobile, enumerable: true, configurable: true },
                  platform: { get: getTPlatform, enumerable: true, configurable: true },
                  getHighEntropyValues: { value: getTHighEntropy, enumerable: true, configurable: true, writable: true },
                  toJSON: { value: tToJSON, enumerable: true, configurable: true, writable: true },
                });
                if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
                  try { Object.defineProperty(tUaProto, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) {}
                }
                tUaDataObj = Object.create(tUaProto);
              } else {
                tUaDataObj = {};
                Object.defineProperties(tUaDataObj, {
                  brands: { get: getTBrands, enumerable: true, configurable: true },
                  mobile: { get: getTMobile, enumerable: true, configurable: true },
                  platform: { get: getTPlatform, enumerable: true, configurable: true },
                  getHighEntropyValues: { value: getTHighEntropy, enumerable: true, configurable: true, writable: true },
                  toJSON: { value: tToJSON, enumerable: true, configurable: true, writable: true },
                });
                if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
                  try { Object.defineProperty(tUaDataObj, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) {}
                }
              }
              registerNative(getTBrands, 'get brands');
              registerNative(getTMobile, 'get mobile');
              registerNative(getTPlatform, 'get platform');
              registerNative(getTHighEntropy, 'getHighEntropyValues');
              registerNative(tToJSON, 'toJSON');
              var tUaDesc = Object.getOwnPropertyDescriptor(tNavProto, 'userAgentData');
              var dummyNavUa = { get userAgentData() { return tUaDataObj; } };
              var fallbackNavUa = Object.getOwnPropertyDescriptor(dummyNavUa, 'userAgentData').get;
              var targetNavUa = (tUaDesc && tUaDesc.get && tUaDesc.get.name === 'get userAgentData') ? tUaDesc.get : fallbackNavUa;
              var proxyNavUa = new Proxy(targetNavUa, {
                apply: function(target, thisArg, args) {
                  if (!thisArg || !(thisArg instanceof targetWin.Navigator)) {
                    if (tUaDesc && typeof tUaDesc.get === 'function') {
                      try { return tUaDesc.get.apply(thisArg, args); } catch(e) { throw e; }
                    }
                    throw new TypeError("Failed to execute 'userAgentData' on 'Navigator': Illegal invocation");
                  }
                  return tUaDataObj;
                }
              });
              Object.defineProperty(tNavProto, 'userAgentData', {
                get: proxyNavUa,
                enumerable: tUaDesc ? tUaDesc.enumerable : true,
                configurable: tUaDesc ? tUaDesc.configurable : true
              });
              registerNative(proxyNavUa, 'get userAgentData');
              if (tUaDesc && typeof tUaDesc.get === 'function') registerNative(tUaDesc.get, 'get userAgentData');
            } catch(e) {}
          }
        }

        // 3. Canvas Noise in targetWin
        if (${canvasMode !== 'off'}) {
          try {
            if (targetWin.HTMLCanvasElement && targetWin.HTMLCanvasElement.prototype) {
              var tOrigToDataURL = targetWin.HTMLCanvasElement.prototype.toDataURL;
              var tOrigToBlob = targetWin.HTMLCanvasElement.prototype.toBlob;
              var tOrigGetImageData = targetWin.CanvasRenderingContext2D ? targetWin.CanvasRenderingContext2D.prototype.getImageData : null;
              var tOrigPutImageData = targetWin.CanvasRenderingContext2D ? targetWin.CanvasRenderingContext2D.prototype.putImageData : null;

              if (tOrigToDataURL && tOrigGetImageData && tOrigPutImageData) {
                var tProxyToDataURL = new Proxy(tOrigToDataURL, {
                  apply: function(target, thisArg, args) {
                    try {
                      if (thisArg.width > 8 && thisArg.height > 8) {
                        var clone = targetWin.document.createElement('canvas');
                        clone.width = thisArg.width;
                        clone.height = thisArg.height;
                        var ctx = clone.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(thisArg, 0, 0);
                          var imgData = tOrigGetImageData.call(ctx, 0, 0, clone.width, clone.height);
                          applyNoiseToImageData(imgData, 0, 0, clone.width, clone.height);
                          tOrigPutImageData.call(ctx, imgData, 0, 0);
                          return target.apply(clone, args);
                        }
                      }
                    } catch(e) {}
                    return target.apply(thisArg, args);
                  }
                });
                targetWin.HTMLCanvasElement.prototype.toDataURL = tProxyToDataURL;
                registerNative(tProxyToDataURL, 'toDataURL');
                registerNative(tOrigToDataURL, 'toDataURL');
              }

              if (tOrigToBlob && tOrigGetImageData && tOrigPutImageData) {
                var tProxyToBlob = new Proxy(tOrigToBlob, {
                  apply: function(target, thisArg, args) {
                    try {
                      if (thisArg.width > 8 && thisArg.height > 8) {
                        var clone = targetWin.document.createElement('canvas');
                        clone.width = thisArg.width;
                        clone.height = thisArg.height;
                        var ctx = clone.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(thisArg, 0, 0);
                          var imgData = tOrigGetImageData.call(ctx, 0, 0, clone.width, clone.height);
                          applyNoiseToImageData(imgData, 0, 0, clone.width, clone.height);
                          tOrigPutImageData.call(ctx, imgData, 0, 0);
                          return target.apply(clone, args);
                        }
                      }
                    } catch(e) {}
                    return target.apply(thisArg, args);
                  }
                });
                targetWin.HTMLCanvasElement.prototype.toBlob = tProxyToBlob;
                registerNative(tProxyToBlob, 'toBlob');
                registerNative(tOrigToBlob, 'toBlob');
              }
            }
            if (targetWin.CanvasRenderingContext2D && targetWin.CanvasRenderingContext2D.prototype) {
              var tOrigGetID = targetWin.CanvasRenderingContext2D.prototype.getImageData;
              if (tOrigGetID) {
                var tProxyGetID = new Proxy(tOrigGetID, {
                  apply: function(target, thisArg, args) {
                    var imgData = target.apply(thisArg, args);
                    try {
                      var sx = Number(args[0]) || 0;
                      var sy = Number(args[1]) || 0;
                      var cw = (thisArg && thisArg.canvas) ? thisArg.canvas.width : imgData.width;
                      var ch = (thisArg && thisArg.canvas) ? thisArg.canvas.height : imgData.height;
                      applyNoiseToImageData(imgData, sx, sy, cw, ch);
                    } catch(e) {}
                    return imgData;
                  }
                });
                targetWin.CanvasRenderingContext2D.prototype.getImageData = tProxyGetID;
                registerNative(tProxyGetID, 'getImageData');
                registerNative(tOrigGetID, 'getImageData');
              }
            }
          } catch(e) {}
        }

        // 4. WebGL in targetWin
        if (${webglMode !== 'off'}) {
          try {
            function spoofTargetWebGL(glProto) {
              if (!glProto || !glProto.getParameter) return;
              var origGP = glProto.getParameter;
              var proxyGP = new Proxy(origGP, {
                apply: function(target, thisArg, args) {
                  var param = args[0];
                  var pGpuVendor = ${JSON.stringify(gpuVendor)};
                  var pGpuRenderer = ${JSON.stringify(gpuRenderer)};
                  if (pGpuVendor && param === 37445) return pGpuVendor;
                  if (pGpuRenderer && param === 37446) return pGpuRenderer;
                  if (param === 7936) return 'WebKit';
                  if (param === 7937) return 'WebKit WebGL';
                  return target.apply(thisArg, args);
                }
              });
              glProto.getParameter = proxyGP;
              registerNative(proxyGP, 'getParameter');
              registerNative(origGP, 'getParameter');
            }
            if (targetWin.WebGLRenderingContext) spoofTargetWebGL(targetWin.WebGLRenderingContext.prototype);
            if (targetWin.WebGL2RenderingContext) spoofTargetWebGL(targetWin.WebGL2RenderingContext.prototype);
          } catch(e) {}
        }

        // 5. Date & Timezone in targetWin
        if (!mahiTzApplied && targetTz && targetWin.Date && targetWin.Date.prototype) {
          try {
            var origDateTz = targetWin.Date.prototype.getTimezoneOffset;
            var proxyDateTz = new Proxy(origDateTz, {
              apply: function(target, thisArg, args) {
                if (thisArg instanceof targetWin.Date && !isNaN(thisArg.getTime())) {
                  return getTzOffset(thisArg, targetTz);
                }
                return target.apply(thisArg, args);
              }
            });
            targetWin.Date.prototype.getTimezoneOffset = proxyDateTz;
            registerNative(proxyDateTz, 'getTimezoneOffset');
          } catch(e) {}
        }

        // 5. frames in targetWin
        if (targetWin && (!patchedFramesRealms || !patchedFramesRealms.has(targetWin))) {
          if (patchedFramesRealms) patchedFramesRealms.add(targetWin);
          try {
            var origTWinFramesDesc = Object.getOwnPropertyDescriptor(targetWin, 'frames');
            if (origTWinFramesDesc && origTWinFramesDesc.get) {
              var origGetTWinFrames = origTWinFramesDesc.get;
              var proxyGetTWinFrames = new Proxy(origGetTWinFrames, {
                apply: function(target, thisArg, args) {
                  var framesObj = target.apply(thisArg, args);
                  try {
                    if (framesObj && framesObj.length) {
                      for (var fi = 0; fi < framesObj.length; fi++) {
                        try { patchRealm(framesObj[fi], nextDepth); } catch(e) {}
                      }
                    }
                  } catch(e) {}
                  return framesObj;
                }
              });
              Object.defineProperty(targetWin, 'frames', {
                get: proxyGetTWinFrames,
                enumerable: origTWinFramesDesc.enumerable,
                configurable: origTWinFramesDesc.configurable
              });
              registerNative(proxyGetTWinFrames, 'get frames');
            }
          } catch(e) {}
        }
      } catch(e) {}
    };

    if (typeof HTMLIFrameElement !== 'undefined' && HTMLIFrameElement.prototype) {
      var origContentWindowDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      if (origContentWindowDesc && origContentWindowDesc.get) {
        var origGetCW = origContentWindowDesc.get;
        var proxyGetCW = new Proxy(origGetCW, {
          apply: function(target, thisArg, args) {
            var win = target.apply(thisArg, args);
            if (win) patchRealm(win, 1);
            return win;
          }
        });
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get: proxyGetCW,
          enumerable: origContentWindowDesc.enumerable,
          configurable: origContentWindowDesc.configurable
        });
        registerNative(proxyGetCW, 'get contentWindow');
      }

      var origContentDocDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');
      if (origContentDocDesc && origContentDocDesc.get) {
        var origGetCD = origContentDocDesc.get;
        var proxyGetCD = new Proxy(origGetCD, {
          apply: function(target, thisArg, args) {
            var doc = target.apply(thisArg, args);
            if (doc && doc.defaultView) patchRealm(doc.defaultView, 1);
            return doc;
          }
        });
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
          get: proxyGetCD,
          enumerable: origContentDocDesc.enumerable,
          configurable: origContentDocDesc.configurable
        });
        registerNative(proxyGetCD, 'get contentDocument');
      }
    }

    if (typeof window !== 'undefined' && (!patchedFramesRealms || !patchedFramesRealms.has(window))) {
      if (patchedFramesRealms) patchedFramesRealms.add(window);
      var origFramesDesc = Object.getOwnPropertyDescriptor(window, 'frames');
      if (origFramesDesc && origFramesDesc.get) {
        var origGetFrames = origFramesDesc.get;
        var proxyGetFrames = new Proxy(origGetFrames, {
          apply: function(target, thisArg, args) {
            var framesObj = target.apply(thisArg, args);
            try {
              if (framesObj && framesObj.length) {
                for (var fi = 0; fi < framesObj.length; fi++) {
                  try { patchRealm(framesObj[fi], 1); } catch(e) {}
                }
              }
            } catch(e) {}
            return framesObj;
          }
        });
        Object.defineProperty(window, 'frames', {
          get: proxyGetFrames,
          enumerable: origFramesDesc.enumerable,
          configurable: origFramesDesc.configurable
        });
        registerNative(proxyGetFrames, 'get frames');
      }
    }
  } catch(e) {}

  // -------------------------------------------------------------
  // 1. Automation & WebDriver Masking
  // -------------------------------------------------------------
  try {
    if (typeof Navigator !== 'undefined' && Navigator.prototype) {
      var proto = Navigator.prototype;
      var origWbDesc = Object.getOwnPropertyDescriptor(proto, 'webdriver');
      var getterObj = {
        get webdriver() { return false; }
      };
      var fallbackGetter = Object.getOwnPropertyDescriptor(getterObj, 'webdriver').get;
      var targetGetter = (origWbDesc && origWbDesc.get && origWbDesc.get.name === 'get webdriver')
        ? origWbDesc.get
        : fallbackGetter;
      var proxyWebdriver = new Proxy(targetGetter, {
        apply: function(target, thisArg, argumentsList) {
          if (!thisArg || !(thisArg instanceof Navigator)) {
            if (origWbDesc && typeof origWbDesc.get === 'function') {
              try {
                return origWbDesc.get.apply(thisArg, argumentsList);
              } catch(e) {
                throw e;
              }
            }
            throw new TypeError("Failed to execute 'webdriver' on 'Navigator': Illegal invocation");
          }
          return false;
        }
      });
      Object.defineProperty(proto, 'webdriver', {
        get: proxyWebdriver,
        enumerable: true,
        configurable: true
      });
      registerNative(proxyWebdriver, 'get webdriver');
      if (origWbDesc && typeof origWbDesc.get === 'function') {
        registerNative(origWbDesc.get, 'get webdriver');
      }
    }
    if (typeof navigator !== 'undefined') {
      try { delete navigator.webdriver; } catch(e) {}
    }
  } catch(e) {}

  // Remove Chromedriver / automation artifacts (pattern-based sweep)
  try {
    var windowPropNames = Object.getOwnPropertyNames(window);
    var autoRegex = /^(\\$?cdc_|__webdriver|__selenium|__fxdriver)/;
    for (var aIdx = 0; aIdx < windowPropNames.length; aIdx++) {
      if (autoRegex.test(windowPropNames[aIdx])) {
        try { delete window[windowPropNames[aIdx]]; } catch(e) {}
      }
    }
  } catch(e) {}

  // Chrome Runtime Mocking (for Chromium-family engines)
  if (!${isCamoufox}) {
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
  }

  // -------------------------------------------------------------
  // 2. Hardware Navigator Overrides & Locale/Languages
  // -------------------------------------------------------------
  try {
    function spoofNavigator(prop, value) {
      if (typeof navigator !== 'undefined') {
        try { delete navigator[prop]; } catch(e) {}
      }
      var desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
      var dummy = { get [prop]() { return value; } };
      var fallbackGetter = Object.getOwnPropertyDescriptor(dummy, prop).get;
      var targetGetter = (desc && desc.get && desc.get.name === 'get ' + prop) ? desc.get : fallbackGetter;
      var proxy = new Proxy(targetGetter, {
        apply: function(target, thisArg, argumentsList) {
          if (!thisArg || !(thisArg instanceof Navigator)) {
            if (desc && typeof desc.get === 'function') {
              try {
                return desc.get.apply(thisArg, argumentsList);
              } catch(e) {
                throw e;
              }
            }
            throw new TypeError("Failed to execute '" + prop + "' on 'Navigator': Illegal invocation");
          }
          return value;
        }
      });
      Object.defineProperty(Navigator.prototype, prop, {
        get: proxy,
        enumerable: desc ? desc.enumerable : true,
        configurable: desc ? desc.configurable : true
      });
      registerNative(proxy, 'get ' + prop);
      if (desc && typeof desc.get === 'function') registerNative(desc.get, 'get ' + prop);
    }

    spoofNavigator('hardwareConcurrency', ${hardwareConcurrency});
    spoofNavigator('deviceMemory', ${deviceMemory});
    spoofNavigator('platform', ${JSON.stringify(platformStr)});
    spoofNavigator('maxTouchPoints', ${maxTouchPoints});
    spoofNavigator('language', ${JSON.stringify(languagesList[0] || 'en-US')});
    spoofNavigator('languages', Object.freeze(${JSON.stringify(languagesList)}));

    // -------------------------------------------------------------
    // Timezone Spoofing (Intl.DateTimeFormat & Date.prototype.getTimezoneOffset)
    // FIX-3: Retained JS timezone proxies because FIX-0 proved native --tz and env TZ
    // are no-ops on Windows Chromium and CDP Emulation does not cover Web Workers/Service Workers.
    // Guarded with !mahiTzApplied and registerNative for descriptor integrity.
    // -------------------------------------------------------------
    if (targetTz && !mahiTzApplied) {
      try {
        var getTzOffset = function(date, tz) {
          try {
            var formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: tz,
              year: 'numeric', month: 'numeric', day: 'numeric',
              hour: 'numeric', minute: 'numeric', second: 'numeric',
              hour12: false, hourCycle: 'h23'
            });
            var parts = formatter.formatToParts(date);
            var map = {};
            for (var pIdx = 0; pIdx < parts.length; pIdx++) map[parts[pIdx].type] = parseInt(parts[pIdx].value, 10);
            var tzHour = map.hour === 24 ? 0 : map.hour;
            var tzDate = Date.UTC(map.year, map.month - 1, map.day, tzHour, map.minute, map.second);
            var utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
            return Math.round((utcDate - tzDate) / 60000);
          } catch(e) {
            return 0;
          }
        };

        var origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        var proxyGetTimezoneOffset = new Proxy(origGetTimezoneOffset, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              return getTzOffset(thisArg, targetTz);
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.getTimezoneOffset = proxyGetTimezoneOffset;
        registerNative(proxyGetTimezoneOffset, 'getTimezoneOffset');
        registerNative(origGetTimezoneOffset, 'getTimezoneOffset');

        var explicitTzMap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
        var origDTF = Intl.DateTimeFormat;
        var ProxyDTF = function DateTimeFormat() {
          var locales = arguments[0];
          var options = arguments[1];
          var hasExplicitTz = options && options.timeZone;
          var opts = Object.assign({}, options);
          if (!opts.timeZone) {
            opts.timeZone = targetTz;
          }
          var inst;
          if (!(this instanceof ProxyDTF)) {
            inst = origDTF(locales, opts);
          } else {
            inst = new origDTF(locales, opts);
          }
          if (explicitTzMap && inst && typeof inst === 'object') {
            explicitTzMap.set(inst, !!hasExplicitTz);
          }
          return inst;
        };
        try {
          Object.defineProperty(ProxyDTF, 'length', { value: 0, configurable: true });
        } catch(e) {}
        ProxyDTF.prototype = origDTF.prototype;
        ProxyDTF.prototype.constructor = ProxyDTF;
        if (origDTF.supportedLocalesOf) {
          ProxyDTF.supportedLocalesOf = origDTF.supportedLocalesOf;
        }
        registerNative(ProxyDTF, 'DateTimeFormat');
        registerNative(origDTF, 'DateTimeFormat');
        Intl.DateTimeFormat = ProxyDTF;

        var origResolved = origDTF.prototype.resolvedOptions;
        var proxyResolved = new Proxy(origResolved, {
          apply: function(target, thisArg, args) {
            var res = target.apply(thisArg, args);
            if (res && (!explicitTzMap || !explicitTzMap.get(thisArg))) {
              res.timeZone = targetTz;
            }
            return res;
          }
        });
        origDTF.prototype.resolvedOptions = proxyResolved;
        registerNative(proxyResolved, 'resolvedOptions');
        registerNative(origResolved, 'resolvedOptions');

        var formatTzDate = function(date, mode) {
          try {
            var dtf = new Intl.DateTimeFormat('en-US', {
              timeZone: targetTz,
              weekday: 'short', month: 'short', day: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false, hourCycle: 'h23', timeZoneName: 'long'
            });
            var parts = {};
            var pList = dtf.formatToParts(date);
            for (var pi = 0; pi < pList.length; pi++) parts[pList[pi].type] = pList[pi].value;
            if (parts.hour === '24') parts.hour = '00';

            var offMin = getTzOffset(date, targetTz);
            var sign = offMin <= 0 ? '+' : '-';
            var absOff = Math.abs(offMin);
            var offH = ('0' + Math.floor(absOff / 60)).slice(-2);
            var offM = ('0' + (absOff % 60)).slice(-2);
            var offStr = 'GMT' + sign + offH + offM;

            if (mode === 'date') {
              return parts.weekday + ' ' + parts.month + ' ' + parts.day + ' ' + parts.year;
            }
            if (mode === 'time') {
              return parts.hour + ':' + parts.minute + ':' + parts.second + ' ' + offStr + ' (' + (parts.timeZoneName || targetTz) + ')';
            }
            return parts.weekday + ' ' + parts.month + ' ' + parts.day + ' ' + parts.year + ' ' + parts.hour + ':' + parts.minute + ':' + parts.second + ' ' + offStr + ' (' + (parts.timeZoneName || targetTz) + ')';
          } catch(e) {
            return null;
          }
        };

        var origDateToString = Date.prototype.toString;
        var proxyDateToString = new Proxy(origDateToString, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              var formatted = formatTzDate(thisArg, 'full');
              if (formatted) return formatted;
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.toString = proxyDateToString;
        registerNative(proxyDateToString, 'toString');
        registerNative(origDateToString, 'toString');

        var origDateToTimeString = Date.prototype.toTimeString;
        var proxyDateToTimeString = new Proxy(origDateToTimeString, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              var formatted = formatTzDate(thisArg, 'time');
              if (formatted) return formatted;
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.toTimeString = proxyDateToTimeString;
        registerNative(proxyDateToTimeString, 'toTimeString');
        registerNative(origDateToTimeString, 'toTimeString');

        var origDateToDateString = Date.prototype.toDateString;
        var proxyDateToDateString = new Proxy(origDateToDateString, {
          apply: function(target, thisArg, args) {
            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
              var formatted = formatTzDate(thisArg, 'date');
              if (formatted) return formatted;
            }
            return target.apply(thisArg, args);
          }
        });
        Date.prototype.toDateString = proxyDateToDateString;
        registerNative(proxyDateToDateString, 'toDateString');
        registerNative(origDateToDateString, 'toDateString');

        var hookDateLocale = function(prop) {
          var orig = Date.prototype[prop];
          if (!orig) return;
          var proxy = new Proxy(orig, {
            apply: function(target, thisArg, args) {
              if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {
                var locales = args[0];
                var options = Object.assign({}, args[1]);
                if (!options.timeZone) {
                  options.timeZone = targetTz;
                }
                return target.call(thisArg, locales, options);
              }
              return target.apply(thisArg, args);
            }
          });
          Date.prototype[prop] = proxy;
          registerNative(proxy, prop);
          registerNative(orig, prop);
        };
        hookDateLocale('toLocaleString');
        hookDateLocale('toLocaleDateString');
        hookDateLocale('toLocaleTimeString');
      } catch(e) {}
    }

    // -------------------------------------------------------------
    // 2.5 Web Worker & SharedWorker Stealth Synchronization
    // -------------------------------------------------------------
    try {
      var workerBootstrapJs = [
        '(function() {',
        '  try {',
        '    var pHwc = ' + ${hardwareConcurrency} + ';',
        '    var pDevMem = ' + ${deviceMemory} + ';',
        '    var pPlat = ' + JSON.stringify(${JSON.stringify(platformStr)}) + ';',
        '    var pTz = ' + JSON.stringify(${JSON.stringify(targetTimezone)}) + ';',
        '    var mahiTzApplied = false;',
        '    var pLang = ' + JSON.stringify(${JSON.stringify(languagesList[0] || 'en-US')}) + ';',
        '    var pLangs = Object.freeze(' + JSON.stringify(${JSON.stringify(languagesList)}) + ');',
        '    var pUa = ' + JSON.stringify(${JSON.stringify(settings?.browser?.userAgent || '')}) + ';',
        '    var pGpuVendor = ' + JSON.stringify(${JSON.stringify(gpuVendor)}) + ';',
        '    var pGpuRenderer = ' + JSON.stringify(${JSON.stringify(gpuRenderer)}) + ';',
        '    var pSeed = ' + pSeed + ';',
        '    var seedOffset = ((pSeed % 15) + 1);',
        '    var wHooked = [];',
        '    function wReg(fn, name) {',
        '      if (typeof fn === "function") {',
        '        var n = name || fn.name || "";',
        '        try { Object.defineProperty(fn, "name", { value: n, configurable: true }); } catch(e) {}',
        '        try { Object.defineProperty(fn, "length", { value: fn.length, configurable: true }); } catch(e) {}',
        '        wHooked.push({ fn: fn, name: n });',
        '      }',
        '    }',
        '    try {',
        '      var wOrigToString = Function.prototype.toString;',
        '      var wProxyToString = new Proxy(wOrigToString, {',
        '        apply: function(target, thisArg, args) {',
        '          if (thisArg === wOrigToString || thisArg === wProxyToString) return "function toString() { [native code] }";',
        '          for (var wi = 0; wi < wHooked.length; wi++) {',
        '            if (thisArg === wHooked[wi].fn) return "function " + wHooked[wi].name + "() { [native code] }";',
        '          }',
        '          return target.apply(thisArg, args);',
        '        }',
        '      });',
        '      Function.prototype.toString = wProxyToString;',
        '      wReg(wProxyToString, "toString");',
        '      wReg(wOrigToString, "toString");',
        '    } catch(e) {}',
        '    if (typeof WorkerNavigator !== "undefined" && WorkerNavigator.prototype) {',
        '      var wProto = WorkerNavigator.prototype;',
        '      function spoofWorkerNav(prop, val) {',
        '        try {',
        '          var desc = Object.getOwnPropertyDescriptor(wProto, prop);',
        '          var dummy = { get [prop]() {',
        '            if (!this || !(this instanceof WorkerNavigator)) {',
        '              throw new TypeError("Failed to execute on WorkerNavigator: Illegal invocation");',
        '            }',
        '            return val;',
        '          } };',
        '          var getter = Object.getOwnPropertyDescriptor(dummy, prop).get;',
        '          Object.defineProperty(wProto, prop, {',
        '            get: getter,',
        '            enumerable: desc ? desc.enumerable : true,',
        '            configurable: desc ? desc.configurable : true',
        '          });',
        '          wReg(getter, "get " + prop);',
        '        } catch(e) {}',
        '      }',
        '      spoofWorkerNav("webdriver", false);',
        '      spoofWorkerNav("hardwareConcurrency", pHwc);',
        '      spoofWorkerNav("deviceMemory", pDevMem);',
        '      spoofWorkerNav("platform", pPlat);',
        '      spoofWorkerNav("language", pLang);',
        '      spoofWorkerNav("languages", pLangs);',
        '      if (pUa) spoofWorkerNav("userAgent", pUa);',
        '      if (!' + ${isCamoufox} + ') {',
        '        try {',
        '          var wBrands = [',
        '            { brand: "Not/A)Brand", version: "8" },',
        '            { brand: "Chromium", version: ' + JSON.stringify(${JSON.stringify(chromeMajorVer)}) + ' },',
        '            { brand: "Google Chrome", version: ' + JSON.stringify(${JSON.stringify(chromeMajorVer)}) + ' }',
        '          ];',
        '          var wFullList = [',
        '            { brand: "Not/A)Brand", version: "8.0.0.0" },',
        '            { brand: "Chromium", version: ' + JSON.stringify(${JSON.stringify(chromeFullVer)}) + ' },',
        '            { brand: "Google Chrome", version: ' + JSON.stringify(${JSON.stringify(chromeFullVer)}) + ' }',
        '          ];',
        '          var wUaObj = {',
        '            brands: wBrands,',
        '            mobile: ' + (${isMobile ? 'true' : 'false'}) + ',',
        '            platform: ' + JSON.stringify(${JSON.stringify(clientHintsPlatform)}) + ',',
        '            getHighEntropyValues: function(hints) {',
        '              var res = { brands: wBrands, mobile: ' + (${isMobile ? 'true' : 'false'}) + ', platform: ' + JSON.stringify(${JSON.stringify(clientHintsPlatform)}) + ' };',
        '              if (Array.isArray(hints)) {',
        '                for (var wi = 0; wi < hints.length; wi++) {',
        '                  if (hints[wi] === "fullVersionList") res.fullVersionList = wFullList;',
        '                }',
        '              }',
        '              return Promise.resolve(res);',
        '            },',
        '            toJSON: function() { return { brands: wBrands, mobile: ' + (${isMobile ? 'true' : 'false'}) + ', platform: ' + JSON.stringify(${JSON.stringify(clientHintsPlatform)}) + ' }; }',
        '          };',
        '          if (typeof Symbol !== "undefined" && Symbol.toStringTag) {',
        '            try { Object.defineProperty(wUaObj, Symbol.toStringTag, { value: "NavigatorUAData", configurable: true }); } catch(e) {}',
        '          }',
        '          spoofWorkerNav("userAgentData", wUaObj);',
        '        } catch(e) {}',
        '      }',
        '    }',
        '    if (typeof OffscreenCanvas !== "undefined") {',
        '      if (typeof OffscreenCanvasRenderingContext2D !== "undefined") {',
        '        var origOffGetID = OffscreenCanvasRenderingContext2D.prototype.getImageData;',
        '        if (origOffGetID) {',
        '          var proxyOffGetID = new Proxy(origOffGetID, {',
        '            apply: function(target, thisArg, args) {',
        '              var imgData = target.apply(thisArg, args);',
        '              try {',
        '                var sx = Number(args[0]) || 0;',
        '                var sy = Number(args[1]) || 0;',
        '                var cw = (thisArg && thisArg.canvas) ? thisArg.canvas.width : imgData.width;',
        '                var ch = (thisArg && thisArg.canvas) ? thisArg.canvas.height : imgData.height;',
        '                if (cw > 8 && ch > 8 && imgData.width > 8 && imgData.height > 8) {',
        '                  var data = imgData.data;',
        '                  for (var y = 0; y < imgData.height; y++) {',
        '                    var gy = sy + y;',
        '                    for (var x = 0; x < imgData.width; x++) {',
        '                      var gx = sx + x;',
        '                      var _h = Math.imul(gx + 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(gy + pSeed, 0xC2B2AE35) ^ seedOffset;',
        '                      _h ^= _h >>> 15; _h = Math.imul(_h, 0x2545F491);',
        '                      _h ^= _h >>> 13;',
        '                      if ((_h & 127) === 0) {',
        '                        var dataIdx = (y * imgData.width + x) * 4;',
        '                        if (data[dataIdx + 3] === 0) continue;',
        '                        var chIdx = (pSeed + gx + gy) % 3;',
        '                        data[dataIdx + chIdx] ^= 1;',
        '                      }',
        '                    }',
        '                  }',
        '                }',
        '              } catch(e) {}',
        '              return imgData;',
        '            }',
        '          });',
        '          OffscreenCanvasRenderingContext2D.prototype.getImageData = proxyOffGetID;',
        '          wReg(proxyOffGetID, "getImageData");',
        '          wReg(origOffGetID, "getImageData");',
        '        }',
        '      }',
        '      if (OffscreenCanvas.prototype.convertToBlob) {',
        '        var origOffBlob = OffscreenCanvas.prototype.convertToBlob;',
        '        var proxyOffBlob = new Proxy(origOffBlob, {',
        '          apply: function(target, thisArg, args) {',
        '            try {',
        '              if (thisArg.width > 8 && thisArg.height > 8) {',
        '                var clone = new OffscreenCanvas(thisArg.width, thisArg.height);',
        '                var cloneCtx = clone.getContext("2d");',
        '                if (cloneCtx) {',
        '                  cloneCtx.drawImage(thisArg, 0, 0);',
        '                  var imgData = cloneCtx.getImageData(0, 0, clone.width, clone.height);',
        '                  var data = imgData.data;',
        '                  for (var y = 0; y < imgData.height; y++) {',
        '                    var gy = y;',
        '                    for (var x = 0; x < imgData.width; x++) {',
        '                      var gx = x;',
        '                      var _h = Math.imul(gx + 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(gy + pSeed, 0xC2B2AE35) ^ seedOffset;',
        '                      _h ^= _h >>> 15; _h = Math.imul(_h, 0x2545F491);',
        '                      _h ^= _h >>> 13;',
        '                      if ((_h & 127) === 0) {',
        '                        var dataIdx = (y * imgData.width + x) * 4;',
        '                        if (data[dataIdx + 3] === 0) continue;',
        '                        var chIdx = (pSeed + gx + gy) % 3;',
        '                        data[dataIdx + chIdx] ^= 1;',
        '                      }',
        '                    }',
        '                  }',
        '                  if (cloneCtx.putImageData) cloneCtx.putImageData(imgData, 0, 0);',
        '                  return target.apply(clone, args);',
        '                }',
        '              }',
        '            } catch(e) {}',
        '            return target.apply(thisArg, args);',
        '          }',
        '        });',
        '        OffscreenCanvas.prototype.convertToBlob = proxyOffBlob;',
        '        wReg(proxyOffBlob, "convertToBlob");',
        '        wReg(origOffBlob, "convertToBlob");',
        '      }',
        '    }',
        '    function spoofWorkerGL(glProto) {',
        '      if (!glProto || !glProto.getParameter) return;',
        '      var origGP = glProto.getParameter;',
        '      var proxyGP = new Proxy(origGP, {',
        '        apply: function(target, thisArg, args) {',
        '          var param = args[0];',
        '          if (pGpuVendor && param === 37445) return pGpuVendor;',
        '          if (pGpuRenderer && param === 37446) return pGpuRenderer;',
        '          if (param === 7936) return "WebKit";',
        '          if (param === 7937) return "WebKit WebGL";',
        '          return target.apply(thisArg, args);',
        '        }',
        '      });',
        '      glProto.getParameter = proxyGP;',
        '      wReg(proxyGP, "getParameter");',
        '      wReg(origGP, "getParameter");',
        '    }',
        '    if (typeof OffscreenCanvas !== "undefined" && OffscreenCanvas.prototype.getContext) {',
        '      var origOffCtx = OffscreenCanvas.prototype.getContext;',
        '      var proxyOffCtx = new Proxy(origOffCtx, {',
        '        apply: function(t, thisArg, a) {',
        '          var ctx = t.apply(thisArg, a);',
        '          if (ctx && ctx.getParameter && (pGpuVendor || pGpuRenderer)) {',
        '            spoofWorkerGL(Object.getPrototypeOf(ctx));',
        '          }',
        '          return ctx;',
        '        }',
        '      });',
        '      OffscreenCanvas.prototype.getContext = proxyOffCtx;',
        '      wReg(proxyOffCtx, "getContext");',
        '      wReg(origOffCtx, "getContext");',
        '    }',
        '    if (typeof WebGLRenderingContext !== "undefined") spoofWorkerGL(WebGLRenderingContext.prototype);',
        '    if (typeof WebGL2RenderingContext !== "undefined") spoofWorkerGL(WebGL2RenderingContext.prototype);',
        '    if (!mahiTzApplied && pTz) {',
        '      var getTzOffset = function(date, tz) {',
        '        try {',
        '          var formatter = new Intl.DateTimeFormat("en-US", {',
        '            timeZone: tz, year: "numeric", month: "numeric", day: "numeric",',
        '            hour: "numeric", minute: "numeric", second: "numeric",',
        '            hour12: false, hourCycle: "h23"',
        '          });',
        '          var parts = formatter.formatToParts(date);',
        '          var map = {};',
        '          for (var pIdx = 0; pIdx < parts.length; pIdx++) map[parts[pIdx].type] = parseInt(parts[pIdx].value, 10);',
        '          var tzHour = map.hour === 24 ? 0 : map.hour;',
        '          var tzDate = Date.UTC(map.year, map.month - 1, map.day, tzHour, map.minute, map.second);',
        '          var utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());',
        '          return Math.round((utcDate - tzDate) / 60000);',
        '        } catch(e) { return 0; }',
        '      };',
        '      var origOff = Date.prototype.getTimezoneOffset;',
        '      var proxyOff = new Proxy(origOff, {',
        '        apply: function(target, thisArg, args) {',
        '          if (thisArg instanceof Date && !isNaN(thisArg.getTime())) return getTzOffset(thisArg, pTz);',
        '          return target.apply(thisArg, args);',
        '        }',
        '      });',
        '      Date.prototype.getTimezoneOffset = proxyOff;',
        '      wReg(proxyOff, "getTimezoneOffset");',
        '      wReg(origOff, "getTimezoneOffset");',
        '      if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {',
        '        var origDTF = Intl.DateTimeFormat;',
        '        var explicitTzMap = typeof WeakMap !== "undefined" ? new WeakMap() : null;',
        '        var ProxyDTF = function DateTimeFormat() {',
        '          var locales = arguments[0];',
        '          var options = arguments[1];',
        '          var hasExplicitTz = options && options.timeZone;',
        '          var opts = Object.assign({}, options);',
        '          if (!opts.timeZone) opts.timeZone = pTz;',
        '          var inst = (this instanceof ProxyDTF) ? new origDTF(locales, opts) : origDTF(locales, opts);',
        '          if (explicitTzMap && inst && typeof inst === "object") explicitTzMap.set(inst, !!hasExplicitTz);',
        '          return inst;',
        '        };',
        '        try { Object.defineProperty(ProxyDTF, "length", { value: 0, configurable: true }); } catch(e) {}',
        '        ProxyDTF.prototype = origDTF.prototype;',
        '        ProxyDTF.prototype.constructor = ProxyDTF;',
        '        if (origDTF.supportedLocalesOf) ProxyDTF.supportedLocalesOf = origDTF.supportedLocalesOf;',
        '        Intl.DateTimeFormat = ProxyDTF;',
        '        wReg(ProxyDTF, "DateTimeFormat");',
        '        wReg(origDTF, "DateTimeFormat");',
        '        var origRes = origDTF.prototype.resolvedOptions;',
        '        var proxyRes = new Proxy(origRes, {',
        '          apply: function(target, thisArg, args) {',
        '            var res = target.apply(thisArg, args);',
        '            if (res && (!explicitTzMap || !explicitTzMap.get(thisArg))) res.timeZone = pTz;',
        '            return res;',
        '          }',
        '        });',
        '        origDTF.prototype.resolvedOptions = proxyRes;',
        '        wReg(proxyRes, "resolvedOptions");',
        '        wReg(origRes, "resolvedOptions");',
        '      }',
        '      var formatTzDate = function(date, mode) {',
        '        try {',
        '          var dtf = new Intl.DateTimeFormat("en-US", {',
        '            timeZone: pTz, weekday: "short", month: "short", day: "2-digit", year: "numeric",',
        '            hour: "2-digit", minute: "2-digit", second: "2-digit",',
        '            hour12: false, hourCycle: "h23", timeZoneName: "long"',
        '          });',
        '          var parts = {};',
        '          var pList = dtf.formatToParts(date);',
        '          for (var pi = 0; pi < pList.length; pi++) parts[pList[pi].type] = pList[pi].value;',
        '          if (parts.hour === "24") parts.hour = "00";',
        '          var offMin = getTzOffset(date, pTz);',
        '          var sign = offMin <= 0 ? "+" : "-";',
        '          var absOff = Math.abs(offMin);',
        '          var offH = ("0" + Math.floor(absOff / 60)).slice(-2);',
        '          var offM = ("0" + (absOff % 60)).slice(-2);',
        '          var offStr = "GMT" + sign + offH + offM;',
        '          if (mode === "date") return parts.weekday + " " + parts.month + " " + parts.day + " " + parts.year;',
        '          if (mode === "time") return parts.hour + ":" + parts.minute + ":" + parts.second + " " + offStr + " (" + (parts.timeZoneName || pTz) + ")";',
        '          return parts.weekday + " " + parts.month + " " + parts.day + " " + parts.year + " " + parts.hour + ":" + parts.minute + ":" + parts.second + " " + offStr + " (" + (parts.timeZoneName || pTz) + ")";',
        '        } catch(e) { return null; }',
        '      };',
        '      var origDTS = Date.prototype.toString;',
        '      var proxyDTS = new Proxy(origDTS, {',
        '        apply: function(target, thisArg, args) {',
        '          if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {',
        '            var f = formatTzDate(thisArg, "full");',
        '            if (f) return f;',
        '          }',
        '          return target.apply(thisArg, args);',
        '        }',
        '      });',
        '      Date.prototype.toString = proxyDTS;',
        '      wReg(proxyDTS, "toString");',
        '      wReg(origDTS, "toString");',
        '      var origTTS = Date.prototype.toTimeString;',
        '      var proxyTTS = new Proxy(origTTS, {',
        '        apply: function(target, thisArg, args) {',
        '          if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {',
        '            var f = formatTzDate(thisArg, "time");',
        '            if (f) return f;',
        '          }',
        '          return target.apply(thisArg, args);',
        '        }',
        '      });',
        '      Date.prototype.toTimeString = proxyTTS;',
        '      wReg(proxyTTS, "toTimeString");',
        '      wReg(origTTS, "toTimeString");',
        '      var origDDS = Date.prototype.toDateString;',
        '      var proxyDDS = new Proxy(origDDS, {',
        '        apply: function(target, thisArg, args) {',
        '          if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {',
        '            var f = formatTzDate(thisArg, "date");',
        '            if (f) return f;',
        '          }',
        '          return target.apply(thisArg, args);',
        '        }',
        '      });',
        '      Date.prototype.toDateString = proxyDDS;',
        '      wReg(proxyDDS, "toDateString");',
        '      wReg(origDDS, "toDateString");',
        '      var hookLocale = function(prop) {',
        '        var orig = Date.prototype[prop];',
        '        if (!orig) return;',
        '        var proxy = new Proxy(orig, {',
        '          apply: function(target, thisArg, args) {',
        '            if (thisArg instanceof Date && !isNaN(thisArg.getTime())) {',
        '              var loc = args[0];',
        '              var opt = Object.assign({}, args[1]);',
        '              if (!opt.timeZone) opt.timeZone = pTz;',
        '              return target.call(thisArg, loc, opt);',
        '            }',
        '            return target.apply(thisArg, args);',
        '          }',
        '        });',
        '        Date.prototype[prop] = proxy;',
        '        wReg(proxy, prop);',
        '        wReg(orig, prop);',
        '      };',
        '      hookLocale("toLocaleString");',
        '      hookLocale("toLocaleDateString");',
        '      hookLocale("toLocaleTimeString");',
        '    }',
        '  } catch(e) {}',
        '})();'
      ].join('\\n');

      function wrapWorkerUrl(url, options) {
        if (!url) return url;
        try {
          var rawUrl = (typeof URL !== 'undefined' && url instanceof URL) ? url.href : String(url);
          var resolvedUrl;
          try {
            resolvedUrl = (typeof location !== 'undefined') ? new URL(rawUrl, location.href) : null;
          } catch(e) {
            resolvedUrl = null;
          }
          var isBlob = rawUrl.startsWith('blob:');
          var isSameOrigin = resolvedUrl && (typeof location !== 'undefined') && (resolvedUrl.origin === location.origin);

          if (options && options.type === 'module') {
            if (resolvedUrl) {
              var moduleWrapper = workerBootstrapJs + '\\n;import ' + JSON.stringify(resolvedUrl.href) + ';';
              return URL.createObjectURL(new Blob([moduleWrapper], { type: 'application/javascript' }));
            }
            return url;
          }

          if (isBlob || isSameOrigin) {
            var fetchUrl = isBlob ? rawUrl : resolvedUrl.href;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', fetchUrl, false);
            xhr.send();
            if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
              var combined = workerBootstrapJs + '\\n;' + xhr.responseText;
              return URL.createObjectURL(new Blob([combined], { type: 'application/javascript' }));
            }
          }
        } catch(e) {}
        return url;
      }

      if (typeof Worker !== 'undefined') {
        var origWorker = window.Worker;
        var ProxyWorker = new Proxy(origWorker, {
          construct: function(target, args, newTarget) {
            var targetUrl = wrapWorkerUrl(args[0], args[1]);
            var newArgs = [targetUrl].concat(args.slice(1));
            return Reflect.construct(target, newArgs, newTarget);
          }
        });
        try { ProxyWorker.prototype = origWorker.prototype; } catch(e) {}
        window.Worker = ProxyWorker;
        registerNative(ProxyWorker, 'Worker');
        registerNative(origWorker, 'Worker');
      }

      if (typeof SharedWorker !== 'undefined') {
        var origSharedWorker = window.SharedWorker;
        var ProxySharedWorker = new Proxy(origSharedWorker, {
          construct: function(target, args, newTarget) {
            var targetUrl = wrapWorkerUrl(args[0], args[1]);
            var newArgs = [targetUrl].concat(args.slice(1));
            return Reflect.construct(target, newArgs, newTarget);
          }
        });
        try { ProxySharedWorker.prototype = origSharedWorker.prototype; } catch(e) {}
        window.SharedWorker = ProxySharedWorker;
        registerNative(ProxySharedWorker, 'SharedWorker');
        registerNative(origSharedWorker, 'SharedWorker');
      }
    } catch(e) {}

    // -------------------------------------------------------------
    // User-Agent Client Hints (navigator.userAgentData) Native Masking
    // -------------------------------------------------------------
    if (!${isCamoufox}) {
      try {
        var brandVersion = ${JSON.stringify(chromeMajorVer)};
        var chromeFullVer = ${JSON.stringify(chromeFullVer)};
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

        var dummyUaProto = {
          get brands() {
            if (typeof NavigatorUAData !== 'undefined' && (!this || !(this instanceof NavigatorUAData))) {
              throw new TypeError("Failed to read the 'brands' property from 'NavigatorUAData': Illegal invocation");
            }
            return defaultBrands;
          },
          get mobile() {
            if (typeof NavigatorUAData !== 'undefined' && (!this || !(this instanceof NavigatorUAData))) {
              throw new TypeError("Failed to read the 'mobile' property from 'NavigatorUAData': Illegal invocation");
            }
            return chMobile;
          },
          get platform() {
            if (typeof NavigatorUAData !== 'undefined' && (!this || !(this instanceof NavigatorUAData))) {
              throw new TypeError("Failed to read the 'platform' property from 'NavigatorUAData': Illegal invocation");
            }
            return chPlatform;
          }
        };

        var getBrands = Object.getOwnPropertyDescriptor(dummyUaProto, 'brands').get;
        var getMobile = Object.getOwnPropertyDescriptor(dummyUaProto, 'mobile').get;
        var getPlatform = Object.getOwnPropertyDescriptor(dummyUaProto, 'platform').get;

        var getHighEntropyValues = function getHighEntropyValues(hints) {
          if (typeof NavigatorUAData !== 'undefined' && (!this || !(this instanceof NavigatorUAData))) {
            return Promise.reject(new TypeError("Failed to execute 'getHighEntropyValues' on 'NavigatorUAData': Illegal invocation"));
          }
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
        };

        var toJSON = function toJSON() {
          if (typeof NavigatorUAData !== 'undefined' && (!this || !(this instanceof NavigatorUAData))) {
            throw new TypeError("Failed to execute 'toJSON' on 'NavigatorUAData': Illegal invocation");
          }
          return {
            brands: defaultBrands,
            mobile: chMobile,
            platform: chPlatform
          };
        };

        var uaDataObj;
        var uaTargetProto = (typeof window.NavigatorUAData !== 'undefined' && window.NavigatorUAData.prototype) ? window.NavigatorUAData.prototype : null;
        if (uaTargetProto) {
          Object.defineProperties(uaTargetProto, {
            brands: { get: getBrands, enumerable: true, configurable: true },
            mobile: { get: getMobile, enumerable: true, configurable: true },
            platform: { get: getPlatform, enumerable: true, configurable: true },
            getHighEntropyValues: { value: getHighEntropyValues, enumerable: true, configurable: true, writable: true },
            toJSON: { value: toJSON, enumerable: true, configurable: true, writable: true },
          });
          if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
            try { Object.defineProperty(uaTargetProto, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) {}
          }
          uaDataObj = Object.create(uaTargetProto);
        } else {
          uaDataObj = {};
          Object.defineProperties(uaDataObj, {
            brands: { get: getBrands, enumerable: true, configurable: true },
            mobile: { get: getMobile, enumerable: true, configurable: true },
            platform: { get: getPlatform, enumerable: true, configurable: true },
            getHighEntropyValues: { value: getHighEntropyValues, enumerable: true, configurable: true, writable: true },
            toJSON: { value: toJSON, enumerable: true, configurable: true, writable: true },
          });
        }
        if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
          try { Object.defineProperty(uaDataObj, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) {}
        }

        registerNative(getBrands, 'get brands');
        registerNative(getMobile, 'get mobile');
        registerNative(getPlatform, 'get platform');
        registerNative(getHighEntropyValues, 'getHighEntropyValues');
        registerNative(toJSON, 'toJSON');

        var origUaDataDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgentData');
        var dummyUa = { get userAgentData() { return uaDataObj; } };
        var fallbackUaGetter = Object.getOwnPropertyDescriptor(dummyUa, 'userAgentData').get;
        var targetUaGetter = (origUaDataDesc && origUaDataDesc.get && origUaDataDesc.get.name === 'get userAgentData')
          ? origUaDataDesc.get
          : fallbackUaGetter;
        var proxyUaData = new Proxy(targetUaGetter, {
          apply: function(target, thisArg, argumentsList) {
            if (!thisArg || !(thisArg instanceof Navigator)) {
              if (origUaDataDesc && typeof origUaDataDesc.get === 'function') {
                try {
                  return origUaDataDesc.get.apply(thisArg, argumentsList);
                } catch(e) {
                  throw e;
                }
              }
              throw new TypeError("Failed to execute 'userAgentData' on 'Navigator': Illegal invocation");
            }
            return uaDataObj;
          }
        });

        Object.defineProperty(Navigator.prototype, 'userAgentData', {
          get: proxyUaData,
          enumerable: true,
          configurable: true
        });

        registerNative(proxyUaData, 'get userAgentData');
        if (origUaDataDesc && origUaDataDesc.get) registerNative(origUaDataDesc.get, 'get userAgentData');
      } catch(e) {}
    }

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

        try {
          Object.defineProperty(screen, 'orientation', {
            get: function() {
              return {
                angle: 0,
                type: 'portrait-primary',
                onchange: null
              };
            },
            configurable: true,
            enumerable: true
          });
        } catch(e) {}

        try {
          if (navigator.connection) {
            var fakeConn = {
              effectiveType: '4g',
              rtt: 50,
              downlink: 10,
              saveData: false,
              type: 'cellular'
            };
            Object.defineProperty(navigator, 'connection', {
              get: function() { return fakeConn; },
              configurable: true,
              enumerable: true
            });
          }
        } catch(e) {}

        try {
          var mobileBattLevel = 0.65 + ((pSeed % 30) / 100);
          navigator.getBattery = function() {
            return Promise.resolve({
              charging: false,
              chargingTime: Infinity,
              dischargingTime: 14400,
              level: mobileBattLevel,
              onchargingchange: null,
              onchargingtimechange: null,
              ondischargingtimechange: null,
              onlevelchange: null
            });
          };
          registerNative(navigator.getBattery, 'getBattery');
        } catch(e) {}
      } catch(e) {}
    }
  } catch(e) {}

  // -------------------------------------------------------------
  // 3. Canvas Dynamic Hash Perturbation (Single-Pass Noise)
  // -------------------------------------------------------------
  if (${canvasMode !== 'off'}) {
    try {
      var seedOffset = (pSeed % 15) + 1;

      function applyNoiseToImageData(imgData, sx, sy, canvasWidth, canvasHeight) {
        if (!imgData || !imgData.data) return imgData;
        var sw = imgData.width;
        var sh = imgData.height;
        var cw = canvasWidth || sw;
        var ch = canvasHeight || sh;
        if (cw <= 8 || ch <= 8 || sw <= 8 || sh <= 8) return imgData;
        var data = imgData.data;
        var startX = sx || 0;
        var startY = sy || 0;

        for (var y = 0; y < sh; y++) {
          var gy = startY + y;
          for (var x = 0; x < sw; x++) {
            var gx = startX + x;
            var _h = Math.imul(gx + 0x9E3779B9, 0x85EBCA6B) ^
                 Math.imul(gy + pSeed, 0xC2B2AE35) ^ seedOffset;
        _h ^= _h >>> 15; _h = Math.imul(_h, 0x2545F491);
        _h ^= _h >>> 13;
        if ((_h & 127) === 0) {
              var dataIdx = (y * sw + x) * 4;
              if (data[dataIdx + 3] === 0) continue;
              var chIdx = (pSeed + gx + gy) % 3;
              data[dataIdx + chIdx] ^= 1;
            }
          }
        }
        return imgData;
      }

      var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      var origToBlob = HTMLCanvasElement.prototype.toBlob;
      var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      var origPutImageData = CanvasRenderingContext2D.prototype.putImageData;

      var proxyToDataURL = new Proxy(origToDataURL, {
        apply: function(target, thisArg, argumentsList) {
          try {
            if (thisArg.width > 8 && thisArg.height > 8) {
              var clone = document.createElement('canvas');
              clone.width = thisArg.width;
              clone.height = thisArg.height;
              var ctx = clone.getContext('2d');
              if (ctx) {
                ctx.drawImage(thisArg, 0, 0);
                var imgData = origGetImageData.call(ctx, 0, 0, clone.width, clone.height);
                applyNoiseToImageData(imgData, 0, 0, clone.width, clone.height);
                origPutImageData.call(ctx, imgData, 0, 0);
                return target.apply(clone, argumentsList);
              }
            }
          } catch(e) {}
          return target.apply(thisArg, argumentsList);
        }
      });
      HTMLCanvasElement.prototype.toDataURL = proxyToDataURL;
      registerNative(proxyToDataURL, 'toDataURL');
      registerNative(origToDataURL, 'toDataURL');

      if (origToBlob) {
        var proxyToBlob = new Proxy(origToBlob, {
          apply: function(target, thisArg, argumentsList) {
            try {
              if (thisArg.width > 8 && thisArg.height > 8) {
                var clone = document.createElement('canvas');
                clone.width = thisArg.width;
                clone.height = thisArg.height;
                var ctx = clone.getContext('2d');
                if (ctx) {
                  ctx.drawImage(thisArg, 0, 0);
                  var imgData = origGetImageData.call(ctx, 0, 0, clone.width, clone.height);
                  applyNoiseToImageData(imgData, 0, 0, clone.width, clone.height);
                  origPutImageData.call(ctx, imgData, 0, 0);
                  return target.apply(clone, argumentsList);
                }
              }
            } catch(e) {}
            return target.apply(thisArg, argumentsList);
          }
        });
        HTMLCanvasElement.prototype.toBlob = proxyToBlob;
        registerNative(proxyToBlob, 'toBlob');
        registerNative(origToBlob, 'toBlob');
      }

      var proxyGetImageData = new Proxy(origGetImageData, {
        apply: function(target, thisArg, argumentsList) {
          var imgData = target.apply(thisArg, argumentsList);
          try {
            var sx = Number(argumentsList[0]) || 0;
            var sy = Number(argumentsList[1]) || 0;
            var cw = (thisArg && thisArg.canvas) ? thisArg.canvas.width : imgData.width;
            var ch = (thisArg && thisArg.canvas) ? thisArg.canvas.height : imgData.height;
            applyNoiseToImageData(imgData, sx, sy, cw, ch);
          } catch(e) {}
          return imgData;
        }
      });
      CanvasRenderingContext2D.prototype.getImageData = proxyGetImageData;
      registerNative(proxyGetImageData, 'getImageData');
      registerNative(origGetImageData, 'getImageData');

      if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype) {
        var origOffscreenGetImageData = (typeof OffscreenCanvasRenderingContext2D !== 'undefined' && OffscreenCanvasRenderingContext2D.prototype)
          ? OffscreenCanvasRenderingContext2D.prototype.getImageData
          : null;
        if (origOffscreenGetImageData) {
          var proxyOffscreenGetImageData = new Proxy(origOffscreenGetImageData, {
            apply: function(target, thisArg, argumentsList) {
              var imgData = target.apply(thisArg, argumentsList);
              try {
                var sx = Number(argumentsList[0]) || 0;
                var sy = Number(argumentsList[1]) || 0;
                var cw = (thisArg && thisArg.canvas) ? thisArg.canvas.width : imgData.width;
                var ch = (thisArg && thisArg.canvas) ? thisArg.canvas.height : imgData.height;
                applyNoiseToImageData(imgData, sx, sy, cw, ch);
              } catch(e) {}
              return imgData;
            }
          });
          OffscreenCanvasRenderingContext2D.prototype.getImageData = proxyOffscreenGetImageData;
          registerNative(proxyOffscreenGetImageData, 'getImageData');
          registerNative(origOffscreenGetImageData, 'getImageData');
        }

        if (OffscreenCanvas.prototype.convertToBlob) {
          var origConvertToBlob = OffscreenCanvas.prototype.convertToBlob;
          var proxyConvertToBlob = new Proxy(origConvertToBlob, {
            apply: function(target, thisArg, argumentsList) {
              try {
                if (thisArg.width > 8 && thisArg.height > 8) {
                  var clone = new OffscreenCanvas(thisArg.width, thisArg.height);
                  var cloneCtx = clone.getContext('2d');
                  if (cloneCtx) {
                    cloneCtx.drawImage(thisArg, 0, 0);
                    var imgData = origOffscreenGetImageData
                      ? origOffscreenGetImageData.call(cloneCtx, 0, 0, clone.width, clone.height)
                      : cloneCtx.getImageData(0, 0, clone.width, clone.height);
                    applyNoiseToImageData(imgData, 0, 0, clone.width, clone.height);
                    if (cloneCtx.putImageData) cloneCtx.putImageData(imgData, 0, 0);
                    return target.apply(clone, argumentsList);
                  }
                }
              } catch(e) {}
              return target.apply(thisArg, argumentsList);
            }
          });
          OffscreenCanvas.prototype.convertToBlob = proxyConvertToBlob;
          registerNative(proxyConvertToBlob, 'convertToBlob');
          registerNative(origConvertToBlob, 'convertToBlob');
        }
      }
    } catch(e) {}
  }

  // -------------------------------------------------------------
  // 3.5 ClientRects DOM Subpixel Jitter (Multi-Method Parity)
  // -------------------------------------------------------------
  if (${clientRectsMode !== 'off'}) {
    try {
      function shiftDOMRectList(origList, shift) {
        if (!origList || origList.length === 0 || shift === 0) return origList;
        var count = origList.length || 0;
        var shifted = [];
        for (var i = 0; i < count; i++) {
          var r = origList[i] || (origList.item && origList.item(i));
          if (r) {
            if (r.width === 0 && r.height === 0) {
              shifted.push(r);
            } else {
              shifted.push(new DOMRect(r.x + shift, r.y + shift, r.width, r.height));
            }
          }
        }
        return new Proxy(origList, {
          get: function(target, prop, receiver) {
            if (prop === 'length') return shifted.length;
            if (prop === 'item') {
              return function(idx) { return shifted[idx] || null; };
            }
            if (prop === Symbol.iterator) {
              return function() { return shifted[Symbol.iterator](); };
            }
            var idx = Number(prop);
            if (!isNaN(idx) && idx >= 0 && idx < shifted.length) {
              return shifted[idx];
            }
            return Reflect.get(target, prop, receiver);
          }
        });
      }

      var origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
      var crShift = ((pSeed % 5) - 2) * 0.0001;
      if (crShift !== 0) {
        var proxyGetBoundingClientRect = new Proxy(origGetBoundingClientRect, {
          apply: function(target, thisArg, argumentsList) {
            var rect = target.apply(thisArg, argumentsList);
            if (!rect || (rect.width === 0 && rect.height === 0)) return rect;
            return new DOMRect(
              rect.x + crShift,
              rect.y + crShift,
              rect.width,
              rect.height
            );
          }
        });
        Element.prototype.getBoundingClientRect = proxyGetBoundingClientRect;
        registerNative(proxyGetBoundingClientRect, 'getBoundingClientRect');
        registerNative(origGetBoundingClientRect, 'getBoundingClientRect');

        if (Element.prototype.getClientRects) {
          var origGetClientRects = Element.prototype.getClientRects;
          var proxyGetClientRects = new Proxy(origGetClientRects, {
            apply: function(target, thisArg, argumentsList) {
              var rects = target.apply(thisArg, argumentsList);
              return shiftDOMRectList(rects, crShift);
            }
          });
          Element.prototype.getClientRects = proxyGetClientRects;
          registerNative(proxyGetClientRects, 'getClientRects');
          registerNative(origGetClientRects, 'getClientRects');
        }

        if (typeof window !== 'undefined' && window.Range && Range.prototype.getBoundingClientRect) {
          var origRangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;
          var proxyRangeGetBoundingClientRect = new Proxy(origRangeGetBoundingClientRect, {
            apply: function(target, thisArg, argumentsList) {
              var rect = target.apply(thisArg, argumentsList);
              if (!rect || (rect.width === 0 && rect.height === 0)) return rect;
              return new DOMRect(
                rect.x + crShift,
                rect.y + crShift,
                rect.width,
                rect.height
              );
            }
          });
          Range.prototype.getBoundingClientRect = proxyRangeGetBoundingClientRect;
          registerNative(proxyRangeGetBoundingClientRect, 'getBoundingClientRect');
          registerNative(origRangeGetBoundingClientRect, 'getBoundingClientRect');
        }

        if (typeof window !== 'undefined' && window.Range && Range.prototype.getClientRects) {
          var origRangeGetClientRects = Range.prototype.getClientRects;
          var proxyRangeGetClientRects = new Proxy(origRangeGetClientRects, {
            apply: function(target, thisArg, argumentsList) {
              var rects = target.apply(thisArg, argumentsList);
              return shiftDOMRectList(rects, crShift);
            }
          });
          Range.prototype.getClientRects = proxyRangeGetClientRects;
          registerNative(proxyRangeGetClientRects, 'getClientRects');
          registerNative(origRangeGetClientRects, 'getClientRects');
        }
      }
    } catch(e) {}
  }

  // -------------------------------------------------------------
  // 4. WebGL GPU Hardware & Renderer Spoofing + Buffer Limits
  // -------------------------------------------------------------
  if (${webglMode !== 'off'}) {
    try {
      var spoofVendor = ${JSON.stringify(gpuVendor)};
      var spoofRenderer = ${JSON.stringify(gpuRenderer)};

      var hookWebGL = function(proto) {
        var origGetParam = proto.getParameter;
        var proxyGetParam = new Proxy(origGetParam, {
          apply: function(target, thisArg, argumentsList) {
            var param = argumentsList[0];
            // UNMASKED_VENDOR_WEBGL
            if (spoofVendor && param === 37445) return spoofVendor;
            // UNMASKED_RENDERER_WEBGL
            if (spoofRenderer && param === 37446) return spoofRenderer;
            // VENDOR
            if (param === 7936) return 'WebKit';
            // RENDERER
            if (param === 7937) return 'WebKit WebGL';
            // MAX_TEXTURE_SIZE
            if (param === 3379) return 16384;
            // MAX_RENDERBUFFER_SIZE
            if (param === 34024) return 16384;
            // MAX_VERTEX_UNIFORM_VECTORS
            if (param === 36347) return 4096;
            // MAX_VARYING_VECTORS
            if (param === 36348) return 30;
            // MAX_VERTEX_ATTRIBS
            if (param === 34921) return 16;
            return target.apply(thisArg, argumentsList);
          }
        });
        proto.getParameter = proxyGetParam;
        registerNative(proxyGetParam, 'getParameter');
        registerNative(origGetParam, 'getParameter');

        var cachedExtMap = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
        var origGetExtension = proto.getExtension;
        var proxyGetExtension = new Proxy(origGetExtension, {
          apply: function(target, thisArg, argumentsList) {
            var name = argumentsList[0];
            var ext = target.apply(thisArg, argumentsList);
            if (name === 'WEBGL_debug_renderer_info') {
              if (!ext) return null;
              if (cachedExtMap) {
                var cached = cachedExtMap.get(thisArg);
                if (cached) return cached;
                try {
                  if (ext.UNMASKED_VENDOR_WEBGL === undefined) ext.UNMASKED_VENDOR_WEBGL = 37445;
                  if (ext.UNMASKED_RENDERER_WEBGL === undefined) ext.UNMASKED_RENDERER_WEBGL = 37446;
                } catch(e) {}
                cachedExtMap.set(thisArg, ext);
                return ext;
              }
              return ext;
            }
            return ext;
          }
        });
        proto.getExtension = proxyGetExtension;
        registerNative(proxyGetExtension, 'getExtension');
        registerNative(origGetExtension, 'getExtension');

        // Deterministic readPixels micro-jitter if webgl noise is enabled
        if (proto.readPixels) {
          var origReadPixels = proto.readPixels;
          var proxyReadPixels = new Proxy(origReadPixels, {
            apply: function(target, thisArg, args) {
              var res = target.apply(thisArg, args);
              var pixels = args[6];
              if (pixels && (pixels instanceof Uint8Array || (typeof Uint8ClampedArray !== 'undefined' && pixels instanceof Uint8ClampedArray)) && pixels.length >= 16) {
                var step = Math.max(16, (pixels.length >> 4) & ~3);
                for (var i = 0; i < pixels.length; i += step) {
                  if ((i + 3) < pixels.length && pixels[i + 3] === 0) continue;
                  pixels[i] ^= 1;
                }
              }
              return res;
            }
          });
          proto.readPixels = proxyReadPixels;
          registerNative(proxyReadPixels, 'readPixels');
          registerNative(origReadPixels, 'readPixels');
        }
      };

      if (window.WebGLRenderingContext) hookWebGL(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) hookWebGL(WebGL2RenderingContext.prototype);
    } catch(e) {}
  }

  // -------------------------------------------------------------
  // 4.5 WebGPU Hardware Descriptors (Dawn Engine)
  // -------------------------------------------------------------
  try {
    if (${gpuSpoofOn} && navigator.gpu && navigator.gpu.requestAdapter) {
      var gpuInfo = {
        architecture: ${JSON.stringify(isMobile ? 'valhall' : (isMacArm ? 'apple-m1' : 'ampere'))},
        vendor: ${JSON.stringify(isMobile ? 'arm' : (isMacArm ? 'apple' : (isLinux ? 'mesa' : 'nvidia')))},
        device: ${JSON.stringify(gpuRenderer)},
        description: ${JSON.stringify(gpuRenderer)},
      };

      if (typeof GPUAdapter !== 'undefined' && GPUAdapter.prototype) {
        var dummyAdapter = {
          get info() {
            if (!this || !(this instanceof GPUAdapter)) {
              throw new TypeError("Failed to read the 'info' property from 'GPUAdapter': Illegal invocation");
            }
            return gpuInfo;
          }
        };
        var infoGetter = Object.getOwnPropertyDescriptor(dummyAdapter, 'info').get;
        Object.defineProperty(GPUAdapter.prototype, 'info', {
          get: infoGetter,
          configurable: true,
          enumerable: true
        });
        registerNative(infoGetter, 'get info');

        if (GPUAdapter.prototype.requestAdapterInfo) {
          var origReqInfo = GPUAdapter.prototype.requestAdapterInfo;
          var proxyReqInfo = new Proxy(origReqInfo, {
            apply: function(target, thisArg) {
              if (!thisArg || !(thisArg instanceof GPUAdapter)) {
                return Promise.reject(new TypeError("Failed to execute 'requestAdapterInfo' on 'GPUAdapter': Illegal invocation"));
              }
              return Promise.resolve(gpuInfo);
            }
          });
          GPUAdapter.prototype.requestAdapterInfo = proxyReqInfo;
          registerNative(proxyReqInfo, 'requestAdapterInfo');
          registerNative(origReqInfo, 'requestAdapterInfo');
        }
      }

      var origRequestAdapter = navigator.gpu.requestAdapter;
      var proxyRequestAdapter = new Proxy(origRequestAdapter, {
        apply: function(target, thisArg, args) {
          return target.apply(thisArg, args).then(function(adapter) {
            if (!adapter) return adapter;
            try {
              if (typeof GPUAdapter === 'undefined') {
                Object.defineProperty(adapter, 'info', {
                  get: function() { return gpuInfo; },
                  configurable: true,
                  enumerable: true
                });
                if (adapter.requestAdapterInfo) {
                  var origReqInfo = adapter.requestAdapterInfo;
                  var proxyReqInfo = new Proxy(origReqInfo, {
                    apply: function() { return Promise.resolve(gpuInfo); }
                  });
                  adapter.requestAdapterInfo = proxyReqInfo;
                  registerNative(proxyReqInfo, 'requestAdapterInfo');
                  registerNative(origReqInfo, 'requestAdapterInfo');
                }
              }
            } catch(e) {}
            return adapter;
          });
        }
      });
      navigator.gpu.requestAdapter = proxyRequestAdapter;
      registerNative(proxyRequestAdapter, 'requestAdapter');
      registerNative(origRequestAdapter, 'requestAdapter');
    }
  } catch(e) {}

  // -------------------------------------------------------------
  // 5. AudioContext Acoustic Frequency Jitter (No In-Place Drift)
  // -------------------------------------------------------------
  if (${audioMode !== 'off'}) {
    try {
      if (typeof window !== 'undefined' && window.AudioBuffer) {
        var perturbedBuffers = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
        var isBufferSilent = function(buf) {
          for (var si = 0; si < buf.length; si++) {
            if (buf[si] !== 0) return false;
          }
          return true;
        };

        var origGetChannelData = AudioBuffer.prototype.getChannelData;
        var proxyGetChannelData = new Proxy(origGetChannelData, {
          apply: function(target, thisArg, argumentsList) {
            var buffer = target.apply(thisArg, argumentsList);
            if (perturbedBuffers && !perturbedBuffers.has(buffer)) {
              perturbedBuffers.add(buffer);
              if (!isBufferSilent(buffer)) {
                var offset = ((pSeed % 7) + 1) * 0.0000001;
                for (var i = 0; i < buffer.length; i += 100) {
                  buffer[i] += offset;
                }
              }
            }
            return buffer;
          }
        });
        AudioBuffer.prototype.getChannelData = proxyGetChannelData;
        registerNative(proxyGetChannelData, 'getChannelData');
        registerNative(origGetChannelData, 'getChannelData');

        if (AudioBuffer.prototype.copyFromChannel) {
          var origCopyFromChannel = AudioBuffer.prototype.copyFromChannel;
          var proxyCopyFromChannel = new Proxy(origCopyFromChannel, {
            apply: function(target, thisArg, args) {
              var destination = args[0];
              var channelNumber = args[1] || 0;
              var bufferOffset = args[2] || 0;
              var chData = proxyGetChannelData.call(thisArg, channelNumber);
              if (destination && chData) {
                for (var ci = 0; ci < destination.length && (ci + bufferOffset) < chData.length; ci++) {
                  destination[ci] = chData[ci + bufferOffset];
                }
                return;
              }
              return target.apply(thisArg, args);
            }
          });
          AudioBuffer.prototype.copyFromChannel = proxyCopyFromChannel;
          registerNative(proxyCopyFromChannel, 'copyFromChannel');
          registerNative(origCopyFromChannel, 'copyFromChannel');
        }
      }
    } catch(e) {}
  }

  // -------------------------------------------------------------
  // 6. WebRTC JS Leak Guard (Relay Policy & Local IP Sanitization)
  // -------------------------------------------------------------
  try {
    var rtcMode = ${JSON.stringify(webrtcOpt)};
    if (rtcMode === 'proxy_only' || rtcMode === 'disabled' || rtcMode === 'disable_non_proxied_udp') {
      var hookedProtos = new WeakSet();
      var hookPeerConnection = function(RTCClass, name) {
        if (!RTCClass) return;
        var OrigPC = RTCClass;

        if (OrigPC.prototype && !hookedProtos.has(OrigPC.prototype)) {
          hookedProtos.add(OrigPC.prototype);
          var userIceHandlers = new WeakMap();
          var protoDesc = Object.getOwnPropertyDescriptor(OrigPC.prototype, 'onicecandidate');
          var origProtoSet = protoDesc ? protoDesc.set : null;
          var origProtoGet = protoDesc ? protoDesc.get : null;

          var proxyProtoSet = function(fn) {
            if (typeof fn === 'function') {
              var self = this;
              var wrapped = function(event) {
                if (event && event.candidate && event.candidate.candidate) {
                  var c = event.candidate.candidate;
                  if (c.indexOf('typ host') !== -1 || c.indexOf('typ srflx') !== -1) {
                    return;
                  }
                }
                return fn.call(self, event);
              };
              wrapped._userFn = fn;
              userIceHandlers.set(this, wrapped);
              if (origProtoSet) {
                return origProtoSet.call(this, wrapped);
              }
            } else {
              userIceHandlers.delete(this);
              if (origProtoSet) {
                return origProtoSet.call(this, fn);
              }
            }
          };

          var proxyProtoGet = function() {
            var h = userIceHandlers.get(this);
            if (h) return h._userFn || h;
            if (origProtoGet) return origProtoGet.call(this);
            return null;
          };

          registerNative(proxyProtoSet, 'set onicecandidate');
          registerNative(proxyProtoGet, 'get onicecandidate');
          if (origProtoSet) registerNative(origProtoSet, 'set onicecandidate');
          if (origProtoGet) registerNative(origProtoGet, 'get onicecandidate');

          try {
            Object.defineProperty(OrigPC.prototype, 'onicecandidate', {
              get: proxyProtoGet,
              set: proxyProtoSet,
              enumerable: protoDesc ? protoDesc.enumerable : true,
              configurable: protoDesc ? protoDesc.configurable : true
            });
          } catch(e) {}
        }

        var ProxyPC = function(config, constraints) {
          var conf = Object.assign({}, config);
          if (rtcMode === 'proxy_only' || rtcMode === 'disabled' || rtcMode === 'disable_non_proxied_udp') {
            conf.iceTransportPolicy = 'relay';
          }
          var pc = new OrigPC(conf, constraints);

          try {
            if (Object.prototype.hasOwnProperty.call(pc, 'onicecandidate')) {
              delete pc.onicecandidate;
            }
          } catch(e) {}

          if (pc.addIceCandidate) {
            var origAddIce = pc.addIceCandidate;
            pc.addIceCandidate = new Proxy(origAddIce, {
              apply: function(target, thisArg, args) {
                var cand = args[0];
                if (cand && cand.candidate) {
                  if (cand.candidate.indexOf('typ host') !== -1 || cand.candidate.indexOf('typ srflx') !== -1) {
                    return Promise.resolve();
                  }
                }
                return target.apply(thisArg, args);
              }
            });
            registerNative(pc.addIceCandidate, 'addIceCandidate');
          }

          if (pc.addEventListener) {
            var origAddEv = pc.addEventListener;
            pc.addEventListener = function(type, listener, options) {
              if (type === 'icecandidate' && typeof listener === 'function') {
                var wrapped = function(event) {
                  if (event && event.candidate && event.candidate.candidate) {
                    var c = event.candidate.candidate;
                    if (c.indexOf('typ host') !== -1 || c.indexOf('typ srflx') !== -1) {
                      return;
                    }
                  }
                  return listener.call(this, event);
                };
                return origAddEv.call(this, type, wrapped, options);
              }
              return origAddEv.apply(this, arguments);
            };
            registerNative(pc.addEventListener, 'addEventListener');
          }

          if (pc.dispatchEvent) {
            var origDispatch = pc.dispatchEvent;
            pc.dispatchEvent = function(event) {
              if (event && event.candidate && event.candidate.candidate) {
                var c = event.candidate.candidate;
                if (c.indexOf('typ host') !== -1 || c.indexOf('typ srflx') !== -1) {
                  return true;
                }
              }
              return origDispatch.apply(this, arguments);
            };
            registerNative(pc.dispatchEvent, 'dispatchEvent');
          }

          function filterSDP(desc) {
            if (desc && desc.sdp) {
              var lines = desc.sdp.split('\\r\\n');
              var filtered = lines.filter(function(line) {
                if (line.startsWith('a=candidate:') && (line.indexOf('typ host') !== -1 || line.indexOf('typ srflx') !== -1)) {
                  return false;
                }
                return true;
              });
              var newSdp = filtered.join('\\r\\n');
              if (typeof RTCSessionDescription !== 'undefined') {
                try {
                  return new RTCSessionDescription({ type: desc.type, sdp: newSdp });
                } catch(e) {}
              }
              return { type: desc.type, sdp: newSdp };
            }
            return desc;
          }

          if (pc.createOffer) {
            var origCreateOffer = pc.createOffer;
            pc.createOffer = new Proxy(origCreateOffer, {
              apply: function(target, thisArg, args) {
                return target.apply(thisArg, args).then(filterSDP);
              }
            });
            registerNative(pc.createOffer, 'createOffer');
          }

          if (pc.createAnswer) {
            var origCreateAnswer = pc.createAnswer;
            pc.createAnswer = new Proxy(origCreateAnswer, {
              apply: function(target, thisArg, args) {
                return target.apply(thisArg, args).then(filterSDP);
              }
            });
            registerNative(pc.createAnswer, 'createAnswer');
          }

          return pc;
        };
        ProxyPC.prototype = OrigPC.prototype;
        window[name] = ProxyPC;
        registerNative(ProxyPC, name);
      };

      if (window.RTCPeerConnection) hookPeerConnection(window.RTCPeerConnection, 'RTCPeerConnection');
      if (window.webkitRTCPeerConnection) hookPeerConnection(window.webkitRTCPeerConnection, 'webkitRTCPeerConnection');
    }
  } catch(e) {}
})();
`;

  // 2. Background Service Worker: Connects to local SSE stream & dispatches to all tabs
  const backgroundJs = `
(function() {
  var profileId = ${JSON.stringify(profileId)};
  var pNum = ${JSON.stringify(badgeNumber)};
  var pName = ${JSON.stringify(profileName)};
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

  // In clean production mode, suppress the in-page badge and title prefix unless explicitly enabled in settings.
  var enableInPageBadge = ${JSON.stringify((settings?.browser as any)?.showProfileBadge === true || (settings as any)?.showProfileBadge === true)};
  if (enableInPageBadge) {
    try {
      updateTitle();
      var observer = new MutationObserver(updateTitle);
      observer.observe(document.querySelector('head') || document.documentElement, {
        subtree: true,
        characterData: true,
        childList: true
      });
    } catch(e) {}
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

  function showClickRipple(x, y) {
    // Zero DOM footprint to prevent anti-bot MutationObserver detection on external target pages
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
  if (!isNativeStealth) {
    fs.writeFileSync(path.join(extDir, 'stealth-core.js'), stealthCoreJs, 'utf8');
  } else {
    const oldStealthCore = path.join(extDir, 'stealth-core.js');
    if (fs.existsSync(oldStealthCore)) {
      try { fs.unlinkSync(oldStealthCore); } catch {}
    }
  }
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
  isNativeStealth?: boolean;
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
  const { storageDir, debugPort, loadExtensionsArg, settings, mode = 'normal', isNativeStealth = false } = options;

  const args: string[] = [
    `--user-data-dir=${storageDir}`,
    '--new-window',
    `--remote-debugging-port=${debugPort}`,
  ];

  if (loadExtensionsArg) {
    const cleanedExts = Array.from(
      new Set(
        loadExtensionsArg
          .split(',')
          .map((p) => p.trim().replace(/[/\\]+$/, ''))
          .filter(Boolean)
      )
    ).join(',');

    if (cleanedExts) {
      args.push(`--load-extension=${cleanedExts}`);
      // DO NOT add --disable-extensions-except: it disables the extension system and
      // triggers Chromium's IDS_EXTENSION_INSTALL_NOT_ENABLED ("Installation is not enabled")
      // on Chrome Web Store installs and disables user-installed extensions on restart.
    }
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
    '--disable-blink-features=AutomationControlled',
    '--disable-features=Translate,OptimizationHints,MediaRouter,ExtensionDeveloperModeWarning,PrivacySandboxSettings4,ChromeForTestingDisclaimer,HttpsFirstMode,HttpsUpgrades'
  );

  // In Normal User Mode, NEVER add test automation switches.
  // In Automation Mode, inject rebrowser-patches CDP isolation switch ONLY when running native stealth engine.
  if (mode === 'automation' && isNativeStealth) {
    args.push('--mahi-cdp-isolated');
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
  const webrtcOpt = settings?.network?.webrtc;
  if (webrtcOpt === 'disable_non_proxied_udp' || webrtcOpt === 'disabled' || webrtcOpt === 'proxy_only') {
    args.push('--force-webrtc-ip-handling-policy');
    args.push('--webrtc-ip-handling-policy=disable_non_proxied_udp');
  } else if (webrtcOpt === 'default_public_interface_only' || webrtcOpt === 'public_interface_only') {
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
 * Dedicated launch branch for Camoufox (C++ Patched Firefox) profiles.
 * Suppresses all Chromium-specific flags and applies clean Firefox CLI flags and
 * chunked CAMOU_CONFIG_* environment variables for deep anti-detect spoofing.
 */
export async function launchCamoufoxProfile(
  profile: Profile,
  launchOptions?: { mode?: 'normal' | 'automation' }
): Promise<LaunchedProcessInfo> {
  debugLog(`=======================================================`);
  debugLog(`[Camoufox Launcher] Starting launch sequence for profile: "${profile.name}" (ID: ${profile.id})`);

  let proxyTunnel: ProxyTunnelHandle | undefined;

  try {
    let executablePath: string;
    try {
      executablePath = resolveExecutablePath('camoufox', profile.customExecutablePath);
    } catch {
      debugLog(`[Camoufox Launcher] Camoufox not found locally, provisioning on-demand...`);
      executablePath = await ensureCamoufoxInstalled({
        onProgress: (receivedBytes, totalBytes) => {
          const pct = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;
          debugLog(`[Camoufox Provisioner] Downloading: ${receivedBytes}/${totalBytes} (${pct}%)`);
        }
      });
    }
    debugLog(`[Camoufox Launcher] Executable resolved: "${executablePath}"`);

    const storageDir = path.resolve(profile.storagePath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    } else {
      cleanupStaleLocks(storageDir);
    }

    const settings = profile.settings || ({} as any);
    const fp = settings.fingerprint || {};
    const disp = settings.display || {};
    const loc = settings.locale || {};

    // Build clean Firefox CLI arguments
    const args: string[] = [
      '-profile',
      storageDir,
      '-no-remote',
      '-new-instance',
    ];

    // Proxy and WebRTC configuration
    let resolvedPublicIp: string | undefined;
    const firefoxPrefs: Record<string, any> = {};

    if (!settings?.network?.directConnection && settings?.network?.proxyId) {
      const proxy = getProxyById(settings.network.proxyId);
      if (proxy) {
        try {
          debugLog(`[Camoufox Launcher] Testing proxy health for ${proxy.host}:${proxy.port}...`);
          const healthResult = await testAndSaveProxyStatus(proxy.id);
          if (healthResult?.ip && !healthResult.ip.startsWith('127.') && healthResult.ip !== '0.0.0.0') {
            resolvedPublicIp = healthResult.ip;
          }
        } catch (healthErr: any) {
          debugLog(`[Camoufox Launcher] Proxy health check note: ${healthErr.message}`);
        }

        const credentials = getDecryptedProxyCredentials(proxy.id);
        if (credentials?.username && credentials?.password) {
          proxyTunnel = await createProxyTunnel({
            upstreamHost: proxy.host,
            upstreamPort: proxy.port,
            upstreamProtocol: proxy.protocol,
            username: credentials.username,
            password: credentials.password,
            profileId: profile.id,
          });

          // Local tunnel is an HTTP proxy
          firefoxPrefs['network.proxy.type'] = 1;
          firefoxPrefs['network.proxy.http'] = '127.0.0.1';
          firefoxPrefs['network.proxy.http_port'] = proxyTunnel.port;
          firefoxPrefs['network.proxy.ssl'] = '127.0.0.1';
          firefoxPrefs['network.proxy.ssl_port'] = proxyTunnel.port;
          firefoxPrefs['network.proxy.no_proxies_on'] = 'localhost, 127.0.0.1';
        } else {
          // Direct unauthenticated proxy
          firefoxPrefs['network.proxy.type'] = 1;
          firefoxPrefs['network.proxy.no_proxies_on'] = 'localhost, 127.0.0.1';
          const isSocks = proxy.protocol === 'socks4' || proxy.protocol === 'socks5';
          if (isSocks) {
            firefoxPrefs['network.proxy.socks'] = proxy.host;
            firefoxPrefs['network.proxy.socks_port'] = proxy.port;
            firefoxPrefs['network.proxy.socks_version'] = proxy.protocol === 'socks4' ? 4 : 5;
            firefoxPrefs['network.proxy.socks_remote_dns'] = true;
          } else {
            firefoxPrefs['network.proxy.http'] = proxy.host;
            firefoxPrefs['network.proxy.http_port'] = proxy.port;
            firefoxPrefs['network.proxy.ssl'] = proxy.host;
            firefoxPrefs['network.proxy.ssl_port'] = proxy.port;
          }
        }
      } else {
        firefoxPrefs['network.proxy.type'] = 0;
      }
    } else {
      // Direct connection
      firefoxPrefs['network.proxy.type'] = 0;
    }

    // WebRTC policy
    const webrtcOpt = settings?.network?.webrtc || 'default';
    if (webrtcOpt === 'disabled') {
      firefoxPrefs['media.peerconnection.enabled'] = false;
    } else if (webrtcOpt === 'proxy_only' || (!resolvedPublicIp && firefoxPrefs['network.proxy.type'] === 1)) {
      firefoxPrefs['media.peerconnection.ice.proxy_only_if_behind_proxy'] = true;
      firefoxPrefs['media.peerconnection.ice.default_address_only'] = true;
    }

    // Synchronize Firefox user.js prefs in profile storage
    const userJsPath = path.join(storageDir, 'user.js');
    let existingUserJs = '';
    if (fs.existsSync(userJsPath)) {
      try { existingUserJs = fs.readFileSync(userJsPath, 'utf8'); } catch {}
    }
    const MAHI_BLOCK_START = '// --- MAHI CAMOUFOX NETWORK CONFIG START ---';
    const MAHI_BLOCK_END = '// --- MAHI CAMOUFOX NETWORK CONFIG END ---';
    const blockRegex = new RegExp(`${MAHI_BLOCK_START}[\\s\\S]*?${MAHI_BLOCK_END}\\n?`, 'g');
    const cleanedUserJs = existingUserJs.replace(blockRegex, '').trim();

    const prefLines: string[] = [MAHI_BLOCK_START];
    for (const [key, val] of Object.entries(firefoxPrefs)) {
      const serializedVal = typeof val === 'string' ? JSON.stringify(val) : String(val);
      prefLines.push(`user_pref("${key}", ${serializedVal});`);
    }
    prefLines.push(MAHI_BLOCK_END);
    const finalUserJs = cleanedUserJs ? `${cleanedUserJs}\n\n${prefLines.join('\n')}\n` : `${prefLines.join('\n')}\n`;
    fs.writeFileSync(userJsPath, finalUserJs, 'utf8');

    // Startup URL
    const startupUrl = settings?.browser?.startupUrl?.trim() || 'about:blank';
    args.push(startupUrl);

    // Resolve ISO 3166-1 alpha-2 region code and base language
    const rawLang = loc.language || 'en-US';
    const langParts = rawLang.split(/[-_]/);
    const baseLang = langParts[0].toLowerCase() || 'en';
    let regionCode = langParts.length > 1 ? langParts[1].toUpperCase() : '';
    if (!regionCode || regionCode.length !== 2) {
      const tzToRegion: Record<string, string> = {
        'America/New_York': 'US',
        'America/Chicago': 'US',
        'America/Los_Angeles': 'US',
        'Europe/London': 'GB',
        'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE',
        'Europe/Madrid': 'ES',
        'Europe/Rome': 'IT',
        'Europe/Moscow': 'RU',
        'Asia/Tokyo': 'JP',
        'Asia/Shanghai': 'CN',
        'Asia/Kolkata': 'IN',
        'Asia/Dubai': 'AE',
        'Asia/Singapore': 'SG',
        'Australia/Sydney': 'AU',
        'America/Sao_Paulo': 'BR',
        'America/Toronto': 'CA',
      };
      regionCode = (loc.timezone && tzToRegion[loc.timezone]) || 'US';
    }

    // Build Camoufox JSON configuration (exact keys validated against camoufox@0.5.9)
    const camouConfigObj: Record<string, any> = {
      'navigator.userAgent': settings?.browser?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
      'navigator.platform': fp.platform || 'Win32',
      'navigator.hardwareConcurrency': fp.hardwareConcurrency || 8,
      'screen.width': disp.screenWidth || 1920,
      'screen.height': disp.screenHeight || 1080,
      'webGl:vendor': fp.webglVendor || 'Google Inc. (NVIDIA)',
      'webGl:renderer': fp.webglRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'timezone': loc.timezone || 'America/New_York',
      'locale:language': baseLang,
      'locale:region': regionCode,
    };

    if (resolvedPublicIp) {
      camouConfigObj['webrtc:ipv4'] = resolvedPublicIp;
    }

    // Serialize and chunk Camoufox configuration payload into CAMOU_CONFIG_1, CAMOU_CONFIG_2, ...
    const camouJson = JSON.stringify(camouConfigObj);
    const CHUNK_SIZE = 1800;
    const chunkedEnv: Record<string, string> = {};
    for (let i = 0; i < camouJson.length; i += CHUNK_SIZE) {
      const chunkIdx = Math.floor(i / CHUNK_SIZE) + 1;
      chunkedEnv[`CAMOU_CONFIG_${chunkIdx}`] = camouJson.substring(i, i + CHUNK_SIZE);
    }

    // Chunk preferences into CAMOU_PREFS_1, CAMOU_PREFS_2, ...
    const prefsJson = JSON.stringify(firefoxPrefs);
    const chunkedPrefsEnv: Record<string, string> = {};
    for (let i = 0; i < prefsJson.length; i += CHUNK_SIZE) {
      const chunkIdx = Math.floor(i / CHUNK_SIZE) + 1;
      chunkedPrefsEnv[`CAMOU_PREFS_${chunkIdx}`] = prefsJson.substring(i, i + CHUNK_SIZE);
    }

    const camouEnv: Record<string, string | undefined> = {
      ...process.env,
      ...chunkedEnv,
      ...chunkedPrefsEnv,
    };

    const child = spawn(executablePath, args, {
      detached: true,
      windowsHide: false,
      stdio: 'ignore',
      env: camouEnv,
    });

    if (!child.pid) {
      if (proxyTunnel) proxyTunnel.close();
      throw new Error(`Failed to spawn Camoufox process — no PID returned from OS.`);
    }

    try {
      child.unref();
    } catch {}

    debugLog(`[Camoufox Launcher] Spawned successfully with PID: ${child.pid}`);
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
    debugLog(`[Camoufox Launcher CRITICAL ERROR] Failed to launch profile "${profile.name}": ${errorMsg}`);
    debugLog(`=======================================================`);
    throw (err instanceof Error ? err : new Error(errorMsg));
  }
}

/**
 * Engine-level CDP timezone & locale override.
 * Issues Emulation.setTimezoneOverride and Emulation.setLocaleOverride via CDP
 * with Target.setAutoAttach to ensure all targets (pages, workers, iframes)
 * inherit native V8 timezone without JS proxy traps.
 */
async function applyCdpOverrides(debugPort: number, tz: string, locale: string): Promise<boolean> {
  if (!tz && !locale) return false;
  const endpoint = `http://127.0.0.1:${debugPort}`;
  let browser: any = null;
  try {
    // poll /json/version until CDP answers (browser is still booting)
    for (let i = 0; i < 25; i++) {
      try {
        const r = await fetch(`${endpoint}/json/version`);
        if (r.ok) break;
      } catch {}
      if (i === 24) return false;
      await new Promise((r) => setTimeout(r, 120));
    }
    browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 });
    const ctx = browser.contexts()[0];
    if (!ctx) return false;

    // apply to every current page
    const applyTo = async (page: any) => {
      const cdp = await ctx.newCDPSession(page);
      if (tz) await cdp.send('Emulation.setTimezoneOverride', { timezoneId: tz });
      if (locale) await cdp.send('Emulation.setLocaleOverride', { locale });
      await cdp.detach().catch(() => {});
    };
    const pages = ctx.pages();
    if (pages.length === 0) {
      const p = await ctx.newPage();
      await applyTo(p);
    } else {
      for (const p of pages) await applyTo(p);
    }

    // apply to pages created later (user opens new tab)
    ctx.on('page', (p: any) => {
      applyTo(p).catch(() => {});
    });

    return true;
  } catch {
    return false;
  } finally {
    // DISCONNECT only — never call browser.close() in a way that kills the browser
    try {
      await browser?.close({ reason: 'cdp-override-done' });
    } catch {}
  }
}

/**
 * Launches an isolated browser instance with full error handling and step-by-step logging.
 */
export async function launchBrowser(profile: Profile, launchOptions?: { mode?: 'normal' | 'automation' }): Promise<LaunchedProcessInfo> {
  debugLog(`=======================================================`);
  debugLog(`[Launcher] Starting launch sequence for profile: "${profile.name}" (ID: ${profile.id})`);

  let proxyTunnel: ProxyTunnelHandle | undefined;

  // Dedicated isolated Camoufox launch branch
  if (profile.settings?.browser?.engine === 'camoufox') {
    return await launchCamoufoxProfile(profile, launchOptions);
  }

  try {
    // -------------------------------------------------------------
    // Step 1: Resolve Browser Executable Path (Multi-Core Resolution & Managed Engine)
    // -------------------------------------------------------------
    const multiCore = resolveMultiCoreExecutablePath(
      profile.settings?.browser?.userAgent,
      profile.customExecutablePath,
      profile.settings?.browser?.engine
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
    // When native C++ stealth engine is active via mahi-engine.json, omit stealth-core.js (zero double noise)
    const isNativeStealth = hasNativeStealthEngine(executablePath);
    const titleExtDir = ensureProfileStealthExtension(storageDir, profile.id, profile.name, settings, {
      nativeStealthActive: isNativeStealth,
    });

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
    const validExtensionPaths = Array.from(
      new Set(
        allExtensionPaths
          .filter((p): p is string => Boolean(p && typeof p === 'string'))
          .map((p) => path.resolve(p.trim()).replace(/[/\\]+$/, ''))
          .filter((p) => fs.existsSync(p))
      )
    );
    const loadExtensionsArg = validExtensionPaths.join(',');

    const args = buildSanitizedLaunchArgs({
      storageDir,
      debugPort,
      loadExtensionsArg,
      settings,
      mode: launchOptions?.mode || 'normal',
      isNativeStealth,
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

    // Native C++ CDP Execution Isolation (rebrowser-patches parity - strictly for native stealth cores)
    if (isNativeStealth) {
      if (!args.includes('--mahi-cdp-isolated')) {
        args.push('--mahi-cdp-isolated');
      }
      debugLog(`[Launcher Step 4/7] Configured native CDP execution isolation (--mahi-cdp-isolated).`);
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
          args.push(`--host-resolver-rules=MAP * 0.0.0.0 , EXCLUDE ${proxy.host}`);
          args.push('--force-webrtc-ip-handling-policy');
          args.push('--webrtc-ip-handling-policy=disable_non_proxied_udp');
          debugLog(`[Launcher Step 5/7] Authenticating Tunnel ready: 127.0.0.1:${proxyTunnel.port} -> ${proxy.host}:${proxy.port}`);
        } else {
          args.push(`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`);
          args.push('--proxy-bypass-list=<-loopback>');
          args.push(`--host-resolver-rules=MAP * 0.0.0.0 , EXCLUDE ${proxy.host}`);
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

    // Clean execution environment: Suppress Chromium API keys missing banner, propagate CDP isolation, and set POSIX/V8 TZ
    const browserEnv: Record<string, string | undefined> = {
      ...process.env,
      GOOGLE_API_KEY: 'no',
      GOOGLE_DEFAULT_CLIENT_ID: 'no',
      GOOGLE_DEFAULT_CLIENT_SECRET: 'no',
      ...(settings?.locale?.timezone ? { TZ: settings.locale.timezone } : {}),
      ...(isNativeStealth || args.includes('--mahi-cdp-isolated') ? { MAHI_CDP_ISOLATED: '1' } : {}),
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

    if (process.env.MAHI_TZ_DEBUG === '1') {
      debugLog(`[TZ DEBUG] env TZ = ${browserEnv.TZ}`);
      debugLog(`[TZ DEBUG] --tz arg present = ${args.some(a => a.startsWith('--tz='))}`);
      debugLog(`[TZ DEBUG] args = ${args.filter(a => a.startsWith('--tz=') || a.startsWith('--lang=') || a.startsWith('--user-agent=')).join(' | ')}`);
    }

    if (settings?.locale?.timezone) {
      const targetLocale =
        (Array.isArray(settings?.locale?.languagesList)
          ? settings.locale.languagesList[0]
          : settings?.locale?.language) || 'en-US';
      const ok = await applyCdpOverrides(debugPort, settings.locale.timezone, targetLocale);
      if (!ok) debugLog('[Launcher] CDP timezone override FAILED — JS fallback stays active');
    }

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
