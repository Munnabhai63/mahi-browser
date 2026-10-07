/**
 * Pinned Browser Engine Configuration
 * 
 * Single source of truth for MAHI BROWSER's version-pinned browser engine.
 * Pinned to Google Chrome for Testing (CfT) for reproducible anti-detect fingerprinting.
 * 
 * IMPORTANT: NEVER auto-update this value. It changes ONLY when manually edited.
 */

export const MANAGED_ENGINE_VERSION = '138.0.7204.183';

/**
 * Expected SHA-256 integrity checksum for the official Google win64 zip.
 */
export const MANAGED_ENGINE_SHA256 = '10a9fa695a9e4c05b336aebdc553f92c2351b2e9b962b00dc00612c8dcaacd68';

/**
 * Official Google Cloud CDN download URL for Chrome for Testing public release.
 * NEVER hosted on private servers — downloads directly from Google infrastructure.
 */
export const MANAGED_ENGINE_DOWNLOAD_URL = `https://storage.googleapis.com/chrome-for-testing-public/${MANAGED_ENGINE_VERSION}/win64/chrome-win64.zip`;

/**
 * Authoritative VPS Engine Mirror URL.
 * Used as fallback if official Google CDN is blocked, unavailable, or version removed.
 */
export const MANAGED_ENGINE_FALLBACK_URL = 'https://mahibrowser.com/engine/chrome-138.zip';

/**
 * Official Google Chrome for Testing Manifest listing all known-good versions & downloads.
 */
export const GOOGLE_CFT_MANIFEST_URL = 'https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json';

/**
 * Minimum free disk space required before attempting download & extraction (1 GB).
 */
export const MANAGED_ENGINE_REQUIRED_DISK_SPACE_BYTES = 1024 * 1024 * 1024; // 1 GB
