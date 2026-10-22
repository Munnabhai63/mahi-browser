/**
 * MAHI Platform — Commercial Domain Models & Type Definitions
 */

export type CommercialRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'BILLING' | 'USER';

export type CommercialUserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type CommercialPlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE' | 'CUSTOM';

export type CommercialSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED';

export type CommercialDeviceStatus = 'ACTIVE' | 'REVOKED';

export type CommercialAuditResult = 'SUCCESS' | 'FAILURE' | 'WARNING';

// ─── Canonical Plan Identity ───────────────────────────────────────────────────
// Immutable plan identifiers — NEVER use display names or prices as identity.
export type CanonicalPlanId =
  | 'free'
  | 'professional_10'
  | 'professional_25'
  | 'professional_50'
  | 'professional_100'
  | 'business_starter'   // Team 50
  | 'business_growth'    // Team 100
  | 'business_scale'     // Team 200
  | 'business_enterprise' // Team 300
  | 'enterprise_custom';

export type PlanCategory = 'PERSONAL' | 'BUSINESS';

export type PlanStatus = 'ACTIVE' | 'HIDDEN' | 'ARCHIVED';

export type BillingCycleType = 'MONTHLY' | 'ANNUAL';

export type PricingPublishStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHING' | 'PUBLISHED' | 'PUBLISH_FAILED' | 'ROLLED_BACK';

export type ExistingSubscriberPolicy = 'GRANDFATHER' | 'MIGRATE_ON_RENEWAL';

export type PriceMode = 'FIXED' | 'CUSTOM';

// ─── Canonical Plan Definition ─────────────────────────────────────────────────
export interface CanonicalPlanDefinition {
  planId: CanonicalPlanId;
  displayName: string;
  category: PlanCategory;
  tier: CommercialPlanTier;
  tierRank: number;                   // For cumulative feature comparison (higher = more features)
  currency: string;
  priceMode: PriceMode;
  profileLimit: number;
  seatLimit: number;
  cloudMinutesMonthly: number;
  proxyDataGbMonthly: number;
  automationConcurrency: number;
  apiRequestsMonthly: number;
  workspaceLimit: number;
  capabilities: Record<FeatureCapability, boolean>;
  status: PlanStatus;
  displayOrder: number;
}

// ─── Plan Price (Admin-Controlled, Separate from Plan Definition) ──────────────
export interface PlanPrice {
  planId: CanonicalPlanId;
  monthlyPricePaise: number;          // Integer minor units (₹ × 100)
  annualPricePaise: number;           // Integer minor units (₹ × 100)
  currency: string;
}

// ─── Pricing Version (Immutable Snapshot) ──────────────────────────────────────
export interface PricingVersion {
  version: number;
  status: PricingPublishStatus;
  prices: PlanPrice[];
  annualDiscountPercent: number;
  existingSubscriberPolicy: ExistingSubscriberPolicy;
  publishedAt: string | null;
  publishedBy: string | null;
  effectiveAt: string | null;
  createdAt: string;
  providerSyncStatus: Record<string, 'SYNCED' | 'PENDING' | 'ERROR' | 'NOT_CONFIGURED'>;
}

