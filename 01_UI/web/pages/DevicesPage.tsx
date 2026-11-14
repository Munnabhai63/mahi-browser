import React, { useState } from 'react';
import { Laptop, Smartphone, Monitor, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { APP_VERSION } from '../../../10_CONFIG/shared/version.js';

export interface WebDeviceSession {
  sessionId: string;
  deviceName: string;
  platform: 'windows' | 'macos' | 'linux' | 'mobile' | 'web';
  ipAddress?: string;
  isOnline: boolean;
  lastSeenAt: string;
  clientVersion?: string;
  isCurrent?: boolean;
}

interface DevicesPageProps {
  devices: WebDeviceSession[];
  isLoading: boolean;
  onRefresh: () => void;
  onRevokeSession: (sessionId: string) => Promise<void>;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({
  devices,
  isLoading,
  onRefresh,
  onRevokeSession,
}) => {
  const [revokingDevice, setRevokingDevice] = useState<WebDeviceSession | null>(null);
  const [isRevokingPending, setIsRevokingPending] = useState(false);

  const handleConfirmRevoke = async () => {
    if (!revokingDevice) return;
    setIsRevokingPending(true);
    try {
      await onRevokeSession(revokingDevice.sessionId);
      setRevokingDevice(null);
    } finally {
      setIsRevokingPending(false);
    }
  };

  const getDeviceIcon = (platform: string) => {
    switch (platform) {
      case 'windows':
      case 'macos':
      case 'linux':
        return <Laptop className="w-5 h-5 text-teal-400" />;
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-cyan-400" />;
      default:
        return <Monitor className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Connected Devices & Desktop Agents</h2>
          <p className="text-xs text-slate-400">
            Registered client instances capable of executing anti-detect browser profile runs
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh Devices"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Info Notice on Honest Execution */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-start space-x-3">
        <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white">Desktop Client Pairing Protocol</div>
          <p className="text-slate-400 leading-relaxed">
            When you initiate a profile run from this web dashboard, MAHI Cloud verifies that an online desktop agent is running and logged in with your account. Revoking a session immediately halts profile coordination for that client.
          </p>
        </div>
      </div>

      {/* Devices List Table */}
      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {devices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Laptop className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-200">No Desktop Devices Registered</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Install and sign into MAHI Browser desktop client on Windows to link your computer and enable remote profile launches.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Device & Client</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Agent Status</th>
                  <th className="py-3 px-4">Last Seen</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {devices.map((d) => (
                  <tr key={d.sessionId} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                          {getDeviceIcon(d.platform)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200 flex items-center space-x-2">
                            <span>{d.deviceName}</span>
                            {d.isCurrent && (
                              <span className="px-1.5 py-0.2 bg-teal-500/20 text-teal-300 text-[9px] rounded font-mono">
                                THIS BROWSER
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Client {d.clientVersion || `v${APP_VERSION}`} • {d.sessionId.substring(0, 12)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300 uppercase">
                      {d.platform}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          d.isOnline
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${d.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        <span>{d.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'Just now'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {!d.isCurrent && (
                        <button
                          type="button"
                          onClick={() => setRevokingDevice(d)}
                          className="px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs font-semibold flex items-center space-x-1 ml-auto"
                          title="Revoke session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {revokingDevice && (
        <ConfirmModal
          isOpen={true}
          title={`Revoke Session for "${revokingDevice.deviceName}"?`}
          message="This will force logout the desktop application on this device. The user will be required to sign in again to resume synchronization."
          confirmLabel="Revoke Session"
          confirmVariant="danger"
          isPending={isRevokingPending}
          onConfirm={handleConfirmRevoke}
          onCancel={() => setRevokingDevice(null)}
        />
      )}
    </div>
  );
};
