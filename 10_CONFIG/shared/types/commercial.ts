/**
 * MAHI Platform — Commercial Domain Models & Type Definitions
 */

export type CommercialRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'BILLING' | 'USER';

export type CommercialUserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type CommercialPlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE' | 'CUSTOM';

export type CommercialSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'TRIAL';

export type CommercialDeviceStatus = 'ACTIVE' | 'REVOKED';

export type CommercialAuditResult = 'SUCCESS' | 'FAILURE' | 'WARNING';

export interface CommercialUser {
  id: string;
  email: string;
  name: string;
  role: CommercialRole;
  status: CommercialUserStatus;
  planId: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface CommercialPlanLimits {
  maxProfiles: number;
  maxDevices: number;
  maxConcurrentRunning: number;
  proxyAccess: boolean;
  cloudSync: boolean;
  apiAccess: boolean;
  rpaAutomation: boolean;
  synchronizer: boolean;
}

export interface CommercialPlan {
  id: string;
  name: string;
  tier: CommercialPlanTier;
  priceMonthly: number;
  priceAnnual: number;
  limits: CommercialPlanLimits;
  isActive: boolean;
  createdAt: string;
}

export interface CommercialSubscription {
  id: string;
  userId: string;
  planId: string;
  licenseId?: string;
  status: CommercialSubscriptionStatus;
  billingCycle: 'MONTHLY' | 'ANNUAL' | 'LIFETIME' | 'TRIAL';
  startsAt: string;
  expiresAt: string | null;
  paymentProvider?: string;
  externalSubId?: string;
  createdAt: string;
}

export interface CommercialDevice {
  id: string;
  userId: string;
  licenseId?: string;
  deviceId: string;
  deviceName: string;
  osInfo: string;
  clientVersion: string;
  ipAddress?: string;
  activatedAt: string;
  lastSeenAt: string;
  status: CommercialDeviceStatus;
}

export interface CommercialAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: CommercialRole;
  action: string;
  targetType: string;
  targetId?: string;
  details: string;
  ipAddress?: string;
  result: CommercialAuditResult;
  createdAt: string;
}

export interface SoftwareVersionRecord {
  id: string;
  version: string;
  releaseNotes: string;
  minSupportedVersion: string;
  downloadUrlSetup?: string;
  downloadUrlPortable?: string;
  isMandatory: boolean;
  releasedAt: string;
}

export interface CommercialEntitlements {
  allowed: boolean;
  reason?: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: CommercialRole;
    status: CommercialUserStatus;
  };
  plan: CommercialPlan;
  subscription?: CommercialSubscription;
  license?: {
    id: string;
    keyMasked: string;
    status: string;
    expiresAt: string | null;
  };
  device: {
    deviceId: string;
    status: CommercialDeviceStatus;
    isAuthorized: boolean;
  };
  limits: CommercialPlanLimits;
  usage: {
    profilesCount: number;
    runningProfilesCount: number;
    activeDevicesCount: number;
  };
}

export interface RegisterUserDTO {
  email: string;
  password: string;
  name?: string;
  licenseKey?: string;
}

export interface LoginUserDTO {
  email: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
}

export interface AuthSessionResponse {
  success: boolean;
  token?: string;
  user?: CommercialUser;
  entitlements?: CommercialEntitlements;
  message?: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  activeLicenses: number;
  expiredLicenses: number;
  activeDevices: number;
  activeSubscriptions: number;
  totalPlans: number;
  revenueEstMonthly: number;
  recentAuditLogs: CommercialAuditLog[];
}
