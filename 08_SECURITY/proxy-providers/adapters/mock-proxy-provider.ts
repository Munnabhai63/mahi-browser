/**
 * MAHI Browser — Deterministic Mock / Test Proxy Provider
 * Supports end-to-end integration testing, offline dev, and staging.
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

export class MockProxyProvider implements ProxyProvider {
  readonly id = 'mock';
  readonly name = 'MAHI Test Proxy Provider';
  readonly description = 'Built-in deterministic test provider for QA, local simulation, and test automation.';
  readonly website = 'https://mahibrowser.com';
  readonly defaultPriority = 999; // Low priority so commercial providers take precedence when configured

  private shouldSimulateFailure = false;
  private failureReason = 'Mock upstream connection refused';
  private sessionStore = new Map<string, { ip: string; bytesUsed: number; expiresAt?: string }>();

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
      ipWhitelistAuth: false,
      usageApi: true,
      balanceApi: true,
      maxConcurrentSessions: 50,
    };
  }

  isConfigured(): boolean {
    return true; // Mock provider is always ready
  }

  setSimulateFailure(enable: boolean, reason = 'Simulated provider outage'): void {
    this.shouldSimulateFailure = enable;
    this.failureReason = reason;
  }

  async getCountries(networkType: ProxyNetworkType): Promise<GeoCountryOption[]> {
    if (this.shouldSimulateFailure) {
      throw new Error(this.failureReason);
    }

    return [
      {
        code: 'US',
        name: 'United States',
        regions: [
          { code: 'NY', name: 'New York' },
          { code: 'CA', name: 'California' },
          { code: 'IL', name: 'Illinois' },
        ],
        cities: ['New York', 'Los Angeles', 'Chicago'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER', 'ISP'],
      },
      {
        code: 'GB',
        name: 'United Kingdom',
        regions: [
          { code: 'ENG', name: 'England' },
          { code: 'SCT', name: 'Scotland' },
        ],
        cities: ['London', 'Manchester', 'Edinburgh'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER', 'ISP'],
      },
      {
        code: 'DE',
        name: 'Germany',
        cities: ['Frankfurt', 'Berlin', 'Munich'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'IN',
        name: 'India',
        cities: ['Mumbai', 'Delhi', 'Bangalore'],
        supportedTypes: ['RESIDENTIAL', 'MOBILE', 'DATACENTER'],
      },
      {
        code: 'JP',
        name: 'Japan',
        cities: ['Tokyo', 'Osaka'],
        supportedTypes: ['RESIDENTIAL', 'DATACENTER'],
      },
      {
        code: 'SG',
        name: 'Singapore',
        cities: ['Singapore'],
        supportedTypes: ['RESIDENTIAL', 'DATACENTER'],
      },
    ];
  }

  async createSession(params: ProviderCreateSessionParams): Promise<ProviderSessionCredentials> {
    if (this.shouldSimulateFailure) {
      throw new Error(this.failureReason);
    }

    const sessionId = `mock_sess_${crypto.randomUUID().slice(0, 12)}`;
    const randomOctet1 = 100 + Math.floor(Math.random() * 100);
    const randomOctet2 = 10 + Math.floor(Math.random() * 200);
    const ip = `${randomOctet1}.${randomOctet2}.45.89`;

    let expiresAt: string | undefined = undefined;
    if (params.sessionType === 'STICKY' && params.ttlMinutes) {
      expiresAt = new Date(Date.now() + params.ttlMinutes * 60 * 1000).toISOString();
    }

    this.sessionStore.set(sessionId, {
      ip,
      bytesUsed: 0,
      expiresAt,
    });

    const username = `mock-res-user-${params.country.toLowerCase()}-sess-${sessionId}`;
    const password = crypto.randomBytes(8).toString('hex');

    return {
      host: '127.0.0.1',
      port: 8080,
      protocol: 'http',
      username,
      password,
      ip,
      country: params.country.toUpperCase(),
      region: params.region,
      city: params.city,
      upstreamSessionId: sessionId,
      expiresAt,
    };
  }

  async rotateSession(upstreamSessionId: string, params: ProviderCreateSessionParams): Promise<ProviderRotateResult> {
    if (this.shouldSimulateFailure) {
      throw new Error(this.failureReason);
    }

    const session = this.sessionStore.get(upstreamSessionId);
    if (!session) {
      throw new Error(`Mock session "${upstreamSessionId}" not found`);
    }

    const newOctet1 = 100 + Math.floor(Math.random() * 100);
    const newOctet2 = 10 + Math.floor(Math.random() * 200);
    const newIp = `${newOctet1}.${newOctet2}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

    session.ip = newIp;
    const newPassword = crypto.randomBytes(8).toString('hex');

    return {
      success: true,
      upstreamSessionId,
      newIp,
      host: '127.0.0.1',
      port: 8080,
      username: `mock-res-user-${params.country.toLowerCase()}-sess-${upstreamSessionId}`,
      password: newPassword,
    };
  }

  async revokeSession(upstreamSessionId: string): Promise<boolean> {
    return this.sessionStore.delete(upstreamSessionId);
  }

  async getUsage(upstreamSessionId?: string): Promise<ProviderUsageStats> {
    if (upstreamSessionId) {
      const sess = this.sessionStore.get(upstreamSessionId);
      return {
        bytesUsed: sess ? sess.bytesUsed : 0,
        bytesLimit: 10 * 1024 * 1024 * 1024, // 10 GB
        bytesRemaining: 10 * 1024 * 1024 * 1024 - (sess ? sess.bytesUsed : 0),
      };
    }

    let total = 0;
    for (const s of this.sessionStore.values()) {
      total += s.bytesUsed;
    }

    return {
      bytesUsed: total,
      bytesLimit: 100 * 1024 * 1024 * 1024, // 100 GB
      bytesRemaining: 100 * 1024 * 1024 * 1024 - total,
    };
  }

  async healthCheck(): Promise<ProviderHealthCheckResult> {
    if (this.shouldSimulateFailure) {
      return {
        status: 'DOWN',
        latencyMs: 999,
        error: this.failureReason,
      };
    }

    return {
      status: 'HEALTHY',
      latencyMs: 12,
    };
  }
}
