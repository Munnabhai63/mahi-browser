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
import { NavigationPage } from './Sidebar.js';
import { CommercialUserModal } from './CommercialUserModal.js';

interface AccountDropdownProps {
  onNavigate: (page: NavigationPage) => void;
}

export const AccountDropdown: React.FC<AccountDropdownProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  
  const [isCommercialModalOpen, setIsCommercialModalOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    currentUser,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    addWorkspace,
    openAccountModal,
    logout,
  } = useAccountStore();

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

  // If no user is logged in, show a compact "Sign In" button
  if (!currentUser) {
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={openAccountModal}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 transition-all text-left group text-xs font-bold text-emerald-400"
        >
          <ShieldCheck size={14} />
          Sign In to MAHI
        </button>
        {isCommercialModalOpen && (
          <CommercialUserModal isOpen={isCommercialModalOpen} onClose={() => setIsCommercialModalOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Top Header Pill / Button (GoLogin style) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 transition-all text-left group"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg ${'bg-emerald-500'} flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0`}>
            M
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs truncate">
                Premium Account
              </span>
              <span className="text-[10px] text-teal-400 font-extrabold px-1 py-0.2 bg-teal-950/80 border border-teal-800/60 rounded">
                PRO
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

      {/* Floating GoLogin-Style Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-700 dark:text-slate-200 text-xs">
          
          {/* User Profile Header Card */}
          <div className="p-3.5 flex items-center space-x-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800/80">
            <div className={`w-11 h-11 rounded-xl ${'bg-emerald-500'} flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0`}>
              M
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                Premium Account
              </h4>
              <p className="text-[11px] text-slate-400 truncate font-mono">
                Enterprise Edition
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                  {currentUser.planName || 'Enterprise'}
                </span>
                <span className="text-slate-400 text-[10px]">·</span>
                <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                  {profilesCount} of {currentUser.maxProfiles || 1000} profiles
                </span>
              </div>
            </div>
          </div>

          {/* Quick Menu Actions */}
          <div className="p-1.5 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsCommercialModalOpen(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-teal-600 dark:text-teal-400 font-semibold transition"
            >
              <ShieldCheck size={15} className="text-teal-500" />
              <span>Commercial Account & Devices</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onNavigate('license');
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-medium transition"
            >
              <Box size={15} className="text-slate-400" />
              <span>Upgrade plan</span>
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition font-medium ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 font-bold text-teal-600 dark:text-teal-400'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <div className={`w-5 h-5 rounded-md ${ws.color || 'bg-amber-600'} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {isActive && <Check size={14} className="text-teal-500 shrink-0" />}
                </button>
              );
            })}

            {/* Add Workspace Inline Trigger */}
            {isAddingWorkspace ? (
              <form onSubmit={handleCreateWorkspace} className="p-1.5 flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="Workspace name..."
                  className="flex-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold"
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

          {/* Logout Account */}
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-500 font-semibold transition"
            >
              <LogOut size={15} />
              <span>Log Out</span>
            </button>
          </div>

        </div>
      )}

      {/* Commercial Account & Device Management Modal */}
      <CommercialUserModal
        isOpen={isCommercialModalOpen}
        onClose={() => setIsCommercialModalOpen(false)}
      />
    </div>
  );
};
