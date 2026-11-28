import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, AlertTriangle, DownloadCloud, X } from 'lucide-react';
import { UpdateStatusEvent } from '../../10_CONFIG/shared/types/updater.js';
import { BrandLogo } from './BrandLogo.js';

let sessionDismissed = false;

export const UpdateModal: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatusEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeProfilesWarning, setActiveProfilesWarning] = useState<string[] | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (window.mahiAPI) {
      window.mahiAPI.getUpdateStatus().then((s) => {
        if (s && (s.state === 'DOWNLOADED' || s.state === 'DOWNLOADING') && !sessionDismissed) {
          setStatus(s);
          setIsOpen(true);
        }
      });

      const unsubscribe = window.mahiAPI.onUpdateStatusChanged((newStatus) => {
        if (!sessionDismissed) {
          setStatus(newStatus);
          if (newStatus.state === 'DOWNLOADED' || newStatus.state === 'DOWNLOADING') {
            setIsOpen(true);
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  if (!isOpen || sessionDismissed || !status) {
    return null;
  }

  if (status.state !== 'DOWNLOADED' && status.state !== 'DOWNLOADING') {
    return null;
  }

  const handleUpdateAndRestart = async (force = false) => {
    setIsUpdating(true);
    try {
      const res = await window.mahiAPI.installUpdate({ force });
      if (!res.success && res.reason === 'PROFILES_ACTIVE') {
        setActiveProfilesWarning(res.activeProfiles || ['Active profiles running']);
        setIsUpdating(false);
        return;
      }
    } catch (err) {
      console.debug('[UpdateModal] installUpdate failed', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLater = () => {
    sessionDismissed = true;
    setIsOpen(false);
  };

  const versionText = status.availableVersion ? `v${status.availableVersion}` : '';

  return (
    <div
      role="dialog"
      aria-labelledby="update-dialog-title"
      aria-describedby="update-dialog-desc"
      className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="w-[420px] bg-slate-900/95 backdrop-blur-md border border-teal-500/50 rounded-2xl p-5 shadow-2xl shadow-teal-950/40 text-slate-100 space-y-4">
        {/* Downloading State */}
        {status.state === 'DOWNLOADING' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
                <DownloadCloud size={20} className="animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 id="update-dialog-title" className="text-sm font-bold text-white tracking-wide">
                  Downloading Update {versionText}
                </h4>
                <p id="update-dialog-desc" className="text-xs text-slate-300 mt-1">
                  Verified background download in progress...
                </p>
              </div>
            </div>

            {status.progress && (
              <div className="space-y-1.5">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, status.progress.percent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{status.progress.percent}%</span>
                  <span>
                    {(status.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Downloaded State */}
        {status.state === 'DOWNLOADED' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3.5">
              <BrandLogo variant="mark" className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 id="update-dialog-title" className="text-sm font-bold text-white tracking-wide">
                    MAHI BROWSER Update Ready
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
                    {versionText}
                  </span>
                </div>
                <p id="update-dialog-desc" className="text-xs text-slate-300 mt-1 leading-relaxed font-medium">
                  Verified release package is downloaded and ready to install.
                </p>
                {status.releaseNotes && (
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 italic">
                    "{status.releaseNotes}"
                  </p>
                )}
              </div>
            </div>

            {/* Active Profiles Warning */}
            {activeProfilesWarning && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <span>Active Browser Profiles Detected</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-tight">
                  Running: {activeProfilesWarning.join(', ')}. Please save tabs and close profiles, or choose Force Restart.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                id="update-btn-later"
                onClick={handleLater}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
              >
                Later
              </button>

              {activeProfilesWarning ? (
                <button
                  type="button"
                  id="update-btn-force-restart"
                  disabled={isUpdating}
                  onClick={() => handleUpdateAndRestart(true)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                >
                  <AlertTriangle size={13} />
                  Force Update &amp; Restart
                </button>
              ) : (
                <button
                  type="button"
                  id="update-btn-restart"
                  disabled={isUpdating}
                  onClick={() => handleUpdateAndRestart(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
                  Update &amp; Restart
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
