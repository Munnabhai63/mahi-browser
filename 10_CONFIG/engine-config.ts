/**
 * Pinned Browser Engine Configuration
 * 
 * Single source of truth for MAHI BROWSER's version-pinned browser engine.
 * Pinned to Google Chrome for Testing (CfT) for reproducible anti-detect fingerprinting.
 * Supports Windows x64, macOS Apple Silicon (arm64), macOS Intel (x64), and Linux x64.
 * 
 * IMPORTANT: NEVER auto-update this value. It changes ONLY when manually edited.
 */

export const MANAGED_ENGINE_VERSION = '138.0.7204.183';

/**
 * Engine Distribution & Launch Identity Policy:
 * - 'CHROMIUM_PRODUCTION': Branded-neutral, clean Chromium distribution suitable for production browsing without testing banners.
 * - 'MANAGED_CFT': Google Chrome for Testing baseline engine for automated tasks, RPA workflows, and regression benchmarking.
 */
export type EngineDistributionPolicy = 'CHROMIUM_PRODUCTION' | 'MANAGED_CFT';
export const CURRENT_ENGINE_DISTRIBUTION: EngineDistributionPolicy = 'CHROMIUM_PRODUCTION';

/**
 * Official Production Unbranded Chromium Distribution (P0 Batch 1)
 * Official Google Chromium snapshot build at milestone 138 commit position 1465706.
 * Zero "Chrome for Testing" testing banner, identical CDP and fingerprint architecture.
 */
export const CHROMIUM_PRODUCTION_CONFIG = {
  distribution: 'CHROMIUM_PRODUCTION' as const,
  version: '138.0.7204.0',
  commitPosition: 1465706,
  platform: 'win32' as const,
  arch: 'x64' as const,
  platformKey: 'win64' as const,
  downloadUrl: 'https://commondatastorage.googleapis.com/chromium-browser-snapshots/Win_x64/1465706/chrome-win.zip',
  fallbackUrl: 'https://mahibrowser.com/engine/chromium-138-win64.zip',
  sha256: '26237e603d68f909f2ba62162a30c51fa1ba94683ca61358e5489b0a08461bc2',
  fileSizeBytes: 296108021,
  archiveSubdir: 'chrome-win',
  executableRelativePath: 'chrome.exe',
};

export const CHROMIUM_PRODUCTION_VERSION = CHROMIUM_PRODUCTION_CONFIG.version;
export const CHROMIUM_PRODUCTION_SHA256 = CHROMIUM_PRODUCTION_CONFIG.sha256;
export const CHROMIUM_PRODUCTION_DOWNLOAD_URL = CHROMIUM_PRODUCTION_CONFIG.downloadUrl;

/**
 * Expected SHA-256 integrity checksum for the official Google win64 CfT zip.
 */
export const MANAGED_ENGINE_SHA256 = '10a9fa695a9e4c05b336aebdc553f92c2351b2e9b962b00dc00612c8dcaacd68';

/**
 * Official Google Cloud CDN download URL for Chrome for Testing public release (Windows baseline).
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

export type SupportedPlatformKey = 'win64' | 'mac-arm64' | 'mac-x64' | 'linux64';

export interface ManagedEnginePlatformConfig {
  platform: 'win32' | 'darwin' | 'linux';
  arch: 'x64' | 'arm64';
  platformKey: SupportedPlatformKey;
  downloadUrl: string;
  fallbackUrl: string;
  sha256?: string;
  archiveSubdir: string;
  executableRelativePath: string;
}

export const MANAGED_ENGINE_PLATFORMS: Record<SupportedPlatformKey, ManagedEnginePlatformConfig> = {
  win64: {
    platform: 'win32',
    arch: 'x64',
    platformKey: 'win64',
    downloadUrl: `https://storage.googleapis.com/chrome-for-testing-public/${MANAGED_ENGINE_VERSION}/win64/chrome-win64.zip`,
    fallbackUrl: 'https://mahibrowser.com/engine/chrome-138-win64.zip',
    sha256: '10a9fa695a9e4c05b336aebdc553f92c2351b2e9b962b00dc00612c8dcaacd68',
    archiveSubdir: 'chrome-win64',
    executableRelativePath: 'chrome.exe',
  },
  'mac-arm64': {
    platform: 'darwin',
    arch: 'arm64',
    platformKey: 'mac-arm64',
    downloadUrl: `https://storage.googleapis.com/chrome-for-testing-public/${MANAGED_ENGINE_VERSION}/mac-arm64/chrome-mac-arm64.zip`,
    fallbackUrl: 'https://mahibrowser.com/engine/chrome-138-mac-arm64.zip',
    archiveSubdir: 'chrome-mac-arm64',
    executableRelativePath: 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  },
  'mac-x64': {
    platform: 'darwin',
    arch: 'x64',
    platformKey: 'mac-x64',
    downloadUrl: `https://storage.googleapis.com/chrome-for-testing-public/${MANAGED_ENGINE_VERSION}/mac-x64/chrome-mac-x64.zip`,
    fallbackUrl: 'https://mahibrowser.com/engine/chrome-138-mac-x64.zip',
    archiveSubdir: 'chrome-mac-x64',
    executableRelativePath: 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  },
  linux64: {
    platform: 'linux',
    arch: 'x64',
    platformKey: 'linux64',
    downloadUrl: `https://storage.googleapis.com/chrome-for-testing-public/${MANAGED_ENGINE_VERSION}/linux64/chrome-linux64.zip`,
    fallbackUrl: 'https://mahibrowser.com/engine/chrome-138-linux64.zip',
    archiveSubdir: 'chrome-linux64',
    executableRelativePath: 'chrome',
  },
};

export function resolveEnginePlatformKey(
  platform: string = process.platform,
  arch: string = process.arch
): SupportedPlatformKey {
  if (platform === 'win32') return 'win64';
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  return 'linux64';
}

export function getPlatformEngineConfig(
  platform: string = process.platform,
  arch: string = process.arch
): ManagedEnginePlatformConfig {
  const key = resolveEnginePlatformKey(platform, arch);
  return MANAGED_ENGINE_PLATFORMS[key];
}
