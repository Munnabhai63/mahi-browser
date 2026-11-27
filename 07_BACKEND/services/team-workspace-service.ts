import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import {
  TeamRole,
  TeamPermission,
  ROLE_PERMISSIONS,
  TeamWorkspace,
  TeamWorkspaceMember,
  TeamWorkspaceInvitation,
  TeamProfileShare,
  TeamWorkspaceAuditLog,
} from '../../10_CONFIG/shared/types/workspace.js';
import { getEmailProvider } from '../../05_AUTH/email-service.js';
import { getCentralUserById, getCentralUserByEmail } from '../../05_AUTH/central-auth-service.js';
import { appUrl } from '../../10_CONFIG/shared/site-config.js';

// ============================================================================
// PERMISSION CHECK HELPERS
// ============================================================================

export function getMemberRoleInWorkspace(userId: string, workspaceId: string): { role: TeamRole; status: string } | null {
  const db = getDatabase();
  const member = db.prepare(`
    SELECT role, status FROM team_workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, userId) as { role: TeamRole; status: string } | undefined;

  if (!member) return null;
  return { role: member.role, status: member.status };
}

export function hasWorkspacePermission(userId: string, workspaceId: string, permission: TeamPermission): boolean {
  const member = getMemberRoleInWorkspace(userId, workspaceId);
  if (!member || member.status !== 'ACTIVE') {
    return false;
  }

  const allowedPermissions = ROLE_PERMISSIONS[member.role] || [];
  return allowedPermissions.includes(permission);
}

export function logWorkspaceAudit(
  workspaceId: string,
  userId: string,
  action: string,
  details?: string,
  targetId?: string
): void {
  try {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO team_workspace_audit_logs (id, workspace_id, user_id, action, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, workspaceId, userId, action, targetId || null, details || null, now);
  } catch (err) {
    console.error('[WorkspaceAudit] Failed to log audit event:', err);
  }
}

// ============================================================================
// WORKSPACE CRUD & OWNER SAFETY
// ============================================================================

export interface CreateTeamWorkspaceInput {
  name: string;
  description?: string;
  workspaceKeyEnvelope?: string;
}

export function createTeamWorkspace(ownerUserId: string, input: CreateTeamWorkspaceInput): TeamWorkspace {
  const user = getCentralUserById(ownerUserId);
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('User not found or account is not active');
  }

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Workspace name is required');
  }

  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO team_workspaces (id, name, description, owner_user_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
  `).run(id, trimmedName, input.description?.trim() || '', ownerUserId, now, now);

  const memberId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, joined_at, created_at)
    VALUES (?, ?, ?, 'OWNER', 'ACTIVE', ?, ?)
  `).run(memberId, id, ownerUserId, now, now);

  if (input.workspaceKeyEnvelope) {
    const keyId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO team_workspace_keys (id, workspace_id, user_id, encrypted_workspace_key, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(keyId, id, ownerUserId, input.workspaceKeyEnvelope, now);
  }

  logWorkspaceAudit(id, ownerUserId, 'WORKSPACE_CREATED', `Workspace "${trimmedName}" created by ${user.email}`);

  return {
    id,
    name: trimmedName,
    description: input.description?.trim() || '',
    ownerUserId,
    ownerEmail: user.email,
    ownerName: user.name,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    memberCount: 1,
    profileCount: 0,
    userRole: 'OWNER',
    userPermissions: ROLE_PERMISSIONS['OWNER'],
  };
}

export function listUserTeamWorkspaces(userId: string): TeamWorkspace[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT w.*, m.role as user_role, u.email as owner_email, u.name as owner_name,
      (SELECT COUNT(*) FROM team_workspace_members WHERE workspace_id = w.id AND status = 'ACTIVE') as member_count,
      (SELECT COUNT(*) FROM team_profile_shares WHERE workspace_id = w.id AND revoked_at IS NULL) as profile_count
    FROM team_workspaces w
    JOIN team_workspace_members m ON w.id = m.workspace_id
    JOIN auth_users u ON w.owner_user_id = u.id
    WHERE m.user_id = ? AND m.status = 'ACTIVE' AND w.status = 'ACTIVE'
    ORDER BY w.created_at DESC
  `).all(userId) as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    ownerUserId: r.owner_user_id,
    ownerEmail: r.owner_email,
    ownerName: r.owner_name,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    memberCount: r.member_count,
    profileCount: r.profile_count,
    userRole: r.user_role as TeamRole,
    userPermissions: ROLE_PERMISSIONS[r.user_role as TeamRole] || [],
  }));
}

