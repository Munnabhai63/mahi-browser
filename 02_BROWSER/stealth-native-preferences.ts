import fs from 'node:fs';
import path from 'node:path';
import { Profile } from '../10_CONFIG/shared/types/profile.js';

/**
 * Generates a stable, deterministic numeric hash from a profile string seed.
 * Ensures that the mathematical noise injected into Canvas, WebGL, and AudioContext
 * is PERSISTENT across sessions (solving the statistical variance detection flaw).
 */
export function getDeterministicSeed(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 12345;
}

/**
 * Converts a numeric seed into a micro-jitter noise floating point value (e.g. 0.0000124)
 */
export function getNoiseValueFromSeed(seed: number, divisor = 1000000): number {
  return parseFloat(((seed % 999 + 1) / divisor).toFixed(7));
}

export interface WebGpuAdapterConfig {
  architecture?: string;
  vendor?: string;
  device?: string;
  description?: string;
}

/**
 * Injects the complete 117-key decompiled C++ native preference schema into Default/Preferences.
 * Reverse-engineered directly from Orbita chrome.dll (preference.cc, content.cc, gologin_main_parts.cc).
 *
 * Chromium C++ core reads the 'gologin' root dictionary directly in native memory
 * before web content or JavaScript can execute.
 *
 * This completely replaces and eliminates the need for detectable Chrome extensions
 * or JavaScript monkey-patching!
 */
