import type React from 'react';
import { useState } from 'react';

export interface MobileProxyItem {
  id: string;
  type: 'BUILTIN' | 'CUSTOM';
  host: string;
  port: number;
  country: string;
  protocol: 'HTTP' | 'SOCKS5';
  assignedProfileCount: number;
  dataUsageBytes: number;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
}

interface MobileProxiesTabProps {
  proxies: MobileProxyItem[];
  onGenerateProxy: (country: string, type: string) => void;
  onRotateProxy: (proxyId: string) => void;
  isOffline: boolean;
}

export const MobileProxiesTab: React.FC<MobileProxiesTabProps> = ({
  proxies,
  onGenerateProxy,
  onRotateProxy,
  isOffline,
}) => {
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [selectedType, setSelectedType] = useState('RESIDENTIAL');

  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'DE', name: 'Germany' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'JP', name: 'Japan' },
    { code: 'FR', name: 'France' },
    { code: 'SG', name: 'Singapore' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Generate Built-in Proxy Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#F8FAFC' }}>
            Built-in Proxy Platform (Phase 5)
          </h3>
          <span style={{ fontSize: 11, color: '#38BDF8', fontWeight: 600 }}>0.8 GB / 5 GB</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label htmlFor="mobile-proxy-country" style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
              Country
            </label>
            <select
              id="mobile-proxy-country"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#FFF',
                fontSize: 12,
              }}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mobile-proxy-type" style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 4 }}>
              Pool Type
            </label>
            <select
              id="mobile-proxy-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#FFF',
                fontSize: 12,
              }}
            >
              <option value="RESIDENTIAL">Residential (Sticky)</option>
              <option value="DATACENTER">Datacenter (High Speed)</option>
              <option value="MOBILE">Mobile 4G/5G</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onGenerateProxy(selectedCountry, selectedType)}
          disabled={isOffline}
          style={{
            padding: '10px 14px',
            background: '#6366F1',
            color: '#FFF',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: isOffline ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>⚡</span> Generate New Session Proxy
        </button>
      </div>

      {/* Proxy List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h4 style={{ margin: 0, fontSize: 14, color: '#94A3B8' }}>
          Active Assigned Proxies ({proxies.length})
        </h4>

        {proxies.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>🌍</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>
                  {p.country} • {p.protocol}://{p.host}:{p.port}
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: p.status === 'ONLINE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: p.status === 'ONLINE' ? '#34D399' : '#EF4444',
                }}
              >
                {p.status}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94A3B8' }}>
              <span>Assigned Profiles: {p.assignedProfileCount}</span>
              <span>Data Used: {(p.dataUsageBytes / (1024 * 1024)).toFixed(1)} MB</span>
              <button
                type="button"
                onClick={() => onRotateProxy(p.id)}
                disabled={isOffline}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#818CF8',
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: isOffline ? 'not-allowed' : 'pointer',
                }}
              >
                🔄 Rotate IP
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
