import type React from 'react';
import { useState, memo } from 'react';
import { Shield, Activity, Play, Sparkles, Cookie } from 'lucide-react';
import type { Profile } from '../../../10_CONFIG/shared/types/profile.js';
import { CountryFlag } from '../CountryFlag.js';

export type WarmerDepth = 'quick' | 'standard' | 'deep';

interface RawProxyTestResult {
  success: boolean;
  latencyMs?: number;
  country?: string;
  countryCode?: string;
  errorMessage?: string;
}

export interface UniversalProxyModalProps {
  profile: Profile;
  onClose: () => void;
  onFetchProxies: () => Promise<void>;
  onApplyProxy: (profile: Profile, rawProxyInput: string) => Promise<void>;
}

export const UniversalProxyModal: React.FC<UniversalProxyModalProps> = memo(({
  profile,
  onClose,
  onFetchProxies,
  onApplyProxy,
}) => {
  const [rawProxyInput, setRawProxyInput] = useState('');
  const [isTestingRawProxy, setIsTestingRawProxy] = useState(false);
  const [rawTestResult, setRawTestResult] = useState<RawProxyTestResult | null>(null);

  const handleTest = async () => {
    if (!rawProxyInput.trim()) return;
    setIsTestingRawProxy(true);
    setRawTestResult(null);
    try {
      const parsed = await window.mahiAPI.parseAndCreateProxy(rawProxyInput.trim());
      if (parsed) {
        setRawTestResult(parsed.testResult);
        await onFetchProxies();
      }
    } catch (err: unknown) {
      setRawTestResult({
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Invalid proxy format',
      });
    } finally {
      setIsTestingRawProxy(false);
    }
  };

  const handleApply = async () => {
    if (!rawProxyInput.trim()) return;
    setIsTestingRawProxy(true);
    try {
      await onApplyProxy(profile, rawProxyInput);
    } finally {
      setIsTestingRawProxy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Set Proxy: {profile.name}</h3>
              <p className="text-[11px] text-slate-400">Paste in any standard format (ip:port:user:pass)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="field-001" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Universal Proxy String *</label>
            <input
              type="text"
              value={rawProxyInput}
              onChange={(e) => setRawProxyInput(e.target.value)}
              placeholder="123.45.67.89:8080:username:password"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:border-teal-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Formats: <code className="text-teal-500">ip:port:user:pass</code>,{' '}
              <code className="text-teal-500">http://user:pass@ip:port</code>, or{' '}
              <code className="text-teal-500">ip:port</code>
            </p>
          </div>

          {rawTestResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                rawTestResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CountryFlag countryCode={rawTestResult.countryCode || 'US'} className="text-lg" />
                <div>
                  <div className="font-bold">{rawTestResult.success ? '● Proxy Live & Ready' : '● Connection Failed'}</div>
                  <div className="text-[10px] opacity-80">
                    {rawTestResult.success
                      ? `${rawTestResult.country || 'Location'} • ${rawTestResult.latencyMs} ms latency`
                      : rawTestResult.errorMessage || 'Invalid credentials or host unreachable'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTest}
              disabled={!rawProxyInput.trim() || isTestingRawProxy}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
            >
              <Activity className={`w-3.5 h-3.5 ${isTestingRawProxy ? 'animate-spin' : ''}`} />
              <span>{isTestingRawProxy ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-slate-400 hover:text-slate-200 font-semibold">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!rawProxyInput.trim() || isTestingRawProxy}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all interactive-control"
              >
                Save &amp; Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const STEALTH_CHECKERS = [
  {
    name: 'Pixelscan.net',
    desc: 'Tests Canvas, WebGL, Screen, and Client Hints legitimacy',
    url: 'https://pixelscan.net',
    badge: 'Recommended',
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    name: 'CreepJS',
    desc: 'Advanced bot detection & browser anomaly analyzer',
    url: 'https://abrahamjuliot.github.io/creepjs/',
    badge: 'Deep Audit',
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    name: 'BrowserLeaks Canvas',
    desc: 'Verifies Canvas 2D micro-noise & unique hash isolation',
    url: 'https://browserleaks.com/canvas',
    badge: 'Canvas Test',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    name: 'IPHEY.com',
    desc: 'Tests WebRTC leaks, DNS, and IP location consistency',
    url: 'https://iphey.com',
    badge: 'IP & WebRTC',
    color: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
  },
];

export const StealthTesterModal: React.FC<{
  profile: Profile;
  onClose: () => void;
  onLaunchChecker: (url: string) => void;
}> = memo(({ profile, onClose, onLaunchChecker }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Stealth &amp; Fingerprint Integrity</h3>
            <p className="text-[11px] text-slate-400">Test {profile.name} on live detection checkers</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold">
          ✕
        </button>
      </div>

      <div className="p-6 space-y-3">
        <p className="text-slate-600 dark:text-slate-300">
          Choose a live detection suite to test hardware spoofing, WebGL noise, and Canvas fingerprint masking:
        </p>

        <div className="space-y-2 pt-1">
          {STEALTH_CHECKERS.map((item) => (
            <button type="button"
              key={item.url}
              onClick={() => onLaunchChecker(item.url)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950/70 hover:bg-teal-500/5 dark:hover:bg-teal-500/10 border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 rounded-2xl flex items-center justify-between text-left transition-all group"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-teal-500 transition-colors">
                    {item.name}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.color}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
              </div>
              <Play className="w-4 h-4 text-slate-400 group-hover:text-teal-500 fill-current opacity-60 group-hover:opacity-100 transition-all shrink-0 ml-2" />
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
));

const SINGLE_WARM_OPTIONS: Array<{ id: WarmerDepth; title: string; desc: string; badge: string; color: string }> = [
  {
    id: 'quick',
    title: 'Quick Warmup (5 Sites)',
    desc: 'Google, Wikipedia, Bing, TechCrunch, BBC (~25 sec)',
    badge: 'Fast',
    color: 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5',
  },
  {
    id: 'standard',
    title: 'Standard Farm (12 Sites)',
    desc: 'Balanced across Search, News, Social & Commerce (~1 min)',
    badge: 'Recommended',
    color: 'border-teal-500/30 text-teal-600 dark:text-teal-400 bg-teal-500/5',
  },
  {
    id: 'deep',
    title: 'Deep Ageing (25 Sites)',
    desc: 'Comprehensive multi-category browsing for high-trust accounts (~2.5 mins)',
    badge: 'Enterprise',
    color: 'border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5',
  },
];

export const SingleWarmerModal: React.FC<{
  profile: Profile;
  warmerMode: WarmerDepth;
  isWarming: boolean;
  onChangeMode: (m: WarmerDepth) => void;
  onClose: () => void;
  onStart: () => void;
}> = memo(({ profile, warmerMode, isWarming, onChangeMode, onClose, onStart }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Cookie Warmer &amp; Auto-Farmer</h3>
            <p className="text-[11px] text-slate-400">Warm profile "{profile.name}"</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold" disabled={isWarming}>
          ✕
        </button>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-slate-600 dark:text-slate-300">
          The Cookie Warmer automatically visits authoritative websites (Google, Wikipedia, YouTube, BBC, Amazon) to harvest natural session cookies and build an authentic trust score before account creation.
        </p>

        <div className="space-y-2">
          <label htmlFor="field-002" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Warmup Depth</label>
          {SINGLE_WARM_OPTIONS.map((item) => (
            <button type="button"
              key={item.id}
              onClick={() => onChangeMode(item.id)}
              className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                warmerMode === item.id
                  ? `${item.color} border-2 shadow-sm font-bold`
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 opacity-70 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{item.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-normal">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
          <button type="button" onClick={onClose} disabled={isWarming} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={onStart}
            disabled={isWarming}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center space-x-2"
          >
            <Sparkles className={`w-4 h-4 ${isWarming ? 'animate-spin' : ''}`} />
            <span>{isWarming ? 'Farming Cookies...' : 'Start Warming'}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
));

const BULK_WARM_OPTIONS: Array<{ id: WarmerDepth; title: string; desc: string }> = [
  { id: 'quick', title: 'Quick (5 Sites per profile)', desc: 'Fast batch initialization' },
  { id: 'standard', title: 'Standard (12 Sites per profile)', desc: 'Recommended balance' },
  { id: 'deep', title: 'Deep Ageing (25 Sites per profile)', desc: 'Highest trust profile aging' },
];

export const BulkWarmerModal: React.FC<{
  selectedCount: number;
  warmerMode: WarmerDepth;
  isWarming: boolean;
  onChangeMode: (m: WarmerDepth) => void;
  onClose: () => void;
  onStart: () => void;
}> = memo(({ selectedCount, warmerMode, isWarming, onChangeMode, onClose, onStart }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Bulk Cookie Warmer</h3>
            <p className="text-[11px] text-slate-400">Farming {selectedCount} selected profiles</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm font-bold" disabled={isWarming}>
          ✕
        </button>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-slate-600 dark:text-slate-300">
          Run automated cookie farming across all <strong>{selectedCount} selected profiles</strong> simultaneously to build genuine session histories.
        </p>

        <div className="space-y-2">
          <label htmlFor="field-003" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Warmup Depth</label>
          {BULK_WARM_OPTIONS.map((item) => (
            <button type="button"
              key={item.id}
              onClick={() => onChangeMode(item.id)}
              className={`w-full p-3 rounded-2xl border text-left transition-all ${
                warmerMode === item.id
                  ? 'border-amber-500 bg-amber-500/10 border-2 font-bold text-slate-900 dark:text-slate-100'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 opacity-70'
              }`}
            >
              <div className="font-bold text-slate-800 dark:text-slate-100">{item.title}</div>
              <p className="text-[11px] text-slate-400 font-normal">{item.desc}</p>
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
          <button type="button" onClick={onClose} disabled={isWarming} className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={onStart}
            disabled={isWarming}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center space-x-2"
          >
            <Sparkles className={`w-4 h-4 ${isWarming ? 'animate-spin' : ''}`} />
            <span>{isWarming ? `Farming ${selectedCount} Profiles...` : `Warm All (${selectedCount})`}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
));

export const CookieWarmerIndicator: React.FC<{
  warmerMode: WarmerDepth;
  targetProfileName?: string;
  selectedCount: number;
}> = memo(({ warmerMode, targetProfileName, selectedCount }) => (
  <div className="fixed bottom-6 right-6 z-40 bg-slate-900/95 backdrop-blur-md border border-amber-500/30 rounded-2xl shadow-2xl p-4 w-80 text-xs animate-in slide-in-from-bottom-3 duration-200">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
        <span className="font-bold text-slate-100 flex items-center gap-1.5">
          <Cookie className="w-3.5 h-3.5 text-amber-400" />
          <span>Smart Cookie Warmer Active</span>
        </span>
      </div>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
        {warmerMode}
      </span>
    </div>
    <p className="text-[11px] text-slate-400 mb-2.5">
      {targetProfileName
        ? `Farming organic trust cookies for "${targetProfileName}"...`
        : `Bulk warming across ${selectedCount} selected profiles...`}
    </p>
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-teal-400 h-1.5 rounded-full animate-pulse w-3/4 transition-all duration-500" />
    </div>
    <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
      <span>Simulating natural navigation</span>
      <span className="text-amber-400 font-semibold">Running...</span>
    </div>
  </div>
));
