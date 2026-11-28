import type React from 'react';
import { useState } from 'react';
import { Activity, Search, RefreshCw, Key, Webhook, Globe2, Layers } from 'lucide-react';

export interface WebAuditItem {
  id: string;
  eventType: string;
  actor: string;
  targetResource: string;
  workspaceId?: string;
  status: 'SUCCESS' | 'FAILURE' | 'DENIED';
  timestamp: string;
  summary: string;
}

interface AuditPageProps {
  logs: WebAuditItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const AuditPage: React.FC<AuditPageProps> = ({ logs, isLoading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetResource.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getEventIcon = (type: string) => {
    if (type.includes('key')) return <Key className="w-3.5 h-3.5 text-amber-400" />;
    if (type.includes('webhook')) return <Webhook className="w-3.5 h-3.5 text-purple-400" />;
    if (type.includes('workspace') || type.includes('member')) return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
    if (type.includes('profile')) return <Globe2 className="w-3.5 h-3.5 text-teal-400" />;
    return <Activity className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Security & Operational Audit Activity</h2>
          <p className="text-xs text-slate-400">
            Immutable log of sensitive actions, authentication events, and team modifications
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-4 bg-[#0c1222] border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit trail by actor, event, or keyword..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-[11px] text-slate-400 shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500/50"
          >
            <option value="ALL">All Events</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILURE">Failures</option>
            <option value="DENIED">RBAC Denials</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Activity className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-200">No Audit Events Logged</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Security activity such as logins, profile updates, member invitations, and proxy requests will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Summary</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2 font-mono text-[11px] font-semibold text-slate-200">
                        {getEventIcon(log.eventType)}
                        <span>{log.eventType}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {log.actor}
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      {log.summary}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : log.status === 'DENIED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
