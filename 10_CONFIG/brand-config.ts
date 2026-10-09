/**
 * MAHI Browser - Authoritative Central Brand Configuration
 * Strict centralized brand asset system locking the 4 approved final logo assets.
 */

// Authoritative Master Asset Identifiers & Paths
export const PRIMARY_LOGO = '/brand/mahi-browser-logo-primary.png'; // ASSET A (Full Logo with wordmark)
export const RED_MARK = '/brand/mahi-browser-mark-red.png';         // ASSET B (Red Dragon Mark)
export const DARK_MARK = '/brand/mahi-browser-mark-dark.png';       // ASSET C (Black + Red Dragon Mark)
export const APP_ICON = '/brand/mahi-browser-app-icon.png';         // ASSET D (Red Squircle White Dragon App Icon)

export const BRAND_CONFIG = {
  productName: 'MAHI Browser',
  brandName: 'MAHI Browser',
  shortName: 'MAHI',
  tagline: 'Enterprise Anti-Detect & Multi-Session Automation Hub',
  company: 'MAHI Browser Team',
  website: 'https://mahibrowser.com',
  consoleUrl: 'https://app.mahibrowser.com',

  // Authoritative Approved Assets
  assets: {
    // 4 Master Roles
    primaryLogo: PRIMARY_LOGO,
    redMark: RED_MARK,
    darkMark: DARK_MARK,
    appIcon: APP_ICON,

    // Aliases and backward-compatible paths
    master: '13_ASSETS/brand/mahi-browser-logo-master.png',
    logoHorizontal: PRIMARY_LOGO,
    logoDark: DARK_MARK,
    mark: '/brand/mahi-browser-mark.png',
    markLight: '/brand/mahi-browser-mark.png',
    markDark: DARK_MARK,
    markMono: RED_MARK,
    icon: APP_ICON,
    ico: '/brand/mahi-browser.ico',
    favicon: '/favicon.ico',
  },

  // Authoritative SHA-256 Hashes
  hashes: {
    ASSET_A: '2ce7854ac00975cc7e57881345bf1cc3b9e14940b0b1e59270e18aec2235efe8',
    ASSET_B: '916b50d58aec8398058645e968318778efed9879082ae62f908e51130e1f04a5',
    ASSET_C: 'a8a871b9e597a088699e6b38a49c25a6e454c3ab09aca74f031741d32de0a883',
    ASSET_D: 'f5dcca2de1050e4e381bbb49b305b0b406773f888c54f08cde00eb97319f4f4d',
  },

  // Brand Palette
  colors: {
    primaryCrimson: '#B91C1C',
    deepRuby: '#991B1B',
    accentRed: '#DC2626',
    dragonGlow: '#EF4444',
    darkSurface: '#0B0F19',
    darkCard: '#0F172A',
  },
} as const;

export default BRAND_CONFIG;
