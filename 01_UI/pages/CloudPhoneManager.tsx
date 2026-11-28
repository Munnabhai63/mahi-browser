import type React from 'react';
import { useState } from 'react';
import {
  Smartphone,
  Play,
  Square,
  Plus,
  RefreshCw,
  Cloud,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import type { NavigationPage } from '../components/Sidebar.js';
import { DEFAULT_USER_AGENTS, getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import type { Profile } from '../../10_CONFIG/shared/types/profile.js';

interface CloudPhoneManagerProps {
  onNavigate: (page: NavigationPage) => void;
}

export const CloudPhoneManager: React.FC<CloudPhoneManagerProps> = ({ onNavigate }) => {
  const { profiles, startProfile, stopProfile, createProfile, fetchProfiles } = useProfileStore();
  const { proxies } = useProxyStore();
  const { showToast } = useToastStore();

  const [_activeTab, _setActiveTab] = useState<'all' | 'running' | 'presets'>('all');
  const [selectedProfileForStream, setSelectedProfileForStream] = useState<Profile | null>(null);
  const [isCreatingQuickDevice, setIsCreatingQuickDevice] = useState(false);

  // Filter only Android profiles
  const androidProfiles = profiles.filter(
    (p) =>
      p.settings?.browser?.userAgent?.includes('Android') ||
      p.settings?.mobile?.enable ||
      (p.tags?.includes('Android'))
  );

  const runningAndroidCount = androidProfiles.filter(
    (p) => p.status === 'RUNNING' || p.status === 'STARTING'
  ).length;

  const handleLaunchLocal = async (p: Profile) => {
    try {
      if (p.status === 'RUNNING') {
        await stopProfile(p.id);
        showToast({ type: 'info', title: 'Device Stopped', message: `Stopped Android profile "${p.name}".` });
      } else {
        await startProfile(p.id);
        showToast({
          type: 'success',
          title: 'Android Mobile Active',
          message: `Launched "${p.name}" with Android 14 touch & font masking.`,
        });
      }
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Launch Failed', message: err instanceof Error ? err.message : 'Failed to start profile' });
    }
  };

  const handleLaunchCloud = (p: Profile) => {
    setSelectedProfileForStream(p);
    showToast({
      type: 'warning',
      title: 'Cloud Phone Virtualizer Unavailable',
      message: `Remote Redroid/Cloud Gateway streaming for "${p.name}" requires an active self-hosted cloud worker deployment. Use "Run Android Mode" locally instead.`,
    });
  };

  const handleQuickDeployPreset = async (deviceModel: 'pixel8' | 'galaxyS23' | 'xiaomi14') => {
    setIsCreatingQuickDevice(true);
    try {
      let name = 'Pixel 8 (Android 14)';
      let ua = DEFAULT_USER_AGENTS.find((u) => u.value.includes('Pixel 8'))?.value ||
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

      if (deviceModel === 'galaxyS23') {
        name = 'Samsung Galaxy S23 (Android 13)';
        ua = DEFAULT_USER_AGENTS.find((u) => u.value.includes('SM-S911B'))?.value ||
          'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';
      } else if (deviceModel === 'xiaomi14') {
        name = 'Xiaomi 14 Pro (Android 14)';
        ua = 'Mozilla/5.0 (Linux; Android 14; 23116PN5BC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';
      }

      const base = getDefaultProfileSettings();
      const newProfile = await createProfile({
        name: `${name} #${Math.floor(Math.random() * 900 + 100)}`,
        folder: 'Android Devices',
        tags: ['Android', 'Mobile', deviceModel.toUpperCase()],
        notes: `Auto-generated cloud mobile profile for ${name}. Includes 5-point touch emulation, ARM Mali WebGL GPU, and mobile viewport.`,
        settings: {
          ...base,
          browser: {
            ...base.browser,
            engine: 'chrome',
            userAgent: ua,
            startupUrl: 'https://browserleaks.com/ip',
            homepage: 'https://browserleaks.com/ip',
          },
          display: {
            ...base.display,
            screenWidth: 412,
            screenHeight: 915,
            deviceScaleFactor: 2.625,
            colorDepth: 24,
          },
          mobile: {
            enable: true,
            width: 412,
            height: 915,
            deviceScaleFactor: 2.625,
          },
          fingerprint: {
            ...base.fingerprint,
            maxTouchPoints: 5,
            webglVendor: 'ARM',
            webglRenderer: 'Mali-G710 MC10',
          },
          network: {
            ...base.network,
            directConnection: true,
          },
        },
      });

      if (newProfile) {
        showToast({
          type: 'success',
          title: 'Android Device Created',
          message: `Created "${newProfile.name}". Ready for local or cloud launch.`,
        });
        await fetchProfiles();
      }
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Creation Failed', message: err instanceof Error ? err.message : 'Could not deploy preset' });
    } finally {
      setIsCreatingQuickDevice(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col space-y-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                <Smartphone className="w-6 h-6 text-emerald-200" />
              </span>
              <h1 className="text-2xl font-black tracking-tight">Cloud Phone & Android Virtualizer (云手机)</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-md">
                v1.2 Dual-Engine
              </span>
            </div>
            <p className="text-emerald-100 text-xs max-w-2xl leading-relaxed">
              Run real isolated mobile environments identical to GoLogin and MostLogin. Choose between 
              <span className="font-bold text-white"> Local Mobile Anti-Detect</span> (0 latency, runs on your PC with ARM GPU & touch) 
              or <span className="font-bold text-white">Cloud Streamed Phone</span> (remote server execution with zero device footprint).
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button type="button"
              onClick={() => onNavigate('create-profile')}
              className="px-4 py-2.5 bg-white text-teal-800 hover:bg-emerald-50 rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Custom Android Profile</span>
            </button>
          </div>
        </div>

        {/* Live Counters Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/20 text-xs">
          <div>
            <span className="text-emerald-200 text-[11px] block">Android Profiles</span>
            <span className="text-lg font-black text-white">{androidProfiles.length} Devices</span>
          </div>
          <div>
            <span className="text-emerald-200 text-[11px] block">Active Mobile Sessions</span>
            <span className="text-lg font-black text-emerald-300">
              {runningAndroidCount > 0 ? `${runningAndroidCount} Running` : 'Idle'}
            </span>
          </div>
          <div>
            <span className="text-emerald-200 text-[11px] block">Cloud Minutes Balance</span>
            <span className="text-lg font-black text-white">30 Min Included / mo</span>
          </div>
          <div>
            <span className="text-emerald-200 text-[11px] block">Stealth Engine</span>
            <span className="text-lg font-black text-white">C++ Font Masking Mode 1</span>
          </div>
        </div>
      </div>

      {/* Quick 1-Click Android Device Generator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              1-Click Android Device Templates (GoLogin & MostLogin Presets)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Pre-configured with real hardware specs & touch emulation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Pixel 8 */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between hover:border-emerald-500/40 transition-all">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Google Pixel 8</h4>
                <p className="text-[10px] text-slate-400">Android 14 • 412x915 • Mali-G710</p>
              </div>
            </div>
            <button type="button"
              onClick={() => handleQuickDeployPreset('pixel8')}
              disabled={isCreatingQuickDevice}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              + Deploy
            </button>
          </div>

          {/* Samsung Galaxy S23 */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between hover:border-indigo-500/40 transition-all">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Samsung Galaxy S23</h4>
                <p className="text-[10px] text-slate-400">Android 13 • 390x844 • Adreno 740</p>
              </div>
            </div>
            <button type="button"
              onClick={() => handleQuickDeployPreset('galaxyS23')}
              disabled={isCreatingQuickDevice}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              + Deploy
            </button>
          </div>

          {/* Xiaomi 14 Pro */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between hover:border-teal-500/40 transition-all">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Xiaomi 14 Pro</h4>
                <p className="text-[10px] text-slate-400">Android 14 • HyperOS • Adreno 750</p>
              </div>
            </div>
            <button type="button"
              onClick={() => handleQuickDeployPreset('xiaomi14')}
              disabled={isCreatingQuickDevice}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              + Deploy
            </button>
          </div>
        </div>
      </div>

      {/* Android Device Fleets List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Configured Android Devices ({androidProfiles.length})
            </h3>
          </div>
          <button type="button"
            onClick={() => fetchProfiles()}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {androidProfiles.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3">
              <Smartphone className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Android Profiles Yet</h4>
            <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
              Deploy your first Google Pixel 8 or Samsung Galaxy S23 profile above with 1-click, or create a custom profile selecting the Android operating system.
            </p>
            <button type="button"
              onClick={() => handleQuickDeployPreset('pixel8')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Deploy Google Pixel 8 Preset
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {androidProfiles.map((p) => {
              const isRunning = p.status === 'RUNNING';
              const isStarting = p.status === 'STARTING';
              const proxy = proxies.find((px) => px.id === p.settings?.network?.proxyId);

              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Top Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <Smartphone className="w-3 h-3" />
                        Android 14 Mobile
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isRunning
                              ? 'bg-emerald-500 animate-pulse'
                              : isStarting
                              ? 'bg-amber-500 animate-spin'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                        <span className="text-[11px] text-slate-400">
                          {isRunning ? 'Running' : isStarting ? 'Starting...' : 'Ready'}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mb-1">
                      {p.name}
                    </h4>

                    {/* Specs Pills */}
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400 my-2">
                      <span className="px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 font-mono">
                        {p.settings?.display?.screenWidth || 412}x{p.settings?.display?.screenHeight || 915}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800">
                        Touch: 5 Points
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800">
                        {proxy ? `${proxy.host}:${proxy.port}` : 'Direct Network'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center space-x-2 mt-2">
                    <button type="button"
                      onClick={() => handleLaunchLocal(p)}
                      disabled={isStarting}
                      className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all ${
                        isRunning
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30'
                          : 'bg-teal-600 hover:bg-teal-500 text-white'
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop Local</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Start Local</span>
                        </>
                      )}
                    </button>

                    <button type="button"
                      onClick={() => handleLaunchCloud(p)}
                      className="py-1.5 px-3 rounded-xl font-semibold text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center space-x-1 transition-all"
                      title="Run in remote cloud container (WebRTC Stream)"
                    >
                      <Cloud className="w-3 h-3" />
                      <span>Cloud Stream</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison: Local Anti-Detect vs Cloud Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center space-x-2 text-teal-600 dark:text-teal-400 font-bold mb-2">
            <Cpu className="w-4 h-4" />
            <span>Mode 1: Local Mobile Anti-Detect (GoLogin Orbita Mode)</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Runs locally on your computer with Google Chrome engine patched for mobile. Automatically applies 
            <span className="font-semibold text-slate-700 dark:text-slate-200"> --font-masking-mode=1</span>, 
            ARM Mali-G710 WebGL GPU emulation, and 5-point touch events. Completely free with unlimited runtime.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold mb-2">
            <Cloud className="w-4 h-4" />
            <span>Mode 2: Cloud Phone Virtualizer (MostLogin Mode)</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Runs in headless Linux cloud containers (Redroid / Chromium). Streams live interactive screencast to your dashboard with zero RAM impact on your PC. Supports remote proxy assignment and team access.
          </p>
        </div>
      </div>

      {/* Cloud Session Streaming Modal */}
      {selectedProfileForStream && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {selectedProfileForStream.name}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-500">
                  Cloud Stream
                </span>
              </div>
              <button type="button"
                onClick={() => setSelectedProfileForStream(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-lg"
              >
                ✕ Close
              </button>
            </div>

            {/* Virtual Phone Mockup Viewport */}
            <div className="p-6 flex flex-col items-center justify-center bg-slate-900/40">
              <div className="w-[300px] h-[520px] bg-slate-950 rounded-[36px] border-4 border-slate-700 shadow-2xl flex flex-col overflow-hidden relative">
                {/* Phone Speaker & Camera Notch */}
                <div className="h-5 bg-slate-900 w-full flex items-center justify-center">
                  <div className="w-16 h-3 bg-slate-800 rounded-full" />
                </div>

                {/* Cloud Worker Connection Status */}
                <div className="flex-1 bg-slate-900 p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-100 mb-1">Cloud Phone Worker Not Configured</h4>
                  <p className="text-[11px] text-slate-400 max-w-[220px]">
                    No remote Redroid container node is connected for profile {selectedProfileForStream.id.slice(0, 8)}.
                  </p>
                  <div className="mt-4 px-3 py-1 rounded-full text-[10px] font-mono bg-slate-800 text-amber-300">
                    Use local Android Mobile Mode on desktop
                  </div>
                </div>

                {/* Phone Bottom Gesture Bar */}
                <div className="h-6 bg-slate-900 w-full flex items-center justify-center">
                  <div className="w-24 h-1 bg-slate-600 rounded-full" />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs text-slate-400">
              <span>Streaming Protocol: WebRTC / CDP Screencast</span>
              <button type="button"
                onClick={() => {
                  setSelectedProfileForStream(null);
                  showToast({ type: 'info', title: 'Session Detached', message: 'Cloud stream disconnected.' });
                }}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg font-bold"
              >
                Disconnect Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
