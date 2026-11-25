import {
  Profile,
  CreateProfileDTO,
  UpdateProfileDTO,
  CloneProfileDTO,
  ProfileFilterOptions,
} from './profile.js';
import {
  ProxyItem,
  CreateProxyDTO,
  UpdateProxyDTO,
  ProxyTestResult,
} from './proxy.js';
import {
  ProxyProviderInfo,
  ProxyCatalogQuery,
  ProxyCatalogResult,
  ProxySessionGenerateRequest,
  ProxySessionResult,
  ProxySessionRecord,
  ProxyUsageReport,
  ProxyRotationResult,
} from './proxy-provider.js';
import {
  CookieItem,
  CookieFilterOptions,
  CookieExportOptions,
  CookieImportResult,
} from './cookie.js';
import { HistoryItem, HistoryFilterOptions } from './history.js';

import { ExtensionItem, InstallExtensionDTO } from './extension.js';
import {
  ProfileFolder,
  ProfileLock,
  FeatureFlagDefinition,
  DeviceRecord,
  FleetTelemetry,
  ApiKeyRecord,
} from './platform.js';


import {
  AutomationWorkflow,
  WorkflowExecutionLog,
  RunWorkflowDTO,
  RunWorkflowBatchDTO,
  RpaTemplate,
} from './automation.js';

import { AppSettings } from './settings.js';
import { ActivityLogItem, ActivityLogFilter } from './logs.js';
import { ProfileAuditReport } from './diagnostics.js';
import {
  CaptchaConfig,
  CaptchaBalanceResult,
  CaptchaSolveRequest,
  CaptchaSolveResult,
  CaptchaProvider,
} from './captcha.js';
import { UpdateStatusEvent, UpdateConfig, UpdateInstallOptions, UpdateInstallResult } from './updater.js';
import {
  FleetResourceSummary,
  MasterVaultExportOptions,
  MasterVaultImportResult,
} from './resources.js';
import {
  Workspace,
  TeamMember,
  MemberRole,
  CreateWorkspaceDTO,
  CreateMemberDTO,
  WorkspaceBundleExportOptions,
  TeamWorkspace,
  TeamWorkspaceMember,
  TeamRole,
  TeamWorkspaceInvitation,
  TeamProfileShare,
  TeamWorkspaceAuditLog,
} from './workspace.js';
import {


  ExportProfileOptions,
  BulkExportOptions,

  ImportProfileOptions,
  ImportProfilePreview,
  CrossPlatformImportDTO,
  CrossPlatformImportResult,
} from './archive.js';

import {
  LicenseRecord,
  LicenseStatus,
  CreateLicenseDTO,
  CreateLicenseResponse,
  ActivateLicenseDTO,
  LicenseValidationResult,
  ExtendLicenseDTO,
  ActivatedDevice,
} from './license.js';


export interface DashboardMetrics {
  totalProfiles: number;
  runningProfiles: number;
  stoppedProfiles: number;
  totalProxies: number;
  activeProxies: number;
  totalWorkflows: number;
  recentActivity: ActivityLogItem[];
  recentProfiles: Profile[];
}

export interface AppDiagnostics {
  version: string;
  platform: string;
  arch: string;
  electron: string;
  node: string;
  generatedAt: string;
  logTail: string;
}

export interface ProfileCacheCleanupResult {
  dryRun: boolean;
  baseDir: string;
  cacheFoldersMatched: number;
  filesMatched: number;
  bytesReclaimable: number;
  mbReclaimable: number;
  gbReclaimable: number;
  deletedFolders: number;
  skippedLockedFolders: number;
  skippedProtectedCount: number;
  errors: string[];
}

