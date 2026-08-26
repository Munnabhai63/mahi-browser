import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  Monitor,
  Globe2,
  Shield,
  CheckCircle2,
  Copy,
  RefreshCw,
  Cpu,
  Layers,
} from 'lucide-react';
import {
  DEFAULT_USER_AGENTS,
  SCREEN_RESOLUTIONS,
  TIMEZONES,
  LANGUAGES,
  generateConsistentEnvironmentSettings,
  getDefaultProfileSettings,
} from '../../10_CONFIG/shared/constants/defaults.js';
import { ProfileSettings } from '../../10_CONFIG/shared/types/profile.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { NavigationPage } from '../components/Sidebar.js';

interface BrowserEnvironmentProps {
  onNavigate: (page: NavigationPage) => void;
}

export const BrowserEnvironmentPage: React.FC<BrowserEnvironmentProps> = ({ onNavigate }) => {
  const [config, setConfig] = useState<ProfileSettings>(getDefaultProfileSettings());
  const { profiles, createProfile } = useProfileStore();
  const { showToast } = useToastStore();

  const handleRandomize = () => {
    const fresh = generateConsistentEnvironmentSettings();
    setConfig(fresh);
    showToast({
      type: 'info',
      title: 'Consistency Matrix Generated',
      message: 'Generated consistent display, locale, platform, and UA parameters.',
    });
  };

  const handleCreateProfileWithEnv = async () => {
    const p = await createProfile({
      name: `Env Test (${config.locale.timezone.split('/')[1] || 'Profile'})`,
      folder: 'Environment Testing',
      tags: ['Testing', 'Simulated'],
      settings: config,
    });
    if (p) {
      onNavigate('profiles');
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto h-full flex flex-col justify-between overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Browser Environment Matrix</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure, inspect, and generate consistent browser test environments.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRandomize}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Test Consistency</span>
          </button>

          <button
            onClick={handleCreateProfileWithEnv}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Create Profile with this Env</span>
          </button>
        </div>
      </div>

      {/* Grid Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. BROWSER */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400">
            <Cpu className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Browser & Engine</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Engine</label>
              <select
                value={config.browser.engine}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    browser: { ...config.browser, engine: e.target.value as any },
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="chrome">Google Chrome Engine</option>
                <option value="edge">Microsoft Edge Engine</option>
                <option value="chromium">Chromium Engine</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">User Agent Preset</label>
              <select
                value={config.browser.userAgent}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    browser: { ...config.browser, userAgent: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              >
                {DEFAULT_USER_AGENTS.map((ua) => (
                  <option key={ua.value} value={ua.value}>
                    {ua.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. DISPLAY */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-indigo-500">
            <Monitor className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Display & Canvas</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Resolution Preset</label>
              <select
                value={`${config.display.screenWidth}x${config.display.screenHeight}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setConfig({
                    ...config,
                    display: { ...config.display, screenWidth: w, screenHeight: h },
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                {SCREEN_RESOLUTIONS.map((res) => (
                  <option key={`${res.width}x${res.height}`} value={`${res.width}x${res.height}`}>
                    {res.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Scale Factor</label>
              <select
                value={config.display.deviceScaleFactor}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    display: { ...config.display, deviceScaleFactor: Number(e.target.value) },
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value={1}>1.0x (Standard)</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x (HiDPI)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. LOCALE */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-emerald-500">
            <Globe2 className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Locale & Timezone</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Timezone</label>
              <select
                value={config.locale.timezone}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    locale: { ...config.locale, timezone: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Language</label>
              <select
                value={config.locale.language}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    locale: { ...config.locale, language: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4. NETWORK */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-amber-500">
            <Shield className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Network & WebRTC</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">WebRTC Policy</label>
              <select
                value={config.network.webrtc}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    network: { ...config.network, webrtc: e.target.value as any },
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="default">Default WebRTC</option>
                <option value="proxy_only">Proxy Only (Disable Non-Proxied UDP)</option>
                <option value="public_interface_only">Public Interface Only</option>
                <option value="disabled">Disable WebRTC</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5. PERMISSIONS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-rose-500">
            <Sliders className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Device Permissions</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Camera</label>
                <select
                  value={config.permissions.camera}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      permissions: { ...config.permissions, camera: e.target.value as any },
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="prompt">Prompt</option>
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Geolocation</label>
                <select
                  value={config.permissions.geolocation}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      permissions: { ...config.permissions, geolocation: e.target.value as any },
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <option value="prompt">Prompt</option>
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
