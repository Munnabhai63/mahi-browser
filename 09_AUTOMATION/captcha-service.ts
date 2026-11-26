import https from 'node:https';
import http from 'node:http';
import { getDatabase } from '../06_DATABASE/connection.js';
import {
  CaptchaConfig,
  CaptchaBalanceResult,
  CaptchaSolveRequest,
  CaptchaSolveResult,
  CaptchaProvider,
} from '../10_CONFIG/shared/types/captcha.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { encryptData, decryptData } from '../08_SECURITY/encryption.js';

const DEFAULT_CONFIG: CaptchaConfig = {
  enabled: false,
  provider: '2captcha',
  apiKey: '',
  autoSolveInBrowser: true,
  autoSolveInRpa: true,
  timeoutSeconds: 60,
};

function httpRequest(url: string, method: string = 'GET', postData?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    const bodyStr = postData ? (typeof postData === 'string' ? postData : JSON.stringify(postData)) : '';

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'User-Agent': 'MAHI-Browser-Captcha-Engine/1.0',
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 15000,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Captcha API request timed out'));
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

/**
 * Retrieves the stored Captcha configuration from database.
 */
export function getCaptchaConfig(): CaptchaConfig {
  const db = getDatabase();
  try {
    const row = db.prepare("SELECT value_json FROM app_settings WHERE key = 'captcha_config'").get() as { value_json: string } | undefined;
    if (row && row.value_json) {
      const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(row.value_json) };
      if (parsed.apiKey && typeof parsed.apiKey === 'string' && parsed.apiKey.includes(':')) {
        try {
          const decrypted = decryptData(parsed.apiKey);
          if (decrypted) parsed.apiKey = decrypted;
        } catch {
          // Legacy unencrypted value fallback
        }
      }
      return parsed;
    }
  } catch {}
  return DEFAULT_CONFIG;
}

/**
 * Saves the Captcha configuration to database (encrypts API key at rest).
 */
export function saveCaptchaConfig(config: Partial<CaptchaConfig>): boolean {
  const db = getDatabase();
  const current = getCaptchaConfig();
  const merged = { ...current, ...config };
  const persisted: CaptchaConfig = {
    ...merged,
    apiKey: merged.apiKey && merged.apiKey.trim() ? encryptData(merged.apiKey) : '',
  };
  const now = new Date().toISOString();

  db.prepare("INSERT OR REPLACE INTO app_settings (key, value_json, updated_at) VALUES ('captcha_config', ?, ?)").run(
    JSON.stringify(persisted),
    now
  );

  logActivity('SETTINGS', 'INFO', 'Captcha Config', `Updated Captcha provider to ${merged.provider} (${merged.enabled ? 'Enabled' : 'Disabled'})`);
  return true;
}


/**
 * Queries the live account balance from the specified Captcha provider.
 */
export async function checkCaptchaBalance(provider: CaptchaProvider, apiKey: string): Promise<CaptchaBalanceResult> {
  if (!apiKey || !apiKey.trim()) {
    return {
      provider,
      balance: 0,
      currency: 'USD',
      success: false,
      error: 'API Key is empty',
    };
  }

  try {
    switch (provider) {
      case '2captcha': {
        const url = `https://2captcha.com/res.php?key=${encodeURIComponent(apiKey)}&action=getbalance&json=1`;
        const res = await httpRequest(url);
        if (res && res.status === 1) {
          return {
            provider,
            balance: parseFloat(res.request) || 0,
            currency: 'USD',
            success: true,
          };
        }
        return {
          provider,
          balance: 0,
          currency: 'USD',
          success: false,
          error: res?.request || 'Invalid 2Captcha API key or response',
        };
      }

      case 'capmonster': {
        const url = 'https://api.capmonster.cloud/getBalance';
        const res = await httpRequest(url, 'POST', { clientKey: apiKey });
        if (res && res.errorId === 0) {
          return {
            provider,
            balance: parseFloat(res.balance) || 0,
            currency: 'USD',
            success: true,
          };
        }
        return {
          provider,
          balance: 0,
          currency: 'USD',
          success: false,
          error: res?.errorDescription || 'CapMonster balance check failed',
        };
      }

      case 'anticaptcha': {
        const url = 'https://api.anti-captcha.com/getBalance';
        const res = await httpRequest(url, 'POST', { clientKey: apiKey });
        if (res && res.errorId === 0) {
          return {
            provider,
            balance: parseFloat(res.balance) || 0,
            currency: 'USD',
            success: true,
          };
        }
        return {
          provider,
          balance: 0,
          currency: 'USD',
          success: false,
          error: res?.errorDescription || 'Anti-Captcha balance check failed',
        };
      }

      case 'ezcaptcha': {
        const url = 'https://api.ez-captcha.com/getBalance';
        const res = await httpRequest(url, 'POST', { clientKey: apiKey });
        if (res && res.errorId === 0) {
          return {
            provider,
            balance: parseFloat(res.balance) || 0,
            currency: 'USD',
            success: true,
          };
        }
        return {
          provider,
          balance: 0,
          currency: 'USD',
          success: false,
          error: res?.errorDescription || 'EzCaptcha balance check failed',
        };
      }

      default:
        return {
          provider,
          balance: 0,
          currency: 'USD',
          success: false,
          error: `Unsupported provider: ${provider}`,
        };
    }
  } catch (err: any) {
    return {
      provider,
      balance: 0,
      currency: 'USD',
      success: false,
      error: err?.message || 'Network error connecting to Captcha provider',
    };
  }
}

