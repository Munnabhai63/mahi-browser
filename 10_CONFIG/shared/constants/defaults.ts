import { ProfileSettings, AppSettings, StatisticalProfileOptions } from '../types/index.js';
import { MANAGED_ENGINE_VERSION } from '../../engine-config.js';
import {
  validateAndNormalizeFingerprintCoherence,
  getDeterministicSeed,
} from '../utils/fingerprint-coherence.js';

export type { StatisticalProfileOptions };

const majorVersion = MANAGED_ENGINE_VERSION.split('.')[0] || '138';

export const DEFAULT_USER_AGENTS = [
  {
    label: `Chrome ${majorVersion} on Windows 11 (64-bit)`,
    value: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36`,
    platform: 'Win32',
    os: 'Windows 11',
  },
  {
    label: `Chrome ${majorVersion} on macOS Sequoia`,
    value: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36`,
    platform: 'MacIntel',
    os: 'macOS',
  },
  {
    label: `Edge ${majorVersion} on Windows 11 (64-bit)`,
    value: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36 Edg/${MANAGED_ENGINE_VERSION}`,
    platform: 'Win32',
    os: 'Windows 11',
  },
  {
    label: `Chrome ${majorVersion} on Linux x86_64`,
    value: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Safari/537.36`,
    platform: 'Linux x86_64',
    os: 'Linux',
  },
  {
    label: `Chrome ${majorVersion} on Android 14 (Google Pixel 8)`,
    value: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Mobile Safari/537.36`,
    platform: 'Linux armv8l',
    os: 'Android 14',
  },
  {
    label: `Chrome ${majorVersion} on Android 13 (Samsung Galaxy S23)`,
    value: `Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${MANAGED_ENGINE_VERSION} Mobile Safari/537.36`,
    platform: 'Linux armv8l',
    os: 'Android 13',
  },
  {
    label: 'Firefox 135 on Windows 11 (64-bit / Camoufox)',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    platform: 'Win32',
    os: 'Windows 11',
  },
  {
    label: 'Firefox 135 on macOS Sequoia (Camoufox)',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0',
    platform: 'MacIntel',
    os: 'macOS',
  },
];

export const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080, label: '1920 x 1080 (Full HD, 16:9)', scale: 1 },
  { width: 2560, height: 1440, label: '2560 x 1440 (2K QHD, 16:9)', scale: 1 },
  { width: 1440, height: 900, label: '1440 x 900 (MacBook standard, 16:10)', scale: 2 },
  { width: 1536, height: 864, label: '1536 x 864 (Laptop 125%, 16:9)', scale: 1.25 },
  { width: 1366, height: 768, label: '1366 x 768 (Standard Laptop, 16:9)', scale: 1 },
  { width: 3840, height: 2160, label: '3840 x 2160 (4K UHD, 16:9)', scale: 2 },
  { width: 412, height: 915, label: '412 x 915 (Android / Pixel 8, 20:9)', scale: 2.625 },
  { width: 393, height: 852, label: '393 x 852 (Android / Galaxy S23, 19.5:9)', scale: 3 },
];

export const TIMEZONES = [
  { value: 'America/New_York', label: 'America/New_York (EST/EDT, UTC-5/4)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT, UTC-6/5)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT, UTC-8/7)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+0/1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST, UTC+1/2)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST, UTC+1/2)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT, UTC+10/11)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

export const LANGUAGES = [
  { value: 'en-US', label: 'English (United States)', list: ['en-US', 'en'] },
  { value: 'en-GB', label: 'English (United Kingdom)', list: ['en-GB', 'en'] },
  { value: 'de-DE', label: 'German (Germany)', list: ['de-DE', 'de', 'en'] },
  { value: 'fr-FR', label: 'French (France)', list: ['fr-FR', 'fr', 'en'] },
  { value: 'es-ES', label: 'Spanish (Spain)', list: ['es-ES', 'es', 'en'] },
  { value: 'ja-JP', label: 'Japanese (Japan)', list: ['ja-JP', 'ja', 'en'] },
  { value: 'zh-CN', label: 'Chinese (Simplified)', list: ['zh-CN', 'zh', 'en'] },
  { value: 'pt-BR', label: 'Portuguese (Brazil)', list: ['pt-BR', 'pt', 'en'] },
];

const OS_FONTS: Record<string, string[]> = {
  windows: [
    'Arial', 'Calibri', 'Cambria', 'Consolas', 'Courier New', 'Georgia',
    'Lucida Console', 'MS Gothic', 'MS PGothic', 'MS Sans Serif', 'MS Serif',
    'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  ],
  macos: [
    'American Typewriter', 'Apple Color Emoji', 'Arial', 'Avenir', 'Avenir Next',
    'Courier New', 'Geneva', 'Georgia', 'Helvetica', 'Helvetica Neue', 'Lucida Grande',
    'Menlo', 'Monaco', 'SF Pro', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  ],
  linux: [
    'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans',
    'Liberation Serif', 'Liberation Mono', 'Ubuntu', 'FreeSans', 'FreeSerif',
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

function createSeededRng(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDefaultProfileSettings(_os?: 'windows' | 'mac' | 'linux' | string): ProfileSettings {
  return {
    settingsVersion: 0,
    browser: {
      engine: 'chrome',
      version: MANAGED_ENGINE_VERSION,
      userAgent: DEFAULT_USER_AGENTS[0].value,
      startupUrl: 'about:blank',
      homepage: 'about:blank',
      additionalArgs: [],
      enableExtensions: true,
      hardwareAcceleration: true,
    },
    display: {
      screenWidth: 1920,
      screenHeight: 1080,
      deviceScaleFactor: 1,
      colorDepth: 24,
    },
    locale: {
      language: 'en-US',
      timezone: 'America/New_York',
      languagesList: ['en-US', 'en'],
    },
    network: {
      directConnection: true,
      webrtc: 'default',
    },
    permissions: {
      camera: 'prompt',
      microphone: 'prompt',
      geolocation: 'prompt',
      notifications: 'prompt',
      midi: 'prompt',
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMergeRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
  preserveBaseOnUndefined = true
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    if (overrideVal === undefined) {
      if (!preserveBaseOnUndefined) {
        delete result[key];
      }
      continue;
    }
    const baseVal = result[key];
    if (isPlainObject(baseVal) && isPlainObject(overrideVal)) {
      result[key] = deepMergeRecords(baseVal, overrideVal, preserveBaseOnUndefined);
    } else if (Array.isArray(overrideVal)) {
      result[key] = [...overrideVal];
    } else if (isPlainObject(overrideVal)) {
      result[key] = deepMergeRecords({}, overrideVal, preserveBaseOnUndefined);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

/**
 * Deep-merges partial/stored settings over base defaults without stripping or mutating unknown fields.
 */
export function deepMergeProfileSettings(
  base: ProfileSettings,
  override: unknown,
  options?: { preserveBaseOnUndefined?: boolean }
): ProfileSettings {
  if (!isPlainObject(override)) {
    return deepMergeRecords({}, base as unknown as Record<string, unknown>) as unknown as ProfileSettings;
  }
  return deepMergeRecords(
    base as unknown as Record<string, unknown>,
    override,
    options?.preserveBaseOnUndefined ?? true
  ) as unknown as ProfileSettings;
}

/**
 * Tolerantly parses stored ProfileSettings JSON/object on read without ever writing back to disk.
 * Missing fields fall back to defaults; unknown future fields are preserved untouched.
 */
export function parseStoredProfileSettings(
  settingsJsonOrObj: unknown,
  fallbackOs?: string
): ProfileSettings {
  const defaults = getDefaultProfileSettings(fallbackOs);
  if (settingsJsonOrObj === null || settingsJsonOrObj === undefined || settingsJsonOrObj === '') {
    return defaults;
  }
  if (typeof settingsJsonOrObj === 'string') {
    try {
      const parsed = JSON.parse(settingsJsonOrObj);
      return deepMergeProfileSettings(defaults, parsed);
    } catch {
      return defaults;
    }
  }
  return deepMergeProfileSettings(defaults, settingsJsonOrObj);
}

/**
 * Pure browser-safe statistical environment settings generator.
 * Zero Node.js imports. Guarantees 100% contradiction-free settings for UI rendering.
 */
export function generateConsistentEnvironmentSettings(options: StatisticalProfileOptions = {}): ProfileSettings {
  const seedNum = options.seed !== undefined
    ? (typeof options.seed === 'number' ? Math.abs(options.seed) : getDeterministicSeed(String(options.seed)))
    : Math.floor(Math.random() * 10000000);
  const rng = createSeededRng(seedNum);

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
  const isMacM1 = isMac && (rng() > 0.3);

  const localeKey = options.locale || 'en-US';
  const regionData = REGION_MAP[localeKey] || {
    timezone: options.timezone || 'America/New_York',
    languagesList: [localeKey, 'en'],
  };
  const targetTimezone = options.timezone || regionData.timezone;
  const targetLanguagesList = regionData.languagesList;

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

  let screenWidth = 1920;
  let screenHeight = 1080;
  let deviceScaleFactor = 1;
  let colorDepth = 24;

  if (isMobile) {
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

  let webglVendor = 'Google Inc. (NVIDIA)';
  let webglRenderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

  if (isMobile) {
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
    const winGpus = [
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    ];
    const pickedGpu = winGpus[Math.floor(rng() * winGpus.length)];
    webglVendor = pickedGpu.vendor;
    webglRenderer = pickedGpu.renderer;
  }

  const hardwareConcurrency = isMobile ? 8 : (isMac ? (isMacM1 ? 8 : 4) : ([8, 12, 16] as const)[Math.floor(rng() * 3)]);
  const deviceMemory = isMobile ? 8 : ([4, 8, 16] as const)[Math.floor(rng() * 3)];
  const maxTouchPoints = isMobile ? 5 : 0;
  const platformStr = isMobile ? 'Linux armv8l' : (isMac ? 'MacIntel' : (isLinux ? 'Linux x86_64' : 'Win32'));
  const architecture = isMobile ? 'arm' : (isMacM1 ? 'arm64' : 'x86_64');
  const fonts = [...(OS_FONTS[targetOs] || OS_FONTS.windows)];

  let clientHints: any = undefined;
  if (engine !== 'camoufox') {
    const brands = engine === 'edge'
      ? [
          { brand: 'Not/A)Brand', version: '8' },
          { brand: 'Chromium', version: chromeMajor },
          { brand: 'Microsoft Edge', version: chromeMajor },
        ]
      : [
          { brand: 'Not/A)Brand', version: '8' },
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
      fullVersionList: brands.map((b) => ({ brand: b.brand, version: `${b.version}.0.0.0` })),
    };
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
      webrtc: 'noise',
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
    },
    network: {
      directConnection: true,
      webrtc: 'default',
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

  const { normalizedSettings } = validateAndNormalizeFingerprintCoherence(rawSettings);
  return normalizedSettings;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    language: 'en-US',
    theme: 'light',
    startupBehavior: 'dashboard',
    defaultBrowserEngine: 'chrome',
    defaultDownloadFolder: '',
  },
  privacy: {
    clearDataOnExit: false,
    blockThirdPartyCookiesDefault: false,
    doNotTrack: true,
    webrtcPolicyDefault: 'default',
  },
  security: {
    appLockEnabled: false,
    sessionTimeoutMinutes: 30,
    autoLockOnMinimize: false,
    encryptionAlgorithm: 'AES-256-GCM',
  },
  performance: {
    maxConcurrentProfiles: 10,
    enableHardwareAcceleration: true,
    memorySavingMode: false,
    cacheLimitMb: 1024,
  },
  advanced: {
    debugLogsEnabled: false,
    developerMode: false,
    apiServerEnabled: true,
    apiPort: 32123,
    apiAuthToken: '',
  },
};
