import React from 'react';
import { Search, Plus, Moon, Sun, Monitor, ShieldAlert, ArrowUpRight, FolderPlus } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore.js';
import { NavigationPage } from './Sidebar.js';

interface HeaderProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, onOpenSearch }) => {
  const { theme, setTheme } = useSettingsStore();

  const titles: Record<NavigationPage, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of environments, status, and activity' },
    profiles: { title: 'Browser Profiles', subtitle: 'Manage isolated multi-session environments' },
    diagnostics: { title: 'Stealth & Fingerprint Diagnostics', subtitle: 'Real-time anti-bot leak analysis and 1-click stealth optimization' },
    workspaces: { title: 'Team Workspaces & Roles', subtitle: 'Collaborative multi-user workspaces, member roles, and profile sharing' },
    captcha: { title: 'Automated Captcha Solver', subtitle: 'Multi-provider background bypass for Cloudflare Turnstile, reCAPTCHA & hCaptcha' },
    'trash-bin': { title: 'Trash Bin', subtitle: 'Safely recover deleted profiles within 30 days' },


    'create-profile': { title: 'Create Profile', subtitle: 'Configure new isolated browser environment' },


    'profile-settings': { title: 'Profile Settings', subtitle: 'Fine-tune environment and fingerprint settings' },
    'browser-environment': { title: 'Browser Environment', subtitle: 'Test environment simulator & consistency generator' },
    'mobile-rotator': { title: 'Mobile 4G/5G IP Rotator', subtitle: 'Rotate residential mobile IPs via Android USB Tethering & 4G Dongles' },
    proxies: { title: 'Proxy Manager', subtitle: 'Manage encrypted proxy endpoints and latency' },

    cookies: { title: 'Cookie Manager', subtitle: 'Inspect, import, export, and clear profile cookies' },
    history: { title: 'History Manager', subtitle: 'Search and manage browsing records per profile' },
    extensions: { title: 'Extension Manager', subtitle: 'Install and manage isolated Chrome extensions' },
    automation: { title: 'Automation Workflows', subtitle: 'Automate tasks with Playwright integration' },
    'workflow-builder': { title: 'Workflow Builder', subtitle: 'Visual step-by-step browser automation creator' },
    import: { title: 'Import Profile', subtitle: 'Restore profile from encrypted .mahi-profile archive' },
    export: { title: 'Export Profile', subtitle: 'Create secure encrypted .mahi-profile backup' },
    settings: { title: 'Application Settings', subtitle: 'Configure general, security, and performance rules' },
    license: { title: 'MAHI Pro Licensing', subtitle: 'Manage software activation, license keys, and connected devices' },
    logs: { title: 'Activity Logs', subtitle: 'Real-time security and operational audit trail' },
    help: { title: 'Help & Documentation', subtitle: 'Guides, diagnostics, shortcuts, and limits' },
  };



  const currentInfo = titles[currentPage] || { title: 'MAHI BROWSER', subtitle: '' };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between select-none z-10 transition-colors">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
          {currentInfo.title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {currentInfo.subtitle}
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex items-center space-x-3">
        {/* Global Search Trigger */}
        <button
          onClick={onOpenSearch}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick Search...</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-600 font-mono shadow-xs">
            Ctrl+K
          </kbd>
        </button>

        {/* Import Action */}
        <button
          onClick={() => onNavigate('import')}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors flex items-center space-x-1.5"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>Import</span>
        </button>

        {/* New Profile Primary Button */}
        <button
          onClick={() => onNavigate('create-profile')}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shadow-sm shadow-teal-600/20 transition-all flex items-center space-x-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Profile</span>
        </button>
      </div>
    </header>
  );
};
