import type { StealthScriptContext } from './launcher-shared.js';

/**
 * Generates the stealth-core preamble, PRNG, native-code registry, canvas noise
 * helper, font masking, screen spoofing, and device environment hooks.
 */
export function buildStealthEnvDeviceSection(ctx: StealthScriptContext): string {
  const {
    rawSeedInput,
    chromeMajorVer,
    chromeFullVer,
    effectiveBrands,
    effectiveFullVersionList,
    allowedFonts,
    glLimits,
    osVoiceProfile,
    isMobile,
    targetScreenWidth,
    targetScreenHeight,
    displayDpr,
    targetColorDepth,
    clientHintsPlatform,
    clientHintsModel,
    clientHintsPlatformVersion,
    clientHintsArch,
    targetTimezone,
  } = ctx;

  return `
(function() {
  'use strict';
  function fnv1a32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) || 0x12345678;
  }

  function createMulberry32(seed) {
    var a = seed >>> 0;
    return function() {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var pSeed = fnv1a32(${JSON.stringify(rawSeedInput)});
  var profileRng = createMulberry32(pSeed);

  // Closure-scoped native registry for Function.prototype.toString spoofing (never leaks to window)
  var hookedProxies = typeof Map !== 'undefined' ? new Map() : null;
  var hookedProxiesList = hookedProxies ? null : [];
  function registerNative(fn, name) {
    if (typeof fn === 'function') {
      var n = name || fn.name || '';
      try { Object.defineProperty(fn, 'name', { value: n, configurable: true }); } catch (e) { void 0; /* page-context stealth isolation */ }
      try { Object.defineProperty(fn, 'length', { value: fn.length, configurable: true }); } catch (e) { void 0; /* page-context stealth isolation */ }
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
  } catch(e) { void 0; /* page-context stealth isolation */ }

  // Shared Deterministic Mulberry32 Perturbation Streams
  var canvasRng = createMulberry32(pSeed ^ 0x43414e56);
  var canvasSaltA = ((canvasRng() * 0xffffffff) >>> 0) || 0x9e3779b9;
  var canvasSaltB = ((canvasRng() * 0xffffffff) >>> 0) || 0x85ebca6b;
  var canvasChTable = [];
  for (var cti = 0; cti < 64; cti++) {
    canvasChTable.push(Math.floor(canvasRng() * 3));
  }

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
        var _h = Math.imul((gx + canvasSaltA) | 0, 0x85ebca6b) ^
                 Math.imul((gy + canvasSaltB) | 0, 0xc2b2ae35) ^ pSeed;
        _h ^= _h >>> 15; _h = Math.imul(_h, 0x2545f491);
        _h ^= _h >>> 13;
        if ((_h & 63) === 0) {
          var dataIdx = (y * sw + x) * 4;
          if (data[dataIdx + 3] === 0) continue;
          var chIdx = canvasChTable[(_h >>> 6) & 63];
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
  var defaultBrands = ${JSON.stringify(effectiveBrands)};
  var defaultFullVersionList = ${JSON.stringify(effectiveFullVersionList)};
  var allowedFontsList = ${JSON.stringify(allowedFonts)};
  var glLimitsCfg = ${JSON.stringify(glLimits)};
  var osVoiceMode = ${JSON.stringify(osVoiceProfile)};
  var isMobileDevice = ${isMobile ? 'true' : 'false'};
  var targetScreenW = ${targetScreenWidth};
  var targetScreenH = ${targetScreenHeight};
  var targetDprVal = ${displayDpr};
  var targetColorD = ${targetColorDepth};
  var chPlatform = ${JSON.stringify(clientHintsPlatform)};
  var chMobile = ${isMobile ? 'true' : 'false'};
  var chModel = ${JSON.stringify(clientHintsModel)};
  var chPlatformVersion = ${JSON.stringify(clientHintsPlatformVersion)};
  var chArch = ${JSON.stringify(clientHintsArch)};
  var chBitness = "64";
  var targetTz = ${JSON.stringify(targetTimezone)};
  var mahiTzApplied = false;

  var universalFontSet = {
    'arial': true,
    'courier new': true,
    'georgia': true,
    'times new roman': true,
    'verdana': true,
    'monospace': true,
    'sans-serif': true,
    'serif': true,
    'cursive': true,
    'fantasy': true,
    'system-ui': true
  };
  var allowedFontLookup = {};
  for (var afi = 0; afi < allowedFontsList.length; afi++) {
    var afKey = String(allowedFontsList[afi] || '').trim().toLowerCase();
    if (afKey) allowedFontLookup[afKey] = true;
  }

  function extractCssFontFamilies(spec) {
    if (!spec || typeof spec !== 'string') return [];
    var s = spec.trim();
    var m = s.match(/(?:\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|ex|ch|vw|vh|vmin|vmax)|\\b(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)\\b)(?:\\s*\\/\\s*[\\d.]+(?:px|pt|em|rem|%)?)?\\s+(.+)$/i);
    var famPart = m ? m[1] : s;
    var parts = famPart.split(',');
    var out = [];
    for (var fi = 0; fi < parts.length; fi++) {
      var clean = parts[fi].trim().replace(/^['"]+|['"]+$/g, '').trim();
      if (clean) out.push(clean);
    }
    return out;
  }

  function isCssFontAllowed(spec) {
    var fams = extractCssFontFamilies(spec);
    if (fams.length === 0) return true;
    for (var fi = 0; fi < fams.length; fi++) {
      var low = fams[fi].toLowerCase();
      if (allowedFontLookup[low] || universalFontSet[low]) {
        return true;
      }
      return false;
    }
    return false;
  }

  function resolveAllowedFallbackFont(spec) {
    var fams = extractCssFontFamilies(spec);
    var firstLow = fams.length > 0 ? fams[0].toLowerCase() : '';
    var hasKnown = false;
    for (var fi = 0; fi < fams.length; fi++) {
      var low = fams[fi].toLowerCase();
      if (allowedFontLookup[low] || universalFontSet[low]) {
        hasKnown = true;
        break;
      }
    }
    if (hasKnown) return null;
    if (firstLow.indexOf('mono') !== -1 || firstLow.indexOf('code') !== -1 || firstLow.indexOf('console') !== -1) {
      return 'Courier New';
    }
    if (firstLow.indexOf('serif') !== -1 && firstLow.indexOf('sans') === -1) {
      return 'Georgia';
    }
    return allowedFontsList.length > 0 ? allowedFontsList[0] : 'Arial';
  }

  function replaceCssFontFamilies(spec, replacementFamily) {
    if (!spec || typeof spec !== 'string') return spec;
    var m = spec.match(/^(.*?(?:\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|ex|ch|vw|vh|vmin|vmax)|\\b(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)\\b)(?:\\s*\\/\\s*[\\d.]+(?:px|pt|em|rem|%)?)?\\s+)(.+)$/i);
    if (m) {
      return m[1] + JSON.stringify(replacementFamily);
    }
    return '16px ' + JSON.stringify(replacementFamily);
  }

  function applyFontMasking(targetWin) {
    if (!targetWin) return;
    try {
      var fontProto = targetWin.FontFaceSet && targetWin.FontFaceSet.prototype;
      if (fontProto && fontProto.check) {
        var origFontCheck = fontProto.check;
        var proxyFontCheck = new Proxy(origFontCheck, {
          apply: function(target, thisArg, args) {
            try {
              if (!isCssFontAllowed(args[0])) return false;
            } catch(e) { void 0; /* page-context stealth isolation */ }
            return target.apply(thisArg, args);
          }
        });
        fontProto.check = proxyFontCheck;
        registerNative(proxyFontCheck, 'check');
        registerNative(origFontCheck, 'check');
      } else if (targetWin.document && targetWin.document.fonts && targetWin.document.fonts.check) {
        var docFonts = targetWin.document.fonts;
        var origDocCheck = docFonts.check;
        var proxyDocCheck = new Proxy(origDocCheck, {
          apply: function(target, thisArg, args) {
            try {
              if (!isCssFontAllowed(args[0])) return false;
            } catch(e) { void 0; /* page-context stealth isolation */ }
            return target.apply(thisArg, args);
          }
        });
        docFonts.check = proxyDocCheck;
        registerNative(proxyDocCheck, 'check');
        registerNative(origDocCheck, 'check');
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }

    try {
      var ctx2dProto = targetWin.CanvasRenderingContext2D && targetWin.CanvasRenderingContext2D.prototype;
      if (ctx2dProto && ctx2dProto.measureText) {
        var origMeasureText = ctx2dProto.measureText;
        var proxyMeasureText = new Proxy(origMeasureText, {
          apply: function(target, thisArg, args) {
            if (thisArg && typeof thisArg.font === 'string') {
              var origFont = thisArg.font;
              var fallbackFamily = null;
              try { fallbackFamily = resolveAllowedFallbackFont(origFont); } catch(e) { void 0; /* page-context stealth isolation */ }
              if (fallbackFamily) {
                try {
                  thisArg.font = replaceCssFontFamilies(origFont, fallbackFamily);
                  return target.apply(thisArg, args);
                } finally {
                  try { thisArg.font = origFont; } catch(e) { void 0; /* page-context stealth isolation */ }
                }
              }
            }
            return target.apply(thisArg, args);
          }
        });
        ctx2dProto.measureText = proxyMeasureText;
        registerNative(proxyMeasureText, 'measureText');
        registerNative(origMeasureText, 'measureText');
      }
      var offCtx2dProto = targetWin.OffscreenCanvasRenderingContext2D && targetWin.OffscreenCanvasRenderingContext2D.prototype;
      if (offCtx2dProto && offCtx2dProto.measureText) {
        var origOffMeasure = offCtx2dProto.measureText;
        var proxyOffMeasure = new Proxy(origOffMeasure, {
          apply: function(target, thisArg, args) {
            if (thisArg && typeof thisArg.font === 'string') {
              var origFont = thisArg.font;
              var fallbackFamily = null;
              try { fallbackFamily = resolveAllowedFallbackFont(origFont); } catch(e) { void 0; /* page-context stealth isolation */ }
              if (fallbackFamily) {
                try {
                  thisArg.font = replaceCssFontFamilies(origFont, fallbackFamily);
                  return target.apply(thisArg, args);
                } finally {
                  try { thisArg.font = origFont; } catch(e) { void 0; /* page-context stealth isolation */ }
                }
              }
            }
            return target.apply(thisArg, args);
          }
        });
        offCtx2dProto.measureText = proxyOffMeasure;
        registerNative(proxyOffMeasure, 'measureText');
        registerNative(origOffMeasure, 'measureText');
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }

  function spoofScreen(targetWin, sWidth, sHeight, sDpr, availOffsetY, orientType, sColorDepth) {
    if (!targetWin) return;
    var availH = Math.max(240, sHeight - (availOffsetY || 0));
    var cDepth = sColorDepth || 24;
    var orientationObj = { angle: 0, type: orientType || (sWidth >= sHeight ? 'landscape-primary' : 'portrait-primary'), onchange: null };
    try {
      var dprGetter = function() { return sDpr; };
      Object.defineProperty(targetWin, 'devicePixelRatio', {
        get: dprGetter,
        configurable: true,
        enumerable: true
      });
      registerNative(dprGetter, 'get devicePixelRatio');
    } catch(e) { void 0; /* page-context stealth isolation */ }

    try {
      var scr = targetWin.screen;
      var scrProto = targetWin.Screen && targetWin.Screen.prototype;
      var defScreenProp = function(prop, val) {
        var getter = function() { return val; };
        var applied = false;
        if (scrProto) {
          try {
            Object.defineProperty(scrProto, prop, { get: getter, configurable: true, enumerable: true });
            applied = true;
          } catch(e) { void 0; /* page-context stealth isolation */ }
        }
        if (scr) {
          try {
            Object.defineProperty(scr, prop, { get: getter, configurable: true, enumerable: true });
            applied = true;
          } catch(e) { void 0; /* page-context stealth isolation */ }
        }
        if (applied) registerNative(getter, 'get ' + prop);
      };
      defScreenProp('width', sWidth);
      defScreenProp('height', sHeight);
      defScreenProp('availWidth', sWidth);
      defScreenProp('availHeight', availH);
      defScreenProp('availTop', 0);
      defScreenProp('availLeft', 0);
      defScreenProp('colorDepth', cDepth);
      defScreenProp('pixelDepth', cDepth);
      defScreenProp('orientation', orientationObj);
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }

  function makeGroupHex(seedVal, saltInt) {
    var r = createMulberry32((seedVal ^ saltInt) >>> 0);
    var hex = '';
    for (var hi = 0; hi < 16; hi++) {
      var b = Math.floor(r() * 256);
      hex += (b < 16 ? '0' : '') + b.toString(16);
    }
    return hex + hex;
  }

  function applyEnvironmentDeviceHooks(targetWin) {
    if (!targetWin) return;
    // 1. Plugins & MimeTypes & pdfViewerEnabled
    try {
      var tNavProto = targetWin.Navigator && targetWin.Navigator.prototype;
      if (tNavProto) {
        var fakePlugins = [];
        var fakeMimes = [];
        if (!isMobileDevice) {
          var pdfPluginNames = [
            'PDF Viewer',
            'Chrome PDF Viewer',
            'Chromium PDF Viewer',
            'Microsoft Edge PDF Viewer',
            'Web built-in PDF Viewer'
          ];
          var sharedMimes = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
          ];
          for (var pi = 0; pi < pdfPluginNames.length; pi++) {
            var pName = pdfPluginNames[pi];
            var pluginObj = {
              name: pName,
              filename: 'internal-pdf-viewer',
              description: 'Portable Document Format',
              length: sharedMimes.length
            };
            for (var mi = 0; mi < sharedMimes.length; mi++) {
              var mClone = {
                type: sharedMimes[mi].type,
                suffixes: sharedMimes[mi].suffixes,
                description: sharedMimes[mi].description,
                enabledPlugin: pluginObj
              };
              pluginObj[mi] = mClone;
              pluginObj[mClone.type] = mClone;
              if (pi === 0) fakeMimes.push(mClone);
            }
            pluginObj.item = function(idx) { return this[idx] || null; };
            pluginObj.namedItem = function(n) { return this[n] || null; };
            if (typeof Symbol !== 'undefined' && Symbol.iterator) {
              pluginObj[Symbol.iterator] = function() {
                var idx = 0, self = this;
                return { next: function() { return idx < self.length ? { value: self[idx++], done: false } : { done: true }; } };
              };
            }
            fakePlugins.push(pluginObj);
          }
        }

        var createArrayLikeObj = function(items, keyField, protoObj) {
          var arrObj = protoObj ? Object.create(protoObj) : {};
          try {
            Object.defineProperty(arrObj, 'length', { value: items.length, enumerable: false, configurable: true });
          } catch(e) { arrObj.length = items.length; }
          for (var i = 0; i < items.length; i++) {
            arrObj[i] = items[i];
            if (items[i] && items[i][keyField]) {
              arrObj[items[i][keyField]] = items[i];
            }
          }
          arrObj.item = function(idx) { return items[idx] || null; };
          arrObj.namedItem = function(n) { return arrObj[n] || null; };
          arrObj.refresh = function() {};
          if (typeof Symbol !== 'undefined' && Symbol.iterator) {
            arrObj[Symbol.iterator] = function() {
              var idx = 0;
              return { next: function() { return idx < items.length ? { value: items[idx++], done: false } : { done: true }; } };
            };
          }
          return arrObj;
        };

        var pluginsVal = createArrayLikeObj(fakePlugins, 'name', targetWin.PluginArray && targetWin.PluginArray.prototype);
        var mimeTypesVal = createArrayLikeObj(fakeMimes, 'type', targetWin.MimeTypeArray && targetWin.MimeTypeArray.prototype);
        var getPlugins = function() { return pluginsVal; };
        var getMimes = function() { return mimeTypesVal; };
        var pdfEnabled = !isMobileDevice;
        var getPdfEnabled = function() { return pdfEnabled; };

        if (targetWin.navigator) {
          try { delete targetWin.navigator.plugins; } catch(e) { void 0; /* page-context stealth isolation */ }
          try { delete targetWin.navigator.mimeTypes; } catch(e) { void 0; /* page-context stealth isolation */ }
          try { delete targetWin.navigator.pdfViewerEnabled; } catch(e) { void 0; /* page-context stealth isolation */ }
          try { delete targetWin.navigator.getGamepads; } catch(e) { void 0; /* page-context stealth isolation */ }
        }
        Object.defineProperty(tNavProto, 'plugins', { get: getPlugins, enumerable: true, configurable: true });
        Object.defineProperty(tNavProto, 'mimeTypes', { get: getMimes, enumerable: true, configurable: true });
        Object.defineProperty(tNavProto, 'pdfViewerEnabled', { get: getPdfEnabled, enumerable: true, configurable: true });
        registerNative(getPlugins, 'get plugins');
        registerNative(getMimes, 'get mimeTypes');
        registerNative(getPdfEnabled, 'get pdfViewerEnabled');

        // 2. navigator.getGamepads() -> [null, null, null, null]
        var origGetGamepads = tNavProto.getGamepads;
        var proxyGetGamepads = function getGamepads() {
          return [null, null, null, null];
        };
        tNavProto.getGamepads = proxyGetGamepads;
        registerNative(proxyGetGamepads, 'getGamepads');
        if (origGetGamepads) registerNative(origGetGamepads, 'getGamepads');
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }

    // 3. mediaDevices.enumerateDevices
    try {
      var mdProto = targetWin.MediaDevices && targetWin.MediaDevices.prototype;
      var mdInst = targetWin.navigator && targetWin.navigator.mediaDevices;
      var grpAudioIn = makeGroupHex(pSeed, 0x11223344);
      var grpVideoIn = makeGroupHex(pSeed, 0x22334455);
      var grpAudioOut1 = makeGroupHex(pSeed, 0x33445566);
      var grpAudioOut2 = makeGroupHex(pSeed, 0x44556677);
      var devicesList = [
        { deviceId: '', kind: 'audioinput', label: '', groupId: grpAudioIn, toJSON: function() { return { deviceId: this.deviceId, kind: this.kind, label: this.label, groupId: this.groupId }; } },
        { deviceId: '', kind: 'videoinput', label: '', groupId: grpVideoIn, toJSON: function() { return { deviceId: this.deviceId, kind: this.kind, label: this.label, groupId: this.groupId }; } },
        { deviceId: '', kind: 'audiooutput', label: '', groupId: grpAudioOut1, toJSON: function() { return { deviceId: this.deviceId, kind: this.kind, label: this.label, groupId: this.groupId }; } }
      ];
      if (!isMobileDevice) {
        devicesList.push({ deviceId: '', kind: 'audiooutput', label: '', groupId: grpAudioOut2, toJSON: function() { return { deviceId: this.deviceId, kind: this.kind, label: this.label, groupId: this.groupId }; } });
      }
      if (mdProto && mdProto.enumerateDevices) {
        var origEnum = mdProto.enumerateDevices;
        var proxyEnum = new Proxy(origEnum, {
          apply: function() {
            return Promise.resolve(devicesList.slice());
          }
        });
        mdProto.enumerateDevices = proxyEnum;
        registerNative(proxyEnum, 'enumerateDevices');
        registerNative(origEnum, 'enumerateDevices');
      }
      if (mdInst && typeof mdInst.enumerateDevices === 'function' && (Object.prototype.hasOwnProperty.call(mdInst, 'enumerateDevices') || !mdProto || !mdProto.enumerateDevices)) {
        var origInstEnum = mdInst.enumerateDevices;
        var proxyInstEnum = new Proxy(origInstEnum, {
          apply: function() {
            return Promise.resolve(devicesList.slice());
          }
        });
        mdInst.enumerateDevices = proxyInstEnum;
        registerNative(proxyInstEnum, 'enumerateDevices');
        registerNative(origInstEnum, 'enumerateDevices');
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }

    // 4. speechSynthesis.getVoices() per OS
    try {
      var osVoices = osVoiceMode === 'android'
        ? [
            { voiceURI: 'Google US English', name: 'Google US English', lang: 'en-US', localService: false, default: true },
            { voiceURI: 'Google UK English Female', name: 'Google UK English Female', lang: 'en-GB', localService: false, default: false }
          ]
        : osVoiceMode === 'macos'
          ? [
              { voiceURI: 'Alex', name: 'Alex', lang: 'en-US', localService: true, default: true },
              { voiceURI: 'Samantha', name: 'Samantha', lang: 'en-US', localService: true, default: false },
              { voiceURI: 'Victoria', name: 'Victoria', lang: 'en-US', localService: true, default: false }
            ]
          : osVoiceMode === 'linux'
            ? [
                { voiceURI: 'English (America)+default', name: 'English (America)+default', lang: 'en-US', localService: true, default: true },
                { voiceURI: 'espeak-ng English', name: 'espeak-ng English', lang: 'en-GB', localService: true, default: false }
              ]
            : [
                { voiceURI: 'Microsoft David - English (United States)', name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true, default: true },
                { voiceURI: 'Microsoft Zira - English (United States)', name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true, default: false },
                { voiceURI: 'Microsoft Mark - English (United States)', name: 'Microsoft Mark - English (United States)', lang: 'en-US', localService: true, default: false }
              ];

      var ssProto = targetWin.SpeechSynthesis && targetWin.SpeechSynthesis.prototype;
      if (ssProto && ssProto.getVoices) {
        var origGetVoices = ssProto.getVoices;
        var proxyGetVoices = new Proxy(origGetVoices, {
          apply: function() { return osVoices.slice(); }
        });
        ssProto.getVoices = proxyGetVoices;
        registerNative(proxyGetVoices, 'getVoices');
        registerNative(origGetVoices, 'getVoices');
      } else if (targetWin.speechSynthesis && targetWin.speechSynthesis.getVoices) {
        var origInstVoices = targetWin.speechSynthesis.getVoices;
        var proxyInstVoices = new Proxy(origInstVoices, {
          apply: function() { return osVoices.slice(); }
        });
        targetWin.speechSynthesis.getVoices = proxyInstVoices;
        registerNative(proxyInstVoices, 'getVoices');
        registerNative(origInstVoices, 'getVoices');
      }
      if (targetWin.speechSynthesis && typeof targetWin.speechSynthesis.dispatchEvent === 'function' && typeof targetWin.Event === 'function') {
        try {
          targetWin.speechSynthesis.dispatchEvent(new targetWin.Event('voiceschanged'));
        } catch(e) { void 0; /* page-context stealth isolation */ }
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }

    // 5. Device Sensors: Accelerometer / Gyroscope / AbsoluteOrientationSensor (mobile only)
    try {
      var sensorNames = ['Accelerometer', 'Gyroscope', 'AbsoluteOrientationSensor'];
      if (isMobileDevice) {
        var sensorRng = createMulberry32(pSeed ^ 0x53454e53);
        var sx = Math.round((sensorRng() - 0.5) * 0.2 * 1000) / 1000;
        var sy = Math.round((sensorRng() - 0.5) * 0.2 * 1000) / 1000;
        var sz = Math.round((9.78 + sensorRng() * 0.06) * 1000) / 1000;
        for (var sni = 0; sni < sensorNames.length; sni++) {
          (function(clsName) {
            var SensorCtor = function() {
              if (!(this instanceof SensorCtor)) {
                throw new TypeError("Failed to construct '" + clsName + "': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
              }
              this.activated = false;
              this.hasReading = true;
              this.timestamp = 1;
              if (clsName === 'AbsoluteOrientationSensor') {
                this.quaternion = [0, 0, 0, 1];
              } else {
                this.x = sx;
                this.y = sy;
                this.z = clsName === 'Gyroscope' ? 0 : sz;
              }
            };
            var fnStart = function start() { this.activated = true; };
            var fnStop = function stop() { this.activated = false; };
            var fnAdd = function addEventListener() {};
            var fnRem = function removeEventListener() {};
            SensorCtor.prototype.start = fnStart;
            SensorCtor.prototype.stop = fnStop;
            SensorCtor.prototype.addEventListener = fnAdd;
            SensorCtor.prototype.removeEventListener = fnRem;
            if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
              try { Object.defineProperty(SensorCtor.prototype, Symbol.toStringTag, { value: clsName, configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }
            }
            registerNative(SensorCtor, clsName);
            registerNative(fnStart, 'start');
            registerNative(fnStop, 'stop');
            registerNative(fnAdd, 'addEventListener');
            registerNative(fnRem, 'removeEventListener');
            Object.defineProperty(targetWin, clsName, { value: SensorCtor, configurable: true, writable: true });
          })(sensorNames[sni]);
        }
      } else {
        for (var dni = 0; dni < sensorNames.length; dni++) {
          try { delete targetWin[sensorNames[dni]]; } catch(e) { void 0; /* page-context stealth isolation */ }
          try {
            if (typeof targetWin[sensorNames[dni]] !== 'undefined') {
              Object.defineProperty(targetWin, sensorNames[dni], { value: undefined, configurable: true, writable: true });
            }
          } catch(e) { void 0; /* page-context stealth isolation */ }
        }
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }
`;
}
