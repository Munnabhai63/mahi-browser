import type React from 'react';
import type { MobileTab } from '../../../10_CONFIG/shared/types/mobile';

interface MobileHomeTabProps {
  onNavigateTab: (tab: MobileTab) => void;
  onLaunchCloudProfile: (profileId: string) => void;
  isOffline: boolean;
}

export const MobileHomeTab: React.FC<MobileHomeTabProps> = ({
  onNavigateTab,
  onLaunchCloudProfile,
  isOffline,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Welcome & Cloud Quick Access */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(14, 165, 233, 0.15) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 16,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#F8FAFC' }}>
              MAHI Mobile Companion
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94A3B8' }}>
              Connected to Cloud Infrastructure (Phase 10 & 11)
            </p>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34D399',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            PRO ACTIVE
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => onNavigateTab('cloud')}
            disabled={isOffline}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: '#6366F1',
              color: '#FFF',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: isOffline ? 'not-allowed' : 'pointer',
              opacity: isOffline ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>☁️</span> Run in Cloud
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('profiles')}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'rgba(30, 41, 59, 0.8)',
              color: '#F8FAFC',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Manage Profiles
          </button>
        </div>
      </div>

      {/* Real Metric Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <button
          type="button"
          onClick={() => onNavigateTab('profiles')}
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
            padding: 14,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Total Profiles</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', marginTop: 4 }}>24</div>
          <div style={{ fontSize: 11, color: '#34D399', marginTop: 4 }}>✓ 24 Synced to Cloud</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('cloud')}
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
            padding: 14,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Active Cloud Workers</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#38BDF8', marginTop: 4 }}>1 / 5</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Worker us-east-1</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('proxies')}
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
            padding: 14,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Active Proxies</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', marginTop: 4 }}>12</div>
          <div style={{ fontSize: 11, color: '#34D399', marginTop: 4 }}>100% Healthy</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('automation')}
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
            padding: 14,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Automation Runs</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', marginTop: 4 }}>8</div>
          <div style={{ fontSize: 11, color: '#34D399', marginTop: 4 }}>7 Succeeded, 1 Running</div>
        </button>
      </div>

      {/* Fast Profile Launchers */}
      <div
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F8FAFC' }}>Recent Profiles</span>
          <button
            type="button"
            onClick={() => onNavigateTab('profiles')}
            style={{ background: 'transparent', border: 'none', padding: 0, fontSize: 12, color: '#6366F1', cursor: 'pointer', fontWeight: 500 }}
          >
            View all →
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { id: 'prof_us_ecommerce_01', name: 'US Amazon Seller Ops', os: 'Windows 11', proxy: 'US (Residential)' },
            { id: 'prof_fb_ads_mktg', name: 'Meta Ads Manager Pro', os: 'macOS Sonoma', proxy: 'DE (Datacenter)' },
            { id: 'prof_tiktok_creator', name: 'TikTok Creator UK', os: 'Android 14', proxy: 'GB (Residential)' },
          ].map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                  {item.os} • {item.proxy}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onLaunchCloudProfile(item.id)}
                disabled={isOffline}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#818CF8',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isOffline ? 'not-allowed' : 'pointer',
                }}
              >
                Run Cloud
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
