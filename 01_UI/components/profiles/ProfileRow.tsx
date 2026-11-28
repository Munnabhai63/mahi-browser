import type React from 'react';
import { memo } from 'react';
import {
  Plus,
  Play,
  Square,
  Settings as SettingsIcon,
  Copy,
  Trash2,
  Clipboard,
  Activity,
  Shield,
  Sparkles,
  UploadCloud,
  RefreshCw,
  Loader2,
  Smartphone,
  Lock,
} from 'lucide-react';
import type { Profile } from '../../../10_CONFIG/shared/types/profile.js';
import type { ProxyItem } from '../../../10_CONFIG/shared/types/proxy.js';
import { getLatencyBadgeState, resolveProfileStatusPill } from '../../utils/phase1-ui-helpers.js';
import { CountryFlag } from '../CountryFlag.js';

export interface ProfileRowProps {
  profile: Profile;
  proxy?: ProxyItem;
  isSelected: boolean;
  mobileModeEnabled: boolean;
  isLaunchingMobile: boolean;
  syncStatus?: string;
  syncProgress?: { percent: number; stage: string };
  fleetResource?: { pid?: number; memoryMB: number; cpuPercent: number };
  isPingingProxy: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
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
}

type ProfileWithLockFields = Profile & {
  lockStatus?: { isLocked?: boolean; lockedByDevice?: string; deviceName?: string };
  lock?: { isLocked?: boolean; lockedByDevice?: string; deviceName?: string };
  isLocked?: boolean;
  lockedByDeviceName?: string;
  lockedBy?: string;
};

