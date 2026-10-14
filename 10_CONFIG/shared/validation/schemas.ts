import { z } from 'zod';

export const BrowserConfigSchema = z.object({
  engine: z.enum(['chromium', 'chrome', 'edge']),
  version: z.string().default('131.0.0.0'),
  customExecutablePath: z.string().optional(),
  userAgent: z.string().min(5),
  startupUrl: z.string().url().or(z.string().min(1)),
  homepage: z.string().url().or(z.string().min(1)),
  additionalArgs: z.array(z.string()).default([]),
  enableExtensions: z.boolean().default(true),
  hardwareAcceleration: z.boolean().default(true),
});

export const DisplayConfigSchema = z.object({
  screenWidth: z.number().int().min(320).max(7680).default(1920),
  screenHeight: z.number().int().min(240).max(4320).default(1080),
  deviceScaleFactor: z.number().min(0.5).max(4).default(1),
  colorDepth: z.number().int().default(24),
});

export const LocaleConfigSchema = z.object({
  language: z.string().min(2).default('en-US'),
  timezone: z.string().min(2).default('America/New_York'),
  languagesList: z.array(z.string()).default(['en-US', 'en']),
});

export const NetworkConfigSchema = z.object({
  proxyId: z.string().optional(),
  directConnection: z.boolean().default(true),
  webrtc: z.enum(['default', 'disabled', 'public_interface_only', 'proxy_only']).default('default'),
  dnsServer: z.string().optional(),
});

export const PermissionsConfigSchema = z.object({
  camera: z.enum(['prompt', 'allow', 'block']).default('prompt'),
  microphone: z.enum(['prompt', 'allow', 'block']).default('prompt'),
  geolocation: z.enum(['prompt', 'allow', 'block']).default('prompt'),
  notifications: z.enum(['prompt', 'allow', 'block']).default('prompt'),
  midi: z.enum(['prompt', 'allow', 'block']).default('prompt'),
});

export const ProfileSettingsSchema = z.object({
  browser: BrowserConfigSchema,
  display: DisplayConfigSchema,
  locale: LocaleConfigSchema,
  network: NetworkConfigSchema,
  permissions: PermissionsConfigSchema,
});

export const CreateProfileDTOSchema = z.object({
  name: z.string().min(1, 'Profile name is required').max(100),
  description: z.string().max(500).optional().default(''),
  folder: z.string().max(50).optional().default('General'),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(5000).optional().default(''),
  ownerId: z.string().optional(),
  settings: ProfileSettingsSchema.partial().optional(),
});

export const UpdateProfileDTOSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  folder: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional(),
  pinned: z.boolean().optional(),
  settings: ProfileSettingsSchema.partial().optional(),
});

export const CloneProfileDTOSchema = z.object({
  sourceProfileId: z.string().min(1),
  newName: z.string().min(1).max(100),
  copyCookies: z.boolean().default(true),
  copyHistory: z.boolean().default(false),
  copyExtensions: z.boolean().default(true),
  copyBrowserSettings: z.boolean().default(true),
});

export const CreateProxyDTOSchema = z.object({
  name: z.string().min(1, 'Proxy name is required').max(100),
  protocol: z.enum(['http', 'https', 'socks4', 'socks5']),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  countryRegion: z.string().optional(),
  countryName: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  timezone: z.string().optional(),
  isp: z.string().optional(),
  asn: z.string().optional(),
  ip: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateProxyDTOSchema = CreateProxyDTOSchema.partial();

export const AutomationStepSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  type: z.enum([
    'OPEN_URL',
    'SEARCH',
    'CLICK',
    'FILL',
    'KEYPRESS',
    'SCROLL',
    'WAIT',
    'RANDOM_SLEEP',
    'SOLVE_CAPTCHA',
    'EVALUATE_JS',
    'SCREENSHOT',
    'EXTRACT_TITLE',
    'EXTRACT_TEXT',
    'NAVIGATE',
    'EMAIL',
    'VPN',
    'CUSTOM_ACTION',
    'CLOSE_BROWSER',
  ]),

  label: z.string().optional(),
  target: z.string().optional(),
  value: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  continueOnError: z.boolean().optional().default(false),
});

export const AutomationWorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional().default(''),
  steps: z.array(AutomationStepSchema).min(1, 'At least one step is required'),
  defaultProfileId: z.string().optional(),
});
