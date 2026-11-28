import React, { useEffect, useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { reduceSyncProgressMap } from '../utils/phase1-ui-helpers.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { ProxyItem } from '../../10_CONFIG/shared/types/proxy.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { NavigationPage } from '../components/Sidebar.js';
import { getFlagEmoji, getCountryNameFromCode } from '../components/CountryFlag.js';
import { useAccountStore } from '../stores/useAccountStore.js';
import { PageLoadingFallback } from '../components/PageFallback.js';
import { parseProxyString } from '../components/profiles/profile-proxy-utils.js';
import { ProfileToolbar, MobileRotatorSummary } from '../components/profiles/ProfileToolbar.js';
import { ProfileTable } from '../components/profiles/ProfileTable.js';
import { QuickCreateModal, BulkCreateModal } from '../components/profiles/ProfileCreationModals.js';
import { StaggerLaunchModal, BulkProxyModal, BulkEditModal } from '../components/profiles/ProfileBulkModals.js';
import {
  UniversalProxyModal,
  StealthTesterModal,
  SingleWarmerModal,
  BulkWarmerModal,
  CookieWarmerIndicator,
  WarmerDepth,
} from '../components/profiles/ProfileToolsModals.js';

const ProxyConfigModal = lazy(() =>
  import('../components/ProxyConfigModal.js').then((m) => ({ default: m.ProxyConfigModal }))
);
const UniversalBulkImportModal = lazy(() =>
  import('../components/UniversalBulkImportModal.js').then((m) => ({ default: m.UniversalBulkImportModal }))
);
const SynchronizerModal = lazy(() =>
  import('../components/SynchronizerModal.js').then((m) => ({ default: m.SynchronizerModal }))
);
const CloudSyncSection = lazy(() =>
  import('../components/CloudSyncSection.js').then((m) => ({ default: m.CloudSyncSection }))
);
const StarterProfilesSection = lazy(() =>
  import('../components/StarterProfilesSection.js').then((m) => ({ default: m.StarterProfilesSection }))
);

interface ProfilesListProps {
  onNavigate: (page: NavigationPage) => void;
}

export const ProfilesList: React.FC<ProfilesListProps> = ({ onNavigate }) => {
  const {
    profiles,
    loading,
    filter,
    setFilter,
    fetchProfiles,
    createProfile,
    bulkCreateProfiles,
    startProfileDetailed,
    stopProfile,
    bulkStartProfiles,
    bulkStopProfiles,
    bulkUpdateProfiles,
    bulkAssignProxies,
    deleteProfile,
    cloneProfile,
    setSelectedProfileId,
    updateProfile,
    warmProfile,
    warmBulkProfiles,
  } = useProfileStore();

  const { proxies, fetchProxies, parseAndCreateProxy } = useProxyStore();
  const { showToast } = useToastStore();
  const {
    accountSession,
    unassignedGuestProfiles,
    checkUnassignedGuestProfiles,
    claimGuestProfiles,
    dismissGuestProfilesBanner,
  } = useAccountStore();

  const [isClaimingGuest, setIsClaimingGuest] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulking, setIsBulking] = useState(false);
  const [isUniversalImportOpen, setIsUniversalImportOpen] = useState(false);
  const [isSynchronizerModalOpen, setIsSynchronizerModalOpen] = useState(false);
  const [activeFolderTab, setActiveFolderTab] = useState<string>('ALL');
  const [syncStatuses, setSyncStatuses] = useState<Record<string, string>>({});
  const [syncProgressMap, setSyncProgressMap] = useState<Record<string, { percent: number; stage: string }>>({});
  const [pingingProxyIds, setPingingProxyIds] = useState<Record<string, boolean>>({});
  const [isStaggerLaunchModalOpen, setIsStaggerLaunchModalOpen] = useState(false);
  const [isStaggerLaunching, setIsStaggerLaunching] = useState(false);
  const [staggerProgress, setStaggerProgress] = useState<{
    completed: number;
    total: number;
    profileId: string;
    pid?: number;
    error?: string;
  } | null>(null);
  const [isBulkProxyModalOpen, setIsBulkProxyModalOpen] = useState(false);
  const [isBulkProxySaving, setIsBulkProxySaving] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkEditSaving, setIsBulkEditSaving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [universalProxyModalProfile, setUniversalProxyModalProfile] = useState<Profile | null>(null);
  const [stealthTestProfile, setStealthTestProfile] = useState<Profile | null>(null);
  const [warmerTargetProfile, setWarmerTargetProfile] = useState<Profile | null>(null);
  const [isBulkWarmModalOpen, setIsBulkWarmModalOpen] = useState(false);
  const [warmerMode, setWarmerMode] = useState<WarmerDepth>('quick');
  const [isWarming, setIsWarming] = useState(false);
  const [isSyncActive, setIsSyncActive] = useState(false);
  const [mobileModeEnabled, setMobileModeEnabled] = useState(false);
  const [isTogglingMobileMode, setIsTogglingMobileMode] = useState(false);
  const [launchingMobileId, setLaunchingMobileId] = useState<string | null>(null);
  const [mobileConflictTarget, setMobileConflictTarget] = useState<{
    targetProfile: Profile;
    runningProfileId: string;
    runningProfileName: string;
  } | null>(null);
  const [isSwitchingMobileProfile, setIsSwitchingMobileProfile] = useState(false);
  const [mobileRotatorSummary, setMobileRotatorSummary] = useState<MobileRotatorSummary | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: Profile } | null>(null);
  const [isFolderOverflowOpen, setIsFolderOverflowOpen] = useState(false);
  const [fleetResources, setFleetResources] = useState<Record<string, { pid?: number; memoryMB: number; cpuPercent: number }>>({});
  const [isOptimizingMemory, setIsOptimizingMemory] = useState(false);
  const [proxyModalProfile, setProxyModalProfile] = useState<Profile | null>(null);
  const [savingProxy, setSavingProxy] = useState(false);
  const [instantCreating, setInstantCreating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    if (accountSession?.token) {
      checkUnassignedGuestProfiles().catch((err) => { console.debug('[ProfilesList] guest profile probe failed', err); });
    }
  }, [accountSession?.token]);

  useEffect(() => {
    if (window.mahiAPI?.getAllProfilesSyncStatus) {
      window.mahiAPI.getAllProfilesSyncStatus().then(setSyncStatuses).catch((err) => {
        console.debug('[ProfilesList] Non-critical sync status fetch notice:', err);
      });
    }
  }, [profiles]);

  useEffect(() => {
    const unsub = window.mahiAPI?.onSyncProgress?.((ev: any) => {
      if (ev?.profileId) {
        setSyncProgressMap((prev) => reduceSyncProgressMap(prev, ev));
      }
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setIsFolderOverflowOpen(false);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setIsFolderOverflowOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  useEffect(() => {
    if (window.mahiAPI) {
      window.mahiAPI.getFleetResources().then((summary) => {
        if (summary?.profiles) setFleetResources(summary.profiles);
      });
      const unsub = window.mahiAPI.onFleetResourceUsage((summary) => {
        if (summary?.profiles) setFleetResources(summary.profiles);
      });
      return () => unsub();
    }
  }, []);

  const refreshMobileModeStatus = useCallback(async () => {
    try {
      if (!window.mahiAPI?.mobileRotatorGetConfig) return;
      const [cfg, adbStatus, devices] = await Promise.all([
        window.mahiAPI.mobileRotatorGetConfig(),
        window.mahiAPI.mobileRotatorGetAdbStatus ? window.mahiAPI.mobileRotatorGetAdbStatus() : Promise.resolve(null),
        window.mahiAPI.mobileRotatorGetDevices ? window.mahiAPI.mobileRotatorGetDevices() : Promise.resolve([]),
      ]);
      if (cfg && typeof cfg === 'object') {
        setMobileModeEnabled(Boolean(cfg.mobileModeEnabled));
      }
      const deviceList = Array.isArray(devices) ? devices : [];
      const authorizedCount = deviceList.filter((d: any) => d?.status === 'device').length;
      setMobileRotatorSummary({
        installed: Boolean(adbStatus?.installed),
        authorizedCount,
        method: cfg?.method === 'webhook' ? 'webhook' : 'adb',
        webhookConfigured: Boolean(cfg?.webhookUrl && String(cfg.webhookUrl).trim()),
      });
    } catch (err) {
      console.debug('[ProfilesList] optional mobile rotator probe failed', err);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchProxies();
    refreshMobileModeStatus();

    const checkSync = async () => {
      try {
        if (window.mahiAPI) {
          const st = await window.mahiAPI.synchronizerGetStatus();
          if (st) setIsSyncActive(Boolean(st.enabled));
        }
      } catch (err) {
        console.debug('[ProfilesList] synchronizer status poll failed', err);
      }
    };
    checkSync();
    const syncInterval = setInterval(checkSync, 2000);
    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.searchQuery, activeFolderTab]);

  const proxyMap = useMemo(() => {
    const map = new Map<string, ProxyItem>();
    for (const px of proxies) map.set(px.id, px);
    return map;
  }, [proxies]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const runningCount = useMemo(
    () => profiles.filter((p) => p.status === 'RUNNING' || p.status === 'STARTING').length,
    [profiles]
  );

  const folders = useMemo(
    () => ['ALL', ...Array.from(new Set(profiles.map((p) => p.folder || 'General')))],
    [profiles]
  );

  const filteredProfiles = useMemo(
    () =>
      profiles.filter((p) => {
        if (activeFolderTab === 'ANDROID_MOBILE') {
          const isAndroid =
            p.settings?.browser?.userAgent?.includes('Android') ||
            p.settings?.mobile?.enable ||
            p.tags?.includes('Android');
          if (!isAndroid) return false;
        } else if (activeFolderTab !== 'ALL' && (p.folder || 'General') !== activeFolderTab) {
          return false;
        }
        if (filter.searchQuery) {
          const q = filter.searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchNotes = (p.notes || '').toLowerCase().includes(q);
          const matchFolder = (p.folder || '').toLowerCase().includes(q);
          if (!matchName && !matchNotes && !matchFolder) return false;
        }
        return true;
      }),
    [profiles, activeFolderTab, filter.searchQuery]
  );

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  const paginatedProfiles = useMemo(
    () =>
      filteredProfiles.length > pageSize
        ? filteredProfiles.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : filteredProfiles,
    [filteredProfiles, currentPage]
  );

  const handlePingProxy = useCallback(async (proxyId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPingingProxyIds((prev) => {
      if (prev[proxyId]) return prev;
      return { ...prev, [proxyId]: true };
    });
    try {
      await useProxyStore.getState().testProxy({ proxyId });
    } finally {
      setPingingProxyIds((prev) => ({ ...prev, [proxyId]: false }));
    }
  }, []);

  const handleOptimizeMemory = useCallback(async () => {
    setIsOptimizingMemory(true);
    try {
      const res = await window.mahiAPI.optimizeFleetMemory();
      showToast({ type: 'success', title: '⚡ Memory Optimized', message: res.status });
    } catch {
      showToast({ type: 'error', title: 'Optimization Failed', message: 'Could not purge background memory cache.' });
    } finally {
      setIsOptimizingMemory(false);
    }
  }, [showToast]);

  const handleTestProxyForProfile = useCallback(
    async (p: Profile) => {
      const proxyId = p.settings?.network?.proxyId;
      if (!proxyId) {
        showToast({ type: 'info', title: 'Direct Connection', message: `Profile "${p.name}" has no proxy configured.` });
        return;
      }
      const proxy = proxyMap.get(proxyId);
      if (!proxy) {
        showToast({ type: 'error', title: 'Proxy Not Found', message: 'Configured proxy was not found in database.' });
        return;
      }

      showToast({ type: 'info', title: 'Testing Proxy...', message: `Checking connection to ${proxy.host}:${proxy.port}...` });
      try {
        const res = await window.mahiAPI.testProxy({
          proxyId: proxy.id,
          host: proxy.host,
          port: proxy.port,
          protocol: proxy.protocol,
          username: proxy.username,
        });
        if (res.success) {
          showToast({
            type: 'success',
            title: '● Proxy Live',
            message: `${getFlagEmoji(res.countryCode)} ${res.country || 'Location'} • ${res.latencyMs} ms latency`,
          });
          await fetchProxies();
        } else {
          showToast({ type: 'error', title: '● Proxy Failed', message: res.errorMessage || 'Connection failed' });
        }
      } catch (err: unknown) {
        showToast({ type: 'error', title: 'Test Failed', message: err instanceof Error ? err.message : String(err) });
      }
    },
    [proxyMap, showToast, fetchProxies]
  );

  const handleLaunchWithMobileMode = useCallback(
    async (p: Profile) => {
      setLaunchingMobileId(p.id);
      try {
        const res = await startProfileDetailed(p.id, { suppressConflictToast: true });
        if (!res.success && res.code === 'MOBILE_MODE_CONFLICT' && res.runningProfileId) {
          setMobileConflictTarget({
            targetProfile: p,
            runningProfileId: res.runningProfileId,
            runningProfileName: res.runningProfileName || 'another profile',
          });
        }
      } finally {
        setLaunchingMobileId(null);
      }
    },
    [startProfileDetailed]
  );

  const handleQuickCreateSubmit = useCallback(
    async (data: { name: string; folder: string; proxyId: string; notes: string }, runImmediately: boolean) => {
      setQuickCreating(true);
      const defaults = getDefaultProfileSettings();
      try {
        const newP = await createProfile({
          name: data.name,
          folder: data.folder,
          notes: data.notes,
          tags: ['Workspace'],
          settings: {
            ...defaults,
            network: { ...defaults.network, proxyId: data.proxyId || undefined },
          },
        });
        if (newP) {
          setIsQuickCreateOpen(false);
          if (runImmediately) await handleLaunchWithMobileMode(newP);
        }
      } catch (err) {
        console.debug('[ProfilesList] quick create failed (store handled toast)', err);
      } finally {
        setQuickCreating(false);
      }
    },
    [createProfile, handleLaunchWithMobileMode]
  );

  const handleBulkCreateSubmit = useCallback(
    async (data: {
      count: number;
      namePrefix: string;
      folder: string;
      osType: 'random' | 'windows' | 'mac';
      proxyId?: string;
    }) => {
      setIsBulking(true);
      try {
        const res = await bulkCreateProfiles(data);
        if (res && res.length > 0) setIsBulkModalOpen(false);
      } catch (err) {
        console.debug('[ProfilesList] bulk create failed (store handled toast)', err);
      } finally {
        setIsBulking(false);
      }
    },
    [bulkCreateProfiles]
  );

  const handleApplyRawProxyToProfile = useCallback(
    async (profile: Profile, rawInput: string) => {
      try {
        const result = await parseAndCreateProxy(rawInput.trim(), `${profile.name} Proxy`);
        if (result?.proxy) {
          const settings = profile.settings || getDefaultProfileSettings();
          await updateProfile(profile.id, {
            settings: {
              ...settings,
              network: { ...settings.network, proxyId: result.proxy.id, directConnection: false },
            },
          });
          showToast({
            type: 'success',
            title: 'Proxy Assigned',
            message: `Proxy successfully linked to "${profile.name}"!`,
          });
          setUniversalProxyModalProfile(null);
        }
      } catch (err: any) {
        showToast({ type: 'error', title: 'Assignment Failed', message: err.message || 'Failed to assign proxy' });
      }
    },
    [parseAndCreateProxy, updateProfile, showToast]
  );

  const handleToggleMobileMode = useCallback(async () => {
    if (!window.mahiAPI?.mobileRotatorSaveConfig) return;
    setIsTogglingMobileMode(true);
    const next = !mobileModeEnabled;
    try {
      await window.mahiAPI.mobileRotatorSaveConfig({ mobileModeEnabled: next });
      setMobileModeEnabled(next);
      await refreshMobileModeStatus();
      if (next) {
        const activeRunning = profiles.filter((p) => p.status === 'RUNNING' || p.status === 'STARTING');
        showToast({
          type: activeRunning.length > 1 ? 'warning' : 'success',
          title: 'Mobile Mode ON',
          message:
            activeRunning.length > 1
              ? `Currently ${activeRunning.length} profiles are running. Stop them to use single-profile IP rotation.`
              : 'Direct profiles will auto-rotate your mobile IP, save it to Notes, and enforce 1 profile at a time.',
        });
      } else {
        showToast({ type: 'info', title: 'Mobile Mode OFF', message: 'Switched back to multi-profile desktop mode.' });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Mobile Mode Toggle Failed',
        message: err?.message || 'Could not update Mobile Mode configuration',
      });
    } finally {
      setIsTogglingMobileMode(false);
    }
  }, [mobileModeEnabled, profiles, refreshMobileModeStatus, showToast]);

  const handleConfirmMobileStopAndSwitch = useCallback(async () => {
    if (!mobileConflictTarget) return;
    const { targetProfile, runningProfileId } = mobileConflictTarget;
    setIsSwitchingMobileProfile(true);
    try {
      const stopped = await stopProfile(runningProfileId);
      setMobileConflictTarget(null);
      if (stopped) await handleLaunchWithMobileMode(targetProfile);
    } finally {
      setIsSwitchingMobileProfile(false);
    }
  }, [mobileConflictTarget, stopProfile, handleLaunchWithMobileMode]);

  const handleRunOrStop = useCallback(
    async (p: Profile) => {
      if (p.status === 'RUNNING') await stopProfile(p.id);
      else await handleLaunchWithMobileMode(p);
    },
    [stopProfile, handleLaunchWithMobileMode]
  );

  const handleClone = useCallback(
    async (p: Profile) => {
      await cloneProfile({
        sourceProfileId: p.id,
        newName: `${p.name} (Copy)`,
        copyCookies: true,
        copyHistory: false,
        copyExtensions: true,
        copyBrowserSettings: true,
      });
    },
    [cloneProfile]
  );

  const handleExecuteStaggeredLaunch = useCallback(
    async (delayMs: number) => {
      if (selectedIds.length === 0) return;
      setIsStaggerLaunching(true);
      setStaggerProgress({ completed: 0, total: selectedIds.length, profileId: '' });

      const unsub = window.mahiAPI?.onBatchProgress ? window.mahiAPI.onBatchProgress((p) => setStaggerProgress(p)) : () => {};
      try {
        await bulkStartProfiles(selectedIds, delayMs);
        setIsStaggerLaunchModalOpen(false);
      } catch (err: any) {
        showToast({ type: 'error', title: 'Batch Launch Error', message: err.message || 'Failed during batch launch' });
      } finally {
        unsub();
        setIsStaggerLaunching(false);
        setStaggerProgress(null);
      }
    },
    [selectedIds, bulkStartProfiles, showToast]
  );

  const handleBulkStop = useCallback(async () => {
    if (selectedIds.length === 0) return;
    await bulkStopProfiles(selectedIds);
  }, [selectedIds, bulkStopProfiles]);

  const handleExecuteBulkProxyAssign = useCallback(
    async (data: { mode: 'single' | 'round-robin' | 'clear'; selectedProxyIds: string[]; rawInput: string }) => {
      if (selectedIds.length === 0) return;
      setIsBulkProxySaving(true);
      try {
        const finalProxyIds = [...data.selectedProxyIds];
        if (data.rawInput.trim()) {
          const lines = data.rawInput.split('\n').map((l) => l.trim()).filter(Boolean);
          for (let i = 0; i < lines.length; i++) {
            try {
              const parsed = await parseAndCreateProxy(lines[i], `Bulk Proxy ${i + 1}`);
              if (parsed?.proxy) finalProxyIds.push(parsed.proxy.id);
            } catch (err) {
              console.debug('[ProfilesList] bulk proxy line parse skipped', { lineIndex: i, err });
            }
          }
        }
        await bulkAssignProxies({
          profileIds: selectedIds,
          proxyIds: finalProxyIds,
          distributionMode: data.mode,
        });
        setIsBulkProxyModalOpen(false);
      } catch (err: any) {
        showToast({ type: 'error', title: 'Proxy Assignment Failed', message: err.message || 'Failed to assign proxies' });
      } finally {
        setIsBulkProxySaving(false);
      }
    },
    [selectedIds, parseAndCreateProxy, bulkAssignProxies, showToast]
  );

  const handleExecuteBulkEdit = useCallback(
    async (data: { folder: string; addTags: string; removeTags: string }) => {
      if (selectedIds.length === 0) return;
      setIsBulkEditSaving(true);
      try {
        const addTags = data.addTags.split(',').map((t) => t.trim()).filter(Boolean);
        const removeTags = data.removeTags.split(',').map((t) => t.trim()).filter(Boolean);
        await bulkUpdateProfiles({
          profileIds: selectedIds,
          folder: data.folder.trim() || undefined,
          addTags: addTags.length > 0 ? addTags : undefined,
          removeTags: removeTags.length > 0 ? removeTags : undefined,
        });
        setIsBulkEditModalOpen(false);
      } catch (err: any) {
        showToast({ type: 'error', title: 'Batch Edit Failed', message: err.message || 'Failed to update profiles' });
      } finally {
        setIsBulkEditSaving(false);
      }
    },
    [selectedIds, bulkUpdateProfiles, showToast]
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const count = selectedIds.length;
      for (const id of selectedIds) await deleteProfile(id);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      showToast({ type: 'info', title: 'Profiles Deleted', message: `Successfully deleted ${count} profiles.` });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Bulk Delete Error', message: err.message || 'Failed to delete some profiles' });
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedIds, deleteProfile, showToast]);

  const handleExecuteSingleWarmup = useCallback(async () => {
    if (!warmerTargetProfile) return;
    setIsWarming(true);
    const target = warmerTargetProfile;
    try {
      showToast({
        type: 'info',
        title: '🚜 Cookie Warmer Started',
        message: `Farming cookies for "${target.name}" (${warmerMode} mode)...`,
      });
      const res = await warmProfile(target.id, { mode: warmerMode });
      setWarmerTargetProfile(null);
      showToast({
        type: 'success',
        title: '🍪 Profile Warmed Successfully!',
        message: `Farmed ${res.farmedCookiesCount} cookies across ${res.visitedSitesCount} top domains.`,
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Warmup Error', message: err.message || 'Failed to warm profile' });
    } finally {
      setIsWarming(false);
    }
  }, [warmerTargetProfile, warmerMode, warmProfile, showToast]);

  const handleExecuteBulkWarmup = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setIsWarming(true);
    const count = selectedIds.length;
    try {
      showToast({
        type: 'info',
        title: '🚜 Bulk Warmup Started',
        message: `Farming ${count} selected profiles in ${warmerMode} mode...`,
      });
      const res = await warmBulkProfiles(selectedIds, { mode: warmerMode });
      setIsBulkWarmModalOpen(false);
      showToast({
        type: 'success',
        title: '🍪 Bulk Warmup Complete!',
        message: `Successfully warmed ${res.successCount} of ${count} profiles.`,
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Bulk Warmup Error', message: err.message || 'Failed to warm profiles' });
    } finally {
      setIsWarming(false);
    }
  }, [selectedIds, warmerMode, warmBulkProfiles, showToast]);

  const handleLaunchStealthChecker = useCallback(
    async (url: string) => {
      if (!stealthTestProfile) return;
      const targetP = stealthTestProfile;
      setStealthTestProfile(null);
      try {
        const curSettings = targetP.settings || getDefaultProfileSettings();
        await updateProfile(targetP.id, {
          settings: { ...curSettings, browser: { ...curSettings.browser, startupUrl: url } },
        });
        showToast({ type: 'info', title: 'Launching Stealth Test', message: `Opening ${url} with "${targetP.name}"...` });
        await handleLaunchWithMobileMode(targetP);
      } catch (err: any) {
        showToast({ type: 'error', title: 'Launch Failed', message: err.message || 'Could not launch browser' });
      }
    },
    [stealthTestProfile, updateProfile, showToast, handleLaunchWithMobileMode]
  );

  const handleInstantCreate = useCallback(async () => {
    if (instantCreating) return;
    setInstantCreating(true);
    const defaults = getDefaultProfileSettings();
    try {
      await createProfile({
        name: `Profile ${profiles.length + 1}`,
        folder: activeFolderTab !== 'ALL' ? activeFolderTab : 'General',
        tags: ['Workspace'],
        settings: defaults,
      });
    } catch (err) {
      console.debug('[ProfilesList] instant create failed (store handled toast)', err);
    } finally {
      setInstantCreating(false);
    }
  }, [instantCreating, createProfile, profiles.length, activeFolderTab]);

  const parseAndApplyProxy = useCallback(
    async (profileId: string, rawText: string) => {
      const s = rawText.trim();
      if (!s) {
        try {
          const { updateProfile: upd } = useProfileStore.getState();
          const defaults = getDefaultProfileSettings();
          await upd(profileId, { settings: { network: { ...defaults.network, directConnection: true, proxyId: undefined } } } as any);
          await fetchProfiles();
          showToast({ type: 'info', title: 'Direct Connection', message: 'Proxy removed.' });
        } catch (err) {
          console.debug('[ProfilesList] direct connection proxy clear failed', err);
        }
        return;
      }

      const parsed = parseProxyString(s);
      if (!parsed) {
        showToast({
          type: 'error',
          title: 'Invalid Proxy Format',
          message: 'Paste format: ip:port:user:pass or host:port or protocol://user:pass@host:port',
        });
        return;
      }

      setSavingProxy(true);
      try {
        showToast({ type: 'info', title: 'Testing Proxy...', message: `Checking ${parsed.host}:${parsed.port}...` });
        const testRes = await window.mahiAPI.testProxy({
          host: parsed.host,
          port: parsed.port,
          protocol: parsed.protocol as any,
          username: parsed.username,
          password: parsed.password,
        });
        const countryCode = testRes.countryCode || 'US';
        const countryName = testRes.country || getCountryNameFromCode(countryCode) || 'United States';
        const publicIp = testRes.ip || parsed.host;

        const { createProxy } = useProxyStore.getState();
        const newProxy = await createProxy({
          name: `${parsed.host}:${parsed.port}`,
          protocol: parsed.protocol as any,
          host: parsed.host,
          port: parsed.port,
          username: parsed.username || '',
          password: parsed.password || '',
          countryRegion: countryCode,
          countryName,
          ip: publicIp,
        });
        if (newProxy) {
          const { updateProfile: upd } = useProfileStore.getState();
          const defaults = getDefaultProfileSettings();
          await upd(profileId, {
            settings: { network: { ...defaults.network, directConnection: false, proxyId: newProxy.id } },
          } as any);
          await fetchProxies();
          await fetchProfiles();
          showToast({
            type: testRes.success ? 'success' : 'warning',
            title: testRes.success ? 'Proxy Verified' : 'Proxy Applied',
            message: `${getFlagEmoji(countryCode)} ${countryName} • ${testRes.latencyMs || 0}ms`,
          });
        }
      } catch (err: unknown) {
        showToast({ type: 'error', title: 'Proxy Error', message: err instanceof Error ? err.message : String(err) });
      } finally {
        setSavingProxy(false);
      }
    },
    [fetchProfiles, fetchProxies, showToast]
  );

  const handlePasteFromClipboard = useCallback(
    async (profileId: string) => {
      if (savingProxy) return;
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          showToast({ type: 'error', title: 'Clipboard Empty', message: 'Copy a proxy string first, then click paste.' });
          return;
        }
        await parseAndApplyProxy(profileId, text.trim());
      } catch {
        showToast({ type: 'error', title: 'Clipboard Access', message: 'Please click the cell to paste manually.' });
      }
    },
    [savingProxy, parseAndApplyProxy, showToast]
  );

  const handleBackupToCloud = useCallback(
    async (p: Profile) => {
      try {
        showToast({ type: 'info', title: 'Cloud Sync', message: `Backing up "${p.name}" to cloud...` });
        await window.mahiAPI.uploadProfileToCloud(p.id);
        showToast({ type: 'success', title: 'Cloud Sync', message: `"${p.name}" backed up successfully.` });
        if (window.mahiAPI?.getAllProfilesSyncStatus) {
          setSyncStatuses(await window.mahiAPI.getAllProfilesSyncStatus());
        }
      } catch (err: any) {
        showToast({ type: 'error', title: 'Sync Failed', message: err.message });
      }
    },
    [showToast]
  );

  const handleClaimGuest = useCallback(async () => {
    setIsClaimingGuest(true);
    try {
      const res = await claimGuestProfiles();
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Profiles Claimed',
          message: `Successfully claimed ${res.claimedCount} guest profile(s) to your account!`,
        });
        await fetchProfiles();
      } else {
        showToast({ type: 'error', title: 'Claim Profiles', message: res.error || 'Failed to claim profiles.' });
      }
    } finally {
      setIsClaimingGuest(false);
    }
  }, [claimGuestProfiles, showToast, fetchProfiles]);

  const handleToggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? filteredProfiles.map((p) => p.id) : []);
    },
    [filteredProfiles]
  );

  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  }, []);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, profile: Profile) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 208 - 16);
    const y = Math.min(e.clientY, window.innerHeight - 260 - 16);
    setContextMenu({ x, y, profile });
  }, []);

  const handleCopyProxy = useCallback(
    async (profile: Profile) => {
      const proxyId = profile.settings?.network?.proxyId;
      const proxy = proxyId ? proxyMap.get(proxyId) : undefined;
      if (proxy) {
        const proxyStr = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
        await navigator.clipboard.writeText(proxyStr);
        showToast({ type: 'success', title: 'Proxy Copied', message: `Copied ${proxyStr} to clipboard.` });
      } else {
        showToast({ type: 'info', title: 'Direct Connection', message: 'This profile uses direct connection (no proxy).' });
      }
    },
    [proxyMap, showToast]
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      <ProfileToolbar
        hasSessionToken={Boolean(accountSession?.token)}
        unassignedGuestCount={unassignedGuestProfiles?.length || 0}
        isClaimingGuest={isClaimingGuest}
        onClaimGuestProfiles={handleClaimGuest}
        onDismissGuestBanner={dismissGuestProfilesBanner}
        folders={folders}
        activeFolderTab={activeFolderTab}
        onSelectFolderTab={setActiveFolderTab}
        isFolderOverflowOpen={isFolderOverflowOpen}
        onToggleFolderOverflow={(e) => {
          e.stopPropagation();
          setIsFolderOverflowOpen((prev) => !prev);
        }}
        onCloseFolderOverflow={() => setIsFolderOverflowOpen(false)}
        onNavigate={onNavigate}
        mobileModeEnabled={mobileModeEnabled}
        isTogglingMobileMode={isTogglingMobileMode}
        onToggleMobileMode={handleToggleMobileMode}
        mobileRotatorSummary={mobileRotatorSummary}
        onRefreshMobileModeStatus={refreshMobileModeStatus}
        searchQuery={filter.searchQuery || ''}
        onSearchChange={(q) => setFilter({ searchQuery: q })}
        loading={loading}
        onRefreshProfiles={fetchProfiles}
        onOpenQuickCreate={() => setIsQuickCreateOpen(true)}
        onOpenBulkCreate={() => setIsBulkModalOpen(true)}
        onOpenUniversalImport={() => setIsUniversalImportOpen(true)}
        isSyncActive={isSyncActive}
        onOpenSynchronizer={() => setIsSynchronizerModalOpen(true)}
        runningCount={runningCount}
        isOptimizingMemory={isOptimizingMemory}
        onOptimizeMemory={handleOptimizeMemory}
        selectedIdsCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onOpenStaggerLaunch={() => {
          if (mobileModeEnabled && selectedIds.length > 1) {
            showToast({
              type: 'warning',
              title: 'Mobile Mode: 1 Profile Limit',
              message: 'Mobile Mode allows only 1 active profile at a time. Run profiles one-by-one or turn off Mobile Mode.',
            });
            return;
          }
          setIsStaggerLaunchModalOpen(true);
        }}
        onBulkStop={handleBulkStop}
        onOpenBulkProxy={() => setIsBulkProxyModalOpen(true)}
        onOpenBulkEdit={() => setIsBulkEditModalOpen(true)}
        onOpenBulkWarm={() => setIsBulkWarmModalOpen(true)}
        onOpenBulkDelete={() => setIsBulkDeleteModalOpen(true)}
      />

      {activeFolderTab === 'CLOUD_SYNC' ? (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
          <Suspense fallback={<PageLoadingFallback label="Loading Cloud Sync..." />}>
            <CloudSyncSection onNavigate={onNavigate} onProfileRestored={fetchProfiles} />
          </Suspense>
        </div>
      ) : activeFolderTab === 'STARTER_TEMPLATES' || profiles.length === 0 ? (
        <div className="flex-1 overflow-auto bg-slate-950">
          <Suspense fallback={<PageLoadingFallback label="Loading Templates..." />}>
            <StarterProfilesSection
              onNavigate={onNavigate}
              onOpenUniversalImport={() => setIsUniversalImportOpen(true)}
              isStandaloneTab={profiles.length > 0 && activeFolderTab === 'STARTER_TEMPLATES'}
              onSwitchToAllProfiles={() => setActiveFolderTab('ALL')}
            />
          </Suspense>
        </div>
      ) : (
        <ProfileTable
          profilesCount={profiles.length}
          loading={loading}
          filteredProfiles={filteredProfiles}
          paginatedProfiles={paginatedProfiles}
          proxyMap={proxyMap}
          selectedIdSet={selectedIdSet}
          mobileModeEnabled={mobileModeEnabled}
          launchingMobileId={launchingMobileId}
          syncStatuses={syncStatuses}
          syncProgressMap={syncProgressMap}
          fleetResources={fleetResources}
          pingingProxyIds={pingingProxyIds}
          searchQuery={filter.searchQuery || ''}
          activeFolderTab={activeFolderTab}
          onClearFilter={() => {
            setFilter({ searchQuery: '' });
            setActiveFolderTab('ALL');
          }}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelect={handleToggleSelect}
          instantCreating={instantCreating}
          onInstantCreate={handleInstantCreate}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          onPrevPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          onContextMenu={handleRowContextMenu}
          onRunOrStop={handleRunOrStop}
          onPingProxy={handlePingProxy}
          onOpenUniversalProxy={setUniversalProxyModalProfile}
          onPasteFromClipboard={handlePasteFromClipboard}
          onOpenWarmer={setWarmerTargetProfile}
          onOpenStealthTest={setStealthTestProfile}
          onBackupToCloud={handleBackupToCloud}
          onOpenSettings={(id) => {
            setSelectedProfileId(id);
            onNavigate('profile-settings');
          }}
          onTestProxyForProfile={handleTestProxyForProfile}
          onClone={handleClone}
          onDelete={setDeleteTargetId}
          contextMenu={contextMenu}
          onCloseContextMenu={() => setContextMenu(null)}
          onStopProfile={stopProfile}
          onCopyProxy={handleCopyProxy}
          onExportCookies={(id) => {
            setSelectedProfileId(id);
            onNavigate('cookies');
          }}
        />
      )}

      <Suspense fallback={null}>
        {proxyModalProfile && (
          <ProxyConfigModal
            profile={proxyModalProfile}
            initialProxy={proxyModalProfile.settings?.network?.proxyId ? proxyMap.get(proxyModalProfile.settings.network.proxyId) : undefined}
            isOpen={true}
            onClose={() => setProxyModalProfile(null)}
          />
        )}
        {isUniversalImportOpen && (
          <UniversalBulkImportModal isOpen={true} onClose={() => setIsUniversalImportOpen(false)} />
        )}
        {isSynchronizerModalOpen && (
          <SynchronizerModal isOpen={true} onClose={() => setIsSynchronizerModalOpen(false)} />
        )}
      </Suspense>

      {isQuickCreateOpen && (
        <QuickCreateModal
          defaultName={`Profile ${profiles.length + 1}`}
          proxies={proxies}
          isCreating={quickCreating}
          onClose={() => setIsQuickCreateOpen(false)}
          onSubmit={handleQuickCreateSubmit}
        />
      )}

      {isBulkModalOpen && (
        <BulkCreateModal
          proxies={proxies}
          isBulking={isBulking}
          onClose={() => setIsBulkModalOpen(false)}
          onSubmit={handleBulkCreateSubmit}
        />
      )}

      {universalProxyModalProfile && (
        <UniversalProxyModal
          profile={universalProxyModalProfile}
          onClose={() => setUniversalProxyModalProfile(null)}
          onFetchProxies={fetchProxies}
          onApplyProxy={handleApplyRawProxyToProfile}
        />
      )}

      {stealthTestProfile && (
        <StealthTesterModal
          profile={stealthTestProfile}
          onClose={() => setStealthTestProfile(null)}
          onLaunchChecker={handleLaunchStealthChecker}
        />
      )}

      {warmerTargetProfile && (
        <SingleWarmerModal
          profile={warmerTargetProfile}
          warmerMode={warmerMode}
          isWarming={isWarming}
          onChangeMode={setWarmerMode}
          onClose={() => setWarmerTargetProfile(null)}
          onStart={handleExecuteSingleWarmup}
        />
      )}

      {isBulkWarmModalOpen && (
        <BulkWarmerModal
          selectedCount={selectedIds.length}
          warmerMode={warmerMode}
          isWarming={isWarming}
          onChangeMode={setWarmerMode}
          onClose={() => setIsBulkWarmModalOpen(false)}
          onStart={handleExecuteBulkWarmup}
        />
      )}

      {isStaggerLaunchModalOpen && (
        <StaggerLaunchModal
          selectedCount={selectedIds.length}
          isLaunching={isStaggerLaunching}
          progress={staggerProgress}
          onClose={() => setIsStaggerLaunchModalOpen(false)}
          onLaunch={handleExecuteStaggeredLaunch}
        />
      )}

      {isBulkProxyModalOpen && (
        <BulkProxyModal
          selectedCount={selectedIds.length}
          proxies={proxies}
          isSaving={isBulkProxySaving}
          onClose={() => setIsBulkProxyModalOpen(false)}
          onApply={handleExecuteBulkProxyAssign}
        />
      )}

      {isBulkEditModalOpen && (
        <BulkEditModal
          selectedCount={selectedIds.length}
          isSaving={isBulkEditSaving}
          onClose={() => setIsBulkEditModalOpen(false)}
          onSave={handleExecuteBulkEdit}
        />
      )}

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="Delete Profile"
        message="Are you sure you want to delete this profile? All cookies, cache, and history files will be removed permanently."
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTargetId) {
            await deleteProfile(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        onCancel={() => setDeleteTargetId(null)}
      />

      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title={`Delete ${selectedIds.length} Profiles`}
        message={`Are you sure you want to delete all ${selectedIds.length} selected profiles? All associated browser cookies, local caches, and session data will be permanently removed.`}
        confirmLabel={isBulkDeleting ? 'Deleting...' : `Delete All (${selectedIds.length})`}
        isDestructive
        onConfirm={handleBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />

      {isWarming && (
        <CookieWarmerIndicator
          warmerMode={warmerMode}
          targetProfileName={warmerTargetProfile?.name}
          selectedCount={selectedIds.length}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(mobileConflictTarget)}
        title="Mobile Mode: Stop Running Profile First?"
        message={
          mobileConflictTarget
            ? `Mobile Mode allows only 1 running profile at a time so IP rotation never interrupts another session. "${mobileConflictTarget.runningProfileName}" is currently running. Stop it, rotate to a fresh IP, and launch "${mobileConflictTarget.targetProfile.name}"?`
            : ''
        }
        confirmLabel={isSwitchingMobileProfile ? 'Stopping & Switching...' : 'Stop & Run Profile'}
        cancelLabel="Cancel"
        onConfirm={handleConfirmMobileStopAndSwitch}
        onCancel={() => {
          if (!isSwitchingMobileProfile) setMobileConflictTarget(null);
        }}
      />
    </div>
  );
};
