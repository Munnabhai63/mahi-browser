import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  MousePointer,
  Keyboard,
  Scroll,
  Globe,
  Sliders,
  Play,
  Square,
  Crown,
  CheckCircle,
  AlertTriangle,
  Zap,
  Activity,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';

interface SynchronizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SynchronizerModal: React.FC<SynchronizerModalProps> = ({ isOpen, onClose }) => {
  const { profiles, fetchProfiles } = useProfileStore();
  const { showToast } = useToastStore();

  const [isActive, setIsActive] = useState(false);
  const [masterId, setMasterId] = useState<string>('');
  const [selectedSlaves, setSelectedSlaves] = useState<string[]>([]);
  const [syncClicks, setSyncClicks] = useState(true);
  const [syncTyping, setSyncTyping] = useState(true);
  const [syncScroll, setSyncScroll] = useState(true);
  const [syncNavigation, setSyncNavigation] = useState(true);
  const [humanDelay, setHumanDelay] = useState(60);
  const [actionCount, setActionCount] = useState(0);

  // Authoritative running profiles filter
  const runningProfiles = profiles.filter(
    (p) => p.status === 'RUNNING' || p.status === 'STARTING'
  );

  // Initial load & periodic refresh of profile statuses while modal is open
  useEffect(() => {
    if (!isOpen) return;

    fetchProfiles();
    loadStatus();

    const interval = setInterval(() => {
      fetchProfiles();
      loadStatus();
    }, 1200);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Sync masterId and selectedSlaves when running profiles change
  useEffect(() => {
    if (runningProfiles.length >= 2) {
      if (!masterId || !runningProfiles.some((p) => p.id === masterId)) {
        const newMaster = runningProfiles[0].id;
        setMasterId(newMaster);
        setSelectedSlaves(runningProfiles.filter((p) => p.id !== newMaster).map((p) => p.id));
      } else if (selectedSlaves.length === 0) {
        setSelectedSlaves(runningProfiles.filter((p) => p.id !== masterId).map((p) => p.id));
      }
    }
  }, [runningProfiles.map((p) => p.id).join(','), masterId]);

  const loadStatus = async () => {
    try {
      if (window.mahiAPI) {
        const st = await window.mahiAPI.synchronizerGetStatus();
        if (st) {
          if (runningProfiles.length < 2 && st.enabled) {
            await window.mahiAPI.synchronizerStop();
            setIsActive(false);
          } else {
            setIsActive(Boolean(st.enabled));
          }
          if (st.masterProfileId && runningProfiles.some((p) => p.id === st.masterProfileId)) {
            setMasterId(st.masterProfileId);
          }
          if (st.activeProfiles && st.activeProfiles.length > 0) {
            setSelectedSlaves(st.activeProfiles.filter((id: string) => runningProfiles.some((p) => p.id === id)));
          }
          if (st.config) {
            setSyncClicks(Boolean(st.config.syncClicks));
            setSyncTyping(Boolean(st.config.syncTyping));
            setSyncScroll(Boolean(st.config.syncScroll));
            setSyncNavigation(Boolean(st.config.syncNavigation));
          }
          setActionCount(st.mirroredActionCount || 0);
        }
      }
    } catch {}
  };

  if (!isOpen) return null;

  const handleMasterChange = (newMasterId: string) => {
    setMasterId(newMasterId);
    setSelectedSlaves((prev) => prev.filter((id) => id !== newMasterId));
  };

  const handleToggleSync = async () => {
    try {
      if (isActive) {
        // Stop
        if (window.mahiAPI) {
          await window.mahiAPI.synchronizerStop();
          setIsActive(false);
          showToast({
            type: 'info',
            title: 'Synchronizer Stopped',
            message: 'Multi-window action mirroring disabled.',
          });
        }
      } else {
        // Start
        if (runningProfiles.length < 2) {
          showToast({
            type: 'warning',
            title: 'Minimum 2 Profiles Required',
            message: 'Please start at least 2 browser profiles from the Profiles list to synchronize them.',
          });
          return;
        }

        const effectiveMaster = masterId || runningProfiles[0].id;
        const effectiveSlaves =
          selectedSlaves.length > 0
            ? selectedSlaves.filter((id) => id !== effectiveMaster)
            : runningProfiles.filter((p) => p.id !== effectiveMaster).map((p) => p.id);

        if (effectiveSlaves.length === 0) {
          showToast({
            type: 'warning',
            title: 'Select Target Window',
            message: 'Please select at least 1 slave window to receive mirrored actions.',
          });
          return;
        }

        if (window.mahiAPI) {
          await window.mahiAPI.synchronizerStart(effectiveMaster, effectiveSlaves, {
            syncClicks,
            syncTyping,
            syncScroll,
            syncNavigation,
            humanDelayMinMs: humanDelay === 0 ? 0 : Math.max(15, Math.floor(humanDelay * 0.6)),
            humanDelayMaxMs: humanDelay === 0 ? 0 : Math.max(40, Math.floor(humanDelay * 1.4)),
          });

          setIsActive(true);
          const masterName = runningProfiles.find((p) => p.id === effectiveMaster)?.name || 'Master';
          showToast({
            type: 'success',
            title: '🪞 Synchronizer Activated!',
            message: `Mirroring Master (${masterName}) to ${effectiveSlaves.length} Slave Windows.`,
          });
        }
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Synchronizer Error',
        message: err.message || 'Failed to toggle synchronizer',
      });
    }
  };

  const toggleSlaveSelection = (profileId: string) => {
    if (selectedSlaves.includes(profileId)) {
      setSelectedSlaves(selectedSlaves.filter((id) => id !== profileId));
    } else {
      setSelectedSlaves([...selectedSlaves, profileId]);
    }
  };


  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Multi-Window Action Synchronizer
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {isActive ? '● ACTIVE (MIRRORING)' : '○ INACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Mirror clicks, typing, and scrolling from 1 Master window across all running profiles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-xs">
          {/* Running Profiles Count Banner */}
          {runningProfiles.length < 2 ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Need At Least 2 Running Profiles</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Currently only {runningProfiles.length} profile is active. Please start 2 or more profiles from the Profiles list to synchronize actions.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span className="font-bold">
                  {runningProfiles.length} Browser Windows Ready for Mirroring
                </span>
              </div>
              {isActive && (
                <span className="font-mono font-bold text-xs bg-emerald-500/20 px-2.5 py-1 rounded-lg">
                  ⚡ {actionCount} Actions Mirrored
                </span>
              )}
            </div>
          )}

          {/* Master Profile Selection */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Crown className="w-4 h-4 text-amber-500 fill-current" />
              <span>Select Master Profile Window</span>
            </label>
            <select
              value={masterId}
              onChange={(e) => setMasterId(e.target.value)}
              disabled={isActive}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-slate-800 dark:text-slate-200"
            >
              {runningProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  👑 {p.name} (PID: {p.activePid || 'Running'})
                </option>
              ))}
            </select>
          </div>

