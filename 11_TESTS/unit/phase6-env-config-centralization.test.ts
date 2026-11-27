import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  cleanUrl,
  getSiteConfig,
  siteConfig,
  websiteUrl,
  appUrl,
  apiUrl,
  getDefaultUpdateFeedUrl,
  getContentJsonUrl,
  getTrustedSiteOrigins,
  safeJsonLd,
} from '../../10_CONFIG/shared/site-config.js';
import {
  getRuntimeContactConfig,
  getAuthoritativeContactConfig,
  CONTACT_CONFIG,
  buildWhatsAppLink,
} from '../../10_CONFIG/contact-config.js';
import { BRAND_CONFIG } from '../../10_CONFIG/brand-config.js';
import { registerCentralUser, requestPasswordReset } from '../../05_AUTH/central-auth-service.js';
import { DevelopmentEmailProvider, setEmailProvider } from '../../05_AUTH/email-service.js';
import { createTeamWorkspace, inviteWorkspaceMember } from '../../07_BACKEND/services/team-workspace-service.js';
import { classifySupportQuery } from '../../07_BACKEND/commercial/support-ticket-service.js';
import { isSafeInternalUrl } from '../../07_BACKEND/commercial/google-oauth-service.js';
import { sanitizeFeedUrl } from '../../07_BACKEND/services/updater-service.js';
import { SimulationPaymentAdapter, YoupiPgPaymentAdapter } from '../../07_BACKEND/commercial/payments/payment-adapters.js';
import { paymentService } from '../../07_BACKEND/commercial/payment-service.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { validateCloudEnv, CloudEnvError } from '../../07_BACKEND/utils/cloud-env.js';

