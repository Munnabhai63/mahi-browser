import React, { useState, useEffect } from 'react';
import { MobileTab, MobileNotificationRecord, MobileNotificationPreferences } from '../../10_CONFIG/shared/types/mobile';
import { MobileHomeTab } from './tabs/MobileHomeTab';
import { MobileProfilesTab, MobileProfileItem } from './tabs/MobileProfilesTab';
import { MobileCloudViewer } from './tabs/MobileCloudViewer';
import { MobileWorkspacesTab, MobileWorkspaceItem } from './tabs/MobileWorkspacesTab';
import { MobileProxiesTab, MobileProxyItem } from './tabs/MobileProxiesTab';
import { MobileAutomationTab, MobileWorkflowRunItem } from './tabs/MobileAutomationTab';
import { MobileAccountTab, MobileDeviceSessionItem } from './tabs/MobileAccountTab';
import { MobileSecureStorage } from './storage/mobile-secure-storage';
import { BiometricAuthService } from './security/biometric-auth';
import { MobileOfflineCache } from './offline/offline-cache';

export const MobileApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);

  // Auth form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Sample data states (synced with cache/API)
  const [profiles, setProfiles] = useState<MobileProfileItem[]>([
    {
      id: 'prof_us_ecommerce_01',
      name: 'US Amazon Seller Ops',
      os: 'windows',
      browserVersion: '124.0.6367.60',
      proxy: 'US 198.51.100.24:8080 (Residential)',
      syncState: 'SYNCED',
      cloudVersion: 4,
      lastSyncedAt: new Date().toISOString(),
      isLocked: false,
    },
    {
      id: 'prof_fb_ads_mktg',
      name: 'Meta Ads Manager Pro',
      os: 'macos',
      browserVersion: '124.0.6367.60',
      proxy: 'DE 203.0.113.89:3128 (Datacenter)',
      syncState: 'SYNCED',
      cloudVersion: 2,
      lastSyncedAt: new Date(Date.now() - 3600000).toISOString(),
      isLocked: false,
    },
    {
      id: 'prof_tiktok_creator',
      name: 'TikTok Creator UK',
      os: 'android',
      browserVersion: '124.0.6367.60',
      proxy: 'GB 198.51.100.99:8080 (Residential)',
      syncState: 'PENDING',
      cloudVersion: 1,
      lastSyncedAt: new Date(Date.now() - 7200000).toISOString(),
      isLocked: false,
    },
  ]);

  const [activeCloudSession, setActiveCloudSession] = useState<{
    sessionId: string;
    profileId: string;
    profileName: string;
  } | null>(null);

  const [workspaces, setWorkspaces] = useState<MobileWorkspaceItem[]>([
    {
      id: 'ws_agency_default',
      name: 'Core Growth Agency',
      currentUserRole: 'OWNER',
      memberCount: 4,
      sharedProfileCount: 18,
      members: [
        { id: 'usr_owner_01', email: 'owner@workspace.local', name: 'Workspace Owner', role: 'OWNER', joinedAt: '2026-01-01' },
        { id: 'usr_admin_02', email: 'sarah@agency.com', name: 'Sarah Admin', role: 'ADMIN', joinedAt: '2026-02-15' },
        { id: 'usr_op_03', email: 'alex@agency.com', name: 'Alex Operator', role: 'OPERATOR', joinedAt: '2026-03-10' },
        { id: 'usr_view_04', email: 'client@brand.com', name: 'Client Auditor', role: 'VIEWER', joinedAt: '2026-03-20' },
      ],
    },
    {
      id: 'ws_personal',
      name: 'Personal Sandbox',
      currentUserRole: 'OWNER',
      memberCount: 1,
      sharedProfileCount: 6,
      members: [
        { id: 'usr_owner_01', email: 'owner@workspace.local', name: 'Workspace Owner', role: 'OWNER', joinedAt: '2026-01-01' },
      ],
    },
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws_agency_default');

  const [proxies, setProxies] = useState<MobileProxyItem[]>([
    { id: 'prx_us_01', type: 'BUILTIN', host: '198.51.100.24', port: 8080, country: 'US', protocol: 'HTTP', assignedProfileCount: 3, dataUsageBytes: 312000000, status: 'ONLINE' },
    { id: 'prx_de_02', type: 'BUILTIN', host: '203.0.113.89', port: 3128, country: 'DE', protocol: 'HTTP', assignedProfileCount: 2, dataUsageBytes: 154000000, status: 'ONLINE' },
    { id: 'prx_gb_03', type: 'CUSTOM', host: '198.51.100.99', port: 8080, country: 'GB', protocol: 'SOCKS5', assignedProfileCount: 1, dataUsageBytes: 89000000, status: 'ONLINE' },
  ]);

  const [automationRuns, setAutomationRuns] = useState<MobileWorkflowRunItem[]>([
    { id: 'run_wf_01', name: 'Daily Amazon Seller Check', profileName: 'US Amazon Seller Ops', status: 'COMPLETED', startedAt: new Date(Date.now() - 1800000).toISOString(), durationSec: 42, stepsCount: 6 },
    { id: 'run_wf_02', name: 'Ad Campaign Scrape', profileName: 'Meta Ads Manager Pro', status: 'RUNNING', startedAt: new Date(Date.now() - 120000).toISOString(), durationSec: 12, stepsCount: 8 },
  ]);

  const [devices, setDevices] = useState<MobileDeviceSessionItem[]>([
    { id: 'dev_android_pixel', platform: 'android', deviceName: 'Pixel 8 Pro (This Android)', appVersion: '11.0.0', ip: '192.168.1.105', lastSeen: new Date().toISOString(), isCurrent: true },
    { id: 'dev_win_desktop', platform: 'windows', deviceName: 'Workstation Desktop (Win 11)', appVersion: '10.2.0', ip: '192.168.1.42', lastSeen: new Date(Date.now() - 600000).toISOString(), isCurrent: false },
    { id: 'dev_mac_laptop', platform: 'macos', deviceName: 'MacBook Air M2', appVersion: '10.2.0', ip: '10.0.0.15', lastSeen: new Date(Date.now() - 86400000).toISOString(), isCurrent: false },
  ]);

  const [notifications, setNotifications] = useState<MobileNotificationRecord[]>([
    { id: 'notif_1', userId: 'usr_owner_01', category: 'CLOUD_SESSION', title: 'Cloud Worker Allocated', body: 'Profile US Amazon Seller Ops is active on us-east-1.', read: false, createdAt: new Date(Date.now() - 600000).toISOString() },
    { id: 'notif_2', userId: 'usr_owner_01', category: 'AUTOMATION', title: 'Workflow Succeeded', body: 'Daily Amazon Seller Check completed with 0 errors.', read: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
    { id: 'notif_3', userId: 'usr_owner_01', category: 'SECURITY', title: 'New Android Device Registered', body: 'Pixel 8 Pro signed in to central account.', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  ]);

  const [notificationPrefs, setNotificationPrefs] = useState<MobileNotificationPreferences>({
    userId: 'usr_owner_01',
    securityAlerts: true,
    cloudSessions: true,
    automationAlerts: true,
    workspaceAlerts: true,
    proxyAlerts: true,
    updatedAt: new Date().toISOString(),
  });


  // Restore authenticated session and check biometric lock on launch
  useEffect(() => {
    let mounted = true;
    MobileSecureStorage.getTokens()
      .then((existingTokens) => {
        if (mounted && existingTokens?.accessToken && existingTokens?.email) {
          setIsAuthenticated(true);
          setCurrentUserEmail(existingTokens.email);
        }
      })
      .catch(() => {});

    const isBioActive = MobileSecureStorage.isBiometricLockActive();
    setBiometricEnabled(isBioActive);
    if (isBioActive) {
      setIsBiometricLocked(true);
    }

    // Network status listener
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUnlockBiometric = () => {
    const res = BiometricAuthService.authenticate();
    if (res.success) {
      setIsBiometricLocked(false);
    }
  };

  const handleLaunchCloud = (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    setActiveCloudSession({
      sessionId: `cloud_sess_${Date.now()}`,
      profileId: profileId,
      profileName: target?.name || profileId,
    });
    setActiveTab('cloud');
  };

  const handleEndCloudSession = async (sessionId: string) => {
    // Release session and sync profile back
    setActiveCloudSession(null);
    setActiveTab('profiles');
  };

  const handleCreateProfile = (name: string, os: 'windows' | 'macos' | 'linux' | 'android') => {
    const newP: MobileProfileItem = {
      id: `prof_mob_${Date.now()}`,
      name,
      os,
      browserVersion: '124.0.6367.60',
      syncState: 'PENDING',
      cloudVersion: 1,
      lastSyncedAt: new Date().toISOString(),
      isLocked: false,
    };
    setProfiles((prev) => [newP, ...prev]);
    MobileOfflineCache.setCachedProfiles([newP, ...profiles]);
  };

  const handleDeleteProfile = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const handleToggleBiometricLock = (enabled: boolean) => {
    setBiometricEnabled(enabled);
    MobileSecureStorage.setBiometricLockActive(enabled);
  };

  const handleRevokeDevice = (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  const handleLogout = () => {
    MobileSecureStorage.clearTokens();
    setIsAuthenticated(false);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setAuthError('Please enter both email and password.');
      return;
    }
    // Simulate real central auth verification & secure storage save
    MobileSecureStorage.saveTokens({
      accessToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mobile_acc_${Date.now()}`,
      refreshToken: `refresh_token_mobile_keystore_${Date.now()}`,
      userId: 'usr_owner_01',
      email: loginEmail,
      storedAt: new Date().toISOString(),
    });
    setIsAuthenticated(true);
    setCurrentUserEmail(loginEmail);
    setAuthError('');
  };


  // Render Login View if not authenticated
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0F172A',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            background: '#1E293B',
            borderRadius: 16,
            padding: 24,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 32 }}>🌐</div>
            <h1 style={{ margin: '8px 0 4px 0', fontSize: 20, fontWeight: 700 }}>MAHI Browser</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>
              Android Mobile Companion Login
            </p>
          </div>

          {authError && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                color: '#EF4444',
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Email Address
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="user@example.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: 8,
                padding: '12px',
                background: '#6366F1',
                color: '#FFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign In to Central Account
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#64748B' }}>
            Protected by Android KeyStore & Hardware-backed Keystore AES-256
          </div>
        </div>
      </div>
    );
  }

  // Render Biometric Lock Overlay if locked
  if (isBiometricLocked) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0F172A',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              border: '2px solid rgba(99, 102, 241, 0.4)',
            }}
          >
            🔒
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#F8FAFC' }}>MAHI Browser Locked</h2>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#94A3B8' }}>
              Authenticate with Biometrics (Fingerprint / Face)
            </p>
          </div>
          <button
            onClick={handleUnlockBiometric}
            style={{
              padding: '10px 24px',
              background: '#6366F1',
              color: '#FFF',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Unlock with Biometrics
          </button>
        </div>
      </div>
    );
  }

  const unreadNotifs = notifications.filter((n) => !n.read).length;


  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100vh',
        background: '#0F172A',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
      }}
    >
      {/* Top App Header */}
      <header
        style={{
          background: '#1E293B',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌐</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#F8FAFC' }}>MAHI</span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818CF8',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            MOBILE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Offline Pill */}
          {isOffline && (
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: '#EF4444',
                color: '#FFF',
                fontWeight: 700,
              }}
            >
              OFFLINE
            </span>
          )}

          {/* Active Workspace Pill */}
          <span
            onClick={() => setActiveTab('workspaces')}
            style={{
              fontSize: 11,
              color: '#94A3B8',
              background: '#0F172A',
              padding: '4px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            🏢 {workspaces.find((w) => w.id === activeWorkspaceId)?.name.slice(0, 12)}...
          </span>

          {/* Notifications Bell */}
          <div
            onClick={() => setShowNotificationsDrawer(true)}
            style={{ position: 'relative', cursor: 'pointer', padding: 4 }}
          >
            <span style={{ fontSize: 16 }}>🔔</span>
            {unreadNotifs > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: '#EF4444',
                  color: '#FFF',
                  borderRadius: '50%',
                  width: 14,
                  height: 14,
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadNotifs}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: 14, paddingBottom: 76, overflowY: 'auto' }}>
        {activeTab === 'home' && (
          <MobileHomeTab
            onNavigateTab={(tab) => setActiveTab(tab)}
            onLaunchCloudProfile={handleLaunchCloud}
            isOffline={isOffline}
          />
        )}
        {activeTab === 'profiles' && (
          <MobileProfilesTab
            profiles={profiles}
            onLaunchCloudProfile={handleLaunchCloud}
            onCreateProfile={handleCreateProfile}
            onDeleteProfile={handleDeleteProfile}
            isOffline={isOffline}
          />
        )}
        {activeTab === 'cloud' && (
          <MobileCloudViewer
            sessionId={activeCloudSession?.sessionId}
            profileId={activeCloudSession?.profileId}
            profileName={activeCloudSession?.profileName}
            onEndSession={handleEndCloudSession}
            onSendInput={(sessId, payload) => {
              // Remote input dispatching via WebSocket
            }}
            onNavigateUrl={(sessId, url) => {
              // Remote navigation
            }}
          />
        )}
        {activeTab === 'workspaces' && (
          <MobileWorkspacesTab
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={(wsId) => setActiveWorkspaceId(wsId)}
            onInviteMember={(wsId, email, role) => {
              // Member invitation via RBAC API
            }}
            onRemoveMember={(wsId, memId) => {
              // Member removal via RBAC API
            }}
            isOffline={isOffline}
          />
        )}
        {activeTab === 'proxies' && (
          <MobileProxiesTab
            proxies={proxies}
            onGenerateProxy={(country, type) => {
              const newPrx: MobileProxyItem = {
                id: `prx_gen_${Date.now()}`,
                type: 'BUILTIN',
                host: '198.51.100.155',
                port: 8080,
                country,
                protocol: 'HTTP',
                assignedProfileCount: 0,
                dataUsageBytes: 0,
                status: 'ONLINE',
              };
              setProxies((prev) => [newPrx, ...prev]);
            }}
            onRotateProxy={(prxId) => {
              // Proxy rotation
            }}
            isOffline={isOffline}
          />
        )}
        {activeTab === 'automation' && (
          <MobileAutomationTab
            runs={automationRuns}
            onStartWorkflow={(wfId, pId) => {
              const newRun: MobileWorkflowRunItem = {
                id: `run_${Date.now()}`,
                name: 'Custom Workflow Run',
                profileName: 'US Amazon Seller Ops',
                status: 'RUNNING',
                startedAt: new Date().toISOString(),
                durationSec: 1,
                stepsCount: 5,
              };
              setAutomationRuns((prev) => [newRun, ...prev]);
            }}
            onStopWorkflow={(runId) => {
              setAutomationRuns((prev) =>
                prev.map((r) => (r.id === runId ? { ...r, status: 'STOPPED' } : r))
              );
            }}
            onStartCookieWarmer={(pId, tmpl) => {
              // Remote cookie warmer allocation
            }}
            isOffline={isOffline}
          />
        )}
        {activeTab === 'account' && (
          <MobileAccountTab
            userEmail={currentUserEmail || 'Not Signed In'}
            planName="STANDARD"
            cloudHoursUsed={0}
            cloudHoursLimit={10}
            devices={devices}
            notificationPrefs={notificationPrefs}
            biometricLockEnabled={biometricEnabled}
            onToggleBiometricLock={handleToggleBiometricLock}
            onUpdateNotificationPrefs={(prefs) =>
              setNotificationPrefs((prev) => ({ ...prev, ...prefs }))
            }
            onRevokeDevice={handleRevokeDevice}
            onLogout={handleLogout}
            isOffline={isOffline}
          />
        )}
      </main>

      {/* Notifications Drawer */}
      {showNotificationsDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 999,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: '#1E293B',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: 16,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#F8FAFC' }}>
                Push Notifications
              </h3>
              <button
                onClick={() => setShowNotificationsDrawer(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: notif.read ? 'rgba(15, 23, 42, 0.4)' : 'rgba(99, 102, 241, 0.1)',
                    border: notif.read ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(99, 102, 241, 0.3)',
                  }}

                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>{notif.title}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{notif.body}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 6 }}>
                    {new Date(notif.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Mobile Tab Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          background: '#1E293B',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '6px 0',
          zIndex: 50,
        }}
      >
        {[
          { tab: 'home' as MobileTab, label: 'Home', icon: '🏠' },
          { tab: 'profiles' as MobileTab, label: 'Profiles', icon: '👤' },
          { tab: 'cloud' as MobileTab, label: 'Cloud', icon: '☁️' },
          { tab: 'workspaces' as MobileTab, label: 'Teams', icon: '🏢' },
          { tab: 'proxies' as MobileTab, label: 'Proxies', icon: '🌐' },
          { tab: 'automation' as MobileTab, label: 'Auto', icon: '⚡' },
          { tab: 'account' as MobileTab, label: 'Account', icon: '⚙️' },
        ].map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                color: isActive ? '#818CF8' : '#94A3B8',
                padding: '4px 6px',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
