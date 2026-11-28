/**
 * MAHI Browser — Commercial Proxy Provider Service
 * Phase 5 Architecture
 *
 * Coordinates provider adapters, catalog resolution, session generation,
 * canonical normalization, encryption at rest, profile assignment,
 * RBAC authorization, and cross-user isolation.
 */

import crypto from 'node:crypto';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { logActivity } from './audit-service.js';
import {
  ProxyProviderRegistry,
} from '../../08_SECURITY/proxy-providers/proxy-provider-registry.js';
import type {
  ProxyCatalogQuery,
  ProxyCatalogResult,
  ProxyProviderInfo,
  ProxySessionGenerateRequest,
  ProxySessionResult,
  ProxySessionRecord,
  ProxyUsageReport,
  ProxyRotationResult,
  GeoCountryOption,
  ProxyNetworkType,
  ProxySessionType,
} from '../../10_CONFIG/shared/types/proxy-provider.js';
import type { CreateProxyDTO } from '../../10_CONFIG/shared/types/proxy.js';
import { createProxy, getProxyById, updateProxy, deleteProxy } from '../../02_BROWSER/services/proxy-service.js';
import { hasWorkspacePermission } from './team-workspace-service.js';
import type { TeamPermission } from '../../10_CONFIG/shared/types/workspace.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('proxy-provider-service');

interface SqliteProxyProviderSessionRow {
  id: string;
  provider_id: string;
  proxy_id: string;
  user_id: string;
  workspace_id: string | null;
  profile_id: string | null;
  network_type: string;
  country: string;
  region: string | null;
  city: string | null;
  session_type: string;
  upstream_session_id: string;
  ttl_minutes: number | null;
  expires_at: string | null;
  rotatable: number;
  rotation_count: number;
  status: string;
  bytes_used: number | null;
  created_at: string;
  updated_at: string;
}

