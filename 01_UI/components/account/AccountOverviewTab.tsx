import type React from 'react';
import { Sparkles, Users, Zap } from 'lucide-react';
import type { AccountSession, AccountTrialStatus } from '../../../10_CONFIG/shared/types/commercial.js';
import { websiteUrl } from '../../../10_CONFIG/shared/site-config.js';
import type { MyLicenseResponse } from '../../api-fallback.js';

interface AccountPlanLimits {
  isPro: boolean;
  plan: string;
  tier?: 'FREE' | 'PRO' | 'BUSINESS';
  maxProfiles: number;
  expiresAt: string | null;
}

interface AccountOverviewTabProps {
  accountSession: AccountSession | null;
  currentPlan: string;
  isProActive: boolean;
  planLimits: AccountPlanLimits | null;
  trialStatus: AccountTrialStatus | null;
  isActivatingTrial: boolean;
  myLicense: MyLicenseResponse | null;
  onActivateTrial: () => void;
}

export const AccountOverviewTab: React.FC<AccountOverviewTabProps> = ({
  accountSession,
  currentPlan,
  isProActive,
  planLimits,
  trialStatus,
  isActivatingTrial,
  myLicense,
  onActivateTrial,
}) => {
  return (
    <>
      {/* Account Summary Card */}
      <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-semibold text-slate-400">ACCOUNT EMAIL</span>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{accountSession?.email}</span>
              {(accountSession?.auth_provider === 'GOOGLE' || accountSession?.google_sub) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Google Linked
                </span>
              )}
            </h4>
          </div>
          <div>
            {(currentPlan === 'business' || currentPlan.startsWith('business_') || currentPlan === 'team' || currentPlan === 'enterprise') && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                <Users size={13} /> {currentPlan.toUpperCase()} ACTIVE
              </span>
            )}
            {(currentPlan === 'mahi_ultimate' || currentPlan === 'ultimate') && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Zap size={13} /> ULTIMATE ACTIVE
              </span>
            )}
            {(currentPlan === 'mahi_growth' || currentPlan === 'growth') && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Zap size={13} /> GROWTH ACTIVE
              </span>
            )}
            {(currentPlan === 'mahi_starter' || currentPlan === 'starter') && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                <Zap size={13} /> STARTER ACTIVE
              </span>
            )}
            {(currentPlan === 'pro' || currentPlan.startsWith('pro_') || currentPlan.startsWith('professional_')) && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Zap size={13} /> {currentPlan.startsWith('professional_') ? currentPlan.replace('_', ' ').toUpperCase() : 'PRO'} ACTIVE
              </span>
            )}
            {currentPlan === 'trial' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                <Sparkles size={13} /> 7-DAY TRIAL {trialStatus?.daysRemaining ? `(${trialStatus.daysRemaining}d left)` : ''}
              </span>
            )}
            {currentPlan !== 'pro' &&
              currentPlan !== 'trial' &&
              currentPlan !== 'starter' &&
              currentPlan !== 'mahi_starter' &&
              currentPlan !== 'growth' &&
              currentPlan !== 'mahi_growth' &&
              currentPlan !== 'ultimate' &&
              currentPlan !== 'mahi_ultimate' &&
              !currentPlan.startsWith('pro_') &&
              !currentPlan.startsWith('professional_') &&
              currentPlan !== 'business' &&
              !currentPlan.startsWith('business_') &&
              currentPlan !== 'team' &&
              currentPlan !== 'enterprise' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600">
                  FREE PLAN ({planLimits?.maxProfiles || 15} Profiles)
                </span>
              )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/40 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Profile Capacity</span>
            <strong className="text-white font-mono">
              {(planLimits?.maxProfiles ?? 0) >= 100000 || planLimits?.maxProfiles === -1
                ? 'Unlimited Profiles'
                : `${planLimits?.maxProfiles || 15} Profiles`}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Expires On</span>
            <strong className="text-white font-mono">
              {planLimits?.expiresAt ? new Date(planLimits.expiresAt).toLocaleDateString() : 'Never (Free)'}
            </strong>
          </div>
        </div>

        {currentPlan !== 'pro' && currentPlan !== 'trial' && !isProActive && trialStatus?.isEligibleForTrial && (
          <div className="pt-3 border-t border-slate-700/40">
            <button
              type="button"
              disabled={isActivatingTrial}
              onClick={onActivateTrial}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles size={14} />
              {isActivatingTrial ? 'Activating 7-Day Trial...' : 'Start 7-Day Free Trial (50 Profiles)'}
            </button>
          </div>
        )}
      </div>

      {/* Your Licence Block */}
      <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Your Licence
        </div>
        {myLicense?.hasLicense ? (
          <div className="space-y-2 text-xs">
            <div className="font-mono text-xs tracking-wider bg-slate-900/80 p-2.5 rounded-xl border border-slate-700 text-slate-100 select-all">
              {myLicense.keyMasked}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
              <div>Plan: <span className="text-slate-200 font-medium">{myLicense.planName || myLicense.planId}</span></div>
              <div>Devices: <span className="text-slate-200 font-mono">{myLicense.devicesUsed} / {myLicense.deviceLimit}</span></div>
              <div>Valid until: <span className="text-slate-200 font-mono">{myLicense.validUntil ? new Date(myLicense.validUntil).toLocaleDateString() : 'Lifetime'}</span></div>
              <div>Status: <span className="text-slate-200 font-mono uppercase">{myLicense.status || 'ACTIVE'}</span></div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 space-y-1">
            <p>No licence yet. It is issued automatically after payment is approved.</p>
            <a href={websiteUrl('/pricing', { productionFallback: true })} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white underline inline-block font-medium">View Pricing</a>
          </div>
        )}
      </div>
    </>
  );
};
