import React, { useState, useEffect, useCallback } from 'react';
import { useWebAuthStore } from './state/useWebAuthStore.js';
import { api } from './api/api-client.js';
import { WebDashboardLayout, WebTab } from './components/WebDashboardLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { ProfilesPage, WebProfileItem } from './pages/ProfilesPage.js';
import { WorkspacesPage } from './pages/WorkspacesPage.js';
import { ProxiesPage, WebProxySession } from './pages/ProxiesPage.js';
import { DeveloperPage } from './pages/DeveloperPage.js';
import { AutomationPage } from './pages/AutomationPage.js';
import { DevicesPage, WebDeviceSession } from './pages/DevicesPage.js';
import { AuditPage, WebAuditItem } from './pages/AuditPage.js';
import { AccountPage } from './pages/AccountPage.js';
import { ProfileModal } from './components/ProfileModal.js';
import { CreateWorkspaceModal } from './components/WorkspaceModal.js';
import { CloudSessionViewer } from './components/CloudSessionViewer.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';

import {
  TeamWorkspace,
  TeamWorkspaceMember,
  TeamRole,
  TeamProfileShare,
} from '../../10_CONFIG/shared/types/workspace.js';
import {
  RemoteApiKeyRecord,
  CreateRemoteApiKeyDTO,
  WebhookEndpointRecord,
  CreateWebhookEndpointDTO,
  WebhookDeliveryRecord,
} from '../../10_CONFIG/shared/types/remote-api.js';
import { ProxyUsageReport } from '../../10_CONFIG/shared/types/proxy-provider.js';

