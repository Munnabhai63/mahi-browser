import React, { useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Square,
  Search,
  Settings as SettingsIcon,
  Copy,
  Trash2,
  FolderPlus,
  Cookie,
  Globe2,
  Tag,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Download,
  Upload,
  Clipboard,
  ArrowUpDown,
  Activity,
  Zap,
  Cloud,
  UploadCloud,
  Loader2,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';
import { getDefaultProfileSettings } from '../../10_CONFIG/shared/constants/defaults.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { NavigationPage } from '../components/Sidebar.js';
import { ProxyConfigModal } from '../components/ProxyConfigModal.js';
import { CountryFlag, getFlagEmoji, getCountryNameFromCode } from '../components/CountryFlag.js';
import { UniversalBulkImportModal } from '../components/UniversalBulkImportModal.js';
import { SynchronizerModal } from '../components/SynchronizerModal.js';
import { CloudSyncSection } from '../components/CloudSyncSection.js';
import { StarterProfilesSection } from '../components/StarterProfilesSection.js';

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
    startProfile,
    stopProfile,
    bulkStartProfiles,
    bulkStopProfiles,
    bulkUpdateProfiles,
    bulkDeleteProfiles,
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isUniversalImportOpen, setIsUniversalImportOpen] = useState(false);
  const [isSynchronizerModalOpen, setIsSynchronizerModalOpen] = useState(false);
  const [activeFolderTab, setActiveFolderTab] = useState<string>('ALL');
  const [syncStatuses, setSyncStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (window.mahiAPI?.getAllProfilesSyncStatus) {
      window.mahiAPI.getAllProfilesSyncStatus().then(setSyncStatuses).catch(() => {});
    }
  }, [profiles]);

  // Staggered Batch Launch State
  const [isStaggerLaunchModalOpen, setIsStaggerLaunchModalOpen] = useState(false);
  const [staggerDelayMs, setStaggerDelayMs] = useState(1500);
  const [isStaggerLaunching, setIsStaggerLaunching] = useState(false);
  const [staggerProgress, setStaggerProgress] = useState<{ completed: number; total: number; profileId: string; pid?: number; error?: string } | null>(null);

  // Bulk Proxy Modal State
  const [isBulkProxyModalOpen, setIsBulkProxyModalOpen] = useState(false);
  const [bulkProxyMode, setBulkProxyMode] = useState<'single' | 'round-robin' | 'clear'>('single');
  const [selectedBulkProxyIds, setSelectedBulkProxyIds] = useState<string[]>([]);
  const [rawBulkProxyInput, setRawBulkProxyInput] = useState('');
  const [isBulkProxySaving, setIsBulkProxySaving] = useState(false);

  // Bulk Edit Tags / Folder State
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditFolder, setBulkEditFolder] = useState('');
  const [bulkEditAddTags, setBulkEditAddTags] = useState('');
  const [bulkEditRemoveTags, setBulkEditRemoveTags] = useState('');
  const [isBulkEditSaving, setIsBulkEditSaving] = useState(false);

  // Bulk Create State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [bulkPrefix, setBulkPrefix] = useState('Profile');
  const [bulkFolder, setBulkFolder] = useState('General');
  const [bulkOs, setBulkOs] = useState<'random' | 'windows' | 'mac'>('random');
  const [bulkProxyId, setBulkProxyId] = useState<string>('');
  const [isBulking, setIsBulking] = useState(false);


  // Quick Universal Proxy Modal state
  const [universalProxyModalProfile, setUniversalProxyModalProfile] = useState<Profile | null>(null);
  const [rawProxyInput, setRawProxyInput] = useState('');
  const [isTestingRawProxy, setIsTestingRawProxy] = useState(false);
  const [rawTestResult, setRawTestResult] = useState<{ success: boolean; latencyMs?: number; country?: string; countryCode?: string; errorMessage?: string } | null>(null);

  // Stealth Test Modal State
  const [stealthTestProfile, setStealthTestProfile] = useState<Profile | null>(null);

  // Cookie Warmer State
  const [warmerTargetProfile, setWarmerTargetProfile] = useState<Profile | null>(null);
  const [isBulkWarmModalOpen, setIsBulkWarmModalOpen] = useState(false);
  const [warmerMode, setWarmerMode] = useState<'quick' | 'standard' | 'deep'>('quick');
  const [isWarming, setIsWarming] = useState(false);
  const [warmingProgress, setWarmingProgress] = useState<{ current: number; total: number; statusText: string } | null>(null);

  // Synchronizer State
  const [isSyncActive, setIsSyncActive] = useState(false);

  // Context Menu State (GAP-03)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    profile: Profile;
  } | null>(null);

  // Folder Overflow Dropdown State (GAP-04)
  const [isFolderOverflowOpen, setIsFolderOverflowOpen] = useState(false);

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


  const toggleSynchronizer = async () => {
    try {
      const runningCount = profiles.filter((p) => p.status === 'RUNNING').length;
      if (!isSyncActive) {
        if (window.mahiAPI?.synchronizerStart) {
          await window.mahiAPI.synchronizerStart();
        }
        setIsSyncActive(true);
        showToast({
          type: 'success',
          title: '🪞 Action Synchronizer ON',
          message: `Mirroring mouse, typing & scroll across all running profiles (${runningCount} active)!`,
        });
      } else {
        if (window.mahiAPI?.synchronizerStop) {
          await window.mahiAPI.synchronizerStop();
        }

        setIsSyncActive(false);
        showToast({
          type: 'info',
          title: 'Synchronizer Paused',
          message: 'Multi-window action sync is now deactivated.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Synchronizer Error',
        message: err.message || 'Could not toggle sync hub',
      });
    }
  };



  const runningCount = profiles.filter((p) => p.status === 'RUNNING' || p.status === 'STARTING').length;

  // Real-Time Fleet Resource Monitoring
  const [fleetResources, setFleetResources] = useState<Record<string, { pid?: number; memoryMB: number; cpuPercent: number }>>({});
  const [isOptimizingMemory, setIsOptimizingMemory] = useState(false);

  useEffect(() => {
    if (window.mahiAPI) {
      window.mahiAPI.getFleetResources().then((summary) => {
        if (summary?.profiles) {
          setFleetResources(summary.profiles);
        }
      });

      const unsub = window.mahiAPI.onFleetResourceUsage((summary) => {
        if (summary?.profiles) {
          setFleetResources(summary.profiles);
        }
      });
      return () => unsub();
    }
  }, []);

  const handleOptimizeMemory = async () => {
    setIsOptimizingMemory(true);
    try {
      const res = await window.mahiAPI.optimizeFleetMemory();
      showToast({
        type: 'success',
        title: '⚡ Memory Optimized',
        message: res.status,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Optimization Failed',
        message: 'Could not purge background memory cache.',
      });
    } finally {
      setIsOptimizingMemory(false);
    }
  };

  // Quick Create Form State
  const [quickName, setQuickName] = useState('');
  const [quickFolder, setQuickFolder] = useState('General');
  const [quickProxyId, setQuickProxyId] = useState<string>('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickCreating, setQuickCreating] = useState(false);

  // Dedicated Proxy Config Modal
  const [proxyModalProfile, setProxyModalProfile] = useState<Profile | null>(null);

  // Inline proxy edit state
  const [editingProxyId, setEditingProxyId] = useState<string | null>(null);
  const [proxyInput, setProxyInput] = useState('');
  const [savingProxy, setSavingProxy] = useState(false);

  // Instant create state
  const [instantCreating, setInstantCreating] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchProxies();

    // Check Synchronizer active status periodically
    const checkSync = async () => {
      try {
        if (window.mahiAPI) {
          const st = await window.mahiAPI.synchronizerGetStatus();
          if (st) setIsSyncActive(Boolean(st.enabled));
        }
      } catch {}
    };
    checkSync();
    const syncInterval = setInterval(checkSync, 2000);
    return () => clearInterval(syncInterval);
  }, []);


  const folders = ['ALL', ...Array.from(new Set(profiles.map((p) => p.folder || 'General')))];


  const filteredProfiles = profiles.filter((p) => {
    if (activeFolderTab !== 'ALL' && (p.folder || 'General') !== activeFolderTab) {
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
  });

  // Pagination State for Scale & Performance (GAP-09)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.searchQuery, activeFolderTab]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  const paginatedProfiles = filteredProfiles.length > 50
    ? filteredProfiles.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredProfiles;

  const handleOpenQuickCreate = () => {
    setQuickName(`Profile ${profiles.length + 1}`);
    setQuickFolder('General');
    setQuickProxyId('');
    setQuickNotes('');
    setIsQuickCreateOpen(true);
  };

  const handleTestProxyForProfile = async (p: Profile) => {
    const proxyId = p.settings?.network?.proxyId;
    if (!proxyId) {
      showToast({ type: 'info', title: 'Direct Connection', message: `Profile "${p.name}" has no proxy configured.` });
      return;
    }
    const proxy = proxies.find((px) => px.id === proxyId);
    if (!proxy) {
      showToast({ type: 'error', title: 'Proxy Not Found', message: 'Configured proxy was not found in database.' });
      return;
    }

    showToast({ type: 'info', title: 'Testing Proxy...', message: `Checking connection to ${proxy.host}:${proxy.port}...` });
    try {
      const res = await window.mahiAPI.testProxy({
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
      });

      if (res.success) {
        showToast({
          type: 'success',
          title: '● Proxy Live',
          message: `${getFlagEmoji(res.countryCode)} ${res.country || 'Location'} • ${res.latencyMs} ms latency`,
        });
        await fetchProxies();
      } else {
        showToast({
          type: 'error',
          title: '● Proxy Failed',
          message: res.errorMessage || 'Connection failed',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Test Failed', message: msg });
    }
  };

  const handleQuickCreateSubmit = async (e: React.FormEvent, runImmediately = false) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setQuickCreating(true);

    const defaults = getDefaultProfileSettings();
    try {
      const newP = await createProfile({
        name: quickName.trim(),
        folder: quickFolder.trim() || 'General',
        notes: quickNotes.trim(),
        tags: ['Workspace'],
        settings: {
          ...defaults,
          network: {
            ...defaults.network,
            proxyId: quickProxyId || undefined,
          },
        },
      });

      if (newP) {
        setIsQuickCreateOpen(false);
        if (runImmediately) {
          await startProfile(newP.id);
        }
      }
    } catch {
      // handled by store
    } finally {
      setQuickCreating(false);
    }
  };

  const handleBulkCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkCount < 1) return;
    setIsBulking(true);
    try {
      const res = await bulkCreateProfiles({
        count: bulkCount,
        namePrefix: bulkPrefix.trim() || 'Profile',
        folder: bulkFolder.trim() || 'General',
        osType: bulkOs,
        proxyId: bulkProxyId || undefined,
      });

      if (res && res.length > 0) {
        setIsBulkModalOpen(false);
      }
    } catch {
      // handled in store
    } finally {
      setIsBulking(false);
    }
  };

  const handleTestRawProxy = async () => {
    if (!rawProxyInput.trim()) return;
    setIsTestingRawProxy(true);
    setRawTestResult(null);
    try {
      const parsed = await window.mahiAPI.parseAndCreateProxy(rawProxyInput.trim());
      if (parsed) {
        setRawTestResult(parsed.testResult);
        await fetchProxies();
      }
    } catch (err: any) {
      setRawTestResult({
        success: false,
        errorMessage: err.message || 'Invalid proxy format',
      });
    } finally {
      setIsTestingRawProxy(false);
    }
  };

  const handleApplyRawProxyToProfile = async () => {
    if (!universalProxyModalProfile || !rawProxyInput.trim()) return;
    setIsTestingRawProxy(true);
    try {
      const result = await parseAndCreateProxy(rawProxyInput.trim(), `${universalProxyModalProfile.name} Proxy`);
      if (result?.proxy) {
        // Attach to profile
        const settings = universalProxyModalProfile.settings || getDefaultProfileSettings();
        await updateProfile(universalProxyModalProfile.id, {
          settings: {
            ...settings,
            network: {
              ...settings.network,
              proxyId: result.proxy.id,
              directConnection: false,
            },
          },
        });

        showToast({
          type: 'success',
          title: 'Proxy Assigned',
          message: `Proxy successfully linked to "${universalProxyModalProfile.name}"!`,
        });

        setUniversalProxyModalProfile(null);
        setRawProxyInput('');
        setRawTestResult(null);
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Assignment Failed',
        message: err.message || 'Failed to assign proxy',
      });
    } finally {
      setIsTestingRawProxy(false);
    }
  };

  const handleRunOrStop = async (p: Profile) => {

    if (p.status === 'RUNNING') {
      await stopProfile(p.id);
    } else {
      await startProfile(p.id);
    }
  };

  const handleClone = async (p: Profile) => {
    await cloneProfile({
      sourceProfileId: p.id,
      newName: `${p.name} (Copy)`,
      copyCookies: true,
      copyHistory: false,
      copyExtensions: true,
      copyBrowserSettings: true,
    });
  };

  const handleExecuteStaggeredLaunch = async () => {
    if (selectedIds.length === 0) return;
    setIsStaggerLaunching(true);
    setStaggerProgress({ completed: 0, total: selectedIds.length, profileId: '' });

    // Listen to real-time progress events
    const unsub = window.mahiAPI?.onBatchProgress
      ? window.mahiAPI.onBatchProgress((p) => {
          setStaggerProgress(p);
        })
      : () => {};

    try {
      await bulkStartProfiles(selectedIds, staggerDelayMs);
      setIsStaggerLaunchModalOpen(false);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Batch Launch Error',
        message: err.message || 'Failed during batch launch',
      });
    } finally {
      unsub();
      setIsStaggerLaunching(false);
      setStaggerProgress(null);
    }
  };

  const handleBulkStop = async () => {
    if (selectedIds.length === 0) return;
    await bulkStopProfiles(selectedIds);
  };

  const handleExecuteBulkProxyAssign = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkProxySaving(true);
    try {
      let finalProxyIds = [...selectedBulkProxyIds];

      // If user pasted raw proxies in text area
      if (rawBulkProxyInput.trim()) {
        const lines = rawBulkProxyInput
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        for (let i = 0; i < lines.length; i++) {
          try {
            const parsed = await parseAndCreateProxy(lines[i], `Bulk Proxy ${i + 1}`);
            if (parsed?.proxy) {
              finalProxyIds.push(parsed.proxy.id);
            }
          } catch {}
        }
      }

      await bulkAssignProxies({
        profileIds: selectedIds,
        proxyIds: finalProxyIds,
        distributionMode: bulkProxyMode,
      });

      setIsBulkProxyModalOpen(false);
      setRawBulkProxyInput('');
      setSelectedBulkProxyIds([]);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Proxy Assignment Failed',
        message: err.message || 'Failed to assign proxies',
      });
    } finally {
      setIsBulkProxySaving(false);
    }
  };

  const handleExecuteBulkEdit = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkEditSaving(true);
    try {
      const addTags = bulkEditAddTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const removeTags = bulkEditRemoveTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await bulkUpdateProfiles({
        profileIds: selectedIds,
        folder: bulkEditFolder.trim() || undefined,
        addTags: addTags.length > 0 ? addTags : undefined,
        removeTags: removeTags.length > 0 ? removeTags : undefined,
      });

      setIsBulkEditModalOpen(false);
      setBulkEditFolder('');
      setBulkEditAddTags('');
      setBulkEditRemoveTags('');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Batch Edit Failed',
        message: err.message || 'Failed to update profiles',
      });
    } finally {
      setIsBulkEditSaving(false);
    }
  };

  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);


  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const count = selectedIds.length;
      for (const id of selectedIds) {
        await deleteProfile(id);
      }
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      showToast({
        type: 'info',
        title: 'Profiles Deleted',
        message: `Successfully deleted ${count} profiles.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Bulk Delete Error',
        message: err.message || 'Failed to delete some profiles',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExecuteSingleWarmup = async () => {
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
      showToast({
        type: 'error',
        title: 'Warmup Error',
        message: err.message || 'Failed to warm profile',
      });
    } finally {
      setIsWarming(false);
    }
  };

  const handleExecuteBulkWarmup = async () => {
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
      showToast({
        type: 'error',
        title: 'Bulk Warmup Error',
        message: err.message || 'Failed to warm profiles',
      });
    } finally {
      setIsWarming(false);
    }
  };


  const handleLaunchStealthChecker = async (url: string) => {
    if (!stealthTestProfile) return;
    const targetP = stealthTestProfile;
    setStealthTestProfile(null);
    try {
      // Update startupUrl
      const curSettings = targetP.settings || getDefaultProfileSettings();
      await updateProfile(targetP.id, {
        settings: {
          ...curSettings,
          browser: {
            ...curSettings.browser,
            startupUrl: url,
          },
        },
      });

      // Start profile
      showToast({
        type: 'info',
        title: 'Launching Stealth Test',
        message: `Opening ${url} with "${targetP.name}"...`,
      });
      await startProfile(targetP.id);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Launch Failed',
        message: err.message || 'Could not launch browser',
      });
    }
  };



  // Instant 1-click profile creation — no modal needed
  const handleInstantCreate = async () => {
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
    } catch {
      // handled by store toast
    } finally {
      setInstantCreating(false);
    }
  };

  // Convert 2-letter country code into flag emoji
  const getCountryFlag = (countryCode?: string): string => {
    if (!countryCode) return '🌐';
    const clean = countryCode.trim().toUpperCase();
    if (clean.length === 2 && /^[A-Z]{2}$/.test(clean)) {
      const codePoints = clean
        .split('')
        .map((char) => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    }
    return '🌐';
  };

  // Asynchronous Geo Location Resolver for Proxy Host
  const detectCountryForHost = async (host: string): Promise<string> => {
    const h = host.toLowerCase();
    if (h.includes('-us') || h.includes('.us') || h.includes('usa')) return 'US';
    if (h.includes('-gb') || h.includes('-uk') || h.includes('.uk')) return 'GB';
    if (h.includes('-de') || h.includes('.de')) return 'DE';
    if (h.includes('-in') || h.includes('.in')) return 'IN';
    if (h.includes('-ca') || h.includes('.ca')) return 'CA';
    if (h.includes('-fr') || h.includes('.fr')) return 'FR';
    if (h.includes('-nl') || h.includes('.nl')) return 'NL';
    if (h.includes('-sg') || h.includes('.sg')) return 'SG';
    if (h.includes('-jp') || h.includes('.jp')) return 'JP';

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`https://freeipapi.com/api/json/${host}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (data.countryCode && data.countryCode.length === 2) {
          return data.countryCode.toUpperCase();
        }
      }
    } catch {}

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`https://ipapi.co/${host}/country/`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const text = (await res.text()).trim().toUpperCase();
        if (text.length === 2 && /^[A-Z]{2}$/.test(text)) {
          return text;
        }
      }
    } catch {}

    return 'US'; // Default standard proxy location
  };

  // Parse proxy string: supports host:port, host:port:user:pass, protocol://host:port, protocol://user:pass@host:port
  const parseProxyString = (raw: string): { protocol: string; host: string; port: number; username?: string; password?: string } | null => {
    let s = raw.trim();
    if (!s) return null;

    // Strip wrapping quotes or whitespace
    s = s.replace(/^["']|["']$/g, '').trim();

    let protocol = 'http';
    let rest = s;

    // Extract protocol if present
    const protoMatch = rest.match(/^(https?|socks[45]?):\/\//i);
    if (protoMatch) {
      protocol = protoMatch[1].toLowerCase();
      rest = rest.slice(protoMatch[0].length);
    }

    // Check for user:pass@host:port
    const atIdx = rest.indexOf('@');
    let username: string | undefined;
    let password: string | undefined;
    if (atIdx > 0) {
      const creds = rest.slice(0, atIdx);
      rest = rest.slice(atIdx + 1);
      const colonIdx = creds.indexOf(':');
      if (colonIdx > -1) {
        username = creds.slice(0, colonIdx);
        password = creds.slice(colonIdx + 1);
      } else {
        username = creds;
      }
    }

    // Parse host:port or host:port:user:pass
    const parts = rest.split(':');
    if (parts.length < 2) return null;

    const host = parts[0].trim();
    const port = parseInt(parts[1].trim(), 10);
    if (!host || isNaN(port)) return null;

    // host:port:user:pass format
    if (parts.length >= 4 && !username) {
      username = parts[2].trim();
      password = parts.slice(3).join(':').trim();
    }

    return { protocol, host, port, username, password };
  };

  // Smart Parse Proxy & Auto Detect Geo Location
  const parseAndApplyProxy = async (profileId: string, rawText: string) => {
    const s = rawText.trim();
    if (!s) {
      // Clear proxy (Direct Connection)
      try {
        const { updateProfile: upd } = useProfileStore.getState();
        const defaults = getDefaultProfileSettings();
        await upd(profileId, { settings: { network: { ...defaults.network, directConnection: true, proxyId: undefined } } } as any);
        await fetchProfiles();
        showToast({ type: 'info', title: 'Direct Connection', message: 'Proxy removed.' });
      } catch {}
      setEditingProxyId(null);
      setProxyInput('');
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
      
      // Perform live proxy test to resolve actual exit IP, country and latency
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
        countryName: countryName,
        ip: publicIp,
      });

      if (newProxy) {
        const { updateProfile: upd } = useProfileStore.getState();
        const defaults = getDefaultProfileSettings();
        await upd(profileId, {
          settings: {
            network: { ...defaults.network, directConnection: false, proxyId: newProxy.id },
          },
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
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ type: 'error', title: 'Proxy Error', message: msg });
    } finally {
      setSavingProxy(false);
      setEditingProxyId(null);
      setProxyInput('');
    }
  };

  // Inline proxy save wrapper
  const handleInlineProxySave = async (profileId: string) => {
    if (savingProxy) return;
    await parseAndApplyProxy(profileId, proxyInput);
  };

  // 1-Click Clipboard Paste Handler
  const handlePasteFromClipboard = async (profileId: string) => {
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
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Top GoLogin-Style Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: GoLogin-Style Folder Tabs with Overflow Containment (GAP-04) */}
        <div className="flex items-center space-x-2">
          {folders.slice(0, 5).map((folder) => (
            <button
              key={folder}
              onClick={() => {
                setActiveFolderTab(folder);
                setIsFolderOverflowOpen(false);
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
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFolderOverflowOpen((prev) => !prev);
                }}
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
                        setActiveFolderTab(folder);
                        setIsFolderOverflowOpen(false);
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

          {/* Cloud Sync Tab */}
          <button
            onClick={() => setActiveFolderTab('CLOUD_SYNC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeFolderTab === 'CLOUD_SYNC'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Sync</span>
          </button>

          {/* Starter Templates Tab */}
          <button
            onClick={() => setActiveFolderTab('STARTER_TEMPLATES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeFolderTab === 'STARTER_TEMPLATES'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Starter Templates</span>
          </button>
        </div>

        {/* Right: Search & Action Buttons */}
        <div className="flex items-center space-x-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filter.searchQuery || ''}
              onChange={(e) => setFilter({ searchQuery: e.target.value })}
              placeholder="Search profiles or notes..."
              className="w-full pl-9 pr-7 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />
            {filter.searchQuery && (
              <button
                type="button"
                onClick={() => setFilter({ searchQuery: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchProfiles()}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Quick Create Button */}
          <button
            onClick={handleOpenQuickCreate}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Profile</span>
          </button>

          {/* Bulk Create Button (Normalized Teal Brand Accent - GAP-02) */}
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 active:scale-95 transition-all"
            title="Create 5, 10, 20 or more profiles at once"
          >
            <Layers className="w-4 h-4 text-teal-500" />
            <span>Bulk Create</span>
          </button>

          {/* Universal Bulk Import Button */}
          <button
            onClick={() => setIsUniversalImportOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 active:scale-95 transition-all"
            title="Import 50+ Accounts from TXT, CSV, Netscape or JSON with cookies & proxies"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Import</span>
          </button>


          {/* Synchronizer Action Mirror Button */}
          <button
            onClick={() => setIsSynchronizerModalOpen(true)}
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

          {/* Real-Time Memory Optimizer Button */}
          {runningCount > 0 && (
            <button
              onClick={handleOptimizeMemory}
              disabled={isOptimizingMemory}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600/80 to-cyan-600/80 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-500/20 flex items-center space-x-1.5 active:scale-95 transition-all disabled:opacity-50"
              title="Purge standby memory cache across all active browser profiles"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${isOptimizingMemory ? 'animate-spin' : ''}`} />
              <span>{isOptimizingMemory ? 'Optimizing...' : 'Optimize RAM'}</span>
            </button>
          )}


          {/* Full Wizard Button */}
          <button
            onClick={() => onNavigate('create-profile')}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-all"
          >
            Advanced Setup
          </button>


        </div>
      </div>

      {/* Bulk Action Bar (when items selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-teal-50 dark:bg-slate-900 border-b border-teal-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between text-xs text-teal-800 dark:text-teal-200 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <span className="font-bold bg-teal-600/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-md">
              {selectedIds.length}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">profiles selected</span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-slate-200 text-[11px] underline ml-2"
            >
              Deselect All
            </button>
          </div>
          <div className="flex items-center space-x-2.5">
            {/* Staggered Launch Button */}
            <button
              onClick={() => setIsStaggerLaunchModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-bold flex items-center space-x-1.5 hover:from-teal-500 hover:to-emerald-500 shadow-sm transition-all active:scale-95"
              title="Launch selected profiles with CPU-safe staggered delay"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Selected ({selectedIds.length})</span>
            </button>

            {/* Bulk Stop Button */}
            <button
              onClick={handleBulkStop}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-xl font-bold flex items-center space-x-1.5 hover:bg-amber-500 shadow-sm transition-all active:scale-95"
              title="Stop all running selected profiles"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop All</span>
            </button>

            {/* Bulk Proxy Assign Button */}
            <button
              onClick={() => setIsBulkProxyModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
              title="Assign single proxy or round-robin distribute proxy list"
            >
              <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Assign Proxy</span>
            </button>

            {/* Bulk Edit Tags / Folder Button */}
            <button
              onClick={() => setIsBulkEditModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
              title="Batch edit folder and tags"
            >
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>Edit Tags/Folder</span>
            </button>

            {/* Bulk Warmup Button */}
            <button
              onClick={() => setIsBulkWarmModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold flex items-center space-x-1.5 hover:from-amber-600 hover:to-amber-700 shadow-sm transition-all active:scale-95"
              title="Auto-Farm Cookies for selected profiles"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Warm ({selectedIds.length})</span>
            </button>

            {/* Bulk Delete Button */}
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-3 py-1.5 bg-rose-600/90 text-white rounded-xl font-bold flex items-center space-x-1.5 hover:bg-rose-600 shadow-sm transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}



      {/* Main View: GoLogin-Style Table, Cloud Sync, or Starter Templates Section */}
      {activeFolderTab === 'CLOUD_SYNC' ? (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
          <CloudSyncSection onNavigate={onNavigate} onProfileRestored={fetchProfiles} />
        </div>
      ) : activeFolderTab === 'STARTER_TEMPLATES' || profiles.length === 0 ? (
        <div className="flex-1 overflow-auto bg-slate-950">
          <StarterProfilesSection
            onNavigate={onNavigate}
            onOpenUniversalImport={() => setIsUniversalImportOpen(true)}
            isStandaloneTab={profiles.length > 0 && activeFolderTab === 'STARTER_TEMPLATES'}
            onSwitchToAllProfiles={() => setActiveFolderTab('ALL')}
          />
        </div>
      ) : (
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        {filteredProfiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4">
              <Globe2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">No Profiles Match Filter</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
              No profiles found matching "{filter.searchQuery || activeFolderTab}". Try clearing your search query or switching folders.
            </p>
            <button
              onClick={() => {
                setFilter({ searchQuery: '' });
                setActiveFolderTab('ALL');
              }}
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
                    checked={selectedIds.length === filteredProfiles.length && filteredProfiles.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filteredProfiles.map((p) => p.id));
                      else setSelectedIds([]);
                    }}
                    className="rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th className="py-3 px-4 font-normal">
                  <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 font-normal">
                    <span>Name</span>
                    <span className="text-[11px] text-slate-400">↑</span>
                    <button
                      onClick={handleInstantCreate}
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

                <th className="py-3 px-4 font-normal">Proxy & Location</th>
                <th className="py-3 px-4 text-right w-36 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedProfiles.map((p) => {
                const proxy = proxies.find((px) => px.id === p.settings?.network?.proxyId);
                const isRunning = p.status === 'RUNNING';
                const isStarting = p.status === 'STARTING';

                return (
                  <tr
                    key={p.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const menuWidth = 208;
                      const menuHeight = 260;
                      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 16);
                      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 16);
                      setContextMenu({ x, y, profile: p });
                    }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors group cursor-context-menu"
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds([...selectedIds, p.id]);
                          else setSelectedIds(selectedIds.filter((id) => id !== p.id));
                        }}
                        className="rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500"
                      />
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                          {p.name}
                        </span>
                        {p.folder && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {p.folder}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* State & Run Button (GoLogin Style: [Run] ○ ready) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleRunOrStop(p)}
                          disabled={isStarting}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all duration-150 active:scale-95 shadow-xs ${
                            isRunning
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 hover:shadow-rose-500/10'
                              : isStarting
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 cursor-wait'
                              : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 hover:border-teal-500/50'
                          }`}
                        >
                          {isStarting ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                              <span>Starting...</span>
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

                        <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-normal">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isRunning
                                ? 'bg-emerald-500 animate-pulse'
                                : isStarting
                                ? 'bg-amber-500 animate-spin'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                          <span>{isRunning ? 'running' : isStarting ? 'starting' : 'ready'}</span>
                          {syncStatuses[p.id] === 'SYNCED' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5" title="Synced to Cloud">
                              ☁️ Synced
                            </span>
                          ) : syncStatuses[p.id] === 'PENDING' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5" title="Pending Cloud Backup">
                              ☁️ Pending
                            </span>
                          ) : null}
                          {isRunning && fleetResources[p.id] && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0 shadow-sm"
                              title={`Process PID: ${fleetResources[p.id].pid} | CPU Usage: ${fleetResources[p.id].cpuPercent}%`}
                            >
                              <Activity className="w-2.5 h-2.5 text-emerald-400" />
                              <span>{fleetResources[p.id].memoryMB}MB</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Notes (Account / Login email) */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-sans text-xs">
                      {(() => {
                        const cleanNotes = (p.notes || '').replace(/\[Auto-Warmed on[^\]]*\][^\n]*/g, '').trim();
                        return cleanNotes || <span className="text-slate-400 font-normal">-</span>;
                      })()}
                    </td>




                    {/* Proxy Type (e.g. "HTTP" or "HTTP · US" or "—") */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-sans text-xs">
                      {proxy ? (
                        <span
                          className="cursor-pointer hover:text-teal-500 transition-colors font-medium"
                          onClick={() => setUniversalProxyModalProfile(p)}
                          title="Click to configure proxy"
                        >
                          {proxy.protocol.toUpperCase()} {proxy.countryRegion ? `· ${proxy.countryRegion}` : ''}
                        </span>
                      ) : (
                        <span
                          className="text-slate-400 font-sans font-medium cursor-pointer hover:text-teal-500"
                          onClick={() => setUniversalProxyModalProfile(p)}
                          title="Click to paste & test proxy"
                        >
                          —
                        </span>
                      )}
                    </td>

                    {/* Proxy & Location (Compact Country Flag Pill) */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {proxy ? (
                        <div className="flex items-center space-x-2 group/proxy">
                          {/* Compact Country Flag Badge */}
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs cursor-pointer hover:border-teal-500/50 hover:bg-slate-200/60 dark:hover:bg-slate-750 transition select-none"
                            onClick={() => setUniversalProxyModalProfile(p)}
                            title={`Proxy: ${proxy.ip || proxy.host}:${proxy.port} (${proxy.countryName || proxy.countryRegion || 'Proxy'})`}
                          >
                            <CountryFlag countryCode={proxy.countryRegion || 'US'} className="w-3.5 h-2.5" />
                            <span>{proxy.countryRegion || 'US'}</span>
                          </span>

                          {/* Quick Edit & Paste buttons on hover */}
                          <div className="flex items-center space-x-0.5 opacity-0 group-hover/proxy:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setUniversalProxyModalProfile(p)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              title="Edit Proxy"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePasteFromClipboard(p.id)}
                              className="p-1 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
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
                            onClick={() => setUniversalProxyModalProfile(p)}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400 text-slate-400 transition-all flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Proxy</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteFromClipboard(p.id)}
                            className="p-1 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 opacity-0 group-hover/proxy:opacity-100 transition-opacity"
                            title="Paste Proxy from Clipboard (1-Click)"
                          >
                            <Clipboard className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>


                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setWarmerTargetProfile(p)}
                          className="p-1.5 hover:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400 transition-colors"
                          title="Auto-Warm Profile (Farms Google, Wikipedia, Amazon cookies)"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setStealthTestProfile(p)}
                          className="p-1.5 hover:bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400 transition-colors"
                          title="Check Stealth & Anti-Detect Score (Pixelscan / CreepJS / IPHEY)"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              showToast({ type: 'info', title: 'Cloud Sync', message: `Backing up "${p.name}" to cloud...` });
                              await window.mahiAPI.uploadProfileToCloud(p.id);
                              showToast({ type: 'success', title: 'Cloud Sync', message: `"${p.name}" backed up successfully.` });
                              if (window.mahiAPI?.getAllProfilesSyncStatus) {
                                const st = await window.mahiAPI.getAllProfilesSyncStatus();
                                setSyncStatuses(st);
                              }
                            } catch (err: any) {
                              showToast({ type: 'error', title: 'Sync Failed', message: err.message });
                            }
                          }}
                          className="p-1.5 hover:bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400 transition-colors"
                          title="Backup Profile to Cloud"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                        </button>


                        <button
                          onClick={() => {
                            setSelectedProfileId(p.id);
                            onNavigate('profile-settings');
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
                          title="Profile Settings"
                        >
                          <SettingsIcon className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleTestProxyForProfile(p)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-teal-500 transition-colors"
                          title="Test Proxy Connection"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleClone(p)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
                          title="Duplicate Profile"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteTargetId(p.id)}
                          className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500 transition-colors"
                          title="Delete Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Controls for Scaling Fleets (GAP-09) */}
        {filteredProfiles.length > 50 && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 select-none">
            <span>
              Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredProfiles.length)} of {filteredProfiles.length} profiles
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 font-medium transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Dedicated Proxy Configuration Modal */}
      {proxyModalProfile && (
        <ProxyConfigModal
          profile={proxyModalProfile}
          initialProxy={proxies.find((px) => px.id === proxyModalProfile.settings?.network?.proxyId)}
          isOpen={proxyModalProfile !== null}
          onClose={() => setProxyModalProfile(null)}
        />
      )}

      {/* Sleek Quick Profile Creation Modal */}
      {isQuickCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  +
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Quick Create Profile
                  </h3>
                  <p className="text-[11px] text-slate-400">Ready in 1 second</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickCreateOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => handleQuickCreateSubmit(e, false)} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Profile Name *
                </label>
                <input
                  type="text"
                  required
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="e.g. Profile 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Folder / Workspace
                  </label>
                  <input
                    type="text"
                    value={quickFolder}
                    onChange={(e) => setQuickFolder(e.target.value)}
                    placeholder="General"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Proxy Configuration
                  </label>
                  <select
                    value={quickProxyId}
                    onChange={(e) => setQuickProxyId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">Direct Connection (No Proxy)</option>
                    {proxies.map((px) => (
                      <option key={px.id} value={px.id}>
                        {px.name} ({px.host}:{px.port})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Account Info
                </label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="e.g. user@domain.com or purpose"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={quickCreating}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                >
                  {quickCreating ? 'Creating...' : 'Create Profile'}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleQuickCreateSubmit(e, true)}
                  disabled={quickCreating}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center space-x-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Create & Run</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 Bulk Profile Creation Modal (Standardized Shell - GAP-07) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Bulk Profile Generator
                  </h3>
                  <p className="text-[11px] text-slate-400">Create multiple profiles with 1 click</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  How Many Profiles? ({bulkCount})
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value, 10))}
                    className="flex-1 accent-indigo-600"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                    className="w-16 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-bold font-mono text-xs"
                  />
                </div>
                <div className="flex space-x-1.5 pt-2">
                  {[5, 10, 20, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setBulkCount(num)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        bulkCount === num
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-200'
                      }`}
                    >
                      +{num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Name Prefix
                  </label>
                  <input
                    type="text"
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value)}
                    placeholder="Profile"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Folder
                  </label>
                  <input
                    type="text"
                    value={bulkFolder}
                    onChange={(e) => setBulkFolder(e.target.value)}
                    placeholder="General"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    OS Personas
                  </label>
                  <select
                    value={bulkOs}
                    onChange={(e) => setBulkOs(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="random">Random Authentic (Mixed)</option>
                    <option value="windows">Windows 10 / 11</option>
                    <option value="mac">macOS (Apple M-Series)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Proxy (Optional)
                  </label>
                  <select
                    value={bulkProxyId}
                    onChange={(e) => setBulkProxyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">No Proxy (Direct)</option>
                    {proxies.map((px) => (
                      <option key={px.id} value={px.id}>
                        {px.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isBulking}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center space-x-1.5"
                >
                  <Layers className={`w-4 h-4 ${isBulking ? 'animate-spin' : ''}`} />
                  <span>{isBulking ? 'Generating...' : `Generate ${bulkCount} Profiles`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚡ Fast Universal Proxy Assignment Modal */}
      {universalProxyModalProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Set Proxy: {universalProxyModalProfile.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">Paste in any standard format (ip:port:user:pass)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUniversalProxyModalProfile(null);
                  setRawProxyInput('');
                  setRawTestResult(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Universal Proxy String *
                </label>
                <input
                  type="text"
                  value={rawProxyInput}
                  onChange={(e) => setRawProxyInput(e.target.value)}
                  placeholder="123.45.67.89:8080:username:password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono focus:border-teal-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Formats: <code className="text-teal-500">ip:port:user:pass</code>, <code className="text-teal-500">http://user:pass@ip:port</code>, or <code className="text-teal-500">ip:port</code>
                </p>
              </div>

              {rawTestResult && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                    rawTestResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <CountryFlag countryCode={rawTestResult.countryCode || 'US'} className="text-lg" />
                    <div>
                      <div className="font-bold">
                        {rawTestResult.success ? '● Proxy Live & Ready' : '● Connection Failed'}
                      </div>
                      <div className="text-[10px] opacity-80">
                        {rawTestResult.success
                          ? `${rawTestResult.country || 'Location'} • ${rawTestResult.latencyMs} ms latency`
                          : rawTestResult.errorMessage || 'Invalid credentials or host unreachable'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestRawProxy}
                  disabled={!rawProxyInput.trim() || isTestingRawProxy}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
                >
                  <Activity className={`w-3.5 h-3.5 ${isTestingRawProxy ? 'animate-spin' : ''}`} />
                  <span>{isTestingRawProxy ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUniversalProxyModalProfile(null);
                      setRawProxyInput('');
                      setRawTestResult(null);
                    }}
                    className="px-3 py-2 text-slate-400 hover:text-slate-200 font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyRawProxyToProfile}
                    disabled={!rawProxyInput.trim() || isTestingRawProxy}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                  >
                    Save & Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 🛡️ Stealth & Anti-Detect Tester Modal */}
      {stealthTestProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Stealth & Fingerprint Integrity
                  </h3>
                  <p className="text-[11px] text-slate-400">Test {stealthTestProfile.name} on live detection checkers</p>
                </div>
              </div>
              <button
                onClick={() => setStealthTestProfile(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-slate-600 dark:text-slate-300">
                Choose a live detection suite to test hardware spoofing, WebGL noise, and Canvas fingerprint masking:
              </p>

              <div className="space-y-2 pt-1">
                {[
                  {
                    name: 'Pixelscan.net',
                    desc: 'Tests Canvas, WebGL, Screen, and Client Hints legitimacy',
                    url: 'https://pixelscan.net',
                    badge: 'Recommended',
                    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
                  },
                  {
                    name: 'CreepJS',
                    desc: 'Advanced bot detection & browser anomaly analyzer',
                    url: 'https://abrahamjuliot.github.io/creepjs/',
                    badge: 'Deep Audit',
                    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
                  },
                  {
                    name: 'BrowserLeaks Canvas',
                    desc: 'Verifies Canvas 2D micro-noise & unique hash isolation',
                    url: 'https://browserleaks.com/canvas',
                    badge: 'Canvas Test',
                    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                  },
                  {
                    name: 'IPHEY.com',
                    desc: 'Tests WebRTC leaks, DNS, and IP location consistency',
                    url: 'https://iphey.com',
                    badge: 'IP & WebRTC',
                    color: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
                  },
                ].map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => handleLaunchStealthChecker(item.url)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-950/70 hover:bg-teal-500/5 dark:hover:bg-teal-500/10 border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 rounded-2xl flex items-center justify-between text-left transition-all group"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-teal-500 transition-colors">
                          {item.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.color}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <Play className="w-4 h-4 text-slate-400 group-hover:text-teal-500 fill-current opacity-60 group-hover:opacity-100 transition-all shrink-0 ml-2" />
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStealthTestProfile(null)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚜 Single Profile Cookie Warmer Modal */}
      {warmerTargetProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Cookie Warmer & Auto-Farmer
                  </h3>
                  <p className="text-[11px] text-slate-400">Warm profile "{warmerTargetProfile.name}"</p>
                </div>
              </div>
              <button
                onClick={() => setWarmerTargetProfile(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
                disabled={isWarming}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-600 dark:text-slate-300">
                The Cookie Warmer automatically visits authoritative websites (Google, Wikipedia, YouTube, BBC, Amazon) to harvest natural session cookies and build an authentic trust score before account creation.
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Warmup Depth
                </label>

                {[
                  {
                    id: 'quick',
                    title: 'Quick Warmup (5 Sites)',
                    desc: 'Google, Wikipedia, Bing, TechCrunch, BBC (~25 sec)',
                    badge: 'Fast',
                    color: 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5',
                  },
                  {
                    id: 'standard',
                    title: 'Standard Farm (12 Sites)',
                    desc: 'Balanced across Search, News, Social & Commerce (~1 min)',
                    badge: 'Recommended',
                    color: 'border-teal-500/30 text-teal-600 dark:text-teal-400 bg-teal-500/5',
                  },
                  {
                    id: 'deep',
                    title: 'Deep Ageing (25 Sites)',
                    desc: 'Comprehensive multi-category browsing for high-trust accounts (~2.5 mins)',
                    badge: 'Enterprise',
                    color: 'border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWarmerMode(item.id as any)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      warmerMode === item.id
                        ? `${item.color} border-2 shadow-sm font-bold`
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{item.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-normal">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setWarmerTargetProfile(null)}
                  disabled={isWarming}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSingleWarmup}
                  disabled={isWarming}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center space-x-2"
                >
                  <Sparkles className={`w-4 h-4 ${isWarming ? 'animate-spin' : ''}`} />
                  <span>{isWarming ? 'Farming Cookies...' : 'Start Warming'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚜 Bulk Profile Cookie Warmer Modal */}
      {isBulkWarmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden text-xs">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Bulk Cookie Warmer
                  </h3>
                  <p className="text-[11px] text-slate-400">Farming {selectedIds.length} selected profiles</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkWarmModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
                disabled={isWarming}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-600 dark:text-slate-300">
                Run automated cookie farming across all <strong>{selectedIds.length} selected profiles</strong> simultaneously to build genuine session histories.
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Warmup Depth
                </label>

                {[
                  { id: 'quick', title: 'Quick (5 Sites per profile)', desc: 'Fast batch initialization' },
                  { id: 'standard', title: 'Standard (12 Sites per profile)', desc: 'Recommended balance' },
                  { id: 'deep', title: 'Deep Ageing (25 Sites per profile)', desc: 'Highest trust profile aging' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWarmerMode(item.id as any)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all ${
                      warmerMode === item.id
                        ? 'border-amber-500 bg-amber-500/10 border-2 font-bold text-slate-900 dark:text-slate-100'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 opacity-70'
                    }`}
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-100">{item.title}</div>
                    <p className="text-[11px] text-slate-400 font-normal">{item.desc}</p>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBulkWarmModalOpen(false)}
                  disabled={isWarming}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBulkWarmup}
                  disabled={isWarming}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center space-x-2"
                >
                  <Sparkles className={`w-4 h-4 ${isWarming ? 'animate-spin' : ''}`} />
                  <span>{isWarming ? `Farming ${selectedIds.length} Profiles...` : `Warm All (${selectedIds.length})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staggered Batch Launch Modal */}
      {isStaggerLaunchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      🚀 Launch {selectedIds.length} Profiles
                    </h3>
                    <p className="text-xs text-slate-400">Sequential launch with CPU spike protection</p>
                  </div>
                </div>
                {!isStaggerLaunching && (
                  <button
                    onClick={() => setIsStaggerLaunchModalOpen(false)}
                    className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              {isStaggerLaunching && staggerProgress ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center animate-pulse">
                    <Play className="w-8 h-8 fill-current" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Launching profile {staggerProgress.completed} of {staggerProgress.total}...
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {staggerProgress.pid ? `PID: ${staggerProgress.pid}` : 'Opening browser window...'}
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.round((staggerProgress.completed / staggerProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="py-5 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Stagger Delay (Time between each window)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '500ms (Fast)', value: 500 },
                        { label: '1.5s (Safe)', value: 1500 },
                        { label: '2.5s (Heavy)', value: 2500 },
                        { label: '4.0s (Light PC)', value: 4000 },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setStaggerDelayMs(item.value)}
                          className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                            staggerDelayMs === item.value
                              ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 border-2'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-300">💡 CPU Protection Active:</div>
                    <p>Opening windows sequentially prevents sudden 100% CPU freezes and Chromium crash locks.</p>
                  </div>
                </div>
              )}

              {!isStaggerLaunching && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsStaggerLaunchModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteStaggeredLaunch}
                    className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/20 active:scale-95 transition-all flex items-center space-x-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch {selectedIds.length} Profiles Now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Proxy Assignment Modal */}
      {isBulkProxyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <Globe2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Assign Proxy to {selectedIds.length} Profiles
                    </h3>
                    <p className="text-xs text-slate-400">Single proxy, Round-Robin distribution, or direct</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBulkProxyModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-4">
                {/* Distribution Mode */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Distribution Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'single', label: '1 Proxy to All', desc: 'Same proxy for all' },
                      { id: 'round-robin', label: 'Round-Robin', desc: 'Distribute proxy list' },
                      { id: 'clear', label: 'Direct Connection', desc: 'Remove proxy' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setBulkProxyMode(m.id as any)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                          bulkProxyMode === m.id
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-2 font-bold'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500'
                        }`}
                      >
                        <div className="font-bold">{m.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {bulkProxyMode !== 'clear' && (
                  <>
                    {/* Existing Saved Proxies Selection */}
                    {proxies.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Select from Saved Proxies ({proxies.length} available)
                        </label>
                        <select
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 font-medium"
                          onChange={(e) => {
                            if (e.target.value) {
                              if (bulkProxyMode === 'single') {
                                setSelectedBulkProxyIds([e.target.value]);
                              } else {
                                if (!selectedBulkProxyIds.includes(e.target.value)) {
                                  setSelectedBulkProxyIds([...selectedBulkProxyIds, e.target.value]);
                                }
                              }
                            }
                          }}
                        >
                          <option value="">-- Choose saved proxy --</option>
                          {proxies.map((px) => (
                            <option key={px.id} value={px.id}>
                              {px.name} ({px.host}:{px.port}) [{px.protocol.toUpperCase()}]
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Raw Proxies Input */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Or Paste Proxies (1 per line, format: host:port or host:port:user:pass)
                      </label>
                      <textarea
                        rows={3}
                        value={rawBulkProxyInput}
                        onChange={(e) => setRawBulkProxyInput(e.target.value)}
                        placeholder="185.199.229.156:50100:user:pass&#10;192.168.1.1:8080"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBulkProxyModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBulkProxyAssign}
                  disabled={isBulkProxySaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/20 active:scale-95 transition-all flex items-center space-x-2"
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>{isBulkProxySaving ? 'Assigning...' : `Apply to ${selectedIds.length} Profiles`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Tags / Folder Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Bulk Edit ({selectedIds.length} Profiles)
                    </h3>
                    <p className="text-xs text-slate-400">Batch update folder and tags</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1.5"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Set Folder (Move profiles)
                  </label>
                  <input
                    type="text"
                    value={bulkEditFolder}
                    onChange={(e) => setBulkEditFolder(e.target.value)}
                    placeholder="e.g. Farming, Facebook Ads, Crypto"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Add Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={bulkEditAddTags}
                    onChange={(e) => setBulkEditAddTags(e.target.value)}
                    placeholder="e.g. Warmed, Active, Verified"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Remove Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={bulkEditRemoveTags}
                    onChange={(e) => setBulkEditRemoveTags(e.target.value)}
                    placeholder="e.g. Fresh, Unused"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBulkEdit}
                  disabled={isBulkEditSaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center space-x-2"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{isBulkEditSaving ? 'Saving...' : `Save Changes`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}



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

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title={`Delete ${selectedIds.length} Profiles`}
        message={`Are you sure you want to delete all ${selectedIds.length} selected profiles? All associated browser cookies, local caches, and session data will be permanently removed.`}
        confirmLabel={isBulkDeleting ? 'Deleting...' : `Delete All (${selectedIds.length})`}
        isDestructive
        onConfirm={handleBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />

      {/* Universal Bulk Import Modal */}
      <UniversalBulkImportModal
        isOpen={isUniversalImportOpen}
        onClose={() => setIsUniversalImportOpen(false)}
      />

      {/* Multi-Window Synchronizer Modal */}
      <SynchronizerModal
        isOpen={isSynchronizerModalOpen}
        onClose={() => setIsSynchronizerModalOpen(false)}
      />

      {/* 📋 Profile Row Right-Click Context Menu (GAP-03) */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-52 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
            <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-[11px]">
              {contextMenu.profile.name}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {contextMenu.profile.folder || 'General'} · {contextMenu.profile.status}
            </p>
          </div>

          <div className="space-y-0.5">
            {contextMenu.profile.status === 'RUNNING' ? (
              <button
                type="button"
                onClick={() => {
                  stopProfile(contextMenu.profile.id);
                  setContextMenu(null);
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
                  startProfile(contextMenu.profile.id);
                  setContextMenu(null);
                }}
                disabled={contextMenu.profile.status === 'STARTING'}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition font-medium disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{contextMenu.profile.status === 'STARTING' ? 'Starting...' : 'Launch Profile'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedProfileId(contextMenu.profile.id);
                setContextMenu(null);
                onNavigate('profile-settings');
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Edit Settings</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await handleClone(contextMenu.profile);
                setContextMenu(null);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Duplicate Profile</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const proxy = proxies.find((px) => px.id === contextMenu.profile.settings?.network?.proxyId);
                if (proxy) {
                  const proxyStr = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
                  await navigator.clipboard.writeText(proxyStr);
                  showToast({
                    type: 'success',
                    title: 'Proxy Copied',
                    message: `Copied ${proxyStr} to clipboard.`,
                  });
                } else {
                  showToast({
                    type: 'info',
                    title: 'Direct Connection',
                    message: 'This profile uses direct connection (no proxy).',
                  });
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium"
            >
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy Proxy</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedProfileId(contextMenu.profile.id);
                setContextMenu(null);
                onNavigate('cookies');
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
                setDeleteTargetId(contextMenu.profile.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete to Trash</span>
            </button>
          </div>
        </div>
      )}

      {/* 🚜 Cookie Warmer Real-Time Execution Indicator (GAP-05) */}
      {isWarming && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900/95 backdrop-blur-md border border-amber-500/30 rounded-2xl shadow-2xl p-4 w-80 text-xs animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <Cookie className="w-3.5 h-3.5 text-amber-400" />
                <span>Smart Cookie Warmer Active</span>
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
              {warmerMode}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5">
            {warmerTargetProfile
              ? `Farming organic trust cookies for "${warmerTargetProfile.name}"...`
              : `Bulk warming across ${selectedIds.length} selected profiles...`}
          </p>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-teal-400 h-1.5 rounded-full animate-pulse w-3/4 transition-all duration-500" />
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
            <span>Simulating natural navigation</span>
            <span className="text-amber-400 font-semibold">Running...</span>
          </div>
        </div>
      )}
    </div>
  );
};




