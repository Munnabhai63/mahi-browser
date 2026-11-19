import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND, buildWhatsAppLink } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'Contact Us — MAHI Browser',
  description: 'Get in touch with the MAHI Browser team for technical support, billing inquiries, business partnerships, or grievance redressal.',
};

export default function ContactPage() {
  const whatsappUrl = buildWhatsAppLink();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Contact Us</h1>
        <p className="mt-2 text-xs text-slate-400">
          We are here to assist with technical support, licensing, billing, and general inquiries.
        </p>
      </div>

      <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
        {/* Support & Billing */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Customer Support & Billing</h2>
          <p>
            For license inquiries, account activations, technical questions, or refund requests, reach out directly to our dedicated support mailbox:
          </p>
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Support & Billing Email</span>
              <a
                href={`mailto:${BRAND.officialEmail}`}
                className="text-base font-medium text-white underline hover:text-slate-300 transition-colors"
              >
                {BRAND.officialEmail}
              </a>
            </div>
            <p className="text-xs text-slate-400">
              For account or billing issues, include your registered email and payment id or UTR.
            </p>
          </div>
        </section>

        {/* Business Inquiries */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Business & Enterprise Partnerships</h2>
          <p>
            For enterprise licensing, high-volume seat allocations, custom anti-detect deployment, or partnership proposals:
          </p>
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Business Inquiries Email</span>
            <a
              href={`mailto:${BRAND.hubEmail}`}
              className="text-base font-medium text-white underline hover:text-slate-300 transition-colors"
            >
              {BRAND.hubEmail}
            </a>
          </div>
        </section>

        {/* Instant Messaging Support */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Instant Messaging Support</h2>
          <p>
            Need rapid verification for your UPI payment or fast onboarding assistance? Chat directly with our support team on WhatsApp:
          </p>
          <div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white font-medium hover:bg-slate-700 hover:border-slate-600 transition-colors"
            >
              Chat on WhatsApp ({BRAND.whatsapp.display})
            </a>
          </div>
        </section>

        {/* Grievance Redressal Officer */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Grievance Redressal Officer</h2>
          <p>
            In compliance with the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, any legal notices, consumer grievances, or compliance concerns may be submitted directly to our appointed Grievance Officer:
          </p>
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
            <ul className="space-y-1 text-slate-300">
              <li>
                <strong className="text-white">Officer:</strong> {BRAND.legal.grievanceOfficer}
              </li>
              <li>
                <strong className="text-white">Email:</strong>{' '}
                <a href={`mailto:${BRAND.legal.grievanceOfficerEmail}`} className="text-slate-200 underline hover:text-white">
                  {BRAND.legal.grievanceOfficerEmail}
                </a>
              </li>
              <li>
                <strong className="text-white">Jurisdiction:</strong> {BRAND.legal.state}, {BRAND.legal.country}
              </li>
              <li>
                <strong className="text-white">Statutory Acknowledgement:</strong> Acknowledged within 24–48 hours; full redressal committed within a maximum of {BRAND.legal.grievanceResponseDays} business days.
              </li>
            </ul>
          </div>
        </section>

        {/* Quick Legal Links */}
        <section className="space-y-3 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Policies & Documentation</h2>
          <div className="flex flex-wrap gap-4 text-xs text-slate-300">
            <Link href="/terms" className="hover:text-white underline underline-offset-4">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-white underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/refund" className="hover:text-white underline underline-offset-4">
              Cancellation & Refund Policy
            </Link>
            <Link href="/aup" className="hover:text-white underline underline-offset-4">
              Acceptable Use Policy
            </Link>
          </div>
        </section>

        <div className="pt-4 text-xs text-slate-500">
          Last updated: {BRAND.legal.lastUpdated}
        </div>
      </div>
    </div>
  );
}
