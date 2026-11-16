import React from 'react';
import type { Metadata } from 'next';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'Terms of Service — MAHI Browser',
  description: 'Terms of Service, licensing conditions, and usage policies for MAHI Browser.',
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Terms of Service</h1>
        <p className="mt-2 text-xs text-slate-400">
          Last Updated: November 16, 2026 • Effective Immediately
        </p>
      </div>

      <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Software License Grant</h2>
          <p>
            Subject to your compliance with these Terms, MAHI Browser grants you a non-exclusive, non-transferable, revocable license to install and run the MAHI Browser desktop application and access our Cloud Gateway according to your purchased license tier and seat allocation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Permitted Use</h2>
          <p>
            MAHI Browser is provided as a browser privacy and testing environment designed for privacy research, authorized QA testing, digital marketing management, affiliate administration, and legitimate web automation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Payments, Subscriptions & Refunds</h2>
          <p>
            Subscription fees are billed in advance on a monthly or annual basis. We provide a 7-day money-back guarantee for initial subscriptions if the software fails to perform as described. UPI payments made directly to our merchant VPA <code className="text-slate-200">6375823589@slc</code> are processed at 0% gateway fees and activated immediately upon UTR confirmation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Disclaimer of Warranties</h2>
          <p>
            The software is provided on an "as-is" and "as-available" basis without warranties of any kind. While our stealth injection engines and rebrowser-patches are rigorously maintained to pass contemporary detection frameworks, we do not guarantee indefinite bypass of third-party security defenses that update their heuristics outside our control.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Governing Law & Jurisdiction</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts in Rajasthan, India.
          </p>
        </section>
      </div>
    </div>
  );
}
