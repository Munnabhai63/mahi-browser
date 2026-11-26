import http from 'node:http';
import { URL } from 'node:url';
import { sendJSON, parseBody, parseRawBuffer, getAuthUser } from './router-shared.js';
import { getStorageProvider, LocalStorageProvider } from '../../../08_SECURITY/storage-provider.js';
import {
  getUserSyncUsage,
  listUserCloudProfilesAsync,
  getCloudProfileAsync,
  createUploadSession,
  finalizeUploadSession,
  createDownloadSession,
  deleteCloudProfile,
  acquireProfileLockAsync,
  renewProfileLockAsync,
  releaseProfileLockAsync,
  getProfileLockStatusAsync,
} from '../../services/cloud-profile-service.js';
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
  getWorkspaceKeyEnvelope,
  setWorkspaceKeyEnvelope,
} from '../../services/team-workspace-service.js';

export async function handleCloudSyncRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
): Promise<boolean> {
  if (routePath === '/api/v1/storage/upload' && method === 'PUT') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (!(storage instanceof LocalStorageProvider)) {
      sendJSON(res, 403, { success: false, error: 'Direct storage upload endpoint is disabled for remote providers' });
      return true;
    }
    const valid = storage.verifyToken(key, 'upload', expires, token);
    if (!valid) {
      sendJSON(res, 403, { success: false, error: 'Invalid or expired upload signature' });
      return true;
    }

    try {
      const buffer = await parseRawBuffer(req);
      const putResult = await storage.putObject(key, buffer);
      sendJSON(res, 200, { success: true, size: putResult.size });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/storage/download' && method === 'GET') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (!(storage instanceof LocalStorageProvider)) {
      sendJSON(res, 403, { success: false, error: 'Direct storage download endpoint is disabled for remote providers' });
      return true;
    }
    const valid = storage.verifyToken(key, 'download', expires, token);
    if (!valid) {
      sendJSON(res, 403, { success: false, error: 'Invalid or expired download signature' });
      return true;
    }

    try {
      const buffer = await storage.getObject(key);
      if (!buffer) {
        sendJSON(res, 404, { success: false, error: 'Object not found' });
        return true;
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/storage/delete' && method === 'DELETE') {
    const key = parsedUrl.searchParams.get('key');
    const expires = parseInt(parsedUrl.searchParams.get('expires') || '0', 10);
    const token = parsedUrl.searchParams.get('token') || '';
    if (!key || !token) {
      sendJSON(res, 400, { success: false, error: 'Missing storage parameters' });
      return true;
    }

    const storage = getStorageProvider();
    if (!(storage instanceof LocalStorageProvider)) {
      sendJSON(res, 403, { success: false, error: 'Direct storage delete endpoint is disabled for remote providers' });
      return true;
    }
    const valid = storage.verifyToken(key, 'delete', expires, token);
    if (!valid) {
      sendJSON(res, 403, { success: false, error: 'Invalid or expired signature' });
      return true;
    }

    try {
      const deleted = await storage.deleteObject(key);
      sendJSON(res, deleted ? 200 : 404, { success: deleted });
    } catch (err: any) {
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return true;
  }

  // -------------------------------------------------------------
  // 14. PHASE 2 CLOUD PROFILE SYNC ENDPOINTS (Protected)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/sync/usage' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Login required for cloud sync.' });
      return true;
    }
    const usage = getUserSyncUsage(user.userId);
    sendJSON(res, 200, { success: true, ...usage });
    return true;
  }

  if (routePath === '/api/v1/sync/list' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profiles = await listUserCloudProfilesAsync(user.userId);
    sendJSON(res, 200, { success: true, profiles });
    return true;
  }

  const syncProfileDetailMatch = routePath.match(/^\/api\/v1\/sync\/profiles?\/([a-zA-Z0-9_-]+)$/);
  if (syncProfileDetailMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profile = await getCloudProfileAsync(user.userId, syncProfileDetailMatch[1]);
    if (!profile) {
      sendJSON(res, 404, { success: false, error: 'Cloud profile not found' });
      return true;
    }
    sendJSON(res, 200, { success: true, profile });
    return true;
  }

  if (syncProfileDetailMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      await deleteCloudProfile(user.userId, syncProfileDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/upload-session' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await createUploadSession(user.userId, body);
      if (result.conflict) {
        sendJSON(res, 409, { success: false, ...result });
      } else {
        sendJSON(res, 200, { success: true, ...result });
      }
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/finalize-upload' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await finalizeUploadSession(
        user.userId,
        body.sessionId,
        body.profileName,
        body.localProfileId,
        body.deviceId,
        body.deviceName
      );
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/download-session' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await createDownloadSession(user.userId, body.cloudProfileId, body.version, {
        mode: body.mode,
      });
      sendJSON(res, 200, { success: true, data: result });
    } catch (err: any) {
      sendJSON(res, 404, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/acquire' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await acquireProfileLockAsync(
        user.userId,
        body.cloudProfileId,
        body.deviceId,
        body.deviceName,
        body.ttlSeconds
      );
      sendJSON(res, result.acquired ? 200 : 423, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/renew' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await renewProfileLockAsync(user.userId, body.cloudProfileId, body.deviceId, body.ttlSeconds);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/release' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await releaseProfileLockAsync(user.userId, body.cloudProfileId, body.deviceId);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/status' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const profileId = parsedUrl.searchParams.get('cloudProfileId') || '';
    const status = await getProfileLockStatusAsync(user.userId, profileId);
    sendJSON(res, 200, { success: true, data: status });
    return true;
  }

  // -------------------------------------------------------------
  // 15. PHASE 3 TEAM WORKSPACES & RBAC ENDPOINTS (Protected)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/workspaces' && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Central login required.' });
      return true;
    }
    const workspaces = listUserTeamWorkspaces(user.userId);
    sendJSON(res, 200, { success: true, workspaces });
    return true;
  }

  if (routePath === '/api/v1/workspaces' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const ws = createTeamWorkspace(user.userId, body);
      sendJSON(res, 201, { success: true, workspace: ws });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  if (routePath === '/api/v1/workspaces/invitations/accept' && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = acceptWorkspaceInvitation(user.userId, body.token);
      sendJSON(res, 200, result);
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsDetailMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)$/);
  if (wsDetailMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const ws = getTeamWorkspace(user.userId, wsDetailMatch[1]);
    if (!ws) {
      sendJSON(res, 404, { success: false, error: 'Workspace not found or access denied.' });
      return true;
    }
    sendJSON(res, 200, { success: true, workspace: ws });
    return true;
  }

  if (wsDetailMatch && method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const updated = updateTeamWorkspace(user.userId, wsDetailMatch[1], body);
      sendJSON(res, 200, { success: true, workspace: updated });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  if (wsDetailMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      deleteTeamWorkspace(user.userId, wsDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsTransferMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/transfer-ownership$/);
  if (wsTransferMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      transferWorkspaceOwnership(user.userId, wsTransferMatch[1], body.newOwnerUserId);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsMembersMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members$/);
  if (wsMembersMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const members = getWorkspaceMembers(user.userId, wsMembersMatch[1]);
      sendJSON(res, 200, { success: true, members });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/invite$/);
  if (wsInviteMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const result = await inviteWorkspaceMember(user.userId, wsInviteMatch[1], body.email, body.role);
      sendJSON(res, 201, { success: true, invitation: result });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsRoleMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)\/role$/);
  if (wsRoleMatch && method === 'PUT') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      updateMemberRole(user.userId, wsRoleMatch[1], wsRoleMatch[2], body.role);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsRemoveMemberMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
  if (wsRemoveMemberMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      removeWorkspaceMember(user.userId, wsRemoveMemberMatch[1], wsRemoveMemberMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsListInvitesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations$/);
  if (wsListInvitesMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const invitations = listWorkspaceInvitations(user.userId, wsListInvitesMatch[1]);
      sendJSON(res, 200, { success: true, invitations });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsRevokeInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations\/([a-zA-Z0-9_-]+)\/revoke$/);
  if (wsRevokeInviteMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeWorkspaceInvitation(user.userId, wsRevokeInviteMatch[1], wsRevokeInviteMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsProfilesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles$/);
  if (wsProfilesMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const profiles = listWorkspaceProfiles(user.userId, wsProfilesMatch[1]);
      sendJSON(res, 200, { success: true, profiles });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/share$/);
  if (wsShareMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      const share = shareProfileToWorkspace(user.userId, wsShareMatch[1], body);
      sendJSON(res, 200, { success: true, share });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsRevokeShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/([a-zA-Z0-9_-]+)\/share$/);
  if (wsRevokeShareMatch && method === 'DELETE') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeProfileShare(user.userId, wsRevokeShareMatch[1], wsRevokeShareMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  const wsAuditMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/audit-logs$/);
  if (wsAuditMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
      const logs = getWorkspaceAuditLogs(user.userId, wsAuditMatch[1], limit);
      sendJSON(res, 200, { success: true, logs });
    } catch (err: any) {
      sendJSON(res, 403, { success: false, error: err.message });
    }
    return true;
  }

  const wsKeyMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/key$/);
  if (wsKeyMatch && method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const envelope = getWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1]);
    sendJSON(res, 200, { success: true, keyEnvelope: envelope });
    return true;
  }

  if (wsKeyMatch && method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const body = await parseBody(req);
      setWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1], body.targetUserId, body.encryptedKey);
      sendJSON(res, 200, { success: true });
    } catch (err: any) {
      sendJSON(res, 400, { success: false, error: err.message });
    }
    return true;
  }

  return false;
}