export interface MahiBrowserAPI {
  // Profiles
  getProfiles: (filter?: ProfileFilterOptions) => Promise<Profile[]>;
  getProfileById: (id: string) => Promise<Profile | null>;
  createProfile: (dto: CreateProfileDTO) => Promise<Profile>;
  bulkCreateProfiles: (dto: { count: number; namePrefix?: string; folder?: string; tags?: string[]; proxyId?: string; osType?: 'windows' | 'mac' | 'random' }) => Promise<Profile[]>;
  bulkStartProfiles: (profileIds: string[], delayMs?: number) => Promise<{ results: { profileId: string; success: boolean; pid?: number; error?: string }[] }>;
  bulkStopProfiles: (profileIds: string[]) => Promise<{ results: { profileId: string; success: boolean }[] }>;
  bulkUpdateProfiles: (dto: { profileIds: string[]; folder?: string; addTags?: string[]; removeTags?: string[]; notes?: string }) => Promise<{ updatedCount: number; profiles: Profile[] }>;
  bulkDeleteProfiles: (profileIds: string[]) => Promise<{ deletedCount: number; success: boolean }>;
  bulkAssignProxies: (dto: { profileIds: string[]; proxyIds: string[]; distributionMode: 'single' | 'round-robin' | 'clear' }) => Promise<{ assignedCount: number; profiles: Profile[] }>;
  onBatchProgress: (callback: (progress: { completed: number; total: number; profileId: string; success: boolean; pid?: number; error?: string }) => void) => () => void;
  updateProfile: (id: string, dto: UpdateProfileDTO) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<boolean>;
  getTrashProfiles: () => Promise<Profile[]>;
  restoreProfile: (id: string) => Promise<Profile>;
  permanentDeleteProfile: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<{ deletedCount: number; success: boolean }>;
  cloneProfile: (dto: CloneProfileDTO) => Promise<Profile>;
  claimLegacy: (dto: { profileIds: string[]; userConfirmed: boolean; machineHwid?: string }) => Promise<{ success: boolean; claimedCount: number; claimedIds?: string[]; skippedIds?: string[]; error?: string }>;
  getUnassignedLegacy: () => Promise<Profile[]>;


