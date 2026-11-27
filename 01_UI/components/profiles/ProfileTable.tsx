import React, { memo } from 'react';
import {
  Plus,
  Play,
  Square,
  Settings as SettingsIcon,
  Copy,
  Trash2,
  Cookie,
  Globe2,
  Shield,
} from 'lucide-react';
import { Profile } from '../../../10_CONFIG/shared/types/profile.js';
import { ProxyItem } from '../../../10_CONFIG/shared/types/proxy.js';
import { ProfileRow } from './ProfileRow.js';

export interface ProfileTableProps {
  profilesCount: number;
  loading: boolean;
  filteredProfiles: Profile[];
  paginatedProfiles: Profile[];
  proxyMap: Map<string, ProxyItem>;
  selectedIdSet: Set<string>;
  mobileModeEnabled: boolean;
  launchingMobileId: string | null;
  syncStatuses: Record<string, string>;
  syncProgressMap: Record<string, { percent: number; stage: string }>;
  fleetResources: Record<string, { pid?: number; memoryMB: number; cpuPercent: number }>;
  pingingProxyIds: Record<string, boolean>;
  searchQuery: string;
  activeFolderTab: string;
  onClearFilter: () => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelect: (id: string, checked: boolean) => void;
  instantCreating: boolean;
  onInstantCreate: () => void;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onContextMenu: (e: React.MouseEvent, profile: Profile) => void;
  onRunOrStop: (profile: Profile) => void;
  onPingProxy: (proxyId: string, e?: React.MouseEvent) => void;
  onOpenUniversalProxy: (profile: Profile) => void;
  onPasteFromClipboard: (profileId: string) => void;
  onOpenWarmer: (profile: Profile) => void;
  onOpenStealthTest: (profile: Profile) => void;
  onBackupToCloud: (profile: Profile) => void;
  onOpenSettings: (profileId: string) => void;
  onTestProxyForProfile: (profile: Profile) => void;
  onClone: (profile: Profile) => void;
  onDelete: (profileId: string) => void;
  contextMenu: { x: number; y: number; profile: Profile } | null;
  onCloseContextMenu: () => void;
  onStopProfile: (profileId: string) => void;
  onCopyProxy: (profile: Profile) => void;
  onExportCookies: (profileId: string) => void;
}

