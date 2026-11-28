'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getPricingFaqs } from './pricing-data';

interface PricingFaqProps {
  upiId: string;
  onDownloadClick: (source: string) => void;
}

export function PricingFaq({ upiId, onDownloadClick }: PricingFaqProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section className="w-full py-20 bg-[#f9f9f9] text-[#080808]">
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Header Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#080808] inline-block"></span>
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.2em] text-[#080808]">
                FAQ
              </span>
            </div>
            <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[46px] font-light tracking-tight leading-[1.1] text-[#080808]">
              Your Questions<br />Answered
            </h2>
            <p className="text-sm text-[#555555] leading-relaxed max-w-md pt-2 pb-4">
              MAHI Browser eliminates cloud lock-in and international FX fees with local-first air-gapped stealth and instant UPI payments.
            </p>
            <div>
              <Link
                href="/download?auto=true"
                onClick={() => onDownloadClick('pricing_faq')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#080808] text-white px-6 py-2.5 text-xs sm:text-[13px] font-medium hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Free (15 Profiles)
              </Link>
            </div>
          </div>

          {/* Right Accordion Column */}
          <div className="lg:col-span-7 divide-y divide-[#e6e3e3] border-y border-[#e6e3e3]">
            {getPricingFaqs(upiId).map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={faq.question} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left py-2 group"
                    aria-expanded={isOpen}
                  >
                    <span className="text-[15px] sm:text-[16px] font-medium text-[#080808] group-hover:text-zinc-600 transition-colors pr-6">
                      {faq.question}
                    </span>
                    <span className="text-xl font-light text-[#888888] flex-shrink-0">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pt-2 pb-3 text-sm text-[#555555] leading-relaxed animate-fadeIn">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
