import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { MobileCompanionService } from '../../07_BACKEND/services/mobile-companion-service.js';
import { MobileSecureStorage } from '../../01_UI/mobile/storage/mobile-secure-storage.js';
import {
  browserWorkerManager,
  sessionGateway,
  workerProfileLoader,
} from '../../07_BACKEND/cloud-browser/index.js';

describe('Phase 11 — Mobile Cloud Companion E2E Suite', () => {
  const testUserId = `user_mob_${Date.now()}`;
  const testDeviceId = `android_pixel8_${Date.now()}`;
  const testProfileId = `prof_mob_e2e_${Date.now()}`;
  const testSessionId = `mob_cloud_sess_${Date.now()}`;
  const testRuntimeDir = path.resolve('.mahi_data', 'cloud-workers', testSessionId);

  beforeAll(async () => {
    await initSqlEngine();
    initializeDatabase();
    MobileCompanionService.resetForTest();
  });

  afterAll(async () => {
    await browserWorkerManager.terminateAll();
    workerProfileLoader.cleanWorkerDirectory(testRuntimeDir);
  });

  it('Step 1: Mobile authenticates and stores tokens in platform-backed secure storage', async () => {
    const storage = MobileSecureStorage.getInstance();
    await storage.clearTokens();

    const tokens = {
      accessToken: `jwt_header.payload_${testUserId}.sig`,
      refreshToken: `refresh_${testUserId}_keystore_secure`,
      userId: testUserId,
      email: 'mobile.operator@mahibrowser.com',
      storedAt: new Date().toISOString(),
    };

    await storage.saveTokens(tokens);

    const saved = await storage.getTokens();
    expect(saved).not.toBeNull();
    expect(saved?.userId).toBe(testUserId);
    expect(saved?.email).toBe('mobile.operator@mahibrowser.com');
  });

  it('Step 2: Registers mobile device push token with Android hardware metadata', async () => {
    const record = await MobileCompanionService.registerDeviceToken(testUserId, {
      deviceId: testDeviceId,
      pushToken: 'fcm_token_pixel_8_real_push_id',
      deviceModel: 'Google Pixel 8 Pro',
      osVersion: 'Android 14 (API 34)',
      appVersion: '11.0.0',
    });

    expect(record).toBeDefined();
    expect(record.userId).toBe(testUserId);
    expect(record.deviceId).toBe(testDeviceId);
    expect(record.platform).toBe('android');
    expect(record.status).toBe('ACTIVE');
  });

  it('Step 3: Launches real Phase 10 cloud browser worker from Android mobile client', async () => {
    const workerInstance = await browserWorkerManager.launchWorker({
      sessionId: testSessionId,
      userId: testUserId,
      profileId: testProfileId,
      runtimeDir: testRuntimeDir,
      settings: {
        browser: {
          userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',
          startupUrl: 'about:blank',
        },
        display: {
          screenWidth: 1280,
          screenHeight: 720,
        },
      },
      resourceClass: 'STANDARD',
    });

    expect(workerInstance).toBeDefined();
    expect(workerInstance.pid).toBeGreaterThan(0);
    expect(workerInstance.process.killed).toBe(false);

    // Attach session gateway for remote mobile client
    await sessionGateway.attachSession(testSessionId, workerInstance.cdpPort);
  }, 15000);

  it('Step 4: Dispatches mobile touch tap (click) and swipe gestures to remote worker', async () => {
    const workerInstance = browserWorkerManager.getWorker(testSessionId);
    expect(workerInstance).toBeDefined();

    // Map mobile tap at viewport (x: 480, y: 320) -> normalized remote click
    sessionGateway.dispatchAction(testSessionId, {
      type: 'mouseClick',
      x: 480,
      y: 320,
      button: 'left',
    });

    // Map mobile swipe up -> mouseWheel deltaY
    sessionGateway.dispatchAction(testSessionId, {
      type: 'mouseWheel',
      x: 480,
      y: 320,
      deltaX: 0,
      deltaY: 100,
    });

    // Dispatch soft keyboard typing
    sessionGateway.dispatchAction(testSessionId, {
      type: 'keyDown',
      key: 'M',
      text: 'M',
    });

    await new Promise((r) => setTimeout(r, 400));
    expect(workerInstance!.process.killed).toBe(false);
  });

  it('Step 5: Handles mobile network handover/reconnect without losing cloud session', async () => {
    // Simulate Wi-Fi -> Mobile network switch: client disconnects then reconnects with same sessionId
    const clientReceived: any[] = [];
    const unsubscribe1 = sessionGateway.subscribeClient({
      id: 'mobile-client-sub-1',
      userId: testUserId,
      sessionId: testSessionId,
      send: (msg) => clientReceived.push(msg),
      close: () => {},
    });

    // Client connection drops
    unsubscribe1();

    // Client reconnects within grace period
    const unsubscribe2 = sessionGateway.subscribeClient({
      id: 'mobile-client-sub-reconnect',
      userId: testUserId,
      sessionId: testSessionId,
      send: (msg) => clientReceived.push(msg),
      close: () => {},
    });

    expect(unsubscribe2).toBeDefined();
    const worker = browserWorkerManager.getWorker(testSessionId);
    expect(worker).toBeDefined();
    expect(worker!.process.killed).toBe(false);

    unsubscribe2();
  });

  it('Step 6: Mobile ends cloud session, triggering persistent profile sync-back', async () => {
    const workerInstance = browserWorkerManager.getWorker(testSessionId);
    expect(workerInstance).toBeDefined();

    // Detach gateway and stop worker gracefully
    sessionGateway.detachSession(testSessionId);
    await workerInstance!.stop();
    expect(workerInstance!.process.killed).toBe(true);

    // Package profile to cloud storage
    const syncResult = await workerProfileLoader.packageAndSyncProfile({
      sessionId: testSessionId,
      userId: testUserId,
      profileId: testProfileId,
      targetDir: testRuntimeDir,
      baseVersion: 1,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.newVersion).toBe(2);

    // Clean worker storage with asynchronous Windows lock release tolerance
    workerProfileLoader.cleanWorkerDirectory(testRuntimeDir);
    for (let i = 0; i < 10 && fs.existsSync(testRuntimeDir); i++) {
      await new Promise((r) => setTimeout(r, 200));
      workerProfileLoader.cleanWorkerDirectory(testRuntimeDir);
    }
    expect(fs.existsSync(testRuntimeDir)).toBe(false);
  });


  it('Step 7: Mobile session revocation revokes device push token', async () => {
    const revoked = await MobileCompanionService.revokeDeviceToken(testUserId, testDeviceId);
    expect(revoked).toBe(true);

    const activeTokens = await MobileCompanionService.getActiveDeviceTokens(testUserId);
    const matching = activeTokens.find((t) => t.deviceId === testDeviceId);
    expect(matching).toBeUndefined();
  });
});
