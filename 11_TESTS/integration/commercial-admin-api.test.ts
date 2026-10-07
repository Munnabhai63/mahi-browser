import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { createCentralApiServer } from '../../07_BACKEND/server/app.js';
import { registerUser } from '../../07_BACKEND/commercial/commercial-auth-service.js';
import { getInstallSecrets } from '../../08_SECURITY/install-secrets.js';

describe('Commercial Admin & REST API Integration Suite', () => {
  const testDbDir = path.join(process.cwd(), '.test_commercial_api');
  const testDbPath = path.join(testDbDir, 'commercial_api_test.sqlite');
  let server: http.Server;
  let baseUrl: string;
  const testPort = 39871;

  beforeAll(async () => {
    try { fs.mkdirSync(testDbDir, { recursive: true }); } catch {}
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    server = createCentralApiServer();
    await new Promise<void>((resolve) => {
      server.listen(testPort, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${testPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.rmdirSync(testDbDir); } catch {}
  });

  async function request(path: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOptions);
    const data = await res.json();
    return { status: res.status, data };
  }

  it('POST /api/v1/auth/register should create a new user account', async () => {
    const res = await request('/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'apiuser@company.com',
        password: 'Password123!',
        name: 'API User',
      },
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.user.email).toBe('apiuser@company.com');
    expect(res.data.token).toBeDefined();
  });

  it('POST /api/v1/auth/login should authenticate user and return session + entitlements', async () => {
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'apiuser@company.com',
        password: 'Password123!',
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.token).toBeDefined();
    expect(res.data.entitlements.plan).toBeDefined();
  });

  it('GET /api/v1/plans should return all active commercial plans', async () => {
    const res = await request('/api/v1/plans');
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/v1/admin/dashboard should reject requests without admin credentials or with old backdoor (403 Forbidden)', async () => {
    const resNoAuth = await request('/api/v1/admin/dashboard');
    expect(resNoAuth.status).toBe(403);

    const resBackdoor = await request('/api/v1/admin/dashboard', {
      headers: { 'X-Admin-Secret': 'mahi_super_admin_2026' },
    });
    expect(resBackdoor.status).toBe(403);
  });

  it('GET /api/v1/admin/dashboard should return real telemetry stats with valid dynamic admin secret', async () => {
    const validSecret = getInstallSecrets().adminWebSecret;
    const res = await request('/api/v1/admin/dashboard', {
      headers: {
        'X-Admin-Secret': validSecret,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.totalUsers).toBeGreaterThanOrEqual(1);
    expect(res.data.data.totalPlans).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/v1/admin/users and PUT /status should allow admin to manage user accounts and record audit logs', async () => {
    const validSecret = getInstallSecrets().adminWebSecret;
    // 1. Get users list
    const listRes = await request('/api/v1/admin/users', {
      headers: { 'X-Admin-Secret': validSecret },
    });
    expect(listRes.status).toBe(200);
    expect(listRes.data.data.length).toBeGreaterThan(0);
    const targetUser = listRes.data.data[0];

    // 2. Suspend user
    const suspendRes = await request(`/api/v1/admin/users/${targetUser.id}/status`, {
      method: 'PUT',
      headers: { 'X-Admin-Secret': validSecret },
      body: { status: 'SUSPENDED', reason: 'Admin integration test' },
    });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.data.success).toBe(true);

    // 3. Verify audit log was created
    const logsRes = await request('/api/v1/admin/audit-logs', {
      headers: { 'X-Admin-Secret': validSecret },
    });
    expect(logsRes.status).toBe(200);
    expect(logsRes.data.data.length).toBeGreaterThan(0);
    expect(logsRes.data.data.some((l: any) => l.action.includes('USER_SUSPENDED'))).toBe(true);
  });

  it('POST /api/v1/admin/licenses should reject minting and return 403 Forbidden', async () => {
    const validSecret = getInstallSecrets().adminWebSecret;
    const mintRes = await request('/api/v1/admin/licenses', {
      method: 'POST',
      headers: { 'X-Admin-Secret': validSecret },
      body: {
        customerName: 'Enterprise Client',
        durationType: '1_YEAR',
        maxDevices: 10,
      },
    });

    expect(mintRes.status).toBe(403);
    expect(mintRes.data.success).toBe(false);
    expect(mintRes.data.error).toContain('License minting is disabled in the app');
  });
});
