import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { initSqlEngine, setCustomDatabasePath, getDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  calculateAuthoritativeOrderTotal,
  resolveCapabilitiesForCanonicalPlan,
  resolveSubscriptionDurationDays,
  normalizeBillingCycle,
} from '../../07_BACKEND/commercial/canonical-plan-catalog.js';
import { paymentService, YoupiPgPaymentAdapter } from '../../07_BACKEND/commercial/payment-service.js';
import { registerUser } from '../../07_BACKEND/commercial/commercial-auth-service.js';
import {
  evaluateUserEntitlements,
  canLaunchProfile,
} from '../../07_BACKEND/commercial/commercial-entitlement-service.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { createProxy } from '../../02_BROWSER/services/proxy-service.js';
import { assertCanCreateProxy, getProxyLimitsInfo } from '../../08_SECURITY/freemium-guard.js';
import { getUserSyncUsage, createUploadSession } from '../../07_BACKEND/services/cloud-profile-service.js';
import { sanitizeSafeRedirect } from '../../landing/lib/redirect.js';

function createPaidSubscriptionForUser(params: {
  userId: string;
  email: string;
  planId: string;
  billingCycle: string;
  durationDays: number;
}): void {
  const db = getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + params.durationDays * 86400000);
  db.prepare(`
    INSERT OR IGNORE INTO auth_users (
      id, email, normalized_email, password_hash, salt, name, plan_id, profile_quota, created_at, updated_at
    ) VALUES (?, ?, ?, 'hash', 'salt', 'Test User', ?, 100, ?, ?)
  `).run(params.userId, params.email, params.email.toLowerCase(), params.planId, nowIso, nowIso);
  db.prepare(`UPDATE commercial_users SET plan_id = ? WHERE id = ?`).run(params.planId, params.userId);
  db.prepare(`
    INSERT INTO commercial_subscriptions (
      id, user_id, plan_id, status, billing_cycle, starts_at, expires_at, payment_provider, created_at
    ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, 'youpi_pg', ?)
  `).run(
    `sub_${crypto.randomUUID()}`,
    params.userId,
    params.planId,
    params.billingCycle,
    nowIso,
    expiresAt.toISOString(),
    nowIso
  );
}

