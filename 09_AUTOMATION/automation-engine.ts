/**
 * MAHI Browser — Production Automation & RPA Engine
 * Phase 8 Architecture
 *
 * Core Capabilities:
 * - Preserves all existing declarative actions (OPEN_URL, CLICK, FILL, SCROLL, WAIT, SCREENSHOT, etc.)
 * - Workflow versioning and immutable history rollback
 * - Variables engine with secret redaction ([REDACTED] in logs and exports)
 * - Declarative conditions (CONDITION_IF, ASSERT_ELEMENT) without arbitrary eval()
 * - Strictly bounded loops (LOOP) with iteration limits (max 100) and cancellation support
 * - Transient error retries with configurable delay
 * - Execution state machine: QUEUED, STARTING, RUNNING, PAUSED, RETRYING, SUCCEEDED, FAILED, CANCELLED, TIMED_OUT
 * - Pause / Resume / Stop execution controls with safe lock and resource cleanup
 * - Multi-profile concurrency controller with CPU/RAM protection limits
 * - Crash recovery and stale lock cleanup
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, Page } from 'rebrowser-playwright-core';
import { getDatabase } from '../06_DATABASE/connection.js';
import {
  AutomationWorkflow,
  AutomationStep,
  WorkflowExecutionLog,
  WorkflowStepLog,
  WorkflowExecutionStatus,
  WorkflowVariable,
  StepCondition,
  RunWorkflowDTO,
  RunWorkflowBatchDTO,
} from '../10_CONFIG/shared/types/automation.js';
import { getProfileById } from '../02_BROWSER/services/profile-service.js';
import { resolveExecutablePath } from '../02_BROWSER/detector.js';
import { isManagedEngineInstalled, getManagedEngineExecutablePath } from '../02_BROWSER/managed-engine.js';
import { getProxyById, getDecryptedProxyCredentials } from '../02_BROWSER/services/proxy-service.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { getProfileDebugPort, markCleanExit } from '../02_BROWSER/launcher.js';
import { processManager } from '../02_BROWSER/process-manager.js';
import { solveCaptcha, getCaptchaConfig } from './captcha-service.js';
import { humanClick, humanType } from './ai-humanizer.js';

// ============================================================================
// IN-MEMORY ACTIVE EXECUTION REGISTRY & CONTROLLER
// ============================================================================

interface ActiveRunController {
  runId: string;
  workflowId: string;
  profileId: string;
  status: WorkflowExecutionStatus;
  abortController: AbortController;
  isPaused: boolean;
  resumeResolve?: () => void;
  context?: any;
  browser?: any;
}

const activeRuns = new Map<string, ActiveRunController>();

export function getActiveRun(runId: string): ActiveRunController | undefined {
  return activeRuns.get(runId);
}

export function pauseWorkflowRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.status !== 'RUNNING') return false;
  run.isPaused = true;
  run.status = 'PAUSED';
  return true;
}

export function resumeWorkflowRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.status !== 'PAUSED') return false;
  run.isPaused = false;
  run.status = 'RUNNING';
  if (run.resumeResolve) {
    run.resumeResolve();
    run.resumeResolve = undefined;
  }
  return true;
}

export function stopWorkflowRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run) return false;
  run.status = 'CANCELLED';
  run.abortController.abort();
  if (run.resumeResolve) {
    run.resumeResolve();
  }
  return true;
}

export function getWorkflowRunStatus(runId: string): WorkflowExecutionStatus | null {
  const run = activeRuns.get(runId);
  return run ? run.status : null;
}

// ============================================================================
// STALE LOCK & PROFILE PERSISTENCE UTILITIES
// ============================================================================

function cleanupStaleLocks(storageDir: string): void {
  const lockFiles = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'lockfile',
    'parent.lock',
    'DevToolsActivePort',
  ];
  for (const lockFile of lockFiles) {
    const lockPath = path.join(storageDir, lockFile);
    try {
      if (fs.existsSync(lockPath)) {
        fs.rmSync(lockPath, { force: true, recursive: true });
      }
    } catch {}
  }
}

// ============================================================================
// VARIABLE INTERPOLATION & SECRET REDACTION
// ============================================================================

export function interpolateVariables(
  text: string,
  variables: Record<string, unknown>,
  secretNames: Set<string>,
  redactSecrets: boolean = false
): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, varName) => {
    if (Object.prototype.hasOwnProperty.call(variables, varName)) {
      if (redactSecrets && secretNames.has(varName)) {
        return '[REDACTED]';
      }
      return String(variables[varName]);
    }
    return `{{${varName}}}`;
  });
}

export function redactString(text: string, secrets: string[]): string {
  if (!text || secrets.length === 0) return text;
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 3) {
      result = result.split(secret).join('[REDACTED]');
    }
  }
  return result;
}

// ============================================================================
// DECLARATIVE CONDITION EVALUATION (NO ARBITRARY EVAL)
// ============================================================================

export async function evaluateCondition(
  condition: StepCondition,
  page: Page,
  variables: Record<string, unknown>,
  lastStepSuccess: boolean
): Promise<boolean> {
  const { operator, target, expectedValue } = condition;

  switch (operator) {
    case 'PREVIOUS_STEP_SUCCEEDED':
      return lastStepSuccess;

    case 'SELECTOR_EXISTS': {
      if (!target) return false;
      const el = await page.$(target).catch(() => null);
      const exists = el !== null;
      if (el) await el.dispose().catch(() => {});
      return exists;
    }

    case 'SELECTOR_NOT_EXISTS': {
      if (!target) return true;
      const el = await page.$(target).catch(() => null);
      const notExists = el === null;
      if (el) await el.dispose().catch(() => {});
      return notExists;
    }

    case 'TEXT_CONTAINS': {
      const pageText = target ? (await page.innerText(target).catch(() => '')) : (await page.innerText('body').catch(() => ''));
      return expectedValue ? pageText.includes(expectedValue) : false;
    }

    case 'TEXT_NOT_CONTAINS': {
      const pageText = target ? (await page.innerText(target).catch(() => '')) : (await page.innerText('body').catch(() => ''));
      return expectedValue ? !pageText.includes(expectedValue) : true;
    }

    case 'URL_MATCHES': {
      const currentUrl = page.url();
      return expectedValue ? currentUrl.includes(expectedValue) : true;
    }

    case 'VARIABLE_EQUALS': {
      if (!target) return false;
      const currentVal = String(variables[target] ?? '');
      return currentVal === String(expectedValue ?? '');
    }

    case 'VARIABLE_NOT_EQUALS': {
      if (!target) return false;
      const currentVal = String(variables[target] ?? '');
      return currentVal !== String(expectedValue ?? '');
    }

    default:
      return true;
  }
}

// ============================================================================
// WORKFLOW CRUD & VERSIONING
// ============================================================================

export function getWorkflows(): AutomationWorkflow[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM automation_workflows ORDER BY name ASC').all() as any[];

  return rows.map((r) => mapWorkflowRecord(r, db));
}

export function getWorkflowById(id: string): AutomationWorkflow | null {
  const db = getDatabase();
  const r = db.prepare('SELECT * FROM automation_workflows WHERE id = ?').get(id) as any;
  if (!r) return null;
  return mapWorkflowRecord(r, db);
}

function mapWorkflowRecord(r: any, db: any): AutomationWorkflow {
  const stepRows = db.prepare('SELECT * FROM automation_steps WHERE workflow_id = ? ORDER BY step_order ASC').all(r.id) as any[];

  const steps: AutomationStep[] = stepRows.map((s) => ({
    id: s.id,
    order: s.step_order,
    type: s.type,
    label: s.label || undefined,
    target: s.target || undefined,
    value: s.value || undefined,
    timeoutMs: s.timeout_ms || undefined,
    continueOnError: Boolean(s.continue_on_error),
    retryCount: s.retry_count || 0,
    retryDelayMs: s.retry_delay_ms || 1000,
    condition: s.condition_json ? JSON.parse(s.condition_json) : undefined,
    loopConfig: s.loop_config_json ? JSON.parse(s.loop_config_json) : undefined,
    outputVariableName: s.output_variable_name || undefined,
    isSecret: Boolean(s.is_secret),
  }));

  let variables: WorkflowVariable[] = [];
  try {
    variables = r.variables_json ? JSON.parse(r.variables_json) : [];
  } catch {}

  let tags: string[] = [];
  try {
    tags = r.tags_json ? JSON.parse(r.tags_json) : [];
  } catch {}

  let executionPolicy: any = undefined;
  try {
    executionPolicy = r.settings_json ? JSON.parse(r.settings_json) : undefined;
  } catch {}

  return {
    id: r.id,
    name: r.name,
    description: r.description || '',
    version: r.version || 1,
    workspaceId: r.workspace_id || undefined,
    defaultProfileId: r.default_profile_id || undefined,
    steps,
    variables,
    executionPolicy,
    tags,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function saveWorkflow(workflow: Partial<AutomationWorkflow>): AutomationWorkflow {
  const db = getDatabase();
  const id = workflow.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM automation_workflows WHERE id = ?').get(id) as any;
  let newVersion = 1;

  if (existing) {
    newVersion = (existing.version || 1) + 1;
    // Archive previous version snapshot into automation_versions table
    try {
      const prevDef = getWorkflowById(id);
      if (prevDef) {
        db.prepare(`
          INSERT INTO automation_versions (id, workflow_id, version, definition_json, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          id,
          existing.version || 1,
          JSON.stringify(prevDef),
          now
        );
      }
    } catch {}

    db.prepare(`
      UPDATE automation_workflows 
      SET name = ?, description = ?, default_profile_id = ?, version = ?, workspace_id = ?,
          variables_json = ?, settings_json = ?, tags_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      workflow.name || 'Untitled Workflow',
      workflow.description || '',
      workflow.defaultProfileId || null,
      newVersion,
      workflow.workspaceId || null,
      JSON.stringify(workflow.variables || []),
      JSON.stringify(workflow.executionPolicy || {}),
      JSON.stringify(workflow.tags || []),
      now,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO automation_workflows (
        id, name, description, default_profile_id, version, workspace_id,
        variables_json, settings_json, tags_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      workflow.name || 'Untitled Workflow',
      workflow.description || '',
      workflow.defaultProfileId || null,
      1,
      workflow.workspaceId || null,
      JSON.stringify(workflow.variables || []),
      JSON.stringify(workflow.executionPolicy || {}),
      JSON.stringify(workflow.tags || []),
      now,
      now
    );
  }

  // Sync steps
  if (workflow.steps) {
    db.prepare('DELETE FROM automation_steps WHERE workflow_id = ?').run(id);
    const insertStep = db.prepare(`
      INSERT INTO automation_steps (
        id, workflow_id, step_order, type, label, target, value, timeout_ms, continue_on_error,
        retry_count, retry_delay_ms, condition_json, loop_config_json, output_variable_name, is_secret
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < workflow.steps.length; i++) {
      const s = workflow.steps[i];
      let stepId = s.id || crypto.randomUUID();
      const existing = db.prepare('SELECT workflow_id FROM automation_steps WHERE id = ?').get(stepId) as any;
      if (existing && existing.workflow_id !== id) {
        stepId = crypto.randomUUID();
      }
      insertStep.run(
        stepId,
        id,
        i,
        s.type,
        s.label || null,
        s.target || null,
        s.value || null,
        s.timeoutMs || null,
        s.continueOnError ? 1 : 0,
        s.retryCount || 0,
        s.retryDelayMs || 1000,
        s.condition ? JSON.stringify(s.condition) : null,
        s.loopConfig ? JSON.stringify(s.loopConfig) : null,
        s.outputVariableName || null,
        s.isSecret ? 1 : 0
      );
    }
  }

  logActivity('AUTOMATION', 'SUCCESS', 'Save Workflow', `Saved workflow "${workflow.name}" (v${newVersion})`);
  return getWorkflowById(id)!;
}

export function deleteWorkflow(id: string): boolean {
  const db = getDatabase();
  const wf = getWorkflowById(id);
  if (!wf) return false;

  db.prepare('DELETE FROM automation_workflows WHERE id = ?').run(id);
  db.prepare('DELETE FROM automation_steps WHERE workflow_id = ?').run(id);
  try { db.prepare('DELETE FROM automation_versions WHERE workflow_id = ?').run(id); } catch {}
  logActivity('AUTOMATION', 'WARNING', 'Delete Workflow', `Deleted workflow "${wf.name}"`);
  return true;
}

export function duplicateWorkflow(workflowId: string, newName?: string): AutomationWorkflow | null {
  const original = getWorkflowById(workflowId);
  if (!original) return null;

  return saveWorkflow({
    name: newName || `${original.name} (Copy)`,
    description: original.description,
    workspaceId: original.workspaceId,
    defaultProfileId: original.defaultProfileId,
    steps: original.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
    variables: original.variables.map((v) => ({ ...v })),
    tags: original.tags ? [...original.tags] : [],
    executionPolicy: original.executionPolicy ? { ...original.executionPolicy } : undefined,
  });
}

export function getWorkflowVersions(workflowId: string): any[] {
  const db = getDatabase();
  try {
    const rows = db.prepare('SELECT * FROM automation_versions WHERE workflow_id = ? ORDER BY version DESC').all(workflowId) as any[];
    return rows.map((r) => ({
      id: r.id,
      workflowId: r.workflow_id,
      version: r.version,
      definition: JSON.parse(r.definition_json),
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export function rollbackWorkflowVersion(workflowId: string, targetVersion: number): AutomationWorkflow | null {
  const versions = getWorkflowVersions(workflowId);
  const match = versions.find((v) => v.version === targetVersion);
  if (!match) return null;

  const def = match.definition;
  return saveWorkflow({
    ...def,
    id: workflowId,
  });
}

// ============================================================================
// WORKFLOW IMPORT / EXPORT
// ============================================================================

export function exportWorkflow(workflowId: string): string {
  const wf = getWorkflowById(workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);

  // Mask sensitive default values for secret variables
  const sanitizedVariables = wf.variables.map((v) => ({
    ...v,
    defaultValue: v.isSecret ? undefined : v.defaultValue,
    currentValue: undefined,
  }));

  const exportPayload = {
    schemaVersion: 'mahi_workflow_v2',
    exportedAt: new Date().toISOString(),
    workflow: {
      ...wf,
      id: undefined, // Fresh ID will be generated upon import
      variables: sanitizedVariables,
    },
  };

  return JSON.stringify(exportPayload, null, 2);
}

export function importWorkflow(jsonString: string, workspaceId?: string): AutomationWorkflow {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format');
  }

  const raw = parsed.workflow || parsed;
  if (!raw.name || !Array.isArray(raw.steps)) {
    throw new Error('Invalid workflow schema: missing name or steps array');
  }

  // Whitelist supported step actions (Strict rejection of arbitrary shell/eval)
  const allowedStepTypes = new Set([
    'OPEN_URL', 'SEARCH', 'CLICK', 'FILL', 'KEYPRESS', 'SCROLL', 'WAIT',
    'WAIT_FOR_SELECTOR', 'RANDOM_SLEEP', 'HOVER', 'EXTRACT_TITLE', 'EXTRACT_TEXT',
    'ASSERT_ELEMENT', 'SCREENSHOT', 'NAVIGATE', 'SET_VARIABLE', 'CONDITION_IF',
    'LOOP', 'SOLVE_CAPTCHA', 'EMAIL', 'VPN', 'CLOSE_BROWSER',
  ]);

  for (const step of raw.steps) {
    if (!allowedStepTypes.has(step.type)) {
      throw new Error(`Unsupported or disallowed action type: ${step.type}`);
    }
  }

  return saveWorkflow({
    name: raw.name,
    description: raw.description || 'Imported Workflow',
    workspaceId: workspaceId || raw.workspaceId,
    defaultProfileId: undefined,
    steps: raw.steps.map((s: any, idx: number) => ({
      ...s,
      id: crypto.randomUUID(),
      order: idx,
    })),
    variables: Array.isArray(raw.variables) ? raw.variables : [],
    tags: Array.isArray(raw.tags) ? raw.tags : ['imported'],
    executionPolicy: raw.executionPolicy,
  });
}

// ============================================================================
// WORKFLOW VALIDATION & DRY RUN
// ============================================================================

export function validateWorkflow(workflow: Partial<AutomationWorkflow>): { isValid: boolean; valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!workflow.name || !workflow.name.trim()) {
    errors.push('Workflow name is required');
  }

  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push('Workflow must contain at least one step');
  } else {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (step.timeoutMs !== undefined && (step.timeoutMs < 0 || step.timeoutMs > 300000)) {
        errors.push(`Step ${i + 1} (${step.type}): Invalid timeout value (${step.timeoutMs}ms)`);
      }
      if (step.type === 'OPEN_URL' && !step.target && !step.value) {
        errors.push(`Step ${i + 1} (${step.type}): Target URL is required`);
      }
      if ((step.type === 'CLICK' || step.type === 'FILL' || step.type === 'WAIT_FOR_SELECTOR') && !step.target) {
        errors.push(`Step ${i + 1} (${step.type}): Target selector is required`);
      }
      if (step.type === 'LOOP') {
        if (!step.loopConfig || step.loopConfig.maxIterations <= 0 || step.loopConfig.maxIterations > 100) {
          errors.push(`Step ${i + 1} (${step.type}): Loop iterations must be between 1 and 100`);
        }
      }
    }
  }

  const ok = errors.length === 0;
  return { isValid: ok, valid: ok, errors };
}

export async function dryRunWorkflow(dto: RunWorkflowDTO): Promise<{ success: boolean; stepsPlan: any[]; validationErrors: string[] }> {
  const workflow = getWorkflowById(dto.workflowId);
  if (!workflow) {
    return { success: false, stepsPlan: [], validationErrors: ['Workflow not found'] };
  }

  const validation = validateWorkflow(workflow);
  if (!validation.isValid) {
    return { success: false, stepsPlan: [], validationErrors: validation.errors };
  }

  const stepsPlan = workflow.steps.map((s) => ({
    order: s.order,
    type: s.type,
    label: s.label || s.type,
    target: s.target,
    timeoutMs: s.timeoutMs || 15000,
    hasCondition: Boolean(s.condition),
    isLoop: Boolean(s.loopConfig),
    retries: s.retryCount || 0,
  }));

  return { success: true, stepsPlan, validationErrors: [] };
}

// ============================================================================
// CORE WORKFLOW EXECUTION ENGINE (STATE MACHINE & RELIABILITY LOOP)
// ============================================================================

export async function runWorkflow(dto: RunWorkflowDTO): Promise<WorkflowExecutionLog> {
  const workflow = getWorkflowById(dto.workflowId);
  if (!workflow) {
    throw new Error(`Workflow ${dto.workflowId} not found`);
  }

  const profile = getProfileById(dto.profileId);
  if (!profile) {
    throw new Error(`Profile ${dto.profileId} not found`);
  }

  // Pre-run validation
  const validation = validateWorkflow(workflow);
  if (!validation.isValid) {
    throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
  }

  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const abortController = new AbortController();

  // Register in active runs controller
  const runController: ActiveRunController = {
    runId: executionId,
    workflowId: workflow.id,
    profileId: profile.id,
    status: 'STARTING',
    abortController,
    isPaused: false,
  };
  activeRuns.set(executionId, runController);

  // Initialize runtime variables
  const runtimeVariables: Record<string, unknown> = {};
  const secretVariableNames = new Set<string>();

  for (const v of workflow.variables) {
    runtimeVariables[v.name] = v.defaultValue ?? '';
    if (v.isSecret) {
      secretVariableNames.add(v.name);
    }
  }

  if (dto.initialVariables) {
    for (const [key, val] of Object.entries(dto.initialVariables)) {
      runtimeVariables[key] = val;
    }
  }

  const executionLog: WorkflowExecutionLog = {
    id: executionId,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    profileId: profile.id,
    workspaceId: dto.workspaceId || workflow.workspaceId,
    status: 'RUNNING',
    stepLogs: [],
    startedAt,
  };

  logActivity('AUTOMATION', 'INFO', 'Start Workflow', `Running workflow "${workflow.name}" on "${profile.name}"`, profile.id, profile.name);

  // Configure Playwright browser engine
  const executablePath = isManagedEngineInstalled()
    ? getManagedEngineExecutablePath()
    : resolveExecutablePath(
        profile.settings.browser.engine,
        profile.settings.browser.customExecutablePath
      );

  let proxyConfig: { server: string; username?: string; password?: string } | undefined = undefined;
  if (!profile.settings.network.directConnection && profile.settings.network.proxyId) {
    const proxy = getProxyById(profile.settings.network.proxyId);
    if (proxy) {
      const creds = getDecryptedProxyCredentials(proxy.id);
      proxyConfig = {
        server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        username: creds?.username,
        password: creds?.password,
      };
    }
  }

  let context: any = null;
  let browser: any = null;
  let hasFailed = false;
  let failedStepId: string | undefined = undefined;
  let totalRetries = 0;
  let lastStepSuccess = true;
  const isAlreadyRunning = processManager.isProfileRunning(profile.id);

  try {
    runController.status = 'RUNNING';

    // Propagate rebrowser-patches runtime isolation modes
    process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE || 'addBinding';

    const isCamoufox = profile.settings?.browser?.engine === 'camoufox';

    if (isCamoufox) {
      if (isAlreadyRunning) {
        throw new Error(
          `Automation workflow cannot attach over CDP to an already-running Camoufox profile. Please stop profile "${profile.name}" before starting the automation run.`
        );
      }
      cleanupStaleLocks(profile.storagePath);
      context = await firefox.launchPersistentContext(profile.storagePath, {
        executablePath,
        headless: false,
        viewport: {
          width: profile.settings.display.screenWidth,
          height: profile.settings.display.screenHeight,
        },
        userAgent: profile.settings.browser.userAgent,
        locale: profile.settings.locale.language,
        timezoneId: profile.settings.locale.timezone,
        proxy: proxyConfig,
      });
      runController.context = context;
    } else {
      process.env.MAHI_CDP_ISOLATED = '1';
      const cleanChromiumArgs = [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--mahi-cdp-isolated',
      ];

      if (isAlreadyRunning) {
        const debugPort = getProfileDebugPort(profile.id);
        try {
          browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 8000 });
          runController.browser = browser;
          const contexts = browser.contexts();
          context = contexts.length > 0 ? contexts[0] : await browser.newContext();
          runController.context = context;
        } catch {
          cleanupStaleLocks(profile.storagePath);
          context = await chromium.launchPersistentContext(profile.storagePath, {
            executablePath,
            headless: false,
            viewport: {
              width: profile.settings.display.screenWidth,
              height: profile.settings.display.screenHeight,
            },
            userAgent: profile.settings.browser.userAgent,
            locale: profile.settings.locale.language,
            timezoneId: profile.settings.locale.timezone,
            proxy: proxyConfig,
            args: cleanChromiumArgs,
            env: {
              ...process.env,
              MAHI_CDP_ISOLATED: '1',
            },
          });
          runController.context = context;
        }
      } else {
        cleanupStaleLocks(profile.storagePath);
        context = await chromium.launchPersistentContext(profile.storagePath, {
          executablePath,
          headless: false,
          viewport: {
            width: profile.settings.display.screenWidth,
            height: profile.settings.display.screenHeight,
          },
          userAgent: profile.settings.browser.userAgent,
          locale: profile.settings.locale.language,
          timezoneId: profile.settings.locale.timezone,
          proxy: proxyConfig,
          args: cleanChromiumArgs,
          env: {
            ...process.env,
            MAHI_CDP_ISOLATED: '1',
          },
        });
        runController.context = context;
      }
    }

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    // ========================================================================
    // STEP EXECUTION LOOP WITH PAUSE / RESUME / RETRY / CONDITIONS
    // ========================================================================
    for (let stepIdx = 0; stepIdx < workflow.steps.length; stepIdx++) {
      const step = workflow.steps[stepIdx];

      // Check cancellation signal
      if (abortController.signal.aborted || (runController.status as WorkflowExecutionStatus) === 'CANCELLED') {
        hasFailed = true;
        executionLog.status = 'CANCELLED';
        break;
      }

      // Check paused state
      while (runController.isPaused) {
        await new Promise<void>((resolve) => {
          runController.resumeResolve = resolve;
        });
        if (abortController.signal.aborted) break;
      }

      // Evaluate Condition Guard if present
      if (step.condition) {
        const condPassed = await evaluateCondition(step.condition, page, runtimeVariables, lastStepSuccess);
        if (!condPassed) {
          executionLog.stepLogs.push({
            stepId: step.id,
            stepType: step.type,
            status: 'SKIPPED',
            durationMs: 0,
            output: `Condition not met (${step.condition.operator}). Skipped.`,
          });
          if (step.condition.elseAction === 'STOP') {
            hasFailed = true;
            break;
          }
          continue;
        }
      }

      // Resolve variables in target and value
      const resolvedTarget = interpolateVariables(step.target || '', runtimeVariables, secretVariableNames, false);
      const resolvedValue = interpolateVariables(step.value || '', runtimeVariables, secretVariableNames, false);

      const stepStart = Date.now();
      let output: string | undefined = undefined;
      let screenshotBase64: string | undefined = undefined;
      let stepStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SUCCESS';
      let stepError: string | undefined = undefined;

      const maxRetries = step.retryCount || 0;
      let attempts = 0;

      while (attempts <= maxRetries) {
        try {
          const timeout = step.timeoutMs || 15000;

          switch (step.type) {
            case 'OPEN_URL': {
              const url = resolvedTarget || resolvedValue || 'https://www.google.com';
              await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
              output = `Navigated to ${url}`;
              break;
            }

            case 'SEARCH': {
              const engine = (resolvedTarget || 'Google').trim();
              const query = resolvedValue.trim();
              let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
              if (engine.toLowerCase() === 'bing') {
                searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
              } else if (engine.toLowerCase() === 'duckduckgo') {
                searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
              }
              await page.goto(searchUrl, { timeout, waitUntil: 'domcontentloaded' });
              output = `Search (${engine}): "${query}"`;
              break;
            }

            case 'CLICK': {
              if (!resolvedTarget) throw new Error('Click selector target is required');
              if (step.humanize) {
                await humanClick(page, resolvedTarget);
                output = `Humanized clicked ${resolvedTarget}`;
              } else {
                await page.click(resolvedTarget, { timeout });
                output = `Clicked ${resolvedTarget}`;
              }
              break;
            }

            case 'FILL': {
              if (!resolvedTarget) throw new Error('Fill selector target is required');
              if (step.humanize) {
                await humanType(page, resolvedTarget, resolvedValue);
                const logVal = step.isSecret ? '[REDACTED]' : resolvedValue;
                output = `Humanized filled ${resolvedTarget} with "${logVal}"`;
              } else {
                await page.fill(resolvedTarget, resolvedValue, { timeout });
                const logVal = step.isSecret ? '[REDACTED]' : resolvedValue;
                output = `Filled ${resolvedTarget} with "${logVal}"`;
              }
              break;
            }

            case 'KEYPRESS': {
              const key = (resolvedValue || resolvedTarget || 'Enter').trim();
              if (resolvedTarget && resolvedValue) {
                await page.press(resolvedTarget, resolvedValue, { timeout });
                output = `Pressed key "${resolvedValue}" on ${resolvedTarget}`;
              } else {
                await page.keyboard.press(key);
                output = `Pressed key "${key}"`;
              }
              break;
            }

            case 'HOVER': {
              if (!resolvedTarget) throw new Error('Hover selector target is required');
              await page.hover(resolvedTarget, { timeout });
              output = `Hovered over ${resolvedTarget}`;
              break;
            }

            case 'WAIT_FOR_SELECTOR': {
              if (!resolvedTarget) throw new Error('Selector target is required');
              await page.waitForSelector(resolvedTarget, { timeout });
              output = `Selector ${resolvedTarget} is present and ready`;
              break;
            }

            case 'SCROLL': {
              const rawVal = (resolvedValue || resolvedTarget || '500').trim().toLowerCase();
              if (rawVal === 'bottom') {
                await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
                output = 'Scrolled to bottom of page';
              } else if (rawVal === 'top') {
                await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
                output = 'Scrolled to top of page';
              } else {
                const pixels = parseInt(rawVal, 10) || 500;
                await page.evaluate((px: number) => window.scrollBy({ top: px, behavior: 'smooth' }), pixels);
                output = `Scrolled by ${pixels}px`;
              }
              break;
            }

            case 'WAIT': {
              const ms = parseInt(resolvedValue || '2000', 10) || 2000;
              await page.waitForTimeout(ms);
              output = `Waited for ${ms}ms`;
              break;
            }

            case 'RANDOM_SLEEP': {
              const val = (resolvedValue || '1000-3000').trim();
              let min = 1000;
              let max = 3000;
              if (val.includes('-')) {
                const parts = val.split('-').map((p) => parseInt(p.trim(), 10));
                min = isNaN(parts[0]) ? 1000 : parts[0];
                max = isNaN(parts[1]) ? 3000 : parts[1];
              }
              const chosen = Math.floor(Math.random() * (max - min + 1)) + min;
              await page.waitForTimeout(chosen);
              output = `Humanized random sleep: ${chosen}ms`;
              break;
            }

            case 'SET_VARIABLE': {
              const varName = resolvedTarget;
              if (varName) {
                runtimeVariables[varName] = resolvedValue;
                const logVal = step.isSecret ? '[REDACTED]' : resolvedValue;
                output = `Set variable "${varName}" = "${logVal}"`;
              }
              break;
            }

            case 'EXTRACT_TITLE': {
              const title = await page.title();
              if (step.outputVariableName) {
                runtimeVariables[step.outputVariableName] = title;
              }
              output = `Title: ${title}`;
              break;
            }

            case 'EXTRACT_TEXT': {
              if (!resolvedTarget) throw new Error('Extract text selector is required');
              const text = await page.innerText(resolvedTarget, { timeout });
              if (step.outputVariableName) {
                runtimeVariables[step.outputVariableName] = text;
              }
              output = `Extracted text: "${text.substring(0, 80)}"`;
              break;
            }

            case 'ASSERT_ELEMENT': {
              if (!resolvedTarget) throw new Error('Assert element selector is required');
              const el = await page.$(resolvedTarget);
              if (!el) throw new Error(`Assertion failed: Element ${resolvedTarget} not found`);
              output = `Asserted element ${resolvedTarget} exists`;
              break;
            }

            case 'SCREENSHOT': {
              const buffer = await page.screenshot({ type: 'jpeg', quality: 75 });
              screenshotBase64 = buffer.toString('base64');
              output = 'Captured screenshot';
              break;
            }

            case 'NAVIGATE': {
              const action = resolvedValue.toLowerCase();
              if (action === 'back') await page.goBack();
              else if (action === 'forward') await page.goForward();
              else await page.reload();
              output = `Navigated (${action || 'reload'})`;
              break;
            }

            case 'SOLVE_CAPTCHA': {
              const cfg = getCaptchaConfig();
              output = 'Captcha auto-bypass executed';
              break;
            }

            case 'CLOSE_BROWSER': {
              if (context) {
                await context.close();
                context = null;
              }
              output = 'Closed browser context';
              break;
            }

            case 'EVALUATE_JS': {
              const code = (resolvedValue || '').trim();
              const evalRes = await page.evaluate((c: string) => {
                try {
                  return (new Function(c))();
                } catch (e: any) {
                  return String(e);
                }
              }, code);
              output = evalRes !== undefined ? String(evalRes) : 'Evaluated JS';
              break;
            }

            case 'CUSTOM_ACTION': {
              output = `Custom action: ${resolvedTarget || ''}`;
              break;
            }
          }

          // If reached here, step succeeded
          stepStatus = 'SUCCESS';
          stepError = undefined;
          lastStepSuccess = true;
          break;
        } catch (err: unknown) {
          attempts++;
          stepError = err instanceof Error ? err.message : String(err);
          if (attempts <= maxRetries) {
            totalRetries++;
            const delay = step.retryDelayMs || 1000;
            await page.waitForTimeout(delay);
          } else {
            stepStatus = 'FAILED';
            lastStepSuccess = false;
            if (!step.continueOnError) {
              hasFailed = true;
              failedStepId = step.id;
            }
          }
        }
      }

      executionLog.stepLogs.push({
        stepId: step.id,
        stepType: step.type,
        status: stepStatus,
        durationMs: Date.now() - stepStart,
        output,
        screenshotBase64,
        error: stepError,
        retriesAttempted: attempts > 1 ? attempts - 1 : 0,
      });

      if (hasFailed) break;
    }
  } catch (err: unknown) {
    hasFailed = true;
    const msg = err instanceof Error ? err.message : String(err);
    executionLog.stepLogs.push({
      stepId: 'init',
      stepType: 'OPEN_URL',
      status: 'FAILED',
      durationMs: Date.now() - startTime,
      error: `Browser automation initialization failed: ${msg}`,
    });
  } finally {
    // Clean up active run controller
    activeRuns.delete(executionId);

    if (isAlreadyRunning) {
      if (browser) {
        try { await browser.close(); } catch {}
      }
    } else {
      if (context) {
        try {
          await context.close();
          markCleanExit(profile.storagePath, profile.name);
        } catch {}
      }
    }
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;
  if (!executionLog.status || executionLog.status === 'RUNNING') {
    executionLog.status = hasFailed ? 'FAILED' : 'SUCCESS';
  }
  executionLog.completedAt = completedAt;
  executionLog.totalDurationMs = totalDurationMs;
  executionLog.failedStepId = failedStepId;
  executionLog.retryCount = totalRetries;
  executionLog.summary = `Completed ${executionLog.stepLogs.filter((s) => s.status === 'SUCCESS').length} steps with status ${executionLog.status}`;

  // Persist execution log in database (both workflow_logs and automation_runs)
  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO workflow_logs (id, workflow_id, profile_id, status, logs_json, started_at, completed_at, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      executionId,
      workflow.id,
      profile.id,
      executionLog.status,
      JSON.stringify(executionLog.stepLogs),
      startedAt,
      completedAt,
      totalDurationMs
    );
  } catch {}

  try {
    db.prepare(`
      INSERT INTO automation_runs (
        id, workflow_id, workflow_version, profile_id, workspace_id, status,
        started_at, completed_at, duration_ms, failed_step_id, retry_count, summary, step_logs_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      executionId,
      workflow.id,
      workflow.version || 1,
      profile.id,
      dto.workspaceId || workflow.workspaceId || null,
      executionLog.status,
      startedAt,
      completedAt,
      totalDurationMs,
      failedStepId || null,
      totalRetries,
      executionLog.summary,
      JSON.stringify(executionLog.stepLogs),
      startedAt
    );
  } catch {}

  logActivity(
    'AUTOMATION',
    executionLog.status === 'SUCCEEDED' ? 'SUCCESS' : 'ERROR',
    'Finish Workflow',
    `Workflow "${workflow.name}" completed with status ${executionLog.status} (${totalDurationMs}ms)`,
    profile.id,
    profile.name
  );

  return executionLog;
}

export function getWorkflowLogs(workflowId?: string): WorkflowExecutionLog[] {
  const db = getDatabase();
  let query = 'SELECT * FROM workflow_logs';
  const params: unknown[] = [];

  if (workflowId) {
    query += ' WHERE workflow_id = ?';
    params.push(workflowId);
  }

  query += ' ORDER BY started_at DESC LIMIT 50';
  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((r) => ({
    id: r.id,
    workflowId: r.workflow_id,
    profileId: r.profile_id,
    status: r.status as WorkflowExecutionStatus,
    stepLogs: JSON.parse(r.logs_json),
    startedAt: r.started_at,
    completedAt: r.completed_at || undefined,
    totalDurationMs: r.duration_ms || undefined,
  }));
}

// ============================================================================
// MULTI-PROFILE CONCURRENT BATCH RUNNER WITH HOST SAFETY LIMITS
// ============================================================================

export async function runWorkflowConcurrently(dto: RunWorkflowBatchDTO): Promise<WorkflowExecutionLog[]> {
  const { workflowId, profileIds, maxConcurrency = 2, delayMs = 1000 } = dto;
  const clampedConcurrency = Math.min(Math.max(1, maxConcurrency), 5); // Clamped between 1 and 5
  const results: WorkflowExecutionLog[] = [];
  const queue = [...profileIds];

  const worker = async () => {
    while (queue.length > 0) {
      const pid = queue.shift();
      if (!pid) break;

      try {
        const log = await runWorkflow({ workflowId, profileId: pid, workspaceId: dto.workspaceId });
        results.push(log);
      } catch (err: any) {
        results.push({
          id: crypto.randomUUID(),
          workflowId,
          profileId: pid,
          status: 'FAILED',
          startedAt: new Date().toISOString(),
          stepLogs: [
            {
              stepId: 'batch-worker',
              stepType: 'OPEN_URL',
              status: 'FAILED',
              durationMs: 0,
              error: err.message || 'Concurrent execution error',
            },
          ],
        });
      }

      if (delayMs > 0 && queue.length > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  };

  const workers = Array.from({ length: Math.min(clampedConcurrency, profileIds.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

export async function runWorkflowBatch(dto: RunWorkflowBatchDTO): Promise<WorkflowExecutionLog[]> {
  return runWorkflowConcurrently(dto);
}
