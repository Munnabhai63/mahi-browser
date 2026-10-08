import React, { useState } from 'react';

export interface MobileWorkflowRunItem {
  id: string;
  name: string;
  profileName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  startedAt: string;
  durationSec: number;
  stepsCount: number;
}

interface MobileAutomationTabProps {
  runs: MobileWorkflowRunItem[];
  onStartWorkflow: (workflowId: string, profileId: string) => void;
  onStopWorkflow: (runId: string) => void;
  onStartCookieWarmer: (profileId: string, template: string) => void;
  isOffline: boolean;
}

export const MobileAutomationTab: React.FC<MobileAutomationTabProps> = ({
  runs,
  onStartWorkflow,
  onStopWorkflow,
  onStartCookieWarmer,
  isOffline,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'workflows' | 'cookieWarmer'>('workflows');
  const [selectedWarmTemplate, setSelectedWarmTemplate] = useState('ECOMMERCE_USA');

  const getStatusBadge = (status: MobileWorkflowRunItem['status']) => {
    switch (status) {
      case 'COMPLETED':
        return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'RUNNING':
        return { color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
      case 'FAILED':
        return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'STOPPED':
        return { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' };
      default:
        return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sub tabs: Workflows vs Cookie Warmer */}
      <div style={{ display: 'flex', background: '#1E293B', borderRadius: 10, padding: 4 }}>
        <button
          onClick={() => setActiveSubTab('workflows')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 8,
            background: activeSubTab === 'workflows' ? '#6366F1' : 'transparent',
            color: activeSubTab === 'workflows' ? '#FFF' : '#94A3B8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Automations (Phase 8)
        </button>
        <button
          onClick={() => setActiveSubTab('cookieWarmer')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: 8,
            background: activeSubTab === 'cookieWarmer' ? '#6366F1' : 'transparent',
            color: activeSubTab === 'cookieWarmer' ? '#FFF' : '#94A3B8',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cookie Warmer
        </button>
      </div>

      {activeSubTab === 'workflows' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 14, color: '#F8FAFC' }}>
              Recent Execution Runs ({runs.length})
            </h4>
            <button
              onClick={() => onStartWorkflow('wf_daily_login_check', 'prof_us_ecommerce_01')}
              disabled={isOffline}
              style={{
                padding: '6px 12px',
                background: '#6366F1',
                color: '#FFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: isOffline ? 'not-allowed' : 'pointer',
              }}
            >
              + Run Workflow
            </button>
          </div>

          {runs.map((r) => {
            const badge = getStatusBadge(r.status);
            return (
              <div
                key={r.id}
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>
                    {r.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {r.status}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  Target: {r.profileName} • {r.stepsCount} Steps • Duration: {r.durationSec}s
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: '#64748B' }}>
                    Started: {new Date(r.startedAt).toLocaleTimeString()}
                  </span>
                  {r.status === 'RUNNING' && (
                    <button
                      onClick={() => onStopWorkflow(r.id)}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#EF4444',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Stop Run
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Cookie Warmer Control Panel */
        <div
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#F8FAFC' }}>
              Cloud & Desktop Cookie Warmer
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#94A3B8' }}>
              Warms browser fingerprint & seed browsing history on remote worker.
            </p>
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 6 }}>
              Warming Profile Template
            </label>
            <select
              value={selectedWarmTemplate}
              onChange={(e) => setSelectedWarmTemplate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#FFF',
                fontSize: 13,
              }}
            >
              <option value="ECOMMERCE_USA">E-Commerce USA (Amazon, eBay, Walmart, Target)</option>
              <option value="SOCIAL_MEDIA">Social Media (Twitter, Reddit, Pinterest, LinkedIn)</option>
              <option value="GENERAL_SEARCH">General Search Engine (Google, Bing, Yahoo)</option>
            </select>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontSize: 11,
              color: '#A5B4FC',
            }}
          >
            ℹ️ Execution runs securely on Phase 10 cloud browser worker. No headless load on Android battery.
          </div>

          <button
            onClick={() => onStartCookieWarmer('prof_us_ecommerce_01', selectedWarmTemplate)}
            disabled={isOffline}
            style={{
              padding: '12px',
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
            <span>🍪</span> Start Remote Cookie Warmer
          </button>
        </div>
      )}
    </div>
  );
};
