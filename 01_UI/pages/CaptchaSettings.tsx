import React, { useState, useEffect } from 'react';
import {
  Bot,
  Key,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ShieldCheck,
  Globe,
  Sliders,
  Play,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  CaptchaConfig,
  CaptchaProvider,
  CaptchaType,
  CaptchaBalanceResult,
  CaptchaSolveResult,
} from '../../10_CONFIG/shared/types/captcha.js';
import { useToastStore } from '../stores/useToastStore.js';

const PROVIDERS: { id: CaptchaProvider; name: string; website: string; desc: string; iconBg: string }[] = [
  {
    id: '2captcha',
    name: '2Captcha',
    website: 'https://2captcha.com',
    desc: 'High speed worker network with native Cloudflare Turnstile, reCAPTCHA v2/v3, and hCaptcha support.',
    iconBg: 'from-amber-500/20 to-orange-500/20 text-amber-500',
  },
  {
    id: 'capmonster',
    name: 'CapMonster Cloud',
    website: 'https://capmonster.cloud',
    desc: 'Ultra-low cost AI and neural network solver for enterprise high-volume captcha bypassing.',
    iconBg: 'from-teal-500/20 to-emerald-500/20 text-teal-400',
  },
  {
    id: 'anticaptcha',
    name: 'Anti-Captcha',
    website: 'https://anti-captcha.com',
    desc: 'Reliable 99.9% uptime solver with advanced proxy support and fast response latency.',
    iconBg: 'from-indigo-500/20 to-blue-500/20 text-indigo-400',
  },
  {
    id: 'ezcaptcha',
    name: 'EzCaptcha',
    website: 'https://ez-captcha.com',
    desc: 'Specialized low-latency solver for Cloudflare Turnstile, Arkose FunCaptcha, and AWS WAF.',
    iconBg: 'from-pink-500/20 to-rose-500/20 text-pink-400',
  },
];

