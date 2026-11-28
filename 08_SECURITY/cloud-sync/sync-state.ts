import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { BrowserWindow } from '../electron-bridge.js';
import type { CloudSyncStatus, CloudSyncProgressEvent } from '../../10_CONFIG/shared/types/sync.js';
import { log, pathExists, getSyncBindingsPath, getSyncStatusCachePath } from './sync-auth-config.js';

// ============================================================================
// PROFILE BINDING STORAGE (Local UUID <-> Cloud Profile ID & Version)
// ============================================================================
export interface CloudBindingInfo {
  cloudProfileId: string;
  lastSyncedVersion: number;
  updatedAt: string;
  lastManifestHash?: string;
  lastSyncedMode?: 'full' | 'cookies_only';
  lastDeltaVersion?: number;
}

// sync-compat: synchronous JSON accessors preserved for process-manager sync hooks & unit tests; async runtime paths use *Async
export function getProfileCloudBinding(profileId: string): CloudBindingInfo | null {
  try {
    const file = getSyncBindingsPath();
    if (fs.existsSync(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(fs.readFileSync(file, 'utf8'));
      return map[profileId] || null;
    }
  } catch (err) {
    log.warn('Failed reading cloud profile bindings cache', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export function setProfileCloudBinding(profileId: string, binding: CloudBindingInfo): void {
  try {
    const file = getSyncBindingsPath();
    const map: Record<string, CloudBindingInfo> = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : {};
    map[profileId] = binding;
    fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    log.error('[CloudSync] Failed to save profile binding:', err);
  }
}

export function removeProfileCloudBinding(profileId: string): void {
  try {
    const file = getSyncBindingsPath();
    if (fs.existsSync(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(fs.readFileSync(file, 'utf8'));
      delete map[profileId];
      fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf8');
    }
  } catch (err) {
    log.warn('Failed removing cloud profile binding entry', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getProfileCloudBindingAsync(profileId: string): Promise<CloudBindingInfo | null> {
  try {
    const file = getSyncBindingsPath();
    if (await pathExists(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      return map[profileId] || null;
    }
  } catch (err) {
    log.warn('Failed reading cloud profile bindings cache asynchronously', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export async function setProfileCloudBindingAsync(profileId: string, binding: CloudBindingInfo): Promise<void> {
  try {
    const file = getSyncBindingsPath();
    const map: Record<string, CloudBindingInfo> = (await pathExists(file))
      ? JSON.parse(await fs.promises.readFile(file, 'utf8'))
      : {};
    map[profileId] = binding;
    await fs.promises.writeFile(file, JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    log.error('[CloudSync] Failed to save profile binding asynchronously:', err);
  }
}

export async function removeProfileCloudBindingAsync(profileId: string): Promise<void> {
  try {
    const file = getSyncBindingsPath();
    if (await pathExists(file)) {
      const map: Record<string, CloudBindingInfo> = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      delete map[profileId];
      await fs.promises.writeFile(file, JSON.stringify(map, null, 2), 'utf8');
    }
  } catch (err) {
    log.warn('Failed removing cloud profile binding entry asynchronously', {
      profileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ============================================================================
// STATUS TRACKING & BROADCASTING
// ============================================================================
function readLocalSyncStatus(): Record<string, { status: CloudSyncStatus; updatedAt: string }> {
  try {
    const p = getSyncStatusCachePath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (err) {
    log.warn('Failed reading local sync status cache', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return {};
}

export function updateLocalSyncStatus(profileId: string, status: CloudSyncStatus): void {
  try {
    const map = readLocalSyncStatus();
    map[profileId] = { status, updatedAt: new Date().toISOString() };
    fs.writeFileSync(getSyncStatusCachePath(), JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    log.warn('Failed updating local sync status cache', {
      profileId,
      status,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export function getProfileSyncStatus(profileId: string): CloudSyncStatus {
  const map = readLocalSyncStatus();
  return map[profileId]?.status || 'LOCAL_ONLY';
}

export function getAllProfilesSyncStatus(): Record<string, CloudSyncStatus> {
  const map = readLocalSyncStatus();
  const res: Record<string, CloudSyncStatus> = {};
  for (const [k, v] of Object.entries(map)) {
    res[k] = v.status;
  }
  return res;
}

async function readLocalSyncStatusAsync(): Promise<Record<string, { status: CloudSyncStatus; updatedAt: string }>> {
  try {
    const p = getSyncStatusCachePath();
    if (await pathExists(p)) {
      return JSON.parse(await fs.promises.readFile(p, 'utf8'));
    }
  } catch (err) {
    log.warn('Failed reading local sync status cache asynchronously', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return {};
}

export async function updateLocalSyncStatusAsync(profileId: string, status: CloudSyncStatus): Promise<void> {
  try {
    const map = await readLocalSyncStatusAsync();
    map[profileId] = { status, updatedAt: new Date().toISOString() };
    await fs.promises.writeFile(getSyncStatusCachePath(), JSON.stringify(map, null, 2), 'utf8');
  } catch (err) {
    log.warn('Failed updating local sync status cache asynchronously', {
      profileId,
      status,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getAllProfilesSyncStatusAsync(): Promise<Record<string, CloudSyncStatus>> {
  const map = await readLocalSyncStatusAsync();
  const res: Record<string, CloudSyncStatus> = {};
  for (const [k, v] of Object.entries(map)) {
    res[k] = v.status;
  }
  return res;
}

let hasBroadcastAuthError = false;
let isQueuePausedForQuota = false;

export function getQueuePausedStatus(): boolean {
  return isQueuePausedForQuota;
}

export function setQueuePausedForQuota(paused: boolean): void {
  isQueuePausedForQuota = paused;
}

export function hasBroadcastAuthErrorSent(): boolean {
  return hasBroadcastAuthError;
}

export function setHasBroadcastAuthError(sent: boolean): void {
  hasBroadcastAuthError = sent;
}

export function resetQueuePausedStatus(): void {
  isQueuePausedForQuota = false;
  hasBroadcastAuthError = false;
}

export function broadcastSyncToast(
  type: 'info' | 'warning' | 'error' | 'success',
  title: string,
  message: string
): void {
  if (BrowserWindow?.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('toast:show', { type, title, message });
        }
      });
    } catch (err) {
      log.debug('Skipped cloud sync toast broadcast IPC', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function broadcastProgress(event: CloudSyncProgressEvent): void {
  if (BrowserWindow?.getAllWindows) {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('sync:progress', event);
        }
      });
    } catch (err) {
      log.debug('Skipped cloud sync progress broadcast IPC', {
        stage: event.stage,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ============================================================================
// NETWORK HELPERS
// ============================================================================
export function requestApi(
  urlStr: string,
  options: https.RequestOptions,
  body?: Buffer
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.request(urlStr, options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Sync network request timed out'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}
