import React from 'react';
import type { Metadata } from 'next';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'Privacy Policy — MAHI Browser',
  description: 'Privacy Policy, local-first data protection guarantees, and compliance disclosures of MAHI Browser.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Privacy Policy</h1>
        <p className="mt-2 text-xs text-slate-400">
          Effective Date: {BRAND.legal.effectiveDate} • Last Updated: {BRAND.legal.lastUpdated}
        </p>
      </div>

      <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
        <p className="text-slate-400">
          This service and website are operated by{' '}
          <strong className="text-white">{BRAND.legal.sellerName}</strong> (Sole Proprietorship), operating under the trade name{' '}
          <strong className="text-white">{BRAND.legal.brandName}</strong>, located in{' '}
          <strong className="text-white">{BRAND.legal.state}, {BRAND.legal.country}</strong>.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Local-First Architecture Guarantee</h2>
          <p>
            MAHI Browser operates primarily as a local desktop software suite. Profiles, browsing histories, bookmarks, cookies, and local database entries created within the desktop application are stored on your local machine using an embedded SQLite database. We do not transmit or inspect your local browsing data or decrypted cookies without your explicit opt-in to cloud synchronization.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Optional Encrypted Cloud Synchronization</h2>
          <p>
            When you subscribe to a plan featuring cloud synchronization, profiles uploaded to our Cloudflare R2 bucket are encrypted client-side using industry-standard AES-256-GCM. Cloud synchronization is strictly opt-in. We store only metadata required for distributed concurrency locks (e.g. active profile ID, lock lease duration, client instance ID) in our central database.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Information Collected for Licensing & Support</h2>
          <p>
            When purchasing a license or signing up for our services, we collect minimal operational information:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
            <li>Account credentials (Email, hashed password, or OAuth tokens)</li>
            <li>Machine identification hashes for node-locked seat counting</li>
            <li>Payment references (Transaction IDs, UPI UTR numbers)</li>
          </ul>
          <p className="text-xs text-slate-400 mt-1">
            Customer account and licensing data is retained while your account remains active.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Third-Party Disclosures</h2>
          <p>
            We do not sell, rent, or trade your personal information or browsing telemetry to any third party. Data processed by residential proxy partners is subject to their respective network privacy terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Data Deletion & Contact Information</h2>
          <p>
            For privacy inquiries or data deletion requests, contact us at <a href={`mailto:${BRAND.officialEmail}`} className="text-zinc-300 hover:text-white underline">{BRAND.officialEmail}</a> or via <a href="https://wa.me/919376343629" className="text-zinc-300 hover:text-white underline">WhatsApp Support</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Grievance Redressal Officer</h2>
          <p>
            In compliance with the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the designated Grievance Officer for data protection and privacy matters is set forth below:
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
              <strong className="text-slate-300">Acknowledgement Commitment:</strong> All grievances are acknowledged within 24–48 hours and resolved within {BRAND.legal.grievanceResponseDays} business days.
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
