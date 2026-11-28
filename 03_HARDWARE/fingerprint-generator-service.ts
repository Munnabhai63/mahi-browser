import { FingerprintGenerator } from 'fingerprint-generator';
import { HeaderGenerator } from 'header-generator';
import type { ProfileSettings, StatisticalProfileOptions } from '../10_CONFIG/shared/types/profile.js';
import { MANAGED_ENGINE_VERSION } from '../10_CONFIG/engine-config.js';
import {
  validateAndNormalizeFingerprintCoherence,
  getDeterministicGreaseTriplet,
  getDeterministicSeed,
} from '../10_CONFIG/shared/utils/fingerprint-coherence.js';

export type { StatisticalProfileOptions };

const OS_FONTS = {
  windows: [
    'Arial',
    'Calibri',
    'Cambria',
    'Consolas',
    'Courier New',
    'Georgia',
    'Lucida Console',
    'MS Gothic',
    'MS PGothic',
    'MS Sans Serif',
    'MS Serif',
    'Palatino Linotype',
    'Segoe UI',
    'Tahoma',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
  ],
  macos: [
    'American Typewriter',
    'Apple Color Emoji',
    'Arial',
    'Avenir',
    'Avenir Next',
    'Courier New',
    'Geneva',
    'Georgia',
    'Helvetica',
    'Helvetica Neue',
    'Lucida Grande',
    'Menlo',
    'Monaco',
    'SF Pro',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
  ],
  linux: [
    'DejaVu Sans',
    'DejaVu Serif',
    'DejaVu Sans Mono',
    'Liberation Sans',
    'Liberation Serif',
    'Liberation Mono',
    'Ubuntu',
    'FreeSans',
    'FreeSerif',
  ],
  android: ['Roboto', 'Noto Sans', 'Droid Sans'],
};

const REGION_MAP: Record<string, { timezone: string; languagesList: string[] }> = {
  'en-US': { timezone: 'America/New_York', languagesList: ['en-US', 'en'] },
  'en-GB': { timezone: 'Europe/London', languagesList: ['en-GB', 'en'] },
  'de-DE': { timezone: 'Europe/Berlin', languagesList: ['de-DE', 'de', 'en'] },
  'fr-FR': { timezone: 'Europe/Paris', languagesList: ['fr-FR', 'fr', 'en'] },
  'es-ES': { timezone: 'Europe/Madrid', languagesList: ['es-ES', 'es', 'en'] },
  'ja-JP': { timezone: 'Asia/Tokyo', languagesList: ['ja-JP', 'ja', 'en'] },
  'zh-CN': { timezone: 'Asia/Shanghai', languagesList: ['zh-CN', 'zh', 'en'] },
  'pt-BR': { timezone: 'America/Sao_Paulo', languagesList: ['pt-BR', 'pt', 'en'] },
  'ru-RU': { timezone: 'Europe/Moscow', languagesList: ['ru-RU', 'ru', 'en'] },
};

let cachedFingerprintGenerator: FingerprintGenerator | null = null;
let cachedHeaderGenerator: HeaderGenerator | null = null;

function getGenerators(): { fg: FingerprintGenerator; hg: HeaderGenerator } {
  if (!cachedFingerprintGenerator) {
    cachedFingerprintGenerator = new FingerprintGenerator();
  }
  if (!cachedHeaderGenerator) {
    cachedHeaderGenerator = new HeaderGenerator();
  }
  return { fg: cachedFingerprintGenerator, hg: cachedHeaderGenerator };
}

/**
 * Creates a deterministic pseudo-random number generator (Mulberry32) from an integer seed.
 */
