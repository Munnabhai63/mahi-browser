export const DEFAULT_SITE_NAME = 'MAHI Browser';
export const DEFAULT_PRODUCTION_WEBSITE_URL = 'https://mahibrowser.com';
export const DEFAULT_PRODUCTION_APP_URL = 'https://app.mahibrowser.com';
export const DEFAULT_PRODUCTION_API_URL = 'https://api.mahibrowser.com';

export const DEFAULT_DEV_WEBSITE_URL = 'http://localhost:3000';
export const DEFAULT_DEV_APP_URL = 'http://localhost:5173';
export const DEFAULT_DEV_API_URL = 'http://localhost:8989';
export const DEFAULT_SITE_SUPPORT_EMAIL = 'mahiverse.official@gmail.com';

export interface SiteConfig {
  readonly name: string;
  readonly websiteUrl: string;
  readonly url: string;
  readonly appUrl: string;
  readonly apiUrl: string;
  readonly supportEmail: string;
}

export interface ResolveSiteConfigOptions {
  /**
   * Desktop/Electron client helpers and static build-time artifacts fall back to
   * canonical production hosts unless an explicit env override is set or explicit
   * local development (`NODE_ENV=development`) is active.
   */
  productionFallback?: boolean;
}

function readNodeEnv(key: string): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
      return String(process.env[key]).trim();
    }
  } catch {
    // Browser runtimes without process polyfill
  }
  return '';
}

function getViteEnv(): Record<string, unknown> | undefined {
  try {
    if (typeof import.meta !== 'undefined') {
      return (import.meta as unknown as { env?: Record<string, unknown> }).env;
    }
  } catch {
    // Non-ESM environments
  }
  return undefined;
}

function readPublicNameEnv(): string {
  const viteEnv = getViteEnv();
  const nextPublic =
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SITE_NAME : undefined) ||
    readNodeEnv('NEXT_PUBLIC_SITE_NAME');
  const viteVal = typeof viteEnv?.VITE_SITE_NAME === 'string' ? viteEnv.VITE_SITE_NAME : '';
  return (nextPublic || viteVal || readNodeEnv('SITE_NAME') || '').trim();
}

function readWebsiteOverride(): string {
  const viteEnv = getViteEnv();
  const nextPublic =
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_WEBSITE_URL : undefined) ||
    readNodeEnv('NEXT_PUBLIC_WEBSITE_URL');
  const viteVal = typeof viteEnv?.VITE_WEBSITE_URL === 'string' ? viteEnv.VITE_WEBSITE_URL : '';
  return (
    readNodeEnv('MAHI_WEBSITE_URL') ||
    readNodeEnv('WEBSITE_URL') ||
    nextPublic ||
    viteVal
  ).trim();
}

function readAppOverride(): string {
  const viteEnv = getViteEnv();
  const nextPublic =
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_APP_URL : undefined) ||
    readNodeEnv('NEXT_PUBLIC_APP_URL');
  const viteVal = typeof viteEnv?.VITE_APP_URL === 'string' ? viteEnv.VITE_APP_URL : '';
  return (readNodeEnv('APP_URL') || readNodeEnv('MAHI_APP_URL') || nextPublic || viteVal).trim();
}

function readApiOverride(): string {
  const viteEnv = getViteEnv();
  const nextPublic =
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined) ||
    readNodeEnv('NEXT_PUBLIC_API_URL');
  const viteCommercial =
    typeof viteEnv?.VITE_COMMERCIAL_API_URL === 'string' ? viteEnv.VITE_COMMERCIAL_API_URL : '';
  const viteMahi = typeof viteEnv?.VITE_MAHI_API_URL === 'string' ? viteEnv.VITE_MAHI_API_URL : '';
  const viteAdmin = typeof viteEnv?.VITE_MAHI_ADMIN_URL === 'string' ? viteEnv.VITE_MAHI_ADMIN_URL : '';
  return (
    readNodeEnv('API_URL') ||
    readNodeEnv('MAHI_API_URL') ||
    readNodeEnv('MAHI_ADMIN_URL') ||
    readNodeEnv('COMMERCIAL_API_URL') ||
    nextPublic ||
    viteCommercial ||
    viteMahi ||
    viteAdmin
  ).trim();
}

function readSupportEmailOverride(): string {
  const viteEnv = getViteEnv();
  const nextPublic =
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPPORT_EMAIL : undefined) ||
    readNodeEnv('NEXT_PUBLIC_SUPPORT_EMAIL');
  const viteVal = typeof viteEnv?.VITE_SUPPORT_EMAIL === 'string' ? viteEnv.VITE_SUPPORT_EMAIL : '';
  return (nextPublic || viteVal || readNodeEnv('SUPPORT_EMAIL') || '').trim();
}

function isPackagedDesktopProcess(): boolean {
  if (typeof process === 'undefined') return false;
  const hasElectron = Boolean((process.versions as Record<string, string | undefined> | undefined)?.electron);
  return hasElectron && readNodeEnv('MAHI_CLOUD_GATEWAY') !== '1';
}

