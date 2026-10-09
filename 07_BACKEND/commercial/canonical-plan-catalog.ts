/**
 * MAHI Browser — Canonical Plan Catalog & Entitlement Matrix
 * 
 * SINGLE SOURCE OF TRUTH for plan definitions and capabilities.
 * 
 * CRITICAL RULES:
 * 1. Plan identity is by planId (immutable), NEVER by price.
 * 2. Price is admin-controlled SEPARATELY — see pricing-admin-service.ts
 * 3. Feature progression is cumulative: higher plans include everything from lower plans.
 * 4. Entitlements are resolved from this catalog, not from price values.
 */

import {
  CanonicalPlanId,
  CanonicalPlanDefinition,
  PlanPrice,
  FeatureCapability,
  TrialConfig,
} from '../../10_CONFIG/shared/types/commercial.js';

// ─── Capability Templates ──────────────────────────────────────────────────────

const FREE_CAPABILITIES: Record<FeatureCapability, boolean> = {
  'profile.basic': true,
  'profile.multiple': false,
  'cloud.sync': false,
  'cloud.browser': false,
  'proxy.builtin': false,
  'proxy.custom': true,          // BYOP manual proxy allowed on free
  'automation.rpa': false,
  'automation.scheduler': false,
  'automation.multiProfile': false,
  'automation.cookieWarmer': false,
  'automation.synchronizer': false,
  'workspace.team': false,
  'workspace.sharing': false,
  'api.remote': false,
  'api.webhooks': false,
  'mobile.cloudBrowser': false,
  'advanced.fingerprint': false,
};

const PRO_10_CAPABILITIES: Record<FeatureCapability, boolean> = {
  'profile.basic': true,
  'profile.multiple': true,
  'cloud.sync': true,
  'cloud.browser': false,       // Cloud Browser starts at Pro 50
  'proxy.builtin': false,       // Built-in proxy starts at Pro 25
  'proxy.custom': true,
  'automation.rpa': false,
  'automation.scheduler': false,
  'automation.multiProfile': false,
  'automation.cookieWarmer': false,
  'automation.synchronizer': false,
  'workspace.team': false,
  'workspace.sharing': false,
  'api.remote': false,
  'api.webhooks': false,
  'mobile.cloudBrowser': true,
  'advanced.fingerprint': true,
};

const PRO_25_CAPABILITIES: Record<FeatureCapability, boolean> = {
  ...PRO_10_CAPABILITIES,
  'proxy.builtin': true,         // 2 GB residential proxy data
  'workspace.sharing': true,     // Profile sharing enabled
};

const PRO_50_CAPABILITIES: Record<FeatureCapability, boolean> = {
  ...PRO_25_CAPABILITIES,
  'cloud.browser': true,         // Cloud Browser via web
  'automation.rpa': true,        // Visual RPA builder
  'automation.scheduler': true,
  'automation.multiProfile': true,
  'automation.cookieWarmer': true,
};

const PRO_100_CAPABILITIES: Record<FeatureCapability, boolean> = {
  ...PRO_50_CAPABILITIES,
  'automation.synchronizer': true,  // CDP Action Synchronizer
  'api.remote': true,               // REST API & SDKs
  'api.webhooks': true,             // Webhook notifications
};

const BUSINESS_ALL_CAPABILITIES: Record<FeatureCapability, boolean> = {
  'profile.basic': true,
  'profile.multiple': true,
  'cloud.sync': true,
  'cloud.browser': true,
  'proxy.builtin': true,
  'proxy.custom': true,
  'automation.rpa': true,
  'automation.scheduler': true,
  'automation.multiProfile': true,
  'automation.cookieWarmer': true,
  'automation.synchronizer': true,
  'workspace.team': true,
  'workspace.sharing': true,
  'api.remote': true,
  'api.webhooks': true,
  'mobile.cloudBrowser': true,
  'advanced.fingerprint': true,
};

// ─── Canonical Plan Definitions ────────────────────────────────────────────────

