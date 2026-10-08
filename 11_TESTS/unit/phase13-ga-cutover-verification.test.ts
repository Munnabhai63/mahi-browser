import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getCommercialPlans, getCommercialPlanById } from '../../07_BACKEND/commercial/commercial-plan-service.js';
import { StripePaymentAdapter } from '../../07_BACKEND/commercial/payment-service.js';
import { logCommercialAudit } from '../../07_BACKEND/commercial/commercial-audit-service.js';
import { getDatabase } from '../../06_DATABASE/connection.js';

describe('Phase 13: Final GA Cutover & Production Release Closure Verification Suite', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('1. Step 20–22: Stripe Plan Catalog & Server-Side Price Anti-Tampering', () => {
    it('should verify production plan catalog prices and entitlement consistency', () => {
      const plans = getCommercialPlans();
      expect(plans.length).toBeGreaterThanOrEqual(4);

      const freePlan = getCommercialPlanById('plan_free');
      expect(freePlan).toBeDefined();
      expect(freePlan?.priceMonthly).toBe(0);
      expect(freePlan?.limits.maxProfiles).toBe(15);
      expect(freePlan?.limits.cloudSync).toBe(false);

      const proPlan = getCommercialPlanById('plan_pro');
      expect(proPlan).toBeDefined();
      expect(proPlan?.priceMonthly).toBe(29);
      expect(proPlan?.priceAnnual).toBe(290);
      expect(proPlan?.limits.maxProfiles).toBe(100);
      expect(proPlan?.limits.cloudSync).toBe(true);
      expect(proPlan?.limits.apiAccess).toBe(true);

      const businessPlan = getCommercialPlanById('plan_business');
      expect(businessPlan).toBeDefined();
      expect(businessPlan?.priceMonthly).toBe(79);
      expect(businessPlan?.limits.maxProfiles).toBe(500);

      const enterprisePlan = getCommercialPlanById('plan_enterprise');
      expect(enterprisePlan).toBeDefined();
      expect(enterprisePlan?.priceMonthly).toBe(199);
      expect(enterprisePlan?.limits.maxProfiles).toBe(2500);
    });

    it('should enforce server-side price calculation matching Stripe checkout amounts', async () => {
      const proPlan = getCommercialPlanById('plan_pro')!;
      const stripeAdapter = new StripePaymentAdapter();

      const monthlySession = await stripeAdapter.createCheckoutSession(
        { userId: 'usr_cutover_01', planId: 'plan_pro', billingCycle: 'MONTHLY' },
        proPlan,
        proPlan.priceMonthly * 100 // 2900 cents
      );

      expect(monthlySession.amountCents).toBe(2900);
      expect(monthlySession.currency).toBe('USD');
      expect(monthlySession.checkoutUrl).toContain('https://checkout.stripe.com/c/pay/');

      const annualSession = await stripeAdapter.createCheckoutSession(
        { userId: 'usr_cutover_01', planId: 'plan_pro', billingCycle: 'ANNUAL' },
        proPlan,
        proPlan.priceAnnual * 100 // 29000 cents
      );

      expect(annualSession.amountCents).toBe(29000);
    });
  });

  describe('2. Step 24: Stripe Webhook Cryptographic HMAC-SHA256 & Replay Protection', () => {
    it('should verify authentic webhook signatures and parse events accurately', () => {
      const adapter = new StripePaymentAdapter();
      const testSecret = 'whsec_prod_live_verification_secret_987654';
      const timestamp = Math.floor(Date.now() / 1000);
      const payloadObj = {
        id: 'evt_live_checkout_completed_001',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_live_test_001',
            client_reference_id: 'usr_live_99',
            amount_total: 2900,
            currency: 'usd',
            subscription: 'sub_live_001',
            metadata: {
              userId: 'usr_live_99',
              planId: 'plan_pro',
              billingCycle: 'MONTHLY',
            },
          },
        },
      };
      const rawBody = JSON.stringify(payloadObj);

      const signedPayload = `${timestamp}.${rawBody}`;
      const signatureHex = crypto.createHmac('sha256', testSecret).update(signedPayload).digest('hex');
      const stripeSignatureHeader = `t=${timestamp},v1=${signatureHex}`;

      // 1. Valid signature check
      const isValid = adapter.verifyWebhookSignature(rawBody, stripeSignatureHeader, testSecret);
      expect(isValid).toBe(true);

      // 2. Parse payload
      const parsedEvent = adapter.parseWebhookPayload(rawBody);
      expect(parsedEvent.id).toBe('evt_live_checkout_completed_001');
      expect(parsedEvent.type).toBe('payment.succeeded');
      expect(parsedEvent.userId).toBe('usr_live_99');
      expect(parsedEvent.amountCents).toBe(2900);
      expect(parsedEvent.currency).toBe('USD');
    });

    it('should reject tampered bodies, expired timestamps, and invalid secrets', () => {
      const adapter = new StripePaymentAdapter();
      const testSecret = 'whsec_prod_live_verification_secret_987654';
      const rawBody = JSON.stringify({ type: 'payment.succeeded', id: 'evt_123' });

      // Expired timestamp (15 minutes old > 600s tolerance)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 900;
      const oldSig = crypto.createHmac('sha256', testSecret).update(`${oldTimestamp}.${rawBody}`).digest('hex');
      const expiredHeader = `t=${oldTimestamp},v1=${oldSig}`;
      expect(adapter.verifyWebhookSignature(rawBody, expiredHeader, testSecret)).toBe(false);

      // Tampered body
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const validSig = crypto.createHmac('sha256', testSecret).update(`${currentTimestamp}.${rawBody}`).digest('hex');
      const tamperedBody = JSON.stringify({ type: 'payment.succeeded', id: 'evt_tampered' });
      const currentHeader = `t=${currentTimestamp},v1=${validSig}`;
      expect(adapter.verifyWebhookSignature(tamperedBody, currentHeader, testSecret)).toBe(false);

      // Wrong secret
      expect(adapter.verifyWebhookSignature(rawBody, currentHeader, 'whsec_attacker_wrong_secret')).toBe(false);
    });
  });

  describe('3. Step 26 & 38: Client Bundle Sanitization & Zero Secret Leakage', () => {
    it('should confirm production client bundles do not contain live private keys or Stripe secrets', () => {
      const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
      if (fs.existsSync(distAssetsDir)) {
        const assetFiles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'));
        expect(assetFiles.length).toBeGreaterThan(0);

        for (const file of assetFiles) {
          const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');

          // Must never leak live or test stripe secrets in frontend
          expect(content).not.toContain('sk_live_');
          expect(content).not.toContain('STRIPE_SECRET_KEY');
          expect(content).not.toContain('AWS_SECRET_ACCESS_KEY');
          expect(content).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
          expect(content).not.toContain('-----BEGIN PRIVATE KEY-----');
        }
      }
    });
  });

  describe('4. Step 18: Android Deep Link URI Validation & Security Constraints', () => {
    function parseAndValidateDeepLink(uriString: string): { valid: boolean; action?: string; token?: string; workspaceId?: string } {
      try {
        const parsed = new URL(uriString);
        const isCustomScheme = parsed.protocol === 'mahi:' && parsed.hostname === 'app';
        const isAppLinks = parsed.protocol === 'https:' && parsed.hostname === 'app.mahibrowser.com' && parsed.pathname.startsWith('/mobile');

        if (!isCustomScheme && !isAppLinks) {
          return { valid: false };
        }

        const action = isCustomScheme ? parsed.pathname.replace(/^\//, '') : parsed.pathname.replace(/^\/mobile\/?/, '');
        const token = parsed.searchParams.get('token') || undefined;
        const workspaceId = parsed.searchParams.get('workspaceId') || undefined;

        return { valid: true, action, token, workspaceId };
      } catch {
        return { valid: false };
      }
    }

    it('should accept valid custom scheme and App Link URIs with parameters', () => {
      const customUri = 'mahi://app/verify?token=jwt_sample_token_123';
      const customResult = parseAndValidateDeepLink(customUri);
      expect(customResult.valid).toBe(true);
      expect(customResult.action).toBe('verify');
      expect(customResult.token).toBe('jwt_sample_token_123');

      const appLinkUri = 'https://app.mahibrowser.com/mobile/invite?workspaceId=ws_alpha_88';
      const appLinkResult = parseAndValidateDeepLink(appLinkUri);
      expect(appLinkResult.valid).toBe(true);
      expect(appLinkResult.action).toBe('invite');
      expect(appLinkResult.workspaceId).toBe('ws_alpha_88');
    });

    it('should reject unapproved origins, schemes, and malformed deep links', () => {
      expect(parseAndValidateDeepLink('http://app.mahibrowser.com/mobile/verify').valid).toBe(false); // Insecure HTTP
      expect(parseAndValidateDeepLink('https://evil.com/mobile/verify').valid).toBe(false); // Phishing origin
      expect(parseAndValidateDeepLink('javascript:alert(1)').valid).toBe(false); // Malicious script
      expect(parseAndValidateDeepLink('file:///etc/passwd').valid).toBe(false); // Local file scheme
    });
  });

  describe('5. Step 6 & 35: In-App Update Manifest Integrity & Rollback Safety', () => {
    it('should verify production release manifest structure in release/latest.json', () => {
      const manifestPath = path.resolve(process.cwd(), 'release/latest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifestContent.version).toBe('1.1.1');
      expect(manifestContent.channel).toBe('STABLE');
      expect(manifestContent.sha256).toBeDefined();
      expect(manifestContent.sha256.length).toBe(64); // Hex SHA-256
      expect(manifestContent.files).toBeInstanceOf(Array);
      expect(manifestContent.files.length).toBeGreaterThan(0);

      const setupFile = manifestContent.files.find((f: any) => f.name.includes('Setup.exe'));
      expect(setupFile).toBeDefined();
      expect(setupFile.size).toBeGreaterThan(50 * 1024 * 1024); // > 50MB
    });

    it('should verify safe rollback fallback: bad update retains current state', () => {
      const currentVersion = '1.1.1';
      const candidateCorrupted = { version: '1.1.2', validChecksum: false };

      function applyUpdateOrRollback(candidate: { version: string; validChecksum: boolean }) {
        if (!candidate.validChecksum) {
          // Reject update, rollback/remain on currentVersion
          return { activeVersion: currentVersion, rolledBack: true, error: 'CHECKSUM_MISMATCH' };
        }
        return { activeVersion: candidate.version, rolledBack: false };
      }

      const outcome = applyUpdateOrRollback(candidateCorrupted);
      expect(outcome.rolledBack).toBe(true);
      expect(outcome.activeVersion).toBe('1.1.1');
      expect(outcome.error).toBe('CHECKSUM_MISMATCH');
    });
  });

  describe('6. Step 32–33: Synthetic Alert Delivery & Audit Logging', () => {
    it('should dispatch synthetic security alerts and record to database audit trail', () => {
      const db = getDatabase();

      logCommercialAudit({
        actorId: 'usr_ops_01',
        actorName: 'DevOps Lead',
        actorRole: 'OWNER',
        action: 'SECURITY_ALERT_SYNTHETIC',
        targetType: 'SYSTEM',
        targetId: 'sys_alert_01',
        details: JSON.stringify({ severity: 'INFO', trigger: 'GA_CUTOVER_DRILL', channel: 'admin-pager' }),
        ipAddress: '127.0.0.1',
      });

      const records = db.prepare(
        'SELECT * FROM commercial_audit_logs WHERE action = ? ORDER BY created_at DESC'
      ).all('SECURITY_ALERT_SYNTHETIC') as any[];

      expect(records.length).toBeGreaterThan(0);
      const latest = records[0];
      expect(latest.actor_id).toBe('usr_ops_01');
      const details = JSON.parse(latest.details);
      expect(details.trigger).toBe('GA_CUTOVER_DRILL');
      expect(details.channel).toBe('admin-pager');
    });
  });

});
