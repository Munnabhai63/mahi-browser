import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudRain,
  UploadCloud,
  DownloadCloud,
  Trash2,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToastStore } from '../stores/useToastStore.js';
import { useAccountStore } from '../stores/useAccountStore.js';
import { ConfirmModal } from './ConfirmModal.js';
import { NavigationPage } from './Sidebar.js';

interface CloudProfile {
  id: string;
  name: string;
  size: number;
  size_mb: number;
  updated_at: string;
}

interface CloudUsage {
  used_bytes: number;
  total_bytes: number;
  used_mb: number;
  total_mb: number;
  profile_count: number;
  quota_percent: number;
}

interface CloudSyncSectionProps {
  onNavigate: (page: NavigationPage) => void;
  onProfileRestored?: () => void;
}

export const CloudSyncSection: React.FC<CloudSyncSectionProps> = ({ onNavigate, onProfileRestored }) => {
  const { showToast } = useToastStore();
  const { openAccountModal } = useAccountStore();

  const [loading, setLoading] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [deniedReason, setDeniedReason] = useState<string>('');
  const [usage, setUsage] = useState<CloudUsage | null>(null);
  const [cloudProfiles, setCloudProfiles] = useState<CloudProfile[]>([]);
  const [autoSync, setAutoSync] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CloudProfile | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!window.mahiAPI?.getCloudSyncAllowed) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      const auth = await window.mahiAPI.getCloudSyncAllowed();
      setAllowed(auth.allowed);
      if (!auth.allowed) {
        setDeniedReason(auth.reason || 'MAHI PRO license required.');
        setLoading(false);
        return;
      }

      const [usageData, listData, cfg] = await Promise.all([
        window.mahiAPI.getCloudSyncUsage().catch(() => null),
        window.mahiAPI.getCloudSyncList().catch(() => []),
        window.mahiAPI.getCloudSyncConfig().catch(() => ({ autoSync: true, syncPassphrase: 'mahi-cloud-sync' }))
      ]);

      if (usageData) setUsage(usageData);
      setCloudProfiles(listData || []);
      if (cfg) {
        setAutoSync(cfg.autoSync !== false);
        setPassphrase(cfg.syncPassphrase || 'mahi-cloud-sync');
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Cloud Sync', message: err.message || 'Failed to connect to cloud service' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to sync progress events
    let cleanup: (() => void) | undefined;
    if (window.mahiAPI?.onSyncProgress) {
      cleanup = window.mahiAPI.onSyncProgress((ev: any) => {
        if (ev.stage === 'ERROR') {
          setProgressMsg(null);
          showToast({ type: 'error', title: 'Sync Error', message: ev.error || 'Sync failed' });
        } else if (ev.stage === 'COMPLETED') {
          setProgressMsg(null);
          showToast({ type: 'success', title: 'Sync Complete', message: ev.message || 'Success' });
          loadData();
        } else {
          setProgressMsg(ev.message || `${ev.stage} (${ev.percent}%)`);
        }
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const handleToggleAutoSync = async (enabled: boolean) => {
    setAutoSync(enabled);
    try {
      await window.mahiAPI.setCloudSyncConfig({ autoSync: enabled, syncPassphrase: passphrase });
      showToast({ type: 'success', title: 'Settings Saved', message: `Auto-sync is now ${enabled ? 'ENABLED' : 'DISABLED'}` });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Settings Error', message: err.message });
    }
  };

  const handleSavePassphrase = async () => {
    if (!passphrase.trim()) {
      showToast({ type: 'error', title: 'Passphrase Required', message: 'Encryption passphrase cannot be empty.' });
      return;
    }
    try {
      await window.mahiAPI.setCloudSyncConfig({ autoSync, syncPassphrase: passphrase.trim() });
      showToast({ type: 'success', title: 'Passphrase Updated', message: 'Encryption passphrase updated.' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Settings Error', message: err.message });
    }
  };

  const handleRestore = async (p: CloudProfile) => {
    setRestoringId(p.id);
    setProgressMsg(`Downloading & decrypting "${p.name}"...`);
    try {
      const restored = await window.mahiAPI.downloadAndRestoreProfile(p.id, {
        overrideName: `${p.name} (Restored)`,
        passphrase: passphrase.trim()
      });
      showToast({ type: 'success', title: 'Profile Restored', message: `Profile "${restored.name}" restored to this PC!` });
      if (onProfileRestored) onProfileRestored();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Restore Failed', message: err.message || 'Decryption or restore failed.' });
    } finally {
      setRestoringId(null);
      setProgressMsg(null);
    }
  };

  const handleDelete = (p: CloudProfile) => {
    setDeleteTarget(p);
  };

  const handleSyncAll = async () => {
    try {
      showToast({ type: 'info', title: 'Syncing', message: 'Enqueuing all profiles for cloud backup...' });
      await window.mahiAPI.syncAllProfiles();
      loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Sync All Failed', message: err.message });
    }
  };

  if (allowed === false) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl m-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
          Cloud Profile Sync is a MAHI PRO Feature
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
          {deniedReason || 'Upgrade to MAHI PRO to securely backup, synchronize, and restore your anti-detect browser profiles across multiple computers.'}
        </p>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => openAccountModal('PRO')}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/25 flex items-center space-x-2 transition"
          >
            <span>Upgrade to MAHI PRO</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Your local profiles remain 100% intact and unaffected.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-full">
      {/* Top Banner & Storage Quota */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                GoLogin-Style Encrypted Cloud Sync
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">
                  AES-256-GCM
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Encrypted profile backups stored securely on your cloud server. Browser caches are excluded to minimize storage.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSyncAll}
              disabled={loading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-600/20 flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Sync All Profiles</span>
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
              title="Refresh Cloud Storage"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quota Progress */}
        {usage && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                Storage Used: <strong className="text-slate-800 dark:text-slate-200">{usage.used_mb} MB</strong> / {usage.total_mb} MB (1 GB Limit)
              </span>
              <span className="font-bold text-teal-600 dark:text-teal-400">
                {usage.quota_percent}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usage.quota_percent > 85 ? 'bg-red-500' : usage.quota_percent > 65 ? 'bg-amber-500' : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(100, usage.quota_percent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
              <span>{usage.profile_count} Profile Backups on Cloud</span>
              <span>Max 200MB per profile</span>
            </div>
          </div>
        )}

        {/* Live Progress Indicator */}
        {progressMsg && (
          <div className="mt-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center space-x-2 text-xs text-teal-600 dark:text-teal-400 font-medium animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{progressMsg}</span>
          </div>
        )}
      </div>

      {/* Sync Configuration Options */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1.5">
            Auto-Sync on Profile Close / Save
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Automatically package, encrypt, and upload profile sessions when closing the browser window.
          </p>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => handleToggleAutoSync(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            <span className="ml-3 text-xs font-medium text-slate-700 dark:text-slate-300">
              {autoSync ? 'Auto-Sync Active (Recommended)' : 'Manual Sync Only'}
            </span>
          </label>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1.5">
            <Lock className="w-3.5 h-3.5 text-teal-500" />
            Zero-Knowledge Sync Passphrase
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Used to encrypt archives with AES-256-GCM. Set the same passphrase on your other PCs to restore backups.
          </p>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter sync passphrase..."
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={handleSavePassphrase}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Profiles Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Cloud className="w-4 h-4 text-teal-500" />
            Cloud Backups on Server
          </h4>
          <span className="text-xs text-slate-400 font-medium">
            {cloudProfiles.length} Profiles Available
          </span>
        </div>

        {cloudProfiles.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No cloud backups uploaded yet. Click <strong>Sync All Profiles</strong> above or sync individual profiles from the profiles list.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 bg-slate-50/50 dark:bg-slate-850/50 font-normal">
                <th className="py-3 px-6 font-normal">Profile Name</th>
                <th className="py-3 px-4 font-normal">Encrypted Size</th>
                <th className="py-3 px-4 font-normal">Last Synced (UTC)</th>
                <th className="py-3 px-4 font-normal">Encryption</th>
                <th className="py-3 px-6 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {cloudProfiles.map((p) => {
                const isRestoring = restoringId === p.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/40 transition">
                    <td className="py-3.5 px-6 font-semibold text-slate-800 dark:text-slate-100">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      {p.size_mb} MB
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(p.updated_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" />
                        AES-256-GCM
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          onClick={() => handleRestore(p)}
                          disabled={isRestoring}
                          className="px-3 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                          <DownloadCloud className={`w-3.5 h-3.5 ${isRestoring ? 'animate-bounce' : ''}`} />
                          <span>{isRestoring ? 'Restoring...' : 'Restore to this PC'}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Delete from Cloud"
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

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Cloud Backup"
        message={`Are you sure you want to delete "${deleteTarget?.name}" from Cloud storage? This cannot be undone.`}
        confirmLabel="Delete from Cloud"
        isDestructive={true}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleteTarget(null);
          try {
            await window.mahiAPI.deleteCloudProfile(target.id);
            showToast({ type: 'success', title: 'Deleted', message: `Profile "${target.name}" deleted from Cloud.` });
            loadData();
          } catch (err: any) {
            showToast({ type: 'error', title: 'Delete Failed', message: err.message });
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
