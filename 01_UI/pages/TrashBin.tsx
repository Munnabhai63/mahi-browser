import type React from 'react';
import { useEffect, useState } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  Clock,
  Shield,
  Layers,
  ArrowLeft,
  Calendar,
  Folder,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import type { NavigationPage } from '../components/Sidebar.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import type { Profile } from '../../10_CONFIG/shared/types/profile.js';

interface TrashBinProps {
  onNavigate: (page: NavigationPage) => void;
}

export const TrashBin: React.FC<TrashBinProps> = ({ onNavigate }) => {
  const {
    trashProfiles,
    fetchTrashProfiles,
    restoreProfile,
    permanentDeleteProfile,
    emptyTrash,
  } = useProfileStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Profile | null>(null);
  const [isEmptyTrashModalOpen, setIsEmptyTrashModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchTrashProfiles();
  }, [fetchTrashProfiles]);

  const filteredTrash = trashProfiles.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.folder.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateDaysRemaining = (deletedAt?: string | null) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    const now = Date.now();
    const elapsedDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - elapsedDays);
  };


  const handleRestore = async (id: string) => {
    setIsProcessing(true);
    try {
      await restoreProfile(id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setIsProcessing(true);
    try {
      await permanentDeleteProfile(permanentDeleteTarget.id);
      setPermanentDeleteTarget(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      await emptyTrash();
      setIsEmptyTrashModalOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Top Header */}
      <div className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3.5">
          <button type="button"
            onClick={() => onNavigate('profiles')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Back to Profiles"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Trash Bin
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {trashProfiles.length} Profiles
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Recover deleted profiles within 30-day retention window
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {trashProfiles.length > 0 && (
            <button type="button"
              onClick={() => setIsEmptyTrashModalOpen(true)}
              disabled={isProcessing}
              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Trash</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
        {/* Search & Retention Notice */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deleted profiles..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 pr-2">
            <Shield className="w-3.5 h-3.5 text-teal-500" />
            <span>Cookies, caches & proxy settings preserved for 30 days</span>
          </div>
        </div>

        {/* Profiles Table or Empty State */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          {filteredTrash.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Trash Bin is Empty
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No deleted profiles found. All your browser profiles are active and secure.
              </p>
              <button type="button"
                onClick={() => onNavigate('profiles')}
                className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95"
              >
                Return to Profiles
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/60 sticky top-0 z-10 select-none">
                  <th className="py-3 px-4 font-normal">Profile Name</th>
                  <th className="py-3 px-4 font-normal">Folder</th>
                  <th className="py-3 px-4 font-normal">Proxy</th>
                  <th className="py-3 px-4 font-normal">Deleted Date</th>
                  <th className="py-3 px-4 font-normal">Retention</th>
                  <th className="py-3 px-4 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTrash.map((p) => {
                  const daysLeft = calculateDaysRemaining(p.deletedAt);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              ID: {p.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Folder & Tags */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                            <Folder className="w-2.5 h-2.5 text-slate-400" />
                            <span>{p.folder || 'General'}</span>
                          </span>
                          {p.tags && p.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {p.tags.slice(0, 2).map((t) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[9px] font-semibold"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Proxy */}
                      <td className="py-3 px-4">
                        {p.settings.network.proxyId ? (
                          <div className="flex items-center space-x-1 text-cyan-600 dark:text-cyan-400">
                            <Shield className="w-3.5 h-3.5" />
                            <span className="font-mono text-[11px]">Proxy Linked</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Direct</span>
                        )}
                      </td>

                      {/* Deleted At */}
                      <td className="py-3 px-4 text-slate-500">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {p.deletedAt
                              ? new Date(p.deletedAt).toLocaleDateString()
                              : 'Recently'}
                          </span>
                        </div>
                      </td>

                      {/* Auto-Purge Countdown */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {daysLeft} days remaining
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button type="button"
                            onClick={() => handleRestore(p.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl flex items-center space-x-1 shadow-sm active:scale-95 transition-all"
                            title="Restore this profile back to active list"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                          <button type="button"
                            onClick={() => setPermanentDeleteTarget(p)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 rounded-xl transition-all font-semibold"
                            title="Delete permanently from disk"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Single Permanent Delete Modal */}
      <ConfirmModal
        isOpen={permanentDeleteTarget !== null}
        title="Permanently Delete Profile"
        message={`Are you sure you want to permanently delete "${permanentDeleteTarget?.name}"? All cookies, local caches, and session history will be destroyed irreversibly.`}
        confirmLabel="Permanent Delete"
        isDestructive
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentDeleteTarget(null)}
      />

      {/* Empty Trash Modal */}
      <ConfirmModal
        isOpen={isEmptyTrashModalOpen}
        title="Empty Entire Trash Bin"
        message={`Are you sure you want to permanently delete all ${trashProfiles.length} profiles in the Trash Bin? This action cannot be undone.`}
        confirmLabel={`Purge All (${trashProfiles.length})`}
        isDestructive
        onConfirm={handleEmptyTrash}
        onCancel={() => setIsEmptyTrashModalOpen(false)}
      />
    </div>
  );
};
