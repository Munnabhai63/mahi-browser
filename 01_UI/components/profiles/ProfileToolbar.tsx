import React, { memo } from 'react';
import {
  Plus,
  Play,
  Square,
  Search,
  Trash2,
  Globe2,
  Tag,
  RefreshCw,
  Layers,
  Sparkles,
  Upload,
  Zap,
  Cloud,
  Loader2,
  X,
  ChevronDown,
  Check,
  Smartphone,
  Radio,
  AlertTriangle,
} from 'lucide-react';
import { NavigationPage } from '../Sidebar.js';

export interface MobileRotatorSummary {
  installed: boolean;
  authorizedCount: number;
  method: 'adb' | 'webhook';
  webhookConfigured: boolean;
}

export interface ProfileToolbarProps {
  hasSessionToken: boolean;
  unassignedGuestCount: number;
  isClaimingGuest: boolean;
  onClaimGuestProfiles: () => void;
  onDismissGuestBanner: () => void;
  folders: string[];
  activeFolderTab: string;
  onSelectFolderTab: (folder: string) => void;
  isFolderOverflowOpen: boolean;
  onToggleFolderOverflow: (e: React.MouseEvent) => void;
  onCloseFolderOverflow: () => void;
  onNavigate: (page: NavigationPage) => void;
  mobileModeEnabled: boolean;
  isTogglingMobileMode: boolean;
  onToggleMobileMode: () => void;
  mobileRotatorSummary: MobileRotatorSummary | null;
  onRefreshMobileModeStatus: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  loading: boolean;
  onRefreshProfiles: () => void;
  onOpenQuickCreate: () => void;
  onOpenBulkCreate: () => void;
  onOpenUniversalImport: () => void;
  isSyncActive: boolean;
  onOpenSynchronizer: () => void;
  runningCount: number;
  isOptimizingMemory: boolean;
  onOptimizeMemory: () => void;
  selectedIdsCount: number;
  onClearSelection: () => void;
  onOpenStaggerLaunch: () => void;
  onBulkStop: () => void;
  onOpenBulkProxy: () => void;
  onOpenBulkEdit: () => void;
  onOpenBulkWarm: () => void;
  onOpenBulkDelete: () => void;
}

