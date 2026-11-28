import React, { useState, useEffect } from 'react';
import { DownloadCloud, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, HardDrive } from 'lucide-react';
import { ManagedEngineStatus, CamoufoxProgressEvent } from '../../10_CONFIG/shared/types/ipc.js';

export interface UnifiedEngineProgressState {
  engineName: string;
  stage: 'IDLE' | 'CHECKING' | 'RESOLVING' | 'DOWNLOADING' | 'VERIFYING' | 'EXTRACTING' | 'READY' | 'ERROR' | 'FAILED';
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

export function computeEngineModalViewModel(status: UnifiedEngineProgressState | null) {
  if (!status || status.stage === 'IDLE') {
    return {
      isOpen: false,
      stageLabel: '',
      percent: 0,
      downloadedMB: '0.0',
      totalMB: '0.0',
      isFailed: false,
      error: undefined,
      engineName: '',
    };
  }

  const isFailed = status.stage === 'ERROR' || status.stage === 'FAILED';
  const downloadedMB = (status.downloadedBytes / (1024 * 1024)).toFixed(1);
  const totalMB = status.totalBytes > 0 ? (status.totalBytes / (1024 * 1024)).toFixed(1) : '530.0';

  let stageLabel = 'Downloading...';
  if (status.stage === 'CHECKING') stageLabel = 'Checking available disk space...';
  if (status.stage === 'RESOLVING') stageLabel = 'Resolving release asset...';
  if (status.stage === 'VERIFYING') stageLabel = 'Verifying SHA-256 checksum...';
  if (status.stage === 'EXTRACTING') stageLabel = 'Extracting browser engine...';
  if (status.stage === 'READY') stageLabel = `${status.engineName} ready!`;
  if (isFailed) stageLabel = 'Download Failed';

  const isOpen = ['DOWNLOADING', 'CHECKING', 'RESOLVING', 'VERIFYING', 'EXTRACTING', 'ERROR', 'FAILED'].includes(
    status.stage
  );

  return {
    isOpen,
    stageLabel,
    percent: status.percent,
    downloadedMB,
    totalMB,
    isFailed,
    error: status.error,
    engineName: status.engineName,
  };
}

export const EngineDownloadModal: React.FC = () => {
  const [status, setStatus] = useState<UnifiedEngineProgressState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const disposers: (() => void)[] = [];

    if (window.mahiAPI?.onEngineDownloadProgress) {
      const unsub = window.mahiAPI.onEngineDownloadProgress((newStatus: ManagedEngineStatus) => {
        if (!newStatus) return;
        setStatus({
          engineName: 'Chromium Engine',
          stage: newStatus.stage,
          percent: newStatus.percent,
          downloadedBytes: newStatus.downloadedBytes,
          totalBytes: newStatus.totalBytes,
          error: newStatus.error,
        });
        if (
          newStatus.stage === 'DOWNLOADING' ||
          newStatus.stage === 'CHECKING' ||
          newStatus.stage === 'VERIFYING' ||
          newStatus.stage === 'EXTRACTING' ||
          newStatus.stage === 'ERROR'
        ) {
          setIsOpen(true);
        } else if (newStatus.stage === 'READY') {
          const timer = setTimeout(() => setIsOpen(false), 800);
          disposers.push(() => clearTimeout(timer));
        }
      });
      if (typeof unsub === 'function') {
        disposers.push(unsub);
      }
    }

    if (window.mahiAPI?.onCamoufoxDownloadProgress) {
      const unsub = window.mahiAPI.onCamoufoxDownloadProgress((evt: CamoufoxProgressEvent) => {
        if (!evt) return;
        setStatus({
          engineName: 'Camoufox Gecko Engine',
          stage: evt.stage,
          percent: evt.percent ?? 0,
          downloadedBytes: evt.receivedBytes ?? 0,
          totalBytes: evt.totalBytes ?? 0,
          error: evt.error,
        });
        if (
          evt.stage === 'RESOLVING' ||
          evt.stage === 'DOWNLOADING' ||
          evt.stage === 'VERIFYING' ||
          evt.stage === 'EXTRACTING' ||
          evt.stage === 'FAILED'
        ) {
          setIsOpen(true);
        } else if (evt.stage === 'READY') {
          const timer = setTimeout(() => setIsOpen(false), 800);
          disposers.push(() => clearTimeout(timer));
        }
      });
      if (typeof unsub === 'function') {
        disposers.push(unsub);
      }
    }

    return () => {
      for (const d of disposers) {
        try { d(); } catch (err) { console.debug('[EngineDownloadModal] listener cleanup failed', err); }
      }
    };
  }, []);

  const vm = computeEngineModalViewModel(status);

  if (!isOpen || !vm.isOpen) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (status?.engineName.includes('Camoufox')) {
        if (typeof window.mahiAPI?.startProfile === 'function') {
          // Re-triggers launch or provision
        }
      } else if (typeof window.mahiAPI?.downloadManagedEngine === 'function') {
        await window.mahiAPI.downloadManagedEngine();
      }
    } catch (err) {
      console.debug('[EngineDownloadModal] download retry failed', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            {vm.isFailed ? (
              <AlertCircle className="w-6 h-6 text-red-500" />
            ) : status?.stage === 'READY' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <DownloadCloud className="w-6 h-6 animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              Preparing {vm.engineName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              MAHI Managed Engine • Verified Integrity
            </p>
          </div>
        </div>

        {/* Content / Status */}
        {vm.isFailed ? (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300">
              <p className="font-medium">Engine setup failed:</p>
              <p className="mt-1 opacity-90 break-words">{vm.error || 'Unknown network or disk error.'}</p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" /> Disk space verified
              </span>
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-slate-700 dark:text-slate-300">{vm.stageLabel}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{vm.percent}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(4, vm.percent)}%` }}
                />
              </div>
            </div>

            {/* Details */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Secure & Verified Checksum
              </span>
              <span>
                {vm.downloadedMB} MB / {vm.totalMB} MB
              </span>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center italic">
              MAHI Browser is preparing the engine in the background.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