describe('Pricing, Billing, Redirect & Runtime Quota Remediation Suite', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-pricing-quota-fixes-'));
    setCustomDatabasePath(path.join(tempDir, 'pricing-fixes-test.sqlite'));
    await initSqlEngine();
    await initializeDatabase();
  });

  afterAll(() => {
    vi.restoreAllMocks();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    const db = getDatabase();
    db.prepare('DELETE FROM commercial_billing_invoices').run();
    db.prepare('DELETE FROM commercial_payments').run();
    db.prepare('DELETE FROM commercial_subscriptions').run();
    db.prepare('DELETE FROM commercial_devices').run();
    db.prepare('DELETE FROM commercial_users').run();
    db.prepare('DELETE FROM cloud_sync_upload_sessions').run();
    db.prepare('DELETE FROM cloud_profiles').run();
    db.prepare('DELETE FROM auth_users').run();
    db.prepare('DELETE FROM proxies').run();
    db.prepare('DELETE FROM profiles').run();
  });

  describe('1. Authoritative Billing Amounts (Ultimate ₹1,499 / $24 & Growth ₹999 / $15)', () => {
    it('calculates exact fixed-term INR paise and USD cents without double-discounting', () => {
      const ultInr = calculateAuthoritativeOrderTotal({
        planId: 'mahi_ultimate',
        billingCycle: 'ANNUAL',
        currency: 'INR',
      });
      expect(ultInr.totalChargeMinor).toBe(149900);

      const ultUsd = calculateAuthoritativeOrderTotal({
        planId: 'ultimate',
        billingCycle: 'ANNUAL',
        currency: 'USD',
      });
      expect(ultUsd.totalChargeMinor).toBe(2400);

      const growthInr = calculateAuthoritativeOrderTotal({
        planId: 'mahi_growth',
        billingCycle: 'SEMI_ANNUAL',
        currency: 'INR',
      });
      expect(growthInr.totalChargeMinor).toBe(99900);

      const growthUsd = calculateAuthoritativeOrderTotal({
        planId: 'growth',
        billingCycle: 'SEMI_ANNUAL',
        currency: 'USD',
      });
      expect(growthUsd.totalChargeMinor).toBe(1500);

      const starterInr = calculateAuthoritativeOrderTotal({
        planId: 'mahi_starter',
        billingCycle: 'MONTHLY',
        currency: 'INR',
      });
      expect(starterInr.totalChargeMinor).toBe(59900);

      const starterUsd = calculateAuthoritativeOrderTotal({
        planId: 'starter',
        billingCycle: 'MONTHLY',
        currency: 'USD',
      });
      expect(starterUsd.totalChargeMinor).toBe(900);
    });

    it('charges exact ₹1,499 (149900 paise) via YouPI-PG and manual UPI submit, and $24 (2400 cents) via Stripe', async () => {
      const reg = registerUser({ email: `ult-${Date.now()}@test.com`, password: 'Password123!' });
      const userId = reg.user!.id;

      const youpiSession = await paymentService.createCheckoutSession({
        userId,
        planId: 'mahi_ultimate',
        billingCycle: 'ANNUAL',
        provider: 'youpi_pg',
        currency: 'INR',
      });
      expect(youpiSession.amountCents).toBe(149900);

      const stripeSession = await paymentService.createCheckoutSession({
        userId,
        planId: 'ultimate',
        billingCycle: 'ANNUAL',
        provider: 'stripe',
        currency: 'USD',
      });
      expect(stripeSession.amountCents).toBe(2400);

      const manualSubmit = await paymentService.submitManualUpiPayment({
        userId,
        planId: 'ultimate',
        billingCycle: 'ANNUAL',
        utr: `UTR${Date.now()}1`,
      });
      expect(manualSubmit.status).toBe('PENDING_VERIFICATION');
      expect(manualSubmit.amountPaise).toBe(149900);
    });
  });

  describe('2. Exact Term Durations (Starter 30d/90d, Growth 180d, Ultimate 365d)', () => {
    it('normalizes SEMI_ANNUAL / default cycles and maps exact term durations', () => {
      expect(normalizeBillingCycle('SEMI_ANNUAL', 'mahi_growth')).toBe('SEMI_ANNUAL');
      expect(normalizeBillingCycle(undefined, 'growth')).toBe('SEMI_ANNUAL');
      expect(resolveSubscriptionDurationDays('mahi_starter', 'MONTHLY')).toBe(30);
      expect(resolveSubscriptionDurationDays('mahi_starter', 'QUARTERLY')).toBe(90);
      expect(resolveSubscriptionDurationDays('mahi_growth', 'SEMI_ANNUAL')).toBe(180);
      expect(resolveSubscriptionDurationDays('mahi_ultimate', 'ANNUAL')).toBe(365);
    });

    it('grants 180 days on Growth UPI approval and 365 days on Ultimate UPI approval', async () => {
      const admin = { id: 'admin-1', name: 'Admin', role: 'OWNER' };

      const regGrowth = registerUser({ email: `growth-${Date.now()}@test.com`, password: 'Password123!' });
      const growthSubmit = await paymentService.submitManualUpiPayment({
        userId: regGrowth.user!.id,
        planId: 'growth',
        billingCycle: 'SEMI_ANNUAL',
        utr: `UTRGROWTH${Date.now()}`,
      });
      expect(growthSubmit.amountPaise).toBe(99900);
      await paymentService.approveManualPayment(growthSubmit.paymentId, admin);
      const growthSub = paymentService.getUserSubscription(regGrowth.user!.id);
      expect(growthSub).not.toBeNull();
      const growthDays = Math.round(
        (new Date(growthSub!.expiresAt).getTime() - new Date(growthSub!.startsAt).getTime()) / 86400000
      );
      expect(growthDays).toBe(180);
      expect(growthSub!.billingCycle).toBe('SEMI_ANNUAL');

      const regUlt = registerUser({ email: `ultdur-${Date.now()}@test.com`, password: 'Password123!' });
      const ultSubmit = await paymentService.submitManualUpiPayment({
        userId: regUlt.user!.id,
        planId: 'mahi_ultimate',
        billingCycle: 'ANNUAL',
        utr: `UTRULT${Date.now()}`,
      });
      await paymentService.approveManualPayment(ultSubmit.paymentId, admin);
      const ultSub = paymentService.getUserSubscription(regUlt.user!.id);
      expect(ultSub).not.toBeNull();
      const ultDays = Math.round(
        (new Date(ultSub!.expiresAt).getTime() - new Date(ultSub!.startsAt).getTime()) / 86400000
      );
      expect(ultDays).toBe(365);
    });
  });

  describe('3. Capability Aliases & Runtime Quotas (Concurrent Windows, Proxies, Cloud Backup)', () => {
    it('maps starter / growth / ultimate aliases without falling back to FREE_CAPABILITIES', () => {
      const starterCaps = resolveCapabilitiesForCanonicalPlan('starter');
      expect(starterCaps).toEqual(resolveCapabilitiesForCanonicalPlan('mahi_starter'));
      expect(starterCaps['profile.multiple']).toBe(true);
      expect(starterCaps['advanced.fingerprint']).toBe(true);
      expect(starterCaps['proxy.custom']).toBe(true);
      expect(starterCaps['cloud.sync']).toBe(false);

      const growthCaps = resolveCapabilitiesForCanonicalPlan('growth');
      expect(growthCaps).toEqual(resolveCapabilitiesForCanonicalPlan('mahi_growth'));
      expect(growthCaps['cloud.sync']).toBe(true);
      expect(growthCaps['automation.rpa']).toBe(true);
      expect(growthCaps['automation.cookieWarmer']).toBe(true);

      const ultimateCaps = resolveCapabilitiesForCanonicalPlan('ultimate');
      expect(ultimateCaps).toEqual(resolveCapabilitiesForCanonicalPlan('mahi_ultimate'));
      expect(ultimateCaps['api.localDaemon']).toBe(true);
      expect(ultimateCaps['automation.synchronizer']).toBe(true);
      expect(ultimateCaps['cloud.sync']).toBe(true);
    });

    it('enforces canLaunchProfile (3 / 10 / 25) and blocks ProcessManager.startProfile at cap', async () => {
      const starterEmail = `launch-s-${Date.now()}@test.com`;
      const starterReg = registerUser({ email: starterEmail, password: 'Password123!' });
      const starterId = starterReg.user!.id;
      createPaidSubscriptionForUser({ userId: starterId, email: starterEmail, planId: 'mahi_starter', billingCycle: 'MONTHLY', durationDays: 30 });

      expect(canLaunchProfile(starterId, 2).allowed).toBe(true);
      const starterBlock = canLaunchProfile(starterId, 3);
      expect(starterBlock.allowed).toBe(false);
      expect(starterBlock.message).toContain('(3/3)');

      const growthEmail = `launch-g-${Date.now()}@test.com`;
      const growthReg = registerUser({ email: growthEmail, password: 'Password123!' });
      const growthId = growthReg.user!.id;
      createPaidSubscriptionForUser({ userId: growthId, email: growthEmail, planId: 'mahi_growth', billingCycle: 'SEMI_ANNUAL', durationDays: 180 });
      expect(canLaunchProfile(growthId, 9).allowed).toBe(true);
      const growthBlock = canLaunchProfile(growthId, 10);
      expect(growthBlock.allowed).toBe(false);
      expect(growthBlock.message).toContain('(10/10)');

      const ultEmail = `launch-u-${Date.now()}@test.com`;
      const ultReg = registerUser({ email: ultEmail, password: 'Password123!' });
      const ultId = ultReg.user!.id;
      createPaidSubscriptionForUser({ userId: ultId, email: ultEmail, planId: 'mahi_ultimate', billingCycle: 'ANNUAL', durationDays: 365 });
      expect(canLaunchProfile(ultId, 24).allowed).toBe(true);
      const ultBlock = canLaunchProfile(ultId, 25);
      expect(ultBlock.allowed).toBe(false);
      expect(ultBlock.message).toContain('(25/25)');

      const profile = createProfile({ name: 'Starter Concurrent Test', ownerId: starterId });
      vi.spyOn(processManager, 'getRunningCount').mockReturnValue(3);
      const startRes = await processManager.startProfile(profile.id);
      expect(startRes.success).toBe(false);
      expect(startRes.code).toBe('CONCURRENT_LIMIT_REACHED');
      expect(startRes.error).toContain('(3/3)');
    });

    it('enforces 25 Custom Proxy Slots on Starter and unlimited on Growth/Ultimate', () => {
      const starterEmail = `px-s-${Date.now()}@test.com`;
      const starterReg = registerUser({ email: starterEmail, password: 'Password123!' });
      const starterId = starterReg.user!.id;
      createPaidSubscriptionForUser({ userId: starterId, email: starterEmail, planId: 'mahi_starter', billingCycle: 'MONTHLY', durationDays: 30 });

      expect(getProxyLimitsInfo(starterId).maxProxies).toBe(25);
      for (let i = 0; i < 25; i++) {
        createProxy({
          name: `Starter-Proxy-${i}`,
          protocol: 'http',
          host: '127.0.0.1',
          port: 8000 + i,
          ownerId: starterId,
        } as any);
      }

      expect(() => assertCanCreateProxy(1, starterId)).toThrow(/Custom proxy slot limit reached \(25 slots\)/);
      expect(() =>
        createProxy({
          name: 'Starter-Proxy-26',
          protocol: 'http',
          host: '127.0.0.1',
          port: 9026,
          ownerId: starterId,
        } as any)
      ).toThrow(/25 slots/);

      const growthEmail = `px-g-${Date.now()}@test.com`;
      const growthReg = registerUser({ email: growthEmail, password: 'Password123!' });
      const growthId = growthReg.user!.id;
      createPaidSubscriptionForUser({ userId: growthId, email: growthEmail, planId: 'mahi_growth', billingCycle: 'SEMI_ANNUAL', durationDays: 180 });
      expect(getProxyLimitsInfo(growthId).maxProxies).toBe(-1);
      expect(() => assertCanCreateProxy(1, growthId)).not.toThrow();
    });

    it('enforces 25 Encrypted Cloud Backup Profiles on Growth, blocks Starter (0), allows >25 on Ultimate', async () => {
      const starterEmail = `cs-s-${Date.now()}@test.com`;
      const starterReg = registerUser({ email: starterEmail, password: 'Password123!' });
      const starterId = starterReg.user!.id;
      createPaidSubscriptionForUser({ userId: starterId, email: starterEmail, planId: 'mahi_starter', billingCycle: 'MONTHLY', durationDays: 30 });

      expect(getUserSyncUsage(starterId).max_profiles).toBe(0);
      await expect(
        createUploadSession(starterId, {
          localProfileId: 'prof-starter-1',
          profileName: 'Blocked Backup',
          baseVersion: 0,
          expectedSize: 1024,
          expectedChecksum: 'chk',
          encryptedDataKey: 'k',
          iv: 'iv',
          authTag: 'tag',
          deviceId: 'dev-1',
        })
      ).rejects.toThrow(/Maximum allowed cloud profiles limit reached \(0 profiles\)/);

      const growthEmail = `cs-g-${Date.now()}@test.com`;
      const growthReg = registerUser({ email: growthEmail, password: 'Password123!' });
      const growthId = growthReg.user!.id;
      createPaidSubscriptionForUser({ userId: growthId, email: growthEmail, planId: 'mahi_growth', billingCycle: 'SEMI_ANNUAL', durationDays: 180 });
      expect(getUserSyncUsage(growthId).max_profiles).toBe(25);

      const db = getDatabase();
      const nowIso = new Date().toISOString();
      for (let i = 0; i < 25; i++) {
        db.prepare(`
          INSERT INTO cloud_profiles (id, owner_id, local_profile_id, name, current_version, storage_bytes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, 1024, 'ACTIVE', ?, ?)
        `).run(`cp_${i}`, growthId, `local_p_${i}`, `CloudProfile ${i}`, nowIso, nowIso);
      }

      await expect(
        createUploadSession(growthId, {
          localProfileId: 'local_p_26',
          profileName: 'Growth 26th Profile',
          baseVersion: 0,
          expectedSize: 1024,
          expectedChecksum: 'chk26',
          encryptedDataKey: 'k',
          iv: 'iv',
          authTag: 'tag',
          deviceId: 'dev-1',
        })
      ).rejects.toThrow(/Maximum allowed cloud profiles limit reached \(25 profiles\)/);

      const ultEmail = `cs-u-${Date.now()}@test.com`;
      const ultReg = registerUser({ email: ultEmail, password: 'Password123!' });
      const ultId = ultReg.user!.id;
      createPaidSubscriptionForUser({ userId: ultId, email: ultEmail, planId: 'mahi_ultimate', billingCycle: 'ANNUAL', durationDays: 365 });
      expect(getUserSyncUsage(ultId).max_profiles).toBe(1000000);
    });
  });

  describe('4. Safe Redirects & Paid Intent Protection', () => {
    it('allows safe /pricing redirects with query strings and blocks open redirects', () => {
      expect(sanitizeSafeRedirect('/pricing?plan=mahi_ultimate&currency=USD&autoCheckout=1')).toBe(
        '/pricing?plan=mahi_ultimate&currency=USD&autoCheckout=1'
      );
      expect(sanitizeSafeRedirect('/dashboard')).toBe('/dashboard');
      expect(sanitizeSafeRedirect('https://evil.example/steal-token')).toBeNull();
      expect(sanitizeSafeRedirect('//evil.example/pricing')).toBeNull();
      expect(sanitizeSafeRedirect('javascript:alert(1)')).toBeNull();
      expect(sanitizeSafeRedirect('/unknown-internal-route')).toBeNull();
    });

    it('keeps paid signup intent on free tier until payment succeeds', () => {
      const reg = registerUser({
        email: `paid-intent-${Date.now()}@test.com`,
        password: 'Password123!',
        planId: 'mahi_ultimate',
        billingCycle: 'ANNUAL',
        intent: 'paid',
      });
      expect(reg.success).toBe(true);
      expect(reg.user?.planId).toBe('plan_free');
      const ent = evaluateUserEntitlements(reg.user!.id);
      expect(ent.plan.tier).toBe('FREE');
      expect(ent.limits.maxProfiles).toBe(15);
    });
  });

  describe('5. USDT (TRC-20) Crypto Submission & OviPay Webhook Correlation', () => {
    it('validates 64-char TRC-20 TX hashes, charges exact USD cents, blocks duplicates, and activates Growth 180d on approval', async () => {
      const reg = registerUser({ email: `usdt-${Date.now()}@test.com`, password: 'Password123!' });
      const userId = reg.user!.id;

      await expect(
        paymentService.submitManualCryptoPayment({
          userId,
          planId: 'growth',
          billingCycle: 'SEMI_ANNUAL',
          txHash: 'too-short',
        })
      ).rejects.toThrow(/INVALID_TX_HASH/);

      const txHash = 'a'.repeat(64);
      const subRes = await paymentService.submitManualCryptoPayment({
        userId,
        planId: 'growth',
        billingCycle: 'SEMI_ANNUAL',
        txHash,
      });
      expect(subRes.status).toBe('PENDING_VERIFICATION');
      expect(subRes.amountCents).toBe(1500);
      expect(subRes.currency).toBe('USD');
      expect(subRes.walletAddress).toBe('TPerRUMbJtNSmcRoBcQt1PpNpYCrEd5ziA');

      await expect(
        paymentService.submitManualCryptoPayment({
          userId,
          planId: 'growth',
          billingCycle: 'SEMI_ANNUAL',
          txHash,
        })
      ).rejects.toThrow(/TX_HASH_ALREADY_EXISTS/);

      const admin = { id: 'admin-crypto', name: 'Admin', role: 'OWNER' };
      await paymentService.approveManualPayment(subRes.paymentId, admin);
      const activeSub = paymentService.getUserSubscription(userId);
      expect(activeSub).not.toBeNull();
      expect(activeSub!.planId).toBe('mahi_growth');
      expect(activeSub!.paymentProvider).toBe('manual_usdt_trc20');
      const days = Math.round(
        (new Date(activeSub!.expiresAt).getTime() - new Date(activeSub!.startsAt).getTime()) / 86400000
      );
      expect(days).toBe(180);
    });

    it('correlates OviPay webhooks without metadata back to the pending checkout order', async () => {
      const reg = registerUser({ email: `ovipay-${Date.now()}@test.com`, password: 'Password123!' });
      const userId = reg.user!.id;

      const checkout = await paymentService.createCheckoutSession(
        {
          userId,
          planId: 'mahi_ultimate',
          billingCycle: 'ANNUAL',
          currency: 'INR',
          idempotencyKey: `ovi_order_${Date.now()}`,
        },
        'youpi_pg'
      );

      const secret = 'whsec_test_ovipay_correlation';
      const payload = JSON.stringify({
        event: 'SUCCESS',
        orderId: checkout.orderId,
        paymentId: checkout.sessionId,
        amount: 1499,
        amountPaise: 149900,
        currency: 'INR',
        utr: '412345678901',
        status: 'SUCCESS',
        metadata: null,
        timestamp: new Date().toISOString(),
      });
      const sig = new YoupiPgPaymentAdapter().signPayload(payload, secret);

      const whRes = await paymentService.handleWebhook('youpi_pg', payload, sig, { secret });
      expect(whRes.success).toBe(true);
      const sub = paymentService.getUserSubscription(userId);
      expect(sub).not.toBeNull();
      expect(sub!.planId).toBe('mahi_ultimate');
      expect(sub!.billingCycle).toBe('ANNUAL');
    });
  });
});
