import React, { useState } from 'react';
import {
  Shield,
  Globe,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { ProxySessionModal } from '../components/ProxySessionModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { ProxyUsageReport } from '../../../10_CONFIG/shared/types/proxy-provider.js';

export interface WebProxySession {
  sessionId: string;
  providerId: string;
  networkType: string;
  host: string;
  port: number;
  country: string;
  sessionType: 'STICKY' | 'ROTATING';
  expiresAt: string;
  assignedProfileId?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

interface ProxiesPageProps {
  sessions: WebProxySession[];
  usage: ProxyUsageReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  onGenerateSession: (dto: {
    networkType: string;
    country: string;
    sessionType: 'STICKY' | 'ROTATING';
    ttlMinutes?: number;
  }) => Promise<void>;
  onRotateSession: (sessionId: string) => Promise<void>;
  onRevokeSession: (sessionId: string) => Promise<void>;
}

export const ProxiesPage: React.FC<ProxiesPageProps> = ({
  sessions,
  usage,
  isLoading,
  onRefresh,
  onGenerateSession,
  onRotateSession,
  onRevokeSession,
}) => {
  const [activeTab, setActiveTab] = useState<'SESSIONS' | 'CATALOG'>('SESSIONS');
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revokingSession, setRevokingSession] = useState<WebProxySession | null>(null);
  const [isRevokingPending, setIsRevokingPending] = useState(false);

  const handleRotate = async (sessionId: string) => {
    setRotatingId(sessionId);
    try {
      await onRotateSession(sessionId);
    } finally {
      setRotatingId(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingSession) return;
    setIsRevokingPending(true);
    try {
      await onRevokeSession(revokingSession.sessionId);
      setRevokingSession(null);
    } finally {
      setIsRevokingPending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Commercial Proxy Platform</h2>
          <p className="text-xs text-slate-400">
            Provision residential, datacenter, and mobile IPs via central reference-based architecture
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh Sessions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsGenerateOpen(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Allocate Proxy</span>
          </button>
        </div>
      </div>

      {/* Usage & Platform Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#0c1222] border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] font-semibold text-slate-400">Active Proxy Sessions</span>
          <div className="text-2xl font-bold text-white font-mono">{sessions.length}</div>
          <div className="text-[10px] text-teal-400">Managed via Reference Tokens</div>
        </div>

        <div className="p-4 bg-[#0c1222] border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] font-semibold text-slate-400">Monthly Bandwidth Usage</span>
          <div className="text-2xl font-bold text-white font-mono">
            {usage?.bytesUsed ? `${(usage.bytesUsed / (1024 * 1024 * 1024)).toFixed(2)} GB` : '0.00 GB'}
          </div>
          <div className="text-[10px] text-emerald-400">Unlimited Quota on Pro Tier</div>
        </div>

        <div className="p-4 bg-[#0c1222] border border-slate-800 rounded-2xl space-y-1">
          <span className="text-[11px] font-semibold text-slate-400">Master Secret Security</span>
          <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1 pt-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Air-Gapped Zero-Leak Policy</span>
          </div>
          <div className="text-[10px] text-slate-400">Credentials kept on backend vault</div>
        </div>
      </div>

      {/* Tabs / Table Container */}
      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Sub Navigation */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('SESSIONS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'SESSIONS'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'CATALOG'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Built-In Catalog Information
          </button>
        </div>

        {activeTab === 'SESSIONS' ? (
          <div>
            {sessions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Shield className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-sm font-semibold text-slate-200">No Active Proxy Sessions</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Allocate dedicated or rotating residential IPs from the built-in catalog to assign to browser profiles.
                </p>
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(true)}
                  className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl"
                >
                  Allocate First Proxy
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Session Reference</th>
                      <th className="py-3 px-4">Country & Tier</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4">Gateway Endpoint</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sessions.map((s) => (
                      <tr key={s.sessionId} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-mono text-[11px] text-teal-300">
                          {s.sessionId}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-slate-200">{s.country}</span>
                            <span className="text-[10px] text-slate-400">({s.networkType})</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.sessionType === 'STICKY'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {s.sessionType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                          {s.host}:{s.port}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>{s.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleRotate(s.sessionId)}
                              disabled={rotatingId === s.sessionId}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors disabled:opacity-50"
                              title="Rotate IP immediately"
                            >
                              <RefreshCw className={`w-3 h-3 ${rotatingId === s.sessionId ? 'animate-spin' : ''}`} />
                              <span>Rotate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevokingSession(s)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                              title="Revoke Session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-200">Integrated Commercial Network Providers</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              MAHI Browser partners with enterprise proxy networks (Phase 5 Platform) to provide clean residential and mobile IPs with automated fingerprint consistency matching your OS and location.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="text-xs font-bold text-white">Residential Tunnels</div>
                <div className="text-[11px] text-slate-400">99.8% Trust Score, ISP-assigned genuine residential addresses.</div>
              </div>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="text-xs font-bold text-white">Mobile 4G/5G Cellular</div>
                <div className="text-[11px] text-slate-400">Clean carrier ASN IPs with periodic auto-rotation capability.</div>
              </div>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="text-xs font-bold text-white">Datacenter Premium</div>
                <div className="text-[11px] text-slate-400">Ultra-low latency 10Gbps dedicated routes for high-speed scraping.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProxySessionModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onSubmit={onGenerateSession}
      />

      {revokingSession && (
        <ConfirmModal
          isOpen={true}
          title={`Revoke Proxy Session "${revokingSession.sessionId}"?`}
          message="This proxy tunnel will be disconnected immediately and any profiles assigned to this session will revert to direct network connections."
          confirmLabel="Revoke Session"
          confirmVariant="danger"
          isPending={isRevokingPending}
          onConfirm={handleConfirmRevoke}
          onCancel={() => setRevokingSession(null)}
        />
      )}
    </div>
  );
};
