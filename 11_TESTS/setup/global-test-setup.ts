/**
 * MAHI Browser — Global Vitest Isolation Setup
 * 
 * Strictly isolates test runtime paths to a clean OS temporary directory.
 * Prevents any unit or integration test from polluting developer/host AppData.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const testIsolatedAppdata = path.join(os.tmpdir(), `mahi-test-isolated-appdata-${process.pid}`);
if (!fs.existsSync(testIsolatedAppdata)) {
  try {
    fs.mkdirSync(testIsolatedAppdata, { recursive: true });
  } catch {}
}

// Strictly isolate APPDATA so test runs never touch the host's real AppData directory.
// We avoid setting MAHI_USER_DATA_DIR globally because individual test suites
// (e.g. account-session-and-quota) isolate their own APPDATA per-suite and expect
// getWritableUserDataDir() to respect path.join(process.env.APPDATA, 'mahi-browser').
process.env.APPDATA = testIsolatedAppdata;
delete process.env.MAHI_USER_DATA_DIR;
process.env.NODE_ENV = 'test';
