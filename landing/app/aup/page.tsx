import type { Metadata } from 'next';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy (AUP) — MAHI Browser',
  description: 'Acceptable Use Policy and strict prohibition of malicious activities using MAHI Browser.',
};

export default function AcceptableUsePolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Acceptable Use Policy (AUP)</h1>
        <p className="mt-2 text-xs text-slate-400">
          Last Updated: November 16, 2026 • Strict Enforcement
        </p>
      </div>

      <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Principle of Responsible Usage</h2>
          <p>
            MAHI Browser is designed to empower privacy researchers, cybersecurity analysts, digital marketers, and legitimate businesses to maintain distinct browser environments and protect user privacy. All users must adhere to ethical and lawful standards.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Prohibited Malicious Activities</h2>
          <p>You may NOT use MAHI Browser or its associated cloud proxies to engage in:</p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400 pl-2">
            <li>Credential stuffing, brute-force attacks, or unauthorized account takeovers</li>
            <li>Distributed Denial of Service (DDoS) or network flooding attacks</li>
            <li>Distribution of malware, ransomware, spyware, or phishing campaigns</li>
            <li>Carding, financial fraud, money laundering, or illegal transaction processing</li>
            <li>Harassment, non-consensual surveillance, or violation of applicable data protection statutes</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Zero-Tolerance Termination</h2>
          <p>
            Violation of this Acceptable Use Policy results in immediate and permanent revocation of software licenses, termination of cloud profile storage access, and blacklisting without right of refund. We cooperate fully with law enforcement authorities in investigating unlawful abuse.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Abuse Reporting</h2>
          <p>
            To report suspected violations of this policy, please email our security desk at <a href={`mailto:${BRAND.officialEmail}`} className="text-red-400 hover:underline">{BRAND.officialEmail}</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
