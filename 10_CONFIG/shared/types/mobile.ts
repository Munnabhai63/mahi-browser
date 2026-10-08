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
  payload?: any;
  timestamp: number;
  retryCount: number;
}
