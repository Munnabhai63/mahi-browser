/**
 * MAHI Browser — Global Vitest Isolation Setup
 * 
 * Strictly isolates test runtime paths to a clean OS temporary directory.
 * Prevents any unit or integration test from polluting developer/host AppData.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const testIsolatedDir = path.join(os.tmpdir(), `mahi-test-isolated-run-${process.pid}`);
if (!fs.existsSync(testIsolatedDir)) {
  try {
    fs.mkdirSync(testIsolatedDir, { recursive: true });
  } catch {}
}

process.env.MAHI_USER_DATA_DIR = testIsolatedDir;
process.env.NODE_ENV = 'test';
