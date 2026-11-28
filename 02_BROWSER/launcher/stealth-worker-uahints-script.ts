import type { StealthScriptContext } from './launcher-shared.js';

/**
 * Generates Web Worker / SharedWorker / ServiceWorker stealth synchronization,
 * User-Agent Client Hints (navigator.userAgentData) masking, screen/font/device
 * application on window, and mobile touch/battery/connection emulation.
 */
export function buildStealthWorkerUaHintsSection(ctx: StealthScriptContext): string {
  const {
    hardwareConcurrency,
    deviceMemory,
    platformStr,
    targetTimezone,
    languagesList,
    userAgent,
    gpuVendor,
    gpuRenderer,
    isCamoufox,
    isMobile,
    clientHintsPlatform,
    clientHintsArch,
    clientHintsModel,
    clientHintsPlatformVersion,
    chromeFullVer,
  } = ctx;

  return `
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
        '    var pUa = ' + JSON.stringify(${JSON.stringify(userAgent)}) + ';',
        '    var pGpuVendor = ' + JSON.stringify(${JSON.stringify(gpuVendor)}) + ';',
        '    var pGpuRenderer = ' + JSON.stringify(${JSON.stringify(gpuRenderer)}) + ';',
        '    var pSeed = ' + pSeed + ';',
        '    var pCanvasSaltA = ' + canvasSaltA + ';',
        '    var pCanvasSaltB = ' + canvasSaltB + ';',
        '    var pCanvasChTable = ' + JSON.stringify(canvasChTable) + ';',
        '    var pAllowedFonts = ' + JSON.stringify(allowedFontsList) + ';',
        '    var pGlLimits = ' + JSON.stringify(glLimitsCfg) + ';',
        '    var wUnivFonts = { "arial": true, "courier new": true, "georgia": true, "times new roman": true, "verdana": true, "monospace": true, "sans-serif": true, "serif": true, "cursive": true, "fantasy": true, "system-ui": true };',
        '    var wAllowedLookup = {};',
        '    for (var wafi = 0; wafi < pAllowedFonts.length; wafi++) { var wfk = String(pAllowedFonts[wafi] || "").trim().toLowerCase(); if (wfk) wAllowedLookup[wfk] = true; }',
        '    function wResolveFallbackFont(spec) {',
        '      if (!spec || typeof spec !== "string") return null;',
        '      var s = spec.trim();',
        '      var m = s.match(/(?:\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|ex|ch|vw|vh|vmin|vmax)|\\b(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)\\b)(?:\\s*\\/\\s*[\\d.]+(?:px|pt|em|rem|%)?)?\\s+(.+)$/i);',
        '      var famPart = m ? m[1] : s;',
        '      var parts = famPart.split(",");',
        '      var firstLow = "";',
        '      for (var fi = 0; fi < parts.length; fi++) {',
        '        var cl = parts[fi].trim().replace(/^[\\x27"]+|[\\x27"]+$/g, "").trim().toLowerCase();',
        '        if (!firstLow && cl) firstLow = cl;',
        '        if (cl && (wAllowedLookup[cl] || wUnivFonts[cl])) return null;',
        '      }',
        '      if (firstLow.indexOf("mono") !== -1 || firstLow.indexOf("code") !== -1 || firstLow.indexOf("console") !== -1) return "Courier New";',
        '      if (firstLow.indexOf("serif") !== -1 && firstLow.indexOf("sans") === -1) return "Georgia";',
        '      return pAllowedFonts.length > 0 ? pAllowedFonts[0] : "Arial";',
        '    }',
        '    function wReplaceFont(spec, fam) {',
        '      var m = spec.match(/^(.*?(?:\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%|ex|ch|vw|vh|vmin|vmax)|\\b(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)\\b)(?:\\s*\\/\\s*[\\d.]+(?:px|pt|em|rem|%)?)?\\s+)(.+)$/i);',
        '      return m ? (m[1] + JSON.stringify(fam)) : ("16px " + JSON.stringify(fam));',
        '    }',
        '    function wApplyCanvasNoise(imgData, sx, sy, cw, ch) {',
        '      if (!imgData || !imgData.data) return imgData;',
        '      var sw = imgData.width, sh = imgData.height;',
        '      var w = cw || sw, h = ch || sh;',
        '      if (w <= 8 || h <= 8 || sw <= 8 || sh <= 8) return imgData;',
        '      var data = imgData.data;',
        '      var startX = sx || 0, startY = sy || 0;',
        '      for (var y = 0; y < sh; y++) {',
        '        var gy = startY + y;',
        '        for (var x = 0; x < sw; x++) {',
        '          var gx = startX + x;',
        '          var _h = Math.imul((gx + pCanvasSaltA) | 0, 0x85ebca6b) ^ Math.imul((gy + pCanvasSaltB) | 0, 0xc2b2ae35) ^ pSeed;',
        '          _h ^= _h >>> 15; _h = Math.imul(_h, 0x2545f491);',
        '          _h ^= _h >>> 13;',
        '          if ((_h & 63) === 0) {',
        '            var dataIdx = (y * sw + x) * 4;',
        '            if (data[dataIdx + 3] === 0) continue;',
        '            var chIdx = pCanvasChTable[(_h >>> 6) & 63];',
        '            data[dataIdx + chIdx] ^= 1;',
        '          }',
        '        }',
        '      }',
        '      return imgData;',
        '    }',
        '    var wHooked = [];',
        '    function wReg(fn, name) {',
        '      if (typeof fn === "function") {',
        '        var n = name || fn.name || "";',
        '        try { Object.defineProperty(fn, "name", { value: n, configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }',
        '        try { Object.defineProperty(fn, "length", { value: fn.length, configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }',
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
        '    } catch(e) { void 0; /* page-context stealth isolation */ }',
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
        '        } catch(e) { void 0; /* page-context stealth isolation */ }',
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
        '          var wBrands = ' + JSON.stringify(defaultBrands) + ';',
        '          var wFullList = ' + JSON.stringify(defaultFullVersionList) + ';',
        '          var wUaObj = {',
        '            brands: wBrands,',
        '            mobile: ' + (${isMobile ? 'true' : 'false'}) + ',',
        '            platform: ' + JSON.stringify(${JSON.stringify(clientHintsPlatform)}) + ',',
        '            getHighEntropyValues: function(hints) {',
        '              var res = { brands: wBrands, mobile: ' + (${isMobile ? 'true' : 'false'}) + ', platform: ' + JSON.stringify(${JSON.stringify(clientHintsPlatform)}) + ' };',
        '              if (Array.isArray(hints)) {',
        '                for (var wi = 0; wi < hints.length; wi++) {',
        '                  if (hints[wi] === "architecture") res.architecture = ' + JSON.stringify(${JSON.stringify(clientHintsArch)}) + ';',
        '                  if (hints[wi] === "bitness") res.bitness = "64";',
        '                  if (hints[wi] === "model") res.model = ' + JSON.stringify(${JSON.stringify(clientHintsModel)}) + ';',
        '                  if (hints[wi] === "platformVersion") res.platformVersion = ' + JSON.stringify(${JSON.stringify(clientHintsPlatformVersion)}) + ';',
        '                  if (hints[wi] === "uaFullVersion") res.uaFullVersion = ' + JSON.stringify(${JSON.stringify(chromeFullVer)}) + ';',
        '                  if (hints[wi] === "fullVersionList") res.fullVersionList = wFullList;',
        '                }',
        '              }',
        '              return Promise.resolve(res);',
        '            },',
        '            toJSON: function() { return { brands: wBrands, mobile: ' + (${isMobile ? 'true' : 'false'}) + ', platform: ' + JSON.stringify(${JSON.stringify(clientHintsPlatform)}) + ' }; }',
        '          };',
        '          if (typeof Symbol !== "undefined" && Symbol.toStringTag) {',
        '            try { Object.defineProperty(wUaObj, Symbol.toStringTag, { value: "NavigatorUAData", configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }',
        '          }',
        '          spoofWorkerNav("userAgentData", wUaObj);',
        '        } catch(e) { void 0; /* page-context stealth isolation */ }',
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
        '                wApplyCanvasNoise(imgData, sx, sy, cw, ch);',
        '              } catch(e) { void 0; /* page-context stealth isolation */ }',
        '              return imgData;',
        '            }',
        '          });',
        '          OffscreenCanvasRenderingContext2D.prototype.getImageData = proxyOffGetID;',
        '          wReg(proxyOffGetID, "getImageData");',
        '          wReg(origOffGetID, "getImageData");',
        '        }',
        '        var origOffMeasure = OffscreenCanvasRenderingContext2D.prototype.measureText;',
        '        if (origOffMeasure) {',
        '          var proxyOffMeasure = new Proxy(origOffMeasure, {',
        '            apply: function(target, thisArg, args) {',
        '              if (thisArg && typeof thisArg.font === "string") {',
        '                var origFont = thisArg.font;',
        '                var fb = wResolveFallbackFont(origFont);',
        '                if (fb) {',
        '                  try { thisArg.font = wReplaceFont(origFont, fb); return target.apply(thisArg, args); } finally { try { thisArg.font = origFont; } catch(e) { void 0; /* page-context stealth isolation */ } }',
        '                }',
        '              }',
        '              return target.apply(thisArg, args);',
        '            }',
        '          });',
        '          OffscreenCanvasRenderingContext2D.prototype.measureText = proxyOffMeasure;',
        '          wReg(proxyOffMeasure, "measureText");',
        '          wReg(origOffMeasure, "measureText");',
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
        '                  wApplyCanvasNoise(imgData, 0, 0, clone.width, clone.height);',
        '                  if (cloneCtx.putImageData) cloneCtx.putImageData(imgData, 0, 0);',
        '                  return target.apply(clone, args);',
        '                }',
        '              }',
        '            } catch(e) { void 0; /* page-context stealth isolation */ }',
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
        '          if (param === 3379 && pGlLimits && pGlLimits.maxTextureSize) return pGlLimits.maxTextureSize;',
        '          if (param === 34024 && pGlLimits && pGlLimits.maxRenderbufferSize) return pGlLimits.maxRenderbufferSize;',
        '          if (param === 36347 && pGlLimits && pGlLimits.maxVertexUniformVectors) return pGlLimits.maxVertexUniformVectors;',
        '          if (param === 36348 && pGlLimits && pGlLimits.maxVaryingVectors) return pGlLimits.maxVaryingVectors;',
        '          if (param === 34921 && pGlLimits && pGlLimits.maxVertexAttribs) return pGlLimits.maxVertexAttribs;',
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
        '        try { Object.defineProperty(ProxyDTF, "length", { value: 0, configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }',
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
        '  } catch(e) { void 0; /* page-context stealth isolation */ }',
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
        } catch(e) { void 0; /* page-context stealth isolation */ }
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
        try { ProxyWorker.prototype = origWorker.prototype; } catch(e) { void 0; /* page-context stealth isolation */ }
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
        try { ProxySharedWorker.prototype = origSharedWorker.prototype; } catch(e) { void 0; /* page-context stealth isolation */ }
        window.SharedWorker = ProxySharedWorker;
        registerNative(ProxySharedWorker, 'SharedWorker');
        registerNative(origSharedWorker, 'SharedWorker');
      }

      if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof ServiceWorkerContainer !== 'undefined' && ServiceWorkerContainer.prototype) {
        var origSWRegister = ServiceWorkerContainer.prototype.register;
        var proxySWRegister = new Proxy(origSWRegister, {
          apply: function(target, thisArg, args) {
            var url = args[0];
            var opts = args[1] || {};
            try {
              var abs = new URL(String(url), location.href);
              if (abs.origin === location.origin) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', abs.href, false);
                xhr.send();
                if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
                  var combined = workerBootstrapJs + '\\n;' + xhr.responseText;
                  var blobUrl = URL.createObjectURL(
                    new Blob([combined], { type: 'application/javascript' }));
                  var newArgs = [blobUrl].concat(args.slice(1));
                  try {
                    return target.apply(thisArg, newArgs).catch(function() {
                      return target.apply(thisArg, args);
                    });
                  } catch(regErr) {
                    return target.apply(thisArg, args);
                  }
                }
              }
            } catch (e) { void 0; /* page-context stealth isolation */ }
            return target.apply(thisArg, args);
          }
        });
        ServiceWorkerContainer.prototype.register = proxySWRegister;
        registerNative(proxySWRegister, 'register');
        registerNative(origSWRegister, 'register');
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }

    // -------------------------------------------------------------
    // User-Agent Client Hints (navigator.userAgentData) Native Masking
    // -------------------------------------------------------------
    if (!${isCamoufox}) {
      try {

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
            try { Object.defineProperty(uaTargetProto, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }
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
          try { Object.defineProperty(uaDataObj, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }
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
      } catch(e) { void 0; /* page-context stealth isolation */ }
    }

    try {
      spoofScreen(
        window,
        targetScreenW,
        targetScreenH,
        targetDprVal,
        isMobileDevice ? 0 : 40,
        isMobileDevice ? 'portrait-primary' : (targetScreenW >= targetScreenH ? 'landscape-primary' : 'portrait-primary'),
        targetColorD
      );
      applyFontMasking(window);
      applyEnvironmentDeviceHooks(window);
    } catch(e) { void 0; /* page-context stealth isolation */ }

    if (${isMobile}) {
      try {
        if (!('ontouchstart' in window)) {
          window.ontouchstart = null;
        }

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
        } catch(e) { void 0; /* page-context stealth isolation */ }

        try {
          var mobileBattLevel = Math.round((0.65 + profileRng() * 0.30) * 100) / 100;
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
        } catch(e) { void 0; /* page-context stealth isolation */ }
      } catch(e) { void 0; /* page-context stealth isolation */ }
    }
  } catch(e) { void 0; /* page-context stealth isolation */ }
`;
}
