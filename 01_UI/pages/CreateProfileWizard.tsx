import type React from 'react';
import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Monitor,
  Laptop,
  Terminal,
  Smartphone,
  Cpu,
  X,
  Zap,
  Loader2,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import type { NavigationPage } from '../components/Sidebar.js';
import {
  DEFAULT_USER_AGENTS,
  SCREEN_RESOLUTIONS,
  TIMEZONES,
  LANGUAGES,
  getDefaultProfileSettings,
  generateConsistentEnvironmentSettings,
} from '../../10_CONFIG/shared/constants/defaults.js';
import type { ProfileSettings } from '../../10_CONFIG/shared/types/profile.js';

interface CreateProfileWizardProps {
  onNavigate: (page: NavigationPage) => void;
}

export const CreateProfileWizard: React.FC<CreateProfileWizardProps> = ({ onNavigate }) => {
  const { createProfile } = useProfileStore();
  const { proxies, fetchProxies } = useProxyStore();

  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState(`New Profile ${Math.floor(Math.random() * 1000)}`);
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('General');
  const [tags, setTags] = useState<string[]>(['Workspace']);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');

  // Settings
  const [settings, setSettings] = useState<ProfileSettings>(getDefaultProfileSettings());

  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  const handleRandomize = () => {
    const consistent = generateConsistentEnvironmentSettings();
    setSettings(consistent);
  };

  const handleEngineChange = (newEngine: 'chromium' | 'chrome' | 'edge' | 'camoufox') => {
    const isCamoufox = newEngine === 'camoufox';
    const currentUa = settings.browser.userAgent || '';
    const isMobile = currentUa.includes('Android') || settings.mobile?.enable;
    const isMac = currentUa.includes('Macintosh');
    const isLinux = currentUa.includes('Linux') && !isMobile;

    let newUa = currentUa;
    if (isCamoufox) {
      if (!newUa.includes('Firefox')) {
        newUa = isMobile
          ? 'Mozilla/5.0 (Android 14; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0'
          : (isMac
            ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0'
            : (isLinux
              ? 'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0'
              : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'));
      }
    } else {
      if (newUa.includes('Firefox')) {
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
    }

    setSettings((prev) => ({
      ...prev,
      browser: {
        ...prev.browser,
        engine: newEngine,
        userAgent: newUa,
      },
    }));
  };

  const handleCreate = async () => {
    if (!name.trim() || isDeploying) return;
    setIsDeploying(true);
    try {
      const created = await createProfile({
        name: name.trim(),
        description,
        folder,
        tags,
        notes,
        settings,
      });
      if (created) {
        onNavigate('profiles');
      }
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col justify-between overflow-y-auto">
      {/* Wizard Header & Stepper */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create Browser Profile</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Step {step} of 5 — {step === 1 ? 'Basic Information' : step === 2 ? 'Browser Engine' : step === 3 ? 'Proxy & Network' : step === 4 ? 'Browser Environment & Permissions' : 'Summary & Deploy'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRandomize}
            className="px-3.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Test Consistency</span>
          </button>
        </div>

        {/* Stepper Tabs */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { num: 1, label: 'Basic Info' },
            { num: 2, label: 'Browser Engine' },
            { num: 3, label: 'Proxy' },
            { num: 4, label: 'Environment' },
            { num: 5, label: 'Summary' },
          ].map((s) => (
            <button
              type="button"
              key={s.num}
              onClick={() => s.num < step && setStep(s.num)}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                step === s.num
                  ? 'bg-teal-500/10 border-teal-500/50 text-teal-600 dark:text-teal-400 font-bold'
                  : step > s.num
                  ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider">Step {s.num}</div>
              <div className="text-xs truncate">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Wizard Step Content */}
      <div className="my-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm min-h-[380px]">
        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <label htmlFor="field-001" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Profile Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. YouTube Work or QA Staging 01"
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
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="e.g. Work, Social, Testing"
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
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional brief description"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="field-004" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Profile Tags
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Type tag and press Add or Enter..."
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200"
                >
                  Add Tag
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-semibold flex items-center space-x-1 border border-teal-500/20"
                  >
                    <span>{t}</span>
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-rose-500"
                      onClick={() => handleRemoveTag(t)}
                    />
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="field-005" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add private notes for this environment..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>

            {/* Express 1-Click Launch Bar (GoLogin Benchmark Refinement) */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-slate-50 dark:from-teal-950/30 dark:via-emerald-950/20 dark:to-slate-900 border border-teal-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Express Quick Setup
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-500/20 text-teal-600 dark:text-teal-400">
                    Instant 1-Click
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRandomize}
                  className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Randomize Fingerprint</span>
                </button>
              </div>

              <div className="mb-3">
                <label htmlFor="field-006" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Operating System & Device Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'windows', name: 'Windows', icon: Monitor, sub: 'Win 10/11' },
                    { id: 'mac', name: 'macOS', icon: Laptop, sub: 'Apple M-Series' },
                    { id: 'linux', name: 'Linux', icon: Terminal, sub: 'Ubuntu' },
                    { id: 'android', name: 'Android', icon: Smartphone, sub: 'Pixel 8 / S23' },
                  ].map((os) => {
                    const isAndroidSelected = settings.browser.userAgent.includes('Android') || settings.mobile?.enable;
                    const isMacSelected = settings.browser.userAgent.includes('Macintosh');
                    const isLinuxSelected = settings.browser.userAgent.includes('X11; Linux') && !isAndroidSelected;
                    const isWinSelected = !isAndroidSelected && !isMacSelected && !isLinuxSelected;
                    const isSelected = os.id === 'android' ? isAndroidSelected : os.id === 'mac' ? isMacSelected : os.id === 'linux' ? isLinuxSelected : isWinSelected;
                    const Icon = os.icon;
                    return (
                      <button type="button"
                        key={os.id}

                        onClick={() => {
                          if (os.id === 'android') {
                            const androidUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('Pixel 8'))?.value ||
                              DEFAULT_USER_AGENTS.find((u) => u.value.includes('Android'))?.value ||
                              'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';
                            setSettings({
                              ...settings,
                              browser: { ...settings.browser, userAgent: androidUa },
                              display: { ...settings.display, screenWidth: 412, screenHeight: 915, deviceScaleFactor: 2.625 },
                              mobile: { enable: true },
                              fingerprint: { ...settings.fingerprint, maxTouchPoints: 5 },
                            });
                            if (!tags.includes('Android')) setTags([...tags, 'Android']);
                          } else if (os.id === 'mac') {
                            const macUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('Macintosh'))?.value ||
                              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
                            setSettings({
                              ...settings,
                              browser: { ...settings.browser, userAgent: macUa },
                              display: { ...settings.display, screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 2 },
                              mobile: { enable: false },
                              fingerprint: { ...settings.fingerprint, maxTouchPoints: 0 },
                            });
                          } else if (os.id === 'linux') {
                            const linUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('X11; Linux'))?.value ||
                              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
                            setSettings({
                              ...settings,
                              browser: { ...settings.browser, userAgent: linUa },
                              display: { ...settings.display, screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 1 },
                              mobile: { enable: false },
                              fingerprint: { ...settings.fingerprint, maxTouchPoints: 0 },
                            });
                          } else {
                            const winUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('Windows NT 10.0'))?.value ||
                              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
                            setSettings({
                              ...settings,
                              browser: { ...settings.browser, userAgent: winUa },
                              display: { ...settings.display, screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 1 },
                              mobile: { enable: false },
                              fingerprint: { ...settings.fingerprint, maxTouchPoints: 0 },
                            });
                          }
                        }}
                        className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                          isSelected
                            ? 'bg-teal-500/15 border-teal-500 text-teal-600 dark:text-teal-400 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <div className="truncate">
                          <div className="text-xs font-bold leading-tight">{os.name}</div>
                          <div className="text-[9px] text-slate-400 truncate">{os.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <label htmlFor="field-007" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Proxy Attachment
                  </label>
                  <select
                    value={settings.network.directConnection ? '' : (settings.network.proxyId || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setSettings({
                          ...settings,
                          network: { ...settings.network, directConnection: true, proxyId: undefined },
                        });
                      } else {
                        setSettings({
                          ...settings,
                          network: { ...settings.network, directConnection: false, proxyId: val },
                        });
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Direct Connection (No Proxy)</option>
                    {proxies.map((px) => (
                      <option key={px.id} value={px.id}>
                        {px.name} ({px.host}:{px.port})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="field-008" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Browser Engine
                  </label>
                  <select
                    value={settings.browser.engine}
                    onChange={(e) => handleEngineChange(e.target.value as ProfileSettings['browser']['engine'])}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 capitalize"
                  >
                    <option value="chromium">Chromium 138 (Stealth)</option>
                    <option value="camoufox">Camoufox (Patched Firefox)</option>
                    <option value="chrome">Google Chrome (Managed CfT)</option>
                    <option value="edge">Microsoft Edge</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-teal-500/10">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ready to go? Deploy immediately or click Continue for deep fine-tuning.
                </span>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!name.trim() || isDeploying}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 active:scale-95 transition-all"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deploying...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>1-Click Deploy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Browser Engine */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Target Operating System (GoLogin & MostLogin OS Selector) */}
            <div>
              <label htmlFor="field-009" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Target Operating System
              </label>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { id: 'windows', name: 'Windows', icon: Monitor, desc: 'PC & Laptop (Win 11 / 10)', badge: 'Desktop' },
                  { id: 'mac', name: 'macOS', icon: Laptop, desc: 'Apple Silicon M1-M4', badge: 'Desktop' },
                  { id: 'linux', name: 'Linux', icon: Terminal, desc: 'Ubuntu / Enterprise', badge: 'Desktop' },
                  { id: 'android', name: 'Android', icon: Smartphone, desc: 'Pixel 8 / Galaxy S23', badge: 'Mobile Phone' },
                ].map((os) => {
                  const isAndroidSelected = settings.browser.userAgent.includes('Android') || settings.mobile?.enable;
                  const isMacSelected = settings.browser.userAgent.includes('Macintosh');
                  const isLinuxSelected = settings.browser.userAgent.includes('X11; Linux') && !isAndroidSelected;
                  const isWinSelected = !isAndroidSelected && !isMacSelected && !isLinuxSelected;
                  const isSelected = os.id === 'android' ? isAndroidSelected : os.id === 'mac' ? isMacSelected : os.id === 'linux' ? isLinuxSelected : isWinSelected;
                  const Icon = os.icon;
                  return (
                    <button
                      type="button"
                      key={os.id}
                      onClick={() => {
                        if (os.id === 'android') {
                          const androidUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('Pixel 8'))?.value ||
                            DEFAULT_USER_AGENTS.find((u) => u.value.includes('Android'))?.value ||
                            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';
                          setSettings({
                            ...settings,
                            browser: { ...settings.browser, userAgent: androidUa },
                            display: { ...settings.display, screenWidth: 412, screenHeight: 915, deviceScaleFactor: 2.625 },
                            mobile: { enable: true },
                            fingerprint: { ...settings.fingerprint, maxTouchPoints: 5 },
                          });
                          if (!tags.includes('Android')) setTags([...tags, 'Android']);
                        } else if (os.id === 'mac') {
                          const macUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('Macintosh'))?.value ||
                            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
                          setSettings({
                            ...settings,
                            browser: { ...settings.browser, userAgent: macUa },
                            display: { ...settings.display, screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 2 },
                            mobile: { enable: false },
                            fingerprint: { ...settings.fingerprint, maxTouchPoints: 0 },
                          });
                        } else if (os.id === 'linux') {
                          const linUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('X11; Linux'))?.value ||
                            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
                          setSettings({
                            ...settings,
                            browser: { ...settings.browser, userAgent: linUa },
                            display: { ...settings.display, screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 1 },
                            mobile: { enable: false },
                            fingerprint: { ...settings.fingerprint, maxTouchPoints: 0 },
                          });
                        } else {
                          const winUa = DEFAULT_USER_AGENTS.find((u) => u.value.includes('Windows NT 10.0'))?.value ||
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
                          setSettings({
                            ...settings,
                            browser: { ...settings.browser, userAgent: winUa },
                            display: { ...settings.display, screenWidth: 1920, screenHeight: 1080, deviceScaleFactor: 1 },
                            mobile: { enable: false },
                            fingerprint: { ...settings.fingerprint, maxTouchPoints: 0 },
                          });
                        }
                      }}
                      className={`text-left p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 font-bold shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon className="w-5 h-5" />
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          os.id === 'android' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {os.badge}
                        </span>
                      </div>
                      <div className="text-xs font-bold">{os.name}</div>
                      <div className="text-[11px] text-slate-400">{os.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <label htmlFor="field-010" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mt-2">
              Browser Engine Architecture
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                { id: 'chromium', name: 'Chromium 138', desc: 'Native C++ Stealth Engine' },
                { id: 'camoufox', name: 'Camoufox', desc: 'Patched Firefox Engine' },
                { id: 'chrome', name: 'Google Chrome', desc: 'Standard Chrome runtime' },
                { id: 'edge', name: 'Microsoft Edge', desc: 'Edge Chromium runtime' },
              ] as const).map((eng) => (
                <button
                  type="button"
                  key={eng.id}
                  onClick={() => handleEngineChange(eng.id)}
                  className={`text-left p-3.5 rounded-xl border cursor-pointer transition-all ${
                    settings.browser.engine === eng.id
                      ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 font-bold'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Cpu className="w-5 h-5 mb-1.5" />
                  <div className="text-xs font-bold">{eng.name}</div>
                  <div className="text-[11px] text-slate-400">{eng.desc}</div>
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="field-011" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                User Agent Preset
              </label>
              <select
                value={settings.browser.userAgent}
                onChange={(e) => {
                  const uaVal = e.target.value;
                  const isAndroid = uaVal.includes('Android') || uaVal.includes('Mobile');
                  setSettings({
                    ...settings,
                    browser: { ...settings.browser, userAgent: uaVal },
                    display: isAndroid
                      ? { ...settings.display, screenWidth: 412, screenHeight: 915, deviceScaleFactor: 2.625 }
                      : settings.display,
                    mobile: { enable: isAndroid },
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                {DEFAULT_USER_AGENTS.map((ua) => (
                  <option key={ua.value} value={ua.value}>
                    {ua.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-012" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Startup URL
                </label>
                <input
                  type="text"
                  value={settings.browser.startupUrl}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, startupUrl: e.target.value },
                    })
                  }
                  placeholder="https://www.google.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="field-013" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Homepage
                </label>
                <input
                  type="text"
                  value={settings.browser.homepage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, homepage: e.target.value },
                    })
                  }
                  placeholder="https://www.google.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-6 text-xs text-slate-700 dark:text-slate-300">
              <label htmlFor="field-014" className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.browser.hardwareAcceleration}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, hardwareAcceleration: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span>Enable Hardware Acceleration (GPU)</span>
              </label>

              <label htmlFor="field-015" className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.browser.enableExtensions}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      browser: { ...settings.browser, enableExtensions: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                />
                <span>Enable Chrome Extensions Support</span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 3: Proxy & Network */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    network: { ...settings.network, directConnection: true, proxyId: undefined },
                  })
                }
                className={`text-left p-4 rounded-xl border cursor-pointer transition-all ${
                  settings.network.directConnection
                    ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="text-sm font-bold">Direct Connection</div>
                <div className="text-xs text-slate-400 mt-1">Use standard local system network without proxy.</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    network: { ...settings.network, directConnection: false },
                  })
                }
                className={`text-left p-4 rounded-xl border cursor-pointer transition-all ${
                  !settings.network.directConnection
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="text-sm font-bold">Assigned Proxy</div>
                <div className="text-xs text-slate-400 mt-1">Route browser traffic through a saved proxy server.</div>
              </button>
            </div>

            {!settings.network.directConnection && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <label htmlFor="field-016" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Proxy Endpoint
                </label>
                {proxies.length === 0 ? (
                  <div className="text-xs text-slate-400">
                    No proxies configured yet.{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('proxies')}
                      className="text-teal-500 underline cursor-pointer"
                    >
                      Go to Proxy Manager to add one.
                    </button>
                  </div>
                ) : (
                  <select
                    value={settings.network.proxyId || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        network: { ...settings.network, proxyId: e.target.value },
                      })
                    }
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- Choose a proxy --</option>
                    {proxies.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} ({pr.protocol.toUpperCase()}://{pr.host}:{pr.port})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label htmlFor="field-017" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                WebRTC Policy
              </label>
              <select
                value={settings.network.webrtc}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    network: { ...settings.network, webrtc: e.target.value as ProfileSettings['network']['webrtc'] },
                  })
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="disable_non_proxied_udp">Disable Non-Proxied UDP (Recommended)</option>
                <option value="default">Default WebRTC (Protected UDP)</option>
                <option value="proxy_only">Proxy Only (Disable Non-Proxied UDP)</option>
                <option value="public_interface_only">Public Interface Only</option>
                <option value="disabled">Disabled Entirely</option>
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

        {/* STEP 4: Browser Environment / Fingerprint & Permissions */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-018" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Screen Resolution
                </label>
                <select
                  value={`${settings.display.screenWidth}x${settings.display.screenHeight}`}
                  onChange={(e) => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    setSettings({
                      ...settings,
                      display: { ...settings.display, screenWidth: w, screenHeight: h },
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  {SCREEN_RESOLUTIONS.map((res) => (
                    <option key={`${res.width}x${res.height}`} value={`${res.width}x${res.height}`}>
                      {res.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="field-019" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Timezone
                </label>
                <select
                  value={settings.locale.timezone}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      locale: { ...settings.locale, timezone: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-020" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Language
                </label>
                <select
                  value={settings.locale.language}
                  onChange={(e) => {
                    const found = LANGUAGES.find((l) => l.value === e.target.value);
                    setSettings({
                      ...settings,
                      locale: {
                        ...settings.locale,
                        language: e.target.value,
                        languagesList: found?.list || [e.target.value, 'en'],
                      },
                    });
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

              <div>
                <label htmlFor="field-021" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Device Scale Factor
                </label>
                <select
                  value={settings.display.deviceScaleFactor}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      display: { ...settings.display, deviceScaleFactor: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value={1}>1.0 (Standard Display)</option>
                  <option value={1.25}>1.25 (Laptop Scale)</option>
                  <option value={1.5}>1.5 (High DPI)</option>
                  <option value={2}>2.0 (Retina / 4K)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <label htmlFor="field-022" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Browser Permissions Policy
              </label>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Geolocation:</span>
                  <select
                    value={settings.permissions.geolocation}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        permissions: { ...settings.permissions, geolocation: e.target.value as ProfileSettings['permissions']['geolocation'] },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="allow">Allow</option>
                    <option value="block">Block</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Camera & Mic:</span>
                  <select
                    value={settings.permissions.camera}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        permissions: {
                          ...settings.permissions,
                          camera: e.target.value as ProfileSettings['permissions']['camera'],
                          microphone: e.target.value as ProfileSettings['permissions']['microphone'],
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="allow">Allow</option>
                    <option value="block">Block</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Notifications:</span>
                  <select
                    value={settings.permissions.notifications}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        permissions: { ...settings.permissions, notifications: e.target.value as ProfileSettings['permissions']['notifications'] },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="allow">Allow</option>
                    <option value="block">Block</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Summary & Deploy */}
        {step === 5 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Review Environment Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <div className="text-[11px] font-bold uppercase text-slate-400">Profile Identity</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Folder:</span>
                  <span className="text-slate-700 dark:text-slate-300">{folder}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tags:</span>
                  <span className="text-slate-700 dark:text-slate-300">{tags.join(', ') || 'None'}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <div className="text-[11px] font-bold uppercase text-slate-400">Browser & Engine</div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Engine:</span>
                  <span className="font-bold capitalize text-slate-800 dark:text-slate-100">{settings.browser.engine}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Resolution:</span>
                  <span className="text-slate-700 dark:text-slate-300">{settings.display.screenWidth}x{settings.display.screenHeight}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timezone:</span>
                  <span className="text-slate-700 dark:text-slate-300">{settings.locale.timezone}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1.5">
              <div className="text-[11px] font-bold uppercase text-slate-400">Network & Isolation</div>
              <div className="flex justify-between">
                <span className="text-slate-400">Connection:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {settings.network.directConnection ? 'Direct Local Network' : 'Routed via Proxy'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Filesystem Storage:</span>
                <span className="text-emerald-500 font-semibold">Strict Independent Directory</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 hover:bg-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('profiles')}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        )}

        {step < 5 ? (
          <div className="flex items-center space-x-2">
            {step === 1 && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || isDeploying}
                className="px-4 py-2 bg-teal-600/15 hover:bg-teal-600/25 text-teal-600 dark:text-teal-400 border border-teal-500/30 font-bold text-xs rounded-xl flex items-center space-x-1.5 active:scale-95 transition-all disabled:opacity-50"
                title="Create profile immediately with randomized stealth fingerprint and current settings"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>1-Click Deploy</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!name.trim()}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center space-x-1.5"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || isDeploying}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 active:scale-95"
          >
            {isDeploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deploying Profile...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Deploy Profile</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
