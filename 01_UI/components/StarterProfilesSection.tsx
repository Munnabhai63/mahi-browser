import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Layers,
  Plus,
  Upload,
  Globe2,
  Copy,
  Info,
  Check,
  Shield,
  Laptop,
  Share2,
  ShoppingCart,
  Briefcase,
  Cpu,
  TestTube2,
  ArrowRight,
  X,
  Loader2,
  CheckCheck,
  Terminal,
  AlertTriangle,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { NavigationPage } from './Sidebar.js';
import { UpgradeModal } from './UpgradeModal.js';

export interface StarterTemplate {
  id: string;
  name: string;
  category: 'PERSONAL' | 'SOCIAL' | 'E-COMMERCE' | 'WORK' | 'AUTOMATION' | 'SANDBOX';
  badge: 'STARTER' | 'DEMO' | 'EXAMPLE';
  description: string;
  os?: 'windows' | 'mac' | 'linux';
  browser?: string;
  fingerprintPreview?: {
    screenResolution?: string;
    userAgentSnippet?: string;
    webGlVendor?: string;
    canvasNoise?: boolean;
    audioNoise?: boolean;
  };
}

const FALLBACK_TEMPLATES: StarterTemplate[] = [
  {
    id: 'starter_personal',
    name: 'Personal Browsing',
    category: 'PERSONAL',
    badge: 'STARTER',
    description: 'Clean everyday browsing profile with isolated storage, standard Canvas noise, and protected privacy.',
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
      webGlVendor: 'Google Inc. (NVIDIA)',
      canvasNoise: true,
      audioNoise: true,
    },
  },
  {
    id: 'starter_social',
    name: 'Social Media Profile',
    category: 'SOCIAL',
    badge: 'DEMO',
    description: 'Tuned for social account isolation (Facebook, Twitter/X, Instagram, LinkedIn) with zero tracking leakage.',
    os: 'mac',
    browser: 'Chrome 128 / macOS Sonoma',
    fingerprintPreview: {
      screenResolution: '2560x1440',
      userAgentSnippet: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
      webGlVendor: 'Apple (Apple M2 Pro)',
      canvasNoise: true,
      audioNoise: true,
    },
  },
  {
    id: 'starter_ecommerce',
    name: 'E-Commerce Store Profile',
    category: 'E-COMMERCE',
    badge: 'STARTER',
    description: 'Optimized for marketplace merchant store management (Amazon, eBay, Shopify) with strict IP and WebRTC locking.',
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
      webGlVendor: 'Google Inc. (NVIDIA GeForce RTX 4070)',
      canvasNoise: true,
      audioNoise: true,
    },
  },
  {
    id: 'starter_work',
    name: 'Business & Work Profile',
    category: 'WORK',
    badge: 'DEMO',
    description: 'Dedicated client workspace container for enterprise dashboards, analytics, and business SaaS applications.',
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
      webGlVendor: 'Google Inc. (Intel Iris Xe)',
      canvasNoise: true,
      audioNoise: true,
    },
  },
  {
    id: 'starter_automation',
    name: 'Automation Example Profile',
    category: 'AUTOMATION',
    badge: 'EXAMPLE',
    description: 'Pre-configured for Visual RPA execution, CDP synchronizer multi-window workflows, and automated cookie warming.',
    os: 'windows',
    browser: 'Chrome 128 / Windows 11',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
      webGlVendor: 'Google Inc. (NVIDIA)',
      canvasNoise: true,
      audioNoise: true,
    },
  },
  {
    id: 'starter_sandbox',
    name: 'Sandbox & Test Profile',
    category: 'SANDBOX',
    badge: 'DEMO',
    description: 'Ephemeral testing environment for validating anti-detect fingerprints and ad verification without saving history.',
    os: 'linux',
    browser: 'Chrome 128 / Linux x86_64',
    fingerprintPreview: {
      screenResolution: '1920x1080',
      userAgentSnippet: 'Mozilla/5.0 (X11; Linux x86_64)...',
      webGlVendor: 'Google Inc. (Mesa / AMD Radeon)',
      canvasNoise: true,
      audioNoise: true,
    },
  },
];

interface StarterProfilesSectionProps {
  onNavigate: (page: NavigationPage) => void;
  onOpenUniversalImport?: () => void;
  isStandaloneTab?: boolean;
  onSwitchToAllProfiles?: () => void;
}

