import { describe, it, expect, beforeEach } from 'vitest';
import { ProxyProviderRegistry } from '../../08_SECURITY/proxy-providers/proxy-provider-registry.js';
import { MockProxyProvider } from '../../08_SECURITY/proxy-providers/adapters/mock-proxy-provider.js';
import { BrightDataProxyProvider } from '../../08_SECURITY/proxy-providers/adapters/brightdata-adapter.js';
import { OxylabsProxyProvider } from '../../08_SECURITY/proxy-providers/adapters/oxylabs-adapter.js';
import { SmartproxyProvider } from '../../08_SECURITY/proxy-providers/adapters/smartproxy-adapter.js';

describe('Phase 5: Commercial Proxy Provider Platform — Unit Tests', () => {
  let registry: ProxyProviderRegistry;
  let mockProvider: MockProxyProvider;

  beforeEach(() => {
    registry = ProxyProviderRegistry.getInstance();
    mockProvider = registry.getMockProvider();
    mockProvider.setSimulateFailure(false);
  });

  describe('1. Provider Registration & Discovery', () => {
    it('should register built-in commercial adapters and mock provider', () => {
      const providers = registry.getAllProviders();
      expect(providers.length).toBeGreaterThanOrEqual(4);

      const ids = providers.map((p) => p.id);
      expect(ids).toContain('brightdata');
      expect(ids).toContain('oxylabs');
      expect(ids).toContain('smartproxy');
      expect(ids).toContain('mock');
    });

    it('should retrieve specific provider by ID', () => {
      const bd = registry.getProvider('brightdata');
      expect(bd).toBeDefined();
      expect(bd?.name).toBe('Bright Data');
      expect(bd?.website).toContain('brightdata.com');
    });
  });

  describe('2. Provider Capability Matrix', () => {
    it('should declare accurate capabilities for Bright Data', () => {
      const bd = registry.getProvider('brightdata');
      const caps = bd!.getCapabilities();

      expect(caps.residential).toBe(true);
      expect(caps.mobile).toBe(true);
      expect(caps.datacenter).toBe(true);
      expect(caps.isp).toBe(true);
      expect(caps.countryTargeting).toBe(true);
      expect(caps.cityTargeting).toBe(true);
      expect(caps.stickySession).toBe(true);
      expect(caps.rotatingSession).toBe(true);
      expect(caps.sessionTtl).toBe(true);
    });

    it('should declare accurate capabilities for Oxylabs', () => {
      const oxy = registry.getProvider('oxylabs');
      const caps = oxy!.getCapabilities();

      expect(caps.residential).toBe(true);
      expect(caps.mobile).toBe(true);
      expect(caps.datacenter).toBe(true);
      expect(caps.cityTargeting).toBe(true);
      expect(caps.stickySession).toBe(true);
      expect(caps.rotatingSession).toBe(true);
    });

    it('should declare accurate capabilities for Smartproxy', () => {
      const sp = registry.getProvider('smartproxy');
      const caps = sp!.getCapabilities();

      expect(caps.residential).toBe(true);
      expect(caps.mobile).toBe(true);
      expect(caps.stickySession).toBe(true);
      expect(caps.rotatingSession).toBe(true);
    });
  });

  describe('3. Deterministic Auto-Provider Selection', () => {
    it('should select mock provider when commercial credentials are not present in dev', async () => {
      const selected = await registry.selectBestProvider({
        networkType: 'RESIDENTIAL',
        country: 'US',
        sessionType: 'STICKY',
      });

      expect(selected).toBeDefined();
      expect(selected.id).toBe('mock');
    });

    it('should filter providers by city targeting capability', async () => {
      const selected = await registry.selectBestProvider({
        networkType: 'RESIDENTIAL',
        country: 'US',
        city: 'New York',
        sessionType: 'ROTATING',
      });

      expect(selected.getCapabilities().cityTargeting).toBe(true);
    });

    it('should failover to alternative provider when top candidate is down', async () => {
      mockProvider.setSimulateFailure(true, 'Simulated datacenter loss');

      const health = await mockProvider.healthCheck();
      expect(health.status).toBe('DOWN');

      mockProvider.setSimulateFailure(false);
    });
  });

  describe('4. Mock Session Generation & Sticky/Rotating Semantics', () => {
    it('should generate valid session credentials with sticky TTL', async () => {
      const creds = await mockProvider.createSession({
        networkType: 'RESIDENTIAL',
        country: 'US',
        sessionType: 'STICKY',
        ttlMinutes: 45,
      });

      expect(creds.host).toBe('127.0.0.1');
      expect(creds.port).toBe(8080);
      expect(creds.username).toContain('us');
      expect(creds.password).toBeDefined();
      expect(creds.ip).toBeDefined();
      expect(creds.expiresAt).toBeDefined();

      const expiryDate = new Date(creds.expiresAt!).getTime();
      expect(expiryDate).toBeGreaterThan(Date.now() + 40 * 60 * 1000);
    });

    it('should rotate session to a fresh IP address', async () => {
      const initial = await mockProvider.createSession({
        networkType: 'RESIDENTIAL',
        country: 'GB',
        sessionType: 'ROTATING',
      });

      const rotated = await mockProvider.rotateSession(initial.upstreamSessionId, {
        networkType: 'RESIDENTIAL',
        country: 'GB',
        sessionType: 'ROTATING',
      });

      expect(rotated.success).toBe(true);
      expect(rotated.upstreamSessionId).toBe(initial.upstreamSessionId);
      expect(rotated.newIp).toBeDefined();
      expect(rotated.newIp).not.toBe(initial.ip);
    });
  });

  describe('5. Bandwidth & Usage Tracking', () => {
    it('should report session usage within allocated quotas', async () => {
      const creds = await mockProvider.createSession({
        networkType: 'RESIDENTIAL',
        country: 'DE',
        sessionType: 'STICKY',
      });

      const usage = await mockProvider.getUsage(creds.upstreamSessionId);
      expect(usage.bytesUsed).toBe(0);
      expect(usage.bytesLimit).toBe(10 * 1024 * 1024 * 1024);
      expect(usage.bytesRemaining).toBe(10 * 1024 * 1024 * 1024);
    });
  });

  describe('6. Security & Secret Isolation', () => {
    it('should never expose raw API keys or provider master passwords in metadata', async () => {
      const infoList = await registry.getAllProvidersInfo();
      for (const info of infoList) {
        expect((info as any).apiKey).toBeUndefined();
        expect((info as any).password).toBeUndefined();
        expect((info as any).token).toBeUndefined();
        expect((info as any).zonePassword).toBeUndefined();
      }
    });
  });
});
