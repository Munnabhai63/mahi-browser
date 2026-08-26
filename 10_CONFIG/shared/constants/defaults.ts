import { ProfileSettings, AppSettings } from '../types/index.js';

export const DEFAULT_USER_AGENTS = [
  {
    label: 'Chrome 131 on Windows 11 (64-bit)',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: 'Win32',
    os: 'Windows 11',
  },
  {
    label: 'Chrome 131 on macOS Sequoia',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    os: 'macOS',
  },
  {
    label: 'Edge 131 on Windows 11 (64-bit)',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    platform: 'Win32',
    os: 'Windows 11',
  },
  {
    label: 'Chrome 130 on Linux x86_64',
    value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    os: 'Linux',
  },
];

export const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080, label: '1920 x 1080 (Full HD, 16:9)', scale: 1 },
  { width: 2560, height: 1440, label: '2560 x 1440 (2K QHD, 16:9)', scale: 1 },
  { width: 1440, height: 900, label: '1440 x 900 (MacBook standard, 16:10)', scale: 2 },
  { width: 1536, height: 864, label: '1536 x 864 (Laptop 125%, 16:9)', scale: 1.25 },
  { width: 1366, height: 768, label: '1366 x 768 (Standard Laptop, 16:9)', scale: 1 },
  { width: 3840, height: 2160, label: '3840 x 2160 (4K UHD, 16:9)', scale: 2 },
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
      version: '131.0.0.0',
      userAgent: DEFAULT_USER_AGENTS[0].value,
      startupUrl: 'https://www.google.com',
      homepage: 'https://www.google.com',
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

export function generateConsistentEnvironmentSettings(): ProfileSettings {
  const uaIndex = Math.floor(Math.random() * DEFAULT_USER_AGENTS.length);
  const selectedUA = DEFAULT_USER_AGENTS[uaIndex];

  const resIndex = Math.floor(Math.random() * SCREEN_RESOLUTIONS.length);
  const selectedRes = SCREEN_RESOLUTIONS[resIndex];

  const tzIndex = Math.floor(Math.random() * TIMEZONES.length);
  const selectedTz = TIMEZONES[tzIndex];

  const langIndex = Math.floor(Math.random() * LANGUAGES.length);
  const selectedLang = LANGUAGES[langIndex];

  return {
    browser: {
      engine: 'chrome',
      version: '131.0.0.0',
      userAgent: selectedUA.value,
      startupUrl: 'https://www.google.com',
      homepage: 'https://www.google.com',
      additionalArgs: [],
      enableExtensions: true,
      hardwareAcceleration: true,
    },
    display: {
      screenWidth: selectedRes.width,
      screenHeight: selectedRes.height,
      deviceScaleFactor: selectedRes.scale,
      colorDepth: 24,
    },
    locale: {
      language: selectedLang.value,
      timezone: selectedTz.value,
      languagesList: selectedLang.list,
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
    apiAuthToken: 'mahi_browser_local_api_2024',
  },
};
