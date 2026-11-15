'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BRAND } from '../../lib/brand';

export default function BookDemoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [teamSize, setTeamSize] = useState('10-50');
  const [useCase, setUseCase] = useState('Affiliate Marketing & Media Buying');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await fetch(`${BRAND.apiUrl}/api/v1/commercial/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          teamSize,
          useCase,
          phone,
          source: 'enterprise_demo_page',
          timestamp: new Date().toISOString(),
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true); // graceful offline UX
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left column info */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3.5 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
            Enterprise Fleet Consultation
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Deploy Undetectable Browser Fleets at Scale
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Schedule a 1-on-1 architecture review with MAHI Browser's core engineering team. We'll audit your current anti-detect setup, verify CreepJS and Cloudflare bypass rates, and demonstrate distributed Redis concurrency locking.
          </p>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">
                ✓
              </div>
              <div className="text-xs sm:text-sm text-slate-300">
                <strong className="text-white">Custom C++ Engine Builds:</strong> Private ANGLE WebGL and canvas noise patches customized exclusively for your domain fleet.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">
                ✓
              </div>
              <div className="text-xs sm:text-sm text-slate-300">
                <strong className="text-white">Dedicated On-Premise Fastify Gateway:</strong> Self-hosted central database and distributed profile mutex on your private VPC.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">
                ✓
              </div>
              <div className="text-xs sm:text-sm text-slate-300">
                <strong className="text-white">Direct WhatsApp Engineering Channel:</strong> 24/7 direct escalation line to Munna Bhai and core developers.
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Direct Contact Details</div>
            <div className="text-xs text-slate-300 space-y-1">
              <div>Email: <a href={`mailto:${BRAND.officialEmail}`} className="text-red-400 hover:underline">{BRAND.officialEmail}</a></div>
              <div>WhatsApp: <a href={`https://wa.me/919376343629`} className="text-red-400 hover:underline">{BRAND.phone}</a></div>
              <div>Founder: <strong className="text-white">{BRAND.creator}</strong></div>
            </div>
          </div>
        </div>

        {/* Right column form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          {submitted ? (
            <div className="text-center py-12 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950 border border-emerald-600 text-emerald-400 text-2xl font-black">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-white">Consultation Request Received!</h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
                Thank you, <strong className="text-white">{name}</strong>. Munna Bhai or our enterprise lead will contact you via WhatsApp / email within 2 hours.
              </p>
              <div className="pt-4">
                <Link
                  href="/download"
                  className="rounded-xl bg-red-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-red-500 transition"
                >
                  Download Free Desktop Client
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-white">Request Enterprise Access</h2>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Munna Bhai"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="munna@enterprise.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Organization</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Apex Media Operations"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Profile Fleet Size</label>
                  <select
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                  >
                    <option value="1-10">1 - 10 Profiles</option>
                    <option value="10-50">10 - 50 Profiles</option>
                    <option value="50-200">50 - 200 Profiles</option>
                    <option value="200-1000">200 - 1,000 Profiles</option>
                    <option value="1000+">1,000+ Profiles</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp / Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9376343629"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Use Case</label>
                <select
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                >
                  <option value="Affiliate Marketing & Media Buying">Affiliate Marketing & Media Buying</option>
                  <option value="Automated Web Scraping & Data Extraction">Automated Web Scraping & Data Extraction</option>
                  <option value="Social Media & Account Management">Social Media & Account Management</option>
                  <option value="E-Commerce Multi-Store Fleet">E-Commerce Multi-Store Fleet</option>
                  <option value="Crypto / Airdrop Farming">Crypto / Airdrop Farming</option>
                  <option value="Other Enterprise Automation">Other Enterprise Automation</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-red-600 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50 mt-2"
              >
                {isLoading ? 'Submitting...' : 'Request Architecture Consultation'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
