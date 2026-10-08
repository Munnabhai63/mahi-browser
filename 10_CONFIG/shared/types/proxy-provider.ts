/**
 * MAHI Browser — Commercial Proxy Provider Platform Types
 * Phase 5 Architecture
 */

import { ProxyItem, ProxyProtocol } from './proxy.js';

export type ProxyNetworkType = 'RESIDENTIAL' | 'MOBILE' | 'DATACENTER' | 'ISP' | 'DEDICATED';

export type ProxySessionType = 'STICKY' | 'ROTATING';

export interface ProxyProviderCapabilities {
  residential: boolean;
  mobile: boolean;
  datacenter: boolean;
  isp: boolean;
  countryTargeting: boolean;
  regionTargeting: boolean;
  cityTargeting: boolean;
  stickySession: boolean;
  rotatingSession: boolean;
  sessionTtl: boolean;
  usernamePasswordAuth: boolean;
  ipWhitelistAuth: boolean;
  usageApi: boolean;
  balanceApi: boolean;
  maxConcurrentSessions?: number;
}

export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNCONFIGURED';

export interface ProxyProviderInfo {
  id: string;
  name: string;
  description: string;
  website: string;
  isConfigured: boolean;
  isEnabled: boolean;
  priority: number;
  capabilities: ProxyProviderCapabilities;
  status: ProviderHealthStatus;
  latencyMs?: number;
}

export interface GeoCountryOption {
  code: string;
  name: string;
  regions?: { code: string; name: string }[];
  cities?: string[];
  supportedTypes: ProxyNetworkType[];
}

export interface ProxyCatalogQuery {
  networkType?: ProxyNetworkType;
  country?: string;
  region?: string;
  city?: string;
  sessionType?: ProxySessionType;
  providerId?: string;
}

export interface ProxyCatalogResult {
  providers: ProxyProviderInfo[];
  availableCountries: GeoCountryOption[];
  supportedNetworkTypes: ProxyNetworkType[];
  supportedSessionTypes: ProxySessionType[];
}

export interface ProxySessionGenerateRequest {
  providerId?: string; // 'auto' or specific provider ID
  networkType: ProxyNetworkType;
  country: string;
  region?: string;
  city?: string;
  sessionType: ProxySessionType;
  ttlMinutes?: number;
  profileId?: string; // Optional auto-assignment
  workspaceId?: string;
  notes?: string;
}

export interface ProxySessionRecord {
  id: string;
  providerId: string;
  proxyId: string; // References canonical proxies.id
  userId: string;
  workspaceId?: string;
  profileId?: string;
  networkType: ProxyNetworkType;
  country: string;
  region?: string;
  city?: string;
  sessionType: ProxySessionType;
  sessionId: string; // Upstream provider session identifier
  ttlMinutes?: number;
  expiresAt?: string;
  rotatable: boolean;
  rotationCount: number;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  bytesUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProxySessionResult {
  session: ProxySessionRecord;
  proxy: ProxyItem;
}

export interface ProxyUsageReport {
  sessionId?: string;
  providerId?: string;
  userId: string;
  bytesUsed: number;
  bytesLimit?: number;
  bytesRemaining?: number;
  activeSessionCount: number;
  lastUpdated: string;
}

export interface ProxyRotationResult {
  success: boolean;
  sessionId: string;
  newIp?: string;
  rotationCount: number;
  latencyMs?: number;
  errorMessage?: string;
}