  startProfile: (id: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
  stopProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
  quickSwitchProfile: (number: number) => Promise<{ success: boolean; action?: 'FOCUSED' | 'LAUNCHED'; profile?: Profile; error?: string }>;
  getProfileStatus: (id: string) => Promise<{ status: string; pid?: number }>;
  getRunningProfiles: () => Promise<string[]>;
  previewProfileCacheCleanup: () => Promise<ProfileCacheCleanupResult>;
  applyProfileCacheCleanup: () => Promise<ProfileCacheCleanupResult>;

  getProfileStats: (id: string) => Promise<{ totalSessions: number; totalUptimeSeconds: number; lastSessionStartedAt: string | null; lastSessionStoppedAt: string | null } | null>;
  warmProfile: (id: string, options?: any) => Promise<any>;
  warmBulkProfiles: (ids: string[], options?: any) => Promise<any>;


  // Dashboard

  getDashboardMetrics: () => Promise<DashboardMetrics>;

  // Proxies (BYOP)
  getProxies: () => Promise<ProxyItem[]>;
  getProxyById: (id: string) => Promise<ProxyItem | null>;
  createProxy: (dto: CreateProxyDTO) => Promise<ProxyItem>;
  parseAndCreateProxy: (rawString: string, customName?: string) => Promise<{ proxy: ProxyItem; testResult: ProxyTestResult }>;
  updateProxy: (id: string, dto: UpdateProxyDTO) => Promise<ProxyItem>;
  deleteProxy: (id: string) => Promise<boolean>;
  testProxy: (dto: Partial<CreateProxyDTO> & { proxyId?: string; id?: string }) => Promise<ProxyTestResult>;

  // Commercial Proxy Catalog & Provider Platform (Phase 5)
  getProxyCatalog: (query?: ProxyCatalogQuery) => Promise<ProxyCatalogResult>;
  getProxyProviders: () => Promise<ProxyProviderInfo[]>;
  generateProxySession: (request: ProxySessionGenerateRequest) => Promise<ProxySessionResult>;
  rotateProxySession: (sessionId: string) => Promise<ProxyRotationResult>;
  releaseProxySession: (sessionId: string) => Promise<boolean>;
  getProxySessions: () => Promise<ProxySessionRecord[]>;
  getProxyUsage: (sessionId?: string) => Promise<ProxyUsageReport>;


  // Cookies
  getCookies: (options: CookieFilterOptions) => Promise<CookieItem[]>;
  deleteCookie: (profileId: string, cookieId: string) => Promise<boolean>;
  deleteAllCookies: (profileId: string) => Promise<boolean>;
  importCookies: (profileId: string, cookiesJsonOrNetscape: string) => Promise<CookieImportResult>;
  exportCookies: (options: CookieExportOptions) => Promise<string>;

  // History
  getHistory: (options: HistoryFilterOptions) => Promise<HistoryItem[]>;
  deleteHistoryItem: (profileId: string, historyId: string) => Promise<boolean>;
  clearHistory: (profileId: string) => Promise<boolean>;

  // Extensions
  getExtensions: (profileId: string) => Promise<ExtensionItem[]>;
  getStoreExtensions?: () => Promise<any[]>;
  installExtension: (dto: InstallExtensionDTO) => Promise<ExtensionItem>;
  installExtensionFromStore?: (profileId: string, storeExtensionId: string) => Promise<ExtensionItem>;
  installExtensionBatch?: (dto: any) => Promise<{ installedCount: number; extensions: ExtensionItem[] }>;
  installFromWebStoreUrl: (profileId: string, webStoreUrl: string) => Promise<ExtensionItem>;
  toggleExtension: (profileId: string, extensionId: string, enabled: boolean) => Promise<boolean>;
  removeExtension: (profileId: string, extensionId: string) => Promise<boolean>;


  // Automation
  getWorkflows: () => Promise<AutomationWorkflow[]>;
  getWorkflowById: (id: string) => Promise<AutomationWorkflow | null>;
  saveWorkflow: (workflow: Partial<AutomationWorkflow>) => Promise<AutomationWorkflow>;
  deleteWorkflow: (id: string) => Promise<boolean>;
  runWorkflow: (dto: RunWorkflowDTO) => Promise<WorkflowExecutionLog>;
  runWorkflowBatch: (dto: RunWorkflowBatchDTO) => Promise<WorkflowExecutionLog[]>;
  getAutomationTemplates: () => Promise<RpaTemplate[]>;
  getWorkflowLogs: (workflowId?: string) => Promise<WorkflowExecutionLog[]>;


  // Archives / Import & Export
  previewImportProfile: (filePath: string, password?: string) => Promise<ImportProfilePreview>;
  importProfile: (options: ImportProfileOptions) => Promise<Profile>;
  exportProfile: (options: ExportProfileOptions) => Promise<{ success: boolean; filePath: string }>;
  exportNetscapeCookies: (profileId: string, targetFilePath?: string) => Promise<string>;
  exportBulkProfiles: (options: BulkExportOptions) => Promise<{ success: boolean; filePath: string; profileCount: number }>;
  importCrossPlatformProfiles: (dto: CrossPlatformImportDTO) => Promise<CrossPlatformImportResult>;


  // Licensing & MAHI Pro
  getDynamicPrice: () => Promise<number>;
  getLicenseStatus: () => Promise<LicenseValidationResult>;
  getOnlineLicenseStatus: () => Promise<{ verified: boolean; revoked: boolean; graceExpired: boolean; offlineDaysLeft: number; statusText: string }>;
  checkOnlineLicenseNow: () => Promise<{ success: boolean; status?: string; error?: string }>;
  activateLicense: (dto: ActivateLicenseDTO) => Promise<{ success: boolean; status: LicenseStatus; license?: LicenseRecord; message?: string }>;
  getHwid: () => Promise<string>;
  getPlanLimits: () => Promise<{ isPro: boolean; currentCount: number; maxAllowed: number; remaining: number; expiresAt?: string | null }>;
  adminCreateLicense: (dto: CreateLicenseDTO, adminSecret: string) => Promise<CreateLicenseResponse>;
  adminGetLicenses: (adminSecret: string, filter?: { status?: string; searchQuery?: string }) => Promise<LicenseRecord[]>;
  adminRevokeLicense: (licenseId: string, adminSecret: string, reason?: string) => Promise<boolean>;
  adminExtendLicense: (dto: ExtendLicenseDTO, adminSecret: string) => Promise<LicenseRecord | null>;
  adminGetLicenseDevices: (licenseId: string, adminSecret: string) => Promise<ActivatedDevice[]>;
  adminDeactivateDevice: (licenseId: string, deviceId: string, adminSecret: string) => Promise<boolean>;
  adminSetPin: (newPin: string, adminSecret: string) => Promise<boolean>;

  // Settings & Security

  getAppSettings: () => Promise<AppSettings>;

  updateAppSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  verifyAppPin: (pin: string) => Promise<boolean>;
  setAppPin: (newPin: string, oldPin?: string) => Promise<boolean>;

  // Logs
  getActivityLogs: (filter?: ActivityLogFilter) => Promise<ActivityLogItem[]>;
  clearActivityLogs: () => Promise<boolean>;

  // System & Dialogs
  openFileDialog: (options?: { title?: string; filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => Promise<string[] | null>;
  openSaveDialog: (options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  getSystemBrowsers: () => Promise<{ name: string; path: string; engine: string }[]>;

  // Mobile IP Rotator
  mobileRotatorCheckIp: () => Promise<any>;
  mobileRotatorGetDevices: () => Promise<any[]>;
  mobileRotatorRotate: (config?: any) => Promise<any>;
  mobileRotatorGetConfig: () => Promise<any>;
  mobileRotatorSaveConfig: (config: any) => Promise<any>;

  // Universal Bulk Importer
  importerParsePreview: (rawText: string) => Promise<any[]>;
  importerExecuteBulkImport: (accounts: any[], options?: any) => Promise<any>;
  importerParseNetscape: (rawText: string) => Promise<any[]>;

  // Multi-Window Synchronizer
  synchronizerStart: (masterProfileId?: string, activeProfiles?: string[], config?: any) => Promise<any>;
  synchronizerStop: () => Promise<any>;
  synchronizerGetStatus: () => Promise<any>;
  synchronizerUpdateConfig: (config: any) => Promise<any>;

  // Fingerprint Diagnostics & Stealth Auditor
  diagnosticsAudit: (profileId: string) => Promise<ProfileAuditReport>;
  diagnosticsAutoFix: (profileId: string) => Promise<ProfileAuditReport>;
  generateStatisticalFingerprint?: (options?: any) => Promise<any>;

  // Captcha Solver Engine
  captchaGetConfig: () => Promise<CaptchaConfig>;
  captchaSaveConfig: (config: Partial<CaptchaConfig>) => Promise<boolean>;
  captchaCheckBalance: (provider: CaptchaProvider, apiKey: string) => Promise<CaptchaBalanceResult>;
  captchaSolve: (request: CaptchaSolveRequest) => Promise<CaptchaSolveResult>;

  // Workspaces & Team Collaboration
  workspaceGetAll: () => Promise<Workspace[]>;
  workspaceGetById: (id: string) => Promise<Workspace | null>;
  workspaceCreate: (dto: CreateWorkspaceDTO) => Promise<Workspace>;
  workspaceUpdate: (id: string, dto: Partial<CreateWorkspaceDTO>) => Promise<Workspace>;
  workspaceDelete: (id: string) => Promise<boolean>;
  workspaceGetActive: () => Promise<string>;
  workspaceSetActive: (id: string) => Promise<boolean>;
  workspaceGetMembers: (workspaceId: string) => Promise<TeamMember[]>;
  workspaceAddMember: (dto: CreateMemberDTO) => Promise<TeamMember>;
  workspaceUpdateMemberRole: (memberId: string, role: MemberRole) => Promise<boolean>;
  workspaceDeleteMember: (memberId: string) => Promise<boolean>;
  workspaceAssignProfile: (profileId: string, workspaceId: string, memberId: string | null) => Promise<boolean>;
  workspaceExportBundle: (options: WorkspaceBundleExportOptions) => Promise<string>;
  workspaceImportBundle: (bundleJson: string, targetWorkspaceId?: string) => Promise<{ importedProfilesCount: number; workspaceId: string }>;

  // Phase 3 Multi-User Team Workspaces & RBAC
  teamWorkspaceList: () => Promise<TeamWorkspace[]>;
  teamWorkspaceCreate: (input: { name: string; description?: string }) => Promise<TeamWorkspace>;
  teamWorkspaceGet: (workspaceId: string) => Promise<TeamWorkspace | null>;
  teamWorkspaceUpdate: (workspaceId: string, updates: { name?: string; description?: string }) => Promise<TeamWorkspace>;
  teamWorkspaceDelete: (workspaceId: string) => Promise<boolean>;
  teamWorkspaceTransferOwnership: (workspaceId: string, newOwnerId: string) => Promise<boolean>;
  teamWorkspaceGetMembers: (workspaceId: string) => Promise<TeamWorkspaceMember[]>;
  teamWorkspaceInviteMember: (workspaceId: string, email: string, role: TeamRole) => Promise<any>;
  teamWorkspaceUpdateMemberRole: (workspaceId: string, memberUserId: string, role: TeamRole) => Promise<boolean>;
  teamWorkspaceRemoveMember: (workspaceId: string, memberUserId: string) => Promise<boolean>;
  teamWorkspaceListInvitations: (workspaceId: string) => Promise<TeamWorkspaceInvitation[]>;
  teamWorkspaceRevokeInvitation: (workspaceId: string, inviteId: string) => Promise<boolean>;
  teamWorkspaceAcceptInvitation: (token: string) => Promise<{ success: boolean; workspaceId: string; role: TeamRole }>;
  teamWorkspaceListProfiles: (workspaceId: string) => Promise<TeamProfileShare[]>;
  teamWorkspaceShareProfile: (workspaceId: string, input: { cloudProfileId: string; permissionLevel?: 'VIEW' | 'RUN' | 'EDIT' | 'ADMIN'; encryptedKeyEnvelope: string }) => Promise<TeamProfileShare>;
  teamWorkspaceRevokeProfileShare: (workspaceId: string, cloudProfileId: string) => Promise<boolean>;
  teamWorkspaceGetAuditLogs: (workspaceId: string, limit?: number) => Promise<TeamWorkspaceAuditLog[]>;

  // Auto-Updater
  checkForUpdates: (channel?: 'STABLE' | 'BETA') => Promise<UpdateStatusEvent>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: (options?: UpdateInstallOptions) => Promise<UpdateInstallResult>;
  getUpdateStatus: () => Promise<UpdateStatusEvent>;
  getUpdateConfig: () => Promise<UpdateConfig>;
  setUpdateConfig: (config: Partial<UpdateConfig>) => Promise<UpdateConfig>;
  getAppVersion: () => Promise<string>;
  getDiagnostics: () => Promise<AppDiagnostics>;


  // Resource Monitoring & Memory Optimizer
  getFleetResources: () => Promise<FleetResourceSummary>;
  optimizeFleetMemory: () => Promise<{ freedMB: number; status: string }>;

  // Master Encrypted Vault Backup & Restore
  exportMasterVault: (options?: MasterVaultExportOptions) => Promise<{ success: boolean; filePath: string; error?: string }>;
  importMasterVault: (bundleJson: string, password?: string) => Promise<MasterVaultImportResult>;

  // V2 Platform: Folders & Locking
  getFolders: (workspaceId?: string) => Promise<ProfileFolder[]>;
  createFolder: (dto: { name: string; parentId?: string | null; color?: string; icon?: string; workspaceId?: string }) => Promise<ProfileFolder>;
  updateFolder: (id: string, updates: { name?: string; parentId?: string | null; color?: string; icon?: string }) => Promise<ProfileFolder | null>;
  deleteFolder: (id: string, targetFolderName?: string) => Promise<boolean>;
  getProfileLock: (profileId: string) => Promise<ProfileLock | null>;
  acquireProfileLock: (profileId: string, userId: string, userName: string, deviceId: string) => Promise<{ success: boolean; lock?: ProfileLock; currentLock?: ProfileLock }>;
  releaseProfileLock: (profileId: string, userId?: string) => Promise<boolean>;

  // V2 Platform: Feature Flags & Fleet
  getFeatureFlags: () => Promise<FeatureFlagDefinition[]>;
  updateFeatureFlag: (key: string, updates: Partial<FeatureFlagDefinition>) => Promise<FeatureFlagDefinition | null>;
  checkFeatureFlag: (key: string, userTier?: any, userId?: string, orgId?: string) => Promise<boolean>;
  getFleetDevices: () => Promise<DeviceRecord[]>;
  getFleetTelemetry: () => Promise<FleetTelemetry>;
  revokeDevice: (deviceId: string) => Promise<boolean>;

  // V2 Platform: Developer API Keys
  getApiKeys: (userId?: string) => Promise<ApiKeyRecord[]>;
  generateApiKey: (name: string, userId?: string, scopes?: string[]) => Promise<{ keyRecord: ApiKeyRecord; secretKey: string }>;
  revokeApiKey: (keyId: string) => Promise<boolean>;

  // Distribution & Shortcuts Management
  getDistributionInfo: () => Promise<any>;
  openDistributionFolder: () => Promise<boolean>;
  fixDesktopShortcuts: () => Promise<{ success: boolean; message: string; shortcuts: string[] }>;
  createProfileShortcut: (profileId: string, profileName: string) => Promise<{ success: boolean; path: string }>;

  // Commercial Architecture APIs
  commercialRegister: (dto: any) => Promise<any>;
  commercialLogin: (dto: any) => Promise<any>;
  commercialLogout: () => Promise<{ success: boolean }>;
  commercialGetEntitlements: (userId: string, deviceId?: string) => Promise<any>;
  commercialGetDevices: (userId: string) => Promise<any>;
  commercialRevokeDevice: (deviceId: string, userId: string) => Promise<boolean>;
  commercialGetPlans: () => Promise<any>;
  commercialActivateKey: (userId: string, rawKey: string) => Promise<any>;

  // Starter / Demo Profiles (New User Clean Onboarding)
  getStarterTemplates: () => Promise<any[]>;
  getStarterTemplateById: (id: string) => Promise<any | null>;
  isUserNew: (ownerId?: string) => Promise<boolean>;
  createProfileFromStarter: (templateId: string, options?: any) => Promise<Profile>;

  // Central Entitlements & Capabilities
  getEntitlements: (userId?: string, deviceId?: string) => Promise<any>;
  checkCapability: (capability: string, userId?: string) => Promise<{ entitled: boolean; reason?: string }>;

  // Managed Browser Engine
  getManagedEngineStatus: () => Promise<ManagedEngineStatus>;
  downloadManagedEngine: () => Promise<{ success: boolean; path?: string; error?: string }>;
  repairManagedEngine: () => Promise<{ success: boolean; path?: string; error?: string }>;

  // Cloud Profile Sync (GoLogin-style)
  getCloudSyncAllowed: () => Promise<{ allowed: boolean; reason?: string }>;
  getCloudSyncUsage: () => Promise<any>;
  getCloudSyncList: () => Promise<any[]>;
  uploadProfileToCloud: (profileId: string, options?: { force?: boolean; baseVersion?: number; mode?: 'full' | 'cookies_only' }) => Promise<{ success: boolean; skipped?: boolean; reason?: 'unchanged'; mode?: 'full' | 'cookies_only'; cloudProfile?: any; conflict?: boolean }>;
  downloadAndRestoreProfile: (cloudProfileId: string, options?: any) => Promise<any>;
  deleteCloudProfile: (cloudProfileId: string) => Promise<boolean>;
  getCloudSyncConfig: () => Promise<any>;
  setCloudSyncConfig: (config: any) => Promise<any>;
  syncAllProfiles: () => Promise<void>;
  getAllProfilesSyncStatus: () => Promise<Record<string, string>>;
  resolveSyncConflict: (profileId: string, resolution: 'DOWNLOAD_LATEST' | 'KEEP_LOCAL_AS_NEW' | 'OVERWRITE_FORCE') => Promise<any>;
  acquireCloudLock: (cloudProfileId: string, ttlSeconds?: number) => Promise<{ acquired: boolean; heldBy?: string; expiresAt?: string }>;
  releaseCloudLock: (cloudProfileId: string) => Promise<boolean>;
  getCloudLockStatus: (cloudProfileId: string) => Promise<{ isLocked: boolean; heldBy?: string; expiresAt?: string }>;
  onSyncProgress: (callback: (event: any) => void) => () => void;

  // Account & Subscription System (v1.1.0+)
  accountSignup: (dto: { email: string; password: string }) => Promise<{ success: boolean; token?: string; user?: any; error?: string }>;
  accountLogin: (dto: { email: string; password: string }) => Promise<{ success: boolean; token?: string; user?: any; error?: string }>;
  accountLoginWithToken: (dto: { token: string } | string) => Promise<{ success: boolean; token?: string; user?: any; error?: string }>;
  accountLogout: () => Promise<{ success: boolean }>;
  accountGetStatus: () => Promise<any>;
  accountSwitchDevice: () => Promise<{ success: boolean; message: string }>;
  accountGetPaymentInfo: () => Promise<any>;
  accountGetPricingCatalog?: () => Promise<{ success: boolean; catalog?: any; error?: string }>;
  accountCreateCheckoutSession?: (payload: any) => Promise<{ success: boolean; session?: any; error?: string }>;
  accountSubmitManualUpiPayment: (payload: { plan_id: string; utr: string; proof_asset?: string; billing_cycle?: string; amount_paise?: number; extra_members?: number; extra_proxy_gb?: number }) => Promise<{ success: boolean; payment_id?: string; status?: string; message?: string; error?: string }>;
  accountGetPaymentStatus?: () => Promise<{ success: boolean; payments?: any[]; error?: string }>;
  accountGetSession: () => Promise<any>;
  accountGetPlanLimits: (dto?: { force?: boolean }) => Promise<{ isPro: boolean; plan: string; maxProfiles: number; expiresAt: string | null }>;
  accountRefreshPlanLimits: () => Promise<{ isPro: boolean; plan: string; maxProfiles: number; expiresAt: string | null }>;

  accountVerifyEmail: (dto: { token: string }) => Promise<{ success: boolean; error?: string }>;
  accountResendVerification: (dto: { email: string }) => Promise<{ success: boolean; error?: string }>;
  accountForgotPassword: (dto: { email: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  accountResetPassword: (dto: { token: string; newPassword: string }) => Promise<{ success: boolean; error?: string }>;
  accountListSessions: () => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
  accountRevokeSession: (dto: { sessionId: string }) => Promise<{ success: boolean; error?: string }>;
  accountRevokeAllSessions: (dto?: { keepCurrent?: boolean }) => Promise<{ success: boolean; error?: string }>;
  accountRefreshToken: () => Promise<{ success: boolean; token?: string; error?: string }>;
  accountStartDesktopOAuth?: (planId?: string) => Promise<{ success: boolean; ticket: string; authUrl: string; error?: string }>;
  accountExchangeDesktopCode?: (dto: { ticket: string; code: string } | string, code?: string) => Promise<{ success: boolean; token?: string; user?: any; error?: string }>;
  accountActivateTrial?: (planId?: string) => Promise<{ success: boolean; error?: string; trialStatus?: any; entitlements?: any; message?: string }>;
  accountGetTrialStatus?: () => Promise<{ success: boolean; isTrialActive?: boolean; daysRemaining?: number; isEligibleForTrial?: boolean; error?: string }>;
  onAccountStatusChanged?: (callback: (data: any) => void) => () => void;

  // Event Listeners
  onProfileStatusChanged: (callback: (data: { profileId: string; status: string; pid?: number; error?: string }) => void) => () => void;
  onActivityLogAdded: (callback: (log: ActivityLogItem) => void) => () => void;
  onUpdateStatusChanged: (callback: (status: UpdateStatusEvent) => void) => () => void;
  onFleetResourceUsage: (callback: (summary: FleetResourceSummary) => void) => () => void;
  onEngineDownloadProgress: (callback: (status: ManagedEngineStatus) => void) => () => void;
  onCamoufoxDownloadProgress: (callback: (status: CamoufoxProgressEvent) => void) => () => void;
  onLicenseStatusChanged: (callback: (status: any) => void) => () => void;
  onLicenseStatusToast: (callback: (toast: { title: string; message: string; type: string }) => void) => () => void;
  onToastShow: (callback: (toast: { type: 'info' | 'warning' | 'error' | 'success'; title: string; message: string }) => void) => () => void;
  isDesktop?: boolean;
}

export interface CamoufoxProgressEvent {
  stage: 'RESOLVING' | 'DOWNLOADING' | 'VERIFYING' | 'EXTRACTING' | 'READY' | 'FAILED';
  receivedBytes?: number;
  totalBytes?: number;
  percent?: number;
  tag?: string;
  assetName?: string;
  error?: string;
}

export interface ManagedEngineStatus {
  installed: boolean;
  version: string;
  path: string;
  stage: 'IDLE' | 'CHECKING' | 'DOWNLOADING' | 'VERIFYING' | 'EXTRACTING' | 'READY' | 'ERROR';
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

declare global {
  interface Window {
    mahiAPI: MahiBrowserAPI;
  }
}

