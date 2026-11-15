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
import { BrandLogo } from './BrandLogo.js';

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
    planLimits?.plan === 'trial' ||
    currentUser?.planName?.toUpperCase() === 'PRO' ||
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

  const isPaidOrTrial = isBusiness || isPro || currentPlan === 'pro' || currentPlan === 'trial' || currentPlan === 'starter' || currentPlan.startsWith('pro_') || currentPlan.startsWith('professional_');
  const planBadgeText = isBusiness
    ? (currentPlan === 'enterprise' ? 'ENTERPRISE' : currentPlan.includes('team') ? 'TEAM' : 'BUSINESS')
    : currentPlan === 'trial' ? 'TRIAL'
    : (currentPlan === 'pro' || currentPlan.startsWith('pro_') || currentPlan.startsWith('professional_')) ? 'PRO'
    : currentPlan === 'starter' ? 'STARTER'
    : (isPro ? 'PRO' : 'FREE');

  // Load authenticated session on mount
  useEffect(() => {
    let mounted = true;
    setIsLoadingSession(true);
    fetchPlanLimits()
      .catch(() => {})
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
      fetchPlanLimits({ force: true }).catch(() => {});
    }
  }, [isOpen, fetchPlanLimits]);

  const userEmail = accountSession?.email || currentUser?.email || commercialUser?.email || null;
  const isUserSignedIn = Boolean(accountSession?.token || currentUser || commercialUser);

  const userDisplayName = userEmail || currentUser?.displayName || (isPro ? 'MAHI PRO' : 'MAHI BROWSER');
  const userPlanName = isPaidOrTrial ? `${planBadgeText} (${planLimits?.maxProfiles || 100} Profiles)` : 'Free Plan (15 Profiles)';
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

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Top Header Pill / Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-all text-left group"
        title={userEmail || userDisplayName}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <BrandLogo variant="icon" className="w-8 h-8 rounded-lg shadow-sm shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs truncate" title={userEmail || undefined}>
                {userEmail || userDisplayName}
              </span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
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
        <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-700 dark:text-slate-200 text-xs">
          
          {/* User Profile Header Card */}
          <div className="p-3.5 flex items-center space-x-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800/80">
            <BrandLogo variant="icon" className="w-11 h-11 rounded-xl shadow-sm shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate" title={userEmail || undefined}>
                {userEmail || userDisplayName}
              </h4>
              <p className="text-[11px] text-slate-400 truncate font-mono">
                {isPaidOrTrial ? `${planBadgeText} Edition` : 'Freemium Edition'}
              </p>

              {/* Account Email Display */}
              <div
                className="text-[11px] truncate mt-0.5"
                title={userEmail || 'Not signed in'}
              >
                {isLoadingSession && !userEmail ? (
                  <span className="inline-block w-24 h-2.5 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : userEmail ? (
                  <span className="text-teal-600 dark:text-teal-400 font-medium truncate block">
                    {userEmail}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic text-[10.5px] block">
                    Not signed in
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                  {userPlanName}
                </span>
                <span className="text-slate-400 text-[10px]">·</span>
                <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                  {profilesCount} of {maxProfiles} profiles
                </span>
              </div>
            </div>
          </div>

          {/* Quick Menu Actions */}
          <div className="p-1.5 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                if (isUserSignedIn) {
                  openAccountModal();
                } else {
                  onNavigate('license');
                }
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-teal-600 dark:text-teal-400 font-semibold transition"
            >
              <Box size={15} className="text-teal-500" />
              <span>{isPaidOrTrial ? `${planBadgeText} Subscription Details` : 'Upgrade to MAHI PRO'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onNavigate('workspaces');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-medium transition"
            >
              <Sliders size={15} className="text-slate-400" />
              <span>Settings & Members</span>
            </button>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

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
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${ws.color || 'bg-emerald-500'}`} />
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {isActive && <Check size={14} className="text-emerald-500 shrink-0" />}
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
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs focus:outline-none focus:border-emerald-500"
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
                className="w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                <Plus size={14} />
                <span>Add workspace</span>
              </button>
            )}
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

          {/* Account Login / Logout */}
          <div className="p-1.5">
            {isUserSignedIn ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    openAccountModal();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition"
                >
                  <Users size={15} />
                  <span>Switch Account / Manage</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await accountLogout();
                    await logout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-500 font-semibold transition"
                >
                  <LogOut size={15} />
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
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-400 font-medium transition"
              >
                <ShieldCheck size={15} />
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
