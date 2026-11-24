import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  DEFAULT_LOCAL_DAEMON_PORT,
  DEFAULT_CLOUD_GATEWAY_PORT,
  PRODUCTION_COMMERCIAL_API_URL,
  getEnv,
  getLocalDaemonBaseUrl,
  getCloudGatewayUrl,
} from '../../10_CONFIG/shared/network-endpoints.js';
import { CONTACT_CONFIG, APP_AUTHOR } from '../../10_CONFIG/contact-config.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { isTrustedOrigin } from '../../07_BACKEND/server/cloud-gateway.js';
import { fallbackMahiAPI } from '../../01_UI/api-fallback.js';
import { PUBLIC_PLANS } from '../../landing/lib/plans.js';

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
    writeHead: (code: number, headers?: any) => {
      statusCode = code;
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => {
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

describe('Wave 2: Configuration & Business Info Centralization', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('1. Network Endpoints & Port Resolution', () => {
    it('exports canonical ports and production endpoints', () => {
      expect(DEFAULT_LOCAL_DAEMON_PORT).toBe(32123);
      expect(DEFAULT_CLOUD_GATEWAY_PORT).toBe(8989);
      expect(PRODUCTION_COMMERCIAL_API_URL).toBe('https://api.mahibrowser.com');
    });

    it('resolves local daemon base URL safely', () => {
      expect(getLocalDaemonBaseUrl()).toBe('http://127.0.0.1:32123');
      expect(getLocalDaemonBaseUrl(45678)).toBe('http://127.0.0.1:45678');
    });

    it('safely extracts environment variables with fallback', () => {
      expect(getEnv('NON_EXISTENT_VAR_TEST_XYZ', 'default_test_val')).toBe('default_test_val');
      expect(getEnv('PATH', '')).not.toBe('');
    });

    it('resolves cloud gateway URL with env overrides and dev fallback', () => {
      const originalEnv = process.env.VITE_COMMERCIAL_API_URL;
      try {
        process.env.VITE_COMMERCIAL_API_URL = 'https://custom-gateway.mahibrowser.com/';
        expect(getCloudGatewayUrl()).toBe('https://custom-gateway.mahibrowser.com');
      } finally {
        if (originalEnv !== undefined) {
          process.env.VITE_COMMERCIAL_API_URL = originalEnv;
        } else {
          delete process.env.VITE_COMMERCIAL_API_URL;
        }
      }
    });
  });

  describe('2. Gateway Payment Info Route Aliases & Env Overrides', () => {
    const envBackup = { ...process.env };

    beforeEach(() => {
      delete process.env.PAYMENT_UPI_ID;
      delete process.env.PAYMENT_UPI_HOLDER;
      delete process.env.SUPPORT_WHATSAPP;
      delete process.env.SUPPORT_EMAIL;
      delete process.env.DEFAULT_PRICE_INR;
    });

    afterEach(() => {
      process.env = { ...envBackup };
    });

    const routeAliases = [
      '/v1/account/payment-info',
      '/api/v1/account/payment-info',
      '/api/v1/commercial/payment-info',
    ];

    routeAliases.forEach((route) => {
      it(`serves default CONTACT_CONFIG values on ${route} when env vars are unset`, async () => {
        const { req, res, getResult } = mockHttpRequest('GET', route);
        const handled = await handleCommercialAPIRequest(req, res);
        expect(handled).toBe(true);

        const { statusCode, json } = getResult();
        expect(statusCode).toBe(200);
        expect(json.success).toBe(true);
        expect(json.upi_id).toBe(CONTACT_CONFIG.UPI_ID);
        expect(json.upi_account_holder).toBe(CONTACT_CONFIG.UPI_ACCOUNT_HOLDER);
        expect(json.upi_qr_asset).toBe(CONTACT_CONFIG.UPI_QR_ASSET);
        expect(json.whatsapp_number).toBe(CONTACT_CONFIG.WHATSAPP_NUMBER);
        expect(json.support_email).toBe(CONTACT_CONFIG.SUPPORT_EMAIL);
        expect(json.price_inr).toBe(CONTACT_CONFIG.DEFAULT_PRICE_INR);
      });
    });

    it('respects live VPS environment variable overrides', async () => {
      process.env.PAYMENT_UPI_ID = 'overridden@upi';
      process.env.PAYMENT_UPI_HOLDER = 'Overridden Holder';
      process.env.SUPPORT_WHATSAPP = '+919999999999';
      process.env.SUPPORT_EMAIL = 'custom-support@mahibrowser.com';
      process.env.DEFAULT_PRICE_INR = '799';

      const { req, res, getResult } = mockHttpRequest('GET', '/v1/account/payment-info');
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);

      const { statusCode, json } = getResult();
      expect(statusCode).toBe(200);
      expect(json.success).toBe(true);
      expect(json.upi_id).toBe('overridden@upi');
      expect(json.upi_account_holder).toBe('Overridden Holder');
      expect(json.whatsapp_number).toBe('+919999999999');
      expect(json.support_email).toBe('custom-support@mahibrowser.com');
      expect(json.price_inr).toBe(799);
    });
  });

  describe('3. Offline Fallbacks & Business Metadata Centralization', () => {
    it('centralizes APP_AUTHOR in contact-config', () => {
      expect(APP_AUTHOR).toBe('Munna Bhai');
      expect(CONTACT_CONFIG.APP_AUTHOR).toBe('Munna Bhai');
      expect(CONTACT_CONFIG.appAuthor).toBe('Munna Bhai');
    });

    it('serves comprehensive default plans in fallbackMahiAPI.accountGetPricingCatalog', async () => {
      const res = await fallbackMahiAPI.accountGetPricingCatalog();
      expect(res.success).toBe(true);
      expect(res.catalog).toBeDefined();
      expect(Array.isArray(res.catalog.personal)).toBe(true);
      expect(Array.isArray(res.catalog.business)).toBe(true);

      expect(res.catalog.personal.length).toBeGreaterThanOrEqual(4);
      expect(res.catalog.business.length).toBeGreaterThanOrEqual(2);

      const personalIds = res.catalog.personal.map((p: any) => p.planId);
      expect(personalIds).toContain('free');
      expect(personalIds).toContain('professional_10');
      expect(personalIds).toContain('professional_25');
      expect(personalIds).toContain('professional_100');

      const businessIds = res.catalog.business.map((p: any) => p.planId);
      expect(businessIds).toContain('business_scale');
      expect(businessIds).toContain('business_enterprise');
    });

    it('serves contact payment coordinates via fallbackMahiAPI.accountGetPaymentInfo', async () => {
      const res = await fallbackMahiAPI.accountGetPaymentInfo();
      expect(res.success).toBe(true);
      expect(res.upi_id).toBe(CONTACT_CONFIG.UPI_ID);
      expect(res.upi_account_holder).toBe(CONTACT_CONFIG.UPI_ACCOUNT_HOLDER);
      expect(res.whatsapp_number).toBe(CONTACT_CONFIG.WHATSAPP_NUMBER);
    });
  });

  describe('4. Phase 2B: Dynamic Pricing, UPI & Contact Sync for Landing Portal', () => {
    it('verifies isTrustedOrigin permits landing domains and localhost origins', () => {
      expect(isTrustedOrigin('https://mahibrowser.com')).toBe(true);
      expect(isTrustedOrigin('http://mahibrowser.com')).toBe(true);
      expect(isTrustedOrigin('https://www.mahibrowser.com')).toBe(true);
      expect(isTrustedOrigin('http://www.mahibrowser.com')).toBe(true);
      expect(isTrustedOrigin('https://app.mahibrowser.com')).toBe(true);
      expect(isTrustedOrigin('http://localhost:3000')).toBe(true);
      expect(isTrustedOrigin('http://127.0.0.1:8989')).toBe(true);
      expect(isTrustedOrigin('https://malicious-site.com')).toBe(false);
    });

    it('returns CORS headers for trusted landing origins on payment-info endpoint', async () => {
      const { req, res, getResult } = mockHttpRequest('GET', '/api/v1/commercial/payment-info', {
        origin: 'https://mahibrowser.com',
      });
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);

      const { statusCode, json, headers } = getResult();
      expect(statusCode).toBe(200);
      expect(json.success).toBe(true);
      expect(headers['access-control-allow-origin']).toBe('https://mahibrowser.com');
      expect(headers['access-control-allow-credentials']).toBe('true');
    });

    it('returns CORS headers for trusted landing origins on pricing/catalog endpoint', async () => {
      const { req, res, getResult } = mockHttpRequest('GET', '/api/v1/pricing/catalog', {
        origin: 'https://www.mahibrowser.com',
      });
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);

      const { statusCode, json, headers } = getResult();
      expect(statusCode).toBe(200);
      expect(json.success).toBe(true);
      expect(headers['access-control-allow-origin']).toBe('https://www.mahibrowser.com');
      expect(headers['access-control-allow-credentials']).toBe('true');
    });

    it('handles CORS preflight OPTIONS requests cleanly with 204 status', async () => {
      const { req, res, getResult } = mockHttpRequest('OPTIONS', '/api/v1/commercial/payment-info', {
        origin: 'https://mahibrowser.com',
      });
      const handled = await handleCommercialAPIRequest(req, res);
      expect(handled).toBe(true);

      const { statusCode, headers } = getResult();
      expect(statusCode).toBe(204);
      expect(headers['access-control-allow-origin']).toBe('https://mahibrowser.com');
      expect(headers['access-control-allow-methods']).toContain('GET');
      expect(headers['access-control-allow-headers']).toContain('Content-Type');
    });

    it('verifies landing/public/assets/js/main.js contains dynamic hydration and silent fallback logic', () => {
      const mainJsPath = path.resolve(__dirname, '../../landing/public/assets/js/main.js');
      expect(fs.existsSync(mainJsPath)).toBe(true);

      const mainJs = fs.readFileSync(mainJsPath, 'utf8');
      expect(mainJs).toContain('getGatewayApiBaseUrl');
      expect(mainJs).toContain('fetchWithTimeout');
      expect(mainJs).toContain('fetchLivePaymentInfo');
      expect(mainJs).toContain('fetchLivePricingCatalog');
      expect(mainJs).toContain('/api/v1/commercial/payment-info');
      expect(mainJs).toContain('/api/v1/pricing/catalog');
      expect(mainJs).toContain('6375823589@slc'); // Immediate fallback default preserved
      expect(mainJs).toContain('MAHI Browser Commercial'); // Immediate fallback default preserved
      expect(mainJs).toContain('a[href^="https://wa.me/"]'); // WhatsApp dynamic link hydration selector
    });

    it('verifies landing/lib/plans.ts business_scale plan pricing matches canonical catalog', () => {
      const team200 = PUBLIC_PLANS.find((p) => p.id === 'business_scale');
      expect(team200).toBeDefined();
      expect(team200?.monthlyPrice.INR).toBe(4999);
      expect(team200?.annualPrice.INR).toBe(2499);
    });
  });
});