export const CANONICAL_PLAN_CATALOG: Record<CanonicalPlanId, CanonicalPlanDefinition> = {
  'free': {
    planId: 'free',
    displayName: 'Free',
    category: 'PERSONAL',
    tier: 'FREE',
    tierRank: 0,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 3,
    seatLimit: 1,
    cloudMinutesMonthly: 0,
    proxyDataGbMonthly: 0,
    automationConcurrency: 0,
    apiRequestsMonthly: 0,
    workspaceLimit: 0,
    capabilities: FREE_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 0,
  },

  'professional_10': {
    planId: 'professional_10',
    displayName: 'Professional 10',
    category: 'PERSONAL',
    tier: 'PRO',
    tierRank: 10,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 10,
    seatLimit: 1,
    cloudMinutesMonthly: 30,
    proxyDataGbMonthly: 0,
    automationConcurrency: 0,
    apiRequestsMonthly: 0,
    workspaceLimit: 0,
    capabilities: PRO_10_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 1,
  },

  'professional_25': {
    planId: 'professional_25',
    displayName: 'Professional 25',
    category: 'PERSONAL',
    tier: 'PRO',
    tierRank: 25,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 25,
    seatLimit: 1,
    cloudMinutesMonthly: 30,
    proxyDataGbMonthly: 2,
    automationConcurrency: 0,
    apiRequestsMonthly: 0,
    workspaceLimit: 0,
    capabilities: PRO_25_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 2,
  },

  'professional_50': {
    planId: 'professional_50',
    displayName: 'Professional 50',
    category: 'PERSONAL',
    tier: 'PRO',
    tierRank: 50,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 50,
    seatLimit: 1,
    cloudMinutesMonthly: 30,
    proxyDataGbMonthly: 2,
    automationConcurrency: 2,
    apiRequestsMonthly: 0,
    workspaceLimit: 0,
    capabilities: PRO_50_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 3,
  },

  'professional_100': {
    planId: 'professional_100',
    displayName: 'Professional 100',
    category: 'PERSONAL',
    tier: 'PRO',
    tierRank: 100,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 100,
    seatLimit: 1,
    cloudMinutesMonthly: 30,
    proxyDataGbMonthly: 2,
    automationConcurrency: 5,
    apiRequestsMonthly: 1000,
    workspaceLimit: 0,
    capabilities: PRO_100_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 4,
  },

  'business_starter': {
    planId: 'business_starter',
    displayName: 'Team 50',
    category: 'BUSINESS',
    tier: 'BUSINESS',
    tierRank: 150,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 50,
    seatLimit: 2,
    cloudMinutesMonthly: 60,
    proxyDataGbMonthly: 5,
    automationConcurrency: 3,
    apiRequestsMonthly: 1000,
    workspaceLimit: 1,
    capabilities: BUSINESS_ALL_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 5,
  },

  'business_growth': {
    planId: 'business_growth',
    displayName: 'Team 100',
    category: 'BUSINESS',
    tier: 'BUSINESS',
    tierRank: 200,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 100,
    seatLimit: 5,
    cloudMinutesMonthly: 120,
    proxyDataGbMonthly: 10,
    automationConcurrency: 5,
    apiRequestsMonthly: 5000,
    workspaceLimit: 3,
    capabilities: BUSINESS_ALL_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 6,
  },

  'business_scale': {
    planId: 'business_scale',
    displayName: 'Team 200',
    category: 'BUSINESS',
    tier: 'BUSINESS',
    tierRank: 300,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 200,
    seatLimit: 8,
    cloudMinutesMonthly: 240,
    proxyDataGbMonthly: 15,
    automationConcurrency: 10,
    apiRequestsMonthly: 10000,
    workspaceLimit: 5,
    capabilities: BUSINESS_ALL_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 7,
  },

  'business_enterprise': {
    planId: 'business_enterprise',
    displayName: 'Team 300',
    category: 'BUSINESS',
    tier: 'BUSINESS',
    tierRank: 400,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 300,
    seatLimit: 999,  // "Unlimited" team members with fair-use cap
    cloudMinutesMonthly: 500,
    proxyDataGbMonthly: 25,
    automationConcurrency: 20,
    apiRequestsMonthly: 50000,
    workspaceLimit: 10,
    capabilities: BUSINESS_ALL_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 8,
  },

  'enterprise_custom': {
    planId: 'enterprise_custom',
    displayName: 'Enterprise',
    category: 'BUSINESS',
    tier: 'ENTERPRISE',
    tierRank: 1000,
    currency: 'INR',
    priceMode: 'CUSTOM',
    profileLimit: 500,
    seatLimit: 50,
    cloudMinutesMonthly: 1000,
    proxyDataGbMonthly: 50,
    automationConcurrency: 50,
    apiRequestsMonthly: 100000,
    workspaceLimit: 999,
    capabilities: BUSINESS_ALL_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 9,
  },
};

