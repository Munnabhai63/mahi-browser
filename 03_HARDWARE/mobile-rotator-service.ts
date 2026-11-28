import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { getDatabase } from '../06_DATABASE/connection.js';
import { getBundledResourcePath, getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';
import { platformAdapter } from '../02_BROWSER/services/platform-adapter.js';
import { createLogger } from '../07_BACKEND/utils/logger.js';

const log = createLogger('mobile-rotator-service');
const nativeExecFileAsync = promisify(execFile);

function buildAdbExecEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!env.ANDROID_USER_HOME) {
    const home = os.homedir();
    let homeUsable = Boolean(home && fs.existsSync(home));
    if (homeUsable) {
      try {
        fs.accessSync(home, fs.constants.W_OK);
      } catch {
        homeUsable = false;
      }
    }
    if (!homeUsable) {
      const adbHome = path.join(getWritableUserDataDir(), 'adb-home');
      try {
        fs.mkdirSync(adbHome, { recursive: true });
      } catch (err) {
        log.debug('mobile-rotator adb-home mkdir skipped', { adbHome, err });
      }
      env.ANDROID_USER_HOME = adbHome;
    }
  }
  return env;
}

export type ExecFileFn = (
  file: string,
  args: string[],
  options?: { timeout?: number }
) => Promise<{ stdout: string; stderr: string }>;

let activeExecFileFn: ExecFileFn = (file, args, options) =>
  nativeExecFileAsync(file, args, {
    timeout: options?.timeout ?? 15000,
    windowsHide: true,
    env: buildAdbExecEnv(),
  });

export function _setMobileRotatorExecFileForTesting(fn: ExecFileFn | null): void {
  activeExecFileFn =
    fn ??
    ((file, args, options) =>
      nativeExecFileAsync(file, args, {
        timeout: options?.timeout ?? 15000,
        windowsHide: true,
        env: buildAdbExecEnv(),
      }));
}

export interface AdbDeviceItem {
  id: string;
  model: string;
  product?: string;
  status: 'device' | 'offline' | 'unauthorized';
}

export interface AdbEnvironmentStatus {
  installed: boolean;
  adbPath: string | null;
  source: 'env' | 'custom' | 'bundled' | 'managed' | 'sdk' | 'path' | 'missing';
  managedInstallDir: string;
  platform: NodeJS.Platform;
  downloadUrl: string;
  version?: string;
  error?: string;
}

export interface AdbInstallResult {
  success: boolean;
  adbPath?: string;
  version?: string;
  error?: string;
}

export interface PublicIpInfo {
  ip: string;
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  error?: string;
}

export interface MobileRotatorConfig {
  method: 'adb' | 'webhook';
  adbDeviceId?: string;
  customAdbPath?: string;
  airplaneDelayMs: number;
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST';
  autoRotateOnProfileStart: boolean;
  mobileModeEnabled: boolean;
  minIntervalSeconds: number;
}

export interface MobileRotationResult {
  success: boolean;
  ipChanged: boolean;
  skippedByCooldown?: boolean;
  cooldownRemainingSeconds?: number;
  oldIp: string;
  newIp: string;
  isp?: string;
  country?: string;
  city?: string;
  deviceId?: string;
  strategy?: string;
  durationMs: number;
  errorMessage?: string;
  timestamp: string;
}

export interface MobileRotationHistoryEntry {
  id: string;
  timestamp: string;
  method: 'adb' | 'webhook';
  oldIp: string;
  newIp: string;
  ipChanged: boolean;
  durationMs: number;
  status: 'SUCCESS' | 'NO_CHANGE' | 'COOLDOWN_SKIPPED' | 'FAILED';
  triggerSource: 'manual' | 'profile-start';
  profileId?: string;
  deviceId?: string;
  strategy?: string;
  message?: string;
}

