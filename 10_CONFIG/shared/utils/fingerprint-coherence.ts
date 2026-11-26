/**
 * Pure, 100% browser-safe statistical fingerprint coherence validation & normalization.
 * ZERO Node.js imports (no node:fs, node:path, node:crypto, etc.) so this module can safely
 * run in both Node.js (main/backend) and browser environments (Electron renderer with nodeIntegration: false).
 */

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

export interface GreaseBrandTriplet {
  greaseBrand: string;
  greaseVersion: string;
}

const GREASE_CANDIDATES: ReadonlyArray<GreaseBrandTriplet> = [
  { greaseBrand: 'Not/A)Brand', greaseVersion: '8' },
  { greaseBrand: 'Not/A)Brand', greaseVersion: '24' },
  { greaseBrand: 'Not A;Brand', greaseVersion: '99' },
  { greaseBrand: 'Not A;Brand', greaseVersion: '24' },
  { greaseBrand: 'Not.A/Brand', greaseVersion: '8' },
  { greaseBrand: 'Not.A/Brand', greaseVersion: '99' },
  { greaseBrand: 'Not)A;Brand', greaseVersion: '99' },
];

/**
 * Deterministically selects a realistic Chrome GREASE brand/version from profile seed.
 */
export function getDeterministicGreaseTriplet(seedInput: string | number): GreaseBrandTriplet {
  const seed = typeof seedInput === 'number' ? Math.abs(seedInput) : getDeterministicSeed(String(seedInput || 'default'));
  const idx = seed % GREASE_CANDIDATES.length;
  return GREASE_CANDIDATES[idx];
}

export interface WebglDeterministicLimits {
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxVertexUniformVectors: number;
  maxVaryingVectors: number;
  maxVertexAttribs: number;
}

/**
 * Deterministically picks realistic WebGL parameter limits per profile seed and device tier.
 */
export function getDeterministicWebglLimits(
  seedInput: string | number,
  isMobile: boolean
): WebglDeterministicLimits {
  const seed = typeof seedInput === 'number' ? Math.abs(seedInput) : getDeterministicSeed(String(seedInput || 'default'));
  const maxTextureSize = (seed & 1) === 0 ? 16384 : 8192;
  const maxRenderbufferSize = ((seed >>> 1) & 1) === 0 ? maxTextureSize : 8192;
  const maxVertexUniformVectors = isMobile
    ? (((seed >>> 2) & 1) === 0 ? 4096 : 1024)
    : (((seed >>> 2) & 1) === 0 ? 4096 : 8192);
  const maxVaryingVectors = ((seed >>> 3) & 1) === 0 ? 30 : 16;
  return {
    maxTextureSize,
    maxRenderbufferSize,
    maxVertexUniformVectors,
    maxVaryingVectors,
    maxVertexAttribs: 16,
  };
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

const MAC_ONLY_FONTS = new Set([
  'Apple Color Emoji', 'Apple SD Gothic Neo', 'Avenir', 'Avenir Next', 'Baskerville',
  'Chalkboard', 'Didot', 'Futura', 'Geneva', 'Gill Sans', 'Helvetica Neue',
  'Lucida Grande', 'Menlo', 'Monaco', 'Optima', 'SF Pro', 'PingFang SC',
]);

const WIN_ONLY_FONTS = new Set([
  'Segoe UI', 'Calibri', 'Cambria', 'Consolas', 'MS Gothic', 'MS PGothic',
  'MS Sans Serif', 'MS Serif', 'Palatino Linotype', 'Tahoma',
]);

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
    const closest = validConcurrency.reduce((prev: number, curr: number) =>
      Math.abs(curr - fp.hardwareConcurrency) < Math.abs(prev - fp.hardwareConcurrency) ? curr : prev
    );
    warnings.push(`hardwareConcurrency ${fp.hardwareConcurrency} is an unnatural anomaly. Clamped to ${closest}.`);
    fp.hardwareConcurrency = closest;
  }

  const validDeviceMemory = [1, 2, 4, 8, 16, 32];
  if (fp.deviceMemory && !validDeviceMemory.includes(fp.deviceMemory)) {
    const anomalyClamp = [1, 2, 4, 8, 16];
    const closest = anomalyClamp.reduce((prev: number, curr: number) =>
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
