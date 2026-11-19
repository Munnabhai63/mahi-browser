/**
 * MAHI Browser — YouPI Gateway Contract & Security Invariant Unit Tests
 * Pins the sovereign 0% fee UPI / Dynamic QR gateway contract.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  YoupiPgPaymentAdapter,
  PaymentGatewayNotConfiguredError,
} from '../../07_BACKEND/commercial/payment-service.js';
import { getCommercialPlanById } from '../../07_BACKEND/commercial/commercial-plan-service.js';
import type { CommercialPlan } from '../../07_BACKEND/commercial/commercial-plan-service.js';

describe('YouPI Gateway Contract & Invariant Tests', () => {
  const origEnv = { ...process.env };
  let mockPlan: CommercialPlan;

  beforeAll(async () => {
    await initializeDatabase();
    const resolved = getCommercialPlanById('mahi_starter') || getCommercialPlanById('professional_50');
    if (!resolved) {
      throw new Error('Could not resolve test commercial plan');
    }
    mockPlan = resolved;
  });

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it('1. YoupiPgPaymentAdapter.baseUrl reads YOUPI_PG_BASE_URL (and strips trailing slash)', () => {
    process.env.YOUPI_PG_BASE_URL = 'https://gateway.youpi.test/api///';
    delete process.env.BASE_PAYMENT_API_URL;
    const adapter = new YoupiPgPaymentAdapter();
    expect(adapter.baseUrl).toBe('https://gateway.youpi.test/api');
  });

  it('2. merchantId falls back to documented default when unset', () => {
    delete process.env.YOUPI_PG_MERCHANT_ID;
    const adapter = new YoupiPgPaymentAdapter();
    expect(adapter.merchantId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('3. apiKey reads YOUPI_PG_API_KEY or YOUPI_PG_SECRET', () => {
    delete process.env.YOUPI_PG_SECRET;
    process.env.YOUPI_PG_API_KEY = 'key_direct_api_key_test';
    const adapter1 = new YoupiPgPaymentAdapter();
    expect(adapter1.apiKey).toBe('key_direct_api_key_test');

    delete process.env.YOUPI_PG_API_KEY;
    process.env.YOUPI_PG_SECRET = 'key_secret_alias_test';
    const adapter2 = new YoupiPgPaymentAdapter();
    expect(adapter2.apiKey).toBe('key_secret_alias_test');
  });

  it('4. createCheckoutSession throws PaymentGatewayNotConfiguredError when NODE_ENV is production and baseUrl/apiKey are empty', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PAYMENT_ALLOW_TEST_ADAPTERS;
    delete process.env.YOUPI_PG_BASE_URL;
    delete process.env.BASE_PAYMENT_API_URL;
    delete process.env.YOUPI_PG_API_KEY;
    delete process.env.YOUPI_PG_SECRET;

    const adapter = new YoupiPgPaymentAdapter();
    await expect(
      adapter.createCheckoutSession(
        { userId: 'user_prod_test_1', planId: mockPlan.id, billingCycle: 'ANNUAL' },
        mockPlan,
        149900
      )
    ).rejects.toThrow(PaymentGatewayNotConfiguredError);
  });

  it('5. In test mode it returns provider youpi_pg and a checkoutUrl containing /checkout/', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.YOUPI_PG_LIVE_CALL;
    const adapter = new YoupiPgPaymentAdapter();
    const session = await adapter.createCheckoutSession(
      { userId: 'user_test_mock', planId: mockPlan.id, billingCycle: 'MONTHLY' },
      mockPlan,
      49900
    );

    expect(session.provider).toBe('youpi_pg');
    expect(session.currency).toBe('INR');
    expect(session.checkoutUrl).toContain('/checkout/');
    expect(session.sessionId).toMatch(/^youpi_cs_/);
  });

  it('6. The request it WOULD send uses header names X-Merchant-Id and X-Merchant-Key and path /api/v1/payments', async () => {
    process.env.NODE_ENV = 'test';
    process.env.YOUPI_PG_LIVE_CALL = 'true';
    process.env.YOUPI_PG_BASE_URL = 'https://youpi.gateway.internal';
    process.env.YOUPI_PG_MERCHANT_ID = 'merch_test_custom_id';
    process.env.YOUPI_PG_API_KEY = 'secret_key_test_val';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: 'youpi_pay_test_789',
        orderId: 'mahi_ord_test_order',
        checkoutUrl: 'https://youpi.gateway.internal/checkout/youpi_pay_test_789',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new YoupiPgPaymentAdapter();
    const session = await adapter.createCheckoutSession(
      { userId: 'user_live_stub', planId: mockPlan.id, billingCycle: 'ANNUAL' },
      mockPlan,
      149900
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];

    expect(calledUrl).toBe('https://youpi.gateway.internal/api/v1/payments');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers['X-Merchant-Id']).toBe('merch_test_custom_id');
    expect(calledInit.headers['X-Merchant-Key']).toBe('secret_key_test_val');
    expect(calledInit.headers['Content-Type']).toBe('application/json');

    const parsedBody = JSON.parse(calledInit.body);
    expect(parsedBody.currency).toBe('INR');
    expect(parsedBody.amount).toBe('1499.00');
    expect(session.provider).toBe('youpi_pg');
    expect(session.checkoutUrl).toContain('/checkout/');
  });
});
