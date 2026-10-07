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
import { UpdateStatusEvent } from './updater.js';
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


  startProfile: (id: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
  stopProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
  quickSwitchProfile: (number: number) => Promise<{ success: boolean; action?: 'FOCUSED' | 'LAUNCHED'; profile?: Profile; error?: string }>;
  getProfileStatus: (id: string) => Promise<{ status: string; pid?: number }>;
  getRunningProfiles: () => Promise<string[]>;

  getProfileStats: (id: string) => Promise<{ totalSessions: number; totalUptimeSeconds: number; lastSessionStartedAt: string | null; lastSessionStoppedAt: string | null } | null>;
  warmProfile: (id: string, options?: any) => Promise<any>;
  warmBulkProfiles: (ids: string[], options?: any) => Promise<any>;


  // Dashboard

  getDashboardMetrics: () => Promise<DashboardMetrics>;

  // Proxies
  getProxies: () => Promise<ProxyItem[]>;
  getProxyById: (id: string) => Promise<ProxyItem | null>;
  createProxy: (dto: CreateProxyDTO) => Promise<ProxyItem>;
  parseAndCreateProxy: (rawString: string, customName?: string) => Promise<{ proxy: ProxyItem; testResult: ProxyTestResult }>;
  updateProxy: (id: string, dto: UpdateProxyDTO) => Promise<ProxyItem>;
  deleteProxy: (id: string) => Promise<boolean>;
  testProxy: (dto: Partial<CreateProxyDTO>) => Promise<ProxyTestResult>;


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
  exportNetscapeCookies: (profileId: string) => Promise<string>;
  exportBulkProfiles: (options: BulkExportOptions) => Promise<{ success: boolean; filePath: string; profileCount: number }>;
  importCrossPlatformProfiles: (dto: CrossPlatformImportDTO) => Promise<CrossPlatformImportResult>;


  // Licensing & MAHI Pro
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







  // Auto-Updater
  checkForUpdates: () => Promise<UpdateStatusEvent>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<boolean>;
  getUpdateStatus: () => Promise<UpdateStatusEvent>;

  // Resource Monitoring & Memory Optimizer
  getFleetResources: () => Promise<FleetResourceSummary>;
  optimizeFleetMemory: () => Promise<{ freedMB: number; status: string }>;

  // Master Encrypted Vault Backup & Restore
  exportMasterVault: (options?: MasterVaultExportOptions) => Promise<{ success: boolean; filePath: string }>;
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
  commercialSyncUser: (user: { id: string; email: string; name?: string }) => Promise<any>;
  commercialGetEntitlements: (userId: string, deviceId?: string) => Promise<any>;
  commercialGetDevices: (userId: string) => Promise<any>;
  commercialRevokeDevice: (deviceId: string, userId: string) => Promise<boolean>;
  commercialGetPlans: () => Promise<any>;
  commercialActivateKey: (userId: string, rawKey: string) => Promise<any>;

  // Managed Browser Engine
  getManagedEngineStatus: () => Promise<ManagedEngineStatus>;
  downloadManagedEngine: () => Promise<{ success: boolean; path?: string; error?: string }>;

  // Event Listeners
  onProfileStatusChanged: (callback: (data: { profileId: string; status: string; pid?: number; error?: string }) => void) => () => void;
  onActivityLogAdded: (callback: (log: ActivityLogItem) => void) => () => void;
  onUpdateStatusChanged: (callback: (status: UpdateStatusEvent) => void) => () => void;
  onFleetResourceUsage: (callback: (summary: FleetResourceSummary) => void) => () => void;
  onEngineDownloadProgress: (callback: (status: ManagedEngineStatus) => void) => () => void;
  onLicenseStatusChanged: (callback: (status: any) => void) => () => void;
  onLicenseStatusToast: (callback: (toast: { title: string; message: string; type: string }) => void) => () => void;
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

