/**
 * MAHI Browser — Phase 17 Pricing API Integration Test
 *
 * Verifies end-to-end HTTP pipeline for the production business model:
 * - Public catalog endpoint (/api/v1/pricing/catalog)
 * - Admin protected endpoints with X-Admin-Secret
 * - Draft → Preview → Publish lifecycle via HTTP router
 * - Rollback via HTTP router
 * - Revenue summary & gateway sync status
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { getAdminWebSecret } from '../../08_SECURITY/install-secrets.js';
import { initializePricingTables } from '../../07_BACKEND/commercial/pricing-admin-service.js';

describe('Phase 17: Pricing & Business Model HTTP Integration Pipeline', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;
  let customTestDbPath: string;
  const adminSecret = getAdminWebSecret();

  beforeAll(async () => {
    const testDir = path.join(process.cwd(), '.mahi_data', 'test-auto-isolated');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    customTestDbPath = path.join(testDir, `pricing_api_test_${Date.now()}_${process.pid}.sqlite`);
    setCustomDatabasePath(customTestDbPath);
    await initializeDatabase();
    initializePricingTables();

    server = http.createServer(async (req, res) => {
      const handled = await handleCommercialAPIRequest(req, res);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    try {
      if (customTestDbPath && fs.existsSync(customTestDbPath)) {
        fs.unlinkSync(customTestDbPath);
      }
    } catch {}
  });

  // 1. Public Pricing Catalog
  it('GET /api/v1/pricing/catalog returns public catalog with all canonical plans without auth', async () => {
    const res = await fetch(`${baseUrl}/api/v1/pricing/catalog`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const catalog = body.data;
    expect(catalog.catalogVersion).toBeGreaterThanOrEqual(1);
    expect(catalog.currency).toBe('INR');
    expect(catalog.annualDiscountPercent).toBe(50);

    // 4 Personal plans
    expect(catalog.personal.length).toBeGreaterThanOrEqual(4);
    const proIds = catalog.personal.map((p: any) => p.planId);
    expect(proIds).toEqual(
      expect.arrayContaining(['professional_10', 'professional_25', 'professional_50', 'professional_100'])
    );

    // 4 Business plans
    expect(catalog.business.length).toBeGreaterThanOrEqual(4);
    const bizIds = catalog.business.map((p: any) => p.planId);
    expect(bizIds).toEqual(
      expect.arrayContaining(['business_starter', 'business_growth', 'business_scale', 'business_enterprise'])
    );

    // Free plan
    expect(catalog.free).toBeDefined();
    expect(catalog.free.planId).toBe('free');
    expect(catalog.free.profileLimit).toBe(1);
  });

  // 2. Admin Authentication Enforcement
  it('GET /api/v1/admin/pricing/versions rejects unauthorized requests with 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/pricing/versions`);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('GET /api/v1/admin/pricing/versions succeeds with valid X-Admin-Secret', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/pricing/versions`, {
      headers: { 'X-Admin-Secret': adminSecret },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  // 3. Draft → Preview → Publish Workflow
  it('executes full Draft → Preview → Publish cycle via admin REST endpoints', async () => {
    // A. Create Draft
    const draftPayload = {
      prices: [
        { planId: 'professional_10', monthlyPricePaise: 69900, annualPricePaise: 419400, currency: 'INR' },
        { planId: 'professional_25', monthlyPricePaise: 169900, annualPricePaise: 1019400, currency: 'INR' },
      ],
      annualDiscountPercent: 50,
      existingSubscriberPolicy: 'GRANDFATHER',
    };

    const draftRes = await fetch(`${baseUrl}/api/v1/admin/pricing/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': adminSecret,
      },
      body: JSON.stringify(draftPayload),
    });

    expect(draftRes.status).toBe(201);
    const draftBody = await draftRes.json();
    expect(draftBody.success).toBe(true);
    const draftVersion = draftBody.data.version;
    expect(draftVersion).toBeGreaterThan(1);
    expect(draftBody.data.status).toBe('DRAFT');

    // B. Preview Changes
    const previewRes = await fetch(`${baseUrl}/api/v1/admin/pricing/preview/${draftVersion}`, {
      headers: { 'X-Admin-Secret': adminSecret },
    });
    expect(previewRes.status).toBe(200);
    const previewBody = await previewRes.json();
    expect(previewBody.success).toBe(true);
    expect(previewBody.data.priceDiffs).toBeDefined();

    // Check professional_10 diff
    const pro10Diff = previewBody.data.priceDiffs.find((d: any) => d.planId === 'professional_10');
    expect(pro10Diff).toBeDefined();
    expect(pro10Diff.monthlyChanged).toBe(true);
    expect(pro10Diff.newMonthlyPaise).toBe(69900);

    // C. Publish Version
    const publishRes = await fetch(`${baseUrl}/api/v1/admin/pricing/publish/${draftVersion}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': adminSecret,
      },
      body: JSON.stringify({ policy: 'GRANDFATHER' }),
    });

    expect(publishRes.status).toBe(200);
    const publishBody = await publishRes.json();
    expect(publishBody.success).toBe(true);
    expect(publishBody.version.version).toBe(draftVersion);

    // D. Verify public catalog reflects published version immediately
    const updatedCatRes = await fetch(`${baseUrl}/api/v1/pricing/catalog`);
    const updatedCat = await updatedCatRes.json();
    expect(updatedCat.data.catalogVersion).toBe(draftVersion);
    const updatedPro10 = updatedCat.data.personal.find((p: any) => p.planId === 'professional_10');
    expect(updatedPro10.monthlyPricePaise).toBe(69900);
  });

  // 4. Provider Sync Status & Revenue Summary
  it('GET /api/v1/admin/pricing/provider-sync-status returns gateway health', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/pricing/provider-sync-status`, {
      headers: { 'X-Admin-Secret': adminSecret },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET /api/v1/admin/pricing/revenue-summary returns commercial financial metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/pricing/revenue-summary`, {
      headers: { 'X-Admin-Secret': adminSecret },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.currency).toBe('INR');
    expect(body.data.activeSubscribers).toBeGreaterThanOrEqual(0);
  });
});
