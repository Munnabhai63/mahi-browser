import React from 'react';
import { Lock, Sparkles, Check, ArrowRight, X, Shield, Users, Cloud, Bot, Zap } from 'lucide-react';
import { useAccountStore } from '../stores/useAccountStore.js';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureTitle?: string;
  featureDescription?: string;
  requiredPlan?: 'PRO' | 'BUSINESS' | 'ENTERPRISE';
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  featureTitle = 'Premium Feature',
  featureDescription = 'This advanced capability is available on MAHI PRO and Business plans.',
  requiredPlan = 'PRO',
}) => {
  const { openAccountModal, planLimits } = useAccountStore();

  if (!isOpen) return null;

  const handleUpgradeClick = () => {
    onClose();
    openAccountModal(requiredPlan);
  };

  const isProUser = Boolean(
    planLimits?.isPro ||
    planLimits?.plan === 'pro' ||
    planLimits?.plan === 'trial' ||
    planLimits?.plan?.startsWith('pro_')
  );

  const freeLimitCount = (planLimits as any)?.freeLimit || (planLimits as any)?.maxProfiles || 15;

  const proFeatures = [
    `Up to 100 anti-detect browser profiles (vs ${freeLimitCount} Free)`,
    'End-to-end encrypted Cloud Sync & Multi-Device sync',
    'Built-in commercial residential & mobile proxy access',
    'Visual RPA Automation & Cookie Warmer execution',
    'Multi-Window CDP Synchronizer Hub',
    'Real-time automated fingerprint randomization',
  ];

  const businessFeatures = [
    'Dedicated Team Workspaces with Multi-User Collaboration',
    'Team Member Seats with Role-Based Access Control (Admin, Manager, Operator)',
    'Granular Profile Sharing & Centralized Access Delegation',
    'Expanded Profile Capacity (100 to 300+ Anti-Detect Profiles)',
    'Organization Audit Logs & Centralized Activity Tracking',
    'Shared Proxy Device Allocation & Priority Dedicated Support',
  ];

  const displayFeatures = requiredPlan === 'BUSINESS' || requiredPlan === 'ENTERPRISE'
    ? businessFeatures
    : proFeatures;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/10 blur-[100px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/10 blur-[100px] pointer-events-none rounded-full" />

        {/* Header bar */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">{featureTitle}</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {requiredPlan}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Entitlement Required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <p className="text-xs text-slate-300 leading-relaxed">
              {featureDescription}
            </p>
          </div>

          {requiredPlan === 'BUSINESS' && isProUser && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 flex items-start space-x-2.5 text-xs text-indigo-200">
              <Users className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Your current <strong className="text-indigo-300">PRO plan</strong> includes full single-user capabilities (100 profiles, Cloud Sync, and Automation). 
                Multi-user collaboration, member seats, and team workspaces require a <strong className="text-white">BUSINESS</strong> subscription.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 mb-3">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Included in {requiredPlan} Plan</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              {displayFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start space-x-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-teal-950/30 border border-teal-800/40 text-xs">
            <span className="text-slate-400">Current Plan:</span>
            <span className="font-bold text-teal-300 capitalize">
              {planLimits?.plan || 'Free'} (Max {planLimits?.maxProfiles || 15} Profiles)
            </span>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="p-6 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={handleUpgradeClick}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center space-x-2 active:scale-95 transition-all"
          >
            <span>Upgrade to {requiredPlan}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
