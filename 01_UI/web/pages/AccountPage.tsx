import React from 'react';
import {
  User,
  Shield,
  CreditCard,
  HardDrive,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Download,
  Key,
  Globe2,
} from 'lucide-react';
import { useWebAuthStore } from '../state/useWebAuthStore.js';
import { APP_VERSION } from '../../../10_CONFIG/shared/version.js';

interface AccountPageProps {
  profileCount: number;
  maxProfiles?: number;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  profileCount,
  maxProfiles = 100,
}) => {
  const { user, logout } = useWebAuthStore();
  const quotaPercent = Math.min(100, Math.round((profileCount / maxProfiles) * 100));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Account & Subscription Profile</h2>
        <p className="text-xs text-slate-400">
          Centrally managed identity, quota limits, and desktop engine status
        </p>
      </div>

      {/* User Information Card */}
      <div className="p-6 bg-[#0c1222] border border-slate-800 rounded-2xl shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-teal-500/20">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{user?.name || 'Administrator'}</h3>
              <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified Account</span>
            </span>
          </div>
        </div>

        {/* Quotas & Entitlements */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Plan & Usage Entitlements</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Profile Quota Progress */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300">Profile Fleet Capacity</span>
                <span className="text-teal-400 font-mono font-bold">
                  {profileCount} / {maxProfiles}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 h-2 rounded-full transition-all"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                {maxProfiles - profileCount} additional browser profiles available on current plan tier.
              </div>
            </div>

            {/* Plan Tier Badge */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-slate-300">Active License Tier</span>
              <div className="text-lg font-bold text-white font-mono text-teal-300">
                {user?.planId?.toUpperCase() || 'MAHI PRO LIFETIME'}
              </div>
              <div className="text-[10px] text-slate-400">
                Full multi-window synchronizer, cloud sync, and commercial proxy catalog access.
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Client Version & Phase 4 Updater */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-200">MAHI Desktop Client Release</div>
            <div className="text-[11px] text-slate-400">
              Release channel: Production Windows (Phase 4 Auto-Updater enabled)
            </div>
          </div>
          <div className="text-right">
            <span className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/30 text-teal-400 font-mono text-xs font-bold rounded-lg">
              v{APP_VERSION} Latest
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-600/30 text-xs font-bold rounded-xl flex items-center space-x-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out from MAHI Console</span>
          </button>
        </div>
      </div>
    </div>
  );
};
