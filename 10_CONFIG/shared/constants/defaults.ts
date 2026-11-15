import { ProfileSettings, AppSettings } from '../types/index.js';
import { MANAGED_ENGINE_VERSION } from '../../engine-config.js';
import { generateStatisticalProfileSettings, StatisticalProfileOptions } from '../../../03_HARDWARE/fingerprint-generator-service.js';

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

export function getDefaultProfileSettings(_os?: 'windows' | 'mac' | 'linux' | string): ProfileSettings {
  return {
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

export function generateConsistentEnvironmentSettings(options?: StatisticalProfileOptions): ProfileSettings {
  return generateStatisticalProfileSettings(options);
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
