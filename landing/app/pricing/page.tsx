import React from 'react';
import type { Metadata } from 'next';
import PricingTable from '../../components/PricingTable';
import FaqAccordion from '../../components/FaqAccordion';

export const metadata: Metadata = {
  title: 'Pricing & Plans — Dual-Engine Anti-Detect Fleet',
  description:
    'Transparent pricing for solo affiliates and enterprise fleets. Save 50% on annual billing, or pay instantly with Indian UPI at 0% fees.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3.5 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
          Fair, Transparent Pricing
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Choose the Perfect Plan for Your Fleet
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Start 100% free with 15 offline SQLite profiles. Upgrade whenever your team requires distributed cloud synchronization, automated cookie warming, and team RBAC permissions.
        </p>
      </div>

      {/* Main Pricing Table */}
      <PricingTable />

      {/* Guarantee & Features Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="text-red-400 font-bold text-base flex items-center gap-2">
            <span>🇮🇳</span> 0% Fee Instant UPI
          </div>
          <p className="text-xs text-slate-400">
            Pay directly via PhonePe, Google Pay, Paytm, or BHIM to VPA <code className="text-slate-200">6375823589@slc</code>. Instant activation with zero gateway markup.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="text-red-400 font-bold text-base flex items-center gap-2">
            <span>🛡️</span> 7-Day Money Back Guarantee
          </div>
          <p className="text-xs text-slate-400">
            If our dual-engine architecture doesn't completely pass your target platform's anti-bot checks, receive a full refund with no friction.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="text-red-400 font-bold text-base flex items-center gap-2">
            <span>📱</span> Dedicated WhatsApp Support
          </div>
          <p className="text-xs text-slate-400">
            Enterprise and business subscribers get direct priority WhatsApp access (+91 9376343629) directly to core browser engineering.
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto space-y-8 pt-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Pricing & Billing Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Everything you need to know about subscriptions, license keys, and refunds.
          </p>
        </div>
        <FaqAccordion />
      </div>
    </div>
  );
}
