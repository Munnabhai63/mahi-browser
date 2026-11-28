/**
 * MAHI Browser — Safe Profile Cache Cleaning Service
 *
 * Removes safe-to-clean Chromium cache directories while strictly protecting:
 * - mahi.db and all SQLite databases
 * - Cookies, Local Storage, IndexedDB, Session Storage
 * - Preferences, Secure Preferences, Network state
 * - Bundled and downloaded engines (.mahi_data/engines)
 *
 * Shared single source of truth for both Electron Main IPC and CLI tooling.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getWritableUserDataDir } from '../utils/runtime-paths.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('profile-cache-cleaner');

export interface CleanCacheOptions {
  baseDir?: string;
  apply?: boolean;
  includeTestProfiles?: boolean;
  silent?: boolean;
}

export interface CleanCacheResult {
  dryRun: boolean;
  baseDir: string;
  cacheFoldersMatched: number;
  filesMatched: number;
  bytesReclaimable: number;
  mbReclaimable: number;
  gbReclaimable: number;
  deletedFolders: number;
  skippedLockedFolders: number;
  skippedProtectedCount: number;
  errors: string[];
}

/**
 * Strict allowlist of Chromium cache directory names (case-insensitive)
 */
export const ALLOWED_CACHE_FOLDER_NAMES = new Set([
  'cache',
  'cache_data',
  'code cache',
  'gpucache',
  'grshadercache',
  'shadercache',
  'crashpad',
]);

/**
 * Explicitly protected directory and file name patterns (never deleted or recursed into for cache removal)
 */
export const PROTECTED_EXACT_NAMES = new Set([
  'engines',
  'cloud_storage',
  'cloud-workers',
  'mahi.db',
  '.mahi_master.key',
  'cookies',
  'cookies-journal',
  'local storage',
  'indexeddb',
  'session storage',
  'preferences',
  'secure preferences',
  'network',
  'network persistent state',
  'login data',
  'web data',
]);

/**
 * Checks if a file or directory name is protected
 */
export function isProtectedName(name: string): boolean {
  const lower = name.toLowerCase();
  if (PROTECTED_EXACT_NAMES.has(lower)) return true;
  if (
    lower.endsWith('.sqlite') ||
    lower.endsWith('.sqlite-wal') ||
    lower.endsWith('.sqlite-shm') ||
    lower.endsWith('.sqlite-journal')
  ) {
    return true;
  }
  if (lower.startsWith('cookies')) return true;
  return false;
}

/**
 * Recursively measures file count and byte size within a directory
 */
export function getDirectoryMetrics(dirPath: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;

  function walk(current: string) {
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        try {
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile()) {
            const stat = fs.statSync(full);
            bytes += stat.size;
            files++;
          }
        } catch (statErr) {
          log.debug('Profile cache file stat skipped during size scan', {
            full,
            err: statErr instanceof Error ? statErr.message : String(statErr),
          });
        }
      }
    } catch (readErr) {
      log.debug('Profile cache dir read skipped during size scan', {
        current,
        err: readErr instanceof Error ? readErr.message : String(readErr),
      });
    }
  }

  walk(dirPath);
  return { files, bytes };
}

/**
 * Verifies that a cache folder does not contain any accidentally nested critical data
 */
export function containsProtectedFiles(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (isProtectedName(entry.name)) return true;
      if (entry.isDirectory()) {
        if (containsProtectedFiles(path.join(dirPath, entry.name))) return true;
      }
    }
  } catch (err) {
    log.debug('Protected-file safety check dir read skipped', {
      dirPath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return false;
}

/**
 * Core cleaning and preview function
 */
export async function cleanProfileCaches(options: CleanCacheOptions = {}): Promise<CleanCacheResult> {
  const baseDir = path.resolve(options.baseDir || getWritableUserDataDir());
  const apply = Boolean(options.apply);
  const includeTestProfiles = Boolean(options.includeTestProfiles);
  const silent = Boolean(options.silent);

  const result: CleanCacheResult = {
    dryRun: !apply,
    baseDir,
    cacheFoldersMatched: 0,
    filesMatched: 0,
    bytesReclaimable: 0,
    mbReclaimable: 0,
    gbReclaimable: 0,
    deletedFolders: 0,
    skippedLockedFolders: 0,
    skippedProtectedCount: 0,
    errors: [],
  };

  if (!fs.existsSync(baseDir)) {
    if (!silent) log.info(`[clean-cache] Base directory does not exist: ${baseDir}`);
    return result;
  }

  const topEntries = fs.readdirSync(baseDir, { withFileTypes: true });
  const scanRoots: string[] = [];

  for (const ent of topEntries) {
    if (!ent.isDirectory()) continue;
    const lower = ent.name.toLowerCase();

    // Never scan engines directory
    if (lower === 'engines') {
      result.skippedProtectedCount++;
      continue;
    }

    // Skip leftover test directories unless explicitly requested
    if ((lower.startsWith('test-') || lower.startsWith('test_')) && !includeTestProfiles) {
      continue;
    }

    scanRoots.push(path.join(baseDir, ent.name));
  }

  const cacheFoldersToProcess: string[] = [];

  function findCacheDirs(currentDir: string, depth = 0) {
    if (depth > 6) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const lower = ent.name.toLowerCase();

      if (lower === 'engines' || isProtectedName(ent.name)) {
        result.skippedProtectedCount++;
        continue;
      }

      const fullPath = path.join(currentDir, ent.name);

      if (ALLOWED_CACHE_FOLDER_NAMES.has(lower)) {
        if (containsProtectedFiles(fullPath)) {
          result.skippedProtectedCount++;
          if (!silent) log.warn(`[clean-cache] Skipping cache folder containing protected files: ${fullPath}`);
          continue;
        }
        cacheFoldersToProcess.push(fullPath);
      } else {
        findCacheDirs(fullPath, depth + 1);
      }
    }
  }

  for (const root of scanRoots) {
    findCacheDirs(root);
  }

  for (const folder of cacheFoldersToProcess) {
    const metrics = getDirectoryMetrics(folder);
    result.cacheFoldersMatched++;
    result.filesMatched += metrics.files;
    result.bytesReclaimable += metrics.bytes;

    if (apply) {
      try {
        fs.rmSync(folder, { recursive: true, force: true });
        result.deletedFolders++;
      } catch (err: unknown) {
        const errno = err as NodeJS.ErrnoException | null;
        const msg = err instanceof Error ? err.message : String(err);
        if (errno?.code === 'EBUSY' || errno?.code === 'EPERM') {
          result.skippedLockedFolders++;
          if (!silent) {
            log.warn(`[clean-cache] Skipped locked profile folder (running browser): ${folder}`);
          }
        } else {
          result.errors.push(`${folder}: ${msg}`);
        }
      }
    }
  }

  result.mbReclaimable = Number((result.bytesReclaimable / (1024 * 1024)).toFixed(2));
  result.gbReclaimable = Number((result.bytesReclaimable / (1024 * 1024 * 1024)).toFixed(3));

  return result;
}
