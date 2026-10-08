import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('PHASE 3 INTEGRATION: Multi-User Workspaces, RBAC, Sharing & Lock Contention API', () => {
  const testDir = path.join(process.cwd(), '.test_phase3_api');
  const testDbPath = path.join(testDir, 'phase3_api.sqlite');
  const storageDir = path.join(testDir, 'cloud_storage');
  let server: http.Server;
  let baseUrl = '';

  let tokenOwnerA: string;
  let userOwnerA: { id: string; email: string };

  let tokenMemberA: string;
  let userMemberA: { id: string; email: string };

  let tokenViewerA: string;
  let userViewerA: { id: string; email: string };

  let tokenOwnerB: string;
  let userOwnerB: { id: string; email: string };

  let workspaceAId: string;
  let workspaceBId: string;

  beforeAll(async () => {
    try { fs.mkdirSync(testDir, { recursive: true }); } catch {}
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initSqlEngine();
    await initializeDatabase();

    // Start HTTP server for commercial API router
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

    const testStorage = new LocalStorageProvider({ storageDir, baseUrl });
    setStorageProviderForTest(testStorage);

    // Register test accounts
    const regOwnerA = await registerCentralUser({ email: 'owner_a@agency.com', password: 'Password123!', name: 'Owner A' });
    const logOwnerA = await loginCentralUser({ email: 'owner_a@agency.com', password: 'Password123!', deviceId: 'dev-owner-a' });
    tokenOwnerA = logOwnerA.tokens!.accessToken;
    userOwnerA = { id: regOwnerA.user!.id, email: regOwnerA.user!.email };

    const regMemberA = await registerCentralUser({ email: 'member_a@agency.com', password: 'Password123!', name: 'Member A' });
    const logMemberA = await loginCentralUser({ email: 'member_a@agency.com', password: 'Password123!', deviceId: 'dev-member-a' });
    tokenMemberA = logMemberA.tokens!.accessToken;
    userMemberA = { id: regMemberA.user!.id, email: regMemberA.user!.email };

    const regViewerA = await registerCentralUser({ email: 'viewer_a@agency.com', password: 'Password123!', name: 'Viewer A' });
    const logViewerA = await loginCentralUser({ email: 'viewer_a@agency.com', password: 'Password123!', deviceId: 'dev-viewer-a' });
    tokenViewerA = logViewerA.tokens!.accessToken;
    userViewerA = { id: regViewerA.user!.id, email: regViewerA.user!.email };

    const regOwnerB = await registerCentralUser({ email: 'owner_b@othercorp.com', password: 'Password123!', name: 'Owner B' });
    const logOwnerB = await loginCentralUser({ email: 'owner_b@othercorp.com', password: 'Password123!', deviceId: 'dev-owner-b' });
    tokenOwnerB = logOwnerB.tokens!.accessToken;
    userOwnerB = { id: regOwnerB.user!.id, email: regOwnerB.user!.email };

    getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1").run();
  });

  afterAll(async () => {
    setStorageProviderForTest(null);
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    closeDatabase();
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  });

  async function apiRequest(
    endpoint: string,
    options: { method: string; token?: string; body?: any; rawBody?: Buffer }
  ): Promise<{ status: number; data: any; rawBody: Buffer }> {
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
        res.on('data', (c) => chunks.push(c));
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
  // 1. WORKSPACE CREATION & INVITATION ACCEPTANCE
  // --------------------------------------------------------------------------
  describe('Workspace Setup & Secure Invitation Flow', () => {
    it('User A creates Workspace A and User B creates Workspace B', async () => {
      const resA = await apiRequest('/api/v1/workspaces', {
        method: 'POST',
        token: tokenOwnerA,
        body: { name: 'Workspace Alpha', description: 'Agency Team A' },
      });
      expect(resA.status).toBe(201);
      expect(resA.data.success).toBe(true);
      workspaceAId = resA.data.workspace.id;

      const resB = await apiRequest('/api/v1/workspaces', {
        method: 'POST',
        token: tokenOwnerB,
        body: { name: 'Workspace Beta', description: 'Agency Team B' },
      });
      expect(resB.status).toBe(201);
      workspaceBId = resB.data.workspace.id;
    });

    it('Owner A invites Member A and Viewer A, who accept their invitations', async () => {
      // Invite Member A
      const inviteMemberRes = await apiRequest(`/api/v1/workspaces/${workspaceAId}/members/invite`, {
        method: 'POST',
        token: tokenOwnerA,
        body: { email: userMemberA.email, role: 'MEMBER' },
      });
      expect(inviteMemberRes.status).toBe(201);
      const tokenMember = inviteMemberRes.data.invitation.token;

      // Accept Member A
      const acceptMemberRes = await apiRequest('/api/v1/workspaces/invitations/accept', {
        method: 'POST',
        token: tokenMemberA,
        body: { token: tokenMember },
      });
      expect(acceptMemberRes.status).toBe(200);
      expect(acceptMemberRes.data.success).toBe(true);
      expect(acceptMemberRes.data.role).toBe('MEMBER');

      // Invite Viewer A
      const inviteViewerRes = await apiRequest(`/api/v1/workspaces/${workspaceAId}/members/invite`, {
        method: 'POST',
        token: tokenOwnerA,
        body: { email: userViewerA.email, role: 'VIEWER' },
      });
      const tokenViewer = inviteViewerRes.data.invitation.token;

      // Accept Viewer A
      const acceptViewerRes = await apiRequest('/api/v1/workspaces/invitations/accept', {
        method: 'POST',
        token: tokenViewerA,
        body: { token: tokenViewer },
      });
      expect(acceptViewerRes.status).toBe(200);
      expect(acceptViewerRes.data.role).toBe('VIEWER');
    });

    it('should block replay of invitation token', async () => {
      // Generate invite
      const invRes = await apiRequest(`/api/v1/workspaces/${workspaceAId}/members/invite`, {
        method: 'POST',
        token: tokenOwnerA,
        body: { email: 'temp_user@agency.com', role: 'MEMBER' },
      });
      const token = invRes.data.invitation.token;

      // Register temp user
      const reg = await registerCentralUser({ email: 'temp_user@agency.com', password: 'Password123!' });
      getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1 WHERE email = 'temp_user@agency.com'").run();
      const log = await loginCentralUser({ email: 'temp_user@agency.com', password: 'Password123!', deviceId: 'dev-temp' });

      // First accept
      const res1 = await apiRequest('/api/v1/workspaces/invitations/accept', {
        method: 'POST',
        token: log.tokens!.accessToken,
        body: { token },
      });
      expect(res1.status).toBe(200);

      // Replay attempt
      const res2 = await apiRequest('/api/v1/workspaces/invitations/accept', {
        method: 'POST',
        token: log.tokens!.accessToken,
        body: { token },
      });
      expect(res2.status).toBe(400);
      expect(res2.data.error).toMatch(/already been accepted/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. CROSS-WORKSPACE & CROSS-USER ISOLATION (STEP 20)
  // --------------------------------------------------------------------------
  describe('Cross-Workspace & Cross-User Isolation (STEP 20)', () => {
    it('User from Workspace A cannot access Workspace B details or members', async () => {
      const getWsB = await apiRequest(`/api/v1/workspaces/${workspaceBId}`, {
        method: 'GET',
        token: tokenOwnerA,
      });
      expect(getWsB.status).toBe(404); // Not found or access denied

      const getMembersB = await apiRequest(`/api/v1/workspaces/${workspaceBId}/members`, {
        method: 'GET',
        token: tokenOwnerA,
      });
      expect(getMembersB.status).toBe(403);
    });

    it('User from Workspace A cannot access Workspace B audit logs', async () => {
      const auditRes = await apiRequest(`/api/v1/workspaces/${workspaceBId}/audit-logs`, {
        method: 'GET',
        token: tokenOwnerA,
      });
      expect(auditRes.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 3. SERVER-SIDE RBAC ENFORCEMENT ACROSS ROLES (STEP 21)
  // --------------------------------------------------------------------------
  describe('Server-Side RBAC Enforcement (STEP 21)', () => {
    it('VIEWER cannot invite members (400/403 failure)', async () => {
      const res = await apiRequest(`/api/v1/workspaces/${workspaceAId}/members/invite`, {
        method: 'POST',
        token: tokenViewerA,
        body: { email: 'another@agency.com', role: 'MEMBER' },
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/Forbidden/);
    });

    it('MEMBER cannot change role of other members', async () => {
      const res = await apiRequest(`/api/v1/workspaces/${workspaceAId}/members/${userViewerA.id}/role`, {
        method: 'PUT',
        token: tokenMemberA,
        body: { role: 'ADMIN' },
      });
      expect(res.status).toBe(403);
      expect(res.data.error).toMatch(/Forbidden/);
    });

    it('MEMBER cannot remove other members', async () => {
      const res = await apiRequest(`/api/v1/workspaces/${workspaceAId}/members/${userViewerA.id}`, {
        method: 'DELETE',
        token: tokenMemberA,
      });
      expect(res.status).toBe(403);
    });

    it('Non-owner cannot delete workspace', async () => {
      const res = await apiRequest(`/api/v1/workspaces/${workspaceAId}`, {
        method: 'DELETE',
        token: tokenMemberA,
      });
      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 4. PROFILE SHARING & SESSION LAUNCH (STEP 23)
  // --------------------------------------------------------------------------
  describe('Profile Sharing, Session Inheritance & Zero Plaintext Secrets (STEP 23)', () => {
    let cloudProfileA1Id: string;
    const encryptedKeyEnvelope = 'wrapped_zk_key_envelope_' + crypto.randomBytes(16).toString('hex');

    beforeAll(async () => {
      // Create a cloud profile directly in DB for Owner A with version 1
      const db = getDatabase();
      cloudProfileA1Id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO cloud_profiles (id, owner_id, local_profile_id, name, current_version, status, storage_bytes, created_at, updated_at)
        VALUES (?, ?, 'local-a1', 'Profile A1 (E-commerce)', 1, 'ACTIVE', 524288, ?, ?)
      `).run(cloudProfileA1Id, userOwnerA.id, now, now);

      db.prepare(`
        INSERT INTO cloud_profile_versions (id, cloud_profile_id, version, object_key, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag, source_device_id, created_at)
        VALUES (?, ?, 1, 'profiles/a1/v1.enc', 524288, 'hash123', 'owner_key_data', 'iv123', 'tag123', 'dev-a', ?)
      `).run(crypto.randomUUID(), cloudProfileA1Id, now);
    });

    it('Before sharing: Member A and Outsider B cannot download or access Profile A1', async () => {
      const resMember = await apiRequest('/api/v1/sync/download-session', {
        method: 'POST',
        token: tokenMemberA,
        body: { cloudProfileId: cloudProfileA1Id },
      });
      expect(resMember.status).toBe(404);

      const resOutsider = await apiRequest('/api/v1/sync/download-session', {
        method: 'POST',
        token: tokenOwnerB,
        body: { cloudProfileId: cloudProfileA1Id },
      });
      expect(resOutsider.status).toBe(404);
    });

    it('Owner A shares Profile A1 with Workspace A', async () => {
      const shareRes = await apiRequest(`/api/v1/workspaces/${workspaceAId}/profiles/share`, {
        method: 'POST',
        token: tokenOwnerA,
        body: {
          cloudProfileId: cloudProfileA1Id,
          permissionLevel: 'RUN',
          encryptedKeyEnvelope,
        },
      });
      expect(shareRes.status).toBe(200);
      expect(shareRes.data.success).toBe(true);
      expect(shareRes.data.share.cloudProfileId).toBe(cloudProfileA1Id);
    });

    it('Authorized Member A can list shared profiles and obtain download session with key envelope', async () => {
      // 1. List profiles in workspace
      const listRes = await apiRequest(`/api/v1/workspaces/${workspaceAId}/profiles`, {
        method: 'GET',
        token: tokenMemberA,
      });
      expect(listRes.status).toBe(200);
      expect(listRes.data.profiles.length).toBe(1);
      expect(listRes.data.profiles[0].cloudProfileId).toBe(cloudProfileA1Id);

      // 2. Download session
      const dlRes = await apiRequest('/api/v1/sync/download-session', {
        method: 'POST',
        token: tokenMemberA,
        body: { cloudProfileId: cloudProfileA1Id },
      });
      expect(dlRes.status).toBe(200);
      expect(dlRes.data.success).toBe(true);
      expect(dlRes.data.data.downloadUrl).toBeDefined();
      expect(dlRes.data.data.encryptedDataKey).toBe(encryptedKeyEnvelope); // Receives workspace envelope

      // Crucial: Plaintext passwords or secrets must NOT be in the API payload
      expect(JSON.stringify(dlRes.data)).not.toContain('Password123!');
      expect(JSON.stringify(dlRes.data)).not.toContain('plain_secret');
    });

    it('VIEWER role cannot run or request download session', async () => {
      const dlRes = await apiRequest('/api/v1/sync/download-session', {
        method: 'POST',
        token: tokenViewerA,
        body: { cloudProfileId: cloudProfileA1Id },
      });
      expect(dlRes.status).toBe(404); // Access denied
    });

    it('Revoking share stops future download authorization immediately', async () => {
      const revokeRes = await apiRequest(`/api/v1/workspaces/${workspaceAId}/profiles/${cloudProfileA1Id}/share`, {
        method: 'DELETE',
        token: tokenOwnerA,
      });
      expect(revokeRes.status).toBe(200);

      // Subsequent download attempt fails immediately
      const dlRes = await apiRequest('/api/v1/sync/download-session', {
        method: 'POST',
        token: tokenMemberA,
        body: { cloudProfileId: cloudProfileA1Id },
      });
      expect(dlRes.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // 5. DISTRIBUTED LOCK CONTENTION ACROSS TEAM MEMBERS (STEP 24)
  // --------------------------------------------------------------------------
  describe('Distributed Lock Contention Across Teammates (STEP 24)', () => {
    let sharedProfileId: string;

    beforeAll(async () => {
      // Create new profile and share it
      const db = getDatabase();
      sharedProfileId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO cloud_profiles (id, owner_id, local_profile_id, name, current_version, status, storage_bytes, created_at, updated_at)
        VALUES (?, ?, 'local-lock-1', 'Shared Lock Profile', 1, 'ACTIVE', 1024, ?, ?)
      `).run(sharedProfileId, userOwnerA.id, now, now);

      db.prepare(`
        INSERT INTO cloud_profile_versions (id, cloud_profile_id, version, object_key, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag, source_device_id, created_at)
        VALUES (?, ?, 1, 'profiles/lock/v1.enc', 1024, 'hash_lock', 'key_lock', 'iv_lock', 'tag_lock', 'dev-a', ?)
      `).run(crypto.randomUUID(), sharedProfileId, now);

      // Share with Workspace A
      await apiRequest(`/api/v1/workspaces/${workspaceAId}/profiles/share`, {
        method: 'POST',
        token: tokenOwnerA,
        body: { cloudProfileId: sharedProfileId, permissionLevel: 'RUN', encryptedKeyEnvelope: 'env_lock' },
      });
    });

    it('When Teammate 1 acquires the lock, Teammate 2 receives HTTP 423 LOCKED', async () => {
      // Teammate 1 (Owner A on Device 1) acquires lock
      const lock1 = await apiRequest('/api/v1/sync/lock/acquire', {
        method: 'POST',
        token: tokenOwnerA,
        body: {
          cloudProfileId: sharedProfileId,
          deviceId: 'device-owner-1',
          deviceName: 'Owner Laptop',
          ttlSeconds: 60,
        },
      });
      expect(lock1.status).toBe(200);
      expect(lock1.data.acquired).toBe(true);

      // Teammate 2 (Member A on Device 2) attempts to acquire lock -> 423 LOCKED
      const lock2 = await apiRequest('/api/v1/sync/lock/acquire', {
        method: 'POST',
        token: tokenMemberA,
        body: {
          cloudProfileId: sharedProfileId,
          deviceId: 'device-member-2',
          deviceName: 'Member Workstation',
          ttlSeconds: 60,
        },
      });
      expect(lock2.status).toBe(423);
      expect(lock2.data.acquired).toBe(false);
      expect(lock2.data.heldBy).toBe('Owner Laptop');
    });

    it('When Teammate 1 releases the lock, Teammate 2 can successfully acquire it', async () => {
      // Teammate 1 releases lock
      const releaseRes = await apiRequest('/api/v1/sync/lock/release', {
        method: 'POST',
        token: tokenOwnerA,
        body: {
          cloudProfileId: sharedProfileId,
          deviceId: 'device-owner-1',
        },
      });
      expect(releaseRes.status).toBe(200);
      expect(releaseRes.data.released).toBe(true);

      // Teammate 2 can now acquire
      const lock2 = await apiRequest('/api/v1/sync/lock/acquire', {
        method: 'POST',
        token: tokenMemberA,
        body: {
          cloudProfileId: sharedProfileId,
          deviceId: 'device-member-2',
          deviceName: 'Member Workstation',
          ttlSeconds: 60,
        },
      });
      expect(lock2.status).toBe(200);
      expect(lock2.data.acquired).toBe(true);

      // Clean up lock
      await apiRequest('/api/v1/sync/lock/release', {
        method: 'POST',
        token: tokenMemberA,
        body: { cloudProfileId: sharedProfileId, deviceId: 'device-member-2' },
      });
    });

    it('Removing member revokes future lock and launch authorization', async () => {
      // Remove Member A from Workspace A
      const removeRes = await apiRequest(`/api/v1/workspaces/${workspaceAId}/members/${userMemberA.id}`, {
        method: 'DELETE',
        token: tokenOwnerA,
      });
      expect(removeRes.status).toBe(200);

      // Attempting to acquire lock now returns 400 Access Denied
      const lockAttempt = await apiRequest('/api/v1/sync/lock/acquire', {
        method: 'POST',
        token: tokenMemberA,
        body: {
          cloudProfileId: sharedProfileId,
          deviceId: 'device-member-2',
          deviceName: 'Member Workstation',
        },
      });
      expect(lockAttempt.status).toBe(400);
      expect(lockAttempt.data.error).toMatch(/Access denied/);
    });
  });
});
