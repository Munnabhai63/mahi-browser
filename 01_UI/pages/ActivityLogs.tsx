import type React from 'react';
import { useEffect, useState } from 'react';
import {
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useLogStore } from '../stores/useLogStore.js';
import type { LogCategory, LogSeverity } from '../../10_CONFIG/shared/types/logs.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import type { NavigationPage } from '../components/Sidebar.js';

interface ActivityLogsProps {
  onNavigate: (page: NavigationPage) => void;
}

export const ActivityLogsPage: React.FC<ActivityLogsProps> = ({ onNavigate: _onNavigate }) => {
  const { logs, fetchLogs, clearLogs, filter, setFilter } = useLogStore();
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const severityIcon = (sev: LogSeverity) => {
    switch (sev) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'ERROR':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-teal-500 shrink-0" />;
    }
  };

  const getCategoryBadgeClass = (category: LogCategory | string) => {
    switch (category) {
      case 'SYSTEM':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20';
      case 'PROFILE':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
      case 'PROXY':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20';
      case 'SECURITY':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
  };

  return (
    <div className="p-8 space-y-5 max-w-7xl mx-auto h-full flex flex-col justify-between overflow-y-auto custom-scrollbar font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Activity & Audit Logs</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Tamper-Proof Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time security and operational telemetry across browser profiles and proxies
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 shadow-xs"
            title="Refresh Activity Logs"
          >
            <RefreshCw className={`w-4 h-4 text-teal-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={logs.length === 0}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors active:scale-95 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filter.searchQuery || ''}
              onChange={(e) => setFilter({ searchQuery: e.target.value })}
              placeholder="Search action or details..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 shadow-xs"
            />
          </div>

          <select
            value={filter.category || ''}
            onChange={(e) => setFilter({ category: (e.target.value as LogCategory) || undefined })}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 shadow-xs font-medium"
          >
            <option value="">All Categories</option>
            <option value="PROFILE">Profiles</option>
            <option value="PROXY">Proxies</option>
            <option value="EXTENSION">Extensions</option>
            <option value="COOKIE">Cookies</option>
            <option value="AUTOMATION">Automation</option>
            <option value="SECURITY">Security</option>
            <option value="SYSTEM">System</option>
          </select>

          <select
            value={filter.severity || ''}
            onChange={(e) => setFilter({ severity: (e.target.value as LogSeverity) || undefined })}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500 shadow-xs font-medium"
          >
            <option value="">All Severities</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
          </select>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 self-start sm:self-auto">
          {logs.length} entries recorded
        </span>
      </div>

      {/* Logs Table */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex-1 flex flex-col items-center justify-center">
            <Activity className="w-8 h-8 text-slate-400 mb-2 stroke-[1.5]" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Activity Recorded</h4>
            <p className="text-xs text-slate-400 mt-0.5">Audit entries will automatically populate as profiles and proxies are operated.</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/60 sticky top-0 z-10 select-none">
                  <th className="py-3 px-4 font-normal">Timestamp</th>
                  <th className="py-3 px-4 font-normal">Category</th>
                  <th className="py-3 px-4 font-normal">Action</th>
                  <th className="py-3 px-4 font-normal">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()} • {new Date(log.timestamp).toLocaleDateString()}
                    </td>

                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold ${getCategoryBadgeClass(log.category)}`}>
                        {log.category}
                      </span>
                    </td>

                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-100">
                        {severityIcon(log.severity)}
                        <span>{log.action}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center space-x-2">
                        <span className="truncate max-w-xl">{log.details}</span>
                        {log.profileName && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-semibold">
                            {log.profileName}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear Logs Confirm */}
      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="Clear Activity Logs"
        message="Are you sure you want to purge all activity logs? Historical security and audit entries will be deleted permanently."
        confirmLabel="Clear Logs"
        isDestructive
        onConfirm={async () => {
          await clearLogs();
          setIsClearConfirmOpen(false);
        }}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
