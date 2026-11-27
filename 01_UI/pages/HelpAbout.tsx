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
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useToastStore } from '../stores/useToastStore.js';
import { NavigationPage } from '../components/Sidebar.js';
import { BrandLogo } from '../components/BrandLogo.js';
import { UpdateStatusEvent } from '../../10_CONFIG/shared/types/updater.js';
import { APP_VERSION } from '../../10_CONFIG/shared/version.js';
import { CONTACT_CONFIG } from '../../10_CONFIG/contact-config.js';
import { getDefaultUpdateFeedUrl } from '../../10_CONFIG/shared/site-config.js';

interface HelpAboutProps {
  onNavigate: (page: NavigationPage) => void;
}

export const HelpAboutPage: React.FC<HelpAboutProps> = ({ onNavigate }) => {
  const [appVersion, setAppVersion] = useState<string>(APP_VERSION);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusEvent | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopyingDiagnostics, setIsCopyingDiagnostics] = useState(false);

  useEffect(() => {
    if (window.mahiAPI) {
      if (window.mahiAPI.getAppVersion) {
        window.mahiAPI.getAppVersion().then((v) => {
          if (v) setAppVersion(v);
        }).catch(() => {});
      }

      if (window.mahiAPI.getUpdateStatus) {
        window.mahiAPI.getUpdateStatus().then((status) => {
          if (status) {
            setUpdateStatus(status);
            if (status.currentVersion) setAppVersion(status.currentVersion);
          }
        }).catch(() => {});
      }

      const unsubUpdate = window.mahiAPI.onUpdateStatusChanged?.((status) => {
        setUpdateStatus(status);
        if (status.currentVersion) setAppVersion(status.currentVersion);
        if (status.state === 'DOWNLOADING') setIsDownloading(true);
        if (status.state === 'DOWNLOADED' || status.state === 'ERROR') setIsDownloading(false);
      });

      return () => {
        unsubUpdate?.();
      };
    }
  }, []);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      if (window.mahiAPI?.checkForUpdates) {
        const res = await window.mahiAPI.checkForUpdates();
        setUpdateStatus(res);
        if (res.currentVersion) setAppVersion(res.currentVersion);

        if (res.state === 'NOT_AVAILABLE') {
          useToastStore.getState().showToast({
            type: 'info',
            title: "You're Up to Date",
            message: `MAHI Browser v${res.currentVersion || appVersion} is the latest version.`,
          });
        } else if (res.state === 'AVAILABLE') {
          useToastStore.getState().showToast({
            type: 'success',
            title: 'Update Available',
            message: `Version v${res.availableVersion} is ready to download.`,
          });
        } else if (res.state === 'ERROR') {
          useToastStore.getState().showToast({
            type: 'error',
            title: 'Update Notice',
            message: res.error || 'Could not verify update status.',
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Update Check Error',
        message: msg,
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    setIsDownloading(true);
    try {
      if (window.mahiAPI?.downloadUpdate) {
        await window.mahiAPI.downloadUpdate();
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Downloading Update',
          message: 'The latest installer package is downloading in the background.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Download Error',
        message: msg,
      });
      setIsDownloading(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      if (window.mahiAPI?.installUpdate) {
        await window.mahiAPI.installUpdate({ force: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Install Error',
        message: msg,
      });
    }
  };

  const handleCopyDiagnostics = async () => {
    if (!window.mahiAPI?.getDiagnostics) return;
    try {
      const diag = await window.mahiAPI.getDiagnostics();
      const redact = (s: string) => s
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
        .replace(/\b(Bearer\s+)?[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[TOKEN_REDACTED]')
        .replace(/MAHI-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}/gi, '[LICENSE_KEY_REDACTED]')
        .replace(/(password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
      const safe = { ...diag, logTail: redact(String(diag.logTail || '')) };
      const text = JSON.stringify(safe, null, 2);
      await navigator.clipboard.writeText(text);
      setIsCopyingDiagnostics(true);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Diagnostics Copied',
        message: 'System diagnostics copied to clipboard.',
      });
      setTimeout(() => setIsCopyingDiagnostics(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Failed to Copy Diagnostics',
        message: msg,
      });
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto overflow-y-auto custom-scrollbar font-sans">
      {/* Brand Hero Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <BrandLogo variant="icon" className="w-11 h-11 rounded-xl shadow-md shrink-0" />
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">MAHI BROWSER</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold border border-teal-500/20">
                  v{appVersion}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                  x64 Architecture
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                By {CONTACT_CONFIG.APP_AUTHOR} • Enterprise-grade multi-profile environment manager & Playwright automation engine
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isCheckingUpdate || updateStatus?.state === 'DOWNLOADING'}
          onClick={handleCheckUpdate}
          className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-2 transition active:scale-95 shadow-xs disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          {isCheckingUpdate || updateStatus?.state === 'CHECKING' ? (
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

      {/* Real Live Update System Card */}
      {updateStatus && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="mt-0.5 shrink-0">
                {updateStatus.state === 'NOT_AVAILABLE' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={18} />
                  </div>
                )}
                {updateStatus.state === 'AVAILABLE' && (
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                    <DownloadCloud size={18} />
                  </div>
                )}
                {updateStatus.state === 'DOWNLOADING' && (
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                    <RefreshCw size={18} className="animate-spin" />
                  </div>
                )}
                {updateStatus.state === 'DOWNLOADED' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={18} />
                  </div>
                )}
                {updateStatus.state === 'ERROR' && (
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <AlertCircle size={18} />
                  </div>
                )}
                {updateStatus.state === 'CHECKING' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400">
                    <RefreshCw size={18} className="animate-spin" />
                  </div>
                )}
                {updateStatus.state === 'IDLE' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400">
                    <Info size={18} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {updateStatus.state === 'NOT_AVAILABLE' && "You're up to date"}
                  {updateStatus.state === 'AVAILABLE' && `Update Available — v${updateStatus.availableVersion}`}
                  {updateStatus.state === 'DOWNLOADING' && `Downloading Update (${updateStatus.progress?.percent || 0}%)`}
                  {updateStatus.state === 'DOWNLOADED' && `Update Ready to Install — v${updateStatus.availableVersion}`}
                  {updateStatus.state === 'ERROR' && 'Update Check Notice'}
                  {updateStatus.state === 'CHECKING' && 'Checking updates server...'}
                  {updateStatus.state === 'IDLE' && 'Automatic Update Verification'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {updateStatus.state === 'NOT_AVAILABLE' && `MAHI Browser v${updateStatus.currentVersion || appVersion} is the latest version available on the ${updateStatus.channel || 'STABLE'} release channel.`}
                  {updateStatus.state === 'AVAILABLE' && `A new build v${updateStatus.availableVersion} is ready for installation. Current installed: v${updateStatus.currentVersion || appVersion}.`}
                  {updateStatus.state === 'DOWNLOADING' && `Transferred ${Math.round((updateStatus.progress?.transferred || 0) / 1024 / 1024)} MB of ${Math.round((updateStatus.progress?.total || 0) / 1024 / 1024)} MB`}
                  {updateStatus.state === 'DOWNLOADED' && `The update has been cryptographically verified and is ready to install.`}
                  {updateStatus.state === 'ERROR' && (updateStatus.error || 'Could not connect to update feed. Please check your network.')}
                  {updateStatus.state === 'CHECKING' && `Contacting ${getDefaultUpdateFeedUrl()} to check release metadata...`}
                  {updateStatus.state === 'IDLE' && `Click "Check for Updates" to verify against the official production release feed.`}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {updateStatus.state === 'AVAILABLE' && (
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={handleDownloadUpdate}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <DownloadCloud size={14} />
                  <span>{isDownloading ? 'Downloading...' : 'Download Update'}</span>
                </button>
              )}
              {updateStatus.state === 'DOWNLOADED' && (
                <button
                  type="button"
                  onClick={handleInstallUpdate}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Restart & Install</span>
                </button>
              )}
              {updateStatus.state === 'ERROR' && (
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress bar for DOWNLOADING */}
          {updateStatus.state === 'DOWNLOADING' && (
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${updateStatus.progress?.percent || 0}%` }}
              />
            </div>
          )}

          {/* Release Notes */}
          {updateStatus.releaseNotes && updateStatus.state !== 'NOT_AVAILABLE' && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800/80 rounded-xl text-[11px] text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-400 block mb-1 uppercase tracking-wider text-[10px]">Release Notes</span>
              <p className="whitespace-pre-line">{updateStatus.releaseNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Grid: Shortcuts */}
      <div className="w-full">
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

        {/* System Diagnostics */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100">
              <Terminal className="w-4 h-4 text-teal-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Diagnostics</h2>
            </div>
            <button
              type="button"
              disabled={!window.mahiAPI?.getDiagnostics || isCopyingDiagnostics}
              onClick={handleCopyDiagnostics}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Copy size={13} className={isCopyingDiagnostics ? 'text-teal-400' : ''} />
              <span>{isCopyingDiagnostics ? 'Copied!' : 'Copy Diagnostics'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Export environment data and redacted crash-log excerpts. Emails, tokens, and licence keys are masked before copying. Review before sharing.
          </p>
        </div>
      </div>
    </div>
  );
};