const DEFAULT_ROTATOR_CONFIG: MobileRotatorConfig = {
  method: 'adb',
  airplaneDelayMs: 2500,
  webhookUrl: '',
  webhookMethod: 'GET',
  autoRotateOnProfileStart: false,
  mobileModeEnabled: false,
  minIntervalSeconds: 30,
};

const MAX_HISTORY_ENTRIES = 30;
const ADB_CONFIG_KEY = 'mobile_rotator_config';
const ADB_HISTORY_KEY = 'mobile_rotator_history';

let lastRotationTimestamp = 0;
let activeRotationPromise: Promise<MobileRotationResult> | null = null;
let activeAdbInstallPromise: Promise<AdbInstallResult> | null = null;

export function resetMobileRotatorStateForTesting(): void {
  lastRotationTimestamp = 0;
  activeRotationPromise = null;
  activeAdbInstallPromise = null;
}

export function getOfficialPlatformToolsUrl(platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    return 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';
  }
  if (platform === 'darwin') {
    return 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip';
  }
  return 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip';
}

export function getManagedPlatformToolsDir(): string {
  return path.join(getWritableUserDataDir(), 'tools', 'platform-tools');
}

export function getManagedAdbBinaryPath(): string {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  return path.join(getManagedPlatformToolsDir(), exe);
}

/**
 * Validates ADB serial numbers before passing them to execFile arguments.
 */
export function validateAdbDeviceId(deviceId: string): string {
  const trimmed = deviceId.trim();
  if (!trimmed || trimmed.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(trimmed)) {
    throw new Error(`Invalid ADB device identifier: "${deviceId}"`);
  }
  return trimmed;
}

function isExistingFile(filePath: string | undefined): filePath is string {
  if (!filePath || typeof filePath !== 'string') return false;
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function hasCompleteAdbBundle(adbBinaryPath: string | undefined): adbBinaryPath is string {
  if (!isExistingFile(adbBinaryPath)) return false;
  if (process.platform === 'win32') {
    const dir = path.dirname(adbBinaryPath);
    return (
      isExistingFile(path.join(dir, 'AdbWinApi.dll')) &&
      isExistingFile(path.join(dir, 'AdbWinUsbApi.dll'))
    );
  }
  return true;
}

/**
 * Resolves the ADB binary path from explicit env/config overrides,
 * MAHI bundled package resources, managed tools dir, Android SDK locations, or system PATH.
 */
export async function resolveAdbExecutable(customPath?: string): Promise<{
  adbPath: string | null;
  source: AdbEnvironmentStatus['source'];
}> {
  const exeName = process.platform === 'win32' ? 'adb.exe' : 'adb';

  if (isExistingFile(process.env.MAHI_ADB_PATH)) {
    return { adbPath: path.resolve(process.env.MAHI_ADB_PATH), source: 'env' };
  }

  const resolvedCustom = customPath || getRotatorConfig().customAdbPath;
  if (isExistingFile(resolvedCustom)) {
    return { adbPath: path.resolve(resolvedCustom), source: 'custom' };
  }

  const bundledCandidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'platform-tools', exeName) : '',
    getBundledResourcePath('platform-tools', exeName) || '',
    path.join(process.cwd(), '.mahi_data', 'platform-tools', exeName),
    path.join(process.cwd(), 'resources', 'platform-tools', exeName),
  ];
  for (const candidate of bundledCandidates) {
    if (hasCompleteAdbBundle(candidate)) {
      return { adbPath: path.resolve(candidate), source: 'bundled' };
    }
  }

  const managed = getManagedAdbBinaryPath();
  if (hasCompleteAdbBundle(managed)) {
    return { adbPath: managed, source: 'managed' };
  }

  const sdkCandidates: string[] = [];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const userProfile = process.env.USERPROFILE || os.homedir();
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    if (localAppData) {
      sdkCandidates.push(path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'));
      sdkCandidates.push(path.join(localAppData, 'Programs', 'platform-tools', 'adb.exe'));
    }
    if (userProfile) {
      sdkCandidates.push(path.join(userProfile, 'scoop', 'shims', 'adb.exe'));
      sdkCandidates.push(path.join(userProfile, 'platform-tools', 'adb.exe'));
    }
    sdkCandidates.push(path.join(programData, 'chocolatey', 'bin', 'adb.exe'));
    sdkCandidates.push('C:\\platform-tools\\adb.exe');
    sdkCandidates.push('C:\\adb\\adb.exe');
  } else {
    const home = os.homedir();
    sdkCandidates.push(
      path.join(home, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
      path.join(home, 'Android', 'Sdk', 'platform-tools', 'adb'),
      '/opt/homebrew/bin/adb',
      '/usr/local/bin/adb',
      '/usr/bin/adb'
    );
  }

  for (const candidate of sdkCandidates) {
    if (isExistingFile(candidate)) {
      return { adbPath: candidate, source: 'sdk' };
    }
  }

  // Fallback to system PATH lookup without opening an interactive shell
  try {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await activeExecFileFn(finder, ['adb'], { timeout: 3000 });
    const firstMatch = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && isExistingFile(line));
    if (firstMatch) {
      return { adbPath: firstMatch, source: 'path' };
    }
  } catch (err) {
    log.debug('mobile-rotator adb PATH lookup failed', { err });
  }

  return { adbPath: null, source: 'missing' };
}

