import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { initSqlEngine, setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { registerCentralUser } from '../../05_AUTH/central-auth-service.js';
import { getEmailProvider, DevelopmentEmailProvider } from '../../05_AUTH/email-service.js';
import {
  createTeamWorkspace,
  listUserTeamWorkspaces,
  getTeamWorkspace,
  updateTeamWorkspace,
  deleteTeamWorkspace,
  transferWorkspaceOwnership,
  getWorkspaceMembers,
  updateMemberRole,
  removeWorkspaceMember,
  inviteWorkspaceMember,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
  acceptWorkspaceInvitation,
  shareProfileToWorkspace,
  revokeProfileShare,
  listWorkspaceProfiles,
  getWorkspaceAuditLogs,
  hasWorkspacePermission,
  setWorkspaceKeyEnvelope,
  getWorkspaceKeyEnvelope,
} from '../../07_BACKEND/services/team-workspace-service.js';
import { ROLE_PERMISSIONS, TeamRole } from '../../10_CONFIG/shared/types/workspace.js';

describe('PHASE 3 UNIT: Team Workspaces, RBAC, Invitations & Profile Sharing', () => {
  let tempSqliteDir: string;
  let userOwner: { id: string; email: string };
  let userAdmin: { id: string; email: string };
  let userManager: { id: string; email: string };
  let userMember: { id: string; email: string };
  let userViewer: { id: string; email: string };
  let userOutsider: { id: string; email: string };

  beforeAll(async () => {
    tempSqliteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-phase3-unit-'));
    setCustomDatabasePath(path.join(tempSqliteDir, 'unit_phase3.sqlite'));
    await initSqlEngine();
    await initializeDatabase();

    // Create central test accounts
    const regOwner = await registerCentralUser({ email: 'owner@agency.com', password: 'Password123!', name: 'Owner User' });
    const regAdmin = await registerCentralUser({ email: 'admin@agency.com', password: 'Password123!', name: 'Admin User' });
    const regManager = await registerCentralUser({ email: 'manager@agency.com', password: 'Password123!', name: 'Manager User' });
    const regMember = await registerCentralUser({ email: 'member@agency.com', password: 'Password123!', name: 'Member User' });
    const regViewer = await registerCentralUser({ email: 'viewer@agency.com', password: 'Password123!', name: 'Viewer User' });
    const regOutsider = await registerCentralUser({ email: 'outsider@other.com', password: 'Password123!', name: 'Outsider User' });

    userOwner = { id: regOwner.user!.id, email: regOwner.user!.email };
    userAdmin = { id: regAdmin.user!.id, email: regAdmin.user!.email };
    userManager = { id: regManager.user!.id, email: regManager.user!.email };
    userMember = { id: regMember.user!.id, email: regMember.user!.email };
    userViewer = { id: regViewer.user!.id, email: regViewer.user!.email };
    userOutsider = { id: regOutsider.user!.id, email: regOutsider.user!.email };

    getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE', email_verified = 1").run();
  });

  afterAll(() => {
    closeDatabase();
    try { fs.rmSync(tempSqliteDir, { recursive: true, force: true }); } catch {}
  });

  // --------------------------------------------------------------------------
  // 1. WORKSPACE CREATION & OWNER LIFECYCLE
  // --------------------------------------------------------------------------
  describe('Workspace Creation & Owner Lifecycle', () => {
    it('should create a workspace with creator assigned as OWNER', () => {
      const ws = createTeamWorkspace(userOwner.id, {
        name: 'Alpha Team Workspace',
        description: 'First agency workspace',
      });

      expect(ws).toBeDefined();
      expect(ws.name).toBe('Alpha Team Workspace');
      expect(ws.ownerUserId).toBe(userOwner.id);
      expect(ws.userRole).toBe('OWNER');
      expect(ws.memberCount).toBe(1);

      const members = getWorkspaceMembers(userOwner.id, ws.id);
      expect(members.length).toBe(1);
      expect(members[0].userId).toBe(userOwner.id);
      expect(members[0].role).toBe('OWNER');
    });

    it('should list all workspaces where user is an active member', () => {
      const list = listUserTeamWorkspaces(userOwner.id);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some(w => w.name === 'Alpha Team Workspace')).toBe(true);

      const outsiderList = listUserTeamWorkspaces(userOutsider.id);
      expect(outsiderList.some(w => w.name === 'Alpha Team Workspace')).toBe(false);
    });

    it('should prevent non-owners from deleting the workspace', () => {
      const ws = createTeamWorkspace(userOwner.id, { name: 'Protected WS' });
      expect(() => deleteTeamWorkspace(userOutsider.id, ws.id)).toThrow(/Forbidden/);
    });

    it('should prevent deleting or modifying owner role directly', () => {
      const ws = createTeamWorkspace(userOwner.id, { name: 'Owner Safeguard WS' });

      // Cannot remove owner
      expect(() => removeWorkspaceMember(userOwner.id, ws.id, userOwner.id)).toThrow(/Cannot remove the workspace owner/);

      // Cannot demote owner
      expect(() => updateMemberRole(userOwner.id, ws.id, userOwner.id, 'ADMIN')).toThrow(/Cannot modify the role of the workspace owner/);
    });

    it('should allow explicit ownership transfer to an active member', () => {
      const ws = createTeamWorkspace(userOwner.id, { name: 'Transfer WS' });

      // Add target user as member
      const db = getDatabase();
      db.prepare(`
        INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, joined_at, created_at)
        VALUES (?, ?, ?, 'ADMIN', 'ACTIVE', datetime('now'), datetime('now'))
      `).run(crypto.randomUUID(), ws.id, userAdmin.id);

      // Transfer ownership
      const transferred = transferWorkspaceOwnership(userOwner.id, ws.id, userAdmin.id);
      expect(transferred).toBe(true);

      const updatedWs = getTeamWorkspace(userAdmin.id, ws.id);
      expect(updatedWs?.ownerUserId).toBe(userAdmin.id);
      expect(updatedWs?.userRole).toBe('OWNER');

      // Old owner is now ADMIN
      const oldOwnerCheck = getTeamWorkspace(userOwner.id, ws.id);
      expect(oldOwnerCheck?.userRole).toBe('ADMIN');
    });
  });

  // --------------------------------------------------------------------------
  // 2. ROLE & PERMISSION MATRIX
  // --------------------------------------------------------------------------
  describe('RBAC Permission Matrix Enforcement', () => {
    let wsId: string;

    beforeAll(() => {
      const ws = createTeamWorkspace(userOwner.id, { name: 'RBAC Test WS' });
      wsId = ws.id;

      // Add members with each role directly
      const db = getDatabase();
      const roles: [string, TeamRole][] = [
        [userAdmin.id, 'ADMIN'],
        [userManager.id, 'MANAGER'],
        [userMember.id, 'MEMBER'],
        [userViewer.id, 'VIEWER'],
      ];

      for (const [uid, r] of roles) {
        db.prepare(`
          INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, joined_at, created_at)
          VALUES (?, ?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'))
        `).run(crypto.randomUUID(), wsId, uid, r);
      }
    });

    it('OWNER should have all 18 permissions', () => {
      expect(ROLE_PERMISSIONS.OWNER.length).toBe(18);
      expect(hasWorkspacePermission(userOwner.id, wsId, 'WORKSPACE_DELETE')).toBe(true);
      expect(hasWorkspacePermission(userOwner.id, wsId, 'MEMBER_REMOVE')).toBe(true);
      expect(hasWorkspacePermission(userOwner.id, wsId, 'PROFILE_SHARE')).toBe(true);
      expect(hasWorkspacePermission(userOwner.id, wsId, 'PROFILE_RUN')).toBe(true);
    });

    it('ADMIN should have 16 permissions (everything except WORKSPACE_DELETE & TRANSFER)', () => {
      expect(hasWorkspacePermission(userAdmin.id, wsId, 'WORKSPACE_EDIT')).toBe(true);
      expect(hasWorkspacePermission(userAdmin.id, wsId, 'MEMBER_INVITE')).toBe(true);
      expect(hasWorkspacePermission(userAdmin.id, wsId, 'MEMBER_REMOVE')).toBe(true);
      expect(hasWorkspacePermission(userAdmin.id, wsId, 'PROFILE_SHARE')).toBe(true);
      expect(hasWorkspacePermission(userAdmin.id, wsId, 'WORKSPACE_DELETE')).toBe(false);
      expect(hasWorkspacePermission(userAdmin.id, wsId, 'WORKSPACE_TRANSFER')).toBe(false);
    });

    it('MANAGER should have operational profile & invite permissions, but cannot remove members', () => {
      expect(hasWorkspacePermission(userManager.id, wsId, 'MEMBER_INVITE')).toBe(true);
      expect(hasWorkspacePermission(userManager.id, wsId, 'PROFILE_SHARE')).toBe(true);
      expect(hasWorkspacePermission(userManager.id, wsId, 'PROFILE_RUN')).toBe(true);
      expect(hasWorkspacePermission(userManager.id, wsId, 'MEMBER_REMOVE')).toBe(false);
      expect(hasWorkspacePermission(userManager.id, wsId, 'MEMBER_ROLE_CHANGE')).toBe(false);
      expect(hasWorkspacePermission(userManager.id, wsId, 'PROFILE_DELETE')).toBe(false);
    });

    it('MEMBER should only be able to view and run profiles', () => {
      expect(hasWorkspacePermission(userMember.id, wsId, 'PROFILE_RUN')).toBe(true);
      expect(hasWorkspacePermission(userMember.id, wsId, 'PROFILE_VIEW')).toBe(true);
      expect(hasWorkspacePermission(userMember.id, wsId, 'MEMBER_INVITE')).toBe(false);
      expect(hasWorkspacePermission(userMember.id, wsId, 'PROFILE_SHARE')).toBe(false);
      expect(hasWorkspacePermission(userMember.id, wsId, 'WORKSPACE_EDIT')).toBe(false);
    });

    it('VIEWER should have read-only permissions', () => {
      expect(hasWorkspacePermission(userViewer.id, wsId, 'WORKSPACE_VIEW')).toBe(true);
      expect(hasWorkspacePermission(userViewer.id, wsId, 'PROFILE_VIEW')).toBe(true);
      expect(hasWorkspacePermission(userViewer.id, wsId, 'PROFILE_RUN')).toBe(false);
      expect(hasWorkspacePermission(userViewer.id, wsId, 'PROFILE_EDIT')).toBe(false);
    });

    it('Non-members should have 0 permissions', () => {
      expect(hasWorkspacePermission(userOutsider.id, wsId, 'WORKSPACE_VIEW')).toBe(false);
      expect(hasWorkspacePermission(userOutsider.id, wsId, 'PROFILE_RUN')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. INVITATION LIFECYCLE & SECURITY
  // --------------------------------------------------------------------------
  describe('Invitation Lifecycle & Security', () => {
    let wsId: string;

    beforeAll(() => {
      const ws = createTeamWorkspace(userOwner.id, { name: 'Invite Suite WS' });
      wsId = ws.id;
    });

    it('should generate high-entropy 256-bit token and queue invitation email', async () => {
      const result = await inviteWorkspaceMember(userOwner.id, wsId, 'newcolleague@agency.com', 'MEMBER');

      expect(result.invitationId).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex = 64 characters (256-bit entropy)
      expect(result.role).toBe('MEMBER');

      const emailProvider = getEmailProvider() as DevelopmentEmailProvider;
      const lastEmail = emailProvider.getLastEmailFor('newcolleague@agency.com');
      expect(lastEmail).toBeDefined();
      expect(lastEmail?.token).toBe(result.token);
    });

    it('should reject inviting someone who is already an active member', async () => {
      await expect(inviteWorkspaceMember(userOwner.id, wsId, userOwner.email, 'MEMBER'))
        .rejects.toThrow(/already an active member/);
    });

    it('should reject duplicate pending invitations to the same email', async () => {
      await expect(inviteWorkspaceMember(userOwner.id, wsId, 'newcolleague@agency.com', 'MEMBER'))
        .rejects.toThrow(/pending invitation.*already exists/);
    });

    it('should reject unauthorized inviter (MEMBER role cannot invite)', async () => {
      // Add a member
      const db = getDatabase();
      db.prepare(`
        INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, joined_at, created_at)
        VALUES (?, ?, ?, 'MEMBER', 'ACTIVE', datetime('now'), datetime('now'))
      `).run(crypto.randomUUID(), wsId, userMember.id);

      await expect(inviteWorkspaceMember(userMember.id, wsId, 'thirdparty@agency.com', 'MEMBER'))
        .rejects.toThrow(/Forbidden/);
    });

    it('should allow revoking a pending invitation', async () => {
      const inv = await inviteWorkspaceMember(userOwner.id, wsId, 'to_revoke@agency.com', 'VIEWER');
      const revoked = revokeWorkspaceInvitation(userOwner.id, wsId, inv.invitationId);
      expect(revoked).toBe(true);

      // Attempting to accept a revoked invite must fail
      // Create user for to_revoke@agency.com
      const reg = await registerCentralUser({ email: 'to_revoke@agency.com', password: 'Password123!' });
      getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE' WHERE id = ?").run(reg.user!.id);
      expect(() => acceptWorkspaceInvitation(reg.user!.id, inv.token)).toThrow(/revoked/);
    });

    it('should allow invited account to accept invitation and become active member', async () => {
      const inviteTargetEmail = 'invited_user@agency.com';
      const regTarget = await registerCentralUser({ email: inviteTargetEmail, password: 'Password123!' });
      getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE' WHERE id = ?").run(regTarget.user!.id);

      const inv = await inviteWorkspaceMember(userOwner.id, wsId, inviteTargetEmail, 'MANAGER');
      const acceptResult = acceptWorkspaceInvitation(regTarget.user!.id, inv.token);

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.workspaceId).toBe(wsId);
      expect(acceptResult.role).toBe('MANAGER');

      const members = getWorkspaceMembers(userOwner.id, wsId);
      const joined = members.find(m => m.userId === regTarget.user!.id);
      expect(joined).toBeDefined();
      expect(joined?.role).toBe('MANAGER');
      expect(joined?.status).toBe('ACTIVE');
    });

    it('should block replaying an already accepted invitation token', async () => {
      const inviteTargetEmail = 'replay_test@agency.com';
      const regTarget = await registerCentralUser({ email: inviteTargetEmail, password: 'Password123!' });
      getDatabase().prepare("UPDATE auth_users SET status = 'ACTIVE' WHERE id = ?").run(regTarget.user!.id);

      const inv = await inviteWorkspaceMember(userOwner.id, wsId, inviteTargetEmail, 'MEMBER');
      acceptWorkspaceInvitation(regTarget.user!.id, inv.token);

      // Replay attempt
      expect(() => acceptWorkspaceInvitation(regTarget.user!.id, inv.token)).toThrow(/already been accepted/);
    });

    it('should reject invite acceptance if authenticated account does not match invited email', async () => {
      const inv = await inviteWorkspaceMember(userOwner.id, wsId, 'specific_recipient@agency.com', 'MEMBER');

      // User Outsider tries to accept specific_recipient's invite token
      expect(() => acceptWorkspaceInvitation(userOutsider.id, inv.token)).toThrow(/Invitation was sent to/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. PROFILE SHARING & REVOCATION
  // --------------------------------------------------------------------------
  describe('Profile Sharing, Key Envelopes & Revocation', () => {
    let wsId: string;
    let cloudProfileId: string;

    beforeAll(() => {
      const ws = createTeamWorkspace(userOwner.id, { name: 'Share Test WS' });
      wsId = ws.id;

      // Add userMember to this workspace
      const db = getDatabase();
      db.prepare(`
        INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, joined_at, created_at)
        VALUES (?, ?, ?, 'MEMBER', 'ACTIVE', datetime('now'), datetime('now'))
      `).run(crypto.randomUUID(), wsId, userMember.id);

      // Create a cloud profile for userOwner
      cloudProfileId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO cloud_profiles (id, owner_id, local_profile_id, name, current_version, status, storage_bytes, created_at, updated_at)
        VALUES (?, ?, ?, 'Marketing Automation Profile', 1, 'ACTIVE', 1048576, datetime('now'), datetime('now'))
      `).run(cloudProfileId, userOwner.id, 'local-prof-1');
    });

    it('should share profile to workspace with encrypted key envelope', () => {
      const envelope = 'aes256_wrapped_envelope_' + crypto.randomBytes(16).toString('hex');
      const share = shareProfileToWorkspace(userOwner.id, wsId, {
        cloudProfileId,
        permissionLevel: 'RUN',
        encryptedKeyEnvelope: envelope,
      });

      expect(share).toBeDefined();
      expect(share.cloudProfileId).toBe(cloudProfileId);
      expect(share.permissionLevel).toBe('RUN');
      expect(share.encryptedKeyEnvelope).toBe(envelope);

      const list = listWorkspaceProfiles(userMember.id, wsId);
      expect(list.length).toBe(1);
      expect(list[0].cloudProfileId).toBe(cloudProfileId);
      expect(list[0].profileName).toBe('Marketing Automation Profile');
    });

    it('should revoke profile share and remove it from workspace listing', () => {
      const revoked = revokeProfileShare(userOwner.id, wsId, cloudProfileId);
      expect(revoked).toBe(true);

      const list = listWorkspaceProfiles(userMember.id, wsId);
      expect(list.length).toBe(0);
    });

    it('should store and retrieve zero-knowledge workspace key envelopes', () => {
      const mockKey = crypto.randomBytes(32).toString('hex');
      setWorkspaceKeyEnvelope(userOwner.id, wsId, userMember.id, mockKey);

      const retrieved = getWorkspaceKeyEnvelope(userMember.id, wsId);
      expect(retrieved).toBe(mockKey);

      // Outsider cannot access key envelope
      const outsiderKey = getWorkspaceKeyEnvelope(userOutsider.id, wsId);
      expect(outsiderKey).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 5. AUDIT LOGGING
  // --------------------------------------------------------------------------
  describe('Workspace Audit Trail', () => {
    it('should track security events in workspace audit logs', () => {
      const ws = createTeamWorkspace(userOwner.id, { name: 'Audit Test WS' });
      const logs = getWorkspaceAuditLogs(userOwner.id, ws.id);

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some(l => l.action === 'WORKSPACE_CREATED')).toBe(true);
    });
  });
});
