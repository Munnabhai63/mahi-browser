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
const testIsolatedXdgConfig = path.join(testIsolatedAppdata, '.config');
for (const dir of [testIsolatedAppdata, testIsolatedXdgConfig]) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
}

// Strictly isolate APPDATA and XDG_CONFIG_HOME so test runs never touch real user directories on Windows or Linux.
// We avoid setting MAHI_USER_DATA_DIR globally because individual test suites
// (e.g. account-session-and-quota) isolate their own APPDATA per-suite and expect
// getWritableUserDataDir() to respect path.join(process.env.APPDATA, 'mahi-browser').
process.env.APPDATA = testIsolatedAppdata;
process.env.XDG_CONFIG_HOME = testIsolatedXdgConfig;
delete process.env.MAHI_USER_DATA_DIR;
process.env.NODE_ENV = 'test';
