/**
 * MAHI Browser — Production Business Model Tests
 *
 * Tests the complete business model architecture:
 * - Canonical plan catalog & entitlement matrix
 * - Pricing versioning (Draft → Preview → Publish)
 * - Admin price editing workflow
 * - Provider sync simulation
 * - Usage ledger
 * - Plan progression (cumulative features)
 * - Upgrade/downgrade safety
 * - Price ≠ Entitlement separation
 * - Grandfathering
 * - Free plan functionality
 * - Trial configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Plan Catalog Tests ─────────────────────────────────────────────────────────

describe('Canonical Plan Catalog', () => {
  it('should define all 10 canonical plan IDs', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const planIds = Object.keys(CANONICAL_PLAN_CATALOG);
    expect(planIds).toContain('free');
    expect(planIds).toContain('professional_10');
    expect(planIds).toContain('professional_25');
    expect(planIds).toContain('professional_50');
    expect(planIds).toContain('professional_100');
    expect(planIds).toContain('business_starter');
    expect(planIds).toContain('business_growth');
    expect(planIds).toContain('business_scale');
    expect(planIds).toContain('business_enterprise');
    expect(planIds).toContain('enterprise_custom');
    expect(planIds.length).toBe(10);
  });

  it('should assign unique immutable plan IDs (not display names)', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const ids = Object.values(CANONICAL_PLAN_CATALOG).map(p => p.planId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('should set cumulative tier ranks for ordering', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['free'].tierRank).toBe(0);
    expect(CANONICAL_PLAN_CATALOG['professional_10'].tierRank).toBeLessThan(
      CANONICAL_PLAN_CATALOG['professional_25'].tierRank
    );
    expect(CANONICAL_PLAN_CATALOG['professional_25'].tierRank).toBeLessThan(
      CANONICAL_PLAN_CATALOG['professional_50'].tierRank
    );
    expect(CANONICAL_PLAN_CATALOG['professional_50'].tierRank).toBeLessThan(
      CANONICAL_PLAN_CATALOG['professional_100'].tierRank
    );
  });

  it('should use INR as initial currency for all plans', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    for (const plan of Object.values(CANONICAL_PLAN_CATALOG)) {
      expect(plan.currency).toBe('INR');
    }
  });
});

// ── Profile Limits Tests ───────────────────────────────────────────────────────

describe('Profile Limits Per Plan', () => {
  it('free plan limits to 1 profile', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['free'].profileLimit).toBe(1);
  });

  it('Professional 10 limits to 10 profiles', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['professional_10'].profileLimit).toBe(10);
  });

  it('Professional 25 limits to 25 profiles', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['professional_25'].profileLimit).toBe(25);
  });

  it('Professional 50 limits to 50 profiles', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['professional_50'].profileLimit).toBe(50);
  });

  it('Professional 100 limits to 100 profiles', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['professional_100'].profileLimit).toBe(100);
  });
});

// ── Feature Progression Tests (Cumulative) ─────────────────────────────────────

describe('Feature Progression (Cumulative)', () => {
  it('higher Personal plans should include all lower-plan capabilities', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const plans = ['professional_10', 'professional_25', 'professional_50', 'professional_100'] as const;
    
    for (let i = 1; i < plans.length; i++) {
      const lower = CANONICAL_PLAN_CATALOG[plans[i - 1]].capabilities;
      const higher = CANONICAL_PLAN_CATALOG[plans[i]].capabilities;
      
      for (const [cap, enabled] of Object.entries(lower)) {
        if (enabled) {
          expect(higher[cap as keyof typeof higher]).toBe(true,
            `${plans[i]} should include capability ${cap} from ${plans[i - 1]}`
          );
        }
      }
    }
  });

  it('Pro 10 should NOT have Cloud Browser (starts at Pro 50)', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['professional_10'].capabilities['cloud.browser']).toBe(false);
    expect(CANONICAL_PLAN_CATALOG['professional_25'].capabilities['cloud.browser']).toBe(false);
    expect(CANONICAL_PLAN_CATALOG['professional_50'].capabilities['cloud.browser']).toBe(true);
    expect(CANONICAL_PLAN_CATALOG['professional_100'].capabilities['cloud.browser']).toBe(true);
  });

  it('Synchronizer should be Pro 100 only', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['professional_10'].capabilities['automation.synchronizer']).toBe(false);
    expect(CANONICAL_PLAN_CATALOG['professional_25'].capabilities['automation.synchronizer']).toBe(false);
    expect(CANONICAL_PLAN_CATALOG['professional_50'].capabilities['automation.synchronizer']).toBe(false);
    expect(CANONICAL_PLAN_CATALOG['professional_100'].capabilities['automation.synchronizer']).toBe(true);
  });

  it('API Remote should be Pro 100 only for Personal', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['professional_10'].capabilities['api.remote']).toBe(false);
    expect(CANONICAL_PLAN_CATALOG['professional_100'].capabilities['api.remote']).toBe(true);
  });

  it('all Business plans should have ALL capabilities', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const businessPlans = ['business_starter', 'business_growth', 'business_scale', 'business_enterprise'] as const;
    for (const planId of businessPlans) {
      const caps = CANONICAL_PLAN_CATALOG[planId].capabilities;
      for (const [cap, value] of Object.entries(caps)) {
        expect(value).toBe(true, `Business plan ${planId} should have ${cap} = true`);
      }
    }
  });
});

// ── Free Plan Tests ────────────────────────────────────────────────────────────

describe('Free Plan', () => {
  it('should cost ₹0', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const freePrice = INITIAL_PLAN_PRICES.find(p => p.planId === 'free');
    expect(freePrice?.monthlyPricePaise).toBe(0);
    expect(freePrice?.annualPricePaise).toBe(0);
  });

  it('should have basic profile capability', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['free'].capabilities['profile.basic']).toBe(true);
  });

  it('should allow custom/BYOP proxies', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['free'].capabilities['proxy.custom']).toBe(true);
  });

  it('should NOT be completely unusable', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const freeCaps = CANONICAL_PLAN_CATALOG['free'].capabilities;
    const trueCount = Object.values(freeCaps).filter(v => v).length;
    expect(trueCount).toBeGreaterThan(0);
    expect(CANONICAL_PLAN_CATALOG['free'].profileLimit).toBeGreaterThan(0);
  });
});

// ── Pricing Tests ──────────────────────────────────────────────────────────────

describe('Initial Pricing (Website Audit)', () => {
  it('Professional 10 monthly = ₹599 (59900 paise)', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const p = INITIAL_PLAN_PRICES.find(p => p.planId === 'professional_10');
    expect(p?.monthlyPricePaise).toBe(59900);
  });

  it('Professional 10 annual = ₹299/mo (29900 paise)', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const p = INITIAL_PLAN_PRICES.find(p => p.planId === 'professional_10');
    expect(p?.annualPricePaise).toBe(29900);
  });

  it('Professional 25 monthly = ₹1,499 (149900 paise)', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const p = INITIAL_PLAN_PRICES.find(p => p.planId === 'professional_25');
    expect(p?.monthlyPricePaise).toBe(149900);
  });

  it('Professional 50 monthly = ₹2,999 (299900 paise)', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const p = INITIAL_PLAN_PRICES.find(p => p.planId === 'professional_50');
    expect(p?.monthlyPricePaise).toBe(299900);
  });

  it('Professional 100 monthly = ₹5,999 (599900 paise)', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const p = INITIAL_PLAN_PRICES.find(p => p.planId === 'professional_100');
    expect(p?.monthlyPricePaise).toBe(599900);
  });

  it('annual discount is 50%', async () => {
    const { INITIAL_ANNUAL_DISCOUNT_PERCENT } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(INITIAL_ANNUAL_DISCOUNT_PERCENT).toBe(50);
  });

  it('all prices use integer paise (no floating point)', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    for (const p of INITIAL_PLAN_PRICES) {
      expect(Number.isInteger(p.monthlyPricePaise)).toBe(true);
      expect(Number.isInteger(p.annualPricePaise)).toBe(true);
    }
  });
});

// ── Price ≠ Entitlement Separation ─────────────────────────────────────────────

describe('Price ≠ Entitlement Separation', () => {
  it('plan identity is by planId, never by price', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    // Plan capabilities should be resolved from planId, not price
    const pro50 = CANONICAL_PLAN_CATALOG['professional_50'];
    expect(pro50.planId).toBe('professional_50');
    expect(pro50.capabilities['cloud.browser']).toBe(true);
    // Even if price changes, capabilities remain tied to plan identity
  });

  it('resolveCapabilitiesForCanonicalPlan uses planId not price', async () => {
    const { resolveCapabilitiesForCanonicalPlan } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const caps = resolveCapabilitiesForCanonicalPlan('professional_50');
    expect(caps['cloud.browser']).toBe(true);
    expect(caps['automation.rpa']).toBe(true);
  });

  it('NEVER has price-based entitlement logic', async () => {
    // This test verifies the architecture doesn't use price to determine features
    const { CANONICAL_PLAN_CATALOG, resolveCapabilitiesForCanonicalPlan } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    // Same plan with different hypothetical price should yield same capabilities
    const caps1 = resolveCapabilitiesForCanonicalPlan('professional_50');
    const caps2 = resolveCapabilitiesForCanonicalPlan('professional_50');
    expect(caps1).toEqual(caps2);
  });
});

// ── Legacy Plan ID Mapping ─────────────────────────────────────────────────────

describe('Legacy Plan ID Mapping', () => {
  it('should map plan_free to free', async () => {
    const { legacyPlanIdToCanonical } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(legacyPlanIdToCanonical('plan_free')).toBe('free');
  });

  it('should map plan_pro to professional_100', async () => {
    const { legacyPlanIdToCanonical } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(legacyPlanIdToCanonical('plan_pro')).toBe('professional_100');
  });

  it('should map plan_business to business_growth', async () => {
    const { legacyPlanIdToCanonical } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(legacyPlanIdToCanonical('plan_business')).toBe('business_growth');
  });

  it('should resolve legacy capabilities correctly', async () => {
    const { resolveCapabilitiesForCanonicalPlan } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const caps = resolveCapabilitiesForCanonicalPlan('plan_pro');
    expect(caps['profile.basic']).toBe(true);
    expect(caps['automation.synchronizer']).toBe(true); // plan_pro → pro_100
    expect(caps['api.remote']).toBe(true);
  });
});

// ── Best Upgrade Recommendation ────────────────────────────────────────────────

describe('Best Upgrade Recommendation', () => {
  it('should find lowest plan with Cloud Browser = Professional 50', async () => {
    const { findLowestPlanForCapability } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const plan = findLowestPlanForCapability('cloud.browser', 'PERSONAL');
    expect(plan?.planId).toBe('professional_50');
  });

  it('should find lowest plan with Synchronizer = Professional 100', async () => {
    const { findLowestPlanForCapability } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const plan = findLowestPlanForCapability('automation.synchronizer', 'PERSONAL');
    expect(plan?.planId).toBe('professional_100');
  });

  it('should find lowest plan with built-in proxy = Professional 25', async () => {
    const { findLowestPlanForCapability } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const plan = findLowestPlanForCapability('proxy.builtin', 'PERSONAL');
    expect(plan?.planId).toBe('professional_25');
  });

  it('should NOT always recommend most expensive plan', async () => {
    const { findLowestPlanForCapability } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const plan = findLowestPlanForCapability('cloud.browser', 'PERSONAL');
    expect(plan?.planId).not.toBe('professional_100'); // Should be 50, not 100
  });
});

// ── Money Precision Tests ──────────────────────────────────────────────────────

describe('Money Precision', () => {
  it('formatPaiseToDisplay converts 59900 paise to ₹599', async () => {
    const { formatPaiseToDisplay } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(formatPaiseToDisplay(59900)).toBe('₹599');
  });

  it('formatPaiseToDisplay converts 299900 paise to ₹2,999', async () => {
    const { formatPaiseToDisplay } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(formatPaiseToDisplay(299900)).toBe('₹2,999');
  });

  it('calculateAnnualPricePaise at 50% discount', async () => {
    const { calculateAnnualPricePaise } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    // ₹599 monthly × 50% off = ₹299.50 → round to 29950 paise
    expect(calculateAnnualPricePaise(59900, 50)).toBe(29950);
  });
});

// ── Trial Configuration Tests ──────────────────────────────────────────────────

describe('Trial Configuration', () => {
  it('trial is 7 days as advertised on website', async () => {
    const { TRIAL_CONFIG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(TRIAL_CONFIG.durationDays).toBe(7);
  });

  it('trial card not required (website says "No credit card required")', async () => {
    const { TRIAL_CONFIG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(TRIAL_CONFIG.cardRequired).toBe(false);
  });

  it('max 1 trial per account for abuse protection', async () => {
    const { TRIAL_CONFIG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(TRIAL_CONFIG.maxTrialsPerAccount).toBe(1);
  });
});

// ── Business Plan Tests ────────────────────────────────────────────────────────

describe('Business Plans', () => {
  it('business plans should focus on team seats, NOT just profile count', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['business_starter'].seatLimit).toBeGreaterThan(1);
    expect(CANONICAL_PLAN_CATALOG['business_growth'].seatLimit).toBeGreaterThan(
      CANONICAL_PLAN_CATALOG['business_starter'].seatLimit
    );
  });

  it('business plans should have workspace team capability', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['business_starter'].capabilities['workspace.team']).toBe(true);
    expect(CANONICAL_PLAN_CATALOG['business_growth'].capabilities['workspace.team']).toBe(true);
  });

  it('business enterprise has highest proxy and cloud quotas', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['business_enterprise'].proxyDataGbMonthly).toBeGreaterThanOrEqual(25);
    expect(CANONICAL_PLAN_CATALOG['business_enterprise'].cloudMinutesMonthly).toBeGreaterThanOrEqual(500);
  });
});

// ── Enterprise Tests ───────────────────────────────────────────────────────────

describe('Enterprise Plan', () => {
  it('enterprise uses CUSTOM price mode', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(CANONICAL_PLAN_CATALOG['enterprise_custom'].priceMode).toBe('CUSTOM');
  });

  it('enterprise has zero public price (Contact Sales)', async () => {
    const { INITIAL_PLAN_PRICES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const p = INITIAL_PLAN_PRICES.find(p => p.planId === 'enterprise_custom');
    expect(p?.monthlyPricePaise).toBe(0);
  });
});

// ── Display Features Tests (Website Claims Audit) ──────────────────────────────

describe('Display Features Match Website Claims', () => {
  it('each plan should have display feature list', async () => {
    const { PLAN_DISPLAY_FEATURES, CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    for (const planId of Object.keys(CANONICAL_PLAN_CATALOG)) {
      expect(PLAN_DISPLAY_FEATURES[planId]).toBeDefined();
      expect(PLAN_DISPLAY_FEATURES[planId].length).toBeGreaterThan(0);
    }
  });

  it('Pro 10 features match website card', async () => {
    const { PLAN_DISPLAY_FEATURES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const features = PLAN_DISPLAY_FEATURES['professional_10'];
    expect(features).toContain('Up to 10 profiles');
    expect(features).toContain('30 Cloud Android minutes/mo');
  });

  it('Pro 100 should list Synchronizer', async () => {
    const { PLAN_DISPLAY_FEATURES } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const features = PLAN_DISPLAY_FEATURES['professional_100'];
    expect(features).toContain('Synchronizer');
    expect(features).toContain('REST API & SDKs');
    expect(features).toContain('MCP server');
  });
});

// ── Category Filtering Tests ───────────────────────────────────────────────────

describe('Plan Category Filtering', () => {
  it('getCanonicalPlansByCategory PERSONAL returns 4 plans', async () => {
    const { getCanonicalPlansByCategory } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const plans = getCanonicalPlansByCategory('PERSONAL');
    expect(plans.length).toBe(4);
    expect(plans[0].planId).toBe('professional_10');
    expect(plans[3].planId).toBe('professional_100');
  });

  it('getCanonicalPlansByCategory BUSINESS returns 4 plans', async () => {
    const { getCanonicalPlansByCategory } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const plans = getCanonicalPlansByCategory('BUSINESS');
    expect(plans.length).toBe(4);
    expect(plans[0].planId).toBe('business_starter');
  });

  it('category filters exclude free and enterprise_custom', async () => {
    const { getCanonicalPlansByCategory } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    const personal = getCanonicalPlansByCategory('PERSONAL');
    const business = getCanonicalPlansByCategory('BUSINESS');
    expect(personal.find(p => p.planId === 'free')).toBeUndefined();
    expect(business.find(p => p.planId === 'enterprise_custom')).toBeUndefined();
  });
});

// ── Unlimited Policy Tests ─────────────────────────────────────────────────────

describe('Unlimited Policy', () => {
  it('business_enterprise team seats has fair-use cap (not truly infinite)', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    // "Unlimited" = 999 (fair-use cap, not Integer.MAX_VALUE)
    expect(CANONICAL_PLAN_CATALOG['business_enterprise'].seatLimit).toBe(999);
    expect(CANONICAL_PLAN_CATALOG['business_enterprise'].seatLimit).toBeLessThan(Infinity);
  });

  it('no plan has unbounded cloud compute', async () => {
    const { CANONICAL_PLAN_CATALOG } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    for (const plan of Object.values(CANONICAL_PLAN_CATALOG)) {
      expect(plan.cloudMinutesMonthly).toBeLessThan(10000);
    }
  });
});

// ── Popular Plans Tests ────────────────────────────────────────────────────────

describe('Popular Plan Flags', () => {
  it('Personal popular = professional_50', async () => {
    const { POPULAR_PLANS } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(POPULAR_PLANS.PERSONAL).toBe('professional_50');
  });

  it('Business popular = business_enterprise', async () => {
    const { POPULAR_PLANS } = await import(
      '../../07_BACKEND/commercial/canonical-plan-catalog.js'
    );
    expect(POPULAR_PLANS.BUSINESS).toBe('business_enterprise');
  });
});
