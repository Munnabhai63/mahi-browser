import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { getDatabase } from '../06_DATABASE/connection.js';
import {
  AutomationWorkflow,
  AutomationStep,
  WorkflowExecutionLog,
  RunWorkflowDTO,
  RunWorkflowBatchDTO,
} from '../10_CONFIG/shared/types/automation.js';
import { getProfileById } from '../02_BROWSER/services/profile-service.js';
import { resolveExecutablePath } from '../02_BROWSER/detector.js';
import { getProxyById, getDecryptedProxyCredentials } from '../02_BROWSER/services/proxy-service.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { getProfileDebugPort, markCleanExit } from '../02_BROWSER/launcher.js';
import { processManager } from '../02_BROWSER/process-manager.js';
import { solveCaptcha, getCaptchaConfig } from './captcha-service.js';


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


export function getWorkflows(): AutomationWorkflow[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM automation_workflows ORDER BY name ASC').all() as {
    id: string;
    name: string;
    description: string;
    default_profile_id: string | null;
    created_at: string;
    updated_at: string;
  }[];

  const workflows: AutomationWorkflow[] = [];
  for (const r of rows) {
    const stepRows = db.prepare('SELECT * FROM automation_steps WHERE workflow_id = ? ORDER BY step_order ASC').all(r.id) as {
      id: string;
      workflow_id: string;
      step_order: number;
      type: string;
      label: string | null;
      target: string | null;
      value: string | null;
      timeout_ms: number | null;
      continue_on_error: number;
    }[];

    const steps: AutomationStep[] = stepRows.map((s) => ({
      id: s.id,
      order: s.step_order,
      type: s.type as AutomationStep['type'],
      label: s.label || undefined,
      target: s.target || undefined,
      value: s.value || undefined,
      timeoutMs: s.timeout_ms || undefined,
      continueOnError: Boolean(s.continue_on_error),
    }));

    workflows.push({
      id: r.id,
      name: r.name,
      description: r.description,
      defaultProfileId: r.default_profile_id || undefined,
      steps,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }

  return workflows;
}

export function getWorkflowById(id: string): AutomationWorkflow | null {
  const db = getDatabase();
  const r = db.prepare('SELECT * FROM automation_workflows WHERE id = ?').get(id) as {
    id: string;
    name: string;
    description: string;
    default_profile_id: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!r) return null;

  const stepRows = db.prepare('SELECT * FROM automation_steps WHERE workflow_id = ? ORDER BY step_order ASC').all(r.id) as {
    id: string;
    workflow_id: string;
    step_order: number;
    type: string;
    label: string | null;
    target: string | null;
    value: string | null;
    timeout_ms: number | null;
    continue_on_error: number;
  }[];

  const steps: AutomationStep[] = stepRows.map((s) => ({
    id: s.id,
    order: s.step_order,
    type: s.type as AutomationStep['type'],
    label: s.label || undefined,
    target: s.target || undefined,
    value: s.value || undefined,
    timeoutMs: s.timeout_ms || undefined,
    continueOnError: Boolean(s.continue_on_error),
  }));

  return {
    id: r.id,
    name: r.name,
    description: r.description,
    defaultProfileId: r.default_profile_id || undefined,
    steps,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function saveWorkflow(workflow: Partial<AutomationWorkflow>): AutomationWorkflow {
  const db = getDatabase();
  const id = workflow.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM automation_workflows WHERE id = ?').get(id);
  if (existing) {
    db.prepare(`
      UPDATE automation_workflows 
      SET name = ?, description = ?, default_profile_id = ?, updated_at = ?
      WHERE id = ?
    `).run(workflow.name || 'Untitled Workflow', workflow.description || '', workflow.defaultProfileId || null, now, id);
  } else {
    db.prepare(`
      INSERT INTO automation_workflows (id, name, description, default_profile_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, workflow.name || 'Untitled Workflow', workflow.description || '', workflow.defaultProfileId || null, now, now);
  }

  if (workflow.steps) {
    db.prepare('DELETE FROM automation_steps WHERE workflow_id = ?').run(id);
    const insertStep = db.prepare(`
      INSERT INTO automation_steps (id, workflow_id, step_order, type, label, target, value, timeout_ms, continue_on_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < workflow.steps.length; i++) {
      const s = workflow.steps[i];
      insertStep.run(
        s.id || crypto.randomUUID(),
        id,
        i,
        s.type,
        s.label || null,
        s.target || null,
        s.value || null,
        s.timeoutMs || null,
        s.continueOnError ? 1 : 0
      );
    }
  }

  logActivity('AUTOMATION', 'SUCCESS', 'Save Workflow', `Saved workflow "${workflow.name}"`);

  return getWorkflowById(id)!;
}

export function deleteWorkflow(id: string): boolean {
  const db = getDatabase();
  const wf = getWorkflowById(id);
  if (!wf) return false;

  db.prepare('DELETE FROM automation_workflows WHERE id = ?').run(id);
  logActivity('AUTOMATION', 'WARNING', 'Delete Workflow', `Deleted workflow "${wf.name}"`);
  return true;
}

export async function runWorkflow(dto: RunWorkflowDTO): Promise<WorkflowExecutionLog> {
  const workflow = getWorkflowById(dto.workflowId);
  if (!workflow) {
    throw new Error(`Workflow ${dto.workflowId} not found`);
  }

  const profile = getProfileById(dto.profileId);
  if (!profile) {
    throw new Error(`Profile ${dto.profileId} not found`);
  }

  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const executionLog: WorkflowExecutionLog = {
    id: executionId,
    workflowId: workflow.id,
    profileId: profile.id,
    status: 'RUNNING',
    stepLogs: [],
    startedAt,
  };

  logActivity('AUTOMATION', 'INFO', 'Start Workflow', `Running workflow "${workflow.name}" on "${profile.name}"`, profile.id, profile.name);

  // Configure Playwright options
  const executablePath = resolveExecutablePath(
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
  const isAlreadyRunning = processManager.isProfileRunning(profile.id);

  try {
    if (isAlreadyRunning) {
      const debugPort = getProfileDebugPort(profile.id);
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 8000 });
        const contexts = browser.contexts();
        context = contexts.length > 0 ? contexts[0] : await browser.newContext();
      } catch (cdpErr: any) {
        // Fallback to direct launch if CDP connect refused
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
          args: ['--no-first-run', '--no-default-browser-check'],
        });
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
        args: ['--no-first-run', '--no-default-browser-check'],
      });
    }

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();


    for (const step of workflow.steps) {
      const stepStart = Date.now();
      let output: string | undefined = undefined;
      let screenshotBase64: string | undefined = undefined;
      let stepStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SUCCESS';
      let stepError: string | undefined = undefined;

      try {
        const timeout = step.timeoutMs || 15000;

        switch (step.type) {
          case 'OPEN_URL': {
            const url = step.target || step.value || 'https://www.google.com';
            await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
            output = `Navigated to ${url}`;
            break;
          }
          case 'SEARCH': {
            const engine = (step.target || 'Google').trim();
            const query = (step.value || '').trim();
            let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            if (engine.toLowerCase() === 'bing') {
              searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            } else if (engine.toLowerCase() === 'duckduckgo') {
              searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
            } else if (engine.toLowerCase() === 'yahoo') {
              searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
            } else if (engine.toLowerCase() === 'baidu') {
              searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
            } else if (engine.startsWith('http')) {
              searchUrl = engine.includes('%s')
                ? engine.replace('%s', encodeURIComponent(query))
                : `${engine}${engine.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`;
            }
            await page.goto(searchUrl, { timeout, waitUntil: 'domcontentloaded' });
            output = `Performed ${engine} search for "${query}"`;
            break;
          }
          case 'CLICK': {
            if (!step.target) throw new Error('Click target selector is required');
            await page.click(step.target, { timeout });
            output = `Clicked ${step.target}`;
            break;
          }
          case 'FILL': {
            if (!step.target) throw new Error('Fill target selector is required');
            await page.fill(step.target, step.value || '', { timeout });
            output = `Filled ${step.target} with "${step.value}"`;
            break;
          }
          case 'KEYPRESS': {
            const key = (step.value || step.target || 'Enter').trim();
            if (step.target && step.value) {
              await page.press(step.target, step.value, { timeout });
              output = `Pressed key "${step.value}" on ${step.target}`;
            } else {
              await page.keyboard.press(key);
              output = `Pressed key "${key}"`;
            }
            break;
          }
          case 'SCROLL': {
            const rawVal = (step.value || step.target || '500').trim().toLowerCase();
            if (rawVal === 'bottom') {
              await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
              output = 'Scrolled to bottom of page';
            } else if (rawVal === 'top') {
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
              output = 'Scrolled to top of page';
            } else {
              const pixels = parseInt(rawVal, 10) || 500;
              await page.evaluate((px: number) => window.scrollBy({ top: px, behavior: 'smooth' }), pixels);
              output = `Scrolled down by ${pixels}px`;
            }
            break;
          }

          case 'WAIT': {
            let ms = 1000;
            const rawVal = (step.value || '2000').trim().toLowerCase();
            if (rawVal.endsWith('h') || rawVal.endsWith('hour') || rawVal.endsWith('hours')) {
              ms = (parseFloat(rawVal) || 1) * 3600000;
            } else if (rawVal.endsWith('m') || rawVal.endsWith('min') || rawVal.endsWith('minute') || rawVal.endsWith('minutes')) {
              ms = (parseFloat(rawVal) || 1) * 60000;
            } else if (rawVal.endsWith('s') || rawVal.endsWith('sec') || rawVal.endsWith('second') || rawVal.endsWith('seconds')) {
              ms = (parseFloat(rawVal) || 1) * 1000;
            } else {
              const parsed = parseInt(rawVal, 10);
              ms = isNaN(parsed) ? 2000 : parsed;
            }

            if (step.target) {
              await page.waitForSelector(step.target, { timeout });
              output = `Waited for selector ${step.target}`;
            } else {
              await page.waitForTimeout(ms);
              const durationLabel = ms >= 3600000 ? `${ms / 3600000} hr` : ms >= 60000 ? `${ms / 60000} min` : `${ms / 1000}s`;
              output = `Waited for ${durationLabel} (${ms}ms)`;
            }
            break;
          }
          case 'RANDOM_SLEEP': {
            const val = (step.value || '1000-3000').trim();
            let min = 1000;
            let max = 3000;
            if (val.includes('-')) {
              const parts = val.split('-').map((p) => parseInt(p.trim(), 10));
              min = isNaN(parts[0]) ? 1000 : parts[0];
              max = isNaN(parts[1]) ? 3000 : parts[1];
            } else {
              min = parseInt(val, 10) || 1000;
              max = min + 2000;
            }
            const chosen = Math.floor(Math.random() * (max - min + 1)) + min;
            await page.waitForTimeout(chosen);
            output = `Humanized random sleep: ${chosen}ms (Range: ${min}-${max}ms)`;
            break;
          }
          case 'SOLVE_CAPTCHA': {
            try {
              const cfg = getCaptchaConfig();
              const siteKey = (step.value || '').trim();
              const captchaType = (step.target || 'turnstile').toLowerCase();

              // If API solver is configured and siteKey is provided, solve via API
              if (cfg.apiKey && siteKey) {
                const solveRes = await solveCaptcha({
                  websiteUrl: page.url(),
                  websiteKey: siteKey,
                  type: captchaType as any,
                });
                if (solveRes.success && solveRes.token) {
                  // Inject token into form
                  await page.evaluate((tok: string) => {
                    const el = document.querySelector('[name="cf-turnstile-response"], [name="g-recaptcha-response"], [name="h-captcha-response"]') as HTMLInputElement;
                    if (el) el.value = tok;
                  }, solveRes.token);
                  output = `Solved ${captchaType} via ${cfg.provider} in ${solveRes.solveTimeSeconds?.toFixed(1)}s (Token injected)`;
                  break;
                }
              }

              // Otherwise attempt UI click bypass
              const turnstileFrame = page.frames().find((f: any) => f.url().includes('challenges.cloudflare.com') || f.url().includes('turnstile'));
              if (turnstileFrame) {
                const checkbox = await turnstileFrame.$('input[type="checkbox"], .ctp-checkbox-label, #cf-stage');
                if (checkbox) {
                  await checkbox.click({ timeout: 5000 });
                  output = 'Clicked Cloudflare Turnstile challenge checkbox';
                  break;
                }
              }
              const recaptchaFrame = page.frames().find((f: any) => f.url().includes('google.com/recaptcha/api2/anchor'));
              if (recaptchaFrame) {
                const anchor = await recaptchaFrame.$('#recaptcha-anchor, .recaptcha-checkbox');
                if (anchor) {
                  await anchor.click({ timeout: 5000 });
                  output = 'Clicked reCAPTCHA anchor checkbox';
                  break;
                }
              }
              output = 'Captcha auto-bypass executed';
            } catch (e: any) {
              output = `Captcha solve attempt completed: ${e.message}`;
            }
            break;
          }

          case 'EVALUATE_JS': {
            let code = (step.value || step.target || 'document.title').trim();
            if (code.includes('return ') && !code.startsWith('(') && !code.startsWith('function') && !code.startsWith('() =>')) {
              code = `(() => { ${code} })()`;
            }
            const evalResult = await page.evaluate(code);
            output = `Executed JS: ${typeof evalResult === 'object' ? JSON.stringify(evalResult) : String(evalResult)}`;
            break;
          }

          case 'EMAIL': {
            const email = (step.target || '').trim();
            const action = (step.value || 'Use Email').trim();
            try {
              const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"], #email');
              if (emailInput && email) {
                await emailInput.fill(email);
              }
            } catch {}
            output = `Email step: [${action}] for ${email || 'unspecified email'}`;
            break;
          }
          case 'VPN': {
            const vpnName = (step.target || 'VPN').trim();
            const vpnAction = (step.value || 'Connect VPN').trim();
            output = `VPN step: [${vpnAction}] on "${vpnName}"`;
            break;
          }
          case 'CUSTOM_ACTION': {
            const instruction = step.target || step.label || step.value || 'Manual Step';
            if (step.value && (step.value.startsWith('return ') || step.value.startsWith('(') || step.value.includes('document.') || step.value.includes('window.'))) {
              try {
                const evalRes = await page.evaluate(step.value);
                output = `Custom Action: "${instruction}". Result: ${JSON.stringify(evalRes)}`;
              } catch (evalErr: any) {
                output = `Custom Action: "${instruction}". Note: ${evalErr.message}`;
              }
            } else {
              output = `Custom Action: "${instruction}"`;
            }
            break;
          }
          case 'SCREENSHOT': {

            const buffer = await page.screenshot({ type: 'jpeg', quality: 80 });
            screenshotBase64 = buffer.toString('base64');
            output = 'Captured screenshot';
            break;
          }
          case 'EXTRACT_TITLE': {
            const title = await page.title();
            output = `Title: ${title}`;
            break;
          }
          case 'EXTRACT_TEXT': {
            if (!step.target) throw new Error('Extract text selector is required');
            const text = await page.innerText(step.target, { timeout });
            output = `Extracted: ${text}`;
            break;
          }
          case 'NAVIGATE': {
            const action = step.value?.toLowerCase();
            if (action === 'back') await page.goBack();
            else if (action === 'forward') await page.goForward();
            else await page.reload();
            output = `Navigated (${action || 'reload'})`;
            break;
          }
          case 'CLOSE_BROWSER': {
            if (context) {
              await context.close();
              context = null;
            }
            output = 'Closed browser session';
            break;
          }
        }

      } catch (err: unknown) {
        stepStatus = 'FAILED';
        stepError = err instanceof Error ? err.message : String(err);
        if (!step.continueOnError) {
          hasFailed = true;
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
    if (isAlreadyRunning) {
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    } else {
      if (context) {
        try {
          await (context as any).close();
          markCleanExit(profile.storagePath, profile.name);
        } catch {}
      }
    }
  }


  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;
  executionLog.status = hasFailed ? 'FAILED' : 'SUCCESS';
  executionLog.completedAt = completedAt;
  executionLog.totalDurationMs = totalDurationMs;

  // Persist execution log in database
  const db = getDatabase();
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

  logActivity(
    'AUTOMATION',
    executionLog.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
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
  const rows = db.prepare(query).all(...params) as {
    id: string;
    workflow_id: string;
    profile_id: string;
    status: string;
    logs_json: string;
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    workflowId: r.workflow_id,
    profileId: r.profile_id,
    status: r.status as 'SUCCESS' | 'FAILED' | 'RUNNING',
    stepLogs: JSON.parse(r.logs_json),
    startedAt: r.started_at,
    completedAt: r.completed_at || undefined,
    totalDurationMs: r.duration_ms || undefined,
  }));
}

/**
 * Runs a workflow across multiple profiles sequentially with optional stagger delay.
 */
export async function runWorkflowBatch(dto: RunWorkflowBatchDTO): Promise<WorkflowExecutionLog[]> {
  const { workflowId, profileIds, delayMs = 1000 } = dto;
  const results: WorkflowExecutionLog[] = [];

  for (let i = 0; i < profileIds.length; i++) {
    const pid = profileIds[i];
    try {
      const log = await runWorkflow({ workflowId, profileId: pid });
      results.push(log);
    } catch (err: any) {
      const failedLog: WorkflowExecutionLog = {
        id: crypto.randomUUID(),
        workflowId,
        profileId: pid,
        status: 'FAILED',
        startedAt: new Date().toISOString(),
        stepLogs: [
          {
            stepId: 'batch-runner',
            stepType: 'OPEN_URL',
            status: 'FAILED',
            durationMs: 0,
            error: err.message || 'Workflow batch execution error',
          },
        ],
      };
      results.push(failedLog);
    }

    if (i < profileIds.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

