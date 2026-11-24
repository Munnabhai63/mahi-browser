/**
 * Environment-safe network endpoint & port resolver for MAHI Browser.
 * Usable across Node.js (Electron Main, Fastify Gateway, Scripts) and Browser (React/Vite Renderer).
 */

export const DEFAULT_LOCAL_DAEMON_PORT = 32123;
export const DEFAULT_CLOUD_GATEWAY_PORT = 8989;
export const PRODUCTION_COMMERCIAL_API_URL = 'https://api.mahibrowser.com';

/**
 * Universal environment variable accessor that never throws in browser or Node runtimes.
 */
export function getEnv(key: string, fallback = ''): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
      return String(process.env[key]);
    }
  } catch {}

  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key] !== undefined) {
      return String((import.meta as any).env[key]);
    }
  } catch {}

  return fallback;
}

/**
 * Returns the base URL for the local loopback daemon (Port 32123 by default).
 */
export function getLocalDaemonBaseUrl(port?: number): string {
  const resolvedPort = port || DEFAULT_LOCAL_DAEMON_PORT;
  return `http://127.0.0.1:${resolvedPort}`;
}

/**
 * Returns the active Commercial Cloud Gateway API base URL.
 * Respects VITE_COMMERCIAL_API_URL, COMMERCIAL_API_URL, browser domain, and NODE_ENV.
 */
export function getCloudGatewayUrl(): string {
  const envUrl = getEnv('VITE_COMMERCIAL_API_URL') || getEnv('COMMERCIAL_API_URL');
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  const isBrowserCloudDomain =
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.hostname === 'string' &&
    (window.location.hostname === 'app.mahibrowser.com' ||
      (window.location.hostname.endsWith('.mahibrowser.com') &&
        window.location.hostname !== 'api.mahibrowser.com'));

  const isProd =
    isBrowserCloudDomain ||
    getEnv('NODE_ENV') === 'production' ||
    (typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.PROD));

  if (isProd) {
    return PRODUCTION_COMMERCIAL_API_URL;
  }

  return `http://localhost:${DEFAULT_CLOUD_GATEWAY_PORT}`;
}
