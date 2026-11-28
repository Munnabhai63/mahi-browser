/**
 * MAHI Platform V2 — Typed Records & DTOs for CentralRepository
 * Aligned with prisma/schema.prisma and offline SQLite tables.
 */

export interface AuthUserRecord {
  id: string;
  email: string;
  normalized_email?: string;
  password_hash: string;
  salt: string;
  name: string;
  role: string;
  status: string;
  email_verified: number | boolean;
  email_verified_at: string | null;
  plan_id: string;
  planId?: string;
  profile_quota: number;
  profileQuota?: number;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  trial_used: number | boolean;
  signup_intent: string | null;
  google_sub: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  accepted_terms: number | boolean | null;
  terms_version: string | null;
}

export interface AuthUserCreateInput {
  id: string;
  email: string;
  normalized_email?: string;
  password_hash?: string;
  passwordHash?: string;
  salt?: string;
  name?: string;
  role?: string;
  status?: string;
  email_verified?: number | boolean;
  email_verified_at?: string | null;
  plan_id?: string;
  profile_quota?: number;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  trial_used?: number | boolean;
  signup_intent?: string | null;
  google_sub?: string | null;
  avatar_url?: string | null;
  auth_provider?: string | null;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
  accepted_terms?: number;
  acceptedTerms?: number;
  terms_version?: string | null;
  termsVersion?: string | null;
}

export type AuthUserUpdateInput = Partial<
  Omit<AuthUserRecord, 'id' | 'email_verified' | 'trial_used' | 'accepted_terms' | 'planId' | 'profileQuota'>
> & {
  email_verified?: number;
  trial_used?: number;
  accepted_terms?: number;
};

