import React, { useEffect, useState } from 'react';
import {
  HelpCircle,
  Shield,
  Keyboard,
  Cpu,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Info,
  DownloadCloud,
  RefreshCw,
  Copy,
  Layers,
  Terminal,
  Database,
  Lock,
} from 'lucide-react';
import { useToastStore } from '../stores/useToastStore.js';
import { NavigationPage } from '../components/Sidebar.js';

interface HelpAboutProps {
  onNavigate: (page: NavigationPage) => void;
}

export const HelpAboutPage: React.FC<HelpAboutProps> = ({ onNavigate }) => {
  const [detectedBrowsers, setDetectedBrowsers] = useState<{ name: string; path: string; engine: string }[]>([]);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (window.mahiAPI) {
      window.mahiAPI.getSystemBrowsers().then(setDetectedBrowsers);
    }
  }, []);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await window.mahiAPI.checkForUpdates();
      if (res.state === 'NOT_AVAILABLE') {
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Up to Date',
          message: 'You are running the latest version of MAHI BROWSER.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Update Check Notice',
        message: msg,
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto h-full flex flex-col justify-between overflow-y-auto custom-scrollbar font-sans">
      {/* Brand Hero Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold text-lg flex items-center justify-center border border-teal-500/20">
              M
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">MAHI BROWSER</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold border border-teal-500/20">
                  v1.0.0 Production
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                  x64 Architecture
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Enterprise-grade multi-profile environment manager & Playwright automation engine
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isCheckingUpdate}
          onClick={handleCheckUpdate}
          className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-2 transition active:scale-95 shadow-xs disabled:opacity-50 self-start sm:self-auto"
        >
          {isCheckingUpdate ? (
            <>
              <RefreshCw size={14} className="animate-spin text-teal-400" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <DownloadCloud size={14} className="text-teal-400" />
              <span>Check for Updates</span>
            </>
          )}
        </button>
      </div>

      {/* Grid: Diagnostics & Shortcuts */}
      <div className="max-w-3xl mx-auto w-full">

        {/* Keyboard Shortcuts */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100">
            <Keyboard className="w-4 h-4 text-teal-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Keyboard Shortcuts</h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300">Quick Global Search</span>
              <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 font-mono rounded-md text-[11px] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Ctrl + K
              </kbd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300">Close Modals / Drawers</span>
              <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 font-mono rounded-md text-[11px] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                ESC
              </kbd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300">Reload Application Window</span>
              <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 font-mono rounded-md text-[11px] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Ctrl + R
              </kbd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300">Create New Profile Shortcut</span>
              <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 font-mono rounded-md text-[11px] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Ctrl + N
              </kbd>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};
