/**
 * MAHI BROWSER — Starter Demo Profiles & Clean Onboarding Service
 *
 * Provides 5-6 clean, isolated onboarding templates for new users:
 * - NO real cookies, passwords, or fake marketplace sessions
 * - NO database rows until the user explicitly clones/uses a template
 * - NEVER counted against real user profile quota
 * - Existing users with real profiles remain completely unaffected
 */

import type { Profile, ProfileSettings, CreateProfileDTO } from '../../10_CONFIG/shared/types/profile.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { createProfile } from './profile-service.js';
import { assertCanCreateProfile } from '../../08_SECURITY/freemium-guard.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { CHROMIUM_PRODUCTION_VERSION } from '../../10_CONFIG/engine-config.js';

export type StarterCategory = 'PERSONAL' | 'SOCIAL' | 'E-COMMERCE' | 'WORK' | 'AUTOMATION' | 'SANDBOX';

export interface StarterProfileTemplate {
  id: string;
  name: string;
  category: StarterCategory;
  badge: 'STARTER' | 'DEMO' | 'TEMPLATE' | 'EXAMPLE';
  description: string;
  folder: string;
  icon: string;
  color: string;
  features: string[];
  recommendedUse: string;
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

export const STARTER_PROFILE_TEMPLATES: StarterProfileTemplate[] = [
  {
    id: 'starter_personal',
    name: 'Personal Browsing',
    category: 'PERSONAL',
    badge: 'STARTER',
    description: 'Everyday private browsing with standard fingerprint protection and clean local storage.',
    folder: 'Personal',
    icon: 'User',
    color: '#0D9488', // Teal
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
      webGlVendor: 'Google Inc. (NVIDIA)',
      canvasNoise: true,
      audioNoise: true,
    },
    features: [
      'Isolated Cookie Jar & Cache',
      'Canvas & Audio Hardware Emulation',
      'Direct Network Connection Ready',
      'Clean Zero-Tracking History',
    ],
    recommendedUse: 'General browsing, research, and individual account management.',
    defaultSettings: {
      browser: {
        engine: 'chromium',
        version: CHROMIUM_PRODUCTION_VERSION,
        userAgent: '',
        startupUrl: 'https://duckduckgo.com',
        homepage: 'https://duckduckgo.com',
        additionalArgs: [],
        enableExtensions: true,
        hardwareAcceleration: false,
      },
      fingerprint: {
        canvas: 'noise',
        audio: 'noise',
        canvasNoise: true,
        audioContextNoise: true,
      },
      network: {
        directConnection: true,
        webrtc: 'default',
      },
    },
  },
  {
    id: 'starter_social',
    name: 'Social Media Profile',
    category: 'SOCIAL',
    badge: 'DEMO',
    description: 'Optimized for managing independent social media handles with isolated session storage.',
    folder: 'Social Media',
    icon: 'Share2',
    color: '#3B82F6', // Blue
    os: 'mac',
    browser: 'Chrome 128 / macOS Sonoma',
    fingerprintPreview: {
      screenResolution: '2560x1440',
      userAgentSnippet: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
      webGlVendor: 'Apple (Apple M2 Pro)',
      canvasNoise: true,
      audioNoise: true,
    },
    features: [
      'Isolated Session & LocalStorage',
      'Audio & Canvas Hardware Noise Injection',
      'Spoofed ClientRects & WebGL Vendors',
      'Independent Cache & Cookie Partitions',
    ],
    recommendedUse: 'Twitter/X, Reddit, Instagram, and Discord account operations.',
    defaultSettings: {
      browser: {
        engine: 'chromium',
        version: CHROMIUM_PRODUCTION_VERSION,
        userAgent: '',
        startupUrl: 'https://twitter.com',
        homepage: 'https://twitter.com',
        additionalArgs: [],
        enableExtensions: true,
        hardwareAcceleration: false,
      },
      fingerprint: {
        canvas: 'noise',
        audio: 'noise',
        webgl: 'noise',
        clientRects: 'noise',
        canvasNoise: true,
        audioContextNoise: true,
      },
    },
  },
  {
    id: 'starter_ecommerce',
    name: 'E-Commerce Store Profile',
    category: 'E-COMMERCE',
    badge: 'STARTER',
    description: 'Tailored for storefronts and marketplace management with dedicated checkout protection.',
    folder: 'E-Commerce',
    icon: 'ShoppingCart',
    color: '#10B981', // Emerald
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
      webGlVendor: 'Google Inc. (NVIDIA GeForce RTX 4070)',
      canvasNoise: true,
      audioNoise: true,
    },
    features: [
      'Strict Cookie Isolation',
      'Persistent Session State (Clean Boot)',
      'Custom Proxy / BYOP Config Ready',
      'High-Trust Fingerprint Consistency',
    ],
    recommendedUse: 'Shopify, Amazon Seller, eBay, and payment gateway dashboards.',
    defaultSettings: {
      browser: {
        engine: 'chromium',
        version: CHROMIUM_PRODUCTION_VERSION,
        userAgent: '',
        startupUrl: 'https://www.google.com',
        homepage: 'https://www.google.com',
        additionalArgs: [],
        enableExtensions: true,
        hardwareAcceleration: false,
      },
      fingerprint: {
        canvas: 'noise',
        webgl: 'noise',
        canvasNoise: true,
        audioContextNoise: true,
      },
    },
  },
  {
    id: 'starter_work',
    name: 'Business & Work Profile',
    category: 'WORK',
    badge: 'DEMO',
    description: 'Dedicated client workspace container for enterprise dashboards, analytics, and business SaaS applications.',
    folder: 'Work',
    icon: 'Briefcase',
    color: '#6366F1', // Indigo
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
      webGlVendor: 'Google Inc. (Intel Iris Xe)',
      canvasNoise: true,
      audioNoise: true,
    },
    features: [
      'Enterprise SaaS Container',
      'Independent Google Workspace / M365 Partition',
      'Multi-Window Stability Flags',
      'Isolated Extension Sandboxing',
    ],
    recommendedUse: 'Slack, Notion, Asana, Google Workspace, and CRM dashboards.',
    defaultSettings: {
      browser: {
        engine: 'chromium',
        version: CHROMIUM_PRODUCTION_VERSION,
        userAgent: '',
        startupUrl: 'https://google.com',
        homepage: 'https://google.com',
        additionalArgs: [],
        enableExtensions: true,
        hardwareAcceleration: false,
      },
      fingerprint: {
        canvas: 'noise',
        audio: 'noise',
        canvasNoise: true,
        audioContextNoise: true,
      },
    },
  },
  {
    id: 'starter_automation',
    name: 'Automation Example Profile',
    category: 'AUTOMATION',
    badge: 'EXAMPLE',
    description: 'Configured for RPA workflow studio runs, Playwright tasks, and automated script sessions.',
    folder: 'Automation',
    icon: 'Bot',
    color: '#8B5CF6', // Purple
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
      webGlVendor: 'Google Inc. (NVIDIA)',
      canvasNoise: true,
      audioNoise: true,
    },
    features: [
      'CDP Remote Debugging Ready',
      'Automated Script Execution Port',
      'Zero-Prompt Permission Grants',
      'RPA Studio Runner Compatible',
    ],
    recommendedUse: 'Testing custom RPA flows, scrapers, and automated form fillers.',
    defaultSettings: {
      browser: {
        engine: 'chromium',
        version: CHROMIUM_PRODUCTION_VERSION,
        userAgent: '',
        startupUrl: 'https://example.com',
        homepage: 'https://example.com',
        additionalArgs: ['--remote-debugging-port=0'],
        enableExtensions: false,
        hardwareAcceleration: false,
      },
      fingerprint: {
        canvas: 'noise',
        canvasNoise: true,
      },
    },
  },
  {
    id: 'starter_sandbox',
    name: 'Sandbox & Test Profile',
    category: 'SANDBOX',
    badge: 'DEMO',
    description: 'Disposable testing environment for quick link verification and untrusted website testing.',
    folder: 'Sandbox',
    icon: 'ShieldAlert',
    color: '#F59E0B', // Amber
    os: 'linux',
    browser: 'Chrome 128 / Linux x86_64',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (X11; Linux x86_64)...',
      webGlVendor: 'Google Inc. (Mesa / AMD Radeon)',
      canvasNoise: true,
      audioNoise: true,
    },
    features: [
      'Disposable Ephemeral Profile',
      'WebRTC Leak Disabled',
      'Strict Camera & Mic Permissions Block',
      'Safe Testing Environment',
    ],
    recommendedUse: 'Inspecting suspicious links, testing web features, or one-off sessions.',
    defaultSettings: {
      browser: {
        engine: 'chromium',
        version: CHROMIUM_PRODUCTION_VERSION,
        userAgent: '',
        startupUrl: 'https://example.com',
        homepage: 'https://example.com',
        additionalArgs: [],
        enableExtensions: false,
        hardwareAcceleration: false,
      },
      fingerprint: {
        canvas: 'noise',
        audio: 'noise',
        canvasNoise: true,
        audioContextNoise: true,
      },
      network: {
        directConnection: true,
        webrtc: 'disabled',
      },
      permissions: {
        camera: 'block',
        microphone: 'block',
        geolocation: 'block',
        notifications: 'block',
        midi: 'block',
      },
    },
  },
];

