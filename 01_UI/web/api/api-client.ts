/**
 * MAHI Browser — Web Management Dashboard API Client
 * Phase 7 Architecture
 *
 * Consumes the Phase 6 Remote Cloud API (https://api.mahibrowser.com/v1 and /api/v1/remote/*).
 * Never directly accesses SQLite, PostgreSQL, R2, or internal backend services.
 */

import {
  RemoteApiResponse,
  RemoteApiKeyRecord,
  CreateRemoteApiKeyDTO,
  WebhookEndpointRecord,
  CreateWebhookEndpointDTO,
  WebhookDeliveryRecord,
  RemoteProfileRunResult,
} from '../../../10_CONFIG/shared/types/remote-api.js';
import {
  TeamWorkspace,
  TeamWorkspaceMember,
  TeamRole,
  TeamProfileShare,
} from '../../../10_CONFIG/shared/types/workspace.js';
import {
  ProxyCatalogResult,
  ProxySessionResult,
  ProxyRotationResult,
  ProxyUsageReport,
} from '../../../10_CONFIG/shared/types/proxy-provider.js';

export interface ApiClientConfig {
  baseUrl?: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
}

export class WebApiClient {
  private baseUrl: string;
  private getAccessToken: () => string | null;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig = {}) {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    } else if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'app.mahibrowser.com' || (hostname.endsWith('.mahibrowser.com') && hostname !== 'api.mahibrowser.com')) {
        this.baseUrl = (import.meta as any).env?.VITE_COMMERCIAL_API_URL || 'https://api.mahibrowser.com';
      } else {
        this.baseUrl = window.location.origin;
      }
    } else {
      this.baseUrl = 'http://localhost:8989';
    }
    this.getAccessToken = config.getAccessToken || (() => null);
    this.onUnauthorized = config.onUnauthorized;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  public setTokenGetter(getter: () => string | null) {
    this.getAccessToken = getter;
  }

  public setOnUnauthorized(cb?: () => void) {
    this.onUnauthorized = cb;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    customHeaders: Record<string, string> = {}
  ): Promise<RemoteApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const token = this.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': `req_web_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      ...customHeaders,
      ...(options.headers as Record<string, string> || {}),
    };

    if (token && !headers['Authorization'] && !headers['X-API-Key']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      let json: any;
      try {
        json = await res.json();
      } catch {
        json = { success: false, error: { code: 'INVALID_RESPONSE', message: 'Failed to parse JSON response' } };
      }

      if (res.status === 401) {
        if (this.onUnauthorized) {
          this.onUnauthorized();
        }
      }

      if (!res.ok && !json.error) {
        json.error = {
          code: `HTTP_${res.status}`,
          message: res.statusText || 'Request failed',
        };
      }

      return json;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Network request failed. Please check connectivity.',
          requestId: headers['X-Request-Id'],
        },
      };
    }
  }

  // ==========================================================================
  // 1. AUTHENTICATION (Central Auth Integration)
  // ==========================================================================

  public async login(email: string, password: string) {
    return this.request<{
      token: string;
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
      user: { id: string; email: string; name: string; role: string; planId: string; profileQuota?: number };
    }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform: 'web-dashboard' }),
    });
  }

  public async register(email: string, password: string, name: string) {
    return this.request<{
      user: { id: string; email: string; name: string };
      tokens?: { accessToken: string; refreshToken: string };
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  public async refreshToken(refreshToken: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  public async logout(refreshToken?: string) {
    return this.request<{ success: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  public async getActiveSessions() {
    return this.request<any[]>('/api/v1/auth/sessions', { method: 'GET' });
  }

  public async revokeSession(sessionId: string) {
    return this.request<{ success: boolean }>(`/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE' });
  }

  // ==========================================================================
  // 2. REMOTE PROFILES
  // ==========================================================================

  public async listProfiles(params: { page?: number; limit?: number; folder?: string; status?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page.toString());
    if (params.limit) qs.set('limit', params.limit.toString());
    if (params.folder) qs.set('folder', params.folder);
    if (params.status) qs.set('status', params.status);

    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<any[]>(`/api/v1/remote/profiles${query}`, { method: 'GET' });
  }

  public async getProfile(profileId: string) {
    return this.request<any>(`/api/v1/remote/profiles/${profileId}`, { method: 'GET' });
  }

  public async createProfile(dto: { name: string; folder?: string; description?: string; tags?: string[] }, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    return this.request<any>('/api/v1/remote/profiles', {
      method: 'POST',
      body: JSON.stringify(dto),
    }, headers);
  }

  public async updateProfile(profileId: string, dto: { name?: string; notes?: string; folder?: string }) {
    return this.request<any>(`/api/v1/remote/profiles/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  }

  public async deleteProfile(profileId: string) {
    return this.request<{ deleted: boolean; profileId: string }>(`/api/v1/remote/profiles/${profileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Honest Profile Run Model:
   * Requests profile launch on desktop. If no desktop agent is online,
   * returns DEVICE_REQUIRED. Never fabricates remote launches.
   */
  public async launchProfile(profileId: string) {
    return this.request<RemoteProfileRunResult>(`/api/v1/remote/profiles/${profileId}/launch`, {
      method: 'POST',
    });
  }

  // ==========================================================================
  // 3. TEAM WORKSPACES & RBAC
  // ==========================================================================

  public async listWorkspaces() {
    return this.request<TeamWorkspace[]>('/api/v1/remote/workspaces', { method: 'GET' });
  }

  public async createWorkspace(name: string, description?: string) {
    return this.request<TeamWorkspace>('/api/v1/remote/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  public async getWorkspaceMembers(workspaceId: string) {
    return this.request<TeamWorkspaceMember[]>(`/api/v1/remote/workspaces/${workspaceId}/members`, { method: 'GET' });
  }

  public async inviteWorkspaceMember(workspaceId: string, email: string, role: TeamRole = 'MEMBER') {
    return this.request<any>(`/api/v1/remote/workspaces/${workspaceId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  public async updateMemberRole(workspaceId: string, targetUserId: string, role: TeamRole) {
    return this.request<{ success: boolean }>(`/api/v1/remote/workspaces/${workspaceId}/members/${targetUserId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  public async removeMember(workspaceId: string, targetUserId: string) {
    return this.request<{ removed: boolean }>(`/api/v1/remote/workspaces/${workspaceId}/members/${targetUserId}`, {
      method: 'DELETE',
    });
  }

  public async listSharedProfiles(workspaceId: string) {
    return this.request<TeamProfileShare[]>(`/api/v1/remote/workspaces/${workspaceId}/profiles`, { method: 'GET' });
  }

  public async shareProfile(workspaceId: string, profileId: string, permissionLevel = 'RUN') {
    return this.request<TeamProfileShare>(`/api/v1/remote/workspaces/${workspaceId}/profiles/share`, {
      method: 'POST',
      body: JSON.stringify({ profileId, permissionLevel }),
    });
  }

  // ==========================================================================
  // 4. COMMERCIAL PROXIES
  // ==========================================================================

  public async getProxyCatalog(params: { networkType?: string; country?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.networkType) qs.set('networkType', params.networkType);
    if (params.country) qs.set('country', params.country);
    const query = qs.toString() ? `?${qs.toString()}` : '';

    return this.request<ProxyCatalogResult>(`/api/v1/remote/proxies/catalog${query}`, { method: 'GET' });
  }

  public async generateProxySession(dto: {
    networkType: string;
    country: string;
    region?: string;
    city?: string;
    sessionType?: 'STICKY' | 'ROTATING';
    ttlMinutes?: number;
    providerId?: string;
  }, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    return this.request<ProxySessionResult>('/api/v1/remote/proxies/generate', {
      method: 'POST',
      body: JSON.stringify(dto),
    }, headers);
  }

  public async rotateProxySession(sessionId: string) {
    return this.request<ProxyRotationResult>(`/api/v1/remote/proxies/${sessionId}/rotate`, { method: 'POST' });
  }

  public async getProxyUsage() {
    return this.request<ProxyUsageReport>('/api/v1/remote/proxies/usage', { method: 'GET' });
  }

  // ==========================================================================
  // 5. DEVELOPER API KEYS
  // ==========================================================================

  public async listApiKeys(workspaceId?: string) {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.request<RemoteApiKeyRecord[]>(`/api/v1/remote/api-keys${query}`, { method: 'GET' });
  }

  public async createApiKey(dto: CreateRemoteApiKeyDTO) {
    return this.request<{ apiKey: RemoteApiKeyRecord; secretKey: string; note: string }>('/api/v1/remote/api-keys', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  public async revokeApiKey(keyId: string) {
    return this.request<{ revoked: boolean; keyId: string }>(`/api/v1/remote/api-keys/${keyId}`, { method: 'DELETE' });
  }

  public async rotateApiKey(keyId: string) {
    return this.request<{ apiKey: RemoteApiKeyRecord; newSecretKey: string }>(`/api/v1/remote/api-keys/${keyId}/rotate`, {
      method: 'POST',
    });
  }

  public async getApiKeyAudits(keyId: string) {
    return this.request<any[]>(`/api/v1/remote/api-keys/${keyId}/audits`, { method: 'GET' });
  }

  // ==========================================================================
  // 6. OUTBOUND WEBHOOKS
  // ==========================================================================

  public async listWebhooks(workspaceId?: string) {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.request<WebhookEndpointRecord[]>(`/api/v1/remote/webhooks${query}`, { method: 'GET' });
  }

  public async createWebhook(dto: CreateWebhookEndpointDTO) {
    return this.request<{ id: string; url: string; events: string[]; secret: string; note: string }>('/api/v1/remote/webhooks', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  public async deleteWebhook(endpointId: string) {
    return this.request<{ revoked: boolean; endpointId: string }>(`/api/v1/remote/webhooks/${endpointId}`, {
      method: 'DELETE',
    });
  }

  public async rotateWebhookSecret(endpointId: string) {
    return this.request<{ endpointId: string; newSecret: string }>(`/api/v1/remote/webhooks/${endpointId}/rotate-secret`, {
      method: 'POST',
    });
  }

  public async testWebhook(endpointId: string, options: { allowHttp?: boolean } = {}) {
    return this.request<WebhookDeliveryRecord>(`/api/v1/remote/webhooks/${endpointId}/test`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  public async getWebhookDeliveries(endpointId: string) {
    return this.request<WebhookDeliveryRecord[]>(`/api/v1/remote/webhooks/${endpointId}/deliveries`, {
      method: 'GET',
    });
  }

  // ==========================================================================
  // 7. AUTOMATION & RPA
  // ==========================================================================

  public async listWorkflows(workspaceId?: string) {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.request<any[]>(`/api/v1/remote/automation/workflows${query}`, { method: 'GET' });
  }

  public async getWorkflow(workflowId: string) {
    return this.request<any>(`/api/v1/remote/automation/workflows/${workflowId}`, { method: 'GET' });
  }

  public async runWorkflow(workflowId: string, profileId?: string) {
    return this.request<{ runId: string; workflowId: string; profileId?: string; status: string; message: string }>(
      `/api/v1/remote/automation/workflows/${workflowId}/run`,
      {
        method: 'POST',
        body: JSON.stringify({ profileId }),
      }
    );
  }

  public async getWorkflowRuns(workflowId?: string) {
    const query = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : '';
    return this.request<any[]>(`/api/v1/remote/automation/runs${query}`, { method: 'GET' });
  }

  public async getWorkflowRunLogs(runId: string) {
    return this.request<any[]>(`/api/v1/remote/automation/runs/${runId}`, { method: 'GET' });
  }

  public async stopWorkflowRun(runId: string) {
    return this.request<{ stopped: boolean; runId: string }>(`/api/v1/remote/automation/runs/${runId}/stop`, {
      method: 'POST',
    });
  }

  public async listSchedules(workspaceId?: string) {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.request<any[]>(`/api/v1/remote/automation/schedules${query}`, { method: 'GET' });
  }

  public async createSchedule(dto: any) {
    return this.request<any>('/api/v1/remote/automation/schedules', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  public async deleteSchedule(scheduleId: string) {
    return this.request<{ deleted: boolean; scheduleId: string }>(`/api/v1/remote/automation/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  }

  public async getAutomationTemplates() {
    return this.request<any[]>('/api/v1/remote/automation/templates', { method: 'GET' });
  }

  // ========================================================================
  // PHASE 10: CLOUD BROWSER API METHODS
  // ========================================================================

  public async startCloudSession(dto: {
    profileId: string;
    workspaceId?: string;
    regionId?: string;
    resourceClass?: string;
    maxDurationSeconds?: number;
    idleTimeoutSeconds?: number;
    startupUrl?: string;
  }) {
    return this.request<any>('/api/v1/remote/cloud-browser/sessions', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  public async listCloudSessions() {
    return this.request<any[]>('/api/v1/remote/cloud-browser/sessions', { method: 'GET' });
  }

  public async getCloudSession(sessionId: string) {
    return this.request<any>(`/api/v1/remote/cloud-browser/sessions/${sessionId}`, { method: 'GET' });
  }

  public async stopCloudSession(sessionId: string, reason?: string) {
    return this.request<any>(`/api/v1/remote/cloud-browser/sessions/${sessionId}/stop`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'USER_REQUESTED' }),
    });
  }

  public async getCloudReconnectToken(sessionId: string) {
    return this.request<{ sessionId: string; streamToken: string; streamGatewayUrl: string }>(
      `/api/v1/remote/cloud-browser/sessions/${sessionId}/reconnect-token`,
      { method: 'POST' }
    );
  }

  public async listCloudRegions() {
    return this.request<any[]>('/api/v1/remote/cloud-browser/regions', { method: 'GET' });
  }

  public async getCloudUsage() {
    return this.request<any>('/api/v1/remote/cloud-browser/usage', { method: 'GET' });
  }

  public async sendCloudInput(sessionId: string, action: any, streamToken?: string) {
    const headers: Record<string, string> = {};
    if (streamToken) headers['x-stream-token'] = streamToken;
    return this.request<any>(`/api/v1/remote/cloud-browser/sessions/${sessionId}/input`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action }),
    });
  }

  // ========================================================================
  // PHASE 11: ANDROID MOBILE COMPANION CLIENT METHODS
  // ========================================================================

  public async registerMobileDevice(dto: {
    deviceId: string;
    pushToken: string;
    deviceModel?: string;
    osVersion?: string;
    appVersion?: string;
  }) {
    return this.request<any>('/api/v1/remote/mobile/device-token', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  public async revokeMobileDevice(deviceId: string) {
    return this.request<{ success: boolean }>(`/api/v1/remote/mobile/device-token/${deviceId}`, {
      method: 'DELETE',
    });
  }

  public async getMobileNotifications(unreadOnly = false) {
    const query = unreadOnly ? '?unread=true' : '';
    return this.request<any[]>(`/api/v1/remote/mobile/notifications${query}`, { method: 'GET' });
  }

  public async markMobileNotificationRead(notificationId: string) {
    return this.request<{ success: boolean }>(`/api/v1/remote/mobile/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  public async getMobileNotificationPreferences() {
    return this.request<any>('/api/v1/remote/mobile/notifications/preferences', { method: 'GET' });
  }

  public async updateMobileNotificationPreferences(preferences: any) {
    return this.request<any>('/api/v1/remote/mobile/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }
}

// Default global instance for browser use
export const api = new WebApiClient();
