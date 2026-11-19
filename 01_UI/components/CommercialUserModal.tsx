import React, { useState, useEffect } from 'react';
import { Key, Shield, Check, Copy, X } from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { BrandLogo } from './BrandLogo.js';
import { fetchMyLicense, MyLicenseResponse } from '../api-fallback.js';

interface CommercialUserModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const CommercialUserModal: React.FC<CommercialUserModalProps> = ({ isOpen, onClose }) => {
  const { commercialUser, commercialLogin } = useAccountStore();
  const { showToast } = useToastStore();
  const [licenseKey, setLicenseKey] = useState('');
  const [hwid, setHwid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [myLicense, setMyLicense] = useState<MyLicenseResponse | null>(null);

  useEffect(() => {
    // Fetch HWID on mount
    (window.mahiAPI as any).getHwid().then((res: string) => setHwid(res)).catch(() => {});
    fetchMyLicense().then(setMyLicense).catch(() => setMyLicense(null));
  }, []);

  useEffect(() => {
    if (commercialUser && onClose) {
      onClose();
    }
  }, [commercialUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    setIsLoading(true);
    try {
      // We repurpose the email field to send the license key
      const res = await commercialLogin(licenseKey.trim(), 'LICENSE_MODE');
      if (res.success) {
        showToast({ type: 'success', title: 'License Activated!', message: 'Welcome to MAHI BROWSER.' });
        if (onClose) onClose();
      } else {
        showToast({ type: 'error', title: 'Invalid License', message: res.error || 'Failed to verify license' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyHwid = () => {
    navigator.clipboard.writeText(hwid);
    showToast({ type: 'success', title: 'Copied!', message: 'Hardware ID copied to clipboard' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-white/10 dark:bg-slate-900/50 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl p-8 relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-64 h-64 bg-purple-500/30 blur-[80px] rounded-full"></div>
          <div className="absolute -bottom-[20%] -left-[10%] w-64 h-64 bg-blue-500/30 blur-[80px] rounded-full"></div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/40 hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center">
          <BrandLogo variant="icon" className="w-16 h-16 rounded-2xl shadow-xl shadow-red-900/40 mb-6 shrink-0" />
          
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Activate License</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-4">
            Please enter your license key to unlock MAHI BROWSER.
          </p>

          {/* Your Licence Block */}
          <div className="w-full bg-slate-900/60 border border-slate-700 rounded-xl p-3 mb-4 text-xs">
            <div className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] mb-1.5">Your Licence</div>
            {myLicense && myLicense.hasLicense ? (
              <div className="space-y-1">
                <div className="font-mono text-xs bg-slate-950/80 p-2 rounded border border-slate-800 text-slate-100 select-all">
                  {myLicense.keyMasked}
                </div>
                <div className="text-[11px] text-slate-400 pt-1 space-y-0.5">
                  <div>Plan: <span className="font-medium text-slate-200">{myLicense.planName || myLicense.planId}</span></div>
                  <div>Valid until: <span className="font-mono text-slate-200">{myLicense.validUntil ? new Date(myLicense.validUntil).toLocaleDateString() : 'Lifetime'}</span></div>
                  <div>Devices: <span className="font-mono text-slate-200">{myLicense.devicesUsed} / {myLicense.deviceLimit}</span></div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">
                <p>No licence yet. It is issued automatically after payment is approved.</p>
                <a href="/pricing" className="text-slate-300 hover:text-white underline inline-block mt-1 font-medium">View Pricing</a>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">Hardware ID (HWID)</label>
              <div className="relative group">
                <input
                  type="text"
                  readOnly
                  value={hwid || 'Loading...'}
                  className="w-full bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-center text-slate-500"
                />
                <button
                  type="button"
                  onClick={copyHwid}
                  className="absolute inset-y-0 right-2 flex items-center p-2 text-slate-400 hover:text-purple-500"
                  title="Copy HWID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-1">Send this ID to your Admin to get a License Key.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">License Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className="w-full bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 dark:text-white placeholder:text-slate-400"
                  placeholder="Paste your license key here..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/25 transition-all active:scale-[0.98] flex items-center justify-center space-x-2 disabled:opacity-70"
            >
              <span>{isLoading ? 'Verifying...' : 'Activate License'}</span>
              <Check className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
