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
  deleteWorkflow,
  runWorkflow,
  runWorkflowBatch,
  getWorkflowLogs,
} from '../../09_AUTOMATION/automation-engine.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';

describe('10-Cycle Automation Engine Stress & Reliability Verification', () => {
  let tempDir: string;
  let profileIds: string[] = [];

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-10x-stress-'));
    const testDbPath = path.join(tempDir, 'test_10x.sqlite');
    await initSqlEngine();
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();

    // Create 3 test profiles
    for (let i = 1; i <= 3; i++) {
      const p = createProfile({
        name: `Stress-Profile-${i}`,
        settings: getDefaultProfileSettings(),
      });
      profileIds.push(p.id);
    }
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // Run 10 Consecutive Cycles of Real-Engine Execution
  for (let cycle = 1; cycle <= 10; cycle++) {
    it(
      `Cycle ${cycle}/10: Execute RPA pipeline with JS eval, scroll, sleep, screenshot, and DB logging`,
      async () => {
        const wf = saveWorkflow({
          name: `Stress-Workflow-Cycle-${cycle}`,
          steps: [
            {
              id: `step-1-c${cycle}`,
              order: 0,
              type: 'OPEN_URL',
              target: 'about:blank',
              timeoutMs: 8000,
            },
            {
              id: `step-2-c${cycle}`,
              order: 1,
              type: 'EVALUATE_JS',
              value: `document.title = "Cycle ${cycle} Active - Verified"; return document.title;`,
            },
            {
              id: `step-3-c${cycle}`,
              order: 2,
              type: 'EXTRACT_TITLE',
            },
            {
              id: `step-4-c${cycle}`,
              order: 3,
              type: 'RANDOM_SLEEP',
              value: '20-50',
            },
            {
              id: `step-5-c${cycle}`,
              order: 4,
              type: 'SCROLL',
              value: '200',
            },
            {
              id: `step-6-c${cycle}`,
              order: 5,
              type: 'SCREENSHOT',
            },
            {
              id: `step-7-c${cycle}`,
              order: 6,
              type: 'CLOSE_BROWSER',
            },
          ],
        });

        const profileId = profileIds[(cycle - 1) % profileIds.length];
        const result = await runWorkflow({
          workflowId: wf.id,
          profileId,
        });

        expect(result).toBeDefined();
        expect(result.status).toBe('SUCCESS');
        expect(result.stepLogs.length).toBe(7);
        expect(result.stepLogs[1].output).toContain(`Cycle ${cycle} Active - Verified`);
        expect(result.stepLogs[2].output).toContain(`Cycle ${cycle} Active - Verified`);
        expect(result.stepLogs[5].screenshotBase64).toBeDefined();

        // Verify DB persistence
        const logs = getWorkflowLogs(wf.id);
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].status).toBe('SUCCESS');

        // Cleanup workflow
        deleteWorkflow(wf.id);
      },
      60000
    );
  }

});
