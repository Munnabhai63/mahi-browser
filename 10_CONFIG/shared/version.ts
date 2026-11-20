import pkg from '../../package.json' with { type: 'json' };

declare const __APP_VERSION__: string | undefined;

/**
 * Authoritative single source of truth for the application version.
 * Dynamic across frontend (__APP_VERSION__ define), backend (pkg.version / app.getVersion()),
 * and tests.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : (pkg && pkg.version ? pkg.version : '0.0.0-dev');

export function getAppVersion(): string {
  return APP_VERSION;
}