export const WebDashboardApp: React.FC = () => {
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    user,
    currentWorkspace,
    initialize,
    setCurrentWorkspace,
  } = useWebAuthStore();

  const [activeTab, setActiveTab] = useState<WebTab>('overview');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Data collections
  const [profiles, setProfiles] = useState<WebProfileItem[]>([]);
  const [workspaces, setWorkspaces] = useState<TeamWorkspace[]>([]);
  const [members, setMembers] = useState<TeamWorkspaceMember[]>([]);
  const [sharedProfiles, setSharedProfiles] = useState<TeamProfileShare[]>([]);
  const [proxySessions, setProxySessions] = useState<WebProxySession[]>([]);
  const [proxyUsage, setProxyUsage] = useState<ProxyUsageReport | null>(null);
  const [apiKeys, setApiKeys] = useState<RemoteApiKeyRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpointRecord[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDeliveryRecord[]>>({});
  const [devices, setDevices] = useState<WebDeviceSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<WebAuditItem[]>([]);

  // Modals controlled from layout header
  const [isHeaderCreateProfileOpen, setIsHeaderCreateProfileOpen] = useState(false);
  const [isHeaderCreateWorkspaceOpen, setIsHeaderCreateWorkspaceOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Active Cloud Browser Session
  const [activeCloudSession, setActiveCloudSession] = useState<{
    sessionId: string;
    profileId: string;
    profileName: string;
    streamToken: string;
    streamGatewayUrl: string;
    regionId: string;
  } | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Record safe audit activity
  const recordAudit = useCallback((eventType: string, targetResource: string, summary: string, status: 'SUCCESS' | 'FAILURE' | 'DENIED' = 'SUCCESS') => {
    const item: WebAuditItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      eventType,
      actor: user?.email || 'admin@mahibrowser.com',
      targetResource,
      workspaceId: currentWorkspace?.id,
      status,
      timestamp: new Date().toISOString(),
      summary,
    };
    setAuditLogs((prev) => [item, ...prev].slice(0, 100));
  }, [user, currentWorkspace]);

  // Fetch all dashboard data when authenticated
  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingData(true);

    try {
      // 1. Load Profiles
      const profRes = await api.listProfiles();
      if (profRes.success && profRes.data) {
        const mappedProfiles: WebProfileItem[] = profRes.data.map((p: any) => ({
          id: p.id || p.profileId,
          name: p.name || 'Unnamed Profile',
          folder: p.folder,
          tags: p.tags,
          notes: p.notes,
          syncStatus: p.syncStatus || 'SYNCED',
          isLocked: p.isLocked || false,
          lockedBy: p.lockedBy,
          version: p.version || 1,
          assignedProxy: p.proxyConfig?.host ? `${p.proxyConfig.host}:${p.proxyConfig.port}` : undefined,
          lastSync: p.lastSyncAt,
          createdAt: p.createdAt,
        }));
        setProfiles(mappedProfiles);
      }

      // 2. Load Workspaces
      const wsRes = await api.listWorkspaces();
      if (wsRes.success && wsRes.data) {
        setWorkspaces(wsRes.data);
      }

      // 3. Load API Keys
      const keysRes = await api.listApiKeys(currentWorkspace?.id);
      if (keysRes.success && keysRes.data) {
        setApiKeys(keysRes.data);
      }

      // 4. Load Webhooks
      const whRes = await api.listWebhooks(currentWorkspace?.id);
      if (whRes.success && whRes.data) {
        setWebhooks(whRes.data);
      }

      // 5. Load Active Sessions / Devices
      const sessionsRes = await api.getActiveSessions();
      if (sessionsRes.success && sessionsRes.data) {
        const mappedDevices: WebDeviceSession[] = sessionsRes.data.map((s: any) => ({
          sessionId: s.sessionId || s.id || `sess_${Math.random()}`,
          deviceName: s.deviceName || (s.platform ? `${s.platform} Workstation` : 'Windows Desktop Client'),
          platform: s.platform || 'windows',
          ipAddress: s.ipAddress || '127.0.0.1',
          isOnline: s.isOnline !== undefined ? s.isOnline : true,
          lastSeenAt: s.lastSeenAt || new Date().toISOString(),
          clientVersion: s.clientVersion || APP_VERSION,
          isCurrent: s.isCurrent,
        }));
        setDevices(mappedDevices);
      }

      // 6. Load Proxy Usage
      const usageRes = await api.getProxyUsage();
      if (usageRes.success && usageRes.data) {
        setProxyUsage(usageRes.data);
      }

      // If workspace is active, load its members and shared profiles
      if (currentWorkspace) {
        const memRes = await api.getWorkspaceMembers(currentWorkspace.id);
        if (memRes.success && memRes.data) {
          setMembers(memRes.data);
        }

        const shareRes = await api.listSharedProfiles(currentWorkspace.id);
        if (shareRes.success && shareRes.data) {
          setSharedProfiles(shareRes.data);
        }
      } else {
        setMembers([]);
        setSharedProfiles([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated, currentWorkspace]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, loadDashboardData]);

  // If auth is loading, render sleek loading screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-screen bg-[#070b14] flex flex-col items-center justify-center p-4 space-y-4 font-sans text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center animate-pulse">
          <span className="font-bold text-lg">M</span>
        </div>
        <p className="text-xs text-slate-400 font-mono tracking-wider">INITIALIZING MAHI CLOUD CONSOLE...</p>
      </div>
    );
  }

  // If unauthenticated, show Login / Register screen
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // =========================================================================
  // Profile Handlers
  // =========================================================================
  const handleCreateProfile = async (dto: { name: string; folder?: string; notes?: string; tags?: string[] }) => {
    const res = await api.createProfile(dto);
    if (!res.success) {
      recordAudit('profile.create', dto.name, `Failed to create profile: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to create profile');
    }
    recordAudit('profile.created', dto.name, `Created cloud profile "${dto.name}"`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleUpdateProfile = async (id: string, dto: { name?: string; folder?: string; notes?: string; tags?: string[] }) => {
    const res = await api.updateProfile(id, dto);
    if (!res.success) {
      recordAudit('profile.update', id, `Failed to update profile: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to update profile');
    }
    recordAudit('profile.updated', id, `Updated metadata for profile "${dto.name || id}"`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleDeleteProfile = async (id: string) => {
    const res = await api.deleteProfile(id);
    if (!res.success) {
      recordAudit('profile.delete', id, `Failed to delete profile: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to delete profile');
    }
    recordAudit('profile.deleted', id, `Permanently deleted cloud profile "${id}"`, 'SUCCESS');
    await loadDashboardData();
  };

  /**
   * Honest Launch Profile Handler:
   * Calls Remote API. If no desktop client is online, returns code: 'DEVICE_REQUIRED'.
   */
  const handleLaunchProfile = async (id: string) => {
    const res = await api.launchProfile(id);
    if (!res.success) {
      recordAudit('profile.launch', id, `Profile launch blocked: ${res.error?.message || 'Desktop device required'}`, 'DENIED');
      return {
        success: false,
        code: res.error?.code || 'DEVICE_REQUIRED',
        message: res.error?.message || 'Desktop device required',
      };
    }
    recordAudit('profile.launched', id, `Profile launched successfully on connected desktop agent`, 'SUCCESS');
    return { success: true };
  };

  const handleLaunchCloud = async (profile: WebProfileItem) => {
    try {
      const res = await api.startCloudSession({
        profileId: profile.id,
        workspaceId: currentWorkspace?.id,
      });
      if (res.success && res.data) {
        setActiveCloudSession({
          sessionId: res.data.sessionId,
          profileId: profile.id,
          profileName: profile.name,
          streamToken: res.data.streamToken,
          streamGatewayUrl: res.data.streamGatewayUrl,
          regionId: res.data.regionId,
        });
        recordAudit('CLOUD_SESSION_STARTED', `profile:${profile.id}`, `Cloud browser session launched for ${profile.name}`, 'SUCCESS');
      } else {
        setBannerNotice({ type: 'error', message: `Cloud Browser Launch Failed: ${res.error?.message || 'Unknown error'}` });
      }
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: `Failed to launch Cloud Browser: ${err.message}` });
    }
  };

  // =========================================================================
  // Workspace & RBAC Handlers
  // =========================================================================
  const handleCreateWorkspace = async (name: string, description?: string) => {
    const res = await api.createWorkspace(name, description);
    if (!res.success) {
      recordAudit('workspace.create', name, `Failed to create workspace: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to create workspace');
    }
    recordAudit('workspace.created', name, `Created team workspace "${name}"`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleInviteMember = async (email: string, role: TeamRole) => {
    if (!currentWorkspace) return;
    const res = await api.inviteWorkspaceMember(currentWorkspace.id, email, role);
    if (!res.success) {
      recordAudit('member.invite', email, `Failed to invite member: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to invite member');
    }
    recordAudit('member.invited', email, `Invited ${email} with role ${role} to ${currentWorkspace.name}`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleUpdateMemberRole = async (targetUserId: string, role: TeamRole) => {
    if (!currentWorkspace) return;
    const res = await api.updateMemberRole(currentWorkspace.id, targetUserId, role);
    if (!res.success) {
      recordAudit('member.role_update', targetUserId, `Failed to update role: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to update member role');
    }
    recordAudit('member.role_updated', targetUserId, `Updated role to ${role} for user ${targetUserId}`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!currentWorkspace) return;
    const res = await api.removeMember(currentWorkspace.id, targetUserId);
    if (!res.success) {
      recordAudit('member.remove', targetUserId, `Failed to remove member: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to remove member');
    }
    recordAudit('member.removed', targetUserId, `Removed user ${targetUserId} from workspace`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleShareProfile = async (profileId: string, level: string) => {
    if (!currentWorkspace) return;
    const res = await api.shareProfile(currentWorkspace.id, profileId, level);
    if (!res.success) {
      recordAudit('profile.share', profileId, `Failed to share profile: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to share profile');
    }
    recordAudit('profile.shared', profileId, `Shared profile ${profileId} with permission ${level}`, 'SUCCESS');
    await loadDashboardData();
  };

  // =========================================================================
  // Commercial Proxies Handlers
  // =========================================================================
  const handleGenerateProxySession = async (dto: {
    networkType: string;
    country: string;
    sessionType: 'STICKY' | 'ROTATING';
    ttlMinutes?: number;
  }) => {
    const res = await api.generateProxySession(dto);
    if (!res.success || !res.data) {
      recordAudit('proxy.generate', dto.country, `Failed to allocate proxy: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to generate proxy session');
    }
    const allocated = res.data;
    const sessionRec = allocated.session;
    const proxyItem = allocated.proxy;
    const newSession: WebProxySession = {
      sessionId: sessionRec.sessionId || sessionRec.id,
      providerId: sessionRec.providerId,
      networkType: dto.networkType,
      host: proxyItem.host,
      port: proxyItem.port,
      country: sessionRec.country,
      sessionType: dto.sessionType,
      expiresAt: sessionRec.expiresAt || new Date(Date.now() + 30 * 60000).toISOString(),
      status: 'ACTIVE',
    };
    setProxySessions((prev) => [newSession, ...prev]);
    recordAudit('proxy.generated', sessionRec.sessionId || sessionRec.id, `Allocated ${dto.networkType} session in ${dto.country}`, 'SUCCESS');
  };

  const handleRotateProxySession = async (sessionId: string) => {
    const res = await api.rotateProxySession(sessionId);
    if (!res.success) {
      recordAudit('proxy.rotate', sessionId, `Failed to rotate proxy: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to rotate proxy');
    }
    recordAudit('proxy.rotated', sessionId, `Rotated IP address for proxy session ${sessionId}`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleRevokeProxySession = async (sessionId: string) => {
    setProxySessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    recordAudit('proxy.revoked', sessionId, `Revoked proxy session ${sessionId}`, 'SUCCESS');
  };

  // =========================================================================
  // Developer API & Webhooks Handlers
  // =========================================================================
  const handleCreateApiKey = async (dto: CreateRemoteApiKeyDTO) => {
    const res = await api.createApiKey(dto);
    if (!res.success || !res.data) {
      recordAudit('api_key.create', dto.name, `Failed to create API key: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to create API key');
    }
    recordAudit('api_key.created', res.data.apiKey.keyPrefix, `Generated API key "${dto.name}"`, 'SUCCESS');
    await loadDashboardData();
    return {
      secretKey: res.data.secretKey,
      note: res.data.note,
    };
  };

  const handleRevokeApiKey = async (id: string) => {
    const res = await api.revokeApiKey(id);
    if (!res.success) {
      recordAudit('api_key.revoke', id, `Failed to revoke API key: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to revoke API key');
    }
    recordAudit('api_key.revoked', id, `Revoked API key ${id}`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleRotateApiKey = async (id: string) => {
    const res = await api.rotateApiKey(id);
    if (!res.success || !res.data) {
      recordAudit('api_key.rotate', id, `Failed to rotate API key: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to rotate API key');
    }
    recordAudit('api_key.rotated', id, `Rotated secret key for API key ${id}`, 'SUCCESS');
    await loadDashboardData();
    return { newSecretKey: res.data.newSecretKey };
  };

  const handleCreateWebhook = async (dto: CreateWebhookEndpointDTO) => {
    const res = await api.createWebhook(dto);
    if (!res.success || !res.data) {
      recordAudit('webhook.create', dto.url, `Failed to register webhook: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to create webhook');
    }
    recordAudit('webhook.created', dto.url, `Registered webhook endpoint for events: ${dto.events ? dto.events.join(', ') : 'all'}`, 'SUCCESS');
    await loadDashboardData();
    return {
      secret: res.data.secret,
      url: res.data.url,
    };
  };

  const handleDeleteWebhook = async (id: string) => {
    const res = await api.deleteWebhook(id);
    if (!res.success) {
      recordAudit('webhook.delete', id, `Failed to delete webhook: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to delete webhook');
    }
    recordAudit('webhook.deleted', id, `Deleted webhook endpoint ${id}`, 'SUCCESS');
    await loadDashboardData();
  };

  const handleTestWebhook = async (id: string) => {
    const res = await api.testWebhook(id);
    if (!res.success || !res.data) {
      recordAudit('webhook.test', id, `Test ping failed: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Webhook test ping failed');
    }
    recordAudit('webhook.tested', id, `Test ping sent. Status: ${res.data.success ? 'DELIVERED' : 'FAILED'} (${res.data.statusCode})`, 'SUCCESS');
    return res.data;
  };

  const handleRotateWebhookSecret = async (id: string) => {
    const res = await api.rotateWebhookSecret(id);
    if (!res.success || !res.data) {
      throw new Error(res.error?.message || 'Failed to rotate secret');
    }
    recordAudit('webhook.secret_rotated', id, `Rotated signing secret for webhook ${id}`, 'SUCCESS');
    return { newSecret: res.data.newSecret };
  };

  const handleLoadDeliveries = async (id: string) => {
    const res = await api.getWebhookDeliveries(id);
    if (res.success && res.data) {
      setDeliveries((prev) => ({ ...prev, [id]: res.data! }));
    }
  };

  // =========================================================================
  // Device Handlers
  // =========================================================================
  const handleRevokeDeviceSession = async (sessionId: string) => {
    const res = await api.revokeSession(sessionId);
    if (!res.success) {
      recordAudit('session.revoke', sessionId, `Failed to revoke session: ${res.error?.message}`, 'FAILURE');
      throw new Error(res.error?.message || 'Failed to revoke session');
    }
    recordAudit('session.revoked', sessionId, `Revoked device session ${sessionId}`, 'SUCCESS');
    setDevices((prev) => prev.filter((d) => d.sessionId !== sessionId));
  };

  // Determine if desktop agent is online
  const isDesktopOnline = devices.some((d) => d.isOnline && d.platform === 'windows');

  // Derive real current user role in active workspace
  const currentMember = members.find((m) => m.userId === user?.id);
  const currentUserRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' =
    currentWorkspace?.ownerUserId === user?.id || (currentWorkspace?.userRole === 'OWNER')
      ? 'OWNER'
      : ((currentMember?.role?.toUpperCase() as any) || (currentWorkspace?.userRole as any) || 'MEMBER');

  return (
    <WebDashboardLayout
      activeTab={activeTab}
      onNavigate={setActiveTab}
      workspaces={workspaces}
      currentWorkspace={currentWorkspace}
      onSelectWorkspace={setCurrentWorkspace}
      onOpenCreateWorkspace={() => setIsHeaderCreateWorkspaceOpen(true)}
      onOpenCreateProfile={() => setIsHeaderCreateProfileOpen(true)}
      isDesktopOnline={isDesktopOnline}
    >
      {bannerNotice && (
        <div className={`p-3.5 mb-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
          bannerNotice.type === 'error'
            ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
            : 'bg-teal-500/15 border border-teal-500/30 text-teal-300'
        }`}>
          <span>{bannerNotice.message}</span>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-slate-400 hover:text-white ml-2 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Dynamic Content Views */}
      {activeTab === 'overview' && (
        <OverviewPage
          metrics={{
            totalProfiles: profiles.length,
            lockedProfiles: profiles.filter((p) => p.isLocked).length,
            syncedProfiles: profiles.filter((p) => p.syncStatus === 'SYNCED').length,
            workspaceCount: workspaces.length,
            activeProxies: proxySessions.length,
            apiKeysCount: apiKeys.length,
            webhookEndpointsCount: webhooks.length,
            activeDevicesCount: devices.length,
          }}
          onNavigate={setActiveTab}
          onOpenCreateProfile={() => setIsHeaderCreateProfileOpen(true)}
          onOpenCreateWorkspace={() => setIsHeaderCreateWorkspaceOpen(true)}
          isDesktopOnline={isDesktopOnline}
        />
      )}

      {activeTab === 'profiles' && (
        <ProfilesPage
          profiles={profiles}
          isLoading={isLoadingData}
          onRefresh={loadDashboardData}
          onCreateProfile={handleCreateProfile}
          onUpdateProfile={handleUpdateProfile}
          onDeleteProfile={handleDeleteProfile}
          onLaunchProfile={handleLaunchProfile}
          onLaunchCloud={handleLaunchCloud}
          onNavigateToDevices={() => setActiveTab('devices')}
        />
      )}

      {activeTab === 'workspaces' && (
        <WorkspacesPage
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          members={members}
          sharedProfiles={sharedProfiles}
          currentUserRole={currentUserRole}
          isLoading={isLoadingData}
          onSelectWorkspace={setCurrentWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
          onInviteMember={handleInviteMember}
          onUpdateRole={handleUpdateMemberRole}
          onRemoveMember={handleRemoveMember}
          onShareProfile={handleShareProfile}
        />
      )}

      {activeTab === 'proxies' && (
        <ProxiesPage
          sessions={proxySessions}
          usage={proxyUsage}
          isLoading={isLoadingData}
          onRefresh={loadDashboardData}
          onGenerateSession={handleGenerateProxySession}
          onRotateSession={handleRotateProxySession}
          onRevokeSession={handleRevokeProxySession}
        />
      )}

      {activeTab === 'automation' && (
        <AutomationPage
          currentWorkspace={currentWorkspace}
          profiles={profiles}
          recordAudit={recordAudit}
        />
      )}

      {activeTab === 'developer' && (
        <DeveloperPage
          apiKeys={apiKeys}
          webhooks={webhooks}
          deliveries={deliveries}
          workspaces={workspaces}
          isLoading={isLoadingData}
          onRefresh={loadDashboardData}
          onCreateApiKey={handleCreateApiKey}
          onRevokeApiKey={handleRevokeApiKey}
          onRotateApiKey={handleRotateApiKey}
          onCreateWebhook={handleCreateWebhook}
          onDeleteWebhook={handleDeleteWebhook}
          onTestWebhook={handleTestWebhook}
          onRotateWebhookSecret={handleRotateWebhookSecret}
          onLoadDeliveries={handleLoadDeliveries}
        />
      )}

      {activeTab === 'devices' && (
        <DevicesPage
          devices={devices}
          isLoading={isLoadingData}
          onRefresh={loadDashboardData}
          onRevokeSession={handleRevokeDeviceSession}
        />
      )}

      {activeTab === 'audit' && (
        <AuditPage
          logs={auditLogs}
          isLoading={isLoadingData}
          onRefresh={loadDashboardData}
        />
      )}

      {activeTab === 'account' && (
        <AccountPage
          profileCount={profiles.length}
          maxProfiles={
            user?.profileQuota ??
            (user?.planId && user.planId !== 'plan_free' && user.planId !== 'free' ? 100 : 15)
          }
        />
      )}

      {/* Global Modals triggered from header */}
      <ProfileModal
        isOpen={isHeaderCreateProfileOpen}
        mode="create"
        onClose={() => setIsHeaderCreateProfileOpen(false)}
        onSubmit={handleCreateProfile}
      />

      <CreateWorkspaceModal
        isOpen={isHeaderCreateWorkspaceOpen}
        onClose={() => setIsHeaderCreateWorkspaceOpen(false)}
        onSubmit={handleCreateWorkspace}
      />

      {/* Interactive Cloud Browser Session Viewer */}
      {activeCloudSession && (
        <CloudSessionViewer
          sessionId={activeCloudSession.sessionId}
          profileId={activeCloudSession.profileId}
          profileName={activeCloudSession.profileName}
          initialStreamToken={activeCloudSession.streamToken}
          initialStreamGatewayUrl={activeCloudSession.streamGatewayUrl}
          regionId={activeCloudSession.regionId}
          onClose={() => {
            setActiveCloudSession(null);
            loadDashboardData();
          }}
        />
      )}
    </WebDashboardLayout>
  );
};
