import type React from 'react';
import { useState } from 'react';
import type { MobileNotificationPreferences } from '../../../10_CONFIG/shared/types/mobile';

export interface MobileDeviceSessionItem {
  id: string;
  platform: 'windows' | 'macos' | 'linux' | 'android';
  deviceName: string;
  appVersion: string;
  ip: string;
  lastSeen: string;
  isCurrent: boolean;
}

interface MobileAccountTabProps {
  userEmail: string;
  planName: string;
  cloudHoursUsed: number;
  cloudHoursLimit: number;
  devices: MobileDeviceSessionItem[];
  notificationPrefs: MobileNotificationPreferences;
  biometricLockEnabled: boolean;
  onToggleBiometricLock: (enabled: boolean) => void;
  onUpdateNotificationPrefs: (prefs: Partial<MobileNotificationPreferences>) => void;
  onRevokeDevice: (deviceId: string) => void;
  onLogout: () => void;
  isOffline: boolean;
}

export const MobileAccountTab: React.FC<MobileAccountTabProps> = ({
  userEmail,
  planName,
  cloudHoursUsed,
  cloudHoursLimit,
  devices,
  notificationPrefs,
  biometricLockEnabled,
  onToggleBiometricLock,
  onUpdateNotificationPrefs,
  onRevokeDevice,
  onLogout,
  isOffline,
}) => {
  const [sessionPrivacySecure, setSessionPrivacySecure] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Account Info Card */}
      <div
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>{userEmail}</div>
            <div style={{ fontSize: 12, color: '#10B981', marginTop: 2 }}>✓ Verified Central Account</div>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818CF8',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {planName}
          </span>
        </div>

        {/* Quota Bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
            <span>Cloud Browser Hours</span>
            <span>{cloudHoursUsed} / {cloudHoursLimit} hrs</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, (cloudHoursUsed / cloudHoursLimit) * 100)}%`,
                height: '100%',
                background: '#6366F1',
              }}
            />
          </div>
        </div>
      </div>

      {/* Security & Mobile Protection */}
      <div
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h4 style={{ margin: 0, fontSize: 14, color: '#F8FAFC' }}>Mobile Security</h4>

        {/* Biometric Lock Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>
              Biometric App Lock
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              Require Fingerprint or Face ID when opening MAHI
            </div>
          </div>
          <input
            type="checkbox"
            checked={biometricLockEnabled}
            onChange={(e) => onToggleBiometricLock(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#6366F1', cursor: 'pointer' }}
          />
        </div>

        {/* Session Privacy (FLAG_SECURE) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>
              Android Session Privacy (FLAG_SECURE)
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              Block screen capture & hide preview in Android recent apps
            </div>
          </div>
          <input
            type="checkbox"
            checked={sessionPrivacySecure}
            onChange={(e) => setSessionPrivacySecure(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#6366F1', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Notification Preferences */}
      <div
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <h4 style={{ margin: 0, fontSize: 14, color: '#F8FAFC' }}>Push Notification Categories</h4>
        {[
          { key: 'securityAlerts' as const, label: 'Security Alerts (New login, password change)' },
          { key: 'cloudSessions' as const, label: 'Cloud Browser Sessions (Started, ended)' },
          { key: 'automationAlerts' as const, label: 'Automation Alerts (Workflow completed, failed)' },
          { key: 'workspaceAlerts' as const, label: 'Workspace Invitations & Access' },
          { key: 'proxyAlerts' as const, label: 'Proxy Health & Rotation' },
        ].map((item) => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#CBD5E1' }}>{item.label}</span>
            <input
              type="checkbox"
              checked={notificationPrefs[item.key] ?? true}
              onChange={(e) =>
                onUpdateNotificationPrefs({ [item.key]: e.target.checked })
              }
              style={{ width: 16, height: 16, accentColor: '#6366F1', cursor: 'pointer' }}
            />
          </div>
        ))}

      </div>

      {/* Connected MAHI Devices */}
      <div
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <h4 style={{ margin: 0, fontSize: 14, color: '#F8FAFC' }}>
          Authorized Devices ({devices.length})
        </h4>

        {devices.map((dev) => (
          <div
            key={dev.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>
                  {dev.deviceName}
                </span>
                {dev.isCurrent && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#10B981', color: '#FFF' }}>
                    THIS ANDROID
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                {dev.platform.toUpperCase()} • v{dev.appVersion} • Last seen {new Date(dev.lastSeen).toLocaleTimeString()}
              </div>
            </div>

            {!dev.isCurrent && (
              <button
                type="button"
                onClick={() => onRevokeDevice(dev.id)}
                disabled={isOffline}
                style={{
                  padding: '4px 8px',
                  background: 'none',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#EF4444',
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: isOffline ? 'not-allowed' : 'pointer',
                }}
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Logout Action */}
      <button
        type="button"
        onClick={onLogout}
        style={{
          padding: '12px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#EF4444',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 6,
        }}
      >
        Sign Out from Android
      </button>
    </div>
  );
};
