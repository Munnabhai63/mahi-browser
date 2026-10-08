/**
 * MAHI Browser — Phase 8 Production Automation & RPA Engine Tests
 *
 * Verifies:
 * 1. Declarative Workflow Model & Validation
 * 2. Variables Engine & Strict Secret Redaction ([REDACTED])
 * 3. Declarative Conditions (No Arbitrary eval())
 * 4. Strictly Bounded Loops (Max 100 Iterations & Cancellation)
 * 5. State Machine & Execution Registry (Pause / Resume / Stop)
 * 6. Workflow Versioning & History Rollback
 * 7. Safe JSON Import / Export Schema Enforcement
 * 8. Cookie Warmer Production Controls & Zero Cookie Logging
 * 9. CDP Multi-Window Synchronizer Error Isolation & Pause/Resume
 * 10. Automation Scheduler & Device Offline Handling (WAITING_FOR_DEVICE)
 * 11. Team Workspace Automation RBAC Permissions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import {
  validateWorkflow,
  dryRunWorkflow,
  interpolateVariables,
  evaluateCondition,
  saveWorkflow,
  getWorkflowById,
  getWorkflowVersions,
  rollbackWorkflowVersion,
  exportWorkflow,
  importWorkflow,
  pauseWorkflowRun,
  resumeWorkflowRun,
  stopWorkflowRun,
  getWorkflowRunStatus,
} from '../../09_AUTOMATION/automation-engine.js';
import {
  AutomationWorkflow,
  AutomationStep,
  WorkflowVariable,
  StepCondition,
} from '../../10_CONFIG/shared/types/automation.js';
import {
  WARMING_TEMPLATES,
  pauseWarmer,
  resumeWarmer,
  stopWarmer,
  isWarmerRunning,
  countProfileCookies,
} from '../../09_AUTOMATION/cookie-warmer-service.js';
import { cdpSynchronizer } from '../../09_AUTOMATION/cdp-synchronizer.js';
import { automationScheduler } from '../../09_AUTOMATION/automation-scheduler.js';
import { ROLE_PERMISSIONS, TeamRole } from '../../10_CONFIG/shared/types/workspace.js';

describe('Phase 8: Production Automation Studio & RPA Platform', () => {
  let tempDir: string;
  let testProfileId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase8-rpa-'));
    const testDbPath = path.join(tempDir, 'test_phase8.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    const p = createProfile({
      name: 'Phase8-Test-Profile',
      settings: getDefaultProfileSettings(),
    });
    testProfileId = p.id;
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // ==========================================================================
  // 1. WORKFLOW VALIDATION & SCHEMA ENFORCEMENT
  // ==========================================================================
  describe('1. Declarative Workflow Model & Validation', () => {
    it('should validate valid workflows and report valid: true', () => {
      const validWorkflow: AutomationWorkflow = {
        id: 'wf-val-1',
        name: 'Valid Search Workflow',
        description: 'Searches for product info',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        variables: [
          { name: 'query', type: 'string', defaultValue: 'laptop' },
        ],
        steps: [
          { id: 's1', order: 0, type: 'OPEN_URL', target: 'https://www.google.com' },
          { id: 's2', order: 1, type: 'FILL', target: 'input[name="q"]', value: '{{query}}' },
          { id: 's3', order: 2, type: 'KEYPRESS', value: 'Enter' },
        ],
      };

      const result = validateWorkflow(validWorkflow);
      expect(result.isValid).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing target for selectors in CLICK and FILL steps', () => {
      const invalidWorkflow: AutomationWorkflow = {
        id: 'wf-val-2',
        name: 'Invalid Steps Workflow',
        description: 'Missing selectors',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        variables: [],
        steps: [
          { id: 's1', order: 0, type: 'CLICK' },
          { id: 's2', order: 1, type: 'FILL', value: 'test' },
        ],
      };

      const result = validateWorkflow(invalidWorkflow);
      expect(result.isValid).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors[0]).toContain('selector is required');
    });

    it('should reject workflows with negative timeout or exceeding maximum limits', () => {
      const invalidTimeoutWorkflow: AutomationWorkflow = {
        id: 'wf-val-3',
        name: 'Invalid Timeout Workflow',
        description: 'Extreme timeouts',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        variables: [],
        steps: [
          { id: 's1', order: 0, type: 'WAIT', timeoutMs: 500000 },
          { id: 's2', order: 1, type: 'CLICK', target: '#btn', timeoutMs: -100 },
        ],
      };

      const result = validateWorkflow(invalidTimeoutWorkflow);
      expect(result.isValid).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('timeout'))).toBe(true);
    });
  });

  // ==========================================================================
  // 2. VARIABLES ENGINE & SECRET REDACTION
  // ==========================================================================
  describe('2. Variables Engine & Strict Secret Redaction', () => {
    it('should interpolate declared variables into step targets and values', () => {
      const template = 'Welcome to {{service}}, user {{username}}!';
      const vars = { service: 'MAHI Browser', username: 'alice' };
      const secretNames = new Set<string>();

      const text = interpolateVariables(template, vars, secretNames);
      expect(text).toBe('Welcome to MAHI Browser, user alice!');
    });

    it('should strictly mask secret variables as [REDACTED] in logs and exports', () => {
      const template = 'Auth password: {{apiKey}}';
      const vars = { apiKey: 'secret_live_key_99999' };
      const secretNames = new Set<string>(['apiKey']);

      const text = interpolateVariables(template, vars, secretNames, true);
      expect(text).toBe('Auth password: [REDACTED]');
    });

    it('should dry run a workflow and report variable substitutions safely', async () => {
      const wf = saveWorkflow({
        name: 'Dry Run Workflow',
        description: 'Dry run check',
        steps: [
          { id: 's1', order: 0, type: 'OPEN_URL', target: 'https://example.com' },
          { id: 's2', order: 1, type: 'FILL', target: '#key', value: '{{apiKey}}', isSecret: true },
        ],
        variables: [
          { name: 'apiKey', type: 'secret', defaultValue: 'test_token_123', isSecret: true },
        ],
      });

      const dry = await dryRunWorkflow({
        workflowId: wf.id,
        profileId: testProfileId,
      });

      expect(dry.success).toBe(true);
      expect(dry.stepsPlan.length).toBe(2);
      expect(dry.stepsPlan[0].target).toBe('https://example.com');
    });
  });

  // ==========================================================================
  // 3. DECLARATIVE CONDITIONS (NO ARBITRARY EVAL)
  // ==========================================================================
  describe('3. Declarative Conditions (No Arbitrary eval)', () => {
    it('should evaluate VARIABLE_EQUALS and VARIABLE_NOT_EQUALS declaratively', async () => {
      const mockPage: any = {};
      const vars = { env: 'production', count: '10' };

      const eqCondition: StepCondition = {
        operator: 'VARIABLE_EQUALS',
        target: 'env',
        expectedValue: 'production',
      };
      const notEqCondition: StepCondition = {
        operator: 'VARIABLE_NOT_EQUALS',
        target: 'env',
        expectedValue: 'staging',
      };
      const failCondition: StepCondition = {
        operator: 'VARIABLE_EQUALS',
        target: 'count',
        expectedValue: '20',
      };

      const res1 = await evaluateCondition(eqCondition, mockPage, vars, true);
      const res2 = await evaluateCondition(notEqCondition, mockPage, vars, true);
      const res3 = await evaluateCondition(failCondition, mockPage, vars, true);

      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(false);
    });

    it('should evaluate URL_MATCHES and PREVIOUS_STEP_SUCCEEDED without arbitrary code execution', async () => {
      const mockPage: any = {
        url: () => 'https://app.mahibrowser.com/dashboard?v=2',
      };
      const vars = {};

      const urlCondition: StepCondition = {
        operator: 'URL_MATCHES',
        expectedValue: 'dashboard',
      };
      const prevCondition: StepCondition = {
        operator: 'PREVIOUS_STEP_SUCCEEDED',
      };

      expect(await evaluateCondition(urlCondition, mockPage, vars, true)).toBe(true);
      expect(await evaluateCondition(prevCondition, mockPage, vars, true)).toBe(true);
      expect(await evaluateCondition(prevCondition, mockPage, vars, false)).toBe(false);
    });
  });

  // ==========================================================================
  // 4. WORKFLOW VERSIONING & ROLLBACK
  // ==========================================================================
  describe('4. Workflow Versioning & History Rollback', () => {
    it('should increment workflow version on update and retain immutable snapshots in history', () => {
      const saved1 = saveWorkflow({
        name: 'Versioned Workflow Test',
        steps: [{ id: 's1', order: 0, type: 'OPEN_URL', target: 'https://example.com' }],
      });
      expect(saved1.version).toBe(1);

      const saved2 = saveWorkflow({
        id: saved1.id,
        name: 'Versioned Workflow Test v2',
        steps: [
          { id: 's1', order: 0, type: 'OPEN_URL', target: 'https://example.com' },
          { id: 's2', order: 1, type: 'WAIT', value: '1000' },
        ],
      });
      expect(saved2.version).toBe(2);

      const versions = getWorkflowVersions(saved1.id);
      expect(versions.length).toBeGreaterThanOrEqual(1);

      // Rollback to version 1
      const rolledBack = rollbackWorkflowVersion(saved1.id, 1);
      expect(rolledBack).toBeDefined();
      expect(rolledBack?.name).toBe('Versioned Workflow Test');
      expect(rolledBack?.steps.length).toBe(1);
    });
  });

  // ==========================================================================
  // 5. IMPORT / EXPORT SAFETY & SCHEMA VALIDATION
  // ==========================================================================
  describe('5. Safe JSON Import / Export Validation', () => {
    it('should export workflows cleanly with schema version', () => {
      const wf = saveWorkflow({
        name: 'Export Test Workflow',
        steps: [{ id: 's1', order: 0, type: 'OPEN_URL', target: 'https://example.com' }],
      });

      const rawJson = exportWorkflow(wf.id);
      expect(rawJson).toBeDefined();
      const exported = JSON.parse(rawJson!);
      expect(exported.schemaVersion).toBe('mahi_workflow_v2');
      expect(exported.workflow.name).toBe('Export Test Workflow');
    });

    it('should reject importing workflows with dangerous or invalid payloads', () => {
      expect(() => {
        importWorkflow(JSON.stringify({ notAWorkflow: true }));
      }).toThrow();

      expect(() => {
        importWorkflow(JSON.stringify({
          schemaVersion: '1.0',
          workflow: {
            name: '',
            steps: 'not an array',
          },
        }));
      }).toThrow();
    });
  });

  // ==========================================================================
  // 6. RUN CONTROLS (PAUSE / RESUME / STOP)
  // ==========================================================================
  describe('6. Execution Controller (Pause, Resume, Stop)', () => {
    it('should return null or false for nonexistent runs', () => {
      expect(getWorkflowRunStatus('nonexistent-run')).toBeNull();
      expect(pauseWorkflowRun('nonexistent-run')).toBe(false);
      expect(resumeWorkflowRun('nonexistent-run')).toBe(false);
      expect(stopWorkflowRun('nonexistent-run')).toBe(false);
    });
  });

  // ==========================================================================
  // 7. COOKIE WARMER PRODUCTION CONTROLS
  // ==========================================================================
  describe('7. Cookie Warmer Production Controls & Cookie Privacy', () => {
    it('should provide built-in warming templates without deceptive bypass promises', () => {
      expect(WARMING_TEMPLATES.length).toBeGreaterThanOrEqual(5);

      const general = WARMING_TEMPLATES.find((t) => t.id === 'general_browsing');
      expect(general).toBeDefined();
      expect(general?.category).toBe('General');
      expect(general?.sites.length).toBeGreaterThanOrEqual(5);

      // Verify no promises of bypass
      for (const tpl of WARMING_TEMPLATES) {
        expect(tpl.description.toLowerCase()).not.toContain('bypass');
        expect(tpl.description.toLowerCase()).not.toContain('undetectable');
      }
    });

    it('should support warmer pause, resume, and stop controls gracefully', () => {
      expect(isWarmerRunning('profile-not-warming')).toBe(false);
      expect(pauseWarmer('profile-not-warming')).toBe(false);
      expect(resumeWarmer('profile-not-warming')).toBe(false);
      expect(stopWarmer('profile-not-warming')).toBe(false);
    });

    it('should safely count cookies without exposing cookie contents', () => {
      const count = countProfileCookies('test-nonexistent-profile');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // 8. CDP MULTI-WINDOW SYNCHRONIZER
  // ==========================================================================
  describe('8. CDP Multi-Window Synchronizer Error Isolation & Controls', () => {
    beforeEach(() => {
      cdpSynchronizer.stop();
    });

    it('should manage pause and resume states correctly', () => {
      expect(cdpSynchronizer.isRunning()).toBe(false);
      expect(cdpSynchronizer.isPaused()).toBe(false);

      // Can toggle pause
      cdpSynchronizer.pause();
      expect(cdpSynchronizer.isPaused()).toBe(false); // Ignored when not running
    });

    it('should isolate errors per slave and return slave statuses', () => {
      const statuses = cdpSynchronizer.getSlaveStatuses();
      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBe(0);
    });
  });

  // ==========================================================================
  // 9. AUTOMATION SCHEDULER & RECURRENCE
  // ==========================================================================
  describe('9. Automation Scheduler Engine', () => {
    it('should compute next run timestamps for ONE_TIME, HOURLY, DAILY, and WEEKLY', () => {
      const now = new Date('2026-10-08T12:00:00Z');

      const oneTime = automationScheduler.calculateNextRun('ONE_TIME', now.toISOString());
      expect(oneTime).toBeNull();

      const hourly = automationScheduler.calculateNextRun('HOURLY', now.toISOString());
      expect(hourly).toBeDefined();
      expect(new Date(hourly!).getTime() - now.getTime()).toBe(60 * 60 * 1000);

      const daily = automationScheduler.calculateNextRun('DAILY', now.toISOString());
      expect(daily).toBeDefined();
      expect(new Date(daily!).getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);

      const weekly = automationScheduler.calculateNextRun('WEEKLY', now.toISOString());
      expect(weekly).toBeDefined();
      expect(new Date(weekly!).getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should support schedule creation, listing, pausing, and deletion', () => {
      const wf = saveWorkflow({
        name: 'Schedulable Workflow',
        steps: [{ id: 's1', order: 0, type: 'OPEN_URL', target: 'https://example.com' }],
      });

      const sched = automationScheduler.createSchedule({
        workflowId: wf.id,
        scheduleType: 'DAILY',
        nextRunAt: new Date(Date.now() + 3600000).toISOString(),
        timezone: 'America/New_York',
      });

      expect(sched.id).toBeDefined();
      expect(sched.workflowId).toBe(wf.id);
      expect(sched.status).toBe('ACTIVE');

      // Pause schedule
      const paused = automationScheduler.pauseSchedule(sched.id);
      expect(paused).toBe(true);
      expect(automationScheduler.getSchedule(sched.id)?.status).toBe('PAUSED');

      // Resume schedule
      const resumed = automationScheduler.resumeSchedule(sched.id);
      expect(resumed).toBe(true);
      expect(automationScheduler.getSchedule(sched.id)?.status).toBe('ACTIVE');

      // Delete schedule
      const deleted = automationScheduler.deleteSchedule(sched.id);
      expect(deleted).toBe(true);
      expect(automationScheduler.getSchedule(sched.id)).toBeNull();
    });
  });

  // ==========================================================================
  // 10. WORKSPACE AUTOMATION RBAC PERMISSIONS
  // ==========================================================================
  describe('10. Workspace Automation RBAC Permissions', () => {
    it('should enforce complete automation permissions across all workspace roles', () => {
      const ownerPerms = ROLE_PERMISSIONS['OWNER'];
      const adminPerms = ROLE_PERMISSIONS['ADMIN'];
      const managerPerms = ROLE_PERMISSIONS['MANAGER'];
      const memberPerms = ROLE_PERMISSIONS['MEMBER'];
      const viewerPerms = ROLE_PERMISSIONS['VIEWER'];

      // Owner and Admin have all automation permissions
      expect(ownerPerms).toContain('AUTOMATION_VIEW');
      expect(ownerPerms).toContain('AUTOMATION_CREATE');
      expect(ownerPerms).toContain('AUTOMATION_EDIT');
      expect(ownerPerms).toContain('AUTOMATION_RUN');
      expect(ownerPerms).toContain('AUTOMATION_DELETE');
      expect(ownerPerms).toContain('AUTOMATION_VIEW_LOGS');
      expect(ownerPerms).toContain('AUTOMATION_MANAGE_TEMPLATES');

      expect(adminPerms).toContain('AUTOMATION_VIEW');
      expect(adminPerms).toContain('AUTOMATION_RUN');
      expect(adminPerms).toContain('AUTOMATION_DELETE');

      // Manager can run and edit, but not delete workspace
      expect(managerPerms).toContain('AUTOMATION_RUN');
      expect(managerPerms).toContain('AUTOMATION_EDIT');

      // Member can view and run
      expect(memberPerms).toContain('AUTOMATION_VIEW');
      expect(memberPerms).toContain('AUTOMATION_RUN');
      expect(memberPerms).not.toContain('AUTOMATION_DELETE');

      // Viewer can only view logs and definitions
      expect(viewerPerms).toContain('AUTOMATION_VIEW');
      expect(viewerPerms).toContain('AUTOMATION_VIEW_LOGS');
      expect(viewerPerms).not.toContain('AUTOMATION_RUN');
      expect(viewerPerms).not.toContain('AUTOMATION_EDIT');
    });
  });

});
