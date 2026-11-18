'use client';

import React, { useState } from 'react';

export interface FaqItem {
  question: string;
  answer: string;
}

export const DEFAULT_FAQS: FaqItem[] = [
  {
    question: 'What makes MAHI Browser different from GoLogin, Multilogin, or AdsPower?',
    answer:
      'Unlike legacy anti-detect browsers that rely on easily detectable prototypes on outdated browser forks, MAHI Browser uses Chromium 138 with JavaScript-layer MV3 main-world stealth injection (canvas/audio/WebGL/timezone/client-hints coherence) plus an on-demand Camoufox C++ hardened Gecko engine. We integrate rebrowser-patches to eliminate CDP Runtime.Enable leaks, offer local-first SQLite offline operation, and support distributed multi-seat profile sync with Redis concurrency locks.',
  },
  {
    question: 'How does the Dual-Engine (Chromium 138 + Camoufox) architecture protect against detection?',
    answer:
      'Certain anti-fraud systems (like DataDome, Akamai, and Cloudflare Turnstile) inspect browser-specific execution characteristics. By offering both Chromium 138 and on-demand Camoufox (hardened C++ Firefox engine with native Gecko Canvas/Audio/Font hooks), you can isolate profiles into completely distinct rendering and networking stacks, making cross-engine profile correlation virtually impossible.',
  },
  {
    question: 'Does MAHI Browser work completely offline without sending data to servers?',
    answer:
      'Yes. MAHI Browser is designed with a strict local-first architecture. All profiles, proxies, tags, and settings are stored locally in an embedded SQLite database. Cloud sync (to encrypted Cloudflare R2) is completely optional and opt-in. You can run MAHI Browser in completely air-gapped environments.',
  },
  {
    question: 'What payment methods are supported, and how does instant UPI work?',
    answer:
      'We support instant Indian UPI payments via dynamic QR code (VPA: 6375823589@slc) with 0% gateway processing fees, providing instant license activation. For international customers, we support major credit cards and wire transfers in USD and EUR.',
  },
  {
    question: 'Can my team share profiles without getting locked out or corrupting browser sessions?',
    answer:
      'Yes. Our Cloud Gateway features distributed concurrency locks powered by Redis (and in-memory fallback). When a teammate launches a cloud-synced profile, a distributed mutex lock is acquired. If another user attempts to launch the same profile, they are warned to prevent session corruption and cookie collision. Once the session terminates, state is encrypted and synchronized to cloud storage.',
  },
  {
    question: 'How does MAHI Browser eliminate CDP leaks in automated browser workflows?',
    answer:
      'When Puppeteer or Playwright connect to standard Chromium via Chrome DevTools Protocol, standard engines expose internal Runtime.enable artifacts and CDP execution contexts that sophisticated bot managers instantly flag. MAHI Browser incorporates rebrowser-patches into the launcher and engine, isolating debugger evaluation frames so bot management scripts never detect automated execution.',
  },
];

export default function FaqAccordion({ items = DEFAULT_FAQS }: { items?: FaqItem[] }) {
  const [openIndexes, setOpenIndexes] = useState<number[]>([0]);

  const toggle = (index: number) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  // Schema.org FAQPage JSON-LD
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <section className="w-full space-y-4">
      {/* Schema.org FAQPage structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="space-y-3">
        {items.map((item, idx) => {
          const isOpen = openIndexes.includes(idx);
          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'border-black/25 bg-white shadow-md'
                  : 'border-black/10 bg-white hover:border-black/20 shadow-sm'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 p-5 text-left text-sm sm:text-[15px] font-medium text-[#0a0a0a] transition focus:outline-none"
              >
                <span className="font-['Spectral',serif] text-base sm:text-lg">{item.question}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/10 bg-zinc-100 text-zinc-700 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 bg-black text-white border-black' : ''
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-[13.5px] leading-relaxed text-zinc-600 border-t border-black/5 font-normal">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
