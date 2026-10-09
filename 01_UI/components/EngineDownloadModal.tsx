import React, { useState, useEffect } from 'react';
import { DownloadCloud, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, HardDrive } from 'lucide-react';
import { ManagedEngineStatus } from '../../10_CONFIG/shared/types/ipc.js';

export const EngineDownloadModal: React.FC = () => {
  const [status, setStatus] = useState<ManagedEngineStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (window.mahiAPI?.onEngineDownloadProgress) {
      const unsubscribe = window.mahiAPI.onEngineDownloadProgress((newStatus) => {
        setStatus(newStatus);
        if (
          newStatus.stage === 'DOWNLOADING' ||
          newStatus.stage === 'CHECKING' ||
          newStatus.stage === 'VERIFYING' ||
          newStatus.stage === 'EXTRACTING' ||
          newStatus.stage === 'ERROR'
        ) {
          setIsOpen(true);
        } else if (newStatus.stage === 'READY') {
          // Close shortly after ready
          const timer = setTimeout(() => setIsOpen(false), 800);
          return () => clearTimeout(timer);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  if (!isOpen || !status || status.stage === 'IDLE') {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (window.mahiAPI?.downloadManagedEngine) {
        await window.mahiAPI.downloadManagedEngine();
      }
    } catch {} finally {
      setIsRetrying(false);
    }
  };

  const downloadedMB = (status.downloadedBytes / (1024 * 1024)).toFixed(1);
  const totalMB = status.totalBytes > 0 ? (status.totalBytes / (1024 * 1024)).toFixed(1) : '172.6';

  let stageLabel = 'Downloading...';
  if (status.stage === 'CHECKING') stageLabel = 'Checking available disk space...';
  if (status.stage === 'VERIFYING') stageLabel = 'Verifying SHA-256 checksum...';
  if (status.stage === 'EXTRACTING') stageLabel = 'Extracting browser engine...';
  if (status.stage === 'READY') stageLabel = 'Engine ready!';
  if (status.stage === 'ERROR') stageLabel = 'Download Failed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            {status.stage === 'ERROR' ? (
              <AlertCircle className="w-6 h-6 text-red-500" />
            ) : status.stage === 'READY' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <DownloadCloud className="w-6 h-6 animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              Preparing browser engine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              MAHI Managed Engine • Verified Integrity
            </p>
          </div>
        </div>

        {/* Content / Status */}
        {status.stage === 'ERROR' ? (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300">
              <p className="font-medium">Engine setup failed:</p>
              <p className="mt-1 opacity-90 break-words">{status.error || 'Unknown network or disk error.'}</p>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" /> 450 MB disk space required
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
                <span className="text-slate-700 dark:text-slate-300">{stageLabel}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{status.percent}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(4, status.percent)}%` }}
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
                {downloadedMB} MB / {totalMB} MB
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
