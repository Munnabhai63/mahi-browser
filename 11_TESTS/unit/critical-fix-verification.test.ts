import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { assertCanCreateProfile, hasValidLicense } from '../../08_SECURITY/freemium-guard.js';
import { setDynamicPriceForTesting, getDynamicPrice, fetchDynamicPrice } from '../../08_SECURITY/price-service.js';

describe('Critical Fix Verification Suite', () => {
  it('TEST 1: Verifies Fresh UserData Launch - Zero Blocking Gates in Codebase', () => {
    const appTsx = fs.readFileSync(path.resolve('01_UI/App.tsx'), 'utf8');
    const accountStoreTs = fs.readFileSync(path.resolve('01_UI/stores/useAccountStore.ts'), 'utf8');
    const welcomeWizardTs = fs.readFileSync(path.resolve('01_UI/components/WelcomeWizardModal.tsx'), 'utf8');

    // 1. Root CommercialUserModal check
    const hasRootCommercialModal = appTsx.includes('<CommercialUserModal');
    expect(hasRootCommercialModal).toBe(false);

    // 2. Initial state of modal in useAccountStore
    expect(accountStoreTs.includes('isAccountModalOpen: false')).toBe(true);

    // 3. Rehydration check
    expect(accountStoreTs.includes('state.isAccountModalOpen = true')).toBe(false);

    // 4. WelcomeWizard auto popup check
    expect(welcomeWizardTs.includes('setIsOpen(true);')).toBe(false);
  });

  it('TEST 2: Verifies 15 Profiles Limit & 16th Profile Throws Exact Dynamic Toast Message', () => {
    if (!hasValidLicense()) {
      setDynamicPriceForTesting(599);

      let caughtMsg = '';
      try {
        assertCanCreateProfile(16);
      } catch (err: any) {
        caughtMsg = err.message;
      }

      expect(caughtMsg).toBe(
        'Free plan limit reached (15 profiles). Upgrade MAHI PRO (₹599/year) for 100 profiles.'
      );
    }
  });

  it('TEST 3: Dynamic Price Test (599 -> 499 -> 599)', () => {
    if (!hasValidLicense()) {
      // Test dynamic price 499
      setDynamicPriceForTesting(499);
      expect(getDynamicPrice()).toBe(499);

      let caughtMsg499 = '';
      try {
        assertCanCreateProfile(16);
      } catch (err: any) {
        caughtMsg499 = err.message;
      }
      expect(caughtMsg499).toBe(
        'Free plan limit reached (15 profiles). Upgrade MAHI PRO (₹499/year) for 100 profiles.'
      );

      // Restore to 599
      setDynamicPriceForTesting(599);
      expect(getDynamicPrice()).toBe(599);

      let caughtMsg599 = '';
      try {
        assertCanCreateProfile(16);
      } catch (err: any) {
        caughtMsg599 = err.message;
      }
      expect(caughtMsg599).toBe(
        'Free plan limit reached (15 profiles). Upgrade MAHI PRO (₹599/year) for 100 profiles.'
      );
    }
  });

  it('TEST 4: Remote Price Fetch from https://mahibrowser.com/content.json', async () => {
    const fetchedPrice = await fetchDynamicPrice();
    expect(typeof fetchedPrice).toBe('number');
    expect(fetchedPrice).toBeGreaterThan(0);
  });
});
