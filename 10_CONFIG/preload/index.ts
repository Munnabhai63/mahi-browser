import { contextBridge, ipcRenderer } from 'electron';
import { MahiBrowserAPI } from '../shared/types/ipc.js';

const api: MahiBrowserAPI = {
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
    const handler = (_event: any, progress: any) => callback(progress);
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


  startProfile: (id) => ipcRenderer.invoke('profiles:start', id),
  stopProfile: (id) => ipcRenderer.invoke('profiles:stop', id),
  quickSwitchProfile: (number) => ipcRenderer.invoke('profiles:quickSwitch', number),
  getProfileStatus: (id) => ipcRenderer.invoke('profiles:getStatus', id),
  getRunningProfiles: () => ipcRenderer.invoke('profiles:getRunningProfiles'),


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
  exportNetscapeCookies: (profileId) => ipcRenderer.invoke('archive:exportNetscape', profileId),
  exportBulkProfiles: (options) => ipcRenderer.invoke('archive:exportBulk', options),
  importCrossPlatformProfiles: (dto) => ipcRenderer.invoke('archive:importCrossPlatform', dto),


  // Licensing & MAHI Pro
  getLicenseStatus: () => ipcRenderer.invoke('license:getStatus'),
  activateLicense: (dto) => ipcRenderer.invoke('license:activate', dto),
  getHwid: () => ipcRenderer.invoke('commercial:getHwid'),
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
  importerParsePreview: (rawText: string) => ipcRenderer.invoke('importer:parsePreview', rawText),
  importerExecuteBulkImport: (accounts: any[], options?: any) => ipcRenderer.invoke('importer:executeBulkImport', accounts, options),
  importerParseNetscape: (rawText: string) => ipcRenderer.invoke('importer:parseNetscape', rawText),

  // Multi-Window Synchronizer
  synchronizerStart: (masterProfileId?: string, activeProfiles?: string[], config?: any) => ipcRenderer.invoke('synchronizer:start', masterProfileId, activeProfiles, config),
  synchronizerStop: () => ipcRenderer.invoke('synchronizer:stop'),
  synchronizerGetStatus: () => ipcRenderer.invoke('synchronizer:getStatus'),
  synchronizerUpdateConfig: (config: any) => ipcRenderer.invoke('synchronizer:updateConfig', config),

  // Fingerprint Diagnostics & Stealth Auditor
  diagnosticsAudit: (profileId: string) => ipcRenderer.invoke('diagnostics:audit', profileId),
  diagnosticsAutoFix: (profileId: string) => ipcRenderer.invoke('diagnostics:autoFix', profileId),

  // Captcha Solver Engine
  captchaGetConfig: () => ipcRenderer.invoke('captcha:getConfig'),
  captchaSaveConfig: (config: any) => ipcRenderer.invoke('captcha:saveConfig', config),
  captchaCheckBalance: (provider: any, apiKey: string) => ipcRenderer.invoke('captcha:checkBalance', provider, apiKey),
  captchaSolve: (request: any) => ipcRenderer.invoke('captcha:solve', request),

  // Workspaces & Team Collaboration
  workspaceGetAll: () => ipcRenderer.invoke('workspace:getAll'),
  workspaceGetById: (id: string) => ipcRenderer.invoke('workspace:getById', id),
  workspaceCreate: (dto: any) => ipcRenderer.invoke('workspace:create', dto),
  workspaceUpdate: (id: string, dto: any) => ipcRenderer.invoke('workspace:update', id, dto),
  workspaceDelete: (id: string) => ipcRenderer.invoke('workspace:delete', id),
  workspaceGetActive: () => ipcRenderer.invoke('workspace:getActive'),
  workspaceSetActive: (id: string) => ipcRenderer.invoke('workspace:setActive', id),
  workspaceGetMembers: (workspaceId: string) => ipcRenderer.invoke('workspace:getMembers', workspaceId),
  workspaceAddMember: (dto: any) => ipcRenderer.invoke('workspace:addMember', dto),
  workspaceUpdateMemberRole: (memberId: string, role: any) => ipcRenderer.invoke('workspace:updateMemberRole', memberId, role),
  workspaceDeleteMember: (memberId: string) => ipcRenderer.invoke('workspace:deleteMember', memberId),
  workspaceAssignProfile: (profileId: string, workspaceId: string, memberId: string | null) => ipcRenderer.invoke('workspace:assignProfile', profileId, workspaceId, memberId),
  workspaceExportBundle: (options: any) => ipcRenderer.invoke('workspace:exportBundle', options),
  workspaceImportBundle: (bundleJson: string, targetWorkspaceId?: string) => ipcRenderer.invoke('workspace:importBundle', bundleJson, targetWorkspaceId),







  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getUpdateStatus: () => ipcRenderer.invoke('updater:getStatus'),

  // Resource Monitoring & Memory Optimizer
  getFleetResources: () => ipcRenderer.invoke('resources:getFleetUsage'),
  optimizeFleetMemory: () => ipcRenderer.invoke('resources:optimizeMemory'),

  // Master Encrypted Vault Backup & Restore
  exportMasterVault: (options?: any) => ipcRenderer.invoke('vault:export', options),
  importMasterVault: (bundleJson: string, password?: string) => ipcRenderer.invoke('vault:import', bundleJson, password),

  // Events
  onProfileStatusChanged: (callback) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('profile:statusChanged', handler);
    return () => {
      ipcRenderer.removeListener('profile:statusChanged', handler);
    };
  },
  onActivityLogAdded: (callback) => {
    const handler = (_event: unknown, log: any) => callback(log);
    ipcRenderer.on('activity:logAdded', handler);
    return () => {
      ipcRenderer.removeListener('activity:logAdded', handler);
    };
  },
  onUpdateStatusChanged: (callback) => {
    const handler = (_event: unknown, status: any) => callback(status);
    ipcRenderer.on('updater:statusChanged', handler);
    return () => {
      ipcRenderer.removeListener('updater:statusChanged', handler);
    };
  },
  onFleetResourceUsage: (callback) => {
    const handler = (_event: unknown, summary: any) => callback(summary);
    ipcRenderer.on('resources:fleetUsage', handler);
    return () => {
      ipcRenderer.removeListener('resources:fleetUsage', handler);
    };
  },

  // Folders & Locking (V2)
  getFolders: (workspaceId?: string) => ipcRenderer.invoke('folders:get', workspaceId),
  createFolder: (dto: any) => ipcRenderer.invoke('folders:create', dto),
  updateFolder: (id: string, updates: any) => ipcRenderer.invoke('folders:update', id, updates),
  deleteFolder: (id: string, targetFolderName?: string) => ipcRenderer.invoke('folders:delete', id, targetFolderName),
  getProfileLock: (profileId: string) => ipcRenderer.invoke('profileLock:get', profileId),
  acquireProfileLock: (profileId: string, userId: string, userName: string, deviceId: string) => ipcRenderer.invoke('profileLock:acquire', profileId, userId, userName, deviceId),
  releaseProfileLock: (profileId: string, userId?: string) => ipcRenderer.invoke('profileLock:release', profileId, userId),

  // Feature Flags & Fleet (V2)
  getFeatureFlags: () => ipcRenderer.invoke('featureFlags:get'),
  updateFeatureFlag: (key: string, updates: any) => ipcRenderer.invoke('featureFlags:update', key, updates),
  checkFeatureFlag: (key: string, userTier?: any, userId?: string, orgId?: string) => ipcRenderer.invoke('featureFlags:check', key, userTier, userId, orgId),
  getFleetDevices: () => ipcRenderer.invoke('fleet:getDevices'),
  getFleetTelemetry: () => ipcRenderer.invoke('fleet:getTelemetry'),
  revokeDevice: (deviceId: string) => ipcRenderer.invoke('fleet:revokeDevice', deviceId),

  // API Keys (V2)
  getApiKeys: (userId?: string) => ipcRenderer.invoke('apiKeys:get', userId),
  generateApiKey: (name: string, userId?: string, scopes?: string[]) => ipcRenderer.invoke('apiKeys:generate', name, userId, scopes),
  revokeApiKey: (keyId: string) => ipcRenderer.invoke('apiKeys:revoke', keyId),

  // Distribution & Shortcuts
  getDistributionInfo: () => ipcRenderer.invoke('distribution:getInfo'),
  openDistributionFolder: () => ipcRenderer.invoke('distribution:openFolder'),
  fixDesktopShortcuts: () => ipcRenderer.invoke('distribution:fixShortcuts'),
  createProfileShortcut: (profileId: string, profileName: string) => ipcRenderer.invoke('distribution:createProfileShortcut', profileId, profileName),

  // Commercial APIs
  commercialRegister: (dto: any) => ipcRenderer.invoke('commercial:register', dto),
  commercialLogin: (dto: any) => ipcRenderer.invoke('commercial:login', dto),
  commercialLogout: () => ipcRenderer.invoke('commercial:logout'),
  commercialSyncUser: (user: any) => ipcRenderer.invoke('commercial:syncUser', user),
  commercialGetEntitlements: (userId: string, deviceId?: string) => ipcRenderer.invoke('commercial:getEntitlements', userId, deviceId),
  commercialGetDevices: (userId: string) => ipcRenderer.invoke('commercial:getDevices', userId),
  commercialRevokeDevice: (deviceId: string, userId: string) => ipcRenderer.invoke('commercial:revokeDevice', deviceId, userId),
  commercialGetPlans: () => ipcRenderer.invoke('commercial:getPlans'),
  commercialActivateKey: (userId: string, rawKey: string) => ipcRenderer.invoke('commercial:activateKey', userId, rawKey),

  // Managed Browser Engine
  getManagedEngineStatus: () => ipcRenderer.invoke('engine:getStatus'),
  downloadManagedEngine: () => ipcRenderer.invoke('engine:download'),
  onEngineDownloadProgress: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('engine:downloadProgress', handler);
    return () => ipcRenderer.removeListener('engine:downloadProgress', handler);
  },
};

contextBridge.exposeInMainWorld('mahiAPI', api);

