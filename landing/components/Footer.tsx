import React from 'react';
import Link from 'next/link';
import { BRAND } from '../lib/brand';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={BRAND.assets.logo}
                alt="MAHI Browser"
                width={36}
                height={36}
                draggable={false}
                className="footer-brand-logo-img h-9 w-9 object-contain select-none rounded-lg"
                style={{ userSelect: 'none' }}
              />
              <span className="font-bold text-lg text-white tracking-tight">
                MAHI <span className="text-red-500 font-extrabold">Browser</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              {BRAND.tagline}. Developed by {BRAND.creator}. Engineered for media buyers, growth teams, and automation architects.
            </p>
            <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-900">
              <p className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Direct Support:</span>
                <a href={`mailto:${BRAND.officialEmail}`} className="text-slate-300 hover:text-red-400 transition">{BRAND.officialEmail}</a>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Operations:</span>
                <a href={`mailto:${BRAND.hubEmail}`} className="text-slate-300 hover:text-red-400 transition">{BRAND.hubEmail}</a>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">WhatsApp / Call:</span>
                <a href="tel:+919376343629" className="text-slate-300 hover:text-red-400 transition">{BRAND.phone}</a>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Direct UPI Settlement:</span>
                <span className="font-mono text-emerald-400 font-semibold">{BRAND.upiId}</span>
              </p>
            </div>
          </div>

          {/* Product Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/#features" className="hover:text-white transition">Core Features</Link></li>
              <li><Link href="/#dual-engine" className="hover:text-white transition">Dual Engine Matrix</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition">Plans & Pricing</Link></li>
              <li><Link href="/download" className="hover:text-white transition">Download Client</Link></li>
              <li><Link href="/compare/gologin-alternative" className="hover:text-white transition">GoLogin vs MAHI</Link></li>
              <li><Link href="/book-demo" className="hover:text-white transition">Book Enterprise Demo</Link></li>
            </ul>
          </div>

          {/* Docs & Resources Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/docs/getting-started" className="hover:text-white transition">Quickstart Guide</Link></li>
              <li><Link href="/docs/anti-detect-fingerprinting" className="hover:text-white transition">Fingerprint Stealth</Link></li>
              <li><Link href="/docs/proxy-configuration" className="hover:text-white transition">Proxy Protocols</Link></li>
              <li><Link href="/docs/automation-api" className="hover:text-white transition">Automation & RPA</Link></li>
              <li><Link href="/docs/team-workspaces" className="hover:text-white transition">Team Workspaces</Link></li>
              <li><Link href="/blog" className="hover:text-white transition">Engineering Blog</Link></li>
            </ul>
          </div>

          {/* Trust & Legal Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Legal & Trust</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/aup" className="hover:text-white transition">Acceptable Use Policy</Link></li>
              <li><span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">● Cloud Systems Operational</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 {BRAND.legalName}. All rights reserved.</p>
          <p className="text-slate-400">
            Engineered with Zero CDP Leak Technology. Built for privacy, speed, and cross-platform resilience.
          </p>
        </div>
      </div>
    </footer>
  );
}
