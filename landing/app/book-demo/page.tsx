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
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/commercial/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name,
          email,
          companyName: company,
          teamSize,
          useCase,
          contactMethod: phone,
          message: `Fleet Size: ${teamSize} | Primary Use Case: ${useCase}`,
        }),
      });
      if (resp.ok) {
        setSubmitted(true);
      } else {
        const data = await resp.json().catch(() => ({}));
        alert(data.error || 'Failed to submit demo request. Please verify your details.');
      }
    } catch {
      alert('Network error connecting to MAHI Enterprise API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#030303] text-white selection:bg-white selection:text-black pt-24 sm:pt-32 pb-24 overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/assets/company/hero_walking.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-10 filter contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/90 via-[#030303]/95 to-[#030303]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_900px_600px_at_50%_20%,rgba(255,255,255,0.03),transparent)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Context & Direct Contact */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
                <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                  ENTERPRISE ARCHITECTURE
                </span>
              </div>

              {/* Spectral Serif Headline */}
              <h1 className="font-['Spectral',serif] text-3xl sm:text-5xl font-light tracking-[-0.03em] leading-tight text-white mb-4">
                Deploy Undetectable Browser Fleets
              </h1>

              <p className="text-white/60 text-[14px] sm:text-[15px] leading-relaxed">
                Schedule a 1-on-1 architecture review with MAHI Browser&apos;s core engineering team. We&apos;ll audit your current anti-detect setup, verify CreepJS and Cloudflare bypass rates, and demonstrate distributed Redis concurrency locking.
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5 font-mono">
                  ✓
                </div>
                <div className="text-[13px] text-zinc-300 leading-relaxed">
                  <strong className="text-white font-medium">Custom C++ Engine Builds:</strong> Private ANGLE WebGL and canvas noise patches customized exclusively for your domain fleet.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5 font-mono">
                  ✓
                </div>
                <div className="text-[13px] text-zinc-300 leading-relaxed">
                  <strong className="text-white font-medium">Dedicated On-Premise Fastify Gateway:</strong> Self-hosted central database and distributed profile mutex on your private VPC.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5 font-mono">
                  ✓
                </div>
                <div className="text-[13px] text-zinc-300 leading-relaxed">
                  <strong className="text-white font-medium">Direct WhatsApp Escalation:</strong> 24/7 direct escalation line to {BRAND.creator} and core developers.
                </div>
              </div>
            </div>

            {/* Direct Contact Bento Card */}
            <div className="rounded-[8px] border border-white/10 bg-[#131517] p-6 space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290]">
                Direct Contact Details
              </div>
              <div className="text-[13px] text-zinc-300 space-y-1.5 font-sans">
                <div>Email: <a href={`mailto:${BRAND.officialEmail}`} className="text-white hover:underline underline-offset-4">{BRAND.officialEmail}</a></div>
                <div>WhatsApp: <a href={BRAND.whatsapp.url} className="text-white hover:underline underline-offset-4">Chat on WhatsApp</a></div>
                <div>Founder & CEO: <strong className="text-white">{BRAND.creator}</strong></div>
              </div>
            </div>
          </div>

          {/* Right Column: Form Bento Card */}
          <div className="lg:col-span-7">
            <div className="relative rounded-[8px] border border-white/10 bg-[#131517] p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
              {/* Subtle top hairline */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              {submitted ? (
                <div className="text-center py-12 space-y-5">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white text-2xl font-light">
                    ✓
                  </div>
                  <h3 className="font-['Spectral',serif] text-2xl sm:text-3xl text-white font-light">
                    Consultation Request Received
                  </h3>
                  <p className="text-white/60 text-[13px] max-w-sm mx-auto leading-relaxed">
                    Thank you, <strong className="text-white">{name}</strong>. {BRAND.creator} or our enterprise lead will contact you via WhatsApp or email within 2 hours.
                  </p>
                  <div className="pt-4">
                    <Link
                      href="/download"
                      className="inline-flex rounded-full bg-white text-black px-6 py-2.5 text-[13px] font-medium hover:bg-zinc-200 transition"
                    >
                      Download Free Desktop Client
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="mb-6">
                    <h2 className="font-['Spectral',serif] text-2xl sm:text-[28px] font-light text-white mb-1">
                      Request Architecture Consultation
                    </h2>
                    <p className="text-white/60 text-[13px]">
                      Complete the parameters below to schedule your engineering session.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mahipal Choudhary"
                      className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-4 py-2.5 text-[14px] text-white placeholder-zinc-500 focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
                      Corporate Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-4 py-2.5 text-[14px] text-white placeholder-zinc-500 focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
                      Company / Organization
                    </label>
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Apex Media Operations"
                      className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-4 py-2.5 text-[14px] text-white placeholder-zinc-500 focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
                        Profile Fleet Size
                      </label>
                      <select
                        value={teamSize}
                        onChange={(e) => setTeamSize(e.target.value)}
                        className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-3.5 py-2.5 text-[13px] text-white focus:border-white/40 focus:outline-none"
                      >
                        <option value="1-10">1 - 10 Profiles</option>
                        <option value="10-50">10 - 50 Profiles</option>
                        <option value="50-200">50 - 200 Profiles</option>
                        <option value="200-1000">200 - 1,000 Profiles</option>
                        <option value="1000+">1,000+ Profiles</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
                        WhatsApp / Direct Phone
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-4 py-2.5 text-[14px] text-white placeholder-zinc-500 focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1.5">
                      Primary Use Case
                    </label>
                    <select
                      value={useCase}
                      onChange={(e) => setUseCase(e.target.value)}
                      className="w-full rounded-[6px] border border-white/10 bg-[#080808] px-3.5 py-2.5 text-[13px] text-white focus:border-white/40 focus:outline-none"
                    >
                      <option value="Affiliate Marketing & Media Buying">Affiliate Marketing & Media Buying</option>
                      <option value="Automated Web Scraping & Data Extraction">Automated Web Scraping & Data Extraction</option>
                      <option value="Social Media & Account Management">Social Media & Account Management</option>
                      <option value="E-Commerce Multi-Store Fleet">E-Commerce Multi-Store Fleet</option>
                      <option value="Crypto / Airdrop Farming">Crypto / Airdrop Farming</option>
                      <option value="Other Enterprise Automation">Other Enterprise Automation</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full rounded-full bg-white text-black py-3 text-[14px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-white/5"
                    >
                      {isLoading ? 'Submitting...' : 'Request Architecture Consultation'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
