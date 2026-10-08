import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { initSqlEngine, setCustomDatabasePath, closeDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getFolders, createFolder, updateFolder, deleteFolder } from '../../02_BROWSER/services/folder-service.js';
import { getProfileLock, acquireProfileLock, releaseProfileLock } from '../../02_BROWSER/services/profile-lock-service.js';
import { getFeatureFlags, isFeatureEnabled, updateFeatureFlag } from '../../07_BACKEND/services/feature-flag-service.js';
import { getFleetDevices, getLiveTelemetry, revokeDevice } from '../../07_BACKEND/services/fleet-service.js';
import { generateApiKey, validateApiKey, revokeApiKey, getApiKeys } from '../../07_BACKEND/services/api-v2-service.js';
import { createCentralApiServer } from '../../07_BACKEND/server/app.js';
import { createProfile, deleteProfile } from '../../02_BROWSER/services/profile-service.js';

describe('MAHI Platform V2 — Enterprise Platform Verification Suite', () => {
  let server: http.Server;
  const PORT = 34567;
  let testProfileId = '';
  const testDbDir = path.resolve('.mahi_data', 'test-v2-enterprise-isolated');
  const testDbPath = path.join(testDbDir, 'v2_enterprise_test.sqlite');

  beforeAll(async () => {
    if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    setCustomDatabasePath(testDbPath);
    await initSqlEngine();
    await initializeDatabase();

    // Start Central API server on test port
    server = createCentralApiServer();
    await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', () => resolve()));
  });

  afterAll(async () => {
    if (testProfileId) {
      try { deleteProfile(testProfileId); } catch {}
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
    try {
      if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  });

  // TEST 1: Folders Management
  it('TEST 1: Folder Management (Nested Hierarchy, Profile Counts & Migration)', () => {
    const parent = createFolder('E-Commerce Work', null, '#10b981', 'ShoppingBag');
    expect(parent).toBeDefined();
    expect(parent.name).toBe('E-Commerce Work');

    const child = createFolder('Amazon Stores', parent.id, '#f59e0b', 'Tag');
    expect(child).toBeDefined();
    expect(child.parentId).toBe(parent.id);

    const allFolders = getFolders();
    expect(allFolders.some((f) => f.id === parent.id)).toBe(true);
    expect(allFolders.some((f) => f.id === child.id)).toBe(true);

    const updated = updateFolder(parent.id, { color: '#06b6d4' });
    expect(updated?.color).toBe('#06b6d4');

    const deleted = deleteFolder(parent.id, 'General');
    expect(deleted).toBe(true);
  });

  // TEST 2: Profile Locking & Team Collision Prevention
  it('TEST 2: Profile Locking & Team Collision Prevention Engine', () => {
    const dummyProf = createProfile({ name: 'Team Locked Profile 1', engine: 'chrome' });
    testProfileId = dummyProf.id;

    // User 1 acquires lock
    const res1 = acquireProfileLock(dummyProf.id, 'usr_1', 'Alice Operator', 'device_alpha');
    expect(res1.success).toBe(true);
    expect(res1.lock?.lockedByUserName).toBe('Alice Operator');

    // User 2 tries to acquire lock on same profile -> should fail
    const res2 = acquireProfileLock(dummyProf.id, 'usr_2', 'Bob Operator', 'device_beta');
    expect(res2.success).toBe(false);
    expect(res2.currentLock?.lockedByUserId).toBe('usr_1');

    // Check lock query
    const lock = getProfileLock(dummyProf.id);
    expect(lock).toBeDefined();
    expect(lock?.lockedByDeviceId).toBe('device_alpha');

    // Release lock
    const released = releaseProfileLock(dummyProf.id);
    expect(released).toBe(true);
    expect(getProfileLock(dummyProf.id)).toBeNull();
  });

  // TEST 3: Feature Flags & Central Kill Switches
  it('TEST 3: Dynamic Feature Flags & Emergency Kill Switches', () => {
    const flags = getFeatureFlags();
    expect(flags.length).toBeGreaterThanOrEqual(5);

    // CDP Sync should be enabled for free tier
    expect(isFeatureEnabled('cdp_synchronizer', 'free')).toBe(true);

    // Developer API requires Pro tier
    expect(isFeatureEnabled('developer_api', 'free')).toBe(false);
    expect(isFeatureEnabled('developer_api', 'pro')).toBe(true);

    // Emergency kill switch activation
    updateFeatureFlag('cdp_synchronizer', { killSwitchActive: true });
    expect(isFeatureEnabled('cdp_synchronizer', 'enterprise')).toBe(false);

    // Reset kill switch
    updateFeatureFlag('cdp_synchronizer', { killSwitchActive: false });
    expect(isFeatureEnabled('cdp_synchronizer', 'free')).toBe(true);
  });

  // TEST 4: Live Fleet Telemetry & Device Management
  it('TEST 4: Live Fleet Telemetry & Hardware Resource Monitoring', () => {
    const telemetry = getLiveTelemetry();
    expect(telemetry).toBeDefined();
    expect(telemetry.deviceId).toBeDefined();
    expect(typeof telemetry.cpuUsagePercent).toBe('number');
    expect(telemetry.memoryUsageMb).toBeGreaterThan(0);
    expect(telemetry.status).toMatch(/IDLE|RUNNING_TASKS/);

    const devices = getFleetDevices();
    expect(devices.length).toBeGreaterThanOrEqual(1);

    const localDev = devices[0];
    expect(localDev.status).toBe('ONLINE');

    const ok = revokeDevice('dummy_remote_device_id');
    expect(ok).toBe(true);
  });

  // TEST 5: Developer API Key Authentication & Scopes
  it('TEST 5: Developer API Key Generation, Hashing & Scopes', () => {
    const { keyRecord, secretKey } = generateApiKey('Automation Runner Bot', 'owner', ['profiles:read', 'profiles:launch']);
    expect(keyRecord.name).toBe('Automation Runner Bot');
    expect(secretKey.startsWith('mahi_live_')).toBe(true);

    // Validate valid token
    const valid = validateApiKey(secretKey);
    expect(valid).toBeDefined();
    expect(valid?.name).toBe('Automation Runner Bot');
    expect(valid?.requestsCountMonth).toBe(1);

    // Validate invalid token
    expect(validateApiKey('invalid_secret_key_123')).toBeNull();

    // Revoke token
    const revoked = revokeApiKey(keyRecord.id);
    expect(revoked).toBe(true);
    expect(validateApiKey(secretKey)).toBeNull();
  });

  // TEST 6: REST API V2 Endpoints
  it('TEST 6: Central REST API V2 Endpoints (/health, /feature-flags, /folders, /fleet/telemetry)', async () => {
    const fetchJson = async (path: string) => {
      const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
      return { status: res.status, data: await res.json() };
    };

    // Health
    const health = await fetchJson('/api/v2/health');
    expect(health.status).toBe(200);
    expect(health.data.status).toBe('HEALTHY');
    expect(health.data.version).toBe('2.0.0');

    // Feature flags
    const flags = await fetchJson('/api/v2/feature-flags');
    expect(flags.status).toBe(200);
    expect(Array.isArray(flags.data.data)).toBe(true);

    // Folders
    const folders = await fetchJson('/api/v2/folders');
    expect(folders.status).toBe(200);
    expect(Array.isArray(folders.data.data)).toBe(true);

    // Fleet Telemetry
    const telemetry = await fetchJson('/api/v2/fleet/telemetry');
    expect(telemetry.status).toBe(200);
    expect(telemetry.data.data.deviceId).toBeDefined();
  });
});
