import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  Lock,
  Calendar,
  User,
  Copy,
  Check,
  Clock,
  Trash2,
  ArrowRight,
  Sparkles,
  ClipboardPaste,
  Layers,
  Monitor,
  Share2,
} from 'lucide-react';
import { useLicenseStore } from '../stores/useLicenseStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import {
  LicenseRecord,
  LicenseDurationType,
  CreateLicenseDTO,
} from '../../10_CONFIG/shared/types/license.js';
import { NavigationPage } from '../components/Sidebar.js';

interface MahiProLicensePageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const MahiProLicensePage: React.FC<MahiProLicensePageProps> = ({ onNavigate }) => {
  const {
    currentLicenseStatus,
    isLoading,
    fetchCurrentStatus,
    activate,
    isAdminAuthenticated,
    adminLogin,
    adminLicenses,
    adminFetchLicenses,
    adminCreate,
    adminRevoke,
    adminExtend,
    selectedLicenseDevices,
    adminFetchDevices,
    adminDeactivateDev,
    adminChangePin,
  } = useLicenseStore();


  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  // User activation form
  const [inputKey, setInputKey] = useState('');
  const [inputAccountId, setInputAccountId] = useState('');
  const [hwid, setHwid] = useState<string>('');
  const [copiedHwid, setCopiedHwid] = useState(false);

  // Admin login form
  const [adminSecretInput, setAdminSecretInput] = useState('');

  // Admin Create modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [newCustomer, setNewCustomer] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [newDuration, setNewDuration] = useState<LicenseDurationType>('30_DAYS');
  const [newCustomExpiry, setNewCustomExpiry] = useState('');
  const [newMaxDevices, setNewMaxDevices] = useState(1);
  const [newNotes, setNewNotes] = useState('');

  // Admin Extend modal
  const [extendTarget, setExtendTarget] = useState<LicenseRecord | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  // Admin Devices modal
  const [devicesTarget, setDevicesTarget] = useState<LicenseRecord | null>(null);

  // Admin Change PIN modal
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<{ verified: boolean; revoked: boolean; graceExpired: boolean; offlineDaysLeft: number; statusText: string } | null>(null);
  const [priceInr, setPriceInr] = useState<number>(599);

  useEffect(() => {
    fetchCurrentStatus();
    if (window.mahiAPI?.getDynamicPrice) {
      window.mahiAPI.getDynamicPrice().then((p) => {
        if (typeof p === 'number' && p > 0) setPriceInr(p);
      }).catch(() => {});
    }
    if (window.mahiAPI?.getHwid) {
      window.mahiAPI.getHwid().then((id: string) => setHwid(id)).catch(() => {});
    }
    if (window.mahiAPI?.getOnlineLicenseStatus) {
      window.mahiAPI.getOnlineLicenseStatus().then(st => setOnlineStatus(st)).catch(() => {});
    }
    const unsubChanged = window.mahiAPI?.onLicenseStatusChanged?.((st: any) => {
      setOnlineStatus(st);
      fetchCurrentStatus();
    });
    const unsubToast = window.mahiAPI?.onLicenseStatusToast?.((toastData: any) => {
      showToast(toastData);
    });
    return () => {
      unsubChanged?.();
      unsubToast?.();
    };
  }, []);

  const handleActivate = async () => {
    if (!inputKey.trim()) return;
    const res = await activate(inputKey.trim(), inputAccountId.trim() || undefined);
    if (res.success) {
      showToast({
        type: 'success',
        title: 'MAHI Pro Activated',
        message: res.message || 'MAHI Pro license successfully activated!',
      });
      setInputKey('');
    } else {
      showToast({
        type: 'error',
        title: 'Activation Error',
        message: res.message || 'Failed to activate license.',
      });
    }
  };

  const handleAdminLogin = async () => {
    if (!adminSecretInput.trim()) return;
    const ok = await adminLogin(adminSecretInput.trim());
    if (ok) {
      showToast({
        type: 'success',
        title: 'Admin Access',
        message: 'Authenticated as MAHI PRO Owner / Administrator',
      });
    } else {
      showToast({
        type: 'error',
        title: 'Access Denied',
        message: 'Invalid administrator credentials.',
      });
    }
  };