/**
 * Reports whether ADB is available locally and where one-click installation targets.
 */
export async function getAdbEnvironmentStatus(): Promise<AdbEnvironmentStatus> {
  const managedInstallDir = getManagedPlatformToolsDir();
  const downloadUrl = getOfficialPlatformToolsUrl();
  const resolved = await resolveAdbExecutable();

  if (!resolved.adbPath) {
    return {
      installed: false,
      adbPath: null,
      source: 'missing',
      managedInstallDir,
      platform: process.platform,
      downloadUrl,
      error: 'ADB binary (platform-tools) is not installed on this machine.',
    };
  }

  let version: string | undefined;
  try {
    const { stdout } = await activeExecFileFn(resolved.adbPath, ['version'], { timeout: 5000 });
    version = stdout.split(/\r?\n/)[0]?.trim() || undefined;
  } catch (err) {
    log.debug('mobile-rotator optional adb version query failed', { adbPath: resolved.adbPath, err });
  }

  return {
    installed: true,
    adbPath: resolved.adbPath,
    source: resolved.source,
    managedInstallDir,
    platform: process.platform,
    downloadUrl,
    version,
  };
}

/**
 * Downloads and extracts official Google Android Platform Tools (ADB) into MAHI user data dir.
 */
export async function installAdbPlatformTools(): Promise<AdbInstallResult> {
  if (activeAdbInstallPromise) {
    return activeAdbInstallPromise;
  }

  activeAdbInstallPromise = (async (): Promise<AdbInstallResult> => {
    const downloadUrl = getOfficialPlatformToolsUrl();
    const toolsRoot = path.join(getWritableUserDataDir(), 'tools');
    const tempZipPath = path.join(toolsRoot, `platform-tools-${Date.now()}.zip`);

    try {
      fs.mkdirSync(toolsRoot, { recursive: true });

      const response = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'MAHI-Browser-ADB-Installer/1.0' },
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) {
        throw new Error(`Google repository returned HTTP ${response.status} (${response.statusText})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuffer);
      if (zipBuffer.length < 500_000) {
        throw new Error('Downloaded platform-tools archive is unexpectedly small or incomplete.');
      }

      fs.writeFileSync(tempZipPath, zipBuffer);
      await platformAdapter.extractZip(tempZipPath, toolsRoot);

      const expectedAdb = getManagedAdbBinaryPath();
      if (!isExistingFile(expectedAdb)) {
        throw new Error(`Extraction finished, but ADB binary was not found at ${expectedAdb}.`);
      }

      if (process.platform !== 'win32') {
        try {
          fs.chmodSync(expectedAdb, 0o755);
        } catch (err) {
          log.debug('mobile-rotator adb chmod skipped', { expectedAdb, err });
        }
      }

      const { stdout } = await activeExecFileFn(expectedAdb, ['version'], { timeout: 8000 });
      const version = stdout.split(/\r?\n/)[0]?.trim() || 'Installed';

      logActivity('NETWORK', 'INFO', 'ADB_TOOLS_INSTALLED', `Installed Android Platform Tools (${version}) to ${expectedAdb}`);

      return {
        success: true,
        adbPath: expectedAdb,
        version,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Failed to install Android Platform Tools: ${msg}`,
      };
    } finally {
      try {
        if (fs.existsSync(tempZipPath)) {
          fs.unlinkSync(tempZipPath);
        }
      } catch (cleanupErr) {
        log.debug('mobile-rotator temp platform-tools zip cleanup failed', { tempZipPath, err: cleanupErr });
      }
      activeAdbInstallPromise = null;
    }
  })();

  return activeAdbInstallPromise;
}

