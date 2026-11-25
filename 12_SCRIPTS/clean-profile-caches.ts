/**
 * MAHI Browser — Safe Profile Cache Cleaning CLI
 *
 * Delegates core allowlist pruning logic to 07_BACKEND/services/profile-cache-cleaner.ts
 * so CLI and Electron Main share one single source of truth.
 *
 * Defaults to DRY-RUN mode (0 files deleted).
 * Pass '--apply' to execute live deletion.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  cleanProfileCaches,
  ALLOWED_CACHE_FOLDER_NAMES,
  PROTECTED_EXACT_NAMES,
  isProtectedName,
  getDirectoryMetrics,
  containsProtectedFiles,
} from '../07_BACKEND/services/profile-cache-cleaner.js';
import type { CleanCacheOptions, CleanCacheResult } from '../07_BACKEND/services/profile-cache-cleaner.js';

export {
  cleanProfileCaches,
  ALLOWED_CACHE_FOLDER_NAMES,
  PROTECTED_EXACT_NAMES,
  isProtectedName,
  getDirectoryMetrics,
  containsProtectedFiles,
};
export type { CleanCacheOptions, CleanCacheResult };

/**
 * CLI Entry Point
 */
export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const includeTestProfiles = args.includes('--include-test-profiles');
  const baseDir = path.join(process.cwd(), '.mahi_data');

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
  const result = await cleanProfileCaches({ baseDir, apply, includeTestProfiles });
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
  import.meta.url === pathToFileURL(process.argv[1]).href
);

if (isDirectCli) {
  runCli().catch((err) => {
    console.error('[clean-cache] Fatal error:', err);
    process.exit(1);
  });
}
