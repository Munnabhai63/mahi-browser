import type React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { AccountPaymentInfo, AccountPaymentRecord } from '../../../10_CONFIG/shared/types/commercial.js';
import { CONTACT_CONFIG } from '../../../10_CONFIG/contact-config.js';
import type { DesktopPlanOption } from './account-plan-config.js';

interface AccountBillingTabProps {
  activePlanMeta: DesktopPlanOption;
  dynamicPlans: DesktopPlanOption[];
  priceInr: number;
  priceUsd: number;
  paymentMethod: 'upi' | 'crypto';
  showPaymentForm: boolean;
  utrInput: string;
  txHashInput: string;
  isSubmittingPayment: boolean;
  paymentSubmittedStatus: string | null;
  latestPayment: AccountPaymentRecord | null;
  paymentInfo: AccountPaymentInfo | null;
  accountEmail?: string;
  onSelectPlan: (plan: DesktopPlanOption) => void;
  onPaymentMethodChange: (method: 'upi' | 'crypto') => void;
  onTogglePaymentForm: () => void;
  onUtrChange: (value: string) => void;
  onTxHashChange: (value: string) => void;
  onCopyToClipboard: (text: string, label: string) => void;
  onOnlineCheckout: () => void;
  onRefreshPaymentStatus: () => void;
  onSubmitPayment: (e: React.FormEvent) => void;
  onSubmitCryptoPayment: (e: React.FormEvent) => void;
}

