import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import http from 'node:http';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { getDatabase } from '../06_DATABASE/connection.js';

const execAsync = promisify(exec);

export interface AdbDeviceItem {
  id: string;
  model: string;
  status: 'device' | 'offline' | 'unauthorized';
}

export interface PublicIpInfo {
  ip: string;
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
}

export interface MobileRotatorConfig {
  method: 'adb' | 'webhook';
  adbDeviceId?: string;
  airplaneDelayMs: number;
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST';
  autoRotateOnProfileStart: boolean;
  minIntervalSeconds: number;
}

export interface MobileRotationResult {
  success: boolean;
  oldIp: string;
  newIp: string;
  isp?: string;
  country?: string;
  city?: string;
  durationMs: number;
  errorMessage?: string;
  timestamp: string;
}

const DEFAULT_ROTATOR_CONFIG: MobileRotatorConfig = {
  method: 'adb',
  airplaneDelayMs: 2500,
  webhookUrl: '',
  webhookMethod: 'GET',
  autoRotateOnProfileStart: false,
  minIntervalSeconds: 30,
};

let lastRotationTimestamp = 0;

/**
 * Checks current public IP address querying fast, reliable endpoints
 */
export async function checkPublicIp(): Promise<PublicIpInfo> {
  const endpoints = [
    { url: 'https://ipinfo.io/json', isJson: true },
    { url: 'https://api.ipify.org?format=json', isJson: true },
    { url: 'https://icanhazip.com', isJson: false },
  ];

  for (const ep of endpoints) {
    try {
      const data = await fetchWithTimeout(ep.url, 4000);
      if (ep.isJson) {
        const parsed = JSON.parse(data);
        return {
          ip: parsed.ip || parsed.query || '127.0.0.1',
          country: parsed.country || parsed.country_name,
          countryCode: parsed.country,
          city: parsed.city,
          isp: parsed.org || parsed.isp,
        };
      } else {
        const cleanIp = data.trim();
        if (cleanIp) {
          return { ip: cleanIp };
        }
      }
    } catch {}
  }

  return { ip: 'Unknown' };
}

function fetchWithTimeout(urlStr: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const isHttps = urlStr.startsWith('https:');
    const client = isHttps ? https : http;

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Timeout fetching IP from ${urlStr}`));
    }, timeoutMs);

    const req = client.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Lists connected Android devices via ADB
 */
export async function getConnectedAdbDevices(): Promise<AdbDeviceItem[]> {
  try {
    const { stdout } = await execAsync('adb devices -l');
    const lines = stdout.split('\n');
    const devices: AdbDeviceItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const id = parts[0];
        const status = parts[1] as 'device' | 'offline' | 'unauthorized';
        let model = id;

        const modelMatch = line.match(/model:([^\s]+)/);
        if (modelMatch) model = modelMatch[1];

        devices.push({ id, model, status });
      }
    }

    return devices;
  } catch {
    return [];
  }
}

/**
 * Toggles Airplane Mode on Android via ADB
 */
export async function rotateViaAdb(deviceId?: string, delayMs = 2500): Promise<boolean> {
  const target = deviceId ? `-s ${deviceId}` : '';

  // Try modern Android cmd connectivity command first
  try {
    await execAsync(`adb ${target} shell cmd connectivity airplane-mode enable`);
    await new Promise((r) => setTimeout(r, delayMs));
    await execAsync(`adb ${target} shell cmd connectivity airplane-mode disable`);
    return true;
  } catch {}

  // Fallback to legacy settings + broadcast intent
  try {
    await execAsync(`adb ${target} shell settings put global airplane_mode_on 1`);
    await execAsync(`adb ${target} shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true`);
    await new Promise((r) => setTimeout(r, delayMs));
    await execAsync(`adb ${target} shell settings put global airplane_mode_on 0`);
    await execAsync(`adb ${target} shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false`);
    return true;
  } catch (err: any) {
    throw new Error(`ADB Rotation failed: ${err.message || 'Make sure phone is connected with USB Debugging enabled'}`);
  }
}

/**
 * Triggers rotation via HTTP Webhook URL (4G dongles, Huawei, iProxy)
 */
export async function rotateViaWebhook(url: string, method: 'GET' | 'POST' = 'GET'): Promise<boolean> {
  if (!url || !url.startsWith('http')) {
    throw new Error('Invalid webhook rotation URL');
  }

  const res = await fetch(url, {
    method,
    headers: { 'User-Agent': 'MAHI-Browser-Mobile-Rotator/1.0' },
  });

  return res.ok;
}

/**
 * Master Mobile IP Rotation Execution
 */
export async function rotateMobileIp(
  customConfig?: Partial<MobileRotatorConfig>
): Promise<MobileRotationResult> {
  const startTime = Date.now();
  const config = { ...getRotatorConfig(), ...(customConfig || {}) };

  // Check initial IP
  const preIpInfo = await checkPublicIp();
  const oldIp = preIpInfo.ip;

  let rotateSuccess = false;

  if (config.method === 'adb') {
    rotateSuccess = await rotateViaAdb(config.adbDeviceId, config.airplaneDelayMs || 2500);
  } else if (config.method === 'webhook' && config.webhookUrl) {
    rotateSuccess = await rotateViaWebhook(config.webhookUrl, config.webhookMethod || 'GET');
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    throw new Error('No valid rotation method or URL configured.');
  }

  if (!rotateSuccess) {
    throw new Error('Rotation signal execution failed.');
  }

  // Wait for new connection to establish and verify new IP (up to 5 retries)
  let newIpInfo: PublicIpInfo = { ip: oldIp };
  for (let attempt = 1; attempt <= 6; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const info = await checkPublicIp();
      if (info.ip && info.ip !== 'Unknown') {
        newIpInfo = info;
        if (info.ip !== oldIp) {
          break; // Successfully got new IP
        }
      }
    } catch {}
  }

  lastRotationTimestamp = Date.now();
  const durationMs = Date.now() - startTime;
  const nowIso = new Date().toISOString();

  logActivity(
    'NETWORK',
    'INFO',
    'MOBILE_IP_ROTATED',
    `Mobile IP Rotated: ${oldIp} ➔ ${newIpInfo.ip} (${newIpInfo.isp || 'Mobile Network'}) in ${Math.round(durationMs / 1000)}s.`,
    undefined,
    undefined,
    { oldIp, newIp: newIpInfo.ip, isp: newIpInfo.isp, country: newIpInfo.country }
  );

  return {
    success: true,
    oldIp,
    newIp: newIpInfo.ip,
    isp: newIpInfo.isp,
    country: newIpInfo.country,
    city: newIpInfo.city,
    durationMs,
    timestamp: nowIso,
  };
}

/**
 * Gets Rotator Configuration from Database
 */
export function getRotatorConfig(): MobileRotatorConfig {
  try {
    const db = getDatabase();
    const row: any = db.prepare(`SELECT value_json FROM app_settings WHERE key = 'mobile_rotator_config'`).get();
    if (row && row.value_json) {
      return { ...DEFAULT_ROTATOR_CONFIG, ...JSON.parse(row.value_json) };
    }
  } catch {}
  return DEFAULT_ROTATOR_CONFIG;
}

/**
 * Saves Rotator Configuration
 */
export function saveRotatorConfig(config: Partial<MobileRotatorConfig>): MobileRotatorConfig {
  const current = getRotatorConfig();
  const updated = { ...current, ...config };

  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES ('mobile_rotator_config', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(JSON.stringify(updated), new Date().toISOString());
  } catch {}

  return updated;
}

