import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  resolveCapabilitiesForCanonicalPlan,
  CANONICAL_PLAN_CATALOG,
} from '../../07_BACKEND/commercial/canonical-plan-catalog.js';
import {
  assertCapability,
} from '../../08_SECURITY/freemium-guard.js';
import {
  clearCachedStatus,
  clearEncryptedSession,
  saveEncryptedSession,
  writeCachedStatus,
  CachedAccountStatus,
} from '../../08_SECURITY/account-service.js';
import { CAPABILITY_REQUIREMENTS } from '../../07_BACKEND/commercial/commercial-entitlement-service.js';

describe('PHASE 21 — Reverse-Engineered Pricing & Entitlement Wiring Verification', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(() => {
    clearCachedStatus();
    clearEncryptedSession();
  });

  describe('1. Reverse-Engineered Capabilities in Canonical Plan Catalog', () => {
    it('grants 117 C++ Native Hooks and AI Humanizer to FREE tier profiles', () => {
      const freeCaps = resolveCapabilitiesForCanonicalPlan('free');
      expect(freeCaps['stealth.nativeHooks117']).toBe(true);
      expect(freeCaps['stealth.aiHumanizer']).toBe(true);
      // Gated advanced features should be false on free
      expect(freeCaps['stealth.multiCore']).toBe(false);
      expect(freeCaps['stealth.fakeVideoKYC']).toBe(false);
      expect(freeCaps['api.localDaemon']).toBe(false);
    });

    it('unlocks Multi-Core and Fake Video KYC on Pro 50 and Pro 100', () => {
      const pro10Caps = resolveCapabilitiesForCanonicalPlan('professional_10');
      expect(pro10Caps['stealth.multiCore']).toBe(false);
      expect(pro10Caps['stealth.fakeVideoKYC']).toBe(false);

      const pro50Caps = resolveCapabilitiesForCanonicalPlan('professional_50');
      expect(pro50Caps['stealth.multiCore']).toBe(true);
      expect(pro50Caps['stealth.fakeVideoKYC']).toBe(true);
      expect(pro50Caps['api.localDaemon']).toBe(false);

      const pro100Caps = resolveCapabilitiesForCanonicalPlan('professional_100');
      expect(pro100Caps['stealth.multiCore']).toBe(true);
      expect(pro100Caps['stealth.fakeVideoKYC']).toBe(true);
      expect(pro100Caps['api.localDaemon']).toBe(true);
    });

    it('unlocks all reverse-engineered capabilities on Business tiers', () => {
      const bizCaps = resolveCapabilitiesForCanonicalPlan('business_growth');
      expect(bizCaps['stealth.nativeHooks117']).toBe(true);
      expect(bizCaps['stealth.aiHumanizer']).toBe(true);
      expect(bizCaps['stealth.multiCore']).toBe(true);
      expect(bizCaps['stealth.fakeVideoKYC']).toBe(true);
      expect(bizCaps['api.localDaemon']).toBe(true);
    });
  });

  describe('2. Freemium Guard Assertion Enforcement', () => {
    it('allows 117 C++ Native Hooks and AI Humanizer on unauthenticated/free accounts without throwing', () => {
      expect(() => assertCapability('stealth.nativeHooks117')).not.toThrow();
      expect(() => assertCapability('stealth.aiHumanizer')).not.toThrow();
    });

    it('blocks Multi-Core and Fake Video KYC when user has no active Pro/Business plan', () => {
      expect(() => assertCapability('stealth.multiCore')).toThrow(/FEATURE_NOT_INCLUDED/);
      expect(() => assertCapability('stealth.fakeVideoKYC')).toThrow(/FEATURE_NOT_INCLUDED/);
      expect(() => assertCapability('api.localDaemon')).toThrow(/FEATURE_NOT_INCLUDED/);
    });

    it('permits Multi-Core and Fake Video KYC when account has active PRO subscription', () => {
      const mockSession = {
        token: 'test_token_pro',
        account_id: 'usr_pro_001',
        email: 'pro@user.com',
        hwid: 'MAHI-TEST-HWID-001',
        created_at: Date.now(),
      };
      saveEncryptedSession(mockSession);

      const proStatus: CachedAccountStatus = {
        account_id: 'usr_pro_001',
        hwid: 'MAHI-TEST-HWID-001',
        plan: 'pro',
        profile_limit: 100,
        sync_allowed: true,
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        server_time: Date.now(),
        verified_at: Date.now(),
        sig: 'mock_sig',
      };
      writeCachedStatus(proStatus);

      expect(() => assertCapability('stealth.multiCore')).not.toThrow();
      expect(() => assertCapability('stealth.fakeVideoKYC')).not.toThrow();
      expect(() => assertCapability('api.localDaemon')).not.toThrow();
    });
  });

  describe('3. Commercial Entitlement Service Metadata Alignment', () => {
    it('registers clear human-readable names and required tiers for all new capabilities', () => {
      expect(CAPABILITY_REQUIREMENTS['stealth.nativeHooks117'].requiredTier).toBe('FREE');
      expect(CAPABILITY_REQUIREMENTS['stealth.aiHumanizer'].requiredTier).toBe('FREE');
      expect(CAPABILITY_REQUIREMENTS['stealth.multiCore'].requiredTier).toBe('PRO');
      expect(CAPABILITY_REQUIREMENTS['stealth.fakeVideoKYC'].requiredTier).toBe('PRO');
      expect(CAPABILITY_REQUIREMENTS['api.localDaemon'].requiredTier).toBe('PRO');
    });
  });
});