function shouldUseLocalDevDefaults(options?: ResolveSiteConfigOptions): boolean {
  if (options?.productionFallback) {
    return false;
  }
  if (isPackagedDesktopProcess()) {
    return false;
  }
  if (
    typeof window !== 'undefined' &&
    window.location?.hostname &&
    (window.location.hostname === 'mahibrowser.com' || window.location.hostname.endsWith('.mahibrowser.com'))
  ) {
    return false;
  }
  const viteEnv = getViteEnv();
  const nodeEnv =
    (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined) ||
    readNodeEnv('NODE_ENV') ||
    (viteEnv?.DEV ? 'development' : '');
  return String(nodeEnv).trim().toLowerCase() === 'development';
}

export function cleanUrl(raw: string | undefined, fallback: string): string {
  const candidate = raw?.trim();
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString().replace(/\/+$/, '');
    }
  } catch {
    // Fall back safely when malformed.
  }
  return fallback;
}

export function getSiteConfig(options?: ResolveSiteConfigOptions): SiteConfig {
  const useLocalDev = shouldUseLocalDevDefaults(options);

  const name = readPublicNameEnv() || DEFAULT_SITE_NAME;
  const resolvedWebsite = cleanUrl(
    readWebsiteOverride(),
    useLocalDev ? DEFAULT_DEV_WEBSITE_URL : DEFAULT_PRODUCTION_WEBSITE_URL
  );
  const resolvedApp = cleanUrl(
    readAppOverride(),
    useLocalDev ? DEFAULT_DEV_APP_URL : DEFAULT_PRODUCTION_APP_URL
  );
  const resolvedApi = cleanUrl(
    readApiOverride(),
    useLocalDev ? DEFAULT_DEV_API_URL : DEFAULT_PRODUCTION_API_URL
  );
  const supportEmail = readSupportEmailOverride() || DEFAULT_SITE_SUPPORT_EMAIL;

  return {
    name,
    websiteUrl: resolvedWebsite,
    url: resolvedWebsite,
    appUrl: resolvedApp,
    apiUrl: resolvedApi,
    supportEmail,
  };
}

/**
 * Dynamic singleton mirroring `digihubselllatest` `siteConfig` while reading live
 * environment overrides cleanly at property access time.
 */
export const siteConfig: SiteConfig = {
  get name(): string {
    return getSiteConfig().name;
  },
  get websiteUrl(): string {
    return getSiteConfig().websiteUrl;
  },
  get url(): string {
    return getSiteConfig().url;
  },
  get appUrl(): string {
    return getSiteConfig().appUrl;
  },
  get apiUrl(): string {
    return getSiteConfig().apiUrl;
  },
  get supportEmail(): string {
    return getSiteConfig().supportEmail;
  },
};

function joinBaseAndPath(base: string, targetPath = '/'): string {
  const normalized = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  if (normalized === '/') return base;
  return `${base}${normalized}`;
}

export function websiteUrl(path = '/', options?: ResolveSiteConfigOptions): string {
  return joinBaseAndPath(getSiteConfig(options).websiteUrl, path);
}

export const siteUrl = websiteUrl;

export function appUrl(path = '/', options?: ResolveSiteConfigOptions): string {
  return joinBaseAndPath(getSiteConfig(options).appUrl, path);
}

export function apiUrl(path = '/', options?: ResolveSiteConfigOptions): string {
  return joinBaseAndPath(getSiteConfig(options).apiUrl, path);
}

export function getDefaultUpdateFeedUrl(): string {
  const override = readNodeEnv('MAHI_UPDATE_FEED_URL') || readNodeEnv('UPDATE_FEED_URL');
  if (override) {
    const cleaned = cleanUrl(override, '');
    if (cleaned) {
      return `${cleaned}/`;
    }
  }
  return `${websiteUrl('/update', { productionFallback: true })}/`;
}

export function getContentJsonUrl(): string {
  const override = readNodeEnv('MAHI_CONTENT_JSON_URL') || readNodeEnv('CONTENT_JSON_URL');
  if (override) {
    const cleaned = cleanUrl(override, '');
    if (cleaned) return cleaned;
  }
  return websiteUrl('/content.json', { productionFallback: true });
}

export function getTrustedSiteOrigins(options?: ResolveSiteConfigOptions): string[] {
  const cfg = getSiteConfig(options);
  const origins = new Set<string>([
    DEFAULT_PRODUCTION_WEBSITE_URL,
    'https://www.mahibrowser.com',
    DEFAULT_PRODUCTION_APP_URL,
  ]);

  for (const candidate of [cfg.websiteUrl, cfg.appUrl]) {
    try {
      const parsed = new URL(candidate);
      origins.add(parsed.origin.toLowerCase());
      if (parsed.hostname.startsWith('www.')) {
        origins.add(`${parsed.protocol}//${parsed.hostname.slice(4)}${parsed.port ? `:${parsed.port}` : ''}`.toLowerCase());
      } else if (!parsed.hostname.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
        origins.add(`${parsed.protocol}//www.${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`.toLowerCase());
      }
    } catch {
      // Ignore malformed candidate
    }
  }

  return Array.from(origins);
}

/**
 * Serializes JSON-LD safely for HTML <script type="application/ld+json"> tags,
 * escaping "<" and Unicode line separators so embedded strings cannot break out of the script tag.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
