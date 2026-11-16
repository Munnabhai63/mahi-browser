import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import {
  handleCommercialApiRoutes,
  _resetWebHandoffSessions,
} from '../../07_BACKEND/commercial/commercial-api-router.js';
import { getCentralRepository } from '../../06_DATABASE/central-repository.js';

describe('Web Handoff Multi-Replica Concurrency & Anti-Replay Suite (BUG-06)', () => {
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    _resetWebHandoffSessions();
    const db = getDatabase();

    const email = `handoff_conc_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
    const res = await registerCentralUser({
      email,
      password: 'StrongHandoffPass123!',
      name: 'Handoff Concurrency User',
    });
    userId = res.user!.id;
    userToken = res.tokens.accessToken;
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(userId);
  });

  function createMockReqRes(method: string, url: string, headers: Record<string, string>, body?: any) {
    let statusCode = 200;
    let responseBody = '';
    const normalizedHeaders: Record<string, string> = {
      host: 'api.mahibrowser.com',
      'content-type': 'application/json',
    };
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        normalizedHeaders[k.toLowerCase()] = v;
      }
    }
    const req: any = {
      method,
      url,
      headers: normalizedHeaders,
      on: (event: string, cb: any) => {
        if (event === 'data' && body) {
          cb(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
        }
        if (event === 'end') {
          cb();
        }
      },
    };

    const res: any = {
      writeHead: (code: number) => {
        statusCode = code;
      },
      setHeader: () => {},
      end: (data: string) => {
        responseBody = data;
      },
    };

    return {
      req,
      res,
      getResponse: () => ({
        status: statusCode,
        body: responseBody ? JSON.parse(responseBody) : {},
      }),
    };
  }

  async function invokeRoute(method: string, pathUrl: string, headers: Record<string, string> = {}, body?: any) {
    const urlObj = new URL(`https://api.mahibrowser.com${pathUrl}`);
    const { req, res, getResponse } = createMockReqRes(method, pathUrl, headers, body);
    const handled = await handleCommercialApiRoutes(req, res, urlObj.pathname, method, urlObj);
    return { handled, ...getResponse() };
  }

  it('guarantees strictly single-use exchange: second exchange always returns 403', async () => {
    // 1. Initiate handoff
    const handoffRes = await invokeRoute(
      'POST',
      '/api/v1/auth/web-handoff',
      { authorization: `Bearer ${userToken}` }
    );
    expect(handoffRes.status).toBe(200);
    expect(handoffRes.body.success).toBe(true);
    const code = handoffRes.body.handoffCode;
    expect(code).toBeDefined();

    // 2. First exchange succeeds
    const exch1 = await invokeRoute(
      'POST',
      '/api/v1/auth/web-handoff/exchange',
      {},
      { handoffCode: code }
    );
    expect(exch1.status).toBe(200);
    expect(exch1.body.success).toBe(true);
    expect(exch1.body.token).toBe(userToken);

    // 3. Second exchange fails with 403
    const exch2 = await invokeRoute(
      'POST',
      '/api/v1/auth/web-handoff/exchange',
      {},
      { handoffCode: code }
    );
    expect(exch2.status).toBe(403);
    expect(exch2.body.success).toBe(false);
  });

  it('handles race conditions: concurrent exchange requests across replicas consume code exactly once', async () => {
    const handoffRes = await invokeRoute(
      'POST',
      '/api/v1/auth/web-handoff',
      { authorization: `Bearer ${userToken}` }
    );
    const code = handoffRes.body.handoffCode;

    // Send 5 concurrent exchange attempts simulating 5 replicas or concurrent callers
    const results = await Promise.all([
      invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, { handoffCode: code }),
      invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, { handoffCode: code }),
      invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, { handoffCode: code }),
      invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, { handoffCode: code }),
      invokeRoute('POST', '/api/v1/auth/web-handoff/exchange', {}, { handoffCode: code }),
    ]);

    const successes = results.filter((r) => r.status === 200);
    const forbidden = results.filter((r) => r.status === 403);

    expect(successes).toHaveLength(1);
    expect(forbidden).toHaveLength(4);
    expect(successes[0].body.token).toBe(userToken);
  });

  it('validates deviceId match when provided in exchange payload', async () => {
    const handoffRes = await invokeRoute(
      'POST',
      '/api/v1/auth/web-handoff',
      { authorization: `Bearer ${userToken}` }
    );
    const code = handoffRes.body.handoffCode;

    // Persist a session in central repository with an expected deviceId
    const repo = getCentralRepository();
    const codeWithDevice = `dev_code_${Date.now()}`;
    await repo.createWebHandoffSession({
      code: codeWithDevice,
      token: userToken,
      userJson: JSON.stringify({ id: userId, email: 'test@dev.com', deviceId: 'EXPECTED_DEVICE_001' }),
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });

    // Exchange with wrong deviceId returns 403
    const badDeviceRes = await invokeRoute(
      'POST',
      '/api/v1/auth/web-handoff/exchange',
      {},
      { handoffCode: codeWithDevice, deviceId: 'SPOOFED_DEVICE_999' }
    );
    expect(badDeviceRes.status).toBe(403);
    expect(badDeviceRes.body.error).toContain('device mismatch');
  });
});
