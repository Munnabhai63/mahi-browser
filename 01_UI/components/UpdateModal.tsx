import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { UpdateStatusEvent } from '../../10_CONFIG/shared/types/updater.js';

// Session-level dismissal tracker - persists for current app run only
let sessionDismissed = false;

export const UpdateModal: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatusEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (window.mahiAPI) {
      // Check initial status on mount
      window.mahiAPI.getUpdateStatus().then((s) => {
        if (s && s.state === 'DOWNLOADED' && !sessionDismissed) {
          setStatus(s);
          setIsOpen(true);
        }
      });

      // Listen to real-time updater events
      const unsubscribe = window.mahiAPI.onUpdateStatusChanged((newStatus) => {
        if (newStatus.state === 'DOWNLOADED' && !sessionDismissed) {
          setStatus(newStatus);
          setIsOpen(true);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  // ONLY show when update is downloaded and user hasn't dismissed it this session
  if (!isOpen || sessionDismissed || !status || status.state !== 'DOWNLOADED') {
    return null;
  }

  const handleUpdateAndRestart = async () => {
    try {
      await window.mahiAPI.installUpdate();
    } catch {
      // Handled silently
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
      <div className="w-[400px] bg-slate-900/95 backdrop-blur-md border border-teal-500/50 rounded-2xl p-5 shadow-2xl shadow-teal-950/40 text-slate-100 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0 shadow-sm shadow-teal-500/20">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 id="update-dialog-title" className="text-sm font-bold text-white tracking-wide">
              MAHI BROWSER Update
            </h4>
            <p id="update-dialog-desc" className="text-xs text-slate-300 mt-1 leading-relaxed font-medium">
              New update ready ({versionText}). Restart now to apply update?
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            id="update-btn-later"
            onClick={handleLater}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
          >
            Later
          </button>
          <button
            type="button"
            id="update-btn-restart"
            onClick={handleUpdateAndRestart}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center gap-1.5 transition shadow-lg shadow-teal-500/20 active:scale-95"
          >
            <RefreshCw size={14} />
            Update &amp; Restart
          </button>
        </div>
      </div>
    </div>
  );
};
