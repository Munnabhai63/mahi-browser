import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Play,
  Square,
  Globe2,
  Shield,
  Layers,
  Settings,
  Sparkles,
  Database,
  History,
  Puzzle,
  Bot,
  Activity,
  HardDrive,
  RefreshCw,
  Key,
  X,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useAccountStore } from '../stores/useAccountStore.js';
import { NavigationPage } from './Sidebar.js';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: NavigationPage) => void;
  onOpenCreateProfile: () => void;
  onOpenSynchronizer: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Profiles';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenCreateProfile,
  onOpenSynchronizer,
}) => {
  const { profiles, startProfile, stopProfile, bulkStopProfiles } = useProfileStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build command list
  const baseCommands: CommandItem[] = [
    {
      id: 'act-new-profile',
      title: 'Create New Profile',
      category: 'Actions',
      icon: <Plus className="w-4 h-4 text-teal-500" />,
      shortcut: 'Ctrl + N',
      action: () => {
        onClose();
        onOpenCreateProfile();
      },
    },
    {
      id: 'act-synchronizer',
      title: 'Open Multi-Window Synchronizer',
      category: 'Actions',
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      action: () => {
        onClose();
        onOpenSynchronizer();
      },
    },
    {
      id: 'act-stop-all',
      title: 'Stop All Running Browsers',
      category: 'Actions',
      icon: <Square className="w-4 h-4 text-rose-500" />,
      action: () => {
        const runningIds = profiles.filter((p) => p.status === 'RUNNING').map((p) => p.id);
        if (runningIds.length > 0) {
          bulkStopProfiles(runningIds);
        }
        onClose();
      },
    },
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      category: 'Navigation',
      icon: <Layers className="w-4 h-4 text-cyan-500" />,
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-profiles',
      title: 'Go to Profiles List',
      category: 'Navigation',
      icon: <Globe2 className="w-4 h-4 text-teal-500" />,
      shortcut: 'Ctrl + P',
      action: () => {
        onNavigate('profiles');
        onClose();
      },
    },
    {
      id: 'nav-workspaces',
      title: 'Go to Team Workspaces',
      category: 'Navigation',
      icon: <Layers className="w-4 h-4 text-blue-500" />,
      action: () => {
        onNavigate('workspaces');
        onClose();
      },
    },
    {
      id: 'nav-proxies',
      title: 'Go to Proxy Manager',
      category: 'Navigation',
      icon: <Shield className="w-4 h-4 text-indigo-500" />,
      action: () => {
        onNavigate('proxies');
        onClose();
      },
    },
    {
      id: 'nav-cookies',
      title: 'Go to Cookie Manager',
      category: 'Navigation',
      icon: <Database className="w-4 h-4 text-amber-500" />,
      action: () => {
        onNavigate('cookies');
        onClose();
      },
    },
    {
      id: 'nav-history',
      title: 'Go to History Manager',
      category: 'Navigation',
      icon: <History className="w-4 h-4 text-slate-400" />,
      action: () => {
        onNavigate('history');
        onClose();
      },
    },
    {
      id: 'nav-extensions',
      title: 'Go to Extension Manager',
      category: 'Navigation',
      icon: <Puzzle className="w-4 h-4 text-pink-500" />,
      action: () => {
        onNavigate('extensions');
        onClose();
      },
    },
    {
      id: 'nav-automation',
      title: 'Go to Automation Studio',
      category: 'Navigation',
      icon: <Bot className="w-4 h-4 text-purple-500" />,
      action: () => {
        onNavigate('automation');
        onClose();
      },
    },
    {
      id: 'nav-license',
      title: 'Open Account & Plan Limits (PRO)',
      category: 'Navigation',
      icon: <Key className="w-4 h-4 text-emerald-500" />,
      action: () => {
        useAccountStore.getState().openAccountModal('PRO');
        onClose();
      },
    },
    {
      id: 'nav-diagnostics',
      title: 'Go to Diagnostics & System Health',
      category: 'Navigation',
      icon: <Activity className="w-4 h-4 text-emerald-500" />,
      action: () => {
        onNavigate('diagnostics');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      category: 'Navigation',
      icon: <Settings className="w-4 h-4 text-slate-400" />,
      shortcut: 'Ctrl + ,',
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
  ];

  // Dynamic Profile items
  const profileCommands: CommandItem[] = profiles.slice(0, 15).map((p) => ({
    id: `prof-${p.id}`,
    title: `${p.name} (${p.folder})`,
    category: 'Profiles',
    icon: p.status === 'RUNNING' ? <Play className="w-4 h-4 text-emerald-500" /> : <Globe2 className="w-4 h-4 text-slate-400" />,
    shortcut: p.status === 'RUNNING' ? 'Running' : 'Stopped',
    action: () => {
      if (p.status === 'RUNNING') {
        stopProfile(p.id);
      } else {
        startProfile(p.id);
      }
      onClose();
    },
  }));

  const allCommands = [...baseCommands, ...profileCommands];

  const filteredCommands = allCommands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-start justify-center pt-24 p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100 flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search profiles... (Esc to exit)"
            className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
          />
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
            Ctrl + K
          </span>
        </div>

        {/* Command List */}
        <div className="p-2 overflow-y-auto space-y-1 custom-scrollbar flex-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching commands or profiles found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="shrink-0">{cmd.icon}</div>
                    <span className="truncate">{cmd.title}</span>
                    <span className="text-[10px] font-normal text-slate-400 opacity-60">
                      [{cmd.category}]
                    </span>
                  </div>

                  {cmd.shortcut && (
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="font-bold text-teal-500">MAHI V2 Quick Commands</span>
        </div>
      </div>
    </div>
  );
};