/**
 * Checks current public IP address querying fast, cache-busted endpoints.
 * Returns "Unknown" when offline instead of forging synthetic local/carrier values.
 */
export async function checkPublicIp(): Promise<PublicIpInfo> {
  const endpoints = [
    { url: 'https://ipinfo.io/json', isJson: true },
    { url: 'https://ipapi.co/json/', isJson: true },
    { url: 'https://api.ipify.org?format=json', isJson: true },
    { url: 'https://icanhazip.com', isJson: false },
  ];

  for (const ep of endpoints) {
    try {
      const data = await fetchWithTimeout(ep.url, 5000);
      if (ep.isJson) {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        const ip = typeof parsed.ip === 'string'
          ? parsed.ip.trim()
          : typeof parsed.query === 'string'
            ? parsed.query.trim()
            : '';
        if (ip) {
          return {
            ip,
            country:
              typeof parsed.country_name === 'string'
                ? parsed.country_name
                : typeof parsed.country === 'string'
                  ? parsed.country
                  : undefined,
            countryCode:
              typeof parsed.country_code === 'string'
                ? parsed.country_code
                : typeof parsed.country === 'string'
                  ? parsed.country
                  : undefined,
            city: typeof parsed.city === 'string' ? parsed.city : undefined,
            isp:
              typeof parsed.org === 'string'
                ? parsed.org
                : typeof parsed.isp === 'string'
                  ? parsed.isp
                  : undefined,
          };
        }
      } else {
        const cleanIp = data.trim();
        if (cleanIp && /^[0-9a-fA-F.:]+$/.test(cleanIp)) {
          return { ip: cleanIp };
        }
      }
    } catch (err) {
      log.debug('mobile-rotator public IP provider lookup failed, trying fallback', { err });
    }
  }

  return {
    ip: 'Unknown',
    error: 'Unable to reach public IP lookup providers. Check internet / tethering connection.',
  };
}

