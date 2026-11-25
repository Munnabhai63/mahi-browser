import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Lock,
  Cpu,
  Terminal,
  KeyRound,
  Copy,
  CheckCircle2,
  Save,
  Globe2,
  DownloadCloud,
  RefreshCw,
  AlertCircle,
  HardDrive,
  Trash2,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { AppSettings } from '../../10_CONFIG/shared/types/settings.js';
import { UpdateConfig, UpdateStatusEvent } from '../../10_CONFIG/shared/types/updater.js';
import { ProfileCacheCleanupResult } from '../../10_CONFIG/shared/types/ipc.js';
import { NavigationPage } from '../components/Sidebar.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import { CONTACT_CONFIG } from '../../10_CONFIG/contact-config.js';

interface AppSettingsPageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const AppSettingsPage: React.FC<AppSettingsPageProps> = ({ onNavigate }) => {
  const { settings, fetchSettings, updateSettings, theme, setTheme } = useSettingsStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'security' | 'performance' | 'api' | 'updates'>('general');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig>({
    channel: 'STABLE',
    autoCheck: true,
    autoDownload: true,
    notifyBeforeRestart: true,
  });
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusEvent | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [appVersion, setAppVersion] = useState<string>(APP_VERSION);
  const [engineStatus, setEngineStatus] = useState<{ installed: boolean; version: string } | null>(null);
  const [isRepairingEngine, setIsRepairingEngine] = useState(false);

  // Browser Cache Maintenance state
  const [cacheReport, setCacheReport] = useState<ProfileCacheCleanupResult | null>(null);
  const [isScanningCache, setIsScanningCache] = useState(false);
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [showCleanConfirm, setShowCleanConfirm] = useState(false);

