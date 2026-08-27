import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Clock,
  Layers,
  Play,
  Square,
  Plus,
  ArrowRight,
  Zap,
  Activity,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  RefreshCw,
} from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';
import { useLicenseStore } from '../stores/useLicenseStore.js';
import { useProfileStore } from '../stores/useProfileStore.js';
import { useProxyStore } from '../stores/useProxyStore.js';
import { useToastStore } from '../stores/useToastStore.js';
import { CountryFlag } from './CountryFlag.js';
import { FleetResourceSummary } from '../../10_CONFIG/shared/types/resources.js';
import { NavigationPage } from './Sidebar.js';

interface StudentWorkspaceDashboardProps {
  onNavigate: (page: NavigationPage) => void;
}

export const StudentWorkspaceDashboard: React.FC<StudentWorkspaceDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAccountStore();
  const { currentLicenseStatus, fetchCurrentStatus } = useLicenseStore();
  const { profiles, startProfile, stopProfile, setSelectedProfileId } = useProfileStore();
  const { proxies } = useProxyStore();
  const { showToast } = useToastStore();

  const [fleetUsage, setFleetUsage] = useState<FleetResourceSummary | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    fetchCurrentStatus();

    if (window.mahiAPI) {
      window.mahiAPI.getFleetResources().then(setFleetUsage);
      const unsub = window.mahiAPI.onFleetResourceUsage(setFleetUsage);
      return () => unsub();
    }
  }, []);

  const handleOptimizeMemory = async () => {
    setIsOptimizing(true);
    try {
      const res = await window.mahiAPI.optimizeFleetMemory();
      showToast({
        type: 'success',
        title: '⚡ Memory Purged',
        message: res.status,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Optimization Failed',
        message: 'Could not purge memory cache.',
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const isProActive = currentLicenseStatus?.isValid && currentLicenseStatus.status === 'ACTIVE';

  const daysRemaining = currentLicenseStatus?.license?.expiresAt
    ? Math.ceil((new Date(currentLicenseStatus.license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const studentProfiles = profiles.filter((p) => !p.deletedAt);
  const runningProfiles = studentProfiles.filter((p) => p.status === 'RUNNING' || p.status === 'STARTING');

  return (
    <div className="space-y-6">
      {/* Student Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-slate-800 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className={`w-14 h-14 rounded-2xl ${currentUser?.avatarColor || 'bg-teal-600'} flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0`}>
              {currentUser?.avatarLetter || 'S'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">
                  Welcome back, {currentUser?.displayName || 'Student'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 text-[10px] font-bold border border-teal-500/20">
                  Enterprise Workspace
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {currentUser?.email || 'student@domain.com'} · Dedicated Multi-Account & Anti-Detect Environment
              </p>
            </div>
          </div>

          {/* Quick License Status Pill */}
          <div className="flex items-center space-x-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">License Access</div>
              <div className="font-bold text-xs flex items-center gap-1.5 mt-0.5">
                {isProActive ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>MAHI PRO ACTIVE</span>
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    <span>NOT ACTIVATED</span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onNavigate('license')}
              className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-400 border border-teal-500/30 rounded-xl text-xs font-semibold transition"
            >
              {isProActive ? 'View Plan' : 'Activate Key'}
            </button>
          </div>
        </div>
      </div>

      {/* Student License Detail Card (if expiring or active) */}
      {isProActive && currentLicenseStatus?.license && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 block">Subscription Expiry</span>
            <div className="text-base font-bold text-slate-800 dark:text-white mt-1">
              {currentLicenseStatus.license.expiresAt
                ? new Date(currentLicenseStatus.license.expiresAt).toLocaleDateString()
                : 'Lifetime Access'}
            </div>
            <div className="text-[11px] text-emerald-500 font-semibold mt-0.5">
              {daysRemaining !== null ? `${daysRemaining} Days Remaining` : 'No Expiry'}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 block">Authorized PC Limit</span>
            <div className="text-base font-bold text-slate-800 dark:text-white mt-1">
              {currentLicenseStatus.license.activeDevicesCount} / {currentLicenseStatus.license.maxDevices} Active
            </div>
            <div className="text-[11px] text-teal-400 font-semibold mt-0.5 flex items-center gap-1">
              <Laptop size={12} />
              <span>Bound to this Computer</span>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 block">Active Profiles</span>
            <div className="text-base font-bold text-slate-800 dark:text-white mt-1">
              {runningProfiles.length} Running / {studentProfiles.length} Total
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Multi-Account Stealth Isolation
            </div>
          </div>
        </div>
      )}

      {/* Fleet Resource Monitor & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Resource Monitor */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between md:col-span-2">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-bold text-xs text-slate-800 dark:text-white">Live System Resources</h4>
                <span className="text-[10px] bg-teal-500/10 text-teal-400 font-bold px-2 py-0.5 rounded-full">
                  {runningProfiles.length} Active Profiles
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total Fleet RAM: {fleetUsage ? `${fleetUsage.totalMemoryMB} MB` : '0 MB'} · CPU: {fleetUsage ? `${fleetUsage.totalCpuPercent}%` : '0%'}
              </p>
            </div>
          </div>

          <button
            onClick={handleOptimizeMemory}
            disabled={isOptimizing}
            className="px-3.5 py-2 bg-teal-600/10 hover:bg-teal-600/20 text-teal-500 dark:text-teal-400 border border-teal-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition active:scale-95"
          >
            <Zap size={14} className={isOptimizing ? 'animate-spin' : ''} />
            <span>{isOptimizing ? 'Purging...' : 'Optimize RAM'}</span>
          </button>
        </div>

        {/* Quick Launch Action */}
        <div className="p-5 bg-gradient-to-br from-teal-600 to-emerald-600 rounded-2xl text-white shadow-lg shadow-teal-600/10 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm">Create New Profile</h4>
            <p className="text-[11px] text-teal-100 mt-0.5">
              Launch isolated anti-detect browser fingerprint.
            </p>
          </div>
          <button
            onClick={() => onNavigate('create-profile')}
            className="mt-3 w-full py-2 bg-white text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-teal-50 transition shadow-xs"
          >
            <Plus size={15} />
            <span>New Browser Profile</span>
          </button>
        </div>
      </div>

      {/* Student Profiles Quick Launcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
              Active Browser Profiles
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Quick launch and manage your personal browser instances
            </p>
          </div>
          <button
            onClick={() => onNavigate('profiles')}
            className="text-xs font-bold text-teal-500 hover:text-teal-400 flex items-center gap-1 transition"
          >
            <span>View All ({studentProfiles.length})</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {studentProfiles.length === 0 ? (
          <div className="p-10 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center space-y-3">
            <Layers className="w-8 h-8 mx-auto text-slate-500 opacity-50" />
            <div>
              <p className="font-bold text-xs text-slate-700 dark:text-slate-200">No browser profiles yet</p>
              <p className="text-[11px] text-slate-400">Click below to create your first isolated browser.</p>
            </div>
            <button
              onClick={() => onNavigate('create-profile')}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              <span>Create First Profile</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {studentProfiles.slice(0, 5).map((profile) => {
              const isRunning = profile.status === 'RUNNING';
              const isStarting = profile.status === 'STARTING';

                const proxy = proxies.find((px) => px.id === profile.settings?.network?.proxyId);

                return (
                  <div
                    key={profile.id}
                    className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <div className={`w-8 h-8 rounded-lg ${isRunning ? 'bg-emerald-500' : 'bg-slate-700'} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {profile.name}
                          </span>
                          {proxy && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 shadow-xs"
                              title={`Proxy Country: ${proxy.countryName || proxy.countryRegion || 'Proxy'}`}
                            >
                              <CountryFlag countryCode={proxy.countryRegion || 'US'} className="w-3.5 h-2.5" />
                              <span>{proxy.countryRegion || 'Proxy'}</span>
                            </span>
                          )}
                        </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                        <span className="uppercase">{profile.settings?.browser?.engine || 'CHROME'}</span>
                        <span>·</span>
                        <span>{profile.folder || 'Workspace'}</span>
                        <span>·</span>
                        <span className={isRunning ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                          {profile.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isRunning ? (
                      <button
                        onClick={() => stopProfile(profile.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition"
                      >
                        <Square size={12} />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => startProfile(profile.id)}
                        disabled={isStarting}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95"
                      >
                        <Play size={12} />
                        <span>{isStarting ? 'Starting...' : 'Run'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