export interface AuthSessionRecord {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_id: string;
  device_name: string;
  platform: string;
  ip_address: string | null;
  is_revoked: number | boolean;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

export interface AuthSessionCreateInput {
  id: string;
  user_id?: string;
  userId?: string;
  refresh_token_hash?: string;
  refreshTokenHash?: string;
  device_id?: string;
  deviceId?: string;
  device_name?: string;
  deviceName?: string;
  platform?: string;
  ip_address?: string | null;
  ipAddress?: string | null;
  is_revoked?: number | boolean;
  created_at?: string;
  last_used_at?: string;
  expires_at?: string;
  expiresAt?: string;
}

export type AuthSessionUpdateInput = Partial<Omit<AuthSessionRecord, 'id' | 'is_revoked'>> & {
  is_revoked?: number;
};

export interface AuthVerificationTokenRecord {
  id: string;
  token_hash: string;
  user_id: string;
  email: string;
  type: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
}

export interface AuthVerificationTokenCreateInput {
  id: string;
  token_hash?: string;
  tokenHash?: string;
  user_id?: string;
  userId?: string;
  email: string;
  type?: string;
  expires_at?: string;
  expiresAt?: string;
  created_at?: string;
  used_at?: string | null;
}

export interface AuthSecurityLogResult {
  id: string;
  user_id: string | null;
  action: string;
  result: string;
  ip_address?: string | null;
  details?: string | null;
  created_at?: string;
}

export interface CommercialUserRecord {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  name: string;
  role: string;
  status: string;
  plan_id: string;
  bonus_profiles: number;
  bonus_proxy_bytes: number | bigint;
  feature_overrides: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CommercialUserCreateInput {
  id: string;
  email: string;
  password_hash?: string;
  passwordHash?: string;
  salt: string;
  name?: string;
  role?: string;
  status?: string;
  plan_id?: string;
  planId?: string;
  bonus_profiles?: number;
  bonusProfiles?: number;
  bonus_proxy_bytes?: number | bigint;
  bonusProxyBytes?: number | bigint;
  feature_overrides?: string | Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export type CommercialUserUpdateInput = Partial<Omit<CommercialUserRecord, 'id' | 'bonus_proxy_bytes'>> & {
  bonus_proxy_bytes?: number | bigint;
};

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
}

export interface CloudProfileCreateInput {
  id: string;
  owner_id?: string;
  ownerId?: string;
  local_profile_id?: string;
  localProfileId?: string;
  name: string;
  current_version?: number;
  currentVersion?: number;
  status?: string;
  storage_bytes?: number;
  storageBytes?: number;
  created_at?: string;
  updated_at?: string;
}

export type CloudProfileUpdateInput = Partial<Omit<CloudProfileRecord, 'id'>>;

export interface CloudProfileVersionRecord {
  id: string;
  cloud_profile_id: string;
  version: number;
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

export interface CloudProfileVersionCreateInput {
  id: string;
  cloud_profile_id?: string;
  cloudProfileId?: string;
  version: number;
  object_key?: string;
  objectKey?: string;
  file_size?: number;
  fileSize?: number;
  checksum_sha256?: string;
  checksumSha256?: string;
  encrypted_data_key?: string;
  encryptedDataKey?: string;
  iv: string;
  auth_tag?: string;
  authTag?: string;
  source_device_id?: string;
  sourceDeviceId?: string;
  source_device_name?: string | null;
  sourceDeviceName?: string | null;
  created_at?: string;
}

export interface CloudProfileDeltaRecord {
  id: string;
  cloud_profile_id: string;
  base_version: number;
  delta_version: number;
  delta_type: string;
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

export interface CloudProfileDeltaCreateInput {
  id: string;
  cloud_profile_id?: string;
  cloudProfileId?: string;
  base_version?: number;
  baseVersion?: number;
  delta_version?: number;
  deltaVersion?: number;
  delta_type?: string;
  deltaType?: string;
  manifest_hash?: string | null;
  manifestHash?: string | null;
  object_key?: string;
  objectKey?: string;
  file_size?: number;
  fileSize?: number;
  checksum_sha256?: string;
  checksumSha256?: string;
  encrypted_data_key?: string;
  encryptedDataKey?: string;
  iv: string;
  auth_tag?: string;
  authTag?: string;
  source_device_id?: string;
  sourceDeviceId?: string;
  source_device_name?: string | null;
  sourceDeviceName?: string | null;
  created_at?: string;
}

export interface CloudUploadSessionRecord {
  id: string;
  user_id: string;
  cloud_profile_id: string;
  base_version: number;
  target_version: number;
  archive_format?: string;
  manifest_hash?: string | null;
  object_key: string;
  expected_size: number | bigint;
  expected_checksum: string;
  encrypted_data_key: string;
  iv: string;
  auth_tag: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface CloudUploadSessionCreateInput {
  id: string;
  user_id?: string;
  userId?: string;
  cloud_profile_id?: string;
  cloudProfileId?: string;
  base_version?: number;
  baseVersion?: number;
  target_version?: number;
  targetVersion?: number;
  archive_format?: string;
  archiveFormat?: string;
  manifest_hash?: string | null;
  manifestHash?: string | null;
  object_key?: string;
  objectKey?: string;
  expected_size?: number;
  expectedSize?: number;
  expected_checksum?: string;
  expectedChecksum?: string;
  encrypted_data_key?: string;
  encryptedDataKey?: string;
  iv: string;
  auth_tag?: string;
  authTag?: string;
  status?: string;
  expires_at?: string;
  expiresAt?: string;
  created_at?: string;
  /** @deprecated Stripped before persistence; retained for backward-compatible callers/tests */
  source_device_id?: string;
  /** @deprecated Stripped before persistence; retained for backward-compatible callers/tests */
  source_device_name?: string;
}

export type CloudUploadSessionUpdateInput = Partial<Omit<CloudUploadSessionRecord, 'id' | 'expected_size'>> & {
  expected_size?: number | bigint;
};

export interface CloudSyncAuditLogResult {
  id: string;
  user_id: string;
  cloud_profile_id?: string | null;
  action: string;
  device_id?: string | null;
  details?: string | null;
  created_at?: string;
}

export interface TeamWorkspaceRecord {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TeamWorkspaceCreateInput {
  id: string;
  name: string;
  description?: string;
  owner_user_id?: string;
  ownerUserId?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export type TeamWorkspaceUpdateInput = Partial<Omit<TeamWorkspaceRecord, 'id'>>;

export interface TeamWorkspaceMemberRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
}

export interface TeamWorkspaceMemberCreateInput {
  id: string;
  workspace_id?: string;
  workspaceId?: string;
  user_id?: string;
  userId?: string;
  role?: string;
  status?: string;
  invited_by?: string | null;
  invited_by_user_id?: string | null;
  invitedByUserId?: string | null;
  joined_at?: string;
  created_at?: string;
}

export interface RemoteApiKeyRecord {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes_json: string;
  status: string;
  rate_limit_per_min: number;
  requests_count_month: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface RemoteApiKeyCreateInput {
  id: string;
  user_id?: string;
  userId?: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  name: string;
  key_prefix?: string;
  keyPrefix?: string;
  key_hash?: string;
  keyHash?: string;
  scopes_json?: string;
  scopesJson?: string;
  status?: string;
  rate_limit_per_min?: number;
  rateLimitPerMin?: number;
  requests_count_month?: number;
  requestsCountMonth?: number;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  revoked_at?: string | null;
}

export interface RemoteApiKeyAuditResult {
  id: string;
  key_id: string;
  user_id: string;
  action: string;
  ip_address?: string | null;
  details: string | null;
  created_at?: string;
}

export interface CloudProfileLockRecord {
  cloud_profile_id: string;
  device_id: string;
  device_name: string | null;
  user_id: string;
  locked_at: string;
  expires_at: string;
}

export interface CloudProfileLockUpsertInput {
  cloudProfileId: string;
  deviceId: string;
  deviceName: string | null;
  userId: string;
  lockedAt: string;
  expiresAt: string;
}

export interface WebHandoffSessionCreateInput {
  code: string;
  token: string;
  userJson: string;
  createdAt: number;
  expiresAt: number;
}

export interface WebHandoffSessionRecord {
  code: string;
  token: string;
  user_json: string;
  created_at: number | bigint;
  expires_at: number | bigint;
  used: number;
}

export type WebHandoffUserPayload = Record<string, unknown> & {
  deviceId?: string;
};
