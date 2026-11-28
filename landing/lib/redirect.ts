import { getSiteConfig, getTrustedSiteOrigins } from './site-config';

const SAFE_REDIRECT_PREFIXES = [
  '/pricing',
  '/download',
  '/dashboard',
  '/overview',
  '/account',
  '/checkout',
  '/book-demo',
];

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Validates and normalizes post-auth redirect destinations to prevent open-redirect attacks.
 * Returns a safe relative path (plus query/hash) or trusted MAHI HTTPS URL, or null if unsafe.
 */
export function sanitizeSafeRedirect(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('\\') || trimmed.includes('..') || hasControlCharacter(trimmed)) {
    return null;
  }

  const trustedOrigins = getTrustedSiteOrigins({ productionFallback: true });
  const baseWebsiteOriginUrl = getSiteConfig({ productionFallback: true }).websiteUrl;

  if (trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:') return null;
      if (!trustedOrigins.includes(parsed.origin.toLowerCase())) return null;
      const p = parsed.pathname.toLowerCase();
      if (p === '/') return parsed.toString();
      const allowed = SAFE_REDIRECT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
      return allowed ? parsed.toString() : null;
    } catch {
      return null;
    }
  }

  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('//')) {
    return null;
  }

  try {
    const baseWebsite = new URL(baseWebsiteOriginUrl);
    const parsed = new URL(trimmed, baseWebsite);
    if (parsed.origin !== baseWebsite.origin) return null;
    const p = parsed.pathname.toLowerCase();
    if (p === '/') return '/';
    const allowed = SAFE_REDIRECT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
    return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}