// ─── Initial Pricing (Website Current as of Audit) ─────────────────────────────
// All values in PAISE (integer minor units, ₹1 = 100 paise)
// Annual prices = Monthly × 12 × (1 - annualDiscountPercent/100) / 12
// Website shows "Annually 50% off" — so annual/mo = monthly/2

export const INITIAL_ANNUAL_DISCOUNT_PERCENT = 50;

export const INITIAL_PLAN_PRICES: PlanPrice[] = [
  { planId: 'free',                monthlyPricePaise: 0,       annualPricePaise: 0,       currency: 'INR' },
  { planId: 'professional_10',     monthlyPricePaise: 59900,   annualPricePaise: 29900,   currency: 'INR' },
  { planId: 'professional_25',     monthlyPricePaise: 149900,  annualPricePaise: 74900,   currency: 'INR' },
  { planId: 'professional_50',     monthlyPricePaise: 299900,  annualPricePaise: 149900,  currency: 'INR' },
  { planId: 'professional_100',    monthlyPricePaise: 599900,  annualPricePaise: 299900,  currency: 'INR' },
  { planId: 'business_starter',    monthlyPricePaise: 299900,  annualPricePaise: 149900,  currency: 'INR' },
  { planId: 'business_growth',     monthlyPricePaise: 399900,  annualPricePaise: 199900,  currency: 'INR' },
  { planId: 'business_scale',      monthlyPricePaise: 499900,  annualPricePaise: 249900,  currency: 'INR' },
  { planId: 'business_enterprise', monthlyPricePaise: 599900,  annualPricePaise: 299900,  currency: 'INR' },
  { planId: 'enterprise_custom',   monthlyPricePaise: 0,       annualPricePaise: 0,       currency: 'INR' }, // Custom pricing
];

// ─── Trial Configuration ───────────────────────────────────────────────────────

export const TRIAL_CONFIG: TrialConfig = {
  durationDays: 7,
  trialPlanId: 'professional_50',
  cardRequired: false,
  maxTrialsPerAccount: 1,
};

// ─── Display Feature Lists (for catalog API) ──────────────────────────────────

export const PLAN_DISPLAY_FEATURES: Record<CanonicalPlanId, string[]> = {
  'free': [
    'Up to 3 profiles',
    'Unique fingerprints',
    'No credit card required',
  ],
  'professional_10': [
    'Up to 10 profiles',
    '30 Cloud Android minutes/mo',
    'Unique fingerprints',
    'Folders / Groups',
    'Bulk actions',
  ],
  'professional_25': [
    'Up to 25 profiles',
    '2 GB of residential proxy data',
    '30 Cloud Android minutes/mo',
    'Unique fingerprints',
    'Folders / Groups',
    'Proxy devices',
    'Profile shares',
  ],
  'professional_50': [
    'Up to 50 profiles',
    '2 GB of residential proxy data',
    '30 Cloud Android minutes/mo',
    'Unique fingerprints',
    'Folders / Groups',
    'Proxy devices',
    'Profile shares',
    'Bulk actions',
    'Cloud Browser via web',
    'Cookies import and export',
  ],
  'professional_100': [
    'Up to 100 profiles',
    '2 GB of residential proxy data',
    '30 Cloud Android minutes/mo',
    'Unique fingerprints',
    'Folders / Groups',
    'Proxy devices',
    'Profile shares',
    'Bulk actions',
    'Cloud Browser via web',
    'Cookies import and export',
    'Synchronizer',
    'Cookie Bot',
    'Custom extensions',
    'REST API & SDKs',
    'MCP server',
  ],
  'business_starter': [
    'Up to 50 profiles',
    '2 Team Member seats included',
    '5 GB of residential proxy data',
    'Unique hardware fingerprints',
    'Team Folders & Permissions',
    'Bulk profile management',
    'Proxy device sharing',
  ],
  'business_growth': [
    'Up to 100 profiles',
    '5 Team Member seats included',
    '10 GB of residential proxy data',
    'Unique hardware fingerprints',
    'Role-Based Access Control',
    'Visual RPA Workflow Builder',
    'Automated Cookie Warmer',
  ],
  'business_scale': [
    'Up to 200 profiles',
    '8 Team Member seats included',
    '15 GB residential proxy data',
    'Multi-Window Live Synchronizer',
    '4G/5G Hotspot ADB IP Rotator',
    'REST API & SDKs (1000 RPM)',
    'Cloud Browser via web',
  ],
  'business_enterprise': [
    'Up to 300 profiles',
    'Unlimited team members',
    '25 GB residential proxy data',
    'Full Visual RPA & Cookie Warmer',
    'Custom CDP & Headless automation',
    'SLA 99.99% with dedicated manager',
    'Priority WhatsApp Developer Support',
  ],
  'enterprise_custom': [
    'Custom profile limits',
    'Custom team seats',
    'Custom API & cloud quotas',
    'Dedicated account manager',
    'Custom SLA',
    'Contact Sales',
  ],
};