function fetchWithTimeout(urlStr: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const isHttps = urlStr.startsWith('https:');
    const client = isHttps ? https : http;

    const req = client.get(
      urlStr,
      {
        headers: {
          'User-Agent': 'MAHI-Browser-IP-Check/1.0',
          'Cache-Control': 'no-cache, no-store',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          clearTimeout(timer);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Timeout fetching IP from ${urlStr}`));
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Parses raw `adb devices -l` stdout lines into typed AdbDeviceItem records.
 */
export function parseAdbDevicesOutput(stdout: string): AdbDeviceItem[] {
  const lines = stdout.split(/\r?\n/);
  const devices: AdbDeviceItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('List of devices')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const id = parts[0];
    const rawState = parts[1];
    if (rawState !== 'device' && rawState !== 'offline' && rawState !== 'unauthorized') {
      continue;
    }

    const modelMatch = trimmed.match(/model:([^\s]+)/);
    const productMatch = trimmed.match(/product:([^\s]+)/);
    const model = modelMatch ? modelMatch[1].replace(/_/g, ' ') : 'Android Phone';
    const product = productMatch ? productMatch[1].replace(/_/g, ' ') : undefined;

    devices.push({
      id,
      model,
      product,
      status: rawState,
    });
  }

  return devices;
}

/**
 * Lists connected Android devices via ADB. Returns [] safely if ADB is missing or no devices attached.
 */
export async function getConnectedAdbDevices(): Promise<AdbDeviceItem[]> {
  try {
    const resolved = await resolveAdbExecutable();
    if (!resolved.adbPath) {
      return [];
    }

    const { stdout } = await activeExecFileFn(resolved.adbPath, ['devices', '-l'], { timeout: 15000 });
    return parseAdbDevicesOutput(stdout);
  } catch {
    return [];
  }
}

async function runAdbCommand(adbExe: string, deviceId: string | undefined, adbArgs: string[]): Promise<void> {
  const fullArgs = deviceId ? ['-s', validateAdbDeviceId(deviceId), ...adbArgs] : adbArgs;
  await activeExecFileFn(adbExe, fullArgs, { timeout: 12000 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Toggles mobile radio / Airplane Mode on an authorized Android device via ADB.
 */
export async function rotateViaAdb(
  deviceId?: string,
  delayMs = 2500
): Promise<{ ok: boolean; deviceId: string; strategy: string }> {
  const resolved = await resolveAdbExecutable();
  if (!resolved.adbPath) {
    throw new Error(
      'ADB binary not found on this PC. Click "Install ADB Platform Tools" in Mobile IP Rotator or install Android Platform Tools.'
    );
  }

  const adbExe = resolved.adbPath;
  const boundedDelay = Math.max(500, Math.min(20000, Number(delayMs) || 2500));

  const { stdout } = await activeExecFileFn(adbExe, ['devices', '-l'], { timeout: 15000 });
  const attached = parseAdbDevicesOutput(stdout);

  let selectedDevice: AdbDeviceItem | undefined;
  if (deviceId) {
    const validated = validateAdbDeviceId(deviceId);
    selectedDevice = attached.find((d) => d.id === validated);
    if (!selectedDevice) {
      throw new Error(`Selected Android device "${validated}" is not connected via USB.`);
    }
  } else {
    selectedDevice = attached.find((d) => d.status === 'device') || attached[0];
  }

  if (!selectedDevice) {
    throw new Error('No Android device detected. Plug in your phone via USB with USB Debugging enabled.');
  }
  if (selectedDevice.status === 'unauthorized') {
    throw new Error(
      `Phone "${selectedDevice.id}" is unauthorized. Unlock your phone screen and tap "Allow USB debugging".`
    );
  }
  if (selectedDevice.status === 'offline') {
    throw new Error(
      `Phone "${selectedDevice.id}" appears offline. Unplug and reconnect the USB cable (File Transfer / PTP mode).`
    );
  }

  const targetId = selectedDevice.id;

  // Strategy 1: Modern Android connectivity command (Android 11+)
  try {
    await runAdbCommand(adbExe, targetId, ['shell', 'cmd', 'connectivity', 'airplane-mode', 'enable']);
    await sleep(boundedDelay);
    await runAdbCommand(adbExe, targetId, ['shell', 'cmd', 'connectivity', 'airplane-mode', 'disable']);
    return { ok: true, deviceId: targetId, strategy: 'cmd-connectivity-airplane-mode' };
  } catch (err) {
    log.debug('mobile-rotator cmd connectivity strategy unsupported, falling back', { deviceId: targetId, err });
  }

  // Strategy 2: Legacy global setting + broadcast intent
  try {
    await runAdbCommand(adbExe, targetId, ['shell', 'settings', 'put', 'global', 'airplane_mode_on', '1']);
    await runAdbCommand(adbExe, targetId, [
      'shell',
      'am',
      'broadcast',
      '-a',
      'android.intent.action.AIRPLANE_MODE',
      '--ez',
      'state',
      'true',
    ]);
    await sleep(boundedDelay);
    await runAdbCommand(adbExe, targetId, ['shell', 'settings', 'put', 'global', 'airplane_mode_on', '0']);
    await runAdbCommand(adbExe, targetId, [
      'shell',
      'am',
      'broadcast',
      '-a',
      'android.intent.action.AIRPLANE_MODE',
      '--ez',
      'state',
      'false',
    ]);
    return { ok: true, deviceId: targetId, strategy: 'settings-airplane-mode-broadcast' };
  } catch (err) {
    log.warn('mobile-rotator settings airplane-mode broadcast failed, reverting airplane_mode_on=0', { deviceId: targetId, err });
    try {
      await runAdbCommand(adbExe, targetId, ['shell', 'settings', 'put', 'global', 'airplane_mode_on', '0']);
    } catch (revertErr) {
      log.warn('mobile-rotator airplane_mode_on revert failed', { deviceId: targetId, err: revertErr });
    }
  }

  // Strategy 3: Cellular radio reset via svc data disable/enable (works when airplane-mode broadcast is restricted)
  try {
    await runAdbCommand(adbExe, targetId, ['shell', 'svc', 'data', 'disable']);
    await sleep(boundedDelay);
    await runAdbCommand(adbExe, targetId, ['shell', 'svc', 'data', 'enable']);
    return { ok: true, deviceId: targetId, strategy: 'svc-mobile-data-cycle' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `ADB rotation failed on "${targetId}": ${msg}. On Xiaomi/OPPO/Realme devices, enable "USB debugging (Security settings)" in Developer Options.`
    );
  }
}

/**
 * Triggers a remote rotation URL (e.g. USB Dongle API, iProxy, companion Android app).
 */
export async function rotateViaWebhook(url: string, method: 'GET' | 'POST' = 'GET'): Promise<boolean> {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid webhook rotation URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('Invalid webhook rotation URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Invalid webhook rotation URL');
  }

  const res = await fetch(parsed.toString(), {
    method,
    headers: { 'User-Agent': 'MAHI-Browser-Mobile-Rotator/1.0' },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`Webhook rotation endpoint returned HTTP ${res.status} (${res.statusText})`);
  }

  return true;
}

function appendRotationHistory(entry: MobileRotationHistoryEntry): void {
  try {
    const current = getRotationHistory();
    const updated = [entry, ...current].slice(0, MAX_HISTORY_ENTRIES);
    const db = getDatabase();
    db.prepare(`
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(ADB_HISTORY_KEY, JSON.stringify(updated), new Date().toISOString());
  } catch (err) {
    log.debug('mobile-rotator history DB write skipped (uninitialized DB in minimal context)', { err });
  }
}

export function getRotationHistory(): MobileRotationHistoryEntry[] {
  try {
    const db = getDatabase();
    const row = db
      .prepare('SELECT value_json FROM app_settings WHERE key = ?')
      .get(ADB_HISTORY_KEY) as { value_json?: string } | undefined;
    if (row?.value_json) {
      const parsed = JSON.parse(row.value_json);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    log.debug('mobile-rotator history DB read failed', { err });
  }
  return [];
}

export function clearRotationHistory(): boolean {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(ADB_HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}

export interface RotateMobileIpOptions {
  respectCooldown?: boolean;
  triggerSource?: 'manual' | 'profile-start';
  profileId?: string;
}

/**
 * Master Mobile IP Rotation Execution (single-flight locked, cooldown-aware, persisted history).
 */
export async function rotateMobileIp(
  customConfig?: Partial<MobileRotatorConfig>,
  options?: RotateMobileIpOptions
): Promise<MobileRotationResult> {
  if (activeRotationPromise) {
    return activeRotationPromise;
  }

  activeRotationPromise = (async (): Promise<MobileRotationResult> => {
    const startTime = Date.now();
    const config = { ...getRotatorConfig(), ...(customConfig || {}) };
    const triggerSource = options?.triggerSource || 'manual';
    const minIntervalMs = Math.max(0, Number(config.minIntervalSeconds || 0)) * 1000;

    if (options?.respectCooldown && minIntervalMs > 0 && lastRotationTimestamp > 0) {
      const elapsed = Date.now() - lastRotationTimestamp;
      if (elapsed < minIntervalMs) {
        const remainingSeconds = Math.ceil((minIntervalMs - elapsed) / 1000);
        const currentIpInfo = await checkPublicIp();
        const nowIso = new Date().toISOString();

        appendRotationHistory({
          id: crypto.randomUUID(),
          timestamp: nowIso,
          method: config.method,
          oldIp: currentIpInfo.ip,
          newIp: currentIpInfo.ip,
          ipChanged: false,
          durationMs: Date.now() - startTime,
          status: 'COOLDOWN_SKIPPED',
          triggerSource,
          profileId: options?.profileId,
          message: `Skipped auto-rotate: cooldown active (${remainingSeconds}s remaining).`,
        });

        return {
          success: true,
          ipChanged: false,
          skippedByCooldown: true,
          cooldownRemainingSeconds: remainingSeconds,
          oldIp: currentIpInfo.ip,
          newIp: currentIpInfo.ip,
          isp: currentIpInfo.isp,
          country: currentIpInfo.country,
          city: currentIpInfo.city,
          durationMs: Date.now() - startTime,
          timestamp: nowIso,
        };
      }
    }

    const preIpInfo = await checkPublicIp();
    const oldIp = preIpInfo.ip;

    let rotatedDeviceId: string | undefined;
    let strategy = '';

    try {
      if (config.method === 'adb') {
        const adbRes = await rotateViaAdb(config.adbDeviceId, config.airplaneDelayMs || 2500);
        rotatedDeviceId = adbRes.deviceId;
        strategy = adbRes.strategy;
      } else if (config.method === 'webhook' && config.webhookUrl) {
        await rotateViaWebhook(config.webhookUrl, config.webhookMethod || 'GET');
        strategy = `webhook-${config.webhookMethod || 'GET'}`;
        await sleep(1800);
      } else {
        throw new Error('No valid rotation method or webhook URL configured.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const nowIso = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      appendRotationHistory({
        id: crypto.randomUUID(),
        timestamp: nowIso,
        method: config.method,
        oldIp,
        newIp: oldIp,
        ipChanged: false,
        durationMs,
        status: 'FAILED',
        triggerSource,
        profileId: options?.profileId,
        deviceId: config.adbDeviceId,
        message: msg,
      });

      logActivity('NETWORK', 'WARNING', 'MOBILE_IP_ROTATE_FAILED', msg, undefined, options?.profileId);
      throw new Error(msg);
    }

    // Wait for carrier data reconnection and verify IP (up to 6 checks x 1.5s)
    let newIpInfo: PublicIpInfo = { ip: oldIp, isp: preIpInfo.isp, country: preIpInfo.country, city: preIpInfo.city };
    for (let attempt = 1; attempt <= 6; attempt++) {
      await sleep(1500);
      try {
        const info = await checkPublicIp();
        if (info.ip && info.ip !== 'Unknown') {
          newIpInfo = info;
          if (oldIp === 'Unknown' || info.ip !== oldIp) {
            break;
          }
        }
      } catch (err) {
        log.debug('mobile-rotator IP poll retry while carrier re-attaches', { err });
      }
    }

    lastRotationTimestamp = Date.now();
    const durationMs = Date.now() - startTime;
    const nowIso = new Date().toISOString();
    const ipChanged =
      Boolean(newIpInfo.ip && newIpInfo.ip !== 'Unknown') &&
      (oldIp === 'Unknown' || newIpInfo.ip !== oldIp);

    const status: MobileRotationHistoryEntry['status'] = ipChanged ? 'SUCCESS' : 'NO_CHANGE';
    const summaryMsg = ipChanged
      ? `Mobile IP rotated: ${oldIp} -> ${newIpInfo.ip} (${newIpInfo.isp || 'Carrier'}) in ${Math.round(durationMs / 1000)}s.`
      : `Signal completed on ${rotatedDeviceId || 'webhook'}, but public IP remained ${newIpInfo.ip}. Ensure Windows is tethered to phone hotspot/USB instead of Wi-Fi, or increase delay.`;

    appendRotationHistory({
      id: crypto.randomUUID(),
      timestamp: nowIso,
      method: config.method,
      oldIp,
      newIp: newIpInfo.ip,
      ipChanged,
      durationMs,
      status,
      triggerSource,
      profileId: options?.profileId,
      deviceId: rotatedDeviceId,
      strategy,
      message: summaryMsg,
    });

    logActivity('NETWORK', ipChanged ? 'INFO' : 'WARNING', 'MOBILE_IP_ROTATED', summaryMsg, undefined, options?.profileId, {
      oldIp,
      newIp: newIpInfo.ip,
      ipChanged,
      isp: newIpInfo.isp,
      country: newIpInfo.country,
      strategy,
    });

    return {
      success: true,
      ipChanged,
      oldIp,
      newIp: newIpInfo.ip,
      isp: newIpInfo.isp,
      country: newIpInfo.country,
      city: newIpInfo.city,
      deviceId: rotatedDeviceId,
      strategy,
      durationMs,
      errorMessage: ipChanged ? undefined : 'Carrier reassigned the same IP or PC traffic is not routed through the phone.',
      timestamp: nowIso,
    };
  })().finally(() => {
    activeRotationPromise = null;
  });

  return activeRotationPromise;
}

/**
 * Called by ProcessManager before launching a profile.
 * Executes IP rotation when `autoRotateOnProfileStart` is enabled while honoring cooldown.
 * Never throws so temporary phone/network disconnects do not brick unrelated browser launches.
 */
export async function maybeAutoRotateOnProfileStart(profileId: string): Promise<{
  triggered: boolean;
  result?: MobileRotationResult;
  error?: string;
}> {
  const config = getRotatorConfig();
  if (!config.autoRotateOnProfileStart) {
    return { triggered: false };
  }

  try {
    const result = await rotateMobileIp(config, {
      respectCooldown: true,
      triggerSource: 'profile-start',
      profileId,
    });
    return { triggered: true, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { triggered: true, error: message };
  }
}

/**
 * Gets Rotator Configuration from Database
 */
export function getRotatorConfig(): MobileRotatorConfig {
  try {
    const db = getDatabase();
    const row = db
      .prepare('SELECT value_json FROM app_settings WHERE key = ?')
      .get(ADB_CONFIG_KEY) as { value_json?: string } | undefined;
    if (row?.value_json) {
      return { ...DEFAULT_ROTATOR_CONFIG, ...JSON.parse(row.value_json) };
    }
  } catch (err) {
    log.debug('mobile-rotator config DB read failed, returning defaults', { err });
  }
  return { ...DEFAULT_ROTATOR_CONFIG };
}

/**
 * Saves Rotator Configuration
 */
export function saveRotatorConfig(config: Partial<MobileRotatorConfig>): MobileRotatorConfig {
  const current = getRotatorConfig();
  const updated: MobileRotatorConfig = {
    ...current,
    ...config,
    mobileModeEnabled: Boolean(config.mobileModeEnabled ?? current.mobileModeEnabled),
    airplaneDelayMs: Math.max(500, Math.min(20000, Number(config.airplaneDelayMs ?? current.airplaneDelayMs) || 2500)),
    minIntervalSeconds: Math.max(0, Math.min(3600, Number(config.minIntervalSeconds ?? current.minIntervalSeconds) || 0)),
  };

  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(ADB_CONFIG_KEY, JSON.stringify(updated), new Date().toISOString());
  } catch (err) {
    log.warn('mobile-rotator config DB write failed', { err });
  }

  return updated;
}
