import React, { useState, useEffect } from 'react';
import {
  X,
  Globe2,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Clipboard,
} from 'lucide-react';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { ProxyItem, ProxyProtocol, ProxyTestResult } from '../../10_CONFIG/shared/types/proxy.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { CountryFlag, getFlagEmoji } from './CountryFlag.js';
import { parseProxyInput } from '../utils/phase1-ui-helpers.js';

interface ProxyConfigModalProps {
  profile: Profile;
  initialProxy?: ProxyItem;
  isOpen: boolean;
  onClose: () => void;
}

export const ProxyConfigModal: React.FC<ProxyConfigModalProps> = ({
  profile,
  initialProxy,
  isOpen,
  onClose,
}) => {
  const { updateProfile, fetchProfiles } = useProfileStore();
  const { createProxy, updateProxy, fetchProxies } = useProxyStore();
  const { showToast } = useToastStore();

  const [rawInput, setRawInput] = useState('');
  const [protocol, setProtocol] = useState<ProxyProtocol>('http');
  const [host, setHost] = useState('');
  const [port, setPort] = useState<number | string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);
  const [applying, setApplying] = useState(false);

  // Initialize fields on open
  useEffect(() => {
    if (isOpen) {
      if (initialProxy) {
        setProtocol(initialProxy.protocol || 'http');
        setHost(initialProxy.host || '');
        setPort(initialProxy.port || '');
        setUsername(initialProxy.username || '');
        setPassword('');
        setRawInput(`${initialProxy.protocol}://${initialProxy.host}:${initialProxy.port}`);
        setTestResult(
          initialProxy.status === 'CONNECTED'
            ? {
                success: true,
                latencyMs: initialProxy.latencyMs || 0,
                countryCode: initialProxy.countryRegion || 'US',
                country: initialProxy.countryName || 'United States',
                city: initialProxy.city,
                region: initialProxy.region,
                isp: initialProxy.isp,
              }
            : null
        );
      } else {
        setProtocol('http');
        setHost('');
        setPort('');
        setUsername('');
        setPassword('');
        setRawInput('');
        setTestResult(null);
      }
    }
  }, [isOpen, initialProxy]);

  if (!isOpen) return null;

  // Smart Parser for all proxy string formats
  const handleSmartParse = (text: string) => {
    setRawInput(text);
    const parsed = parseProxyInput(text);
    if (!parsed) return;

    setProtocol(parsed.protocol as ProxyProtocol);
    setHost(parsed.host);
    if (!isNaN(parsed.port)) setPort(parsed.port);
    if (parsed.username !== undefined) setUsername(parsed.username);
    if (parsed.password !== undefined) setPassword(parsed.password);
  };

  // Paste from clipboard button
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleSmartParse(text);
        showToast({ type: 'info', title: 'Proxy Pasted', message: 'Fields auto-populated from clipboard.' });
      }
    } catch {
      showToast({ type: 'error', title: 'Clipboard Error', message: 'Could not access clipboard.' });
    }
  };

  // Test Proxy
  const handleTestProxy = async () => {
    const cleanHost = host.trim();
    const cleanPort = typeof port === 'string' ? parseInt(port.trim(), 10) : port;

    if (!cleanHost) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Proxy Host is required.' });
      return;
    }
    if (!cleanPort || isNaN(cleanPort) || cleanPort < 1 || cleanPort > 65535) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Valid Port (1-65535) is required.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await window.mahiAPI.testProxy({
        proxyId: (initialProxy as any)?.id,
        host: cleanHost,
        port: cleanPort,
        protocol,
        username: username.trim() || undefined,
        password: password || undefined,
      });

      setTestResult(res);

      if (res.success) {
        showToast({
          type: 'success',
          title: '● Proxy Live',
          message: `${getFlagEmoji(res.countryCode)} ${res.country || 'Location'} • ${res.latencyMs}ms latency`,
        });
      } else {
        showToast({
          type: 'error',
          title: '● Proxy Failed',
          message: res.errorMessage || 'Connection failed',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, latencyMs: 0, errorMessage: msg });
      showToast({ type: 'error', title: 'Test Failed', message: msg });
    } finally {
      setTesting(false);
    }
  };

  // Apply Proxy (Atomic Save & Attach)
  const handleApplyProxy = async () => {
    const cleanHost = host.trim();
    const cleanPort = typeof port === 'string' ? parseInt(port.trim(), 10) : port;

    if (!cleanHost) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Proxy Host is required.' });
      return;
    }
    if (!cleanPort || isNaN(cleanPort) || cleanPort < 1 || cleanPort > 65535) {
      showToast({ type: 'error', title: 'Validation Error', message: 'Valid Port (1-65535) is required.' });
      return;
    }

    setApplying(true);
    try {
      let proxyId = initialProxy?.id;
      const countryCode = testResult?.countryCode || initialProxy?.countryRegion || 'US';
      const countryName = testResult?.country || initialProxy?.countryName || 'United States';

      if (proxyId) {
        // Update existing proxy
        await updateProxy(proxyId, {
          name: `${cleanHost}:${cleanPort}`,
          protocol,
          host: cleanHost,
          port: cleanPort,
          username: username.trim() || '',
          password: password || undefined,
          countryRegion: countryCode,
          countryName,
          city: testResult?.city,
          region: testResult?.region,
          timezone: testResult?.timezone,
          isp: testResult?.isp,
          asn: testResult?.asn,
          ip: testResult?.ip,
          status: testResult?.success ? 'CONNECTED' : 'UNKNOWN',
          latencyMs: testResult?.latencyMs,
        });
      } else {
        // Create new proxy
        const newPx = await createProxy({
          name: `${cleanHost}:${cleanPort}`,
          protocol,
          host: cleanHost,
          port: cleanPort,
          username: username.trim() || '',
          password: password || '',
          countryRegion: countryCode,
          countryName,
          city: testResult?.city,
          region: testResult?.region,
          timezone: testResult?.timezone,
          isp: testResult?.isp,
          asn: testResult?.asn,
          ip: testResult?.ip,
        });
        if (newPx) proxyId = newPx.id;
      }

      if (proxyId) {
        // Attach proxy to profile via transactional UPSERT
        const defaults = getDefaultProfileSettings();
        await updateProfile(profile.id, {
          settings: {
            network: { ...defaults.network, directConnection: false, proxyId },
          },
        } as any);

        await fetchProxies();
        await fetchProfiles();

        showToast({
          type: 'success',
          title: '✓ Proxy Applied',
          message: `${getFlagEmoji(countryCode)} ${countryName} • ${protocol.toUpperCase()}://${cleanHost}:${cleanPort}`,
        });
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: '✕ Update Failed', message: `Could not save proxy settings: ${msg}` });
    } finally {
      setApplying(false);
    }
  };

  // Remove Proxy (Revert to Direct Connection)
  const handleRemoveProxy = async () => {
    setApplying(true);
    try {
      const defaults = getDefaultProfileSettings();
      await updateProfile(profile.id, {
        settings: {
          network: { ...defaults.network, directConnection: true, proxyId: undefined },
        },
      } as any);

      await fetchProfiles();
      showToast({ type: 'info', title: 'Direct Connection', message: 'Proxy removed from profile.' });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Globe2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Proxy Configuration
              </h3>
              <p className="text-[11px] text-slate-400">
                Assign proxy to <span className="font-semibold text-slate-600 dark:text-slate-300">{profile.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Smart Paste Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                <span>Quick Paste (Auto-Parse)</span>
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1 font-medium"
              >
                <Clipboard className="w-3 h-3" />
                <span>Paste from Clipboard</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={rawInput}
              onChange={(e) => handleSmartParse(e.target.value)}
              placeholder="Paste proxy string (e.g. socks5://user:pass@123.123.123.123:1080 or host:port:user:pass)"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
            />
          </div>

          {/* Protocol & Port Selection */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Proxy Type
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as ProxyProtocol)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
                <option value="socks4">SOCKS4</option>
              </select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Host / IP
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. 192.168.1.1 or geo.g-w.info"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Port & Authentication */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8080"
                min={1}
                max={65535}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Username <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs transition-all ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-start space-x-2.5">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center space-x-1.5">
                      <span>{testResult.success ? '● Live' : '● Proxy Failed'}</span>
                      {testResult.success && testResult.latencyMs > 0 && (
                        <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                          · {testResult.latencyMs} ms
                        </span>
                      )}
                    </span>
                    {testResult.countryCode && (
                      <span className="flex items-center space-x-1 text-xs">
                        <CountryFlag countryCode={testResult.countryCode} />
                        <span>{testResult.countryCode}</span>
                      </span>
                    )}
                  </div>

                  {testResult.success ? (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 font-sans">
                      <div>
                        <span className="font-semibold">Location:</span> {testResult.country || 'Unknown'}
                        {testResult.city ? `, ${testResult.city}` : ''}
                        {testResult.region ? ` (${testResult.region})` : ''}
                      </div>
                      {testResult.ip && (
                        <div>
                          <span className="font-semibold">Public IP:</span> <span className="font-mono">{testResult.ip}</span>
                        </div>
                      )}
                      {testResult.isp && (
                        <div>
                          <span className="font-semibold">ISP / Org:</span> {testResult.isp}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400">
                      {testResult.errorMessage || 'Connection failed'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            {initialProxy && (
              <button
                type="button"
                onClick={handleRemoveProxy}
                disabled={applying || testing}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Proxy</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={applying || testing}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleTestProxy}
              disabled={testing || applying || !host.trim()}
              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-40 shadow-sm"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  <span>Test Proxy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleApplyProxy}
              disabled={applying || testing || !host.trim()}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-teal-600/25 flex items-center space-x-1.5 disabled:opacity-40 active:scale-95"
            >
              {applying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <span>Apply Proxy</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