// ─── Popular Plan Flags ────────────────────────────────────────────────────────

export const POPULAR_PLANS: Record<string, CanonicalPlanId> = {
  PERSONAL: 'professional_50',
  BUSINESS: 'business_enterprise',
};

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Returns the canonical plan definition by ID.
 */
export function getCanonicalPlan(planId: CanonicalPlanId): CanonicalPlanDefinition | null {
  return CANONICAL_PLAN_CATALOG[planId] || null;
}

/**
 * Returns all active canonical plans for a given category.
 */
export function getCanonicalPlansByCategory(category: 'PERSONAL' | 'BUSINESS'): CanonicalPlanDefinition[] {
  return Object.values(CANONICAL_PLAN_CATALOG)
    .filter(p => p.category === category && p.status === 'ACTIVE' && p.planId !== 'free' && p.planId !== 'enterprise_custom')
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Find the lowest plan that includes a given capability.
 * Used for "upgrade to X" recommendations.
 */
export function findLowestPlanForCapability(
  capability: FeatureCapability,
  category: 'PERSONAL' | 'BUSINESS' = 'PERSONAL'
): CanonicalPlanDefinition | null {
  const plans = Object.values(CANONICAL_PLAN_CATALOG)
    .filter(p => p.status === 'ACTIVE' && p.category === category)
    .sort((a, b) => a.tierRank - b.tierRank);

  return plans.find(p => p.capabilities[capability]) || null;
}

/**
 * Resolves capability map for a given canonical plan ID.
 * Supports the old plan IDs (plan_free, plan_pro, etc.) for backward compatibility.
 */
export function resolveCapabilitiesForCanonicalPlan(
  planId: string
): Record<FeatureCapability, boolean> {
  // Direct canonical lookup
  const canonical = CANONICAL_PLAN_CATALOG[planId as CanonicalPlanId];
  if (canonical) return { ...canonical.capabilities };

  // Legacy plan ID mapping
  const legacyMap: Record<string, CanonicalPlanId> = {
    'plan_free': 'free',
    'plan_pro': 'professional_100',
    'plan_business': 'business_growth',
    'plan_enterprise': 'enterprise_custom',
  };

  const mappedId = legacyMap[planId];
  if (mappedId && CANONICAL_PLAN_CATALOG[mappedId]) {
    return { ...CANONICAL_PLAN_CATALOG[mappedId].capabilities };
  }

  // Fallback to free
  return { ...FREE_CAPABILITIES };
}

/**
 * Formats a paise amount to INR display string.
 * Example: 59900 → "₹599"
 */
export function formatPaiseToDisplay(paise: number, currency = 'INR'): string {
  const major = Math.floor(paise / 100);
  if (currency === 'INR') {
    return `₹${major.toLocaleString('en-IN')}`;
  }
  return `${major}`;
}

/**
 * Calculates annual price from monthly price and discount percent.
 * Returns paise value (integer).
 */
export function calculateAnnualPricePaise(monthlyPricePaise: number, discountPercent: number): number {
  // Annual = Monthly * 12 * (1 - discount/100) / 12 = Monthly * (1 - discount/100)
  // But the display is "per month when billed annually"
  return Math.round(monthlyPricePaise * (1 - discountPercent / 100));
}

/**
 * Maps legacy plan IDs to canonical plan IDs.
 */
export function legacyPlanIdToCanonical(legacyId: string): CanonicalPlanId {
  const map: Record<string, CanonicalPlanId> = {
    'plan_free': 'free',
    'plan_pro': 'professional_100',
    'plan_business': 'business_growth',
    'plan_enterprise': 'enterprise_custom',
    'FREE': 'free',
    'PRO': 'professional_100',
    'BUSINESS': 'business_growth',
    'ENTERPRISE': 'enterprise_custom',
  };
  return map[legacyId] || (CANONICAL_PLAN_CATALOG[legacyId as CanonicalPlanId] ? legacyId as CanonicalPlanId : 'free');
}
