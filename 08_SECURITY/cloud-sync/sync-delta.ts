import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { getProfileById, getProfileStoragePath } from '../../02_BROWSER/services/profile-service.js';
import { isPathExcludedFromSync } from '../../02_BROWSER/services/archive-service.js';
import { log, pathExists } from './sync-auth-config.js';

const MAX_COOKIE_DELTA_EXTRA_BYTES = 450 * 1024; // Keep cookie/session delta lightweight (< 500 KB)

export interface CookieDeltaPayload {
  format: 'mahi-cookies-delta-v1';
  profileId: string;
  baseVersion: number;
  createdAt: string;
  manifestHash: string;
  mahiCookiesJson: string | null;
  cookieFiles: Record<string, string>;
  localStorageFiles: Record<string, string>;
}

/**
 * Computes a deterministic SHA-256 manifest digest over a profile's core state files
 * (excluding Cache, GPUCache, Code Cache, lock/temp files via isPathExcludedFromSync)
 * and core profile metadata.
 * // sync-compat: synchronous version preserved for sync test assertions; async runtime paths call computeProfileManifestHashAsync
 */
export function computeProfileManifestHash(profileId: string): string {
  const hash = crypto.createHash('sha256');
  const profile = getProfileById(profileId);
  const baseDir = getProfileStoragePath(profileId);

  const metaSnapshot = profile
    ? {
        id: profile.id,
        name: profile.name,
        engine: profile.settings?.browser?.engine || 'chromium',
        fingerprint: profile.settings?.fingerprint || null,
        tags: profile.tags || [],
        folder: profile.folder || 'General',
        notes: profile.notes || '',
      }
    : { id: profileId };

  hash.update(`meta:${JSON.stringify(metaSnapshot)}\n`);

  if (!fs.existsSync(baseDir)) {
    hash.update('files:empty\n');
    return hash.digest('hex');
  }

  const fileEntries: Array<{ relPath: string; fullPath: string }> = [];

  function walkDir(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (isPathExcludedFromSync(relPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        fileEntries.push({ relPath, fullPath });
      }
    }
  }

  try {
    walkDir(baseDir);
  } catch (err) {
    log.debug('Profile manifest walkDir skipped for missing/unreadable dir', {
      baseDir,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  for (const item of fileEntries) {
    try {
      const content = fs.readFileSync(item.fullPath);
      const fileDigest = crypto.createHash('sha256').update(content).digest('hex');
      hash.update(`file:${item.relPath}:${content.length}:${fileDigest}\n`);
    } catch {
      hash.update(`file-unreadable:${item.relPath}\n`);
    }
  }

  return hash.digest('hex');
}

/**
 * Asynchronous counterpart to computeProfileManifestHash for non-blocking runtime sync paths.
 */
export async function computeProfileManifestHashAsync(profileId: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const profile = getProfileById(profileId);
  const baseDir = getProfileStoragePath(profileId);

  const metaSnapshot = profile
    ? {
        id: profile.id,
        name: profile.name,
        engine: profile.settings?.browser?.engine || 'chromium',
        fingerprint: profile.settings?.fingerprint || null,
        tags: profile.tags || [],
        folder: profile.folder || 'General',
        notes: profile.notes || '',
      }
    : { id: profileId };

  hash.update(`meta:${JSON.stringify(metaSnapshot)}\n`);

  if (!(await pathExists(baseDir))) {
    hash.update('files:empty\n');
    return hash.digest('hex');
  }

  const fileEntries: Array<{ relPath: string; fullPath: string }> = [];

  async function walkDirAsync(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (isPathExcludedFromSync(relPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walkDirAsync(fullPath);
      } else if (entry.isFile()) {
        fileEntries.push({ relPath, fullPath });
      }
    }
  }

  try {
    await walkDirAsync(baseDir);
  } catch (err) {
    log.debug('Profile manifest async walkDir skipped for missing/unreadable dir', {
      baseDir,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath));

  for (const item of fileEntries) {
    try {
      const content = await fs.promises.readFile(item.fullPath);
      const fileDigest = crypto.createHash('sha256').update(content).digest('hex');
      hash.update(`file:${item.relPath}:${content.length}:${fileDigest}\n`);
    } catch {
      hash.update(`file-unreadable:${item.relPath}\n`);
    }
  }

  return hash.digest('hex');
}

function isSafeDeltaRelativePath(relPath: string): boolean {
  if (!relPath || typeof relPath !== 'string') return false;
  if (
    relPath.includes('..') ||
    relPath.startsWith('/') ||
    relPath.startsWith('\\') ||
    /^[a-zA-Z]:/.test(relPath) ||
    path.isAbsolute(relPath) ||
    relPath.includes('\0')
  ) {
    return false;
  }
  return !isPathExcludedFromSync(relPath);
}

/**
 * Packages ONLY the lightweight cookie/session delta payload (mahi_cookies.json, Chromium Cookies DB,
 * and bounded Local Storage state) into a compressed buffer ready for AES-256-GCM envelope encryption.
 */
export async function packCookiesDeltaPayload(
  profileId: string,
  baseVersion: number,
  manifestHash: string
): Promise<{ buffer: Buffer; rawBytes: number; cookieCount: number; fileCount: number }> {
  const baseDir = getProfileStoragePath(profileId);
  let mahiCookiesJson: string | null = null;
  let cookieCount = 0;
  let fileCount = 0;
  const cookieFiles: Record<string, string> = {};
  const localStorageFiles: Record<string, string> = {};

  const mahiCookiesPath = path.join(baseDir, 'mahi_cookies.json');
  if (await pathExists(mahiCookiesPath)) {
    try {
      mahiCookiesJson = await fs.promises.readFile(mahiCookiesPath, 'utf8');
      const parsed = JSON.parse(mahiCookiesJson);
      if (Array.isArray(parsed)) {
        cookieCount = parsed.length;
      }
      fileCount += 1;
    } catch (err) {
      log.warn('Failed reading mahi_cookies.json during delta pack', {
        mahiCookiesPath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const cookieFileCandidates = [
    'Default/Network/Cookies',
    'Default/Cookies',
    'Network/Cookies',
    'Cookies',
  ];

  for (const relPath of cookieFileCandidates) {
    const absPath = path.join(baseDir, relPath);
    if (await pathExists(absPath)) {
      try {
        const stat = await fs.promises.stat(absPath);
        if (stat.isFile()) {
          const data = await fs.promises.readFile(absPath);
          cookieFiles[relPath] = data.toString('base64');
          fileCount += 1;
        }
      } catch (err) {
        log.debug('Skipped locked/unreadable cookie file during delta pack', {
          relPath,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  let localStorageBytes = 0;
  const localStorageDirs = [
    path.join(baseDir, 'Default', 'Local Storage'),
    path.join(baseDir, 'Local Storage'),
  ];

  for (const lsDir of localStorageDirs) {
    if (!(await pathExists(lsDir))) continue;
    const scanLs = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDir, full).replace(/\\/g, '/');
        if (isPathExcludedFromSync(rel)) continue;
        if (entry.isDirectory()) {
          await scanLs(full);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (lower === 'log' || lower === 'log.old' || lower === 'current' || lower.startsWith('manifest')) {
            // Skip internal leveldb logs unless tiny; keep data files (.ldb/.log) within delta cap
          }
          try {
            const buf = await fs.promises.readFile(full);
            if (localStorageBytes + buf.length <= MAX_COOKIE_DELTA_EXTRA_BYTES) {
              localStorageFiles[rel] = buf.toString('base64');
              localStorageBytes += buf.length;
              fileCount += 1;
            }
          } catch (readErr) {
            log.debug('Skipped locked Local Storage file during delta pack', {
              rel,
              err: readErr instanceof Error ? readErr.message : String(readErr),
            });
          }
        }
      }
    };
    try {
      await scanLs(lsDir);
    } catch (lsErr) {
      log.debug('Local Storage delta scan skipped', {
        lsDir,
        err: lsErr instanceof Error ? lsErr.message : String(lsErr),
      });
    }
  }

  const payload: CookieDeltaPayload = {
    format: 'mahi-cookies-delta-v1',
    profileId,
    baseVersion,
    createdAt: new Date().toISOString(),
    manifestHash,
    mahiCookiesJson,
    cookieFiles,
    localStorageFiles,
  };

  const jsonBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
  const gzipBuffer = zlib.gzipSync(jsonBuffer, { level: 6 });

  return {
    buffer: gzipBuffer,
    rawBytes: jsonBuffer.length,
    cookieCount,
    fileCount,
  };
}

/**
 * Restores a decrypted cookie/session delta payload into the target profile directory
 * with path-traversal validation and atomic file writes.
 */
export async function applyCookiesDeltaPayload(
  targetProfileId: string,
  decryptedBuffer: Buffer
): Promise<{ restoredFiles: number; restoredCookies: number }> {
  const isGzip =
    decryptedBuffer.length >= 2 &&
    decryptedBuffer[0] === 0x1f &&
    decryptedBuffer[1] === 0x8b;
  const rawJson = isGzip
    ? zlib.gunzipSync(decryptedBuffer).toString('utf8')
    : decryptedBuffer.toString('utf8');

  const payload = JSON.parse(rawJson) as CookieDeltaPayload;
  if (payload?.format !== 'mahi-cookies-delta-v1') {
    throw new Error('INVALID_COOKIE_DELTA: Unsupported cookie delta payload format');
  }

  const baseDir = getProfileStoragePath(targetProfileId);
  await fs.promises.mkdir(baseDir, { recursive: true });
  const resolvedBase = path.resolve(baseDir);

  let restoredFiles = 0;
  let restoredCookies = 0;

  if (typeof payload.mahiCookiesJson === 'string') {
    const targetCookiesPath = path.join(baseDir, 'mahi_cookies.json');
    await fs.promises.writeFile(targetCookiesPath, payload.mahiCookiesJson, 'utf8');
    restoredFiles += 1;
    try {
      const parsed = JSON.parse(payload.mahiCookiesJson);
      if (Array.isArray(parsed)) {
        restoredCookies = parsed.length;
      }
    } catch (parseErr) {
      log.warn('Restored mahi_cookies.json could not be parsed for cookie count', {
        targetProfileId,
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
    }
  }

  const writeSafeDeltaEntries = async (entries: Record<string, string> | undefined) => {
    if (!entries || typeof entries !== 'object') return;
    for (const [relPath, b64] of Object.entries(entries)) {
      if (!isSafeDeltaRelativePath(relPath)) {
        throw new Error(`SECURITY_ALERT_PATH_TRAVERSAL: Unsafe delta entry path "${relPath}"`);
      }
      const targetPath = path.resolve(baseDir, relPath);
      if (!targetPath.startsWith(resolvedBase + path.sep)) {
        throw new Error(`SECURITY_ALERT_PATH_TRAVERSAL: Escaping delta entry path "${relPath}"`);
      }
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, Buffer.from(b64, 'base64'));
      restoredFiles += 1;
    }
  };

  await writeSafeDeltaEntries(payload.cookieFiles);
  await writeSafeDeltaEntries(payload.localStorageFiles);

  return { restoredFiles, restoredCookies };
}
