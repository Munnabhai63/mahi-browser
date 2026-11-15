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

export interface FingerprintCoherenceReport {
  valid: boolean;
  normalizedSettings: any;
  warnings: string[];
}

/**
 * browserforge-style Statistical Cross-Signal Coherence Validator and Normalizer.
 * Detects and corrects contradictory fingerprint tuples across OS platform, GPU renderer,
 * WebGPU Dawn descriptors, touch points, screen resolution, and hardware capacity.
 */
export function validateAndNormalizeFingerprintCoherence(settings: any): FingerprintCoherenceReport {
  const warnings: string[] = [];
  const normalized = JSON.parse(JSON.stringify(settings || {}));

  normalized.browser = normalized.browser || {};
  normalized.fingerprint = normalized.fingerprint || {};
  normalized.display = normalized.display || {};
  normalized.locale = normalized.locale || {};

  let ua = String(normalized.browser.userAgent || '');
  const engine = normalized.browser.engine || 'chrome';

  // 0. Engine vs User-Agent Coherence
  if (engine === 'camoufox') {
    if (!ua.includes('Firefox') && !ua.includes('Gecko/')) {
      warnings.push(`Engine "camoufox" requires Firefox/Gecko User-Agent. Normalized from "${ua}".`);
      if (ua.includes('Android') || ua.includes('Mobile') || normalized.mobile?.enable) {
        normalized.browser.userAgent = 'Mozilla/5.0 (Android 14; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0';
      } else if (ua.includes('Macintosh')) {
        normalized.browser.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0';
      } else if (ua.includes('Linux') || ua.includes('X11')) {
        normalized.browser.userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0';
      } else {
        normalized.browser.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
      }
      ua = normalized.browser.userAgent;
    }
  } else if (ua.includes('Firefox') && !ua.includes('Chrome') && !ua.includes('AppleWebKit')) {
    warnings.push(`Chromium engine "${engine}" contradicts Firefox User-Agent. Normalized to Chromium User-Agent.`);
    if (ua.includes('Android') || ua.includes('Mobile') || normalized.mobile?.enable) {
      normalized.browser.userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';
    } else if (ua.includes('Macintosh')) {
      normalized.browser.userAgent = engine === 'edge'
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
    } else if (ua.includes('Linux') || ua.includes('X11')) {
      normalized.browser.userAgent = engine === 'edge'
        ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'
        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
    } else if (engine === 'edge') {
      normalized.browser.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0';
    } else {
      normalized.browser.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
    }
    ua = normalized.browser.userAgent;
  }

  const fp = normalized.fingerprint;
  const isMobile = Boolean(
    ua.includes('Android') ||
    ua.includes('Mobile') ||
    normalized.mobile?.enable
  );
  const isMac = !isMobile && ua.includes('Macintosh');
  const isLinux = !isMobile && !isMac && (ua.includes('Linux') || ua.includes('X11'));
  const isWindows = !isMobile && !isMac && !isLinux; // default desktop Windows

  // 1. OS & Platform Coherence
  if (isWindows) {
    if (fp.platform && fp.platform !== 'Win32') {
      warnings.push(`Platform "${fp.platform}" contradicts Windows User-Agent. Normalized to "Win32".`);
      fp.platform = 'Win32';
    }
    if (fp.isM1 || fp.architecture === 'arm64') {
      warnings.push('Apple Silicon / ARM64 flag contradicts Windows x86_64 User-Agent. Cleared isM1.');
      fp.isM1 = false;
      fp.architecture = 'x86_64';
    }
    if (fp.webglRenderer && (fp.webglRenderer.includes('Apple') || fp.webglRenderer.includes('Mali') || fp.webglRenderer.includes('Adreno'))) {
      warnings.push(`WebGL renderer "${fp.webglRenderer}" contradicts Windows platform. Normalized to Direct3D11 NVIDIA.`);
      fp.webglVendor = 'Google Inc. (NVIDIA)';
      fp.webglRenderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
    }
  } else if (isMac) {
    if (fp.platform && fp.platform !== 'MacIntel') {
      warnings.push(`Platform "${fp.platform}" contradicts macOS User-Agent. Normalized to "MacIntel".`);
      fp.platform = 'MacIntel';
    }
    if (fp.webglRenderer && (fp.webglRenderer.includes('Direct3D') || fp.webglRenderer.includes('Mali') || fp.webglRenderer.includes('Adreno'))) {
      warnings.push(`WebGL renderer "${fp.webglRenderer}" contradicts macOS. Normalized to Apple Metal.`);
      fp.webglVendor = 'Google Inc. (Apple)';
      fp.webglRenderer = 'ANGLE (Apple, Apple M1, Metal)';
    }
  } else if (isLinux) {
    if (fp.platform && fp.platform !== 'Linux x86_64') {
      warnings.push(`Platform "${fp.platform}" contradicts Linux User-Agent. Normalized to "Linux x86_64".`);
      fp.platform = 'Linux x86_64';
    }
    if (fp.isM1 || fp.architecture === 'arm64') {
      warnings.push('Apple Silicon / ARM64 flag contradicts Linux x86_64 User-Agent. Cleared isM1.');
      fp.isM1 = false;
      fp.architecture = 'x86_64';
    }
    if (fp.webglRenderer && (fp.webglRenderer.includes('Direct3D') || fp.webglRenderer.includes('Apple') || fp.webglRenderer.includes('Mali') || fp.webglRenderer.includes('Adreno'))) {
      warnings.push(`WebGL renderer "${fp.webglRenderer}" contradicts Linux platform. Normalized to Mesa.`);
      fp.webglVendor = 'Google Inc. (Mesa)';
      fp.webglRenderer = 'ANGLE (Mesa, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)';
    }
  } else if (isMobile) {
    if (fp.platform && !fp.platform.includes('Linux') && !fp.platform.includes('Android') && !fp.platform.includes('arm')) {
      warnings.push(`Platform "${fp.platform}" contradicts Android/Mobile User-Agent. Normalized to "Linux armv8l".`);
      fp.platform = 'Linux armv8l';
    }
    if (fp.maxTouchPoints === 0 || fp.maxTouchPoints === undefined) {
      warnings.push('maxTouchPoints: 0 contradicts Mobile/Android User-Agent. Normalized to 5.');
      fp.maxTouchPoints = 5;
    }
    if (fp.webglRenderer && (fp.webglRenderer.includes('Direct3D') || fp.webglRenderer.includes('NVIDIA'))) {
      warnings.push(`Desktop WebGL renderer "${fp.webglRenderer}" contradicts Mobile User-Agent. Normalized to ARM Mali.`);
      fp.webglVendor = 'ARM';
      fp.webglRenderer = 'Mali-G710 MC10';
    }
    if (!normalized.mobile?.enable) {
      normalized.mobile = normalized.mobile || {};
      normalized.mobile.enable = true;
    }
  }

  // 2. Hardware Capacity Bounds (Prevent unrealistic synthetic values)
  const validConcurrency = [2, 4, 6, 8, 12, 16, 24, 32];
  if (fp.hardwareConcurrency && !validConcurrency.includes(fp.hardwareConcurrency)) {
    const closest = validConcurrency.reduce((prev, curr) =>
      Math.abs(curr - fp.hardwareConcurrency) < Math.abs(prev - fp.hardwareConcurrency) ? curr : prev
    );
    warnings.push(`hardwareConcurrency ${fp.hardwareConcurrency} is an unnatural anomaly. Clamped to ${closest}.`);
    fp.hardwareConcurrency = closest;
  }

  const validDeviceMemory = [1, 2, 4, 8, 16, 32];
  if (fp.deviceMemory && !validDeviceMemory.includes(fp.deviceMemory)) {
    const anomalyClamp = [1, 2, 4, 8, 16];
    const closest = anomalyClamp.reduce((prev, curr) =>
      Math.abs(curr - fp.deviceMemory) < Math.abs(prev - fp.deviceMemory) ? curr : prev
    );
    warnings.push(`deviceMemory ${fp.deviceMemory} is an unnatural anomaly. Clamped to ${closest}.`);
    fp.deviceMemory = closest;
  }

  // 3. Screen Dimensions vs Desktop/Mobile Coherence
  if (isMobile) {
    if (normalized.display.screenWidth && normalized.display.screenWidth >= 1200) {
      warnings.push(`Screen width ${normalized.display.screenWidth} contradicts Mobile device. Normalized to 412x915.`);
      normalized.display.screenWidth = 412;
      normalized.display.screenHeight = 915;
      normalized.display.deviceScaleFactor = 2.625;
    }
  } else {
    if (normalized.display.screenWidth && normalized.display.screenWidth < 800) {
      warnings.push(`Screen width ${normalized.display.screenWidth} is too small for desktop profile. Normalized to 1920x1080.`);
      normalized.display.screenWidth = 1920;
      normalized.display.screenHeight = 1080;
      normalized.display.deviceScaleFactor = 1;
    }
  }

  // 4. Font-List OS Coherence
  const MAC_ONLY_FONTS = new Set([
    'Apple Color Emoji', 'Apple SD Gothic Neo', 'Avenir', 'Avenir Next', 'Baskerville',
    'Chalkboard', 'Didot', 'Futura', 'Geneva', 'Gill Sans', 'Helvetica Neue',
    'Lucida Grande', 'Menlo', 'Monaco', 'Optima', 'SF Pro', 'PingFang SC',
  ]);
  const WIN_ONLY_FONTS = new Set([
    'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'MS Gothic', 'MS PGothic',
    'MS Sans Serif', 'MS Serif', 'Palatino Linotype', 'Tahoma',
  ]);

  if (Array.isArray(fp.fonts) && fp.fonts.length > 0) {
    if (isWindows) {
      const filtered = fp.fonts.filter((f: string) => !MAC_ONLY_FONTS.has(f));
      if (filtered.length !== fp.fonts.length) {
        warnings.push(`macOS fonts detected on Windows profile. Removed contradictory fonts.`);
        fp.fonts = filtered.length > 0 ? filtered : ['Arial', 'Calibri', 'Segoe UI', 'Tahoma', 'Times New Roman'];
      }
    } else if (isMac) {
      const filtered = fp.fonts.filter((f: string) => !WIN_ONLY_FONTS.has(f));
      if (filtered.length !== fp.fonts.length) {
        warnings.push(`Windows fonts detected on macOS profile. Removed contradictory fonts.`);
        fp.fonts = filtered.length > 0 ? filtered : ['Arial', 'Helvetica', 'Helvetica Neue', 'Menlo', 'SF Pro'];
      }
    } else if (isLinux) {
      const filtered = fp.fonts.filter((f: string) => !WIN_ONLY_FONTS.has(f) && !MAC_ONLY_FONTS.has(f));
      if (filtered.length !== fp.fonts.length) {
        warnings.push(`Windows/macOS proprietary fonts detected on Linux profile. Removed contradictory fonts.`);
        fp.fonts = filtered.length > 0 ? filtered : ['DejaVu Sans', 'Liberation Sans', 'Ubuntu', 'FreeSans'];
      }
    }
  }

  return {
    valid: warnings.length === 0,
    normalizedSettings: normalized,
    warnings,
  };
}

