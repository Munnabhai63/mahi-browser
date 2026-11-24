import React, { useState } from 'react';
import {
  Globe2,
  Shield,
  Layers,
  Key,
  CreditCard,
  Plus,
  Search,
} from 'lucide-react';

export const WebApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PROFILES' | 'PROXIES' | 'TEAM' | 'API' | 'BILLING'>('PROFILES');

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Web Portal Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide">MAHI CLOUD</h1>
              <span className="text-[10px] text-teal-400 font-mono">Web Portal V2</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('PROFILES')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'PROFILES'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Globe2 className="w-4 h-4" />
              <span>Browser Profiles</span>
            </button>

            <button
              onClick={() => setActiveTab('PROXIES')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'PROXIES'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Proxy Inventory</span>
            </button>

            <button
              onClick={() => setActiveTab('TEAM')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'TEAM'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Team Workspaces</span>
            </button>

            <button
              onClick={() => setActiveTab('API')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'API'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Developer API</span>
            </button>

            <button
              onClick={() => setActiveTab('BILLING')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'BILLING'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Plans & Billing</span>
            </button>
          </nav>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between font-bold text-slate-300">
            <span>Cloud Plan</span>
            <span className="text-teal-400">PRO TIER</span>
          </div>
          <p className="text-[10px] text-slate-500">Connected to Central API</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
        {/* PROFILES TAB */}
        {activeTab === 'PROFILES' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Cloud Profile Manager</h2>
                <p className="text-xs text-slate-400">Manage profile metadata and synchronize state with your desktop client.</p>
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Cloud Profile</span>
              </button>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search cloud profiles by name, tag, or folder..."
                  className="w-full bg-transparent text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* DEVELOPER API TAB */}
        {activeTab === 'API' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Developer API & Webhooks</h2>
              <p className="text-xs text-slate-400">Programmatic REST API for automated profile management.</p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 max-w-2xl">
              <h4 className="text-sm font-bold text-slate-200">API Documentation & Endpoints</h4>
              <p className="text-xs text-slate-400">
                Authenticate your requests by providing your secret API key via the <code className="text-teal-400">X-API-Key</code> or <code className="text-teal-400">Authorization: Bearer &lt;key&gt;</code> header.
              </p>

              <div className="space-y-2 font-mono text-xs text-slate-300">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span><strong className="text-emerald-400">GET</strong> /api/v2/profiles</span>
                  <span className="text-[10px] text-slate-500">List all profiles</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span><strong className="text-cyan-400">POST</strong> /api/v2/profiles/:id/start</span>
                  <span className="text-[10px] text-slate-500">Launch browser</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span><strong className="text-rose-400">POST</strong> /api/v2/profiles/:id/stop</span>
                  <span className="text-[10px] text-slate-500">Close browser</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BILLING TAB */}
        {activeTab === 'BILLING' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Subscription & Plan Limits</h2>
              <p className="text-xs text-slate-400">Your current plan quotas and enterprise license state.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Current Tier</span>
                <h3 className="text-2xl font-bold text-teal-400">MAHI Pro Lifetime</h3>
                <p className="text-xs text-slate-400">Unlimited profiles, multi-window synchronizer, and proxy tunneling active.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
