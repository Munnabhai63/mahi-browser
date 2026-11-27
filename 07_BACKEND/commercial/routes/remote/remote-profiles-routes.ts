import crypto from 'node:crypto';
import { saveIdempotentResponse } from '../../../services/remote-api-service.js';
import { isPostgresConfigured, getCentralRepository } from '../../../../06_DATABASE/central-repository.js';
import { getUserDevices } from '../../commercial-device-service.js';
import {
  getProfiles,
  createProfile,
  getProfileById,
  updateProfile,
  deleteProfile,
} from '../../../../02_BROWSER/services/profile-service.js';
import {
  createTeamWorkspace,
  listUserTeamWorkspaces,
  getWorkspaceMembers,
  inviteWorkspaceMember,
  updateMemberRole,
  removeWorkspaceMember,
  shareProfileToWorkspace,
  listWorkspaceProfiles,
} from '../../../services/team-workspace-service.js';
import { canCreateProfile } from '../../commercial-entitlement-service.js';
import { CreateRemoteApiKeyDTO } from '../../../../10_CONFIG/shared/types/remote-api.js';
import { parseBody, sendRemoteJSON, RemoteRouteContext } from './remote-shared.js';

/** Handles remote API key, browser profile, and team workspace management routes. */
export async function handleRemoteProfileAndWorkspaceRoutes(ctx: RemoteRouteContext): Promise<boolean> {
  const {
    req,
    res,
    method,
    parsedUrl,
    requestId,
    rateLimit,
    auth,
    route,
    idempotencyKey,
    remoteService,
    webhookService,
    requireAccess,
    requireFeature,
  } = ctx;

  // ========================================================================
  // 1. API KEYS MANAGEMENT (/api/v1/remote/api-keys)
  // ========================================================================
  if (route === 'api-keys' && method === 'GET') {
    const workspaceId = parsedUrl.searchParams.get('workspaceId') || undefined;
    if (isPostgresConfigured()) {
      const repo = getCentralRepository();
      const rawKeys = await repo.listRemoteApiKeys(auth.userId);
      const filtered = workspaceId ? rawKeys.filter((k: any) => k.workspace_id === workspaceId) : rawKeys;
      const keys = filtered.map((k: any) => ({
        id: k.id,
        userId: k.user_id,
        workspaceId: k.workspace_id || null,
        name: k.name,
        keyPrefix: k.key_prefix,
        scopes: typeof k.scopes_json === 'string' ? JSON.parse(k.scopes_json) : (k.scopes_json || []),
        status: k.status,
        rateLimitPerMin: k.rate_limit_per_min,
        requestsCountMonth: k.requests_count_month,
        lastUsedAt: k.last_used_at || null,
        createdAt: k.created_at,
        expiresAt: k.expires_at || null,
      }));
      sendRemoteJSON(req, res, 200, { success: true, data: keys }, requestId, rateLimit);
      return true;
    }
    const keys = remoteService.listApiKeys(auth.userId, workspaceId);
    sendRemoteJSON(req, res, 200, { success: true, data: keys }, requestId, rateLimit);
    return true;
  }

  if (route === 'api-keys' && method === 'POST') {
    const body = await parseBody(req);
    if (isPostgresConfigured()) {
      const repo = getCentralRepository();
      const dto = body as CreateRemoteApiKeyDTO;
      const trimmedName = (dto.name || '').trim();
      if (!trimmedName) throw new Error('API key name is required');
      const entropy = crypto.randomBytes(24).toString('hex');
      const rawSecretKey = `mahi_live_${entropy}`;
      const keyPrefix = rawSecretKey.substring(0, 14);
      const keyHash = crypto.createHash('sha256').update(rawSecretKey).digest('hex');
      const id = `key_${crypto.randomUUID()}`;
      const now = new Date();
      let expiresAt: string | null = null;
      if (dto.expiresInDays && dto.expiresInDays > 0) {
        expiresAt = new Date(now.getTime() + dto.expiresInDays * 86400000).toISOString();
      }
      const scopes = dto.scopes && dto.scopes.length > 0 ? dto.scopes : ['profiles:read'];
      const rateLimitVal = dto.rateLimitPerMin && dto.rateLimitPerMin > 0 ? dto.rateLimitPerMin : 120;

      await repo.createRemoteApiKey({
        id,
        user_id: auth.userId,
        workspace_id: dto.workspaceId || null,
        name: trimmedName,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes_json: JSON.stringify(scopes),
        status: 'ACTIVE',
        rate_limit_per_min: rateLimitVal,
        requests_count_month: 0,
        created_at: now.toISOString(),
        expires_at: expiresAt,
      });

      const responsePayload = {
        success: true,
        data: {
          apiKey: {
            id,
            userId: auth.userId,
            workspaceId: dto.workspaceId || null,
            name: trimmedName,
            keyPrefix,
            scopes,
            status: 'ACTIVE',
            rateLimitPerMin: rateLimitVal,
            requestsCountMonth: 0,
            createdAt: now.toISOString(),
            expiresAt,
          },
          secretKey: rawSecretKey,
          note: 'Save this secret key securely now. It will never be shown again.',
        },
      };
      if (idempotencyKey) {
        saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
      }
      sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
      return true;
    }
    const created = remoteService.createApiKey(auth.userId, body as CreateRemoteApiKeyDTO);
    const responsePayload = {
      success: true,
      data: {
        apiKey: created.keyRecord,
        secretKey: created.secretKey,
        note: 'Save this secret key securely now. It will never be shown again.',
      },
    };
    if (idempotencyKey) {
      saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
    }
    sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
    return true;
  }

  const keyRevokeMatch = route.match(/^api-keys\/([a-zA-Z0-9_-]+)$/);
  if (keyRevokeMatch && method === 'DELETE') {
    const keyId = keyRevokeMatch[1];
    if (isPostgresConfigured()) {
      const repo = getCentralRepository();
      const success = await repo.revokeRemoteApiKey(keyId, auth.userId);
      if (!success) {
        sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'API key not found' } }, requestId, rateLimit);
        return true;
      }
      sendRemoteJSON(req, res, 200, { success: true, data: { revoked: true, keyId } }, requestId, rateLimit);
      return true;
    }
    const success = remoteService.revokeApiKey(keyId, auth.userId);
    if (!success) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'API key not found' } }, requestId, rateLimit);
      return true;
    }
    sendRemoteJSON(req, res, 200, { success: true, data: { revoked: true, keyId } }, requestId, rateLimit);
    return true;
  }

  const keyRotateMatch = route.match(/^api-keys\/([a-zA-Z0-9_-]+)\/rotate$/);
  if (keyRotateMatch && method === 'POST') {
    const keyId = keyRotateMatch[1];
    const rotated = remoteService.rotateApiKey(keyId, auth.userId);
    sendRemoteJSON(
      req,
      res,
      200,
      {
        success: true,
        data: {
          apiKey: rotated.keyRecord,
          newSecretKey: rotated.newSecretKey,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  const keyAuditMatch = route.match(/^api-keys\/([a-zA-Z0-9_-]+)\/audits$/);
  if (keyAuditMatch && method === 'GET') {
    const keyId = keyAuditMatch[1];
    const audits = remoteService.getAuditLogs(keyId, auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: audits }, requestId, rateLimit);
    return true;
  }

  // ========================================================================
  // 2. REMOTE PROFILES (/api/v1/remote/profiles)
  // ========================================================================
  if (route === 'profiles' && method === 'GET') {
    if (!requireAccess('profiles:read')) return true;

    const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(parsedUrl.searchParams.get('limit') || '20', 10), 100);
    const folder = parsedUrl.searchParams.get('folder') || undefined;
    const status = parsedUrl.searchParams.get('status') || undefined;

    const allProfiles = getProfiles({
      ownerId: auth.userId,
      folder,
      status: status as any,
    });

    const total = allProfiles.length;
    const startIndex = (page - 1) * limit;
    const paged = allProfiles.slice(startIndex, startIndex + limit);

    const sanitized = paged.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      folder: p.folder,
      status: p.status,
      tags: p.tags,
      pinned: p.pinned,
      lastUsedAt: p.lastUsedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    sendRemoteJSON(
      req,
      res,
      200,
      {
        success: true,
        data: sanitized,
        meta: { page, limit, total, hasMore: startIndex + limit < total },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  if (route === 'profiles' && method === 'POST') {
    if (!requireAccess('profiles:write')) return true;

    const limitCheck = canCreateProfile(auth.userId);
    if (!limitCheck.allowed) {
      sendRemoteJSON(
        req,
        res,
        403,
        { success: false, error: { code: 'PROFILE_LIMIT_REACHED', message: limitCheck.message || 'Profile limit reached for current plan.' } },
        requestId,
        rateLimit
      );
      return true;
    }

    const body = await parseBody(req);
    if (!body.name || typeof body.name !== 'string') {
      sendRemoteJSON(
        req,
        res,
        400,
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Profile name is required' } },
        requestId,
        rateLimit
      );
      return true;
    }

    const created = createProfile({
      name: body.name.trim(),
      description: body.description || '',
      folder: body.folder || 'General',
      notes: body.notes || '',
      ownerId: auth.userId,
      tags: body.tags || [],
    });

    webhookService.dispatchEvent('profile.created', { profileId: created.id, name: created.name }, {
      userId: auth.userId,
      actor: { userId: auth.userId, email: auth.email },
    });

    const responsePayload = {
      success: true,
      data: {
        id: created.id,
        name: created.name,
        folder: created.folder,
        status: created.status,
        createdAt: created.createdAt,
      },
    };

    if (idempotencyKey) {
      saveIdempotentResponse(idempotencyKey, auth.userId, route, 201, responsePayload);
    }

    sendRemoteJSON(req, res, 201, responsePayload, requestId, rateLimit);
    return true;
  }

  const profileIdMatch = route.match(/^profiles\/([a-zA-Z0-9_-]+)$/);
  if (profileIdMatch && method === 'GET') {
    if (!requireAccess('profiles:read')) return true;

    const profile = getProfileById(profileIdMatch[1], auth.userId);
    if (!profile || profile.ownerId !== auth.userId) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
      return true;
    }

    sendRemoteJSON(
      req,
      res,
      200,
      {
        success: true,
        data: {
          id: profile.id,
          name: profile.name,
          description: profile.description,
          folder: profile.folder,
          status: profile.status,
          tags: profile.tags,
          pinned: profile.pinned,
          lastUsedAt: profile.lastUsedAt,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  if (profileIdMatch && method === 'PUT') {
    if (!requireAccess('profiles:write')) return true;

    const profile = getProfileById(profileIdMatch[1], auth.userId);
    if (!profile || profile.ownerId !== auth.userId) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
      return true;
    }

    const body = await parseBody(req);
    const updated = updateProfile(profile.id, {
      name: body.name,
      notes: body.notes,
      folder: body.folder,
    }, auth.userId);

    webhookService.dispatchEvent('profile.updated', { profileId: profile.id, name: updated.name }, {
      userId: auth.userId,
      actor: { userId: auth.userId, email: auth.email },
    });

    sendRemoteJSON(req, res, 200, { success: true, data: updated }, requestId, rateLimit);
    return true;
  }

  if (profileIdMatch && method === 'DELETE') {
    if (!requireAccess('profiles:delete')) return true;

    const profile = getProfileById(profileIdMatch[1], auth.userId);
    if (!profile || profile.ownerId !== auth.userId) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
      return true;
    }

    deleteProfile(profile.id, auth.userId);

    webhookService.dispatchEvent('profile.deleted', { profileId: profile.id }, {
      userId: auth.userId,
      actor: { userId: auth.userId, email: auth.email },
    });

    sendRemoteJSON(req, res, 200, { success: true, data: { deleted: true, profileId: profile.id } }, requestId, rateLimit);
    return true;
  }

  const profileLaunchMatch = route.match(/^profiles\/([a-zA-Z0-9_-]+)\/launch$/);
  if (profileLaunchMatch && method === 'POST') {
    if (!requireAccess('profiles:run')) return true;

    const profileId = profileLaunchMatch[1];
    const profile = getProfileById(profileId, auth.userId);
    if (!profile || profile.ownerId !== auth.userId) {
      sendRemoteJSON(req, res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, requestId, rateLimit);
      return true;
    }

    const devices = getUserDevices(auth.userId).filter((d) => d.status === 'ACTIVE');
    if (devices.length === 0) {
      sendRemoteJSON(
        req,
        res,
        409,
        {
          success: false,
          error: {
            code: 'DEVICE_REQUIRED',
            message:
              'Remote profile launch requires an active, registered desktop client device. No online desktop agent was detected for this account.',
          },
          data: {
            launched: false,
            profileId,
            status: 'DEVICE_REQUIRED',
            suggestedAction: 'Please launch MAHI Browser on your desktop and sign into your account.',
          },
        },
        requestId,
        rateLimit
      );
      return true;
    }

    const primaryDevice = devices[0];
    sendRemoteJSON(
      req,
      res,
      202,
      {
        success: true,
        data: {
          launched: false,
          profileId,
          status: 'QUEUED',
          deviceId: primaryDevice.deviceId,
          deviceName: primaryDevice.deviceName,
          message: `Launch command queued for connected desktop device "${primaryDevice.deviceName}".`,
        },
      },
      requestId,
      rateLimit
    );
    return true;
  }

  // ========================================================================
  // 3. REMOTE WORKSPACES (/api/v1/remote/workspaces)
  // ========================================================================
  if (route === 'workspaces' && method === 'GET') {
    if (!requireAccess('workspace:read')) return true;

    const workspaces = listUserTeamWorkspaces(auth.userId);
    sendRemoteJSON(req, res, 200, { success: true, data: workspaces }, requestId, rateLimit);
    return true;
  }

  if (route === 'workspaces' && method === 'POST') {
    if (!requireAccess('workspace:manage')) return true;
    if (!requireFeature('workspace.team')) return true;

    const body = await parseBody(req);
    if (!body.name) {
      sendRemoteJSON(req, res, 400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Workspace name is required' } }, requestId, rateLimit);
      return true;
    }

    const created = createTeamWorkspace(auth.userId, {
      name: body.name,
      description: body.description,
    });

    sendRemoteJSON(req, res, 201, { success: true, data: created }, requestId, rateLimit);
    return true;
  }

  const wsMembersMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members$/);
  if (wsMembersMatch && method === 'GET') {
    const wsId = wsMembersMatch[1];
    if (!requireAccess('workspace:read', 'WORKSPACE_VIEW', wsId)) return true;

    const members = getWorkspaceMembers(auth.userId, wsId);
    sendRemoteJSON(req, res, 200, { success: true, data: members }, requestId, rateLimit);
    return true;
  }

  const wsInviteMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members\/invite$/);
  if (wsInviteMatch && method === 'POST') {
    const wsId = wsInviteMatch[1];
    if (!requireAccess('workspace:manage', 'MEMBER_INVITE', wsId)) return true;

    const body = await parseBody(req);
    if (!body.email) {
      sendRemoteJSON(req, res, 400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invitee email is required' } }, requestId, rateLimit);
      return true;
    }

    const invitation = await inviteWorkspaceMember(
      auth.userId,
      wsId,
      body.email,
      body.role || 'MEMBER'
    );

    webhookService.dispatchEvent('workspace.member.invited', { workspaceId: wsId, email: body.email }, {
      userId: auth.userId,
      workspaceId: wsId,
    });

    sendRemoteJSON(req, res, 201, { success: true, data: invitation }, requestId, rateLimit);
    return true;
  }

  const wsMemberRoleMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)\/role$/);
  if (wsMemberRoleMatch && method === 'PUT') {
    const wsId = wsMemberRoleMatch[1];
    const targetUserId = wsMemberRoleMatch[2];
    if (!requireAccess('workspace:manage', 'MEMBER_ROLE_CHANGE', wsId)) return true;

    const body = await parseBody(req);
    const updated = updateMemberRole(auth.userId, wsId, targetUserId, body.role);
    sendRemoteJSON(req, res, 200, { success: true, data: updated }, requestId, rateLimit);
    return true;
  }

  const wsMemberRemoveMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/members\/([a-zA-Z0-9_-]+)$/);
  if (wsMemberRemoveMatch && method === 'DELETE') {
    const wsId = wsMemberRemoveMatch[1];
    const targetUserId = wsMemberRemoveMatch[2];
    if (!requireAccess('workspace:manage', 'MEMBER_REMOVE', wsId)) return true;

    const removed = removeWorkspaceMember(auth.userId, wsId, targetUserId);
    webhookService.dispatchEvent('workspace.member.removed', { workspaceId: wsId, targetUserId }, {
      userId: auth.userId,
      workspaceId: wsId,
    });
    sendRemoteJSON(req, res, 200, { success: true, data: { removed, targetUserId } }, requestId, rateLimit);
    return true;
  }

  const wsProfilesMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/profiles$/);
  if (wsProfilesMatch && method === 'GET') {
    const wsId = wsProfilesMatch[1];
    if (!requireAccess('workspace:read', 'WORKSPACE_VIEW', wsId)) return true;

    const sharedProfiles = listWorkspaceProfiles(auth.userId, wsId);
    sendRemoteJSON(req, res, 200, { success: true, data: sharedProfiles }, requestId, rateLimit);
    return true;
  }

  const wsShareMatch = route.match(/^workspaces\/([a-zA-Z0-9_-]+)\/profiles\/share$/);
  if (wsShareMatch && method === 'POST') {
    const wsId = wsShareMatch[1];
    if (!requireAccess('workspace:manage', 'PROFILE_SHARE', wsId)) return true;

    const body = await parseBody(req);
    const shareRecord = shareProfileToWorkspace(auth.userId, wsId, {
      cloudProfileId: body.profileId || body.cloudProfileId,
      permissionLevel: body.permissionLevel || 'RUN',
      encryptedKeyEnvelope: body.encryptedKeyEnvelope,
    });
    sendRemoteJSON(req, res, 201, { success: true, data: shareRecord }, requestId, rateLimit);
    return true;
  }

  return false;
}
