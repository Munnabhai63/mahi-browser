import React, { useState, useEffect } from 'react';
import {
  Globe2,
  Sparkles,
  RefreshCw,
  Zap,
  Shield,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Smartphone,
  Server,
  Home,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  ProxyProviderInfo,
  GeoCountryOption,
  ProxyNetworkType,
  ProxySessionType,
  ProxySessionRecord,
  ProxyUsageReport,
} from '../../10_CONFIG/shared/types/proxy-provider.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { CountryFlag } from './CountryFlag.js';

export const ProxyCatalogSection: React.FC = () => {
  const { profiles, fetchProfiles } = useProfileStore();
  const { fetchProxies, testProxy } = useProxyStore();
  const { showToast } = useToastStore();

  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProxyProviderInfo[]>([]);
  const [countries, setCountries] = useState<GeoCountryOption[]>([]);
  const [sessions, setSessions] = useState<ProxySessionRecord[]>([]);
  const [usage, setUsage] = useState<ProxyUsageReport | null>(null);

  // Form State
  const [selectedProviderId, setSelectedProviderId] = useState<string>('auto');
  const [selectedNetworkType, setSelectedNetworkType] = useState<ProxyNetworkType>('RESIDENTIAL');
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedSessionType, setSelectedSessionType] = useState<ProxySessionType>('STICKY');
  const [selectedTtl, setSelectedTtl] = useState<number>(30);
  const [targetProfileId, setTargetProfileId] = useState<string>('');

  const [generating, setGenerating] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const api = (window as any).mahiBrowserAPI;

  const loadData = async () => {
    if (!api?.getProxyCatalog) return;
    setLoading(true);
    try {
      const [catalogRes, providersRes, sessionsRes, usageRes] = await Promise.all([
        api.getProxyCatalog({ networkType: selectedNetworkType }),
        api.getProxyProviders ? api.getProxyProviders() : Promise.resolve([]),
        api.getProxySessions ? api.getProxySessions() : Promise.resolve([]),
        api.getProxyUsage ? api.getProxyUsage() : Promise.resolve(null),
      ]);

      if (catalogRes?.availableCountries) {
        setCountries(catalogRes.availableCountries);
      }
      if (providersRes) {
        setProviders(providersRes);
      }
      if (sessionsRes) {
        setSessions(sessionsRes);
      }
      if (usageRes) {
        setUsage(usageRes);
      }
    } catch (err: any) {
      showToast({ type: 'error', title: `Failed to load catalog: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchProfiles();
  }, [selectedNetworkType]);

  const activeCountryObj = countries.find((c) => c.code === selectedCountry);
  const availableCities = activeCountryObj?.cities || [];

  const handleGenerate = async (assignDirectly = false) => {
    if (!api?.generateProxySession) return;
    setGenerating(true);
    try {
      const res = await api.generateProxySession({
        providerId: selectedProviderId,
        networkType: selectedNetworkType,
        country: selectedCountry,
        city: selectedCity || undefined,
        sessionType: selectedSessionType,
        ttlMinutes: selectedSessionType === 'STICKY' ? selectedTtl : undefined,
        profileId: assignDirectly && targetProfileId ? targetProfileId : undefined,
      });

      showToast({ type: 'success', title: `Generated ${selectedNetworkType} proxy in ${selectedCountry} successfully!` });
      await fetchProxies();
      await fetchProfiles();
      await loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: `Proxy generation failed: ${err.message}` });
    } finally {
      setGenerating(false);
    }
  };

  const handleRotate = async (sessionId: string) => {
    if (!api?.rotateProxySession) return;
    setRotatingId(sessionId);
    try {
      const res = await api.rotateProxySession(sessionId);
      if (res.success) {
        showToast({ type: 'success', title: `Session rotated! New IP: ${res.newIp || 'Allocated'}` });
        await fetchProxies();
        await loadData();
      } else {
        showToast({ type: 'error', title: res.errorMessage || 'Failed to rotate session' });
      }
    } catch (err: any) {
      showToast({ type: 'error', title: `Rotation error: ${err.message}` });
    } finally {
      setRotatingId(null);
    }
  };

  const handleRelease = async (sessionId: string) => {
    if (!api?.releaseProxySession) return;
    setRevokingId(sessionId);
    try {
      await api.releaseProxySession(sessionId);
      showToast({ type: 'info', title: 'Proxy session revoked and removed.' });
      await fetchProxies();
      await loadData();
    } catch (err: any) {
      showToast({ type: 'error', title: `Failed to revoke session: ${err.message}` });
    } finally {
      setRevokingId(null);
    }
  };

  const selectedProviderObj = providers.find((p) => p.id === selectedProviderId);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quota Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent border border-teal-500/20 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Commercial Proxy Catalog</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                Multi-Provider Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Instantly allocate residential, mobile, and datacenter IPs from Tier-1 providers. Automatically normalized into isolated anti-detect profiles with zero credential leakage.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-500 hover:text-slate-700"
            title="Refresh Catalog & Quotas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Quota & Health Tile */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Sessions</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {sessions.filter((s) => s.status === 'ACTIVE').length} Live
            </span>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-[11px] text-slate-500 font-medium mb-1">
              <span>Traffic Allocation</span>
              <span>
                {usage ? `${((usage.bytesUsed || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB / ${((usage.bytesLimit || 53687091200) / (1024 * 1024 * 1024)).toFixed(0)} GB` : '50 GB Available'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, usage && usage.bytesLimit ? ((usage.bytesUsed || 0) / usage.bytesLimit) * 100 : 2)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Generator Configuration Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-teal-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Allocate Fresh Proxy Session</h3>
          </div>
          {selectedProviderObj && (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Provider Status:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  selectedProviderObj.status === 'HEALTHY'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : selectedProviderObj.status === 'UNCONFIGURED'
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                }`}
              >
                {selectedProviderObj.status}
              </span>
            </div>
          )}
        </div>

        {/* 1. Network Type Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Proxy Network Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { type: 'RESIDENTIAL', label: 'Residential', icon: Home, desc: 'Real peer residential IPs' },
              { type: 'MOBILE', label: 'Mobile 4G/5G', icon: Smartphone, desc: 'Highest trust mobile pool' },
              { type: 'DATACENTER', label: 'Datacenter', icon: Server, desc: 'Ultra-low latency server IPs' },
              { type: 'ISP', label: 'Static ISP', icon: Shield, desc: 'Static residential ISP lines' },
            ].map(({ type, label, icon: Icon, desc }) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedNetworkType(type as ProxyNetworkType)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedNetworkType === type
                    ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 ring-1 ring-teal-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className={`w-4 h-4 ${selectedNetworkType === type ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-bold ${selectedNetworkType === type ? 'text-teal-900 dark:text-teal-200' : 'text-slate-700 dark:text-slate-300'}`}>
                    {label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Provider & Geo Targeting Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Provider Source
            </label>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            >
              <option value="auto">Auto-Select (Lowest Latency & Optimal Tier)</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isConfigured ? '✓' : '(Needs Key)'}
                </option>
              ))}
            </select>
          </div>

          {/* Country Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Country Location
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedCity('');
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* City Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              City Targeting {availableCities.length > 0 ? `(${availableCities.length} available)` : ''}
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={availableCities.length === 0}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500 disabled:opacity-50"
            >
              <option value="">Any City / Nationwide Pool</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Session Mode & TTL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Session Persistence
            </label>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setSelectedSessionType('STICKY')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  selectedSessionType === 'STICKY'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sticky Session
              </button>
              <button
                type="button"
                onClick={() => setSelectedSessionType('ROTATING')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  selectedSessionType === 'ROTATING'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Rotating IP
              </button>
            </div>
          </div>

          {selectedSessionType === 'STICKY' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Sticky Duration (TTL)
              </label>
              <select
                value={selectedTtl}
                onChange={(e) => setSelectedTtl(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value={10}>10 Minutes</option>
                <option value={30}>30 Minutes (Recommended)</option>
                <option value={60}>60 Minutes</option>
                <option value={120}>2 Hours</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Auto-Assign to Profile (Optional)
            </label>
            <select
              value={targetProfileId}
              onChange={(e) => setTargetProfileId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            >
              <option value="">Do not assign yet (Save to library)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all disabled:opacity-50"
          >
            {generating ? 'Allocating...' : 'Generate to Proxy List'}
          </button>

          {targetProfileId && (
            <button
              type="button"
              onClick={() => handleGenerate(true)}
              disabled={generating}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-sm shadow-teal-600/20 flex items-center space-x-1.5 active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generating ? 'Binding...' : 'Generate & Assign to Profile'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Commercial Sessions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-teal-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Commercial Sessions</h3>
          </div>
          <span className="text-xs text-slate-400">
            {sessions.length} total generated session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Globe2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No active sessions</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Select your desired country and proxy category above, then click Generate to create an encrypted session.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Provider / Type</th>
                  <th className="py-3 px-4">Session Mode</th>
                  <th className="py-3 px-4">Rotations</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <CountryFlag countryCode={s.country} className="w-4 h-3 rounded-xs shadow-xs" />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {s.country} {s.city ? `· ${s.city}` : ''}
                          </div>
                          <div className="text-[10px] text-slate-400">{s.sessionId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{s.providerId.toUpperCase()}</span>
                      <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">{s.networkType}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium">{s.sessionType}</span>
                      {s.ttlMinutes && <div className="text-[10px] text-slate-400">{s.ttlMinutes}m TTL</div>}
                    </td>
                    <td className="py-3.5 px-4 font-semibold">{s.rotationCount}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {s.rotatable && s.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleRotate(s.id)}
                            disabled={rotatingId === s.id}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-teal-600 hover:border-teal-500 transition-all"
                            title="Rotate to new IP address"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${rotatingId === s.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        <button
                          onClick={() => handleRelease(s.id)}
                          disabled={revokingId === s.id}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-rose-600 hover:border-rose-500 transition-all"
                          title="Revoke session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
