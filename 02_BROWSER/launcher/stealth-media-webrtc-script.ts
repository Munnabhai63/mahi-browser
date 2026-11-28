import type { StealthScriptContext } from './launcher-shared.js';

/**
 * Generates WebGPU hardware descriptors, AudioContext acoustic frequency jitter,
 * WebRTC JS leak guard, and closing IIFE tail for stealth-core.js.
 */
export function buildStealthMediaWebrtcSection(ctx: StealthScriptContext): string {
  const {
    gpuSpoofOn,
    gpuVendor,
    gpuRenderer,
    isMobile,
    isMacArm,
    isLinux,
    audioMode,
    webrtcOpt,
  } = ctx;

  return `
  // -------------------------------------------------------------
  // 4.5 WebGPU Hardware Descriptors (Coherent with WebGL Vendor/Renderer)
  // -------------------------------------------------------------
  try {
    if (${gpuSpoofOn} && navigator.gpu && navigator.gpu.requestAdapter) {
      var glHint = (${JSON.stringify(gpuVendor)} + ' ' + ${JSON.stringify(gpuRenderer)}).toLowerCase();
      var inferredGpuVendor = ${JSON.stringify(isMobile ? 'arm' : (isMacArm ? 'apple' : 'NVIDIA'))};
      var inferredGpuArch = ${JSON.stringify(isMobile ? 'valhall' : (isMacArm ? 'apple-m1' : 'ampere'))};
      if (glHint.indexOf('intel') !== -1) {
        inferredGpuVendor = 'intel';
        inferredGpuArch = 'gen-12lp';
      } else if (glHint.indexOf('amd') !== -1 || glHint.indexOf('radeon') !== -1 || glHint.indexOf('ati') !== -1) {
        inferredGpuVendor = 'amd';
        inferredGpuArch = 'rdna-2';
      } else if (glHint.indexOf('apple') !== -1) {
        inferredGpuVendor = 'apple';
        inferredGpuArch = 'apple-m2';
      } else if (glHint.indexOf('adreno') !== -1 || glHint.indexOf('qualcomm') !== -1) {
        inferredGpuVendor = 'qualcomm';
        inferredGpuArch = 'adreno-6xx';
      } else if (glHint.indexOf('mali') !== -1 || glHint.indexOf('arm') !== -1) {
        inferredGpuVendor = 'arm';
        inferredGpuArch = 'valhall';
      } else if (glHint.indexOf('nvidia') !== -1 || glHint.indexOf('geforce') !== -1 || glHint.indexOf('rtx') !== -1) {
        inferredGpuVendor = 'nvidia';
        inferredGpuArch = 'ampere';
      } else if (${isLinux ? 'true' : 'false'}) {
        inferredGpuVendor = 'mesa';
        inferredGpuArch = 'gen-12lp';
      }
      var gpuInfo = {
        architecture: inferredGpuArch,
        vendor: inferredGpuVendor,
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
            } catch(e) { void 0; /* page-context stealth isolation */ }
            return adapter;
          });
        }
      });
      navigator.gpu.requestAdapter = proxyRequestAdapter;
      registerNative(proxyRequestAdapter, 'requestAdapter');
      registerNative(origRequestAdapter, 'requestAdapter');
    }
  } catch(e) { void 0; /* page-context stealth isolation */ }

  // -------------------------------------------------------------
  // 5. AudioContext Acoustic Frequency Jitter (No In-Place Drift)
  // -------------------------------------------------------------
  if (${audioMode !== 'off'}) {
    try {
      if (typeof window !== 'undefined' && window.AudioBuffer) {
        var perturbedBuffers = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
        var audioRng = createMulberry32(pSeed ^ 0x41554449);
        var audioOffsets = [];
        for (var ai = 0; ai < 64; ai++) {
          var ao = (audioRng() - 0.5) * 2e-6;
          audioOffsets.push(ao === 0 ? 1e-7 : ao);
        }
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
                for (var i = 0, step = 0; i < buffer.length; i += 100, step++) {
                  buffer[i] += audioOffsets[step & 63];
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

      if (typeof window !== 'undefined' && window.AnalyserNode && window.AnalyserNode.prototype && window.AnalyserNode.prototype.getFloatFrequencyData) {
        var freqRng = createMulberry32(pSeed ^ 0x46524551);
        var freqOffsets = [];
        for (var fi = 0; fi < 64; fi++) {
          var fo = (freqRng() - 0.5) * 0.002;
          freqOffsets.push(fo === 0 ? 0.0005 : fo);
        }
        var origGetFloatFrequencyData = window.AnalyserNode.prototype.getFloatFrequencyData;
        var proxyGetFloatFrequencyData = new Proxy(origGetFloatFrequencyData, {
          apply: function(target, thisArg, argumentsList) {
            var res = target.apply(thisArg, argumentsList);
            var arr = argumentsList && argumentsList[0];
            if (arr && typeof arr.length === 'number') {
              for (var j = 0; j < arr.length; j++) {
                var val = arr[j];
                if (typeof val === 'number' && isFinite(val)) {
                  arr[j] = val + freqOffsets[j & 63];
                }
              }
            }
            return res;
          }
        });
        window.AnalyserNode.prototype.getFloatFrequencyData = proxyGetFloatFrequencyData;
        registerNative(proxyGetFloatFrequencyData, 'getFloatFrequencyData');
        registerNative(origGetFloatFrequencyData, 'getFloatFrequencyData');
      }
    } catch(e) { void 0; /* page-context stealth isolation */ }
  }

  // -------------------------------------------------------------
  // 6. WebRTC JS Leak Guard (Relay Policy & Local IP Sanitization)
  // -------------------------------------------------------------
  try {
    var rtcMode = ${JSON.stringify(webrtcOpt)};
    if (rtcMode === 'proxy_only' || rtcMode === 'disabled' || rtcMode === 'disable_non_proxied_udp' || rtcMode === 'altered') {
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
          } catch(e) { void 0; /* page-context stealth isolation */ }
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
          } catch(e) { void 0; /* page-context stealth isolation */ }

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
                } catch(e) { void 0; /* page-context stealth isolation */ }
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
  } catch(e) { void 0; /* page-context stealth isolation */ }
})();
`;
}
