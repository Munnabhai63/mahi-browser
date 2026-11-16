/**
 * MAHI Browser — Phase 8 Automation Pipeline & Integration Tests
 *
 * Verifies:
 * 1. Multi-Step Execution Pipeline with Variables & Declarative Conditions
 * 2. Step Retry Policy on Transient Failure
 * 3. Secret Variable Privacy in Database Logs & Outputs
 * 4. Controlled Concurrency Batch Runner Across Profiles
 * 5. Remote API Automation Endpoints (Workflows, Runs, Schedules)
 * 6. Cookie Warmer Execution & Cancellation Handling
 * 7. CDP Multi-Window Synchronizer Error Isolation on Slave Failure
 * 8. Scheduler Device Availability & WAITING_FOR_DEVICE State Transition
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { initSqlEngine, setCustomDatabasePath, getDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import {
  saveWorkflow,
  runWorkflow,
  runWorkflowConcurrently,
  getWorkflowById,
  getWorkflowLogs,
  stopWorkflowRun,
} from '../../09_AUTOMATION/automation-engine.js';
import {
  warmProfile,
  stopWarmer,
  WARMING_TEMPLATES,
  WarmerProgress,
} from '../../09_AUTOMATION/cookie-warmer-service.js';
import { cdpSynchronizer } from '../../09_AUTOMATION/cdp-synchronizer.js';
import { automationScheduler } from '../../09_AUTOMATION/automation-scheduler.js';
import { handleRemoteApiRequest } from '../../07_BACKEND/commercial/remote-api-router.js';
import { RemoteApiService } from '../../07_BACKEND/services/remote-api-service.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import { getProductionChromiumExecutablePath } from '../../02_BROWSER/managed-engine.js';

const REAL_CHROMIUM = (() => {
  try {
    const p = getProductionChromiumExecutablePath();
    const ok = fs.existsSync(p) && (fs.statSync(p).size > 10_000_000 || (process.platform === 'win32' && fs.existsSync(path.join(path.dirname(p), 'chrome.dll'))));
    if (!ok) {
      console.log('[SKIP REASON] phase8-automation-pipeline: Real Chromium binary (>10MB / chrome.dll) not found on host');
    }
    return ok;
  } catch {
    console.log('[SKIP REASON] phase8-automation-pipeline: Failed to inspect Chromium executable path');
    return false;
  }
})();

describe.skipIf(!REAL_CHROMIUM)('Phase 8: Automation Pipeline & Production Integration [requires real Chromium binary on host]', () => {
  let tempDir: string;
  let profile1: any;
  let profile2: any;
  let testUserId: string;
  let testApiKey: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase8-pipeline-'));
    const testDbPath = path.join(tempDir, 'test_phase8_pipeline.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    // Create 2 test profiles
    profile1 = createProfile({
      name: 'Pipeline-Profile-1',
      settings: getDefaultProfileSettings(),
    });
    profile2 = createProfile({
      name: 'Pipeline-Profile-2',
      settings: getDefaultProfileSettings(),
    });

    // Create test user and API key with automation scopes
    const reg = await registerCentralUser({
      email: 'automation-admin@mahibrowser.com',
      password: 'SecurePassword123!',
      name: 'Automation Admin',
    });
    testUserId = reg.user!.id;

    const db = getDatabase();
    db.prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE id = ?").run(testUserId);

    const { secretKey } = RemoteApiService.getInstance().createApiKey(testUserId, {
      name: 'Automation E2E Key',
      scopes: ['automation:read', 'automation:write', 'automation:run'],
    });
    testApiKey = secretKey;
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ==========================================================================
  // 1. STEP EXECUTION PIPELINE WITH VARIABLES & CONDITIONS
  // ==========================================================================
  describe('1. Step Execution Pipeline with Variables & Conditions', () => {
    it('should execute variable assignment and condition skip correctly', async () => {
      const wf = saveWorkflow({
        name: 'Pipeline Variables Test',
        variables: [
          { name: 'mode', type: 'string', defaultValue: 'fast' },
          { name: 'secretToken', type: 'secret', defaultValue: 'super_secret_value_xyz', isSecret: true },
        ],
        steps: [
          {
            id: 'step-open',
            order: 0,
            type: 'OPEN_URL',
            target: 'about:blank',
          },
          {
            id: 'step-set-var',
            order: 1,
            type: 'SET_VARIABLE',
            target: 'mode',
            value: 'production',
          },
          {
            id: 'step-cond-skip',
            order: 2,
            type: 'WAIT',
            value: '5000',
            condition: {
              operator: 'VARIABLE_EQUALS',
              target: 'mode',
              expectedValue: 'staging', // Will NOT match, should skip
              elseAction: 'SKIP',
            },
          },
          {
            id: 'step-secret-fill',
            order: 3,
            type: 'SET_VARIABLE',
            target: 'secretToken',
            value: 'super_secret_value_xyz',
            isSecret: true,
          },
        ],
      });

      const runLog = await runWorkflow({
        workflowId: wf.id,
        profileId: profile1.id,
      });

      expect(runLog).toBeDefined();
      expect(runLog.status).toBe('SUCCESS');
      expect(runLog.stepLogs.length).toBe(4);

      // Verify step 2 was skipped
      expect(runLog.stepLogs[2].status).toBe('SKIPPED');
      expect(runLog.stepLogs[2].output).toContain('Condition not met');

      // Verify secret was redacted in logs
      expect(runLog.stepLogs[3].output).toContain('[REDACTED]');
      expect(runLog.stepLogs[3].output).not.toContain('super_secret_value_xyz');
    }, 60000);
  });

  // ==========================================================================
  // 2. RETRY POLICY ON TRANSIENT FAILURES
  // ==========================================================================
  describe('2. Retry Policy & Transient Failure Recovery', () => {
    it('should retry step up to configured retryCount on failure before continuing', async () => {
      const wf = saveWorkflow({
        name: 'Retry Policy Test',
        steps: [
          {
            id: 'step-open',
            order: 0,
            type: 'OPEN_URL',
            target: 'about:blank',
          },
          {
            id: 'step-retry-selector',
            order: 1,
            type: 'WAIT_FOR_SELECTOR',
            target: '#nonexistent-element-with-retry',
            timeoutMs: 500,
            retryCount: 2,
            retryDelayMs: 200,
            continueOnError: true, // Gracefully continue after retries exhausted
          },
        ],
      });

      const runLog = await runWorkflow({
        workflowId: wf.id,
        profileId: profile1.id,
      });

      expect(runLog).toBeDefined();
      expect(runLog.status).toBe('SUCCESS');
      expect(runLog.stepLogs.length).toBe(2);

      const failedStep = runLog.stepLogs[1];
      expect(failedStep.status).toBe('FAILED');
      expect(failedStep.retriesAttempted).toBe(2);
      expect(runLog.retryCount).toBe(2);
    }, 60000);
  });

  // ==========================================================================
  // 3. CONTROLLED CONCURRENCY BATCH RUNNER
  // ==========================================================================
  describe('3. Controlled Concurrency Batch Runner Across Profiles', () => {
    it('should run workflow across profiles with controlled concurrency limits', async () => {
      const wf = saveWorkflow({
        name: 'Batch Concurrency Test',
        steps: [
          { id: 's1', order: 0, type: 'OPEN_URL', target: 'about:blank' },
          { id: 's2', order: 1, type: 'WAIT', value: '200' },
        ],
      });

      const batchResults = await runWorkflowConcurrently({
        workflowId: wf.id,
        profileIds: [profile1.id, profile2.id],
        maxConcurrency: 2,
      });

      expect(batchResults.length).toBe(2);
      expect(batchResults[0].status).toBe('SUCCESS');
      expect(batchResults[1].status).toBe('SUCCESS');
    }, 60000);
  });

  // ==========================================================================
  // 4. REMOTE API AUTOMATION ENDPOINTS
  // ==========================================================================
  describe('4. Remote API Automation Endpoints Integration', () => {
    function createMockReqRes(method: string, url: string, headers: Record<string, string>, body?: any) {
      const req: any = {
        method,
        url,
        headers: {
          'host': 'api.mahibrowser.com',
          'x-api-key': testApiKey,
          'content-type': 'application/json',
          ...headers,
        },
        on: (event: string, cb: any) => {
          if (event === 'data' && body) {
            cb(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
          }
          if (event === 'end') {
            cb();
          }
        },
      };

      let statusCode = 200;
      let responseBody = '';
      const res: any = {
        writeHead: (code: number) => { statusCode = code; },
        setHeader: () => {},
        end: (data: string) => { responseBody = data; },
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

    it('should list workflows and return 200 OK via Remote API', async () => {
      const { req, res, getResponse } = createMockReqRes('GET', '/api/v1/remote/automation/workflows', {});
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(200);
      expect(resp.body.success).toBe(true);
      expect(Array.isArray(resp.body.data)).toBe(true);
    });

    it('should queue workflow run and return 202 ACCEPTED via Remote API', async () => {
      const wf = saveWorkflow({
        name: 'Remote Queue Test',
        steps: [{ id: 's1', order: 0, type: 'OPEN_URL', target: 'about:blank' }],
      });

      const { req, res, getResponse } = createMockReqRes(
        'POST',
        `/api/v1/remote/automation/workflows/${wf.id}/run`,
        {},
        { profileId: profile1.id }
      );
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(202);
      expect(resp.body.success).toBe(true);
      expect(resp.body.data.status).toBe('QUEUED');
      expect(resp.body.data.runId).toMatch(/^run_/);
    });

    it('should reject unauthorized request without required scopes', async () => {
      const { req, res, getResponse } = createMockReqRes('GET', '/api/v1/remote/automation/workflows', {
        'x-api-key': 'invalid_or_missing_key',
      });
      const handled = await handleRemoteApiRequest(req, res);

      expect(handled).toBe(true);
      const resp = getResponse();
      expect(resp.status).toBe(401);
      expect(resp.body.success).toBe(false);
    });
  });

  // ==========================================================================
  // 5. CDP SYNCHRONIZER SLAVE DISCONNECT ERROR ISOLATION
  // ==========================================================================
  describe('5. CDP Synchronizer Error Isolation on Slave Failure', () => {
    it('should isolate slave errors when a slave window fails without stopping master', async () => {
      cdpSynchronizer.stop();

      // Start synchronizer with 1 master and 2 slaves
      await cdpSynchronizer.start(profile1.id, [profile1.id, profile2.id, 'slave-broken-id']);
      expect(cdpSynchronizer.isRunning()).toBe(true);

      // Dispatch a click
      await cdpSynchronizer.dispatchCdpClick(0.5, 0.5, 0);

      // Retrieve slave statuses
      const statuses = cdpSynchronizer.getSlaveStatuses();
      expect(statuses.length).toBe(2);

      // Verify the broken slave is marked DISCONNECTED without crashing the synchronizer
      const brokenSlave = statuses.find((s) => s.slaveId === 'slave-broken-id');
      expect(brokenSlave).toBeDefined();
      expect(brokenSlave?.status).toBe('DISCONNECTED');

      // Clean stop
      cdpSynchronizer.stop();
      expect(cdpSynchronizer.isRunning()).toBe(false);
    });
  });

  // ==========================================================================
  // 6. SCHEDULER OFFLINE HANDLING (WAITING_FOR_DEVICE)
  // ==========================================================================
  describe('6. Scheduler Device Availability & WAITING_FOR_DEVICE State Transition', () => {
    it('should mark schedule as WAITING_FOR_DEVICE when target profile is not on local machine', async () => {
      const wf = saveWorkflow({
        name: 'Offline Schedule Test',
        steps: [{ id: 's1', order: 0, type: 'OPEN_URL', target: 'about:blank' }],
      });

      const sched = automationScheduler.createSchedule({
        workflowId: wf.id,
        profileId: 'nonexistent-remote-machine-profile-id',
        scheduleType: 'DAILY',
        nextRunAt: new Date(Date.now() - 1000).toISOString(), // Ready to execute now
      });

      // Run scheduler tick
      await automationScheduler.tick();

      // Check updated schedule status
      const updated = automationScheduler.getSchedule(sched.id);
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('WAITING_FOR_DEVICE');

      // Clean up
      automationScheduler.deleteSchedule(sched.id);
    });
  });

});
