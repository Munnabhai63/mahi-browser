import React, { useState, useEffect } from 'react';
import { 
  DownloadCloud, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight, 
  Zap,
  HardDrive
} from 'lucide-react';
import { UpdateStatusEvent } from '../../10_CONFIG/shared/types/updater.js';
import { useToastStore } from '../stores/useToastStore.js';

export const UpdateModal: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatusEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (window.mahiAPI) {
      // Get initial status
      window.mahiAPI.getUpdateStatus().then((s) => {
        if (s && (s.state === 'AVAILABLE' || s.state === 'DOWNLOADED')) {
          setStatus(s);
          setIsOpen(true);
        }
      });

      // Listen to real-time updater events
      const unsubscribe = window.mahiAPI.onUpdateStatusChanged((newStatus) => {
        setStatus(newStatus);
        if (newStatus.state === 'AVAILABLE' || newStatus.state === 'DOWNLOADING' || newStatus.state === 'DOWNLOADED') {
          setIsOpen(true);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  if (!isOpen || !status || status.state === 'IDLE' || status.state === 'NOT_AVAILABLE') {
    return null;
  }

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      await window.mahiAPI.downloadUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Download Failed',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInstall = async () => {
    try {
      await window.mahiAPI.installUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Install Failed',
        message: msg,
      });
    }
  };

  const percent = status.progress ? status.progress.percent : 0;
  const speedMB = status.progress ? (status.progress.bytesPerSecond / (1024 * 1024)).toFixed(1) : '0.0';
  const transferredMB = status.progress ? (status.progress.transferred / (1024 * 1024)).toFixed(1) : '0';
  const totalMB = status.progress ? (status.progress.total / (1024 * 1024)).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-900/70 via-slate-900 to-indigo-950/70 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shadow-lg shadow-teal-500/20">
              <DownloadCloud size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Software Update</h3>
                {status.availableVersion && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-400 border border-teal-500/40">
                    v{status.availableVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Current version: v{status.currentVersion}</p>
            </div>
          </div>
          {status.state !== 'DOWNLOADING' && (
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* State 1: UPDATE AVAILABLE */}
          {status.state === 'AVAILABLE' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                <Sparkles size={20} className="text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <div className="font-bold text-white">What's New in v{status.availableVersion}</div>
                  <div className="text-slate-400 whitespace-pre-line text-[11px] leading-relaxed">
                    {status.releaseNotes || '• Latest anti-detect stealth engine patches\n• Performance optimizations & memory reduction\n• Enhanced proxy and multi-window synchronizer reliability'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* State 2: DOWNLOADING */}
          {status.state === 'DOWNLOADING' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-teal-400" />
                  Downloading update package...
                </span>
                <span className="text-teal-400 font-bold">{percent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{transferredMB} MB of {totalMB} MB</span>
                <span>Speed: {speedMB} MB/s</span>
              </div>
            </div>
          )}

          {/* State 3: DOWNLOADED */}
          {status.state === 'DOWNLOADED' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 size={22} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-emerald-300">Update Ready to Install</h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  The update has been verified and downloaded. Click restart to apply the latest version now.
                </p>
              </div>
            </div>
          )}

          {/* State 4: ERROR */}
          {status.state === 'ERROR' && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle size={22} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-300">Update Check Notice</h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  {status.error || 'Could not connect to update server. Please check your internet connection.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            {status.state === 'DOWNLOADED' ? 'Install Later' : 'Close'}
          </button>

          {status.state === 'AVAILABLE' && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDownload}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-md shadow-teal-500/20 disabled:opacity-50"
            >
              Download Update <ArrowRight size={14} />
            </button>
          )}

          {status.state === 'DOWNLOADED' && (
            <button
              type="button"
              onClick={handleInstall}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-md shadow-emerald-500/20"
            >
              Restart & Install Now <RefreshCw size={14} />
            </button>
          )}

          {status.state === 'ERROR' && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Dismiss
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
