import { getDatabase } from '../../../06_DATABASE/connection.js';
import { evaluateUserEntitlements } from '../../commercial/commercial-entitlement-service.js';
import { type TeamRole, type TeamPermission, ROLE_PERMISSIONS } from '../../../10_CONFIG/shared/types/workspace.js';
import {
  isPostgresConfigured,
  getCentralRepository,
  type AuthUserRecord,
  type CloudProfileRecord as RepoCloudProfileRecord,
} from '../../../06_DATABASE/central-repository.js';
import {
  log,
  type SqliteTeamShareRow,
  type CloudProfileRecord,
  DEFAULT_MAX_STORAGE_BYTES,
  getPgDelegateClient,
  errMsg,
} from './cloud-profile-shared.js';

/**
 * Check if a user has access to a cloud profile, either directly as owner
 * or through an active team workspace share.
 */
export function verifyUserProfileAccess(
  userId: string,
  cloudProfileId: string,
  requiredPermission: TeamPermission = 'PROFILE_VIEW'
): { profile: RepoCloudProfileRecord; isOwner: boolean; sharedEnvelope?: string } | null {
  const db = getDatabase();

  // 1. Direct owner check
  const profile = db
    .prepare(`
    SELECT * FROM cloud_profiles WHERE id = ? AND status != 'DELETED'
  `)
    .get(cloudProfileId) as unknown as RepoCloudProfileRecord | undefined;

  if (!profile) return null;

  if (profile.owner_id === userId) {
    return { profile, isOwner: true };
  }

  // 2. Team workspace share check
  // Check if profile is shared to any workspace where user is an ACTIVE member with required permission
  const share = db
    .prepare(`
    SELECT s.encrypted_key_envelope, s.permission_level, m.role
    FROM team_profile_shares s
    JOIN team_workspace_members m ON s.workspace_id = m.workspace_id
    JOIN team_workspaces w ON s.workspace_id = w.id
    WHERE s.cloud_profile_id = ?
      AND m.user_id = ?
      AND m.status = 'ACTIVE'
      AND w.status = 'ACTIVE'
      AND s.revoked_at IS NULL
    LIMIT 1
  `)
    .get(cloudProfileId, userId) as unknown as SqliteTeamShareRow | undefined;

  if (!share) return null;

  // Check role permission in that workspace
  const role = share.role as TeamRole;
  const allowed = (ROLE_PERMISSIONS[role] || []).includes(requiredPermission);
  if (!allowed) {
    return null;
  }

  return {
    profile,
    isOwner: false,
    sharedEnvelope: share.encrypted_key_envelope,
  };
}

export async function verifyUserProfileAccessAsync(
  userId: string,
  cloudProfileId: string,
  requiredPermission: TeamPermission = 'PROFILE_VIEW'
): Promise<{ profile: RepoCloudProfileRecord; isOwner: boolean; sharedEnvelope?: string } | null> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const profile = await repo.findCloudProfileById(cloudProfileId);
    if (!profile || profile.status === 'DELETED') return null;
    if (profile.owner_id === userId) {
      return { profile, isOwner: true };
    }
    try {
      const prismaClient = getPgDelegateClient(repo);
      const share = await prismaClient?.team_profile_shares?.findFirst({
        where: {
          cloud_profile_id: cloudProfileId,
          workspace: {
            status: 'ACTIVE',
            members: {
              some: {
                user_id: userId,
                status: 'ACTIVE',
              },
            },
          },
        },
        include: {
          workspace: {
            include: {
              members: {
                where: { user_id: userId, status: 'ACTIVE' },
              },
            },
          },
        },
      });
      if (share && share.workspace?.members?.length > 0) {
        const member = share.workspace.members[0];
        const role = member.role as TeamRole;
        const allowed = (ROLE_PERMISSIONS[role] || []).includes(requiredPermission);
        if (allowed) {
          return {
            profile,
            isOwner: false,
            sharedEnvelope: share.encrypted_key_envelope,
          };
        }
      }
    } catch (shareErr) {
      log.debug('Shared workspace profile access lookup fell back cleanly', {
        userId,
        cloudProfileId,
        err: shareErr instanceof Error ? shareErr.message : String(shareErr),
      });
    }
    return null;
  }
  return verifyUserProfileAccess(userId, cloudProfileId, requiredPermission);
}

/**
 * Get cloud sync usage and quota for a user.
 */
