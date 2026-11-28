/**
 * MAHI Browser — Android Mobile Companion Types
 * Phase 11 Architecture
 */

export type MobileTab = 'home' | 'profiles' | 'cloud' | 'workspaces' | 'proxies' | 'automation' | 'account';

export type MobileNotificationCategory =
  | 'SECURITY'
  | 'CLOUD_SESSION'
  | 'AUTOMATION'
  | 'WORKSPACE'
  | 'PROXY';

export interface MobileDeviceTokenRecord {
  id: string;
  userId: string;
  deviceId: string;
  pushToken: string;
  platform: 'android';
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  status: 'ACTIVE' | 'REVOKED';
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterMobileDeviceDTO {
  deviceId: string;
  pushToken: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface MobileNotificationPreferences {
  userId: string;
  securityAlerts: boolean;
  cloudSessions: boolean;
  automationAlerts: boolean;
  workspaceAlerts: boolean;
  proxyAlerts: boolean;
  updatedAt: string;
}

export interface MobileNotificationRecord {
  id: string;
  userId: string;
  category: MobileNotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface BiometricAuthConfig {
  enabled: boolean;
  promptTitle: string;
  promptSubtitle?: string;
  allowDeviceCredential: boolean;
}

export interface MobileTouchGesture {
  type: 'tap' | 'doubleTap' | 'longPress' | 'drag' | 'pinch';
  x: number;
  y: number;
  deltaX?: number;
  deltaY?: number;
  scale?: number;
}

export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  payload?: Record<string, unknown> | unknown;
  timestamp: number;
  retryCount: number;
}

export interface MobileRotatorAdbDevice {
  id: string;
  model: string;
  product?: string;
  status: 'device' | 'offline' | 'unauthorized';
}

export interface MobileRotatorAdbStatus {
  installed: boolean;
  adbPath: string | null;
  source: 'env' | 'custom' | 'bundled' | 'managed' | 'sdk' | 'path' | 'missing';
  managedInstallDir: string;
  platform: string;
  downloadUrl: string;
  version?: string;
  error?: string;
}

export interface MobileRotatorInstallResult {
  success: boolean;
  adbPath?: string;
  version?: string;
  error?: string;
}

export interface MobileRotatorIpInfo {
  ip: string;
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  error?: string;
}

export interface MobileRotatorConfig {
  method: 'adb' | 'webhook';
  adbDeviceId?: string;
  customAdbPath?: string;
  airplaneDelayMs: number;
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST';
  autoRotateOnProfileStart: boolean;
  mobileModeEnabled: boolean;
  minIntervalSeconds: number;
}

export interface MobileRotatorRotateOptions {
  triggerSource?: 'manual' | 'profile-start';
  profileId?: string;
  overrideConfig?: Partial<MobileRotatorConfig>;
  bypassCooldown?: boolean;
}

export interface MobileRotatorRotationResult {
  success: boolean;
  ipChanged: boolean;
  skippedByCooldown?: boolean;
  cooldownRemainingSeconds?: number;
  oldIp: string;
  newIp: string;
  isp?: string;
  country?: string;
  city?: string;
  deviceId?: string;
  strategy?: string;
  durationMs: number;
  errorMessage?: string;
  timestamp: string;
}

export interface MobileRotatorHistoryEntry {
  id: string;
  timestamp: string;
  method: 'adb' | 'webhook';
  oldIp: string;
  newIp: string;
  ipChanged: boolean;
  durationMs: number;
  status: 'SUCCESS' | 'NO_CHANGE' | 'COOLDOWN_SKIPPED' | 'FAILED';
  triggerSource: 'manual' | 'profile-start';
  profileId?: string;
  deviceId?: string;
  strategy?: string;
  message?: string;
}
