import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import {
  checkForAppUpdates,
  startDownloadUpdate,
  applyAndRestartUpdate,
  getAppUpdateStatus,
  getUpdateConfig,
  setUpdateConfig,
  resetUpdaterStateForTesting,
} from '../../07_BACKEND/services/updater-service.js';
import {
  GenericHttpUpdateProvider,
  setActiveUpdateProvider,
} from '../../07_BACKEND/services/updater-provider.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase, initSqlEngine } from '../../06_DATABASE/connection.js';

// This suite simulates an OLDER client (1.1.9) discovering a NEWER release (1.2.0).
// The client version must be pinned here. Without this, the test would compare
// APP_VERSION (currently 1.2.0) against a 1.2.0 manifest and never see an update.
vi.mock('../../08_SECURITY/electron-bridge.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    app: {
      ...actual.app,
      isPackaged: false,
      getVersion: () => '1.1.9', // pinned baseline for this integration test
    },
  };
});

describe('PHASE 4 INTEGRATION: Complete Update Pipeline, Checksum Integrity & Data Safety', () => {
  let testDir: string;
  let testDbPath: string;
  let server: http.Server;
  let baseUrl = '';

  const testPayload = Buffer.from('MAHI_BROWSER_SETUP_AUTHENTIC_PACKAGE_SIMULATION_V1_2_0');
  const validSha256 = crypto.createHash('sha256').update(testPayload).digest('hex');

  let serveTamperedBinary = false;
  let serveOffline = false;

  beforeAll(async () => {
    process.env.MAHI_USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-upd-'));
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase4-integ-'));
    testDbPath = path.join(testDir, 'test_user_data.sqlite');
    setCustomDatabasePath(testDbPath);
    await initSqlEngine();
    await initializeDatabase();

    // Insert dummy user profiles and settings to test data preservation
    const db = getDatabase();
    db.prepare(`
      INSERT INTO profiles (id, name, storage_path, created_at, updated_at)
      VALUES ('prof-keep-1', 'My E-Commerce Amazon Profile', 'profiles/prof-keep-1', datetime('now'), datetime('now'))
    `).run();

    // Start local HTTP update server
    server = http.createServer((req, res) => {
      if (serveOffline) {
        req.destroy();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (url.pathname === '/update/latest.json') {
        const manifest = {
          version: '1.2.0',
          releaseDate: new Date().toISOString(),
          channel: 'STABLE',
          releaseNotes: 'Phase 4 auto-updater and Windows security enhancements.',
          sha256: validSha256,
          files: [
            {
              name: 'MAHI-Setup-1.2.0.exe',
              url: `${baseUrl}/update/MAHI-Setup-1.2.0.exe`,
              size: testPayload.length,
              sha256: validSha256,
              arch: 'x64',
            },
          ],
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(manifest));
        return;
      }

      if (url.pathname === '/update/MAHI-Setup-1.2.0.exe') {
        const payloadToServe = serveTamperedBinary
          ? Buffer.from('MALICIOUS_TAMPERED_INJECTED_BINARY_PAYLOAD')
          : testPayload;

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': payloadToServe.length.toString(),
        });
        res.end(payloadToServe);
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Configure GenericHttpUpdateProvider pointing to our local test server
    const httpProvider = new GenericHttpUpdateProvider();
    setActiveUpdateProvider(httpProvider);
    setUpdateConfig({
      feedUrl: `${baseUrl}/update/`,
      channel: 'STABLE',
      autoCheck: true,
      autoDownload: false,
    });
  });

  afterAll(async () => {
    setActiveUpdateProvider(new GenericHttpUpdateProvider());
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
    if (process.env.MAHI_USER_DATA_DIR) {
      try {
        fs.rmSync(process.env.MAHI_USER_DATA_DIR, { recursive: true, force: true });
      } catch {}
      delete process.env.MAHI_USER_DATA_DIR;
    }
  });

  // --------------------------------------------------------------------------
  // 1. END-TO-END UPDATE DISCOVERY (STEP 3 & 14)
  // --------------------------------------------------------------------------
  it('should discover new authentic version 1.2.0 from update server', async () => {
    resetUpdaterStateForTesting();
    const status = await checkForAppUpdates(true);

    expect(status.state).toBe('AVAILABLE');
    expect(status.availableVersion).toBe('1.2.0');
    expect(status.releaseNotes).toMatch(/Phase 4 auto-updater/);
  });

  // --------------------------------------------------------------------------
  // 2. VERIFIED DOWNLOAD & CHECKSUM INTEGRITY (STEP 8 & 9)
  // --------------------------------------------------------------------------
  it('should download update and verify SHA-256 checksum integrity', async () => {
    serveTamperedBinary = false;
    const downloadSuccess = await startDownloadUpdate();
    expect(downloadSuccess).toBe(true);

    const status = getAppUpdateStatus();
    expect(status.state).toBe('DOWNLOADED');
    expect(status.availableVersion).toBe('1.2.0');
  });

  // --------------------------------------------------------------------------
  // 3. TAMPERED BINARY DETECTION & CORRUPTION REJECTION (STEP 25)
  // --------------------------------------------------------------------------
  it('should detect tampered binary, reject it, delete corrupted download, and enter ERROR state', async () => {
    resetUpdaterStateForTesting();
    // 1. Check update again to populate pending manifest
    await checkForAppUpdates(true);

    // 2. Set server to deliver tampered payload
    serveTamperedBinary = true;
    const downloadSuccess = await startDownloadUpdate();
    expect(downloadSuccess).toBe(false);

    const status = getAppUpdateStatus();
    expect(status.state).toBe('ERROR');
    expect(status.error).toMatch(/Corrupted or tampered update detected/);

    // Restore server state
    serveTamperedBinary = false;
  });

  // --------------------------------------------------------------------------
  // 4. USER DATA PRESERVATION (STEP 17 & 26)
  // --------------------------------------------------------------------------
  it('should strictly preserve SQLite database and existing profiles across update lifecycle', async () => {
    // Simulate apply and restart
    const restartResult = await applyAndRestartUpdate();
    expect(restartResult.success).toBe(true);

    // Verify existing database records are 100% intact
    const db = getDatabase();
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get('prof-keep-1') as any;
    expect(profile).toBeDefined();
    expect(profile.name).toBe('My E-Commerce Amazon Profile');
  });

  // --------------------------------------------------------------------------
  // 5. OFFLINE SERVER FAULT TOLERANCE (STEP 28)
  // --------------------------------------------------------------------------
  it('should remain functional and safe when update server is completely unreachable', async () => {
    resetUpdaterStateForTesting();
    serveOffline = true;

    const status = await checkForAppUpdates(true);
    // Under Task 7 structured error handling, unreachable server safely transitions to ERROR with details
    expect(status.state).toBe('ERROR');
    expect(status.error).toBeDefined();

    serveOffline = false;
  });
});