export function getUserSyncUsage(userId: string) {
  const db = getDatabase();

  const countRow = db
    .prepare(`
    SELECT COUNT(*) as profile_count, COALESCE(SUM(storage_bytes), 0) as used_bytes
    FROM cloud_profiles
    WHERE owner_id = ? AND status != 'DELETED'
  `)
    .get(userId) as { profile_count: number; used_bytes: number };

  const profileCount = countRow?.profile_count || 0;
  const usedBytes = countRow?.used_bytes || 0;

  // Resolve plan limits via entitlements
  const entitlements = evaluateUserEntitlements(userId);
  const planLimits = entitlements.plan.limits;
  const isFreePlan = entitlements.plan.id === 'plan_free' || entitlements.plan.id === 'free';
  const cloudCap = isFreePlan ? undefined : planLimits.maxCloudBackupProfiles;
  const maxProfiles =
    typeof cloudCap === 'number'
      ? cloudCap === -1
        ? 1000000
        : cloudCap
      : planLimits.maxProfiles || 10;
  const totalBytes = DEFAULT_MAX_STORAGE_BYTES; // 1GB default quota

  return {
    profile_count: profileCount,
    max_profiles: maxProfiles,
    used_bytes: usedBytes,
    total_bytes: totalBytes,
    used_mb: parseFloat((usedBytes / (1024 * 1024)).toFixed(2)),
    total_mb: parseFloat((totalBytes / (1024 * 1024)).toFixed(2)),
    quota_percent: totalBytes > 0 ? Math.min(100, parseFloat(((usedBytes / totalBytes) * 100).toFixed(1))) : 0,
  };
}

export async function getUserSyncUsageAsync(userId: string) {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const profiles = await repo.listCloudProfiles(userId);
    const active = profiles.filter((p) => p.status !== 'DELETED');
    const profileCount = active.length;
    const usedBytes = active.reduce((acc: number, p) => acc + Number(p.storage_bytes || 0), 0);

    let centralUser: AuthUserRecord | null = null;
    try {
      centralUser = await repo.findAuthUserById(userId);
    } catch (e: unknown) {
      log.error('[CloudProfileService] Failed to load central user for quota:', errMsg(e));
    }

    const entitlements = evaluateUserEntitlements(userId);
    const planLimits = entitlements?.plan?.limits;
    const hasLocalPaid = Boolean(entitlements?.plan?.tier && entitlements.plan.tier !== 'FREE');
    const hasPgPaid = Boolean(
      centralUser?.plan_id && centralUser.plan_id !== 'free' && (centralUser.profile_quota || 0) > 1
    );
    const hasPaidUpgrade = hasLocalPaid || hasPgPaid;

    const isFreePlan =
      !hasPaidUpgrade &&
      (entitlements?.plan?.tier === 'FREE' ||
        centralUser?.plan_id === 'free' ||
        centralUser?.profile_quota === 1);

    const cloudCap = hasLocalPaid ? planLimits?.maxCloudBackupProfiles : undefined;
    const normalizedCentralPlan = centralUser?.plan_id ? String(centralUser.plan_id).toLowerCase().trim() : '';
    let localMax = 0;
    if (!isFreePlan && planLimits) {
      if (typeof cloudCap === 'number') {
        localMax = cloudCap === -1 ? 1000000 : cloudCap;
      } else if (typeof planLimits.maxProfiles === 'number') {
        localMax = planLimits.maxProfiles;
      }
    }
    const pgQuota = centralUser && typeof centralUser.profile_quota === 'number' ? centralUser.profile_quota : 0;
    const maxProfiles = isFreePlan
      ? pgQuota || 1
      : typeof cloudCap === 'number'
        ? localMax
        : normalizedCentralPlan === 'growth' || normalizedCentralPlan === 'mahi_growth'
          ? 25
          : normalizedCentralPlan === 'starter' || normalizedCentralPlan === 'mahi_starter'
            ? 0
            : Math.max(localMax, pgQuota) || 10;
    const totalBytes = DEFAULT_MAX_STORAGE_BYTES;
    return {
      profile_count: profileCount,
      max_profiles: maxProfiles,
      used_bytes: usedBytes,
      total_bytes: totalBytes,
      used_mb: parseFloat((usedBytes / (1024 * 1024)).toFixed(2)),
      total_mb: parseFloat((totalBytes / (1024 * 1024)).toFixed(2)),
      quota_percent: totalBytes > 0 ? Math.min(100, parseFloat(((usedBytes / totalBytes) * 100).toFixed(1))) : 0,
    };
  }
  return getUserSyncUsage(userId);
}

/**
 * List all active cloud profiles for the user.
 */
