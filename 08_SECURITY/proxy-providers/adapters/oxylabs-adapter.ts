/**
 * MAHI Browser — Oxylabs Commercial Proxy Adapter
 * Phase 5 Architecture
 */

import crypto from 'node:crypto';
import {
  ProxyProvider,
  ProviderSessionCredentials,
  ProviderCreateSessionParams,
  ProviderRotateResult,
  ProviderHealthCheckResult,
  ProviderUsageStats,
} from '../proxy-provider-interface.js';
import {
  ProxyProviderCapabilities,
  ProxyNetworkType,
  GeoCountryOption,
} from '../../../10_CONFIG/shared/types/proxy-provider.js';

export class OxylabsProxyProvider implements ProxyProvider {
  readonly id = 'oxylabs';
  readonly name = 'Oxylabs';
  readonly description = 'High-performance global proxy infrastructure with 102M+ ethically sourced IPs.';
  readonly website = 'https://oxylabs.io';
  readonly defaultPriority = 20;

  private username?: string;
  private password?: string;

  constructor() {
    this.username = process.env.OXYLABS_USERNAME;
    this.password = process.env.OXYLABS_PASSWORD;
  }

  getCapabilities(): ProxyProviderCapabilities {
    return {
      residential: true,
      mobile: true,
      datacenter: true,
      isp: true,
      countryTargeting: true,
      regionTargeting: false,
      cityTargeting: true,
      stickySession: true,
      rotatingSession: true,
      sessionTtl: true,
      usernamePasswordAuth: true,
      ipWhitelistAuth: true,
      usageApi: true,
      balanceApi: true,
      maxConcurrentSessions: 500,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.username && this.password);
  }

  async getCountries(_networkType: ProxyNetworkType): Promise<GeoCountryOption[]> {
    return [
      {
        code: 'US',
        name: 'United States',
        cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER', 'ISP'],
      },
      {
        code: 'GB',
        name: 'United Kingdom',
        cities: ['London', 'Manchester'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'DE',
        name: 'Germany',
        cities: ['Frankfurt', 'Berlin'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'FR',
        name: 'France',
        cities: ['Paris'],
        supportedTypes: ['RESIDENTIAL', 'DATACENTER'],
      },
      {
        code: 'JP',
        name: 'Japan',
        cities: ['Tokyo'],
        supportedTypes: ['RESIDENTIAL', 'DATACENTER'],
      },
    ];
  }

  async createSession(params: ProviderCreateSessionParams): Promise<ProviderSessionCredentials> {
    if (!this.isConfigured()) {
      throw new Error('Oxylabs credentials not configured. Please set OXYLABS_USERNAME and OXYLABS_PASSWORD in server environment.');
    }

    const sessionId = `oxy_${crypto.randomUUID().slice(0, 10)}`;
    const countryParam = params.country.toLowerCase();
    const cityParam = params.city ? `-city-${params.city.toLowerCase().replace(/\s+/g, '_')}` : '';

    const username = `customer-${this.username}-cc-${countryParam}${cityParam}-sessid-${sessionId}`;
    const host = 'pr.oxylabs.io';
    const port = 7777;

    let expiresAt: string | undefined = undefined;
    if (params.sessionType === 'STICKY' && params.ttlMinutes) {
      expiresAt = new Date(Date.now() + params.ttlMinutes * 60 * 1000).toISOString();
    }

    return {
      host,
      port,
      protocol: 'http',
      username,
      password: this.password!,
      country: params.country.toUpperCase(),
      city: params.city,
      upstreamSessionId: sessionId,
      expiresAt,
    };
  }

  async rotateSession(upstreamSessionId: string, params: ProviderCreateSessionParams): Promise<ProviderRotateResult> {
    if (!this.isConfigured()) {
      throw new Error('Oxylabs credentials not configured.');
    }

    const newSessionId = `oxy_${crypto.randomUUID().slice(0, 10)}`;
    const countryParam = params.country.toLowerCase();
    const cityParam = params.city ? `-city-${params.city.toLowerCase().replace(/\s+/g, '_')}` : '';
    const username = `customer-${this.username}-cc-${countryParam}${cityParam}-sessid-${newSessionId}`;

    return {
      success: true,
      upstreamSessionId: newSessionId,
      host: 'pr.oxylabs.io',
      port: 7777,
      username,
      password: this.password!,
    };
  }

  async revokeSession(_upstreamSessionId: string): Promise<boolean> {
    return true;
  }

  async getUsage(_upstreamSessionId?: string): Promise<ProviderUsageStats> {
    return {
      bytesUsed: 0,
      bytesLimit: 50 * 1024 * 1024 * 1024,
      bytesRemaining: 50 * 1024 * 1024 * 1024,
    };
  }

  async healthCheck(): Promise<ProviderHealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        status: 'UNCONFIGURED',
        latencyMs: 0,
        error: 'Oxylabs environment credentials not set (OXYLABS_USERNAME)',
      };
    }

    return {
      status: 'HEALTHY',
      latencyMs: 50,
    };
  }
}