export const ProfileTable: React.FC<ProfileTableProps> = memo(({
  profilesCount,
  loading,
  filteredProfiles,
  paginatedProfiles,
  proxyMap,
  selectedIdSet,
  mobileModeEnabled,
  launchingMobileId,
  syncStatuses,
  syncProgressMap,
  fleetResources,
  pingingProxyIds,
  searchQuery,
  activeFolderTab,
  onClearFilter,
  onToggleSelectAll,
  onToggleSelect,
  instantCreating,
  onInstantCreate,
  currentPage,
  pageSize,
  totalPages,
  onPrevPage,
  onNextPage,
  onContextMenu,
  onRunOrStop,
  onPingProxy,
  onOpenUniversalProxy,
  onPasteFromClipboard,
  onOpenWarmer,
  onOpenStealthTest,
  onBackupToCloud,
  onOpenSettings,
  onTestProxyForProfile,
  onClone,
  onDelete,
  contextMenu,
  onCloseContextMenu,
  onStopProfile,
  onCopyProxy,
  onExportCookies,
}) => (
  <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
    {filteredProfiles.length === 0 ? (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4">
          <Globe2 className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">No Profiles Match Filter</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
          No profiles found matching "{searchQuery || activeFolderTab}". Try clearing your search query or switching folders.
        </p>
        <button
          onClick={onClearFilter}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 active:scale-95 transition-all"
        >
          <span>Clear Filter</span>
        </button>
      </div>
    ) : (
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-normal text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 sticky top-0 z-10 select-none">
            <th className="py-3 px-4 w-10 text-center">
              <input
                type="checkbox"
                checked={selectedIdSet.size === filteredProfiles.length && filteredProfiles.length > 0}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500"
              />
            </th>
            <th className="py-3 px-4 font-normal">
              <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 font-normal">
                <span>Name</span>
                <span className="text-[11px] text-slate-400">↑</span>
                <button
                  onClick={onInstantCreate}
                  disabled={instantCreating}
                  className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40 ml-0.5 transition"
                  title="Instantly add a new profile"
                >
                  <Plus className={`w-3 h-3 ${instantCreating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </th>
            <th className="py-3 px-4 w-36 font-normal">State</th>
            <th className="py-3 px-4 font-normal">Notes</th>
            <th className="py-3 px-4 w-32 font-normal">
              <div className="flex items-center space-x-1">
                <span>Proxy Type</span>
                <span className="text-[10px] text-slate-400">↓↑</span>
              </div>
            </th>
            <th className="py-3 px-4 font-normal">Proxy &amp; Location</th>
            <th className="py-3 px-4 text-right w-36 font-normal">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {loading && profilesCount === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="py-4 px-4 text-center">
                    <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-36 h-4 bg-slate-200 dark:bg-slate-800 rounded mb-1" />
                    <div className="w-20 h-3 bg-slate-100 dark:bg-slate-850 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-7 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                      <div className="w-20 h-5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="w-28 h-6 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="w-20 h-6 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                  </td>
                </tr>
              ))
            : paginatedProfiles.map((p) => {
                const proxyId = p.settings?.network?.proxyId;
                const proxy = proxyId ? proxyMap.get(proxyId) : undefined;
                return (
                  <ProfileRow
                    key={p.id}
                    profile={p}
                    proxy={proxy}
                    isSelected={selectedIdSet.has(p.id)}
                    mobileModeEnabled={mobileModeEnabled}
                    isLaunchingMobile={launchingMobileId === p.id}
                    syncStatus={syncStatuses[p.id]}
                    syncProgress={syncProgressMap[p.id]}
                    fleetResource={fleetResources[p.id]}
                    isPingingProxy={proxy ? Boolean(pingingProxyIds[proxy.id]) : false}
                    onToggleSelect={onToggleSelect}
                    onContextMenu={onContextMenu}
                    onRunOrStop={onRunOrStop}
                    onPingProxy={onPingProxy}
                    onOpenUniversalProxy={onOpenUniversalProxy}
                    onPasteFromClipboard={onPasteFromClipboard}
                    onOpenWarmer={onOpenWarmer}
                    onOpenStealthTest={onOpenStealthTest}
                    onBackupToCloud={onBackupToCloud}
                    onOpenSettings={onOpenSettings}
                    onTestProxyForProfile={onTestProxyForProfile}
                    onClone={onClone}
                    onDelete={onDelete}
                  />
                );
              })}
        </tbody>
      </table>
    )}

    {/* Pagination Controls */}
    {filteredProfiles.length > pageSize && (
      <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 select-none">
        <span>
          Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProfiles.length)} of{' '}
          {filteredProfiles.length} profiles
        </span>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={onPrevPage}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 font-medium transition"
          >
            Previous
          </button>
          <span className="font-mono text-slate-700 dark:text-slate-200 px-2 font-semibold">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={onNextPage}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 font-medium transition"
          >
            Next
          </button>
        </div>
      </div>
    )}

    {/* Context Menu */}
    {contextMenu && (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        className="fixed z-50 w-52 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
          <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-[11px]">{contextMenu.profile.name}</p>
          <p className="text-[10px] text-slate-400 font-mono truncate">
            {contextMenu.profile.folder || 'General'} · {contextMenu.profile.status}
          </p>
        </div>

        <div className="space-y-0.5">
          {contextMenu.profile.status === 'RUNNING' ? (
            <button
              type="button"
              onClick={() => {
                onStopProfile(contextMenu.profile.id);
                onCloseContextMenu();
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition font-medium"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Profile</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const target = contextMenu.profile;
                onCloseContextMenu();
                onRunOrStop(target);
              }}
              disabled={contextMenu.profile.status === 'STARTING' || launchingMobileId === contextMenu.profile.id}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition font-medium disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {launchingMobileId === contextMenu.profile.id
                  ? 'Rotating IP...'
                  : contextMenu.profile.status === 'STARTING'
                    ? 'Starting...'
                    : 'Launch Profile'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const id = contextMenu.profile.id;
              onCloseContextMenu();
              onOpenSettings(id);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Edit Settings</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const target = contextMenu.profile;
              await onClone(target);
              onCloseContextMenu();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Duplicate Profile</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await onCopyProxy(contextMenu.profile);
              onCloseContextMenu();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy Proxy</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const id = contextMenu.profile.id;
              onCloseContextMenu();
              onExportCookies(id);
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium"
          >
            <Cookie className="w-3.5 h-3.5 text-slate-400" />
            <span>Export Cookies</span>
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />

          <button
            type="button"
            onClick={() => {
              onDelete(contextMenu.profile.id);
              onCloseContextMenu();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete to Trash</span>
          </button>
        </div>
      </div>
    )}
  </div>
));