          {/* Slave Profiles Target Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Target Slave Windows ({runningProfiles.filter((p) => p.id !== masterId).length})
              </label>
              <button
                type="button"
                disabled={isActive}
                onClick={() =>
                  setSelectedSlaves(
                    runningProfiles.filter((p) => p.id !== masterId).map((p) => p.id)
                  )
                }
                className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-bold"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1">
              {runningProfiles
                .filter((p) => p.id !== masterId)
                .map((p) => {
                  const isChecked = selectedSlaves.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`p-2.5 rounded-xl border flex items-center space-x-2.5 cursor-pointer transition-all ${
                        isChecked
                          ? 'border-teal-500 bg-teal-500/5 dark:bg-teal-500/10 font-bold'
                          : 'border-slate-200 dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isActive}
                        onChange={() => toggleSlaveSelection(p.id)}
                        className="rounded text-teal-600 accent-teal-500 w-4 h-4"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  );
                })}
            </div>
          </div>

          {/* Synchronizer Action Toggles */}
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">
              Mirror Features
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncClicks}
                  onChange={(e) => setSyncClicks(e.target.checked)}
                  className="rounded text-teal-600 accent-teal-500 w-4 h-4"
                />
                <MousePointer className="w-3.5 h-3.5 text-teal-500" />
                <span>Mouse Clicks</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncTyping}
                  onChange={(e) => setSyncTyping(e.target.checked)}
                  className="rounded text-teal-600 accent-teal-500 w-4 h-4"
                />
                <Keyboard className="w-3.5 h-3.5 text-indigo-500" />
                <span>Text Typing & Enter</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncScroll}
                  onChange={(e) => setSyncScroll(e.target.checked)}
                  className="rounded text-teal-600 accent-teal-500 w-4 h-4"
                />
                <Scroll className="w-3.5 h-3.5 text-amber-500" />
                <span>Page Scrolling</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncNavigation}
                  onChange={(e) => setSyncNavigation(e.target.checked)}
                  className="rounded text-teal-600 accent-teal-500 w-4 h-4"
                />
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>URL Navigation</span>
              </label>
            </div>
          </div>

          {/* Anti-Ban Human Jitter Delay */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-500" />
                <span>Anti-Ban Human Delay Jitter</span>
              </label>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                {humanDelay === 0
                  ? '0 ms (Instant Zero-Delay)'
                  : `~${humanDelay} ms (${Math.floor(humanDelay * 0.6)}ms – ${Math.floor(humanDelay * 1.4)}ms)`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="10"
              value={humanDelay}
              onChange={(e) => setHumanDelay(Number(e.target.value))}
              className="w-full accent-teal-500"
            />
            <p className="text-[11px] text-slate-400">
              Randomizes human reaction delays between windows to avoid bot pattern bans.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleToggleSync}
            disabled={runningProfiles.length < 2 && !isActive}
            className={`px-7 py-2.5 font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center space-x-2 text-xs text-white ${
              isActive
                ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-rose-600/30 animate-pulse'
                : runningProfiles.length < 2
                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 shadow-amber-500/25'
            }`}
          >
            {isActive ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>STOP SYNCHRONIZER</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>START SYNCHRONIZER</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};
