import React, { useEffect, useState } from 'react';
import {
  Layers,
  Play,
  Square,
  Shield,
  PlaySquare,
  Plus,
  ArrowRight,
  Activity,
  FolderPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Lock,
  Zap,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useAutomationStore } from '../stores/useAutomationStore.js';
import { useLogStore } from '../stores/useLogStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { useAccountStore } from '../stores/useAccountStore.js';
import { StudentWorkspaceDashboard } from '../components/StudentWorkspaceDashboard.js';
import { FleetResourceSummary } from '../../10_CONFIG/shared/types/resources.js';
import { NavigationPage } from '../components/Sidebar.js';

interface DashboardProps {
  onNavigate: (page: NavigationPage) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { profiles, fetchProfiles } = useProfileStore();
  const { proxies, fetchProxies } = useProxyStore();
  const { workflows, fetchWorkflows } = useAutomationStore();
  const { logs, fetchLogs } = useLogStore();
  const { showToast } = useToastStore();
  const { currentUser, planLimits, trialStatus } = useAccountStore();
  const isPro = Boolean(planLimits?.isPro || (planLimits?.plan && planLimits.plan !== 'free'));
  const currentPlan = (planLimits?.plan || currentUser?.planName || (isPro ? 'pro' : 'free')).toLowerCase();

  const isBusiness = Boolean(
    currentPlan === 'business' ||
    currentPlan?.startsWith('business_') ||
    currentPlan === 'team' ||
    currentPlan === 'enterprise'
  );
  const isProfessional = Boolean(
    isPro ||
    currentPlan === 'pro' ||
    currentPlan?.startsWith('pro_') ||
    currentPlan?.startsWith('professional_')
  );
  const isTrial = Boolean(currentPlan === 'trial' || trialStatus?.isTrialActive);

  const envBadgeLabel = isBusiness
    ? 'Business Environment'
    : isProfessional
    ? 'Pro Environment'
    : isTrial
    ? 'Trial Environment'
    : 'Free Environment';

  const envBadgeClass = isBusiness
    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
    : isProfessional
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    : isTrial
    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';

  // Master Vault Modal State
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [vaultMode, setVaultMode] = useState<'export' | 'import'>('export');
  const [vaultPassword, setVaultPassword] = useState('');
  const [importBundleText, setImportBundleText] = useState('');
  const [isProcessingVault, setIsProcessingVault] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchProxies();
    fetchWorkflows();
    fetchLogs();
  }, []);

  const handleExportVaultAction = async () => {
    setIsProcessingVault(true);
    try {
      const res = await window.mahiAPI.exportMasterVault({
        password: vaultPassword.trim() || undefined,
      });
      if (res.success) {
        showToast({
          type: 'success',
          title: 'Master Vault Exported!',
          message: `Saved backup to: ${res.filePath}`,
        });
        setIsVaultModalOpen(false);
        setVaultPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({
        type: 'error',
        title: 'Vault Export Failed',
        message: msg,
      });
    } finally {
      setIsProcessingVault(false);
    }
  };

  const handleImportVaultAction = async () => {
    if (!importBundleText.trim()) {
      showToast({
        type: 'error',
        title: 'Empty Vault Bundle',
        message: 'Please paste the JSON contents of your .mahi-vault file.',
      });
      return;
    }

    setIsProcessingVault(true);
    try {
      const res = await window.mahiAPI.importMasterVault(
        importBundleText.trim(),
        vaultPassword.trim() || undefined
      );

      if (res.success) {
        showToast({
          type: 'success',
          title: 'Vault Restored Successfully!',
          message: res.message || 'Workspace restored.',
        });
        fetchProfiles();
        fetchProxies();
        fetchWorkflows();
        setIsVaultModalOpen(false);
        setImportBundleText('');
        setVaultPassword('');
      } else {
        showToast({
          type: 'error',
          title: 'Restore Notice',
          message: res.message || 'Failed to restore vault.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({
        type: 'error',
        title: 'Import Error',
        message: msg,
      });
    } finally {
      setIsProcessingVault(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              Workspace Dashboard
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${envBadgeClass}`}>
              {envBadgeLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your workspaces and profiles
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => {
              setVaultMode('export');
              setIsVaultModalOpen(true);
            }}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
          >
            <Database size={14} className="text-emerald-500" />
            <span>Vault Backup</span>
          </button>
        </div>
      </div>

      {/* Render Clean Workspace Dashboard */}
      <StudentWorkspaceDashboard onNavigate={onNavigate} />

      {/* Master Vault Modal (Standardized Shell - GAP-07) */}
      {isVaultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {vaultMode === 'export' ? 'Export Workspace Vault' : 'Restore Workspace Vault'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {vaultMode === 'export' ? 'Create encrypted single-file full backup' : 'Restore profiles & settings from .mahi-vault file'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVaultModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {vaultMode === 'export' ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">Backup Scope</div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                      This will export all <span className="text-emerald-600 dark:text-emerald-400 font-bold">{profiles.length} profiles</span>, <span className="text-emerald-600 dark:text-emerald-400 font-bold">{proxies.length} proxies</span>, and <span className="text-emerald-600 dark:text-emerald-400 font-bold">{workflows.length} workflows</span> into a single secure file.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Lock size={14} className="text-emerald-500" />
                      Encryption Password (Optional):
                    </label>
                    <input
                      type="password"
                      value={vaultPassword}
                      onChange={(e) => setVaultPassword(e.target.value)}
                      placeholder="Leave blank for unencrypted, or enter password..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">If set, backup will be encrypted with military-grade AES-256-GCM.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Upload size={14} className="text-emerald-500" />
                        Select or Paste .mahi-vault Backup:
                      </label>
                      <label className="cursor-pointer text-xs font-medium text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1">
                        <span>Browse File...</span>
                        <input
                          type="file"
                          accept=".mahi-vault,.json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const content = event.target?.result as string;
                                if (content) setImportBundleText(content);
                              };
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <textarea
                      rows={5}
                      value={importBundleText}
                      onChange={(e) => setImportBundleText(e.target.value)}
                      placeholder="Browse a .mahi-vault file above, or paste raw JSON backup text here..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Lock size={14} className="text-emerald-500" />
                      Decryption Password (If encrypted):
                    </label>
                    <input
                      type="password"
                      value={vaultPassword}
                      onChange={(e) => setVaultPassword(e.target.value)}
                      placeholder="Enter the password used during export..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsVaultModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isProcessingVault}
                onClick={vaultMode === 'export' ? handleExportVaultAction : handleImportVaultAction}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {isProcessingVault ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    {vaultMode === 'export' ? <Download size={14} /> : <Upload size={14} />}
                    {vaultMode === 'export' ? 'Generate .mahi-vault Backup' : 'Restore Workspace'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
