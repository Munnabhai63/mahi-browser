/**
 * MAHI Browser — Safe Profile Cache Cleaning Script
 *
 * Removes safe-to-clean Chromium cache directories while strictly protecting:
 * - mahi.db and all SQLite databases
 * - Cookies, Local Storage, IndexedDB, Session Storage
 * - Preferences, Secure Preferences, Network state
 * - Bundled and downloaded engines (.mahi_data/engines)
 *
 * Defaults to DRY-RUN mode (0 files deleted).
 * Pass '--apply' to execute live deletion.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  if (lower.endsWith('.sqlite') || lower.endsWith('.sqlite-wal') || lower.endsWith('.sqlite-shm') || lower.endsWith('.sqlite-journal')) return true;
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
        } catch {}
      }
    } catch {}
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
  } catch {}
  return false;
}

/**
 * Core cleaning and preview function
 */
export async function cleanProfileCaches(options: CleanCacheOptions = {}): Promise<CleanCacheResult> {
  const baseDir = path.resolve(options.baseDir || path.join(process.cwd(), '.mahi_data'));
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
    if (!silent) console.log(`[clean-cache] Base directory does not exist: ${baseDir}`);
    return result;
  }

  // Find candidate top-level directories to scan
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

  // Find all allowlisted cache directories
  const cacheFoldersToProcess: string[] = [];

  function findCacheDirs(currentDir: string, depth = 0) {
    if (depth > 6) return; // Prevent excessive recursion
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const lower = ent.name.toLowerCase();

      // Skip protected subdirectories
      if (lower === 'engines' || isProtectedName(ent.name)) {
        result.skippedProtectedCount++;
        continue;
      }

      const fullPath = path.join(currentDir, ent.name);

      if (ALLOWED_CACHE_FOLDER_NAMES.has(lower)) {
        // Double-check no critical user data is accidentally nested inside
        if (containsProtectedFiles(fullPath)) {
          result.skippedProtectedCount++;
          if (!silent) console.warn(`[clean-cache] Skipping cache folder containing protected files: ${fullPath}`);
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

  // Measure and optionally delete
  for (const folder of cacheFoldersToProcess) {
    const metrics = getDirectoryMetrics(folder);
    result.cacheFoldersMatched++;
    result.filesMatched += metrics.files;
    result.bytesReclaimable += metrics.bytes;

    if (apply) {
      try {
        fs.rmSync(folder, { recursive: true, force: true });
        result.deletedFolders++;
      } catch (err: any) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          result.skippedLockedFolders++;
          if (!silent) {
            console.warn(`[clean-cache] Skipped locked profile folder (running browser): ${folder}`);
          }
        } else {
          result.errors.push(`${folder}: ${err.message}`);
        }
      }
    }
  }

  result.mbReclaimable = Number((result.bytesReclaimable / (1024 * 1024)).toFixed(2));
  result.gbReclaimable = Number((result.bytesReclaimable / (1024 * 1024 * 1024)).toFixed(3));

  return result;
}

/**
 * CLI Entry Point
 */
export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const includeTestProfiles = args.includes('--include-test-profiles');

  console.log('='.repeat(78));
  console.log('MAHI BROWSER — PROFILE CACHE CLEANER');
  console.log(`Mode: ${apply ? 'LIVE APPLY (Deleting allowlisted caches)' : 'DRY RUN (Preview Only — 0 files will be deleted)'}`);
  if (!apply) {
    console.log("      Pass '--apply' to permanently clean allowlisted cache files.");
  }
  if (includeTestProfiles) {
    console.log("      Flag '--include-test-profiles' enabled (test-* profiles included).");
  }
  console.log(`Allowlist: ${Array.from(ALLOWED_CACHE_FOLDER_NAMES).join(', ')}`);
  console.log('='.repeat(78));

  const startTime = Date.now();
  console.log('\nScanning .mahi_data directories, please wait...');
  const result = await cleanProfileCaches({ apply, includeTestProfiles });
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(78));
  console.log('CACHE CLEANING REPORT');
  console.log('='.repeat(78));
  console.log(`Target Base Dir:        ${result.baseDir}`);
  console.log(`Cache Folders Found:    ${result.cacheFoldersMatched}`);
  console.log(`Total Files Found:      ${result.filesMatched.toLocaleString()}`);
  console.log(`Space Reclaimable:      ${result.mbReclaimable.toLocaleString()} MB (${result.gbReclaimable} GB)`);
  if (result.dryRun) {
    console.log(`Folders Deleted:        0 (Dry-Run Preview Safe)`);
    console.log(`Action Required:        Run 'npm run profiles:clean-cache:apply' to free this space.`);
  } else {
    console.log(`Folders Deleted:        ${result.deletedFolders}`);
    console.log(`Skipped Locked/Busy:    ${result.skippedLockedFolders}`);
    if (result.errors.length > 0) {
      console.log(`Encountered Errors:     ${result.errors.length}`);
    }
  }
  console.log(`Scan Time Elapsed:      ${elapsedSec}s`);
  console.log('='.repeat(78) + '\n');
}

// Auto-run if executed directly via CLI
const isDirectCli = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
  process.argv[1].endsWith('clean-profile-caches.ts')
);

if (isDirectCli) {
  runCli().catch((err) => {
    console.error('[clean-cache] Unhandled error:', err);
    process.exit(1);
  });
}
