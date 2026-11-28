import type { StealthScriptContext } from './launcher-shared.js';

/**
 * Generates Canvas dynamic hash perturbation, ClientRects DOM subpixel jitter,
 * and WebGL GPU vendor/renderer + readPixels spoofing hooks.
 */
export function buildStealthCanvasWebglSection(ctx: StealthScriptContext): string {
  const { canvasMode, clientRectsMode, webglMode, gpuVendor, gpuRenderer } = ctx;

  return `
  // -------------------------------------------------------------
  // 3. Canvas Dynamic Hash Perturbation (Single-Pass Noise)
  // -------------------------------------------------------------
  if (${canvasMode !== 'off'}) {
    try {
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
          } catch(e) { void 0; /* page-context stealth isolation */ }
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
            } catch(e) { void 0; /* page-context stealth isolation */ }
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
          } catch(e) { void 0; /* page-context stealth isolation */ }
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
              } catch(e) { void 0; /* page-context stealth isolation */ }
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
              } catch(e) { void 0; /* page-context stealth isolation */ }
              return target.apply(thisArg, argumentsList);
            }
          });
          OffscreenCanvas.prototype.convertToBlob = proxyConvertToBlob;
          registerNative(proxyConvertToBlob, 'convertToBlob');
          registerNative(origConvertToBlob, 'convertToBlob');
        }
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }

  // -------------------------------------------------------------
  // 3.5 ClientRects DOM Subpixel Jitter (Multi-Method Parity)
  // -------------------------------------------------------------
  if (${clientRectsMode !== 'off'}) {
    try {
      function shiftDOMRectList(origList, shiftX, shiftY) {
        if (!origList || origList.length === 0 || (shiftX === 0 && shiftY === 0)) return origList;
        var count = origList.length || 0;
        var shifted = [];
        for (var i = 0; i < count; i++) {
          var r = origList[i] || (origList.item && origList.item(i));
          if (r) {
            if (r.width === 0 && r.height === 0) {
              shifted.push(r);
            } else {
              shifted.push(new DOMRect(r.x + shiftX, r.y + shiftY, r.width, r.height));
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

      var crRng = createMulberry32(pSeed ^ 0x43524543);
      var crShiftX = (crRng() < 0.5 ? -1 : 1) * (0.00001 + Math.floor(crRng() * 900) * 0.000001);
      var crShiftY = (crRng() < 0.5 ? -1 : 1) * (0.00001 + Math.floor(crRng() * 900) * 0.000001);
      var origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
      var proxyGetBoundingClientRect = new Proxy(origGetBoundingClientRect, {
        apply: function(target, thisArg, argumentsList) {
          var rect = target.apply(thisArg, argumentsList);
          if (!rect || (rect.width === 0 && rect.height === 0)) return rect;
          return new DOMRect(
            rect.x + crShiftX,
            rect.y + crShiftY,
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
            return shiftDOMRectList(rects, crShiftX, crShiftY);
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
              rect.x + crShiftX,
              rect.y + crShiftY,
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
            return shiftDOMRectList(rects, crShiftX, crShiftY);
          }
        });
        Range.prototype.getClientRects = proxyRangeGetClientRects;
        registerNative(proxyRangeGetClientRects, 'getClientRects');
        registerNative(origRangeGetClientRects, 'getClientRects');
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }
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
            if (param === 3379) return glLimitsCfg.maxTextureSize;
            // MAX_RENDERBUFFER_SIZE
            if (param === 34024) return glLimitsCfg.maxRenderbufferSize;
            // MAX_VERTEX_UNIFORM_VECTORS
            if (param === 36347) return glLimitsCfg.maxVertexUniformVectors;
            // MAX_VARYING_VECTORS
            if (param === 36348) return glLimitsCfg.maxVaryingVectors;
            // MAX_VERTEX_ATTRIBS
            if (param === 34921) return glLimitsCfg.maxVertexAttribs;
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
                } catch(e) { void 0; /* page-context stealth isolation */ }
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

        // Deterministic coordinate-seeded readPixels micro-jitter if webgl noise is enabled
        if (proto.readPixels) {
          var origReadPixels = proto.readPixels;
          var proxyReadPixels = new Proxy(origReadPixels, {
            apply: function(target, thisArg, args) {
              var res = target.apply(thisArg, args);
              var pixels = args[6];
              if (pixels && (pixels instanceof Uint8Array || (typeof Uint8ClampedArray !== 'undefined' && pixels instanceof Uint8ClampedArray)) && pixels.length >= 16) {
                var rx = (Number(args[0]) || 0) | 0;
                var ry = (Number(args[1]) || 0) | 0;
                var rw = Math.max(1, (Number(args[2]) || Math.floor(pixels.length / 4)) | 0);
                var maxPx = Math.floor(pixels.length / 4);
                for (var pi = 0; pi < maxPx; pi++) {
                  var baseIdx = pi * 4;
                  if (pixels[baseIdx + 3] === 0) continue;
                  var px = rx + (pi % rw);
                  var py = ry + Math.floor(pi / rw);
                  var ph = Math.imul((px + canvasSaltA) | 0, 0x85ebca6b) ^
                           Math.imul((py + canvasSaltB) | 0, 0xc2b2ae35) ^ pSeed;
                  ph ^= ph >>> 15; ph = Math.imul(ph, 0x2545f491);
                  ph ^= ph >>> 13;
                  if ((ph & 63) === 0) {
                    var chOffset = canvasChTable[(ph >>> 6) & 63];
                    pixels[baseIdx + chOffset] ^= 1;
                  }
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
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }
`;
}