export const CaptchaSettings: React.FC = () => {
  const { showToast } = useToastStore();
  const [config, setConfig] = useState<CaptchaConfig>({
    enabled: false,
    provider: '2captcha',
    apiKey: '',
    autoSolveInBrowser: true,
    autoSolveInRpa: true,
    timeoutSeconds: 60,
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);
  const [balance, setBalance] = useState<CaptchaBalanceResult | null>(null);

  // Test Sandbox State
  const [testType, setTestType] = useState<CaptchaType>('turnstile');
  const [testUrl, setTestUrl] = useState<string>('https://challenges.cloudflare.com');
  const [testSiteKey, setTestSiteKey] = useState<string>('0x4AAAAAAADnPIDROrmt1Wwj');
  const [solving, setSolving] = useState<boolean>(false);
  const [solveResult, setSolveResult] = useState<CaptchaSolveResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      if (window.mahiAPI?.captchaGetConfig) {
        const cfg = await window.mahiAPI.captchaGetConfig();
        setConfig(cfg);
        if (cfg.apiKey) {
          fetchBalance(cfg.provider, cfg.apiKey);
        }
      }
    } catch (err) {
      console.error('Failed to load captcha config:', err);
    }
  };

  const fetchBalance = async (provider: CaptchaProvider, apiKey: string) => {
    if (!apiKey) return;
    setBalanceLoading(true);
    try {
      if (window.mahiAPI?.captchaCheckBalance) {
        const res = await window.mahiAPI.captchaCheckBalance(provider, apiKey);
        setBalance(res);
      }
    } catch (err) {
      console.error('Failed to check balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.mahiAPI?.captchaSaveConfig) {
        await window.mahiAPI.captchaSaveConfig(config);
        showToast({
          type: 'success',
          title: 'Settings Saved',
          message: `Captcha solver config updated to ${config.provider}`,
        });
        if (config.apiKey) {
          await fetchBalance(config.provider, config.apiKey);
        }
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not save captcha config',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSolve = async () => {
    if (!config.apiKey) {
      showToast({
        type: 'error',
        title: 'API Key Required',
        message: 'Please enter and save your Captcha provider API Key first.',
      });
      return;
    }

    setSolving(true);
    setSolveResult(null);
    try {
      if (window.mahiAPI?.captchaSolve) {
        const res = await window.mahiAPI.captchaSolve({
          provider: config.provider,
          apiKey: config.apiKey,
          type: testType,
          websiteUrl: testUrl,
          websiteKey: testSiteKey,
        });
        setSolveResult(res);
        if (res.success) {
          showToast({
            type: 'success',
            title: 'Captcha Solved!',
            message: `Solved in ${res.solveTimeSeconds?.toFixed(1)}s`,
          });
        } else {
          showToast({
            type: 'error',
            title: 'Solve Failed',
            message: res.error || 'Unknown solver error',
          });
        }
      }
    } catch (err: any) {
      setSolveResult({ success: false, error: err.message });
    } finally {
      setSolving(false);
    }
  };

  const handleCopyToken = () => {
    if (solveResult?.token) {
      navigator.clipboard.writeText(solveResult.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 overflow-y-auto h-full custom-scrollbar font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              Automated Captcha Solver
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Cloud AI Bypass Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automatic background solving for Cloudflare Turnstile, Google reCAPTCHA v2/v3, and hCaptcha
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-sm shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50 self-start sm:self-auto"
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Main Grid: Provider Config & Live Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Provider Selection & Keys */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Selection */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-500" /> Choose Solver Provider
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROVIDERS.map((prov) => {
                const isSelected = config.provider === prov.id;
                return (
                  <div
                    key={prov.id}
                    onClick={() => setConfig({ ...config, provider: prov.id })}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-teal-500/5 border-teal-500 dark:border-teal-500/80 ring-1 ring-teal-500/40 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {prov.name}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-500" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        {prov.desc}
                      </p>
                    </div>

                    <a
                      href={prov.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 mt-3 hover:underline"
                    >
                      Get API Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>

            {/* API Key Input */}
            <div className="pt-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                {config.provider.toUpperCase()} API KEY
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder={`Enter your ${config.provider} client API key`}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>

                <button
                  onClick={() => fetchBalance(config.provider, config.apiKey)}
                  disabled={balanceLoading || !config.apiKey}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-teal-500 ${balanceLoading ? 'animate-spin' : ''}`} />
                  Check Balance
                </button>
              </div>
            </div>
          </div>

          {/* Automation & Behavior Toggles */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-teal-500" /> Solver Automation Rules
            </h3>

            <div className="space-y-3">
              {/* Master Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Master Captcha Auto-Bypass</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Enable or disable all automated solving globally</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="w-5 h-5 text-teal-500 rounded focus:ring-teal-500 cursor-pointer"
                />
              </div>

              {/* Browser Profiles Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Auto-Solve in Real Browser Profiles</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Automatically bypass Cloudflare and reCAPTCHA checkboxes while browsing</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoSolveInBrowser}
                  onChange={(e) => setConfig({ ...config, autoSolveInBrowser: e.target.checked })}
                  className="w-5 h-5 text-teal-500 rounded focus:ring-teal-500 cursor-pointer"
                />
              </div>

              {/* RPA Workflows Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Auto-Solve in RPA Workflows</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Execute SOLVE_CAPTCHA action block during automated sequences</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoSolveInRpa}
                  onChange={(e) => setConfig({ ...config, autoSolveInRpa: e.target.checked })}
                  className="w-5 h-5 text-teal-500 rounded focus:ring-teal-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Balance & Supported Types */}
        <div className="space-y-6">
          {/* Live Balance Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-teal-500/10 to-transparent rounded-full blur-xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Provider Account Balance
                </span>
                <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-bold uppercase">
                  {config.provider}
                </span>
              </div>

              <div className="my-5 flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900 dark:text-white">
                  ${balance?.success ? balance.balance.toFixed(2) : '0.00'}
                </span>
                <span className="text-xs font-bold text-slate-400">USD</span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {balance?.success
                  ? `Active API connection verified. ~${Math.floor(balance.balance / 0.002)} Captchas remaining.`
                  : balance?.error
                  ? `Balance check error: ${balance.error}`
                  : 'Enter your API key and click "Check Balance" to verify credits.'}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Solver Status</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${config.enabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {config.enabled ? 'Online & Ready' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Supported Types Badges */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Supported Captcha Protocols
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">Cloudflare Turnstile</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">100% BYPASS</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">Google reCAPTCHA v2/v3</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">100% BYPASS</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">hCaptcha & FunCaptcha</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">SUPPORTED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Testing Sandbox */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Interactive Captcha Testing Sandbox
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Verify your solver in real-time</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Protocol Type
            </label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as CaptchaType)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            >
              <option value="turnstile">Cloudflare Turnstile</option>
              <option value="recaptcha_v2">Google reCAPTCHA v2</option>
              <option value="recaptcha_v3">Google reCAPTCHA v3</option>
              <option value="hcaptcha">hCaptcha</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Target Website URL
            </label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://challenges.cloudflare.com"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              SiteKey / Widget Key
            </label>
            <input
              type="text"
              value={testSiteKey}
              onChange={(e) => setTestSiteKey(e.target.value)}
              placeholder="0x4AAAAAAADnPIDROrmt1Wwj"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleTestSolve}
            disabled={solving || !config.apiKey}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${solving ? 'animate-spin' : ''}`} />
            <span>{solving ? 'Requesting Solution...' : 'Execute Live Test Solve'}</span>
          </button>

          {solveResult && (
            <div className="flex items-center gap-3">
              {solveResult.success ? (
                <div className="flex items-center gap-2 text-xs text-emerald-500 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  Solved in {solveResult.solveTimeSeconds?.toFixed(1)}s
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-rose-500 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  {solveResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {solveResult?.token && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Generated Response Token
              </span>
              <button
                onClick={handleCopyToken}
                className="text-xs text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Token'}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              {solveResult.token}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
