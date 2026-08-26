import React, { useState, useEffect, useRef } from 'react';
import { Search, Layers, Shield, PlaySquare, Play, Square, X, ArrowRight } from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useAutomationStore } from '../stores/useAutomationStore.js';
import { NavigationPage } from './Sidebar.js';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: NavigationPage) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { profiles, startProfile, stopProfile, setSelectedProfileId } = useProfileStore();
  const { proxies } = useProxyStore();
  const { workflows } = useAutomationStore();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredProfiles = profiles
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())) ||
        p.folder.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5);

  const filteredProxies = proxies
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.host.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 3);

  const filteredWorkflows = workflows
    .filter((w) => w.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 3);

  const totalResults = filteredProfiles.length + filteredProxies.length + filteredWorkflows.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalResults));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(1, totalResults)) % Math.max(1, totalResults));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/60 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-teal-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search profiles, proxies, workflows (Ctrl+K)..."
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm"
          />
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Profiles */}
          {filteredProfiles.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Profiles</div>
              <div className="space-y-1 mt-1">
                {filteredProfiles.map((p) => {
                  const isRunning = p.status === 'RUNNING' || p.status === 'STARTING';
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProfileId(p.id);
                        onNavigate('profile-settings');
                        onClose();
                      }}
                      className="group px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-teal-500">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            Folder: {p.folder} {p.tags.length > 0 && `• ${p.tags.join(', ')}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isRunning ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              stopProfile(p.id);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 flex items-center space-x-1"
                          >
                            <Square className="w-3 h-3" />
                            <span>Stop</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startProfile(p.id);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 flex items-center space-x-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>Run</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proxies */}
          {filteredProxies.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Proxies</div>
              <div className="space-y-1 mt-1">
                {filteredProxies.map((pr) => (
                  <div
                    key={pr.id}
                    onClick={() => {
                      onNavigate('proxies');
                      onClose();
                    }}
                    className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-500">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{pr.name}</p>
                        <p className="text-xs text-slate-400">
                          {pr.protocol.toUpperCase()} • {pr.host}:{pr.port}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflows */}
          {filteredWorkflows.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Automation</div>
              <div className="space-y-1 mt-1">
                {filteredWorkflows.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => {
                      onNavigate('automation');
                      onClose();
                    }}
                    className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-md bg-amber-500/10 text-amber-500">
                        <PlaySquare className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{w.name}</p>
                        <p className="text-xs text-slate-400">{w.steps.length} Steps configured</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalResults === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm">
              No matching profiles, proxies, or automation workflows found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Navigate with ↑ / ↓ and Enter</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
