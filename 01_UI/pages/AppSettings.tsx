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
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { AppSettings } from '../../10_CONFIG/shared/types/settings.js';
import { NavigationPage } from '../components/Sidebar.js';

interface AppSettingsPageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const AppSettingsPage: React.FC<AppSettingsPageProps> = ({ onNavigate }) => {
  const { settings, fetchSettings, updateSettings, theme, setTheme } = useSettingsStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'security' | 'performance' | 'api'>('general');
  const [formData, setFormData] = useState<AppSettings>(settings);

  // App Lock PIN setup state
  const [newPin, setNewPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setFormData(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(formData);
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
      </div>
    </div>
  );
};
