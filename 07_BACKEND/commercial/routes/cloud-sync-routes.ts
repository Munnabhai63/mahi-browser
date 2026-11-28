import type http from 'node:http';
import type { URL } from 'node:url';
import { sendJSON, parseBody, parseRawBuffer, getAuthUserAsync } from './router-shared.js';
import { getErrorStatusCode } from '../../utils/http-security.js';
import { sendSafeError, validateStrictBody } from '../../utils/app-error.js';
import type { TeamRole } from '../../../10_CONFIG/shared/types/workspace.js';
import {
  SyncUploadSessionSchema,
  SyncFinalizeUploadSchema,
  SyncDownloadSessionSchema,
  SyncLockAcquireSchema,
  SyncLockRenewSchema,
  SyncLockReleaseSchema,
  CreateWorkspaceSchema,
  AcceptWorkspaceInvitationSchema,
  UpdateWorkspaceSchema,
  TransferWorkspaceOwnershipSchema,
  InviteWorkspaceMemberSchema,
  UpdateWorkspaceMemberRoleSchema,
  ShareProfileToWorkspaceSchema,
  SetWorkspaceKeyEnvelopeSchema,
} from '../validation/commercial-schemas.js';
import { getStorageProvider, LocalStorageProvider } from '../../../08_SECURITY/storage-provider.js';
import { rejectIfEmergencyFrozen } from '../../services/kill-switch-service.js';
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
  _pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  _clientIp: string
): Promise<boolean> {
  if (routePath.startsWith('/api/v1/sync') || routePath.startsWith('/api/v1/storage')) {
    if (await rejectIfEmergencyFrozen(res, 'cloud_sync')) return true;
  }

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
      const buffer = await parseRawBuffer(req, { maxBytes: 250 * 1024 * 1024, timeoutMs: 120_000 });
      const putResult = await storage.putObject(key, buffer);
      sendJSON(res, 200, { success: true, size: putResult.size });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: getErrorStatusCode(err) });
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
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 500 });
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
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 500 });
    }
    return true;
  }

  // -------------------------------------------------------------
  // 14. PHASE 2 CLOUD PROFILE SYNC ENDPOINTS (Protected)
  // -------------------------------------------------------------
  if (routePath === '/api/v1/sync/usage' && method === 'GET') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Login required for cloud sync.' });
      return true;
    }
    const usage = getUserSyncUsage(user.userId);
    sendJSON(res, 200, { success: true, ...usage });
    return true;
  }

  if (routePath === '/api/v1/sync/list' && method === 'GET') {
    const user = await getAuthUserAsync(req);
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
    const user = await getAuthUserAsync(req);
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
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      await deleteCloudProfile(user.userId, syncProfileDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 404 });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/upload-session' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(SyncUploadSessionSchema, rawBody, res);
      if (!parsed.ok) return true;
      const result = await createUploadSession(user.userId, parsed.data);
      if (result.conflict) {
        sendJSON(res, 409, { success: false, ...result });
      } else {
        sendJSON(res, 200, { success: true, ...result });
      }
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/finalize-upload' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(SyncFinalizeUploadSchema, rawBody, res);
      if (!parsed.ok) return true;
      const body = parsed.data;
      const result = await finalizeUploadSession(
        user.userId,
        body.sessionId,
        body.profileName || '',
        body.localProfileId || '',
        body.deviceId || '',
        body.deviceName
      );
      sendJSON(res, 200, result);
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/download-session' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(SyncDownloadSessionSchema, rawBody, res);
      if (!parsed.ok) return true;
      const body = parsed.data;
      const mode = body.mode === 'cookies_only' ? 'cookies_only' : body.mode === 'full' ? 'full' : undefined;
      const result = await createDownloadSession(user.userId, body.cloudProfileId, body.version, {
        mode,
      });
      sendJSON(res, 200, { success: true, data: result });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 404 });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/acquire' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(SyncLockAcquireSchema, rawBody, res);
      if (!parsed.ok) return true;
      const body = parsed.data;
      const result = await acquireProfileLockAsync(
        user.userId,
        body.cloudProfileId,
        body.deviceId,
        body.deviceName || 'Unknown Device',
        body.ttlSeconds
      );
      sendJSON(res, result.acquired ? 200 : 423, result);
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/renew' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(SyncLockRenewSchema, rawBody, res);
      if (!parsed.ok) return true;
      const body = parsed.data;
      const result = await renewProfileLockAsync(user.userId, body.cloudProfileId, body.deviceId, body.ttlSeconds);
      sendJSON(res, 200, result);
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/release' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(SyncLockReleaseSchema, rawBody, res);
      if (!parsed.ok) return true;
      const body = parsed.data;
      const result = await releaseProfileLockAsync(user.userId, body.cloudProfileId, body.deviceId);
      sendJSON(res, 200, result);
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  if (routePath === '/api/v1/sync/lock/status' && method === 'GET') {
    const user = await getAuthUserAsync(req);
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
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized. Central login required.' });
      return true;
    }
    const workspaces = listUserTeamWorkspaces(user.userId);
    sendJSON(res, 200, { success: true, workspaces });
    return true;
  }

  if (routePath === '/api/v1/workspaces' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(CreateWorkspaceSchema, rawBody, res);
      if (!parsed.ok) return true;
      const ws = createTeamWorkspace(user.userId, parsed.data);
      sendJSON(res, 201, { success: true, workspace: ws });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  if (routePath === '/api/v1/workspaces/invitations/accept' && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(AcceptWorkspaceInvitationSchema, rawBody, res);
      if (!parsed.ok) return true;
      const result = acceptWorkspaceInvitation(user.userId, parsed.data.token);
      sendJSON(res, 200, result);
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const wsDetailMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)$/);
  if (wsDetailMatch && method === 'GET') {
    const user = await getAuthUserAsync(req);
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
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(UpdateWorkspaceSchema, rawBody, res);
      if (!parsed.ok) return true;
      const updated = updateTeamWorkspace(user.userId, wsDetailMatch[1], parsed.data);
      sendJSON(res, 200, { success: true, workspace: updated });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  if (wsDetailMatch && method === 'DELETE') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      deleteTeamWorkspace(user.userId, wsDetailMatch[1]);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsTransferMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/transfer-ownership$/);
  if (wsTransferMatch && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(TransferWorkspaceOwnershipSchema, rawBody, res);
      if (!parsed.ok) return true;
      transferWorkspaceOwnership(user.userId, wsTransferMatch[1], parsed.data.newOwnerUserId);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsMembersMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members$/);
  if (wsMembersMatch && method === 'GET') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const members = getWorkspaceMembers(user.userId, wsMembersMatch[1]);
      sendJSON(res, 200, { success: true, members });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/invite$/);
  if (wsInviteMatch && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(InviteWorkspaceMemberSchema, rawBody, res);
      if (!parsed.ok) return true;
      const result = await inviteWorkspaceMember(user.userId, wsInviteMatch[1], parsed.data.email, parsed.data.role as TeamRole);
      sendJSON(res, 201, { success: true, invitation: result });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const wsRoleMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)\/role$/);
  if (wsRoleMatch && method === 'PUT') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(UpdateWorkspaceMemberRoleSchema, rawBody, res);
      if (!parsed.ok) return true;
      updateMemberRole(user.userId, wsRoleMatch[1], wsRoleMatch[2], parsed.data.role as TeamRole);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsRemoveMemberMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
  if (wsRemoveMemberMatch && method === 'DELETE') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      removeWorkspaceMember(user.userId, wsRemoveMemberMatch[1], wsRemoveMemberMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsListInvitesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations$/);
  if (wsListInvitesMatch && method === 'GET') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const invitations = listWorkspaceInvitations(user.userId, wsListInvitesMatch[1]);
      sendJSON(res, 200, { success: true, invitations });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsRevokeInviteMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/invitations\/([a-zA-Z0-9_-]+)\/revoke$/);
  if (wsRevokeInviteMatch && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeWorkspaceInvitation(user.userId, wsRevokeInviteMatch[1], wsRevokeInviteMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const wsProfilesMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles$/);
  if (wsProfilesMatch && method === 'GET') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const profiles = listWorkspaceProfiles(user.userId, wsProfilesMatch[1]);
      sendJSON(res, 200, { success: true, profiles });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/share$/);
  if (wsShareMatch && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(ShareProfileToWorkspaceSchema, rawBody, res);
      if (!parsed.ok) return true;
      const share = shareProfileToWorkspace(user.userId, wsShareMatch[1], parsed.data);
      sendJSON(res, 200, { success: true, share });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const wsRevokeShareMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/profiles\/([a-zA-Z0-9_-]+)\/share$/);
  if (wsRevokeShareMatch && method === 'DELETE') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      revokeProfileShare(user.userId, wsRevokeShareMatch[1], wsRevokeShareMatch[2]);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  const wsAuditMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/audit-logs$/);
  if (wsAuditMatch && method === 'GET') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
      const logs = getWorkspaceAuditLogs(user.userId, wsAuditMatch[1], limit);
      sendJSON(res, 200, { success: true, logs });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 403 });
    }
    return true;
  }

  const wsKeyMatch = routePath.match(/^\/api\/v1\/workspaces\/([a-zA-Z0-9_-]+)\/key$/);
  if (wsKeyMatch && method === 'GET') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    const envelope = getWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1]);
    sendJSON(res, 200, { success: true, keyEnvelope: envelope });
    return true;
  }

  if (wsKeyMatch && method === 'POST') {
    const user = await getAuthUserAsync(req);
    if (!user) {
      sendJSON(res, 401, { success: false, error: 'Unauthorized.' });
      return true;
    }
    try {
      const rawBody = await parseBody(req);
      const parsed = validateStrictBody(SetWorkspaceKeyEnvelopeSchema, rawBody, res);
      if (!parsed.ok) return true;
      setWorkspaceKeyEnvelope(user.userId, wsKeyMatch[1], parsed.data.targetUserId, parsed.data.encryptedKey);
      sendJSON(res, 200, { success: true });
    } catch (err: unknown) {
      sendSafeError(res, err, { fallbackStatus: 400 });
    }
    return true;
  }

  return false;
}
