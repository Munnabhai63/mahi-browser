export type ProfileStatus = 'READY' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'ERROR';

export type BrowserEngine = 'chromium' | 'chrome' | 'edge' | 'camoufox';

export interface StatisticalProfileOptions {
  os?: 'windows' | 'macos' | 'linux' | 'android';
  engine?: 'chromium' | 'chrome' | 'edge' | 'camoufox';
  locale?: string;
  timezone?: string;
  seed?: string | number;
  deviceCategory?: 'desktop' | 'mobile';
}

export type WebRTCMode =
  | 'default'
  | 'disabled'
  | 'public_interface_only'
  | 'proxy_only'
  | 'disable_non_proxied_udp'
  | 'allow_all'
  | 'noise';

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
  restoreSessionOnStartup?: boolean;
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
  autoSyncFromIp?: boolean;
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
  maxTouchPoints?: number;
  fonts?: string[];
  isM1?: boolean;
  platform?: string;
  architecture?: string;
  os?: 'windows' | 'macos' | 'linux' | 'android' | string;
  clientHints?: {
    brands?: Array<{ brand: string; version: string }>;
    mobile?: boolean;
    platform?: string;
    platformVersion?: string;
    architecture?: string;
    model?: string;
    bitness?: string;
    fullVersionList?: Array<{ brand: string; version: string }>;
  };
}

export interface ProfileSettings {
  settingsVersion?: number;
  browser: BrowserConfig;
  fingerprint?: FingerprintConfig;
  display: DisplayConfig;
  locale: LocaleConfig;
  network: NetworkConfig;
  permissions: PermissionsConfig;
  fakeVideoCapture?: {
    enable?: boolean;
    filePath?: string;
  };
  mobile?: {
    enable?: boolean;
    width?: number;
    height?: number;
    deviceScaleFactor?: number;
  };
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
  customExecutablePath?: string;
  settings: ProfileSettings;
  pinned: boolean;
  lastError?: string;
  activePid?: number;
  deletedAt?: string | null;
  /** Owner of the profile for multi-user isolation */
  ownerId?: string;
  /** Persistent historical session statistics — never reset on stop/close, only on explicit delete */
  stats?: ProfileStats;
}


export type PartialProfileSettings = {
  [K in keyof ProfileSettings]?: ProfileSettings[K] extends object
    ? Partial<ProfileSettings[K]>
    : ProfileSettings[K];
};

export interface CreateProfileDTO {
  name: string;
  description?: string;
  folder?: string;
  tags?: string[];
  notes?: string;
  pinned?: boolean;
  ownerId?: string;
  settings?: PartialProfileSettings;
}

export interface UpdateProfileDTO {
  name?: string;
  description?: string;
  folder?: string;
  tags?: string[];
  notes?: string;
  pinned?: boolean;
  settings?: PartialProfileSettings;
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
  /** Security: if provided, only return profiles belonging to this commercial user ID */
  ownerId?: string;
}

export type StarterProfileCategory = 'PERSONAL' | 'SOCIAL' | 'E-COMMERCE' | 'WORK' | 'AUTOMATION' | 'SANDBOX';

export interface StarterProfileTemplateSummary {
  id: string;
  name: string;
  category: StarterProfileCategory;
  badge: 'STARTER' | 'DEMO' | 'TEMPLATE' | 'EXAMPLE';
  description: string;
  folder?: string;
  icon?: string;
  color?: string;
  features?: string[];
  recommendedUse?: string;
  os?: string;
  browser?: string;
  fingerprintPreview?: {
    screenResolution?: string;
    userAgentSnippet?: string;
    webGlVendor?: string;
    canvasNoise?: boolean;
    audioNoise?: boolean;
  };
  defaultSettings?: Partial<ProfileSettings>;
}

export interface CreateProfileFromStarterOptions {
  name?: string;
  customName?: string;
  folder?: string;
  ownerId?: string;
}

export interface ParsedAccountProxyInfo {
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ParsedAccountImportItem {
  name: string;
  usernameOrEmail?: string;
  password?: string;
  proxy?: ParsedAccountProxyInfo;
  cookies?: Array<{
    id: string;
    profileId: string;
    domain: string;
    name: string;
    value: string;
    path: string;
    expires?: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  userAgent?: string;
  timezone?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  sourceFormat?: 'gologin' | 'adspower' | 'dolphin' | 'generic';
  notes?: string;
  tags?: string[];
  rawLine?: string;
}

export interface AccountBulkImportOptions {
  folder?: string;
  os?: 'windows' | 'macos' | 'linux';
  browserEngine?: BrowserEngine;
  tags?: string[];
  autoGenerateFingerprints?: boolean;
}

export interface AccountBulkImportResult {
  success: boolean;
  totalImported: number;
  failedCount: number;
  createdProfileIds: string[];
  createdProfiles: Array<{ id: string; name: string; proxyBound: boolean; cookiesCount: number }>;
  errors: string[];
  durationMs: number;
}
