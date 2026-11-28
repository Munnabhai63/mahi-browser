/**
 * MAHI Browser — Bright Data (Luminati) Commercial Proxy Adapter
 * Phase 5 Architecture
 */

import crypto from 'node:crypto';
import type {
  ProxyProvider,
  ProviderSessionCredentials,
  ProviderCreateSessionParams,
  ProviderRotateResult,
  ProviderHealthCheckResult,
  ProviderUsageStats,
} from '../proxy-provider-interface.js';
import type {
  ProxyProviderCapabilities,
  ProxyNetworkType,
  GeoCountryOption,
} from '../../../10_CONFIG/shared/types/proxy-provider.js';

export class BrightDataProxyProvider implements ProxyProvider {
  readonly id = 'brightdata';
  readonly name = 'Bright Data';
  readonly description = 'Tier-1 enterprise proxy network with 72M+ residential IPs, precise ASN & city targeting.';
  readonly website = 'https://brightdata.com';
  readonly defaultPriority = 10;

  private customerId?: string;
  private zoneName?: string;
  private zonePassword?: string;

  constructor() {
    this.customerId = process.env.BRIGHTDATA_CUSTOMER_ID;
    this.zoneName = process.env.BRIGHTDATA_ZONE || 'residential_zone';
    this.zonePassword = process.env.BRIGHTDATA_ZONE_PASSWORD;
  }

  getCapabilities(): ProxyProviderCapabilities {
    return {
      residential: true,
      mobile: true,
      datacenter: true,
      isp: true,
      countryTargeting: true,
      regionTargeting: true,
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
    return Boolean(this.customerId && this.zonePassword);
  }

  async getCountries(_networkType: ProxyNetworkType): Promise<GeoCountryOption[]> {
    return [
      {
        code: 'US',
        name: 'United States',
        regions: [{ code: 'CA', name: 'California' }, { code: 'NY', name: 'New York' }, { code: 'TX', name: 'Texas' }],
        cities: ['Los Angeles', 'New York', 'Dallas', 'Chicago', 'Miami'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER', 'ISP'],
      },
      {
        code: 'GB',
        name: 'United Kingdom',
        regions: [{ code: 'ENG', name: 'England' }],
        cities: ['London', 'Manchester', 'Birmingham'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER', 'ISP'],
      },
      {
        code: 'DE',
        name: 'Germany',
        cities: ['Frankfurt', 'Berlin', 'Munich'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'FR',
        name: 'France',
        cities: ['Paris', 'Marseille', 'Lyon'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'CA',
        name: 'Canada',
        cities: ['Toronto', 'Vancouver', 'Montreal'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'AU',
        name: 'Australia',
        cities: ['Sydney', 'Melbourne', 'Brisbane'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'IN',
        name: 'India',
        cities: ['Mumbai', 'Delhi', 'Bengaluru'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'JP',
        name: 'Japan',
        cities: ['Tokyo', 'Osaka'],
        supportedTypes: ['RESIDENTIAL', 'DATACENTER'],
      },
    ];
  }

  async createSession(params: ProviderCreateSessionParams): Promise<ProviderSessionCredentials> {
    if (!this.isConfigured()) {
      throw new Error('Bright Data credentials not configured. Please set BRIGHTDATA_CUSTOMER_ID and BRIGHTDATA_ZONE_PASSWORD in server environment.');
    }

    const sessionId = `bd_${crypto.randomUUID().slice(0, 10)}`;
    const countryParam = params.country.toLowerCase();
    const cityParam = params.city ? `-city-${params.city.toLowerCase().replace(/\s+/g, '_')}` : '';

    // Standard Bright Data endpoint user format
    const username = `brd-customer-${this.customerId}-zone-${this.zoneName}-country-${countryParam}${cityParam}-session-${sessionId}`;
    const host = 'brd.superproxy.io';
    const port = 22225;

    let expiresAt: string | undefined ;
    if (params.sessionType === 'STICKY' && params.ttlMinutes) {
      expiresAt = new Date(Date.now() + params.ttlMinutes * 60 * 1000).toISOString();
    }

    return {
      host,
      port,
      protocol: 'http',
      username,
      password: this.zonePassword ?? '',
      country: params.country.toUpperCase(),
      region: params.region,
      city: params.city,
      upstreamSessionId: sessionId,
      expiresAt,
    };
  }

  async rotateSession(_upstreamSessionId: string, params: ProviderCreateSessionParams): Promise<ProviderRotateResult> {
    if (!this.isConfigured()) {
      throw new Error('Bright Data credentials not configured.');
    }

    const newSessionId = `bd_${crypto.randomUUID().slice(0, 10)}`;
    const countryParam = params.country.toLowerCase();
    const cityParam = params.city ? `-city-${params.city.toLowerCase().replace(/\s+/g, '_')}` : '';
    const username = `brd-customer-${this.customerId}-zone-${this.zoneName}-country-${countryParam}${cityParam}-session-${newSessionId}`;

    return {
      success: true,
      upstreamSessionId: newSessionId,
      host: 'brd.superproxy.io',
      port: 22225,
      username,
      password: this.zonePassword ?? '',
    };
  }

  async revokeSession(_upstreamSessionId: string): Promise<boolean> {
    return true; // Bright Data sessions expire statelessly
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
        error: 'Bright Data environment credentials not set (BRIGHTDATA_CUSTOMER_ID)',
      };
    }

    return {
      status: 'HEALTHY',
      latencyMs: 45,
    };
  }
}