function createSeededRng(seed: number) {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bayesian Statistical Profile & Fingerprint Generator.
 * Replaces naive Math.random() defaults with realistic, correlated hardware and software specs
 * matching target OS, browser engine, display, memory, fonts, and client hints.
 */
export function generateStatisticalProfileSettings(options: StatisticalProfileOptions = {}): ProfileSettings {
  const seedNum = options.seed !== undefined
    ? (typeof options.seed === 'number' ? Math.abs(options.seed) : getDeterministicSeed(String(options.seed)))
    : Math.floor(Math.random() * 10000000);
  const rng = createSeededRng(seedNum);

  // 1. Resolve Target OS and Engine
  const targetOs: 'windows' | 'macos' | 'linux' | 'android' = options.os || (
    options.deviceCategory === 'mobile'
      ? 'android'
      : (['windows', 'macos', 'linux'] as const)[Math.floor(rng() * 3)]
  );

  const engine: 'chromium' | 'chrome' | 'edge' | 'camoufox' = options.engine || (
    targetOs === 'android' ? 'chrome' : (['chrome', 'edge', 'chromium'] as const)[Math.floor(rng() * 3)]
  );

  const isMobile = targetOs === 'android' || options.deviceCategory === 'mobile';
  const isMac = !isMobile && targetOs === 'macos';
  const isLinux = !isMobile && !isMac && targetOs === 'linux';
  const isWindows = !isMobile && !isMac && !isLinux;
  const isMacM1 = isMac && (rng() > 0.3); // 70% chance of Apple Silicon on modern macOS

  // 2. Resolve Locale and Timezone
  let localeKey = options.locale || 'en-US';
  const regionData = REGION_MAP[localeKey] || {
    timezone: options.timezone || 'America/New_York',
    languagesList: [localeKey, 'en'],
  };
  let targetTimezone = options.timezone || regionData.timezone;
  let targetLanguagesList = regionData.languagesList;

interface BrandVersionEntry {
  brand: string;
  version: string;
}

interface BayesianUserAgentDataLike {
  brands?: BrandVersionEntry[];
  fullVersionList?: BrandVersionEntry[];
  platform?: string;
  platformVersion?: string;
  architecture?: string;
  model?: string;
  bitness?: string;
}

type FgOptions = NonNullable<Parameters<FingerprintGenerator['getFingerprint']>[0]>;
type HgOptions = NonNullable<Parameters<HeaderGenerator['getHeaders']>[0]>;
type FgOperatingSystem = NonNullable<FgOptions['operatingSystems']>[number];
type HgOperatingSystem = NonNullable<HgOptions['operatingSystems']>[number];
type BayesianFingerprint = ReturnType<FingerprintGenerator['getFingerprint']>['fingerprint'] & {
  navigator?: {
    userAgentData?: BayesianUserAgentDataLike;
  };
};
type BayesianHeaders = ReturnType<HeaderGenerator['getHeaders']>;

  // 3. Bayesian Generation via FingerprintGenerator & HeaderGenerator (only when unseeded)
  let bayesianFp: BayesianFingerprint | null = null;
  let bayesianHeaders: BayesianHeaders | null = null;
  if (options.seed === undefined) {
    try {
      const { fg, hg } = getGenerators();
      const osMap: Record<'windows' | 'macos' | 'linux' | 'android', FgOperatingSystem & HgOperatingSystem> = {
        windows: 'windows',
        macos: 'macos',
        linux: 'linux',
        android: 'android',
      };
      const resolvedOs = osMap[targetOs] || 'windows';
      bayesianFp = fg.getFingerprint({
        operatingSystems: [resolvedOs],
        devices: [isMobile ? 'mobile' : 'desktop'],
        browsers: engine === 'camoufox'
          ? [{ name: 'firefox' }]
          : [{ name: engine === 'edge' ? 'edge' : 'chrome' }],
      })?.fingerprint as BayesianFingerprint | undefined ?? null;

      bayesianHeaders = hg.getHeaders({
        operatingSystems: [resolvedOs],
        browsers: engine === 'camoufox'
          ? [{ name: 'firefox' }]
          : [{ name: engine === 'edge' ? 'edge' : 'chrome' }],
      });

      if (!options.locale && bayesianHeaders) {
        const al = bayesianHeaders['accept-language'] || bayesianHeaders['Accept-Language'];
        if (al && typeof al === 'string') {
          const parsed = al.split(',').map((s) => s.split(';')[0].trim()).filter(Boolean);
          if (parsed.length > 0) {
            targetLanguagesList = parsed;
            localeKey = parsed[0];
            if (!options.timezone && REGION_MAP[localeKey]) {
              targetTimezone = REGION_MAP[localeKey].timezone;
            }
          }
        }
      }
    } catch {
      bayesianFp = null;
      bayesianHeaders = null;
    }
  }

  // 4. Synthesize Coherent User-Agent
  let userAgent = '';
  const chromeMajor = MANAGED_ENGINE_VERSION.split('.')[0] || '138';
  if (engine === 'camoufox') {
    if (isMobile) {
      userAgent = 'Mozilla/5.0 (Android 14; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0';
    } else if (isMac) {
      userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0';
    } else if (isLinux) {
      userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0';
    } else {
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
    }
  } else if (engine === 'edge') {
    if (isMobile) {
      userAgent = `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Mobile Safari/537.36 EdgA/${MANAGED_ENGINE_VERSION}`;
    } else if (isMac) {
      userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36 Edg/${MANAGED_ENGINE_VERSION}`;
    } else if (isLinux) {
      userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36 Edg/${MANAGED_ENGINE_VERSION}`;
    } else {
      userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36 Edg/${MANAGED_ENGINE_VERSION}`;
    }
  } else {
    // Chrome or Chromium
    if (isMobile) {
      userAgent = `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Mobile Safari/537.36`;
    } else if (isMac) {
      userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36`;
    } else if (isLinux) {
      userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36`;
    } else {
      userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36`;
    }
  }

  // 5. Synthesize Display Metrics
  let screenWidth = 1920;
  let screenHeight = 1080;
  let deviceScaleFactor = 1;
  let colorDepth = 24;

  if (options.seed === undefined && bayesianFp?.screen?.width && bayesianFp.screen.width >= (isMobile ? 320 : 1280)) {
    screenWidth = bayesianFp.screen.width;
    screenHeight = bayesianFp.screen.height || 1080;
    deviceScaleFactor = bayesianFp.screen.devicePixelRatio || 1;
    colorDepth = bayesianFp.screen.colorDepth || 24;
  } else if (isMobile) {
    const mobileResolutions = [
      { w: 412, h: 915, dpr: 2.625 },
      { w: 393, h: 852, dpr: 3 },
      { w: 360, h: 800, dpr: 2 },
    ];
    const picked = mobileResolutions[Math.floor(rng() * mobileResolutions.length)];
    screenWidth = picked.w;
    screenHeight = picked.h;
    deviceScaleFactor = picked.dpr;
  } else if (isMac) {
    const macResolutions = [
      { w: 1440, h: 900, dpr: 2 },
      { w: 1680, h: 1050, dpr: 2 },
      { w: 2560, h: 1440, dpr: 1 },
      { w: 1920, h: 1080, dpr: 1 },
    ];
    const picked = macResolutions[Math.floor(rng() * macResolutions.length)];
    screenWidth = picked.w;
    screenHeight = picked.h;
    deviceScaleFactor = picked.dpr;
  } else {
    // Windows & Linux
    const desktopResolutions = [
      { w: 1920, h: 1080, dpr: 1 },
      { w: 2560, h: 1440, dpr: 1 },
      { w: 1536, h: 864, dpr: 1.25 },
      { w: 1366, h: 768, dpr: 1 },
    ];
    const picked = desktopResolutions[Math.floor(rng() * desktopResolutions.length)];
    screenWidth = picked.w;
    screenHeight = picked.h;
    deviceScaleFactor = picked.dpr;
  }

  // 6. Synthesize WebGL & WebGPU Hardware Descriptors
  let webglVendor = 'Google Inc. (NVIDIA)';
  let webglRenderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

  if (options.seed === undefined && bayesianFp?.videoCard?.renderer) {
    webglVendor = bayesianFp.videoCard.vendor || webglVendor;
    webglRenderer = bayesianFp.videoCard.renderer;
  } else if (isMobile) {
    webglVendor = 'ARM';
    webglRenderer = 'Mali-G710 MC10';
  } else if (isMac) {
    webglVendor = 'Google Inc. (Apple)';
    webglRenderer = isMacM1
      ? 'ANGLE (Apple, Apple M1, Metal)'
      : 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1 Metal - 88.1)';
  } else if (isLinux) {
    webglVendor = 'Google Inc. (Mesa)';
    webglRenderer = 'ANGLE (Mesa, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)';
  } else {
    // Windows GPU variety
    const winGpus = [
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    ];
    const pickedGpu = winGpus[Math.floor(rng() * winGpus.length)];
    webglVendor = pickedGpu.vendor;
    webglRenderer = pickedGpu.renderer;
  }

  // 7. Hardware Capacity & Touch Points
  let hardwareConcurrency = isMobile ? 8 : (isMac ? (isMacM1 ? 8 : 4) : ([8, 12, 16] as const)[Math.floor(rng() * 3)]);
  let deviceMemory: number = isMobile ? 8 : ([4, 8, 16] as const)[Math.floor(rng() * 3)];
  if (options.seed === undefined && bayesianFp?.navigator?.hardwareConcurrency) {
    hardwareConcurrency = bayesianFp.navigator.hardwareConcurrency;
  }
  if (options.seed === undefined && bayesianFp?.navigator?.deviceMemory) {
    deviceMemory = bayesianFp.navigator.deviceMemory;
  }

  const maxTouchPoints = isMobile ? 5 : 0;
  const platformStr = isMobile ? 'Linux armv8l' : (isMac ? 'MacIntel' : (isLinux ? 'Linux x86_64' : 'Win32'));
  const architecture = isMobile ? 'arm' : (isMacM1 ? 'arm64' : 'x86_64');

  // 8. OS-Accurate Font List
  const fonts = [...(OS_FONTS[targetOs] || OS_FONTS.windows)];

  // 9. Client Hints (for Chromium-family engines)
  let clientHints: NonNullable<ProfileSettings['fingerprint']>['clientHints'] ;
  if (engine !== 'camoufox') {
    if (options.seed === undefined && bayesianFp?.navigator?.userAgentData?.brands?.length) {
      const isGreaseBrand = (name: string): boolean => {
        return /not.*brand/i.test(name) || (name.includes('Not') && name.includes('Brand'));
      };
      const targetPrimaryBrand = engine === 'edge' ? 'Microsoft Edge' : 'Google Chrome';
      const normalizeBrandName = (rawName: string): string => {
        if (isGreaseBrand(rawName)) {
          return rawName;
        }
        if (rawName === 'Chromium') {
          return 'Chromium';
        }
        if (rawName === 'HeadlessChrome' || /chrome/i.test(rawName) || /edge/i.test(rawName)) {
          return targetPrimaryBrand;
        }
        return rawName;
      };

      const uaData = bayesianFp.navigator.userAgentData;
      let brands: BrandVersionEntry[] = (uaData.brands ?? []).map((b) => {
        const brandName = normalizeBrandName(b.brand);
        if (brandName === 'Chromium' || brandName === targetPrimaryBrand) {
          return { brand: brandName, version: chromeMajor };
        }
        return { brand: brandName, version: b.version };
      });

      if (!brands.some((b) => b.brand === targetPrimaryBrand)) {
        brands.push({ brand: targetPrimaryBrand, version: chromeMajor });
      }
      const seenBrands = new Set<string>();
      brands = brands.filter((b) => {
        if (seenBrands.has(b.brand)) return false;
        seenBrands.add(b.brand);
        return true;
      });

      const rawFullVersionList: BrandVersionEntry[] =
        uaData.fullVersionList || brands.map((b) => ({ brand: b.brand, version: `${b.version}.0.0.0` }));
      let fullVersionList: BrandVersionEntry[] = rawFullVersionList.map((b) => {
        const brandName = normalizeBrandName(b.brand);
        if (brandName === 'Chromium' || brandName === targetPrimaryBrand) {
          return { brand: brandName, version: MANAGED_ENGINE_VERSION };
        }
        return { brand: brandName, version: b.version };
      });

      if (!fullVersionList.some((fv) => fv.brand === targetPrimaryBrand)) {
        fullVersionList.push({ brand: targetPrimaryBrand, version: MANAGED_ENGINE_VERSION });
      }
      const seenFv = new Set<string>();
      fullVersionList = fullVersionList.filter((b) => {
        if (seenFv.has(b.brand)) return false;
        seenFv.add(b.brand);
        return true;
      });
      clientHints = {
        brands,
        mobile: isMobile,
        platform: uaData.platform || (isWindows ? 'Windows' : (isMac ? 'macOS' : (isLinux ? 'Linux' : 'Android'))),
        platformVersion: uaData.platformVersion || (isWindows ? '15.0.0' : (isMac ? '14.5.0' : '6.5.0')),
        architecture: uaData.architecture || (isMobile ? 'arm' : (isMacM1 ? 'arm' : 'x86')),
        model: uaData.model || (isMobile ? 'Pixel 8' : ''),
        bitness: uaData.bitness || '64',
        fullVersionList,
      };
    } else {
      const { greaseBrand, greaseVersion } = getDeterministicGreaseTriplet(seedNum);
      const brands = engine === 'edge'
        ? [
            { brand: greaseBrand, version: greaseVersion },
            { brand: 'Chromium', version: chromeMajor },
            { brand: 'Microsoft Edge', version: chromeMajor },
          ]
        : [
            { brand: greaseBrand, version: greaseVersion },
            { brand: 'Chromium', version: chromeMajor },
            { brand: 'Google Chrome', version: chromeMajor },
          ];

      clientHints = {
        brands,
        mobile: isMobile,
        platform: isWindows ? 'Windows' : (isMac ? 'macOS' : (isLinux ? 'Linux' : 'Android')),
        platformVersion: isWindows ? '15.0.0' : (isMac ? '14.5.0' : '6.5.0'),
        architecture: isMobile ? 'arm' : (isMacM1 ? 'arm' : 'x86'),
        model: isMobile ? 'Pixel 8' : '',
        bitness: '64',
        fullVersionList: brands.map((b) => ({
          brand: b.brand,
          version: (b.brand === 'Chromium' || b.brand === 'Google Chrome' || b.brand === 'Microsoft Edge')
            ? MANAGED_ENGINE_VERSION
            : `${b.version}.0.0.0`,
        })),
      };
    }
  }

  const rawSettings: ProfileSettings = {
    browser: {
      engine,
      version: engine === 'camoufox' ? '135.0' : MANAGED_ENGINE_VERSION,
      userAgent,
      startupUrl: 'about:blank',
      homepage: 'about:blank',
      additionalArgs: [],
      enableExtensions: engine !== 'camoufox',
      hardwareAcceleration: true,
    },
    fingerprint: {
      canvas: 'noise',
      webgl: 'noise',
      audio: 'noise',
      clientRects: 'noise',
      webrtc: 'disable_non_proxied_udp',
      webglVendor,
      webglRenderer,
      hardwareConcurrency,
      deviceMemory,
      canvasNoise: true,
      audioContextNoise: true,
      maxTouchPoints,
      fonts,
      isM1: isMacM1,
      platform: platformStr,
      architecture,
      os: targetOs,
      clientHints,
    },
    display: {
      screenWidth,
      screenHeight,
      deviceScaleFactor,
      colorDepth,
    },
    locale: {
      language: localeKey,
      timezone: targetTimezone,
      languagesList: targetLanguagesList,
      autoSyncFromIp: true,
    },
    network: {
      directConnection: true,
      webrtc: 'disable_non_proxied_udp',
    },
    permissions: {
      camera: 'prompt',
      microphone: 'prompt',
      geolocation: 'prompt',
      notifications: 'prompt',
      midi: 'prompt',
    },
    mobile: isMobile
      ? {
          enable: true,
          width: screenWidth,
          height: screenHeight,
          deviceScaleFactor,
        }
      : undefined,
  };

  // Always pass through coherence validator to guarantee 100% contradiction-free settings
  const { normalizedSettings } = validateAndNormalizeFingerprintCoherence(rawSettings);
  return normalizedSettings;
}
