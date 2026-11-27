import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase, initSqlEngine } from '../../06_DATABASE/connection.js';
import { registerCentralUser, loginCentralUser } from '../../05_AUTH/central-auth-service.js';
import { handleCommercialAPIRequest } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { LocalStorageProvider, setStorageProviderForTest } from '../../08_SECURITY/storage-provider.js';
import { encryptProfileArchive, decryptProfileArchive } from '../../08_SECURITY/cloud-profile-crypto.js';
import { createProfile, getProfileById, deleteProfile, getProfileStoragePath } from '../../02_BROWSER/services/profile-service.js';
import { collectEssentialStorageFiles, restoreStorageFiles, exportProfileToArchive, importProfileFromArchive } from '../../02_BROWSER/services/archive-service.js';
import { getCookies, importCookies } from '../../02_BROWSER/services/cookie-service.js';

describe('PHASE 2 INTEGRATION: Zero-Knowledge Cloud Storage, API & Multi-Device Sync', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase2-api-'));
  const testDbPath = path.join(testDir, 'phase2_api.sqlite');
  const storageDir = path.join(testDir, 'cloud_storage');
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    try { fs.mkdirSync(testDir, { recursive: true }); } catch {}
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initSqlEngine();
    await initializeDatabase();

    // Start test HTTP server
    server = http.createServer(async (req, res) => {
      try {
        const handled = await handleCommercialAPIRequest(req, res);
        if (!handled) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        }
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Configure storage provider to test directory
    const testStorage = new LocalStorageProvider({ storageDir, baseUrl });
    setStorageProviderForTest(testStorage);
  });

  afterAll(async () => {
    setStorageProviderForTest(null);
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  // Helper to make HTTP requests
  async function apiRequest(endpoint: string, options: { method: string; token?: string; body?: any; rawBody?: Buffer }): Promise<{ status: number; data: any; rawBody: Buffer }> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`);
      const headers: Record<string, string> = {};

      if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
      }

      let payload: Buffer | undefined = undefined;
      if (options.rawBody) {
        payload = options.rawBody;
        headers['Content-Type'] = 'application/octet-stream';
        headers['Content-Length'] = payload.length.toString();
      } else if (options.body) {
        payload = Buffer.from(JSON.stringify(options.body));
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = payload.length.toString();
      }

      const req = http.request(url, { method: options.method, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw.toString('utf8'));
          } catch {}
          resolve({ status: res.statusCode || 0, data: parsed, rawBody: raw });
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  // --------------------------------------------------------------------------
  // 1. Authentication & Security Isolation
  // --------------------------------------------------------------------------
  it('should reject unauthenticated requests to cloud sync endpoints with HTTP 401', async () => {
    const res = await apiRequest('/api/v1/sync/usage', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('should strictly isolate cloud profiles between different users (cross-user security test)', async () => {
    // 1. Create User A and User B
    const userA = await registerCentralUser({
      email: 'user_a@sync-test.com',
      password: 'Password123!',
      name: 'User A',
      ipAddress: '127.0.0.1',
    });
    const tokenA = userA.tokens!.accessToken;

    const userB = await registerCentralUser({
      email: 'user_b@sync-test.com',
      password: 'Password123!',
      name: 'User B',
      ipAddress: '127.0.0.1',
    });
    const tokenB = userB.tokens!.accessToken;

    // 2. User A creates an upload session
    const dummyCipher = Buffer.from('Encrypted archive User A');
    const checksumA = crypto.createHash('sha256').update(dummyCipher).digest('hex');

    const sessionResA = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token: tokenA,
      body: {
        localProfileId: 'local_prof_a_001',
        profileName: 'Profile A',
        baseVersion: 0,
        expectedSize: dummyCipher.length,
        expectedChecksum: checksumA,
        encryptedDataKey: '{"w":"keyA"}',
        iv: '0123456789abcdef01234567',
        authTag: '0123456789abcdef0123456789abcdef',
        deviceId: 'device_a',
        deviceName: 'Device A',
      }
    });

    expect(sessionResA.status).toBe(200);
    const sessionDataA = sessionResA.data;

    // Upload blob to storage
    await apiRequest(sessionDataA.uploadUrl, { method: 'PUT', rawBody: dummyCipher });

    // Finalize session for User A
    const finalizeResA = await apiRequest('/api/v1/sync/finalize-upload', {
      method: 'POST',
      token: tokenA,
      body: {
        sessionId: sessionDataA.sessionId,
        profileName: 'Profile A',
        localProfileId: 'local_prof_a_001',
        deviceId: 'device_a',
      }
    });
    if (finalizeResA.status !== 200) {
      console.log('finalizeResA failed with:', finalizeResA.data);
    }
    expect(finalizeResA.status).toBe(200);
    const cloudProfileIdA = finalizeResA.data.cloudProfileId;

    // 3. User B attempts to access User A's cloud profile metadata -> 404
    const userBGet = await apiRequest(`/api/v1/sync/profile/${cloudProfileIdA}`, {
      method: 'GET',
      token: tokenB,
    });
    expect(userBGet.status).toBe(404);

    // 4. User B attempts to request download session for User A's profile -> 404
    const userBDl = await apiRequest('/api/v1/sync/download-session', {
      method: 'POST',
      token: tokenB,
      body: { cloudProfileId: cloudProfileIdA }
    });
    expect(userBDl.status).toBe(404);

    // 5. User B attempts to delete User A's profile -> 404
    const userBDel = await apiRequest(`/api/v1/sync/profile/${cloudProfileIdA}`, {
      method: 'DELETE',
      token: tokenB,
    });
    expect(userBDel.status).toBe(404);

    // 6. User B lists profiles -> empty, does not see User A's profile
    const userBList = await apiRequest('/api/v1/sync/list', {
      method: 'GET',
      token: tokenB,
    });
    expect(userBList.status).toBe(200);
    expect(userBList.data.profiles.some((p: any) => p.id === cloudProfileIdA)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 2. Full Upload, Finalize & Download Workflow
  // --------------------------------------------------------------------------
  it('should complete upload session, storage upload, finalize verification, and download session', async () => {
    const user = await registerCentralUser({
      email: 'workflow_test@sync-test.com',
      password: 'Password123!',
      name: 'Workflow Tester',
      ipAddress: '127.0.0.1',
    });
    const token = user.tokens!.accessToken;
    const passphrase = 'UserPassphrase789!';

    // Prepare simulated archive
    const rawArchive = Buffer.from(JSON.stringify({
      version: '1.0',
      profile: { name: 'E2E Test Profile', cookies: ['c1', 'c2'] }
    }));

    const pkg = encryptProfileArchive(rawArchive, passphrase);

    // Step 1: Create Upload Session
    const sessionRes = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token,
      body: {
        localProfileId: 'local_prof_flow_1',
        profileName: 'E2E Test Profile',
        baseVersion: 0,
        expectedSize: pkg.ciphertext.length,
        expectedChecksum: pkg.checksumSha256,
        encryptedDataKey: pkg.encryptedDataKey,
        iv: pkg.iv,
        authTag: pkg.authTag,
        deviceId: 'device_laptop_1',
        deviceName: 'Work Laptop',
      }
    });

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.data.targetVersion).toBe(1);
    const sessionInfo = sessionRes.data;

    // Step 2: Upload Encrypted Blob to Storage
    const uploadPutRes = await apiRequest(sessionInfo.uploadUrl, {
      method: 'PUT',
      rawBody: pkg.ciphertext,
    });
    expect(uploadPutRes.status).toBe(200);

    // Step 3: Finalize Upload
    const finalizeRes = await apiRequest('/api/v1/sync/finalize-upload', {
      method: 'POST',
      token,
      body: {
        sessionId: sessionInfo.sessionId,
        profileName: 'E2E Test Profile',
        localProfileId: 'local_prof_flow_1',
        deviceId: 'device_laptop_1',
      }
    });

    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.data.success).toBe(true);
    expect(finalizeRes.data.version).toBe(1);

    const cloudProfileId = finalizeRes.data.cloudProfileId;

    // Step 4: Request Download Session
    const dlSessionRes = await apiRequest('/api/v1/sync/download-session', {
      method: 'POST',
      token,
      body: { cloudProfileId }
    });

    expect(dlSessionRes.status).toBe(200);
    const dlInfo = dlSessionRes.data.data;
    expect(dlInfo.version).toBe(1);
    expect(dlInfo.checksumSha256).toBe(pkg.checksumSha256);

    // Step 5: Download Encrypted Blob from Storage
    const downloadedBlob = await apiRequest(dlInfo.downloadUrl, { method: 'GET' });
    expect(downloadedBlob.status).toBe(200);
    expect(downloadedBlob.rawBody.length).toBe(pkg.ciphertext.length);

    // Step 6: Decrypt Locally
    const decrypted = decryptProfileArchive({
      ciphertext: downloadedBlob.rawBody,
      expectedChecksum: dlInfo.checksumSha256,
      encryptedDataKey: dlInfo.encryptedDataKey,
      iv: dlInfo.iv,
      authTag: dlInfo.authTag,
      userMasterKey: passphrase,
    });

    expect(decrypted.toString('utf8')).toBe(rawArchive.toString('utf8'));
  });

  // --------------------------------------------------------------------------
  // 3. Optimistic Concurrency & Conflict Protection (Multi-Device Simulation)
  // --------------------------------------------------------------------------
  it('should detect stale version uploads and return HTTP 409 Conflict without silent overwrite', async () => {
    const user = await registerCentralUser({
      email: 'conflict_user@sync-test.com',
      password: 'Password123!',
      name: 'Conflict User',
      ipAddress: '127.0.0.1',
    });
    const token = user.tokens!.accessToken;

    const dummyCipherV1 = Buffer.from('V1 Ciphertext');
    const checksumV1 = crypto.createHash('sha256').update(dummyCipherV1).digest('hex');

    // 1. Device A uploads Version 1 (baseVersion 0)
    const sessionV1 = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token,
      body: {
        localProfileId: 'shared_profile_uuid',
        profileName: 'Shared Profile',
        baseVersion: 0,
        expectedSize: dummyCipherV1.length,
        expectedChecksum: checksumV1,
        encryptedDataKey: '{"w":"k1"}',
        iv: '0123456789abcdef01234567',
        authTag: '0123456789abcdef0123456789abcdef',
        deviceId: 'device_pc_a',
      }
    });
    expect(sessionV1.status).toBe(200);

    await apiRequest(sessionV1.data.uploadUrl, { method: 'PUT', rawBody: dummyCipherV1 });
    await apiRequest('/api/v1/sync/finalize-upload', {
      method: 'POST',
      token,
      body: {
        sessionId: sessionV1.data.sessionId,
        profileName: 'Shared Profile',
        localProfileId: 'shared_profile_uuid',
        deviceId: 'device_pc_a',
      }
    });

    // 2. Device A modifies profile and uploads Version 2 (baseVersion 1)
    const dummyCipherV2 = Buffer.from('V2 Ciphertext from Device A');
    const checksumV2 = crypto.createHash('sha256').update(dummyCipherV2).digest('hex');

    const sessionV2 = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token,
      body: {
        localProfileId: 'shared_profile_uuid',
        profileName: 'Shared Profile',
        baseVersion: 1,
        expectedSize: dummyCipherV2.length,
        expectedChecksum: checksumV2,
        encryptedDataKey: '{"w":"k2"}',
        iv: '0123456789abcdef01234567',
        authTag: '0123456789abcdef0123456789abcdef',
        deviceId: 'device_pc_a',
      }
    });
    expect(sessionV2.status).toBe(200);
    expect(sessionV2.data.targetVersion).toBe(2);

    await apiRequest(sessionV2.data.uploadUrl, { method: 'PUT', rawBody: dummyCipherV2 });
    await apiRequest('/api/v1/sync/finalize-upload', {
      method: 'POST',
      token,
      body: {
        sessionId: sessionV2.data.sessionId,
        profileName: 'Shared Profile',
        localProfileId: 'shared_profile_uuid',
        deviceId: 'device_pc_a',
      }
    });

    // 3. Device B attempts to upload changes based on stale Version 1 (baseVersion = 1)
    const dummyCipherStale = Buffer.from('Stale upload from Device B');
    const checksumStale = crypto.createHash('sha256').update(dummyCipherStale).digest('hex');

    const sessionStale = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token,
      body: {
        localProfileId: 'shared_profile_uuid',
        profileName: 'Shared Profile',
        baseVersion: 1, // Stale! Current version is now 2
        expectedSize: dummyCipherStale.length,
        expectedChecksum: checksumStale,
        encryptedDataKey: '{"w":"kstale"}',
        iv: '0123456789abcdef01234567',
        authTag: '0123456789abcdef0123456789abcdef',
        deviceId: 'device_pc_b',
      }
    });

    // EXPECTED: HTTP 409 CONFLICT! (No silent last-write-wins overwrite)
    expect(sessionStale.status).toBe(409);
    expect(sessionStale.data.conflict).toBe(true);
    expect(sessionStale.data.currentVersion).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 4. Real End-to-End Profile Session Preservation Test
  // --------------------------------------------------------------------------
  it('should package real profile with cookies and settings, upload encrypted, and restore with identical sessions', async () => {
    const user = await registerCentralUser({
      email: 'e2e_profile_user@sync-test.com',
      password: 'Password123!',
      name: 'E2E User',
      ipAddress: '127.0.0.1',
    });
    const token = user.tokens!.accessToken;
    const passphrase = 'ZeroKnowledgeE2EPassphrase!';

    // 1. Create a local profile on PC A
    const originalProfile = createProfile({
      name: 'PC-A Authenticated Profile',
      folder: 'Finance',
      notes: 'Contains bank authentication cookie',
    });

    const storagePathA = getProfileStoragePath(originalProfile.id);
    const networkDir = path.join(storagePathA, 'Default', 'Network');
    fs.mkdirSync(networkDir, { recursive: true });

    // Inject mock session cookie in profile directory
    fs.writeFileSync(
      path.join(networkDir, 'Cookies'),
      'SQLITE_FORMAT_MOCK_COOKIE_SESSION_AUTH_TOKEN_ABC123',
      'utf8'
    );

    // 2. Package profile to archive
    const tempExportPath = path.join(testDir, 'export_test.mahi-profile');
    exportProfileToArchive({
      profileId: originalProfile.id,
      targetFilePath: tempExportPath,
      includeCookies: true,
      includeHistory: true,
      includeExtensions: true,
      includeBrowserSettings: true,
      includeStorage: true,
      password: passphrase,
    });

    const archiveBuffer = fs.readFileSync(tempExportPath);

    // 3. Encrypt archive with envelope encryption
    const encryptedPkg = encryptProfileArchive(archiveBuffer, passphrase);

    // 4. Request upload session
    const sessionRes = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token,
      body: {
        localProfileId: originalProfile.id,
        profileName: originalProfile.name,
        baseVersion: 0,
        expectedSize: encryptedPkg.ciphertext.length,
        expectedChecksum: encryptedPkg.checksumSha256,
        encryptedDataKey: encryptedPkg.encryptedDataKey,
        iv: encryptedPkg.iv,
        authTag: encryptedPkg.authTag,
        deviceId: 'pc_a_hwid',
      }
    });

    expect(sessionRes.status).toBe(200);

    // Upload blob and finalize
    await apiRequest(sessionRes.data.uploadUrl, { method: 'PUT', rawBody: encryptedPkg.ciphertext });
    const finalRes = await apiRequest('/api/v1/sync/finalize-upload', {
      method: 'POST',
      token,
      body: {
        sessionId: sessionRes.data.sessionId,
        profileName: originalProfile.name,
        localProfileId: originalProfile.id,
        deviceId: 'pc_a_hwid',
      }
    });
    expect(finalRes.status).toBe(200);
    const cloudProfileId = finalRes.data.cloudProfileId;

    // 5. Simulate PC B: Request download
    const dlRes = await apiRequest('/api/v1/sync/download-session', {
      method: 'POST',
      token,
      body: { cloudProfileId }
    });
    expect(dlRes.status).toBe(200);
    const dlData = dlRes.data.data;

    // Download encrypted blob
    const downloadedBlob = await apiRequest(dlData.downloadUrl, { method: 'GET' });
    expect(downloadedBlob.status).toBe(200);

    // Decrypt on PC B
    const decryptedArchiveBuffer = decryptProfileArchive({
      ciphertext: downloadedBlob.rawBody,
      expectedChecksum: dlData.checksumSha256,
      encryptedDataKey: dlData.encryptedDataKey,
      iv: dlData.iv,
      authTag: dlData.authTag,
      userMasterKey: passphrase,
    });

    const tempRestorePath = path.join(testDir, 'restore_test.mahi-profile');
    fs.writeFileSync(tempRestorePath, decryptedArchiveBuffer);

    // 6. Restore profile on PC B
    const restoredProfile = importProfileFromArchive({
      sourceFilePath: tempRestorePath,
      password: passphrase,
      overrideName: 'PC-B Restored Profile',
    });

    expect(restoredProfile.name).toBe('PC-B Restored Profile');

    // 7. Verify Cookies/Session survived restore
    const storagePathB = getProfileStoragePath(restoredProfile.id);
    const restoredCookieFile = path.join(storagePathB, 'Default', 'Network', 'Cookies');
    expect(fs.existsSync(restoredCookieFile)).toBe(true);
    const restoredCookieContent = fs.readFileSync(restoredCookieFile, 'utf8');
    expect(restoredCookieContent).toBe('SQLITE_FORMAT_MOCK_COOKIE_SESSION_AUTH_TOKEN_ABC123');

    // Clean up
    deleteProfile(originalProfile.id);
    deleteProfile(restoredProfile.id);
    try { fs.unlinkSync(tempExportPath); } catch {}
    try { fs.unlinkSync(tempRestorePath); } catch {}
  });

  // --------------------------------------------------------------------------
  // 5. Distributed Profile Locking API Integration
  // --------------------------------------------------------------------------
  it('should handle lock acquire, conflict (423), renewal, and release via REST API', async () => {
    const user = await registerCentralUser({
      email: 'lock_api_user@sync-test.com',
      password: 'Password123!',
      name: 'Lock API User',
      ipAddress: '127.0.0.1',
    });
    const token = user.tokens!.accessToken;
    const cloudProfileId = 'lock_test_profile_uuid_777';

    // 1. Device 1 acquires lock
    const acquire1 = await apiRequest('/api/v1/sync/lock/acquire', {
      method: 'POST',
      token,
      body: {
        cloudProfileId,
        deviceId: 'dev_laptop_1',
        deviceName: 'Laptop 1',
        ttlSeconds: 60,
      }
    });
    expect(acquire1.status).toBe(200);
    expect(acquire1.data.acquired).toBe(true);

    // 2. Device 2 attempts to acquire lock while held -> 423 Locked
    const acquire2 = await apiRequest('/api/v1/sync/lock/acquire', {
      method: 'POST',
      token,
      body: {
        cloudProfileId,
        deviceId: 'dev_pc_2',
        deviceName: 'Desktop PC 2',
        ttlSeconds: 60,
      }
    });
    expect(acquire2.status).toBe(423);
    expect(acquire2.data.acquired).toBe(false);
    expect(acquire2.data.heldBy).toBe('Laptop 1');

    // 3. Check lock status
    const statusRes = await apiRequest(`/api/v1/sync/lock/status?cloudProfileId=${cloudProfileId}`, {
      method: 'GET',
      token,
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.data.data.isLocked).toBe(true);
    expect(statusRes.data.data.deviceId).toBe('dev_laptop_1');

    // 4. Renew lock
    const renewRes = await apiRequest('/api/v1/sync/lock/renew', {
      method: 'POST',
      token,
      body: {
        cloudProfileId,
        deviceId: 'dev_laptop_1',
        ttlSeconds: 120,
      }
    });
    expect(renewRes.status).toBe(200);
    expect(renewRes.data.renewed).toBe(true);

    // 5. Release lock
    const releaseRes = await apiRequest('/api/v1/sync/lock/release', {
      method: 'POST',
      token,
      body: {
        cloudProfileId,
        deviceId: 'dev_laptop_1',
      }
    });
    expect(releaseRes.status).toBe(200);
    expect(releaseRes.data.released).toBe(true);

    // 6. Device 2 can now acquire lock
    const acquire2After = await apiRequest('/api/v1/sync/lock/acquire', {
      method: 'POST',
      token,
      body: {
        cloudProfileId,
        deviceId: 'dev_pc_2',
        deviceName: 'Desktop PC 2',
        ttlSeconds: 60,
      }
    });
    expect(acquire2After.status).toBe(200);
    expect(acquire2After.data.acquired).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. Storage Token Integrity & Presigned URL Tampering
  // --------------------------------------------------------------------------
  it('should reject forged or expired storage presigned tokens with HTTP 403', async () => {
    // Forged token
    const forgedUpload = await apiRequest(
      '/api/v1/storage/upload?key=secret/file.enc&expires=9999999999999&token=forged_invalid_signature',
      { method: 'PUT', rawBody: Buffer.from('Hacked Data') }
    );
    expect(forgedUpload.status).toBe(403);

    // Expired token
    const pastExpires = Date.now() - 10000;
    const expiredUpload = await apiRequest(
      `/api/v1/storage/upload?key=secret/file.enc&expires=${pastExpires}&token=any_token`,
      { method: 'PUT', rawBody: Buffer.from('Hacked Data') }
    );
    expect(expiredUpload.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // 7. Quota Enforcement & Oversized Archive Rejection
  // --------------------------------------------------------------------------
  it('should reject uploads exceeding 200MB archive limit with HTTP 400', async () => {
    const user = await registerCentralUser({
      email: 'quota_tester@sync-test.com',
      password: 'Password123!',
      name: 'Quota Tester',
      ipAddress: '127.0.0.1',
    });
    const token = user.tokens!.accessToken;

    const oversizedBytes = 250 * 1024 * 1024; // 250MB > 200MB limit

    const sessionRes = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token,
      body: {
        localProfileId: 'oversized_profile',
        profileName: 'Massive Profile',
        baseVersion: 0,
        expectedSize: oversizedBytes,
        expectedChecksum: 'fake_checksum',
        encryptedDataKey: '{}',
        iv: '0123456789abcdef01234567',
        authTag: '0123456789abcdef0123456789abcdef',
        deviceId: 'dev_1',
      }
    });

    expect(sessionRes.status).toBe(400);
    expect(sessionRes.data.error).toContain('exceeds maximum 200MB limit');
  });

  // --------------------------------------------------------------------------
  // 8. Delete Cloud Profile & Clean Storage
  // --------------------------------------------------------------------------
  it('should delete cloud profile and remove associated storage objects', async () => {
    const user = await registerCentralUser({
      email: 'delete_tester@sync-test.com',
      password: 'Password123!',
      name: 'Delete Tester',
      ipAddress: '127.0.0.1',
    });
    const token = user.tokens!.accessToken;

    // Create and finalize a profile
    const cipher = Buffer.from('File to delete');
    const checksum = crypto.createHash('sha256').update(cipher).digest('hex');

    const sRes = await apiRequest('/api/v1/sync/upload-session', {
      method: 'POST',
      token,
      body: {
        localProfileId: 'prof_to_delete',
        profileName: 'Profile To Delete',
        baseVersion: 0,
        expectedSize: cipher.length,
        expectedChecksum: checksum,
        encryptedDataKey: '{}',
        iv: '0123456789abcdef01234567',
        authTag: '0123456789abcdef0123456789abcdef',
        deviceId: 'dev_del',
      }
    });
    expect(sRes.status).toBe(200);

    await apiRequest(sRes.data.uploadUrl, { method: 'PUT', rawBody: cipher });
    const fRes = await apiRequest('/api/v1/sync/finalize-upload', {
      method: 'POST',
      token,
      body: {
        sessionId: sRes.data.sessionId,
        profileName: 'Profile To Delete',
        localProfileId: 'prof_to_delete',
        deviceId: 'dev_del',
      }
    });
    expect(fRes.status).toBe(200);
    const cloudProfileId = fRes.data.cloudProfileId;

    // Verify it exists in list
    const listBefore = await apiRequest('/api/v1/sync/list', { method: 'GET', token });
    expect(listBefore.data.profiles.some((p: any) => p.id === cloudProfileId)).toBe(true);

    // Delete cloud profile
    const delRes = await apiRequest(`/api/v1/sync/profile/${cloudProfileId}`, {
      method: 'DELETE',
      token,
    });
    expect(delRes.status).toBe(200);
    expect(delRes.data.success).toBe(true);

    // Verify removed from list
    const listAfter = await apiRequest('/api/v1/sync/list', { method: 'GET', token });
    expect(listAfter.data.profiles.some((p: any) => p.id === cloudProfileId)).toBe(false);

    // Storage object should also be removed
    const dlAfter = await apiRequest('/api/v1/sync/download-session', {
      method: 'POST',
      token,
      body: { cloudProfileId }
    });
    expect(dlAfter.status).toBe(404);
  });
});