export function listUserCloudProfiles(userId: string): CloudProfileRecord[] {
  const db = getDatabase();
  const profiles = db
    .prepare(`
    SELECT * FROM cloud_profiles
    WHERE owner_id = ? AND status != 'DELETED'
    ORDER BY updated_at DESC
  `)
    .all(userId) as unknown as RepoCloudProfileRecord[];

  return profiles.map((p) => {
    const latestVersion = db
      .prepare(`
      SELECT version, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag, created_at
      FROM cloud_profile_versions
      WHERE cloud_profile_id = ?
      ORDER BY version DESC LIMIT 1
    `)
      .get(p.id) as unknown as CloudProfileRecord['latest_version'] | undefined;

    const sizeMb = p.storage_bytes ? parseFloat((p.storage_bytes / (1024 * 1024)).toFixed(2)) : 0;
    return {
      ...p,
      size_mb: sizeMb,
      version: p.current_version,
      latest_version: latestVersion || undefined,
    };
  });
}

export async function listUserCloudProfilesAsync(userId: string): Promise<CloudProfileRecord[]> {
  if (isPostgresConfigured()) {
    const repo = getCentralRepository();
    const profiles = await repo.listCloudProfiles(userId);
    const active = profiles.filter((p) => p.status !== 'DELETED');
    const records: CloudProfileRecord[] = [];
    for (const p of active) {
      const latestVersion = await repo.getLatestCloudProfileVersion(p.id);
      const storageBytes = Number(p.storage_bytes || 0);
      records.push({
        id: p.id,
        owner_id: p.owner_id,
        local_profile_id: p.local_profile_id,
        name: p.name,
        current_version: p.current_version,
        status: p.status,
        storage_bytes: storageBytes,
        created_at: p.created_at,
        updated_at: p.updated_at,
        latest_version: latestVersion
          ? {
              version: latestVersion.version,
              file_size: Number(latestVersion.file_size || 0),
              checksum_sha256: latestVersion.checksum_sha256,
              encrypted_data_key: latestVersion.encrypted_data_key,
              iv: latestVersion.iv,
              auth_tag: latestVersion.auth_tag,
              created_at: latestVersion.created_at,
            }
          : undefined,
      });
    }
    return records;
  }
  return listUserCloudProfiles(userId);
}

/**
 * Get specific cloud profile details.
 */
export function getCloudProfile(userId: string, cloudProfileId: string): CloudProfileRecord | null {
  const access = verifyUserProfileAccess(userId, cloudProfileId, 'PROFILE_VIEW');
  if (!access) return null;

  const db = getDatabase();
  const profile = access.profile;

  const latestVersion = db
    .prepare(`
    SELECT version, file_size, checksum_sha256, encrypted_data_key, iv, auth_tag, created_at
    FROM cloud_profile_versions
    WHERE cloud_profile_id = ?
    ORDER BY version DESC LIMIT 1
  `)
    .get(profile.id) as unknown as CloudProfileRecord['latest_version'] | undefined;

  const sizeMb = profile.storage_bytes ? parseFloat((profile.storage_bytes / (1024 * 1024)).toFixed(2)) : 0;
  return {
    ...profile,
    size_mb: sizeMb,
    version: profile.current_version,
    latest_version: latestVersion
      ? {
          ...latestVersion,
          encrypted_data_key: access.sharedEnvelope || latestVersion.encrypted_data_key,
        }
      : undefined,
  };
}

export async function getCloudProfileAsync(userId: string, cloudProfileId: string): Promise<CloudProfileRecord | null> {
  if (isPostgresConfigured()) {
    const access = await verifyUserProfileAccessAsync(userId, cloudProfileId, 'PROFILE_VIEW');
    if (!access) return null;
    const repo = getCentralRepository();
    const profile = access.profile;
    const latestVersion = await repo.getLatestCloudProfileVersion(profile.id);
    const storageBytes = Number(profile.storage_bytes || 0);
    return {
      id: profile.id,
      owner_id: profile.owner_id,
      local_profile_id: profile.local_profile_id,
      name: profile.name,
      current_version: profile.current_version,
      status: profile.status,
      storage_bytes: storageBytes,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      latest_version: latestVersion
        ? {
            version: latestVersion.version,
            file_size: Number(latestVersion.file_size || 0),
            checksum_sha256: latestVersion.checksum_sha256,
            encrypted_data_key: access.sharedEnvelope || latestVersion.encrypted_data_key,
            iv: latestVersion.iv,
            auth_tag: latestVersion.auth_tag,
            created_at: latestVersion.created_at,
          }
        : undefined,
    };
  }
  return getCloudProfile(userId, cloudProfileId);
}
