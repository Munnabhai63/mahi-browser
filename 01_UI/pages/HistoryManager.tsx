import type React from 'react';
import { useState, useEffect } from 'react';
import {
  ScrollText,
  Search,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import type { HistoryItem } from '../../10_CONFIG/shared/types/history.js';
import { useToastStore } from '../stores/useToastStore.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import type { NavigationPage } from '../components/Sidebar.js';

interface HistoryManagerProps {
  onNavigate: (page: NavigationPage) => void;
}

export const HistoryManagerPage: React.FC<HistoryManagerProps> = ({ onNavigate: _onNavigate }) => {
  const { profiles, selectedProfileId, setSelectedProfileId } = useProfileStore();
  const { showToast } = useToastStore();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [_loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'visitTime' | 'visitCount' | 'title' | 'domain'>('visitTime');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const activeProfileId = selectedProfileId || (profiles[0]?.id ?? '');

  const loadHistory = async () => {
    if (!activeProfileId) return;
    setLoading(true);
    try {
      if (window.mahiAPI) {
        const res = await window.mahiAPI.getHistory({
          profileId: activeProfileId,
          searchQuery,
          sortBy,
          sortDirection: 'desc',
        });
        setHistory(res);
      }
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Failed to load history',
        message: err instanceof Error ? err.message : 'Could not retrieve browsing records.',
      });
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadHistory is a stable async loader, intentional mount-only call
  useEffect(() => {
    void loadHistory();
  }, []);

  const handleDeleteOne = async (id: string) => {
    if (!activeProfileId) return;
    try {
      await window.mahiAPI.deleteHistoryItem(activeProfileId, id);
      showToast({ type: 'info', title: 'History Deleted', message: 'Record removed.' });
      loadHistory();
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Delete Failed', message: err instanceof Error ? err.message : 'Could not delete record.' });
    }
  };

  const handleClearAll = async () => {
    if (!activeProfileId) return;
    try {
      await window.mahiAPI.clearHistory(activeProfileId);
      showToast({ type: 'info', title: 'History Purged', message: 'All browsing history removed.' });
      setIsClearConfirmOpen(false);
      loadHistory();
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Purge Failed', message: err instanceof Error ? err.message : 'Could not purge history.' });
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col justify-between overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">History Manager</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search, sort, and manage isolated navigation history for this profile.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={activeProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 shadow-xs"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                👤 {p.name} ({p.folder})
              </option>
            ))}
          </select>

          <button type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={history.length === 0}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-500 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Filter and Sort Bar */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search visited URLs or page titles..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'visitTime' | 'visitCount' | 'title' | 'domain')}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-500"
        >
          <option value="visitTime">Sort: Most Recent</option>
          <option value="visitCount">Sort: Visit Count</option>
          <option value="domain">Sort: By Domain</option>
          <option value="title">Sort: By Title</option>
        </select>

        <span className="text-xs text-slate-400">{history.length} records</span>
      </div>

      {/* History Table */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {history.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No History Records</h4>
            <p className="text-xs text-slate-400 mt-0.5">Start the profile to browse websites and populate history.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
                <th className="py-3 px-5">Page Title & URL</th>
                <th className="py-3 px-4">Visits</th>
                <th className="py-3 px-4">Last Visited</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-5">
                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-md">
                      {h.title}
                    </div>
                    <div className="font-mono text-[11px] text-teal-600 dark:text-teal-400 truncate max-w-md">
                      {h.url}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-500 font-semibold">{h.visitCount}</td>

                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(h.lastVisitTime).toLocaleString()}
                  </td>

                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-slate-400 hover:text-teal-500 rounded"
                        title="Open URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button type="button"
                        onClick={() => handleDeleteOne(h.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clear Confirmation */}
      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="Clear Browsing History"
        message="Are you sure you want to clear all browsing history for this profile? This action cannot be undone."
        confirmLabel="Clear All"
        isDestructive
        onConfirm={handleClearAll}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
