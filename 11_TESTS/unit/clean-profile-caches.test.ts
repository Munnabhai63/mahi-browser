import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  cleanProfileCaches,
  ALLOWED_CACHE_FOLDER_NAMES,
  isProtectedName,
} from '../../12_SCRIPTS/clean-profile-caches.js';

describe('12_SCRIPTS/clean-profile-caches — Safety & Allowlist Verification', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-clean-cache-test-'));

    // 1. Create a simulated profile directory with all 7 allowlisted Chromium cache directories
    const prof1 = path.join(tempBaseDir, 'profiles', 'test-uuid-profile-1');
    const prof1Default = path.join(prof1, 'Default');

    // Allowlisted cache folders
    fs.mkdirSync(path.join(prof1Default, 'Cache'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'Cache', 'data_0'), 'cached-http-bytes-1');
    fs.writeFileSync(path.join(prof1Default, 'Cache', 'index'), 'cached-index-data');

    fs.mkdirSync(path.join(prof1Default, 'Code Cache', 'js'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'Code Cache', 'js', 'compiled.code'), 'v8-compiled-bytecode');

    fs.mkdirSync(path.join(prof1Default, 'GPUCache'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'GPUCache', 'gpu_data.bin'), 'gpu-shader-cache-data');

    fs.mkdirSync(path.join(prof1, 'GrShaderCache'), { recursive: true });
    fs.writeFileSync(path.join(prof1, 'GrShaderCache', 'gr.bin'), 'gr-shader-blob');

    fs.mkdirSync(path.join(prof1, 'ShaderCache'), { recursive: true });
    fs.writeFileSync(path.join(prof1, 'ShaderCache', 'shader.bin'), 'shader-blob');

    fs.mkdirSync(path.join(prof1, 'Crashpad', 'reports'), { recursive: true });
    fs.writeFileSync(path.join(prof1, 'Crashpad', 'reports', 'crash.dmp'), 'crash-dump-payload');

    fs.mkdirSync(path.join(prof1Default, 'Cache_Data'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'Cache_Data', 'subdata.bin'), 'cache-data-blob');

    // 2. Create critical user state files (MUST NEVER BE DELETED)
    fs.writeFileSync(path.join(prof1, 'mahi.db'), 'CRITICAL-SQLITE-DATABASE-USER-STATE');
    fs.mkdirSync(path.join(prof1Default, 'Network'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'Network', 'Cookies'), 'CRITICAL-SESSION-COOKIES');
    fs.writeFileSync(path.join(prof1Default, 'Network', 'Cookies-journal'), 'CRITICAL-COOKIES-JOURNAL');

    fs.mkdirSync(path.join(prof1Default, 'Local Storage', 'leveldb'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'Local Storage', 'leveldb', '000001.log'), 'CRITICAL-LOCAL-STORAGE-DATA');

    fs.mkdirSync(path.join(prof1Default, 'IndexedDB', 'meta.sqlite'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'IndexedDB', 'meta.sqlite', 'indexeddb.data'), 'CRITICAL-INDEXED-DB-DATA');

    fs.mkdirSync(path.join(prof1Default, 'Session Storage'), { recursive: true });
    fs.writeFileSync(path.join(prof1Default, 'Session Storage', 'sess.log'), 'CRITICAL-SESSION-STORAGE-DATA');

    fs.writeFileSync(path.join(prof1Default, 'Preferences'), JSON.stringify({ browser: { window_placement: {} } }));
    fs.writeFileSync(path.join(prof1Default, 'Secure Preferences'), JSON.stringify({ extensions: {} }));

    // 3. Create engine directory (MUST NEVER BE TOUCHED)
    const engineDir = path.join(tempBaseDir, 'engines', '138.0.7204.0', 'chrome-win');
    fs.mkdirSync(engineDir, { recursive: true });
    fs.writeFileSync(path.join(engineDir, 'chrome.exe'), 'CRITICAL-CHROMIUM-BINARY');

    // 4. Create leftover test profile folder
    const testProf = path.join(tempBaseDir, 'test-auto-isolated', 'Default', 'Cache');
    fs.mkdirSync(testProf, { recursive: true });
    fs.writeFileSync(path.join(testProf, 'test_cache.bin'), 'temp-test-cache');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempBaseDir)) {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('1. verifies dry-run mode calculates exact metrics and deletes ZERO files or directories', async () => {
    const prof1 = path.join(tempBaseDir, 'profiles', 'test-uuid-profile-1');
    const prof1Default = path.join(prof1, 'Default');

    const result = await cleanProfileCaches({
      baseDir: tempBaseDir,
      apply: false, // Dry-run
      silent: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.deletedFolders).toBe(0);
    expect(result.cacheFoldersMatched).toBe(7); // All 7 allowlisted folders in prof1
    expect(result.filesMatched).toBe(8); // 8 total files in those 7 folders
    expect(result.bytesReclaimable).toBeGreaterThan(0);

    // Verify all 7 cache folders STILL EXIST completely intact
    expect(fs.existsSync(path.join(prof1Default, 'Cache'))).toBe(true);
    expect(fs.existsSync(path.join(prof1Default, 'Code Cache'))).toBe(true);
    expect(fs.existsSync(path.join(prof1Default, 'GPUCache'))).toBe(true);
    expect(fs.existsSync(path.join(prof1, 'GrShaderCache'))).toBe(true);
    expect(fs.existsSync(path.join(prof1, 'ShaderCache'))).toBe(true);
    expect(fs.existsSync(path.join(prof1, 'Crashpad'))).toBe(true);
    expect(fs.existsSync(path.join(prof1Default, 'Cache_Data'))).toBe(true);

    // Verify cache files are still there
    expect(fs.existsSync(path.join(prof1Default, 'Cache', 'data_0'))).toBe(true);
  });

  it('2. verifies --apply deletes ONLY the 7 allowlisted Chromium cache directories', async () => {
    const prof1 = path.join(tempBaseDir, 'profiles', 'test-uuid-profile-1');
    const prof1Default = path.join(prof1, 'Default');

    const result = await cleanProfileCaches({
      baseDir: tempBaseDir,
      apply: true, // Live apply
      silent: true,
    });

    expect(result.dryRun).toBe(false);
    expect(result.deletedFolders).toBe(7);
    expect(result.skippedLockedFolders).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify all 7 allowlisted folders were deleted
    expect(fs.existsSync(path.join(prof1Default, 'Cache'))).toBe(false);
    expect(fs.existsSync(path.join(prof1Default, 'Code Cache'))).toBe(false);
    expect(fs.existsSync(path.join(prof1Default, 'GPUCache'))).toBe(false);
    expect(fs.existsSync(path.join(prof1, 'GrShaderCache'))).toBe(false);
    expect(fs.existsSync(path.join(prof1, 'ShaderCache'))).toBe(false);
    expect(fs.existsSync(path.join(prof1, 'Crashpad'))).toBe(false);
    expect(fs.existsSync(path.join(prof1Default, 'Cache_Data'))).toBe(false);
  });

  it('3. verifies critical user state and engines remain 100% intact after --apply', async () => {
    const prof1 = path.join(tempBaseDir, 'profiles', 'test-uuid-profile-1');
    const prof1Default = path.join(prof1, 'Default');

    await cleanProfileCaches({
      baseDir: tempBaseDir,
      apply: true,
      silent: true,
    });

    // Check engines directory
    const chromeExe = path.join(tempBaseDir, 'engines', '138.0.7204.0', 'chrome-win', 'chrome.exe');
    expect(fs.existsSync(chromeExe)).toBe(true);
    expect(fs.readFileSync(chromeExe, 'utf8')).toBe('CRITICAL-CHROMIUM-BINARY');

    // Check SQLite database
    const dbPath = path.join(prof1, 'mahi.db');
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.readFileSync(dbPath, 'utf8')).toBe('CRITICAL-SQLITE-DATABASE-USER-STATE');

    // Check Cookies & network
    const cookiesPath = path.join(prof1Default, 'Network', 'Cookies');
    expect(fs.existsSync(cookiesPath)).toBe(true);
    expect(fs.readFileSync(cookiesPath, 'utf8')).toBe('CRITICAL-SESSION-COOKIES');

    // Check Local Storage
    const lsPath = path.join(prof1Default, 'Local Storage', 'leveldb', '000001.log');
    expect(fs.existsSync(lsPath)).toBe(true);

    // Check IndexedDB
    const idbPath = path.join(prof1Default, 'IndexedDB', 'meta.sqlite', 'indexeddb.data');
    expect(fs.existsSync(idbPath)).toBe(true);

    // Check Session Storage
    const sessPath = path.join(prof1Default, 'Session Storage', 'sess.log');
    expect(fs.existsSync(sessPath)).toBe(true);

    // Check Preferences
    expect(fs.existsSync(path.join(prof1Default, 'Preferences'))).toBe(true);
    expect(fs.existsSync(path.join(prof1Default, 'Secure Preferences'))).toBe(true);
  });

  it('4. verifies test profile pruning is opt-in via includeTestProfiles flag', async () => {
    const testCache = path.join(tempBaseDir, 'test-auto-isolated', 'Default', 'Cache');

    // Default run (includeTestProfiles: false) -> test profile cache NOT touched
    const dryResult = await cleanProfileCaches({
      baseDir: tempBaseDir,
      apply: true,
      includeTestProfiles: false,
      silent: true,
    });
    expect(dryResult.deletedFolders).toBe(7);
    expect(fs.existsSync(testCache)).toBe(true); // Still exists!

    // Opt-in run (includeTestProfiles: true) -> test profile cache cleaned
    const optInResult = await cleanProfileCaches({
      baseDir: tempBaseDir,
      apply: true,
      includeTestProfiles: true,
      silent: true,
    });
    expect(optInResult.deletedFolders).toBe(1);
    expect(fs.existsSync(testCache)).toBe(false); // Now deleted!
  });

  it('5. validates isProtectedName helper logic across critical browser files', () => {
    expect(isProtectedName('engines')).toBe(true);
    expect(isProtectedName('mahi.db')).toBe(true);
    expect(isProtectedName('app.sqlite')).toBe(true);
    expect(isProtectedName('app.sqlite-wal')).toBe(true);
    expect(isProtectedName('Cookies')).toBe(true);
    expect(isProtectedName('Cookies-journal')).toBe(true);
    expect(isProtectedName('Local Storage')).toBe(true);
    expect(isProtectedName('IndexedDB')).toBe(true);
    expect(isProtectedName('Preferences')).toBe(true);
    expect(isProtectedName('Secure Preferences')).toBe(true);

    // Allowlisted cache names are not protected
    for (const name of ALLOWED_CACHE_FOLDER_NAMES) {
      expect(isProtectedName(name)).toBe(false);
    }
  });
});
