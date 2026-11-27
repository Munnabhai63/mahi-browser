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
          Effective Date: {BRAND.legal.effectiveDate} • Last Updated: {BRAND.legal.lastUpdated}
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
          <h2 className="text-lg font-bold text-white">3. Seller Identity & Contact</h2>
          <p>
            This software and associated gateway services are owned and operated by{' '}
            <strong className="text-white">{BRAND.legal.sellerName}</strong> (Sole Proprietorship), operating under the trade brand{' '}
            <strong className="text-white">{BRAND.legal.brandName}</strong>, located in{' '}
            <strong className="text-white">{BRAND.legal.state}, {BRAND.legal.country}</strong>.
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
            <li>
              <strong className="text-slate-300">GSTIN:</strong>{' '}
              {BRAND.legal.gstin || 'Not applicable (proprietorship below GST threshold)'}
            </li>
            <li>
              <strong className="text-slate-300">Registered Address:</strong>{' '}
              {BRAND.legal.registeredAddress || 'Available on request via support email'}
            </li>
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

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Payments, Subscriptions & Refunds</h2>
          <p>
            Subscription fees are billed in advance on a prepaid monthly or annual basis. UPI payments made directly to our merchant VPA <code className="text-slate-200">{BRAND.upiId}</code> are processed at 0% gateway fees and activated immediately upon UTR confirmation.
          </p>
          <p>
            We provide a 7-day money-back guarantee that applies strictly and exclusively to initial subscription purchases if the software fails to perform as described. Refunds are issued to the original payment method used during checkout. Refund requests must be directed to our support email (<a href={`mailto:${BRAND.officialEmail}`} className="text-slate-200 underline hover:text-white">{BRAND.officialEmail}</a>) accompanied by your registered account email and corresponding payment transaction ID or UPI UTR reference number.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Delivery & Activation</h2>
          <p>
            All software licenses, activation tokens, and account entitlements are delivered digitally; no physical goods or packaged media are shipped. Digital license activation is performed automatically upon verified payment clearance. Manual UPI payments activate after administrative verification of the submitted bank UTR reference. The desktop application installer and portable binary packages are available directly from our <a href="/download" className="text-slate-200 underline hover:text-white">Download Center</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Prohibited Conduct</h2>
          <p>
            You agree not to engage in any of the following restricted activities:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
            <li>Using the software to violate any applicable local, national, or international law or regulation.</li>
            <li>Engaging in unauthorized access, network disruption, or denial of service attacks against any computer system.</li>
            <li>Conducting fraudulent financial activities, credential harvesting, or phishing schemes.</li>
            <li>Transmitting, distributing, or deploying malware, viruses, trojans, or destructive code.</li>
            <li>Reselling, sublicensing, renting, or leasing the software or seat allocations without express written permission from the seller.</li>
            <li>Circumventing, tampering with, or bypassing license key validation, entitlement meters, or anti-tamper controls.</li>
            <li>Sharing account credentials, session tokens, or private license keys across unauthorized individuals or entities.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">7. Intellectual Property</h2>
          <p>
            All right, title, and interest in and to MAHI Browser—including software binaries, source code, user interfaces, branding, trademarks, logos, and technical documentation—remain the exclusive intellectual property of the seller ({BRAND.legal.sellerName}). The software is licensed, not sold, and no ownership rights or reverse-engineering entitlements are granted, except to the extent permitted by mandatory statutory law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">8. Data, Privacy & Retention</h2>
          <p>
            Your privacy is governed by our <a href="/privacy" className="text-slate-200 underline hover:text-white">Privacy Policy</a>. Browsing profile data, cookies, local cache files, and proxy assignments are stored locally on your device by default via SQLite. Cloud synchronization of profile metadata is strictly opt-in and client-side encrypted. Account records, license status, and payment references are retained while your customer account remains active.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">9. Disclaimer of Warranties</h2>
          <p>
            The software is provided on an "as-is" and "as-available" basis without warranties of any kind. While our stealth injection engines and rebrowser-patches are rigorously maintained to pass contemporary detection frameworks, we do not guarantee indefinite bypass of third-party security defenses that update their heuristics outside our control.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, in no event shall the seller ({BRAND.legal.sellerName}) be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or business interruption. The aggregate cumulative liability of the seller arising under or related to these Terms shall not exceed the total amount paid by you for the software license in the twelve (12) months immediately preceding the event giving rise to the claim.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">11. Termination</h2>
          <p>
            The seller reserves the right to suspend or terminate your software license and access to cloud services immediately, without notice, in the event of material breach of these Terms, non-payment of subscription fees, or engagement in prohibited conduct. You may terminate your subscription at any time by ceasing use of the software. Upon termination, all rights granted under these Terms immediately cease, and fees paid are non-refundable except as provided in Section 4.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">12. Grievance Redressal</h2>
          <p>
            In compliance with the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the details of the designated Grievance Officer are set forth below:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
            <li>
              <strong className="text-slate-300">Grievance Officer:</strong> {BRAND.legal.grievanceOfficer}
            </li>
            <li>
              <strong className="text-slate-300">Email:</strong>{' '}
              <a href={`mailto:${BRAND.legal.grievanceOfficerEmail}`} className="text-slate-200 underline hover:text-white">
                {BRAND.legal.grievanceOfficerEmail}
              </a>
            </li>
            <li>
              <strong className="text-slate-300">Jurisdiction:</strong> {BRAND.legal.state}, {BRAND.legal.country}
            </li>
            <li>
              <strong className="text-slate-300">Acknowledgement Commitment:</strong> Grievance requests will be acknowledged within 24–48 hours and redressed within a maximum of {BRAND.legal.grievanceResponseDays} business days.
            </li>
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            Unresolved statutory consumer complaints may be escalated to the appropriate Indian regulatory or judicial authority having jurisdiction.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">13. Governing Law & Jurisdiction</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts in Rajasthan, India.
          </p>
        </section>

        <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
          Last updated: {BRAND.legal.lastUpdated}
        </div>
      </div>
    </div>
  );
}
