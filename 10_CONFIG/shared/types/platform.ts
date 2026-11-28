/**
 * MAHI Platform V2 — Enterprise Domain Types & Models
 */

export type PlanTierId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise' | 'custom';

export interface PlanLimits {
  maxProfiles: number;
  maxRunningProfiles: number;
  maxDevices: number;
  maxTeamMembers: number;
  storageMb: number;
  apiRequestsPerMonth: number;
  automationRunsPerMonth: number;
  backupRetentionDays: number;
  cloudSyncEnabled: boolean;
  proxyTunnelEnabled: boolean;
  cdpSyncEnabled: boolean;
  automationEnabled: boolean;
  apiEnabled: boolean;
  fleetEnabled: boolean;
}

export interface PlanDefinition {
  id: PlanTierId;
  name: string;
  priceMonthlyUsd: number;
  priceAnnualUsd: number;
  description: string;
  limits: PlanLimits;
  badge?: string;
  isPopular?: boolean;
}

export interface FeatureFlagDefinition {
  key: string;
  name: string;
  description: string;
  enabledGlobal: boolean;
  minPlanTier: PlanTierId;
  rolloutPercentage: number;
  allowedUserIds: string[];
  allowedOrgIds: string[];
  killSwitchActive: boolean;
  updatedAt: string;
}

export type UserRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER' | 'CUSTOM';

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  organizationId?: string;
  planId: PlanTierId;
  customLimits?: Partial<PlanLimits>;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'REVOKED';
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  planId: PlanTierId;
  seatsTotal: number;
  seatsUsed: number;
  storageUsedMb: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileFolder {
  id: string;
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  workspaceId?: string;
  profileCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileLock {
  profileId: string;
  lockedByUserId: string;
  lockedByUserName: string;
  lockedByDeviceId: string;
  lockedAt: string;
  expiresAt: string;
}

export type ProfileSyncStatus = 'LOCAL_ONLY' | 'SYNCING' | 'SYNCED' | 'PENDING' | 'CONFLICT' | 'FAILED' | 'OFFLINE';

export interface ProfileSyncState {
  profileId: string;
  status: ProfileSyncStatus;
  lastSyncedAt?: string;
  localVersion: number;
  remoteVersion: number;
  checksum?: string;
  error?: string;
}

export interface DeviceRecord {
  id: string;
  deviceId: string;
  userId: string;
  deviceName: string;
  os: string;
  clientVersion: string;
  ipAddress?: string;
  macAddressHash?: string;
  cpuModel?: string;
  totalMemoryMb?: number;
  status: 'ONLINE' | 'OFFLINE' | 'REVOKED' | 'LOCKED';
  lastSeenAt: string;
  registeredAt: string;
}

export interface FleetTelemetry {
  deviceId: string;
  deviceName: string;
  status: 'ONLINE' | 'OFFLINE' | 'RUNNING_TASKS' | 'IDLE';
  activeProfilesCount: number;
  runningProfilePids: number[];
  cpuUsagePercent: number;
  memoryUsageMb: number;
  diskFreeMb: number;
  uptimeSeconds: number;
  clientVersion: string;
  syncState: string;
  timestamp: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  rateLimitPerMin: number;
  requestsCountMonth: number;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface AuditTrailEvent {
  id: string;
  actorId: string;
  actorName: string;
  actorType: 'USER' | 'ADMIN' | 'SYSTEM' | 'API_KEY';
  action: string;
  category: 'AUTH' | 'PROFILE' | 'PROXY' | 'AUTOMATION' | 'LICENSE' | 'FLEET' | 'SETTINGS' | 'SECURITY';
  targetType: string;
  targetId?: string;
  details: string;
  ipAddress?: string;
  deviceId?: string;
  result: 'SUCCESS' | 'FAILURE' | 'WARNING';
  metadataJson?: string;
  timestamp: string;
}

export interface DistributionInfo {
  localIps: string[];
  port: number;
  downloadUrl: string;
  networkDownloadUrls: string[];
  setupAvailable: boolean;
  portableAvailable: boolean;
  setupFileName: string;
  portableFileName: string;
  setupPath: string;
  portablePath: string;
  setupSizeMB: number;
  portableSizeMB: number;
  version: string;
}