/**
 * Solves a captcha token (Turnstile, reCAPTCHA v2/v3, hCaptcha) using the configured provider.
 */
export async function solveCaptcha(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
  const config = getCaptchaConfig();
  const provider = request.provider || config.provider;
  const apiKey = request.apiKey || config.apiKey;

  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      error: 'Captcha API Key is not configured. Please set your API key in Captcha Settings.',
    };
  }

  const startTime = Date.now();

  try {
    if (provider === '2captcha') {
      // 1. Submit Task
      let inUrl = `https://2captcha.com/in.php?key=${encodeURIComponent(apiKey)}&json=1&pageurl=${encodeURIComponent(request.websiteUrl)}`;

      if (request.type === 'turnstile') {
        inUrl += `&method=turnstile&sitekey=${encodeURIComponent(request.websiteKey)}`;
        if (request.action) inUrl += `&action=${encodeURIComponent(request.action)}`;
      } else if (request.type === 'recaptcha_v2') {
        inUrl += `&method=userrecaptcha&googlekey=${encodeURIComponent(request.websiteKey)}`;
      } else if (request.type === 'recaptcha_v3') {
        inUrl += `&method=userrecaptcha&googlekey=${encodeURIComponent(request.websiteKey)}&version=v3&min_score=0.7`;
        if (request.action) inUrl += `&action=${encodeURIComponent(request.action)}`;
      } else if (request.type === 'hcaptcha') {
        inUrl += `&method=hcaptcha&sitekey=${encodeURIComponent(request.websiteKey)}`;
      }

      const submitRes = await httpRequest(inUrl);
      if (!submitRes || submitRes.status !== 1) {
        return {
          success: false,
          error: `2Captcha Task Submission Error: ${submitRes?.request || 'Unknown error'}`,
        };
      }

      const taskId = submitRes.request;
      const timeoutMs = (config.timeoutSeconds || 60) * 1000;
      const pollStart = Date.now();

      // 2. Poll for Solution
      while (Date.now() - pollStart < timeoutMs) {
        await new Promise((r) => setTimeout(r, 4000));
        const resUrl = `https://2captcha.com/res.php?key=${encodeURIComponent(apiKey)}&action=get&id=${taskId}&json=1`;
        const resObj = await httpRequest(resUrl);

        if (resObj && resObj.status === 1) {
          const solveTimeSeconds = (Date.now() - startTime) / 1000;
          logActivity('AUTOMATION', 'SUCCESS', 'Captcha Solved', `Solved ${request.type} on ${request.websiteUrl} in ${solveTimeSeconds.toFixed(1)}s`);
          return {
            success: true,
            token: resObj.request,
            solveTimeSeconds,
          };
        }

        if (resObj && resObj.request !== 'CAPCHA_NOT_READY') {
          return {
            success: false,
            error: `2Captcha Polling Error: ${resObj.request}`,
          };
        }
      }

      return {
        success: false,
        error: `Captcha solve timed out after ${config.timeoutSeconds}s`,
      };
    }

    // Standard JSON API (CapMonster, AntiCaptcha)
    const baseUrl =
      provider === 'capmonster'
        ? 'https://api.capmonster.cloud'
        : provider === 'ezcaptcha'
        ? 'https://api.ez-captcha.com'
        : 'https://api.anti-captcha.com';

    let taskType = 'TurnstileTaskProxyless';
    if (request.type === 'recaptcha_v2') taskType = 'RecaptchaV2TaskProxyless';
    else if (request.type === 'recaptcha_v3') taskType = 'RecaptchaV3TaskProxyless';
    else if (request.type === 'hcaptcha') taskType = 'HCaptchaTaskProxyless';

    const createPayload: any = {
      clientKey: apiKey,
      task: {
        type: taskType,
        websiteURL: request.websiteUrl,
        websiteKey: request.websiteKey,
        ...(request.action ? { pageAction: request.action } : {}),
      },
    };

    const createRes = await httpRequest(`${baseUrl}/createTask`, 'POST', createPayload);
    if (!createRes || createRes.errorId !== 0) {
      return {
        success: false,
        error: `${provider} CreateTask Error: ${createRes?.errorDescription || 'Unknown error'}`,
      };
    }

    const taskId = createRes.taskId;
    const timeoutMs = (config.timeoutSeconds || 60) * 1000;
    const pollStart = Date.now();

    while (Date.now() - pollStart < timeoutMs) {
      await new Promise((r) => setTimeout(r, 3000));
      const resultRes = await httpRequest(`${baseUrl}/getTaskResult`, 'POST', {
        clientKey: apiKey,
        taskId,
      });

      if (resultRes && resultRes.status === 'ready') {
        const token =
          resultRes.solution?.token ||
          resultRes.solution?.gRecaptchaResponse ||
          resultRes.solution?.text;
        const solveTimeSeconds = (Date.now() - startTime) / 1000;
        logActivity('AUTOMATION', 'SUCCESS', 'Captcha Solved', `Solved ${request.type} on ${request.websiteUrl} in ${solveTimeSeconds.toFixed(1)}s via ${provider}`);
        return {
          success: true,
          token,
          solveTimeSeconds,
        };
      }

      if (resultRes && resultRes.errorId !== 0) {
        return {
          success: false,
          error: `${provider} GetTaskResult Error: ${resultRes.errorDescription}`,
        };
      }
    }

    return {
      success: false,
      error: `Captcha solve timed out after ${config.timeoutSeconds}s`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error executing Captcha solver',
    };
  }
}