export function injectNativeStealthPreferences(
  storageDir: string,
  profile: Profile,
  settings: any,
  proxyIp?: string
): void {
  try {
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

    const seed = getDeterministicSeed(profile.id + '_' + (profile.name || 'mahi'));
    const canvasNoiseVal = getNoiseValueFromSeed(seed, 500000);
    const audioNoiseVal = getNoiseValueFromSeed(seed, 1000000);
    const webglNoiseVal = getNoiseValueFromSeed(seed, 750000);

    const fp = settings?.fingerprint || {};
    const display = settings?.display || {};
    const locale = settings?.locale || {};
    const browser = settings?.browser || {};
    const ua = browser.userAgent || '';
    const isMobile = Boolean(
      ua.includes('Android') ||
      ua.includes('Mobile') ||
      settings?.mobile?.enable
    );
    const isMacM1 = Boolean(ua.includes('Macintosh') && (fp.isM1 || fp.architecture === 'arm64'));

    // WebGL Vendor & Renderer
    const webglVendor = fp.webglVendor || (isMobile ? 'ARM' : 'Google Inc. (NVIDIA)');
    const webglRenderer = fp.webglRenderer || (
      isMobile
        ? 'Mali-G710 MC10'
        : 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
    );

    // WebGPU Hardware Descriptors (Dawn Pipeline)
    const gpuArch = isMobile ? 'valhall' : (isMacM1 ? 'apple-m1' : 'ampere');
    const gpuVendor = isMobile ? 'arm' : (isMacM1 ? 'apple' : 'nvidia');
    const gpuDevice = isMobile ? 'Mali-G710' : (isMacM1 ? 'Apple M1' : 'NVIDIA GeForce RTX 3060');

    // Language list (supports both locale.languagesList and locale.languages)
    const languagesList = Array.isArray(locale.languagesList) && locale.languagesList.length > 0
      ? locale.languagesList
      : (Array.isArray(locale.languages) && locale.languages.length > 0
        ? locale.languages
        : ['en-US', 'en']);

    // Fake Video Capture (Facial KYC / Video Loop bypass)
    const fakeVideoEnabled = Boolean(settings?.fakeVideoCapture?.enable && settings?.fakeVideoCapture?.filePath);
    const fakeVideoFile = fakeVideoEnabled ? String(settings.fakeVideoCapture.filePath) : '';

    const nativeGologinConfig: Record<string, any> = {
      // 1. 2D Canvas Noise (Skia engine hooks)
      canvasMode: fp.canvas === 'off' ? 'off' : 'noise',
      canvasNoise: fp.canvas === 'off' ? 0 : canvasNoiseVal,
      canvasCntPixels: 10,

      // 2. ClientRects DOM Jitter (Layout fingerprinting protection)
      client_rects_noise_enable: fp.clientRects !== 'off',
      get_client_rects_noise: fp.clientRects !== 'off',

      // 3. AudioContext Floating Point Delta
      audioContext: {
        enable: fp.audio !== 'off',
        noiseValue: fp.audio !== 'off' ? audioNoiseVal : 0,
      },

      // 4. WebGL Native Metadata & Buffer Limits
      webgl: {
        metadata: {
          mode: 'mask',
          vendor: webglVendor,
          renderer: webglRenderer,
        },
      },
      webgl_noise_enable: fp.webgl !== 'off',
      webgl_noise_value: fp.webgl !== 'off' ? webglNoiseVal : 0,
      webglParams: {
        antialiasing: true,
        textureMaxAnisotropyExt: 16,
        glParamValues: {},
        supportedFunctions: [],
        extensions: [],
        webGl: {
          extensions: [],
        },
      },
      webGl: {
        maxTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxVaryingVectors: 30,
        maxVertexTextureImageUnits: 16,
        maxVertexUniformVectors: 4096,
      },

      // 5. WebGPU High Performance Adapter Masking (Dawn Engine)
      webGpu: {
        supportedAdapters: {
          highPerformance: {
            info: {
              architecture: gpuArch,
              vendor: gpuVendor,
              device: gpuDevice,
              description: `${gpuDevice} Native Direct3D12/Metal Driver`,
            },
            features: [],
            limits: {},
            textureFormatCapabilities: {},
            flags: {
              isFallbackAdapter: false,
            },
          },
        },
      },

      // 6. Virtual Video Camera Feed (KYC Bypass)
      fake_video_capture: {
        enable: fakeVideoEnabled,
        file_name: fakeVideoFile,
      },

      // 7. Mobile & Apple Silicon Hardware Masking
      mobile: {
        enable: isMobile,
        width: isMobile ? (display.screenWidth || 412) : 0,
        height: isMobile ? (display.screenHeight || 915) : 0,
        device_scale_factor: isMobile ? (display.deviceScaleFactor || 2.625) : 1,
      },
      is_m1: isMacM1,

      // 8. Navigator & Platform Descriptors
      navigator: {
        max_touch_points: isMobile ? 5 : (fp.maxTouchPoints ?? 0),
        platform: isMobile ? 'Linux armv8l' : (isMacM1 ? 'MacIntel' : 'Win32'),
      },
      hardwareConcurrency: fp.hardwareConcurrency || 16,
      deviceMemory: fp.deviceMemory || 16,
      battery: {
        is_masking: true,
      },

      // 9. Media Devices Enumeration
      mediaDevices: {
        enable: true,
        audioInputs: 1,
        audioOutputs: 1,
        videoInputs: 1,
        uid: `mahi_media_${profile.id.substring(0, 8)}`,
      },

      // 10. Localization & Network Language Headers
      languages: languagesList,
      langHeader: languagesList.join(','),
      locale: languagesList[0] || 'en-US',
      doNotTrack: 1,

      // 11. Security, Extensions & Validation
      unpinable_extension_names: ['mahi-stealth', 'gologin-stealth'],
      browserValidation: true,
      plugins: {
        all_enable: true,
        flash_enable: false,
      },
      profile_id: profile.id,
      startupUrl: '',
      startup_urls: [],
    };

    // Timezone injection
    if (locale.timezone) {
      nativeGologinConfig.timezone = {
        id: locale.timezone,
      };
    }

    // Geolocation injection
    if (settings?.permissions?.geolocationData) {
      const geo = settings.permissions.geolocationData;
      nativeGologinConfig.geoLocation = {
        mode: 'prompt',
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy || 100,
      };
    }

    // WebRTC Public IP & ICE blackhole spoofing
    if (proxyIp) {
      nativeGologinConfig.webrtc = {
        enable: true,
        mode: 'alerted',
        publicIP: proxyIp,
        should_fill_empty_ice_list: true,
      };
      nativeGologinConfig.network = {
        enable: true,
        mask: true,
      };
    }

    // Attach native schema to the root of Chromium Preferences
    prefs.gologin = nativeGologinConfig;

    // Disable HTTPS-First Mode interstitial to allow seamless proxy & HTTP testing
    if (!prefs.security || typeof prefs.security !== 'object') {
      prefs.security = {};
    }
    prefs.security.https_first_mode_enabled = false;

    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), { encoding: 'utf8', mode: 0o666 });
  } catch (err) {
    console.error(`[StealthNativePreferences] Failed to inject native preferences into ${storageDir}:`, err);
  }
}
