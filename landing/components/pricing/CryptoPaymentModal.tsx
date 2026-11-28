'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BRAND } from '../../lib/brand';
import type { SelectedPlanModalInfo } from './pricing-data';

interface CryptoPaymentModalProps {
  isOpen: boolean;
  plan: SelectedPlanModalInfo | null;
  usdtNetwork: string;
  usdtAddress: string;
  usdtQrAsset: string;
  whatsappRawNumber: string;
  sellerName: string;
  hasAuthToken: boolean;
  onClose: () => void;
  onUnauthenticated: () => void;
  onTrackFunnel: (eventName: string, metadata?: Record<string, unknown>) => void;
}

export function CryptoPaymentModal({
  isOpen,
  plan,
  usdtNetwork,
  usdtAddress,
  usdtQrAsset,
  whatsappRawNumber,
  sellerName,
  hasAuthToken,
  onClose,
  onUnauthenticated,
  onTrackFunnel,
}: CryptoPaymentModalProps) {
  const [copiedCrypto, setCopiedCrypto] = useState(false);
  const [txHashInput, setTxHashInput] = useState('');
  const [txSubmitted, setTxSubmitted] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [submittedCryptoPaymentId, setSubmittedCryptoPaymentId] = useState<string | null>(null);

  const planId = plan?.id;
  useEffect(() => {
    if (isOpen && planId) {
      setTxSubmitted(false);
      setTxHashInput('');
      setTxError(null);
      setSubmittedCryptoPaymentId(null);
    }
  }, [isOpen, planId]);

  if (!isOpen || !plan) return null;

  const handleCopyCrypto = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(usdtAddress)
          .then(() => {
            setCopiedCrypto(true);
            setTimeout(() => setCopiedCrypto(false), 2500);
          })
          .catch(() => {
            setCopiedCrypto(true);
            setTimeout(() => setCopiedCrypto(false), 2500);
          });
      } else {
        setCopiedCrypto(true);
        setTimeout(() => setCopiedCrypto(false), 2500);
      }
    } catch (_) {
      setCopiedCrypto(true);
      setTimeout(() => setCopiedCrypto(false), 2500);
    }
  };

  const handleCryptoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedHash = txHashInput.trim();
    if (!trimmedHash) return;

    if (!/^[a-fA-F0-9]{64}$/.test(trimmedHash)) {
      setTxError('Please paste a valid 64-character TRON (TRC-20) transaction hash.');
      return;
    }

    setIsSubmittingTx(true);
    setTxError(null);

    try {
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/account/payments/crypto/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
          billingCycle: plan.cycle,
          txHash: trimmedHash,
          network: usdtNetwork,
        }),
      });

      if (resp.status === 401) {
        onUnauthenticated();
        setTxError('Please log in first so we can attach this USDT payment to your account.');
        return;
      }

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        setTxError(
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || 'Could not submit TRC-20 transaction hash. Please check and retry.'
        );
        return;
      }

      onTrackFunnel('crypto_tx_submitted', {
        txHash: trimmedHash,
        paymentId: data.payment_id,
        amountCents: data.amount_cents,
      });
      setSubmittedCryptoPaymentId(data.payment_id || null);
      setTxSubmitted(true);
    } catch {
      setTxError('Network error. Your transaction is safe on-chain — please retry or contact support.');
    } finally {
      setIsSubmittingTx(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0a0a0c] border border-zinc-800 p-6 sm:p-7 text-left shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400 mb-1">
            USDT Crypto Checkout • {usdtNetwork}
          </div>
          <h3 className="font-['Spectral',serif] text-2xl font-light text-white">
            {plan.name} — ${plan.price.toLocaleString()} USDT
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {plan.billingLabel}
          </p>
          <p className="text-[11px] text-amber-300/90 font-mono mt-2">
            Send ONLY USDT via TRON (TRC-20) network to this address.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 flex flex-col items-center justify-center space-y-2">
          <Image
            src={usdtQrAsset}
            alt="MAHI Browser USDT TRC-20 QR Code"
            width={192}
            height={192}
            className="w-48 h-48 object-contain rounded-lg"
          />
          <div className="text-[11px] font-mono text-zinc-600 text-center font-medium">
            Scan with TronLink, Trust Wallet, Binance, Bybit or OKX
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 p-3.5 text-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Network:</span>
            <span className="font-semibold text-emerald-400">{usdtNetwork}</span>
          </div>
          <div className="space-y-1.5 pt-1 border-t border-zinc-800">
            <span className="text-zinc-400 block">TRC-20 Wallet Address:</span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[11px] text-zinc-200 bg-zinc-800 px-2.5 py-1.5 rounded border border-zinc-700 break-all flex-1">
                {usdtAddress}
              </code>
              <button
                type="button"
                onClick={handleCopyCrypto}
                className="shrink-0 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-white transition-colors"
              >
                {copiedCrypto ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {!txSubmitted ? (
          <form onSubmit={handleCryptoSubmit} className="space-y-3">
            {!hasAuthToken && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2">
                <span>Sign in first so we can activate this payment on your account.</span>
                <a
                  href={`/login?redirect=${encodeURIComponent(`/pricing?plan=${plan.id}&currency=USD&openCrypto=1`)}&plan=${encodeURIComponent(plan.id)}&currency=USD`}
                  className="shrink-0 underline font-semibold text-white hover:text-amber-100"
                >
                  Sign In
                </a>
              </div>
            )}
            {txError && (
              <div className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-[#e6e3e3]">
                {txError}
              </div>
            )}
            <div>
              <label htmlFor="txhash-input" className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                Enter TRON (TRC-20) Transaction Hash (64 characters)
              </label>
              <input
                id="txhash-input"
                type="text"
                required
                maxLength={64}
                placeholder="Paste 64-character TRC-20 transaction hash"
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                className="w-full rounded-xl bg-black border border-zinc-700 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingTx}
              className="w-full rounded-full bg-white text-black py-2.5 text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingTx ? 'Submitting TX…' : 'Verify USDT TX & Submit'}
            </button>
          </form>
        ) : (
          <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 text-center space-y-2">
            <div className="text-white font-semibold text-sm">
              USDT Transaction Recorded
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your TRC-20 TX <code className="text-white font-mono break-all">{txHashInput}</code> for ${plan.price.toLocaleString()} USDT has been submitted for verification.
              {submittedCryptoPaymentId && (
                <span className="block mt-1 font-mono text-[11px] text-zinc-400">
                  Reference: <code className="text-white font-semibold">{submittedCryptoPaymentId}</code>
                </span>
              )}
            </p>
            <div className="pt-2">
              <a
                href={`https://wa.me/${whatsappRawNumber}?text=Hi%20${encodeURIComponent(sellerName.split(' ')[0])},%20I%20have%20paid%20${plan.price}%20USDT%20(TRC-20)%20for%20MAHI%20Browser%20${encodeURIComponent(plan.name)}%20Plan.%20TX:%20${encodeURIComponent(txHashInput)}${submittedCryptoPaymentId ? `%20Ref:%20${encodeURIComponent(submittedCryptoPaymentId)}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover:bg-zinc-200 transition-colors"
              >
                Confirm on WhatsApp
              </a>
            </div>
          </div>
        )}

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