export const StarterProfilesSection: React.FC<StarterProfilesSectionProps> = ({
  onNavigate,
  onOpenUniversalImport,
  isStandaloneTab = false,
  onSwitchToAllProfiles,
}) => {
  const { planLimits } = useAccountStore();
  const [templates, setTemplates] = useState<StarterTemplate[]>(FALLBACK_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<StarterTemplate | null>(null);
  const [customProfileName, setCustomProfileName] = useState('');
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [quotaExceededModalOpen, setQuotaExceededModalOpen] = useState(false);
  const [desktopRequiredModalOpen, setDesktopRequiredModalOpen] = useState(false);
  const [copiedAppPath, setCopiedAppPath] = useState(false);

  const { fetchProfiles } = useProfileStore();
  const { showToast } = useToastStore();

  const isDesktopApp = (): boolean => {
    if (typeof window === 'undefined') return false;
    if ((window.mahiAPI as any)?.isDesktop === true) return true;
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) return true;
    return false;
  };

  useEffect(() => {
    if (window.mahiAPI?.getStarterTemplates) {
      window.mahiAPI
        .getStarterTemplates()
        .then((res: StarterTemplate[]) => {
          if (Array.isArray(res) && res.length > 0) {
            setTemplates(res);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleOpenCloneModal = (tpl: StarterTemplate) => {
    setSelectedTemplate(tpl);
    setCustomProfileName(`${tpl.name} - My Profile`);
  };

  const handleCreateProfile = async (tpl: StarterTemplate, customName?: string) => {
    if (creatingTemplateId) return; // Prevent repeated clicks

    if (!isDesktopApp()) {
      setDesktopRequiredModalOpen(true);
      return;
    }

    setCreatingTemplateId(tpl.id);
    try {
      if (window.mahiAPI?.createProfileFromStarter) {
        const chosenName = customName?.trim() || tpl.name;
        const created = await window.mahiAPI.createProfileFromStarter(tpl.id, {
          name: chosenName,
        });

        if (!created || !created.id) {
          throw new Error('Backend failed to return a persistent profile record.');
        }

        showToast({
          type: 'success',
          title: 'Profile Created!',
          message: `Created real profile "${created.name}" from ${tpl.name} template.`,
        });

        await fetchProfiles();
        setSelectedTemplate(null);

        if (onSwitchToAllProfiles) {
          onSwitchToAllProfiles();
        }
        if (!isStandaloneTab) {
          onNavigate('profiles');
        }
      } else {
        throw new Error('Desktop IPC bridge "createProfileFromStarter" is not available.');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('PROFILE_LIMIT_REACHED') || msg.includes('limit reached')) {
        setQuotaExceededModalOpen(true);
      } else if (msg.includes('DESKTOP_REQUIRED')) {
        setDesktopRequiredModalOpen(true);
      } else {
        showToast({
          type: 'error',
          title: 'Creation Failed',
          message: msg || 'Failed to create profile from template.',
        });
      }
    } finally {
      setCreatingTemplateId(null);
    }
  };

  const handleConfirmCreate = async () => {
    if (!selectedTemplate) return;
    await handleCreateProfile(selectedTemplate, customProfileName);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'PERSONAL':
        return <Laptop className="w-4 h-4 text-sky-400" />;
      case 'SOCIAL':
        return <Share2 className="w-4 h-4 text-pink-400" />;
      case 'E-COMMERCE':
        return <ShoppingCart className="w-4 h-4 text-emerald-400" />;
      case 'WORK':
        return <Briefcase className="w-4 h-4 text-amber-400" />;
      case 'AUTOMATION':
        return <Cpu className="w-4 h-4 text-teal-400" />;
      case 'SANDBOX':
        return <TestTube2 className="w-4 h-4 text-purple-400" />;
      default:
        return <Globe2 className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="w-full flex flex-col p-6 space-y-6 max-w-7xl mx-auto">
      {/* Onboarding Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/60 border border-slate-800 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isStandaloneTab ? 'Starter Templates Catalog' : 'Welcome to MAHI Browser'}</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isStandaloneTab
                ? 'Reference Profile Blueprints & Starter Configurations'
                : 'Clean Onboarding: Starter Demo Profiles'}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isStandaloneTab
                ? 'Clone any pre-configured template below to instantly create an isolated browser profile pre-tuned for specific use cases.'
                : 'Get started immediately with high-performance starter templates, or create your own custom isolated browser fingerprint with 1-click.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('create-profile')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/25 flex items-center space-x-2 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create My Profile</span>
            </button>
            {onOpenUniversalImport && (
              <button
                onClick={onOpenUniversalImport}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-700/60 flex items-center space-x-2 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>Import Profiles</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Starter Templates Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-bold text-slate-200">
              {templates.length} Starter / Demo Templates
            </h2>
            <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded-full">
              Zero Quota Used
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-teal-400" />
            <span>Templates are isolated and contain no real session data</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-2xl p-5 shadow-md hover:shadow-teal-500/5 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700/60 group-hover:scale-105 transition-transform">
                      {getCategoryIcon(tpl.category)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                        {tpl.name}
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {tpl.category}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      tpl.badge === 'STARTER'
                        ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                        : tpl.badge === 'DEMO'
                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                    }`}
                  >
                    {tpl.badge}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">
                  {tpl.description}
                </p>

                {/* Specs pill preview */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono text-slate-400 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Platform:</span>
                    <span className="text-slate-300">{tpl.browser || 'Chromium 138 / Windows'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Screen:</span>
                    <span className="text-slate-300">{tpl.fingerprintPreview?.screenResolution || '1920x1080'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Protection:</span>
                    <span className="text-emerald-400 font-sans font-bold text-[10px]">
                      Canvas + Audio Noise Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCreateProfile(tpl)}
                  disabled={creatingTemplateId !== null}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm ${
                    creatingTemplateId === tpl.id
                      ? 'bg-teal-500/80 text-slate-950 cursor-wait'
                      : 'bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-950 border border-teal-500/20 hover:border-transparent group-hover:shadow-md'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {creatingTemplateId === tpl.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      <span>Creating Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Use Template</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleOpenCloneModal(tpl)}
                  disabled={creatingTemplateId !== null}
                  title="Customize profile name before creating"
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-40"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template Conversion / Custom Name Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in select-none">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Profile From Template</h3>
                  <span className="text-[10px] text-teal-400 font-semibold uppercase">
                    {selectedTemplate.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                disabled={creatingTemplateId !== null}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={customProfileName}
                  onChange={(e) => setCustomProfileName(e.target.value)}
                  placeholder="Enter profile name..."
                  disabled={creatingTemplateId !== null}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
                  autoFocus
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-2 text-slate-300">
                <div className="flex items-center space-x-2 text-teal-400 font-semibold">
                  <Shield className="w-4 h-4" />
                  <span>Isolated Hardware Profile</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  A fresh isolated browser container will be initialized with matching noise and user-agent parameters. No shared data or historical sessions are inherited.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                onClick={() => setSelectedTemplate(null)}
                disabled={creatingTemplateId !== null}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreate}
                disabled={creatingTemplateId !== null}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/25 flex items-center space-x-2 disabled:opacity-50"
              >
                {creatingTemplateId !== null ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Profile...</span>
                  </>
                ) : (
                  <span>Create My Profile</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Application Required Modal (Chrome Preview Guard) */}
      {desktopRequiredModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in select-none">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Desktop Application Required</h3>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                    Web Preview Mode Detected
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDesktopRequiredModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                You are currently previewing MAHI Browser inside a web browser window. Creating and running isolated antidetect browser profiles requires the native <strong className="text-teal-400">MAHI Browser Desktop Application</strong>.
              </p>

              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
                <div className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-teal-400" />
                  <span>Desktop-Exclusive Capabilities:</span>
                </div>
                <ul className="space-y-1 pl-5 list-disc text-slate-400">
                  <li>Direct Chromium process spawning with independent storage partitions</li>
                  <li>Local encrypted SQLite persistence &amp; master key security</li>
                  <li>Kernel-level Canvas, WebGL, Audio &amp; ClientRects noise injection</li>
                  <li>Real proxy routing, Mobile IP rotation &amp; automated cookie warming</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-teal-400" />
                  <span>Launch Verified Desktop Application:</span>
                </span>
                <code className="block p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-teal-300 break-all select-all">
                  {typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)
                    ? '/Applications/MAHI BROWSER.app'
                    : typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent)
                      ? 'mahi-browser'
                      : '%LOCALAPPDATA%\\Programs\\MAHI BROWSER\\MAHI Browser.exe'}
                </code>
              </div>
            </div>

            <div className="p-5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-medium">
                Or launch from Applications / Start Menu / Desktop shortcut
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const launchTarget =
                      typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)
                        ? '/Applications/MAHI BROWSER.app'
                        : typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent)
                          ? 'mahi-browser'
                          : '%LOCALAPPDATA%\\Programs\\MAHI BROWSER\\MAHI Browser.exe';
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(launchTarget);
                      setCopiedAppPath(true);
                      setTimeout(() => setCopiedAppPath(false), 2000);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5"
                >
                  {copiedAppPath ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy EXE Path</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setDesktopRequiredModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quota limit modal */}
      {quotaExceededModalOpen && (
        <UpgradeModal
          isOpen={quotaExceededModalOpen}
          onClose={() => setQuotaExceededModalOpen(false)}
          featureTitle="Profile Quota Reached"
          featureDescription={
            planLimits?.isPro || planLimits?.plan === 'pro' || planLimits?.plan?.startsWith('pro_')
              ? 'Your PRO plan limit (100 profiles) has been reached. Upgrade to MAHI BUSINESS for up to 300+ profiles and Team Workspaces.'
              : 'Your FREE plan limit (15 profiles) has been reached. Upgrade to MAHI PRO for 100 profiles and full anti-detect capabilities.'
          }
          requiredPlan={planLimits?.isPro || planLimits?.plan === 'pro' || planLimits?.plan?.startsWith('pro_') ? 'BUSINESS' : 'PRO'}
        />
      )}
    </div>
  );
};