export const ProfileToolbar: React.FC<ProfileToolbarProps> = memo(({
  hasSessionToken,
  unassignedGuestCount,
  isClaimingGuest,
  onClaimGuestProfiles,
  onDismissGuestBanner,
  folders,
  activeFolderTab,
  onSelectFolderTab,
  isFolderOverflowOpen,
  onToggleFolderOverflow,
  onCloseFolderOverflow,
  onNavigate,
  mobileModeEnabled,
  isTogglingMobileMode,
  onToggleMobileMode,
  mobileRotatorSummary,
  onRefreshMobileModeStatus,
  searchQuery,
  onSearchChange,
  loading,
  onRefreshProfiles,
  onOpenQuickCreate,
  onOpenBulkCreate,
  onOpenUniversalImport,
  isSyncActive,
  onOpenSynchronizer,
  runningCount,
  isOptimizingMemory,
  onOptimizeMemory,
  selectedIdsCount,
  onClearSelection,
  onOpenStaggerLaunch,
  onBulkStop,
  onOpenBulkProxy,
  onOpenBulkEdit,
  onOpenBulkWarm,
  onOpenBulkDelete,
}) => (
  <>
    {/* Guest Profiles Claim Notification Banner */}
    {hasSessionToken && unassignedGuestCount > 0 && (
      <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border-b border-emerald-500/30 px-6 py-2.5 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              You have <strong className="text-emerald-500">{unassignedGuestCount}</strong> guest profile(s) on this device. Claim them into your account?
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Claiming moves local guest profiles under your authenticated account limits with full sync support.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            disabled={isClaimingGuest}
            onClick={onClaimGuestProfiles}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isClaimingGuest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Claim to My Account
          </button>
          <button
            type="button"
            onClick={onDismissGuestBanner}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    )}

    {/* Top Header Bar */}
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-2">
        {folders.slice(0, 5).map((folder) => (
          <button
            key={folder}
            onClick={() => {
              onSelectFolderTab(folder);
              onCloseFolderOverflow();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeFolderTab === folder
                ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
            }`}
          >
            {folder === 'ALL' ? 'All profiles' : folder}
          </button>
        ))}

        {folders.length > 5 && (
          <div className="relative">
            <button
              type="button"
              onClick={onToggleFolderOverflow}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 border ${
                folders.slice(5).includes(activeFolderTab)
                  ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
              }`}
              title="More folders"
            >
              <span>
                {folders.slice(5).includes(activeFolderTab)
                  ? activeFolderTab
                  : `More (${folders.length - 5})`}
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isFolderOverflowOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 py-1.5 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in duration-100"
              >
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Folders ({folders.length - 5})
                </div>
                {folders.slice(5).map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => {
                      onSelectFolderTab(folder);
                      onCloseFolderOverflow();
                    }}
                    className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors ${
                      activeFolderTab === folder
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{folder}</span>
                    {activeFolderTab === folder && <Check className="w-3.5 h-3.5 text-teal-500 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onNavigate('workspaces')}
          className="px-2 py-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-bold"
          title="Manage Folders & Workspaces"
        >
          •••
        </button>

        <button
          onClick={() => onSelectFolderTab('ANDROID_MOBILE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
            activeFolderTab === 'ANDROID_MOBILE'
              ? 'bg-emerald-600 text-white font-semibold shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Android</span>
        </button>

        <button
          onClick={() => onSelectFolderTab('CLOUD_SYNC')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
            activeFolderTab === 'CLOUD_SYNC'
              ? 'bg-teal-600 text-white font-semibold shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cloud Sync</span>
        </button>

        <button
          onClick={() => onSelectFolderTab('STARTER_TEMPLATES')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
            activeFolderTab === 'STARTER_TEMPLATES'
              ? 'bg-teal-600 text-white font-semibold shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>Starter Templates</span>
        </button>

        <button
          type="button"
          onClick={onToggleMobileMode}
          disabled={isTogglingMobileMode}
          title="Toggle Mobile Mode (1 running profile max, auto-rotates SIM IP & logs IP in Notes for Direct profiles)"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer border ${
            mobileModeEnabled
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${mobileModeEnabled ? 'animate-pulse text-white' : 'text-emerald-500'}`} />
          <span>Mobile Mode</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
              mobileModeEnabled
                ? 'bg-emerald-800/70 text-emerald-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {mobileModeEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      <div className="flex items-center space-x-3">
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search profiles or notes..."
            className="w-full pl-9 pr-7 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={onRefreshProfiles}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={onOpenQuickCreate}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 active:scale-95 transition-all interactive-control"
        >
          <Plus className="w-4 h-4" />
          <span>Quick Profile</span>
        </button>

        <button
          onClick={onOpenBulkCreate}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all"
          title="Create 5, 10, 20 or more profiles at once"
        >
          <Layers className="w-4 h-4 text-teal-500" />
          <span>Bulk Create</span>
        </button>

        <button
          onClick={onOpenUniversalImport}
          className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 active:scale-95 transition-all"
          title="Import 50+ Accounts from TXT, CSV, Netscape or JSON with cookies & proxies"
        >
          <Upload className="w-4 h-4" />
          <span>Bulk Import</span>
        </button>

        <button
          onClick={onOpenSynchronizer}
          className={`px-3.5 py-2 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 active:scale-95 transition-all ${
            isSyncActive
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
          title="Mirror clicks, typing & scroll from one window to all running profiles in real-time"
        >
          <Sparkles className={`w-4 h-4 ${isSyncActive ? 'text-white' : 'text-amber-400'}`} />
          <span>{isSyncActive ? 'Sync Active (ON)' : 'Synchronizer'}</span>
        </button>

        {runningCount > 0 && (
          <button
            onClick={onOptimizeMemory}
            disabled={isOptimizingMemory}
            className="px-3.5 py-2 bg-gradient-to-r from-teal-600/80 to-cyan-600/80 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-500/20 flex items-center space-x-1.5 active:scale-95 transition-all disabled:opacity-50"
            title="Purge standby memory cache across all active browser profiles"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-300 ${isOptimizingMemory ? 'animate-spin' : ''}`} />
            <span>{isOptimizingMemory ? 'Optimizing...' : 'Optimize RAM'}</span>
          </button>
        )}

        <button
          onClick={() => onNavigate('create-profile')}
          className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all"
        >
          Advanced Setup
        </button>
      </div>
    </div>

    {/* Active Mobile Mode Banner */}
    {mobileModeEnabled && (
      <div className="bg-emerald-50/90 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800/60 px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2.5 text-emerald-900 dark:text-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-bold">Mobile Mode Active</span>
          <span className="text-emerald-700 dark:text-emerald-300">
            1 profile max · Direct profiles auto-rotate SIM IP &amp; save new IP to Notes · Proxied profiles skip rotation
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {mobileRotatorSummary && mobileRotatorSummary.method === 'adb' && mobileRotatorSummary.authorizedCount === 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-semibold text-[11px]">
              <AlertTriangle className="w-3 h-3" />
              {mobileRotatorSummary.installed ? 'No Authorized ADB Phone Detected' : 'ADB Not Installed'}
            </span>
          )}
          {mobileRotatorSummary && mobileRotatorSummary.method === 'adb' && mobileRotatorSummary.authorizedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60 font-semibold text-[11px]">
              <Smartphone className="w-3 h-3" />
              {mobileRotatorSummary.authorizedCount} ADB Device Ready
            </span>
          )}
          <button
            type="button"
            onClick={onRefreshMobileModeStatus}
            className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-white font-semibold text-[11px] cursor-pointer"
          >
            Refresh Status
          </button>
          <button
            type="button"
            onClick={() => onNavigate('mobile-rotator')}
            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] cursor-pointer"
          >
            Rotator Settings
          </button>
        </div>
      </div>
    )}

    {/* Bulk Action Bar */}
    {selectedIdsCount > 0 && (
      <div className="bg-teal-50 dark:bg-slate-900 border-b border-teal-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between text-xs text-teal-800 dark:text-teal-200 shadow-sm animate-in fade-in duration-150">
        <div className="flex items-center space-x-2">
          <span className="font-bold bg-teal-600/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-md">
            {selectedIdsCount}
          </span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">profiles selected</span>
          <button
            onClick={onClearSelection}
            className="text-slate-400 hover:text-slate-200 text-[11px] underline ml-2"
          >
            Deselect All
          </button>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenStaggerLaunch}
            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95 ${
              mobileModeEnabled && selectedIdsCount > 1
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-500 hover:to-emerald-500'
            }`}
            title={
              mobileModeEnabled && selectedIdsCount > 1
                ? 'Disabled in Mobile Mode (max 1 profile at a time)'
                : 'Launch selected profiles with CPU-safe staggered delay'
            }
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Selected ({selectedIdsCount})</span>
          </button>

          <button
            onClick={onBulkStop}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-xl font-bold flex items-center space-x-1.5 hover:bg-amber-500 shadow-sm transition-all active:scale-95"
            title="Stop all running selected profiles"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop All</span>
          </button>

          <button
            onClick={onOpenBulkProxy}
            className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
            title="Assign single proxy or round-robin distribute proxy list"
          >
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Assign Proxy</span>
          </button>

          <button
            onClick={onOpenBulkEdit}
            className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
            title="Batch edit folder and tags"
          >
            <Tag className="w-3.5 h-3.5 text-purple-400" />
            <span>Edit Tags/Folder</span>
          </button>

          <button
            onClick={onOpenBulkWarm}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold flex items-center space-x-1.5 hover:from-amber-600 hover:to-amber-700 shadow-sm transition-all active:scale-95"
            title="Auto-Farm Cookies for selected profiles"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Warm ({selectedIdsCount})</span>
          </button>

          <button
            onClick={onOpenBulkDelete}
            className="px-3 py-1.5 bg-rose-600/90 text-white rounded-xl font-bold flex items-center space-x-1.5 hover:bg-rose-600 shadow-sm transition-all active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete ({selectedIdsCount})</span>
          </button>
        </div>
      </div>
    )}
  </>
));
