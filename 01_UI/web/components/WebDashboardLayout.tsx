import type React from 'react';
import { useState } from 'react';
import {
  Globe2,
  Layers,
  Shield,
  Key,
  Laptop,
  Activity,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Plus,
  LayoutDashboard,
  Bot,
} from 'lucide-react';
import { useWebAuthStore } from '../state/useWebAuthStore.js';
import type { TeamWorkspace } from '../../../10_CONFIG/shared/types/workspace.js';
import { BrandLogo } from '../../components/BrandLogo.js';

export type WebTab =
  | 'overview'
  | 'profiles'
  | 'workspaces'
  | 'proxies'
  | 'automation'
  | 'developer'
  | 'devices'
  | 'audit'
  | 'account';

interface WebDashboardLayoutProps {
  activeTab: WebTab;
  onNavigate: (tab: WebTab) => void;
  workspaces: TeamWorkspace[];
  currentWorkspace: TeamWorkspace | null;
  onSelectWorkspace: (ws: TeamWorkspace | null) => void;
  onOpenCreateWorkspace: () => void;
  onOpenCreateProfile: () => void;
  isDesktopOnline?: boolean;
  children: React.ReactNode;
}

export const WebDashboardLayout: React.FC<WebDashboardLayoutProps> = ({
  activeTab,
  onNavigate,
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  onOpenCreateWorkspace,
  onOpenCreateProfile,
  isDesktopOnline = false,
  children,
}) => {
  const { user, logout } = useWebAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);

  const navItems: { id: WebTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profiles', label: 'Browser Profiles', icon: Globe2 },
    { id: 'workspaces', label: 'Team Workspaces', icon: Layers },
    { id: 'proxies', label: 'Proxy Platform', icon: Shield },
    { id: 'automation', label: 'Automation & RPA', icon: Bot },
    { id: 'developer', label: 'Developer API & Webhooks', icon: Key },
    { id: 'devices', label: 'Connected Devices', icon: Laptop },
    { id: 'audit', label: 'Audit Activity', icon: Activity },
    { id: 'account', label: 'Account & Plan', icon: User },
  ];

  const handleTabClick = (tab: WebTab) => {
    onNavigate(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-screen bg-[#080d18] text-slate-100 font-sans overflow-hidden">
      {/* =========================================================================
          1. DESKTOP SIDEBAR
      ========================================================================= */}
      <aside className="hidden lg:flex w-64 bg-[#0c1222] border-r border-slate-800/80 flex-col justify-between shrink-0">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo & Brand Header */}
          <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BrandLogo variant="mark" className="w-10 h-10 rounded-xl shrink-0" />
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold tracking-wide text-white flex items-center space-x-1">
                  <span>MAHI CLOUD</span>
                </h1>
                <span className="text-[10px] text-teal-400 font-mono tracking-wider">app.mahibrowser.com</span>
              </div>
            </div>
          </div>

          {/* Workspace Switcher */}
          <div className="p-3 border-b border-slate-800/60 relative">
            <button
              type="button"
              onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
              className="w-full px-3 py-2 bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 rounded-xl flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-[11px] font-bold text-slate-200 truncate">
                    {currentWorkspace ? currentWorkspace.name : 'Personal Workspace'}
                  </div>
                  <div className="text-[9px] text-slate-400">
                    {currentWorkspace ? 'Team Space' : 'Private Storage'}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            </button>

            {isWorkspaceDropdownOpen && (
              <div className="absolute top-14 left-3 right-3 z-30 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(null);
                    setIsWorkspaceDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center space-x-2 ${
                    !currentWorkspace ? 'bg-teal-500/10 text-teal-400 font-bold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Personal Workspace</span>
                </button>

                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkspace(ws);
                      setIsWorkspaceDropdownOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center space-x-2 truncate ${
                      currentWorkspace?.id === ws.id ? 'bg-teal-500/10 text-teal-400 font-bold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{ws.name}</span>
                  </button>
                ))}

                <div className="pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWorkspaceDropdownOpen(false);
                      onOpenCreateWorkspace();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs text-teal-400 hover:bg-teal-500/10 flex items-center space-x-2 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Team Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Card: Plan & User Status */}
          <div className="p-3 border-t border-slate-800/60 space-y-2">
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Subscription</span>
                <span className="text-teal-400 font-bold font-mono">
                  {user?.planId?.toUpperCase() || 'PRO TIER'}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                <div className={`w-2 h-2 rounded-full ${isDesktopOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{isDesktopOnline ? 'Desktop Agent Online' : 'Desktop Agent Offline'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 px-1">
              <div className="truncate mr-2">
                <div className="text-xs font-bold text-slate-200 truncate">{user?.name || user?.email}</div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of MAHI Cloud"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CONTENT WRAPPER
      ========================================================================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-[#0c1222]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-100 capitalize">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </h2>
                {currentWorkspace && (
                  <span className="hidden sm:inline-block px-2 py-0.5 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[10px] rounded-full font-semibold">
                    {currentWorkspace.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                MAHI Cloud Remote Management Interface (Phase 6 Architecture)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Desktop Agent Connectivity Badge */}
            <div
              className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                isDesktopOnline
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>{isDesktopOnline ? 'Desktop Agent Active' : 'Desktop Agent Offline'}</span>
            </div>

            {/* Quick Create Profile Button */}
            <button
              type="button"
              onClick={onOpenCreateProfile}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center space-x-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Profile</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {children}
        </main>
      </div>

      {/* =========================================================================
          3. RESPONSIVE MOBILE DRAWER
      ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-default"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="relative w-72 max-w-[80vw] bg-[#0c1222] border-r border-slate-800 flex flex-col justify-between p-4 z-50">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <BrandLogo variant="mark" className="w-8 h-8 rounded-lg shrink-0" />
                  <span className="font-bold text-sm text-white">MAHI CLOUD</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Workspace Indicator in Mobile Drawer */}
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Active Workspace</div>
                <div className="font-semibold text-teal-400">
                  {currentWorkspace ? currentWorkspace.name : 'Personal Workspace'}
                </div>
              </div>

              {/* Mobile Nav Links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive
                          ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Logout on Mobile */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out ({user?.email})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
