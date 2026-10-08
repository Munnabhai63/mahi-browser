/**
 * MAHI Browser — Proxy Provider Registry
 * Phase 5 Architecture
 */

import { ProxyProvider } from './proxy-provider-interface.js';
import { MockProxyProvider } from './adapters/mock-proxy-provider.js';
import { BrightDataProxyProvider } from './adapters/brightdata-adapter.js';
import { OxylabsProxyProvider } from './adapters/oxylabs-adapter.js';
import { SmartproxyProvider } from './adapters/smartproxy-adapter.js';
import {
  ProxyProviderInfo,
  ProxyNetworkType,
  ProxySessionType,
  ProviderHealthStatus,
} from '../../10_CONFIG/shared/types/proxy-provider.js';

export class ProxyProviderRegistry {
  private static instance: ProxyProviderRegistry | null = null;
  private providers = new Map<string, ProxyProvider>();
  private mockProvider: MockProxyProvider;

  private constructor() {
    this.mockProvider = new MockProxyProvider();

    // Register built-in providers
    this.registerProvider(new BrightDataProxyProvider());
    this.registerProvider(new OxylabsProxyProvider());
    this.registerProvider(new SmartproxyProvider());
    this.registerProvider(this.mockProvider);
  }

  public static getInstance(): ProxyProviderRegistry {
    if (!ProxyProviderRegistry.instance) {
      ProxyProviderRegistry.instance = new ProxyProviderRegistry();
    }
    return ProxyProviderRegistry.instance;
  }

  public registerProvider(provider: ProxyProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): ProxyProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): ProxyProvider[] {
    return Array.from(this.providers.values());
  }

  public getMockProvider(): MockProxyProvider {
    return this.mockProvider;
  }

  /**
   * Deterministic auto-provider selection based on:
   * 1. Capability support (network type, city targeting if requested, session type)
   * 2. Configuration readiness (configured vs unconfigured)
   * 3. Priority tier (lower priority number = preferred)
   */
  public async selectBestProvider(params: {
    networkType: ProxyNetworkType;
    country: string;
    city?: string;
    sessionType: ProxySessionType;
  }): Promise<ProxyProvider> {
    const all = this.getAllProviders();

    // Filter providers matching technical capabilities
    const eligible = all.filter((p) => {
      const caps = p.getCapabilities();

      // Check network type
      if (params.networkType === 'RESIDENTIAL' && !caps.residential) return false;
      if (params.networkType === 'MOBILE' && !caps.mobile) return false;
      if (params.networkType === 'DATACENTER' && !caps.datacenter) return false;
      if (params.networkType === 'ISP' && !caps.isp) return false;

      // Check session type
      if (params.sessionType === 'STICKY' && !caps.stickySession) return false;
      if (params.sessionType === 'ROTATING' && !caps.rotatingSession) return false;

      // Check city targeting if requested
      if (params.city && !caps.cityTargeting) return false;

      return true;
    });

    if (eligible.length === 0) {
      // Fallback to mock provider
      return this.mockProvider;
    }

    // Sort: configured first, then by priority ascending
    eligible.sort((a, b) => {
      const aConf = a.isConfigured() ? 1 : 0;
      const bConf = b.isConfigured() ? 1 : 0;
      if (aConf !== bConf) {
        return bConf - aConf; // Configured first
      }
      return a.defaultPriority - b.defaultPriority;
    });

    // Check health of top candidate; if down, failover to next eligible
    for (const candidate of eligible) {
      if (candidate.isConfigured() || candidate.id === 'mock') {
        try {
          const health = await candidate.healthCheck();
          if (health.status === 'HEALTHY' || health.status === 'DEGRADED') {
            return candidate;
          }
        } catch {
          // Failover to next candidate
          continue;
        }
      }
    }

    // Default safe fallback
    return eligible[0] || this.mockProvider;
  }

  public async getProviderInfo(provider: ProxyProvider): Promise<ProxyProviderInfo> {
    let status: ProviderHealthStatus = 'UNCONFIGURED';
    let latencyMs: number | undefined;

    if (provider.isConfigured() || provider.id === 'mock') {
      try {
        const health = await provider.healthCheck();
        status = health.status;
        latencyMs = health.latencyMs;
      } catch {
        status = 'DOWN';
      }
    }

    return {
      id: provider.id,
      name: provider.name,
      description: provider.description,
      website: provider.website,
      isConfigured: provider.isConfigured(),
      isEnabled: true,
      priority: provider.defaultPriority,
      capabilities: provider.getCapabilities(),
      status,
      latencyMs,
    };
  }

  public async getAllProvidersInfo(): Promise<ProxyProviderInfo[]> {
    const list = this.getAllProviders();
    const results: ProxyProviderInfo[] = [];
    for (const p of list) {
      results.push(await this.getProviderInfo(p));
    }
    return results;
  }
}
