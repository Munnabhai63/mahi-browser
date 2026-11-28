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

import type {
  CanonicalPlanId,
  CanonicalPlanDefinition,
  PlanPrice,
  FeatureCapability,
  TrialConfig,
  BillingCycleType,
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
  'stealth.nativeHooks117': true, // Reverse-engineered C++ hooks enabled on all tiers
  'stealth.aiHumanizer': true,    // Natural Bezier mouse curves & typing jitter
  'stealth.multiCore': false,
  'stealth.fakeVideoKYC': false,
  'api.localDaemon': false,
};

const MAHI_STARTER_CAPABILITIES: Record<FeatureCapability, boolean> = {
  ...FREE_CAPABILITIES,
  'profile.multiple': true,
  'advanced.fingerprint': true,
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
  'stealth.nativeHooks117': true,
  'stealth.aiHumanizer': true,
  'stealth.multiCore': false,
  'stealth.fakeVideoKYC': false,
  'api.localDaemon': false,
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
  'stealth.multiCore': true,     // MostLogin multi-core resolution (Chrome 120-130)
  'stealth.fakeVideoKYC': true,  // Virtual video stream KYC bypass
};

const PRO_100_CAPABILITIES: Record<FeatureCapability, boolean> = {
  ...PRO_50_CAPABILITIES,
  'automation.synchronizer': true,  // CDP Action Synchronizer
  'api.remote': true,               // REST API & SDKs
  'api.webhooks': true,             // Webhook notifications
  'api.localDaemon': true,          // MostLogin-compatible local daemon API
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
  'stealth.nativeHooks117': true,
  'stealth.aiHumanizer': true,
  'stealth.multiCore': true,
  'stealth.fakeVideoKYC': true,
  'api.localDaemon': true,
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
    profileLimit: 1,
    seatLimit: 1,
    cloudMinutesMonthly: 0,
    proxyDataGbMonthly: 0,
    automationConcurrency: 0,
    apiRequestsMonthly: 0,
    workspaceLimit: 0,
    proxySlotLimit: 15,
    cloudBackupLimit: 0,
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
    seatLimit: 2,
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
    seatLimit: 3,
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
    seatLimit: 5,
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
    seatLimit: 5,
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
    seatLimit: 10,
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
    seatLimit: 20,
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
    seatLimit: 999, // "Unlimited" team members with fair-use cap
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

  'mahi_starter': {
    planId: 'mahi_starter',
    displayName: 'Starter',
    category: 'PERSONAL',
    tier: 'PRO',
    tierRank: 25,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 25,
    seatLimit: 1,
    cloudMinutesMonthly: 30,
    proxyDataGbMonthly: 0,
    automationConcurrency: 3,
    apiRequestsMonthly: 0,
    workspaceLimit: 0,
    durationDays: 30,
    defaultBillingCycle: 'MONTHLY',
    proxySlotLimit: 25,
    cloudBackupLimit: 0,
    capabilities: MAHI_STARTER_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 10,
  },

  'mahi_growth': {
    planId: 'mahi_growth',
    displayName: 'Growth',
    category: 'PERSONAL',
    tier: 'PRO',
    tierRank: 50,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 100,
    seatLimit: 1,
    cloudMinutesMonthly: 30,
    proxyDataGbMonthly: 2,
    automationConcurrency: 10,
    apiRequestsMonthly: 1000,
    workspaceLimit: 0,
    durationDays: 180,
    defaultBillingCycle: 'SEMI_ANNUAL',
    proxySlotLimit: -1,
    cloudBackupLimit: 25,
    capabilities: PRO_100_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 11,
  },

  'mahi_ultimate': {
    planId: 'mahi_ultimate',
    displayName: 'Ultimate',
    category: 'BUSINESS',
    tier: 'BUSINESS',
    tierRank: 100,
    currency: 'INR',
    priceMode: 'FIXED',
    profileLimit: 1000000,
    seatLimit: 2,
    cloudMinutesMonthly: 100,
    proxyDataGbMonthly: 10,
    automationConcurrency: 25,
    apiRequestsMonthly: 10000,
    workspaceLimit: 2,
    durationDays: 365,
    defaultBillingCycle: 'ANNUAL',
    proxySlotLimit: -1,
    cloudBackupLimit: -1,
    capabilities: BUSINESS_ALL_CAPABILITIES,
    status: 'ACTIVE',
    displayOrder: 12,
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
  { planId: 'mahi_starter',        monthlyPricePaise: 59900,   annualPricePaise: 59900,   currency: 'INR' },
  { planId: 'mahi_growth',         monthlyPricePaise: 16650,   annualPricePaise: 99900,   currency: 'INR' },
  { planId: 'mahi_ultimate',       monthlyPricePaise: 12492,   annualPricePaise: 149900,  currency: 'INR' },
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
    '1 profile included',
    'Unique fingerprints',
    'No credit card required',
  ],
  'professional_10': [
    'Up to 10 profiles',
    '1 Team Member seat included',
    '30 Cloud Android minutes/mo',
    'Unique fingerprints',
    'Folders / Groups',
    'Bulk actions',
  ],
  'professional_25': [
    'Up to 25 profiles',
    '2 Team Member seats included',
    '2 GB of residential proxy data',
    '30 Cloud Android minutes/mo',
    'Unique fingerprints',
    'Folders / Groups',
    'Proxy devices',
    'Profile shares',
  ],
  'professional_50': [
    'Up to 50 profiles',
    '3 Team Member seats included',
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
    '5 Team Member seats included',
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
    '5 Team Member seats included',
    '5 GB of residential proxy data',
    'Unique hardware fingerprints',
    'Team Folders & Permissions',
    'Bulk profile management',
    'Proxy device sharing',
  ],
  'business_growth': [
    'Up to 100 profiles',
    '10 Team Member seats included',
    '10 GB of residential proxy data',
    'Unique hardware fingerprints',
    'Role-Based Access Control',
    'Visual RPA Workflow Builder',
    'Automated Cookie Warmer',
  ],
  'business_scale': [
    'Up to 200 profiles',
    '20 Team Member seats included',
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
  'mahi_starter': [
    '25 Air-Gapped Profiles (Offline SQLite)',
    'Dual Engine (Chromium 138 + Camoufox)',
    '25 Custom Proxy Slots (HTTP/SOCKS5)',
    '1 Active Device Seat',
  ],
  'mahi_growth': [
    '100 High-Entropy Profiles (Offline SQLite)',
    'Unlimited Custom Proxies (BYOP)',
    'Unlimited Fingerprint Perturbation & Re-gen',
    'Unlimited Bulk Cookie & Session Importer',
  ],
  'mahi_ultimate': [
    'Unlimited Air-Gapped Profiles (Offline SQLite)',
    'Unlimited Dual-Engine Stealth Fingerprints',
    'Unlimited Proxy Management & Routing',
    'Unlimited RPA & Headless Playwright API',
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
  const normId = (planId || '').toLowerCase().trim();
  if (!normId) {
    return { ...FREE_CAPABILITIES };
  }

  // Direct canonical lookup
  const canonical = CANONICAL_PLAN_CATALOG[normId as CanonicalPlanId];
  if (canonical) return { ...canonical.capabilities };

  // Resolve short & legacy aliases via canonical mapper
  const mappedId = legacyPlanIdToCanonical(normId);
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
 * Team plan aliases mapped to canonical business plan IDs.
 */
export const TEAM_PLAN_ALIASES: Record<string, CanonicalPlanId> = {
  'team_50': 'business_starter',
  'team_100': 'business_growth',
  'team_200': 'business_scale',
  'team_300': 'business_enterprise',
};

/**
 * Authoritative Add-on Minor Unit Pricing:
 * - Extra team member: 49,900 paise (₹499) / 600 cents ($6.00) per month
 * - Extra proxy bandwidth: 19,900 paise (₹199) / 300 cents ($3.00) per GB per month
 */
export const ADDON_PRICING = {
  EXTRA_MEMBER: {
    monthlyPricePaise: 49900, // ₹499
    monthlyPriceCents: 600,   // $6.00
  },
  EXTRA_PROXY_GB: {
    monthlyPricePaise: 19900, // ₹199
    monthlyPriceCents: 300,   // $3.00
  },
} as const;

export const INITIAL_PLAN_PRICES_USD: Record<CanonicalPlanId, { monthlyCents: number; annualCents: number }> = {
  'free': { monthlyCents: 0, annualCents: 0 },
  'professional_10': { monthlyCents: 700, annualCents: 350 },
  'professional_25': { monthlyCents: 1800, annualCents: 900 },
  'professional_50': { monthlyCents: 3600, annualCents: 1800 },
  'professional_100': { monthlyCents: 7200, annualCents: 3600 },
  'business_starter': { monthlyCents: 3600, annualCents: 1800 },
  'business_growth': { monthlyCents: 4800, annualCents: 2400 },
  'business_scale': { monthlyCents: 6000, annualCents: 3000 },
  'business_enterprise': { monthlyCents: 7200, annualCents: 3600 },
  'enterprise_custom': { monthlyCents: 0, annualCents: 0 },
  'mahi_starter': { monthlyCents: 900, annualCents: 900 },
  'mahi_growth': { monthlyCents: 250, annualCents: 1500 },
  'mahi_ultimate': { monthlyCents: 200, annualCents: 2400 },
};

export interface OrderTotalOptions {
  planId: string;
  billingCycle: BillingCycleType | string;
  currency?: 'INR' | 'USD';
  extraMembers?: number;
  extraProxyGb?: number;
}

export interface AuthoritativeOrderTotal {
  planId: CanonicalPlanId;
  billingCycle: BillingCycleType;
  currency: 'INR' | 'USD';
  baseMonthlyRateMinor: number;
  discountedMonthlyRateMinor: number;
  billingMonths: number;
  baseChargeMinor: number;
  extraMembers: number;
  extraMemberMonthlyMinor: number;
  extraMembersTotalMinor: number;
  extraProxyGb: number;
  extraProxyGbMonthlyMinor: number;
  extraProxyGbTotalMinor: number;
  totalMonthlyMinor: number;
  totalChargeMinor: number;
  discountPercent: number;
}

/**
 * Normalizes billing cycle inputs (including 6-month / semi-annual aliases)
 * against the target plan's canonical term structure.
 */
export function normalizeBillingCycle(rawCycle?: string, planId?: string): BillingCycleType {
  const canonicalId = planId ? legacyPlanIdToCanonical(planId) : null;
  const upper = (rawCycle || '').toUpperCase().trim();

  if (upper === 'SEMI_ANNUAL' || upper === 'SEMIANNUAL' || upper === '6_MONTHS' || upper === '6MONTHS' || upper === '6M' || upper === 'HALF_YEARLY') {
    return 'SEMI_ANNUAL';
  }
  if (upper === 'QUARTERLY' || upper === '3_MONTHS' || upper === '3MONTHS' || upper === '3M') {
    return 'QUARTERLY';
  }
  if (upper === 'MONTHLY' || upper === '1_MONTH' || upper === '1MONTH' || upper === '1M') {
    return canonicalId === 'mahi_growth' ? 'SEMI_ANNUAL' : 'MONTHLY';
  }
  if (upper === 'ANNUAL' || upper === 'YEARLY' || upper === '1_YEAR' || upper === '1YEAR' || upper === '1Y') {
    if (canonicalId === 'mahi_growth') return 'SEMI_ANNUAL';
    return 'ANNUAL';
  }

  const defaultCycle = canonicalId ? CANONICAL_PLAN_CATALOG[canonicalId]?.defaultBillingCycle : undefined;
  if (defaultCycle) {
    return defaultCycle;
  }
  return 'MONTHLY';
}

/**
 * Resolves exact subscription validity duration in days based on canonical plan and billing cycle.
 */
export function resolveSubscriptionDurationDays(planId: string, billingCycle?: string): number {
  const canonicalId = legacyPlanIdToCanonical(planId) || 'free';
  const cycle = normalizeBillingCycle(billingCycle, planId);

  if (canonicalId === 'mahi_growth') {
    return 180;
  }
  if (canonicalId === 'mahi_ultimate') {
    return 365;
  }
  if (canonicalId === 'mahi_starter') {
    if (cycle === 'QUARTERLY') return 90;
    if (cycle === 'SEMI_ANNUAL') return 180;
    return CANONICAL_PLAN_CATALOG.mahi_starter.durationDays || 30;
  }

  if (cycle === 'ANNUAL') return 365;
  if (cycle === 'SEMI_ANNUAL') return 180;
  if (cycle === 'QUARTERLY') return 90;
  return 30;
}

/**
 * Authoritative minor-unit order total calculation.
 *
 * Rules:
 * - Fixed-term MAHI plans (mahi_starter / mahi_growth / mahi_ultimate): read authoritative
 *   term price directly from INITIAL_PLAN_PRICES / INITIAL_PLAN_PRICES_USD (zero double-discounting).
 * - Legacy pro/business per-month plans: annual discount = 50% off monthly base rate × 12 months.
 * - Add-ons billed per month × billingMonths.
 */
export function calculateAuthoritativeOrderTotal(options: OrderTotalOptions): AuthoritativeOrderTotal {
  const resolved = legacyPlanIdToCanonical(options.planId);
  if (!resolved) {
    throw new Error(
      `AUTHORITATIVE_PRICE_UNRESOLVED: planId="${options.planId}" ` +
      `cannot be priced. Refusing to default to free — this would under-bill.`
    );
  }
  const canonicalId = resolved;
  const currency = options.currency === 'USD' ? 'USD' : 'INR';
  const billingCycle = normalizeBillingCycle(options.billingCycle, canonicalId);
  const extraMembers = Math.max(0, Math.floor(options.extraMembers || 0));
  const extraProxyGb = Math.max(0, Math.floor(options.extraProxyGb || 0));

  const inrEntry = INITIAL_PLAN_PRICES.find((p) => p.planId === canonicalId);
  const usdEntry = INITIAL_PLAN_PRICES_USD[canonicalId];

  const baseMonthlyRateMinor =
    currency === 'INR' ? (inrEntry?.monthlyPricePaise || 0) : (usdEntry?.monthlyCents || 0);
  const authoritativeTermRateMinor =
    currency === 'INR' ? (inrEntry?.annualPricePaise || 0) : (usdEntry?.annualCents || 0);

  const extraMemberMonthlyMinor =
    currency === 'USD' ? ADDON_PRICING.EXTRA_MEMBER.monthlyPriceCents : ADDON_PRICING.EXTRA_MEMBER.monthlyPricePaise;
  const extraProxyGbMonthlyMinor =
    currency === 'USD' ? ADDON_PRICING.EXTRA_PROXY_GB.monthlyPriceCents : ADDON_PRICING.EXTRA_PROXY_GB.monthlyPricePaise;

  let discountPercent = 0;
  let discountedMonthlyRateMinor = baseMonthlyRateMinor;
  let billingMonths = 1;
  let baseChargeMinor = baseMonthlyRateMinor;

  if (canonicalId === 'mahi_ultimate') {
    billingMonths = 12;
    baseChargeMinor = authoritativeTermRateMinor || baseMonthlyRateMinor * 12;
    discountedMonthlyRateMinor = Math.round(baseChargeMinor / 12);
    discountPercent = 79;
  } else if (canonicalId === 'mahi_growth') {
    billingMonths = 6;
    baseChargeMinor = authoritativeTermRateMinor || baseMonthlyRateMinor * 6;
    discountedMonthlyRateMinor = Math.round(baseChargeMinor / 6);
    discountPercent = 72;
  } else if (canonicalId === 'mahi_starter') {
    billingMonths = billingCycle === 'QUARTERLY' ? 3 : billingCycle === 'SEMI_ANNUAL' ? 6 : 1;
    discountedMonthlyRateMinor = baseMonthlyRateMinor;
    baseChargeMinor = baseMonthlyRateMinor * billingMonths;
    discountPercent = 0;
  } else {
    discountPercent = billingCycle === 'ANNUAL' ? INITIAL_ANNUAL_DISCOUNT_PERCENT : 0;
    discountedMonthlyRateMinor =
      billingCycle === 'ANNUAL'
        ? Math.round(baseMonthlyRateMinor * (1 - discountPercent / 100))
        : baseMonthlyRateMinor;
    billingMonths =
      billingCycle === 'ANNUAL' ? 12 : billingCycle === 'SEMI_ANNUAL' ? 6 : billingCycle === 'QUARTERLY' ? 3 : 1;
    baseChargeMinor = discountedMonthlyRateMinor * billingMonths;
  }

  const extraMembersTotalMinor = extraMembers * extraMemberMonthlyMinor * billingMonths;
  const extraProxyGbTotalMinor = extraProxyGb * extraProxyGbMonthlyMinor * billingMonths;

  const totalMonthlyMinor =
    discountedMonthlyRateMinor + extraMembers * extraMemberMonthlyMinor + extraProxyGb * extraProxyGbMonthlyMinor;
  const totalChargeMinor = baseChargeMinor + extraMembersTotalMinor + extraProxyGbTotalMinor;

  return {
    planId: canonicalId,
    billingCycle,
    currency,
    baseMonthlyRateMinor,
    discountedMonthlyRateMinor,
    billingMonths,
    baseChargeMinor,
    extraMembers,
    extraMemberMonthlyMinor,
    extraMembersTotalMinor,
    extraProxyGb,
    extraProxyGbMonthlyMinor,
    extraProxyGbTotalMinor,
    totalMonthlyMinor,
    totalChargeMinor,
    discountPercent,
  };
}

/**
 * Maps legacy and short plan IDs to canonical plan IDs.
 * Returns null if the plan ID is not recognized.
 */
export function legacyPlanIdToCanonical(legacyId: string): CanonicalPlanId | null {
  const norm = (legacyId || '').toLowerCase().trim();
  if (!norm) return 'free';
  const map: Record<string, CanonicalPlanId> = {
    'free': 'free',
    'plan_free': 'free',
    'starter': 'mahi_starter',
    'growth': 'mahi_growth',
    'ultimate': 'mahi_ultimate',
    'plan_1month': 'mahi_starter',
    'plan_6months': 'mahi_growth',
    'plan_1year': 'mahi_ultimate',
    'annual': 'mahi_ultimate',
    'yearly': 'mahi_ultimate',
    'mahi_starter': 'mahi_starter',
    'mahi_growth': 'mahi_growth',
    'mahi_ultimate': 'mahi_ultimate',
    'pro_10': 'professional_10',
    'professional_10': 'professional_10',
    'pro_25': 'professional_25',
    'professional_25': 'professional_25',
    'pro_50': 'professional_50',
    'professional_50': 'professional_50',
    'pro_100': 'professional_100',
    'professional_100': 'professional_100',
    'pro': 'professional_100',
    'trial': 'professional_100',
    'plan_pro': 'professional_100',
    'team': 'business_growth',
    'team_50': 'business_starter',
    'team_100': 'business_growth',
    'team_200': 'business_scale',
    'team_300': 'business_enterprise',
    'business': 'business_growth',
    'business_starter': 'business_starter',
    'business_growth': 'business_growth',
    'business_scale': 'business_scale',
    'business_enterprise': 'business_enterprise',
    'plan_business': 'business_growth',
    'enterprise': 'business_enterprise',
    'enterprise_custom': 'enterprise_custom',
    'plan_enterprise': 'enterprise_custom',
  };
  return map[norm] || (CANONICAL_PLAN_CATALOG[norm as CanonicalPlanId] ? (norm as CanonicalPlanId) : null);
}
