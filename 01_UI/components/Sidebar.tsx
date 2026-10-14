import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  Shield,
  Puzzle,
  PlaySquare,
  Settings,
  ScrollText,
  HelpCircle,
  Lock,
  Globe2,
  Sliders,
  ShieldCheck,
  Smartphone,
  Trash2,
  Activity,
  Bot,
  Users,
  Share2,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useSettingsStore } from '../stores/useSettingsStore.js';
import { useAccountStore } from '../stores/useAccountStore.js';
import { AccountDropdown } from './AccountDropdown.js';
import { UpgradeModal } from './UpgradeModal.js';

export type NavigationPage =
  | 'dashboard'
  | 'profiles'
  | 'diagnostics'
  | 'workspaces'
  | 'captcha'
  | 'trash-bin'
  | 'create-profile'
  | 'profile-settings'
  | 'browser-environment'
  | 'mobile-rotator'
  | 'proxies'
  | 'cookies'
  | 'history'
  | 'extensions'
  | 'automation'
  | 'workflow-builder'
  | 'import'
  | 'export'
  | 'settings'
  | 'license'
  | 'logs'
  | 'help';

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const profiles = useProfileStore((state) => state.profiles);
  const trashProfiles = useProfileStore((state) => state.trashProfiles);
  const runningCount = profiles.filter((p) => p.status === 'RUNNING' || p.status === 'STARTING').length;
  const { settings, lockApp } = useSettingsStore();
  const { hasCapability } = useAccountStore();

  const [lockedModalData, setLockedModalData] = useState<{
    featureTitle: string;
    featureDescription: string;
    requiredPlan: 'PRO' | 'BUSINESS';
  } | null>(null);

  const isTeamLocked = !hasCapability('workspace.team');
  const isAutomationLocked = !hasCapability('automation.rpa');

  const navItems = [
    { id: 'dashboard' as NavigationPage, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profiles' as NavigationPage, label: 'Profiles', icon: Layers, badge: runningCount > 0 ? `${runningCount} Active` : undefined },
    { id: 'diagnostics' as NavigationPage, label: 'Diagnostics', icon: Activity },
    {
      id: 'workspaces' as NavigationPage,
      label: 'Workspaces & Team',
      icon: Users,
      badge: isTeamLocked ? 'BIZ' : undefined,
      locked: isTeamLocked,
      requiredPlan: 'BUSINESS' as const,
      description: 'Collaborate with team members, share isolated profiles, and enforce organization-wide role-based access control.',
    },
    { id: 'captcha' as NavigationPage, label: 'Captcha Solver', icon: Bot },
    { id: 'trash-bin' as NavigationPage, label: 'Trash Bin', icon: Trash2, badge: trashProfiles.length > 0 ? `${trashProfiles.length}` : undefined },
    { id: 'mobile-rotator' as NavigationPage, label: 'Mobile IP Rotator', icon: Smartphone },
    { id: 'browser-environment' as NavigationPage, label: 'Environment', icon: Sliders },
    { id: 'proxies' as NavigationPage, label: 'Proxies', icon: Shield },
    { id: 'cookies' as NavigationPage, label: 'Cookies', icon: Globe2 },
    { id: 'history' as NavigationPage, label: 'History', icon: ScrollText },
    { id: 'extensions' as NavigationPage, label: 'Extensions', icon: Puzzle },
    {
      id: 'automation' as NavigationPage,
      label: 'Automation',
      icon: PlaySquare,
      badge: isAutomationLocked ? 'PRO' : undefined,
      locked: isAutomationLocked,
      requiredPlan: 'PRO' as const,
      description: 'Build and run automated RPA workflows, schedule repetitive tasks, and warm cookies across browser profiles.',
    },
    { id: 'logs' as NavigationPage, label: 'Activity Logs', icon: ScrollText },
    { id: 'settings' as NavigationPage, label: 'Settings', icon: Settings },
    { id: 'help' as NavigationPage, label: 'Help & Docs', icon: HelpCircle },
  ];








  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 select-none flex-shrink-0">
      {/* GoLogin-Style User & Workspace Brand Header */}
      <div className="h-16 px-3 flex items-center border-b border-slate-800">
        <AccountDropdown onNavigate={onNavigate} />
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id || 
            (item.id === 'profiles' && (currentPage === 'create-profile' || currentPage === 'profile-settings' || currentPage === 'import' || currentPage === 'export')) ||
            (item.id === 'automation' && currentPage === 'workflow-builder');

          return (
            <button
              key={item.id}
              onClick={() => {
                if ((item as any).locked) {
                  setLockedModalData({
                    featureTitle: item.label,
                    featureDescription: (item as any).description || '',
                    requiredPlan: (item as any).requiredPlan || 'PRO',
                  });
                  return;
                }
                onNavigate(item.id);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group active:scale-[0.98] ${
                isActive
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-100 hover:translate-x-0.5'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-teal-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isActive ? 'bg-slate-950 text-teal-300' : 'bg-teal-950 text-teal-400 border border-teal-800/50 shadow-xs'
                }`}>
                  {(item as any).locked && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Official Support & Help */}
      <div className="px-4 py-2 mt-2 border-t border-slate-800/80 pt-4">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 block">Official Support</span>
        <div className="space-y-1.5">
          <a
            href="https://wa.me/919376343629"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400"
          >
            <div className="flex items-center space-x-3">
              <MessageCircle className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              <span>WhatsApp Support</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-400 font-extrabold">24/7</span>
          </a>
          <a
            href="mailto:mahiverse.official@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400"
          >
            <div className="flex items-center space-x-3">
              <Mail className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
              <span>Official Support</span>
            </div>
          </a>
        </div>
      </div>

      {/* Bottom Profile / Quick Lock Status */}
      <div className="p-3 border-t border-slate-800/80">
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Isolation Active</p>
              <p className="text-[11px] text-slate-400">{profiles.length} Profiles Stored</p>
            </div>
          </div>
          {settings.security.appLockEnabled && (
            <button
              onClick={lockApp}
              title="Lock Application"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="pt-2 text-center text-[10px] text-slate-500 font-medium">
          By Munna Bhai • v1.1.4
        </div>
      </div>

      {lockedModalData && (
        <UpgradeModal
          isOpen={!!lockedModalData}
          onClose={() => setLockedModalData(null)}
          featureTitle={lockedModalData.featureTitle}
          featureDescription={lockedModalData.featureDescription}
          requiredPlan={lockedModalData.requiredPlan}
        />
      )}
    </aside>
  );
};
