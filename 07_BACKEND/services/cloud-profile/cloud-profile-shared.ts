import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getDatabase } from '../../../06_DATABASE/connection.js';
import { getPrismaClient } from '../../../06_DATABASE/prisma-client.js';
import { getStorageProvider } from '../../../08_SECURITY/storage-provider.js';
import { isPostgresConfigured, getCentralRepository } from '../../../06_DATABASE/central-repository.js';
import { createLogger } from '../../utils/logger.js';

export const log = createLogger('cloud-profile-service');

export interface SqliteTeamShareRow {
  encrypted_key_envelope: string;
  permission_level: string;
  role: string;
}

export interface SqliteObjectKeyRow {
  object_key: string;
}

export interface CookieDeltaSummary {
  downloadUrl: string;
  version: number;
  deltaVersion: number;
  checksumSha256: string;
  encryptedDataKey: string;
  iv: string;
  authTag: string;
  fileSize: number;
  manifestHash?: string;
}

export interface CloudProfileDeltaView {
  cloud_profile_id: string;
  base_version: number;
  delta_version: number;
  manifest_hash: string | null;
  object_key: string;
  file_size: number;
  checksum_sha256: string;
  encrypted_data_key: string;
  iv: string;
  auth_tag: string;
  source_device_id: string;
  source_device_name: string | null;
  created_at: string;
}

export interface CloudProfileRecord {
  id: string;
  owner_id: string;
  local_profile_id: string;
  name: string;
  current_version: number;
  status: string;
  storage_bytes: number;
  created_at: string;
  updated_at: string;
  size_mb?: number;
  version?: number;
  latest_version?: {
    version: number;
    file_size: number;
    checksum_sha256: string;
    encrypted_data_key: string;
    iv: string;
    auth_tag: string;
    created_at: string;
  };
}

export interface CreateUploadSessionParams {
  localProfileId: string;
  profileName: string;
  baseVersion: number;
  mode?: 'full' | 'cookies_only';
  archiveFormat?: string;
  manifestHash?: string;
  expectedSize: number;
  expectedChecksum: string;
  encryptedDataKey: string;
  iv: string;
  authTag: string;
  deviceId: string;
  deviceName?: string;
}

export interface UploadSessionResult {
  conflict?: boolean;
  fallbackToFull?: boolean;
  syncMode?: 'full' | 'cookies_only';
  currentVersion?: number;
  message?: string;
  sessionId?: string;
  uploadUrl?: string;
  objectKey?: string;
  targetVersion?: number;
  cloudProfileId?: string;
}

export const MAX_INDIVIDUAL_ARCHIVE_BYTES = 200 * 1024 * 1024; // 200 MB
export const DEFAULT_MAX_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GB default

export function getPgDelegateClient(repo: unknown): Partial<PrismaClient> | null {
  const withClient = repo as { client?: Partial<PrismaClient> } | null;
  return withClient?.client ?? (getPrismaClient() as Partial<PrismaClient> | null);
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function getCookieDeltaPointerKey(ownerId: string, cloudProfileId: string): string {
  return `profiles/${ownerId}/${cloudProfileId}/cookies-delta-latest.json`;
}

export async function saveDeltaPointerObject(
  ownerId: string,
  cloudProfileId: string,
  pointer: {
    deltaVersion: number;
    baseVersion: number;
    objectKey: string;
    fileSize: number;
    checksumSha256: string;
    encryptedDataKey: string;
    iv: string;
    authTag: string;
    manifestHash?: string | null;
    sourceDeviceId: string;
    sourceDeviceName?: string | null;
    createdAt: string;
  }
): Promise<void> {
  try {
    const storage = getStorageProvider();
    await storage.putObject(
      getCookieDeltaPointerKey(ownerId, cloudProfileId),
      Buffer.from(JSON.stringify(pointer), 'utf8')
    );
  } catch (err) {
    log.warn('Failed writing cookie delta pointer object to storage', {
      ownerId,
      cloudProfileId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function loadDeltaPointerObject(
  ownerId: string,
  cloudProfileId: string
): Promise<CloudProfileDeltaView | null> {
  try {
    const storage = getStorageProvider();
    const buf = await storage.getObject(getCookieDeltaPointerKey(ownerId, cloudProfileId));
    if (!buf) return null;
    const parsed = JSON.parse(buf.toString('utf8')) as {
      baseVersion: number;
      deltaVersion: number;
      manifestHash?: string | null;
      objectKey: string;
      fileSize: number;
      checksumSha256: string;
      encryptedDataKey: string;
      iv: string;
      authTag: string;
      sourceDeviceId: string;
      sourceDeviceName?: string | null;
      createdAt: string;
    };
    return {
      cloud_profile_id: cloudProfileId,
      base_version: parsed.baseVersion,
      delta_version: parsed.deltaVersion,
      manifest_hash: parsed.manifestHash || null,
      object_key: parsed.objectKey,
      file_size: parsed.fileSize,
      checksum_sha256: parsed.checksumSha256,
      encrypted_data_key: parsed.encryptedDataKey,
      iv: parsed.iv,
      auth_tag: parsed.authTag,
      source_device_id: parsed.sourceDeviceId,
      source_device_name: parsed.sourceDeviceName || null,
      created_at: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function logCloudAudit(
  userId: string,
  action: string,
  details?: string,
  cloudProfileId?: string,
  deviceId?: string
): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO cloud_sync_audit_logs (id, user_id, cloud_profile_id, action, device_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      cloudProfileId || null,
      action,
      deviceId || null,
      details || null,
      new Date().toISOString()
    );
  } catch (err) {
    log.error('[CloudProfileService] Failed to log audit event:', err);
  }
}

export async function logCloudAuditAsync(
  userId: string,
  action: string,
  details?: string,
  cloudProfileId?: string,
  deviceId?: string
): Promise<void> {
  try {
    if (isPostgresConfigured()) {
      const repo = getCentralRepository();
      await repo.logCloudSyncAudit(userId, action, details, cloudProfileId, deviceId);
      return;
    }
    logCloudAudit(userId, action, details, cloudProfileId, deviceId);
  } catch (err) {
    log.error('[CloudProfileService] Failed to log audit event:', err);
  }
}
