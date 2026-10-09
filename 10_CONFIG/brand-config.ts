/**
 * MAHI Browser - Authoritative Central Brand Configuration
 * Single source of truth for product identity, official logo assets, and brand styling.
 */

export const BRAND_CONFIG = {
  productName: 'MAHI Browser',
  brandName: 'MAHI Browser',
  shortName: 'MAHI',
  tagline: 'Enterprise Anti-Detect & Multi-Session Automation Hub',
  company: 'MAHI Browser Team',
  website: 'https://mahibrowser.com',
  consoleUrl: 'https://app.mahibrowser.com',

  // Asset Paths (relative to application public root / bundle)
  assets: {
    master: '13_ASSETS/brand/mahi-browser-logo-master.png',
    logoHorizontal: '/brand/mahi-browser-logo-horizontal.png',
    logoDark: '/brand/mahi-browser-logo-dark.png',
    mark: '/brand/mahi-browser-mark.png',
    markLight: '/brand/mahi-browser-mark-light.png',
    markDark: '/brand/mahi-browser-mark-dark.png',
    markMono: '/brand/mahi-browser-mark-mono.png',
    icon: '/brand/mahi-browser-icon.png',
    ico: '/brand/mahi-browser.ico',
    favicon: '/favicon.ico',
  },

  // Primary brand palette derived from official dragon mark
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