export const AccountBillingTab: React.FC<AccountBillingTabProps> = ({
  activePlanMeta,
  dynamicPlans,
  priceInr,
  priceUsd,
  paymentMethod,
  showPaymentForm,
  utrInput,
  txHashInput,
  isSubmittingPayment,
  paymentSubmittedStatus,
  latestPayment,
  paymentInfo,
  accountEmail,
  onSelectPlan,
  onPaymentMethodChange,
  onTogglePaymentForm,
  onUtrChange,
  onTxHashChange,
  onCopyToClipboard,
  onOnlineCheckout,
  onRefreshPaymentStatus,
  onSubmitPayment,
  onSubmitCryptoPayment,
}) => {
  const upiId = paymentInfo?.upi_id || CONTACT_CONFIG.UPI_ID;
  const upiHolder = paymentInfo?.upi_account_holder || CONTACT_CONFIG.UPI_ACCOUNT_HOLDER;
  const upiQrAsset = paymentInfo?.upi_qr_asset || CONTACT_CONFIG.UPI_QR_ASSET;
  const usdtEnabled = paymentInfo?.usdt_enabled ?? CONTACT_CONFIG.USDT_ENABLED;
  const usdtAddress = paymentInfo?.usdt_address || CONTACT_CONFIG.USDT_ADDRESS;
  const usdtNetwork = paymentInfo?.usdt_network || CONTACT_CONFIG.USDT_NETWORK;
  const usdtQrAsset = paymentInfo?.usdt_qr_asset || CONTACT_CONFIG.USDT_QR_ASSET;
  const waNumber = paymentInfo?.whatsapp_number || CONTACT_CONFIG.WHATSAPP_NUMBER;
  const waCleanNumber = waNumber.replace(/[^0-9]/g, '') || CONTACT_CONFIG.WHATSAPP_RAW_NUMBER;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-teal-950/40 to-slate-900 border border-teal-800/60 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-teal-400">
          <Sparkles size={16} />
          <h4 className="font-bold text-sm text-white">
            Upgrade to MAHI {activePlanMeta.name} (
            {activePlanMeta.profiles >= 100000 ? 'Unlimited Profiles' : `${activePlanMeta.profiles} Profiles`})
          </h4>
        </div>
        <span className="shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          ₹{priceInr.toLocaleString()} / {activePlanMeta.durationLabel}
        </span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Unlock isolated anti-detect browser containers, automated workflows, custom proxy routing, and encrypted cloud backup.
      </p>

      {/* Canonical 3-Tier Plan Selector (Starter / Growth / Ultimate) */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Choose Plan</span>
          <span className="text-[11px] font-mono text-teal-300">
            {activePlanMeta.concurrent} Concurrent Windows
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {dynamicPlans.map((p) => {
            const isSelected = p.id === activePlanMeta.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => onSelectPlan(p)}
                className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-xs'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">• {p.durationLabel}</span>
                    {p.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {p.profiles >= 100000 ? 'Unlimited Profiles' : `${p.profiles} Profiles`} • {p.rateSubtext}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-extrabold text-emerald-300">
                    {paymentMethod === 'crypto' ? `$${p.priceUsd} USDT` : `₹${p.priceInr.toLocaleString()}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Container (UPI / Crypto USDT TRC-20) */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 gap-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Zap size={14} className="text-teal-400" />
            {paymentMethod === 'crypto' ? 'USDT (TRC-20) Payment' : 'UPI Payment'}
          </span>
          {usdtEnabled && usdtAddress ? (
            <div className="inline-flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => onPaymentMethodChange('upi')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  paymentMethod === 'upi' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                UPI (₹)
              </button>
              <button
                type="button"
                onClick={() => onPaymentMethodChange('crypto')}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  paymentMethod === 'crypto' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                USDT ($)
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-emerald-400">Verified Gateway</span>
          )}
        </div>

        {paymentMethod === 'crypto' && usdtEnabled && usdtAddress ? (
          <>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2 bg-white rounded-xl shadow-lg shrink-0 flex flex-col items-center">
                <img
                  src={usdtQrAsset}
                  alt="Official MAHI USDT TRC-20 QR"
                  className="w-32 h-32 object-contain rounded-lg"
                />
                <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase tracking-wider">TRON (TRC-20)</span>
              </div>

              <div className="space-y-2.5 w-full text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Network</span>
                  <strong className="text-emerald-300 text-xs block">{usdtNetwork}</strong>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">USDT Wallet Address</span>
                  <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 mt-0.5">
                    <strong className="text-teal-400 font-mono text-[11px] break-all">{usdtAddress}</strong>
                    <button
                      type="button"
                      onClick={() => onCopyToClipboard(usdtAddress, 'USDT TRC-20 Address')}
                      className="shrink-0 text-slate-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                      title="Copy USDT TRC-20 Address"
                    >
                      <Copy size={11} />
                      <span className="text-[10px]">Copy</span>
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Payable Amount</span>
                  <strong className="text-emerald-400 font-bold text-sm">${priceUsd} USDT (TRC-20)</strong>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCopyToClipboard(usdtAddress, 'USDT TRC-20 Address')}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5"
              >
                <Copy size={13} />
                <span>Copy Address</span>
              </button>

              <button
                type="button"
                onClick={onTogglePaymentForm}
                className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                <span>{showPaymentForm ? 'Hide TX Form' : 'I Have Sent USDT'}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Authoritative Slice QR Asset */}
              <div className="p-2 bg-white rounded-xl shadow-lg shrink-0 flex flex-col items-center">
                <img
                  src={upiQrAsset}
                  alt="Official MAHI UPI QR"
                  className="w-32 h-32 object-contain rounded-lg"
                />
                <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase tracking-wider">Scan with UPI App</span>
              </div>

              {/* UPI Account Details */}
              <div className="space-y-2.5 w-full text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Holder</span>
                  <strong className="text-white text-sm block">{upiHolder}</strong>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">UPI ID</span>
                  <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 mt-0.5">
                    <strong className="text-teal-400 font-mono text-xs">{upiId}</strong>
                    <button
                      type="button"
                      onClick={() => onCopyToClipboard(upiId, 'UPI ID')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                      title="Copy UPI ID"
                    >
                      <Copy size={11} />
                      <span className="text-[10px]">Copy</span>
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Payable Amount</span>
                  <strong className="text-emerald-400 font-bold text-sm">₹{priceInr} INR</strong>
                </div>
              </div>
            </div>

            {/* Action Buttons: Copy UPI ID, Online Checkout & I Have Paid */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCopyToClipboard(upiId, 'UPI ID')}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5"
              >
                <Copy size={13} />
                <span>Copy UPI</span>
              </button>

              <button
                type="button"
                onClick={onOnlineCheckout}
                className="py-2 px-3 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                title="Instant UPI online checkout"
              >
                <Sparkles size={13} />
                <span>Instant UPI</span>
              </button>

              <button
                type="button"
                onClick={onTogglePaymentForm}
                className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                <span>{showPaymentForm ? 'Hide Form' : 'I Have Paid'}</span>
              </button>
            </div>
          </>
        )}

        {/* Latest Payment Status / History Banner */}
        {(latestPayment || paymentSubmittedStatus) && (
          <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
            (latestPayment?.status === 'SUCCEEDED' || paymentSubmittedStatus === 'SUCCEEDED')
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : (latestPayment?.status === 'REJECTED' || latestPayment?.status === 'FAILED')
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-1.5">
                {(latestPayment?.status === 'SUCCEEDED' || paymentSubmittedStatus === 'SUCCEEDED') ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (latestPayment?.status === 'REJECTED' || latestPayment?.status === 'FAILED') ? (
                  <AlertTriangle size={14} className="text-rose-400" />
                ) : (
                  <Clock size={14} className="text-amber-400" />
                )}
                <span>Payment Status: {latestPayment?.status || paymentSubmittedStatus}</span>
              </div>
              <button
                type="button"
                onClick={onRefreshPaymentStatus}
                className="text-[11px] flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 transition"
              >
                <RotateCcw size={11} />
                <span>Refresh Status</span>
              </button>
            </div>
            {(latestPayment?.externalPaymentId || latestPayment?.external_payment_id) && (
              <div className="text-[11px] font-mono text-slate-400">
                Ref: {latestPayment.externalPaymentId || latestPayment.external_payment_id}
              </div>
            )}
            {(latestPayment?.status === 'REJECTED' || latestPayment?.status === 'FAILED') && (
              <p className="text-[11px] text-rose-300 leading-relaxed font-semibold">
                Rejection Reason: {latestPayment?.metadata?.rejectionReason || latestPayment?.rejection_reason || 'Verification was declined. Please verify your UTR and resubmit.'}
              </p>
            )}
            {(latestPayment?.status === 'PENDING_VERIFICATION' || paymentSubmittedStatus === 'PENDING_VERIFICATION') && (
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Your payment is under review. An administrator will verify and activate your subscription.
              </p>
            )}
          </div>
        )}

        {/* Verification Form */}
        {showPaymentForm && (
          <form
            onSubmit={paymentMethod === 'crypto' ? onSubmitCryptoPayment : onSubmitPayment}
            className="mt-3 pt-3 border-t border-slate-800/80 space-y-3"
          >
            {paymentSubmittedStatus ? (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 size={15} />
                  <span>Status: {paymentSubmittedStatus}</span>
                </div>
                <p className="text-[11px] text-emerald-400/90 leading-relaxed">
                  Your {paymentMethod === 'crypto' ? 'TRC-20 transaction hash' : 'UTR'} has been submitted for manual approval. An administrator will verify and activate your PRO entitlement.
                </p>
              </div>
            ) : paymentMethod === 'crypto' ? (
              <>
                <div>
                  <label htmlFor="field-001" className="text-[11px] font-bold text-slate-300 block mb-1">
                    TRON (TRC-20) Transaction Hash <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="field-001"
                    type="text"
                    value={txHashInput}
                    onChange={(e) => onTxHashChange(e.target.value)}
                    placeholder="Paste 64-character TRC-20 transaction hash"
                    maxLength={64}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-teal-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Send ONLY USDT on the TRON (TRC-20) network and paste the full 64-char TX hash from TronLink / Binance / OKX.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2"
                >
                  {isSubmittingPayment ? (
                    <span>Submitting TX Hash...</span>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Submit Crypto Payment for Approval</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="field-002" className="text-[11px] font-bold text-slate-300 block mb-1">
                    UTR / Bank Reference Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="field-002"
                    type="text"
                    value={utrInput}
                    onChange={(e) => onUtrChange(e.target.value)}
                    placeholder="e.g. 427189028341 (12 digits)"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-teal-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Found in your GPay / PhonePe / Paytm / Slice payment receipt under "UTR" or "UPI Ref ID".
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2"
                >
                  {isSubmittingPayment ? (
                    <span>Verifying &amp; Submitting...</span>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Submit Payment for Approval</span>
                    </>
                  )}
                </button>
              </>
            )}
          </form>
        )}
      </div>

      {/* WhatsApp Support Backup */}
      <a
        href={`https://wa.me/${waCleanNumber}?text=${encodeURIComponent(`Hi, I need help with MAHI PRO payment. Email: ${accountEmail || ''}`)}`}
        target="_blank"
        rel="noreferrer"
        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700/60 transition"
      >
        <span>Need Help? Contact WhatsApp Support ({paymentInfo?.whatsapp_number || CONTACT_CONFIG.WHATSAPP_DISPLAY})</span>
        <ExternalLink size={12} />
      </a>
    </div>
  );
};
