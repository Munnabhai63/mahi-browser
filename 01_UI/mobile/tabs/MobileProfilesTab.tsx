import React, { useState } from 'react';

export interface MobileProfileItem {
  id: string;
  name: string;
  os: 'windows' | 'macos' | 'linux' | 'android';
  browserVersion: string;
  proxy?: string;
  syncState: 'SYNCED' | 'PENDING' | 'CONFLICT' | 'LOCKED' | 'FAILED';
  cloudVersion: number;
  lastSyncedAt: string;
  isLocked: boolean;
  notes?: string;
}

interface MobileProfilesTabProps {
  profiles: MobileProfileItem[];
  onLaunchCloudProfile: (profileId: string) => void;
  onCreateProfile: (name: string, os: 'windows' | 'macos' | 'linux' | 'android') => void;
  onDeleteProfile: (profileId: string) => void;
  isOffline: boolean;
}

export const MobileProfilesTab: React.FC<MobileProfilesTabProps> = ({
  profiles,
  onLaunchCloudProfile,
  onCreateProfile,
  onDeleteProfile,
  isOffline,
}) => {
  const [search, setSearch] = useState('');
  const [filterOS, setFilterOS] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOS, setNewOS] = useState<'windows' | 'macos' | 'linux' | 'android'>('windows');

  const filtered = profiles.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
    const matchesOS = filterOS === 'all' || p.os === filterOS;
    return matchesSearch && matchesOS;
  });

  const getSyncColor = (state: MobileProfileItem['syncState']) => {
    switch (state) {
      case 'SYNCED':
        return '#10B981';
      case 'PENDING':
        return '#F59E0B';
      case 'CONFLICT':
        return '#EF4444';
      case 'LOCKED':
        return '#6366F1';
      case 'FAILED':
        return '#EF4444';
      default:
        return '#94A3B8';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Search & Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Search profiles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 10,
            color: '#F8FAFC',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 16px',
            background: '#6366F1',
            color: '#FFF',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>+</span> New
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {['all', 'windows', 'macos', 'linux', 'android'].map((os) => (
          <button
            key={os}
            onClick={() => setFilterOS(os)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: filterOS === os ? '1px solid #6366F1' : '1px solid rgba(255, 255, 255, 0.08)',
              background: filterOS === os ? 'rgba(99, 102, 241, 0.2)' : '#1E293B',
              color: filterOS === os ? '#818CF8' : '#94A3B8',
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'capitalize',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {os}
          </button>
        ))}
      </div>

      {/* Profile Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 30,
              textAlign: 'center',
              background: '#1E293B',
              borderRadius: 12,
              color: '#94A3B8',
              fontSize: 13,
            }}
          >
            No profiles found.
          </div>
        ) : (
          filtered.map((profile) => (
            <div
              key={profile.id}
              style={{
                background: '#1E293B',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#F8FAFC' }}>
                      {profile.name}
                    </span>
                    {profile.isLocked && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#F87171',
                          fontWeight: 600,
                        }}
                      >
                        LOCKED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    ID: {profile.id} • OS: {profile.os.toUpperCase()} • Chromium {profile.browserVersion}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: `${getSyncColor(profile.syncState)}15`,
                    color: getSyncColor(profile.syncState),
                    border: `1px solid ${getSyncColor(profile.syncState)}40`,
                  }}
                >
                  {profile.syncState} (v{profile.cloudVersion})
                </span>
              </div>

              {/* Proxy Info */}
              <div
                style={{
                  fontSize: 12,
                  color: profile.proxy ? '#E2E8F0' : '#64748B',
                  background: 'rgba(15, 23, 42, 0.5)',
                  padding: '6px 10px',
                  borderRadius: 8,
                }}
              >
                🌐 Proxy: {profile.proxy || 'Direct Connection (No Proxy)'}
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: '#64748B' }}>
                  Synced: {new Date(profile.lastSyncedAt).toLocaleTimeString()}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onDeleteProfile(profile.id)}
                    style={{
                      padding: '6px 10px',
                      background: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      borderRadius: 8,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => onLaunchCloudProfile(profile.id)}
                    disabled={isOffline || profile.isLocked}
                    style={{
                      padding: '6px 14px',
                      background: profile.isLocked ? '#475569' : '#6366F1',
                      border: 'none',
                      color: '#FFF',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isOffline || profile.isLocked ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>☁️</span> Run in Cloud
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: 20,
              width: '100%',
              maxWidth: 360,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: '#F8FAFC' }}>Create Mobile Profile</h3>
            <div>
              <label style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Profile Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Amazon Ads Mobile"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
                Operating System
              </label>
              <select
                value={newOS}
                onChange={(e) => setNewOS(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#FFF',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              >
                <option value="windows">Windows 11</option>
                <option value="macos">macOS Sonoma</option>
                <option value="linux">Linux Ubuntu</option>
                <option value="android">Android 14</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94A3B8',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newName.trim()) {
                    onCreateProfile(newName.trim(), newOS);
                    setNewName('');
                    setShowCreateModal(false);
                  }
                }}
                disabled={!newName.trim()}
                style={{
                  padding: '8px 16px',
                  background: '#6366F1',
                  border: 'none',
                  color: '#FFF',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: !newName.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