/**
 * Returns the immutable list of starter templates.
 * These are purely decorative and operational references; they do not exist in the database.
 */
export function getStarterTemplates(): StarterProfileTemplate[] {
  return JSON.parse(JSON.stringify(STARTER_PROFILE_TEMPLATES));
}

/**
 * Fetches a single starter template by ID.
 * Supports normalization of hyphenated IDs (e.g. 'starter-personal' -> 'starter_personal')
 * and alias mapping ('starter-business' -> 'starter_work').
 */
export function getStarterTemplateById(id: string): StarterProfileTemplate | null {
  if (!id || typeof id !== 'string') return null;
  const raw = id.trim();
  const normalizedId = raw.toLowerCase().replace(/-/g, '_');
  const aliasMap: Record<string, string> = {
    starter_business: 'starter_work',
    starter_work: 'starter_work',
  };
  const targetId = aliasMap[normalizedId] || normalizedId;
  const found = STARTER_PROFILE_TEMPLATES.find(
    (t) =>
      t.id === targetId ||
      t.id === raw ||
      t.id.replace(/-/g, '_') === normalizedId ||
      t.category.toLowerCase() === normalizedId
  );
  return found ? JSON.parse(JSON.stringify(found)) : null;
}

/**
 * Checks if the user has 0 real profiles (i.e. is a clean new user).
 */