  const handleCreateLicense = async () => {
    if (!newCustomer.trim()) {
      showToast({ type: 'error', title: 'Validation', message: 'Customer name is required' });
      return;
    }

    try {
      const dto: CreateLicenseDTO = {
        customerName: newCustomer,
        accountId: newAccountId || undefined,
        durationType: newDuration,
        maxDevices: newMaxDevices,
        expiresAt: newDuration === 'CUSTOM' ? newCustomExpiry : undefined,
        notes: newNotes || undefined,
      };

      const res = await adminCreate(dto);
      if (res.success) {
        setCreatedRawKey(res.rawLicenseKey);
        setNewCustomer('');
        setNewAccountId('');
        setNewNotes('');
        showToast({
          type: 'success',
          title: 'License Created',
          message: `Generated license for ${dto.customerName}`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Create Failed',
        message: err?.message || 'Error creating license',
      });
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke the license for "${name}"?`)) return;
    const ok = await adminRevoke(id);
    if (ok) {
      showToast({
        type: 'warning',
        title: 'License Revoked',
        message: `License for "${name}" has been revoked.`,
      });
    }
  };

  const handleExtend = async () => {
    if (!extendTarget) return;
    const ok = await adminExtend({
      licenseId: extendTarget.id,
      additionalDays: extendDays,
    });
    if (ok) {
      showToast({
        type: 'success',
        title: 'License Extended',
        message: `Extended "${extendTarget.customerName}" by +${extendDays} days.`,
      });
      setExtendTarget(null);
    }
  };

  const handleSaveNewPin = async () => {
    if (!newPinInput.trim()) {
      showToast({ type: 'error', title: 'Validation', message: 'PIN / Password cannot be empty' });
      return;
    }
    const ok = await adminChangePin(newPinInput.trim());
    if (ok) {
      showToast({
        type: 'success',
        title: 'PIN Updated',
        message: 'Your custom Owner PIN / Password has been saved successfully!',
      });
      setIsChangePinModalOpen(false);
      setNewPinInput('');
    } else {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update Owner PIN.',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    showToast({ type: 'info', title: 'Copied', message: 'License key copied to clipboard!' });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setInputKey(text.trim());
        showToast({ type: 'info', title: 'Key Pasted', message: 'License key pasted from clipboard!' });
      }
    } catch {
      showToast({ type: 'error', title: 'Clipboard Error', message: 'Could not read clipboard' });
    }
  };

  const copyClientReceipt = (key: string, name: string, duration: string) => {
    const receipt = `👑 MAHI BROWSER PRO LICENSE RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Customer: ${name}
⏳ Plan Validity: ${duration}
🔑 License Key: ${key}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 How to Activate:
1. Open MAHI BROWSER
2. Click "MAHI Pro License" in the left sidebar
3. Paste your key & click "Activate License"!`;
    navigator.clipboard.writeText(receipt);
    showToast({ type: 'success', title: 'Receipt Copied', message: 'WhatsApp/Email message copied to clipboard!' });
  };


  const isProActive = currentLicenseStatus?.isValid && currentLicenseStatus.status === 'ACTIVE';

  const getDaysRemaining = (): number | null => {
    if (!currentLicenseStatus?.license?.expiresAt) return null;
    const diff = new Date(currentLicenseStatus.license.expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const daysRemaining = getDaysRemaining();

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto h-full flex flex-col justify-between overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-teal-500 to-emerald-400 text-white rounded-2xl shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">MAHI PRO Licensing</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Server Authoritative
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure hardware-bound licensing and real-time device validation.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* USER LICENSE VIEW */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-6 flex-1">
          {/* Dynamic Reminder & Alert Banners */}
          {currentLicenseStatus?.status === 'EXPIRED' && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <div>
                  <span className="font-bold text-white block">License Expired</span>
                  <span>Your MAHI PRO license has expired. Please contact your system administrator to renew or request a new license key.</span>
                </div>
              </div>
            </div>
          )}

          {isProActive && daysRemaining !== null && daysRemaining <= 5 && daysRemaining > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold text-white block">License Expiry Notice ({daysRemaining} Day{daysRemaining > 1 ? 's' : ''} Remaining)</span>
                  <span>Your license will expire in {daysRemaining} day{daysRemaining > 1 ? 's' : ''} on {new Date(currentLicenseStatus!.license!.expiresAt!).toLocaleDateString()}.</span>
                </div>
              </div>
            </div>
          )}
          {/* Status Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-400">Current Device Entitlement:</span>
                  {isProActive ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>MAHI PRO ACTIVE</span>
                    </span>
                  ) : currentLicenseStatus?.status === 'EXPIRED' ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>EXPIRED</span>
                    </span>
                  ) : currentLicenseStatus?.status === 'REVOKED' ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center space-x-1">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>REVOKED</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                      NOT ACTIVATED
                    </span>
                  )}
                  {onlineStatus && isProActive && (
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 ml-2">
                      <span>• Cloud Status:</span>
                      <strong className={
                        onlineStatus.revoked ? 'text-rose-500 font-bold' :
                        onlineStatus.graceExpired ? 'text-amber-500 font-bold' :
                        onlineStatus.verified ? 'text-emerald-500 dark:text-emerald-400 font-bold' :
                        'text-slate-400'
                      }>
                        {onlineStatus.statusText}
                      </strong>
                    </span>
                  )}
                </div>

                {isProActive && currentLicenseStatus?.license && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 text-xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                      <div className="text-[11px] text-slate-400 font-medium">Licensed To</div>
                      <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                        {currentLicenseStatus.license.customerName}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                      <div className="text-[11px] text-slate-400 font-medium">License Key</div>
                      <div className="font-mono font-bold text-teal-600 dark:text-teal-400">
                        {currentLicenseStatus.license.keyMasked}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                      <div className="text-[11px] text-slate-400 font-medium">Expiry Date</div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {currentLicenseStatus.license.expiresAt
                          ? new Date(currentLicenseStatus.license.expiresAt).toLocaleDateString()
                          : 'Lifetime Access'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                      <div className="text-[11px] text-slate-400 font-medium">Device Limit</div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {currentLicenseStatus.license.activeDevicesCount} / {currentLicenseStatus.license.maxDevices} Active
                      </div>
                    </div>
                  </div>
                )}

                {currentLicenseStatus?.message && !isProActive && (
                  <p className="text-xs text-rose-500 font-medium pt-1">{currentLicenseStatus.message}</p>
                )}
              </div>

              <div>
                <button
                  onClick={() => fetchCurrentStatus()}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>
          </div>

          {/* Activation Box */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isProActive ? 'Change / Switch License Key' : 'Activate MAHI PRO'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isProActive
                  ? 'Enter a new license key to switch entitlements.'
                  : `Enter your license key to unlock up to 100 profiles (₹${priceInr}/year).`}
              </p>
            </div>

            {hwid && (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                <div className="flex items-center space-x-2">
                  <Laptop className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Your Hardware ID (HWID):</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200 select-all">{hwid}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(hwid);
                    setCopiedHwid(true);
                    showToast({ type: 'success', title: 'HWID Copied', message: 'Hardware ID copied to clipboard' });
                    setTimeout(() => setCopiedHwid(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition"
                >
                  {copiedHwid ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHwid ? 'Copied' : 'Copy HWID'}</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="MAHI-XXXX-XXXX-XXXX-XXXX"
                  className="w-full pl-4 pr-24 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={handlePasteKey}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Paste</span>
                </button>
              </div>

              <div>
                <button
                  onClick={handleActivate}
                  disabled={!inputKey.trim() || isLoading}
                  className="w-full h-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center space-x-1.5 transition-all active:scale-95"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Validating...' : 'Activate License'}</span>
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

