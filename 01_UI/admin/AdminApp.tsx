import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Layers,
  Monitor,
  Activity,
  Key,
  Sliders,
  Settings,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Cpu,
  HardDrive,
  Globe2,
} from 'lucide-react';
import { FeatureFlagDefinition, DeviceRecord, FleetTelemetry, PlanTierId } from '../../10_CONFIG/shared/types/platform.js';

type AdminTab = 'OVERVIEW' | 'FLEET' | 'FEATURE_FLAGS' | 'PRICING' | 'SETTINGS';

export const AdminApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
  const [telemetry, setTelemetry] = useState<FleetTelemetry | null>(null);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [flags, setFlags] = useState<FeatureFlagDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.mahiAPI) {
        const [tel, dev, flg] = await Promise.all([
          window.mahiAPI.getFleetTelemetry(),
          window.mahiAPI.getFleetDevices(),
          window.mahiAPI.getFeatureFlags(),
        ]);
        setTelemetry(tel);
        setDevices(dev);
        setFlags(flg);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleFlag = async (flag: FeatureFlagDefinition) => {
    if (!window.mahiAPI) return;
    await window.mahiAPI.updateFeatureFlag(flag.key, {
      enabledGlobal: !flag.enabledGlobal,
    });
    loadData();
  };

  const handleKillSwitch = async (flag: FeatureFlagDefinition) => {
    if (!window.mahiAPI) return;
    await window.mahiAPI.updateFeatureFlag(flag.key, {
      killSwitchActive: !flag.killSwitchActive,
    });
    loadData();
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!window.mahiAPI) return;
    await window.mahiAPI.revokeDevice(deviceId);
    loadData();
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide">MAHI ADMIN</h1>
              <span className="text-[10px] text-teal-400 font-mono">Control Center V2</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'OVERVIEW'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Platform Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('FLEET')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'FLEET'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Fleet & Devices</span>
            </button>

            <button
              onClick={() => setActiveTab('FEATURE_FLAGS')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'FEATURE_FLAGS'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Feature Flags</span>
            </button>

            <button
              onClick={() => setActiveTab('PRICING')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'PRICING'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Pricing & Plans</span>
            </button>

            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'SETTINGS'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>System Settings</span>
            </button>
          </nav>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center justify-between font-bold text-slate-300">
            <span>Admin Authority</span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
          <p className="text-[10px] mt-1 text-slate-500">Node.js 20 • Electron 33</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Platform Status & Telemetry</h2>
                <p className="text-xs text-slate-400">Live operational metrics from MAHI Platform V2.</p>
              </div>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Telemetry</span>
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Active Browser Sessions</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  {telemetry?.activeProfilesCount || 0}
                </div>
                <span className="text-[10px] text-slate-500">Live Chromium instances</span>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Fleet CPU Load</span>
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-cyan-400 font-mono">
                  {telemetry?.cpuUsagePercent || 0}%
                </div>
                <span className="text-[10px] text-slate-500">Hardware utilization</span>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Memory Usage</span>
                  <HardDrive className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-400 font-mono">
                  {telemetry?.memoryUsageMb || 0} MB
                </div>
                <span className="text-[10px] text-slate-500">RAM assigned</span>
              </div>

              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Registered Devices</span>
                  <Monitor className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {devices.length}
                </div>
                <span className="text-[10px] text-slate-500">Total authorized nodes</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FLEET & DEVICES */}
        {activeTab === 'FLEET' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Fleet Device Registry</h2>
              <p className="text-xs text-slate-400">All registered devices and authorization status.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-4">Device Name</th>
                    <th className="p-4">OS & Arch</th>
                    <th className="p-4">Client Version</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Seen</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30">
                      <td className="p-4 font-bold text-slate-200">{d.deviceName}</td>
                      <td className="p-4 text-slate-400 font-mono">{d.os}</td>
                      <td className="p-4 text-slate-400">v{d.clientVersion}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{new Date(d.lastSeenAt).toLocaleString()}</td>
                      <td className="p-4 text-right">
                        {d.status !== 'REVOKED' && (
                          <button
                            onClick={() => handleRevokeDevice(d.deviceId)}
                            className="px-3 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-bold rounded-lg transition-all"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: FEATURE FLAGS */}
        {activeTab === 'FEATURE_FLAGS' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Central Feature Flags & Kill Switches</h2>
              <p className="text-xs text-slate-400">Control feature rollout and trigger instant emergency shut-offs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {flags.map((flag) => (
                <div
                  key={flag.key}
                  className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-200">{flag.name}</h4>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-teal-400">
                        {flag.minPlanTier}+
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{flag.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <button
                      onClick={() => handleToggleFlag(flag)}
                      className="flex items-center space-x-2 text-xs font-semibold text-slate-300"
                    >
                      {flag.enabledGlobal ? (
                        <ToggleRight className="w-6 h-6 text-teal-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-500" />
                      )}
                      <span>{flag.enabledGlobal ? 'Enabled Globally' : 'Disabled'}</span>
                    </button>

                    <button
                      onClick={() => handleKillSwitch(flag)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        flag.killSwitchActive
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                      }`}
                    >
                      {flag.killSwitchActive ? '🚨 KILL SWITCH ENGAGED' : 'Kill Switch'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PRICING */}
        {activeTab === 'PRICING' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Canonical Plans & Pricing Versioning</h2>
                <p className="text-xs text-slate-400">Manage plan tiers, prices, annual discounts, and entitlement quotas from one central location.</p>
              </div>
              <a
                href="http://127.0.0.1:32123/admin"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2"
              >
                <span>Open Full Web Admin Suite</span>
                <Globe2 className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Professional 10', id: 'pro_10', profiles: 10, monthly: 599, annual: 299, desc: 'Starter anti-detect profiles' },
                { name: 'Professional 25', id: 'pro_25', profiles: 25, monthly: 1499, annual: 749, desc: 'Includes 2GB proxy & sharing' },
                { name: 'Professional 50', id: 'pro_50', profiles: 50, monthly: 2999, annual: 1499, desc: 'Cloud Browser & cookie import (Popular)' },
                { name: 'Professional 100', id: 'pro_100', profiles: 100, monthly: 5999, annual: 2999, desc: 'Synchronizer, Cookie Bot & API' },
                { name: 'Team 50', id: 'team_50', profiles: 50, monthly: 2999, annual: 1499, desc: '2 seats, team folders' },
                { name: 'Team 100', id: 'team_100', profiles: 100, monthly: 3999, annual: 1999, desc: '5 seats, RBAC & Visual RPA' },
                { name: 'Team 200', id: 'team_200', profiles: 200, monthly: 4999, annual: 2499, desc: '8 seats, multi-sync & ADB rotator' },
                { name: 'Team 300', id: 'team_300', profiles: 300, monthly: 5999, annual: 2999, desc: 'Unlimited seats, Headless CDP & SLA' },
              ].map(plan => (
                <div key={plan.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{plan.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">{plan.id}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{plan.desc}</p>
                    <div className="mt-4 flex items-baseline space-x-1 font-mono">
                      <span className="text-2xl font-black text-emerald-400">₹{plan.monthly}</span>
                      <span className="text-xs text-slate-400">/mo</span>
                      <span className="text-[11px] text-teal-400 font-bold ml-2">(₹{plan.annual} annual)</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Profiles Limit: <b className="text-white font-mono">{plan.profiles}</b></span>
                    <span className="text-emerald-400 font-bold">Separated from price ✓</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Platform Settings & Branding</h2>
              <p className="text-xs text-slate-400">Global configuration parameters for MAHI Platform V2.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Platform Name</label>
                <input
                  type="text"
                  defaultValue="MAHI BROWSER ENTERPRISE"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Central API Base URL</label>
                <input
                  type="text"
                  defaultValue="http://127.0.0.1:32123/api/v2"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-teal-400"
                />
              </div>

              <button
                type="button"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
