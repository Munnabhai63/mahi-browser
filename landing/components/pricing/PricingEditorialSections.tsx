import Image from 'next/image';
import Link from 'next/link';
import { PLATFORM_LOGOS } from './pricing-data';

export function PlatformLogosBar() {
  return (
    <div className="w-full mt-16 sm:mt-24 pt-8 border-t border-white/10">
      <div className="flex items-center justify-between gap-6 sm:gap-8 md:gap-10 overflow-x-auto no-scrollbar py-2">
        {PLATFORM_LOGOS.map((logo) => (
          <div key={logo.name} className="flex-shrink-0 flex items-center justify-center group" title={logo.name}>
            <Image
              src={logo.src}
              alt={logo.name}
              width={120}
              height={24}
              className={`${logo.h} w-auto max-w-[120px] object-contain invert brightness-0 opacity-50 group-hover:opacity-100 transition-opacity duration-200`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingTestimonialBento() {
  return (
    <section className="w-full py-12 lg:py-16 bg-[#f9f9f9]">
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="rounded-2xl sm:rounded-3xl bg-[#e5e5e3] overflow-hidden shadow-sm flex flex-col lg:flex-row items-stretch">
          {/* Left Photo Column */}
          <div className="lg:w-[45%] relative min-h-[300px] sm:min-h-[380px] lg:min-h-full overflow-hidden bg-zinc-200">
            <Image
              src="/assets/customers/lattice_case.jpg"
              alt="Executive Customer Case Study"
              fill
              className="object-cover object-center block"
            />
          </div>

          {/* Right Quote & Stats Column */}
          <div className="flex-1 p-8 sm:p-12 lg:p-16 flex flex-col justify-between text-[#080808]">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xs font-mono font-semibold uppercase tracking-widest text-[#555555]">
                  Westbridge Media Fleets
                </span>
              </div>

              <blockquote className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[32px] font-normal leading-[1.25] tracking-tight mb-8">
                “MAHI Browser has been transformational. We scaled 450+ ad accounts with a 99.8% survival rate, completely eliminating CDP detection flags and saving $180,000 annually versus GoLogin seat fees.”
              </blockquote>

              <div className="text-xs font-mono uppercase tracking-widest text-[#777777] mb-8">
                Marcus Vance • <span className="text-[#333333]">Head of Media Operations</span>
              </div>
            </div>

            {/* 3 Key Stats with Vertical Dividers */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[rgba(0,0,0,0.12)]">
              <div>
                <div className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-[#080808]">
                  $180K
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-1">
                  Cost Savings
                </div>
              </div>

              <div className="border-l border-[rgba(0,0,0,0.14)] pl-4">
                <div className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-[#080808]">
                  99.8%
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-1">
                  Fleet Survival
                </div>
              </div>

              <div className="border-l border-[rgba(0,0,0,0.14)] pl-4">
                <div className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-[#080808]">
                  10x
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono text-[#666666] uppercase tracking-wider mt-1">
                  ROI
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PricingPreFooterCtaProps {
  onDownloadClick: (source: string) => void;
}

export function PricingPreFooterCta({ onDownloadClick }: PricingPreFooterCtaProps) {
  return (
    <section className="w-full py-16 bg-[#f9f9f9]">
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
        <div className="relative rounded-2xl border border-black/10 bg-[#080808] text-white p-10 sm:p-16 text-center overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block"></span>
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
                GET STARTED
              </span>
            </div>

            <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-5xl font-normal text-white tracking-tight leading-tight">
              See Why Top Growth Fleets<br />
              <span className="italic text-zinc-400 font-light">Use MAHI Browser</span>
            </h2>

            <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
              Download MAHI Browser now to experience undetected dual-engine stealth with 15 free profiles.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/download?auto=true"
                onClick={() => onDownloadClick('pricing_prefooter')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-7 py-3 text-xs sm:text-[13px] font-medium transition-all duration-200 hover:bg-zinc-200 active:scale-[0.98] shadow-lg shadow-white/5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Free (15 Profiles)
              </Link>
              <Link
                href="/compare"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-xs sm:text-[13px] font-medium text-zinc-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
              >
                Compare vs GoLogin &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
