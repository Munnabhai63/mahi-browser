import React from 'react';
import {
  Globe2,
  Lock,
  Layers,
  Shield,
  Key,
  Webhook,
  Activity,
  Plus,
  ArrowRight,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { WebTab } from '../components/WebDashboardLayout.js';
import { APP_VERSION } from '../../../10_CONFIG/shared/version.js';

interface OverviewPageProps {
  metrics: {
    totalProfiles: number;
    lockedProfiles: number;
    syncedProfiles: number;
    workspaceCount: number;
    activeProxies: number;
    apiKeysCount: number;
    webhookEndpointsCount: number;
    activeDevicesCount: number;
  };
  onNavigate: (tab: WebTab) => void;
  onOpenCreateProfile: () => void;
  onOpenCreateWorkspace: () => void;
  isDesktopOnline: boolean;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  metrics,
  onNavigate,
  onOpenCreateProfile,
  onOpenCreateWorkspace,
  isDesktopOnline,
}) => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="p-6 bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/20 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Central Management Fleet
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Cloud Environment Overview</h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Monitor browser profile states, zero-knowledge sync, team workspaces, proxy pipelines, and developer webhooks across your organization.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCreateProfile}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Profile</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Profiles */}
        <div
          onClick={() => onNavigate('profiles')}
          className="p-4 bg-[#0c1222] border border-slate-800 hover:border-teal-500/40 rounded-2xl cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Total Profiles</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Globe2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.totalProfiles}</div>
          <div className="text-[10px] text-teal-400 flex items-center space-x-1">
            <span>{metrics.syncedProfiles} Cloud Synced</span>
          </div>
        </div>

        {/* Locked / Running */}
        <div
          onClick={() => onNavigate('profiles')}
          className="p-4 bg-[#0c1222] border border-slate-800 hover:border-amber-500/40 rounded-2xl cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Locked / Running</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.lockedProfiles}</div>
          <div className="text-[10px] text-amber-400">
            {metrics.lockedProfiles > 0 ? 'Active distributed locks' : 'No active session locks'}
          </div>
        </div>

        {/* Team Workspaces */}
        <div
          onClick={() => onNavigate('workspaces')}
          className="p-4 bg-[#0c1222] border border-slate-800 hover:border-cyan-500/40 rounded-2xl cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Workspaces</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.workspaceCount}</div>
          <div className="text-[10px] text-cyan-400">RBAC Team Domains</div>
        </div>

        {/* Commercial Proxies */}
        <div
          onClick={() => onNavigate('proxies')}
          className="p-4 bg-[#0c1222] border border-slate-800 hover:border-emerald-500/40 rounded-2xl cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Active Proxies</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics.activeProxies}</div>
          <div className="text-[10px] text-emerald-400">Catalog Allocated</div>
        </div>
      </div>

      {/* Secondary Metrics / Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Developer Integration Card */}
        <div className="p-5 bg-[#0c1222] border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Key className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-200">Developer Platform</h3>
            </div>
            <button
              onClick={() => onNavigate('developer')}
              className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center space-x-1"
            >
              <span>Manage</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Active API Keys</div>
              <div className="text-lg font-bold text-white font-mono">{metrics.apiKeysCount}</div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Webhooks</div>
              <div className="text-lg font-bold text-white font-mono">{metrics.webhookEndpointsCount}</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            REST API v1 and HMAC-signed webhook delivery for headless CI/CD orchestration.
          </p>
        </div>

        {/* Desktop Client Connectivity & Version */}
        <div className="p-5 bg-[#0c1222] border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Laptop className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-200">Desktop Client Status</h3>
            </div>
            <button
              onClick={() => onNavigate('devices')}
              className="text-teal-400 hover:text-teal-300 text-xs flex items-center space-x-1"
            >
              <span>Devices</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-200">Registered Sessions</div>
              <div className="text-[10px] text-slate-400">
                {metrics.activeDevicesCount} device session{metrics.activeDevicesCount === 1 ? '' : 's'} registered
              </div>
            </div>
            <div
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                isDesktopOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isDesktopOnline ? 'ONLINE' : 'AGENT REQUIRED'}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Latest Windows Build</span>
            <span className="font-mono text-teal-400 font-bold">v{APP_VERSION} (Phase 4 Auto-Updater)</span>
          </div>
        </div>

        {/* Security & Zero-Knowledge Sync */}
        <div className="p-5 bg-[#0c1222] border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-200">Zero-Knowledge Cloud Sync</h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              AES-256-GCM
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            All browser cookies, extensions, and local storage state are encrypted client-side using PBKDF2 before cloud synchronization. Cloud servers never hold encryption keys.
          </p>
          <div className="pt-1 flex items-center justify-between text-xs text-slate-300">
            <span>Synchronized Profiles:</span>
            <span className="font-bold text-white font-mono">{metrics.syncedProfiles} / {metrics.totalProfiles}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
