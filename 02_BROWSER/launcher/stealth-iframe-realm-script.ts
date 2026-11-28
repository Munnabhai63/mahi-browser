import type { StealthScriptContext } from './launcher-shared.js';

/**
 * Generates synchronous cross-realm iframe & window.frames stealth propagation hooks.
 */
export function buildStealthIframeRealmSection(ctx: StealthScriptContext): string {
  const {
    hardwareConcurrency,
    deviceMemory,
    platformStr,
    maxTouchPoints,
    languagesList,
    isCamoufox,
    canvasMode,
    webglMode,
    audioMode,
    gpuVendor,
    gpuRenderer,
  } = ctx;

  return `
  // Synchronous Cross-Realm <iframe> Hooking & Comprehensive Stealth Propagation
  try {
    var patchedWindows = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var patchedFramesRealms = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var patchRealm = function(targetWin, depth) {
      if (!targetWin || (patchedWindows && patchedWindows.has(targetWin))) return;
      if (depth && depth > 4) return;
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
                try { delete targetWin.navigator[prop]; } catch(e) { void 0; /* page-context stealth isolation */ }
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
            } catch(e) { void 0; /* page-context stealth isolation */ }
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
                  try { Object.defineProperty(tUaProto, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }
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
                  try { Object.defineProperty(tUaDataObj, Symbol.toStringTag, { value: 'NavigatorUAData', configurable: true }); } catch(e) { void 0; /* page-context stealth isolation */ }
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
            } catch(e) { void 0; /* page-context stealth isolation */ }
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
                    } catch(e) { void 0; /* page-context stealth isolation */ }
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
                    } catch(e) { void 0; /* page-context stealth isolation */ }
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
                    } catch(e) { void 0; /* page-context stealth isolation */ }
                    return imgData;
                  }
                });
                targetWin.CanvasRenderingContext2D.prototype.getImageData = tProxyGetID;
                registerNative(tProxyGetID, 'getImageData');
                registerNative(tOrigGetID, 'getImageData');
              }
            }
          } catch(e) { void 0; /* page-context stealth isolation */ }
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
                    if (param === 3379) return glLimitsCfg.maxTextureSize;
                    if (param === 34024) return glLimitsCfg.maxRenderbufferSize;
                    if (param === 36347) return glLimitsCfg.maxVertexUniformVectors;
                    if (param === 36348) return glLimitsCfg.maxVaryingVectors;
                    if (param === 34921) return glLimitsCfg.maxVertexAttribs;
                    return target.apply(thisArg, args);
                  }
                });
                glProto.getParameter = proxyGP;
                registerNative(proxyGP, 'getParameter');
                registerNative(origGP, 'getParameter');
              }
              if (targetWin.WebGLRenderingContext) spoofTargetWebGL(targetWin.WebGLRenderingContext.prototype);
              if (targetWin.WebGL2RenderingContext) spoofTargetWebGL(targetWin.WebGL2RenderingContext.prototype);
            } catch(e) { void 0; /* page-context stealth isolation */ }
          }

          applyFontMasking(targetWin);
          spoofScreen(
            targetWin,
            targetScreenW,
            targetScreenH,
            targetDprVal,
            isMobileDevice ? 0 : 40,
            isMobileDevice ? 'portrait-primary' : (targetScreenW >= targetScreenH ? 'landscape-primary' : 'portrait-primary'),
            targetColorD
          );
          applyEnvironmentDeviceHooks(targetWin);

        // 5. Date, Timezone & Intl in targetWin
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
          } catch(e) { void 0; /* page-context stealth isolation */ }
        }

        // 5b. AudioBuffer & AudioWorklet jitter propagation in targetWin
        if (${audioMode !== 'off'} && targetWin.AudioBuffer && targetWin.AudioBuffer.prototype) {
          try {
            var tPerturbedBufs = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
            var tAudioRng = createMulberry32(pSeed ^ 0x41554449);
            var tAudioOffsets = [];
            for (var tai = 0; tai < 64; tai++) {
              var tao = (tAudioRng() - 0.5) * 2e-6;
              tAudioOffsets.push(tao === 0 ? 1e-7 : tao);
            }
            var tOrigGetChannelData = targetWin.AudioBuffer.prototype.getChannelData;
            if (tOrigGetChannelData) {
              var tProxyGetChannelData = new Proxy(tOrigGetChannelData, {
                apply: function(target, thisArg, args) {
                  var buf = target.apply(thisArg, args);
                  if (tPerturbedBufs && !tPerturbedBufs.has(buf)) {
                    tPerturbedBufs.add(buf);
                    var silent = true;
                    for (var si = 0; si < buf.length; si++) { if (buf[si] !== 0) { silent = false; break; } }
                    if (!silent) {
                      for (var i = 0, step = 0; i < buf.length; i += 100, step++) {
                        buf[i] += tAudioOffsets[step & 63];
                      }
                    }
                  }
                  return buf;
                }
              });
              targetWin.AudioBuffer.prototype.getChannelData = tProxyGetChannelData;
              registerNative(tProxyGetChannelData, 'getChannelData');
              registerNative(tOrigGetChannelData, 'getChannelData');
            }
          } catch(e) { void 0; /* page-context stealth isolation */ }
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
                        try { patchRealm(framesObj[fi], nextDepth); } catch(e) { void 0; /* page-context stealth isolation */ }
                      }
                    }
                  } catch(e) { void 0; /* page-context stealth isolation */ }
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
          } catch(e) { void 0; /* page-context stealth isolation */ }
        }
      } catch(e) { void 0; /* page-context stealth isolation */ }
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
                  try { patchRealm(framesObj[fi], 1); } catch(e) { void 0; /* page-context stealth isolation */ }
                }
              }
            } catch(e) { void 0; /* page-context stealth isolation */ }
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
  } catch(e) { void 0; /* page-context stealth isolation */ }
`;
}
