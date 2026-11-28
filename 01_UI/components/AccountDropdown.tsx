import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Box,
  Sliders,
  Plus,
  LogOut,
  Check,
  Sparkles,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useLicenseStore } from '../stores/useLicenseStore.js';
import { NavigationPage } from './Sidebar.js';
import { CommercialUserModal } from './CommercialUserModal.js';

interface AccountDropdownProps {
  onNavigate: (page: NavigationPage) => void;
}

export const AccountDropdown: React.FC<AccountDropdownProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  
  const [isCommercialModalOpen, setIsCommercialModalOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    currentUser,
    accountSession,
    commercialUser,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    addWorkspace,
    logout,
    openAccountModal,
    accountLogout,
    planLimits,
    fetchPlanLimits,
  } = useAccountStore();

  const currentLicenseStatus = useLicenseStore((state) => state.currentLicenseStatus);
  const isLicensePro = Boolean(currentLicenseStatus?.isValid && currentLicenseStatus?.status === 'ACTIVE');
  const isAccountPro = Boolean(
    planLimits?.isPro ||
    planLimits?.plan === 'pro' ||
    planLimits?.plan === 'plan_pro' ||
    planLimits?.plan?.includes('pro') ||
    planLimits?.plan === 'trial' ||
    currentUser?.planName?.toUpperCase() === 'PRO' ||
    currentUser?.planName?.toUpperCase() === 'PLAN_PRO' ||
    currentUser?.planName?.toUpperCase()?.includes('PRO') ||
    currentUser?.planName?.toUpperCase() === 'TRIAL'
  );
  const isPro = isLicensePro || isAccountPro;

  const currentPlan = (planLimits?.plan || currentUser?.planName || (isPro ? 'pro' : 'free')).toLowerCase();
  const isBusiness = Boolean(
    planLimits?.tier === 'BUSINESS' ||
    currentPlan === 'business' ||
    currentPlan.startsWith('business_') ||
    currentPlan === 'team' ||
    currentPlan.startsWith('team_') ||
    currentPlan === 'enterprise' ||
    currentUser?.planName?.toUpperCase() === 'BUSINESS'
  );

  const isPaidOrTrial = isBusiness || isPro || currentPlan === 'pro' || currentPlan === 'plan_pro' || currentPlan.includes('pro') || currentPlan === 'trial' || currentPlan === 'starter' || currentPlan.startsWith('pro_') || currentPlan.startsWith('professional_');
  const planBadgeText = isBusiness
    ? (currentPlan === 'enterprise' ? 'ENTERPRISE' : currentPlan.includes('team') ? 'TEAM' : 'BUSINESS')
    : currentPlan === 'trial' ? 'TRIAL'
    : (currentPlan === 'pro' || currentPlan === 'plan_pro' || currentPlan.includes('pro') || currentPlan.startsWith('pro_') || currentPlan.startsWith('professional_')) ? 'PRO'
    : currentPlan === 'starter' ? 'STARTER'
    : (isPro ? 'PRO' : 'FREE');

  // Load authenticated session on mount
  useEffect(() => {
    let mounted = true;
    setIsLoadingSession(true);
    fetchPlanLimits()
      .catch((err) => { console.debug('[AccountDropdown] initial plan limits fetch failed', err); })
      .finally(() => {
        if (mounted) setIsLoadingSession(false);
      });
    return () => {
      mounted = false;
    };
  }, [fetchPlanLimits]);

  // Refresh session when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchPlanLimits({ force: true }).catch((err) => { console.debug('[AccountDropdown] dropdown plan limits refresh failed', err); });
    }
  }, [isOpen, fetchPlanLimits]);

  const userEmail = accountSession?.email || currentUser?.email || commercialUser?.email || null;
  const isUserSignedIn = Boolean(accountSession?.token || currentUser || commercialUser);

  // Derive a clean, human-friendly display name (avoid showing raw email twice)
  const rawDisplayName = currentUser?.displayName;
  const emailPrefix = userEmail ? userEmail.split('@')[0] : null;
  const primaryTitle = (rawDisplayName && rawDisplayName !== userEmail)
    ? rawDisplayName
    : (emailPrefix || (isPro ? 'MAHI Pro Member' : 'Guest User'));

  const maxProfiles = planLimits?.maxProfiles || currentUser?.maxProfiles || (isPro ? 100 : 15);
  const profiles = useProfileStore((state) => state.profiles);
  const profilesCount = profiles.filter((p) => p.deletedAt === null || !p.deletedAt).length;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingWorkspace(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWsName.trim()) {
      addWorkspace(newWsName.trim());
      setNewWsName('');
      setIsAddingWorkspace(false);
    }
  };

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  // Render a sleek, fail-safe user avatar badge with initial & status indicator
  const renderUserAvatar = (size: 'sm' | 'md' = 'sm') => {
    const initial = (primaryTitle?.[0] || userEmail?.[0] || 'M').toUpperCase();
    const dimensionClass = size === 'md' ? 'w-10 h-10 text-sm rounded-xl' : 'w-8 h-8 text-xs rounded-lg';
    const gradientClass = isPaidOrTrial
      ? 'bg-gradient-to-br from-amber-500 via-rose-600 to-indigo-700 text-white shadow-rose-950/40'
      : 'bg-gradient-to-br from-teal-600 via-emerald-700 to-slate-800 text-teal-100 shadow-teal-950/40';

    return (
      <div className={`relative flex items-center justify-center font-bold shadow-md shrink-0 select-none ${dimensionClass} ${gradientClass}`}>
        <span>{initial}</span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-slate-900 ${
            size === 'md' ? 'w-3 h-3' : 'w-2.5 h-2.5'
          } ${isUserSignedIn ? 'bg-emerald-400' : 'bg-slate-500'}`}
          title={isUserSignedIn ? 'Connected & Synced' : 'Guest mode'}
        />
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Top Header Pill / Button in Sidebar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-all text-left group"
        title={userEmail ? `${primaryTitle} (${userEmail})` : primaryTitle}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          {renderUserAvatar('sm')}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs truncate">
                {primaryTitle}
              </span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                isPaidOrTrial
                  ? currentPlan === 'trial'
                    ? 'text-sky-400 bg-sky-950/80 border border-sky-800/60'
                    : isBusiness
                    ? 'text-indigo-400 bg-indigo-950/80 border border-indigo-800/60'
                    : 'text-teal-400 bg-teal-950/80 border border-teal-800/60'
                  : 'text-slate-400 bg-slate-800 border border-slate-700'
              }`}>
                {planBadgeText}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {activeWs ? activeWs.name : 'Personal Workspace'}
            </p>
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 group-hover:text-white transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-200 text-xs">
          
          {/* User Profile Header Card */}
          <div className="p-3.5 bg-slate-950/70 border-b border-slate-800/80">
            <div className="flex items-center space-x-3">
              {renderUserAvatar('md')}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="font-bold text-white text-xs truncate" title={primaryTitle}>
                    {primaryTitle}
                  </h4>
                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide shrink-0 ${
                    isPaidOrTrial
                      ? currentPlan === 'trial'
                        ? 'text-sky-300 bg-sky-950/90 border border-sky-700/50'
                        : isBusiness
                        ? 'text-indigo-300 bg-indigo-950/90 border border-indigo-700/50'
                        : 'text-teal-300 bg-teal-950/90 border border-teal-700/50'
                      : 'text-slate-400 bg-slate-800/90 border border-slate-700/60'
                  }`}>
                    {planBadgeText}
                  </span>
                </div>

                {/* Single Email Display (Clean & Uncluttered) */}
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono" title={userEmail || 'Not signed in'}>
                  {isLoadingSession && !userEmail ? (
                    <span className="inline-block w-24 h-2.5 bg-slate-800 rounded animate-pulse" />
                  ) : (
                    userEmail || 'Guest Mode (Local Only)'
                  )}
                </p>
              </div>
            </div>

            {/* Profile Usage & Quota Meter */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-400">
                  {isPaidOrTrial ? `${planBadgeText} Plan` : 'Free Plan'}
                </span>
                <span className="text-slate-400 text-[10.5px]">
                  <strong className="text-slate-200 font-semibold">{profilesCount}</strong>
                  {' '}/ {maxProfiles} profiles
                </span>
              </div>

              {/* Visual Micro Progress Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    profilesCount >= maxProfiles
                      ? 'bg-rose-500'
                      : profilesCount / maxProfiles >= 0.8
                      ? 'bg-amber-400'
                      : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, Math.round((profilesCount / maxProfiles) * 100)))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Menu Actions */}
          <div className="p-1.5 space-y-1">
            {/* Upgrade / Subscription Action */}
            {!isPaidOrTrial ? (
              <button
                type="button"
                onClick={() => {
                  openAccountModal('PRO');
                  setIsOpen(false);
                }}
                className="w-full group flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-500/15 via-emerald-500/10 to-teal-500/5 hover:from-teal-500/25 hover:to-emerald-500/20 border border-teal-500/30 hover:border-teal-400/60 text-slate-100 transition-all text-left shadow-sm"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform shrink-0">
                    <Sparkles size={14} className="text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-teal-300">
                      Upgrade to MAHI PRO
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      100+ profiles, sync & fast proxies
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30 shrink-0">
                  PRO
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  openAccountModal('PRO');
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-800/80 text-teal-400 font-semibold transition text-left"
              >
                <Box size={15} className="text-teal-400 shrink-0" />
                <span className="truncate">{planBadgeText} Subscription Details</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onNavigate('workspaces');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-800/80 text-slate-300 font-medium transition"
            >
              <Sliders size={15} className="text-slate-400 shrink-0" />
              <span>Settings & Members</span>
            </button>
          </div>

          <div className="h-px bg-slate-800 my-1 mx-2" />

          {/* Workspaces Section */}
          <div className="p-1.5 space-y-1">
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
              All workspaces
            </div>

            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 font-bold'
                      : 'hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${ws.color || 'bg-emerald-500'}`} />
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {isActive && <Check size={14} className="text-emerald-400 shrink-0" />}
                </button>
              );
            })}

            {isAddingWorkspace ? (
              <form onSubmit={handleCreateWorkspace} className="p-2 space-y-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Workspace name..."
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs focus:outline-none focus:border-emerald-500 text-white"
                />
                <button
                  type="submit"
                  className="w-full py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 transition text-[11px]"
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingWorkspace(true)}
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition"
              >
                <Plus size={14} />
                <span>Add workspace</span>
              </button>
            )}
          </div>

          <div className="h-px bg-slate-800 my-1 mx-2" />

          {/* Account Login / Manage / Logout */}
          <div className="p-1.5">
            {isUserSignedIn ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    openAccountModal();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-300 font-medium transition"
                >
                  <Users size={15} className="text-slate-400 shrink-0" />
                  <span>Switch Account / Manage</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await accountLogout();
                    await logout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-400 font-medium transition"
                >
                  <LogOut size={15} className="text-rose-400 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  openAccountModal();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-emerald-500/10 text-emerald-400 font-medium transition"
              >
                <ShieldCheck size={15} className="shrink-0" />
                <span>Sign In / 7-Day PRO Trial</span>
              </button>
            )}
          </div>

        </div>
      )}

      {/* Commercial Account & Device Management Modal (only if manually opened) */}
      <CommercialUserModal
        isOpen={isCommercialModalOpen}
        onClose={() => setIsCommercialModalOpen(false)}
      />
    </div>
  );
};
