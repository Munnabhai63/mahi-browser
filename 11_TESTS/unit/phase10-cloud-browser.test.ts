/**
 * MAHI Browser — Phase 10 Cloud Browser Infrastructure & Security Unit Tests
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  sessionScheduler,
  sessionGateway,
  resourceLimiter,
  workerProfileLoader,
} from '../../07_BACKEND/cloud-browser/index.js';
import {
  encryptProfileArchive,
  decryptProfileArchive,
} from '../../08_SECURITY/cloud-profile-crypto.js';
import {
  acquireProfileLock,
  releaseProfileLock,
  getProfileLockStatus,
} from '../../07_BACKEND/services/cloud-profile-service.js';

describe('Phase 10: Cloud Browser Infrastructure & Control Plane Architecture', () => {
  const testUserId = `user_cloud_test_${Date.now()}`;
  const testProfileId = `prof_cloud_test_${Date.now()}`;
  const testWorkspaceId = `ws_cloud_test_${Date.now()}`;

  beforeAll(async () => {
    await initSqlEngine();
    initializeDatabase();
  });

  beforeEach(() => {
    sessionScheduler.ensureDefaultWorkerNode();
  });

  // ==========================================================================
  // 1. Session Scheduler & Regional Worker Node Routing
  // ==========================================================================
  describe('1. Session Scheduler & Worker Pool', () => {
    it('should list all registered deployment regions with in-west as default', () => {
      const regions = sessionScheduler.getRegions();
      expect(regions.length).toBeGreaterThanOrEqual(4);

      const inWest = regions.find((r) => r.id === 'in-west');
      expect(inWest).toBeDefined();
      expect(inWest?.isDefault).toBe(true);

      const sg = regions.find((r) => r.id === 'sg-central');
      expect(sg).toBeDefined();
    });

    it('should allocate an online worker with capacity and update active sessions counter', () => {
      const worker = sessionScheduler.allocateWorker('in-west');
      expect(worker).toBeDefined();
      expect(worker.status).toBe('ONLINE');
      expect(worker.regionId).toBe('in-west');

      // Verify active session was incremented
      const db = getDatabase();
      const updated = db.prepare('SELECT active_sessions FROM cloud_browser_workers WHERE id = ?').get(worker.id) as any;
      expect(updated.active_sessions).toBeGreaterThanOrEqual(1);

      // Release worker slot
      sessionScheduler.releaseWorkerSlot(worker.id);
      const released = db.prepare('SELECT active_sessions FROM cloud_browser_workers WHERE id = ?').get(worker.id) as any;
      expect(released.active_sessions).toBe(updated.active_sessions - 1);
    });

    it('should track worker health heartbeat telemetry', () => {
      sessionScheduler.recordHeartbeat('worker-local-01', 12.5, 512.0, 'ONLINE');
      const db = getDatabase();
      const row = db.prepare('SELECT cpu_usage_pct, memory_usage_mb, status FROM cloud_browser_workers WHERE id = ?').get('worker-local-01') as any;
      expect(row.cpu_usage_pct).toBe(12.5);
      expect(row.memory_usage_mb).toBe(512.0);
      expect(row.status).toBe('ONLINE');
    });
  });

  // ==========================================================================
  // 2. Distributed Locking & Concurrent Session Conflict Protection
  // ==========================================================================
  describe('2. Distributed Profile Locking & Concurrency Protection', () => {
    it('should acquire distributed lock for cloud session and block concurrent desktop launch', () => {
      const lockDeviceId = `cloud-worker-${Date.now()}`;
      const res1 = acquireProfileLock(testUserId, testProfileId, lockDeviceId, 'MAHI Cloud Worker', 300);
      expect(res1.acquired).toBe(true);

      // Attempt concurrent launch from desktop device
      const res2 = acquireProfileLock(testUserId, testProfileId, 'desktop-device-01', 'Windows Desktop', 300);
      expect(res2.acquired).toBe(false);
      expect(res2.heldBy).toContain('MAHI Cloud Worker');

      // Clean release
      releaseProfileLock(testUserId, testProfileId, lockDeviceId);
      const statusAfter = getProfileLockStatus(testUserId, testProfileId);
      expect(statusAfter.isLocked).toBe(false);
    });
  });

  // ==========================================================================
  // 3. Zero-Knowledge Profile Crypto & Checksum Integrity
  // ==========================================================================
  describe('3. Zero-Knowledge Memory Decryption & Persistence Packaging', () => {
    it('should encrypt and decrypt profile archive with AES-256-GCM without data loss', () => {
      const payload = Buffer.from(JSON.stringify({
        cookies: [{ name: 'session_token', value: 'secret_123', domain: '.example.com' }],
        storage: { 'prefs.json': '{"theme":"dark"}' },
      }));

      const passphrase = 'test-cloud-zero-knowledge-secret-key';
      const pkg = encryptProfileArchive(payload, passphrase);

      expect(pkg.ciphertext).toBeDefined();
      expect(pkg.checksumSha256).toBeDefined();
      expect(pkg.encryptedDataKey).toBeDefined();
      expect(pkg.iv).toBeDefined();
      expect(pkg.authTag).toBeDefined();

      const decrypted = decryptProfileArchive({
        ciphertext: pkg.ciphertext,
        expectedChecksum: pkg.checksumSha256,
        encryptedDataKey: pkg.encryptedDataKey,
        iv: pkg.iv,
        authTag: pkg.authTag,
        userMasterKey: passphrase,
      });

      expect(decrypted.toString()).toBe(payload.toString());
    });

    it('should reject tampered or corrupted profile payload during download verification', () => {
      const payload = Buffer.from('profile_state_data');
      const passphrase = 'test-passphrase';
      const pkg = encryptProfileArchive(payload, passphrase);

      // Tamper with ciphertext
      const tamperedCiphertext = Buffer.from(pkg.ciphertext);
      tamperedCiphertext[0] ^= 0xff;

      expect(() => {
        decryptProfileArchive({
          ciphertext: tamperedCiphertext,
          expectedChecksum: pkg.checksumSha256, // Will fail checksum verification
          encryptedDataKey: pkg.encryptedDataKey,
          iv: pkg.iv,
          authTag: pkg.authTag,
          userMasterKey: passphrase,
        });
      }).toThrow(/Checksum verification failed/);
    });
  });

  // ==========================================================================
  // 4. Session Gateway Authentication & Stream Tokens
  // ==========================================================================
  describe('4. Session Gateway Security & Stream Token Validation', () => {
    it('should generate HMAC-signed short-lived stream token and verify authenticity', () => {
      const sessionId = 'session_test_abc_123';
      const token = sessionGateway.createStreamToken(sessionId, testUserId, 300);
      expect(token).toBeDefined();

      const isValid = sessionGateway.verifyStreamToken(token, sessionId, testUserId);
      expect(isValid).toBe(true);
    });

    it('should reject stream token with wrong session ID or wrong user ID (Cross-Tenant Protection)', () => {
      const sessionId = 'session_user_a';
      const token = sessionGateway.createStreamToken(sessionId, 'user_a', 300);

      // User B tries to use User A token
      const isCrossUserValid = sessionGateway.verifyStreamToken(token, sessionId, 'user_b');
      expect(isCrossUserValid).toBe(false);

      // Attacker tries to use token for another session
      const isCrossSessionValid = sessionGateway.verifyStreamToken(token, 'session_user_b', 'user_a');
      expect(isCrossSessionValid).toBe(false);
    });

    it('should reject expired stream token', () => {
      const sessionId = 'session_expired';
      // Token expired 10 seconds ago
      const token = sessionGateway.createStreamToken(sessionId, testUserId, -10);
      const isValid = sessionGateway.verifyStreamToken(token, sessionId, testUserId);
      expect(isValid).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Resource Limiter & Usage Accounting
  // ==========================================================================
  describe('5. Resource Limiter & Usage Accounting', () => {
    it('should track session usage and accurately write to cloud_browser_usage table', () => {
      const testSessionId = `sess_usage_${Date.now()}`;
      resourceLimiter.trackSession({
        session: {
          id: testSessionId,
          userId: testUserId,
          workspaceId: testWorkspaceId,
          profileId: testProfileId,
          regionId: 'in-west',
          status: 'RUNNING',
          resourceClass: 'STANDARD',
          profileVersion: 1,
          durationSeconds: 0,
          maxDurationSeconds: 3600,
          idleTimeoutSeconds: 600,
          lastActivityAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        onTimeout: async () => {},
        onWarning: () => {},
      });

      // Update activity
      resourceLimiter.touchActivity(testSessionId);

      // Finalize usage
      const duration = resourceLimiter.finalizeUsage(testSessionId);
      expect(duration).toBeGreaterThanOrEqual(0);

      const summary = resourceLimiter.getUserUsageSummary(testUserId);
      expect(summary.totalSessions).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 6. Isolated Worker Workspace Cleanup
  // ==========================================================================
  describe('6. Isolated Worker Directory Cleanup', () => {
    it('should securely wipe temporary session directory upon session termination', () => {
      const tempSessionDir = path.resolve('.mahi_data', 'test-cloud-cleanup', `session_${Date.now()}`);
      fs.mkdirSync(tempSessionDir, { recursive: true });
      fs.writeFileSync(path.join(tempSessionDir, 'session_cookies.json'), 'secret_cookie_data');

      expect(fs.existsSync(tempSessionDir)).toBe(true);
      workerProfileLoader.cleanWorkerDirectory(tempSessionDir);
      expect(fs.existsSync(tempSessionDir)).toBe(false);
    });
  });
});