function mockHttpRequest(method: string, url: string, headers: Record<string, string> = {}) {
  const req = Object.assign(new http.IncomingMessage(null as any), {
    method,
    url,
    headers: {
      host: '127.0.0.1:8989',
      ...headers,
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  });

  let resData = '';
  let statusCode = 200;
  const setHeaders: Record<string, string> = {};
  const res = Object.assign(new http.ServerResponse(req), {
    writeHead: (code: number, headersMap?: any) => {
      statusCode = code;
      if (headersMap) {
        Object.entries(headersMap).forEach(([k, v]) => {
          setHeaders[k.toLowerCase()] = String(v);
        });
      }
      return res;
    },
    setHeader: (name: string, value: any) => {
      setHeaders[name.toLowerCase()] = String(value);
      return res;
    },
    getHeader: (name: string) => setHeaders[name.toLowerCase()],
    end: (chunk?: any) => {
      if (chunk) resData += chunk.toString();
      return res;
    },
  });

  process.nextTick(() => {
    req.emit('end');
  });

  return {
    req,
    res,
    getResult: () => ({
      statusCode,
      json: resData ? JSON.parse(resData) : null,
      headers: setHeaders,
    }),
  };
}

describe('Phase 6: Centralized URL & Env-Driven Contact/Payment Config (6A & 6B)', () => {
  let tempDir: string;
  let envSnapshot: Record<string, string | undefined>;
  let devEmailProvider: DevelopmentEmailProvider;

  const ENV_KEYS = [
    'NODE_ENV',
    'WEBSITE_URL',
    'MAHI_WEBSITE_URL',
    'NEXT_PUBLIC_WEBSITE_URL',
    'APP_URL',
    'MAHI_APP_URL',
    'NEXT_PUBLIC_APP_URL',
    'API_URL',
    'MAHI_API_URL',
    'MAHI_ADMIN_URL',
    'COMMERCIAL_API_URL',
    'NEXT_PUBLIC_API_URL',
    'MAHI_UPDATE_FEED_URL',
    'MAHI_CONTENT_JSON_URL',
    'BUSINESS_EMAIL',
    'SUPPORT_EMAIL',
    'BILLING_EMAIL',
    'SUPPORT_ESCALATION_EMAIL',
    'WHATSAPP_NUMBER',
    'SUPPORT_WHATSAPP',
    'UPI_ID',
    'PAYMENT_UPI_ID',
    'UPI_ACCOUNT_HOLDER',
    'PAYMENT_UPI_HOLDER',
    'USDT_ADDRESS',
    'PAYMENT_USDT_ADDRESS',
    'USDT_NETWORK',
    'PAYMENT_USDT_NETWORK',
    'USDT_ENABLED',
    'PAYMENT_USDT_ENABLED',
  ] as const;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase6-env-'));
    setCustomDatabasePath(path.join(tempDir, 'phase6.sqlite'));
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    envSnapshot = {};
    for (const key of ENV_KEYS) {
      envSnapshot[key] = process.env[key];
      delete process.env[key];
    }
    process.env.NODE_ENV = envSnapshot.NODE_ENV || 'test';
    devEmailProvider = new DevelopmentEmailProvider();
    setEmailProvider(devEmailProvider);
    devEmailProvider.clear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (envSnapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = envSnapshot[key];
      }
    }
  });

  describe('Sub-Step 6A: Unified siteConfig, Url Builders & Backend Domain Overrides', () => {
    it('resolves safe local/dev defaults when NODE_ENV=development and overrides dynamically via env', () => {
      process.env.NODE_ENV = 'development';
      const devCfg = getSiteConfig();
      expect(devCfg.websiteUrl).toBe('http://localhost:3000');
      expect(devCfg.appUrl).toBe('http://localhost:5173');
      expect(devCfg.apiUrl).toBe('http://localhost:8989');
      expect(devCfg.supportEmail).toBe('mahiverse.official@gmail.com');

      // Override with trailing slashes and verify live getters + path builders normalize cleanly
      process.env.WEBSITE_URL = 'https://staging.mahibrowser.com///';
      process.env.APP_URL = 'https://staging-app.mahibrowser.com/';
      process.env.API_URL = 'https://staging-api.mahibrowser.com/';
      process.env.SUPPORT_EMAIL = 'staging-support@mahibrowser.com';

      expect(siteConfig.websiteUrl).toBe('https://staging.mahibrowser.com');
      expect(siteConfig.appUrl).toBe('https://staging-app.mahibrowser.com');
      expect(siteConfig.apiUrl).toBe('https://staging-api.mahibrowser.com');
      expect(siteConfig.supportEmail).toBe('staging-support@mahibrowser.com');
      expect(websiteUrl('/pricing')).toBe('https://staging.mahibrowser.com/pricing');
      expect(appUrl('/invite?token=abc')).toBe('https://staging-app.mahibrowser.com/invite?token=abc');
      expect(apiUrl('/api/v1/billing/invoices')).toBe('https://staging-api.mahibrowser.com/api/v1/billing/invoices');
      expect(BRAND_CONFIG.website).toBe('https://staging.mahibrowser.com');
      expect(BRAND_CONFIG.consoleUrl).toBe('https://staging-app.mahibrowser.com');

      // Malformed URL falls back safely
      expect(cleanUrl('javascript:alert(1)', 'https://mahibrowser.com')).toBe('https://mahibrowser.com');
      expect(safeJsonLd({ text: '<script>' })).toContain('\\u003cscript>');
    });

    it('routes central auth verify/reset, team invite, support replies, OAuth origins & updater feeds through env config', async () => {
      process.env.MAHI_WEBSITE_URL = 'https://staging.mahibrowser.com/';
      process.env.APP_URL = 'https://staging-app.mahibrowser.com/';

      const regEmail = `phase6_auth_${Date.now()}@example.com`;
      const reg = await registerCentralUser({
        email: regEmail,
        password: 'StrongPassword123!',
        name: 'Phase Six User',
      });
      expect(reg.user?.id).toBeTruthy();

      const verifyEmail = devEmailProvider.getSentEmails().find((m) => m.to === regEmail && m.subject.includes('Verify'));
      expect(verifyEmail?.actionUrl).toMatch(/^https:\/\/staging\.mahibrowser\.com\/verify-email\?token=/);

      await requestPasswordReset(regEmail);
      const resetEmail = devEmailProvider.getSentEmails().find((m) => m.to === regEmail && m.subject.includes('Reset'));
      expect(resetEmail?.actionUrl).toMatch(/^https:\/\/staging\.mahibrowser\.com\/reset-password\?token=/);

      getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(reg.user!.id);
      const ws = createTeamWorkspace(reg.user!.id, { name: 'Phase6 Staging Workspace' });
      const inviteEmailAddr = `phase6_invite_${Date.now()}@example.com`;
      await inviteWorkspaceMember(reg.user!.id, ws.id, inviteEmailAddr, 'MEMBER');
      const inviteMail = devEmailProvider.getSentEmails().find((m) => m.to === inviteEmailAddr);
      expect(inviteMail?.actionUrl).toMatch(/^https:\/\/staging-app\.mahibrowser\.com\/invite\?token=/);

      const pricingReply = classifySupportQuery('What is the price of Pro 50?').suggestedReply;
      expect(pricingReply).toContain('https://staging.mahibrowser.com/pricing');

      const setupReply = classifySupportQuery('How do I download the installer?').suggestedReply;
      expect(setupReply).toContain('https://staging.mahibrowser.com/login');
      expect(setupReply).toContain('https://staging.mahibrowser.com/download');

      expect(getTrustedSiteOrigins()).toContain('https://staging.mahibrowser.com');
      expect(isSafeInternalUrl('https://staging.mahibrowser.com/pricing')).toBe(true);
      expect(isSafeInternalUrl('https://staging-app.mahibrowser.com/dashboard')).toBe(true);
      expect(isSafeInternalUrl('https://evil.example/dashboard')).toBe(false);

      expect(getDefaultUpdateFeedUrl()).toBe('https://staging.mahibrowser.com/update/');
      expect(getContentJsonUrl()).toBe('https://staging.mahibrowser.com/content.json');
      expect(sanitizeFeedUrl('https://staging.mahibrowser.com/update/')).toBe('https://staging.mahibrowser.com/update/');
    });

    it('replaces dead checkout/invoice subdomains in payment adapters and idempotent checkout recovery', async () => {
      process.env.WEBSITE_URL = 'https://staging.mahibrowser.com';
      process.env.API_URL = 'https://staging-api.mahibrowser.com';
      process.env.YOUPI_PG_MOCK = 'true';

      const simAdapter = new SimulationPaymentAdapter();
      const catalog = paymentService.getPlanCatalog();
      const proPlan = catalog.find((p) => p.id === 'plan_pro') || catalog[0];

      const simSession = await simAdapter.createCheckoutSession(
        { userId: 'usr_p6_test', planId: proPlan.id, billingCycle: 'MONTHLY' },
        proPlan,
        2900
      );
      expect(simSession.checkoutUrl).toContain('https://staging.mahibrowser.com/pricing?');
      expect(simSession.checkoutUrl).not.toContain('checkout.mahibrowser.com');

      const webhookEvt = simAdapter.parseWebhookPayload(
        JSON.stringify({ userId: 'usr_p6_test', planId: proPlan.id, amountCents: 2900 })
      );
      expect(webhookEvt.receiptUrl).toContain('https://staging-api.mahibrowser.com/api/v1/billing/invoices');
      expect(webhookEvt.receiptUrl).not.toContain('invoices.mahibrowser.com');

      const youpi = new YoupiPgPaymentAdapter();
      const youpiSession = await youpi.createCheckoutSession(
        { userId: 'usr_p6_youpi', planId: proPlan.id, billingCycle: 'ANNUAL', currency: 'INR' },
        proPlan,
        59900
      );
      expect(youpiSession.checkoutUrl).not.toContain('checkout.mahibrowser.com');

      expect(() =>
        validateCloudEnv({
          NODE_ENV: 'production',
          JWT_SECRET: 'a'.repeat(48) + '_prod_unique_secret_val',
          ADMIN_BOOTSTRAP_TOKEN: 'b'.repeat(48) + '_admin_bootstrap_val',
          MAHI_STATUS_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----',
          LOCAL_STORAGE_SECRET: 'c'.repeat(32) + '_local_storage_secret',
          WEBSITE_URL: 'http://insecure.mahibrowser.com',
        } as NodeJS.ProcessEnv)
      ).toThrow(CloudEnvError);
    });
  });

  describe('Sub-Step 6B: Env-Driven Contact & Payment Metadata Across Config & Gateway', () => {
    it('supports BUSINESS_EMAIL, SUPPORT_EMAIL, WHATSAPP_NUMBER, UPI_ID, UPI_ACCOUNT_HOLDER, USDT_ADDRESS & USDT_NETWORK overrides', () => {
      process.env.BUSINESS_EMAIL = 'biz-override@example.com';
      process.env.SUPPORT_EMAIL = 'help-override@example.com';
      process.env.WHATSAPP_NUMBER = '+919111222333';
      process.env.UPI_ID = 'staging@okicici';
      process.env.UPI_ACCOUNT_HOLDER = 'Staging Merchant Co';
      process.env.USDT_ADDRESS = 'TStagingTronAddress1234567890123456';
      process.env.USDT_NETWORK = 'TRC-20 (TRON TESTNET)';

      const cfg = getRuntimeContactConfig();
      expect(cfg.businessEmail).toBe('biz-override@example.com');
      expect(cfg.supportEmail).toBe('help-override@example.com');
      expect(cfg.whatsappNumber).toBe('+919111222333');
      expect(cfg.whatsappDisplay).toBe('+91 9111222333');
      expect(cfg.upi.id).toBe('staging@okicici');
      expect(cfg.upi.accountHolder).toBe('Staging Merchant Co');
      expect(cfg.usdt.address).toBe('TStagingTronAddress1234567890123456');
      expect(cfg.usdt.network).toBe('TRC-20 (TRON TESTNET)');

      // Live getters & helpers mirror runtime overrides identically
      expect(getAuthoritativeContactConfig()).toEqual(cfg);
      expect(CONTACT_CONFIG.WHATSAPP_RAW_NUMBER).toBe('919111222333');
      expect(CONTACT_CONFIG.BUSINESS_EMAIL).toBe('biz-override@example.com');
      expect(CONTACT_CONFIG.SUPPORT_EMAIL).toBe('help-override@example.com');
      expect(CONTACT_CONFIG.WHATSAPP_NUMBER).toBe('+919111222333');
      expect(CONTACT_CONFIG.UPI_ID).toBe('staging@okicici');
      expect(CONTACT_CONFIG.UPI_ACCOUNT_HOLDER).toBe('Staging Merchant Co');
      expect(CONTACT_CONFIG.USDT_ADDRESS).toBe('TStagingTronAddress1234567890123456');
      expect(CONTACT_CONFIG.USDT_NETWORK).toBe('TRC-20 (TRON TESTNET)');
      expect(buildWhatsAppLink('Test')).toContain('https://wa.me/919111222333?text=Test');
    });

    it('exposes live env contact/payment overrides via GET /api/v1/billing/gateways and /v1/account/payment-info without leaking secrets', async () => {
      process.env.BUSINESS_EMAIL = 'gw-biz@example.com';
      process.env.SUPPORT_EMAIL = 'gw-support@example.com';
      process.env.WHATSAPP_NUMBER = '+918888777666';
      process.env.UPI_ID = 'gateway-upi@slc';
      process.env.UPI_ACCOUNT_HOLDER = 'Gateway Holder Name';
      process.env.USDT_ADDRESS = 'TGatewayUsdtWalletAddress9999999999';
      process.env.USDT_NETWORK = 'TRC-20 (CUSTOM)';

      const gwMock = mockHttpRequest('GET', '/api/v1/billing/gateways');
      expect(await handleCommercialAPIRequest(gwMock.req, gwMock.res)).toBe(true);
      const gwRes = gwMock.getResult();
      expect(gwRes.statusCode).toBe(200);
      expect(gwRes.json.success).toBe(true);

      const upiManual = gwRes.json.gateways.find((g: any) => g.id === 'upi_manual');
      expect(upiManual?.upiId).toBe('gateway-upi@slc');
      expect(upiManual?.accountHolder).toBe('Gateway Holder Name');

      const usdtGw = gwRes.json.gateways.find((g: any) => g.id === 'usdt_trc20');
      expect(usdtGw?.walletAddress).toBe('TGatewayUsdtWalletAddress9999999999');
      expect(usdtGw?.network).toBe('TRC-20 (CUSTOM)');

      expect(gwRes.json.support).toMatchObject({
        email: 'gw-support@example.com',
        businessEmail: 'gw-biz@example.com',
        whatsappNumber: '+918888777666',
        whatsappRawNumber: '918888777666',
        whatsappDisplay: '+91 8888777666',
      });

      const piMock = mockHttpRequest('GET', '/v1/account/payment-info');
      expect(await handleCommercialAPIRequest(piMock.req, piMock.res)).toBe(true);
      const piRes = piMock.getResult();
      expect(piRes.statusCode).toBe(200);
      expect(piRes.json.upi_id).toBe('gateway-upi@slc');
      expect(piRes.json.upi_account_holder).toBe('Gateway Holder Name');
      expect(piRes.json.usdt_address).toBe('TGatewayUsdtWalletAddress9999999999');
      expect(piRes.json.usdt_network).toBe('TRC-20 (CUSTOM)');
      expect(piRes.json.whatsapp_number).toBe('+918888777666');
      expect(piRes.json.support_email).toBe('gw-support@example.com');
      expect(piRes.json.business_email).toBe('gw-biz@example.com');
    });

    it('confirms zero dead checkout/invoice subdomains remain in payment/auth backend sources', () => {
      const filesToScan = [
        '05_AUTH/central-auth-service.ts',
        '07_BACKEND/commercial/payments/payment-adapters.ts',
        '07_BACKEND/commercial/payments/payment-activation.ts',
      ];
      for (const relPath of filesToScan) {
        const raw = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
        expect(raw).not.toContain('checkout.mahibrowser.com');
        expect(raw).not.toContain('invoices.mahibrowser.com');
      }
    });
  });
});
