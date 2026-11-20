import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  initSqlEngine,
  getDatabase,
  setCustomDatabasePath,
  closeDatabase,
} from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { CURRENT_TERMS_VERSION } from '../../10_CONFIG/shared/types/commercial.js';
import { setPrismaClientForTest } from '../../06_DATABASE/prisma-client.js';
import { setCentralRepositoryForTest, CentralRepository } from '../../06_DATABASE/central-repository.js';

describe('BLOCK F4: Terms Consent PG Write or Loud Fail Suite', () => {
  const testDbDir = path.resolve('.mahi_data', 'test-terms-pg-write');
  const testDbPath = path.join(testDbDir, 'terms_pg_write_test.sqlite');
  let server: http.Server;
  let serverPort = 0;
  let baseUrl = '';

  beforeAll(async () => {
    await initSqlEngine();
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    server = http.createServer(async (req, res) => {
      try {
        const handled = await handleCommercialAPIRequest(req, res);
        if (!handled) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    setPrismaClientForTest(null);
    setCentralRepositoryForTest(null);
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch {}
  });

  async function postRegister(payload: any) {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  function createMockRepo(overrides: Partial<CentralRepository> = {}): CentralRepository {
    const defaultRepo: Partial<CentralRepository> = {
      findAuthUserByEmail: vi.fn().mockResolvedValue(null),
      createAuthUser: vi.fn().mockImplementation(async (userData: any) => ({
        id: userData.id || 'pg_user_mock',
        email: userData.email,
        name: userData.name || 'PG User',
        role: 'USER',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      })),
      findAuthUserById: vi.fn().mockImplementation(async (id: string) => ({
        id,
        email: 'mock@example.com',
        role: 'USER',
        status: 'ACTIVE',
      })),
      createAuthSession: vi.fn().mockResolvedValue({
        id: 'session_mock',
        user_id: 'pg_user_mock',
        token: 'mock-session-token',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }),
      createVerificationToken: vi.fn().mockResolvedValue({ id: 'tok_mock' }),
      logAuthSecurity: vi.fn().mockResolvedValue(undefined),
      updateAuthUserTerms: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
    return defaultRepo as CentralRepository;
  }

  // Case 1: PG configured + SQLite row missing -> PG write succeeds, registration returns 201
  it('Case 1: PG configured + SQLite row missing -> PG write succeeds, registration returns 201', async () => {
    let pgUpdateCalledWith: any = null;
    const mockRepo = createMockRepo({
      updateAuthUserTerms: vi.fn().mockImplementation(async (userId: string, accepted: number, version: string) => {
        pgUpdateCalledWith = { userId, accepted, version };
        return true;
      }),
    });

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo);

    const email = `case1_pg_success_${Date.now()}@example.com`;
    const res = await postRegister({
      email,
      password: 'StrongPassword123!',
      name: 'Case 1 User',
      acceptedTerms: true,
      termsVersion: '2026-11-19',
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(pgUpdateCalledWith).toBeDefined();
    expect(pgUpdateCalledWith.accepted).toBe(1);
    expect(pgUpdateCalledWith.version).toBe(CURRENT_TERMS_VERSION);
  });

  // Case 2: PG write fails + SQLite 0 rows -> request fails (500) and logs [Registration][CRITICAL]
  it('Case 2: PG write fails + SQLite 0 rows -> request fails (500) and logs [Registration][CRITICAL]', async () => {
    const errorSpy = vi.spyOn(console, 'error');

    const mockRepo = createMockRepo({
      updateAuthUserTerms: vi.fn().mockResolvedValue(false), // PG write fails!
    });

    setPrismaClientForTest({} as any);
    setCentralRepositoryForTest(mockRepo);

    const email = `case2_pg_fail_${Date.now()}@example.com`;
    const res = await postRegister({
      email,
      password: 'StrongPassword123!',
      name: 'Case 2 User',
      acceptedTerms: true,
      termsVersion: '2026-11-19',
    });

    expect(res.status).toBe(500);
    expect(res.data.success).toBe(false);
    expect(res.data.error).toContain('Registration failed to persist legal consent');

    const hasCriticalLog = errorSpy.mock.calls.some((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes('[Registration][CRITICAL]'))
    );
    expect(hasCriticalLog).toBe(true);

    errorSpy.mockRestore();
  });

  // Case 3: PG unconfigured -> SQLite write succeeds, registration returns 201
  it('Case 3: PG unconfigured -> SQLite write succeeds, registration returns 201', async () => {
    setPrismaClientForTest(null);
    setCentralRepositoryForTest(null);

    const email = `case3_sqlite_${Date.now()}@example.com`;
    const res = await postRegister({
      email,
      password: 'StrongPassword123!',
      name: 'Case 3 User',
      acceptedTerms: true,
      termsVersion: '2026-11-19',
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);

    const db = getDatabase();
    const row = db.prepare('SELECT accepted_terms, terms_version FROM auth_users WHERE email = ?').get(email) as any;
    expect(row).toBeDefined();
    expect(row.accepted_terms).toBe(1);
    expect(row.terms_version).toBe(CURRENT_TERMS_VERSION);
  });
});