export function isUserNew(ownerId?: string): boolean {
  return getRealUserProfileCount(ownerId) === 0;
}

/**
 * Returns the count of real user profiles (excluding starter templates which have no DB rows).
 * Specifically queries profiles owned by the specified user without bleeding shared system profiles into their quota.
 */
export function getRealUserProfileCount(ownerId?: string): number {
  try {
    const db = getDatabase();
    if (ownerId && ownerId !== 'LOCAL_CLIENT' && ownerId !== 'SYSTEM_OWNER') {
      const row = db
        .prepare('SELECT COUNT(*) as count FROM profiles WHERE deleted_at IS NULL AND owner_id = ?')
        .get(ownerId) as { count: number } | undefined;
      return typeof row?.count === 'number' ? row.count : 0;
    }
    const row = db
      .prepare("SELECT COUNT(*) as count FROM profiles WHERE deleted_at IS NULL AND (owner_id = 'SYSTEM_OWNER' OR owner_id = 'LOCAL_CLIENT' OR owner_id IS NULL)")
      .get() as { count: number } | undefined;
    return typeof row?.count === 'number' ? row.count : 0;
  } catch {
    return 0;
  }
}

/**
 * Clones a starter template into a genuine, user-owned, real Profile in the database.
 * Strictly verifies the user has quota under their active plan before creating.
 */
export function createProfileFromStarter(
  templateId: string,
  options: {
    name?: string;
    customName?: string;
    folder?: string;
    ownerId?: string;
  } = {}
): Profile {
  const template = getStarterTemplateById(templateId);
  if (!template) {
    throw new Error(`Starter template "${templateId}" not found.`);
  }

  // Quota enforcement
  assertCanCreateProfile(1);

  const baseSettings = getDefaultProfileSettings();
  const mergedSettings: ProfileSettings = {
    ...baseSettings,
    ...template.defaultSettings,
    browser: {
      ...baseSettings.browser,
      ...(template.defaultSettings?.browser || {}),
    },
    display: {
      ...baseSettings.display,
      ...(template.defaultSettings?.display || {}),
    },
    locale: {
      ...baseSettings.locale,
      ...(template.defaultSettings?.locale || {}),
    },
    network: {
      ...baseSettings.network,
      ...(template.defaultSettings?.network || {}),
    },
    permissions: {
      ...baseSettings.permissions,
      ...(template.defaultSettings?.permissions || {}),
    },
    fingerprint: {
      ...baseSettings.fingerprint,
      ...(template.defaultSettings?.fingerprint || {}),
    },
  };

  const chosenName = options.name?.trim() || options.customName?.trim() || `${template.name} (Copy)`;

  const createDto: CreateProfileDTO = {
    name: chosenName,
    description: `Created from ${template.name} template.`,
    folder: options.folder?.trim() || template.folder,
    notes: `Initial starter template: ${template.category}. Feel free to modify settings.`,
    ownerId: options.ownerId,
    settings: mergedSettings,
  };

  return createProfile(createDto);
}
