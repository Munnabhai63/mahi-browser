import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { processManager } from '../../02_BROWSER/process-manager.js';
import { createProfile, deleteProfile } from '../../02_BROWSER/services/profile-service.js';
import { closeDatabase, initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  createLocalApiServer,
  resolveCdpWebSocketEndpoint,
} from '../../07_BACKEND/api/local-api-server.js';
import { generateApiKey } from '../../07_BACKEND/services/api-v2-service.js';
import {
  type HumanizerPageLike,
  humanScroll,
  idleMouseMicroJitter,
} from '../../09_AUTOMATION/ai-humanizer.js';

describe('Layer 2 Step 1: Local CDP WebSocket Bridge & Humanizer Scroll/Jitter', () => {
  let apiServer: http.Server;
  let apiBaseUrl = '';
  let testApiKey = '';
  let testProfileId = '';
  let debugPort = 0;

  const testDbDir = path.resolve('.mahi_data', 'test-automation-cdp-isolated');
  const testDbPath = path.join(testDbDir, 'test_automation_cdp.sqlite');

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initSqlEngine();
    await initializeDatabase();

    const profile = createProfile({ name: 'Automation CDP Profile', engine: 'chrome' });
    testProfileId = profile.id;
    debugPort = getProfileDebugPort(testProfileId);

    const generated = generateApiKey('Automation Runner Key', 'local-owner', [
      'profiles:read',
      'profiles:write',
      'profiles:launch',
    ]);
    testApiKey = generated.secretKey;

    apiServer = createLocalApiServer();
    await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', () => resolve()));
    const addr = apiServer.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind local API test server');
    }
    apiBaseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (testProfileId) {
      try {
        deleteProfile(testProfileId);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (apiServer) {
      await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    }
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup errors
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function postJson(
    urlPath: string,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; data: Record<string, unknown> }> {
    const res = await fetch(`${apiBaseUrl}${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
    const data = (await res.json()) as Record<string, unknown>;
    return { status: res.status, data };
  }

  describe('POST /api/v1/profiles/:id/start-automation', () => {
    it('enforces Bearer token authentication (returns 401 when missing or invalid)', async () => {
      const startSpy = vi.spyOn(processManager, 'startProfile');

      const missingRes = await postJson(`/api/v1/profiles/${testProfileId}/start-automation`);
      expect(missingRes.status).toBe(401);
      expect(missingRes.data.success).toBe(false);

      const invalidRes = await postJson(`/api/v1/profiles/${testProfileId}/start-automation`, {
        Authorization: 'Bearer invalid-token-value',
      });
      expect(invalidRes.status).toBe(401);
      expect(invalidRes.data.success).toBe(false);
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('launches automation mode and resolves live Chromium wsEndpoint from /json/version', async () => {
      const expectedWs = `ws://127.0.0.1:${debugPort}/devtools/browser/mock-cdp-uuid-123`;
      const mockCdpServer = http.createServer((req, res) => {
        if (req.url === '/json/version') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              Browser: 'Chrome/132.0.0.0',
              webSocketDebuggerUrl: expectedWs,
            }),
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => mockCdpServer.listen(debugPort, '127.0.0.1', () => resolve()));

      try {
        vi.spyOn(processManager, 'isRunning').mockReturnValue(false);
        const startSpy = vi
          .spyOn(processManager, 'startProfile')
          .mockResolvedValue({ success: true, pid: 43210 });

        const res = await postJson(`/api/v1/profiles/${testProfileId}/start-automation`, {
          Authorization: `Bearer ${testApiKey}`,
        });

        expect(res.status).toBe(200);
        expect(startSpy).toHaveBeenCalledWith(testProfileId, { mode: 'automation' });
        expect(res.data).toMatchObject({
          success: true,
          profileId: testProfileId,
          pid: 43210,
          alreadyRunning: false,
          debugPort,
          httpEndpoint: `http://127.0.0.1:${debugPort}`,
          wsEndpoint: expectedWs,
        });
      } finally {
        await new Promise<void>((resolve) => mockCdpServer.close(() => resolve()));
      }
    });

    it('reuses an already-running profile instance without relaunching', async () => {
      const expectedWs = `ws://127.0.0.1:${debugPort}/devtools/browser/reused-instance-uuid`;
      const mockCdpServer = http.createServer((req, res) => {
        if (req.url === '/json/version') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ webSocketDebuggerUrl: expectedWs }));
          return;
        }
        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => mockCdpServer.listen(debugPort, '127.0.0.1', () => resolve()));

      try {
        vi.spyOn(processManager, 'isRunning').mockReturnValue(true);
        vi.spyOn(processManager, 'getActivePid').mockReturnValue(55112);
        const startSpy = vi.spyOn(processManager, 'startProfile');

        const res = await postJson(`/api/v1/profiles/${testProfileId}/start-automation`, {
          Authorization: `Bearer ${testApiKey}`,
        });

        expect(res.status).toBe(200);
        expect(startSpy).not.toHaveBeenCalled();
        expect(res.data).toMatchObject({
          success: true,
          profileId: testProfileId,
          pid: 55112,
          alreadyRunning: true,
          debugPort,
          httpEndpoint: `http://127.0.0.1:${debugPort}`,
          wsEndpoint: expectedWs,
        });
      } finally {
        await new Promise<void>((resolve) => mockCdpServer.close(() => resolve()));
      }
    });

    it('falls back cleanly when /json/version does not respond before timeout', async () => {
      const probeServer = http.createServer();
      await new Promise<void>((resolve) => probeServer.listen(0, '127.0.0.1', () => resolve()));
      const addr = probeServer.address();
      const unusedPort = addr && typeof addr !== 'string' ? addr.port : 48998;
      await new Promise<void>((resolve) => probeServer.close(() => resolve()));

      const resolved = await resolveCdpWebSocketEndpoint(unusedPort, {
        timeoutMs: 120,
        pollIntervalMs: 40,
        probeTimeoutMs: 50,
      });

      expect(resolved).toEqual({
        httpEndpoint: `http://127.0.0.1:${unusedPort}`,
        wsEndpoint: `ws://127.0.0.1:${unusedPort}/devtools/browser`,
        live: false,
      });
    });
  });

  describe('humanScroll', () => {
    it('executes multi-step 200-500px scroll increments with pauses and cursor drift', async () => {
      const wheelDeltas: number[] = [];
      const mouseMoves: Array<{ x: number; y: number }> = [];

      const mockPage: HumanizerPageLike = {
        mouse: {
          wheel: async (_dx: number, dy: number) => {
            wheelDeltas.push(dy);
          },
          move: async (x: number, y: number) => {
            mouseMoves.push({ x, y });
          },
        },
      };

      const result = await humanScroll(mockPage, 1400, {
        minChunkPx: 200,
        maxChunkPx: 500,
        minPauseMs: 5,
        maxPauseMs: 12,
        rereadChance: 0.25,
        minRereadPx: 40,
        maxRereadPx: 80,
        cursorPos: { x: 400, y: 300 },
        cursorDriftPx: 10,
      });

      expect(result.steps).toBeGreaterThanOrEqual(3);
      expect(result.totalScrolledY).toBe(1400);

      const netScroll = wheelDeltas.reduce((sum, delta) => sum + delta, 0);
      expect(netScroll).toBe(1400);

      const downwardSteps = wheelDeltas.filter((d) => d > 0);
      const upwardSteps = wheelDeltas.filter((d) => d < 0);

      expect(downwardSteps.length).toBeGreaterThanOrEqual(3);
      for (const step of downwardSteps) {
        expect(step).toBeGreaterThanOrEqual(1);
        expect(step).toBeLessThanOrEqual(500);
      }
      for (const back of upwardSteps) {
        expect(Math.abs(back)).toBeGreaterThanOrEqual(40);
        expect(Math.abs(back)).toBeLessThanOrEqual(80);
      }

      expect(mouseMoves.length).toBe(downwardSteps.length);
    });

    it('falls back to page.evaluate scrollBy when page.mouse.wheel is unavailable', async () => {
      const evaluatedDeltas: number[] = [];
      const mockPage: HumanizerPageLike = {
        evaluate: async (_fn, dy) => {
          evaluatedDeltas.push(dy);
        },
      };

      const result = await humanScroll(mockPage, 650, {
        minPauseMs: 2,
        maxPauseMs: 5,
        rereadChance: 0,
      });

      expect(result.totalScrolledY).toBe(650);
      expect(evaluatedDeltas.reduce((acc, v) => acc + v, 0)).toBe(650);
    });
  });

  describe('idleMouseMicroJitter', () => {
    it('produces bounded 1-2px micro-movements around currentPos', async () => {
      const moves: Array<{ x: number; y: number }> = [];
      const origin = { x: 300, y: 200 };

      const mockPage: HumanizerPageLike = {
        mouse: {
          move: async (x: number, y: number) => {
            moves.push({ x, y });
          },
        },
      };

      const count = await idleMouseMicroJitter(mockPage, origin, 85, {
        maxRadiusPx: 2,
        intervalMs: 15,
      });

      expect(count).toBeGreaterThanOrEqual(2);
      expect(moves.length).toBe(count);

      for (const pos of moves) {
        expect(Math.abs(pos.x - origin.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(pos.y - origin.y)).toBeLessThanOrEqual(2);
        expect(pos.x !== origin.x || pos.y !== origin.y).toBe(true);
      }
    });
  });
});
