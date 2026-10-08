/**
 * MAHI Browser — Smartproxy Commercial Proxy Adapter
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

export class SmartproxyProvider implements ProxyProvider {
  readonly id = 'smartproxy';
  readonly name = 'Smartproxy';
  readonly description = 'Fast, dependable residential and mobile proxy pool covering 195+ locations worldwide.';
  readonly website = 'https://smartproxy.com';
  readonly defaultPriority = 30;

  private username?: string;
  private password?: string;

  constructor() {
    this.username = process.env.SMARTPROXY_USERNAME;
    this.password = process.env.SMARTPROXY_PASSWORD;
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
      maxConcurrentSessions: 300,
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
        cities: ['New York', 'Los Angeles', 'Chicago', 'Miami'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
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
        supportedTypes: ['RESIDENTIAL', 'DATACENTER'],
      },
      {
        code: 'IN',
        name: 'India',
        cities: ['Mumbai', 'Delhi'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE'],
      },
    ];
  }

  async createSession(params: ProviderCreateSessionParams): Promise<ProviderSessionCredentials> {
    if (!this.isConfigured()) {
      throw new Error('Smartproxy credentials not configured. Please set SMARTPROXY_USERNAME and SMARTPROXY_PASSWORD in server environment.');
    }

    const sessionId = `sp_${crypto.randomUUID().slice(0, 10)}`;
    const countryParam = params.country.toLowerCase();
    const cityParam = params.city ? `-city-${params.city.toLowerCase().replace(/\s+/g, '_')}` : '';

    const username = `user-${this.username}-country-${countryParam}${cityParam}-session-${sessionId}`;
    const host = 'gate.smartproxy.com';
    const port = 7000;

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
      throw new Error('Smartproxy credentials not configured.');
    }

    const newSessionId = `sp_${crypto.randomUUID().slice(0, 10)}`;
    const countryParam = params.country.toLowerCase();
    const cityParam = params.city ? `-city-${params.city.toLowerCase().replace(/\s+/g, '_')}` : '';
    const username = `user-${this.username}-country-${countryParam}${cityParam}-session-${newSessionId}`;

    return {
      success: true,
      upstreamSessionId: newSessionId,
      host: 'gate.smartproxy.com',
      port: 7000,
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
      bytesLimit: 25 * 1024 * 1024 * 1024,
      bytesRemaining: 25 * 1024 * 1024 * 1024,
    };
  }

  async healthCheck(): Promise<ProviderHealthCheckResult> {
    if (!this.isConfigured()) {
      return {
        status: 'UNCONFIGURED',
        latencyMs: 0,
        error: 'Smartproxy environment credentials not set (SMARTPROXY_USERNAME)',
      };
    }

    return {
      status: 'HEALTHY',
      latencyMs: 40,
    };
  }
}