interface StoredProfileNetworkSettings {
  network?: {
    proxyId?: string;
    directConnection?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function safeLogActivity(category: 'PROXY' | 'SYSTEM', level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS', action: string, details: string) {
  try {
    logActivity(category, level, action, details);
  } catch (err) {
    log.debug('Proxy provider audit log write skipped', {
      action,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface UserContext {
  userId: string;
  email?: string;
  planId?: string;
  planTier?: string;
  proxyAccess?: boolean;
}

export class ProxyProviderService {
  private static instance: ProxyProviderService | null = null;
  private registry: ProxyProviderRegistry;

  private constructor() {
    this.registry = ProxyProviderRegistry.getInstance();
  }

  public static getInstance(): ProxyProviderService {
    if (!ProxyProviderService.instance) {
      ProxyProviderService.instance = new ProxyProviderService();
    }
    return ProxyProviderService.instance;
  }

  /**
   * Retrieves aggregated catalog options across all enabled providers.
   */
  public async getCatalog(query?: ProxyCatalogQuery, _context?: UserContext): Promise<ProxyCatalogResult> {
    const providers = await this.registry.getAllProvidersInfo();
    const networkType = query?.networkType || 'RESIDENTIAL';

    // Aggregate countries from eligible providers
    const countryMap = new Map<string, GeoCountryOption>();

    for (const p of this.registry.getAllProviders()) {
      try {
        const countries = await p.getCountries(networkType);
        for (const c of countries) {
          const existing = countryMap.get(c.code);
          if (!existing) {
            countryMap.set(c.code, { ...c });
          } else if (c.cities) {
            const mergedCities = Array.from(new Set([...(existing.cities || []), ...c.cities]));
            existing.cities = mergedCities;
          }
        }
      } catch (err) {
        log.warn('Failed fetching country catalog from proxy provider', {
          providerId: p?.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const availableCountries = Array.from(countryMap.values());
    const supportedNetworkTypes: ProxyNetworkType[] = ['RESIDENTIAL', 'MOBILE', 'DATACENTER', 'ISP'];
    const supportedSessionTypes: ProxySessionType[] = ['STICKY', 'ROTATING'];

    return {
      providers,
      availableCountries,
      supportedNetworkTypes,
      supportedSessionTypes,
    };
  }

  /**
   * Returns metadata and live health status for all providers.
   */
  public async getProviders(): Promise<ProxyProviderInfo[]> {
    return this.registry.getAllProvidersInfo();
  }

  /**
   * Generates a new commercial proxy session and normalizes it into MAHI's canonical format.
   */
  public async generateSession(
    request: ProxySessionGenerateRequest,
    context?: UserContext
  ): Promise<ProxySessionResult> {
    const userId = context?.userId || 'default-user';

    // 1. Plan & Entitlement validation
    if (context && context.proxyAccess === false && context.planTier === 'FREE') {
      throw new Error('Built-in commercial proxy generation requires a PRO, BUSINESS, or ENTERPRISE subscription. Free accounts can use BYOP manual proxies.');
    }

    // 2. RBAC check if generating for a team workspace
    if (request.workspaceId) {
      const allowed = hasWorkspacePermission(request.workspaceId, userId, 'PROXY_EDIT' as TeamPermission);
      if (!allowed) {
        throw new Error('User lacks PROXY_EDIT permission in this workspace.');
      }
    }

    // 3. Provider Selection
    let provider = request.providerId && request.providerId !== 'auto'
      ? this.registry.getProvider(request.providerId)
      : undefined;

    if (!provider) {
      provider = await this.registry.selectBestProvider({
        networkType: request.networkType,
        country: request.country,
        city: request.city,
        sessionType: request.sessionType,
      });
    }

    if (!provider) {
      throw new Error('No eligible proxy provider available for the requested parameters.');
    }

    if (provider.id === 'mock' && process.env.NODE_ENV === 'production' && process.env.MAHI_ALLOW_MOCK_PROXY !== '1') {
      throw new Error('Mock proxy provider is disabled in production. Configure real commercial proxy credentials.');
    }

    if (!provider.isConfigured() && provider.id !== 'mock') {
      throw new Error(`Provider "${provider.name}" requires production environment credentials.`);
    }

    // 4. Upstream Session Creation
    const upstreamCreds = await provider.createSession({
      networkType: request.networkType,
      country: request.country,
      region: request.region,
      city: request.city,
      sessionType: request.sessionType,
      ttlMinutes: request.ttlMinutes,
    });

    // 5. Canonical Normalization & Encrypted Storage
    const db = getDatabase();
    const sessionId = crypto.randomUUID();
    const proxyName = `${provider.name} · ${request.networkType} (${request.country.toUpperCase()}${request.city ? ` - ${request.city}` : ''})`;
    const now = new Date().toISOString();

    // Create standard canonical proxy in proxies table
    const createDto: CreateProxyDTO = {
      name: proxyName,
      protocol: upstreamCreds.protocol,
      host: upstreamCreds.host,
      port: upstreamCreds.port,
      username: upstreamCreds.username,
      password: upstreamCreds.password,
      countryRegion: upstreamCreds.country,
      city: upstreamCreds.city,
      region: upstreamCreds.region,
      ip: upstreamCreds.ip,
      notes: request.notes || `Built-in session via ${provider.name}`,
    };

    const canonicalProxy = createProxy(createDto);

    // Update additive columns in proxies table
    try {
      db.prepare(`
        UPDATE proxies 
        SET provider_id = ?, network_type = ?, session_type = ?
        WHERE id = ?
      `).run(provider.id, request.networkType, request.sessionType, canonicalProxy.id);
    } catch (colErr) {
      log.debug('Additive proxy provider column update skipped cleanly', {
        proxyId: canonicalProxy.id,
        err: colErr instanceof Error ? colErr.message : String(colErr),
      });
    }

    // Insert session tracking record in proxy_provider_sessions
    db.prepare(`
      INSERT INTO proxy_provider_sessions (
        id, provider_id, proxy_id, user_id, workspace_id, profile_id,
        network_type, country, region, city, session_type, upstream_session_id,
        ttl_minutes, expires_at, rotatable, rotation_count, status, bytes_used,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE', 0, ?, ?)
    `).run(
      sessionId,
      provider.id,
      canonicalProxy.id,
      userId,
      request.workspaceId || null,
      request.profileId || null,
      request.networkType,
      request.country.toUpperCase(),
      request.region || null,
      request.city || null,
      request.sessionType,
      upstreamCreds.upstreamSessionId,
      request.ttlMinutes || null,
      upstreamCreds.expiresAt || null,
      request.sessionType === 'ROTATING' || provider.getCapabilities().rotatingSession ? 1 : 0,
      now,
      now
    );

    // 6. Direct Profile Assignment if requested
    if (request.profileId) {
      try {
        db.prepare('INSERT OR REPLACE INTO profile_proxies (profile_id, proxy_id) VALUES (?, ?)').run(
          request.profileId,
          canonicalProxy.id
        );
        const settingsRow = db.prepare('SELECT settings_json FROM profile_settings WHERE profile_id = ?').get<{ settings_json: string | null }>(request.profileId);
        let settingsObj: StoredProfileNetworkSettings = {};
        if (settingsRow?.settings_json) {
          try {
            settingsObj = JSON.parse(settingsRow.settings_json) as StoredProfileNetworkSettings;
          } catch (parseErr) {
            log.warn('Failed parsing profile settings_json during proxy assignment', {
              profileId: request.profileId,
              err: parseErr instanceof Error ? parseErr.message : String(parseErr),
            });
          }
        }
        if (!settingsObj.network) settingsObj.network = {};
        settingsObj.network.proxyId = canonicalProxy.id;
        settingsObj.network.directConnection = false;
        db.prepare('INSERT OR REPLACE INTO profile_settings (profile_id, settings_json) VALUES (?, ?)').run(
          request.profileId,
          JSON.stringify(settingsObj)
        );
      } catch (err: unknown) {
        safeLogActivity('PROXY', 'WARNING', 'Profile Assign Failed', err instanceof Error ? err.message : String(err));
      }
    }

    safeLogActivity(
      'PROXY',
      'SUCCESS',
      'Generate Proxy Session',
      `Generated ${request.networkType} session via ${provider.name} in ${request.country.toUpperCase()} for user ${userId}`
    );

    const sessionRecord = this.getSessionById(sessionId);
    const canonicalProxyRecord = getProxyById(canonicalProxy.id);
    if (!sessionRecord || !canonicalProxyRecord) {
      throw new Error(`Failed to reload generated proxy session "${sessionId}".`);
    }
    return {
      session: sessionRecord,
      proxy: canonicalProxyRecord,
    };
  }

  /**
   * Rotates an active session to obtain a new upstream IP address.
   */
  public async rotateSession(sessionId: string, context?: UserContext): Promise<ProxyRotationResult> {
    const session = this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Proxy session "${sessionId}" not found.`);
    }

    // Cross-user isolation
    if (context && context.userId !== session.userId) {
      // Check workspace permission if in shared workspace
      if (!session.workspaceId || !hasWorkspacePermission(session.workspaceId, context.userId, 'PROXY_EDIT' as TeamPermission)) {
        throw new Error('Access denied: You do not own this proxy session.');
      }
    }

    if (session.status !== 'ACTIVE') {
      throw new Error(`Cannot rotate session with status "${session.status}".`);
    }

    const provider = this.registry.getProvider(session.providerId);
    if (!provider) {
      throw new Error(`Provider "${session.providerId}" not available.`);
    }

    const rotateResult = await provider.rotateSession(session.sessionId, {
      networkType: session.networkType,
      country: session.country,
      region: session.region,
      city: session.city,
      sessionType: session.sessionType,
    });

    if (!rotateResult.success) {
      return {
        success: false,
        sessionId,
        rotationCount: session.rotationCount,
        errorMessage: 'Provider failed to rotate upstream session.',
      };
    }

    // Update canonical proxy record
    const db = getDatabase();
    const now = new Date().toISOString();
    updateProxy(session.proxyId, {
      host: rotateResult.host,
      port: rotateResult.port,
      username: rotateResult.username,
      password: rotateResult.password,
      ip: rotateResult.newIp,
    });

    // Update session table
    const newCount = session.rotationCount + 1;
    db.prepare(`
      UPDATE proxy_provider_sessions 
      SET upstream_session_id = ?, rotation_count = ?, updated_at = ?
      WHERE id = ?
    `).run(rotateResult.upstreamSessionId, newCount, now, sessionId);

    safeLogActivity('PROXY', 'SUCCESS', 'Rotate Proxy', `Rotated session ${sessionId} to new IP ${rotateResult.newIp || 'auto'}`);

    return {
      success: true,
      sessionId,
      newIp: rotateResult.newIp,
      rotationCount: newCount,
    };
  }

  /**
   * Revokes and cleans up a proxy session.
   */
  public async releaseSession(sessionId: string, context?: UserContext): Promise<boolean> {
    const session = this.getSessionById(sessionId);
    if (!session) return false;

    // Cross-user isolation
    if (context && context.userId !== session.userId) {
      if (!session.workspaceId || !hasWorkspacePermission(session.workspaceId, context.userId, 'PROXY_EDIT' as TeamPermission)) {
        throw new Error('Access denied: You do not own this proxy session.');
      }
    }

    const provider = this.registry.getProvider(session.providerId);
    if (provider) {
      try {
        await provider.revokeSession(session.sessionId);
      } catch (revokeErr) {
        log.warn('Upstream proxy session revocation failed cleanly', {
          sessionId,
          providerId: session.providerId,
          err: revokeErr instanceof Error ? revokeErr.message : String(revokeErr),
        });
      }
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE proxy_provider_sessions 
      SET status = 'REVOKED', updated_at = ?
      WHERE id = ?
    `).run(now, sessionId);

    // Delete canonical proxy
    deleteProxy(session.proxyId);

    safeLogActivity('PROXY', 'INFO', 'Release Proxy Session', `Revoked proxy session ${sessionId}`);
    return true;
  }

  /**
   * Retrieves all sessions for a user or workspace.
   */
  public getSessions(context?: UserContext): ProxySessionRecord[] {
    const db = getDatabase();
    const userId = context?.userId || 'default-user';

    const rows = db.prepare(`
      SELECT * FROM proxy_provider_sessions
      WHERE user_id = ? OR workspace_id IN (
        SELECT workspace_id FROM team_workspace_members WHERE user_id = ? AND status = 'ACTIVE'
      )
      ORDER BY created_at DESC
    `).all<SqliteProxyProviderSessionRow>(userId, userId);

    return rows.map(this.mapSessionRow);
  }

  public getSessionById(id: string): ProxySessionRecord | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM proxy_provider_sessions WHERE id = ?').get<SqliteProxyProviderSessionRow>(id);
    if (!row) return null;
    return this.mapSessionRow(row);
  }

  /**
   * Aggregates bandwidth usage for a session or the user account.
   */
  public async getUsage(sessionId?: string, context?: UserContext): Promise<ProxyUsageReport> {
    const userId = context?.userId || 'default-user';

    if (sessionId) {
      const session = this.getSessionById(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found.`);
      }

      const provider = this.registry.getProvider(session.providerId);
      const stats = provider ? await provider.getUsage(session.sessionId) : { bytesUsed: session.bytesUsed };

      return {
        sessionId,
        providerId: session.providerId,
        userId: session.userId,
        bytesUsed: stats.bytesUsed,
        bytesLimit: stats.bytesLimit,
        bytesRemaining: stats.bytesRemaining,
        activeSessionCount: 1,
        lastUpdated: new Date().toISOString(),
      };
    }

    // User-wide usage aggregation
    const sessions = this.getSessions(context);
    const totalUsed = sessions.reduce((sum, s) => sum + (s.bytesUsed || 0), 0);
    const activeCount = sessions.filter((s) => s.status === 'ACTIVE').length;

    return {
      userId,
      bytesUsed: totalUsed,
      bytesLimit: 50 * 1024 * 1024 * 1024, // 50 GB default quota
      bytesRemaining: 50 * 1024 * 1024 * 1024 - totalUsed,
      activeSessionCount: activeCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  private mapSessionRow(row: SqliteProxyProviderSessionRow): ProxySessionRecord {
    return {
      id: row.id,
      providerId: row.provider_id,
      proxyId: row.proxy_id,
      userId: row.user_id,
      workspaceId: row.workspace_id || undefined,
      profileId: row.profile_id || undefined,
      networkType: row.network_type as ProxyNetworkType,
      country: row.country,
      region: row.region || undefined,
      city: row.city || undefined,
      sessionType: row.session_type as ProxySessionType,
      sessionId: row.upstream_session_id,
      ttlMinutes: row.ttl_minutes || undefined,
      expiresAt: row.expires_at || undefined,
      rotatable: Boolean(row.rotatable),
      rotationCount: Number(row.rotation_count) || 0,
      status: row.status as 'ACTIVE' | 'EXPIRED' | 'REVOKED',
      bytesUsed: Number(row.bytes_used) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const proxyProviderService = ProxyProviderService.getInstance();
