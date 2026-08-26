export type ProfileStatus = 'READY' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'ERROR';

export type BrowserEngine = 'chromium' | 'chrome' | 'edge';

export type WebRTCMode = 'default' | 'disabled' | 'public_interface_only' | 'proxy_only';

export interface BrowserConfig {
  engine: BrowserEngine;
  version: string;
  customExecutablePath?: string;
  userAgent: string;
  startupUrl: string;
  homepage: string;
  additionalArgs: string[];
  enableExtensions: boolean;
  hardwareAcceleration: boolean;
}

export interface DisplayConfig {
  screenWidth: number;
  screenHeight: number;
  deviceScaleFactor: number;
  colorDepth: number;
}

export interface LocaleConfig {
  language: string;
  timezone: string;
  languagesList: string[];
}

export interface NetworkConfig {
  proxyId?: string; // Reference to saved proxy
  directConnection: boolean;
  webrtc: WebRTCMode;
  dnsServer?: string;
}

export interface PermissionsConfig {
  camera: 'prompt' | 'allow' | 'block';
  microphone: 'prompt' | 'allow' | 'block';
  geolocation: 'prompt' | 'allow' | 'block';
  notifications: 'prompt' | 'allow' | 'block';
  midi: 'prompt' | 'allow' | 'block';
}

export interface FingerprintConfig {
  canvas?: 'real' | 'noise' | 'off' | string;
  webgl?: 'real' | 'noise' | 'off' | string;
  audio?: 'real' | 'noise' | 'off' | string;
  clientRects?: 'real' | 'noise' | 'off' | string;
  webrtc?: string;
  webglVendor?: string;
  webglRenderer?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  canvasNoise?: boolean;
  audioContextNoise?: boolean;
}

export interface ProfileSettings {
  browser: BrowserConfig;
  fingerprint?: FingerprintConfig;
  display: DisplayConfig;
  locale: LocaleConfig;
  network: NetworkConfig;
  permissions: PermissionsConfig;
}

export interface ProfileStats {
  totalSessions: number;
  totalUptimeSeconds: number;
  lastSessionStartedAt: string | null;
  lastSessionStoppedAt: string | null;
}

export interface Profile {
  id: string;
  name: string;
  description: string;
  folder: string;
  tags: string[];
  notes: string;
  status: ProfileStatus;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  storagePath: string;
  settings: ProfileSettings;
  pinned: boolean;
  lastError?: string;
  activePid?: number;
  deletedAt?: string | null;
  /** Persistent historical session statistics — never reset on stop/close, only on explicit delete */
  stats?: ProfileStats;
}


export interface CreateProfileDTO {
  name: string;
  description?: string;
  folder?: string;
  tags?: string[];
  notes?: string;
  pinned?: boolean;
  settings?: Partial<ProfileSettings>;
}

export interface UpdateProfileDTO {
  name?: string;
  description?: string;
  folder?: string;
  tags?: string[];
  notes?: string;
  pinned?: boolean;
  settings?: Partial<ProfileSettings>;
}

export interface CloneProfileDTO {
  sourceProfileId: string;
  newName: string;
  copyCookies: boolean;
  copyHistory: boolean;
  copyExtensions?: boolean;
  copyBrowserSettings: boolean;
}

export interface ProfileFilterOptions {
  searchQuery?: string;
  folder?: string;
  tag?: string;
  status?: ProfileStatus | 'ALL';
  pinnedOnly?: boolean;
  includeTrash?: boolean;
  sortBy?: 'name' | 'createdAt' | 'lastUsedAt' | 'status';
  sortDirection?: 'asc' | 'desc';
}
