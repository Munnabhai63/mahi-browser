/**
 * MAHI Browser — Proxy Provider Core Interface
 * Phase 5 Architecture
 */

import {
  ProxyProviderCapabilities,
  ProxyNetworkType,
  ProxySessionType,
  GeoCountryOption,
  ProviderHealthStatus,
} from '../../10_CONFIG/shared/types/proxy-provider.js';

export interface ProviderSessionCredentials {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  username: string;
  password: string; // Plaintext ephemeral credential generated for this session
  ip?: string;
  country: string;
  region?: string;
  city?: string;
  upstreamSessionId: string;
  expiresAt?: string;
}

export interface ProviderCreateSessionParams {
  networkType: ProxyNetworkType;
  country: string;
  region?: string;
  city?: string;
  sessionType: ProxySessionType;
  ttlMinutes?: number;
  customSessionTag?: string;
}

export interface ProviderRotateResult {
  success: boolean;
  upstreamSessionId: string;
  newIp?: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ProviderHealthCheckResult {
  status: ProviderHealthStatus;
  latencyMs: number;
  error?: string;
}

export interface ProviderUsageStats {
  bytesUsed: number;
  bytesLimit?: number;
  bytesRemaining?: number;
}

/**
 * Universal Contract for all commercial and test proxy providers.
 * All provider-specific APIs (Bright Data, Oxylabs, Smartproxy, etc.)
 * MUST conform strictly to this interface.
 */
export interface ProxyProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly website: string;
  readonly defaultPriority: number;

  getCapabilities(): ProxyProviderCapabilities;
  isConfigured(): boolean;
  getCountries(networkType: ProxyNetworkType): Promise<GeoCountryOption[]>;
  createSession(params: ProviderCreateSessionParams): Promise<ProviderSessionCredentials>;
  rotateSession(upstreamSessionId: string, params: ProviderCreateSessionParams): Promise<ProviderRotateResult>;
  revokeSession(upstreamSessionId: string): Promise<boolean>;
  getUsage(upstreamSessionId?: string): Promise<ProviderUsageStats>;
  healthCheck(): Promise<ProviderHealthCheckResult>;
}
