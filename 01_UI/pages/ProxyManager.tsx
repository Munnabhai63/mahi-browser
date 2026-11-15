import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Activity,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Search,
  Sparkles,
  Globe2,
  Clipboard,
} from 'lucide-react';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { ProxyItem, CreateProxyDTO, ProxyProtocol } from '../../10_CONFIG/shared/types/proxy.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { NavigationPage } from '../components/Sidebar.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { ProxyCatalogSection } from '../components/ProxyCatalogSection.js';

interface ProxyManagerProps {
  onNavigate: (page: NavigationPage) => void;
}

export const ProxyManagerPage: React.FC<ProxyManagerProps> = ({ onNavigate }) => {
  const { proxies, fetchProxies, createProxy, updateProxy, deleteProxy, testProxy } = useProxyStore();
  const { profiles, fetchProfiles } = useProfileStore();

  const [activeTab, setActiveTab] = useState<'byop' | 'catalog'>('byop');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<ProxyItem | null>(null);
  const [deleteTargetProxy, setDeleteTargetProxy] = useState<ProxyItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isTestingAll, setIsTestingAll] = useState<boolean>(false);

  // Form Fields
  const [rawInput, setRawInput] = useState('');
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<ProxyProtocol>('http');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(8080);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [countryRegion, setCountryRegion] = useState('');
  const [notes, setNotes] = useState('');

  // Smart Parser for all proxy string formats
  const handleSmartParse = (text: string) => {
    setRawInput(text);
    let s = text.trim().replace(/^["']|["']$/g, '');
    if (!s) return;

    // Check protocol prefix
    const protoMatch = s.match(/^(https?|socks[45]?):\/\//i);
    if (protoMatch) {
      const p = protoMatch[1].toLowerCase();
      if (p === 'http' || p === 'https' || p === 'socks5') {
        setProtocol(p as ProxyProtocol);
      }
      s = s.slice(protoMatch[0].length);
    }

    // Check user:pass@host:port
    const atIdx = s.indexOf('@');
    if (atIdx > 0) {
      const creds = s.slice(0, atIdx);
      s = s.slice(atIdx + 1);
      const [u, ...pParts] = creds.split(':');
      setUsername(u || '');
      setPassword(pParts.join(':') || '');
    }

    // Parse host:port or host:port:user:pass
    const parts = s.split(':');
    if (parts.length >= 2) {
      const parsedHost = parts[0].trim();
      setHost(parsedHost);
      const pNum = parseInt(parts[1].trim(), 10);
      if (!isNaN(pNum)) setPort(pNum);

      // host:port:user:pass
      if (parts.length >= 4 && atIdx === -1) {
        setUsername(parts[2].trim());
        setPassword(parts.slice(3).join(':').trim());
      }

      if (!name) {
        setName(`Proxy ${parsedHost}:${parts[1].trim()}`);
      }
    }
  };

  useEffect(() => {
    fetchProxies();
    fetchProfiles();
  }, []);

  const handleOpenAdd = () => {
    setEditingProxy(null);
    setRawInput('');
    setName('');
    setProtocol('http');
    setHost('');
    setPort(8080);
    setUsername('');
    setPassword('');
    setCountryRegion('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ProxyItem) => {
    setEditingProxy(p);
    setRawInput(`${p.protocol}://${p.host}:${p.port}`);
    setName(p.name);
    setProtocol(p.protocol);
    setHost(p.host);
    setPort(p.port);
    setUsername(p.username || '');
    setPassword('');
    setCountryRegion(p.countryRegion || '');
    setNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !host || !port) return;

    if (editingProxy) {
      await updateProxy(editingProxy.id, {
        name,
        protocol,
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        countryRegion: countryRegion || undefined,
        notes: notes || undefined,
      });
    } else {
      await createProxy({
        name,
        protocol,
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        countryRegion: countryRegion || undefined,
        notes: notes || undefined,
      });
    }
    setIsModalOpen(false);
  };

  const handleTestProxy = async (p: ProxyItem) => {
    setTestingId(p.id);
    await testProxy({
      proxyId: p.id,
      protocol: p.protocol,
      host: p.host,
      port: p.port,
      username: p.username,
    });
    setTestingId(null);
  };

  const handleTestAll = async () => {
    if (isTestingAll || proxies.length === 0) return;
    setIsTestingAll(true);
    for (const p of proxies) {
      setTestingId(p.id);
      await testProxy({
        proxyId: p.id,
        protocol: p.protocol,
        host: p.host,
        port: p.port,
        username: p.username,
      });
    }
    setTestingId(null);
    setIsTestingAll(false);
  };

  const filteredProxies = proxies.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.protocol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.countryRegion && p.countryRegion.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8 space-y-5 max-w-7xl mx-auto h-full flex flex-col justify-between overflow-y-auto font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Proxy Manager</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Encrypted Tunnel Hub
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage encrypted HTTP, HTTPS, and SOCKS5 proxy endpoints for isolated profiles
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'byop' && (
            <>
              {proxies.length > 0 && (
                <button
                  onClick={handleTestAll}
                  disabled={isTestingAll}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all disabled:opacity-50"
                  title="Ping and benchmark latency for all proxies in list"
                >
                  <Activity className={`w-3.5 h-3.5 text-teal-500 ${isTestingAll ? 'animate-spin' : ''}`} />
                  <span>{isTestingAll ? 'Pinging All...' : 'Ping All Proxies'}</span>
                </button>
              )}

              <button
                onClick={handleOpenAdd}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-sm shadow-teal-600/20 flex items-center space-x-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Proxy</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('byop')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'byop'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Custom Proxies (BYOP)</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-200 dark:bg-slate-200 dark:text-slate-800">
            {proxies.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'catalog'
              ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
              : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Proxy Catalog (Built-in Providers)</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-400/20 text-amber-500 border border-amber-400/30">
            NEW
          </span>
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <ProxyCatalogSection />
      ) : (
        <>
          {/* Search & Summary Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter proxies by name, host, or country..."
                className="w-full pl-9 pr-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500 shadow-xs"
              />
            </div>

            {proxies.length > 0 && (
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Total: {proxies.length}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Connected: {proxies.filter((p) => p.status === 'CONNECTED').length}
                </span>
                {proxies.some((p) => p.status === 'FAILED') && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Failed: {proxies.filter((p) => p.status === 'FAILED').length}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Proxies Table */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {filteredProxies.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">No Proxies Added</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">Add your HTTP, HTTPS, or SOCKS5 proxies to assign them to browser profiles.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Add First Proxy
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/60 select-none">
                <th className="py-3 px-4 font-normal">Proxy Name</th>
                <th className="py-3 px-4 font-normal">Protocol & Host</th>
                <th className="py-3 px-4 font-normal">Port</th>
                <th className="py-3 px-4 font-normal">Auth</th>
                <th className="py-3 px-4 font-normal">Status & Latency</th>
                <th className="py-3 px-4 font-normal">Profiles</th>
                <th className="py-3 px-4 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredProxies.map((pr) => {
                const isTesting = testingId === pr.id;
                return (
                  <tr key={pr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <CountryFlag countryCode={pr.countryRegion} className="w-4 h-3 rounded-xs shrink-0 shadow-xs" />
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-100">{pr.name}</span>
                          {pr.countryRegion && (
                            <span className="ml-1.5 text-[10px] font-mono text-slate-400 uppercase">{pr.countryRegion}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-teal-600 dark:text-teal-400 uppercase font-semibold text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 mr-2">
                        {pr.protocol}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-mono">{pr.host}</span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{pr.port}</td>

                    <td className="py-3 px-4 text-slate-500">
                      {pr.hasPassword ? 'Encrypted Creds' : pr.username ? `User: ${pr.username}` : 'None'}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {pr.status === 'CONNECTED' ? (
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            (pr.latencyMs ?? 0) <= 250
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : (pr.latencyMs ?? 0) <= 600
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              (pr.latencyMs ?? 0) <= 250
                                ? 'bg-emerald-500 animate-pulse'
                                : (pr.latencyMs ?? 0) <= 600
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}></span>
                            <span>{pr.latencyMs !== undefined ? `${pr.latencyMs}ms` : 'Connected'}</span>
                          </span>
                        ) : pr.status === 'FAILED' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Failed {pr.latencyMs !== undefined ? `(${pr.latencyMs}ms)` : ''}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Untested</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                        {pr.assignedProfileCount || 0}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleTestProxy(pr)}
                          disabled={isTesting}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1 transition active:scale-95 disabled:opacity-50"
                        >
                          <Activity className={`w-3 h-3 text-teal-500 ${isTesting ? 'animate-spin' : ''}`} />
                          <span>{isTesting ? 'Testing...' : 'Ping'}</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(pr)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Edit Proxy"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTargetProxy(pr)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                          title="Delete Proxy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}

      {/* Add / Edit Proxy Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {editingProxy ? 'Edit Proxy' : 'Add Proxy Endpoint'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">
              Credentials are encrypted at rest with AES-256-GCM.
            </p>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              {/* Quick Smart Parse Input Bar */}
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-500" />
                    <span>Quick Smart Parse</span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const txt = await navigator.clipboard.readText();
                        if (txt) handleSmartParse(txt);
                      } catch {
                        // ignore clipboard read failure
                      }
                    }}
                    className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Clipboard className="w-2.5 h-2.5" />
                    <span>Paste Clipboard</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={rawInput}
                  onChange={(e) => handleSmartParse(e.target.value)}
                  placeholder="Paste ip:port:user:pass or protocol://user:pass@host:port..."
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Proxy Label Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. US Residential 01"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Protocol</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Host / IP</label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1 or proxy.example.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Optional username"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingProxy && editingProxy.hasPassword ? 'Leave blank to keep current' : 'Optional password'}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-sm"
                >
                  Save Proxy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetProxy)}
        title="Delete Proxy"
        message={`Are you sure you want to remove proxy "${deleteTargetProxy?.name}"? Any profiles assigned to this proxy will revert to direct connection.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTargetProxy) {
            await deleteProxy(deleteTargetProxy.id);
            setDeleteTargetProxy(null);
          }
        }}
        onCancel={() => setDeleteTargetProxy(null)}
      />
    </div>
  );
};
