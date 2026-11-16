import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import {
  acquireCloudLock,
  releaseCloudLock,
  releaseAllCloudLocks,
  getActiveLockHeartbeatCount,
} from '../../08_SECURITY/cloud-sync-service.js';

describe('Multi-Profile Redis Lock Heartbeat Isolation (FIX 1 Regression)', () => {
  let server: http.Server;
  let port: number;
  const originalEnvUrl = process.env.COMMERCIAL_API_URL;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk.toString();
      });
      req.on('end', () => {
        if (req.url?.includes('/api/v1/sync/lock/acquire')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ acquired: true, expiresAt: new Date(Date.now() + 300000).toISOString() }));
        } else if (req.url?.includes('/api/v1/sync/lock/release')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ released: true }));
        } else if (req.url?.includes('/api/v1/sync/lock/renew')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ renewed: true }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
          process.env.COMMERCIAL_API_URL = `http://127.0.0.1:${port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await releaseAllCloudLocks();
    if (originalEnvUrl !== undefined) {
      process.env.COMMERCIAL_API_URL = originalEnvUrl;
    } else {
      delete process.env.COMMERCIAL_API_URL;
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('maintains independent heartbeat renewal timers across concurrent active profiles', async () => {
    // Clean initial state
    await releaseAllCloudLocks();
    expect(getActiveLockHeartbeatCount()).toBe(0);

    // Profile 1 acquires lock
    const p1Res = await acquireCloudLock('profile-lock-test-1');
    expect(p1Res.acquired).toBe(true);
    expect(getActiveLockHeartbeatCount()).toBe(1);

    // Profile 2 acquires lock - must NOT clobber or kill Profile 1 heartbeat timer
    const p2Res = await acquireCloudLock('profile-lock-test-2');
    expect(p2Res.acquired).toBe(true);
    expect(getActiveLockHeartbeatCount()).toBe(2);

    // Profile 3 acquires lock
    const p3Res = await acquireCloudLock('profile-lock-test-3');
    expect(p3Res.acquired).toBe(true);
    expect(getActiveLockHeartbeatCount()).toBe(3);

    // Re-acquiring lock for Profile 1 refreshes its own timer without disturbing others
    const p1Reacquire = await acquireCloudLock('profile-lock-test-1');
    expect(p1Reacquire.acquired).toBe(true);
    expect(getActiveLockHeartbeatCount()).toBe(3);

    // Releasing Profile 2 removes strictly Profile 2 timer
    const p2Release = await releaseCloudLock('profile-lock-test-2');
    expect(p2Release).toBe(true);
    expect(getActiveLockHeartbeatCount()).toBe(2);

    // Profile 1 and 3 are still active and tracked
    const p1Release = await releaseCloudLock('profile-lock-test-1');
    expect(p1Release).toBe(true);
    expect(getActiveLockHeartbeatCount()).toBe(1);

    // releaseAllCloudLocks cleans up any remaining active heartbeats on process exit
    await releaseAllCloudLocks();
    expect(getActiveLockHeartbeatCount()).toBe(0);
  });
});