export function getTeamWorkspace(userId: string, workspaceId: string): TeamWorkspace | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT w.*, m.role as user_role, u.email as owner_email, u.name as owner_name,
      (SELECT COUNT(*) FROM team_workspace_members WHERE workspace_id = w.id AND status = 'ACTIVE') as member_count,
      (SELECT COUNT(*) FROM team_profile_shares WHERE workspace_id = w.id AND revoked_at IS NULL) as profile_count
    FROM team_workspaces w
    JOIN team_workspace_members m ON w.id = m.workspace_id
    JOIN auth_users u ON w.owner_user_id = u.id
    WHERE w.id = ? AND m.user_id = ? AND m.status = 'ACTIVE' AND w.status = 'ACTIVE'
  `).get(workspaceId, userId) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    ownerUserId: row.owner_user_id,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount: row.member_count,
    profileCount: row.profile_count,
    userRole: row.user_role as TeamRole,
    userPermissions: ROLE_PERMISSIONS[row.user_role as TeamRole] || [],
  };
}

export function updateTeamWorkspace(
  userId: string,
  workspaceId: string,
  updates: { name?: string; description?: string }
): TeamWorkspace {
  if (!hasWorkspacePermission(userId, workspaceId, 'WORKSPACE_EDIT')) {
    throw new Error('Forbidden: You do not have permission to edit this workspace');
  }

  const db = getDatabase();
  const ws = getTeamWorkspace(userId, workspaceId);
  if (!ws) throw new Error('Workspace not found');

  const newName = updates.name !== undefined ? updates.name.trim() : ws.name;
  if (!newName) throw new Error('Workspace name cannot be empty');
  const newDesc = updates.description !== undefined ? updates.description.trim() : ws.description;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE team_workspaces
    SET name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(newName, newDesc, now, workspaceId);

  logWorkspaceAudit(workspaceId, userId, 'WORKSPACE_UPDATED', `Updated workspace details`);
  return getTeamWorkspace(userId, workspaceId)!;
}

export function deleteTeamWorkspace(userId: string, workspaceId: string): boolean {
  if (!hasWorkspacePermission(userId, workspaceId, 'WORKSPACE_DELETE')) {
    throw new Error('Forbidden: Only the workspace owner can delete the workspace');
  }

  const ws = getTeamWorkspace(userId, workspaceId);
  if (!ws) throw new Error('Workspace not found');
  if (ws.ownerUserId !== userId) {
    throw new Error('Forbidden: Only the workspace owner can delete the workspace');
  }

  const db = getDatabase();
  db.prepare('DELETE FROM team_profile_shares WHERE workspace_id = ?').run(workspaceId);
  db.prepare('DELETE FROM team_workspace_invitations WHERE workspace_id = ?').run(workspaceId);
  db.prepare('DELETE FROM team_workspace_members WHERE workspace_id = ?').run(workspaceId);
  db.prepare('DELETE FROM team_workspace_keys WHERE workspace_id = ?').run(workspaceId);
  db.prepare('DELETE FROM team_workspace_audit_logs WHERE workspace_id = ?').run(workspaceId);
  db.prepare('DELETE FROM team_workspaces WHERE id = ?').run(workspaceId);

  return true;
}

export function transferWorkspaceOwnership(userId: string, workspaceId: string, newOwnerUserId: string): boolean {
  if (!hasWorkspacePermission(userId, workspaceId, 'WORKSPACE_TRANSFER')) {
    throw new Error('Forbidden: Only the workspace owner can transfer ownership');
  }

  const ws = getTeamWorkspace(userId, workspaceId);
  if (!ws || ws.ownerUserId !== userId) {
    throw new Error('Forbidden: Only the current owner can transfer ownership');
  }

  if (userId === newOwnerUserId) {
    throw new Error('Cannot transfer ownership to yourself');
  }

  const db = getDatabase();
  const targetMember = db.prepare(`
    SELECT * FROM team_workspace_members WHERE workspace_id = ? AND user_id = ? AND status = 'ACTIVE'
  `).get(workspaceId, newOwnerUserId) as any;

  if (!targetMember) {
    throw new Error('Target user must be an active member of the workspace');
  }

  const targetUser = getCentralUserById(newOwnerUserId);
  if (!targetUser || targetUser.status !== 'ACTIVE') {
    throw new Error('Target user account is not active');
  }

  const now = new Date().toISOString();

  // Atomically swap ownership
  db.prepare('UPDATE team_workspaces SET owner_user_id = ?, updated_at = ? WHERE id = ?').run(
    newOwnerUserId,
    now,
    workspaceId
  );
  db.prepare('UPDATE team_workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?').run(
    'ADMIN',
    workspaceId,
    userId
  );
  db.prepare('UPDATE team_workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?').run(
    'OWNER',
    workspaceId,
    newOwnerUserId
  );

  logWorkspaceAudit(
    workspaceId,
    userId,
    'OWNERSHIP_TRANSFERRED',
    `Ownership transferred to ${targetUser.email} (${targetUser.id})`,
    newOwnerUserId
  );

  return true;
}

// ============================================================================
// MEMBERS & ROLES MANAGEMENT
// ============================================================================

export function getWorkspaceMembers(userId: string, workspaceId: string): TeamWorkspaceMember[] {
  if (!hasWorkspacePermission(userId, workspaceId, 'WORKSPACE_VIEW')) {
    throw new Error('Forbidden: You do not have permission to view members of this workspace');
  }

  const db = getDatabase();
  const rows = db.prepare(`
    SELECT m.*, u.email, u.name
    FROM team_workspace_members m
    JOIN auth_users u ON m.user_id = u.id
    WHERE m.workspace_id = ? AND m.status = 'ACTIVE'
    ORDER BY CASE m.role
      WHEN 'OWNER' THEN 1
      WHEN 'ADMIN' THEN 2
      WHEN 'MANAGER' THEN 3
      WHEN 'MEMBER' THEN 4
      WHEN 'VIEWER' THEN 5
      ELSE 6 END, u.name ASC
  `).all(workspaceId) as any[];

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    email: r.email,
    name: r.name,
    role: r.role as TeamRole,
    status: r.status,
    joinedAt: r.joined_at,
    invitedBy: r.invited_by || undefined,
    createdAt: r.created_at,
  }));
}

export function updateMemberRole(
  actorUserId: string,
  workspaceId: string,
  targetUserId: string,
  newRole: TeamRole
): boolean {
  if (!hasWorkspacePermission(actorUserId, workspaceId, 'MEMBER_ROLE_CHANGE')) {
    throw new Error('Forbidden: You do not have permission to change member roles');
  }

  if (newRole === 'OWNER') {
    throw new Error('Cannot assign OWNER role via role change. Use transfer workspace ownership.');
  }

  const db = getDatabase();
  const ws = db.prepare('SELECT * FROM team_workspaces WHERE id = ?').get(workspaceId) as any;
  if (!ws) throw new Error('Workspace not found');

  if (ws.owner_user_id === targetUserId) {
    throw new Error('Cannot modify the role of the workspace owner');
  }

  const targetMember = db.prepare(`
    SELECT * FROM team_workspace_members WHERE workspace_id = ? AND user_id = ? AND status = 'ACTIVE'
  `).get(workspaceId, targetUserId) as any;

  if (!targetMember) {
    throw new Error('Member not found in workspace');
  }

  const actorMember = getMemberRoleInWorkspace(actorUserId, workspaceId);
  if (!actorMember) throw new Error('Actor membership not found');

  // Non-owners cannot modify admins or owners
  if (actorMember.role !== 'OWNER' && (targetMember.role === 'ADMIN' || targetMember.role === 'OWNER')) {
    throw new Error('Forbidden: Insufficient privileges to change this member role');
  }

  db.prepare(`
    UPDATE team_workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?
  `).run(newRole, workspaceId, targetUserId);

  logWorkspaceAudit(
    workspaceId,
    actorUserId,
    'ROLE_CHANGED',
    `Changed role of user ${targetUserId} to ${newRole}`,
    targetUserId
  );

  return true;
}

export function removeWorkspaceMember(actorUserId: string, workspaceId: string, targetUserId: string): boolean {
  if (!hasWorkspacePermission(actorUserId, workspaceId, 'MEMBER_REMOVE')) {
    throw new Error('Forbidden: You do not have permission to remove members');
  }

  const db = getDatabase();
  const ws = db.prepare('SELECT * FROM team_workspaces WHERE id = ?').get(workspaceId) as any;
  if (!ws) throw new Error('Workspace not found');

  if (ws.owner_user_id === targetUserId) {
    throw new Error('Cannot remove the workspace owner');
  }

  const targetMember = db.prepare(`
    SELECT * FROM team_workspace_members WHERE workspace_id = ? AND user_id = ? AND status = 'ACTIVE'
  `).get(workspaceId, targetUserId) as any;

  if (!targetMember) {
    throw new Error('Member not found in workspace');
  }

  const actorMember = getMemberRoleInWorkspace(actorUserId, workspaceId);
  if (!actorMember) throw new Error('Actor membership not found');

  if (actorMember.role !== 'OWNER' && (targetMember.role === 'ADMIN' || targetMember.role === 'OWNER')) {
    throw new Error('Forbidden: Insufficient privileges to remove this member');
  }

  // Remove membership and associated member keys
  db.prepare('DELETE FROM team_workspace_members WHERE workspace_id = ? AND user_id = ?').run(
    workspaceId,
    targetUserId
  );
  db.prepare('DELETE FROM team_workspace_keys WHERE workspace_id = ? AND user_id = ?').run(
    workspaceId,
    targetUserId
  );

  logWorkspaceAudit(
    workspaceId,
    actorUserId,
    'MEMBER_REMOVED',
    `Removed user ${targetUserId} from workspace`,
    targetUserId
  );

  return true;
}

// ============================================================================
// INVITATION LIFECYCLE
// ============================================================================

export interface InviteMemberResult {
  invitationId: string;
  email: string;
  role: TeamRole;
  token: string;
  expiresAt: string;
}

export async function inviteWorkspaceMember(
  inviterUserId: string,
  workspaceId: string,
  email: string,
  role: TeamRole
): Promise<InviteMemberResult> {
  if (!hasWorkspacePermission(inviterUserId, workspaceId, 'MEMBER_INVITE')) {
    throw new Error('Forbidden: You do not have permission to invite members');
  }

  if (role === 'OWNER') {
    throw new Error('Cannot invite a user as OWNER');
  }

  const inviterMember = getMemberRoleInWorkspace(inviterUserId, workspaceId);
  if (!inviterMember) throw new Error('Inviter is not a member');

  // Managers can only invite MEMBER or VIEWER
  if (inviterMember.role === 'MANAGER' && (role === 'ADMIN' || role === 'MANAGER')) {
    throw new Error('Forbidden: Managers can only invite members with MEMBER or VIEWER roles');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Valid email address is required');
  }

  const db = getDatabase();
  const ws = db.prepare('SELECT name FROM team_workspaces WHERE id = ?').get(workspaceId) as any;
  if (!ws) throw new Error('Workspace not found');

  // Check if already an active member
  const existingUser = getCentralUserByEmail(normalizedEmail);
  if (existingUser) {
    const existingMember = db.prepare(`
      SELECT * FROM team_workspace_members WHERE workspace_id = ? AND user_id = ? AND status = 'ACTIVE'
    `).get(workspaceId, existingUser.id);
    if (existingMember) {
      throw new Error(`User with email "${normalizedEmail}" is already an active member of this workspace`);
    }
  }

  // Check if pending invitation exists
  const pendingInvite = db.prepare(`
    SELECT * FROM team_workspace_invitations
    WHERE workspace_id = ? AND email = ? AND status = 'PENDING' AND expires_at > ?
  `).get(workspaceId, normalizedEmail, new Date().toISOString()) as any;

  if (pendingInvite) {
    throw new Error(`A pending invitation for "${normalizedEmail}" already exists`);
  }

  // Generate cryptographically secure single-use token (256-bit)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const inviteId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.prepare(`
    INSERT INTO team_workspace_invitations (id, workspace_id, email, role, token_hash, invited_by, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(inviteId, workspaceId, normalizedEmail, role, tokenHash, inviterUserId, expiresAt, now.toISOString());

  const inviter = getCentralUserById(inviterUserId);
  const inviterName = inviter ? (inviter.name || inviter.email) : 'Team Admin';
  const inviteUrl = appUrl(`/invite?token=${rawToken}`, { productionFallback: true });

  await getEmailProvider().sendWorkspaceInvitationEmail(
    normalizedEmail,
    rawToken,
    ws.name,
    inviterName,
    inviteUrl
  );

  logWorkspaceAudit(
    workspaceId,
    inviterUserId,
    'MEMBER_INVITED',
    `Invited ${normalizedEmail} as ${role}`,
    inviteId
  );

  return {
    invitationId: inviteId,
    email: normalizedEmail,
    role,
    token: rawToken,
    expiresAt,
  };
}

