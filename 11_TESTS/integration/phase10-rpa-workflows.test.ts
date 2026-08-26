import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { createProfile } from '../../02_BROWSER/services/profile-service.js';
import {
  saveWorkflow,
  getWorkflows,
  getWorkflowById,
  deleteWorkflow,
  runWorkflow,
  runWorkflowBatch,
  getWorkflowLogs,
} from '../../09_AUTOMATION/automation-engine.js';
import { RPA_TEMPLATES } from '../../10_CONFIG/shared/constants/automation-templates.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('Phase 10: Visual No-Code RPA Workflow Studio & Real-Browser Automation Engine', () => {
  let tempDir: string;
  let profileId1: string;
  let profileId2: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase10-rpa-'));
    const testDbPath = path.join(tempDir, 'test_phase10.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    // Create 2 test profiles
    const p1 = createProfile({
      name: 'RPA-Profile-1',
      settings: getDefaultProfileSettings(),
    });
    const p2 = createProfile({
      name: 'RPA-Profile-2',
      settings: getDefaultProfileSettings(),
    });
    profileId1 = p1.id;
    profileId2 = p2.id;
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should load all 5 pre-built production RPA templates with structured step pipelines', () => {
    expect(RPA_TEMPLATES.length).toBe(5);

    const googleTpl = RPA_TEMPLATES.find((t) => t.id === 'google-organic-search');
    expect(googleTpl).toBeDefined();
    expect(googleTpl!.steps.some((s) => s.type === 'SEARCH')).toBe(true);
    expect(googleTpl!.steps.some((s) => s.type === 'SCROLL')).toBe(true);
    expect(googleTpl!.steps.some((s) => s.type === 'RANDOM_SLEEP')).toBe(true);

    const auditTpl = RPA_TEMPLATES.find((t) => t.id === 'fingerprint-ip-auditor');
    expect(auditTpl).toBeDefined();
    expect(auditTpl!.steps.some((s) => s.type === 'EXTRACT_TITLE')).toBe(true);
    expect(auditTpl!.steps.some((s) => s.type === 'SCREENSHOT')).toBe(true);
  });

  it('should save and retrieve a custom workflow with new RPA step types', () => {
    const saved = saveWorkflow({
      name: 'Multi-Step RPA Workflow',
      description: 'Tests new advanced RPA step types',
      defaultProfileId: profileId1,
      steps: [
        {
          id: 'step-1',
          order: 0,
          type: 'OPEN_URL',
          target: 'https://example.com',
          timeoutMs: 10000,
        },
        {
          id: 'step-2',
          order: 1,
          type: 'KEYPRESS',
          value: 'Enter',
        },
        {
          id: 'step-3',
          order: 2,
          type: 'SCROLL',
          value: '500',
        },
        {
          id: 'step-4',
          order: 3,
          type: 'RANDOM_SLEEP',
          value: '100-300',
        },
        {
          id: 'step-5',
          order: 4,
          type: 'EVALUATE_JS',
          value: 'return document.title;',
        },
        {
          id: 'step-6',
          order: 5,
          type: 'SCREENSHOT',
        },
      ],
    });

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Multi-Step RPA Workflow');
    expect(saved.steps.length).toBe(6);

    const retrieved = getWorkflowById(saved.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.steps[1].type).toBe('KEYPRESS');
    expect(retrieved!.steps[2].type).toBe('SCROLL');
    expect(retrieved!.steps[3].type).toBe('RANDOM_SLEEP');
    expect(retrieved!.steps[4].type).toBe('EVALUATE_JS');
  });

  it('should execute a multi-step RPA workflow and return step-by-step execution logs', async () => {
    // Quick test workflow
    const wf = saveWorkflow({
      name: 'Execute Test Workflow',
      steps: [
        {
          id: 'step-open',
          order: 0,
          type: 'OPEN_URL',
          target: 'about:blank',
          timeoutMs: 10000,
        },
        {
          id: 'step-js',
          order: 1,
          type: 'EVALUATE_JS',
          value: 'document.title = "MAHI Automation Active"; return document.title;',
        },
        {
          id: 'step-title',
          order: 2,
          type: 'EXTRACT_TITLE',
        },
        {
          id: 'step-sleep',
          order: 3,
          type: 'RANDOM_SLEEP',
          value: '50-150',
        },
        {
          id: 'step-scroll',
          order: 4,
          type: 'SCROLL',
          value: '100',
        },
        {
          id: 'step-snap',
          order: 5,
          type: 'SCREENSHOT',
        },
        {
          id: 'step-close',
          order: 6,
          type: 'CLOSE_BROWSER',
        },
      ],
    });

    const execution = await runWorkflow({
      workflowId: wf.id,
      profileId: profileId1,
    });

    expect(execution).toBeDefined();
    expect(execution.status).toBe('SUCCESS');
    expect(execution.stepLogs.length).toBe(7);
    expect(execution.stepLogs[0].status).toBe('SUCCESS');
    expect(execution.stepLogs[1].output).toContain('MAHI Automation Active');
    expect(execution.stepLogs[2].output).toContain('MAHI Automation Active');
    expect(execution.stepLogs[5].screenshotBase64).toBeDefined();

    // Verify logs persisted in database
    const savedLogs = getWorkflowLogs(wf.id);
    expect(savedLogs.length).toBeGreaterThan(0);
    expect(savedLogs[0].status).toBe('SUCCESS');
  }, 60000);

  it('should execute a batch workflow across multiple profiles sequentially', async () => {
    const wf = saveWorkflow({
      name: 'Batch Test Workflow',
      steps: [
        {
          id: 'step-b1',
          order: 0,
          type: 'OPEN_URL',
          target: 'about:blank',
          timeoutMs: 10000,
        },
        {
          id: 'step-b2',
          order: 1,
          type: 'RANDOM_SLEEP',
          value: '50-100',
        },
        {
          id: 'step-b3',
          order: 2,
          type: 'CLOSE_BROWSER',
        },
      ],
    });

    const batchResults = await runWorkflowBatch({
      workflowId: wf.id,
      profileIds: [profileId1, profileId2],
      delayMs: 100,
    });

    expect(batchResults.length).toBe(2);
    expect(batchResults[0].status).toBe('SUCCESS');
    expect(batchResults[1].status).toBe('SUCCESS');
  }, 60000);


  it('should continue execution when continueOnError is true on a failed step', async () => {
    const wf = saveWorkflow({
      name: 'Error Tolerance Workflow',
      steps: [
        {
          id: 'step-bad-click',
          order: 0,
          type: 'CLICK',
          target: '#non-existent-selector-12345',
          timeoutMs: 1000,
          continueOnError: true,
        },
        {
          id: 'step-after-error',
          order: 1,
          type: 'OPEN_URL',
          target: 'about:blank',
          timeoutMs: 10000,
        },
        {
          id: 'step-close-end',
          order: 2,
          type: 'CLOSE_BROWSER',
        },
      ],
    });

    const execution = await runWorkflow({
      workflowId: wf.id,
      profileId: profileId1,
    });

    expect(execution).toBeDefined();
    // Step 0 should be FAILED
    expect(execution.stepLogs[0].status).toBe('FAILED');
    // Step 1 should still execute because continueOnError was true
    expect(execution.stepLogs[1].status).toBe('SUCCESS');
  }, 25000);

  it('should delete a workflow and clean associated steps', () => {
    const wf = saveWorkflow({
      name: 'To Delete Workflow',
      steps: [
        {
          id: 's1',
          order: 0,
          type: 'OPEN_URL',
          target: 'https://example.com',
        },
      ],
    });

    const ok = deleteWorkflow(wf.id);
    expect(ok).toBe(true);
    expect(getWorkflowById(wf.id)).toBeNull();
  });
});