/**
 * Injects the MAHI Native Stealth Preference Schema into Default/Preferences.
 * Step 4 operates as a hybrid JS/DNR + native preference schema bridge awaiting
 * full Step 5 custom C++ Chromium core hooks.
 *
 * Both 'mahi' and 'gologin' root dictionaries are populated with identical configurations
 * to ensure 100% backward compatibility with multi-core resolvers and legacy test assertions.
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

    const { normalizedSettings } = validateAndNormalizeFingerprintCoherence(settings);
    const effectiveSettings = normalizedSettings;

    const fp = effectiveSettings?.fingerprint || {};
    const display = effectiveSettings?.display || {};
    const locale = effectiveSettings?.locale || {};
    const browser = effectiveSettings?.browser || {};
    const ua = browser.userAgent || '';
    const isMobile = Boolean(
      ua.includes('Android') ||
      ua.includes('Mobile') ||
      effectiveSettings?.mobile?.enable
    );
    const isMac = !isMobile && ua.includes('Macintosh');
    const isLinux = !isMobile && !isMac && (ua.includes('Linux') || ua.includes('X11'));
    const isMacM1 = Boolean(isMac && (fp.isM1 || fp.architecture === 'arm64'));

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

    const nativeMahiStealthConfig: Record<string, any> = {
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
        platform: fp.platform || (isMobile ? 'Linux armv8l' : (isMac ? 'MacIntel' : (isLinux ? 'Linux x86_64' : 'Win32'))),
      },
      userAgent: ua,
      os: fp.platform || (isMobile ? 'Linux armv8l' : (isMac ? 'MacIntel' : (isLinux ? 'Linux x86_64' : 'Win32'))),
      hardwareArchitecture: isMobile ? 'arm' : (isMacM1 ? 'arm' : (fp.architecture || 'x86')),
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
      nativeMahiStealthConfig.timezone = {
        id: locale.timezone,
      };
    }

    // Geolocation injection
    if (settings?.permissions?.geolocationData) {
      const geo = settings.permissions.geolocationData;
      nativeMahiStealthConfig.geoLocation = {
        mode: 'prompt',
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy || 100,
      };
    }

    // WebRTC Public IP & ICE blackhole spoofing
    if (proxyIp) {
      nativeMahiStealthConfig.webrtc = {
        enable: true,
        mode: 'alerted',
        publicIP: proxyIp,
        should_fill_empty_ice_list: true,
      };
      nativeMahiStealthConfig.network = {
        enable: true,
        mask: true,
      };
    }

    // Attach native schema to the root of Chromium Preferences
    prefs.mahi = nativeMahiStealthConfig;
    prefs.gologin = nativeMahiStealthConfig; // Legacy mirror for compatibility with C++ engine and existing tests

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