  // App Lock PIN setup state
  const [newPin, setNewPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => {
    fetchSettings();
    if (window.mahiAPI?.getAppVersion) {
      window.mahiAPI.getAppVersion().then((v) => {
        if (v) setAppVersion(v);
      }).catch(() => {});
    }
    if (window.mahiAPI?.getUpdateConfig) {
      window.mahiAPI.getUpdateConfig().then((cfg) => {
        if (cfg) setUpdateConfig(cfg);
      });
    }
    if (window.mahiAPI?.getUpdateStatus) {
      window.mahiAPI.getUpdateStatus().then((st) => {
        if (st) setUpdateStatus(st);
      });
    }
    if (window.mahiAPI?.getManagedEngineStatus) {
      window.mahiAPI.getManagedEngineStatus().then((s) => {
        setEngineStatus({ installed: s.installed, version: s.version });
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    setFormData(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(formData);
    if (window.mahiAPI?.setUpdateConfig) {
      await window.mahiAPI.setUpdateConfig(updateConfig);
    }
    showToast({ type: 'success', title: 'Settings Saved', message: 'Preferences updated successfully.' });
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      if (window.mahiAPI?.checkForUpdates) {
        const res = await window.mahiAPI.checkForUpdates(updateConfig.channel);
        setUpdateStatus(res);
        if (res.state === 'NOT_AVAILABLE') {
          showToast({ type: 'info', title: 'Up to Date', message: 'You are running the latest version.' });
        } else if (res.state === 'AVAILABLE') {
          showToast({ type: 'success', title: 'Update Available', message: `Version v${res.availableVersion} is available.` });
        } else if (res.state === 'ERROR') {
          showToast({ type: 'error', title: 'Update Notice', message: res.error || 'Update check encountered an issue.' });
        }
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Update Check Error', message: err.message });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) {
      setPinMessage('PIN must be at least 4 digits');
      return;
    }

    try {
      await window.mahiAPI.setAppPin(newPin, oldPin || undefined);
      setPinMessage('PIN updated successfully!');
      setNewPin('');
      setOldPin('');
      showToast({ type: 'success', title: 'Security PIN Updated', message: 'Application lock PIN is now active.' });
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPinMessage(msg);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(formData.advanced.apiAuthToken);
    showToast({ type: 'info', title: 'Token Copied', message: 'API Bearer token copied to clipboard.' });
  };

  const handleRepairEngine = async () => {
    setIsRepairingEngine(true);
    try {
      if (window.mahiAPI?.repairManagedEngine) {
        const result = await window.mahiAPI.repairManagedEngine();
        if (result.success) {
          showToast({ type: 'success', title: 'Browser Engine Repaired', message: 'Engine is healthy and ready to use.' });
          setEngineStatus((prev) => prev ? { ...prev, installed: true } : prev);
        } else {
          showToast({ type: 'error', title: 'Repair Failed', message: result.error || 'Could not repair the browser engine. Please reinstall MAHI Browser.' });
        }
      }
    } catch (err: any) {
      showToast({ type: 'error', title: 'Repair Error', message: err.message || 'Unexpected error during engine repair.' });
    } finally {
      setIsRepairingEngine(false);
    }
  };

  const handleScanCache = async () => {
    setIsScanningCache(true);
    setShowCleanConfirm(false);
    try {
      if (window.mahiAPI?.previewProfileCacheCleanup) {
        const res = await window.mahiAPI.previewProfileCacheCleanup();
        setCacheReport(res);
        showToast({
          type: 'info',
          title: 'Cache Scan Complete',
          message: `Found ${res.cacheFoldersMatched} cache folder(s) (${res.mbReclaimable.toLocaleString()} MB reclaimable).`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Cache Scan Failed',
        message: err?.message || 'Could not scan profile caches.',
      });
    } finally {
      setIsScanningCache(false);
    }
  };

  const handleApplyCacheCleanup = async () => {
    setIsCleaningCache(true);
    setShowCleanConfirm(false);
    try {
      if (window.mahiAPI?.applyProfileCacheCleanup) {
        const res = await window.mahiAPI.applyProfileCacheCleanup();
        setCacheReport(res);
        showToast({
          type: res.skippedLockedFolders > 0 ? 'warning' : 'success',
          title: 'Browser Caches Cleaned',
          message:
            res.skippedLockedFolders > 0
              ? `Freed ${res.mbReclaimable.toLocaleString()} MB (${res.deletedFolders} deleted, ${res.skippedLockedFolders} locked by open browsers).`
              : `Freed ${res.mbReclaimable.toLocaleString()} MB across ${res.deletedFolders} cache folder(s).`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Cache Cleanup Error',
        message: err?.message || 'Unexpected error during cache cleanup.',
      });
    } finally {
      setIsCleaningCache(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto h-full flex flex-col justify-between overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Application Settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure system-wide preferences, security PIN locks, and local REST API.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 active:scale-95 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Save Preferences</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {[
          { id: 'general', label: 'General' },
          { id: 'privacy', label: 'Privacy' },
          { id: 'security', label: 'Security & App Lock' },
          { id: 'performance', label: 'Performance' },
          { id: 'api', label: 'Local REST API' },
          { id: 'updates', label: 'Updates & Channel' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Settings Body */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[400px]">
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-5 max-w-2xl animate-in fade-in duration-150 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Interface Theme
              </label>
              <select
                value={formData.general.theme}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    general: { ...formData.general, theme: e.target.value as any },
                  });
                  setTheme(e.target.value as any);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="light">Light Mode (Default)</option>
                <option value="dark">Dark Mode</option>
                <option value="system">Follow System Theme</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Default Browser Engine
              </label>
              <select
                value={formData.general.defaultBrowserEngine}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    general: { ...formData.general, defaultBrowserEngine: e.target.value as any },
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="chrome">Google Chrome Engine</option>
                <option value="edge">Microsoft Edge Engine</option>
                <option value="chromium">Chromium Core Engine</option>
                <option value="camoufox">Camoufox (Patched Firefox)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Startup Action
              </label>
              <select
                value={formData.general.startupBehavior}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    general: { ...formData.general, startupBehavior: e.target.value as any },
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="dashboard">Open Workspace Dashboard</option>
                <option value="last_profiles">Restore Last Active Profiles</option>
                <option value="none">Open Profiles List</option>
              </select>
            </div>
          </div>
        )}

        {/* PRIVACY TAB */}
        {activeTab === 'privacy' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150 text-xs">
            <div className="space-y-3">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.privacy.clearDataOnExit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      privacy: { ...formData.privacy, clearDataOnExit: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Purge temporary cache files on application shutdown
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.privacy.doNotTrack}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      privacy: { ...formData.privacy, doNotTrack: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Send Do-Not-Track (DNT: 1) header by default
                </span>
              </label>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in duration-150 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400 font-bold">
                <Shield className="w-4 h-4" />
                <span>Encryption Standard</span>
              </div>
              <p className="text-slate-400">
                AES-256-GCM authenticated encryption with PBKDF2 (100,000 iterations) SHA-256 key derivation.
              </p>
            </div>

            {/* Set / Change PIN Form */}
            <form onSubmit={handleSetPin} className="space-y-4 p-5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Application Lock PIN
              </h4>

              {formData.security.appLockEnabled && (
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Current PIN
                  </label>
                  <input
                    type="password"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    placeholder="Enter current PIN..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {formData.security.appLockEnabled ? 'New PIN' : 'Set Application Lock PIN'}
                </label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Enter 4-12 digit PIN..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                />
              </div>

              {pinMessage && (
                <p className="text-teal-500 font-semibold">{pinMessage}</p>
              )}

              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-sm"
              >
                {formData.security.appLockEnabled ? 'Update PIN' : 'Enable & Set PIN'}
              </button>
            </form>
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Maximum Concurrent Active Browser Profiles
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={formData.performance.maxConcurrentProfiles}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    performance: { ...formData.performance, maxConcurrentProfiles: Number(e.target.value) },
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>

            {/* Engine Health */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">Browser Engine Health</span>
                  <span className="text-[11px] text-slate-400">
                    {engineStatus?.installed
                      ? <span className="text-emerald-500 font-medium">✓ Engine ready</span>
                      : <span className="text-amber-500 font-medium">⚠ Engine not detected</span>
                    }
                    {engineStatus?.version && (
                      <span className="ml-2 text-slate-400">· v{engineStatus.version}</span>
                    )}
                  </span>
                </div>
                <button
                  id="btn-repair-engine"
                  type="button"
                  disabled={isRepairingEngine}
                  onClick={handleRepairEngine}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-xl flex items-center gap-2 transition active:scale-95 disabled:opacity-50 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRepairingEngine ? 'animate-spin' : ''}`} />
                  {isRepairingEngine ? 'Repairing…' : 'Repair Engine'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                If profiles fail to launch, use Repair Engine to restore the browser engine. This may take a few minutes.
              </p>
            </div>

            {/* Browser Cache Maintenance */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <HardDrive className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-100 block">
                      Browser Cache Maintenance
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Reclaim disk space by pruning temporary Chromium shader, GPU, and HTTP caches.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-scan-cache"
                    type="button"
                    disabled={isScanningCache || isCleaningCache}
                    onClick={handleScanCache}
                    className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold rounded-xl flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningCache ? 'animate-spin' : ''}`} />
                    <span>{isScanningCache ? 'Scanning…' : 'Scan Cache Size'}</span>
                  </button>

                  {!showCleanConfirm && (
                    <button
                      id="btn-clean-cache"
                      type="button"
                      disabled={
                        isScanningCache ||
                        isCleaningCache ||
                        !cacheReport ||
                        !cacheReport.dryRun ||
                        cacheReport.bytesReclaimable <= 0
                      }
                      onClick={() => setShowCleanConfirm(true)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isCleaningCache ? 'Cleaning…' : 'Clean Browser Caches'}</span>
                    </button>
                  )}
                </div>
              </div>

              {showCleanConfirm && cacheReport && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-rose-400">
                    Delete {cacheReport.cacheFoldersMatched} temporary cache folder(s) ({cacheReport.mbReclaimable.toLocaleString()} MB)?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-confirm-clean-cache"
                      type="button"
                      disabled={isCleaningCache}
                      onClick={handleApplyCacheCleanup}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-[11px] transition active:scale-95"
                    >
                      Confirm Cleanup
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCleanConfirm(false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {cacheReport && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Cache Folders Found
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                      {cacheReport.cacheFoldersMatched.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Total Files Found
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                      {cacheReport.filesMatched.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      {cacheReport.dryRun ? 'Reclaimable Space' : 'Space Freed'}
                    </span>
                    <span className="font-mono font-bold text-sm text-teal-500">
                      {cacheReport.mbReclaimable.toLocaleString()} MB ({cacheReport.gbReclaimable} GB)
                    </span>
                  </div>
                </div>
              )}

              {cacheReport && !cacheReport.dryRun && cacheReport.skippedLockedFolders > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Skipped {cacheReport.skippedLockedFolders} locked cache folder(s) because their browser profiles are currently open.
                  </span>
                </div>
              )}

              {cacheReport && !cacheReport.dryRun && cacheReport.deletedFolders > 0 && cacheReport.skippedLockedFolders === 0 && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-[11px] text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Successfully deleted {cacheReport.deletedFolders} cache folder(s) and freed {cacheReport.mbReclaimable.toLocaleString()} MB.
                  </span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>
                  Saved logins, cookies, Local Storage, IndexedDB, preferences, and SQLite databases are never touched.
                </span>
              </p>
            </div>
          </div>
        )}

        {/* API TAB */}
        {activeTab === 'api' && (
          <div className="space-y-5 max-w-2xl animate-in fade-in duration-150 text-xs">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block">
                  Local REST API Server
                </span>
                <span className="text-slate-400 text-[11px]">
                  Allows external automation tools and scripts to control profiles.
                </span>
              </div>
              <span className="text-emerald-500 font-mono font-bold">
                http://127.0.0.1:{formData.advanced.apiPort}
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Bearer Authentication Token
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={formData.advanced.apiAuthToken}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-teal-600 dark:text-teal-400"
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-semibold flex items-center space-x-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Include header <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Authorization: Bearer [token]</code> in API requests.
              </p>
            </div>
          </div>
        )}

        {/* UPDATES & CHANNEL TAB */}
        {activeTab === 'updates' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in duration-150 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  MAHI BROWSER Client Updates
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Current Version: <span className="font-mono font-semibold text-teal-500">v{appVersion}</span> • By {CONTACT_CONFIG.APP_AUTHOR} (x64)
                </p>
              </div>

              <button
                type="button"
                disabled={isCheckingUpdate}
                onClick={handleCheckForUpdates}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                {isCheckingUpdate ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud size={14} />
                    <span>Check for Updates</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Status Display */}
            {updateStatus && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-start gap-3">
                <div className="mt-0.5">
                  {updateStatus.state === 'NOT_AVAILABLE' && <CheckCircle2 size={16} className="text-emerald-500" />}
                  {updateStatus.state === 'AVAILABLE' && <DownloadCloud size={16} className="text-teal-400" />}
                  {updateStatus.state === 'DOWNLOADING' && <RefreshCw size={16} className="animate-spin text-teal-400" />}
                  {updateStatus.state === 'DOWNLOADED' && <CheckCircle2 size={16} className="text-teal-400" />}
                  {updateStatus.state === 'ERROR' && <AlertCircle size={16} className="text-amber-500" />}
                  {updateStatus.state === 'CHECKING' && <RefreshCw size={16} className="animate-spin text-slate-400" />}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    {updateStatus.state === 'NOT_AVAILABLE' && 'Application is up to date'}
                    {updateStatus.state === 'AVAILABLE' && `New version v${updateStatus.availableVersion} is available`}
                    {updateStatus.state === 'DOWNLOADING' && `Downloading update package (${updateStatus.progress?.percent || 0}%)`}
                    {updateStatus.state === 'DOWNLOADED' && `Update v${updateStatus.availableVersion} verified and ready to install`}
                    {updateStatus.state === 'ERROR' && 'Update Check Notice'}
                    {updateStatus.state === 'CHECKING' && 'Checking updates server...'}
                  </div>
                  {updateStatus.releaseNotes && (
                    <div className="text-[11px] text-slate-400 mt-1 italic">
                      "{updateStatus.releaseNotes}"
                    </div>
                  )}
                  {updateStatus.error && (
                    <div className="text-[11px] text-amber-500 mt-0.5">
                      {updateStatus.error}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Channel Selection */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Release Channel
              </label>
              <select
                value={updateConfig.channel}
                onChange={(e) =>
                  setUpdateConfig({
                    ...updateConfig,
                    channel: e.target.value as 'STABLE' | 'BETA',
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium"
              >
                <option value="STABLE">STABLE — Production Releases (Recommended)</option>
                <option value="BETA">BETA — Early Access &amp; Preview Features</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Stable users receive thoroughly vetted production builds. Beta users receive preview builds before general availability.
              </p>
            </div>

            {/* Automation Preferences */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateConfig.autoCheck}
                  onChange={(e) =>
                    setUpdateConfig({ ...updateConfig, autoCheck: e.target.checked })
                  }
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 dark:border-slate-700 focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Automatically Check for Updates
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Checks asynchronously on startup and every 6 hours without interrupting your work.
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateConfig.autoDownload}
                  onChange={(e) =>
                    setUpdateConfig({ ...updateConfig, autoDownload: e.target.checked })
                  }
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 dark:border-slate-700 focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Automatically Download Updates
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Downloads verified packages in the background so you can restart when ready.
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateConfig.notifyBeforeRestart}
                  onChange={(e) =>
                    setUpdateConfig({ ...updateConfig, notifyBeforeRestart: e.target.checked })
                  }
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 dark:border-slate-700 focus:ring-teal-500"
                />
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Notify Before Restart
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Always prompt before applying updates to protect active browser profiles and open tabs.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
