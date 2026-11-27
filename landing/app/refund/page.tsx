import React from 'react';
import type { Metadata } from 'next';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy — MAHI Browser',
  description: '7-day money-back guarantee, refund eligibility, and cancellation policy for MAHI Browser.',
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Cancellation & Refund Policy</h1>
        <p className="mt-2 text-xs text-slate-400">
          Effective Date: {BRAND.legal.effectiveDate} • Last Updated: {BRAND.legal.lastUpdated}
        </p>
      </div>

      <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Scope</h2>
          <p>
            This Cancellation and Refund Policy applies strictly to initial, first-time subscription purchases of MAHI Browser desktop licenses. Subsequent recurring renewals, upgrades, or follow-on purchases are not classified as initial purchases.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Eligibility</h2>
          <p>
            You are eligible for a full refund under our {BRAND.legal.refundWindowDays}-day money-back guarantee if all of the following conditions are met:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
            <li>The refund request is submitted within exactly {BRAND.legal.refundWindowDays} calendar days from the initial payment date and time.</li>
            <li>The software demonstrably fails to perform according to its published specifications and technical documentation.</li>
            <li>The request is sent to our official support mailbox (<a href={`mailto:${BRAND.officialEmail}`} className="text-slate-200 underline hover:text-white">{BRAND.officialEmail}</a>) originating from your registered account email, referencing the payment transaction ID or UPI UTR number.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. What Is Not Covered</h2>
          <p>
            Refunds are not granted under any of the following circumstances:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
            <li>Subscription renewals (monthly or annual automated and manual renewal cycles).</li>
            <li>Add-on seat expansions, extra browser profile boosters, or team collaboration add-on packs.</li>
            <li>Custom residential proxy traffic, bandwidth top-ups, or third-party data packages.</li>
            <li>Accounts terminated, suspended, or restricted due to a violation of our Terms of Service or Acceptable Use Policy.</li>
            <li>Change of mind after the {BRAND.legal.refundWindowDays}-day guarantee window has lapsed.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. How to Request a Refund</h2>
          <p>
            To initiate a formal refund review, follow these steps:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-2">
            <li>Email our support team at <a href={`mailto:${BRAND.officialEmail}`} className="text-slate-200 underline hover:text-white">{BRAND.officialEmail}</a> with the subject line: <code>[Refund Request] - &lt;Your Registered Email&gt;</code>.</li>
            <li>Provide your order reference number, invoice ID, or UPI UTR transaction reference number.</li>
            <li>Briefly describe the technical discrepancy or performance issue encountered.</li>
            <li>You will receive an automated confirmation email once the request is received, followed by review by our billing department.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Refund Method</h2>
          <p>
            Approved refunds are credited exclusively to the original payment method utilized during the initial transaction (e.g. source UPI bank account via reverse transfer or source card). In accordance with banking network protocols, reversals reflect on your original account statement once processed by the clearing bank.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Contact Information</h2>
          <p>
            For any billing questions or refund status updates, please reach out via our official communication channels:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
            <li>
              <strong className="text-slate-300">Support Email:</strong>{' '}
              <a href={`mailto:${BRAND.officialEmail}`} className="text-slate-200 underline hover:text-white">
                {BRAND.officialEmail}
              </a>
            </li>
            <li>
              <strong className="text-slate-300">WhatsApp Support:</strong>{' '}
              <a href={BRAND.whatsapp.url} target="_blank" rel="noopener noreferrer" className="text-slate-200 underline hover:text-white">
                {BRAND.whatsapp.display}
              </a>
            </li>
          </ul>
        </section>

        <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
          Last updated: {BRAND.legal.lastUpdated}
        </div>
      </div>
    </div>
  );
}
