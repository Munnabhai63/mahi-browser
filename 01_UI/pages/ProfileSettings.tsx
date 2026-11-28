import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Sliders,
  Globe2,
  Save,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import type { NavigationPage } from '../components/Sidebar.js';
import {
  DEFAULT_USER_AGENTS,
  TIMEZONES,
  LANGUAGES,
} from '../../10_CONFIG/shared/constants/defaults.js';
import type { ProfileSettings as ProfileSettingsType } from '../../10_CONFIG/shared/types/profile.js';

interface ProfileSettingsProps {
  onNavigate: (page: NavigationPage) => void;
}

export const ProfileSettingsPage: React.FC<ProfileSettingsProps> = ({ onNavigate }) => {
  const { profiles, selectedProfileId, updateProfile } = useProfileStore();
  const { proxies, fetchProxies } = useProxyStore();

  const profile = profiles.find((p) => p.id === selectedProfileId) || profiles[0];

  const [activeTab, setActiveTab] = useState<
    'general' | 'browser' | 'privacy' | 'network' | 'permissions' | 'storage' | 'advanced'
  >('general');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [settings, setSettings] = useState<ProfileSettingsType | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description);
      setFolder(profile.folder);
      setNotes(profile.notes);
      setTags([...profile.tags]);
      setSettings(JSON.parse(JSON.stringify(profile.settings)));
      setIsDirty(false);
    }
  }, [profile?.id, profile.tags, profile.name, profile]);

  if (!profile || !settings) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">No profile selected.</p>
        <button type="button"
          onClick={() => onNavigate('profiles')}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold"
        >
          Back to Profiles
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    if (!profile || !settings) return;
    await updateProfile(profile.id, {
      name,
      description,
      folder,
      notes,
      tags,
      settings,
    });
    setIsDirty(false);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
    setIsDirty(true);
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto h-full flex flex-col justify-between overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button type="button"
            onClick={() => onNavigate('profiles')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.name}</h2>
              {isDirty && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">ID: {profile.id} • {profile.folder}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button type="button"
            onClick={handleSave}
            disabled={!isDirty}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {([
          { id: 'general', label: 'General' },
          { id: 'browser', label: 'Browser Engine' },
          { id: 'network', label: 'Network & Proxy' },
          { id: 'privacy', label: 'Display & Locale' },
          { id: 'permissions', label: 'Permissions' },
          { id: 'storage', label: 'Storage & Path' },
        ] as const).map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      {/* Tab Contents */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[400px]">
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150">
            <div>
              <label htmlFor="field-001" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Profile Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-002" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Folder Category
                </label>
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => {
                    setFolder(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="field-003" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="field-004" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tags
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Add tag..."
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-semibold flex items-center space-x-1"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      className="cursor-pointer hover:text-rose-500 ml-1"
                      onClick={() => handleRemoveTag(t)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="field-005" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* BROWSER TAB */}
        {activeTab === 'browser' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150">
            <div>
              <label htmlFor="field-006" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Browser Engine
              </label>
              <select
                value={settings.browser.engine}
                onChange={(e) => {
                  const newEngine = e.target.value as ProfileSettingsType['browser']['engine'];
                  const isCamoufox = newEngine === 'camoufox';
                  const currentUa = settings.browser.userAgent || '';
                  const isMobile = currentUa.includes('Android') || settings.mobile?.enable;
                  const isMac = currentUa.includes('Macintosh');
                  const isLinux = currentUa.includes('Linux') && !isMobile;
                  let newUa = currentUa;
                  if (isCamoufox && !newUa.includes('Firefox')) {
                    newUa = isMobile
                      ? 'Mozilla/5.0 (Android 14; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0'
                      : (isMac
                        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0'
                        : (isLinux
                          ? 'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0'
                          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'));
                  } else if (!isCamoufox && newUa.includes('Firefox')) {
                    newUa = isMobile
                      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
                      : (isMac
                        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
                        : (isLinux
                          ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
                          : (newEngine === 'edge'
                            ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'
                            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36')));
                  }
                  setSettings({
                    ...settings,
                    browser: { ...settings.browser, engine: newEngine, userAgent: newUa },
                  });
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="chromium">Chromium 138 (Stealth)</option>
                <option value="camoufox">Camoufox (Patched Firefox)</option>
                <option value="chrome">Google Chrome (Default)</option>
                <option value="edge">Microsoft Edge</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="field-007" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  User Agent String
                </label>
                <select
                  onChange={(e) => {
                    const uaVal = e.target.value;
                    if (!uaVal) return;
                    const isAndroid = uaVal.includes('Android') || uaVal.includes('Mobile');
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, userAgent: uaVal },
                      display: isAndroid
                        ? { ...settings.display, screenWidth: 412, screenHeight: 915, deviceScaleFactor: 2.625 }
                        : settings.display,
                      mobile: { enable: isAndroid },
                    });
                    setIsDirty(true);
                  }}
                  className="text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  <option value="">-- Load Preset (Android, Windows, Mac) --</option>
                  {DEFAULT_USER_AGENTS.map((ua) => (
                    <option key={ua.value} value={ua.value}>{ua.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                rows={2}
                value={settings.browser.userAgent}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    browser: { ...settings.browser, userAgent: e.target.value },
                  });
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-008" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Startup URL
                </label>
                <input
                  type="text"
                  value={settings.browser.startupUrl}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, startupUrl: e.target.value },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="field-009" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Homepage
                </label>
                <input
                  type="text"
                  value={settings.browser.homepage}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, homepage: e.target.value },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-6 text-xs text-slate-700 dark:text-slate-300">
              <label htmlFor="field-010" className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.browser.hardwareAcceleration}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, hardwareAcceleration: e.target.checked },
                    });
                    setIsDirty(true);
                  }}
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span>Hardware Acceleration</span>
              </label>

              <label htmlFor="field-011" className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.browser.enableExtensions}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, enableExtensions: e.target.checked },
                    });
                    setIsDirty(true);
                  }}
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span>Enable Extensions</span>
              </label>
            </div>
          </div>
        )}

        {/* NETWORK TAB */}
        {activeTab === 'network' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150">
            <div>
              <label htmlFor="field-012" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Proxy Routing
              </label>
              <select
                value={settings.network.directConnection ? 'direct' : settings.network.proxyId || 'none'}
                onChange={(e) => {
                  if (e.target.value === 'direct') {
                    setSettings({
                      ...settings,
                      network: { ...settings.network, directConnection: true, proxyId: undefined },
                    });
                  } else {
                    setSettings({
                      ...settings,
                      network: { ...settings.network, directConnection: false, proxyId: e.target.value },
                    });
                  }
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="direct">Direct Connection (No Proxy)</option>
                {proxies.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} ({pr.protocol.toUpperCase()}://{pr.host}:{pr.port})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="field-013" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                WebRTC Handling Policy
              </label>
              <select
                value={settings.network.webrtc}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    network: { ...settings.network, webrtc: e.target.value as ProfileSettingsType['network']['webrtc'] },
                  });
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="disable_non_proxied_udp">Disable Non-Proxied UDP (Recommended)</option>
                <option value="default">Default (Protected UDP)</option>
                <option value="proxy_only">Proxy Only (Disable Non-Proxied UDP)</option>
                <option value="public_interface_only">Public Interface Only</option>
                <option value="disabled">Disable WebRTC Completely</option>
                <option value="allow_all">Allow All (Unprotected)</option>
              </select>
              {(settings.network.webrtc === 'allow_all' || (settings.network.webrtc as string) === 'real') && (
                <p className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  WebRTC protection off — IP leak risk
                </p>
              )}
            </div>
          </div>
        )}

        {/* PRIVACY & ENVIRONMENT TAB */}
        {activeTab === 'privacy' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-014" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Screen Width (px)
                </label>
                <input
                  type="number"
                  value={settings.display.screenWidth}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      display: { ...settings.display, screenWidth: Number(e.target.value) },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="field-015" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Screen Height (px)
                </label>
                <input
                  type="number"
                  value={settings.display.screenHeight}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      display: { ...settings.display, screenHeight: Number(e.target.value) },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-016" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Timezone
                </label>
                <select
                  value={settings.locale.timezone}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      locale: { ...settings.locale, timezone: e.target.value },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="field-017" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Language
                </label>
                <select
                  value={settings.locale.language}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      locale: { ...settings.locale, language: e.target.value },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Auto-Sync Locale from Proxy IP on Launch
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Automatically align runtime timezone and language to the active proxy&apos;s exit IP without overwriting stored profile settings.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.locale.autoSyncFromIp)}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    locale: { ...settings.locale, autoSyncFromIp: e.target.checked },
                  });
                  setIsDirty(true);
                }}
                className="mt-1 h-4 w-4 accent-teal-600 rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* PERMISSIONS TAB */}
        {activeTab === 'permissions' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-018" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Camera
                </label>
                <select
                  value={settings.permissions.camera}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      permissions: { ...settings.permissions, camera: e.target.value as ProfileSettingsType['permissions']['camera'] },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="prompt">Prompt User</option>
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
              </div>

              <div>
                <label htmlFor="field-019" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Microphone
                </label>
                <select
                  value={settings.permissions.microphone}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      permissions: { ...settings.permissions, microphone: e.target.value as ProfileSettingsType['permissions']['microphone'] },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="prompt">Prompt User</option>
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-020" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Geolocation
                </label>
                <select
                  value={settings.permissions.geolocation}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      permissions: { ...settings.permissions, geolocation: e.target.value as ProfileSettingsType['permissions']['geolocation'] },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="prompt">Prompt User</option>
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
              </div>

              <div>
                <label htmlFor="field-021" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notifications
                </label>
                <select
                  value={settings.permissions.notifications}
                  onChange={(e) => {
                    setSettings({
                      ...settings,
                      permissions: { ...settings.permissions, notifications: e.target.value as ProfileSettingsType['permissions']['notifications'] },
                    });
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="prompt">Prompt User</option>
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STORAGE & PATH TAB */}
        {activeTab === 'storage' && (
          <div className="space-y-4 max-w-2xl animate-in fade-in duration-150">
            <div>
              <label htmlFor="field-022" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Isolated Storage Directory
              </label>
              <input
                type="text"
                readOnly
                value={profile.storagePath}
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This directory holds all cookies, local storage, history, and cache for this profile strictly isolated.
              </p>
            </div>

            <div className="pt-4 flex items-center space-x-3">
              <button type="button"
                onClick={() => onNavigate('cookies')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 flex items-center space-x-1.5"
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span>Manage Cookies</span>
              </button>
              <button type="button"
                onClick={() => onNavigate('history')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 flex items-center space-x-1.5"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Manage History</span>
              </button>
              <button type="button"
                onClick={() => onNavigate('export')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Profile</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
