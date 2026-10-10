/**
 * MAHI Browser — P1 Blocker Remediation Unit & Integration Tests
 * Covers P1-1 through P1-5 Remediation Verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { ProxyProviderRegistry } from '../../08_SECURITY/proxy-providers/proxy-provider-registry.js';
import {
  TelemetryMonitorService,
  telemetryMonitor,
} from '../../07_BACKEND/services/telemetry-monitor-service.js';

describe('P1 Blocker Remediation Suite (P1-1 to P1-5)', () => {
  beforeEach(async () => {
    await initializeDatabase();
    telemetryMonitor.clearAlertsForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. P1-1: macOS Developer ID & Notarization Pipeline Binding', () => {
    it('verifies electron-builder.json binds sign-mac.cjs as afterSign hook with hardened runtime', () => {
      const builderConfigPath = path.join(process.cwd(), 'electron-builder.json');
      expect(fs.existsSync(builderConfigPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
      expect(config.mac).toBeDefined();
      expect(config.mac.hardenedRuntime).toBe(true);
      expect(config.afterSign || config.mac.afterSign).toBe('./12_SCRIPTS/sign-mac.cjs');
      expect(config.mac.entitlements).toContain('entitlements.mac.plist');
    });
  });

  describe('2. P1-2: Commercial Proxy Platform & Credential Failover', () => {
    it('reports proxy provider info cleanly without exposing raw zone passwords or secret tokens', async () => {
      const registry = ProxyProviderRegistry.getInstance();
      const allInfo = await registry.getAllProvidersInfo();

      expect(allInfo.length).toBeGreaterThanOrEqual(3);
      const brightdata = allInfo.find((p) => p.id === 'brightdata');
      expect(brightdata).toBeDefined();
      expect(brightdata?.capabilities.residential).toBe(true);

      // Verify that raw password properties are not leaked in info objects
      expect((brightdata as any).zonePassword).toBeUndefined();
      expect((brightdata as any).apiKey).toBeUndefined();
    });

    it('falls back to mock/healthy provider when live credentials are not present', async () => {
      const registry = ProxyProviderRegistry.getInstance();
      const selected = await registry.selectBestProvider({
        networkType: 'RESIDENTIAL',
        country: 'US',
        sessionType: 'ROTATING',
      });

      expect(selected).toBeDefined();
      expect(typeof selected.createSession).toBe('function');
    });
  });

  describe('3. P1-3: Production DNS, SSL & Reverse Proxy Infrastructure', () => {
    it('verifies nginx-production.conf provides SSL termination, WebSocket stream, and edge rate-limiting', () => {
      const nginxPath = path.join(process.cwd(), '10_CONFIG', 'infrastructure', 'nginx-production.conf');
      expect(fs.existsSync(nginxPath)).toBe(true);

      const conf = fs.readFileSync(nginxPath, 'utf8');
      expect(conf).toContain('api.mahibrowser.com');
      expect(conf).toContain('app.mahibrowser.com');
      expect(conf).toContain('proxy_set_header Upgrade $http_upgrade');
      expect(conf).toContain('proxy_set_header Connection "upgrade"');
      expect(conf).toContain('limit_req_zone');
      expect(conf).toContain('Strict-Transport-Security');
    });
  });

  describe('4. P1-4: Standalone Acceptable Use Policy (AUP)', () => {
    it('verifies landing/aup.html exists and defines comprehensive abuse prohibitions and contact points', () => {
      const aupPath = path.join(process.cwd(), 'landing', 'aup.html');
      expect(fs.existsSync(aupPath)).toBe(true);

      const aupHtml = fs.readFileSync(aupPath, 'utf8');
      expect(aupHtml).toContain('Acceptable Use Policy');
      expect(aupHtml).toContain('Carding');
      expect(aupHtml).toContain('Credential Stuffing');
      expect(aupHtml).toContain('Malware');
      expect(aupHtml).toContain('mahiverse.official@gmail.com');
      expect(aupHtml).toContain('mahiverse.hub@gmail.com');
    });
  });

  describe('5. P1-5: Centralized Telemetry, Monitoring & Alerting', () => {
    it('monitors Database health and table integrity', async () => {
      const dbHealth = await telemetryMonitor.checkDatabaseHealth();
      expect(dbHealth.status).toBe('OK');
      expect(dbHealth.tablesCount).toBeGreaterThan(15);
      expect(dbHealth.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('monitors Storage provider health and system metrics', async () => {
      const storageHealth = await telemetryMonitor.checkStorageHealth();
      expect(storageHealth.status).toBe('OK');
      expect(storageHealth.providerName).toBeDefined();

      const sys = telemetryMonitor.checkSystemMetrics();
      expect(sys.ramTotalMb).toBeGreaterThan(0);
      expect(sys.ramUsedMb).toBeGreaterThan(0);
      expect(sys.ramUsagePercent).toBeGreaterThanOrEqual(0);
    });

    it('tracks backup, cloud session, and email failure events and dispatches alerts', () => {
      telemetryMonitor.recordBackupFailure('bk_101', 'Remote cloud storage timeout');
      telemetryMonitor.recordCloudSessionFailure('sess_202', 'CDP browser worker crash');
      telemetryMonitor.recordEmailFailure('user@target.com', 'SMTP relay rejected 550');

      const alerts = telemetryMonitor.getAlerts();
      expect(alerts.length).toBe(3);

      expect(alerts.some((a) => a.subsystem === 'BACKUP')).toBe(true);
      expect(alerts.some((a) => a.subsystem === 'CLOUD_SESSION')).toBe(true);
      expect(alerts.some((a) => a.subsystem === 'EMAIL')).toBe(true);
    });

    it('generates full comprehensive health check report', async () => {
      const report = await telemetryMonitor.runFullSystemHealthCheck();
      expect(report.timestamp).toBeDefined();
      expect(['HEALTHY', 'DEGRADED', 'DOWN']).toContain(report.overallStatus);
      expect(report.checks.database.status).toBe('OK');
      expect(report.checks.storage.status).toBe('OK');
    });
  });
});
