export interface GeneralSettings {
  language: string;
  theme: 'light' | 'dark' | 'system';
  startupBehavior: 'dashboard' | 'last_profiles' | 'none';
  defaultBrowserEngine: 'chromium' | 'chrome' | 'edge' | 'camoufox';
  defaultDownloadFolder: string;
}

export interface PrivacySettings {
  clearDataOnExit: boolean;
  blockThirdPartyCookiesDefault: boolean;
  doNotTrack: boolean;
  webrtcPolicyDefault: 'default' | 'disabled' | 'proxy_only';
}

export interface SecuritySettings {
  appLockEnabled: boolean;
  appLockPinHash?: string;
  sessionTimeoutMinutes: number;
  autoLockOnMinimize: boolean;
  encryptionAlgorithm: 'AES-256-GCM';
  allowCdpDebugPort?: boolean;
}

export interface PerformanceSettings {
  maxConcurrentProfiles: number;
  enableHardwareAcceleration: boolean;
  memorySavingMode: boolean;
  cacheLimitMb: number;
}

export interface AdvancedSettings {
  debugLogsEnabled: boolean;
  developerMode: boolean;
  apiServerEnabled: boolean;
  apiPort: number;
  apiAuthToken: string;
}

export interface UpdateSettings {
  autoCheck: boolean;
  autoDownload: boolean;
  channel: 'STABLE' | 'BETA';
  notifyBeforeRestart: boolean;
  feedUrl?: string;
}

export interface AppSettings {
  general: GeneralSettings;
  privacy: PrivacySettings;
  security: SecuritySettings;
  performance: PerformanceSettings;
  advanced: AdvancedSettings;
  updates?: UpdateSettings;
}