const ProfileStatusPill: React.FC<{
  profile: Profile;
  isStarting: boolean;
  isRunning: boolean;
  syncStatus?: string;
  syncProgress?: { percent: number; stage: string };
}> = ({ profile, isStarting, isRunning, syncStatus, syncProgress }) => {
  const lockedProfile = profile as ProfileWithLockFields;
  const lockInfo = lockedProfile.lockStatus || lockedProfile.lock;
  const isLocked = Boolean(lockedProfile.isLocked || lockInfo?.isLocked || syncStatus === 'LOCKED');
  const deviceName =
    lockedProfile.lockedByDeviceName ||
    lockedProfile.lockedBy ||
    lockInfo?.lockedByDevice ||
    lockInfo?.deviceName ||
    'Another Device';

  const isSyncing = Boolean(syncProgress || syncStatus === 'SYNCING');

  const pill = resolveProfileStatusPill({
    isLocked,
    lockedBy: deviceName,
    isSyncing,
    syncProgress: syncProgress?.percent,
    isStarting,
    isRunning,
    runtimeStatus: profile.status,
  });

  if (pill.state === 'LOCKED') {
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${pill.badgeClass}`}
        title={pill.tooltip}
      >
        <Lock className="w-3 h-3 text-rose-500 shrink-0" />
        <span>{pill.label}</span>
      </span>
    );
  }

  if (pill.state === 'SYNCING') {
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${pill.badgeClass}`}
        title={pill.tooltip}
      >
        <RefreshCw className="w-3 h-3 text-sky-500 animate-spin shrink-0" />
        <span>{pill.label}</span>
      </span>
    );
  }

  if (pill.state === 'STARTING') {
    return (
      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${pill.badgeClass}`}>
        <Loader2 className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
        <span>{pill.label}</span>
      </span>
    );
  }

  if (pill.state === 'RUNNING') {
    return (
      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${pill.badgeClass}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-200 animate-ping shrink-0" />
        <span>{pill.label}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${pill.badgeClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>{pill.label}</span>
    </span>
  );
};

export const ProfileRow: React.FC<ProfileRowProps> = memo(({
  profile: p,
  proxy,
  isSelected,
  mobileModeEnabled,
  isLaunchingMobile,
  syncStatus,
  syncProgress,
  fleetResource,
  isPingingProxy,
  onToggleSelect,
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
}) => {
  const isRunning = p.status === 'RUNNING';
  const isMobileRotating = isLaunchingMobile && mobileModeEnabled && !proxy && !p.settings?.network?.directConnection;
  const isStarting = p.status === 'STARTING' || isLaunchingMobile;
  const cleanNotes = (p.notes || '').replace(/\[Auto-Warmed on[^\]]*\][^\n]*/g, '').trim();

  return (
    <tr
      onContextMenu={(e) => onContextMenu(e, p)}
      className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors group cursor-context-menu"
    >
      <td className="py-3.5 px-4 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect(p.id, e.target.checked)}
          className="rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500"
        />
      </td>

      <td className="py-3.5 px-4">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{p.name}</span>
          {p.folder && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
              {p.folder}
            </span>
          )}
          {(p.settings?.browser?.userAgent?.includes('Android') || p.settings?.mobile?.enable || p.tags?.includes('Android')) && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              Android 14
            </span>
          )}
        </div>
      </td>

      <td className="py-3.5 px-4">
        <div className="flex items-center space-x-3">
          <button type="button"
            onClick={() => onRunOrStop(p)}
            disabled={isStarting}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all duration-150 active:scale-[0.98] shadow-xs interactive-control ${
              isRunning
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 hover:shadow-rose-500/10'
                : isStarting
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 cursor-wait pointer-events-none'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50'
            }`}
          >
            {isStarting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                <span>{isMobileRotating ? 'Rotating IP...' : 'Starting...'}</span>
              </>
            ) : isRunning ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run</span>
              </>
            )}
          </button>

          <div className="flex items-center space-x-2">
            <ProfileStatusPill
              profile={p}
              isStarting={isStarting}
              isRunning={isRunning}
              syncStatus={syncStatus}
              syncProgress={syncProgress}
            />
            {syncStatus === 'SYNCED' && !syncProgress && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5" title="Synced to Cloud">
                ☁️ Synced
              </span>
            )}
            {syncStatus === 'PENDING' && !syncProgress && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5" title="Pending Cloud Sync">
                ☁️ Pending
              </span>
            )}
            {syncStatus === 'CONFLICT' && !syncProgress && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-0.5" title="Sync Conflict Detected">
                ⚠️ Conflict
              </span>
            )}
            {(syncStatus === 'ERROR' || syncStatus === 'FAILED') && !syncProgress && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-0.5" title="Cloud Sync Error">
                ⚠️ Sync Error
              </span>
            )}
            {isRunning && fleetResource && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0 shadow-sm"
                title={`Process PID: ${fleetResource.pid} | CPU Usage: ${fleetResource.cpuPercent}%`}
              >
                <Activity className="w-2.5 h-2.5 text-emerald-400" />
                <span>{fleetResource.memoryMB}MB</span>
              </span>
            )}
          </div>
        </div>
      </td>

      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-sans text-xs">
        {cleanNotes || <span className="text-slate-400 font-normal">-</span>}
      </td>

      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-sans text-xs">
        {proxy ? (
          <button
            type="button"
            className="cursor-pointer hover:text-emerald-500 transition-colors font-medium text-left"
            onClick={() => onOpenUniversalProxy(p)}
            title="Click to configure proxy"
          >
            {proxy.protocol.toUpperCase()} {proxy.countryRegion ? `· ${proxy.countryRegion}` : ''}
          </button>
        ) : (
          <button
            type="button"
            className="text-slate-400 font-sans font-medium cursor-pointer hover:text-emerald-500"
            onClick={() => onOpenUniversalProxy(p)}
            title="Click to paste & test proxy"
          >
            —
          </button>
        )}
      </td>

      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
        {proxy ? (
          <div className="flex items-center space-x-2 group/proxy">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs cursor-pointer hover:border-emerald-500/50 hover:bg-slate-200/60 dark:hover:bg-slate-750 transition select-none"
              onClick={() => onOpenUniversalProxy(p)}
              title={`Proxy: ${proxy.ip || proxy.host}:${proxy.port} (${proxy.countryName || proxy.countryRegion || 'Proxy'})`}
            >
              <CountryFlag countryCode={proxy.countryRegion || 'US'} className="w-3.5 h-2.5" />
              <span>{proxy.countryRegion || 'US'}</span>
            </button>

            {isPingingProxy ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                <span>Ping...</span>
              </span>
            ) : (() => {
              const badge = getLatencyBadgeState(proxy.status, proxy.latencyMs);
              if (badge.kind === 'timeout') {
                return (
                  <button
                    type="button"
                    onClick={(e) => onPingProxy(proxy.id, e)}
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 cursor-pointer hover:bg-rose-500/25 transition select-none"
                    title={badge.title}
                  >
                    <span>{badge.text}</span>
                  </button>
                );
              }
              if (badge.kind === 'fast') {
                return (
                  <button
                    type="button"
                    onClick={(e) => onPingProxy(proxy.id, e)}
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/25 transition select-none"
                    title={badge.title}
                  >
                    <span>{badge.text}</span>
                  </button>
                );
              }
              if (badge.kind === 'moderate') {
                return (
                  <button
                    type="button"
                    onClick={(e) => onPingProxy(proxy.id, e)}
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-pointer hover:bg-amber-500/25 transition select-none"
                    title={badge.title}
                  >
                    <span>{badge.text}</span>
                  </button>
                );
              }
              return (
                <button
                  type="button"
                  onClick={(e) => onPingProxy(proxy.id, e)}
                  className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-emerald-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/30 transition select-none interactive-control"
                  title={badge.title}
                >
                  <Activity className="w-2.5 h-2.5" />
                  <span>{badge.text}</span>
                </button>
              );
            })()}

            <div className="flex items-center space-x-0.5 opacity-0 group-hover/proxy:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onOpenUniversalProxy(p)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Edit Proxy"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onPasteFromClipboard(p.id)}
                className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Paste Proxy from Clipboard (1-Click)"
              >
                <Clipboard className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 group/proxy">
            <button
              type="button"
              onClick={() => onOpenUniversalProxy(p)}
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-400 transition-all flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Proxy</span>
            </button>
            <button
              type="button"
              onClick={() => onPasteFromClipboard(p.id)}
              className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 opacity-0 group-hover/proxy:opacity-100 transition-opacity"
              title="Paste Proxy from Clipboard (1-Click)"
            >
              <Clipboard className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>

      <td className="py-3.5 px-4 text-right">
        <div className="flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button type="button"
            onClick={() => onOpenWarmer(p)}
            className="p-1.5 hover:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400 transition-colors"
            title="Auto-Warm Profile (Farms Google, Wikipedia, Amazon cookies)"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button type="button"
            onClick={() => onOpenStealthTest(p)}
            className="p-1.5 hover:bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400 transition-colors"
            title="Check Stealth & Anti-Detect Score (Pixelscan / CreepJS / IPHEY)"
          >
            <Shield className="w-3.5 h-3.5" />
          </button>

          <button type="button"
            onClick={() => onBackupToCloud(p)}
            className="p-1.5 hover:bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400 transition-colors"
            title="Backup Profile to Cloud"
          >
            <UploadCloud className="w-3.5 h-3.5" />
          </button>

          <button type="button"
            onClick={() => onOpenSettings(p.id)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
            title="Profile Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>

          <button type="button"
            onClick={() => onTestProxyForProfile(p)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-teal-500 transition-colors"
            title="Test Proxy Connection"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          <button type="button"
            onClick={() => onClone(p)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
            title="Duplicate Profile"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button type="button"
            onClick={() => onDelete(p.id)}
            className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500 transition-colors"
            title="Delete Profile"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});