// ─── Provider Price Mapping ────────────────────────────────────────────────────
export interface ProviderPriceMapping {
  id: string;
  provider: string;                    // 'stripe' | 'razorpay' | 'simulation'
  planId: CanonicalPlanId;
  billingCycle: BillingCycleType;
  pricingVersion: number;
  providerProductId: string;
  providerPriceId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

// ─── Usage Ledger ──────────────────────────────────────────────────────────────
export type UsageResourceType =
  | 'profiles'
  | 'cloud_minutes'
  | 'proxy_data_gb'
  | 'api_requests'
  | 'automation_runs'
  | 'team_seats';

export interface UsageLedgerEntry {
  id: string;
  userId: string;
  resourceType: UsageResourceType;
  currentUsage: number;
  maxAllowed: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  lastUpdatedAt: string;
}

export type UsageWarningLevel = 'NORMAL' | 'WARNING_80' | 'WARNING_90' | 'LIMIT_REACHED';

export interface UsageStatus {
  resourceType: UsageResourceType;
  currentUsage: number;
  maxAllowed: number;
  percentUsed: number;
  warningLevel: UsageWarningLevel;
}

// ─── Trial ─────────────────────────────────────────────────────────────────────
export interface TrialConfig {
  durationDays: number;
  trialPlanId: CanonicalPlanId;
  cardRequired: boolean;
  maxTrialsPerAccount: number;
}

// ─── Plan Catalog (Public API Response) ────────────────────────────────────────
export interface PlanCatalogEntry {
  planId: CanonicalPlanId;
  displayName: string;
  category: PlanCategory;
  monthlyPriceDisplay: string;         // Formatted: "₹599"
  annualPriceDisplay: string;          // Formatted: "₹299"
  monthlyPricePaise: number;
  annualPricePaise: number;
  currency: string;
  profileLimit: number;
  seatLimit: number;
  cloudMinutesMonthly: number;
  proxyDataGbMonthly: number;
  features: string[];                  // Display-friendly feature list
  capabilities: Record<FeatureCapability, boolean>;
  status: PlanStatus;
  displayOrder: number;
  isPopular: boolean;
  catalogVersion: number;
}

export interface PlanCatalogResponse {
  catalogVersion: number;
  annualDiscountPercent: number;
  currency: string;
  personal: PlanCatalogEntry[];
  business: PlanCatalogEntry[];
  free: PlanCatalogEntry;
}

// ─── Admin Pricing ─────────────────────────────────────────────────────────────
export interface AdminPricingDraft {
  prices: PlanPrice[];
  annualDiscountPercent: number;
  existingSubscriberPolicy: ExistingSubscriberPolicy;
}

export interface AdminPricingPreview {
  changes: Array<{
    planId: CanonicalPlanId;
    displayName: string;
    oldMonthlyPaise: number;
    newMonthlyPaise: number;
    oldAnnualPaise: number;
    newAnnualPaise: number;
  }>;
  priceDiffs?: Array<{
    planId: CanonicalPlanId;
    displayName: string;
    oldMonthlyPaise: number;
    newMonthlyPaise: number;
    oldAnnualPaise: number;
    newAnnualPaise: number;
  }>;
  annualDiscountChange: { old: number; new: number } | null;
  annualDiscountPercent?: number;
  affectedNewCustomers: boolean;
  existingSubscriberPolicy: ExistingSubscriberPolicy;
  existingSubscriberCount: number;
  activeSubscriberCount?: number;
}

// ─── Invoice Snapshot ──────────────────────────────────────────────────────────
export interface InvoiceSnapshot {
  planName: string;
  planId: CanonicalPlanId;
  pricePaise: number;
  currency: string;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  pricingVersion: number;
  transactionRef: string;
}

// ─── Existing Types (Preserved) ───────────────────────────────────────────────

export interface CommercialUser {
  id: string;
  email: string;
  name: string;
  role: CommercialRole;
  status: CommercialUserStatus;
  planId: string;
  bonusProfiles?: number;
  bonusProxyBytes?: number;
  featureOverrides?: Record<string, boolean>;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  trialUsed?: boolean;
  signupIntent?: string;
  pendingPlanId?: string;
  pendingBillingCycle?: string;
  googleSub?: string;
  avatarUrl?: string;
  authProvider?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type FeatureCapability =
  | 'profile.basic'
  | 'profile.multiple'
  | 'cloud.sync'
  | 'cloud.browser'
  | 'proxy.builtin'
  | 'proxy.custom'
  | 'automation.rpa'
  | 'automation.scheduler'
  | 'automation.multiProfile'
  | 'automation.cookieWarmer'
  | 'automation.synchronizer'
  | 'workspace.team'
  | 'workspace.sharing'
  | 'api.remote'
  | 'api.webhooks'
  | 'mobile.cloudBrowser'
  | 'advanced.fingerprint'
  | 'stealth.nativeHooks117'
  | 'stealth.aiHumanizer'
  | 'stealth.multiCore'
  | 'stealth.fakeVideoKYC'
  | 'api.localDaemon';

export interface CommercialPlanLimits {
  maxProfiles: number;
  maxDevices: number;
  maxConcurrentRunning: number;
  proxyAccess: boolean;
  cloudSync: boolean;
  apiAccess: boolean;
  rpaAutomation: boolean;
  synchronizer: boolean;
  cloudBrowser?: boolean;
  cookieWarmer?: boolean;
  scheduler?: boolean;
  teamWorkspaces?: boolean;
  profileSharing?: boolean;
  webhooks?: boolean;
  builtinProxies?: boolean;
  nativeHooks117?: boolean;
  aiHumanizer?: boolean;
  multiCoreEngines?: boolean;
  fakeVideoCapture?: boolean;
  localDaemonApi?: boolean;
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
  pricingVersion?: number;
  cancelAtPeriodEnd?: boolean;
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
  planId?: string;
  maxProfiles?: number;
  isTrialActive?: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: CommercialRole;
    status: CommercialUserStatus;
    planId?: string;
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
  capabilities?: Record<FeatureCapability, boolean>;
  features?: Record<FeatureCapability, boolean>;
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
  intent?: 'trial' | 'free' | 'paid';
  planId?: string;
  billingCycle?: 'annual' | 'monthly';
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
  openTickets?: number;
  escalatedTickets?: number;
}
