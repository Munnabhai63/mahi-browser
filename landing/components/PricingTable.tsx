'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PUBLIC_PLANS, PublicPlan } from '../lib/plans';
import { BRAND } from '../lib/brand';

export default function PricingTable() {
  const [plans, setPlans] = useState<PublicPlan[]>(PUBLIC_PLANS);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [category, setCategory] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR'>('INR');
  const [showUpiModal, setShowUpiModal] = useState(false);

  useEffect(() => {
    fetch(`${BRAND.apiUrl}/api/v1/pricing/catalog`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const catalogPlans = json?.data?.plans || json?.data?.catalog?.plans || json?.data;
        if (Array.isArray(catalogPlans)) {
          setPlans((prev) =>
            prev.map((local) => {
              const matched = catalogPlans.find((r: any) => r.planId === local.id || r.id === local.id);
              if (!matched) return local;
              const monthlyInr = matched.monthlyPricePaise
                ? matched.monthlyPricePaise / 100
                : matched.price?.monthlyPricePaise
                ? matched.price.monthlyPricePaise / 100
                : local.monthlyPrice.INR;
              const annualInr = matched.annualPricePaise
                ? matched.annualPricePaise / 100
                : matched.price?.annualPricePaise
                ? matched.price.annualPricePaise / 100
                : local.annualPrice.INR;
              return {
                ...local,
                monthlyPrice: {
                  ...local.monthlyPrice,
                  INR: monthlyInr,
                },
                annualPrice: {
                  ...local.annualPrice,
                  INR: annualInr,
                },
              };
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  const filteredPlans = plans.filter((p) => p.category === category || p.id === 'free');

  const formatPrice = (plan: PublicPlan) => {
    const raw = billingCycle === 'annual' ? plan.annualPrice[currency] : plan.monthlyPrice[currency];
    if (raw === 0) return 'Free';
    const symbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '$';
    return `${symbol}${raw.toLocaleString()}`;
  };

  return (
    <div className="w-full space-y-10">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 backdrop-blur-md">
        {/* Category Tabs */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800/80">
          <button
            onClick={() => setCategory('PERSONAL')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              category === 'PERSONAL'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Personal & Creators
          </button>
          <button
            onClick={() => setCategory('BUSINESS')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              category === 'BUSINESS'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Teams & Agencies
          </button>
        </div>

        {/* Billing Toggle (50% Off Highlight) */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-800 transition-colors duration-200 ease-in-out focus:outline-none"
            role="switch"
            aria-checked={billingCycle === 'annual'}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-red-500 shadow ring-0 transition duration-200 ease-in-out ${
                billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium ${billingCycle === 'annual' ? 'text-white' : 'text-slate-400'}`}>Annually</span>
            <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800/40">50% OFF</span>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800/80 text-xs font-medium">
          {(['INR', 'USD', 'EUR'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                currency === c
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Free Tier Notice Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-5 py-3 text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">● Free Tier Always Available:</span>
          <span>Download and run 15 browser profiles on your local machine with offline SQLite and full dual-engine stealth.</span>
        </div>
        <Link href="/download" className="whitespace-nowrap font-bold text-emerald-400 hover:text-emerald-300 underline">
          Download Free Client →
        </Link>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlans.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 ${
              plan.highlight
                ? 'border-red-500/80 bg-slate-900/90 shadow-2xl shadow-red-950/30 ring-1 ring-red-500/50'
                : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
                Most Popular Choice
              </span>
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-mono">
                  {plan.profileLimit} Profiles
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400 min-h-[32px]">{plan.tagline}</p>

              {/* Price Display */}
              <div className="mt-5 flex items-baseline gap-1.5 border-y border-slate-800/80 py-4">
                <span className="text-3xl font-extrabold text-white tracking-tight">{formatPrice(plan)}</span>
                {plan.monthlyPrice[currency] > 0 && (
                  <span className="text-xs text-slate-400">
                    / mo {billingCycle === 'annual' ? '(billed yearly)' : ''}
                  </span>
                )}
              </div>

              {/* Feature Checklist */}
              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                {plan.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <svg className="h-4 w-4 flex-shrink-0 text-emerald-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA */}
            <div className="mt-8 space-y-2">
              <Link
                href={plan.ctaHref}
                className={`w-full inline-flex items-center justify-center rounded-xl py-3 text-xs font-bold transition shadow ${
                  plan.highlight
                    ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-900/40'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {plan.ctaText}
              </Link>

              {plan.monthlyPrice.INR > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUpiModal(true)}
                  className="w-full text-center text-[11px] text-slate-400 hover:text-emerald-400 transition"
                >
                  Pay via Instant UPI (₹ 0 Fees)
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Instant UPI Modal */}
      {showUpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
            <button
              onClick={() => setShowUpiModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            <h3 className="text-base font-bold text-white">Instant UPI Settlement (0% Fee)</h3>
            <p className="text-xs text-slate-400">
              Scan with Google Pay, PhonePe, Paytm, or BHIM. Zero processing surcharges.
            </p>
            <div className="mx-auto flex justify-center p-3 bg-white rounded-xl w-48 h-48 border-4 border-emerald-500/40">
              <img
                src={BRAND.assets.upiQr}
                alt="MAHI Browser UPI QR"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="rounded-lg bg-slate-950 p-2.5 text-xs border border-slate-800">
              <span className="text-slate-400">UPI VPA: </span>
              <span className="font-mono text-emerald-400 font-bold">{BRAND.upiId}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              After transfer, send transaction screenshot to <a href={`mailto:${BRAND.officialEmail}`} className="text-red-400 underline">{BRAND.officialEmail}</a> or WhatsApp <a href="tel:+919376343629" className="text-red-400 underline">{BRAND.phone}</a> for instant activation within 15 minutes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
