"use strict";
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // Profiles
  getProfiles: (filter) => ipcRenderer.invoke('profiles:getAll', filter),
  getProfileById: (id) => ipcRenderer.invoke('profiles:getById', id),
  createProfile: (dto) => ipcRenderer.invoke('profiles:create', dto),
  bulkCreateProfiles: (dto) => ipcRenderer.invoke('profiles:bulkCreate', dto),
  bulkStartProfiles: (profileIds, delayMs) => ipcRenderer.invoke('profiles:bulkStart', profileIds, delayMs),
  bulkStopProfiles: (profileIds) => ipcRenderer.invoke('profiles:bulkStop', profileIds),
  bulkUpdateProfiles: (dto) => ipcRenderer.invoke('profiles:bulkUpdate', dto),
  bulkDeleteProfiles: (profileIds) => ipcRenderer.invoke('profiles:bulkDelete', profileIds),
  bulkAssignProxies: (dto) => ipcRenderer.invoke('profiles:bulkAssignProxies', dto),
  onBatchProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('profiles:batchProgress', handler);
    return () => ipcRenderer.removeListener('profiles:batchProgress', handler);
  },
  updateProfile: (id, dto) => ipcRenderer.invoke('profiles:update', id, dto),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  getTrashProfiles: () => ipcRenderer.invoke('profiles:getTrash'),
  restoreProfile: (id) => ipcRenderer.invoke('profiles:restore', id),
  permanentDeleteProfile: (id) => ipcRenderer.invoke('profiles:permanentDelete', id),
  emptyTrash: () => ipcRenderer.invoke('profiles:emptyTrash'),
  cloneProfile: (dto) => ipcRenderer.invoke('profiles:clone', dto),
  claimLegacy: (dto) => ipcRenderer.invoke('profiles:claimLegacy', dto),
  getUnassignedLegacy: () => ipcRenderer.invoke('profiles:getUnassignedLegacy'),


  startProfile: (id) => ipcRenderer.invoke('profiles:start', id),
  stopProfile: (id) => ipcRenderer.invoke('profiles:stop', id),
  quickSwitchProfile: (number) => ipcRenderer.invoke('profiles:quickSwitch', number),
  getProfileStatus: (id) => ipcRenderer.invoke('profiles:getStatus', id),
  getRunningProfiles: () => ipcRenderer.invoke('profiles:getRunningProfiles'),
  previewProfileCacheCleanup: () => ipcRenderer.invoke('profiles:previewCacheCleanup'),
  applyProfileCacheCleanup: () => ipcRenderer.invoke('profiles:applyCacheCleanup'),


  getProfileStats: (id) => ipcRenderer.invoke('profiles:getStats', id),
  warmProfile: (id, options) => ipcRenderer.invoke('profiles:warm', id, options),
  warmBulkProfiles: (ids, options) => ipcRenderer.invoke('profiles:warmBulk', ids, options),

  // Dashboard

  getDashboardMetrics: () => ipcRenderer.invoke('dashboard:getMetrics'),

  // Proxies
  getProxies: () => ipcRenderer.invoke('proxies:getAll'),
  getProxyById: (id) => ipcRenderer.invoke('proxies:getById', id),
  createProxy: (dto) => ipcRenderer.invoke('proxies:create', dto),
  parseAndCreateProxy: (raw, name) => ipcRenderer.invoke('proxies:parseAndCreate', raw, name),
  updateProxy: (id, dto) => ipcRenderer.invoke('proxies:update', id, dto),
  deleteProxy: (id) => ipcRenderer.invoke('proxies:delete', id),
  testProxy: (dto) => ipcRenderer.invoke('proxies:test', dto),

  // Commercial Proxy Catalog (Phase 5)
  getProxyCatalog: (query) => ipcRenderer.invoke('proxy:getCatalog', query),
  getProxyProviders: () => ipcRenderer.invoke('proxy:getProviders'),
  generateProxySession: (request) => ipcRenderer.invoke('proxy:generateSession', request),
  rotateProxySession: (sessionId) => ipcRenderer.invoke('proxy:rotateSession', sessionId),
  releaseProxySession: (sessionId) => ipcRenderer.invoke('proxy:releaseSession', sessionId),
  getProxySessions: () => ipcRenderer.invoke('proxy:getSessions'),
  getProxyUsage: (sessionId) => ipcRenderer.invoke('proxy:getUsage', sessionId),


  // Cookies
  getCookies: (options) => ipcRenderer.invoke('cookies:get', options),
  deleteCookie: (profileId, cookieId) => ipcRenderer.invoke('cookies:delete', profileId, cookieId),
  deleteAllCookies: (profileId) => ipcRenderer.invoke('cookies:deleteAll', profileId),
  importCookies: (profileId, content) => ipcRenderer.invoke('cookies:import', profileId, content),
  exportCookies: (options) => ipcRenderer.invoke('cookies:export', options),

  // History
  getHistory: (options) => ipcRenderer.invoke('history:get', options),
  deleteHistoryItem: (profileId, historyId) => ipcRenderer.invoke('history:delete', profileId, historyId),
  clearHistory: (profileId) => ipcRenderer.invoke('history:clear', profileId),

  // Extensions
  getExtensions: (profileId) => ipcRenderer.invoke('extensions:get', profileId),
  getStoreExtensions: () => ipcRenderer.invoke('extensions:getStore'),
  installExtension: (dto) => ipcRenderer.invoke('extensions:install', dto),
  installExtensionFromStore: (profileId, storeExtensionId) => ipcRenderer.invoke('extensions:installFromStore', profileId, storeExtensionId),
  installExtensionBatch: (dto) => ipcRenderer.invoke('extensions:installBatch', dto),
  installFromWebStoreUrl: (profileId, webStoreUrl) => ipcRenderer.invoke('extensions:installFromWebStore', profileId, webStoreUrl),
  toggleExtension: (profileId, extensionId, enabled) => ipcRenderer.invoke('extensions:toggle', profileId, extensionId, enabled),
  removeExtension: (profileId, extensionId) => ipcRenderer.invoke('extensions:remove', profileId, extensionId),


  // Automation
  getWorkflows: () => ipcRenderer.invoke('automation:getWorkflows'),
  getWorkflowById: (id) => ipcRenderer.invoke('automation:getById', id),
  saveWorkflow: (workflow) => ipcRenderer.invoke('automation:saveWorkflow', workflow),
  deleteWorkflow: (id) => ipcRenderer.invoke('automation:deleteWorkflow', id),
  runWorkflow: (dto) => ipcRenderer.invoke('automation:runWorkflow', dto),
  runWorkflowBatch: (dto) => ipcRenderer.invoke('automation:runWorkflowBatch', dto),
  getAutomationTemplates: () => ipcRenderer.invoke('automation:getTemplates'),
  getWorkflowLogs: (workflowId) => ipcRenderer.invoke('automation:getLogs', workflowId),


  // Archives
  previewImportProfile: (filePath, password) => ipcRenderer.invoke('archive:preview', filePath, password),
  importProfile: (options) => ipcRenderer.invoke('archive:import', options),
  exportProfile: (options) => ipcRenderer.invoke('archive:export', options),
  exportNetscapeCookies: (profileId, targetFilePath) => ipcRenderer.invoke('archive:exportNetscape', profileId, targetFilePath),
  exportBulkProfiles: (options) => ipcRenderer.invoke('archive:exportBulk', options),
  importCrossPlatformProfiles: (dto) => ipcRenderer.invoke('archive:importCrossPlatform', dto),


  // Licensing & MAHI Pro
  getDynamicPrice: () => ipcRenderer.invoke('app:getDynamicPrice'),
  getLicenseStatus: () => ipcRenderer.invoke('license:getStatus'),
  getOnlineLicenseStatus: () => ipcRenderer.invoke('license:getOnlineStatus'),
  checkOnlineLicenseNow: () => ipcRenderer.invoke('license:checkOnlineNow'),
  activateLicense: (dto) => ipcRenderer.invoke('license:activate', dto),
  getPlanLimits: () => ipcRenderer.invoke('license:getLimits'),
  adminCreateLicense: (dto, adminSecret) => ipcRenderer.invoke('admin:createLicense', dto, adminSecret),
  adminGetLicenses: (adminSecret, filter) => ipcRenderer.invoke('admin:getLicenses', adminSecret, filter),
  adminRevokeLicense: (licenseId, adminSecret, reason) => ipcRenderer.invoke('admin:revokeLicense', licenseId, adminSecret, reason),
  adminExtendLicense: (dto, adminSecret) => ipcRenderer.invoke('admin:extendLicense', dto, adminSecret),
  adminGetLicenseDevices: (licenseId, adminSecret) => ipcRenderer.invoke('admin:getDevices', licenseId, adminSecret),
  adminDeactivateDevice: (licenseId, deviceId, adminSecret) => ipcRenderer.invoke('admin:deactivateDevice', licenseId, deviceId, adminSecret),
  adminSetPin: (newPin, adminSecret) => ipcRenderer.invoke('admin:setPin', newPin, adminSecret),

  // Settings

  getAppSettings: () => ipcRenderer.invoke('settings:get'),

  updateAppSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  verifyAppPin: (pin) => ipcRenderer.invoke('settings:verifyPin', pin),
  setAppPin: (newPin, oldPin) => ipcRenderer.invoke('settings:setPin', newPin, oldPin),

  // Logs
  getActivityLogs: (filter) => ipcRenderer.invoke('logs:get', filter),
  clearActivityLogs: () => ipcRenderer.invoke('logs:clear'),

  // System
  getSystemBrowsers: () => ipcRenderer.invoke('system:getBrowsers'),
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openSaveDialog: (options) => ipcRenderer.invoke('dialog:openSave', options),

  // Mobile IP Rotator
  mobileRotatorCheckIp: () => ipcRenderer.invoke('mobileRotator:checkIp'),
  mobileRotatorGetDevices: () => ipcRenderer.invoke('mobileRotator:getDevices'),
  mobileRotatorRotate: (config) => ipcRenderer.invoke('mobileRotator:rotate', config),
  mobileRotatorGetConfig: () => ipcRenderer.invoke('mobileRotator:getConfig'),
  mobileRotatorSaveConfig: (config) => ipcRenderer.invoke('mobileRotator:saveConfig', config),

  // Universal Bulk Importer
  importerParsePreview: (rawText) => ipcRenderer.invoke('importer:parsePreview', rawText),
  importerExecuteBulkImport: (accounts, options) => ipcRenderer.invoke('importer:executeBulkImport', accounts, options),
  importerParseNetscape: (rawText) => ipcRenderer.invoke('importer:parseNetscape', rawText),

  // Multi-Window Synchronizer
  synchronizerStart: (masterProfileId, activeProfiles, config) => ipcRenderer.invoke('synchronizer:start', masterProfileId, activeProfiles, config),
  synchronizerStop: () => ipcRenderer.invoke('synchronizer:stop'),
  synchronizerGetStatus: () => ipcRenderer.invoke('synchronizer:getStatus'),
  synchronizerUpdateConfig: (config) => ipcRenderer.invoke('synchronizer:updateConfig', config),

  // Fingerprint Diagnostics & Stealth Auditor
  diagnosticsAudit: (profileId) => ipcRenderer.invoke('diagnostics:audit', profileId),
  diagnosticsAutoFix: (profileId) => ipcRenderer.invoke('diagnostics:autoFix', profileId),
  generateStatisticalFingerprint: (options) => ipcRenderer.invoke('fingerprint:generateStatistical', options),

  // Captcha Solver Engine
  captchaGetConfig: () => ipcRenderer.invoke('captcha:getConfig'),
  captchaSaveConfig: (config) => ipcRenderer.invoke('captcha:saveConfig', config),
  captchaCheckBalance: (provider, apiKey) => ipcRenderer.invoke('captcha:checkBalance', provider, apiKey),
  captchaSolve: (request) => ipcRenderer.invoke('captcha:solve', request),

  // Workspaces & Team Collaboration
  workspaceGetAll: () => ipcRenderer.invoke('workspace:getAll'),
  workspaceGetById: (id) => ipcRenderer.invoke('workspace:getById', id),
  workspaceCreate: (dto) => ipcRenderer.invoke('workspace:create', dto),
  workspaceUpdate: (id, dto) => ipcRenderer.invoke('workspace:update', id, dto),
  workspaceDelete: (id) => ipcRenderer.invoke('workspace:delete', id),
  workspaceGetActive: () => ipcRenderer.invoke('workspace:getActive'),
  workspaceSetActive: (id) => ipcRenderer.invoke('workspace:setActive', id),
  workspaceGetMembers: (workspaceId) => ipcRenderer.invoke('workspace:getMembers', workspaceId),
  workspaceAddMember: (dto) => ipcRenderer.invoke('workspace:addMember', dto),
  workspaceUpdateMemberRole: (memberId, role) => ipcRenderer.invoke('workspace:updateMemberRole', memberId, role),
  workspaceDeleteMember: (memberId) => ipcRenderer.invoke('workspace:deleteMember', memberId),
  workspaceAssignProfile: (profileId, workspaceId, memberId) => ipcRenderer.invoke('workspace:assignProfile', profileId, workspaceId, memberId),
  workspaceExportBundle: (options) => ipcRenderer.invoke('workspace:exportBundle', options),
  workspaceImportBundle: (bundleJson, targetWorkspaceId) => ipcRenderer.invoke('workspace:importBundle', bundleJson, targetWorkspaceId),

  // Phase 3 Multi-User Team Workspaces
  teamWorkspaceList: () => ipcRenderer.invoke('teamWorkspace:list'),
  teamWorkspaceCreate: (input) => ipcRenderer.invoke('teamWorkspace:create', input),
  teamWorkspaceGet: (workspaceId) => ipcRenderer.invoke('teamWorkspace:get', workspaceId),
  teamWorkspaceUpdate: (workspaceId, updates) => ipcRenderer.invoke('teamWorkspace:update', workspaceId, updates),
  teamWorkspaceDelete: (workspaceId) => ipcRenderer.invoke('teamWorkspace:delete', workspaceId),
  teamWorkspaceTransferOwnership: (workspaceId, newOwnerId) => ipcRenderer.invoke('teamWorkspace:transferOwnership', workspaceId, newOwnerId),
  teamWorkspaceGetMembers: (workspaceId) => ipcRenderer.invoke('teamWorkspace:getMembers', workspaceId),
  teamWorkspaceInviteMember: (workspaceId, email, role) => ipcRenderer.invoke('teamWorkspace:inviteMember', workspaceId, email, role),
  teamWorkspaceUpdateMemberRole: (workspaceId, memberUserId, role) => ipcRenderer.invoke('teamWorkspace:updateMemberRole', workspaceId, memberUserId, role),
  teamWorkspaceRemoveMember: (workspaceId, memberUserId) => ipcRenderer.invoke('teamWorkspace:removeMember', workspaceId, memberUserId),
  teamWorkspaceListInvitations: (workspaceId) => ipcRenderer.invoke('teamWorkspace:listInvitations', workspaceId),
  teamWorkspaceRevokeInvitation: (workspaceId, inviteId) => ipcRenderer.invoke('teamWorkspace:revokeInvitation', workspaceId, inviteId),
  teamWorkspaceAcceptInvitation: (token) => ipcRenderer.invoke('teamWorkspace:acceptInvitation', token),
  teamWorkspaceListProfiles: (workspaceId) => ipcRenderer.invoke('teamWorkspace:listProfiles', workspaceId),
  teamWorkspaceShareProfile: (workspaceId, input) => ipcRenderer.invoke('teamWorkspace:shareProfile', workspaceId, input),
  teamWorkspaceRevokeProfileShare: (workspaceId, cloudProfileId) => ipcRenderer.invoke('teamWorkspace:revokeProfileShare', workspaceId, cloudProfileId),
  teamWorkspaceGetAuditLogs: (workspaceId, limit) => ipcRenderer.invoke('teamWorkspace:getAuditLogs', workspaceId, limit),

  // Auto-Updater
  checkForUpdates: (channel) => ipcRenderer.invoke('updater:check', channel),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: (options) => ipcRenderer.invoke('updater:install', options),
  getUpdateStatus: () => ipcRenderer.invoke('updater:getStatus'),
  getUpdateConfig: () => ipcRenderer.invoke('updater:getConfig'),
  setUpdateConfig: (config) => ipcRenderer.invoke('updater:setConfig', config),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getDiagnostics: () => ipcRenderer.invoke('app:getDiagnostics'),

  // Resource Monitoring & Memory Optimizer
  getFleetResources: () => ipcRenderer.invoke('resources:getFleetUsage'),
  optimizeFleetMemory: () => ipcRenderer.invoke('resources:optimizeMemory'),

  // Master Encrypted Vault Backup & Restore
  exportMasterVault: (options) => ipcRenderer.invoke('vault:export', options),
  importMasterVault: (bundleJson, password) => ipcRenderer.invoke('vault:import', bundleJson, password),

  // Events
  onProfileStatusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('profile:statusChanged', handler);
    return () => {
      ipcRenderer.removeListener('profile:statusChanged', handler);
    };
  },
  onActivityLogAdded: (callback) => {
    const handler = (_event, log) => callback(log);
    ipcRenderer.on('activity:logAdded', handler);
    return () => {
      ipcRenderer.removeListener('activity:logAdded', handler);
    };
  },
  onUpdateStatusChanged: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('updater:statusChanged', handler);
    return () => {
      ipcRenderer.removeListener('updater:statusChanged', handler);
    };
  },
  onLicenseStatusChanged: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('license:statusChanged', handler);
    return () => {
      ipcRenderer.removeListener('license:statusChanged', handler);
    };
  },
  onLicenseStatusToast: (callback) => {
    const handler = (_event, toast) => callback(toast);
    ipcRenderer.on('license:statusToast', handler);
    return () => {
      ipcRenderer.removeListener('license:statusToast', handler);
    };
  },
  onFleetResourceUsage: (callback) => {
    const handler = (_event, summary) => callback(summary);
    ipcRenderer.on('resources:fleetUsage', handler);
    return () => {
      ipcRenderer.removeListener('resources:fleetUsage', handler);
    };
  },
  onToastShow: (callback) => {
    const handler = (_event, toast) => callback(toast);
    ipcRenderer.on('toast:show', handler);
    return () => {
      ipcRenderer.removeListener('toast:show', handler);
    };
  },

  // Folders & Locking (V2)
  getFolders: (workspaceId) => ipcRenderer.invoke('folders:get', workspaceId),
  createFolder: (dto) => ipcRenderer.invoke('folders:create', dto),
  updateFolder: (id, updates) => ipcRenderer.invoke('folders:update', id, updates),
  deleteFolder: (id, targetFolderName) => ipcRenderer.invoke('folders:delete', id, targetFolderName),
  getProfileLock: (profileId) => ipcRenderer.invoke('profileLock:get', profileId),
  acquireProfileLock: (profileId, userId, userName, deviceId) => ipcRenderer.invoke('profileLock:acquire', profileId, userId, userName, deviceId),
  releaseProfileLock: (profileId, userId) => ipcRenderer.invoke('profileLock:release', profileId, userId),

  // Feature Flags & Fleet (V2)
  getFeatureFlags: () => ipcRenderer.invoke('featureFlags:get'),
  updateFeatureFlag: (key, updates) => ipcRenderer.invoke('featureFlags:update', key, updates),
  checkFeatureFlag: (key, userTier, userId, orgId) => ipcRenderer.invoke('featureFlags:check', key, userTier, userId, orgId),
  getFleetDevices: () => ipcRenderer.invoke('fleet:getDevices'),
  getFleetTelemetry: () => ipcRenderer.invoke('fleet:getTelemetry'),
  revokeDevice: (deviceId) => ipcRenderer.invoke('fleet:revokeDevice', deviceId),

  // API Keys (V2)
  getApiKeys: (userId) => ipcRenderer.invoke('apiKeys:get', userId),
  generateApiKey: (name, userId, scopes) => ipcRenderer.invoke('apiKeys:generate', name, userId, scopes),
  revokeApiKey: (keyId) => ipcRenderer.invoke('apiKeys:revoke', keyId),

  // Distribution & Shortcuts
  getDistributionInfo: () => ipcRenderer.invoke('distribution:getInfo'),
  openDistributionFolder: () => ipcRenderer.invoke('distribution:openFolder'),
  fixDesktopShortcuts: () => ipcRenderer.invoke('distribution:fixShortcuts'),
  createProfileShortcut: (profileId, profileName) => ipcRenderer.invoke('distribution:createProfileShortcut', profileId, profileName),

  // Commercial APIs
  commercialRegister: (dto) => ipcRenderer.invoke('commercial:register', dto),
  commercialLogin: (dto) => ipcRenderer.invoke('commercial:login', dto),
  getHwid: () => ipcRenderer.invoke('commercial:getHwid'),
  commercialLogout: () => ipcRenderer.invoke('commercial:logout'),
  commercialGetEntitlements: (userId, deviceId) => ipcRenderer.invoke('commercial:getEntitlements', userId, deviceId),
  commercialGetDevices: (userId) => ipcRenderer.invoke('commercial:getDevices', userId),
  commercialRevokeDevice: (deviceId, userId) => ipcRenderer.invoke('commercial:revokeDevice', deviceId, userId),
  commercialGetPlans: () => ipcRenderer.invoke('commercial:getPlans'),
  commercialActivateKey: (userId, rawKey) => ipcRenderer.invoke('commercial:activateKey', userId, rawKey),

  // Starter / Demo Profiles (New User Clean Onboarding)
  getStarterTemplates: () => ipcRenderer.invoke('starterProfiles:getTemplates'),
  getStarterTemplateById: (id) => ipcRenderer.invoke('starterProfiles:getTemplateById', id),
  isUserNew: (ownerId) => ipcRenderer.invoke('starterProfiles:isUserNew', ownerId),
  createProfileFromStarter: (templateId, options) => ipcRenderer.invoke('starterProfiles:createFromTemplate', templateId, options),

  // Central Entitlements & Capabilities
  getEntitlements: (userId, deviceId) => ipcRenderer.invoke('entitlements:get', userId, deviceId),
  checkCapability: (capability, userId) => ipcRenderer.invoke('entitlements:checkCapability', capability, userId),

  // Managed Browser Engine
  getManagedEngineStatus: () => ipcRenderer.invoke('engine:getStatus'),
  downloadManagedEngine: () => ipcRenderer.invoke('engine:download'),
  repairManagedEngine: () => ipcRenderer.invoke('engine:repair'),
  onEngineDownloadProgress: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('engine:downloadProgress', handler);
    return () => ipcRenderer.removeListener('engine:downloadProgress', handler);
  },
  onCamoufoxDownloadProgress: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('engine:camoufox:progress', handler);
    return () => ipcRenderer.removeListener('engine:camoufox:progress', handler);
  },

  // Cloud Profile Sync (GoLogin-style)
  getCloudSyncAllowed: () => ipcRenderer.invoke('sync:isAllowed'),
  getCloudSyncUsage: () => ipcRenderer.invoke('sync:getUsage'),
  getCloudSyncList: () => ipcRenderer.invoke('sync:list'),
  uploadProfileToCloud: (profileId) => ipcRenderer.invoke('sync:upload', profileId),
  downloadAndRestoreProfile: (cloudProfileId, options) => ipcRenderer.invoke('sync:restore', cloudProfileId, options),
  deleteCloudProfile: (cloudProfileId) => ipcRenderer.invoke('sync:delete', cloudProfileId),
  getCloudSyncConfig: () => ipcRenderer.invoke('sync:getConfig'),
  setCloudSyncConfig: (config) => ipcRenderer.invoke('sync:setConfig', config),
  syncAllProfiles: () => ipcRenderer.invoke('sync:syncAll'),
  getAllProfilesSyncStatus: () => ipcRenderer.invoke('sync:getAllStatuses'),
  resolveSyncConflict: (profileId, resolution) => ipcRenderer.invoke('sync:resolveConflict', profileId, resolution),
  acquireCloudLock: (cloudProfileId, ttlSeconds) => ipcRenderer.invoke('sync:lock:acquire', cloudProfileId, ttlSeconds),
  releaseCloudLock: (cloudProfileId) => ipcRenderer.invoke('sync:lock:release', cloudProfileId),
  getCloudLockStatus: (cloudProfileId) => ipcRenderer.invoke('sync:lock:status', cloudProfileId),
  onSyncProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },

  // Account & Subscription System (v1.1.0+)
  accountSignup: (dto) => ipcRenderer.invoke('account:signup', dto),
  accountLogin: (dto) => ipcRenderer.invoke('account:login', dto),
  accountLoginWithToken: (dto) => ipcRenderer.invoke('account:loginWithToken', dto),
  accountLogout: () => ipcRenderer.invoke('account:logout'),
  accountGetStatus: () => ipcRenderer.invoke('account:getStatus'),
  accountSwitchDevice: () => ipcRenderer.invoke('account:switchDevice'),
  accountGetPaymentInfo: () => ipcRenderer.invoke('account:getPaymentInfo'),
  accountGetPricingCatalog: () => ipcRenderer.invoke('account:getPricingCatalog'),
  accountCreateCheckoutSession: (payload) => ipcRenderer.invoke('account:createCheckoutSession', payload),
  accountSubmitManualUpiPayment: (payload) => ipcRenderer.invoke('account:submitManualUpiPayment', payload),
  accountGetPaymentStatus: () => ipcRenderer.invoke('account:getPaymentStatus'),
  accountGetSession: () => ipcRenderer.invoke('account:getSession'),
  accountGetPlanLimits: (dto) => ipcRenderer.invoke('account:getPlanLimits', dto),
  accountRefreshPlanLimits: () => ipcRenderer.invoke('account:refreshPlanLimits'),
  accountVerifyEmail: (dto) => ipcRenderer.invoke('account:verifyEmail', dto),
  accountResendVerification: (dto) => ipcRenderer.invoke('account:resendVerification', dto),
  accountForgotPassword: (dto) => ipcRenderer.invoke('account:forgotPassword', dto),
  accountResetPassword: (dto) => ipcRenderer.invoke('account:resetPassword', dto),
  accountListSessions: () => ipcRenderer.invoke('account:listSessions'),
  accountRevokeSession: (dto) => ipcRenderer.invoke('account:revokeSession', dto),
  accountRevokeAllSessions: (dto) => ipcRenderer.invoke('account:revokeAllSessions', dto),
  accountRefreshToken: () => ipcRenderer.invoke('account:refreshToken'),
  accountStartDesktopOAuth: (planId) => ipcRenderer.invoke('account:startDesktopOAuth', planId),
  accountExchangeDesktopCode: (dto, code) => {
    const payload = typeof dto === 'string' ? { ticket: dto, code: code || '' } : dto;
    return ipcRenderer.invoke('account:exchangeDesktopCode', payload);
  },
  accountActivateTrial: (planId) => ipcRenderer.invoke('account:activateTrial', planId),
  accountGetTrialStatus: () => ipcRenderer.invoke('account:getTrialStatus'),
  onAccountStatusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('account:statusChanged', handler);
    return () => ipcRenderer.removeListener('account:statusChanged', handler);
  },
  isDesktop: true,
};

contextBridge.exposeInMainWorld('mahiAPI', api);

