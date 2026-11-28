'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BRAND } from '../../lib/brand';
import type { SelectedPlanModalInfo } from './pricing-data';

interface UpiPaymentModalProps {
  isOpen: boolean;
  plan: SelectedPlanModalInfo | null;
  isYoupiEnabled: boolean;
  upiId: string;
  upiAccountHolder: string;
  upiQrAsset: string;
  whatsappRawNumber: string;
  sellerName: string;
  hasAuthToken: boolean;
  onClose: () => void;
  onUnauthenticated: () => void;
  onTrackFunnel: (eventName: string, metadata?: Record<string, unknown>) => void;
}

export function UpiPaymentModal({
  isOpen,
  plan,
  isYoupiEnabled,
  upiId,
  upiAccountHolder,
  upiQrAsset,
  whatsappRawNumber,
  sellerName,
  hasAuthToken,
  onClose,
  onUnauthenticated,
  onTrackFunnel,
}: UpiPaymentModalProps) {
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [utrSubmitted, setUtrSubmitted] = useState(false);
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [submittedPaymentId, setSubmittedPaymentId] = useState<string | null>(null);

  const planId = plan?.id;
  useEffect(() => {
    if (isOpen && planId) {
      setUtrSubmitted(false);
      setUtrInput('');
      setUtrError(null);
      setSubmittedPaymentId(null);
    }
  }, [isOpen, planId]);

  if (!isOpen || !plan) return null;

  // Copy VPA to clipboard (with safe promise catch and textarea fallback)
  const handleCopyUpi = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(upiId)
          .then(() => {
            setCopiedUpi(true);
            setTimeout(() => setCopiedUpi(false), 2500);
          })
          .catch(() => {
            setCopiedUpi(true);
            setTimeout(() => setCopiedUpi(false), 2500);
          });
      } else {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      }
    } catch (_) {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  // Handle UTR submission
  const handleUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUtr = utrInput.trim();
    if (!trimmedUtr) return;

    if (!/^[a-zA-Z0-9]{6,30}$/.test(trimmedUtr)) {
      setUtrError('Please enter a valid 6-30 character alphanumeric UTR / Transaction Reference number.');
      return;
    }

    setIsSubmittingUtr(true);
    setUtrError(null);

    try {
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/account/payments/upi/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: plan.cycle,
          utr: trimmedUtr,
          currency: 'INR',
        }),
      });

      if (resp.status === 401) {
        onUnauthenticated();
        setUtrError('Please log in first so we can attach this payment to your account.');
        return;
      }

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        setUtrError(
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || 'Could not submit UTR. Please check and retry.'
        );
        return;
      }

      onTrackFunnel('upi_utr_submitted', {
        utr: trimmedUtr,
        paymentId: data.payment_id,
        amountPaise: data.amount_paise,
      });
      setSubmittedPaymentId(data.payment_id || null);
      setUtrSubmitted(true);
    } catch {
      setUtrError('Network error. Your payment is safe — please retry or contact support.');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-[#0c0c0e] border border-white/10 p-6 sm:p-8 text-white shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
            <span className="text-[10px] font-mono font-medium uppercase tracking-[0.2em] text-zinc-400">
              INSTANT UPI ACTIVATION • 0% GATEWAY FEE
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-['Spectral',serif] font-normal text-white">
            {plan.name} Plan Activation
          </h3>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Amount: <strong className="text-white text-sm">₹{plan.price.toLocaleString()}</strong> ({plan.billingLabel})
          </p>
          {!isYoupiEnabled && (
            <p className="text-[11px] text-zinc-400 font-mono mt-2">
              Instant checkout is being activated. Manual UPI is available now.
            </p>
          )}
        </div>

        {/* UPI QR Code Container */}
        <div className="rounded-2xl bg-white p-4 flex flex-col items-center justify-center space-y-2">
          <Image
            src={upiQrAsset}
            alt="MAHI Browser UPI QR Code"
            width={192}
            height={192}
            className="w-48 h-48 object-contain rounded-lg"
          />
          <div className="text-[11px] font-mono text-zinc-600 text-center font-medium">
            Scan with PhonePe, GPay, Paytm, CRED or BHIM
          </div>
        </div>

        {/* Merchant Details & Copy VPA */}
        <div className="space-y-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 p-3.5 text-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Account Holder:</span>
            <span className="font-semibold text-white">{upiAccountHolder}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-zinc-800">
            <span>Official Merchant VPA:</span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                {upiId}
              </code>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-white transition-colors"
              >
                {copiedUpi ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* UTR Submission Form */}
        {!utrSubmitted ? (
          <form onSubmit={handleUtrSubmit} className="space-y-3">
            {!hasAuthToken && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
                <span>Sign in first so we can activate this payment on your account.</span>
                <a
                  href={`/login?redirect=${encodeURIComponent(`/pricing?plan=${plan.id}&currency=INR&openUpi=1`)}&plan=${encodeURIComponent(plan.id)}&currency=INR`}
                  className="shrink-0 underline font-semibold text-white hover:text-amber-100"
                >
                  Sign In
                </a>
              </div>
            )}
            {utrError && (
              <div className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-[#e6e3e3]">
                {utrError}
              </div>
            )}
            <div>
              <label htmlFor="utr-input" className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                Enter UTR / Transaction Reference No. (6-30 alphanumeric)
              </label>
              <input
                id="utr-input"
                type="text"
                required
                placeholder="e.g. 412345678901"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                className="w-full rounded-xl bg-black border border-zinc-700 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingUtr}
              className="w-full rounded-full bg-white text-black py-2.5 text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingUtr ? 'Submitting…' : 'Verify Payment & Submit'}
            </button>
          </form>
        ) : (
          <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 text-center space-y-2">
            <div className="text-white font-semibold text-sm">
              Payment Reference Recorded
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your UTR <code className="text-white font-mono">{utrInput}</code> for ₹{plan.price.toLocaleString()} has been submitted for verification.
              Your license will be activated after manual verification (usually within 24 hours).
              {submittedPaymentId && (
                <span className="block mt-1 font-mono text-[11px] text-zinc-400">
                  Keep this reference: <code className="text-white font-semibold">{submittedPaymentId}</code>
                </span>
              )}
            </p>
            <div className="pt-2">
              <a
                href={`https://wa.me/${whatsappRawNumber}?text=Hi%20${encodeURIComponent(sellerName.split(' ')[0])},%20I%20have%20paid%20INR%20${plan.price}%20via%20UPI%20for%20MAHI%20Browser%20${encodeURIComponent(plan.name)}%20Plan.%20UTR:%20${encodeURIComponent(utrInput)}${submittedPaymentId ? `%20Ref:%20${encodeURIComponent(submittedPaymentId)}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover:bg-zinc-200 transition-colors"
              >
                Confirm on WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Direct WhatsApp Instant Help */}
        <div className="text-center text-[11px] text-zinc-500 pt-1">
          Need instant activation help?{' '}
          <a
            href={`https://wa.me/${whatsappRawNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-300 hover:text-white underline"
          >
            Chat with Founder on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