export function listWorkspaceInvitations(userId: string, workspaceId: string): TeamWorkspaceInvitation[] {
  if (!hasWorkspacePermission(userId, workspaceId, 'WORKSPACE_VIEW')) {
    throw new Error('Forbidden: You do not have permission to view invitations');
  }

  const db = getDatabase();
  const rows = db.prepare(`
    SELECT i.*, w.name as workspace_name, u.name as invited_by_name
    FROM team_workspace_invitations i
    JOIN team_workspaces w ON i.workspace_id = w.id
    LEFT JOIN auth_users u ON i.invited_by = u.id
    WHERE i.workspace_id = ? AND i.status = 'PENDING'
    ORDER BY i.created_at DESC
  `).all(workspaceId) as any[];

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name,
    email: r.email,
    role: r.role as TeamRole,
    invitedBy: r.invited_by,
    invitedByName: r.invited_by_name || 'Team Admin',
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

export function revokeWorkspaceInvitation(userId: string, workspaceId: string, invitationId: string): boolean {
  if (!hasWorkspacePermission(userId, workspaceId, 'MEMBER_INVITE')) {
    throw new Error('Forbidden: You do not have permission to revoke invitations');
  }

  const db = getDatabase();
  const invite = db.prepare(`
    SELECT * FROM team_workspace_invitations WHERE id = ? AND workspace_id = ?
  `).get(invitationId, workspaceId) as any;

  if (!invite) throw new Error('Invitation not found');
  if (invite.status !== 'PENDING') throw new Error(`Invitation is already ${invite.status}`);

  db.prepare(`
    UPDATE team_workspace_invitations SET status = 'REVOKED' WHERE id = ?
  `).run(invitationId);

  logWorkspaceAudit(workspaceId, userId, 'INVITE_REVOKED', `Revoked invitation for ${invite.email}`, invitationId);
  return true;
}

export function acceptWorkspaceInvitation(
  userId: string,
  rawToken: string
): { success: boolean; workspaceId: string; role: TeamRole } {
  const user = getCentralUserById(userId);
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('User not found or account is not active');
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const db = getDatabase();
  const invite = db.prepare(`
    SELECT * FROM team_workspace_invitations WHERE token_hash = ?
  `).get(tokenHash) as any;

  if (!invite) {
    throw new Error('Invalid invitation token');
  }

  if (invite.status === 'REVOKED') {
    throw new Error('This invitation has been revoked');
  }

  if (invite.status === 'ACCEPTED') {
    throw new Error('This invitation has already been accepted');
  }

  const now = new Date();
  if (new Date(invite.expires_at) < now) {
    db.prepare("UPDATE team_workspace_invitations SET status = 'EXPIRED' WHERE id = ?").run(invite.id);
    throw new Error('This invitation has expired');
  }

  // Security check: Verify recipient email matches logged-in user
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error(`Invitation was sent to ${invite.email}. Please log in with that account to accept.`);
  }

  // Check if already an active member
  const existingMember = db.prepare(`
    SELECT * FROM team_workspace_members WHERE workspace_id = ? AND user_id = ?
  `).get(invite.workspace_id, user.id) as any;

  if (existingMember && existingMember.status === 'ACTIVE') {
    db.prepare("UPDATE team_workspace_invitations SET status = 'ACCEPTED' WHERE id = ?").run(invite.id);
    return { success: true, workspaceId: invite.workspace_id, role: existingMember.role as TeamRole };
  }

  const memberId = existingMember ? existingMember.id : crypto.randomUUID();
  const joinedAt = now.toISOString();

  if (existingMember) {
    db.prepare(`
      UPDATE team_workspace_members
      SET role = ?, status = 'ACTIVE', joined_at = ?, invited_by = ?
      WHERE id = ?
    `).run(invite.role, joinedAt, invite.invited_by, memberId);
  } else {
    db.prepare(`
      INSERT INTO team_workspace_members (id, workspace_id, user_id, role, status, invited_by, joined_at, created_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(memberId, invite.workspace_id, user.id, invite.role, invite.invited_by, joinedAt, joinedAt);
  }

  db.prepare("UPDATE team_workspace_invitations SET status = 'ACCEPTED' WHERE id = ?").run(invite.id);

  logWorkspaceAudit(
    invite.workspace_id,
    user.id,
    'INVITE_ACCEPTED',
    `${user.email} joined workspace as ${invite.role}`,
    invite.id
  );

  return { success: true, workspaceId: invite.workspace_id, role: invite.role as TeamRole };
}

// ============================================================================
// PROFILE SHARING & ACCESS ENFORCEMENT
// ============================================================================

export interface ShareProfileInput {
  cloudProfileId: string;
  permissionLevel?: 'VIEW' | 'RUN' | 'EDIT' | 'ADMIN';
  encryptedKeyEnvelope: string;
}

export function shareProfileToWorkspace(
  userId: string,
  workspaceId: string,
  input: ShareProfileInput
): TeamProfileShare {
  if (!hasWorkspacePermission(userId, workspaceId, 'PROFILE_SHARE')) {
    throw new Error('Forbidden: You do not have permission to share profiles in this workspace');
  }

  const db = getDatabase();
  // Profile must exist
  const profile = db.prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `).get(input.cloudProfileId) as any;

  if (!profile) {
    throw new Error('Cloud profile not found');
  }

  // Must either be owner of the profile, or have ADMIN/OWNER role in the workspace
  const member = getMemberRoleInWorkspace(userId, workspaceId);
  if (profile.owner_id !== userId && member?.role !== 'OWNER' && member?.role !== 'ADMIN') {
    throw new Error('Forbidden: You can only share profiles that you own or manage');
  }

  const perm = input.permissionLevel || 'RUN';
  const now = new Date().toISOString();

  const existingShare = db.prepare(`
    SELECT * FROM team_profile_shares WHERE workspace_id = ? AND cloud_profile_id = ?
  `).get(workspaceId, input.cloudProfileId) as any;

  let shareId: string;
  if (existingShare) {
    shareId = existingShare.id;
    db.prepare(`
      UPDATE team_profile_shares
      SET shared_by = ?, permission_level = ?, encrypted_key_envelope = ?, revoked_at = NULL, created_at = ?
      WHERE id = ?
    `).run(userId, perm, input.encryptedKeyEnvelope, now, shareId);
  } else {
    shareId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO team_profile_shares (id, workspace_id, cloud_profile_id, shared_by, permission_level, encrypted_key_envelope, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(shareId, workspaceId, input.cloudProfileId, userId, perm, input.encryptedKeyEnvelope, now);
  }

  logWorkspaceAudit(
    workspaceId,
    userId,
    'PROFILE_SHARED',
    `Shared profile "${profile.name}" (${profile.id}) with permission ${perm}`,
    input.cloudProfileId
  );

  return {
    id: shareId,
    workspaceId,
    cloudProfileId: input.cloudProfileId,
    profileName: profile.name,
    sharedBy: userId,
    permissionLevel: perm,
    encryptedKeyEnvelope: input.encryptedKeyEnvelope,
    createdAt: now,
  };
}

export function revokeProfileShare(userId: string, workspaceId: string, cloudProfileId: string): boolean {
  if (!hasWorkspacePermission(userId, workspaceId, 'PROFILE_SHARE')) {
    throw new Error('Forbidden: You do not have permission to revoke profile shares');
  }

  const db = getDatabase();
  const share = db.prepare(`
    SELECT * FROM team_profile_shares WHERE workspace_id = ? AND cloud_profile_id = ? AND revoked_at IS NULL
  `).get(workspaceId, cloudProfileId) as any;

  if (!share) throw new Error('Active profile share not found');

  db.prepare(`
    UPDATE team_profile_shares SET revoked_at = ? WHERE id = ?
  `).run(new Date().toISOString(), share.id);

  logWorkspaceAudit(
    workspaceId,
    userId,
    'SHARE_REVOKED',
    `Revoked share for profile ${cloudProfileId}`,
    cloudProfileId
  );

  return true;
}

export function listWorkspaceProfiles(userId: string, workspaceId: string): TeamProfileShare[] {
  if (!hasWorkspacePermission(userId, workspaceId, 'PROFILE_VIEW')) {
    throw new Error('Forbidden: You do not have permission to view profiles in this workspace');
  }

  const db = getDatabase();
  const rows = db.prepare(`
    SELECT s.*, p.name as profile_name, u.name as shared_by_name,
      l.device_name as locked_by_device, l.expires_at as lock_expires_at
    FROM team_profile_shares s
    JOIN cloud_profiles p ON s.cloud_profile_id = p.id
    LEFT JOIN auth_users u ON s.shared_by = u.id
    LEFT JOIN cloud_profile_locks l ON s.cloud_profile_id = l.cloud_profile_id AND l.expires_at > ?
    WHERE s.workspace_id = ? AND s.revoked_at IS NULL AND p.status != 'DELETED'
    ORDER BY s.created_at DESC
  `).all(new Date().toISOString(), workspaceId) as any[];

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    cloudProfileId: r.cloud_profile_id,
    profileName: r.profile_name,
    sharedBy: r.shared_by,
    sharedByName: r.shared_by_name || 'Teammate',
    permissionLevel: r.permission_level,
    encryptedKeyEnvelope: r.encrypted_key_envelope,
    createdAt: r.created_at,
    lockStatus: {
      isLocked: Boolean(r.locked_by_device),
      lockedByDevice: r.locked_by_device || undefined,
      expiresAt: r.lock_expires_at || undefined,
    },
  }));
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export function getWorkspaceAuditLogs(
  userId: string,
  workspaceId: string,
  limit = 50
): TeamWorkspaceAuditLog[] {
  if (!hasWorkspacePermission(userId, workspaceId, 'AUDIT_VIEW')) {
    throw new Error('Forbidden: You do not have permission to view audit logs');
  }

  const db = getDatabase();
  const rows = db.prepare(`
    SELECT a.*, u.email as user_email
    FROM team_workspace_audit_logs a
    LEFT JOIN auth_users u ON a.user_id = u.id
    WHERE a.workspace_id = ?
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(workspaceId, limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    userEmail: r.user_email || undefined,
    action: r.action,
    targetId: r.target_id || undefined,
    details: r.details || undefined,
    createdAt: r.created_at,
  }));
}

// ============================================================================
// WORKSPACE KEYS (ZERO-KNOWLEDGE ENVELOPES)
// ============================================================================

export function setWorkspaceKeyEnvelope(
  userId: string,
  workspaceId: string,
  targetUserId: string,
  encryptedKey: string
): boolean {
  if (!hasWorkspacePermission(userId, workspaceId, 'MEMBER_INVITE')) {
    throw new Error('Forbidden: Cannot manage workspace key envelopes');
  }

  const db = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO team_workspace_keys (id, workspace_id, user_id, encrypted_workspace_key, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, user_id) DO UPDATE SET encrypted_workspace_key = excluded.encrypted_workspace_key
  `).run(id, workspaceId, targetUserId, encryptedKey, now);

  return true;
}

export function getWorkspaceKeyEnvelope(userId: string, workspaceId: string): string | null {
  const member = getMemberRoleInWorkspace(userId, workspaceId);
  if (!member || member.status !== 'ACTIVE') {
    return null;
  }

  const db = getDatabase();
  const row = db.prepare(`
    SELECT encrypted_workspace_key FROM team_workspace_keys
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, userId) as { encrypted_workspace_key: string } | undefined;

  return row ? row.encrypted_workspace_key : null;
}
