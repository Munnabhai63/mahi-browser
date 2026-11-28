import { ipcMain } from '../../../08_SECURITY/electron-bridge.js';
import { createFolder, deleteFolder, getFolders, updateFolder } from '../../../02_BROWSER/services/folder-service.js';
import { acquireProfileLock, getProfileLock, releaseProfileLock } from '../../../02_BROWSER/services/profile-lock-service.js';
import {
  addWorkspaceMember,
  assignProfileToMember,
  createWorkspace,
  deleteWorkspace,
  deleteWorkspaceMember,
  exportWorkspaceBundle,
  getActiveWorkspaceId,
  getWorkspaceById,
  getWorkspaceMembers,
  getWorkspaces,
  importWorkspaceBundle,
  setActiveWorkspaceId,
  updateMemberRole,
  updateWorkspace,
} from '../../../02_BROWSER/services/workspace-service.js';
import { getAccountSession } from '../../../08_SECURITY/account-service.js';
import { assertCapability } from '../../../08_SECURITY/freemium-guard.js';
import { sanitizeError } from '../../../08_SECURITY/sanitizer.js';
import { getActiveUserId } from '../../commercial/session-context.js';
import {
  acceptWorkspaceInvitation,
  createTeamWorkspace,
  deleteTeamWorkspace,
  getTeamWorkspace,
  getWorkspaceAuditLogs,
  getWorkspaceMembers as getTeamWorkspaceMembers,
  inviteWorkspaceMember,
  listUserTeamWorkspaces,
  listWorkspaceInvitations,
  listWorkspaceProfiles,
  removeWorkspaceMember as removeTeamWorkspaceMember,
  revokeProfileShare,
  revokeWorkspaceInvitation,
  shareProfileToWorkspace,
  transferWorkspaceOwnership,
  updateMemberRole as updateTeamMemberRole,
  updateTeamWorkspace,
} from '../../services/team-workspace-service.js';

export function registerWorkspaceIpcHandlers(): void {
  // WORKSPACES & TEAM COLLABORATION
  ipcMain.handle('workspace:getAll', async () => {
    try {
      return getWorkspaces();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:getById', async (_event, id: string) => {
    try {
      return getWorkspaceById(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:create', async (_event, dto) => {
    try {
      return createWorkspace(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:update', async (_event, id: string, dto) => {
    try {
      return updateWorkspace(id, dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:delete', async (_event, id: string) => {
    try {
      return deleteWorkspace(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:getActive', async () => {
    try {
      return getActiveWorkspaceId();
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:setActive', async (_event, id: string) => {
    try {
      return setActiveWorkspaceId(id);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:getMembers', async (_event, workspaceId: string) => {
    try {
      return getWorkspaceMembers(workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:addMember', async (_event, dto) => {
    try {
      return addWorkspaceMember(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:updateMemberRole', async (_event, memberId: string, role) => {
    try {
      return updateMemberRole(memberId, role);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:deleteMember', async (_event, memberId: string) => {
    try {
      return deleteWorkspaceMember(memberId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:assignProfile', async (_event, profileId: string, workspaceId: string, memberId: string | null) => {
    try {
      return assignProfileToMember(profileId, workspaceId, memberId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:exportBundle', async (_event, options) => {
    try {
      return await exportWorkspaceBundle(options);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('workspace:importBundle', async (_event, bundleJson: string, targetWorkspaceId?: string) => {
    try {
      return await importWorkspaceBundle(bundleJson, targetWorkspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // PHASE 3 MULTI-USER TEAM WORKSPACES & RBAC
  ipcMain.handle('teamWorkspace:list', async () => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) return [];
      return listUserTeamWorkspaces(userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:create', async (_event, input) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required to create a team workspace');
      assertCapability('workspace.team');
      return createTeamWorkspace(userId, input);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:get', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) return null;
      return getTeamWorkspace(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:update', async (_event, workspaceId: string, updates) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return updateTeamWorkspace(userId, workspaceId, updates);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:delete', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return deleteTeamWorkspace(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:transferOwnership', async (_event, workspaceId: string, newOwnerId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return transferWorkspaceOwnership(userId, workspaceId, newOwnerId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:getMembers', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return getTeamWorkspaceMembers(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:inviteMember', async (_event, workspaceId: string, email: string, role) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return await inviteWorkspaceMember(userId, workspaceId, email, role);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:updateMemberRole', async (_event, workspaceId: string, memberUserId: string, role) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return updateTeamMemberRole(userId, workspaceId, memberUserId, role);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:removeMember', async (_event, workspaceId: string, memberUserId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return removeTeamWorkspaceMember(userId, workspaceId, memberUserId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:listInvitations', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return listWorkspaceInvitations(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:revokeInvitation', async (_event, workspaceId: string, inviteId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return revokeWorkspaceInvitation(userId, workspaceId, inviteId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:acceptInvitation', async (_event, token: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required to accept an invitation');
      return acceptWorkspaceInvitation(userId, token);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:listProfiles', async (_event, workspaceId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return listWorkspaceProfiles(userId, workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:shareProfile', async (_event, workspaceId: string, input) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      assertCapability('workspace.sharing');
      return shareProfileToWorkspace(userId, workspaceId, input);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:revokeProfileShare', async (_event, workspaceId: string, cloudProfileId: string) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return revokeProfileShare(userId, workspaceId, cloudProfileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('teamWorkspace:getAuditLogs', async (_event, workspaceId: string, limit?: number) => {
    try {
      const session = getAccountSession();
      const userId = getActiveUserId() || session?.account_id;
      if (!userId) throw new Error('Authentication required');
      return getWorkspaceAuditLogs(userId, workspaceId, limit);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  // Folders & Locks
  ipcMain.handle('folders:get', async (_event, workspaceId?: string) => {
    try {
      return getFolders(workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('folders:create', async (_event, dto: { name: string; parentId?: string | null; color?: string; icon?: string; workspaceId?: string }) => {
    try {
      return createFolder(dto.name, dto.parentId, dto.color, dto.icon, dto.workspaceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('folders:update', async (_event, id: string, updates: { name?: string; parentId?: string | null; color?: string; icon?: string }) => {
    try {
      return updateFolder(id, updates);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('folders:delete', async (_event, id: string, targetFolderName?: string) => {
    try {
      return deleteFolder(id, targetFolderName);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profileLock:get', async (_event, profileId: string) => {
    try {
      return getProfileLock(profileId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profileLock:acquire', async (_event, profileId: string, userId: string, userName: string, deviceId: string) => {
    try {
      return acquireProfileLock(profileId, userId, userName, deviceId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });

  ipcMain.handle('profileLock:release', async (_event, profileId: string, userId?: string) => {
    try {
      return releaseProfileLock(profileId, userId);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });
}
